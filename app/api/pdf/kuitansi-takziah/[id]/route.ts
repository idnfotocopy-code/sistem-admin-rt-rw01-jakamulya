import { one } from '@/lib/db';
import { apiUser, canSee, deny } from '@/lib/api';
import { kuitansiTakziahPdf } from '@/lib/documents';
import { pdfResponse } from '@/lib/pdf';
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';
export async function GET(req: Request, { params }: any) {
  const u = apiUser(); if (!u) return deny('Silakan login', 401);
  const c = one('SELECT c.*, h.rt_id FROM condolence_contributions c JOIN households h ON h.id=c.household_id WHERE c.id=?', Number(params.id));
  if (!c || !c.receipt_no) return deny('Kuitansi tidak ditemukan', 404);
  if (u.role === 'warga' ? c.household_id !== u.household_id : !canSee(u, c.rt_id, c.household_id) && !['ketua_rw', 'sekbend_rw', 'admin', 'kelurahan'].includes(u.role)) return deny();
  return pdfResponse(await kuitansiTakziahPdf(c.id, u.nama), `Kuitansi_${c.receipt_no.replace(/\//g, '_')}.pdf`, new URL(req.url).searchParams.get('dl') === '1');
}
