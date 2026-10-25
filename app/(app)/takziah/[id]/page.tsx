import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireUser, scopeRt } from '@/lib/auth';
import { all, one, today } from '@/lib/db';
import { can } from '@/lib/rbac';
import { rupiah, tgl, tglPendek, tglJam, maskNik } from '@/lib/util';
import { takziahSummary } from '@/lib/documents';
import { EV_ST, RV_ST } from '@/lib/takziah';
import { PageHeader, Flash, Card, Badge, Empty, Stat, Field } from '@/components/ui';
import { ConfirmButton } from '@/components/Confirm';
import { catatKontribusi, batalKontribusi, tambahPenyaluran, reviewKejadian, hapusKejadian } from '../actions';

export default function Detail({ params, searchParams: sp }: any) {
  const u = requireUser('takziah');
  const e = one('SELECT e.*, rt.kode rt_kode, r.nama rule_nama, cu.nama pembuat, ru.nama reviewer FROM condolence_events e JOIN rt ON rt.id=e.rt_id LEFT JOIN condolence_rules r ON r.id=e.rule_id LEFT JOIN users cu ON cu.id=e.created_by LEFT JOIN users ru ON ru.id=e.reviewed_by WHERE e.id=?', Number(params.id));
  if (!e) notFound();
  const rtS = scopeRt(u);
  const mine = u.role === 'warga' ? one('SELECT 1 FROM condolence_contributions WHERE event_id=? AND household_id=?', e.id, u.household_id) : null;
  if (rtS && rtS !== e.rt_id && !mine) redirect('/takziah?err=' + encodeURIComponent('Kejadian di luar RT Anda.'));
  const s = takziahSummary(e.id);
  const fin = can.financeTakziah(u.role) && (!rtS || rtS === e.rt_id); const lock = e.status === 'selesai' && e.review_status === 'disetujui';
  const contribs = all(`SELECT c.*, h.kepala_nama, h.no_kk, h.alamat, rt.kode rt_kode FROM condolence_contributions c JOIN households h ON h.id=c.household_id JOIN rt ON rt.id=h.rt_id WHERE c.event_id=? ORDER BY c.status='belum', c.tanggal, h.kepala_nama`, e.id);
  const dis = all('SELECT d.*, u.nama oleh FROM condolence_disbursements d LEFT JOIN users u ON u.id=d.created_by WHERE event_id=? ORDER BY tanggal', e.id);
  const kasIn = one("SELECT COALESCE(SUM(CASE WHEN ref_type='takziah_in' AND jenis='masuk' THEN amount WHEN ref_type='takziah_in_rev' THEN -amount END),0) s FROM cash_transactions WHERE (ref_type IN ('takziah_in','takziah_in_rev')) AND ref_id IN (SELECT id FROM condolence_contributions WHERE event_id=?)", e.id).s;
  const kasOut = one("SELECT COALESCE(SUM(amount),0) s FROM cash_transactions WHERE ref_type='takziah_out' AND ref_id IN (SELECT id FROM condolence_disbursements WHERE event_id=?)", e.id).s;
  const cocok = kasIn === s.masuk && kasOut === s.bantuan + s.biaya;
  const belum = contribs.filter(c => c.status === 'belum').length;
  const warga = u.role === 'warga';
  return (<div>
    <PageHeader title={`Takziah: Alm. ${e.almarhum}`} desc={`${e.kode} • RT ${e.rt_kode}/RW 01 • wafat ${tgl(e.tanggal)}${e.usia ? ` • usia ${e.usia} th` : ''}`}>
      <Link href="/takziah" className="btn">← Kembali</Link>
      <a href={`/api/pdf/takziah/${e.id}`} target="_blank" className="btn btn-primary">⎙ Laporan PDF</a>
    </PageHeader>
    <Flash sp={sp} />
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
      <Stat label="Total penerimaan" value={rupiah(s.masuk)} sub={`${s.n} KK`} />
      <Stat label="Disalurkan ke keluarga" value={rupiah(s.bantuan)} color="sky" />
      <Stat label="Biaya sah" value={rupiah(s.biaya)} color="violet" />
      <Stat label="Saldo" value={rupiah(s.saldo)} color="gold" sub="terima - salur - biaya" />
      <Stat label="Belum berkontribusi" value={`${belum} KK`} color="red" />
    </div>
    <div className="grid lg:grid-cols-3 gap-4 mb-4">
      <Card title="Informasi kejadian" className="lg:col-span-2"><div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
        <div><span className="text-slate-500">Alamat rumah duka:</span> {e.alamat || '-'}</div><div><span className="text-slate-500">Kontak keluarga:</span> {e.keluarga_kontak || '-'}</div>
        <div><span className="text-slate-500">Aturan:</span> {e.rule_nama || '-'}</div><div><span className="text-slate-500">Usulan/KK:</span> {e.nominal_target ? rupiah(e.nominal_target) : '-'} ({e.sifat})</div>
        <div><span className="text-slate-500">Status:</span> <Badge color={EV_ST[e.status]?.[1]}>{EV_ST[e.status]?.[0]}</Badge></div><div><span className="text-slate-500">Pemeriksaan:</span> <Badge color={RV_ST[e.review_status]?.[1]}>{RV_ST[e.review_status]?.[0]}</Badge>{e.reviewer && <span className="text-xs text-slate-500"> oleh {e.reviewer}, {tglJam(e.reviewed_at)}</span>}</div>
        <div className="sm:col-span-2"><span className="text-slate-500">Catatan:</span> {e.catatan || '-'}</div>
        {e.review_note && <div className="sm:col-span-2 text-amber-800 bg-amber-50 rounded p-2">Catatan pemeriksa: {e.review_note}</div>}
        <div className="sm:col-span-2 text-xs text-slate-400">Dicatat oleh {e.pembuat}</div></div></Card>
      <Card title="Rekonsiliasi & pemeriksaan">
        <div className={`rounded p-2 text-sm mb-3 ${cocok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>{cocok ? '✓ Cocok dengan buku kas RT' : '⚠ Selisih dengan buku kas'}<div className="text-xs mt-1">Kas masuk takziah: {rupiah(kasIn)} • kas keluar: {rupiah(kasOut)}</div></div>
        {!warga && <div className="space-y-2">
          {can.manageTakziah(u.role) && e.review_status === 'draft' && <form action={reviewKejadian}><input type="hidden" name="event_id" value={e.id} /><input type="hidden" name="aksi" value="ajukan" /><button className="btn btn-sm w-full">Ajukan laporan untuk diperiksa</button></form>}
          {can.reviewTakziah(u.role) && e.review_status === 'diajukan' && <form action={reviewKejadian} className="space-y-2"><input type="hidden" name="event_id" value={e.id} /><textarea name="catatan" className="input" rows={2} placeholder="Catatan pemeriksaan" />
            <div className="flex gap-2"><button name="aksi" value="setujui" className="btn btn-primary btn-sm flex-1">✓ Setujui & tutup</button><button name="aksi" value="revisi" className="btn btn-sm flex-1">Minta revisi</button></div></form>}
          {u.role === 'ketua_rw' && lock && <form action={reviewKejadian} className="flex gap-1"><input type="hidden" name="event_id" value={e.id} /><input type="hidden" name="aksi" value="buka" /><input name="catatan" className="input !py-1 !text-xs" placeholder="Alasan buka ulang" /><button className="btn btn-sm">Buka ulang</button></form>}
          {lock && <div className="text-xs text-slate-500">Laporan terkunci; perubahan tercatat di audit log.</div>}
        </div>}
        {can.deleteAny(u.role) && <form action={hapusKejadian} className="mt-3 pt-3 border-t border-red-100 space-y-2"><input type="hidden" name="event_id" value={e.id} />
          <div className="text-xs font-semibold text-red-700">Zona Admin — Hapus kejadian</div>
          {s.n > 0 || dis.length > 0 ? <><p className="text-xs text-slate-500">Sudah ada dana tercatat. Hapus paksa akan menghapus kontribusi & penyaluran, dan membuat jurnal pembalik di buku kas (transaksi kas disetujui tidak dihapus).</p>
            <input name="konfirmasi" required placeholder="ketik HAPUS" className="input !py-1 !text-xs" autoComplete="off" /></> : <p className="text-xs text-slate-500">Belum ada dana tercatat; kejadian & daftar kontribusi kosong akan dihapus.</p>}
          <ConfirmButton className="btn btn-sm btn-danger w-full" msg={`HAPUS kejadian ${e.kode} (Alm. ${e.almarhum})?${s.n > 0 || dis.length > 0 ? '\n\nPERINGATAN: dana sudah tercatat — kontribusi & penyaluran ikut dihapus, posting kas dibalik.' : ''}`}>🗑 Hapus kejadian</ConfirmButton></form>}
      </Card>
    </div>

    <Card title={`Daftar kontribusi per KK (${contribs.length})`} className="mb-4">
      {contribs.length ? <div className="overflow-x-auto"><table className="tbl"><thead><tr><th>KK</th><th>Usulan</th><th>Tanggal</th><th className="text-right">Nominal</th><th>Metode</th><th>Kuitansi</th><th>Status</th>{fin && !lock && <th>Catat</th>}</tr></thead><tbody>
        {contribs.map(c => { const own = warga && c.household_id === u.household_id; return <tr key={c.id} className={own ? 'bg-brand-50' : ''}><td>{warga && !own ? c.kepala_nama.split(' ')[0] + ' ***' : c.kepala_nama}<div className="text-[10px] text-slate-400">{warga ? '' : maskNik(c.no_kk) + ' • RT ' + c.rt_kode}</div></td><td className="text-xs">{c.expected ? rupiah(c.expected) : 'sukarela'}</td><td className="text-xs">{tglPendek(c.tanggal)}</td><td className="text-right">{c.amount ? rupiah(c.amount) : '-'}</td><td className="text-xs">{c.method || '-'}</td>
          <td className="text-xs">{c.receipt_no ? (warga && !own ? c.receipt_no : <a className="text-brand-700 underline font-mono" target="_blank" href={`/api/pdf/kuitansi-takziah/${c.id}`}>{c.receipt_no}</a>) : '-'}</td>
          <td>{c.status === 'belum' ? <Badge color="red">Belum</Badge> : c.status === 'sukarela' ? <Badge color="sky">Sesuai kemampuan</Badge> : <Badge color="green">Lunas</Badge>}{c.catatan && <div className="text-[10px] text-slate-500 max-w-[200px]">{c.catatan}</div>}</td>
          {fin && !lock && <td>{c.status === 'belum' ? <form action={catatKontribusi} className="flex gap-1"><input type="hidden" name="id" value={c.id} /><input name="amount" defaultValue={c.expected || ''} placeholder="Rp" className="input !py-1 !text-xs w-20" /><select name="method" className="input !py-1 !text-xs w-20"><option>Tunai</option><option>Transfer</option><option>QRIS</option></select><input type="date" name="tanggal" defaultValue={today()} className="input !py-1 !text-xs w-32" /><button className="btn btn-sm btn-primary">Simpan</button></form>
            : <details><summary className="text-xs text-red-600 cursor-pointer">koreksi</summary><form action={batalKontribusi} className="flex gap-1 mt-1"><input type="hidden" name="id" value={c.id} /><input name="alasan" className="input !py-1 !text-xs" placeholder="Alasan" required /><button className="btn btn-sm btn-danger">Batalkan</button></form></details>}</td>}</tr>; })}
      </tbody></table></div> : <Empty />}
      {warga && <p className="text-xs text-slate-500 mt-2">Demi privasi, nama KK lain disamarkan. Untuk berkontribusi, serahkan ke Bendahara RT {e.rt_kode}; kuitansi akan muncul di baris keluarga Anda.</p>}
    </Card>

    <div className="grid lg:grid-cols-3 gap-4">
      <Card title="Penyaluran & biaya" className="lg:col-span-2">{dis.length ? <table className="tbl"><thead><tr><th>Tanggal</th><th>Jenis</th><th>Penerima</th><th>Saksi</th><th>Bukti</th><th className="text-right">Nominal</th></tr></thead><tbody>
        {dis.map(d => <tr key={d.id}><td className="text-xs">{tglPendek(d.tanggal)}</td><td>{d.jenis === 'biaya' ? <Badge color="violet">Biaya</Badge> : <Badge color="sky">Bantuan</Badge>}</td><td>{d.penerima}<div className="text-[10px] text-slate-500">{d.keterangan}</div></td><td className="text-xs">{d.saksi || '-'}</td><td className="text-xs">{d.bukti?.startsWith('file:') ? (warga ? 'Terlampir' : <a className="underline text-brand-700" target="_blank" href={`/api/file/takziah/${d.id}`}>Lihat file</a>) : d.bukti || '-'}</td><td className="text-right">{rupiah(d.amount)}</td></tr>)}
      </tbody></table> : <Empty>Belum ada penyaluran.</Empty>}</Card>
      {fin && !lock ? <Card title="+ Catat penyaluran / biaya"><form action={tambahPenyaluran} className="space-y-2 text-sm"><input type="hidden" name="event_id" value={e.id} />
        <Field label="Jenis"><select name="jenis" className="input"><option value="bantuan">Bantuan diserahkan ke keluarga</option><option value="biaya">Biaya sah (transport, perlengkapan, dll.)</option></select></Field>
        <Field label="Nominal (Rp)"><input name="amount" required className="input" defaultValue={s.saldo > 0 ? s.saldo : ''} /></Field>
        <Field label="Tanggal"><input type="date" name="tanggal" defaultValue={today()} className="input" /></Field>
        <Field label="Penerima"><input name="penerima" required className="input" defaultValue={e.keluarga_kontak?.split(/ [–-] /)[0] || ''} /></Field>
        <Field label="Saksi"><input name="saksi" className="input" placeholder="Ketua RT, tokoh warga" /></Field>
        <Field label="No. berita acara / bukti"><input name="bukti" className="input" /></Field>
        <Field label="Lampiran bukti (JPG/PNG/PDF ≤2MB)"><input type="file" name="bukti_file" accept=".jpg,.jpeg,.png,.pdf" className="text-xs" /></Field>
        <Field label="Keterangan"><input name="keterangan" className="input" /></Field>
        <ConfirmButton className="btn btn-primary w-full" msg="Catat penyaluran ini? Transaksi akan masuk buku kas RT.">Simpan penyaluran</ConfirmButton></form></Card>
        : <Card title="Ringkasan"><div className="text-sm space-y-1"><div className="flex justify-between"><span>Penerimaan</span><b>{rupiah(s.masuk)}</b></div><div className="flex justify-between"><span>Penyaluran</span><b>- {rupiah(s.bantuan)}</b></div><div className="flex justify-between"><span>Biaya sah</span><b>- {rupiah(s.biaya)}</b></div><div className="flex justify-between border-t pt-1"><span>Saldo</span><b>{rupiah(s.saldo)}</b></div></div></Card>}
    </div>
  </div>);
}
