import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/db';
import { config } from '../../config/env';
import { LoginSchema, AdminUserSchema } from '@bot-sales/shared';
import { AppError } from '../../middleware/errorHandler';
import { logAudit } from '../../utils/audit';

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const data = LoginSchema.parse(req.body);

    const admin = await prisma.admin.findUnique({
      where: { email: data.email }
    });

    if (!admin) {
      return res.status(401).json({ success: false, message: 'Email atau password salah' });
    }

    if (!admin.isActive) {
      return res.status(403).json({ success: false, message: 'Akun telah dinonaktifkan' });
    }

    const isMatch = await bcrypt.compare(data.password, admin.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Email atau password salah' });
    }

    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role },
      config.jwt.secret,
      { expiresIn: '7d' }
    );

    await logAudit(req, 'LOGIN', 'Admin', admin.id, { email: admin.email });

    return res.json({
      success: true,
      message: 'Login berhasil',
      data: {
        token,
        user: {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          role: admin.role
        }
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function passkeyLogin(req: Request, res: Response, next: NextFunction) {
  try {
    const { passkey } = req.body;
    const serverPasskey = process.env.ADMIN_PASSKEY;

    if (!serverPasskey) {
      return res.status(503).json({ success: false, message: 'Otentikasi passkey dinonaktifkan di server ini' });
    }

    if (!passkey || String(passkey).trim() !== serverPasskey.trim()) {
      return res.status(401).json({ success: false, message: 'Kunci otorisasi tidak valid' });
    }

    const admin = await prisma.admin.findFirst({
      where: { role: 'SUPER_ADMIN', isActive: true }
    });

    if (!admin) {
      return res.status(500).json({ success: false, message: 'Akun administrator belum terdaftar' });
    }

    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role },
      config.jwt.secret,
      { expiresIn: '7d' }
    );

    await logAudit(req, 'PASSKEY_AUTH', 'Admin', admin.id, { type: 'DIRECT_PASSKEY' });

    return res.json({
      success: true,
      message: 'Otorisasi konsol berhasil',
      data: {
        token,
        user: {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          role: admin.role
        }
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Tidak terautentikasi' });
    }

    const admin = await prisma.admin.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true
      }
    });

    if (!admin) {
      return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan' });
    }

    return res.json({ success: true, data: admin });
  } catch (err) {
    next(err);
  }
}

export async function changePassword(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Tidak terautentikasi' });
    }

    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword || newPassword.length < 6) {
      throw new AppError('Password baru minimal 6 karakter', 400);
    }

    const admin = await prisma.admin.findUnique({ where: { id: req.user.id } });
    if (!admin) {
      throw new AppError('Pengguna tidak ditemukan', 404);
    }

    const isMatch = await bcrypt.compare(oldPassword, admin.passwordHash);
    if (!isMatch) {
      throw new AppError('Password lama tidak cocok', 400);
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.admin.update({
      where: { id: admin.id },
      data: { passwordHash }
    });

    await logAudit(req, 'CHANGE_PASSWORD', 'Admin', admin.id);

    return res.json({ success: true, message: 'Password berhasil diubah' });
  } catch (err) {
    next(err);
  }
}

export async function listAdmins(req: Request, res: Response, next: NextFunction) {
  try {
    const admins = await prisma.admin.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json({ success: true, data: admins });
  } catch (err) {
    next(err);
  }
}

export async function createAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const data = AdminUserSchema.parse(req.body);
    if (!data.password) {
      throw new AppError('Password wajib diisi', 400);
    }

    const existing = await prisma.admin.findUnique({ where: { email: data.email } });
    if (existing) {
      throw new AppError('Email sudah terdaftar', 409);
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const newAdmin = await prisma.admin.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash,
        role: data.role,
        isActive: data.isActive
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true
      }
    });

    await logAudit(req, 'CREATE_ADMIN', 'Admin', newAdmin.id, { email: newAdmin.email, role: newAdmin.role });

    return res.status(201).json({ success: true, data: newAdmin });
  } catch (err) {
    next(err);
  }
}

export async function updateAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { name, role, isActive, password } = req.body;

    const existing = await prisma.admin.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Admin tidak ditemukan', 404);
    }

    const updateData: any = {};
    if (name) updateData.name = name;
    if (role) updateData.role = role;
    if (typeof isActive === 'boolean') updateData.isActive = isActive;
    if (password && password.length >= 6) {
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }

    const updated = await prisma.admin.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        updatedAt: true
      }
    });

    await logAudit(req, 'UPDATE_ADMIN', 'Admin', id, updateData);

    return res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}
