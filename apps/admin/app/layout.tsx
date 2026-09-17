import { Toaster } from '@lumea/ui';
import type { Metadata } from 'next';
import { Cormorant_Garamond, DM_Sans } from 'next/font/google';
import './globals.css';

const display = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-display',
});

const sans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'Selfieface Admin',
  description: 'Selfieface operations dashboard',
  icons: {
    icon: [{ url: '/brand/favicon.png', type: 'image/png' }],
    apple: [{ url: '/brand/apple-touch.png', sizes: '180x180', type: 'image/png' }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${sans.variable} min-h-screen antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
