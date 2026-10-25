'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
export function Nav({ items }: { items: { href: string; label: string; icon: string; group: string; badge?: number }[] }) {
  const p = usePathname();
  let last = '';
  return (<nav className="px-3 py-3 space-y-0.5 text-sm">
    {items.map(m => {
      const showGroup = m.group !== last; last = m.group;
      const active = p === m.href || p.startsWith(m.href + '/');
      return (<div key={m.href}>
        {showGroup && <div className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-brand-300">{m.group}</div>}
        <Link href={m.href} className={`flex items-center gap-2 rounded-lg px-3 py-2 ${active ? 'bg-white text-brand-800 font-semibold shadow' : 'text-brand-50 hover:bg-brand-700'}`}>
          <span className="w-5 text-center">{m.icon}</span><span className="flex-1">{m.label}</span>
          {!!m.badge && <span className="rounded-full bg-gold-400 text-brand-900 text-[10px] font-bold px-1.5">{m.badge}</span>}
        </Link></div>);
    })}
  </nav>);
}
