import { db, insert, one, nextCounter, nowStr, run, settings } from './db';
const rtKode = (rt_id: number) => one('SELECT kode FROM rt WHERE id=?', rt_id)?.kode || String(rt_id).padStart(3, '0');
export function nomorKuitansi(prefix: 'KW' | 'TAK', rt_id: number, tanggal: string) {
  const yr = tanggal.slice(0, 4);
  const n = nextCounter(`${prefix === 'KW' ? 'kw' : 'tak'}-${rt_id}-${yr}`);
  const fmt = settings()[prefix === 'KW' ? 'format_kuitansi_iuran' : 'format_kuitansi_takziah'] || `${prefix}/RT{rt}/{tahun}/{no}`;
  return fmt.replace('{rt}', rtKode(rt_id)).replace('{tahun}', yr).replace('{no}', String(n).padStart(4, '0'));
}
/** Posting pembayaran iuran terverifikasi ke kas (RT/RW sesuai level jenis iuran) */
export function postIuranKeKas(paymentId: number, userId: number) {
  const p = one(`SELECT p.*, i.periode, dt.nama dn, dt.level, h.rt_id, h.kepala_nama FROM payments p JOIN dues_invoices i ON i.id=p.invoice_id JOIN dues_types dt ON dt.id=i.dues_type_id JOIN households h ON h.id=i.household_id WHERE p.id=?`, paymentId);
  insert('cash_transactions', { buku: p.level === 'RW' ? 'RW' : 'RT', rt_id: p.level === 'RW' ? null : p.rt_id, tanggal: p.tanggal, no_bukti: p.receipt_no, jenis: 'masuk', kategori: 'Iuran Rutin', uraian: `${p.dn} ${p.periode} - KK ${p.kepala_nama}`, amount: p.amount, status: 'disetujui', created_by: userId, checked_by: userId, checked_at: nowStr(), ref_type: 'payment', ref_id: paymentId, created_at: nowStr() });
}
/** Koreksi = jurnal pembalik, bukan hapus */
export function reversalKas(refType: string, refId: number, userId: number, alasan: string, tanggal: string) {
  const rows = db().prepare("SELECT * FROM cash_transactions WHERE ref_type=? AND ref_id=? AND status='disetujui'").all(refType, refId) as any[];
  for (const k of rows) insert('cash_transactions', { buku: k.buku, rt_id: k.rt_id, tanggal, no_bukti: 'REV-' + k.no_bukti, jenis: k.jenis === 'masuk' ? 'keluar' : 'masuk', kategori: 'Koreksi', uraian: `Pembatalan ${k.no_bukti}: ${alasan}`, amount: k.amount, status: 'disetujui', created_by: userId, checked_by: userId, checked_at: nowStr(), ref_type: refType + '_rev', ref_id: refId, created_at: nowStr() });
  return rows.length;
}
export { run };
