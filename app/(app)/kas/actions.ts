'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUser, audit, scopeRt } from '@/lib/auth';
import { run, insert, one, nowStr, today, nextCounter } from '@/lib/db';
import { can } from '@/lib/rbac';
import { saveUpload } from '@/lib/upload';
import { rmUpload } from '@/lib/hapus';
import { reversalKas } from '@/lib/finance';
const f = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const go = (url: string, msg: string, ok = true): never => { revalidatePath('/kas'); revalidatePath('/dashboard'); redirect(url + (url.includes('?') ? '&' : '?') + (ok ? 'ok=' : 'err=') + encodeURIComponent(msg)); };

export async function inputKas(fd: FormData) {
  const u = requireUser('kas'); const b = f(fd, 'back') || '/kas';
  if (!can.inputKas(u.role)) go(b, 'Hanya bendahara yang dapat menginput transaksi.', false);
  const buku = u.role === 'sekbend_rw' ? 'RW' : 'RT'; const rt_id = buku === 'RT' ? scopeRt(u) : null;
  const amount = Number(f(fd, 'amount').replace(/\D/g, '')); const jenis = f(fd, 'jenis') === 'keluar' ? 'keluar' : 'masuk';
  const uraian = f(fd, 'uraian'); if (!amount || uraian.length < 4) go(b, 'Nominal dan uraian wajib diisi.', false);
  let bukti: string | null = null;
  try { bukti = await saveUpload(fd.get('bukti_file'), 'kas'); } catch (e: any) { go(b, e.message, false); }
  if (jenis === 'keluar' && !bukti && !f(fd, 'no_bukti')) go(b, 'Pengeluaran wajib disertai nomor bukti atau lampiran nota.', false);
  const tanggal = f(fd, 'tanggal') || today();
  const no = f(fd, 'no_bukti') || `${jenis === 'masuk' ? 'M' : 'K'}${buku}${rt_id ? one('SELECT kode FROM rt WHERE id=?', rt_id).kode : ''}-${tanggal.slice(0, 4)}-${String(nextCounter(`kas-${buku}-${rt_id || 0}-${tanggal.slice(0, 4)}`)).padStart(3, '0')}`;
  const id = insert('cash_transactions', { buku, rt_id, tanggal, no_bukti: no, jenis, kategori: f(fd, 'kategori') || 'Lainnya', uraian, amount, bukti_file: bukti, status: 'menunggu', created_by: u.id, created_at: nowStr() });
  audit(u, 'INPUT_KAS', 'cash_transactions', id, `${buku} ${jenis} ${amount} ${uraian}`);
  go(b, `Transaksi ${no} disimpan dan menunggu persetujuan ${buku === 'RW' ? 'Ketua RW' : 'Ketua RT'}.`);
}

export async function periksaKas(fd: FormData) {
  const u = requireUser('kas'); const b = f(fd, 'back') || '/kas';
  const k = one('SELECT * FROM cash_transactions WHERE id=?', Number(fd.get('id'))); if (!k || k.status !== 'menunggu') go(b, 'Transaksi tidak valid.', false);
  const ok = (k.buku === 'RW' && u.role === 'ketua_rw') || (k.buku === 'RT' && u.role === 'ketua_rt' && u.rt_id === k.rt_id);
  if (!ok) go(b, `Hanya ${k.buku === 'RW' ? 'Ketua RW' : 'Ketua RT terkait'} yang dapat memeriksa transaksi ini.`, false);
  const setuju = f(fd, 'aksi') === 'setuju'; const cat = f(fd, 'catatan');
  if (!setuju && !cat) go(b, 'Alasan penolakan wajib diisi.', false);
  run('UPDATE cash_transactions SET status=?, checked_by=?, checked_at=?, uraian=CASE WHEN ? != \'\' THEN uraian || \' [Catatan: \' || ? || \']\' ELSE uraian END WHERE id=?', setuju ? 'disetujui' : 'ditolak', u.id, nowStr(), cat, cat, k.id);
  audit(u, setuju ? 'SETUJUI_KAS' : 'TOLAK_KAS', 'cash_transactions', k.id, `${k.no_bukti} ${cat}`);
  go(b, setuju ? `Transaksi ${k.no_bukti} disetujui & masuk saldo.` : `Transaksi ${k.no_bukti} ditolak.`);
}

export async function koreksiKas(fd: FormData) {
  const u = requireUser('kas'); const b = f(fd, 'back') || '/kas';
  const k = one('SELECT * FROM cash_transactions WHERE id=?', Number(fd.get('id'))); if (!k || k.status !== 'disetujui') go(b, 'Transaksi tidak valid.', false);
  if (!can.inputKas(u.role) || (k.buku === 'RW' ? u.role !== 'sekbend_rw' : u.rt_id !== k.rt_id)) go(b, 'Tidak berwenang.', false);
  if (k.ref_type) go(b, 'Transaksi otomatis (iuran/takziah) dikoreksi dari modul asalnya.', false);
  const alasan = f(fd, 'alasan'); if (alasan.length < 5) go(b, 'Alasan koreksi wajib.', false);
  run("UPDATE cash_transactions SET ref_type='manual', ref_id=id WHERE id=?", k.id);
  reversalKas('manual', k.id, u.id, alasan, today());
  audit(u, 'KOREKSI_KAS', 'cash_transactions', k.id, alasan);
  go(b, `Jurnal pembalik untuk ${k.no_bukti} dibuat. Data asli tetap tersimpan.`);
}

/** Admin: hapus transaksi kas yang BELUM disetujui (menunggu) atau DITOLAK. Transaksi disetujui tidak dihapus — gunakan koreksi (jurnal pembalik). */
export async function hapusKas(fd: FormData) {
  const u = requireUser('kas'); const b = f(fd, 'back') || '/kas';
  if (!can.deleteAny(u.role)) go(b, 'Hanya Admin Sistem yang dapat menghapus transaksi kas.', false);
  const k = one('SELECT * FROM cash_transactions WHERE id=?', Number(fd.get('id'))); if (!k) go(b, 'Transaksi tidak ditemukan.', false);
  if (k.status === 'disetujui') go(b, 'Transaksi yang sudah disetujui tidak dapat dihapus agar buku kas dapat diaudit. Gunakan "koreksi" (jurnal pembalik).', false);
  if (k.ref_type) go(b, 'Transaksi ini dibuat otomatis dari modul lain (iuran/takziah) dan tidak dapat dihapus dari sini.', false);
  run('DELETE FROM cash_transactions WHERE id=?', k.id);
  rmUpload(k.bukti_file);
  audit(u, 'HAPUS_KAS', 'cash_transactions', k.id, `${k.no_bukti} ${k.jenis} ${k.amount} status=${k.status}: ${k.uraian}`);
  go(b, `Transaksi ${k.no_bukti} (${k.status}) dihapus.`);
}
