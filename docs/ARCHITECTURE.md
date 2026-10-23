# Arsitektur Motor Sales WhatsApp Bot & Admin Dashboard

## 1. Ikhtisar Sistem
Sistem ini dirancang dengan pola monorepo modular menggunakan npm workspaces:
- `packages/shared`: Skema validasi Zod, konstanta status, utilitas sanitasi Excel, dan type definitions TypeScript.
- `apps/api`: Backend Express.js dengan Prisma ORM, PostgreSQL, Redis, BullMQ queue worker, dan whatsapp-web.js engine.
- `apps/web`: Frontend React SPA dengan Vite, TypeScript, Tailwind CSS, Lucide icons, Dark/Light mode, dan HTML5 History API routing.

## 2. Struktur Modul Backend (`apps/api`)
```
apps/api/src/
├── config/             # Konfigurasi env, Prisma client, Redis, Pino logger
├── middleware/         # Autentikasi JWT, RBAC role guard, upload multer, errorHandler
├── modules/
│   ├── auth/           # Login, token session, manajemen akun admin
│   ├── dashboard/      # Ringkasan statistik operasional, status database & worker
│   ├── motorcycles/    # Katalog motor, upload galeri foto, filter OTR & stok
│   ├── brands/         # Manajemen pabrikan/merek motor (Honda, Yamaha, dll)
│   ├── financing/      # Simulasi kredit, perhitungan DP, bunga, tenor, dan angsuran
│   ├── contacts/       # Database kontak, normalisasi nomor WA 628xx, tagging, consent
│   ├── imports/        # Engine import Excel/CSV motor & kontak, preview, deteksi error
│   ├── exports/        # Generator Excel aman dengan proteksi formula injection
│   ├── broadcasts/     # Manajemen kampanye broadcast WA, filter consent, throttling
│   ├── conversations/  # Inbox chat pelanggan, riwayat pesan, balasan sales
│   ├── leads/          # Pipeline prospek pembeli, tahapan follow-up, sales PIC
│   ├── whatsapp/       # Client WhatsApp Web, session persistence, QR scanner, bot NLP
│   ├── settings/       # Sapaan bot, jam operasional, alamat dealer
│   ├── reports/        # Metrik konversi lead & statistik broadcast
│   └── audit-logs/     # Pencatatan audit trail setiap aksi admin
├── jobs/               # Background worker untuk pengiriman antrean broadcast
└── utils/              # Helper audit log, formatting, regex
```

## 3. Komponen Keamanan
- **Password Hashing:** Menggunakan bcrypt dengan salt round standar industri.
- **Role-Based Access Control:** Super Admin, Admin, dan Sales.
- **Excel Sanitization:** Setiap string input pengguna yang diekspor ke Excel disanitasi terhadap bahaya formula injection (`=`, `+`, `-`, `@`).
- **Throttle & Anti-Ban WhatsApp:** Delay konservatif antrean pesan minimal 2.500 ms per pesan broadcast, pengecekan status consent aktif sebelum pengiriman.
