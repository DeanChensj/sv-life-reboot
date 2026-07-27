import { useState, useEffect } from 'react';
import type { GameState, Choice } from './types';
import { generateInitialState, events } from './data/events';
import { BentoStatsPanel } from './components/BentoStatsPanel';
import { CharacterProfileModal } from './components/CharacterProfileModal';
import { YearEndStatementModal } from './components/YearEndStatementModal';
import { WarReportModal } from './components/WarReportModal';
import { AchievementCodexModal } from './components/AchievementCodexModal';
import { ShopModal } from './components/ShopModal';
import { WelcomeModal } from './components/WelcomeModal';
import { checkAndUnlockAchievements, ACHIEVEMENTS } from './data/achievements';
import { sound } from './utils/sound';

export default function App() {
  const [gameState, setGameState] = useState<GameState>(generateInitialState);
  const [currentEventId, setCurrentEventId] = useState<string>('choose_trait');
  const [isMobileStatsOpen, setIsMobileStatsOpen] = useState<boolean>(false);
  const [showWelcome, setShowWelcome] = useState<boolean>(() => {
    return !localStorage.getItem('sv_life_welcome_seen');
  });
  const [showCharacterPass, setShowCharacterPass] = useState<boolean>(false);
  const [showWarReport, setShowWarReport] = useState<boolean>(false);
  const [showAchievementCodex, setShowAchievementCodex] = useState<boolean>(false);
  const [isShopOpen, setIsShopOpen] = useState<boolean>(false);
  const [achievementToast, setAchievementToast] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(sound.getIsMuted());

  const handleToggleSound = () => {
    setIsMuted(sound.toggleMute());
  };

  useEffect(() => {
    const newlyUnlocked = checkAndUnlockAchievements(gameState, currentEventId);
    if (newlyUnlocked.length > 0) {
      const ach = ACHIEVEMENTS.find(a => a.id === newlyUnlocked[0]);
      if (ach) {
        sound.play('achievement');
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
    
    // ==========================================
    // IMMUNE SYSTEM: STATE MIDDLEWARE 
    // ==========================================
    // Normalize Layoff State: If an event sets laid_off: true, force tc=0 and unemployed
    if (effectResult.laid_off === true) {
      effectResult.tc = 0;
      effectResult.job_type = 'unemployed';
    }
    // Normalize Employment State: If an event gives a job, force laid_off: false
    if (effectResult.job_type && effectResult.job_type !== 'unemployed') {
      effectResult.laid_off = false;
    }
    // Numerical Safety Guards
    if (effectResult.cash !== undefined && isNaN(effectResult.cash)) effectResult.cash = gameState.cash;
    if (effectResult.health !== undefined && isNaN(effectResult.health)) effectResult.health = gameState.health;
    
    // Green Card Reset Middleware (Job Hopping)
    const isNewJob = effectResult.is_new_job || 
                     (currentEventId === 'job_hunt' && effectResult.laid_off === false) ||
                     (effectResult.job_type && effectResult.job_type !== 'unemployed' && effectResult.job_type !== gameState.job_type) ||
                     (effectResult.company && effectResult.company !== gameState.company);
                     
    if (isNewJob && (effectResult.visa || gameState.visa) !== '绿卡' && (effectResult.visa || gameState.visa) !== 'O1 (杰出人才)' && !gameState.is_phd) {
       if (gameState.gc_stage === 'perm_processing' || gameState.gc_stage === 'perm_audit' || gameState.gc_stage === 'i140_processing' || gameState.gc_stage === 'i140_rfe') {
           effectResult.gc_stage = 'not_started';
           effectResult.gc_progress = 0;
           effectResult.message = (effectResult.message || '') + ' 🚫 【绿卡重置】入职新雇主导致原公司的绿卡申请作废，PERM/I-140 进度惨遭清零！';
       } else if (gameState.gc_stage === 'waiting_pd' || gameState.gc_stage === 'i140_approved' || gameState.gc_stage === 'i485_pending') {
           effectResult.gc_stage = 'not_started';
           effectResult.gc_progress = gameState.gc_progress; // Preserve accumulated PD wait time!
           effectResult.message = (effectResult.message || '') + ' ⚠️ 【绿卡折腾】虽然 I-140 已获批保留了排期 (PD)，但新雇主仍需为你重新走一遍漫长的 PERM 流程！';
       }
    }
    
    Object.assign(newState, effectResult); // Apply new effects
    
    // Auto increment year based on age difference, ONLY if year wasn't explicitly set
    if (effectResult.age !== undefined && effectResult.age > gameState.age) {
      if (effectResult.year === undefined) {
        newState.year = gameState.year + (effectResult.age - gameState.age);
      }
    }

    // Clamp stats
    const maxCharmLimit = newState.max_charm || 25;
    newState.health = Math.max(0, Math.min(100, newState.health));
    newState.leetcode = Math.max(0, Math.min(100, newState.leetcode));
    newState.charm = Math.max(0, Math.min(maxCharmLimit, newState.charm));
    newState.network = Math.max(0, Math.min(100, newState.network || 10));

    // Check if health drops <= 0
    if (newState.health <= 0 && newState.status === 'playing') {
      newState.status = 'game_over';
      if (!effectResult.message) {
        newState.message = '你因为过度劳累而猝死 (Burnout)，游戏结束！';
      } else {
        newState.message += ' 然而由于长期高压与过度劳累，你突发心梗，倒在了工位上...游戏结束。';
      }
    }

    // Auto Liquidate Stocks if Cash < 0 (Allow selling stocks/equity to cover rent and expenses)
    if (newState.cash < -0.001 && (newState.stocks || 0) > 0 && newState.status === 'playing') {
      const deficit = Math.abs(newState.cash);
      const sellAmt = Math.min(newState.stocks || 0, deficit);
      newState.stocks = (newState.stocks || 0) - sellAmt;
      newState.cash = newState.cash + sellAmt;
      if (sellAmt > 0) {
        newState.message = (newState.message || '') + ` 【股票自动变现】现金流不足，系统已自动变现 $${sellAmt.toFixed(1)}w 股票持仓以缴纳房租与生活账单。`;
      }
    }

    // Check if bankrupt
    if (newState.cash < -0.001 && newState.status === 'playing') {
      newState.status = 'game_over';
      const isRealHome = newState.has_housing && newState.housing_name && !['四大 校内宿舍','大U 校内宿舍','美大U 校内宿舍','美硕 校外公寓','美国 博士实验室','国内大学宿舍','国内老家'].includes(newState.housing_name);
      if (isRealHome) {
        newState.message = '【房贷断供法拍破产】失业且资金链断裂无力还贷，加州银行正式启动房产法拍程序，个人信用彻底破产，游戏结束！';
      } else if (!effectResult.message) {
        newState.message = '你破产了，无法支付账单，游戏结束！';
      } else {
        newState.message += ' 但由于你负债累累，资金链彻底断裂，游戏结束！';
      }
    }

    // Check FIRE win
    if (newState.cash + (newState.stocks || 0) >= newState.win_threshold && newState.status === 'playing') {
      newState.status = 'win';
      newState.message = `你的总资产突破了 ${newState.win_threshold} 万美元！你正式达成了个人的 FIRE 目标（财务自由，提前退休）。你再也不需要看任何人的脸色，可以去做自己真正想做的事情了！`;
    }

    // Sound FX logic
    if (newState.status === 'win') {
      sound.play('win');
    } else if (newState.status === 'game_over') {
      sound.play('gameover');
    } else if ((effectResult.cash && effectResult.cash > gameState.cash) || (effectResult.tc && effectResult.tc > gameState.tc)) {
      sound.play('coin');
    } else if (newState.laid_off || newState.health < 30 || (newState.message && (newState.message.includes('没抽中') || newState.message.includes('裁员') || newState.message.includes('警报')))) {
      sound.play('alert');
    } else {
      sound.play('click');
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

      // Intercept return to daily life if we are in mid-year (so the random event routes to year end settlement)
      if (nextId === 'sv_daily_life' && newState.mid_year) {
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
      {/* Welcome Intro Modal (First Boot) */}
      {showWelcome && (
        <WelcomeModal
          onStart={() => {
            setShowWelcome(false);
            localStorage.setItem('sv_life_welcome_seen', 'true');
          }}
        />
      )}

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
            查看图鉴 
          </button>
        </div>
      )}

      {/* Mobile Sticky 2-Layer Mini-HUD Header */}
      <div className="lg:hidden sticky top-0 z-40 bg-zinc-950/95 backdrop-blur-2xl border-b border-zinc-800/80 px-3 py-2 shadow-2xl flex flex-col gap-1.5 text-xs font-mono">
        {/* Layer 1: Year/Age, Cash, TC, Network, LeetCode, Drawer Toggle */}
        <div className="flex items-center justify-between gap-1.5 w-full">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {/* Age Tag */}
            <span className="flex items-center gap-1 font-bold text-[11px] text-zinc-200 bg-zinc-900 px-2 py-0.5 rounded-md shrink-0 border border-zinc-800">
              <svg className="w-3 h-3 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              {gameState.age} 岁
            </span>

            {/* Asset Tag */}
            <span className="flex items-center gap-1 font-black text-emerald-400 shrink-0 bg-emerald-500/10 px-2.5 py-0.5 rounded-md border border-emerald-500/20 tabular-nums">
              <svg className="w-3 h-3 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              ${(gameState.cash + (gameState.stocks || 0)).toFixed(1)}w
            </span>

            {/* TC Tag */}
            <span className="flex items-center gap-1 text-zinc-300 shrink-0 bg-zinc-900 px-2 py-0.5 rounded-md border border-zinc-800 tabular-nums">
              <span className="text-zinc-500 text-[10px] uppercase font-bold">TC</span>
              <strong className="text-zinc-200 font-bold">${gameState.tc.toFixed(1)}w</strong>
            </span>

            {/* LeetCode Tag */}
            <span className="flex items-center gap-1 font-bold text-[10.5px] text-amber-300 shrink-0 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20 tabular-nums">
              LC {gameState.leetcode}
            </span>
          </div>

          <button
            onClick={() => setIsMobileStatsOpen(!isMobileStatsOpen)}
            className={`shrink-0 px-2.5 py-1 rounded-xl text-[11px] font-extrabold border transition-all duration-200 active:scale-95 cursor-pointer shadow-md ${
              isMobileStatsOpen 
                ? 'bg-emerald-500 text-zinc-950 border-emerald-400 shadow-emerald-500/20' 
                : 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/40'
            }`}
          >
            {isMobileStatsOpen ? '收起 ▲' : '全量属性面板 ▼'}
          </button>
        </div>

        {/* Layer 2: Status Badges (Health, Level, Visa, Green Card, Quick Actions) */}
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
              <svg className="w-3 h-3 text-rose-400 fill-rose-400/20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              健康 {Math.max(0, gameState.health)}
            </span>

            {/* Level Tag */}
            <span className="flex items-center gap-1 font-bold text-[11px] text-purple-300 shrink-0 bg-purple-500/10 px-2 py-0.5 rounded-md border border-purple-500/20">
              <span className="text-purple-400 font-extrabold">职级</span> {gameState.level || (gameState.job_type === 'unemployed' || gameState.laid_off || !gameState.job_type ? '待业' : gameState.job_type === 'quant' ? 'Quant' : gameState.job_type === 'ai_research' ? 'MTS' : gameState.is_phd ? 'L4' : 'L3')}
            </span>

            {/* Visa Tag */}
            <span className="flex items-center gap-1 font-semibold text-[11px] text-amber-300 shrink-0 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
              <svg className="w-3 h-3 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              {gameState.visa}
            </span>

            {/* Green Card Progress Tag (Mobile HUD) */}
            {((gameState.gc_progress || 0) > 0 || gameState.visa === '绿卡' || (gameState.job_type && gameState.job_type !== 'unemployed')) && (
              <span className="flex items-center gap-1.5 font-bold text-[10px] text-emerald-300 shrink-0 bg-emerald-500/15 px-2 py-0.5 rounded-md border border-emerald-500/30 tabular-nums">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                GC: {gameState.visa === '绿卡' ? '100%' : `${Math.round(Math.min(100, Math.max(0, ((gameState.gc_progress || 0) / 5) * 100)))}%`}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Sound Toggle Mobile Button */}
            <button
              onClick={handleToggleSound}
              className={`p-1.5 rounded-md border text-[10px] font-bold transition-all cursor-pointer flex items-center justify-center ${
                isMuted
                  ? 'bg-zinc-900 text-zinc-500 border-zinc-800'
                  : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
              }`}
              title={isMuted ? '开启音效' : '静音'}
            >
              {isMuted ? (
                <svg className="w-3.5 h-3.5 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
              ) : (
                <svg className="w-3.5 h-3.5 text-indigo-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
              )}
            </button>

            {/* Shop Mobile Button */}
            {gameState.job_type !== undefined && (
              <button
                onClick={() => setIsShopOpen(true)}
                className="px-2 py-1 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
              >
                <svg className="w-3 h-3 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                <span>商城</span>
              </button>
            )}

            {/* Achievement Codex Mobile Button */}
            <button
              onClick={() => setShowAchievementCodex(true)}
              className="px-2 py-1 rounded-md bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
            >
              <svg className="w-3 h-3 text-amber-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.45 1-1 1H7v4h10v-4h-2c-.55 0-1-.45-1-1v-2.34M18 4H6v7a6 6 0 0 0 12 0V4z"/></svg>
              <span>图鉴</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Slide-Down Drawer Overlay */}
      {isMobileStatsOpen && (
        <div className="lg:hidden fixed inset-x-0 top-[76px] bottom-0 z-50 bg-zinc-950/98 backdrop-blur-3xl p-4 overflow-y-auto animate-in fade-in slide-in-from-top-3 duration-200 shadow-2xl">
          <div className="flex justify-between items-center mb-4 pb-2.5 border-b border-zinc-800/80 sticky top-0 bg-zinc-950/90 backdrop-blur-xl z-10 py-1">
            <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              全量角色属性与 Bento 仪表盘
            </span>
            <button 
              onClick={() => setIsMobileStatsOpen(false)}
              className="text-xs text-zinc-200 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-3.5 py-1.5 rounded-full font-bold border border-zinc-700 active:scale-95 transition-all shadow-md"
            >
              返回游戏 
            </button>
          </div>
          <BentoStatsPanel 
            gameState={gameState} 
            currentEventId={currentEventId} 
            onOpenCodex={() => setShowAchievementCodex(true)} 
            onOpenShop={() => setIsShopOpen(true)}
            onToggleSound={handleToggleSound} 
            isMuted={isMuted} 
          />
        </div>
      )}

      <div className="max-w-[1400px] mx-auto p-4 md:p-8 lg:p-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-start">
          
          {/* Left Sticky Bento Panel (Desktop Only, Mobile uses sliding drawer) */}
          <div className="hidden lg:flex lg:col-span-5 flex-col sticky top-12">
            <BentoStatsPanel 
              gameState={gameState} 
              currentEventId={currentEventId} 
              onOpenCodex={() => setShowAchievementCodex(true)} 
              onOpenShop={() => setIsShopOpen(true)}
              onToggleSound={handleToggleSound} 
              isMuted={isMuted} 
            />
          </div>

          {/* Modals */}
          {isShopOpen && (
            <ShopModal 
              gameState={gameState}
              onClose={() => setIsShopOpen(false)}
              onTriggerEvent={(eventId) => {
                setCurrentEventId(eventId);
              }}
              onBuy={(effect, msg) => {
                setGameState(prev => {
                  const newState = { ...prev, imageUrl: undefined, ...effect };
                  // Apply clamping
                  newState.health = Math.max(0, Math.min(100, newState.health));
                  newState.leetcode = Math.max(0, Math.min(100, newState.leetcode));
                  newState.charm = Math.max(0, Math.min(25, newState.charm));
                  
                  // Check game over
                  if (newState.health <= 0 && newState.status === 'playing') {
                    newState.status = 'game_over';
                    newState.message = '你因为过度劳累而猝死 (Burnout)，游戏结束！';
                  } else if (newState.cash < -0.001 && newState.status === 'playing') {
                    newState.status = 'game_over';
                    newState.message = '你破产了，无法支付账单，游戏结束！';
                  } else if (newState.cash + (newState.stocks || 0) >= newState.win_threshold && newState.status === 'playing') {
                    newState.status = 'win';
                    newState.message = `总资产突破 ${newState.win_threshold}w！正式达成 FIRE 目标！`;
                  } else {
                    newState.message = msg;
                  }
                  return newState;
                });
                sound.play('coin');
                setIsShopOpen(false);
              }}
            />
          )}

          {/* Right Column: Event Narrative & Decisions */}
          <div className="col-span-1 lg:col-span-7 flex flex-col justify-center min-h-[65vh] lg:min-h-[80vh] lg:pl-8 xl:pl-16">
            
            {/* Message Banner */}
            {gameState.message && (
              <div aria-live="polite" role="status" className="border-l-2 border-emerald-500 bg-emerald-500/10 text-emerald-300 px-4 py-3 md:px-5 md:py-4 rounded-r-lg mb-4 md:mb-8 text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300">
                {gameState.message}
              </div>
            )}

            {/* Event Card */}
            <div key={currentEventId} id="event-decision-card" className="scroll-mt-14 bg-zinc-900/40 rounded-3xl p-5 sm:p-6 md:p-12 border border-zinc-800 backdrop-blur-md transition-all duration-300 shadow-2xl animate-in fade-in duration-500 slide-in-from-bottom-2">
              {gameState.status === 'playing' && currentEvent ? (
                <>
                  <h2 className="text-2xl md:text-4xl font-bold tracking-tight text-zinc-50 mb-3 md:mb-6">{currentEvent.title}</h2>
                  
                  {(gameState.imageUrl || currentEvent.imageUrl) && (
                    <img 
                      src={getImgSrc(gameState.imageUrl || currentEvent.imageUrl || '')} 
                      alt="Event Scene" 
                      className="w-full h-32 sm:h-48 md:h-72 object-cover rounded-2xl mb-4 md:mb-8 shadow-2xl border border-zinc-700/50 transition-all duration-500 ease-out"
                    />
                  )}

                  <p className="text-zinc-400 mb-5 md:mb-10 text-[15px] sm:text-base md:text-xl leading-relaxed">{currentEvent.description}</p>
                  
                  <div className="flex flex-col space-y-2.5 md:space-y-4">
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
                      const isSSR = choice.text.includes('隐藏款') || choice.text.includes('SSR');
                      
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
                        className={`group w-full text-left px-4 py-3 md:px-6 md:py-5 rounded-2xl border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50 flex flex-col md:flex-row md:items-center justify-between gap-2.5 md:gap-3 cursor-pointer ${
                          isSSR
                            ? 'bg-gradient-to-r from-amber-950/70 via-yellow-900/50 to-amber-950/70 border-amber-400/90 shadow-[0_0_20px_rgba(245,158,11,0.35)] hover:border-yellow-300 hover:shadow-[0_0_30px_rgba(250,204,21,0.55)] hover:bg-amber-900/60 active:scale-[0.98]'
                            : isAvailable 
                              ? 'bg-zinc-900 border-zinc-800 hover:border-emerald-500/50 hover:bg-zinc-800/80 active:scale-[0.98]' 
                              : 'bg-zinc-950/50 border-zinc-800/50 opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <span className={`font-medium text-[15px] sm:text-base md:text-lg transition-colors ${
                          isSSR
                            ? 'text-amber-200 group-hover:text-yellow-200 font-extrabold tracking-wide drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]'
                            : isAvailable ? 'text-zinc-300 group-hover:text-emerald-400' : 'text-zinc-600'
                        }`}>
                          {mainText}
                        </span>
                        
                        <div className="flex flex-wrap gap-2 items-center">
                          {costMatch && (
                             <span className={`text-xs px-2.5 py-1 rounded-md font-semibold tracking-wide ${isAvailable ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/20' : 'bg-zinc-800 text-zinc-500'}`}>
                                {costMatch}
                             </span>
                          )}
                          {reqMatch && (
                             <span className={`text-xs px-2.5 py-1 rounded-md font-semibold tracking-wide ${
                               isSSR
                                 ? 'bg-amber-400/30 text-amber-200 border border-amber-400/50 font-bold shadow-[0_0_8px_rgba(245,158,11,0.4)]'
                                 : isAvailable ? 'bg-amber-500/20 text-amber-300 border border-amber-500/20' : 'bg-zinc-800 text-zinc-500'
                             }`}>
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
                    <p className="text-zinc-300 text-lg max-w-xl mx-auto leading-relaxed mb-6">
                      {gameState.message}
                    </p>

                    {gameState.imageUrl && (
                      <img 
                        src={getImgSrc(gameState.imageUrl)} 
                        alt="Ending Scene" 
                        className="w-full h-52 md:h-72 object-cover rounded-2xl mb-6 shadow-2xl border border-zinc-700/50"
                      />
                    )}
                  </div>

                  {/* Enhanced Bento Medals & Metallic Stats Card */}
                  <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 md:p-8 mb-8 relative overflow-hidden shadow-2xl">
                    <div className="text-xs font-mono font-medium uppercase tracking-[0.15em] text-zinc-500 mb-4 flex items-center justify-between">
                      <span>[ACHIEVED_MEDALS] 生涯荣誉里程碑与 SSR 勋章</span>
                      <span className="tabular-nums">第 {Math.max(1, gameState.age - 17)} 年 | {gameState.age} 岁</span>
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
                      {gameState.charm >= 24 && (
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
                      {/* Charm stat removed to keep it a hidden attribute */}
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

