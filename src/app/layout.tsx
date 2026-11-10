import './globals.css';
import type { Metadata } from 'next';
import Providers from './providers';


// No title here: every page renders its own PageTitle (a metadata title would replace it after loading)
export const metadata: Metadata = {
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
