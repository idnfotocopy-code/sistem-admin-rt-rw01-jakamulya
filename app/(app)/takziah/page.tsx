import Link from 'next/link';
import { requireUser, scopeRt } from '@/lib/auth';
import { all, one, today } from '@/lib/db';
import { can } from '@/lib/rbac';
import { rupiah, tgl, tglPendek } from '@/lib/util';
import { takziahSummary } from '@/lib/documents';
import { EV_ST, RV_ST } from '@/lib/takziah';
import { PageHeader, Flash, Card, Badge, Empty, Tabs, Field, RtSelect } from '@/components/ui';
import { buatKejadian, simpanAturan, hapusAturan } from './actions';
import { ConfirmButton } from '@/components/Confirm';

export default function Takziah({ searchParams: sp }: any) {
  const u = requireUser('takziah');
  const rtS = scopeRt(u); const tab = sp.tab || 'kejadian';
  const rts = all('SELECT * FROM rt ORDER BY kode');
  const events = all(`SELECT e.*, rt.kode rt_kode FROM condolence_events e JOIN rt ON rt.id=e.rt_id ${u.role === 'warga' ? `WHERE e.rt_id=${Number(u.rt_id)} OR e.id IN (SELECT event_id FROM condolence_contributions WHERE household_id=${Number(u.household_id)})` : rtS ? 'WHERE e.rt_id=' + rtS : ''} ORDER BY e.tanggal DESC`);
  const rules = all(`SELECT r.*, rt.kode rt_kode FROM condolence_rules r LEFT JOIN rt ON rt.id=r.cakupan_rt_id ${rtS ? `WHERE r.cakupan_rt_id IS NULL OR r.cakupan_rt_id=${rtS}` : ''} ORDER BY r.aktif DESC, r.id`);
  const residents = can.manageTakziah(u.role) ? all(`SELECT r.id, r.nama, h.rt_id, rt.kode FROM residents r JOIN households h ON h.id=r.household_id JOIN rt ON rt.id=h.rt_id WHERE r.status='hidup' ${rtS ? 'AND h.rt_id=' + rtS : ''} ORDER BY r.nama`) : [];
  const editRule = ['ketua_rw', 'sekbend_rw', 'ketua_rt', 'admin'].includes(u.role);
  return (<div>
    <PageHeader title="Iuran Takziah Kematian" desc="Pencatatan kejadian duka, iuran/kontribusi warga per KK sesuai kesepakatan, penyaluran kepada keluarga, rekonsiliasi saldo, dan laporan PDF yang transparan." />
    <Flash sp={sp} />
    <Tabs active={tab} items={[{ key: 'kejadian', label: 'Kejadian Duka', href: '/takziah' }, { key: 'aturan', label: 'Aturan Iuran (Kesepakatan Warga)', href: '/takziah?tab=aturan' }, ...(can.manageTakziah(u.role) ? [{ key: 'baru', label: '+ Catat Kejadian Baru', href: '/takziah?tab=baru' }] : [])]} />

    {tab === 'kejadian' && (events.length ? <div className="grid md:grid-cols-2 gap-4">{events.map(e => {
      const s = takziahSummary(e.id); const my = u.role === 'warga' ? one('SELECT * FROM condolence_contributions WHERE event_id=? AND household_id=?', e.id, u.household_id) : null;
      const pct = s.target ? Math.min(100, Math.round(s.masuk / s.target * 100)) : 0;
      return <Link key={e.id} href={`/takziah/${e.id}`} className="card p-4 hover:shadow-md transition block">
        <div className="flex justify-between gap-2"><div><div className="text-xs font-mono text-slate-500">{e.kode} • RT {e.rt_kode}</div><div className="font-bold text-brand-900 text-lg">🕊 Alm. {e.almarhum}{e.usia ? <span className="text-sm font-normal text-slate-500"> ({e.usia} th)</span> : null}</div><div className="text-xs text-slate-500">{tgl(e.tanggal)} • {e.alamat}</div></div>
          <div className="text-right space-y-1"><Badge color={EV_ST[e.status]?.[1]}>{EV_ST[e.status]?.[0] || e.status}</Badge><br /><Badge color={RV_ST[e.review_status]?.[1]}>{RV_ST[e.review_status]?.[0]}</Badge></div></div>
        <div className="grid grid-cols-3 gap-2 mt-3 text-center text-xs"><div className="rounded bg-emerald-50 p-2"><div className="text-slate-500">Diterima</div><b>{rupiah(s.masuk)}</b></div><div className="rounded bg-sky-50 p-2"><div className="text-slate-500">Disalurkan</div><b>{rupiah(s.bantuan + s.biaya)}</b></div><div className="rounded bg-amber-50 p-2"><div className="text-slate-500">Saldo</div><b>{rupiah(s.saldo)}</b></div></div>
        {s.target > 0 && <div className="mt-3"><div className="h-2 rounded bg-slate-100"><div className="h-2 rounded bg-brand-500" style={{ width: pct + '%' }} /></div><div className="text-[11px] text-slate-500 mt-1">{s.n} KK berkontribusi • {pct}% dari usulan {rupiah(s.target)} ({e.sifat})</div></div>}
        {my && <div className="mt-2 text-xs">Kontribusi keluarga Anda: {my.status === 'belum' ? <Badge color="red">Belum</Badge> : <Badge color="green">{rupiah(my.amount)} • {my.receipt_no}</Badge>}</div>}
      </Link>; })}</div> : <Card><Empty>Belum ada kejadian duka tercatat.</Empty></Card>)}

    {tab === 'aturan' && <div className="space-y-4">
      <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm">Nominal iuran takziah ditetapkan berdasarkan <b>kesepakatan/musyawarah warga</b>. Iuran dapat bersifat wajib, sukarela, atau kombinasi; KK yang kurang mampu boleh membayar sesuai kemampuan dan tercatat sebagai &quot;sukarela&quot;.</div>
      <div className="grid lg:grid-cols-2 gap-4">{rules.map(r => <Card key={r.id} title={<span>{r.nama} {r.aktif ? <Badge color="green">Aktif</Badge> : <Badge>Nonaktif</Badge>}</span>}>
        <form action={simpanAturan} className="grid grid-cols-2 gap-2 text-sm"><input type="hidden" name="id" value={r.id} />
          <Field label="Nama aturan" className="col-span-2"><input name="nama" defaultValue={r.nama} className="input" /></Field>
          <Field label="Nominal usulan/KK"><input name="nominal_default" defaultValue={r.nominal_default} className="input" /></Field>
          <Field label="Sifat"><select name="sifat" defaultValue={r.sifat} className="input"><option value="wajib">Wajib (sesuai kesepakatan)</option><option value="sukarela">Sukarela</option><option value="kombinasi">Kombinasi</option></select></Field>
          <Field label="Berlaku mulai"><input type="date" name="berlaku_mulai" defaultValue={r.berlaku_mulai} className="input" /></Field>
          <Field label="Cakupan">{rtS ? <input disabled className="input" value={r.rt_kode ? 'RT ' + r.rt_kode : 'Seluruh RW 01'} /> : <RtSelect rts={rts} name="cakupan_rt_id" value={r.cakupan_rt_id || ''} />}</Field>
          <Field label="Catatan / dasar kesepakatan" className="col-span-2"><textarea name="catatan" defaultValue={r.catatan || ''} className="input" rows={2} /></Field>
          <label className="flex items-center gap-2"><input type="checkbox" name="aktif" defaultChecked={!!r.aktif} /> Aktif</label>
          <div className="flex gap-2">{editRule && (!rtS || r.cakupan_rt_id === rtS) && <button className="btn btn-sm">Simpan</button>}{can.deleteAny(u.role) && <ConfirmButton formAction={hapusAturan} className="btn btn-sm btn-danger" msg={`Hapus aturan "${r.nama}"?\n\nHanya bisa bila belum dipakai kejadian mana pun.`}>🗑 Hapus</ConfirmButton>}</div>
        </form></Card>)}
        {editRule && <Card title="+ Aturan baru"><form action={simpanAturan} className="grid grid-cols-2 gap-2 text-sm">
          <Field label="Nama aturan" className="col-span-2"><input name="nama" required className="input" placeholder="mis. Iuran Takziah RT 002 2027" /></Field>
          <Field label="Nominal usulan/KK"><input name="nominal_default" className="input" defaultValue="50000" /></Field>
          <Field label="Sifat"><select name="sifat" className="input"><option value="wajib">Wajib</option><option value="sukarela">Sukarela</option><option value="kombinasi">Kombinasi</option></select></Field>
          {!rtS && <Field label="Cakupan"><RtSelect rts={rts} name="cakupan_rt_id" value="" /></Field>}
          <Field label="Catatan" className="col-span-2"><textarea name="catatan" className="input" rows={2} /></Field><input type="hidden" name="aktif" value="1" />
          <button className="btn btn-primary btn-sm col-span-2">Tambah aturan</button></form></Card>}
      </div></div>}

    {tab === 'baru' && can.manageTakziah(u.role) && <Card title="Catat kejadian duka">
      <form action={buatKejadian} className="grid md:grid-cols-2 gap-3">
        <Field label="Nama almarhum/almarhumah"><input name="almarhum" required className="input" /></Field>
        <Field label="Warga terdaftar (opsional)"><select name="resident_id" className="input"><option value="">- bukan/ tidak dipilih -</option>{residents.map(r => <option key={r.id} value={r.id}>{r.nama} (RT {r.kode})</option>)}</select></Field>
        <Field label="Tanggal wafat"><input type="date" name="tanggal" defaultValue={today()} required className="input" /></Field>
        <Field label="Usia"><input type="number" name="usia" className="input" /></Field>
        <Field label="RT">{rtS ? <input disabled className="input" value={`RT ${rts.find(r => r.id === rtS)?.kode}`} /> : <RtSelect rts={rts} all={false} required />}</Field>
        <Field label="Lingkup iuran"><select name="lingkup" className="input"><option value="RT">KK di RT yang sama</option><option value="RW">Seluruh KK RW 01</option></select></Field>
        <Field label="Alamat rumah duka" className="md:col-span-2"><input name="alamat" className="input" /></Field>
        <Field label="Kontak keluarga (nama - telp)"><input name="keluarga_kontak" className="input" placeholder="Ibu ... (istri) - 08..." /></Field>
        <Field label="Aturan iuran"><select name="rule_id" className="input">{rules.filter(r => r.aktif).map(r => <option key={r.id} value={r.id}>{r.nama} - {r.sifat} {r.nominal_default ? rupiah(r.nominal_default) : ''}</option>)}</select></Field>
        <Field label="Nominal usulan/KK (kosong = sesuai aturan)"><input name="nominal_target" className="input" /></Field>
        <Field label="Catatan"><input name="catatan" className="input" placeholder="Lokasi pemakaman, dll." /></Field>
        <div className="md:col-span-2 flex flex-wrap gap-4 text-sm"><label className="flex gap-2 items-center"><input type="checkbox" name="umumkan" defaultChecked /> Terbitkan pengumuman berita duka</label><label className="flex gap-2 items-center"><input type="checkbox" name="tandai_meninggal" defaultChecked /> Tandai status warga &quot;meninggal&quot; (bila dipilih)</label></div>
        <div className="md:col-span-2"><button className="btn btn-primary">Simpan kejadian</button></div>
      </form></Card>}
  </div>);
}
