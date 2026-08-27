import type { GameEvent, GameState } from '../../types';
import { getLevelScaledTC, midYearEventRouter, h1ToH2Router, afterCareerAction, isOpportunityActiveThisYear, isTemporaryOrStudentHousing , gameRandom, o1PassProb, addImpact, hopTargetLevel, hopIsPromotion, resolveHopVisaTransition } from './helpers';
import { getTCBreakdown, isCorporateEmployee } from '../../utils/gameStateSelectors';
import { isPermanentVisa, liquidateStocksToCover } from '../../constants/gameConstants';
import { isTopTierCSSchool } from '../schoolProfiles';
import { meetsOrganicPromo, normalizeLevel, promoBlockerHint } from '../levelProfiles';

export const careerEvents: Record<string, GameEvent> = {
  'job_hunt': {
    id: 'job_hunt',
    title: '【求职征程】湾区求职季与职业方向抉择',
    description: '身处全球科技中心的湾区，你面临着下一阶段的人生与职业方向抉择。无论是积极重返大厂、动用人脉捷径，还是彻底换个赛道休养调养，命运全由你掌握：',
    choices: [
      {
        text: '【大厂社招/校招 Onsite 终面】闭关备战沉淀算法，海投各大科技巨头开启两轮终面见招拆招',
        condition: (_s) => true,
        effect: (s) => {
          const isKingOfRoll = s.trait_title === '卷王之王';
          const drain = isKingOfRoll ? 4 : 8;
          const leetBonus = isKingOfRoll ? 14 : 10;
          return {
            health: Math.max(0, s.health - drain),
            leetcode: Math.min(100, s.leetcode + leetBonus),
            story_flags: { ...(s.story_flags || {}), iv_score: 0 },
            message: `【闭关备战·奔赴终面】你闭关狂刷高频题与系统设计 (算法 +${leetBonus})，简历顺利通过各巨头初筛，整装待发直奔两轮 Onsite 终面现场！`,
          };
        },
        nextEventId: 'interview_onsite_gauntlet_r1',
      },
      {
        text: '【内推绿色通道 (Referral & 校友网络)】凭借资深人脉或名校/PhD 背书免初筛直通录用',
        reqBadge: '需熟人人脉 或 名校/PhD 背景',
        condition: (s) => ((s.network || 0) >= 30 && s.leetcode >= 35) || (isTopTierCSSchool(s.school) && s.leetcode >= 45) || s.is_phd,
        effect: (s) => {
          const lvl = hopTargetLevel(s); // retain historical rank (max_level) — never demote a re-hired senior to L3/L4
          const isElite = (isTopTierCSSchool(s.school) && s.leetcode >= 45) || s.is_phd;

          if (isElite) {
            // 名校 / 博士校友黑手党路线：直通顶级大厂核心架构团队，享受顶格 Base TC + $8w 签字费
            const mafiaTargets = [
              { company: 'google', name: 'Google (Infra 核心架构组)', tcBoost: 28, healthDrain: 8, desc: '名校校友网络与硬核算法表现直接将你推进山景城 Googleplex 基础设施核心组！享受顶尖 WLB 与美味食堂，附赠 $8w 丰厚签字费！' },
              { company: 'meta', name: 'Meta (AI 算法与分布式系统)', tcBoost: 35, healthDrain: 16, desc: '校友总监与硬核代码功底将你拉入 Menlo Park Meta 核心 AI 组，拿到顶格包裹与 $8w 签字费，但面临高压节奏！' },
              { company: 'apple', name: 'Apple (Apple Park 架构团队)', tcBoost: 30, healthDrain: 6, desc: '校友学长与顶尖工程底子内推你直通 Apple Park 架构团队，拥有极高稳定性与顶尖硬件生态，附赠 $8w 签字费！' },
              { company: 'robinhood', name: 'Robinhood (核心交易撮合引擎)', tcBoost: 32, healthDrain: 12, desc: '凭借名校金字招牌与过硬算法，校友学姐直接将你带入 Robinhood 核心交易团队，赶上牛市红利期，附赠 $8w 签字费！' }
            ];
            const chosen = mafiaTargets[Math.floor(gameRandom() * mafiaTargets.length)];
            return {
              health: Math.max(0, s.health - chosen.healthDrain),
              tc: getLevelScaledTC(chosen.tcBoost, lvl),
              laid_off: false,
              cash: s.cash + 8,
              company: chosen.company,
              job_type: 'big_tech',
              level: lvl,
              message: `【校友黑手党直通】${chosen.desc}`
            };
          } else {
            // 资深熟人内推路线：熟人总监力挺免除简历初筛，100% 录用至大厂成熟业务团队，附赠 $6w 签字费 + 人脉 +5
            const referralPool = [
              { company: 'google', name: 'Google', baseTc: 20, healthDelta: 6, desc: '凭借强大人脉网络 (Referral) 与及格算法储备，熟人总监力挺免除初筛，顺利上岸 Google 享受神仙 WLB，附赠 $6w 签字费！' },
              { company: 'meta', name: 'Meta', baseTc: 22, healthDelta: -10, desc: '在熟人 Tech Lead 的强力内推下，你直接拿下 Menlo Park Meta 核心团队高额总包与 $6w 签字费！' },
              { company: 'apple', name: 'Apple', baseTc: 20, healthDelta: 4, desc: '库比蒂诺 Apple 资深总监开绿灯加急终面，你顺利内推至 Apple Park 核心工程团队，附赠 $6w 签字费！' },
              { company: 'microsoft', name: 'Microsoft', baseTc: 19, healthDelta: 8, desc: '微软云与 AI 部门熟人校友直接内推，你顺利通过终面入组，作息极度规律，附赠 $6w 签字费！' }
            ];
            const chosen = referralPool[Math.floor(gameRandom() * referralPool.length)];
            return {
              tc: getLevelScaledTC(chosen.baseTc, lvl),
              laid_off: false,
              cash: s.cash + 6,
              company: chosen.company,
              job_type: 'big_tech',
              level: lvl,
              health: Math.min(100, Math.max(0, s.health + chosen.healthDelta)),
              network: Math.min(100, (s.network || 0) + 5),
              message: `【熟人内推直通】${chosen.desc}`
            };
          }
        },
        nextEventId: (s: GameState) => {
          return isTemporaryOrStudentHousing(s) ? 'choose_housing' : h1ToH2Router(s);
        },
      },
      {
        text: '【急召外包 / ICC / 中型公司紧急避险】保住合法工签身份与基础现金流',
        condition: (_s) => true,
        effect: (s) => {
          const lvl = hopTargetLevel(s); // retain historical rank (max_level) — never demote a re-hired senior to L3/L4
          const stateCompanies = [
            { company: 'cisco', name: 'Cisco 思科网络研发部', baseTc: 20 },
            { company: 'oracle', name: 'Oracle 甲骨文云架构组', baseTc: 21 },
            { company: 'icc', name: '硅谷大型 Tech IT 咨询外包', baseTc: 14 }
          ];
          const comp = stateCompanies[Math.floor(gameRandom() * stateCompanies.length)];
          const newTC = getLevelScaledTC(comp.baseTc, lvl);
          return { 
            tc: newTC, 
            laid_off: false, 
            company: comp.company, 
            health: Math.min(100, s.health + 8), 
            job_type: comp.company === 'icc' ? 'startup' : 'big_tech', 
            level: lvl, 
            message: `【紧急避险成功】成功入职 ${comp.name} (定级 ${lvl} · 年薪 $${newTC}w)！工作节奏适中且合法工签身份无虞，每月有稳定现金流进账！` 
          };
        },
        nextEventId: (s: GameState) => {
          return isTemporaryOrStudentHousing(s) ? 'choose_housing' : h1ToH2Router(s);
        },
      },
      {
        text: '【休养放空 / Gap Year 调整】暂不找工作！利用积蓄休养身心，享受慢生活 (需无身份倒计时压力或有存款)',
        condition: (s) => s.visa === '绿卡' || s.visa === '公民' || s.gc_stage === 'i485_pending' || s.cash >= 8,
        effect: (s) => ({
          laid_off: false,
          job_type: 'unemployed',
          company: undefined,
          tc: 0,
          health: Math.min(100, s.health + 25),
          // rent is an ANNUAL figure; a gap year costs one year of rent + living,
          // not rent*12 (that 12x overcharge instantly bankrupted most players).
          cash: Math.max(0, s.cash - ((s.rent ? s.rent : 4) + 3)),
          message: '【开启慢生活 Gap Year】你决定暂停无休止的内卷与面试焦虑，给自己放个大假！每天睡到自然醒、徒步、做饭、打游戏，身心得到了彻底的治愈与恢复！'
        }),
        nextEventId: (s: GameState) => {
          return isTemporaryOrStudentHousing(s) ? 'choose_housing' : h1ToH2Router(s);
        },
      },
      {
        text: '【转型全职 Day Trader 操盘】凭借 $50w 本金与自由身全职炒股操盘',
        reqBadge: '需美籍/绿卡 + 现金 >= $50w',
        condition: (s) => (s.visa === '绿卡' || s.visa === '公民') && s.cash >= 50,
        effect: (_s) => ({
          job_type: 'trader',
          company: '全职 Day Trader',
          level: '全职 Trader',
          tc: 0,
          laid_off: false,
          message: '你决定不再看任何大厂 HR 与老板的脸色！凭借 $50w 初始本金与自由身，开启全职操盘人生！'
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '【转型全职 Founder 科技创业】前往 Sand Hill Road 寻找 VC 融资开搞 Startup',
        reqBadge: '需美籍/绿卡/O-1 或现金 >= $45w',
        condition: (s) => ((s.visa === '绿卡' || s.visa === '公民' || s.visa === 'O1 (杰出人才)') || s.cash >= 45) && s.job_type !== 'startup_founder',
        effect: (s) => {
          const needsO1 = s.visa !== '绿卡' && s.visa !== '公民' && s.visa !== 'O1 (杰出人才)';
          return {
            job_type: 'startup_founder',
            company: 'AI/科技 Startup',
            level: 'CEO & Founder',
            tc: 6,
            founder_stage: 'pre_seed',
            company_valuation: 180,
            laid_off: false,
            cash: needsO1 ? s.cash - 5 : s.cash,
            visa: needsO1 ? 'O1 (杰出人才)' : s.visa,
            message: needsO1
              ? '你决定自己当老板！花 $5w 律师费办妥了 O1-A 创业杰出人才工签，在 San Mateo 租下一间 Garage，以 $180w Pre-Seed 估值开启了全职 Founder 极客创业！'
              : '你决定自己当老板！凭自由身份在 San Mateo 租下一间 Garage，以 $180w Pre-Seed 估值开启了全职 Founder 极客创业！'
          };
        },
        nextEventId: h1ToH2Router,
      }
    ]
  },

  'job_hunt_fail': {
    id: 'job_hunt_fail',
    title: '【求职受挫】失业断粮与绝境突围',
    description: '由于迟迟找不到理想工作，你面临着现实的压力...',
    choices: [
      {
        text: '【身份保障无视遣返】在湾区全职闭关刷题再战 (无身份倒计时压力)',
        condition: (s) => s.visa === '公民' || s.visa === '绿卡' || s.gc_stage === 'i485_pending',
        effect: (s) => ({
          cash: Math.max(0, s.cash - 1),
          leetcode: Math.min(100, s.leetcode + 25),
          health: Math.max(0, s.health - 5),
          message: '手握绿卡/EAD Combo 身份毫无遣返压力！你在家闭关狂刷算法题，准备下一轮招聘季再战！'
        }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【墨西哥闯关重签】去 Tijuana 闯关重签签证 (高风险 Visa Run · 消耗 $1w)',
        condition: (s) => s.cash >= 1 && (s.visa === 'OPT (实习)' || s.visa === 'H1B (工签)'),
        effect: (s) => {
          const win = gameRandom() > 0.15; // 85% success
          return win
            ? { cash: s.cash - 1, health: s.health - 15, leetcode: s.leetcode + 5, message: '心惊胆战地越过美墨边境，你奇迹般地拿到了新的签证 Stamp！争取到了宝贵的留美时间！' }
            : { status: 'game_over', message: '在边境小黑屋被海关查出挂靠历史，直接吊销签证并被 5 年禁令限制入境！' };
        },
        nextEventId: (s) => s.status === 'game_over' ? 'end' : 'sv_year_end_settlement',
      },
      {
        text: '【回大理数字游民】不卷了！回大理/清迈做数字游民躺平',
        condition: (s) => s.cash >= 5,
        // Giving up to go be a digital nomad is a CONTENT ending, not a FIRE 'win' — a
        // broke quitter must not render the fire_basic triumph card (endings.ts keys the
        // FIRE triumph on status==='win'). 'retired' routes to a content ending
        // (佛系隐者/中产退休) via determineEnding; if they happen to be wealthy (assets>=500)
        // the classifier still credits the appropriate FIRE tier.
        effect: (s) => ({ 
          status: 'retired', 
          // Leaving for 大理/清迈 = giving up the US life → for a temp-visa holder this is the
          // 海归/homecoming content ending (previously an unreachable ending). Permanent
          // residents keep their status (middleware protects 绿卡/公民) → settled/中产退休.
          visa: isPermanentVisa(s.visa) ? s.visa : '无',
          imageUrl: 'images/dali_relax.jpg', 
          message: '你带着几万美元的积蓄去了大理。每天喝咖啡、看苍山洱海。虽然彻底脱离了硅谷的内卷，但你找到内心的平静！(大理躺平结局)' 
        }),
        nextEventId: 'end',
      },
      {
        text: '【放弃求职告别硅谷】放弃求职，打包行李离开硅谷',
        effect: (s) => {
          // Temp-visa branches are forced departures (visa loss) → must classify as
          // 'deported' in endings.ts, which matches on keywords like 离境/登机. Keep such a
          // keyword in the copy or these fall into the generic/bankruptcy ending.
          const reason = (s.visa === '公民' || s.visa === '绿卡') 
            ? '对硅谷内卷与就业市场彻底失望，你选择带上积蓄离开了加州湾区。' 
            : ((s.visa === 'F1 (学生)' || s.visa === '无') 
                ? 'OPT 到期未能上岸，身份到期你只能被迫离境，遗憾登机踏上回国的航班。' 
                : 'H1B 60 天失业宽限期满仍未找到新工作，身份失效被迫离境，遗憾登机回国。');
          return { status: 'game_over', message: reason };
        },
        nextEventId: 'end',
      },
      {
        text: '【读水硕维持身份】读 Day 1 CPT 水硕维持合法身份 (消耗 $5w)',
        condition: (s) => s.visa !== '绿卡' && s.visa !== '公民' && s.visa !== 'O1 (杰出人才)' && s.cash >= 5,
        effect: (s) => ({ visa: 'Day 1 CPT', cash: s.cash - 5, age: s.age + 1, leetcode: Math.min(100, s.leetcode + 25), message: '你在读 Day 1 CPT 水硕期间狂刷 250 道 Hard 题，算法功力大增！准备重回战场！' }),
        nextEventId: 'sv_year_end_settlement',
      }
    ]
  },

  'job_hop_market': {
    id: 'job_hop_market',
    title: '【跳槽风暴】湾区跳槽季与多重 Offer 抉择',
    description: '经过一整年的多轮 Onsite 厮杀与算法洗礼，各大厂 HR 陆续向你发来了正式录用意向！\n\n【注意】跳槽将重置未获批 I-140 的 PERM 排期；新公司入职第一年往往伴随高压 Ramp-up 考验。请根据你的包裹意向与职业规划，慎重签署正式合同：',
    choices: [
      {
        text: '【签约入职 Google】降压养老，享受顶尖 WLB、美味食堂与稳健股票',
        condition: (s) => (s.hop_offers ? s.hop_offers.includes('google') : s.company !== 'google'),
        effect: (s) => {
          const nextLvl = hopTargetLevel(s); // 阶梯 +1，但升到 L6+ 需足够 impact，否则平跳
          const baseBand = nextLvl === 'L8 (Principal)' ? 120 : nextLvl === 'L7 (Senior Staff)' ? 82 : nextLvl === 'L6 (Staff)' ? 58 : nextLvl === 'L5 (Senior)' ? 42 : nextLvl === 'L4' ? 30 : 22;
          const econMultiplier = s.macro_economy === 'bull' ? 1.15 : s.macro_economy === 'bear' ? 0.90 : 1.0;
          const newTC = Math.max(s.tc + 4, Math.floor(baseBand * econMultiplier));
          const hopVisa = resolveHopVisaTransition(s);

          return {
            company: 'google',
            job_type: 'big_tech',
            visa: hopVisa.visa,
            cash: Math.max(0, s.cash + hopVisa.cashDelta),
            level: nextLvl, last_promo_age: hopIsPromotion(s) ? s.age : s.last_promo_age, // stamp/celebrate ONLY on a real level-up — a lateral hire (laid-off senior, impact-short hop) must not fire a promo celebration
            tc: newTC,
            health: Math.min(100, s.health + 12),
            laid_off: false,
            is_new_job: true,
            message: `【成功入职 Google】顺利入职山景城 Googleplex！享受顶级养老福利与免费美食，职级定级为 ${nextLvl}，锁定年薪总包 ${newTC}w！${hopVisa.note}`
          };
        },
        nextEventId: (s) => (isTemporaryOrStudentHousing(s) ? 'choose_housing' : (s.last_promo_age === s.age ? (s.level === 'L8 (Principal)' ? 'l8_principal_celebration' : s.level === 'L7 (Senior Staff)' ? 'l7_senior_staff_celebration' : s.level === 'L6 (Staff)' ? 'l6_staff_celebration' : h1ToH2Router(s)) : h1ToH2Router(s))),
      },
      {
        text: '【签约入职 Meta】加入卷王之王，挑战高压核心架构冲刺顶格 Package',
        condition: (s) => (s.hop_offers ? s.hop_offers.includes('meta') : s.company !== 'meta'),
        effect: (s) => {
          const nextLvl = hopTargetLevel(s); // 阶梯 +1，但升到 L6+ 需足够 impact，否则平跳
          const baseBand = nextLvl === 'L8 (Principal)' ? 135 : nextLvl === 'L7 (Senior Staff)' ? 92 : nextLvl === 'L6 (Staff)' ? 65 : nextLvl === 'L5 (Senior)' ? 46 : nextLvl === 'L4' ? 34 : 25;
          const econMultiplier = s.macro_economy === 'bull' ? 1.20 : s.macro_economy === 'bear' ? 0.90 : 1.0;
          const newTC = Math.max(s.tc + 6, Math.floor(baseBand * econMultiplier));
          const hopVisa = resolveHopVisaTransition(s);

          return {
            company: 'meta',
            job_type: 'big_tech',
            visa: hopVisa.visa,
            level: nextLvl, last_promo_age: hopIsPromotion(s) ? s.age : s.last_promo_age, // stamp/celebrate ONLY on a real level-up — a lateral hire (laid-off senior, impact-short hop) must not fire a promo celebration
            tc: newTC,
            cash: Math.max(0, s.cash + (s.macro_economy === 'bull' ? 8 : 4) + hopVisa.cashDelta),
            health: Math.max(0, s.health - 15),
            laid_off: false,
            is_new_job: true,
            message: `【卷入 Meta 核心架构】手握硬核代码入职 Menlo Park！职级跃升至 ${nextLvl}，总包大幅飙升至 ${newTC}w！但新人高压 Oncall 让你身心紧绷 (健康 -15)。${hopVisa.note}`
          };
        },
        nextEventId: (s) => (isTemporaryOrStudentHousing(s) ? 'choose_housing' : (s.last_promo_age === s.age ? (s.level === 'L8 (Principal)' ? 'l8_principal_celebration' : s.level === 'L7 (Senior Staff)' ? 'l7_senior_staff_celebration' : s.level === 'L6 (Staff)' ? 'l6_staff_celebration' : h1ToH2Router(s)) : h1ToH2Router(s))),
      },
      {
        text: '【签约入职 Nvidia】加入显卡巨头，吃满 AI 算力与芯片狂飙红利',
        condition: (s) => (s.hop_offers ? s.hop_offers.includes('nvidia') : s.company !== 'nvidia'),
        effect: (s) => {
          const isBull = s.macro_economy === 'bull' || s.year >= 2023;
          const nextLvl = hopTargetLevel(s); // 阶梯 +1，但升到 L6+ 需足够 impact，否则平跳
          const baseBand = nextLvl === 'L8 (Principal)' ? 130 : nextLvl === 'L7 (Senior Staff)' ? 90 : nextLvl === 'L6 (Staff)' ? 64 : nextLvl === 'L5 (Senior)' ? 45 : nextLvl === 'L4' ? 33 : 24;
          const econMultiplier = isBull ? 1.25 : (s.macro_economy === 'bear' ? 0.90 : 1.0);
          const newTC = Math.max(s.tc + 5, Math.floor(baseBand * econMultiplier));
          const hopVisa = resolveHopVisaTransition(s);

          return {
            company: 'nvidia',
            job_type: 'big_tech',
            visa: hopVisa.visa,
            level: nextLvl, last_promo_age: hopIsPromotion(s) ? s.age : s.last_promo_age, // stamp/celebrate ONLY on a real level-up — a lateral hire (laid-off senior, impact-short hop) must not fire a promo celebration
            tc: newTC,
            cash: Math.max(0, s.cash + (isBull ? 4 : 2) + hopVisa.cashDelta),
            laid_off: false,
            is_new_job: true,
            message: (isBull
              ? `【赶上 AI 芯片大风口】皮衣黄显卡霸权！你拿到了高 RSU 占比的 Nvidia 芯片团队包裹，职级定为 ${nextLvl}，年薪总包跃升至 ${newTC}w！`
              : `【入职英伟达】成功入职芯片工程团队，职级定为 ${nextLvl}，锁定 ${newTC}w 稳健软硬件结合大包！`) + hopVisa.note
          };
        },
        nextEventId: (s) => (isTemporaryOrStudentHousing(s) ? 'choose_housing' : (s.last_promo_age === s.age ? (s.level === 'L8 (Principal)' ? 'l8_principal_celebration' : s.level === 'L7 (Senior Staff)' ? 'l7_senior_staff_celebration' : s.level === 'L6 (Staff)' ? 'l6_staff_celebration' : h1ToH2Router(s)) : h1ToH2Router(s))),
      },
      {
        text: '【签约入职 TikTok / 字节】接手中美跨时区核心业务，拿顶格全现金包裹',
        condition: (s) => (s.hop_offers ? s.hop_offers.includes('tiktok') : s.company !== 'tiktok'),
        effect: (s) => {
          const nextLvl = hopTargetLevel(s); // 阶梯 +1，但升到 L6+ 需足够 impact，否则平跳
          const baseBand = nextLvl === 'L8 (Principal)' ? 140 : nextLvl === 'L7 (Senior Staff)' ? 95 : nextLvl === 'L6 (Staff)' ? 68 : nextLvl === 'L5 (Senior)' ? 48 : nextLvl === 'L4' ? 33 : 24;
          const econMultiplier = s.macro_economy === 'bull' ? 1.18 : (s.macro_economy === 'bear' ? 0.90 : 1.0);
          const newTC = Math.max(s.tc + 6, Math.floor(baseBand * econMultiplier));
          const hopVisa = resolveHopVisaTransition(s);

          return {
            company: 'tiktok',
            job_type: 'big_tech',
            visa: hopVisa.visa,
            level: nextLvl, last_promo_age: hopIsPromotion(s) ? s.age : s.last_promo_age, // stamp/celebrate ONLY on a real level-up — a lateral hire (laid-off senior, impact-short hop) must not fire a promo celebration
            tc: newTC,
            cash: Math.max(0, s.cash + 10 + hopVisa.cashDelta),
            health: Math.max(0, s.health - 15),
            laid_off: false,
            is_new_job: true,
            message: `【入职字节跳动】字节开出巨额全现金 Sign-on 奖金！职级定级为 ${nextLvl}，年薪总包锁定至 ${newTC}w！但深夜跨时区对齐让你睡眠严重不足 (健康 -15)。${hopVisa.note}`
          };
        },
        nextEventId: (s) => (isTemporaryOrStudentHousing(s) ? 'choose_housing' : (s.last_promo_age === s.age ? (s.level === 'L8 (Principal)' ? 'l8_principal_celebration' : s.level === 'L7 (Senior Staff)' ? 'l7_senior_staff_celebration' : s.level === 'L6 (Staff)' ? 'l6_staff_celebration' : h1ToH2Router(s)) : h1ToH2Router(s))),
      },
      {
        text: '【签约入职 Amazon】加入电商与 AWS 云计算巨头，吃满规模与股票升值，但直面高压 PIP 文化',
        condition: (s) => (s.hop_offers ? s.hop_offers.includes('amazon') : s.company !== 'amazon'),
        effect: (s) => {
          const nextLvl = hopTargetLevel(s); // 阶梯 +1，但升到 L6+ 需足够 impact，否则平跳
          const baseBand = nextLvl === 'L8 (Principal)' ? 120 : nextLvl === 'L7 (Senior Staff)' ? 82 : nextLvl === 'L6 (Staff)' ? 58 : nextLvl === 'L5 (Senior)' ? 40 : nextLvl === 'L4' ? 30 : 22;
          const econMultiplier = s.macro_economy === 'bull' ? 1.15 : (s.macro_economy === 'bear' ? 0.90 : 1.0);
          const newTC = Math.max(s.tc + 4, Math.floor(baseBand * econMultiplier));
          const hopVisa = resolveHopVisaTransition(s);

          return {
            company: 'amazon',
            job_type: 'big_tech',
            visa: hopVisa.visa,
            level: nextLvl, last_promo_age: hopIsPromotion(s) ? s.age : s.last_promo_age, // stamp/celebrate ONLY on a real level-up — a lateral hire (laid-off senior, impact-short hop) must not fire a promo celebration
            tc: newTC,
            cash: Math.max(0, s.cash + (s.macro_economy === 'bull' ? 5 : 3) + hopVisa.cashDelta),
            health: Math.max(0, s.health - 12),
            laid_off: false,
            is_new_job: true,
            message: `【入职 Amazon / AWS】你拿到了西雅图电商与云计算巨头的 Offer，职级定为 ${nextLvl}，总包 ${newTC}w（RSU 四年后置兑现占大头）！但著名的 PIP 高压文化与 Frugality 节俭作风让你时刻紧绷 (健康 -12)。${hopVisa.note}`
          };
        },
        nextEventId: (s) => (isTemporaryOrStudentHousing(s) ? 'choose_housing' : (s.last_promo_age === s.age ? (s.level === 'L8 (Principal)' ? 'l8_principal_celebration' : s.level === 'L7 (Senior Staff)' ? 'l7_senior_staff_celebration' : s.level === 'L6 (Staff)' ? 'l6_staff_celebration' : h1ToH2Router(s)) : h1ToH2Router(s))),
      },
      {
        text: '【签约入职 OpenAI / AI 实验室】加入 AGI 最前沿，拿到天价 MTS 架构师包裹',
        condition: (s) => (s.hop_offers ? s.hop_offers.includes('openai') : s.company !== 'openai'),
        effect: (s) => {
          const hopVisa = resolveHopVisaTransition(s);
          return {
            company: 'openai',
            job_type: 'ai_research',
            visa: hopVisa.visa,
            level: 'MTS',
            tc: Math.max(s.tc + 22, 68),
            cash: Math.max(0, s.cash + 8 + hopVisa.cashDelta),
            health: Math.max(0, s.health - 10),
            laid_off: false,
            is_new_job: true,
            message: `【斩获 OpenAI MTS 天价大包】顶级行业光环！你以 Member of Technical Staff 身份加入前沿大模型团队，TC 跃升至 ${Math.max(s.tc + 22, 68)}w！${hopVisa.note}`
          };
        },
        nextEventId: (s) => (isTemporaryOrStudentHousing(s) ? 'choose_housing' : h1ToH2Router(s)),
      },
      {
        text: '【签约入职 AI Startup 初创团队】降薪赌一把早期核心员工期权大饼 (高风险高回报)',
        condition: (s) => (s.hop_offers ? s.hop_offers.includes('startup') : s.job_type !== 'startup'),
        effect: (s) => {
          const hopVisa = resolveHopVisaTransition(s);
          return {
            company: 'startup',
            job_type: 'startup',
            visa: hopVisa.visa,
            stocks: (s.stocks || 0) + 18,
            tc: Math.max(16, Math.floor((s.tc || 20) * 0.85)),
            cash: Math.max(0, s.cash + hopVisa.cashDelta),
            health: Math.max(0, s.health - 10),
            laid_off: false,
            is_new_job: true,
            message: `【加入 AI Startup】你接受了一家顶级风投领投的早期初创团队 Offer！虽然现金略微下调，但分到了极其丰厚的早期期权股份！${hopVisa.note}`
          };
        },
        // 经 h1ToH2Router 汇入年度季度事件机(startup_work 仍由 startup 年度事件池保持可达)。
        nextEventId: (s) => (isTemporaryOrStudentHousing(s) ? 'choose_housing' : h1ToH2Router(s)),
      },
      {
        text: '【签约入职 Apple】加入库比蒂诺巨头，享受极致稳定性与顶尖硬件生态',
        condition: (s) => (s.hop_offers ? s.hop_offers.includes('apple') : s.company !== 'apple'),
        effect: (s) => {
          const nextLvl = hopTargetLevel(s); // 阶梯 +1，但升到 L6+ 需足够 impact，否则平跳
          const baseBand = nextLvl === 'L8 (Principal)' ? 125 : nextLvl === 'L7 (Senior Staff)' ? 86 : nextLvl === 'L6 (Staff)' ? 60 : nextLvl === 'L5 (Senior)' ? 44 : nextLvl === 'L4' ? 32 : 24;
          const econMultiplier = s.macro_economy === 'bull' ? 1.15 : s.macro_economy === 'bear' ? 0.90 : 1.0;
          const newTC = Math.max(s.tc + 5, Math.floor(baseBand * econMultiplier));
          const hopVisa = resolveHopVisaTransition(s);

          return {
            company: 'apple',
            job_type: 'big_tech',
            visa: hopVisa.visa,
            level: nextLvl, last_promo_age: hopIsPromotion(s) ? s.age : s.last_promo_age, // stamp/celebrate ONLY on a real level-up — a lateral hire (laid-off senior, impact-short hop) must not fire a promo celebration
            tc: newTC,
            cash: Math.max(0, s.cash + hopVisa.cashDelta),
            health: Math.min(100, s.health + 10),
            laid_off: false,
            is_new_job: true,
            message: `【入职 Apple Park】顺利通过库比蒂诺架构团队审核！职级定级为 ${nextLvl}，锁定年薪总包 ${newTC}w！享受极佳的稳定性与员工折扣！${hopVisa.note}`
          };
        },
        nextEventId: (s) => (isTemporaryOrStudentHousing(s) ? 'choose_housing' : (s.last_promo_age === s.age ? (s.level === 'L8 (Principal)' ? 'l8_principal_celebration' : s.level === 'L7 (Senior Staff)' ? 'l7_senior_staff_celebration' : s.level === 'L6 (Staff)' ? 'l6_staff_celebration' : h1ToH2Router(s)) : h1ToH2Router(s))),
      },
      {
        text: '【签约入职 Robinhood / 券商】赌上牛熊周期：牛市 Bonus 翻倍，熊市直面裁员风暴',
        condition: (s) => (s.hop_offers ? s.hop_offers.includes('robinhood') : s.company !== 'robinhood'),
        effect: (s) => {
          const nextLvl = hopTargetLevel(s); // 阶梯 +1，但升到 L6+ 需足够 impact，否则平跳
          const baseBand = nextLvl === 'L8 (Principal)' ? 125 : nextLvl === 'L7 (Senior Staff)' ? 88 : nextLvl === 'L6 (Staff)' ? 60 : nextLvl === 'L5 (Senior)' ? 44 : nextLvl === 'L4' ? 32 : 24;
          // Fintech comp is violently macro-bound: fat in a bull (RSU + bonus moon), gutted in a bear.
          const econMultiplier = s.macro_economy === 'bull' ? 1.30 : s.macro_economy === 'bear' ? 0.78 : 1.0;
          const newTC = Math.max(s.tc + 4, Math.floor(baseBand * econMultiplier));
          const isBull = s.macro_economy === 'bull';
          const isBear = s.macro_economy === 'bear';
          const hopVisa = resolveHopVisaTransition(s);

          return {
            company: 'robinhood',
            job_type: 'big_tech',
            visa: hopVisa.visa,
            level: nextLvl, last_promo_age: hopIsPromotion(s) ? s.age : s.last_promo_age, // stamp/celebrate ONLY on a real level-up — a lateral hire (laid-off senior, impact-short hop) must not fire a promo celebration
            tc: newTC,
            cash: Math.max(0, s.cash + (isBull ? 10 : isBear ? 1 : 4) + hopVisa.cashDelta),
            health: Math.max(0, s.health - (isBull ? 8 : isBear ? 14 : 10)),
            laid_off: false,
            is_new_job: true,
            message: (isBull
              ? `【牛市红利大爆发！】你踩着散户狂热的牛市浪尖入职 Robinhood！交易量暴涨带动 Bonus 与期权翻倍，职级定级 ${nextLvl}，总包冲上 ${newTC}w，还白拿一笔签字费！`
              : isBear
              ? `【熊市逆行入局】你在加密寒冬与交易量枯竭中加入 Robinhood，定级 ${nextLvl}、总包仅 ${newTC}w，且笼罩在下一轮裁员风暴的阴影下，节奏高压 (健康 -14)。`
              : `【入职 Robinhood】你加入散户券商核心交易团队，定级 ${nextLvl}、锁定总包 ${newTC}w。fintech 的牛熊节奏让你既兴奋又紧绷。`) + hopVisa.note
          };
        },
        nextEventId: (s) => (isTemporaryOrStudentHousing(s) ? 'choose_housing' : (s.last_promo_age === s.age ? (s.level === 'L8 (Principal)' ? 'l8_principal_celebration' : s.level === 'L7 (Senior Staff)' ? 'l7_senior_staff_celebration' : s.level === 'L6 (Staff)' ? 'l6_staff_celebration' : h1ToH2Router(s)) : h1ToH2Router(s))),
      },
      {
        text: '【拿 Competing Offer 原地 Match】拿着外部 Offer 找现任老板谈薪，就地加薪并保留原厂排期',
        condition: (s) => !s.laid_off && !!s.job_type && s.job_type !== 'unemployed' && s.job_type !== 'trader' && s.job_type !== 'startup_founder' && !!s.hop_offers && s.hop_offers.length >= 1,
        effect: (s) => ({
          tc: s.tc + 4.5,
          health: Math.min(100, s.health + 5),
          message: '【成功 Counter-Offer】老板为了挽留你连夜向 HR 申请了特别加薪 (+4.5w TC)！你零搬迁成本、零 PERM 重置风险，继续在原厂稳步发展！'
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '【留任原厂 · 零压休整】婉拒全部外部 Offer，省下搬迁与面试折腾，把精力放回团队与生活',
        condition: (s) => !s.laid_off && !!s.job_type && s.job_type !== 'unemployed' && s.job_type !== 'trader' && s.job_type !== 'startup_founder',
        effect: (s) => ({
          health: Math.min(100, s.health + 12),
          network: Math.min(100, (s.network || 0) + 2),
          message: '你婉拒了外部机会，零搬迁、零 PERM 重置、零面试压力，把节奏交还给团队与生活。虽然没有借机涨薪，但身心得到充分休整 (健康 +12)。'
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '【放弃签约 / 保持现状】婉拒外部 Offer，继续深耕创业/操盘/慢生活',
        condition: (s) => s.laid_off || s.job_type === 'unemployed' || s.job_type === 'trader' || s.job_type === 'startup_founder',
        effect: (s) => ({
          laid_off: false,
          tc: (s.job_type === 'unemployed' || s.laid_off) ? 0 : s.tc,
          message: s.job_type === 'startup_founder'
            ? '你经过慎重考虑，决定婉拒打工 Offer，继续作为 CEO 带领自己的初创团队全力以赴！'
            : (s.job_type === 'trader'
              ? '你经过慎重考虑，决定婉拒打工 Offer，继续作为全职 Trader 自由操盘！'
              : '你经过慎重考虑，决定婉拒当前所有 Offer，继续享受无拘无束的 Gap Year 慢生活。')
        }),
        nextEventId: h1ToH2Router,
      }
    ]
  },

  'sv_daily_life': {
    id: 'sv_daily_life',
    title: '【硅谷日常】年度行动面板与策略规划',
    description: '又是新的一年。每年湾区都会涌现出不同的限时行业机遇，合理分配你的精力吧！',
    choices: [
      // 0. 【大厂满5年专属限时机遇：Sabbatical 停薪留职环球放空】在同一大厂连续任职满 5 年必出、一生一次、直接推进赛季并大幅回血
      {
        text: '【限时机遇：大厂 Sabbatical 环球放空】在当前大厂任职满 5 年，申请为期半年的停薪留职放空旅行 (一生一次 · 耗资 $1.5w)',
        costBadge: '花费 $1.5w · 必休半年',
        condition: (s) => s.job_type === 'big_tech' && !s.laid_off && (s.age - (s.job_start_age || s.age)) >= 5 && !s.story_flags?.sabbatical_taken && s.last_limited_opp_year !== s.year,
        hideIfUnavailable: true,
        effect: (s) => ({
          mid_year: true,
          season_stage: 'h1',
          last_limited_opp_year: s.year,
          health: 100,
          charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 3),
          cash: Math.max(0, s.cash - 1.5),
          story_flags: {
            ...(s.story_flags || {}),
            sabbatical_taken: true
          },
          message: '【Sabbatical 环球放空】在大厂连续耕耘满 5 年，你申请了为期半年的 Sabbatical 停薪留职。从冰岛极光到巴厘岛冲浪，你彻底清空了 Slack 告警与 Oncall 噩梦，精神与体力瞬间回满到 100 分 (健康拉满至 100 · 魅力 +3)！'
        }),
        nextEventId: h1ToH2Router,
      },
      // 1. 【每年专属动态轮替机遇池】 (每年动态激活 1~2 个专属限时奇遇)
      {
        text: '【限时机遇：AI 初创团队挖角】收到前沿 AI 初创公司合伙人发来的直通终面邀请',
        condition: (s) => isOpportunityActiveThisYear(s, 'opp_cursor_hunt') && !s.laid_off && !!s.job_type && s.job_type !== 'unemployed' && s.job_type !== 'startup_founder' && s.job_type !== 'trader' && s.last_limited_opp_year !== s.year,
        hideIfUnavailable: true,
        effect: (s) => {
          const pass = s.leetcode >= 45 && gameRandom() < 0.65;
          if (pass) {
            const newTC = Math.max(s.tc + 6.0, 32.0);
            return {
              mid_year: true, season_stage: 'h1',
              last_limited_opp_year: s.year,
              tc: newTC,
              stocks: (s.stocks || 0) + 15.0,
              health: Math.max(0, s.health - 12),
              impact: addImpact(s, 8),
              is_new_job: true,
              company: 'startup',
              job_type: 'startup',
              level: '早期核心成员',
              story_flags: {
                ...(s.story_flags || {}),
                cursor_hunt_joined: true
              },
              message: `【斩获 AI 初创核心 Offer】你在终面架构评审中征服了创始人团队！以早期核心员工身份加入 AI 初创公司，总包调升至 $${newTC.toFixed(1)}w 并配发 $15.0w 早期期权股权！\n\n【限时奇遇已结算】接下来请在下方规划你本年度的核心职场与生活重心：`
            };
          }
          return {
            mid_year: true, season_stage: 'h1',
            last_limited_opp_year: s.year,
            health: Math.max(0, s.health - 10),
            leetcode: s.leetcode + 4,
            message: '【初创面试折戟】初创团队对于全栈与底层系统架构要求极高，虽然遗憾未能拿下 Offer，但对前沿技术落地的理解收获颇丰。\n\n【限时奇遇已结算】接下来请在下方规划你本年度的核心职场与生活重心：'
          };
        },
        // A unicorn VP final-round IS your career move for the year (a real job change on
        // success), not a free bonus — consume the year via h1ToH2Router so the player can't
        // return to sv_daily_life and immediately fire a SECOND job hop (刷题跳槽) the same year.
        nextEventId: h1ToH2Router,
      },
      {
        text: '【限时机遇：黑客松夺冠】组队参加斯坦福 TreeHacks 极客马拉松 ($0.5w)',
        condition: (s) => s.age <= 36 && isOpportunityActiveThisYear(s, 'opp_treehacks') && s.cash >= 0.5 && s.last_limited_opp_year !== s.year,
        hideIfUnavailable: true,
        effect: (s) => {
          const win = gameRandom() < (0.15 + s.leetcode / 600);
          return win
            ? {
                last_limited_opp_year: s.year,
                cash: s.cash + 8,
                leetcode: s.leetcode + 10,
                charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 3),
                impact: addImpact(s, 8),
                story_flags: { ...(s.story_flags || {}), last_treehacks_year: s.year },
                message: '【Hackathon 夺冠】比赛通宵 48 小时！你们的 Demo 拿下了全场总冠军！硅谷顶级天使投资人现场开出 $30w 支票支持团队继续研发，作为核心开发你分到了 $8w！\n\n【限时奇遇已结算】接下来请在下方规划你本年度的核心职场与生活重心：'
              }
            : {
                last_limited_opp_year: s.year,
                cash: s.cash - 0.5,
                health: Math.max(0, s.health - 15),
                leetcode: s.leetcode + 8,
                story_flags: { ...(s.story_flags || {}), last_treehacks_year: s.year },
                message: '【Hackathon 陪跑】连续通宵两天喝了 8 罐红牛，虽然Demo演示时服务器崩溃没拿奖，但你结识了一群技术极客。\n\n【限时奇遇已结算】接下来请在下方规划你本年度的核心职场与生活重心：'
              };
        },
        nextEventId: 'sv_daily_life',
      },
      {
        // 真·机遇(替换浮夸的飞行执照):big_tech 内部孵化器 0→1 立项。pitch 抢名额,赌一把。
        text: '【限时机遇：内部孵化器立项】公司开放 0→1 内部孵化名额，你带点子去 pitch 抢立项',
        condition: (s) => isOpportunityActiveThisYear(s, 'opp_incubator') && s.job_type === 'big_tech' && !s.laid_off && s.last_limited_opp_year !== s.year,
        hideIfUnavailable: true,
        effect: (s) => {
          const win = gameRandom() < Math.min(0.7, 0.3 + (s.leetcode / 300) + ((s.impact || 0) / 200) + ((s.network || 10) / 300));
          return win
            ? { mid_year: true, season_stage: 'h1', last_limited_opp_year: s.year, tc: s.tc + 2, impact: addImpact(s, 10), health: Math.max(0, s.health - 6), story_flags: { ...(s.story_flags || {}), last_incubator_year: s.year }, message: '【立项成功】你的 pitch 打动了评委会，拿到 headcount 与预算亲手孵化一个 0→1 项目！高层能见度与影响力大涨（但从此背上交付压力）。\n\n【限时奇遇已结算】接下来请在下方规划你本年度的核心职场与生活重心：' }
            : { mid_year: true, season_stage: 'h1', last_limited_opp_year: s.year, leetcode: Math.min(100, s.leetcode + 3), health: Math.max(0, s.health - 4), story_flags: { ...(s.story_flags || {}), last_incubator_year: s.year }, message: '【立项惜败】孵化名额竞争激烈，你的提案遗憾出局，但打磨 pitch 与原型的过程让你技术见识长进不少。\n\n【限时奇遇已结算】接下来请在下方规划你本年度的核心职场与生活重心：' };
        },
        nextEventId: h1ToH2Router,
      },
      {
        // 真·机遇(替换浮夸的私人飞行):抢风口 reskill。带成功率——踩中风口大赚,没踩中也长了底子。
        text: '【限时机遇：抢风口 reskill】新技术浪潮爆发，你自费报训练营恶补想吃到风口红利 ($1.5w)',
        condition: (s) => isOpportunityActiveThisYear(s, 'opp_reskill_wave') && s.cash >= 1.5 && !!s.job_type && s.job_type !== 'unemployed' && s.last_limited_opp_year !== s.year,
        hideIfUnavailable: true,
        effect: (s) => {
          const caught = gameRandom() < Math.min(0.75, 0.45 + (s.leetcode / 400) + ((s.luck || 20) / 400));
          return caught
            ? { mid_year: true, season_stage: 'h1', last_limited_opp_year: s.year, cash: s.cash - 1.5, leetcode: Math.min(100, s.leetcode + 12), impact: addImpact(s, 6), tc: s.tc + 1, health: Math.max(0, s.health - 4), story_flags: { ...(s.story_flags || {}), last_reskill_year: s.year }, message: '【踩中风口】你抢先补齐了最热的技能栈，恰好赶上业务转向，成了组里稀缺的风口人才，技术与影响力双丰收！\n\n【限时奇遇已结算】接下来请在下方规划你本年度的核心职场与生活重心：' }
            : { mid_year: true, season_stage: 'h1', last_limited_opp_year: s.year, cash: s.cash - 1.5, leetcode: Math.min(100, s.leetcode + 5), health: Math.max(0, s.health - 4), story_flags: { ...(s.story_flags || {}), last_reskill_year: s.year }, message: '【风口没吃到】训练营结业时热度已过，新技能一时没用武之地，但底子还是扎实了几分，不算白学。\n\n【限时奇遇已结算】接下来请在下方规划你本年度的核心职场与生活重心：' };
        },
        nextEventId: h1ToH2Router,
      },
      {
        // 真·机遇(替换浮夸的赛道日):startup 员工的期权 Tender Offer 套现窗口。现金给得克制(只兑一角)。
        text: '【限时机遇：期权 Tender Offer】公司开放老股回购窗口，早期期权终于能兑现一角',
        condition: (s) => isOpportunityActiveThisYear(s, 'opp_tender_offer') && s.job_type === 'startup' && !s.laid_off && s.last_limited_opp_year !== s.year,
        hideIfUnavailable: true,
        effect: (s) => ({
          mid_year: true, season_stage: 'h1',
          last_limited_opp_year: s.year,
          cash: s.cash + 5,
          health: Math.min(100, s.health + 3),
          story_flags: { ...(s.story_flags || {}), last_tender_year: s.year },
          message: '【落袋一角】赶上公司老股 Tender Offer 回购窗口，你卖掉一小部分早期期权，把纸面财富兑现了 +$5w，给生活添了点确定性（大头继续押未来 exit）。\n\n【限时奇遇已结算】接下来请在下方规划你本年度的核心职场与生活重心：'
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '【限时机遇：科技狂欢】前往内华达沙漠参加火人节 (Burning Man) 极客大迁徙 ($1.2w)',
        condition: (s) => isOpportunityActiveThisYear(s, 'opp_burning_man') && s.cash >= 1.2 && s.last_limited_opp_year !== s.year,
        hideIfUnavailable: true,
        effect: (s) => ({
          last_limited_opp_year: s.year,
          cash: s.cash - 1.2,
          health: Math.min(100, s.health + 10),
          charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 4),
          luck: Math.min(99, (s.luck || 20) + 8),
          story_flags: {
            ...(s.story_flags || {}),
            last_burning_man_year: s.year
          },
          message: '【火人节洗礼】你在黑石城沙漠参加了 Burning Man，虽然风沙与昼夜狂欢有些耗费体力，但灵性觉醒彻底清空了精神内耗，并结识了一批硅谷前沿极客！\n\n【限时奇遇已结算】接下来请在下方规划你本年度的核心职场与生活重心：'
        }),
        nextEventId: 'sv_daily_life',
      },
      {
        text: '【限时机遇：沙丘路私享会】受邀参加 Sand Hill Road 闭门华人天使投资人沙龙 ($1.0w)',
        condition: (s) => isOpportunityActiveThisYear(s, 'opp_sand_hill_salon') && (s.cash + (s.stocks || 0)) >= 150 && s.cash >= 1.0 && s.last_limited_opp_year !== s.year,
        hideIfUnavailable: true,
        effect: (s) => ({
          last_limited_opp_year: s.year,
          cash: s.cash - 1.0,
          charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 4),
          network: Math.min(100, (s.network || 10) + 6), // "拓展顶层人脉/结识VC" now actually grants network
          luck: Math.min(99, (s.luck || 20) + 3),
          story_flags: {
            ...(s.story_flags || {}),
            last_sand_hill_year: s.year
          },
          message: '【拓展顶层人脉】在沙丘路红木私宅里结识了数位顶级 VC 合伙人与独角兽创始人，手握核心行业内幕与优质天使跟投名额！\n\n【限时奇遇已结算】接下来请在下方规划你本年度的核心职场与生活重心：'
        }),
        nextEventId: 'sv_daily_life',
      },
      {
        text: '【限时机遇：硅谷朝圣】抢购 Nvidia GTC 大会 VIP 门票进场见黄仁勋 ($1.5w)',
        condition: (s) => isOpportunityActiveThisYear(s, 'opp_gtc_nvidia') && s.cash >= 1.5 && s.last_limited_opp_year !== s.year,
        hideIfUnavailable: true,
        effect: (s) => ({
          last_limited_opp_year: s.year,
          cash: s.cash - 1.5,
          charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 5),
          luck: Math.min(99, (s.luck || 20) + 12),
          story_flags: {
            ...(s.story_flags || {}),
            last_gtc_year: s.year
          },
          message: '【参加 GTC】你在 GTC 大会前排拿到了黄仁勋签名的黑色皮衣同款折扇！接下来的投资和求职将获得强运加持！\n\n【限时奇遇已结算】接下来请在下方规划你本年度的核心职场与生活重心：'
        }),
        nextEventId: 'sv_daily_life',
      },
      {
        text: '【限时机遇：漏洞赏金】深挖大厂分布式基础设施 Zero-Day 漏洞获取 Bug Bounty 奖金',
        condition: (s) => isOpportunityActiveThisYear(s, 'opp_zero_day_bounty') && s.leetcode >= 35 && s.last_limited_opp_year !== s.year,
        hideIfUnavailable: true,
        effect: (s) => {
          const success = gameRandom() < 0.35;
          return success
            ? { last_limited_opp_year: s.year, cash: s.cash + 8, leetcode: s.leetcode + 5, impact: addImpact(s, 6), message: '【提交漏洞】安全部门确认了你提交的高危提权漏洞！向你的账户汇入了 $8w 漏洞赏金！\n\n【限时奇遇已结算】接下来请在下方规划你本年度的核心职场与生活重心：' }
            : { last_limited_opp_year: s.year, health: Math.max(0, s.health - 8), message: '【提交漏洞】安全团队回应称这是“预期设计 (Works as Intended)”，白白研究了三天。\n\n【限时奇遇已结算】接下来请在下方规划你本年度的核心职场与生活重心：' };
        },
        nextEventId: 'sv_daily_life',
      },
      {
        text: '【限时机遇：自媒体爆款】深度测评爆火 AI 开源模型并发布顶流视频 ($0.8w)',
        condition: (s) => isOpportunityActiveThisYear(s, 'opp_viral_ai_video') && s.cash >= 0.8 && s.last_limited_opp_year !== s.year,
        hideIfUnavailable: true,
        effect: (s) => {
          const winRate = 0.40 + ((s.charm || 10) / 50) + ((s.luck || 20) / 500);
          const isViral = gameRandom() < Math.min(0.85, winRate);
          return isViral
            ? {
                last_limited_opp_year: s.year,
                cash: s.cash + 3.5,
                health: Math.max(0, s.health - 5),
                charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 4),
                impact: addImpact(s, 4),
                message: '【测评爆火】你连续肝夜剪出的 AI Agent 深度评测视频在 YouTube 和小红书大爆！收割了 $4.3w 广告赞助 (净赚 $3.5w)！\n\n【限时奇遇已结算】接下来请在下方规划你本年度的核心职场与生活重心：'
              }
            : {
                last_limited_opp_year: s.year,
                cash: s.cash - 0.8,
                health: Math.max(0, s.health - 5),
                charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 2),
                message: '【流量平平】视频遭遇了平台算法限流，虽然熬夜没能回本，但积累了宝贵的自媒体剪辑与运营经验。\n\n【限时奇遇已结算】接下来请在下方规划你本年度的核心职场与生活重心：'
              };
        },
        nextEventId: 'sv_daily_life',
      },
      {
        text: '【限时机遇：捡漏投资房】参与东湾法拍独栋房捡漏拍卖 (首付 $20w · 获稳健被动租金)',
        condition: (s) => isOpportunityActiveThisYear(s, 'opp_foreclosure_deal') && (s.cash + (s.stocks || 0)) >= 20 && (s.rental_income || 0) < 10 && s.last_limited_opp_year !== s.year,
        hideIfUnavailable: true,
        effect: (s) => ({
          last_limited_opp_year: s.year,
          cash: s.cash - 20,
          rental_income: (s.rental_income || 0) + 2.5,
          investment_properties: [...(s.investment_properties || []), '东湾法拍翻新独立屋'],
          story_flags: {
            ...(s.story_flags || {}),
            bought_foreclosure_house: true
          },
          message: '【成功拍下法拍房】你在 Courthouse 拍卖中以超低折扣拿下东湾翻新独立屋！快速完成招租，每年产生 +$2.5w 净被动租金现金流！\n\n【限时奇遇已结算】接下来请在下方规划你本年度的核心职场与生活重心：'
        }),
        nextEventId: 'sv_daily_life',
      },
      {
        text: '【限时机遇：天使跟投】前同事明星 AI 团队启动 Seed 轮，以天使投资人身份入局 ($10w)',
        condition: (s) => isOpportunityActiveThisYear(s, 'opp_angel_invest') && s.cash >= 10 && s.last_limited_opp_year !== s.year,
        hideIfUnavailable: true,
        effect: (s) => {
          const success = gameRandom() < 0.45;
          return success
            ? {
                last_limited_opp_year: s.year,
                cash: s.cash - 10,
                stocks: (s.stocks || 0) + 40,
                story_flags: {
                  ...(s.story_flags || {}),
                  last_angel_invest_year: s.year
                },
                message: '【天使投资神话】该 AI 团队仅用 6 个月便斩获红杉 A 轮领投！公司估值暴涨 5 倍，你的天使股份价值跃升至 $40w！\n\n【限时奇遇已结算】接下来请在下方规划你本年度的核心职场与生活重心：'
              }
            : {
                last_limited_opp_year: s.year,
                cash: s.cash - 10,
                story_flags: {
                  ...(s.story_flags || {}),
                  last_angel_invest_year: s.year
                },
                message: '【天使投资沉淀】初创项目在激烈内卷中遭遇巨头降维打击，资金正在艰难摸索 PMF 转型，暂未实现估值爆发。\n\n【限时奇遇已结算】接下来请在下方规划你本年度的核心职场与生活重心：'
              };
        },
        nextEventId: 'sv_daily_life',
      },
      {
        text: '【初创生死发版】通宵配合 VC 尽调与产品上线，为公司千万级融资做技术背书',
        condition: (s) => s.job_type === 'startup' && !s.laid_off,
        hideIfUnavailable: true,
        effect: (s) => {
          const winRate = 0.20 + (s.leetcode / 400) + ((s.luck || 20) / 400);
          const win = gameRandom() < Math.min(0.65, winRate);
          return win
            ? { mid_year: true, season_stage: 'h1', health: Math.max(0, s.health - 15), cash: s.cash + 5, stocks: (s.stocks || 0) + 10, impact: addImpact(s, 8), message: '【融资大捷】公司顺利拿下 A 轮千万美金融资！你的期权估值大涨并分到了 $5w 现金绩效奖金！' }
            : { mid_year: true, season_stage: 'h1', health: Math.max(0, s.health - 15), leetcode: s.leetcode + 5, impact: addImpact(s, 4), message: '【技术硬仗】一人干完了三人的全栈活，虽然融资推迟，但全套云原生与 Agent 架构让你技术实力全面蜕变。' };
        },
        nextEventId: h1ToH2Router,
      },
      // 【提前上岸 · 主动退休】后期能动性:永久身份(绿卡/公民) + 资产 ≥ $150w($1.5M) 起可自主下车。
      // 这是后期的真选择——用「继续冲更高 FIRE、承担健康/年龄歧视/裁员风险」换「立刻自由」——
      // 而非再叠一个数值 debuff。结局不特判:未达 $500w FIRE 阈值 → content 结局(中产退休/佛系/上岸),
      // 资产 ≥ $500w 时结局分类器自动判定为 triumph。仅设 status:'retired',复用既有结局系统。
      {
        text: '【提前上岸 · 主动退休】已上岸且攒够 $150w+，宣布告别内卷、提前退休安享余生',
        condition: (s) => isPermanentVisa(s.visa) && (s.cash + (s.stocks || 0)) >= 150 && s.status === 'playing',
        effect: (s) => ({
          status: 'retired',
          message: `你在 ${s.age} 岁做出了清醒而勇敢的决定：手握 $${(s.cash + (s.stocks || 0)).toFixed(1)}w 资产、身份再无后顾之忧，你主动从硅谷的内卷跑步机上下车。不必再看 Perf、排期与 Manager 的脸色，余生由你自己定义。`,
        }),
        nextEventId: 'end',
      },
      // 【研究路径的高效 impact 行动】ai_research/MTS 缺一个高效可重复的年度 impact 来源
      // (内卷 -14 健康太贵、openai crunch 一生一次),否则冲 L7/L8 只能靠随机事件+硬卷。
      // 本行动以适中健康代价稳定产出 impact,与大厂【疯狂内卷】对齐,让研究路径也能自力更生地
      // 积累影响力。晋升仍走 perf_review / 内卷(本行动只负责高效攒 impact)。
      {
        text: '【前沿研究 · 主导顶会 Paper / 开源影响力】主导大模型核心研究，冲刺顶会 Oral 与开源生态',
        condition: (s) => s.job_type === 'ai_research' && !s.laid_off,
        hideIfUnavailable: true,
        effect: (s) => {
          const win = gameRandom() < Math.min(0.88, 0.55 + ((s.impact || 0) / 250) + (s.leetcode / 350) + ((s.luck || 20) / 400));
          return win
            ? { mid_year: true, season_stage: 'h1', health: Math.max(0, s.health - 7), leetcode: Math.min(100, s.leetcode + 3), tc: s.tc + 1.0, impact: addImpact(s, 10), message: '【顶会 Oral / 开源爆款】你主导的研究被顶会 Oral 收录、开源项目冲上 GitHub Trending，行业影响力 (Impact) 大增！' }
            : { mid_year: true, season_stage: 'h1', health: Math.max(0, s.health - 7), leetcode: Math.min(100, s.leetcode + 5), impact: addImpact(s, 5), message: '【拒稿但沉淀】论文惨遭 Reviewer 2 拒稿，但你摸清了前沿方向、积累了扎实的研究影响力，稳步提升。' };
        },
        // 发出推进信号,由 resolveNextEventId 季度状态机统一插入 H1→H2→结算(与其它年度动作一致,
        // 避免旧写法 midYearEventRouter(s) 直接产出 H1 事件后状态机再插一个 → 双 H1)。
         nextEventId: (s) => h1ToH2Router(s),
       },
       // 【向上管理 · 攒政治资本】big_tech 专属年度招式:把一年花在向上管理而非写代码上,换软实力
       // (charm/network — Staff+ 晋升与内推的门槛),但技术手生 (leetcode-5) 且政治内耗 (health-5)。
       // 刻意不加 impact/tc(不产出可见业绩)。晋升 roll 对 charm/network 有 min() 硬顶、且 leetcode 门槛
       // (65-80) 不因此降低,故买不来 L6+ 晋升——它只是资深"政治线"的差异化打法,而非速升捷径。
       {
         text: '【向上管理 · 攒政治资本】少写代码，多做 1:1 与汇报，经营向上管理与跨组关系',
         condition: (s) => s.job_type === 'big_tech' && !s.laid_off,
         effect: (s) => ({
           mid_year: true, season_stage: 'h1',
           charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 3),
           network: Math.min(100, (s.network || 10) + 5),
           leetcode: Math.max(0, s.leetcode - 5),
           health: Math.max(0, s.health - 5),
           message: '【向上管理】你把这一年的精力从硬产出转向经营关系：精修 perf packet、勤刷 1:1、在跨组会议上刷脸拉盟友。政治资本(魅力与人脉)稳步累积，但久疏算法手也生了，办公室政治本身也颇为内耗。'
         }),
         nextEventId: (s) => h1ToH2Router(s),
       },
       // 3. 【常规年度重心】 (点击后进入年中/年底结算)
       {
         text: '【疯狂内卷】拼命加班冲 Perf，争取加薪与升职',
        condition: (s) => !!s.job_type && s.job_type !== 'unemployed' && s.job_type !== 'trader' && s.job_type !== 'startup_founder' && !s.laid_off,
        effect: (s) => {
          const curLevel = s.level || (s.job_type === 'ai_research' ? 'MTS' : s.is_phd ? 'L4' : 'L3');
          const normLvl = normalizeLevel(curLevel, s) || (s.is_phd ? 'L4' : 'L3');
          const lastPromoAge = s.last_promo_age ?? (s.age - 1);
          const yearsInGrade = s.age - lastPromoAge;
          const isKingOfRoll = s.trait_title === '卷王之王';
          // 卷厂(meta/tiktok/nvidia/amazon)高压高回报:更高晋升赔率 + 略高健康代价(合并自原【大厂战时冲刺】,
          // 现在「疯狂内卷」是唯一晋升引擎,赔率按公司强度自适应;养老厂常规、卷厂更狠更快)。
          const isHardCoreCo = ['meta', 'tiktok', 'nvidia', 'amazon'].includes(s.company || '');
          const coBonus = isHardCoreCo ? 0.20 : 0;
          const drain = (isKingOfRoll ? 8 : 14) + (isHardCoreCo ? 2 : 0);
          
          const baseWinRate = 0.15 + coBonus + (s.leetcode / 300) + ((s.charm || 10) * 0.015) + ((s.network || 10) * 0.01) + (isKingOfRoll ? 0.15 : 0);
          const pass = gameRandom() < Math.min(0.78, baseWinRate);

          if (normLvl === 'L3') {
            // L3 升 L4 要求算法 >= 35 (达标且满 1 年晋升率极高，若满 2 年算法门槛可放宽至 30)
            if (s.leetcode < 30 && yearsInGrade < 2) return { mid_year: true, season_stage: 'h1', health: Math.max(0, s.health - drain), tc: s.tc + 0.5, message: 'Manager 指出你的日常代码产出与算法基础还不够扎实，建议先在工程与算法基本功上多做沉淀。' };
            const l3PassRate = 0.70 + coBonus + (s.leetcode / 200) + (isKingOfRoll ? 0.20 : 0) + (yearsInGrade >= 2 ? 0.25 : 0);
            if (yearsInGrade >= 1 && (s.leetcode >= 30 || yearsInGrade >= 2) && (gameRandom() < Math.min(0.95, l3PassRate) || yearsInGrade >= 2 || isKingOfRoll)) {
              return { mid_year: true, season_stage: 'h1', health: Math.max(0, s.health - drain), tc: s.tc + 3.5, level: 'L4', impact: addImpact(s, 5), last_promo_age: s.age, message: isKingOfRoll ? '【卷王破格晋升】做题家底蕴彻底释放，你的 Perf 拿下顶格 EE 绩效轻松晋升至 L4！' : '恭喜！凭借过硬的算法功底与稳定交付，你顺利晋升为 L4 工程师！总包调薪 +$3.5w！' };
            }
          } else if (normLvl === 'L4') {
            // L4 升 L5 (Senior) 要求算法 >= 50 (资深工程师是硅谷终身职级 Terminal Level，多数人在 2~3 年内达成)
            if (s.leetcode < 45 && yearsInGrade < 2) return { mid_year: true, season_stage: 'h1', health: Math.max(0, s.health - (drain + 2)), tc: s.tc + 1.0, message: '晋升委员会认为你的技术深度还未达到 Senior 水平，核心模块攻坚与独立主导能力仍需进一步沉淀。' };
            const l4PassRate = 0.55 + coBonus + (s.leetcode / 250) + ((s.charm || 10) * 0.01) + (isKingOfRoll ? 0.20 : 0) + (yearsInGrade >= 2 ? 0.25 : 0);
            if (yearsInGrade >= 1 && (s.leetcode >= 45 || yearsInGrade >= 3) && (gameRandom() < Math.min(0.90, l4PassRate) || (yearsInGrade >= 3 && s.leetcode >= 40) || isKingOfRoll)) {
              return { mid_year: true, season_stage: 'h1', health: Math.max(0, s.health - (drain + 2)), tc: s.tc + 6.0, level: 'L5 (Senior)', impact: addImpact(s, 7), last_promo_age: s.age, message: '轰动全组！你主导了核心子模块交付，顺利晋升为 L5 Senior 资深工程师！总包调薪 +$6.0w！' };
            }
          } else if (normLvl === 'L5 (Senior)') {
            // L5 升 L6 (Staff) 非常难 (天花板天堑，要求极高架构力、跨组影响力与 VP Sponsor)
            const promoChance = 0.05 + ((s.charm || 10) * 0.003) + ((s.network || 10) * 0.003) + (isKingOfRoll ? 0.05 : 0);
            // L5→L6 也要 impact≥20 (与 perf_review / hopTargetLevel 的门槛一致,否则纯靠内卷
            // 刷题就能零 impact 登顶,架空了 Impact 机制)。
            if (meetsOrganicPromo(s, 'L6 (Staff)') && yearsInGrade >= 2 && pass && gameRandom() < Math.min(0.18, promoChance)) {
              return { mid_year: true, season_stage: 'h1', health: Math.max(0, s.health - 15), tc: s.tc + 12.0, level: 'L6 (Staff)', impact: addImpact(s, 10), last_promo_age: s.age, message: '奇迹登顶！你打破硅谷天花板，结合顶层架构产出与全公司影响力，成功晋升为万里挑一的 L6 Staff 架构师！总包调升 +$12w！' };
            }
          } else if (normLvl === 'L6 (Staff)') {
            const promoChance = 0.10 + ((s.charm || 10) * 0.003) + ((s.network || 10) * 0.003) + (isKingOfRoll ? 0.05 : 0);
            if (meetsOrganicPromo(s, 'L7 (Senior Staff)') && yearsInGrade >= 2 && pass && gameRandom() < Math.min(0.20, promoChance)) return { mid_year: true, season_stage: 'h1', health: Math.max(0, s.health - 15), tc: s.tc + 20.0, level: 'L7 (Senior Staff)', impact: addImpact(s, 12), last_promo_age: s.age, message: '战略突围！凭借高层 VP Sponsor 与跨部门整合能力，全票通过晋升为 L7 Senior Staff 资深架构师！总包狂飙 +$20w！' };
          } else if (normLvl === 'L7 (Senior Staff)') {
            const promoChance = 0.08 + ((s.charm || 10) * 0.002) + ((s.network || 10) * 0.002) + (isKingOfRoll ? 0.04 : 0);
            if (meetsOrganicPromo(s, 'L8 (Principal)') && yearsInGrade >= 2 && pass && gameRandom() < Math.min(0.15, promoChance)) return { mid_year: true, season_stage: 'h1', health: Math.max(0, s.health - 15), tc: s.tc + 35.0, level: 'L8 (Principal)', impact: addImpact(s, 15), last_promo_age: s.age, message: '硅谷封神！凭借全公司顶级声望与董事会强力支持，获聘为全公司屈指可数的 L8 Principal 首席架构师！总包调升 +$35w！' };
          }
          const meritBonus = gameRandom() < 0.35 ? 2.0 : 1.0;
          // 升职受阻诊断:Staff+(L5→L6+)这段的隐形门槛(impact/人脉/leadership)在没升成时明确告知
          // 玩家卡在哪,让他能主动补短板再冲(像读牛熊指标一样读升职信号)。L3/L4 返回空串,回退通用文案。
          const blocker = promoBlockerHint(s);
          return { mid_year: true, season_stage: 'h1', health: Math.max(0, s.health - drain), tc: s.tc + meritBonus, impact: addImpact(s, 6), message: isKingOfRoll ? `【卷王日常高产】你高质高效交付了核心模块，拿到了项目奖金 (+${meritBonus}w TC)！${blocker ? ' ' + blocker : ''}` : `你拼命熬夜写代码，拿到了项目奖金 (+${meritBonus}w TC)！${blocker || 'Manager：“今年部门升职 Quota 紧张，你的指标已入库，明年一定为你申请！”'}` };
        },
        nextEventId: (s) => {
          // Route on the ACTUAL promotion (last_promo_age is set to s.age ONLY on a
          // successful promo), not message.includes('晋升'): the rejection message
          // ('晋升委员会认为…') also contains 晋升 (→ celebrated a rejection), and the L8
          // success copy ('登顶/获聘') does NOT contain 晋升 (→ L8 celebration was missed).
          if (s.last_promo_age === s.age) {
            if (s.level === 'L8 (Principal)') return 'l8_principal_celebration';
            if (s.level === 'L7 (Senior Staff)') return 'l7_senior_staff_celebration';
            if (s.level === 'L6 (Staff)') return 'l6_staff_celebration';
            if (s.level === 'L5 (Senior)' || s.level === 'L4') return 'promo_celebration';
          }
          return h1ToH2Router(s);
        },
      },
      {
        text: '【刷题跳槽】闭关刷题备战，海投湾区各大厂/独角兽发起社招面试',
        condition: (s) => !s.laid_off && s.job_type !== 'trader' && s.job_type !== 'startup_founder',
        effect: (s) => {
          const isKingOfRoll = s.trait_title === '卷王之王';
          const drain = isKingOfRoll ? 6 : 12;
          const leetBonus = isKingOfRoll ? 18 : 12;
          const newLeet = s.leetcode + leetBonus;

          // 候选公司池与录取算法门槛
          const allPool: Array<{ id: string; name: string; minLeet: number; weight: number }> = [
            { id: 'google', name: 'Google', minLeet: s.macro_economy === 'bear' ? 55 : (s.macro_economy === 'bull' ? 35 : 45), weight: 0.95 },
            { id: 'meta', name: 'Meta', minLeet: s.macro_economy === 'bear' ? 65 : (s.macro_economy === 'bull' ? 45 : 55), weight: 0.90 },
            { id: 'nvidia', name: 'Nvidia', minLeet: s.macro_economy === 'bear' ? 60 : (s.macro_economy === 'bull' ? 40 : 48), weight: 0.90 },
            { id: 'tiktok', name: 'TikTok', minLeet: s.macro_economy === 'bear' ? 52 : (s.macro_economy === 'bull' ? 35 : 42), weight: 0.95 },
            { id: 'apple', name: 'Apple', minLeet: s.macro_economy === 'bear' ? 55 : (s.macro_economy === 'bull' ? 35 : 42), weight: 0.95 },
            // Amazon: high-volume hirer (high weight), moderate bar, but brutal PIP culture (health drain in settlement).
            { id: 'amazon', name: 'Amazon', minLeet: s.macro_economy === 'bear' ? 52 : (s.macro_economy === 'bull' ? 35 : 44), weight: 1.0 },
            { id: 'startup', name: 'AI Startup', minLeet: 32, weight: 1.05 },
            // Robinhood: fintech mid-cap. Moderate bar; hires aggressively in a bull, freezes in a bear.
            { id: 'robinhood', name: 'Robinhood', minLeet: s.macro_economy === 'bear' ? 54 : (s.macro_economy === 'bull' ? 38 : 46), weight: s.macro_economy === 'bear' ? 0.7 : 0.9 },
          ];

          // OpenAI/前沿 AI 实验室是高级岗，除算法/PhD 外还看项目影响力 (impact≥30)；躺平者跳不动。
          if ((newLeet >= 70 || s.is_phd) && (s.impact || 0) >= 30) {
            allPool.push({ id: 'openai', name: 'OpenAI', minLeet: s.macro_economy === 'bull' ? 70 : 75, weight: 0.65 });
          }

          const eligiblePool = allPool.filter(c => c.id !== s.company && c.id !== s.job_type);

          // 真实社招机制：每轮跳槽精力有限，精准投递 2 ~ 3 家目标大厂/团队
          const targetCount = Math.min(eligiblePool.length, isKingOfRoll ? 4 : (gameRandom() < 0.45 ? 2 : 3));
          const targetCompanies = [...eligiblePool].sort(() => gameRandom() - 0.5).slice(0, targetCount);

          // 逐一计算面试通过与发 Offer 概率
          const wonOffers: string[] = [];
          const econBonus = s.macro_economy === 'bull' ? 0.14 : (s.macro_economy === 'bear' ? -0.20 : 0);
          const charmBonus = ((s.charm || 10) - 10) / 140;
          const luckBonus = ((s.luck || 20) - 20) / 300;
          // 中年 ageism (T2)：科技行业的隐性年龄歧视现实里从 ~35 岁就开始 —— 面试通过率随年龄递减
          // (35 岁起每岁 -1.5%，最多 -18%)，让中后期失业/跳槽不再稳稳翻身，制造真实存亡压力。
          const ageBonus = s.age >= 35 ? -Math.min(0.18, (s.age - 35) * 0.015) : 0;

          for (const comp of targetCompanies) {
            if (newLeet >= comp.minLeet) {
              const diff = newLeet - comp.minLeet;
              const passProb = Math.max(0.05, Math.min(0.72, (0.20 + (diff / 85) + econBonus + charmBonus + luckBonus + ageBonus) * comp.weight));
              if (gameRandom() < passProb) {
                wonOffers.push(comp.id);
              }
            }
          }

          // 卷王保底机制：算法 >= 50 且有 target 时保底获得 1 个 Offer
          if (isKingOfRoll && wonOffers.length === 0 && newLeet >= 50 && targetCompanies.length > 0) {
            const fallback = targetCompanies[Math.floor(gameRandom() * targetCompanies.length)];
            wonOffers.push(fallback.id);
          }

          // 1. 拿到了 0 个 Offer
          if (wonOffers.length === 0) {
            return {
              mid_year: true,
              season_stage: 'h1',
              health: Math.max(0, s.health - drain),
              leetcode: newLeet,
              hop_applied_count: targetCompanies.length,
              hop_offers: [],
              message: s.macro_economy === 'bear'
                ? `【熊市寒冬·HC 冻结】科技股熊市下各大厂招聘收紧，简历多数石沉大海，多轮 Onsite 终面后均未发 Offer。好在今年狂刷算法与架构 (算法 +${leetBonus})，技术储备大涨，继续留任原厂蓄力！`
                : (newLeet < 40 
                  ? `【算法深度不足·遗憾未过】大厂社招面试 Bar 极高，系统设计与复杂算法未能打动面试委员会，投递的各家均未发 Offer。你利用这一年沉淀了扎实算法 (算法 +${leetBonus})，继续在原厂积累！`
                  : `【名额有限·全挂遗憾留任】今年社招竞争极其白热化，几轮终面 Hiring Committee 均因名额有限未发 Offer。虽然跳槽未果，但扎实的技术储备 (算法 +${leetBonus}) 实打实留存在你的面板中！`)
            };
          }

          // 2. 拿到了 1 个或多个 Offer
          const nameMap: Record<string, string> = {
            google: 'Google',
            meta: 'Meta',
            nvidia: 'Nvidia',
            tiktok: 'TikTok',
            apple: 'Apple',
            amazon: 'Amazon',
            openai: 'OpenAI',
            startup: 'AI Startup',
            robinhood: 'Robinhood'
          };
          const offerNames = wonOffers.map(id => nameMap[id] || id).join('、');

          return {
            mid_year: true,
            season_stage: 'h1',
            health: Math.max(0, s.health - drain),
            leetcode: newLeet,
            hop_applied_count: targetCompanies.length,
            hop_offers: wonOffers,
            message: wonOffers.length > 1
              ? `【大丰收！斩获 ${wonOffers.length} 份社招 Competing Offers】经过一整年的闭关刷题与疯狂面试轰炸 (算法 +${leetBonus})，你成功斩获了 ${offerNames} 的正式录用 Offer！请选择入职去向或就地谈薪：`
              : `【斩获社招 Offer】经过一整年的闭关刷题与多轮 Onsite 面试 (算法 +${leetBonus})，你顺利拿下了 ${offerNames} 的正式录用 Offer！请选择入职去向：`
          };
        },
        nextEventId: (s: GameState) => {
          const offers = s.hop_offers || [];
          if (offers.length > 0) return 'job_hop_market';
          return h1ToH2Router(s);
        },
      },
      // 按部就班 (60分及格线) 与 内部转组:排在核心冲刺 (内卷/刷题) 之后、情境动作之前。
      {
        text: '【按部就班】完成本职需求及格线 (Meets Bar)，准时打卡下班、养生回血',
        condition: (s) => !s.laid_off && !!s.job_type && s.job_type !== 'unemployed' && s.job_type !== 'trader' && s.job_type !== 'startup_founder',
        hideIfUnavailable: true,
        effect: (s) => {
          const curLevel = s.level || (s.job_type === 'ai_research' ? 'MTS' : s.is_phd ? 'L4' : 'L3');
          const lastPromoAge = s.last_promo_age ?? (s.age - 1);
          const yearsInGrade = s.age - lastPromoAge;

          // 自然晋升只到 L4 (及格线内成熟); L5 Senior 及以上不再靠按部就班自然给, 必须通过【疯狂内卷】冲刺。
          if (curLevel === 'L3' && ((yearsInGrade >= 2 && s.leetcode >= 30) || (yearsInGrade >= 1 && s.leetcode >= 40))) {
            return {
              mid_year: true, season_stage: 'h1',
              level: 'L4', tc: s.tc + 3.5, last_promo_age: s.age,
              health: Math.min(100, s.health + 12),
              story_flags: { ...(s.story_flags || {}), annual_action: 'wlb' },
              message: '【稳健及格·水到渠成升 L4】在按部就班完成本职需求的同时，凭借扎实的日常工程交付水到渠成晋升 L4 工程师！总包调升 +$3.5w！',
            };
          }

          const wlbChillMessages = [
            '【按部就班 · 稳健及格】你准时打卡下班、拒绝内耗，高质量完成了 Sprint 范围内的既定需求 (Meets Bar 60分及格)。体能与精神完全恢复满格！',
            '【拒绝内卷 · 惬意生活】面对复杂的跨组撕逼你果断按时下班，把精力留给健身与生活，身心恢复到最佳状态，平稳拿到本年度目标考评。',
            '【平稳交付 · 零事故】线上服务集群平稳运行，你在优雅完成日常任务的同时，每天下午在园区草坪散步，体能完全回满！',
          ];
          const chillMsg = wlbChillMessages[Math.floor(gameRandom() * wlbChillMessages.length)];

          return {
            mid_year: true, season_stage: 'h1',
            health: Math.min(100, s.health + 14),
            story_flags: { ...(s.story_flags || {}), annual_action: 'wlb' },
            message: chillMsg,
          };
        },
        nextEventId: (s) => (s.last_promo_age === s.age && s.level === 'L4' ? 'promo_celebration' : h1ToH2Router(s)),
      },
      {
        text: '【申请内部转组 · 换道破局】逃离 toxic 老板 / 冲高能见度核心组 / 转低压养生组 (改变后续赛道)',
        // 3-year cooldown: internal mobility isn't a yearly toy — prevents farming the
        // ai_core +impact / free PIP-clear every single year. big_tech-only: internal
        // mobility to a separate core org is a big-company mechanic (redundant for an
        // ai_research lab employee who is already frontier-AI, and cn_tech/startup have
        // no such internal-transfer system).
        condition: (s) => !s.laid_off && s.job_type === 'big_tech' && (!s.story_flags?.last_transfer_year || (s.year - Number(s.story_flags.last_transfer_year)) >= 3),
        hideIfUnavailable: true,
        effect: (s) => ({
          story_flags: { ...(s.story_flags || {}), annual_action: 'transfer' },
          message: '你提交了内部转组申请，HR 与 Internal Mobility 系统向你展示了当前开放的转组去向：',
        }),
        nextEventId: 'internal_team_transfer',
      },
      {
        text: '【拓展副业】探索第二曲线 (微型SaaS/专家顾问/自媒体/实体合伙)',
        condition: (s) => !s.laid_off && s.job_type !== 'unemployed' && s.job_type !== 'trader' && s.job_type !== 'startup_founder' && !s.story_flags?.side_hustle_canceled,
        effect: () => ({ message: '你梳理了自己的核心技能与业余时间，准备在硅谷拓展属于自己的第二曲线副业！' }),
        nextEventId: 'side_hustle_hub',
      },
      // NOTE: Founder & Trader annual decisions live in founder_annual_strategy /
      // trader_annual_strategy (year-end settlement routes those roles straight there); this
      // generic panel is for employees + gap-year/unemployed exploration. Choices below are
      // grouped for readability only (pure array order, no mechanic change):
      // 年度主线重心 → 生活与资产 → 职业转型 → 待业/Gap Year.

      // --- 年度主线重心 (续)：投资 / 社交 / 躺平 (与上方 内卷 / 刷题 / 副业 同属年度精力分配) ---
      {
        text: '【投资理财】研究美股财报与大盘，寻找重仓暴富机会',
        reqBadge: '需现金 >= $15w',
        condition: (s) => s.cash >= 15 && s.job_type !== 'trader',
        effect: (s) => ({
          mid_year: true, season_stage: 'h1',
          health: Math.max(0, s.health - 15),
          message: '今年你花了大把时间盯盘、听财报电话会，试图在股市中加速财务自由！'
        }),
        nextEventId: 'stock_market_annual_gamble',
      },
      {
        text: '【经营人际】把这一年的重心放在人与人的连接：朋友 / 社区 / 家庭 / 姻缘',
        condition: (_s) => true,
        effect: (_s) => ({
          mid_year: true, season_stage: 'h1',
          message: '你决定这一年多花心思在人际连接上——深耕友情社区、陪伴家人，或认真寻觅良缘。'
        }),
        // 人人都进「经营人际」枢纽:朋友/社区对所有人开放,单身/未婚在枢纽内多一个相亲入口 (→ dating_market),
        // 有伴侣的多一个陪伴家人。
        nextEventId: 'active_social_life',
      },

      // --- 生活与资产：置业安家 (首付达标时可见，完成后返回工作重心) ---
      {
        text: '【置业安家】进军湾区加价抢房大乱斗 (Sunnyvale老破小/San Jose联排/Fremont学区房)',
        // 置业是资产配置,不占用当年职场主行动(买完回到本面板继续选工作重心);每年至多进入一次。
        condition: (s) => (s.cash + (s.stocks || 0)) >= 40 && !s.has_housing && s.last_housing_action_year !== s.year,
        hideIfUnavailable: true,
        effect: () => ({ message: '你准备好了首付款支票，踏入了火热的湾区 Open House 抢房战场！' }),
        nextEventId: 'buy_house',
      },

      // --- 职业转型：离职去全职操盘 / 创业 (需身份/资金门槛) ---
      {
        text: '【离职全职 Day Trader】凭 $50w 本金与美籍/绿卡自由身全职操盘',
        reqBadge: '需美籍/绿卡 + 现金 >= $50w',
        condition: (s) => (s.visa === '绿卡' || s.visa === '公民') && s.cash >= 50 && s.job_type !== 'trader' && s.job_type !== 'startup_founder',
        effect: (_s) => ({
          job_type: 'trader',
          company: '全职 Day Trader',
          level: '全职 Trader',
          tc: 0,
          laid_off: false,
          message: '你正式递交了离职辞呈！凭 $50w 初始本金与美籍/绿卡自由身，开启了全职 Day Trader 操盘人生！'
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '【离职全职 AI/科技创业】拒绝大厂打工，前往 Sand Hill Road (沙丘路) 寻找 VC 融资',
        reqBadge: '需美籍/绿卡/O-1 或现金 >= $45w',
        condition: (s) => ((s.visa === '绿卡' || s.visa === '公民' || s.visa === 'O1 (杰出人才)') || s.cash >= 45) && s.job_type !== 'trader' && s.job_type !== 'startup_founder',
        effect: (s) => {
          const needsO1 = s.visa !== '绿卡' && s.visa !== '公民' && s.visa !== 'O1 (杰出人才)';
          return {
            job_type: 'startup_founder',
            company: 'AI/科技 Startup',
            level: 'CEO & Founder',
            tc: 6,
            founder_stage: 'pre_seed',
            company_valuation: 180,
            laid_off: false,
            impact: addImpact(s, 10),
            cash: needsO1 ? s.cash - 5 : s.cash,
            visa: needsO1 ? 'O1 (杰出人才)' : s.visa,
            message: needsO1
              ? '你拒绝了稳健的大厂打工路，花 $5w 律师费办妥了 O1-A 创业杰出人才工签，在 San Mateo 租下一间 Garage，以 $180w Pre-Seed 估值开启了全职 Founder 极客创业！'
              : '你拒绝了稳健的大厂打工路，凭自由身份在 San Mateo 租下一间 Garage，以 $180w Pre-Seed 估值开启了全职 Founder 极客创业！'
          };
        },
        nextEventId: h1ToH2Router,
      },

      // --- 待业 / Gap Year 探索 (仅失业或待业时可见) ---
      {
        text: '【慢生活深度休养：红木森林徒步、瑜伽与环球旅行】彻底远离内卷与焦虑 (花费 $0.5w)',
        condition: (s) => Boolean(s.laid_off || s.job_type === 'unemployed' || !s.job_type),
        hideIfUnavailable: true,
        effect: (s) => ({
          mid_year: true, season_stage: 'h1',
          health: Math.min(100, s.health + 22),
          charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 3),
          cash: Math.max(0, parseFloat((s.cash - 0.5).toFixed(1))),
          story_flags: {
            ...(s.story_flags || {}),
            in_gap_year: true
          },
          message: '【身心深度治愈】你彻底放下了所有职场内卷与焦虑，每天睡到自然醒、徒步红木森林、去夏威夷看海。身体与精神状态重获新生！'
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '【潜心独立开发：打造微型 SaaS 与开源 Agent 工具】低成本探索被动收益与黑客乐趣',
        condition: (s) => Boolean(s.laid_off || s.job_type === 'unemployed' || !s.job_type),
        hideIfUnavailable: true,
        effect: (s) => ({
          mid_year: true, season_stage: 'h1',
          health: Math.min(100, s.health + 8),
          leetcode: s.leetcode + 5,
          impact: addImpact(s, 5),
          cash: parseFloat((s.cash + 2).toFixed(1)),
          story_flags: {
            ...(s.story_flags || {}),
            in_gap_year: true
          },
          message: '【独立黑客探索】你在 GitHub 上开源的实用开发者小工具收获了 2k+ Stars，并获得了几家早期赞助与小额被动收益！'
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '【结束 Gap Year：重返职场】满血状态启动简历海投，备战大厂面试',
        condition: (s) => Boolean(s.laid_off || s.job_type === 'unemployed' || !s.job_type),
        hideIfUnavailable: true,
        // 求职即本年度动作:必须置 mid_year/season_stage,让整条「求职→再就业→选房」链纳入年度季度
        // 事件机、走到年终结算,而非再就业后回落 sv_daily_life 在同一结算周期内再做一次年度动作
        // (会与 H1 注入叠加成 job_hop_market 同回合三连 → fuzz SEED=990 死循环)。
        effect: (s) => ({
          mid_year: true,
          season_stage: 'h1',
          story_flags: {
            ...(s.story_flags || {}),
            in_gap_year: false
          },
          message: '身心满血恢复！你重新打开了 LinkedIn 与简历，准备以最佳精神面貌进军湾区职场！'
        }),
        nextEventId: 'job_hunt',
      }
    ]
  },

  'side_hustle_hub': {
    id: 'side_hustle_hub',
    title: '【硅谷副业宇宙】多元被动收入与第二曲线',
    description: '湾区打工人深谙“鸡蛋不能放在同一个篮子里”。结合你当前的算法、颜值、职级与资金实力，选择你今年的副业赛道：',
    choices: [
      {
        text: '【极客出海 · 独立开发 Micro-SaaS 与 AI 工具】(依赖算法实力 · 产出 Impact 与被动现金流)',
        reqBadge: '需 LeetCode >= 30',
        condition: (s) => s.leetcode >= 30,
        effect: (s) => {
          const winRate = 0.20 + (s.leetcode / 250) + ((s.luck || 20) / 400);
          const roll = gameRandom();
          if (roll < 0.12 + (s.leetcode / 400)) {
            // 大爆发：在 Acquire.com 被收购或 Product Hunt 登顶
            const buyout = parseFloat((25 + (s.leetcode / 5)).toFixed(1));
            return {
              mid_year: true, season_stage: 'h1',
              cash: parseFloat((s.cash + buyout).toFixed(1)),
              leetcode: s.leetcode + 4,
              impact: addImpact(s, 8),
              health: Math.max(0, s.health - 12),
              message: `【独立开发大爆发】你开发的 AI 工作流小工具在 Product Hunt 斩获当月第一名！被一家海外私募机构以 $${buyout}w 美元现金全资收购！项目产出与算法实力声名远扬！`
            };
          }
          if (roll < winRate) {
            // 稳健订阅：MRR 持续增长
            const mrrIncome = parseFloat((6.0 + ((s.leetcode - 30) / 15)).toFixed(1));
            return {
              mid_year: true, season_stage: 'h1',
              cash: parseFloat((s.cash + mrrIncome).toFixed(1)),
              leetcode: s.leetcode + 3,
              impact: addImpact(s, 5),
              health: Math.max(0, s.health - 10),
              message: `【稳定的 MRR 现金流】你的微型 SaaS 工具积累了 500+ 付费订阅开发者，本年度获得 +$${mrrIncome}w 净被动收益！手艺打磨与技术影响力稳步提升！`
            };
          }
          return {
            mid_year: true, season_stage: 'h1',
            cash: Math.max(0, parseFloat((s.cash - 0.5).toFixed(1))),
            leetcode: s.leetcode + 5,
            health: Math.max(0, s.health - 8),
            message: '【技术实战沉淀】独立开发的项目暂未跑通 PMF，扣除了云服务器账单 -$0.5w，但在全栈独立迭代中算法与架构能力明显精进！'
          };
        },
        nextEventId: h1ToH2Router,
      },
      {
        text: '【高阶咨询 · 初创 Part-time Advisor & 求职私教】(需 L5+资深架构 或 广泛行业人脉)',
        reqBadge: '需 L5+/资深人脉',
        condition: (s) => Boolean(s.level?.includes('L5') || s.level?.includes('Senior') || s.level?.includes('L6') || s.level?.includes('Staff') || s.level?.includes('L7') || s.level?.includes('L8') || s.level?.includes('MTS') || (s.network || 10) >= 25),
        effect: (s) => {
          const successChance = 0.35 + ((s.network || 10) / 200) + ((s.charm || 10) / 200);
          const isTopAdvisor = gameRandom() < Math.min(0.80, successChance);
          if (isTopAdvisor) {
            const advisorFee = parseFloat((8.0 + ((s.network || 10) / 20)).toFixed(1));
            return {
              mid_year: true, season_stage: 'h1',
              cash: parseFloat((s.cash + advisorFee).toFixed(1)),
              network: Math.min(100, (s.network || 10) + 6),
              impact: addImpact(s, 6),
              health: Math.max(0, s.health - 8),
              message: `【明星顾问津贴】你凭借大厂资深架构背书，受聘为两家种子轮 AI 初创的技术顾问并带教上岸学员，斩获 +$${advisorFee}w 顾问咨询费与宝贵行业人脉！`
            };
          }
          return {
            mid_year: true, season_stage: 'h1',
            cash: parseFloat((s.cash + 4.5).toFixed(1)),
            network: Math.min(100, (s.network || 10) + 3),
            health: Math.max(0, s.health - 6),
            message: '【求职辅导稳健创收】周末利用业余时间辅导了数名转码留学生，扎实的 1v1 Mock 面试为你带来了 +$4.5w 丰厚课时费！'
          };
        },
        nextEventId: h1ToH2Router,
      },
      {
        text: '【流量自媒体 · 小红书/YouTube 硅谷大厂日常博主】(依赖形象魅力 Charm · 广告代言变现)',
        condition: () => true,
        effect: (s) => {
          const charmVal = s.charm || 10;
          const viralChance = 0.15 + (charmVal / 60) + ((s.luck || 20) / 400);
          const roll = gameRandom();
          if (charmVal >= 16 && roll < 0.15) {
            return {
              mid_year: true, season_stage: 'h1',
              cash: parseFloat((s.cash + 18.0).toFixed(1)),
              charm: Math.min(s.max_charm ?? 25, charmVal + 3),
              health: Math.max(0, s.health - 8),
              message: '【全网爆火出圈】你在小红书和 B站 分享的“硅谷大厂硬核生存与薪资大揭秘”单条播放量破 500 万！斩获大批科技品牌年框代言，狂赚 +$18.0w！'
            };
          }
          if (roll < viralChance) {
            const adIncome = parseFloat((4.0 + (charmVal * 0.3)).toFixed(1));
            return {
              mid_year: true, season_stage: 'h1',
              cash: parseFloat((s.cash + adIncome).toFixed(1)),
              charm: Math.min(s.max_charm ?? 25, charmVal + 1),
              health: Math.max(0, s.health - 8),
              message: `【稳定接单变现】自媒体账号稳步涨粉，接了数单猎头招聘与数码产品商单，轻轻松松净赚 +$${adIncome}w 广告费！`
            };
          }
          return {
            mid_year: true, season_stage: 'h1',
            health: Math.max(0, s.health - 10),
            charm: Math.min(s.max_charm ?? 25, charmVal + 1),
            message: '【遭遇限流吐槽】辛辛苦苦拍摄剪辑的视频遭遇平台算法限流，还在评论区遇到了键盘侠杠精，身心俱疲但积累了镜头感。'
          };
        },
        nextEventId: h1ToH2Router,
      },
      {
        text: '【实体投资 · Fremont/Cupertino 华人奶茶烘焙店合伙】合伙入股热门商圈餐饮门店，博取被动分红',
        reqBadge: '需现金 >= $5w',
        condition: (s) => s.cash >= 5,
        effect: (s) => {
          const isBull = s.macro_economy === 'bull';
          const isBear = s.macro_economy === 'bear';
          const winRate = isBull ? 0.65 : (isBear ? 0.30 : 0.48);
          const win = gameRandom() < winRate;
          if (win) {
            return {
              mid_year: true, season_stage: 'h1',
              cash: parseFloat((s.cash - 5 + 8.5).toFixed(1)),
              rental_income: (s.rental_income || 0) + 1.2,
              health: Math.max(0, s.health - 4),
              message: '【奶茶店大排长龙】你参股的南湾鲜果茶店开业爆火！首年收回投资并分红 $8.5w (净赚 $3.5w)，并确立了每年 +$1.2w 的稳健商业被动分红！'
            };
          } else if (!isBear && gameRandom() < 0.6) {
            return {
              mid_year: true, season_stage: 'h1',
              cash: parseFloat((s.cash - 5 + 5.5).toFixed(1)),
              health: Math.max(0, s.health - 4),
              message: '【保本微利平稳经营】奶茶店面对同街区竞争微利运转，首年拿回分红 $5.5w (小赚 $0.5w)。'
            };
          } else {
            return {
              mid_year: true, season_stage: 'h1',
              cash: parseFloat((s.cash - 5).toFixed(1)),
              health: Math.max(0, s.health - 6),
              message: '【同质化内卷闭店】湾区奶茶市场高度饱和，商圈价格战惨烈，门店入不敷出宣告清盘，前期出资 -$5.0w 遗憾打水漂。'
            };
          }
        },
        nextEventId: h1ToH2Router,
      },
      {
        text: '【暂不发展副业】返回年度主面板重新选择精力重心',
        effect: (s) => ({
          story_flags: { ...(s.story_flags || {}), side_hustle_canceled: true },
          message: '你决定先将精力集中在主线规划上。'
        }),
        nextEventId: 'sv_daily_life',
      },
    ]
  },

  'perf_review': {
    id: 'perf_review',
    title: '【年底考核】Perf Review 绩效评定与答辩',
    description: '又到了公司一年一度的 PSC 绩效考核时间，大家都开始疯狂抢 Project Impact 争夺升职名额。',
    choices: [
      {
        text: '【稳扎稳打】加班抢项目 Impact (争取 L4 / L5 升职)',
        condition: (s) => {
          const isWorking = !!s.job_type && s.job_type !== 'unemployed' && !s.laid_off;
          const cur = s.level || (s.job_type === 'ai_research' ? 'MTS' : s.is_phd ? 'L4' : 'L3');
          const norm = normalizeLevel(cur, s) || (s.is_phd ? 'L4' : 'L3');
          return isWorking && (norm === 'L3' || norm === 'L4');
        },
        effect: (s) => {
          const cur = s.level || (s.is_phd ? 'L4' : 'L3');
          const norm = normalizeLevel(cur, s) || (s.is_phd ? 'L4' : 'L3');
          const isL3 = norm === 'L3';
          const lastPromoAge = s.last_promo_age ?? (s.age - 1);
          const yearsInGrade = s.age - lastPromoAge;
          const isKingOfRoll = s.trait_title === '卷王之王';
          
          // L3 与 L4 难度较低
          const winProb = isL3 
            ? (yearsInGrade >= 2 ? 0.95 : 0.80) 
            : (yearsInGrade >= 3 ? 0.90 : 0.70);
          const win = isKingOfRoll || gameRandom() < winProb;
          const tcIncrease = isL3 ? 3.5 : 6.5;
          const nextLevel = isL3 ? 'L4' : 'L5 (Senior)';
          return win 
            ? { health: Math.max(0, s.health - 12), tc: s.tc + tcIncrease, level: nextLevel, impact: addImpact(s, isL3 ? 4 : 7), last_promo_age: s.age, message: `卷赢了！你拿到了 EE 绩效，成功晋升至 ${nextLevel}，总包调薪 +${tcIncrease} 万美元！` }
            : { 
                health: Math.max(0, s.health - 12),
                impact: addImpact(s, 3),
                npcs: {
                  ...(s.npcs || {}),
                  dave: s.npcs?.dave || { name: 'Manager Dave', role: 'manager', status: 'nemesis', note: '抢占你项目功劳的经理' }
                },
                story_flags: {
                  ...(s.story_flags || {}),
                  has_dave_evidence: true,
                  dave_conflict_year: s.year
                },
                message: '你辛辛苦苦写的核心文档被 Manager Dave 拿去汇报抢了功劳！好在你暗中留存了全部 Jira Commit 与 Slack 截图证据链，等待时机反击！' 
              };
        },
        // Route on the ACTUAL promotion (last_promo_age stamped this turn by the win
        // branch), NOT message.includes('晋升') — mirrors the L6 fix below and the fuzz
        // invariant「进入 *_celebration ⇒ last_promo_age===age」. The Dave-loss branch
        // never stamps last_promo_age, so it correctly routes on to h1ToH2Router.
        nextEventId: (s) => (s.last_promo_age === s.age && (s.level === 'L4' || s.level === 'L5 (Senior)') ? 'promo_celebration' : h1ToH2Router(s)),
      },
      {
        text: '【冲击 L6 Staff 架构师】主导跨组核心架构设计 (L5 升 L6 专属高门槛)',
        condition: (s) => {
          const cur = s.level || (s.is_phd ? 'L4' : 'L3');
          return normalizeLevel(cur) === 'L5 (Senior)' && meetsOrganicPromo(s, 'L6 (Staff)');
        },
        effect: (s) => {
          // L6 Staff 非常难；impact(影响力/项目产出)是 Staff 晋升的关键杠杆 —— 躺平(低 impact)几乎升不动。
          const winRate = 0.05 + ((s.charm || 10) / 100) * 0.15 + ((s.network || 10) / 100) * 0.15 + (s.leetcode / 100) * 0.06 + ((s.impact || 0) / 100) * 0.22;
          const win = gameRandom() < Math.min(0.24, winRate);
          return win 
            ? { level: 'L6 (Staff)', tc: s.tc + 12, health: Math.max(0, s.health - 15), impact: addImpact(s, 8), last_promo_age: s.age, message: '奇迹破局！你在晋升委员会 (Promo Committee) 手撕核心架构与跨团队沟通，打破硅谷天花板顺利晋升为 L6 Staff Engineer！总包 (TC) 暴涨 +12 万美元！' }
            : { health: Math.max(0, s.health - 15), impact: addImpact(s, 4), message: '晋升委员会否决了你的 L6 Staff 申请，认为你在部门影响力 (Impact) 与政治 Sponsorship 上仍缺一把火。白卷了一整年。' };
        },
        // Route on the ACTUAL level change, not message.includes('晋升') — the failure
        // message ("晋升委员会否决…") also contains 晋升, which wrongly triggered the
        // 职级大晋升喜报 celebration on a rejection.
        nextEventId: (s) => (s.level === 'L6 (Staff)' ? 'l6_staff_celebration' : h1ToH2Router(s)),
      },
      {
        text: '【角逐 L7 Senior Staff 资深架构师】统领跨部门级核心技术战略与下一代基建 (L6 升 L7 专属)',
        condition: (s) => {
          const cur = s.level || (s.is_phd ? 'L4' : 'L3');
          return normalizeLevel(cur) === 'L6 (Staff)' && meetsOrganicPromo(s, 'L7 (Senior Staff)');
        },
        reqBadge: '需 L6 职级 & LeetCode >= 70 & Impact >= 45',
        costBadge: '消耗健康与高阶政治与战略心智',
        effect: (s) => {
          const winRate = 0.05 + ((s.charm || 10) / 100) * 0.20 + ((s.network || 10) / 100) * 0.20 + (s.leetcode / 100) * 0.08 + ((s.impact || 0) / 100) * 0.25;
          // Cap so L7 stays rarer than the capped-0.24 L6 (was uncapped ~32-45%).
          const win = gameRandom() < Math.min(0.16, winRate);
          return win 
            ? { level: 'L7 (Senior Staff)', tc: s.tc + 20, health: Math.max(0, s.health - 15), impact: addImpact(s, 10), last_promo_age: s.age, message: ' 战略封神！你在跨部门架构评审中凭借高层 VP Sponsor 撑腰与无可撼动的技术领导力，正式晋升为 L7 Senior Staff Engineer 资深架构师！总包 (TC) 狂飙 +20 万美元！' }
            : { health: Math.max(0, s.health - 15), impact: addImpact(s, 5), message: '晋升委员会否决了你的 L7 Senior Staff 申请，认为你在高层政治阵营拉拢与全公司级战略视野上仍需深耕。白卷了一整年。' };
        },
        // Route on the ACTUAL level change (the rejection message also contains 晋升).
        nextEventId: (s) => (s.level === 'L7 (Senior Staff)' ? 'l7_senior_staff_celebration' : h1ToH2Router(s)),
      },
      {
        text: '【登顶 L8 Principal 首席架构师】定义行业技术范式与下一代算力/模型标准 (L7 升 L8 终极天堑)',
        condition: (s) => {
          const cur = s.level || (s.is_phd ? 'L4' : 'L3');
          return normalizeLevel(cur) === 'L7 (Senior Staff)' && meetsOrganicPromo(s, 'L8 (Principal)');
        },
        reqBadge: '需 L7 职级 & LeetCode >= 80 & Impact >= 80',
        costBadge: '消耗健康与终极政治心智',
        effect: (s) => {
          const winRate = 0.04 + ((s.charm || 10) / 100) * 0.15 + ((s.network || 10) / 100) * 0.15 + (s.leetcode / 100) * 0.05 + ((s.impact || 0) / 100) * 0.20;
          // Cap so L8 (Principal) stays the rarest band (was uncapped ~24-34%).
          const win = gameRandom() < Math.min(0.11, winRate);
          return win 
            ? { level: 'L8 (Principal)', tc: s.tc + 35, health: Math.max(0, s.health - 15), impact: addImpact(s, 12), last_promo_age: s.age, message: ' 硅谷传世神话！你在董事会闭门答辩中赢得 CEO 与顶级投资人一致肯定，破格受聘为全公司屈指可数的 L8 Principal Engineer 首席架构师/技术院士！年薪总包与期权暴涨 (+$35w TC)！' }
            : { health: Math.max(0, s.health - 15), impact: addImpact(s, 5), message: 'L8 职级名额受全公司顶层 Quota 严格限制，尽管你的产出极其卓越，但在董事会与高管派系答辩中仍以一票之差抱憾延期。白卷了一整年。' };
        },
        // Route on the ACTUAL level change (harden against the substring bug).
        nextEventId: (s) => (s.level === 'L8 (Principal)' ? 'l8_principal_celebration' : h1ToH2Router(s)),
      },
      {
        text: '【准点下班佛系保命】准点下班，躺平拿 Meets (保重身体)',
        condition: (s) => !!s.job_type && s.job_type !== 'unemployed' && !s.laid_off,
        effect: (s) => ({ health: Math.min(100, s.health + 10), message: '你按时下班，维持着普通的绩效，拿了标准的工资，身心愉悦。' }),
        nextEventId: h1ToH2Router,
      }
    ]
  },

  'layoff_rumor': {
    id: 'layoff_rumor',
    title: '【风雨欲来】Blind 裁员谣言与恐慌蔓延',
    description: '有一天，Blind 上传出你们部门要被整个裁掉的消息，人心惶惶。',
    choices: [

      {
        text: '【疯狂加班表忠心】疯狂加班，讨好 Manager 争取留队',
        effect: (s) => {
          let surviveRate = 0.4;
          if (s.leetcode >= 80) surviveRate = 0.8;
          const win = gameRandom() < surviveRate;
          return win 
            ? { health: s.health - 15, cash: s.cash, message: '你没日没夜地干活，终于在这个裁员季活了下来，但距离 Burnout 只有一步之遥。' }
            : { health: s.health - 10, cash: s.cash, laid_off: true, tc: 0, job_type: 'unemployed', message: '不管你怎么卷，你们整个组都被端了。你被裁员了！' };
        },
        nextEventId: (s) => s.laid_off ? 'layoff_hit' : h1ToH2Router(s),
      },
      {
        text: '【立刻狂刷算法题】立刻开始刷题备战跳槽，准备后路',
        effect: (s) => ({ leetcode: s.leetcode + 20, health: s.health - 10, cash: s.cash, laid_off: true, tc: 0, job_type: 'unemployed', message: '你偷偷在上班时间刷题。果不其然，你被裁了，但你已经做好了准备。' }),
        nextEventId: 'layoff_hit',
      }
    ]
  },

  'layoff_hit': {
    id: 'layoff_hit',
    title: '【裁员风暴】不幸中招与大礼包清算',
    description: '不幸遭遇了湾区科技公司大厂裁员潮，你抱着个人物品箱退出了 Slack。面对突如其来的失业与身份倒计时，请选择你的应对策略：',
    imageUrl: 'images/layoff_box.jpg',
    choices: [
      {
        text: '【美籍/绿卡玩家专属】领取 Severance 遣散费，全职刷题无忧备战',
        condition: (s) => s.visa === '绿卡' || s.visa === '公民',
        effect: (s) => ({
          cash: s.cash + 8,
          laid_off: false,
          tc: 0,
          job_type: 'unemployed',
          health: Math.min(100, s.health + 15),
          leetcode: Math.min(100, s.leetcode + 15),
          message: '手握美籍/绿卡无所畏惧！你拿到了 3 个月 Severance 遣散费 (+$8w)，在家一边散步一边刷题，从容准备下一家大厂 Offer！'
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '【美籍/绿卡玩家专属】申请加州 EDD 失业金，休假半年放空身心',
        condition: (s) => s.visa === '绿卡' || s.visa === '公民',
        effect: (s) => ({
          cash: s.cash + 3,
          laid_off: false,
          tc: 0,
          job_type: 'unemployed',
          health: Math.min(100, s.health + 25),
          message: '领着加州 EDD 官方失业补贴，你顺便休假半年去 Lake Tahoe 滑雪，心态极度放松！'
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '【强力人脉救援】联系 LinkedIn 熟人总监直通内部免试 referral 上岸',
        reqBadge: '需深厚熟人关系',
        condition: (s) => (s.network || 0) >= 35,
        effect: (s) => {
          const rescueCompanies = [
            { company: 'google', name: 'Google' },
            { company: 'apple', name: 'Apple' },
            { company: 'meta', name: 'Meta' },
            { company: 'microsoft', name: 'Microsoft' }
          ];
          const rescue = rescueCompanies[Math.floor(gameRandom() * rescueCompanies.length)];
          return {
            // Rescue TC tracks the retained level (was a flat 22 = new-grad band,
            // since tc is 0 at layoff — a former L6 shouldn't be rescued at $22w).
            tc: getLevelScaledTC(22, hopTargetLevel(s)),
            level: hopTargetLevel(s),
            company: rescue.company,
            job_type: 'big_tech',
            laid_off: false,
            health: Math.min(100, s.health + 10),
            network: Math.min(100, (s.network || 0) + 5),
            message: `人脉发威！你的熟人总监收到求助后连夜开绿灯将你内推拉入 ${rescue.name} 团队，跳过倒计时直接上岸！`
          };
        },
        nextEventId: h1ToH2Router,
      },
      {
        text: '【F-1 / OPT 身份】利用 90/150 天失业期额度疯狂刷题，火速投递 E-Verify 新公司',
        condition: (s) => s.visa === 'OPT (实习)' || s.visa === 'F1 (学生)',
        effect: (s) => {
          const pass = s.leetcode >= 45 || gameRandom() < 0.55;
          const targetLvl = hopTargetLevel(s);
          const newTC = getLevelScaledTC(22, targetLvl);
          return pass
            ? { tc: newTC, level: targetLvl, job_type: 'big_tech', laid_off: false, cash: Math.max(0, s.cash - 1), health: Math.max(0, s.health - 15), message: `【OPT 成功上岸】利用 90 天 OPT 失业期窗口，你的算法实力征服了面试官，火速拿下支持 E-Verify 的新 Offer (定级 ${targetLvl} · 年薪 ${newTC}w)，成功延续 OPT 身份！` }
            : { status: 'game_over', message: '90 天 OPT 失业期耗尽，且未能及时挂靠转学，SEVIS 状态失效被迫登机回国。' };
        },
        nextEventId: (s) => s.status === 'game_over' ? 'end' : h1ToH2Router(s),
      },
      {
        text: '【F-1 / OPT 转学自救】失业期告急，紧急注册 Day 1 CPT 大学维持 SEVIS 身份 (消耗 $1.5w)',
        condition: (s) => (s.visa === 'OPT (实习)' || s.visa === 'F1 (学生)') && s.cash >= 1.5,
        effect: (s) => ({
          visa: 'Day 1 CPT',
          cash: s.cash - 1.5,
          laid_off: false,
          tc: 0,
          job_type: 'unemployed',
          leetcode: s.leetcode + 15,
          health: Math.min(100, s.health + 5),
          message: '【无缝转 Day 1 CPT】面对 OPT 失业期倒计时，你果断注册了 Day 1 CPT 大学维持合法留美学生身份，从容全职刷题准备下一轮跳槽面试！'
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '【H-1B 工签身份】利用 60 天 H1B Grace Period 极限刷题办理 H1B Transfer',
        condition: (s) => s.visa === 'H1B (工签)' || s.visa === 'L1 (外派)' || s.visa === 'O1 (杰出人才)',
        effect: (s) => {
          const pass = s.leetcode >= 55 || gameRandom() < 0.50;
          const targetLvl = hopTargetLevel(s);
          const newTC = getLevelScaledTC(24, targetLvl);
          return pass
            ? { tc: newTC, level: targetLvl, job_type: 'big_tech', laid_off: false, cash: Math.max(0, s.cash - 2), health: Math.max(0, s.health - 15), visa: (s.visa === 'L1 (外派)' ? resolveHopVisaTransition(s).visa : s.visa) as GameState['visa'], message: `【工签 Transfer 成功】有惊无险！凭高超算法在 60 天限期内火速入职新公司 (定级 ${targetLvl} · 年薪 ${newTC}w) 并成功办理工签 Transfer 保住合法身份！` }
            : { status: 'game_over', message: '没能在 60 天 H1B Grace Period 内找到支持 Visa Transfer 的新工作，工签身份到期被迫登机离境。' };
        },
        nextEventId: (s) => s.status === 'game_over' ? 'end' : h1ToH2Router(s),
      },
      {
        text: '【工签紧急挂靠】60 天倒计时逼近，找外包 ICC 公司办理 H1B Transfer 挂靠 (消耗 $2w)',
        condition: (s) => (s.visa === 'H1B (工签)' || s.visa === 'L1 (外派)' || s.visa === 'O1 (杰出人才)') && s.cash >= 2,
        effect: (s) => ({
          cash: s.cash - 2,
          company: 'icc',
          tc: 14,
          laid_off: false,
          job_type: 'startup',
          health: Math.max(0, s.health - 10),
          visa: (s.visa === 'L1 (外派)' ? resolveHopVisaTransition(s).visa : s.visa) as GameState['visa'],
          story_flags: { ...(s.story_flags || {}), icc_hired: true },
          message: '外包中介连夜为你开具了紧急 Offer 办理了工签 Transfer！虽然总包大打折扣，但你的 60 天遣返警报成功解除！'
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '【工签转 Day 1 CPT】转为学生身份就读 Day 1 CPT 避险，全职备战大厂 (消耗 $1.5w)',
        condition: (s) => (s.visa === 'H1B (工签)' || s.visa === 'L1 (外派)' || s.visa === 'O1 (杰出人才)') && s.cash >= 1.5,
        effect: (s) => ({
          visa: 'Day 1 CPT',
          cash: s.cash - 1.5,
          laid_off: false,
          tc: 0,
          job_type: 'unemployed',
          leetcode: s.leetcode + 15,
          message: '你将身份转为 Day 1 CPT 维持合法停留，解除 60 天遣返倒计时，开始全职闭关刷题！'
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '【Day 1 CPT 专属】学籍在册无离境倒计时压力，边上课边全职刷题求职',
        condition: (s) => s.visa === 'Day 1 CPT',
        effect: (s) => ({
          laid_off: false,
          tc: 0,
          job_type: 'unemployed',
          leetcode: s.leetcode + 15,
          health: Math.min(100, s.health + 5),
          message: '【学籍保护】由于你早已挂靠在 Day 1 CPT 大学，完全不受 60 天工签驱逐威胁！你按部就班上课并全职刷题准备下一家面试。'
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '【钞能力 EB-5 自救】全额出资申办 EB-5 投资移民并递交 I-485 拿 Combo 卡 (花费 $80w)',
        reqBadge: '需现金 >= $80w',
        condition: (s) => (s.cash + (s.stocks || 0)) >= 80 && s.visa !== '绿卡' && s.visa !== '公民',
        effect: (s) => ({
          visa: '绿卡',
          gc_progress: 5,
          gc_stage: 'approved',
          cash: s.cash - 80,
          laid_off: true,
          tc: 0,
          job_type: 'unemployed',
          message: '凭雄厚资金实力，全额出资 $80w 办妥新法 EB-5 投资移民绿卡！彻底甩开所有身份枷锁，自由留美找工！'
        }),
        nextEventId: 'post_green_card',
      }
    ]
  },

  'friday_pip': {
    id: 'friday_pip',
    title: '【周五惊魂】下午四点的 1:1 与 PIP 预警',
    description: '你的 Manager 突然在周五下午 4 点给你发了个 "Quick Sync" 的日历邀请。会上，他用着毫无感情的 corporate 语调表示你的 "impact" 没有 "move the needle"，并将你放入了为期 30 天的 Focus/PIP 计划。',
    choices: [
      {
        text: '【王牌证据反杀】拿出暗中备份的 40 页 Commit 与沟通记录直接上报 HR 与 VP！',
        condition: (s) => !!s.job_type && s.job_type !== 'unemployed' && !s.laid_off && !!s.story_flags?.has_dave_evidence,
        hideIfUnavailable: true,
        reqBadge: '需掌握证据链',
        effect: (s) => ({
          tc: s.tc + 5,
          health: Math.min(100, s.health + 10),
          charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 3),
          npcs: {
            ...(s.npcs || {}),
            dave: { name: 'Manager Dave', role: 'manager', status: 'nemesis', note: '被你反杀的职场宿敌' }
          },
          story_flags: {
            ...(s.story_flags || {}),
            dave_defeated: true,
            dave_defeated_year: s.year
          },
          message: '【绝地反杀】HR 廉政合规调查组介入，查实该 PIP 属于恶意打击报复！你的 PIP 被当场撤销，Manager 被调岗，公司为你补发了绩效调薪！'
        }),
        nextEventId: h1ToH2Router
      },
      {
        text: '【认怂狂暴加班】疯狂加班补救，极力证明自己的 Synergy 价值',
        condition: (s) => !!s.job_type && s.job_type !== 'unemployed' && !s.laid_off,
        effect: (s) => {
          const isHighPipCompany = s.company === 'amazon' || s.company === 'meta';
          const hasNetworkProtection = (s.network || 0) >= 30;
          const passProb = hasNetworkProtection ? 0.95 : (isHighPipCompany ? 0.55 : 0.80);
          const survived = gameRandom() < passProb;
          return survived
            ? { 
                health: Math.max(0, s.health - 15), 
                network: Math.min(100, (s.network || 0) + 3),
                message: hasNetworkProtection 
                  ? '人脉发威！组里多位熟人大佬与总监联名向上层打包票，判定你成功走出 PIP！' 
                  : '你每天工作 16 小时狂补 Deliverables，终于熬过了 PIP 考核！但深感身心俱疲。' 
              }
            : { health: Math.max(0, s.health - 15), tc: 0, laid_off: true, job_type: 'unemployed', message: '你熬了几个通宵，最后还是被 Manager 找借口未达标开除了。' };
        },
        nextEventId: h1ToH2Router
      },
      {
        text: '【拿钱走人全职刷题】领取 2 个月 Severance 离职大礼包，在家全职刷题',
        condition: (s) => !!s.job_type && s.job_type !== 'unemployed' && !s.laid_off,
        effect: (s) => ({ 
          cash: s.cash + 4, 
          tc: 0, 
          laid_off: true,
          job_type: 'unemployed',
          leetcode: s.leetcode + 15,
          health: Math.min(100, s.health + 10),
          message: '【选择 Pivot 离职包】你不再和主管理论内耗，果断签字拿了 2 个月 Buyout 离职包 (+$4w) 体面走人！不再卷 PIP，压力瞬间释放！'
        }),
        nextEventId: (s) => (s.visa !== '绿卡' && s.visa !== '公民' && s.visa !== '无') ? 'layoff_hit' : 'job_hunt'
      },
      {
        text: '【工签紧急挂靠】启动 60 天 Grace Period 找外包公司办理 H1B Transfer (消耗 $2w)',
        condition: (s) => s.cash >= 2 && (s.visa === 'H1B (工签)' || s.visa === 'L1 (外派)' || s.visa === 'O1 (杰出人才)') && !!s.job_type && s.job_type !== 'unemployed' && !s.laid_off,
        effect: (s) => ({
          cash: s.cash - 2,
          company: 'icc',
          job_type: 'startup',
          tc: Math.max(10, Math.floor(s.tc * 0.55)),
          health: s.health - 15,
          visa: (s.visa === 'L1 (外派)' ? resolveHopVisaTransition(s).visa : s.visa) as GameState['visa'],
          message: '外包中介连夜为你开具了紧急 Offer 办理了工签 Transfer！虽然总包大幅跳水，但你的 60 天合法身份警报成功解除！'
        }),
        nextEventId: h1ToH2Router
      },
      {
        text: '【OPT / 工签转学自救】注册 Day 1 CPT 大学维持合法留美身份并刷题 (消耗 $1.5w)',
        condition: (s) => s.cash >= 1.5 && (s.visa === 'OPT (实习)' || s.visa === 'F1 (学生)' || s.visa === 'H1B (工签)') && !!s.job_type && s.job_type !== 'unemployed' && !s.laid_off,
        effect: (s) => ({
          visa: 'Day 1 CPT',
          cash: s.cash - 1.5,
          tc: 0,
          laid_off: true,
          job_type: 'unemployed',
          leetcode: s.leetcode + 15,
          health: Math.min(100, s.health + 5),
          message: '【无缝转 Day 1 CPT】面对裁员与身份压力，你果断注册了 Day 1 CPT 大学维持合法学生身份并全职刷题准备下一轮求职，完全不受 60 天工签遣返威胁！'
        }),
        nextEventId: 'job_hunt'
      },
      {
        text: '【钞能力 EB-5 自救】掏出 $80w 办理新法 EB-5 并双递交 (I-485)，拿 EAD Combo 卡解除 PIP 危机！',
        reqBadge: '需现金 >= $80w (无绿卡)',
        condition: (s) => (s.cash + (s.stocks || 0)) >= 80 && s.visa !== '绿卡' && s.visa !== '公民' && !!s.job_type && s.job_type !== 'unemployed' && !s.laid_off,
        effect: (s) => ({
          cash: s.cash - 80,
          gc_progress: 4.5,
          gc_stage: 'i485_pending',
          tc: 0,
          laid_off: true,
          job_type: 'unemployed',
          message: '【EB-5 双递交成功】你不伺候了！直接出资 $80w 办理新法 EB-5 投资移民并 Concurrent Filing 递交 I-485。3 个月内顺利拿到 EAD Combo 自由工卡！虽然正式实体绿卡尚在调查制卡（进入 I-485 Pending），但你已彻底解除 60 天离境警报，拥有自由合法身份！'
        }),
        nextEventId: 'job_hunt'
      }
    ]
  },

  'rto_wars': {
    id: 'rto_wars',
    title: '【考勤大战】RTO 强制回办公室与打卡风波',
     description: 'CEO 突然宣布全员每周必须在办公室打卡 3 天，否则直接取消奖金甚至开除！疫情后不少人搬去便宜的外州/远郊远程办公，如今 RTO 大棒落下，你的通勤与居住安排都要重新盘算，一场考勤博弈在所难免。',
    choices: [
      {
        text: '【回归湾区通勤】老老实实回到湾区就近租房/通勤，扛下高昂的居住成本 (房租至少 $4w)',
        condition: (s) => !!s.job_type && s.job_type !== 'unemployed' && !s.laid_off,
        effect: (s) => ({
          // 只上调不下调:已在昂贵湾区(房贷/高租)的玩家不会被"重置"成更低成本,
          // 远程/远郊搬回的玩家则要承担至少 $4w 的湾区居住成本。
          rent: Math.max(s.rent || 0, 4),
          health: s.health - 15,
          story_flags: { ...(s.story_flags || {}), rto_wars_seen: true },
          message: '你重新安排了湾区的通勤与住处，每个月的居住成本让你心如刀割，但至少保住了工作。'
        }),
        nextEventId: h1ToH2Router
      },
      {
        text: '【物理点击器代刷卡】网购物理点击器 + 托同事代刷工牌 (高风险)',
        condition: (s) => !!s.job_type && s.job_type !== 'unemployed' && !s.laid_off,
        effect: (s) => {
          const caught = gameRandom() < 0.3;
          return caught
            ? {
                tc: 0,
                laid_off: true,
                job_type: 'unemployed',
                health: s.health - 15,
                story_flags: { ...(s.story_flags || {}), rto_wars_seen: true },
                message: '你的代刷工牌行为被 HR 发现，直接以违纪名义当天开除！'
              }
            : {
                cash: s.cash + 5,
                charm: s.charm + 2,
                story_flags: { ...(s.story_flags || {}), rto_wars_seen: true },
                message: '成功瞒天过海！你一边拿着加州的工资，一边享受着外州的低物价。'
              };
        },
        nextEventId: (s) => s.laid_off ? 'job_hunt' : h1ToH2Router(s)
      },
      {
        text: '【硬刚 Manager 要求远程】硬刚 Manager：“要么让我 Remote，要么我走人！”',
        condition: (s) => !!s.job_type && s.job_type !== 'unemployed' && !s.laid_off,
        effect: (s) => {
          const win = s.leetcode >= 70 && gameRandom() < 0.5;
          return win
            ? {
                tc: s.tc + 2,
                charm: Math.min(s.max_charm ?? 25, s.charm + 5),
                story_flags: { ...(s.story_flags || {}), rto_wars_seen: true },
                message: '由于你是团队的核心骨干（High Performer），Manager 妥协了，给你申请了特殊的 Remote Exception！'
              }
            : {
                tc: 0,
                laid_off: true,
                job_type: 'unemployed',
                story_flags: { ...(s.story_flags || {}), rto_wars_seen: true },
                message: 'Manager 冷笑一声：“现在是买方市场，门在那边。” 你被解雇了。'
              };
        },
        nextEventId: (s) => s.laid_off ? 'job_hunt' : h1ToH2Router(s)
      }
    ]
  },

  'blind_team_tea': {
    id: 'blind_team_tea',
    title: '【Blind黑料】深夜吃瓜突然吃到自己头上',
    description: '深夜一点半，你躺在 Sunnyvale 的床上翻看 Blind。热榜第一条加红帖标题赫然写着：\n"Avoid Org [X] in [Company]: Micromanaging Director pip-ing top performers to hit quota, run before it is too late!"\n你越读越心惊——代号项目名、下周 Milestone 日期、以及下午 4 点死盯 Progress 的习惯……这说的特么不就是你的组？！',
    choices: [
      {
        text: '【匿名跟帖吐槽 TL】混水摸鱼匿名跟帖：“TC 380k，做过同组，TL 人格分裂确实坑”',
        // Anonymous-solidarity flavor now grants a little network and costs less health,
        // so it's a real alt to the "add on WeChat" option (was worse on charm AND health).
        effect: (s) => ({ charm: Math.min(s.max_charm ?? 25, s.charm + 2), network: Math.min(100, (s.network || 10) + 2), health: Math.max(0, s.health - 2), message: '你出了一口恶气，还在匿名区结识了几个同病相怜的战友，但第二天看到 Manager 脸色阴沉地在全员会强调“我们要加强团队信任与通力协作”。' }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【闭麦通宵狂刷算法】极度恐慌！连夜关摄像头，边开大会边狂刷 LeetCode',
        effect: (s) => ({ leetcode: Math.min(100, s.leetcode + 10), health: s.health - 15, message: '你吓得半夜爬起来刷了 6 道动态规划困难题，咖啡因过量导致心率达到了 130。' }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【私信交流面基同胞】私信发帖人交流，结果发现竟然是隔壁工位同胞',
        effect: (s) => ({ charm: Math.min(s.max_charm ?? 25, s.charm + 3), cash: Math.max(0, s.cash - 0.2), message: '你们在 Palo Alto 密谋了一下午抱团取暖指南，并交换了彼此的 Referral 资源库。' }),
        nextEventId: 'sv_year_end_settlement',
      }
    ]
  },

  'zoom_camera_off_leetcode': {
    id: 'zoom_camera_off_leetcode',
    title: '【多任务大师】“不好意思刚才我 Mute 了”',
    description: '部门 60 人的 Quarterly Architecture Review 线上大会正在进行。你关着摄像头、开启静音，一边听高管讲 AI Roadmap，一边全神贯注地切 LeetCode 困难题 #2097。\n突然 Principal Architect 话锋一转：“[你的名字]，针对刚才这个微服务重构方案，你觉得 Rust 和 Go 哪个更适合你们组？”',
    choices: [
      {
        text: '【老油条打太极】“抱歉刚才网络卡了……这要看 Trade-off，建议我们 Offline Align 一下”',
        effect: (s) => ({ charm: Math.min(s.max_charm ?? 25, s.charm + 2), message: '经典的硅谷废话太极！高管满意地点了点头，你成功保住了饭碗并继续写出 O(1) 空间复杂度的指针翻转。' }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【手滑共享力扣窗口】手滑点错！把 LeetCode Hard 解题窗口共享给了全会场 60 人！',
        effect: (s) => ({ health: s.health - 15, charm: Math.min(s.max_charm ?? 25, s.charm + 8), cash: s.cash + 10, message: '会议室内一片死寂。你把自己的社死截图匿名发到小红书《全员大会手滑投影了力扣Hard怎么破？》，收获 3 万点赞和 200 条求职 Referral 软广费！' }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【ChatGPT 念稿救场】3 秒把问题扔给 AI，照着念“High throughput, horizontal scalability”',
        effect: (s) => ({ leetcode: Math.min(100, s.leetcode + 5), tc: s.tc + 2, message: '高管赞叹你的技术深度，当场决定下季度让你负责这个高风险架构重组。' }),
        nextEventId: 'sv_year_end_settlement',
      }
    ]
  },

  'team_offsite': {
    id: 'team_offsite',
    title: '【部门团建】Tahoe / Hawaii 免费 Offsite 之旅',
    description: '部门老板今年预算充沛，全组飞往 Lake Tahoe 豪华雪山木屋与 Hawaii 夏威夷海滩，开启为期 3 天的公费 Team Offsite 度假！不用干活，全额报销，全组同事开启狂欢度假模式。',
    choices: [
      {
        text: '【打卡户外与极限运动】参加 Lake Tahoe 滑雪 / Hawaii 冲浪 & 纳帕酒庄品酒',
        effect: (s) => ({
          health: Math.min(100, s.health + 10),
          charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 1),
          message: '【爽玩雪山与海滩】打卡了顶级雪道与海滩冲浪！全额公费报销，身心得到了放松与充电 (健康 +10)！'
        }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【深夜酒吧与德州扑克】和组员喝精酿鸡尾酒、打德扑、聊湾区八卦与职场内幕',
        effect: (s) => ({
          network: Math.min(99, (s.network || 10) + 4),
          charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 2),
          health: Math.min(100, s.health + 5),
          message: '【八卦与社交收获】在晚宴酒桌与德扑桌上畅饮谈笑，拉近了与组内同事和小领导的关系，积累了宝贵的职场人际默契。'
        }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【奢华米其林与 SPA 纯躺平】睡到自然醒，吃爆公司全额报销的奢华海鲜米其林大餐',
        effect: (s) => ({
          health: Math.min(100, s.health + 12),
          cash: s.cash + 0.2,
          message: '【公费惬意躺平】抛开一切工作 Slack 消息，在奢华度假村享受 SPA 与米其林大餐，身心得到了良好恢复 (健康 +12)。'
        }),
        nextEventId: 'sv_year_end_settlement',
      }
    ]
  },

  'office_politics': {
    id: 'office_politics',
    title: '【职场暗战】办公室政治与向上管理',
    description: '没了绿卡约束，你决定在公司大干一场。现在公司空出了一个 Director 的位子，你的竞争对手是深谙 PPT 之道的印度同事 Raj。',
    choices: [
      {
        text: '【埋头写代码用实力说话】疯狂写代码，用硬核交付证明实力',
        effect: (s) => ({ health: Math.max(0, s.health - 15), leetcode: Math.min(100, s.leetcode + 5), charm: Math.max(0, (s.charm || 10) - 2), message: 'Raj 用你写的硬核代码做了一份精美的 PPT 向上汇报，他获得了晋升。你被边缘化，但硬核攻坚让你的算法功底更上一层楼，依旧手握高薪大包稳坐工位。' }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【高强度向上管理】放下 IDE，打开 PPT 开始高强度向上管理',
        condition: (s) => !s.laid_off && !!s.job_type && s.job_type !== 'unemployed',
        // No longer a deterministic +$30w no-brainer: it's a charm-scaled gamble
        // with a real failure branch, and the reward is a modest raise.
        effect: (s) => {
          const win = gameRandom() < Math.min(0.7, 0.15 + (s.charm || 10) * 0.03);
          return win
            ? { tc: (s.tc || 0) + 6, cash: s.cash + 4, charm: Math.min(s.max_charm ?? 25, s.charm + 2), message: '你顿悟了硅谷“向上管理”的精髓，精美 PPT 加上社交手腕打动了 VP，成功争取到了一笔可观的加薪与绩效奖金！' }
            : { health: Math.max(0, s.health - 12), charm: Math.max(0, s.charm - 2), message: '缺乏火候，你的汇报被对手当场挑出破绽，功劳全被同事占了，还搭上了信誉。' };
        },
        nextEventId: 'sv_year_end_settlement',
      }
    ]
  },

  'overemployed': {
    id: 'overemployed',
    title: '【身兼数职】OE 双倍全职诱惑与时间管理',
    description: '你在 Blind 上看到了一个神秘的 OE 社区。里面的人同时拿着 3 份全职远程工作的薪水（J1, J2, J3），年收入突破 100 万美元。你看着自己轻松的“养老厂”工作，有些心动。',
    choices: [
      {
        text: '【接下 J2 双倍薪酬】接下第二份全职工作 (J2)，赚取双倍 TC！',
        condition: (s) => s.job_type === 'big_tech',
        effect: (s) => {
          const caught = gameRandom() < 0.25;
          return caught
            ? { tc: 0, laid_off: true, job_type: 'unemployed', health: Math.max(0, s.health - 15), message: '你在 J1 的架构会上忘记静音，突然用 J2 的称呼回答了问题！两家公司的 HR 连夜拉平信息，你被双双开除！' }
            : { cash: s.cash + s.tc, health: Math.max(0, s.health - 15), leetcode: s.leetcode + 5, message: '你用两台电脑同时开会，成功拿到了双倍工资！但是巨大的上下文切换让你精神分裂。' };
        },
        // overemployed 是 H2 专属生活事件(仅注入 lifeEvents 池)。此前非被裁分支路由到
        // h1ToH2Router —— 但从 H2 再调 h1ToH2Router 会重跑一遍 H2 (→midYearEventRouter(h2)→
        // lifeEvents 池),同年可再次抽中 overemployed,导致「一年被邀两次 J2」的双触发。H2 事件
        // 结束应直接进年终结算。被裁则仍需当年求职自救 (job_hunt)。
        nextEventId: (s) => s.laid_off ? 'job_hunt' : 'sv_year_end_settlement'
      },
      {
        text: '【安分守己拒绝风险】算了吧，安分守己做好本职工作',
        effect: (s) => ({ health: Math.min(100, s.health + 5), message: '你拒绝了高危的诱惑，每天下午 3 点准时躺在沙发上看 Netflix，这就是 WLB。' }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'meta_tlm': {
    id: 'meta_tlm',
    title: '【卷王之王】Meta TLM 极限狂飙',
    description: '在 Meta，你不进则退。当上 Tech Lead Manager 后，手下管着 5 个人，每天被拉进无数个群，晚上 11 点还在回复印度总监的邮件。',
    choices: [
      {
        text: '【继续卷升职冲刺】继续卷升职 (冲击下一级别 M1 / L6 Staff)',
        condition: (s) => !!s.job_type && s.job_type !== 'unemployed' && !s.laid_off,
        effect: (s) => {
          const cur = s.level || 'L5 (Senior)';
          // 冲击 M1 / L6 Staff:只有 L5 Senior 能冲 (不可从 L3/L4 越级),且须 impact≥20 —— 与所有
          // 其它 L6 晋升门槛一致,避免零 impact 越级登顶。18% 成功率。
          const isEligible = (cur === 'L5 (Senior)' || cur === 'L5') && s.leetcode >= 60 && (s.network || 10) >= 20 && (s.impact || 0) >= 20;
          const win = isEligible && gameRandom() < 0.18;
          // A promotion must never LOWER pay: never below current, capped at the L6 band top.
          const newTc = Math.max(s.tc, Math.min(85, s.tc + 14));
          return win 
            ? { level: 'L6 (Staff)', last_promo_age: s.age, tc: newTc, health: Math.max(0, s.health - 15), impact: addImpact(s, 10), imageUrl: 'images/burnout.jpg', message: `你干掉了同组全部竞争对手，在严苛的委员会评审中突破天堑晋升为 Meta M1 / L6 Staff TLM！当前总包提升至 $${newTc.toFixed(1)}w！` }
            : { health: Math.max(0, s.health - 15), impact: addImpact(s, 3), imageUrl: 'images/burnout.jpg', message: '在 Meta 残酷的 TLM 竞争中，Staff 晋升名额被更高影响力的资深嫡系抢走，未能通过 L6 评审。' };
        },
        nextEventId: (s) => s.health <= 0 ? 'end' : h1ToH2Router(s),
      },
      {
        text: '【降薪跳槽养老】太累了，降薪跳槽去 Google/Apple 养老',
        condition: (s) => !!s.job_type && s.job_type !== 'unemployed' && !s.laid_off,
        effect: (s) => ({ tc: Math.max(26, s.tc - 8), company: 'google', health: Math.min(100, s.health + 20), visa: (s.visa === 'L1 (外派)' ? resolveHopVisaTransition(s).visa : s.visa) as GameState['visa'], message: '你受够了 Meta 的高压，降薪跳槽去了以 WLB 著称的养老大厂。虽然包裹略有回落，但终于有了生活。' }),
        nextEventId: h1ToH2Router,
      }
    ]
  },

  'meta_reorg_manager_left': {
    id: 'meta_reorg_manager_left',
    title: '【重组风暴】Manager 突然 Pursuing New Opportunities',
    description: '周一例行 All-hands 会议上，你的直属 Manager 突然宣布离职。新调来的 Manager 对你过去半年的成果完全不了解，把你正在负责的核心项目划给了他的亲信...',
    choices: [
      {
        text: '【主动约 1:1 展现价值】主动约新 Manager 1:1，带上 30 页 PPT 汇报展现价值',
        effect: (s) => ({ network: Math.min(100, (s.network || 0) + 5), health: Math.max(0, s.health - 10), impact: addImpact(s, 5), message: '你的主动与专业打动了新老板，成功保住了原本的项目 Owner 身份！' }),
        nextEventId: h1ToH2Router
      },
      {
        text: '【借机关摄像头刷题】彻底失望，借机关摄像头狂刷 LeetCode 准备跳槽',
        effect: (s) => ({ leetcode: Math.min(100, s.leetcode + 15), health: Math.max(0, s.health - 10), message: '你在摸鱼中狂刷了 50 道 Hard 题，算法功力大增，准备随时寻找下家！' }),
        nextEventId: h1ToH2Router
      }
    ]
  },

  'apple_vision_pro_demo': {
    id: 'apple_vision_pro_demo',
    title: '【空间计算】公司全面发力 Vision Pro 空间应用开发',
    description: '苹果发布 Vision Pro 后，VP 要求团队立刻将主站应用重构为空间计算版本。你拿到了组里唯一一台试用设备。',
    choices: [
      {
        text: '【领衔 Spatial App】自告奋勇担任 Head of Spatial App 领头人',
        effect: (s) => ({ tc: s.tc + 3, health: Math.max(0, s.health - 15), impact: addImpact(s, 8), message: '你成为了公司内部空间计算的第一专家，产品上线后获得了大批关注！总包获得增长！' }),
        nextEventId: h1ToH2Router
      },
      {
        text: '【按部就班写网页】体验后吐槽戴着颈椎酸痛，按部就班写网页版代码',
        effect: (s) => ({ health: Math.min(100, s.health + 5), message: '你维持了健康的生活节奏，避开了空间计算概念退潮后的热度崩塌。' }),
        nextEventId: h1ToH2Router
      }
    ]
  },

  'llm_datacenter_power_outage': {
    id: 'llm_datacenter_power_outage',
    title: '【机房事故】Santa Clara 数据中心跳闸，训练 2 周的模型中断',
    description: '周二凌晨 2 点，PagerDuty 尖锐狂响！公司在 Santa Clara 的 AI 数据中心因为酷暑供电过载跳闸，集群全部掉线。你训了 14 天的 100B 参数大模型没有及时存 Checkpoint...',
    choices: [
      {
        text: '【通宵手写恢复脚本】通宵 48 小时手写 Recovery 恢复脚本救回权重',
        effect: (s) => ({ leetcode: Math.min(100, s.leetcode + 10), health: Math.max(0, s.health - 15), impact: addImpact(s, 8), message: '凭借硬核的 Infra 恢复脚本，你奇迹般地挽回了 90% 的权重数据，VP 在 Slack 全员频道为你点赞！' }),
        nextEventId: h1ToH2Router
      },
      {
        text: '【果断甩锅 Infra 部门】果断甩锅给基础设施 Infra 部门，关掉手机继续睡觉',
        effect: (s) => ({ health: Math.min(100, s.health + 10), network: Math.max(0, (s.network || 0) - 3), message: '第二天 Infra 组扛下了所有责任，你虽然保住了睡眠，但跟 Infra 组领队关系降到了冰点。' }),
        nextEventId: h1ToH2Router
      }
    ]
  },

  'agent_hallucination_prod_disaster': {
    id: 'agent_hallucination_prod_disaster',
    title: '【AI 幻觉事故】自主 Agent 生产环境误删数据库',
    description: '组里尝试用自主 Agent 跑 CI/CD 自动部署，结果 Agent 产生幻觉在脚本里执行了 DROP DATABASE，把生产环境数据库给删了！',
    choices: [
      {
        text: '【通宵手写 SQL 恢复】通宵手写 SQL 脚本与备份恢复',
        effect: (s) => ({
          leetcode: Math.min(100, s.leetcode + 10),
          health: Math.max(0, s.health - 15),
          impact: addImpact(s, 8),
          story_flags: { ...(s.story_flags || {}), agent_prod_disaster_seen: true },
          message: '凭借硬核的数据库恢复功底，你连夜恢复了绝大部分备份，保住了生产环境！'
        }),
        nextEventId: h1ToH2Router
      },
      {
        text: '【甩锅大模型供应商】支付一笔补偿金把锅甩给大模型 API 供应商 (消耗 $0.5w)',
        condition: (s) => s.cash >= 0.5,
        effect: (s) => ({
          network: Math.max(0, (s.network || 0) - 2),
          cash: Math.max(0, s.cash - 0.5),
          story_flags: { ...(s.story_flags || {}), agent_prod_disaster_seen: true },
          message: '虽然倒贴了一些补偿金，但团队把主要责任交给了云端模型供应商的幻觉缺陷。'
        }),
        nextEventId: h1ToH2Router
      }
    ]
  },

  'high_level_reorg_domain_loss': {
    id: 'high_level_reorg_domain_loss',
    title: '【高阶重组】VP 换人导致 Architecture 推翻，Domain Knowledge 清零',
    description: '公司高层爆发权斗，新上任的 VP 带来了自己的亲信。你带领团队搭建了三年的核心系统架构被宣布“全盘废弃，全面拥抱新架构”！多年积累的领域知识 (Domain Knowledge) 一夕沉没...',
    choices: [
      {
        text: '【重头学习最新架构】通宵加班重头学习最新 Infra 业务架构',
        effect: (s) => ({ health: Math.max(0, s.health - 15), leetcode: Math.min(100, s.leetcode + 10), impact: addImpact(s, 6), message: '凭着硬核的学习能力，你咬牙掌握了新架构，重新站稳了团队的核心位置！' }),
        nextEventId: h1ToH2Router
      },
      {
        text: '【退守舒适区】因长期未手写底层代码，算法实力与热情下滑',
        effect: (s) => ({ leetcode: Math.max(20, s.leetcode - 15), health: Math.min(100, s.health + 5), message: '长期从事高层画饼与 PPT 汇报，导致你的手写算法功力大幅生疏，算法实力下滑。' }),
        nextEventId: h1ToH2Router
      }
    ]
  },

  'midlife_management_pivot': {
    id: 'midlife_management_pivot',
    title: '【35岁中年危机】管理岗转型与 IC 路线抉择',
    description: '年过 35，组里新招的 00 后应届生全是会用 Vibecoding 和 AI Agent 的效率怪兽！高层推行“扁平化去除中层管理”，大老板找你谈话：要求你转型 EM 承担背指标背 PIP 的角色，或者继续做 IC 但带头做 AI 转型！',
    choices: [
      {
        text: '【转型 M1/EM 管理岗】承担背指标背 PIP 责任，管理 12 人团队',
        condition: (s) => isCorporateEmployee(s) && (s.level === 'L5 (Senior)' || s.level === 'L6 (Staff)' || s.level === 'L7 (Senior Staff)' || s.level === 'L8 (Principal)' || s.level === 'MTS'),
        // Lateral move into management — NOT a free promotion into Staff/Senior-Staff
        // (the rarest bands). Same level, a modest management raise.
        effect: (s) => ({
          tc: s.tc + 6,
          health: Math.max(0, s.health - 15),
          charm: Math.min(s.max_charm || 25, (s.charm || 10) + 3),
          message: `你转任了同级 M1/EM 管理岗 (职级维持 ${s.level})！TC 增加 $6w，但每天要在各类汇报与背 PIP 的沉重压力下度过，白头发暴增。`
        }),
        nextEventId: h1ToH2Router
      },
      {
        text: '【死守 IC 架构师】做纯粹的技术专家，拒绝开扯皮管理会',
        effect: (s) => ({
          leetcode: Math.min(100, s.leetcode + 15),
          health: Math.min(100, s.health + 10),
          message: '你守住了纯粹技术人的尊严！虽然放弃了管理岗加薪，但工作与生活恢复了健康平衡！'
        }),
        nextEventId: h1ToH2Router
      }
    ]
  },

  'influencer_vp_drama': {
    id: 'influencer_vp_drama',
    title: '【组织震荡】公司空降百万粉自媒体网红担任业务线 VP',
    description: '管理层为了追求“AI 时代的品牌破圈”，从外部重金空降了一位拥有百万粉丝的小红书/LinkedIn 科技网红出任你们业务线 VP。新官上任三把火：不仅把所有周会改成全员直播录播客，还要求技术组全部配合他的“营销概念 Demo”，引发老工程师群体强烈不满...',
    choices: [
      {
        text: '【迎合向上管理】通宵帮 VP 定制炫酷的 Agent 营销 Demo，在全网发布会为他站台',
        condition: (s) => !s.laid_off && !!s.job_type && s.job_type !== 'unemployed',
        effect: (s) => ({
          charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 3),
          tc: s.tc + 3.0,
          health: Math.max(0, s.health - 15),
          message: '【成为嫡系】Demo 在社交平台爆火百万转发，VP 逢人便夸你是他的核心技术心腹，年底直接为你破格申请了 +$3w 调薪！'
        }),
        nextEventId: h1ToH2Router
      },
      {
        text: '【硬核技术死磕】在架构评审会上当众用指标与延迟打脸 VP 的花架子 PPT',
        condition: (s) => !s.laid_off && !!s.job_type && s.job_type !== 'unemployed',
        effect: (s) => {
          const win = s.leetcode >= 45 || gameRandom() < 0.45;
          return win
            ? {
                tc: s.tc + 2.0,
                charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 4),
                message: '【技术派胜利】你的专业驳斥被更高层 CTO 听到了！CTO 叫停了形式主义项目并将技术决策权重新交还给你，你在组员中威望极高！'
              }
            : {
                health: Math.max(0, s.health - 12),
                message: '【惨遭穿小鞋】网红 VP 表面微笑着说“Very good feedback”，私下却把最脏最累的 Oncall 维护活全部分配给了你。'
              };
        },
        nextEventId: h1ToH2Router
      },
      {
        text: '【冷眼吃瓜刷题】在会议室关麦静音，一边看 VP 吹水一边狂刷 LeetCode 备战跳槽',
        effect: (s) => ({
          leetcode: Math.min(100, s.leetcode + 8),
          health: Math.min(100, s.health + 5),
          message: '【以静制动】你看着 VP 在 PPT 里堆砌各种虚假 AI 概念，内心毫无波澜地刷完了 5 道 Hard 题，随时准备拿着大包跳槽脱离苦海。'
        }),
        nextEventId: h1ToH2Router
      }
    ]
  },

  'ai_disruption_existential': {
    id: 'ai_disruption_existential',
    title: '【AI 冲击危机】部门底层代码被 AI Agent 全面重构',
    description: '公司全员接入最新的自研代码大模型！你过去写了 5 年的 Java/C++ 中台系统被 AI Agent 在 10 分钟内全自动用 Rust 重构并部署完成。VP 宣布部门将“精简 30% 传统开发人员”。',
    choices: [
      {
        text: '【拥抱 AI 全面重构】主动领头组建 AI Agent 工作流，把所有业务线接入 LLM (安全但极度耗神)',
        // Safe path, but no longer free: leading the transformation burns you out.
        effect: (s) => ({
          leetcode: Math.min(100, s.leetcode + 15),
          tc: s.tc + 6,
          luck: Math.min(99, s.luck + 2),
          health: Math.max(0, s.health - 15),
          message: '你成为了公司的 AI 转型功臣！免受裁员波及，但没日没夜地推动全线接入 LLM 让你身心俱疲。'
        }),
        nextEventId: h1ToH2Router
      },
      {
        text: '【死守传统底层系统】赌 Legacy Code 的稀缺维护价值 (高风险高回报)',
        effect: (s) => {
          const win = gameRandom() < 0.40;
          return win
            // Survival now carries real rarity value (retention bonus), so the
            // gamble is a genuine trade-off against the safe path above.
            ? { health: Math.min(100, s.health + 5), tc: s.tc + 12, cash: s.cash + 5, message: '老系统发生重大产线事故，全球只有你懂得如何救火！公司开出天价挽留包裹，你凭稀缺性坐地起价！' }
            : { laid_off: true, tc: 0, job_type: 'unemployed', health: Math.max(0, s.health - 15), message: '部门最终决定整体重组裁撤！你拿着 Severance 遣散费步入了中年求职市场。' };
        },
        nextEventId: (s) => s.laid_off ? 'layoff_hit' : h1ToH2Router(s)
      }
    ]
  },

  'promo_celebration': {
    id: 'promo_celebration',
    title: '【晋升喜报】职级大晋升解锁！',
    description: '轰动部门！鉴于你在公司核心业务中的突出 Impact，晋升委员会 (Promo Committee) 官方批准了你的职级晋升！',
    choices: [
      {
        text: '【欢呼庆祝】请团队喝 Boba 奶茶 & 继续奋斗',
        condition: (s) => !!s.job_type && s.job_type !== 'unemployed' && !s.laid_off && (s.level === 'L4' || s.level === 'L5 (Senior)'),
        effect: (s) => ({ health: Math.min(100, s.health + 5), charm: s.charm + 1, message: `在全组同事的喝彩中，你正式挂上了 ${s.level || '崭新'} 的职级头衔，包裹与职场地位同步跃升！` }),
        nextEventId: h1ToH2Router,
      }
    ]
  },

  'l6_staff_celebration': {
    id: 'l6_staff_celebration',
    title: '【登堂入室】突破天花板！晋升 L6 Staff 架构师',
    description: '轰动全公司！你突破了 35 岁天花板与硅谷码农最大天堑，正式晋升为 L6 Staff Engineer 架构师！手握跨组技术决策权，年薪总包与期权迈入顶级行业前列。',
    choices: [
      {
        text: '【大摆宴席】在 Santana Row 举办全组升职庆功宴 (消耗 $0.5w)',
        condition: (s) => s.level === 'L6 (Staff)' && s.cash >= 0.5,
        effect: (s) => ({
          cash: Math.max(0, s.cash - 0.5),
          health: Math.min(100, s.health + 20),
          charm: Math.min(s.max_charm ?? 25, s.charm + 5),
          message: '全组同事与 VP 亲临现场向你祝贺！你挂上了 L6 Staff 的终极胸牌，成为了湾区技术圈里的传奇神仙！'
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '【深藏功名】保持低调，发小红书“L5 升 L6 心得与系统架构面经”',
        condition: (s) => s.level === 'L6 (Staff)',
        effect: (s) => ({
          charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 6),
          luck: Math.min(99, (s.luck || 20) + 10),
          message: '干货面经收割了数千赞！你被尊称为小红书与 Blind 上大佬级技术导师！'
        }),
        nextEventId: h1ToH2Router,
      }
    ]
  },

  'l7_senior_staff_celebration': {
    id: 'l7_senior_staff_celebration',
    title: '【统帅三军】跨部门统帅！晋升 L7 Senior Staff 资深架构师',
    description: '战略封神！你赢得了全公司高层 VP 的政治背书与全域架构指导权，破格批准晋升为 L7 Senior Staff Engineer 资深架构师！你的决策将深刻影响公司下一代技术路线图。',
    choices: [
      {
        text: '【包场庆祝】包下 Sand Hill Road 顶级会所与 VP 及顶级 Headhunter 畅饮 ($1.0w)',
        condition: (s) => s.level === 'L7 (Senior Staff)' && s.cash >= 1.0,
        effect: (s) => ({
          cash: Math.max(0, s.cash - 1.0),
          health: Math.min(100, s.health + 25),
          charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 6),
          network: Math.min(99, (s.network || 10) + 15),
          message: '全公司各条业务线的 VP 与顶级 VC 合伙人纷纷举杯致意！你已立于硅谷大厂高管与资深决策层的核心交汇点！'
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '【学术发表】受邀在 IEEE / NeurIPS 发表顶会 Keynote 演讲',
        condition: (s) => s.level === 'L7 (Senior Staff)',
        effect: (s) => ({
          charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 8),
          luck: Math.min(99, (s.luck || 20) + 12),
          message: '你的演讲在业界引起巨大轰动，行业内无数顶尖工程师与学生将你视作全领域技术偶像！'
        }),
        nextEventId: h1ToH2Router,
      }
    ]
  },

  'l8_principal_celebration': {
    id: 'l8_principal_celebration',
    title: '【硅谷传奇】登顶 L8 Principal 首席架构师 / 技术院士',
    description: '硅谷巅峰至尊！你成功攻克终极天堑，在董事会答辩中获得 CEO、CTO 及顶级投资人全票推举，破格登顶 L8 Principal Engineer / Fellow 首席架构师！全公司数万人中仅有屈指可数的数位泰斗能臻此境！',
    choices: [
      {
        text: '【豪宅庄园庆功】在 Atherton / Los Altos Hills 庄园举办全公司高管慈善晚宴 ($2.5w)',
        condition: (s) => s.level === 'L8 (Principal)' && s.cash >= 2.5,
        effect: (s) => ({
          cash: Math.max(0, s.cash - 2.5),
          health: Math.min(100, s.health + 30),
          charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 10),
          network: Math.min(99, (s.network || 10) + 20),
          message: 'CEO 亲自为你颁发公司终身荣誉技术院士奖章！在名流云集的庄园夜色中，你成为了硅谷华人史上无可争议的传世传奇！'
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '【功成身退的从容】婉拒铺张庆功，以科技泰斗之尊笑看风云，坐等顾问邀约上门',
        condition: (s) => s.level === 'L8 (Principal)',
        effect: (s) => ({
          health: Math.min(100, s.health + 10),
          cash: s.cash + 3,
          charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 8),
          luck: Math.min(99, (s.luck || 20) + 12),
          network: Math.min(99, (s.network || 10) + 10),
          message: '你以科技泰斗之尊笑看风云，零铺张。各大独角兽与 VC 递来顾问期权与少量咨询费，你的行业声望与人脉进一步拉满！'
        }),
        nextEventId: h1ToH2Router,
      }
    ]
  },

  'icc_work': {
    id: 'icc_work',
    title: '【外包求生】ICC 挂靠与外包项目交付',
    description: '你在 ICC 拿着微薄的薪水，在 Client 客户现场认真交付需求并利用业余时间闭关刷题。',
    choices: [
      {
        text: '【偷偷刷题跳槽】在 ICC 偷偷刷题，准备跳槽大厂',
        effect: (s) => ({
          leetcode: s.leetcode + 25,
          health: Math.max(0, s.health - 8),
          message: '你在 ICC 期间白天写业务代码，晚上死磕 LeetCode，算法能力大幅提升！'
        }),
        nextEventId: h1ToH2Router,
      }
    ]
  },

  'startup_work': {
    id: 'startup_work',
    title: '【初创风云】初创公司血泪与期权博弈',
    description: '你加入了一家 Early-Stage Startup，一个人干三个人的活。现在的风向变了，关于公司的发展方向：',
    imageUrl: 'images/ai_startup.jpg',
    choices: [
      {
        text: '【坚守传统赛道】坚守传统赛道 (如 SaaS / Web3 工具)',
        effect: (s) => {
          let winRate = 0.15;
          if (s.year >= 2020 && s.year <= 2022) winRate = 0.30;
          const win = gameRandom() < winRate; 
          return win 
            ? { cash: s.cash + 60, message: '稳扎稳打！公司被大厂收购了，你的期权兑现了 $60w 现金！' }
            : { cash: Math.max(0, s.cash - 5), health: s.health - 15, laid_off: true, job_type: 'unemployed', tc: 0, message: '风口过了，投资人撤资，公司资金链断裂倒闭。期权变废纸，你不得不重新进入求职市场。' };
        },
        nextEventId: h1ToH2Router,
      },
      {
        text: '【立刻 Pivot 转型 AI】立刻 Pivot (转型) 做 AI / 大模型架构',
        effect: (s) => {
          if (s.year < 2022) {
            return { cash: Math.max(0, s.cash - 10), health: s.health - 15, laid_off: true, job_type: 'unemployed', tc: 0, message: `在 ${s.year} 年盲目跟风 AI 概念缺乏底层研发，产品无人问津，公司资金链断裂倒闭，你重新失业。` };
          }
          const win = gameRandom() < 0.18;
          return win 
            ? { cash: s.cash + 35, stocks: (s.stocks || 0) + 45, visa: (s.visa === '公民' || s.visa === '绿卡') ? s.visa : '绿卡', gc_progress: 5, gc_stage: 'approved', imageUrl: 'images/ai_startup.jpg', message: '踩中 AI 风口！公司拿到巨额融资，你的期权大幅升值，获赠 $35w 现金与 $45w 股票资产，顺便拿到了 EB-1 绿卡！' }
            : { cash: Math.max(0, s.cash - 10), health: s.health - 15, laid_off: true, job_type: 'unemployed', tc: 0, imageUrl: 'images/layoff_box.jpg', message: '转型太慢，被巨头连夜更新的接口直接背刺干死了...连夜抱起铺盖重新刷题求职。' };
        },
        nextEventId: (s) => (!s.laid_off && s.visa === '绿卡' ? 'post_green_card' : h1ToH2Router(s)),
      }
    ]
  },

  'alex_startup_series_a': {
    id: 'alex_startup_series_a',
    title: '【硅谷前沿】Alex 博士的咖啡馆深谈',
    description: '在 Palo Alto University Ave 的 Philz Coffee，当年的伯乐 Alex 博士递给你一杯 Mint Mojito。他神情兴奋地推过来一份 Pitch Deck：“我们正在打造具身智能与多智能体底座——OmniAgent，刚拿到红杉沙丘路 $1200w Series A 领投。来做早期核心合伙人吧，期权管够！”',
    imageUrl: 'images/ai_startup.jpg',
    choices: [
      {
        text: '【All-in 核心合伙人】降薪加入，拿 2.5% 早期原始股权 (转为 Startup 核心)',
        condition: (s) => !s.laid_off && s.job_type !== 'unemployed',
        effect: (s) => ({
          job_type: 'startup',
          company: 'OmniAgent AI',
          tc: Math.max(16, Math.floor((s.tc || 25) * 0.65)),
          health: Math.max(0, s.health - 10),
          npcs: {
            ...(s.npcs || {}),
            alex: { name: 'Alex 博士', role: 'founder', status: 'ally', company: 'OmniAgent AI', note: 'OmniAgent 创始人，并肩作战' }
          },
          story_flags: {
            ...(s.story_flags || {}),
            alex_startup_invited: true,
            joined_omniagent: true,
            omniagent_start_year: s.year
          },
          message: '【全职合伙人启航】你正式以早期核心合伙人身份加入 OmniAgent AI！手握 2.5% 原始股权，与 Alex 一起在硅谷车库与算力集群日夜攻坚！'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【天使注资支持】出资 $10w 个人现金作为天使轮投资人 (拿早期投资份额)',
        condition: (s) => s.cash >= 10,
        reqBadge: '需现金 >= $10w',
        effect: (s) => ({
          cash: s.cash - 10,
          npcs: {
            ...(s.npcs || {}),
            alex: { name: 'Alex 博士', role: 'founder', status: 'ally', company: 'OmniAgent AI', note: '天使投资项目创始人' }
          },
          story_flags: {
            ...(s.story_flags || {}),
            alex_startup_invited: true,
            angel_invest_omniagent: true,
            omniagent_start_year: s.year
          },
          message: '【天使注资】你以个人天使身份给 OmniAgent 开出 $10w 支票！Alex 感动地握住你的手：“兄弟，上市敲钟那天第一排有你的位置！”'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【稳健保守】婉拒全职加入，答应担任外部兼职技术顾问 (保持盟友关系)',
        effect: (s) => ({
          charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 3),
          network: Math.min(100, (s.network || 10) + 15),
          npcs: {
            ...(s.npcs || {}),
            alex: { name: 'Alex 博士', role: 'founder', status: 'ally', company: 'OmniAgent AI', note: '独角兽创始人，外部顾问' }
          },
          story_flags: {
            ...(s.story_flags || {}),
            alex_startup_invited: true,
            omniagent_advisor: true
          },
          message: '你保持了大厂的稳定生活，并作为顾问为 Alex 介绍了多位大牛校友。Alex 依然视你为最信赖的技术智囊！'
        }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'alex_omniagent_ipo_exit': {
    id: 'alex_omniagent_ipo_exit',
    title: '【前沿分水岭】OmniAgent 终局生死战与退出评估',
    description: '创业三年，Alex 博士创办的 OmniAgent AI 迎来了决定生死与估值的终局大考。大模型算力大战进入白热化，资本市场正在对公司进行深度尽调与估值清算...',
    imageUrl: 'images/ai_startup.jpg',
    choices: [
      {
        text: '【全职合伙人结算】清算团队期权股权与终局退出命运',
        condition: (s) => !!s.story_flags?.joined_omniagent,
        hideIfUnavailable: true,
        effect: (s) => {
          const bullBonus = s.macro_economy === 'bull' ? 0.08 : s.macro_economy === 'bear' ? -0.06 : 0;
          const techBonus = s.leetcode >= 60 ? 0.05 : 0;
          const luckBonus = (s.luck || 20) / 1000;
          const ipoProb = Math.max(0.05, Math.min(0.25, 0.12 + bullBonus + techBonus + luckBonus));
          const acquiHireProb = 0.45;
          const rand = gameRandom();

          if (rand < ipoProb) {
            return {
              cash: s.cash + 50,
              stocks: (s.stocks || 0) + 40,
              health: Math.min(100, s.health + 10),
              story_flags: { ...(s.story_flags || {}), alex_ipo_done: true },
              message: '【纳斯达克敲钟】OmniAgent 克服万难成功上市 (代码 $OMNI)！虽然经历了多轮股权稀释，但作为早期核心员工你的期权依然套现了 $50w 现金与 $40w 股票！'
            };
          } else if (rand < ipoProb + acquiHireProb) {
            return {
              cash: s.cash + 20,
              stocks: (s.stocks || 0) + 15,
              job_type: 'big_tech',
              company: 'google',
              // Acqui-hire placement must not SKIP a rung (was flat→L5, so an L3 founding
              // engineer jumped L3→L5). Bump one level (L3→L4, L4→L5), keep L5+ as-is.
              level: s.level === 'L3' ? 'L4'
                : (s.level === 'L6 (Staff)' || s.level === 'L7 (Senior Staff)' || s.level === 'L8 (Principal)') ? s.level
                : 'L5 (Senior)',
              tc: Math.max(s.tc, 34),
              health: Math.min(100, s.health + 5),
              story_flags: { ...(s.story_flags || {}), alex_ipo_done: true },
              message: '【巨头高溢价收购】Google 以 1.5 亿美元收购 OmniAgent 团队！作为早期技术骨干，你分到了 $20w 现金与 $15w 留任股票，并被吸纳入大厂担任 Senior 架构师！'
            };
          } else {
            return {
              job_type: 'unemployed',
              laid_off: true,
              tc: 0,
              leetcode: s.leetcode + 12,
              network: Math.min(100, (s.network || 10) + 8),
              health: Math.max(0, s.health - 6),
              story_flags: { ...(s.story_flags || {}), alex_ipo_done: true },
              message: '【算力链条断裂】大模型集群烧光了融资储备，公司进入破产清算。期权化为废纸，但你沉淀了硬核 AI 架构落地能力，在求职市场备受大厂抢夺！'
            };
          }
        },
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【天使投资人结算】清算天使轮协议与投资回报',
        condition: (s) => !!s.story_flags?.angel_invest_omniagent,
        hideIfUnavailable: true,
        effect: (s) => {
          const bullBonus = s.macro_economy === 'bull' ? 0.08 : s.macro_economy === 'bear' ? -0.06 : 0;
          const ipoProb = Math.max(0.05, Math.min(0.25, 0.12 + bullBonus));
          const acquiHireProb = 0.45;
          const rand = gameRandom();

          if (rand < ipoProb) {
            return {
              cash: s.cash + 30,
              story_flags: { ...(s.story_flags || {}), alex_ipo_done: true },
              message: '【投资大捷】OmniAgent 纳斯达克挂牌上市，你的 $10w 天使轮投资获得了 3 倍退出回报 (净回款 $30w 现金)！'
            };
          } else if (rand < ipoProb + acquiHireProb) {
            return {
              cash: s.cash + 13,
              story_flags: { ...(s.story_flags || {}), alex_ipo_done: true },
              message: '【收购退出】OmniAgent 被大厂收购清偿优先股，你的 $10w 天使投资拿回了 $13w 本金与少量收益。'
            };
          } else {
            return {
              story_flags: { ...(s.story_flags || {}), alex_ipo_done: true },
              message: '【投资失利】OmniAgent 算力耗尽清算倒闭，你的 $10w 天使投资打了水漂，交了一笔昂贵的硅谷天使学费。'
            };
          }
        },
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【朋友圈见证】在朋友圈转发 OmniAgent 商业新闻并为老友 Alex 点赞',
        effect: (s) => ({
          charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 1),
          story_flags: {
            ...(s.story_flags || {}),
            alex_ipo_done: true
          },
          message: '你在朋友圈见证了初创团队在 AI 浪潮中的商战起伏。Alex 看到后发来私信：“无论成败，感谢一路以来的建议与支持！”'
        }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'dave_retaliation_showdown': {
    id: 'dave_retaliation_showdown',
    title: '【绝地反击】Manager Dave 闭门考核摊牌战',
    description: '年度闭门考核会上，Manager Dave 故技重施，试图将跨部门核心基建成果归功于他自己，并以“跨组对齐不达标”为由在系统里给你打了 Needs Improvement。但他不知道，你早已布下了天罗地网！',
    choices: [
      {
        text: '【雷霆出击】向 HR 廉政合规组与 Skip-level VP 提交 40 页证据链 (反向击溃 Dave)',
        condition: (s) => !!s.story_flags?.has_dave_evidence,
        reqBadge: '需掌握证据链',
        effect: (s) => {
          const cur = s.level || 'L4';
          const nextLvl = (cur === 'L3') ? 'L4' : (cur === 'L4') ? 'L5 (Senior)' : cur;
          const promoted = nextLvl !== cur; // L5+ 只是击溃 Dave、无实际升级 → 不算晋升
          return {
            tc: s.tc + 4.5,
            level: nextLvl, last_promo_age: promoted ? s.age : s.last_promo_age, // only stamp on a real level-up
            health: Math.min(100, s.health + 8),
            charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 3),
            npcs: {
              ...(s.npcs || {}),
              dave: { name: 'Manager Dave', role: 'manager', status: 'nemesis', note: '职场宿敌，被你的审计证据直接击溃' }
            },
            story_flags: {
              ...(s.story_flags || {}),
              dave_defeated: true,
              dave_defeated_year: s.year
            },
            message: '【证据确凿】VP 亲自介入调查，确认 Dave 存在严重抢占成果与职场霸凌行为！Dave 被撤职调离，你因硬核技术与正直表现获得常规绩效调薪 +$4.5w！'
          };
        },
        // Only celebrate when the showdown actually produced a level-up (L3→L4 / L4→L5);
        // an L5+ player who merely defeats Dave gets no promotion → no celebration screen.
        nextEventId: (s) => (s.last_promo_age === s.age && (s.level === 'L4' || s.level === 'L5 (Senior)') ? 'promo_celebration' : 'sv_year_end_settlement')
      },
      {
        text: '【实力跳槽降维打击】手握扎实代码，连夜接下 Meta/Nvidia 的 L5 Senior Offer',
        reqBadge: '需 LeetCode >= 45',
        condition: (s) => s.leetcode >= 45,
        effect: (s) => {
          const cur = s.level || 'L4';
          // L5→L6 也须 impact≥20 (与其它晋升门槛一致),否则平跳到 Meta 仍是 L5。
          const targetLvl = (cur === 'L3') ? 'L4' : (cur === 'L4' || !s.level) ? 'L5 (Senior)' : (cur === 'L5 (Senior)') ? ((s.impact || 0) >= 20 ? 'L6 (Staff)' : 'L5 (Senior)') : cur;
          const baseBand = targetLvl === 'L8 (Principal)' ? 135 : targetLvl === 'L7 (Senior Staff)' ? 92 : targetLvl === 'L6 (Staff)' ? 65 : targetLvl === 'L5 (Senior)' ? 46 : 34;
          const newTC = Math.max(s.tc + 6, baseBand);
          const promoted = targetLvl !== cur;
          return {
            company: 'meta',
            job_type: 'big_tech',
            level: targetLvl,
            tc: newTC,
            last_promo_age: promoted ? s.age : s.last_promo_age,
            health: Math.min(100, s.health + 5),
            npcs: {
              ...(s.npcs || {}),
              dave: { name: 'Manager Dave', role: 'manager', status: 'departed', note: '前组经理，已被你甩在身后' }
            },
            story_flags: {
              ...(s.story_flags || {}),
              dave_defeated: true,
              dave_defeated_year: s.year
            },
            message: `【优雅离场】你当场甩出 2 周离职信，带走核心上下文跳槽 Meta 核心组 (定级 ${targetLvl} · 年薪 $${newTC}w)！Dave 的烂摊子彻底无人收拾，在部门大会上狼狈不堪！`
          };
        },
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【据理力争】在闭门考核中据理力争驳斥不合理指标，虽未扳倒 Dave 但守住了底线',
        effect: (s) => ({
          health: Math.max(0, s.health - 8),
          story_flags: {
            ...(s.story_flags || {}),
            dave_defeated: true,
            dave_defeated_year: s.year
          },
          message: '你用详实的工作日志据理力争，使得 Dave 不得不收敛了恶意针对。你保住了正常评级，并决定加快晋升或跳槽步伐。'
        }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'dave_interview_veto': {
    id: 'dave_interview_veto',
    title: '【命运轮回】面试官桌对面的熟悉面孔',
    description: '作为技术委员会核心考官，你打开今天的 Staff 架构师候选人简历。当抬头看到推门进来的应聘者时，双方都愣住了——居然是头发稀疏、略显疲态的 Manager Dave！当年不可一世的他，如今在求职市场上辗转求生。',
    choices: [
      {
        text: '【一票否决 (Veto)】在系统写下 "Technical Depth 不足，Strong Reject"',
        // Petty revenge pays in schadenfreude (luck), so it isn't strictly dominated
        // by the "hire him as a subordinate" option (which gives more charm + an NPC).
        effect: (s) => ({
          charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 3),
          luck: Math.min(99, (s.luck || 20) + 3),
          health: Math.min(100, s.health + 10),
          story_flags: {
            ...(s.story_flags || {}),
            dave_veto_done: true
          },
          message: '【天道好轮回】你在评语写道：“缺乏一线架构实战能力，倾向于 PPT 汇报，与团队技术文化不符。” 终面一票否决！多年怨气一扫而空！'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【招入麾下】“准了！招进来当我的汇报下属，天天给我写对齐周报”',
        effect: (s) => ({
          charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 5),
          health: Math.min(100, s.health + 10),
          npcs: {
            ...(s.npcs || {}),
            dave: { name: 'Manager Dave', role: 'manager', status: 'active', note: '如今成为向你汇报的下属' }
          },
          story_flags: {
            ...(s.story_flags || {}),
            dave_veto_done: true
          },
          message: '【攻守易形】Dave 诚惶诚恐地接了 Offer。现在轮到他每周五下午 4 点向你诚惶诚恐地汇报 1:1 了！'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【客观包容】不带个人恩怨，就事论事客观评估技术表现',
        effect: (s) => ({
          charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 6),
          network: Math.min(100, (s.network || 10) + 10),
          story_flags: {
            ...(s.story_flags || {}),
            dave_veto_done: true
          },
          message: '你展现了硅谷顶级技术领袖的从容格局。Dave 在面试结束后深深向你鞠躬致谢，对当年的行为悔恨不已。'
        }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'sam_garage_zero_day': {
    id: 'sam_garage_zero_day',
    title: '【黑客车库】极客 Sam 的 Zero-Day 漏洞探险',
    description: '当年一起在 ACM 赛场拼杀的怪才极客 Sam 突然给你发来加密 Telegram 消息：“哥们！我发现了一家头部 AI 算力云平台的底层集群权限逃逸漏洞 (Zero-Day)！按官方漏洞悬赏 (Bug Bounty) 规则能领 $6w 赏金！今晚来我车库一起把 PoC 跑通！”',
    choices: [
      {
        text: '【通宵协作】带上电脑去 Sam 车库通宵验证漏洞 PoC',
        condition: (s) => s.leetcode >= 25,
        effect: (s) => {
          const pass = (s.leetcode >= 40) || gameRandom() < 0.65;
          return pass
            ? {
                cash: s.cash + 3.0,
                leetcode: s.leetcode + 8,
                health: Math.max(0, s.health - 8),
                npcs: {
                  ...(s.npcs || {}),
                  sam: { name: '极客 Sam', role: 'co_founder', status: 'ally', note: '生死战友，安全黑客' }
                },
                story_flags: {
                  ...(s.story_flags || {}),
                  sam_zero_day_done: true
                },
                message: '【提交成功】厂商安全团队半夜紧急修复并向你们转账 $6w 赏金！你与 Sam 五五分账，净入账 +$3w 现金！'
              }
            : {
                health: Math.max(0, s.health - 10),
                leetcode: s.leetcode + 4,
                story_flags: {
                  ...(s.story_flags || {}),
                  sam_zero_day_done: true
                },
                message: '厂商回复称该问题为“已知设计”，白喝了 6 罐无糖可乐，不过你与 Sam 的配合愈发默契。'
              };
        },
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【劝阻合规专注正道】劝阻 Sam 并注意安全合规，专注于大厂正规架构工作',
        effect: (s) => ({
          health: Math.min(100, s.health + 5),
          story_flags: {
            ...(s.story_flags || {}),
            sam_zero_day_done: true
          },
          message: '你提醒了 Sam 遵守合法披露准则。Sam 听从了你的建议，避免了潜在的法律风险。'
        }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'friday_p0_outage_crisis': {
    id: 'friday_p0_outage_crisis',
    title: '【周五警报】下午 4:55 的生产环境 P0 线上大故障',
    description: '周五下午 4:55，你正准备合上电脑去吃火锅，隔壁组新来的同事强行推了一个未经充分压测的 Hotfix，导致生产环境主站与结算流水全线瘫痪！Slack 的 #war-room 警报把整个部门上百人炸醒...',
    choices: [
      {
        text: '【救火队长一战封神】主动挺身而出通宵排查，连夜定位 Root Cause 并完成回滚',
        effect: (s) => ({
          health: Math.max(0, s.health - 8),
          network: Math.min(100, (s.network || 0) + 3),
          cash: s.cash + 0.5,
          impact: addImpact(s, 7),
          message: '【凌晨救火与高管点赞】连灌两罐红牛，在 War Room 排查到凌晨 4 点终于定位到坏配置并修复。虽然周末泡汤、眼圈发黑，但在全组事后复盘邮件中获得了高管点名感谢与特别奖金。'
        }),
        nextEventId: h1ToH2Router
      },
      {
        text: '【战术跟进与留痕取证】在 Slack 回一句“Looking into it”，默默截图保存证据链',
        effect: (s) => ({
          health: Math.max(0, s.health - 2),
          network: (s.network || 0) + 2,
          message: '【专业避坑与责任厘清】你深知盲目插手只会引发更大混乱。你慢条斯理地在群里跟进，同时保存了完整错误日志与未经代码评审的发布记录，周一复盘会上成功将责任撇得干干净净——顺带在管理层面前刷了一波"靠谱、有条理"的口碑。'
        }),
        nextEventId: h1ToH2Router
      },
      {
        text: '【合上电脑开启免打扰】假装已经在前往 Tahoe 滑雪没有信号的 I-80 山路上',
        effect: (s) => ({
          health: Math.min(100, s.health + 6),
          network: Math.max(0, (s.network || 0) - 2),
          message: '【彻底断联与纯享周末】你将手机调至勿扰模式，如期去参加了周五精酿聚会。周一到公司发现问题已被其他同事解决，虽然被 Oncall 老板念叨了两句，但你的周末过得极其惬意。'
        }),
        nextEventId: h1ToH2Router
      }
    ]
  },

  'empty_promotion_promise': {
    id: 'empty_promotion_promise',
    title: '【职场博弈】老板的画饼神功与年底升职卡位',
    description: '年中 1-on-1 时老板拍着胸脯向你保证：“只要你把这个没人愿意接的 Legacy 屎山架构啃下来，年底 Promo 优先推你！”然而到了年底评审会，老板满脸无奈地叹气：“今年委员会 Headcount 极其惨烈，明年肯定优先推你...”',
    choices: [
      {
        text: '【开启 Quiet Quitting 摸鱼】看透大厂零和博弈，准点下班把精力留给自己',
        effect: (s) => ({
          health: Math.min(100, s.health + 8),
          impact: addImpact(s, -6),
          message: '【拒绝内耗与专注生活】你关掉了下班后的工作通知，准点打卡下班去健身、做饭、睡足 8 小时。既然没有实际加薪，就把精力转化为实打实的身体健康与内心宁静，但你的项目影响力 (Impact) 也在悄悄流失。'
        }),
        nextEventId: h1ToH2Router
      },
      {
        text: '【化愤怒为刷题动力】推掉无意义加班，闭关两个月重刷 LeetCode 备战跳槽',
        // 职级差异：资深工程师市场议价力更强，同样的闭关刷题换来更大的跳槽底气。
        effect: (s) => {
          const seniorPlus = s.level === 'L5 (Senior)' || s.level === 'L5' || s.level === 'L6 (Staff)' || s.level === 'Staff' || s.level === 'L7 (Senior Staff)' || s.level === 'L7' || s.level === 'L8 (Principal)' || s.level === 'MTS';
          return seniorPlus
            ? { health: Math.max(0, s.health - 6), leetcode: Math.min(100, s.leetcode + 15), network: Math.min(100, (s.network || 0) + 3), message: '【资深的市场底气】被画饼的憋屈点燃了斗志。你闭关重刷 Hard 与系统设计，凭借资深履历，猎头电话瞬间被打爆——你手握筹码，随时可以体面地教老板做人。' }
            : { health: Math.max(0, s.health - 6), leetcode: Math.min(100, s.leetcode + 10), message: '【重拾手感与蓄力跳槽】被画饼的憋屈激发了你的斗志。你推掉了周末应酬，闭关重刷 Hard 题与系统设计。算法手感重回巅峰，准备在即将到来的跳槽季狠狠教老板做人。' };
        },
        nextEventId: h1ToH2Router
      },
      {
        text: '【私下联系 Skip-level 申请转组】寻找跨部门更具上升空间的明星业务线',
        effect: (s) => ({
          health: Math.max(0, s.health - 3),
          network: Math.min(100, (s.network || 0) + 2),
          charm: Math.min(s.max_charm ?? 25, s.charm + 1),
          message: '【跨部门破局与人脉铺路】你没有当场翻脸，而是私下找隔壁业务线的 Director 喝咖啡，凭借扎实的项目交付口碑拿到了新团队的接收意向，为无缝转岗埋下了伏笔。'
        }),
        nextEventId: h1ToH2Router
      },
      {
        // 职级专属选项：只有 L5+ 资深工程师才有资历与市场筹码正面摊牌逼老板兑现。
        text: '【摆资历正面摊牌】亮出手上的竞对 Offer，逼老板要么书面承诺、要么放人 (资深专属)',
        condition: (s) => {
          const seniorPlus = s.level === 'L5 (Senior)' || s.level === 'L5' || s.level === 'L6 (Staff)' || s.level === 'Staff' || s.level === 'L7 (Senior Staff)' || s.level === 'L7' || s.level === 'L8 (Principal)' || s.level === 'MTS';
          return !!s.job_type && s.job_type !== 'unemployed' && !s.laid_off && seniorPlus;
        },
        effect: (s) => {
          const win = gameRandom() < Math.min(0.6, 0.35 + ((s.network || 10) / 100) * 0.4);
          return win
            ? { tc: s.tc + 3, network: Math.min(100, (s.network || 10) + 3), health: Math.max(0, s.health - 5), message: '【以退为进拿到 Counter】你把竞对的 Offer 摊上桌，老板连夜找 HRBP 批下了 Off-cycle 调薪来留人。资历，就是你最硬的谈判筹码。' }
            : { health: Math.max(0, s.health - 8), charm: Math.max(0, (s.charm || 10) - 1), message: '【撕破脸的代价】老板没吃你这套，双方关系降到冰点。你骑虎难下，只能被动加速走人流程。' };
        },
        nextEventId: h1ToH2Router
      }
    ]
  },

  'multi_timezone_calendar_hell': {
    id: 'multi_timezone_calendar_hell',
    title: '【跨国协作】跨时区日历地狱与日夜颠倒',
    description: '公司大力推行全球矩阵协作，你的日历被排成了跨时区噩梦：早上 7:30 对接欧洲团队，下午对齐加州总部，深夜 11 点和亚洲研发中心开 Architecture Review。一天跨越三个半球，睡眠彻底碎成粉末...',
    choices: [
      {
        text: '【全天候硬扛跨时区沟通】靠黑咖啡与褪黑素支撑，争取跨国项目的国际影响力',
        effect: (s) => ({
          health: Math.max(0, s.health - 8),
          network: Math.min(100, (s.network || 0) + 3),
          charm: Math.min(s.max_charm ?? 25, s.charm + 1),
          impact: addImpact(s, 5),
          message: '【全球影响力与黑眼圈】早上在被窝里对接伦敦，深夜在书房连线北京。虽然作息紊乱且黑眼圈深重，但你在跨国团队中树立了极强的技术号召力与跨区域影响力。'
        }),
        nextEventId: h1ToH2Router
      },
      {
        text: '【整顿职场推行异步沟通】Decline 掉所有非核心时段会议，强推文档与 PR 交流',
        effect: (s) => ({
          health: Math.min(100, s.health + 5),
          network: Math.max(0, (s.network || 0) - 1),
          message: '【划定边界与文档留痕】你在日历上锁定了免打扰时段，要求所有越洋问题一律通过 Google Doc 和 PR 异步留痕。睡眠质量明显恢复，工作效率反而大幅提升。'
        }),
        nextEventId: h1ToH2Router
      },
      {
        text: '【申请调动到纯北美本地 Infra 组】告别跨国矩阵，回归加州朝九晚五',
        effect: (s) => ({
          health: Math.min(100, s.health + 4),
          leetcode: s.leetcode + 2,
          message: '【回归正常作息】你向老板申请调动到只对接加州总部的底层基础设施组。告别了半夜和清晨的夺命连环会，你的生活重新回归了规律的加州阳光。'
        }),
        nextEventId: h1ToH2Router
      }
    ]
  },

  'raj_scrum_alignment_dilemma': {
    id: 'raj_scrum_alignment_dilemma',
    title: '【向上管理大师】同组 Tech Lead Raj 的季度对齐会',
    description: '季度 Planning 会上，同组印度裔 Lead Raj 挂着极其热情的微笑：“Hey my friend, this legacy refactoring is super critical for the org!”\n他巧妙地把最难啃、最容易背锅的底层旧系统重构分给了你，而把最吸睛、最容易向 VP 汇报的 GenAI 战略 Demo 分给了他自己。',
    choices: [
      {
        text: '【扎实筑基】默默把底层系统重构做到 99.99% 可用性 (深挖技术护城河)',
        effect: (s) => ({
          leetcode: Math.min(100, s.leetcode + 5),
          impact: (s.impact || 0) + 8,
          health: Math.max(0, s.health - 6),
          story_flags: { ...(s.story_flags || {}), raj_alignment_seen: true, raj_solid: true, raj_meet_year: s.year },
          npcs: { ...(s.npcs || {}), raj: { name: 'Raj', role: 'mentor', status: 'active', note: '同组 Tech Lead，精通汇报艺术' } },
          message: '你把没人愿意碰的陈年屎山重构成高可用基石！虽然当下汇报不显眼，但你成了全组唯一掌握底层核心技术的大佬，为未来冲刺 Staff 打下了坚不可摧的基础！'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【敏捷结盟】私下请 Raj 喝 Chai 咖啡，主动学习他的向上汇报与对齐艺术',
        costBadge: '花费 $0.2w',
        condition: (s) => (s.cash + (s.stocks || 0)) >= 0.2,
        effect: (s) => ({
          cash: s.cash - 0.2,
          network: Math.min(100, (s.network || 0) + 10),
          charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 3),
          story_flags: { ...(s.story_flags || {}), raj_alignment_seen: true, raj_ally: true, raj_meet_year: s.year },
          npcs: { ...(s.npcs || {}), raj: { name: 'Raj', role: 'mentor', status: 'ally', note: '同组 Tech Lead，你的职场汇报导师与政治同盟' } },
          message: '几杯 Chai 咖啡下肚，Raj 跟你推心置腹地分享了硅谷向上管理、跨组邀功与 PPT 对齐的核心要义！你情商大涨，与 Raj 结为坚实盟友！'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【锋芒毕露】在部门 All-Hands 上展示你自研的 Agent 加速方案，抢回聚光灯',
        reqBadge: '需 LeetCode >= 50 或 Impact >= 10',
        condition: (s) => s.leetcode >= 50 || (s.impact || 0) >= 10,
        effect: (s) => ({
          impact: (s.impact || 0) + 10,
          charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 2),
          story_flags: { ...(s.story_flags || {}), raj_alignment_seen: true, raj_rival: true, raj_meet_year: s.year },
          npcs: { ...(s.npcs || {}), raj: { name: 'Raj', role: 'mentor', status: 'active', note: '同组 Tech Lead，与你存在微妙的竞争关系' } },
          message: '你在百人 All-Hands 上流畅演示了自研 Agent 方案，赢得了 Skip-Level VP 的当场点名赞赏！但也与 Raj 产生了微妙的竞争关系。'
        }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'raj_director_promotion_board': {
    id: 'raj_director_promotion_board',
    title: '【多年之后】Raj 升 Director 后的 L7 评审提拔',
    description: '几年过去，Raj 凭借卓越的向上管理顺利升任部门 Director 并进入了职级评审委员会 (Promotion Board)！现在你冲击 L7 Senior Staff 的晋升材料正摆在委员会桌上——这是硅谷职级中一次关键的大跳：',
    choices: [
      {
        // 盟友托举 = 大幅提升过会概率(常规 L6→L7 约 20%),但仍需硬实力 (impact>=45),非白送;
        // 且只作用于 L6→L7 (由 helpers 路由限定 level==='L6 (Staff)')。
        text: '【盟友全力托举】(此前与 Raj 结为盟友，Raj 在闭门评审中力推你的 Case · 需 Impact >= 45)',
        condition: (s) => Boolean(s.story_flags?.raj_ally) && (s.impact || 0) >= 45,
        reqBadge: '需盟友支持 & Impact >= 45',
        hideIfUnavailable: true,
        effect: (s) => {
          const win = gameRandom() < 0.40;
          return win
            ? { mid_year: true, season_stage: 'h1', level: 'L7 (Senior Staff)', tc: s.tc + 20, health: Math.max(0, s.health - 12), impact: addImpact(s, 8), last_promo_age: s.age, story_flags: { ...(s.story_flags || {}), raj_board_done: true }, message: '【晋升通过！】Raj 在闭门会议上拍桌力挺：“This engineer is the cornerstone of our org!” 结合你扎实的影响力，你顺利晋升为 L7 Senior Staff (TC +$20w)！' }
            : { mid_year: true, season_stage: 'h1', health: Math.max(0, s.health - 8), impact: addImpact(s, 5), story_flags: { ...(s.story_flags || {}), raj_board_done: true }, message: '【惜败一票】即便有 Raj 力挺，委员会仍认为你的跨组影响力再沉淀一年会更稳，本轮 L7 评审惜败延期。' };
        },
        nextEventId: (s) => (s.level === 'L7 (Senior Staff)' && s.last_promo_age === s.age ? 'l7_senior_staff_celebration' : h1ToH2Router(s)),
      },
      {
        text: '【硬核技术折服】(凭借绝对过硬的 Impact 与代码能力征服评审会)',
        condition: (s) => (s.impact || 0) >= 45 || s.leetcode >= 80,
        reqBadge: '需 Impact >= 45 或 LeetCode >= 80',
        effect: (s) => {
          const win = gameRandom() < 0.25;
          return win
            ? { mid_year: true, season_stage: 'h1', level: 'L7 (Senior Staff)', tc: s.tc + 20, health: Math.max(0, s.health - 15), impact: addImpact(s, 10), last_promo_age: s.age, story_flags: { ...(s.story_flags || {}), raj_board_done: true }, message: '【实力过会！】委员会翻阅了你主导的核心底层系统指标，数据无懈可击，一致通过晋升至 L7 Senior Staff！' }
            : { mid_year: true, season_stage: 'h1', health: Math.max(0, s.health - 10), impact: addImpact(s, 6), story_flags: { ...(s.story_flags || {}), raj_board_done: true }, message: '【名额有限】你的材料很硬，但今年 L7 名额被更资深的候选人占了，委员会建议明年再战。' };
        },
        nextEventId: (s) => (s.level === 'L7 (Senior Staff)' && s.last_promo_age === s.age ? 'l7_senior_staff_celebration' : h1ToH2Router(s)),
      },
      {
        text: '【继续积累】本次暂缓，多沉淀一年跨组影响力',
        condition: (s) => true,
        effect: (s) => ({
          impact: addImpact(s, 6),
          health: Math.min(100, s.health + 5),
          story_flags: { ...(s.story_flags || {}), raj_board_done: true },
          message: '你选择稳扎稳打再沉淀一年跨部门大项目，为下一次冲击 L7 打下更扎实的基础。'
        }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'linda_sand_hill_encounter': {
    id: 'linda_sand_hill_encounter',
    title: '【沙丘路人脉】华人天使投资人 Linda 的闭门茶会',
    description: '在斯坦福华人创投沙龙上，沙丘路知名基金合伙人 Linda 听了你对未来 AI 架构的技术见解后，主动递过来名片：“你在技术洞察上非常有前瞻性，有空常聊聊。”',
    choices: [
      {
        text: '【兼任技术顾问】为 Linda 的基金担任兼职技术尽调顾问 (Venture Partner)',
        effect: (s) => ({
          tc: s.tc + 3,
          network: Math.min(100, (s.network || 0) + 12),
          npcs: { ...(s.npcs || {}), linda: { name: 'Linda', role: 'friend', status: 'active', note: '沙丘路知名华人 VC 合伙人' } },
          story_flags: { ...(s.story_flags || {}), met_linda: true, linda_advisor: true, linda_meet_year: s.year },
          message: '你正式受邀担任基金兼职技术顾问！每年额外获得顾问津贴 (+$3w/年)，并深度打入硅谷顶级华人创投圈！'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【获取初创高管通道】请 Linda 为你保留沙丘路领投独角兽的核心通道',
        effect: (s) => ({
          network: Math.min(100, (s.network || 0) + 15),
          charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 3),
          npcs: { ...(s.npcs || {}), linda: { name: 'Linda', role: 'friend', status: 'active', note: '沙丘路知名华人 VC 合伙人' } },
          story_flags: { ...(s.story_flags || {}), met_linda: true, linda_fast_track: true, linda_meet_year: s.year },
          message: 'Linda 欣然答应将你列入顶级人才库，承诺在你需要跳槽或创业时提供沙丘路的一线直通资源！'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【专注当下】感谢 Linda 的好意，保持一般朋友联络',
        effect: (s) => ({
          network: Math.min(100, (s.network || 0) + 5),
          npcs: { ...(s.npcs || {}), linda: { name: 'Linda', role: 'friend', status: 'active', note: '沙丘路华人 VC 朋友' } },
          story_flags: { ...(s.story_flags || {}), met_linda: true, linda_meet_year: s.year },
          message: '你加了 Linda 的微信，双方保持良好的技术交流。'
        }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'linda_angel_co_investment': {
    id: 'linda_angel_co_investment',
    title: '【资本破局】Linda 带来的 Pre-IPO 独角兽额度与领投资源',
    description: 'Linda 再次发来私信：“我们领投了一家估值 20 亿美元的 AI 独角兽，内部给核心顾问留了一批稀缺的员工级 Pre-IPO 老股额度，或者如果你准备出来创业，我的基金可以直接开出 $150w 种子轮 Term Sheet。”',
    choices: [
      {
        text: '【认购 Pre-IPO 独角兽额度】出资 $15w 认购明星独角兽老股',
        costBadge: '出资 $15w',
        reqBadge: '需总资产 >= $15w',
        condition: (s) => (s.cash + (s.stocks || 0)) >= 15,
        effect: (s) => {
          const hit = gameRandom() < 0.60;
          const gain = hit ? 90 : 20;
          const liq = liquidateStocksToCover(s.cash - 15, (s.stocks || 0) + gain);
          return {
            cash: liq.cash,
            stocks: liq.stocks,
            story_flags: { ...(s.story_flags || {}), linda_deal_done: true },
            message: hit
              ? '【独角兽暴赚！】该公司迅速敲定下一轮融资，你的老股持仓估值暴涨至 $90w！'
              : '该独角兽稳步推进，你的股权资产增值至 $20w。'
          };
        },
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【接下 Term Sheet 全职创业】拿 Linda 的 $150w 支票正式开启创业 (CEO 身份)',
        reqBadge: '需绿卡/公民身份',
        condition: (s) => isPermanentVisa(s.visa),
        effect: (s) => ({
          job_type: 'startup_founder',
          company: 'stealth_startup',
          founder_stage: 'seed',
          company_valuation: 800,
          tc: 12,
          cash: s.cash + 10,
          story_flags: { ...(s.story_flags || {}), linda_deal_done: true },
          message: '【拿到 Sand Hill 支票！】Linda 基金领投 $150w 种子轮！你正式登出大厂，作为初创公司 CEO 开启硅谷创业之路！'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【保持现状】暂时不参与股权投资，专注于当前工作',
        condition: (s) => true,
        effect: (s) => ({
          story_flags: { ...(s.story_flags || {}), linda_deal_done: true },
          message: '你向 Linda 表达了感谢，决定继续保持现有的资产节奏。'
        }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'career_summer_intern_mentor': {
    id: 'career_summer_intern_mentor',
    title: '【职场进阶】首次受命担任暑期实习生 Mentor (Intern Host)',
    description: 'Manager 在 1-on-1 上交给你一项重要晋升考核任务：“今年组里来了一位顶尖名校的暑期实习生，由你担任 Host & Mentor，负责 12 周的项目设计、日常 1-on-1 与转正评估 (Return Offer Evaluation)！”',
    choices: [
      {
        text: '【手把手带教 · 打造标杆项目】全力拆解模块与指导 Code Review，冲击组内标杆',
        condition: (s) => !s.laid_off,
        effect: (s) => ({
          leetcode: s.leetcode + 4,
          impact: addImpact(s, 5),
          network: Math.min(100, (s.network || 10) + 5),
          health: Math.max(0, s.health - 8),
          story_flags: { ...(s.story_flags || {}), intern_mentored: true },
          message: '【带教大捷！】在你的悉心辅导下，实习生在全组 Demo Day 上大放异彩，提前锁定了顶格 Return Offer！Manager 极度认可你的 Leadership 带人能力 (Impact +5, 人脉网络大幅拓展)！'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【放权探索 · 豪赌天才少年】给出宏观架构设计让实习生自由发挥，成败全看这届 Intern 的成色',
        condition: (s) => !s.laid_off,
        effect: (s) => {
          const roll = gameRandom();
          if (roll < 0.45) {
            return {
              impact: addImpact(s, 8),
              tc: s.tc + 2,
              health: Math.min(100, s.health + 5),
              network: Math.min(100, (s.network || 10) + 8),
              story_flags: { ...(s.story_flags || {}), intern_mentored: true },
              message: '【神仙实习生带飞！】实习生是个天才极客，不仅 3 周做完了整套项目，还顺手重构了组里陈年的分布式锁 Bug！全组夸你“带出了年度最佳 Intern”，你白捡海量 Impact 与加薪！'
            };
          }
          if (roll < 0.72) {
            return {
              impact: addImpact(s, 3),
              leetcode: s.leetcode + 3,
              story_flags: { ...(s.story_flags || {}), intern_mentored: true },
              message: '【稳妥结项】实习生按部就班完成了功能上线，顺利拿到 Return Offer，为你积累了宝贵的带人经验。'
            };
          }
          return {
            impact: addImpact(s, -4),
            health: Math.max(0, s.health - 12),
            network: Math.max(0, (s.network || 10) - 3),
            story_flags: { ...(s.story_flags || {}), intern_mentored: true },
            message: '【放养翻车！】你疏于跟进，实习生在无人指导下把核心模块写成了一坨技术债，上线即回滚，Return Offer 被拒。Manager 在 Calibration 上质疑你“只会甩手、带人不力”，这次带教反成了晋升路上的污点 (Impact 受损，健康与口碑双跌)！'
          };
        },
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【救场化险 · 紧急回滚止血】实习生周五推代码险些酿成 P0 Outage，你硬核排障化险为夷',
        reqBadge: '需硬核算法或影响力',
        condition: (s) => s.leetcode >= 35 || (s.impact || 0) >= 6,
        effect: (s) => ({
          leetcode: s.leetcode + 6,
          impact: addImpact(s, 4),
          health: Math.max(0, s.health - 6),
          story_flags: { ...(s.story_flags || {}), intern_mentored: true },
          message: '【硬核救场！】你在 15 分钟内快速定位 Root Cause 并完成防御性回滚，接着手把手教会了实习生防御性编程。这次 Crisis Response 展现了你极强的工程抗压底蕴！'
        }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'career_org_tech_lead_campaign': {
    id: 'career_org_tech_lead_campaign',
    title: '【Tech Lead 领航】挂帅跨部门重点战役与技术组织领导力',
    description: '作为 Staff / Senior Staff 资深架构师，你正式挂帅统领由 4 个跨时区小组、20+ 名工程师组成的战略攻坚团队 (Tiger Team)，主导全公司下一代核心跨业务基础设施建设！',
    choices: [
      {
        text: '【战略对齐 · 豪赌跨组变革】制定跨组技术 RFC 强推数据孤岛整合，成败系于跨团队政治博弈',
        reqBadge: '需深厚人脉或高领导力',
        condition: (s) => (s.network || 0) >= 15 || (s.charm || 0) >= 12,
        effect: (s) => {
          const win = gameRandom() < 0.62;
          return win ? {
            impact: addImpact(s, 10),
            network: Math.min(100, (s.network || 10) + 8),
            tc: s.tc + 5,
            health: Math.max(0, s.health - 10),
            message: '【全线战役大捷！】你统帅的 20+ 人团队攻克了核心协同瓶颈，全业务延迟骤降 70%！VP 在 All-Hands 上公开通报嘉奖，你的技术领导力全公司传颂 (Impact +10, TC +$5w)！'
          } : {
            impact: addImpact(s, -3),
            network: Math.max(0, (s.network || 10) - 6),
            health: Math.max(0, s.health - 12),
            message: '【跨组战役折戟！】兄弟团队为保住自己的地盘明里附和、暗里抵制，你的 RFC 在无尽的对齐会里被拖成一纸空文，还得罪了两位平级 Staff。VP 认为你“搞不定跨组协同”，这次挂帅反而烧掉了你宝贵的政治资本 (Impact 受损，人脉与健康俱伤)！'
          };
        },
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【技术攻坚 · 亲自手撕内核】以身作则带领骨干手撕最难的高并发调度引擎 (IC 领袖)',
        reqBadge: '需 LeetCode >= 65',
        condition: (s) => s.leetcode >= 65,
        effect: (s) => ({
          impact: addImpact(s, 9),
          leetcode: s.leetcode + 6,
          tc: s.tc + 4,
          health: Math.max(0, s.health - 12),
          message: '【硬核技术领袖！】你以身作则手撕了核心调度器，代码优雅高效，让年轻工程师奉为圭臬！团队提前一个月超额交付战略里程碑 (Impact +9, TC +$4w)！'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【梯队建设 · 提拔骨干打造铁军】重点培养 2 名 Senior 骨干分别主导子系统，自己把控技术风向',
        condition: (s) => true,
        effect: (s) => ({
          impact: addImpact(s, 6),
          network: Math.min(100, (s.network || 10) + 8),
          health: Math.min(100, s.health + 4),
          message: '【团队梯队成熟！】你成功提拔了两位得力干将，团队自治高效运转，你无需熬夜也能稳稳收获全组交付的丰硕成果 (Impact +6, 人脉网络大幅拓展)！'
        }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'career_executive_tech_steering': {
    id: 'career_executive_tech_steering',
    title: '【架构委员会主席】主导全公司技术战略指导委员会 (Steering Committee)',
    description: '作为公司屈指可数的顶尖技术领袖，你受邀担任技术战略委员会主席，主导全公司未来 5 年的 AI 基础设施统一架构选型与千万级计算资源调配！',
    choices: [
      {
        text: '【重塑全公司技术标准 · 铁腕豪赌】强推统一技术栈与 Agent 架构，一将功成万骨枯',
        reqBadge: '需架构影响力 >= 35',
        condition: (s) => (s.impact || 0) >= 35,
        effect: (s) => {
          const win = gameRandom() < 0.60;
          return win ? {
            impact: addImpact(s, 12),
            tc: s.tc + 8,
            network: Math.min(100, (s.network || 10) + 8),
            health: Math.max(0, s.health - 8),
            message: '【一代宗师！】全公司万名工程师全面接入你的新一代架构标准，研发效能翻倍，你在董事会与全行业声望达到顶峰 (Impact +12, TC +$8w)！'
          } : {
            impact: addImpact(s, -5),
            network: Math.max(0, (s.network || 10) - 6),
            health: Math.max(0, s.health - 12),
            message: '【技术强推反噬！】各大业务线集体抵制“一刀切”迁移，半年投入付诸东流，两个核心团队因内耗爆发离职潮。董事会质疑你“脱离一线、独断专行”，你多年积累的架构威望遭遇重大反噬 (Impact 重挫，人脉与健康俱损)！'
          };
        },
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【稳健共识治理】建立委员会准入机制与轮值主席制，兼顾个人健康与全司发展',
        condition: (s) => true,
        effect: (s) => ({
          impact: addImpact(s, 8),
          health: Math.min(100, s.health + 8),
          tc: s.tc + 4,
          message: '【德高望重！】你建立的开源自治委员会机制广受赞誉，既维持了公司技术领先，又享受着充沛的生活平衡 (Impact +8, TC +$4w, 健康 +8)！'
        }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'all_hands_corporate_bs': {
    id: 'all_hands_corporate_bs',
    title: '【季度 All Hands】全员大会与黑话风暴',
    description: '季度全员大会 (All-Hands / TGIF) 如期召开。台上的高管们面带从容自信的微笑，幻灯片上跳跃着 "AI-Native Transformation"、"Synergistic Velocity" 与 "Year of Efficiency" 等宏大叙事。进入 Slido / Dory 匿名提问环节，置顶的前三高赞问题全是「今年还有没有 Merit 调薪与年终奖？」和「下个季度还会不会裁员？」。高管战术性喝了一口依云矿泉水，微笑着说："That\'s a fantastic question. Let me zoom out to our North Star..."',
    choices: [
      {
        text: '【在 Slido / Dory 匿名给尖锐提问猛点 Upvote】看高管擦汗打太极，释放内卷焦虑',
        condition: (_s) => true,
        effect: (s) => ({
          health: Math.min(100, s.health + 6),
          message: '【精神按摩回血】你和数千名在线同事默契配合，把「高管什么时候带头降薪」一路顶到了投票榜首！看着台上的领导尴尬打圆场顾左右而言他，你感到无比解压 (健康 +6)！'
        }),
        nextEventId: h1ToH2Router
      },
      {
        text: '【笔记本掩护下闭麦刷题】把高管黑话当白噪音催眠，在 IDE 里狂刷 LeetCode',
        condition: (_s) => true,
        effect: (s) => ({
          leetcode: s.leetcode + 6,
          health: Math.min(100, s.health + 3),
          message: '【人在会场心在题库】你在屏幕左半边放着全员大会直播，右半边开了 LeetCode 刷动态规划 Hard 题。不仅两道题顺利 AC，还借着会议白噪音获得了片刻宁静 (LeetCode +6, 健康 +3)！'
        }),
        nextEventId: h1ToH2Router
      },
      {
        text: '【在 Slack `#all-hands` 频道狂发 Meme 表情包】与同组战友用 Emoji 盖楼',
        condition: (_s) => true,
        effect: (s) => ({
          charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 3),
          network: Math.min(100, (s.network || 10) + 5),
          message: '【Meme 大师破防】每当高管口吐抽象新黑话，你便在内部群精准补刀 :popcorn: :clown: :this_is_fine: 表情包，引得同组同事和跨组好友疯狂点赞，摸鱼革命友谊迅速升温！'
        }),
        nextEventId: h1ToH2Router
      },
      {
        text: '【全神贯注记笔记，把黑话全塞进下季度 OKR】深谙大厂生存之道，迎合战略叙事',
        condition: (_s) => true,
        effect: (s) => ({
          impact: addImpact(s, 6),
          health: Math.max(0, s.health - 6),
          message: '【黑话对齐大师】你迅速将 "Synergy"、"Paradigm Shift" 和 "Agentic Workflow" 密密麻麻地织进自己的下季度 OKR 与晋升规划中。VP 看到汇报后大喜过望直夸你“大局观极强、紧跟全司战略” (架构影响力 +6, 健康 -6)！'
        }),
        nextEventId: h1ToH2Router
      }
    ]
  },

  'snack_perks_downgrade': {
    id: 'snack_perks_downgrade',
    title: '【福利降级之痛】大厂 Micro-Kitchen 寒冬与打包盒消失',
    description: '公司最新出台“降本增效 (Cost Optimization)”新政：免费晚餐取消外带打包盒以防“羊毛党”，Micro-Kitchen 里的奢华冷萃与高级酸奶被全面降级为 Costco 杂牌苏打水，连周五免费按摩福利都被无情砍掉。全司内网论坛与 Slack `#rant` 频道瞬间被破防的工程师们攻陷……',
    choices: [
      {
        text: '【下午 4 点突击扫荡茶水间】疯狂搜刮牛油果、希腊酸奶与高蛋白能量棒带回家',
        condition: (_s) => true,
        effect: (s) => ({
          cash: s.cash + 0.5,
          health: Math.min(100, s.health + 4),
          message: '【零食羊毛自救】你每天下午准时背着双肩包扫荡各楼层茶水间，靠着积攒的坚果酸奶不仅省下了饭钱，还补充了优质蛋白质 (现金 +$0.5w, 健康 +4)！'
        }),
        nextEventId: h1ToH2Router
      },
      {
        text: '【在内网发起联名请愿书】组织上千名工程师向 CEO 上书要求恢复零食等级',
        condition: (_s) => true,
        effect: (s) => ({
          charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 3),
          network: Math.min(100, (s.network || 10) + 6),
          message: '【打工人嘴替】你的请愿书一夜之间收获 2,000+ 个 Upvote，高管迫于舆论恢复了部分气泡水供应，你成了大家口中敢于发声的英雄！'
        }),
        nextEventId: h1ToH2Router
      },
      {
        text: '【心如止水，自带自制 Meal Prep 便当】彻底戒掉食堂高油高盐，专注养生减脂',
        condition: (_s) => true,
        effect: (s) => ({
          health: Math.min(100, s.health + 10),
          message: '【养生生活自律】你买了全套玻璃保鲜盒，周末提前备好一周的糙米鸡胸肉与西蓝花。告别了食堂后，肠胃更加轻盈，精力充沛 (健康 +10)！'
        }),
        nextEventId: h1ToH2Router
      }
    ]
  },

  // ============================ 非科班转码职场成长线 ============================
  'zhuanma_imposter_syndrome': {
    id: 'zhuanma_imposter_syndrome',
    title: '【转码阵痛】非科班冒名顶替综合征',
    description: '入职科技公司后，组内同事清一色是名校 CS 硕博。架构评审会上大家热烈讨论 Paxos 状态机、Linux 内核页锁与 B+ 树分裂，而你面对底层细节有些心虚，冒名顶替综合征 (Imposter Syndrome) 悄然而至……',
    oncePerLife: true,
    choices: [
      {
        text: '【熬夜爆肝 CS 基础四大件】恶补操作系统、计算机网络与数据库原理 (脱胎换骨)',
        condition: (_s) => true,
        effect: (s) => ({
          health: Math.max(0, s.health - 8),
          leetcode: Math.min(100, s.leetcode + 14),
          impact: addImpact(s, 8),
          message: '连续数月深夜死磕 CS 经典教材与 Linux 内核源码，你彻底补齐了非科班的理论短板，设计方案有理有据，组内技术大牛对你刮目相看！'
        }),
        nextEventId: h1ToH2Router
      },
      {
        text: '【扬长避短 · 发挥跨界沟通与业务交付优势】做团队不可替代的 Team Glue',
        condition: (_s) => true,
        effect: (s) => ({
          charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 4),
          network: Math.min(100, (s.network || 10) + 8),
          impact: addImpact(s, 6),
          message: '你把精力聚焦在跨部门业务协同与产品需求落地，用通俗易懂的人话向 PM 与业务方沟通，成为团队不可或缺的粘合剂！'
        }),
        nextEventId: h1ToH2Router
      }
    ]
  },

  'zhuanma_domain_crossover': {
    id: 'zhuanma_domain_crossover',
    title: '【跨界爆发】非科班专业复合优势降维打击',
    description: '公司技术委员会宣布开辟全新业务线（AI 医疗/计算生物/智能金融风控/工业自动化）。其他纯 CS 工程师对着专业论文和领域指标一筹莫展，而你的非 CS 本科背景让你一眼看穿痛点！',
    oncePerLife: true,
    choices: [
      {
        text: '【主动请缨担当跨界 Tech Lead】主导核心跨界系统架构，一鸣惊人！',
        condition: (_s) => true,
        effect: (s) => ({
          impact: addImpact(s, 16),
          cash: s.cash + 6,
          leetcode: Math.min(100, s.leetcode + 6),
          message: '凭借非科班的独特专业洞察与过硬代码，你提出的跨界架构方案直接解决了业务卡点，被破格指定为专项 Tech Lead 并获得高额专项奖金！'
        }),
        nextEventId: h1ToH2Router
      },
      {
        text: '【开源跨界工具链与撰写技术博客】打造技术影响力，成为领域红人',
        condition: (_s) => true,
        effect: (s) => ({
          impact: addImpact(s, 12),
          network: Math.min(100, (s.network || 10) + 12),
          charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 5),
          message: '你在 GitHub 上开源了该领域的垂直工具库，并在 Substack/Medium 发表深度架构解析，斩获数千 Star，成为湾区跨界转码的技术标杆！'
        }),
        nextEventId: h1ToH2Router
      }
    ]
  },

  'zhuanma_mentor_community': {
    id: 'zhuanma_mentor_community',
    title: '【同舟共济】硅谷转码互助圈与薪火相传',
    description: '你在硅谷职场站稳脚跟后，周末受邀参加湾区华人科技沙龙。一群同样来自生化环材与文商社科的转码留学生围着你请教经验，你仿佛看见了当年那个迷茫却坚毅的自己。',
    oncePerLife: true,
    choices: [
      {
        text: '【发起非科班转码公益 Mentorship】传道受业，广结善缘与人脉',
        condition: (_s) => true,
        effect: (s) => ({
          network: Math.min(100, (s.network || 10) + 14),
          charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 6),
          health: Math.min(100, s.health + 4),
          message: '你创办了硅谷非科班码农互助联盟，指导了数十名转码学弟学妹成功上岸，在湾区技术圈树立了极佳的口碑与人脉网络！'
        }),
        nextEventId: h1ToH2Router
      },
      {
        text: '【开设求职辅导与 1v1 Mock 课时】知识变现，拓展副业现金流',
        condition: (_s) => true,
        effect: (s) => ({
          cash: s.cash + 5,
          charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 3),
          message: '你利用业余时间提供专业的简历修改与 1v1 Mock 面试指导，扎实的经验广受学员好评，为你带来了 +$5w 丰厚的副业课时收入！'
        }),
        nextEventId: h1ToH2Router
      }
    ]
  },

  // 内部转组:换赛道破局。两个去向,各自【真正改变后续 H1 职场事件的走向】(team_focus 驱动
  // midYearEventRouter 的 H1 池)。TPM 线较大,待 PM 事件线 (#32) 落地后再补。
  'internal_team_transfer': {
    id: 'internal_team_transfer',
    title: '【内部转组】换道破局与赛道抉择',
    description: '厌倦了当前组的无休内耗、遭遇了 Toxic 老板，或想换个赛道重新出发？公司内部的 Internal Transfer 系统向你开放，选择未来的团队方向 (将持续影响你后续几年的职场事件走向)：',
    choices: [
      {
        text: '【转入核心攻坚组】投身前沿 AI / 大模型等最受高层关注的核心业务线 (高曝光·高强度·高上限)',
        reqBadge: '算法 ≥ 35',
        condition: (s) => s.leetcode >= 35,
        effect: (s) => ({
          mid_year: true, season_stage: 'h1',
          health: Math.max(0, s.health - 6),
          impact: addImpact(s, 8),
          tc: s.tc + 2.0,
          transferred_to_ai: true,
          story_flags: { ...(s.story_flags || {}), team_focus: 'ai_core', pip_warning: false, last_transfer_year: s.year },
          message: '【成功加入核心攻坚组】你顺利 Transfer 到了公司最受高层关注的核心业务线(前沿 AI / 大模型方向)！坐拥顶级曝光度与高额 Refresher 潜力，此后你会更频繁地卷入攻坚战役与高影响力机遇，但节奏明显变紧！(清空考评预警)',
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '【转入低压后台 / 工具支持组】神仙 WLB 准时打卡，远离线上 P0 警报 (养生回血/低压)',
        effect: (s) => ({
          mid_year: true, season_stage: 'h1',
          health: Math.min(100, s.health + 15),
          leetcode: Math.min(100, s.leetcode + 3),
          transferred_to_ai: false,
          story_flags: { ...(s.story_flags || {}), team_focus: 'wlb_tools', pip_warning: false, last_transfer_year: s.year },
          message: '【成功转入低压支持组】你转到了节奏极佳的内部工具/后台支持组，每天下午四点半准时下班，代码没有深夜 P0 警报。此后你会远离高压 PIP 与裁员风暴，身心彻底满血复活！(清空考评预警)',
        }),
        nextEventId: h1ToH2Router,
      },
    ],
  },

  // 低压支持组(team_focus:wlb_tools)的招牌逆境:没有 PIP/裁员刀光,但组织动荡(重组/外包/裁撤)
  // 频发 —— 给"安全但天花板低"的赛道补上一个真实的「不稳定」下行。安全选项恒在,无死局/无 game_over。
  'support_org_reorg': {
    id: 'support_org_reorg',
    title: '【组织动荡】低压组被并入 / 外包风波',
    description: '一纸重组邮件：你所在的低压后台/工具组被整建制并入其它部门，部分职能甚至要外包给 vendor。没有 PIP 与裁员的刀光，但你的 domain 说没就没，又得重新证明自己的位置。',
    choices: [
      {
        text: '【平级并入新组，业务从头再来】接受重组，跟着残余 domain 平移到新团队',
        effect: (s) => ({
          mid_year: true, season_stage: 'h1',
          impact: Math.max(0, (s.impact || 0) - 5),
          health: Math.max(0, s.health - 3),
          message: '你平级并入了新团队，过往积累的 domain 影响力大半清零，又要从头刷存在感。好在饭碗还在，节奏依旧不紧。'
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '【借组织动荡跳去核心攻坚组】既然要动，不如搏一把换到高曝光核心线',
        reqBadge: '算法 ≥ 35',
        condition: (s) => s.leetcode >= 35,
        effect: (s) => ({
          mid_year: true, season_stage: 'h1',
          transferred_to_ai: true,
          tc: s.tc + 1,
          impact: addImpact(s, 3),
          health: Math.max(0, s.health - 6),
          story_flags: { ...(s.story_flags || {}), team_focus: 'ai_core' },
          message: '你抓住重组的窗口主动申请转岗，成功挤进了公司最核心的攻坚业务线！曝光度与上限陡增，但从此告别养生节奏。'
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '【消极等一波 N+package】反正低压，索性躺着看会不会轮到自己拿赔偿',
        effect: (s) => {
          const cut = gameRandom() < 0.35;
          return cut
            ? { mid_year: true, season_stage: 'h1', cash: s.cash + 8, tc: 0, laid_off: true, job_type: 'unemployed' as const, company: undefined, health: Math.max(0, s.health - 4), message: '这波真轮到你了——不过 N+ 大礼包 (+$8w) 到账，你体面地被"优化"，转身重新找工作。' }
            : { mid_year: true, season_stage: 'h1', cash: s.cash + 2, health: Math.min(100, s.health + 3), message: '虚惊一场，重组的刀没落到你头上，还发了一笔留任小红包 (+$2w)，继续摸鱼。' };
        },
        nextEventId: (s) => s.laid_off ? 'job_hunt' : h1ToH2Router(s),
      },
    ],
  },

  // 核心攻坚组(team_focus:ai_core)的招牌逆境:高曝光=高政治。路线之争 + 抢功 —— 给"高上限"赛道补上
  // 一个真实的「政治修罗场」下行,和低压组的「组织动荡」形成对照。三选项覆盖 硬刚/站队/埋头 三种玩法。
  'ai_org_politics': {
    id: 'ai_org_politics',
    title: '【核心修罗场】路线之争与抢功政治',
    description: '核心攻坚组高曝光也高危：两位 Director 为技术路线明争暗斗，你的项目成了站队筹码；隔壁组还惦记着把你的核心模块抢过去写进他们的 promo packet。',
    choices: [
      {
        text: '【硬刚路线之争 · 抢核心项目主导权】在架构评审会上正面开战，争夺话语权',
        effect: (s) => {
          const win = gameRandom() < Math.min(0.7, 0.35 + (s.leetcode / 300) + ((s.network || 10) / 300));
          return win
            ? { mid_year: true, season_stage: 'h1', impact: addImpact(s, 10), tc: s.tc + 3, charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 2), health: Math.max(0, s.health - 6), message: '你在架构评审会上以数据和 demo 正面碾压，拿下核心项目主导权，高层背书加身，影响力大涨！' }
            : { mid_year: true, season_stage: 'h1', impact: Math.max(0, (s.impact || 0) - 6), health: Math.max(0, s.health - 8), message: '政治斗争败下阵来，你的核心模块被隔壁组抢走写进了他们的 promo，你沦为背景板，元气大伤。' };
        },
        nextEventId: h1ToH2Router,
      },
      {
        text: '【向 VP 靠拢站队】审时度势选边站，用汇报与关系经营换取庇护',
        effect: (s) => ({
          mid_year: true, season_stage: 'h1',
          charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 3),
          network: Math.min(100, (s.network || 10) + 5),
          impact: addImpact(s, 2),
          health: Math.max(0, s.health - 4),
          message: '你敏锐地押注了赢面更大的一方，虽没直接抢到项目，但站对了队、攒下政治资本与靠山。'
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '【专注技术不站队】埋头把活干好，不掺和办公室政治',
        effect: (s) => ({
          mid_year: true, season_stage: 'h1',
          leetcode: Math.min(100, s.leetcode + 6),
          impact: Math.max(0, (s.impact || 0) - 3),
          health: Math.max(0, s.health - 2),
          message: '你两耳不闻窗外事，技术精进了一截，但不站队让你在核心组的政治版图里被边缘化，影响力悄悄缩水。'
        }),
        nextEventId: h1ToH2Router,
      },
    ],
  }
};

