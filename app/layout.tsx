import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'BELAY — get everyone home', description: 'One rope. Three crevasses. Get everyone to the hut. A short cooperative crossing playtest.', robots: { index: false, follow: false } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
