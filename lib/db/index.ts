import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { BehaviorInterval, Pet, RecognitionResult } from '../types';
import { mergeFrames, toShanghaiDayKey } from './merge.ts';

/**
 * PetHome 本地持久层（IndexedDB）
 * 07 §0 已覆盖 04/05 的 Supabase + Postgres 方案：本项目无服务端数据库，
 * 4 个对象仓库：pets / intervals / frames / meta。
 * 05 的 SQL 字段仅作为 JS 对象形状参考，day_key 生成列改为前端按上海时区计算。
 */

export const DB_NAME = 'pethome';
export const DB_VERSION = 1;

export type StoredFrame = RecognitionResult & { id: string };

type MetaRecord = { key: string; value: string };

interface PetHomeDB extends DBSchema {
  pets: { key: string; value: Pet };
  intervals: {
    key: string;
    value: BehaviorInterval;
    indexes: { 'by-day': string; 'by-session': string };
  };
  frames: {
    key: string;
    value: StoredFrame;
    indexes: { 'by-session': string };
  };
  meta: { key: string; value: MetaRecord };
}

let dbPromise: Promise<IDBPDatabase<PetHomeDB>> | null = null;

function getDB(): Promise<IDBPDatabase<PetHomeDB>> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('当前浏览器不支持本地存储（IndexedDB）'));
  }
  if (!dbPromise) {
    dbPromise = openDB<PetHomeDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('pets')) {
          db.createObjectStore('pets', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('intervals')) {
          const store = db.createObjectStore('intervals', { keyPath: 'id' });
          store.createIndex('by-day', 'dayKey');
          store.createIndex('by-session', 'sessionId');
        }
        if (!db.objectStoreNames.contains('frames')) {
          const store = db.createObjectStore('frames', { keyPath: 'id' });
          store.createIndex('by-session', 'sessionId');
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      },
      blocked() {
        dbPromise = null;
      },
      terminated() {
        dbPromise = null;
      },
    }).catch((err: unknown) => {
      // 打开失败（隐私模式/配额异常等）时不要缓存 rejected promise，否则后续永远失败
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

/** 不安全上下文（http + 局域网 IP）下 crypto.randomUUID 可能不存在，这里做兜底 */
export function newId(): string {
  const cryptoObj: Crypto | undefined = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return cryptoObj.randomUUID();
  }
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    const bytes = cryptoObj.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** 设备 ID：仅用于本地归属（无服务端账号体系） */
export async function getDeviceId(): Promise<string> {
  const db = await getDB();
  const existing = await db.get('meta', 'deviceId');
  if (existing && typeof existing.value === 'string' && existing.value.length > 0) {
    return existing.value;
  }
  const deviceId = newId();
  await db.put('meta', { key: 'deviceId', value: deviceId });
  return deviceId;
}

/** 建档：写入 pets 并记住当前宠物（单宠物，不做覆盖删除） */
export async function savePet(pet: Pet): Promise<string> {
  const db = await getDB();
  const tx = db.transaction(['pets', 'meta'], 'readwrite');
  await tx.objectStore('pets').put(pet);
  await tx.objectStore('meta').put({ key: 'currentPetId', value: pet.id });
  await tx.done;
  return pet.id;
}

/** 读取当前宠物；meta 丢失时回落到 pets 里最近创建的一条 */
export async function getPet(): Promise<Pet | null> {
  const db = await getDB();
  const current = await db.get('meta', 'currentPetId');
  if (current && current.value) {
    const pet = await db.get('pets', current.value);
    if (pet) return pet;
  }
  const all = await db.getAll('pets');
  if (all.length === 0) return null;
  all.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return all[0] ?? null;
}

function frameKey(frame: RecognitionResult): string {
  const session = frame.sessionId ?? 'nosession';
  const seq = typeof frame.seq === 'number' && Number.isFinite(frame.seq) ? String(frame.seq) : frame.capturedAt ?? frame.timestamp;
  return `${session}:${seq}`;
}

function sessionOf(frame: RecognitionResult): string {
  return frame.sessionId ?? 'nosession';
}

/**
 * 保存一批识别帧并重新合并该 session 的时段。
 * - 单事务（frames + intervals）
 * - 按 sessionId + seq 幂等：同一帧重复写入是覆盖，不会重复计数
 * - 每次合并读取该 session 在库内的全部帧（含历史），因此分批调用不会丢历史
 * - 只重写受影响 session 的 interval，不触碰其他 session / 演示数据
 */
export async function saveFrames(frames: RecognitionResult[]): Promise<void> {
  if (!Array.isArray(frames) || frames.length === 0) return;
  const db = await getDB();
  const tx = db.transaction(['frames', 'intervals'], 'readwrite');
  const frameStore = tx.objectStore('frames');
  const intervalStore = tx.objectStore('intervals');

  const touched = new Map<string, Set<string>>(); // sessionId -> source 集合
  for (const frame of frames) {
    if (!frame || typeof frame !== 'object') continue;
    await frameStore.put({ ...frame, id: frameKey(frame) });
    const session = sessionOf(frame);
    const sources = touched.get(session) ?? new Set<string>();
    sources.add(frame.source ?? 'unknown');
    touched.set(session, sources);
  }

  const allFrames = await frameStore.getAll();
  const allIntervals = await intervalStore.getAll();

  for (const [session, sources] of touched) {
    const sessionFrames = allFrames.filter((f) => sessionOf(f) === session && sources.has(f.source ?? 'unknown'));
    const merged = mergeFrames(sessionFrames);

    for (const interval of allIntervals) {
      const sameSession = (interval.sessionId ?? 'nosession') === session;
      const sameSource = sources.has(interval.source ?? 'unknown');
      if (sameSession && sameSource) await intervalStore.delete(interval.id);
    }

    for (const interval of merged) await intervalStore.put(interval);
  }

  await tx.done;
}

/** 按上海日期取当天时段（升序） */
export async function listIntervalsByDate(date: string): Promise<BehaviorInterval[]> {
  const db = await getDB();
  const dayKey = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : toShanghaiDayKey(date);
  const list = await db.getAllFromIndex('intervals', 'by-day', dayKey);
  return list.sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt) || a.id.localeCompare(b.id));
}

/** 最近一条时段（首页恢复"最后已知状态"用） */
export async function getLatestInterval(): Promise<BehaviorInterval | null> {
  const db = await getDB();
  const all = await db.getAll('intervals');
  if (all.length === 0) return null;
  let latest = all[0];
  for (const interval of all) {
    if (Date.parse(interval.endAt) > Date.parse(latest.endAt)) latest = interval;
  }
  return latest;
}
