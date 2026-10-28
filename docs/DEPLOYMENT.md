# Panduan Deployment & Operasional VPS

## 1. Persyaratan Sistem
- VPS Linux (Ubuntu 22.04 / 24.04 LTS).
- Node.js LTS (v20+ / v22+ / v24+).
- PostgreSQL 15+ / 16+.
- Redis Server (untuk BullMQ antrean terdistribusi).
- Google Chrome / Chromium (untuk whatsapp-web.js).
- PM2 untuk process management.
- Nginx untuk reverse proxy dan SSL HTTPS.

## 2. Langkah Instalasi Cepat

### A. Clone & Install Dependencies
```bash
git clone https://github.com/Dropking1122/bot-sales.git
cd bot-sales
npm install
```

### B. Konfigurasi Database & Environment
```bash
cp .env.example .env
# Edit DATABASE_URL, REDIS, JWT_SECRET sesuai konfigurasi server
```

Jalankan sinkronisasi database & data awal:
```bash
npm run prisma:generate
npm run prisma:push
npm run prisma:seed
```

### C. Build Aplikasi
```bash
npm run build
```

### D. Menjalankan dengan PM2
```bash
# Jalankan Backend API
pm2 start apps/api/dist/server.js --name "bot-sales-api"

# Atau gunakan dev mode untuk pengujian
npm run dev
```

## 3. Konfigurasi Nginx
```nginx
server {
    server_name sales.dealermotor.com;

    # Frontend Single Page App
    location / {
        root /root/bot-sales/apps/web/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Backend API Reverse Proxy
    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Static Storage (Foto Motor & Laporan)
    location /storage/ {
        proxy_pass http://127.0.0.1:4000/storage/;
    }
}
```

## 4. Akun Bawaan (Default Seed)
- Email: `admin@botsales.local` (atau `SUPER_ADMIN_EMAIL`)
- Password: nilai `SUPER_ADMIN_PASSWORD` yang Anda isi di `.env` — tidak ada password bawaan di source
- Role: `SUPER_ADMIN`
- Seed menolak berjalan tanpa `SUPER_ADMIN_PASSWORD` (min. 12 karakter) dan tidak mengembalikan
  password yang sudah diubah bila dijalankan ulang.
