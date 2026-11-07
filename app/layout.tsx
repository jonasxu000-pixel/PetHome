import type { Metadata, Viewport } from 'next';
import { SiteHeader } from '@/components/world/SiteHeader';
import './globals.css';

export const metadata: Metadata = {
  title: '宠伴 PetHome · 现实同步数字宠物小屋',
  description:
    '基于本地视频抽帧与视觉大模型识别的诚实数字宠物陪伴世界。行为状态如实反映视频识别结果，不做医疗健康诊断。',
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
