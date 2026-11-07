import type { Behavior, BehaviorInterval, RecognitionResult } from '../types';
import { SAMPLE_INTERVAL_SEC } from '../constants.ts';

/**
 * 时段合并（对齐 05 §5.7.1）
 * - 输入按 seq 升序（缺失 seq 时按 capturedAt）
 * - 相邻且 behavior 相同 → 合并
 * - startAt = 首帧 capturedAt；endAt = 末帧 capturedAt
 * - 单帧 durationSec = 采样间隔 4s（不能为 0）
 * - 多帧 durationSec = endAt - startAt
 * - avgConfidence = 组内非 null 的平均值，全 null → null
 * - failed/timeout/rate_limited 帧不产生行为，插入 eventType='interrupted'
 * - 连续 interrupted 合并为一条
 * - unknown 帧正常产生 behavior='unknown' 的 interval
 * - source / session 严格隔离，不跨 session 合并
 * - dayKey 使用上海时区（IndexedDB 没有 Postgres 生成列，必须在这里算）
 */

const FAILED_STATUSES = new Set<string>(['failed', 'timeout', 'rate_limited']);

const SHANGHAI_DAY_FMT = (() => {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return null;
  }
})();

/** 转成上海时区的 YYYY-MM-DD；无法解析返回空串 */
export function toShanghaiDayKey(input: string | number | Date): string {
  const date = input instanceof Date ? input : new Date(input);
  const ms = date.getTime();
  if (Number.isNaN(ms)) return '';
  if (SHANGHAI_DAY_FMT && typeof SHANGHAI_DAY_FMT.formatToParts === 'function') {
    const parts = SHANGHAI_DAY_FMT.formatToParts(date);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    const y = get('year');
    const m = get('month');
    const d = get('day');
    if (y && m && d) return `${y}-${m}-${d}`;
  }
  // 兜底：UTC+8 固定偏移（上海无夏令时）
  const shifted = new Date(ms + 8 * 3600 * 1000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 今天的上海日期键 */
export function todayDayKey(now: number = Date.now()): string {
  return toShanghaiDayKey(new Date(now));
}

function sortValue(frame: RecognitionResult, index: number): number {
  if (typeof frame.seq === 'number' && Number.isFinite(frame.seq)) return frame.seq;
  const t = Date.parse(frame.capturedAt ?? frame.timestamp ?? '');
  return Number.isNaN(t) ? index : t;
}

function isFailedFrame(frame: RecognitionResult): boolean {
  return FAILED_STATUSES.has(String(frame.status));
}

function bucketKey(frame: RecognitionResult): string {
  const session = frame.sessionId ?? 'nosession';
  const source = frame.source ?? 'unknown';
  return `${session}::${source}`;
}

type Group = {
  interrupted: boolean;
  behavior: Behavior | null;
  frames: RecognitionResult[];
};

function averageConfidence(frames: RecognitionResult[]): number | null {
  const values = frames
    .map((f) => f.confidence)
    .filter((c): c is number => typeof c === 'number' && Number.isFinite(c));
  if (values.length === 0) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  return Math.round((sum / values.length) * 1000) / 1000;
}

function buildInterval(
  group: Group,
  bucket: string,
  groupIndex: number,
): BehaviorInterval {
  const first = group.frames[0];
  const last = group.frames[group.frames.length - 1];
  const startAt = first.capturedAt ?? first.timestamp;
  const startMs = Date.parse(startAt);

  let endAt: string;
  let durationSec: number;
  if (group.frames.length === 1) {
    // 单帧：endAt 由 startAt + 采样间隔推出，保证 endAt - startAt 与 durationSec 自洽
    durationSec = SAMPLE_INTERVAL_SEC;
    endAt = Number.isNaN(startMs)
      ? (last.capturedAt ?? last.timestamp)
      : new Date(startMs + durationSec * 1000).toISOString();
  } else {
    endAt = last.capturedAt ?? last.timestamp;
    const endMs = Date.parse(endAt);
    const diff = Number.isNaN(startMs) || Number.isNaN(endMs) ? 0 : Math.round((endMs - startMs) / 1000);
    durationSec = Math.max(1, diff);
  }

  return {
    // 确定性 id：同一 session/source 重复合并结果稳定，配合 saveFrames 幂等
    id: `int_${bucket.replace(/[^a-zA-Z0-9_-]/g, '_')}_${groupIndex}`,
    petId: first.petId,
    sessionId: first.sessionId ?? null,
    eventType: group.interrupted ? 'interrupted' : 'behavior',
    behavior: group.interrupted ? null : group.behavior,
    startAt,
    endAt,
    durationSec,
    source: first.source,
    avgConfidence: group.interrupted ? null : averageConfidence(group.frames),
    sampleCount: group.frames.length,
    dayKey: toShanghaiDayKey(startAt),
    createdAt: new Date().toISOString(),
  };
}

function mergeBucket(bucket: string, frames: RecognitionResult[]): BehaviorInterval[] {
  const sorted = [...frames].sort((a, b) => {
    const av = sortValue(a, 0);
    const bv = sortValue(b, 0);
    if (av !== bv) return av - bv;
    return Date.parse(a.capturedAt ?? '') - Date.parse(b.capturedAt ?? '');
  });

  const groups: Group[] = [];
  for (const frame of sorted) {
    const failed = isFailedFrame(frame);
    const current = groups[groups.length - 1];
    if (failed) {
      if (current && current.interrupted) {
        current.frames.push(frame); // 连续中断合并为一条
      } else {
        groups.push({ interrupted: true, behavior: null, frames: [frame] });
      }
      continue;
    }
    const behavior: Behavior = frame.behavior ?? 'unknown';
    if (current && !current.interrupted && current.behavior === behavior) {
      current.frames.push(frame);
    } else {
      groups.push({ interrupted: false, behavior, frames: [frame] });
    }
  }

  return groups.map((group, index) => buildInterval(group, bucket, index));
}

/** 纯函数：把识别帧合并成生活记录时段（不写库） */
export function mergeFrames(frames: RecognitionResult[]): BehaviorInterval[] {
  if (!Array.isArray(frames) || frames.length === 0) return [];

  const valid = frames.filter(
    (f) => f && typeof f === 'object' && !Number.isNaN(Date.parse(f.capturedAt ?? f.timestamp ?? '')),
  );
  if (valid.length === 0) return [];

  const buckets = new Map<string, RecognitionResult[]>();
  for (const frame of valid) {
    const key = bucketKey(frame);
    const list = buckets.get(key);
    if (list) list.push(frame);
    else buckets.set(key, [frame]);
  }

  const result: BehaviorInterval[] = [];
  for (const [key, list] of buckets) {
    result.push(...mergeBucket(key, list));
  }

  result.sort((a, b) => {
    const d = Date.parse(a.startAt) - Date.parse(b.startAt);
    if (d !== 0) return d;
    return a.id.localeCompare(b.id);
  });
  return result;
}
