import type { GameState, TimelineRecord } from '../types';
import { isOwnedHousing, isPermanentVisa, VISA_STATUS } from '../constants/gameConstants';

export interface TransitionContext {
  eventId?: string;
  source?: 'event' | 'shop' | 'settlement';
  customMessage?: string;
}

export interface TransitionResult {
  nextState: GameState;
  shouldEndTurn?: boolean;
  targetEventId?: string;
}

/**
 * Unified State Transition & Invariant Enforcement Middleware.
 * All state mutations (from event choices, shop purchases, and settlements)
 * pass through this single pipeline to guarantee invariants, normalize transitions, and capture milestones.
 */
export function applyStateTransition(
  prevState: GameState,
  effect: Partial<GameState>,
  context: TransitionContext = {}
): TransitionResult {
  const normalizedEffect = { ...effect };

  // ==========================================
  // 1. IMMUNE SYSTEM: STATE NORMALIZATION
  // ==========================================
  // Normalize Layoff / Unemployment: If an event sets laid_off: true or job_type: unemployed, force tc=0
  if (normalizedEffect.laid_off === true || normalizedEffect.job_type === 'unemployed') {
    normalizedEffect.tc = 0;
    normalizedEffect.job_type = 'unemployed';
    normalizedEffect.laid_off = true;
  }
  // Normalize Employment State: If an event gives a job, force laid_off: false
  if (normalizedEffect.job_type && normalizedEffect.job_type !== 'unemployed') {
    normalizedEffect.laid_off = false;
    // If player enters the workforce on an F-1 student visa, auto-transition to OPT
    if ((prevState.visa === VISA_STATUS.F1 || !prevState.visa || prevState.visa === VISA_STATUS.NONE) && !normalizedEffect.visa) {
      normalizedEffect.visa = VISA_STATUS.OPT;
    }
  }

  // Green Card Reset Middleware (Job Hopping)
  let gcHopNote = '';
  const isNewJob = normalizedEffect.is_new_job || 
                   (context.eventId === 'job_hunt' && normalizedEffect.laid_off === false) ||
                   (normalizedEffect.job_type && normalizedEffect.job_type !== 'unemployed' && normalizedEffect.job_type !== prevState.job_type) ||
                   (normalizedEffect.company && normalizedEffect.company !== prevState.company);
                   
  const currentVisa = prevState.visa;
  const targetVisa = normalizedEffect.visa || currentVisa;
  const isPermanent = isPermanentVisa(currentVisa) || isPermanentVisa(targetVisa);

  if (isNewJob && !isPermanent && targetVisa !== VISA_STATUS.O1 && !prevState.is_phd) {
    const isI140Approved = ['i140_approved', 'waiting_pd', 'i485_pending', 'approved'].includes(prevState.gc_stage || '');
    if (prevState.gc_stage === 'perm_processing' || prevState.gc_stage === 'perm_audit' || prevState.gc_stage === 'i140_processing' || prevState.gc_stage === 'i140_rfe') {
      normalizedEffect.gc_stage = 'perm_processing';
      normalizedEffect.gc_progress = 1;
      gcHopNote = ' 【H1B 跳槽 PERM 重置】因跳槽时旧公司 I-140 尚未批准，原 PERM 废弃，新公司须重新为您递交 PERM 重新排队。';
    } else if (isI140Approved) {
      gcHopNote = ' 【I-140 已锁 PD】因之前 I-140 已批准，本次跳槽成功锁定原优先日期 (PD)！';
    }
  }

  const newState: GameState = {
    ...prevState,
    imageUrl: undefined, // Clear temporary event images unless explicitly overridden
    ...normalizedEffect,
  };

  // 2. Boundary Clamping & Numeric Sanitization
  const maxCharmLimit = newState.max_charm || 25;
  newState.health = Math.max(0, Math.min(100, isNaN(newState.health) ? 80 : newState.health));
  newState.leetcode = Math.max(0, Math.min(100, isNaN(newState.leetcode) ? 0 : newState.leetcode));
  newState.charm = Math.max(0, Math.min(maxCharmLimit, isNaN(newState.charm) ? 10 : newState.charm));
  newState.network = Math.max(0, Math.min(100, isNaN(newState.network || 0) ? 10 : (newState.network || 10)));
  newState.cash = isNaN(newState.cash) ? 0 : parseFloat(newState.cash.toFixed(2));
  newState.stocks = isNaN(newState.stocks || 0) ? 0 : parseFloat((newState.stocks || 0).toFixed(2));
  newState.tc = isNaN(newState.tc || 0) ? 0 : parseFloat((newState.tc || 0).toFixed(2));

  // 3. Global Invariant Guard: Protect Citizen & Green Card status against accidental downgrades
  if (prevState.visa === VISA_STATUS.CITIZEN) {
    newState.visa = VISA_STATUS.CITIZEN;
    newState.gc_progress = 5;
    newState.gc_stage = 'approved';
  } else if (prevState.visa === VISA_STATUS.GREEN_CARD && newState.visa !== VISA_STATUS.CITIZEN) {
    newState.visa = VISA_STATUS.GREEN_CARD;
    newState.gc_progress = 5;
    newState.gc_stage = 'approved';
  }

  // 4. Global Invariant Guard: Unemployment TC must be 0
  if (newState.laid_off || newState.job_type === 'unemployed') {
    newState.tc = 0;
  }

  // 5. Auto Liquidate Stocks if Cash < 0 on Purchases
  let liquidationNote = '';
  if (newState.cash < -0.001 && (newState.stocks || 0) > 0 && newState.status === 'playing') {
    const deficit = Math.abs(newState.cash);
    const sellAmt = Math.min(newState.stocks || 0, deficit);
    newState.stocks = (newState.stocks || 0) - sellAmt;
    newState.cash = newState.cash + sellAmt;
    if (sellAmt > 0) {
      liquidationNote = ` 【股票自动变现】现金流不足，系统已自动变现 $${sellAmt.toFixed(1)}w 股票持仓以覆盖支出。`;
    }
  }

  // 6. Automated Independent Timeline Milestone Capture
  const updatedTimeline: TimelineRecord[] = [...(newState.timeline || [])];
  const recAge = newState.age;
  const recYear = newState.year;

  if (context.eventId === 'choose_trait' && normalizedEffect.trait_title) {
    updatedTimeline.push({
      age: recAge, year: recYear,
      title: `特质觉醒: ${normalizedEffect.trait_title}`,
      description: normalizedEffect.trait_desc || '开启独特的硅谷人生底色与专属天赋属性',
      category: 'milestone',
    });
  }

  if (context.eventId === 'choose_school') {
    const schoolMap: Record<string, string> = { cmu: 'CMU (卡耐基梅隆)', ucb: 'UCB (加州伯克利)', state: 'SJSU (圣何塞州立)' };
    const schoolName = normalizedEffect.school ? (schoolMap[normalizedEffect.school] || normalizedEffect.school) : '国内高校 / 中外合办大学';
    updatedTimeline.push({
      age: recAge, year: recYear,
      title: `踏上征途: 入读 ${schoolName}`,
      description: normalizedEffect.school ? '背上行囊，正式开启学术积累与北美留学生涯' : '进入大学校园，打下扎实的高等数学与算法编程底子',
      category: 'education',
    });
  }

  if (normalizedEffect.is_master && !prevState.is_master) {
    updatedTimeline.push({
      age: recAge, year: recYear,
      title: '深造进阶: 入读北美 CS 硕士研究生',
      description: '手握录取通知书飞赴美国，开启高强度课业与刷题求职新篇章！',
      category: 'education',
    });
  }

  if (normalizedEffect.is_phd && !prevState.is_phd) {
    updatedTimeline.push({
      age: recAge, year: recYear,
      title: '学术殿堂: 斩获北美顶尖 CS 全奖直博 PhD',
      description: '加入顶级人工智能实验室，致力于前沿顶会论文与分布式架构研发！',
      category: 'education',
    });
  }

  if (normalizedEffect.is_new_job || (normalizedEffect.job_type && normalizedEffect.job_type !== 'unemployed' && (normalizedEffect.job_type !== prevState.job_type || normalizedEffect.company !== prevState.company))) {
    const compMap: Record<string, string> = {
      google: 'Google (谷歌)', meta: 'Meta (卷王)', nvidia: 'NVIDIA (英伟达)', tiktok: 'TikTok (字节)',
      apple: 'Apple (苹果)', amazon: 'Amazon (亚麻)', openai: 'OpenAI', citadel: 'Citadel (城堡)',
      uber: 'Uber (优步)', microsoft: 'Microsoft (微软)', cisco: 'Cisco (思科)', adobe: 'Adobe (奥多比)',
      cn_big_tech: '国内一线互联网大厂', icc: 'ICC 外包公司',
    };
    const compName = normalizedEffect.company ? (compMap[normalizedEffect.company] || normalizedEffect.company.toUpperCase()) : (normalizedEffect.job_type === 'cn_tech' ? '国内一线互联网大厂' : normalizedEffect.job_type === 'startup_founder' ? 'AI 独角兽' : '硅谷科技企业');
    const lvl = normalizedEffect.level || (normalizedEffect.job_type === 'cn_tech' ? '国内研发' : normalizedEffect.job_type === 'startup_founder' ? 'Founder' : 'SDE');
    updatedTimeline.push({
      age: recAge, year: recYear,
      title: `成功入职: ${compName} (${lvl})`,
      description: `顺利通过技术面试，年薪总包达到 $${(newState.tc || 0).toFixed(1)}w！`,
      category: 'career',
      statHighlight: `TC $${(newState.tc || 0).toFixed(1)}w`,
    });
  } else if ((normalizedEffect.laid_off && !prevState.laid_off) || (normalizedEffect.job_type === 'unemployed' && prevState.job_type && prevState.job_type !== 'unemployed')) {
    updatedTimeline.push({
      age: recAge, year: recYear,
      title: '职场变故: 离开当前岗位进入待业期',
      description: '遭遇部门业务调整或主动离职，重新进入求职与调整期！',
      category: 'career',
    });
  } else if (normalizedEffect.level && normalizedEffect.level !== prevState.level && normalizedEffect.level !== '待业' && !normalizedEffect.is_new_job && !normalizedEffect.laid_off && normalizedEffect.job_type !== 'unemployed' && prevState.job_type !== 'unemployed' && (newState.tc || 0) > 0) {
    updatedTimeline.push({
      age: recAge, year: recYear,
      title: `职级晋升: 升至 ${normalizedEffect.level}`,
      description: `斩获优秀绩效考核，总包提升至 $${(newState.tc || 0).toFixed(1)}w！`,
      category: 'career',
      statHighlight: `TC $${(newState.tc || 0).toFixed(1)}w`,
    });
  }

  if (normalizedEffect.visa && normalizedEffect.visa !== prevState.visa) {
    const visaDescriptions: Record<string, { title: string; desc: string }> = {
      'Day 1 CPT': { title: '身份自救: 启用 Day 1 CPT (学籍保底)', desc: '在学籍保护下从容应对抽签与离境压力，继续在湾区全职工作！' },
      'L1 (外派)': { title: '跨国调动: 取得 L-1 跨国工作签证', desc: '完成海外分支机构轮岗调动，正式进驻湾区总部！' },
      'H1B (工签)': { title: '人品爆发: 成功抽中 H-1B 工作签证', desc: '在移民局年度大乐透中逆风中签，正式获得独立工签！' },
      'O1 (杰出人才)': { title: '杰出人才: 获批 O-1 签证', desc: '凭借顶会论文或硬核算法成就获批杰出人才工签，免受抽签约束！' },
      '绿卡': { title: '终极突破: 取得美国绿卡 (永久居民)', desc: '漫长排期长征终获全胜！彻底挣脱雇主与抽签枷锁！' },
      '公民': { title: '天命所归: 取得美籍公民身份 (SSR)', desc: '获得绝对免签证与自由工作权益，硅谷人生畅通无阻！' },
      'OPT (实习)': { title: '走向职场: 激活 OPT 实习期', desc: '顺利走出象牙塔，正式踏入北美职场求职与工作实战！' },
      'F1 (学生)': { title: '求学签证: 获批 F-1 留学生签证', desc: '踏上赴美求学之路，开启海外求学生涯！' },
    };
    const info = visaDescriptions[normalizedEffect.visa] || { title: `身份跨越: 取得 ${normalizedEffect.visa}`, desc: '北美合法留美与工作身份迎来关键突破！' };
    updatedTimeline.push({
      age: recAge, year: recYear,
      title: info.title,
      description: info.desc,
      category: 'immigration',
      statHighlight: normalizedEffect.visa,
    });
  }

  if (normalizedEffect.housing_name && normalizedEffect.housing_name !== prevState.housing_name && isOwnedHousing(normalizedEffect.housing_name)) {
    updatedTimeline.push({
      age: recAge, year: recYear,
      title: `置业安家: 购入 ${normalizedEffect.housing_name}`,
      description: `在加州湾区拥有了属于自己的房产，成为有产阶级！`,
      category: 'real_estate',
      statHighlight: normalizedEffect.housing_name,
    });
  }

  if (normalizedEffect.rental_income && (normalizedEffect.rental_income > (prevState.rental_income || 0))) {
    updatedTimeline.push({
      age: recAge, year: recYear,
      title: '资产扩张: 布局不动产被动现金流',
      description: `名下投资房产/ADU 落地出租，年化被动租金现金流增至 +$${normalizedEffect.rental_income.toFixed(1)}w！`,
      category: 'real_estate',
      statHighlight: `+$${normalizedEffect.rental_income.toFixed(1)}w/年`,
    });
  }

  if (normalizedEffect.car && normalizedEffect.car !== prevState.car && normalizedEffect.car !== 'none') {
    const carMap: Record<string, string> = { porsche: '保时捷 Porsche 911', cybertruck: '特斯拉 Cybertruck', model_y: 'Tesla Model Y' };
    updatedTimeline.push({
      age: recAge, year: recYear,
      title: `座驾升级: 提车 ${carMap[normalizedEffect.car] || normalizedEffect.car}`,
      description: '行驶在加州 101 高速公路上，尽情体验硅谷速度与驾驶乐趣！',
      category: 'wealth',
      statHighlight: carMap[normalizedEffect.car],
    });
  }

  if (normalizedEffect.is_married && !prevState.is_married) {
    updatedTimeline.push({
      age: recAge, year: recYear,
      title: '缔结良缘: 步入婚姻殿堂',
      description: '在加州与心仪的伴侣正式领证结婚，组建幸福的湾区家庭！',
      category: 'relation',
    });
  }

  if (normalizedEffect.story_flags?.alex_ipo_done && !prevState.story_flags?.alex_ipo_done) {
    updatedTimeline.push({
      age: recAge, year: recYear,
      title: '时代盛宴: OmniAgent 终局退出结算',
      description: '见证 Alex 博士初创智能体公司走向纳斯达克挂牌与巨头并购退出！',
      category: 'wealth',
    });
  }

  if (normalizedEffect.story_flags?.dave_defeated && !prevState.story_flags?.dave_defeated) {
    updatedTimeline.push({
      age: recAge, year: recYear,
      title: '绝地反击: 击溃 Manager Dave',
      description: '凭借扎实的证据链在闭门考核中彻底扳倒职场宿敌！',
      category: 'story',
    });
  }

  if (normalizedEffect.story_flags?.sam_zero_day_done && !prevState.story_flags?.sam_zero_day_done) {
    updatedTimeline.push({
      age: recAge, year: recYear,
      title: '黑客探险: 斩获 Zero-Day 漏洞赏金',
      description: '与极客战友 Sam 在车库通宵调试并提交 AI 云平台底层逃逸漏洞 PoC！',
      category: 'story',
    });
  }

  newState.timeline = updatedTimeline;

  // 7. Game State Termination & Target Event Resolution
  let targetEventId: string | undefined;

  if (newState.health <= 0 && newState.status === 'playing') {
    newState.status = 'game_over';
    newState.message = '你因为过度劳累而猝死 (Burnout)，游戏结束！';
    targetEventId = 'end';
  } else if (newState.cash < -0.001 && newState.status === 'playing') {
    newState.status = 'game_over';
    newState.message = '你破产了，无法支付账单，游戏结束！';
    targetEventId = 'end';
  } else if (newState.status === 'win') {
    targetEventId = 'end';
  } else if (
    (newState.cash + (newState.stocks || 0)) >= newState.win_threshold &&
    !newState.has_reached_initial_fire &&
    newState.status === 'playing' &&
    context.eventId !== 'choose_trait' &&
    context.eventId !== 'choose_year' &&
    context.eventId !== 'choose_school'
  ) {
    newState.message = (context.customMessage || newState.message || '') + gcHopNote + liquidationNote;
    targetEventId = 'fire_milestone_choice';
  } else if (context.customMessage) {
    newState.message = context.customMessage + gcHopNote + liquidationNote;
  } else {
    const extraNotes = gcHopNote + liquidationNote;
    if (extraNotes && newState.message) {
      newState.message = newState.message + extraNotes;
    }
  }

  return {
    nextState: newState,
    targetEventId,
  };
}

