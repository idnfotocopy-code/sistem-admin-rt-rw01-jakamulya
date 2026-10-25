'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUser, audit, scopeRt } from '@/lib/auth';
import { run, insert, one, all, db } from '@/lib/db';
import { rmUpload } from '@/lib/hapus';
import { can } from '@/lib/rbac';
const f = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const go = (url: string, msg: string, ok = true) => { revalidatePath('/warga'); redirect(url + (url.includes('?') ? '&' : '?') + (ok ? 'ok=' : 'err=') + encodeURIComponent(msg)); };

function guard(u: any, rt_id: number) {
  if (!can.editWarga(u.role)) return 'Anda tidak berwenang mengubah data warga.';
  const s = scopeRt(u); if (s && s !== rt_id) return 'Data di luar RT Anda.';
  return null;
}
export async function saveHousehold(fd: FormData) {
  const u = requireUser('warga');
  const id = Number(fd.get('id') || 0);
  const rt_id = Number(fd.get('rt_id'));
  const no_kk = f(fd, 'no_kk').replace(/\D/g, '');
  const back = id ? `/warga/${id}` : '/warga?tambah=1';
  const g = guard(u, rt_id); if (g) go(back, g, false);
  if (id) { const old = one('SELECT rt_id FROM households WHERE id=?', id); const g2 = guard(u, old?.rt_id); if (g2) go(back, g2, false); }
  if (no_kk.length !== 16) go(back, 'Nomor KK harus 16 digit.', false);
  if (one('SELECT id FROM households WHERE no_kk=? AND id!=?', no_kk, id)) go(back, 'Nomor KK sudah terdaftar (duplikat).', false);
  const data = { no_kk, rt_id, kepala_nama: f(fd, 'kepala_nama'), alamat: f(fd, 'alamat'), status_domisili: f(fd, 'status_domisili') || 'Tetap', telp: f(fd, 'telp') };
  if (!data.kepala_nama) go(back, 'Nama kepala keluarga wajib diisi.', false);
  let hid = id;
  if (id) { run('UPDATE households SET no_kk=@no_kk, rt_id=@rt_id, kepala_nama=@kepala_nama, alamat=@alamat, status_domisili=@status_domisili, telp=@telp WHERE id=' + id, data); audit(u, 'UBAH_KK', 'households', id, data.kepala_nama); }
  else { hid = insert('households', data); audit(u, 'TAMBAH_KK', 'households', hid, data.kepala_nama); }
  go(`/warga/${hid}`, 'Data KK disimpan.');
}
export async function saveResident(fd: FormData) {
  const u = requireUser('warga');
  const id = Number(fd.get('id') || 0);
  const hid = Number(fd.get('household_id'));
  const h = one('SELECT * FROM households WHERE id=?', hid);
  const back = `/warga/${hid}`;
  if (!h) go('/warga', 'KK tidak ditemukan.', false);
  const g = guard(u, h.rt_id); if (g) go(back, g, false);
  let nik = f(fd, 'nik').replace(/\D/g, '');
  if (id && !nik) nik = one('SELECT nik FROM residents WHERE id=?', id)?.nik; // NIK tidak diubah
  if (!nik || nik.length !== 16) go(back, 'NIK harus 16 digit.', false);
  if (one('SELECT id FROM residents WHERE nik=? AND id!=?', nik, id)) go(back, 'NIK sudah terdaftar (duplikat).', false);
  const data = { household_id: hid, nik, nama: f(fd, 'nama'), jk: f(fd, 'jk'), tempat_lahir: f(fd, 'tempat_lahir'), tgl_lahir: f(fd, 'tgl_lahir'), agama: f(fd, 'agama'), pekerjaan: f(fd, 'pekerjaan'), status_kawin: f(fd, 'status_kawin'), hubungan: f(fd, 'hubungan'), status: f(fd, 'status') || 'hidup' };
  if (!data.nama) go(back, 'Nama wajib diisi.', false);
  if (id) { run(`UPDATE residents SET ${Object.keys(data).map(k => `${k}=@${k}`).join(',')} WHERE id=${id}`, data); audit(u, 'UBAH_WARGA', 'residents', id, data.nama + ' status ' + data.status); }
  else { const rid = insert('residents', data); audit(u, 'TAMBAH_WARGA', 'residents', rid, data.nama); }
  go(back, `Data ${data.nama} disimpan.`);
}

const goX = (url: string, msg: string, ok = true): never => { revalidatePath('/warga'); revalidatePath('/iuran'); revalidatePath('/dashboard'); redirect(url + (url.includes('?') ? '&' : '?') + (ok ? 'ok=' : 'err=') + encodeURIComponent(msg)); };

/** Admin: hapus KK beserta seluruh anggota. Ditolak bila masih ada surat / pembayaran sah / kontribusi takziah aktif. */
export async function hapusKK(fd: FormData) {
  const u = requireUser('warga'); const id = Number(fd.get('id')); const b = `/warga/${id}`;
  if (!can.deleteAny(u.role)) goX(b, 'Hanya Admin Sistem yang dapat menghapus data.', false);
  const h = one('SELECT * FROM households WHERE id=?', id); if (!h) goX('/warga', 'KK tidak ditemukan.', false);
  const surat = one('SELECT COUNT(*) n FROM letter_requests WHERE household_id=?', id).n;
  if (surat) goX(b, `KK masih memiliki ${surat} permohonan/arsip surat. Hapus surat tersebut terlebih dahulu (menu Permohonan Surat / Arsip Surat).`, false);
  const sah = one("SELECT COUNT(*) n FROM payments p JOIN dues_invoices i ON i.id=p.invoice_id WHERE i.household_id=? AND p.status='terverifikasi'", id).n;
  if (sah) goX(b, `KK memiliki ${sah} pembayaran iuran sah yang sudah masuk kas. Batalkan kuitansi tersebut terlebih dahulu (jurnal pembalik) agar buku kas tetap seimbang.`, false);
  const tak = one("SELECT COUNT(*) n FROM condolence_contributions WHERE household_id=? AND receipt_no IS NOT NULL", id).n;
  if (tak) goX(b, `KK memiliki ${tak} kontribusi takziah tercatat. Koreksi/batalkan kontribusi tersebut terlebih dahulu.`, false);
  const files = all('SELECT p.bukti_file FROM payments p JOIN dues_invoices i ON i.id=p.invoice_id WHERE i.household_id=?', id).map((x: any) => x.bukti_file);
  let nRes = 0; let nUser = 0;
  db().transaction(() => {
    run('DELETE FROM payments WHERE invoice_id IN (SELECT id FROM dues_invoices WHERE household_id=?)', id);
    run('DELETE FROM dues_invoices WHERE household_id=?', id);
    run('DELETE FROM condolence_contributions WHERE household_id=?', id);
    run('UPDATE condolence_events SET household_id=NULL WHERE household_id=?', id);
    const us = all('SELECT id FROM users WHERE household_id=?', id); nUser = us.length;
    for (const x of us) run('DELETE FROM sessions WHERE user_id=?', x.id);
    run("UPDATE users SET household_id=NULL, resident_id=NULL, status='nonaktif' WHERE household_id=?", id);
    nRes = run('DELETE FROM residents WHERE household_id=?', id).changes;
    run('DELETE FROM households WHERE id=?', id);
  })();
  files.forEach(rmUpload);
  audit(u, 'HAPUS_KK', 'households', id, `KK ${h.no_kk} ${h.kepala_nama}: ${nRes} anggota, ${nUser} akun warga dinonaktifkan`);
  goX('/warga', `KK ${h.kepala_nama} beserta ${nRes} anggota dihapus.${nUser ? ` ${nUser} akun warga terkait dinonaktifkan.` : ''}`);
}

/** Admin: hapus satu anggota keluarga. Ditolak bila tercatat sebagai pemohon surat. */
export async function hapusWarga(fd: FormData) {
  const u = requireUser('warga'); const id = Number(fd.get('id'));
  const r = one('SELECT * FROM residents WHERE id=?', id); if (!r) goX('/warga', 'Data warga tidak ditemukan.', false);
  const b = `/warga/${r.household_id}`;
  if (!can.deleteAny(u.role)) goX(b, 'Hanya Admin Sistem yang dapat menghapus data.', false);
  const surat = one('SELECT COUNT(*) n FROM letter_requests WHERE resident_id=?', id).n;
  if (surat) goX(b, `${r.nama} tercatat pada ${surat} permohonan/arsip surat. Hapus surat tersebut terlebih dahulu atau ubah status menjadi pindah/meninggal.`, false);
  db().transaction(() => {
    run('UPDATE users SET resident_id=NULL WHERE resident_id=?', id);
    run('DELETE FROM residents WHERE id=?', id);
  })();
  audit(u, 'HAPUS_WARGA', 'residents', id, `${r.nama} (${r.hubungan}) dari KK #${r.household_id}`);
  goX(b, `Anggota keluarga ${r.nama} dihapus.`);
}
