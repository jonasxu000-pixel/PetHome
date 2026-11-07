import type { InteractionKind } from '@/lib/types';
import { hitTestRegion, toRelativePoint } from './regions';

export interface PointerStartSnapshot {
  clientX: number;
  clientY: number;
  timestamp: number;
}

export interface GestureResolution {
  kind: InteractionKind;
  /** 相对于舞台容器的点击/终点坐标 (px)，用于渲染水波纹 */
  x: number;
  y: number;
}

/**
 * 根据指针按下与抬起快照判定手势：
 * - tap：位移 < 26px 且时长 <= 600ms -> 命中鼻尖为 tap_nose，命中头部或其余轻点区域为 tap_head
 * - stroke：水平/综合滑动位移 >= 26px -> 触发 stroke（身体抚摸）
 * - 若主要纵向大幅滚动页面（|dy| > |dx| * 1.8 && |dy| > 42），返回 null 交由浏览器滚动
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

  // 横向或斜向抚摸滑动（位移 >= 26px）
  if (distance >= 26) {
    if (Math.abs(dy) > Math.abs(dx) * 1.8 && Math.abs(dy) > 42) {
      return null;
    }
    return {
      kind: 'stroke',
      x,
      y,
    };
  }

  // 轻点手势
  if (distance < 26 && duration <= 600) {
    const rel = toRelativePoint(endClientX, endClientY, containerRect);
    const region = hitTestRegion(rel);
    if (region === 'nose') {
      return { kind: 'tap_nose', x, y };
    }
    return { kind: 'tap_head', x, y };
  }

  return null;
}
