import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser, scopeRt } from '@/lib/auth';
import { all, one } from '@/lib/db';
import { STATUS_SURAT, tglJam, maskNik, tgl } from '@/lib/util';
import { can } from '@/lib/rbac';
import { PageHeader, Flash, Card, Badge, Field } from '@/components/ui';
import { prosesSurat, perbaikiSurat } from '../actions';
import { needsMe } from '@/lib/surat';
import { HapusSurat } from '@/components/HapusSurat';

export default function SuratDetail({ params, searchParams }: any) {
  const u = requireUser('surat');
  const id = Number(params.id);
  const s = one(`SELECT lr.*, lt.nama jn, lt.butuh_kelurahan, r.nama pemohon, r.nik, h.no_kk, h.alamat, h.kepala_nama, rt.kode rt_kode, i.nomor, i.verif_code, i.tanggal tgl_terbit, i.file_path, pu.nama pengaju
    FROM letter_requests lr JOIN letter_types lt ON lt.kode=lr.jenis JOIN residents r ON r.id=lr.resident_id JOIN households h ON h.id=lr.household_id JOIN rt ON rt.id=lr.rt_id LEFT JOIN issued_letters i ON i.request_id=lr.id LEFT JOIN users pu ON pu.id=lr.user_id WHERE lr.id=?`, id);
  if (!s) redirect('/surat?err=' + encodeURIComponent('Permohonan tidak ditemukan.'));
  const rt = scopeRt(u);
  if ((u.role === 'warga' && s.household_id !== u.household_id) || (rt && s.rt_id !== rt)) redirect('/surat?err=' + encodeURIComponent('Anda tidak berhak melihat permohonan ini.'));
  const logs = all('SELECT l.*, u.nama, u.jabatan FROM letter_logs l LEFT JOIN users u ON u.id=l.user_id WHERE request_id=? ORDER BY l.at, l.id', id);
  const act = needsMe(u, s);
  const stageLabel = s.status === 'diajukan' ? 'Verifikasi Ketua RT' : s.status === 'diverifikasi_rt' ? 'Verifikasi Pengurus RW' : s.butuh_kelurahan ? 'Persetujuan Petugas Kelurahan & terbitkan' : 'Persetujuan Ketua RW & terbitkan';
  const nik = can.seeFullNik(u.role) || u.role === 'warga' ? s.nik : maskNik(s.nik);
  const steps = [['diajukan', 'Diajukan'], ['diverifikasi_rt', 'Verifikasi RT'], ['diverifikasi_rw', 'Verifikasi RW'], ['terbit', 'Disetujui & Terbit']];
  const idx = steps.findIndex(x => x[0] === s.status);
  return (<div>
    <PageHeader title={`${s.jn}`} desc={`No. registrasi ${s.no_reg} • diajukan ${tglJam(s.created_at)} oleh ${s.pengaju || '-'}`}>
      <Link href="/surat" className="btn">← Daftar</Link>
      {s.nomor && <a href={`/api/pdf/surat/${id}`} target="_blank" className="btn btn-primary">Lihat PDF Final</a>}
      {s.nomor && <a href={`/api/pdf/surat/${id}?dl=1`} className="btn">Unduh</a>}
      {!s.nomor && u.role !== 'warga' && <a href={`/api/pdf/surat/${id}`} target="_blank" className="btn">Pratinjau draf</a>}
      {can.deleteAny(u.role) && <HapusSurat id={id} label={s.nomor || s.no_reg} final={!!s.nomor} back="/surat" big />}
    </PageHeader>
    <Flash sp={searchParams} />
    <div className="flex items-center gap-1 mb-5 overflow-x-auto">
      {steps.map((st, i) => <div key={st[0]} className={`flex-1 min-w-[120px] text-center text-xs rounded-lg py-2 px-2 font-semibold ${s.status === 'ditolak' || s.status === 'dikembalikan' ? 'bg-slate-100 text-slate-500' : i <= idx ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{i + 1}. {st[1]}</div>)}
    </div>
    <div className="grid lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 space-y-5">
        <Card title="Data Permohonan" actions={<Badge color={STATUS_SURAT[s.status]?.color}>{STATUS_SURAT[s.status]?.label}</Badge>}>
          <dl className="grid md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {[['Pemohon', s.pemohon], ['NIK', nik], ['Kepala Keluarga', s.kepala_nama], ['Alamat', `${s.alamat}, RT ${s.rt_kode}/RW 01`], ['Jenis Surat', s.jn + (s.butuh_kelurahan ? ' (persetujuan Kelurahan)' : '')], ['Keperluan', s.keperluan], ['Keterangan', s.keterangan || '-'], ['Nomor Surat', s.nomor || '(belum terbit)'], ['Tanggal Terbit', s.tgl_terbit ? tgl(s.tgl_terbit) : '-'], ['Kode Verifikasi', s.verif_code || '-']].map(([k, v]) => <div key={k}><dt className="text-xs text-slate-500">{k}</dt><dd className="font-medium">{v}</dd></div>)}
          </dl>
          {s.lampiran && <a href={`/api/file/surat/${id}`} target="_blank" className="btn btn-sm mt-4">📎 Lihat lampiran</a>}
          {s.catatan && <div className="mt-4 rounded-lg bg-orange-50 border border-orange-200 p-3 text-sm text-orange-800"><b>Catatan petugas:</b> {s.catatan}</div>}
          {s.verif_code && <div className="mt-4 text-xs text-slate-500">Verifikasi publik: <Link className="text-brand-700 underline" href={`/verifikasi?kode=${s.verif_code}`}>/verifikasi?kode={s.verif_code}</Link></div>}
        </Card>
        {act && <Card title={`Tindakan: ${stageLabel}`}>
          <form action={prosesSurat} className="space-y-3">
            <input type="hidden" name="id" value={id} />
            <Field label="Catatan (wajib bila mengembalikan / menolak)"><textarea name="catatan" rows={2} className="input" placeholder="mis. Data domisili sesuai / Mohon lengkapi surat kontrak" /></Field>
            {s.status === 'diverifikasi_rw' && <div className="text-xs text-slate-600 bg-brand-50 rounded p-2">Saat disetujui, sistem membuat nomor surat otomatis (format <span className="font-mono">no/{s.jenis}/RT-{s.rt_kode}/RW-01/bulan/tahun</span>), menempelkan tanda tangan aktif Ketua RT & Ketua RW, dan menyimpan PDF final ke arsip.</div>}
            <div className="flex flex-wrap gap-2">
              <button name="aksi" value="setuju" className="btn btn-primary">{s.status === 'diverifikasi_rw' ? '✓ Setujui & Terbitkan' : '✓ Verifikasi & Teruskan'}</button>
              <button name="aksi" value="kembalikan" className="btn btn-warn">↺ Kembalikan untuk perbaikan</button>
              <button name="aksi" value="tolak" className="btn btn-danger">✕ Tolak</button>
            </div>
          </form>
        </Card>}
        {s.status === 'dikembalikan' && (s.user_id === u.id || (u.role === 'ketua_rt' && u.rt_id === s.rt_id)) && <Card title="Perbaiki & Ajukan Ulang">
          <form action={perbaikiSurat} className="grid gap-3">
            <input type="hidden" name="id" value={id} />
            <Field label="Keperluan"><input name="keperluan" defaultValue={s.keperluan} className="input" /></Field>
            <Field label="Keterangan perbaikan"><textarea name="keterangan" rows={2} className="input" placeholder="mis. Surat kontrak sudah dilampirkan" /></Field>
            <Field label="Lampiran baru (PDF/JPG/PNG maks 2 MB)"><input type="file" name="lampiran" accept=".pdf,.jpg,.jpeg,.png" className="input" /></Field>
            <div><button className="btn btn-primary">Ajukan Ulang</button></div>
          </form></Card>}
      </div>
      <Card title="Riwayat / Timeline">
        <ol className="relative border-l-2 border-brand-200 ml-2 space-y-4">
          {logs.map(l => <li key={l.id} className="ml-4"><div className="absolute -left-[7px] w-3 h-3 rounded-full bg-brand-500 mt-1.5" />
            <div className="text-xs text-slate-500">{tglJam(l.at)}</div><div className="font-semibold text-sm">{l.aksi}</div><div className="text-xs text-slate-600">{l.nama} {l.jabatan ? `— ${l.jabatan}` : ''}</div>{l.catatan && <div className="text-xs mt-1 bg-slate-50 rounded px-2 py-1">{l.catatan}</div>}</li>)}
        </ol>
      </Card>
    </div>
  </div>);
}
