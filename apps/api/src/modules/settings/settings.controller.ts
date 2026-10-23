import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/db';
import { logAudit } from '../../utils/audit';

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

export async function updateSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const { settings } = req.body; // array of { key, value }

    if (!Array.isArray(settings)) {
      return res.status(400).json({ success: false, message: 'settings harus berupa array { key, value }' });
    }

    for (const s of settings) {
      if (s.key) {
        await prisma.botSetting.upsert({
          where: { key: s.key },
          update: { value: String(s.value) },
          create: { key: s.key, value: String(s.value), description: s.description || null }
        });
      }
    }

    await logAudit(req, 'UPDATE_SETTINGS', 'BotSetting', null, { keys: settings.map((s) => s.key) });

    const updated = await prisma.botSetting.findMany({ orderBy: { key: 'asc' } });
    return res.json({ success: true, message: 'Pengaturan berhasil diperbarui', data: updated });
  } catch (err) {
    next(err);
  }
}
