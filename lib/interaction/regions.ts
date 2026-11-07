export type PetRegion = 'nose' | 'head' | 'body' | 'tail';

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
 * 兜底相对区域判定（主流程由 SVG 分层部位 data-part 直接命中，此函数供外围容器轻点兜底）：
 * - 优先级：鼻尖圆 > 尾巴侧 > 头部区 > 身体区
 */
export function hitTestRegion(point: RelativePoint): PetRegion {
  const noseCenterX = 0.5;
  const noseCenterY = 0.45;
  const dx = point.rx - noseCenterX;
  const dy = point.ry - noseCenterY;
  const distance = Math.hypot(dx, dy);

  if (distance <= 0.14) {
    return 'nose';
  }

  // 右下后侧尾巴热区
  if (point.rx >= 0.72 && point.ry >= 0.48 && point.ry <= 0.85) {
    return 'tail';
  }

  if (point.ry <= 0.4) {
    return 'head';
  }

  return 'body';
}
