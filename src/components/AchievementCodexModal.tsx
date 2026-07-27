import React, { useState } from 'react';
import { ACHIEVEMENTS, getUnlockedAchievements } from '../data/achievements';

interface AchievementCodexModalProps {
  onClose: () => void;
}

const renderIcon = (iconKey: string) => {
  switch (iconKey) {
    case 'rocket':
      return <svg className="w-6 h-6 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-3.05 11a22.35 22.35 0 0 1-3.95 2z"/></svg>;
    case 'coin':
      return <svg className="w-6 h-6 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="8"/><path d="M12 6v12M15 9.5a2.5 2.5 0 0 0-5 0c0 4 5 1.5 5 5.5a2.5 2.5 0 0 1-5 0"/></svg>;
    case 'mountain':
      return <svg className="w-6 h-6 text-teal-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/></svg>;
    case 'house':
      return <svg className="w-6 h-6 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
    case 'heart':
      return <svg className="w-6 h-6 text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>;
    case 'zap':
      return <svg className="w-6 h-6 text-yellow-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>;
    case 'cpu':
      return <svg className="w-6 h-6 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M15 2v2M15 20v2M2 15h2M2 9h2M20 15h2M20 9h2M9 2v2M9 20v2"/></svg>;
    case 'activity':
      return <svg className="w-6 h-6 text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>;
    case 'award':
      return <svg className="w-6 h-6 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>;
    case 'crown':
      return <svg className="w-6 h-6 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/></svg>;
    default:
      return <svg className="w-6 h-6 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
  }
};

export const AchievementCodexModal: React.FC<AchievementCodexModalProps> = ({ onClose }) => {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const unlockedIds = getUnlockedAchievements();
  const progressPercent = Math.round((unlockedIds.length / ACHIEVEMENTS.length) * 100);

  const filtered = ACHIEVEMENTS.filter((item) => {
    if (activeCategory === 'all') return true;
    return item.category === activeCategory;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col font-sans">
        
        {/* Modal Header */}
        <div className="p-6 md:p-8 border-b border-zinc-800 bg-zinc-950/50 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.45 1-1 1H7v4h10v-4h-2c-.55 0-1-.45-1-1v-2.34M18 4H6v7a6 6 0 0 0 12 0V4z"/></svg>
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-black text-zinc-100 tracking-tight">
                  硅谷成就与隐藏结局图鉴
                </h2>
                <p className="text-xs text-zinc-400 font-mono mt-0.5">
                  解锁更多隐藏人生支线与终极成就 · 收集率 {progressPercent}%
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 w-9 h-9 rounded-full flex items-center justify-center font-bold border border-zinc-700 transition-all active:scale-95 cursor-pointer"
              title="关闭图鉴"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-zinc-950 rounded-full h-2.5 overflow-hidden border border-zinc-800 p-0.5">
            <div
              className="bg-gradient-to-r from-emerald-500 via-teal-400 to-indigo-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Category Filter Tabs */}
          <div className="flex flex-wrap gap-2 pt-1 font-mono text-xs">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                activeCategory === 'all'
                  ? 'bg-emerald-500 text-zinc-950 shadow-lg shadow-emerald-500/20'
                  : 'bg-zinc-800/80 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
              }`}
            >
              全量图鉴 ({unlockedIds.length}/{ACHIEVEMENTS.length})
            </button>

            <button
              onClick={() => setActiveCategory('ending')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                activeCategory === 'ending'
                  ? 'bg-purple-500 text-zinc-950 shadow-lg shadow-purple-500/20'
                  : 'bg-zinc-800/80 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
              }`}
            >
              隐藏结局
            </button>

            <button
              onClick={() => setActiveCategory('wealth')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                activeCategory === 'wealth'
                  ? 'bg-amber-500 text-zinc-950 shadow-lg shadow-amber-500/20'
                  : 'bg-zinc-800/80 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
              }`}
            >
              巨额财富
            </button>

            <button
              onClick={() => setActiveCategory('milestone')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                activeCategory === 'milestone'
                  ? 'bg-indigo-500 text-zinc-950 shadow-lg shadow-indigo-500/20'
                  : 'bg-zinc-800/80 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
              }`}
            >
              里程碑
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto max-h-[60vh] grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((item) => {
            const isUnlocked = unlockedIds.includes(item.id);

            return (
              <div
                key={item.id}
                className={`relative p-5 rounded-2xl border transition-all duration-300 flex items-start gap-4 ${
                  isUnlocked
                    ? 'bg-gradient-to-br from-zinc-900 via-zinc-900 to-emerald-950/40 border-emerald-500/40 shadow-xl shadow-emerald-500/5'
                    : 'bg-zinc-950/60 border-zinc-800/60 opacity-60'
                }`}
              >
                <div className={`p-3 rounded-2xl shrink-0 ${isUnlocked ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-zinc-900 border border-zinc-800 text-zinc-600'}`}>
                  {isUnlocked ? renderIcon(item.icon) : (
                    <svg className="w-6 h-6 text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className={`font-black text-base truncate ${isUnlocked ? 'text-zinc-100' : 'text-zinc-500'}`}>
                      {isUnlocked ? item.title : '未解锁结局/成就'}
                    </h3>

                    {isUnlocked ? (
                      <span className="text-[10px] font-mono font-black text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full shrink-0">
                        已收藏 
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono font-bold text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full shrink-0">
                        未解锁 
                      </span>
                    )}
                  </div>

                  <p className={`text-xs leading-relaxed mb-2 ${isUnlocked ? 'text-zinc-300' : 'text-zinc-400 font-mono italic'}`}>
                    {isUnlocked ? item.description : item.hint}
                  </p>

                  <span className="inline-block text-[10px] font-mono font-semibold text-zinc-500 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-md">
                    类别: {item.category === 'ending' ? '隐藏结局' : item.category === 'wealth' ? '巨额财富' : item.category === 'milestone' ? '属性里程碑' : '彩蛋'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950/80 flex items-center justify-between text-xs font-mono text-zinc-400">
          <span>提示：更换不同天赋角色与支线可解锁全新隐藏结局！</span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black tracking-wide transition-all active:scale-95 cursor-pointer shadow-lg shadow-emerald-500/20"
          >
            关闭图鉴
          </button>
        </div>

      </div>
    </div>
  );
};
