import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: '宠伴 PetHome · 现实同步数字宠物',
  description:
    '基于本地视频抽帧与视觉大模型识别的诚实数字宠物陪伴应用。行为状态如实反映视频识别结果，不做医疗健康诊断。',
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
        {/* 顶部简洁品牌与三页面导航栏 */}
        <header className="sticky top-0 z-30 bg-surface-1/90 backdrop-blur-md border-b border-line-200">
          <div className="mx-auto w-full max-w-[480px] px-4 sm:px-5 h-14 flex items-center justify-between gap-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 font-semibold text-[15px] sm:text-[16px] text-ink-900 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span
                className="w-7 h-7 rounded-sm flex items-center justify-center text-white shrink-0"
                style={{ backgroundColor: 'var(--brand-500)' }}
                aria-hidden="true"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="9" cy="8.5" r="1.8" />
                  <circle cx="15" cy="8.5" r="1.8" />
                  <circle cx="6.2" cy="12.8" r="1.5" />
                  <circle cx="17.8" cy="12.8" r="1.5" />
                  <path d="M9 15.2c1.2-1.4 4.8-1.4 6 0 1 1.3.3 3.3-1.5 3.3h-3c-1.8 0-2.5-2-1.5-3.3z" />
                </svg>
              </span>
              <span>宠伴 PetHome</span>
            </Link>

            <nav
              aria-label="主导航"
              className="flex items-center gap-1 text-[13px] font-medium whitespace-nowrap shrink-0"
            >
              <Link
                href="/"
                className="px-2.5 py-1.5 rounded-sm text-ink-700 hover:bg-surface-2 transition-colors duration-200 whitespace-nowrap cursor-pointer"
              >
                首页
              </Link>
              <Link
                href="/records"
                className="px-2.5 py-1.5 rounded-sm text-ink-700 hover:bg-surface-2 transition-colors duration-200 whitespace-nowrap cursor-pointer"
              >
                记录
              </Link>
              <Link
                href="/create"
                className="px-2.5 py-1.5 rounded-sm text-brand-600 hover:bg-brand-50 transition-colors duration-200 whitespace-nowrap cursor-pointer"
              >
                建档
              </Link>
            </nav>
          </div>
        </header>

        {/* 主体区域 */}
        <main className="flex-1 w-full">{children}</main>
      </body>
    </html>
  );
}
