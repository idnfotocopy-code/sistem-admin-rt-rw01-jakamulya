import fs from 'fs'; import path from 'path';
import { PATHS } from '@/lib/db';
import { apiUser, deny, audit } from '@/lib/api';
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  const u = apiUser(); if (!u) return deny('Silakan login', 401);
  if (u.role !== 'admin') return deny();
  const f = path.basename(new URL(req.url).searchParams.get('f') || '');
  const fp = path.join(PATHS.backups, f);
  if (!f || !fs.existsSync(fp)) return deny('Backup tidak ditemukan', 404);
  audit(u, 'UNDUH_BACKUP', 'backup', f);
  return new Response(new Uint8Array(fs.readFileSync(fp)), { headers: { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename="${f}"` } });
}
