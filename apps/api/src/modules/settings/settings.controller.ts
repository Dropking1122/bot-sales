import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/db';
import { logAudit } from '../../utils/audit';

export const DEFAULT_BRANDING = {
  web_title: 'DMS — Dealer Management System | REVDSTORE',
  web_brand_name: 'REVDSTORE',
  web_brand_sub: 'Dealer Retail Console',
  web_logo_url: '',
  web_favicon_url: '',
  web_meta_description: 'Platform Dealer Management System terpadu untuk penjualan motor, bot WhatsApp, dan analitik dealer.',
  web_meta_keywords: 'dealer motor, dms, sales motor, bot whatsapp, kredit motor, revdstore',
  web_footer_copyright: 'REVDSTORE'
};

export async function getPublicSettings(_req: Request, res: Response, next: NextFunction) {
  try {
    const keys = Object.keys(DEFAULT_BRANDING);
    const settings = await prisma.botSetting.findMany({
      where: { key: { in: keys } }
    });

    const result: Record<string, string> = { ...DEFAULT_BRANDING };
    for (const s of settings) {
      if (s.value !== undefined && s.value !== null) {
        result[s.key] = s.value;
      }
    }

    return res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// Never ship provider credentials back to the browser, even to admins.
const SECRET_SETTING_KEYS = new Set(['ai_api_key']);

export async function getSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const settings = await prisma.botSetting.findMany({
      orderBy: { key: 'asc' }
    });

    const data = settings.map((s) =>
      SECRET_SETTING_KEYS.has(s.key)
        ? { ...s, value: '', isSecret: true, hasValue: Boolean(s.value) }
        : s
    );

    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function uploadLogo(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Tidak ada file gambar yang diunggah' });
    }

    const publicUrl = `/storage/uploads/motorcycles/${req.file.filename}`;

    // Auto update web_logo_url setting
    await prisma.botSetting.upsert({
      where: { key: 'web_logo_url' },
      update: { value: publicUrl },
      create: { key: 'web_logo_url', value: publicUrl, description: 'URL Gambar Logo Kustom Web' }
    });

    await logAudit(req, 'UPLOAD_LOGO', 'BotSetting', null, { url: publicUrl });

    return res.json({
      success: true,
      message: 'Logo berhasil diunggah',
      data: { url: publicUrl }
    });
  } catch (err) {
    next(err);
  }
}

export async function updateSettings(req: Request, res: Response, next: NextFunction) {
  try {
    let settingList: Array<{ key: string; value: any; description?: string }> = [];

    // Safely support { settings: [...] }, { settings: { k: v } }, [...], or { k: v }
    const sourceData = req.body && req.body.settings !== undefined ? req.body.settings : req.body;

    if (Array.isArray(sourceData)) {
      settingList = sourceData;
    } else if (sourceData && typeof sourceData === 'object') {
      settingList = Object.entries(sourceData).map(([key, value]) => ({
        key,
        value: typeof value === 'object' ? JSON.stringify(value) : String(value ?? '')
      }));
    }

    // Filter out invalid keys or redundant wrapper key
    settingList = settingList.filter((s) => s.key && s.key !== 'settings');

    if (settingList.length === 0) {
      return res.status(400).json({ success: false, message: 'Data pengaturan tidak boleh kosong' });
    }

    for (const s of settingList) {
      // A blanked secret means "unchanged", not "erase the credential".
      if (SECRET_SETTING_KEYS.has(s.key) && !String(s.value ?? '').trim()) continue;
      await prisma.botSetting.upsert({
        where: { key: s.key },
        update: { value: String(s.value ?? '') },
        create: { key: s.key, value: String(s.value ?? ''), description: s.description || null }
      });
    }

    await logAudit(req, 'UPDATE_SETTINGS', 'BotSetting', null, { keys: settingList.map((s) => s.key) });

    const updated = await prisma.botSetting.findMany({ orderBy: { key: 'asc' } });
    return res.json({ success: true, message: 'Pengaturan berhasil diperbarui', data: updated });
  } catch (err) {
    next(err);
  }
}

// ─── Motor Categories (stored as JSON array in BotSetting) ───

const CATEGORIES_KEY = 'motor_categories';
const DEFAULT_CATEGORIES = ['Matic', 'Matic Maxi', 'Sport', 'Bebek', 'Trail', 'Naked', 'Touring', 'Adventure'];

async function getCategoriesArray(): Promise<string[]> {
  const row = await prisma.botSetting.findUnique({ where: { key: CATEGORIES_KEY } });
  if (!row) return DEFAULT_CATEGORIES;
  try { return JSON.parse(row.value); } catch { return DEFAULT_CATEGORIES; }
}

export async function getCategories(_req: Request, res: Response, next: NextFunction) {
  try {
    return res.json({ success: true, data: await getCategoriesArray() });
  } catch (err) { next(err); }
}

export async function addCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const name = String(req.body.name ?? '').trim();
    if (!name) return res.status(400).json({ success: false, message: 'Nama kategori wajib diisi' });

    const list = await getCategoriesArray();
    if (list.some(c => c.toLowerCase() === name.toLowerCase())) {
      return res.status(409).json({ success: false, message: 'Kategori sudah ada' });
    }

    list.push(name);
    await prisma.botSetting.upsert({
      where: { key: CATEGORIES_KEY },
      update: { value: JSON.stringify(list) },
      create: { key: CATEGORIES_KEY, value: JSON.stringify(list), description: 'Daftar kategori motor' }
    });
    await logAudit(req, 'ADD_CATEGORY', 'BotSetting', null, { name });
    return res.json({ success: true, data: list });
  } catch (err) { next(err); }
}

export async function deleteCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const name = String(req.params.name ?? '').trim();
    const list = (await getCategoriesArray()).filter(c => c !== name);
    await prisma.botSetting.upsert({
      where: { key: CATEGORIES_KEY },
      update: { value: JSON.stringify(list) },
      create: { key: CATEGORIES_KEY, value: JSON.stringify(list), description: 'Daftar kategori motor' }
    });
    await logAudit(req, 'DELETE_CATEGORY', 'BotSetting', null, { name });
    return res.json({ success: true, data: list });
  } catch (err) { next(err); }
}

export async function testAiEndpoint(req: Request, res: Response, next: NextFunction) {
  try {
    const { testAiAgent } = await import('../ai/ai.service');
    const result = await testAiAgent(req.body);
    return res.json(result);
  } catch (err) {
    next(err);
  }
}
