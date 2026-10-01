import type { Metadata } from 'next';
import { Source_Sans_3, Geist } from 'next/font/google';
import localFont from 'next/font/local';
import './globals.css';

// Fuente principal del producto: Source Sans 3 (variable, 300–900)
const sourceSans = Source_Sans_3({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

// Fuente para cifras de las stats cards: Geist (estética Vercel/Linear, dígitos tabulares)
const geist = Geist({
  subsets: ['latin'],
  variable: '--font-fig',
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
  title: 'Seven Save · Gestión Integral de Contratos',
  description: 'Seven Save — plataforma de gestión, seguimiento, control, alertas y auditoría contractual de FYA TECH SAS.',
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
    <html lang="es" className={`${sourceSans.variable} ${geist.variable} ${ibmMono.variable} ${sourceSans.className}`} suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
