/**
 * 服务端档案恢复语义的回归测试（故障注入，全部在临时目录里做）
 *
 * 约定（来自 lib/db/index.ts L137）：null = 服务端确实没有档案；读取失败一律抛错，
 * 由页面进错误态。因此：
 *   - 只有 ENOENT 才能返回 null；
 *   - JSON 损坏 / 不符合现有 schema → 抛 PROFILE_UNREADABLE(409)，且保留原文件；
 *   - writeProfile 覆盖已有档案前，若读出来是坏档案 → 拒绝写入（不删除、不静默覆盖）。
 *
 * 隔离手法：mkdtemp + process.chdir（node --test 每个测试文件独立进程，chdir 不会影响
 * 其他测试文件），绝不触碰仓库里真实的 .pethome-data / 照片 / 签名密钥。
 */
import assert from 'node:assert/strict';
import { chdir, cwd } from 'node:process';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import test, { after, before } from 'node:test';

import { readProfile, validatePet, writeProfile } from './server/profile-store.ts';
import { jsonError } from './server/http.ts';
import type { Pet } from './types.ts';

const KEY = 'a'.repeat(64);
let workspace: string;
let profilesDir: string;
let originalCwd: string;

const validPet = (over: Partial<Pet> = {}): Pet => ({
  id: '11111111-2222-3333-4444-555555555555',
  ownerDeviceId: 'dev-1',
  name: '团子',
  type: 'cat',
  personality: 'lively',
  photoUrl: null,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-02T00:00:00.000Z',
  ...over,
});

/** 一个"当年存下来的 version 1 档案"，用来证明向后兼容没有被改坏 */
const version1Pet = (): Pet =>
  validPet({
    name: '豆豆',
    avatar: {
      version: 1,
      species: 'cat',
      coatColor: '#f2d7b6',
      patchColor: '#b98b5e',
      muzzleColor: '#fff7ec',
      eyeColor: '#4a8f6a',
      collarColor: '#e2896b',
      earShape: 'pointed',
      pattern: 'tuxedo',
      origin: 'manual',
      generatedAt: '2026-11-03T00:00:00.000Z',
      traits: {
        coatLength: 'short',
        bodyShape: 'round',
        facePattern: 'tabby',
        earShape: 'pointed',
        unknownFields: ['pattern'],
      },
    } as Pet['avatar'],
  });

const fileFor = (key: string) => join(profilesDir, `${key}.json`);
const readRaw = (key: string) => readFile(fileFor(key), 'utf8');

const isUnreadable = (error: unknown) => {
  const e = error as { code?: string; status?: number; message?: string };
  assert.equal(e.code, 'PROFILE_UNREADABLE');
  assert.equal(e.status, 409);
  assert.ok(typeof e.message === 'string' && e.message.length > 0);
  return true;
};

before(async () => {
  originalCwd = cwd();
  workspace = await mkdtemp(join(tmpdir(), 'pethome-profile-'));
  profilesDir = join(workspace, '.pethome-data', 'profiles');
  await mkdir(profilesDir, { recursive: true });
  chdir(workspace);
});

after(async () => {
  chdir(originalCwd);
  assert.equal(dirname(resolve(workspace)), resolve(tmpdir()));
  assert.ok(basename(workspace).startsWith('pethome-profile-'));
  await rm(workspace, { recursive: true, force: true });
});

test('ENOENT 才返回 null：没有档案时 readProfile 返回 null', async () => {
  assert.equal(await readProfile('b'.repeat(64)), null);
});

test('有效 version 1 档案读写往返保持不变（兼容性）', async () => {
  const pet = version1Pet();
  const key = await writeProfile(pet, null);
  assert.match(key, /^[a-f0-9]{64}$/);
  const back = await readProfile(key);
  assert.equal(back?.name, '豆豆');
  assert.equal(back?.avatar?.version, 1);
  assert.equal(back?.avatar?.origin, 'manual');
  assert.equal(back?.avatar?.pattern, 'tuxedo');
  assert.deepEqual(back?.avatar?.traits, pet.avatar?.traits);
  // 落盘内容必须能被现有 schema 重新解析（不允许写成"自己都读不回来"的形态）
  assert.ok(validatePet(JSON.parse(await readRaw(key))));
});

test('已有有效档案时可用写入更新（正常路径不受影响）', async () => {
  const key = await writeProfile(validPet(), null);
  const updated = await writeProfile(validPet({ name: '奶糖', updatedAt: '2026-11-05T00:00:00.000Z' }), key);
  assert.equal(updated, key);
  assert.equal((await readProfile(key))?.name, '奶糖');
});

test('JSON 损坏：readProfile 抛 PROFILE_UNREADABLE(409)，不返回 null', async () => {
  const key = 'c'.repeat(64);
  const broken = '{"id":"11111111-2222-3333-4444-555555555555",';
  await writeFile(fileFor(key), broken, 'utf8');
  await assert.rejects(() => readProfile(key), isUnreadable);
  assert.equal(await readRaw(key), broken, '读取失败不能改动原文件');
});

test('schema 不合法（合法 JSON，无效字段）：readProfile 抛 PROFILE_UNREADABLE(409)，不返回 null', async () => {
  const key = 'd'.repeat(64);
  const raw = JSON.stringify({ ...validPet(), name: '这个昵称明显超过了十二个字的上限' });
  await writeFile(fileFor(key), raw, 'utf8');
  await assert.rejects(() => readProfile(key), isUnreadable);
  assert.equal(await readRaw(key), raw, '读取失败不能改动原文件');
});

test('写入拒绝覆盖 JSON 损坏的已有档案，且原文件字节不变', async () => {
  const key = 'e'.repeat(64);
  const broken = 'not json at all';
  await writeFile(fileFor(key), broken, 'utf8');
  await assert.rejects(() => writeProfile(validPet({ name: '新档' }), key), isUnreadable);
  assert.equal(await readRaw(key), broken, '坏档案必须原样保留');
  const leftovers = (await readdir(profilesDir)).filter((f) => f.endsWith('.tmp'));
  assert.deepEqual(leftovers, [], '拒绝写入时不能留下临时文件');
});

test('写入拒绝覆盖 schema 不合法的已有档案，且原文件字节不变', async () => {
  const key = 'f'.repeat(64);
  const raw = JSON.stringify({ ...validPet(), type: 'dragon' });
  await writeFile(fileFor(key), raw, 'utf8');
  await assert.rejects(() => writeProfile(validPet({ name: '新档' }), key), isUnreadable);
  assert.equal(await readRaw(key), raw, '坏档案必须原样保留');
});

test('坏档案不会被删除，也不影响其他档案的读取', async () => {
  const good = await writeProfile(validPet(), null);
  const bad = '1'.repeat(64);
  await writeFile(fileFor(bad), '{{{', 'utf8');
  await assert.rejects(() => readProfile(bad), isUnreadable);
  assert.deepEqual(await readProfile(good), validPet());
  assert.ok((await readdir(profilesDir)).includes(`${bad}.json`), '坏档案文件必须仍在');
});

test('cookie 指向的档案文件缺失时允许新建（ENOENT 不阻塞写入）', async () => {
  const key = '2'.repeat(64);
  assert.equal(await readProfile(key), null);
  const written = await writeProfile(validPet(), key);
  assert.equal(written, key);
  assert.deepEqual(await readProfile(key), validPet());
});

test('错误经 jsonError 变成 409 + PROFILE_UNREADABLE（前端能进重试态，而不是"没有宠物"）', async () => {
  const key = '3'.repeat(64);
  await writeFile(fileFor(key), '{"broken":', 'utf8');
  const error = await readProfile(key).then(
    () => null,
    (e: unknown) => e,
  );
  assert.ok(error, 'readProfile 必须抛错');
  const response = jsonError(error);
  assert.equal(response.status, 409);
  const body = await response.json();
  assert.equal(body.ok, false);
  assert.equal(body.error.code, 'PROFILE_UNREADABLE');
  assert.equal(body.error.retriable, false);
  assert.ok(String(body.error.message).length > 0);
});
