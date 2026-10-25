import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser, scopeRt, audit } from '@/lib/auth';
import { all } from '@/lib/db';
import { can } from '@/lib/rbac';
import { maskNik } from '@/lib/util';
import { PageHeader, Flash, Card, Badge, Empty, Field, RtSelect } from '@/components/ui';
import { saveHousehold, hapusKK } from './actions';
import { ConfirmButton } from '@/components/Confirm';

export default function Warga({ searchParams }: any) {
  const u = requireUser('warga');
  if (u.role === 'warga') redirect(`/warga/${u.household_id}`);
  const rt = scopeRt(u);
  const rts = all('SELECT * FROM rt ORDER BY kode').filter(r => !rt || r.id === rt);
  const q = String(searchParams.q || '').trim();
  const frt = rt || Number(searchParams.rt || 0);
  const fs = String(searchParams.status || '');
  const full = can.seeFullNik(u.role) && searchParams.nik === 'full';
  const rows = all(`SELECT h.*, rt.kode rt_kode, (SELECT COUNT(*) FROM residents r WHERE r.household_id=h.id AND r.status='hidup') jiwa, (SELECT COUNT(*) FROM residents r WHERE r.household_id=h.id AND r.status!='hidup') non
    FROM households h JOIN rt ON rt.id=h.rt_id WHERE 1=1 ${frt ? 'AND h.rt_id=' + frt : ''} ${fs ? 'AND h.status_domisili=@fs' : ''}
    ${q ? "AND (h.kepala_nama LIKE @q OR h.no_kk LIKE @q OR h.alamat LIKE @q OR EXISTS(SELECT 1 FROM residents r WHERE r.household_id=h.id AND (r.nama LIKE @q OR r.nik LIKE @q)))" : ''} ORDER BY rt.kode, h.kepala_nama`, { q: `%${q}%`, fs });
  const residents = all(`SELECT r.*, h.rt_id FROM residents r JOIN households h ON h.id=r.household_id ${frt ? 'WHERE h.rt_id=' + frt : ''} ORDER BY r.id`);
  const edit = can.editWarga(u.role);
  if (full) audit(u, 'LIHAT_NIK_LENGKAP', 'households', frt ? 'RT ' + frt : 'semua', 'Daftar warga');
  return (<div>
    <PageHeader title="Data Warga / Kartu Keluarga" desc={`Data kependudukan ${rt ? 'RT ' + u.rt_kode : 'seluruh RT di RW 01'}. NIK & No. KK ditampilkan tersamar (masking) — tampilan lengkap hanya untuk peran berwenang dan tercatat di audit.`}>
      {can.seeFullNik(u.role) && (full ? <Link href="/warga" className="btn">Samarkan NIK</Link> : <Link href="/warga?nik=full" className="btn">Tampilkan NIK lengkap</Link>)}
      {edit && <a href="#tambah" className="btn btn-primary">+ Tambah KK</a>}
    </PageHeader>
    <Flash sp={searchParams} />
    <Card>
      <form className="flex flex-wrap gap-2 mb-4">
        <input name="q" defaultValue={q} placeholder="Cari nama / NIK / No. KK / alamat" className="input max-w-xs" />
        {!rt && <select name="rt" defaultValue={frt || ''} className="input max-w-[140px]"><option value="">Semua RT</option>{rts.map(r => <option key={r.id} value={r.id}>RT {r.kode}</option>)}</select>}
        <select name="status" defaultValue={fs} className="input max-w-[160px]"><option value="">Semua domisili</option><option>Tetap</option><option>Kontrak</option><option>Kos</option></select>
        {full && <input type="hidden" name="nik" value="full" />}
        <button className="btn">Filter</button>
      </form>
      <div className="grid grid-cols-3 gap-3 mb-4 text-center text-sm">
        <div className="rounded-lg bg-brand-50 p-3"><div className="text-2xl font-bold text-brand-800">{rows.length}</div>KK</div>
        <div className="rounded-lg bg-brand-50 p-3"><div className="text-2xl font-bold text-brand-800">{rows.reduce((a, r) => a + r.jiwa, 0)}</div>Jiwa (hidup)</div>
        <div className="rounded-lg bg-slate-50 p-3"><div className="text-2xl font-bold text-slate-700">{rows.reduce((a, r) => a + r.non, 0)}</div>Pindah/Meninggal</div>
      </div>
      {rows.length ? <div className="overflow-x-auto"><table className="tbl"><thead><tr><th>No. KK</th><th>Kepala Keluarga</th><th>Anggota</th><th>Alamat</th><th>RT</th><th>Domisili</th><th></th></tr></thead><tbody>
        {rows.map(h => <tr key={h.id}>
          <td className="font-mono text-xs">{full ? h.no_kk : maskNik(h.no_kk)}</td>
          <td className="font-semibold">{h.kepala_nama}</td>
          <td className="text-xs">{residents.filter(r => r.household_id === h.id).map(r => <div key={r.id} className={r.status !== 'hidup' ? 'text-slate-400 line-through' : ''}>{r.nama} <span className="text-slate-400">({r.hubungan}{r.status !== 'hidup' ? ', ' + r.status : ''}) {full ? r.nik : maskNik(r.nik)}</span></div>)}</td>
          <td className="text-xs">{h.alamat}</td><td>{h.rt_kode}</td>
          <td><Badge color={h.status_domisili === 'Tetap' ? 'green' : 'amber'}>{h.status_domisili}</Badge></td>
          <td className="whitespace-nowrap"><Link href={`/warga/${h.id}`} className="btn btn-sm">{edit ? 'Detail / Ubah' : 'Detail'}</Link>{can.deleteAny(u.role) && <form action={hapusKK} className="inline ml-1"><input type="hidden" name="id" value={h.id} /><ConfirmButton className="btn btn-sm btn-danger" msg={`HAPUS PERMANEN KK ${h.kepala_nama} beserta seluruh anggotanya?\n\nTidak dapat dibatalkan; tercatat di audit log.`}>🗑 Hapus</ConfirmButton></form>}</td>
        </tr>)}</tbody></table></div> : <Empty />}
    </Card>
    {edit && <Card title="Tambah Kartu Keluarga" className="mt-5"><div id="tambah" />
      <form action={saveHousehold} className="grid md:grid-cols-3 gap-3">
        <Field label="Nomor KK (16 digit)"><input name="no_kk" required pattern="\d{16}" maxLength={16} className="input" /></Field>
        <Field label="Nama Kepala Keluarga"><input name="kepala_nama" required className="input" /></Field>
        <Field label="RT"><RtSelect rts={rts} all={false} required value={rt || ''} /></Field>
        <Field label="Alamat" className="md:col-span-2"><input name="alamat" required className="input" placeholder="Jl. ... No. ..., Jakamulya" /></Field>
        <Field label="Status Domisili"><select name="status_domisili" className="input"><option>Tetap</option><option>Kontrak</option><option>Kos</option></select></Field>
        <Field label="Telepon"><input name="telp" className="input" /></Field>
        <div className="md:col-span-3"><button className="btn btn-primary">Simpan KK</button> <span className="text-xs text-slate-500">Setelah tersimpan, tambahkan anggota keluarga pada halaman detail.</span></div>
      </form></Card>}
  </div>);
}
