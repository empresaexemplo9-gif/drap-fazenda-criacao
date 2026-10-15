import type { Metadata, Viewport } from 'next';
import { Fraunces, Manrope, Roboto_Mono } from 'next/font/google';
import { AppShell } from '@/components/app-shell';
import './globals.css';

// Mesmas fontes do DRAP Fazenda: Fraunces (títulos), Manrope (texto) e
// Roboto Mono (números, zero sem barra para não confundir com 8).
const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces', weight: ['400', '500', '600', '700'], style: ['normal', 'italic'], display: 'swap' });
const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', weight: ['400', '500', '600', '700'], display: 'swap' });
const robotoMono = Roboto_Mono({ subsets: ['latin'], variable: '--font-mono', weight: ['400', '500'], display: 'swap' });

export const metadata: Metadata = {
  title: 'DRAP Pecuária',
  description: 'Gestão do rebanho offline: rebanho, sanidade, pasto, livro-razão e custo da arroba e do litro.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
  appleWebApp: { capable: true, title: 'DRAP Pecuária', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  themeColor: '#486B3A',
  colorScheme: 'light',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${fraunces.variable} ${manrope.variable} ${robotoMono.variable}`}>
      <body className="min-h-screen">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
