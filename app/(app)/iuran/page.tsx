import Link from 'next/link';
import { requireUser, scopeRt } from '@/lib/auth';
import { all, one, today } from '@/lib/db';
import { can } from '@/lib/rbac';
import { rupiah, periodeLabel, tglPendek, maskNik } from '@/lib/util';
import { PageHeader, Flash, Card, Badge, Empty, Tabs, Stat, Field, RtSelect } from '@/components/ui';
import { ConfirmButton } from '@/components/Confirm';
import { generateTagihan, catatBayar, konfirmasiTransfer, verifikasiBayar, batalBayar, simpanJenis, hapusTagihan, hapusTagihanMassal, hapusJenis } from './actions';

const ST: Record<string, [string, string]> = { lunas: ['Lunas', 'green'], belum: ['Belum bayar', 'red'], menunggu: ['Menunggu verifikasi', 'amber'] };
const PST: Record<string, [string, string]> = { terverifikasi: ['Terverifikasi', 'green'], menunggu: ['Menunggu', 'amber'], ditolak: ['Ditolak', 'red'], dibatalkan: ['Dibatalkan', 'slate'] };

export default function Iuran({ searchParams: sp }: any) {
  const u = requireUser('iuran');
  if (u.role === 'warga') return <IuranWarga u={u} sp={sp} />;
  const rtS = scopeRt(u); const petugas = can.manageIuran(u.role); const adm = can.deleteAny(u.role);
  const tab = sp.tab || 'tagihan';
  const periode = sp.periode || today().slice(0, 7);
  const rtF = rtS || Number(sp.rt) || null; const st = sp.status || ''; const q = String(sp.q || '');
  const rts = all('SELECT * FROM rt ORDER BY kode');
  const types = all('SELECT * FROM dues_types ORDER BY id');
  const rtW = rtF ? `AND h.rt_id=${Number(rtF)}` : '';
  const rek = one(`SELECT COUNT(*) n, SUM(i.status='lunas') lunas, COALESCE(SUM(CASE WHEN i.status='lunas' THEN i.nominal END),0) masuk, COALESCE(SUM(CASE WHEN i.status!='lunas' THEN i.nominal END),0) kurang FROM dues_invoices i JOIN households h ON h.id=i.household_id WHERE i.periode=? ${rtW}`, periode);
  const pend = one(`SELECT COUNT(*) n FROM payments p JOIN dues_invoices i ON i.id=p.invoice_id JOIN households h ON h.id=i.household_id WHERE p.status='menunggu' ${rtW}`).n;
  const base = `/iuran?periode=${periode}${rtF && !rtS ? '&rt=' + rtF : ''}`;
  const bk = `${base}&tab=${tab}`;
  return (<div>
    <PageHeader title="Iuran Rutin" desc="Tagihan iuran per KK, pencatatan pembayaran tunai/transfer, verifikasi konfirmasi warga, tunggakan, dan kuitansi otomatis.">
      <a className="btn" target="_blank" href={`/api/pdf/laporan/iuran?periode=${periode}${rtF ? '&rt_id=' + rtF : ''}`}>⎙ Laporan PDF</a>
      <a className="btn" target="_blank" href={`/api/pdf/laporan/tunggakan?periode=${periode}${rtF ? '&rt_id=' + rtF : ''}`}>⎙ Tunggakan PDF</a>
    </PageHeader>
    <Flash sp={sp} />
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
      <Stat label={`Tagihan ${periodeLabel(periode)}`} value={rek.n || 0} sub={`${rek.lunas || 0} lunas`} />
      <Stat label="Terkumpul" value={rupiah(rek.masuk)} color="gold" />
      <Stat label="Belum terbayar" value={rupiah(rek.kurang)} color="red" />
      <Stat label="Konfirmasi menunggu" value={pend} color="amber" href={`${base}&tab=konfirmasi`} />
    </div>
    <form className="flex flex-wrap gap-2 mb-3 items-end">
      <input type="hidden" name="tab" value={tab} />
      <Field label="Periode"><input type="month" name="periode" defaultValue={periode} className="input" /></Field>
      {!rtS && <Field label="RT"><RtSelect rts={rts} name="rt" value={rtF || ''} /></Field>}
      {tab === 'tagihan' && <><Field label="Status"><select name="status" defaultValue={st} className="input"><option value="">Semua</option><option value="belum">Belum bayar</option><option value="menunggu">Menunggu</option><option value="lunas">Lunas</option></select></Field>
        <Field label="Cari KK"><input name="q" defaultValue={q} className="input" placeholder="Nama kepala KK" /></Field></>}
      <button className="btn">Tampilkan</button>
    </form>
    <Tabs active={tab} items={[{ key: 'tagihan', label: 'Tagihan', href: `${base}&tab=tagihan` }, { key: 'tunggakan', label: 'Tunggakan', href: `${base}&tab=tunggakan` }, { key: 'konfirmasi', label: `Konfirmasi Transfer (${pend})`, href: `${base}&tab=konfirmasi` }, { key: 'riwayat', label: 'Riwayat & Kuitansi', href: `${base}&tab=riwayat` }, { key: 'jenis', label: 'Jenis Iuran & Buat Tagihan', href: `${base}&tab=jenis` }]} />

    {tab === 'tagihan' && (() => {
      const rows = all(`SELECT i.*, h.kepala_nama, h.alamat, rt.kode rt_kode, dt.nama dn, dt.level, (SELECT id FROM payments p WHERE p.invoice_id=i.id AND p.status='terverifikasi' ORDER BY id DESC LIMIT 1) pid FROM dues_invoices i JOIN households h ON h.id=i.household_id JOIN rt ON rt.id=h.rt_id JOIN dues_types dt ON dt.id=i.dues_type_id WHERE i.periode=@p ${rtW} ${st ? 'AND i.status=@st' : ''} ${q ? 'AND h.kepala_nama LIKE @q' : ''} ORDER BY rt.kode, h.kepala_nama, dt.id`, { p: periode, st, q: `%${q}%` });
      return <Card>{rows.length ? <div className="overflow-x-auto"><table className="tbl"><thead><tr><th>KK</th><th>RT</th><th>Jenis</th><th className="text-right">Nominal</th><th>Status</th><th>Aksi</th></tr></thead><tbody>
        {rows.map(r => <tr key={r.id}><td><Link className="font-medium text-brand-800 hover:underline" href={`/warga/${r.household_id}`}>{r.kepala_nama}</Link><div className="text-xs text-slate-500">{r.alamat}</div></td><td>{r.rt_kode}</td><td>{r.dn} <span className="text-[10px] text-slate-400">({r.level})</span></td><td className="text-right">{rupiah(r.nominal)}</td><td><Badge color={ST[r.status]?.[1]}>{ST[r.status]?.[0] || r.status}</Badge></td>
          <td>{r.status === 'lunas' && r.pid ? <a className="btn btn-sm" target="_blank" href={`/api/pdf/kuitansi-iuran/${r.pid}`}>Kuitansi</a>
            : r.status === 'menunggu' ? <Link className="btn btn-sm" href={`${base}&tab=konfirmasi`}>Verifikasi</Link>
            : petugas ? <form action={catatBayar} className="flex gap-1 items-center"><input type="hidden" name="invoice_id" value={r.id} /><input type="hidden" name="back" value={bk} />
              <select name="method" className="input !py-1 !text-xs w-24"><option>Tunai</option><option>Transfer</option><option>QRIS</option><option>E-wallet</option></select>
              <input type="date" name="tanggal" defaultValue={today()} className="input !py-1 !text-xs w-32" />
              <ConfirmButton className="btn btn-sm btn-primary" msg={`Catat pembayaran ${rupiah(r.nominal)} dari ${r.kepala_nama}?`}>Bayar</ConfirmButton></form> : adm ? null : <span className="text-xs text-slate-400">-</span>}
            {adm && r.status !== 'lunas' && <form action={hapusTagihan} className="inline-block mt-1"><input type="hidden" name="invoice_id" value={r.id} /><input type="hidden" name="back" value={bk} /><ConfirmButton className="btn btn-sm btn-danger" msg={`Hapus tagihan ${r.dn} ${periodeLabel(r.periode)} untuk KK ${r.kepala_nama} (${rupiah(r.nominal)})?${r.status === 'menunggu' ? '\n\nKonfirmasi transfer yang menunggu verifikasi ikut dihapus.' : ''}`}>🗑 Hapus</ConfirmButton></form>}</td></tr>)}
      </tbody></table></div> : <Empty>Belum ada tagihan untuk periode ini. Buat tagihan di tab &quot;Jenis Iuran &amp; Buat Tagihan&quot;.</Empty>}</Card>;
    })()}

    {tab === 'tunggakan' && (() => {
      const rows = all(`SELECT h.id, h.kepala_nama, h.alamat, h.telp, rt.kode rt_kode, COUNT(i.id) n, SUM(i.nominal) total, GROUP_CONCAT(dt.nama || ' ' || i.periode, '; ') rincian, MIN(i.periode) sejak FROM dues_invoices i JOIN households h ON h.id=i.household_id JOIN rt ON rt.id=h.rt_id JOIN dues_types dt ON dt.id=i.dues_type_id WHERE i.status!='lunas' AND i.periode<=? ${rtW} GROUP BY h.id ORDER BY total DESC`, periode);
      return <Card title={`Daftar tunggakan s.d. ${periodeLabel(periode)}`}>{rows.length ? <table className="tbl"><thead><tr><th>KK</th><th>RT</th><th>Telp</th><th>Rincian</th><th>Sejak</th><th className="text-right">Jumlah</th></tr></thead><tbody>
        {rows.map(r => <tr key={r.id}><td><Link href={`/warga/${r.id}`} className="font-medium text-brand-800 hover:underline">{r.kepala_nama}</Link><div className="text-xs text-slate-500">{r.alamat}</div></td><td>{r.rt_kode}</td><td className="text-xs">{r.telp || '-'}</td><td className="text-xs">{r.rincian}</td><td className="text-xs">{periodeLabel(r.sejak)}</td><td className="text-right font-semibold text-red-700">{rupiah(r.total)}<div className="text-[10px] text-slate-400">{r.n} tagihan</div></td></tr>)}
        <tr className="font-bold"><td colSpan={5}>Total tunggakan</td><td className="text-right text-red-700">{rupiah(rows.reduce((a, r) => a + r.total, 0))}</td></tr>
      </tbody></table> : <Empty>Tidak ada tunggakan. 🎉</Empty>}</Card>;
    })()}

    {tab === 'konfirmasi' && (() => {
      const rows = all(`SELECT p.*, i.periode, dt.nama dn, h.kepala_nama, rt.kode rt_kode FROM payments p JOIN dues_invoices i ON i.id=p.invoice_id JOIN dues_types dt ON dt.id=i.dues_type_id JOIN households h ON h.id=i.household_id JOIN rt ON rt.id=h.rt_id WHERE p.status='menunggu' ${rtW} ORDER BY p.created_at`);
      return <Card title="Konfirmasi pembayaran dari warga">{rows.length ? <div className="space-y-3">{rows.map(r => <div key={r.id} className="rounded-lg border p-3 flex flex-wrap gap-4 justify-between">
        <div className="text-sm"><div className="font-semibold">{r.kepala_nama} <span className="text-xs text-slate-500">RT {r.rt_kode}</span></div><div>{r.dn} • {periodeLabel(r.periode)} • <b>{rupiah(r.amount)}</b></div><div className="text-xs text-slate-500">{r.method} • ref <span className="font-mono">{r.ref}</span> • {tglPendek(r.tanggal)} • {r.catatan}</div>
          {r.bukti_file ? <a target="_blank" className="text-xs text-brand-700 underline" href={`/api/file/bayar/${r.id}`}>Lihat bukti transfer</a> : <span className="text-xs text-slate-400">(data demo tanpa file bukti)</span>}</div>
        {petugas ? <div className="flex flex-col gap-2 min-w-[260px]">
          <form action={verifikasiBayar}><input type="hidden" name="payment_id" value={r.id} /><input type="hidden" name="back" value={bk} /><input type="hidden" name="aksi" value="terima" /><button className="btn btn-primary btn-sm w-full">✓ Verifikasi & terbitkan kuitansi</button></form>
          <form action={verifikasiBayar} className="flex gap-1"><input type="hidden" name="payment_id" value={r.id} /><input type="hidden" name="back" value={bk} /><input type="hidden" name="aksi" value="tolak" /><input name="alasan" className="input !py-1 !text-xs" placeholder="Alasan tolak" /><button className="btn btn-sm btn-danger">Tolak</button></form>
        </div> : <Badge color="amber">Menunggu bendahara</Badge>}
      </div>)}</div> : <Empty>Tidak ada konfirmasi yang menunggu.</Empty>}</Card>;
    })()}

    {tab === 'riwayat' && (() => {
      const rows = all(`SELECT p.*, i.periode, dt.nama dn, h.kepala_nama, rt.kode rt_kode, u.nama penerima FROM payments p JOIN dues_invoices i ON i.id=p.invoice_id JOIN dues_types dt ON dt.id=i.dues_type_id JOIN households h ON h.id=i.household_id JOIN rt ON rt.id=h.rt_id LEFT JOIN users u ON u.id=p.received_by WHERE substr(p.tanggal,1,7)=? ${rtW} ORDER BY p.tanggal DESC, p.id DESC`, periode);
      return <Card title={`Pembayaran diterima bulan ${periodeLabel(periode)}`}>{rows.length ? <div className="overflow-x-auto"><table className="tbl"><thead><tr><th>Tanggal</th><th>No. Kuitansi</th><th>KK</th><th>Untuk</th><th className="text-right">Jumlah</th><th>Metode</th><th>Status</th><th></th></tr></thead><tbody>
        {rows.map(r => <tr key={r.id}><td className="text-xs">{tglPendek(r.tanggal)}</td><td className="font-mono text-xs">{r.receipt_no || '-'}</td><td>{r.kepala_nama} <span className="text-xs text-slate-500">RT {r.rt_kode}</span></td><td className="text-xs">{r.dn} {periodeLabel(r.periode)}</td><td className="text-right">{rupiah(r.amount)}</td><td className="text-xs">{r.method}{r.ref ? <div className="font-mono text-[10px]">{r.ref}</div> : null}</td>
          <td><Badge color={PST[r.status]?.[1]}>{PST[r.status]?.[0] || r.status}</Badge>{r.cancel_reason && <div className="text-[10px] text-slate-500 max-w-[160px]">{r.cancel_reason}</div>}</td>
          <td className="whitespace-nowrap">{r.receipt_no && <a target="_blank" className="btn btn-sm" href={`/api/pdf/kuitansi-iuran/${r.id}`}>Kuitansi</a>}
            {petugas && r.status === 'terverifikasi' && <details className="inline-block ml-1"><summary className="btn btn-sm btn-danger cursor-pointer">Batalkan</summary><form action={batalBayar} className="mt-1 flex gap-1"><input type="hidden" name="payment_id" value={r.id} /><input type="hidden" name="back" value={bk} /><input name="alasan" required className="input !py-1 !text-xs" placeholder="Alasan koreksi" /><button className="btn btn-sm btn-danger">OK</button></form></details>}</td></tr>)}
      </tbody></table></div> : <Empty>Belum ada pembayaran di bulan ini.</Empty>}</Card>;
    })()}

    {tab === 'jenis' && <div className="grid lg:grid-cols-2 gap-4">
      <Card title="Jenis iuran">
        <div className="space-y-3">{types.map(t => <form key={t.id} action={simpanJenis} className="rounded-lg border p-3 grid grid-cols-2 gap-2 text-sm"><input type="hidden" name="id" value={t.id} />
          <Field label="Nama" className="col-span-2"><input name="nama" defaultValue={t.nama} className="input" /></Field>
          <Field label="Nominal (Rp)"><input name="nominal" defaultValue={t.nominal} className="input" /></Field>
          <Field label="Level kas"><select name="level" defaultValue={t.level} className="input"><option value="RT">Kas RT</option><option value="RW">Kas RW</option></select></Field>
          <Field label="Periode"><select name="periode" defaultValue={t.periode} className="input"><option>bulanan</option><option>tahunan</option><option>sekali</option></select></Field>
          <label className="flex items-center gap-2 mt-6"><input type="checkbox" name="aktif" defaultChecked={!!t.aktif} /> Aktif</label>
          <Field label="Keterangan" className="col-span-2"><input name="keterangan" defaultValue={t.keterangan || ''} className="input" /></Field>
          {['admin', 'sekbend_rw'].includes(u.role) && <div className="col-span-2 flex gap-2"><button className="btn btn-sm flex-1">Simpan perubahan</button>{adm && <ConfirmButton formAction={hapusJenis} className="btn btn-sm btn-danger" msg={`Hapus jenis iuran "${t.nama}"?\n\nHanya bisa bila belum pernah dipakai di tagihan.`}>🗑 Hapus</ConfirmButton>}</div>}
        </form>)}
          {['admin', 'sekbend_rw'].includes(u.role) && <form action={simpanJenis} className="rounded-lg border border-dashed p-3 grid grid-cols-2 gap-2 text-sm"><div className="col-span-2 font-semibold">+ Jenis iuran baru</div>
            <Field label="Nama" className="col-span-2"><input name="nama" className="input" required /></Field><Field label="Nominal"><input name="nominal" className="input" required /></Field>
            <Field label="Level kas"><select name="level" className="input"><option value="RT">Kas RT</option><option value="RW">Kas RW</option></select></Field><input type="hidden" name="aktif" value="1" /><button className="btn btn-primary btn-sm col-span-2">Tambah</button></form>}
        </div>
      </Card>
      <Card title="Buat tagihan periode">
        {petugas || u.role === 'admin' ? <form action={generateTagihan} className="space-y-3"><input type="hidden" name="back" value={`${base}&tab=tagihan`} />
          <Field label="Jenis iuran"><select name="dues_type_id" className="input">{types.filter(t => t.aktif).map(t => <option key={t.id} value={t.id}>{t.nama} - {rupiah(t.nominal)}</option>)}</select></Field>
          <Field label="Periode"><input type="month" name="periode" defaultValue={periode} className="input" required /></Field>
          {!rtS && <Field label="Cakupan RT"><RtSelect rts={rts} value="" /></Field>}
          <p className="text-xs text-slate-500">Tagihan dibuat untuk setiap KK aktif (domisili bukan &quot;pindah&quot; dan memiliki anggota hidup). Tagihan ganda otomatis dicegah.</p>
          <button className="btn btn-primary">Buat tagihan</button></form> : <Empty>Hanya bendahara yang dapat membuat tagihan.</Empty>}
      </Card>
      {adm && <Card title="Zona Admin — Hapus tagihan belum bayar (massal)" className="lg:col-start-2 border-red-200">
        <form action={hapusTagihanMassal} className="space-y-3"><input type="hidden" name="back" value={`${base}&tab=tagihan`} />
          <Field label="Jenis iuran"><select name="dues_type_id" className="input">{types.map(t => <option key={t.id} value={t.id}>{t.nama}</option>)}</select></Field>
          <Field label="Periode"><input type="month" name="periode" defaultValue={periode} className="input" required /></Field>
          <Field label="Cakupan RT"><RtSelect rts={rts} value="" /></Field>
          <p className="text-xs text-slate-500">Untuk membatalkan tagihan yang salah dibuat. Hanya tagihan berstatus &quot;belum bayar&quot; tanpa riwayat kuitansi yang dihapus; tagihan lunas/menunggu verifikasi tidak tersentuh.</p>
          <ConfirmButton className="btn btn-danger" msg="Hapus SEMUA tagihan belum bayar untuk jenis, periode, dan RT yang dipilih?">🗑 Hapus tagihan belum bayar</ConfirmButton></form>
      </Card>}
    </div>}
  </div>);
}

function IuranWarga({ u, sp }: any) {
  const rows = all(`SELECT i.*, dt.nama dn, (SELECT id FROM payments p WHERE p.invoice_id=i.id AND p.status='terverifikasi' ORDER BY id DESC LIMIT 1) pid, (SELECT status||'|'||COALESCE(cancel_reason,'') FROM payments p WHERE p.invoice_id=i.id ORDER BY id DESC LIMIT 1) last FROM dues_invoices i JOIN dues_types dt ON dt.id=i.dues_type_id WHERE i.household_id=? ORDER BY i.periode DESC, dt.id`, u.household_id);
  const hh = one('SELECT h.*, rt.kode rt_kode FROM households h JOIN rt ON rt.id=h.rt_id WHERE h.id=?', u.household_id);
  const kurang = rows.filter(r => r.status === 'belum').reduce((a, r) => a + r.nominal, 0);
  const s = one('SELECT * FROM settings WHERE key=?', 'rekening_rt');
  return (<div>
    <PageHeader title="Iuran Keluarga Saya" desc={`KK ${maskNik(hh?.no_kk)} • ${hh?.kepala_nama} • RT ${hh?.rt_kode}/RW 01`} />
    <Flash sp={sp} />
    <div className="grid sm:grid-cols-3 gap-3 mb-5"><Stat label="Tagihan belum dibayar" value={rupiah(kurang)} color="red" /><Stat label="Jumlah tagihan" value={rows.length} /><Stat label="Lunas" value={rows.filter(r => r.status === 'lunas').length} color="gold" /></div>
    <div className="rounded-lg bg-sky-50 border border-sky-200 p-3 text-sm mb-4">💡 Pembayaran tunai: serahkan ke Bendahara RT, kuitansi langsung tercatat. Transfer/QRIS: {s?.value || 'transfer ke rekening Bendahara RT (lihat pengumuman)'}, lalu kirim konfirmasi beserta bukti di bawah ini. <b>Demo:</b> tidak ada payment gateway sungguhan.</div>
    <Card title="Daftar tagihan">{rows.length ? <table className="tbl"><thead><tr><th>Periode</th><th>Jenis</th><th className="text-right">Nominal</th><th>Status</th><th>Aksi</th></tr></thead><tbody>
      {rows.map(r => { const [ls, lr] = (r.last || '').split('|'); return <tr key={r.id}><td>{periodeLabel(r.periode)}</td><td>{r.dn}</td><td className="text-right">{rupiah(r.nominal)}</td><td><Badge color={ST[r.status]?.[1]}>{ST[r.status]?.[0]}</Badge>{r.status === 'belum' && ls === 'ditolak' && <div className="text-[10px] text-red-600">Konfirmasi sebelumnya ditolak: {lr}</div>}</td>
        <td>{r.status === 'lunas' && r.pid ? <a className="btn btn-sm" target="_blank" href={`/api/pdf/kuitansi-iuran/${r.pid}`}>Kuitansi</a> : r.status === 'belum' ? <details><summary className="btn btn-sm btn-primary cursor-pointer">Konfirmasi bayar</summary>
          <form action={konfirmasiTransfer} className="mt-2 grid gap-2 p-2 rounded border bg-slate-50 min-w-[260px]"><input type="hidden" name="invoice_id" value={r.id} />
            <select name="method" className="input !py-1"><option>Transfer</option><option>QRIS</option><option>E-wallet</option></select>
            <input name="ref" required placeholder="No. referensi transaksi" className="input !py-1" /><input type="date" name="tanggal" defaultValue={today()} className="input !py-1" />
            <input type="file" name="bukti" accept=".jpg,.jpeg,.png,.pdf" required className="text-xs" /><button className="btn btn-sm btn-primary">Kirim konfirmasi</button></form></details> : <span className="text-xs text-amber-700">Sedang diverifikasi bendahara</span>}</td></tr>; })}
    </tbody></table> : <Empty>Belum ada tagihan.</Empty>}</Card>
  </div>);
}
