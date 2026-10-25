import { requireUser } from '@/lib/auth';
import { all, settings } from '@/lib/db';
import { can } from '@/lib/rbac';
import { tglJam } from '@/lib/util';
import { PageHeader, Flash, Card, Badge, Field } from '@/components/ui';
import { ConfirmButton } from '@/components/Confirm';
import { simpanKop, unggahTtd, aturTtd, hapusTtd } from './actions';

export default function KopTtd({ searchParams: sp }: any) {
  const u = requireUser('kop-ttd');
  const st = settings(); const admin = u.role === 'admin';
  const sigs = all(`SELECT s.*, u.username, b.nama pengunggah FROM signature_assets s LEFT JOIN users u ON u.id=s.user_id LEFT JOIN users b ON b.id=s.uploaded_by ${admin ? '' : 'WHERE s.user_id=' + u.id} ORDER BY s.user_id, s.versi DESC`);
  const pejabat = all("SELECT id, nama, jabatan FROM users WHERE role IN ('kelurahan','ketua_rw','sekbend_rw','ketua_rt') AND status='aktif' ORDER BY role, nama");
  const ro = !can.editKop(u.role);
  return (<div>
    <PageHeader title="Kop Surat & Tanda Tangan" desc="Atur kop resmi dokumen dan tanda tangan digital (gambar) pejabat. File TTD disimpan di folder privat dan hanya dipakai saat dokumen disetujui." />
    <Flash sp={sp} />
    <div className="grid lg:grid-cols-2 gap-4">
      <Card title="Pratinjau kop">
        <div className="border rounded-lg p-4 bg-white"><div className="flex items-center gap-4 border-b-4 border-double border-slate-800 pb-3">
          <img src="/logo-kota-bekasi.png" alt="Logo Kota Bekasi" className="w-16 h-16 object-contain" />
          <div className="flex-1 text-center leading-tight"><div className="font-semibold">{st.kop_baris1}</div><div className="font-semibold">{st.kop_baris2}</div><div className="font-bold text-lg">{st.kop_baris3}</div><div className="font-bold">{st.kop_baris4}</div><div className="text-xs italic mt-1">{st.kop_alamat}</div></div></div>
          <div className="text-xs text-slate-500 mt-3">Contoh nomor surat: <span className="font-mono">{(st.format_nomor_surat || '').replace('{no}', '012').replace('{kode}', 'SKD').replace('{rt}', '001').replace('{bulan}', 'X').replace('{tahun}', '2026')}</span></div>
        </div>
      </Card>
      <Card title={ro ? 'Pengaturan kop (hanya admin yang dapat mengubah)' : 'Ubah kop & format penomoran'}>
        <form action={simpanKop} className="space-y-2"><fieldset disabled={ro} className="space-y-2">
          {[1, 2, 3, 4].map(i => <Field key={i} label={`Baris kop ${i}`}><input name={`kop_baris${i}`} defaultValue={st[`kop_baris${i}`]} className="input" /></Field>)}
          <Field label="Alamat sekretariat"><input name="kop_alamat" defaultValue={st.kop_alamat} className="input" /></Field>
          <div className="grid grid-cols-2 gap-2"><Field label="Kota penandatanganan"><input name="kota_ttd" defaultValue={st.kota_ttd} className="input" /></Field>
          <Field label="Format nomor surat"><input name="format_nomor_surat" defaultValue={st.format_nomor_surat} className="input font-mono text-xs" /></Field>
          <Field label="Format kuitansi iuran"><input name="format_kuitansi_iuran" defaultValue={st.format_kuitansi_iuran} className="input font-mono text-xs" /></Field>
          <Field label="Format kuitansi takziah"><input name="format_kuitansi_takziah" defaultValue={st.format_kuitansi_takziah} className="input font-mono text-xs" /></Field></div>
          <label className="text-sm flex gap-2 items-center"><input type="checkbox" name="tampilkan_kode_verifikasi" value="1" defaultChecked={st.tampilkan_kode_verifikasi === '1'} /> Tampilkan kode verifikasi di surat</label>
          <p className="text-xs text-slate-500">Placeholder: {'{no} {kode} {rt} {bulan} {tahun}'}</p>
          {!ro && <button className="btn btn-primary">Simpan pengaturan</button>}</fieldset></form>
      </Card>
      <Card title="Unggah tanda tangan (PNG, maks. 512 KB, latar transparan)">
        <form action={unggahTtd} className="space-y-2">
          {admin ? <Field label="Pejabat"><select name="user_id" required className="input">{pejabat.map(p => <option key={p.id} value={p.id}>{p.nama} — {p.jabatan}</option>)}</select></Field> : <p className="text-sm">Untuk akun Anda: <b>{u.nama}</b> ({u.jabatan})</p>}
          <div className="grid grid-cols-2 gap-2"><Field label="Nama tercetak (opsional)"><input name="nama_pejabat" className="input" placeholder="default: nama akun" /></Field><Field label="Jabatan tercetak (opsional)"><input name="jabatan" className="input" placeholder="default: jabatan akun" /></Field></div>
          <input type="file" name="file" accept=".png,image/png" required className="text-sm" />
          <p className="text-xs text-slate-500">Mengunggah versi baru otomatis menonaktifkan versi sebelumnya. Riwayat versi tetap tersimpan; surat yang sudah terbit tidak berubah.</p>
          <button className="btn btn-primary">Unggah & aktifkan</button></form>
      </Card>
      <Card title="Daftar tanda tangan & versi">
        <div className="space-y-2">{sigs.length ? sigs.map(s => <div key={s.id} className={`flex items-center gap-3 border rounded-lg p-2 ${s.is_active ? 'border-brand-300 bg-brand-50' : ''}`}>
          <img src={`/api/ttd/${s.id}`} alt="TTD" className="w-28 h-14 object-contain bg-white border rounded" />
          <div className="flex-1 text-sm"><div className="font-medium">{s.nama_pejabat} <span className="text-xs text-slate-500">v{s.versi}</span></div><div className="text-xs text-slate-500">{s.jabatan} • diunggah {s.pengunggah} {tglJam(s.uploaded_at)}{s.deactivated_at ? ` • nonaktif ${tglJam(s.deactivated_at)}` : ''}</div></div>
          <Badge color={s.is_active ? 'green' : 'slate'}>{s.is_active ? 'Aktif' : 'Nonaktif'}</Badge>
          <form action={aturTtd}><input type="hidden" name="id" value={s.id} /><ConfirmButton className="btn btn-sm" msg={s.is_active ? 'Nonaktifkan TTD ini?' : 'Aktifkan versi ini (versi aktif lain akan dinonaktifkan)?'}>{s.is_active ? 'Nonaktifkan' : 'Aktifkan'}</ConfirmButton></form>
          {can.deleteAny(u.role) && <form action={hapusTtd}><input type="hidden" name="id" value={s.id} /><ConfirmButton className="btn btn-sm btn-danger" msg={`Hapus permanen TTD ${s.nama_pejabat} v${s.versi}?\n\nDitolak bila versi ini sudah dipakai surat terbit.`}>🗑 Hapus</ConfirmButton></form>}
        </div>) : <p className="text-sm text-slate-500">Belum ada TTD.</p>}</div>
      </Card>
    </div>
  </div>);
}
