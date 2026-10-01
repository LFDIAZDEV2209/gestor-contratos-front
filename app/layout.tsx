import type { Metadata } from 'next';
import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

const ibmSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

const ibmMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
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
