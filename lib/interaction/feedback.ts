import type {
  Behavior,
  InteractionKind,
  InteractionOverlay,
} from '@/lib/types';

export interface InteractionActionMeta {
  kind: InteractionKind;
  label: string;
  gestureHint: string;
  normalMessage: string;
  sleepingMessage: string;
  normalDurationMs: number;
  sleepingDurationMs: number;
}

export const INTERACTION_ACTIONS_META: readonly InteractionActionMeta[] = [
  {
    kind: 'tap_head',
    label: '摸摸头',
    gestureHint: '轻点头部',
    normalMessage: '它眯了眯眼',
    sleepingMessage: '它睡得很沉，只眨了眨眼',
    normalDurationMs: 1100,
    sleepingDurationMs: 800,
  },
  {
    kind: 'tap_nose',
    label: '点点鼻尖',
    gestureHint: '轻点面部中央',
    normalMessage: '它有点惊讶',
    sleepingMessage: '它没什么反应',
    normalDurationMs: 1000,
    sleepingDurationMs: 750,
  },
  {
    kind: 'stroke',
    label: '顺毛抚摸',
    gestureHint: '在身上左右滑动',
    normalMessage: '它靠了过来',
    sleepingMessage: '它没有动',
    normalDurationMs: 1300,
    sleepingDurationMs: 800,
  },
] as const;

/**
 * 根据触摸动作和当前现实行为状态生成瞬态覆盖层：
 * - 当 realityBehavior === 'sleeping' 时，强制降级为 level = 1（微弱反应，时长 <= 800ms）
 * - 其他状态下为正常反馈 level = 2
 * - 绝不修改现实行为状态
 */
export function createFeedbackOverlay(
  kind: InteractionKind,
  realityBehavior: Behavior,
  now: number = Date.now()
): InteractionOverlay {
  const meta =
    INTERACTION_ACTIONS_META.find((item) => item.kind === kind) ??
    INTERACTION_ACTIONS_META[0];
  const isSleeping = realityBehavior === 'sleeping';
  const duration = isSleeping
    ? meta.sleepingDurationMs
    : meta.normalDurationMs;

  return {
    kind,
    level: isSleeping ? 1 : 2,
    startedAt: now,
    expiresAt: now + duration,
    message: isSleeping ? meta.sleepingMessage : meta.normalMessage,
  };
}
