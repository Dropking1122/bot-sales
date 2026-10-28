# Motor Sales WhatsApp Bot, Broadcast, Import Excel & Admin Dashboard

Aplikasi komprehensif untuk operasional dealer motor: katalog produk, automasi WhatsApp bot, simulasi cicilan kredit, broadcast promosi terpersonalisasi, import/export spreadsheet Excel, dan dashboard manajemen penjualan.

---

## Fitur Utama

- 🤖 **WhatsApp Bot Engine**: Katalog interaktif, detail spesifikasi OTR & DP, kalkulator simulasi kredit, sales takeover / handoff, dan opt-out otomatis.
- 🏍️ **Manajemen Katalog Motor**: CRUD unit motor, galeri foto, status ketersediaan (Tersedia, Indent, Habis), dan filter merek terpadu.
- 📊 **Dashboard Analitik**: Metrik unit aktif, kontak pelanggan, percakapan harian, status koneksi WhatsApp Web, PostgreSQL, dan antrean Redis.
- 📥 **Import Excel & CSV Canggih**: Template download, validasi baris otomatis, deteksi duplikasi SKU & nomor telepon, serta unduhan laporan error berbasis baris.
- 📤 **Export Excel Aman**: Unduhan satu klik katalog, kontak, dan leads dengan proteksi formula injection.
- 📢 **Broadcast Kampanye**: Wizard 4-langkah, filter persetujuan (consent verification), template dinamis, throttling anti-spam, dan pause/resume/cancel real-time.
- 💬 **Live Inbox & CRM Leads**: Pantau riwayat obrolan pelanggan, pengambilalihan kendali manual oleh sales PIC, serta pelacakan tahapan pipeline prospek.
- 🌓 **Desain Modern & Responsif**: Mode Gelap (Dark Mode) dan Terang (Light Mode) dengan integrasi Tailwind CSS & Lucide Icons.

---

## Struktur Monorepo

```
motor-sales-bot/
├── apps/
│   ├── api/       # Express.js, Prisma ORM, whatsapp-web.js, ExcelJS, BullMQ
│   └── web/       # React 18, Vite, TypeScript, Tailwind CSS, React Router
├── packages/
│   └── shared/    # Zod schemas, types, phone normalizer, formatting helpers
├── docs/          # Dokumentasi teknis arsitektur, API, database, & deployment
└── storage/       # Direktori persisten foto unit motor, file template, & sesi WA
```

---

## Panduan Memulai Cepat

### 1. Prasyarat
- Node.js v20+ / v22+ / v24+
- PostgreSQL
- Redis Server
- Google Chrome / Chromium

### 2. Instalasi
```bash
git clone https://github.com/Dropking1122/bot-sales.git
cd bot-sales
npm install
```

### 3. Konfigurasi Database
Salin berkas konfigurasi lingkungan:
```bash
cp .env.example .env
```
Generate Prisma Client, push skema ke PostgreSQL, dan jalankan data awal (seeding):
```bash
npm run prisma:generate
npm run prisma:push
npm run prisma:seed
```

### 4. Menjalankan Server & Web
```bash
# Menjalankan seluruh modul (API & Web) secara bersamaan:
npm run dev

# Menjalankan test verifikasi:
npm test
```

### 5. Akun Administrator Bawaan
- **URL Login**: `http://localhost:5173/login`
- **Email**: `admin@botsales.local` (atau nilai `SUPER_ADMIN_EMAIL`)
- **Password**: nilai `SUPER_ADMIN_PASSWORD` di `.env` (dibuat saat menjalankan `npm run prisma:seed`)
- **Role**: `SUPER_ADMIN`

Tidak ada password bawaan yang tertanam di source. Seed akan menolak berjalan bila
`SUPER_ADMIN_PASSWORD` belum diisi, dan menjalankan ulang seed tidak akan mengembalikan password
yang sudah pernah diubah.
