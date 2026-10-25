import { one } from '@/lib/db';
import { apiUser, canSee, deny } from '@/lib/api';
import { kuitansiIuranPdf } from '@/lib/documents';
import { pdfResponse } from '@/lib/pdf';
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';
export async function GET(req: Request, { params }: any) {
  const u = apiUser(); if (!u) return deny('Silakan login', 401);
  const p = one('SELECT p.*, h.rt_id, h.id hid FROM payments p JOIN dues_invoices i ON i.id=p.invoice_id JOIN households h ON h.id=i.household_id WHERE p.id=?', Number(params.id));
  if (!p) return deny('Tidak ditemukan', 404);
  if (!canSee(u, p.rt_id, p.hid)) return deny();
  return pdfResponse(await kuitansiIuranPdf(p.id, u.nama), `Kuitansi_${(p.receipt_no || 'pending-' + p.id).replace(/\//g, '_')}.pdf`, new URL(req.url).searchParams.get('dl') === '1');
}
