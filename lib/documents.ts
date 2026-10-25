import path from 'path';
import fs from 'fs';
import { all, one, run, PATHS, settings } from './db';
import { createDoc, kop, heading, kv, table, signatures, note, finalize, placeDate, M, CW } from './pdf';
import { rupiah, angka, tgl, tglPendek, maskNik, terbilang, periodeLabel, STATUS_SURAT, umur } from './util';

const sigPath = (id?: number | null) => { if (!id) return null; const s = one('SELECT file_path FROM signature_assets WHERE id=?', id); return s ? path.join(PATHS.ttd, s.file_path) : null; };
export const activeSig = (userId?: number | null) => userId ? one('SELECT * FROM signature_assets WHERE user_id=? AND is_active=1 ORDER BY versi DESC', userId) : undefined;
const ketuaRtUser = (rtId: number) => one("SELECT * FROM users WHERE role='ketua_rt' AND rt_id=? AND status='aktif' ORDER BY id LIMIT 1", rtId);
const ketuaRwUser = () => one("SELECT * FROM users WHERE role='ketua_rw' AND status='aktif' ORDER BY id LIMIT 1");
const bendRtUser = (rtId: number) => one("SELECT * FROM users WHERE role='bendahara_rt' AND rt_id=? AND status='aktif' ORDER BY id LIMIT 1", rtId);

// ---------------- SURAT ----------------
export async function suratPdf(requestId: number, by: string): Promise<Buffer> {
  const r = one(`SELECT lr.*, lt.nama jenis_nama, lt.butuh_kelurahan, rt.kode rt_kode, rt.ketua rt_ketua, i.nomor, i.tanggal tgl_terbit, i.verif_code, i.sig_rt_id, i.sig_rw_id,
      res.nama, res.nik, res.jk, res.tempat_lahir, res.tgl_lahir, res.agama, res.pekerjaan, res.status_kawin, h.alamat, h.no_kk, h.status_domisili
    FROM letter_requests lr JOIN letter_types lt ON lt.kode=lr.jenis JOIN rt ON rt.id=lr.rt_id LEFT JOIN issued_letters i ON i.request_id=lr.id
    JOIN residents res ON res.id=lr.resident_id JOIN households h ON h.id=lr.household_id WHERE lr.id=?`, requestId);
  const rw = one('SELECT * FROM rw WHERE id=1');
  const kel = one('SELECT * FROM kelurahan WHERE id=1');
  const doc = createDoc(r.jenis_nama);
  kop(doc, { rtKode: r.rt_kode });
  heading(doc, r.jenis_nama.toUpperCase(), `Nomor: ${r.nomor || '(belum diterbitkan)'}`);
  doc.font('Helvetica').fontSize(10.5).text(`Yang bertanda tangan di bawah ini, Ketua RT ${r.rt_kode} RW ${rw.kode} Kelurahan ${kel.nama}, Kecamatan ${kel.kecamatan}, ${kel.kota}, dengan ini menerangkan bahwa:`, M, doc.y, { width: CW, align: 'justify', lineGap: 2 });
  doc.moveDown(0.6);
  kv(doc, [
    ['Nama Lengkap', r.nama], ['NIK', r.nik], ['No. KK', r.no_kk], ['Tempat/Tgl. Lahir', `${r.tempat_lahir}, ${tgl(r.tgl_lahir)}`],
    ['Jenis Kelamin', r.jk === 'L' ? 'Laki-laki' : 'Perempuan'], ['Agama', r.agama], ['Status Perkawinan', r.status_kawin], ['Pekerjaan', r.pekerjaan],
    ['Alamat', `${r.alamat}, RT ${r.rt_kode}/RW ${rw.kode}, Kel. ${kel.nama}, Kec. ${kel.kecamatan}, ${kel.kota}`], ['Status Domisili', r.status_domisili],
  ]);
  doc.moveDown(0.4);
  const isi: Record<string, string> = {
    SKD: `Orang tersebut di atas benar merupakan warga yang berdomisili di wilayah RT ${r.rt_kode} RW ${rw.kode} Kelurahan ${kel.nama} sesuai data administrasi kami.`,
    SKTM: `Orang tersebut di atas benar warga kami dan berdasarkan pengamatan pengurus lingkungan termasuk keluarga kurang mampu secara ekonomi.`,
    SPSKCK: `Orang tersebut di atas benar warga kami, berkelakuan baik, dan sepanjang pengetahuan kami tidak pernah terlibat tindak pidana maupun perkara di lingkungan.`,
    SKU: `Orang tersebut di atas benar warga kami dan menjalankan kegiatan usaha di wilayah RT ${r.rt_kode} RW ${rw.kode} Kelurahan ${kel.nama}.`,
    SPN: `Orang tersebut di atas benar warga kami dan bermaksud melangsungkan pernikahan; surat ini sebagai pengantar ke Kelurahan/KUA.`,
    SKK: `Dengan ini kami menerangkan peristiwa kematian warga sebagaimana keterangan pemohon untuk diproses lebih lanjut di Kelurahan.`,
    SKP: `Orang tersebut di atas benar warga kami dan bermaksud pindah domisili; surat ini sebagai pengantar pengurusan pindah.`,
    SPU: `Orang tersebut di atas benar warga kami. Surat pengantar ini diberikan untuk keperluan administrasi lebih lanjut.`,
  };
  doc.fontSize(10.5).text(isi[r.jenis] || isi.SPU, M, doc.y, { width: CW, align: 'justify', lineGap: 2 });
  doc.moveDown(0.5);
  doc.text('Surat keterangan/pengantar ini diberikan untuk keperluan:', M, doc.y, { width: CW });
  doc.font('Helvetica-Bold').text(r.keperluan || '-', M + 20, doc.y + 2, { width: CW - 20 });
  doc.font('Helvetica').moveDown(0.5);
  doc.text('Demikian surat ini dibuat dengan sebenarnya untuk dapat dipergunakan sebagaimana mestinya.', M, doc.y, { width: CW, align: 'justify' });
  doc.moveDown(1);
  const rtU = ketuaRtUser(r.rt_id); const rwU = ketuaRwUser();
  doc.text(placeDate(r.tgl_terbit || undefined), M + CW / 2, doc.y, { width: CW / 2, align: 'center' });
  signatures(doc, [
    { label: 'Mengetahui,', title: `Ketua RW ${rw.kode}`, name: rwU?.nama || rw.ketua, img: r.nomor ? sigPath(r.sig_rw_id) : null },
    { label: ' ', title: `Ketua RT ${r.rt_kode}`, name: rtU?.nama || r.rt_ketua, img: r.nomor ? sigPath(r.sig_rt_id) : null },
  ]);
  doc.moveDown(0.5);
  if (r.verif_code && settings().tampilkan_kode_verifikasi !== '0') note(doc, `Dokumen ini diterbitkan secara elektronik oleh Sistem Administrasi RT RW01 Jakamulya. Kode verifikasi: ${r.verif_code} - cek keaslian di menu Arsip Surat / halaman /verifikasi. Tanda tangan pada dokumen ini adalah tanda tangan visual (gambar unggahan), bukan tanda tangan elektronik tersertifikasi.`);
  if (r.butuh_kelurahan) note(doc, 'Jenis surat ini telah diproses/disetujui oleh Petugas Kelurahan Jakamulya sesuai alur layanan.');
  return finalize(doc, { by, code: r.verif_code, docNo: r.nomor });
}

export async function ensureArsip(requestId: number, by: string) {
  const i = one('SELECT * FROM issued_letters WHERE request_id=?', requestId);
  if (!i) return null;
  const fname = i.file_path || `${i.nomor.replace(/[^A-Za-z0-9]+/g, '_')}.pdf`;
  const fp = path.join(PATHS.arsip, fname);
  if (!fs.existsSync(fp)) { fs.writeFileSync(fp, await suratPdf(requestId, by)); }
  if (!i.file_path) run('UPDATE issued_letters SET file_path=? WHERE id=?', fname, i.id);
  return fp;
}

// ---------------- KUITANSI ----------------
function kuitansiLayout(doc: any, d: { judul: string; nomor: string; dari: string; alamat: string; jumlah: number; untuk: string; metode: string; tanggal: string; ref?: string; penerima: string; penerimaJab: string; sig?: string | null; status?: string }) {
  heading(doc, d.judul, `Nomor: ${d.nomor}`);
  kv(doc, [['Telah diterima dari', d.dari], ['Alamat/RT/RW', d.alamat], ['Uang sejumlah', rupiah(d.jumlah)], ['Terbilang', terbilang(d.jumlah)], ['Untuk', d.untuk], ['Metode pembayaran', d.metode + (d.ref ? ` (Ref: ${d.ref})` : '')], ['Tanggal penerimaan', tgl(d.tanggal)]], 140);
  const y = doc.y + 4;
  doc.rect(M + 20, y, 200, 30).lineWidth(1.5).stroke();
  doc.font('Helvetica-Bold').fontSize(14).text(rupiah(d.jumlah), M + 20, y + 8, { width: 200, align: 'center' });
  if (d.status === 'dibatalkan') { doc.save().rotate(-20, { origin: [300, 300] }).fontSize(48).fillColor('#cc0000').opacity(0.35).text('DIBATALKAN', 120, 300).restore(); doc.fillColor('#000').opacity(1); }
  doc.y = y + 44; doc.font('Helvetica').fontSize(10);
  doc.text(placeDate(d.tanggal), M + CW / 2, doc.y, { width: CW / 2, align: 'center' });
  signatures(doc, [{ label: ' ', title: 'Kontributor/Pembayar (opsional)', name: d.dari }, { label: ' ', title: `Penerima/${d.penerimaJab}`, name: d.penerima, img: d.sig || null }]);
  note(doc, 'Kuitansi dibuat otomatis oleh aplikasi. Untuk pembayaran digital, nomor referensi transaksi dicantumkan dan bukti transfer disimpan sebagai lampiran.');
}

export async function kuitansiIuranPdf(paymentId: number, by: string) {
  const p = one(`SELECT p.*, i.periode, i.nominal, dt.nama dues_nama, h.kepala_nama, h.alamat, h.no_kk, rt.kode rt_kode, u.nama penerima, u.jabatan
    FROM payments p JOIN dues_invoices i ON i.id=p.invoice_id JOIN dues_types dt ON dt.id=i.dues_type_id JOIN households h ON h.id=i.household_id JOIN rt ON rt.id=h.rt_id LEFT JOIN users u ON u.id=p.received_by WHERE p.id=?`, paymentId);
  const doc = createDoc('Kuitansi Iuran');
  kop(doc, { rtKode: p.rt_kode });
  kuitansiLayout(doc, { judul: 'KUITANSI / TANDA TERIMA IURAN WARGA', nomor: p.receipt_no || '(menunggu verifikasi)', dari: `${p.kepala_nama} (KK ${maskNik(p.no_kk)})`, alamat: `${p.alamat}, RT ${p.rt_kode}/RW 01`, jumlah: p.amount, untuk: `${p.dues_nama} periode ${periodeLabel(p.periode)}`, metode: p.method, ref: p.ref, tanggal: p.tanggal, penerima: p.penerima || '-', penerimaJab: p.jabatan || 'Bendahara', status: p.status });
  return finalize(doc, { by, docNo: p.receipt_no });
}

export async function kuitansiTakziahPdf(contribId: number, by: string) {
  const c = one(`SELECT c.*, e.kode ev_kode, e.tanggal ev_tgl, e.almarhum, h.kepala_nama, h.alamat, h.no_kk, rt.kode rt_kode, u.nama penerima, u.jabatan
    FROM condolence_contributions c JOIN condolence_events e ON e.id=c.event_id JOIN households h ON h.id=c.household_id JOIN rt ON rt.id=h.rt_id LEFT JOIN users u ON u.id=c.received_by WHERE c.id=?`, contribId);
  const doc = createDoc('Kuitansi Takziah');
  kop(doc, { rtKode: c.rt_kode });
  kuitansiLayout(doc, { judul: 'KWITANSI / TANDA TERIMA KONTRIBUSI TAKZIAH', nomor: c.receipt_no, dari: `${c.kepala_nama} (KK ${maskNik(c.no_kk)})`, alamat: `${c.alamat}, RT ${c.rt_kode}/RW 01`, jumlah: c.amount, untuk: `Kontribusi iuran/bantuan takziah (${c.ev_kode}) atas kejadian tanggal ${tglPendek(c.ev_tgl)} - Alm. ${c.almarhum}`, metode: c.method, ref: c.ref, tanggal: c.tanggal, penerima: c.penerima || '-', penerimaJab: c.jabatan || 'Bendahara', status: c.status });
  return finalize(doc, { by, docNo: c.receipt_no });
}

// ---------------- LAPORAN TAKZIAH ----------------
export function takziahSummary(eventId: number) {
  const masuk = one("SELECT COALESCE(SUM(amount),0) s, COUNT(*) n FROM condolence_contributions WHERE event_id=? AND status IN ('lunas','sukarela') AND verified='terverifikasi'", eventId);
  const bantuan = one("SELECT COALESCE(SUM(amount),0) s FROM condolence_disbursements WHERE event_id=? AND jenis='bantuan'", eventId).s;
  const biaya = one("SELECT COALESCE(SUM(amount),0) s FROM condolence_disbursements WHERE event_id=? AND jenis='biaya'", eventId).s;
  const target = one("SELECT COALESCE(SUM(expected),0) s FROM condolence_contributions WHERE event_id=? AND status!='dibatalkan'", eventId).s;
  return { masuk: masuk.s, n: masuk.n, bantuan, biaya, saldo: masuk.s - bantuan - biaya, target };
}
export async function laporanTakziahPdf(eventId: number, by: string) {
  const e = one('SELECT e.*, rt.kode rt_kode, r.nama rule_nama FROM condolence_events e JOIN rt ON rt.id=e.rt_id LEFT JOIN condolence_rules r ON r.id=e.rule_id WHERE e.id=?', eventId);
  const kel = one('SELECT * FROM kelurahan WHERE id=1');
  const rows = all(`SELECT c.*, h.kepala_nama, h.no_kk FROM condolence_contributions c JOIN households h ON h.id=c.household_id WHERE c.event_id=? ORDER BY c.tanggal IS NULL, c.tanggal, c.id`, eventId);
  const dis = all('SELECT * FROM condolence_disbursements WHERE event_id=? ORDER BY tanggal', eventId);
  const s = takziahSummary(eventId);
  const doc = createDoc('Laporan Takziah');
  kop(doc, { rtKode: e.rt_kode });
  heading(doc, 'LAPORAN PENERIMAAN DAN PENYALURAN IURAN TAKZIAH KEMATIAN', `No. Laporan: LAP-${e.kode}`);
  kv(doc, [['Kelurahan / RW / RT', `${kel.nama} / RW 01 / RT ${e.rt_kode}`], ['Kejadian', `${e.kode} - Alm. ${e.almarhum}${e.usia ? ` (${e.usia} th)` : ''}`], ['Tanggal kejadian', tgl(e.tanggal)], ['Aturan iuran', `${e.rule_nama || '-'} (${e.sifat}${e.nominal_target ? ', usulan ' + rupiah(e.nominal_target) + '/KK' : ''})`], ['Status persetujuan', e.review_status === 'disetujui' ? `Disetujui ${tgl(e.reviewed_at)}` : e.review_status === 'diajukan' ? 'Menunggu pemeriksaan Ketua RT/RW' : 'Draft']], 130);
  doc.font('Helvetica-Bold').fontSize(10).text('A. Daftar Kontribusi', M, doc.y + 4); doc.moveDown(0.3);
  table(doc, [{ h: 'No.', w: 28, align: 'center' }, { h: 'Nama/KK Kontributor', w: 150 }, { h: 'Tanggal', w: 62 }, { h: 'Nominal (Rp)', w: 70, align: 'right' }, { h: 'Metode', w: 50 }, { h: 'No. Kuitansi', w: 115 }, { h: 'Status', w: 60 }],
    rows.map((r, i) => [String(i + 1), `${r.kepala_nama} / ${maskNik(r.no_kk)}`, tglPendek(r.tanggal), angka(r.amount), r.method || '-', r.receipt_no || '-', r.status === 'belum' ? 'Belum bayar' : r.verified === 'terverifikasi' ? 'Terverifikasi' : r.status]),
    { total: ['', 'TOTAL PENERIMAAN', '', angka(s.masuk), '', '', ''] });
  doc.font('Helvetica-Bold').fontSize(10).text('B. Penyaluran & Biaya', M, doc.y); doc.moveDown(0.3);
  table(doc, [{ h: 'Tanggal', w: 60 }, { h: 'Jenis', w: 50 }, { h: 'Penerima', w: 120 }, { h: 'Saksi', w: 130 }, { h: 'Bukti', w: 100 }, { h: 'Nominal (Rp)', w: 75, align: 'right' }],
    dis.map(d => [tglPendek(d.tanggal), d.jenis === 'biaya' ? 'Biaya sah' : 'Bantuan', d.penerima, d.saksi || '-', d.bukti || '-', angka(d.amount)]));
  doc.font('Helvetica-Bold').fontSize(10).text('C. Ringkasan Keuangan (Rekonsiliasi)', M, doc.y); doc.moveDown(0.3);
  table(doc, [{ h: 'Uraian', w: 300 }, { h: 'Nominal (Rp)', w: 120, align: 'right' }], [['Total penerimaan', angka(s.masuk)], ['Total penyaluran kepada keluarga', angka(s.bantuan)], ['Biaya sah (jika ada)', angka(s.biaya)]], { total: ['Saldo akhir', angka(s.saldo)] });
  if (e.review_note) note(doc, `Catatan pemeriksa: ${e.review_note}`);
  note(doc, 'Rumus: Saldo = total penerimaan - total penyaluran - biaya sah. Angka dihitung otomatis dari transaksi terverifikasi; koreksi dicatat sebagai jejak, bukan dihapus.');
  const rtU = ketuaRtUser(e.rt_id); const bU = bendRtUser(e.rt_id); const kel_ = e.keluarga_kontak?.split(/ [–-] /)[0]?.trim();
  doc.text(placeDate(), M + CW / 2, doc.y, { width: CW / 2, align: 'center' });
  signatures(doc, [
    { label: 'Dibuat oleh', title: 'Bendahara', name: bU?.nama || '' },
    { label: 'Diperiksa', title: `Ketua RT ${e.rt_kode}`, name: rtU?.nama || '', img: e.review_status === 'disetujui' ? (activeSig(rtU?.id) ? path.join(PATHS.ttd, activeSig(rtU?.id).file_path) : null) : null },
    { label: 'Diterima/Disaksikan', title: 'Keluarga', name: kel_ || '' },
  ]);
  return finalize(doc, { by, docNo: `LAP-${e.kode}` });
}

// ---------------- LAPORAN KAS ----------------
export async function laporanKasPdf(f: { buku: string; rt_id?: number | null; from: string; to: string }, by: string) {
  const where = f.buku === 'RW' ? "buku='RW'" : 'buku=\'RT\' AND rt_id=' + Number(f.rt_id);
  const rtKode = f.buku === 'RT' ? one('SELECT kode FROM rt WHERE id=?', f.rt_id)?.kode : null;
  const awal = one(`SELECT COALESCE(SUM(CASE WHEN jenis='masuk' THEN amount ELSE -amount END),0) s FROM cash_transactions WHERE ${where} AND status='disetujui' AND tanggal < ?`, f.from).s;
  const rows = all(`SELECT * FROM cash_transactions WHERE ${where} AND status='disetujui' AND tanggal BETWEEN ? AND ? ORDER BY tanggal, id`, f.from, f.to);
  let saldo = awal, tin = 0, tout = 0;
  const data = rows.map(r => { const i = r.jenis === 'masuk' ? r.amount : 0, o = r.jenis === 'keluar' ? r.amount : 0; tin += i; tout += o; saldo += i - o; return [tglPendek(r.tanggal), r.no_bukti, `${r.uraian}`, r.kategori, angka(i), angka(o), angka(saldo)]; });
  const doc = createDoc('Laporan Kas');
  kop(doc, { rtKode });
  heading(doc, `LAPORAN KAS WILAYAH ${f.buku === 'RW' ? 'RW 01' : 'RT ' + rtKode + ' / RW 01'}`, `Periode ${tgl(f.from)} s.d. ${tgl(f.to)}`);
  table(doc, [{ h: 'Tanggal', w: 55 }, { h: 'No. Bukti', w: 75 }, { h: 'Uraian', w: 160 }, { h: 'Kategori', w: 60 }, { h: 'Pemasukan (Rp)', w: 65, align: 'right' }, { h: 'Pengeluaran (Rp)', w: 65, align: 'right' }, { h: 'Saldo (Rp)', w: 65, align: 'right' }],
    [[tglPendek(f.from), '-', 'Saldo awal periode', '-', angka(awal), '0', angka(awal)], ...data], { total: ['', '', 'TOTAL PERIODE', '', angka(tin), angka(tout), angka(saldo)] });
  note(doc, `Saldo awal (${angka(awal)}) + total pemasukan (${angka(tin)}) - total pengeluaran (${angka(tout)}) = saldo akhir (${angka(saldo)}). Hanya transaksi berstatus disetujui yang dihitung.`);
  doc.text(placeDate(), M + CW / 2, doc.y, { width: CW / 2, align: 'center' });
  const maker = f.buku === 'RW' ? one("SELECT nama FROM users WHERE role='sekbend_rw' LIMIT 1")?.nama : bendRtUser(Number(f.rt_id))?.nama;
  const checker = f.buku === 'RW' ? ketuaRwUser()?.nama : ketuaRtUser(Number(f.rt_id))?.nama;
  signatures(doc, [{ label: 'Dibuat oleh', title: 'Bendahara', name: maker || '' }, { label: 'Diperiksa oleh', title: f.buku === 'RW' ? 'Ketua RW 01' : `Ketua RT ${rtKode}`, name: checker || '' }]);
  return finalize(doc, { by, docNo: `KAS-${f.buku}${rtKode || ''}-${f.from}-${f.to}` });
}

// ---------------- LAPORAN WARGA ----------------
export async function laporanWargaPdf(f: { rt_id?: number | null; full?: boolean }, by: string) {
  const rows = all(`SELECT r.*, h.no_kk, h.alamat, h.status_domisili, rt.kode rt_kode FROM residents r JOIN households h ON h.id=r.household_id JOIN rt ON rt.id=h.rt_id WHERE r.status='hidup' ${f.rt_id ? 'AND h.rt_id=' + Number(f.rt_id) : ''} ORDER BY rt.kode, h.id, r.id`);
  const kk = one(`SELECT COUNT(*) n FROM households ${f.rt_id ? 'WHERE rt_id=' + Number(f.rt_id) : ''}`).n;
  const doc = createDoc('Daftar Warga');
  kop(doc, { rtKode: f.rt_id ? one('SELECT kode FROM rt WHERE id=?', f.rt_id)?.kode : null });
  heading(doc, 'DAFTAR WARGA', f.rt_id ? `RT ${one('SELECT kode FROM rt WHERE id=?', f.rt_id)?.kode} / RW 01` : 'Seluruh RT - RW 01 Kelurahan Jakamulya');
  doc.fontSize(9).text(`Jumlah KK: ${kk} • Jumlah jiwa: ${rows.length} • L: ${rows.filter(r => r.jk === 'L').length} • P: ${rows.filter(r => r.jk === 'P').length}`, M, doc.y); doc.moveDown(0.4);
  table(doc, [{ h: 'No', w: 24, align: 'center' }, { h: 'Nama', w: 110 }, { h: 'NIK', w: 90 }, { h: 'No. KK', w: 90 }, { h: 'L/P', w: 24, align: 'center' }, { h: 'Umur', w: 30, align: 'center' }, { h: 'Hubungan', w: 65 }, { h: 'RT', w: 28, align: 'center' }, { h: 'Alamat', w: 120 }],
    rows.map((r, i) => [String(i + 1), r.nama, f.full ? r.nik : maskNik(r.nik), f.full ? r.no_kk : maskNik(r.no_kk), r.jk, String(umur(r.tgl_lahir)), r.hubungan, r.rt_kode, r.alamat]), { fontSize: 7.5 });
  note(doc, f.full ? 'PERHATIAN: dokumen memuat NIK/KK lengkap - hanya untuk petugas berwenang, jangan disebarluaskan.' : 'NIK dan No. KK disamarkan sesuai ketentuan perlindungan data pribadi.');
  return finalize(doc, { by, docNo: 'LAP-WARGA' });
}

// ---------------- LAPORAN SURAT ----------------
export async function laporanSuratPdf(f: { from: string; to: string; rt_id?: number | null }, by: string) {
  const rows = all(`SELECT lr.*, lt.nama jenis_nama, res.nama pemohon, rt.kode rt_kode, i.nomor FROM letter_requests lr JOIN letter_types lt ON lt.kode=lr.jenis JOIN residents res ON res.id=lr.resident_id JOIN rt ON rt.id=lr.rt_id LEFT JOIN issued_letters i ON i.request_id=lr.id
    WHERE substr(lr.created_at,1,10) BETWEEN ? AND ? ${f.rt_id ? 'AND lr.rt_id=' + Number(f.rt_id) : ''} ORDER BY lr.created_at`, f.from, f.to);
  const doc = createDoc('Rekap Surat');
  kop(doc);
  heading(doc, 'REKAPITULASI PERMOHONAN & ARSIP SURAT', `Periode ${tgl(f.from)} s.d. ${tgl(f.to)}`);
  const cnt: Record<string, number> = {}; rows.forEach(r => cnt[r.status] = (cnt[r.status] || 0) + 1);
  doc.fontSize(9).text('Ringkasan: ' + Object.entries(cnt).map(([k, v]) => `${STATUS_SURAT[k]?.label || k}: ${v}`).join(' • ') + ` • Total: ${rows.length}`, M, doc.y, { width: CW }); doc.moveDown(0.4);
  table(doc, [{ h: 'No', w: 24 }, { h: 'No. Registrasi', w: 75 }, { h: 'Tanggal', w: 55 }, { h: 'Pemohon', w: 90 }, { h: 'RT', w: 26 }, { h: 'Jenis Surat', w: 110 }, { h: 'Status', w: 85 }, { h: 'Nomor Surat', w: 120 }],
    rows.map((r, i) => [String(i + 1), r.no_reg, tglPendek(r.created_at), r.pemohon, r.rt_kode, r.jenis_nama, STATUS_SURAT[r.status]?.label || r.status, r.nomor || '-']), { fontSize: 7.5 });
  return finalize(doc, { by, docNo: 'LAP-SURAT' });
}

// ---------------- LAPORAN IURAN ----------------
export async function laporanIuranPdf(f: { periode: string; rt_id?: number | null; tunggakan?: boolean }, by: string) {
  const rows = all(`SELECT i.*, dt.nama dues_nama, h.kepala_nama, h.no_kk, rt.kode rt_kode, (SELECT receipt_no FROM payments p WHERE p.invoice_id=i.id AND p.status='terverifikasi' LIMIT 1) kw,
      (SELECT tanggal FROM payments p WHERE p.invoice_id=i.id AND p.status='terverifikasi' LIMIT 1) tgl_bayar
    FROM dues_invoices i JOIN dues_types dt ON dt.id=i.dues_type_id JOIN households h ON h.id=i.household_id JOIN rt ON rt.id=h.rt_id
    WHERE ${f.tunggakan ? "i.status!='lunas' AND i.periode<=?" : 'i.periode=?'} ${f.rt_id ? 'AND h.rt_id=' + Number(f.rt_id) : ''} ORDER BY rt.kode, h.kepala_nama, i.periode`, f.periode);
  const tot = rows.reduce((a, r) => a + r.nominal, 0), lunas = rows.filter(r => r.status === 'lunas').reduce((a, r) => a + r.nominal, 0);
  const doc = createDoc('Laporan Iuran');
  kop(doc);
  heading(doc, f.tunggakan ? 'LAPORAN TUNGGAKAN IURAN RUTIN' : 'REKAP IURAN RUTIN PER KK', f.tunggakan ? `Sampai dengan periode ${periodeLabel(f.periode)}` : `Periode ${periodeLabel(f.periode)}${f.rt_id ? ' • RT ' + one('SELECT kode FROM rt WHERE id=?', f.rt_id)?.kode : ''}`);
  table(doc, [{ h: 'No', w: 24 }, { h: 'Kepala Keluarga / KK', w: 140 }, { h: 'RT', w: 28 }, { h: 'Jenis Iuran', w: 120 }, { h: 'Periode', w: 70 }, { h: 'Nominal', w: 60, align: 'right' }, { h: 'Status', w: 55 }, { h: 'Kuitansi', w: 100 }],
    rows.map((r, i) => [String(i + 1), `${r.kepala_nama} / ${maskNik(r.no_kk)}`, r.rt_kode, r.dues_nama, periodeLabel(r.periode), angka(r.nominal), r.status === 'lunas' ? 'Lunas' : r.status === 'menunggu' ? 'Menunggu verifikasi' : 'Belum', r.kw || '-']),
    { total: ['', 'TOTAL', '', '', '', angka(tot), '', ''], fontSize: 7.5 });
  if (!f.tunggakan) note(doc, `Terbayar: ${rupiah(lunas)} • Belum terbayar: ${rupiah(tot - lunas)} • Persentase lunas: ${tot ? Math.round(lunas / tot * 100) : 0}%`);
  return finalize(doc, { by, docNo: f.tunggakan ? 'LAP-TUNGGAKAN' : 'LAP-IURAN-' + f.periode });
}

// ---------------- LAPORAN PENGADUAN ----------------
export async function laporanPengaduanPdf(f: { from: string; to: string; rt_id?: number | null }, by: string) {
  const rows = all(`SELECT c.*, rt.kode rt_kode, u.nama pelapor FROM complaints c JOIN rt ON rt.id=c.rt_id LEFT JOIN users u ON u.id=c.user_id WHERE substr(c.created_at,1,10) BETWEEN ? AND ? ${f.rt_id ? 'AND c.rt_id=' + Number(f.rt_id) : ''} ORDER BY c.created_at`, f.from, f.to);
  const doc = createDoc('Rekap Pengaduan');
  kop(doc);
  heading(doc, 'REKAPITULASI PENGADUAN WARGA', `Periode ${tgl(f.from)} s.d. ${tgl(f.to)}`);
  table(doc, [{ h: 'No', w: 24 }, { h: 'Kode', w: 70 }, { h: 'Tanggal', w: 55 }, { h: 'RT', w: 26 }, { h: 'Kategori', w: 70 }, { h: 'Judul', w: 160 }, { h: 'Status', w: 60 }, { h: 'Tanggapan', w: 50, align: 'center' }],
    rows.map((r, i) => [String(i + 1), r.kode, tglPendek(r.created_at), r.rt_kode, r.kategori, r.judul, r.status, String(one('SELECT COUNT(*) n FROM complaint_responses WHERE complaint_id=?', r.id).n)]));
  note(doc, 'Identitas pelapor tidak dicantumkan pada rekap umum untuk melindungi privasi warga.');
  return finalize(doc, { by, docNo: 'LAP-ADUAN' });
}
