'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { PetStage } from '@/components/pet/PetStage';
import { CozyRoomScene } from '@/components/world/CozyRoomScene';
import { WorldDrawerSheet, type SheetMode } from '@/components/world/WorldDrawerSheet';
import { getPet } from '@/lib/db';
import { usePetStore } from '@/lib/store';
import { PERSONALITY_LABELS, PET_TYPE_LABELS } from '@/lib/constants';
import type { RealityState } from '@/lib/types';

const NIGHT_PREF_KEY = 'pethome:night-mode';
const circleClass = 'w-[52px] h-[52px] rounded-full bg-surface-0/95 backdrop-blur-md border border-line-200 shadow-2 flex flex-col items-center justify-center gap-0.5 text-ink-900 hover:bg-brand-50 hover:border-brand-300 transition-colors cursor-pointer';

function Icon({ kind }: { kind: 'pet' | 'rest' | 'guide' | 'light' }) {
  return <svg viewBox="0 0 24 24" className="w-4 h-4 text-brand-600" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === 'pet' ? <><circle cx="12" cy="8" r="4" /><path d="M5 20c1.5-4 12.5-4 14 0" /></> : kind === 'rest' ? <><path d="M3 18v-7m0 5h18v-5H8v5M21 18v-2M3 8h5v5H3z" /><path d="M13 4h5l-5 4h5" /></> : kind === 'guide' ? <><circle cx="12" cy="12" r="9" /><path d="M9.5 8a2.5 2.5 0 0 1 5 .5c0 2-2.5 2-2.5 4M12 17h.01" /></> : <><path d="M9 18h6m-5 3h4M8.5 14a6 6 0 1 1 7 0c-1 .8-1 1.5-1 2h-5c0-.5 0-1.2-1-2Z" /></>}
  </svg>;
}

export default function HomePage() {
  const pet = usePetStore(s => s.pet), hydrated = usePetStore(s => s.hydrated);
  const overlay = usePetStore(s => s.overlay), restore = usePetStore(s => s.restore);
  const setOverlay = usePetStore(s => s.setOverlay), tick = usePetStore(s => s.tick);
  const [nightMode, setNightMode] = useState(false);
  const [resting, setResting] = useState(false);
  const [sheetMode, setSheetMode] = useState<SheetMode>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const closeSheet = useCallback(() => setSheetMode(null), []);

  useEffect(() => {
    let active = true;
    try { setNightMode(localStorage.getItem(NIGHT_PREF_KEY) === '1'); } catch { /* optional preference */ }
    getPet().then(stored => { if (active) restore(stored, null); }).catch(error => {
      if (active) { restore(null, null); setLoadError(error instanceof Error ? error.message : '读取档案失败，请重试。'); }
    });
    return () => { active = false; };
  }, [restore]);

  useEffect(() => {
    if (!hydrated) return;
    try { setResting(localStorage.getItem('pethome:companion-rest:' + (pet?.id ?? 'preview')) === '1'); } catch { setResting(false); }
  }, [pet?.id, hydrated]);

  useEffect(() => { const timer = setInterval(tick, 150); return () => clearInterval(timer); }, [tick]);

  const toggleRest = () => {
    if (!hydrated) return;
    setOverlay(null);
    const next = !resting;
    setResting(next);
    try { localStorage.setItem('pethome:companion-rest:' + (pet?.id ?? 'preview'), next ? '1' : '0'); } catch { /* keep session usable */ }
  };
  const toggleNight = () => setNightMode(value => {
    try { localStorage.setItem(NIGHT_PREF_KEY, value ? '0' : '1'); } catch { /* keep session usable */ }
    return !value;
  });

  // Local digital-companion pose; never an assertion about the real animal.
  const companionState: RealityState = { behavior: resting ? 'sleeping' : 'unknown', confidence: null, source: null, timestamp: null, syncStatus: 'idle', status: null, reasonCode: 'none' };

  return <div className="w-full min-h-[100dvh] sm:py-4 flex items-center justify-center bg-surface-1 overflow-hidden">
    <div className="w-full max-w-[480px] h-[100dvh] sm:h-auto">
      <CozyRoomScene nightMode={nightMode}>
        <div className="relative z-20 flex flex-col gap-2">
          <div className="w-full flex items-start justify-between gap-2">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-0/90 backdrop-blur-md border border-line-200 shadow-1 min-w-0 max-w-[63%]">
              {pet?.photoUrl && <img src={pet.photoUrl} alt={`${pet.name}的真实宠物参考照片`} className="w-9 h-9 shrink-0 rounded-lg object-cover border-2 border-white shadow-1" />}
              <div className="min-w-0 flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-[15px] font-semibold text-ink-900 truncate">{pet?.name ?? '你的数字宠物小屋'}</span>
                {pet && <span className="px-1.5 py-0.5 rounded-pill text-[10px] font-medium bg-brand-50 text-brand-600 whitespace-nowrap shrink-0">{PET_TYPE_LABELS[pet.type]} · {PERSONALITY_LABELS[pet.personality]}</span>}
              </div>
              {!pet && <span className="text-[11px] text-ink-500 truncate mt-0.5">让远方的爱宠，在手机里陪伴你</span>}
              </div>
            </div>
            <button type="button" onClick={() => setSheetMode('profile')} aria-label={`数字分身状态：${resting ? '休息中' : '陪伴中'}，查看分身资料`}
              className="inline-flex flex-col items-end px-3 py-1.5 rounded-lg bg-surface-0/90 backdrop-blur-md border border-line-200 shadow-1 hover:border-brand-400 transition-colors shrink-0">
              <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold whitespace-nowrap" style={{ color: resting ? 'var(--state-sleeping)' : 'var(--sage-600)' }}>
                <span className="w-2 h-2 rounded-full bg-current" />{resting ? '休息中' : '陪伴中'}
              </span>
            </button>
          </div>
          {loadError ? <div role="alert" className="rounded-lg border border-line-200 bg-surface-0/95 px-3 py-2 text-[12px] text-ink-700">
            {loadError}<button type="button" className="ml-2 underline text-brand-600" onClick={() => location.reload()}>重试读取</button>
          </div> : hydrated && !pet && <div className="px-3 py-2 rounded-lg bg-surface-0/92 backdrop-blur-md border border-brand-200 shadow-1 flex items-center justify-between gap-2">
            <span className="text-[12px] font-medium text-ink-700 truncate">上传照片，让爱宠住进小屋</span>
            <Link href="/create" className="btn-primary !py-1 !px-3 !min-h-[32px] !text-[12px] whitespace-nowrap shrink-0">创建你的宠物</Link>
          </div>}
        </div>

        <PetStage pet={pet} realityState={companionState} overlay={overlay} displayAnimation={resting ? 'sleeping' : 'idle'} nightMode={nightMode} onSetOverlay={setOverlay} />

        <div aria-label="小屋左侧快捷操作" className="absolute left-3 bottom-[22%] z-30 pointer-events-auto flex flex-col gap-3">
          <Link href="/create" aria-label={pet ? '定制或修改宠物分身' : '创建你的宠物分身'} className={circleClass}><Icon kind="pet" /><span className="text-[10px] font-semibold leading-none">分身</span></Link>
          <button type="button" onClick={toggleRest} disabled={!hydrated} aria-label={resting ? '唤醒数字分身' : '让数字分身休息'} aria-pressed={resting} className={circleClass}><Icon kind="rest" /><span className="text-[10px] font-semibold leading-none">{resting ? '唤醒' : '休息'}</span></button>
        </div>
        <div aria-label="小屋右侧快捷操作" className="absolute right-3 bottom-[22%] z-30 pointer-events-auto flex flex-col gap-3">
          <button type="button" onClick={() => setSheetMode('guide')} aria-label="查看陪伴玩法与使用说明" className={circleClass}><Icon kind="guide" /><span className="text-[10px] font-semibold leading-none">玩法</span></button>
          <button type="button" onClick={toggleNight} aria-label={nightMode ? '切换为日间阳光房' : '切换为夜晚暖灯房'} aria-pressed={nightMode} className={circleClass}><Icon kind="light" /><span className="text-[10px] font-semibold leading-none">{nightMode ? '日间' : '夜灯'}</span></button>
        </div>
      </CozyRoomScene>
      <WorldDrawerSheet mode={sheetMode} onClose={closeSheet} pet={pet} resting={resting} onToggleRest={toggleRest} />
    </div>
  </div>;
}
