import type { GameEvent, GameState } from '../../types';
import { getLevelScaledTC, midYearEventRouter, h1ToH2Router, isOpportunityActiveThisYear , gameRandom } from './helpers';
import { getTCBreakdown } from '../../utils/gameStateSelectors';
import { HOUSING_NAMES, isOwnedHousing, liquidateStocksToCover } from '../../constants/gameConstants';

export const settlementEvents: Record<string, GameEvent> = {
  'sv_year_end_settlement': {
    id: 'sv_year_end_settlement',
    title: '年底结算',
    description: '今年的精力已耗尽，系统正在为你结算工资、扣除房租，并计算绿卡排期...',
    choices: [
      {
        text: '结算并迎接新的一年',
        effect: (s) => {
           let newStartupTenure = s.startup_tenure || 0;
           if (!s.laid_off && s.job_type === 'startup') {
             newStartupTenure += 1;
           } else {
             newStartupTenure = 0;
           }

           let nextGc = s.gc_progress || 0;
           let nextStage = s.gc_stage || 'not_started';

           const isHomeowner = isOwnedHousing(s.housing_name);
           const housingExpense = s.rent !== undefined 
             ? s.rent 
             : (isHomeowner ? (s.housing_name === HOUSING_NAMES.ATHERTON ? 5.0 : 2.0) : 4.0);
           const carExpense = s.car === 'porsche' ? 2.5 : s.car === 'cybertruck' ? 2.0 : s.car === 'model_y' ? 1.0 : 0.3;
           const livingExpense = 3.0;
           const petExpense = s.has_pet ? 0.3 : 0;
           // 湾区生活成本通胀：以 2018 为基准 ~2%/年复利、封顶 +80%。engaged 玩家靠 merit/晋升涨薪跑赢，
           // 躺平(TC 停滞)玩家被持续上涨的物价蚕食 —— 与 impact 机制协同，制造「趁早 FIRE、别拖」的压力。
           // 不影响 FIRE 目标与 TC 档,只作用于每年生活开销。
           const inflationFactor = Math.min(1.8, Math.pow(1.02, Math.max(0, (s.year || 2018) - 2018)));
           const totalExpense = parseFloat(((housingExpense + carExpense + livingExpense + petExpense) * inflationFactor).toFixed(2));
           const inflationPct = Math.round((inflationFactor - 1) * 100);
           const inflationMsg = inflationPct >= 3 ? ` 【湾区通胀】相比初入职场，物价已累计上涨 ${inflationPct}%，生活成本水涨船高。` : '';

           let newEconomy = s.macro_economy || 'neutral';
           let economyMsg = '';

           // Mean-reversion: a bull/bear market drifts back toward neutral (~40%/yr)
           // so no single event can pin the economy to a perpetual bull that
           // compounds the stock pile at +25%/yr past the FIRE gates.
           if (newEconomy !== 'neutral' && gameRandom() < 0.4) {
             newEconomy = 'neutral';
             economyMsg = ' 宏观经济周期逐步回归常态。';
           }

           // Stock market fluctuation
           let currentStocks = s.stocks || 0;
           let stockFluctuation = 0;
           if (currentStocks > 0) {
             const stockMultiplier = newEconomy === 'bull' ? 1.25 : newEconomy === 'bear' ? 0.75 : 1.05;
             const newStocksVal = currentStocks * stockMultiplier;
             stockFluctuation = newStocksVal - currentStocks;
             currentStocks = newStocksVal;
           }
           
           // Standardized compensation split (Cash & RSU)
           const tcInfo = getTCBreakdown(s);
           const preTaxBase = tcInfo.preTaxBase;
           const preTaxRSU = tcInfo.preTaxRSU;
           const postTaxBase = tcInfo.postTaxBase;
           const postTaxRSU = tcInfo.postTaxRSU;
            const rsuMsg = preTaxRSU > 0 ? ` 【RSU 股票归属】本年度归属股票税后 +${postTaxRSU.toFixed(1)}w！` : '';
           
           currentStocks += postTaxRSU; // Vested RSUs go to stock account
           
            const rentalIncome = s.rental_income || 0;
             const rentalMsg = rentalIncome > 0 ? ` 【房产被动现金流】名下出租房产/ADU 带来净租金收益 +$${rentalIncome.toFixed(1)}w！` : '';
             // Dual-income household: a married player's spouse contributes annual
             // post-tax income, tiered by partner_type (mirrors the one-shot marriage
             // bonus at dating_market). Previously married players got $0 extra cash flow.
             const spouseIncome = s.is_married
               ? (s.partner_type === 'vc' ? 15 : s.partner_type === 'founder' ? 12 : s.partner_type === 'engineer' ? 10 : s.partner_type === 'artist' ? 3 : 6)
               : 0;
             const spouseMsg = spouseIncome > 0 ? ` 【双职工家庭】配偶本年度税后收入贡献 +$${spouseIncome.toFixed(1)}w！` : '';
             const netIncome = postTaxBase + rentalIncome + spouseIncome - totalExpense;
           const liq = liquidateStocksToCover(s.cash + netIncome, currentStocks);
           const finalCash = liq.cash;
           currentStocks = liq.stocks;
           const autoStockSellMsg = liq.sold > 0
             ? ` 【股票自动变现】因现金流不足结清账单，系统已自动卖出 $${liq.sold.toFixed(1)}w 股票持仓抵扣房租与生活支出！`
             : '';

           let healthDrain = 0;
           let companyMsg = '';
           if (!s.laid_off && s.job_type !== 'unemployed') {
              // TikTok is stored as company:'tiktok' with job_type:'big_tech' (job_type is
              // never 'tiktok'), so match on company or it would fall into the 养老大厂 +10 branch.
              if (s.company === 'tiktok') { healthDrain = 8; companyMsg = ' 字节的高强度对齐让你略感疲惫 (健康 -8)。'; }
              else if (s.job_type === 'quant') { healthDrain = 6; companyMsg = ' 高频交易的紧绷节奏消耗了体力 (健康 -6)。'; }
              // 全职 Day Trader 是自雇操盘手：没有带薪年假、盯盘精神高压。若无此分支会落入下方
              // 通用「带薪年假 健康+6」兜底（既文案错乱、又白送健康），属 job_type 分支缺失 bug。
              else if (s.job_type === 'trader') { healthDrain = 3; companyMsg = ' 全职操盘盯盘的精神高压与不规律作息消耗了体力 (健康 -3)。'; }
              else if (s.company === 'nvidia') { healthDrain = 4; companyMsg = ' 英伟达 AI 芯片军备竞赛节奏紧张，让你不敢松懈 (健康 -4)。'; }
              else if (s.company === 'meta') { healthDrain = 4; companyMsg = ' Meta 的 PSC 绩效考评让你小有压力 (健康 -4)。'; }
              else if (s.company === 'amazon') { healthDrain = 3; companyMsg = ' 亚麻的 PIP 文化让你不敢懈怠 (健康 -3)。'; }
              else if (s.job_type === 'startup') { healthDrain = 3; companyMsg = ' 创业公司的发版节奏让你心力小耗 (健康 -3)。'; }
              else if (s.job_type === 'startup_founder') { healthDrain = 4; companyMsg = ' 创业找融资与管理团队的压力让你略感身心紧绷 (健康 -4)。'; }
             // AI labs (OpenAI/Anthropic MTS) are prestigious but intense — not a 养老大厂.
             else if (s.job_type === 'ai_research') { healthDrain = 3; companyMsg = ' 前沿 AI 实验室的 AGI 军备竞赛节奏紧绷，但你站在技术浪潮之巅 (健康 -3)。'; }
             // Internal transfer to a big-tech 前沿 AI 大模型组: still WLB, but AI-flavored (was
             // wrongly showing the generic "养老大厂" message since job_type stays 'big_tech').
             else if (s.transferred_to_ai) { healthDrain = -8; companyMsg = ' 大厂前沿 AI 大模型组：既享受神仙 WLB，又能接触顶尖架构，收获满满 (健康 +8)。'; }
             else if (s.job_type === 'big_tech') { healthDrain = -10; companyMsg = ' 养老大厂的神仙 WLB 让你充分养精蓄锐 (健康 +10)。'; }
             else if (s.job_type === 'cn_tech' || s.company === 'cn_big_tech') { healthDrain = 6; companyMsg = ' 国内大厂的高强度业务开发消耗了精力 (健康 -6)。'; }
             else { healthDrain = -6; companyMsg = ' 充沛的带薪年假与规律作息让你的体力得到恢复 (健康 +6)。'; }
           } else {
             healthDrain = -15;
             companyMsg = ' 充沛的休息与离职休假让你的身心彻底康复大复活 (健康 +15)。';
           }
           
           let petHealthBoost = 0;
           let petMsg = '';
           if (s.has_pet) {
             petHealthBoost = 2;
             petMsg = ` 【宠物陪伴】家里的${s.pet_name || '宠物'}每天治愈着你的心神 (健康 +2，宠物抚养支出 -$0.3w)。`;
           }

           let newHealth = Math.min(100, Math.max(0, s.health - healthDrain + petHealthBoost));
           let gcMsg = '';

           if (s.visa === '绿卡' || s.visa === '公民' || s.gc_progress >= 5) {
             nextGc = 5;
             nextStage = 'approved';
             gcMsg = s.visa === '公民' ? ' 【公民身份】你已是美国公民，工作生活不受任何排期与抽签约束。' : ' 【绿卡身份】你已持有美国绿卡，工作生活不受约束。';
           } else if (s.visa === 'H1B (工签)' || s.visa === 'O1 (杰出人才)' || s.visa === 'L1 (外派)' || s.visa === 'Day 1 CPT') {
              const isO1 = s.visa === 'O1 (杰出人才)';
              const isPhd = s.is_phd;
               // Big-tech-tier sponsors for PERM (better green-card odds). All standard
               // big-tech employers (google/meta/amazon/nvidia/tiktok/...) are job_type
               // 'big_tech'; AI labs and quant sponsor at the same tier.
               const isBigTech = s.job_type === 'big_tech' || s.job_type === 'ai_research' || s.job_type === 'quant';

              if (!s.job_type || s.job_type === 'unemployed' || s.laid_off) {
                 if (nextStage === 'perm_processing' || nextStage === 'perm_audit' || nextStage === 'i140_processing' || nextStage === 'i140_rfe') {
                    nextStage = 'not_started';
                    nextGc = 0;
                    gcMsg = ' 【绿卡中断】由于你目前处于失业状态，你的 PERM/I-140 申请被原公司撤回，绿卡进度惨遭清零！';
                 } else if (nextStage === 'not_started') {
                    gcMsg = ' 【绿卡停滞】你目前失业，无法启动任何雇主担保的绿卡申请。';
                 } else {
                    gcMsg = ' 【绿卡排期】你虽然失业，但由于你的 I-140 已经获批，Priority Date 依然为你保留，排期照常进行。';
                 }
              } else if (s.difficulty_title === '困难难度' && s.job_type === 'startup') {
                 gcMsg = ' 【困难模式】在当前 AI 寒冬下，初创公司 Startup 拒绝为你递交 PERM 绿卡申请！只能跳槽大厂或办 O1 签证。';
              } else if (s.job_type === 'startup' && newStartupTenure <= 2) {
                 gcMsg = ` Startup 政策：入职前 2 年不予办理绿卡（当前第 ${newStartupTenure} 年，排期暂未推进）。`;
              } else {
                 if (nextStage === 'not_started') {
                    if (isO1 || isPhd) {
                       nextStage = 'i140_processing';
                       nextGc = Math.max(2, nextGc); 
                       gcMsg = ' 【绿卡进度】凭借你的杰出背景 (NIW/EB1)，律师直接为你跳过 PERM，提交了 I-140 申请！';
                    } else {
                       if (gameRandom() < (isBigTech ? 0.7 : 0.4)) {
                         nextStage = 'perm_processing';
                         nextGc = Math.max(1, nextGc);
                         gcMsg = ' 【绿卡进度】公司律师正式为你启动了 PERM 打广告和 PWD 流程，漫长的绿卡长征开始了。';
                       } else {
                         gcMsg = ' ⏳ 【绿卡进度】HR 还在拖延你的绿卡流程，尚未正式启动 PERM...';
                       }
                    }
                 } else if (nextStage === 'perm_processing') {
                    const rand = gameRandom();
                    if (rand < 0.25) {
                       nextStage = 'perm_audit';
                       gcMsg = ' 【PERM Audit】运气不佳，你的 PERM 遇到了劳工部 Audit (抽查审计)，进度被严重拖延至少一年...';
                    } else if (rand < 0.8) {
                       nextStage = 'i140_processing';
                       nextGc = Math.max(2, nextGc);
                       gcMsg = ' 【绿卡进度】你的 PERM 顺利获批！律师马不停蹄为你提交了 I-140 申请。';
                    } else {
                       gcMsg = ' 【绿卡进度】PERM 广告与审理流程仍在进行中...';
                    }
                 } else if (nextStage === 'perm_audit') {
                    if (gameRandom() < 0.6) {
                       nextStage = 'i140_processing';
                       nextGc = Math.max(2, nextGc);
                       gcMsg = ' 【Audit通过】经历漫长的劳工部审计，你的 PERM 奇迹般顺利自证清白并获批！律师已提交 I-140。';
                    } else {
                       gcMsg = ' 【Audit持续】劳工部仍在严审你的职位薪水与合规材料，本年度进度停滞。';
                    }
                 } else if (nextStage === 'i140_processing') {
                    const rand = gameRandom();
                    if (rand < 0.20 && !isO1 && !isPhd) {
                       nextStage = 'i140_rfe';
                       gcMsg = ' 【I-140 RFE】移民局对你的学历与技能发出了补件通知 (RFE)，需追加技术证明材料！';
                    } else {
                       nextStage = 'i140_approved';
                       nextGc = 3;
                       gcMsg = ' 【I-140获批】大喜讯！你的 I-140 移民申请正式获批！你的 Priority Date (PD) 已永久锁定，正式进入漫长排期队列！';
                    }
                 } else if (nextStage === 'i140_rfe') {
                    nextStage = 'i140_approved';
                    nextGc = 3;
                    gcMsg = ' 【RFE通过】补充材料顺利打消了移民局疑虑，你的 I-140 成功获批并锁定 PD！';
                 } else if (nextStage === 'i140_approved') {
                    const currentYear = s.year;
                    const canFile485 = (currentYear >= 2024 && (isO1 || isPhd)) || (nextGc >= 4);
                    if (canFile485) {
                       nextStage = 'i485_pending';
                       nextGc = 4.5;
                       gcMsg = ' 【排期大前进】排期到了！律师已火速为你递交 I-485 身份调整申请，进入最后制卡冲刺阶段！';
                    } else {
                       gcMsg = ' 【绿卡排期】每天刷 Visa Bulletin 已经成了你的习惯，但本月排期纹丝不动。';
                       if (gameRandom() < 0.5 && nextGc < 4) nextGc += 0.5; // Slowly increment visual progress
                    }
                 } else if (nextStage === 'i485_pending') {
                    if (gameRandom() < 0.6) {
                       nextStage = 'approved';
                       nextGc = 5;
                       gcMsg = ' 【制卡成功】制卡完成，你的 I-485 正式获批！';
                    } else {
                       gcMsg = ' 【制卡中】你的 I-485 正在打指纹和背景调查阶段，距离实体绿卡只有一步之遥！';
                       nextGc = 4.8;
                    }
                 }
              }
           }

            // H1B 年底自动抽签逻辑
            let h1bMsg = '';
            let newVisa = s.visa;
            let newAttempts = s.h1b_attempts || 0;

            if ((s.visa === 'OPT (实习)' || s.visa === 'F1 (学生)' || s.visa === 'Day 1 CPT' || s.visa === 'L1 (外派)') && !s.laid_off && s.job_type && s.job_type !== 'unemployed' && s.job_type !== 'cn_tech' && s.company !== 'cn_big_tech') {
              newAttempts += 1;
              // Consistent with the first-attempt odds (career.ts big_tech_work) and
              // realistic H1B lottery rates (~25-40%); was 0.40-0.65 base which made
              // later attempts EASIER than the first and the 3-strike crisis unreachable.
              const baseWinRate = s.difficulty_title === '简单难度' ? 0.35 : s.difficulty_title === '困难难度' ? 0.20 : 0.27;
              const winRate = baseWinRate + (s.luck / 100) * 0.15;
              const win = gameRandom() < winRate;
              if (win) {
                newVisa = 'H1B (工签)';
                h1bMsg = s.visa === 'L1 (外派)' ? `  外派/L1 转换中签！在第 ${newAttempts} 次 H1B 抽签中成功中签，顺利获得 H1B 工签！` : `  人品大爆发！在第 ${newAttempts} 年 H1B 抽签中成功中签，正式获得 H1B 身份！`;
              } else {
                if (s.visa === 'L1 (外派)') {
                  h1bMsg = ` 【L-1 抽签未中】第 ${newAttempts} 次 H1B 抽签未能中签！但凭借你的 L-1 跨国外派签证，你在湾区合法工作完全不受影响，公司将为你继续递交后续抽签或启动 EB-1C 绿卡！`;
                } else if (s.visa === 'Day 1 CPT') {
                  h1bMsg = ` 【CPT 抽签未中】第 ${newAttempts} 次 H1B 抽签未能中签！好在有 Day 1 CPT 学籍维持合法全职工作，明年继续冲刺抽签！`;
                } else {
                  if (newAttempts === 1) {
                    h1bMsg = ' 【H1B首抽未中】第一年 H1B 未中签！已自动激活 STEM OPT 2 年延期，明年还有抽签机会！';
                  } else if (newAttempts === 2) {
                    h1bMsg = ' 【H1B二抽未中】第二年 H1B 依然未中签！只剩最后一年 STEM OPT 抽签机会，需密切关注转学挂靠或外派后路！';
                  } else {
                    h1bMsg = ' 【三年未中告急】警告：三年 H1B 抽签均未能中签！STEM OPT 身份即将到期，面临离境遣返危机！';
                  }
                }
              }
            }

            // Merit raise / RSU refresh check (45% chance) for corporate tech employees
            let updatedTC = s.tc;
            let meritMsg = '';
            const isEmployee = !s.laid_off && !!s.job_type && s.job_type !== 'unemployed' && s.job_type !== 'trader' && s.job_type !== 'startup_founder';
            // Merit / RSU refresh 与 impact(项目影响力)挂钩：高 impact → 加薪又频又大；躺平低 impact →
            // 又稀又小，即使不追求升职、留在原级别，收入也会停滞被通胀/开销蚕食(躺平的隐性代价)。
            const impactChanceMult = 0.4 + Math.min(1.0, (s.impact || 0) / 50);   // impact 0→0.4x, 50+→1.4x
            const impactAmtMult = 0.5 + Math.min(1.0, (s.impact || 0) / 60);      // impact 0→0.5x, 60+→1.5x
            const refreshChance = (newEconomy === 'bull' ? 0.50 : newEconomy === 'bear' ? 0.15 : 0.35) * impactChanceMult;
            
            if (isEmployee && gameRandom() < refreshChance) {
              const maxCapByLevel: Record<string, number> = {
                'L3': 24,
                'L4': 34,
                'L5 (Senior)': 52,
                'L5': 52,
                'L6 (Staff)': 78,
                'Staff': 78,
                'MTS': 78,
                'L7 (Senior Staff)': 120,
                'Senior Staff': 120,
                'L8 (Principal)': 220,
                'Quant': 85
              };
              const curLevelKey = s.level || (s.is_phd ? 'L4' : 'L3');
              const levelCap = maxCapByLevel[curLevelKey] || 55;
              
              if (updatedTC < levelCap) {
                const baseRefresh = gameRandom() < 0.3 ? (newEconomy === 'bull' ? 2.5 : 1.5) : (newEconomy === 'bear' ? 0.5 : 1.0);
                const refreshAmt = parseFloat((baseRefresh * impactAmtMult).toFixed(1));
                updatedTC = Math.min(levelCap, parseFloat((s.tc + refreshAmt).toFixed(1)));
                meritMsg = ` 凭本年度表现获得了公司 Merit Raise 调薪与 RSU 股票 Refresh (+${refreshAmt.toFixed(1)}w TC)！`;
              }
            } else if (s.job_type === 'startup_founder' && !s.laid_off) {
              if (newEconomy === 'bull') {
                meritMsg = ' 初创团队业务在牛市大环境中健康增长，公司产品顺利推进！';
              } else if (newEconomy === 'bear') {
                meritMsg = ' 宏观资本市场遇冷，你带领初创团队紧抓现金流，控制 Burn Rate 稳步渡过寒冬！';
              }
            }

           const newNetWorth = finalCash + currentStocks;
            const newHistory = [
              ...(s.history_net_worth || []),
              {
                age: s.age,
                year: s.year,
                netWorth: parseFloat(newNetWorth.toFixed(1)),
                cash: parseFloat(finalCash.toFixed(1)),
                stocks: parseFloat(currentStocks.toFixed(1))
              }
            ];

            let newTimeline = [...(s.timeline || [])];
            let newStoryFlags = { ...(s.story_flags || {}) };

            if (newNetWorth >= 100 && !newStoryFlags.milestone_100w) {
              newStoryFlags.milestone_100w = true;
              newTimeline.push({
                age: s.age,
                year: s.year,
                title: '资产跨越: 个人净资产突破 $100 万美元',
                description: '恭喜！扣除所有开支与税费，你的流动净资产正式突破百万美元大关！迈出财务自由扎实一步！',
                category: 'wealth',
                statHighlight: `$${newNetWorth.toFixed(1)}w`
              });
            }
            if (newNetWorth >= 300 && !newStoryFlags.milestone_300w) {
              newStoryFlags.milestone_300w = true;
              newTimeline.push({
                age: s.age,
                year: s.year,
                title: '资产跨越: 个人净资产突破 $300 万美元',
                description: '通过薪资结余与资本市场复利积累，你的净资产已达 300 万美元，生活从容度大幅提升！',
                category: 'wealth',
                statHighlight: `$${newNetWorth.toFixed(1)}w`
              });
            }
            if (newNetWorth >= 500 && !newStoryFlags.milestone_500w) {
              newStoryFlags.milestone_500w = true;
              newTimeline.push({
                age: s.age,
                year: s.year,
                title: '里程碑: 达成基础 FIRE 财务自由 ($500w)',
                description: '资产突破 500 万美元！即使每年 4% 安全提款率也能覆盖湾区高品质生活，提前退休大门已为你敞开！',
                category: 'milestone',
                statHighlight: `$${newNetWorth.toFixed(1)}w FIRE`
              });
            }
            if (newNetWorth >= 800 && !newStoryFlags.milestone_800w) {
              newStoryFlags.milestone_800w = true;
              newTimeline.push({
                age: s.age,
                year: s.year,
                title: '里程碑: 达成舒适级 FIRE 财务自由 ($800w)',
                description: '资产突破 800 万美元！坐拥丰厚股票持仓与优质被动现金流，跻身硅谷高净值自由阶层！',
                category: 'milestone',
                statHighlight: `$${newNetWorth.toFixed(1)}w 舒适 FIRE`
              });
            }

            return { 
              mid_year: false,
              season_stage: undefined,
              age: s.age + 1, 
              year: s.year + 1,
              visa: newVisa,
              h1b_attempts: newAttempts,
              startup_tenure: newStartupTenure,
              gc_progress: nextGc,
              gc_stage: nextStage,
              cash: finalCash,
              stocks: currentStocks,
              tc: updatedTC,
              // 影响力随时间自然衰减：不持续交付项目就会「过气」。躺平一年 impact -4，
              // 而主导项目/发 paper 等每次 +8~15，engaged 玩家净增、躺平玩家逐年归零而卡级。
              // (非大厂路径 impact 恒为 0，Math.max 下此项为 no-op。)
              impact: Math.max(0, (s.impact || 0) - 4),
              health: newHealth,
              macro_economy: newEconomy,
              story_flags: newStoryFlags,
              timeline: newTimeline,
              history_net_worth: newHistory,
              message: `扣除所得税、房租/房贷、生活与宠物账单支出 ${totalExpense.toFixed(1)} 万后，本年现金流 ${netIncome >= 0 ? '+' + netIncome.toFixed(1) : netIncome.toFixed(1)} 万美元。${rentalMsg}${spouseMsg}${stockFluctuation !== 0 ? `你的股票账户受大盘影响，本年度浮动为 ${stockFluctuation >= 0 ? '+' : ''}${stockFluctuation.toFixed(1)}w 美元。` : ''}${rsuMsg}${economyMsg}${gcMsg}${companyMsg}${petMsg}${h1bMsg}${meritMsg}${inflationMsg}${autoStockSellMsg}`,
              // Natural-life ending: at the lifespan cap the game resolves even if the
              // player never hit FIRE and never died — enabling the "content" endings
              // (中产退休/海归/上岸/佛系). The `message`/`status` spread overrides above.
              ...(s.age + 1 >= 55 ? { status: 'retired' as const } : {}),
           };
        },
        nextEventId: (s) => {
          if (s.status === 'win' || s.status === 'retired') return 'end';
          if ((s.cash + (s.stocks || 0)) >= s.win_threshold && (!s.last_fire_milestone_reached || s.last_fire_milestone_reached < s.win_threshold)) {
            return 'fire_milestone_choice';
          }
          if ((s.visa === 'OPT (实习)' || s.visa === 'F1 (学生)') && (s.h1b_attempts || 0) >= 3) {
            return 'h1b_final_crisis';
          }
          if (s.gc_progress >= 5 && s.visa !== '绿卡' && s.visa !== '公民' && s.visa !== '无') return 'post_green_card';
          
          return 'sv_daily_life';
        },
      }
    ]
  },

  'fire_milestone_choice': {
    id: 'fire_milestone_choice',
    title: '硅谷奇迹：达成财务自由 (FIRE)',
    description: '看着银行账户与股票投资组合上的数字突破了既定目标，你深吸了一口气。曾经在 LeetCode 上死磕的深夜、在工位上焦灼等待 H1B/PERM 排期的日子，终于在此刻结出了丰硕的果实。你已经拥有了随时登出硅谷内卷的底气！接下来，你打算怎么选择？',
    imageUrl: 'images/house.jpg',
    choices: [
      {
        text: '【见好就收 · 基础 FIRE 提前退休】宣布达成 $500w 基础财务自由，正式登出硅谷内卷（进入胜利结算）',
        costBadge: '终局胜利',
        condition: (s) => (s.cash + (s.stocks || 0)) < 800,
        hideIfUnavailable: true,
        effect: (s) => ({
          status: 'win',
          last_fire_milestone_reached: Math.max(s.win_threshold, 500),
          fire_tier: 'basic',
          message: `【基础 FIRE 胜利退休】你在 ${s.age} 岁正式宣布提前退休！总资产达到 $${(s.cash + (s.stocks || 0)).toFixed(1)}w，再也不需要看任何 Manager 与排期的脸色，开启了环游世界与自由探索的璀璨余生！`
        }),
        nextEventId: 'end',
      },
      {
        text: '【自在人生 · 舒适 FIRE 荣耀退休】宣布达成 $800w+ 舒适财务自由，潇洒享受生活（进入胜利结算）',
        costBadge: '终局胜利',
        condition: (s) => (s.cash + (s.stocks || 0)) >= 800 && (s.cash + (s.stocks || 0)) < 1500,
        hideIfUnavailable: true,
        effect: (s) => ({
          status: 'win',
          last_fire_milestone_reached: Math.max(s.win_threshold, 800),
          fire_tier: 'comfortable',
          message: `【舒适 FIRE 荣耀退休】你在 ${s.age} 岁坐拥 $${(s.cash + (s.stocks || 0)).toFixed(1)}w 资产达成舒适 FIRE！在湾区拥有豪宅与充沛现金流，正式开启神仙养老人生！`
        }),
        nextEventId: 'end',
      },
      {
        text: '【豪门巨擘 · 奢华 FIRE 巅峰退休】宣布达成 $1500w+ 奢华财务自由，登顶人生赢家（进入胜利结算）',
        costBadge: '终局胜利',
        condition: (s) => (s.cash + (s.stocks || 0)) >= 1500 && (s.cash + (s.stocks || 0)) < 3000,
        hideIfUnavailable: true,
        effect: (s) => ({
          status: 'win',
          last_fire_milestone_reached: Math.max(s.win_threshold, 1500),
          fire_tier: 'luxury',
          message: `【奢华 FIRE 巅峰退休】你在 ${s.age} 岁总资产突破 $${(s.cash + (s.stocks || 0)).toFixed(1)}w！名列硅谷顶层名流，享受顶级豪宅与无可动摇的财富自由！`
        }),
        nextEventId: 'end',
      },
      {
        text: '【登峰造极 · 硅谷传奇百亿退休】宣布达成 $3000w+ 硅谷传奇 FIRE，名留硅谷史册（进入胜利结算）',
        costBadge: '终局胜利',
        condition: (s) => (s.cash + (s.stocks || 0)) >= 3000,
        hideIfUnavailable: true,
        effect: (s) => ({
          status: 'win',
          last_fire_milestone_reached: Math.max(s.win_threshold, 3000),
          fire_tier: 'dynasty',
          message: `【硅谷传奇百亿终局】你在 ${s.age} 岁总资产突破 $${(s.cash + (s.stocks || 0)).toFixed(1)}w！设立家族信托与科技创投基金，书写了不可复制的硅谷传奇！`
        }),
        nextEventId: 'end',
      },
      {
        text: '【继续生活 · 探索舒适 FIRE 目标 ($800w)】留在硅谷享受生活，配置不动产与高端资产',
        condition: (s) => (s.cash + (s.stocks || 0)) < 800,
        hideIfUnavailable: true,
        effect: (s) => ({
          has_reached_initial_fire: true,
          last_fire_milestone_reached: Math.max(s.last_fire_milestone_reached || 0, 500),
          win_threshold: 800,
          fire_tier: 'comfortable',
          health: Math.min(100, s.health + 20),
          message: '【进入自由探索模式】你决定留在湾区继续享受生活与打拼！新的阶梯目标设定为 $800w 舒适 FIRE（尽情体验跑车豪宅、投资房与多元人生）。'
        }),
        nextEventId: 'sv_daily_life',
      },
      {
        text: '【登顶硅谷 · 冲刺奢华 FIRE 目标 ($1500w+)】追逐顶级独角兽与 Atherton 庄园',
        condition: (s) => (s.cash + (s.stocks || 0)) < 1500,
        hideIfUnavailable: true,
        effect: (s) => ({
          has_reached_initial_fire: true,
          last_fire_milestone_reached: Math.max(s.last_fire_milestone_reached || 0, (s.cash + (s.stocks || 0)) >= 800 ? 800 : 500),
          win_threshold: 1500,
          fire_tier: 'luxury',
          health: Math.min(100, s.health + 20),
          message: '【豪门巨鳄模式】你的雄心已超越普通打工人！向着 $1500w 奢华 FIRE 与硅谷顶层名流进军！'
        }),
        nextEventId: 'sv_daily_life',
      },
      {
        text: '【硅谷传奇 · 冲刺百亿传奇目标 ($3000w+)】建立家族信托与创投基金，书写时代传奇',
        condition: (s) => (s.cash + (s.stocks || 0)) >= 1500 && (s.cash + (s.stocks || 0)) < 3000,
        hideIfUnavailable: true,
        effect: (s) => ({
          has_reached_initial_fire: true,
          last_fire_milestone_reached: 1500,
          win_threshold: 3000,
          fire_tier: 'dynasty',
          health: Math.min(100, s.health + 20),
          message: '【传奇家族办公室模式】你的财富已达千万量级！向着 $3000w+ 硅谷百亿巨擘与传奇家族基金全力进军！'
        }),
        nextEventId: 'sv_daily_life',
      },
      {
        text: '【无界探索 · 漫游硅谷不设限】不设任何金钱目标，留在湾区尽情体验一切可能性',
        condition: (s) => (s.cash + (s.stocks || 0)) >= 3000,
        hideIfUnavailable: true,
        effect: (s) => ({
          has_reached_initial_fire: true,
          last_fire_milestone_reached: 3000,
          win_threshold: 99999,
          fire_tier: 'dynasty',
          health: Math.min(100, s.health + 20),
          message: '【无界探索模式】金钱对你已只是数字，你开启了不设上限的硅谷自由神仙人生！'
        }),
        nextEventId: 'sv_daily_life',
      },
      {
        text: '【无畏追梦 · 辞职创立 AI 独角兽】手握充沛本金，去沙丘路拉融资改变世界！',
        condition: (s) => (s.cash + (s.stocks || 0)) >= 200 && s.job_type !== 'startup_founder',
        effect: (s) => ({
          has_reached_initial_fire: true,
          last_fire_milestone_reached: Math.max(s.win_threshold, 500),
          win_threshold: Math.max(s.win_threshold, 1500),
          fire_tier: 'luxury',
          job_type: 'startup_founder',
          founder_stage: 'pre_seed',
          company_valuation: 500,
          tc: 6,
          level: undefined,
          company: undefined,
          laid_off: false,
          health: Math.min(100, s.health + 10),
          message: '【创办独角兽】你拿着充裕的启动资金辞职创业，正式成立 AI Agent 独角兽公司，开启传奇创始人之路！'
        }),
        nextEventId: 'founder_annual_strategy',
      },
      {
        text: '【继续领航 · 冲刺 AI 独角兽上市敲钟】带领现有初创团队全力以赴，直指独角兽敲钟上市！',
        condition: (s) => s.job_type === 'startup_founder',
        effect: (s) => ({
          has_reached_initial_fire: true,
          last_fire_milestone_reached: Math.max(s.win_threshold, 500),
          win_threshold: Math.max(s.win_threshold, 1500),
          fire_tier: 'luxury',
          health: Math.min(100, s.health + 15),
          message: '【初心不改】你没有因为账户达到财务自由而停下脚步，继续作为 CEO 带领团队向着百亿独角兽与纳斯达克敲钟全力冲刺！'
        }),
        nextEventId: 'founder_annual_strategy',
      }
    ]
  },

  'end': {
    id: 'end',
    title: '游戏结束',
    description: '你的硅谷人生模拟旅程已经达成终局结算。',
    choices: [
      {
        text: '【重新投胎】开启全新一段硅谷人生',
        effect: () => ({ status: 'playing' }),
        nextEventId: 'choose_trait'
      }
    ]
  }
};
