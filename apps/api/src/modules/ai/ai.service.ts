import fs from 'fs';
import path from 'path';
import { prisma } from '../../config/db';
import { logger } from '../../config/logger';

export interface AiAgentConfig {
  enabled: boolean;
  providerUrl: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
}

const DEFAULT_SYSTEM_PROMPT = `Anda adalah Vina, konsultan sales resmi dealer motor Honda yang ramah, sopan, bersahabat, dan profesional.
Tugas Anda:
1. Membantu calon pembeli memilih sepeda motor Honda yang tepat sesuai kebutuhan, selera, dan anggaran mereka.
2. Memberikan informasi akurat mengenai harga OTR, uang muka (DP), dan spesifikasi motor sesuai data resmi dealer di bawah ini.
3. Menjelaskan keunggulan motor (irit bahan bakar, bagasi luas, fitur smart key, CBS/ABS, dll.) secara ringkas dan meyakinkan.
4. Gaya komunikasi: Santun, ramah Indonesia (gunakan sapaan "Kak" atau sebut nama customer), singkat, padat (maksimal 2-3 paragraf pendek agar nyaman dibaca di WhatsApp), dan komunikatif.
5. Bila pelanggan menanyakan simulasi kredit terperinci, anjurkan mengetik format mudah "SIMULASI <nomor motor>" atau tawarkan bantuan untuk disambungkan langsung dengan tim sales kami (ketik "SALES").
6. Jangan mengarang harga atau promo yang tidak ada pada daftar katalog resmi dealer.`;

export async function getAiConfig(): Promise<AiAgentConfig> {
  const settings = await prisma.botSetting.findMany({
    where: {
      key: {
        in: [
          'ai_agent_enabled',
          'ai_provider_url',
          'ai_api_key',
          'ai_model',
          'ai_system_prompt',
          'ai_temperature',
          'ai_max_tokens'
        ]
      }
    }
  });

  const map = new Map(settings.map((s) => [s.key, s.value]));

  let fallbackKey = process.env.OPENAI_API_KEY || '';
  if (!fallbackKey) {
    try {
      const hermesEnvPath = '/root/.hermes/.env';
      if (fs.existsSync(hermesEnvPath)) {
        const raw = fs.readFileSync(hermesEnvPath, 'utf8');
        const match = raw.match(/OPENAI_API_KEY=([^\r\n]+)/);
        if (match && match[1]) fallbackKey = match[1].trim();
      }
    } catch {}
  }

  const enabled = map.get('ai_agent_enabled') === 'true';
  const providerUrl = (map.get('ai_provider_url') || 'http://127.0.0.1:20128/v1').replace(/\/+$/, '');
  const apiKey = map.get('ai_api_key') || fallbackKey;
  const model = map.get('ai_model') || 'antigravity';
  const systemPrompt = map.get('ai_system_prompt') || DEFAULT_SYSTEM_PROMPT;
  const temperature = parseFloat(map.get('ai_temperature') || '0.7') || 0.7;
  const maxTokens = parseInt(map.get('ai_max_tokens') || '400', 10) || 400;

  return {
    enabled,
    providerUrl,
    apiKey,
    model,
    systemPrompt,
    temperature,
    maxTokens
  };
}

export async function askSalesAiAgent(
  userMessage: string,
  contact: { name: string; phoneNormalized?: string; interestedMotorcycle?: string | null },
  conversationHistory: { senderType: string; content: string }[] = []
): Promise<string | null> {
  const config = await getAiConfig();

  if (!config.enabled) {
    return null;
  }

  if (!config.apiKey && !config.providerUrl.includes('localhost') && !config.providerUrl.includes('127.0.0.1')) {
    logger.warn('AI Agent enabled but API key is missing');
    return null;
  }

  try {
    // 1. Ambil data motor aktif untuk context
    const motors = await prisma.motorcycle.findMany({
      where: { isActive: true },
      include: { brand: true },
      orderBy: { priceOtr: 'asc' }
    });

    const motorContext = motors
      .map((m, idx) => {
        const otr = Number(m.priceOtr).toLocaleString('id-ID');
        const minDp = m.minDp ? Number(m.minDp).toLocaleString('id-ID') : '10%';
        const colorStr = m.colors?.length ? ` | Pilihan Warna: ${m.colors.join(', ')}` : '';
        const descStr = m.description ? ` | Info: ${m.description}` : '';
        return `${idx + 1}. ${m.name} (${m.category}, Model: ${m.model}) - OTR: Rp${otr}, Min DP: Rp${minDp}${colorStr}${descStr}`;
      })
      .join('\n');

    // 2. Ambil info dealer
    const [addr, hours, dealerPhone] = await Promise.all([
      prisma.botSetting.findUnique({ where: { key: 'bot_dealer_address' } }),
      prisma.botSetting.findUnique({ where: { key: 'bot_operating_hours' } }),
      prisma.botSetting.findUnique({ where: { key: 'bot_dealer_phone' } })
    ]);

    const contextInstruction = `
--- DATA RESMI DEALER ---
Alamat: ${addr?.value || 'Showroom Resmi Honda'}
Jam Operasional: ${hours?.value || 'Senin - Sabtu 08:30 - 17:00 WIB'}
Kontak Showroom: ${dealerPhone?.value || '-'}

KATALOG UNIT TERSEDIA:
${motorContext}

DATA PELANGGAN:
Nama: ${contact.name || 'Pelanggan'}
Minat Sebelumnya: ${contact.interestedMotorcycle || 'Belum spesifik'}
-------------------------`;

    const fullSystemPrompt = `${config.systemPrompt}\n\n${contextInstruction}`;

    // 3. Format riwayat pesan (ambil maksimal 6 pesan terakhir)
    const formattedHistory = conversationHistory.slice(-6).map((m) => ({
      role: m.senderType === 'CUSTOMER' ? 'user' : 'assistant',
      content: m.content
    }));

    const messages = [
      { role: 'system', content: fullSystemPrompt },
      ...formattedHistory,
      { role: 'user', content: userMessage }
    ];

    const endpoint = `${config.providerUrl}/chat/completions`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        stream: false
      }),
      signal: AbortSignal.timeout(45000)
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      logger.error({ status: res.status, errBody }, 'AI Agent upstream API returned error');
      return null;
    }

    const data: any = await res.json();
    let reply = data.choices?.[0]?.message?.content?.trim();

    if (!reply && data.choices?.[0]?.delta?.content) {
      reply = data.choices[0].delta.content.trim();
    }

    if (!reply) {
      logger.warn({ data }, 'AI Agent returned empty content');
      return null;
    }

    return reply;
  } catch (err: any) {
    logger.error({ err: err?.message || err }, 'Failed to invoke AI Agent for WhatsApp message');
    return null;
  }
}

export async function testAiAgent(options?: {
  providerUrl?: string;
  apiKey?: string;
  model?: string;
  systemPrompt?: string;
}): Promise<{ success: boolean; reply?: string; error?: string }> {
  try {
    const config = await getAiConfig();
    const providerUrl = (options?.providerUrl || config.providerUrl).replace(/\/+$/, '');
    const apiKey = options?.apiKey !== undefined ? options.apiKey : config.apiKey;
    const model = options?.model || config.model;
    const systemPrompt = options?.systemPrompt || config.systemPrompt;

    const endpoint = `${providerUrl}/chat/completions`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Halo! Kenalkan dirimu secara singkat sebagai sales dealer motor Honda.' }
        ],
        temperature: 0.7,
        max_tokens: 150,
        stream: false
      }),
      signal: AbortSignal.timeout(45000)
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { success: false, error: `Upstream error (${res.status}): ${errText}` };
    }

    const data: any = await res.json();
    const reply = data.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      return { success: false, error: 'Respons diterima tetapi teks kosong' };
    }

    return { success: true, reply };
  } catch (err: any) {
    return { success: false, error: err.message || 'Gagal menghubungi server AI' };
  }
}

export { testAiAgent as testAiAgentConnection };

