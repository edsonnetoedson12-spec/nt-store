import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Inter } from 'next/font/google';
import './globals.css';
import { getSettings, SITE_URL } from '@/lib/data';

const serif = Cormorant_Garamond({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-serif', display: 'swap' });
const sans = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: `${s.name} — ${s.tagline}`, template: `%s | ${s.name}` },
    description: s.hero.subtitle || s.tagline,
    openGraph: { type: 'website', locale: 'pt_BR', siteName: s.name, title: `${s.name} — ${s.tagline}`, description: s.hero.subtitle },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#faf8f5' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${serif.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
