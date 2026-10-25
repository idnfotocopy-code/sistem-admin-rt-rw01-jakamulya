'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUser, audit, scopeRt } from '@/lib/auth';
import { run, insert, one, nowStr } from '@/lib/db';
import { can } from '@/lib/rbac';
const f = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const go = (msg: string, ok = true): never => { revalidatePath('/pengumuman'); revalidatePath('/dashboard'); redirect('/pengumuman?' + (ok ? 'ok=' : 'err=') + encodeURIComponent(msg)); };

export async function simpanPengumuman(fd: FormData) {
  const u = requireUser('pengumuman');
  if (!can.postPengumuman(u.role)) go('Tidak berwenang.', false);
  const id = Number(fd.get('id')) || 0;
  const s = scopeRt(u);
  const target = s || (Number(fd.get('target_rt_id')) || null);
  const data: any = { judul: f(fd, 'judul'), isi: f(fd, 'isi'), jenis: f(fd, 'jenis') || 'Pengumuman', target_rt_id: target, tanggal_kegiatan: f(fd, 'tanggal_kegiatan') || null, lokasi: f(fd, 'lokasi'), tayang_mulai: f(fd, 'tayang_mulai') || nowStr().slice(0, 10), tayang_selesai: f(fd, 'tayang_selesai') || null };
  if (data.judul.length < 3 || !data.isi) go('Judul dan isi wajib diisi.', false);
  if (id) {
    const a = one('SELECT * FROM announcements WHERE id=?', id);
    if (!a || (s && a.target_rt_id !== s)) go('Tidak dapat mengubah pengumuman ini.', false);
    run(`UPDATE announcements SET ${Object.keys(data).map(k => k + '=@' + k).join(',')} WHERE id=@id`, { ...data, id });
    audit(u, 'UBAH_PENGUMUMAN', 'announcements', id, data.judul);
    go('Pengumuman diperbarui.');
  }
  const nid = insert('announcements', { ...data, created_by: u.id, created_at: nowStr() });
  audit(u, 'BUAT_PENGUMUMAN', 'announcements', nid, data.judul);
  go('Pengumuman diterbitkan.');
}

export async function hapusPengumuman(fd: FormData) {
  const u = requireUser('pengumuman');
  const a = one('SELECT * FROM announcements WHERE id=?', Number(fd.get('id')));
  const s = scopeRt(u);
  if (!a) go('Pengumuman tidak ditemukan.', false);
  if (!can.deleteAny(u.role) && (!can.postPengumuman(u.role) || (s && a.target_rt_id !== s))) go('Tidak dapat menghapus pengumuman ini.', false);
  run('DELETE FROM announcements WHERE id=?', a.id);
  audit(u, 'HAPUS_PENGUMUMAN', 'announcements', a.id, a.judul);
  go('Pengumuman dihapus.');
}
