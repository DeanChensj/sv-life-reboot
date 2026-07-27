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

export const BentoStatsPanel: React.FC<BentoStatsPanelProps> = ({
  gameState,
  currentEventId,
  onOpenCodex,
  onOpenShop,
  onToggleSound,
  isMuted
}) => {
  const displayLevel = gameState.level || (
    gameState.job_type === 'unemployed' || gameState.laid_off || !gameState.job_type 
      ? '待业' 
      : gameState.job_type === 'quant' 
        ? 'Quant' 
        : gameState.job_type === 'ai_research' 
          ? 'MTS' 
          : gameState.job_type === 'trader'
            ? '全职 Trader'
            : gameState.job_type === 'startup_founder'
              ? 'CEO & Founder'
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
    <div id="bento-stats-panel" className="w-full flex flex-col font-sans">
      {/* Header Title Section */}
      <div className="mb-4 sm:mb-6 relative">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>
            <span className="text-[10px] sm:text-[11px] font-mono font-bold tracking-[0.2em] text-emerald-400 uppercase">
              SV ENGINE V2.5 // BENTO HUD
            </span>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {onToggleSound && (
              <button
                onClick={onToggleSound}
                title={isMuted ? '开启音效' : '静音'}
                className={`p-2 rounded-xl border font-mono font-bold text-xs flex items-center justify-center active:scale-95 transition-all cursor-pointer ${
                  isMuted 
                    ? 'bg-zinc-900/80 hover:bg-zinc-800 text-zinc-500 border-zinc-800' 
                    : 'bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border-indigo-500/30 shadow-md shadow-indigo-500/10'
                }`}
              >
                {isMuted ? (
                  <svg className="w-4 h-4 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
                ) : (
                  <svg className="w-4 h-4 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                )}
              </button>
            )}
            {onOpenShop && currentEventId === 'sv_daily_life' && (
              <button
                onClick={onOpenShop}
                className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 font-mono font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/10 active:scale-95 transition-all cursor-pointer"
              >
                <svg className="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                <span>商城</span>
              </button>
            )}
            {onOpenCodex && (
              <button
                onClick={onOpenCodex}
                className="px-3 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 font-mono font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-purple-500/10 active:scale-95 transition-all cursor-pointer"
              >
                <svg className="w-3.5 h-3.5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.45 1-1 1H7v4h10v-4h-2c-.55 0-1-.45-1-1v-2.34M18 4H6v7a6 6 0 0 0 12 0V4z"/></svg>
                <span>图鉴</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3 mb-1">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tighter text-zinc-100 mb-0.5">
            硅谷模拟人生
          </h1>
          {gameState.macro_economy && (
            <div className={`px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-mono font-bold whitespace-nowrap flex items-center shadow-sm ${
              gameState.macro_economy === 'bull' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
              gameState.macro_economy === 'bear' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
              'bg-zinc-700/30 text-zinc-400 border border-zinc-600/50'
            }`}>
              {gameState.macro_economy === 'bull' ? ' 狂暴大牛市' : gameState.macro_economy === 'bear' ? ' 裁员大熊市' : '️ 正常震荡期'}
            </div>
          )}
        </div>
        <p className="text-zinc-400 text-xs sm:text-sm font-mono tracking-tight">
          Silicon Valley Survival & Career Simulator
        </p>
      </div>

      {/* Bento Stats Grid Layout */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        
        {/* 1. Hero Net Worth & Income Banner */}
        <div className="col-span-2 md:col-span-4 bg-gradient-to-br from-zinc-900 via-zinc-900/95 to-zinc-950 border border-zinc-800 p-4 sm:p-5 rounded-3xl flex justify-between items-center relative overflow-hidden shadow-2xl backdrop-blur-xl">
          <div className="absolute top-0 right-0 w-44 h-44 bg-emerald-500/10 rounded-full blur-3xl -mr-14 -mt-14 pointer-events-none" />
          
          <div className="relative z-10 flex-1">
            <div className="text-zinc-400 text-[10px] sm:text-[11px] font-mono font-medium uppercase tracking-[0.2em] mb-1 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              总资产 (Net Worth)
            </div>
            <div className="text-3xl sm:text-4xl lg:text-5xl font-black font-mono tabular-nums tracking-tight text-emerald-400 drop-shadow-md">
              ${(gameState.cash + (gameState.stocks || 0)).toFixed(1)}w
            </div>
            {(gameState.stocks !== undefined && gameState.stocks > 0) && (
              <div className="mt-1.5 text-[10px] sm:text-xs font-mono font-bold text-zinc-500 tracking-wider">
                现金: <span className="text-emerald-500/80">${gameState.cash.toFixed(1)}w</span> <span className="mx-1 opacity-50">|</span> 股票: <span className="text-emerald-500/80">${gameState.stocks.toFixed(1)}w</span>
              </div>
            )}
          </div>

          <div className="text-right relative z-10">
            <div className="text-zinc-400 text-[10px] sm:text-[11px] font-mono font-medium uppercase tracking-[0.2em] mb-1">
              年薪总包 (TC)
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums tracking-tight text-zinc-100">
              ${gameState.tc.toFixed(1)}w
            </div>
          </div>
        </div>

        {/* 2. Green Card Progress Bar (Visible during immigration phase) */}
        {((gameState.gc_progress || 0) > 0 || gameState.visa === '绿卡' || (gameState.job_type && gameState.job_type !== 'unemployed')) && !['choose_trait', 'choose_year', 'choose_school', 'end'].includes(currentEventId) && (
          <div className="col-span-2 md:col-span-4 bg-zinc-900/95 border border-emerald-500/30 p-3.5 sm:p-4 rounded-2xl flex flex-col justify-between relative overflow-hidden shadow-lg backdrop-blur-xl">
            <div className="flex flex-row justify-between items-center mb-2">
              <div className="text-emerald-400 text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-[0.18em] flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
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

        {/* 3. Core Visible Stats (LeetCode & Health) */}
        
        {/* LeetCode */}
        <div className="col-span-1 md:col-span-2 bg-zinc-900/90 border border-zinc-800/80 p-4 rounded-2xl flex flex-col justify-between backdrop-blur-xl transition-all duration-300 hover:border-amber-500/40">
          <div className="text-zinc-400 text-[10px] sm:text-[11px] font-mono font-medium uppercase tracking-[0.18em] mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
              LEETCODE 算法
            </span>
            <span className="text-[10px] text-amber-400/80 font-bold">{gameState.leetcode >= 80 ? '神仙' : gameState.leetcode >= 40 ? '熟练' : '入门'}</span>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums tracking-tight text-amber-300">
            {gameState.leetcode} <span className="text-xs font-normal text-amber-500/70">题</span>
          </div>
        </div>

        {/* Health 健康状态 */}
        <div className="col-span-1 md:col-span-2 bg-zinc-900/90 border border-zinc-800/80 p-4 rounded-2xl backdrop-blur-xl transition-all duration-300 hover:border-zinc-700/80">
          <div className="text-zinc-400 text-[10px] sm:text-[11px] font-mono font-medium uppercase tracking-[0.18em] mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
              健康与体能
            </span>
            <span className={`text-[10px] font-bold ${gameState.health >= 70 ? 'text-emerald-400' : gameState.health >= 40 ? 'text-amber-400' : 'text-rose-400 animate-pulse'}`}>
              {gameState.health >= 70 ? '良好' : gameState.health >= 40 ? '疲惫' : '高危警报'}
            </span>
          </div>
          <div className="flex items-end gap-1">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums tracking-tight text-zinc-100">{Math.max(0, gameState.health)}</span>
            <span className="text-xs font-mono text-zinc-500 mb-1">/100</span>
          </div>
          <div className="w-full bg-zinc-950 rounded-full h-1.5 mt-2 overflow-hidden border border-zinc-800/50">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${gameState.health > 50 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : gameState.health > 20 ? 'bg-amber-500' : 'bg-rose-500 animate-pulse'}`} 
              style={{ width: `${Math.max(0, gameState.health)}%` }} 
            />
          </div>
        </div>

        {/* 4. Status Badges (Level, Visa, Relationship) */}
        <div className="col-span-1 md:col-span-2 bg-zinc-900/90 border border-zinc-800/80 p-3.5 sm:p-4 rounded-2xl flex justify-between items-center backdrop-blur-xl">
          <div className="text-zinc-500 text-[10px] sm:text-[11px] font-mono uppercase tracking-[0.15em]">当前职级</div>
          <div className="text-xs font-bold text-purple-300 bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/20">
            {displayLevel}
          </div>
        </div>

        <div className="col-span-1 md:col-span-2 bg-zinc-900/90 border border-zinc-800/80 p-3.5 sm:p-4 rounded-2xl flex justify-between items-center backdrop-blur-xl">
          <div className="text-zinc-500 text-[10px] sm:text-[11px] font-mono uppercase tracking-[0.15em]">签证身份</div>
          <div className="text-xs font-semibold text-amber-400 bg-amber-400/10 px-3 py-1 rounded-full border border-amber-400/20">
            {gameState.visa}
          </div>
        </div>

        <div className="col-span-2 md:col-span-4 bg-zinc-900/90 border border-zinc-800/80 p-3.5 sm:p-4 rounded-2xl flex justify-between items-center backdrop-blur-xl">
          <div className="text-zinc-500 text-[10px] sm:text-[11px] font-mono uppercase tracking-[0.15em]">婚恋与感情状态</div>
          <div className={`text-xs font-bold px-3.5 py-1 rounded-full border ${
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

        {/* 5. Assets & Lifestyle Equipment */}
        <div className="col-span-2 md:col-span-4 bg-zinc-900/90 border border-zinc-800/80 p-4 rounded-2xl flex flex-col gap-2.5 backdrop-blur-xl">
          <div className="text-zinc-400 text-[10px] sm:text-[11px] font-mono uppercase tracking-[0.18em]">湾区房产与资产装备</div>
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

        {/* 6. Timeline Footer */}
        <div className="col-span-2 md:col-span-4 bg-zinc-900/90 border border-zinc-800/80 p-3.5 sm:p-4 rounded-2xl flex justify-between items-center backdrop-blur-xl">
          <div>
            <div className="text-zinc-400 text-[10px] sm:text-[11px] font-mono font-medium uppercase tracking-[0.18em] mb-0.5">游戏难度</div>
            <div className="text-sm sm:text-base font-bold font-mono text-emerald-300">{gameState.difficulty_title || '普通难度'}</div>
          </div>
          <div className="text-right">
            <div className="text-zinc-400 text-[10px] sm:text-[11px] font-mono font-medium uppercase tracking-[0.18em] mb-0.5">当前年龄</div>
            <div className="text-lg sm:text-xl font-bold font-mono tabular-nums text-zinc-100">{gameState.age} 岁</div>
          </div>
        </div>

      </div>
    </div>
  );
};
