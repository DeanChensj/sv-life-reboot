import React from 'react';
import type { GameState } from '../types';

interface CharacterProfileModalProps {
  gameState: GameState;
  onConfirm: () => void;
}

export const CharacterProfileModal: React.FC<CharacterProfileModalProps> = ({ gameState, onConfirm }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-950/85 backdrop-blur-2xl animate-in fade-in duration-300 overflow-y-auto">
      <div className="relative w-full max-w-md bg-zinc-900/95 border border-zinc-700/80 rounded-3xl p-5 sm:p-8 shadow-2xl overflow-hidden backdrop-blur-2xl max-h-[90vh] overflow-y-auto">
        {/* Decorative Background Ambient Lights */}
        <div className="absolute top-0 right-0 w-56 h-56 bg-emerald-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-56 h-56 bg-indigo-500/10 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none" />

        {/* Badge Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-6 relative z-10">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-mono font-bold tracking-[0.2em] text-emerald-400 uppercase">
              CANDIDATE PASS // 人生重开准考证
            </span>
          </div>
          <span className="text-xs font-mono text-zinc-500 font-medium">#SV-2026-X</span>
        </div>

        {/* Profile Card Header */}
        <div className="flex items-center gap-4 mb-6 relative z-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-zinc-900 to-indigo-500/20 border border-emerald-500/30 flex items-center justify-center text-2xl shadow-inner shrink-0 text-emerald-300 font-mono font-black">
            SV
          </div>
          <div>
            <h3 className="text-2xl font-black text-zinc-100 tracking-tight">人生重开新星</h3>
            <p className="text-xs font-mono text-emerald-400 mt-0.5 font-semibold">
              {gameState.housing_name || '大学宿舍'} · 第 1 年入学档案
            </p>
          </div>
        </div>

        {/* Initial Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6 font-mono text-xs relative z-10">
          <div className="bg-zinc-950/80 p-3.5 rounded-2xl border border-zinc-800/80">
            <div className="text-zinc-500 uppercase text-[10px] tracking-wider font-semibold">初始启动资金</div>
            <div className="text-xl font-black text-emerald-400 mt-0.5 tabular-nums">${gameState.cash.toFixed(1)}w</div>
          </div>

          <div className="bg-zinc-950/80 p-3.5 rounded-2xl border border-zinc-800/80">
            <div className="text-zinc-500 uppercase text-[10px] tracking-wider font-semibold">LeetCode 初始实力</div>
            <div className="text-xl font-black text-amber-300 mt-0.5 tabular-nums">{gameState.leetcode} 题</div>
          </div>

          <div className="bg-zinc-950/80 p-3.5 rounded-2xl border border-zinc-800/80">
            <div className="text-zinc-500 uppercase text-[10px] tracking-wider font-semibold">初始健康值</div>
            <div className="text-xl font-black text-rose-400 mt-0.5 tabular-nums">{gameState.health} / 100</div>
          </div>

          <div className="bg-zinc-950/80 p-3.5 rounded-2xl border border-zinc-800/80">
            <div className="text-zinc-500 uppercase text-[10px] tracking-wider font-semibold">签证身份</div>
            <div className="text-base font-bold text-indigo-300 mt-1">{gameState.visa}</div>
          </div>
        </div>

        {/* Initial Background Story */}
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4 mb-6 text-xs leading-relaxed text-zinc-300 relative z-10">
          <span className="font-bold text-emerald-400 block mb-1 font-mono uppercase tracking-wider"> 简历档案评语：</span>
          {gameState.message || (gameState.has_us_degree 
            ? '你带着满腔期待与梦想，开启了属于你的大学求学生涯！' 
            : '你在大学校园入学，准备积累扎实的计算机能力，开启属于你的人生篇章！')}
        </div>

        {/* Confirm Button */}
        <button
          onClick={onConfirm}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-zinc-950 font-extrabold text-base transition-all duration-200 shadow-lg shadow-emerald-500/20 active:scale-[0.985] cursor-pointer flex items-center justify-center gap-2 relative z-10"
        >
          <span>开启人生求学篇章 </span>
        </button>
      </div>
    </div>
  );
};
