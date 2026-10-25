'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUser, audit } from '@/lib/auth';
import { run, insert, one, nowStr, PATHS } from '@/lib/db';
import { can } from '@/lib/rbac';
import { saveUpload } from '@/lib/upload';
import { rmFile } from '@/lib/hapus';
const go = (msg: string, ok = true): never => { revalidatePath('/kop-ttd'); redirect('/kop-ttd?' + (ok ? 'ok=' : 'err=') + encodeURIComponent(msg)); };
const KOP_KEYS = ['kop_baris1', 'kop_baris2', 'kop_baris3', 'kop_baris4', 'kop_alamat', 'kota_ttd', 'format_nomor_surat', 'format_kuitansi_iuran', 'format_kuitansi_takziah', 'tampilkan_kode_verifikasi'];

export async function simpanKop(fd: FormData) {
  const u = requireUser('kop-ttd');
  if (!can.editKop(u.role)) go('Hanya admin yang dapat mengubah kop surat.', false);
  const fmt = String(fd.get('format_nomor_surat') || '');
  if (!fmt.includes('{no}')) go('Format nomor surat wajib memuat {no}.', false);
  const changed: string[] = [];
  for (const k of KOP_KEYS) {
    const v = k === 'tampilkan_kode_verifikasi' ? (fd.get(k) ? '1' : '0') : String(fd.get(k) ?? '').trim();
    const old = one('SELECT value FROM settings WHERE key=?', k)?.value;
    if (old !== v) { run('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', k, v); changed.push(k); }
  }
  audit(u, 'UBAH_KOP', 'settings', '', changed.join(', ') || 'tanpa perubahan');
  go(changed.length ? 'Pengaturan kop & format disimpan. Berlaku untuk dokumen yang dicetak berikutnya.' : 'Tidak ada perubahan.');
}

export async function unggahTtd(fd: FormData) {
  const u = requireUser('kop-ttd');
  if (!can.uploadTtd(u.role)) go('Tidak berwenang.', false);
  const target = u.role === 'admin' ? Number(fd.get('user_id')) : u.id;
  const t = one("SELECT * FROM users WHERE id=? AND role IN ('kelurahan','ketua_rw','sekbend_rw','ketua_rt')", target);
  if (!t) go('Pilih pejabat penandatangan yang valid.', false);
  let file: string | null = null;
  try { file = await saveUpload(fd.get('file'), `ttd_u${t.id}`, { exts: ['.png'], max: 512 * 1024, dir: PATHS.ttd }); } catch (e: any) { go(e.message, false); }
  if (!file) go('Pilih file PNG tanda tangan.', false);
  const versi = (one('SELECT MAX(versi) v FROM signature_assets WHERE user_id=?', t.id)?.v || 0) + 1;
  run('UPDATE signature_assets SET is_active=0, deactivated_at=? WHERE user_id=? AND is_active=1', nowStr(), t.id);
  const id = insert('signature_assets', { user_id: t.id, nama_pejabat: String(fd.get('nama_pejabat') || t.nama).trim(), jabatan: String(fd.get('jabatan') || t.jabatan).trim(), file_path: file, versi, is_active: 1, uploaded_by: u.id, uploaded_at: nowStr() });
  audit(u, 'UPLOAD_TTD', 'signature_assets', id, `${t.nama} v${versi}`);
  go(`TTD ${t.nama} versi ${versi} diunggah dan diaktifkan. Versi sebelumnya dinonaktifkan (tetap tersimpan untuk arsip).`);
}

export async function aturTtd(fd: FormData) {
  const u = requireUser('kop-ttd');
  const s = one('SELECT * FROM signature_assets WHERE id=?', Number(fd.get('id')));
  if (!s || !can.uploadTtd(u.role) || (u.role !== 'admin' && s.user_id !== u.id)) go('Tidak berwenang.', false);
  if (s.is_active) { run('UPDATE signature_assets SET is_active=0, deactivated_at=? WHERE id=?', nowStr(), s.id); audit(u, 'NONAKTIFKAN_TTD', 'signature_assets', s.id, `${s.nama_pejabat} v${s.versi}`); go('TTD dinonaktifkan. Surat baru akan dicetak tanpa gambar TTD hingga ada TTD aktif.'); }
  run('UPDATE signature_assets SET is_active=0, deactivated_at=? WHERE user_id=? AND is_active=1', nowStr(), s.user_id);
  run('UPDATE signature_assets SET is_active=1, deactivated_at=NULL WHERE id=?', s.id);
  audit(u, 'AKTIFKAN_TTD', 'signature_assets', s.id, `${s.nama_pejabat} v${s.versi}`);
  go(`TTD ${s.nama_pejabat} versi ${s.versi} diaktifkan.`);
}

/** Admin: hapus satu versi aset tanda tangan. Ditolak bila versi ini dipakai surat yang sudah terbit. */
export async function hapusTtd(fd: FormData) {
  const u = requireUser('kop-ttd');
  if (!can.deleteAny(u.role)) go('Hanya Admin Sistem yang dapat menghapus aset TTD.', false);
  const s = one('SELECT * FROM signature_assets WHERE id=?', Number(fd.get('id'))); if (!s) go('Aset TTD tidak ditemukan.', false);
  const n = one('SELECT COUNT(*) n FROM issued_letters WHERE sig_rt_id=? OR sig_rw_id=?', s.id, s.id).n;
  if (n) go(`TTD ${s.nama_pejabat} v${s.versi} dipakai pada ${n} surat terbit, sehingga harus disimpan agar PDF arsip tetap valid. Nonaktifkan saja.`, false);
  run('DELETE FROM signature_assets WHERE id=?', s.id);
  rmFile(PATHS.ttd, s.file_path);
  audit(u, 'HAPUS_TTD', 'signature_assets', s.id, `${s.nama_pejabat} ${s.jabatan} v${s.versi}${s.is_active ? ' (aktif)' : ''}`);
  go(`TTD ${s.nama_pejabat} v${s.versi} dihapus.${s.is_active ? ' Tidak ada TTD aktif untuk pejabat ini sampai versi lain diaktifkan/diunggah.' : ''}`);
}
