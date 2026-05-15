import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  weight: ['400', '500'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'subly. — subscriptions on solana',
  description:
    'The commerce layer for Solana. Recurring payments, merchant dashboards, and developer SDKs — all on-chain. Audited by Cantina.',
  metadataBase: new URL('https://www.subly.fi'),
  openGraph: {
    title: 'subly. — subscriptions on solana',
    description:
      'The commerce layer for Solana. Recurring payments, merchant dashboards, and developer SDKs.',
    url: 'https://www.subly.fi',
    siteName: 'subly.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@SublyFi',
    creator: '@SublyFi',
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jakarta.variable} ${jetbrains.variable}`}>
      <body className="bg-black text-white antialiased font-sans selection:bg-white selection:text-black">
        {children}
      </body>
    </html>
  );
}
