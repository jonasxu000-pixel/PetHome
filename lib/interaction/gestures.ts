import type { InteractionKind } from '@/lib/types';
import { hitTestRegion, type PetRegion, toRelativePoint } from './regions';

export interface PointerStartSnapshot {
  clientX: number;
  clientY: number;
  timestamp: number;
  part?: PetRegion | null;
}

export interface GestureResolution {
  kind: InteractionKind;
  part: PetRegion;
  /** 相对于舞台容器的点击/终点坐标 (px)，用于渲染水波纹或浮动粒子 */
  x: number;
  y: number;
}

export function mapRegionToKind(region: PetRegion): InteractionKind {
  switch (region) {
    case 'nose':
      return 'tap_nose';
    case 'tail':
      return 'tap_tail';
    case 'body':
      return 'stroke';
    case 'head':
    default:
      return 'tap_head';
  }
}

/**
 * 根据指针按下与抬起快照判定手势（支持 SVG 分层部位直接命中 + 滑动抚摸）：
 * - 若横向/斜向滑动位移 >= 24px（非纵向页面滚动）：若起点在尾巴则触发 tap_tail，否则触发 stroke（顺毛抚摸背部）
 * - 若为轻点（位移 < 24px 且时长 <= 650ms）：优先按 SVG 命中的 data-part (head / nose / body / tail) 触发对应动作；未命中 SVG 子部位时按相对坐标兜底
 */
export function resolvePointerGesture(
  start: PointerStartSnapshot,
  endClientX: number,
  endClientY: number,
  endTime: number,
  containerRect: DOMRect
): GestureResolution | null {
  const dx = endClientX - start.clientX;
  const dy = endClientY - start.clientY;
  const distance = Math.hypot(dx, dy);
  const duration = Math.max(0, endTime - start.timestamp);

  const x = Math.min(
    containerRect.width,
    Math.max(0, endClientX - containerRect.left)
  );
  const y = Math.min(
    containerRect.height,
    Math.max(0, endClientY - containerRect.top)
  );

  // 滑动抚摸手势
  if (distance >= 24) {
    if (Math.abs(dy) > Math.abs(dx) * 1.8 && Math.abs(dy) > 42) {
      return null;
    }
    if (start.part === 'tail') {
      return { kind: 'tap_tail', part: 'tail', x, y };
    }
    return {
      kind: 'stroke',
      part: 'body',
      x,
      y,
    };
  }

  // 轻点手势
  if (distance < 24 && duration <= 650) {
    const region: PetRegion =
      start.part ??
      hitTestRegion(toRelativePoint(endClientX, endClientY, containerRect));
    return {
      kind: mapRegionToKind(region),
      part: region,
      x,
      y,
    };
  }

  return null;
}
