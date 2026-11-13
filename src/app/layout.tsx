import './globals.css';
import type { Metadata, Viewport } from 'next';
import Providers from './providers';


// No title here: every page renders its own PageTitle (a metadata title would replace it after loading)
export const metadata: Metadata = {
  description: 'A modern interface to browse your MusicBrainz collection',
  // Home-screen install on iPhone: full screen, dark status bar, short name under the icon
  appleWebApp: { capable: true, title: 'Collections', statusBarStyle: 'black' },
};

// Colors the phone's status bar and the installed app's title bar like the app header
export const viewport: Viewport = {
  themeColor: '#121212',
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
