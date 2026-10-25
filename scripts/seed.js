/* Seed demo database: node scripts/seed.js [--reset] */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const DBFILE = path.join(DATA, 'app.db');
const reset = process.argv.includes('--reset');
if (fs.existsSync(DBFILE) && !reset) { console.log('Database sudah ada (data/app.db). Pakai --reset untuk mengulang.'); process.exit(0); }
if (reset) { for (const f of ['app.db', 'app.db-wal', 'app.db-shm']) { try { fs.unlinkSync(path.join(DATA, f)); } catch {} } for (const d of ['arsip', 'private']) fs.rmSync(path.join(DATA, d), { recursive: true, force: true }); }
for (const d of ['', 'arsip', 'private/ttd', 'private/uploads', 'backups']) fs.mkdirSync(path.join(DATA, d), { recursive: true });

const db = new Database(DBFILE);
db.pragma('journal_mode = WAL');
db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

// ---------- tiny PNG writer for demo signatures ----------
function crc32(buf) { let c, crc = 0xffffffff; for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xffffffff) >>> 0; }
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); }
function signaturePng(seed) {
  const W = 360, H = 140; const px = Buffer.alloc(W * H * 4, 0);
  const rnd = (i) => { const x = Math.sin(seed * 9301 + i * 49297) * 233280; return x - Math.floor(x); };
  const dot = (x, y, r) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const X = Math.round(x + dx), Y = Math.round(y + dy); if (X < 0 || Y < 0 || X >= W || Y >= H) continue; const d = Math.sqrt(dx * dx + dy * dy); if (d > r) continue; const a = Math.min(255, Math.round(255 * (r - d + 0.6))); const o = (Y * W + X) * 4; px[o] = 20; px[o + 1] = 40; px[o + 2] = 120; px[o + 3] = Math.max(px[o + 3], a); } };
  // cursive loops
  let prev = null; const loops = 5 + Math.floor(rnd(1) * 3);
  for (let t = 0; t <= 1; t += 0.0007) {
    const x = 30 + t * 260 + Math.sin(t * Math.PI * 2 * loops) * 18;
    const y = 75 + Math.cos(t * Math.PI * 2 * loops + rnd(2) * 3) * (28 + 10 * Math.sin(t * 7 + seed)) - t * 20;
    dot(x, y, 1.6);
    prev = [x, y];
  }
  for (let t = 0; t <= 1; t += 0.002) dot(40 + t * 290, 112 - t * 6 + Math.sin(t * 9 + seed) * 4, 1.3); // underline flourish
  const raw = Buffer.alloc((W * 4 + 1) * H); for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; px.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const ins = (table, obj) => { const k = Object.keys(obj); return db.prepare(`INSERT INTO ${table}(${k.join(',')}) VALUES(${k.map(x => '@' + x).join(',')})`).run(obj).lastInsertRowid; };

const tx = db.transaction(() => {
  // settings
  const settings = {
    app_title: 'Sistem Administrasi RT RW01',
    kop_baris1: 'PEMERINTAH KOTA BEKASI',
    kop_baris2: 'KECAMATAN BEKASI SELATAN',
    kop_baris3: 'KELURAHAN JAKAMULYA',
    kop_baris4: 'RUKUN WARGA 01',
    kop_alamat: 'Sekretariat RW 01, Jl. Jakamulya Raya, Kel. Jakamulya, Kec. Bekasi Selatan, Kota Bekasi 17146',
    kota_ttd: 'Bekasi',
    format_nomor_surat: '{no}/{kode}/RT-{rt}/RW-01/{bulan}/{tahun}',
    format_kuitansi_iuran: 'KW/RT{rt}/{tahun}/{no}',
    format_kuitansi_takziah: 'TAK/RT{rt}/{tahun}/{no}',
    tampilkan_kode_verifikasi: '1',
  };
  for (const [key, value] of Object.entries(settings)) ins('settings', { key, value });

  ins('kelurahan', { id: 1, nama: 'Jakamulya', kecamatan: 'Bekasi Selatan', kota: 'Kota Bekasi', provinsi: 'Jawa Barat', alamat: 'Jl. Jakamulya Raya No. 1, Bekasi Selatan', kode_pos: '17146', lurah: 'Drs. H. Mulyadi, M.Si', nip_lurah: '19700101 199503 1 001', telp: '(021) 8200000' });
  ins('rw', { id: 1, kelurahan_id: 1, kode: '01', nama: 'RW 01', alamat: 'Jl. Jakamulya Raya, Bekasi Selatan', ketua: 'H. Sutrisno', sekretaris: 'Nur Hidayah', bendahara: 'Nur Hidayah', masa_mulai: '2024-01-01', masa_selesai: '2026-12-31', kode_surat: 'RW-01' });
  const rts = [
    { id: 1, rw_id: 1, kode: '001', nama: 'RT 001', alamat: 'Jl. Melati, Blok A', ketua: 'Ahmad Fauzi', bendahara: 'Wulan Sari', masa_mulai: '2024-01-01', masa_selesai: '2026-12-31' },
    { id: 2, rw_id: 1, kode: '002', nama: 'RT 002', alamat: 'Jl. Kenanga, Blok B', ketua: 'Slamet Riyadi', bendahara: 'Fitri Handayani', masa_mulai: '2024-01-01', masa_selesai: '2026-12-31' },
    { id: 3, rw_id: 1, kode: '003', nama: 'RT 003', alamat: 'Jl. Anggrek, Blok C', ketua: 'Teguh Prasetyo', bendahara: 'Maya Anggraini', masa_mulai: '2024-01-01', masa_selesai: '2026-12-31' },
  ];
  rts.forEach(r => ins('rt', r));

  // households & residents
  const hh = [
    // rt, kepala, alamat, members [nama, jk, tmp, tgl, agama, kerja, kawin, hub]
    [1, 'Budi Santoso', 'Jl. Melati No. 3, Blok A', [['Budi Santoso', 'L', 'Bekasi', '1982-04-12', 'Islam', 'Karyawan Swasta', 'Kawin', 'Kepala Keluarga'], ['Ani Wijayanti', 'P', 'Jakarta', '1985-09-20', 'Islam', 'Guru', 'Kawin', 'Istri'], ['Raka Santoso', 'L', 'Bekasi', '2010-02-01', 'Islam', 'Pelajar', 'Belum Kawin', 'Anak']]],
    [1, 'Siti Aminah', 'Jl. Melati No. 5, Blok A', [['Siti Aminah', 'P', 'Bekasi', '1975-06-30', 'Islam', 'Wiraswasta', 'Cerai Mati', 'Kepala Keluarga'], ['Dimas Pratama', 'L', 'Bekasi', '2001-11-11', 'Islam', 'Mahasiswa', 'Belum Kawin', 'Anak']]],
    [1, 'Ahmad Fauzi', 'Jl. Melati No. 8, Blok A', [['Ahmad Fauzi', 'L', 'Cirebon', '1978-03-15', 'Islam', 'PNS', 'Kawin', 'Kepala Keluarga'], ['Lilis Suryani', 'P', 'Cirebon', '1980-08-08', 'Islam', 'Mengurus Rumah Tangga', 'Kawin', 'Istri']]],
    [1, 'Hendra Wijaya', 'Jl. Melati No. 12, Blok A', [['Hendra Wijaya', 'L', 'Medan', '1988-12-05', 'Kristen', 'Karyawan BUMN', 'Kawin', 'Kepala Keluarga'], ['Grace Simanjuntak', 'P', 'Medan', '1990-01-17', 'Kristen', 'Perawat', 'Kawin', 'Istri']]],
    [1, 'Sumiati', 'Jl. Melati No. 15, Blok A', [['H. Darsono', 'L', 'Purworejo', '1954-05-21', 'Islam', 'Pensiunan', 'Kawin', 'Kepala Keluarga'], ['Sumiati', 'P', 'Purworejo', '1958-10-02', 'Islam', 'Mengurus Rumah Tangga', 'Kawin', 'Istri']]],
    [2, 'Rudi Hartono', 'Jl. Kenanga No. 2, Blok B', [['Rudi Hartono', 'L', 'Bandung', '1980-07-07', 'Islam', 'Pedagang', 'Kawin', 'Kepala Keluarga'], ['Nining Kurniasih', 'P', 'Bandung', '1983-02-14', 'Islam', 'Pedagang', 'Kawin', 'Istri'], ['Salsa Hartono', 'P', 'Bekasi', '2012-05-09', 'Islam', 'Pelajar', 'Belum Kawin', 'Anak']]],
    [2, 'Dewi Lestari', 'Jl. Kenanga No. 6, Blok B', [['Dewi Lestari', 'P', 'Semarang', '1995-03-03', 'Islam', 'Karyawan Swasta', 'Belum Kawin', 'Kepala Keluarga']]],
    [2, 'Agus Salim', 'Jl. Kenanga No. 9, Blok B', [['Agus Salim', 'L', 'Padang', '1970-09-19', 'Islam', 'Wiraswasta', 'Kawin', 'Kepala Keluarga'], ['Rosmawati', 'P', 'Padang', '1972-12-25', 'Islam', 'Mengurus Rumah Tangga', 'Kawin', 'Istri']]],
    [2, 'Yanti Rahayu', 'Jl. Kenanga No. 14, Blok B', [['Yanti Rahayu', 'P', 'Bekasi', '1987-04-28', 'Katolik', 'Bidan', 'Kawin', 'Kepala Keluarga'], ['Kevin Pratama', 'L', 'Bekasi', '2015-07-30', 'Katolik', 'Pelajar', 'Belum Kawin', 'Anak']]],
    [3, 'Joko Susilo', 'Jl. Anggrek No. 1, Blok C', [['Joko Susilo', 'L', 'Solo', '1976-01-10', 'Islam', 'Sopir', 'Kawin', 'Kepala Keluarga'], ['Endang Purwati', 'P', 'Solo', '1979-06-06', 'Islam', 'Penjahit', 'Kawin', 'Istri']]],
    [3, 'Rina Marlina', 'Jl. Anggrek No. 4, Blok C', [['Rina Marlina', 'P', 'Garut', '1990-10-10', 'Islam', 'Karyawan Swasta', 'Kawin', 'Kepala Keluarga'], ['Fajar Nugraha', 'L', 'Garut', '1989-03-21', 'Islam', 'Teknisi', 'Kawin', 'Suami']]],
    [3, 'Bambang Prakoso', 'Jl. Anggrek No. 7, Blok C', [['Bambang Prakoso', 'L', 'Yogyakarta', '1968-08-17', 'Islam', 'Pensiunan TNI', 'Kawin', 'Kepala Keluarga'], ['Sri Rejeki', 'P', 'Yogyakarta', '1970-04-04', 'Islam', 'Mengurus Rumah Tangga', 'Kawin', 'Istri'], ['Arif Prakoso', 'L', 'Bekasi', '1998-09-09', 'Islam', 'Karyawan Swasta', 'Belum Kawin', 'Anak']]],
    [3, 'Lina Kusuma', 'Jl. Anggrek No. 11, Blok C', [['Lina Kusuma', 'P', 'Jakarta', '1984-11-30', 'Buddha', 'Wiraswasta', 'Kawin', 'Kepala Keluarga']]],
  ];
  const hhIds = []; const resIds = {}; let seqR = 1;
  hh.forEach(([rt, kepala, alamat, members], i) => {
    const no_kk = `3275011${String(i + 1).padStart(3, '0')}0${rt}0${(i % 9) + 1}${String(2000 + i).slice(-3)}`.slice(0, 16).padEnd(16, '7');
    const id = ins('households', { no_kk, rt_id: rt, kepala_nama: kepala, alamat, status_domisili: i === 6 ? 'Kontrak/Sewa' : 'Tetap', telp: '08' + (1200000000 + i * 7731).toString().slice(0, 10) });
    hhIds.push(id);
    members.forEach(m => {
      const tg = m[3].replace(/-/g, '');
      const dd = parseInt(tg.slice(6, 8)) + (m[1] === 'P' ? 40 : 0);
      const nik = `327501${String(dd).padStart(2, '0')}${tg.slice(4, 6)}${tg.slice(2, 4)}${String(seqR++).padStart(4, '0')}`;
      resIds[m[0]] = ins('residents', { household_id: id, nik, nama: m[0], jk: m[1], tempat_lahir: m[2], tgl_lahir: m[3], agama: m[4], pekerjaan: m[5], status_kawin: m[6], hubungan: m[7], status: m[0] === 'H. Darsono' ? 'meninggal' : 'hidup' });
    });
  });
  const H = (kepala) => hhIds[hh.findIndex(x => x[1] === kepala)];

  // users
  const U = {};
  const mk = (username, pass, nama, role, jabatan, extra = {}) => { U[username] = ins('users', { username, password_hash: bcrypt.hashSync(pass, 10), nama, role, jabatan, rw_id: 1, phone: '0812' + String(Object.keys(U).length + 1).padStart(8, '3'), email: username + '@rw01-jakamulya.demo', created_at: now(), ...extra }); };
  mk('admin', 'admin123', 'Administrator Sistem', 'admin', 'Admin Sistem');
  mk('kelurahan', 'kelurahan123', 'Sri Wahyuni', 'kelurahan', 'Petugas Pelayanan Kelurahan Jakamulya', { rw_id: null });
  mk('ketuarw', 'ketuarw123', 'H. Sutrisno', 'ketua_rw', 'Ketua RW 01');
  mk('sekbendrw', 'sekbendrw123', 'Nur Hidayah', 'sekbend_rw', 'Sekretaris/Bendahara RW 01');
  mk('ketuart1', 'ketuart123', 'Ahmad Fauzi', 'ketua_rt', 'Ketua RT 001', { rt_id: 1, household_id: H('Ahmad Fauzi'), resident_id: resIds['Ahmad Fauzi'] });
  mk('ketuart2', 'ketuart123', 'Slamet Riyadi', 'ketua_rt', 'Ketua RT 002', { rt_id: 2 });
  mk('ketuart3', 'ketuart123', 'Teguh Prasetyo', 'ketua_rt', 'Ketua RT 003', { rt_id: 3 });
  mk('bendrt1', 'bendrt123', 'Wulan Sari', 'bendahara_rt', 'Bendahara RT 001', { rt_id: 1 });
  mk('bendrt2', 'bendrt123', 'Fitri Handayani', 'bendahara_rt', 'Bendahara RT 002', { rt_id: 2 });
  mk('bendrt3', 'bendrt123', 'Maya Anggraini', 'bendahara_rt', 'Bendahara RT 003', { rt_id: 3 });
  mk('warga', 'warga123', 'Budi Santoso', 'warga', 'Warga RT 001', { rt_id: 1, household_id: H('Budi Santoso'), resident_id: resIds['Budi Santoso'] });
  mk('warga2', 'warga123', 'Rudi Hartono', 'warga', 'Warga RT 002', { rt_id: 2, household_id: H('Rudi Hartono'), resident_id: resIds['Rudi Hartono'] });
  mk('warga3', 'warga123', 'Rina Marlina', 'warga', 'Warga RT 003', { rt_id: 3, household_id: H('Rina Marlina'), resident_id: resIds['Rina Marlina'] });

  // signatures
  const sigs = {};
  [['ketuarw', 'Ketua RW 01'], ['ketuart1', 'Ketua RT 001'], ['ketuart2', 'Ketua RT 002'], ['ketuart3', 'Ketua RT 003'], ['kelurahan', 'Petugas Kelurahan Jakamulya']].forEach(([u, jab], i) => {
    const file = `ttd_${u}_v1.png`; fs.writeFileSync(path.join(DATA, 'private', 'ttd', file), signaturePng(i + 3));
    const nama = db.prepare('SELECT nama FROM users WHERE id=?').get(U[u]).nama;
    sigs[u] = ins('signature_assets', { user_id: U[u], nama_pejabat: nama, jabatan: jab, file_path: file, versi: 1, is_active: 1, uploaded_by: U['admin'], uploaded_at: '2026-09-01 09:00:00' });
  });

  // letter types
  [['SKD', 'Surat Keterangan Domisili', 0], ['SKTM', 'Surat Keterangan Tidak Mampu', 1], ['SPSKCK', 'Surat Pengantar SKCK', 0], ['SKU', 'Surat Keterangan Usaha', 0], ['SPN', 'Surat Pengantar Nikah', 1], ['SKK', 'Surat Keterangan Kematian', 1], ['SKP', 'Surat Pengantar Pindah', 0], ['SPU', 'Surat Pengantar Umum', 0]]
    .forEach(([kode, nama, b]) => ins('letter_types', { kode, nama, butuh_kelurahan: b }));

  const letters = [
    { u: 'warga', r: 'Budi Santoso', jenis: 'SKD', kep: 'Persyaratan pembukaan rekening bank', status: 'terbit', d: '2026-10-05' },
    { u: 'warga', r: 'Budi Santoso', jenis: 'SPSKCK', kep: 'Melamar pekerjaan', status: 'diajukan', d: '2026-10-23' },
    { u: null, r: 'Siti Aminah', jenis: 'SKU', kep: 'Pengajuan KUR untuk usaha katering', status: 'diverifikasi_rt', d: '2026-10-21' },
    { u: 'warga2', r: 'Rudi Hartono', jenis: 'SKU', kep: 'Izin usaha warung sembako', status: 'diverifikasi_rw', d: '2026-10-18' },
    { u: null, r: 'Dewi Lestari', jenis: 'SKD', kep: 'Persyaratan kerja', status: 'dikembalikan', d: '2026-10-20', cat: 'Mohon lampirkan surat perjanjian sewa/kontrak rumah.' },
    { u: null, r: 'Joko Susilo', jenis: 'SKTM', kep: 'Keringanan biaya sekolah anak', status: 'ditolak', d: '2026-10-10', cat: 'Data tidak sesuai dengan hasil verifikasi lapangan.' },
    { u: 'warga3', r: 'Rina Marlina', jenis: 'SKD', kep: 'Persyaratan administrasi BPJS', status: 'terbit', d: '2026-10-12' },
    { u: 'warga3', r: 'Rina Marlina', jenis: 'SKTM', kep: 'Pengajuan bantuan pendidikan', status: 'diverifikasi_rw', d: '2026-10-22' },
  ];
  let regNo = 1; let suratNo = 0;
  const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  for (const L of letters) {
    const res = db.prepare('SELECT r.*, h.rt_id FROM residents r JOIN households h ON h.id=r.household_id WHERE r.nama=?').get(L.r);
    const rtU = { 1: 'ketuart1', 2: 'ketuart2', 3: 'ketuart3' }[res.rt_id];
    const t = (h) => `${L.d} ${h}`;
    const rec = { no_reg: `REG-2026-${String(regNo++).padStart(4, '0')}`, user_id: L.u ? U[L.u] : U[rtU], resident_id: res.id, household_id: res.household_id, rt_id: res.rt_id, jenis: L.jenis, keperluan: L.kep, keterangan: '', status: L.status, catatan: L.cat || null, created_at: t('08:15:00'), updated_at: t('10:00:00') };
    const after = ['diverifikasi_rt', 'diverifikasi_rw', 'terbit'];
    if (after.includes(L.status)) { rec.rt_verified_by = U[rtU]; rec.rt_verified_at = t('09:00:00'); }
    if (['diverifikasi_rw', 'terbit'].includes(L.status)) { rec.rw_verified_by = U['sekbendrw']; rec.rw_verified_at = t('13:00:00'); }
    if (L.status === 'terbit') { rec.approved_by = U['ketuarw']; rec.approved_at = t('15:00:00'); }
    const id = ins('letter_requests', rec);
    ins('letter_logs', { request_id: id, user_id: rec.user_id, aksi: 'Diajukan', catatan: L.kep, at: t('08:15:00') });
    if (rec.rt_verified_by) ins('letter_logs', { request_id: id, user_id: U[rtU], aksi: 'Diverifikasi RT', catatan: 'Data domisili sesuai', at: t('09:00:00') });
    if (rec.rw_verified_by) ins('letter_logs', { request_id: id, user_id: U['sekbendrw'], aksi: 'Diverifikasi RW', catatan: 'Lengkap', at: t('13:00:00') });
    if (L.status === 'dikembalikan') ins('letter_logs', { request_id: id, user_id: U[rtU], aksi: 'Dikembalikan untuk perbaikan', catatan: L.cat, at: t('11:00:00') });
    if (L.status === 'ditolak') ins('letter_logs', { request_id: id, user_id: U[rtU], aksi: 'Ditolak', catatan: L.cat, at: t('11:00:00') });
    if (L.status === 'terbit') {
      suratNo++; const m = parseInt(L.d.slice(5, 7));
      const rtKode = { 1: '001', 2: '002', 3: '003' }[res.rt_id];
      const nomor = `${String(suratNo).padStart(3, '0')}/${L.jenis}/RT-${rtKode}/RW-01/${roman[m - 1]}/2026`;
      ins('letter_logs', { request_id: id, user_id: U['ketuarw'], aksi: 'Disetujui & diterbitkan', catatan: nomor, at: t('15:00:00') });
      ins('issued_letters', { request_id: id, nomor, tanggal: L.d, file_path: null, verif_code: crypto.randomBytes(5).toString('hex').toUpperCase(), sig_rt_id: sigs[rtU], sig_rw_id: sigs['ketuarw'], signer_name: 'H. Sutrisno', signer_jabatan: 'Ketua RW 01', status: 'final', created_at: t('15:00:00') });
    }
  }
  ins('counters', { key: 'surat-2026', value: suratNo });
  ins('counters', { key: 'reg-2026', value: regNo - 1 });

  // dues
  const d1 = ins('dues_types', { nama: 'Iuran Kebersihan & Keamanan', nominal: 50000, periode: 'bulanan', level: 'RT', aktif: 1, keterangan: 'Sampah, keamanan lingkungan (satpam/ronda), per KK per bulan' });
  const d2 = ins('dues_types', { nama: 'Iuran Kas RW', nominal: 10000, periode: 'bulanan', level: 'RW', aktif: 1, keterangan: 'Kas kegiatan RW 01, per KK per bulan' });
  const activeHH = db.prepare("SELECT h.* FROM households h WHERE h.id IN (SELECT household_id FROM residents WHERE status='hidup')").all();
  const kwCount = {}; let rwKw = 0;
  const unpaid = new Set([`${H('Budi Santoso')}-2026-10`, `${H('Rudi Hartono')}-2026-10`, `${H('Dewi Lestari')}-2026-10`, `${H('Dewi Lestari')}-2026-09`, `${H('Joko Susilo')}-2026-10`, `${H('Agus Salim')}-2026-10`, `${H('Hendra Wijaya')}-2026-10`, `${H('Lina Kusuma')}-2026-10`, `${H('Lina Kusuma')}-2026-09`, `${H('Lina Kusuma')}-2026-08`]);
  let kasNo = 0;
  const kas = (o) => { kasNo++; return ins('cash_transactions', { status: 'disetujui', created_at: now(), checked_at: o.tanggal + ' 20:00:00', ...o }); };
  const rtK = (id) => ({ 1: '001', 2: '002', 3: '003' }[id]);
  for (const per of ['2026-08', '2026-09', '2026-10']) {
    for (const h of activeHH) {
      for (const [dt, nom, lvl] of [[d1, 50000, 'RT'], [d2, 10000, 'RW']]) {
        if (dt === d2 && per !== '2026-10') continue;
        const key = `${h.id}-${per}`;
        const paid = !unpaid.has(key);
        const inv = ins('dues_invoices', { dues_type_id: dt, household_id: h.id, periode: per, nominal: nom, status: paid ? 'lunas' : 'belum', created_at: per + '-01 07:00:00' });
        if (paid) {
          kwCount[h.rt_id] = (kwCount[h.rt_id] || 0) + 1;
          const no = `KW/RT${rtK(h.rt_id)}/2026/${String(kwCount[h.rt_id]).padStart(4, '0')}`;
          const tgl = `${per}-${String(5 + (h.id % 15)).padStart(2, '0')}`;
          const bend = { 1: 'bendrt1', 2: 'bendrt2', 3: 'bendrt3' }[h.rt_id];
          const pid = ins('payments', { invoice_id: inv, amount: nom, method: h.id % 3 === 0 ? 'Transfer' : 'Tunai', tanggal: tgl, receipt_no: no, received_by: U[bend], status: 'terverifikasi', created_by: U[bend], created_at: tgl + ' 19:00:00' });
          kas({ buku: lvl, rt_id: lvl === 'RT' ? h.rt_id : null, tanggal: tgl, no_bukti: no, jenis: 'masuk', kategori: 'Iuran Rutin', uraian: `${dt === d1 ? 'Iuran Kebersihan & Keamanan' : 'Iuran Kas RW'} ${per} - KK ${h.kepala_nama}`, amount: nom, created_by: U[bend], checked_by: lvl === 'RT' ? U[{ 1: 'ketuart1', 2: 'ketuart2', 3: 'ketuart3' }[h.rt_id]] : U['ketuarw'], ref_type: 'payment', ref_id: pid });
        }
      }
    }
  }
  // one pending confirmation from warga (transfer)
  const pend = db.prepare("SELECT id FROM dues_invoices WHERE household_id=? AND periode='2026-10' AND dues_type_id=?").get(H('Hendra Wijaya'), d1);
  kwCount[1]++;
  ins('payments', { invoice_id: pend.id, amount: 50000, method: 'Transfer', tanggal: '2026-10-24', receipt_no: null, ref: 'TRF-BCA-88213', status: 'menunggu', catatan: 'Konfirmasi transfer dari warga', created_by: null, created_at: '2026-10-24 20:11:00' });
  db.prepare("UPDATE dues_invoices SET status='menunggu' WHERE id=?").run(pend.id);
  ins('counters', { key: 'kw-1-2026', value: kwCount[1] - 1 }); ins('counters', { key: 'kw-2-2026', value: kwCount[2] || 0 }); ins('counters', { key: 'kw-3-2026', value: kwCount[3] || 0 });

  // kas other entries
  kas({ buku: 'RT', rt_id: 1, tanggal: '2026-08-01', no_bukti: 'SALDO-001', jenis: 'masuk', kategori: 'Saldo Awal', uraian: 'Saldo awal kas RT 001', amount: 500000, created_by: U['bendrt1'], checked_by: U['ketuart1'] });
  kas({ buku: 'RT', rt_id: 2, tanggal: '2026-08-01', no_bukti: 'SALDO-002', jenis: 'masuk', kategori: 'Saldo Awal', uraian: 'Saldo awal kas RT 002', amount: 750000, created_by: U['bendrt2'], checked_by: U['ketuart2'] });
  kas({ buku: 'RT', rt_id: 3, tanggal: '2026-08-01', no_bukti: 'SALDO-003', jenis: 'masuk', kategori: 'Saldo Awal', uraian: 'Saldo awal kas RT 003', amount: 400000, created_by: U['bendrt3'], checked_by: U['ketuart3'] });
  kas({ buku: 'RW', rt_id: null, tanggal: '2026-08-01', no_bukti: 'SALDO-RW', jenis: 'masuk', kategori: 'Saldo Awal', uraian: 'Saldo awal kas RW 01', amount: 3250000, created_by: U['sekbendrw'], checked_by: U['ketuarw'] });
  kas({ buku: 'RW', rt_id: null, tanggal: '2026-08-14', no_bukti: 'KRW-001', jenis: 'keluar', kategori: 'Kegiatan', uraian: 'Perlengkapan lomba HUT RI ke-81', amount: 1250000, created_by: U['sekbendrw'], checked_by: U['ketuarw'] });
  kas({ buku: 'RW', rt_id: null, tanggal: '2026-08-20', no_bukti: 'MRW-001', jenis: 'masuk', kategori: 'Donasi', uraian: 'Donasi warga untuk kegiatan 17 Agustus', amount: 900000, created_by: U['sekbendrw'], checked_by: U['ketuarw'] });
  kas({ buku: 'RW', rt_id: null, tanggal: '2026-09-10', no_bukti: 'KRW-002', jenis: 'keluar', kategori: 'Operasional', uraian: 'Honor petugas kebersihan September', amount: 600000, created_by: U['sekbendrw'], checked_by: U['ketuarw'] });
  kas({ buku: 'RW', rt_id: null, tanggal: '2026-10-10', no_bukti: 'KRW-003', jenis: 'keluar', kategori: 'Operasional', uraian: 'Honor petugas kebersihan Oktober', amount: 600000, created_by: U['sekbendrw'], checked_by: U['ketuarw'] });
  kas({ buku: 'RW', rt_id: null, tanggal: '2026-10-22', no_bukti: 'KRW-004', jenis: 'keluar', kategori: 'Pemeliharaan', uraian: 'Perbaikan lampu jalan Jl. Kenanga', amount: 350000, created_by: U['sekbendrw'], status: 'menunggu', checked_by: null, checked_at: null });
  kas({ buku: 'RT', rt_id: 1, tanggal: '2026-09-15', no_bukti: 'KRT1-001', jenis: 'keluar', kategori: 'Kegiatan', uraian: 'Konsumsi kerja bakti RT 001', amount: 275000, created_by: U['bendrt1'], checked_by: U['ketuart1'] });
  kas({ buku: 'RT', rt_id: 2, tanggal: '2026-09-20', no_bukti: 'KRT2-001', jenis: 'keluar', kategori: 'Keamanan', uraian: 'Insentif ronda malam RT 002', amount: 400000, created_by: U['bendrt2'], checked_by: U['ketuart2'] });
  kas({ buku: 'RT', rt_id: 3, tanggal: '2026-10-03', no_bukti: 'KRT3-001', jenis: 'keluar', kategori: 'Pemeliharaan', uraian: 'Pengecatan pos ronda RT 003', amount: 320000, created_by: U['bendrt3'], checked_by: U['ketuart3'] });

  // takziah
  const rule = ins('condolence_rules', { nama: 'Iuran Takziah RW 01 (kesepakatan warga 2025)', nominal_default: 50000, sifat: 'wajib', metode: 'per KK', berlaku_mulai: '2025-01-01', cakupan_rt_id: null, aktif: 1, catatan: 'Disepakati pada rapat warga RW 01 tanggal 12 Januari 2025. KK kurang mampu boleh membayar sesuai kemampuan (sukarela).' });
  ins('condolence_rules', { nama: 'Iuran Takziah Sukarela RT 003', nominal_default: 0, sifat: 'sukarela', metode: 'per KK', berlaku_mulai: '2026-01-01', cakupan_rt_id: 3, aktif: 1, catatan: 'RT 003 menerapkan iuran takziah sukarela.' });
  const ev = ins('condolence_events', { kode: 'TKZ-2026-001', tanggal: '2026-10-19', almarhum: 'H. Darsono', usia: 72, rt_id: 1, household_id: H('Sumiati'), keluarga_kontak: 'Ibu Sumiati (istri) – 0812-9000-1122', alamat: 'Jl. Melati No. 15, Blok A, RT 001/RW 01', rule_id: rule, nominal_target: 50000, sifat: 'wajib', status: 'penyaluran', catatan: 'Dimakamkan di TPU Pedurenan, 19 Oktober 2026 ba\'da Ashar.', review_status: 'diajukan', created_by: U['ketuart1'], created_at: '2026-10-19 08:30:00' });
  const contribs = [['Budi Santoso', 50000, '2026-10-20', 'Tunai'], ['Siti Aminah', 50000, '2026-10-20', 'Transfer'], ['Ahmad Fauzi', 25000, '2026-10-21', 'Tunai'], ['Hendra Wijaya', 50000, '2026-10-21', 'Tunai']];
  let takNo = 0;
  for (const h of activeHH.filter(x => x.rt_id === 1 && x.id !== H('Sumiati'))) {
    const c = contribs.find(x => H(x[0]) === h.id);
    if (c) {
      takNo++;
      const no = `TAK/RT001/2026/${String(takNo).padStart(4, '0')}`;
      const cid = ins('condolence_contributions', { event_id: ev, household_id: h.id, expected: 50000, amount: c[1], tanggal: c[2], method: c[3], receipt_no: no, received_by: U['bendrt1'], status: c[1] >= 50000 ? 'lunas' : 'sukarela', verified: 'terverifikasi', catatan: c[1] < 50000 ? 'Membayar sesuai kemampuan' : '', created_at: c[2] + ' 19:30:00' });
      kas({ buku: 'RT', rt_id: 1, tanggal: c[2], no_bukti: no, jenis: 'masuk', kategori: 'Takziah', uraian: `Iuran takziah TKZ-2026-001 - KK ${h.kepala_nama}`, amount: c[1], created_by: U['bendrt1'], checked_by: U['ketuart1'], ref_type: 'takziah_in', ref_id: cid });
    } else ins('condolence_contributions', { event_id: ev, household_id: h.id, expected: 50000, amount: 0, status: 'belum', verified: 'menunggu', created_at: now() });
  }
  ins('counters', { key: 'tak-1-2026', value: takNo }); ins('counters', { key: 'tkz-2026', value: 1 });
  const dis = ins('condolence_disbursements', { event_id: ev, jenis: 'bantuan', amount: 150000, tanggal: '2026-10-21', penerima: 'Ibu Sumiati (istri almarhum)', saksi: 'Ahmad Fauzi (Ketua RT 001), Wulan Sari (Bendahara RT 001)', bukti: 'Berita acara serah terima BA-TKZ-001', keterangan: 'Santunan duka tahap 1', created_by: U['bendrt1'], created_at: '2026-10-21 16:00:00' });
  kas({ buku: 'RT', rt_id: 1, tanggal: '2026-10-21', no_bukti: 'TAK-OUT-001', jenis: 'keluar', kategori: 'Takziah', uraian: 'Bantuan takziah diserahkan kepada keluarga Alm. H. Darsono', amount: 150000, created_by: U['bendrt1'], checked_by: U['ketuart1'], ref_type: 'takziah_out', ref_id: dis });

  // complaints
  const comp = [
    ['warga', 1, 'Kebersihan', 'Sampah menumpuk di ujung Jl. Melati', 'Sudah 4 hari sampah tidak diangkut, mulai bau dan mengundang lalat.', 'Ujung Jl. Melati dekat pos ronda', 'diproses', '2026-10-20'],
    ['warga2', 2, 'Infrastruktur', 'Lampu jalan mati', 'Lampu PJU di depan rumah No. 6 mati sejak minggu lalu, jalan gelap saat malam.', 'Jl. Kenanga No. 6', 'baru', '2026-10-23'],
    ['warga3', 3, 'Keamanan', 'Parkir liar menutup akses jalan', 'Ada mobil yang parkir setiap malam di mulut gang sehingga motor sulit lewat.', 'Mulut gang Jl. Anggrek', 'selesai', '2026-10-02'],
    ['warga', 1, 'Saluran Air', 'Got tersumbat saat hujan', 'Saluran air depan rumah meluap saat hujan deras.', 'Jl. Melati No. 3', 'baru', '2026-10-24'],
  ];
  comp.forEach((c, i) => {
    const id = ins('complaints', { kode: `ADU-2026-${String(i + 1).padStart(3, '0')}`, user_id: U[c[0]], rt_id: c[1], kategori: c[2], judul: c[3], isi: c[4], lokasi: c[5], status: c[6], is_private: 1, created_at: c[7] + ' 07:30:00', updated_at: c[7] + ' 07:30:00' });
    const rtU = { 1: 'ketuart1', 2: 'ketuart2', 3: 'ketuart3' }[c[1]];
    if (c[6] === 'diproses') ins('complaint_responses', { complaint_id: id, user_id: U[rtU], isi: 'Terima kasih laporannya. Sudah kami koordinasikan dengan petugas kebersihan, dijadwalkan diangkut besok pagi.', status_baru: 'diproses', at: '2026-10-20 10:00:00' });
    if (c[6] === 'selesai') { ins('complaint_responses', { complaint_id: id, user_id: U[rtU], isi: 'Sudah ditegur dan pemilik mobil bersedia parkir di lahan kosong.', status_baru: 'diproses', at: '2026-10-03 09:00:00' }); ins('complaint_responses', { complaint_id: id, user_id: U[rtU], isi: 'Dicek kembali 3 hari berturut-turut, akses jalan sudah lancar. Pengaduan ditutup.', status_baru: 'selesai', at: '2026-10-06 20:00:00' }); }
  });
  ins('counters', { key: 'adu-2026', value: comp.length });

  // announcements
  [
    ['Kerja Bakti Bersih Lingkungan RW 01', 'Diharapkan seluruh warga RW 01 mengikuti kerja bakti membersihkan saluran air menjelang musim hujan. Mohon membawa peralatan masing-masing (cangkul, sapu lidi, karung).', 'Kerja Bakti', null, '2026-11-01 07:00', 'Seluruh wilayah RW 01, kumpul di Balai Warga', 'ketuarw'],
    ['Berita Duka: Alm. H. Darsono (RT 001)', 'Innalillahi wa inna ilaihi raji\'un. Telah berpulang H. Darsono, warga RT 001 (Jl. Melati No. 15), pada 19 Oktober 2026. Iuran takziah sesuai kesepakatan warga Rp 50.000/KK dapat diserahkan ke Bendahara RT 001.', 'Takziah', 1, '2026-10-19 15:30', 'Rumah duka Jl. Melati No. 15', 'ketuart1'],
    ['Rapat Pengurus & Warga RW 01', 'Agenda: evaluasi keamanan lingkungan, rencana pembangunan pos ronda, dan laporan keuangan triwulan III.', 'Rapat', null, '2026-11-08 19:30', 'Balai Warga RW 01', 'ketuarw'],
    ['Posyandu Balita & Lansia', 'Posyandu rutin bulanan untuk balita dan lansia. Bawa buku KIA/KMS.', 'Kegiatan', 2, '2026-11-05 08:00', 'Pos Posyandu RT 002', 'ketuart2'],
    ['Jadwal Pengambilan Sampah Baru', 'Mulai November, pengangkutan sampah dilakukan setiap Senin, Rabu, dan Sabtu pagi.', 'Pengumuman', null, null, null, 'sekbendrw'],
  ].forEach(a => ins('announcements', { judul: a[0], isi: a[1], jenis: a[2], target_rt_id: a[3], tanggal_kegiatan: a[4], lokasi: a[5], tayang_mulai: '2026-10-15', tayang_selesai: '2026-12-31', created_by: U[a[6]], created_at: '2026-10-' + (15 + Math.floor(Math.random() * 9)) + ' 08:00:00' }));

  // audit
  [['admin', 'SEED', 'sistem', '', 'Inisialisasi database demo'], ['admin', 'UPLOAD_TTD', 'signature_assets', '1', 'Unggah TTD Ketua RW 01 v1'], ['ketuarw', 'SETUJUI_SURAT', 'letter_requests', '1', 'Surat SKD diterbitkan'], ['bendrt1', 'CATAT_TAKZIAH', 'condolence_contributions', '1', 'Kontribusi takziah TAK/RT001/2026/0001']]
    .forEach(([u, aksi, ent, id, det]) => ins('audit_logs', { user_id: U[u], username: u, aksi, entitas: ent, entitas_id: id, detail: det, at: now() }));
});
tx();
console.log('Seed selesai: data/app.db');
