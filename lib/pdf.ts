import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import { settings } from './db';
import { tgl, tglJam } from './util';
import { nowStr } from './db';

export const LOGO = path.join(process.cwd(), 'public', 'logo-kota-bekasi.png');
export type Doc = PDFKit.PDFDocument;
export const M = 50; // margin
export const PW = 595.28; // A4 width
export const CW = PW - M * 2;

export function createDoc(title: string): Doc {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 40, bottom: 60, left: M, right: M }, bufferPages: true, info: { Title: title, Author: 'Sistem Administrasi RT RW01 Jakamulya' } });
  doc.font('Helvetica');
  return doc;
}

export function kop(doc: Doc, opts: { rtKode?: string | null } = {}) {
  const s = settings();
  const top = 36;
  if (fs.existsSync(LOGO)) doc.image(LOGO, M, top, { width: 58 });
  const x = M + 70, w = CW - 140;
  doc.fillColor('#000');
  doc.font('Helvetica-Bold').fontSize(11).text(s.kop_baris1 || 'PEMERINTAH KOTA BEKASI', x, top, { width: w, align: 'center' });
  doc.fontSize(11).text(s.kop_baris2 || 'KECAMATAN BEKASI SELATAN', x, doc.y, { width: w, align: 'center' });
  doc.fontSize(12).text(s.kop_baris3 || 'KELURAHAN JAKAMULYA', x, doc.y, { width: w, align: 'center' });
  const l4 = opts.rtKode ? `RUKUN TETANGGA ${opts.rtKode} / ${s.kop_baris4 || 'RUKUN WARGA 01'}` : (s.kop_baris4 || 'RUKUN WARGA 01');
  doc.fontSize(13).text(l4, x, doc.y, { width: w, align: 'center' });
  doc.font('Helvetica').fontSize(8).text(s.kop_alamat || '', x, doc.y + 1, { width: w, align: 'center' });
  const y = Math.max(doc.y + 6, top + 74);
  doc.moveTo(M, y).lineTo(PW - M, y).lineWidth(2.2).stroke();
  doc.moveTo(M, y + 3).lineTo(PW - M, y + 3).lineWidth(0.7).stroke();
  doc.lineWidth(1);
  doc.x = M; doc.y = y + 14;
}

export function heading(doc: Doc, text: string, sub?: string) {
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#000').text(text, M, doc.y, { width: CW, align: 'center', underline: !sub ? false : false });
  if (sub) doc.font('Helvetica').fontSize(10).text(sub, M, doc.y + 1, { width: CW, align: 'center' });
  doc.moveDown(0.8); doc.x = M;
}

export function kv(doc: Doc, rows: [string, string][], labelW = 150, x = M + 20) {
  doc.fontSize(10).font('Helvetica');
  for (const [k, v] of rows) {
    const y = doc.y;
    doc.text(k, x, y, { width: labelW });
    doc.text(':', x + labelW, y);
    doc.text(v || '-', x + labelW + 10, y, { width: CW - labelW - 30 - (x - M) });
    doc.y = Math.max(doc.y, y + 14) + 1;
  }
  doc.x = M;
}

export type Col = { h: string; w: number; align?: 'left' | 'right' | 'center' };
export function table(doc: Doc, cols: Col[], rows: string[][], opts: { total?: string[]; fontSize?: number } = {}) {
  const fs_ = opts.fontSize || 8.5;
  const totalW = cols.reduce((a, c) => a + c.w, 0);
  const scale = CW / totalW;
  const ws = cols.map(c => c.w * scale);
  const drawRow = (cells: string[], bold: boolean, fill?: string) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fs_);
    const h = Math.max(16, ...cells.map((c, i) => doc.heightOfString(c ?? '', { width: ws[i] - 8 }) + 7));
    if (doc.y + h > doc.page.height - 70) { doc.addPage(); doc.y = 50; if (!bold || fill !== '#e6f4ef') drawRow(cols.map(c => c.h), true, '#e6f4ef'); doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fs_); }
    const y = doc.y; let x = M;
    if (fill) doc.rect(M, y, CW, h).fill(fill).fillColor('#000');
    cells.forEach((c, i) => {
      doc.rect(x, y, ws[i], h).lineWidth(0.5).strokeColor('#555').stroke();
      doc.fillColor('#000').text(c ?? '', x + 4, y + 4, { width: ws[i] - 8, align: cols[i].align || 'left' });
      x += ws[i];
    });
    doc.y = y + h; doc.x = M;
  };
  drawRow(cols.map(c => c.h), true, '#e6f4ef');
  rows.forEach(r => drawRow(r, false));
  if (opts.total) drawRow(opts.total, true, '#f3f3f3');
  if (!rows.length) { doc.font('Helvetica-Oblique').fontSize(9).text('Tidak ada data.', M, doc.y + 4); }
  doc.moveDown(0.6); doc.strokeColor('#000');
}

export type SignBlock = { label?: string; title: string; name: string; img?: string | null };
export function signatures(doc: Doc, blocks: SignBlock[], opts: { place?: string } = {}) {
  if (doc.y > doc.page.height - 200) doc.addPage();
  const w = CW / blocks.length; const y0 = doc.y + 10;
  blocks.forEach((b, i) => {
    const x = M + i * w;
    doc.font('Helvetica').fontSize(10).fillColor('#000');
    doc.text(b.label || ' ', x, y0, { width: w, align: 'center' });
    doc.text(b.title, x, doc.y, { width: w, align: 'center' });
    const imgY = doc.y + 4;
    if (b.img && fs.existsSync(b.img)) { try { doc.image(b.img, x + w / 2 - 55, imgY, { fit: [110, 50], align: 'center' }); } catch {} }
    doc.font('Helvetica-Bold').text(b.name || '(.................................)', x, imgY + 56, { width: w, align: 'center', underline: true });
  });
  doc.font('Helvetica'); doc.x = M; doc.y = y0 + 110;
}

export function note(doc: Doc, text: string) {
  doc.font('Helvetica-Oblique').fontSize(8).fillColor('#444').text(text, M, doc.y, { width: CW }); doc.fillColor('#000').font('Helvetica'); doc.moveDown(0.5);
}

export function finalize(doc: Doc, info: { by: string; code?: string; docNo?: string }): Promise<Buffer> {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const y = doc.page.height - 45;
    doc.moveTo(M, y - 4).lineTo(PW - M, y - 4).lineWidth(0.4).strokeColor('#999').stroke();
    doc.font('Helvetica').fontSize(7).fillColor('#555');
    const left = `Dicetak: ${tglJam(nowStr())} WIB oleh ${info.by}${info.docNo ? ' • No. Dok: ' + info.docNo : ''}${info.code ? ' • Kode verifikasi: ' + info.code : ''}`;
    doc.text(left, M, y, { width: CW - 80, lineBreak: false });
    doc.text(`Hal. ${i + 1}/${range.count}`, PW - M - 80, y, { width: 80, align: 'right', lineBreak: false });
    doc.text('Sistem Administrasi RT RW01 • Kelurahan Jakamulya • Bekasi Selatan', M, y + 10, { width: CW, lineBreak: false });
  }
  doc.fillColor('#000');
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.end();
  });
}

export function placeDate(dateStr?: string) { const s = settings(); return `${s.kota_ttd || 'Bekasi'}, ${tgl(dateStr || nowStr())}`; }
export function pdfResponse(buf: Buffer, filename: string, download = false) {
  return new Response(new Uint8Array(buf), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${filename}"`, 'Cache-Control': 'no-store' } });
}
