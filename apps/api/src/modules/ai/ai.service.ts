import { prisma } from '../../config/db';
import { logger } from '../../config/logger';

export interface AiAgentConfig {
  enabled: boolean;
  providerUrl: string;
  apiKey: string;
  model: string;
  assistantName: string;
  systemPrompt: string;
  customFaq: string;
  temperature: number;
  maxTokens: number;
}

const DEFAULT_SYSTEM_PROMPT = `Anda adalah {{ASSISTANT_NAME}}, konsultan sales resmi dealer motor Honda yang ramah, sopan, bersahabat, dan profesional.
Tugas Anda:
1. Membantu calon pembeli memilih sepeda motor Honda yang tepat sesuai kebutuhan, selera, dan anggaran mereka.
2. Memberikan informasi akurat mengenai harga OTR, uang muka (DP), pilihan warna, dan spesifikasi motor sesuai data resmi dealer di bawah ini.
3. ATURAN PANJANG PESAN & FORMAT WHATSAPP (SANGAT KETAT):
   - Balaslah secara SINGKAT, PADAT, dan EFEKTIF (maksimal 2 - 4 kalimat atau beberapa poin ringkas). Hindari teks panjang yang berbelit-belit atau seperti brosur/koran agar nyaman dan cepat dibaca di layar HP WhatsApp.
   - JANGAN menjabarkan seluruh 8 - 10 nama varian warna secara panjang lebar sekaligus kecuali pelanggan secara spesifik meminta "sebutkan semua warna". Cukup sebutkan ringkasan tipenya (contoh: "Tersedia tipe Smart Key dan CBS dengan 8 pilihan warna menarik. Kakak lebih suka warna doff elegan atau glossy?") lalu tawarkan untuk kirim fotonya.
   - Berikan 1 pertanyaan penutup yang jelas dan relevan, jangan menumpuk banyak pertanyaan.
4. ATURAN SAPAAN & KOMUNIKASI:
   - Jika pelanggan memberi salam Islami (misal: "Assalamualaikum", "Assalamu'alaikum", "Salam"), jawablah dengan salam yang santun ("Waalaikumsalam Kak...").
   - Jika obrolan BARU PERTAMA KALI dimulai atau pelanggan baru menyapa ("Halo", "P", "Pagi", "Siang", "Malam"), berikan sapaan ramah pembuka dan tanyakan apa yang bisa dibantu.
   - JIKA PERCAKAPAN SEDANG BERJALAN (ada obrolan sebelumnya atau pelanggan bertanya lanjutan/spesifik): DILARANG MENGULANG SAPAAN "Halo Kak..." di setiap balasan! LANGSUNG JAWAB INTI PERTANYAAN (to the point, ringkas, dan jelas) agar obrolan terasa alami seperti chat manusia sungguhan.
5. PENGIRIMAN FOTO & VARIAN WARNA:
   - Bila pelanggan meminta melihat foto unit atau varian warna tertentu (contoh: "bisa kirim fotonya?", "ada gambar Beat warna hitam?", "mau lihat foto Scoopy merah"), sertakan tag di baris paling atas balasan Anda:
     Format jika ada varian warna: [FOTO: nama motor | WARNA: nama warna] (contoh: [FOTO: All New Honda BeAT | WARNA: Hard Rock Black])
     Format umum: [FOTO: nama motor] (contoh: [FOTO: New Honda Scoopy])
     Sistem WhatsApp dealer akan otomatis mencocokkan dan melampirkan foto resmi motor/warna tersebut dari database.
6. Bila pelanggan menanyakan simulasi kredit terperinci, anjurkan mengetik format mudah "SIMULASI <nomor motor>" atau tawarkan bantuan untuk disambungkan langsung dengan tim sales kami (ketik "SALES").
7. Jangan mengarang harga atau promo yang tidak ada pada daftar katalog resmi dealer.`;

const DEFAULT_CUSTOM_FAQ = `[Syarat Berkas Kredit]
Q: Apa saja syarat pengajuan kredit motor Honda?
A: Cukup foto e-KTP Pemohon & Penjamin (Suami/Istri/Orang Tua), Kartu Keluarga (KK), dan bukti penghasilan/slip gaji. Berkas bisa dikirim via WA atau dijemput tim survei.

[Waktu Proses Kredit]
Q: Berapa lama proses approval/persetujuan kredit?
A: Proses survei leasing rekanan (FIF, Adira, OTO, MCF, BCA Finance) rata-rata 1x24 jam kerja setelah berkas lengkap.

[KTP Daerah / Luar Domisili]
Q: Apakah bisa beli motor dengan KTP luar daerah?
A: Bisa Kak! Kami melayani pembelian cash maupun kredit untuk KTP luar daerah selama berdomisili atau bekerja di area operasional dealer kami.

[STNK & BPKB]
Q: Berapa lama plat nomor, STNK, dan BPKB selesai?
A: Plat nomor dan STNK motor baru jadi sekitar 14 - 21 hari kerja. Untuk pembelian cash, BPKB jadi sekitar 2 - 3 bulan. Untuk kredit, BPKB tersimpan aman di kantor leasing hingga lunas.

[Garansi Resmi Honda]
Q: Bagaimana garansi motor baru Honda?
A: Seluruh motor baru bergaransi resmi Honda AHM: Garansi Rangka 5 tahun tanpa batas kilometer, Garansi Komponen Injeksi PGM-FI 5 tahun / 50.000 km, dan Garansi Mesin 3 tahun / 30.000 km.

[Tukar Tambah / Trade-in]
Q: Apakah bisa tukar tambah motor lama?
A: Bisa sekali Kak! Kami menerima tukar tambah motor lama segala merk untuk dijadikan uang muka (DP) motor baru Honda.

[Bonus & Servis Gratis]
Q: Pembelian motor baru dapat apa saja?
A: Mendapatkan helm standar Honda, jaket eksklusif, toolkit, dudukan plat, buku servis & garansi, serta kupon servis gratis (KPB) termasuk gratis oli mesin pada servis pertama.`;

export async function getAiConfig(): Promise<AiAgentConfig> {
  const settings = await prisma.botSetting.findMany({
    where: {
      key: {
        in: [
          'ai_agent_enabled',
          'ai_provider_url',
          'ai_api_key',
          'ai_model',
          'ai_assistant_name',
          'ai_system_prompt',
          'ai_custom_faq',
          'ai_temperature',
          'ai_max_tokens'
        ]
      }
    }
  });

  const map = new Map(settings.map((s) => [s.key, s.value]));

  // Credentials are read from the AI settings row or this service's own environment only.
  // ponytail: the '/root/.hermes/.env' scrape was removed — cross-application credential reads
  // have undefined ownership. Set OPENAI_API_KEY (or the ai_api_key setting) for this app instead.
  const fallbackKey = process.env.OPENAI_API_KEY || '';

  const enabled = map.get('ai_agent_enabled') === 'true';
  const providerUrl = (map.get('ai_provider_url') || 'http://127.0.0.1:20128/v1').replace(/\/+$/, '');
  const apiKey = map.get('ai_api_key') || fallbackKey;
  const model = map.get('ai_model') || 'antigravity';
  const assistantName = map.get('ai_assistant_name') || 'Vina';
  const rawSystemPrompt = map.get('ai_system_prompt') || DEFAULT_SYSTEM_PROMPT;
  const systemPrompt = rawSystemPrompt.replace(/\{\{ASSISTANT_NAME\}\}/g, assistantName);
  const customFaq = map.get('ai_custom_faq') || DEFAULT_CUSTOM_FAQ;
  const temperature = parseFloat(map.get('ai_temperature') || '0.7') || 0.7;
  const maxTokens = parseInt(map.get('ai_max_tokens') || '250', 10) || 250;

  return {
    enabled,
    providerUrl,
    apiKey,
    model,
    assistantName,
    systemPrompt,
    customFaq,
    temperature,
    maxTokens
  };
}

export async function askSalesAiAgent(
  userMessage: string,
  contact: { id?: string; name: string; phoneNormalized?: string; phone?: string; interestedMotorcycle?: string | null; internalNotes?: string | null },
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
    const [addr, hours, dealerPhone, activeLead] = await Promise.all([
      prisma.botSetting.findUnique({ where: { key: 'bot_dealer_address' } }),
      prisma.botSetting.findUnique({ where: { key: 'bot_operating_hours' } }),
      prisma.botSetting.findUnique({ where: { key: 'bot_dealer_phone' } }),
      contact.id
        ? prisma.lead.findFirst({
            where: { contactId: contact.id },
            orderBy: { createdAt: 'desc' }
          })
        : Promise.resolve(null)
    ]);

    // 3. Format riwayat pesan (Memori jangka pendek: 10 pesan terakhir)
    const formattedHistory = conversationHistory.slice(-10).map((m) => ({
      role: m.senderType === 'CUSTOMER' ? 'user' : 'assistant',
      content: m.content
    }));

    const isOngoing = formattedHistory.length > 0;
    const conversationStatus = isOngoing
      ? 'SEDANG BERJALAN (Percakapan Lanjutan) - DILARANG MENGULANG salam pembuka seperti "Halo Kak [Nama]". LANGSUNG JAWAB INTI PERTANYAAN secara to the point, bersahabat, dan jelas!'
      : 'BARU DIMULAI (Pesan Pertama) - Berikan salam yang sopan dan ramah.';

    const contextInstruction = `
--- STATUS KOMUNIKASI ---
Nama Anda (Sales): ${config.assistantName || 'Vina'}
Status Percakapan: ${conversationStatus}

--- DATA RESMI DEALER ---
Alamat: ${addr?.value || 'Showroom Resmi Honda'}
Jam Operasional: ${hours?.value || 'Senin - Sabtu 08:30 - 17:00 WIB'}
Kontak Showroom: ${dealerPhone?.value || '-'}

KATALOG UNIT TERSEDIA:
${motorContext}

--- PROFIL PELANGGAN (MEMORI JANGKA PANJANG) ---
Nama: ${contact.name || 'Pelanggan'}
Nomor HP/WA: ${contact.phoneNormalized || contact.phone || '-'}
Motor yang Pernah Diminati: ${contact.interestedMotorcycle || 'Belum spesifik'}
Status Prospek: ${activeLead?.status || 'BARU'}
Catatan Sales/Internal: ${contact.internalNotes || activeLead?.notes || 'Tidak ada catatan khusus'}

--- PANDUAN FAQ KHUSUS & KNOWLEDGE BASE DEALER ---
${config.customFaq}

--- PANDUAN GAYA & PANJANG PESAN WHATSAPP ---
- Tulis pesan yang SINGKAT, PADAT, dan RAMAH (maksimal 2 - 4 kalimat).
- JANGAN melisting banyak varian warna sekaligus jika tidak diminta. Cukup rangkum secara singkat dan tanyakan varian mana yang ingin dilihat fotonya.
- Gunakan bahasa percakapan yang santai layaknya sales dealer sungguhan di chat WhatsApp.
--------------------------------------------------`;

    const fullSystemPrompt = `${config.systemPrompt}\n\n${contextInstruction}`;

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
  assistantName?: string;
  systemPrompt?: string;
}): Promise<{ success: boolean; reply?: string; error?: string }> {
  try {
    const config = await getAiConfig();
    const providerUrl = (options?.providerUrl || config.providerUrl).replace(/\/+$/, '');
    const apiKey = options?.apiKey !== undefined ? options.apiKey : config.apiKey;
    const model = options?.model || config.model;
    const assistantName = options?.assistantName || config.assistantName || 'Vina';
    let systemPrompt = options?.systemPrompt || config.systemPrompt;
    systemPrompt = systemPrompt.replace(/\{\{ASSISTANT_NAME\}\}/g, assistantName);

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

