# Modul Import & Export Excel

## 1. Format Template Excel Motor
File template didownload langsung via API: `/api/imports/motorcycles/template`.
Kolom:
1. `sku`: Kode unik unit (contoh: `HND-VAR-160-CBS`). Wajib & unik.
2. `nama_motor`: Nama produk komersial.
3. `merek`: Nama merek terdaftar (Honda, Yamaha, Suzuki, Kawasaki).
4. `model`: Varian model mesin/tipe.
5. `tahun`: Tahun perakitan (4 digit angka).
6. `kategori`: Matic, Bebek, Sport, Naked, Cruiser, Trail, atau Skuter.
7. `kondisi`: `BARU` atau `BEKAS`.
8. `harga_otr`: Angka rupiah tanpa titik/koma (contoh: `29500000`).
9. `dp_minimum`: Nominal DP minimal.
10. `tenor_tersedia`: Pilihan bulan tenor dipisahkan koma (contoh: `11, 17, 23, 29, 35`).
11. `status_stok`: `TERSEDIA`, `INDENT`, atau `HABIS`.
12. `warna`: Pilihan warna unit.
13. `deskripsi`: Penjelasan fitur unit.

## 2. Format Template Excel Kontak
Kolom:
1. `nama`: Nama kontak/pelanggan.
2. `nomor_telepon`: Nomor HP (otomatis dinormalisasi ke `628...`).
3. `email`: Alamat email (opsional).
4. `tag`: Tag dipisahkan koma (contoh: `Matic, Follow-up`).
5. `sumber`: Asal perolehan kontak (Walk-in, Pameran, Iklan Meta, dll).
6. `minat_motor`: Nama motor yang disukai.
7. `consent_status`: `GRANTED`, `PENDING`, atau `DENIED`.

## 3. Strategi Import
- **UPSERT**: Tambah data baru, dan lakukan perbaruan jika SKU atau nomor telepon sudah ada di sistem.
- **INSERT_ONLY**: Hanya masukkan data baru, lewati baris yang sudah ada.
- **UPDATE_ONLY**: Hanya update baris yang sudah ada di database, abaikan data baru.
- **ABORT_ON_ERROR**: Batalkan transaksi secara menyeluruh apabila ada satu saja baris data yang invalid.

## 4. Keamanan Formula Injection
Setiap sel teks yang diawali dengan `=`, `+`, `-`, atau `@` otomatis disanitasi dengan tanda petik tunggal (`'`) sebelum dimasukkan ke dalam workbook Excel guna mencegah eksekusi formula arbitrer di Microsoft Excel.
