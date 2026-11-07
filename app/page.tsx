'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { PetStage } from '@/components/pet/PetStage';
import { CozyRoomScene } from '@/components/world/CozyRoomScene';
import {
  type SheetMode,
  WorldDrawerSheet,
} from '@/components/world/WorldDrawerSheet';
import { analyzeVideo } from '@/lib/ai/client';
import { avatarOriginLabel } from '@/lib/avatar/profile';
import {
  BEHAVIOR_LABELS,
  MAX_VIDEO_BYTES,
  PERSONALITY_LABELS,
  PET_TYPE_LABELS,
  SOURCE_LABELS,
} from '@/lib/constants';
import { getLatestInterval, getPet } from '@/lib/db';
import { usePetStore } from '@/lib/store';
import type { Behavior, RealityState } from '@/lib/types';

const NIGHT_PREF_KEY = 'pethome:night-mode';

function getCapsuleTone(
  behavior: Behavior,
  syncStatus: RealityState['syncStatus'],
  status: RealityState['status']
): { bg: string; fg: string; label: string } {
  const isFailed =
    status === 'failed' || status === 'timeout' || status === 'rate_limited';
  if (isFailed) {
    return {
      bg: 'var(--state-failed-bg)',
      fg: 'var(--state-failed)',
      label: status === 'rate_limited' ? '请求受限' : '识别异常',
    };
  }
  if (syncStatus === 'offline' && behavior !== 'unknown') {
    return {
      bg: 'var(--state-offline-bg)',
      fg: 'var(--state-offline)',
      label: `上次 · ${BEHAVIOR_LABELS[behavior]}`,
    };
  }
  switch (behavior) {
    case 'sleeping':
      return {
        bg: 'var(--state-sleeping-bg)',
        fg: 'var(--state-sleeping)',
        label: BEHAVIOR_LABELS.sleeping,
      };
    case 'walking':
      return {
        bg: 'var(--state-walking-bg)',
        fg: 'var(--state-walking)',
        label: BEHAVIOR_LABELS.walking,
      };
    case 'eating':
      return {
        bg: 'var(--state-eating-bg)',
        fg: 'var(--state-eating)',
        label: BEHAVIOR_LABELS.eating,
      };
    case 'playing':
      return {
        bg: 'var(--state-playing-bg)',
        fg: 'var(--state-playing)',
        label: BEHAVIOR_LABELS.playing,
      };
    case 'unknown':
    default:
      return {
        bg: 'var(--state-unknown-bg)',
        fg: 'var(--state-unknown)',
        label: BEHAVIOR_LABELS.unknown,
      };
  }
}

export default function HomePage() {
  const pet = usePetStore((s) => s.pet);
  const hydrated = usePetStore((s) => s.hydrated);
  const realityState = usePetStore((s) => s.realityState);
  const overlay = usePetStore((s) => s.overlay);
  const busy = usePetStore((s) => s.busy);
  const progress = usePetStore((s) => s.progress);
  const error = usePetStore((s) => s.error);
  const videoName = usePetStore((s) => s.videoName);

  const restore = usePetStore((s) => s.restore);
  const setOverlay = usePetStore((s) => s.setOverlay);
  const tick = usePetStore((s) => s.tick);
  const setError = usePetStore((s) => s.setError);
  const setVideoName = usePetStore((s) => s.setVideoName);
  const getDisplayAnimation = usePetStore((s) => s.getDisplayAnimation);

  const [nightMode, setNightMode] = useState(false);
  const [sheetMode, setSheetMode] = useState<SheetMode>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 1. 初始化恢复本地宠物档案与最近行为区间 + 昼夜光影偏好
  useEffect(() => {
    try {
      const savedNight = window.localStorage.getItem(NIGHT_PREF_KEY);
      if (savedNight === '1') {
        setNightMode(true);
      }
    } catch {
      // ignore
    }

    let active = true;
    (async () => {
      try {
        const [storedPet, latestInterval] = await Promise.all([
          getPet(),
          getLatestInterval(),
        ]);
        if (active) {
          restore(storedPet, latestInterval);
        }
      } catch (err) {
        if (active) {
          restore(null, null);
          setError(
            err instanceof Error
              ? `读取本地档案失败：${err.message}`
              : '读取本地档案失败'
          );
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [restore, setError]);

  // 2. 定时推进状态机与清理过期互动覆盖层
  useEffect(() => {
    const timer = window.setInterval(() => {
      tick();
    }, 250);
    return () => window.clearInterval(timer);
  }, [tick]);

  // 3. 本地视频预览 URL 生命周期管理
  useEffect(() => {
    return () => {
      if (videoPreviewUrl) {
        URL.revokeObjectURL(videoPreviewUrl);
      }
    };
  }, [videoPreviewUrl]);

  const toggleNightMode = () => {
    setNightMode((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(NIGHT_PREF_KEY, next ? '1' : '0');
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setError(null);

    if (!file) {
      return;
    }

    if (file.size > MAX_VIDEO_BYTES) {
      const maxMb = Math.round(MAX_VIDEO_BYTES / (1024 * 1024));
      setError(`视频文件超过 ${maxMb}MB 上限，请选择更短的宠物视频片段`);
      e.target.value = '';
      setSheetMode('video');
      return;
    }

    if (videoPreviewUrl) {
      URL.revokeObjectURL(videoPreviewUrl);
    }
    const nextUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setVideoName(file.name);
    setVideoPreviewUrl(nextUrl);
    setSheetMode('video');
  };

  const handleStartAnalyze = async () => {
    if (!pet) {
      setError('请先创建宠物档案后再开始视频识别');
      return;
    }
    if (!selectedFile) {
      setError('请先选择一段本地宠物视频');
      return;
    }

    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await analyzeVideo(selectedFile, { signal: controller.signal });
    } catch (err) {
      if (controller.signal.aborted) {
        return;
      }
      setError(
        err instanceof Error ? err.message : '视频分析中断，请稍后重试'
      );
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  };

  const handleCancelAnalyze = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  };

  const displayAnimation = getDisplayAnimation();
  const capsuleTone = getCapsuleTone(
    realityState.behavior,
    realityState.syncStatus,
    realityState.status
  );
  const progressPercent =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.current / progress.total) * 100))
      : 0;

  return (
    <div className="w-full min-h-[100dvh] sm:py-4 flex items-center justify-center bg-surface-1 overflow-hidden">
      <div className="w-full max-w-[480px] h-[100dvh] sm:h-auto">
        {/* 隐藏文件选择器 */}
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime,video/*"
          onChange={handleFileChange}
          className="hidden"
          aria-label="选择本地宠物视频文件"
        />

        {/* ==================== 100dvh 全屏沉浸数字小屋 ==================== */}
        <CozyRoomScene nightMode={nightMode}>
          {/* 1. 上部 18% 留白区 HUD：宠物名字/分身来源 + 现实状态胶囊 + 未建档引导条 */}
          <div className="relative z-20 flex flex-col gap-2">
            {realityState.source === 'preset' && (
              <div
                role="status"
                className="badge-demo-stripe rounded-pill px-3 py-1 text-[11px] font-medium text-center"
              >
                当前为预设演示数据，非真实视频实时识别结果
              </div>
            )}

            <div className="w-full flex items-start justify-between gap-2">
              {/* 左上：宠物名字与分身标签 */}
              <div className="inline-flex flex-col px-3 py-1.5 rounded-lg bg-surface-0/90 backdrop-blur-md border border-line-200 shadow-1 min-w-0 max-w-[60%]">
                <div className="flex items-center gap-1.5">
                  <span className="text-[15px] font-semibold text-ink-900 truncate">
                    {pet ? pet.name : '通用猫咪分身'}
                  </span>
                  {pet ? (
                    <span className="px-1.5 py-0.5 rounded-pill text-[11px] font-medium bg-brand-50 text-brand-600 whitespace-nowrap shrink-0">
                      {PET_TYPE_LABELS[pet.type]} ·{' '}
                      {PERSONALITY_LABELS[pet.personality]}
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded-pill text-[11px] font-medium bg-surface-2 text-ink-700 whitespace-nowrap shrink-0">
                      通用分身
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-ink-500 truncate mt-0.5">
                  {pet
                    ? avatarOriginLabel(pet.avatar)
                    : '通用分身 · 创建你的宠物定制外观'}
                </span>
              </div>

              {/* 右上：真实识别状态胶囊（点击展开状态详情与说明抽屉） */}
              <button
                type="button"
                onClick={() => setSheetMode('status')}
                aria-label={`当前现实状态：${capsuleTone.label}，点击查看状态详情`}
                className="inline-flex flex-col items-end px-3 py-1.5 rounded-lg bg-surface-0/90 backdrop-blur-md border border-line-200 shadow-1 cursor-pointer hover:border-brand-400 transition-colors shrink-0"
              >
                <span
                  className="inline-flex items-center gap-1.5 text-[13px] font-semibold whitespace-nowrap"
                  style={{ color: capsuleTone.fg }}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: capsuleTone.fg }}
                  />
                  <span>{capsuleTone.label}</span>
                </span>
                <span className="text-[10px] text-ink-500 mt-0.5 whitespace-nowrap">
                  {realityState.source
                    ? `${SOURCE_LABELS[realityState.source]} · 详情`
                    : '状态详情'}
                </span>
              </button>
            </div>

            {/* 未建档时的顶部轻巧主 CTA 条（不遮挡下方拱窗与地毯角色） */}
            {hydrated && !pet && (
              <div className="px-3 py-2 rounded-lg bg-surface-0/92 backdrop-blur-md border border-brand-200 shadow-1 flex items-center justify-between gap-2">
                <span className="text-[12px] font-medium text-ink-700 truncate">
                  通用分身，上传照片创建你的专属宠物
                </span>
                <Link
                  href="/create"
                  className="btn-primary !py-1 !px-3 !min-h-[32px] !text-[12px] whitespace-nowrap shrink-0"
                >
                  创建你的宠物
                </Link>
              </div>
            )}

            {/* 后台抽帧识别实时进度浮条 */}
            {busy && (
              <button
                type="button"
                onClick={() => setSheetMode('video')}
                className="w-full px-3 py-1.5 rounded-pill bg-surface-0/95 backdrop-blur-md border border-brand-200 shadow-1 flex items-center justify-between gap-2 text-[12px] text-ink-900 cursor-pointer"
              >
                <span className="font-medium truncate">
                  正在同步视频帧：
                  {progress.total > 0
                    ? `${progress.current}/${progress.total} (${progressPercent}%)`
                    : '准备抽帧…'}
                </span>
                <span className="text-brand-600 font-semibold whitespace-nowrap shrink-0">
                  查看 →
                </span>
              </button>
            )}
          </div>

          {/* 2. 地毯中央分层 SVG 角色与底部 4 部位互动小 Dock */}
          <PetStage
            pet={pet}
            realityState={realityState}
            overlay={overlay}
            displayAnimation={displayAnimation}
            onSetOverlay={setOverlay}
          />

          {/* 3. 围绕角色左右两侧布置的 4 个精致圆形主功能按钮（分身 / 视频 / 记录 / 夜灯） */}
          <div
            aria-label="小屋左侧快捷操作"
            className="absolute left-3 bottom-[22%] z-30 pointer-events-auto flex flex-col gap-3"
          >
            {/* 左上圆钮：分身（前往 /create 定制或修改分身） */}
            <Link
              href="/create"
              aria-label={pet ? '定制或修改宠物分身' : '创建你的宠物分身'}
              className="w-[52px] h-[52px] rounded-full bg-surface-0/95 backdrop-blur-md border border-line-200 shadow-2 flex flex-col items-center justify-center gap-0.5 text-ink-900 hover:bg-brand-50 hover:border-brand-300 transition-colors cursor-pointer"
            >
              <svg
                viewBox="0 0 24 24"
                className="w-4 h-4 text-brand-600"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="8" r="4" />
                <path d="M5 20c1.5-4 12.5-4 14 0" />
              </svg>
              <span className="text-[10px] font-semibold leading-none whitespace-nowrap">
                分身
              </span>
            </Link>

            {/* 左下圆钮：同步视频（打开视频抽帧同步面板） */}
            <button
              type="button"
              onClick={() => setSheetMode('video')}
              aria-label="同步视频，上传本地宠物视频识别状态"
              className="w-[52px] h-[52px] rounded-full bg-surface-0/95 backdrop-blur-md border border-line-200 shadow-2 flex flex-col items-center justify-center gap-0.5 text-ink-900 hover:bg-brand-50 hover:border-brand-300 transition-colors cursor-pointer"
            >
              <svg
                viewBox="0 0 24 24"
                className="w-4 h-4 text-brand-500"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="2" y="6" width="14" height="12" rx="2" />
                <path d="m22 8-6 4 6 4V8Z" />
              </svg>
              <span className="text-[10px] font-semibold leading-none whitespace-nowrap">
                同步视频
              </span>
            </button>
          </div>

          <div
            aria-label="小屋右侧快捷操作"
            className="absolute right-3 bottom-[22%] z-30 pointer-events-auto flex flex-col gap-3"
          >
            {/* 右上圆钮：记录（前往 /records 查看今日记录） */}
            <Link
              href="/records"
              aria-label="查看今日行为记录"
              className="w-[52px] h-[52px] rounded-full bg-surface-0/95 backdrop-blur-md border border-line-200 shadow-2 flex flex-col items-center justify-center gap-0.5 text-ink-900 hover:bg-brand-50 hover:border-brand-300 transition-colors cursor-pointer"
            >
              <svg
                viewBox="0 0 24 24"
                className="w-4 h-4 text-sage-600"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
              </svg>
              <span className="text-[10px] font-semibold leading-none whitespace-nowrap">
                记录
              </span>
            </Link>

            {/* 右下圆钮：夜灯/日间切换 */}
            <button
              type="button"
              onClick={toggleNightMode}
              aria-pressed={nightMode}
              aria-label={nightMode ? '切换为日间阳光房' : '切换为夜晚暖灯房'}
              className="w-[52px] h-[52px] rounded-full bg-surface-0/95 backdrop-blur-md border border-line-200 shadow-2 flex flex-col items-center justify-center gap-0.5 text-ink-900 hover:bg-brand-50 hover:border-brand-300 transition-colors cursor-pointer"
            >
              {nightMode ? (
                <>
                  <svg
                    viewBox="0 0 24 24"
                    className="w-4 h-4 text-[#D99B26]"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                  </svg>
                  <span className="text-[10px] font-semibold leading-none whitespace-nowrap">
                    日间
                  </span>
                </>
              ) : (
                <>
                  <svg
                    viewBox="0 0 24 24"
                    className="w-4 h-4 text-[#6E7894]"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                  <span className="text-[10px] font-semibold leading-none whitespace-nowrap">
                    夜灯
                  </span>
                </>
              )}
            </button>
          </div>
        </CozyRoomScene>

        {/* 底部上拉抽屉（承载本地视频预览/上传进度、完整现实状态卡与能力边界说明） */}
        <WorldDrawerSheet
          mode={sheetMode}
          onClose={() => setSheetMode(null)}
          pet={pet}
          realityState={realityState}
          busy={busy}
          progress={progress}
          error={error}
          videoName={videoName}
          selectedFile={selectedFile}
          videoPreviewUrl={videoPreviewUrl}
          onPickFileClick={() => fileInputRef.current?.click()}
          onStartAnalyze={handleStartAnalyze}
          onCancelAnalyze={handleCancelAnalyze}
          onClearError={() => setError(null)}
        />
      </div>
    </div>
  );
}
