import { Client, LocalAuth, Message as WAMessage } from 'whatsapp-web.js';
import qrcode from 'qrcode';
import { config } from '../../config/env';
import { logger } from '../../config/logger';
import { prisma } from '../../config/db';
import { normalizePhoneNumber, formatRupiah, WhatsAppStatus } from '@bot-sales/shared';
import { calculateFinancing, formatSimulationText } from '../financing/financing.service';

class WhatsAppManager {
  private client: Client | null = null;
  private status: WhatsAppStatus = 'DISCONNECTED';
  private qrCodeDataUrl: string | null = null;
  private isInitializing = false;

  constructor() {
    // Session state
  }

  public getStatus(): { status: WhatsAppStatus; qrCode: string | null } {
    return {
      status: this.status,
      qrCode: this.qrCodeDataUrl
    };
  }

  public async initialize(): Promise<void> {
    if (this.isInitializing || this.status === 'CONNECTED') {
      return;
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

  public async handleIncomingMessage(msg: WAMessage): Promise<void> {
    // Ignore status broadcasts or group messages
    if (msg.from.includes('@g.us') || msg.from === 'status@broadcast') return;

    const rawPhone = msg.from.replace('@c.us', '');
    const normalizedPhone = normalizePhoneNumber(rawPhone);
    const body = (msg.body || '').trim();

    try {
      // 1. Get or create Contact
      let contact = await prisma.contact.findUnique({
        where: { phoneNormalized: normalizedPhone }
      });

      if (!contact) {
        contact = await prisma.contact.create({
          data: {
            name: msg.author || rawPhone,
            phone: rawPhone,
            phoneNormalized: normalizedPhone,
            source: 'WHATSAPP_BOT',
            consentStatus: 'GRANTED',
            consentSource: 'CHAT_INITIATED',
            consentAt: new Date()
          }
        });
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

      // 3. If bot is deactivated (Sales takeover), skip auto-reply
      if (!conversation.isBotActive || conversation.status === 'HANDOFF') {
        logger.info(`Message from ${normalizedPhone} skipped auto-reply (Sales takeover active)`);
        return;
      }

      // 4. Determine Bot Intent & Reply
      const replyText = await this.resolveBotResponse(body, contact);

      if (replyText) {
        // Send reply via WA
        await msg.reply(replyText);

        // Store bot message in DB
        await prisma.message.create({
          data: {
            conversationId: conversation.id,
            senderType: 'BOT',
            content: replyText,
            status: 'SENT'
          }
        });
      }
    } catch (error) {
      logger.error({ error, rawPhone, body }, 'Error handling incoming WA message');
    }
  }

  private async resolveBotResponse(text: string, contact: any): Promise<string> {
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

      // Also create a lead
      await prisma.lead.create({
        data: {
          contactId: contact.id,
          customerName: contact.name,
          phone: contact.phoneNormalized,
          status: 'BARU',
          notes: 'Permintaan pengalihan langsung ke tim sales melalui WhatsApp Bot'
        }
      });

      return 'Baik, percakapan ini sedang dialihkan ke tim sales kami. Sales konsultan kami akan segera menghubungi Anda langsung. Mohon ditunggu ya! 🙏';
    }

    // 3. Catalog request
    if (lower === 'katalog' || lower === 'motor' || lower === 'daftar motor' || lower.includes('pilihan')) {
      const motors = await prisma.motorcycle.findMany({
        where: { isActive: true },
        include: { brand: true },
        take: 8,
        orderBy: { priceOtr: 'asc' }
      });

      if (motors.length === 0) {
        return 'Saat ini belum ada data motor aktif di katalog. Hubungi sales kami untuk info unit ready.';
      }

      let res = `🏍️ *KATALOG MOTOR DEALER RESMI*\n\n`;
      motors.forEach((m, idx) => {
        const otr = Number(m.priceOtr);
        const minDp = m.minDp ? Number(m.minDp) : otr * 0.1;
        res += `${idx + 1}. *${m.name}* (${m.brand.name})\n`;
        res += `   • OTR: ${formatRupiah(otr)}\n`;
        res += `   • DP Mulai: ${formatRupiah(minDp)}\n`;
        res += `   • Ketik: *INFO ${m.sku}*\n\n`;
      });
      res += `Ketik *INFO <SKU>* untuk detail spesifikasi & simulasi kredit.`;
      return res;
    }

    // 4. Detail request: "INFO <SKU>" or "DETAIL <SKU>"
    if (lower.startsWith('info ') || lower.startsWith('detail ')) {
      const query = lower.replace(/^(info|detail)\s+/, '').trim();
      const motor = await prisma.motorcycle.findFirst({
        where: {
          OR: [
            { sku: { equals: query, mode: 'insensitive' } },
            { name: { contains: query, mode: 'insensitive' } }
          ],
          isActive: true
        },
        include: { brand: true }
      });

      if (!motor) {
        return `Motor dengan kata kunci "${query}" tidak ditemukan di katalog kami. Ketik *KATALOG* untuk melihat daftar motor yang tersedia.`;
      }

      const otr = Number(motor.priceOtr);
      const minDp = motor.minDp ? Number(motor.minDp) : otr * 0.1;

      const sim = await calculateFinancing({
        hargaOtr: otr,
        dpAmount: minDp,
        tenorMonths: 35
      });

      return `🏍️ *${motor.name.toUpperCase()}*\n` +
        `Merek: ${motor.brand.name} | Tahun: ${motor.year} | ${motor.condition}\n\n` +
        `💵 *Harga OTR:* ${formatRupiah(otr)}\n` +
        `💳 *DP Mulai:* ${formatRupiah(minDp)}\n` +
        `📊 *Estimasi Cicilan (35 bln):* ${formatRupiah(sim.monthlyInstallment)}/bln\n\n` +
        `📝 *Deskripsi:*\n${motor.description || '-'}\n\n` +
        `Ketik *SALES* untuk terhubung langsung dengan konsultan kami untuk pemesanan!`;
    }

    // 5. Simulation inquiry: "SIMULASI"
    if (lower.startsWith('simulasi') || lower.startsWith('kredit')) {
      return `📊 *SIMULASI KREDIT MOTOR*\n\n` +
        `Untuk simulasi kredit otomatis, ketik:\n` +
        `*SIMULASI <HARGA_OTR> <DP> <TENOR_BULAN>*\n\n` +
        `_Contoh:_\n` +
        `*SIMULASI 27500000 3000000 35*\n\n` +
        `Atau ketik *SALES* untuk dibantu hitungkan oleh sales kami.`;
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

  public async sendMessage(toPhone: string, content: string): Promise<WAMessage | null> {
    if (!this.client || this.status !== 'CONNECTED') {
      throw new Error('WhatsApp client belum terhubung. Silakan scan QR terlebih dahulu.');
    }

    const chatId = `${toPhone}@c.us`;
    return await this.client.sendMessage(chatId, content);
  }

  public async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.destroy();
      this.client = null;
    }
    this.status = 'DISCONNECTED';
    this.qrCodeDataUrl = null;
    await this.updateDbStatus('DISCONNECTED');
  }
}

export const waManager = new WhatsAppManager();

export async function sendWhatsAppTextMessage(phone: string, text: string) {
  return waManager.sendMessage(phone, text);
}
