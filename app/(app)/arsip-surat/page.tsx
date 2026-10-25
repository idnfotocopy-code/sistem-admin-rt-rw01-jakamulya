import Link from 'next/link';
import { requireUser, scopeRt } from '@/lib/auth';
import { all } from '@/lib/db';
import { tgl } from '@/lib/util';
import { PageHeader, Flash, Card, Badge, Empty } from '@/components/ui';
import { can } from '@/lib/rbac';
import { HapusSurat } from '@/components/HapusSurat';

export default function Arsip({ searchParams }: any) {
  const u = requireUser('arsip');
  const rt = scopeRt(u);
  const q = String(searchParams.q || '').trim(); const jenis = String(searchParams.jenis || ''); const bln = String(searchParams.bulan || '');
  const rows = all(`SELECT i.*, lr.no_reg, lr.keperluan, lr.id rid, lt.nama jn, r.nama pemohon, rt.kode rt_kode FROM issued_letters i JOIN letter_requests lr ON lr.id=i.request_id JOIN letter_types lt ON lt.kode=lr.jenis JOIN residents r ON r.id=lr.resident_id JOIN rt ON rt.id=lr.rt_id
    WHERE 1=1 ${u.role === 'warga' ? 'AND lr.household_id=' + Number(u.household_id) : rt ? 'AND lr.rt_id=' + rt : ''} ${jenis ? 'AND lr.jenis=@jenis' : ''} ${bln ? 'AND substr(i.tanggal,1,7)=@bln' : ''} ${q ? 'AND (i.nomor LIKE @q OR r.nama LIKE @q OR i.verif_code LIKE @q OR lr.no_reg LIKE @q)' : ''} ORDER BY i.tanggal DESC, i.id DESC`, { jenis, bln, q: `%${q}%` });
  const types = all('SELECT * FROM letter_types ORDER BY nama');
  return (<div>
    <PageHeader title="Arsip Surat" desc="Seluruh surat yang telah disetujui dan diterbitkan. PDF final bersifat tetap (tidak dapat diedit); setiap surat memiliki nomor unik dan kode verifikasi.">
      <Link href="/verifikasi" className="btn" target="_blank">Halaman verifikasi publik</Link>
    </PageHeader>
    <Flash sp={searchParams} />
    <Card>
      <form className="flex flex-wrap gap-2 mb-4">
        <input name="q" defaultValue={q} placeholder="Cari nomor / nama / kode verifikasi" className="input max-w-xs" />
        <select name="jenis" defaultValue={jenis} className="input max-w-[220px]"><option value="">Semua jenis</option>{types.map(t => <option key={t.kode} value={t.kode}>{t.nama}</option>)}</select>
        <input type="month" name="bulan" defaultValue={bln} className="input max-w-[170px]" />
        <button className="btn">Filter</button>
      </form>
      {rows.length ? <div className="overflow-x-auto"><table className="tbl"><thead><tr><th>Nomor Surat</th><th>Tanggal</th><th>Jenis</th><th>Atas Nama</th><th>RT</th><th>Penandatangan</th><th>Kode Verifikasi</th><th>Status</th><th></th></tr></thead><tbody>
        {rows.map(r => <tr key={r.id}><td className="font-mono text-xs font-semibold">{r.nomor}</td><td className="text-xs">{tgl(r.tanggal)}</td><td>{r.jn}</td><td>{r.pemohon}</td><td>{r.rt_kode}</td><td className="text-xs">{r.signer_name}<br /><span className="text-slate-500">{r.signer_jabatan}</span></td><td className="font-mono text-xs">{r.verif_code}</td>
          <td><Badge color="green">{r.status === 'final' ? 'Final' : r.status}</Badge>{r.file_path ? <div className="text-[10px] text-slate-400">tersimpan</div> : null}</td>
          <td className="whitespace-nowrap"><a href={`/api/pdf/surat/${r.rid}`} target="_blank" className="btn btn-sm btn-primary">PDF</a> <a href={`/api/pdf/surat/${r.rid}?dl=1`} className="btn btn-sm">Unduh</a> <Link href={`/surat/${r.rid}`} className="btn btn-sm">Riwayat</Link> {can.deleteAny(u.role) && <HapusSurat id={r.rid} label={r.nomor} final back="/arsip-surat" />}</td></tr>)}
      </tbody></table></div> : <Empty>Belum ada surat terbit.</Empty>}
    </Card>
  </div>);
}
