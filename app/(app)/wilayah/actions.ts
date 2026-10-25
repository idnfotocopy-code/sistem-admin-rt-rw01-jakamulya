'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUser, audit } from '@/lib/auth';
import { run, insert, one } from '@/lib/db';
import { can } from '@/lib/rbac';
const f = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const back = (q: string) => { revalidatePath('/wilayah'); redirect('/wilayah?' + q); };

export async function saveKelurahan(fd: FormData) {
  const u = requireUser('wilayah');
  if (!can.editWilayah(u.role)) back('err=' + encodeURIComponent('Hanya Admin/Kelurahan yang dapat mengubah data wilayah.'));
  run('UPDATE kelurahan SET nama=?,kecamatan=?,kota=?,provinsi=?,alamat=?,kode_pos=?,lurah=?,nip_lurah=?,telp=? WHERE id=1', f(fd, 'nama'), f(fd, 'kecamatan'), f(fd, 'kota'), f(fd, 'provinsi'), f(fd, 'alamat'), f(fd, 'kode_pos'), f(fd, 'lurah'), f(fd, 'nip_lurah'), f(fd, 'telp'));
  audit(u, 'UBAH_KELURAHAN', 'kelurahan', 1);
  back('ok=' + encodeURIComponent('Data kelurahan disimpan.'));
}
export async function saveRw(fd: FormData) {
  const u = requireUser('wilayah');
  if (!can.editWilayah(u.role) && u.role !== 'ketua_rw') back('err=' + encodeURIComponent('Tidak berwenang.'));
  run('UPDATE rw SET nama=?,alamat=?,ketua=?,sekretaris=?,bendahara=?,masa_mulai=?,masa_selesai=?,kode_surat=? WHERE id=1', f(fd, 'nama'), f(fd, 'alamat'), f(fd, 'ketua'), f(fd, 'sekretaris'), f(fd, 'bendahara'), f(fd, 'masa_mulai'), f(fd, 'masa_selesai'), f(fd, 'kode_surat') || 'RW-01');
  audit(u, 'UBAH_RW', 'rw', 1);
  back('ok=' + encodeURIComponent('Data RW 01 disimpan.'));
}
export async function saveRt(fd: FormData) {
  const u = requireUser('wilayah');
  const id = Number(fd.get('id') || 0);
  const allowed = can.editWilayah(u.role) || u.role === 'ketua_rw' || (u.role === 'ketua_rt' && u.rt_id === id);
  if (!allowed) back('err=' + encodeURIComponent('Tidak berwenang mengubah RT ini.'));
  const kode = f(fd, 'kode').padStart(3, '0');
  if (!/^\d{3}$/.test(kode)) back('err=' + encodeURIComponent('Kode RT harus 3 digit angka.'));
  const dup = one('SELECT id FROM rt WHERE kode=? AND id!=?', kode, id);
  if (dup) back('err=' + encodeURIComponent('Kode RT sudah dipakai.'));
  if (id) {
    run('UPDATE rt SET kode=?,nama=?,alamat=?,ketua=?,bendahara=?,masa_mulai=?,masa_selesai=? WHERE id=?', kode, 'RT ' + kode, f(fd, 'alamat'), f(fd, 'ketua'), f(fd, 'bendahara'), f(fd, 'masa_mulai'), f(fd, 'masa_selesai'), id);
    audit(u, 'UBAH_RT', 'rt', id);
  } else {
    if (!can.editWilayah(u.role)) back('err=' + encodeURIComponent('Tidak berwenang.'));
    const nid = insert('rt', { rw_id: 1, kode, nama: 'RT ' + kode, alamat: f(fd, 'alamat'), ketua: f(fd, 'ketua'), bendahara: f(fd, 'bendahara'), masa_mulai: f(fd, 'masa_mulai'), masa_selesai: f(fd, 'masa_selesai') });
    audit(u, 'TAMBAH_RT', 'rt', nid);
  }
  back('ok=' + encodeURIComponent(`Data RT ${kode} disimpan.`));
}

/** Admin: hapus RT. Hanya bila tidak ada data apa pun yang masih terkait. */
export async function hapusRt(fd: FormData) {
  const u = requireUser('wilayah');
  const msg = (m: string, ok = false): never => { back((ok ? 'ok=' : 'err=') + encodeURIComponent(m)); throw new Error('unreachable'); };
  if (!can.deleteAny(u.role)) msg('Hanya Admin Sistem yang dapat menghapus RT.');
  const id = Number(fd.get('id')); const r = one('SELECT * FROM rt WHERE id=?', id); if (!r) msg('RT tidak ditemukan.');
  const cek: [string, string][] = [['households', 'KK'], ['users', 'akun pengguna'], ['letter_requests', 'surat'], ['complaints', 'pengaduan'], ['cash_transactions', 'transaksi kas'], ['condolence_events', 'kejadian takziah']];
  const ada = cek.map(([t, l]) => { const n = one(`SELECT COUNT(*) n FROM ${t} WHERE rt_id=?`, id).n; return n ? `${n} ${l}` : ''; }).filter(Boolean);
  const ann = one('SELECT COUNT(*) n FROM announcements WHERE target_rt_id=?', id).n; if (ann) ada.push(`${ann} pengumuman`);
  const rul = one('SELECT COUNT(*) n FROM condolence_rules WHERE cakupan_rt_id=?', id).n; if (rul) ada.push(`${rul} aturan takziah`);
  if (ada.length) msg(`RT ${r.kode} tidak dapat dihapus karena masih memiliki: ${ada.join(', ')}. Pindahkan/hapus data tersebut terlebih dahulu.`);
  run('DELETE FROM rt WHERE id=?', id);
  audit(u, 'HAPUS_RT', 'rt', id, `RT ${r.kode} ${r.ketua || ''}`);
  msg(`RT ${r.kode} dihapus.`, true);
}
