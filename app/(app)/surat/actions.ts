'use server';
import crypto from 'crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUser, audit, scopeRt } from '@/lib/auth';
import { run, insert, one, nextCounter, nowStr, today, db, settings } from '@/lib/db';
import { can } from '@/lib/rbac';
import { ROMAWI } from '@/lib/util';
import { saveUpload } from '@/lib/upload';
import { ensureArsip, activeSig } from '@/lib/documents';
import { PATHS } from '@/lib/db';
import { rmFile, rmUpload } from '@/lib/hapus';
const f = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const go = (url: string, msg: string, ok = true): never => { revalidatePath('/surat'); revalidatePath('/arsip-surat'); redirect(url + (url.includes('?') ? '&' : '?') + (ok ? 'ok=' : 'err=') + encodeURIComponent(msg)); };
const log = (rid: number, uid: number, aksi: string, catatan = '') => insert('letter_logs', { request_id: rid, user_id: uid, aksi, catatan, at: nowStr() });

export async function ajukanSurat(fd: FormData) {
  const u = requireUser('surat');
  const resident_id = Number(fd.get('resident_id'));
  const res = one("SELECT r.*, h.rt_id FROM residents r JOIN households h ON h.id=r.household_id WHERE r.id=? AND r.status='hidup'", resident_id);
  if (!res) go('/surat', 'Pemohon tidak valid.', false);
  if (u.role === 'warga' && res.household_id !== u.household_id) go('/surat', 'Pemohon harus anggota keluarga Anda.', false);
  const s = scopeRt(u); if (s && s !== res.rt_id) go('/surat', 'Pemohon di luar RT Anda.', false);
  const jenis = f(fd, 'jenis'); const lt = one('SELECT * FROM letter_types WHERE kode=? AND aktif=1', jenis);
  if (!lt) go('/surat', 'Jenis surat tidak valid.', false);
  const keperluan = f(fd, 'keperluan'); if (keperluan.length < 5) go('/surat', 'Keperluan wajib diisi (min. 5 karakter).', false);
  let lampiran: string | null = null;
  try { lampiran = await saveUpload(fd.get('lampiran'), 'surat'); } catch (e: any) { go('/surat', e.message, false); }
  const no_reg = `REG-${new Date().getFullYear()}-${String(nextCounter('reg-' + new Date().getFullYear())).padStart(4, '0')}`;
  const id = insert('letter_requests', { no_reg, user_id: u.id, resident_id, household_id: res.household_id, rt_id: res.rt_id, jenis, keperluan, keterangan: f(fd, 'keterangan'), lampiran, status: 'diajukan', created_at: nowStr(), updated_at: nowStr() });
  log(id, u.id, 'Diajukan', keperluan + (u.role !== 'warga' ? ` (diinput oleh ${u.nama})` : ''));
  audit(u, 'AJUKAN_SURAT', 'letter_requests', id, `${jenis} ${no_reg}`);
  go(`/surat/${id}`, `Permohonan ${no_reg} berhasil diajukan dan menunggu verifikasi Ketua RT.`);
}

function load(id: number) { return one('SELECT lr.*, lt.butuh_kelurahan, lt.nama jn, rt.kode rt_kode FROM letter_requests lr JOIN letter_types lt ON lt.kode=lr.jenis JOIN rt ON rt.id=lr.rt_id WHERE lr.id=?', id); }

export async function prosesSurat(fd: FormData) {
  const u = requireUser('surat');
  const id = Number(fd.get('id')); const aksi = f(fd, 'aksi'); const catatan = f(fd, 'catatan');
  const r = load(id); const back = `/surat/${id}`;
  if (!r) go('/surat', 'Permohonan tidak ditemukan.', false);
  const stageOk =
    (r.status === 'diajukan' && can.verifRT(u.role) && u.rt_id === r.rt_id) ||
    (r.status === 'diverifikasi_rt' && can.verifRW(u.role)) ||
    (r.status === 'diverifikasi_rw' && (r.butuh_kelurahan ? can.approveKel(u.role) : can.approveRW(u.role)));
  if (!stageOk) go(back, 'Anda tidak berwenang memproses permohonan pada tahap ini.', false);
  if ((aksi === 'kembalikan' || aksi === 'tolak') && catatan.length < 5) go(back, 'Alasan/catatan wajib diisi untuk mengembalikan atau menolak.', false);
  const now = nowStr();
  if (aksi === 'kembalikan') {
    run("UPDATE letter_requests SET status='dikembalikan', catatan=?, updated_at=? WHERE id=?", catatan, now, id);
    log(id, u.id, 'Dikembalikan untuk perbaikan', catatan); audit(u, 'KEMBALIKAN_SURAT', 'letter_requests', id, catatan);
    go(back, 'Permohonan dikembalikan ke pemohon.');
  }
  if (aksi === 'tolak') {
    run("UPDATE letter_requests SET status='ditolak', catatan=?, updated_at=? WHERE id=?", catatan, now, id);
    log(id, u.id, 'Ditolak', catatan); audit(u, 'TOLAK_SURAT', 'letter_requests', id, catatan);
    go(back, 'Permohonan ditolak.');
  }
  if (aksi !== 'setuju') go(back, 'Aksi tidak dikenal.', false);
  if (r.status === 'diajukan') {
    run("UPDATE letter_requests SET status='diverifikasi_rt', rt_verified_by=?, rt_verified_at=?, catatan=NULL, updated_at=? WHERE id=?", u.id, now, now, id);
    log(id, u.id, 'Diverifikasi RT', catatan || 'Data pemohon sesuai'); audit(u, 'VERIF_RT_SURAT', 'letter_requests', id);
    go(back, 'Terverifikasi RT. Diteruskan ke pengurus RW.');
  }
  if (r.status === 'diverifikasi_rt') {
    run("UPDATE letter_requests SET status='diverifikasi_rw', rw_verified_by=?, rw_verified_at=?, updated_at=? WHERE id=?", u.id, now, now, id);
    log(id, u.id, 'Diverifikasi RW', catatan || 'Lengkap'); audit(u, 'VERIF_RW_SURAT', 'letter_requests', id);
    go(back, r.butuh_kelurahan ? 'Terverifikasi RW. Diteruskan ke Petugas Kelurahan untuk persetujuan.' : 'Terverifikasi RW. Menunggu persetujuan Ketua RW.');
  }
  // setujui & terbitkan
  const rtUser = one("SELECT id FROM users WHERE role='ketua_rt' AND rt_id=? AND status='aktif' ORDER BY id LIMIT 1", r.rt_id);
  const rwUser = one("SELECT id, nama, jabatan FROM users WHERE role='ketua_rw' AND status='aktif' ORDER BY id LIMIT 1");
  const sigRt = activeSig(r.rt_verified_by || rtUser?.id) || activeSig(rtUser?.id);
  const sigRw = activeSig(rwUser?.id);
  if (fd.get('tanpa_ttd') !== '1' && (!sigRt || !sigRw)) go(back, 'Tanda tangan aktif Ketua RT/Ketua RW belum tersedia. Unggah di menu Kop Surat & Tanda Tangan.', false);
  const y = new Date().getFullYear(); const m = new Date().getMonth();
  const nomor = db().transaction(() => {
    const no = nextCounter(`surat-${y}`);
    const nomor = (settings().format_nomor_surat || '{no}/{kode}/RT-{rt}/RW-01/{bulan}/{tahun}').replace('{no}', String(no).padStart(3, '0')).replace('{kode}', r.jenis).replace('{rt}', r.rt_kode).replace('{bulan}', ROMAWI[m]).replace('{tahun}', String(y));
    run("UPDATE letter_requests SET status='terbit', approved_by=?, approved_at=?, updated_at=? WHERE id=?", u.id, now, now, id);
    insert('issued_letters', { request_id: id, nomor, tanggal: today(), file_path: null, verif_code: crypto.randomBytes(5).toString('hex').toUpperCase(), sig_rt_id: sigRt?.id || null, sig_rw_id: sigRw?.id || null, signer_name: u.role === 'kelurahan' ? u.nama : rwUser?.nama, signer_jabatan: u.jabatan, status: 'final', created_at: now });
    return nomor;
  })();
  log(id, u.id, u.role === 'kelurahan' ? 'Disetujui Kelurahan & diterbitkan' : 'Disetujui Ketua RW & diterbitkan', nomor);
  audit(u, 'SETUJUI_SURAT', 'letter_requests', id, nomor);
  await ensureArsip(id, u.nama);
  go(back, `Surat diterbitkan dengan nomor ${nomor}. PDF final tersimpan di arsip.`);
}

export async function perbaikiSurat(fd: FormData) {
  const u = requireUser('surat');
  const id = Number(fd.get('id')); const r = load(id); const back = `/surat/${id}`;
  if (!r || r.status !== 'dikembalikan') go(back, 'Permohonan tidak dalam status dikembalikan.', false);
  if (r.user_id !== u.id && !(u.role === 'ketua_rt' && u.rt_id === r.rt_id)) go(back, 'Hanya pemohon yang dapat memperbaiki.', false);
  let lampiran = r.lampiran;
  try { lampiran = (await saveUpload(fd.get('lampiran'), 'surat')) || r.lampiran; } catch (e: any) { go(back, e.message, false); }
  run("UPDATE letter_requests SET status='diajukan', keperluan=?, keterangan=?, lampiran=?, catatan=NULL, updated_at=? WHERE id=?", f(fd, 'keperluan') || r.keperluan, f(fd, 'keterangan'), lampiran, nowStr(), id);
  log(id, u.id, 'Diajukan ulang setelah perbaikan', f(fd, 'keterangan'));
  audit(u, 'PERBAIKI_SURAT', 'letter_requests', id);
  go(back, 'Permohonan diajukan ulang.');
}

/** Admin: hapus permohonan surat. Surat final (sudah terbit) wajib konfirmasi ketik "HAPUS"; arsip PDF ikut dihapus. */
export async function hapusSurat(fd: FormData) {
  const u = requireUser('surat'); const id = Number(fd.get('id'));
  const b0 = f(fd, 'back') || '/surat'; const b = b0.startsWith('/') ? b0 : '/surat';
  if (!can.deleteAny(u.role)) go(b, 'Hanya Admin Sistem yang dapat menghapus surat.', false);
  const r = one('SELECT * FROM letter_requests WHERE id=?', id); if (!r) go(b, 'Permohonan tidak ditemukan.', false);
  const i = one('SELECT * FROM issued_letters WHERE request_id=?', id);
  if (i && f(fd, 'konfirmasi').toUpperCase() !== 'HAPUS') go(b, `Surat ${i.nomor} sudah FINAL/terbit. Ketik HAPUS pada kolom konfirmasi untuk menghapus permanen beserta arsip PDF-nya.`, false);
  db().transaction(() => {
    run('DELETE FROM letter_logs WHERE request_id=?', id);
    run('DELETE FROM issued_letters WHERE request_id=?', id);
    run('DELETE FROM letter_requests WHERE id=?', id);
  })();
  if (i) rmFile(PATHS.arsip, i.file_path || `${String(i.nomor).replace(/[^A-Za-z0-9]+/g, '_')}.pdf`);
  rmUpload(r.lampiran);
  audit(u, i ? 'HAPUS_SURAT_FINAL' : 'HAPUS_SURAT', 'letter_requests', id, `${r.no_reg} ${r.jenis} status=${r.status}${i ? ` nomor=${i.nomor} kode=${i.verif_code}` : ''}`);
  revalidatePath('/dashboard');
  go(b.startsWith('/surat/') ? '/surat' : b, i ? `Surat final ${i.nomor} beserta arsip PDF dihapus permanen (kode verifikasi tidak berlaku lagi).` : `Permohonan ${r.no_reg} dihapus.`);
}
