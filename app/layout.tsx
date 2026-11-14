import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const sansFont = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
  display: 'swap',
});

const monoFont = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-mono',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#020617',
  colorScheme: 'dark',
};

export const metadata: Metadata = {
  title: 'Access Portal',
  description: 'Restricted interface.',
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${sansFont.variable} ${monoFont.variable}`}>
      <head>
        <meta name="text-scale" content="scale" />
      </head>
      <body className="bg-neutral-950 text-neutral-100 antialiased selection:bg-emerald-500 selection:text-neutral-950">
        {children}
      </body>
    </html>
  );
}

