import React, { useRef } from 'react';
import type { GameState } from '../types';
import { isOwnedHousing } from '../constants/gameConstants';
import { useFocusTrap } from '../utils/useFocusTrap';
import { gameRandom } from '../utils/random';

interface ShopModalProps {
  gameState: GameState;
  onClose: () => void;
  onBuy: (effect: Partial<GameState>, message: string) => void;
  onTriggerEvent: (eventId: string) => void;
}

export const ShopModal: React.FC<ShopModalProps> = ({ gameState, onClose, onBuy, onTriggerEvent }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef);
  const isHomeowner = isOwnedHousing(gameState.housing_name);
  const totalAssets = gameState.cash + (gameState.stocks || 0);
  const maxCharm = gameState.max_charm ?? 25;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center items-center bg-zinc-950/80 backdrop-blur-sm p-2.5 sm:p-4 animate-in fade-in duration-200">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="shop-modal-title" tabIndex={-1} className="bg-zinc-900 border border-zinc-700/50 rounded-3xl w-full max-w-2xl max-h-[88vh] max-h-[88dvh] overflow-hidden shadow-2xl flex flex-col slide-in-from-bottom-8 sm:slide-in-from-bottom-0 sm:zoom-in-95">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-zinc-800/80 flex justify-between items-center bg-zinc-900/50 sticky top-0 backdrop-blur-xl z-10">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
            </div>
            <div>
              <h3 id="shop-modal-title" className="font-black text-base sm:text-lg text-zinc-100">硅谷资产与消费商城</h3>
              <p className="text-xs text-amber-400 font-mono tracking-wider font-semibold">
                可用总资产: ${totalAssets.toFixed(1)}w
                {(gameState.stocks !== undefined && gameState.stocks > 0) && (
                  <span className="text-zinc-400 font-normal ml-1.5 hidden sm:inline">
                    (现金: ${gameState.cash.toFixed(1)}w | 股票: ${gameState.stocks.toFixed(1)}w · 支持平仓抵扣)
                  </span>
                )}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            title="关闭商城"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-3.5 sm:p-6 overflow-y-auto space-y-5 sm:space-y-6">
          
          {/* Section: Housing */}
          <section>
            <div className="flex justify-between items-center mb-3 border-b border-zinc-800 pb-1">
              <h4 className="text-sm font-mono text-zinc-400 uppercase tracking-widest">置业与居住 (Housing)</h4>
              {(gameState.rental_income !== undefined && gameState.rental_income > 0) && (
                <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  被动租金: +${gameState.rental_income.toFixed(1)}w/年
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                disabled={totalAssets < 40 || isHomeowner}
                onClick={() => { onClose(); onTriggerEvent('buy_house'); }}
                className="flex flex-col text-left p-4 rounded-2xl border border-zinc-700/50 bg-zinc-800/30 hover:bg-zinc-800 hover:border-amber-500/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed group relative overflow-hidden"
              >
                <div className="font-bold text-zinc-200 group-hover:text-amber-400 transition-colors">【抢房大战】参加抢房大战 (首付 $40w+ · 可用股票)</div>
                <div className="text-xs text-zinc-500 mt-1">{isHomeowner ? '已拥有一套自住房产' : '进入买房事件流，挑选湾区房产 (支持股票自动变现)'}</div>
              </button>
              
              <button
                disabled={!gameState.has_housing || isHomeowner || gameState.last_housing_action_year === gameState.year}
                onClick={() => { onClose(); onTriggerEvent('change_rental'); }}
                className="flex flex-col text-left p-4 rounded-2xl border border-zinc-700/50 bg-zinc-800/30 hover:bg-zinc-800 hover:border-emerald-500/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
              >
                <div className="font-bold text-zinc-200 group-hover:text-emerald-400 transition-colors">【搬家换租】重新挑选租房居住环境</div>
                <div className="text-xs text-zinc-500 mt-1">{isHomeowner ? '已买房，无法换租' : '改变你的租房环境'}</div>
              </button>

              <button
                disabled={totalAssets >= 10 || gameState.rent <= 0 || isHomeowner}
                onClick={() => onBuy({ rent: 0, housing_name: '特斯拉 睡车顶', health: Math.max(10, gameState.health - 10) }, '你把睡袋塞进了车后备箱。虽然每天去健身房洗澡极其硬核，但成功将房租消耗砍到了 $0！')}
                className="flex flex-col text-left p-4 rounded-2xl border border-zinc-700/50 bg-zinc-800/30 hover:bg-zinc-800 hover:border-zinc-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed group col-span-1 sm:col-span-2"
              >
                <div className="font-bold text-zinc-400">【挂壁退租】退租搬进特斯拉睡车顶 (房租归零)</div>
                <div className="text-xs text-zinc-500 mt-1">{isHomeowner ? '已买房，无法退租' : '要求：总资产 < $10w 且当前有房租。健康大幅下降。'}</div>
              </button>
            </div>
          </section>

          {/* Section: Real Estate Investment & Passive Income */}
          <section>
            <div className="flex justify-between items-center mb-3 border-b border-zinc-800 pb-1">
              <h4 className="text-sm font-mono text-zinc-400 uppercase tracking-widest">房产投资与被动现金流 (Rental & Cash Flow)</h4>
              <button
                onClick={() => { onClose(); onTriggerEvent('manage_rental_properties'); }}
                className="text-xs text-amber-400 hover:text-amber-300 font-mono flex items-center gap-1 transition-colors"
              >
                <span>进入房产管理中心</span>
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* ADU / House Hacking */}
              <button
                disabled={!isHomeowner || gameState.has_adu_rented || totalAssets < 1.5}
                onClick={() => onBuy({
                  cash: gameState.cash - 1.5,
                  has_adu_rented: true,
                  rental_income: (gameState.rental_income || 0) + 1.2,
                }, '【ADU 改造出租】你改造了后院独立套间并出租给大厂实习生！每年被动收入 +$1.2w！')}
                className="flex flex-col text-left p-4 rounded-2xl border border-zinc-700/50 bg-zinc-800/30 hover:bg-zinc-800 hover:border-emerald-500/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-zinc-200 group-hover:text-emerald-400 transition-colors">【ADU 出租】自住房独立套间改造</span>
                  <span className="text-[11px] font-mono text-emerald-400 font-bold">+$1.2w/年 租金</span>
                </div>
                <div className="text-xs text-zinc-500 mt-1">
                  {gameState.has_adu_rented 
                    ? '[已完成] 已完成改造并持续收租中' 
                    : isHomeowner 
                      ? '改造费用: $1.5w | 将自住房次卧/后院独立 ADU 挂牌招租' 
                      : '需先拥有一套湾区自住房'}
                </div>
              </button>

              {/* Austin Remote Rental */}
              <button
                disabled={totalAssets < 25 || (gameState.investment_properties || []).includes('Austin 远程独栋屋')}
                onClick={() => onBuy({
                  cash: gameState.cash - 25,
                  rental_income: (gameState.rental_income || 0) + 1.2,
                  investment_properties: [...(gameState.investment_properties || []), 'Austin 远程独栋屋'],
                }, '【外州资产配置】购入德州 Austin 核心科技园区精装独栋屋！每年被动租金净现金流 +$1.2w！')}
                className="flex flex-col text-left p-4 rounded-2xl border border-zinc-700/50 bg-zinc-800/30 hover:bg-zinc-800 hover:border-emerald-500/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-zinc-200 group-hover:text-emerald-400 transition-colors">【外州投资】Austin 远程独栋投资房</span>
                  <span className="text-[11px] font-mono text-emerald-400 font-bold">+$1.2w/年 租金</span>
                </div>
                <div className="text-xs text-zinc-500 mt-1">
                  {(gameState.investment_properties || []).includes('Austin 远程独栋屋')
                    ? '[已持有] 已持有该投资房'
                    : '首付: $25w (支持股票抵扣) | 全美远程托管，无惧科技裁员'}
                </div>
              </button>

              {/* Hayward Single Family Rental */}
              <button
                disabled={totalAssets < 45 || (gameState.investment_properties || []).includes('Hayward 独立投资房')}
                onClick={() => onBuy({
                  cash: gameState.cash - 45,
                  rental_income: (gameState.rental_income || 0) + 2.2,
                  investment_properties: [...(gameState.investment_properties || []), 'Hayward 独立投资房'],
                }, '【湾区核心资产】拿下东湾优质独立屋！坐收湾区刚需码农家庭租金，每年稳健产生 +$2.2w 租金现金流！')}
                className="flex flex-col text-left p-4 rounded-2xl border border-zinc-700/50 bg-zinc-800/30 hover:bg-zinc-800 hover:border-emerald-500/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-zinc-200 group-hover:text-emerald-400 transition-colors">【东湾投资】东湾 Hayward 独栋投资房</span>
                  <span className="text-[11px] font-mono text-emerald-400 font-bold">+$2.2w/年 租金</span>
                </div>
                <div className="text-xs text-zinc-500 mt-1">
                  {(gameState.investment_properties || []).includes('Hayward 独立投资房')
                    ? '[已持有] 已持有该投资房'
                    : '首付: $45w (支持股票抵扣) | 湾区核心通勤圈，抗通胀现金流'}
                </div>
              </button>

              {/* Sunnyvale 4-Plex Commercial / Residential */}
              <button
                disabled={totalAssets < 120 || (gameState.investment_properties || []).includes('Sunnyvale 4-Plex 公寓楼')}
                onClick={() => onBuy({
                  cash: gameState.cash - 120,
                  rental_income: (gameState.rental_income || 0) + 6.0,
                  investment_properties: [...(gameState.investment_properties || []), 'Sunnyvale 4-Plex 公寓楼'],
                  charm: Math.min(maxCharm, (gameState.charm || 10) + 5),
                }, '【加州大地主登顶】拿下 Sunnyvale 核心区 4-Plex 公寓楼！每年躺赚 +$6.0w 净租金流，坐稳湾区大地主！')}
                className="flex flex-col text-left p-4 rounded-2xl border border-zinc-700/50 bg-zinc-800/30 hover:bg-zinc-800 hover:border-amber-400/60 transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-zinc-200 group-hover:text-amber-400 transition-colors">【核心公寓】Sunnyvale 4-Plex 公寓楼</span>
                  <span className="text-[11px] font-mono text-amber-400 font-bold">+$6.0w/年 巨额租金</span>
                </div>
                <div className="text-xs text-zinc-500 mt-1">
                  {(gameState.investment_properties || []).includes('Sunnyvale 4-Plex 公寓楼')
                    ? '[终极地主] 已晋升为硅谷核心大地主'
                    : '首付: $120w (支持股票抵扣) | 4套联排全出租，终极 FIRE 神器'}
                </div>
              </button>

              {/* Instant FIRE Retirement — only when CURRENT total assets clear the
                  CURRENT win threshold. Do not short-circuit on has_reached_initial_fire:
                  a player who opted into a higher FIRE tier ($800w/$1500w) must actually
                  reach that tier, not win at any asset level from a past milestone. */}
              {(totalAssets >= gameState.win_threshold) && (
                <button
                  onClick={() => {
                    onClose();
                    onBuy({ status: 'win' }, `【正式退休】恭喜！你在 ${gameState.age} 岁正式宣布提前退休 (FIRE)！以胜利者姿态结束硅谷打拼！`);
                  }}
                  className="col-span-1 sm:col-span-2 flex justify-between items-center text-left p-4 rounded-2xl border border-amber-500/50 bg-gradient-to-r from-amber-500/20 via-emerald-500/20 to-amber-500/20 hover:from-amber-500/30 hover:to-emerald-500/30 transition-all shadow-lg shadow-amber-500/10 group cursor-pointer animate-in fade-in"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-amber-300 group-hover:text-amber-200 transition-colors text-sm sm:text-base">【提前退休】随时申请 FIRE 退休结算</span>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-400 text-zinc-950 uppercase">已达标</span>
                    </div>
                    <div className="text-xs text-zinc-400 mt-1">你已具备财务自由资质！点击立即登出硅谷内卷，进入生涯荣誉与战报结算。</div>
                  </div>
                  <div className="text-amber-400 font-mono font-bold text-sm shrink-0 pl-2">进入结算 →</div>
                </button>
              )}
            </div>
          </section>

          {/* Section: Vehicles */}
          <section>
            <h4 className="text-sm font-mono text-zinc-400 uppercase tracking-widest mb-3 border-b border-zinc-800 pb-1">出行座驾 (Vehicles)</h4>
            <div className="grid grid-cols-1 gap-3">
              <button
                disabled={totalAssets < 4 || gameState.car === 'model_y' || gameState.car === 'porsche' || gameState.car === 'cybertruck'}
                onClick={() => onBuy({ cash: gameState.cash - 4, car: 'model_y', charm: Math.min(maxCharm, gameState.charm + 4) }, '你提了一台白色的 Model Y。去 Cupertino 买奶茶按半天钥匙开错别人的车门。')}
                className={`flex justify-between items-center text-left p-4 rounded-2xl border transition-all disabled:opacity-40 disabled:cursor-not-allowed group ${
                  gameState.car === 'model_y' 
                    ? 'border-blue-500/80 bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.15)]' 
                    : 'border-zinc-700/50 bg-zinc-800/30 hover:bg-zinc-800'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-zinc-200 group-hover:text-blue-400 transition-colors">【实用座驾】Tesla Model Y</span>
                    {gameState.car === 'model_y' && (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40">已拥有</span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">售价: $4w | 增加社交好感</div>
                </div>
                <div className="text-blue-400/50 text-xl font-black">Y</div>
              </button>

              <button
                disabled={totalAssets < (gameState.car === 'porsche' ? 3 : gameState.car === 'model_y' ? 7 : 9) || gameState.car === 'cybertruck'}
                onClick={() => {
                  const tradeInCredit = gameState.car === 'porsche' ? 6 : gameState.car === 'model_y' ? 2 : 0;
                  onBuy({ 
                    cash: gameState.cash - (9 - tradeInCredit), 
                    car: 'cybertruck', 
                    imageUrl: 'images/cybertruck.jpg',
                    charm: Math.min(maxCharm, gameState.charm + 8), 
                    leetcode: gameState.leetcode + 5 
                  }, `置换抵扣了 $${tradeInCredit}w 后，你换上了多边形赛博皮卡！开在 237 公路上所有人都以为你是刚拿到 A 轮的 AI Founder！`);
                }}
                className={`flex justify-between items-center text-left p-4 rounded-2xl border transition-all disabled:opacity-40 disabled:cursor-not-allowed group ${
                  gameState.car === 'cybertruck' 
                    ? 'border-amber-400/80 bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.15)]' 
                    : 'border-zinc-700/50 bg-zinc-800/30 hover:bg-zinc-800'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-zinc-200 group-hover:text-zinc-300 transition-colors">【硬核皮卡】Tesla Cybertruck</span>
                    {gameState.car === 'cybertruck' && (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">已拥有</span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">售价: $9w (支持旧车抵扣) | LeetCode +5，极大幅增强气场</div>
                </div>
                <div className="text-zinc-500 text-xl font-black">CT</div>
              </button>

              <button
                disabled={totalAssets < (gameState.car === 'cybertruck' ? 7 : gameState.car === 'model_y' ? 10 : 12) || gameState.car === 'porsche'}
                onClick={() => {
                  const tradeInCredit = gameState.car === 'cybertruck' ? 5 : gameState.car === 'model_y' ? 2 : 0;
                  onBuy({ 
                    cash: gameState.cash - (12 - tradeInCredit), 
                    car: 'porsche', 
                    charm: Math.min(maxCharm, gameState.charm + 5), 
                    health: Math.min(100, gameState.health + 10) 
                  }, `抵扣了 $${tradeInCredit}w 后，开上了全新保时捷！感觉自己脱离了普通码农范畴，CMB 约会匹配率飙升！`);
                }}
                className={`flex justify-between items-center text-left p-4 rounded-2xl border transition-all disabled:opacity-40 disabled:cursor-not-allowed group ${
                  gameState.car === 'porsche' 
                    ? 'border-red-500/80 bg-red-500/10 shadow-[0_0_15px_rgba(239,68,68,0.15)]' 
                    : 'border-zinc-700/50 bg-zinc-800/30 hover:bg-zinc-800'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-zinc-200 group-hover:text-red-400 transition-colors">【豪华超跑】Porsche 911 / Taycan</span>
                    {gameState.car === 'porsche' && (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/40">已拥有</span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">售价: $12w (支持旧车抵扣) | 健康 +10，极大提升社交吸引力</div>
                </div>
                <div className="text-red-900/50 text-xl font-black">P</div>
              </button>
            </div>
          </section>

          {/* Section: Lifestyle & Services */}
          <section>
            <h4 className="text-sm font-mono text-zinc-400 uppercase tracking-widest mb-3 border-b border-zinc-800 pb-1">生活与服务 (Lifestyle)</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                disabled={totalAssets < 3 || gameState.last_beauty_year === gameState.year}
                onClick={() => onBuy({ cash: gameState.cash - 3, health: Math.min(100, gameState.health + 8), charm: Math.min(maxCharm, gameState.charm + 2), last_beauty_year: gameState.year }, '做全脸热玛吉，请硅谷最贵的私教。颜值与身体状态有所提升！')}
                className="flex flex-col text-left p-4 rounded-2xl border border-zinc-700/50 bg-zinc-800/30 hover:bg-zinc-800 hover:border-pink-500/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
              >
                <div className="font-bold text-zinc-200 group-hover:text-pink-400 transition-colors">【医美私教】医美保养与高端私教</div>
                <div className="text-xs text-zinc-500 mt-1">
                  {gameState.last_beauty_year === gameState.year 
                    ? '本年度已保养 (每年限 1 次)' 
                    : '花费: $3w | 健康 +8, 容光焕发 (每年限 1 次)'}
                </div>
              </button>

              <button
                disabled={totalAssets < 5 || gameState.charm < 8}
                onClick={() => {
                  const success = gameRandom() > 0.5; // seeded PRNG for reproducibility (was Math.random)
                  if (success) {
                    if (gameState.laid_off || gameState.job_type === 'unemployed') {
                      onBuy({ 
                        cash: gameState.cash - 5, 
                        job_type: 'startup', 
                        company: 'star_startup', 
                        laid_off: false, 
                        tc: 20, 
                        charm: Math.min(maxCharm, gameState.charm + 2) 
                      }, '你在游艇派对上认识了顶级风投大佬，对方直接推荐你入职他们领投的明星独角兽 (TC $20w)！成功重返职场！');
                    } else {
                      onBuy({ 
                        cash: gameState.cash - 5, 
                        tc: gameState.tc + 5, 
                        charm: Math.min(maxCharm, gameState.charm + 2) 
                      }, '你在游艇派对上认识了顶级风投大佬，对方一高兴直接把你塞进了他们刚投的明星公司，总包大涨！');
                    }
                  } else {
                    onBuy({ cash: gameState.cash - 5, health: Math.max(0, gameState.health - 10) }, '去游艇派对当了气氛组，钱花了，酒喝多了，什么实质性人脉都没捞到。');
                  }
                }}
                className="flex flex-col text-left p-4 rounded-2xl border border-zinc-700/50 bg-zinc-800/30 hover:bg-zinc-800 hover:border-purple-500/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
              >
                <div className="font-bold text-zinc-200 group-hover:text-purple-400 transition-colors">【游艇社交】高端游艇派对人脉局</div>
                <div className="text-xs text-zinc-500 mt-1">入场费: $5w | 高风险高回报：可能结识大佬涨 TC，也可能白扔钱扣健康。</div>
              </button>

              <button
                disabled={totalAssets < 0.5 || gameState.has_dog}
                onClick={() => onBuy({ cash: gameState.cash - 0.5, has_pet: true, has_dog: true, pet_name: (gameState.pet_name ? `${gameState.pet_name}与日系柴犬` : '日系柴犬'), charm: Math.min(maxCharm, gameState.charm + 3), health: Math.min(100, gameState.health + 10) }, '在南湾救助站领养了一只可爱的柴犬！周末遛狗心情大好，每年陪伴治愈回血 (健康 +2，年开销 $0.3w)！')}
                className={`flex flex-col text-left p-4 rounded-2xl border transition-all disabled:opacity-40 disabled:cursor-not-allowed group ${
                  gameState.has_dog 
                    ? 'border-amber-500/80 bg-amber-500/10' 
                    : 'border-zinc-700/50 bg-zinc-800/30 hover:bg-zinc-800 hover:border-amber-500/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold text-zinc-200 group-hover:text-amber-400 transition-colors">【领养萌犬】日系柴犬 (陪伴治愈)</div>
                  {gameState.has_dog && (
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">已领养</span>
                  )}
                </div>
                <div className="text-xs text-zinc-500 mt-1">{gameState.has_dog ? '已领养柴犬 | 每年健康 +2, 每年开销 $0.3w' : '花费: $0.5w | 初始健康 +10, 每年健康 +2, 每年开销 $0.3w'}</div>
              </button>

              <button
                disabled={totalAssets < 0.5 || gameState.has_cat}
                onClick={() => onBuy({ cash: gameState.cash - 0.5, has_pet: true, has_cat: true, pet_name: (gameState.pet_name ? `${gameState.pet_name}与布偶猫` : '布偶猫'), charm: Math.min(maxCharm, gameState.charm + 3), health: Math.min(100, gameState.health + 10) }, '在收容所带回了一只黏人的布偶猫！从此再也不怕湾区的深夜孤独了，每年陪伴治愈回血 (健康 +2，年开销 $0.3w)！')}
                className={`flex flex-col text-left p-4 rounded-2xl border transition-all disabled:opacity-40 disabled:cursor-not-allowed group ${
                  gameState.has_cat 
                    ? 'border-blue-500/80 bg-blue-500/10' 
                    : 'border-zinc-700/50 bg-zinc-800/30 hover:bg-zinc-800 hover:border-blue-500/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold text-zinc-200 group-hover:text-blue-400 transition-colors">【领养萌猫】黏人布偶猫 (陪伴治愈)</div>
                  {gameState.has_cat && (
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40">已领养</span>
                  )}
                </div>
                <div className="text-xs text-zinc-500 mt-1">{gameState.has_cat ? '已领养布偶猫 | 每年健康 +2, 每年开销 $0.3w' : '花费: $0.5w | 初始健康 +10, 每年健康 +2, 每年开销 $0.3w'}</div>
              </button>
            </div>
          </section>

        </div>

        {/* Sticky Footer for Easy Exit */}
        <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-950/90 backdrop-blur-xl flex justify-between items-center sticky bottom-0 z-10 shrink-0">
          <div className="text-xs text-zinc-400 font-mono">
            随时退出 · 资产保持不变
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-bold text-sm transition-all border border-zinc-700 shadow-md active:scale-95 cursor-pointer"
          >
            暂不购物，退出商城
          </button>
        </div>
      </div>
    </div>
  );
};
