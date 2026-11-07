export type PetRegion = 'nose' | 'head' | 'body';

export interface RelativePoint {
  /** 相对于宠物容器宽度的比例 0 ~ 1 */
  rx: number;
  /** 相对于宠物容器高度的比例 0 ~ 1 */
  ry: number;
}

/**
 * 将客户端指针坐标转换为相对于容器 (0~1) 的归一化坐标
 */
export function toRelativePoint(
  clientX: number,
  clientY: number,
  rect: DOMRect
): RelativePoint {
  const width = Math.max(rect.width, 1);
  const height = Math.max(rect.height, 1);
  const rx = Math.min(1, Math.max(0, (clientX - rect.left) / width));
  const ry = Math.min(1, Math.max(0, (clientY - rect.top) / height));
  return { rx, ry };
}

/**
 * 按 03_UIUX设计说明.md 判定触控区域：
 * - 优先级：鼻尖圆 > 头部区 > 身体区
 * - 鼻尖区：面部中心 (rx ≈ 0.5, ry ≈ 0.45)，在 240px 容器中半径 ≥ 32px（归一化半径约 0.16，确保触控直径 ≥ 44px）
 * - 头部区：容器上半部分 35% (ry <= 0.35)
 * - 身体区：其余区域
 */
export function hitTestRegion(point: RelativePoint): PetRegion {
  const noseCenterX = 0.5;
  const noseCenterY = 0.46;
  const dx = point.rx - noseCenterX;
  const dy = point.ry - noseCenterY;
  const distance = Math.hypot(dx, dy);

  if (distance <= 0.17) {
    return 'nose';
  }

  if (point.ry <= 0.36) {
    return 'head';
  }

  return 'body';
}
