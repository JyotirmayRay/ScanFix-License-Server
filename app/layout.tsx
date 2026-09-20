import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ScanFix License Authority & Control Plane',
  description: 'Cryptographic license generator, domain lock manager, and reseller control center for ScanFix SaaS.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#09090b] text-zinc-100 antialiased selection:bg-emerald-500/20 selection:text-emerald-300">
        {children}
      </body>
    </html>
  );
}
