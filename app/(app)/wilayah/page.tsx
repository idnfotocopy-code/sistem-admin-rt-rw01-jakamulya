import { requireUser } from '@/lib/auth';
import { all, one, settings } from '@/lib/db';
import { can } from '@/lib/rbac';
import { tgl } from '@/lib/util';
import { PageHeader, Flash, Card, Field } from '@/components/ui';
import { saveKelurahan, saveRw, saveRt, hapusRt } from './actions';
import { ConfirmButton } from '@/components/Confirm';

export default function Wilayah({ searchParams }: any) {
  const u = requireUser('wilayah');
  const k = one('SELECT * FROM kelurahan WHERE id=1');
  const rw = one('SELECT * FROM rw WHERE id=1');
  const rts = all(`SELECT rt.*, (SELECT COUNT(*) FROM households h WHERE h.rt_id=rt.id) kk, (SELECT COUNT(*) FROM residents r JOIN households h ON h.id=r.household_id WHERE h.rt_id=rt.id AND r.status='hidup') jiwa FROM rt ORDER BY kode`);
  const s = settings();
  const ek = can.editWilayah(u.role), erw = ek || u.role === 'ketua_rw';
  const ro = (b: boolean) => ({ readOnly: !b, disabled: !b });
  const nomorContoh = `012/SKD/RT-001/RW-01/${['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'][new Date().getMonth()]}/${new Date().getFullYear()}`;
  return (<div>
    <PageHeader title="Data Wilayah" desc="Struktur Kelurahan → RW → RT, pengurus, masa jabatan dan konfigurasi penomoran surat. Seluruh perubahan tercatat di audit log." />
    <Flash sp={searchParams} />
    <div className="grid xl:grid-cols-2 gap-5">
      <Card title="Kelurahan">
        <form action={saveKelurahan} className="grid-form">
          <Field label="Nama Kelurahan"><input name="nama" defaultValue={k.nama} className="input" {...ro(ek)} /></Field>
          <Field label="Kecamatan"><input name="kecamatan" defaultValue={k.kecamatan} className="input" {...ro(ek)} /></Field>
          <Field label="Kota"><input name="kota" defaultValue={k.kota} className="input" {...ro(ek)} /></Field>
          <Field label="Provinsi"><input name="provinsi" defaultValue={k.provinsi} className="input" {...ro(ek)} /></Field>
          <Field label="Alamat Kantor" className="md:col-span-2"><input name="alamat" defaultValue={k.alamat} className="input" {...ro(ek)} /></Field>
          <Field label="Kode Pos"><input name="kode_pos" defaultValue={k.kode_pos} className="input" {...ro(ek)} /></Field>
          <Field label="Telepon"><input name="telp" defaultValue={k.telp} className="input" {...ro(ek)} /></Field>
          <Field label="Lurah"><input name="lurah" defaultValue={k.lurah} className="input" {...ro(ek)} /></Field>
          <Field label="NIP Lurah"><input name="nip_lurah" defaultValue={k.nip_lurah} className="input" {...ro(ek)} /></Field>
          {ek && <div className="md:col-span-2"><button className="btn btn-primary">Simpan Kelurahan</button></div>}
        </form>
      </Card>
      <Card title="Rukun Warga 01">
        <form action={saveRw} className="grid-form">
          <Field label="Nama"><input name="nama" defaultValue={rw.nama} className="input" {...ro(erw)} /></Field>
          <Field label="Kode Surat RW"><input name="kode_surat" defaultValue={rw.kode_surat} className="input" {...ro(erw)} /></Field>
          <Field label="Alamat Sekretariat" className="md:col-span-2"><input name="alamat" defaultValue={rw.alamat} className="input" {...ro(erw)} /></Field>
          <Field label="Ketua RW"><input name="ketua" defaultValue={rw.ketua} className="input" {...ro(erw)} /></Field>
          <Field label="Sekretaris"><input name="sekretaris" defaultValue={rw.sekretaris} className="input" {...ro(erw)} /></Field>
          <Field label="Bendahara"><input name="bendahara" defaultValue={rw.bendahara} className="input" {...ro(erw)} /></Field>
          <div className="grid grid-cols-2 gap-2"><Field label="Masa mulai"><input type="date" name="masa_mulai" defaultValue={rw.masa_mulai} className="input" {...ro(erw)} /></Field><Field label="Masa selesai"><input type="date" name="masa_selesai" defaultValue={rw.masa_selesai} className="input" {...ro(erw)} /></Field></div>
          {erw && <div className="md:col-span-2"><button className="btn btn-primary">Simpan RW</button></div>}
        </form>
      </Card>
    </div>
    <Card title={`Rukun Tetangga di RW 01 (${rts.length} RT)`} className="mt-5">
      <div className="space-y-4">
        {rts.map(r => { const e = erw || (u.role === 'ketua_rt' && u.rt_id === r.id); return (
          <form key={r.id} action={saveRt} className="rounded-xl border border-slate-200 p-4">
            <input type="hidden" name="id" value={r.id} />
            <div className="flex items-center justify-between mb-3"><div className="font-bold text-brand-800">RT {r.kode} <span className="text-xs font-normal text-slate-500">• {r.kk} KK • {r.jiwa} jiwa • masa jabatan {tgl(r.masa_mulai)} – {tgl(r.masa_selesai)}</span></div><div className="flex gap-2">{e && <button className="btn btn-sm btn-primary">Simpan</button>}{can.deleteAny(u.role) && <ConfirmButton formAction={hapusRt} className="btn btn-sm btn-danger" msg={`Hapus RT ${r.kode}?\n\nHanya dapat dihapus bila tidak ada KK, akun, surat, pengaduan, kas, takziah, atau pengumuman yang terkait.`}>🗑 Hapus RT</ConfirmButton>}</div></div>
            <div className="grid md:grid-cols-6 gap-3">
              <Field label="Kode"><input name="kode" defaultValue={r.kode} className="input" {...ro(ek)} /></Field>
              <Field label="Ketua RT"><input name="ketua" defaultValue={r.ketua} className="input" {...ro(e)} /></Field>
              <Field label="Bendahara RT"><input name="bendahara" defaultValue={r.bendahara} className="input" {...ro(e)} /></Field>
              <Field label="Wilayah / Alamat" className="md:col-span-1"><input name="alamat" defaultValue={r.alamat} className="input" {...ro(e)} /></Field>
              <Field label="Masa mulai"><input type="date" name="masa_mulai" defaultValue={r.masa_mulai} className="input" {...ro(e)} /></Field>
              <Field label="Masa selesai"><input type="date" name="masa_selesai" defaultValue={r.masa_selesai} className="input" {...ro(e)} /></Field>
            </div>
            {ek ? null : <input type="hidden" name="kode" value={r.kode} />}
          </form>); })}
        {ek && <form action={saveRt} className="rounded-xl border-2 border-dashed border-brand-200 p-4">
          <div className="font-bold text-brand-800 mb-3">+ Tambah RT baru</div>
          <div className="grid md:grid-cols-6 gap-3">
            <Field label="Kode (3 digit)"><input name="kode" placeholder="004" className="input" required /></Field>
            <Field label="Ketua RT"><input name="ketua" className="input" /></Field>
            <Field label="Bendahara RT"><input name="bendahara" className="input" /></Field>
            <Field label="Wilayah / Alamat"><input name="alamat" className="input" /></Field>
            <Field label="Masa mulai"><input type="date" name="masa_mulai" className="input" /></Field>
            <Field label="Masa selesai"><input type="date" name="masa_selesai" className="input" /></Field>
          </div><button className="btn btn-sm btn-primary mt-3">Tambah RT</button></form>}
      </div>
    </Card>
    <Card title="Konfigurasi Penomoran" className="mt-5">
      <div className="grid md:grid-cols-3 gap-4 text-sm">
        <div><div className="label">Format nomor surat</div><div className="font-mono bg-slate-50 rounded p-2">{s.format_nomor_surat || '{no}/{kode}/RT-{rt}/RW-01/{bulan}/{tahun}'}</div><div className="text-xs text-slate-500 mt-1">Contoh: <span className="font-mono">{nomorContoh}</span></div></div>
        <div><div className="label">Format kuitansi iuran</div><div className="font-mono bg-slate-50 rounded p-2">{s.format_kuitansi_iuran || 'KW/RT{rt}/{tahun}/{no}'}</div><div className="text-xs text-slate-500 mt-1">Nomor berurutan per RT per tahun, tidak dapat dipakai ulang.</div></div>
        <div><div className="label">Format kuitansi takziah</div><div className="font-mono bg-slate-50 rounded p-2">{s.format_kuitansi_takziah || 'TAK/RT{rt}/{tahun}/{no}'}</div><div className="text-xs text-slate-500 mt-1">Penomoran dikunci dengan transaksi database.</div></div>
      </div>
    </Card>
  </div>);
}
