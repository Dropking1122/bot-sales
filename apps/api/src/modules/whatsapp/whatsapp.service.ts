import fs from 'fs';
import path from 'path';
import { Client, LocalAuth, Message as WAMessage, MessageMedia } from 'whatsapp-web.js';
import qrcode from 'qrcode';
import { config } from '../../config/env';
import { logger } from '../../config/logger';
import { prisma } from '../../config/db';
import { normalizePhoneNumber, formatRupiah, WhatsAppStatus, isValidPhoneNumber } from '@bot-sales/shared';
import {
  calculateFinancing,
  calculateMultiTenors,
  formatMultiTenorText,
  formatSimulationText,
  parseIndonesianNumber
} from '../financing/financing.service';

export interface BotResponsePayload {
  text: string;
  mediaPath?: string;
  mediaUrl?: string;
  mediaType?: string;
}

class WhatsAppManager {
  private client: Client | null = null;
  private status: WhatsAppStatus = 'DISCONNECTED';
  private qrCodeDataUrl: string | null = null;
  private isInitializing = false;

  constructor() {
    // Session state
  }

  public getStatus(): { status: WhatsAppStatus; qrCode: string | null; qrImage: string | null } {
    return {
      status: this.status,
      qrCode: this.qrCodeDataUrl,
      qrImage: this.qrCodeDataUrl
    };
  }

  public async initialize(): Promise<void> {
    if (this.isInitializing || this.status === 'CONNECTED') {
      return;
    }

    if (this.client) {
      try {
        await this.client.destroy();
      } catch (e) {
        // ignore
      }
      this.client = null;
    }

    this.isInitializing = true;
    this.status = 'INITIALIZING';
    this.updateDbStatus('INITIALIZING');

    try {
      this.client = new Client({
        authStrategy: new LocalAuth({
          dataPath: config.storage.whatsappSessionDir
        }),
        puppeteer: {
          headless: true,
          executablePath: '/usr/bin/google-chrome',
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
          ]
        }
      });

      this.registerEvents();
      await this.client.initialize();
    } catch (err: any) {
      logger.error({ err }, 'WhatsApp initialization failed');
      this.status = 'DISCONNECTED';
      this.isInitializing = false;
      this.updateDbStatus('DISCONNECTED');
    }
  }

  private registerEvents(): void {
    if (!this.client) return;

    this.client.on('qr', async (qr) => {
      this.status = 'QR_READY';
      this.isInitializing = false;
      this.qrCodeDataUrl = await qrcode.toDataURL(qr);
      logger.info('WhatsApp QR Code generated');
      this.updateDbStatus('QR_READY', this.qrCodeDataUrl);
    });

    this.client.on('authenticated', () => {
      this.status = 'AUTHENTICATED';
      this.qrCodeDataUrl = null;
      logger.info('WhatsApp Authenticated successfully');
      this.updateDbStatus('AUTHENTICATED');
    });

    this.client.on('auth_failure', (msg) => {
      this.status = 'AUTH_FAILURE';
      this.qrCodeDataUrl = null;
      this.isInitializing = false;
      logger.error({ msg }, 'WhatsApp Auth Failure');
      this.updateDbStatus('AUTH_FAILURE');
    });

    this.client.on('ready', () => {
      this.status = 'CONNECTED';
      this.isInitializing = false;
      this.qrCodeDataUrl = null;
      logger.info('WhatsApp Client is READY and CONNECTED');
      this.updateDbStatus('CONNECTED');
      this.syncLidContactsToPhone().catch((err) => logger.error({ err }, 'Error during syncLidContactsToPhone'));
    });

    this.client.on('disconnected', (reason) => {
      this.status = 'DISCONNECTED';
      this.isInitializing = false;
      this.qrCodeDataUrl = null;
      logger.warn({ reason }, 'WhatsApp Client Disconnected');
      this.updateDbStatus('DISCONNECTED');
    });

    this.client.on('message', async (msg) => {
      await this.handleIncomingMessage(msg);
    });
  }

  private async updateDbStatus(status: any, qr?: string | null) {
    try {
      await prisma.whatsAppSession.upsert({
        where: { sessionName: 'default' },
        update: {
          status,
          qrCode: qr !== undefined ? qr : null,
          lastConnectedAt: status === 'CONNECTED' ? new Date() : undefined
        },
        create: {
          sessionName: 'default',
          status,
          qrCode: qr || null,
          lastConnectedAt: status === 'CONNECTED' ? new Date() : undefined
        }
      });
    } catch (e) {
      // db log ignore
    }
  }

  public async resolveLidToPn(lidOrJid: string): Promise<string | null> {
    if (!this.client || !lidOrJid) return null;

    if (lidOrJid.endsWith('@c.us') || lidOrJid.endsWith('@s.whatsapp.net')) {
      return lidOrJid.replace('@c.us', '').replace('@s.whatsapp.net', '');
    }

    if (!lidOrJid.endsWith('@lid') && !lidOrJid.includes('@')) {
      if (/^628\d{8,12}$/.test(lidOrJid) || /^08\d{8,12}$/.test(lidOrJid)) {
        return lidOrJid;
      }
    }

    const lidJid = lidOrJid.includes('@') ? lidOrJid : `${lidOrJid}@lid`;

    // 1. Try official getContactLidAndPhone
    try {
      const res = await this.client.getContactLidAndPhone([lidJid]);
      if (res && res.length > 0 && res[0].pn) {
        const cleanPn = res[0].pn.replace('@c.us', '').replace('@s.whatsapp.net', '');
        if (cleanPn && isValidPhoneNumber(cleanPn)) {
          logger.info({ lidJid, pn: cleanPn }, 'Resolved LID via getContactLidAndPhone');
          return cleanPn;
        }
      }
    } catch (err: any) {
      logger.warn({ errMsg: err?.message, lidJid }, 'getContactLidAndPhone failed');
    }

    // 2. Try Puppeteer evaluate with internal WhatsApp Web modules
    try {
      const page = (this.client as any).pupPage;
      if (page) {
        const resolved = await page.evaluate(async (userId: string) => {
          try {
            const widFactory = window.require('WAWebWidFactory');
            const wid = widFactory.createWid(userId);

            // Strategy A: WAWebLidMigrationUtils.toPn
            try {
              const { toPn } = window.require('WAWebLidMigrationUtils') || {};
              if (toPn) {
                const pnWid = toPn(wid);
                if (pnWid && pnWid.user && !pnWid.user.includes('@lid')) {
                  return pnWid.user;
                }
              }
            } catch (e) {}

            // Strategy B: WAWebApiContact getPhoneNumber or getAlternateUserWid
            try {
              const contactApi = window.require('WAWebApiContact');
              if (contactApi) {
                if (contactApi.getPhoneNumber) {
                  const pn = contactApi.getPhoneNumber(wid);
                  if (pn && pn.user) return pn.user;
                }
                if (contactApi.getAlternateUserWid) {
                  const alt = contactApi.getAlternateUserWid(wid);
                  if (alt && alt.user) return alt.user;
                }
              }
            } catch (e) {}

            // Strategy C: Contact collection lookup
            try {
              const collections = window.require('WAWebCollections');
              if (collections && collections.Contact) {
                const c = collections.Contact.get(wid);
                if (c && c.phoneNumber && c.phoneNumber.user) {
                  return c.phoneNumber.user;
                }
              }
            } catch (e) {}
          } catch (e) {
            return null;
          }
          return null;
        }, lidJid);

        if (resolved) {
          logger.info({ lidJid, pn: resolved }, 'Resolved LID via Puppeteer in-page evaluation');
          return resolved.replace('@c.us', '').replace('@s.whatsapp.net', '');
        }
      }
    } catch (err: any) {
      logger.warn({ errMsg: err?.message, lidJid }, 'Puppeteer in-page LID resolution failed');
    }

    return null;
  }

  public async syncLidContactsToPhone(): Promise<void> {
    if (!this.client) return;
    try {
      const contacts = await prisma.contact.findMany({
        where: {
          OR: [
            { phone: { contains: '@lid' } },
            { phoneNormalized: { startsWith: '260' } },
            { phoneNormalized: { startsWith: '479' } }
          ]
        }
      });

      for (const c of contacts) {
        const lidJid = c.phone.includes('@') ? c.phone : `${c.phone}@lid`;
        const realPhone = await this.resolveLidToPn(lidJid);
        if (realPhone && isValidPhoneNumber(realPhone)) {
          const normalized = normalizePhoneNumber(realPhone);
          logger.info({ contactId: c.id, old: c.phone, resolved: realPhone }, 'Synced contact LID to real phone');
          await prisma.contact.update({
            where: { id: c.id },
            data: {
              phone: realPhone,
              phoneNormalized: normalized,
              internalNotes: c.internalNotes ? `${c.internalNotes} [LID: ${lidJid}]` : `[LID: ${lidJid}]`
            }
          });
          await prisma.lead.updateMany({
            where: { contactId: c.id },
            data: { phone: normalized }
          });
        }

        // Ensure every contact has a Lead
        const existingLead = await prisma.lead.findFirst({
          where: { contactId: c.id }
        });
        if (!existingLead) {
          await prisma.lead.create({
            data: {
              contactId: c.id,
              customerName: c.name || 'Prospek WhatsApp',
              phone: c.phoneNormalized || c.phone,
              status: 'BARU',
              notes: 'Inbound chat WhatsApp'
            }
          });
          logger.info({ contactId: c.id, customer: c.name }, 'Created missing lead for existing contact');
        }
      }
    } catch (err: any) {
      logger.error({ err }, 'Error in syncLidContactsToPhone');
    }
  }

  public async handleIncomingMessage(msg: WAMessage): Promise<void> {
    // 1. Strictly ignore own messages, status stories, broadcasts, channels (newsletters), and groups
    if (
      msg.fromMe ||
      msg.isStatus ||
      msg.broadcast ||
      msg.from === 'status@broadcast' ||
      msg.from.includes('@newsletter') ||
      msg.from.includes('@broadcast') ||
      msg.from.includes('@g.us') ||
      (msg.author && (msg.author.includes('@newsletter') || msg.author.includes('@g.us')))
    ) {
      return;
    }

    // 2. Ignore non-conversational message types
    const validTypes = ['chat', 'image', 'document', 'audio', 'voice', 'video', 'location', 'buttons_response'];
    if (msg.type && !validTypes.includes(msg.type)) {
      return;
    }

    let targetJid = msg.from;
    let rawPhone = msg.from.replace('@c.us', '');
    let realPhone: string | null = null;

    // If message is from privacy LID, try resolving actual phone number via getContact
    let contactDetail: any = null;
    try {
      contactDetail = await msg.getContact();
      if (contactDetail?.number) {
        realPhone = contactDetail.number;
      }
    } catch (e) {
      // ignore
    }

    if (!realPhone && (targetJid.endsWith('@lid') || (msg.author && msg.author.endsWith('@lid')))) {
      realPhone = await this.resolveLidToPn(targetJid);
    }

    if (realPhone && isValidPhoneNumber(realPhone)) {
      rawPhone = realPhone;
    }

    // Double check that resolved rawPhone or JID is not newsletter
    if (rawPhone.includes('newsletter') || targetJid.includes('newsletter')) {
      return;
    }

    const normalizedPhone = normalizePhoneNumber(rawPhone);
    const body = (msg.body || '').trim();

    if (!body && !msg.hasMedia) {
      return;
    }

    try {
      // 1. Get or create Contact
      let contact = await prisma.contact.findFirst({
        where: {
          OR: [
            { phoneNormalized: normalizedPhone },
            { phone: rawPhone },
            { phone: targetJid }
          ]
        }
      });

      const resolvedName =
        contactDetail?.pushname ||
        contactDetail?.name ||
        (msg as any)._data?.notifyName ||
        (msg as any).notifyName ||
        msg.author ||
        rawPhone;

      if (!contact) {
        contact = await prisma.contact.create({
          data: {
            name: resolvedName,
            phone: rawPhone,
            phoneNormalized: normalizedPhone,
            source: 'WHATSAPP_BOT',
            consentStatus: 'GRANTED',
            consentSource: 'CHAT_INITIATED',
            consentAt: new Date(),
            internalNotes: targetJid.endsWith('@lid') ? `[LID: ${targetJid}]` : undefined
          }
        });
      } else {
        const hasLidPhone = contact.phone.includes('@lid') || !isValidPhoneNumber(contact.phone);
        const canUpgradePhone = realPhone && isValidPhoneNumber(realPhone);
        const shouldUpdateName = (!contact.name || contact.name === contact.phone) && resolvedName && resolvedName !== rawPhone;

        if (canUpgradePhone || shouldUpdateName) {
          contact = await prisma.contact.update({
            where: { id: contact.id },
            data: {
              name: shouldUpdateName ? resolvedName : undefined,
              phone: canUpgradePhone ? rawPhone : undefined,
              phoneNormalized: canUpgradePhone ? normalizedPhone : undefined,
              internalNotes: targetJid.endsWith('@lid') && !contact.internalNotes?.includes(targetJid)
                ? (contact.internalNotes ? `${contact.internalNotes} [LID: ${targetJid}]` : `[LID: ${targetJid}]`)
                : undefined
            }
          });

          if (canUpgradePhone) {
            await prisma.lead.updateMany({
              where: { contactId: contact.id },
              data: { phone: normalizedPhone }
            });
          }
        }
      }

      // 2. Get or create Conversation
      let conversation = await prisma.conversation.findFirst({
        where: { contactId: contact.id }
      });

      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: {
            contactId: contact.id,
            status: 'ACTIVE',
            isBotActive: true
          }
        });
      }

      // Record incoming message in DB
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderType: 'CUSTOMER',
          content: body,
          waMessageId: msg.id.id,
          status: 'DELIVERED'
        }
      });

      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date() }
      });

      // 2b. Automatically ensure Lead exists for this contact
      let activeLead = await prisma.lead.findFirst({
        where: {
          contactId: contact.id,
          status: { in: ['BARU', 'DIHUBUNGI'] }
        },
        orderBy: { createdAt: 'desc' }
      });

      if (!activeLead) {
        activeLead = await prisma.lead.create({
          data: {
            contactId: contact.id,
            customerName: contact.name || 'Prospek WhatsApp',
            phone: contact.phoneNormalized || contact.phone,
            status: 'BARU',
            notes: `Inbound chat WhatsApp: "${body.slice(0, 100)}"`
          }
        });
        logger.info({ leadId: activeLead.id, customer: contact.name, phone: contact.phoneNormalized }, 'Lead automatically created for inbound chat');
      }

      // 3. If bot is deactivated (Sales takeover), skip auto-reply
      if (!conversation.isBotActive || conversation.status === 'HANDOFF') {
        logger.info(`Message from ${normalizedPhone} skipped auto-reply (Sales takeover active)`);
        return;
      }

      // 4. Determine Bot Intent & Reply
      const botResponse = await this.resolveBotResponse(body, contact);

      if (botResponse) {
        const payload: BotResponsePayload =
          typeof botResponse === 'string' ? { text: botResponse } : botResponse;

        if (payload.mediaPath && fs.existsSync(payload.mediaPath)) {
          let mediaSent = false;
          try {
            logger.info({ mediaPath: payload.mediaPath, from: msg.from }, 'Sending motorcycle photo with caption to client');
            const media = MessageMedia.fromFilePath(payload.mediaPath);
            // Primary attempt: sendMessage directly to msg.from (avoids quotedMessageId lookup errors)
            if (this.client) {
              await this.client.sendMessage(msg.from, media, { caption: payload.text });
              logger.info('Motorcycle photo sent successfully via sendMessage');
              mediaSent = true;
            } else {
              throw new Error('WhatsApp client is not initialized');
            }
          } catch (mediaErr: any) {
            logger.error(
              {
                errName: mediaErr?.name,
                errMsg: mediaErr?.message,
                errStack: mediaErr?.stack
              },
              'Failed to send media via sendMessage, attempting msg.reply'
            );

            try {
              const media = MessageMedia.fromFilePath(payload.mediaPath);
              await msg.reply(media, undefined, { caption: payload.text });
              logger.info('Motorcycle photo sent successfully via msg.reply');
              mediaSent = true;
            } catch (replyErr: any) {
              logger.error(
                {
                  errName: replyErr?.name,
                  errMsg: replyErr?.message,
                  errStack: replyErr?.stack
                },
                'Failed to send media via msg.reply, falling back to text with direct image URL'
              );
            }
          }

          if (!mediaSent) {
            let textWithPhotoLink = payload.text;
            if (payload.mediaUrl) {
              const fullUrl = `https://m.revd.dev${payload.mediaUrl}`;
              textWithPhotoLink = `📷 *Foto Unit Motor:*\n${fullUrl}\n\n` + payload.text;
            }
            await msg.reply(textWithPhotoLink);
          }
        } else {
          logger.info({ mediaPath: payload.mediaPath }, 'No valid media path found, sending text only');
          await msg.reply(payload.text);
        }

        // Store bot message in DB
        await prisma.message.create({
          data: {
            conversationId: conversation.id,
            senderType: 'BOT',
            content: payload.text,
            mediaUrl: payload.mediaUrl || null,
            mediaType: payload.mediaType || (payload.mediaUrl ? 'image/png' : null),
            status: 'SENT'
          }
        });
      }
    } catch (error) {
      logger.error({ error, rawPhone, body }, 'Error handling incoming WA message');
    }
  }

  private async resolveBotResponse(text: string, contact: any): Promise<string | BotResponsePayload> {
    const lower = text.toLowerCase().trim();

    // 1. Opt-out request
    if (lower === 'stop' || lower === 'berhenti') {
      await prisma.contact.update({
        where: { id: contact.id },
        data: { isOptOut: true, consentStatus: 'OPT_OUT' }
      });
      return 'Nomor Anda telah berhasil dikecualikan (opt-out) dari pesan siaran promosi kami. Terima kasih!';
    }

    // 2. Sales handoff request
    if (lower.includes('sales') || lower.includes('admin') || lower.includes('cs') || lower.includes('manusia')) {
      await prisma.conversation.updateMany({
        where: { contactId: contact.id },
        data: { isBotActive: false, status: 'HANDOFF' }
      });

      // Update or create lead
      const existingLead = await prisma.lead.findFirst({
        where: {
          contactId: contact.id,
          status: { in: ['BARU', 'DIHUBUNGI'] }
        },
        orderBy: { createdAt: 'desc' }
      });

      if (existingLead) {
        await prisma.lead.update({
          where: { id: existingLead.id },
          data: {
            notes: (existingLead.notes ? `${existingLead.notes} | ` : '') + 'Permintaan pengalihan langsung ke tim sales melalui WhatsApp Bot'
          }
        });
      } else {
        await prisma.lead.create({
          data: {
            contactId: contact.id,
            customerName: contact.name || 'Prospek WhatsApp',
            phone: contact.phoneNormalized || contact.phone,
            status: 'BARU',
            notes: 'Permintaan pengalihan langsung ke tim sales melalui WhatsApp Bot'
          }
        });
      }

      return 'Baik, percakapan ini sedang dialihkan ke tim sales kami. Sales konsultan kami akan segera menghubungi Anda langsung. Mohon ditunggu ya! 🙏';
    }

    // 3. Catalog request
    if (lower === 'katalog' || lower === 'motor' || lower === 'daftar' || lower === 'daftar motor' || lower.includes('pilihan')) {
      const motors = await prisma.motorcycle.findMany({
        where: { isActive: true },
        include: { brand: true },
        take: 15,
        orderBy: { priceOtr: 'asc' }
      });

      if (motors.length === 0) {
        return 'Saat ini belum ada data motor aktif di katalog. Hubungi sales kami untuk info unit ready.';
      }

      let res = `🏍️ *KATALOG MOTOR DEALER RESMI*\n\n` +
        `Silakan pilih motor dengan membalas *NOMOR ANGKA* (contoh: ketik *2*):\n\n`;

      motors.forEach((m, idx) => {
        const otr = Number(m.priceOtr);
        const minDp = m.minDp ? Number(m.minDp) : otr * 0.1;
        res += `${idx + 1}. *${m.name}* (${m.brand.name})\n`;
        res += `   • OTR: ${formatRupiah(otr)} | DP: ${formatRupiah(minDp)}\n`;
      });

      res += `\n👉 *Cukup ketik ANGKA pilihan Anda (misal: 1 s/d ${motors.length})* untuk langsung melihat detail & simulasi kreditnya!\n` +
        `Ketik *SALES* untuk bicara langsung dengan konsultan kami.`;
      return res;
    }

    // 3b. Direct number selection: e.g. "1", "2", "3", ...
    const singleNumberMatch = lower.match(/^#?(\d{1,2})$/);
    if (singleNumberMatch) {
      const idx = parseInt(singleNumberMatch[1], 10);
      const allMotors = await prisma.motorcycle.findMany({
        where: { isActive: true },
        include: {
          brand: true,
          images: {
            orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
            take: 1
          }
        },
        orderBy: { priceOtr: 'asc' }
      });

      if (idx >= 1 && idx <= allMotors.length) {
        const selectedMotor = allMotors[idx - 1];
        try {
          const lead = await prisma.lead.findFirst({
            where: {
              contactId: contact.id,
              status: { in: ['BARU', 'DIHUBUNGI'] }
            },
            orderBy: { createdAt: 'desc' }
          });
          if (lead) {
            await prisma.lead.update({
              where: { id: lead.id },
              data: {
                motorcycleId: selectedMotor.id,
                notes: `Tertarik pada motor #${idx} ${selectedMotor.name} (OTR: ${formatRupiah(Number(selectedMotor.priceOtr))})`
              }
            });
          }
        } catch (e) {}

        return await this.formatMotorDetail(selectedMotor, idx);
      }
    }

    // 4. Detail request: "INFO <SKU/NOMOR>" or "DETAIL <SKU/NOMOR>"
    if (lower.startsWith('info ') || lower.startsWith('detail ')) {
      const query = lower.replace(/^(info|detail)\s+/, '').trim();
      
      const allMotors = await prisma.motorcycle.findMany({
        where: { isActive: true },
        include: {
          brand: true,
          images: {
            orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
            take: 1
          }
        },
        orderBy: { priceOtr: 'asc' }
      });

      let motor: any = null;
      let matchedIndex: number | undefined = undefined;

      // Check if query is a number (e.g. "INFO 2")
      const numQuery = parseInt(query, 10);
      if (!isNaN(numQuery) && numQuery >= 1 && numQuery <= allMotors.length && /^\d+$/.test(query)) {
        motor = allMotors[numQuery - 1];
        matchedIndex = numQuery;
      } else {
        const foundIdx = allMotors.findIndex(
          (m) =>
            m.sku.toLowerCase() === query ||
            m.name.toLowerCase().includes(query) ||
            m.model.toLowerCase().includes(query)
        );
        if (foundIdx !== -1) {
          motor = allMotors[foundIdx];
          matchedIndex = foundIdx + 1;
        }
      }

      if (!motor) {
        return `Motor "${query}" tidak ditemukan di katalog kami. Ketik *KATALOG* untuk melihat daftar nomor motor yang tersedia.`;
      }

      try {
        const lead = await prisma.lead.findFirst({
          where: {
            contactId: contact.id,
            status: { in: ['BARU', 'DIHUBUNGI'] }
          },
          orderBy: { createdAt: 'desc' }
        });
        if (lead) {
          await prisma.lead.update({
            where: { id: lead.id },
            data: {
              motorcycleId: motor.id,
              notes: `Menanyakan info motor ${motor.name}`
            }
          });
        }
      } catch (e) {}

      return await this.formatMotorDetail(motor, matchedIndex);
    }

    // 5. Simulation inquiry: "SIMULASI", "KREDIT", "CICILAN", "ANGSURAN"
    const isSimulasiTrigger =
      lower.startsWith('simulasi') ||
      lower.startsWith('kredit') ||
      lower.startsWith('cicilan') ||
      lower.startsWith('angsuran') ||
      lower.includes('simulasi kredit');

    if (isSimulasiTrigger) {
      return await this.handleSimulationQuery(text, contact);
    }

    // 6. Address & Operating Hours
    if (lower.includes('alamat') || lower.includes('lokasi') || lower.includes('jam') || lower.includes('buka')) {
      const [address, hours, phone] = await Promise.all([
        prisma.botSetting.findUnique({ where: { key: 'bot_dealer_address' } }),
        prisma.botSetting.findUnique({ where: { key: 'bot_operating_hours' } }),
        prisma.botSetting.findUnique({ where: { key: 'bot_dealer_phone' } })
      ]);

      return `📍 *INFORMASI DEALER RESMI*\n\n` +
        `🏢 Alamat: ${address?.value || '-'}\n` +
        `🕒 Jam Operasional:\n${hours?.value || '-'}\n` +
        `📞 Kontak Sales: ${phone?.value || '-'}\n\n` +
        `Silakan kunjungi showroom kami untuk melihat langsung unit impian Anda!`;
    }

    // 7. Default greeting & fallback
    const greetingSetting = await prisma.botSetting.findUnique({ where: { key: 'bot_greeting' } });
    return greetingSetting?.value ||
      `Halo Kak ${contact.name}! Selamat datang di dealer motor kami 🏍️\n\n` +
      `Ketik:\n` +
      `• *KATALOG* - Daftar motor terbaru\n` +
      `• *SIMULASI* - Hitung estimasi kredit\n` +
      `• *LOKASI* - Alamat dealer & jam buka\n` +
      `• *SALES* - Bicara dengan tim sales kami`;
  }

  private async formatMotorDetail(motor: any, index?: number): Promise<BotResponsePayload> {
    const otr = Number(motor.priceOtr);
    const minDp = motor.minDp ? Number(motor.minDp) : Math.round(otr * 0.1);

    const sim = await calculateFinancing({
      hargaOtr: otr,
      dpAmount: minDp,
      tenorMonths: 35
    });

    const cleanKw = (motor.model || motor.name).replace(/^(all\s+new\s+|new\s+)?(honda\s+|yamaha\s+)?/i, '').trim().split(' ')[0].toUpperCase();
    const numPrefix = index ? `[No. ${index}] ` : '';

    let res = `🏍️ *${numPrefix}${motor.name.toUpperCase()}*\n` +
      `Merek: ${motor.brand.name} | Kategori: ${motor.category} | ${motor.condition}\n\n` +
      `💵 *Harga OTR:* ${formatRupiah(otr)}\n` +
      `💳 *Uang Muka (DP) Mulai:* ${formatRupiah(minDp)}\n` +
      `📊 *Estimasi Cicilan (35 bln):* ${formatRupiah(sim.monthlyInstallment)}/bln\n\n`;

    if (motor.colors && motor.colors.length > 0) {
      res += `🎨 *Pilihan Warna Ready:*\n` +
        motor.colors.map((c: string) => `• ${c}`).join('\n') + `\n\n`;
    }

    res += `📝 *Deskripsi & Fitur:*\n${motor.description || '-'}\n\n` +
      `───────────────\n` +
      `💡 *MENU PILIHAN CEPAT:*\n`;

    if (index) {
      res += `• Ketik *SIMULASI ${index}* : Hitung tabel angsuran lengkap\n` +
        `• Ketik *SIMULASI ${index} <DP>* : Simulasi DP pilihan (contoh: *SIMULASI ${index} 3jt*)\n`;
    } else {
      res += `• Ketik *SIMULASI ${cleanKw}* : Hitung tabel angsuran lengkap\n`;
    }

    res += `• Ketik *KATALOG* : Kembali ke daftar motor\n` +
      `• Ketik *SALES* : Konsultasi langsung dengan konsultan kami`;

    // Locate primary photo
    let mediaPath: string | undefined = undefined;
    let mediaUrl: string | undefined = undefined;

    if (motor.images && motor.images.length > 0) {
      const relUrl = motor.images[0].url;
      mediaUrl = relUrl;
      const filename = path.basename(relUrl);

      const candidates = [
        path.join(config.storage.uploadsDir, 'motorcycles', filename),
        path.join(config.storage.uploadsDir, filename),
        path.resolve(config.storage.baseDir, relUrl.replace(/^\/storage\/?/, '')),
        path.resolve('/root/bot-sales/storage/uploads/motorcycles', filename),
        path.join(process.cwd(), relUrl),
        path.resolve(process.cwd(), '../../', relUrl.replace(/^\//, ''))
      ];

      for (const cand of candidates) {
        if (fs.existsSync(cand)) {
          mediaPath = cand;
          break;
        }
      }
    }

    return {
      text: res,
      mediaPath,
      mediaUrl,
      mediaType: 'image/png'
    };
  }

  private async handleSimulationQuery(rawText: string, contact?: any): Promise<string> {
    const lower = rawText.toLowerCase().trim();
    // Strip triggers: "simulasi kredit", "simulasi cicilan", "simulasi", "kredit", "cicilan", "angsuran"
    const cleaned = lower
      .replace(/^(simulasi\s+kredit|simulasi\s+cicilan|simulasi|kredit|cicilan|angsuran)\s*/i, '')
      .trim();

    const allMotors = await prisma.motorcycle.findMany({
      where: { isActive: true },
      include: { brand: true },
      orderBy: { priceOtr: 'asc' }
    });

    // 1. If empty query: "SIMULASI" alone
    if (!cleaned) {
      const popularMotors = allMotors.slice(0, 8);

      let res = `📊 *LAYANAN SIMULASI KREDIT DEALER*\n\n` +
        `Pilih nomor motor untuk melihat rincian cicilan:\n\n`;

      if (popularMotors.length > 0) {
        popularMotors.forEach((m, idx) => {
          const otr = Number(m.priceOtr);
          const minDp = m.minDp ? Number(m.minDp) : Math.round(otr * 0.1);
          res += `${idx + 1}. *${m.name}*\n` +
            `   • OTR: ${formatRupiah(otr)} | DP Mulai: ${formatRupiah(minDp)}\n` +
            `   👉 Ketik: *SIMULASI ${idx + 1}*\n\n`;
        });
      }

      res += `💡 *Pilihan Format Mudah:*\n` +
        `• Ketik *SIMULASI <NOMOR>* (contoh: *SIMULASI 2*)\n` +
        `• Ketik *SIMULASI <NOMOR> <DP>* (contoh: *SIMULASI 2 3jt*)\n` +
        `• Ketik *SIMULASI <OTR> <DP> <TENOR>* (contoh: *SIMULASI 28jt 3jt 35*)\n\n` +
        `Ketik *SALES* untuk berkonsultasi langsung dengan konsultan kami.`;

      return res;
    }

    // 2. Check if input is purely numbers or index:
    const parts = cleaned.split(/\s+/).filter(Boolean);
    const num0 = parseIndonesianNumber(parts[0]);
    const num1 = parts.length > 1 ? parseIndonesianNumber(parts[1]) : null;
    const num2 = parts.length > 2 ? parseIndonesianNumber(parts[2]) : null;

    // Check if parts[0] is manual OTR price (>= 1_000_000)
    if (num0 && num0 >= 1_000_000) {
      const otr = num0;
      const dp = num1 !== null ? num1 : Math.round(otr * 0.1);

      if (dp >= otr) {
        return `⚠️ *Simulasi Ditolak*\n\nUang muka (DP) senilai ${formatRupiah(dp)} tidak boleh sama atau melebihi harga OTR (${formatRupiah(otr)}). Silakan gunakan nominal DP yang lebih kecil.`;
      }

      let customTenor: number | null = null;
      if (num2 && num2 >= 6 && num2 <= 60) {
        customTenor = num2;
      }

      const tenorsToCalculate = customTenor
        ? [11, 17, 23, 29, 35].includes(customTenor)
          ? [11, 17, 23, 29, 35]
          : [11, 23, customTenor, 35].sort((a, b) => a - b)
        : [11, 17, 23, 29, 35];

      const multi = await calculateMultiTenors(otr, dp, tenorsToCalculate);
      return formatMultiTenorText({
        hargaOtr: otr,
        dpAmount: dp,
        dpPercentage: multi.dpPercentage,
        options: multi.options
      });
    }

    // 3. Check if parts[0] is an index number from catalog (1 .. allMotors.length)
    let matchedMotor: any = null;
    let matchedIndex: number | undefined = undefined;
    let specifiedDp: number | null = null;
    let specifiedTenor: number | null = null;

    const maybeIdx = parseInt(parts[0], 10);
    if (!isNaN(maybeIdx) && maybeIdx >= 1 && maybeIdx <= allMotors.length && /^\d+$/.test(parts[0])) {
      matchedMotor = allMotors[maybeIdx - 1];
      matchedIndex = maybeIdx;

      for (let i = 1; i < parts.length; i++) {
        const part = parts[i];
        if (part === 'dp' || part === 'uang' || part === 'muka') {
          if (i + 1 < parts.length) {
            const nextVal = parseIndonesianNumber(parts[i + 1]);
            if (nextVal !== null) {
              specifiedDp = nextVal;
              i++;
              continue;
            }
          }
        } else if (part === 'tenor' || part === 'bulan' || part === 'bln') {
          if (i + 1 < parts.length) {
            const nextVal = parseInt(parts[i + 1], 10);
            if (!isNaN(nextVal) && nextVal >= 6 && nextVal <= 60) {
              specifiedTenor = nextVal;
              i++;
              continue;
            }
          }
        } else {
          const numVal = parseIndonesianNumber(part);
          if (numVal !== null) {
            if (numVal >= 500_000) {
              specifiedDp = numVal;
            } else if (numVal >= 6 && numVal <= 60) {
              specifiedTenor = numVal;
            }
          }
        }
      }
    } else {
      // 4. Otherwise, query motorcycle in catalog by keyword, SKU, or name
      const nameWords: string[] = [];

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (part === 'dp' || part === 'uang' || part === 'muka') {
          if (i + 1 < parts.length) {
            const nextVal = parseIndonesianNumber(parts[i + 1]);
            if (nextVal !== null) {
              specifiedDp = nextVal;
              i++;
              continue;
            }
          }
        } else if (part === 'tenor' || part === 'bulan' || part === 'bln') {
          if (i + 1 < parts.length) {
            const nextVal = parseInt(parts[i + 1], 10);
            if (!isNaN(nextVal) && nextVal >= 6 && nextVal <= 60) {
              specifiedTenor = nextVal;
              i++;
              continue;
            }
          }
        } else {
          const numVal = parseIndonesianNumber(part);
          if (numVal !== null) {
            if (numVal >= 500_000) {
              specifiedDp = numVal;
            } else if (numVal >= 6 && numVal <= 60) {
              specifiedTenor = numVal;
            }
          } else {
            nameWords.push(part);
          }
        }
      }

      const motorKeyword = nameWords.join(' ').trim();
      if (allMotors.length === 0) {
        return `Saat ini belum ada data motor aktif di katalog dealer kami. Ketik *SALES* untuk info unit dan pemesanan.`;
      }

      if (motorKeyword) {
        const foundIdx = allMotors.findIndex(
          (m) =>
            m.sku.toLowerCase() === motorKeyword ||
            m.name.toLowerCase().includes(motorKeyword) ||
            m.model.toLowerCase().includes(motorKeyword) ||
            motorKeyword.includes(m.name.toLowerCase()) ||
            motorKeyword.includes(m.sku.toLowerCase())
        );

        if (foundIdx !== -1) {
          matchedMotor = allMotors[foundIdx];
          matchedIndex = foundIdx + 1;
        } else {
          for (const w of nameWords) {
            if (w.length >= 3) {
              const fIdx = allMotors.findIndex(
                (m) =>
                  m.name.toLowerCase().includes(w) ||
                  m.model.toLowerCase().includes(w) ||
                  m.brand.name.toLowerCase().includes(w)
              );
              if (fIdx !== -1) {
                matchedMotor = allMotors[fIdx];
                matchedIndex = fIdx + 1;
                break;
              }
            }
          }
        }
      }
    }

    if (!matchedMotor) {
      let failMsg = `Motor dengan kata kunci "${cleaned}" tidak ditemukan di katalog kami.\n\n` +
        `🏍️ *Daftar Motor Yang Tersedia:*\n`;
      allMotors.slice(0, 6).forEach((m, idx) => {
        failMsg += `${idx + 1}. *${m.name}* (Ketik: *SIMULASI ${idx + 1}*)\n`;
      });
      failMsg += `\nAtau ketik *KATALOG* untuk melihat semua unit yang tersedia.`;
      return failMsg;
    }

    const otr = Number(matchedMotor.priceOtr);
    const minDp = matchedMotor.minDp ? Number(matchedMotor.minDp) : Math.round(otr * 0.1);
    const finalDp = specifiedDp !== null ? specifiedDp : minDp;

    if (finalDp >= otr) {
      return `⚠️ *Uang muka (DP) terlalu besar!*\nDP ${formatRupiah(finalDp)} tidak boleh melebihi atau sama dengan harga OTR ${formatRupiah(otr)}.`;
    }

    if (finalDp < minDp) {
      const idxHint = matchedIndex ? ` ${matchedIndex}` : '';
      return `⚠️ *DP Di Bawah Ketentuan Dealer*\n\n` +
        `Motor *${matchedMotor.name}* memiliki ketentuan DP Minimal sebesar *${formatRupiah(minDp)}*.\n` +
        `Silakan masukkan DP minimal ${formatRupiah(minDp)} atau lebih.\n\n` +
        `Contoh: *SIMULASI${idxHint} ${minDp}*`;
    }

    const availableTenors =
      matchedMotor.availableTenors && matchedMotor.availableTenors.length > 0
        ? matchedMotor.availableTenors
        : [11, 17, 23, 29, 35];

    let tenorsToRun = [...availableTenors];
    if (specifiedTenor && !tenorsToRun.includes(specifiedTenor)) {
      tenorsToRun.push(specifiedTenor);
      tenorsToRun.sort((a: number, b: number) => a - b);
    }

    const multi = await calculateMultiTenors(otr, finalDp, tenorsToRun);

    if (contact && matchedMotor) {
      try {
        const lead = await prisma.lead.findFirst({
          where: {
            contactId: contact.id,
            status: { in: ['BARU', 'DIHUBUNGI'] }
          },
          orderBy: { createdAt: 'desc' }
        });
        if (lead) {
          await prisma.lead.update({
            where: { id: lead.id },
            data: {
              motorcycleId: matchedMotor.id,
              dpPlanned: finalDp ? Number(finalDp) : undefined,
              tenorPlanned: specifiedTenor || undefined,
              notes: `Simulasi kredit: ${matchedMotor.name} (DP ${formatRupiah(finalDp)})`
            }
          });
        }
      } catch (e) {}
    }

    return formatMultiTenorText({
      motorName: matchedMotor.name,
      modelName: matchedMotor.model,
      motorIndex: matchedIndex,
      brandName: matchedMotor.brand?.name,
      hargaOtr: otr,
      dpAmount: finalDp,
      dpPercentage: multi.dpPercentage,
      options: multi.options
    });
  }

  public async sendMessage(toPhoneOrJid: string, content: string): Promise<WAMessage | null> {
    if (!this.client || this.status !== 'CONNECTED') {
      throw new Error('WhatsApp client belum terhubung. Silakan scan QR terlebih dahulu.');
    }

    let chatId = toPhoneOrJid.trim();
    if (chatId.includes('@newsletter')) {
      throw new Error('Tidak dapat mengirim pesan ke Saluran WhatsApp (Channel bersifat siaran satu arah).');
    }

    if (!chatId.includes('@')) {
      chatId = `${chatId}@c.us`;
    }

    return await this.client.sendMessage(chatId, content);
  }

  public async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.destroy();
      } catch (e) {
        // ignore
      }
      this.client = null;
    }
    this.status = 'DISCONNECTED';
    this.isInitializing = false;
    this.qrCodeDataUrl = null;
    await this.updateDbStatus('DISCONNECTED');
  }
}

export const waManager = new WhatsAppManager();

export async function sendWhatsAppTextMessage(phone: string, text: string) {
  return waManager.sendMessage(phone, text);
}
