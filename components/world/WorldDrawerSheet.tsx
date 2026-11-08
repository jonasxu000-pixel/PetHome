'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { avatarOriginLabel } from '@/lib/avatar/profile';
import { getPetModel } from '@/lib/pet3d/catalog';
import type { Pet } from '@/lib/types';

export type SheetMode = 'guide' | 'profile' | null;
export interface WorldDrawerSheetProps { mode: SheetMode; onClose: () => void; pet: Pet | null; resting: boolean; onToggleRest: () => void }

export function WorldDrawerSheet({ mode, onClose, pet, resting, onToggleRest }: WorldDrawerSheetProps) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!mode) return;
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const focusable = panel.current?.querySelectorAll<HTMLElement>('button,a[href]');
        if (!focusable?.length) return;
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('keydown', key); previous?.focus(); };
  }, [mode, onClose]);
  if (!mode) return null;
  const preset = getPetModel(pet?.avatar, pet?.type ?? 'cat');

  return <div role="dialog" aria-modal="true" aria-label={mode === 'guide' ? '数字陪伴使用说明' : '数字分身资料'} className="fixed inset-0 z-50 flex items-end justify-center">
    <div onClick={onClose} className="fixed inset-0 bg-black/40 backdrop-blur-[2px]" aria-hidden="true" />
    <div ref={panel} className="relative z-10 w-full max-w-[480px] rounded-t-[26px] bg-surface-1 border-t border-line-200 shadow-2 p-5 pb-7 max-h-[85vh] overflow-y-auto flex flex-col gap-4">
      <div className="flex flex-col items-center gap-2">
        <div className="w-10 h-1.5 rounded-pill bg-line-200" />
        <div className="w-full flex items-center justify-between"><h2 className="text-[17px] font-semibold text-ink-900">{mode === 'guide' ? '让远方的爱宠陪伴你' : pet?.name ?? '你的数字分身'}</h2>
          <button type="button" onClick={onClose} aria-label="关闭面板" className="px-2.5 py-1 rounded-pill text-[13px] text-ink-500 hover:bg-surface-2">收起</button>
        </div>
      </div>
      {mode === 'guide' ? <ol className="space-y-3 text-[13px] text-ink-700 list-decimal pl-5">
        <li>在“分身”上传一张清晰、只有一只猫或狗的照片。AI 读取外观并匹配现有 3D 预设。</li>
        <li>确认名称、类型与外观；不够像时，可以手动选择预设或调整实际支持的毛色，再保存。</li>
        <li>在小屋轻触头部、鼻尖，或滑动身体。底部也有摸头、点鼻、顺背、逗尾快捷按钮。</li>
        <li>点击“休息”让数字分身休息，再点“唤醒”继续陪伴。夜灯可切换小屋气氛。</li>
      </ol> : <div className="rounded-xl bg-surface-0 border border-line-200 p-4 text-[13px] text-ink-700 space-y-2">
        <p><strong>外观：</strong>{preset?.label ?? '暂未选择'}</p>
        <p><strong>来源：</strong>{avatarOriginLabel(pet?.avatar)}</p>
        <p><strong>数字状态：</strong>{resting ? '休息中，触摸会轻轻回应' : '陪伴中，等你摸摸它'}</p>
        {preset && <p>{Object.keys(preset.animations).length ? '当前角色支持原生动画与触摸反馈。' : '当前角色为静态 3D 外观，互动采用整体轻反馈。'}</p>}
      </div>}
      <p className="muted-text">这里的状态属于数字分身，不代表现实宠物的行为或健康。照片用于识别和匹配预设，并非自动生成高精度 3D 模型。</p>
      <p className="muted-text">档案保存在当前浏览器，并尝试同步到本机服务端。请使用同一浏览器和访问地址继续体验。</p>
      <div className="flex gap-2"><Link href="/create" className="btn-primary flex-1 text-center">{pet ? '调整我的分身' : '创建我的宠物'}</Link><button type="button" className="btn-secondary flex-1" onClick={onToggleRest}>{resting ? '唤醒分身' : '让它休息'}</button></div>
    </div>
  </div>;
}
