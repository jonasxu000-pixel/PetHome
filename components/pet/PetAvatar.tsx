'use client';

import React from 'react';
import { mapRegionToKind } from '@/lib/interaction/gestures';
import type { PetRegion } from '@/lib/interaction/regions';
import type {
  AvatarProfile,
  Behavior,
  InteractionKind,
  InteractionOverlay,
} from '@/lib/types';
import { PetAvatarSvg } from './PetAvatarSvg';

export interface PetAvatarProps {
  avatar: AvatarProfile;
  behavior?: Behavior;
  overlay?: InteractionOverlay | null;
  interactive?: boolean;
  onInteract?: (kind: InteractionKind) => void;
}

/**
 * 通用数字分身角色组件（供首页与 /create 预览共享契约）
 */
export function PetAvatar({
  avatar,
  behavior = 'unknown',
  overlay = null,
  interactive = false,
  onInteract,
}: PetAvatarProps) {
  const handlePartPointerDown = (
    part: PetRegion,
    e: React.PointerEvent<SVGElement>
  ) => {
    if (!interactive || !onInteract) return;
    e.stopPropagation();
    onInteract(mapRegionToKind(part));
  };

  return (
    <div className="w-full h-full flex items-center justify-center">
      <PetAvatarSvg
        avatar={avatar}
        fallbackType={avatar?.species ?? 'cat'}
        realityBehavior={behavior}
        overlay={overlay}
        onPartPointerDown={interactive ? handlePartPointerDown : undefined}
      />
    </div>
  );
}
