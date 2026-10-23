import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/db';
import { BrandSchema } from '@bot-sales/shared';
import { AppError } from '../../middleware/errorHandler';
import { logAudit } from '../../utils/audit';

export async function listBrands(req: Request, res: Response, next: NextFunction) {
  try {
    const brands = await prisma.brand.findMany({
      include: {
        _count: {
          select: { motorcycles: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    return res.json({ success: true, data: brands });
  } catch (err) {
    next(err);
  }
}

export async function createBrand(req: Request, res: Response, next: NextFunction) {
  try {
    const data = BrandSchema.parse(req.body);

    const existing = await prisma.brand.findUnique({ where: { name: data.name } });
    if (existing) {
      throw new AppError('Nama brand sudah ada', 409);
    }

    const brand = await prisma.brand.create({ data });
    await logAudit(req, 'CREATE_BRAND', 'Brand', brand.id, { name: brand.name });

    return res.status(201).json({ success: true, data: brand });
  } catch (err) {
    next(err);
  }
}

export async function updateBrand(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const data = BrandSchema.partial().parse(req.body);

    const existing = await prisma.brand.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Brand tidak ditemukan', 404);
    }

    const brand = await prisma.brand.update({
      where: { id },
      data
    });

    await logAudit(req, 'UPDATE_BRAND', 'Brand', id, data);

    return res.json({ success: true, data: brand });
  } catch (err) {
    next(err);
  }
}

export async function deleteBrand(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const count = await prisma.motorcycle.count({ where: { brandId: id } });
    if (count > 0) {
      throw new AppError(`Tidak dapat menghapus brand karena terdapat ${count} motor yang terhubung. Nonaktifkan saja brand ini.`, 400);
    }

    await prisma.brand.delete({ where: { id } });
    await logAudit(req, 'DELETE_BRAND', 'Brand', id);

    return res.json({ success: true, message: 'Brand berhasil dihapus' });
  } catch (err) {
    next(err);
  }
}
