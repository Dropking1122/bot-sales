import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/db';
import { MotorcycleSchema, DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from '@bot-sales/shared';
import { AppError } from '../../middleware/errorHandler';
import { logAudit } from '../../utils/audit';
import fs from 'fs';
import path from 'path';

export async function listMotorcycles(req: Request, res: Response, next: NextFunction) {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(MAX_PAGE_LIMIT, Math.max(1, parseInt(req.query.limit as string, 10) || DEFAULT_PAGE_LIMIT));
    const skip = (page - 1) * limit;

    const {
      search,
      brandId,
      category,
      condition,
      stockStatus,
      isActive,
      minPrice,
      maxPrice,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: String(search), mode: 'insensitive' } },
        { sku: { contains: String(search), mode: 'insensitive' } },
        { model: { contains: String(search), mode: 'insensitive' } }
      ];
    }

    if (brandId) where.brandId = String(brandId);
    if (category) where.category = { equals: String(category), mode: 'insensitive' };
    if (condition) where.condition = String(condition);
    if (stockStatus) where.stockStatus = String(stockStatus);
    if (isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true';
    }

    if (minPrice || maxPrice) {
      where.priceOtr = {};
      if (minPrice) where.priceOtr.gte = parseFloat(String(minPrice));
      if (maxPrice) where.priceOtr.lte = parseFloat(String(maxPrice));
    }

    const validSortColumns = ['name', 'priceOtr', 'stock', 'createdAt', 'updatedAt', 'sku'];
    const safeSortBy = validSortColumns.includes(String(sortBy)) ? String(sortBy) : 'name';

    const [total, motorcycles] = await Promise.all([
      prisma.motorcycle.count({ where }),
      prisma.motorcycle.findMany({
        where,
        skip,
        take: limit,
        include: {
          brand: { select: { id: true, name: true } },
          images: {
            orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
            take: 1
          }
        },
        orderBy: { [safeSortBy]: sortOrder === 'asc' ? 'asc' : 'desc' }
      })
    ]);

    return res.json({
      success: true,
      data: motorcycles,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function getMotorcycleById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const motorcycle = await prisma.motorcycle.findUnique({
      where: { id },
      include: {
        brand: true,
        images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] },
        financingPlans: { where: { isActive: true } }
      }
    });

    if (!motorcycle) {
      throw new AppError('Motor tidak ditemukan', 404);
    }

    return res.json({ success: true, data: motorcycle });
  } catch (err) {
    next(err);
  }
}

export async function createMotorcycle(req: Request, res: Response, next: NextFunction) {
  try {
    const data = MotorcycleSchema.parse(req.body);

    const existingSku = await prisma.motorcycle.findUnique({ where: { sku: data.sku } });
    if (existingSku) {
      throw new AppError(`SKU "${data.sku}" sudah digunakan oleh motor lain`, 409);
    }

    const motorcycle = await prisma.motorcycle.create({
      data: {
        sku: data.sku,
        name: data.name,
        brandId: data.brandId,
        model: data.model,
        year: data.year,
        category: data.category,
        condition: data.condition,
        priceOtr: data.priceOtr,
        description: data.description,
        specs: data.specs || {},
        colors: data.colors,
        stockStatus: data.stockStatus,
        isActive: data.isActive,
        minDp: data.minDp || null,
        availableTenors: data.availableTenors
      },
      include: { brand: true }
    });

    await logAudit(req, 'CREATE_MOTORCYCLE', 'Motorcycle', motorcycle.id, { sku: motorcycle.sku, name: motorcycle.name });

    return res.status(201).json({ success: true, data: motorcycle });
  } catch (err) {
    next(err);
  }
}

export async function updateMotorcycle(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const data = MotorcycleSchema.partial().parse(req.body);

    const existing = await prisma.motorcycle.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Motor tidak ditemukan', 404);
    }

    if (data.sku && data.sku !== existing.sku) {
      const skuConflict = await prisma.motorcycle.findUnique({ where: { sku: data.sku } });
      if (skuConflict) {
        throw new AppError(`SKU "${data.sku}" sudah digunakan`, 409);
      }
    }

    const updated = await prisma.motorcycle.update({
      where: { id },
      data: {
        ...data,
        priceOtr: data.priceOtr !== undefined ? data.priceOtr : undefined,
        minDp: data.minDp !== undefined ? data.minDp : undefined,
        specs: data.specs !== undefined ? (data.specs || {}) : undefined
      },
      include: { brand: true, images: true }
    });

    await logAudit(req, 'UPDATE_MOTORCYCLE', 'Motorcycle', id, data);

    return res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

export async function deleteMotorcycle(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const existing = await prisma.motorcycle.findUnique({
      where: { id },
      include: { leads: { select: { id: true }, take: 1 } }
    });

    if (!existing) {
      throw new AppError('Motor tidak ditemukan', 404);
    }

    // If motorcycle has leads or relations, do soft deactivate
    if (existing.leads.length > 0) {
      await prisma.motorcycle.update({
        where: { id },
        data: { isActive: false }
      });
      await logAudit(req, 'DEACTIVATE_MOTORCYCLE', 'Motorcycle', id, { reason: 'Soft delete due to existing leads' });
      return res.json({ success: true, message: 'Motor memiliki riwayat prospek/leads, status diubah menjadi nonaktif.' });
    }

    await prisma.motorcycle.delete({ where: { id } });
    await logAudit(req, 'DELETE_MOTORCYCLE', 'Motorcycle', id);

    return res.json({ success: true, message: 'Motor berhasil dihapus' });
  } catch (err) {
    next(err);
  }
}

export async function uploadMotorcycleImages(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      throw new AppError('Tidak ada file gambar yang diunggah', 400);
    }

    const motorcycle = await prisma.motorcycle.findUnique({
      where: { id },
      include: { images: true }
    });

    if (!motorcycle) {
      throw new AppError('Motor tidak ditemukan', 404);
    }

    const replace = req.query.replace === 'true' || req.body?.replace === 'true';
    const hasPrimary = motorcycle.images.some((img) => img.isPrimary);

    if (replace) {
      await prisma.motorcycleImage.updateMany({
        where: { motorcycleId: id },
        data: { isPrimary: false }
      });
    }

    const createdImages = await Promise.all(
      files.map(async (file, index) => {
        const url = `/storage/uploads/motorcycles/${file.filename}`;
        const isPrimary = replace ? index === 0 : (!hasPrimary && index === 0);

        return prisma.motorcycleImage.create({
          data: {
            motorcycleId: id,
            url,
            isPrimary,
            sortOrder: replace ? index : (motorcycle.images.length + index)
          }
        });
      })
    );

    await logAudit(req, 'UPLOAD_MOTORCYCLE_IMAGES', 'Motorcycle', id, { count: files.length });

    return res.status(201).json({ success: true, data: createdImages });
  } catch (err) {
    next(err);
  }
}

export async function deleteMotorcycleImage(req: Request, res: Response, next: NextFunction) {
  try {
    const { id, imageId } = req.params;

    const image = await prisma.motorcycleImage.findFirst({
      where: { id: imageId, motorcycleId: id }
    });

    if (!image) {
      throw new AppError('Gambar tidak ditemukan', 404);
    }

    // Try to remove file from disk
    const filename = path.basename(image.url);
    const filePath = path.join(process.cwd(), '../../storage/uploads/motorcycles', filename);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (e) {
        // file unlink error can be ignored safely
      }
    }

    await prisma.motorcycleImage.delete({ where: { id: imageId } });

    // If deleted image was primary, set next image as primary if exists
    if (image.isPrimary) {
      const nextImg = await prisma.motorcycleImage.findFirst({
        where: { motorcycleId: id },
        orderBy: { sortOrder: 'asc' }
      });
      if (nextImg) {
        await prisma.motorcycleImage.update({
          where: { id: nextImg.id },
          data: { isPrimary: true }
        });
      }
    }

    await logAudit(req, 'DELETE_MOTORCYCLE_IMAGE', 'MotorcycleImage', imageId);

    return res.json({ success: true, message: 'Gambar berhasil dihapus' });
  } catch (err) {
    next(err);
  }
}

export async function setPrimaryImage(req: Request, res: Response, next: NextFunction) {
  try {
    const { id, imageId } = req.params;

    await prisma.$transaction([
      prisma.motorcycleImage.updateMany({
        where: { motorcycleId: id },
        data: { isPrimary: false }
      }),
      prisma.motorcycleImage.update({
        where: { id: imageId },
        data: { isPrimary: true }
      })
    ]);

    return res.json({ success: true, message: 'Foto utama berhasil diperbarui' });
  } catch (err) {
    next(err);
  }
}
