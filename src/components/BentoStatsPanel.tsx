import React from 'react';
import type { GameState } from '../types';

interface BentoStatsPanelProps {
  gameState: GameState;
  currentEventId: string;
  onOpenCodex?: () => void;
  onOpenShop?: () => void;
  onToggleSound?: () => void;
  isMuted?: boolean;
}

export const BentoStatsPanel: React.FC<BentoStatsPanelProps> = ({ gameState, currentEventId, onOpenCodex, onOpenShop, onToggleSound, isMuted }) => {
  // Fix AP Visibility: Show during active Bay Area daily life decision events, hide in onboarding or end screens
  const showAPBar = false; // AP system removed, replaced by Yearly Focus

  const displayLevel = gameState.level || (
    gameState.job_type === 'unemployed' || gameState.laid_off || !gameState.job_type 
      ? '待业' 
      : gameState.job_type === 'quant' 
        ? 'Quant' 
        : gameState.job_type === 'ai_research' 
          ? 'MTS' 
          : gameState.is_phd 
            ? 'L4' 
            : 'L3'
  );

  const hasCar = gameState.car && gameState.car !== 'none';
  const displayCar = gameState.car === 'porsche' 
    ? '保时捷 Porsche' 
    : gameState.car === 'cybertruck' 
      ? '赛博皮卡 Cybertruck' 
      : gameState.car === 'model_y' 
        ? 'Tesla Model Y' 
        : null;

  const displayHousing = gameState.housing_name || (gameState.has_housing ? '湾区自购房产' : '国内老家 / 未购房');

  return (
    <div id="bento-stats-panel" className="w-full flex flex-col">
      {/* Header / Title */}
      <div className="mb-6 lg:mb-8 relative">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-[10.5px] font-mono font-bold tracking-[0.2em] text-emerald-400 uppercase">
            SIMULATOR ENGINE V2.0
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tighter text-zinc-100 mb-1">
              硅谷模拟人生
            </h1>
            <p className="text-zinc-400 text-xs md:text-sm font-mono tracking-tight">
              A survival & career guide to the Bay Area.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onToggleSound && (
              <button
                onClick={onToggleSound}
                title={isMuted ? '开启音效' : '静音'}
                className={`p-2.5 rounded-2xl border font-mono font-bold text-xs flex items-center justify-center active:scale-95 transition-all cursor-pointer ${
                  isMuted 
                    ? 'bg-zinc-900/60 hover:bg-zinc-800 text-zinc-500 border-zinc-800/80' 
                    : 'bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border-indigo-500/30 shadow-md shadow-indigo-500/10'
                }`}
              >
                {isMuted ? (
                  <svg className="w-4 h-4 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                    <line x1="23" y1="9" x2="17" y2="15"></line>
                    <line x1="17" y1="9" x2="23" y2="15"></line>
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                  </svg>
                )}
              </button>
            )}
            {onOpenShop && currentEventId === 'sv_daily_life' && (
              <button
                onClick={onOpenShop}
                className="px-3.5 py-2 rounded-2xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 hover:from-emerald-500/30 hover:to-teal-500/30 text-emerald-300 border border-emerald-500/30 font-mono font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/10 active:scale-95 transition-all cursor-pointer"
              >
                <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
                <span>资产商城</span>
              </button>
            )}
            {onOpenCodex && (
              <button
                onClick={onOpenCodex}
                className="px-3.5 py-2 rounded-2xl bg-gradient-to-r from-purple-500/20 to-indigo-500/20 hover:from-purple-500/30 hover:to-indigo-500/30 text-purple-300 border border-purple-500/30 font-mono font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-purple-500/10 active:scale-95 transition-all cursor-pointer"
              >
                <svg className="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.45 1-1 1H7v4h10v-4h-2c-.55 0-1-.45-1-1v-2.34M18 4H6v7a6 6 0 0 0 12 0V4z"/></svg>
                <span>成就图鉴</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bento Stats Panel Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Cash & TC */}
        <div className="col-span-2 md:col-span-4 bg-zinc-900/90 border border-zinc-800/80 p-4 sm:p-5 rounded-2xl flex justify-between items-center relative overflow-hidden shadow-lg backdrop-blur-xl transition-all duration-300 hover:border-zinc-700/80">
          <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-500/10 rounded-full blur-3xl -mr-12 -mt-12 pointer-events-none"></div>
          <div className="relative z-10">
            <div className="text-zinc-400 text-[10px] sm:text-[10.5px] font-mono font-medium uppercase tracking-[0.18em] mb-1">现金资产 (Cash)</div>
            <div className="text-3xl sm:text-4xl font-black font-mono tabular-nums tracking-tight text-emerald-400">${gameState.cash.toFixed(1)}w</div>
          </div>
          <div className="text-right relative z-10">
            <div className="text-zinc-400 text-[10px] sm:text-[10.5px] font-mono font-medium uppercase tracking-[0.18em] mb-1">当前总包 (TC)</div>
            <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums tracking-tight text-zinc-100">${gameState.tc.toFixed(1)}w</div>
          </div>
        </div>
        
        {/* Action Points removed - replaced by Yearly Focus system */}

        {/* Green Card Progress Bar (Visible only when employed, in queue, or holding Green Card) */}
        {((gameState.gc_progress || 0) > 0 || gameState.visa === '绿卡' || (gameState.job_type && gameState.job_type !== 'unemployed')) && !['choose_trait', 'choose_year', 'choose_school', 'end'].includes(currentEventId) && (
          <div className="col-span-2 md:col-span-4 bg-zinc-900/95 border border-emerald-500/30 p-3.5 sm:p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden shadow-md backdrop-blur-xl">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0 mb-2">
              <div className="text-emerald-400 text-[10px] sm:text-[10.5px] font-mono font-bold uppercase tracking-[0.18em] flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                绿卡排期与 PERM 进度 (GC Progress)
              </div>
              <div className="text-xs font-mono font-extrabold text-emerald-300 tabular-nums">
                {gameState.visa === '绿卡' 
                  ? '100% (已获绿卡)' 
                  : (gameState.gc_progress || 0) > 0
                    ? `${Math.round(Math.min(100, Math.max(0, ((gameState.gc_progress || 0) / 5) * 100)))}% (${gameState.gc_progress || 0}/5 年排期)`
                    : '0% (PERM 筹备中)'}
              </div>
            </div>
            <div className="w-full bg-zinc-950 rounded-full h-2.5 overflow-hidden border border-emerald-500/20">
              <div 
                className="h-full rounded-full bg-gradient-to-r from-emerald-600 via-emerald-400 to-teal-300 transition-all duration-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" 
                style={{ width: `${gameState.visa === '绿卡' ? 100 : Math.min(100, Math.max(0, ((gameState.gc_progress || 0) / 5) * 100))}%` }}
              />
            </div>
          </div>
        )}

        {/* Health */}
        <div className="col-span-1 md:col-span-2 bg-zinc-900/90 border border-zinc-800/80 p-4 sm:p-5 rounded-2xl backdrop-blur-xl transition-all duration-300 hover:border-zinc-700/80">
          <div className="text-zinc-400 text-[10px] sm:text-[10.5px] font-mono font-medium uppercase tracking-[0.18em] mb-2">健康状态</div>
          <div className="flex items-end gap-1">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums tracking-tight text-zinc-100">{Math.max(0, gameState.health)}</span>
            <span className="text-xs font-mono text-zinc-500 mb-1">/100</span>
          </div>
          <div className="w-full bg-zinc-950 rounded-full h-1.5 mt-2.5 overflow-hidden border border-zinc-800/50">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${gameState.health > 50 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : gameState.health > 20 ? 'bg-amber-500' : 'bg-red-500 animate-pulse'}`} 
              style={{ width: `${Math.max(0, gameState.health)}%` }}></div>
          </div>
        </div>

        {/* LeetCode */}
        <div className="col-span-1 md:col-span-2 bg-zinc-900/90 border border-zinc-800/80 p-4 sm:p-5 rounded-2xl flex flex-col justify-between backdrop-blur-xl transition-all duration-300 hover:border-zinc-700/80">
          <div className="text-zinc-400 text-[10px] sm:text-[10.5px] font-mono font-medium uppercase tracking-[0.18em] mb-1">LeetCode</div>
          <div className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums tracking-tight text-amber-300">{gameState.leetcode}</div>
        </div>
        
        {/* Level & Visa */}
        <div className="col-span-1 md:col-span-2 bg-zinc-900/90 border border-zinc-800/80 p-4 sm:p-5 rounded-2xl flex justify-between items-center backdrop-blur-xl">
          <div className="text-zinc-500 text-[10px] sm:text-[10.5px] font-mono uppercase tracking-[0.15em]">当前职级</div>
          <div className="text-xs font-bold text-purple-300 bg-purple-500/10 px-2.5 py-1 rounded-full border border-purple-500/20">
            {displayLevel}
          </div>
        </div>

        <div className="col-span-1 md:col-span-2 bg-zinc-900/90 border border-zinc-800/80 p-4 sm:p-5 rounded-2xl flex justify-between items-center backdrop-blur-xl">
          <div className="text-zinc-500 text-[10px] sm:text-[10.5px] font-mono uppercase tracking-[0.15em]">签证状态</div>
          <div className="text-xs font-semibold text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-full border border-amber-400/20">
            {gameState.visa}
          </div>
        </div>

        <div className="col-span-2 md:col-span-4 bg-zinc-900/90 border border-zinc-800/80 p-4 sm:p-5 rounded-2xl flex justify-between items-center backdrop-blur-xl">
          <div className="text-zinc-500 text-[10px] sm:text-[10.5px] font-mono uppercase tracking-[0.15em]">感情状态</div>
          <div className={`text-xs font-bold px-3 py-1 rounded-full border ${
            gameState.relationship_status === 'married' || gameState.is_married
              ? 'text-pink-300 bg-pink-500/10 border-pink-500/20'
              : gameState.relationship_status === 'dating'
                ? 'text-rose-300 bg-rose-500/10 border-rose-500/20'
                : gameState.relationship_status === 'matched'
                  ? 'text-purple-300 bg-purple-500/10 border-purple-500/20'
                  : 'text-zinc-400 bg-zinc-800/50 border-zinc-700/50'
          }`}>
            {gameState.relationship_status === 'married' || gameState.is_married
              ? '已婚双职工'
              : gameState.relationship_status === 'dating'
                ? '热恋中'
                : gameState.relationship_status === 'matched'
                  ? '相亲匹配中'
                  : '单身'}
          </div>
        </div>

        {/* Combined Assets & Lifestyle */}
        <div className="col-span-2 md:col-span-4 bg-zinc-900/90 border border-zinc-800/80 p-4 sm:p-5 rounded-2xl flex flex-col gap-2.5 backdrop-blur-xl">
          <div className="text-zinc-400 text-[10px] sm:text-[10.5px] font-mono uppercase tracking-[0.18em]">湾区资产与生活装备</div>
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-semibold text-emerald-300 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20 flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              {displayHousing}
            </span>
            {hasCar && displayCar && (
              <span className="text-xs font-semibold text-indigo-300 bg-indigo-500/10 px-3 py-1.5 rounded-xl border border-indigo-500/20 flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-indigo-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                {displayCar}
              </span>
            )}
            {gameState.has_pet && (
              <span className="text-xs font-semibold text-amber-300 bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20 flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-amber-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                {gameState.pet_name || '日系柴犬'}
              </span>
            )}
          </div>
        </div>

        {/* Timeline */}
        <div className="col-span-2 md:col-span-4 bg-zinc-900/90 border border-zinc-800/80 p-4 sm:p-5 rounded-2xl flex justify-between items-center backdrop-blur-xl">
          <div>
            <div className="text-zinc-400 text-[10px] sm:text-[10.5px] font-mono font-medium uppercase tracking-[0.18em] mb-1">当前年份</div>
            <div className="text-lg sm:text-xl font-bold font-mono tabular-nums text-zinc-200">{gameState.year} 年</div>
          </div>
          <div className="text-right">
            <div className="text-zinc-400 text-[10px] sm:text-[10.5px] font-mono font-medium uppercase tracking-[0.18em] mb-1">年龄</div>
            <div className="text-lg sm:text-xl font-bold font-mono tabular-nums text-zinc-200">{gameState.age} 岁</div>
          </div>
        </div>
      </div>
    </div>
  );
};


