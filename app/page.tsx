'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { PetStage } from '@/components/pet/PetStage';
import { StatusBar } from '@/components/state/StatusBar';
import { analyzeVideo } from '@/lib/ai/client';
import { MAX_VIDEO_BYTES, MAX_VIDEO_SECONDS } from '@/lib/constants';
import { getLatestInterval, getPet } from '@/lib/db';
import { usePetStore } from '@/lib/store';

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

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 1. 初始化从 IndexedDB 恢复宠物档案与最近一条行为区间
  useEffect(() => {
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

  // 2. 定时推进状态机与清理过期的瞬态触摸覆盖层
  useEffect(() => {
    const timer = window.setInterval(() => {
      tick();
    }, 250);
    return () => window.clearInterval(timer);
  }, [tick]);

  // 3. 本地视频预览 URL 生命周期管理（原视频仅在浏览器内解码抽帧，绝不整段上传）
  useEffect(() => {
    return () => {
      if (videoPreviewUrl) {
        URL.revokeObjectURL(videoPreviewUrl);
      }
    };
  }, [videoPreviewUrl]);

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
      return;
    }

    if (videoPreviewUrl) {
      URL.revokeObjectURL(videoPreviewUrl);
    }
    const nextUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setVideoName(file.name);
    setVideoPreviewUrl(nextUrl);
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

  const progressPercent =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.current / progress.total) * 100))
      : 0;

  const displayAnimation = getDisplayAnimation();

  return (
    <div className="page-container">
      {/* 演示数据全局提示条（当现实状态来源为 preset 时常驻醒目提示） */}
      {realityState.source === 'preset' && (
        <div
          role="status"
          className="badge-demo-stripe rounded-md px-3.5 py-2.5 text-[13px] font-medium flex items-center justify-between gap-2"
        >
          <span>
            当前展示为【预设演示数据】，非真实摄像头或视频实时识别结果
          </span>
        </div>
      )}

      {/* 尚未建档引导卡（醒目提示用户前往 /create 建立宠物档案） */}
      {hydrated && !pet && (
        <section
          aria-label="创建宠物档案引导"
          className="card border-brand-200 bg-brand-50/70 flex flex-col gap-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-[18px] font-semibold text-ink-900">
                欢迎来到宠伴 PetHome
              </h1>
              <p className="muted-text mt-1">
                开始上传视频识别或体验完整陪伴前，请先为你的猫咪或狗狗建立专属档案（支持上传真实照片作为数字分身本体）。
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/create" className="btn-primary">
              立即创建宠物档案
            </Link>
            <Link href="/records" className="btn-secondary">
              查看今日记录
            </Link>
          </div>
        </section>
      )}

      {/* 1. 数字宠物舞台（照片本体 + CSS 5 态动效 + 3 种手势互动 & 睡觉受限反应） */}
      <PetStage
        pet={pet}
        realityState={realityState}
        overlay={overlay}
        displayAnimation={displayAnimation}
        onSetOverlay={setOverlay}
      />

      {/* 2. 现实状态卡（三处编码：颜色 + 线性图标 + 文字，条件展示置信度） */}
      <StatusBar realityState={realityState} />

      {/* 3. 本地视频抽帧与 AI 行为识别控制卡 */}
      <section
        aria-label="上传宠物视频识别行为"
        className="card flex flex-col gap-3.5"
      >
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-[16px] font-semibold text-ink-900">
              视频抽帧行为识别
            </h2>
            <p className="muted-text mt-0.5">
              支持时长 ≤{MAX_VIDEO_SECONDS} 秒、大小 ≤{Math.round(MAX_VIDEO_BYTES / (1024 * 1024))}MB 的本地宠物视频（每 4 秒抽 1 帧）
            </p>
          </div>

          <Link
            href="/records"
            className="text-[13px] font-semibold text-brand-600 hover:underline shrink-0 cursor-pointer"
          >
            今日记录 →
          </Link>
        </div>

        {/* 本地视频预览播放器 */}
        {videoPreviewUrl && (
          <div className="rounded-md overflow-hidden border border-line-200 bg-black/5">
            <video
              src={videoPreviewUrl}
              controls
              playsInline
              muted
              className="w-full max-h-[210px] object-contain bg-black"
            />
            <div className="px-3 py-1.5 bg-surface-2 flex items-center justify-between text-[12px] text-ink-500">
              <span className="truncate">
                已选视频：{selectedFile?.name || videoName || '本地视频'}
              </span>
              {selectedFile && (
                <span className="shrink-0 ml-2">
                  {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
                </span>
              )}
            </div>
          </div>
        )}

        {/* 识别进度条 */}
        {busy && (
          <div
            role="status"
            aria-live="polite"
            className="p-3 rounded-md bg-surface-2 border border-line-200 flex flex-col gap-2"
          >
            <div className="flex items-center justify-between text-[13px] font-medium text-ink-700">
              <span>
                正在识别视频帧
                {videoName ? `（${videoName}）` : ''}…
              </span>
              <span>
                {progress.total > 0
                  ? `${progress.current} / ${progress.total} 帧 (${progressPercent}%)`
                  : '准备抽帧中…'}
              </span>
            </div>
            <div className="w-full h-2 rounded-pill bg-line-200 overflow-hidden">
              <div
                className="h-full transition-all duration-200 rounded-pill"
                style={{
                  width: `${Math.max(8, progressPercent)}%`,
                  backgroundColor: 'var(--brand-500)',
                }}
              />
            </div>
          </div>
        )}

        {/* 错误反馈横幅 */}
        {error && (
          <div
            role="alert"
            className="p-3 rounded-md border text-[13px] flex items-start justify-between gap-2"
            style={{
              backgroundColor: 'var(--state-failed-bg)',
              borderColor: '#E8B8B3',
              color: 'var(--state-failed)',
            }}
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-[12px] underline shrink-0 cursor-pointer"
            >
              关闭
            </button>
          </div>
        )}

        {/* 视频选择与开始/取消操作按钮 */}
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime,video/*"
          onChange={handleFileChange}
          className="hidden"
          aria-label="选择本地宠物视频文件"
        />

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
            className="btn-secondary flex-1 min-w-[130px]"
          >
            {selectedFile ? '更换宠物视频' : '选择本地视频'}
          </button>

          {!busy ? (
            <button
              type="button"
              disabled={!selectedFile || !pet}
              onClick={handleStartAnalyze}
              className="btn-primary flex-1 min-w-[140px]"
            >
              开始抽帧识别
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCancelAnalyze}
              className="btn-secondary flex-1 min-w-[140px] border-[#E8B8B3] text-[#B5564E]"
            >
              取消分析
            </button>
          )}
        </div>

        <p className="text-[12px] text-ink-500 leading-[18px]">
          数据流向说明：原视频保留在当前设备本地解码，但抽取的单帧静态画面会发送给所配置的视觉模型服务进行行为识别。
        </p>

        {!pet && (
          <p className="text-[12px] text-ink-500">
            提示：请先
            <Link href="/create" className="text-brand-600 underline mx-1">
              创建宠物档案
            </Link>
            后再执行视频识别。
          </p>
        )}
      </section>

      {/* 4. 快捷入口与诚实能力边界声明 */}
      <footer className="pt-1 pb-4 flex flex-col gap-2 text-center">
        <div className="flex items-center justify-center gap-4 text-[13px] font-medium text-ink-700">
          <Link
            href="/records"
            className="hover:text-brand-600 underline cursor-pointer"
          >
            查看今日行为记录
          </Link>
          <span className="text-line-200">|</span>
          <Link
            href="/create"
            className="hover:text-brand-600 underline cursor-pointer"
          >
            {pet ? '查看/管理宠物档案' : '新建宠物档案'}
          </Link>
        </div>
        <p className="text-[12px] text-ink-400 leading-[18px]">
          能力边界说明：AI 仅识别画面中的宠物基础行为，不提供医疗或健康诊断；在手机屏幕上触摸数字形象仅作用于本地动画，不会传递给现实中的宠物。
        </p>
      </footer>
    </div>
  );
}
