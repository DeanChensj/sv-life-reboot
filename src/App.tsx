import { useState, useEffect } from 'react';
import type { GameState, Choice } from './types';
import { generateInitialState, events } from './data/events';
import { BentoStatsPanel } from './components/BentoStatsPanel';
import { CharacterProfileModal } from './components/CharacterProfileModal';
import { YearEndStatementModal } from './components/YearEndStatementModal';
import { WarReportModal } from './components/WarReportModal';
import { AchievementCodexModal } from './components/AchievementCodexModal';
import { checkAndUnlockAchievements, ACHIEVEMENTS } from './data/achievements';

export default function App() {
  const [gameState, setGameState] = useState<GameState>(generateInitialState);
  const [currentEventId, setCurrentEventId] = useState<string>('choose_trait');
  const [isMobileStatsOpen, setIsMobileStatsOpen] = useState<boolean>(false);
  const [showCharacterPass, setShowCharacterPass] = useState<boolean>(false);
  const [showWarReport, setShowWarReport] = useState<boolean>(false);
  const [showAchievementCodex, setShowAchievementCodex] = useState<boolean>(false);
  const [achievementToast, setAchievementToast] = useState<string | null>(null);

  useEffect(() => {
    const newlyUnlocked = checkAndUnlockAchievements(gameState, currentEventId);
    if (newlyUnlocked.length > 0) {
      const ach = ACHIEVEMENTS.find(a => a.id === newlyUnlocked[0]);
      if (ach) {
        setAchievementToast(`[成就解锁] 恭喜获得隐藏成就：${ach.title}`);
        setTimeout(() => setAchievementToast(null), 4500);
      }
    }
  }, [gameState, currentEventId]);

  useEffect(() => {
    const cardEl = document.getElementById('event-decision-card');
    if (cardEl && window.innerWidth < 1024) {
      cardEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentEventId]);

  const currentEvent = events[currentEventId];

  const handleChoice = (choice: Choice) => {
    // 1. Calculate new state
    const newState = { ...gameState, message: '', laid_off: false, imageUrl: undefined }; // Clear old message, image and generic flags
    const effectResult = choice.effect(gameState);
    Object.assign(newState, effectResult); // Apply new effects
    
    // Auto increment year based on age difference, ONLY if year wasn't explicitly set
    if (effectResult.age !== undefined && effectResult.age > gameState.age) {
      if (effectResult.year === undefined) {
        newState.year = gameState.year + (effectResult.age - gameState.age);
      }
    }

    // Clamp stats
    newState.health = Math.max(0, Math.min(100, newState.health));
    newState.leetcode = Math.max(0, Math.min(100, newState.leetcode));
    newState.charm = Math.max(0, Math.min(25, newState.charm));

    // Check if health drops <= 0
    if (newState.health <= 0 && newState.status === 'playing') {
      newState.status = 'game_over';
      if (!effectResult.message) {
        newState.message = '你因为过度劳累而猝死 (Burnout)，游戏结束！';
      } else {
        newState.message += ' 然而由于长期高压与过度劳累，你突发心梗，倒在了工位上...游戏结束。';
      }
    }

    // Check if bankrupt
    if (newState.cash < -0.001 && newState.status === 'playing') {
      newState.status = 'game_over';
      if (!effectResult.message) {
        newState.message = '你破产了，无法支付账单，游戏结束！';
      } else {
        newState.message += ' 但由于你负债累累，资金链彻底断裂，游戏结束！';
      }
    }

    // Check FIRE win
    if (newState.cash >= newState.win_threshold && newState.status === 'playing') {
      newState.status = 'win';
      newState.message = `你的资产突破了 ${newState.win_threshold} 万美元！你正式达成了个人的 FIRE 目标（财务自由，提前退休）。你再也不需要看任何人的脸色，可以去做自己真正想做的事情了！`;
    }

    setGameState(newState);
    setIsMobileStatsOpen(false); // Close mobile drawer if open

    // 2. Transition to next event
    if (newState.status !== 'playing') {
      setCurrentEventId('end');
    } else {
      let nextId = typeof choice.nextEventId === 'function' ? choice.nextEventId(newState) : choice.nextEventId;
      
      // Trigger Character Pass Modal after school selection
      if (currentEventId === 'choose_school') {
        setShowCharacterPass(true);
      }

      if (nextId === 'sv_daily_life' && newState.ap <= 0) {
        nextId = 'sv_year_end_settlement';
      }
      setCurrentEventId(nextId);
    }
  };

  const resetGame = () => {
    localStorage.removeItem('sv_life_initial_seed');
    setGameState(generateInitialState());
    setCurrentEventId('choose_trait');
    setShowCharacterPass(false);
    setShowWarReport(false);
  };

  const handleYearEndContinue = () => {
    const settlementChoice = events['sv_year_end_settlement']?.choices[0];
    if (settlementChoice) {
      handleChoice(settlementChoice);
    }
  };

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentEventId]);

  const getImgSrc = (url: string) => {
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const base = import.meta.env.BASE_URL || '/';
    const cleanBase = base.endsWith('/') ? base : `${base}/`;
    const cleanUrl = url.startsWith('/') ? url.slice(1) : url;
    return `${cleanBase}${cleanUrl}`;
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Character Creation Pass Modal */}
      {showCharacterPass && (
        <CharacterProfileModal
          gameState={gameState}
          onConfirm={() => setShowCharacterPass(false)}
        />
      )}

      {/* Year End Settlement Modal */}
      {currentEventId === 'sv_year_end_settlement' && gameState.status === 'playing' && (
        <YearEndStatementModal
          gameState={gameState}
          onContinue={handleYearEndContinue}
        />
      )}

      {/* War Report Canvas Modal */}
      {showWarReport && (
        <WarReportModal
          gameState={gameState}
          onClose={() => setShowWarReport(false)}
        />
      )}

      {/* Achievement Codex Modal */}
      {showAchievementCodex && (
        <AchievementCodexModal
          onClose={() => setShowAchievementCodex(false)}
        />
      )}

      {/* Achievement Unlock Toast */}
      {achievementToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-purple-900/90 via-indigo-900/90 to-zinc-900/90 border border-purple-500/50 text-purple-200 px-6 py-3 rounded-2xl shadow-2xl backdrop-blur-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300 font-bold text-sm">
          <span>{achievementToast}</span>
          <button
            onClick={() => setShowAchievementCodex(true)}
            className="text-xs text-purple-300 hover:text-white underline font-mono cursor-pointer"
          >
            查看图鉴 ➔
          </button>
        </div>
      )}

      {/* Mobile Sticky 2-Layer Mini-HUD Header */}
      <div className="lg:hidden sticky top-0 z-40 bg-zinc-950/95 backdrop-blur-2xl border-b border-zinc-800/80 px-3 py-2 shadow-2xl flex flex-col gap-1.5 text-xs font-mono">
        {/* Layer 1: Year/Age, AP, Cash, TC, Drawer Toggle */}
        <div className="flex items-center justify-between gap-1.5 w-full">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {/* Age & Year Tag */}
            <span className="flex items-center gap-1 font-bold text-[11px] text-zinc-200 bg-zinc-900 px-2 py-0.5 rounded-md shrink-0 border border-zinc-800">
              <svg className="w-3 h-3 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              {gameState.year}年·{gameState.age}岁
            </span>

            {/* Action Points (AP) Tag */}
            {gameState.ap !== undefined && (
              <span className="flex items-center gap-1 font-extrabold text-indigo-300 shrink-0 bg-indigo-500/15 px-2 py-0.5 rounded-md border border-indigo-500/30 shadow-[0_0_10px_rgba(99,102,241,0.25)] tabular-nums">
                <svg className="w-3 h-3 text-indigo-400 fill-indigo-400/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 10 11 22 21 10 12 10 13 2"/></svg>
                AP {gameState.ap}/{gameState.max_ap || 3}
              </span>
            )}

            {/* Cash Tag */}
            <span className="flex items-center gap-1 font-black text-emerald-400 shrink-0 bg-emerald-500/10 px-2.5 py-0.5 rounded-md border border-emerald-500/20 tabular-nums">
              <svg className="w-3 h-3 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              ${gameState.cash.toFixed(1)}w
            </span>

            {/* TC Tag */}
            <span className="flex items-center gap-1 text-zinc-300 shrink-0 bg-zinc-900 px-2 py-0.5 rounded-md border border-zinc-800 tabular-nums">
              <span className="text-zinc-500 text-[10px] uppercase font-bold">TC</span>
              <strong className="text-zinc-200 font-bold">${gameState.tc}w</strong>
            </span>
          </div>

          <button
            onClick={() => setIsMobileStatsOpen(!isMobileStatsOpen)}
            className={`shrink-0 px-2 py-0.5 rounded-lg text-[10px] font-extrabold border transition-all duration-200 active:scale-95 cursor-pointer ${
              isMobileStatsOpen 
                ? 'bg-emerald-500 text-zinc-950 border-emerald-400 shadow-lg shadow-emerald-500/20' 
                : 'bg-zinc-800/90 hover:bg-zinc-700 text-emerald-300 border-zinc-700/80'
            }`}
          >
            {isMobileStatsOpen ? '收起 ▲' : '全量属性 ▼'}
          </button>
        </div>

        {/* Layer 2: Status Badges (Health, Level, Visa, Green Card, Codex) */}
        <div className="flex items-center justify-between gap-1.5 w-full pt-1 border-t border-zinc-900/80">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {/* Health Tag */}
            <span className={`flex items-center gap-1 font-bold text-[11px] shrink-0 px-2 py-0.5 rounded-md border tabular-nums ${
              gameState.health >= 70 
                ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' 
                : gameState.health >= 40 
                  ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' 
                  : 'text-rose-400 bg-rose-500/10 border-rose-500/20'
            }`}>
              <svg className="w-3 h-3 text-rose-400 fill-rose-400/20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              健康 {Math.max(0, gameState.health)}
            </span>

            {/* Level Tag */}
            <span className="flex items-center gap-1 font-bold text-[11px] text-purple-300 shrink-0 bg-purple-500/10 px-2 py-0.5 rounded-md border border-purple-500/20">
              <span className="text-purple-400 font-extrabold">职级</span> {gameState.level || (gameState.job_type === 'unemployed' || gameState.laid_off || !gameState.job_type ? '待业' : gameState.job_type === 'quant' ? 'Quant' : gameState.job_type === 'ai_research' ? 'MTS' : gameState.is_phd ? 'L4' : 'L3')}
            </span>

            {/* Visa Tag */}
            <span className="flex items-center gap-1 font-semibold text-[11px] text-amber-300 shrink-0 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
              <svg className="w-3 h-3 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              {gameState.visa}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Achievement Codex Mobile Button */}
            <button
              onClick={() => setShowAchievementCodex(true)}
              className="px-2 py-0.5 rounded-md bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
            >
              <svg className="w-3 h-3 text-purple-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.45 1-1 1H7v4h10v-4h-2c-.55 0-1-.45-1-1v-2.34M18 4H6v7a6 6 0 0 0 12 0V4z"/></svg>
              <span>图鉴</span>
            </button>

            {/* Green Card Progress Tag (Mobile HUD) */}
            {((gameState.gc_progress || 0) > 0 || gameState.visa === '绿卡' || (gameState.job_type && gameState.job_type !== 'unemployed')) && (
              <span className="flex items-center gap-1.5 font-bold text-[10px] text-emerald-300 shrink-0 bg-emerald-500/15 px-2 py-0.5 rounded-md border border-emerald-500/30 tabular-nums">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                GC: {gameState.visa === '绿卡' ? '100%' : `${Math.round(Math.min(100, Math.max(0, ((gameState.gc_progress || 0) / 5) * 100)))}%`}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Slide-Down Drawer Overlay */}
      {isMobileStatsOpen && (
        <div className="lg:hidden fixed inset-x-0 top-[42px] bottom-0 z-50 bg-zinc-950/95 backdrop-blur-2xl p-4 overflow-y-auto animate-in fade-in slide-in-from-top-3 duration-200">
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-zinc-800">
            <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-widest">角色档案与 Bento 属性面板</span>
            <button 
              onClick={() => setIsMobileStatsOpen(false)}
              className="text-xs text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-3 py-1 rounded-full font-bold border border-zinc-700 active:scale-95 transition-all"
            >
              完成返回决策 ✕
            </button>
          </div>
          <BentoStatsPanel gameState={gameState} currentEventId={currentEventId} onOpenCodex={() => setShowAchievementCodex(true)} />
        </div>
      )}

      <div className="max-w-[1400px] mx-auto p-4 md:p-8 lg:p-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-start">
          
          {/* Left Sticky Bento Panel (Desktop Only, Mobile uses sliding drawer) */}
          <div className="hidden lg:flex lg:col-span-5 flex-col sticky top-12">
            <BentoStatsPanel gameState={gameState} currentEventId={currentEventId} onOpenCodex={() => setShowAchievementCodex(true)} />
          </div>

          {/* Right Column: Event Narrative & Decisions */}
          <div className="col-span-1 lg:col-span-7 flex flex-col justify-center min-h-[65vh] lg:min-h-[80vh] lg:pl-8 xl:pl-16">
            
            {/* Message Banner */}
            {gameState.message && (
              <div aria-live="polite" role="status" className="border-l-2 border-emerald-500 bg-emerald-500/10 text-emerald-300 px-5 py-4 rounded-r-lg mb-8 text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300">
                {gameState.message}
              </div>
            )}

            {/* Event Card */}
            <div key={currentEventId} id="event-decision-card" className="scroll-mt-14 bg-zinc-900/40 rounded-3xl p-8 md:p-12 border border-zinc-800 backdrop-blur-md transition-all duration-300 shadow-2xl animate-in fade-in duration-500 slide-in-from-bottom-2">
              {gameState.status === 'playing' && currentEvent ? (
                <>
                  <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-zinc-50 mb-6">{currentEvent.title}</h2>
                  
                  {gameState.imageUrl && (
                    <img 
                      src={getImgSrc(gameState.imageUrl)} 
                      alt="Event Scene" 
                      className="w-full h-48 md:h-72 object-cover rounded-2xl mb-8 shadow-2xl border border-zinc-700/50 transition-all duration-500 ease-out"
                      style={{ imageRendering: 'pixelated' }}
                    />
                  )}

                  <p className="text-zinc-400 mb-10 text-lg md:text-xl leading-relaxed">{currentEvent.description}</p>
                  
                  <div className="flex flex-col space-y-4">
                    {currentEvent.choices
                      .filter((choice) => {
                        const isAvailable = !choice.condition || choice.condition(gameState);
                        if (!isAvailable && (choice.hideIfUnavailable || choice.text.includes('今年限时机会'))) {
                          return false;
                        }
                        return true;
                      })
                      .map((choice, idx) => {
                      const isAvailable = !choice.condition || choice.condition(gameState);
                      
                      // Precise badge extraction (prioritize Choice.costBadge / Choice.reqBadge if defined)
                      const costMatch = choice.costBadge || choice.text.match(/\((?:消耗|花费|每年|\$|成本|折抵|实付).*?\)/)?.[0]?.slice(1, -1);
                      const reqMatch = choice.reqBadge || choice.text.match(/\((?:需要|需|算法|高魅力|现金).*?\)/)?.[0]?.slice(1, -1);
                      
                      let mainText = choice.text
                        .replace(/\((?:消耗|花费|每年|\$|成本|折抵|实付).*?\)/g, '')
                        .replace(/\((?:需要|需|算法|高魅力|现金).*?\)/g, '')
                        .trim();
                      
                      if (mainText.endsWith('-')) {
                        mainText = mainText.slice(0, -1).trim();
                      }
                      
                      return (
                      <button
                        key={idx}
                        onClick={() => isAvailable && handleChoice(choice)}
                        disabled={!isAvailable}
                        className={`group w-full text-left px-6 py-5 rounded-2xl border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer ${
                          isAvailable 
                            ? 'bg-zinc-900 border-zinc-800 hover:border-emerald-500/50 hover:bg-zinc-800/80 active:scale-[0.98]' 
                            : 'bg-zinc-950/50 border-zinc-800/50 opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <span className={`font-medium text-lg transition-colors ${isAvailable ? 'text-zinc-300 group-hover:text-emerald-400' : 'text-zinc-600'}`}>
                          {mainText}
                        </span>
                        
                        <div className="flex flex-wrap gap-2 items-center">
                          {costMatch && (
                             <span className={`text-xs px-2.5 py-1 rounded-md font-semibold tracking-wide ${isAvailable ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/20' : 'bg-zinc-800 text-zinc-500'}`}>
                                {costMatch}
                             </span>
                          )}
                          {reqMatch && (
                             <span className={`text-xs px-2.5 py-1 rounded-md font-semibold tracking-wide ${isAvailable ? 'bg-amber-500/20 text-amber-300 border border-amber-500/20' : 'bg-zinc-800 text-zinc-500'}`}>
                                {reqMatch}
                             </span>
                          )}
                          {!isAvailable && (
                            <span className="text-xs px-2.5 py-1 rounded-md font-bold tracking-wide bg-red-500/10 text-red-400 border border-red-500/20">
                              条件未满足
                            </span>
                          )}
                        </div>
                      </button>
                    )})}
                  </div>
                </>
               ) : (
                <div className="py-8 animate-in fade-in duration-500">
                  <div className="text-center mb-8">
                    <span className={`text-xs font-mono font-bold uppercase tracking-[0.25em] px-4 py-1.5 rounded-full border ${gameState.status === 'win' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                      {gameState.status === 'win' ? 'STATUS: FIRE ACHIEVED' : 'STATUS: SURVIVAL TERMINATED'}
                    </span>
                    <h2 className={`text-4xl md:text-5xl font-extrabold tracking-tight mt-4 mb-3 ${gameState.status === 'win' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {gameState.status === 'win' ? '人生巅峰：财务自由！' : '硅谷生存结语'}
                    </h2>
                    <p className="text-zinc-300 text-lg max-w-xl mx-auto leading-relaxed">
                      {gameState.message}
                    </p>
                  </div>

                  {/* Enhanced Bento Medals & Metallic Stats Card */}
                  <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 md:p-8 mb-8 relative overflow-hidden shadow-2xl">
                    <div className="text-xs font-mono font-medium uppercase tracking-[0.15em] text-zinc-500 mb-4 flex items-center justify-between">
                      <span>[ACHIEVED_MEDALS] 生涯荣誉里程碑与 SSR 勋章</span>
                      <span className="tabular-nums">{gameState.year} 年 | {gameState.age} 岁</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mb-6">
                      {gameState.leetcode >= 60 && (
                        <div className="bg-gradient-to-r from-amber-500/15 via-zinc-900 to-zinc-900 border border-amber-500/40 p-4 rounded-2xl flex items-center gap-3.5 shadow-[0_0_15px_rgba(251,191,36,0.15)]">
                          <span className="font-mono text-xs font-black px-2.5 py-1 rounded-lg bg-amber-400 text-zinc-950 shadow-md uppercase tracking-wider">SSR</span>
                          <div>
                            <div className="font-bold text-amber-300 text-sm">【做题神仙】</div>
                            <div className="text-xs text-zinc-400 mt-0.5">LeetCode 算法真经通关，随时手撕 Hard 题</div>
                          </div>
                        </div>
                      )}
                      {gameState.charm >= 18 && (
                        <div className="bg-gradient-to-r from-rose-500/15 via-zinc-900 to-zinc-900 border border-rose-500/40 p-4 rounded-2xl flex items-center gap-3.5 shadow-[0_0_15px_rgba(244,63,94,0.15)]">
                          <span className="font-mono text-xs font-black px-2.5 py-1 rounded-lg bg-rose-400 text-zinc-950 shadow-md uppercase tracking-wider">SR</span>
                          <div>
                            <div className="font-bold text-rose-300 text-sm">【南湾顶流名流】</div>
                            <div className="text-xs text-zinc-400 mt-0.5">魅力值爆表，Santana Row 相亲收割机</div>
                          </div>
                        </div>
                      )}
                      {(gameState.cash >= 300 || ['Atherton 顶级豪宅', 'Sunnyvale 老破小', 'North San Jose 联排', 'Fremont 学区房'].includes(gameState.housing_name || '')) && (
                        <div className="bg-gradient-to-r from-emerald-500/15 via-zinc-900 to-zinc-900 border border-emerald-500/40 p-4 rounded-2xl flex items-center gap-3.5 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                          <span className="font-mono text-xs font-black px-2.5 py-1 rounded-lg bg-emerald-400 text-zinc-950 shadow-md uppercase tracking-wider">SSR</span>
                          <div>
                            <div className="font-bold text-emerald-300 text-sm">【Atherton 征服者】</div>
                            <div className="text-xs text-zinc-400 mt-0.5">积攒重金，成功跨越硅谷阶级门槛</div>
                          </div>
                        </div>
                      )}
                      {gameState.car === 'cybertruck' && (
                        <div className="bg-gradient-to-r from-cyan-500/15 via-zinc-900 to-zinc-900 border border-cyan-500/40 p-4 rounded-2xl flex items-center gap-3.5 shadow-[0_0_15px_rgba(34,211,238,0.15)]">
                          <span className="font-mono text-xs font-black px-2.5 py-1 rounded-lg bg-cyan-400 text-zinc-950 shadow-md uppercase tracking-wider">SR</span>
                          <div>
                            <div className="font-bold text-cyan-300 text-sm">【赛博朋克硬核族】</div>
                            <div className="text-xs text-zinc-400 mt-0.5">驾驶多边形皮卡征服 237 号公路</div>
                          </div>
                        </div>
                      )}
                      {gameState.car === 'porsche' && (
                        <div className="bg-gradient-to-r from-purple-500/15 via-zinc-900 to-zinc-900 border border-purple-500/40 p-4 rounded-2xl flex items-center gap-3.5 shadow-[0_0_15px_rgba(192,132,252,0.15)]">
                          <span className="font-mono text-xs font-black px-2.5 py-1 rounded-lg bg-purple-400 text-zinc-950 shadow-md uppercase tracking-wider">SR</span>
                          <div>
                            <div className="font-bold text-purple-300 text-sm">【脱离民工车鄙视链】</div>
                            <div className="text-xs text-zinc-400 mt-0.5">告别街车 Model Y，开上保时捷震撼全场</div>
                          </div>
                        </div>
                      )}
                      {gameState.visa === '绿卡' && (
                        <div className="bg-gradient-to-r from-blue-500/15 via-zinc-900 to-zinc-900 border border-blue-500/40 p-4 rounded-2xl flex items-center gap-3.5 shadow-[0_0_15px_rgba(96,165,250,0.15)]">
                          <span className="font-mono text-xs font-black px-2.5 py-1 rounded-lg bg-blue-400 text-zinc-950 shadow-md uppercase tracking-wider">SSR</span>
                          <div>
                            <div className="font-bold text-blue-300 text-sm">【上岸自由身】</div>
                            <div className="text-xs text-zinc-400 mt-0.5">彻底甩开 USCIS 抽签与 H1B 签证枷锁</div>
                          </div>
                        </div>
                      )}
                      {gameState.status === 'game_over' && gameState.health <= 0 && (
                        <div className="bg-zinc-900/90 border border-red-500/30 p-4 rounded-2xl flex items-center gap-3">
                          <span className="font-mono text-xs font-bold px-2 py-1 rounded bg-red-500/10 text-red-300 border border-red-500/20 uppercase">OOF</span>
                          <div>
                            <div className="font-bold text-red-300 text-sm">【荣誉 Burnout 社畜】</div>
                            <div className="text-xs text-zinc-400">牺牲自我健康，照亮公司季度 OKR 交付</div>
                          </div>
                        </div>
                      )}
                      {gameState.status === 'game_over' && gameState.cash <= 0 && (
                        <div className="bg-zinc-900/90 border border-orange-500/30 p-4 rounded-2xl flex items-center gap-3">
                          <span className="font-mono text-xs font-bold px-2 py-1 rounded bg-orange-500/10 text-orange-300 border border-orange-500/20 uppercase">RIP</span>
                          <div>
                            <div className="font-bold text-orange-300 text-sm">【湾区月光大慈善家】</div>
                            <div className="text-xs text-zinc-400">把高额总包全额上交给了房东与 $13 奶茶</div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Stats Summary Table */}
                    <div className="grid grid-cols-4 gap-2 bg-zinc-900/60 p-4 rounded-2xl text-center text-xs">
                      <div>
                        <div className="text-zinc-500 font-mono text-[10px] uppercase tracking-wider mb-1">最终现金</div>
                        <div className="font-bold font-mono tabular-nums text-emerald-400 text-base">${gameState.cash.toFixed(1)}w</div>
                      </div>
                      <div>
                        <div className="text-zinc-500 font-mono text-[10px] uppercase tracking-wider mb-1">峰值总包</div>
                        <div className="font-bold font-mono tabular-nums text-zinc-100 text-base">${gameState.tc}w</div>
                      </div>
                      <div>
                        <div className="text-zinc-500 font-mono text-[10px] uppercase tracking-wider mb-1">LeetCode</div>
                        <div className="font-bold font-mono tabular-nums text-amber-300 text-base">{gameState.leetcode} 题</div>
                      </div>
                      <div>
                        <div className="text-zinc-500 font-mono text-[10px] uppercase tracking-wider mb-1">魅力指数</div>
                        <div className="font-bold font-mono tabular-nums text-rose-300 text-base">{gameState.charm} pts</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button
                      onClick={() => setShowWarReport(true)}
                      className="px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-zinc-950 font-extrabold text-base transition-all duration-200 active:scale-[0.985] shadow-lg shadow-emerald-500/20 cursor-pointer flex items-center justify-center gap-2.5"
                    >
                      <svg className="w-5 h-5 text-zinc-950" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                      <span>生成炫彩战报海报（朋友圈/小红书）</span>
                    </button>
                    <button
                      onClick={resetGame}
                      className="px-8 py-4 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 font-semibold text-base transition-all active:scale-[0.985] cursor-pointer"
                    >
                      再次重开人生
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

