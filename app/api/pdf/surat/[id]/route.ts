import fs from 'fs';
import { one } from '@/lib/db';
import { apiUser, canSee, deny, audit } from '@/lib/api';
import { ensureArsip, suratPdf } from '@/lib/documents';
import { pdfResponse } from '@/lib/pdf';
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';
export async function GET(req: Request, { params }: any) {
  const u = apiUser(); if (!u) return deny('Silakan login', 401);
  const id = Number(params.id);
  const r = one('SELECT lr.*, i.nomor FROM letter_requests lr LEFT JOIN issued_letters i ON i.request_id=lr.id WHERE lr.id=?', id);
  if (!r) return deny('Tidak ditemukan', 404);
  if (!canSee(u, r.rt_id, r.household_id)) return deny();
  const dl = new URL(req.url).searchParams.get('dl') === '1';
  if (r.nomor) {
    const fp = await ensureArsip(id, u.nama);
    audit(u, 'UNDUH_SURAT', 'issued_letters', id, r.nomor);
    return pdfResponse(fs.readFileSync(fp!), `${r.nomor.replace(/[^A-Za-z0-9]+/g, '_')}.pdf`, dl);
  }
  if (u.role === 'warga') return deny('Surat belum diterbitkan.');
  return pdfResponse(await suratPdf(id, u.nama + ' (DRAF)'), `DRAF_${r.no_reg}.pdf`, dl);
}
