'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUser, audit, scopeRt } from '@/lib/auth';
import { run, insert, one, nowStr, nextCounter, db } from '@/lib/db';
import { rmUpload } from '@/lib/hapus';
import { can } from '@/lib/rbac';
import { saveUpload } from '@/lib/upload';
const f = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const go = (url: string, msg: string, ok = true): never => { revalidatePath('/pengaduan'); revalidatePath('/dashboard'); redirect(url + (url.includes('?') ? '&' : '?') + (ok ? 'ok=' : 'err=') + encodeURIComponent(msg)); };

export async function kirimAduan(fd: FormData) {
  const u = requireUser('pengaduan');
  const judul = f(fd, 'judul'); const isi = f(fd, 'isi');
  if (judul.length < 5 || isi.length < 10) go('/pengaduan?tab=baru', 'Judul (min. 5) dan uraian (min. 10 karakter) wajib diisi.', false);
  const rt_id = u.rt_id || Number(fd.get('rt_id')) || 1;
  let lampiran: string | null = null;
  try { lampiran = await saveUpload(fd.get('lampiran'), 'aduan', { exts: ['.jpg', '.jpeg', '.png', '.pdf'] }); } catch (e: any) { go('/pengaduan?tab=baru', e.message, false); }
  const yr = nowStr().slice(0, 4);
  const kode = `ADU-${yr}-${String(nextCounter('adu-' + yr)).padStart(3, '0')}`;
  const id = insert('complaints', { kode, user_id: u.id, rt_id, kategori: f(fd, 'kategori') || 'Lainnya', judul, isi, lokasi: f(fd, 'lokasi'), lampiran, status: 'baru', is_private: 1, created_at: nowStr(), updated_at: nowStr() });
  audit(u, 'KIRIM_PENGADUAN', 'complaints', id, kode);
  go(`/pengaduan/${id}`, `Pengaduan ${kode} terkirim. Pengurus RT/RW akan menindaklanjuti.`);
}

export async function tanggapiAduan(fd: FormData) {
  const u = requireUser('pengaduan');
  const c = one('SELECT * FROM complaints WHERE id=?', Number(fd.get('id'))); if (!c) go('/pengaduan', 'Tidak ditemukan.', false);
  const b = `/pengaduan/${c.id}`; const isi = f(fd, 'isi'); const st = f(fd, 'status');
  const owner = c.user_id === u.id;
  if (!can.handleAduan(u.role) && !owner) go(b, 'Tidak berwenang.', false);
  const s = scopeRt(u); if (!owner && s && s !== c.rt_id) go(b, 'Di luar RT Anda.', false);
  if (!isi) go(b, 'Isi tanggapan wajib diisi.', false);
  const newSt = can.handleAduan(u.role) && ['baru', 'diproses', 'selesai', 'ditolak'].includes(st) ? st : null;
  insert('complaint_responses', { complaint_id: c.id, user_id: u.id, isi, status_baru: newSt, at: nowStr() });
  run('UPDATE complaints SET status=COALESCE(?, status), updated_at=? WHERE id=?', newSt, nowStr(), c.id);
  audit(u, 'TANGGAPI_PENGADUAN', 'complaints', c.id, `${newSt || '-'}: ${isi.slice(0, 80)}`);
  go(b, 'Tanggapan tersimpan.');
}

/** Admin: hapus pengaduan beserta seluruh tanggapan dan lampirannya. */
export async function hapusAduan(fd: FormData) {
  const u = requireUser('pengaduan'); const id = Number(fd.get('id'));
  if (!can.deleteAny(u.role)) go(`/pengaduan/${id}`, 'Hanya Admin Sistem yang dapat menghapus pengaduan.', false);
  const c = one('SELECT * FROM complaints WHERE id=?', id); if (!c) go('/pengaduan', 'Pengaduan tidak ditemukan.', false);
  let n = 0;
  db().transaction(() => { n = run('DELETE FROM complaint_responses WHERE complaint_id=?', id).changes; run('DELETE FROM complaints WHERE id=?', id); })();
  rmUpload(c.lampiran);
  audit(u, 'HAPUS_PENGADUAN', 'complaints', id, `${c.kode} ${c.judul} (${n} tanggapan)`);
  go('/pengaduan', `Pengaduan ${c.kode} beserta ${n} tanggapan dihapus.`);
}
