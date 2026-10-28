import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter')
});

export const AdminUserSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter'),
  email: z.string().email('Format email tidak valid'),
  phone: z.string().optional().nullable(),
  password: z.string().min(6, 'Password minimal 6 karakter').optional(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'SALES']),
  isActive: z.boolean().default(true),
  isAvailable: z.boolean().default(true)
});

export const BrandSchema = z.object({
  name: z.string().min(1, 'Nama brand wajib diisi').max(50),
  description: z.string().optional().nullable(),
  isActive: z.boolean().default(true)
});

export const MotorcycleSchema = z.object({
  sku: z.string().min(1, 'SKU wajib diisi').max(50),
  name: z.string().min(2, 'Nama motor wajib diisi').max(100),
  brandId: z.string().uuid('Brand ID harus UUID yang valid'),
  model: z.string().min(1, 'Model wajib diisi').max(100),
  year: z.number().int().min(1990).max(new Date().getFullYear() + 1),
  category: z.string().min(1, 'Kategori wajib diisi').max(50),
  condition: z.enum(['BARU', 'BEKAS']),
  priceOtr: z.number().positive('Harga OTR harus bilangan positif'),
  description: z.string().optional().nullable(),
  specs: z.record(z.any()).optional().nullable(),
  colors: z.array(z.string()).default([]),
  stockStatus: z.enum(['TERSEDIA', 'INDENT', 'HABIS']).default('TERSEDIA'),
  isActive: z.boolean().default(true),
  minDp: z.number().min(0, 'DP minimum tidak boleh negatif').optional().nullable(),
  availableTenors: z.array(z.number().int().positive()).default([11, 23, 29, 35])
});

export const MotorcycleExcelRowSchema = z.object({
  sku: z.string().min(1, 'SKU wajib diisi'),
  nama_motor: z.string().min(1, 'Nama motor wajib diisi'),
  merek: z.string().min(1, 'Merek wajib diisi'),
  model: z.string().min(1, 'Model wajib diisi'),
  tahun: z.coerce.number().int().min(1990),
  kategori: z.string().min(1, 'Kategori wajib diisi'),
  kondisi: z.string().transform((val) => {
    const upper = val.toUpperCase().trim();
    return upper === 'BEKAS' ? 'BEKAS' : 'BARU';
  }),
  harga_otr: z.coerce.number().positive('Harga OTR harus lebih besar dari 0'),
  deskripsi: z.string().optional().default(''),
  spesifikasi: z.string().optional().default(''),
  warna: z.string().optional().default(''),
  status_stok: z.string().transform((val) => {
    const upper = (val || '').toUpperCase().trim();
    if (upper === 'INDENT') return 'INDENT';
    if (upper === 'HABIS') return 'HABIS';
    return 'TERSEDIA';
  }),
  status_aktif: z.string().transform((val) => {
    const lower = (val || '').toLowerCase().trim();
    return !(lower === 'nonaktif' || lower === 'false' || lower === '0' || lower === 'tidak');
  }),
  dp_minimum: z.coerce.number().min(0).optional().default(0),
  tenor_tersedia: z.string().optional().default('11,23,29,35')
});

export const ContactSchema = z.object({
  name: z.string().min(1, 'Nama kontak wajib diisi').max(100),
  phone: z.string().min(8, 'Nomor telepon minimal 8 digit').max(20),
  email: z.string().email('Format email tidak valid').optional().nullable(),
  source: z.string().max(50).default('DIRECT'),
  tags: z.array(z.string()).default([]),
  interestedMotorcycle: z.string().optional().nullable(),
  internalNotes: z.string().optional().nullable(),
  consentStatus: z.enum(['GRANTED', 'PENDING', 'DENIED', 'OPT_OUT']).default('PENDING'),
  consentSource: z.string().optional().nullable(),
  consentAt: z.coerce.date().optional().nullable(),
  isOptOut: z.boolean().default(false)
});

export const ContactExcelRowSchema = z.object({
  nama: z.string().min(1, 'Nama wajib diisi'),
  nomor_telepon: z.string().min(8, 'Nomor telepon tidak valid'),
  email: z.string().email().optional().or(z.literal('')).nullable(),
  tag: z.string().optional().default(''),
  sumber: z.string().optional().default('IMPORT_EXCEL'),
  minat_motor: z.string().optional().default(''),
  catatan: z.string().optional().default(''),
  consent_status: z.string().transform((val) => {
    const upper = (val || '').toUpperCase().trim();
    if (upper === 'GRANTED' || upper === 'SETUJU' || upper === 'YA') return 'GRANTED';
    if (upper === 'DENIED' || upper === 'TOLAK') return 'DENIED';
    if (upper === 'OPT_OUT' || upper === 'BERHENTI') return 'OPT_OUT';
    return 'PENDING';
  }),
  consent_source: z.string().optional().default('IMPORT'),
  consent_at: z.string().optional()
});

export const BroadcastCampaignSchema = z.object({
  name: z.string().min(3, 'Nama kampanye minimal 3 karakter').max(100),
  description: z.string().optional().nullable(),
  campaignType: z.string().min(1, 'Tipe kampanye wajib dipilih'),
  messageTemplate: z.string().min(5, 'Isi template pesan minimal 5 karakter'),
  mediaUrl: z.string().optional().nullable(),
  motorcycleId: z.string().uuid().optional().nullable(),
  scheduledAt: z.coerce.date().optional().nullable(),
  recipientFilter: z.object({
    contactIds: z.array(z.string().uuid()).optional(),
    tags: z.array(z.string()).optional(),
    interestedMotorcycle: z.string().optional(),
    sources: z.array(z.string()).optional(),
    // Deprecated and ignored: consent is enforced as an invariant by the API, not as an opt-in
    // filter. Still accepted so an old client that sends it keeps working.
    onlyConsented: z.boolean().optional()
  }).default({})
});

export const FinancingSimulationSchema = z.object({
  hargaOtr: z.coerce.number().positive('Harga OTR harus lebih besar dari 0'),
  dpAmount: z.coerce.number().min(0, 'DP tidak boleh negatif'),
  tenorMonths: z.coerce.number().int().positive('Tenor bulan harus bilangan positif'),
  interestRateAnnual: z.coerce.number().min(0).default(8.5), // Default dealer 8.5% p.a.
  adminFee: z.coerce.number().min(0).default(500000), // Default biaya admin
  insuranceFee: z.coerce.number().min(0).default(350000) // Default asuransi
});
