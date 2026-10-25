import { requireUser, scopeRt } from '@/lib/auth';
import { all, one, today } from '@/lib/db';
import { can } from '@/lib/rbac';
import { rupiah, tglPendek, tglJam } from '@/lib/util';
import { PageHeader, Flash, Card, Badge, Empty, Stat, Field } from '@/components/ui';
import { ConfirmButton } from '@/components/Confirm';
import { inputKas, periksaKas, koreksiKas, hapusKas } from './actions';

const KAT = ['Iuran Rutin', 'Takziah', 'Donasi', 'Kegiatan', 'Operasional', 'Keamanan', 'Kebersihan', 'Pemeliharaan', 'Sosial', 'Lainnya'];
export default function Kas({ searchParams: sp }: any) {
  const u = requireUser('kas');
  const rtS = scopeRt(u);
  const rts = all('SELECT * FROM rt ORDER BY kode');
  let buku = rtS ? 'RT' : (sp.buku || (u.role === 'sekbend_rw' || u.role === 'ketua_rw' ? 'RW' : 'RW'));
  const rt_id = buku === 'RT' ? (rtS || Number(sp.rt_id) || rts[0].id) : null;
  const y = today().slice(0, 4);
  const from = sp.from || `${y}-08-01`; const to = sp.to || today();
  const W = `k.buku='${buku}' ${rt_id ? 'AND k.rt_id=' + Number(rt_id) : 'AND k.rt_id IS NULL'}`;
  const saldoAwal = one(`SELECT COALESCE(SUM(CASE WHEN jenis='masuk' THEN amount ELSE -amount END),0) s FROM cash_transactions k WHERE ${W} AND k.status='disetujui' AND k.tanggal<?`, from).s;
  const rows = all(`SELECT k.*, a.nama pembuat, c.nama pemeriksa FROM cash_transactions k LEFT JOIN users a ON a.id=k.created_by LEFT JOIN users c ON c.id=k.checked_by WHERE ${W} AND k.tanggal BETWEEN ? AND ? ORDER BY k.tanggal, k.id`, from, to);
  let bal = saldoAwal; const withBal = rows.map(r => { if (r.status === 'disetujui') bal += r.jenis === 'masuk' ? r.amount : -r.amount; return { ...r, bal }; });
  const masuk = rows.filter(r => r.status === 'disetujui' && r.jenis === 'masuk').reduce((a, r) => a + r.amount, 0);
  const keluar = rows.filter(r => r.status === 'disetujui' && r.jenis === 'keluar').reduce((a, r) => a + r.amount, 0);
  const pending = all(`SELECT k.*, a.nama pembuat, rt.kode rt_kode FROM cash_transactions k LEFT JOIN users a ON a.id=k.created_by LEFT JOIN rt ON rt.id=k.rt_id WHERE k.status='menunggu' ${rtS ? `AND k.buku='RT' AND k.rt_id=${rtS}` : ''} ORDER BY k.tanggal`);
  const canApprove = (k: any) => (k.buku === 'RW' && u.role === 'ketua_rw') || (k.buku === 'RT' && u.role === 'ketua_rt' && u.rt_id === k.rt_id);
  const myBook = can.inputKas(u.role) && ((u.role === 'sekbend_rw' && buku === 'RW') || (u.role === 'bendahara_rt' && buku === 'RT'));
  const back = `/kas?buku=${buku}${rt_id ? '&rt_id=' + rt_id : ''}&from=${from}&to=${to}`;
  const label = buku === 'RW' ? 'Buku Kas RW 01' : `Buku Kas RT ${rts.find(r => r.id === rt_id)?.kode}`;
  return (<div>
    <PageHeader title="Kas & Pengeluaran" desc="Buku kas RW dan RT dengan saldo berjalan. Setiap transaksi manual wajib diperiksa Ketua; iuran & takziah terposting otomatis. Koreksi dilakukan dengan jurnal pembalik (tidak menghapus).">
      <a className="btn btn-primary" target="_blank" href={`/api/pdf/laporan/kas?buku=${buku}${rt_id ? '&rt_id=' + rt_id : ''}&from=${from}&to=${to}`}>⎙ Laporan Kas PDF</a>
    </PageHeader>
    <Flash sp={sp} />
    <form className="flex flex-wrap gap-2 items-end mb-4">
      {!rtS && <Field label="Buku"><select name="buku" defaultValue={buku} className="input"><option value="RW">Kas RW 01</option><option value="RT">Kas RT</option></select></Field>}
      {!rtS && <Field label="RT (untuk buku RT)"><select name="rt_id" defaultValue={rt_id || ''} className="input">{rts.map(r => <option key={r.id} value={r.id}>RT {r.kode}</option>)}</select></Field>}
      <Field label="Dari"><input type="date" name="from" defaultValue={from} className="input" /></Field>
      <Field label="Sampai"><input type="date" name="to" defaultValue={to} className="input" /></Field>
      <button className="btn">Tampilkan</button>
    </form>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5"><Stat label="Saldo awal" value={rupiah(saldoAwal)} sub={tglPendek(from)} /><Stat label="Pemasukan" value={rupiah(masuk)} color="sky" /><Stat label="Pengeluaran" value={rupiah(keluar)} color="red" /><Stat label="Saldo akhir" value={rupiah(bal)} color="gold" sub={tglPendek(to)} /></div>

    {pending.length > 0 && <Card title={`Menunggu pemeriksaan (${pending.length})`} className="mb-4"><div className="space-y-2">{pending.map(k => <div key={k.id} className="rounded-lg border p-3 flex flex-wrap justify-between gap-3">
      <div className="text-sm"><div className="font-semibold">{k.uraian}</div><div className="text-xs text-slate-500">{k.buku === 'RW' ? 'Kas RW' : 'Kas RT ' + k.rt_kode} • {tglPendek(k.tanggal)} • {k.no_bukti} • {k.kategori} • oleh {k.pembuat}</div>
        <div className={k.jenis === 'masuk' ? 'text-emerald-700 font-bold' : 'text-red-700 font-bold'}>{k.jenis === 'masuk' ? '+' : '-'} {rupiah(k.amount)}</div>{k.bukti_file && <a className="text-xs underline text-brand-700" target="_blank" href={`/api/file/kas/${k.id}`}>Lihat nota/bukti</a>}</div>
      {canApprove(k) ? <form action={periksaKas} className="flex flex-col gap-1 min-w-[240px]"><input type="hidden" name="id" value={k.id} /><input type="hidden" name="back" value={back} /><input name="catatan" className="input !py-1 !text-xs" placeholder="Catatan (wajib jika menolak)" />
        <div className="flex gap-1"><button name="aksi" value="setuju" className="btn btn-sm btn-primary flex-1">✓ Setujui</button><button name="aksi" value="tolak" className="btn btn-sm btn-danger flex-1">Tolak</button></div></form> : <Badge color="amber">Menunggu {k.buku === 'RW' ? 'Ketua RW' : 'Ketua RT'}</Badge>}
      {can.deleteAny(u.role) && !k.ref_type && <form action={hapusKas} className="self-start"><input type="hidden" name="id" value={k.id} /><input type="hidden" name="back" value={back} /><ConfirmButton className="btn btn-sm btn-danger" msg={`Hapus transaksi ${k.no_bukti} (${rupiah(k.amount)}) yang belum disetujui?`}>🗑 Hapus</ConfirmButton></form>}
    </div>)}</div></Card>}

    <div className="grid xl:grid-cols-3 gap-4">
      <Card title={`${label} • ${tglPendek(from)} s.d. ${tglPendek(to)}`} className={myBook ? 'xl:col-span-2' : 'xl:col-span-3'}>
        {rows.length ? <div className="overflow-x-auto"><table className="tbl"><thead><tr><th>Tanggal</th><th>No. Bukti</th><th>Uraian</th><th>Kategori</th><th className="text-right">Masuk</th><th className="text-right">Keluar</th><th className="text-right">Saldo</th><th>Status</th></tr></thead><tbody>
          <tr className="bg-slate-50"><td colSpan={6} className="italic text-xs">Saldo awal</td><td className="text-right font-semibold">{rupiah(saldoAwal)}</td><td></td></tr>
          {withBal.map(r => <tr key={r.id} className={r.status !== 'disetujui' ? 'opacity-60' : ''}><td className="text-xs whitespace-nowrap">{tglPendek(r.tanggal)}</td><td className="font-mono text-[11px]">{r.no_bukti}{r.bukti_file && <a className="ml-1 text-brand-700" target="_blank" href={`/api/file/kas/${r.id}`}>📎</a>}</td><td className="text-xs">{r.uraian}<div className="text-[10px] text-slate-400">{r.pembuat}{r.pemeriksa ? ` • diperiksa ${r.pemeriksa}` : ''}</div></td><td className="text-xs">{r.kategori}</td>
            <td className="text-right text-emerald-700">{r.jenis === 'masuk' ? rupiah(r.amount) : ''}</td><td className="text-right text-red-700">{r.jenis === 'keluar' ? rupiah(r.amount) : ''}</td><td className="text-right font-medium">{r.status === 'disetujui' ? rupiah(r.bal) : '-'}</td>
            <td>{r.status === 'disetujui' ? <Badge color="green">Disetujui</Badge> : r.status === 'menunggu' ? <Badge color="amber">Menunggu</Badge> : <Badge color="red">Ditolak</Badge>}
              {myBook && r.status === 'disetujui' && !r.ref_type && <details><summary className="text-[10px] text-red-600 cursor-pointer">koreksi</summary><form action={koreksiKas} className="flex gap-1 mt-1"><input type="hidden" name="id" value={r.id} /><input type="hidden" name="back" value={back} /><input name="alasan" required className="input !py-1 !text-xs w-28" placeholder="Alasan" /><button className="btn btn-sm btn-danger">OK</button></form></details>}
              {can.deleteAny(u.role) && r.status !== 'disetujui' && !r.ref_type && <form action={hapusKas} className="mt-1"><input type="hidden" name="id" value={r.id} /><input type="hidden" name="back" value={back} /><ConfirmButton className="btn btn-sm btn-danger !py-0 !text-[10px]" msg={`Hapus transaksi ${r.no_bukti} (${r.status}) ${rupiah(r.amount)}?`}>🗑 Hapus</ConfirmButton></form>}</td></tr>)}
          <tr className="font-bold"><td colSpan={4}>Jumlah</td><td className="text-right">{rupiah(masuk)}</td><td className="text-right">{rupiah(keluar)}</td><td className="text-right">{rupiah(bal)}</td><td></td></tr>
        </tbody></table></div> : <Empty>Tidak ada transaksi pada rentang ini.</Empty>}
      </Card>
      {myBook && <Card title="+ Input transaksi"><form action={inputKas} className="space-y-2 text-sm"><input type="hidden" name="back" value={back} />
        <Field label="Jenis"><select name="jenis" className="input"><option value="keluar">Pengeluaran</option><option value="masuk">Pemasukan</option></select></Field>
        <Field label="Tanggal"><input type="date" name="tanggal" defaultValue={today()} className="input" /></Field>
        <Field label="Kategori"><select name="kategori" className="input">{KAT.map(k => <option key={k}>{k}</option>)}</select></Field>
        <Field label="Uraian"><input name="uraian" required className="input" placeholder="mis. Beli lampu PJU 2 buah" /></Field>
        <Field label="Nominal (Rp)"><input name="amount" required className="input" inputMode="numeric" /></Field>
        <Field label="No. bukti/nota (opsional, otomatis bila kosong)"><input name="no_bukti" className="input" /></Field>
        <Field label="Lampiran nota (JPG/PNG/PDF ≤2MB)"><input type="file" name="bukti_file" accept=".jpg,.jpeg,.png,.pdf" className="text-xs" /></Field>
        <ConfirmButton className="btn btn-primary w-full" msg="Simpan transaksi? Transaksi akan menunggu persetujuan Ketua.">Simpan & ajukan</ConfirmButton>
        <p className="text-[11px] text-slate-500">Pengeluaran wajib disertai nota/nomor bukti. Saldo baru berubah setelah disetujui.</p></form></Card>}
    </div>
  </div>);
}
