'use server';
import fs from 'fs'; import path from 'path';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUser, audit } from '@/lib/auth';
import { db, PATHS } from '@/lib/db';
const go = (msg: string, ok = true): never => { revalidatePath('/audit'); redirect('/audit?tab=backup&' + (ok ? 'ok=' : 'err=') + encodeURIComponent(msg)); };

export async function buatBackup() {
  const u = requireUser('audit'); if (u.role !== 'admin') go('Khusus admin.', false);
  fs.mkdirSync(PATHS.backups, { recursive: true });
  const ts = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 19).replace(/[-:T]/g, '').replace(/^(\d{8})/, '$1_');
  const name = `backup_rw01_${ts}.db`;
  await db().backup(path.join(PATHS.backups, name));
  audit(u, 'BACKUP_DB', 'backup', name, `${Math.round(fs.statSync(path.join(PATHS.backups, name)).size / 1024)} KB`);
  go(`Backup ${name} berhasil dibuat.`);
}

export async function hapusBackup(fd: FormData) {
  const u = requireUser('audit'); if (u.role !== 'admin') go('Khusus admin.', false);
  const f = path.basename(String(fd.get('f') || ''));
  const fp = path.join(PATHS.backups, f);
  if (!f.endsWith('.db') || !fs.existsSync(fp)) go('File tidak ditemukan.', false);
  const n = fs.readdirSync(PATHS.backups).filter(x => x.endsWith('.db')).length;
  if (n <= 1) go('Minimal satu file backup harus disimpan.', false);
  fs.unlinkSync(fp);
  audit(u, 'HAPUS_BACKUP', 'backup', f);
  go(`Backup ${f} dihapus.`);
}
