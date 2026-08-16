import type { GameEvent, GameState } from '../../types';
import { getLevelScaledTC, midYearEventRouter, h1ToH2Router, isOpportunityActiveThisYear, gameRandom } from './helpers';
import { getTCBreakdown } from '../../utils/gameStateSelectors';
import { isOwnedHousing, HOUSING_NAMES } from '../../constants/gameConstants';

export const housingFinanceEvents: Record<string, GameEvent> = {
  'choose_housing': {
    id: 'choose_housing',
    title: '湾区租房',
    description: '恭喜你拿到 Offer 开启职场生涯！现在你需要在湾区租房。房租会作为你每年的固定开销。',
    choices: [
      {
        text: '豪华 1b1b (每年 4 万美元): 环境好，心情愉悦',
        effect: (s) => ({ rent: 4, charm: s.charm + 1, health: s.health + 10, has_housing: true, housing_name: HOUSING_NAMES.SAN_JOSE_LUXURY, message: '你租下了带有池高级公寓，生活质量极高，相亲市场竞争力上升。' }),
        nextEventId: (s) => (s.visa === 'F1 (学生)' || s.visa === 'OPT (实习)') && !s.h1b_attempts ? 'big_tech_work' : 'sv_daily_life'
      },
      {
        text: '和朋友合租 2b2b (每年 2 万美元): 性价比高',
        effect: (s) => ({ rent: 2, has_housing: true, housing_name: HOUSING_NAMES.CUPERTINO_SHARED, message: '你和朋友合租，偶尔会因为抢厕所和洗碗吵架，但省下了不少钱。' }),
        nextEventId: (s) => (s.visa === 'F1 (学生)' || s.visa === 'OPT (实习)') && !s.h1b_attempts ? 'big_tech_work' : 'sv_daily_life'
      },
      {
        text: '挂壁大客厅 (每年 1 万美元): 终极省钱',
        effect: (s) => ({ rent: 1, charm: s.charm - 2, health: s.health - 15, has_housing: true, housing_name: HOUSING_NAMES.LIVING_ROOM_SCREEN, message: '你睡在客厅，用帘子隔开。每天被室友做饭吵醒，毫无隐私，连相亲都不敢带人回家。' }),
        nextEventId: (s) => (s.visa === 'F1 (学生)' || s.visa === 'OPT (实习)') && !s.h1b_attempts ? 'big_tech_work' : 'sv_daily_life'
      }
    ]
  },

  'change_rental': {
    id: 'change_rental',
    title: '重新选择湾区租房',
    description: '身价与年薪变了，是时候调整你的固定住房开支与居住体验了。',
    choices: [
      {
        text: '豪华 1b1b (每年 4 万美元): 泳池健身房与全职门卫, 提振相亲社交',
        condition: (s) => s.cash >= 4 || s.tc >= 18,
        effect: (s) => ({ rent: 4, charm: Math.min(25, s.charm + 3), health: Math.min(100, s.health + 15), housing_name: HOUSING_NAMES.SAN_JOSE_LUXURY, message: '你搬进了带无边泳池的高级公寓！生活质量飙升！' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '和朋友合租 2b2b (每年 2 万美元): 性价比极高的湾区中产标准',
        effect: (s) => ({ rent: 2, housing_name: HOUSING_NAMES.CUPERTINO_SHARED, message: '你搬进了 Cupertino 经典的双主卧合租公寓，省钱又方便。' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '挂壁大客厅隔间 (每年 1 万美元): 极致压低开销狂攒首付/防破产',
        effect: (s) => ({ rent: 1, charm: Math.max(0, s.charm - 2), health: Math.max(0, s.health - 10), housing_name: HOUSING_NAMES.LIVING_ROOM_SCREEN, message: '你搬回了客厅屏风隔间，将每年固定的房租开销砍到了极致。' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '终极挂壁：连夜退租！搬进特斯拉/租用 Van 里睡车顶 (房租归零 $0/年)',
        condition: (s) => !!(s.car && s.car !== 'none'),
        effect: (s) => ({ rent: 0, housing_name: HOUSING_NAMES.TESLA_ROOF, health: Math.max(0, s.health - 15), message: '你把睡袋卡式炉扔进车后备箱，正式开启硬核湾区车顶睡袋生活！房租彻底归零！' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '算了，目前的房子住得挺好，不搬了',
        effect: (s) => ({ message: '你打消了搬家念头。' }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'buy_house': {
    id: 'buy_house',
    title: '宇宙中心加价抢房大乱斗',
    description: '湾区房地产 Open House 现场挤满了手里攥着支票簿的华裔和印度裔工程总监。中介微笑着告诉你：“已经收到了 14 个 No-Contingency 全现金 Offer，你准备加价多少？”',
    imageUrl: 'images/house.jpg',
    choices: [
      {
        text: '抢 Sunnyvale 70年代加州单层老破小 SFH (首付 $45w, 每年地税/房贷消耗低) - 湾区做题家神房',
        condition: (s) => (s.cash + (s.stocks || 0)) >= 45,
        effect: (s) => ({ cash: s.cash - 45, rent: 1.5, has_housing: true, housing_name: HOUSING_NAMES.SUNNYVALE, health: s.health + 10, imageUrl: 'images/house.jpg', message: '虽说是 1974 年木板老破小且地板走起来吱吱响，但地大 7500 尺能开辟菜园种葱，去 Apple Park 和 Googleplex 只要 12 分钟！做题家终极神房落地！' }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '买 North San Jose 现代挑高高密度 Townhouse (首付 $40w, 年供折算 $2.5w) - 颜值极高的小红书美宅',
        condition: (s) => (s.cash + (s.stocks || 0)) >= 40,
        effect: (s) => ({ cash: s.cash - 40, rent: 2.5, has_housing: true, housing_name: HOUSING_NAMES.NORTH_SAN_JOSE, charm: Math.min(25, s.charm + 5), message: '全套智能家电、石英石大理石中岛！虽然贴着 neighbor 抽油烟机且每月要上缴 $550 恶心 HOA 费，但每天拍 home decor 发小红书点赞爆表！' }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '攻下 Fremont Mission San Jose 9分顶配学区房 (首付 $65w, 年负担 $4.5w) - 卷二代的终极战场',
        condition: (s) => (s.cash + (s.stocks || 0)) >= 65,
        effect: (s) => ({ cash: s.cash - 65, rent: 4.5, has_housing: true, housing_name: HOUSING_NAMES.FREMONT, charm: Math.min(25, s.charm + 4), luck: s.luck + 10, message: '为了娃彻底豁出去了！隔壁邻居全是高强度卷 AMC10 和卡内基梅隆机器人夏令营的硅谷老爹，社区图书馆周末全是解题小孩，神教合一！' }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '向国内父母紧急开支票（掏空六个钱包跨国电汇凑齐首付）',
        condition: (s) => (s.cash + (s.stocks || 0)) < 40 && !s.parents_helped_house,
        // Player chips in a small fixed contribution; parents cover the rest (was
        // cash:0, which discarded up to ~$40w of the player's existing savings).
        effect: (s) => ({ cash: Math.max(0, s.cash - 3), has_housing: true, housing_name: HOUSING_NAMES.SUNNYVALE, health: s.health - 15, parents_helped_house: true, message: '父母卖掉了国内老家二线城市的房子跨国电汇给你凑齐了 Sunnyvale 首付，你背上了深沉的愧疚包袱与巨额房贷。' }),
        nextEventId: 'house_slave',
      },
      {
        text: '资金暂时不足 / 观望行情，先返回日常行动攒钱',
        effect: () => ({ message: '你看了一眼加价疯狂且竞争白热化的湾区房市，决定等现金流更充裕时再做打算。' }),
        nextEventId: 'sv_year_end_settlement',
      }
    ]
  },

  'house_slave': {
    id: 'house_slave',
    title: '沉重的房贷生活',
    description: '通过父母举债六个钱包交齐首付买下 Sunnyvale 老破小后，每年固定房屋供税支出让手头极度紧绷。你决定怎么应对接下来的挑战？',
    choices: [
      {
        text: '老老实实上班，咬牙扛住房贷（进入日常行动）',
        effect: (s) => ({ rent: 2.2, has_housing: true, housing_name: HOUSING_NAMES.SUNNYVALE, health: Math.max(0, s.health - 5), message: '你把心安在了加州木板老破小里，虽然房贷沉重，但每次看到属于自己的草坪，干劲又回来了！' }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '把次卧与车库偷偷出租给转码留学生（每年回血 $1.5w 被动现金流）',
        effect: (s) => {
          const badTenant = gameRandom() > 0.65;
          // Renting a spare room does NOT reduce your own mortgage carry; the benefit
          // is only the rental income (was double-counted by also lowering `rent`).
          return badTenant
            ? { rent: 2.2, has_housing: true, housing_name: HOUSING_NAMES.SUNNYVALE, has_adu_rented: true, rental_income: (s.rental_income || 0) + 1.0, health: Math.max(0, s.health - 15), message: '留学生搞加密货币挖矿弄跳闸了电闸还开派对，虽然收了租金 (+$1.0w/年)，但把你折腾得够呛。' }
            : { rent: 2.2, has_housing: true, housing_name: HOUSING_NAMES.SUNNYVALE, has_adu_rented: true, rental_income: (s.rental_income || 0) + 1.5, message: '好运！留学生是 CMU 学霸，安静极少下厨还按时交租，为你带来稳定被动租金 (+1.5w/年)！' };
        },
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '断供卖房！回归租房生活的自由',
        condition: (s) => s.cash < 50,
        // Foreclosure recovers real buyer equity only — nothing if parents funded it
        // (closes the parents-buy → default-sell free-cash exploit). Also stop the
        // phantom ADU rent: clear has_adu_rented and remove the ADU income portion.
        effect: (s) => ({ cash: s.cash + (s.parents_helped_house ? 0 : 35), has_housing: false, housing_name: HOUSING_NAMES.NORMAL_SHARED, rent: 2, has_adu_rented: false, rental_income: Math.max(0, (s.rental_income || 0) - 1.5), health: s.health + 10, message: '你最终无力支付房贷被迫断供卖房。虽亏掉了前期本金，但你卸下了深沉包袱，重新拿回流动资金回到出租屋。' }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '感觉人生一眼望到头，卖房去创业！(要求 100 万现金)',
        condition: (s) => s.cash >= 100 && s.job_type !== 'startup_founder',
        // Selling ADDS home equity (was subtracting $50w while keeping the house).
        // Actually liquidate the home and start the FOUNDER path (not the employee event).
        effect: (s) => ({ cash: s.cash + 35, has_housing: false, housing_name: HOUSING_NAMES.NORMAL_SHARED, rent: 2, has_adu_rented: false, rental_income: Math.max(0, (s.rental_income || 0) - 1.5), job_type: 'startup_founder', founder_stage: 'pre_seed', company_valuation: 500, tc: 6, level: undefined, company: undefined, message: '你受够了温水煮青蛙，卖了房子套现，拿着这笔启动资金投身创业大潮，成为了一名硅谷 Founder！' }),
        nextEventId: 'founder_annual_strategy',
      }
    ]
  },

  'manage_rental_properties': {
    id: 'manage_rental_properties',
    title: '房产投资与资产管理中心',
    description: '在硅谷与全美优质学区配置投资性不动产，打造无惧科技裁员周期的终极被动现金流（Passive Rental Income）！',
    imageUrl: 'images/house.jpg',
    choices: [
      {
        text: '【自住房改造】搭建后院 ADU 独立套间并出租 (耗费 $1.5w · 产生 +$1.2w/年 租金净流)',
        costBadge: '花费 $1.5w',
        condition: (s) => s.has_housing && !s.has_adu_rented && (s.cash + (s.stocks || 0)) >= 1.5 && isOwnedHousing(s.housing_name),
        effect: (s) => ({
          cash: s.cash - 1.5,
          has_adu_rented: true,
          rental_income: (s.rental_income || 0) + 1.2,
          message: '【ADU 改造完成】你在后院建起了一套带独立卫浴的预制 ADU，挂在 Zillow 上第一天就被隔壁大厂实习生秒签！每年稳定产生 +$1.2w 净租金流！'
        }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【外州远程投资】购入 Austin/Seattle 精装独栋别墅 (首付 $25w · 产生 +$1.2w/年 租金净流)',
        costBadge: '首付 $25w',
        condition: (s) => (s.cash + (s.stocks || 0)) >= 25 && !(s.investment_properties || []).includes('Austin 远程独栋屋'),
        effect: (s) => ({
          cash: s.cash - 25,
          rental_income: (s.rental_income || 0) + 1.2,
          investment_properties: [...(s.investment_properties || []), 'Austin 远程独栋屋'],
          message: '【外州资产配置】借助全美远程物业托管，你在德州 Austin 核心科技园区拿下了一套独栋屋，租给 Tesla/Apple 工程师，每年被动落袋 +$1.2w 纯现金流！'
        }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【湾区核心投资】购入东湾 Hayward/Fremont 独栋出租房 (首付 $45w · 产生 +$2.2w/年 租金净流)',
        costBadge: '首付 $45w',
        condition: (s) => (s.cash + (s.stocks || 0)) >= 45 && !(s.investment_properties || []).includes('Hayward 独立投资房'),
        effect: (s) => ({
          cash: s.cash - 45,
          rental_income: (s.rental_income || 0) + 2.2,
          investment_properties: [...(s.investment_properties || []), 'Hayward 独立投资房'],
          message: '【湾区核心资产】拿下东湾优质通勤独立屋！坐收湾区刚需码农家庭租金，每年稳健产生 +$2.2w 租金现金流！'
        }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【大地主终极资产】全款/杠杆拿下 Sunnyvale 4-Plex 核心多户公寓楼 (首付 $120w · 产生 +$6.0w/年 巨额租金)',
        costBadge: '首付 $120w',
        condition: (s) => (s.cash + (s.stocks || 0)) >= 120 && !(s.investment_properties || []).includes(HOUSING_NAMES.SUNNYVALE_4PLEX),
        effect: (s) => ({
          cash: s.cash - 120,
          rental_income: (s.rental_income || 0) + 6.0,
          investment_properties: [...(s.investment_properties || []), HOUSING_NAMES.SUNNYVALE_4PLEX],
          charm: Math.min(25, (s.charm || 10) + 5),
          message: '【加州大地主登顶】你拿下了 Sunnyvale 黄金地段 4 套相连的公寓楼！光靠收租每年就能躺赚 +$6.0w 净现金流，彻底告别打工内卷！'
        }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '返回日常行动',
        effect: () => ({ message: '你审视了名下的资产组合与租金收益，决定稳健经营现金流。' }),
        nextEventId: 'sv_year_end_settlement',
      }
    ]
  },

  'house_warming_party': {
    id: 'house_warming_party',
    title: '【豪宅乔迁】湾区做题家 Housewarming BBQ',
    description: '你买下了属于自己的湾区房产，周末在私人草坪庭院举行了乔迁露天烤肉派对 (Housewarming)。',
    choices: [
      {
        text: '邀请同事与邻居来庭院做天幕 BBQ 派对 (消耗 $0.3w)',
        effect: (s) => ({
          cash: Math.max(0, s.cash - 0.3),
          charm: Math.min(s.max_charm ?? 25, s.charm + 4),
          network: Math.min(100, (s.network || 10) + 3), // "社交圈口碑暴涨" now grants network
          health: Math.min(100, s.health + 15),
          story_flags: { ...(s.story_flags || {}), housewarming_done: true },
          message: '烤肉香气扑鼻，大家纷纷夸赞你的眼光与房产品质！社交圈口碑暴涨！'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '拍摄全套 Home Decor 发小红书“湾区买房心得”',
        effect: (s) => ({
          charm: Math.min(25, (s.charm || 10) + 5),
          luck: Math.min(99, (s.luck || 20) + 5),
          story_flags: { ...(s.story_flags || {}), housewarming_done: true },
          message: '爆款文章收割了上千点赞！你成为了小红书湾区家居/房产圈的顶流 Blogger！'
        }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'startup_angel_investing': {
    id: 'startup_angel_investing',
    title: '【硅谷资本圈】天使投资人俱乐部',
    description: '手握超过百万元流动现金的你，收到了硅谷华人天使投资俱乐部 (Bay Angels) 的秘密邀请。',
    choices: [
      {
        text: '出资 $20w 成为 AI 独角兽 Seed 轮天使投资人 (高风险)',
        // Heavy-tailed like real angel investing: mostly a loss, rare 5x. Stake is
        // deducted up front so a win nets stake×5 − stake = +$80w (was +$100w & +EV).
        effect: (s) => {
          const win = gameRandom() < 0.12;
          return win 
            ? { cash: s.cash + 80, message: '万里挑一！你投资的 AI 独角兽被巨头高价买断，天使轮获得 5 倍天价回报 (净 +$80w)！' }
            : { cash: Math.max(0, s.cash - 20), health: s.health - 10, message: 'AI 大模型算力消耗太快，创业团队见底倒闭。你交了 20 万美元天使投资学费。' };
        },
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '观望不投，只去品尝顶级红酒与交流网络',
        effect: (s) => ({
          charm: Math.min(s.max_charm ?? 25, s.charm + 2),
          network: Math.min(100, (s.network || 10) + 3), // "拓展资本圈高管人脉" now grants network
          health: Math.min(100, s.health + 5),
          message: '你保持了理智，蹭到了昂贵的红酒并拓展了资本圈高管人脉。'
        }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'property_hoa_special_assessment': {
    id: 'property_hoa_special_assessment',
    title: '【湾区房产危机】HOA 专项摊派与房屋天价大修账单',
    description: '你名下的湾区房产收到了 HOA 业委会的紧急挂号信！由于加州暴雨与房屋地基沉降，社区需要整体更换瓦片屋顶并修缮排水管，HOA 宣布向每户发起 $3.5w 美金的 Special Assessment 专项特别摊派账单！',
    choices: [
      {
        text: '【爽快缴纳全款】咬牙拿出流动资金，彻底修缮地基屋顶',
        effect: (s) => ({
          cash: Math.max(-0.5, s.cash - 3.5),
          health: s.health + 5,
          message: '你痛心地划走了 3.5 万美金！但修缮后的房子在 Zillow 上的估值立刻大涨，房屋安全性大增。'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【加入 HOA 业委会抗争】在社区业主大会上与 HOA 主席展开大战',
        // Actually charge the reduced $1.5w assessment the message states (was $0 —
        // the stated cost was silently omitted, making this a near-free option).
        effect: (s) => ({
          cash: Math.max(-0.5, s.cash - 1.5),
          charm: Math.min(s.max_charm ?? 25, s.charm + 3),
          health: Math.max(0, s.health - 15),
          message: '你在邻居群里化身意见领袖，成功把摊派金额砍到了 $1.5w！虽然省了一大笔，但整整三个星期都在和业委会扯皮，身心俱疲。'
        }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'property_supplemental_tax_hike': {
    id: 'property_supplemental_tax_hike',
    title: '【房产重击】加州 Santa Clara 县评估员重估房屋补充房产税账单',
    description: '周五下班回家，你打开信箱赫然发现一封来自 Santa Clara 县 Assessor 评估办公室的挂号信：由于房产评估值重估，你必须限期补缴 Supplemental Property Tax 补充房产税及加州县级附加税！',
    choices: [
      {
        text: '咬牙全额缴纳补充房产税账单 (消耗 $3w 现金)',
        condition: (s) => s.cash >= 3,
        effect: (s) => ({ cash: s.cash - 3, health: s.health - 5, message: '你一次性补齐了 $3w 房产税账单，虽然心痛不已，但保住了房产产权。' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '聘请专业 Property Tax Appeal 申诉律师写辩护书 (花费 $1w 律师费)',
        condition: (s) => s.cash >= 1,
        effect: (s) => {
          const win = gameRandom() < 0.5;
          return win
            ? { cash: s.cash - 1, charm: Math.min(25, s.charm + 2), message: '律师出面成功证明了评估值虚高，帮为你减免了绝大部分额外房产税！胜诉！' }
            : { cash: s.cash - 4, health: s.health - 10, message: '申诉失败，你不仅补缴了 $3w 房产税，还倒贴了 $1w 律师费！痛苦加倍。' };
        },
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '现金吃紧，向县政府申请税款延期与分期还款协议 (健康 -10)',
        condition: (s) => s.cash < 1,
        effect: (s) => ({ health: Math.max(0, s.health - 10), message: '在复杂的延期申诉流程后，你成功申请了税款分期，暂时化解了滞纳金危机。' }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'irs_tax_audit_crisis': {
    id: 'irs_tax_audit_crisis',
    title: '【国税局查账】收到 IRS CP2000 稽查信与 FBAR 审计',
    description: '周一信箱赫然出现一封盖着 IRS 标志的加急信！美国国税局对你过去三年的股票股票解禁、副业收入以及海外账户 (FBAR) 进行了严格查账，要求补充完整证明或缴纳补税与滞纳金。',
    choices: [
      {
        text: '聘请顶级 CPA 注册会计师与税务律师处理 (消耗 $4w 现金)',
        condition: (s) => s.cash >= 4,
        effect: (s) => ({ cash: s.cash - 4, message: '顶级 CPA 出面帮你处理了所有复杂的税务审计纠纷，彻底平息了 IRS 查账危机！' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '自己跟 IRS 沟通并补交滞纳金与罚款 (消耗 $2.5w 现金)',
        condition: (s) => s.cash >= 2.5,
        effect: (s) => ({ cash: s.cash - 2.5, health: Math.max(0, s.health - 10), message: '你在复杂的税务表格与电话排队中被折磨得头昏脑涨，最终补齐了罚款结案。' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '资金吃紧，向 IRS 申请分期付款协议 (IA Plan) 并配合补交材料 (健康 -15)',
        condition: (s) => s.cash < 2.5,
        effect: (s) => ({ health: Math.max(0, s.health - 15), message: '经过漫长的电话排队与表格递交，你成功与 IRS 达成了分期付款协议。' }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  }
};
