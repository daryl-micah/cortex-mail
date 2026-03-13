import './globals.css';
import React from 'react';
import { Providers } from '@/store/providers';

export const metadata = {
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-foreground h-screen overflow-hidden">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
