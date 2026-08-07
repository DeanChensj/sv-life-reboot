import React, { useState } from 'react';
import type { GameState } from '../types';

interface CareerTimelineModalProps {
  gameState: GameState;
  onClose: () => void;
  initialTab?: 'timeline' | 'chart' | 'summary';
}

export const CareerTimelineModal: React.FC<CareerTimelineModalProps> = ({ 
  gameState, 
  onClose,
  initialTab = 'chart'
}) => {
  const [activeTab, setActiveTab] = useState<'timeline' | 'chart' | 'summary'>(initialTab);
  const [chartMode, setChartMode] = useState<'line' | 'bar'>('line');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const timeline = gameState.timeline || [];
  const rawHistory = gameState.history_net_worth || [];
  const currentNetWorth = gameState.cash + (gameState.stocks || 0);

  // Construct dynamic timeline data including all recorded points + current live status
  const chartHistory: { age: number; year: number; netWorth: number; cash: number; stocks: number; isLive?: boolean }[] = [];

  if (rawHistory.length === 0) {
    const startAge = Math.min(gameState.age, 18);
    const startYear = gameState.year - (gameState.age - startAge);
    chartHistory.push({
      age: startAge,
      year: startYear,
      netWorth: Math.max(1, parseFloat(currentNetWorth.toFixed(1))),
      cash: Math.max(1, parseFloat(gameState.cash.toFixed(1))),
      stocks: parseFloat((gameState.stocks || 0).toFixed(1)),
    });
  } else {
    chartHistory.push(...rawHistory);
  }

  // Ensure current year live snapshot is present / updated
  const lastRecorded = chartHistory[chartHistory.length - 1];
  if (!lastRecorded || lastRecorded.age !== gameState.age || lastRecorded.year !== gameState.year) {
    chartHistory.push({
      age: gameState.age,
      year: gameState.year,
      netWorth: parseFloat(currentNetWorth.toFixed(1)),
      cash: parseFloat(gameState.cash.toFixed(1)),
      stocks: parseFloat((gameState.stocks || 0).toFixed(1)),
      isLive: true,
    });
  } else {
    chartHistory[chartHistory.length - 1] = {
      ...lastRecorded,
      netWorth: parseFloat(currentNetWorth.toFixed(1)),
      cash: parseFloat(gameState.cash.toFixed(1)),
      stocks: parseFloat((gameState.stocks || 0).toFixed(1)),
      isLive: true,
    };
  }

  // If there is only 1 data point, synthesize the starting baseline point
  if (chartHistory.length === 1) {
    const originAge = Math.max(18, gameState.age - 1);
    const originYear = gameState.year - (gameState.age - originAge);
    chartHistory.unshift({
      age: originAge,
      year: originYear,
      netWorth: Math.max(0.5, parseFloat((currentNetWorth * 0.5).toFixed(1))),
      cash: Math.max(0.5, parseFloat((gameState.cash * 0.5).toFixed(1))),
      stocks: 0,
    });
  }

  // Filter records
  const filteredTimeline = filterCategory === 'all' 
    ? timeline 
    : timeline.filter(t => t.category === filterCategory);

  // Compute key career milestones
  const peakNetWorth = Math.max(currentNetWorth, ...chartHistory.map(h => h.netWorth));
  const initialNetWorth = chartHistory[0]?.netWorth || 1;
  const growthMultiplier = initialNetWorth > 0 ? (currentNetWorth / initialNetWorth).toFixed(1) : '1.0';
  const yearsPlayed = Math.max(1, chartHistory.length);

  // SVG Line Chart Coordinate Mapping
  const svgWidth = 640;
  const svgHeight = 220;
  const padLeft = 46;
  const padRight = 36;
  const padTop = 28;
  const padBottom = 32;
  const plotW = svgWidth - padLeft - padRight;
  const plotH = svgHeight - padTop - padBottom;
  
  const maxYVal = Math.max(gameState.win_threshold, peakNetWorth * 1.15, 100);

  const points = chartHistory.map((item, idx) => {
    const x = padLeft + (idx / Math.max(1, chartHistory.length - 1)) * plotW;
    const y = padTop + (1 - Math.max(0, item.netWorth) / maxYVal) * plotH;
    return { ...item, x, y };
  });

  // Generate SVG Path
  const generatePathD = () => {
    if (points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cpX = (p0.x + p1.x) / 2;
      d += ` C ${cpX} ${p0.y}, ${cpX} ${p1.y}, ${p1.x} ${p1.y}`;
    }
    return d;
  };

  const generateAreaD = () => {
    if (points.length === 0) return '';
    const lineD = generatePathD();
    const groundY = padTop + plotH;
    return `${lineD} L ${points[points.length - 1].x} ${groundY} L ${points[0].x} ${groundY} Z`;
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'education':
        return (
          <svg className="w-3.5 h-3.5 text-indigo-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
            <path d="M6 12v5c3 3 9 3 12 0v-5" />
          </svg>
        );
      case 'career':
        return (
          <svg className="w-3.5 h-3.5 text-sky-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
        );
      case 'wealth':
        return (
          <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        );
      case 'real_estate':
        return (
          <svg className="w-3.5 h-3.5 text-teal-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        );
      case 'immigration':
        return (
          <svg className="w-3.5 h-3.5 text-amber-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
        );
      case 'relation':
        return (
          <svg className="w-3.5 h-3.5 text-rose-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        );
      case 'story':
        return (
          <svg className="w-3.5 h-3.5 text-purple-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
        );
      default:
        return (
          <svg className="w-3.5 h-3.5 text-yellow-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="7" />
            <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
          </svg>
        );
    }
  };

  const categoryMeta: Record<string, { label: string; badgeClass: string }> = {
    education: { label: '象牙塔', badgeClass: 'text-indigo-300 bg-indigo-500/15 border-indigo-500/30' },
    career: { label: '职场跃迁', badgeClass: 'text-sky-300 bg-sky-500/15 border-sky-500/30' },
    wealth: { label: '财富突破', badgeClass: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30' },
    real_estate: { label: '资产配置', badgeClass: 'text-teal-300 bg-teal-500/15 border-teal-500/30' },
    immigration: { label: '身份破局', badgeClass: 'text-amber-300 bg-amber-500/15 border-amber-500/30' },
    relation: { label: '情感纽带', badgeClass: 'text-rose-300 bg-rose-500/15 border-rose-500/30' },
    story: { label: '关键抉择', badgeClass: 'text-purple-300 bg-purple-500/15 border-purple-500/30' },
    milestone: { label: '生涯节点', badgeClass: 'text-yellow-300 bg-yellow-500/15 border-yellow-500/30' },
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-zinc-950 border border-zinc-800 rounded-2xl sm:rounded-3xl w-full max-w-4xl max-h-[92vh] sm:max-h-[90vh] flex flex-col shadow-2xl overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Background Glowing Ambient */}
        <div className="absolute top-0 right-1/4 w-72 h-72 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-5 border-b border-zinc-800/80 flex justify-between items-center bg-zinc-900/60 backdrop-blur-xl relative z-10">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-sky-600 to-emerald-500 flex items-center justify-center shadow-lg shadow-sky-500/20 shrink-0">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-950" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg sm:text-2xl font-black tracking-tight text-zinc-100 flex items-center gap-2">
                <span>生涯大事记 · 资产走势</span>
                <span className="text-[10px] sm:text-xs font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {gameState.age} 岁 · {gameState.year} 年
                </span>
              </h2>
              <p className="text-[11px] sm:text-xs text-zinc-400 font-mono mt-0.5 line-clamp-1">
                记录你在硅谷的资产复合增长走势与命运转折节点
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-100 flex items-center justify-center transition-all cursor-pointer font-mono text-sm shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Navigation Tabs & KPI Metrics Bar */}
        <div className="px-3.5 sm:px-6 py-2.5 sm:py-3 bg-zinc-900/40 border-b border-zinc-800/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-3 relative z-10">
          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-xl bg-zinc-900/80 border border-zinc-800 overflow-x-auto no-scrollbar max-w-full">
            <button
              onClick={() => setActiveTab('chart')}
              className={`px-2.5 sm:px-3.5 py-1.5 rounded-lg font-mono text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeTab === 'chart'
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30 font-extrabold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                <polyline points="17 6 23 6 23 12" />
              </svg>
              <span>资产走势图 ({chartHistory.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('timeline')}
              className={`px-2.5 sm:px-3.5 py-1.5 rounded-lg font-mono text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeTab === 'timeline'
                  ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30 font-extrabold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              <span>大事记编年 ({timeline.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('summary')}
              className={`px-2.5 sm:px-3.5 py-1.5 rounded-lg font-mono text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeTab === 'summary'
                  ? 'bg-purple-500 text-white shadow-md shadow-purple-500/30 font-extrabold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <span>生涯总览</span>
            </button>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3 sm:gap-4 text-xs font-mono">
            <div className="flex items-center gap-1">
              <span className="text-zinc-500">峰值资产:</span>
              <span className="font-bold text-emerald-400">${peakNetWorth.toFixed(1)}w</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-zinc-500">当前TC:</span>
              <span className="font-bold text-sky-400">${gameState.tc.toFixed(1)}w</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-zinc-500">年限:</span>
              <span className="font-bold text-amber-400">{yearsPlayed} 年</span>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 sm:space-y-6 relative z-10 custom-scrollbar">
          
          {/* Tab 1: Net Worth Curve Chart */}
          {activeTab === 'chart' && (
            <div className="space-y-5 sm:space-y-6">
              {/* Metric Cards Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-xl p-3 sm:p-3.5 flex flex-col">
                  <span className="text-[10px] sm:text-xs text-zinc-500 font-mono">当前总净资产</span>
                  <span className="text-base sm:text-xl font-bold font-mono text-emerald-400 mt-1">
                    ${currentNetWorth.toFixed(1)}w
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono mt-0.5">
                    现金 ${gameState.cash.toFixed(1)}w + 股票 ${(gameState.stocks || 0).toFixed(1)}w
                  </span>
                </div>

                <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-xl p-3 sm:p-3.5 flex flex-col">
                  <span className="text-[10px] sm:text-xs text-zinc-500 font-mono">历史最高峰值</span>
                  <span className="text-base sm:text-xl font-bold font-mono text-teal-300 mt-1">
                    ${peakNetWorth.toFixed(1)}w
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono mt-0.5">
                    巅峰财富记录
                  </span>
                </div>

                <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-xl p-3 sm:p-3.5 flex flex-col">
                  <span className="text-[10px] sm:text-xs text-zinc-500 font-mono">财富累积倍率</span>
                  <span className="text-base sm:text-xl font-bold font-mono text-sky-400 mt-1">
                    {growthMultiplier}x
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono mt-0.5">
                    初始: ${initialNetWorth.toFixed(1)}w
                  </span>
                </div>

                <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-xl p-3 sm:p-3.5 flex flex-col">
                  <span className="text-[10px] sm:text-xs text-zinc-500 font-mono">FIRE 阶段目标</span>
                  <span className="text-base sm:text-xl font-bold font-mono text-amber-400 mt-1">
                    {Math.min(100, Math.floor((currentNetWorth / gameState.win_threshold) * 100))}%
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono mt-0.5">
                    目标阈值: ${gameState.win_threshold}w
                  </span>
                </div>
              </div>

              {/* Main Visual Chart Container */}
              <div className="bg-zinc-900/80 border border-zinc-800 p-4 sm:p-6 rounded-2xl">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 sm:mb-6">
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-zinc-100 flex items-center gap-2">
                      <span>历年净资产复合增长走势</span>
                      <span className="text-[10px] sm:text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        {chartHistory.length} 个数据节点
                      </span>
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5">展示现金流积累与股票持仓随年限推移的复合资产轨迹</p>
                  </div>

                  {/* Chart Mode Switcher */}
                  <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-950/80 border border-zinc-800 shrink-0">
                    <button
                      onClick={() => setChartMode('line')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer flex items-center gap-1 ${
                        chartMode === 'line'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                      </svg>
                      <span>折线走势</span>
                    </button>
                    <button
                      onClick={() => setChartMode('bar')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer flex items-center gap-1 ${
                        chartMode === 'bar'
                          ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30 font-bold'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <line x1="18" y1="20" x2="18" y2="10" />
                        <line x1="12" y1="20" x2="12" y2="4" />
                        <line x1="6" y1="20" x2="6" y2="14" />
                      </svg>
                      <span>结构柱状</span>
                    </button>
                  </div>
                </div>

                {/* View 1: SVG Smooth Line & Area Chart */}
                {chartMode === 'line' && (
                  <div className="relative w-full bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-2 sm:p-4 overflow-hidden">
                    <svg 
                      viewBox={`0 0 ${svgWidth} ${svgHeight}`} 
                      className="w-full h-56 sm:h-72 overflow-visible"
                    >
                      <defs>
                        {/* Area Gradient */}
                        <linearGradient id="assetAreaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity="0.45" />
                          <stop offset="60%" stopColor="#0d9488" stopOpacity="0.15" />
                          <stop offset="100%" stopColor="#064e3b" stopOpacity="0.0" />
                        </linearGradient>
                        {/* Line Stroke Gradient */}
                        <linearGradient id="assetLineGrad" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#38bdf8" />
                          <stop offset="50%" stopColor="#2dd4bf" />
                          <stop offset="100%" stopColor="#34d399" />
                        </linearGradient>
                        {/* Glow Filter */}
                        <filter id="lineGlow" x="-20%" y="-20%" width="140%" height="140%">
                          <feGaussianBlur stdDeviation="3" result="blur" />
                          <feComposite in="SourceGraphic" in2="blur" operator="over" />
                        </filter>
                      </defs>

                      {/* Horizontal Gridlines & Benchmark Reference Lines */}
                      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                        const y = padTop + (1 - ratio) * plotH;
                        const val = Math.round(ratio * maxYVal);
                        return (
                          <g key={ratio}>
                            <line 
                              x1={padLeft} 
                              y1={y} 
                              x2={svgWidth - padRight} 
                              y2={y} 
                              stroke="#27272a" 
                              strokeDasharray={ratio === 0 ? "none" : "3,3"} 
                              strokeWidth="1"
                            />
                            <text 
                              x={padLeft - 6} 
                              y={y + 3} 
                              textAnchor="end" 
                              className="text-[9px] fill-zinc-600 font-mono"
                            >
                              ${val}w
                            </text>
                          </g>
                        );
                      })}

                      {/* Area Fill */}
                      <path 
                        d={generateAreaD()} 
                        fill="url(#assetAreaGrad)" 
                      />

                      {/* Glowing Line Stroke */}
                      <path 
                        d={generatePathD()} 
                        fill="none" 
                        stroke="url(#assetLineGrad)" 
                        strokeWidth="3" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                        filter="url(#lineGlow)"
                      />

                      {/* Data Point Nodes */}
                      {points.map((p, idx) => {
                        const isHovered = hoveredIndex === idx;
                        const isPeak = p.netWorth === peakNetWorth && peakNetWorth > 0;
                        return (
                          <g 
                            key={idx}
                            className="cursor-pointer group"
                            onMouseEnter={() => setHoveredIndex(idx)}
                            onMouseLeave={() => setHoveredIndex(null)}
                          >
                            {/* Outer Pulse Ring */}
                            {p.isLive && (
                              <circle 
                                cx={p.x} 
                                cy={p.y} 
                                r="9" 
                                fill="none" 
                                stroke="#38bdf8" 
                                strokeWidth="1.5" 
                                opacity="0.6"
                                className="animate-ping"
                              />
                            )}

                            {/* Node Circle */}
                            <circle 
                              cx={p.x} 
                              cy={p.y} 
                              r={isHovered ? "6" : isPeak ? "5.5" : "4"} 
                              fill={isPeak ? "#fbbf24" : p.isLive ? "#38bdf8" : "#10b981"} 
                              stroke="#09090b" 
                              strokeWidth="2"
                              className="transition-all duration-200 shadow-md"
                            />

                            {/* Value Label above Node */}
                            <text 
                              x={p.x} 
                              y={p.y - 8} 
                              textAnchor="middle" 
                              className={`text-[9px] font-mono font-bold transition-all ${
                                isPeak 
                                  ? 'fill-amber-400' 
                                  : p.isLive 
                                    ? 'fill-sky-400' 
                                    : 'fill-zinc-400'
                              }`}
                            >
                              ${p.netWorth >= 100 ? `${Math.round(p.netWorth)}w` : `${p.netWorth.toFixed(1)}w`}
                            </text>

                            {/* X-axis Tick & Label */}
                            <text 
                              x={p.x} 
                              y={padTop + plotH + 16} 
                              textAnchor="middle" 
                              className="text-[9px] fill-zinc-500 font-mono"
                            >
                              {p.age}岁
                            </text>
                            <text 
                              x={p.x} 
                              y={padTop + plotH + 26} 
                              textAnchor="middle" 
                              className="text-[8px] fill-zinc-600 font-mono"
                            >
                              {p.year}
                            </text>
                          </g>
                        );
                      })}
                    </svg>

                    {/* Active Point Hover Card */}
                    {hoveredIndex !== null && points[hoveredIndex] && (
                      <div className="mt-3 p-3 rounded-xl bg-zinc-900 border border-zinc-700 flex flex-wrap items-center justify-between gap-3 text-xs font-mono animate-in fade-in">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-zinc-100">{points[hoveredIndex].year} 年 ({points[hoveredIndex].age} 岁)</span>
                          {points[hoveredIndex].isLive && (
                            <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 text-[10px] border border-sky-500/30">实时进行中</span>
                          )}
                          {points[hoveredIndex].netWorth === peakNetWorth && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] border border-amber-500/30">历史最高</span>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-zinc-400">现金: <strong className="text-sky-300">${points[hoveredIndex].cash.toFixed(1)}w</strong></span>
                          <span className="text-zinc-400">股票: <strong className="text-teal-300">${points[hoveredIndex].stocks.toFixed(1)}w</strong></span>
                          <span className="text-emerald-400 font-bold">总资产: ${points[hoveredIndex].netWorth.toFixed(1)}w</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* View 2: Stacked Structure Bar Chart */}
                {chartMode === 'bar' && (
                  <div className="space-y-4">
                    <div className="h-60 sm:h-72 flex items-end gap-1.5 sm:gap-2.5 pt-8 pb-2 border-b border-zinc-800 overflow-x-auto px-1 sm:px-2">
                      {chartHistory.map((h, i) => {
                        const safeNetWorth = Math.max(0, h.netWorth);
                        const totalHeightPct = Math.max(10, Math.min(100, (safeNetWorth / maxYVal) * 100));
                        const isPeak = h.netWorth === peakNetWorth && peakNetWorth > 0;
                        
                        const cashPct = safeNetWorth > 0 ? (Math.max(0, h.cash) / safeNetWorth) * 100 : 100;
                        const stocksPct = safeNetWorth > 0 ? (Math.max(0, h.stocks) / safeNetWorth) * 100 : 0;

                        return (
                          <div key={i} className="flex-1 min-w-[32px] sm:min-w-[40px] max-w-[64px] flex flex-col items-center gap-1 group relative">
                            {/* Tooltip */}
                            <div className="absolute -top-16 opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-900/95 border border-zinc-700 text-[10px] sm:text-xs font-mono p-2 rounded-xl shadow-2xl pointer-events-none whitespace-nowrap z-30 backdrop-blur-md">
                              <div className="text-zinc-300 font-bold flex items-center gap-1.5">
                                <span>{h.year} 年 ({h.age} 岁)</span>
                                {h.isLive && (
                                  <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 text-[9px] border border-emerald-500/30">当前</span>
                                )}
                                {isPeak && (
                                  <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 text-[9px] border border-amber-500/30">峰值</span>
                                )}
                              </div>
                              <div className="text-emerald-400 font-extrabold text-sm my-0.5">${h.netWorth.toFixed(1)}w</div>
                              <div className="text-zinc-400 text-[10px] flex gap-2">
                                <span className="text-sky-300">现金: ${h.cash.toFixed(1)}w</span>
                                <span className="text-teal-300">股票: ${h.stocks.toFixed(1)}w</span>
                              </div>
                            </div>

                            {/* Value Tag on Top */}
                            <span className="text-[9px] sm:text-[10px] font-mono text-zinc-400 group-hover:text-emerald-400 font-bold truncate max-w-full">
                              ${h.netWorth >= 100 ? `${Math.round(h.netWorth)}w` : `${h.netWorth.toFixed(1)}w`}
                            </span>

                            {/* Column Bar Container */}
                            <div 
                              className={`w-full rounded-t-lg flex flex-col justify-end overflow-hidden transition-all duration-300 ${
                                isPeak 
                                  ? 'ring-2 ring-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.35)]' 
                                  : 'group-hover:brightness-125'
                              } ${h.isLive ? 'ring-1 ring-sky-400/80' : ''}`}
                              style={{ height: `${totalHeightPct}%` }}
                            >
                              {/* Stocks Segment (Top) */}
                              {h.stocks > 0 && (
                                <div 
                                  className="w-full bg-gradient-to-t from-teal-600 to-emerald-400 transition-all"
                                  style={{ height: `${stocksPct}%` }}
                                />
                              )}
                              {/* Cash Segment (Bottom) */}
                              <div 
                                className="w-full bg-gradient-to-t from-sky-700 via-sky-600 to-sky-400 transition-all"
                                style={{ height: `${cashPct}%` }}
                              />
                            </div>

                            {/* X-axis Label */}
                            <div className="flex flex-col items-center">
                              <span className="text-[9px] sm:text-[10px] font-mono text-zinc-400 group-hover:text-zinc-200">
                                {h.age}岁
                              </span>
                              <span className="text-[8px] font-mono text-zinc-600">
                                {h.year}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Chart Legend */}
                <div className="flex flex-wrap justify-between items-center text-[10px] sm:text-xs font-mono text-zinc-500 pt-3 border-t border-zinc-800/60 gap-2">
                  <span>起始: ${chartHistory[0]?.netWorth.toFixed(1)}w ({chartHistory[0]?.age}岁)</span>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-sky-400">
                      <span className="w-2 h-2 rounded-sm bg-sky-500 inline-block" /> 现金
                    </span>
                    <span className="flex items-center gap-1 text-teal-400">
                      <span className="w-2 h-2 rounded-sm bg-teal-400 inline-block" /> 股票持仓
                    </span>
                    <span className="flex items-center gap-1 text-amber-400">
                      <span className="w-2 h-2 rounded-sm bg-amber-400 inline-block" /> 巅峰高光
                    </span>
                  </div>
                  <span>当前: ${currentNetWorth.toFixed(1)}w ({gameState.age}岁)</span>
                </div>
              </div>

              {/* Data Table Breakdown */}
              <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-3.5 sm:p-5">
                <h4 className="text-xs sm:text-sm font-bold text-zinc-200 mb-3 flex items-center justify-between">
                  <span>历年资产明细清单</span>
                  <span className="text-xs font-mono text-zinc-500">共 {chartHistory.length} 年记录</span>
                </h4>
                <div className="overflow-x-auto max-h-48 overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="text-zinc-500 border-b border-zinc-800 bg-zinc-950/40 sticky top-0">
                      <tr>
                        <th className="py-1.5 px-2">年份/年龄</th>
                        <th className="py-1.5 px-2 text-right">现金储备</th>
                        <th className="py-1.5 px-2 text-right">股票持仓</th>
                        <th className="py-1.5 px-2 text-right">总净资产</th>
                        <th className="py-1.5 px-2 text-right">状态</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50 text-zinc-300">
                      {[...chartHistory].reverse().map((row, idx) => (
                        <tr key={idx} className="hover:bg-zinc-800/30 transition-colors">
                          <td className="py-1.5 px-2 font-bold text-zinc-200">
                            {row.year} 年 ({row.age} 岁)
                          </td>
                          <td className="py-1.5 px-2 text-right text-sky-400">
                            ${row.cash.toFixed(1)}w
                          </td>
                          <td className="py-1.5 px-2 text-right text-teal-400">
                            ${row.stocks.toFixed(1)}w
                          </td>
                          <td className="py-1.5 px-2 text-right font-bold text-emerald-400">
                            ${row.netWorth.toFixed(1)}w
                          </td>
                          <td className="py-1.5 px-2 text-right text-[10px]">
                            {row.isLive ? (
                              <span className="text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20">实时</span>
                            ) : row.netWorth === peakNetWorth ? (
                              <span className="text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">巅峰</span>
                            ) : (
                              <span className="text-zinc-500">结算</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Timeline Chronology */}
          {activeTab === 'timeline' && (
            <div className="space-y-5 sm:space-y-6">
              {/* Category Filter Chips */}
              <div className="flex flex-wrap gap-1.5 sm:gap-2 items-center">
                <span className="text-[11px] sm:text-xs text-zinc-500 font-mono mr-1">分类:</span>
                <button
                  onClick={() => setFilterCategory('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer border ${
                    filterCategory === 'all'
                      ? 'bg-zinc-100 text-zinc-950 border-zinc-100 font-bold'
                      : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  全部 ({timeline.length})
                </button>
                {Object.entries(categoryMeta).map(([cat, meta]) => {
                  const count = timeline.filter(t => t.category === cat).length;
                  if (count === 0) return null;
                  return (
                    <button
                      key={cat}
                      onClick={() => setFilterCategory(cat)}
                      className={`px-2 py-1 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer border flex items-center gap-1.5 ${
                        filterCategory === cat
                          ? 'bg-zinc-100 text-zinc-950 border-zinc-100 font-bold'
                          : `${meta.badgeClass} hover:opacity-90`
                      }`}
                    >
                      {getCategoryIcon(cat)}
                      <span>{meta.label} ({count})</span>
                    </button>
                  );
                })}
              </div>

              {/* Timeline Flow */}
              {filteredTimeline.length === 0 ? (
                <div className="text-center py-16 border border-dashed border-zinc-800 rounded-2xl bg-zinc-900/20 flex flex-col items-center justify-center">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-3">
                    <svg className="w-6 h-6 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  </div>
                  <div className="text-zinc-400 font-medium">暂无大事记记录</div>
                  <div className="text-zinc-600 text-xs mt-1">随着游戏深入，重要晋升、置业、身份破局与因果事件将沉淀于此</div>
                </div>
              ) : (
                <div className="relative pl-6 sm:pl-8 border-l-2 border-zinc-800/80 space-y-4 sm:space-y-6 ml-3 sm:ml-4">
                  {filteredTimeline.map((item, idx) => {
                    const meta = categoryMeta[item.category] || categoryMeta.milestone;
                    return (
                      <div key={idx} className="relative group">
                        {/* Node Bullet Centered on Line */}
                        <div className="absolute -left-[36px] sm:-left-[44px] top-1.5 w-6 h-6 rounded-full bg-zinc-950 border-2 border-sky-500/80 flex items-center justify-center text-xs shadow-md shadow-sky-500/20 group-hover:scale-110 transition-transform">
                          {getCategoryIcon(item.category)}
                        </div>

                        {/* Event Card */}
                        <div className="bg-zinc-900/70 border border-zinc-800/80 hover:border-zinc-700/90 rounded-2xl p-3.5 sm:p-5 transition-all shadow-sm">
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                              <span className="text-[11px] sm:text-xs font-mono font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                                {item.year} 年 · {item.age} 岁
                              </span>
                              <span className={`text-[10px] sm:text-[11px] font-mono font-semibold px-2 py-0.5 rounded border flex items-center gap-1 ${meta.badgeClass}`}>
                                {getCategoryIcon(item.category)}
                                <span>{meta.label}</span>
                              </span>
                            </div>
                            {item.statHighlight && (
                              <span className="text-[11px] sm:text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                {item.statHighlight}
                              </span>
                            )}
                          </div>

                          <h3 className="text-sm sm:text-base font-bold text-zinc-100 group-hover:text-sky-300 transition-colors mb-1">
                            {item.title}
                          </h3>

                          {item.description && (
                            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Overall Career Summary Matrix */}
          {activeTab === 'summary' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
              <div className="bg-zinc-900/80 border border-zinc-800 p-4 sm:p-5 rounded-2xl flex flex-col gap-1.5 sm:gap-2">
                <div className="text-xs font-mono text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                  </svg>
                  <span>职场成就</span>
                </div>
                <div className="text-lg sm:text-xl font-bold text-zinc-100">
                  {gameState.level || '待业'} @ {gameState.company ? gameState.company.toUpperCase() : '未入职'}
                </div>
                <div className="text-xs text-zinc-400">
                  当前年薪总包 ${gameState.tc.toFixed(1)}w，算法储备 LeetCode {gameState.leetcode} 分
                </div>
              </div>

              <div className="bg-zinc-900/80 border border-zinc-800 p-4 sm:p-5 rounded-2xl flex flex-col gap-1.5 sm:gap-2">
                <div className="text-xs font-mono text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <span>身份历程</span>
                </div>
                <div className="text-lg sm:text-xl font-bold text-amber-400">
                  {gameState.visa}
                </div>
                <div className="text-xs text-zinc-400">
                  {gameState.visa === '公民' || gameState.visa === '绿卡' 
                    ? '已彻底解决留美身份，拥有完全执业与生活自由' 
                    : `绿卡排期阶段: ${gameState.gc_stage || '未启动'}`}
                </div>
              </div>

              <div className="bg-zinc-900/80 border border-zinc-800 p-4 sm:p-5 rounded-2xl flex flex-col gap-1.5 sm:gap-2">
                <div className="text-xs font-mono text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-teal-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  </svg>
                  <span>置业安家</span>
                </div>
                <div className="text-lg sm:text-xl font-bold text-teal-400">
                  {gameState.housing_name || '租房生活'}
                </div>
                <div className="text-xs text-zinc-400">
                  {gameState.rental_income && gameState.rental_income > 0 
                    ? `拥有被动租金流 +$${gameState.rental_income}w/年，名下房产: ${(gameState.investment_properties || []).length + (gameState.has_housing ? 1 : 0)} 套`
                    : '目前依靠流动现金与证券投资'}
                </div>
              </div>

              <div className="bg-zinc-900/80 border border-zinc-800 p-4 sm:p-5 rounded-2xl flex flex-col gap-1.5 sm:gap-2">
                <div className="text-xs font-mono text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  <span>核心羁绊网络</span>
                </div>
                <div className="text-lg sm:text-xl font-bold text-purple-400">
                  已结识 {Object.keys(gameState.npcs || {}).length} 位关键人物
                </div>
                <div className="text-xs text-zinc-400">
                  {Object.values(gameState.npcs || {}).map(n => n.name).join('、') || '暂无深度 NPC 羁绊'}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-zinc-800/80 bg-zinc-900/50 flex justify-between items-center relative z-10">
          <div className="text-[11px] sm:text-xs font-mono text-zinc-500">
            按 <kbd className="px-1.5 py-0.5 bg-zinc-800 text-zinc-300 rounded border border-zinc-700">ESC</kbd> 或点击关闭
          </div>
          <button
            onClick={onClose}
            className="px-4 sm:px-5 py-1.5 sm:py-2 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs font-mono transition-all active:scale-95 cursor-pointer shadow-md"
          >
            返回模拟人生
          </button>
        </div>
      </div>
    </div>
  );
};
