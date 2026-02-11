import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Zoom Moderation Bot',
  description: 'Zoomウェビナー自動モデレーションBot管理画面',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className={`${inter.className} bg-[#0B0F19] text-white min-h-screen`}>
        {children}
      </body>
    </html>
  );
}