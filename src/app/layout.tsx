import './globals.css';
import type { Metadata } from 'next';
import Providers from './providers';


export const metadata: Metadata = {
  title: 'Music Library Viewer',
  description: 'A modern interface to browse your MusicBrainz collection',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
