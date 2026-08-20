import React, { useRef, useState, useEffect } from 'react';
import { useFocusTrap } from '../utils/useFocusTrap';
import { getDynastyState, unlockDynastyPerk, DYNASTY_PERKS } from '../utils/dynastyManager';
import type { DynastyState } from '../types';

interface DynastyModalProps {
  onClose: () => void;
  onStateChange?: () => void;
}

export const DynastyModal: React.FC<DynastyModalProps> = ({ onClose, onStateChange }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef);

  const [dynasty, setDynasty] = useState<DynastyState>(getDynastyState);
  const [activeTab, setActiveTab] = useState<'perks' | 'ancestors'>('perks');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  useEffect(() => {
    setDynasty(getDynastyState());
  }, []);

  const handleUnlockPerk = (perkId: string) => {
    const res = unlockDynastyPerk(perkId);
    if (res.success && res.updatedDynasty) {
      setDynasty(res.updatedDynasty);
      setFeedbackMsg(res.message);
      onStateChange?.();
      setTimeout(() => setFeedbackMsg(null), 3500);
    } else {
      setFeedbackMsg(res.message);
      setTimeout(() => setFeedbackMsg(null), 3000);
    }
  };

  const unlockedCount = dynasty.unlocked_perk_ids.length;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center items-center bg-zinc-950/85 backdrop-blur-md p-2.5 sm:p-4 animate-in fade-in duration-200">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dynasty-modal-title"
        tabIndex={-1}
        className="bg-zinc-900 border border-amber-500/30 rounded-3xl w-full max-w-2xl max-h-[88vh] max-h-[88dvh] overflow-hidden shadow-2xl flex flex-col slide-in-from-bottom-8 sm:slide-in-from-bottom-0 sm:zoom-in-95"
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-zinc-800 flex justify-between items-center bg-gradient-to-r from-amber-950/30 via-zinc-900 to-zinc-900 sticky top-0 backdrop-blur-xl z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(245,158,11,0.2)]">
              <span className="text-xl">🏛️</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="dynasty-modal-title" className="font-black text-base sm:text-lg text-amber-200">
                  硅谷做题家宗族信托
                </h3>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  第 {dynasty.generation} 代
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                历经多代做题与职场摸爬滚打，沉淀宗族基因与代际信托基金
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            title="关闭宗族面板"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Global Dynasty Stats Bar */}
        <div className="grid grid-cols-3 gap-2 px-4 sm:px-6 py-3 bg-zinc-950/60 border-b border-zinc-800/80">
          <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-zinc-900/60 border border-zinc-800">
            <span className="text-[11px] text-zinc-400">做题家点数</span>
            <span className="text-base sm:text-lg font-black font-mono text-amber-400">
              🌟 {dynasty.leet_points}
            </span>
          </div>
          <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-zinc-900/60 border border-zinc-800">
            <span className="text-[11px] text-zinc-400">先祖信托启动金</span>
            <span className="text-base sm:text-lg font-black font-mono text-emerald-400">
              💰 +${dynasty.dynasty_trust_cash.toFixed(1)}w
            </span>
          </div>
          <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-zinc-900/60 border border-zinc-800">
            <span className="text-[11px] text-zinc-400">宗族基因解锁</span>
            <span className="text-base sm:text-lg font-black font-mono text-purple-400">
              🧬 {unlockedCount} / {DYNASTY_PERKS.length}
            </span>
          </div>
        </div>

        {/* Toast Feedback */}
        {feedbackMsg && (
          <div className="px-4 py-2 bg-amber-500/20 border-b border-amber-500/30 text-xs text-amber-300 font-semibold text-center animate-in fade-in">
            {feedbackMsg}
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-zinc-800 px-4 sm:px-6 bg-zinc-900/40">
          <button
            onClick={() => setActiveTab('perks')}
            className={`py-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'perks'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            🧬 宗族基因库 (Dynasty Perks)
          </button>
          <button
            onClick={() => setActiveTab('ancestors')}
            className={`py-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'ancestors'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            📜 先祖名人堂 ({dynasty.ancestor_hall_of_fame.length} 代先贤)
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'perks' && (
            <div className="space-y-3">
              <div className="text-xs text-zinc-400 mb-2">
                消耗局内积累的做题家点数，永久激活宗族基因加成（将在每一代新开局中永久生效）：
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {DYNASTY_PERKS.map((perk) => {
                  const isUnlocked = dynasty.unlocked_perk_ids.includes(perk.id);
                  const canAfford = dynasty.leet_points >= perk.cost;

                  return (
                    <div
                      key={perk.id}
                      className={`p-3.5 rounded-2xl border flex flex-col justify-between transition-all ${
                        isUnlocked
                          ? 'border-emerald-500/40 bg-emerald-500/10 shadow-[0_0_12px_rgba(16,185,129,0.1)]'
                          : 'border-zinc-700/60 bg-zinc-800/40 hover:border-zinc-600'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{perk.icon}</span>
                            <span className="font-bold text-sm text-zinc-100">{perk.name}</span>
                          </div>
                          {isUnlocked ? (
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                              已永久激活
                            </span>
                          ) : (
                            <span className="text-xs font-mono font-bold text-amber-400">
                              {perk.cost} 点数
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                          {perk.description}
                        </p>
                        <div className="text-[11px] font-medium text-amber-300/90 mt-2 bg-zinc-950/40 p-2 rounded-xl border border-zinc-800">
                          ⚡ 效果：{perk.effectDescription}
                        </div>
                      </div>

                      <div className="mt-3 pt-2 border-t border-zinc-800/60 flex justify-end">
                        {isUnlocked ? (
                          <span className="text-xs text-emerald-400 font-mono font-bold">
                            ✓ 家族代代相传
                          </span>
                        ) : (
                          <button
                            disabled={!canAfford}
                            onClick={() => handleUnlockPerk(perk.id)}
                            className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold font-mono transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shadow-md active:scale-95"
                          >
                            {canAfford ? `消耗 ${perk.cost} 点数解锁` : `点数不足 (缺 ${perk.cost - dynasty.leet_points})`}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'ancestors' && (
            <div className="space-y-3">
              {dynasty.ancestor_hall_of_fame.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 space-y-2">
                  <div className="text-3xl">📜</div>
                  <div className="text-sm font-semibold">家族族谱尚待书写</div>
                  <div className="text-xs text-zinc-600">
                    完成当前这局打拼（无论是登顶 FIRE 还是抱憾终老），你的先祖生平都会铭刻于此！
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {dynasty.ancestor_hall_of_fame.map((anc, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl border border-zinc-800 bg-zinc-950/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:border-amber-500/30 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-700 flex items-center justify-center font-mono font-black text-amber-400 shrink-0">
                          #{anc.generation}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-zinc-200">{anc.name}</span>
                            <span className="text-xs font-semibold text-amber-300">
                              【{anc.endingTitle}】
                            </span>
                          </div>
                          <div className="text-xs text-zinc-400 mt-0.5">
                            {anc.age} 岁终局 · 雇主/身份：{anc.companyOrRole} ({anc.levelOrStage || '无'})
                          </div>
                        </div>
                      </div>

                      <div className="flex sm:flex-col items-end justify-between w-full sm:w-auto border-t sm:border-t-0 border-zinc-800 pt-2 sm:pt-0">
                        <span className="text-xs text-zinc-500 font-mono">最终净资产</span>
                        <span className="text-sm font-black font-mono text-emerald-400">
                          ${anc.finalNetWorth.toFixed(1)}w
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-zinc-800 bg-zinc-950/90 flex justify-between items-center sticky bottom-0 z-10 shrink-0">
          <div className="text-xs text-zinc-500 font-mono">
            宗族数据自动实时保存至本地
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-bold text-xs transition-all border border-zinc-700 cursor-pointer shadow active:scale-95"
          >
            返回主界面
          </button>
        </div>
      </div>
    </div>
  );
};
