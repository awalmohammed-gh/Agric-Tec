import type { Metadata, Viewport } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import { AppProviders } from '@/components/providers/app-providers';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

const playfair = Playfair_Display({
  variable: '--font-playfair',
  subsets: ['latin'],
  weight: ['600', '700', '900'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'AgriCtec — Digital Financial Identity for Farmers',
    template: '%s | AgriCtec',
  },
  description:
    'AgriCtec turns farm records into a trusted digital financial identity, helping farmers track income, build credit readiness and access finance.',
};

export const viewport: Viewport = {
  themeColor: '#0a0e1a',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${playfair.variable}`}>
      {/* Browser extensions (e.g. Grammarly) add attributes to <body> before React hydrates. */}
      <body suppressHydrationWarning>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
