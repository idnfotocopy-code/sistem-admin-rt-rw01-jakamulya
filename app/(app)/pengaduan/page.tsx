import Link from 'next/link';
import { requireUser, scopeRt } from '@/lib/auth';
import { all } from '@/lib/db';
import { tglJam } from '@/lib/util';
import { PageHeader, Flash, Card, Badge, Empty, Tabs, Field, RtSelect } from '@/components/ui';
import { ADU_ST, ADU_KAT } from '@/lib/aduan';
import { kirimAduan, hapusAduan } from './actions';
import { can } from '@/lib/rbac';
import { ConfirmButton } from '@/components/Confirm';

export default function Pengaduan({ searchParams: sp }: any) {
  const u = requireUser('pengaduan');
  const rtS = scopeRt(u); const tab = sp.tab || 'daftar'; const st = sp.status || '';
  const rts = all('SELECT * FROM rt ORDER BY kode');
  const rows = all(`SELECT c.*, u.nama pelapor, rt.kode rt_kode, (SELECT COUNT(*) FROM complaint_responses r WHERE r.complaint_id=c.id) nresp FROM complaints c LEFT JOIN users u ON u.id=c.user_id JOIN rt ON rt.id=c.rt_id WHERE 1=1 ${u.role === 'warga' ? 'AND c.user_id=' + u.id : rtS ? 'AND c.rt_id=' + rtS : ''} ${st ? 'AND c.status=@st' : ''} ORDER BY CASE c.status WHEN 'baru' THEN 0 WHEN 'diproses' THEN 1 ELSE 2 END, c.created_at DESC`, { st });
  return (<div>
    <PageHeader title="Pengaduan Warga" desc={u.role === 'warga' ? 'Sampaikan keluhan/aspirasi. Pengaduan Anda bersifat privat dan hanya dapat dilihat oleh Anda dan pengurus terkait.' : 'Tindak lanjuti pengaduan warga dan catat setiap tanggapan.'} />
    <Flash sp={sp} />
    <Tabs active={tab} items={[{ key: 'daftar', label: u.role === 'warga' ? 'Pengaduan saya' : 'Daftar pengaduan', href: '/pengaduan' }, { key: 'baru', label: '+ Buat pengaduan', href: '/pengaduan?tab=baru' }]} />
    {tab === 'daftar' && <Card>
      <form className="flex gap-2 mb-3"><select name="status" defaultValue={st} className="input max-w-[200px]"><option value="">Semua status</option>{Object.entries(ADU_ST).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}</select><button className="btn">Filter</button></form>
      {rows.length ? <table className="tbl"><thead><tr><th>Kode</th><th>Judul</th><th>Kategori</th><th>RT</th><th>Pelapor</th><th>Dibuat</th><th>Status</th>{can.deleteAny(u.role) && <th></th>}</tr></thead><tbody>
        {rows.map(r => <tr key={r.id}><td className="font-mono text-xs">{r.kode}</td><td><Link href={`/pengaduan/${r.id}`} className="font-medium text-brand-800 hover:underline">{r.judul}</Link><div className="text-xs text-slate-500">{r.lokasi} • {r.nresp} tanggapan{r.lampiran ? ' • 📎' : ''}</div></td><td className="text-xs">{r.kategori}</td><td>{r.rt_kode}</td><td className="text-xs">{r.pelapor}</td><td className="text-xs">{tglJam(r.created_at)}</td><td><Badge color={ADU_ST[r.status]?.[1]}>{ADU_ST[r.status]?.[0] || r.status}</Badge></td>{can.deleteAny(u.role) && <td><form action={hapusAduan}><input type="hidden" name="id" value={r.id} /><ConfirmButton className="btn btn-sm btn-danger" msg={`Hapus pengaduan ${r.kode} "${r.judul}" beserta seluruh tanggapan dan lampirannya?`}>🗑 Hapus</ConfirmButton></form></td>}</tr>)}
      </tbody></table> : <Empty>Belum ada pengaduan.</Empty>}</Card>}
    {tab === 'baru' && <Card title="Form pengaduan"><form action={kirimAduan} className="grid md:grid-cols-2 gap-3 max-w-3xl">
      <Field label="Judul"><input name="judul" required className="input" /></Field>
      <Field label="Kategori"><select name="kategori" className="input">{ADU_KAT.map(k => <option key={k}>{k}</option>)}</select></Field>
      <Field label="Lokasi"><input name="lokasi" className="input" placeholder="Jalan / nomor rumah / patokan" /></Field>
      <Field label="RT">{u.rt_id ? <input disabled className="input" value={`RT ${u.rt_kode || rts.find(r => r.id === u.rt_id)?.kode}`} /> : <RtSelect rts={rts} all={false} />}</Field>
      <Field label="Uraian" className="md:col-span-2"><textarea name="isi" required rows={4} className="input" /></Field>
      <Field label="Foto/lampiran (opsional, JPG/PNG/PDF ≤2MB)" className="md:col-span-2"><input type="file" name="lampiran" accept=".jpg,.jpeg,.png,.pdf" className="text-sm" /></Field>
      <div><button className="btn btn-primary">Kirim pengaduan</button></div>
    </form></Card>}
  </div>);
}
