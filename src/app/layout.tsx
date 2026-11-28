import type { Metadata, Viewport } from 'next';
import { Anton, Inter, JetBrains_Mono, Newsreader, Permanent_Marker, Playfair_Display, VT323 } from 'next/font/google';
import './globals.css';

const anton = Anton({ weight: '400', subsets: ['latin', 'latin-ext'], display: 'swap', variable: '--font-anton' });
const playfair = Playfair_Display({
  weight: ['400', '500'],
  style: ['italic'],
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  variable: '--font-playfair',
});
const newsreader = Newsreader({
  subsets: ['latin', 'latin-ext'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-newsreader',
});
const mono = JetBrains_Mono({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  variable: '--font-jetbrains',
});

// Modern look: SF Pro on Apple devices, Inter everywhere else.
const inter = Inter({ subsets: ['latin', 'latin-ext'], display: 'swap', variable: '--font-inter' });
// Retro look: VHS on-screen display and a marker for tape labels.
const vt323 = VT323({ weight: '400', subsets: ['latin', 'latin-ext'], display: 'swap', variable: '--font-vt323' });
const marker = Permanent_Marker({ weight: '400', subsets: ['latin'], display: 'swap', variable: '--font-marker' });

// Link previews need absolute URLs: an explicit site URL, else Vercel's production domain.
const SITE =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000');

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: 'STAMP — Media passport',
    template: '%s · STAMP',
  },
  description:
    'STAMP is a diary shaped like a passport, for films and everything else you love: series, books, manga, games and albums. Rate it, note how it felt, and press it into your pages.',
  applicationName: 'STAMP',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { url: '/icons/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
  appleWebApp: {
    capable: true,
    title: 'STAMP',
    statusBarStyle: 'default',
  },
  other: {
    'apple-mobile-web-app-capable': 'yes',
  },
  openGraph: {
    title: 'STAMP — Media passport',
    description: 'Every film you watch gets a stamp.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#F5F1E8',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="day"
      suppressHydrationWarning
      className={`${anton.variable} ${playfair.variable} ${newsreader.variable} ${mono.variable} ${inter.variable} ${vt323.variable} ${marker.variable}`}
    >
      <body>
        {children}
        <div className="grain" aria-hidden="true" />
      </body>
    </html>
  );
}
