import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { PATHS } from './db';

const MIME: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.pdf': 'application/pdf' };
export const mimeOf = (f: string) => MIME[path.extname(f).toLowerCase()] || 'application/octet-stream';

/** Simpan file upload ke folder privat. Return nama file, null bila kosong, atau melempar Error berisi pesan validasi. */
export async function saveUpload(file: any, prefix: string, opts: { exts?: string[]; max?: number; dir?: string } = {}): Promise<string | null> {
  if (!file || typeof file === 'string' || !file.size) return null;
  const exts = opts.exts || ['.png', '.jpg', '.jpeg', '.pdf'];
  const max = opts.max || 2 * 1024 * 1024;
  const ext = path.extname(file.name || '').toLowerCase();
  if (!exts.includes(ext)) throw new Error(`Format file tidak diizinkan (${exts.join(', ')}).`);
  if (file.size > max) throw new Error(`Ukuran file maksimal ${Math.round(max / 1024)} KB.`);
  const buf = Buffer.from(await file.arrayBuffer());
  // validasi magic number
  const isPng = buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isJpg = buf[0] === 0xff && buf[1] === 0xd8;
  const isPdf = buf.slice(0, 4).toString() === '%PDF';
  if ((ext === '.png' && !isPng) || (['.jpg', '.jpeg'].includes(ext) && !isJpg) || (ext === '.pdf' && !isPdf)) throw new Error('Isi file tidak sesuai dengan ekstensinya.');
  const name = `${prefix}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}${ext}`;
  const dir = opts.dir || PATHS.uploads;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), buf);
  return name;
}
