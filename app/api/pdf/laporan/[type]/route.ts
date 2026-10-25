import { apiUser, deny, audit } from '@/lib/api';
import { scopeRt } from '@/lib/auth';
import { canMenu, can } from '@/lib/rbac';
import { laporanKasPdf, laporanWargaPdf, laporanSuratPdf, laporanIuranPdf, laporanPengaduanPdf } from '@/lib/documents';
import { pdfResponse } from '@/lib/pdf';
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';
export async function GET(req: Request, { params }: any) {
  const u = apiUser(); if (!u) return deny('Silakan login', 401);
  if (!canMenu(u.role, 'laporan')) return deny();
  const q = new URL(req.url).searchParams;
  const s = scopeRt(u);
  const rt_id = s || (Number(q.get('rt_id')) || null);
  const y = new Date().getFullYear();
  const from = q.get('from') || `${y}-01-01`, to = q.get('to') || `${y}-12-31`;
  const dl = q.get('dl') === '1';
  let buf: Buffer; let name: string;
  switch (params.type) {
    case 'kas': {
      let buku = q.get('buku') === 'RW' ? 'RW' : 'RT';
      if (s) buku = 'RT';
      if (buku === 'RT' && !rt_id) return deny('Pilih RT untuk buku kas RT.', 400);
      buf = await laporanKasPdf({ buku, rt_id, from, to }, u.nama); name = `Laporan_Kas_${buku}${buku === 'RT' ? rt_id : ''}.pdf`; break;
    }
    case 'warga': {
      const full = q.get('full') === '1' && can.seeFullNik(u.role);
      buf = await laporanWargaPdf({ rt_id, full }, u.nama); name = 'Daftar_Warga.pdf'; break;
    }
    case 'surat': buf = await laporanSuratPdf({ from, to, rt_id }, u.nama); name = 'Rekap_Surat.pdf'; break;
    case 'iuran': case 'tunggakan': {
      const periode = q.get('periode') || new Date().toISOString().slice(0, 7);
      buf = await laporanIuranPdf({ periode, rt_id, tunggakan: params.type === 'tunggakan' }, u.nama); name = params.type === 'tunggakan' ? 'Laporan_Tunggakan.pdf' : `Rekap_Iuran_${periode}.pdf`; break;
    }
    case 'pengaduan': buf = await laporanPengaduanPdf({ from, to, rt_id }, u.nama); name = 'Rekap_Pengaduan.pdf'; break;
    default: return deny('Jenis laporan tidak dikenal', 404);
  }
  audit(u, 'CETAK_LAPORAN', params.type, rt_id || '', `${from}..${to}`);
  return pdfResponse(buf, name, dl);
}
