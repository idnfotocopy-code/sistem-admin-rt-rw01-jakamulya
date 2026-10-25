import Link from 'next/link';
import { requireUser, scopeRt } from '@/lib/auth';
import { all } from '@/lib/db';
import { can } from '@/lib/rbac';
import { STATUS_SURAT, tglJam } from '@/lib/util';
import { PageHeader, Flash, Card, Badge, Empty, Field, Tabs } from '@/components/ui';
import { ajukanSurat } from './actions';
import { HapusSurat } from '@/components/HapusSurat';
import { needsMe } from '@/lib/surat';

export default function Surat({ searchParams }: any) {
  const u = requireUser('surat');
  const rt = scopeRt(u);
  const tab = String(searchParams.tab || (u.role === 'warga' || u.role === 'admin' ? 'semua' : 'tindakan'));
  let rows = all(`SELECT lr.*, lt.nama jn, lt.butuh_kelurahan, r.nama pemohon, rt.kode rt_kode, i.nomor FROM letter_requests lr JOIN letter_types lt ON lt.kode=lr.jenis JOIN residents r ON r.id=lr.resident_id JOIN rt ON rt.id=lr.rt_id LEFT JOIN issued_letters i ON i.request_id=lr.id
    WHERE 1=1 ${u.role === 'warga' ? 'AND lr.household_id=' + Number(u.household_id) : rt ? 'AND lr.rt_id=' + rt : ''} ORDER BY lr.updated_at DESC`);
  if (u.role === 'kelurahan' && tab !== 'semua') rows = rows.filter(r => r.butuh_kelurahan || r.status === 'terbit');
  const view = tab === 'tindakan' ? rows.filter(r => needsMe(u, r)) : tab === 'proses' ? rows.filter(r => ['diajukan', 'diverifikasi_rt', 'diverifikasi_rw'].includes(r.status)) : tab === 'selesai' ? rows.filter(r => ['terbit', 'ditolak'].includes(r.status)) : tab === 'kembali' ? rows.filter(r => r.status === 'dikembalikan') : rows;
  const types = all('SELECT * FROM letter_types WHERE aktif=1 ORDER BY nama');
  const pemohon = u.role === 'warga' ? all("SELECT id, nama, hubungan FROM residents WHERE household_id=? AND status='hidup'", u.household_id)
    : all(`SELECT r.id, r.nama, h.kepala_nama hubungan, rt.kode FROM residents r JOIN households h ON h.id=r.household_id JOIN rt ON rt.id=h.rt_id WHERE r.status='hidup' ${rt ? 'AND h.rt_id=' + rt : ''} ORDER BY rt.kode, r.nama`);
  const canAjukan = u.role === 'warga' || u.role === 'ketua_rt';
  const nAksi = rows.filter(r => needsMe(u, r)).length;
  const tabs = [...(u.role !== 'warga' && u.role !== 'admin' ? [{ key: 'tindakan', label: `Perlu tindakan saya (${nAksi})`, href: '/surat?tab=tindakan' }] : []), { key: 'proses', label: 'Dalam proses', href: '/surat?tab=proses' }, { key: 'kembali', label: 'Dikembalikan', href: '/surat?tab=kembali' }, { key: 'selesai', label: 'Terbit / Ditolak', href: '/surat?tab=selesai' }, { key: 'semua', label: 'Semua', href: '/surat?tab=semua' }];
  return (<div>
    <PageHeader title="Permohonan Surat Online" desc="Alur: Warga mengajukan → Verifikasi Ketua RT → Verifikasi Pengurus RW → Persetujuan Ketua RW (atau Petugas Kelurahan untuk SKTM, Pengantar Nikah, Keterangan Kematian) → nomor otomatis → TTD → PDF final & arsip.">
      {canAjukan && <a href="#ajukan" className="btn btn-primary">+ Ajukan Surat</a>}
    </PageHeader>
    <Flash sp={searchParams} />
    <div className="grid md:grid-cols-6 gap-2 mb-5 text-xs">
      {['Diajukan warga', 'Verifikasi RT', 'Verifikasi RW', 'Persetujuan RW / Kelurahan', 'Nomor + TTD otomatis', 'PDF final & arsip'].map((s, i) => <div key={s} className="rounded-lg bg-brand-50 border border-brand-100 px-3 py-2 text-brand-800"><b className="text-brand-600">{i + 1}.</b> {s}</div>)}
    </div>
    <Tabs items={tabs} active={tab} />
    <Card>
      {view.length ? <div className="overflow-x-auto"><table className="tbl"><thead><tr><th>No. Registrasi</th><th>Tanggal</th><th>Pemohon</th><th>Jenis Surat</th><th>RT</th><th>Status</th><th>Nomor Surat</th><th></th></tr></thead><tbody>
        {view.map(s => <tr key={s.id}><td className="font-mono text-xs">{s.no_reg}</td><td className="text-xs">{tglJam(s.created_at)}</td><td className="font-semibold">{s.pemohon}</td><td>{s.jn}{s.butuh_kelurahan ? <div className="text-[10px] text-violet-700">via Kelurahan</div> : null}</td><td>{s.rt_kode}</td>
          <td><Badge color={STATUS_SURAT[s.status]?.color}>{STATUS_SURAT[s.status]?.label}</Badge>{needsMe(u, s) && <div className="text-[10px] text-red-600 font-semibold mt-1">● perlu tindakan Anda</div>}</td>
          <td className="font-mono text-xs">{s.nomor || '-'}</td>
          <td className="whitespace-nowrap"><Link href={`/surat/${s.id}`} className="btn btn-sm">{needsMe(u, s) ? 'Proses' : 'Detail'}</Link> {s.nomor && <a href={`/api/pdf/surat/${s.id}`} target="_blank" className="btn btn-sm btn-primary">PDF</a>} {can.deleteAny(u.role) && <HapusSurat id={s.id} label={s.nomor || s.no_reg} final={!!s.nomor} back="/surat" />}</td></tr>)}
      </tbody></table></div> : <Empty>Tidak ada permohonan pada tab ini.</Empty>}
    </Card>
    {canAjukan && <Card title={u.role === 'warga' ? 'Ajukan Permohonan Surat' : `Input Permohonan atas nama Warga RT ${u.rt_kode}`} className="mt-5"><div id="ajukan" />
      <form action={ajukanSurat} className="grid md:grid-cols-2 gap-3">
        <Field label="Pemohon"><select name="resident_id" required className="input">{pemohon.map(p => <option key={p.id} value={p.id}>{p.nama} {u.role === 'warga' ? `(${p.hubungan})` : `— KK ${p.hubungan}, RT ${p.kode}`}</option>)}</select></Field>
        <Field label="Jenis Surat"><select name="jenis" required className="input">{types.map(t => <option key={t.kode} value={t.kode}>{t.nama}{t.butuh_kelurahan ? ' (diproses Kelurahan)' : ''}</option>)}</select></Field>
        <Field label="Keperluan" className="md:col-span-2"><input name="keperluan" required minLength={5} className="input" placeholder="mis. Persyaratan pembukaan rekening bank" /></Field>
        <Field label="Keterangan tambahan"><textarea name="keterangan" rows={2} className="input" /></Field>
        <Field label="Lampiran (opsional: PDF/JPG/PNG, maks 2 MB)"><input type="file" name="lampiran" accept=".pdf,.jpg,.jpeg,.png" className="input" /></Field>
        <div className="md:col-span-2"><button className="btn btn-primary">Kirim Permohonan</button> <span className="text-xs text-slate-500 ml-2">Nomor registrasi dibuat otomatis; status dapat dipantau di halaman ini.</span></div>
      </form></Card>}
  </div>);
}
