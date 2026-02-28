import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Melodiver — Interactive Music Visualizer',
  description: 'Upload audio and explore the mathematical mapping between sound and visuals',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
