import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser, scopeRt, audit } from '@/lib/auth';
import { all, one } from '@/lib/db';
import { can } from '@/lib/rbac';
import { maskNik, tgl, umur, rupiah, periodeLabel, STATUS_SURAT } from '@/lib/util';
import { PageHeader, Flash, Card, Badge, Field, RtSelect } from '@/components/ui';
import { saveHousehold, saveResident, hapusKK, hapusWarga } from '../actions';
import { ConfirmButton } from '@/components/Confirm';

const AGAMA = ['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Konghucu'];
const HUB = ['Kepala Keluarga', 'Istri', 'Suami', 'Anak', 'Orang Tua', 'Famili Lain'];
const KAWIN = ['Belum Kawin', 'Kawin', 'Cerai Hidup', 'Cerai Mati'];

function ResForm({ r, hid, full }: { r?: any; hid: number; full: boolean }) {
  return (<form action={saveResident} className="grid md:grid-cols-4 gap-3">
    <input type="hidden" name="household_id" value={hid} />{r && <input type="hidden" name="id" value={r.id} />}
    <Field label={r ? 'NIK (kosongkan bila tidak diubah)' : 'NIK (16 digit)'}><input name="nik" pattern="\d{16}" maxLength={16} required={!r} placeholder={r ? (full ? r.nik : maskNik(r.nik)) : ''} className="input" /></Field>
    <Field label="Nama Lengkap"><input name="nama" defaultValue={r?.nama} required className="input" /></Field>
    <Field label="Jenis Kelamin"><select name="jk" defaultValue={r?.jk || 'L'} className="input"><option value="L">Laki-laki</option><option value="P">Perempuan</option></select></Field>
    <Field label="Hubungan dalam KK"><select name="hubungan" defaultValue={r?.hubungan || 'Anak'} className="input">{HUB.map(x => <option key={x}>{x}</option>)}</select></Field>
    <Field label="Tempat Lahir"><input name="tempat_lahir" defaultValue={r?.tempat_lahir} className="input" /></Field>
    <Field label="Tanggal Lahir"><input type="date" name="tgl_lahir" defaultValue={r?.tgl_lahir} className="input" /></Field>
    <Field label="Agama"><select name="agama" defaultValue={r?.agama || 'Islam'} className="input">{AGAMA.map(x => <option key={x}>{x}</option>)}</select></Field>
    <Field label="Status Kawin"><select name="status_kawin" defaultValue={r?.status_kawin || 'Belum Kawin'} className="input">{KAWIN.map(x => <option key={x}>{x}</option>)}</select></Field>
    <Field label="Pekerjaan"><input name="pekerjaan" defaultValue={r?.pekerjaan} className="input" /></Field>
    <Field label="Status Kependudukan"><select name="status" defaultValue={r?.status || 'hidup'} className="input"><option value="hidup">Aktif / hidup</option><option value="pindah">Pindah</option><option value="meninggal">Meninggal</option></select></Field>
    <div className="md:col-span-2 flex items-end"><button className="btn btn-primary">{r ? 'Simpan perubahan' : 'Tambah anggota'}</button></div>
  </form>);
}

export default function KKDetail({ params, searchParams }: any) {
  const u = requireUser('warga');
  const id = Number(params.id);
  const h = one('SELECT h.*, rt.kode rt_kode FROM households h JOIN rt ON rt.id=h.rt_id WHERE h.id=?', id);
  if (!h) redirect('/warga?err=' + encodeURIComponent('KK tidak ditemukan.'));
  const rt = scopeRt(u);
  if (u.role === 'warga' && u.household_id !== id) redirect(`/warga/${u.household_id}?err=` + encodeURIComponent('Anda hanya dapat melihat data keluarga sendiri.'));
  if (rt && h.rt_id !== rt) redirect('/warga?err=' + encodeURIComponent('Data di luar RT Anda.'));
  const full = can.seeFullNik(u.role) && searchParams.nik === 'full';
  if (full) audit(u, 'LIHAT_NIK_LENGKAP', 'households', id, h.kepala_nama);
  const edit = can.editWarga(u.role);
  const res = all('SELECT * FROM residents WHERE household_id=? ORDER BY id', id);
  const rts = all('SELECT * FROM rt ORDER BY kode').filter(r => !rt || r.id === rt);
  const tagihan = all("SELECT i.*, d.nama FROM dues_invoices i JOIN dues_types d ON d.id=i.dues_type_id WHERE i.household_id=? ORDER BY i.periode DESC LIMIT 8", id);
  const surat = all("SELECT lr.*, lt.nama jn, r.nama pemohon FROM letter_requests lr JOIN letter_types lt ON lt.kode=lr.jenis JOIN residents r ON r.id=lr.resident_id WHERE lr.household_id=? ORDER BY lr.id DESC", id);
  const showNik = (n: string) => (full ? n : maskNik(n));
  return (<div>
    <PageHeader title={`KK ${h.kepala_nama}`} desc={`No. KK ${showNik(h.no_kk)} • RT ${h.rt_kode} / RW 01 • ${h.alamat}`}>
      {u.role !== 'warga' && <Link href="/warga" className="btn">← Daftar KK</Link>}
      {can.seeFullNik(u.role) && (full ? <Link href={`/warga/${id}`} className="btn">Samarkan NIK</Link> : <Link href={`/warga/${id}?nik=full`} className="btn">Tampilkan NIK lengkap</Link>)}
    </PageHeader>
    <Flash sp={searchParams} />
    <div className="grid xl:grid-cols-3 gap-5">
      <Card title="Anggota Keluarga" className="xl:col-span-2">
        <div className="overflow-x-auto"><table className="tbl"><thead><tr><th>NIK</th><th>Nama</th><th>L/P</th><th>TTL / Umur</th><th>Hubungan</th><th>Agama</th><th>Pekerjaan</th><th>Status</th>{can.deleteAny(u.role) && <th></th>}</tr></thead><tbody>
          {res.map(r => <tr key={r.id} className={r.status !== 'hidup' ? 'opacity-60' : ''}><td className="font-mono text-xs">{showNik(r.nik)}</td><td className="font-semibold">{r.nama}</td><td>{r.jk}</td><td className="text-xs">{r.tempat_lahir}, {tgl(r.tgl_lahir)}<br />{umur(r.tgl_lahir)} th</td><td>{r.hubungan}</td><td>{r.agama}</td><td>{r.pekerjaan}</td><td><Badge color={r.status === 'hidup' ? 'green' : r.status === 'meninggal' ? 'slate' : 'amber'}>{r.status === 'hidup' ? 'Aktif' : r.status}</Badge></td>{can.deleteAny(u.role) && <td><form action={hapusWarga}><input type="hidden" name="id" value={r.id} /><ConfirmButton className="btn btn-sm btn-danger" msg={`Hapus permanen anggota keluarga ${r.nama}?\n\nUntuk warga pindah/meninggal sebaiknya cukup ubah statusnya.`}>🗑 Hapus</ConfirmButton></form></td>}</tr>)}
        </tbody></table></div>
        {u.role === 'warga' && <p className="text-xs text-slate-500 mt-3">Perubahan data keluarga (kelahiran, pindah, kematian) diajukan melalui Ketua RT. Gunakan menu <Link href="/surat" className="text-brand-700 underline">Permohonan Surat</Link> atau <Link href="/pengaduan" className="text-brand-700 underline">Pengaduan</Link>.</p>}
      </Card>
      <div className="space-y-5">
        <Card title="Tagihan Iuran" actions={<Link href="/iuran" className="btn btn-sm">Iuran</Link>}>
          {tagihan.map(t => <div key={t.id} className="flex justify-between text-sm py-1 border-b last:border-0"><span>{t.nama} • {periodeLabel(t.periode)}</span><span>{rupiah(t.nominal)} <Badge color={t.status === 'lunas' ? 'green' : t.status === 'menunggu' ? 'amber' : 'red'}>{t.status}</Badge></span></div>)}
        </Card>
        <Card title="Riwayat Surat">
          {surat.length ? surat.map(s => <div key={s.id} className="text-sm py-1 border-b last:border-0"><Link href={`/surat/${s.id}`} className="text-brand-700 hover:underline">{s.jn}</Link> — {s.pemohon} <Badge color={STATUS_SURAT[s.status]?.color}>{STATUS_SURAT[s.status]?.label}</Badge></div>) : <div className="text-sm text-slate-400">Belum ada.</div>}
        </Card>
      </div>
    </div>
    {can.deleteAny(u.role) && <Card title="Zona Admin — Hapus Kartu Keluarga" className="mt-5 border-red-200">
      <form action={hapusKK} className="flex flex-wrap items-center gap-3"><input type="hidden" name="id" value={h.id} />
        <p className="text-sm text-slate-600 flex-1 min-w-[240px]">Menghapus KK beserta seluruh anggota, tagihan iuran yang belum dibayar, dan daftar kontribusi takziah yang belum diisi. Akun warga terkait dinonaktifkan. Ditolak bila masih ada surat, pembayaran sah, atau kontribusi takziah tercatat.</p>
        <ConfirmButton className="btn btn-danger" msg={`HAPUS PERMANEN KK ${h.kepala_nama} beserta ${res.length} anggota keluarga?\n\nTindakan ini tidak dapat dibatalkan dan tercatat di audit log.`}>🗑 Hapus KK</ConfirmButton>
      </form></Card>}
    {edit && <>
      <Card title="Ubah Data KK" className="mt-5">
        <form action={saveHousehold} className="grid md:grid-cols-3 gap-3">
          <input type="hidden" name="id" value={h.id} />
          <Field label="Nomor KK"><input name="no_kk" defaultValue={full ? h.no_kk : ''} placeholder={full ? '' : 'Isi ulang 16 digit (buka NIK lengkap)'} required pattern="\d{16}" className="input" /></Field>
          <Field label="Kepala Keluarga"><input name="kepala_nama" defaultValue={h.kepala_nama} required className="input" /></Field>
          <Field label="RT"><RtSelect rts={rts} all={false} value={h.rt_id} /></Field>
          <Field label="Alamat" className="md:col-span-2"><input name="alamat" defaultValue={h.alamat} className="input" /></Field>
          <Field label="Status Domisili"><select name="status_domisili" defaultValue={h.status_domisili} className="input"><option>Tetap</option><option>Kontrak</option><option>Kos</option></select></Field>
          <Field label="Telepon"><input name="telp" defaultValue={h.telp} className="input" /></Field>
          <div className="md:col-span-3"><button className="btn btn-primary">Simpan KK</button></div>
        </form>
      </Card>
      <Card title="Tambah Anggota Keluarga" className="mt-5"><ResForm hid={id} full={full} /></Card>
      <Card title="Ubah Anggota Keluarga" className="mt-5">
        <div className="space-y-3">{res.map(r => <details key={r.id} className="rounded-lg border p-3"><summary className="cursor-pointer font-semibold text-sm">{r.nama} <span className="text-slate-400 font-normal">({r.hubungan})</span></summary><div className="mt-3"><ResForm r={r} hid={id} full={full} /></div></details>)}</div>
      </Card>
    </>}
  </div>);
}
