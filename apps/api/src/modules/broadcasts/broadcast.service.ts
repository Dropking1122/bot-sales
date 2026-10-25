import { prisma } from '../../config/db';
import { formatRupiah } from '@bot-sales/shared';
import { calculateFinancing } from '../financing/financing.service';

export interface RecipientFilter {
  contactIds?: string[];
  tags?: string[];
  interestedMotorcycle?: string;
  sources?: string[];
  onlyConsented?: boolean;
}

export async function resolveBroadcastRecipients(filter: RecipientFilter) {
  const where: any = {
    isOptOut: false // strictly exclude opt-out contacts
  };

  if (filter.onlyConsented !== false) {
    where.consentStatus = 'GRANTED'; // strictly require consent
  }

  if (filter.contactIds && filter.contactIds.length > 0) {
    where.id = { in: filter.contactIds };
  }

  if (filter.tags && filter.tags.length > 0) {
    where.contactTags = {
      some: {
        tag: { name: { in: filter.tags } }
      }
    };
  }

  if (filter.interestedMotorcycle) {
    where.interestedMotorcycle = { contains: filter.interestedMotorcycle, mode: 'insensitive' };
  }

  if (filter.sources && filter.sources.length > 0) {
    where.source = { in: filter.sources };
  }

  const contacts = await prisma.contact.findMany({
    where,
    select: {
      id: true,
      name: true,
      phone: true,
      phoneNormalized: true,
      internalNotes: true,
      interestedMotorcycle: true
    }
  });

  return contacts;
}

export async function interpolateTemplate(
  template: string,
  contact: { name: string; interestedMotorcycle?: string | null },
  motorcycle?: any
): Promise<string> {
  let message = template;

  // Contact variables
  message = message.replace(/\{\{nama\}\}/gi, contact.name);
  message = message.replace(/\{\{minat_motor\}\}/gi, contact.interestedMotorcycle || 'Motor Impian');

  // Motorcycle variables if attached
  if (motorcycle) {
    message = message.replace(/\{\{nama_motor\}\}/gi, motorcycle.name);
    message = message.replace(/\{\{merek\}\}/gi, motorcycle.brand?.name || '');
    message = message.replace(/\{\{harga_motor\}\}/gi, formatRupiah(Number(motorcycle.priceOtr)));
    message = message.replace(/\{\{dp_motor\}\}/gi, formatRupiah(Number(motorcycle.minDp || 0)));

    // Calculate installment estimate if 35 months tenor
    try {
      const otr = Number(motorcycle.priceOtr);
      const dp = Number(motorcycle.minDp) || otr * 0.1;
      const sim = await calculateFinancing({
        hargaOtr: otr,
        dpAmount: dp,
        tenorMonths: 35
      });
      message = message.replace(/\{\{cicilan_motor\}\}/gi, formatRupiah(sim.monthlyInstallment));
    } catch (e) {
      message = message.replace(/\{\{cicilan_motor\}\}/gi, 'Hubungi sales');
    }
  }

  return message;
}
