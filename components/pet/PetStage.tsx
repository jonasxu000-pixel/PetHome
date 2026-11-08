'use client';

import React from 'react';
import { ActionLayer } from './ActionLayer';
import { PetModel3D } from './PetModel3D';
import { getPetModel } from '@/lib/pet3d/catalog';
import type {
  InteractionOverlay,
  Pet,
  RealityState,
} from '@/lib/types';

export interface PetStageProps {
  pet: Pet | null;
  realityState: RealityState;
  overlay: InteractionOverlay | null;
  displayAnimation?: string;
  nightMode?: boolean;
  onSetOverlay: (overlay: InteractionOverlay) => void;
}

function getStageAnimationClass(
  realityState: RealityState,
  overlay: InteractionOverlay | null,
  displayAnimation?: string
): string {
  const activePose =
    displayAnimation ??
    (realityState.behavior === 'unknown' ? 'idle' : realityState.behavior);

  // 瞬态触摸互动优先生效（结束后恢复现实状态动画）
  if (overlay && overlay.level > 0) {
    if (
      overlay.level <= 1 ||
      activePose === 'sleeping' ||
      activePose === 'sleeping_twitch'
    ) {
      return 'pet-react-mild';
    }
    if (overlay.kind === 'tap_head') return 'pet-react-tap_head';
    if (overlay.kind === 'tap_nose') return 'pet-react-tap_nose';
    if (overlay.kind === 'stroke') return 'pet-react-stroke';
    if (overlay.kind === 'tap_tail') return 'pet-react-tap_tail';
  }

  if (
    realityState.syncStatus === 'offline' ||
    realityState.status === 'failed' ||
    realityState.status === 'timeout' ||
    activePose === 'idle_static'
  ) {
    return 'pet-anim-offline';
  }

  switch (activePose) {
    case 'sleeping':
    case 'sleeping_twitch':
      return 'pet-anim-sleeping';
    case 'walking':
      return 'pet-anim-walking';
    case 'eating':
      return 'pet-anim-eating';
    case 'playing':
      return 'pet-anim-playing';
    case 'idle':
    default:
      return 'pet-anim-idle';
  }
}

export function PetStage({
  pet,
  realityState,
  overlay,
  displayAnimation,
  nightMode = false,
  onSetOverlay,
}: PetStageProps) {
  const animClass = getStageAnimationClass(
    realityState,
    overlay,
    displayAnimation
  );
  const activePose =
    displayAnimation ??
    (realityState.behavior === 'unknown' ? 'idle' : realityState.behavior);
  const isFailed =
    realityState.status === 'failed' ||
    realityState.status === 'timeout' ||
    realityState.status === 'rate_limited';
  const isOffline = realityState.syncStatus === 'offline';
  const isSleeping =
    (activePose === 'sleeping' || activePose === 'sleeping_twitch') &&
    !isOffline &&
    !isFailed;

  return (
    <div
      aria-label="数字宠物分身舞台"
      className="absolute inset-0 w-full h-full z-10 pointer-events-none"
    >
      <ActionLayer
        limitedFeedback={!Object.keys(getPetModel(pet?.avatar, pet?.type ?? 'cat')?.animations ?? {}).length}
        realityBehavior={realityState.behavior}
        overlay={overlay}
        onSetOverlay={onSetOverlay}
      >
        {(bindPartPointerDown) => (
          <div className="relative flex flex-col items-center justify-end pointer-events-none">
            {/* 地毯接触阴影（紧贴 SVG 前爪 y=242 实际落点，即容器底部向上约 12.5%） */}

            {/* 熟睡浮动 Zzz 气泡 */}
            {isSleeping && (
              <div
                aria-hidden="true"
                className="absolute top-6 right-8 z-20 pointer-events-none select-none flex flex-col items-end"
              >
                <span
                  className="zzz-float-1 text-[15px] font-bold tracking-wider px-2.5 py-0.5 rounded-pill shadow-1"
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

            {/* 原生分层绘本角色画布：放大至场景宽约 80%（312px ~ 340px），外框透传点击避免挡住左右工具圆钮 */}
            <div
              className="relative w-[312px] h-[312px] sm:w-[340px] sm:h-[340px] flex items-center justify-center pointer-events-none"
            >
              <PetModel3D
                avatar={pet?.avatar}
                fallbackType={pet?.type ?? 'cat'}
                behavior={realityState.behavior}
                displayAnimation={displayAnimation}
                overlay={overlay}
                nightMode={nightMode}
                onPartPointerDown={bindPartPointerDown}
              />
            </div>

            {/* 若用户上传过真实参考照片，在角色爪侧附精致参考圆章 */}
            {pet?.photoUrl && (
              <div
                title="参考照片定制分身"
                className="absolute bottom-[12%] right-6 z-20 flex items-center gap-1 pl-1 pr-2 py-0.5 rounded-pill bg-surface-0/90 backdrop-blur-sm border border-line-200 shadow-1 pointer-events-none"
              >
                <img
                  src={pet.photoUrl}
                  alt={`${pet.name}参考照片`}
                  className="w-4 h-4 rounded-full object-cover border border-line-200"
                />
                <span className="text-[10px] font-medium text-ink-700 whitespace-nowrap">
                  照片分身
                </span>
              </div>
            )}
          </div>
        )}
      </ActionLayer>
    </div>
  );
}
