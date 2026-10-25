export type Role = 'admin' | 'kelurahan' | 'ketua_rw' | 'sekbend_rw' | 'ketua_rt' | 'bendahara_rt' | 'warga';
export const ROLES: { key: Role; label: string; desc: string }[] = [
  { key: 'admin', label: 'Admin Sistem', desc: 'Kelola konfigurasi aplikasi, akun, role, backup, template; tidak otomatis berwenang menyetujui surat wilayah.' },
  { key: 'kelurahan', label: 'Petugas Kelurahan', desc: 'Melihat/mengelola data sesuai kewenangan Kelurahan, memproses layanan yang ditetapkan (mis. SKTM, pengantar nikah), melihat laporan wilayah.' },
  { key: 'ketua_rw', label: 'Ketua RW', desc: 'Verifikasi & persetujuan surat tingkat RW, pengumuman RW, melihat rekap RT di bawah RW, memeriksa laporan & menyetujui kas.' },
  { key: 'sekbend_rw', label: 'Sekretaris/Bendahara RW', desc: 'Verifikasi surat tingkat RW (sekretaris), kelola transaksi & iuran RW, verifikasi pembayaran, laporan dan kuitansi RW.' },
  { key: 'ketua_rt', label: 'Ketua RT', desc: 'Verifikasi domisili/permohonan, kelola data warga RT sendiri, buat pengumuman RT, periksa kas RT & laporan takziah.' },
  { key: 'bendahara_rt', label: 'Bendahara RT', desc: 'Kelola iuran rutin/takziah dan transaksi RT, membuat kuitansi dan laporan.' },
  { key: 'warga', label: 'Warga', desc: 'Lihat data keluarga sendiri, ajukan surat, bayar/konfirmasi tagihan, ajukan pengaduan, baca pengumuman.' },
];
export const roleLabel = (r: string) => ROLES.find(x => x.key === r)?.label || r;

export type MenuKey = 'dashboard' | 'wilayah' | 'warga' | 'surat' | 'arsip' | 'iuran' | 'takziah' | 'takziah-dana' | 'kas' | 'pengaduan' | 'pengumuman' | 'laporan' | 'pengguna' | 'kop-ttd' | 'audit';
const ALL: Role[] = ['admin', 'kelurahan', 'ketua_rw', 'sekbend_rw', 'ketua_rt', 'bendahara_rt', 'warga'];
const PENGURUS: Role[] = ['kelurahan', 'ketua_rw', 'sekbend_rw', 'ketua_rt', 'bendahara_rt'];
export const MENU: { key: MenuKey; label: string; href: string; icon: string; roles: Role[]; group: string }[] = [
  { key: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: '▦', roles: ALL, group: 'Utama' },
  { key: 'wilayah', label: 'Data Wilayah', href: '/wilayah', icon: '⌂', roles: ['admin', ...PENGURUS], group: 'Data' },
  { key: 'warga', label: 'Data Warga/KK', href: '/warga', icon: '☺', roles: ALL, group: 'Data' },
  { key: 'surat', label: 'Permohonan Surat', href: '/surat', icon: '✉', roles: ['kelurahan', 'ketua_rw', 'sekbend_rw', 'ketua_rt', 'warga', 'admin'], group: 'Layanan Surat' },
  { key: 'arsip', label: 'Arsip Surat', href: '/arsip-surat', icon: '🗄', roles: ALL, group: 'Layanan Surat' },
  { key: 'iuran', label: 'Iuran Rutin', href: '/iuran', icon: '💳', roles: ALL, group: 'Keuangan' },
  { key: 'takziah', label: 'Iuran Takziah Kematian', href: '/takziah', icon: '🕊', roles: ALL, group: 'Keuangan' },
  { key: 'takziah-dana', label: 'Penerimaan & Penyaluran Takziah', href: '/takziah-dana', icon: '⇄', roles: ['admin', ...PENGURUS], group: 'Keuangan' },
  { key: 'kas', label: 'Kas & Pengeluaran', href: '/kas', icon: '₨', roles: ['admin', ...PENGURUS], group: 'Keuangan' },
  { key: 'pengaduan', label: 'Pengaduan', href: '/pengaduan', icon: '⚑', roles: ALL, group: 'Layanan Warga' },
  { key: 'pengumuman', label: 'Pengumuman', href: '/pengumuman', icon: '📣', roles: ALL, group: 'Layanan Warga' },
  { key: 'laporan', label: 'Laporan PDF', href: '/laporan', icon: '⎙', roles: ['admin', ...PENGURUS], group: 'Laporan' },
  { key: 'pengguna', label: 'Pengguna & Hak Akses', href: '/pengguna', icon: '⚙', roles: ['admin'], group: 'Pengaturan' },
  { key: 'kop-ttd', label: 'Kop Surat & Tanda Tangan', href: '/kop-ttd', icon: '✍', roles: ['admin', 'kelurahan', 'ketua_rw', 'ketua_rt'], group: 'Pengaturan' },
  { key: 'audit', label: 'Audit & Backup', href: '/audit', icon: '🛡', roles: ['admin'], group: 'Pengaturan' },
];
export const canMenu = (role: string, key: MenuKey) => !!MENU.find(m => m.key === key)?.roles.includes(role as Role);

// granular permissions
export const can = {
  editWilayah: (r: string) => ['admin', 'kelurahan'].includes(r),
  editWarga: (r: string) => ['admin', 'kelurahan', 'ketua_rw', 'ketua_rt'].includes(r),
  seeFullNik: (r: string) => ['admin', 'kelurahan', 'ketua_rw', 'ketua_rt'].includes(r),
  verifRT: (r: string) => r === 'ketua_rt',
  verifRW: (r: string) => ['ketua_rw', 'sekbend_rw'].includes(r),
  approveRW: (r: string) => r === 'ketua_rw',
  approveKel: (r: string) => r === 'kelurahan',
  manageIuran: (r: string) => ['sekbend_rw', 'bendahara_rt'].includes(r),
  manageTakziah: (r: string) => ['ketua_rw', 'sekbend_rw', 'ketua_rt', 'bendahara_rt'].includes(r),
  financeTakziah: (r: string) => ['sekbend_rw', 'bendahara_rt'].includes(r),
  reviewTakziah: (r: string) => ['ketua_rw', 'ketua_rt'].includes(r),
  inputKas: (r: string) => ['sekbend_rw', 'bendahara_rt'].includes(r),
  approveKas: (r: string) => ['ketua_rw', 'ketua_rt'].includes(r),
  handleAduan: (r: string) => ['kelurahan', 'ketua_rw', 'sekbend_rw', 'ketua_rt'].includes(r),
  postPengumuman: (r: string) => ['admin', 'kelurahan', 'ketua_rw', 'sekbend_rw', 'ketua_rt'].includes(r),
  editKop: (r: string) => r === 'admin',
  uploadTtd: (r: string) => ['admin', 'kelurahan', 'ketua_rw', 'ketua_rt'].includes(r),
  /** Hapus permanen data di seluruh modul — khusus Admin Sistem (selalu tercatat di audit log). */
  deleteAny: (r: string) => r === 'admin',
};
