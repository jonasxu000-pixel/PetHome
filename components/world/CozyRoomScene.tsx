'use client';

import React, { useState } from 'react';

export interface CozyRoomSceneProps {
  nightMode: boolean;
  children: React.ReactNode;
}

/**
 * 沉浸式暖奶油绘本数字小屋（100dvh 手机全屏，桌面居中全高）：
 * - 100% 展示 public/art/cozy-room.png 原创肖像房间背景（不叠加重复家具 SVG）
 * - 支持日间阳光房 / 夜晚深蓝暖光房平滑切换
 * - 仅在图片加载异常时回退到 SVG 绘本房间兜底
 */
export function CozyRoomScene({ nightMode, children }: CozyRoomSceneProps) {
  const [imgError, setImgError] = useState(false);

  return (
    <div
      className={`relative w-full h-[100dvh] sm:h-[min(92dvh,860px)] sm:rounded-[32px] overflow-hidden sm:border transition-colors duration-500 sm:shadow-2 ${
        nightMode
          ? 'bg-[#1F2233] sm:border-[#3B3F58] text-[#F5EFE6]'
          : 'bg-[#F6ECDD] sm:border-[#E5D5C3] text-ink-900'
      }`}
    >
      {/* 主背景层：100% 不透明度渲染原创 public/art/cozy-room.png */}
      {!imgError ? (
        <div
          aria-hidden="true"
          className="absolute inset-0 w-full h-full pointer-events-none select-none overflow-hidden"
        >
          <img
            src="/art/cozy-room.png"
            alt=""
            onError={() => setImgError(true)}
            className={`w-full h-full object-cover object-center transition-all duration-500 ${
              nightMode
                ? 'brightness-[0.56] contrast-[1.1] saturate-[0.8]'
                : 'brightness-100'
            }`}
          />

          {/* 窗户区域夜间专属冷蓝遮罩：原图窗外为白昼，整体调暗后窗口仍偏亮突兀，
              单独压暗并叠冷色，使其读作"夜色窗外"而非"忘记关的白天" */}
          {nightMode && (
            <div
              aria-hidden="true"
              className="absolute left-0 top-[14%] w-[40%] h-[34%] transition-opacity duration-500"
              style={{
                background:
                  'radial-gradient(ellipse 70% 65% at 38% 45%, rgba(23, 31, 64, 0.78) 0%, rgba(23, 31, 64, 0.42) 55%, rgba(23, 31, 64, 0) 80%)',
                mixBlendMode: 'multiply',
              }}
            />
          )}

          {/* 夜晚模式暖夜灯与深蓝氛围覆盖层 */}
          {nightMode && (
            <div
              className="absolute inset-0 transition-opacity duration-500"
              style={{
                background:
                  'radial-gradient(circle at 50% 68%, rgba(255, 212, 132, 0.25) 0%, rgba(28, 32, 56, 0.56) 62%, rgba(18, 21, 38, 0.78) 100%)',
              }}
            />
          )}

          {/* 顶部 18% 柔和护眼衬底（确保 HUD 清晰） */}
          <div
            className="absolute inset-x-0 top-0 h-28"
            style={{
              background: nightMode
                ? 'linear-gradient(180deg, rgba(20, 23, 38, 0.58) 0%, rgba(20, 23, 38, 0) 100%)'
                : 'linear-gradient(180deg, rgba(251, 248, 244, 0.52) 0%, rgba(251, 248, 244, 0) 100%)',
            }}
          />

          {/* 底部柔和衬底（承托底部快捷栏与轻提示） */}
          <div
            className="absolute inset-x-0 bottom-0 h-28"
            style={{
              background: nightMode
                ? 'linear-gradient(0deg, rgba(18, 20, 34, 0.65) 0%, rgba(18, 20, 34, 0) 100%)'
                : 'linear-gradient(0deg, rgba(236, 218, 196, 0.58) 0%, rgba(236, 218, 196, 0) 100%)',
            }}
          />
        </div>
      ) : (
        /* 仅在图片加载失败时启用的极简 SVG 房间兜底 */
        <svg
          viewBox="0 0 440 840"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
          className="absolute inset-0 w-full h-full pointer-events-none select-none"
        >
          <rect
            x="0"
            y="0"
            width="440"
            height="540"
            fill={nightMode ? '#272B40' : '#F8EFE2'}
          />
          <rect
            x="0"
            y="540"
            width="440"
            height="300"
            fill={nightMode ? '#332F42' : '#DFC4A6'}
          />
          <ellipse
            cx="220"
            cy="640"
            rx="156"
            ry="52"
            fill={nightMode ? '#52495E' : '#F5E8D7'}
          />
        </svg>
      )}

      {/* 前景：全屏空间布局容器 */}
      <div className="relative z-10 w-full h-full flex flex-col justify-between px-3.5 pt-3 pb-3 sm:p-4">
        {children}
      </div>
    </div>
  );
}
