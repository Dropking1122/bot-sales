# Dokumentasi Skema Database (PostgreSQL & Prisma)

Database dikelola menggunakan PostgreSQL dengan Prisma ORM.

## Daftar Tabel Utama

1. **admins**: Akun login staf dealer (Super Admin, Admin, Sales).
2. **brands**: Pabrikan motor (Honda, Yamaha, Suzuki, Kawasaki, dll).
3. **motorcycles**: Unit katalog motor (SKU unik, harga OTR, kondisi, stok, DP min).
4. **motorcycle_images**: Galeri foto unit motor (URL lokal atau static storage).
5. **financing_plans**: Paket pembiayaan dan simulasi leasing.
6. **contacts**: Database kontak WhatsApp dengan nomor dinormalisasi `628...`.
7. **tags** & **contact_tags**: Label segmentasi kontak (Matic, Sport, Follow-up, dll).
8. **customers**: Profil lengkap pembeli terhubung dengan data NIK & alamat.
9. **conversations**: Percakapan WhatsApp (status: ACTIVE, CLOSED, HANDOFF).
10. **messages**: Riwayat pesan masuk & keluar (sender: CUSTOMER, BOT, SALES).
11. **leads**: Peluang penjualan motor (status: BARU hingga BERHASIL / TIDAK_BERHASIL).
12. **broadcast_campaigns**: Kampanye pesan massal WhatsApp.
13. **broadcast_recipients**: Penerima broadcast perorangan beserta status pengiriman.
14. **broadcast_templates**: Template pesan massal dengan variabel dinamis `{{nama}}`.
15. **import_jobs**: Riwayat pekerjaan import file Excel/CSV.
16. **import_job_errors**: Log kesalahan per baris import dengan kolom dan alasan penolakan.
17. **export_jobs**: Log pekerjaan unduhan data spreadsheet.
18. **bot_settings**: Konfigurasi pesan sapaan, alamat dealer, jam operasional.
19. **whatsapp_sessions**: Status koneksi WhatsApp Web dan metadata sesi.
20. **audit_logs**: Rekam jejak audit keamanan setiap mutasi data.
