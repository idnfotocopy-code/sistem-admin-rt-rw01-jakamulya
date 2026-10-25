import Link from 'next/link';
import { requireUser, scopeRt } from '@/lib/auth';
import { all } from '@/lib/db';
import { rupiah, tglPendek } from '@/lib/util';
import { takziahSummary } from '@/lib/documents';
import { EV_ST, RV_ST } from '@/lib/takziah';
import { PageHeader, Flash, Card, Badge, Empty, Stat, Tabs, RtSelect, Field } from '@/components/ui';

export default function Dana({ searchParams: sp }: any) {
  const u = requireUser('takziah-dana');
  const rtS = scopeRt(u); const rtF = rtS || Number(sp.rt) || null; const tab = sp.tab || 'rekap';
  const rts = all('SELECT * FROM rt ORDER BY kode');
  const w = rtF ? 'AND e.rt_id=' + Number(rtF) : '';
  const events = all(`SELECT e.*, rt.kode rt_kode FROM condolence_events e JOIN rt ON rt.id=e.rt_id WHERE 1=1 ${w} ORDER BY e.tanggal DESC`).map(e => ({ ...e, s: takziahSummary(e.id) }));
  const T = events.reduce((a, e) => ({ masuk: a.masuk + e.s.masuk, bantuan: a.bantuan + e.s.bantuan, biaya: a.biaya + e.s.biaya, saldo: a.saldo + e.s.saldo }), { masuk: 0, bantuan: 0, biaya: 0, saldo: 0 });
  const q = rtF ? `&rt=${rtF}` : '';
  return (<div>
    <PageHeader title="Penerimaan & Penyaluran Takziah" desc="Rekap seluruh dana takziah: penerimaan dari warga, penyaluran ke keluarga, biaya sah, dan saldo per kejadian." />
    <Flash sp={sp} />
    {!rtS && <form className="flex gap-2 items-end mb-3"><input type="hidden" name="tab" value={tab} /><Field label="RT"><RtSelect rts={rts} name="rt" value={rtF || ''} /></Field><button className="btn">Filter</button></form>}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5"><Stat label="Total penerimaan" value={rupiah(T.masuk)} /><Stat label="Disalurkan" value={rupiah(T.bantuan)} color="sky" /><Stat label="Biaya sah" value={rupiah(T.biaya)} color="violet" /><Stat label="Saldo dana takziah" value={rupiah(T.saldo)} color="gold" /></div>
    <Tabs active={tab} items={[{ key: 'rekap', label: 'Rekap per kejadian', href: `/takziah-dana?tab=rekap${q}` }, { key: 'masuk', label: 'Penerimaan', href: `/takziah-dana?tab=masuk${q}` }, { key: 'keluar', label: 'Penyaluran & biaya', href: `/takziah-dana?tab=keluar${q}` }]} />
    {tab === 'rekap' && <Card>{events.length ? <table className="tbl"><thead><tr><th>Kode</th><th>Almarhum/ah</th><th>RT</th><th>Tanggal</th><th className="text-right">Penerimaan</th><th className="text-right">Penyaluran</th><th className="text-right">Biaya</th><th className="text-right">Saldo</th><th>Status</th><th></th></tr></thead><tbody>
      {events.map(e => <tr key={e.id}><td className="font-mono text-xs">{e.kode}</td><td><Link href={`/takziah/${e.id}`} className="text-brand-800 font-medium hover:underline">{e.almarhum}</Link></td><td>{e.rt_kode}</td><td className="text-xs">{tglPendek(e.tanggal)}</td><td className="text-right">{rupiah(e.s.masuk)}</td><td className="text-right">{rupiah(e.s.bantuan)}</td><td className="text-right">{rupiah(e.s.biaya)}</td><td className="text-right font-semibold">{rupiah(e.s.saldo)}</td>
        <td><Badge color={EV_ST[e.status]?.[1]}>{EV_ST[e.status]?.[0]}</Badge> <Badge color={RV_ST[e.review_status]?.[1]}>{RV_ST[e.review_status]?.[0]}</Badge></td><td><a target="_blank" className="btn btn-sm" href={`/api/pdf/takziah/${e.id}`}>PDF</a></td></tr>)}
      <tr className="font-bold"><td colSpan={4}>TOTAL</td><td className="text-right">{rupiah(T.masuk)}</td><td className="text-right">{rupiah(T.bantuan)}</td><td className="text-right">{rupiah(T.biaya)}</td><td className="text-right">{rupiah(T.saldo)}</td><td colSpan={2}></td></tr>
    </tbody></table> : <Empty />}</Card>}
    {tab === 'masuk' && (() => { const rows = all(`SELECT c.*, e.kode, e.almarhum, h.kepala_nama, u.nama penerima FROM condolence_contributions c JOIN condolence_events e ON e.id=c.event_id JOIN households h ON h.id=c.household_id LEFT JOIN users u ON u.id=c.received_by WHERE c.status!='belum' ${w} ORDER BY c.tanggal DESC`);
      return <Card>{rows.length ? <table className="tbl"><thead><tr><th>Tanggal</th><th>No. Kuitansi</th><th>Kejadian</th><th>Dari KK</th><th>Metode</th><th>Diterima</th><th className="text-right">Nominal</th></tr></thead><tbody>
        {rows.map(r => <tr key={r.id}><td className="text-xs">{tglPendek(r.tanggal)}</td><td><a className="font-mono text-xs text-brand-700 underline" target="_blank" href={`/api/pdf/kuitansi-takziah/${r.id}`}>{r.receipt_no}</a></td><td className="text-xs">{r.kode} - {r.almarhum}</td><td>{r.kepala_nama}</td><td className="text-xs">{r.method}</td><td className="text-xs">{r.penerima}</td><td className="text-right">{rupiah(r.amount)}</td></tr>)}
      </tbody></table> : <Empty />}</Card>; })()}
    {tab === 'keluar' && (() => { const rows = all(`SELECT d.*, e.kode, e.almarhum FROM condolence_disbursements d JOIN condolence_events e ON e.id=d.event_id WHERE 1=1 ${w} ORDER BY d.tanggal DESC`);
      return <Card>{rows.length ? <table className="tbl"><thead><tr><th>Tanggal</th><th>Kejadian</th><th>Jenis</th><th>Penerima</th><th>Saksi</th><th>Bukti</th><th className="text-right">Nominal</th></tr></thead><tbody>
        {rows.map(r => <tr key={r.id}><td className="text-xs">{tglPendek(r.tanggal)}</td><td className="text-xs">{r.kode} - {r.almarhum}</td><td>{r.jenis === 'biaya' ? 'Biaya sah' : 'Bantuan'}</td><td>{r.penerima}</td><td className="text-xs">{r.saksi}</td><td className="text-xs">{r.bukti?.startsWith('file:') ? <a className="underline text-brand-700" target="_blank" href={`/api/file/takziah/${r.id}`}>File</a> : r.bukti}</td><td className="text-right">{rupiah(r.amount)}</td></tr>)}
      </tbody></table> : <Empty />}</Card>; })()}
  </div>);
}
