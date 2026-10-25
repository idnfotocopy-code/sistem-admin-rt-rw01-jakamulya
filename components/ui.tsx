import Link from 'next/link';
import React from 'react';

const COLORS: Record<string, string> = {
  green: 'bg-emerald-100 text-emerald-800', red: 'bg-red-100 text-red-700', amber: 'bg-amber-100 text-amber-800', sky: 'bg-sky-100 text-sky-800',
  violet: 'bg-violet-100 text-violet-800', orange: 'bg-orange-100 text-orange-800', slate: 'bg-slate-100 text-slate-700', teal: 'bg-teal-100 text-teal-800',
};
export function Badge({ color = 'slate', children }: { color?: string; children: React.ReactNode }) { return <span className={`badge ${COLORS[color] || COLORS.slate}`}>{children}</span>; }
export function PageHeader({ title, desc, children }: { title: string; desc?: string; children?: React.ReactNode }) {
  return (<div className="flex flex-wrap items-end justify-between gap-3 mb-5">
    <div><h1 className="text-xl md:text-2xl font-bold text-brand-900">{title}</h1>{desc && <p className="text-sm text-slate-500 mt-1 max-w-3xl">{desc}</p>}</div>
    <div className="flex flex-wrap gap-2">{children}</div></div>);
}
export function Flash({ sp }: { sp: any }) {
  return (<>
    {sp?.ok && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">✓ {sp.ok}</div>}
    {sp?.err && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">⚠ {sp.err}</div>}
  </>);
}
export function Stat({ label, value, sub, color = 'brand', href }: { label: string; value: React.ReactNode; sub?: string; color?: string; href?: string }) {
  const bar: Record<string, string> = { brand: 'bg-brand-500', gold: 'bg-gold-400', red: 'bg-red-500', sky: 'bg-sky-500', violet: 'bg-violet-500', amber: 'bg-amber-500' };
  const inner = (<div className="card p-4 relative overflow-hidden h-full hover:shadow-md transition">
    <div className={`absolute left-0 top-0 h-full w-1.5 ${bar[color]}`} />
    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
    <div className="text-2xl font-bold text-brand-900 mt-1">{value}</div>
    {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}</div>);
  return href ? <Link href={href}>{inner}</Link> : inner;
}
export function Card({ title, actions, children, className = '' }: { title?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (<div className={`card ${className}`}>{title && <div className="card-h"><span>{title}</span><div className="flex gap-2">{actions}</div></div>}<div className="card-b">{children}</div></div>);
}
export function Empty({ children = 'Belum ada data.' }: { children?: React.ReactNode }) { return <div className="text-sm text-slate-400 italic py-6 text-center">{children}</div>; }
export function Tabs({ items, active }: { items: { key: string; label: string; href: string }[]; active: string }) {
  return <div className="flex flex-wrap gap-2 mb-4">{items.map(t => <Link key={t.key} href={t.href} className={`tab ${t.key === active ? 'tab-on' : 'tab-off'}`}>{t.label}</Link>)}</div>;
}
export function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) { return <div className={className}><label className="label">{label}</label>{children}</div>; }
export function RtSelect({ rts, name = 'rt_id', value, all = true, required = false }: { rts: any[]; name?: string; value?: any; all?: boolean; required?: boolean }) {
  return <select name={name} defaultValue={value ?? ''} className="input" required={required}>{all && <option value="">Semua RT</option>}{rts.map(r => <option key={r.id} value={r.id}>RT {r.kode}</option>)}</select>;
}
