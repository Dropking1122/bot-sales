import { PrismaClient, AdminRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial data...');

  // 1. Super Admin
  const adminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@botsales.local';
  const adminPassword = process.env.SUPER_ADMIN_PASSWORD || 'AdminPassword2026!';
  const adminName = process.env.SUPER_ADMIN_NAME || 'Super Administrator';

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const superAdmin = await prisma.admin.upsert({
    where: { email: adminEmail },
    update: {
      name: adminName,
      passwordHash,
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
