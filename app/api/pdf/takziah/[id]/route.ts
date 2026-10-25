import { one } from '@/lib/db';
import { apiUser, deny, audit } from '@/lib/api';
import { laporanTakziahPdf } from '@/lib/documents';
import { pdfResponse } from '@/lib/pdf';
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';
export async function GET(req: Request, { params }: any) {
  const u = apiUser(); if (!u) return deny('Silakan login', 401);
  const e = one('SELECT * FROM condolence_events WHERE id=?', Number(params.id));
  if (!e) return deny('Tidak ditemukan', 404);
  // laporan takziah bersifat transparan bagi warga RW; NIK/KK disamarkan
  audit(u, 'CETAK_LAPORAN_TAKZIAH', 'condolence_events', e.id, e.kode);
  return pdfResponse(await laporanTakziahPdf(e.id, u.nama), `Laporan_Takziah_${e.kode}.pdf`, new URL(req.url).searchParams.get('dl') === '1');
}
