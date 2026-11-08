'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * 仅在非首页（/create, /records）渲染传统顶部导航栏；
 * 首页 `/` 采用 100dvh 沉浸式数字小屋，导航已并入小屋场景 HUD 与环绕圆钮。
 */
export function SiteHeader() {
  const pathname = usePathname();
  if (pathname === '/') {
    return null;
  }

  return (
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
            小屋
          </Link>
          <Link
            href="/create"
            className="px-2.5 py-1.5 rounded-sm text-brand-600 hover:bg-brand-50 transition-colors duration-200 whitespace-nowrap cursor-pointer"
          >
            分身
          </Link>
        </nav>
      </div>
    </header>
  );
}
