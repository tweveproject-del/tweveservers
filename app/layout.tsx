import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Tweve Tunnel • VPN Server Fleet Control Center',
  description: 'Independent live server pushing, protocol orchestration, client anti-tamper locking, and real-time fleet analytics for Tweve Tunnel VPN.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-neutral-950 text-neutral-100 antialiased selection:bg-emerald-500 selection:text-neutral-950">
        {children}
      </body>
    </html>
  );
}

