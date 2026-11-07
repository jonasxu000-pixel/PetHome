'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import EmptyState from '@/components/common/EmptyState';
import ErrorBanner from '@/components/common/ErrorBanner';
import { getPet, listIntervalsByDate } from '@/lib/db';
import { todayDayKey } from '@/lib/db/merge';
import { BEHAVIOR_LABELS, SOURCE_LABELS } from '@/lib/constants';
import type { BehaviorInterval, Pet } from '@/lib/types';

const TIME_FMT = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

const DAY_FMT = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'long',
});

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--:--';
  return TIME_FMT.format(d);
}

function formatDay(dayKey: string): string {
  const d = new Date(`${dayKey}T12:00:00+08:00`);
  if (Number.isNaN(d.getTime())) return dayKey;
  return DAY_FMT.format(d);
}

function formatDuration(totalSec: number): string {
  const sec = Math.max(0, Math.round(totalSec));
  if (sec < 60) return `${sec} 秒`;
  const minutes = Math.floor(sec / 60);
  const restSec = sec % 60;
  if (minutes < 60) return restSec > 0 ? `${minutes} 分 ${restSec} 秒` : `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const restMin = minutes % 60;
  return restMin > 0 ? `${hours} 小时 ${restMin} 分` : `${hours} 小时`;
}

function IntervalRow({ interval }: { interval: BehaviorInterval }) {
  const interrupted = interval.eventType === 'interrupted' || interval.behavior === null;
  const behavior = interval.behavior;
  const label = behavior === null ? '中断' : BEHAVIOR_LABELS[behavior];
  const isDemo = interval.source === 'preset';
  const sourceLabel = SOURCE_LABELS[interval.source] ?? interval.source;
  // 只为「有明确行为」的时段显示置信度：unknown 的分数不代表行为判断可信度，显示会误导
  const confidenceText =
    interrupted || behavior === null || behavior === 'unknown' || interval.avgConfidence === null
      ? null
      : `可信度 ${Math.round(interval.avgConfidence * 100)}%`;

  return (
    <li className="card flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[15px] font-semibold" style={{ color: 'var(--ink-900)' }}>
            {label}
          </span>
          {/* P0：每一条记录都必须标出来源，preset 额外加斜纹区分 */}
          <span
            className={isDemo ? 'badge-demo-stripe' : 'inline-flex items-center px-2 py-[2px] text-[12px]'}
            style={
              isDemo
                ? undefined
                : {
                    backgroundColor: 'var(--bg-surface-2)',
                    color: 'var(--ink-500)',
                    border: '1px solid var(--line-200)',
                    borderRadius: 'var(--r-pill)',
                  }
            }
          >
            {sourceLabel}
          </span>
        </div>
        <p className="muted-text mt-1">
          {formatTime(interval.startAt)} – {formatTime(interval.endAt)}
          {interrupted ? ' · 这段没识别清楚，不计入行为时长' : ''}
          {!interrupted && behavior === 'unknown' ? ' · 未识别到明确行为' : ''}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[14px]" style={{ color: 'var(--ink-900)' }}>
          {formatDuration(interval.durationSec)}
        </p>
        {confidenceText ? <p className="muted-text mt-1">{confidenceText}</p> : null}
      </div>
    </li>
  );
}

function IntervalSection({
  title,
  hint,
  intervals,
  emptyText,
}: {
  title: string;
  hint?: string;
  intervals: BehaviorInterval[];
  emptyText: string;
}) {
  return (
    <section className="mt-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[15px] font-semibold" style={{ color: 'var(--ink-900)' }}>
          {title}
        </h2>
        <span className="muted-text">{intervals.length} 段</span>
      </div>
      {hint ? <p className="muted-text mt-1">{hint}</p> : null}
      {intervals.length === 0 ? (
        <p className="muted-text mt-2">{emptyText}</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {intervals.map((interval) => (
            <IntervalRow key={interval.id} interval={interval} />
          ))}
        </ul>
      )}
    </section>
  );
}

export default function RecordsPage() {
  const dayKey = useMemo(() => todayDayKey(), []);
  const [pet, setPet] = useState<Pet | null>(null);
  const [intervals, setIntervals] = useState<BehaviorInterval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (targetDay: string) => {
    setLoading(true);
    setError(null);
    try {
      const [currentPet, list] = await Promise.all([getPet(), listIntervalsByDate(targetDay)]);
      setPet(currentPet);
      setIntervals(currentPet ? list.filter((item) => item.petId === currentPet.id) : list);
    } catch (e) {
      setIntervals([]);
      setError(e instanceof Error ? e.message : '读取本地记录失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(dayKey);
  }, [dayKey, load]);

  const realIntervals = useMemo(() => intervals.filter((item) => item.source !== 'preset'), [intervals]);
  const demoIntervals = useMemo(() => intervals.filter((item) => item.source === 'preset'), [intervals]);

  return (
    <main className="page-container">
      <h1 className="page-title">生活记录</h1>

      <div className="card mt-3 text-center">
        <p className="text-[14px] font-semibold" style={{ color: 'var(--ink-900)' }}>
          {pet ? `${pet.name} · 今天` : '今天'}
        </p>
        <p className="muted-text">{formatDay(dayKey)}</p>
      </div>

      {loading ? <p className="muted-text mt-4">正在读取本地记录…</p> : null}

      {!loading && error ? (
        <div className="mt-4">
          <ErrorBanner message={error} onRetry={() => void load(dayKey)} />
        </div>
      ) : null}

      {!loading && !error && !pet ? (
        <div className="mt-4">
          <EmptyState
            title="还没有宠物档案"
            description="先建一个档案，才会有它的生活记录。"
            action={
              <Link className="btn-primary px-4 py-2 text-[14px]" href="/create">
                去建档
              </Link>
            }
          />
        </div>
      ) : null}

      {!loading && !error && pet ? (
        <>
          <IntervalSection
            title="真实记录"
            intervals={realIntervals}
            emptyText="今天还没有真实识别记录，去首页拍一段视频试试。"
          />

          {demoIntervals.length > 0 ? (
            <IntervalSection
              title="演示数据"
              hint="以下是演示数据，来自示例片段，仅用于展示效果，不代表宠物今天真实行为。"
              intervals={demoIntervals}
              emptyText=""
            />
          ) : null}

          {realIntervals.length === 0 && demoIntervals.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                title="今天还没有记录"
                description="拍一段宠物视频，识别结果会按天记在这里。"
                action={
                  <Link className="btn-primary px-4 py-2 text-[14px]" href="/">
                    回到首页
                  </Link>
                }
              />
            </div>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
