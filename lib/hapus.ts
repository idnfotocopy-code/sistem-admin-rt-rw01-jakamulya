import fs from 'fs';
import path from 'path';
import { PATHS } from './db';
/** Hapus file di folder privat (aman: hanya basename, abaikan bila tidak ada). */
export function rmFile(dir: string, name?: string | null) {
  if (!name) return;
  const fp = path.join(dir, path.basename(name));
  try { if (fs.existsSync(fp)) fs.unlinkSync(fp); } catch { /* abaikan */ }
}
export const rmUpload = (name?: string | null) => rmFile(PATHS.uploads, name);
