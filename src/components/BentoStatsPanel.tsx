import React from 'react';
import type { GameState } from '../types';

interface BentoStatsPanelProps {
  gameState: GameState;
  currentEventId: string;
  onOpenCodex?: () => void;
  onOpenShop?: () => void;
  onToggleSound?: () => void;
  isMuted?: boolean;
  hasOpenedShop?: boolean;
}

const BentoStatsPanelComponent: React.FC<BentoStatsPanelProps> = ({
  gameState,
  currentEventId,
  onOpenCodex,
  onOpenShop,
  onToggleSound,
  isMuted,
  hasOpenedShop = false,
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

  const getGcStationIndex = () => {
    if (gameState.visa === '公民' || gameState.visa === '绿卡') return 5;
    const stage = gameState.gc_stage || 'not_started';
    const prog = gameState.gc_progress || 0;
    if (stage === 'i485_pending' || stage === 'approved' || prog >= 4.5) return 5;
    if (stage === 'waiting_pd' || prog >= 3.5) return 4;
    if (stage === 'i140_processing' || stage === 'i140_rfe' || stage === 'i140_approved' || prog >= 2) return 3;
    if (stage === 'perm_audit' || prog >= 1.5) return 2;
    if (stage === 'perm_processing' || prog > 0) return 1;
    return 0;
  };
  const gcStation = getGcStationIndex();

  const getDisplayVisa = () => {
    if (gameState.visa === '公民') {
      return {
        label: '美籍公民 (SSR)',
        className: 'text-blue-300 bg-blue-500/15 border-blue-500/30 shadow-[0_0_8px_rgba(59,130,246,0.25)] font-bold',
      };
    }
    if (gameState.visa === '绿卡') {
      return {
        label: '美国绿卡 (PR)',
        className: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.25)] font-bold',
      };
    }
    if (gameState.gc_stage === 'i485_pending') {
      return {
        label: 'I-485 Pending (EAD)',
        className: 'text-teal-300 bg-teal-500/15 border-teal-500/30 font-bold',
      };
    }
    if (gameState.visa === 'O1 (杰出人才)') {
      return {
        label: 'O-1 (杰出人才)',
        className: 'text-purple-300 bg-purple-500/15 border-purple-500/30 font-bold',
      };
    }
    if (gameState.visa === 'L1 (外派)') {
      return {
        label: 'L-1 (跨国外派)',
        className: 'text-cyan-300 bg-cyan-500/15 border-cyan-500/30 font-bold',
      };
    }
    if (gameState.visa === 'Day 1 CPT') {
      return {
        label: 'Day 1 CPT (学籍)',
        className: 'text-indigo-300 bg-indigo-500/15 border-indigo-500/30 font-bold',
      };
    }
    if (gameState.visa === 'H1B (工签)') {
      const isLocked = ['i140_approved', 'waiting_pd'].includes(gameState.gc_stage || '');
      return {
        label: isLocked ? 'H-1B (已锁PD)' : 'H-1B (工作签证)',
        className: 'text-amber-300 bg-amber-500/15 border-amber-500/30 font-bold',
      };
    }
    if (gameState.visa === 'OPT (实习)') {
      const isStem = (gameState.h1b_attempts || 0) >= 1;
      return {
        label: isStem ? 'STEM OPT (延期)' : 'Initial OPT (1年)',
        className: 'text-amber-400 bg-amber-400/10 border-amber-400/20 font-semibold',
      };
    }
    if (gameState.visa === 'F1 (学生)') {
      return {
        label: 'F-1 (在读学生)',
        className: 'text-sky-300 bg-sky-500/10 border-sky-500/20 font-semibold',
      };
    }
    if (!gameState.visa || gameState.visa === '无') {
      return {
        label: gameState.has_us_degree ? '待定身份' : '暂无 (未赴美)',
        className: 'text-zinc-400 bg-zinc-800/60 border-zinc-700 font-medium',
      };
    }
    return {
      label: gameState.visa,
      className: 'text-amber-400 bg-amber-400/10 border-amber-400/20 font-semibold',
    };
  };
  const visaDisplay = getDisplayVisa();

  const getDisplayCompany = () => {
    if (gameState.laid_off || gameState.job_type === 'unemployed') {
      return {
        label: '待业求职中',
        className: 'text-rose-400 bg-rose-500/10 border-rose-500/20 font-bold',
      };
    }

    if (gameState.company === 'icc') {
      return {
        label: 'ICC 外包 (挂靠)',
        className: 'text-amber-400 bg-amber-950/40 border-amber-600/30 font-bold',
      };
    }

    if (gameState.job_type === 'startup_founder') {
      const stageName = gameState.founder_stage === 'exit' ? '上市独角兽' : gameState.founder_stage === 'series_a' ? 'A轮独角兽' : 'AI 独角兽';
      return {
        label: `${stageName} Founder`,
        className: 'text-purple-300 bg-purple-500/15 border-purple-500/30 shadow-[0_0_8px_rgba(168,85,247,0.25)] font-bold',
      };
    }

    if (gameState.job_type === 'quant' || gameState.company === 'two_sigma' || gameState.company === 'citadel' || gameState.company === 'jane_street') {
      return {
        label: 'Top Quant (量化)',
        className: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20 font-bold',
      };
    }

    if (gameState.job_type === 'ai_research' || gameState.company === 'openai' || gameState.company === 'anthropic') {
      return {
        label: 'OpenAI / MTS',
        className: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20 font-bold',
      };
    }

    if (gameState.job_type === 'trader') {
      return {
        label: '全职 Trader',
        className: 'text-amber-300 bg-amber-500/10 border-amber-500/20 font-bold',
      };
    }

    if (gameState.company === 'google') {
      return {
        label: 'Google (谷歌)',
        className: 'text-blue-400 bg-blue-500/10 border-blue-500/20 font-bold',
      };
    }

    if (gameState.company === 'meta') {
      return {
        label: 'Meta (卷王)',
        className: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20 font-bold',
      };
    }

    if (gameState.company === 'nvidia' || gameState.job_type === 'nvidia') {
      return {
        label: 'NVIDIA (英伟达)',
        className: 'text-lime-400 bg-lime-500/10 border-lime-500/20 font-bold',
      };
    }

    if (gameState.company === 'tiktok' || gameState.job_type === 'tiktok') {
      return {
        label: 'TikTok (字节)',
        className: 'text-rose-400 bg-rose-500/10 border-rose-500/20 font-bold',
      };
    }

    if (gameState.company === 'apple') {
      return {
        label: 'Apple (苹果)',
        className: 'text-zinc-300 bg-zinc-700/30 border-zinc-600/40 font-bold',
      };
    }

    if (gameState.company === 'amazon' || gameState.job_type === 'amazon') {
      return {
        label: 'Amazon (亚麻)',
        className: 'text-amber-400 bg-amber-500/10 border-amber-500/20 font-bold',
      };
    }

    if (gameState.job_type === 'startup') {
      return {
        label: 'AI Startup (初创)',
        className: 'text-orange-400 bg-orange-500/10 border-orange-500/20 font-bold',
      };
    }

    if (gameState.job_type === 'big_tech') {
      return {
        label: '硅谷科技大厂',
        className: 'text-purple-300 bg-purple-500/10 border-purple-500/20 font-bold',
      };
    }

    if (!gameState.job_type) {
      return {
        label: '学生在读',
        className: 'text-sky-300 bg-sky-500/10 border-sky-500/20 font-medium',
      };
    }

    return {
      label: '科技公司',
      className: 'text-zinc-300 bg-zinc-800/60 border-zinc-700 font-semibold',
    };
  };
  const companyDisplay = getDisplayCompany();

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
            {onOpenShop && gameState.job_type !== undefined && (
              <button
                onClick={onOpenShop}
                className="relative px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 via-emerald-500/20 to-amber-500/20 hover:from-amber-500/30 hover:to-emerald-500/30 text-amber-300 border border-amber-500/40 font-mono font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/10 active:scale-95 transition-all cursor-pointer group"
              >
                <svg className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                <span>[S] 商城</span>
                {!hasOpenedShop && (
                  <>
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping absolute -top-0.5 -right-0.5" />
                    <span className="w-2 h-2 rounded-full bg-amber-400 absolute -top-0.5 -right-0.5" />
                  </>
                )}
              </button>
            )}
            {onOpenCodex && (
              <button
                onClick={onOpenCodex}
                className="px-3 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 font-mono font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-purple-500/10 active:scale-95 transition-all cursor-pointer"
              >
                <svg className="w-3.5 h-3.5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.45 1-1 1H7v4h10v-4h-2c-.55 0-1-.45-1-1v-2.34M18 4H6v7a6 6 0 0 0 12 0V4z"/></svg>
                <span>[C] 图鉴</span>
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
              {gameState.macro_economy === 'bull' ? '狂暴大牛市' : gameState.macro_economy === 'bear' ? '裁员大熊市' : '正常震荡期'}
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
        {((gameState.gc_progress || 0) > 0 || gameState.visa === '绿卡' || gameState.visa === '公民' || (gameState.job_type && gameState.job_type !== 'unemployed')) && !['choose_trait', 'choose_year', 'choose_school', 'end'].includes(currentEventId) && (
          <div className="col-span-2 md:col-span-4 bg-zinc-900/95 border border-emerald-500/30 p-3.5 sm:p-4 rounded-2xl flex flex-col justify-between relative overflow-hidden shadow-lg backdrop-blur-xl">
            <div className="flex flex-row justify-between items-center mb-2">
              <div className="text-emerald-400 text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-[0.18em] flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                身份与绿卡进度 (Immigration Status)
              </div>
              <div className="text-xs font-mono font-extrabold text-emerald-300 tabular-nums">
                {gameState.visa === '公民'
                  ? '100% (美籍公民)'
                  : gameState.visa === '绿卡' 
                    ? '100% (已获绿卡)' 
                    : (gameState.gc_progress || 0) > 0
                      ? `${Math.round(Math.min(100, Math.max(0, ((gameState.gc_progress || 0) / 5) * 100)))}% (${gameState.gc_progress || 0}/5 年排期)`
                      : '0% (PERM 筹备中)'}
              </div>
            </div>
            <div className="w-full bg-zinc-950 rounded-full h-2.5 overflow-hidden border border-emerald-500/20">
              <div 
                className="h-full rounded-full bg-gradient-to-r from-emerald-600 via-emerald-400 to-teal-300 transition-all duration-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" 
                style={{ width: `${(gameState.visa === '绿卡' || gameState.visa === '公民') ? 100 : Math.min(100, Math.max(0, ((gameState.gc_progress || 0) / 5) * 100))}%` }}
              />
            </div>

            {/* 5-Station American Green Card Subway Line Tracker */}
            <div className="mt-3 pt-2.5 border-t border-zinc-800/80 flex items-center justify-between gap-1 text-[10px] sm:text-[11px] font-mono">
              {[
                { label: 'PERM广告', station: 1 },
                { label: '劳工部获批', station: 2 },
                { label: 'I-140锁PD', station: 3 },
                { label: '排期等待', station: 4 },
                { label: 'I-485制卡', station: 5 },
              ].map((step, idx, arr) => {
                const isDone = gameState.visa === '公民' || gameState.visa === '绿卡' || gcStation > step.station;
                const isActive = !isDone && gcStation === step.station;
                return (
                  <React.Fragment key={step.label}>
                    <div className={`flex items-center gap-1 shrink-0 ${isDone ? 'text-emerald-400 font-bold' : isActive ? 'text-amber-300 font-extrabold' : 'text-zinc-500'}`}>
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-mono border ${
                        isDone 
                          ? 'bg-emerald-500 text-zinc-950 border-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.5)]' 
                          : isActive 
                            ? 'bg-amber-400/20 text-amber-300 border-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.6)]' 
                            : 'bg-zinc-800 text-zinc-500 border-zinc-700'
                      }`}>
                        {isDone ? '✓' : step.station}
                      </span>
                      <span className="hidden xl:inline">{step.label}</span>
                    </div>
                    {idx < arr.length - 1 && (
                      <div className={`h-[1px] flex-1 mx-0.5 ${isDone ? 'bg-emerald-500/60' : 'bg-zinc-800'}`} />
                    )}
                  </React.Fragment>
                );
              })}
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

        {/* 4. Status Badges (Company, Level, Visa, Relationship) */}
        {/* Card 1: 当前雇主 */}
        <div className="col-span-1 md:col-span-1 bg-zinc-900/90 border border-zinc-800/80 p-3.5 sm:p-4 rounded-2xl flex flex-col justify-between backdrop-blur-xl transition-all duration-300 hover:border-zinc-700 min-h-[76px] sm:min-h-[82px]">
          <div className="text-zinc-500 text-[10px] sm:text-[11px] font-mono uppercase tracking-[0.15em] mb-1.5 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-blue-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
            <span>当前雇主</span>
          </div>
          <div className="flex items-center">
            <span className={`text-xs sm:text-[13px] px-2.5 py-0.5 rounded-lg border font-bold ${companyDisplay.className}`}>
              {companyDisplay.label}
            </span>
          </div>
        </div>

        {/* Card 2: 当前职级 */}
        <div className="col-span-1 md:col-span-1 bg-zinc-900/90 border border-zinc-800/80 p-3.5 sm:p-4 rounded-2xl flex flex-col justify-between backdrop-blur-xl transition-all duration-300 hover:border-zinc-700 min-h-[76px] sm:min-h-[82px]">
          <div className="text-zinc-500 text-[10px] sm:text-[11px] font-mono uppercase tracking-[0.15em] mb-1.5 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-purple-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            <span>当前职级</span>
          </div>
          <div className="flex items-center">
            <span className={`text-xs sm:text-[13px] font-bold px-2.5 py-0.5 rounded-lg border ${
              displayLevel.includes('L8') || displayLevel.includes('Principal') || displayLevel.includes('Fellow')
                ? 'text-amber-300 bg-amber-500/15 border-amber-500/30 shadow-[0_0_8px_rgba(251,191,36,0.3)]'
                : displayLevel.includes('L7') || displayLevel.includes('Senior Staff')
                  ? 'text-fuchsia-300 bg-fuchsia-500/15 border-fuchsia-500/30 shadow-[0_0_8px_rgba(217,70,239,0.25)]'
                  : displayLevel.includes('L6') || displayLevel.includes('Staff') || displayLevel.includes('MTS')
                    ? 'text-purple-300 bg-purple-500/15 border-purple-500/30'
                    : 'text-purple-300 bg-purple-500/10 border-purple-500/20'
            }`}>
              {displayLevel}
            </span>
          </div>
        </div>

        {/* Card 3: 签证身份 */}
        <div className="col-span-1 md:col-span-1 bg-zinc-900/90 border border-zinc-800/80 p-3.5 sm:p-4 rounded-2xl flex flex-col justify-between backdrop-blur-xl transition-all duration-300 hover:border-zinc-700 min-h-[76px] sm:min-h-[82px]">
          <div className="text-zinc-500 text-[10px] sm:text-[11px] font-mono uppercase tracking-[0.15em] mb-1.5 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-amber-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="7" y1="8" x2="17" y2="8"/><line x1="7" y1="12" x2="13" y2="12"/></svg>
            <span>签证身份</span>
          </div>
          <div className="flex items-center">
            <span className={`text-xs sm:text-[13px] px-2.5 py-0.5 rounded-lg border font-bold ${visaDisplay.className}`}>
              {visaDisplay.label}
            </span>
          </div>
        </div>

        {/* Card 4: 婚恋与感情状态 */}
        <div className="col-span-1 md:col-span-1 bg-zinc-900/90 border border-zinc-800/80 p-3.5 sm:p-4 rounded-2xl flex flex-col justify-between backdrop-blur-xl transition-all duration-300 hover:border-zinc-700 min-h-[76px] sm:min-h-[82px]">
          <div className="text-zinc-500 text-[10px] sm:text-[11px] font-mono uppercase tracking-[0.15em] mb-1.5 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-pink-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            <span>感情状态</span>
          </div>
          <div className="flex items-center">
            <span className={`text-xs sm:text-[13px] font-bold px-2.5 py-0.5 rounded-lg border ${
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
                    ? '相亲中'
                    : '单身'}
            </span>
          </div>
        </div>

        {/* 5. Assets & Lifestyle Equipment */}
        <div className="col-span-2 md:col-span-4 bg-zinc-900/90 border border-zinc-800/80 p-4 rounded-2xl flex flex-col gap-2.5 backdrop-blur-xl">
          <div className="flex justify-between items-center">
            <div className="text-zinc-400 text-[10px] sm:text-[11px] font-mono uppercase tracking-[0.18em]">湾区房产与资产配置</div>
            {(gameState.rental_income !== undefined && gameState.rental_income > 0) && (
              <span className="text-[11px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 shadow-[0_0_8px_rgba(16,185,129,0.15)] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                被动租金流: +${gameState.rental_income.toFixed(1)}w/年
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-semibold text-emerald-300 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20 flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              {displayHousing}
              {gameState.has_adu_rented && (
                <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30">ADU出租中</span>
              )}
            </span>

            {/* Investment Properties */}
            {(gameState.investment_properties || []).map((prop, idx) => (
              <span key={idx} className="text-xs font-semibold text-teal-300 bg-teal-500/10 px-3 py-1.5 rounded-xl border border-teal-500/20 flex items-center gap-1.5 shadow-[0_0_8px_rgba(20,184,166,0.1)]">
                <svg className="w-3.5 h-3.5 text-teal-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
                <span>{prop}</span>
                <span className="text-[10px] font-mono font-bold text-teal-400 bg-teal-500/20 px-1 rounded">收租中</span>
              </span>
            ))}

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
            <div className="flex items-center gap-2">
              <div className={`text-sm sm:text-base font-bold font-mono ${gameState.difficulty_title === '简单难度' ? 'text-emerald-400' : gameState.difficulty_title === '困难难度' ? 'text-rose-400' : 'text-amber-400'}`}>
                {gameState.difficulty_title || '普通难度'}
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700/60 text-zinc-300">
                {gameState.difficulty_title === '简单难度' ? '宽松周期 · 发展顺遂' : gameState.difficulty_title === '困难难度' ? '地狱 AI · 极速内卷' : '周期交替 · 稳扎稳打'}
              </span>
            </div>
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

export const BentoStatsPanel = React.memo(BentoStatsPanelComponent);
