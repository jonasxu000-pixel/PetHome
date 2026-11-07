'use client';

import React, { useEffect, useState } from 'react';
import { BEHAVIOR_LABELS, SOURCE_LABELS } from '@/lib/constants';
import type { Behavior, DataSource, ReasonCode, RealityState } from '@/lib/types';

export interface StatusBarProps {
  realityState: RealityState;
}

const REASON_CODE_LABELS: Record<ReasonCode, string> = {
  none: '',
  no_pet: '画面中未检测到宠物（空镜头或离开视野）',
  too_blurry: '画面模糊或光线不足，无法可靠辨认动作',
  multi_pet: '画面中出现多只宠物，无法唯一定位目标',
  unclear: '宠物姿态不明确或置信度偏低，保持诚实未知态',
};

function BehaviorIcon({
  behavior,
  failed,
  staleOrOffline,
}: {
  behavior: Behavior;
  failed: boolean;
  staleOrOffline: boolean;
}) {
  if (failed) {
    return (
      <svg
        viewBox="0 0 24 24"
        className="w-5 h-5 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      </svg>
    );
  }
  if (staleOrOffline) {
    return (
      <svg
        viewBox="0 0 24 24"
        className="w-5 h-5 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    );
  }

  switch (behavior) {
    case 'sleeping':
      return (
        <svg
          viewBox="0 0 24 24"
          className="w-5 h-5 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      );
    case 'walking':
      return (
        <svg
          viewBox="0 0 24 24"
          className="w-5 h-5 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="9" cy="9" r="2" />
          <circle cx="15" cy="8" r="2" />
          <circle cx="6.5" cy="13.5" r="1.7" />
          <circle cx="17.5" cy="13" r="1.7" />
          <path d="M9 15.5c1.2-1.5 4.8-1.5 6 0 1.1 1.4.4 3.5-1.5 3.5h-3c-1.9 0-2.6-2.1-1.5-3.5z" />
        </svg>
      );
    case 'eating':
      return (
        <svg
          viewBox="0 0 24 24"
          className="w-5 h-5 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 13h16l-1.8 5.4A2 2 0 0 1 16.3 20H7.7a2 2 0 0 1-1.9-1.6L4 13z" />
          <path d="M7 10c1-1.5 3-1.5 4 0s3 1.5 4 0" />
        </svg>
      );
    case 'playing':
      return (
        <svg
          viewBox="0 0 24 24"
          className="w-5 h-5 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="8" />
          <path d="M8.5 8.5c2 2 2 5 0 7" />
          <path d="M15.5 8.5c-2 2-2 5 0 7" />
        </svg>
      );
    case 'unknown':
    default:
      return (
        <svg
          viewBox="0 0 24 24"
          className="w-5 h-5 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9.5a2.5 2.5 0 0 1 4.6 1.3c0 1.7-2.1 2-2.1 3.2" />
          <path d="M12 17h.01" />
        </svg>
      );
  }
}

function getVisualEncoding(state: RealityState): {
  bg: string;
  fg: string;
  title: string;
  subtitle: string;
} {
  const isFailed =
    state.status === 'failed' ||
    state.status === 'timeout' ||
    state.status === 'rate_limited';
  const reasonNote = REASON_CODE_LABELS[state.reasonCode];

  if (isFailed) {
    return {
      bg: 'var(--state-failed-bg)',
      fg: 'var(--state-failed)',
      title:
        state.status === 'rate_limited'
          ? '请求受限（非最新）'
          : '识别失败（非最新）',
      subtitle:
        state.status === 'rate_limited'
          ? '识别请求受限，当前保留上次结果，请稍后重试'
          : state.status === 'timeout'
            ? '识别请求超时，当前保留上次结果，请重试'
            : '当前帧识别失败，保留上次结果，请重试',
    };
  }

  if (state.syncStatus === 'offline' && state.timestamp) {
    return {
      bg: 'var(--state-offline-bg)',
      fg: 'var(--state-offline)',
      title: `信号离线（上次：${BEHAVIOR_LABELS[state.behavior]}）`,
      subtitle:
        '当前无实时抽帧流输入，仅展示上次抽帧的识别记录',
    };
  }

  if (state.syncStatus === 'stale') {
    return {
      bg: 'var(--state-offline-bg)',
      fg: 'var(--state-offline)',
      title: `状态保持中 · ${BEHAVIOR_LABELS[state.behavior]}`,
      subtitle:
        '最近一帧识别异常（非最新），暂时保留上次结果，请留意后续帧或重试',
    };
  }

  switch (state.behavior) {
    case 'sleeping':
      return {
        bg: 'var(--state-sleeping-bg)',
        fg: 'var(--state-sleeping)',
        title: BEHAVIOR_LABELS.sleeping,
        subtitle: '这张画面被 AI 判断为睡觉，仅供了解视频中的行为',
      };
    case 'walking':
      return {
        bg: 'var(--state-walking-bg)',
        fg: 'var(--state-walking)',
        title: BEHAVIOR_LABELS.walking,
        subtitle: '这张画面被 AI 判断为走动，仅供了解视频中的行为',
      };
    case 'eating':
      return {
        bg: 'var(--state-eating-bg)',
        fg: 'var(--state-eating)',
        title: BEHAVIOR_LABELS.eating,
        subtitle: '这张画面被 AI 判断为进食，仅供了解视频中的行为',
      };
    case 'playing':
      return {
        bg: 'var(--state-playing-bg)',
        fg: 'var(--state-playing)',
        title: BEHAVIOR_LABELS.playing,
        subtitle: '这张画面被 AI 判断为玩耍，仅供了解视频中的行为',
      };
    case 'unknown':
    default:
      return {
        bg: 'var(--state-unknown-bg)',
        fg: 'var(--state-unknown)',
        title: BEHAVIOR_LABELS.unknown,
        subtitle:
          reasonNote ||
          '尚未识别或画面无法判断具体行为，保持诚实未知态',
      };
  }
}

function formatUpdatedAt(timestamp: string | null, nowMs: number): {
  relative: string;
  exact: string;
} {
  if (!timestamp) {
    return { relative: '尚无识别记录', exact: '--:--' };
  }
  const timeMs = Date.parse(timestamp);
  if (!Number.isFinite(timeMs)) {
    return { relative: '时间未知', exact: '--:--' };
  }

  const diffSec = Math.max(0, Math.floor((nowMs - timeMs) / 1000));
  let relative = '刚刚更新';
  if (diffSec >= 3600) {
    relative = `${Math.floor(diffSec / 3600)} 小时前`;
  } else if (diffSec >= 60) {
    relative = `${Math.floor(diffSec / 60)} 分钟前`;
  } else if (diffSec >= 10) {
    relative = `${diffSec} 秒前`;
  }

  const exact = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(timeMs));

  return { relative, exact };
}

function SourceBadge({ source }: { source: DataSource | null }) {
  if (!source) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill text-[12px] font-medium bg-surface-2 text-ink-500">
        等待视频输入
      </span>
    );
  }
  if (source === 'preset') {
    return (
      <span className="badge-demo-stripe inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill text-[12px] font-semibold">
        <span className="w-1.5 h-1.5 rounded-full bg-[#C08A3E]" />
        {SOURCE_LABELS.preset}（非真实监测）
      </span>
    );
  }
  if (source === 'camera') {
    return (
      <span
        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill text-[12px] font-semibold"
        style={{ backgroundColor: 'var(--sage-50)', color: 'var(--sage-700)' }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: 'var(--semantic-ok)' }}
        />
        {SOURCE_LABELS.camera}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill text-[12px] font-semibold"
      style={{ backgroundColor: '#EEF2F7', color: 'var(--semantic-info)' }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: 'var(--semantic-info)' }}
      />
      {SOURCE_LABELS.upload}
    </span>
  );
}

export function StatusBar({ realityState }: StatusBarProps) {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 5_000);
    return () => window.clearInterval(timer);
  }, []);

  const encoding = getVisualEncoding(realityState);
  const timeInfo = formatUpdatedAt(realityState.timestamp, nowMs);
  const hasValidConfidence =
    typeof realityState.confidence === 'number' &&
    Number.isFinite(realityState.confidence);
  const isFailed =
    realityState.status === 'failed' ||
    realityState.status === 'timeout' ||
    realityState.status === 'rate_limited';
  const staleOrOffline =
    realityState.syncStatus === 'stale' ||
    (realityState.syncStatus === 'offline' && Boolean(realityState.timestamp));

  return (
    <section aria-label="现实识别状态卡片" className="card flex flex-col gap-3">
      {/* 第一行：主状态徽章（色底 + 线性 SVG 图标 + 中文文案）与数据来源徽章 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-pill font-semibold text-[15px]"
          style={{ backgroundColor: encoding.bg, color: encoding.fg }}
        >
          <BehaviorIcon
            behavior={realityState.behavior}
            failed={isFailed}
            staleOrOffline={staleOrOffline}
          />
          <span>当前状态：{encoding.title}</span>
        </div>

        <SourceBadge source={realityState.source} />
      </div>

      {/* 第二行：状态解释说明 */}
      <p className="text-[14px] text-ink-700 leading-[20px]">
        {encoding.subtitle}
      </p>

      {/* 第三行：更新时间、同步状态与条件展示的置信度（confidence === null 时严格隐藏） */}
      <div className="pt-2 border-t border-line-100 flex flex-wrap items-center justify-between gap-2 text-[12px] text-ink-500">
        <div className="flex items-center gap-2">
          <span>
            最后更新：
            <strong className="font-medium text-ink-700">
              {timeInfo.relative}
            </strong>
          </span>
          {realityState.timestamp && (
            <span className="text-ink-400">({timeInfo.exact})</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {realityState.status === 'low_confidence' && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-sm bg-brand-50 text-brand-600 font-medium">
              低置信度归为未知
            </span>
          )}

          {hasValidConfidence && realityState.confidence !== null && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-surface-2 text-ink-700 font-medium">
              模型参考置信度 {Math.round(realityState.confidence * 100)}%
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
