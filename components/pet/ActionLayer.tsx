'use client';

import React, { useRef, useState } from 'react';
import {
  createFeedbackOverlay,
  INTERACTION_ACTIONS_META,
} from '@/lib/interaction/feedback';
import {
  type PointerStartSnapshot,
  resolvePointerGesture,
} from '@/lib/interaction/gestures';
import type { PetRegion } from '@/lib/interaction/regions';
import type {
  Behavior,
  InteractionKind,
  InteractionOverlay,
} from '@/lib/types';

export interface RippleItem {
  id: number;
  x: number;
  y: number;
  mild: boolean;
}

export interface ActionLayerProps {
  realityBehavior: Behavior;
  overlay: InteractionOverlay | null;
  onSetOverlay: (overlay: InteractionOverlay) => void;
  children: (bindPartPointerDown: (
    part: PetRegion,
    e: React.PointerEvent<SVGElement>
  ) => void) => React.ReactNode;
}

export function ActionLayer({
  realityBehavior,
  overlay,
  onSetOverlay,
  children,
}: ActionLayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const startRef = useRef<PointerStartSnapshot | null>(null);
  const [ripples, setRipples] = useState<RippleItem[]>([]);

  const isCoolingDown = Boolean(overlay && overlay.expiresAt > Date.now());
  const isSleeping = realityBehavior === 'sleeping';

  const spawnRipple = (x: number, y: number, mild: boolean) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setRipples((prev) => [...prev.slice(-3), { id, x, y, mild }]);
    window.setTimeout(() => {
      setRipples((prev) => prev.filter((item) => item.id !== id));
    }, 680);
  };

  const triggerKind = (
    kind: InteractionKind,
    customX?: number,
    customY?: number
  ) => {
    const now = Date.now();
    if (overlay && overlay.expiresAt > now) {
      return;
    }
    const rect = containerRef.current?.getBoundingClientRect();
    const fallbackX = rect
      ? kind === 'tap_tail'
        ? rect.width * 0.74
        : rect.width / 2
      : 156;
    const fallbackY = rect
      ? kind === 'tap_head'
        ? rect.height * 0.3
        : kind === 'tap_nose'
          ? rect.height * 0.43
          : kind === 'tap_tail'
            ? rect.height * 0.65
            : rect.height * 0.62
      : 156;

    spawnRipple(customX ?? fallbackX, customY ?? fallbackY, isSleeping);
    const nextOverlay = createFeedbackOverlay(kind, realityBehavior, now);
    onSetOverlay(nextOverlay);
  };

  const handlePartPointerDown = (
    part: PetRegion,
    e: React.PointerEvent<SVGElement>
  ) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.stopPropagation();
    startRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      timestamp: Date.now(),
      part,
    };
  };

  const handleContainerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (startRef.current && Date.now() - startRef.current.timestamp < 40) {
      return;
    }
    const targetEl = e.target as HTMLElement | null;
    const partAttr = targetEl
      ?.closest('[data-part]')
      ?.getAttribute('data-part') as PetRegion | null;

    startRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      timestamp: Date.now(),
      part: partAttr ?? null,
    };
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = startRef.current;
    startRef.current = null;
    if (!start || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const resolved = resolvePointerGesture(
      start,
      e.clientX,
      e.clientY,
      Date.now(),
      rect
    );
    if (!resolved) return;

    triggerKind(resolved.kind, resolved.x, resolved.y);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === '1') {
      e.preventDefault();
      triggerKind('tap_head');
    } else if (e.key === '2') {
      e.preventDefault();
      triggerKind('tap_nose');
    } else if (e.key === '3') {
      e.preventDefault();
      triggerKind('stroke');
    } else if (e.key === '4') {
      e.preventDefault();
      triggerKind('tap_tail');
    }
  };

  return (
    <div className="relative w-full h-full pointer-events-none">
      {/* 宠物分身精准落位于地毯中心（容器收紧不溢出左右圆钮区，仅 SVG 部位与键盘聚焦响应指针） */}
      <div
        ref={containerRef}
        role="region"
        aria-label="数字宠物分身互动舞台，可直接轻点头部、鼻尖、后背或尾巴，也可使用底部快捷栏或数字键 1 至 4"
        tabIndex={0}
        onPointerDown={handleContainerPointerDown}
        onPointerUp={handlePointerUp}
        onKeyDown={handleKeyDown}
        className="absolute left-1/2 -translate-x-1/2 bottom-[19%] sm:bottom-[18.5%] flex flex-col items-center justify-end select-none touch-pan-y pointer-events-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 rounded-xl"
      >
        {/* 头顶悬浮反馈气泡 */}
        <div
          aria-live="polite"
          className="min-h-[28px] mb-0.5 flex items-center justify-center pointer-events-none px-2 z-20"
        >
          {overlay ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill bg-surface-0/95 backdrop-blur-md border border-line-200 shadow-2 text-[12px] font-medium text-ink-900 whitespace-nowrap">
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{
                  backgroundColor:
                    overlay.level <= 1
                      ? 'var(--state-sleeping)'
                      : 'var(--brand-500)',
                }}
              />
              <span>{overlay.message}</span>
            </div>
          ) : (
            <span className="text-[11px] font-medium text-ink-700 bg-surface-0/82 backdrop-blur-sm px-3 py-0.5 rounded-pill border border-line-200/80 shadow-1 whitespace-nowrap">
              {isSleeping
                ? '熟睡中 · 轻触仅有轻微反应'
                : '轻触头、鼻、背或长尾互动'}
            </span>
          )}
        </div>

        {children(handlePartPointerDown)}

        {/* 触摸水波涟漪层 */}
        {ripples.map((r) => (
          <span
            key={r.id}
            className="touch-ripple"
            style={{
              left: `${r.x}px`,
              top: `${r.y}px`,
              transform: `translate(-50%, -50%) scale(${r.mild ? 0.55 : 1})`,
            }}
          />
        ))}
      </div>

      {/* 底部精致胶囊小 Dock（单行紧凑 4 部位互动快捷按钮，开启独立 pointer-events-auto） */}
      <div
        role="group"
        aria-label="宠物四部位互动快捷栏"
        className="absolute left-1/2 -translate-x-1/2 bottom-3.5 z-30 pointer-events-auto inline-flex items-center gap-1.5 p-1 rounded-pill bg-surface-0/90 backdrop-blur-md border border-line-200 shadow-2"
      >
        {INTERACTION_ACTIONS_META.map((item) => {
          const isActive = overlay?.kind === item.kind;
          return (
            <button
              key={item.kind}
              type="button"
              disabled={isCoolingDown}
              onClick={() => triggerKind(item.kind)}
              aria-label={`${item.label}（${item.gestureHint}，快捷键 ${item.keyShortcut}）`}
              className={`px-3.5 py-1.5 min-h-[36px] rounded-pill text-[12px] font-semibold whitespace-nowrap cursor-pointer transition-colors duration-150 ${
                isActive
                  ? 'bg-brand-500 text-white shadow-1'
                  : 'text-ink-900 hover:bg-brand-50'
              } disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              {item.shortLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}
