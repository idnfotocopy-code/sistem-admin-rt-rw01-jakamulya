import { loginAction } from './actions';
import { Flash } from '@/components/ui';
export const dynamic = 'force-dynamic';
const DEMO = [
  ['admin', 'admin123', 'Admin Sistem'], ['kelurahan', 'kelurahan123', 'Petugas Kelurahan'], ['ketuarw', 'ketuarw123', 'Ketua RW 01'], ['sekbendrw', 'sekbendrw123', 'Sekretaris/Bendahara RW'],
  ['ketuart1', 'ketuart123', 'Ketua RT 001'], ['bendrt1', 'bendrt123', 'Bendahara RT 001'], ['warga', 'warga123', 'Warga RT 001 (Budi Santoso)'],
];
export default function Login({ searchParams }: { searchParams: any }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-800 via-brand-700 to-brand-500 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl grid md:grid-cols-2 rounded-2xl overflow-hidden shadow-2xl bg-white">
        <div className="bg-brand-900 text-white p-8 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-16 -bottom-16 w-72 h-72 rounded-full bg-brand-700/40" />
          <div className="relative">
            <div className="flex items-center gap-4">
              <img src="/logo-kota-bekasi.png" alt="Logo Kota Bekasi" className="w-20 h-auto drop-shadow" />
              <div><div className="text-gold-400 text-xs font-bold tracking-widest">PEMERINTAH KOTA BEKASI</div><div className="text-lg font-bold leading-tight">Kelurahan Jakamulya</div><div className="text-sm text-brand-100">Kecamatan Bekasi Selatan</div></div>
            </div>
            <h1 className="mt-8 text-3xl font-extrabold leading-tight">Sistem Administrasi<br />RT RW01</h1>
            <p className="mt-3 text-brand-100 text-sm">Portal layanan warga & pengurus: data warga/KK, surat online ber-PDF, iuran rutin, iuran takziah, kas, pengaduan, dan pengumuman — RW 01 Kelurahan Jakamulya, Bekasi Selatan.</p>
          </div>
          <div className="relative mt-8 text-xs text-brand-200">Versi demo 1.0 • Rancangan 25 Oktober 2026 • Data contoh/fiktif</div>
        </div>
        <div className="p-8">
          <h2 className="text-xl font-bold text-brand-900">Masuk</h2>
          <p className="text-sm text-slate-500 mb-5">Gunakan akun warga atau pengurus.</p>
          <Flash sp={searchParams} />
          <form action={loginAction} className="space-y-3">
            <div><label className="label">Username</label><input name="username" className="input" required autoFocus placeholder="mis. warga" /></div>
            <div><label className="label">Password</label><input name="password" type="password" className="input" required /></div>
            <button className="btn btn-primary w-full py-2.5">Masuk</button>
          </form>
          <div className="mt-6">
            <div className="text-xs font-semibold text-slate-500 uppercase mb-2">Akun demo (klik untuk isi)</div>
            <div className="grid gap-1">
              {DEMO.map(([u, p, r]) => (
                <form key={u} action={loginAction} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-brand-50">
                  <input type="hidden" name="username" value={u} /><input type="hidden" name="password" value={p} />
                  <span><b className="text-brand-800">{u}</b> / <span className="font-mono text-slate-500">{p}</span></span>
                  <span className="flex items-center gap-2"><span className="text-xs text-slate-500">{r}</span><button className="btn btn-sm btn-primary">Masuk</button></span>
                </form>))}
            </div>
            <p className="text-[11px] text-slate-400 mt-2">Akun lain: ketuart2/ketuart3 (ketuart123), bendrt2/bendrt3 (bendrt123), warga2/warga3 (warga123).</p>
          </div>
        </div>
      </div>
    </div>);
}
