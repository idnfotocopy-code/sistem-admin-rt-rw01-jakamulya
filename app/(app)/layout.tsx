import { requireUser } from '@/lib/auth';
import { MENU, roleLabel } from '@/lib/rbac';
import { one } from '@/lib/db';
import { Nav } from '@/components/Nav';
import { logoutAction } from '../login/actions';
export const dynamic = 'force-dynamic';

function badges(u: any): Record<string, number> {
  const b: Record<string, number> = {};
  if (u.role === 'ketua_rt') b['/surat'] = one("SELECT COUNT(*) n FROM letter_requests WHERE status='diajukan' AND rt_id=?", u.rt_id).n;
  if (['ketua_rw', 'sekbend_rw'].includes(u.role)) b['/surat'] = one("SELECT COUNT(*) n FROM letter_requests lr JOIN letter_types t ON t.kode=lr.jenis WHERE status='diverifikasi_rt' OR (status='diverifikasi_rw' AND t.butuh_kelurahan=0)").n;
  if (u.role === 'kelurahan') b['/surat'] = one("SELECT COUNT(*) n FROM letter_requests lr JOIN letter_types t ON t.kode=lr.jenis WHERE status='diverifikasi_rw' AND t.butuh_kelurahan=1").n;
  if (u.role === 'warga') b['/iuran'] = one("SELECT COUNT(*) n FROM dues_invoices WHERE household_id=? AND status='belum'", u.household_id).n;
  if (['ketua_rt', 'ketua_rw', 'kelurahan', 'sekbend_rw'].includes(u.role)) b['/pengaduan'] = one(`SELECT COUNT(*) n FROM complaints WHERE status='baru' ${u.role === 'ketua_rt' ? 'AND rt_id=' + Number(u.rt_id) : ''}`).n;
  return b;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const u = requireUser();
  const b = badges(u);
  const items = MENU.filter(m => m.roles.includes(u.role as any)).map(m => ({ href: m.href, label: m.label, icon: m.icon, group: m.group, badge: b[m.href] }));
  const sidebar = (<>
    <div className="px-5 py-4 flex items-center gap-3 border-b border-brand-700">
      <img src="/logo-kota-bekasi.png" alt="Logo Kota Bekasi" className="w-11 h-auto" />
      <div className="leading-tight"><div className="text-[10px] font-bold text-gold-400 tracking-widest">KOTA BEKASI</div><div className="text-white font-bold text-sm">Sistem Administrasi</div><div className="text-brand-100 text-xs">RT RW01 · Jakamulya</div></div>
    </div>
    <Nav items={items} />
  </>);
  return (
    <div className="min-h-screen flex">
      <aside className="hidden lg:block w-72 shrink-0 bg-brand-800 min-h-screen sticky top-0 h-screen overflow-y-auto">{sidebar}</aside>
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
          <div className="flex items-center gap-3 px-4 md:px-6 h-16">
            <details className="lg:hidden relative">
              <summary className="btn btn-sm list-none cursor-pointer">☰ Menu</summary>
              <div className="absolute left-0 mt-2 w-72 max-h-[80vh] overflow-y-auto rounded-xl bg-brand-800 shadow-xl z-30">{sidebar}</div>
            </details>
            <div className="min-w-0 flex-1">
              <div className="text-sm md:text-base font-bold text-brand-900 truncate">Sistem Administrasi RT RW01 · Kelurahan Jakamulya · Bekasi Selatan</div>
              <div className="text-xs text-slate-500 truncate hidden sm:block">Pemerintah Kota Bekasi — Portal Administrasi Kelurahan · RW · RT</div>
            </div>
            <div className="text-right hidden sm:block">
              <div className="text-sm font-semibold">{u.nama}</div>
              <div className="text-xs text-brand-700">{roleLabel(u.role)}{u.rt_kode ? ` · RT ${u.rt_kode}` : ''}</div>
            </div>
            <form action={logoutAction}><button className="btn btn-sm">Keluar</button></form>
          </div>
        </header>
        <main className="p-4 md:p-6 flex-1">{children}</main>
        <footer className="px-6 py-3 text-xs text-slate-400 border-t bg-white">© 2026 RW 01 Kelurahan Jakamulya, Kec. Bekasi Selatan, Kota Bekasi • Versi demo — data fiktif</footer>
      </div>
    </div>);
}
