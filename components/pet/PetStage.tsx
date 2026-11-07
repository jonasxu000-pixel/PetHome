'use client';

import React from 'react';
import {
  BEHAVIOR_LABELS,
  PERSONALITY_LABELS,
  PET_TYPE_LABELS,
} from '@/lib/constants';
import type {
  Behavior,
  InteractionOverlay,
  Pet,
  RealityState,
} from '@/lib/types';
import { ActionLayer } from './ActionLayer';

export interface PetStageProps {
  pet: Pet | null;
  realityState: RealityState;
  overlay: InteractionOverlay | null;
  displayAnimation?: string;
  onSetOverlay: (overlay: InteractionOverlay) => void;
}

function getStageAnimationClass(
  realityState: RealityState,
  overlay: InteractionOverlay | null,
  displayAnimation?: string
): string {
  // 瞬态触摸互动优先生效（结束后恢复现实状态动画）
  if (overlay && overlay.level > 0) {
    if (
      overlay.level <= 1 ||
      realityState.behavior === 'sleeping' ||
      displayAnimation === 'sleeping_twitch'
    ) {
      return 'pet-react-mild';
    }
    if (overlay.kind === 'tap_head') return 'pet-react-tap_head';
    if (overlay.kind === 'tap_nose') return 'pet-react-tap_nose';
    if (overlay.kind === 'stroke') return 'pet-react-stroke';
  }

  if (
    realityState.syncStatus === 'offline' ||
    displayAnimation === 'idle_static'
  ) {
    return 'pet-anim-offline';
  }

  switch (displayAnimation ?? realityState.behavior) {
    case 'sleeping':
      return 'pet-anim-sleeping';
    case 'walking':
      return 'pet-anim-walking';
    case 'eating':
      return 'pet-anim-eating';
    case 'playing':
      return 'pet-anim-playing';
    case 'unknown':
    default:
      return 'pet-anim-idle';
  }
}

function getBehaviorToneStyle(
  behavior: Behavior,
  syncStatus: RealityState['syncStatus'],
  status: RealityState['status']
): { bg: string; fg: string } {
  const isFailed =
    status === 'failed' || status === 'timeout' || status === 'rate_limited';
  if (isFailed) {
    return { bg: 'var(--state-failed-bg)', fg: 'var(--state-failed)' };
  }
  if (syncStatus === 'offline' || syncStatus === 'stale') {
    return { bg: 'var(--state-offline-bg)', fg: 'var(--state-offline)' };
  }
  switch (behavior) {
    case 'sleeping':
      return { bg: 'var(--state-sleeping-bg)', fg: 'var(--state-sleeping)' };
    case 'walking':
      return { bg: 'var(--state-walking-bg)', fg: 'var(--state-walking)' };
    case 'eating':
      return { bg: 'var(--state-eating-bg)', fg: 'var(--state-eating)' };
    case 'playing':
      return { bg: 'var(--state-playing-bg)', fg: 'var(--state-playing)' };
    case 'unknown':
    default:
      return { bg: 'var(--state-unknown-bg)', fg: 'var(--state-unknown)' };
  }
}

export function PetStage({
  pet,
  realityState,
  overlay,
  displayAnimation,
  onSetOverlay,
}: PetStageProps) {
  const animClass = getStageAnimationClass(
    realityState,
    overlay,
    displayAnimation
  );
  const tone = getBehaviorToneStyle(
    realityState.behavior,
    realityState.syncStatus,
    realityState.status
  );
  const isFailed =
    realityState.status === 'failed' ||
    realityState.status === 'timeout' ||
    realityState.status === 'rate_limited';
  const isOffline = realityState.syncStatus === 'offline';
  const isSleeping =
    realityState.behavior === 'sleeping' && !isOffline && !isFailed;
  const hasPhoto = Boolean(pet?.photoUrl);

  return (
    <section
      aria-label="数字宠物形象舞台"
      className="card relative overflow-hidden flex flex-col items-center justify-between min-h-[340px] py-5 px-4"
      style={{
        background:
          'radial-gradient(circle at 50% 38%, #FFFFFF 0%, #FBF8F4 62%, #F4ECE1 100%)',
      }}
    >
      {/* 舞台顶部：宠物名称、类型与性格标签 + 当前现实姿态角标 */}
      <div className="w-full flex items-center justify-between gap-2 z-10">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[16px] font-semibold text-ink-900 truncate">
            {pet?.name || '未建档宠物'}
          </span>
          {pet && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-pill text-[12px] font-medium bg-surface-2 text-ink-700 border border-line-200 shrink-0">
              {PET_TYPE_LABELS[pet.type]} ·{' '}
              {PERSONALITY_LABELS[pet.personality]}
            </span>
          )}
        </div>

        {/* 右上角姿态微章 */}
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill text-[12px] font-semibold shrink-0"
          style={{ backgroundColor: tone.bg, color: tone.fg }}
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: tone.fg }}
          />
          {isFailed
            ? '识别异常'
            : isOffline && realityState.timestamp
              ? `离线保持 · ${BEHAVIOR_LABELS[realityState.behavior]}`
              : BEHAVIOR_LABELS[realityState.behavior]}
        </span>
      </div>

      {/* 舞台中央：宠物本体照片容器（最大 240×240，无照片诚实占位） + 触摸互动层 */}
      <div className="my-2 w-full flex flex-col items-center justify-center z-10">
        <ActionLayer
          realityBehavior={realityState.behavior}
          overlay={overlay}
          onSetOverlay={onSetOverlay}
        >
          <div className="relative flex items-center justify-center pt-3 pb-1">
            {/* 底部温暖投影 */}
            <div
              aria-hidden="true"
              className="absolute bottom-0 w-40 h-5 rounded-full blur-md"
              style={{ backgroundColor: 'rgba(178, 106, 76, 0.16)' }}
            />

            {/* 熟睡浮动 Zzz 气泡 */}
            {isSleeping && (
              <div
                aria-hidden="true"
                className="absolute -top-1 right-2 z-20 pointer-events-none select-none flex flex-col items-end"
              >
                <span
                  className="zzz-float-1 text-[15px] font-bold tracking-wider px-2 py-0.5 rounded-pill shadow-1"
                  style={{
                    backgroundColor: 'var(--state-sleeping-bg)',
                    color: 'var(--state-sleeping)',
                  }}
                >
                  Zzz
                </span>
                <span
                  className="zzz-float-2 text-[12px] font-semibold mr-3 -mt-1"
                  style={{ color: 'var(--state-sleeping)' }}
                >
                  z
                </span>
              </div>
            )}

            {/* 宠物本体容器：严格限制最大 240x240px */}
            <div
              className={`relative w-[220px] h-[220px] sm:w-[240px] sm:h-[240px] max-w-[240px] max-h-[240px] rounded-[28px] overflow-hidden border-2 border-surface-0 shadow-2 bg-surface-2 flex items-center justify-center ${animClass}`}
            >
              {hasPhoto && pet?.photoUrl ? (
                <img
                  src={pet.photoUrl}
                  alt={`${pet.name}的照片本体`}
                  draggable={false}
                  className="w-full h-full object-cover select-none pointer-events-none"
                />
              ) : (
                /* 无照片时的诚实占位插画（明确说明未上传照片，绝不伪造 AI 生成形象） */
                <div className="flex flex-col items-center justify-center text-center p-4 select-none pointer-events-none">
                  <svg
                    viewBox="0 0 64 64"
                    className="w-20 h-20 mb-2 text-brand-400"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    {pet?.type === 'dog' ? (
                      <>
                        <path d="M18 24c-5 2-7 9-5 15 2 4 5 4 7 2" />
                        <path d="M46 24c5 2 7 9 5 15-2 4-5 4-7 2" />
                        <rect x="18" y="18" width="28" height="30" rx="14" />
                        <circle cx="26" cy="31" r="2" fill="currentColor" />
                        <circle cx="38" cy="31" r="2" fill="currentColor" />
                        <ellipse
                          cx="32"
                          cy="37"
                          rx="3.5"
                          ry="2.5"
                          fill="currentColor"
                        />
                        <path d="M29 42c1.5 1.5 4.5 1.5 6 0" />
                      </>
                    ) : (
                      <>
                        <path d="M18 26L14 12l12 7" />
                        <path d="M46 26l4-14-12 7" />
                        <rect x="16" y="19" width="32" height="29" rx="15" />
                        <circle cx="26" cy="32" r="2" fill="currentColor" />
                        <circle cx="38" cy="32" r="2" fill="currentColor" />
                        <polygon
                          points="32,36 29.5,39 34.5,39"
                          fill="currentColor"
                        />
                        <path d="M28 42c2 1.5 6 1.5 8 0" />
                      </>
                    )}
                  </svg>
                  <span className="text-[13px] font-medium text-ink-700">
                    尚未上传宠物照片
                  </span>
                  <span className="text-[11px] text-ink-400 mt-0.5">
                    当前使用基础剪影占位（非 AI 生成形象）
                  </span>
                </div>
              )}

              {/* 热区视觉轻提示 */}
              <div
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-black/10 to-transparent pointer-events-none"
              />
            </div>
          </div>
        </ActionLayer>
      </div>
    </section>
  );
}
