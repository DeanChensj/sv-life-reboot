import type { GameEvent, GameState } from '../../types';
import {
  h1ToH2Router, gameRandom, stampSeen, addImpact, deductAssets, pickOtherBigTech,
  resolveHopVisaTransition, landBigTechJob, hopIsPromotion,
} from './helpers';

// 「反转 / 回旋镖」事件 — Twist events that pay off EARLIER choices or state the player has
// accumulated (a rival made years ago, a sham marriage, unvested RSUs, a layoff survived, a
// TC that fell below its own peak). Each is once-per-life (GameEvent.oncePerLife → _seen is
// stamped by applyStateTransition; routers gate with story_flags.<id>_seen), injected from
// midYearEventRouter: career twists in the H1 work block, life/tax twists in the H2 block.
// Trigger predicates (canRivalLandAtNewJob / canRajPipReferral / canShamBlackmail /
// canGoldenHandcuffs / canLayoffSurvivorOncall / canAmtShock / canBoomerangOffer) live in
// helpers.ts next to the routers that consume them (helpers must not import this file — the
// `nextEventId: h1ToH2Router` value references below would hit a TDZ in an import cycle).
// Rules followed (AGENTS.md):
//  - single-choice health loss <= 15; charm capped at max_charm; no money printers / no GC grants.
//  - route on STATE (h1ToH2Router / sv_year_end_settlement), never on message substrings.
//  - every event has an unconditional "safe" choice → no dead-ends.
//  - every story_flag written here is READ somewhere (helpers.ts routers or a sibling event).
//  - any hop sets is_new_job / laid_off:false / job_type / visa via resolveHopVisaTransition.
const employed = (s: GameState): boolean => !!s.job_type && s.job_type !== 'unemployed' && !s.laid_off;

// Remove the paper spouse (shared by all E3 exits). No community property, no feelings to strain.
const dissolveSham = (): Pick<GameState, 'is_married' | 'relationship_status' | 'partner_type'> => ({
  is_married: false,
  relationship_status: 'single',
  partner_type: undefined,
});

export const twistEvents: Record<string, GameEvent> = {
  // ---------------- E1 宿敌空降 ----------------
  'twist_rival_lands_at_new_job': {
    id: 'twist_rival_lands_at_new_job',
    oncePerLife: true,
    title: '【宿敌空降】新公司第一天 Standup，对面坐着 Raj',
    description: '你刚在新东家站稳脚跟，周一 Standup 上 Manager 兴奋地介绍「我们从隔壁厂挖来的资深 Tech Lead」——抬头一看，正是当年被你在 All-Hands 上抢了聚光灯、从此结下梁子的 Raj。他冲你露出那个标志性的微笑：“Hey my friend, small world huh?” 这回他是 Lead，你是组员；而你的 Promo Packet 第一位 Reviewer，大概率就是他。',
    choices: [
      {
        text: '【主动和解 · 请喝 Chai】下班约他去 Castro Street 喝 Chai，把当年的梁子摊开说清楚',
        effect: (s) => ({
          network: Math.min(100, (s.network || 10) + 6),
          charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 1),
          impact: Math.max(0, (s.impact || 0) - 2),
          story_flags: { ...(s.story_flags || {}), raj_rival: false, raj_ally: true, raj_nemesis: false },
          npcs: { ...(s.npcs || {}), raj: { name: 'Raj', role: 'mentor', status: 'ally', note: '新公司重逢后一笑泯恩仇，成了你的 Lead 兼政治盟友' } },
          message: '两杯 Masala Chai 下肚，Raj 坦言当年其实挺佩服你的锋芒。你主动把手里一块高曝光模块让给他做 Demo，换来他在 Calibration 上的一句「strong hire」。影响力略有折损，但你在新公司多了一个最不该得罪、如今却最铁的盟友。',
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '【正面较劲 · 用代码说话】既然冤家路窄，那就在他的组里把他的 Roadmap 全部做成你的 Launch',
        condition: employed,
        effect: (s) => ({
          impact: addImpact(s, 6),
          health: Math.max(0, s.health - 10),
          story_flags: stampSeen(s, 'twist_rival_lands_at_new_job', 1),
          npcs: { ...(s.npcs || {}), raj: { name: 'Raj', role: 'mentor', status: 'nemesis', note: '新公司再度交锋，你在他的组里跟他正面硬刚' } },
          message: '你把 Raj 画的每一张饼都抢先端上了桌：他 Q2 想 Demo 的 Agent 平台，你 Q1 就上线了。VP 开始绕过他直接找你对齐。代价是连续四个月每晚 11 点下线、周末缺席家庭聚餐，而 Raj 看你的眼神也越来越冷。',
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '【装不认识 · 公事公办】保持职业距离，Slack 上只聊 Jira，不给他任何做文章的机会',
        effect: (s) => ({
          health: Math.min(100, s.health + 2),
          impact: addImpact(s, 1),
          message: '你全程公事公办，Code Review 一句废话不多说，1:1 只谈 OKR。Raj 几次想旧事重提都被你用「让我们 focus on the roadmap」挡了回去。平静但微妙的一年，谁也没占到谁的便宜。',
        }),
        nextEventId: h1ToH2Router,
      },
    ],
  },

  // ---------------- E2 Raj 被 PIP 来求内推 ----------------
  'twist_raj_pip_referral': {
    id: 'twist_raj_pip_referral',
    oncePerLife: true,
    title: '【风水轮流转】被 PIP 的 Raj 深夜发来 LinkedIn 私信',
    description: '凌晨 1 点，LinkedIn 弹出一条消息：“Hey my friend, long time no see…” 发信人是 Raj。寒暄三句后他说了实话——他们组被 Reorg，新老板给他下了 PIP，60 天倒计时已经走了 40 天，H-1B 的 60 天 Grace Period 就在后头。他听说你现在是 Senior+，想请你内推进你们组。当年在 All-Hands 上抢你聚光灯的人，如今把全家的身份押在你的一封 Referral 上。',
    choices: [
      {
        text: '【以德报怨 · 全力内推】写满一页 Referral，再帮他 Mock 两轮 System Design',
        condition: employed,
        effect: (s) => {
          // 25%: Raj flops the loop anyway and your manager quietly notes who vouched for him.
          const flop = gameRandom() < 0.25;
          return flop
            ? {
                network: Math.min(100, (s.network || 10) + 6),
                impact: Math.max(0, (s.impact || 0) - 2),
                health: Math.max(0, s.health - 3),
                story_flags: { ...(s.story_flags || {}), raj_rival: false, raj_ally: true, raj_nemesis: false },
                npcs: { ...(s.npcs || {}), raj: { name: 'Raj', role: 'friend', status: 'ally', note: '走投无路时你伸了手，虽然面试挂了但他记你一辈子' } },
                message: '你把 Referral 写得像推荐信，还陪他熬了两个周末 Mock。可惜 Raj 在 System Design 轮被问崩，Hiring Committee 直接 No Hire。Manager 在 1:1 上轻描淡写地提了一句「下次内推把把关」。Raj 最终去了西雅图一家中厂，临走前给你发了长长一段感谢——这个人情，他记下了。',
              }
            : {
                network: Math.min(100, (s.network || 10) + 6),
                health: Math.max(0, s.health - 3),
                story_flags: { ...(s.story_flags || {}), raj_rival: false, raj_ally: true, raj_nemesis: false },
                npcs: { ...(s.npcs || {}), raj: { name: 'Raj', role: 'friend', status: 'ally', note: '走投无路时你伸了手，从此成为你最忠诚的盟友' } },
                message: 'Raj 顺利过了面试，入职当天在 Slack 上给你发了一个 Chai 的 emoji 和一句「I owe you one」。昔日宿敌成了欠你一个大人情的同事，整条 Org 都知道你是那个「能放下恩怨帮人」的人。',
              };
        },
        nextEventId: h1ToH2Router,
      },
      {
        text: '【内推但不背书】走流程点一下 Refer 按钮，Referral 栏只写「Former colleague」',
        condition: employed,
        effect: (s) => ({
          network: Math.min(100, (s.network || 10) + 2),
          message: '你点了 Refer，但备注栏只写了八个字母的「colleague」。Raj 拿到了面试，也看懂了你的态度。他最后去了另一家公司，你们再无联系——没撕破脸，也没修复什么。',
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '【已读不回 · 让他尝尝】当年他怎么分活给你，你今天就怎么回他',
        effect: (s) => ({
          health: Math.min(100, s.health + 3),
          charm: Math.max(0, (s.charm || 10) - 1),
          story_flags: { ...(s.story_flags || {}), raj_nemesis: true },
          npcs: { ...(s.npcs || {}), raj: { name: 'Raj', role: 'mentor', status: 'nemesis', note: '绝境求援被你已读不回，此仇不共戴天' } },
          message: '你盯着那条消息看了十分钟，然后关掉了手机。那一晚你睡得格外香。三个月后听说 Raj 卡着 Grace Period 最后一周在一家 ICC 上了岸。他的 LinkedIn 把你从 Connection 里删了——而硅谷很小，架构评审会上总会再见的。',
        }),
        nextEventId: h1ToH2Router,
      },
    ],
  },

  // ---------------- E3 商婚 USCIS 面谈敲诈 ----------------
  'twist_sham_marriage_blackmail': {
    id: 'twist_sham_marriage_blackmail',
    oncePerLife: true,
    title: '【商婚反噬】USCIS 面谈前夜，名义配偶开口加价 $5w',
    description: '一封 USCIS 信件通知你们夫妻二人下月参加婚姻绿卡的 Stokes 面谈。当晚，那位只在签字时见过三次的「配偶」把你约到 Milpitas 一家奶茶店，开门见山：再加 $5w，否则面谈那天「想不起来你牙刷是什么颜色」，顺便向 USCIS 自首婚姻欺诈。中介早就失联。你手里的绿卡，突然变得烫手。',
    choices: [
      {
        text: '【付钱封口】咬牙转 $5w，换对方在面谈上把台词背熟',
        costBadge: '花费 $5w',
        condition: (s) => (s.cash + (s.stocks || 0)) >= 5,
        effect: (s) => ({
          ...deductAssets(s, 5),
          health: Math.max(0, s.health - 5),
          message: '你分三笔 Zelle 转了 $5w。面谈那天对方表演得滴水不漏，连你家猫叫什么都答对了。走出 USCIS 大楼时你松了口气，也第一次明白了什么叫「被拿捏」。',
        }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【硬刚到底】录下对方勒索的全程，反过来告诉 TA：敲诈是重罪，而你有录音',
        effect: (s) => {
          const win = gameRandom() < Math.min(0.75, 0.35 + ((s.charm || 10) / 60) + ((s.luck || 20) / 300));
          return win
            ? {
                ...dissolveSham(),
                health: Math.min(100, s.health + 5),
                charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 1),
                message: '你把手机录音按在桌上播放了十秒钟。对方脸色瞬间白了——敲诈勒索在加州是 Felony。TA 当场改口「开玩笑的」，面谈顺利通过。随后你反手推进了协议离婚，彻底切断这条线。你的绿卡保住了，心跳也终于回到正常值。',
              }
            : {
                ...dissolveSham(),
                ...deductAssets(s, 8),
                health: Math.max(0, s.health - 12),
                message: '对方没有被吓住，面谈当天直接「坦白」。USCIS 启动了欺诈调查，你花了 $8w 请移民律师打了整整一年拉锯战，靠着税表、租约和几位同事的证词把「真实婚姻」的叙事硬撑了下来，绿卡最终没被撤销。你火速离了婚，但这一年掉的头发和体重，再也回不来了。',
              };
        },
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【提前离婚止损】不付钱也不对峙，立刻找律师递交协议离婚、主动切割',
        effect: (s) => {
          const clean = gameRandom() < 0.5;
          return clean
            ? {
                ...dissolveSham(),
                health: Math.max(0, s.health - 3),
                message: '你的律师动作很快：离婚协议上写明「性格不合」，对方拿着当初那 $8w 的尾款也没再纠缠。面谈被取消，绿卡状态未受影响。你损失的只是几个失眠的夜晚。',
              }
            : {
                ...dissolveSham(),
                ...deductAssets(s, 6),
                health: Math.max(0, s.health - 10),
                message: '离婚文件刚递上去，对方就恼羞成怒向 USCIS 举报。你花了 $6w 律师费应对 RFE 与面谈复审，靠着完整的共同账单和租约勉强过关，绿卡保住了。但那半年每一次门铃响你都以为是 ICE。',
              };
        },
        nextEventId: 'sv_year_end_settlement',
      },
    ],
  },

  // ---------------- E5 金手铐 Refresher ----------------
  'twist_golden_handcuffs_refresher': {
    id: 'twist_golden_handcuffs_refresher',
    oncePerLife: true,
    title: '【金手铐】Manager 甩出一份四年 Refresher，隔壁厂的 Offer 还在手机里',
    description: 'Perf 季刚过，Manager 神秘兮兮地约你去 Building 43 的小会议室，推过来一份 Retention Grant：$12w 的 Refresher，四年 Vest，第一年 Cliff。与此同时你手机里躺着隔壁厂的 Offer——Base 更高，但一走，手里那一大笔还没 Vest 的 RSU 就全部作废。Manager 笑着说：“We really want you to stay.” 你知道，这就是传说中的金手铐。',
    choices: [
      {
        text: '【戴上金手铐】签下 Refresher，把隔壁的 Offer 礼貌婉拒',
        effect: (s) => ({
          stocks: (s.stocks || 0) + 12,
          tc: s.tc + 2,
          impact: Math.max(0, (s.impact || 0) - 3),
          story_flags: { ...(s.story_flags || {}), golden_handcuffs_locked: true },
          message: '你签了字，Refresher 到账 $12w (四年 Vest)。但从此每次开会你都在算「还剩多少没 Vest」，接到硬骨头项目的第一反应变成了「别出事就好」。影响力悄悄下滑，Blind 上管这叫 Rest and Vest。',
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '【砸碎手铐 · 接 Offer 走人】放弃未 Vest 股票，跳槽隔壁厂重新开始',
        condition: employed,
        effect: (s) => {
          // Standard hop landing (ladder +1 when impact allows, else lateral) — keeps TC inside the
          // level's realism band. last_promo_age is stamped ONLY on a real level-up (hopIsPromotion).
          const land = landBigTechJob(s, 24);
          const hopVisa = resolveHopVisaTransition(s);
          const forfeited = Math.min(s.stocks || 0, 15);
          return {
            company: land.company,
            job_type: land.job_type,
            level: land.level,
            last_promo_age: hopIsPromotion(s) ? s.age : s.last_promo_age,
            laid_off: false,
            is_new_job: true,
            visa: hopVisa.visa as GameState['visa'],
            tc: Math.max(land.tc, s.tc + 3),
            stocks: Math.max(0, (s.stocks || 0) - forfeited),
            cash: Math.max(0, s.cash + hopVisa.cashDelta),
            health: Math.min(100, s.health + 5),
            message: `你把 Refresher 原封不动推了回去，第二天递了辞呈。未 Vest 的 $${forfeited}w 股票清零，但新东家的 Package 补回了大半。离职那天你在停车场多坐了十分钟——然后发现自己好久没有这么轻松过了。${hopVisa.note}`,
          };
        },
        nextEventId: h1ToH2Router,
      },
      {
        text: '【拿 Offer 谈 Refresh】把隔壁的 Offer 当筹码，向 Manager 要求 Refresher 翻倍',
        effect: (s) => {
          const win = gameRandom() < Math.min(0.5, 0.2 + ((s.impact || 0) / 150) + ((s.network || 10) / 250));
          return win
            ? {
                stocks: (s.stocks || 0) + 16,
                health: Math.max(0, s.health - 3),
                message: 'Manager 看了一眼你的 Competing Offer，去找 Director 批了个 Exception——Refresher 从 $12w 提到 $16w。你留了下来，但也明白：这招一辈子只能用一次。',
              }
            : {
                stocks: (s.stocks || 0) + 6,
                network: Math.max(0, (s.network || 10) - 2),
                health: Math.max(0, s.health - 5),
                message: 'Manager 的笑容淡了下去：「预算就这么多。」最后 Refresher 不升反降到 $6w 的安慰奖，而你拿 Offer 压价的事也在 Skip-Level 那里留了底。隔壁的 Offer 则因为你拖太久被撤回了。',
              };
        },
        nextEventId: h1ToH2Router,
      },
    ],
  },

  // ---------------- E6 裁员幸存者三人份 oncall ----------------
  'twist_layoff_survivor_oncall': {
    id: 'twist_layoff_survivor_oncall',
    oncePerLife: true,
    title: '【幸存者诅咒】裁员名单没有你，三个人的 On-call 轮值表上全是你',
    description: '裁员的尘埃落定，你保住了工位——然后发现组里 8 个人只剩 3 个，而 On-call 轮值表、线上 SLA 和 OKR 一个都没少。Manager 在 All-Hands 上说「我们要 Do more with less」，PagerDuty 一周响了 23 次。Blind 上有人给这叫「Survivor\'s Guilt Tax」。',
    choices: [
      {
        text: '【扛起三人份】把三个人的活一个人干完，用 SLA 数据证明组里离不开你',
        effect: (s) => ({
          impact: addImpact(s, 8),
          health: Math.max(0, s.health - 12),
          story_flags: stampSeen(s, 'twist_layoff_survivor_oncall', 1),
          message: '你一个人顶住了三个人的 On-call，线上 SLA 居然还涨了 0.1 个 9。Director 在 Perf 里给你写了「irreplaceable」。代价是半年没在凌晨 3 点前睡过整觉，家人几乎没见过你清醒的样子。',
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '【Quiet Quitting】工作只做到 Meets，Pager 该静音就静音，身体要紧',
        effect: (s) => ({
          health: Math.min(100, s.health + 4),
          impact: Math.max(0, (s.impact || 0) - 2),
          story_flags: { ...(s.story_flags || {}), survivor_slacked: true, survivor_slacked_year: s.year },
          message: '你把 PagerDuty 调成了「工作时间以外静音」，Standup 上永远是「still in progress」。身体是养回来了一些，但 Manager 的 1:1 里开始频繁出现「ownership」这个词——下一轮 Perf 名单上，你的名字恐怕不会太安全。',
        }),
        nextEventId: h1ToH2Router,
      },
      {
        text: '【摊牌要人或要钱】拿着 Pager 记录找 Manager：要么加 Headcount，要么给 Retention',
        effect: (s) => {
          const win = gameRandom() < Math.min(0.65, 0.3 + ((s.network || 10) / 150) + ((s.impact || 0) / 200));
          return win
            ? {
                tc: s.tc + 3,
                health: Math.max(0, s.health - 3),
                message: '你把 23 次 Page 的记录做成了一页 Slide 摆在 Manager 面前。两周后 HR 批了一笔 Retention Adjustment，总包上调 $3w，同时组里开了一个 Contractor 的位置分担 On-call。',
              }
            : {
                impact: Math.max(0, (s.impact || 0) - 2),
                health: Math.max(0, s.health - 6),
                message: 'Manager 听完点点头说「I hear you」，然后什么都没发生。你的「谈判」被包装成「态度问题」写进了 Calibration 备注，On-call 轮值表依旧是你的名字。',
              };
        },
        nextEventId: h1ToH2Router,
      },
    ],
  },

  // ---------------- E7 AMT 税季暴击 ----------------
  'twist_amt_tax_shock': {
    id: 'twist_amt_tax_shock',
    oncePerLife: true,
    title: '【税季暴击】TurboTax 跳出一个六位数：ISO 行权触发 AMT',
    description: '四月初，你照例打开 TurboTax 准备 15 分钟搞定报税，结果页面卡了三秒，弹出一个你从没见过的词：Alternative Minimum Tax。去年行权的 ISO 和解禁的 RSU 按「纸面收益」被征了税——哪怕你一股都没卖。补税金额大约是你股票持仓的 12%，IRS 的截止日期是 4 月 15 日。',
    choices: [
      {
        text: '【卖股补税】忍痛清掉一部分持仓，4 月 15 日前把 AMT 一次缴清',
        effect: (s) => {
          const tax = Math.round((s.stocks || 0) * 0.12);
          return {
            stocks: Math.max(0, (s.stocks || 0) - tax),
            health: Math.max(0, s.health - 4),
            message: `你在周一开盘卖出了 $${tax}w 的股票补缴 AMT。账户少了一截，但 IRS 那边干干净净。你顺手把今年的 ISO 行权计划全部删掉了。`,
          };
        },
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【申请分期 · 先拖着】向 IRS 申请 Installment Agreement，先交 $2w 利息罚金，其余分 36 期',
        effect: (s) => ({
          ...deductAssets(s, 2),
          health: Math.max(0, s.health - 3),
          story_flags: { ...(s.story_flags || {}), irs_watchlist: true, irs_watchlist_year: s.year },
          message: '你填了 Form 9465 申请分期，先交了 $2w 的利息与罚金。现金流是保住了，但从此你的税表被 IRS 打上了「重点关注」标签——未来几年收到稽查信的概率，比隔壁那位老老实实报税的同事高得多。',
        }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【请 CPA 做 AMT Credit】花 $1w 请 Palo Alto 的华人 CPA 重做税表，用 AMT Credit 和 83(b) 把税款砍半',
        costBadge: '花费 $1w + 一半税款',
        condition: (s) => (s.cash + (s.stocks || 0)) >= 1 + Math.round((s.stocks || 0) * 0.06),
        effect: (s) => {
          const halfTax = Math.round((s.stocks || 0) * 0.06);
          return {
            ...deductAssets(s, 1 + halfTax),
            health: Math.max(0, s.health - 2),
            message: `CPA 翻出你三年前漏报的 83(b) 和可结转的 AMT Credit，把应缴税款从原来的数字砍到了 $${halfTax}w，外加 $1w 服务费。你终于理解了为什么湾区人人都说：年薪过了某个数，CPA 比 Leetcode 重要。`,
          };
        },
        nextEventId: 'sv_year_end_settlement',
      },
    ],
  },

  // ---------------- E8 Boomerang Offer ----------------
  'twist_boomerang_offer': {
    id: 'twist_boomerang_offer',
    oncePerLife: true,
    title: '【回旋镖】老东家的 Recruiter 发来一句：“Would you consider coming back?”',
    description: '你现在的总包离自己的历史巅峰差了一大截——裁员后的降薪上岸，或是一次失败的跳槽，总之账单没变、Package 缩水了。这时老东家的 Recruiter 发来一封邮件：你当年的 Skip 升了 VP，点名要把你挖回去，Package 按你离开时的峰值恢复，Level 不变。唯一的问题：当初是你发了那封「It\'s been an incredible journey」的离职信。',
    choices: [
      {
        text: '【吃回头草】接受 Boomerang Offer，按历史峰值总包回归老东家',
        condition: employed,
        effect: (s) => {
          const hopVisa = resolveHopVisaTransition(s);
          const peak = Math.max(s.tc, s.max_tc || s.tc);
          return {
            company: pickOtherBigTech(s),
            job_type: 'big_tech',
            laid_off: false,
            is_new_job: true,
            visa: hopVisa.visa as GameState['visa'],
            tc: peak,
            impact: Math.max(0, (s.impact || 0) - 4),
            cash: Math.max(0, s.cash + hopVisa.cashDelta),
            message: `你回到了老东家，工卡照片还是三年前那张。总包恢复到巅峰的 $${peak}w。第一天的 Standup 上有人笑着说「welcome back」，也有人在 Blind 上发帖「那个走了又回来的人是不是混不下去了」——在新组里，你得重新证明一遍自己。${hopVisa.note}`,
          };
        },
        nextEventId: h1ToH2Router,
      },
      {
        text: '【留在原地 · 争取 Retention】婉拒回归，但把这封邮件「不小心」让现任 Manager 看到',
        effect: (s) => {
          // A previous golden-handcuffs refresher means this employer has already paid to keep you once —
          // the second retention check is noticeably smaller.
          const grant = s.story_flags?.golden_handcuffs_locked ? 4 : 8;
          return {
            stocks: (s.stocks || 0) + grant,
            network: Math.min(100, (s.network || 10) + 3),
            message: `你回了 Recruiter 一句「not at this time」，然后在 1:1 上「顺口」提了一句老东家在挖你。两周后 Manager 批了一笔 $${grant}w 的 Retention Grant。总包依旧没回到巅峰，但你至少不用再写一遍 Onboarding 文档。`,
          };
        },
        nextEventId: h1ToH2Router,
      },
      {
        text: '【拿 Offer 压价】把 Boomerang Offer 的数字直接甩给现任 Manager，要求 Match',
        effect: (s) => {
          const win = gameRandom() < Math.min(0.6, 0.3 + ((s.impact || 0) / 150) + ((s.network || 10) / 200));
          return win
            ? {
                tc: s.tc + 5,
                health: Math.max(0, s.health - 3),
                message: 'Manager 看了一眼数字，沉默了五秒钟，然后说「let me see what I can do」。两周后 HR 批了 Off-cycle Adjustment，总包上调 $5w。老东家那边你礼貌地回绝了——筹码用一次就够了。',
              }
            : {
                health: Math.max(0, s.health - 5),
                impact: Math.max(0, (s.impact || 0) - 2),
                message: 'Manager 冷冷地说了句「then maybe you should take it」。你没敢真走，Offer 过期后你留在了原地，但从此 1:1 上多了一层说不清的尴尬，高曝光项目也开始绕着你分配。',
              };
        },
        nextEventId: h1ToH2Router,
      },
    ],
  },
};
