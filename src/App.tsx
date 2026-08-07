import { useState, useEffect, lazy, Suspense } from 'react';
import type { GameState, Choice } from './types';
import { generateInitialState, events, midYearEventRouter } from './data/events';
import { BentoStatsPanel } from './components/BentoStatsPanel';
import { checkAndUnlockAchievements, ACHIEVEMENTS } from './data/achievements';
import { sound } from './utils/sound';
import { safeStorage } from './utils/safeStorage';

// Lazy loaded heavy modals for optimized code splitting
const CharacterProfileModal = lazy(() => import('./components/CharacterProfileModal').then(m => ({ default: m.CharacterProfileModal })));
const YearEndStatementModal = lazy(() => import('./components/YearEndStatementModal').then(m => ({ default: m.YearEndStatementModal })));
const WarReportModal = lazy(() => import('./components/WarReportModal').then(m => ({ default: m.WarReportModal })));
const AchievementCodexModal = lazy(() => import('./components/AchievementCodexModal').then(m => ({ default: m.AchievementCodexModal })));
const ShopModal = lazy(() => import('./components/ShopModal').then(m => ({ default: m.ShopModal })));
const WelcomeModal = lazy(() => import('./components/WelcomeModal').then(m => ({ default: m.WelcomeModal })));
const CareerTimelineModal = lazy(() => import('./components/CareerTimelineModal').then(m => ({ default: m.CareerTimelineModal })));

export default function App() {
  const [gameState, setGameState] = useState<GameState>(generateInitialState);
  const [currentEventId, setCurrentEventId] = useState<string>('choose_trait');
  const [isMobileStatsOpen, setIsMobileStatsOpen] = useState<boolean>(false);
  const [showWelcome, setShowWelcome] = useState<boolean>(() => {
    return !safeStorage.getItem('sv_life_welcome_seen');
  });
  const [showCharacterPass, setShowCharacterPass] = useState<boolean>(false);
  const [showWarReport, setShowWarReport] = useState<boolean>(false);
  const [showAchievementCodex, setShowAchievementCodex] = useState<boolean>(false);
  const [showCareerTimeline, setShowCareerTimeline] = useState<boolean>(false);
  const [timelineInitialTab, setTimelineInitialTab] = useState<'timeline' | 'chart' | 'summary'>('chart');
  const [isShopOpen, setIsShopOpen] = useState<boolean>(false);
  const [hasOpenedShop, setHasOpenedShop] = useState<boolean>(false);
  const [achievementToast, setAchievementToast] = useState<string | null>(null);
  const [hasUnlockedShopToast, setHasUnlockedShopToast] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(sound.getIsMuted());
  const [isCoolingDown, setIsCoolingDown] = useState<boolean>(false);

  const handleToggleSound = () => {
    setIsMuted(sound.toggleMute());
  };

  const handleOpenShop = () => {
    setIsShopOpen(true);
    setHasOpenedShop(true);
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Allow all system and browser hotkeys (Cmd+C, Ctrl+C, Cmd+R, etc.) to pass through
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const target = e.target as HTMLElement;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      if (showWelcome || showCharacterPass || showWarReport || showAchievementCodex || showCareerTimeline || isShopOpen || isMobileStatsOpen) {
        if (e.key === 'Escape') {
          if (isMobileStatsOpen) setIsMobileStatsOpen(false);
          else if (isShopOpen) setIsShopOpen(false);
          else if (showAchievementCodex) setShowAchievementCodex(false);
          else if (showCareerTimeline) setShowCareerTimeline(false);
          else if (showWarReport) setShowWarReport(false);
          else if (showCharacterPass) setShowCharacterPass(false);
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
    showCharacterPass,
    showWarReport,
    showAchievementCodex,
    showCareerTimeline,
    isShopOpen,
    isMobileStatsOpen,
  ]);

  const handleChoice = (choice: Choice) => {
    // 1. Calculate new state
    const newState = { ...gameState, message: '', laid_off: false, imageUrl: undefined }; // Clear old message, image and generic flags
    const effectResult = choice.effect(gameState);
    
    // ==========================================
    // IMMUNE SYSTEM: STATE MIDDLEWARE 
    // ==========================================
    // Normalize Layoff State: If an event sets laid_off: true or job_type: unemployed, force tc=0
    if (effectResult.laid_off === true || effectResult.job_type === 'unemployed') {
      effectResult.tc = 0;
      effectResult.job_type = 'unemployed';
      effectResult.laid_off = true;
    }
    // Normalize Employment State: If an event gives a job, force laid_off: false
    if (effectResult.job_type && effectResult.job_type !== 'unemployed') {
      effectResult.laid_off = false;
      // If player enters the workforce on an F-1 student visa, transition to OPT
      if ((gameState.visa === 'F1 (学生)' || !gameState.visa || gameState.visa === '无') && !effectResult.visa) {
        effectResult.visa = 'OPT (实习)';
      }
    }
    // Numerical Safety Guards
    if (effectResult.cash !== undefined && isNaN(effectResult.cash)) effectResult.cash = gameState.cash;
    if (effectResult.health !== undefined && isNaN(effectResult.health)) effectResult.health = gameState.health;
    
    // Green Card Reset Middleware (Job Hopping)
    const isNewJob = effectResult.is_new_job || 
                     (currentEventId === 'job_hunt' && effectResult.laid_off === false) ||
                     (effectResult.job_type && effectResult.job_type !== 'unemployed' && effectResult.job_type !== gameState.job_type) ||
                     (effectResult.company && effectResult.company !== gameState.company);
                     
    const currentVisa = gameState.visa;
    const targetVisa = effectResult.visa || currentVisa;
    const isPermanentResidentOrCitizen = currentVisa === '绿卡' || currentVisa === '公民' || targetVisa === '绿卡' || targetVisa === '公民';

    if (isNewJob && !isPermanentResidentOrCitizen && targetVisa !== 'O1 (杰出人才)' && !gameState.is_phd) {
       const isI140Approved = ['i140_approved', 'waiting_pd', 'i485_pending', 'approved'].includes(gameState.gc_stage || '');
       if (gameState.gc_stage === 'perm_processing' || gameState.gc_stage === 'perm_audit' || gameState.gc_stage === 'i140_processing' || gameState.gc_stage === 'i140_rfe') {
           effectResult.gc_stage = 'perm_processing';
           effectResult.gc_progress = 1;
           effectResult.message = (effectResult.message || '') + ' 【H1B 跳槽 PERM 重置】因跳槽时旧公司 I-140 尚未批准，原 PERM 废弃，新公司须重新为您递交 PERM 重新排队。';
       } else if (isI140Approved) {
           effectResult.message = (effectResult.message || '') + ' 【I-140 已锁 PD】因之前 I-140 已批准，本次跳槽成功锁定原优先日期 (PD)！';
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

    // Timeline Auto Recording
    const updatedTimeline = [...(newState.timeline || [])];
    const recAge = newState.age;
    const recYear = newState.year;

    if (currentEventId === 'choose_trait' && effectResult.trait_title) {
      updatedTimeline.push({
        age: recAge, year: recYear,
        title: `特质觉醒: ${effectResult.trait_title}`,
        description: effectResult.trait_desc || '开启独特的硅谷人生底色与专属天赋属性',
        category: 'milestone'
      });
    } else if (currentEventId === 'choose_school') {
      const schoolMap: Record<string, string> = { cmu: 'CMU (卡耐基梅隆)', ucb: 'UCB (加州伯克利)', state: 'SJSU (圣何塞州立)' };
      const schoolName = effectResult.school ? (schoolMap[effectResult.school] || effectResult.school) : '国内高校 / 中外合办大学';
      updatedTimeline.push({
        age: recAge, year: recYear,
        title: `踏上征途: 入读 ${schoolName}`,
        description: effectResult.school ? '背上行囊，正式开启学术积累与北美留学生涯' : '进入大学校园，打下扎实的高等数学与算法编程底子',
        category: 'education'
      });
    } else if (effectResult.is_master && !gameState.is_master) {
      updatedTimeline.push({
        age: recAge, year: recYear,
        title: '深造进阶: 入读北美 CS 硕士研究生',
        description: '手握录取通知书飞赴美国，开启高强度课业与刷题求职新篇章！',
        category: 'education'
      });
    } else if (effectResult.is_phd && !gameState.is_phd) {
      updatedTimeline.push({
        age: recAge, year: recYear,
        title: '学术殿堂: 斩获北美顶尖 CS 全奖直博 PhD',
        description: '加入顶级人工智能实验室，致力于前沿顶会论文与分布式架构研发！',
        category: 'education'
      });
    } else if (effectResult.is_new_job || (effectResult.job_type && effectResult.job_type !== 'unemployed' && (effectResult.job_type !== gameState.job_type || effectResult.company !== gameState.company))) {
      const compMap: Record<string, string> = {
        google: 'Google (谷歌)', meta: 'Meta (卷王)', nvidia: 'NVIDIA (英伟达)', tiktok: 'TikTok (字节)',
        apple: 'Apple (苹果)', amazon: 'Amazon (亚麻)', openai: 'OpenAI', citadel: 'Citadel (城堡)',
        uber: 'Uber (优步)', microsoft: 'Microsoft (微软)', cisco: 'Cisco (思科)', adobe: 'Adobe (奥多比)',
        cn_big_tech: '国内一线互联网大厂', icc: 'ICC 外包公司'
      };
      const compName = effectResult.company ? (compMap[effectResult.company] || effectResult.company.toUpperCase()) : (effectResult.job_type === 'cn_tech' ? '国内一线互联网大厂' : effectResult.job_type === 'startup_founder' ? 'AI 独角兽' : '硅谷科技企业');
      const lvl = effectResult.level || (effectResult.job_type === 'cn_tech' ? '国内研发' : effectResult.job_type === 'startup_founder' ? 'Founder' : 'SDE');
      updatedTimeline.push({
        age: recAge, year: recYear,
        title: `成功入职: ${compName} (${lvl})`,
        description: `顺利通过技术面试，年薪总包达到 $${(newState.tc || 0).toFixed(1)}w！`,
        category: 'career',
        statHighlight: `TC $${(newState.tc || 0).toFixed(1)}w`
      });
    } else if (effectResult.level && effectResult.level !== gameState.level && !effectResult.is_new_job) {
      updatedTimeline.push({
        age: recAge, year: recYear,
        title: `职级晋升: 升至 ${effectResult.level}`,
        description: `斩获优秀绩效考核，总包提升至 $${(newState.tc || 0).toFixed(1)}w！`,
        category: 'career',
        statHighlight: `TC $${(newState.tc || 0).toFixed(1)}w`
      });
    } else if (effectResult.visa && effectResult.visa !== gameState.visa) {
      const visaDescriptions: Record<string, { title: string; desc: string }> = {
        'Day 1 CPT': { title: '身份自救: 启用 Day 1 CPT (学籍保底)', desc: '在学籍保护下从容应对抽签与离境压力，继续在湾区全职工作！' },
        'L1 (外派)': { title: '跨国调动: 取得 L-1 跨国工作签证', desc: '完成海外分支机构轮岗调动，正式进驻湾区总部！' },
        'H1B (工签)': { title: '人品爆发: 成功抽中 H-1B 工作签证', desc: '在移民局年度大乐透中逆风中签，正式获得独立工签！' },
        'O1 (杰出人才)': { title: '杰出人才: 获批 O-1 签证', desc: '凭借顶会论文或硬核算法成就获批杰出人才工签，免受抽签约束！' },
        '绿卡': { title: '终极突破: 取得美国绿卡 (永久居民)', desc: '漫长排期长征终获全胜！彻底挣脱雇主与抽签枷锁！' },
        '公民': { title: '天命所归: 取得美籍公民身份 (SSR)', desc: '获得绝对免签证与自由工作权益，硅谷人生畅通无阻！' },
        'OPT (实习)': { title: '走向职场: 激活 OPT 实习期', desc: '顺利走出象牙塔，正式踏入北美职场求职与工作实战！' },
        'F1 (学生)': { title: '求学签证: 获批 F-1 留学生签证', desc: '踏上赴美求学之路，开启海外求学生涯！' }
      };
      const info = visaDescriptions[effectResult.visa] || { title: `身份跨越: 取得 ${effectResult.visa}`, desc: '北美合法留美与工作身份迎来关键突破！' };
      updatedTimeline.push({
        age: recAge, year: recYear,
        title: info.title,
        description: info.desc,
        category: 'immigration',
        statHighlight: effectResult.visa
      });
    } else if (effectResult.housing_name && effectResult.housing_name !== gameState.housing_name && ['Atherton 顶级豪宅', 'Sunnyvale 老破小', 'North San Jose 联排', 'Fremont 学区房'].includes(effectResult.housing_name)) {
      updatedTimeline.push({
        age: recAge, year: recYear,
        title: `置业安家: 购入 ${effectResult.housing_name}`,
        description: `在加州湾区拥有了属于自己的房产，成为有产阶级！`,
        category: 'real_estate',
        statHighlight: effectResult.housing_name
      });
    } else if (effectResult.rental_income && (effectResult.rental_income > (gameState.rental_income || 0))) {
      updatedTimeline.push({
        age: recAge, year: recYear,
        title: '资产扩张: 布局不动产被动现金流',
        description: `名下投资房产/ADU 落地出租，年化被动租金现金流增至 +$${effectResult.rental_income.toFixed(1)}w！`,
        category: 'real_estate',
        statHighlight: `+$${effectResult.rental_income.toFixed(1)}w/年`
      });
    } else if (effectResult.car && effectResult.car !== gameState.car && effectResult.car !== 'none') {
      const carMap: Record<string, string> = { porsche: '保时捷 Porsche 911', cybertruck: '特斯拉 Cybertruck', model_y: 'Tesla Model Y' };
      updatedTimeline.push({
        age: recAge, year: recYear,
        title: `座驾升级: 提车 ${carMap[effectResult.car] || effectResult.car}`,
        description: '行驶在加州 101 高速公路上，尽情体验硅谷速度与驾驶乐趣！',
        category: 'wealth',
        statHighlight: carMap[effectResult.car]
      });
    } else if (effectResult.is_married && !gameState.is_married) {
      updatedTimeline.push({
        age: recAge, year: recYear,
        title: '缔结良缘: 步入婚姻殿堂',
        description: '在加州与心仪的伴侣正式领证结婚，组建幸福的湾区家庭！',
        category: 'relation'
      });
    } else if (effectResult.story_flags?.alex_ipo_done && !gameState.story_flags?.alex_ipo_done) {
      updatedTimeline.push({
        age: recAge, year: recYear,
        title: '时代盛宴: OmniAgent 终局退出结算',
        description: '见证 Alex 博士初创智能体公司走向纳斯达克挂牌与巨头并购退出！',
        category: 'wealth'
      });
    } else if (effectResult.story_flags?.dave_defeated && !gameState.story_flags?.dave_defeated) {
      updatedTimeline.push({
        age: recAge, year: recYear,
        title: '绝地反击: 击溃 Manager Dave',
        description: '凭借扎实的证据链在闭门考核中彻底扳倒职场宿敌！',
        category: 'story'
      });
    } else if (effectResult.story_flags?.sam_zero_day_done && !gameState.story_flags?.sam_zero_day_done) {
      updatedTimeline.push({
        age: recAge, year: recYear,
        title: '黑客探险: 斩获 Zero-Day 漏洞赏金',
        description: '与极客战友 Sam 在车库通宵调试并提交 AI 云平台底层逃逸漏洞 PoC！',
        category: 'story'
      });
    }
    newState.timeline = updatedTimeline;

    // 🛡️ Global Visa Invariant Guard Middleware: Protect Citizen & Green Card status against accidental downgrades
    if (gameState.visa === '公民') {
      newState.visa = '公民';
      newState.gc_progress = 5;
      newState.gc_stage = 'approved';
    } else if (gameState.visa === '绿卡' && newState.visa !== '公民') {
      newState.visa = '绿卡';
      newState.gc_progress = 5;
      newState.gc_stage = 'approved';
    }

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
      const isHomeowner = newState.has_housing && !!newState.housing_name && ['Atherton 顶级豪宅', 'Sunnyvale 老破小', 'North San Jose 联排', 'Fremont 学区房'].includes(newState.housing_name);
      if (isHomeowner) {
        newState.message = '【房贷断供法拍破产】失业且资金链断裂无力还贷，加州银行正式启动房产法拍程序，个人信用彻底破产，游戏结束！';
      } else if (!effectResult.message) {
        newState.message = '你破产了，无法支付账单，游戏结束！';
      } else {
        newState.message += ' 但由于你负债累累，资金链彻底断裂，游戏结束！';
      }
    }

    // Check if Health Burnout (健康归零猝死)
    if (newState.health <= 0 && newState.status === 'playing') {
      newState.status = 'game_over';
      newState.message = (newState.message ? newState.message + ' ' : '') + '【身体崩溃猝死】由于高强度高压工作与长期极度疲劳，你的健康值彻底归零，身体突发严重 Burnout 猝死，遗憾登出了硅谷人生！';
    }

    // Check FIRE milestone
    let triggerFireMilestone = false;
    if (newState.cash + (newState.stocks || 0) >= newState.win_threshold && newState.status === 'playing') {
      if (currentEventId !== 'fire_milestone_choice' && currentEventId !== 'end') {
        triggerFireMilestone = true;
        sound.play('win');
      }
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
    } else if (triggerFireMilestone) {
      setCurrentEventId('fire_milestone_choice');
    } else {
      let nextId = typeof choice.nextEventId === 'function' ? choice.nextEventId(newState) : choice.nextEventId;
      
      // Trigger Character Pass Modal after school selection
      if (currentEventId === 'choose_school') {
        setShowCharacterPass(true);
      }

      // Intercept return to daily life if we are in mid-year (H1 -> H2 -> Year End Settlement)
      if (nextId === 'sv_daily_life' && newState.mid_year) {
        if (newState.season_stage === 'h1' || !newState.season_stage) {
          newState.season_stage = 'h2';
          nextId = midYearEventRouter(newState);
        } else {
          newState.season_stage = undefined;
          nextId = 'sv_year_end_settlement';
        }
      }
      
      setCurrentEventId(nextId);
    }
  };

  const resetGame = () => {
    safeStorage.removeItem('sv_life_initial_seed');
    safeStorage.removeItem('sv_life_ssr_status');
    setGameState(generateInitialState());
    setCurrentEventId('choose_trait');
    setShowCharacterPass(false);
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
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Modals with Lazy Suspense */}
      <Suspense fallback={null}>
        {/* Welcome Intro Modal (First Boot) */}
        {showWelcome && (
          <WelcomeModal
            onStart={() => {
              setShowWelcome(false);
              safeStorage.setItem('sv_life_welcome_seen', 'true');
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
      </Suspense>

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
              <span className="text-purple-400 font-extrabold">职级</span> {gameState.level || (gameState.job_type === 'unemployed' || gameState.laid_off || !gameState.job_type ? '待业' : gameState.job_type === 'quant' ? 'Quant' : gameState.job_type === 'ai_research' ? 'MTS' : gameState.job_type === 'trader' ? '全职 Trader' : gameState.job_type === 'startup_founder' ? 'CEO & Founder' : gameState.is_phd ? 'L4' : 'L3')}
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
              onClick={() => setShowAchievementCodex(true)}
              className="px-2 py-1 rounded-md bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
            >
              <svg className="w-3 h-3 text-amber-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.45 1-1 1H7v4h10v-4h-2c-.55 0-1-.45-1-1v-2.34M18 4H6v7a6 6 0 0 0 12 0V4z"/></svg>
              <span>图鉴</span>
            </button>

            {/* Timeline Mobile Button */}
            <button
              onClick={() => setShowCareerTimeline(true)}
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
            onOpenCodex={() => setShowAchievementCodex(true)} 
            onOpenShop={handleOpenShop}
            onOpenTimeline={(tab) => {
              setTimelineInitialTab(tab || 'chart');
              setShowCareerTimeline(true);
            }}
            onToggleSound={handleToggleSound} 
            isMuted={isMuted} 
            hasOpenedShop={hasOpenedShop}
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
              onOpenShop={handleOpenShop}
              onOpenTimeline={(tab) => {
                setTimelineInitialTab(tab || 'chart');
                setShowCareerTimeline(true);
              }}
              onToggleSound={handleToggleSound} 
              isMuted={isMuted} 
              hasOpenedShop={hasOpenedShop}
            />
          </div>

          {/* Modals */}
          <Suspense fallback={null}>
            {showCareerTimeline && (
              <CareerTimelineModal 
                gameState={gameState}
                initialTab={timelineInitialTab}
                onClose={() => setShowCareerTimeline(false)}
              />
            )}
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
                    newState.charm = Math.max(0, Math.min(newState.max_charm || 25, newState.charm));
                    
                    // 🛡️ Global Visa Invariant Guard Middleware
                    if (prev.visa === '公民') {
                      newState.visa = '公民';
                      newState.gc_progress = 5;
                      newState.gc_stage = 'approved';
                    } else if (prev.visa === '绿卡' && newState.visa !== '公民') {
                      newState.visa = '绿卡';
                      newState.gc_progress = 5;
                      newState.gc_stage = 'approved';
                    }
                    
                    // 🛡️ Auto Liquidate Stocks if Cash < 0 on Shop Purchase
                    if (newState.cash < -0.001 && (newState.stocks || 0) > 0 && newState.status === 'playing') {
                      const deficit = Math.abs(newState.cash);
                      const sellAmt = Math.min(newState.stocks || 0, deficit);
                      newState.stocks = (newState.stocks || 0) - sellAmt;
                      newState.cash = newState.cash + sellAmt;
                      if (sellAmt > 0) {
                        msg += ` 【股票自动变现】现金流不足，系统已自动变现 $${sellAmt.toFixed(1)}w 股票持仓以支付商城开销。`;
                      }
                    }

                    // Timeline Auto Recording for Shop Purchases
                    const updatedTimeline = [...(newState.timeline || [])];
                    const recAge = newState.age;
                    const recYear = newState.year;
                    if (effect.housing_name && effect.housing_name !== prev.housing_name && ['Atherton 顶级豪宅', 'Sunnyvale 老破小', 'North San Jose 联排', 'Fremont 学区房'].includes(effect.housing_name)) {
                      updatedTimeline.push({
                        age: recAge, year: recYear,
                        title: `置业安家: 购入 ${effect.housing_name}`,
                        description: `在加州湾区拥有了属于自己的房产，成为有产阶级！`,
                        category: 'real_estate',
                        statHighlight: effect.housing_name
                      });
                    }
                    if (effect.rental_income && (effect.rental_income > (prev.rental_income || 0))) {
                      updatedTimeline.push({
                        age: recAge, year: recYear,
                        title: '资产扩张: 布局不动产被动现金流',
                        description: `名下投资房产/ADU 落地出租，年化被动租金现金流增至 +$${effect.rental_income.toFixed(1)}w！`,
                        category: 'real_estate',
                        statHighlight: `+$${effect.rental_income.toFixed(1)}w/年`
                      });
                    }
                    if (effect.car && effect.car !== prev.car && effect.car !== 'none') {
                      const carMap: Record<string, string> = { porsche: '保时捷 Porsche 911', cybertruck: '特斯拉 Cybertruck', model_y: 'Tesla Model Y' };
                      updatedTimeline.push({
                        age: recAge, year: recYear,
                        title: `座驾升级: 提车 ${carMap[effect.car] || effect.car}`,
                        description: '行驶在加州 101 高速公路上，尽情体验硅谷速度与驾驶乐趣！',
                        category: 'wealth',
                        statHighlight: carMap[effect.car]
                      });
                    }
                    newState.timeline = updatedTimeline;

                    // Check game over & win
                    if (newState.health <= 0 && newState.status === 'playing') {
                      newState.status = 'game_over';
                      newState.message = '你因为过度劳累而猝死 (Burnout)，游戏结束！';
                      setCurrentEventId('end');
                    } else if (newState.cash < -0.001 && newState.status === 'playing') {
                      newState.status = 'game_over';
                      newState.message = '你破产了，无法支付账单，游戏结束！';
                      setCurrentEventId('end');
                    } else if (newState.cash + (newState.stocks || 0) >= newState.win_threshold && newState.status === 'playing') {
                      newState.message = `总资产突破 $${newState.win_threshold}w！达成财务自由里程碑！`;
                      setCurrentEventId('fire_milestone_choice');
                    } else if (newState.status === 'win') {
                      setCurrentEventId('end');
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
          </Suspense>

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
                      const costMatch = choice.costBadge || choice.text.match(/\((?:消耗|花费|每年|\$|成本|折抵|实付).*?\)/)?.[0]?.slice(1, -1);
                      const reqMatch = choice.reqBadge || choice.text.match(/\((?:需要|需|算法|高魅力|现金).*?\)/)?.[0]?.slice(1, -1);
                      
                      let mainText = choice.text
                        .replace(/\((?:消耗|花费|每年|\$|成本|折抵|实付).*?\)/g, '')
                        .replace(/\((?:需要|需|算法|高魅力|现金).*?\)/g, '')
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

