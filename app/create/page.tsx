'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ErrorBanner from '@/components/common/ErrorBanner';
import { PetAvatar } from '@/components/pet/PetAvatar';
import { getDeviceId, getPet, newId, savePet } from '@/lib/db';
import { usePetStore } from '@/lib/store';
import { PERSONALITY_LABELS, PET_TYPE_LABELS } from '@/lib/constants';
import { avatarOriginLabel, defaultAvatar, validateAvatar } from '@/lib/avatar/profile';
import type { AvatarProfile, Personality, Pet, PetType } from '@/lib/types';

const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 原图上限 8MB
const TARGET_PHOTO_BYTES = 500 * 1024; // 压缩后 JPEG dataURL 上限 500KB
const NAME_MAX = 12;

const PATTERN_LABELS: Record<AvatarProfile['pattern'], string> = {
  solid: '纯色',
  tuxedo: '燕尾',
  spotted: '斑点',
};

const EAR_LABELS: Record<AvatarProfile['earShape'], string> = {
  floppy: '垂耳',
  pointed: '立耳',
};

function estimateDataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return dataUrl.length;
  const base64 = dataUrl.slice(comma + 1);
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('读取照片失败，请换一张图片'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('照片解析失败，请换一张图片'));
    img.src = src;
  });
}

/** 压缩成 JPEG dataURL（禁止存 objectURL，刷新后会失效） */
async function compressToJpegDataUrl(file: File): Promise<string> {
  const raw = await readFileAsDataUrl(file);
  const img = await loadImage(raw);
  const maxSides = [1024, 800, 640, 512];
  const qualities = [0.85, 0.75, 0.65, 0.55, 0.45];
  let best = '';

  for (const maxSide of maxSides) {
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
    const width = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
    const height = Math.max(1, Math.round((img.naturalHeight || 1) * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('当前浏览器无法处理图片');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    for (const quality of qualities) {
      const out = canvas.toDataURL('image/jpeg', quality);
      if (!best || estimateDataUrlBytes(out) < estimateDataUrlBytes(best)) best = out;
      if (estimateDataUrlBytes(out) <= TARGET_PHOTO_BYTES) return out;
    }
  }

  if (!best) throw new Error('照片压缩失败，请换一张图片');
  if (estimateDataUrlBytes(best) > TARGET_PHOTO_BYTES) {
    throw new Error('照片压缩后仍超过 500KB，请换一张更小的图片');
  }
  return best;
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function safeColor(value: string, fallback: string): string {
  return HEX_COLOR.test(value) ? value.toLowerCase() : fallback;
}

type SyncState = 'idle' | 'syncing' | 'ok' | 'failed';

export default function CreatePetPage() {
  const router = useRouter();
  const setPet = usePetStore((s) => s.setPet);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [existingPet, setExistingPet] = useState<Pet | null>(null);

  const [name, setName] = useState('');
  const [petType, setPetType] = useState<PetType>('cat');
  const [personality, setPersonality] = useState<Personality>('lively');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<AvatarProfile | null>(null);

  const [compressing, setCompressing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateNotice, setGenerateNotice] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [savedPet, setSavedPet] = useState<Pet | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const generateAbortRef = useRef<AbortController | null>(null);
  /** 生成请求序号：只有最新一次的结果会被采纳，避免竞态写入旧 avatar */
  const genSeqRef = useRef(0);

  const loadExisting = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const pet = await getPet();
      setExistingPet(pet);
      if (pet) {
        setName(pet.name);
        setPetType(pet.type);
        setPersonality(pet.personality);
        setPhotoUrl(pet.photoUrl ?? null);
        const safeAvatar = validateAvatar(pet.avatar);
        setAvatar(safeAvatar ?? null);
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : '读取本地档案失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadExisting();
  }, [loadExisting]);

  useEffect(() => {
    return () => {
      generateAbortRef.current?.abort();
    };
  }, []);

  const trimmedName = name.trim();
  const nameInvalid = trimmedName.length === 0 || trimmedName.length > NAME_MAX;
  const previewAvatar = avatar ?? defaultAvatar(petType);

  /** 手动改外观：origin 记为 manual，model 置空（不再是模型产物） */
  function applyManual(patch: Partial<AvatarProfile>) {
    // 用户开始手动调色即视为接管，作废在途生成，避免覆盖手改结果
    if (generating) cancelGenerate();
    setAvatar((prev) => {
      const base = prev ?? defaultAvatar(petType);
      const next: AvatarProfile = {
        ...base,
        ...patch,
        origin: 'manual',
        model: null,
        generatedAt: new Date().toISOString(),
      };
      return validateAvatar(next) ?? base;
    });
    setGenerateNotice(null);
  }

  function changePetType(next: PetType) {
    // 类型变了，旧类型算出来的在途结果不能再用
    cancelGenerate();
    setPetType(next);
    setAvatar((prev) => {
      if (!prev) return prev;
      // 用户改了 species 也是人工改动：origin=manual、model=null，
      // 交给 validateAvatar 自动丢弃原有的 AI 签名（非 AI 来源不应带 verification）
      const species: AvatarProfile['species'] = next === 'cat' ? 'cat' : 'dog';
      const nextAvatar: AvatarProfile = {
        ...prev,
        species,
        origin: 'manual',
        model: null,
        generatedAt: new Date().toISOString(),
      };
      return validateAvatar(nextAvatar) ?? prev;
    });
    setGenerateNotice(null);
  }

  function cancelGenerate() {
    // 递增序号让在途请求的结果作废，避免旧照片/旧类型的结果覆盖新状态
    genSeqRef.current += 1;
    generateAbortRef.current?.abort();
    generateAbortRef.current = null;
    setGenerating(false);
  }

  async function generateAvatar(source: string, type: PetType) {
    if (type === 'other') {
      setGenerateError('分身目前只支持猫和狗，可先选一种类型再生成，或直接手动调色。');
      return;
    }
    // 先作废旧请求，再发起新请求：同一时刻只认最新一次结果
    genSeqRef.current += 1;
    const seq = genSeqRef.current;
    generateAbortRef.current?.abort();
    const controller = new AbortController();
    generateAbortRef.current = controller;
    setGenerating(true);
    setGenerateError(null);
    setGenerateNotice(null);
    try {
      const mod = await import('@/lib/avatar/client');
      if (typeof mod.createAvatarFromPhoto !== 'function') {
        throw new Error('分身生成能力尚未就绪，可先手动调整外观');
      }
      const result = await mod.createAvatarFromPhoto(source, type, controller.signal);
      if (seq !== genSeqRef.current) return; // 已被新照片/新类型取代，丢弃旧结果
      const safe = validateAvatar(result?.avatar);
      if (!safe) throw new Error('生成的分身数据不合法，已保留原有外观');
      setAvatar(safe);
      setGenerateNotice(result.notice ?? null);
    } catch (e) {
      if (seq !== genSeqRef.current) return; // 过期失败不打扰用户
      if (controller.signal.aborted) {
        // 用户主动取消：保持现状，不报错、不伪造结果
      } else {
        setGenerateError(e instanceof Error ? e.message : '分身生成失败，可先手动调整外观');
      }
    } finally {
      if (seq === genSeqRef.current) {
        generateAbortRef.current = null;
        setGenerating(false);
      }
    }
  }

  async function handlePickPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    // 换图即作废上一张图在途的生成结果
    cancelGenerate();
    setGenerateError(null);
    setGenerateNotice(null);
    if (!file.type.startsWith('image/')) {
      setGenerateError('请选择图片文件');
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setGenerateError('图片超过 8MB，请换一张更小的图片');
      return;
    }
    setCompressing(true);
    try {
      const compressed = await compressToJpegDataUrl(file);
      setPhotoUrl(compressed);
      setCompressing(false);
      if (petType === 'other') {
        setGenerateError('分身目前只支持猫和狗，可先选一种类型再生成，或直接手动调色。');
        return;
      }
      await generateAvatar(compressed, petType);
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : '照片处理失败');
    } finally {
      setCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function buildPet(): Pet {
    const now = new Date().toISOString();
    const safeAvatar = validateAvatar(avatar);
    const base: Pet = existingPet ?? {
      id: newId(),
      ownerDeviceId: '',
      name: '',
      type: petType,
      personality,
      photoUrl: null,
      createdAt: now,
      updatedAt: now,
    };
    return {
      ...base,
      // 编辑模式保留原 id / createdAt / 记录归属，绝不生成新宠物覆盖
      id: existingPet?.id ?? base.id,
      createdAt: existingPet?.createdAt ?? base.createdAt,
      name: trimmedName,
      type: petType,
      personality,
      photoUrl,
      updatedAt: now,
      ...(safeAvatar ? { avatar: safeAvatar } : {}),
    };
  }

  async function syncToServer(pet: Pet): Promise<boolean> {
    setSyncState('syncing');
    setSyncError(null);
    try {
      const mod = await import('@/lib/avatar/client');
      if (typeof mod.saveProfileToServer !== 'function') {
        throw new Error('服务端同步能力尚未就绪');
      }
      await mod.saveProfileToServer(pet);
      setSyncState('ok');
      return true;
    } catch {
      setSyncState('failed');
      setSyncError('已保存在此设备，服务端同步失败，可重试。');
      return false;
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // 生成中禁止保存：避免「新照片 + 旧 avatar」被一起写入
    if (saving || compressing || generating) return;
    setSaveError(null);
    if (nameInvalid) {
      setSaveError(`名称需要 1-${NAME_MAX} 个字`);
      return;
    }
    setSaving(true);
    try {
      const deviceId = existingPet?.ownerDeviceId || (await getDeviceId());
      const pet: Pet = { ...buildPet(), ownerDeviceId: deviceId };
      // 先落本地，保证网络/服务端出问题时成果不丢
      await savePet(pet);
      setSavedPet(pet);
      setPet(pet);

      const synced = await syncToServer(pet);
      if (synced) router.push('/');
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : '保存失败，请重试');
    } finally {
      setSaving(false);
    }
  }

  async function retrySync() {
    if (!savedPet || syncState === 'syncing') return;
    const synced = await syncToServer(savedPet);
    if (synced) router.push('/');
  }

  if (loading) {
    return (
      <main className="page-container">
        <h1 className="page-title">创建 / 定制我的分身</h1>
        <p className="muted-text">正在读取本地档案…</p>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="page-container">
        <h1 className="page-title">创建 / 定制我的分身</h1>
        <ErrorBanner message={loadError} onRetry={() => void loadExisting()} />
      </main>
    );
  }

  const isEdit = Boolean(existingPet);
  const needsAvatarUpgrade = isEdit && !validateAvatar(existingPet?.avatar);

  return (
    <main className="page-container">
      <h1 className="page-title">{isEdit ? '定制我的分身' : '创建我的分身'}</h1>
      <p className="muted-text mt-1">
        {isEdit
          ? '已有档案可以继续编辑外观，原有的生活记录会保留。'
          : '档案与分身只存在这台设备的浏览器里，并尝试同步到本机服务端。'}
      </p>

      <form className="mt-4 flex flex-col gap-4" onSubmit={handleSubmit}>
        <section className="card flex flex-col gap-4">
          <div>
            <label className="field-label" htmlFor="pet-name">
              名字
            </label>
            <input
              id="pet-name"
              className="input-field mt-1 w-full"
              value={name}
              maxLength={NAME_MAX}
              placeholder="例如：奶糖"
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
            />
            <p className="muted-text mt-1">
              {trimmedName.length}/{NAME_MAX} 字
            </p>
          </div>

          <div>
            <span className="field-label">类型</span>
            <div className="mt-1 flex gap-2">
              {(Object.keys(PET_TYPE_LABELS) as PetType[])
                .filter((key) => key !== 'other' || existingPet?.type === 'other')
                .map((key) => {
                  const active = petType === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={active}
                      className={active ? 'btn-primary flex-1 px-3 py-2 text-[14px]' : 'btn-secondary flex-1 px-3 py-2 text-[14px]'}
                      onClick={() => changePetType(key)}
                    >
                      {PET_TYPE_LABELS[key]}
                    </button>
                  );
                })}
            </div>
          </div>

          <div>
            <span className="field-label">性格</span>
            <div className="mt-1 flex gap-2">
              {(Object.keys(PERSONALITY_LABELS) as Personality[]).map((key) => {
                const active = personality === key;
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={active}
                    className={active ? 'btn-primary flex-1 px-3 py-2 text-[14px]' : 'btn-secondary flex-1 px-3 py-2 text-[14px]'}
                    onClick={() => setPersonality(key)}
                  >
                    {PERSONALITY_LABELS[key]}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="card flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="field-label">真实照片（可选）</span>
            <span className="muted-text">≤8MB，自动压到 500KB 内</span>
          </div>

          {/* 上传前必须让用户看到：照片会被发送到配置的 AI 视觉服务 */}
          <p className="muted-text">照片用于读取外观（毛色/花纹/耳型等），会发送至所配置的 AI 服务，不做其他用途。</p>

          <div className="flex items-center gap-3">
            <div
              className="flex h-16 w-16 items-center justify-center overflow-hidden text-[20px]"
              style={{ backgroundColor: 'var(--bg-surface-2)', borderRadius: 'var(--r-md)' }}
            >
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoUrl} alt="宠物照片预览" className="h-full w-full object-cover" />
              ) : (
                <span aria-hidden="true">🐾</span>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <input
                ref={fileInputRef}
                id="pet-photo"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePickPhoto}
              />
              <button
                type="button"
                className="btn-secondary px-3 py-2 text-[13px]"
                disabled={compressing || generating}
                onClick={() => fileInputRef.current?.click()}
              >
                {compressing ? '压缩中…' : photoUrl ? '换一张照片' : '选择照片'}
              </button>
              <div className="flex flex-wrap gap-2">
                {photoUrl ? (
                  <button
                    type="button"
                    className="btn-secondary px-3 py-2 text-[13px]"
                    disabled={generating || compressing || petType === 'other'}
                    onClick={() => void generateAvatar(photoUrl, petType)}
                  >
                    用这张照片生成分身
                  </button>
                ) : null}
                {generating ? (
                  <button type="button" className="btn-secondary px-3 py-2 text-[13px]" onClick={cancelGenerate}>
                    取消生成
                  </button>
                ) : null}
                {photoUrl ? (
                  <button
                    type="button"
                    className="muted-text text-left"
                    onClick={() => {
                      cancelGenerate();
                      setPhotoUrl(null);
                      setGenerateNotice(null);
                      setGenerateError(null);
                    }}
                  >
                    移除照片
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {generating ? <p className="muted-text">正在根据照片生成分身…</p> : null}
          {generateNotice ? <p className="muted-text">{generateNotice}</p> : null}
          {generateError ? (
            <ErrorBanner
              message={generateError}
              onRetry={
                photoUrl && petType !== 'other' ? () => void generateAvatar(photoUrl, petType) : undefined
              }
            />
          ) : null}
          {needsAvatarUpgrade && !generating ? (
            <p className="muted-text">这只宠物还没有分身外观：可上传照片生成，或直接手动调整下面的颜色。</p>
          ) : null}
        </section>

        <section className="card flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[15px] font-semibold" style={{ color: 'var(--ink-900)' }}>
              分身外观
            </h2>
            <span className="muted-text">{avatarOriginLabel(previewAvatar)}</span>
          </div>

          <div className="flex flex-col items-center gap-2">
            <div
              className="h-[180px] w-[180px]"
              style={{ backgroundColor: 'var(--bg-surface-2)', borderRadius: 'var(--r-md)' }}
            >
              {/* 与房间内同一个分身角色组件（A 的 PetAvatar，默认 behavior=unknown / overlay=null / 非交互） */}
              <PetAvatar avatar={previewAvatar} />
            </div>
            <p className="muted-text text-center text-[12px]">
              毛色 {previewAvatar.coatColor} · 花纹 {PATTERN_LABELS[previewAvatar.pattern]} · 耳型{' '}
              {EAR_LABELS[previewAvatar.earShape]} · 眼睛 {previewAvatar.eyeColor} · 项圈{' '}
              {previewAvatar.collarColor}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="field-label">毛色</span>
              <input
                type="color"
                className="h-9 w-full"
                value={safeColor(previewAvatar.coatColor, '#C8A27A')}
                onChange={(e) => applyManual({ coatColor: safeColor(e.target.value, previewAvatar.coatColor) })}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="field-label">眼睛颜色</span>
              <input
                type="color"
                className="h-9 w-full"
                value={safeColor(previewAvatar.eyeColor, '#3B3128')}
                onChange={(e) => applyManual({ eyeColor: safeColor(e.target.value, previewAvatar.eyeColor) })}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="field-label">项圈颜色</span>
              <input
                type="color"
                className="h-9 w-full"
                value={safeColor(previewAvatar.collarColor, '#7FA98B')}
                onChange={(e) => applyManual({ collarColor: safeColor(e.target.value, previewAvatar.collarColor) })}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="field-label">口鼻颜色</span>
              <input
                type="color"
                className="h-9 w-full"
                value={safeColor(previewAvatar.muzzleColor, '#F4E4D4')}
                onChange={(e) => applyManual({ muzzleColor: safeColor(e.target.value, previewAvatar.muzzleColor) })}
              />
            </label>
          </div>

          <div>
            <span className="field-label">耳型</span>
            <div className="mt-1 flex gap-2">
              {(Object.keys(EAR_LABELS) as AvatarProfile['earShape'][]).map((key) => {
                const active = previewAvatar.earShape === key;
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={active}
                    className={active ? 'btn-primary flex-1 px-3 py-2 text-[14px]' : 'btn-secondary flex-1 px-3 py-2 text-[14px]'}
                    onClick={() => applyManual({ earShape: key })}
                  >
                    {EAR_LABELS[key]}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <span className="field-label">花纹</span>
            <div className="mt-1 flex gap-2">
              {(Object.keys(PATTERN_LABELS) as AvatarProfile['pattern'][]).map((key) => {
                const active = previewAvatar.pattern === key;
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={active}
                    className={active ? 'btn-primary flex-1 px-3 py-2 text-[14px]' : 'btn-secondary flex-1 px-3 py-2 text-[14px]'}
                    onClick={() => applyManual({ pattern: key })}
                  >
                    {PATTERN_LABELS[key]}
                  </button>
                );
              })}
            </div>
            {previewAvatar.pattern !== 'solid' ? (
              <label className="mt-2 flex flex-col gap-1">
                <span className="field-label">花纹颜色</span>
                <input
                  type="color"
                  className="h-9 w-full"
                  value={safeColor(previewAvatar.patchColor, '#8C6A4A')}
                  onChange={(e) => applyManual({ patchColor: safeColor(e.target.value, previewAvatar.patchColor) })}
                />
              </label>
            ) : null}
          </div>
        </section>

        {saveError ? <ErrorBanner message={saveError} /> : null}
        {syncError ? <ErrorBanner message={syncError} onRetry={() => void retrySync()} /> : null}

        <button
          type="submit"
          className="btn-primary mt-1 w-full py-3 text-[15px]"
          disabled={saving || compressing || generating || nameInvalid || syncState === 'syncing'}
        >
          {generating
            ? '分身生成中，稍候可保存…'
            : saving || syncState === 'syncing'
              ? '保存中…'
              : isEdit
                ? '保存修改'
                : '保存档案'}
        </button>

        <div className="flex justify-center gap-3">
          <Link className="muted-text" href="/">
            回到首页
          </Link>
          <Link className="muted-text" href="/records">
            查看记录
          </Link>
        </div>
      </form>
    </main>
  );
}
