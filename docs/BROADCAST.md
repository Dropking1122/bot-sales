# Modul Broadcast & Anti-Spam Protection

## 1. Siklus Hidup Kampanye Broadcast
1. **DRAFT**: Kampanye dirancang (nama, target filter, template pesan).
2. **AUDIENCE FILTER**: Sistem menghitung kontak yang memenuhi kriteria tag serta memiliki `consentStatus === 'GRANTED'` dan `isOptOut === false`.
3. **RUNNING**: Worker antrean memproses pesan secara serial.
4. **PAUSED**: Pengiriman dihentikan sementara oleh admin atau ketika WhatsApp terputus.
5. **COMPLETED**: Seluruh pesan terproses (sukses maupun ditolak).
6. **CANCELLED**: Kampanye dibatalkan oleh pengguna.

## 2. Throttling & Perlindungan Akun WhatsApp
- Kecepatan pengiriman default: Jeda waktu (delay) 2.500 ms di antara setiap pesan yang dikirimkan.
- Pengecekan status opt-out real-time: Sebelum pesan dikirim ke penerima, status opt-out kontak dicek kembali untuk menghindari pengiriman kepada pelanggan yang telah meminta berhenti.
- Idempotency Key: Mencegah duplikasi pesan ke nomor yang sama jika terjadi crash atau restart worker.

## 3. Variabel Personalisasi Template
- `{{nama}}`: Nama lengkap kontak.
- `{{minat_motor}}`: Motor yang diminati oleh kontak.
- `{{harga_motor}}`: Format rupiah harga OTR.
- `{{dp_motor}}`: Estimasi DP motor.
- `{{cicilan_motor}}`: Estimasi angsuran bulanan.
