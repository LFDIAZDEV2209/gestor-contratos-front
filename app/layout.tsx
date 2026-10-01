import type { Metadata } from 'next';
import { IBM_Plex_Sans } from 'next/font/google';
import './globals.css';

const ibm = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
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
    <html lang="es" className={ibm.className} suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
