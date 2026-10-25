export const rupiah = (n: number | null | undefined) => 'Rp ' + Math.round(Number(n || 0)).toLocaleString('id-ID');
export const angka = (n: number | null | undefined) => Math.round(Number(n || 0)).toLocaleString('id-ID');
export const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
export const ROMAWI = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
export function tgl(s?: string | null) {
  if (!s) return '-';
  const [y, m, d] = s.slice(0, 10).split('-');
  if (!d) return s;
  return `${parseInt(d)} ${BULAN[parseInt(m) - 1]} ${y}`;
}
export function tglPendek(s?: string | null) {
  if (!s) return '-';
  const [y, m, d] = s.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}
export function tglJam(s?: string | null) { if (!s) return '-'; return `${tglPendek(s)} ${s.slice(11, 16)}`; }
export function periodeLabel(p: string) { const [y, m] = p.split('-'); return `${BULAN[parseInt(m) - 1]} ${y}`; }
export function maskNik(n?: string | null) { if (!n) return '-'; return n.slice(0, 4) + '*'.repeat(Math.max(0, n.length - 8)) + n.slice(-4); }
export function terbilang(n: number): string {
  n = Math.floor(Math.abs(n));
  const s = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
  const f = (x: number): string => {
    if (x < 12) return s[x];
    if (x < 20) return f(x - 10) + ' belas';
    if (x < 100) return f(Math.floor(x / 10)) + ' puluh ' + f(x % 10);
    if (x < 200) return 'seratus ' + f(x - 100);
    if (x < 1000) return f(Math.floor(x / 100)) + ' ratus ' + f(x % 100);
    if (x < 2000) return 'seribu ' + f(x - 1000);
    if (x < 1e6) return f(Math.floor(x / 1000)) + ' ribu ' + f(x % 1000);
    if (x < 1e9) return f(Math.floor(x / 1e6)) + ' juta ' + f(x % 1e6);
    return f(Math.floor(x / 1e9)) + ' miliar ' + f(x % 1e9);
  };
  const r = f(n).replace(/\s+/g, ' ').trim();
  return (r || 'nol') + ' rupiah';
}
export function umur(tglLahir?: string) { if (!tglLahir) return '-'; const b = new Date(tglLahir); const n = new Date(); let a = n.getFullYear() - b.getFullYear(); if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) a--; return a; }
export const STATUS_SURAT: Record<string, { label: string; color: string }> = {
  diajukan: { label: 'Menunggu Verifikasi RT', color: 'amber' },
  diverifikasi_rt: { label: 'Menunggu Verifikasi RW', color: 'sky' },
  diverifikasi_rw: { label: 'Menunggu Persetujuan', color: 'violet' },
  terbit: { label: 'Terbit (PDF)', color: 'green' },
  dikembalikan: { label: 'Dikembalikan', color: 'orange' },
  ditolak: { label: 'Ditolak', color: 'red' },
};
