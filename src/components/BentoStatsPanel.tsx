import React from 'react';
import type { GameState } from '../types';

interface BentoStatsPanelProps {
  gameState: GameState;
  currentEventId: string;
}

const AP_VISIBLE_EVENTS = new Set([
  'sv_daily_life', 'sv_year_end_settlement', 'dating_market', 'biohacking_party',
  'crypto_scam', 'ai_wrapper_startup', 'burning_man_invite', 'stock_crash',
  'car_broken', 'dental_emergency', 'post_green_card', 'layoff_rumor',
  'perf_review', 'friday_pip', 'visa_check', 'blind_team_tea',
  'zoom_camera_off_leetcode', 'boba_inflation', 'rsu_vesting_crash',
  'h1b_rfe_vs_parent_nag', 'xhs_boba', 'startup_crisis', 'ai_research_crisis', 'quant_stress'
]);

export const BentoStatsPanel: React.FC<BentoStatsPanelProps> = ({ gameState, currentEventId }) => {
  const showAPBar = gameState.ap !== undefined && AP_VISIBLE_EVENTS.has(currentEventId);

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
      ? '赛博皮卡' 
      : gameState.car === 'model_y' 
        ? 'Tesla Model Y' 
        : null;

  const displayHousing = gameState.housing_name || (gameState.has_housing ? '湾区租房' : '国内老家 / 未购房');

  return (
    <div id="bento-stats-panel" className="w-full flex flex-col">
      {/* Header / Title */}
      <div className="mb-6 lg:mb-8">
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tighter text-zinc-100 mb-2">
          硅谷模拟人生
        </h1>
        <p className="text-zinc-400 text-sm md:text-base font-mono">
          A survival guide to the Bay Area.
        </p>
      </div>

      {/* Bento Stats Panel Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Cash & TC */}
        <div className="col-span-2 md:col-span-4 bg-zinc-900 border border-zinc-800 p-4 sm:p-5 rounded-2xl flex justify-between items-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
          <div className="relative z-10">
            <div className="text-zinc-400 text-[10px] sm:text-[10.5px] font-mono font-medium uppercase tracking-[0.15em] mb-1">现金资产 (Cash)</div>
            <div className="text-3xl sm:text-4xl font-extrabold font-mono tabular-nums tracking-tight text-emerald-400">${gameState.cash.toFixed(1)}w</div>
          </div>
          <div className="text-right relative z-10">
            <div className="text-zinc-400 text-[10px] sm:text-[10.5px] font-mono font-medium uppercase tracking-[0.15em] mb-1">当前总包 (TC)</div>
            <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums tracking-tight text-zinc-100">${gameState.tc.toFixed(1)}w</div>
          </div>
        </div>
        
        {/* Action Points (AP) */}
        {showAPBar && (
          <div className="col-span-2 md:col-span-4 bg-zinc-900 border border-zinc-800 p-4 sm:p-5 rounded-2xl flex items-center gap-4 sm:gap-6">
            <div className="flex-1">
              <div className="text-zinc-400 text-[10px] sm:text-[10.5px] font-mono font-medium uppercase tracking-[0.15em] mb-2">本年剩余精力 (AP)</div>
              <div className="flex gap-2">
                {Array.from({ length: gameState.max_ap || 3 }).map((_, i) => (
                  <div 
                    key={i} 
                    className={`h-2.5 sm:h-3 flex-1 rounded-full transition-all duration-300 ${i < gameState.ap ? 'bg-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.6)]' : 'bg-zinc-800/80'}`}
                  />
                ))}
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold font-mono tabular-nums tracking-tight text-indigo-400 whitespace-nowrap">
              {gameState.ap} / {gameState.max_ap || 3}
            </div>
          </div>
        )}

        {/* Health */}
        <div className="col-span-1 md:col-span-2 bg-zinc-900 border border-zinc-800 p-4 sm:p-5 rounded-2xl">
          <div className="text-zinc-400 text-[10px] sm:text-[10.5px] font-mono font-medium uppercase tracking-[0.15em] mb-2">健康状态</div>
          <div className="flex items-end gap-1">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums tracking-tight text-zinc-100">{Math.max(0, gameState.health)}</span>
            <span className="text-xs font-mono text-zinc-500 mb-1">/100</span>
          </div>
          <div className="w-full bg-zinc-950 rounded-full h-1.5 mt-2.5 overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${gameState.health > 50 ? 'bg-emerald-500' : gameState.health > 20 ? 'bg-amber-500' : 'bg-red-500 animate-pulse'}`} 
              style={{ width: `${Math.max(0, gameState.health)}%` }}></div>
          </div>
        </div>

        {/* LeetCode */}
        <div className="col-span-1 md:col-span-2 bg-zinc-900 border border-zinc-800 p-4 sm:p-5 rounded-2xl flex flex-col justify-between">
          <div className="text-zinc-400 text-[10px] sm:text-[10.5px] font-mono font-medium uppercase tracking-[0.15em] mb-1">LeetCode</div>
          <div className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums tracking-tight text-amber-300">{gameState.leetcode}</div>
        </div>
        
        {/* Level & Visa */}
        <div className="col-span-1 md:col-span-2 bg-zinc-900 border border-zinc-800 p-4 sm:p-5 rounded-2xl flex justify-between items-center">
          <div className="text-zinc-500 text-[10px] sm:text-[10.5px] font-mono uppercase tracking-[0.1em]">当前职级</div>
          <div className="text-xs font-bold text-purple-300 bg-purple-500/10 px-2.5 py-1 rounded-full border border-purple-500/20">
            {displayLevel}
          </div>
        </div>

        <div className="col-span-1 md:col-span-2 bg-zinc-900 border border-zinc-800 p-4 sm:p-5 rounded-2xl flex justify-between items-center">
          <div className="text-zinc-500 text-[10px] sm:text-[10.5px] font-mono uppercase tracking-[0.1em]">签证状态</div>
          <div className="text-xs font-semibold text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-full border border-amber-400/20">
            {gameState.visa}
          </div>
        </div>

        {/* Combined Assets & Lifestyle */}
        <div className="col-span-2 md:col-span-4 bg-zinc-900 border border-zinc-800 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div className="text-zinc-500 text-[10px] sm:text-[10.5px] font-mono uppercase tracking-[0.1em] shrink-0">名下资产</div>
          <div className="flex flex-wrap gap-1.5 justify-start sm:justify-end w-full sm:w-auto">
            <span className="text-xs font-semibold text-emerald-300 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 truncate max-w-[220px]" title={displayHousing}>
              {displayHousing}
            </span>
            {hasCar && displayCar && (
              <span className="text-xs font-semibold text-indigo-300 bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20">
                {displayCar}
              </span>
            )}
          </div>
        </div>

        {/* Timeline */}
        <div className="col-span-2 md:col-span-4 bg-zinc-900 border border-zinc-800 p-4 sm:p-5 rounded-2xl flex justify-between items-center">
          <div>
            <div className="text-zinc-400 text-[10px] sm:text-[10.5px] font-mono font-medium uppercase tracking-[0.15em] mb-1">当前年份</div>
            <div className="text-lg sm:text-xl font-bold font-mono tabular-nums text-zinc-200">{gameState.year} 年</div>
          </div>
          <div className="text-right">
            <div className="text-zinc-400 text-[10px] sm:text-[10.5px] font-mono font-medium uppercase tracking-[0.15em] mb-1">年龄</div>
            <div className="text-lg sm:text-xl font-bold font-mono tabular-nums text-zinc-200">{gameState.age} 岁</div>
          </div>
        </div>
      </div>
    </div>
  );
};
