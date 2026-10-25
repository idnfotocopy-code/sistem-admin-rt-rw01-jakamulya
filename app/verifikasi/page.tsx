import Link from 'next/link';
import { one } from '@/lib/db';
import { tgl, maskNik } from '@/lib/util';
export const dynamic = 'force-dynamic';
export default function Verifikasi({ searchParams }: any) {
  const kode = String(searchParams.kode || '').trim().toUpperCase();
  const r = kode ? one(`SELECT i.*, lt.nama jn, res.nama, res.nik, rt.kode rt_kode FROM issued_letters i JOIN letter_requests lr ON lr.id=i.request_id JOIN letter_types lt ON lt.kode=lr.jenis JOIN residents res ON res.id=lr.resident_id JOIN rt ON rt.id=lr.rt_id WHERE i.verif_code=?`, kode) : null;
  return (<div className="min-h-screen bg-gradient-to-br from-brand-700 to-brand-500 flex items-center justify-center p-4">
    <div className="card w-full max-w-lg p-6">
      <div className="flex items-center gap-3 mb-4"><img src="/logo-kota-bekasi.png" className="w-12" alt="" /><div><div className="font-bold text-brand-900">Verifikasi Keaslian Surat</div><div className="text-xs text-slate-500">RW 01 Kelurahan Jakamulya • Bekasi Selatan</div></div></div>
      <form className="flex gap-2 mb-4"><input name="kode" defaultValue={kode} placeholder="Masukkan kode verifikasi (10 karakter)" className="input" /><button className="btn btn-primary">Cek</button></form>
      {kode && (r ? <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-sm space-y-1">
        <div className="font-bold text-emerald-800">✓ Surat TERDAFTAR & ASLI</div>
        <div>Nomor: <b className="font-mono">{r.nomor}</b></div><div>Jenis: {r.jn}</div><div>Atas nama: {r.nama} (NIK {maskNik(r.nik)}), RT {r.rt_kode}/RW 01</div><div>Tanggal terbit: {tgl(r.tanggal)}</div><div>Status: {r.status}</div>
      </div> : <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">✕ Kode tidak ditemukan. Surat mungkin tidak sah.</div>)}
      <div className="mt-4 text-xs"><Link href="/login" className="text-brand-700 underline">← Masuk ke aplikasi</Link></div>
    </div></div>);
}
