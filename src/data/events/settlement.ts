import type { GameEvent, GameState } from '../../types';
import { getLevelScaledTC, h1ToH2Router, isOpportunityActiveThisYear , gameRandom } from './helpers';
import { getTCBreakdown } from '../../utils/gameStateSelectors';
import { HOUSING_NAMES, isOwnedHousing, liquidateStocksToCover } from '../../constants/gameConstants';
import { getCompanyProfile } from '../companyProfiles';
import { normalizeLevel } from '../levelProfiles';

export const settlementEvents: Record<string, GameEvent> = {
  'sv_year_end_settlement': {
    id: 'sv_year_end_settlement',
    title: '【年终结算】年度盘点与财务报表',
    description: '今年的精力已耗尽，系统正在为你结算工资、扣除房租，并计算绿卡排期...',
    choices: [
      {
        text: '【迎接新的一年】年终结算完毕，以全新状态迎接新的一年',
        effect: (s) => {
           let newStartupTenure = s.startup_tenure || 0;
           if (!s.laid_off && s.job_type === 'startup') {
             newStartupTenure += 1;
           } else {
             newStartupTenure = 0;
           }

           // ICC 外包挂靠不是长期归宿:低薪 bench、随时断供,且 USCIS 对 body-shop 重点稽查
           // (site visit/RFE),挂靠越久越易被查;ICC 也不提供合规绿卡担保(下方 GC 段冻结、merit 段排除)。
           // 每年被查概率随挂靠年数升级(min 75%, 25%×年数,约 1-2 年宽限期),命中即挂靠合同终止、合法
           // 身份亮红灯 → 由 nextEventId 打入 layoff_hit 限期自救(刷题上岸/转 CPT/EB5/回国)。逼玩家尽快上岸。
           const onIcc = s.company === 'icc' && !s.laid_off && s.job_type === 'startup';
           const iccTempVisa = s.visa !== '绿卡' && s.visa !== '公民' && s.visa !== '无';
           let iccCrackdown = false;
           let iccMsg = '';
           if (onIcc) {
             if (iccTempVisa && gameRandom() < Math.min(0.75, 0.25 * newStartupTenure)) {
               iccCrackdown = true;
               iccMsg = ' 【USCIS 稽查】移民局对你挂靠的 ICC 外包展开突击 site visit,查出 bench 待岗与客户断供的合规问题,挂靠合同当场终止,合法工作身份亮起红灯!';
             } else {
               iccMsg = ' 【ICC 挂靠告急】低薪 bench 待命、客户随时断供,USCIS 对 body-shop 稽查逐年趋严且不担保合规绿卡 —— 务必尽快闭关刷题跳槽上岸!';
             }
           }

           let nextGc = s.gc_progress || 0;
           let nextStage = s.gc_stage || 'not_started';

           const isHomeowner = isOwnedHousing(s.housing_name);
           const housingExpense = s.rent !== undefined 
             ? s.rent 
             : (isHomeowner ? (s.housing_name === HOUSING_NAMES.ATHERTON ? 5.0 : 2.0) : 4.0);

           // 自有住房维护、HOA 与地税储备金 (Property Maintenance, HOA & Property Tax Reserves)
           let propertyMaintenanceExpense = 0;
           
           if (isHomeowner) {
             if (s.housing_name === HOUSING_NAMES.ATHERTON) {
               propertyMaintenanceExpense = 2.5;
             } else if (s.housing_name === HOUSING_NAMES.FREMONT || s.housing_name === HOUSING_NAMES.FREMONT_10_DISTRICT) {
               propertyMaintenanceExpense = 1.2;
             } else if (s.housing_name === HOUSING_NAMES.NORTH_SAN_JOSE) {
               propertyMaintenanceExpense = 0.8;
             } else {
               propertyMaintenanceExpense = 0.8;
             }
             
           }

           const carExpense = s.car === 'porsche' ? 2.5 : s.car === 'cybertruck' ? 2.0 : s.car === 'model_y' ? 1.0 : 0.3;
           const livingExpense = 3.0;
           const petExpense = s.has_pet ? 0.3 : 0;
           // 湾区生活成本通胀：以 2018 为基准 ~2%/年复利、封顶 +80%。engaged 玩家靠 merit/晋升涨薪跑赢，
           // 躺平(TC 停滞)玩家被持续上涨的物价蚕食 —— 与 impact 机制协同，制造「趁早 FIRE、别拖」的压力。
           // 不影响 FIRE 目标与 TC 档,只作用于每年生活开销。
           const inflationFactor = Math.min(1.8, Math.pow(1.02, Math.max(0, (s.year || 2018) - 2018)));
           // Day 1 CPT 不是「白嫖永动机」：维持合法学生身份要每年真金白银缴学费 ($1.2w)。计入
           // 年度开销(走 liquidateStocksToCover 自动平仓兜底,和房租同源),让长期挂靠 CPT 躺着
           // 白嫖工作身份的玩家持续失血 —— 与下方健康扣减 + ~10% 合规抽检共同施压尽早转正/上岸。
           // (#101) 自有住房维护/HOA/地税储备金 propertyMaintenanceExpense 也计入年度开销。
           const day1CptTuition = s.visa === 'Day 1 CPT' ? 1.2 : 0;
           const totalExpense = parseFloat(((housingExpense + propertyMaintenanceExpense + carExpense + livingExpense + petExpense) * inflationFactor + day1CptTuition).toFixed(2));

           // 宏观经济周期 (Markov 轮动) —— 单一驱动源。历史上经济只能靠 news_* 事件切换,而那些
           // 事件被 `!season_stage` 永久锁死,导致非 trader 玩家的经济恒为 neutral,整套牛熊机制
           // (股票乘数/加薪频率/招聘难度/stock_crash/流动性周期,以及 trader 读周期押注) 全成摆设。
           // 改由年终结算按马尔可夫链推进:牛熊有惯性(可持续 1-3 年),也会反转/回归,形成真实可读的
           // 周期——让 trader 读周期(牛做多/熊做空/横盘量化)真正有意义,也给所有人的资产与职业带来
           // 周期性变量。牛/熊大致对称(避免永牛复利冲破 FIRE 门禁,也避免永熊劝退)。
           const prevEconomy = s.macro_economy || 'neutral';
           let newEconomy: 'bull' | 'bear' | 'neutral' = prevEconomy;
           const er = gameRandom();
           if (prevEconomy === 'bull') {
             newEconomy = er < 0.50 ? 'bull' : er < 0.85 ? 'neutral' : 'bear';
           } else if (prevEconomy === 'bear') {
             newEconomy = er < 0.45 ? 'bear' : er < 0.85 ? 'neutral' : 'bull';
           } else {
             newEconomy = er < 0.62 ? 'neutral' : er < 0.82 ? 'bull' : 'bear';
           }
           let economyMsg = '';
           // 统一采用 #113 的【前置标签】文案规范(与下方 companyMsg/meritMsg/gcMsg 等一致,便于
           // join('\n') 后逐行扫读)。经济轮动沿用 Step 3 的 Markov 链(上方),不采用 #101 的
           // 按日历年硬编码脚本(与「year 为抽象时代时钟、不代表真实日历年」的设计相悖)。
           if (newEconomy !== prevEconomy) {
             economyMsg = newEconomy === 'bull'
               ? ' 【宏观周期】经济转入科技牛市：RSU 与股票组合水涨船高，招聘回暖。'
               : newEconomy === 'bear'
               ? ' 【宏观周期】经济转入资本寒冬：股票缩水、招聘冻结、裁员风声四起，现金为王。'
               : ' 【宏观周期】经济回归正常震荡期：市场恢复理性，一切靠实力说话。';
           }

           // 股票资产真实波动 (Stock Market Fluctuation with Realistic Volatility)
           let currentStocks = s.stocks || 0;
           if (currentStocks > 0) {
             let stockMultiplier = 1.0;
             if (newEconomy === 'bull') {
               stockMultiplier = 1.12 + gameRandom() * 0.16; // +12% ~ +28% (平均 +20%)
             } else if (newEconomy === 'bear') {
               stockMultiplier = 0.84 - gameRandom() * 0.12; // -16% ~ -28% (平均 -22%)
             } else {
               stockMultiplier = 0.94 + gameRandom() * 0.14; // -6% ~ +8% (平均 +1.0% 震荡)
             }
             currentStocks = currentStocks * stockMultiplier;
           }
           
           // Standardized compensation split (Cash & RSU)
           const tcInfo = getTCBreakdown(s);
           const postTaxBase = tcInfo.postTaxBase;
           const postTaxRSU = tcInfo.postTaxRSU;
           
           currentStocks += postTaxRSU; // Vested RSUs go to stock account
           
           const rentalIncome = s.rental_income || 0;
           // Dual-income household: a married player's spouse contributes annual
           // post-tax income, tiered by partner_type (mirrors the one-shot marriage
           // bonus at dating_market). Previously married players got $0 extra cash flow.
           const spouseIncome = s.is_married
             ? (s.partner_type === 'vc' ? 15 : s.partner_type === 'founder' ? 12 : s.partner_type === 'engineer' ? 10 : s.partner_type === 'artist' ? 3 : 6)
             : 0;
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
              // Employer-specific year-end health drain from the company table
              // (tiktok -8 / nvidia -4 / meta -4 / amazon -3). Stored as company +
              // job_type:'big_tech'; matching here keeps them out of the 养老大厂 +10
              // branch below. 养老厂 (google/apple/oracle/…) have no table override and
              // fall through to the big_tech +10 default, which is correct for them.
              const companyProfile = getCompanyProfile(s.company);
              if (companyProfile?.yearEndHealth) { healthDrain = companyProfile.yearEndHealth.drain; companyMsg = companyProfile.yearEndHealth.msg; }
              else if (s.job_type === 'quant') { healthDrain = 6; companyMsg = ' 【职场健康】高频交易的紧绷节奏消耗了体力 (健康 -6)。'; }
              // 全职 Day Trader 是自雇操盘手：没有带薪年假、盯盘精神高压。若无此分支会落入下方
              // 通用「带薪年假 健康+6」兜底（既文案错乱、又白送健康），属 job_type 分支缺失 bug。
              else if (s.job_type === 'trader') { healthDrain = 3; companyMsg = ' 【职场健康】全职操盘盯盘的精神高压与不规律作息消耗了体力 (健康 -3)。'; }
              else if (s.job_type === 'startup') { healthDrain = 3; companyMsg = ' 【职场健康】创业公司的发版节奏让你心力小耗 (健康 -3)。'; }
              else if (s.job_type === 'startup_founder') { healthDrain = 4; companyMsg = ' 【职场健康】创业找融资与管理团队的压力让你略感身心紧绷 (健康 -4)。'; }
             // AI labs (OpenAI/Anthropic MTS) are prestigious but intense — not a 养老大厂.
             else if (s.job_type === 'ai_research') { healthDrain = 3; companyMsg = ' 【职场健康】前沿 AI 实验室的 AGI 军备竞赛节奏紧绷，但你站在技术浪潮之巅 (健康 -3)。'; }
             // Internal transfer to a big-tech 前沿 AI 大模型组: still WLB, but AI-flavored (was
             // wrongly showing the generic "养老大厂" message since job_type stays 'big_tech').
             else if (s.transferred_to_ai) { healthDrain = -8; companyMsg = ' 【职场健康】大厂前沿 AI 大模型组：既享受神仙 WLB，又能接触顶尖架构，收获满满 (健康 +8)。'; }
             else if (s.job_type === 'big_tech') { healthDrain = -10; companyMsg = ' 【职场健康】养老大厂的神仙 WLB 让你充分养精蓄锐 (健康 +10)。'; }
             else if (s.job_type === 'cn_tech' || s.company === 'cn_big_tech') { healthDrain = 6; companyMsg = ' 【职场健康】国内大厂的高强度业务开发消耗了精力 (健康 -6)。'; }
             else { healthDrain = -6; companyMsg = ' 【职场健康】充沛的带薪年假与规律作息让你的体力得到恢复 (健康 +6)。'; }
           } else {
             healthDrain = -15;
             companyMsg = ' 【休假恢复】充沛的休息与离职休假让你的身心彻底康复大复活 (健康 +15)。';
           }
           
           let petHealthBoost = 0;
           let petMsg = '';
           if (s.has_pet) {
             petHealthBoost = 2;
             petMsg = ` 【宠物陪伴】家里的${s.pet_name || '宠物'}每天治愈着你的心神 (健康 +2)。`;
           }

           // Day 1 CPT 学业负担:白天全职写代码、晚上/周末应付水硕课程与作业,精力被持续透支 (健康 -4)。
           let day1CptHealthHit = 0;
           let day1CptMsg = '';
           if (s.visa === 'Day 1 CPT') {
             day1CptHealthHit = 4;
             day1CptMsg = ` 【Day 1 CPT 学业维持】为保住合法学生身份，你缴纳了 $1.2w 学费，并挤出精力应付课程与作业 (健康 -4)。`;
           }

           let newHealth = Math.min(100, Math.max(0, s.health - healthDrain + petHealthBoost - day1CptHealthHit));
           let gcMsg = '';

           if (s.visa === '绿卡' || s.visa === '公民' || s.gc_progress >= 5) {
             nextGc = 5;
             nextStage = 'approved';
             gcMsg = '';
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
              } else if (s.company === 'icc') {
                 gcMsg = ' 【绿卡政策】ICC 外包挂靠不提供合规绿卡担保（body-shop 的 PERM 极易被 USCIS 认定造假）——绿卡进度停滞，务必尽快跳槽到正规大厂重启排期。';
              } else if (s.difficulty_title === '困难难度' && s.job_type === 'startup') {
                 gcMsg = ' 【困难模式】在当前 AI 寒冬下，初创公司 Startup 拒绝为你递交 PERM 绿卡申请！只能跳槽大厂或办 O1 签证。';
              } else if (s.job_type === 'startup' && newStartupTenure <= 2) {
                 gcMsg = ` 【绿卡政策】Startup 政策：入职前 2 年不予办理绿卡（当前第 ${newStartupTenure} 年，排期暂未推进）。`;
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
                         gcMsg = ' 【绿卡进度】HR 还在拖延你的绿卡流程，尚未正式启动 PERM...';
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
            const alreadyDrewThisYear = s.story_flags?.last_h1b_lottery_year === s.year;

            if (!alreadyDrewThisYear && (s.visa === 'OPT (实习)' || s.visa === 'F1 (学生)' || s.visa === 'Day 1 CPT' || s.visa === 'L1 (外派)') && !s.laid_off && s.job_type && s.job_type !== 'unemployed' && s.job_type !== 'cn_tech' && s.company !== 'cn_big_tech') {
              newAttempts += 1;
              // Consistent with the first-attempt odds (career.ts big_tech_work) and
              // realistic H1B lottery rates (~25-40%); was 0.40-0.65 base which made
              // later attempts EASIER than the first and the 3-strike crisis unreachable.
              const baseWinRate = s.difficulty_title === '简单难度' ? 0.35 : s.difficulty_title === '困难难度' ? 0.20 : 0.27;
              const winRate = baseWinRate + (s.luck / 100) * 0.15;
              const win = gameRandom() < winRate;
              if (win) {
                newVisa = 'H1B (工签)';
                h1bMsg = s.visa === 'L1 (外派)' ? ` 【H1B中签】外派/L1 转换中签！在第 ${newAttempts} 次 H1B 抽签中成功中签，顺利获得 H1B 工签！` : ` 【H1B中签】人品大爆发！在第 ${newAttempts} 年 H1B 抽签中成功中签，正式获得 H1B 身份！`;
              } else {
                if (s.visa === 'L1 (外派)') {
                  h1bMsg = ` 【L-1 抽签未中】第 ${newAttempts} 次 H1B 抽签未能中签！但凭借你的 L-1 跨国外派签证，你在湾区合法工作完全不受影响，公司将为你继续递交后续抽签或启动 EB-1C 绿卡！`;
                } else if (s.visa === 'Day 1 CPT') {
                  h1bMsg = ` 【CPT 抽签未中】第 ${newAttempts} 次 H1B 抽签未能中签！好在有 Day 1 CPT 学籍维持合法全职工作，明年继续冲刺抽签！`;
                } else {
                  if (newAttempts === 1) {
                    h1bMsg = ' 【H1B首抽未中】第一年 H1B 未中签！已自动激活 STEM OPT 2 年延期，还有 2 次抽签机会！';
                  } else if (newAttempts === 2) {
                    h1bMsg = ' 【H1B二抽未中】第二年 H1B 依然未中签！还剩最后 1 年 STEM OPT 抽签机会，需密切关注转学挂靠或外派后路！';
                  } else {
                    h1bMsg = ' 【三年未中告急】警告：三年 H1B 抽签均未能中签！STEM OPT 身份即将到期，面临离境遣返危机！';
                  }
                }
              }
            } else if (alreadyDrewThisYear && s.visa === 'OPT (实习)') {
              if (newAttempts === 1) {
                h1bMsg = ' 【STEM OPT】已激活 STEM OPT 2年延期，当前合法工作无忧，明年将继续参加 H1B 抽签！';
              }
            }

            let newH1bTenure = s.h1b_tenure || 0;
            if (newVisa === 'H1B (工签)') {
              newH1bTenure += 1;
              if (newH1bTenure >= 6) {
                if (nextStage === 'i140_approved' || nextStage === 'i485_pending' || nextStage === 'approved' || nextGc >= 3) {
                  h1bMsg = `${h1bMsg ? h1bMsg + '\n' : ''}【H-1B 6年大限豁免】你的 H-1B 已满 6 年！好在你的 I-140 移民申请已获批锁定 PD，成功依据 AC21 法案获得无上限 3 年延期！`.trim();
                } else {
                  h1bMsg = `${h1bMsg ? h1bMsg + '\n' : ''}【H-1B 6年大限警报】你的 H-1B 达到法定 6 年上限且 I-140 尚未获批！无法继续常规续签，面临工签到期危机！`.trim();
                }
              }
            } else if (newVisa === 'L1 (外派)' && s.l1_relocated) {
              newH1bTenure = 0;
            }

            // Silicon Valley Performance Review (年度考评 / PSC 体系): EE (Exceeds) / ME (Meets,
            // 60分及格基准) / NI (Needs Improvement → PIP 预警). Rating reads THIS year's annual_action
            // (set by the sv_daily_life 重心 choice; undefined/非养生 = 冲刺态). annual_action is reset
            // to undefined each settlement (below) so a stale prior action never mis-rates a later year.
            let updatedTC = s.tc;
            let meritMsg = '';
            let perfRating: 'EE' | 'ME' | 'NI' | undefined = undefined;
            const isEmployee = !s.laid_off && !!s.job_type && s.job_type !== 'unemployed' && s.job_type !== 'trader' && s.job_type !== 'startup_founder' && s.company !== 'icc';

            if (isEmployee) {
              const action = s.story_flags?.annual_action;
              const coasting = action === 'wlb' || action === 'transfer';
              // 本年是否真有交付(impact 高于上次结算基线)。EE 要求「本年主动交付」而非仅仅
              // 「历史 impact 高」,否则一个高 impact 玩家躺平一年(不涨 impact)也拿 EE、而勤恳
              // 按部就班反倒只有 ME —— 考评反转。用 impact_ytd_base 精确判定本年交付。
              const deliveredThisYear = (s.impact || 0) > (s.impact_ytd_base ?? 0) + 0.001;
              const justPromoted = s.last_promo_age === s.age;
              const isKingOfRoll = s.trait_title === '卷王之王';

              if (justPromoted || (!coasting && deliveredThisYear && ((s.impact || 0) >= 12 || isKingOfRoll))) {
                perfRating = 'EE'; // Exceeds Expectations (卓越)
              } else if ((s.story_flags?.pip_warning && gameRandom() < 0.5) || (s.health < 25 && (s.impact || 0) < 6 && gameRandom() < 0.35)) {
                perfRating = 'NI'; // Needs Improvement (待改进 → PIP)
              } else {
                perfRating = 'ME'; // Meets Expectations (符合预期 / 60分及格)
              }

              const maxCapByLevel: Record<string, number> = {
                'L3': 24,
                'L4': 34,
                'L5 (Senior)': 52,
                'L6 (Staff)': 78,
                'L7 (Senior Staff)': 120,
                'L8 (Principal)': 220,
                'Quant': 85
              };
              const norm = normalizeLevel(s.level, s);
              // Quant 优先用其专属 85 cap (normalizeLevel 会把 Quant 折成 L5/L6,导致 'Quant' 档位死掉、量化被误封在 52/78)。
              const curLevelKey = (s.job_type === 'quant') ? 'Quant' : (norm || (s.is_phd ? 'L4' : 'L3'));
              const levelCap = maxCapByLevel[curLevelKey] || 55;
              const impactAmtMult = 0.5 + Math.min(1.0, (s.impact || 0) / 60); // impact 0→0.5x, 60+→1.5x
              // 调薪只增不减:已在/超过 level cap 的高薪玩家(如 OpenAI MTS tc=80 折算 L6 cap 78)
              // 不应被 Math.min(cap,...) 反向倒扣 TC(那会边涨薪文案边掉薪)。
              const raiseTo = (amt: number) => Math.max(s.tc, Math.min(levelCap, parseFloat((s.tc + amt).toFixed(1))));

              // Perf review is surfaced entirely in the year-end statement's dedicated
              // banner (rating + raise below), so it no longer bloats the event-feedback
              // text (meritMsg is left for the founder branch only).
              if (perfRating === 'EE') {
                const baseRefresh = newEconomy === 'bull' ? 3.0 : newEconomy === 'bear' ? 1.0 : 2.0;
                updatedTC = raiseTo(parseFloat((baseRefresh * impactAmtMult).toFixed(1)));
              } else if (perfRating === 'ME') {
                const baseRefresh = newEconomy === 'bull' ? 1.5 : newEconomy === 'bear' ? 0.5 : 1.0;
                updatedTC = raiseTo(parseFloat((baseRefresh * Math.min(1.0, impactAmtMult)).toFixed(1)));
              }
              // NI: no raise (updatedTC stays s.tc).
            }

           const newNetWorth = finalCash + currentStocks;
           // Round components first, then derive the logged netWorth from them so the
           // logged cash + stocks always equals the logged netWorth (independent rounding
           // otherwise lets them disagree by up to 0.1w on the chart).
           const roundedCash = parseFloat(finalCash.toFixed(1));
           const roundedStocks = parseFloat(currentStocks.toFixed(1));
            const newHistory = [
              ...(s.history_net_worth || []),
              {
                age: s.age,
                year: s.year,
                netWorth: parseFloat((roundedCash + roundedStocks).toFixed(1)),
                cash: roundedCash,
                stocks: roundedStocks
              }
            ];

            let newTimeline = [...(s.timeline || [])];
            let newStoryFlags = { 
              ...(s.story_flags || {}),
              ...(alreadyDrewThisYear ? {} : { last_h1b_lottery_year: s.year }),
              o1_denied_this_year: false,
              exit_deliberated: false,
              scam_marriage_failed: false,
              side_hustle_canceled: false,
              // Annual Perf Review outcome + reset this year's action so it can't carry over.
              last_perf_rating: perfRating,
              last_perf_raise: perfRating ? parseFloat((updatedTC - s.tc).toFixed(1)) : undefined,
              annual_action: undefined,
              // Only NI (as an employee) keeps a PIP warning; non-employee years (founder/
              // trader/unemployed) clear it so it can't linger stale into a later comeback.
              pip_warning: isEmployee ? (perfRating === 'NI') : false,
            };

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
            if (newNetWorth >= 1500 && !newStoryFlags.milestone_1500w) {
              newStoryFlags.milestone_1500w = true;
              newTimeline.push({
                age: s.age,
                year: s.year,
                title: '里程碑: 达成奢华级 FIRE 财务自由 ($1500w)',
                description: '资产突破 1500 万美元！坐拥顶级不动产与家族创投资本，登顶硅谷精英巅峰！',
                category: 'milestone',
                statHighlight: `$${newNetWorth.toFixed(1)}w 奢华 FIRE`
              });
            }
            if (newNetWorth >= 3000 && !newStoryFlags.milestone_3000w) {
              newStoryFlags.milestone_3000w = true;
              newTimeline.push({
                age: s.age,
                year: s.year,
                title: '里程碑: 达成硅谷百亿传奇 ($3000w+)',
                description: '资产突破 3000 万美元！建立家族信托与独立创投基金，书写属于你的时代传奇！',
                category: 'milestone',
                statHighlight: `$${newNetWorth.toFixed(1)}w 硅谷传奇`
              });
            }

            // Founder 痛点信号 (Phase 2 读牌→对症):每年为下一年抛出一个核心痛点,玩家需在
            // founder_annual_strategy 用对症 remedy 化解 (会清空 founder_situation)。若上一年痛点被
            // 无视 (信号仍在),年终对估值施加温和拖累 (约 -8%,中等惩罚:读错明显更差但不致命)。
            let nextFounderSituation = s.founder_situation;
            let founderValuation = s.company_valuation;
            let founderMsg = '';
            if (s.job_type === 'startup_founder' && s.status === 'playing') {
              let unresolvedMsg = '';
              if (s.founder_situation && (s.company_valuation || 0) > 0) {
                founderValuation = Math.max(100, Math.round((s.company_valuation || 0) * 0.92));
                unresolvedMsg = '上年痛点仍未有效化解，董事会深表担忧，公司估值折损 8%；';
              }
              // 并非年年都有危机:约 45% 的年份抛出一个核心痛点(需对症化解),其余年份无痛点,
              // 让创始人腾出手推进融资轮次(沙丘路)——否则年年疲于救火、公司永远长不大。
              if (gameRandom() < 0.45) {
                const painRoll = gameRandom();
                nextFounderSituation = painRoll < 0.34 ? 'valuation_stall' : (painRoll < 0.67 ? 'churn' : 'outage');
                const painLabel = nextFounderSituation === 'valuation_stall'
                  ? '公司估值增长停滞，资本市场与行业关注度显著下滑。'
                  : nextFounderSituation === 'churn'
                  ? '核心企业客户流失，产品续约率出现危险下滑。'
                  : '线上系统故障与技术债频发，系统稳定性面临严峻考验。';
                founderMsg = `【初创运营】${unresolvedMsg}${painLabel}`;
              } else {
                nextFounderSituation = undefined;
                if (unresolvedMsg) {
                  founderMsg = `【初创运营】${unresolvedMsg}当前团队各项指标恢复平稳。`;
                } else if (newEconomy === 'bull') {
                  founderMsg = '【初创运营】初创团队业务在科技牛市中迅猛扩张，各条业务线健康推进。';
                } else if (newEconomy === 'bear') {
                  founderMsg = '【初创运营】宏观资本市场遇冷，你带领初创团队紧抓现金流，控制 Burn Rate 稳步渡过寒冬。';
                }
              }
            }

            return { 
              mid_year: false,
              season_stage: undefined,
              year_seg: undefined, // 清零季度事件机相位,确保下一年从 H1 重新开始 (防跨年残留导致跳过 H1/H2)
              age: s.age + 1, 
              year: s.year + 1,
              founder_situation: nextFounderSituation,
              company_valuation: founderValuation,
              visa: newVisa,
              h1b_attempts: newAttempts,
              h1b_tenure: newH1bTenure,
              startup_tenure: newStartupTenure,
              gc_progress: nextGc,
              gc_stage: nextStage,
              cash: finalCash,
              stocks: currentStocks,
              tc: updatedTC,
              // 影响力「条件衰减」：只有【本年没有交付/没涨 impact】才 -4(真躺平才过气);
              // 本年有交付(impact 高于上次结算基线)则不衰减,保留全部产出。这样「卷一年→歇一年
              // 保命」的可持续打法也能净攒 impact 冲 L6+,而纯躺平者仍逐年归零卡级。
              // 通过和上次结算基线 impact_ytd_base 比较来判定,无需在每个产 impact 的事件里打标记。
              // (非大厂路径 impact 恒为 0,此项为 no-op。)
              impact: ((s.impact || 0) > (s.impact_ytd_base ?? 0) + 0.001)
                ? (s.impact || 0)
                : Math.max(0, (s.impact || 0) - 4),
              impact_ytd_base: ((s.impact || 0) > (s.impact_ytd_base ?? 0) + 0.001)
                ? (s.impact || 0)
                : Math.max(0, (s.impact || 0) - 4),
              health: newHealth,
              macro_economy: newEconomy,
              story_flags: newStoryFlags,
              timeline: newTimeline,
              history_net_worth: newHistory,
              message: [
                companyMsg,
                meritMsg,
                founderMsg,
                h1bMsg,
                gcMsg,
                day1CptMsg,
                iccMsg,
                petMsg,
                autoStockSellMsg,
                economyMsg,
              ].map(m => (m ? m.trim() : '')).filter(Boolean).join('\n'),
              // ICC 稽查命中:挂靠合同终止,转入失业+身份危机 (nextEventId 会据此打入 layoff_hit)。
              ...(iccCrackdown ? { laid_off: true, job_type: 'unemployed' as const, company: undefined, tc: 0 } : {}),
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
          if (s.visa === 'H1B (工签)' && (s.h1b_tenure || 0) >= 6 && s.gc_stage !== 'i140_approved' && s.gc_stage !== 'i485_pending' && s.gc_stage !== 'approved' && (s.gc_progress || 0) < 3) {
            return 'h1b_six_year_crisis';
          }
          if (s.gc_progress >= 5 && s.visa !== '绿卡' && s.visa !== '公民' && s.visa !== '无') return 'post_green_card';

          // 失业 + 临时工签(OPT 90 天 / H1B·L1·O1 60 天失业期)= 触发签证倒计时。持续失业者必须
          // 进入签证危机自救(限期找工作 / 转 Day 1 CPT 学生身份 / EB-5 / 婚姻 / 或被遣返 game_over),
          // 不能靠 gap year、躺平、慢生活「无业却长年持有工签」白嫖身份(随机游玩实测的沉浸/逻辑 bug)。
          // layoff_hit 内含各签证对应的限期求职与逃生选项,是恰当的「失业签证危机」面板;失败即遣返,
          // 因此不会无限循环。学生签(F1/Day 1 CPT,合法在读)与永久身份(绿卡/公民/无签证限制)不受影响。
          const onTempWorkVisa = s.visa === 'OPT (实习)' || s.visa === 'H1B (工签)' || s.visa === 'L1 (外派)' || s.visa === 'O1 (杰出人才)';
          if ((s.job_type === 'unemployed' || s.laid_off) && onTempWorkVisa) {
            return 'layoff_hit';
          }

          // Role-specific annual hub: founders/traders don't share the generic sv_daily_life
          // focus panel — their proper "pick your year" panel is their own strategy hub. Route
          // them straight there (literal, so audit_all_flows can statically see reachability),
          // killing the redundant sv_daily_life → hub double-hop. Deliberately a plain hub
          // return (NOT midYearEventRouter) so we do NOT change founder difficulty here — going
          // via the router would inject the ~40% annual founder-crisis and tank the FIRE rate.
          if (s.job_type === 'startup_founder') return 'founder_annual_strategy';
          if (s.job_type === 'trader') return 'trader_annual_strategy';

          // Day 1 CPT 玩家每年约 10% 概率遭遇 SEVIS/移民局合规抽检 —— CPT 学籍并非「隐身白嫖」,
          // 挂靠水硕的 E-Verify 与课程出勤合规始终悬在头顶。抽检面板三条出路均可化解 (无 game_over、
          // 不回环),但都要付出现金/健康代价。visa 在 effect 中若已抽中 H1B 转正则不再触发 (已脱离 CPT)。
          if (s.visa === 'Day 1 CPT') {
            return gameRandom() < 0.1 ? 'day1_cpt_compliance' : 'sv_daily_life';
          }

          return 'sv_daily_life';
        },
      }
    ]
  },

  'fire_milestone_choice': {
    id: 'fire_milestone_choice',
    title: '【硅谷奇迹】达成财务自由 (FIRE)',
    description: '看着银行账户与股票投资组合上的数字突破了既定目标，你深吸了一口气。曾经在 LeetCode 上死磕的深夜、在工位上焦灼等待 H1B/PERM 排期的日子，终于在此刻结出了丰硕的果实。你已经拥有了随时登出硅谷内卷的底气！接下来，你打算怎么选择？',
    imageUrl: 'images/house.jpg',
    choices: [
      {
        text: '【见好就收 · 基础 FIRE 提前退休】宣布达成 $500w 基础财务自由，正式登出硅谷内卷，享受自在人生',
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
        text: '【自在人生 · 舒适 FIRE 荣耀退休】宣布达成 $800w+ 舒适财务自由，潇洒享受高品质退休生活',
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
        text: '【豪门巨擘 · 奢华 FIRE 巅峰退休】宣布达成 $1500w+ 奢华财务自由，登顶硅谷顶层人生赢家',
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
        text: '【登峰造极 · 硅谷传奇百亿退休】宣布达成 $3000w+ 硅谷传奇 FIRE，建立家族信托名留硅谷史册',
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
          company_valuation: 180,
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
    title: '【生涯终局】硅谷人生落幕',
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
