import React from 'react';
import type { GameState } from '../types';

interface CharacterProfileModalProps {
  gameState: GameState;
  onConfirm: () => void;
}

export const CharacterProfileModal: React.FC<CharacterProfileModalProps> = ({ gameState, onConfirm }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden">
        {/* Decorative Background Effects */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl -ml-16 -mb-16 pointer-events-none" />

        {/* Badge Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-6">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-mono font-bold tracking-widest text-emerald-400 uppercase">
              SV CANDIDATE PASS // 硅谷打工人准考证
            </span>
          </div>
          <span className="text-xs font-mono text-zinc-500">ID: #{Math.floor(Math.random() * 89999 + 10000)}</span>
        </div>

        {/* Profile Card Header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-indigo-500/20 border border-emerald-500/30 flex items-center justify-center text-3xl shadow-inner shrink-0">
            {gameState.is_phd ? '🎓' : gameState.school === 'cmu' ? '💻' : '🎒'}
          </div>
          <div>
            <h3 className="text-xl font-bold text-zinc-100 tracking-tight">硅谷新星玩家</h3>
            <p className="text-xs font-mono text-emerald-400 mt-0.5">
              {gameState.housing_name || '大学宿舍'} · {gameState.year} 年底入学
            </p>
          </div>
        </div>

        {/* Initial Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6 font-mono text-xs">
          <div className="bg-zinc-950/80 p-3 rounded-xl border border-zinc-800">
            <div className="text-zinc-500 uppercase text-[10px]">初始启动资金</div>
            <div className="text-lg font-bold text-emerald-400 mt-0.5">${gameState.cash.toFixed(1)}w</div>
          </div>

          <div className="bg-zinc-950/80 p-3 rounded-xl border border-zinc-800">
            <div className="text-zinc-500 uppercase text-[10px]">LeetCode 初始实力</div>
            <div className="text-lg font-bold text-amber-300 mt-0.5">{gameState.leetcode} 题</div>
          </div>

          <div className="bg-zinc-950/80 p-3 rounded-xl border border-zinc-800">
            <div className="text-zinc-500 uppercase text-[10px]">初始健康值</div>
            <div className="text-lg font-bold text-rose-400 mt-0.5">{gameState.health} / 100</div>
          </div>

          <div className="bg-zinc-950/80 p-3 rounded-xl border border-zinc-800">
            <div className="text-zinc-500 uppercase text-[10px]">签证身份</div>
            <div className="text-lg font-bold text-indigo-300 mt-0.5">{gameState.visa}</div>
          </div>
        </div>

        {/* Initial Background Story */}
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 mb-6 text-xs leading-relaxed text-zinc-300">
          <span className="font-bold text-emerald-400 block mb-1">📋 简历档案评语：</span>
          {gameState.message || '你带着满腔抱负飞往旧金山湾区，开启属于你的硅谷传奇！'}
        </div>

        {/* Confirm Button */}
        <button
          onClick={onConfirm}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-zinc-950 font-bold text-base transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>开启硅谷打工生涯 🚀</span>
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      </div>
    </div>
  );
};
