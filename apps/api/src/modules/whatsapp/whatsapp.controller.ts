import { Request, Response, NextFunction } from 'express';
import { AdminRole } from '@prisma/client';
import { waManager } from './whatsapp.service';
import { logAudit } from '../../utils/audit';

export async function getWhatsAppStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const data = waManager.getStatus();

    // The pairing QR is a session-takeover secret: any admin-only viewer gets it, SALES does not.
    // The UI only needs the status word for its badge, so strip the payload instead of a 403.
    const isAdmin = req.user?.role === AdminRole.SUPER_ADMIN || req.user?.role === AdminRole.ADMIN;
    if (!isAdmin) {
      return res.json({ success: true, data: { ...data, qrCode: null, qrImage: null } });
    }

    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function connectWhatsApp(req: Request, res: Response, next: NextFunction) {
  try {
    await waManager.initialize();
    await logAudit(req, 'CONNECT_WHATSAPP', 'WhatsAppSession', null);
    return res.json({ success: true, message: 'Inisialisasi koneksi WhatsApp dimulai' });
  } catch (err) {
    next(err);
  }
}

export async function disconnectWhatsApp(req: Request, res: Response, next: NextFunction) {
  try {
    await waManager.disconnect();
    await logAudit(req, 'DISCONNECT_WHATSAPP', 'WhatsAppSession', null);
    return res.json({ success: true, message: 'WhatsApp client diputuskan' });
  } catch (err) {
    next(err);
  }
}

export async function reconnectWhatsApp(req: Request, res: Response, next: NextFunction) {
  try {
    await waManager.disconnect();
    await waManager.initialize();
    await logAudit(req, 'RECONNECT_WHATSAPP', 'WhatsAppSession', null);
    return res.json({ success: true, message: 'Koneksi ulang WhatsApp dimulai' });
  } catch (err) {
    next(err);
  }
}
