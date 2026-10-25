import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/db';
import {
  ContactSchema,
  normalizePhoneNumber,
  isValidPhoneNumber,
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT
} from '@bot-sales/shared';
import { AppError } from '../../middleware/errorHandler';
import { logAudit } from '../../utils/audit';

export async function listContacts(req: Request, res: Response, next: NextFunction) {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(MAX_PAGE_LIMIT, Math.max(1, parseInt(req.query.limit as string, 10) || DEFAULT_PAGE_LIMIT));
    const skip = (page - 1) * limit;

    const {
      search,
      tag,
      source,
      consentStatus,
      isOptOut,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: String(search), mode: 'insensitive' } },
        { phoneNormalized: { contains: String(search) } },
        { phone: { contains: String(search) } },
        { email: { contains: String(search), mode: 'insensitive' } }
      ];
    }

    if (tag) {
      where.contactTags = {
        some: {
          tag: { name: { equals: String(tag), mode: 'insensitive' } }
        }
      };
    }

    if (source) where.source = String(source);
    if (consentStatus) where.consentStatus = String(consentStatus);
    if (isOptOut !== undefined && isOptOut !== '') {
      where.isOptOut = isOptOut === 'true';
    }

    const validSortColumns = ['createdAt', 'updatedAt', 'name', 'phoneNormalized', 'source'];
    const safeSortBy = validSortColumns.includes(String(sortBy)) ? String(sortBy) : 'createdAt';

    const [total, contacts] = await Promise.all([
      prisma.contact.count({ where }),
      prisma.contact.findMany({
        where,
        skip,
        take: limit,
        include: {
          contactTags: { include: { tag: true } }
        },
        orderBy: { [safeSortBy]: sortOrder === 'asc' ? 'asc' : 'desc' }
      })
    ]);

    const formatted = contacts.map((c) => ({
      ...c,
      tags: c.contactTags.map((ct) => ct.tag)
    }));

    return res.json({
      success: true,
      data: formatted,
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

export async function getContactById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const contact = await prisma.contact.findUnique({
      where: { id },
      include: {
        contactTags: { include: { tag: true } },
        leads: { include: { motorcycle: true, assignedSales: true }, orderBy: { createdAt: 'desc' } },
        conversations: {
          include: { messages: { take: 5, orderBy: { createdAt: 'desc' } } },
          orderBy: { lastMessageAt: 'desc' }
        }
      }
    });

    if (!contact) {
      throw new AppError('Kontak tidak ditemukan', 404);
    }

    return res.json({
      success: true,
      data: {
        ...contact,
        tags: contact.contactTags.map((ct) => ct.tag)
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function createContact(req: Request, res: Response, next: NextFunction) {
  try {
    const data = ContactSchema.parse(req.body);
    const normalized = normalizePhoneNumber(data.phone);

    if (!isValidPhoneNumber(normalized)) {
      throw new AppError('Nomor telepon tidak valid untuk WhatsApp', 400);
    }

    const existing = await prisma.contact.findUnique({
      where: { phoneNormalized: normalized }
    });

    if (existing) {
      throw new AppError(`Kontak dengan nomor ini sudah ada (${existing.name})`, 409);
    }

    const contact = await prisma.$transaction(async (tx) => {
      const created = await tx.contact.create({
        data: {
          name: data.name,
          phone: data.phone,
          phoneNormalized: normalized,
          email: data.email || null,
          source: data.source,
          interestedMotorcycle: data.interestedMotorcycle || null,
          internalNotes: data.internalNotes || null,
          consentStatus: data.consentStatus,
          consentSource: data.consentSource || 'MANUAL',
          consentAt: data.consentStatus === 'GRANTED' ? (data.consentAt || new Date()) : null,
          isOptOut: data.isOptOut
        }
      });

      if (data.tags && data.tags.length > 0) {
        for (const tagName of data.tags) {
          const tag = await tx.tag.upsert({
            where: { name: tagName.trim() },
            update: {},
            create: { name: tagName.trim() }
          });

          await tx.contactTag.create({
            data: { contactId: created.id, tagId: tag.id }
          });
        }
      }

      return created;
    });

    await logAudit(req, 'CREATE_CONTACT', 'Contact', contact.id, { name: contact.name, phone: contact.phoneNormalized });

    return res.status(201).json({ success: true, data: contact });
  } catch (err) {
    next(err);
  }
}

export async function updateContact(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const data = ContactSchema.partial().parse(req.body);

    const existing = await prisma.contact.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Kontak tidak ditemukan', 404);
    }

    let phoneNormalized = existing.phoneNormalized;
    if (data.phone) {
      phoneNormalized = normalizePhoneNumber(data.phone);
      if (!isValidPhoneNumber(phoneNormalized)) {
        throw new AppError('Format nomor telepon tidak valid', 400);
      }
      if (phoneNormalized !== existing.phoneNormalized) {
        const conflict = await prisma.contact.findUnique({ where: { phoneNormalized } });
        if (conflict) {
          throw new AppError('Nomor telepon sudah terdaftar pada kontak lain', 409);
        }
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const c = await tx.contact.update({
        where: { id },
        data: {
          name: data.name,
          phone: data.phone,
          phoneNormalized,
          email: data.email !== undefined ? data.email : undefined,
          source: data.source,
          interestedMotorcycle: data.interestedMotorcycle,
          internalNotes: data.internalNotes,
          consentStatus: data.consentStatus,
          consentSource: data.consentSource,
          consentAt: data.consentStatus === 'GRANTED' ? (data.consentAt || new Date()) : undefined,
          isOptOut: data.isOptOut
        }
      });

      if (data.tags !== undefined) {
        await tx.contactTag.deleteMany({ where: { contactId: id } });
        for (const tagName of data.tags) {
          const tag = await tx.tag.upsert({
            where: { name: tagName.trim() },
            update: {},
            create: { name: tagName.trim() }
          });
          await tx.contactTag.create({
            data: { contactId: id, tagId: tag.id }
          });
        }
      }

      return c;
    });

    await logAudit(req, 'UPDATE_CONTACT', 'Contact', id, data);

    return res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

export async function deleteContact(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const existing = await prisma.contact.findUnique({
      where: { id },
      include: { conversations: true }
    });

    if (!existing) {
      throw new AppError('Kontak tidak ditemukan', 404);
    }

    // Do not delete conversation history - soft opt-out / archive contact instead if conversations exist
    if (existing.conversations.length > 0) {
      await prisma.contact.update({
        where: { id },
        data: { isOptOut: true, internalNotes: (existing.internalNotes || '') + '\n[ARCHIVED]' }
      });
      await logAudit(req, 'ARCHIVE_CONTACT', 'Contact', id);
      return res.json({ success: true, message: 'Kontak memiliki riwayat chat, kontak diarsipkan dan status opt-out diaktifkan.' });
    }

    await prisma.contact.delete({ where: { id } });
    await logAudit(req, 'DELETE_CONTACT', 'Contact', id);

    return res.json({ success: true, message: 'Kontak berhasil dihapus' });
  } catch (err) {
    next(err);
  }
}

export async function bulkAddTags(req: Request, res: Response, next: NextFunction) {
  try {
    const { contactIds, tags } = req.body;
    if (!Array.isArray(contactIds) || !Array.isArray(tags) || tags.length === 0) {
      throw new AppError('contactIds dan tags harus berupa array dan tidak boleh kosong', 400);
    }

    const createdTags = await Promise.all(
      tags.map((tagName: string) =>
        prisma.tag.upsert({
          where: { name: tagName.trim() },
          update: {},
          create: { name: tagName.trim() }
        })
      )
    );

    const contactTagRows: { contactId: string; tagId: string }[] = [];
    for (const tag of createdTags) {
      for (const contactId of contactIds) {
        contactTagRows.push({ contactId, tagId: tag.id });
      }
    }

    if (contactTagRows.length > 0) {
      await prisma.contactTag.createMany({
        data: contactTagRows,
        skipDuplicates: true
      });
    }

    await logAudit(req, 'BULK_ADD_TAGS', 'Contact', null, { contactCount: contactIds.length, tags });

    return res.json({ success: true, message: `Berhasil menambahkan tag ke ${contactIds.length} kontak` });
  } catch (err) {
    next(err);
  }
}

export async function listAllTags(_req: Request, res: Response, next: NextFunction) {
  try {
    const tags = await prisma.tag.findMany({
      include: { _count: { select: { contactTags: true } } },
      orderBy: { name: 'asc' }
    });
    return res.json({ success: true, data: tags });
  } catch (err) {
    next(err);
  }
}
