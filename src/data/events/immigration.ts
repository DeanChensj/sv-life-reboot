import type { GameEvent, GameState } from '../../types';
import { h1ToH2Router, gameRandom, o1PassProb, deductAssets } from './helpers';
import { HOUSING_NAMES, VISA_STATUS } from '../../constants/gameConstants';

export const immigrationEvents: Record<string, GameEvent> = {
  'h1b_fallback_options': {
    id: 'h1b_fallback_options',
    title: '【身份突围】H-1B 拒签应对与紧急自救',
    description: 'H-1B 遭遇 RFE 拒签或工签出现重大变故！公司律所发来通知需尽快解决合法留美身份，请选择你的自救路线：',
    choices: [
      {
        text: '【真爱伴侣结婚自救】与交往伴侣正式领证结婚，递交 I-130/I-485 婚姻绿卡 (合法合规)',
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
        // A non-citizen spouse outcome routes OUT of the crisis (was looping back to
        // the same event, letting the 40% citizen-spouse roll be re-clicked to a
        // guaranteed green card). You married; you live with the outcome this year.
        nextEventId: (s) => s.visa === '绿卡' ? 'post_green_card' : 'sv_year_end_settlement',
      },
      {
        text: '【重金商婚自救】支付 $8w 现金找地下中介匹配公民商婚 (需总资产 >= $8w, 极高风险)',
        costBadge: '花费 $8w',
        reqBadge: '高风险',
        condition: (s) => (!s.relationship_status || s.relationship_status === 'single') && (s.cash + (s.stocks || 0)) >= 8 && s.visa !== '绿卡' && s.visa !== '公民' && !s.story_flags?.scam_marriage_failed,
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
              message: '【商婚侥幸成功】你支付了 $8w 现金通过中介办妥了婚姻绿卡，彻底化解了身份危机！'
            };
          } else if (roll < 0.70) {
            return {
              cash: s.cash - 8,
              health: Math.max(0, s.health - 15),
              story_flags: { ...(s.story_flags || {}), scam_marriage_failed: true },
              message: '【中介卷款跑路】收钱后中介直接失联注销微信，假结婚对象人间蒸发！你血亏 $8w 现金且身份自救失败！系统已返回自救面板，请立即选择其他备用路线 (如 Day 1 CPT / 外派温哥华 / EB-5 / O-1)！'
            };
          } else {
            return {
              cash: s.cash - 8,
              status: 'game_over',
              message: '【移民欺诈立案】移民局 FDNS 严厉调查判定为虚假商婚，你被当场遣返回国并终身禁入美国，游戏结束！'
            };
          }
        },
        nextEventId: (s) => s.status === 'game_over' ? 'end' : (s.visa === '绿卡' ? 'post_green_card' : 'h1b_fallback_options'),
      },
      {
        text: '【杰出人才自救】申办 O1 签证 (花费 $5w 律师费)',
        costBadge: '花费 $5w',
        reqBadge: '需 PhD 或硬核算法背景',
        condition: (s) => (s.is_phd || s.leetcode >= 85 || s.job_type === 'ai_research') && (s.cash + (s.stocks || 0)) >= 5 && s.visa !== '绿卡' && s.visa !== '公民' && !s.story_flags?.o1_denied_this_year,
        effect: (s) => {
          const win = gameRandom() < o1PassProb(s); // shared, consistent O1 odds across all events
          return win
            ? { visa: 'O1 (杰出人才)', cash: s.cash - 5, health: Math.max(0, s.health - 5), message: '凭硬核论文与行业大牛推荐信，移民局批复了你的 O1 杰出人才签证！成功自救！' }
            : { cash: s.cash - 5, health: Math.max(0, s.health - 15), story_flags: { ...(s.story_flags || {}), o1_denied_this_year: true }, message: 'O1 申请惨遭 RFE 拒绝，这一自救路线彻底失败。请选择其他备选方案！' };
        },
        nextEventId: (s) => s.visa === 'O1 (杰出人才)' ? 'sv_year_end_settlement' : 'h1b_fallback_options',
      },
      {
        text: '【钞能力投资自救】全额出资申办 EB-5 投资移民绿卡 (花费 $80w 总资产)',
        costBadge: '花费 $80w',
        condition: (s) => (s.cash + (s.stocks || 0)) >= 80 && s.visa !== '绿卡' && s.visa !== '公民',
        // Liquidate stocks to cover the cost when cash is short (was cash-80 only,
        // leaving transient negative cash that poisoned downstream cash-based rolls).
        effect: (s) => {
          const fromStocks = Math.max(0, 80 - s.cash);
          return { visa: '绿卡', gc_progress: 5, gc_stage: 'approved', cash: s.cash - Math.min(s.cash, 80), stocks: Math.max(0, (s.stocks || 0) - fromStocks), message: '凭雄厚资金实力，全额出资 $80w 办妥了新法 EB-5 投资移民绿卡！彻底甩开所有身份枷锁！' };
        },
        nextEventId: 'post_green_card',
      },
      {
        text: '【外派温哥华 L-1】申请 Relocate 到温哥华 Office 办 L-1 签证 (曲线救国)',
        costBadge: '花费 $3w',
        // Kept universally available (it is the crisis's guaranteed fallback so the
        // screen always has an actionable choice), but no longer FREE — a relocation
        // year now costs cash + health.
        condition: (s) => s.visa !== '绿卡' && s.visa !== '公民',
        effect: (s) => ({ visa: 'L1 (外派)', l1_relocated: true, cash: Math.max(0, s.cash - 3), health: Math.max(0, s.health - 10), message: '你申请外派加拿大温哥华 Office，举家搬迁折腾了一整年 (花费搬迁费与精力)，一年后凭 L1 签证顺利调回湾区总部！' }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【紧急挂靠】紧急挂靠 Day 1 CPT 水硕 (花费 $1.5w)',
        costBadge: '花费 $1.5w',
        condition: (s) => (s.cash + (s.stocks || 0)) >= 1.5 && s.visa !== '绿卡' && s.visa !== '公民',
        effect: (s) => ({ visa: 'Day 1 CPT', cash: s.cash - 1.5, message: '白天写代码，晚上做作业，你凭 Day 1 CPT 成功维持了合法工作身份！' }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【绿卡/公民身份】已有绿卡或公民身份，直接跳过抽签困境',
        condition: (s) => s.visa === '绿卡' || s.visa === '公民',
        effect: (s) => ({ message: '你拥有绿卡/公民身份，完全不受抽签限制，继续专注于工作与生活！' }),
        nextEventId: 'sv_year_end_settlement',
      }
    ]
  },

  'h1b_rfe_vs_parent_nag': {
    id: 'h1b_rfe_vs_parent_nag',
    title: '【周五噩梦】移民局 80 页 RFE 信遇到老妈 60 秒语音',
    description: '周五下午 4:55，律所律师发来紧急邮件：“USCIS 针对你的 H1B 发出了 Specialty Occupation RFE，质疑写前端 React 代码不需要计算机学士学位。”\n与此同时，你微信弹出老妈连续三条 60 秒语音：“隔壁王阿姨的小儿子在老家公务员双胞胎都两岁了！你整天在美利坚租房 4000 美金图个啥？！今年到底带不带女朋友回来？！”',
    choices: [
      {
        text: '【通宵三个晚上】通宵三个晚上，写出 120 页辩护报告阐述“为什么 Virtual DOM 调 CSS 属于高等应用数学”',
        condition: (s) => s.visa === 'H1B (工签)',
        // Diligence pays: lower health cost and higher (85%) survival than before, so
        // it isn't dominated by the lazy option (which now gambles the visa).
        effect: (s) => {
          const survive = gameRandom() < 0.85;
          return survive
            ? { health: Math.max(0, s.health - 8), visa: s.visa, message: '你用极具创造性的学术废话打动了移民局官员，成功保住了 H1B 身份！虽然熬了几个通宵，但身份稳了。' }
            : { health: Math.max(0, s.health - 10), story_flags: { ...(s.story_flags || {}), h1b_rfe_denied: true }, message: '移民局最终驳回了你的 RFE 答复，H1B 身份岌岌可危！你被迫紧急寻找其他身份自救方案！' };
        },
        nextEventId: (s) => (s.story_flags?.h1b_rfe_denied ? 'h1b_fallback_options' : h1ToH2Router(s)),
      },
      {
        text: '【消极摆烂吐槽】摆烂：把 RFE 抛诸脑后，先跟老妈吐槽一通 (不答复 RFE)',
        // No longer a free crisis solver: ignoring the RFE is a real gamble — 35% the
        // visa falls into jeopardy. It trades health relief for that risk vs choice 1.
        effect: (s) => {
          const ignoredOk = gameRandom() < 0.65;
          return ignoredOk
            ? { health: Math.min(100, s.health + 5), charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 1), message: '你把 RFE 抛诸脑后，跟老妈吐槽一通后耳根神奇清静了半年，律所也帮你压线补交了材料，有惊无险。' }
            : { health: Math.max(0, s.health - 5), story_flags: { ...(s.story_flags || {}), h1b_rfe_denied: true }, message: '你对 RFE 置之不理，结果错过了补件窗口，H1B 身份告急，只能紧急寻找其他自救方案！' };
        },
        nextEventId: (s) => (s.story_flags?.h1b_rfe_denied ? 'h1b_fallback_options' : h1ToH2Router(s)),
      }
    ]
  },

  'visa_check': {
    id: 'visa_check',
    title: '【海关渡劫】H-1B 被 Check 与漫长等待',
    description: '你回国探亲，顺便去大使馆签证，结果喜提行政审查 (Check)，签证官冷漠地扔给你一张黄条。',
    choices: [
      {
        text: '【在国内每天熬夜】在国内每天熬夜，按美国时间远程上班',
        condition: (s) => s.visa !== '绿卡' && s.visa !== '公民',
        effect: (s) => ({ health: Math.max(0, s.health - 15), cash: s.cash, imageUrl: 'images/visa_denied.jpg', message: '你昼夜颠倒地干了两个月，头发掉光了，但保住了工作。' }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【管他呢】管他呢，直接请无薪假在国内到处旅游！',
        condition: (s) => s.cash >= 20 && s.visa !== '绿卡' && s.visa !== '公民',
        effect: (s) => ({ cash: s.cash - 20, health: Math.min(100, s.health + 30), leetcode: Math.max(0, s.leetcode - 10), imageUrl: 'images/visa_denied.jpg', message: '你顺便打卡了三亚和新疆，身体是养好了，但是现金流大幅缩水，算法也生疏了。' }),
        nextEventId: 'sv_year_end_settlement',
      }
      // 移除了原「绿卡/公民免检」死选项：visa_check 仅在临时签证时注入 (helpers.ts: !isPermanentVisa)，
      // 绿卡/公民永远进不到此事件，该选项恒不可选，属死码。
    ]
  },

  'h1b_final_crisis': {
    id: 'h1b_final_crisis',
    title: '【身份悬崖】H-1B 三抽不中与离境危机',
    description: '连续三年 H1B 抽签全军覆没！你的 STEM OPT 即将到期，公司 HR 和律所发来最终通知：必须在 30 天内解决合法身份，否则将被终止合同并安排外派离境！',
    choices: [
      {
        text: '【真爱伴侣结婚自救】与交往伴侣正式领证结婚，递交 I-130/I-485 婚姻绿卡 (合法合规)',
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
              message: '【美籍配偶秒批绿卡】伴侣拥有美国公民/绿卡身份，领证后为你递交了 I-130/I-485 双递交申请，顺利获批婚姻绿卡，彻底解决在美身份危机！'
            };
          }
          return {
            is_married: true,
            relationship_status: 'married',
            gc_progress: Math.max(3, s.gc_progress || 0),
            gc_stage: s.gc_stage === 'not_started' ? 'i140_approved' : s.gc_stage,
            // Move OFF the OPT/F1 status onto the Day 1 CPT the message describes, so the
            // player isn't re-thrown into this same "3抽不中绝境" crisis every settlement
            // (settlement re-routes here only while visa is OPT/F1 + 3 strikes) — that was a
            // soft-loop. They're now on the marriage/PERM track, maintaining status via CPT.
            visa: 'Day 1 CPT',
            message: '【双职工携手奋斗】你们在绝境中正式领证步入婚姻！不过伴侣同样处于 H1B/PERM 排期长征中。你转入 Day 1 CPT 维持合法工作身份，双方结为双职工家庭互相绑定绿卡排期，静待排期推进！'
          };
        },
        // Non-citizen spouse outcome routes OUT (no infinite re-roll for a guaranteed GC).
        nextEventId: (s: GameState) => s.visa === '绿卡' ? 'post_green_card' : 'sv_year_end_settlement',
      },
      {
        text: '【重金商婚自救】支付 $8w 现金找地下中介匹配公民商婚 (需现金 >= $8w, 极高风险)',
        costBadge: '花费 $8w',
        reqBadge: '高风险',
        condition: (s) => (!s.relationship_status || s.relationship_status === 'single') && s.cash >= 8 && s.visa !== '绿卡' && s.visa !== '公民' && !s.story_flags?.scam_marriage_failed,
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
              message: '【商婚侥幸成功】你支付了 $8w 现金成功通过了移民局婚绿面试，绝地求生拿到临时绿卡！'
            };
          } else if (roll < 0.70) {
            return {
              cash: s.cash - 8,
              health: Math.max(0, s.health - 15),
              story_flags: { ...(s.story_flags || {}), scam_marriage_failed: true },
              message: '【中介卷款跑路】收钱后中介直接失联注销微信，假结婚对象人间蒸发！你血亏 $8w 现金且身份危机迫在眉睫！系统已返回自救面板，请立即选择其他备用路线 (如 Day 1 CPT / 外派温哥华 / EB-5 / O-1)！'
            };
          } else {
            return {
              cash: s.cash - 8,
              status: 'game_over',
              message: '【移民欺诈立案】移民局 FDNS 严厉调查判定为虚假商婚，你被当场遣返回国并终身禁入美国，游戏结束！'
            };
          }
        },
        nextEventId: (s: GameState) => s.status === 'game_over' ? 'end' : (s.visa === '绿卡' ? 'post_green_card' : 'h1b_fallback_options'),
      },
      {
        text: '【学业自救】紧急注册 Day 1 CPT 大学维持合法学生身份并继续工作 (消耗 $1.5w)',
        costBadge: '花费 $1.5w',
        condition: (s) => s.cash >= 1.5 && s.visa !== '绿卡' && s.visa !== '公民',
        effect: (s) => ({
          visa: 'Day 1 CPT',
          cash: s.cash - 1.5,
          message: '【无缝接轨 Day 1 CPT】虽然 STEM OPT 耗尽，但你成功挂靠了 Day 1 CPT 大学，白天写代码晚上交作业，成功维持合法留美身份并继续抽签！'
        }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【砸重金急办 O-1 签证】找顶级律所加急办理 O-1 杰出人才签证 (需现金 >= $8w，限 PhD 或硬核背景)',
        costBadge: '花费 $8w',
        reqBadge: '需 PhD 或硬核背景',
        condition: (s) => (s.is_phd || s.leetcode >= 85 || s.job_type === 'ai_research') && s.cash >= 8 && s.visa !== '绿卡' && s.visa !== '公民' && !s.story_flags?.o1_denied_this_year,
        effect: (s) => {
          const pass = gameRandom() < o1PassProb(s); // shared, consistent O1 odds
          return pass
            ? { cash: s.cash - 8, visa: 'O1 (杰出人才)', message: '律师极其硬核！通过挖掘你在论文和核心架构中的亮点，成功压线批准了 O1 签证！绝地求生！' }
            : { cash: s.cash - 8, health: Math.max(0, s.health - 15), story_flags: { ...(s.story_flags || {}), o1_denied_this_year: true }, message: '移民局严肃驳回了 O1 申请，$8w 律师费彻底打了水漂...请选择其他备选方案！' };
        },
        nextEventId: (s: GameState) => s.visa === 'O1 (杰出人才)' ? 'sv_year_end_settlement' : 'h1b_fallback_options',
      },
      {
        text: '【钞能力自救】全额出资办理新法 EB-5 投资移民绿卡 (花费 $80w 总资产)',
        costBadge: '花费 $80w',
        condition: (s) => (s.cash + (s.stocks || 0)) >= 80 && s.visa !== '绿卡' && s.visa !== '公民',
        effect: (s) => {
          const fromStocks = Math.max(0, 80 - s.cash);
          return { visa: '绿卡', gc_progress: 5, gc_stage: 'approved', cash: s.cash - Math.min(s.cash, 80), stocks: Math.max(0, (s.stocks || 0) - fromStocks), message: '在绝境中你果断出资 $80w 办妥新法 EB-5 投资移民绿卡！彻底解决在美身份枷锁！' };
        },
        nextEventId: 'post_green_card',
      },
      {
        text: '【外派温哥华】接受外派温哥华/多伦多 L1 办公室 (曲线救国，搬迁成本)',
        costBadge: '搬迁成本',
        // Kept universal (guaranteed crisis fallback → no dead-end) but no longer free.
        condition: (s) => s.visa !== '绿卡' && s.visa !== '公民',
        effect: (s) => ({
          visa: 'L1 (外派)',
          l1_relocated: true,
          cash: Math.max(0, s.cash - 3),
          health: Math.max(0, s.health - 10),
          message: '你转到了温哥华分公司，举家搬迁折腾了一整年，凭 L1 签证曲线救国保住了工作！一年后顺利申请调回湾区 Headquarters！'
        }),
        nextEventId: 'sv_year_end_settlement',
      }
    ]
  },

  'post_green_card': {
    id: 'post_green_card',
    title: '【绿卡上岸】硅谷新篇章与自由翱翔',
    description: '身份的枷锁解除后，你发现硅谷的烦恼并没有结束。现在的你面临着人生新的十字路口。',
    choices: [

      {
        text: '【全款买下 Atherton 豪宅】全款拿下 Atherton 顶级学区豪宅！(消耗 $300w · 可用股票抵扣)',
        condition: (s) => (s.cash + (s.stocks || 0)) >= 300,
        effect: (s) => ({ ...deductAssets(s, 300), visa: s.visa === VISA_STATUS.CITIZEN ? VISA_STATUS.CITIZEN : VISA_STATUS.GREEN_CARD, gc_progress: 5, gc_stage: 'approved', rent: 0, has_housing: true, housing_name: HOUSING_NAMES.ATHERTON, charm: Math.min(s.max_charm ?? 25, s.charm + 15), health: 100, message: '你买下了传说中硅谷大佬们扎堆的 Atherton 豪宅！现在你周末可以在自己的大别野里开 Pool Party，享受真正的人生赢家生活！' }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【现场观望挑房】继续在 Open House 现场观望挑房 (回到日常行动)',
        effect: (s) => ({ visa: s.visa === '公民' ? '公民' : '绿卡', gc_progress: 5, gc_stage: 'approved', message: '你看了一圈全现金竞价的疯狂现场，决定再冷静观察观察宏观降息走向。' }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【搞副业炒股】搞副业炒股：梭哈英伟达 (NVDA)！',
        effect: (s) => {
          const winProb = 0.25 + (Math.min(45, s.luck) / 150);
          const win = gameRandom() < winProb;
          return win
            ? { visa: s.visa === '公民' ? '公民' : '绿卡', gc_progress: 5, gc_stage: 'approved', cash: s.cash + Math.min(120, Math.floor(s.cash * 0.6)), message: '皮衣黄刀法精准！英伟达业绩大超预期，你的股票投资获得了巨额收益！' }
            : { visa: s.visa === '公民' ? '公民' : '绿卡', gc_progress: 5, gc_stage: 'approved', cash: Math.max(1, Math.floor(s.cash * 0.6)), health: s.health - 15, message: '买在了高位... 监管禁令导致大厂股票大幅回撤。' };
        },
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【全职创业】辞职！凭大厂技术积累全职创办 AI Startup',
        condition: (s) => s.job_type !== 'startup_founder' && s.job_type !== 'trader',
        effect: (s) => {
          const success = s.leetcode >= 50 && gameRandom() < 0.3;
          return success
            ? { 
                visa: s.visa === '公民' ? '公民' : '绿卡', 
                gc_progress: 5, 
                gc_stage: 'approved', 
                job_type: 'startup_founder',
                level: 'CEO & Founder',
                company: 'AI Startup',
                founder_stage: 'series_a',
                company_valuation: 3000,
                cash: s.cash + 100, 
                tc: 18, 
                message: '你带着前沿的 AI 架构理念获得了顶级风投领投！公司估值达 $3000w，你正式转型全职 Founder 开启创业征程！' 
              }
            : { 
                visa: s.visa === '公民' ? '公民' : '绿卡', 
                gc_progress: 5, 
                gc_stage: 'approved', 
                cash: Math.max(0, s.cash - 15), 
                health: Math.max(0, s.health - 15), 
                message: '创业前沿探索非常艰难，大模型算力成本高昂，在尝试几个 Demo 后你决定继续留在原厂积蓄实力。' 
              };
        },
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【不再唯唯诺诺】不再唯唯诺诺，开始在职场上重拳出击',
        condition: (s) => s.job_type !== 'startup_founder' && s.job_type !== 'trader' && s.job_type !== 'unemployed',
        effect: (s) => ({ visa: s.visa === '公民' ? '公民' : '绿卡', gc_progress: 5, gc_stage: 'approved', charm: Math.min(s.max_charm ?? 25, s.charm + 3), message: '你拿着身份特权不再受气，在组会上直接反驳不合理的 Deadline。' }),
        nextEventId: 'office_politics',
      },
      {
        text: '【彻底摆烂】彻底摆烂，佛系上班',
        condition: (s) => s.job_type !== 'startup_founder' && s.job_type !== 'trader' && s.job_type !== 'unemployed',
        effect: (s) => ({ visa: s.visa === '公民' ? '公民' : '绿卡', gc_progress: 5, gc_stage: 'approved', health: Math.min(100, s.health + 30), cash: s.cash + 10, age: s.age + 2, message: '你开始掌握精湛的职场太极，每天做最少的工作拿足额工资，把精力花在周末去 Tahoe 滑雪上。' }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【全速扩张】绿卡彻底解除身份顾虑，全力带领公司冲刺下轮融资与商业化',
        condition: (s) => s.job_type === 'startup_founder',
        effect: (s) => ({
          visa: s.visa === '公民' ? '公民' : '绿卡',
          gc_progress: 5,
          gc_stage: 'approved',
          company_valuation: (s.company_valuation || 800) + 200,
          charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 2),
          message: '绿卡获批彻底解除了你在美的身份枷锁，你可以 100% 专注于带领公司壮大，估值与业务再创新高！'
        }),
        nextEventId: 'founder_annual_strategy',
      },
      {
        text: '【深耕交易】获得合法居民身份，心无旁骛专注于二级市场交易',
        condition: (s) => s.job_type === 'trader',
        effect: (s) => ({
          visa: s.visa === '公民' ? '公民' : '绿卡',
          gc_progress: 5,
          gc_stage: 'approved',
          cash: s.cash + 10,
          message: '摆脱工签束缚，你以完全合法的居民身份专注于资本市场套利与策略研究！'
        }),
        nextEventId: 'trader_annual_strategy',
      }
    ]
  },

  'h1b_visa_stamping_crisis': {
    id: 'h1b_visa_stamping_crisis',
    title: '【回国续签】H1B 221(g) 行政审查 Check 危机',
    description: '你趁假期回国探亲顺便预约了美领馆 H1B 续签 Stamp。结果因为 CS/AI 敏感专业，签证官微笑着递给你一张黄单（221g Administrative Processing 行政审查）！',
    choices: [
      {
        text: '【远程办公】在国内远程克服时差高强度打卡，每天刷 CEAC 查询签证状态',
        condition: (s) => s.visa !== '绿卡' && s.visa !== '公民',
        effect: (s) => ({
          health: Math.max(0, s.health - 15),
          message: '你白加黑倒时差工作了两周，终于等到了 Passport 带着 Stamp 寄回！成功惊险返美！'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【加急申诉】联系公司法务开具紧急加急信 (Expedite Request)',
        condition: (s) => s.visa !== '绿卡' && s.visa !== '公民',
        effect: (s) => {
          const pass = gameRandom() < 0.55;
          return pass 
            ? { health: Math.min(100, s.health + 5), message: '加急信生效！领事馆提早批复了你的 Visa Stamp，你顺利搭上返美航班！' }
            : { health: s.health - 10, cash: Math.max(0, s.cash - 1), message: '领事馆回复“标准审查无法加急”，你被迫在加州时间深夜远程办公，精疲力竭。' };
        },
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【永久居民 / AP 回美证免签】出示美国护照/绿卡或 AP Combo 卡直接入境',
        condition: (s) => s.visa === '绿卡' || s.visa === '公民' || s.gc_stage === 'i485_pending' || s.gc_stage === 'approved',
        effect: () => ({
          message: '你手握美国绿卡/护照或 I-485 附带的 Advance Parole (AP) Combo 回美卡，在海关 CBP 轻松查验直接入境，无需经历领事馆面签与 Check 煎熬！'
        }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  }
};
