import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireUser, scopeRt } from '@/lib/auth';
import { all, one } from '@/lib/db';
import { can, roleLabel } from '@/lib/rbac';
import { tglJam } from '@/lib/util';
import { PageHeader, Flash, Card, Badge, Field } from '@/components/ui';
import { ADU_ST } from '@/lib/aduan';
import { tanggapiAduan, hapusAduan } from '../actions';
import { ConfirmButton } from '@/components/Confirm';

export default function Detail({ params, searchParams: sp }: any) {
  const u = requireUser('pengaduan');
  const c = one('SELECT c.*, u.nama pelapor, u.phone, rt.kode rt_kode FROM complaints c LEFT JOIN users u ON u.id=c.user_id JOIN rt ON rt.id=c.rt_id WHERE c.id=?', Number(params.id));
  if (!c) notFound();
  const deny = u.role === 'warga' ? c.user_id !== u.id : (scopeRt(u) && scopeRt(u) !== c.rt_id);
  if (deny) redirect('/pengaduan?err=' + encodeURIComponent('Anda tidak berhak melihat pengaduan ini.'));
  const resp = all('SELECT r.*, u.nama, u.role FROM complaint_responses r LEFT JOIN users u ON u.id=r.user_id WHERE complaint_id=? ORDER BY at', c.id);
  const handler = can.handleAduan(u.role);
  return (<div>
    <PageHeader title={c.judul} desc={`${c.kode} • ${c.kategori} • RT ${c.rt_kode}/RW 01`}><Link href="/pengaduan" className="btn">← Kembali</Link>{can.deleteAny(u.role) && <form action={hapusAduan}><input type="hidden" name="id" value={c.id} /><ConfirmButton className="btn btn-danger" msg={`Hapus permanen pengaduan ${c.kode} beserta ${resp.length} tanggapan dan lampirannya?`}>🗑 Hapus</ConfirmButton></form>}</PageHeader>
    <Flash sp={sp} />
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <Card title={<span>Uraian <Badge color={ADU_ST[c.status]?.[1]}>{ADU_ST[c.status]?.[0]}</Badge></span>}>
          <p className="text-sm whitespace-pre-line">{c.isi}</p>
          <div className="text-xs text-slate-500 mt-3">📍 {c.lokasi || '-'} • Dilaporkan {c.pelapor} {handler && c.phone ? `(${c.phone})` : ''} • {tglJam(c.created_at)}</div>
          {c.lampiran && <a href={`/api/file/aduan/${c.id}`} target="_blank" className="btn btn-sm mt-3">📎 Lihat lampiran</a>}
        </Card>
        <Card title="Riwayat tindak lanjut">
          <ol className="relative border-l-2 border-brand-100 ml-2 space-y-4">
            <li className="ml-4"><div className="absolute -left-[7px] w-3 h-3 rounded-full bg-brand-500" /><div className="text-xs text-slate-500">{tglJam(c.created_at)}</div><div className="text-sm">Pengaduan dibuat oleh {c.pelapor}</div></li>
            {resp.map(r => <li key={r.id} className="ml-4"><div className="absolute -left-[7px] w-3 h-3 rounded-full bg-gold-400" /><div className="text-xs text-slate-500">{tglJam(r.at)} • {r.nama} ({roleLabel(r.role)}){r.status_baru && <> • status → <Badge color={ADU_ST[r.status_baru]?.[1]}>{ADU_ST[r.status_baru]?.[0]}</Badge></>}</div><div className="text-sm mt-1">{r.isi}</div></li>)}
          </ol>
        </Card>
      </div>
      <Card title={handler ? 'Tanggapi & ubah status' : c.user_id === u.id ? 'Tambahkan keterangan' : 'Tindak lanjut'}>
        {!handler && c.user_id !== u.id ? <p className="text-sm text-slate-500">Anda hanya dapat melihat pengaduan ini. Tindak lanjut dilakukan oleh Ketua RT/RW, Sekretaris RW, atau Petugas Kelurahan.</p> : c.status === 'selesai' && !handler ? <p className="text-sm text-slate-500">Pengaduan telah selesai ditangani.</p> :
        <form action={tanggapiAduan} className="space-y-2"><input type="hidden" name="id" value={c.id} />
          <Field label="Tanggapan / keterangan"><textarea name="isi" required rows={4} className="input" /></Field>
          {handler && <Field label="Status"><select name="status" defaultValue={c.status === 'baru' ? 'diproses' : c.status} className="input">{Object.entries(ADU_ST).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}</select></Field>}
          <button className="btn btn-primary w-full">Kirim</button></form>}
      </Card>
    </div>
  </div>);
}
