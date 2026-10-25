import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { all, one } from '@/lib/db';
import { ROLES, MENU, can, roleLabel } from '@/lib/rbac';
import { tglJam } from '@/lib/util';
import { PageHeader, Flash, Card, Badge, Tabs, Field } from '@/components/ui';
import { ConfirmButton } from '@/components/Confirm';
import { simpanPengguna, resetSandi, ubahStatus, hapusPengguna } from './actions';

const AKSI: [string, string][] = [['editWarga', 'Ubah data warga'], ['seeFullNik', 'Lihat NIK lengkap'], ['verifRT', 'Verifikasi surat (RT)'], ['verifRW', 'Verifikasi surat (RW)'], ['approveRW', 'Setujui & terbitkan surat RW'], ['approveKel', 'Proses surat Kelurahan'], ['manageIuran', 'Kelola iuran & pembayaran'], ['manageTakziah', 'Kelola kejadian takziah'], ['financeTakziah', 'Catat dana takziah'], ['reviewTakziah', 'Periksa laporan takziah'], ['inputKas', 'Input transaksi kas'], ['approveKas', 'Setujui transaksi kas'], ['handleAduan', 'Tindak lanjut pengaduan'], ['postPengumuman', 'Buat pengumuman'], ['editKop', 'Ubah kop surat'], ['uploadTtd', 'Unggah tanda tangan'], ['deleteAny', 'Hapus data (admin)']];

function Form({ e, rts, kk }: any) {
  return <form action={simpanPengguna} className="grid md:grid-cols-2 gap-3" key={e?.id || 'new'}>
    {e && <input type="hidden" name="id" value={e.id} />}
    <Field label="Nama lengkap"><input name="nama" required defaultValue={e?.nama} className="input" /></Field>
    <Field label="Username"><input name="username" required defaultValue={e?.username} className="input" pattern="[a-z0-9._]{3,30}" /></Field>
    <Field label="No. HP"><input name="phone" defaultValue={e?.phone} className="input" /></Field>
    <Field label="Email"><input name="email" type="email" defaultValue={e?.email} className="input" /></Field>
    <Field label="Role"><select name="role" defaultValue={e?.role || 'warga'} className="input">{ROLES.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}</select></Field>
    <Field label="Jabatan (tampil di surat)"><input name="jabatan" defaultValue={e?.jabatan} className="input" placeholder="mis. Ketua RT 001" /></Field>
    <Field label="Cakupan RT (wajib untuk Ketua/Bendahara RT & Warga)"><select name="rt_id" defaultValue={e?.rt_id || ''} className="input"><option value="">— Tingkat RW / tidak ada —</option>{rts.map((r: any) => <option key={r.id} value={r.id}>RT {r.kode}</option>)}</select></Field>
    <Field label="Tautan KK (khusus Warga)"><select name="household_id" defaultValue={e?.household_id || ''} className="input"><option value="">—</option>{kk.map((h: any) => <option key={h.id} value={h.id}>RT {h.rt_kode} • {h.kepala_nama} • {h.no_kk}</option>)}</select></Field>
    {!e && <Field label="Kata sandi awal (min. 8)"><input name="password" type="text" required minLength={8} className="input" /></Field>}
    <div className="md:col-span-2 flex gap-2"><button className="btn btn-primary">{e ? 'Simpan perubahan' : 'Buat akun'}</button>{e && <Link href="/pengguna" className="btn">Batal</Link>}</div>
  </form>;
}

export default function Pengguna({ searchParams: sp }: any) {
  const me = requireUser('pengguna');
  const tab = sp.tab || 'daftar'; const q = (sp.q || '').trim(); const role = sp.role || '';
  const rts = all('SELECT * FROM rt ORDER BY kode');
  const kk = all('SELECT h.id, h.no_kk, h.kepala_nama, rt.kode rt_kode FROM households h JOIN rt ON rt.id=h.rt_id ORDER BY rt.kode, h.kepala_nama');
  const users = all(`SELECT u.*, rt.kode rt_kode, h.no_kk FROM users u LEFT JOIN rt ON rt.id=u.rt_id LEFT JOIN households h ON h.id=u.household_id WHERE 1=1 ${q ? "AND (u.nama LIKE @q OR u.username LIKE @q)" : ''} ${role ? 'AND u.role=@role' : ''} ORDER BY CASE u.role WHEN 'admin' THEN 0 WHEN 'kelurahan' THEN 1 WHEN 'ketua_rw' THEN 2 WHEN 'sekbend_rw' THEN 3 WHEN 'ketua_rt' THEN 4 WHEN 'bendahara_rt' THEN 5 ELSE 6 END, u.rt_id, u.nama`, { q: `%${q}%`, role });
  const edit = sp.edit ? one('SELECT * FROM users WHERE id=?', Number(sp.edit)) : null;
  return (<div>
    <PageHeader title="Pengguna & Hak Akses" desc="Kelola akun, role, cakupan wilayah, dan status pengguna. Hak akses mengikuti prinsip least privilege." />
    <Flash sp={sp} />
    <Tabs active={edit ? 'daftar' : tab} items={[{ key: 'daftar', label: `Daftar akun (${users.length})`, href: '/pengguna' }, { key: 'baru', label: '+ Akun baru', href: '/pengguna?tab=baru' }, { key: 'matriks', label: 'Matriks hak akses', href: '/pengguna?tab=matriks' }]} />
    {edit && <div className="grid lg:grid-cols-3 gap-4 mb-4">
      <Card title={`Ubah akun: ${edit.username}`} className="lg:col-span-2"><Form e={edit} rts={rts} kk={kk} /></Card>
      <Card title="Reset kata sandi"><form action={resetSandi} className="space-y-2"><input type="hidden" name="id" value={edit.id} /><Field label="Kata sandi baru (min. 8)"><input name="password" required minLength={8} className="input" /></Field><p className="text-xs text-slate-500">Sesi aktif pengguna akan diakhiri. Sampaikan sandi baru secara langsung kepada yang bersangkutan.</p><button className="btn btn-primary w-full">Reset sandi</button></form></Card>
    </div>}
    {tab === 'daftar' && <Card>
      <form className="flex flex-wrap gap-2 mb-3"><input name="q" defaultValue={q} placeholder="Cari nama / username" className="input max-w-xs" /><select name="role" defaultValue={role} className="input max-w-[220px]"><option value="">Semua role</option>{ROLES.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}</select><button className="btn">Cari</button></form>
      <table className="tbl"><thead><tr><th>Nama</th><th>Username</th><th>Role / Jabatan</th><th>Cakupan</th><th>Login terakhir</th><th>Status</th><th></th></tr></thead><tbody>
        {users.map(x => <tr key={x.id}><td className="font-medium">{x.nama}<div className="text-xs text-slate-500">{x.phone}</div></td><td className="font-mono text-xs">{x.username}</td><td><Badge color={x.role === 'admin' ? 'red' : x.role === 'warga' ? 'slate' : 'teal'}>{roleLabel(x.role)}</Badge><div className="text-xs text-slate-500">{x.jabatan}</div></td>
          <td className="text-xs">{x.rt_kode ? `RT ${x.rt_kode}/RW 01` : 'RW 01'}{x.no_kk && <div className="text-slate-500">KK {x.no_kk}</div>}</td><td className="text-xs">{x.last_login ? tglJam(x.last_login) : '-'}</td>
          <td><Badge color={x.status === 'aktif' ? 'green' : 'slate'}>{x.status}</Badge></td>
          <td className="whitespace-nowrap text-right"><Link href={`/pengguna?edit=${x.id}`} className="btn btn-sm">Ubah</Link> {x.id !== me.id && <form action={ubahStatus} className="inline"><input type="hidden" name="id" value={x.id} /><ConfirmButton className={`btn btn-sm ${x.status === 'aktif' ? 'btn-danger' : ''}`} msg={`${x.status === 'aktif' ? 'Nonaktifkan' : 'Aktifkan'} akun ${x.username}?`}>{x.status === 'aktif' ? 'Nonaktifkan' : 'Aktifkan'}</ConfirmButton></form>} {x.id !== me.id && can.deleteAny(me.role) && <form action={hapusPengguna} className="inline"><input type="hidden" name="id" value={x.id} /><ConfirmButton className="btn btn-sm btn-danger" msg={`HAPUS PERMANEN akun ${x.username} (${x.nama})?\n\nAkun tidak dapat dipulihkan. Bila hanya ingin memblokir login, gunakan Nonaktifkan.`}>🗑 Hapus</ConfirmButton></form>}</td></tr>)}
      </tbody></table></Card>}
    {tab === 'baru' && !edit && <Card title="Buat akun baru"><Form rts={rts} kk={kk} /></Card>}
    {tab === 'matriks' && !edit && <div className="space-y-4">
      <Card title="Akses menu per role"><div className="overflow-x-auto"><table className="tbl text-xs"><thead><tr><th>Menu</th>{ROLES.map(r => <th key={r.key} className="text-center">{r.label}</th>)}</tr></thead><tbody>
        {MENU.map(m => <tr key={m.key}><td>{m.icon} {m.label}</td>{ROLES.map(r => <td key={r.key} className="text-center">{m.roles.includes(r.key) ? <span className="text-green-700 font-bold">✓</span> : <span className="text-slate-300">—</span>}</td>)}</tr>)}</tbody></table></div></Card>
      <Card title="Kewenangan aksi"><div className="overflow-x-auto"><table className="tbl text-xs"><thead><tr><th>Aksi</th>{ROLES.map(r => <th key={r.key} className="text-center">{r.label}</th>)}</tr></thead><tbody>
        {AKSI.map(([k, l]) => <tr key={k}><td>{l}</td>{ROLES.map(r => <td key={r.key} className="text-center">{(can as any)[k](r.key) ? <span className="text-green-700 font-bold">✓</span> : <span className="text-slate-300">—</span>}</td>)}</tr>)}</tbody></table></div>
        <p className="text-xs text-slate-500 mt-2">&quot;Hapus data (admin)&quot;: Admin Sistem dapat menghapus permanen data di semua modul (pengguna, KK/warga, RT, surat, pengaduan, pengumuman, tagihan & jenis iuran, kejadian & aturan takziah, transaksi kas yang belum disetujui, TTD, backup). Setiap penghapusan tercatat di audit log. Ketua/Bendahara RT dan Warga hanya dapat mengakses data RT masing-masing; Warga hanya data KK sendiri.</p></Card>
      <Card title="Deskripsi role"><ul className="text-sm space-y-2">{ROLES.map(r => <li key={r.key}><b>{r.label}</b> — {r.desc}</li>)}</ul></Card>
    </div>}
  </div>);
}
