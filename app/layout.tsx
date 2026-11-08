import type { Metadata, Viewport } from 'next';
import { SiteHeader } from '@/components/world/SiteHeader';
import './globals.css';

export const metadata: Metadata = {
  title: 'PetHome · 让远方的爱宠，在手机里陪伴你',
  description:
    '上传真实宠物照片，AI识别外貌并匹配可互动的3D数字分身，为暂时无法陪伴爱宠的人提供温暖的数字陪伴。',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#FBF8F4',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen flex flex-col bg-surface-1 text-ink-900">
        <SiteHeader />
        <main className="flex-1 w-full flex flex-col">{children}</main>
      </body>
    </html>
  );
}
