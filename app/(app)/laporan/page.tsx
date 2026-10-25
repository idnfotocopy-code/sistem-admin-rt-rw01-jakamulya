import { requireUser, scopeRt } from '@/lib/auth';
import { all } from '@/lib/db';
import { can } from '@/lib/rbac';
import { PageHeader, Card, Field } from '@/components/ui';

function RtField({ rts, s, required = false }: any) {
  if (s) return <><input type="hidden" name="rt_id" value={s} /><input disabled className="input" value={`RT ${rts.find((r: any) => r.id === s)?.kode}`} /></>;
  return <select name="rt_id" className="input" required={required}>{!required && <option value="">Seluruh RW 01</option>}{rts.map((r: any) => <option key={r.id} value={r.id}>RT {r.kode}</option>)}</select>;
}

export default function Laporan() {
  const u = requireUser('laporan');
  const s = scopeRt(u); const rts = all('SELECT * FROM rt ORDER BY kode');
  const y = new Date().getFullYear(); const per = new Date().toISOString().slice(0, 7);
  const tk = all(`SELECT c.id, c.kode, c.almarhum, rt.kode rt_kode FROM condolence_events c JOIN rt ON rt.id=c.rt_id ${s ? 'WHERE c.rt_id=' + s : ''} ORDER BY c.id DESC`);
  const Periode = () => <div className="grid grid-cols-2 gap-2"><Field label="Dari"><input type="date" name="from" defaultValue={`${y}-01-01`} className="input" /></Field><Field label="Sampai"><input type="date" name="to" defaultValue={`${y}-12-31`} className="input" /></Field></div>;
  const Btn = () => <div className="flex gap-2 pt-1"><button className="btn btn-primary">⎙ Tampilkan PDF</button><button name="dl" value="1" className="btn">⬇ Unduh</button></div>;
  return (<div>
    <PageHeader title="Laporan PDF" desc="Cetak laporan resmi berkop RW 01 Kelurahan Jakamulya. Setiap pencetakan tercatat di log audit." />
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
      <Card title="📒 Laporan Buku Kas"><form action="/api/pdf/laporan/kas" target="_blank" className="space-y-2">
        {!s && <Field label="Buku"><select name="buku" className="input"><option value="RT">Kas RT</option><option value="RW">Kas RW</option></select></Field>}
        <Field label="RT (untuk kas RT)">{s ? <RtField rts={rts} s={s} /> : <select name="rt_id" className="input">{rts.map(r => <option key={r.id} value={r.id}>RT {r.kode}</option>)}</select>}</Field>
        <Periode /><Btn /></form></Card>
      <Card title="💳 Rekap Iuran Rutin"><form action="/api/pdf/laporan/iuran" target="_blank" className="space-y-2">
        <Field label="Periode"><input type="month" name="periode" defaultValue={per} className="input" /></Field><Field label="Wilayah"><RtField rts={rts} s={s} /></Field><Btn /></form></Card>
      <Card title="⚠ Laporan Tunggakan Iuran"><form action="/api/pdf/laporan/tunggakan" target="_blank" className="space-y-2">
        <Field label="Sampai periode"><input type="month" name="periode" defaultValue={per} className="input" /></Field><Field label="Wilayah"><RtField rts={rts} s={s} /></Field><Btn /></form></Card>
      <Card title="☺ Daftar Warga / KK"><form action="/api/pdf/laporan/warga" target="_blank" className="space-y-2">
        <Field label="Wilayah"><RtField rts={rts} s={s} /></Field>
        {can.seeFullNik(u.role) ? <label className="text-sm flex gap-2 items-center"><input type="checkbox" name="full" value="1" /> Tampilkan NIK lengkap (rahasia)</label> : <p className="text-xs text-slate-500">NIK ditampilkan tersamar sesuai hak akses Anda.</p>}
        <Btn /></form></Card>
      <Card title="✉ Rekap Layanan Surat"><form action="/api/pdf/laporan/surat" target="_blank" className="space-y-2"><Field label="Wilayah"><RtField rts={rts} s={s} /></Field><Periode /><Btn /></form></Card>
      <Card title="⚑ Rekap Pengaduan"><form action="/api/pdf/laporan/pengaduan" target="_blank" className="space-y-2"><Field label="Wilayah"><RtField rts={rts} s={s} /></Field><Periode /><Btn /></form></Card>
      <Card title="🕊 Laporan Takziah per Kejadian" className="md:col-span-2 xl:col-span-3">
        {tk.length ? <table className="tbl"><thead><tr><th>Kode</th><th>Almarhum/ah</th><th>RT</th><th></th></tr></thead><tbody>{tk.map(t => <tr key={t.id}><td className="font-mono text-xs">{t.kode}</td><td>{t.almarhum}</td><td>{t.rt_kode}</td><td className="text-right"><a href={`/api/pdf/takziah/${t.id}`} target="_blank" className="btn btn-sm">⎙ PDF</a> <a href={`/api/pdf/takziah/${t.id}?dl=1`} className="btn btn-sm">⬇</a></td></tr>)}</tbody></table> : <p className="text-sm text-slate-500">Belum ada kejadian takziah.</p>}
      </Card>
    </div>
  </div>);
}
