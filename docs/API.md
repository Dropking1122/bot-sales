# Dokumentasi REST API

Semua endpoint dilindungi Bearer Token JWT pada header `Authorization: Bearer <TOKEN>` kecuali endpoint autentikasi `/api/auth/login`.

## 1. Autentikasi
- `POST /api/auth/login`: Login dengan email & password. Mengembalikan JWT token & profil pengguna.
- `GET /api/auth/me`: Mengambil data profil login saat ini.
- `POST /api/auth/change-password`: Mengubah password akun sendiri.
- `GET /api/auth/admins`: Daftar admin (Khusus SUPER_ADMIN).
- `POST /api/auth/admins`: Tambah admin baru (Khusus SUPER_ADMIN).

## 2. Dashboard
- `GET /api/dashboard/summary`: Mengambil ringkasan statistik, jumlah unit aktif, total kontak, status WhatsApp, dan status database.

## 3. Katalog Motor
- `GET /api/motorcycles`: Daftar motor dengan filter brand, kondisi, stok, rentang harga, dan paginasi.
- `POST /api/motorcycles`: Tambah unit motor baru.
- `GET /api/motorcycles/:id`: Detail unit motor lengkap dengan foto dan simulasi pembiayaan.
- `PATCH /api/motorcycles/:id`: Update data unit motor.
- `DELETE /api/motorcycles/:id`: Hapus atau nonaktifkan motor.
- `POST /api/motorcycles/:id/images`: Upload foto ke galeri motor.
- `DELETE /api/motorcycles/:id/images/:imageId`: Hapus foto motor.

## 4. Simulasi Pembiayaan
- `POST /api/financing/simulate`: Hitung estimasi kredit motor berdasarkan OTR, DP, bunga tahunan, dan tenor.

## 5. Kontak & Tagging
- `GET /api/contacts`: Daftar kontak dengan filter tag, status persetujuan, dan pencarian nomor.
- `POST /api/contacts`: Tambah kontak manual.
- `GET /api/contacts/:id`: Detail kontak beserta tag dan riwayat pesan.
- `PATCH /api/contacts/:id`: Perbarui informasi kontak atau status consent / opt-out.
- `POST /api/contacts/bulk-tags`: Berikan label/tag massal ke beberapa kontak sekaligus.

## 6. Import Data Excel
- `GET /api/imports/motorcycles/template`: Unduh file template Excel motor (.xlsx).
- `GET /api/imports/contacts/template`: Unduh file template Excel kontak (.xlsx).
- `POST /api/imports/motorcycles/preview`: Upload file Excel motor dan dapatkan preview validasi baris.
- `POST /api/imports/motorcycles`: Eksekusi proses import motor dengan strategi yang dipilih.
- `POST /api/imports/contacts/preview`: Upload file Excel kontak dan periksa validitas nomor WA.
- `POST /api/imports/contacts`: Eksekusi proses import kontak.
- `GET /api/imports/:jobId/errors/export`: Unduh laporan Excel baris yang gagal diimport.

## 7. Export Data Excel
- `GET /api/exports/motorcycles`: Unduh seluruh data motor aktif ke file Excel.
- `GET /api/exports/contacts`: Unduh database kontak ke file Excel.
- `GET /api/exports/leads`: Unduh daftar prospek penjualan ke file Excel.

## 8. Broadcast WhatsApp
- `GET /api/broadcasts`: Daftar kampanye broadcast.
- `POST /api/broadcasts`: Buat kampanye baru dengan target tersaring.
- `POST /api/broadcasts/preview`: Tampilkan preview jumlah audiens dan contoh pesan.
- `POST /api/broadcasts/:id/start`: Jalankan pengiriman antrean kampanye.
- `POST /api/broadcasts/:id/pause`: Jeda sementara kampanye yang sedang berjalan.
- `POST /api/broadcasts/:id/cancel`: Batalkan kampanye.
- `GET /api/broadcasts/:id/report`: Unduh rekapitulasi status pengiriman dalam bentuk Excel.

## 9. Inbox Chat & Leads
- `GET /api/conversations`: Daftar percakapan WhatsApp.
- `GET /api/conversations/:id/messages`: Riwayat chat per nomor.
- `POST /api/conversations/:id/messages`: Kirim balasan pesan manual oleh sales.
- `POST /api/conversations/:id/takeover`: Ambil alih percakapan (matikan balasan otomatis bot).
- `POST /api/conversations/:id/resume-bot`: Kembalikan percakapan ke mode bot otomatis.
- `GET /api/leads`: Daftar prospek penjualan motor.
- `PATCH /api/leads/:id`: Update status prospek atau sales penanggung jawab.

## 10. WhatsApp Client & Pengaturan
- `GET /api/whatsapp/status`: Status koneksi WA dan base64 QR code.
- `POST /api/whatsapp/connect`: Mulai instance WhatsApp Web.
- `POST /api/whatsapp/disconnect`: Tutup sesi WhatsApp.
- `GET /api/settings`: Ambil pengaturan pesan sapaan, jam buka, dan alamat dealer.
- `PATCH /api/settings`: Simpan perubahan pengaturan bot.
