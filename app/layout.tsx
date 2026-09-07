import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'BELAY — rope test', description: 'Two players, one rope. A restricted flat-ground prototype.', robots: { index: false, follow: false } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
