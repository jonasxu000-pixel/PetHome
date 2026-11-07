'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ErrorBanner from '@/components/common/ErrorBanner';
import { getDeviceId, getPet, newId, savePet } from '@/lib/db';
import { usePetStore } from '@/lib/store';
import { PERSONALITY_LABELS, PET_TYPE_LABELS } from '@/lib/constants';
import type { Personality, Pet, PetType } from '@/lib/types';

const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 原图上限 8MB
const TARGET_PHOTO_BYTES = 500 * 1024; // 压缩后 JPEG dataURL 上限 500KB
const NAME_MAX = 12;

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

export default function CreatePetPage() {
  const router = useRouter();
  const setPet = usePetStore((s) => s.setPet);

  const [checking, setChecking] = useState(true);
  const [existingPet, setExistingPet] = useState<Pet | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [petType, setPetType] = useState<PetType>('cat');
  const [personality, setPersonality] = useState<Personality>('lively');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const [compressing, setCompressing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const checkExisting = useCallback(async () => {
    setChecking(true);
    setLoadError(null);
    try {
      const pet = await getPet();
      setExistingPet(pet);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : '读取本地档案失败');
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void checkExisting();
  }, [checkExisting]);

  const trimmedName = name.trim();
  const nameInvalid = trimmedName.length === 0 || trimmedName.length > NAME_MAX;

  async function handlePickPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    if (!file.type.startsWith('image/')) {
      setError('请选择图片文件');
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError('图片超过 8MB，请换一张更小的图片');
      return;
    }
    setCompressing(true);
    try {
      const compressed = await compressToJpegDataUrl(file);
      setPhotoUrl(compressed);
    } catch (e) {
      setPhotoUrl(null);
      setError(e instanceof Error ? e.message : '照片处理失败');
    } finally {
      setCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || compressing) return;
    setError(null);
    if (nameInvalid) {
      setError(`名称需要 1-${NAME_MAX} 个字`);
      return;
    }
    setSaving(true);
    try {
      const deviceId = await getDeviceId();
      const now = new Date().toISOString();
      const pet: Pet = {
        id: newId(),
        ownerDeviceId: deviceId,
        name: trimmedName,
        type: petType,
        personality,
        photoUrl,
        createdAt: now,
        updatedAt: now,
      };
      await savePet(pet);
      setPet(pet);
      router.push('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败，请重试');
      setSaving(false);
    }
  }

  if (checking) {
    return (
      <main className="page-container">
        <h1 className="page-title">给宠物建个档</h1>
        <p className="muted-text">正在读取本地档案…</p>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="page-container">
        <h1 className="page-title">给宠物建个档</h1>
        <ErrorBanner message={loadError} onRetry={() => void checkExisting()} />
      </main>
    );
  }

  if (existingPet) {
    return (
      <main className="page-container">
        <h1 className="page-title">已有档案</h1>
        <div className="card">
          <p className="text-[15px] font-semibold" style={{ color: 'var(--ink-900)' }}>
            {existingPet.name} 已经建过档了
          </p>
          <p className="muted-text mt-2">本项目只支持一只宠物，已有档案不会被覆盖。</p>
          <div className="mt-4 flex gap-2">
            <Link className="btn-primary px-4 py-2 text-[14px]" href="/">
              回到首页
            </Link>
            <Link className="btn-secondary px-4 py-2 text-[14px]" href="/records">
              查看记录
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page-container">
      <h1 className="page-title">给宠物建个档</h1>
      <p className="muted-text mt-1">档案只存在这台设备的浏览器里，不会上传服务器。</p>

      <form className="card mt-4 flex flex-col gap-4" onSubmit={handleSubmit}>
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
          <p className="muted-text mt-1">{trimmedName.length}/{NAME_MAX} 字</p>
        </div>

        <div>
          <span className="field-label">类型</span>
          <div className="mt-1 flex gap-2">
            {(Object.keys(PET_TYPE_LABELS) as PetType[]).map((key) => {
              const active = petType === key;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={active}
                  className={active ? 'btn-primary flex-1 px-3 py-2 text-[14px]' : 'btn-secondary flex-1 px-3 py-2 text-[14px]'}
                  onClick={() => setPetType(key)}
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

        <div>
          <span className="field-label">照片（可选）</span>
          <div className="mt-1 flex items-center gap-3">
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
            <div className="flex flex-col gap-2">
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
                disabled={compressing}
                onClick={() => fileInputRef.current?.click()}
              >
                {compressing ? '压缩中…' : photoUrl ? '换一张' : '选择照片'}
              </button>
              {photoUrl ? (
                <button type="button" className="muted-text text-left" onClick={() => setPhotoUrl(null)}>
                  移除照片
                </button>
              ) : null}
            </div>
          </div>
          <p className="muted-text mt-1">支持 8MB 以内图片，会自动压缩为 500KB 以内的 JPEG。</p>
        </div>

        {error ? <ErrorBanner message={error} /> : null}

        <button type="submit" className="btn-primary mt-1 w-full py-3 text-[15px]" disabled={saving || compressing || nameInvalid}>
          {saving ? '保存中…' : '保存档案'}
        </button>
      </form>
    </main>
  );
}
