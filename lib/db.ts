import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export const DATA_DIR = path.join(process.cwd(), 'data');
export const PATHS = {
  db: path.join(DATA_DIR, 'app.db'),
  ttd: path.join(DATA_DIR, 'private', 'ttd'),
  uploads: path.join(DATA_DIR, 'private', 'uploads'),
  arsip: path.join(DATA_DIR, 'arsip'),
  backups: path.join(DATA_DIR, 'backups'),
};

const g = globalThis as any;
export function db(): Database.Database {
  if (!g.__rtdb) {
    for (const p of [PATHS.ttd, PATHS.uploads, PATHS.arsip, PATHS.backups]) fs.mkdirSync(p, { recursive: true });
    if (!fs.existsSync(PATHS.db)) throw new Error('Database belum dibuat. Jalankan: npm run seed');
    const d = new Database(PATHS.db);
    d.pragma('journal_mode = WAL');
    // migrasi ringan
    const cols = (d.prepare('PRAGMA table_info(payments)').all() as any[]).map(c => c.name);
    if (!cols.includes('bukti_file')) d.exec('ALTER TABLE payments ADD COLUMN bukti_file TEXT');
    g.__rtdb = d;
  }
  return g.__rtdb;
}

export const all = <T = any>(sql: string, ...p: any[]): T[] => db().prepare(sql).all(...p) as T[];
export const one = <T = any>(sql: string, ...p: any[]): T | undefined => db().prepare(sql).get(...p) as T | undefined;
export const run = (sql: string, ...p: any[]) => db().prepare(sql).run(...p);
export function insert(table: string, obj: Record<string, any>) {
  const k = Object.keys(obj);
  return Number(db().prepare(`INSERT INTO ${table}(${k.join(',')}) VALUES(${k.map(x => '@' + x).join(',')})`).run(obj).lastInsertRowid);
}
export function nextCounter(key: string): number {
  const d = db();
  return d.transaction(() => {
    const r = d.prepare('SELECT value FROM counters WHERE key=?').get(key) as any;
    const v = (r?.value || 0) + 1;
    if (r) d.prepare('UPDATE counters SET value=? WHERE key=?').run(v, key);
    else d.prepare('INSERT INTO counters(key,value) VALUES(?,?)').run(key, v);
    return v;
  })();
}
export function settings(): Record<string, string> {
  const o: Record<string, string> = {};
  for (const r of all('SELECT key,value FROM settings')) o[r.key] = r.value;
  return o;
}
export function nowStr() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
export const today = () => nowStr().slice(0, 10);
