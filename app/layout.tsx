import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'BELAY — rope test', description: 'An invited gray-box test of rope crossings, catches and rescue for two to six climbers.', robots: { index: false, follow: false } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
