import type { GameEvent, GameState } from '../../types';
import { getLevelScaledTC, midYearEventRouter, h1ToH2Router, isOpportunityActiveThisYear, isTemporaryOrStudentHousing , gameRandom, o1PassProb } from './helpers';
import { getTCBreakdown, isCorporateEmployee } from '../../utils/gameStateSelectors';
import { isPermanentVisa } from '../../constants/gameConstants';

export const careerEvents: Record<string, GameEvent> = {
  'job_hunt': {
    id: 'job_hunt',
    title: '湾区求职季 / 职业方向抉择',
    description: '身处全球科技中心的湾区，你面临着下一阶段的人生与职业方向抉择。无论是积极重返大厂、动用人脉捷径，还是彻底换个赛道休养调养，命运全由你掌握：',
    choices: [
      {
        text: '【海投大厂社招/校招】闭关刷题备战，海投各大科技巨头开启 Onsite 面试',
        condition: (_s) => true,
        effect: (s) => {
          const isKingOfRoll = s.trait_title === '卷王之王';
          const drain = isKingOfRoll ? 6 : 12;
          const leetBonus = isKingOfRoll ? 18 : 12;
          const newLeet = s.leetcode + leetBonus;

          const allPool: Array<{ id: string; name: string; minLeet: number; weight: number }> = [
            { id: 'google', name: 'Google', minLeet: s.macro_economy === 'bear' ? 55 : (s.macro_economy === 'bull' ? 35 : 45), weight: 0.95 },
            { id: 'meta', name: 'Meta', minLeet: s.macro_economy === 'bear' ? 65 : (s.macro_economy === 'bull' ? 45 : 55), weight: 0.90 },
            { id: 'nvidia', name: 'NVIDIA', minLeet: s.macro_economy === 'bear' ? 60 : (s.macro_economy === 'bull' ? 40 : 48), weight: 0.90 },
            { id: 'tiktok', name: 'TikTok', minLeet: s.macro_economy === 'bear' ? 52 : (s.macro_economy === 'bull' ? 35 : 42), weight: 0.95 },
            { id: 'apple', name: 'Apple', minLeet: s.macro_economy === 'bear' ? 55 : (s.macro_economy === 'bull' ? 35 : 42), weight: 0.95 },
            { id: 'startup', name: 'AI Startup', minLeet: 32, weight: 1.05 },
          ];

          if (newLeet >= 70 || s.is_phd) {
            allPool.push({ id: 'openai', name: 'OpenAI', minLeet: s.macro_economy === 'bull' ? 70 : 75, weight: 0.65 });
          }

          const eligiblePool = allPool.filter(c => c.id !== s.company && c.id !== s.job_type);
          const targetCount = Math.min(eligiblePool.length, isKingOfRoll ? 4 : (gameRandom() < 0.45 ? 2 : 3));
          const targetCompanies = [...eligiblePool].sort(() => gameRandom() - 0.5).slice(0, targetCount);

          const wonOffers: string[] = [];
          const econBonus = s.macro_economy === 'bull' ? 0.14 : (s.macro_economy === 'bear' ? -0.20 : 0);
          const charmBonus = ((s.charm || 10) - 10) / 140;
          const luckBonus = ((s.luck || 20) - 20) / 300;

          for (const comp of targetCompanies) {
            if (newLeet >= comp.minLeet) {
              const diff = newLeet - comp.minLeet;
              const passProb = Math.max(0.06, Math.min(0.72, (0.20 + (diff / 85) + econBonus + charmBonus + luckBonus) * comp.weight));
              if (gameRandom() < passProb) {
                wonOffers.push(comp.id);
              }
            }
          }

          if (isKingOfRoll && wonOffers.length === 0 && newLeet >= 50 && targetCompanies.length > 0) {
            const fallback = targetCompanies[Math.floor(gameRandom() * targetCompanies.length)];
            wonOffers.push(fallback.id);
          }

          if (wonOffers.length === 0) {
            return {
              health: Math.max(0, s.health - drain),
              leetcode: newLeet,
              hop_applied_count: targetCompanies.length,
              hop_offers: [],
              message: s.macro_economy === 'bear'
                ? `【熊市寒冬·HC 冻结】科技股熊市下各大厂招聘收紧，简历多数石沉大海，多轮 Onsite 终面后均未发 Offer。好在今年狂刷算法与架构 (算法 +${leetBonus})，技术储备大涨！`
                : (newLeet < 40 
                  ? `【算法深度不足·遗憾未过】大厂面试 Bar 极高，系统设计与复杂算法未能打动面试委员会，投递的各家均未发 Offer。你利用这一年沉淀了扎实算法 (算法 +${leetBonus})！`
                  : `【名额有限·全挂遗憾】今年求职竞争极其白热化，几轮终面 Hiring Committee 均因名额有限未发 Offer。虽然暂时未上岸，但扎实的技术储备 (算法 +${leetBonus}) 实打实留存！`)
            };
          }

          const nameMap: Record<string, string> = {
            google: 'Google',
            meta: 'Meta',
            nvidia: 'NVIDIA',
            tiktok: 'TikTok',
            apple: 'Apple',
            openai: 'OpenAI',
            startup: 'AI Startup'
          };
          const offerNames = wonOffers.map(id => nameMap[id] || id).join('、');

          return {
            health: Math.max(0, s.health - drain),
            leetcode: newLeet,
            hop_applied_count: targetCompanies.length,
            hop_offers: wonOffers,
            message: wonOffers.length > 1
              ? `【大丰收！斩获 ${wonOffers.length} 份社招 Competing Offers】经过一整年的闭关刷题与疯狂面试轰炸 (算法 +${leetBonus})，你成功斩获了 ${offerNames} 的正式录用 Offer！请选择入职去向：`
              : `【斩获录取 Offer】经过一整年的闭关刷题与多轮 Onsite 面试 (算法 +${leetBonus})，你顺利拿下了 ${offerNames} 的正式录用 Offer！请选择入职去向：`
          };
        },
        nextEventId: (s: GameState) => {
          const offers = s.hop_offers || [];
          if (offers.length > 0) return 'job_hop_market';
          return 'job_hunt_fail';
        },
      },
      {
        text: '【强力人脉 Referral】凭借学长学姐/熟人总监直通大厂团队',
        reqBadge: '需人脉关系>=25',
        condition: (s) => (s.network || 0) >= 25,
        effect: (s) => {
          const lvl = s.level ? s.level : (s.is_phd ? 'L4' : 'L3');
          const referralPool = [
            { company: 'google', name: 'Google', baseTc: 20, healthDelta: 6, desc: '凭借强大人脉网络 (Referral)，熟人总监推荐你免除简历初筛无缝上岸 Google，享受顶尖 WLB！' },
            { company: 'meta', name: 'Meta', baseTc: 22, healthDelta: -10, desc: '在熟人 Tech Lead 的强力背书下，你直接拿下 Menlo Park Meta 核心组高额总包，但面临高强度挑战！' },
            { company: 'apple', name: 'Apple', baseTc: 20, healthDelta: 4, desc: '库比蒂诺 Apple 资深总监开绿灯，将你内推至 Apple Park 核心工程团队，发展平稳且福利丰厚！' },
            { company: 'microsoft', name: 'Microsoft', baseTc: 19, healthDelta: 8, desc: '微软云与 AI 部门熟人校友直接拉你入组，作息极度规律，生活质量拉满！' }
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
            message: chosen.desc
          };
        },
        nextEventId: (s: GameState) => {
          return isTemporaryOrStudentHousing(s) ? 'choose_housing' : 'sv_daily_life';
        },
      },
      {
        text: '【校友黑手党/教授内推】凭借名校校友网络与导师背书直通大厂',
        condition: (s) => s.school === 'cmu' || s.school === 'ucb' || s.is_phd,
        effect: (s) => {
          const lvl = s.level ? s.level : (s.is_phd ? 'L4' : 'L3');
          const mafiaTargets = [
            { company: 'google', name: 'Google (Infra 核心架构组)', tcBoost: 28, healthDrain: 8, desc: '名校校友直接将你内推进山景城 Googleplex 基础设施组！享受顶尖 WLB 与美味食堂。' },
            { company: 'meta', name: 'Meta (AI 算法与分布式系统)', tcBoost: 35, healthDrain: 16, desc: '校友总监将你拉入 Menlo Park Meta 核心组，拿到顶格包裹但面临高压节奏！' },
            { company: 'apple', name: 'Apple (Apple Park 架构团队)', tcBoost: 30, healthDrain: 6, desc: '校友学长内推你直通 Apple Park 架构团队，拥有极高稳定性与顶尖硬件生态！' },
            { company: 'uber', name: 'Uber (核心调度与分布式架构)', tcBoost: 32, healthDrain: 12, desc: '凭借名校金字招牌，校友学姐直接将你带入旧金山 Uber 核心团队！' }
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
            message: chosen.desc 
          };
        },
        nextEventId: (s: GameState) => {
          return isTemporaryOrStudentHousing(s) ? 'choose_housing' : 'sv_daily_life';
        },
      },
      {
        text: '【急召外包 / ICC / 中型公司紧急避险】保住合法工签身份与基础现金流',
        condition: (_s) => true,
        effect: (s) => {
          const lvl = s.level ? s.level : (s.is_phd ? 'L4' : 'L3');
          const stateCompanies = [
            { company: 'cisco', name: 'Cisco 思科网络研发部', baseTc: 20 },
            { company: 'adobe', name: 'Adobe 圣何塞总部', baseTc: 22 },
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
          return isTemporaryOrStudentHousing(s) ? 'choose_housing' : 'sv_daily_life';
        },
      },
      {
        text: '【挑战顶级量化基金 (Quant)】冲击天价量化交易核心团队 (地狱门槛: 需 CS四大 或 PhD)',
        reqBadge: '仅限 CS四大/PhD',
        condition: (s) => (s.school === 'cmu' || s.is_phd),
        effect: (s) => {
          const econBonus = s.macro_economy === 'bull' ? 0.15 : s.macro_economy === 'bear' ? -0.15 : 0;
          let winRate = 0.15 + econBonus;
          if (s.leetcode >= 75) winRate += 0.30;
          else if (s.leetcode >= 60) winRate += 0.15;
          if (s.school === 'cmu' && s.is_phd) winRate += 0.20;
          winRate += (s.luck / 100) * 0.10;
          // Floor so a bear-market low-leetcode attempt isn't a guaranteed 0% loss.
          winRate = Math.max(0.05, winRate);

          const pass = gameRandom() < winRate;
          const lvl = s.level ? s.level : 'Quant';
          return pass 
            ? { tc: getLevelScaledTC(42, lvl), laid_off: false, cash: s.cash + 10, health: s.health - 15, job_type: 'quant', level: 'Quant', message: '凭顶尖名校与 PhD 学术背景！你击败了众多竞争者，拿下了顶级 Quant Fund 42w+ 包裹 Offer！' }
            : { health: s.health - 12, message: '量化基金的随机微积分与高频对冲数学题太烧脑了，你的简历或面经遗憾落选...' };
        },
        nextEventId: (s: GameState) => {
          if (s.tc < 40) return 'job_hunt';
          return isTemporaryOrStudentHousing(s) ? 'choose_housing' : 'sv_daily_life';
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
          return isTemporaryOrStudentHousing(s) ? 'choose_housing' : 'sv_daily_life';
        },
      },
      {
        text: '【转型全职 Day Trader 操盘】凭借 $50w 本金与自由身全职炒股操盘 (需美籍/绿卡 + 现金>=50w)',
        reqBadge: '需美籍/绿卡+现金>=50w',
        condition: (s) => (s.visa === '绿卡' || s.visa === '公民') && s.cash >= 50,
        effect: (_s) => ({
          job_type: 'trader',
          company: '全职 Day Trader',
          level: '全职 Trader',
          tc: 0,
          laid_off: false,
          message: '你决定不再看任何大厂 HR 与老板的脸色！凭借 $50w 初始本金与自由身，开启全职操盘人生！'
        }),
        nextEventId: 'trader_annual_strategy',
      },
      {
        text: '【转型全职 Founder 科技创业】前往 Sand Hill Road 寻找 VC 融资开搞 Startup (需美籍/绿卡/O1 或 现金>=45w)',
        reqBadge: '需美籍/绿卡/O1或现金>=45w',
        condition: (s) => (s.visa === '绿卡' || s.visa === '公民' || s.visa === 'O1 (杰出人才)') || s.cash >= 45,
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
        nextEventId: 'founder_annual_strategy',
      }
    ]
  },

  'job_hunt_fail': {
    id: 'job_hunt_fail',
    title: '求职受挫',
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
        nextEventId: 'job_hunt',
      },
      {
        text: '去墨西哥 Tijuana 闯关重签签证 (高风险 Visa Run) - 消耗 $1w',
        condition: (s) => s.cash >= 1 && (s.visa === 'OPT (实习)' || s.visa === 'H1B (工签)'),
        effect: (s) => {
          const win = gameRandom() > 0.15; // 85% success
          return win
            ? { cash: s.cash - 1, health: s.health - 15, leetcode: s.leetcode + 5, message: '心惊胆战地越过美墨边境，你奇迹般地拿到了新的签证 Stamp！争取到了宝贵的留美时间！' }
            : { status: 'game_over', message: '在边境小黑屋被海关查出挂靠历史，直接吊销签证并被 5 年禁令限制入境！' };
        },
        nextEventId: (s) => s.status === 'game_over' ? 'end' : 'job_hunt',
      },
      {
        text: '不卷了！回大理/清迈做数字游民躺平',
        condition: (s) => s.cash >= 5,
        effect: (s) => ({ 
          status: 'win', 
          imageUrl: 'images/dali_relax.jpg', 
          message: '你带着几万美元的积蓄去了大理。每天喝咖啡、看苍山洱海。虽然彻底脱离了硅谷的内卷，但你找到内心的平静！(大理躺平结局)' 
        }),
        nextEventId: 'end',
      },
      {
        text: '放弃求职 / 离开硅谷',
        effect: (s) => {
          const reason = (s.visa === '公民' || s.visa === '绿卡') 
            ? '对硅谷内卷与就业市场彻底失望，你选择带上积蓄离开了加州湾区。' 
            : ((s.visa === 'F1 (学生)' || s.visa === '无') 
                ? 'OPT到期未能上岸，你最终遗憾登上了回国的航班。' 
                : 'H1B 60天失业期满未能找到新工作，你最终遗憾登上了回国的航班。');
          return { status: 'game_over', message: reason };
        },
        nextEventId: 'end',
      },
      {
        text: '再读一个水硕维持身份 (Day 1 CPT) - (消耗 $5w)',
        condition: (s) => s.visa !== '绿卡' && s.visa !== '公民' && s.visa !== 'O1 (杰出人才)' && s.cash >= 5,
        effect: (s) => ({ visa: 'Day 1 CPT', cpt_used: true, cash: s.cash - 5, age: s.age + 1, leetcode: Math.min(100, s.leetcode + 25), message: '你在读 Day 1 CPT 水硕期间狂刷 250 道 Hard 题，算法功力大增！准备重回战场！' }),
        nextEventId: 'job_hunt',
      }
    ]
  },

  'job_hop_market': {
    id: 'job_hop_market',
    title: '湾区跳槽季：多重 Offer 签约抉择',
    description: '经过一整年的多轮 Onsite 厮杀与算法洗礼，各大厂 HR 陆续向你发来了正式录用意向！\n\n【注意】跳槽将重置未获批 I-140 的 PERM 排期；新公司入职第一年往往伴随高压 Ramp-up 考验。请根据你的包裹意向与职业规划，慎重签署正式合同：',
    choices: [
      {
        text: '【签约入职 Google】降压养老，享受顶尖 WLB、美味食堂与稳健股票',
        condition: (s) => (s.hop_offers ? s.hop_offers.includes('google') : s.company !== 'google'),
        effect: (s) => {
          const isNewHire = !s.level || s.job_type === 'unemployed' || !s.job_type;
          const nextLvl = isNewHire ? (s.is_phd ? 'L4' : 'L3') : (s.level === 'L3' ? 'L4' : s.level === 'L4' ? 'L5 (Senior)' : s.level === 'L5 (Senior)' ? 'L6 (Staff)' : s.level === 'L6 (Staff)' ? 'L7 (Senior Staff)' : s.level === 'L7 (Senior Staff)' ? 'L8 (Principal)' : s.level);
          const baseBand = nextLvl === 'L8 (Principal)' ? 120 : nextLvl === 'L7 (Senior Staff)' ? 82 : nextLvl === 'L6 (Staff)' ? 58 : nextLvl === 'L5 (Senior)' ? 42 : nextLvl === 'L4' ? 30 : 22;
          const econMultiplier = s.macro_economy === 'bull' ? 1.15 : s.macro_economy === 'bear' ? 0.90 : 1.0;
          const newTC = Math.max(s.tc + 4, Math.floor(baseBand * econMultiplier));

          return {
            company: 'google',
            job_type: 'big_tech',
            level: nextLvl, last_promo_age: s.age, // level-up (hop/story win): mark the promotion moment so the celebration routing + grade clock are correct
            tc: newTC,
            health: Math.min(100, s.health + 12),
            laid_off: false,
            is_new_job: true,
            message: `【成功入职 Google】顺利入职山景城 Googleplex！享受顶级养老福利与免费美食，职级定级为 ${nextLvl}，锁定年薪总包 ${newTC}w！`
          };
        },
        nextEventId: (s) => (isTemporaryOrStudentHousing(s) ? 'choose_housing' : (s.level === 'L8 (Principal)' ? 'l8_principal_celebration' : s.level === 'L7 (Senior Staff)' ? 'l7_senior_staff_celebration' : s.level === 'L6 (Staff)' ? 'l6_staff_celebration' : midYearEventRouter(s))),
      },
      {
        text: '【签约入职 Meta】加入卷王之王，挑战高压核心架构冲刺顶格 Package',
        condition: (s) => (s.hop_offers ? s.hop_offers.includes('meta') : s.company !== 'meta'),
        effect: (s) => {
          const isNewHire = !s.level || s.job_type === 'unemployed' || !s.job_type;
          const nextLvl = isNewHire ? (s.is_phd ? 'L4' : 'L3') : (s.level === 'L3' ? 'L4' : s.level === 'L4' ? 'L5 (Senior)' : s.level === 'L5 (Senior)' ? 'L6 (Staff)' : s.level === 'L6 (Staff)' ? 'L7 (Senior Staff)' : s.level === 'L7 (Senior Staff)' ? 'L8 (Principal)' : s.level);
          const baseBand = nextLvl === 'L8 (Principal)' ? 135 : nextLvl === 'L7 (Senior Staff)' ? 92 : nextLvl === 'L6 (Staff)' ? 65 : nextLvl === 'L5 (Senior)' ? 46 : nextLvl === 'L4' ? 34 : 25;
          const econMultiplier = s.macro_economy === 'bull' ? 1.20 : s.macro_economy === 'bear' ? 0.90 : 1.0;
          const newTC = Math.max(s.tc + 6, Math.floor(baseBand * econMultiplier));

          return {
            company: 'meta',
            job_type: 'big_tech',
            level: nextLvl, last_promo_age: s.age, // level-up (hop/story win): mark the promotion moment so the celebration routing + grade clock are correct
            tc: newTC,
            cash: s.cash + (s.macro_economy === 'bull' ? 8 : 4),
            health: Math.max(0, s.health - 15),
            laid_off: false,
            is_new_job: true,
            message: `【卷入 Meta 核心架构】手握硬核代码入职 Menlo Park！职级跃升至 ${nextLvl}，总包大幅飙升至 ${newTC}w！但新人高压 Oncall 让你身心紧绷 (健康 -15)。`
          };
        },
        nextEventId: (s) => (isTemporaryOrStudentHousing(s) ? 'choose_housing' : (s.level === 'L8 (Principal)' ? 'l8_principal_celebration' : s.level === 'L7 (Senior Staff)' ? 'l7_senior_staff_celebration' : s.level === 'L6 (Staff)' ? 'l6_staff_celebration' : midYearEventRouter(s))),
      },
      {
        text: '【签约入职 NVIDIA】加入显卡巨头，吃满 AI 算力与芯片狂飙红利',
        condition: (s) => (s.hop_offers ? s.hop_offers.includes('nvidia') : s.company !== 'nvidia'),
        effect: (s) => {
          const isBull = s.macro_economy === 'bull' || s.year >= 2023;
          const isNewHire = !s.level || s.job_type === 'unemployed' || !s.job_type;
          const nextLvl = isNewHire ? (s.is_phd ? 'L4' : 'L3') : (s.level === 'L3' ? 'L4' : s.level === 'L4' ? 'L5 (Senior)' : s.level === 'L5 (Senior)' ? 'L6 (Staff)' : s.level === 'L6 (Staff)' ? 'L7 (Senior Staff)' : s.level === 'L7 (Senior Staff)' ? 'L8 (Principal)' : s.level);
          const baseBand = nextLvl === 'L8 (Principal)' ? 130 : nextLvl === 'L7 (Senior Staff)' ? 90 : nextLvl === 'L6 (Staff)' ? 64 : nextLvl === 'L5 (Senior)' ? 45 : nextLvl === 'L4' ? 33 : 24;
          const econMultiplier = isBull ? 1.25 : (s.macro_economy === 'bear' ? 0.90 : 1.0);
          const newTC = Math.max(s.tc + 5, Math.floor(baseBand * econMultiplier));

          return {
            company: 'nvidia',
            job_type: 'nvidia',
            level: nextLvl, last_promo_age: s.age, // level-up (hop/story win): mark the promotion moment so the celebration routing + grade clock are correct
            tc: newTC,
            cash: s.cash + (isBull ? 4 : 2),
            laid_off: false,
            is_new_job: true,
            message: isBull
              ? `【赶上 AI 芯片大风口】皮衣黄显卡霸权！你拿到了高 RSU 占比的 NVIDIA 芯片团队包裹，职级定为 ${nextLvl}，年薪总包跃升至 ${newTC}w！`
              : `【入职英伟达】成功入职芯片工程团队，职级定为 ${nextLvl}，锁定 ${newTC}w 稳健软硬件结合大包！`
          };
        },
        nextEventId: (s) => (isTemporaryOrStudentHousing(s) ? 'choose_housing' : (s.level === 'L8 (Principal)' ? 'l8_principal_celebration' : s.level === 'L7 (Senior Staff)' ? 'l7_senior_staff_celebration' : s.level === 'L6 (Staff)' ? 'l6_staff_celebration' : midYearEventRouter(s))),
      },
      {
        text: '【签约入职 TikTok / 字节】接手中美跨时区核心业务，拿顶格全现金包裹',
        condition: (s) => (s.hop_offers ? s.hop_offers.includes('tiktok') : s.company !== 'tiktok'),
        effect: (s) => {
          const isNewHire = !s.level || s.job_type === 'unemployed' || !s.job_type;
          const nextLvl = isNewHire ? (s.is_phd ? 'L4' : 'L3') : (s.level === 'L3' ? 'L4' : s.level === 'L4' ? 'L5 (Senior)' : s.level === 'L5 (Senior)' ? 'L6 (Staff)' : s.level === 'L6 (Staff)' ? 'L7 (Senior Staff)' : s.level === 'L7 (Senior Staff)' ? 'L8 (Principal)' : s.level);
          const baseBand = nextLvl === 'L8 (Principal)' ? 140 : nextLvl === 'L7 (Senior Staff)' ? 95 : nextLvl === 'L6 (Staff)' ? 68 : nextLvl === 'L5 (Senior)' ? 48 : nextLvl === 'L4' ? 33 : 24;
          const econMultiplier = s.macro_economy === 'bull' ? 1.18 : (s.macro_economy === 'bear' ? 0.90 : 1.0);
          const newTC = Math.max(s.tc + 6, Math.floor(baseBand * econMultiplier));

          return {
            company: 'tiktok',
            job_type: 'big_tech',
            level: nextLvl, last_promo_age: s.age, // level-up (hop/story win): mark the promotion moment so the celebration routing + grade clock are correct
            tc: newTC,
            cash: s.cash + 10,
            health: Math.max(0, s.health - 15),
            laid_off: false,
            is_new_job: true,
            message: `【入职字节跳动】字节开出巨额全现金 Sign-on 奖金！职级定级为 ${nextLvl}，年薪总包锁定至 ${newTC}w！但深夜跨时区对齐让你睡眠严重不足 (健康 -15)。`
          };
        },
        nextEventId: (s) => (isTemporaryOrStudentHousing(s) ? 'choose_housing' : (s.level === 'L8 (Principal)' ? 'l8_principal_celebration' : s.level === 'L7 (Senior Staff)' ? 'l7_senior_staff_celebration' : s.level === 'L6 (Staff)' ? 'l6_staff_celebration' : midYearEventRouter(s))),
      },
      {
        text: '【签约入职 OpenAI / AI 实验室】加入 AGI 最前沿，拿到天价 MTS 架构师包裹',
        condition: (s) => (s.hop_offers ? s.hop_offers.includes('openai') : s.company !== 'openai'),
        effect: (s) => ({
          company: 'openai',
          job_type: 'ai_research',
          level: 'MTS',
          tc: Math.max(s.tc + 22, 68),
          cash: s.cash + 8,
          health: Math.max(0, s.health - 10),
          laid_off: false,
          is_new_job: true,
          message: `【斩获 OpenAI MTS 天价大包】顶级行业光环！你以 Member of Technical Staff 身份加入前沿大模型团队，TC 跃升至 ${Math.max(s.tc + 22, 68)}w！`
        }),
        nextEventId: (s) => (isTemporaryOrStudentHousing(s) ? 'choose_housing' : midYearEventRouter(s)),
      },
      {
        text: '【签约入职 AI Startup 初创团队】降薪赌一把早期核心员工期权大饼 (高风险高回报)',
        condition: (s) => (s.hop_offers ? s.hop_offers.includes('startup') : s.job_type !== 'startup'),
        effect: (s) => ({
          company: 'startup',
          job_type: 'startup',
          stocks: (s.stocks || 0) + 18,
          tc: Math.max(16, Math.floor((s.tc || 20) * 0.85)),
          health: Math.max(0, s.health - 10),
          laid_off: false,
          is_new_job: true,
          message: '【加入 AI Startup】你接受了一家顶级风投领投的早期初创团队 Offer！虽然现金略微下调，但分到了极其丰厚的早期期权股份！'
        }),
        // Route to the employee-at-startup episode (keeps startup_work reachable now
        // that the founder paths correctly go to founder_annual_strategy).
        nextEventId: (s) => (isTemporaryOrStudentHousing(s) ? 'choose_housing' : 'startup_work'),
      },
      {
        text: '【签约入职 Apple】加入库比蒂诺巨头，享受极致稳定性与顶尖硬件生态',
        condition: (s) => (s.hop_offers ? s.hop_offers.includes('apple') : s.company !== 'apple'),
        effect: (s) => {
          const isNewHire = !s.level || s.job_type === 'unemployed' || !s.job_type;
          const nextLvl = isNewHire ? (s.is_phd ? 'L4' : 'L3') : (s.level === 'L3' ? 'L4' : s.level === 'L4' ? 'L5 (Senior)' : s.level === 'L5 (Senior)' ? 'L6 (Staff)' : s.level === 'L6 (Staff)' ? 'L7 (Senior Staff)' : s.level === 'L7 (Senior Staff)' ? 'L8 (Principal)' : s.level);
          const baseBand = nextLvl === 'L8 (Principal)' ? 125 : nextLvl === 'L7 (Senior Staff)' ? 86 : nextLvl === 'L6 (Staff)' ? 60 : nextLvl === 'L5 (Senior)' ? 44 : nextLvl === 'L4' ? 32 : 24;
          const econMultiplier = s.macro_economy === 'bull' ? 1.15 : s.macro_economy === 'bear' ? 0.90 : 1.0;
          const newTC = Math.max(s.tc + 5, Math.floor(baseBand * econMultiplier));

          return {
            company: 'apple',
            job_type: 'big_tech',
            level: nextLvl, last_promo_age: s.age, // level-up (hop/story win): mark the promotion moment so the celebration routing + grade clock are correct
            tc: newTC,
            health: Math.min(100, s.health + 10),
            laid_off: false,
            is_new_job: true,
            message: `【入职 Apple Park】顺利通过库比蒂诺架构团队审核！职级定级为 ${nextLvl}，锁定年薪总包 ${newTC}w！享受极佳的稳定性与员工折扣！`
          };
        },
        nextEventId: (s) => (isTemporaryOrStudentHousing(s) ? 'choose_housing' : (s.level === 'L8 (Principal)' ? 'l8_principal_celebration' : s.level === 'L7 (Senior Staff)' ? 'l7_senior_staff_celebration' : s.level === 'L6 (Staff)' ? 'l6_staff_celebration' : midYearEventRouter(s))),
      },
      {
        text: '【拿 Competing Offer 原地 Match】拿着外部 Offer 找现任老板谈薪，就地加薪并保留原厂排期',
        condition: (s) => !s.laid_off && !!s.job_type && s.job_type !== 'unemployed' && s.job_type !== 'trader' && s.job_type !== 'startup_founder' && !!s.hop_offers && s.hop_offers.length >= 1,
        effect: (s) => ({
          tc: s.tc + 4.5,
          health: Math.min(100, s.health + 5),
          message: '【成功 Counter-Offer】老板为了挽留你连夜向 HR 申请了特别加薪 (+4.5w TC)！你零搬迁成本、零 PERM 重置风险，继续在原厂稳步发展！'
        }),
        nextEventId: midYearEventRouter,
      },
      {
        text: '【留任原厂】看好原厂股票与团队氛围，婉拒全部外部 Offer',
        condition: (s) => !s.laid_off && !!s.job_type && s.job_type !== 'unemployed' && s.job_type !== 'trader' && s.job_type !== 'startup_founder',
        effect: () => ({
          message: '你经过慎重考虑，决定婉拒外部机会，继续深耕原厂业务。'
        }),
        nextEventId: midYearEventRouter,
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
        nextEventId: midYearEventRouter,
      }
    ]
  },

  'big_tech_work': {
    id: 'big_tech_work',
    title: '开启打工生涯',
    description: '你正式开启了职场生涯，成为了光荣的湾区码农。接下来要面临第一道坎：H1B 抽签。',
    imageUrl: 'images/h1b_lottery_win.jpg',
    choices: [
      {
        text: '老老实实祈祷 H1B 中签 (免费)',
        effect: (s) => {
          const winRate = 0.25 + (s.luck / 100) * 0.15; // 25% - ~40%, realistic H1B lottery odds
          const win = gameRandom() < winRate;
          return win 
            ? { visa: (s.visa === '公民' || s.visa === '绿卡') ? s.visa : 'H1B (工签)', h1b_attempts: 1, cash: s.cash, imageUrl: 'images/h1b_lottery_win.jpg', message: '人品爆发，第一年 H1B 就成功中签！顺利解决在美工签身份！' }
            : { h1b_attempts: 1, cash: s.cash, health: s.health - 5, message: '第一年 H1B 没抽中！已自动激活 STEM OPT 延期，继续在大厂奋斗并可在年底迎来后续抽签！' };
        },
        nextEventId: (s) => (!isPermanentVisa(s.visa) && s.visa !== 'H1B (工签)' && s.visa !== 'O1 (杰出人才)' && gameRandom() < 0.35 ? 'h1b_fallback_options' : 'sv_daily_life'),
      },
      {
        text: '砸 $8w 现金找顶级律所申办 O1 杰出人才签证 (需现金 >= $8w, 限 PhD/AI研究员/硬核算法背景)',
        reqBadge: '现金>=8w+超凡背景',
        condition: (s) => (s.is_phd || s.job_type === 'ai_research' || s.job_type === 'quant' || s.leetcode >= 85) && s.cash >= 8 && s.visa !== '绿卡' && s.visa !== '公民',
        effect: (s) => {
          const passProb = o1PassProb(s);
          const win = gameRandom() < passProb;
          return win
            ? { visa: (s.visa === '公民' || s.visa === '绿卡') ? s.visa : 'O1 (杰出人才)', cash: s.cash - 8, message: '凭硬核的学术论文与顶会引用，律所成功帮你拿下了 O1 杰出人才签证！彻底摆脱了抽签大坑！' }
            : { cash: s.cash - 8, health: Math.max(0, s.health - 15), message: '移民局以“缺乏行业顶尖影响力与独创贡献”退回了你的 O1 申请！$8w 律师费彻底打了水漂。' };
        },
        nextEventId: 'sv_daily_life',
      },
      {
        text: '【钞能力直接上岸】出资申办 EB-5 投资移民绿卡 (花费 $80w 现金)',
        reqBadge: '现金>=80w',
        condition: (s) => (s.cash + (s.stocks || 0)) >= 80 && s.visa !== '绿卡' && s.visa !== '公民',
        effect: (s) => ({ visa: '绿卡', gc_progress: 5, gc_stage: 'approved', cash: s.cash - 80, message: '凭家里雄厚的资金实力，直接出资 $80w 办妥了新法 EB-5 投资移民绿卡，跳过一切工签抽签直接上岸！' }),
        nextEventId: 'post_green_card',
      },
      {
        text: '【真爱伴侣结婚】与交往伴侣领证递交 I-130/I-485 婚姻绿卡 (合法合规)',
        condition: (s) => (s.relationship_status === 'dating' || s.relationship_status === 'matched' || s.is_married) && s.visa !== '绿卡' && s.visa !== '公民',
        effect: (s) => {
          const partnerIsCitizen = gameRandom() < 0.40;
          if (partnerIsCitizen) {
            return {
              visa: '绿卡',
              gc_progress: 5,
              gc_stage: 'approved',
              is_married: true,
              relationship_status: 'married',
              message: '【美籍配偶秒批绿卡】伴侣拥有美国公民/绿卡身份，领证后为你递交了 I-130/I-485 双递交申请，顺利获批婚姻绿卡，彻底解决留美身份！'
            };
          }
          return {
            is_married: true,
            relationship_status: 'married',
            gc_progress: Math.max(3, s.gc_progress || 0),
            gc_stage: s.gc_stage === 'not_started' ? 'i140_approved' : s.gc_stage,
            message: '【双职工携手奋斗】你们正式领证步入婚姻！不过伴侣同样处于 H1B/PERM 排期长征中。双方虽结为双职工家庭并互相绑定绿卡排期，但仍需等待排期推进或继续维持合法工签！'
          };
        },
        nextEventId: (s) => s.visa === '绿卡' ? 'post_green_card' : 'sv_daily_life',
      },
      {
        text: '【付费商婚上岸】支付 $8w 现金找中介匹配公民商婚领证 (需现金 >= $8w, 极高风险)',
        reqBadge: '现金>=8w (高风险)',
        condition: (s) => (!s.relationship_status || s.relationship_status === 'single') && s.cash >= 8 && s.visa !== '绿卡' && s.visa !== '公民',
        effect: (s) => {
          const roll = gameRandom();
          if (roll < 0.35) {
            return {
              cash: s.cash - 8,
              visa: '绿卡',
              gc_progress: 5,
              gc_stage: 'approved',
              is_married: true,
              relationship_status: 'married',
              message: '【侥幸过关】你支付了 $8w 现金成功通过了移民局 Stokes 严苛分室问话，侥幸拿到了临时绿卡！'
            };
          } else if (roll < 0.70) {
            return {
              cash: s.cash - 8,
              health: Math.max(0, s.health - 15),
              message: '【人财两空】中介收到 $8w 现金后直接拉黑断联卷款潜逃，假结婚对象人间蒸发！你血亏 $8w 现金且身份自救彻底失败！'
            };
          } else {
            return {
              cash: s.cash - 8,
              status: 'game_over',
              message: '【移民欺诈立案】移民局 FDNS 突击搜查认定商婚欺诈，联邦大陪审团正式起诉，你被当场收押遣返并终身禁入美国，游戏结束！'
            };
          }
        },
        nextEventId: (s) => s.status === 'game_over' ? 'end' : (s.visa === '绿卡' ? 'post_green_card' : 'sv_daily_life'),
      }
    ]
  },

  'sv_daily_life': {
    id: 'sv_daily_life',
    title: '湾区日常 (行动面板)',
    description: '又是新的一年。每年湾区都会涌现出不同的限时行业机遇，合理分配你的精力吧！',
    choices: [
      // 1. 【每年专属动态轮替机遇池】 (每年动态激活 1~2 个专属限时奇遇)
      {
        text: '【限时机遇：独角兽挖角】收到前沿 AI 独角兽 VP 亲自发来的免初筛直通终面邀请',
        condition: (s) => isOpportunityActiveThisYear(s, 'opp_cursor_hunt') && !s.laid_off && !!s.job_type && s.job_type !== 'unemployed' && s.job_type !== 'startup_founder' && s.job_type !== 'trader' && s.last_limited_opp_year !== s.year,
        hideIfUnavailable: true,
        effect: (s) => {
          const pass = s.leetcode >= 45 && gameRandom() < 0.65;
          if (pass) {
            return {
              last_limited_opp_year: s.year,
              tc: s.tc + 12.0,
              stocks: (s.stocks || 0) + 15.0,
              health: Math.max(0, s.health - 12),
              is_new_job: true,
              company: 'openai',
              level: 'MTS',
              message: '【斩获独角兽核心 Offer】你在终面架构评审中征服了创始人！职级定级为 MTS，总包大涨 +$12.0w TC 并配发 $15.0w 早期流动性期权！'
            };
          }
          return {
            last_limited_opp_year: s.year,
            health: Math.max(0, s.health - 10),
            leetcode: s.leetcode + 4,
            message: '【独角兽面试折戟】独角兽终面对于底层系统优化要求极高，虽然遗憾未能拿下 Offer，但硬核技术视野收获颇丰。'
          };
        },
        nextEventId: 'sv_daily_life',
      },
      {
        text: '【限时机遇：黑客松夺冠】组队参加斯坦福 TreeHacks 极客马拉松 ($0.5w)',
        condition: (s) => isOpportunityActiveThisYear(s, 'opp_treehacks') && s.cash >= 0.5 && s.last_limited_opp_year !== s.year,
        hideIfUnavailable: true,
        effect: (s) => {
          const win = gameRandom() < (0.15 + s.leetcode / 600);
          return win
            ? { last_limited_opp_year: s.year, cash: s.cash + 8, leetcode: s.leetcode + 10, charm: Math.min(25, (s.charm || 10) + 3), message: '【Hackathon 夺冠】比赛通宵 48 小时！你们的 Demo 拿下了全场总冠军！硅谷顶级天使投资人现场开出 $30w 支票支持团队继续研发，作为核心开发你分到了 $8w！' }
            : { last_limited_opp_year: s.year, cash: s.cash - 0.5, health: Math.max(0, s.health - 15), leetcode: s.leetcode + 8, message: '【Hackathon 陪跑】连续通宵两天喝了 8 罐红牛，虽然Demo演示时服务器崩溃没拿奖，但你结识了一群技术极客。' };
        },
        nextEventId: 'sv_daily_life',
      },
      {
        text: '【限时机遇：硬核破圈】考取 Palo Alto 机场固定翼私人飞行员执照 (PPL) ($2.5w)',
        condition: (s) => isOpportunityActiveThisYear(s, 'opp_pilot_license') && s.cash >= 2.5 && s.last_limited_opp_year !== s.year,
        hideIfUnavailable: true,
        effect: (s) => ({
          last_limited_opp_year: s.year,
          cash: s.cash - 2.5,
          charm: Math.min(25, (s.charm || 10) + 5),
          luck: Math.min(99, (s.luck || 20) + 6),
          message: '【考取飞行执照】你成功通过 FAA 单飞考核拿到了私人飞行员执照！周末开着塞斯纳俯瞰金门大桥，在湾区社交圈名声大噪！'
        }),
        nextEventId: 'sv_daily_life',
      },
      {
        text: '【限时机遇：科技狂欢】前往内华达沙漠参加火人节 (Burning Man) 极客大迁徙 ($1.2w)',
        condition: (s) => isOpportunityActiveThisYear(s, 'opp_burning_man') && s.cash >= 1.2 && s.last_limited_opp_year !== s.year,
        hideIfUnavailable: true,
        effect: (s) => ({
          last_limited_opp_year: s.year,
          cash: s.cash - 1.2,
          health: Math.min(100, s.health + 10),
          charm: Math.min(25, (s.charm || 10) + 4),
          luck: Math.min(99, (s.luck || 20) + 8),
          message: '【火人节洗礼】你在黑石城沙漠参加了 Burning Man，虽然风沙与昼夜狂欢有些耗费体力，但灵性觉醒彻底清空了精神内耗，并结识了一批硅谷前沿极客！'
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
          message: '【拓展顶层人脉】在沙丘路红木私宅里结识了数位顶级 VC 合伙人与独角兽创始人，手握核心行业内幕与优质天使跟投名额！'
        }),
        nextEventId: 'sv_daily_life',
      },
      {
        text: '【限时机遇：硅谷朝圣】抢购 NVIDIA GTC 大会 VIP 门票进场见黄仁勋 ($1.5w)',
        condition: (s) => isOpportunityActiveThisYear(s, 'opp_gtc_nvidia') && s.cash >= 1.5 && s.last_limited_opp_year !== s.year,
        hideIfUnavailable: true,
        effect: (s) => ({
          last_limited_opp_year: s.year,
          cash: s.cash - 1.5,
          charm: Math.min(25, (s.charm || 10) + 5),
          luck: Math.min(99, (s.luck || 20) + 12),
          message: '【参加 GTC】你在 GTC 大会前排拿到了黄仁勋签名的黑色皮衣同款折扇！接下来的投资和求职将获得强运加持！'
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
            ? { last_limited_opp_year: s.year, cash: s.cash + 8, leetcode: s.leetcode + 5, message: '【提交漏洞】安全部门确认了你提交的高危提权漏洞！向你的账户汇入了 $8w 漏洞赏金！' }
            : { last_limited_opp_year: s.year, health: Math.max(0, s.health - 8), message: '【提交漏洞】安全团队回应称这是“预期设计 (Works as Intended)”，白白研究了三天。' };
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
                charm: Math.min(25, (s.charm || 10) + 4),
                message: '【测评爆火】你连续肝夜剪出的 AI Agent 深度评测视频在 YouTube 和小红书大爆！收割了 $4.3w 广告赞助 (净赚 $3.5w)！'
              }
            : {
                last_limited_opp_year: s.year,
                cash: s.cash - 0.8,
                health: Math.max(0, s.health - 5),
                charm: Math.min(25, (s.charm || 10) + 2),
                message: '【流量平平】视频遭遇了平台算法限流，虽然熬夜没能回本，但积累了宝贵的自媒体剪辑与运营经验。'
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
          message: '【成功拍下法拍房】你在 Courthouse 拍卖中以超低折扣拿下东湾翻新独立屋！快速完成招租，每年产生 +$2.5w 净被动租金现金流！'
        }),
        nextEventId: 'sv_daily_life',
      },
      {
        text: '【限时机遇：自然疗愈】前往 Yosemite 优胜美地极限徒步，远离 Slack 消息彻底养生回血',
        condition: (s) => isOpportunityActiveThisYear(s, 'opp_yosemite_heal') && s.health < 80 && s.last_limited_opp_year !== s.year,
        hideIfUnavailable: true,
        effect: (s) => ({
          last_limited_opp_year: s.year,
          health: Math.min(100, s.health + 16),
          charm: Math.min(25, (s.charm || 10) + 2),
          message: '【优胜美地洗肺】登顶半穹顶 (Half Dome)！清脆的瀑布声与高山森林让你洗尽了硅谷职场的心灵内耗，身体机能全面回血！'
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
                message: '【天使投资神话】该 AI 团队仅用 6 个月便斩获红杉 A 轮领投！公司估值暴涨 5 倍，你的天使股份价值跃升至 $40w！'
              }
            : {
                last_limited_opp_year: s.year,
                cash: s.cash - 10,
                message: '【天使投资沉淀】初创项目在激烈内卷中遭遇巨头降维打击，资金正在艰难摸索 PMF 转型，暂未实现估值爆发。'
              };
        },
        nextEventId: 'sv_daily_life',
      },
      {
        text: '【限时机遇：赛道竞速】带爱车参加 Laguna Seca 赛道日 GT 极限竞速与名流聚会 ($1.8w)',
        condition: (s) => isOpportunityActiveThisYear(s, 'opp_laguna_seca') && s.cash >= 1.8 && (s.car === 'porsche' || s.car === 'cybertruck') && s.last_limited_opp_year !== s.year,
        hideIfUnavailable: true,
        effect: (s) => ({
          last_limited_opp_year: s.year,
          cash: s.cash - 1.8,
          health: Math.min(100, s.health + 10),
          charm: Math.min(25, (s.charm || 10) + 5),
          luck: Math.min(99, (s.luck || 20) + 8),
          message: '【极限竞速狂飙】在 Laguna Seca 标志性的螺旋弯道留下胎印！极速推背感清空了所有压力，更在 VIP Paddock 结识了一圈超跑车友！'
        }),
        nextEventId: 'sv_daily_life',
      },

      // 2. 【情境定制动态专属】 (根据公司、婚姻、财富阶层动态生成)
      {
        text: '【大厂战时冲刺】主动认领 S-Level 核心架构重构，硬抗高压冲刺顶格 Perf',
        condition: (s) => (s.company === 'meta' || s.job_type === 'tiktok' || s.job_type === 'nvidia' || s.company === 'amazon' || s.job_type === 'amazon') && !s.laid_off && !!s.job_type && s.job_type !== 'unemployed',
        hideIfUnavailable: true,
        effect: (s) => {
          const curLevel = s.level || (s.job_type === 'quant' ? 'Quant' : s.job_type === 'ai_research' ? 'MTS' : s.is_phd ? 'L4' : 'L3');
          const lastPromoAge = s.last_promo_age ?? (s.age - 1);
          const yearsInGrade = s.age - lastPromoAge;
          const isKingOfRoll = s.trait_title === '卷王之王';
          const drain = isKingOfRoll ? 8 : 14;
          const winRate = 0.38 + (s.leetcode / 250) + ((s.charm || 10) * 0.01) + (isKingOfRoll ? 0.15 : 0);
          const pass = gameRandom() < Math.min(0.85, winRate);

          if (pass) {
            if (curLevel === 'L3') {
              // L3 升 L4 要求算法 >= 30 (若满2年资历门槛放宽至 25)
              if (yearsInGrade >= 1 && (s.leetcode >= 30 || yearsInGrade >= 2) && (gameRandom() < 0.88 || isKingOfRoll)) {
                return { mid_year: true, season_stage: 'h1', health: Math.max(0, s.health - drain), tc: s.tc + 4.0, level: 'L4', last_promo_age: s.age, message: isKingOfRoll ? '【战时冲刺大捷】卷王之王神功大成！你凭借硬核架构交付拿下 Top Perf 轻松破格晋升至 L4！' : '【战时冲刺成功】你带领组员完成核心交付！拿下顶格 Top Perf 顺利晋升至 L4！总包调升 +$4.0w！' };
              }
            }
            if (curLevel === 'L4') {
              // L4 升 L5 Senior 要求算法 >= 48 (若满3年资历门槛放宽至 40)
              if (yearsInGrade >= 1 && (s.leetcode >= 48 || yearsInGrade >= 3) && (gameRandom() < 0.75 || isKingOfRoll)) {
                return { mid_year: true, season_stage: 'h1', health: Math.max(0, s.health - Math.min(15, Math.max(12, drain + 2))), tc: s.tc + 6.5, level: 'L5 (Senior)', last_promo_age: s.age, message: isKingOfRoll ? '【战时冲刺大捷】抗下千亿流量重构！卷王底蕴爆发，全票通过晋升委员会晋级 L5 Senior！' : '【战时冲刺成功】扛下千亿流量大促！顺利通过升职委员会，正式晋升为 L5 Senior！总包调升 +$6.5w！' };
              }
            }
            if ((curLevel === 'L5 (Senior)' || curLevel === 'L5') && yearsInGrade >= 2 && s.leetcode >= 65 && (s.charm || 10) >= 15 && (s.network || 10) >= 25) {
              // L6 Staff 非常难 (最高 18% 胜率)
              const promoChance = 0.05 + ((s.charm || 10) * 0.003) + ((s.network || 10) * 0.003) + (isKingOfRoll ? 0.05 : 0);
              if (gameRandom() < Math.min(0.18, promoChance)) {
                return { mid_year: true, season_stage: 'h1', health: Math.max(0, s.health - 15), tc: s.tc + 12.0, level: 'L6 (Staff)', last_promo_age: s.age, message: isKingOfRoll ? '【战时冲刺大捷】打破硅谷天花板！凭借极硬核架构与强大人脉资源，破格晋升为万里挑一的 L6 Staff 架构师！' : '【战时冲刺成功】你拉拢跨组部门资源并主导架构落地，奇迹晋升为 L6 Staff 架构师！总包大幅调升 +$12w！' };
              }
            }
            if ((curLevel === 'L6 (Staff)' || curLevel === 'Staff' || curLevel === 'MTS') && yearsInGrade >= 2 && s.leetcode >= 70 && (s.charm || 10) >= 16 && (s.network || 10) >= 35) {
              const promoChance = 0.16 + ((s.charm || 10) * 0.005) + ((s.network || 10) * 0.004) + (isKingOfRoll ? 0.08 : 0);
              if (gameRandom() < Math.min(0.33, promoChance)) {
                return { mid_year: true, season_stage: 'h1', health: Math.max(0, s.health - 15), tc: s.tc + 20.0, level: 'L7 (Senior Staff)', last_promo_age: s.age, message: isKingOfRoll ? '【战时冲刺大捷】统帅战略基建！在 VP 盟友背书与跨部门拉拢中，全票通过晋升为 L7 Senior Staff 资深架构师！' : '【战时冲刺成功】你凭借雄厚的高管人脉与战略领导力重塑公司架构，正式晋升为 L7 Senior Staff 资深架构师！总包调升 +$20w！' };
              }
            }
            if ((curLevel === 'L7 (Senior Staff)' || curLevel === 'Senior Staff' || curLevel === 'L7') && yearsInGrade >= 2 && s.leetcode >= 80 && (s.charm || 10) >= 20 && (s.network || 10) >= 50) {
              const promoChance = 0.10 + ((s.charm || 10) * 0.002) + ((s.network || 10) * 0.002) + (isKingOfRoll ? 0.04 : 0);
              if (gameRandom() < Math.min(0.20, promoChance)) {
                return { mid_year: true, season_stage: 'h1', health: Math.max(0, s.health - 15), tc: s.tc + 35.0, level: 'L8 (Principal)', last_promo_age: s.age, message: isKingOfRoll ? '【战时冲刺大捷】封神之路！获董事会联合推举与行业泰斗声望，破格登顶 L8 Principal 首席架构师/技术院士！' : '【战时冲刺成功】你在董事会闭门会议中赢得一致赞誉，登顶全公司屈指可数的 L8 Principal 首席架构师！总包暴涨 +$35w！' };
              }
            }
            return { mid_year: true, season_stage: 'h1', health: Math.max(0, s.health - drain), tc: s.tc + 3.0, message: '【战时冲刺成功】虽然你的技术与人脉指标已全部达标，但由于今年部门 Headcount Quota 紧张，升职名额顺延至明年，仅拿下了 Top Perf 顶格绩效大包 (+3.0w TC)。' };
          }
          return { mid_year: true, season_stage: 'h1', health: Math.max(0, s.health - drain), tc: s.tc + 1.0, message: '【高压内卷苦战】虽然抗住了高强度 Oncall，但因为大厂组织架构调整，功劳被大领导收割，只拿到了普调。' };
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
            return 'promo_celebration';
          }
          return midYearEventRouter(s);
        },
      },
      {
        text: '【大厂 WLB 漫步】享受充裕生活平衡，申请内部 Transfer 探索前沿大模型组',
        condition: (s) => (s.company === 'google' || s.company === 'apple' || s.job_type === 'big_tech') && !s.laid_off && !!s.job_type && s.job_type !== 'unemployed' && !s.transferred_to_ai,
        hideIfUnavailable: true,
        effect: (s) => {
          const curLevel = s.level || (s.job_type === 'quant' ? 'Quant' : s.job_type === 'ai_research' ? 'MTS' : s.is_phd ? 'L4' : 'L3');
          const lastPromoAge = s.last_promo_age ?? (s.age - 1);
          const yearsInGrade = s.age - lastPromoAge;
          const pass = s.leetcode >= 25 || gameRandom() < 0.75;
          
          // L3 / L4 自然晋升机制：要求算法达到标准且有一定资历
          if (curLevel === 'L3' && ((yearsInGrade >= 2 && s.leetcode >= 30) || (yearsInGrade >= 1 && s.leetcode >= 40))) {
            return {
              mid_year: true, season_stage: 'h1', transferred_to_ai: true,
              level: 'L4', tc: s.tc + 3.5, last_promo_age: s.age,
              health: Math.min(100, s.health + 10), leetcode: s.leetcode + 4,
              message: '【大厂自然晋升】在 Apple/Google 稳定的 WLB 节奏中，凭借扎实的算法与稳健的项目交付，你水到渠成顺利晋升为 L4 工程师！总包调升 +$3.5w！'
            };
          }
          if (curLevel === 'L4' && ((yearsInGrade >= 3 && s.leetcode >= 45) || (yearsInGrade >= 2 && s.leetcode >= 55))) {
            return {
              mid_year: true, season_stage: 'h1', transferred_to_ai: true,
              level: 'L5 (Senior)', tc: s.tc + 6.0, last_promo_age: s.age,
              health: Math.min(100, s.health + 10), leetcode: s.leetcode + 4,
              message: '【大厂稳健晋升】在大厂舒适的工作节奏中稳扎稳打，你凭借多年架构沉淀顺利通过评审晋升为 L5 Senior 工程师！总包调升 +$6.0w！'
            };
          }

          return pass
            ? { mid_year: true, season_stage: 'h1', transferred_to_ai: true, health: Math.min(100, s.health + 10), leetcode: s.leetcode + 4, tc: s.tc + 1.5, message: '【成功转岗】顺利 Transfer 到了前沿 AI 研发组！既拥有神仙级的 WLB 作息，又接触到了顶尖行业架构！' }
            : { mid_year: true, season_stage: 'h1', health: Math.min(100, s.health + 10), message: '【安稳养老】原组 Manager 极力挽留，你继续享受着下午 5 点准时下班的惬意大厂时光。' };
        },
        nextEventId: (s) => (s.last_promo_age === s.age ? 'promo_celebration' : midYearEventRouter(s)),
      },
      {
        text: '【前沿 AI 团队攻坚】主导大模型低延迟推理架构落地，兼顾神仙级 WLB',
        condition: (s) => (s.company === 'google' || s.company === 'apple' || s.job_type === 'big_tech') && !s.laid_off && !!s.job_type && s.job_type !== 'unemployed' && !!s.transferred_to_ai,
        hideIfUnavailable: true,
        effect: (s) => {
          const curLevel = s.level || (s.job_type === 'quant' ? 'Quant' : s.job_type === 'ai_research' ? 'MTS' : s.is_phd ? 'L4' : 'L3');
          const lastPromoAge = s.last_promo_age ?? (s.age - 1);
          const yearsInGrade = s.age - lastPromoAge;
          const pass = s.leetcode >= 30 || gameRandom() < 0.75;

          if (curLevel === 'L3' && ((yearsInGrade >= 2 && s.leetcode >= 30) || (yearsInGrade >= 1 && s.leetcode >= 40))) {
            return {
              mid_year: true, season_stage: 'h1',
              level: 'L4', tc: s.tc + 3.5, last_promo_age: s.age,
              health: Math.min(100, s.health + 8), leetcode: s.leetcode + 3, cash: s.cash + 1.0,
              message: '【AI 组自然晋升】凭借扎实的算法与 AI 推理架构交付，你顺利在神仙 WLB 组晋升为 L4 工程师！总包调升 +$3.5w！'
            };
          }
          if (curLevel === 'L4' && ((yearsInGrade >= 3 && s.leetcode >= 45) || (yearsInGrade >= 2 && s.leetcode >= 55))) {
            return {
              mid_year: true, season_stage: 'h1',
              level: 'L5 (Senior)', tc: s.tc + 6.0, last_promo_age: s.age,
              health: Math.min(100, s.health + 8), leetcode: s.leetcode + 3, cash: s.cash + 1.0,
              message: '【AI 组稳健晋升】你在前沿 AI 大模型团队的主导产出获得全组认可，正式晋升为 L5 Senior 工程师！总包调升 +$6.0w！'
            };
          }

          return pass
            ? { mid_year: true, season_stage: 'h1', health: Math.min(100, s.health + 8), leetcode: s.leetcode + 3, cash: s.cash + 1.0, message: '【AI 架构落地】你负责的低延迟推理架构性能翻倍，获得组内一致好评，工作与生活达到完美平衡！' }
            : { mid_year: true, season_stage: 'h1', health: Math.min(100, s.health + 10), message: '【惬意养老】AI 组内节奏舒适，你在按部就班维护系统的同时，每天喝下午茶写技术博客。' };
        },
        nextEventId: (s) => (s.last_promo_age === s.age ? 'promo_celebration' : midYearEventRouter(s)),
      },
      {
        text: '【初创生死发版】通宵配合 VC 尽调与产品上线，为公司千万级融资做技术背书',
        condition: (s) => s.job_type === 'startup' && !s.laid_off,
        hideIfUnavailable: true,
        effect: (s) => {
          const winRate = 0.20 + (s.leetcode / 400) + ((s.luck || 20) / 400);
          const win = gameRandom() < Math.min(0.65, winRate);
          return win
            ? { mid_year: true, season_stage: 'h1', health: Math.max(0, s.health - 15), cash: s.cash + 5, stocks: (s.stocks || 0) + 10, message: '【融资大捷】公司顺利拿下 A 轮千万美金融资！你的期权估值大涨并分到了 $5w 现金绩效奖金！' }
            : { mid_year: true, season_stage: 'h1', health: Math.max(0, s.health - 15), leetcode: s.leetcode + 5, message: '【技术硬仗】一人干完了三人的全栈活，虽然融资推迟，但全套云原生与 Agent 架构让你技术实力全面蜕变。' };
        },
        nextEventId: midYearEventRouter,
      },
      // 3. 【常规年度重心】 (点击后进入年中/年底结算)
      {
        text: '【年度重心：疯狂内卷】拼命加班冲 Perf，争取加薪与升职',
        condition: (s) => !!s.job_type && s.job_type !== 'unemployed' && s.job_type !== 'trader' && s.job_type !== 'startup_founder' && !s.laid_off,
        effect: (s) => {
          const curLevel = s.level || (s.job_type === 'quant' ? 'Quant' : s.job_type === 'ai_research' ? 'MTS' : s.is_phd ? 'L4' : 'L3');
          const lastPromoAge = s.last_promo_age ?? (s.age - 1);
          const yearsInGrade = s.age - lastPromoAge;
          const isKingOfRoll = s.trait_title === '卷王之王';
          const drain = isKingOfRoll ? 8 : 14;
          
          const baseWinRate = 0.15 + (s.leetcode / 300) + ((s.charm || 10) * 0.015) + ((s.network || 10) * 0.01) + (isKingOfRoll ? 0.15 : 0);
          const pass = gameRandom() < Math.min(0.78, baseWinRate);

          if (curLevel === 'L3') {
            // L3 升 L4 要求算法 >= 35 (达标且满 1 年晋升率极高，若满 2 年算法门槛可放宽至 30)
            if (s.leetcode < 30 && yearsInGrade < 2) return { mid_year: true, season_stage: 'h1', health: Math.max(0, s.health - drain), tc: s.tc + 0.5, message: 'Manager 指出你的代码产出与算法基础还不够扎实 (建议算法>=35)，建议多提升技术硬实力。' };
            const l3PassRate = 0.70 + (s.leetcode / 200) + (isKingOfRoll ? 0.20 : 0) + (yearsInGrade >= 2 ? 0.25 : 0);
            if (yearsInGrade >= 1 && (s.leetcode >= 30 || yearsInGrade >= 2) && (gameRandom() < Math.min(0.95, l3PassRate) || yearsInGrade >= 2 || isKingOfRoll)) {
              return { mid_year: true, season_stage: 'h1', health: Math.max(0, s.health - drain), tc: s.tc + 3.5, level: 'L4', last_promo_age: s.age, message: isKingOfRoll ? '【卷王破格晋升】做题家底蕴彻底释放，你的 Perf 拿下顶格 EE 绩效轻松晋升至 L4！' : '恭喜！凭借过硬的算法功底与稳定交付，你顺利晋升为 L4 工程师！总包调薪 +$3.5w！' };
            }
          } else if (curLevel === 'L4') {
            // L4 升 L5 (Senior) 要求算法 >= 50 (资深工程师是硅谷终身职级 Terminal Level，多数人在 2~3 年内达成)
            if (s.leetcode < 45 && yearsInGrade < 2) return { mid_year: true, season_stage: 'h1', health: Math.max(0, s.health - (drain + 2)), tc: s.tc + 1.0, message: '晋升委员会认为你的技术深度还不到 Senior 级别 (建议算法>=50)，独立项目主导深度需进一步沉淀。' };
            const l4PassRate = 0.55 + (s.leetcode / 250) + ((s.charm || 10) * 0.01) + (isKingOfRoll ? 0.20 : 0) + (yearsInGrade >= 2 ? 0.25 : 0);
            if (yearsInGrade >= 1 && (s.leetcode >= 45 || yearsInGrade >= 3) && (gameRandom() < Math.min(0.90, l4PassRate) || (yearsInGrade >= 3 && s.leetcode >= 40) || isKingOfRoll)) {
              return { mid_year: true, season_stage: 'h1', health: Math.max(0, s.health - (drain + 2)), tc: s.tc + 6.0, level: 'L5 (Senior)', last_promo_age: s.age, message: '轰动全组！你主导了核心子模块交付，顺利晋升为 L5 Senior 资深工程师！总包调薪 +$6.0w！' };
            }
          } else if (curLevel === 'L5 (Senior)' || curLevel === 'L5') {
            // L5 升 L6 (Staff) 非常难 (天花板天堑，要求极高架构力、跨组影响力与 VP Sponsor)
            const promoChance = 0.05 + ((s.charm || 10) * 0.003) + ((s.network || 10) * 0.003) + (isKingOfRoll ? 0.05 : 0);
            if (s.leetcode >= 65 && (s.charm || 10) >= 15 && (s.network || 10) >= 25 && s.health >= 35 && s.tc >= 30 && yearsInGrade >= 2 && pass && gameRandom() < Math.min(0.18, promoChance)) {
              return { mid_year: true, season_stage: 'h1', health: Math.max(0, s.health - 15), tc: s.tc + 12.0, level: 'L6 (Staff)', last_promo_age: s.age, message: '奇迹登顶！你打破硅谷天花板，结合顶层架构产出与全公司影响力，成功晋升为万里挑一的 L6 Staff 架构师！总包调升 +$12w！' };
            }
          } else if (curLevel === 'L6 (Staff)' || curLevel === 'Staff' || curLevel === 'MTS') {
            const promoChance = 0.10 + ((s.charm || 10) * 0.003) + ((s.network || 10) * 0.003) + (isKingOfRoll ? 0.05 : 0);
            if (s.leetcode >= 70 && (s.charm || 10) >= 16 && (s.network || 10) >= 35 && s.health >= 40 && s.tc >= 45 && yearsInGrade >= 2 && pass && gameRandom() < Math.min(0.20, promoChance)) return { mid_year: true, season_stage: 'h1', health: Math.max(0, s.health - 15), tc: s.tc + 20.0, level: 'L7 (Senior Staff)', last_promo_age: s.age, message: '战略突围！凭借高层 VP Sponsor 与跨部门整合能力，全票通过晋升为 L7 Senior Staff 资深架构师！总包狂飙 +$20w！' };
          } else if (curLevel === 'L7 (Senior Staff)' || curLevel === 'Senior Staff' || curLevel === 'L7') {
            const promoChance = 0.08 + ((s.charm || 10) * 0.002) + ((s.network || 10) * 0.002) + (isKingOfRoll ? 0.04 : 0);
            if (s.leetcode >= 80 && (s.charm || 10) >= 20 && (s.network || 10) >= 50 && s.health >= 45 && s.tc >= 65 && yearsInGrade >= 2 && pass && gameRandom() < Math.min(0.15, promoChance)) return { mid_year: true, season_stage: 'h1', health: Math.max(0, s.health - 15), tc: s.tc + 35.0, level: 'L8 (Principal)', last_promo_age: s.age, message: '硅谷封神！凭借全公司顶级声望与董事会强力支持，获聘为全公司屈指可数的 L8 Principal 首席架构师！总包调升 +$35w！' };
          }
          const meritBonus = gameRandom() < 0.35 ? 2.0 : 1.0;
          return { mid_year: true, season_stage: 'h1', health: Math.max(0, s.health - drain), tc: s.tc + meritBonus, message: isKingOfRoll ? `【卷王日常高产】你高质高效交付了核心模块，拿到了项目奖金 (+${meritBonus}w TC)！` : `你拼命熬夜写代码，拿到了项目奖金 (+${meritBonus}w TC)！Manager：“今年部门升职 Quota 紧张，你的指标已入库，明年一定为你申请！”` };
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
            return 'promo_celebration';
          }
          return midYearEventRouter(s);
        },
      },
      {
        text: '【年度重心：刷题跳槽】闭关刷题备战，海投湾区各大厂/独角兽发起社招面试',
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
            { id: 'nvidia', name: 'NVIDIA', minLeet: s.macro_economy === 'bear' ? 60 : (s.macro_economy === 'bull' ? 40 : 48), weight: 0.90 },
            { id: 'tiktok', name: 'TikTok', minLeet: s.macro_economy === 'bear' ? 52 : (s.macro_economy === 'bull' ? 35 : 42), weight: 0.95 },
            { id: 'apple', name: 'Apple', minLeet: s.macro_economy === 'bear' ? 55 : (s.macro_economy === 'bull' ? 35 : 42), weight: 0.95 },
            { id: 'startup', name: 'AI Startup', minLeet: 32, weight: 1.05 },
          ];

          if (newLeet >= 70 || s.is_phd) {
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

          for (const comp of targetCompanies) {
            if (newLeet >= comp.minLeet) {
              const diff = newLeet - comp.minLeet;
              const passProb = Math.max(0.06, Math.min(0.72, (0.20 + (diff / 85) + econBonus + charmBonus + luckBonus) * comp.weight));
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
            nvidia: 'NVIDIA',
            tiktok: 'TikTok',
            apple: 'Apple',
            openai: 'OpenAI',
            startup: 'AI Startup'
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
          return midYearEventRouter(s);
        },
      },
      {
        text: '【年度重心：拓展副业】经营小红书与独立开发',
        condition: (s) => true,
        effect: (s) => {
          if (s.leetcode >= 40 && gameRandom() < (0.05 + (s.luck || 20) / 500)) {
            return { mid_year: true, season_stage: 'h1', cash: s.cash + 35, leetcode: s.leetcode + 5, health: Math.max(0, s.health - 15), message: '你做出的套壳 AI 产品在 Product Hunt 上登顶了！有资本用 35 万美元收购了你的项目！' };
          }
          let winRate = (s.charm || 10) >= 12 ? 0.9 : ((s.charm || 10) >= 7 ? 0.6 : 0.2);
          if (gameRandom() < winRate) {
            if ((s.charm || 10) >= 20 && gameRandom() < 0.05) return { mid_year: true, season_stage: 'h1', cash: s.cash + 48, charm: Math.min(25, (s.charm || 10) + 5), health: Math.max(0, s.health - 10), message: '极小概率的奇迹！你的小红书粉丝突破 100 万！获得了大牌广告代言费！' };
            return { mid_year: true, season_stage: 'h1', cash: s.cash + 8, charm: Math.min(25, (s.charm || 10) + 2), health: Math.max(0, s.health - 15), message: '接到了几笔软广赞助，涨了不少粉，但非常疲惫。' };
          }
          return { mid_year: true, season_stage: 'h1', cash: Math.max(0, s.cash - 2), health: Math.max(0, s.health - 15), message: '独立开发没人用，小红书没人看，倒贴钱还心累。' };
        },
        nextEventId: midYearEventRouter,
      },
      // --- 3. 【全职 Trader 专属年度决策】 ---
      {
        text: '【全职操盘：深入美股 0DTE 末日轮与龙头博弈】根据市场宏观波动态势深入操盘',
        condition: (s) => s.job_type === 'trader',
        hideIfUnavailable: true,
        effect: () => ({ message: '你打开了多个 Bloomberg 终端与 TradingView 多屏图表，准备开始全职操盘策略布局！' }),
        nextEventId: 'trader_annual_strategy',
      },
      {
        text: '【量化套利：手写 Python/C++ 自动交易网格系统】部署低延迟机房，自动捕获 Alpha 收益',
        condition: (s) => s.job_type === 'trader',
        hideIfUnavailable: true,
        effect: (s) => {
          const leetBonus = Math.min(0.08, (s.leetcode / 1000));
          const ecoBonus = s.macro_economy === 'bull' ? 0.06 : (s.macro_economy === 'bear' ? 0.02 : 0.04);
          const yieldRate = 0.08 + leetBonus + ecoBonus;
          const profit = Math.min(25, Math.max(6, s.cash * yieldRate));
          return {
            mid_year: true, season_stage: 'h1',
            tc: 0,
            cash: parseFloat((s.cash + profit).toFixed(1)),
            leetcode: s.leetcode + 4,
            health: Math.min(100, s.health + 6),
            message: `【量化算法自动赚钱】你编写的自动套利脚本在 AWS 低延迟服务器全自动跑通！免去了手动盯盘的精神压力，算法稳健捕获 +$${profit.toFixed(1)}w Alpha 超额收益！`
          };
        },
        nextEventId: h1ToH2Router,
      },
      {
        text: '【量化私董会：在沙丘路路演实盘收益与募集资金】扩大操盘资金池与管理分成 (花费 $0.5w)',
        condition: (s) => s.job_type === 'trader' && s.cash >= 0.5,
        hideIfUnavailable: true,
        effect: (s) => ({
          mid_year: true, season_stage: 'h1',
          tc: 0,
          cash: parseFloat((s.cash - 0.5 + 4.5).toFixed(1)),
          network: Math.min(100, (s.network || 0) + 3),
          charm: Math.min(25, (s.charm || 10) + 2),
          health: Math.max(0, s.health - 2),
          message: '【斩获 LP 管理费分红】你在量化私董会上凭借优秀的夏普比率惊艳全场，数位科技新贵与天使 LP 委托你打理资金池，获得 +$4.0w 净管理分红！'
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '【金盆洗手：结束操盘生涯重返大厂】重新海投大厂面试，锁定稳定高额总包与 WLB',
        condition: (s) => s.job_type === 'trader',
        hideIfUnavailable: true,
        effect: (s) => ({
          job_type: 'unemployed',
          laid_off: true,
          company: undefined,
          level: undefined,
          message: '你决定结束个人操盘手生涯，落袋为安，带着充沛的本金重新开启大厂求职！'
        }),
        nextEventId: 'job_hunt',
      },

      // --- 4. 【全职 Startup Founder 专属年度决策】 ---
      {
        text: '【创业攻坚：沙丘路路演融资与全明星团队扩张】前往 Sand Hill Road 推进下一轮估值',
        condition: (s) => s.job_type === 'startup_founder',
        hideIfUnavailable: true,
        effect: () => ({ message: '你整理好了最新的 MRR 增长曲线与 Pitch Deck，前往沙丘路约见顶级 VC 合伙人！' }),
        nextEventId: 'founder_annual_strategy',
      },
      {
        text: '【产品冲刺：死磕产品 PMF 与企业级大单签单】冲刺 ARR 经常性收入并拿下企业采购',
        condition: (s) => s.job_type === 'startup_founder',
        hideIfUnavailable: true,
        effect: (s) => ({
          mid_year: true, season_stage: 'h1',
          health: Math.max(0, s.health - 8),
          cash: parseFloat((s.cash + 5).toFixed(1)),
          company_valuation: (s.company_valuation || 180) + 350,
          message: '【ARR 稳步破 $50w 美元！】经过半年高强度产品迭代与上门攻坚，公司拿下多家科技企业采购合同，实现微利造血与创始人分红！'
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '【公关引爆：TechCrunch Disrupt 巅峰演讲与病毒式获客】登上顶级科技峰会做 Live Demo',
        condition: (s) => s.job_type === 'startup_founder',
        hideIfUnavailable: true,
        effect: (s) => ({
          mid_year: true, season_stage: 'h1',
          health: Math.max(0, s.health - 4),
          network: Math.min(100, (s.network || 0) + 3),
          charm: Math.min(25, (s.charm || 10) + 2),
          company_valuation: (s.company_valuation || 180) + 200,
          message: '【Live Demo 技惊全场！】你在 TechCrunch Disrupt 上的演讲登上 Hacker News 首页，吸引了上千名早期极客用户注册体验！'
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '【终局退场：申请巨头并购 Acqui-hire 或折价清盘】卸下创始人重担，回归职场',
        condition: (s) => s.job_type === 'startup_founder',
        hideIfUnavailable: true,
        effect: () => ({ message: '你开始与意向买家与董事会评估并购协议与清盘退场条款。' }),
        nextEventId: 'founder_annual_strategy',
      },

      // --- 5. 【慢生活 Gap Year / 待业探索 专属年度决策】 ---
      {
        text: '【慢生活深度休养：红木森林徒步、瑜伽与环球旅行】彻底远离内卷与焦虑 (花费 $0.5w)',
        condition: (s) => Boolean(s.laid_off || s.job_type === 'unemployed' || !s.job_type),
        hideIfUnavailable: true,
        effect: (s) => ({
          mid_year: true, season_stage: 'h1',
          health: Math.min(100, s.health + 22),
          charm: Math.min(25, (s.charm || 10) + 3),
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
        effect: (s) => ({
          story_flags: {
            ...(s.story_flags || {}),
            in_gap_year: false
          },
          message: '身心满血恢复！你重新打开了 LinkedIn 与简历，准备以最佳精神面貌进军湾区职场！'
        }),
        nextEventId: 'job_hunt',
      },

      // --- 6. 【通用职业转换与置业决策】 ---
      {
        text: '【年度重心：投资理财】研究美股财报与大盘，寻找重仓暴富机会 (需现金 >= $15w)',
        condition: (s) => s.cash >= 15 && s.job_type !== 'trader',
        effect: (s) => ({
          mid_year: true, season_stage: 'h1',
          health: Math.max(0, s.health - 15),
          message: '今年你花了大把时间盯盘、听财报电话会，试图在股市中加速财务自由！'
        }),
        nextEventId: 'stock_market_annual_gamble',
      },
      {
        text: '【年度重心：活跃社交】参加派对聚会，扩充人脉与寻觅良缘',
        condition: (s) => true,
        effect: (s) => ({
          mid_year: true, season_stage: 'h1',
          health: Math.max(0, s.health - 10),
          charm: Math.min(25, (s.charm || 10) + 3),
          message: '你把今年的精力都花在了社交上，颜值打扮都有所提升。'
        }),
        nextEventId: (s) => !s.is_married ? 'dating_market' : midYearEventRouter(s),
      },
      {
        text: '【离职全职 Day Trader】凭 $50w 本金与美籍/绿卡自由身全职操盘 (需美籍/绿卡 + 现金>=50w)',
        reqBadge: '需美籍/绿卡+现金>=50w',
        condition: (s) => (s.visa === '绿卡' || s.visa === '公民') && s.cash >= 50 && s.job_type !== 'trader' && s.job_type !== 'startup_founder',
        effect: (_s) => ({
          job_type: 'trader',
          company: '全职 Day Trader',
          level: '全职 Trader',
          tc: 0,
          laid_off: false,
          message: '你正式递交了离职辞呈！凭借 $50w 初始本金与美籍/绿卡自由身，开启了全职 Day Trader 操盘人生！'
        }),
        nextEventId: 'trader_annual_strategy',
      },
      {
        text: '【离职全职 AI/科技创业】拒绝大厂打工，前往 Sand Hill Road (沙丘路) 寻找 VC 融资 (需美籍/绿卡/O1 或 现金>=45w办理O1创业工签)',
        reqBadge: '需美籍/绿卡/O1或现金>=45w',
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
            cash: needsO1 ? s.cash - 5 : s.cash,
            visa: needsO1 ? 'O1 (杰出人才)' : s.visa,
            message: needsO1
              ? '你拒绝了稳健的大厂打工路，花 $5w 律师费办妥了 O1-A 创业杰出人才工签，在 San Mateo 租下一间 Garage，以 $180w Pre-Seed 估值开启了全职 Founder 极客创业！'
              : '你拒绝了稳健的大厂打工路，凭自由身份在 San Mateo 租下一间 Garage，以 $180w Pre-Seed 估值开启了全职 Founder 极客创业！'
          };
        },
        nextEventId: 'founder_annual_strategy',
      },
      {
        text: '【置业安家】进军湾区加价抢房大乱斗 (Sunnyvale老破小/San Jose联排/Fremont学区房)',
        condition: (s) => (s.cash + (s.stocks || 0)) >= 40 && !s.has_housing,
        hideIfUnavailable: true,
        effect: () => ({ message: '你准备好了首付款支票，踏入了火热的湾区 Open House 抢房战场！' }),
        nextEventId: 'buy_house',
      },
      {
        text: '【改善居住】重新选择湾区租房标准或退租挂壁睡车顶',
        condition: (s) => !s.has_housing || s.rent > 0,
        hideIfUnavailable: true,
        effect: () => ({ message: '你打开了 Zillow 与租房中介微信群，准备调整住房开销。' }),
        nextEventId: 'change_rental',
      },
      {
        text: '【年度重心：佛系躺平】宅家打游戏养生，不管世事',
        condition: (_s) => true,
        effect: (s) => ({
          mid_year: true, season_stage: 'h1',
          health: Math.min(100, s.health + 18),
          leetcode: Math.max(0, s.leetcode - 8),
          message: '这一年你彻底躺平摸鱼，除了完成最低限度工作外就是打黑神话悟空。身体逐渐恢复了生机，但由于长期不写硬核代码，你的算法手感与面试反应明显下滑！'
        }),
        nextEventId: midYearEventRouter,
      }
    ]
  },

  'perf_review': {
    id: 'perf_review',
    title: '年底 Perf Review 绩效考核',
    description: '又到了公司一年一度的 PSC 绩效考核时间，大家都开始疯狂抢 Project Impact 争夺升职名额。',
    choices: [
      {
        text: '【稳扎稳打】加班抢项目 Impact (争取 L4 / L5 升职)',
        condition: (s) => {
          const isWorking = !!s.job_type && s.job_type !== 'unemployed' && !s.laid_off;
          const cur = s.level || (s.job_type === 'quant' ? 'Quant' : s.job_type === 'ai_research' ? 'MTS' : s.is_phd ? 'L4' : 'L3');
          return isWorking && (cur === 'L3' || cur === 'L4');
        },
        effect: (s) => {
          const cur = s.level || (s.is_phd ? 'L4' : 'L3');
          const isL3 = cur === 'L3';
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
            ? { health: Math.max(0, s.health - 12), tc: s.tc + tcIncrease, level: nextLevel, last_promo_age: s.age, message: `卷赢了！你拿到了 EE 绩效，成功晋升至 ${nextLevel}，总包调薪 +${tcIncrease} 万美元！` }
            : { 
                health: Math.max(0, s.health - 12),
                npcs: {
                  ...(s.npcs || {}),
                  dave: s.npcs?.dave || { name: 'Manager Dave', role: 'manager', affinity: 30, status: 'nemesis', note: '抢占你项目功劳的经理' }
                },
                story_flags: {
                  ...(s.story_flags || {}),
                  has_dave_evidence: true,
                  dave_conflict_year: s.year
                },
                message: '你辛辛苦苦写的核心文档被 Manager Dave 拿去汇报抢了功劳！好在你暗中留存了全部 Jira Commit 与 Slack 截图证据链，等待时机反击！' 
              };
        },
        nextEventId: (s) => (s.last_promo_age === s.age ? 'promo_celebration' : h1ToH2Router(s)),
      },
      {
        text: '【冲击 L6 Staff 架构师】主导跨组核心架构设计 (L5 升 L6 专属高门槛)',
        condition: (s) => {
          const cur = s.level || (s.is_phd ? 'L4' : 'L3');
          return (cur === 'L5 (Senior)' || cur === 'L5') && s.leetcode >= 65 && (s.charm || 10) >= 15 && (s.network || 10) >= 25 && s.health >= 35 && s.tc >= 30;
        },
        effect: (s) => {
          // L6 Staff 非常难
          const winRate = 0.05 + ((s.charm || 10) / 100) * 0.15 + ((s.network || 10) / 100) * 0.15 + (s.leetcode / 100) * 0.06;
          const win = gameRandom() < Math.min(0.18, winRate);
          return win 
            ? { level: 'L6 (Staff)', tc: s.tc + 12, health: Math.max(0, s.health - 15), last_promo_age: s.age, message: '奇迹破局！你在晋升委员会 (Promo Committee) 手撕核心架构与跨团队沟通，打破硅谷天花板顺利晋升为 L6 Staff Engineer！总包 (TC) 暴涨 +12 万美元！' }
            : { health: Math.max(0, s.health - 15), message: '晋升委员会否决了你的 L6 Staff 申请，认为你在部门影响力与政治 Sponsorship 上仍缺一把火。白卷了一整年。' };
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
          return (cur === 'L6 (Staff)' || cur === 'Staff' || cur === 'MTS') && s.leetcode >= 70 && (s.charm || 10) >= 16 && (s.network || 10) >= 35 && s.health >= 40 && s.tc >= 45;
        },
        reqBadge: '需 当前L6 & 算法≥70 & 跨部门统筹与高管背书',
        costBadge: '消耗健康与高阶政治与战略心智',
        effect: (s) => {
          const winRate = 0.05 + ((s.charm || 10) / 100) * 0.20 + ((s.network || 10) / 100) * 0.20 + (s.leetcode / 100) * 0.08;
          // Cap so L7 stays rarer than the capped-0.18 L6 (was uncapped ~32-45%).
          const win = gameRandom() < Math.min(0.10, winRate);
          return win 
            ? { level: 'L7 (Senior Staff)', tc: s.tc + 20, health: Math.max(0, s.health - 15), last_promo_age: s.age, message: ' 战略封神！你在跨部门架构评审中凭借高层 VP Sponsor 撑腰与无可撼动的技术领导力，正式晋升为 L7 Senior Staff Engineer 资深架构师！总包 (TC) 狂飙 +20 万美元！' }
            : { health: Math.max(0, s.health - 15), message: '晋升委员会否决了你的 L7 Senior Staff 申请，认为你在高层政治阵营拉拢与全公司级战略视野上仍需深耕。白卷了一整年。' };
        },
        // Route on the ACTUAL level change (the rejection message also contains 晋升).
        nextEventId: (s) => (s.level === 'L7 (Senior Staff)' ? 'l7_senior_staff_celebration' : h1ToH2Router(s)),
      },
      {
        text: '【登顶 L8 Principal 首席架构师】定义行业技术范式与下一代算力/模型标准 (L7 升 L8 终极天堑)',
        condition: (s) => {
          const cur = s.level || (s.is_phd ? 'L4' : 'L3');
          return (cur === 'L7 (Senior Staff)' || cur === 'Senior Staff' || cur === 'L7') && s.leetcode >= 80 && (s.charm || 10) >= 20 && (s.network || 10) >= 50 && s.health >= 45 && s.tc >= 65;
        },
        reqBadge: '需 当前L7 & 算法≥80 & 行业泰斗与战略决策力',
        costBadge: '消耗健康与终极政治心智',
        effect: (s) => {
          const winRate = 0.04 + ((s.charm || 10) / 100) * 0.15 + ((s.network || 10) / 100) * 0.15 + (s.leetcode / 100) * 0.05;
          // Cap so L8 (Principal) stays the rarest band (was uncapped ~24-34%).
          const win = gameRandom() < Math.min(0.06, winRate);
          return win 
            ? { level: 'L8 (Principal)', tc: s.tc + 35, health: Math.max(0, s.health - 15), last_promo_age: s.age, message: ' 硅谷传世神话！你在董事会闭门答辩中赢得 CEO 与顶级投资人一致肯定，破格受聘为全公司屈指可数的 L8 Principal Engineer 首席架构师/技术院士！年薪总包与期权暴涨 (+$35w TC)！' }
            : { health: Math.max(0, s.health - 15), message: 'L8 职级名额受全公司顶层 Quota 严格限制，尽管你的产出极其卓越，但在董事会与高管派系答辩中仍以一票之差抱憾延期。白卷了一整年。' };
        },
        // Route on the ACTUAL level change (harden against the substring bug).
        nextEventId: (s) => (s.level === 'L8 (Principal)' ? 'l8_principal_celebration' : h1ToH2Router(s)),
      },
      {
        text: '准点下班，躺平拿 Meets (保重身体)',
        condition: (s) => !!s.job_type && s.job_type !== 'unemployed' && !s.laid_off,
        effect: (s) => ({ health: Math.min(100, s.health + 10), message: '你按时下班，维持着普通的绩效，拿了标准的工资，身心愉悦。' }),
        nextEventId: h1ToH2Router,
      }
    ]
  },

  'layoff_rumor': {
    id: 'layoff_rumor',
    title: 'Blind 裁员谣言',
    description: '有一天，Blind 上传出你们部门要被整个裁掉的消息，人心惶惶。',
    choices: [

      {
        text: '疯狂加班，讨好 Manager 试图留下',
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
        text: '立刻开始刷题，准备后路',
        effect: (s) => ({ leetcode: s.leetcode + 20, health: s.health - 10, cash: s.cash, laid_off: true, tc: 0, job_type: 'unemployed', message: '你偷偷在上班时间刷题。果不其然，你被裁了，但你已经做好了准备。' }),
        nextEventId: 'layoff_hit',
      }
    ]
  },

  'layoff_hit': {
    id: 'layoff_hit',
    title: '不幸被裁 (裁员风暴)',
    description: '不幸遭遇了湾区科技公司大厂裁员潮，你抱着个人物品箱退出了 Slack。面对突如其来的失业与身份倒计时，请选择你的应对策略：',
    imageUrl: 'images/layoff_box.jpg',
    choices: [
      {
        text: '【美籍/绿卡玩家专属】领取 Severance 遣散费，全职刷题无忧备战',
        condition: (s) => s.visa === '绿卡' || s.visa === '公民',
        effect: (s) => ({
          cash: s.cash + 8,
          laid_off: true,
          tc: 0,
          job_type: 'unemployed',
          health: Math.min(100, s.health + 15),
          leetcode: Math.min(100, s.leetcode + 15),
          message: '手握美籍/绿卡无所畏惧！你拿到了 3 个月 Severance 遣散费 (+$8w)，在家一边散步一边刷题，从容准备下一家大厂 Offer！'
        }),
        nextEventId: 'sv_daily_life',
      },
      {
        text: '【美籍/绿卡玩家专属】申请加州 EDD 失业金，休假半年放空身心',
        condition: (s) => s.visa === '绿卡' || s.visa === '公民',
        effect: (s) => ({
          cash: s.cash + 3,
          laid_off: true,
          tc: 0,
          job_type: 'unemployed',
          health: Math.min(100, s.health + 25),
          message: '领着加州 EDD 官方失业补贴，你顺便休假半年去 Lake Tahoe 滑雪，心态极度放松！'
        }),
        nextEventId: 'sv_daily_life',
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
            tc: getLevelScaledTC(22, s.level ?? (s.is_phd ? 'L4' : 'L3')),
            company: rescue.company,
            job_type: 'big_tech',
            laid_off: false,
            health: Math.min(100, s.health + 10),
            network: Math.min(100, (s.network || 0) + 5),
            message: `人脉发威！你的熟人总监收到求助后连夜开绿灯将你内推拉入 ${rescue.name} 团队，跳过倒计时直接上岸！`
          };
        },
        nextEventId: 'sv_daily_life',
      },
      {
        text: '【F-1 / OPT 身份】利用 90/150 天失业期额度疯狂刷题，火速投递 E-Verify 新公司',
        condition: (s) => s.visa === 'OPT (实习)' || s.visa === 'F1 (学生)',
        effect: (s) => {
          const pass = s.leetcode >= 45 || gameRandom() < 0.55;
          const targetLvl = s.level || (s.is_phd ? 'L4' : 'L3');
          const newTC = getLevelScaledTC(22, targetLvl);
          return pass
            ? { tc: newTC, level: targetLvl, job_type: 'big_tech', laid_off: false, cash: Math.max(0, s.cash - 1), health: Math.max(0, s.health - 15), message: `【OPT 成功上岸】利用 90 天 OPT 失业期窗口，你的算法实力征服了面试官，火速拿下支持 E-Verify 的新 Offer (定级 ${targetLvl} · 年薪 ${newTC}w)，成功延续 OPT 身份！` }
            : { status: 'game_over', message: '90 天 OPT 失业期耗尽，且未能及时挂靠转学，SEVIS 状态失效被迫登机回国。' };
        },
        nextEventId: (s) => s.laid_off ? 'end' : 'sv_daily_life',
      },
      {
        text: '【F-1 / OPT 转学自救】失业期告急，紧急注册 Day 1 CPT 大学维持 SEVIS 身份 (消耗 $1.5w)',
        condition: (s) => (s.visa === 'OPT (实习)' || s.visa === 'F1 (学生)') && s.cash >= 1.5,
        effect: (s) => ({
          visa: 'Day 1 CPT',
          cash: s.cash - 1.5,
          laid_off: true,
          tc: 0,
          job_type: 'unemployed',
          cpt_used: true,
          leetcode: s.leetcode + 15,
          health: Math.min(100, s.health + 5),
          message: '【无缝转 Day 1 CPT】面对 OPT 失业期倒计时，你果断注册了 Day 1 CPT 大学维持合法留美学生身份，从容全职刷题准备下一轮跳槽面试！'
        }),
        nextEventId: 'job_hunt',
      },
      {
        text: '【H-1B 工签身份】利用 60 天 H1B Grace Period 极限刷题办理 H1B Transfer',
        condition: (s) => s.visa === 'H1B (工签)' || s.visa === 'L1 (外派)' || s.visa === 'O1 (杰出人才)',
        effect: (s) => {
          const pass = s.leetcode >= 55 || gameRandom() < 0.50;
          const targetLvl = s.level || (s.is_phd ? 'L4' : 'L3');
          const newTC = getLevelScaledTC(24, targetLvl);
          return pass
            ? { tc: newTC, level: targetLvl, job_type: 'big_tech', laid_off: false, cash: Math.max(0, s.cash - 2), health: Math.max(0, s.health - 15), message: `【工签 Transfer 成功】有惊无险！凭高超算法在 60 天限期内火速入职新公司 (定级 ${targetLvl} · 年薪 ${newTC}w) 并成功办理 H1B Transfer 保住工签！` }
            : { status: 'game_over', message: '没能在 60 天 H1B Grace Period 内找到支持 Visa Transfer 的新工作，工签身份到期被迫登机离境。' };
        },
        nextEventId: (s) => s.laid_off ? 'end' : 'sv_daily_life',
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
          message: '外包中介连夜为你开具了紧急 Offer 办理了 H1B Transfer！虽然总包大打折扣，但你的 60 天工签遣返警报成功解除！'
        }),
        nextEventId: 'sv_daily_life',
      },
      {
        text: '【工签转 Day 1 CPT】转为学生身份就读 Day 1 CPT 避险，全职备战大厂 (消耗 $1.5w)',
        condition: (s) => (s.visa === 'H1B (工签)' || s.visa === 'L1 (外派)' || s.visa === 'O1 (杰出人才)') && s.cash >= 1.5,
        effect: (s) => ({
          visa: 'Day 1 CPT',
          cash: s.cash - 1.5,
          laid_off: true,
          tc: 0,
          job_type: 'unemployed',
          cpt_used: true,
          leetcode: s.leetcode + 15,
          message: '你将身份转为 Day 1 CPT 维持合法停留，解除 60 天遣返倒计时，开始全职闭关刷题！'
        }),
        nextEventId: 'job_hunt',
      },
      {
        text: '【Day 1 CPT 专属】学籍在册无离境倒计时压力，边上课边全职刷题求职',
        condition: (s) => s.visa === 'Day 1 CPT',
        effect: (s) => ({
          laid_off: true,
          tc: 0,
          job_type: 'unemployed',
          leetcode: s.leetcode + 15,
          health: Math.min(100, s.health + 5),
          message: '【学籍保护】由于你早已挂靠在 Day 1 CPT 大学，完全不受 60 天工签驱逐威胁！你按部就班上课并全职刷题准备下一家面试。'
        }),
        nextEventId: 'job_hunt',
      },
      {
        text: '【钞能力 EB-5 自救】全额出资申办 EB-5 投资移民并递交 I-485 拿 Combo 卡 (花费 $80w)',
        reqBadge: '现金>=80w',
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
    title: '周五下午四点的 1:1',
    description: '你的 Manager 突然在周五下午 4 点给你发了个 "Quick Sync" 的日历邀请。会上，他用着毫无感情的 corporate 语调表示你的 "impact" 没有 "move the needle"，并将你放入了为期 30 天的 Focus/PIP 计划。',
    choices: [
      {
        text: '【王牌证据反杀】拿出暗中备份的 40 页 Commit 与沟通记录直接上报 HR 与 VP！',
        condition: (s) => !!s.job_type && s.job_type !== 'unemployed' && !s.laid_off && !!s.story_flags?.has_dave_evidence,
        hideIfUnavailable: true,
        reqBadge: '需 掌握证据链',
        effect: (s) => ({
          tc: s.tc + 5,
          health: Math.min(100, s.health + 10),
          charm: Math.min(25, (s.charm || 10) + 3),
          npcs: {
            ...(s.npcs || {}),
            dave: { name: 'Manager Dave', role: 'manager', affinity: 0, status: 'nemesis', note: '被你反杀的职场宿敌' }
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
        text: '认怂疯狂加班，证明自己的 Synergy',
        condition: (s) => !!s.job_type && s.job_type !== 'unemployed' && !s.laid_off,
        effect: (s) => {
          const isHighPipCompany = s.job_type === 'amazon' || s.company === 'amazon' || s.company === 'meta';
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
        text: '选择拿钱走人 (Pivot / Buyout 离职包)，领 2 个月 Severance 在家刷题',
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
          cpt_used: true,
          leetcode: s.leetcode + 15,
          health: Math.min(100, s.health + 5),
          message: '【无缝转 Day 1 CPT】面对裁员与身份压力，你果断注册了 Day 1 CPT 大学维持合法学生身份并全职刷题准备下一轮求职，完全不受 60 天工签遣返威胁！'
        }),
        nextEventId: 'job_hunt'
      },
      {
        text: '【钞能力 EB-5 自救】掏出 $80w 办理新法 EB-5 并双递交 (I-485)，拿 EAD Combo 卡解除 PIP 危机！',
        reqBadge: '需现金>=80w+无绿卡',
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
    title: 'RTO (Return to Office) 查考勤大战',
    description: 'CEO 突然宣布全员每周必须在办公室打卡 3 天，否则直接取消奖金甚至开除！你之前为了省房租偷偷搬到了便宜的外州/偏远地区，现在面临极大危机。',
    choices: [
      {
        text: '老老实实搬回湾区租昂贵的公寓 (房租重置为 4w)',
        condition: (s) => !!s.job_type && s.job_type !== 'unemployed' && !s.laid_off,
        effect: (s) => ({
          rent: 4,
          health: s.health - 15,
          story_flags: { ...(s.story_flags || {}), rto_wars_seen: true },
          message: '你极不情愿地回到了湾区，每个月的房租让你心如刀割，但至少保住了工作。'
        }),
        nextEventId: h1ToH2Router
      },
      {
        text: '淘宝买物理点击器+找同事代刷工牌 (高风险)',
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
        text: '硬刚 Manager：“要么让我 Remote，要么我走人！”',
        condition: (s) => !!s.job_type && s.job_type !== 'unemployed' && !s.laid_off,
        effect: (s) => {
          const win = s.leetcode >= 70 && gameRandom() < 0.5;
          return win
            ? {
                tc: s.tc + 2,
                charm: Math.min(25, s.charm + 5),
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
        text: '混水摸鱼匿名跟帖：“TC 380k，做过同组，TL 人格分裂确实坑”',
        // Anonymous-solidarity flavor now grants a little network and costs less health,
        // so it's a real alt to the "add on WeChat" option (was worse on charm AND health).
        effect: (s) => ({ charm: Math.min(s.max_charm ?? 25, s.charm + 2), network: Math.min(100, (s.network || 10) + 2), health: Math.max(0, s.health - 2), message: '你出了一口恶气，还在匿名区结识了几个同病相怜的战友，但第二天看到 Manager 脸色阴沉地在全员会强调“我们要加强团队信任与通力协作”。' }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '极度恐慌！连夜关摄像头，边开全员大会边狂刷 LeetCode 备战跳槽',
        effect: (s) => ({ leetcode: Math.min(100, s.leetcode + 10), health: s.health - 15, message: '你吓得半夜爬起来刷了 6 道动态规划困难题，咖啡因过量导致心率达到了 130。' }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '私信发帖人“同在湾区可以加微信交流吗”，结果发现是隔壁工位的同胞',
        effect: (s) => ({ charm: Math.min(25, s.charm + 3), cash: Math.max(0, s.cash - 0.2), message: '你们在 Palo Alto 密谋了一下午抱团取暖指南，并交换了彼此的 Referral 资源库。' }),
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
        text: '老油条废话推手：“Hello？抱歉刚才 AirPods 断了……我觉得这个要看 Trade-off，建议我们 Offline 找时间 Align 一下。”',
        effect: (s) => ({ charm: Math.min(25, s.charm + 2), message: '经典的硅谷废话太极！高管满意地点了点头，你成功保住了饭碗并继续写出 O(1) 空间复杂度的指针翻转。' }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '手滑点错！把力扣 Hard 解题窗口共享给了全公司 60 个人！',
        effect: (s) => ({ health: s.health - 15, charm: Math.min(25, s.charm + 8), cash: s.cash + 10, message: '会议室内一片死寂。你把自己的社死截图匿名发到小红书《全员大会手滑投影了力扣Hard怎么破？》，收获 3 万点赞和 200 条求职 Referral 软广费！' }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '3 秒把问题扔给 ChatGPT，照着读“High throughput, horizontal scalability, zero-cost abstractions”',
        effect: (s) => ({ leetcode: Math.min(100, s.leetcode + 5), tc: s.tc + 2, message: '高管赞叹你的技术深度，当场决定下季度让你负责这个高风险架构重组。' }),
        nextEventId: 'sv_year_end_settlement',
      }
    ]
  },

  'team_offsite': {
    id: 'team_offsite',
    title: ' Tahoe / Hawaii 部门 Team Offsite 免费团建大游',
    description: '部门老板今年预算充沛，全组飞往 Lake Tahoe 豪华雪山木屋与 Hawaii 夏威夷海滩，开启为期 3 天的公费 Team Offsite 度假！不用干活，全额报销，全组同事开启狂欢度假模式。',
    choices: [
      {
        text: '【打卡户外与极限运动】参加 Lake Tahoe 滑雪 / Hawaii 冲浪 & 纳帕酒庄品酒',
        effect: (s) => ({
          health: Math.min(100, s.health + 10),
          charm: Math.min(25, (s.charm || 10) + 1),
          message: '【爽玩雪山与海滩】打卡了顶级雪道与海滩冲浪！全额公费报销，身心得到了放松与充电 (健康 +10)！'
        }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【深夜酒吧与德州扑克】和组员喝精酿鸡尾酒、打德扑、聊湾区八卦与职场内幕',
        effect: (s) => ({
          network: Math.min(99, (s.network || 10) + 4),
          charm: Math.min(25, (s.charm || 10) + 2),
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
    title: '职场宫心计 (Office Politics)',
    description: '没了绿卡约束，你决定在公司大干一场。现在公司空出了一个 Director 的位子，你的竞争对手是深谙 PPT 之道的印度同事 Raj。',
    choices: [
      {
        text: '疯狂写代码，用硬实力说话',
        effect: (s) => ({ health: Math.max(0, s.health - 15), leetcode: Math.min(100, s.leetcode + 5), charm: Math.max(0, (s.charm || 10) - 2), message: 'Raj 用你写的硬核代码做了一份精美的 PPT 向上汇报，他获得了晋升。你被边缘化，但硬核攻坚让你的算法功底更上一层楼，依旧手握高薪大包稳坐工位。' }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '放下 IDE，打开 PPT 开始高强度向上管理 (成败取决于社交手腕)',
        condition: (s) => !s.laid_off && !!s.job_type && s.job_type !== 'unemployed',
        // No longer a deterministic +$30w no-brainer: it's a charm-scaled gamble
        // with a real failure branch, and the reward is a modest raise.
        effect: (s) => {
          const win = gameRandom() < Math.min(0.7, 0.15 + (s.charm || 10) * 0.03);
          return win
            ? { tc: (s.tc || 0) + 6, cash: s.cash + 4, charm: Math.min(s.max_charm ?? 25, s.charm + 2), message: '你顿悟了硅谷“向上管理”的精髓，精美 PPT 加上社交手腕打动了 VP，成功升职加薪！' }
            : { health: Math.max(0, s.health - 12), charm: Math.max(0, s.charm - 2), message: '缺乏火候，你的汇报被对手当场挑出破绽，功劳全被同事占了，还搭上了信誉。' };
        },
        nextEventId: 'sv_year_end_settlement',
      }
    ]
  },

  'overemployed': {
    id: 'overemployed',
    title: 'OE (Overemployed) 诱惑：身兼数职',
    description: '你在 Blind 上看到了一个神秘的 OE 社区。里面的人同时拿着 3 份全职远程工作的薪水（J1, J2, J3），年收入突破 100 万美元。你看着自己轻松的“养老厂”工作，有些心动。',
    choices: [
      {
        text: '接下第二份全职工作 (J2)！赚双倍的钱！',
        condition: (s) => s.job_type === 'big_tech' || s.job_type === 'amazon' || s.job_type === 'nvidia',
        effect: (s) => {
          const caught = gameRandom() < 0.25;
          return caught
            ? { tc: 0, laid_off: true, job_type: 'unemployed', health: Math.max(0, s.health - 15), message: '你在 J1 的架构会上忘记静音，突然用 J2 的称呼回答了问题！两家公司的 HR 连夜拉平信息，你被双双开除！' }
            : { cash: s.cash + s.tc, health: Math.max(0, s.health - 15), leetcode: s.leetcode + 5, message: '你用两台电脑同时开会，成功拿到了双倍工资！但是巨大的上下文切换让你精神分裂。' };
        },
        // Route to the H2/settlement flow like other H2 events — NOT back to the
        // annual action hub (which handed out a free extra income + promo cycle).
        nextEventId: (s) => s.laid_off ? 'job_hunt' : h1ToH2Router(s)
      },
      {
        text: '算了吧，安分守己',
        effect: (s) => ({ health: Math.min(100, s.health + 5), message: '你拒绝了高危的诱惑，每天下午 3 点准时躺在沙发上看 Netflix，这就是 WLB。' }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'meta_tlm': {
    id: 'meta_tlm',
    title: 'Meta TLM 卷王之王',
    description: '在 Meta，你不进则退。当上 Tech Lead Manager 后，手下管着 5 个人，每天被拉进无数个群，晚上 11 点还在回复印度总监的邮件。',
    choices: [
      {
        text: '继续卷升职 (冲击下一级别 M1 / L6 Staff)',
        condition: (s) => !!s.job_type && s.job_type !== 'unemployed' && !s.laid_off,
        effect: (s) => {
          // L6 Staff 非常难 (18% 成功率，需过硬架构与内卷)
          const isEligible = s.leetcode >= 60 && (s.network || 10) >= 20;
          const win = isEligible && gameRandom() < 0.18;
          // A promotion must never LOWER pay: never below current, capped at the L6 band top.
          const newTc = Math.max(s.tc, Math.min(85, s.tc + 14));
          return win 
            ? { level: 'L6 (Staff)', tc: newTc, health: Math.max(0, s.health - 15), imageUrl: 'images/burnout.jpg', message: `你干掉了同组全部竞争对手，在严苛的委员会评审中突破天堑晋升为 Meta M1 / L6 Staff TLM！当前总包提升至 $${newTc.toFixed(1)}w！` }
            : { health: Math.max(0, s.health - 15), imageUrl: 'images/burnout.jpg', message: '在 Meta 残酷的 TLM 竞争中，Staff 晋升名额被更高影响力的资深嫡系抢走，未能通过 L6 评审。' };
        },
        nextEventId: (s) => s.health <= 0 ? 'end' : h1ToH2Router(s),
      },
      {
        text: '太累了，降薪跳槽去 Google/Apple 养老',
        condition: (s) => !!s.job_type && s.job_type !== 'unemployed' && !s.laid_off,
        effect: (s) => ({ tc: Math.max(26, s.tc - 8), company: 'google', health: Math.min(100, s.health + 20), message: '你受够了 Meta 的高压，降薪跳槽去了以 WLB 著称的养老大厂。虽然包裹略有回落，但终于有了生活。' }),
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
        text: '主动约新 Manager 1:1，带上精心准备的 30 页 PPT 汇报展现价值',
        effect: (s) => ({ network: Math.min(100, (s.network || 0) + 5), health: Math.max(0, s.health - 10), message: '你的主动与专业打动了新老板，成功保住了原本的项目 Owner 身份！' }),
        nextEventId: h1ToH2Router
      },
      {
        text: '彻底失望，借机关摄像头狂刷 LeetCode 准备跳槽',
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
        text: '自告奋勇担任 Head of Spatial App 领头人',
        effect: (s) => ({ tc: s.tc + 3, health: Math.max(0, s.health - 15), message: '你成为了公司内部空间计算的第一专家，产品上线后获得了大批关注！总包获得增长！' }),
        nextEventId: h1ToH2Router
      },
      {
        text: '体验完 3D 效果后吐槽“戴着颈椎酸痛”，按部就班写网页版代码',
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
        text: '通宵 48 小时手写 Recovery 恢复脚本救回权重',
        effect: (s) => ({ leetcode: Math.min(100, s.leetcode + 10), health: Math.max(0, s.health - 15), message: '凭借硬核的 Infra 恢复脚本，你奇迹般地挽回了 90% 的权重数据，VP 在 Slack 全员频道为你点赞！' }),
        nextEventId: h1ToH2Router
      },
      {
        text: '果断甩锅给基础设施 Infra 部门，关掉手机继续睡觉',
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
        text: '通宵手写 SQL 脚本与备份恢复',
        effect: (s) => ({
          leetcode: Math.min(100, s.leetcode + 10),
          health: Math.max(0, s.health - 15),
          story_flags: { ...(s.story_flags || {}), agent_prod_disaster_seen: true },
          message: '凭借硬核的数据库恢复功底，你连夜恢复了绝大部分备份，保住了生产环境！'
        }),
        nextEventId: h1ToH2Router
      },
      {
        text: '甩锅给大模型 API 供应商，申请专项赔偿 (消耗 $0.5w)',
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
        text: '通宵加班重头学习最新 Infra 业务架构',
        effect: (s) => ({ health: Math.max(0, s.health - 15), leetcode: Math.min(100, s.leetcode + 10), message: '凭着硬核的学习能力，你咬牙掌握了新架构，重新站稳了团队的核心位置！' }),
        nextEventId: h1ToH2Router
      },
      {
        text: '极度挫败！因长期未手写底层代码，算法实力与热情下滑',
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
          charm: Math.min(25, (s.charm || 10) + 3),
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
                charm: Math.min(25, (s.charm || 10) + 4),
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
    title: ' 职级大晋升喜报！PROMOTION UNLOCKED',
    description: '轰动部门！鉴于你在公司核心业务中的突出 Impact，晋升委员会 (Promo Committee) 官方批准了你的职级晋升！',
    choices: [
      {
        text: '【欢呼庆祝】请团队喝 Boba 奶茶 & 继续奋斗',
        condition: (s) => !!s.job_type && s.job_type !== 'unemployed' && !s.laid_off,
        effect: (s) => ({ health: Math.min(100, s.health + 5), charm: s.charm + 1, message: `在全组同事的喝彩中，你正式挂上了 ${s.level || '崭新'} 的职级头衔，包裹与职场地位同步跃升！` }),
        nextEventId: h1ToH2Router,
      }
    ]
  },

  'l6_staff_celebration': {
    id: 'l6_staff_celebration',
    title: ' 突破硅谷天花板！晋升 L6 Staff 架构师',
    description: '轰动全公司！你突破了 35 岁天花板与硅谷码农最大天堑，正式晋升为 L6 Staff Engineer 架构师！手握跨组技术决策权，年薪总包与期权迈入顶级行业前列。',
    choices: [
      {
        text: '【大摆宴席】在 Santana Row 举办全组升职庆功宴 (消耗 $0.5w)',
        effect: (s) => ({
          cash: Math.max(0, s.cash - 0.5),
          health: Math.min(100, s.health + 20),
          charm: Math.min(25, s.charm + 5),
          message: '全组同事与 VP 亲临现场向你祝贺！你挂上了 L6 Staff 的终极胸牌，成为了湾区技术圈里的传奇神仙！'
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '【深藏功名】保持低调，发小红书“L5 升 L6 心得与系统架构面经”',
        effect: (s) => ({
          charm: Math.min(25, (s.charm || 10) + 6),
          luck: Math.min(99, (s.luck || 20) + 10),
          message: '干货面经收割了数千赞！你被尊称为小红书与 Blind 上大佬级技术导师！'
        }),
        nextEventId: h1ToH2Router,
      }
    ]
  },

  'l7_senior_staff_celebration': {
    id: 'l7_senior_staff_celebration',
    title: ' 跨部门战略统帅！晋升 L7 Senior Staff 资深架构师',
    description: '战略封神！你赢得了全公司高层 VP 的政治背书与全域架构指导权，破格批准晋升为 L7 Senior Staff Engineer 资深架构师！你的决策将深刻影响公司下一代技术路线图。',
    choices: [
      {
        text: '【包场庆祝】包下 Sand Hill Road 顶级会所与 VP 及顶级 Headhunter 畅饮 ($1.0w)',
        effect: (s) => ({
          cash: Math.max(0, s.cash - 1.0),
          health: Math.min(100, s.health + 25),
          charm: Math.min(25, (s.charm || 10) + 6),
          network: Math.min(99, (s.network || 10) + 15),
          message: '全公司各条业务线的 VP 与顶级 VC 合伙人纷纷举杯致意！你已立于硅谷大厂高管与资深决策层的核心交汇点！'
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '【学术发表】受邀在 IEEE / NeurIPS 发表顶会 Keynote 演讲',
        effect: (s) => ({
          charm: Math.min(25, (s.charm || 10) + 8),
          luck: Math.min(99, (s.luck || 20) + 12),
          message: '你的演讲在业界引起巨大轰动，行业内无数顶尖工程师与学生将你视作全领域技术偶像！'
        }),
        nextEventId: h1ToH2Router,
      }
    ]
  },

  'l8_principal_celebration': {
    id: 'l8_principal_celebration',
    title: ' 硅谷传世神话！登顶 L8 Principal 首席架构师 / 技术院士',
    description: '硅谷巅峰至尊！你成功攻克终极天堑，在董事会答辩中获得 CEO、CTO 及顶级投资人全票推举，破格登顶 L8 Principal Engineer / Fellow 首席架构师！全公司数万人中仅有屈指可数的数位泰斗能臻此境！',
    choices: [
      {
        text: '【豪宅庄园庆功】在 Atherton / Los Altos Hills 庄园举办全公司高管慈善晚宴 ($2.5w)',
        effect: (s) => ({
          cash: Math.max(0, s.cash - 2.5),
          health: Math.min(100, s.health + 30),
          charm: Math.min(25, (s.charm || 10) + 10),
          network: Math.min(99, (s.network || 10) + 20),
          message: 'CEO 亲自为你颁发公司终身荣誉技术院士奖章！在名流云集的庄园夜色中，你成为了硅谷华人史上无可争议的传世传奇！'
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '【功成身退的从容】在 Los Altos Hills 豪宅中惬意品茶，各大顶级猎头与 VC 趋之若鹜',
        effect: (s) => ({
          health: Math.min(100, s.health + 30),
          cash: s.cash + 10,
          message: '你以科技泰斗之尊笑看风云。各大独角兽与 VC 抢着奉上顾问期权与咨询费，你已站在硅谷食物链的终极顶端！'
        }),
        nextEventId: h1ToH2Router,
      }
    ]
  },

  'icc_work': {
    id: 'icc_work',
    title: 'ICC 挂靠',
    description: '你在 ICC 拿着微薄的薪水，随时可能被开除。',
    choices: [

      {
        text: '偷偷刷题，准备跳槽大厂',
        effect: (s) => ({ leetcode: s.leetcode + 40, health: s.health - 15, age: s.age + 1 }),
        nextEventId: 'job_hunt',
      }
    ]
  },

  'startup_work': {
    id: 'startup_work',
    title: '初创公司风云',
    description: '你加入了一家 Early-Stage Startup，一个人干三个人的活。现在的风向变了，关于公司的发展方向：',
    imageUrl: 'images/ai_startup.jpg',
    choices: [
      {
        text: '坚守传统赛道 (如 SaaS / Web3 工具)',
        effect: (s) => {
          let winRate = 0.15;
          if (s.year >= 2020 && s.year <= 2022) winRate = 0.30;
          const win = gameRandom() < winRate; 
          return win 
            ? { cash: s.cash + 60, message: '稳扎稳打！公司被大厂收购了，你的期权兑现了 $60w 现金！' }
            : { cash: Math.max(0, s.cash - 5), health: s.health - 15, laid_off: true, job_type: 'unemployed', tc: 0, message: '风口过了，投资人撤资，公司资金链断裂倒闭。期权变废纸，你不得不重新进入求职市场。' };
        },
        nextEventId: (s) => (s.laid_off || s.job_type === 'unemployed' ? 'job_hunt' : 'sv_daily_life'),
      },
      {
        text: '立刻 Pivot (转型) 做 AI / 大模型架构',
        effect: (s) => {
          if (s.year < 2022) {
            return { cash: Math.max(0, s.cash - 10), health: s.health - 15, laid_off: true, job_type: 'unemployed', tc: 0, message: `在 ${s.year} 年盲目跟风 AI 概念缺乏底层研发，产品无人问津，公司资金链断裂倒闭，你重新失业。` };
          }
          const win = gameRandom() < 0.18;
          return win 
            ? { cash: s.cash + 35, stocks: (s.stocks || 0) + 45, visa: (s.visa === '公民' || s.visa === '绿卡') ? s.visa : '绿卡', gc_progress: 5, gc_stage: 'approved', imageUrl: 'images/ai_startup.jpg', message: '踩中 AI 风口！公司拿到巨额融资，你的期权大幅升值，获赠 $35w 现金与 $45w 股票资产，顺便拿到了 EB-1 绿卡！' }
            : { cash: Math.max(0, s.cash - 10), health: s.health - 15, laid_off: true, job_type: 'unemployed', tc: 0, imageUrl: 'images/layoff_box.jpg', message: '转型太慢，被巨头连夜更新的接口直接背刺干死了...连夜抱起铺盖重新刷题求职。' };
        },
        nextEventId: (s) => (s.laid_off || s.job_type === 'unemployed' ? 'job_hunt' : 'post_green_card'),
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
            alex: { name: 'Alex 博士', role: 'founder', affinity: 95, status: 'ally', company: 'OmniAgent AI', note: 'OmniAgent 创始人，并肩作战' }
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
        reqBadge: '需现金≥$10w',
        effect: (s) => ({
          cash: s.cash - 10,
          npcs: {
            ...(s.npcs || {}),
            alex: { name: 'Alex 博士', role: 'founder', affinity: 90, status: 'ally', company: 'OmniAgent AI', note: '天使投资项目创始人' }
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
          charm: Math.min(25, (s.charm || 10) + 3),
          network: Math.min(100, (s.network || 10) + 15),
          npcs: {
            ...(s.npcs || {}),
            alex: { name: 'Alex 博士', role: 'founder', affinity: 85, status: 'ally', company: 'OmniAgent AI', note: '独角兽创始人，外部顾问' }
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
              level: s.level === 'L6 (Staff)' ? 'L6 (Staff)' : 'L5 (Senior)',
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
        nextEventId: (s) => s.laid_off ? 'job_hunt' : 'sv_year_end_settlement'
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
          charm: Math.min(25, (s.charm || 10) + 1),
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
        reqBadge: '需 掌握证据链',
        effect: (s) => {
          const cur = s.level || 'L4';
          const nextLvl = (cur === 'L3') ? 'L4' : (cur === 'L4') ? 'L5 (Senior)' : cur;
          return {
            tc: s.tc + 4.5,
            level: nextLvl, last_promo_age: s.age, // level-up (hop/story win): mark the promotion moment so the celebration routing + grade clock are correct
            health: Math.min(100, s.health + 8),
            charm: Math.min(25, (s.charm || 10) + 3),
            npcs: {
              ...(s.npcs || {}),
              dave: { name: 'Manager Dave', role: 'manager', affinity: 0, status: 'nemesis', note: '职场宿敌，被你的审计证据直接击溃' }
            },
            story_flags: {
              ...(s.story_flags || {}),
              dave_defeated: true,
              dave_defeated_year: s.year
            },
            message: '【证据确凿】VP 亲自介入调查，确认 Dave 存在严重抢占成果与职场霸凌行为！Dave 被撤职调离，你因硬核技术与正直表现获得常规绩效调薪 +$4.5w！'
          };
        },
        nextEventId: 'promo_celebration'
      },
      {
        text: '【实力跳槽降维打击】手握扎实代码，连夜接下 Meta/Nvidia 的 L5 Senior Offer',
        condition: (s) => s.leetcode >= 45,
        effect: (s) => {
          const cur = s.level || 'L4';
          const targetLvl = (cur === 'L3') ? 'L4' : (cur === 'L4' || !s.level) ? 'L5 (Senior)' : (cur === 'L5 (Senior)') ? 'L6 (Staff)' : cur;
          const baseBand = targetLvl === 'L8 (Principal)' ? 135 : targetLvl === 'L7 (Senior Staff)' ? 92 : targetLvl === 'L6 (Staff)' ? 65 : targetLvl === 'L5 (Senior)' ? 46 : 34;
          const newTC = Math.max(s.tc + 6, baseBand);
          return {
            company: 'meta',
            job_type: 'big_tech',
            level: targetLvl,
            tc: newTC,
            health: Math.min(100, s.health + 5),
            npcs: {
              ...(s.npcs || {}),
              dave: { name: 'Manager Dave', role: 'manager', affinity: 10, status: 'departed', note: '前组经理，已被你甩在身后' }
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
          charm: Math.min(25, (s.charm || 10) + 5),
          health: Math.min(100, s.health + 10),
          npcs: {
            ...(s.npcs || {}),
            dave: { name: 'Manager Dave', role: 'manager', affinity: 40, status: 'active', note: '如今成为向你汇报的下属' }
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
          charm: Math.min(25, (s.charm || 10) + 6),
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
                  sam: { name: '极客 Sam', role: 'co_founder', affinity: 100, status: 'ally', note: '生死战友，安全黑客' }
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
        text: '劝阻 Sam 并注意安全合规，专注于大厂正规架构工作',
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
          message: '【凌晨救火与高管点赞】连灌两罐红牛，在 War Room 排查到凌晨 4 点终于定位到坏配置并修复。虽然周末泡汤、眼圈发黑，但在全组事后复盘邮件中获得了高管点名感谢与特别奖金。'
        }),
        nextEventId: h1ToH2Router
      },
      {
        text: '【战术跟进与留痕取证】在 Slack 回一句“Looking into it”，默默截图保存证据链',
        effect: (s) => ({
          health: Math.max(0, s.health - 2),
          message: '【专业避坑与责任厘清】你深知盲目插手只会引发更大混乱。你慢条斯理地在群里跟进，同时保存了完整错误日志与未经代码评审的发布记录，周一复盘会上成功将责任撇得干干净净。'
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
          message: '【拒绝内耗与专注生活】你关掉了下班后的工作通知，准点打卡下班去健身、做饭、睡足 8 小时。既然没有实际加薪，就把精力转化为实打实的身体健康与内心宁静。'
        }),
        nextEventId: h1ToH2Router
      },
      {
        text: '【化愤怒为刷题动力】推掉无意义加班，闭关两个月重刷 LeetCode 备战跳槽',
        effect: (s) => ({
          health: Math.max(0, s.health - 6),
          leetcode: s.leetcode + 12,
          message: '【重拾手感与蓄力跳槽】被画饼的憋屈激发了你的斗志。你推掉了周末应酬，闭关重刷 Hard 题与系统设计。算法手感重回巅峰，准备在即将到来的跳槽季狠狠教老板做人。'
        }),
        nextEventId: h1ToH2Router
      },
      {
        text: '【私下联系 Skip-level 申请转组】寻找跨部门更具上升空间的明星业务线',
        effect: (s) => ({
          health: Math.max(0, s.health - 3),
          network: Math.min(100, (s.network || 0) + 2),
          charm: Math.min(25, s.charm + 1),
          message: '【跨部门破局与人脉铺路】你没有当场翻脸，而是私下找隔壁业务线的 Director 喝咖啡，凭借扎实的项目交付口碑拿到了新团队的接收意向，为无缝转岗埋下了伏笔。'
        }),
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
          charm: Math.min(25, s.charm + 1),
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
  }
};
