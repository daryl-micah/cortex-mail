import './globals.css';
import React from 'react';
import { Providers } from '@/store/providers';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-background text-slate-950">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
