import type { GameEvent, GameState } from '../../types';
import { getLevelScaledTC, midYearEventRouter, h1ToH2Router, afterCareerAction, isOpportunityActiveThisYear, gameRandom, deductAssets } from './helpers';
import { getTCBreakdown } from '../../utils/gameStateSelectors';
import { isOwnedHousing, HOUSING_NAMES } from '../../constants/gameConstants';

// 置业/换租是资产配置操作,不该吞掉当年的职场主行动 (#2)。完成后回到玩家对应的年度面板
// (founder/trader 回各自策略枢纽, 其余回 sv_daily_life),让玩家当年仍可选择工作重心;
// 配合 sv_daily_life 里 last_housing_action_year 的每年一次门禁, 避免同年重复进入形成循环。
const returnToAnnualPanel = (s: GameState): string =>
  s.job_type === 'startup_founder' ? 'founder_annual_strategy'
    : s.job_type === 'trader' ? 'trader_annual_strategy'
    : 'sv_daily_life';

export const housingFinanceEvents: Record<string, GameEvent> = {
  'choose_housing': {
    id: 'choose_housing',
    title: '【租房抉择】湾区安身立命之所',
    description: '恭喜你拿到 Offer 开启职场生涯！现在你需要在湾区租房。房租会作为你每年的固定开销。',
    choices: [
      {
        text: '【整租豪华 1B1B】泳池健身房全配，独立私密品质生活 (年租金 $4w)',
        effect: (s) => ({ rent: 4, charm: s.charm + 1, health: s.health + 10, has_housing: true, housing_name: HOUSING_NAMES.SAN_JOSE_LUXURY,         message: '你租下了带泳池的高级公寓，生活质量极高，相亲市场竞争力上升。' }),
        nextEventId: (s) => afterCareerAction(s)
      },
      {
        text: '【合租南湾 2B2B】与室友分摊开销，性价比之选 (年租金 $2w)',
        effect: (s) => ({ rent: 2, has_housing: true, housing_name: HOUSING_NAMES.CUPERTINO_SHARED, message: '你和朋友合租，偶尔会因为抢厕所和洗碗吵架，但省下了不少钱。' }),
        nextEventId: (s) => afterCareerAction(s)
      },
      {
        text: '【挂壁客厅隔间】极致压低开销狂攒首付，终极省钱 (年租金 $1w)',
        effect: (s) => ({ rent: 1, charm: s.charm - 2, health: s.health - 15, has_housing: true, housing_name: HOUSING_NAMES.LIVING_ROOM_SCREEN, message: '你睡在客厅，用帘子隔开。每天被室友做饭吵醒，毫无隐私，连相亲都不敢带人回家。' }),
        nextEventId: (s) => afterCareerAction(s)
      }
    ]
  },

  'change_rental': {
    id: 'change_rental',
    title: '【换房搬家】重新挑选湾区租房',
    description: '身价与年薪变了，是时候调整你的固定住房开支与居住体验了。',
    choices: [
      {
        text: '【升级豪华 1B1B】泳池健身房与全职门卫，提振社交生活 (年租金 $4w)',
        condition: (s) => s.cash >= 4 || s.tc >= 18,
        effect: (s) => ({ rent: 4, charm: Math.min(s.max_charm ?? 25, s.charm + 3), health: Math.min(100, s.health + 15), housing_name: HOUSING_NAMES.SAN_JOSE_LUXURY, last_housing_action_year: s.year, message: '你搬进了带无边泳池的高级公寓！生活质量飙升！' }),
        nextEventId: returnToAnnualPanel
      },
      {
        text: '【合租标准 2B2B】性价比极高的湾区中产标准 (年租金 $2w)',
        effect: (s) => ({ rent: 2, housing_name: HOUSING_NAMES.CUPERTINO_SHARED, last_housing_action_year: s.year, message: '你搬进了 Cupertino 经典的双主卧合租公寓，省钱又方便。' }),
        nextEventId: returnToAnnualPanel
      },
      {
        text: '【降级挂壁客厅隔间】极致压低开销狂攒首付/防破产 (年租金 $1w)',
        effect: (s) => ({ rent: 1, charm: Math.max(0, s.charm - 2), health: Math.max(0, s.health - 10), housing_name: HOUSING_NAMES.LIVING_ROOM_SCREEN, last_housing_action_year: s.year, message: '你搬回了客厅屏风隔间，将每年固定的房租开销砍到了极致。' }),
        nextEventId: returnToAnnualPanel
      },
      {
        text: '【终极挂壁睡车顶】连夜退租！搬进特斯拉/露营车里睡车顶 (房租归零 $0/年)',
        condition: (s) => !!(s.car && s.car !== 'none'),
        effect: (s) => ({ rent: 0, housing_name: HOUSING_NAMES.TESLA_ROOF, health: Math.max(0, s.health - 15), last_housing_action_year: s.year, message: '你把睡袋卡式炉扔进车后备箱，正式开启硬核湾区车顶睡袋生活！房租彻底归零！' }),
        nextEventId: returnToAnnualPanel
      },
      {
        text: '【我是学生，可以少算点吗？】向华人房东亮出学生身份/扮嫩砍价',
        condition: (s) => (s.rent || 0) > 0,
        effect: (s) => {
          const isStudent = s.visa === 'F1 (学生)' || s.visa === 'Day 1 CPT' || !s.job_type || s.job_type === 'unemployed';
          if (isStudent) {
            const newRent = Math.max(0.5, parseFloat(((s.rent || 2) - 0.3).toFixed(1)));
            return {
              rent: newRent,
              cash: s.cash + 0.3,
              charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 2),
              last_housing_action_year: s.year,
              message: '【留学生专属同情】房东叹了口气：“看在当年我也是留学生熬过来的份上，今年每月给你免 $200 房租！” 经典学生砍价大获全胜！',
            };
          }
          return {
            charm: Math.max(0, (s.charm || 10) - 3),
            network: Math.max(0, (s.network || 10) - 3),
            health: Math.max(0, s.health - 2),
            last_housing_action_year: s.year,
            message: '【社会性死亡】年薪数十万的大厂工程师冒充“我是学生”疯狂砍价 $50 块，被房东截图发到了小红书《湾区极品抠门房客大赏》，全网群嘲！',
          };
        },
        nextEventId: returnToAnnualPanel
      },
      {
        text: '【维持现状不搬家】目前的房子住得挺好，暂不搬家',
        effect: (s) => ({ last_housing_action_year: s.year, message: '你打消了搬家念头。' }),
        nextEventId: returnToAnnualPanel
      }
    ]
  },

  'buy_house': {
    id: 'buy_house',
    title: '【抢房大战】宇宙中心加价抢房大乱斗',
    description: '湾区房地产 Open House 现场挤满了手里攥着支票簿的华裔和印度裔工程总监。中介微笑着告诉你：“已经收到了 14 个 No-Contingency 全现金 Offer，你准备加价多少？”',
    imageUrl: 'images/house.jpg',
    choices: [
      {
        text: '【抢 Sunnyvale 单层老破小】首付 $45w 拿下 Sunnyvale 做题家神房 (年供地税低)',
        costBadge: '首付 $45w',
        condition: (s) => (s.cash + (s.stocks || 0)) >= 45,
        effect: (s) => ({ ...deductAssets(s, 45), rent: 1.5, has_housing: true, housing_name: HOUSING_NAMES.SUNNYVALE, health: s.health + 10, last_housing_action_year: s.year, imageUrl: 'images/house.jpg', message: '虽说是 1974 年木板老破小且地板走起来吱吱响，但地大 7500 尺能开辟菜园种葱，去 Apple Park 和 Googleplex 只要 12 分钟！做题家终极神房落地！' }),
        nextEventId: returnToAnnualPanel,
      },
      {
        text: '【买 North San Jose 现代美宅】首付 $40w 买下现代挑高 Townhouse (颜值极高)',
        costBadge: '首付 $40w',
        condition: (s) => (s.cash + (s.stocks || 0)) >= 40,
        effect: (s) => ({ ...deductAssets(s, 40), rent: 2.5, has_housing: true, housing_name: HOUSING_NAMES.NORTH_SAN_JOSE, charm: Math.min(s.max_charm ?? 25, s.charm + 5), last_housing_action_year: s.year, message: '全套智能家电、石英石大理石中岛！虽然贴着 neighbor 抽油烟机且每月要上缴 $550 恶心 HOA 费，但每天拍 home decor 发小红书点赞爆表！' }),
        nextEventId: returnToAnnualPanel,
      },
      {
        text: '【攻下 Fremont 顶配学区房】首付 $65w 拿下 Mission San Jose 9分学区房 (卷娃终极战场)',
        costBadge: '首付 $65w',
        condition: (s) => (s.cash + (s.stocks || 0)) >= 65,
        effect: (s) => ({ ...deductAssets(s, 65), rent: 4.5, has_housing: true, housing_name: HOUSING_NAMES.FREMONT, charm: Math.min(s.max_charm ?? 25, s.charm + 4), luck: s.luck + 10, last_housing_action_year: s.year, message: '为了娃彻底豁出去了！隔壁邻居全是高强度卷 AMC10 和卡内基梅隆机器人夏令营的硅谷老爹，社区图书馆周末全是解题小孩，神教合一！' }),
        nextEventId: returnToAnnualPanel,
      },
      {
        text: '【父母紧急开支票】向国内父母紧急开支票（掏空六个钱包跨国电汇凑齐首付）',
        costBadge: '自付 $3w (父母资助)',
        reqBadge: '需现金 < $40w 且未曾受助',
        // Available when your own CASH can't cover a down payment (buy_house is only entered
        // with total assets >= 40, so the old `cash+stocks < 40` was unsatisfiable → this
        // choice and the whole house_slave storyline were dead/unreachable). Now it's the
        // "ask parents instead of liquidating your stocks" alternative.
        condition: (s) => s.cash < 40 && !s.parents_helped_house,
        // Player chips in a small fixed contribution; parents cover the rest (was
        // cash:0, which discarded up to ~$40w of the player's existing savings).
        effect: (s) => ({ cash: Math.max(0, s.cash - 3), has_housing: true, housing_name: HOUSING_NAMES.SUNNYVALE, health: s.health - 15, parents_helped_house: true, message: '父母卖掉了国内老家二线城市的房子跨国电汇给你凑齐了 Sunnyvale 首付，你背上了深沉的愧疚包袱与巨额房贷。' }),
        nextEventId: 'house_slave',
      },
      {
        text: '【观望行情继续攒钱】资金暂时不足或观望行情，先返回日常行动攒钱',
        effect: (s) => ({ last_housing_action_year: s.year, message: '你看了一眼加价疯狂且竞争白热化的湾区房市，决定等现金流更充裕时再做打算。' }),
        nextEventId: returnToAnnualPanel,
      },
    ]
  },

  'house_slave': {
    id: 'house_slave',
    title: '【房贷重压】沉重的百万房贷生活',
    description: '通过父母举债六个钱包交齐首付买下 Sunnyvale 老破小后，每年固定房屋供税支出让手头极度紧绷。你决定怎么应对接下来的挑战？',
    choices: [
      {
        text: '【老实打工扛住房贷】老老实实上班，咬牙扛住房贷月供',
        effect: (s) => ({ rent: 2.2, has_housing: true, housing_name: HOUSING_NAMES.SUNNYVALE, health: Math.max(0, s.health - 5), message: '你把心安在了加州木板老破小里，虽然房贷沉重，但每次看到属于自己的草坪，干劲又回来了！' }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【次卧车库出租回血】把次卧与车库出租给留学生 (每年回血 $1.5w 现金流)',
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
        text: '【断供卖房回归自由】断供卖房止损，回归租房生活的自由',
        condition: (s) => s.cash < 50,
        // Foreclosure recovers real buyer equity only — nothing if parents funded it
        // (closes the parents-buy → default-sell free-cash exploit). Also stop the
        // phantom ADU rent: clear has_adu_rented and remove the ADU income portion.
        effect: (s) => ({ cash: s.cash + (s.parents_helped_house ? 0 : 35), has_housing: false, housing_name: HOUSING_NAMES.NORMAL_SHARED, rent: 2, has_adu_rented: false, rental_income: s.has_adu_rented ? Math.max(0, (s.rental_income || 0) - 1.5) : (s.rental_income || 0), health: s.health + 10, message: '你最终无力支付房贷被迫断供卖房。虽亏掉了前期本金，但你卸下了深沉包袱，重新拿回流动资金回到出租屋。' }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【卖房投身创业浪潮】感觉人生一眼望到头，卖房去创业！',
        reqBadge: '需总资产 >= $100w',
        condition: (s) => (s.cash + (s.stocks || 0)) >= 100 && s.job_type !== 'startup_founder',
        // Selling ADDS home equity (was subtracting $50w while keeping the house).
        // Actually liquidate the home and start the FOUNDER path (not the employee event).
        effect: (s) => ({ cash: s.cash + (s.parents_helped_house ? 0 : 35), has_housing: false, housing_name: HOUSING_NAMES.NORMAL_SHARED, rent: 2, has_adu_rented: false, rental_income: s.has_adu_rented ? Math.max(0, (s.rental_income || 0) - 1.5) : (s.rental_income || 0), job_type: 'startup_founder', founder_stage: 'pre_seed', company_valuation: 180, tc: 6, level: undefined, company: undefined, message: '你受够了温水煮青蛙，卖了房子套现，拿着这笔启动资金投身创业大潮，成为了一名硅谷 Founder！' }),
        nextEventId: 'founder_annual_strategy',
      }
    ]
  },

  'manage_rental_properties': {
    id: 'manage_rental_properties',
    title: '【房产帝国】投资房资产管理中心',
    description: '在硅谷与全美优质学区配置投资性不动产，打造无惧科技裁员周期的终极被动现金流（Passive Rental Income）！',
    imageUrl: 'images/house.jpg',
    choices: [
      {
        text: '【自住房改造】搭建后院 ADU 独立套间并出租 (建造 $12w · 产生 +$1.2w/年 租金净流)',
        costBadge: '建造 $12w',
        condition: (s) => s.has_housing && !s.has_adu_rented && (s.cash + (s.stocks || 0)) >= 12 && isOwnedHousing(s.housing_name),
        effect: (s) => ({
          ...deductAssets(s, 12),
          has_adu_rented: true,
          rental_income: (s.rental_income || 0) + 1.2,
          message: '【ADU 改造完成】你砸下 $12w 在后院建起一套带独立卫浴的预制 ADU（含设计、许可与施工），挂在 Zillow 上第一天就被隔壁大厂实习生秒签！每年稳定产生 +$1.2w 净租金流！'
        }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【外州远程投资】购入 Austin/Seattle 精装独栋别墅 (首付 $25w · 产生 +$1.2w/年 租金净流)',
        costBadge: '首付 $25w',
        condition: (s) => (s.cash + (s.stocks || 0)) >= 25 && !(s.investment_properties || []).includes('Austin 远程独栋屋'),
        effect: (s) => ({
          ...deductAssets(s, 25),
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
          ...deductAssets(s, 45),
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
          ...deductAssets(s, 120),
          rental_income: (s.rental_income || 0) + 6.0,
          investment_properties: [...(s.investment_properties || []), HOUSING_NAMES.SUNNYVALE_4PLEX],
          charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 5),
          message: '【加州大地主登顶】你拿下了 Sunnyvale 黄金地段 4 套相连的公寓楼！光靠收租每年就能躺赚 +$6.0w 净现金流，彻底告别打工内卷！'
        }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【返回日常行动面板】暂不进行房产管理，返回日常行动',
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
        text: '【庭院天幕 BBQ 聚会】邀请同事邻居来庭院天幕 BBQ 派对 (消耗 $0.3w)',
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
        text: '【小红书发买房心得】拍摄全套精致软装，分享“湾区首套房心得”',
        effect: (s) => ({
          charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 5),
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
        text: '【领投独角兽种子轮】出资 $20w 成为 AI 独角兽 Seed 轮天使投资人 (高风险)',
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
        text: '【品尝红酒观望不投】观望不投，只在私宴上品尝顶级红酒拓展人脉',
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
        // Gated on affordability (cash+stocks) so the middleware can auto-liquidate stocks;
        // a broke homeowner takes the finance option below instead of being force-bankrupted.
        condition: (s) => (s.cash + (s.stocks || 0)) >= 3.5,
        effect: (s) => ({
          cash: s.cash - 3.5,
          health: s.health + 5,
          message: '你痛心地划走了 3.5 万美金！但修缮后的房子在 Zillow 上的估值立刻大涨，房屋安全性大增。'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【加入 HOA 业委会抗争】在社区业主大会上与 HOA 主席展开大战',
        // Actually charge the reduced $1.5w assessment the message states (was $0 —
        // the stated cost was silently omitted, making this a near-free option).
        condition: (s) => (s.cash + (s.stocks || 0)) >= 1.5,
        effect: (s) => ({
          cash: s.cash - 1.5,
          charm: Math.min(s.max_charm ?? 25, s.charm + 3),
          health: Math.max(0, s.health - 15),
          message: '你在邻居群里化身意见领袖，成功把摊派金额砍到了 $1.5w！虽然省了一大笔，但整整三个星期都在和业委会扯皮，身心俱疲。'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        // Always-available safe branch so a cash-poor / no-stocks homeowner is never
        // force-bankrupted by the lump-sum assessment — finance it into the yearly carry.
        text: '【申请 HOA 分期融资】把摊派金额分摊进未来几年物业月供 (无需一次性掏现金)',
        effect: (s) => ({
          rent: s.rent + 0.4,
          health: Math.max(0, s.health - 5),
          message: '你申请把这笔专项摊派分期融资进未来几年的物业持有成本，避免了一次性掏空现金，但每年的房屋固定支出略微上升。'
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
        text: '【全额缴纳补充房产税】咬牙全额缴纳补充房产税账单 (消耗 $3w)',
        costBadge: '花费 $3w',
        condition: (s) => (s.cash + (s.stocks || 0)) >= 3,
        effect: (s) => ({ cash: s.cash - 3, health: s.health - 5, message: '你一次性补齐了 $3w 房产税账单，虽然心痛不已，但保住了房产产权。' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【聘请律师申诉减税】聘请 Property Tax Appeal 律师写申诉辩护书',
        costBadge: '花费 $1w · 败诉共 $4w',
        reqBadge: '需总资产 >= $4w',
        // Gate on the WORST case ($3w tax + $1w lawyer), not just the $1w retainer: this was
        // gated at >= 1, so a homeowner with $1–4w who lost the appeal went straight to
        // bankruptcy game-over. (>= 3 keeps the full-pay option, < 3 keeps the deferral
        // option, so raising this leaves no asset band without a choice.)
        condition: (s) => (s.cash + (s.stocks || 0)) >= 4,
        effect: (s) => {
          const win = gameRandom() < 0.5;
          return win
            ? { cash: s.cash - 1, charm: Math.min(s.max_charm ?? 25, s.charm + 2), message: '律师出面成功证明了评估值虚高，帮为你减免了绝大部分额外房产税！胜诉！' }
            : { cash: s.cash - 4, health: s.health - 10, message: '申诉失败，你不仅补缴了 $3w 房产税，还倒贴了 $1w 律师费！痛苦加倍。' };
        },
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【申请税款分期还款】向县政府申请税款延期与分期还款协议 (健康 -10)',
        // Safe deferral covers everyone who can't full-pay from assets (<3)
        condition: (s) => (s.cash + (s.stocks || 0)) < 3,
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
        text: '【聘请顶级 CPA 律师】聘请顶级 CPA 注册会计师与税务律师处理 (消耗 $4w)',
        costBadge: '花费 $4w',
        condition: (s) => (s.cash + (s.stocks || 0)) >= 4,
        effect: (s) => ({ cash: s.cash - 4, message: '顶级 CPA 出面帮你处理了所有复杂的税务审计纠纷，彻底平息了 IRS 查账危机！' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【自行沟通补缴罚款】自己跟 IRS 沟通并补交滞纳金与罚款 (消耗 $2.5w)',
        costBadge: '花费 $2.5w',
        condition: (s) => (s.cash + (s.stocks || 0)) >= 2.5,
        effect: (s) => ({ cash: s.cash - 2.5, health: Math.max(0, s.health - 10), message: '你在复杂的税务表格与电话排队中被折磨得头昏脑涨，最终补齐了罚款结案。' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【申请 IRS 分期协议】向 IRS 申请分期付款协议并补交材料 (健康 -15)',
        condition: (s) => (s.cash + (s.stocks || 0)) < 2.5,
        effect: (s) => ({ health: Math.max(0, s.health - 15), message: '经过漫长的电话排队与表格递交，你成功与 IRS 达成了分期付款协议。' }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'mortgage_default_crisis': {
    id: 'mortgage_default_crisis',
    title: '【断供危机】高昂房贷与银行催款函',
    description: '失业加上每月高额的房贷月供与地税，你的流动现金与股票账户已跌破警戒线。银行房贷部门发来严正催款通知：“若连续 3 个月未按时还款，将启动房屋法拍 (Foreclosure) 程序。”',
    oncePerLife: true,
    choices: [
      {
        text: '【紧急 Short Sale 降价卖房】止损割肉，保住剩余本金退回租房',
        // Recover buyer equity only — nothing if parents funded the house (same guard as the
        // house_slave 断供 branch; closes the parents-buy → default-sell free-cash exploit).
        effect: (s) => ({
          has_housing: false,
          housing_name: HOUSING_NAMES.NORMAL_SHARED,
          rent: 2.0,
          cash: s.cash + (s.parents_helped_house ? 0 : 25),
          health: Math.min(100, s.health + 8),
          message: s.parents_helped_house
            ? '你以市价 85 折挂牌急售。房子当年是父母全款买的、你并无本金投入，割肉后仅卸下沉重房贷包袱退回租房。'
            : '你果断以市价 85 折挂牌急售。虽然亏掉了部分前期本金，但成功拿回 $25w 宝贵流动资金，卸下了沉重的房贷包袱！',
        }),
        nextEventId: returnToAnnualPanel,
      },
      {
        text: '【向银行申请延期还款 (Forbearance)】苦苦哀求争取半年喘息期',
        effect: (s) => ({
          health: Math.max(0, s.health - 10),
          charm: Math.max(0, (s.charm || 10) - 2),
          message: '经过漫长的材料提交与跨洋沟通，银行同意为你延期还款半年，但高额利息将计入本金，催款压力依旧如影随形。',
        }),
        nextEventId: returnToAnnualPanel,
      },
      {
        text: '【加建/爆改主卧出租】自己搬去车库住，把大主卧挂牌给实习生',
        condition: (s) => !s.has_adu_rented,
        effect: (s) => ({
          has_adu_rented: true,
          rental_income: (s.rental_income || 0) + 1.5,
          health: Math.max(0, s.health - 8),
          message: '你把自己的主卧和次卧全部挂在小红书招租，自己带着行军床搬进了车库。每月多收租金，硬生生把房贷窟窿给补上了！',
        }),
        nextEventId: returnToAnnualPanel,
      },
    ],
  },
};
