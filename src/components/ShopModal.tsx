import React from 'react';
import type { GameState } from '../types';

interface ShopModalProps {
  gameState: GameState;
  onClose: () => void;
  onBuy: (effect: Partial<GameState>, message: string) => void;
  onTriggerEvent: (eventId: string) => void;
}

export const ShopModal: React.FC<ShopModalProps> = ({ gameState, onClose, onBuy, onTriggerEvent }) => {
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
          >
            
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
          
          {/* Section: Housing */}
          <section>
            <h4 className="text-sm font-mono text-zinc-400 uppercase tracking-widest mb-3 border-b border-zinc-800 pb-1">置业与居住 (Housing)</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                disabled={gameState.cash < 40 || ['Sunnyvale 老破小', 'North San Jose 联排', 'Fremont 学区房'].includes(gameState.housing_name || '')}
                onClick={() => { onClose(); onTriggerEvent('buy_house'); }}
                className="flex flex-col text-left p-4 rounded-2xl border border-zinc-700/50 bg-zinc-800/30 hover:bg-zinc-800 hover:border-amber-500/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed group relative overflow-hidden"
              >
                <div className="font-bold text-zinc-200 group-hover:text-amber-400 transition-colors">参加抢房大战 (首付 $40w+)</div>
                <div className="text-xs text-zinc-500 mt-1">{['Sunnyvale 老破小', 'North San Jose 联排', 'Fremont 学区房'].includes(gameState.housing_name || '') ? '已拥有一套房产' : '进入买房事件流，挑选湾区房产'}</div>
              </button>
              
              <button
                disabled={!gameState.has_housing || ['Sunnyvale 老破小', 'North San Jose 联排', 'Fremont 学区房'].includes(gameState.housing_name || '')}
                onClick={() => { onClose(); onTriggerEvent('change_rental'); }}
                className="flex flex-col text-left p-4 rounded-2xl border border-zinc-700/50 bg-zinc-800/30 hover:bg-zinc-800 hover:border-emerald-500/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
              >
                <div className="font-bold text-zinc-200 group-hover:text-emerald-400 transition-colors">搬家与换租</div>
                <div className="text-xs text-zinc-500 mt-1">{['Sunnyvale 老破小', 'North San Jose 联排', 'Fremont 学区房'].includes(gameState.housing_name || '') ? '已买房，无法换租' : '改变你的租房环境'}</div>
              </button>

              <button
                disabled={gameState.cash >= 10 || gameState.rent <= 0 || ['Sunnyvale 老破小', 'North San Jose 联排', 'Fremont 学区房'].includes(gameState.housing_name || '')}
                onClick={() => onBuy({ rent: 0, housing_name: '特斯拉 睡车顶', health: Math.max(10, gameState.health - 10) }, '你把睡袋塞进了车后备箱。虽然每天去健身房洗澡极其硬核，但成功将房租消耗砍到了 $0！')}
                className="flex flex-col text-left p-4 rounded-2xl border border-zinc-700/50 bg-zinc-800/30 hover:bg-zinc-800 hover:border-zinc-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed group col-span-1 sm:col-span-2"
              >
                <div className="font-bold text-zinc-400">挂壁退租睡车顶 (房租归零)</div>
                <div className="text-xs text-zinc-500 mt-1">{['Sunnyvale 老破小', 'North San Jose 联排', 'Fremont 学区房'].includes(gameState.housing_name || '') ? '已买房，无法退租' : '要求：现金 < $10w 且当前有房租。健康大幅下降。'}</div>
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
                className="flex justify-between items-center text-left p-4 rounded-2xl border border-zinc-700/50 bg-zinc-800/30 hover:bg-zinc-800 transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
              >
                <div>
                  <div className="font-bold text-zinc-200 group-hover:text-blue-400 transition-colors">Tesla Model Y</div>
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
                className="flex justify-between items-center text-left p-4 rounded-2xl border border-zinc-700/50 bg-zinc-800/30 hover:bg-zinc-800 transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
              >
                <div>
                  <div className="font-bold text-zinc-200 group-hover:text-zinc-300 transition-colors">Tesla Cybertruck</div>
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
                className="flex justify-between items-center text-left p-4 rounded-2xl border border-zinc-700/50 bg-zinc-800/30 hover:bg-zinc-800 transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
              >
                <div>
                  <div className="font-bold text-zinc-200 group-hover:text-red-400 transition-colors">Porsche 911 / Taycan</div>
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
                disabled={gameState.cash < 3}
                onClick={() => onBuy({ cash: gameState.cash - 3, health: Math.min(100, gameState.health + 20), charm: Math.min(25, gameState.charm + 2) }, '做全脸热玛吉，请硅谷最贵的私教。颜值和健康大幅飙升！')}
                className="flex flex-col text-left p-4 rounded-2xl border border-zinc-700/50 bg-zinc-800/30 hover:bg-zinc-800 hover:border-pink-500/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
              >
                <div className="font-bold text-zinc-200 group-hover:text-pink-400 transition-colors">医美与高端私教</div>
                <div className="text-xs text-zinc-500 mt-1">花费: $3w | 健康 +20, 容光焕发</div>
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
                disabled={gameState.cash < 0.5 || gameState.has_pet}
                onClick={() => onBuy({ cash: gameState.cash - 0.5, has_pet: true, pet_name: '日系柴犬', charm: Math.min(25, gameState.charm + 3), health: Math.min(100, gameState.health + 10) }, '在南湾救助站领养了一只可爱的柴犬！在 CMB 个人主页挂照片后，相亲匹配成功率显著上升！')}
                className="flex flex-col text-left p-4 rounded-2xl border border-zinc-700/50 bg-zinc-800/30 hover:bg-zinc-800 hover:border-amber-500/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
              >
                <div className="font-bold text-zinc-200 group-hover:text-amber-400 transition-colors">领养湾区毛孩子 (柴犬/布偶猫)</div>
                <div className="text-xs text-zinc-500 mt-1">{gameState.has_pet ? '已领养毛孩子' : '花费: $0.5w | 魅力 +3, 健康 +10, 约会/相亲成功率加成'}</div>
              </button>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
};
