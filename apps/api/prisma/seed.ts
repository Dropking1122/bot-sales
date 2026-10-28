import { PrismaClient, AdminRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial data...');

  // 1. Super Admin
  // The initial credential must come from the environment. It was previously a source literal
  // ('Admin123!') that the upsert re-applied on every run, which both published the credential and
  // silently reverted any rotation.
  const adminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@botsales.local';
  const adminPassword = process.env.SUPER_ADMIN_PASSWORD;
  const adminName = process.env.SUPER_ADMIN_NAME || 'Super Administrator';

  if (!adminPassword || adminPassword.length < 12) {
    throw new Error(
      'SUPER_ADMIN_PASSWORD is required and must be at least 12 characters. Set it in .env ' +
        '(see .env.example) before running the seed.'
    );
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const superAdmin = await prisma.admin.upsert({
    // update does NOT set passwordHash: re-running the seed must not reset a rotated password.
    where: { email: adminEmail },
    update: {
      name: adminName,
      role: AdminRole.SUPER_ADMIN,
      isActive: true
    },
    create: {
      email: adminEmail,
      name: adminName,
      passwordHash,
      role: AdminRole.SUPER_ADMIN,
      isActive: true
    }
  });

  console.log(`✓ Super Admin created/updated: ${superAdmin.email}`);

  // 2. Default Brands
  const brands = [
    { name: 'Honda', description: 'Sepeda Motor Honda' },
    { name: 'Yamaha', description: 'Sepeda Motor Yamaha' },
    { name: 'Suzuki', description: 'Sepeda Motor Suzuki' },
    { name: 'Kawasaki', description: 'Sepeda Motor Kawasaki' }
  ];

  for (const b of brands) {
    await prisma.brand.upsert({
      where: { name: b.name },
      update: { description: b.description },
      create: { name: b.name, description: b.description, isActive: true }
    });
  }
  console.log(`✓ Brands seeded (${brands.length} brands)`);

  // 3. Default Tags
  const tags = [
    { name: 'Prospek Baru', color: '#10B981' },
    { name: 'Follow-up', color: '#F59E0B' },
    { name: 'Pelanggan Lama', color: '#3B82F6' },
    { name: 'Matic', color: '#8B5CF6' },
    { name: 'Sport', color: '#EC4899' },
    { name: 'Bebek', color: '#6366F1' }
  ];

  for (const t of tags) {
    await prisma.tag.upsert({
      where: { name: t.name },
      update: { color: t.color },
      create: { name: t.name, color: t.color }
    });
  }
  console.log(`✓ Default Tags seeded (${tags.length} tags)`);

  // 4. Default Bot Settings
  const defaultSettings = [
    {
      key: 'bot_greeting',
      value: 'Halo! Selamat datang di Layanan Otomatis Dealer Motor kami 🏍️\n\nKetik *KATALOG* untuk melihat pilihan motor terbaru kami,\natau ketik *SIMULASI* untuk simulasi cicilan kredit.\nTim sales kami juga siap membantu Anda!',
      description: 'Pesan sapaan awal saat pelanggan mengirim pesan pertama kali'
    },
    {
      key: 'bot_operating_hours',
      value: 'Senin - Sabtu: 08:30 - 17:00 WIB\nMinggu: 09:00 - 15:00 WIB',
      description: 'Informasi jam operasional dealer'
    },
    {
      key: 'bot_dealer_address',
      value: 'Jl. Raya Otomotif No. 88, Jakarta Selatan',
      description: 'Alamat resmi dealer'
    },
    {
      key: 'bot_dealer_phone',
      value: '081234567890',
      description: 'Nomor kontak telepon atau sales dealer'
    },
    {
      key: 'bot_auto_reply_enabled',
      value: 'true',
      description: 'Status bot aktif untuk membalas otomatis'
    },
    {
      key: 'broadcast_delay_ms',
      value: '2500',
      description: 'Jeda pengiriman antar pesan broadcast (milidetik)'
    }
  ];

  for (const s of defaultSettings) {
    await prisma.botSetting.upsert({
      where: { key: s.key },
      update: { value: s.value, description: s.description },
      create: { key: s.key, value: s.value, description: s.description }
    });
  }
  console.log(`✓ Bot Settings seeded (${defaultSettings.length} settings)`);

  // 5. Default Broadcast Templates
  const defaultTemplates = [
    {
      name: 'Penawaran Promo Motor',
      category: 'PROMO',
      content: 'Halo {{nama}}! Dapatkan promo spesial untuk motor {{nama_motor}} dengan OTR Rp {{harga_motor}}. DP mulai dari Rp {{dp_motor}} dan estimasi cicilan Rp {{cicilan_motor}}/bulan. Balas pesan ini untuk info lengkapnya!',
      variables: ['nama', 'nama_motor', 'harga_motor', 'dp_motor', 'cicilan_motor']
    },
    {
      name: 'Follow-up Prospek',
      category: 'FOLLOW_UP',
      content: 'Halo {{nama}}, apakah masih berencana untuk mengambil unit {{nama_motor}}? Kami ada unit ready stock dan promo potongan DP minggu ini. Mau kami jadwalkan test drive?',
      variables: ['nama', 'nama_motor']
    }
  ];

  for (const tmpl of defaultTemplates) {
    const existing = await prisma.broadcastTemplate.findFirst({
      where: { name: tmpl.name }
    });
    if (!existing) {
      await prisma.broadcastTemplate.create({
        data: {
          name: tmpl.name,
          category: tmpl.category,
          content: tmpl.content,
          variables: tmpl.variables,
          createdById: superAdmin.id
        }
      });
    }
  }
  console.log(`✓ Broadcast Templates seeded (${defaultTemplates.length} templates)`);

  // 6. Default Starter Motorcycles
  const hondaBrand = await prisma.brand.findUnique({ where: { name: 'Honda' } });
  const yamahaBrand = await prisma.brand.findUnique({ where: { name: 'Yamaha' } });

  const defaultMotors = [
    {
      sku: 'HND-BEAT-CBS',
      name: 'Honda BeAT CBS',
      brandId: hondaBrand?.id!,
      model: 'BeAT',
      year: 2026,
      category: 'Matic',
      condition: 'BARU' as any,
      priceOtr: 18500000,
      minDp: 1500000,
      colors: ['Hitam', 'Merah', 'Putih'],
      stockStatus: 'TERSEDIA' as any,
      description: 'Motor matic lincah, hemat bahan bakar dengan mesin eSP 110cc.'
    },
    {
      sku: 'HND-VARIO-160',
      name: 'Honda Vario 160 CBS',
      brandId: hondaBrand?.id!,
      model: 'Vario 160',
      year: 2026,
      category: 'Matic',
      condition: 'BARU' as any,
      priceOtr: 27500000,
      minDp: 2500000,
      colors: ['Matte Black', 'Matte Red'],
      stockStatus: 'TERSEDIA' as any,
      description: 'Performa mesin 160cc 4-katup eSP+ bertenaga besar dengan desain sporty agresif.'
    },
    {
      sku: 'HND-PCX-160',
      name: 'Honda PCX 160 CBS',
      brandId: hondaBrand?.id!,
      model: 'PCX 160',
      year: 2026,
      category: 'Matic Maxi',
      condition: 'BARU' as any,
      priceOtr: 33200000,
      minDp: 3500000,
      colors: ['Magnificent Red', 'Royal Matte Blue', 'Wonderful White'],
      stockStatus: 'TERSEDIA' as any,
      description: 'Skutik premium mewah berkapasitas 160cc dengan bagasi luas 30 liter.'
    },
    {
      sku: 'YMH-NMAX-155',
      name: 'Yamaha NMAX 155 Connected',
      brandId: yamahaBrand?.id!,
      model: 'NMAX 155',
      year: 2026,
      category: 'Matic Maxi',
      condition: 'BARU' as any,
      priceOtr: 32800000,
      minDp: 3500000,
      colors: ['Maxi Signature Black', 'Matte Green', 'Metallic Red'],
      stockStatus: 'TERSEDIA' as any,
      description: 'Maxi scooter legendaris dengan teknologi Blue Core 155cc VVA dan Y-Connect.'
    },
    {
      sku: 'YMH-AEROX-155',
      name: 'Yamaha Aerox 155 Standard',
      brandId: yamahaBrand?.id!,
      model: 'Aerox 155',
      year: 2026,
      category: 'Matic Maxi',
      condition: 'BARU' as any,
      priceOtr: 28200000,
      minDp: 2800000,
      colors: ['Cyber City', 'Silver Cyan', 'Yellow'],
      stockStatus: 'TERSEDIA' as any,
      description: 'Super Sport Scooter dengan DNA balap Yamaha dan handling presisi.'
    }
  ];

  for (const m of defaultMotors) {
    if (!m.brandId) continue;
    await prisma.motorcycle.upsert({
      where: { sku: m.sku },
      update: {
        name: m.name,
        priceOtr: m.priceOtr,
        minDp: m.minDp,
        category: m.category,
        description: m.description,
        isActive: true
      },
      create: m
    });
  }
  console.log(`✓ Default Motorcycles seeded (${defaultMotors.length} units)`);

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
