import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import type { GameState, Choice } from './types';
import { generateInitialState, events, midYearEventRouter, impactTier } from './data/events';
import { BentoStatsPanel } from './components/BentoStatsPanel';
import { checkAndUnlockAchievements, ACHIEVEMENTS } from './data/achievements';
import { sound } from './utils/sound';
import { safeStorage } from './utils/safeStorage';
import { applyStateTransition } from './utils/stateTransitions';
import { migrateSaveData, CURRENT_SAVE_VERSION } from './utils/saveMigration';
import { determineEnding } from './utils/endings';
import { getJobDisplayInfo } from './utils/gameStateSelectors';
import { ErrorBoundary } from './components/ErrorBoundary';
import { DopamineFeedback, type DopaminePill, type ScreenEffectType } from './components/DopamineFeedback';

// Lazy loaded heavy modals for optimized code splitting
const YearEndStatementModal = lazy(() => import('./components/YearEndStatementModal').then(m => ({ default: m.YearEndStatementModal })));
const WarReportModal = lazy(() => import('./components/WarReportModal').then(m => ({ default: m.WarReportModal })));
const AchievementCodexModal = lazy(() => import('./components/AchievementCodexModal').then(m => ({ default: m.AchievementCodexModal })));
const ShopModal = lazy(() => import('./components/ShopModal').then(m => ({ default: m.ShopModal })));
const WelcomeModal = lazy(() => import('./components/WelcomeModal').then(m => ({ default: m.WelcomeModal })));
const CareerTimelineModal = lazy(() => import('./components/CareerTimelineModal').then(m => ({ default: m.CareerTimelineModal })));

import { STORAGE_KEYS, isOwnedHousing } from './constants/gameConstants';

const loadInitialGameData = (): {
  gameState: GameState;
  currentEventId: string;
  hasUnlockedShopToast: boolean;
  hasOpenedShop: boolean;
  loadError?: boolean;
} => {
  const raw = safeStorage.getItem(STORAGE_KEYS.GAME_SAVE);
  // No existing save is a clean first run, NOT an error.
  if (!raw) {
    return migrateSaveData(null);
  }
  try {
    const parsed = JSON.parse(raw);
    const migrated = migrateSaveData(parsed);
    if (events[migrated.currentEventId]) {
      return migrated;
    }
    // The save decoded fine but points at an event id that no longer exists
    // (renamed/removed between releases). Don't throw away the whole run —
    // resume an in-progress game at the main loop; otherwise keep as-is so the
    // status-driven end screens (game_over/win) still render.
    const safeId = events['sv_daily_life'] ? 'sv_daily_life' : 'choose_trait';
    return {
      ...migrated,
      currentEventId: migrated.gameState.status === 'playing' ? safeId : 'choose_trait',
    };
  } catch (e) {
    // Corrupt/undecodable save. Preserve the ORIGINAL bytes under a backup key
    // BEFORE the auto-save effect can overwrite the primary key, so the player's
    // data stays recoverable (e.g. via the ErrorBoundary "export debug" path).
    // Previously this was swallowed silently and then stomped on the next render.
    console.error('[loadInitialGameData] corrupt save detected; backing up to .bak', e);
    try {
      if (!safeStorage.getItem(STORAGE_KEYS.GAME_SAVE_BACKUP)) {
        safeStorage.setItem(STORAGE_KEYS.GAME_SAVE_BACKUP, raw);
      }
    } catch {
      // Backup is best-effort; never let it block startup.
    }
    return { ...migrateSaveData(null), loadError: true };
  }
};

export default function App() {
  const [initialGameData] = useState(loadInitialGameData);
  const [gameState, setGameState] = useState<GameState>(initialGameData.gameState);
  const [currentEventId, setCurrentEventId] = useState<string>(initialGameData.currentEventId);
  const [isMobileStatsOpen, setIsMobileStatsOpen] = useState<boolean>(false);
  const [showWelcome, setShowWelcome] = useState<boolean>(() => {
    if (initialGameData.currentEventId !== 'choose_trait') return false;
    return !safeStorage.getItem(STORAGE_KEYS.WELCOME_SEEN);
  });
  const [showWarReport, setShowWarReport] = useState<boolean>(false);
  const [showAchievementCodex, setShowAchievementCodex] = useState<boolean>(false);
  const [showCareerTimeline, setShowCareerTimeline] = useState<boolean>(false);
  const [timelineInitialTab, setTimelineInitialTab] = useState<'timeline' | 'chart' | 'summary'>('chart');
  const [isShopOpen, setIsShopOpen] = useState<boolean>(false);
  const [hasOpenedShop, setHasOpenedShop] = useState<boolean>(initialGameData.hasOpenedShop);
  const [achievementToast, setAchievementToast] = useState<string | null>(null);
  const [hasUnlockedShopToast, setHasUnlockedShopToast] = useState<boolean>(initialGameData.hasUnlockedShopToast);
  const [isMuted, setIsMuted] = useState<boolean>(sound.getIsMuted());
  const [isCoolingDown, setIsCoolingDown] = useState<boolean>(false);
  const [dopaminePills, setDopaminePills] = useState<DopaminePill[]>([]);
  const [screenEffect, setScreenEffect] = useState<ScreenEffectType>('none');
  const screenEffectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pillsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerDopamineFeedback = (newPills: DopaminePill[], effect: ScreenEffectType = 'none') => {
    if (newPills.length > 0) {
      setDopaminePills(newPills);
      if (pillsTimerRef.current) clearTimeout(pillsTimerRef.current);
      pillsTimerRef.current = setTimeout(() => {
        setDopaminePills([]);
      }, 2600);
    }

    if (effect !== 'none') {
      setScreenEffect(effect);
      if (screenEffectTimerRef.current) clearTimeout(screenEffectTimerRef.current);
      screenEffectTimerRef.current = setTimeout(() => {
        setScreenEffect('none');
      }, effect === 'red_threat' ? 1200 : 2500);
    }
  };

  // Auto-Save progress whenever gameState or currentEventId updates.
  // Debounced (coalesces input bursts into one write) and array-capped (bounds
  // localStorage so long "explore beyond FIRE" runs can't hit the quota and
  // silently lose saves), with an immediate flush when the tab is hidden/closed.
  useEffect(() => {
    if (!gameState || !currentEventId) return;

    const writeSave = () => {
      const MAX_ENTRIES = 300; // generous; a normal 40y game has far fewer
      const trimmedState: GameState = {
        ...gameState,
        timeline: (gameState.timeline || []).slice(-MAX_ENTRIES),
        history_net_worth: (gameState.history_net_worth || []).slice(-MAX_ENTRIES),
      };
      const saveData = {
        version: CURRENT_SAVE_VERSION,
        savedAt: Date.now(),
        gameState: trimmedState,
        currentEventId,
        hasUnlockedShopToast,
        hasOpenedShop,
      };
      safeStorage.setItem(STORAGE_KEYS.GAME_SAVE, JSON.stringify(saveData));
    };

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(writeSave, 500);

    // Flush synchronously if the page is being hidden/closed so the most recent
    // turn is never lost inside the debounce window.
    const flush = () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      writeSave();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [gameState, currentEventId, hasUnlockedShopToast, hasOpenedShop]);

  // One-time notice if the previous save was corrupt: we backed it up to `.bak`
  // and recovered to a fresh game instead of silently discarding progress.
  useEffect(() => {
    if (initialGameData.loadError) {
      setAchievementToast('[存档修复] 检测到存档损坏，已备份原存档 (.bak) 并开启新的人生。');
      const t = setTimeout(() => setAchievementToast(null), 6000);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggleSound = () => {
    setIsMuted(sound.toggleMute());
  };

  const handleOpenShop = () => {
    setIsMobileStatsOpen(false);
    setIsShopOpen(true);
    setHasOpenedShop(true);
  };

  const handleOpenCodex = () => {
    setIsMobileStatsOpen(false);
    setShowAchievementCodex(true);
  };

  const handleOpenTimeline = (tab: 'timeline' | 'chart' | 'summary' = 'chart') => {
    setIsMobileStatsOpen(false);
    setTimelineInitialTab(tab);
    setShowCareerTimeline(true);
  };

  useEffect(() => {
    if (gameState.job_type !== undefined && !hasUnlockedShopToast) {
      setHasUnlockedShopToast(true);
      sound.play('achievement');
      setAchievementToast('[商城解锁] 恭喜步入职场！资产与消费商城已解锁，可前往购买豪车与置业！');
      setTimeout(() => setAchievementToast(null), 5500);
    }
  }, [gameState.job_type, hasUnlockedShopToast]);

  useEffect(() => {
    const newlyUnlocked = checkAndUnlockAchievements(gameState);
    if (newlyUnlocked.length > 0) {
      const ach = ACHIEVEMENTS.find(a => a.id === newlyUnlocked[0]);
      if (ach) {
        sound.play('achievement');
        setAchievementToast(`[成就解锁] 恭喜获得隐藏成就：${ach.title}`);
        setTimeout(() => setAchievementToast(null), 4500);
      }
    }
  }, [gameState]);

  useEffect(() => {
    setIsCoolingDown(true);
    const timer = setTimeout(() => setIsCoolingDown(false), 220);
    const targetEl = document.getElementById('event-container') || document.getElementById('event-decision-card');
    if (targetEl && window.innerWidth < 1024) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    return () => clearTimeout(timer);
  }, [currentEventId]);

  const currentEvent = events[currentEventId];
  const { levelHeaderLabel, levelLabel } = getJobDisplayInfo(gameState);
  // Classified ending archetype (only meaningful on the end screen, cheap + pure).
  const ending = determineEnding(gameState);
  const endingToneClass = ending.tone === 'triumph'
    ? { text: 'text-emerald-400', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' }
    : ending.tone === 'content'
      ? { text: 'text-amber-400', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20' }
      : { text: 'text-red-400', badge: 'bg-red-500/10 text-red-400 border-red-500/20' };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Allow all system and browser hotkeys (Cmd+C, Ctrl+C, Cmd+R, etc.) to pass through
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const target = e.target as HTMLElement;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      if (showWelcome || showWarReport || showAchievementCodex || showCareerTimeline || isShopOpen || isMobileStatsOpen) {
        if (e.key === 'Escape') {
          if (isMobileStatsOpen) setIsMobileStatsOpen(false);
          else if (isShopOpen) setIsShopOpen(false);
          else if (showAchievementCodex) setShowAchievementCodex(false);
          else if (showCareerTimeline) setShowCareerTimeline(false);
          else if (showWarReport) setShowWarReport(false);
          else if (showWelcome) {
            setShowWelcome(false);
            safeStorage.setItem('sv_life_welcome_seen', 'true');
          }
        }
        return;
      }

      if (e.key === ' ' || e.key === 'Enter') {
        if (currentEventId === 'sv_year_end_settlement' && gameState.status === 'playing') {
          e.preventDefault();
          handleYearEndContinue();
          return;
        }
      }

      if (['1', '2', '3', '4', '5', '6'].includes(e.key)) {
        if (gameState.status === 'playing' && currentEvent && !isCoolingDown) {
          const choiceIndex = parseInt(e.key, 10) - 1;
          const availableChoices = currentEvent.choices.filter((choice) => {
            const isAvail = !choice.condition || choice.condition(gameState);
            if (!isAvail && (choice.hideIfUnavailable || choice.text.includes('今年限时机会'))) {
              return false;
            }
            return true;
          });
          const targetChoice = availableChoices[choiceIndex];
          if (targetChoice) {
            const isAvail = !targetChoice.condition || targetChoice.condition(gameState);
            if (isAvail) {
              e.preventDefault();
              handleChoice(targetChoice);
            }
          }
        }
        return;
      }

      if (e.key.toLowerCase() === 's') {
        if (gameState.job_type !== undefined) {
          e.preventDefault();
          handleOpenShop();
        }
        return;
      }

      if (e.key.toLowerCase() === 'c') {
        e.preventDefault();
        setShowAchievementCodex(true);
        return;
      }

      if (e.key.toLowerCase() === 't') {
        e.preventDefault();
        setShowCareerTimeline(true);
        return;
      }

      if (e.key.toLowerCase() === 'r') {
        if (gameState.status !== 'playing') {
          e.preventDefault();
          resetGame();
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    gameState,
    currentEventId,
    currentEvent,
    isCoolingDown,
    showWelcome,
    showWarReport,
    showAchievementCodex,
    showCareerTimeline,
    isShopOpen,
    isMobileStatsOpen,
  ]);

  const handleChoice = (choice: Choice) => {
    // 1. Calculate new effects
    const effectResult = choice.effect(gameState);

    // 2. Apply centralized state transition and invariant middleware
    const transition = applyStateTransition(gameState, effectResult, {
      eventId: currentEventId,
      source: 'event',
    });

    const newState = transition.nextState;

    // --- Dopamine Feedback Delta Computation ---
    const newPills: DopaminePill[] = [];
    let currentScreenEffect: ScreenEffectType = 'none';

    // 1. Promotion Detection
    const isPromo = Boolean(newState.last_promo_age === newState.age && gameState.level !== newState.level && newState.level);
    if (isPromo) {
      newPills.push({
        id: `promo-${Date.now()}`,
        text: `🎉 晋升至 ${newState.level}`,
        subtext: newState.tc > gameState.tc ? `年薪总包调升至 $${newState.tc.toFixed(1)}w` : '突破职级天花板',
        type: 'promo',
        icon: '🎖️',
        color: 'text-amber-300',
        bgColor: 'bg-amber-950/95',
        borderColor: 'border-amber-500/50 shadow-amber-500/20'
      });
      currentScreenEffect = 'blue_promotion';
    }

    // 2. Net Worth Delta (Cash + Stocks)
    const prevNet = (gameState.cash || 0) + (gameState.stocks || 0);
    const newNet = (newState.cash || 0) + (newState.stocks || 0);
    const netDelta = newNet - prevNet;

    if (netDelta >= 1.0) {
      newPills.push({
        id: `cash-up-${Date.now()}`,
        text: `+ $${netDelta.toFixed(1)}w 资产`,
        subtext: (newState.stocks || 0) > (gameState.stocks || 0) ? '含股票/期权增值' : '现金入账',
        type: 'cash_up',
        icon: '💰',
        color: 'text-emerald-300',
        bgColor: 'bg-emerald-950/95',
        borderColor: 'border-emerald-500/50 shadow-emerald-500/20'
      });
      if (netDelta >= 25.0 || newState.status === 'win' || transition.targetEventId === 'fire_milestone_choice') {
        currentScreenEffect = 'gold_celebration';
      }
    } else if (netDelta <= -1.0) {
      newPills.push({
        id: `cash-down-${Date.now()}`,
        text: `- $${Math.abs(netDelta).toFixed(1)}w 支出`,
        subtext: '大额开支/税费/首付',
        type: 'cash_down',
        icon: '💸',
        color: 'text-rose-300',
        bgColor: 'bg-rose-950/95',
        borderColor: 'border-rose-500/40 shadow-rose-500/10'
      });
    }

    // 3. TC Base Delta (if not already covered by promo)
    const tcDelta = (newState.tc || 0) - (gameState.tc || 0);
    if (!isPromo && tcDelta >= 1.0) {
      newPills.push({
        id: `tc-up-${Date.now()}`,
        text: `+ $${tcDelta.toFixed(1)}w TC 调薪`,
        subtext: `新总包: $${newState.tc.toFixed(1)}w/年`,
        type: 'tc_up',
        icon: '📈',
        color: 'text-amber-200',
        bgColor: 'bg-amber-950/95',
        borderColor: 'border-amber-500/40 shadow-amber-500/10'
      });
    }

    // 4. Health Delta
    const healthDelta = newState.health - gameState.health;
    if (healthDelta >= 6) {
      newPills.push({
        id: `heal-${Date.now()}`,
        text: `+ ${healthDelta} 健康回血`,
        subtext: '身心状态大幅恢复',
        type: 'heal',
        icon: '💖',
        color: 'text-teal-300',
        bgColor: 'bg-teal-950/95',
        borderColor: 'border-teal-500/40 shadow-teal-500/10'
      });
    } else if (healthDelta <= -10) {
      newPills.push({
        id: `dmg-${Date.now()}`,
        text: `${healthDelta} 身体受损`,
        subtext: '高压内卷 / 熬夜透支',
        type: 'damage',
        icon: '⚡',
        color: 'text-red-300',
        bgColor: 'bg-red-950/95',
        borderColor: 'border-red-500/50 shadow-red-500/20'
      });
      if (healthDelta <= -15 || newState.health < 25) {
        currentScreenEffect = 'red_threat';
      }
    }

    // 5. Layoff / Threat / PIP
    const isLayoff = Boolean(!gameState.laid_off && newState.laid_off);
    if (isLayoff) {
      newPills.push({
        id: `layoff-${Date.now()}`,
        text: `⚠️ 遭遇裁员风暴`,
        subtext: '失业中，需抓紧自救求职',
        type: 'layoff',
        icon: '🚨',
        color: 'text-red-400',
        bgColor: 'bg-red-950/95',
        borderColor: 'border-red-500/60 shadow-red-500/30'
      });
      currentScreenEffect = 'red_threat';
    }

    // 6. Offer Wins
    const isOfferWin = Boolean(newState.hop_offers && newState.hop_offers.length > 0 && (!gameState.hop_offers || gameState.hop_offers.length === 0));
    if (isOfferWin) {
      newPills.push({
        id: `offers-${Date.now()}`,
        text: `🎯 斩获 ${newState.hop_offers?.length} 份录取 Offer`,
        subtext: '社招大捷，请签约去向',
        type: 'offer_win',
        icon: '✨',
        color: 'text-emerald-300',
        bgColor: 'bg-emerald-950/95',
        borderColor: 'border-emerald-500/50 shadow-emerald-500/20'
      });
      currentScreenEffect = 'gold_celebration';
    }

    // 7. LeetCode Delta
    const leetDelta = (newState.leetcode || 0) - (gameState.leetcode || 0);
    if (leetDelta >= 8) {
      newPills.push({
        id: `leet-${Date.now()}`,
        text: `+ ${leetDelta} LeetCode 算法`,
        subtext: `题量累计: ${newState.leetcode} 题`,
        type: 'leetcode',
        icon: '🧠',
        color: 'text-indigo-300',
        bgColor: 'bg-indigo-950/90',
        borderColor: 'border-indigo-500/40 shadow-indigo-500/10'
      });
    }

    // 8. Impact Delta
    const impactDelta = (newState.impact || 0) - (gameState.impact || 0);
    if (impactDelta >= 6) {
      newPills.push({
        id: `impact-${Date.now()}`,
        text: `+ ${Math.round(impactDelta)} 核心影响力`,
        subtext: '主导关键业务架构',
        type: 'impact',
        icon: '🚀',
        color: 'text-sky-300',
        bgColor: 'bg-sky-950/95',
        borderColor: 'border-sky-500/40 shadow-sky-500/10'
      });
    }

    // Dispatch visual feedback
    triggerDopamineFeedback(newPills, currentScreenEffect);

    // Sound FX logic
    if (newState.status === 'win' || transition.targetEventId === 'fire_milestone_choice') {
      sound.play('win');
    } else if (newState.status === 'game_over') {
      sound.play('gameover');
    } else if (isLayoff) {
      sound.play('layoff');
    } else if (isPromo) {
      sound.play('promo');
    } else if (netDelta >= 20.0) {
      sound.play('cash_burst');
    } else if (netDelta > 0 || tcDelta > 0) {
      sound.play('coin');
    } else if (healthDelta <= -12) {
      sound.play('damage');
    } else if (healthDelta >= 8) {
      sound.play('heal');
    } else if (newState.health < 30) {
      sound.play('alert');
    } else {
      sound.play('click');
    }

    setIsMobileStatsOpen(false); // Close mobile drawer if open

    // 2. Determine the next event id and any final (immutable) state changes.
    //    IMPORTANT: never mutate `newState` after it is handed to setGameState —
    //    compute the season transition into a fresh object and commit state once.
    let finalState = newState;
    let nextId: string | undefined;

    if (transition.targetEventId) {
      if (transition.targetEventId === 'fire_milestone_choice') {
        sound.play('win');
      }
      nextId = transition.targetEventId;
    } else {
      nextId = typeof choice.nextEventId === 'function' ? choice.nextEventId(newState) : choice.nextEventId;

      // Intercept return to daily life if we are in mid-year (H1 -> H2 -> Year End Settlement)
      if (nextId === 'sv_daily_life' && newState.mid_year) {
        if (newState.season_stage === 'h1' || !newState.season_stage) {
          finalState = { ...newState, season_stage: 'h2' };
          nextId = midYearEventRouter(finalState);
        } else {
          finalState = { ...newState, season_stage: undefined };
          nextId = 'sv_year_end_settlement';
        }
      }
    }

    // 3. Commit state exactly once with the final immutable object.
    setGameState(finalState);
    if (nextId) {
      setCurrentEventId(nextId);
    }
  };

  const resetGame = () => {
    safeStorage.removeItem(STORAGE_KEYS.GAME_SAVE);
    safeStorage.removeItem(STORAGE_KEYS.INITIAL_SEED);
    setGameState(generateInitialState());
    setCurrentEventId('choose_trait');
    setShowWarReport(false);
    setShowAchievementCodex(false);
    setShowCareerTimeline(false);
    setHasUnlockedShopToast(false);
    setHasOpenedShop(false);
  };

  const handleYearEndContinue = () => {
    const settlementChoice = events['sv_year_end_settlement']?.choices[0];
    if (settlementChoice) {
      handleChoice(settlementChoice);
    }
  };

  const getImgSrc = (url: string) => {
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const base = import.meta.env.BASE_URL || '/';
    const cleanBase = base.endsWith('/') ? base : `${base}/`;
    const cleanUrl = url.startsWith('/') ? url.slice(1) : url;
    return `${cleanBase}${cleanUrl}`;
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-zinc-950 text-zinc-50 font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Dopamine Visual Feedback Layer (Floating Pills, Confetti & Screen Effects) */}
      <DopamineFeedback pills={dopaminePills} screenEffect={screenEffect} />

      {/* Modals with Lazy Suspense protected by ErrorBoundary */}
      <ErrorBoundary fallbackTitle="弹窗模块加载异常">
        <Suspense fallback={null}>
          {/* Welcome Intro Modal (First Boot) */}
          {showWelcome && (
            <WelcomeModal
              onStart={() => {
                setShowWelcome(false);
                safeStorage.setItem(STORAGE_KEYS.WELCOME_SEEN, 'true');
              }}
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

          {/* Career Timeline & Net Worth Chart Modal */}
          {showCareerTimeline && (
            <CareerTimelineModal 
              gameState={gameState}
              initialTab={timelineInitialTab}
              onClose={() => setShowCareerTimeline(false)}
            />
          )}

          {/* Shop Modal */}
          {isShopOpen && (
            <ShopModal 
              gameState={gameState}
              onClose={() => setIsShopOpen(false)}
              onTriggerEvent={(eventId) => {
                setCurrentEventId(eventId);
              }}
              onBuy={(effect, msg) => {
                // Compute the transition OUTSIDE the state updater so the updater
                // stays pure (React can invoke updaters twice under StrictMode /
                // concurrent rendering). Commit state and event id together, the
                // same way handleChoice does.
                const transition = applyStateTransition(gameState, effect, {
                  source: 'shop',
                  customMessage: msg,
                });
                const nextState = transition.nextState;
                
                const prevNet = (gameState.cash || 0) + (gameState.stocks || 0);
                const newNet = (nextState.cash || 0) + (nextState.stocks || 0);
                const netDelta = newNet - prevNet;
                const pills: DopaminePill[] = [];

                if (netDelta <= -1.0) {
                  pills.push({
                    id: `shop-cost-${Date.now()}`,
                    text: `- $${Math.abs(netDelta).toFixed(1)}w 资产支出`,
                    subtext: msg.length > 22 ? msg.slice(0, 22) + '...' : msg,
                    type: 'cash_down',
                    icon: '🛍️',
                    color: 'text-amber-300',
                    bgColor: 'bg-amber-950/95',
                    borderColor: 'border-amber-500/50 shadow-amber-500/20'
                  });
                }
                if ((nextState.rental_income || 0) > (gameState.rental_income || 0)) {
                  const rentDelta = (nextState.rental_income || 0) - (gameState.rental_income || 0);
                  pills.push({
                    id: `shop-rent-${Date.now()}`,
                    text: `+ $${rentDelta.toFixed(1)}w/年 被动租金现金流`,
                    subtext: '不动产配置收益',
                    type: 'special',
                    icon: '🏡',
                    color: 'text-emerald-300',
                    bgColor: 'bg-emerald-950/95',
                    borderColor: 'border-emerald-500/50 shadow-emerald-500/20'
                  });
                }
                if (nextState.car && nextState.car !== gameState.car && nextState.car !== 'none') {
                  pills.push({
                    id: `shop-car-${Date.now()}`,
                    text: `喜提 ${nextState.car === 'porsche' ? '保时捷 911' : nextState.car === 'cybertruck' ? '赛博皮卡' : '特斯拉'}`,
                    subtext: '名车座驾配置成功',
                    type: 'special',
                    icon: '🏎️',
                    color: 'text-purple-300',
                    bgColor: 'bg-purple-950/95',
                    borderColor: 'border-purple-500/50 shadow-purple-500/20'
                  });
                }

                const isHousePurchase = Boolean(nextState.housing_name && nextState.housing_name !== gameState.housing_name && nextState.housing_name.includes('独立屋') || nextState.housing_name?.includes('豪宅'));
                triggerDopamineFeedback(pills, isHousePurchase ? 'gold_celebration' : 'none');

                setGameState(nextState);
                if (transition.targetEventId) {
                  setCurrentEventId(transition.targetEventId);
                }
                sound.play('coin');
                setIsShopOpen(false);
              }}
            />
          )}
        </Suspense>
      </ErrorBoundary>

      {/* Unlock Notification Toast */}
      {achievementToast && (
        <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl shadow-2xl backdrop-blur-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300 font-bold text-sm border ${
          achievementToast.includes('商城')
            ? 'bg-gradient-to-r from-amber-950/95 via-emerald-950/95 to-zinc-900/95 border-amber-500/50 text-amber-200 shadow-amber-500/10'
            : 'bg-gradient-to-r from-purple-900/90 via-indigo-900/90 to-zinc-900/90 border-purple-500/50 text-purple-200'
        }`}>
          <span>{achievementToast}</span>
          {achievementToast.includes('商城') ? (
            <button
              onClick={() => {
                handleOpenShop();
                setAchievementToast(null);
              }}
              className="text-xs text-amber-300 hover:text-white underline font-mono cursor-pointer shrink-0"
            >
              查看商城
            </button>
          ) : (
            <button
              onClick={() => {
                setShowAchievementCodex(true);
                setAchievementToast(null);
              }}
              className="text-xs text-purple-300 hover:text-white underline font-mono cursor-pointer shrink-0"
            >
              查看图鉴
            </button>
          )}
        </div>
      )}

      {/* Mobile Sticky 2-Layer Mini-HUD Header */}
      <div className="lg:hidden sticky top-0 z-40 bg-zinc-950/95 backdrop-blur-2xl border-b border-zinc-800/80 px-3 py-2 shadow-2xl flex flex-col gap-1.5 text-xs font-mono">
        {/* Layer 1: Year/Age, Cash, TC, Network, LeetCode, Drawer Toggle */}
        <div className="flex items-center justify-between gap-1.5 w-full">
          <div className="flex flex-1 min-w-0 items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 pr-1">
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

            {/* Impact Tag — 始终显示(即使为 0);魅力/人脉为隐藏属性,不展示 */}
            <span className="flex items-center gap-1 font-bold text-[10.5px] text-violet-300 shrink-0 bg-violet-500/10 px-2 py-0.5 rounded-md border border-violet-500/20 tabular-nums">
              <svg className="w-2.5 h-2.5 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              {Math.round(gameState.impact || 0)}
              <span className="text-violet-400/70 text-[9px]">{impactTier(gameState.impact || 0)}</span>
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
          <div className="flex flex-1 min-w-0 items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 pr-1">
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
              <span className="text-purple-400 font-extrabold">{levelHeaderLabel || '职级'}</span> {levelLabel}
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
                onClick={handleOpenShop}
                className="px-2 py-1 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
              >
                <svg className="w-3 h-3 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                <span>商城</span>
              </button>
            )}

            {/* Achievement Codex Mobile Button */}
            <button
              onClick={handleOpenCodex}
              className="px-2 py-1 rounded-md bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
            >
              <svg className="w-3 h-3 text-amber-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.45 1-1 1H7v4h10v-4h-2c-.55 0-1-.45-1-1v-2.34M18 4H6v7a6 6 0 0 0 12 0V4z"/></svg>
              <span>图鉴</span>
            </button>

            {/* Timeline Mobile Button */}
            <button
              onClick={() => handleOpenTimeline('timeline')}
              className="px-2 py-1 rounded-md bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
            >
              <svg className="w-3 h-3 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span>大事记</span>
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
            onOpenCodex={handleOpenCodex} 
            onOpenShop={handleOpenShop}
            onOpenTimeline={handleOpenTimeline}
            onToggleSound={handleToggleSound} 
            isMuted={isMuted} 
            hasOpenedShop={hasOpenedShop}
          />
        </div>
      )}

      <div className={`max-w-[1400px] mx-auto p-4 md:p-8 lg:p-12 ${screenEffect === 'red_threat' ? 'animate-screen-shake' : ''}`}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-start">
          
          {/* Left Sticky Bento Panel (Desktop Only, Mobile uses sliding drawer) */}
          <div className="hidden lg:flex lg:col-span-5 flex-col sticky top-12">
            <BentoStatsPanel 
              gameState={gameState} 
              currentEventId={currentEventId} 
              onOpenCodex={handleOpenCodex} 
              onOpenShop={handleOpenShop}
              onOpenTimeline={handleOpenTimeline}
              onToggleSound={handleToggleSound} 
              isMuted={isMuted} 
              hasOpenedShop={hasOpenedShop}
            />
          </div>

          {/* Right Column: Event Narrative & Decisions */}
          <div className="col-span-1 lg:col-span-7 flex flex-col justify-center min-h-[65vh] lg:min-h-[80vh] lg:pl-8 xl:pl-16">
            
            <div id="event-container" className="scroll-mt-24 lg:scroll-mt-12">
              {/* Message Banner */}
              {gameState.message && (
                <div aria-live="polite" role="status" className="border-l-2 border-emerald-500 bg-emerald-500/10 text-emerald-300 px-4 py-3 md:px-5 md:py-4 rounded-r-lg mb-4 md:mb-8 text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300">
                  {gameState.message}
                </div>
              )}

              {/* Event Card */}
              <div key={currentEventId} id="event-decision-card" className="bg-zinc-900/40 rounded-3xl p-5 sm:p-6 md:p-12 border border-zinc-800 backdrop-blur-md transition-all duration-300 shadow-2xl animate-in fade-in duration-500 slide-in-from-bottom-2">
              {gameState.status === 'playing' && currentEvent ? (
                <>
                  <h2 className="text-2xl md:text-4xl font-bold tracking-tight text-zinc-50 mb-3 md:mb-6">{currentEvent.title}</h2>
                  
                  {(gameState.imageUrl || currentEvent.imageUrl) && (
                    <img 
                      src={getImgSrc(gameState.imageUrl || currentEvent.imageUrl || '')} 
                      alt="Event Scene" 
                      onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
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
                      const costMatch = choice.costBadge || choice.text.match(/\((?:消耗|花费|每年|成本|折抵|实付|首付|出资|学费|自付|垫资).*?\)/)?.[0]?.slice(1, -1);
                      let reqMatch: string | undefined = choice.reqBadge || choice.text.match(/\((?:需要|需|仅限|限|超凡|高魅力|算法|高风险).*?\)/)?.[0]?.slice(1, -1);

                      // Smart Deduplication: If reqMatch only restates the monetary cash requirement that costMatch already conveys, suppress reqMatch
                      if (costMatch && reqMatch) {
                        if (costMatch === reqMatch) {
                          reqMatch = undefined;
                        } else if (
                          /^(?:需现金|需现金\+股票|需总资产|需持股|需持有股票)\s*(?:>=|>|<=|<|==|:|=|)\s*[\$0-9.wW万]+$/i.test(reqMatch.trim())
                        ) {
                          reqMatch = undefined;
                        }
                      }
                      
                      let mainText = choice.text
                        .replace(/\((?:消耗|花费|每年|成本|折抵|实付|首付|出资|学费|自付|垫资).*?\)/g, '')
                        .replace(/\((?:需要|需|仅限|限|超凡|高魅力|算法|高风险).*?\)/g, '')
                        .trim();
                      
                      if (mainText.endsWith('-') || mainText.endsWith('：') || mainText.endsWith(':')) {
                        mainText = mainText.slice(0, -1).trim();
                      }
                      
                      return (
                      <button
                        key={idx}
                        onClick={() => isAvailable && !isCoolingDown && handleChoice(choice)}
                        disabled={!isAvailable || isCoolingDown}
                        className={`group w-full text-left px-4 py-3 md:px-6 md:py-5 rounded-2xl border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50 flex flex-col md:flex-row md:items-center justify-between gap-2.5 md:gap-3 cursor-pointer ${
                          isSSR
                            ? 'bg-gradient-to-r from-amber-950/70 via-yellow-900/50 to-amber-950/70 border-amber-400/90 shadow-[0_0_20px_rgba(245,158,11,0.35)] hover:border-yellow-300 hover:shadow-[0_0_30px_rgba(250,204,21,0.55)] hover:bg-amber-900/60 active:scale-[0.98]'
                            : isAvailable 
                              ? 'bg-zinc-900 border-zinc-800 hover:border-emerald-500/50 hover:bg-zinc-800/80 active:scale-[0.98]' 
                              : 'bg-zinc-950/50 border-zinc-800/50 opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <span className={`font-medium text-[15px] sm:text-base md:text-lg transition-colors flex items-center gap-2.5 ${
                          isSSR
                            ? 'text-amber-200 group-hover:text-yellow-200 font-extrabold tracking-wide drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]'
                            : isAvailable ? 'text-zinc-300 group-hover:text-emerald-400' : 'text-zinc-600'
                        }`}>
                          <span className="font-mono text-xs font-black px-2 py-0.5 rounded-md bg-zinc-800/90 text-zinc-400 border border-zinc-700/80 shrink-0 group-hover:border-emerald-500/40 group-hover:text-zinc-200">
                            [{idx + 1}]
                          </span>
                          <span>{mainText}</span>
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
                    <span className={`text-xs font-mono font-bold uppercase tracking-[0.25em] px-4 py-1.5 rounded-full border ${endingToneClass.badge}`}>
                      {ending.subtitle} · [{ending.rarity}]
                    </span>
                    <h2 className={`text-4xl md:text-5xl font-extrabold tracking-tight mt-4 mb-3 ${endingToneClass.text}`}>
                      {ending.emoji} {ending.title}
                    </h2>
                    <p className={`text-sm font-medium mb-2 ${endingToneClass.text}`}>{ending.flavor}</p>
                    <p className="text-zinc-300 text-lg max-w-xl mx-auto leading-relaxed mb-6">
                      {gameState.message}
                    </p>

                    {gameState.imageUrl && (
                      <img 
                        src={getImgSrc(gameState.imageUrl)} 
                        alt="Ending Scene" 
                        onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
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
                            <div className="text-xs text-zinc-400 mt-0.5">风采绝伦，Santana Row 相亲收割机</div>
                          </div>
                        </div>
                      )}
                      {(gameState.cash >= 300 || isOwnedHousing(gameState.housing_name)) && (
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
                        <div className="font-bold font-mono tabular-nums text-zinc-100 text-base">${Math.max(gameState.max_tc || 0, gameState.tc || 0).toFixed(1)}w</div>
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
                      className="px-6 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-zinc-950 font-extrabold text-base transition-all duration-200 active:scale-[0.985] shadow-lg shadow-emerald-500/20 cursor-pointer flex items-center justify-center gap-2.5"
                    >
                      <svg className="w-5 h-5 text-zinc-950" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                      <span>生成炫彩战报海报</span>
                    </button>
                    <button
                      onClick={() => setShowCareerTimeline(true)}
                      className="px-6 py-4 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-sky-300 border border-sky-500/30 font-bold text-base transition-all active:scale-[0.985] cursor-pointer flex items-center justify-center gap-2 shadow-md"
                    >
                      <svg className="w-5 h-5 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      <span>大事记编年史</span>
                    </button>
                    <button
                      onClick={resetGame}
                      className="px-6 py-4 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 font-semibold text-base transition-all active:scale-[0.985] cursor-pointer"
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
    </div>
  );
}

