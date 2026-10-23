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

export async function getSettings(_req: Request, res: Response, next: NextFunction) {
  try {
    const settings = await prisma.botSetting.findMany({
      orderBy: { key: 'asc' }
    });
    return res.json({ success: true, data: settings });
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
