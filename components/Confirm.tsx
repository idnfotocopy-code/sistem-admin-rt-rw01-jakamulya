'use client';
export function ConfirmButton({ children, msg, className = 'btn btn-sm', formAction, name, value }: { children: React.ReactNode; msg: string; className?: string; formAction?: any; name?: string; value?: string }) {
  return <button className={className} formAction={formAction} name={name} value={value} onClick={(e) => { if (!confirm(msg)) e.preventDefault(); }}>{children}</button>;
}
