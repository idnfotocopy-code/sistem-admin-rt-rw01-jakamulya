'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUser, audit, scopeRt } from '@/lib/auth';
import { all, run, insert, one, nowStr, today, db, nextCounter } from '@/lib/db';
import { can } from '@/lib/rbac';
import { saveUpload } from '@/lib/upload';
import { rmUpload } from '@/lib/hapus';
import { nomorKuitansi, reversalKas } from '@/lib/finance';
const f = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const num = (fd: FormData, k: string) => Number(f(fd, k).replace(/\D/g, '')) || 0;
const go = (url: string, msg: string, ok = true): never => { revalidatePath('/takziah'); revalidatePath('/takziah-dana'); revalidatePath('/kas'); revalidatePath('/dashboard'); redirect(url + (url.includes('?') ? '&' : '?') + (ok ? 'ok=' : 'err=') + encodeURIComponent(msg)); };
const ev = (id: number) => one('SELECT e.*, rt.kode rt_kode FROM condolence_events e JOIN rt ON rt.id=e.rt_id WHERE e.id=?', id);
function guard(u: any, e: any, b: string, fin = false) {
  if (!(fin ? can.financeTakziah(u.role) : can.manageTakziah(u.role))) go(b, fin ? 'Hanya Bendahara RT / Sekretaris-Bendahara RW yang mencatat keuangan takziah.' : 'Tidak berwenang.', false);
  const s = scopeRt(u); if (e && s && s !== e.rt_id) go(b, 'Kejadian di luar RT Anda.', false);
}
const locked = (e: any, b: string) => { if (e.status === 'selesai' && e.review_status === 'disetujui') go(b, 'Laporan sudah disetujui & ditutup. Koreksi hanya melalui pembukaan ulang oleh Ketua RW.', false); };

export async function simpanAturan(fd: FormData) {
  const u = requireUser('takziah'); const b = '/takziah?tab=aturan';
  if (!['ketua_rw', 'sekbend_rw', 'ketua_rt', 'admin'].includes(u.role)) go(b, 'Tidak berwenang mengubah aturan.', false);
  const id = Number(fd.get('id')) || 0; const s = scopeRt(u);
  const o = { nama: f(fd, 'nama'), nominal_default: num(fd, 'nominal_default'), sifat: f(fd, 'sifat') || 'wajib', metode: f(fd, 'metode') || 'per KK', berlaku_mulai: f(fd, 'berlaku_mulai') || today(), cakupan_rt_id: s || Number(fd.get('cakupan_rt_id')) || null, aktif: fd.get('aktif') ? 1 : 0, catatan: f(fd, 'catatan') };
  if (!o.nama) go(b, 'Nama aturan wajib diisi.', false);
  if (id) { const r = one('SELECT * FROM condolence_rules WHERE id=?', id); if (s && r.cakupan_rt_id !== s) go(b, 'Aturan tingkat RW hanya dapat diubah pengurus RW.', false); run('UPDATE condolence_rules SET nama=@nama,nominal_default=@nominal_default,sifat=@sifat,metode=@metode,berlaku_mulai=@berlaku_mulai,cakupan_rt_id=@cakupan_rt_id,aktif=@aktif,catatan=@catatan WHERE id=' + id, o); }
  else insert('condolence_rules', o);
  audit(u, id ? 'UBAH_ATURAN_TAKZIAH' : 'TAMBAH_ATURAN_TAKZIAH', 'condolence_rules', id, `${o.nama} ${o.nominal_default}`);
  go(b, 'Aturan iuran takziah disimpan (sesuai kesepakatan warga).');
}

export async function buatKejadian(fd: FormData) {
  const u = requireUser('takziah'); const b = '/takziah';
  guard(u, null, b);
  const s = scopeRt(u); const rt_id = s || Number(fd.get('rt_id'));
  if (!rt_id) go(b, 'RT wajib dipilih.', false);
  const almarhum = f(fd, 'almarhum'); const tanggal = f(fd, 'tanggal');
  if (!almarhum || !tanggal) go(b, 'Nama almarhum/almarhumah dan tanggal wajib diisi.', false);
  const rule = one('SELECT * FROM condolence_rules WHERE id=?', Number(fd.get('rule_id')));
  const target = f(fd, 'nominal_target') ? num(fd, 'nominal_target') : (rule?.nominal_default || 0);
  const sifat = rule?.sifat || 'sukarela'; const lingkup = f(fd, 'lingkup');
  const resident_id = Number(fd.get('resident_id')) || null;
  const res = resident_id ? one('SELECT * FROM residents WHERE id=?', resident_id) : null;
  let id = 0; let kode = '';
  db().transaction(() => {
    kode = `TKZ-${tanggal.slice(0, 4)}-${String(nextCounter('tkz-' + tanggal.slice(0, 4))).padStart(3, '0')}`;
    while (one('SELECT 1 FROM condolence_events WHERE kode=?', kode)) kode = `TKZ-${tanggal.slice(0, 4)}-${String(nextCounter('tkz-' + tanggal.slice(0, 4))).padStart(3, '0')}`;
    id = insert('condolence_events', { kode, tanggal, almarhum, usia: Number(fd.get('usia')) || null, rt_id, household_id: res?.household_id || null, keluarga_kontak: f(fd, 'keluarga_kontak'), alamat: f(fd, 'alamat'), rule_id: rule?.id || null, nominal_target: target, sifat, status: 'penggalangan', catatan: f(fd, 'catatan'), review_status: 'draft', created_by: u.id, created_at: nowStr() });
    const hh = all(`SELECT h.id FROM households h WHERE h.status_domisili!='pindah' AND EXISTS(SELECT 1 FROM residents r WHERE r.household_id=h.id AND r.status='hidup') ${lingkup === 'RW' ? '' : 'AND h.rt_id=' + Number(rt_id)} ${res ? 'AND h.id!=' + Number(res.household_id) : ''}`);
    for (const h of hh) insert('condolence_contributions', { event_id: id, household_id: h.id, expected: sifat === 'wajib' ? target : 0, amount: 0, status: 'belum', verified: 'menunggu', created_at: nowStr() });
    if (res && fd.get('tandai_meninggal')) run("UPDATE residents SET status='meninggal' WHERE id=?", res.id);
  })();
  if (fd.get('umumkan')) insert('announcements', { judul: `Berita Duka: ${almarhum}`, isi: `Innalillahi wa inna ilaihi raji'un. Telah berpulang ${almarhum}${f(fd, 'alamat') ? ' (' + f(fd, 'alamat') + ')' : ''} pada ${tanggal}. ${target ? `Iuran takziah sesuai kesepakatan Rp ${target.toLocaleString('id-ID')}/KK (${sifat})` : 'Iuran takziah bersifat sukarela'} dapat diserahkan ke Bendahara RT.`, jenis: 'Takziah', target_rt_id: lingkup === 'RW' ? null : rt_id, tanggal_kegiatan: null, lokasi: f(fd, 'alamat'), tayang_mulai: today(), tayang_selesai: null, created_by: u.id, created_at: nowStr() });
  audit(u, 'BUAT_KEJADIAN_TAKZIAH', 'condolence_events', id, `${kode} ${almarhum}`);
  go(`/takziah/${id}`, `Kejadian ${kode} dibuat. Daftar kontribusi per KK sudah disiapkan.`);
}

export async function catatKontribusi(fd: FormData) {
  const u = requireUser('takziah');
  const c = one('SELECT * FROM condolence_contributions WHERE id=?', Number(fd.get('id'))); if (!c) go('/takziah', 'Data tidak ditemukan.', false);
  const e = ev(c.event_id); const b = `/takziah/${e.id}`; guard(u, e, b, true); locked(e, b);
  if (c.status !== 'belum') go(b, 'Kontribusi sudah tercatat. Gunakan pembatalan untuk koreksi.', false);
  const amount = num(fd, 'amount'); if (amount <= 0) go(b, 'Nominal harus lebih dari 0.', false);
  const tanggal = f(fd, 'tanggal') || today(); const method = f(fd, 'method') || 'Tunai';
  let no = '';
  db().transaction(() => {
    no = nomorKuitansi('TAK', e.rt_id, tanggal);
    const st = e.sifat === 'wajib' && amount < c.expected ? 'sukarela' : 'lunas';
    run("UPDATE condolence_contributions SET amount=?, tanggal=?, method=?, receipt_no=?, received_by=?, status=?, verified='terverifikasi', ref=?, catatan=? WHERE id=?", amount, tanggal, method, no, u.id, st, f(fd, 'ref') || null, f(fd, 'catatan') || (st === 'sukarela' && e.sifat === 'wajib' ? 'Membayar sesuai kemampuan' : ''), c.id);
    const kk = one('SELECT kepala_nama FROM households WHERE id=?', c.household_id).kepala_nama;
    insert('cash_transactions', { buku: 'RT', rt_id: e.rt_id, tanggal, no_bukti: no, jenis: 'masuk', kategori: 'Takziah', uraian: `Iuran takziah ${e.kode} - KK ${kk}`, amount, status: 'disetujui', created_by: u.id, checked_by: u.id, checked_at: nowStr(), ref_type: 'takziah_in', ref_id: c.id, created_at: nowStr() });
  })();
  audit(u, 'CATAT_TAKZIAH', 'condolence_contributions', c.id, `${no} ${amount}`);
  go(b, `Kontribusi tercatat, kuitansi ${no} siap dicetak.`);
}

export async function batalKontribusi(fd: FormData) {
  const u = requireUser('takziah');
  const c = one('SELECT * FROM condolence_contributions WHERE id=?', Number(fd.get('id'))); const e = ev(c.event_id); const b = `/takziah/${e.id}`;
  guard(u, e, b, true); locked(e, b);
  const alasan = f(fd, 'alasan'); if (alasan.length < 5) go(b, 'Alasan koreksi wajib diisi.', false);
  db().transaction(() => {
    reversalKas('takziah_in', c.id, u.id, alasan, today());
    // simpan jejak lama di catatan; baris dikembalikan ke "belum" agar dapat dicatat ulang
    run("UPDATE condolence_contributions SET catatan=?, amount=0, status='belum', verified='menunggu', receipt_no=NULL, tanggal=NULL, method=NULL WHERE id=?", `Koreksi: kuitansi ${c.receipt_no} (${c.amount}) dibatalkan oleh ${u.nama} - ${alasan}`, c.id);
  })();
  audit(u, 'BATAL_KONTRIBUSI_TAKZIAH', 'condolence_contributions', c.id, `${c.receipt_no}: ${alasan}`);
  go(b, `Kuitansi ${c.receipt_no} dibatalkan; jurnal pembalik dicatat di kas.`);
}

export async function tambahPenyaluran(fd: FormData) {
  const u = requireUser('takziah');
  const e = ev(Number(fd.get('event_id'))); const b = `/takziah/${e.id}`; guard(u, e, b, true); locked(e, b);
  const amount = num(fd, 'amount'); const penerima = f(fd, 'penerima'); const jenis = f(fd, 'jenis') === 'biaya' ? 'biaya' : 'bantuan';
  if (amount <= 0 || !penerima) go(b, 'Nominal dan penerima wajib diisi.', false);
  let file: string | null = null;
  try { file = await saveUpload(fd.get('bukti_file'), 'takziah'); } catch (er: any) { go(b, er.message, false); }
  const did = insert('condolence_disbursements', { event_id: e.id, jenis, amount, tanggal: f(fd, 'tanggal') || today(), penerima, saksi: f(fd, 'saksi'), bukti: file ? 'file:' + file : f(fd, 'bukti'), keterangan: f(fd, 'keterangan'), created_by: u.id, created_at: nowStr() });
  const n = one("SELECT COUNT(*) n FROM condolence_disbursements WHERE event_id=?", e.id).n;
  insert('cash_transactions', { buku: 'RT', rt_id: e.rt_id, tanggal: f(fd, 'tanggal') || today(), no_bukti: `TAK-OUT-${e.kode.slice(-3)}-${n}`, jenis: 'keluar', kategori: 'Takziah', uraian: `${jenis === 'biaya' ? 'Biaya' : 'Bantuan'} takziah ${e.kode}: ${penerima}`, amount, status: 'disetujui', created_by: u.id, checked_by: u.id, checked_at: nowStr(), ref_type: 'takziah_out', ref_id: did, created_at: nowStr() });
  if (e.status === 'penggalangan') run("UPDATE condolence_events SET status='penyaluran' WHERE id=?", e.id);
  audit(u, 'CATAT_PENYALURAN_TAKZIAH', 'condolence_disbursements', did, `${e.kode} ${jenis} ${amount} -> ${penerima}`);
  go(b, `${jenis === 'biaya' ? 'Biaya' : 'Penyaluran bantuan'} ${amount.toLocaleString('id-ID')} tercatat.`);
}

export async function reviewKejadian(fd: FormData) {
  const u = requireUser('takziah');
  const e = ev(Number(fd.get('event_id'))); const b = `/takziah/${e.id}`; const aksi = f(fd, 'aksi'); const note = f(fd, 'catatan');
  const s = scopeRt(u); if (s && s !== e.rt_id) go(b, 'Kejadian di luar RT Anda.', false);
  if (aksi === 'ajukan') { if (!can.manageTakziah(u.role)) go(b, 'Tidak berwenang.', false); run("UPDATE condolence_events SET review_status='diajukan', status=CASE WHEN status='penggalangan' THEN 'penyaluran' ELSE status END WHERE id=?", e.id); audit(u, 'AJUKAN_LAPORAN_TAKZIAH', 'condolence_events', e.id); go(b, 'Laporan diajukan untuk diperiksa Ketua RT/RW.'); }
  if (!can.reviewTakziah(u.role)) go(b, 'Hanya Ketua RT / Ketua RW yang memeriksa laporan.', false);
  if (aksi === 'setujui') { run("UPDATE condolence_events SET review_status='disetujui', status='selesai', reviewed_by=?, reviewed_at=?, review_note=? WHERE id=?", u.id, nowStr(), note || null, e.id); audit(u, 'SETUJUI_LAPORAN_TAKZIAH', 'condolence_events', e.id, note); go(b, 'Laporan takziah disetujui & ditutup. PDF laporan memuat TTD pemeriksa.'); }
  if (aksi === 'revisi') { if (!note) go(b, 'Catatan revisi wajib diisi.', false); run("UPDATE condolence_events SET review_status='draft', review_note=? WHERE id=?", note, e.id); audit(u, 'REVISI_LAPORAN_TAKZIAH', 'condolence_events', e.id, note); go(b, 'Laporan dikembalikan untuk diperbaiki.'); }
  if (aksi === 'buka') { if (u.role !== 'ketua_rw') go(b, 'Hanya Ketua RW.', false); run("UPDATE condolence_events SET review_status='draft', status='penyaluran', review_note=? WHERE id=?", 'Dibuka ulang: ' + (note || '-'), e.id); audit(u, 'BUKA_ULANG_TAKZIAH', 'condolence_events', e.id, note); go(b, 'Laporan dibuka ulang untuk koreksi.'); }
  go(b, 'Aksi tidak dikenal.', false);
}

/** Admin: hapus kejadian takziah. Bila sudah ada dana tercatat, wajib ketik "HAPUS" dan seluruh posting kas dibuatkan jurnal pembalik (kas disetujui tidak dihapus). */
export async function hapusKejadian(fd: FormData) {
  const u = requireUser('takziah'); const id = Number(fd.get('event_id')); const b = `/takziah/${id}`;
  if (!can.deleteAny(u.role)) go(b, 'Hanya Admin Sistem yang dapat menghapus kejadian takziah.', false);
  const e = ev(id); if (!e) go('/takziah', 'Kejadian tidak ditemukan.', false);
  const nIn = one('SELECT COUNT(*) n FROM condolence_contributions WHERE event_id=? AND receipt_no IS NOT NULL', id).n;
  const dis = all('SELECT * FROM condolence_disbursements WHERE event_id=?', id);
  const berdana = nIn > 0 || dis.length > 0;
  if (berdana && f(fd, 'konfirmasi').toUpperCase() !== 'HAPUS') go(b, `Kejadian ${e.kode} sudah memiliki ${nIn} kontribusi & ${dis.length} penyaluran tercatat. Ketik HAPUS pada kolom konfirmasi untuk menghapus paksa (posting kas akan dibalik otomatis).`, false);
  let rev = 0;
  db().transaction(() => {
    const alasan = `Kejadian takziah ${e.kode} dihapus oleh admin`;
    for (const c of all('SELECT id FROM condolence_contributions WHERE event_id=? AND receipt_no IS NOT NULL', id)) rev += reversalKas('takziah_in', c.id, u.id, alasan, today());
    for (const d of dis) rev += reversalKas('takziah_out', d.id, u.id, alasan, today());
    run('DELETE FROM condolence_contributions WHERE event_id=?', id);
    run('DELETE FROM condolence_disbursements WHERE event_id=?', id);
    run('DELETE FROM condolence_events WHERE id=?', id);
  })();
  dis.forEach((d: any) => { if (d.bukti?.startsWith('file:')) rmUpload(d.bukti.slice(5)); });
  audit(u, berdana ? 'HAPUS_PAKSA_TAKZIAH' : 'HAPUS_KEJADIAN_TAKZIAH', 'condolence_events', id, `${e.kode} Alm. ${e.almarhum}; ${nIn} kontribusi, ${dis.length} penyaluran, ${rev} jurnal pembalik kas`);
  go('/takziah', `Kejadian ${e.kode} (Alm. ${e.almarhum}) dihapus.${rev ? ` ${rev} jurnal pembalik dibuat di buku kas agar saldo tetap seimbang.` : ''}`);
}

/** Admin: hapus aturan iuran takziah yang belum dipakai kejadian mana pun. */
export async function hapusAturan(fd: FormData) {
  const u = requireUser('takziah'); const b = '/takziah?tab=aturan';
  if (!can.deleteAny(u.role)) go(b, 'Hanya Admin Sistem.', false);
  const r = one('SELECT * FROM condolence_rules WHERE id=?', Number(fd.get('id'))); if (!r) go(b, 'Aturan tidak ditemukan.', false);
  const n = one('SELECT COUNT(*) n FROM condolence_events WHERE rule_id=?', r.id).n;
  if (n) go(b, `Aturan "${r.nama}" dipakai oleh ${n} kejadian. Nonaktifkan saja agar riwayat tetap utuh.`, false);
  run('DELETE FROM condolence_rules WHERE id=?', r.id);
  audit(u, 'HAPUS_ATURAN_TAKZIAH', 'condolence_rules', r.id, r.nama);
  go(b, `Aturan "${r.nama}" dihapus.`);
}
