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
  children: React.ReactNode;
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
    const fallbackX = rect ? rect.width / 2 : 120;
    const fallbackY = rect
      ? kind === 'tap_head'
        ? rect.height * 0.25
        : kind === 'tap_nose'
          ? rect.height * 0.46
          : rect.height * 0.68
      : 120;

    spawnRipple(customX ?? fallbackX, customY ?? fallbackY, isSleeping);
    const nextOverlay = createFeedbackOverlay(kind, realityBehavior, now);
    onSetOverlay(nextOverlay);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    startRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      timestamp: Date.now(),
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
    }
  };

  return (
    <div className="flex flex-col items-center w-full gap-3">
      {/* 触摸互动热区舞台 */}
      <div
        ref={containerRef}
        role="region"
        aria-label="数字宠物触摸互动舞台，可轻点头部、点鼻尖或左右滑动抚摸"
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onKeyDown={handleKeyDown}
        className="relative flex flex-col items-center justify-center w-full select-none cursor-pointer touch-pan-y focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 rounded-xl"
      >
        {children}

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

        {/* 单行克制反馈文案浮层（aria-live 播报） */}
        <div
          aria-live="polite"
          className="min-h-[34px] mt-2 flex items-center justify-center pointer-events-none"
        >
          {overlay ? (
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-pill bg-surface-0/95 border border-line-200 shadow-1 text-[13px] font-medium text-ink-900 transition-opacity duration-200">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  backgroundColor:
                    overlay.level <= 1
                      ? 'var(--state-sleeping)'
                      : 'var(--brand-500)',
                }}
              />
              <span>{overlay.message}</span>
              {overlay.level <= 1 && (
                <span className="text-[11px] text-ink-400 ml-0.5">
                  (熟睡轻反应)
                </span>
              )}
            </div>
          ) : (
            <p className="text-[12px] text-ink-400">
              {isSleeping
                ? '正在熟睡中 · 轻触仅会产生轻微反应，不会吵醒它'
                : '轻点头部、点鼻尖，或在身上左右滑动抚摸'}
            </p>
          )}
        </div>
      </div>

      {/* 无障碍键盘与按钮替代触发区（确保非指针设备与辅助技术可完整体验 3 种互动） */}
      <div
        role="group"
        aria-label="宠物互动快捷按钮"
        className="grid grid-cols-3 gap-2 w-full max-w-[340px]"
      >
        {INTERACTION_ACTIONS_META.map((item) => {
          const isActive = overlay?.kind === item.kind;
          return (
            <button
              key={item.kind}
              type="button"
              disabled={isCoolingDown}
              onClick={() => triggerKind(item.kind)}
              aria-label={`${item.label}（${item.gestureHint}）`}
              className={`flex flex-col items-center justify-center py-2 px-2.5 min-h-[44px] rounded-md border text-[13px] font-medium cursor-pointer transition-colors duration-200 ${
                isActive
                  ? 'bg-brand-50 border-brand-400 text-brand-600'
                  : 'bg-surface-0 border-line-200 text-ink-700 hover:bg-brand-50/60 hover:border-brand-200'
              } disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              <span>{item.label}</span>
              <span className="text-[11px] text-ink-400 font-normal">
                {item.gestureHint}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
