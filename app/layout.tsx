import './globals.css';
import React from 'react';
import { Providers } from '@/store/providers';
import { Inter, JetBrains_Mono, Silkscreen } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

const silkscreen = Silkscreen({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-silkscreen',
  display: 'swap',
});

export const metadata = {
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} ${silkscreen.variable}`}
    >
      <body className="bg-bg-desktop text-foreground h-screen overflow-hidden font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
