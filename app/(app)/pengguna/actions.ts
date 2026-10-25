'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';
import { requireUser, audit } from '@/lib/auth';
import { run, insert, one, nowStr, db } from '@/lib/db';
import { ROLES, can } from '@/lib/rbac';
const f = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const go = (url: string, msg: string, ok = true): never => { revalidatePath('/pengguna'); redirect(url + (url.includes('?') ? '&' : '?') + (ok ? 'ok=' : 'err=') + encodeURIComponent(msg)); };
const admin = () => { const u = requireUser('pengguna'); if (u.role !== 'admin') go('/dashboard', 'Khusus admin.', false); return u; };
const RT_ROLES = ['ketua_rt', 'bendahara_rt', 'warga'];

export async function simpanPengguna(fd: FormData) {
  const u = admin();
  const id = Number(fd.get('id')) || 0;
  const role = f(fd, 'role');
  if (!ROLES.find(r => r.key === role)) go('/pengguna', 'Role tidak valid.', false);
  const rt_id = RT_ROLES.includes(role) ? Number(fd.get('rt_id')) || null : null;
  if (RT_ROLES.includes(role) && !rt_id) go('/pengguna' + (id ? `?edit=${id}` : '?tab=baru'), 'Role ini wajib memiliki cakupan RT.', false);
  let household_id = role === 'warga' ? Number(fd.get('household_id')) || null : null;
  if (role === 'warga') {
    if (!household_id) go('/pengguna' + (id ? `?edit=${id}` : '?tab=baru'), 'Akun warga wajib ditautkan ke KK.', false);
    const h = one('SELECT rt_id FROM households WHERE id=?', household_id);
    if (!h || h.rt_id !== rt_id) go('/pengguna' + (id ? `?edit=${id}` : '?tab=baru'), 'KK tidak berada di RT yang dipilih.', false);
  }
  const data: any = { nama: f(fd, 'nama'), username: f(fd, 'username').toLowerCase(), phone: f(fd, 'phone'), email: f(fd, 'email'), role, jabatan: f(fd, 'jabatan') || ROLES.find(r => r.key === role)!.label, rt_id, rw_id: 1, household_id };
  if (!data.nama || !/^[a-z0-9._]{3,30}$/.test(data.username)) go('/pengguna' + (id ? `?edit=${id}` : '?tab=baru'), 'Nama wajib; username 3-30 karakter (huruf kecil/angka/titik/garis bawah).', false);
  const dup = one('SELECT id FROM users WHERE username=? AND id<>?', data.username, id);
  if (dup) go('/pengguna' + (id ? `?edit=${id}` : '?tab=baru'), 'Username sudah dipakai.', false);
  if (id) {
    if (id === u.id && role !== 'admin') go(`/pengguna?edit=${id}`, 'Tidak dapat menurunkan role akun sendiri.', false);
    const old = one('SELECT role, rt_id FROM users WHERE id=?', id);
    run(`UPDATE users SET ${Object.keys(data).map(k => k + '=@' + k).join(',')} WHERE id=@id`, { ...data, id });
    if (old && (old.role !== role || old.rt_id !== rt_id)) run('DELETE FROM sessions WHERE user_id=?', id);
    audit(u, 'UBAH_PENGGUNA', 'users', id, `${data.username} role=${role} rt=${rt_id || '-'}${old?.role !== role ? ` (sebelumnya ${old?.role})` : ''}`);
    go('/pengguna', `Akun ${data.username} diperbarui.`);
  }
  const pass = f(fd, 'password');
  if (pass.length < 8) go('/pengguna?tab=baru', 'Kata sandi awal minimal 8 karakter.', false);
  const nid = insert('users', { ...data, password_hash: bcrypt.hashSync(pass, 10), status: 'aktif', created_at: nowStr() });
  audit(u, 'BUAT_PENGGUNA', 'users', nid, `${data.username} role=${role}`);
  go('/pengguna', `Akun ${data.username} dibuat.`);
}

export async function resetSandi(fd: FormData) {
  const u = admin();
  const id = Number(fd.get('id')); const pass = f(fd, 'password');
  const t = one('SELECT * FROM users WHERE id=?', id); if (!t) go('/pengguna', 'Tidak ditemukan.', false);
  if (pass.length < 8) go(`/pengguna?edit=${id}`, 'Kata sandi baru minimal 8 karakter.', false);
  run('UPDATE users SET password_hash=? WHERE id=?', bcrypt.hashSync(pass, 10), id);
  run('DELETE FROM sessions WHERE user_id=? ', id);
  audit(u, 'RESET_SANDI', 'users', id, t.username);
  go('/pengguna', `Kata sandi ${t.username} direset. Sesi aktifnya diakhiri.`);
}

export async function ubahStatus(fd: FormData) {
  const u = admin();
  const id = Number(fd.get('id')); const t = one('SELECT * FROM users WHERE id=?', id);
  if (!t) go('/pengguna', 'Tidak ditemukan.', false);
  if (id === u.id) go('/pengguna', 'Tidak dapat menonaktifkan akun sendiri.', false);
  const st = t.status === 'aktif' ? 'nonaktif' : 'aktif';
  run('UPDATE users SET status=? WHERE id=?', st, id);
  if (st === 'nonaktif') run('DELETE FROM sessions WHERE user_id=?', id);
  audit(u, st === 'aktif' ? 'AKTIFKAN_PENGGUNA' : 'NONAKTIFKAN_PENGGUNA', 'users', id, t.username);
  go('/pengguna', `Akun ${t.username} ${st === 'aktif' ? 'diaktifkan' : 'dinonaktifkan'}.`);
}

export async function hapusPengguna(fd: FormData) {
  const u = admin();
  if (!can.deleteAny(u.role)) go('/pengguna', 'Khusus admin.', false);
  const id = Number(fd.get('id')); const t = one('SELECT * FROM users WHERE id=?', id);
  if (!t) go('/pengguna', 'Akun tidak ditemukan.', false);
  if (id === u.id) go('/pengguna', 'Tidak dapat menghapus akun sendiri.', false);
  if (t.role === 'admin' && (one("SELECT COUNT(*) n FROM users WHERE role='admin' AND status='aktif' AND id<>?", id)?.n || 0) < 1) go('/pengguna', 'Minimal harus ada satu akun admin aktif.', false);
  db().transaction(() => {
    run('DELETE FROM sessions WHERE user_id=?', id);
    run('DELETE FROM login_attempts WHERE username=?', t.username);
    run('DELETE FROM users WHERE id=?', id);
  })();
  audit(u, 'HAPUS_PENGGUNA', 'users', id, `${t.username} (${t.nama}) role=${t.role}`);
  go('/pengguna', `Akun ${t.username} dihapus permanen. Riwayat transaksi/surat yang dibuat akun ini tetap tersimpan.`);
}
