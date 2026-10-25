import Link from 'next/link';
import { requireUser, scopeRt } from '@/lib/auth';
import { all, one } from '@/lib/db';
import { rupiah, tgl, tglJam, STATUS_SURAT, periodeLabel } from '@/lib/util';
import { Stat, Card, Badge, Flash, Empty } from '@/components/ui';
import { roleLabel } from '@/lib/rbac';
import { takziahSummary } from '@/lib/documents';

export default function Dashboard({ searchParams }: any) {
  const u = requireUser('dashboard');
  const rt = scopeRt(u);
  const W = (col = 'rt_id') => (rt ? ` AND ${col}=${Number(rt)}` : '');
  const isWarga = u.role === 'warga';
  const kk = one(`SELECT COUNT(*) n FROM households WHERE 1=1 ${W()}`).n;
  const jiwa = one(`SELECT COUNT(*) n FROM residents r JOIN households h ON h.id=r.household_id WHERE r.status='hidup' ${W('h.rt_id')}`).n;
  const suratWait = isWarga ? one("SELECT COUNT(*) n FROM letter_requests WHERE user_id=? AND status IN ('diajukan','diverifikasi_rt','diverifikasi_rw')", u.id).n : one(`SELECT COUNT(*) n FROM letter_requests WHERE status IN ('diajukan','diverifikasi_rt','diverifikasi_rw') ${W()}`).n;
  const bulan = new Date().toISOString().slice(0, 7);
  const iuranMasuk = one(`SELECT COALESCE(SUM(p.amount),0) s FROM payments p JOIN dues_invoices i ON i.id=p.invoice_id JOIN households h ON h.id=i.household_id WHERE p.status='terverifikasi' AND i.periode=? ${isWarga ? 'AND h.id=' + Number(u.household_id) : W('h.rt_id')}`, bulan).s;
  const tunggakan = one(`SELECT COUNT(*) n, COALESCE(SUM(nominal),0) s FROM dues_invoices i JOIN households h ON h.id=i.household_id WHERE i.status!='lunas' ${isWarga ? 'AND h.id=' + Number(u.household_id) : W('h.rt_id')}`);
  const saldoKas = one(`SELECT COALESCE(SUM(CASE WHEN jenis='masuk' THEN amount ELSE -amount END),0) s FROM cash_transactions WHERE status='disetujui' ${rt ? "AND buku='RT' AND rt_id=" + Number(rt) : ''}`).s;
  const takziah = all(`SELECT e.*, rt.kode rt_kode FROM condolence_events e JOIN rt ON rt.id=e.rt_id WHERE e.status!='selesai' ORDER BY e.tanggal DESC`);
  const aduan = isWarga ? one("SELECT COUNT(*) n FROM complaints WHERE user_id=? AND status IN ('baru','diproses')", u.id).n : one(`SELECT COUNT(*) n FROM complaints WHERE status IN ('baru','diproses') ${W()}`).n;
  const pengumuman = all(`SELECT a.*, rt.kode rt_kode FROM announcements a LEFT JOIN rt ON rt.id=a.target_rt_id WHERE (a.target_rt_id IS NULL ${rt ? 'OR a.target_rt_id=' + Number(rt) : 'OR 1=1'}) ORDER BY COALESCE(a.tanggal_kegiatan,a.created_at) DESC LIMIT 5`);
  const surat = all(`SELECT lr.*, lt.nama jenis_nama, r.nama pemohon, rt.kode rt_kode FROM letter_requests lr JOIN letter_types lt ON lt.kode=lr.jenis JOIN residents r ON r.id=lr.resident_id JOIN rt ON rt.id=lr.rt_id WHERE 1=1 ${isWarga ? 'AND lr.user_id=' + u.id : W('lr.rt_id')} ORDER BY lr.updated_at DESC LIMIT 6`);
  const perRt = all(`SELECT rt.id, rt.kode, (SELECT COUNT(*) FROM households h WHERE h.rt_id=rt.id) kk, (SELECT COUNT(*) FROM residents r JOIN households h ON h.id=r.household_id WHERE h.rt_id=rt.id AND r.status='hidup') jiwa,
    (SELECT COALESCE(SUM(CASE WHEN jenis='masuk' THEN amount ELSE -amount END),0) FROM cash_transactions c WHERE c.buku='RT' AND c.rt_id=rt.id AND c.status='disetujui') saldo,
    (SELECT COUNT(*) FROM dues_invoices i JOIN households h ON h.id=i.household_id WHERE h.rt_id=rt.id AND i.status!='lunas') tunggak FROM rt ORDER BY kode`);
  const fam = isWarga ? all('SELECT * FROM residents WHERE household_id=? ORDER BY id', u.household_id) : [];
  return (<div>
    <Flash sp={searchParams} />
    <div className="card p-5 mb-5 bg-gradient-to-r from-brand-700 to-brand-500 text-white border-0">
      <div className="text-sm text-brand-100">Selamat datang,</div>
      <div className="text-2xl font-bold">{u.nama}</div>
      <div className="text-sm text-brand-50">{u.jabatan || roleLabel(u.role)} • {rt ? `RT ${u.rt_kode} / ` : ''}RW 01 Kelurahan Jakamulya, Bekasi Selatan</div>
    </div>
    {takziah.length > 0 && (rt ? takziah.some(t => t.rt_id === rt) || true : true) && takziah.map(t => (
      <div key={t.id} className="mb-4 rounded-xl border border-slate-300 bg-slate-800 text-white px-5 py-3 flex flex-wrap items-center gap-3">
        <span className="text-xl">🕊</span>
        <div className="flex-1 text-sm"><b>Berita duka / takziah aktif:</b> Alm. {t.almarhum} (RT {t.rt_kode}), {tgl(t.tanggal)}. Iuran {t.sifat}{t.nominal_target ? ` — usulan ${rupiah(t.nominal_target)}/KK` : ''}.</div>
        <Link href={`/takziah/${t.id}`} className="btn btn-sm btn-gold">Lihat</Link>
      </div>))}
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
      {isWarga ? <Stat label="Anggota Keluarga" value={fam.filter(f => f.status === 'hidup').length} sub="jiwa dalam KK Anda" href="/warga" />
        : <Stat label="Warga / KK" value={`${jiwa} / ${kk}`} sub={rt ? `RT ${u.rt_kode}` : 'Seluruh RW 01'} href="/warga" />}
      <Stat label={isWarga ? 'Surat Saya Diproses' : 'Surat Menunggu'} value={suratWait} sub="verifikasi/persetujuan" color="violet" href="/surat" />
      <Stat label="Iuran Masuk" value={rupiah(iuranMasuk)} sub={`Periode ${periodeLabel(bulan)}`} color="gold" href="/iuran" />
      {isWarga ? <Stat label="Tagihan Belum Lunas" value={tunggakan.n} sub={rupiah(tunggakan.s)} color="red" href="/iuran" />
        : <Stat label="Saldo Kas" value={rupiah(saldoKas)} sub={rt ? `Kas RT ${u.rt_kode}` : 'Kas RW + seluruh RT'} color="sky" href="/kas" />}
      <Stat label="Takziah Aktif" value={takziah.length} sub="kejadian berjalan" color="amber" href="/takziah" />
      <Stat label="Pengaduan Terbuka" value={aduan} sub="baru / diproses" color="red" href="/pengaduan" />
    </div>
    <div className="grid lg:grid-cols-3 gap-5">
      <Card title={isWarga ? 'Status Surat Saya' : 'Aktivitas Surat Terbaru'} actions={<Link href="/surat" className="btn btn-sm">Lihat semua</Link>} className="lg:col-span-2">
        {surat.length ? <div className="overflow-x-auto"><table className="tbl"><thead><tr><th>No. Reg</th><th>Pemohon</th><th>Jenis</th><th>RT</th><th>Status</th><th>Update</th></tr></thead><tbody>
          {surat.map(s => <tr key={s.id}><td className="font-mono text-xs"><Link className="text-brand-700 hover:underline" href={`/surat/${s.id}`}>{s.no_reg}</Link></td><td>{s.pemohon}</td><td>{s.jenis_nama}</td><td>{s.rt_kode}</td><td><Badge color={STATUS_SURAT[s.status]?.color}>{STATUS_SURAT[s.status]?.label}</Badge></td><td className="text-xs text-slate-500">{tglJam(s.updated_at)}</td></tr>)}
        </tbody></table></div> : <Empty />}
      </Card>
      <Card title="Pengumuman & Kegiatan" actions={<Link href="/pengumuman" className="btn btn-sm">Semua</Link>}>
        <div className="space-y-3">{pengumuman.map(a => <div key={a.id} className="border-l-4 border-brand-400 pl-3">
          <div className="text-xs text-slate-500"><Badge color={a.jenis === 'Takziah' ? 'slate' : a.jenis === 'Kerja Bakti' ? 'green' : a.jenis === 'Rapat' ? 'violet' : 'teal'}>{a.jenis}</Badge> {a.rt_kode ? `RT ${a.rt_kode}` : 'Seluruh RW'}</div>
          <div className="font-semibold text-sm mt-1">{a.judul}</div>
          {a.tanggal_kegiatan && <div className="text-xs text-slate-500">📅 {tglJam(a.tanggal_kegiatan)} • {a.lokasi}</div>}
        </div>)}</div>
      </Card>
      {!isWarga && <Card title="Rekap per RT (RW 01)" className="lg:col-span-2">
        <div className="overflow-x-auto"><table className="tbl"><thead><tr><th>RT</th><th>KK</th><th>Jiwa</th><th>Saldo Kas RT</th><th>Tagihan belum lunas</th></tr></thead><tbody>
          {perRt.filter(r => !rt || r.id === rt).map(r => <tr key={r.id}><td className="font-semibold">RT {r.kode}</td><td>{r.kk}</td><td>{r.jiwa}</td><td>{rupiah(r.saldo)}</td><td>{r.tunggak ? <Badge color="red">{r.tunggak} tagihan</Badge> : <Badge color="green">Lunas semua</Badge>}</td></tr>)}
        </tbody></table></div>
      </Card>}
      {isWarga && <Card title="Keluarga Saya" className="lg:col-span-2"><table className="tbl"><thead><tr><th>Nama</th><th>Hubungan</th><th>Status</th></tr></thead><tbody>{fam.map(f => <tr key={f.id}><td>{f.nama}</td><td>{f.hubungan}</td><td>{f.status}</td></tr>)}</tbody></table></Card>}
      {takziah[0] && !isWarga && (() => { const s = takziahSummary(takziah[0].id); return (
        <Card title={`Takziah ${takziah[0].kode}`} actions={<Link href={`/takziah/${takziah[0].id}`} className="btn btn-sm">Detail</Link>}>
          <div className="space-y-1 text-sm"><div className="flex justify-between"><span>Total penerimaan</span><b>{rupiah(s.masuk)}</b></div><div className="flex justify-between"><span>Disalurkan</span><b>{rupiah(s.bantuan)}</b></div><div className="flex justify-between"><span>Biaya sah</span><b>{rupiah(s.biaya)}</b></div><div className="flex justify-between border-t pt-1"><span>Saldo</span><b className="text-brand-700">{rupiah(s.saldo)}</b></div></div>
        </Card>); })()}
    </div>
  </div>);
}
