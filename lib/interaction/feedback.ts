import type {
  Behavior,
  InteractionKind,
  InteractionOverlay,
} from '@/lib/types';

export interface InteractionActionMeta {
  kind: InteractionKind;
  shortLabel: string;
  label: string;
  gestureHint: string;
  keyShortcut: string;
  normalMessage: string;
  sleepingMessage: string;
  normalDurationMs: number;
  sleepingDurationMs: number;
}

export const INTERACTION_ACTIONS_META: readonly InteractionActionMeta[] = [
  {
    kind: 'tap_head',
    shortLabel: '摸头',
    label: '摸摸头',
    gestureHint: '点头顶或耳朵',
    keyShortcut: '1',
    normalMessage: '它眯起眼睛，耳朵轻轻垂下享受抚摸',
    sleepingMessage: '它睡得很沉，耳尖只轻轻动了一下',
    normalDurationMs: 1150,
    sleepingDurationMs: 780,
  },
  {
    kind: 'tap_nose',
    shortLabel: '点鼻',
    label: '点点鼻尖',
    gestureHint: '轻触湿润鼻头',
    keyShortcut: '2',
    normalMessage: '它好奇地仰起脑袋，鼻尖嗅了嗅你',
    sleepingMessage: '它在睡梦里微微抽动了一下鼻尖',
    normalDurationMs: 1050,
    sleepingDurationMs: 750,
  },
  {
    kind: 'stroke',
    shortLabel: '顺背',
    label: '顺毛抚摸',
    gestureHint: '轻抚或滑动后背',
    keyShortcut: '3',
    normalMessage: '它舒服地拱起后背，温顺地贴近你手心',
    sleepingMessage: '它保持蜷睡姿势，呼吸依旧均匀轻柔',
    normalDurationMs: 1300,
    sleepingDurationMs: 800,
  },
  {
    kind: 'tap_tail',
    shortLabel: '逗尾',
    label: '逗逗尾巴',
    gestureHint: '轻触毛茸尾巴',
    keyShortcut: '4',
    normalMessage: '它欢快地摇晃尾巴，后爪跟着轻快点地',
    sleepingMessage: '它的尾巴尖只迷糊地轻摆了半下',
    normalDurationMs: 1200,
    sleepingDurationMs: 780,
  },
] as const;

/**
 * 根据触摸动作和当前现实行为状态生成瞬态覆盖层：
 * - 当 realityBehavior === 'sleeping' 时，强制降级为 level = 1（微弱反应，时长 <= 800ms，不惊醒）
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
