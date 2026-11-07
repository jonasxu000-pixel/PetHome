'use client';

import type { ReactNode } from 'react';

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

/** 统一的空态占位：说明现状 + 可选主操作 */
export default function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="card flex flex-col items-center gap-2 py-10 text-center">
      <div
        className="flex h-12 w-12 items-center justify-center text-[20px]"
        style={{ backgroundColor: 'var(--bg-surface-2)', color: 'var(--ink-500)', borderRadius: 'var(--r-pill)' }}
        aria-hidden="true"
      >
        🐾
      </div>
      <p className="text-[15px] font-semibold" style={{ color: 'var(--ink-900)' }}>
        {title}
      </p>
      {description ? <p className="muted-text max-w-[280px]">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
