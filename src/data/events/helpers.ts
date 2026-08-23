import type { GameState, StoryFlags, Choice } from '../../types';
import { safeStorage } from '../../utils/safeStorage';
import { STORAGE_KEYS, isOwnedHousing, VISA_STATUS, isPermanentVisa } from '../../constants/gameConstants';
import { gameRandom, gameRandomInt, gamePick, setGameSeed, getGameSeed } from '../../utils/random';
import { getCompanyProfile } from '../companyProfiles';

export { gameRandom, gameRandomInt, gamePick, setGameSeed, getGameSeed };

// True when the player currently has a live partner whose feelings a "career over
// family" choice can strain (married, or actively dating/married status).
export const hasPartner = (s: GameState): boolean =>
  s.is_married || s.relationship_status === 'married' || s.relationship_status === 'dating';

// ── Impact (影响力) — L5+ 高级晋升的硬通货 ─────────────────────────────
// leetcode 管「进厂/初级/面试」，impact 管「往上爬到 Staff/Principal」。主导项目 / 发 paper /
// 爆肝冲刺 累积 impact；躺平摸鱼衰减。L5 以后的晋升与高级跳槽看它。可见于 Bento 面板(分档)。
export const IMPACT_TIERS: { min: number; label: string }[] = [
  { min: 120, label: '行业传奇' },
  { min: 80, label: '跨组标杆' },
  { min: 45, label: '关键先生' },
  { min: 20, label: '团队中坚' },
  { min: 0, label: '崭露头角' },
];
export const impactTier = (n: number): string => (IMPACT_TIERS.find((t) => (n || 0) >= t.min) || IMPACT_TIERS[IMPACT_TIERS.length - 1]).label;

// 加/减 impact 的安全封装(下限 0，无硬上限但天然被衰减压住)。
export const addImpact = (s: GameState, delta: number): number => Math.max(0, (s.impact || 0) + (Number.isFinite(delta) ? delta : 0));

// 大额资产扣除安全封装：优先扣除现金，现金不足时平仓变现股票，彻底杜绝负现金
export const deductAssets = (s: GameState, cost: number): { cash: number; stocks: number } => {
  const fromStocks = Math.max(0, cost - s.cash);
  return {
    cash: Math.max(0, s.cash - Math.min(s.cash, cost)),
    stocks: Math.max(0, (s.stocks || 0) - fromStocks),
  };
};

/**
 * 计算北美顶尖 CS 全奖 PhD 录取概率
 * 综合评估：学校声誉、卷王天赋、学术成果 Impact、算法硬实力、实验室推荐信与 MS 曲线救国重申加成
 */
export const calculatePhdAdmitProb = (s: GameState, isMaster: boolean = false): number => {
  // 无投入地板压低:PhD 应奖励科研(impact)/算法(leetcode)投入,而非"零背景白嫖抽奖"。
  // undergrad base 0.20→0.12;下方 clamp 下限 0.10→0.06。强背景加成与 0.92 顶配封顶不变。
  // (master base 保持 0.25:MS 申博路径已有 leetcode>=50 || impact>=10 准入门槛把关,非无投入。)
  let prob = isMaster ? 0.25 : 0.12;
  if (s.school === 'cmu') prob += 0.20;
  else if (s.school === 'ucb') prob += 0.15;

  // 卷王之王天生做题家与抗压科研爆发力加成
  if (s.trait_title === '卷王之王') prob += 0.15;
  if (s.trait_title === '天选之子') prob += 0.10;

  // 学术成果与论文影响力 (Impact)
  const impact = s.impact || 0;
  if (impact >= 20) prob += 0.25;
  else if (impact >= 10) prob += 0.15;
  else if (impact >= 5) prob += 0.08;

  // 算法硬实力与 GPA 梯队
  if (s.leetcode >= 80) prob += 0.18;
  else if (s.leetcode >= 60) prob += 0.12;
  else if (s.leetcode >= 45) prob += 0.06;

  // 实验室强推与 MS 二战 PhD 加成
  if (s.story_flags?.phd_ready) prob += 0.18;
  if (s.story_flags?.phd_reapply_ready) prob += 0.12;

  return Math.min(0.92, Math.max(0.06, prob));
};

// 跳槽与社招定级：
// 1. 无职级萌新/应届生按学历定级 (本科/硕士 L3, PhD L4)；
// 2. 非标准职级映射 (OpenAI MTS 对应 L6 Staff/L5 Senior, Quant 对应 L6/L5, Founder 对应 L7/L6/L5)；
// 3. 被裁员失业的资深工程师社招再就业时平级录用 (Lateral)，保留其多年打拼积累的资历与职级；
// 4. 在职跳槽者阶梯 +1，但升至 L6+ 需对应 impact (L6>=20, L7>=45, L8>=80)，否则平跳。
const LADDER = ['L3', 'L4', 'L5 (Senior)', 'L6 (Staff)', 'L7 (Senior Staff)', 'L8 (Principal)'];

// Map the player's CURRENT level — including non-standard titles (MTS/Quant/Founder/CN) —
// onto a Big-Tech ladder rung. Returns '' for a true new grad with no prior standing.
const currentLadderRung = (s: GameState): string => {
  if (!s.level || s.level === '待业' || (!s.job_start_age && s.level === '初级研发')) return '';
  let baseLevel = s.level;
  if (baseLevel === 'MTS') {
    // OpenAI Member of Technical Staff (MTS) 对标大厂 L6 Staff (若 TC>=60 或 impact>=20) 或 L5 Senior
    baseLevel = (s.tc >= 60 || (s.impact || 0) >= 20) ? 'L6 (Staff)' : 'L5 (Senior)';
  } else if (baseLevel === 'Quant') {
    baseLevel = (s.tc >= 60 || (s.impact || 0) >= 20) ? 'L6 (Staff)' : 'L5 (Senior)';
  } else if (baseLevel === 'CEO & Founder' || baseLevel === 'CTO & Co-Founder') {
    baseLevel = (s.impact || 0) >= 45 ? 'L7 (Senior Staff)' : (s.impact || 0) >= 20 ? 'L6 (Staff)' : 'L5 (Senior)';
  } else if (baseLevel === '资深研发/Tech Lead') {
    baseLevel = 'L5 (Senior)';
  } else if (baseLevel === '国内研发' || baseLevel === '初级研发') {
    baseLevel = (s.age - (s.job_start_age || s.age)) >= 2 ? 'L4' : 'L3';
  }
  return baseLevel;
};

export const hopTargetLevel = (s: GameState): string => {
  const rung = currentLadderRung(s);
  if (rung === '') return s.is_phd ? 'L4' : 'L3'; // 纯应届生/无往期职级记录
  const curIdx = LADDER.indexOf(rung);
  if (curIdx < 0) return 'L5 (Senior)';

  // 被裁员/待业状态的社招资深员工：平级录用 (Lateral hire)，绝不降级至应届 L3
  if (s.laid_off || s.job_type === 'unemployed') return LADDER[curIdx];

  // 在职主动跳槽：尝试阶梯 +1，若 impact 不足则平跳 (Lateral)
  const target = LADDER[Math.min(LADDER.length - 1, curIdx + 1)];
  const need: Record<string, number> = { 'L6 (Staff)': 20, 'L7 (Senior Staff)': 45, 'L8 (Principal)': 80 };
  if (need[target] && (s.impact || 0) < need[target]) return LADDER[curIdx];
  return target;
};

// True iff hopTargetLevel is a real level-UP vs the player's current standing. The job-hop
// join choices use this to stamp last_promo_age / fire a promo celebration ONLY on an actual
// promotion — a lateral hire (laid-off senior re-hired at grade, an impact-short hop, or an
// already-L8 hop) or an initial onboarding hire (rung '') must not trigger a promotion
// celebration or false timestamp.
export const hopIsPromotion = (s: GameState): boolean => {
  const curRung = currentLadderRung(s);
  if (!curRung) return false;
  return LADDER.indexOf(hopTargetLevel(s)) > LADDER.indexOf(curRung);
};

/**
 * Handles visa resolution when joining a new company via job-hop.
 * L-1 is strictly tied to the original petitioning employer. If hopping to a new company:
 * - If on permanent status (Green Card / Citizen / i485_pending): retains permanent visa.
 * - If holding L-1 (外派):
 *   - If qualified for O-1 (PhD, impact >= 20, leetcode >= 85, or ai_research): new employer petitions O-1.
 *   - Otherwise: bridges via Day 1 CPT to maintain work authorization.
 */
export const resolveHopVisaTransition = (s: GameState): { visa: string; cashDelta: number; note: string } => {
  if (s.visa === '绿卡' || s.visa === '公民' || s.gc_stage === 'i485_pending' || s.gc_stage === 'approved') {
    return { visa: s.visa, cashDelta: 0, note: '' };
  }
  if (s.visa === 'L1 (外派)') {
    const o1Eligible = s.is_phd || (s.impact || 0) >= 20 || s.leetcode >= 85 || s.job_type === 'ai_research';
    if (o1Eligible) {
      return {
        visa: 'O1 (杰出人才)',
        cashDelta: 0,
        note: '\n\n【工签解绑】新公司律所评估了你的硬核技术背景，成功为你加急办妥 O-1 杰出人才签证，顺利解绑原雇主 L-1 限制！'
      };
    } else {
      return {
        visa: 'Day 1 CPT',
        cashDelta: -1.5,
        note: '\n\n【工签过渡】因原 L-1 签证绑定原雇主无法直接跨公司 Transfer，新雇主协助你紧急挂靠 Day 1 CPT 学籍合法入职！'
      };
    }
  }
  return { visa: s.visa, cashDelta: 0, note: '' };
};

// impact 只对标准大厂/研究/量化阶梯有意义(founder/trader/unemployed 无此概念)。
export const isImpactCareer = (s: GameState): boolean =>
  s.job_type === 'big_tech' || s.job_type === 'ai_research' ||
  s.job_type === 'quant' || s.job_type === 'cn_tech';

// ── 一生一次 (once-per-life) 事件的统一基座 ───────────────────────────────────────────────
// 约定:事件 <id> 触发过一次 ⇔ story_flags[`${id}_seen`] === true。以下是唯一权威实现,取代此前
// 散落在 6 个事件文件里各自复制的 `const seen = ...`(去重),也是新事件应统一使用的机制。
// 配合 GameEvent.oncePerLife=true:applyStateTransition 会在该事件被解析后【自动置位】_seen
// (作者无需手写置位),路由/池注入侧用 hasSeen(s,id) 门禁(无需手写 !sig.xxx_seen)——
// 从机制上消除"漏检/漏置 → 该一次却复发"这类 bug(ICU 事件即此类)。
export const hasSeen = (s: GameState, id: string): boolean => Boolean(s.story_flags?.[`${id}_seen`]);
export const markSeen = (s: GameState, id: string): StoryFlags => ({ ...(s.story_flags || {}), [`${id}_seen`]: true });

// Stamp a once-per-life「seen」flag AND (optionally) accrue partner_strain — but only
// when the player actually has a partner to neglect. Used by "career over family" crunch
// choices so the family-neglect → breakup_crisis causal loop is real, not random.
export const stampSeen = (s: GameState, id: string, strainDelta = 0): StoryFlags => {
  const flags: StoryFlags = markSeen(s, id);
  if (strainDelta > 0 && hasPartner(s)) {
    flags.partner_strain = (s.story_flags?.partner_strain || 0) + strainDelta;
  }
  return flags;
};

// Where a college random event routes AFTER it resolves (also the "skip" target
// when no random event fires). Honors the `college_next` flag set by the year
// event so the same pool can fire both mid-college (-> junior year) and in the
// final year (-> graduation), across undergrad / master / domestic.
export const collegeNextStage = (s: GameState): string => {
  const next = s.story_flags?.college_next;
  if (next === 'us_master_grad') return 'us_master_grad';
  if (next === 'us_undergrad_grad') return 'us_undergrad_grad';
  if (next === 'cn_undergrad_grad') return 'cn_undergrad_grad';
  // Master students settle to master graduation; undergrad mid-college -> junior year.
  return (s.is_master || (s.housing_name || '').includes('美硕')) ? 'us_master_grad' : 'us_undergrad_year3';
};

// Probabilistic college-event injection. Only ~60% of the time does a random
// college event fire; otherwise we skip straight to the next stage. This is a
// reboot-heavy game, so a FIXED number of mandatory college screens every run
// would feel like padding on repeat playthroughs — this keeps pacing varied
// (some runs get 0, 1, or 2 events) while the pool of 12 keeps content fresh.
// The pool ids are written INLINE so the reachability audit (which parses
// nextEventId.toString()) still discovers every event in the pool.
export const pickCollegeEvent = (s: GameState): string => {
  if (gameRandom() < 0.4) return collegeNextStage(s); // ~40% skip -> straight to next stage
  const pool = [
    'college_hackathon_boom', 'college_gpa_crisis', 'college_business_pitch', 'college_spring_gala',
    'college_dorm_roommate', 'college_road_trip', 'college_internship_grind', 'college_heartbreak',
    'college_health_scare', 'college_side_gig', 'college_culture_shock', 'college_viral_moment',
  ];
  return pool[Math.floor(gameRandom() * pool.length)];
};

// Shared O1 (extraordinary-ability visa) approval probability, so every event that
// offers O1 uses the same odds keyed on the same predicate as its condition (was
// inconsistent: 0.30/0.35 non-PhD and 0.70/0.75 PhD across different events, and
// ai_research applicants got the low rate in some events but the high rate in others).
export const o1PassProb = (s: GameState): number =>
  (s.is_phd || (s.impact || 0) >= 20 || s.job_type === 'ai_research' || s.leetcode >= 85) ? 0.72 : 0.32;

// Helper to scale job hunt TC based on candidate's existing engineering level (benchmarked to levels.fyi)
export const getLevelScaledTC = (baseL3TC: number, level?: string): number => {
  if (level === 'L8 (Principal)' || level === 'Principal' || level === 'Fellow') return Math.min(220, Math.floor(baseL3TC * 7.2));
  if (level === 'L7 (Senior Staff)' || level === 'Senior Staff' || level === 'L7') return Math.min(120, Math.floor(baseL3TC * 4.5));
  if (level === 'L6 (Staff)' || level === 'Staff' || level === 'MTS') return Math.min(78, Math.floor(baseL3TC * 3.1));
  if (level === 'L5 (Senior)' || level === 'L5') return Math.min(52, Math.floor(baseL3TC * 2.1));
  if (level === 'L4') return Math.min(34, Math.floor(baseL3TC * 1.4));
  if (level === 'Quant') return Math.min(85, Math.floor(baseL3TC * 1.5));
  return Math.min(24, baseL3TC); // L3 or new grad
};

export const generateInitialState = (customSeed?: number): GameState => {
  let savedSeed: { cash: number; charm: number; max_charm: number; luck: number; is_ssr_unlocked?: boolean; seed?: number } | null = null;

  try {
    const stored = safeStorage.getItem(STORAGE_KEYS.INITIAL_SEED);
    if (stored) savedSeed = JSON.parse(stored);
  } catch (e) {
    // Ignore storage errors
  }

  let luck: number, cash: number, charm: number, max_charm: number, is_ssr_unlocked: boolean, seed: number;

  if (savedSeed && customSeed === undefined) {
    luck = savedSeed.luck;
    cash = savedSeed.cash;
    charm = savedSeed.charm;
    max_charm = savedSeed.max_charm;
    is_ssr_unlocked = Boolean(savedSeed.is_ssr_unlocked);
    seed = typeof savedSeed.seed === 'number' ? savedSeed.seed : setGameSeed(Date.now());
    setGameSeed(seed);
  } else {
    seed = customSeed !== undefined
      ? setGameSeed(customSeed)
      : setGameSeed((Date.now() ^ (Math.floor(Math.random() * 2147483647))) >>> 0); // lint:allow-math-random (bootstrapping the PRNG seed itself)

    // 8% random roll for SSR Native US Citizen trait on fresh new game initialization
    is_ssr_unlocked = gameRandom() < 0.08;

    // Generate new using PRNG
    const isRich = gameRandom() < 0.15; // 15% 概率富二代
    if (!isRich) {
      cash = gameRandomInt(8, 12); // 8 - 12 万美元 (中产家庭)
    } else {
      cash = gameRandomInt(25, 50); // 25 - 50 万美元 (富裕家庭)
    }
    charm = gameRandomInt(1, 10); // 颜值 1-10
    max_charm = Math.min(30, Math.max(15, charm + gameRandomInt(8, 14)));
    luck = gameRandomInt(0, 99);

    safeStorage.setItem(STORAGE_KEYS.INITIAL_SEED, JSON.stringify({ cash, charm, max_charm, luck, is_ssr_unlocked, seed }));
  }

  let bgMessage = '';
  // Rich roll produces cash 25-50, so the threshold must be 25, not 60 (which was
  // unreachable — every 富二代 was mislabeled a 小康/普通家庭).
  if (cash >= 25) bgMessage += '你出生在一个富裕的家庭，启动资金充足！';
  else if (cash < 15) bgMessage += '你出生在一个普通家庭，预算非常吃紧。';
  else bgMessage += '你出生在一个小康家庭。';

  if (charm >= 9) bgMessage += ' 顺便一提，你从小就长得像大明星，走到哪里都是焦点。';
  else if (charm <= 3) bgMessage += ' 长相平平无奇，是个实在人。';

  return {
    age: 18,
    cash,
    stocks: 0,
    health: 100,
    leetcode: 10,
    impact: 0,
    visa: '无',
    tc: 0,
    macro_economy: 'neutral',
    rent: 4,
    charm,
    max_charm,
    year: 2018, // 默认，会被第一步覆盖
    gc_progress: 0,
    has_us_degree: false,
    school: '',
    is_phd: false,
    has_pet: false,
    luck,
    network: 10,
    is_married: false,
    relationship_status: 'single',
    win_threshold: 500, // basic FIRE tier ($500w); choose_trait harmonizes all traits to this baseline
    last_fire_milestone_reached: 0,
    laid_off: false,
    has_housing: false,
    housing_name: '国内老家',
    car: 'none',
    difficulty_title: '普通难度',
    is_ssr_unlocked,
    status: 'playing',
    npcs: {},
    story_flags: {},
    timeline: [],
    history_net_worth: [{ age: 18, year: 2018, netWorth: parseFloat(cash.toFixed(1)), cash: parseFloat(cash.toFixed(1)), stocks: 0 }],
    message: bgMessage,
    seed,
  };
};

// Mid-year event router: called after choosing a yearly focus in sv_daily_life.
// Mid-year event router: called after choosing a yearly focus in sv_daily_life.
// Weaves in 1-2 random events before year-end settlement.
export const midYearEventRouter = (s: GameState): string => {
  const isWorking = Boolean(s.job_type && s.job_type !== 'unemployed' && !s.laid_off);
  const isBigTech = s.job_type === 'big_tech';

  // Stage H1 (Spring/Summer: Career & Major Work Events)
  if (s.season_stage === 'h1' || !s.season_stage) {
    // --- 0. 优先消费长线因果剧情链 (Priority Narrative Arcs) ---
    // 1) Alex 博士剧情链：Series A 创业合伙人/天使邀请
    if (s.story_flags?.met_alex && !s.story_flags?.alex_startup_invited && isWorking && s.age >= 24 && s.year >= (Number(s.story_flags.alex_meet_year || 0) + 1)) {
      return 'alex_startup_series_a';
    }

    // 2) Alex 博士剧情链：OmniAgent 纳斯达克 IPO / 退出回报结算
    if ((s.story_flags?.joined_omniagent || s.story_flags?.angel_invest_omniagent) && !s.story_flags?.alex_ipo_done && s.year >= (Number(s.story_flags.omniagent_start_year || 0) + 3)) {
      return 'alex_omniagent_ipo_exit';
    }

    // 3) Dave 职场宿敌剧情链：掌握证据后的年度考核摊牌大反击
    if (s.story_flags?.has_dave_evidence && !s.story_flags?.dave_defeated && isWorking && s.year >= (Number(s.story_flags.dave_conflict_year || 0) + 1)) {
      return 'dave_retaliation_showdown';
    }

    // 4) Dave 职场宿敌剧情链：多年后的面试桌攻守易形逆转
    if (s.story_flags?.dave_defeated && !s.story_flags?.dave_veto_done && (s.level === 'L6 (Staff)' || s.level === 'L7 (Senior Staff)' || s.level === 'L8 (Principal)' || s.job_type === 'startup_founder') && s.year >= (Number(s.story_flags.dave_defeated_year || 0) + 2)) {
      return 'dave_interview_veto';
    }

    // 5) Sam 极客战友剧情链：Zero-Day 漏洞与黑客项目
    if (s.story_flags?.met_sam && !s.story_flags?.sam_zero_day_done && s.age >= 24 && s.leetcode >= 25 && gameRandom() < 0.35) {
      return 'sam_garage_zero_day';
    }

    // 6) Raj 职场向上管理与架构评审剧情链：
    // 6a) 首次相遇与季度对齐
    if (isWorking && isBigTech && !s.story_flags?.raj_alignment_seen && s.age >= 24 && s.age <= 34 && gameRandom() < 0.28) {
      return 'raj_scrum_alignment_dilemma';
    }
    // 6b) 多年后 Raj 晋升 Director 后的架构委员会提拔 —— 仅对冲击 L7 (Senior Staff) 的 L6 (Staff)
    // 玩家生效:Raj 的高层背书只在「L6→L7 这种关键大跳」上帮忙,不插手常见的 L5→L6,也不
    // 白送传奇级 L7→L8。
    if ((s.story_flags?.raj_ally || s.story_flags?.raj_rival || s.story_flags?.raj_solid) && !s.story_flags?.raj_board_done && isWorking && s.level === 'L6 (Staff)' && s.year >= (Number(s.story_flags.raj_meet_year || 0) + 2)) {
      return 'raj_director_promotion_board';
    }

    // 7) Linda 沙丘路华人投资人剧情链：
    // 7a) 沙丘路闭门沙龙结识
    if (!s.story_flags?.met_linda && isWorking && s.age >= 25 && ((s.network || 0) >= 12 || (s.charm || 0) >= 12 || s.leetcode >= 60) && gameRandom() < 0.25) {
      return 'linda_sand_hill_encounter';
    }
    // 7b) Pre-IPO 独角兽老股额度与领投资源
    if (s.story_flags?.met_linda && !s.story_flags?.linda_deal_done && s.year >= (Number(s.story_flags.linda_meet_year || 0) + 2) && gameRandom() < 0.4) {
      return 'linda_angel_co_investment';
    }

    // 8) 首次担任暑期实习生 Mentor (L4 / L5 专属，有且仅有 1 次)
    if (isWorking && isBigTech && !s.story_flags?.intern_mentored && (s.level === 'L4' || s.level === 'L5 (Senior)' || s.level === 'L5') && gameRandom() < 0.35) {
      return 'career_summer_intern_mentor';
    }

    // 9) 非科班转码职场成长线 (Non-CS Career Switcher Arc, 一生一次)
    if (s.story_flags?.non_cs_background && isWorking) {
      if (!hasSeen(s, 'zhuanma_imposter_syndrome') && s.age >= 24 && s.age <= 34 && gameRandom() < 0.30) {
        return 'zhuanma_imposter_syndrome';
      }
      if (!hasSeen(s, 'zhuanma_domain_crossover') && s.age >= 26 && s.year >= 2021 && gameRandom() < 0.28) {
        return 'zhuanma_domain_crossover';
      }
      if (!hasSeen(s, 'zhuanma_mentor_community') && (s.level === 'L5 (Senior)' || s.level === 'L5' || s.level === 'L6 (Staff)' || s.level === 'L6') && gameRandom() < 0.30) {
        return 'zhuanma_mentor_community';
      }
    }

    // 宏观行情快讯 (telegraph)。经济周期现由年终结算的 Markov 链驱动 (settlement.ts);这里在 H1 以
    // 完整事件「播报」当前 regime,让玩家——尤其 trader——在做年度决策前清晰读到牛/熊/横盘行情。
    // 纯播报,不改经济 (驱动在结算)。牛/熊年高频、横盘年低频。旧实现被 `!season_stage` 永久锁死
    // (H1 恒带 season_stage),且是「切换器」而非「播报器」——已随经济周期改由结算驱动而重写。
    if (s.macro_economy === 'bull' && gameRandom() < 0.22) return 'news_bull_market_start';
    if (s.macro_economy === 'bear' && gameRandom() < 0.22) return 'news_bear_market_crash';
    if (s.macro_economy === 'neutral' && gameRandom() < 0.05) return 'news_neutral_market';

    if (s.job_type === 'trader') return 'trader_annual_strategy';
    if (s.job_type === 'startup_founder') {
      // 两难：All-in 冲刺 vs 家庭 (dilemmaEvents.ts)，一局至多一次
      if (hasPartner(s) && !s.story_flags?.dilemma_startup_allin_family_seen && gameRandom() < 0.3) return 'dilemma_startup_allin_family';
      // 反单调：founder 年份不再永远是同一个决策枢纽——~40% 概率触发创业专属危机剧情
      // (合伙人撕逼 / VC 跳票 / 断粮 / 黑客松)，其余年份才回到 founder_annual_strategy 战略枢纽。
      // 写成字面量 return 便于 audit_all_flows.ts 源码扫描确定性识别可达性。
      if (gameRandom() < 0.4) {
        const r = gameRandom();
        if (r < 0.25) return 'founder_co_founder_drama';
        if (r < 0.50) return 'founder_vc_term_sheet_ghost';
        if (r < 0.75) return 'founder_runway_cash_crunch';
        return 'founder_hacker_house_hackathon';
      }
      return 'founder_annual_strategy';
    }
     if (!isWorking) return 'job_hunt';
     if (s.job_type === 'startup') {
       if (hasPartner(s) && !s.story_flags?.dilemma_startup_allin_family_seen && gameRandom() < 0.3) return 'dilemma_startup_allin_family';
       // 反 pool-starving：初创路径过去每年必是 startup_crisis（且三个选项都会失业→job_hunt，
       // 导致 startup 生涯根本无法存续）。改为加权池：以可存续的 startup_work 为主，掺入危机与
       // 跨切事件，既多样、又不再每年必然被裁。
       const startupPool = ['startup_work', 'startup_work', 'startup_crisis'];
       if (s.year >= 2024) startupPool.push('ai_disruption_existential');
       if (gameRandom() < 0.3) startupPool.push('layoff_rumor');
       return gamePick(startupPool);
     }
     if (s.job_type === 'ai_research') {
       // OpenAI / 前沿实验室专属标志事件：一局至多一次，未触发前 ~30%/年 (companyEvents.ts)
       if (isWorking && !s.story_flags?.openai_launch_crunch_seen && gameRandom() < 0.3) return 'openai_launch_crunch';
       // 反 pool-starving：AI 实验室路径不再每年固定 ai_research_crisis。
       const aiPool = ['ai_research_crisis', 'ai_research_crisis', 'layoff_rumor'];
       if (s.year >= 2024) aiPool.push('ai_disruption_existential');
       return gamePick(aiPool);
     }
     if (s.job_type === 'quant') {
       // 反 pool-starving：量化路径不再每年固定 quant_stress。
       const quantPool = ['quant_stress', 'quant_stress', 'layoff_rumor'];
       if (s.year >= 2024) quantPool.push('ai_disruption_existential');
       return gamePick(quantPool);
     }

     // 公司专属年度「标志事件」(companyEvents.ts)：每局至多触发一次，命中前 ~30%/年。
     // 直接 early-return（而非入池），既能精确控制概率，也让它成为该公司路径的年度里程碑；
     // 一旦 story_flags.<id>_seen 置位便不再触发，回落到常规工作事件池，避免重复廉价化。
     // 每行写成字面量 return，便于 audit_all_flows.ts 的源码扫描确定性识别可达性。
      if (isWorking) {
        const sig = s.story_flags || {};
        const lvl = s.level;

        // 两难抉择「有牙的 Trade-off」(dilemmaEvents.ts)：把已有机制戏剧化成两个选项都疼的抉择，一局各一次。
        // 优先于下方的公司/人设/职级 flavor 事件——两难是核心体验，且触发门槛更窄，应先派发。
        // ① 有毒老板 vs 绿卡人质：仅当临时签证 + PERM/I-140 尚未获批时成立（跳槽会触发 stateTransitions 的绿卡重置）。
        const gcMidPerm = s.gc_stage === 'perm_processing' || s.gc_stage === 'perm_audit' || s.gc_stage === 'i140_processing' || s.gc_stage === 'i140_rfe';
        // Exclude O-1: the PERM-reset-on-hop penalty (stateTransitions) exempts O-1, so the
        // dilemma's "跳槽→绿卡进度清零" cost would be a no-op for O-1 holders.
        if (!isPermanentVisa(s.visa) && s.visa !== '无' && s.visa !== 'O1 (杰出人才)' && !s.is_phd && gcMidPerm && !sig.dilemma_toxic_boss_gc_hostage_seen && gameRandom() < 0.3) return 'dilemma_toxic_boss_gc_hostage';
        // ② 独吞功劳 vs 提携恩情：中层最纠结。
        if ((lvl === 'L4' || lvl === 'L5 (Senior)' || lvl === 'L6 (Staff)') && !sig.dilemma_credit_grab_mentor_seen && gameRandom() < 0.3) return 'dilemma_credit_grab_mentor';

        // 中后期系统性危机 (midGameCrisisEvents.ts, T2 破坏性)：一局各一次，能真正抹掉收入/职级。
        // ① 整组被 AI 砍：2024+ 大模型时代的系统性裁撤。② 中年 ageism：40+ 的性价比之殇。
        if (s.year >= 2024 && !sig.org_ai_wipeout_seen && gameRandom() < 0.15) return 'org_ai_wipeout';
        if (s.age >= 38 && !sig.midlife_ageism_squeeze_seen && gameRandom() < 0.22) return 'midlife_ageism_squeeze';

        // Impact 下行挫折 (midGameCrisisEvents.ts)：仅对已攒下值得一失的影响力 (impact>=15) 的
        // impact 职业玩家注入,一局各一次。给冲 L6/L7 的路上制造真实挫折,让高阶晋升要求"持续"
        // 而非单纯累积的影响力。字面量 return 便于 audit_all_flows 源码扫描确定性识别可达性。
        if (isImpactCareer(s) && (s.impact || 0) >= 15) {
          if (!sig.impact_project_cancelled_seen && gameRandom() < 0.14) return 'impact_project_cancelled';
          if (!sig.impact_launch_incident_seen && gameRandom() < 0.13) return 'impact_launch_incident';
          if (!sig.impact_legacy_maintenance_seen && gameRandom() < 0.12) return 'impact_legacy_maintenance';
        }

        // Company signature work event (once per game, ~30%/yr) — driven by the
        // company table. Only one company matches s.company, so this single roll
        // is equivalent to the former per-company if-ladder (same RNG draw).
        const sigEvent = getCompanyProfile(s.company)?.signatureEvent;
        if (sigEvent && !sig[`${sigEvent}_seen`] && gameRandom() < 0.3) return sigEvent;

         // 人设专属职场「标志事件」(personaEvents.ts)：同样一局至多一次、命中前 ~30%/年。
         if (s.trait_title === '卷王之王' && !sig.persona_grind_king_crunch_seen && gameRandom() < 0.3) return 'persona_grind_king_crunch';
         if (s.trait_title === '小镇做题家' && !sig.persona_impostor_syndrome_seen && gameRandom() < 0.3) return 'persona_impostor_syndrome';

         // 职级阶段「标志事件」(levelEvents.ts)：按 entry / senior / staff+ 三档各一局一次、命中前 ~30%/年。
         // 注：trader/founder/startup/ai_research/quant 走各自专属分支已提前 return，此处仅覆盖标准大厂阶梯。
         const isEntryLvl = !lvl || lvl === 'L3' || lvl === 'L4' || lvl === '初级研发';
         const isSeniorLvl = lvl === 'L5 (Senior)' || lvl === 'L5';
         const isStaffPlusLvl = lvl === 'L6 (Staff)' || lvl === 'Staff' || lvl === 'L7 (Senior Staff)' || lvl === 'L7' || lvl === 'L8 (Principal)' || lvl === 'Principal' || lvl === 'Fellow';
         if (isEntryLvl && !sig.level_entry_grunt_work_seen && gameRandom() < 0.3) return 'level_entry_grunt_work';
         if (isSeniorLvl && !sig.level_senior_plateau_seen && gameRandom() < 0.3) return 'level_senior_plateau';
         if (isStaffPlusLvl && !sig.level_staff_glue_work_seen && gameRandom() < 0.3) return 'level_staff_glue_work';

         // 中后期身份抉择 (lateGameEvents.ts, T2 非破坏性)：中年 IC vs 管理，一局一次。
         if (s.age >= 34 && !sig.late_ic_vs_management_seen && gameRandom() < 0.3) return 'late_ic_vs_management';
       }

     const isCorporate = isWorking;
     const workEvents = [
       'perf_review',
       'layoff_rumor',
       'meta_reorg_manager_left',
       'friday_p0_outage_crisis',
       'empty_promotion_promise',
       'multi_timezone_calendar_hell',
       'all_hands_corporate_bs',
       'snack_perks_downgrade'
     ];
     
     // RTO 考勤打卡大战（一局至多 1 次）
     if (isCorporate && !s.story_flags?.rto_wars_seen && gameRandom() < 0.35) {
       workEvents.push('rto_wars');
     }

     // 2023+ 大模型机房跳闸事故（AI 训练与大模型浪潮）。
     // 注：ai_research 岗位在上方已提前 return（走 openai_launch_crunch / ai_research_crisis），
     // 到不了这里，故不再判断 s.job_type === 'ai_research'（否则 TS 视为不可达比较而报错）。
     if (isCorporate && s.year >= 2023 && (s.company === 'google' || s.company === 'meta' || s.company === 'openai' || s.transferred_to_ai) && gameRandom() < 0.30) {
       workEvents.push('llm_datacenter_power_outage');
     }

     // 2024+ 自主 Agent 删库事故（大模型 Agent 时代，一局至多 1 次）
     if (isCorporate && !s.story_flags?.agent_prod_disaster_seen && s.year >= 2024 && gameRandom() < 0.30) {
       workEvents.push('agent_hallucination_prod_disaster');
     }
     
      // 通用「影响力机遇」随机事件(一生一次):给大厂/研究路径额外的 impact 来源,
      // 让积累影响力不必只靠年度硬卷。
      if (isCorporate && !s.story_flags?.open_source_breakout_seen && gameRandom() < 0.22) {
        workEvents.push('open_source_breakout');
      }
      if (isCorporate && !s.story_flags?.internal_tech_talk_viral_seen && gameRandom() < 0.22) {
        workEvents.push('internal_tech_talk_viral');
      }

      // Meta 专属 Tech Lead Manager 卷王挑战
      if (s.company === 'meta') {
        workEvents.push('meta_tlm');
      }

     // Apple 专属 Vision Pro / 空间计算应用开发
     if (s.company === 'apple') {
       workEvents.push('apple_vision_pro_demo');
     }
     
      // 转组赛道 (team_focus) 覆盖 H1 走向:养老支持组 → 极低 PIP。
      const teamFocus = s.story_flags?.team_focus;
      // 公司专属 PIP 概率区分（来自 company 表）：亚麻/Meta 高强度末位淘汰 (high)，
      // 皮衣黄 Nvidia 及 Google/Apple 概率极低 (low)，其余大厂中等 (medium 兜底)。
      const pipTier = teamFocus === 'wlb_tools' ? 'low' : (getCompanyProfile(s.company)?.pipTier ?? 'medium');
     if (pipTier === 'high') {
       workEvents.push('friday_pip', 'friday_pip', 'friday_pip', 'layoff_rumor');
     } else if (pipTier === 'low') {
       if (gameRandom() < 0.15) workEvents.push('friday_pip');
     } else {
       workEvents.push('friday_pip');
     }

     if (s.macro_economy === 'bear' && gameRandom() < 0.25) workEvents.push('stock_crash');
     if (s.difficulty_title === '困难难度') workEvents.push('friday_pip', 'layoff_rumor');
     if (s.difficulty_title === '简单难度') workEvents.push('perf_review');
     if ((s.company === 'nvidia' || (s.stocks || 0) >= 5) && s.year >= 2023 && gameRandom() < 0.35) {
       workEvents.push('nvidia_stock_surge');
     }
     if (s.year >= 2024 && isCorporate && gameRandom() < 0.25) workEvents.push('ai_disruption_existential');
     if (isCorporate && gameRandom() < 0.25) workEvents.push('influencer_vp_drama');
     if (isCorporate && (s.level === 'L5 (Senior)' || s.level === 'L6 (Staff)' || s.level === 'Quant' || s.level === 'MTS') && gameRandom() < 0.35) workEvents.push('high_level_reorg_domain_loss', 'midlife_management_pivot');
     if (s.visa === 'H1B (工签)' && !s.is_married && s.relationship_status !== 'married') workEvents.push('h1b_rfe_vs_parent_nag');

     // 宏观时代大事件（不带固定年份，按状态阶段触发）
     if (isCorporate && !s.story_flags?.macro_ai_revolution_seen && s.age >= 26 && gameRandom() < 0.22) {
       workEvents.push('macro_ai_agent_revolution');
     }
     if (isCorporate && !s.story_flags?.macro_efficiency_seen && s.macro_economy === 'bear' && gameRandom() < 0.25) {
       workEvents.push('macro_liquidity_rate_cycle');
     }
     if (isCorporate && !s.story_flags?.macro_rto_seen && s.age >= 28 && gameRandom() < 0.22) {
       workEvents.push('macro_rto_office_wars');
     }

     // L6+ 资深架构师：Tech Lead 领航带团队重点战役 / 委员会治理 (大幅提升 Impact)
     if (isCorporate && (s.level === 'L6 (Staff)' || s.level === 'Staff' || s.level === 'L7 (Senior Staff)' || s.level === 'Senior Staff' || s.level === 'L8 (Principal)' || s.level === 'MTS') && gameRandom() < 0.35) {
       workEvents.push('career_org_tech_lead_campaign');
     }
      if (isCorporate && (s.level === 'L7 (Senior Staff)' || s.level === 'Senior Staff' || s.level === 'L8 (Principal)') && (s.impact || 0) >= 30 && gameRandom() < 0.35) {
        workEvents.push('career_executive_tech_steering');
      }

      // ── 转组赛道 (team_focus) 塑造 H1 事件走向 ──
      // 前沿 AI 核心组:高业务能见度 → 更频繁卷入大模型攻坚与影响力机遇 (高强度高上限)。
      if (teamFocus === 'ai_core' && isCorporate) {
        if (s.year >= 2023) workEvents.push('llm_datacenter_power_outage');
        if (s.year >= 2024) workEvents.push('ai_disruption_existential');
        if (!s.story_flags?.open_source_breakout_seen) workEvents.push('open_source_breakout');
        if (!s.story_flags?.internal_tech_talk_viral_seen) workEvents.push('internal_tech_talk_viral');
      }
      // 养老支持组:远离 PIP / 裁员 / 线上危机,回归平稳日常 (低压低上限)。
      if (teamFocus === 'wlb_tools') {
        const chill = workEvents.filter((e) => !['friday_pip', 'layoff_rumor', 'stock_crash', 'ai_disruption_existential', 'friday_p0_outage_crisis', 'agent_hallucination_prod_disaster'].includes(e));
        return gamePick(chill.length ? chill : ['snack_perks_downgrade']);
      }

      return gamePick(workEvents);
  }

  // Stage H2 (Autumn/Winter: Life, Social, Travel & Lifestyle Events)
  const isCorporate = isWorking && s.job_type !== 'trader' && s.job_type !== 'startup_founder';
  const isTrader = s.job_type === 'trader';
  const isFounder = s.job_type === 'startup_founder';

  // 因果离婚 (T1)：长期以事业压倒家庭累积的 partner_strain 越线，感情危机由「随机」升级为「高概率必来」。
  // breakup_crisis 的挽留成功分支会把 partner_strain 清零，避免同一裂痕反复触发。
  if (hasPartner(s) && (s.story_flags?.partner_strain || 0) >= 3 && gameRandom() < 0.55) {
    return 'breakup_crisis';
  }

  // 人设专属生活「标志事件」(personaEvents.ts)：一局至多一次、命中前 ~30%/年，优先于常规生活事件。
  // 字面量 return 便于 audit_all_flows.ts 源码扫描确定性识别可达性。
  {
    const sig = s.story_flags || {};
    if (s.trait_title === '湾区海王' && !sig.persona_playboy_high_society_seen && gameRandom() < 0.3) return 'persona_playboy_high_society';
    if (s.trait_title === '原生美籍' && !sig.persona_native_hometown_edge_seen && gameRandom() < 0.3) return 'persona_native_hometown_edge';
    if (s.trait_title === '家里有矿' && !sig.persona_rich_family_offer_seen && gameRandom() < 0.3) return 'persona_rich_family_offer';
    if (s.trait_title === '天选之子' && !sig.persona_chosen_windfall_seen && gameRandom() < 0.3) return 'persona_chosen_windfall';

    // 中后期生活「标志事件」(lateGameEvents.ts, T2 非破坏性)：一局各一次、命中前 ~30%/年。
    // Post-FIRE 探索优先（FIRE 后玩家的核心体验），其次养生长寿、影响力传承。
    if (s.has_reached_initial_fire && !sig.late_post_fire_exploration_seen && gameRandom() < 0.3) return 'late_post_fire_exploration';
    if (s.age >= 35 && !sig.late_longevity_investment_seen && gameRandom() < 0.3) return 'late_longevity_investment';
    if (s.age >= 36 && !sig.late_mentor_legacy_seen && gameRandom() < 0.3) return 'late_mentor_legacy';
  }

  const lifeEvents = [
    'pickleball_networking', 'dental_emergency', 'crypto_scam', 
    'boba_inflation', 'xhs_boba', 'biohacking_party', 'tahoe_ski_blizzard', 
    'burning_man_invite', 'rock_climbing_event', 'tennis_networking', 'bay_area_hiking', 'hawaii_vacation', 'bay_area_pop_concert',
    'credit_card_churning', 'napa_wine_tasting', 'costco_gold_bar_frenzy', 'palo_alto_stanford_lecture', 'mac_mini_open_claw_server', 'multi_agent_side_hustle', 'fashion_disaster_hoodie', 'linkedin_cold_outreach_spam',
    'hair_loss_and_slouch', 'social_withdrawal_burnout', 'parents_us_visit', 'boba_opening_frenzy',
    'brentwood_cherry_picking', 'cancun_all_inclusive', 'patagonia_vest_hoodie_uniform', 'costco_weekend_pilgrimage',
    'wildfire_smoke_pge_blackout'
  ];

  // 突发 911/ICU 健康危机:一辈子一次的健康警钟(!icu_crisis_survived 门禁),而非每年可复发的
  // 付费回血引擎;熬夜内卷透支更易诱发(health<=50 双倍权重),但只此一遭。
  if (!s.story_flags?.icu_crisis_survived) {
    lifeEvents.push('us_healthcare_icu_crisis');
    if (s.health <= 50) lifeEvents.push('us_healthcare_icu_crisis');
  }

  // 双职工家庭专属生活事件池
  if (s.is_married || s.relationship_status === 'married') {
    if ((s.story_flags?.partner_strain || 0) >= 3) {
      return 'marriage_divorce_crisis';
    }
    lifeEvents.push('dual_income_tech_layoff_storm', 'dual_income_wlb_burnout');
    // dual_income_startup_gamble is oncePerLife — gate injection so it can't re-fire.
    if (!s.story_flags?.dual_income_startup_gamble_seen) lifeEvents.push('dual_income_startup_gamble');
    if ((s.story_flags?.partner_strain || 0) >= 2) {
      lifeEvents.push('marriage_divorce_crisis');
    }
  }

  if (s.charm && s.charm >= 15 && s.job_type !== 'unemployed') {
    lifeEvents.push('rednote_influencer_side_hustle');
  }

  if ((s.charm || 0) >= 22 && !s.is_married && s.relationship_status !== 'married' && s.relationship_status !== 'dating') {
    lifeEvents.push('bay_area_heart_signal');
    if ((s.charm || 0) >= 25) {
      lifeEvents.push('bay_area_heart_signal');
    }
  }

  if (s.car && s.car !== 'none') {
    lifeEvents.push('san_francisco_car_window_smash');
  }

  if (s.car === 'model_y' || s.car === 'cybertruck') {
      lifeEvents.push('tesla_fsd_unsupervised_scare');
  }

  if (isCorporate) {
      lifeEvents.push('overemployed', 'blind_team_tea', 'zoom_camera_off_leetcode', 'team_offsite', 'vibe_coding_craze', 'ai_wrapper_startup');
      // ai_agent_startup is oncePerLife — gate injection so the +$15w seed can't re-fire.
      if (!s.story_flags?.ai_agent_startup_seen) lifeEvents.push('ai_agent_startup');
      if (s.level === 'L5 (Senior)' || s.level === 'L6 (Staff)' || s.level === 'Quant' || s.level === 'MTS') {
          lifeEvents.push('ex_1point3acres_expose');
      }
  }

  // Founder 专属动态奇遇池 (H2 阶段注入,与 trader 同一模式)。年终结算已把 founder 直接送入
  // founder_annual_strategy 策略枢纽 (P0),绕过了旧的 H1 ~40% 危机注入,导致这些事件几乎不可达;
  // 改为在 H2 生活池注入 —— founder 既保留了当年的策略主行动,又能碰到危机与机遇 (co-founder
  // 撕逼 / VC 跳票 / 断粮 / 黑客松 / YC 孵化 / 巨头超大单),不产生「用危机换掉策略回合」的平衡代价。
  // 仅 ~40% 的 founder 年份注入专属奇遇池,其余年份沿用通用生活事件。既保留创业线的
  // 危机/机遇变化,又控制注入频率——避免与 #61(限时机遇生命周期收紧)/#64(副业枢纽重构)
  // 叠加后把 founder 的 FIRE 胜率拖到门禁下限附近(蒙特卡洛 bot 对新事件随机选择会放大下行)。
  if (isFounder && gameRandom() < 0.4) {
      lifeEvents.push(
        'founder_co_founder_drama',
        'founder_vc_term_sheet_ghost',
        'founder_runway_cash_crunch',
        'founder_hacker_house_hackathon',
        'founder_yc_batch',
        'founder_enterprise_whale'
      );
  }

  if (isTrader) {
      lifeEvents.push(
        'trader_fed_rate_cpi_night',
        'trader_wallstreetbets_short_squeeze',
        'trader_bloomberg_terminal_caffeine'
      );
  }

  if (!s.is_married) {
      lifeEvents.push('ex_wedding_invite');
  }
  
  if (s.relationship_status === 'dating' || s.is_married) {
      lifeEvents.push('ikea_furniture_fight');
  }
  
  const companyTenure = s.job_start_age !== undefined ? (s.age - s.job_start_age) : 0;
  if (isBigTech && companyTenure >= 3 && !s.story_flags?.rsu_cliff_done) {
      lifeEvents.push('rsu_vesting_crash');
  }

  if (isPermanentVisa(s.visa) && !s.story_flags?.japan_trip_seen) {
    lifeEvents.push('japan_trip');
  }

  if (s.visa === 'H1B (工签)') {
    lifeEvents.push('h1b_visa_stamping_crisis');
  }

  if (s.car === 'porsche' || s.car === 'cybertruck') {
    lifeEvents.push('luxury_car_meet', 'luxury_car_vandalism_towing');
  }

  const isHomeowner = isOwnedHousing(s.housing_name);
  if (isHomeowner && !s.story_flags?.housewarming_done) {
    lifeEvents.push('house_warming_party');
  }

  if (s.cash >= 100) {
    lifeEvents.push('startup_angel_investing');
  }

  if ((s.is_married || s.relationship_status === 'married') && !s.has_child && !s.story_flags?.bay_area_dink_vs_kids_seen) {
    lifeEvents.push('bay_area_dink_vs_kids');
  }

  // 补充房产税会砸向任何房主,与现金多寡无关。原 cash>=30 门控使得「现金吃紧申请延期」
  // (需 cash<1) 分支永不可选(死码);去掉现金门控后,现金拮据的房主才会真正面临这个两难。
  if (isHomeowner) {
    lifeEvents.push('property_supplemental_tax_hike');
  }

  if (s.cash >= 80 || s.tc >= 45) {
    lifeEvents.push('irs_tax_audit_crisis');
  }

  if (isHomeowner && s.age >= 32) {
    lifeEvents.push('property_hoa_special_assessment');
  }

  if (isWorking && s.age >= 35 && s.health <= 60) {
    lifeEvents.push('health_burnout_warning');
  }

  if (!isPermanentVisa(s.visa) && s.visa !== '无') {
      lifeEvents.push('visa_check');
  }

  if (s.is_married || s.relationship_status === 'married' || s.relationship_status === 'dating') {
      lifeEvents.push('breakup_crisis');
  } else {
      lifeEvents.push('boardgame_dating', 'dating_market');
  }
  
  return gamePick(lifeEvents) || 'sv_year_end_settlement';
};

// H1 to H2 Event Router: called after resolving an H1 career/work event to transition to an H2 life/social event
// "此 H1 事件结束,推进年度进程"。被裁则进入失业危机;否则只发出「推进」信号 (→ 年终结算),
// 由 resolveNextEventId 的季度状态机在推进途中依次插入 H1 职场事件 + H2 生活事件。历史上这里直接
// midYearEventRouter({...,'h2'}) 计算 H2,但 season_stage 未被持久化,导致状态机无法分辨「H2 前/后」;
// 改为返回推进信号、由状态机统一编排,彻底修掉「注入 H1 却吞掉 H2 / 覆盖 job_hop_market 等子枢纽」。
export const h1ToH2Router = (s: GameState): string => {
  if (s.laid_off) {
    return (!isPermanentVisa(s.visa) && s.visa !== '无') ? 'layoff_hit' : 'job_hunt';
  }
  return 'sv_year_end_settlement';
};

// 年中职场动作(跳槽入职 / H1B 抽签 / 签证自救)完成后的统一落点。
// 若本年度决策已经做过 (season_stage === 'h1',由 sv_daily_life 的年度选项置位、年终结算清空),
// 则经 h1ToH2Router 向前推进、消耗当年,严禁回落 sv_daily_life —— 否则玩家可在同一年内再做一次
// 年度动作(典型:F1/OPT 应届生跳槽入职→选房→big_tech_work 后又回日常面板二次跳槽,#2 哨兵实测)。
// 仅在开局「首次入职」(season_stage 尚未置位) 时才回 sv_daily_life,开启人生第一年的日常规划。
export const afterCareerAction = (s: GameState): string =>
  s.season_stage === 'h1' ? h1ToH2Router(s) : 'sv_daily_life';

// SINGLE SOURCE OF TRUTH for post-choice routing. Both the live app (App.tsx) and the
// balance/fuzz harnesses MUST route through this, so the simulated path == the shipped path.
// Historically the season/mid-year intercept lived ONLY in App.tsx's handleChoice, so the
// monte-carlo & fuzz harnesses (which just followed choice.nextEventId) exercised a DIFFERENT
// graph than players actually played — they never honored the FIRE/game-over targetEventId
// override nor the H1→H2→settlement season advance, which is why their balance numbers were
// measured on a game nobody ships. Given the post-effect state (newState = transition.nextState)
// and the transition's targetEventId, resolve the next event id + any season-stage mutation.
// Behavior is byte-for-byte what App.tsx did inline (UI side effects like sound stay in App.tsx).
export function resolveNextEventId(
  choice: Pick<Choice, 'nextEventId'>,
  newState: GameState,
  targetEventId?: string,
  sourceEventId?: string,
): { finalState: GameState; nextEventId: string | undefined } {
  // 1. Centralized termination / FIRE routing wins (death/bankruptcy/win/retired → 'end',
  //    crossing the FIRE threshold mid-turn → 'fire_milestone_choice') always override the
  //    event's own nextEventId, exactly as App.tsx does.
  if (targetEventId) {
    return { finalState: newState, nextEventId: targetEventId };
  }
  let nextId: string | undefined =
    typeof choice.nextEventId === 'function' ? choice.nextEventId(newState) : choice.nextEventId;

  // 2. 年度季度事件机 (single source of truth for the H1→H2→settlement rhythm).
  //    一个在职年度应为:年度动作(sv_daily_life 的重心选择,可能带子枢纽 job_hop_market /
  //    stock_market_annual_gamble / side_hustle_hub) → 一个 H1 职场大事件(裁员/PIP/绩效/中年危机/
  //    公司标志/两难/导师剧情) → 一个 H2 生活事件 → 年终结算。
  //    只在收到「推进信号」时动作(nextId=sv_year_end_settlement,或带 mid_year 的 sv_daily_life——
  //    由 h1ToH2Router / afterCareerAction / 年度动作发出);因此【绝不覆盖】job_hop_market / stock
  //    赌盘 / side hustle / 晋升庆祝 / 裁员危机链等子事件(它们不是推进信号,原样透传,待其自身走到
  //    推进信号再入机)。相位用【year_seg】计数(0→1→2),而非 season_stage:后者被大量职场事件重置
  //    回 'h1',复用会导致同年死循环(fuzz SEED=990)。每年至多注入 2 个季度事件即强制进结算——
  //    year_seg 单调递增,保证【必定终结、无同回合死循环】,即便再就业事件把 season_stage 重置。
  //    再入 sv_daily_life(mid_year)也被拦截进结算,杜绝「同年再做一次年度动作」。
  const isAdvanceSignal =
    nextId === 'sv_year_end_settlement' || (nextId === 'sv_daily_life' && !!newState.mid_year);
  if (newState.mid_year && isAdvanceSignal) {
    // 已完成的跳槽 (job_hop_market 签约/Match/婉拒) 就是当年的重大职业事件:直接收束到年终结算,
    // 不再注入后续季度职场事件。否则机器会在同年继续注入 H1/H2 职场事件 (startup_crisis / overemployed),
    // 而它们又经 job_hunt 绕回 job_hop_market,造成「同年反复跳槽」的同回合死循环 (fuzz SEED=5532)。
    if (sourceEventId === 'job_hop_market') {
      return { finalState: { ...newState, year_seg: undefined }, nextEventId: 'sv_year_end_settlement' };
    }
    const seg = newState.year_seg || 0;
    const working = !!newState.job_type && newState.job_type !== 'unemployed' && !newState.laid_off;
    const regularEmployee = working && newState.job_type !== 'startup_founder' && newState.job_type !== 'trader';

    // 阶段一:H1 职场大事件 (仅常规在职雇员;founder/trader 有各自枢纽,失业者跳过 → 直接进阶段二)。
    if (seg < 1 && regularEmployee) {
      const h1 = midYearEventRouter({ ...newState, season_stage: 'h1' });
      if (h1 && h1 !== 'sv_daily_life' && h1 !== 'sv_year_end_settlement') {
        return { finalState: { ...newState, year_seg: 1 }, nextEventId: h1 };
      }
    }
    // 阶段二:H2 生活事件 (人人有份)。
    if (seg < 2) {
      const h2 = midYearEventRouter({ ...newState, season_stage: 'h2' });
      if (h2 && h2 !== 'sv_daily_life' && h2 !== 'sv_year_end_settlement') {
        return { finalState: { ...newState, year_seg: 2 }, nextEventId: h2 };
      }
    }
    // 阶段三:季度事件已放完 → 年终结算 (year_seg 由结算清零)。
    return { finalState: { ...newState, year_seg: undefined }, nextEventId: 'sv_year_end_settlement' };
  }

  return { finalState: newState, nextEventId: nextId };
}

// Dynamic Annual Opportunities Pool & Rotation System
export const ANNUAL_OPPORTUNITY_KEYS = [
  'opp_cursor_hunt',
  'opp_treehacks',
  'opp_pilot_license',
  'opp_burning_man',
  'opp_sand_hill_salon',
  'opp_gtc_nvidia',
  'opp_zero_day_bounty',
  'opp_viral_ai_video',
  'opp_foreclosure_deal',
  'opp_yosemite_heal',
  'opp_angel_invest',
  'opp_laguna_seca',
] as const;

// Checks if a one-in-a-lifetime opportunity has been permanently completed
export function isOpportunityCompleted(s: GameState, oppKey: string): boolean {
  if (oppKey === 'opp_pilot_license') return Boolean(s.story_flags?.has_pilot_license);
  if (oppKey === 'opp_cursor_hunt') return Boolean(s.story_flags?.cursor_hunt_joined);
  if (oppKey === 'opp_foreclosure_deal') return Boolean(s.story_flags?.bought_foreclosure_house || s.investment_properties?.includes('东湾法拍翻新独立屋'));
  return false;
}

// Checks if a recurring opportunity is currently in cooldown (within 2 years)
export function isOpportunityInCooldown(s: GameState, oppKey: string): boolean {
  const flags = s.story_flags || {};
  const curYear = s.year || 2026;
  if (oppKey === 'opp_treehacks' && typeof flags.last_treehacks_year === 'number') {
    return curYear - flags.last_treehacks_year < 2;
  }
  if (oppKey === 'opp_burning_man' && typeof flags.last_burning_man_year === 'number') {
    return curYear - flags.last_burning_man_year < 2;
  }
  if (oppKey === 'opp_sand_hill_salon' && typeof flags.last_sand_hill_year === 'number') {
    return curYear - flags.last_sand_hill_year < 2;
  }
  if (oppKey === 'opp_gtc_nvidia' && typeof flags.last_gtc_year === 'number') {
    return curYear - flags.last_gtc_year < 2;
  }
  if (oppKey === 'opp_yosemite_heal' && typeof flags.last_yosemite_year === 'number') {
    return curYear - flags.last_yosemite_year < 2;
  }
  if (oppKey === 'opp_angel_invest' && typeof flags.last_angel_invest_year === 'number') {
    return curYear - flags.last_angel_invest_year < 2;
  }
  if (oppKey === 'opp_laguna_seca' && typeof flags.last_laguna_year === 'number') {
    return curYear - flags.last_laguna_year < 2;
  }
  return false;
}

export function isOpportunityActiveThisYear(s: GameState, oppKey: string): boolean {
  // If permanently completed or in active cooldown, never activate
  if (isOpportunityCompleted(s, oppKey) || isOpportunityInCooldown(s, oppKey)) return false;

  const total = ANNUAL_OPPORTUNITY_KEYS.length;
  const baseSeed = Math.abs(((s.year || 2026) * 5 + (s.age || 25) * 2));

  // Find the single active opportunity for this year (smart-skips completed/in-cooldown)
  let activeIdx = baseSeed % total;
  let attempts = 0;
  while ((isOpportunityCompleted(s, ANNUAL_OPPORTUNITY_KEYS[activeIdx]) || isOpportunityInCooldown(s, ANNUAL_OPPORTUNITY_KEYS[activeIdx])) && attempts < total) {
    activeIdx = (activeIdx + 1) % total;
    attempts++;
  }

  return oppKey === ANNUAL_OPPORTUNITY_KEYS[activeIdx];
}

// Checks if the player is still living in a temporary student dorm, lab, overseas home, or ICC bunk
export const isTemporaryOrStudentHousing = (s: GameState): boolean => {
  if (!s.has_housing || !s.housing_name) return true;
  const tempDorms = [
    '四大 校内宿舍',
    '大U 校内宿舍',
    '美大U 校内宿舍',
    '美硕 校外公寓',
    '美国 博士实验室',
    '国内大学宿舍',
    '国内老家',
    '国内 厂区单间',
    '加州湾区老宅',
    'ICC 挂靠合宿单间',
    'ICC 外包合宿单间'
  ];
  return tempDorms.includes(s.housing_name);
};
