import type { GameEvent, GameState } from '../../types';
import { getLevelScaledTC, midYearEventRouter, h1ToH2Router, isOpportunityActiveThisYear , gameRandom } from './helpers';
import { getTCBreakdown } from '../../utils/gameStateSelectors';

export const startupEvents: Record<string, GameEvent> = {
  'startup_crisis': {
    id: 'startup_crisis',
    title: '初创危机',
    description: '你的 Startup 最近融资不太顺利，账上的钱只够发 3 个月工资了。',
    choices: [
      {
        text: '相信老板的 PPT，自愿降薪换取更多期权 (博取小概率收购变现)',
        effect: (s) => {
          const win = gameRandom() < 0.05;
          return win 
            ? { cash: s.cash + 150, message: ' 奇迹爆发！公司被大厂以数亿美元溢价收购，你的早期期权直接兑现 $150w 现金！' }
            : { cash: Math.max(0, s.cash - 5), tc: 0, health: s.health - 15, laid_off: true, job_type: 'unemployed', message: '风口过了，投资人撤资，公司倒闭，你不得不重新找工作。' };
        },
        nextEventId: (s: GameState) => (s.message || '').includes('收购') ? h1ToH2Router(s) : 'job_hunt',
      },
      {
        text: '【带资领投】自己掏 $10w 领投公司 Seed 轮自救',
        reqBadge: '现金>=10w',
        condition: (s) => s.cash >= 10,
        effect: (s) => {
          const win = gameRandom() < 0.25;
          return win
            ? { cash: s.cash + 60, tc: s.tc + 10, message: '你带资入组！公司靠你的资金撑到了 A 轮融资并估值大暴涨，你的 TC 与期权收益双双上涨！' }
            : { cash: s.cash - 10, tc: 0, laid_off: true, job_type: 'unemployed', health: s.health - 20, message: '砸进去的 $10w 没能挽救寒冬，公司还是倒闭了...你不仅没了工作还心痛不已。' };
        },
        nextEventId: (s: GameState) => s.laid_off ? 'job_hunt' : h1ToH2Router(s),
      },
      {
        text: '偷偷骑驴找马，准备跑路',
        effect: (s) => ({ health: s.health - 5, tc: 0, cash: s.cash, laid_off: true, job_type: 'unemployed', message: '你一边假装努力工作，一边偷偷刷题。不久后公司果然资金链断裂，你不得不重新找工作。' }),
        nextEventId: 'job_hunt',
      }
    ]
  },

  'founder_annual_strategy': {
    id: 'founder_annual_strategy',
    title: '【全职 Founder】公司战略与轮次推进',
    description: '作为初创公司 CEO，你手下带着团队在硅谷创业。烧钱率 (Burn Rate) 与公司生命线全掌握在你手里。请决定本年度的核心战略：',
    choices: [
      {
        text: '前往 Sand Hill Road (沙丘路) 向顶级 VC 演示 Pitch 寻求融资',
        reqBadge: '需丰富人脉或出众形象',
        condition: (s) => (s.network || 0) >= 15 || (s.charm || 0) >= 14,
        effect: (s) => {
          const stage = s.founder_stage || 'pre_seed';
          const ecoBonus = s.macro_economy === 'bull' ? 0.15 : s.macro_economy === 'bear' ? -0.20 : 0;
          const networkBonus = Math.min(0.18, ((s.network || 0) - 10) / 80);
          const charmBonus = Math.min(0.12, ((s.charm || 0) - 10) / 80);
          const baseChance = stage === 'pre_seed' ? 0.48 : stage === 'seed' ? 0.32 : 0.22;
          const successChance = Math.max(0.12, Math.min(0.75, baseChance + ecoBonus + networkBonus + charmBonus));
          const pass = gameRandom() < successChance;

          if (pass) {
            if (stage === 'pre_seed') {
              return {
                mid_year: true, season_stage: 'h1',
                founder_stage: 'seed',
                company_valuation: 600,
                cash: parseFloat((s.cash + 4).toFixed(1)),
                tc: 10,
                health: Math.max(0, s.health - 4),
                message: '【种子轮领投】凭借扎实的原型 Demo，顶级天使基金领投 $100w 支票（估值 $600w）！公司获得 18 个月跑道，创始人津贴调升至 $10w！'
              };
            } else if (stage === 'seed') {
              return {
                mid_year: true, season_stage: 'h1',
                founder_stage: 'series_a',
                company_valuation: 2200,
                cash: parseFloat((s.cash + 8).toFixed(1)),
                tc: 16,
                health: Math.max(0, s.health - 6),
                message: '【突破 A 轮死亡谷】经过残酷的 Series A 筛选，一线 VC 领投 $350w（估值 $2200w）！公司完成 PMF 突破，创始人津贴提升至 $16w！'
              };
            } else {
              return {
                mid_year: true, season_stage: 'h1',
                founder_stage: 'exit',
                company_valuation: 7500,
                cash: parseFloat((s.cash + 18).toFixed(1)),
                tc: 24,
                health: Math.max(0, s.health - 8),
                message: '【B 轮超级融资】红杉与 A16Z 联合领投，公司估值冲上 $7500w 美元！ARR 突破 $800w，准独角兽地位确立！'
              };
            }
          } else {
            const isDownRound = gameRandom() < 0.35;
            if (isDownRound) {
              return {
                mid_year: true, season_stage: 'h1',
                cash: Math.max(0, parseFloat((s.cash - 2).toFixed(1))),
                company_valuation: Math.max(100, (s.company_valuation || 180) - 100),
                health: Math.max(0, s.health - 12),
                message: '【估值倒挂 (Down Round)】资本寒冬下 VC 极度挑剔，只肯给折价过桥贷款，严苛的对赌协议让你彻夜难眠。'
              };
            } else {
              return {
                mid_year: true, season_stage: 'h1',
                cash: Math.max(0, parseFloat((s.cash - 1).toFixed(1))),
                health: Math.max(0, s.health - 8),
                message: '【融资遇冷】沙丘路跑了 20 家 VC 均表示“赛道拥挤、继续观察”，未能发出 Term Sheet。公司只能继续靠现有资金死撑。'
              };
            }
          }
        },
        nextEventId: h1ToH2Router,
      },
      {
        text: '【死磕产品 PMF 与企业大单】带领全员冲刺 ARR 经常性收入并拿下企业采购',
        condition: (s) => s.job_type === 'startup_founder',
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
        text: '【TechCrunch 巅峰演讲与病毒式公关】登上顶级科技峰会做 Live Demo 引爆全球热度',
        condition: (s) => s.job_type === 'startup_founder',
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
        text: '【高举高打招聘】重金从 Meta/Google 挖掘架构师补齐工程团队 (需现金>=8w)',
        reqBadge: '现金>=8w',
        condition: (s) => s.cash >= 8,
        effect: (s) => {
          const success = gameRandom() < 0.65;
          if (success) {
            return {
              mid_year: true, season_stage: 'h1',
              cash: parseFloat((s.cash - 8).toFixed(1)),
              company_valuation: (s.company_valuation || 180) + 300,
              leetcode: Math.min(100, s.leetcode + 6),
              message: '【核心架构师加盟】大厂 Senior 大牛加盟后研发出高效的 AI 底层服务，产品交付速度明显提升！'
            };
          } else {
            return {
              mid_year: true, season_stage: 'h1',
              cash: parseFloat((s.cash - 8).toFixed(1)),
              company_valuation: (s.company_valuation || 180) + 100,
              health: Math.max(0, s.health - 8),
              message: '【团队磨合阵痛】空降大牛与早期极客团队理念冲突，消耗了大笔安家费预算，公司估值增长有限。'
            };
          }
        },
        nextEventId: h1ToH2Router,
      },
      {
        text: '【终局 Exit】考虑公司并购 Acqui-hire 或准备 纳斯达克 IPO 敲钟上市 (需估值>=3000w)',
        condition: (s) => (s.company_valuation || 0) >= 3000,
        effect: (s) => {
          const val = s.company_valuation || 3000;
          const isHuge = val >= 6000;
          const roll = gameRandom();
          if (isHuge && roll < 0.40) {
            // 40% IPO Win
            return {
              status: 'win',
              cash: parseFloat((s.cash + 350).toFixed(1)),
              message: '【纳斯达克敲钟！】公司成功在纳斯达克挂牌敲钟！扣除 VC 稀释后创始人股权套现 $350w 美元，圆满达成 FIRE 终局！'
            };
          } else if (roll < 0.80) {
            // Acqui-hire (Safe landing with solid cash & Staff position)
            return {
              cash: parseFloat((s.cash + 90).toFixed(1)),
              job_type: 'big_tech',
              level: 'L6 (Staff)',
              company: 'google',
              tc: 52,
              laid_off: false,
              founder_stage: undefined,
              company_valuation: 0,
              health: Math.max(0, s.health - 4),
              message: '【成功被巨头并购】Google/Meta 科技巨头以溢价并购了你们的公司。扣除 VC 清算优先权后，创始人获得 $90w 现金分成，并受聘为大厂 L6 Staff 架构师！'
            };
          } else {
            // Fire Sale
            return {
              cash: parseFloat((s.cash + 15).toFixed(1)),
              job_type: 'unemployed',
              company: undefined,
              level: undefined,
              laid_off: true,
              founder_stage: undefined,
              company_valuation: 0,
              tc: 0,
              health: Math.max(0, s.health - 12),
              network: (s.network || 0) + 6,
              message: '【折价清算】市场行情急转直下，公司被折价清盘。VC 拿走清算优先权后，你仅分得 $15w 离场费。创业虽败，但你积累了宝贵的人脉！'
            };
          }
        },
        nextEventId: (s) => s.status === 'win' ? 'end' : (s.laid_off ? 'job_hunt' : h1ToH2Router(s)),
      },
      {
        text: '【精简开支苟活】裁撤非核心人员，收缩战线，努力过冬 (无条件)',
        effect: (s) => ({
          mid_year: true, season_stage: 'h1',
          cash: Math.max(0, parseFloat((s.cash - 1).toFixed(1))),
          company_valuation: Math.max(80, (s.company_valuation || 180) - 80),
          health: Math.max(0, s.health - 8),
          message: '资金与资源有限，你决定开源节流，挥泪解雇了一批兼职与非核心人员，收缩战线艰难过冬。'
        }),
        nextEventId: h1ToH2Router,
      }
    ]
  },

  'ai_research_crisis': {
    id: 'ai_research_crisis',
    title: 'AGI 的脚步',
    description: '最近 OpenAI 又发了新模型，你在实验室里的项目面临被降维打击的危险。',
    choices: [
      {
        text: '抢占先机，连夜写 Paper 冲击顶会！',
        effect: (s) => {
          const win = gameRandom() < (0.55 + s.leetcode / 300);
          return win 
            ? { tc: s.tc + 5, cash: s.cash + 30, stocks: (s.stocks || 0) + 20, visa: (s.visa === '绿卡' || s.visa === '公民') ? s.visa : 'O1 (杰出人才)', charm: Math.min(25, (s.charm || 10) + 4), health: s.health - 20, message: ' 论文斩获 NeurIPS Best Paper！你提出的推理大模型架构震惊学术界与工业界！公司立刻发了 $30w Retention Bonus、加配了 $20w 核心股票，并协助加急批复了 O1 签证！' }
            : { health: s.health - 25, cash: s.cash, message: '熬了半个月，结果撞车了别人的工作被直接 Reject，心态炸裂。' };
        },
        nextEventId: h1ToH2Router,
      },
      {
        text: '佛系跟进，不争不抢',
        effect: (s) => ({ health: s.health + 10, cash: s.cash, message: '反正公司也不差你这一个项目，你按时下班，每天看着同事们卷生卷死。' }),
        nextEventId: h1ToH2Router,
      }
    ]
  },

  'founder_co_founder_drama': {
    id: 'founder_co_founder_drama',
    title: '【创始人危机】CTO 合伙人股权纷争与离职摊牌',
    description: '创业初期和你一起在车库吃泡面的联合创始人兼 CTO 突然在周一早会摊牌：要求重签协议将股权提升至 50%，否则就带走核心模型架构去投奔竞对。',
    choices: [
      {
        text: '依法办事：依据最初签署的 4 年 Vesting 协议回购未行权股份，强硬止损',
        effect: (s) => ({
          health: Math.max(0, s.health - 10),
          company_valuation: Math.max(100, (s.company_valuation || 180) - 60),
          leetcode: Math.min(100, s.leetcode + 4),
          message: '【强硬换帅】你依照法律条款回购了对方股份。短期内虽经历代码交接阵痛，但成功捍卫了公司股权结构与治理底线！'
        }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '协商妥协：释放 5% 股权池与晋升薪酬，维持技术架构稳定推进',
        effect: (s) => ({
          health: Math.max(0, s.health - 6),
          cash: Math.max(0, parseFloat((s.cash - 1).toFixed(1))),
          network: Math.min(100, (s.network || 0) + 2),
          message: '【务实维稳】你通过让渡少量期权池与奖金抚平了矛盾，CTO 同意留任继续攻坚核心大模型版本。'
        }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '引入沙丘路 VC 投资人做仲裁调解，以专业治理架构稳定董事会',
        condition: (s) => Boolean(s.founder_stage === 'seed' || s.founder_stage === 'series_a' || s.founder_stage === 'series_b' || s.founder_stage === 'exit'),
        hideIfUnavailable: true,
        effect: (s) => ({
          network: Math.min(100, (s.network || 0) + 4),
          charm: Math.min(25, (s.charm || 10) + 2),
          company_valuation: (s.company_valuation || 180) + 80,
          message: '【VC 出面平息】沙丘路领投合伙人亲自出面做利益平衡与期权重组，公司治理结构走向规范化！'
        }),
        nextEventId: 'sv_year_end_settlement',
      }
    ]
  },

  'founder_vc_term_sheet_ghost': {
    id: 'founder_vc_term_sheet_ghost',
    title: '【沙丘路惊魂】周日晚 11 点 VC 撤回 Term Sheet',
    description: '沙丘路一线 VC 合伙人口头承诺领投下轮融资后，却在正式签署前夕的周日深夜发来邮件表示“投委会因宏观不确定性决定暂缓”，单方面反悔撤回。',
    choices: [
      {
        text: '连夜启动备选应急预案，向 Stanford 校友网络与天使投资人路演求助',
        effect: (s) => {
          const win = gameRandom() < 0.60;
          return win
            ? {
                cash: parseFloat((s.cash + 2).toFixed(1)),
                network: Math.min(100, (s.network || 0) + 3),
                company_valuation: (s.company_valuation || 180) + 120,
                message: '【绝地反击】斯坦福校友天使基金在 48 小时内火速过桥领投，不仅填补了缺口，还带来了顶级企业资源！'
              }
            : {
                health: Math.max(0, s.health - 12),
                cash: Math.max(0, parseFloat((s.cash - 1).toFixed(1))),
                message: '【四处碰壁】沙丘路其他机构听闻领投方撤回后纷纷观望，公司不得不进入极其严苛的紧缩状态。'
              };
        },
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '直接杀到 Sand Hill Road 咖啡馆堵门当面 Re-pitch，力挽狂澜',
        condition: (s) => (s.charm || 0) >= 14,
        hideIfUnavailable: true,
        effect: (s) => ({
          charm: Math.min(25, (s.charm || 10) + 3),
          health: Math.max(0, s.health - 6),
          company_valuation: (s.company_valuation || 180) + 150,
          message: '【强大的 Founder 气场】你在咖啡馆用极具感染力的 Demo 与最新 ARR 增长数据彻底打消了合伙人的顾虑，促成对方重新盖章签字！'
        }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '断臂求生：立刻收紧每月烧钱率，全员降薪延缓 Runway',
        effect: (s) => ({
          health: Math.max(0, s.health - 8),
          cash: Math.max(0, parseFloat((s.cash - 0.5).toFixed(1))),
          message: '【开源节流】你挥泪推迟了招聘计划并砍掉非必要云服务，成功将公司生命线延长了 6 个月。'
        }),
        nextEventId: 'sv_year_end_settlement',
      }
    ]
  },

  'founder_runway_cash_crunch': {
    id: 'founder_runway_cash_crunch',
    title: '【算力账单危机】Mercury 银行账户只剩 2 个月生命线',
    description: '随着 AI 算力与 GPU 训练开销激增，公司 Mercury 银行账户里的资金仅够支撑 60 天了。如果无法及时止血，公司将面临断粮关停。',
    choices: [
      {
        text: '创始人自掏腰包垫资 $4w，全力扛到下半年企业客户续约 (需现金>=4w)',
        reqBadge: '需现金>=4w',
        condition: (s) => s.cash >= 4,
        effect: (s) => ({
          cash: parseFloat((s.cash - 4).toFixed(1)),
          company_valuation: (s.company_valuation || 180) + 150,
          health: Math.max(0, s.health - 8),
          message: '【创始人担当】你垫付的资金撑过了最艰难的两个月，随后几笔大型企业采购款顺利到账，公司转危为安！'
        }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '申请云厂商（AWS/Azure/GCP）创业加速算力额度抵扣，死里逃生',
        effect: (s) => ({
          health: Math.min(100, s.health + 4),
          company_valuation: (s.company_valuation || 180) + 80,
          message: '【拿下十万美元算力 Grant】你的技术架构打动了云厂商评委会，成功斩获 $100,000 免费算力额度，瞬间解除了资金危机！'
        }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '带领全员极速交付 MVP 商业化功能，以预付订金补充现金流',
        effect: (s) => ({
          health: Math.max(0, s.health - 10),
          cash: parseFloat((s.cash + 2.5).toFixed(1)),
          company_valuation: (s.company_valuation || 180) + 100,
          message: '【自造血成功】连续两周高强度上线付费功能，吸引了数百名付费企业客户，实现了正向现金流！'
        }),
        nextEventId: 'sv_year_end_settlement',
      }
    ]
  },

  'founder_hacker_house_hackathon': {
    id: 'founder_hacker_house_hackathon',
    title: '【旧金山黑客松】Hayes Valley 48小时 Red Bull 通宵攻坚',
    description: '旧金山 Hayes Valley / SOMA 的极客 Hacker House 正在举办周末 48 小时 AI Agent 黑客松，满屋子都是喝着 Red Bull 狂敲代码的狂热 Founder 与工程师。',
    choices: [
      {
        text: '带领团队通宵打磨杀手级 Feature，斩获全场冠军 Demo',
        effect: (s) => ({
          health: Math.max(0, s.health - 6),
          leetcode: Math.min(100, s.leetcode + 5),
          company_valuation: (s.company_valuation || 180) + 120,
          message: '【黑客松夺冠】你们的 Live Demo 惊艳全场夺得第一！Product Hunt 首页推荐，收获了数千名早期极客种子用户！'
        }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '在黑客松现场疯狂 Networking，结识顶级天使投资人与硬核天才',
        effect: (s) => ({
          network: Math.min(100, (s.network || 0) + 4),
          charm: Math.min(25, (s.charm || 10) + 2),
          message: '【人脉大丰收】在酒会与披萨台前认识了数位 Sandbox 与 YC 背景的顶尖极客，为下一轮招聘打下了坚实基础。'
        }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '佛系参赛：蹭免费披萨、精酿啤酒与 $10,000 云算力代金券',
        effect: (s) => ({
          health: Math.min(100, s.health + 8),
          message: '【白嫖算力与放松】没有参赛心理负担，白嫖了满满一袋纪念品与云服务算力 Credits，身心舒畅。'
        }),
        nextEventId: 'sv_year_end_settlement',
      }
    ]
  }
};
