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
        text: '【婚姻绿卡自救】通过伴侣领证递交 I-130/I-485，或单身付费匹配商婚 (合规直批/博弈救命)',
        reqBadge: '需有交往伴侣 或 现金>= $8w',
        condition: (s) => (s.visa !== '绿卡' && s.visa !== '公民') && (
          (s.relationship_status === 'dating' || s.relationship_status === 'matched' || s.is_married) ||
          ((s.cash + (s.stocks || 0)) >= 8 && !s.story_flags?.scam_marriage_failed)
        ),
        effect: (s) => {
          const hasPartner = s.relationship_status === 'dating' || s.relationship_status === 'matched' || s.is_married;
          if (hasPartner) {
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
              visa: (s.visa === 'OPT (实习)' || s.visa === 'F1 (学生)') ? 'Day 1 CPT' : s.visa,
              message: '【双职工携手奋斗】你们正式领证步入婚姻！不过伴侣同样处于 H1B/PERM 排期长征中。你转入 Day 1 CPT 维持合法工作身份，双方结为双职工家庭互相绑定绿卡排期，静待排期推进！'
            };
          } else {
            // 单身付费商婚博弈
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
          }
        },
        nextEventId: (s) => s.status === 'game_over' ? 'end' : (s.visa === '绿卡' ? 'post_green_card' : (s.story_flags?.scam_marriage_failed ? 'h1b_fallback_options' : 'sv_year_end_settlement')),
      },
      {
        text: '【杰出人才自救】申办 O1 签证 (花费 $5w 律师费)',
        costBadge: '花费 $5w',
        reqBadge: '需 PhD、高 Impact 或硬核算法背景',
        condition: (s) => (s.is_phd || (s.impact || 0) >= 20 || s.leetcode >= 85 || s.job_type === 'ai_research') && (s.cash + (s.stocks || 0)) >= 5 && s.visa !== '绿卡' && s.visa !== '公民' && !s.story_flags?.o1_denied_this_year,
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
        text: '【重金商婚自救】找地下中介匹配公民商婚维持身份 (极高风险)',
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
        text: '【学业自救】紧急注册 Day 1 CPT 大学维持合法学生身份并继续工作',
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
        text: '【砸重金急办 O-1 签证】找顶级律所加急办理 O-1 杰出人才签证',
        costBadge: '花费 $8w',
        reqBadge: '需 PhD、高 Impact 或硬核背景',
        condition: (s) => (s.is_phd || (s.impact || 0) >= 20 || s.leetcode >= 85 || s.job_type === 'ai_research') && s.cash >= 8 && s.visa !== '绿卡' && s.visa !== '公民' && !s.story_flags?.o1_denied_this_year,
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

   'day1_cpt_compliance': {
     id: 'day1_cpt_compliance',
     title: '【身份抽检】Day 1 CPT 合规审查',
     description: '移民局 SEVP 对你挂靠的 Day 1 CPT 院校发起了一轮合规抽检:核查学校的 E-Verify 资质、你的课程出勤与 CPT 工作授权是否名副其实。HR 与学校国际学生办公室同时发来问询,你必须妥善应对,证明自己的学生身份货真价实,否则合法工作身份将亮起红灯。',
     choices: [
       {
         text: '【律师全面复核】聘请移民律师彻底梳理 I-20、课表与工作授权,确保万无一失 (花费 $0.8w)',
         costBadge: '花费 $0.8w',
         condition: (s) => s.cash >= 0.8,
         effect: (s) => ({
           cash: s.cash - 0.8,
           message: '【合规无虞】移民律师逐项复核了你的 CPT 学校资质与工作授权材料,抽检顺利通过,身份稳如泰山。'
         }),
         nextEventId: 'sv_daily_life',
       },
       {
          text: '【红眼航班赴校】自费飞回学校本部完成线下考勤与课程打卡 (花费 $0.3w · 稳过)',
          costBadge: '花费 $0.3w',
          // 定位为"花点小钱买确定性":保证过检、无随机、健康代价低(-4)。与免费但更耗神(-6)
          // 且有 15% 追加补件($1w)风险的自行申辩形成"现金换省心/低损耗"的真实取舍,不再被支配。
          effect: (s) => ({
            cash: Math.max(0, s.cash - 0.3),
            health: Math.max(0, s.health - 4),
            message: '【亲赴过检】你花钱飞回学校本部当面补齐了线下课程与考勤记录,虽有些奔波,但抽检干脆利落地一次过关,省心稳妥 (健康 -4)。'
          }),
         nextEventId: 'sv_daily_life',
       },
       {
         text: '【自行申辩】不花钱,自己整理材料向 SEVIS 与学校申辩证明身份合规 (免费 · 耗神)',
         effect: (s) => {
           const pass = gameRandom() < 0.85;
           return pass
             ? { health: Math.max(0, s.health - 6), message: '【自证清白】你熬夜整理齐全了 I-20、课表与工作授权材料,成功向抽检自证学生身份合规 (健康 -6)。' }
             : { health: Math.max(0, s.health - 6), cash: Math.max(0, s.cash - 1), message: '【补件过关】材料被要求追加补件,你额外花了些时间精力与 $1w 加急处理,最终仍有惊无险维持了合法身份 (健康 -6)。' };
         },
         nextEventId: 'sv_daily_life',
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
        text: '【不再唯唯诺诺】手握绿卡重拳出击，硬刚组会抢占核心项目主导权 (进入职场政治)',
        condition: (s) => s.job_type !== 'startup_founder' && s.job_type !== 'trader' && s.job_type !== 'unemployed',
        effect: (s) => ({ visa: s.visa === '公民' ? '公民' : '绿卡', gc_progress: 5, gc_stage: 'approved', charm: Math.min(s.max_charm ?? 25, s.charm + 3), message: '【重拳出击】你拿着永久身份底气不再受气，在组会上直接硬刚不合理 Deadline 并主导核心技术方案，开始在职场政治中角逐话语权！' }),
        nextEventId: 'office_politics',
      },
      {
        text: '【彻底躺平摸鱼】掌握职场太极与神仙 WLB，领满薪水享受加州阳光 (健康 +20 · 现金 +10w)',
        condition: (s) => s.job_type !== 'startup_founder' && s.job_type !== 'trader' && s.job_type !== 'unemployed',
        effect: (s) => ({ visa: s.visa === '公民' ? '公民' : '绿卡', gc_progress: 5, gc_stage: 'approved', health: Math.min(100, s.health + 20), cash: s.cash + 10, message: '【神仙 WLB】你彻底参透了职场太极真谛，每天做最轻松的活、领足额薪水与股票，周末去 Tahoe 滑雪与加州冲浪，身心大回血！' }),
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
  },

  'h1b_six_year_crisis': {
    id: 'h1b_six_year_crisis',
    title: '【工签大限】H-1B 满 6 年与 I-140 审批赛跑',
    description: '你的 H-1B 签证累计已达到法定 6 年上限！移民法规定：若无获批的 I-140 移民申请，H-1B 无法继续延期。公司法务与 HR 发来紧急通知，你必须立即采取行动：',
    choices: [
      {
        text: '【自费 PP 加急 I-140 压线自救】自费 $0.3w 申请 15 天加急审理 (需已提交 PERM / I-140)',
        costBadge: '花费 $0.3w',
        condition: (s) => s.cash >= 0.3 && (s.gc_stage === 'perm_processing' || s.gc_stage === 'perm_audit' || s.gc_stage === 'i140_processing' || s.gc_stage === 'i140_rfe'),
        effect: (s) => ({
          cash: s.cash - 0.3,
          gc_stage: 'i140_approved',
          gc_progress: 3,
          h1b_tenure: 6,
          message: '【加急获批锁定 PD】USCIS 在 15 天内火速批复了你的 I-140！依据 AC21 法案，公司为你成功申请到了无上限的 3 年 H-1B 延期！工签危机彻底解除！'
        }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【外派海外 1 年重置钟表】调往海外分公司驻外工作 1 年 (Reset 6 年工签钟表)',
        costBadge: '花费 $2w 搬迁费',
        condition: (s) => s.cash >= 2 && !s.laid_off && !!s.job_type && s.job_type !== 'unemployed',
        effect: (s) => ({
          cash: s.cash - 2,
          visa: (s.visa === '公民' || s.visa === '绿卡') ? s.visa : 'L1 (外派)',
          h1b_tenure: 0,
          l1_relocated: true,
          health: Math.max(0, s.health - 8),
          message: '【海外驻外重置】你申请调往加拿大温哥华办公室工作满 1 年，成功重置了 6 年 H-1B 钟表并转为 L-1 签证！一年后以全新状态调回湾区总部！'
        }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【紧急挂靠 Day 1 CPT 水硕】转入学生身份维持合法全职工作 (消耗 $1.5w)',
        costBadge: '花费 $1.5w',
        condition: (s) => s.cash >= 1.5,
        effect: (s) => ({
          visa: (s.visa === '公民' || s.visa === '绿卡') ? s.visa : 'Day 1 CPT',
          cash: s.cash - 1.5,
          message: '【无缝转 Day 1 CPT】面对 6 年工签大限，你果断注册了 Day 1 CPT 大学维持合法学生在读身份，白天继续上班，等待公司把 PERM/I-140 流程办妥！'
        }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【真爱伴侣结婚自救】与交往伴侣正式领证结婚，递交婚姻绿卡',
        condition: (s) => (s.relationship_status === 'dating' || s.relationship_status === 'matched' || s.is_married) && s.visa !== '绿卡' && s.visa !== '公民',
        effect: (s) => {
          const partnerIsCitizen = gameRandom() < 0.40;
          if (partnerIsCitizen) {
            return {
              visa: (s.visa === '公民') ? s.visa : '绿卡',
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
            visa: (s.visa === '公民' || s.visa === '绿卡') ? s.visa : 'Day 1 CPT',
            message: '【双职工携手奋斗】你们在绝境中正式领证步入婚姻！你转入 Day 1 CPT 维持合法工作身份，双方结为双职工家庭互相绑定绿卡排期，静待排期推进！'
          };
        },
        nextEventId: (s: GameState) => s.visa === '绿卡' ? 'post_green_card' : 'sv_year_end_settlement',
      },
      {
        text: '【钞能力 EB-5 投资移民】全额出资办理新法 EB-5 投资移民绿卡 (花费 $80w 总资产)',
        costBadge: '花费 $80w',
        condition: (s) => (s.cash + (s.stocks || 0)) >= 80,
        effect: (s) => {
          const fromStocks = Math.max(0, 80 - s.cash);
          return { visa: (s.visa === '公民') ? s.visa : '绿卡', gc_progress: 5, gc_stage: 'approved', cash: s.cash - Math.min(s.cash, 80), stocks: Math.max(0, (s.stocks || 0) - fromStocks), message: '在绝境中你果断出资 $80w 办妥新法 EB-5 投资移民绿卡！彻底甩开所有身份枷锁！' };
        },
        nextEventId: 'post_green_card',
      },
      {
        text: '【体面告别 · 回国发展】工签到期且不想继续折腾，打包行李回国开启新篇章',
        effect: (s) => ({
          status: 'retired',
          message: `你在硅谷奋斗了整整 6 年，在 H-1B 达到法定上限之际，你从容打包行李告别加州阳光。手握 $${(s.cash + (s.stocks || 0)).toFixed(1)}w 美金积蓄与顶级大厂架构履历，你回国开启了广阔的新生活。`
        }),
        nextEventId: 'end',
      }
    ]
  }
};
