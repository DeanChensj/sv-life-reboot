import React from 'react';
import type { GameState } from '../types';

interface ShopModalProps {
  gameState: GameState;
  onClose: () => void;
  onBuy: (effect: Partial<GameState>, message: string) => void;
  onTriggerEvent: (eventId: string) => void;
}

export const ShopModal: React.FC<ShopModalProps> = ({ gameState, onClose, onBuy, onTriggerEvent }) => {
  const isHomeowner = ['Atherton 顶级豪宅', 'Sunnyvale 老破小', 'North San Jose 联排', 'Fremont 学区房'].includes(gameState.housing_name || '');

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center items-center bg-zinc-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-700/50 rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col slide-in-from-bottom-8 sm:slide-in-from-bottom-0 sm:zoom-in-95">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800/80 flex justify-between items-center bg-zinc-900/50 sticky top-0 backdrop-blur-xl z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
            </div>
            <div>
              <h3 className="font-black text-lg text-zinc-100">硅谷资产与消费商城</h3>
              <p className="text-xs text-amber-400 font-mono tracking-wider font-semibold">CASH: ${gameState.cash.toFixed(1)}w</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
            title="关闭商城"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
          
          {/* Section: Housing */}
          <section>
            <h4 className="text-sm font-mono text-zinc-400 uppercase tracking-widest mb-3 border-b border-zinc-800 pb-1">置业与居住 (Housing)</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                disabled={gameState.cash < 40 || isHomeowner}
                onClick={() => { onClose(); onTriggerEvent('buy_house'); }}
                className="flex flex-col text-left p-4 rounded-2xl border border-zinc-700/50 bg-zinc-800/30 hover:bg-zinc-800 hover:border-amber-500/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed group relative overflow-hidden"
              >
                <div className="font-bold text-zinc-200 group-hover:text-amber-400 transition-colors">参加抢房大战 (首付 $40w+)</div>
                <div className="text-xs text-zinc-500 mt-1">{isHomeowner ? '已拥有一套房产' : '进入买房事件流，挑选湾区房产'}</div>
              </button>
              
              <button
                disabled={!gameState.has_housing || isHomeowner}
                onClick={() => { onClose(); onTriggerEvent('change_rental'); }}
                className="flex flex-col text-left p-4 rounded-2xl border border-zinc-700/50 bg-zinc-800/30 hover:bg-zinc-800 hover:border-emerald-500/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
              >
                <div className="font-bold text-zinc-200 group-hover:text-emerald-400 transition-colors">搬家与换租</div>
                <div className="text-xs text-zinc-500 mt-1">{isHomeowner ? '已买房，无法换租' : '改变你的租房环境'}</div>
              </button>

              <button
                disabled={gameState.cash >= 10 || gameState.rent <= 0 || isHomeowner}
                onClick={() => onBuy({ rent: 0, housing_name: '特斯拉 睡车顶', health: Math.max(10, gameState.health - 10) }, '你把睡袋塞进了车后备箱。虽然每天去健身房洗澡极其硬核，但成功将房租消耗砍到了 $0！')}
                className="flex flex-col text-left p-4 rounded-2xl border border-zinc-700/50 bg-zinc-800/30 hover:bg-zinc-800 hover:border-zinc-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed group col-span-1 sm:col-span-2"
              >
                <div className="font-bold text-zinc-400">挂壁退租睡车顶 (房租归零)</div>
                <div className="text-xs text-zinc-500 mt-1">{isHomeowner ? '已买房，无法退租' : '要求：现金 < $10w 且当前有房租。健康大幅下降。'}</div>
              </button>
            </div>
          </section>

          {/* Section: Vehicles */}
          <section>
            <h4 className="text-sm font-mono text-zinc-400 uppercase tracking-widest mb-3 border-b border-zinc-800 pb-1">出行座驾 (Vehicles)</h4>
            <div className="grid grid-cols-1 gap-3">
              <button
                disabled={gameState.cash < 4 || gameState.car === 'model_y' || gameState.car === 'porsche' || gameState.car === 'cybertruck'}
                onClick={() => onBuy({ cash: gameState.cash - 4, car: 'model_y', charm: gameState.charm + 4 }, '你提了一台白色的 Model Y。去 Cupertino 买奶茶按半天钥匙开错别人的车门。')}
                className={`flex justify-between items-center text-left p-4 rounded-2xl border transition-all disabled:opacity-40 disabled:cursor-not-allowed group ${
                  gameState.car === 'model_y' 
                    ? 'border-blue-500/80 bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.15)]' 
                    : 'border-zinc-700/50 bg-zinc-800/30 hover:bg-zinc-800'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-zinc-200 group-hover:text-blue-400 transition-colors">Tesla Model Y</span>
                    {gameState.car === 'model_y' && (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40">已拥有</span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">售价: $4w | 增加社交好感</div>
                </div>
                <div className="text-blue-400/50 text-xl font-black">Y</div>
              </button>

              <button
                disabled={gameState.cash < (gameState.car === 'porsche' ? 3 : gameState.car === 'model_y' ? 7 : 9) || gameState.car === 'cybertruck'}
                onClick={() => {
                  const tradeInCredit = gameState.car === 'porsche' ? 6 : gameState.car === 'model_y' ? 2 : 0;
                  onBuy({ 
                    cash: gameState.cash - (9 - tradeInCredit), 
                    car: 'cybertruck', 
                    imageUrl: 'images/cybertruck.jpg',
                    charm: Math.min(25, gameState.charm + 8), 
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
                    <span className="font-bold text-zinc-200 group-hover:text-zinc-300 transition-colors">Tesla Cybertruck</span>
                    {gameState.car === 'cybertruck' && (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">已拥有</span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">售价: $9w (支持旧车抵扣) | LeetCode +5，极大幅增强气场</div>
                </div>
                <div className="text-zinc-500 text-xl font-black">CT</div>
              </button>

              <button
                disabled={gameState.cash < (gameState.car === 'cybertruck' ? 7 : gameState.car === 'model_y' ? 10 : 12) || gameState.car === 'porsche'}
                onClick={() => {
                  const tradeInCredit = gameState.car === 'cybertruck' ? 5 : gameState.car === 'model_y' ? 2 : 0;
                  onBuy({ 
                    cash: gameState.cash - (12 - tradeInCredit), 
                    car: 'porsche', 
                    charm: Math.min(25, gameState.charm + 5), 
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
                    <span className="font-bold text-zinc-200 group-hover:text-red-400 transition-colors">Porsche 911 / Taycan</span>
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
                disabled={gameState.cash < 3 || gameState.last_beauty_year === gameState.year}
                onClick={() => onBuy({ cash: gameState.cash - 3, health: Math.min(100, gameState.health + 8), charm: Math.min(25, gameState.charm + 2), last_beauty_year: gameState.year }, '做全脸热玛吉，请硅谷最贵的私教。颜值与身体状态有所提升！')}
                className="flex flex-col text-left p-4 rounded-2xl border border-zinc-700/50 bg-zinc-800/30 hover:bg-zinc-800 hover:border-pink-500/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
              >
                <div className="font-bold text-zinc-200 group-hover:text-pink-400 transition-colors">医美与高端私教</div>
                <div className="text-xs text-zinc-500 mt-1">
                  {gameState.last_beauty_year === gameState.year 
                    ? '本年度已保养 (每年限 1 次)' 
                    : '花费: $3w | 健康 +8, 容光焕发 (每年限 1 次)'}
                </div>
              </button>

              <button
                disabled={gameState.cash < 5 || gameState.charm < 8}
                onClick={() => {
                  const success = Math.random() > 0.5;
                  if (success) onBuy({ cash: gameState.cash - 5, tc: gameState.tc + 5, charm: gameState.charm + 2 }, '你在游艇派对上认识了顶级风投大佬，对方一高兴直接把你塞进了他们刚投的明星公司，总包大涨！');
                  else onBuy({ cash: gameState.cash - 5, health: gameState.health - 10 }, '去游艇派对当了气氛组，钱花了，酒喝多了，什么实质性人脉都没捞到。');
                }}
                className="flex flex-col text-left p-4 rounded-2xl border border-zinc-700/50 bg-zinc-800/30 hover:bg-zinc-800 hover:border-purple-500/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
              >
                <div className="font-bold text-zinc-200 group-hover:text-purple-400 transition-colors">游艇高端局 (需要一定社交资质)</div>
                <div className="text-xs text-zinc-500 mt-1">入场费: $5w | 高风险高回报：可能结识大佬涨 TC，也可能白扔钱扣健康。</div>
              </button>

              <button
                disabled={gameState.cash < 0.5 || gameState.has_dog}
                onClick={() => onBuy({ cash: gameState.cash - 0.5, has_pet: true, has_dog: true, pet_name: (gameState.pet_name ? `${gameState.pet_name}与日系柴犬` : '日系柴犬'), charm: Math.min(25, gameState.charm + 3), health: Math.min(100, gameState.health + 10) }, '在南湾救助站领养了一只可爱的柴犬！在 CMB 个人主页挂照片后，相亲匹配成功率显著上升！')}
                className={`flex flex-col text-left p-4 rounded-2xl border transition-all disabled:opacity-40 disabled:cursor-not-allowed group ${
                  gameState.has_dog 
                    ? 'border-amber-500/80 bg-amber-500/10' 
                    : 'border-zinc-700/50 bg-zinc-800/30 hover:bg-zinc-800 hover:border-amber-500/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold text-zinc-200 group-hover:text-amber-400 transition-colors">领养一只小狗 (日系柴犬)</div>
                  {gameState.has_dog && (
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">已领养</span>
                  )}
                </div>
                <div className="text-xs text-zinc-500 mt-1">{gameState.has_dog ? '已领养柴犬' : '花费: $0.5w | 健康 +10, 约会/相亲成功率加成'}</div>
              </button>

              <button
                disabled={gameState.cash < 0.5 || gameState.has_cat}
                onClick={() => onBuy({ cash: gameState.cash - 0.5, has_pet: true, has_cat: true, pet_name: (gameState.pet_name ? `${gameState.pet_name}与布偶猫` : '布偶猫'), charm: Math.min(25, gameState.charm + 3), health: Math.min(100, gameState.health + 10) }, '在收容所带回了一只黏人的布偶猫！从此再也不怕湾区的深夜孤独了。')}
                className={`flex flex-col text-left p-4 rounded-2xl border transition-all disabled:opacity-40 disabled:cursor-not-allowed group ${
                  gameState.has_cat 
                    ? 'border-blue-500/80 bg-blue-500/10' 
                    : 'border-zinc-700/50 bg-zinc-800/30 hover:bg-zinc-800 hover:border-blue-500/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold text-zinc-200 group-hover:text-blue-400 transition-colors">领养一只小猫 (布偶猫)</div>
                  {gameState.has_cat && (
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40">已领养</span>
                  )}
                </div>
                <div className="text-xs text-zinc-500 mt-1">{gameState.has_cat ? '已领养布偶猫' : '花费: $0.5w | 健康 +10, 约会/相亲成功率加成'}</div>
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
