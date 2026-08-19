import type { GameEvent, GameState } from '../../types';
import { getLevelScaledTC, gameRandom } from './helpers';
import { HOUSING_NAMES } from '../../constants/gameConstants';

export const lifestyleEvents: Record<string, GameEvent> = {
  'dating_market': {
    id: 'dating_market',
    title: '湾区婚恋交友 (CMB & 情感发展)',
    description: '湾区高压生活下，你打开了 Coffee Meets Bagel (CMB) 与朋友圈，开启属于你的情感阶段探索。',
    imageUrl: 'images/boba_date.jpg',
    choices: [
      {
        text: '【高端局】参加南湾高阶桌游与剧本杀局',
        reqBadge: '需 算法能力',
        condition: (s) => (!s.relationship_status || s.relationship_status === 'single') && s.leetcode >= 40,
        effect: (s) => ({ relationship_status: 'matched', partner_type: 'engineer', message: '【匹配成功】在激烈的狼人杀中，你敏锐的逻辑吸引了同为大厂码农的 TA。双方互加微信，进入 Matched 状态！' }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【看展看演出】去 SF MOMA 看展或看独立乐队演出',
        reqBadge: '需 出众形象',
        condition: (s) => (!s.relationship_status || s.relationship_status === 'single') && s.charm >= 15,
        effect: (s) => ({ relationship_status: 'matched', partner_type: 'artist', charm: Math.min(30, s.charm + 3), message: '【匹配成功】在昏暗的 Livehouse 里，你与一位在设计学院读书的文青对上了眼。你们聊了王家卫和坂本龙一，进入 Matched 状态！' }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【高端社交】混入沙丘路 VC 晚宴与红酒品鉴会',
        reqBadge: '需 雄厚财力',
        condition: (s) => (!s.relationship_status || s.relationship_status === 'single') && s.cash >= 50,
        effect: (s) => ({ relationship_status: 'matched', partner_type: 'vc', network: s.network + 10, message: '【匹配成功】你端着香槟在沙丘路的高端晚宴上侃侃而谈，成功吸引了一位年轻有为的 VC 投资人/创业大佬，进入 Matched 状态！' }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【周末交友】周末 Santana Row 喝奶茶 (Coffee Meets Bagel)',
        condition: (s) => !s.relationship_status || s.relationship_status === 'single',
        effect: (s) => {
          const winRate = Math.min(0.95, 0.35 + (s.charm * 0.02) + (s.luck * 0.002) + (s.has_pet ? 0.20 : 0));
          const pass = gameRandom() < winRate;
          return pass 
            ? { relationship_status: 'matched', partner_type: 'random', charm: Math.min(s.max_charm ?? 25, s.charm + 2), message: '【匹配成功】因为主页挂了滑雪和宠物照片，你成功匹配到了一位湾区打工人！双方聊得非常投机，进入 Matched 阶段！' }
            : { cash: Math.max(0, s.cash - 0.2), health: s.health - 5, message: '【匹配失败】连喝了三杯 Boba，对方一听你还没买房且身份未定，默默选择了 AA。你不仅花了钱还受到了真实伤害。' };
        },
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【情感升温】邀请对方一起去 Lake Tahoe 滑雪度假 (升温至 Dating)',
        condition: (s) => s.relationship_status === 'matched',
        reqBadge: '阶段：Matched',
        effect: (s) => {
          const isArtist = s.partner_type === 'artist';
          const pass = gameRandom() < (isArtist ? 0.4 : 0.7); // 文青比较难搞
          return pass
            ? { relationship_status: 'dating', charm: Math.min(s.max_charm ?? 25, s.charm + 3), health: Math.min(100, s.health + 10), message: `【正式确立关系】Tahoe 的雪景与小木屋篝火让两人的感情迅速升温！你们正式官宣成为湾区情侣 (Dating)！` }
            : { relationship_status: 'single', partner_type: undefined, health: s.health - 10, message: '【分道扬镳】滑雪途中因为路线分配和谁洗碗产生了严重分歧。回到湾区后双方互删，退回单身。' };
        },
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【走进婚姻】与伴侣在 Santa Clara 法院登记领证 (领证结婚)',
        condition: (s) => s.relationship_status === 'dating',
        reqBadge: '阶段：Dating',
        effect: (s) => {
          let bonusCash = 20;
          if (s.partner_type === 'engineer') bonusCash = 30; // 码农存款多
          if (s.partner_type === 'vc') bonusCash = 80; // 大佬超多钱
          if (s.partner_type === 'artist') bonusCash = 5; // 文青没钱
          
          return {
            relationship_status: 'married',
            is_married: true,
            cash: s.cash + bonusCash,
            message: `【领证结婚】恭喜！你们在法院正式登记结婚！两人合并了存款与工资 (+$${bonusCash}w 现金)，正式晋升为合法夫妻！`
          };
        },
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '【豪车开局】开豪车直接闪婚 (单身直达结婚)',
        reqBadge: '需 保时捷/赛博皮卡',
        condition: (s) => (s.car === 'porsche' || s.car === 'cybertruck') && (s.relationship_status === 'single' || !s.relationship_status),
        effect: (s) => {
          return {
            relationship_status: 'married',
            partner_type: 'random',
            is_married: true,
            health: s.health - 15,
            message: '【豪车闪婚】你开着豪车在半月湾兜风，出众的个人吸引力让你在短短几个月内就完成了相识、热恋和闪婚！'
          };
        },
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '放弃交友，专心搞钱',
        condition: (s) => !s.is_married && s.relationship_status !== 'married',
        effect: (s) => ({ health: Math.min(100, s.health + 5), message: '觉得相亲太累，你回到家里躺着刷了一整天 YouTube，感到内心十分平静。' }),
        nextEventId: 'sv_year_end_settlement',
      }
    ]
  },

  'breakup_crisis': {
    id: 'breakup_crisis',
    title: '感情危机：七年之痒',
    description: '由于湾区高压的生活节奏、永远在比拼薪资的焦虑、以及你长期对伴侣的忽视，你们的感情走到了破裂的边缘。对方正式向你提出了分手/离婚。',
    choices: [
      {
        text: '和平分手 / 离婚',
        // Only a MARRIED split divides assets (community property). A dating breakup
        // has no merged finances, so no asset division.
        effect: (s) => s.is_married
          ? { cash: s.cash / 2, stocks: (s.stocks || 0) / 2, is_married: false, relationship_status: 'single', partner_type: undefined, health: Math.max(0, s.health - 15), message: '你们平静地签了字。由于湾区共同财产法，你分走了一半的共同资产 (现金与股票均分)，重新搬回了单身公寓。你的生活瞬间空虚了许多。' }
          : { relationship_status: 'single', partner_type: undefined, health: Math.max(0, s.health - 10), message: '你们和平分手，各自安好。恋爱期间财务独立，没有财产纠纷，只是心里空落落的。' },
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '花 $10w 请湾区顶级离婚律师打官司 (仅限已婚, 高风险)',
        costBadge: '律师费 $10w',
        reqBadge: '需总资产 >= $15w',
        condition: (s) => s.is_married === true && (s.cash + (s.stocks || 0)) >= 15,
        effect: (s) => {
          const win = gameRandom() > 0.5;
          const ratio = win ? 0.9 : 0.6;
          const netCash = Math.max(0, (s.cash - 10) * ratio);
          const stockShortfall = s.cash < 10 ? (10 - s.cash) * ratio : 0;
          const netStocks = Math.max(0, parseFloat((((s.stocks || 0) * ratio) - stockShortfall).toFixed(2)));
          return {
            cash: parseFloat(netCash.toFixed(2)),
            stocks: netStocks,
            is_married: false,
            relationship_status: 'single',
            partner_type: undefined,
            health: Math.max(0, s.health - 15),
            message: win
              ? '律师非常给力！你成功保住了 90% 的婚内资产 (扣除律师费后同比例保留)，但漫长的官司让你心力交瘁，头发白了一半。'
              : '律师是个水货！不仅花了高昂的律师费，你还被判决失去了 40% 的资产 (扣除律师费后按判决执行)，你痛心不已！'
          };
        },
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '痛哭流涕挽留，发誓每天准时 5 点下班做饭',
        effect: (s) => {
          const win = s.charm >= 10 && gameRandom() > 0.5;
          if (win) {
            // 挽留成功、关系存续 → 清零 partner_strain，裂痕暂时愈合。
            return s.is_married
              ? { tc: Math.max(0, s.tc - 5), health: Math.min(100, s.health + 10), story_flags: { ...(s.story_flags || {}), partner_strain: 0 }, message: '对方心软了。你为了家庭减少了工作投入，甚至放弃了升职机会，但保住了这个家。' }
              : { health: Math.min(100, s.health + 10), story_flags: { ...(s.story_flags || {}), partner_strain: 0 }, message: '对方被你的诚意打动，你们和好如初，感情更进一步。' };
          }
          return s.is_married
            ? { cash: s.cash / 2, stocks: (s.stocks || 0) / 2, is_married: false, relationship_status: 'single', partner_type: undefined, health: Math.max(0, s.health - 15), message: '破镜难重圆。对方觉得你只是在画大饼，依然坚决离开了你。你被动平分了资产 (现金与股票均分)。' }
            : { relationship_status: 'single', partner_type: undefined, health: Math.max(0, s.health - 12), message: '破镜难重圆。对方觉得你只是在画大饼，还是离开了你。' };
        },
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'boardgame_dating': {
    id: 'boardgame_dating',
    title: '狼人杀/剧本杀相亲局',
    description: '周末你被朋友拉去参加南湾的百人桌游大群局。名义上是玩剧本杀和狼人杀，实际上是大型单身男女相亲局。',
    choices: [
      {
        text: '逻辑拉满！强势 Carry 狂踩全场 (展现高智商)',
        effect: (s) => ({ charm: Math.max(0, (s.charm || 10) - 3), leetcode: Math.min(100, s.leetcode + 5), message: '你逻辑严密，把全场玩伴的漏洞指得一清二楚，带领好人阵营完胜！但是大家觉得你太有压迫感了，活动结束后没一个人加你微信。' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '装小白疯狂给人递水，主打情绪价值',
        effect: (s) => {
          const win = gameRandom() > 0.5;
          const isMarriedNow = s.is_married || s.relationship_status === 'married';
          return win
            ? { 
                charm: Math.min(s.max_charm || 25, (s.charm || 10) + 3), 
                health: Math.min(100, s.health + 10), 
                relationship_status: isMarriedNow ? 'married' : 'dating',
                partner_type: isMarriedNow ? s.partner_type : (s.partner_type || 'engineer'),
                message: isMarriedNow ? '你全程温柔体贴，结识了几位同样在大厂的同行好友，社交氛围轻松！' : '你全程温柔体贴，虽然游戏输了，但成功撩到了一个同样来相亲的大厂同行！你们聊得火热，互加微信并确立了恋爱关系 (Dating)！' 
              }
            : { charm: Math.min(s.max_charm || 25, (s.charm || 10) + 1), health: s.health + 5, cash: Math.max(0, s.cash - 0.2), message: '你跑前跑后伺候大家，当了一整天的“沸羊羊”，虽然交了几个普通朋友，但并没有人看上你。' };
        },
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '发现场地的老板正在招全栈工程师，去聊聊',
        effect: (s) => {
          const win = s.leetcode >= 50;
          const isEmployed = !!s.job_type && s.job_type !== 'unemployed' && !s.laid_off;
          return win
            ? { tc: isEmployed ? s.tc + 3 : 0, cash: s.cash + 3, message: '你没去相亲，反而帮老板解决了一个支付系统的 Bug！老板塞给你一份兼职外包合同与现金，赚了点外快！' }
            : { message: '你和老板聊了半天，发现对方只是想白嫖你写个订餐小程序，你礼貌地拒绝了。' };
        },
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'bay_area_heart_signal': {
    id: 'bay_area_heart_signal',
    title: '【湾区恋综】受邀录制湾区版《心动的信号》',
    description: '凭借出众的高颜值魅力与优秀的行业背景，你收到了小红书与头部华人 MCN 联合打造的现象级恋综《心动的信号·硅谷篇》男神/女神首发嘉宾邀约！录制地点在 Los Altos 山顶豪华独栋别墅，同组嘉宾包括斯坦福美女博主、沙丘路年轻 VC 合伙人与大厂 L6 架构师...',
    choices: [
      {
        text: '【真诚直球路线】在厨房做饭交流真情实感，不争不抢展现真实自我',
        effect: (s) => {
          const baseRate = 0.52;
          const charmBonus = ((s.charm || 22) - 20) * 0.04;
          const luckBonus = ((s.luck || 20) / 300);
          const winRate = Math.min(0.78, Math.max(0.40, baseRate + charmBonus + luckBonus));
          const pass = gameRandom() < winRate;

          return pass
            ? {
                charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 3),
                health: Math.min(100, s.health + 12),
                relationship_status: 'dating',
                partner_type: 'random',
                message: '【终极告白牵手】你的真诚、沉稳与厨艺打动了心动嘉宾！在告白夜双向奔赴牵手成功 (进入 Dating 状态)，全网嗑糖破百万播放！'
              }
            : {
                charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 2),
                health: Math.min(100, s.health + 6),
                message: '【体面错付与遗憾】虽然在厨房的交心十分温馨，但心动嘉宾最终在告白夜被另一位进攻性更强的嘉宾打动。你体面送上祝福，真诚克制的表现为你在全网赢得了极佳路人缘。'
              };
        },
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【大厂硬核炫技】约会时在白板上手撕红黑树与分布式一致性协议，疯狂输出 TC 与大厂光环',
        effect: (s) => ({
          cash: s.cash + 3,
          charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 2),
          leetcode: Math.min(100, s.leetcode + 5),
          message: '【硬核出圈】“约会手撕分布式系统”的名场面直接登顶全网热搜！虽然没能牵手成功，但你被奉为“硅谷最纯粹的硬核做题家码农”，疯狂恰饭赚到了 $3w 品牌代言费！'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【顶级海王拉扯】在多个嘉宾之间若即若离，疯狂互发匿名心动短信制造修罗场',
        effect: (s) => {
          const win = gameRandom() < (0.50 + ((s.luck || 20) / 200));
          return win
            ? {
                charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 6),
                cash: s.cash + 2,
                relationship_status: 'dating',
                partner_type: 'vc',
                message: '【修罗场赢家】你的极限拉扯让全网嗑生嗑死！最终在万人瞩目下成功牵手年轻 VC 嘉宾 (Dating)，商业价值与颜值魅力拉满！'
              }
            : {
                health: Math.max(0, s.health - 15),
                charm: Math.max(10, (s.charm || 10) - 2),
                message: '【全网被冲】你的多线操作被节目组恶意剪辑成了“湾区海王翻车特辑”，在一亩三分地与小红书被疯狂吃瓜讨论，身心俱疲。'
              };
        },
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'ex_wedding_invite': {
    id: 'ex_wedding_invite',
    title: '红色炸弹来袭',
    description: '周末你收到了一份精致的电子请柬。你曾经暧昧过/交往过的前任下个月要在 Napa 酒庄举办盛大婚礼了。',
    choices: [
      {
        text: '大方随份子钱并出席 (花费 $0.2w)',
        condition: (s) => s.cash >= 0.2,
        effect: (s) => ({ cash: Math.max(0, s.cash - 0.2), charm: Math.min(30, s.charm + 1), health: s.health - 5, message: '你强颜欢笑在 Napa 酒庄吃了一顿精致但毫无味道的西餐，包了 $2000 的份子钱，心里拔凉拔凉的。' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '装没看见，默默拉黑',
        effect: (s) => ({ network: Math.max(0, s.network - 5), health: Math.min(100, s.health + 5), message: '你选择无视请柬并删除了对方的好友。圈子里传言你“格局太小”，人脉受损，但你觉得心情舒畅多了！' }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'ex_1point3acres_expose': {
    id: 'ex_1point3acres_expose',
    title: '【避雷爆料】一亩三分地情感版爆料帖：“湾区某大厂 L5 避雷全纪录”',
    description: '深夜微信群被一条一亩三分地热帖刷屏，标题赫然写着《湾区某大厂 L5 避雷，分手抢搬家具 + AA 小费极品全纪录》。帖子附带了匿名聊天记录截图与你特征极度明显的描述，瞬时冲上了论坛热榜第一！',
    choices: [
      {
        text: '亲自下场在论坛回复发帖与前任对撕澄清 (放手一搏挽回形象)',
        // Now a real gamble instead of a strict loss: ~45% you clear your name
        // (recover charm/network), else it backfires harder. vs the safe "delete" option.
        effect: (s) => {
          const clearsName = gameRandom() < 0.45;
          return clearsName
            ? { charm: Math.min(s.max_charm ?? 25, s.charm + 3), health: Math.max(0, s.health - 6), message: '你甩出完整的聊天记录逐条反击，吃瓜群众风向逆转，纷纷同情你、痛骂前任，你的形象不降反升！' }
            : { network: Math.max(0, (s.network || 0) - 5), charm: Math.max(0, s.charm - 4), health: Math.max(0, s.health - 10), message: '两人的互撕越描越黑引发千人围观，你在湾区华人圈与同组同事面前丢尽了颜面，人脉与形象重创！' };
        },
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '装作没看见并找论坛管理员申请隐去敏感信息 (花费 $0.1w)',
        condition: (s) => s.cash >= 0.1,
        effect: (s) => ({ cash: Math.max(0, s.cash - 0.1), network: Math.max(0, (s.network || 0) - 2), charm: Math.max(0, s.charm - 2), message: '论坛管理员删除了包含个人身份的信息，虽然负面影响逐渐平息，但你依然社死休养了半个月。' }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'bay_area_dink_vs_kids': {
    id: 'bay_area_dink_vs_kids',
    title: '【双码家庭抉择】DINK 丁克自由 vs 抢 10 分学区房',
    description: '结婚几年了，湾区双职工面临终极选择：是在 Palo Alto 享受 DINK (双薪无娃) 每年开滑雪与度假，还是砸钱买 Fremont 10 分学区房准备鸡娃？',
    choices: [
      {
        text: '【坚定 DINK 丁克】享受自由人生，每年去 Tahoe / 夏威夷度假',
        effect: (s) => ({
          cash: s.cash + 10,
          health: Math.min(100, s.health + 15),
          charm: Math.min(s.max_charm || 25, s.charm + 3),
          message: '你和伴侣达成了 DINK 共识！没有育儿焦虑与学区房负担，两人每年满世界度假，生活滋润无比！'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【抢学区房鸡娃】买 Fremont 10 分学区房，报名卡内基梅隆机器人夏令营 (消耗 $15w 现金)',
        condition: (s) => s.cash >= 15,
        effect: (s) => ({
          cash: s.cash - 15,
          health: s.health - 10,
          rent: s.housing_name === HOUSING_NAMES.ATHERTON ? 0 : 4.5,
          has_housing: true,
          housing_name: s.housing_name === HOUSING_NAMES.ATHERTON ? HOUSING_NAMES.ATHERTON : HOUSING_NAMES.FREMONT_10_DISTRICT,
          message: '你步入了湾区老爹鸡娃正轨！社区邻居全是高强度卷 AMC10 的硅谷大佬，每天陪娃解题虽然辛苦但充实。'
        }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'ikea_furniture_fight': {
    id: 'ikea_furniture_fight',
    title: '周末危机：宜家家具组装',
    description: '为了布置温馨的小家，周末你和伴侣去 IKEA 买了一个巨型衣柜。回到家后，面对一堆木板和毫无逻辑的说明书，气氛变得十分焦灼。',
    choices: [
      {
        text: '自告奋勇，独自一人闷头组装 (拼体力)',
        effect: (s) => {
          const pass = gameRandom() < 0.5;
          return pass 
            ? { health: s.health - 10, charm: Math.min(30, s.charm + 1), message: '花了 6 个小时，你终于把衣柜拼好了！虽然累得腰酸背痛，但伴侣对你崇拜有加，感情升温！' }
            : { health: s.health - 15, message: '拼到一半发现一块核心木板装反了，必须要全部拆掉重来...伴侣在旁边叹气，两人不欢而散。' };
        },
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '花钱消灾，直接请 TaskRabbit 师傅 (花费 $0.1w)',
        condition: (s) => s.cash >= 0.1,
        effect: (s) => ({ cash: Math.max(0, s.cash - 0.1), health: Math.min(100, s.health + 5), message: '你果断打开 TaskRabbit 花了 $1000 请了墨西哥老哥。半小时搞定，你们开开心心出门吃大餐去了。' }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'pickleball_networking': {
    id: 'pickleball_networking',
    title: 'Pickleball (匹克球) 社交局',
    description: '最近湾区不流行高尔夫了，所有人都在打匹克球。你的朋友拉你去参加一个高端局，据说有很多投资人和大厂 Director。',
    choices: [
      {
        text: '【开 Cybertruck/保时捷轰鸣进场】载着顶级装备轰动全场 (需豪车)',
        reqBadge: '豪车轰鸣加成',
        condition: (s) => s.car === 'cybertruck' || s.car === 'porsche',
        effect: (s) => {
          const isUnemployed = s.job_type === 'unemployed' || s.laid_off;
          const canLandJob = !isUnemployed || s.leetcode >= 45 || (s.network || 0) >= 30;
          if (isUnemployed && !canLandJob) {
            return {
              charm: Math.min(s.max_charm ?? 25, s.charm + 5),
              health: Math.min(100, s.health + 15),
              message: '多边形皮卡/保时捷引擎轰鸣声吸引了全场眼光！有投资人给你推了独角兽面试，但你太久不练算法，白板编程没有通过面试。'
            };
          }
          const targetLvl = s.level || (s.is_phd ? 'L4' : 'L3');
          const newTC = isUnemployed ? getLevelScaledTC(22, targetLvl) : s.tc + 6;
          return {
            tc: newTC,
            level: targetLvl,
            job_type: isUnemployed ? 'big_tech' : s.job_type,
            laid_off: false,
            charm: Math.min(s.max_charm ?? 25, s.charm + 5),
            health: Math.min(100, s.health + 15),
            message: isUnemployed
              ? `多边形皮卡/保时捷引擎轰鸣声吸引了全场眼光！一位科技基金合伙人引荐你去 AI 独角兽，你扎实的算法基础顺利通过面试，空降高薪 Offer (定级 ${targetLvl} · 年薪 ${newTC}w)！`
              : '多边形皮卡/保时捷引擎轰鸣声吸引了全场眼光！一位科技基金合伙人主动拉你组队打双打，并现场推荐你去了顶级 AI 独角兽团队！'
          };
        },
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '花 $1w 买全套顶级装备去混圈子',
        condition: (s) => s.cash >= 1,
        effect: (s) => {
          const win = gameRandom() > 0.5;
          const isUnemployed = s.job_type === 'unemployed' || s.laid_off;
          const canLandJob = !isUnemployed || s.leetcode >= 45 || (s.network || 0) >= 30;
          if (win && isUnemployed && !canLandJob) {
            return { cash: s.cash - 1, charm: Math.min(s.max_charm ?? 25, s.charm + 3), health: Math.min(100, s.health + 10), message: '你的球技极佳，在场上和一位 VC 成了双打搭档并获推面试，但算法生疏未能拿到 Offer。' };
          }
          const targetLvl = s.level || (s.is_phd ? 'L4' : 'L3');
          const newTC = isUnemployed ? getLevelScaledTC(20, targetLvl) : s.tc + 5;
          return win
            ? { cash: s.cash - 1, tc: newTC, level: targetLvl, job_type: isUnemployed ? 'big_tech' : s.job_type, laid_off: false, charm: Math.min(s.max_charm ?? 25, s.charm + 3), health: Math.min(100, s.health + 10), message: `你的球技极佳，在场上和一位 VC 成了双打搭档，对方随手把你推荐给了一家明星公司 (定级 ${targetLvl} · 总包 ${newTC}w)！` }
            : { cash: s.cash - 1, health: Math.max(0, s.health - 15), message: '你用力过猛拉伤了跟腱，不仅没混到圈子，还在家躺了半个月。' };
        },
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '不去，宅在家打黑神话',
        effect: (s) => ({ health: Math.min(100, s.health + 10), message: '你拒绝了无效社交，在家又通关了一次二郎神，神清气爽。' }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'rock_climbing_event': {
    id: 'rock_climbing_event',
    title: '【湾区潮流】Movement 抱石馆的黑标大佬',
    description: '周末你穿上始祖鸟，来到了 Sunnyvale 的 Movement 抱石馆。馆里到处都是身穿 Lululemon 和始祖鸟黑标的硅谷码农在研究 V4/V5 路线。',
    choices: [
      {
        text: '挑战 V5 难度黑点路线 (体验攀岩硬核快感)',
        effect: (s) => ({
          health: Math.min(100, s.health + 20),
          charm: Math.min(s.max_charm ?? 25, s.charm + 3),
          message: '你顶住了侧拉与脚尖 Hook 挂墙，成功 Top out 登顶！虽然前臂肌肉酸痛，但心理压力一扫而空，神清气爽！'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '与旁边脱下镁粉袋的老哥交流动态跳跃 (尝试搭讪拓展人脉)',
        effect: (s) => {
          const win = gameRandom() < 0.45;
          const isUnemployed = s.job_type === 'unemployed' || s.laid_off;
          const canLandJob = !isUnemployed || s.leetcode >= 45 || (s.network || 0) >= 30;
          if (win && isUnemployed && !canLandJob) {
            return {
              charm: Math.min(s.max_charm ?? 25, s.charm + 4),
              health: Math.min(100, s.health + 15),
              message: '老哥极为欣赏你的解题节奏并为你推荐了 AI 团队面试，可惜你长期没练算法没能通过白板面试。'
            };
          }
          const targetLvl = s.level || (s.is_phd ? 'L4' : 'L3');
          const newTC = isUnemployed ? getLevelScaledTC(20, targetLvl) : s.tc + 5;
          return win
            ? {
                tc: newTC,
                level: targetLvl,
                job_type: isUnemployed ? 'big_tech' : s.job_type,
                laid_off: false,
                charm: Math.min(s.max_charm ?? 25, s.charm + 4),
                health: Math.min(100, s.health + 15),
                message: `聊了几句才发现对方是隔壁 AI 巨头的 Principal Architect！老哥非常欣赏你的解题节奏，直通推荐你去了核心 AI 算力架构团队 (定级 ${targetLvl} · 总包 ${newTC}w)！`
              }
            : {
                health: Math.min(100, s.health + 20),
                charm: Math.min(s.max_charm ?? 25, s.charm + 2),
                message: '老哥热情地向你分享了他的动态挂脚技巧，你们加了 Strava 好友，约定下周末继续来刷 V5 路线。'
              };
        },
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'tennis_networking': {
    id: 'tennis_networking',
    title: '【湾区精英】Cupertino 网球场双打局',
    description: '周六加州阳光明媚，你带着 Babolat 拍子来到了 Cupertino 的网球场。几位大厂 Senior 与 Startup Founder 正好缺一个双打搭档...',
    choices: [
      {
        text: '轰出 100mph 强力发球，统治比赛',
        effect: (s) => ({
          health: Math.min(100, s.health + 20),
          charm: Math.min(s.max_charm ?? 25, s.charm + 4),
          network: Math.min(100, (s.network || 10) + 3), // match the "拉进高端俱乐部群" flavor
          message: '你的正手上旋与发球统治了全场！球友们直呼“湾区费德勒”，纷纷拉你进南湾高端网球俱乐部群，相亲与社交胜率大增！'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '打温和拉球，场下与搭档畅聊 AI 风口与美股',
        effect: (s) => ({
          cash: s.cash + 4,
          health: Math.min(100, s.health + 10),
          charm: Math.min(s.max_charm ?? 25, s.charm + 2),
          message: '打完球后大家在场边喝电解质水，搭档大佬随口指点了你几只算力概念股，你果断跟进，随后获得了 $4w 美金的短期投资回报！'
        }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'bay_area_hiking': {
    id: 'bay_area_hiking',
    title: '【硅谷仪式感】Fremont Mission Peak 登顶拔剑',
    description: '周末清晨，你被朋友拉去 Fremont 的 Mission Peak 徒步。面对 6 英里无遮挡的大斜坡与湾区烈日，你一步步迈向山顶那根著名的“拔剑柱” (Mission Peaker)...',
    choices: [
      {
        text: '一口气冲上山顶，在拔剑柱前拍 OOTD 大片',
        effect: (s) => ({
          health: Math.min(100, s.health + 15),
          charm: Math.min(s.max_charm ?? 25, s.charm + 3),
          message: '站在 Mission Peak 顶峰俯瞰整个旧金山湾区与 237 公路！你在拔剑柱前拍的帅气写真在朋友圈和小红书获得了上百个赞！'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '中途在草地上躺平休养，呼吸湾区新鲜空气',
        effect: (s) => ({
          health: Math.min(100, s.health + 18),
          message: '阳光洒在身上，看着远处的牛群与红木山谷，你久违地感受到了灵魂的放松与惬意。'
        }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'tahoe_ski_blizzard': {
    id: 'tahoe_ski_blizzard',
    title: '【冬日浩劫】 Tahoe 暴雪警报与 I-80 公路 9 小时生死大堵车',
    description: '周五下午 3:15，Slack 上的 #skiing 频道与微信群全炸了：“Tahoe 今晚开大雪，明早 Pow 天雪质爆满！”你急忙合上电脑，把滑雪板扣进车顶箱狂飙出门。然而刚到 Truckee，I-80 公路突然由于暴雪启动了 Chain Control (强制雪链停摆检查)，成千上万台 Tesla 和斯巴鲁卡在雪堆里动弹不得。',
    choices: [
      {
        text: '硬着头皮睡车里！启动特斯拉营地模式或开足暖气在车厢睡袋硬扛',
        effect: (s) => ({
          health: Math.max(15, s.health - 10),
          cash: Math.max(0, s.cash - 0.2),
          luck: Math.min(99, (s.luck || 20) + 6),
          message: '你在后备箱睡袋里吃着打折冷蛋白棒堵了整整 9 个小时。第二天早晨 7:30 铲雪车终于打通道路，你抢到了 Heavenly 缆车头把梯，在大草海滑到了无痕绝美头粉！'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '识时务者为俊杰！果断掉头在 Sacramento 找快捷酒店吃自热火锅',
        effect: (s) => ({
          cash: Math.max(0, s.cash - 0.4),
          health: Math.min(100, s.health + 15),
          charm: s.charm + 1,
          message: '你看着微信群同学在雪里冻得瑟瑟发抖求援救援车，自己在大床房里吃着海底捞自热火锅打黑神话，完成了最明智标准的湾区反向避险骚操作。'
        }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'hawaii_vacation': {
    id: 'hawaii_vacation',
    title: '【WLB神仙体验】夏威夷 Maui 岛度假避世',
    description: '积攒了一整年的 PTO 假期，你终于买好了飞往夏威夷 (Hawaii) 的机票。漫步在威基基海滩 (Waikiki) 的落日余晖中，手里拿着冰镇椰汁与新鲜 Poke ...',
    choices: [
      {
        text: '体验欧胡岛冲浪与火山潜水 (花费 $0.8w)',
        effect: (s) => ({
          cash: Math.max(0, s.cash - 0.8),
          health: Math.min(100, s.health + 18),
          charm: Math.min(s.max_charm ?? 25, s.charm + 4),
          message: '太平洋的海浪与彩虹彻底洗去了写代码的疲惫！你的体能恢复满格，带着一身健康的阳光小麦肤色重返硅谷！'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '海景酒店阳台躺平，听海浪声睡三整天 (花费 $0.4w)',
        effect: (s) => ({
          cash: Math.max(0, s.cash - 0.4),
          health: Math.min(100, s.health + 22),
          message: '彻底关闭 Slack 和 Outlook 提醒！在海浪声中睡到了自然醒，Burnout 症状被完美治愈。'
        }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'japan_trip': {
    id: 'japan_trip',
    title: '【跨境自由行】东京羽田/京都赏枫度假',
    description: '彻底摆脱了 H1B 返美签 Stamp 审查与出入境限制的心理阴影，你享受着无需为签证焦虑的自由，买了一张旧金山直飞东京羽田的头等舱机票！',
    choices: [
      {
        text: '银座狂买 & 奢华怀石料理/米其林 (消耗 $1.5w)',
        effect: (s) => ({
          cash: Math.max(0, s.cash - 1.5),
          health: Math.min(100, s.health + 15),
          charm: Math.min(s.max_charm ?? 25, s.charm + 5),
          story_flags: { ...(s.story_flags || {}), japan_trip_seen: true },
          message: '你享受了最高规格的日式招待！品尝了顶配和牛与怀石料理，在银座彻底放空身心！'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '富士山小木屋温泉私汤连泡 5 天 (消耗 $0.8w)',
        effect: (s) => ({
          cash: Math.max(0, s.cash - 0.8),
          health: Math.min(100, s.health + 20),
          story_flags: { ...(s.story_flags || {}), japan_trip_seen: true },
          message: '望着富士山雪景泡温泉，热气腾腾中所有的湾区职场焦虑烟消云散！'
        }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'napa_wine_tasting': {
    id: 'napa_wine_tasting',
    title: '【中产仪式感】Napa 纳帕谷酒庄品酒周六出行',
    description: '阳光明媚的周末，你和几位湾区同行驱车前往 Napa 纳帕谷高端酒庄。在葡萄园城堡里，侍酒师倒上了 2018 年 Cab Sauv...',
    choices: [
      {
        text: '入坑购买 2 箱高端红酒并订阅 Wine Club 会员 (花费 $0.8w)',
        condition: (s) => s.cash >= 0.8,
        effect: (s) => ({ cash: s.cash - 0.8, charm: Math.min(s.max_charm ?? 25, s.charm + 4), health: Math.min(100, s.health + 10), message: '你体验到了正宗的湾区中产生活方式，品味大幅上升，社交话题更加丰富！' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '纯打卡拍照发朋友圈，喝葡萄汁享受阳光',
        effect: (s) => ({ health: Math.min(100, s.health + 15), charm: Math.min(s.max_charm ?? 25, s.charm + 2), message: '纳帕谷的明媚阳光与绿油油的葡萄园让你极度放松，身心得到了全面滋养！' }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'burning_man_invite': {
    id: 'burning_man_invite',
    title: '火人节的召唤',
    description: '在 Dolores Park 晒太阳时，你的一群朋友（他们是一个住在 SOMA 三居室里的 6 人 Polycule / 开放式关系群体）邀请你加入他们的 Burning Man 营地。他们说这不仅是心灵的洗礼，还能结识顶级 VC。',
    choices: [
      {
        text: '去！拥抱尘土与自由！',
        effect: (s) => ({ 
          cash: s.cash - 1.5, 
          health: s.health - 15,
          charm: s.charm + 10,
          message: '你花了 1.5 万刀买装备。在黑石城的沙尘暴中，你不仅心灵得到了升华，还真的在某个变种车上认识了一个红杉资本的合伙人。'
        }),
        nextEventId: 'sv_year_end_settlement',
        condition: (s) => s.cash >= 1.5
      },
      {
        text: '算了吧，我还要在家 On-Call',
        effect: (s) => ({ 
          health: s.health + 5,
          cash: s.cash + (s.tc / 12),
          message: '你因为顶替他们做了假期的 On-Call 拿到了额外的 Bonus。但看着他们朋友圈的末日废土风照片，你流下了社畜的眼泪。'
        }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'bay_area_pop_concert': {
    id: 'bay_area_pop_concert',
    title: '【湾区抢票狂潮】Levi\'s Stadium 顶流巨星巡演抢票',
    description: '泰勒·斯威夫特 (Taylor Swift) / 周杰伦世界巡回演唱会加州站空降圣克拉拉 Levi\'s Stadium！全湾区的华人码农和社交圈瞬间沸腾，Ticketmaster 被各路自动化抢票脚本挤爆，StubHub 黄牛票直接炒到了上千刀一张...',
    choices: [
      {
        text: '【手写并发脚本】用 Python 配合代理池手搓自动化抢票脚本，原价抢下前排 VIP 内场票 ($0.4w)',
        condition: (s) => s.leetcode >= 30 && s.cash >= 0.4,
        effect: (s) => ({
          cash: s.cash - 0.4,
          charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 4),
          health: Math.min(100, s.health + 15),
          message: '【VIP 内场狂欢】你的高并发抢票脚本在 0.1 秒内秒杀下两张内场票！在 Levi\'s Stadium 烟火下全场大合唱，身心得到极致释放，朋友圈点赞破 300！'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【黄牛高溢价买单】不想费脑子，直接在 StubHub 豪掷千金买下内场票 ($0.8w)',
        condition: (s) => s.cash >= 0.8,
        // Same concert experience as the scripted route (charm+3, health+15); the
        // ONLY downside is the higher ticket price — a real convenience premium, not
        // an inferior experience (was charm+2/health+10, strictly worse than the script).
        effect: (s) => ({
          cash: s.cash - 0.8,
          health: Math.min(100, s.health + 15),
          charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 3),
          message: '【千金难买心头好】虽然黄牛溢价让人肉疼，但你不费吹灰之力就拿下内场，现场震撼合唱让你彻底忘却了本季度的 Perf 焦虑。'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【做黄牛转手套利】用脚本抢下 4 张内场票后直接挂在二手群加价转手，狠赚一笔',
        condition: (s) => s.leetcode >= 25 && s.cash >= 1.0,
        effect: (s) => ({
          cash: s.cash + 2.5,
          charm: Math.max(10, (s.charm || 10) - 1),
          message: '【理财奇才】抢到的门票转手被南湾富二代高价秒抢，净赚 $2.5w 零花钱！虽然被朋友吐槽为“黄牛码农”，但实打实的现金落袋为安。'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '理智消费：在体育场外草坪“挂壁”听免费漏音',
        effect: (s) => ({
          health: Math.min(100, s.health + 5),
          message: '你带着折叠椅和野餐垫坐在场外草坪上，吹着加州晚风听着里面的合唱，一分钱没花也感受到了现场的欢乐。'
        }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'boba_inflation': {
    id: 'boba_inflation',
    title: '【湾区物价】一杯 $13 的珍珠奶茶与四个小费按钮',
    description: '周六下午，你来到 Cupertino 的奶茶店。点了一杯“黑糖珍珠鲜奶微糖加蛋布丁”，结账单显示：$12.85。\n接着店员把旋转 iPad 屏幕转面向你，提示音响起，屏幕上赫然出现四个巨大按钮：\n【20%】   【25%】   【30%】   【Custom】',
    choices: [
      {
        text: '冒着被店员白眼的风险，眯着眼准确点击极小的字体 Custom Tip -> $0.50',
        // A $13 boba + tip is ~$13-16 = ~0.0013-0.0016w, not $1000-2000 (100x slip).
        effect: (s) => ({ cash: Math.max(0, s.cash - 0.0013), message: '你捧着奶茶仓皇逃回车里，发现在停车场你的白色 Model Y 旁边停了另外四台一模一样的白色 Model Y，你按半天钥匙开错别人的车门。' }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '痛快点击 25%，拍照发朋友圈：“湾区物价让硅谷 L5 活得不如国内县城中产 [流泪]”',
        effect: (s) => ({ cash: Math.max(0, s.cash - 0.0016), charm: Math.min(s.max_charm ?? 25, s.charm + 2), message: '你的朋友圈成功引起了老同学的围观和暗酸，完成了标准的硅谷式哭穷炫耀。' }),
        nextEventId: 'sv_year_end_settlement',
      }
    ]
  },

  'xhs_boba': {
    id: 'xhs_boba',
    title: '【南湾美食探店】Cupertino 川湘菜与早茶打卡',
    description: '周末不知道吃什么，你打开小红书，看到首页全在推 Cupertino Main Street 新开的排队王川湘菜馆与粤式早茶。',
    choices: [
      {
        text: '约上两位大厂好友前去拼桌大快朵颐 (花费 $0.05w)',
        condition: (s) => s.cash >= 0.05,
        effect: (s) => ({ cash: Math.max(0, s.cash - 0.05), health: Math.min(100, s.health + 5), charm: Math.min(s.max_charm ?? 25, s.charm + 1), message: '地道的辣子鸡与虾饺治愈了一整周的工位内耗，大家边吃边聊硅谷八卦，身心愉悦！' }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '看着人均 $70+ 账单与 18% 强制服务费，果断回家煮螺蛳粉与煎蛋',
        effect: (s) => ({ health: Math.min(100, s.health + 2), cash: s.cash + 0.05, message: '你拒绝为湾区溢价买单。自己在家煮了螺蛳粉加溏心蛋，省下一大笔钱，主打一个平平淡淡才是真。' }),
        nextEventId: 'sv_year_end_settlement',
      },
      {
        text: '探店拍照发小红书写深度避坑攻略',
        effect: (s) => {
          const viral = gameRandom() > 0.65;
          return viral 
            ? { charm: Math.min(s.max_charm ?? 25, s.charm + 3), health: Math.min(100, s.health + 3), cash: Math.max(0, s.cash - 0.05), message: '排队 1 小时就餐打卡。你随手拍的九宫格美图与菜品打分在小红书成了爆款，收获数百点赞收藏！' }
            : { health: Math.max(0, s.health - 4), cash: Math.max(0, s.cash - 0.05), message: '在餐厅等位 1 小时，菜品平平无奇还踩了雷，回家连夜写了差评避坑贴。' };
        },
        nextEventId: 'sv_year_end_settlement',
      }
    ]
  },

  'boba_opening_frenzy': {
    id: 'boba_opening_frenzy',
    title: '【湾区网红潮】南湾新开爆款奶茶店排队狂潮',
    description: '南湾 Westfield 购物中心新开了一家号称“国内顶流”的网红奶茶烘焙店，朋友圈与小红书被全网刷爆，连湾区大厂码农和网红都在烈日下排起了长龙！',
    choices: [
      {
        text: '跟风排队！周末烈日下排队 2 小时打卡并发小红书 (花费 $0.02w)',
        condition: (s) => s.cash >= 0.02,
        effect: (s) => {
          const win = gameRandom() < 0.70;
          return win
            ? { cash: Math.max(0, s.cash - 0.02), charm: Math.min(s.max_charm ?? 25, s.charm + 2), health: Math.max(0, s.health - 3), message: '排队 2.5 小时终于喝到了！随手加了滤镜发小红书获得了 200+ 点赞，极大满足了湾区潮人的虚荣心！' }
            : { cash: Math.max(0, s.cash - 0.02), health: Math.max(0, s.health - 6), message: '排队两小时，一口喝下去发现又甜又贵纯纯智商税！不仅被加州阳光晒脱皮，还因高糖奶茶腹泻了半天。' };
        },
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '闪送黄牛代排！多花钱找跑腿黄牛送至办公室 (花费 $0.08w)',
        condition: (s) => s.cash >= 0.08,
        effect: (s) => ({ cash: Math.max(0, s.cash - 0.08), charm: Math.min(s.max_charm ?? 25, s.charm + 1), message: '多花了几万韩元/跑腿费免去了排队晒太阳之苦，你在办公室悠闲地喝着网红奶茶，收获了同事羡慕的目光。' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '清流拒绝！去大厂 MicroKitchen (MK) 薅免费 LaCroix 气泡水',
        effect: (s) => ({ health: Math.min(100, s.health + 5), cash: s.cash + 0.05, message: '你拒绝了消费主义洗脑。周末假装去公司加班，从 MicroKitchen (MK) 顺走了两罐气泡水与坚果，省钱又健康！' }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  // === 职场长线 NPC 与多幕剧情因果链 (Long-term NPC Narrative Arcs) ===,

  'biohacking_party': {
    id: 'biohacking_party',
    title: 'Atherton 的长寿教徒',
    description: '在 Atherton 的一个豪宅派对上，主人戴着三个智能指环，宣称自己把生物钟逆转到了 18 岁。他递给你一杯绿色的不明液体，说是他独家研发的“细胞级抗衰老矩阵精华”，只要 $500 一杯。',
    choices: [
      {
        text: '报名“长寿换血抗衰老”年度会员 (消耗 $50w)',
        effect: (s) => ({ 
          cash: s.cash - 50, 
          health: 100,
          message: '你花了 50 万美元。每个月都会有私人医生上门给你注射定制干细胞。你的身体仿佛回到了 18 岁，精力极其充沛！'
        }),
        nextEventId: 'sv_year_end_settlement',
        condition: (s) => s.cash >= 50
      },
      {
        text: '买！一杯“细胞级精华” ($500) 尝尝鲜',
        effect: (s) => ({ 
          cash: s.cash - 0.05, 
          health: Math.min(100, s.health + 5),
          message: '你花了 $500 喝下这杯用香菜和不知名粉末榨的汁。别说，第二天在办公室写代码确实不困了。'
        }),
        nextEventId: 'sv_year_end_settlement',
        condition: (s) => s.cash >= 0.05
      },
      {
        text: '拒绝，并去厨房找多力多滋和可乐',
        // Comfort-food relief instead of a pure double-penalty (was health-2 & charm-2,
        // a strict loss). You skip the woo and just enjoy yourself.
        effect: (s) => ({ 
          health: Math.min(100, s.health + 3),
          charm: Math.max(0, s.charm - 2), 
          message: '你在这个满是生酮饮食者的派对里旁若无人地大嚼碳水，虽被投以异样目光，但吃得那叫一个爽快！'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '跟他探讨脑机接口，看能不能弄点融资',
        // Trimmed from a free +$10w to a plausible small pre-seed check.
        effect: (s) => ({ 
          charm: Math.min(s.max_charm ?? 25, s.charm + 3),
          cash: s.cash + 3,
          message: '你成功用一些炫酷的词汇忽悠了他，他当场决定给你打一小笔钱让你帮他开发一个“量子睡眠追踪”App。'
        }),
        nextEventId: 'sv_year_end_settlement',
        condition: (s) => s.charm > 5
      }
    ]
  },

  'dental_emergency': {
    id: 'dental_emergency',
    title: '突发：智齿发炎',
    description: '你的智齿突然发炎，痛得满地打滚，必须拔除。',
    choices: [
      {
        text: '在湾区看牙医 (贵但顶级医疗，无需奔波)',
        condition: (s) => s.cash >= 0.5,
        // Pay more for better care + zero travel hassle: now beats the fly-home option
        // on health, so the higher cost buys something (was strictly dominated).
        effect: (s) => ({ cash: s.cash - 0.5, health: Math.min(100, s.health + 22), message: '拔了两颗智齿，顶级麻醉与术后护理让你几乎无痛恢复，虽然自付额高达 $5000，但省心省事。' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '买机票回国拔牙！',
        condition: (s) => s.cash >= 0.2,
        effect: (s) => ({ cash: s.cash - 0.2, health: s.health + 20, message: '机票 $1500，拔牙只要 200 块人民币！顺便还能吃顿火锅，身心愉悦！' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '吃布洛芬硬抗 (免费)',
        effect: (s) => ({ health: s.health - 15, message: '为了省钱你选择了硬抗，结果引发了感染，痛不欲生。' }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'credit_card_churning': {
    id: 'credit_card_churning',
    title: '【湾区理财神器】美卡指南与开卡礼狂热',
    description: '作为湾区精算做题家，你沉迷于美卡指南 (US Credit Card Guide)。从 Chase Sapphire Reserve 到 Amex Platinum，再到 Capital One Venture X，你迷上了 5/24 规则与开卡礼 (Sign-up Bonus)！',
    choices: [
      {
        text: '【开卡礼狂魔】一口气申 4 张大额神卡，刷满开卡礼点数兑头等舱 (消耗 $0.5w, 收益 $1.2w 积分价值)',
        effect: (s) => ({
          cash: s.cash - 0.5 + 1.2, // net +0.7 in perks value + charm (the "status" play)
          charm: Math.min(s.max_charm ?? 25, s.charm + 3),
          message: '成功拿到了 300,000 Amex/Chase 积分！直接兑换了旧金山直飞东京的日航全平躺头等舱，精算理财智商彻底碾压同行！'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【DoorDash 薅羊毛】研究 Uber Eats / DoorDash 满减优惠券 (纯攒钱)',
        effect: (s) => ({
          // Distinct raw-cash play: beats churning's +0.7 net on pure cash, no charm.
          cash: s.cash + 0.8,
          message: '你把满减、代金券和限时折扣薅到了极致，实打实攒下了一笔生活费！'
        }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'costco_gold_bar_frenzy': {
    id: 'costco_gold_bar_frenzy',
    title: '【抗通胀神器】Sunnyvale Costco 排队抢购 24K 纯金条',
    description: '消息在湾区微信群疯传：Sunnyvale Costco 突然上架了 1 盎司 Pamp 瑞士 24K 纯金条，大批码农排起长队抢购以抵御高通货膨胀！',
    choices: [
      {
        text: '刷信用卡加码买入 2 块金条避险 (消耗 $0.4w 现金)',
        condition: (s) => s.cash >= 0.4,
        // Gold is a store of value: the $0.4w converts into a tradeable asset (stocks), not vanishes.
        effect: (s) => ({ cash: s.cash - 0.4, stocks: (s.stocks || 0) + 0.4, luck: Math.min(99, s.luck + 2), message: '你成功抢到了两块实物金条装进保险柜，踏实感满满！' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '吐槽“码农盲目跟风”，转身买了两盒烤鸡和热狗回家',
        effect: (s) => ({ cash: Math.max(0, s.cash - 0.02), health: Math.min(100, s.health + 5), message: '啃着 $4.99 美元的 Costco 烤鸡，你觉得这才是实打实的性价比自由。' }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'palo_alto_stanford_lecture': {
    id: 'palo_alto_stanford_lecture',
    title: '【硅谷大咖讲座】Stanford 斯坦福现场听 Jensen Huang 演讲',
    description: '周五晚上，Stanford 校园礼堂举办 AI 领袖公开讲座。黄仁勋穿着皮衣登台演讲，现场挤爆了来自 Sand Hill Road 的 VC 和各大厂码农。',
    choices: [
      {
        text: '讲座后抢占 Q&A 提问环节，自信展示技术见解',
        effect: (s) => ({ network: Math.min(100, (s.network || 0) + 5), charm: Math.min(s.max_charm ?? 25, s.charm + 3), message: '你的提问得到了老黄的幽默点评，现场几位 VC 主动递上了名片！' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '默默听完讲座，去大学路吃一碗热气腾腾的拉面',
        effect: (s) => ({ health: Math.min(100, s.health + 10), charm: Math.min(s.max_charm ?? 25, s.charm + 1), message: '顶级思维碰撞加上一碗热拉面，让你度过了一个充实而愉快的周五夜晚。' }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'parents_us_visit': {
    id: 'parents_us_visit',
    title: '【爸妈探亲】B2 签证赴美与中西文化碰撞',
    description: '爸妈拿着 10 年 B2 签证飞抵旧金山 SFO！老两口打算在湾区住上三个月。老爸每天在小区后院尝试种韭菜养鸡被 HOA 警告，老妈则带你在 99 大华超市狂购并吐槽湾区天价中餐...',
    choices: [
      {
        text: '全程陪同！请假带爸妈自驾一号公路去 17 Mile 与 Napa 品酒 (花费 $0.3w)',
        condition: (s) => s.cash >= 0.3,
        effect: (s) => ({ cash: Math.max(0, s.cash - 0.3), health: Math.min(100, s.health + 5), charm: Math.min(s.max_charm ?? 25, s.charm + 2), network: Math.min(100, (s.network || 0) + 2), message: '虽然老妈一路吐槽加州紫外线强且嫌纳帕红酒贵，但看到朋友圈晒满照片并收获老家亲戚数百赞，你感受到了久违的家庭温暖。' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '给爸妈报华人大巴老年团，让他们自己去黄石公园与大峡谷 (花费 $0.15w)',
        condition: (s) => s.cash >= 0.15,
        effect: (s) => ({ cash: Math.max(0, s.cash - 0.15), health: Math.min(100, s.health + 5), charm: Math.min(s.max_charm ?? 25, s.charm + 1), message: '老两口在大巴团里结识了一圈同龄阿姨叔叔，每天聊得热火朝天，顺便还帮你拉到了几个潜在相亲对象的信息。' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '工作太忙无暇陪同，让爸妈自己在 South Bay 散步看戏 (换来加班时间)',
        // Not a pure penalty: the time you didn't spend went into work (leetcode).
        effect: (s) => ({ health: Math.max(0, s.health - 5), leetcode: Math.min(100, s.leetcode + 3), message: '你埋头加班，老爸因后院翻土种韭菜遭到 HOA 邻居联名警告，老妈抱怨湾区像大农村，老两口带着满腹牢骚提前回国 —— 但你的项目倒是赶出来了。' }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'vibe_coding_craze': {
    id: 'vibe_coding_craze',
    title: '【AI新纪元】Vibecoding：用 Cursor/Claude 替代手打代码',
    description: 'AI 编程时代降临！硅谷都在传颂“Vibecoding”——不看细节，不用手打每行代码，只用自然语言和 Cursor/Claude Agent 对话，3 分钟生成全栈 App！',
    choices: [
      {
        text: '【Vibecoding 狂魔】开启 Cursor Pro + Claude 3.5 Sonnet，一个人顶一个 5 人团队',
        // No longer a pure-upside no-brainer: heavy AI reliance burns you out and
        // slightly atrophies raw fundamentals — a real trade vs the risky "push to prod" gamble.
        effect: (s) => ({
          leetcode: Math.min(100, s.leetcode + 12),
          health: Math.max(0, s.health - 5),
          tc: s.tc > 0 ? s.tc + 5 : s.tc,
          message: '你成为了组里的 Vibecoding 大师！别人用两周写的功能你半天提交 PR，经理惊呼你一个人就是一支队伍！但连轴转的 Agent 协作让你身心俱疲。'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【生成式 AI 幻觉】全信 AI 自动生成的代码，未审核直接 Push 到 Production 生产环境！',
        effect: (s) => {
          const win = gameRandom() < 0.45;
          return win
            ? { luck: Math.min(99, (s.luck || 20) + 5), cash: s.cash + 2, message: '产线竟然零报错无缝运行！用户量大增，领导夸赞你产出惊人！' }
            : { health: Math.max(0, s.health - 15), message: 'AI 幻觉写出了逻辑死锁导致大厂全网宕机 2 小时！你半夜被 PagerDuty 电话叫醒去改底层 C++！' };
        },
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'ai_agent_startup': {
    id: 'ai_agent_startup',
    title: '【黑客松爆火】AI Agent 自动化工作流助手',
    description: '你在周末 Hackathon 上用 AI Agent 搭建了一个全自动替工程师开 Zoom 会与自动写 Weekly Report 的 Agent 助手，在 Twitter/X 上暴火！',
    choices: [
      {
        text: '【VC 争相送钱】接受 a16z / YC 的 $15w 种子轮打款',
        // Text now matches the effect (+$15w), and it no longer silently flips
        // job_type to 'startup' while keeping the player's big-tech level/TC.
        effect: (s) => ({
          cash: s.cash + 15,
          charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 6),
          message: 'a16z 领投种子轮！获得 $15 万美金天使现金，你登上了 TechCrunch 头条，成为硅谷最炙手可热的 AI Agent 创业明星！'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【开源上星】在 GitHub 开源该项目，收割 15k Stars',
        effect: (s) => ({
          charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 5),
          luck: Math.min(99, (s.luck || 20) + 8),
          leetcode: Math.min(100, s.leetcode + 10),
          message: '项目登上了 GitHub Trending 榜首！全球几万开发者给你送 Star，连 Sam Altman 都转发了你的 Tweet！'
        }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'ai_wrapper_startup': {
    id: 'ai_wrapper_startup',
    title: 'Hayes Valley 的 AGI 革命',
    description: '在 Hayes Valley 的咖啡馆，一个穿着 Patagonia 背心的 Founder 凑过来。他宣称自己正在做“颠覆人类的 AGI”，但你发现他的产品只是个调 OpenAI API 的壳子。他邀请你加入当 CTO，开价 0 薪水 + 10% 期权（四年 Vesting），并让你立刻修一个 prompt injection 的 bug。',
    imageUrl: 'images/ai_startup.jpg',
    choices: [
      {
        text: 'All in! 辞职加入，这波必成独角兽',
        effect: (s) => ({ 
          cash: s.cash - 5, 
          tc: 0, 
          laid_off: true,
          job_type: 'unemployed',
          level: undefined,
          health: s.health - 15,
          message: '你辞去了大厂工作。熬夜修了三天 Bug 后，OpenAI 发布了新功能，直接把你们的产品做成了免费内置功能。公司破产了。'
        }),
        nextEventId: 'job_hunt',
        condition: (s) => s.tc > 0 && s.cash >= 5
      },
      {
        text: '投资 $10k，当个天使投资人',
        effect: (s) => {
          const success = gameRandom() > 0.9;
          return success 
            ? { cash: s.cash + 100, charm: s.charm + 5, message: '离谱！这家公司莫名其妙被 Yahoo 收购了，你暴富了！' }
            : { cash: s.cash - 1, message: '几个月后这哥们去巴厘岛做数字游民了，你的投资打了水漂。' };
        },
        nextEventId: 'sv_year_end_settlement',
        condition: (s) => s.cash >= 1
      },
      {
        text: '冷笑一声，继续刷我的 LeetCode',
        effect: (s) => ({ 
          leetcode: s.leetcode + 5, 
          charm: s.charm - 1,
          message: '你懒得理他，默默 AC 了一道 Hard 题。'
        }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'mac_mini_open_claw_server': {
    id: 'mac_mini_open_claw_server',
    title: '【本地 AI 极客】买 Mac Mini 部署 OpenClaw 本地 Agent',
    description: '为避免云端 API 账单爆表与隐私泄露，你果断花了 $2,000 美金抢购了一台 64GB 统一内存的 Mac Mini，在客厅 24 小时本地部署跑 OpenClaw / 本地自主 Agent！',
    choices: [
      {
        text: '调教 Agent 替你跑抓取与总结邮件 (花费 $0.2w)',
        condition: (s) => s.cash >= 0.2,
        effect: (s) => ({ cash: Math.max(0, s.cash - 0.2), leetcode: Math.min(100, s.leetcode + 4), health: Math.min(100, s.health + 5), message: '本地 OpenClaw 部署成功！虽然折腾 YAML 配置有点累，但 Agent 帮处理了不少琐碎爬虫与邮件任务。' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '折腾三天环境，发小红书“湾区码农客厅 AI 服务器” (花费 $0.2w)',
        condition: (s) => s.cash >= 0.2,
        effect: (s) => ({ cash: Math.max(0, s.cash - 0.2), charm: Math.min(s.max_charm ?? 25, s.charm + 2), message: '你的客厅 Mac Mini 服务器组照获得了 200+ 赞，不少极客同仁在评论区交流开源部署心得。' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '资金吃紧，改在旧电脑上配置免费开源 Local Model 尝试轻量测试',
        condition: (s) => s.cash < 0.2,
        effect: (s) => ({ leetcode: Math.min(100, s.leetcode + 2), message: '你在旧设备上搭建了轻量版本地 Agent，虽然算力有限但体验了本地 AI 的乐趣。' }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'multi_agent_side_hustle': {
    id: 'multi_agent_side_hustle',
    title: '【Multi-Agent 副业】部署无人值守 Agent 自动套利',
    description: '你自己写了一套 Multi-Agent 架构，全网 24 小时自动化抓取美股财报、套利与量化小工具。',
    choices: [
      {
        // Was an unconditional +$12w faucet with a strictly-worse alternative. Now a
        // modest, genuinely risky side income (EV ~ +$1.75w/yr).
        text: '全力运行 Multi-Agent 自动套利脚本 (高波动副业)',
        effect: (s) => {
          const win = gameRandom() < 0.55;
          return win
            ? { cash: s.cash + 4, health: Math.max(0, s.health - 5), message: 'Multi-Agent 自动套利脚本跑通，为你带来了 $4w 额外副业现金流！' }
            : { cash: Math.max(0, s.cash - 1), message: '规模过大触发 Cloudflare 封禁 IP，脚本失效并倒贴了一笔服务器租金 ($1w)。' };
        },
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '浅尝辄止，不大规模部署',
        effect: () => ({ message: '你担心合规与封号风险，只把它当成一个玩具项目，没有实际收益。' }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'fashion_disaster_hoodie': {
    id: 'fashion_disaster_hoodie',
    title: '【湾区穿搭】洞洞鞋 + 大厂旧 Hoodie 被吐槽',
    description: '你穿着起球的大厂旧 Hoodie、Patagonia 夹克和洞洞鞋去 Palo Alto 约会。餐桌上，朋友开玩笑吐槽：“你这一身活脱脱就是湾区油腻码农标配啊！”',
    choices: [
      {
        text: '坚称“这是极客硬核文化与 WLB 的象征”',
        effect: (s) => ({ charm: Math.max(0, s.charm - 3), health: Math.min(100, s.health + 5), message: '你维持了自己的穿搭习惯，但在朋友眼里你的精致度与个人形象有所减分。' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '痛下决心，去 Santana Row 购买几套修身休闲装 (花费 $0.2w)',
        condition: (s) => s.cash >= 0.2,
        effect: (s) => ({ cash: Math.max(0, s.cash - 0.2), charm: Math.min(s.max_charm ?? 25, s.charm + 3), message: '换上合身的新衣服后，你整个人精神焕发，颜值与个人吸引力大幅提升！' }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'linkedin_cold_outreach_spam': {
    id: 'linkedin_cold_outreach_spam',
    title: '【人脉黑名单】LinkedIn 乱发 Cold Message 遭圈内避嫌',
    description: '你急于拓展圈子，用自动化脚本向湾区 200 多位大厂 Director / VP 批量发送了推销自己的 Cold Message。结果被某总监截图发在 Pulse 专栏吐槽“缺乏基本职业素养”...',
    choices: [
      {
        text: '在评论区与发帖总监论战维护尊严 (硬刚涨黑粉气场)',
        // No longer a strict loss: fighting back costs network but a vocal minority
        // finds you "based" (charm up), so it trades network for charm vs the apology.
        effect: (s) => ({ network: Math.max(0, (s.network || 0) - 4), charm: Math.min(s.max_charm ?? 25, s.charm + 3), health: Math.max(0, s.health - 3), message: '你在评论区舌战群儒，虽然得罪了部分业内大佬(人脉受损)，但你的犀利与硬气也圈了一批欣赏你的粉丝！' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '私信向对方诚恳致歉并主动关闭脚本',
        effect: (s) => ({ network: Math.max(0, (s.network || 0) - 2), charm: Math.min(s.max_charm ?? 25, s.charm + 1), message: '你的诚恳态度平息了波澜，成功控制住了负面影响。' }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'rednote_influencer_side_hustle': {
    id: 'rednote_influencer_side_hustle',
    title: '【网红副业】小红书/自媒体高形象变现',
    description: '由于你出众的形象与湾区大厂生活 Vlog，你在小红书和 YouTube 积累了数万粉丝，多家品牌方发来商业广告邀约！',
    choices: [
      {
        text: '接下品牌商业植入推广，开启副业变现！',
        effect: (s) => ({ cash: s.cash + 2, charm: Math.min(s.max_charm ?? 25, s.charm + 1), message: ' 爆款变现！商业合作广告大获成功，你轻松斩获 $2w 美元额外副业收益！' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '保持纯粹，只分享生活日常，拒绝硬广洗脑',
        effect: (s) => ({ charm: Math.min(s.max_charm ?? 25, s.charm + 3), health: Math.min(100, s.health + 5), message: '你的真实与接地气圈粉无数，获得了绝佳的粉丝口碑！' }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'luxury_car_meet': {
    id: 'luxury_car_meet',
    title: '【湾区豪车车友会】Skyline Blvd 跑山',
    description: '作为保时捷/Cybertruck 豪车车主，你受邀参加了湾区 35 号公路 (Skyline Blvd) 的周末豪车车友会。',
    choices: [
      {
        text: '和 VC / 大厂 Director 交流豪车与独角兽投资',
        // Only raise TC if actually employed (middleware zeroes tc for unemployed,
        // silently voiding the promised raise); otherwise it's a networking gain.
        effect: (s) => {
          const employed = !!s.job_type && s.job_type !== 'unemployed' && !s.laid_off;
          return {
            tc: employed ? s.tc + 5 : s.tc,
            network: Math.min(100, (s.network || 10) + 5),
            charm: Math.min(s.max_charm ?? 25, s.charm + 3),
            health: Math.min(100, s.health + 10),
            message: employed
              ? '车友会里藏龙卧虎！你结识了一位科技基金合伙人，帮你争取到了一笔加薪，TC 再次提升！'
              : '车友会里藏龙卧虎！你结识了一位科技基金合伙人，拓展了宝贵的高端人脉资源！'
          };
        },
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '下场 17-Mile 沿海公路体验极限跑山 (消耗 $0.5w)',
        // Distinct payoff (charm + car-scene clout as luck) so it isn't just a
        // worse version of the networking option for employed players.
        effect: (s) => ({
          cash: Math.max(0, s.cash - 0.5),
          charm: Math.min(s.max_charm ?? 25, s.charm + 5),
          luck: Math.min(99, s.luck + 3),
          health: Math.max(0, s.health - 5),
          message: '引擎轰鸣，推背感拉满！你在湾区跑车圈名声大噪，还结识了一群玩改装的性情中人！'
        }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'san_francisco_car_window_smash': {
    id: 'san_francisco_car_window_smash',
    title: '【旧金山特色】Mission 区吃 Tacos 车窗惨遭砸破',
    description: '周六下午，你开车去旧金山 Mission 区吃网红 Tacos。停在路边仅 1 小时，回来赫然发现后车窗被打碎，后备箱里的健身包与备用笔记本被搜刮一空...',
    choices: [
      {
        text: '自认倒霉走自付费 Deductible 立刻换玻璃 (消耗 $0.1w，省心)',
        condition: (s) => s.cash >= 0.1,
        // Fixing it promptly = no lingering stress (no health hit); the tradeoff is
        // paying $0.1w vs the free "post it online" option that keeps the -5 health.
        effect: (s) => ({ cash: Math.max(0, s.cash - 0.1), message: '你当天就把车窗修好，没让这事继续糟心，领教到了旧金山最真实的治安“震撼”。' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '拍照发小红书“旧金山治安体验”，引发热烈围观',
        effect: (s) => ({ charm: Math.min(s.max_charm ?? 25, s.charm + 3), health: Math.max(0, s.health - 5), message: '你的小红书帖子获得了 300+ 赞，不少湾区博主在评论区感同身受地交流防砸车经验。' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【高危操作】根据 AirTag 设备定位，勇闯奥克兰黑市跳蚤市场！',
        effect: (s) => {
          const win = gameRandom() > 0.7;
          return win 
            ? { charm: Math.min(s.max_charm ?? 25, s.charm + 3), luck: Math.min(99, s.luck + 2), message: '你像动作大片主角一样智勇双全，在巡警协助下从销赃点夺回了财物，成为了湾区传奇！' }
            : { health: Math.max(0, s.health - 15), cash: Math.max(0, s.cash - 0.5), message: '你不仅没找回财物，还险些遭遇劫匪围堵，仓皇逃回南湾，医药费与修车费花了好几千。' };
        },
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'tesla_fsd_unsupervised_scare': {
    id: 'tesla_fsd_unsupervised_scare',
    title: '【FSD 惊魂】101 高速自动驾驶施工路段幽灵刹车',
    description: '周一早高峰晚点，你在 101 高速上开启了最新版的 Tesla FSD 自动驾驶。车子在 Passing 施工路段时突然无征兆幽灵急刹...',
    choices: [
      {
        text: '吓出一身冷汗，立刻双手接管车轮',
        effect: (s) => ({ health: Math.max(0, s.health - 5), leetcode: s.leetcode + 3, message: '你惊险避免了后车追尾！经此一役，你对自动驾驶边界条件有了更深的工程体会。' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '把行车记录仪视频剪辑发 YouTube / B站爆火',
        effect: (s) => ({ charm: Math.min(s.max_charm ?? 25, s.charm + 4), message: '你的幽灵刹车测试视频获得了 50,000+ 播放，吸引了大批极客粉丝关注！' }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'luxury_car_vandalism_towing': {
    id: 'luxury_car_vandalism_towing',
    title: '【破财消灾】豪车 Palo Alto 街头遭遇恶意砸车与霸王拖车',
    description: '你停在 Palo Alto 大学路旁边的保时捷 / 豪车突然被无良拖车公司强行拖走！不仅车窗被恶意损坏，恶霸拖车公司还开出了包含强制 Storage 存放费的天价赎车单...',
    choices: [
      {
        text: '花钱消灾，直接缴纳天价赎车费与维修费 (消耗 $2w 现金)',
        condition: (s) => s.cash >= 2,
        effect: (s) => ({ cash: s.cash - 2, health: s.health - 5, message: '你一次性掏出 $2w 赎回了豪车并修好了大灯。高阶玩家的烦恼往往就是这么朴实无华。' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '找律师控诉并录制视频发小红书/YouTube 曝光 (消耗 $0.5w 现金)',
        condition: (s) => s.cash >= 0.5,
        effect: (s) => ({ cash: s.cash - 0.5, health: s.health - 10, charm: Math.min(s.max_charm ?? 25, s.charm + 3), message: '你的曝光视频引发了舆论关注，拖车公司迫于压力退还了赎车费，但你折腾得精疲力竭。' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '现金不足，强行刷信用卡透支支付赎车费 (健康 -10)',
        condition: (s) => s.cash < 0.5,
        // Narrative is "survive via credit-card overdraft", so floor cash at 0 — never let this
        // safe branch itself trigger bankruptcy for a sub-$0.5w player.
        effect: (s) => ({ health: Math.max(0, s.health - 10), cash: Math.max(0, s.cash - 0.5), message: '在现金彻底见底的情况下，你不得不信用卡透支结清拖车费赎回了车辆。' }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'health_burnout_warning': {
    id: 'health_burnout_warning',
    title: '【中年体能警报】Stanford Health 体检预警',
    description: '在 Stanford Health 的年度体检中，医生严肃地指着你的报告：中度脂肪肝、腰椎 L4-L5 间盘突出、血压血脂双双超标。“如果你继续保持每天坐 10 个小时、高压冲刺代码的生活，5 年内猝死风险高达 40%！”',
    choices: [
      {
        text: '【开启彻底保养】买升降桌、立式办公、每周 3 次皮拉提斯与私人教练 (花费 $1w)',
        effect: (s) => ({
          cash: Math.max(0, s.cash - 1),
          health: Math.min(100, s.health + 25),
          message: '健康就是最大的财富！经过半年的体能恢复，你的身体各项指标全面回归正常，神清气爽！'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【轻伤不下火线】吃降压药硬抗，继续为下一个 Promotable Project 拼命',
        condition: (s) => !s.laid_off && !!s.job_type && s.job_type !== 'unemployed',
        effect: (s) => ({
          health: Math.max(0, s.health - 15),
          tc: (s.job_type === 'unemployed' || s.laid_off) ? 0 : s.tc + 5,
          message: '你靠吃药硬撑过了 Q4 冲刺！虽然顺利拿到了加薪，但腰椎间盘的剧痛让你每天只能躺在地上看代码。'
        }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'hair_loss_and_slouch': {
    id: 'hair_loss_and_slouch',
    title: '【职业病危机】发际线后移与湾区体态衰退',
    description: '长期 996 熬夜死磕代码与高压 Oncall，你无意中照镜子惊恐地发现自己的发际线急剧后移，且出现了严重的倒三角龟脖与弯腰驼背体态！',
    choices: [
      {
        text: '无视它，“程序员靠硬核算法实力说话，不靠颜值”',
        // The time/energy saved goes into code (leetcode), so ignoring looks is a real
        // charm-vs-skill trade, not a pure double-penalty.
        effect: (s) => ({ charm: Math.max(0, s.charm - 3), leetcode: Math.min(100, s.leetcode + 5), message: '你把照镜子的时间都拿去刷题攻坚了，颜值形象是滑坡了，但算法功底又精进了一层。' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '预约土耳其植发与高端体态矫正普拉提 (花费 $0.5w)',
        condition: (s) => s.cash >= 0.5,
        effect: (s) => ({ cash: Math.max(0, s.cash - 0.5), charm: Math.min(s.max_charm ?? 25, s.charm + 3), health: Math.min(100, s.health + 10), message: '植发与体态矫正效果显著！你的精气神与个人吸引力大幅度恢复！' }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'social_withdrawal_burnout': {
    id: 'social_withdrawal_burnout',
    title: '【社交退化】闭门不出与社恐自我隔离',
    description: '近两年来你除了在 MicroKitchen (MK) 拿气泡水外几乎没进行过工作以外的社交，感觉自己的口头表达能力与圈子广度急剧退化...',
    choices: [
      {
        text: '继续宅在宿舍/家里，下班打单机游戏',
        effect: (s) => ({ charm: Math.max(0, s.charm - 3), network: Math.max(0, (s.network || 0) - 3), health: Math.min(100, s.health + 5), message: '你沉浸在宅家快乐中，但你的社交朋友圈与个人形象进一步萎缩。' }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '强迫自己报名湾区狼人杀局与攀岩圈 (花费 $0.05w)',
        condition: (s) => s.cash >= 0.05,
        effect: (s) => ({ cash: Math.max(0, s.cash - 0.05), charm: Math.min(s.max_charm ?? 25, s.charm + 2), network: Math.min(100, (s.network || 0) + 3), message: '在桌游与攀岩中你结识了多位开朗的新朋友，重新找回了社交节奏！' }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'brentwood_cherry_picking': {
    id: 'brentwood_cherry_picking',
    title: '【湾区五月三俗之首】Brentwood 摘樱桃大军',
    description: '五月加州阳光明媚，湾区朋友圈与 Slack #random 频道被 Brentwood 摘樱桃 (U-Pick Cherries) 彻底刷屏！你戴上草帽、开着车加入了浩浩荡荡的果园大军...',
    choices: [
      {
        text: '【狂摘 25 磅】烈日下抢摘顶级 Rainier 白樱桃，周一带去 MicroKitchen 分给组员 (花费 $0.08w)',
        condition: (s) => s.cash >= 0.08,
        effect: (s) => ({
          cash: Math.max(0, s.cash - 0.08),
          network: Math.min(100, (s.network || 0) + 2),
          health: Math.max(0, s.health - 6),
          message: '【满载而归与轻度中暑】在 35 度烈日与扬尘中狂摘 4 小时让你大汗淋漓、双臂酸痛。不过周一当香甜的白樱桃出现在 MicroKitchen 时，同事们争相品尝并对你的热情赞不绝口。'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【边摘边吃】在樱桃树荫下大饱口福，拍照发小红书“湾区精致农家乐”',
        effect: (s) => ({
          health: Math.max(0, s.health - 6),
          charm: Math.min(s.max_charm ?? 25, s.charm + 1),
          message: '【果糖超标与写真出片】新鲜甜脆的白樱桃让你停不下来，结果因为糖分和果酸超标导致下午严重腹胀腹泻。不过在果园拍的田园写真在小红书斩获了不少点赞。'
        }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'cancun_all_inclusive': {
    id: 'cancun_all_inclusive',
    title: '【大厂冬假三巨头】坎昆 All-inclusive 全包度假村',
    description: '圣诞长假来临，你逃离了湾区的阴雨，飞往墨西哥坎昆 (Cancun) 的 5 星级全包度假村。加勒比海滩、无限续杯的 Margaritas 与全天候 Taco 自助餐让你彻底放空。',
    choices: [
      {
        text: '【彻底合上电脑】海滩躺平 7 天，享受顶级纯享 WLB 避世 (花费 $0.4w)',
        condition: (s) => s.cash >= 0.4,
        effect: (s) => ({
          cash: Math.max(0, s.cash - 0.4),
          health: Math.min(100, s.health + 10),
          leetcode: Math.max(0, s.leetcode - 6),
          message: '【身心回血与手感生疏】加勒比海的碧海蓝天洗净了一整年的工位内耗与疲惫。不过彻底远离工位的这一周，让你回到湾区后连基本的二叉树遍历都有点反应迟钝。'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【泳池边边摸鱼边度假】无边泳池喝鸡尾酒，开着笔记本在 Slack 上秒回 “LGTM” (花费 $0.25w)',
        condition: (s) => s.cash >= 0.25,
        effect: (s) => ({
          cash: Math.max(0, s.cash - 0.25),
          health: Math.max(0, s.health - 6),
          leetcode: s.leetcode + 2,
          message: '【心累摸鱼与保持敏锐】戴着墨镜在泳池遮阳伞下死盯笔记本，随时准备应急响应。你既没享受到纯粹的假期，身心也有些紧绷，但好在算法与代码手感丝毫未落。'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【穷游特价红眼航班】用信用卡积分兑换经济舱，在海滩晒太阳吃街头 Taco',
        effect: (s) => ({
          health: Math.max(0, s.health - 5),
          charm: Math.min(s.max_charm ?? 25, s.charm + 1),
          message: '【红眼腰酸与街头烟火】为了省钱坐了凌晨两点的廉航红眼航班，逼仄的座位让你落枕腰酸。好在加勒比海的阳光同样明媚，你在街头 Taco 摊吃得心满意足。'
        }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'patagonia_vest_hoodie_uniform': {
    id: 'patagonia_vest_hoodie_uniform',
    title: '【硅谷穿搭圣经】Patagonia 抓绒马甲与神级工装',
    description: '随着入职时间变长，你发现组里从 Senior 到 VP 清一色都是“湾区经典皮肤”：Patagonia Better Sweater 抓绒马甲 + 灰色 Allbirds/On 跑鞋 + 黑色公司 Logo 卫衣。',
    choices: [
      {
        text: '【全套入乡随俗】添置经典抓绒马甲与昂跑跑鞋，完美融入硅谷老油条圈子 (花费 $0.05w)',
        condition: (s) => s.cash >= 0.05,
        effect: (s) => ({
          cash: Math.max(0, s.cash - 0.05),
          charm: Math.max(0, s.charm - 2),
          network: Math.min(100, (s.network || 0) + 2),
          message: '【老码农皮肤与告别时尚】穿上松垮的抓绒马甲与灰色羊毛鞋，你彻底告别了时尚穿搭。虽然相亲吸引力有所下滑，但走在办公楼里同事们一眼就看出你是自己人。'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【坚守前卫潮流】坚持走自己的时尚路线，拒绝千篇一律的程序员穿搭',
        effect: (s) => ({
          charm: Math.min(s.max_charm ?? 25, s.charm + 2),
          network: Math.max(0, (s.network || 0) - 2),
          message: '【时尚出圈与格格不入】你穿着剪裁利落的大衣走在满地拖鞋马甲的工程师堆里，显得与大环境格格不入。直男同事们甚至私下揣测你是不是准备转去 Product 或 Design 部门。'
        }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'costco_weekend_pilgrimage': {
    id: 'costco_weekend_pilgrimage',
    title: '【湾区周末朝圣】Costco 试吃大迁徙与抢车位',
    description: '周六下午，你开进了 Sunnyvale 的 Costco 停车场。为了抢一个近车位你跟着推车行人兜了 20 分钟。空气里弥漫着 $4.99 烤鸡与热狗披萨的诱人香气。',
    choices: [
      {
        text: '【横扫全部试吃摊位】煎饺、小香肠、牛肉粒、有机蓝莓巡回打卡，吃饱并搬回 Kirkland 特产',
        effect: (s) => ({
          health: Math.max(0, s.health - 4),
          cash: s.cash + 0.02,
          message: '【高钠快餐与省钱省心】在试吃摊位前与大爷大妈们拼手速，灌下一整杯碳酸饮料和热狗。虽然省下了昂贵的湾区下馆子费用，但高钠高糖的快餐让你的胃沉重了一整天。'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【囤满养生保健品】采购辅酶 Q10、高纯鱼油与护肝片，为高强度开发蓄力 (花费 $0.03w)',
        condition: (s) => s.cash >= 0.03,
        effect: (s) => ({
          cash: Math.max(0, s.cash - 0.03),
          health: Math.min(100, s.health + 6),
          message: '【养生防猝死储备】推着沉重的购物车在排队长龙中等了半小时。看着满满一车辅酶与护肝片，你虽然钱包缩水，但为接下来的高强度加班做足了心理建设。'
        }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'dual_income_tech_layoff_storm': {
    id: 'dual_income_tech_layoff_storm',
    title: '【家庭风暴】伴侣所在大厂遭遇大裁员',
    description: '伴侣所在的大厂突然宣布裁员 10%，伴侣收到了 HR 的离职谈话。家庭现金流瞬间减少，湾区的房贷与生活账单全落到了你肩上。',
    choices: [
      {
        text: '【家庭顶梁柱】安抚伴侣，支持 TA 居家休整半年 (支出少量积蓄，家庭温情)',
        costBadge: '支出 $1w 应急金',
        reqBadge: '需总资产 >= $1w',
        condition: (s) => (s.is_married || s.relationship_status === 'married') && (s.cash + (s.stocks || 0)) >= 1,
        effect: (s) => ({
          cash: s.cash - 1,
          health: Math.min(100, s.health + 8),
          story_flags: { ...(s.story_flags || {}), partner_strain: 0 },
          message: '你坚定地对伴侣说“没事，有我撑着”。伴侣感到无比踏实，夫妻感情更加深厚，家庭凝聚力拉满！'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【人脉内推】动用你的技术人脉与关系网，为伴侣内推大厂',
        reqBadge: '需丰富人脉或硬核算法',
        condition: (s) => (s.is_married || s.relationship_status === 'married') && ((s.network || 0) >= 15 || s.leetcode >= 45),
        effect: (s) => ({
          network: Math.min(100, (s.network || 0) + 5),
          charm: Math.min(s.max_charm ?? 25, (s.charm || 10) + 2),
          message: '你亲自帮伴侣 Mock Interview 并动用同行内推，伴侣两个月内闪电拿到 Meta/Google Offer！双职工现金流光速恢复！'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【领离职大礼包】伴侣拿了 6 个月 Severance 离职补偿金，转入理财账户',
        costBadge: '入账 +$8w 补偿金',
        condition: (s) => s.is_married || s.relationship_status === 'married',
        effect: (s) => ({
          cash: s.cash + 8,
          health: Math.max(0, s.health - 5),
          message: '伴侣拿着 N+3 离职大礼包一次性到账 $8w！虽然短期内失去了一份薪水，但手头现金大幅充裕。'
        }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'dual_income_startup_gamble': {
    id: 'dual_income_startup_gamble',
    title: '【家庭抉择】伴侣收到 AI 独角兽核心团队 Offer',
    description: '伴侣收到了一家沙丘路顶级 VC 领投的 Pre-IPO 明星初创公司发来的核心工程师 Offer。Base 薪资略有缩减，但期权池极其丰厚。伴侣跟你商量是否要去冒这个险：',
    choices: [
      {
        text: '【全力支持 All-in】你单挑大厂房贷底盘，鼓励伴侣去初创博取财富自由',
        reqBadge: '需现金流稳健 (总资产>=30w)',
        condition: (s) => (s.is_married || s.relationship_status === 'married') && (s.cash + (s.stocks || 0)) >= 30,
        effect: (s) => {
          const hit = gameRandom() < 0.35;
          return hit
            ? {
                cash: s.cash + 80,
                stocks: (s.stocks || 0) + 120,
                health: Math.min(100, s.health + 5),
                message: '【初创奇迹爆发！】伴侣所在的 AI 独角兽顺利完成大额新一轮融资与部分老股变现！家庭资产直接暴增 $200w！'
              }
            : {
                health: Math.max(0, s.health - 6),
                message: '伴侣在初创每天加班到深夜，虽然业务还在推进，但期权暂时还只是纸面富贵。你默默在大厂稳住大后方。'
              };
        },
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【稳健为王】建议伴侣留在养老大厂吃免费三餐和 RSU，家庭稳稳躺平',
        condition: (s) => s.is_married || s.relationship_status === 'married',
        effect: () => ({
          health: 10,
          message: '伴侣接受了你的建议，留在养老大厂继续享受免费三餐与年假。周末两人一起去 Cupertino 喝奶茶，生活节奏舒适从容。'
        }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  },

  'dual_income_wlb_burnout': {
    id: 'dual_income_wlb_burnout',
    title: '【双卷王危机】两人的日历全被会议填满',
    description: '你和伴侣双双处于晋升答辩冲刺期，连续一个月每天加班到深夜，回家只能靠冷掉的外卖果腹，身心俱疲。',
    choices: [
      {
        text: '【飞夏威夷度假】两人请 2 周 PTO 年假去 Maui 岛冲浪躺平',
        costBadge: '花费 $0.8w',
        reqBadge: '需总资产 >= $0.8w',
        condition: (s) => (s.is_married || s.relationship_status === 'married') && (s.cash + (s.stocks || 0)) >= 0.8,
        effect: (s) => ({
          cash: s.cash - 0.8,
          health: Math.min(100, s.health + 20),
          story_flags: { ...(s.story_flags || {}), partner_strain: 0 },
          message: '在夏威夷的阳光沙滩与海浪中，两人的疲惫一扫而空，健康大幅回血，找回了生活的意义！'
        }),
        nextEventId: 'sv_year_end_settlement'
      },
      {
        text: '【生活做减法】两人达成共识：放弃无休止的无效内卷，每天准时下班做饭',
        condition: (s) => s.is_married || s.relationship_status === 'married',
        effect: (s) => ({
          health: Math.min(100, s.health + 12),
          tc: Math.max(0, s.tc - 2),
          message: '你们决定不再参与办公室政治与无效抢活，每天 5:30 准时关掉电脑下班做饭，虽然 TC 涨幅放缓，但身心状态健康自如。'
        }),
        nextEventId: 'sv_year_end_settlement'
      }
    ]
  }
};
