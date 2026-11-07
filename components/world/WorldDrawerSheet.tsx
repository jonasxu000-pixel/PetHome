'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { StatusBar } from '@/components/state/StatusBar';
import { MAX_VIDEO_BYTES, MAX_VIDEO_SECONDS } from '@/lib/constants';
import type { Pet, RealityState } from '@/lib/types';

export type SheetMode = 'video' | 'status' | null;

export interface WorldDrawerSheetProps {
  mode: SheetMode;
  onClose: () => void;
  pet: Pet | null;
  realityState: RealityState;
  busy: boolean;
  progress: { current: number; total: number };
  error: string | null;
  videoName: string | null;
  selectedFile: File | null;
  videoPreviewUrl: string | null;
  onPickFileClick: () => void;
  onStartAnalyze: () => void;
  onCancelAnalyze: () => void;
  onClearError: () => void;
}

export function WorldDrawerSheet({
  mode,
  onClose,
  pet,
  realityState,
  busy,
  progress,
  error,
  videoName,
  selectedFile,
  videoPreviewUrl,
  onPickFileClick,
  onStartAnalyze,
  onCancelAnalyze,
  onClearError,
}: WorldDrawerSheetProps) {
  useEffect(() => {
    if (!mode) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [mode, onClose]);

  if (!mode) return null;

  const progressPercent =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.current / progress.total) * 100))
      : 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'video' ? '同步现实视频动态面板' : '现实状态与证据详情面板'}
      className="fixed inset-0 z-50 flex items-end justify-center"
    >
      {/* 半透明暖灰遮罩 */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity"
      />

      {/* 底部抽屉面板 */}
      <div className="relative z-10 w-full max-w-[480px] rounded-t-[26px] bg-surface-1 border-t border-line-200 shadow-2 p-5 pb-7 max-h-[85vh] overflow-y-auto flex flex-col gap-4">
        {/* 顶部拖拽条与标题栏 */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-10 h-1.5 rounded-pill bg-line-200" />
          <div className="w-full flex items-center justify-between">
            <h2 className="text-[17px] font-semibold text-ink-900">
              {mode === 'video' ? '同步现实宠物视频' : '现实行为状态详情'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="关闭面板"
              className="px-2.5 py-1 rounded-pill text-[13px] font-medium text-ink-500 hover:bg-surface-2 cursor-pointer"
            >
              收起
            </button>
          </div>
        </div>

        {/* Tab 切换（可在抽屉内一键切视频同步 / 状态详情） */}
        <div className="flex flex-col gap-3.5">
          {mode === 'status' && (
            <>
              <StatusBar realityState={realityState} />
              <div className="flex items-center justify-between pt-1">
                <Link
                  href="/records"
                  className="btn-secondary flex-1 mr-2 text-center"
                >
                  查看今日完整记录
                </Link>
                <Link href="/create" className="btn-primary flex-1 text-center">
                  {pet ? '调整分身外观' : '去定制专属分身'}
                </Link>
              </div>
              <p className="text-[11px] text-ink-400 leading-[17px] pt-1 border-t border-line-100">
                说明：支持 ≤30 秒 / 32MB 本地视频抽帧识别行为，不提供健康或医疗诊断；屏幕触摸互动仅驱动本地数字分身动画，不会改变现实行为记录。
              </p>
            </>
          )}

          {mode === 'video' && (
            <div className="flex flex-col gap-3.5">
              <p className="muted-text">
                支持时长 ≤{MAX_VIDEO_SECONDS} 秒、大小 ≤
                {Math.round(MAX_VIDEO_BYTES / (1024 * 1024))}MB
                的本地宠物视频（每 4 秒抽 1 帧更新小屋里的宠物姿态）。
              </p>

              {/* 本地视频预览播放器 */}
              {videoPreviewUrl && (
                <div className="rounded-md overflow-hidden border border-line-200 bg-black/5">
                  <video
                    src={videoPreviewUrl}
                    controls
                    playsInline
                    muted
                    className="w-full max-h-[190px] object-contain bg-black"
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
                    onClick={onClearError}
                    className="text-[12px] underline shrink-0 cursor-pointer"
                  >
                    关闭
                  </button>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  disabled={busy}
                  onClick={onPickFileClick}
                  className="btn-secondary flex-1 min-w-[130px]"
                >
                  {selectedFile ? '更换宠物视频' : '选择本地视频'}
                </button>

                {!busy ? (
                  <button
                    type="button"
                    disabled={!selectedFile || !pet}
                    onClick={onStartAnalyze}
                    className="btn-primary flex-1 min-w-[140px]"
                  >
                    开始抽帧识别
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onCancelAnalyze}
                    className="btn-secondary flex-1 min-w-[140px] border-[#E8B8B3] text-[#B5564E]"
                  >
                    取消分析
                  </button>
                )}
              </div>

              {!pet && (
                <div className="p-3 rounded-md bg-brand-50 border border-brand-200 flex items-center justify-between gap-2">
                  <span className="text-[13px] text-ink-700">
                    当前为通用体验分身，先创建档案即可开始识别真实视频
                  </span>
                  <Link
                    href="/create"
                    className="text-[13px] font-semibold text-brand-600 underline shrink-0"
                  >
                    去创建 →
                  </Link>
                </div>
              )}

              <p className="text-[12px] text-ink-500 leading-[18px]">
                数据流向说明：原视频保留在当前设备本地解码，抽取的单帧静态画面会发送给所配置的视觉模型服务进行行为识别。
              </p>

              {/* 抽屉内直接附带当前现实状态卡，方便边抽帧边看实时变化 */}
              <div className="pt-1 border-t border-line-200">
                <StatusBar realityState={realityState} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
