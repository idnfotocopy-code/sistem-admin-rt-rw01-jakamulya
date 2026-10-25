# Sistem Administrasi RT RW01 · Kelurahan Jakamulya · Bekasi Selatan (DEMO)

Next.js 14 (App Router) + TypeScript + Tailwind + SQLite (better-sqlite3) + pdfkit. Semua data adalah data fiktif.

## Menjalankan
```bash
npm install
npm run seed            # membuat data/app.db (pertama kali)
npm run build && npm start   # http://localhost:3000
# reset data demo (hentikan server dulu, lalu jalankan ulang):
node scripts/seed.js --reset
```

## Akun demo
| Username | Sandi | Role |
|---|---|---|
| admin | admin123 | Admin Sistem |
| kelurahan | kelurahan123 | Petugas Kelurahan |
| ketuarw | ketuarw123 | Ketua RW 01 |
| sekbendrw | sekbendrw123 | Sekretaris/Bendahara RW |
| ketuart1 / ketuart2 / ketuart3 | ketuart123 | Ketua RT 001/002/003 |
| bendrt1 / bendrt2 / bendrt3 | bendrt123 | Bendahara RT 001/002/003 |
| warga / warga2 / warga3 | warga123 | Warga (RT 001/002/003) |

## Catatan demo
- Tidak ada payment gateway; konfirmasi transfer/QRIS memakai unggah bukti + verifikasi bendahara.
- Tanda tangan = gambar PNG yang diunggah (visual), bukan TTE tersertifikasi BSrE.
- Data & file tersimpan lokal di folder `data/` (DB, `private/` untuk lampiran & TTD, `arsip/`, `backups/`).
