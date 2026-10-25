'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUser, audit, scopeRt } from '@/lib/auth';
import { all, run, insert, one, nowStr, today, db } from '@/lib/db';
import { can } from '@/lib/rbac';
import { saveUpload } from '@/lib/upload';
import { rmUpload } from '@/lib/hapus';
import { nomorKuitansi, postIuranKeKas, reversalKas } from '@/lib/finance';
const f = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const go = (url: string, msg: string, ok = true): never => { revalidatePath('/iuran'); revalidatePath('/kas'); revalidatePath('/dashboard'); redirect(url + (url.includes('?') ? '&' : '?') + (ok ? 'ok=' : 'err=') + encodeURIComponent(msg)); };
const back = (fd: FormData) => f(fd, 'back') || '/iuran';
const loadInv = (id: number) => one('SELECT i.*, h.rt_id, h.kepala_nama, dt.nama dn, dt.level FROM dues_invoices i JOIN households h ON h.id=i.household_id JOIN dues_types dt ON dt.id=i.dues_type_id WHERE i.id=?', id);
function guardPetugas(u: any, inv: any, b: string) {
  if (!can.manageIuran(u.role)) go(b, 'Hanya Bendahara RT / Sekretaris-Bendahara RW yang dapat mencatat pembayaran.', false);
  const s = scopeRt(u); if (s && s !== inv.rt_id) go(b, 'Tagihan di luar RT Anda.', false);
}

export async function generateTagihan(fd: FormData) {
  const u = requireUser('iuran'); const b = back(fd);
  if (!can.manageIuran(u.role) && u.role !== 'admin') go(b, 'Tidak berwenang membuat tagihan.', false);
  const periode = f(fd, 'periode'); if (!/^\d{4}-\d{2}$/.test(periode)) go(b, 'Periode tidak valid.', false);
  const dt = one('SELECT * FROM dues_types WHERE id=? AND aktif=1', Number(fd.get('dues_type_id'))); if (!dt) go(b, 'Jenis iuran tidak valid.', false);
  const s = scopeRt(u); const rtSel = Number(fd.get('rt_id')) || null; const rt = s || rtSel;
  const hh = all(`SELECT h.id FROM households h WHERE h.status_domisili!='pindah' AND EXISTS(SELECT 1 FROM residents r WHERE r.household_id=h.id AND r.status='hidup') ${rt ? 'AND h.rt_id=' + Number(rt) : ''}`);
  let n = 0;
  db().transaction(() => { for (const h of hh) { const r = run("INSERT OR IGNORE INTO dues_invoices(dues_type_id,household_id,periode,nominal,status,created_at) VALUES(?,?,?,?, 'belum', ?)", dt.id, h.id, periode, dt.nominal, nowStr()); n += r.changes; } })();
  audit(u, 'GENERATE_TAGIHAN', 'dues_invoices', '', `${dt.nama} ${periode} ${rt ? 'RT ' + rt : 'semua RT'}: ${n} tagihan baru`);
  go(b, n ? `${n} tagihan ${dt.nama} periode ${periode} berhasil dibuat.` : 'Tidak ada tagihan baru (sudah dibuat sebelumnya).');
}

export async function catatBayar(fd: FormData) {
  const u = requireUser('iuran'); const b = back(fd);
  const inv = loadInv(Number(fd.get('invoice_id'))); if (!inv) go(b, 'Tagihan tidak ditemukan.', false);
  guardPetugas(u, inv, b);
  if (inv.status === 'lunas') go(b, 'Tagihan sudah lunas.', false);
  const tanggal = f(fd, 'tanggal') || today(); const method = f(fd, 'method') || 'Tunai';
  let pid = 0; let no = '';
  db().transaction(() => {
    run("UPDATE payments SET status='ditolak', catatan=COALESCE(catatan,'')||' (digantikan pembayaran tunai)' WHERE invoice_id=? AND status='menunggu'", inv.id);
    no = nomorKuitansi('KW', inv.rt_id, tanggal);
    pid = insert('payments', { invoice_id: inv.id, amount: inv.nominal, method, tanggal, receipt_no: no, ref: f(fd, 'ref') || null, received_by: u.id, status: 'terverifikasi', catatan: f(fd, 'catatan'), created_by: u.id, created_at: nowStr() });
    run("UPDATE dues_invoices SET status='lunas' WHERE id=?", inv.id);
    postIuranKeKas(pid, u.id);
  })();
  audit(u, 'CATAT_PEMBAYARAN', 'payments', pid, `${no} ${inv.dn} ${inv.periode} KK ${inv.kepala_nama}`);
  go(b, `Pembayaran tercatat. Kuitansi ${no} siap dicetak.`);
}

export async function konfirmasiTransfer(fd: FormData) {
  const u = requireUser('iuran'); const b = back(fd);
  const inv = loadInv(Number(fd.get('invoice_id'))); if (!inv) go(b, 'Tagihan tidak ditemukan.', false);
  if (u.role !== 'warga' || inv.household_id !== u.household_id) go(b, 'Hanya kepala/anggota KK yang bersangkutan.', false);
  if (inv.status !== 'belum') go(b, 'Tagihan sudah lunas atau sedang diverifikasi.', false);
  const ref = f(fd, 'ref'); if (ref.length < 4) go(b, 'Nomor referensi transfer wajib diisi.', false);
  let bukti: string | null = null;
  try { bukti = await saveUpload(fd.get('bukti'), 'bayar', { exts: ['.png', '.jpg', '.jpeg', '.pdf'], max: 1024 * 1024 }); } catch (e: any) { go(b, e.message, false); }
  if (!bukti) go(b, 'Bukti transfer wajib diunggah (JPG/PNG/PDF maks. 1 MB).', false);
  const pid = insert('payments', { invoice_id: inv.id, amount: inv.nominal, method: f(fd, 'method') || 'Transfer', tanggal: f(fd, 'tanggal') || today(), ref, status: 'menunggu', catatan: f(fd, 'catatan') || 'Konfirmasi transfer dari warga', bukti_file: bukti, created_by: u.id, created_at: nowStr() });
  run("UPDATE dues_invoices SET status='menunggu' WHERE id=?", inv.id);
  audit(u, 'KONFIRMASI_TRANSFER', 'payments', pid, `${inv.dn} ${inv.periode} ref ${ref}`);
  go(b, 'Konfirmasi pembayaran terkirim. Bendahara akan memverifikasi; kuitansi terbit setelah diverifikasi.');
}

export async function verifikasiBayar(fd: FormData) {
  const u = requireUser('iuran'); const b = back(fd);
  const p = one('SELECT * FROM payments WHERE id=?', Number(fd.get('payment_id'))); if (!p || p.status !== 'menunggu') go(b, 'Konfirmasi tidak ditemukan / sudah diproses.', false);
  const inv = loadInv(p.invoice_id); guardPetugas(u, inv, b);
  if (f(fd, 'aksi') === 'tolak') {
    const alasan = f(fd, 'alasan'); if (!alasan) go(b, 'Alasan penolakan wajib diisi.', false);
    run("UPDATE payments SET status='ditolak', cancel_reason=?, cancelled_by=? WHERE id=?", alasan, u.id, p.id);
    run("UPDATE dues_invoices SET status='belum' WHERE id=?", inv.id);
    audit(u, 'TOLAK_PEMBAYARAN', 'payments', p.id, alasan); go(b, 'Konfirmasi ditolak; tagihan kembali berstatus belum bayar.');
  }
  let no = '';
  db().transaction(() => {
    no = nomorKuitansi('KW', inv.rt_id, p.tanggal);
    run("UPDATE payments SET status='terverifikasi', receipt_no=?, received_by=? WHERE id=?", no, u.id, p.id);
    run("UPDATE dues_invoices SET status='lunas' WHERE id=?", inv.id);
    postIuranKeKas(p.id, u.id);
  })();
  audit(u, 'VERIFIKASI_PEMBAYARAN', 'payments', p.id, no);
  go(b, `Pembayaran terverifikasi. Kuitansi ${no} terbit dan tercatat di kas.`);
}

export async function batalBayar(fd: FormData) {
  const u = requireUser('iuran'); const b = back(fd);
  const p = one('SELECT * FROM payments WHERE id=?', Number(fd.get('payment_id'))); if (!p || p.status !== 'terverifikasi') go(b, 'Pembayaran tidak valid.', false);
  const inv = loadInv(p.invoice_id); guardPetugas(u, inv, b);
  const alasan = f(fd, 'alasan'); if (alasan.length < 5) go(b, 'Alasan pembatalan wajib diisi (min. 5 karakter).', false);
  db().transaction(() => {
    run("UPDATE payments SET status='dibatalkan', cancelled_by=?, cancel_reason=? WHERE id=?", u.id, alasan, p.id);
    run("UPDATE dues_invoices SET status='belum' WHERE id=?", inv.id);
    reversalKas('payment', p.id, u.id, alasan, today());
  })();
  audit(u, 'BATAL_PEMBAYARAN', 'payments', p.id, `${p.receipt_no}: ${alasan}`);
  go(b, `Kuitansi ${p.receipt_no} dibatalkan (jurnal pembalik dibuat di kas, data tidak dihapus).`);
}

export async function simpanJenis(fd: FormData) {
  const u = requireUser('iuran'); const b = '/iuran?tab=jenis';
  if (!['admin', 'sekbend_rw'].includes(u.role)) go(b, 'Hanya Admin / Sekretaris-Bendahara RW.', false);
  const id = Number(fd.get('id')) || 0; const nama = f(fd, 'nama'); const nominal = Number(f(fd, 'nominal').replace(/\D/g, ''));
  if (!nama || !nominal) go(b, 'Nama dan nominal wajib diisi.', false);
  const o = { nama, nominal, periode: f(fd, 'periode') || 'bulanan', level: f(fd, 'level') === 'RW' ? 'RW' : 'RT', aktif: fd.get('aktif') ? 1 : 0, keterangan: f(fd, 'keterangan') };
  if (id) run('UPDATE dues_types SET nama=@nama, nominal=@nominal, periode=@periode, level=@level, aktif=@aktif, keterangan=@keterangan WHERE id=' + id, o); else insert('dues_types', o);
  audit(u, id ? 'UBAH_JENIS_IURAN' : 'TAMBAH_JENIS_IURAN', 'dues_types', id, `${nama} ${nominal}`);
  go(b, 'Jenis iuran disimpan. Perubahan nominal berlaku untuk tagihan baru.');
}

/** Admin: hapus tagihan yang belum dibayar (atau konfirmasi transfer yang belum diverifikasi). Tagihan yang pernah punya kuitansi tidak dihapus. */
export async function hapusTagihan(fd: FormData) {
  const u = requireUser('iuran'); const b = back(fd);
  if (!can.deleteAny(u.role)) go(b, 'Hanya Admin Sistem yang dapat menghapus tagihan.', false);
  const inv = loadInv(Number(fd.get('invoice_id'))); if (!inv) go(b, 'Tagihan tidak ditemukan.', false);
  if (inv.status === 'lunas') go(b, 'Tagihan lunas tidak dapat dihapus. Batalkan kuitansinya dulu (jurnal pembalik).', false);
  const kw = one("SELECT COUNT(*) n FROM payments WHERE invoice_id=? AND receipt_no IS NOT NULL", inv.id).n;
  if (kw) go(b, 'Tagihan ini memiliki riwayat kuitansi (termasuk yang dibatalkan) yang tercatat di kas, sehingga disimpan sebagai jejak audit.', false);
  const files = all('SELECT bukti_file FROM payments WHERE invoice_id=?', inv.id).map((x: any) => x.bukti_file);
  db().transaction(() => { run('DELETE FROM payments WHERE invoice_id=?', inv.id); run('DELETE FROM dues_invoices WHERE id=?', inv.id); })();
  files.forEach(rmUpload);
  audit(u, 'HAPUS_TAGIHAN', 'dues_invoices', inv.id, `${inv.dn} ${inv.periode} KK ${inv.kepala_nama} ${inv.nominal}`);
  go(b, `Tagihan ${inv.dn} ${inv.periode} KK ${inv.kepala_nama} dihapus.`);
}

/** Admin: hapus massal tagihan BELUM BAYAR untuk satu jenis & periode (mis. salah generate). */
export async function hapusTagihanMassal(fd: FormData) {
  const u = requireUser('iuran'); const b = back(fd);
  if (!can.deleteAny(u.role)) go(b, 'Hanya Admin Sistem.', false);
  const periode = f(fd, 'periode'); const dt = one('SELECT * FROM dues_types WHERE id=?', Number(fd.get('dues_type_id')));
  if (!dt || !/^\d{4}-\d{2}$/.test(periode)) go(b, 'Jenis/periode tidak valid.', false);
  const rt = Number(fd.get('rt_id')) || null;
  const where = `dues_type_id=? AND periode=? AND status='belum' AND NOT EXISTS(SELECT 1 FROM payments p WHERE p.invoice_id=dues_invoices.id AND p.receipt_no IS NOT NULL) ${rt ? 'AND household_id IN (SELECT id FROM households WHERE rt_id=' + rt + ')' : ''}`;
  let n = 0;
  db().transaction(() => {
    run(`DELETE FROM payments WHERE invoice_id IN (SELECT id FROM dues_invoices WHERE ${where})`, dt.id, periode);
    n = run(`DELETE FROM dues_invoices WHERE ${where}`, dt.id, periode).changes;
  })();
  audit(u, 'HAPUS_TAGIHAN_MASSAL', 'dues_invoices', '', `${dt.nama} ${periode} ${rt ? 'RT#' + rt : 'semua RT'}: ${n} tagihan belum bayar`);
  go(b, n ? `${n} tagihan belum bayar ${dt.nama} periode ${periode} dihapus. Tagihan lunas tidak tersentuh.` : 'Tidak ada tagihan belum bayar yang cocok.', !!n);
}

/** Admin: hapus jenis iuran yang belum pernah dipakai di tagihan. */
export async function hapusJenis(fd: FormData) {
  const u = requireUser('iuran'); const b = '/iuran?tab=jenis';
  if (!can.deleteAny(u.role)) go(b, 'Hanya Admin Sistem.', false);
  const dt = one('SELECT * FROM dues_types WHERE id=?', Number(fd.get('id'))); if (!dt) go(b, 'Jenis iuran tidak ditemukan.', false);
  const n = one('SELECT COUNT(*) n FROM dues_invoices WHERE dues_type_id=?', dt.id).n;
  if (n) go(b, `Jenis "${dt.nama}" sudah dipakai di ${n} tagihan. Nonaktifkan saja (hilangkan centang Aktif), atau hapus dulu tagihan belum bayarnya.`, false);
  run('DELETE FROM dues_types WHERE id=?', dt.id);
  audit(u, 'HAPUS_JENIS_IURAN', 'dues_types', dt.id, `${dt.nama} ${dt.nominal}`);
  go(b, `Jenis iuran "${dt.nama}" dihapus.`);
}
