import fs from 'fs'; import path from 'path';
import { one, PATHS } from '@/lib/db';
import { apiUser, deny } from '@/lib/api';
import { can } from '@/lib/rbac';
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';
// Pratinjau TTD hanya untuk pemilik TTD & admin/pejabat berwenang (file disimpan di folder privat, tidak publik)
export async function GET(_: Request, { params }: any) {
  const u = apiUser(); if (!u) return deny('Silakan login', 401);
  const s = one('SELECT * FROM signature_assets WHERE id=?', Number(params.id));
  if (!s) return deny('Tidak ditemukan', 404);
  if (!(s.user_id === u.id || u.role === 'admin' || (can.uploadTtd(u.role) && ['ketua_rw', 'kelurahan'].includes(u.role)))) return deny();
  const fp = path.join(PATHS.ttd, path.basename(s.file_path));
  if (!fs.existsSync(fp)) return deny('File hilang', 404);
  return new Response(new Uint8Array(fs.readFileSync(fp)), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, no-store' } });
}
