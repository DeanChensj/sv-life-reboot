import React, { useRef } from 'react';
import { useFocusTrap } from '../utils/useFocusTrap';

interface WelcomeModalProps {
  onStart: () => void;
  onOpenDynasty?: () => void;
  generation?: number;
}

export const WelcomeModal: React.FC<WelcomeModalProps> = ({ onStart, onOpenDynasty, generation = 1 }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef);
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-zinc-950/95 backdrop-blur-3xl animate-in fade-in duration-500 p-3 sm:p-6 flex items-center justify-center min-h-screen">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="welcome-modal-title" tabIndex={-1} className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-700/80 rounded-3xl p-5 sm:p-10 shadow-2xl overflow-y-auto max-h-[88vh] flex flex-col items-center text-center my-auto border-emerald-500/20">
        
        {/* Top Decorative Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-emerald-500/10 rounded-full blur-[60px] pointer-events-none" />

        {/* Title Section */}
        <h1 id="welcome-modal-title" className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white mb-2 sm:mb-4 mt-1 sm:mt-4">
          硅谷人生重启模拟器
        </h1>
        <p className="text-zinc-400 text-xs sm:text-base leading-relaxed max-w-lg mb-6 sm:mb-8">
          欢迎转生至「地球 Online」最硬核的副本——硅谷。这里有年少成名、百万包裹的造富神话，也潜伏着裁员寒冬与签证断供的至暗时刻。
        </p>

        {/* Rules Section */}
        <div className="w-full text-left space-y-3 sm:space-y-5 mb-6 sm:mb-10">
          
          <div className="flex gap-3 sm:gap-4 p-3.5 sm:p-5 rounded-2xl bg-zinc-800/40 border border-zinc-700/50 hover:border-emerald-500/30 transition-colors">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20 text-emerald-400">
              <svg className="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
            </div>
            <div>
              <h3 className="text-emerald-300 font-bold text-base sm:text-lg mb-0.5 sm:mb-1">终极目标：财务自由 (FIRE)</h3>
              <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed">
                努力工作、投资或创业，不断积累你的现金财富。当你的资产达到所在阶层的门槛时，即可宣告通关，提前退休！
              </p>
            </div>
          </div>

          <div className="flex gap-3 sm:gap-4 p-3.5 sm:p-5 rounded-2xl bg-zinc-800/40 border border-zinc-700/50 hover:border-rose-500/30 transition-colors">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-rose-500/10 flex items-center justify-center shrink-0 border border-rose-500/20 text-rose-400">
              <svg className="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
            </div>
            <div>
              <h3 className="text-rose-300 font-bold text-base sm:text-lg mb-0.5 sm:mb-1">生存危机：过劳与破产</h3>
              <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed">
                你的精力是有限的，<strong className="text-zinc-200">健康值降为 0 会导致过劳猝死</strong>；而硅谷高昂的物价也是无形的杀手，<strong className="text-zinc-200">现金为负将面临破产驱逐</strong>。
              </p>
            </div>
          </div>

          <div className="flex gap-3 sm:gap-4 p-3.5 sm:p-5 rounded-2xl bg-zinc-800/40 border border-zinc-700/50 hover:border-amber-500/30 transition-colors">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0 border border-amber-500/20 text-amber-400">
              <svg className="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <div>
              <h3 className="text-amber-300 font-bold text-base sm:text-lg mb-0.5 sm:mb-1">隐形枷锁：签证与绿卡</h3>
              <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed">
                H-1B 抽签与绿卡排期，是悬在第一代移民头顶的达摩克利斯之剑。只有尽早上岸，才能在无情的 PIP 与裁员潮中拥有喘息之机。
              </p>
            </div>
          </div>

        </div>

        {/* Start Actions */}
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-4/5 justify-center mb-1">
          <button
            onClick={onStart}
            className="flex-1 py-3.5 sm:py-4 rounded-xl font-black text-base sm:text-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 transition-all active:scale-95 shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <svg className="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            抽取初始天赋 (第 {generation} 代)
          </button>
          {onOpenDynasty && (
            <button
              onClick={onOpenDynasty}
              className="py-3.5 sm:py-4 px-5 rounded-xl font-bold text-sm bg-zinc-800 hover:bg-zinc-700 text-amber-300 border border-amber-500/30 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer shrink-0 shadow-md"
            >
              <span>🏛️ 宗族基因库</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
