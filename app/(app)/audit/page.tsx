import fs from 'fs'; import path from 'path';
import { requireUser } from '@/lib/auth';
import { all, one, PATHS } from '@/lib/db';
import { tglJam } from '@/lib/util';
import { PageHeader, Flash, Card, Badge, Tabs, Stat } from '@/components/ui';
import { ConfirmButton } from '@/components/Confirm';
import { buatBackup, hapusBackup } from './actions';

const PER = 50;
export default function Audit({ searchParams: sp }: any) {
  requireUser('audit');
  const tab = sp.tab || 'log';
  const p = Math.max(1, Number(sp.p) || 1);
  const f = { user: sp.user || '', aksi: sp.aksi || '', from: sp.from || '', to: sp.to || '', q: sp.q || '' };
  const W = `WHERE 1=1 ${f.user ? 'AND username=@user' : ''} ${f.aksi ? 'AND aksi=@aksi' : ''} ${f.from ? 'AND at>=@from' : ''} ${f.to ? "AND at<=@to || ' 23:59:59'" : ''} ${f.q ? 'AND (detail LIKE @ql OR entitas LIKE @ql OR entitas_id LIKE @ql)' : ''}`;
  const par = { ...f, ql: `%${f.q}%` };
  const total = one(`SELECT COUNT(*) n FROM audit_logs ${W}`, par).n;
  const logs = all(`SELECT * FROM audit_logs ${W} ORDER BY at DESC, id DESC LIMIT ${PER} OFFSET ${(p - 1) * PER}`, par);
  const users = all('SELECT DISTINCT username FROM audit_logs WHERE username IS NOT NULL ORDER BY username');
  const aksis = all('SELECT DISTINCT aksi FROM audit_logs ORDER BY aksi');
  const gagal = one('SELECT COUNT(*) n FROM login_attempts WHERE success=0 AND at>?', Date.now() - 7 * 864e5)?.n || 0;
  const attempts = all('SELECT * FROM login_attempts ORDER BY at DESC LIMIT 20');
  let backups: { f: string; size: number; mtime: Date }[] = [];
  try { backups = fs.readdirSync(PATHS.backups).filter(x => x.endsWith('.db')).map(x => { const s = fs.statSync(path.join(PATHS.backups, x)); return { f: x, size: s.size, mtime: s.mtime }; }).sort((a, b) => +b.mtime - +a.mtime); } catch {}
  const dbSize = fs.existsSync(PATHS.db) ? fs.statSync(PATHS.db).size : 0;
  const qs = (o: any) => '?' + new URLSearchParams({ ...f, ...o }).toString();
  const fmtTs = (d: Date) => tglJam(new Date(+d + 7 * 3600e3).toISOString().replace('T', ' '));
  return (<div>
    <PageHeader title="Audit & Backup" desc="Jejak aktivitas pengguna (tidak dapat diubah dari aplikasi) dan pencadangan basis data." />
    <Flash sp={sp} />
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      <Stat label="Total entri log" value={one('SELECT COUNT(*) n FROM audit_logs').n} />
      <Stat label="Login gagal (7 hari)" value={gagal} color={gagal ? 'red' : 'brand'} />
      <Stat label="Jumlah backup" value={backups.length} sub={backups[0] ? 'terakhir ' + fmtTs(backups[0].mtime) : 'belum ada'} />
      <Stat label="Ukuran database" value={`${Math.round(dbSize / 1024)} KB`} />
    </div>
    <Tabs active={tab} items={[{ key: 'log', label: 'Log audit', href: '/audit' }, { key: 'login', label: 'Percobaan login', href: '/audit?tab=login' }, { key: 'backup', label: 'Backup database', href: '/audit?tab=backup' }]} />
    {tab === 'log' && <Card>
      <form className="flex flex-wrap gap-2 mb-3 items-end">
        <select name="user" defaultValue={f.user} className="input max-w-[160px]"><option value="">Semua pengguna</option>{users.map(x => <option key={x.username}>{x.username}</option>)}</select>
        <select name="aksi" defaultValue={f.aksi} className="input max-w-[220px]"><option value="">Semua aksi</option>{aksis.map(x => <option key={x.aksi}>{x.aksi}</option>)}</select>
        <input type="date" name="from" defaultValue={f.from} className="input max-w-[160px]" /><input type="date" name="to" defaultValue={f.to} className="input max-w-[160px]" />
        <input name="q" defaultValue={f.q} placeholder="Cari detail…" className="input max-w-[200px]" /><button className="btn">Filter</button><a href="/audit" className="btn">Reset</a>
      </form>
      <table className="tbl"><thead><tr><th>Waktu</th><th>Pengguna</th><th>Aksi</th><th>Entitas</th><th>Detail</th></tr></thead><tbody>
        {logs.map(l => <tr key={l.id}><td className="text-xs whitespace-nowrap">{tglJam(l.at)}</td><td className="font-mono text-xs">{l.username || '-'}</td><td><Badge color={/HAPUS|BATAL|TOLAK|NONAKTIF|RESET|GAGAL/.test(l.aksi) ? 'red' : /BACKUP|UBAH|KOREKSI/.test(l.aksi) ? 'amber' : 'teal'}>{l.aksi}</Badge></td><td className="text-xs">{l.entitas}{l.entitas_id ? ` #${l.entitas_id}` : ''}</td><td className="text-xs">{l.detail}</td></tr>)}
      </tbody></table>
      <div className="flex justify-between items-center mt-3 text-sm"><span className="text-slate-500">{total} entri • halaman {p} dari {Math.max(1, Math.ceil(total / PER))}</span>
        <div className="flex gap-2">{p > 1 && <a className="btn btn-sm" href={qs({ p: p - 1 })}>← Sebelumnya</a>}{p * PER < total && <a className="btn btn-sm" href={qs({ p: p + 1 })}>Berikutnya →</a>}</div></div>
    </Card>}
    {tab === 'login' && <Card title="20 percobaan login terakhir"><table className="tbl"><thead><tr><th>Waktu</th><th>Username</th><th>Hasil</th></tr></thead><tbody>
      {attempts.map(a => <tr key={a.id}><td className="text-xs">{fmtTs(new Date(a.at))}</td><td className="font-mono text-xs">{a.username}</td><td><Badge color={a.success ? 'green' : 'red'}>{a.success ? 'Berhasil' : 'Gagal'}</Badge></td></tr>)}
    </tbody></table><p className="text-xs text-slate-500 mt-2">Login diblokir sementara 5 menit setelah 5 kali gagal.</p></Card>}
    {tab === 'backup' && <div className="grid lg:grid-cols-3 gap-4">
      <Card title="Buat backup"><p className="text-sm text-slate-600 mb-3">Menyalin seluruh basis data (warga, surat, keuangan, log) secara konsisten menggunakan SQLite online backup. Simpan salinan di media terpisah secara berkala.</p>
        <form action={buatBackup}><button className="btn btn-primary w-full">💾 Backup sekarang</button></form>
        <p className="text-xs text-slate-500 mt-3">File unggahan (lampiran, TTD) berada di folder <span className="font-mono">data/private</span> dan arsip PDF di <span className="font-mono">data/arsip</span> — ikut dicadangkan pada level server.</p></Card>
      <Card title="Daftar file backup" className="lg:col-span-2">{backups.length ? <table className="tbl"><thead><tr><th>File</th><th>Waktu</th><th>Ukuran</th><th></th></tr></thead><tbody>
        {backups.map(b => <tr key={b.f}><td className="font-mono text-xs">{b.f}</td><td className="text-xs">{fmtTs(b.mtime)}</td><td className="text-xs">{Math.round(b.size / 1024)} KB</td><td className="text-right whitespace-nowrap"><a href={`/api/backup?f=${encodeURIComponent(b.f)}`} className="btn btn-sm">⬇ Unduh</a> <form action={hapusBackup} className="inline"><input type="hidden" name="f" value={b.f} /><ConfirmButton className="btn btn-sm btn-danger" msg={`Hapus ${b.f}?`}>Hapus</ConfirmButton></form></td></tr>)}
      </tbody></table> : <p className="text-sm text-slate-500">Belum ada backup.</p>}</Card>
    </div>}
  </div>);
}
