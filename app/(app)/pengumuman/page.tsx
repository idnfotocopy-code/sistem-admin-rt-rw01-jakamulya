import Link from 'next/link';
import { requireUser, scopeRt } from '@/lib/auth';
import { all, one, today } from '@/lib/db';
import { can } from '@/lib/rbac';
import { tgl, tglJam } from '@/lib/util';
import { PageHeader, Flash, Card, Badge, Empty, Field, RtSelect } from '@/components/ui';
import { ConfirmButton } from '@/components/Confirm';
import { simpanPengumuman, hapusPengumuman } from './actions';

const JENIS: Record<string, string> = { Pengumuman: 'blue', Kegiatan: 'green', 'Kerja Bakti': 'teal', Rapat: 'amber', Takziah: 'slate', Darurat: 'red' };

export default function Pengumuman({ searchParams: sp }: any) {
  const u = requireUser('pengumuman');
  const s = scopeRt(u); const post = can.postPengumuman(u.role);
  const jenis = sp.jenis || ''; const arsip = sp.arsip === '1';
  const rts = all('SELECT * FROM rt ORDER BY kode');
  const rtFilter = s ? `(a.target_rt_id IS NULL OR a.target_rt_id=${s})` : '1=1';
  const rows = all(`SELECT a.*, rt.kode rt_kode, u.nama pembuat FROM announcements a LEFT JOIN rt ON rt.id=a.target_rt_id LEFT JOIN users u ON u.id=a.created_by WHERE ${rtFilter} ${jenis ? 'AND a.jenis=@jenis' : ''} ${arsip ? '' : "AND (a.tayang_selesai IS NULL OR a.tayang_selesai='' OR a.tayang_selesai>=@t)"} ORDER BY COALESCE(a.tanggal_kegiatan, a.created_at) DESC`, { jenis, t: today() });
  const edit = sp.edit ? one('SELECT * FROM announcements WHERE id=?', Number(sp.edit)) : null;
  const canEdit = (a: any) => can.deleteAny(u.role) || (post && (!s || a.target_rt_id === s));
  return (<div>
    <PageHeader title="Pengumuman & Kegiatan" desc="Informasi untuk warga RW 01 Kelurahan Jakamulya — dapat ditujukan ke seluruh RW atau RT tertentu." />
    <Flash sp={sp} />
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-3">
        <form className="flex flex-wrap gap-2 items-center"><select name="jenis" defaultValue={jenis} className="input max-w-[200px]"><option value="">Semua jenis</option>{Object.keys(JENIS).map(j => <option key={j}>{j}</option>)}</select>
          <label className="text-sm flex items-center gap-1"><input type="checkbox" name="arsip" value="1" defaultChecked={arsip} /> tampilkan yang sudah lewat masa tayang</label><button className="btn">Filter</button></form>
        {rows.length ? rows.map(a => <Card key={a.id}>
          <div className="flex justify-between gap-3"><div>
            <div className="flex gap-2 items-center mb-1"><Badge color={JENIS[a.jenis] || 'slate'}>{a.jenis}</Badge><span className="text-xs text-slate-500">{a.target_rt_id ? `Untuk RT ${a.rt_kode}` : 'Seluruh RW 01'}</span></div>
            <h3 className="font-semibold text-brand-900 text-lg">{a.judul}</h3></div>
            {canEdit(a) && <div className="flex gap-1 shrink-0"><Link href={`/pengumuman?edit=${a.id}`} className="btn btn-sm">Ubah</Link><form action={hapusPengumuman}><input type="hidden" name="id" value={a.id} /><ConfirmButton className="btn btn-sm btn-danger" msg={`Hapus permanen pengumuman "${a.judul}"?`}>Hapus</ConfirmButton></form></div>}
          </div>
          <p className="text-sm whitespace-pre-line mt-2">{a.isi}</p>
          <div className="text-xs text-slate-500 mt-3 flex flex-wrap gap-x-4">{a.tanggal_kegiatan && <span>📅 {tgl(a.tanggal_kegiatan)}</span>}{a.lokasi && <span>📍 {a.lokasi}</span>}<span>Oleh {a.pembuat || '-'} • {tglJam(a.created_at)}</span>{a.tayang_selesai && <span>Tayang s.d. {tgl(a.tayang_selesai)}</span>}</div>
        </Card>) : <Card><Empty>Belum ada pengumuman.</Empty></Card>}
      </div>
      {post && <Card title={edit ? 'Ubah pengumuman' : 'Buat pengumuman'}>
        <form action={simpanPengumuman} className="space-y-2" key={edit?.id || 'new'}>
          {edit && <input type="hidden" name="id" value={edit.id} />}
          <Field label="Judul"><input name="judul" required defaultValue={edit?.judul} className="input" /></Field>
          <Field label="Jenis"><select name="jenis" defaultValue={edit?.jenis || 'Pengumuman'} className="input">{Object.keys(JENIS).map(j => <option key={j}>{j}</option>)}</select></Field>
          <Field label="Sasaran">{s ? <input disabled className="input" value={`RT ${rts.find(r => r.id === s)?.kode} saja`} /> : <select name="target_rt_id" defaultValue={edit?.target_rt_id || ''} className="input"><option value="">Seluruh RW 01</option>{rts.map(r => <option key={r.id} value={r.id}>RT {r.kode}</option>)}</select>}</Field>
          <Field label="Isi"><textarea name="isi" required rows={5} defaultValue={edit?.isi} className="input" /></Field>
          <div className="grid grid-cols-2 gap-2"><Field label="Tanggal kegiatan"><input type="date" name="tanggal_kegiatan" defaultValue={edit?.tanggal_kegiatan?.slice(0, 10)} className="input" /></Field><Field label="Lokasi"><input name="lokasi" defaultValue={edit?.lokasi} className="input" /></Field>
          <Field label="Tayang mulai"><input type="date" name="tayang_mulai" defaultValue={edit?.tayang_mulai?.slice(0, 10)} className="input" /></Field><Field label="Tayang s.d."><input type="date" name="tayang_selesai" defaultValue={edit?.tayang_selesai?.slice(0, 10)} className="input" /></Field></div>
          <div className="flex gap-2"><button className="btn btn-primary">{edit ? 'Simpan perubahan' : 'Terbitkan'}</button>{edit && <Link href="/pengumuman" className="btn">Batal</Link>}</div>
        </form></Card>}
    </div>
  </div>);
}
