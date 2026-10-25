import { currentUser, scopeRt, audit } from './auth';
export const deny = (msg = 'Akses ditolak', code = 403) => new Response(msg, { status: code, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
export function apiUser() { return currentUser(); }
/** cek akses data milik RT/KK tertentu */
export function canSee(u: any, rt_id: number, household_id?: number | null) {
  if (u.role === 'warga') return household_id === u.household_id;
  const s = scopeRt(u); if (s && s !== rt_id) return false;
  return true;
}
export { audit };
