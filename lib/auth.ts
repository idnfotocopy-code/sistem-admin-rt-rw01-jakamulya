import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import crypto from 'crypto';
import { one, run, insert, nowStr } from './db';
import { canMenu, MenuKey } from './rbac';

export type User = { id: number; nama: string; username: string; role: string; jabatan: string; rt_id: number | null; rw_id: number | null; household_id: number | null; resident_id: number | null; rt_kode?: string };

export function currentUser(): User | null {
  const t = cookies().get('sid')?.value;
  if (!t) return null;
  const u = one<User>(`SELECT u.id,u.nama,u.username,u.role,u.jabatan,u.rt_id,u.rw_id,u.household_id,u.resident_id, rt.kode rt_kode
    FROM sessions s JOIN users u ON u.id=s.user_id LEFT JOIN rt ON rt.id=u.rt_id
    WHERE s.token=? AND s.expires_at>? AND u.status='aktif'`, t, Date.now());
  return u || null;
}
export function requireUser(menu?: MenuKey): User {
  const u = currentUser();
  if (!u) redirect('/login');
  if (menu && !canMenu(u.role, menu)) redirect('/dashboard?err=' + encodeURIComponent('Anda tidak memiliki hak akses ke menu tersebut.'));
  return u;
}
export function createSession(userId: number) {
  const token = crypto.randomBytes(32).toString('hex');
  insert('sessions', { token, user_id: userId, expires_at: Date.now() + 1000 * 60 * 60 * 12 });
  run('UPDATE users SET last_login=? WHERE id=?', nowStr(), userId);
  return token;
}
export function destroySession() {
  const t = cookies().get('sid')?.value;
  if (t) run('DELETE FROM sessions WHERE token=?', t);
}
export function audit(u: { id: number; username: string } | null, aksi: string, entitas = '', entitas_id: any = '', detail = '') {
  insert('audit_logs', { user_id: u?.id || null, username: u?.username || '-', aksi, entitas, entitas_id: String(entitas_id ?? ''), detail, at: nowStr() });
}
/** RT scope: null = seluruh RW */
export const scopeRt = (u: User) => (['ketua_rt', 'bendahara_rt', 'warga'].includes(u.role) ? u.rt_id : null);
