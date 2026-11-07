'use client';

import type { ReactNode } from 'react';

export interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
  children?: ReactNode;
}

/** 统一的错误提示条：真实错误文案 + 可选重试 */
export default function ErrorBanner({ message, onRetry, children }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-2 rounded-md px-4 py-3 text-[14px] leading-[20px]"
      style={{
        backgroundColor: 'var(--state-failed-bg)',
        border: '1px solid var(--line-200)',
        color: 'var(--state-failed)',
      }}
    >
      <div className="flex items-start gap-2">
        <span aria-hidden="true">⚠</span>
        <span className="flex-1 break-words">{message}</span>
      </div>
      {children}
      {onRetry ? (
        <div>
          <button type="button" className="btn-secondary min-h-[36px] px-3 py-1.5 text-[13px]" onClick={onRetry}>
            重试
          </button>
        </div>
      ) : null}
    </div>
  );
}
