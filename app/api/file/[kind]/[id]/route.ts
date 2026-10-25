import fs from 'fs'; import path from 'path';
import { one, PATHS } from '@/lib/db';
import { apiUser, canSee, deny } from '@/lib/api';
import { mimeOf } from '@/lib/upload';
import { canMenu } from '@/lib/rbac';
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';
export async function GET(_: Request, { params }: any) {
  const u = apiUser(); if (!u) return deny('Silakan login', 401);
  const id = Number(params.id); let file: string | null = null;
  if (params.kind === 'surat') { const r = one('SELECT * FROM letter_requests WHERE id=?', id); if (!r || !canSee(u, r.rt_id, r.household_id)) return deny(); file = r.lampiran; }
  else if (params.kind === 'aduan') { const c = one('SELECT * FROM complaints WHERE id=?', id); if (!c) return deny('Tidak ditemukan', 404); if (u.role === 'warga' ? c.user_id !== u.id : !canSee(u, c.rt_id)) return deny(); file = c.lampiran; }
  else if (params.kind === 'kas') { const k = one('SELECT * FROM cash_transactions WHERE id=?', id); if (!k || !canMenu(u.role, 'kas') || (k.buku === 'RT' && !canSee(u, k.rt_id))) return deny(); file = k.bukti_file; }
  else if (params.kind === 'bayar') { const p = one('SELECT p.*, h.rt_id, h.id hid FROM payments p JOIN dues_invoices i ON i.id=p.invoice_id JOIN households h ON h.id=i.household_id WHERE p.id=?', id); if (!p || !canSee(u, p.rt_id, p.hid)) return deny(); file = p.bukti_file; }
  else if (params.kind === 'takziah') { const d = one('SELECT * FROM condolence_disbursements WHERE id=?', id); if (!d || u.role === 'warga') return deny(); file = d.bukti?.startsWith('file:') ? d.bukti.slice(5) : null; }
  if (!file) return deny('Tidak ada lampiran', 404);
  const fp = path.join(PATHS.uploads, path.basename(file));
  if (!fs.existsSync(fp)) return deny('File tidak ditemukan', 404);
  return new Response(new Uint8Array(fs.readFileSync(fp)), { headers: { 'Content-Type': mimeOf(fp), 'Content-Disposition': `inline; filename="${path.basename(fp)}"`, 'Cache-Control': 'private, no-store' } });
}
