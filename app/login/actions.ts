'use server';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { one, insert } from '@/lib/db';
import { createSession, audit, destroySession } from '@/lib/auth';

export async function loginAction(fd: FormData) {
  const username = String(fd.get('username') || '').trim().toLowerCase();
  const password = String(fd.get('password') || '');
  const since = Date.now() - 5 * 60 * 1000;
  const fails = one('SELECT COUNT(*) n FROM login_attempts WHERE username=? AND success=0 AND at>?', username, since).n;
  if (fails >= 5) redirect('/login?err=' + encodeURIComponent('Terlalu banyak percobaan gagal. Coba lagi dalam 5 menit.'));
  const u = one("SELECT * FROM users WHERE lower(username)=?", username);
  const ok = u && u.status === 'aktif' && bcrypt.compareSync(password, u.password_hash);
  insert('login_attempts', { username, success: ok ? 1 : 0, at: Date.now() });
  if (!ok) { audit(null, 'LOGIN_GAGAL', 'users', '', `username: ${username}`); redirect('/login?err=' + encodeURIComponent(u && u.status !== 'aktif' ? 'Akun dinonaktifkan. Hubungi admin.' : 'Username atau password salah.')); }
  const token = createSession(u.id);
  cookies().set('sid', token, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 12 });
  audit({ id: u.id, username: u.username }, 'LOGIN', 'users', u.id, 'Login berhasil');
  redirect('/dashboard');
}
export async function logoutAction() {
  destroySession();
  cookies().delete('sid');
  redirect('/login?ok=' + encodeURIComponent('Anda telah keluar.'));
}
