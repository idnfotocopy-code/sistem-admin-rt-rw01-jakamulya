import './globals.css';
export const metadata = { title: 'Sistem Administrasi RT RW01 · Kelurahan Jakamulya · Bekasi Selatan', icons: { icon: '/logo-kota-bekasi.png' } };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="id"><body>{children}</body></html>);
}
