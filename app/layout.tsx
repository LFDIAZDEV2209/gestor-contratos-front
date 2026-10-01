import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';

const ibmSans = localFont({
  src: './fonts/plex-sans-latin-variable.woff2',
  weight: '400 700',
  variable: '--font-sans',
  display: 'swap',
});

const ibmMono = localFont({
  src: [
    { path: './fonts/plex-mono-latin-400.woff2', weight: '400' },
    { path: './fonts/plex-mono-latin-500.woff2', weight: '500' },
    { path: './fonts/plex-mono-latin-600.woff2', weight: '600' },
    { path: './fonts/plex-mono-latin-700.woff2', weight: '700' },
  ],
  variable: '--font-plex-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Gestor Integral de Contratos · Nexo',
  description: 'Plataforma de gestión, seguimiento, control, alertas y auditoría contractual de FYA TECH SAS.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // suppressHydrationWarning: las extensiones de navegador (p. ej. Bitdefender)
    // inyectan atributos (bis_skin_checked, bis_register) antes de que React
    // hidrate y generan falsos mismatches de hidratación.
    <html lang="es" className={`${ibmSans.variable} ${ibmMono.variable} ${ibmSans.className}`} suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
