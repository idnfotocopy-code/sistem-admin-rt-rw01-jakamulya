import { ConfirmButton } from './Confirm';
import { hapusSurat } from '@/app/(app)/surat/actions';
/** Tombol hapus surat khusus admin. Surat final memerlukan ketik "HAPUS". */
export function HapusSurat({ id, label, final, back, big }: { id: number; label: string; final: boolean; back: string; big?: boolean }) {
  const cls = big ? 'btn btn-danger' : 'btn btn-sm btn-danger';
  if (!final) return <form action={hapusSurat} className="inline"><input type="hidden" name="id" value={id} /><input type="hidden" name="back" value={back} />
    <ConfirmButton className={cls} msg={`Hapus permohonan surat ${label}?\n\nRiwayat proses dan lampiran ikut dihapus.`}>🗑 Hapus</ConfirmButton></form>;
  return <details className="inline-block align-top"><summary className={cls + ' cursor-pointer list-none'}>🗑 Hapus</summary>
    <form action={hapusSurat} className="mt-1 flex gap-1 items-center p-2 rounded border border-red-200 bg-red-50"><input type="hidden" name="id" value={id} /><input type="hidden" name="back" value={back} />
      <input name="konfirmasi" required placeholder="ketik HAPUS" className="input !py-1 !text-xs w-28" autoComplete="off" />
      <ConfirmButton className="btn btn-sm btn-danger" msg={`PERINGATAN: surat ${label} sudah FINAL dan diterbitkan.\n\nMenghapus akan menghilangkan nomor surat, kode verifikasi, dan arsip PDF secara permanen. Lanjutkan?`}>Hapus final</ConfirmButton></form></details>;
}
