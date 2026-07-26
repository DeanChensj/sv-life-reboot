import React from 'react';
import type { GameState } from '../types';

interface YearEndStatementModalProps {
  gameState: GameState;
  onContinue: () => void;
}

export const YearEndStatementModal: React.FC<YearEndStatementModalProps> = ({ gameState, onContinue }) => {
  const salaryIncome = gameState.tc > 0 ? (gameState.tc * 0.7).toFixed(1) : '0.0';
  const rsuIncome = gameState.tc > 0 ? (gameState.tc * 0.3).toFixed(1) : '0.0';
  
  // Expenses matched with App.tsx handleYearEndContinue
  const housingExpenseNum = gameState.has_housing ? 2.0 : (gameState.rent || 4.0);
  const housingExpense = housingExpenseNum.toFixed(1);
  const carExpenseNum = gameState.car === 'porsche' ? 2.5 : gameState.car === 'cybertruck' ? 2.0 : gameState.car === 'model_y' ? 1.0 : 0.3;
  const carExpense = carExpenseNum.toFixed(1);
  const livingExpenseNum = 3.0;
  const livingExpense = livingExpenseNum.toFixed(1);

  const totalIncome = gameState.tc > 0 ? gameState.tc : 0;
  const totalExpense = housingExpenseNum + carExpenseNum + livingExpenseNum;
  const estNetChange = (totalIncome - totalExpense).toFixed(1);
  const isNetPositive = parseFloat(estNetChange) >= 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/85 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden">
        {/* Background Accent */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

        {/* Modal Title */}
        <div className="flex justify-between items-center border-b border-zinc-800 pb-4 mb-6">
          <div>
            <span className="text-[11px] font-mono text-emerald-400 font-bold uppercase tracking-widest block">
              ANNUAL FINANCIAL & STATUS REPORT
            </span>
            <h3 className="text-2xl font-extrabold text-zinc-50 tracking-tight mt-0.5">
              {gameState.year} 年终财务与人生账单
            </h3>
          </div>
          <span className="text-xs font-mono font-bold bg-zinc-800 text-zinc-300 px-3 py-1.5 rounded-full border border-zinc-700">
            {gameState.age} 岁
          </span>
        </div>

        {/* Net Cash Banner */}
        <div className={`p-4 rounded-2xl border mb-6 flex justify-between items-center ${isNetPositive ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'}`}>
          <div>
            <div className="text-xs font-mono uppercase tracking-wider opacity-80">本年度预估现金净变动</div>
            <div className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums mt-0.5">
              {isNetPositive ? `+$${estNetChange}w` : `-$${Math.abs(parseFloat(estNetChange)).toFixed(1)}w`}
            </div>
          </div>
          <div className="text-right font-mono">
            <div className="text-[10px] text-zinc-400 uppercase">账末总结存</div>
            <div className="text-xl font-bold text-zinc-100">${gameState.cash.toFixed(1)}w</div>
          </div>
        </div>

        {/* Detailed Financial Breakdown Table */}
        <div className="space-y-2.5 font-mono text-xs mb-6">
          <div className="flex justify-between items-center p-3.5 bg-zinc-950/70 rounded-2xl border border-zinc-800/80">
            <span className="text-zinc-400 flex items-center gap-2.5">
              <svg className="w-4 h-4 text-emerald-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>
              基础薪资收入 (Base Salary)
            </span>
            <span className="font-bold text-emerald-400 tabular-nums">+${salaryIncome}w</span>
          </div>

          {gameState.tc > 0 && (
            <div className="flex justify-between items-center p-3.5 bg-zinc-950/70 rounded-2xl border border-zinc-800/80">
              <span className="text-zinc-400 flex items-center gap-2.5">
                <svg className="w-4 h-4 text-indigo-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                RSU 股票解禁归属
              </span>
              <span className="font-bold text-indigo-300 tabular-nums">+${rsuIncome}w</span>
            </div>
          )}

          <div className="flex justify-between items-center p-3.5 bg-zinc-950/70 rounded-2xl border border-zinc-800/80">
            <span className="text-zinc-400 flex items-center gap-2.5">
              <svg className="w-4 h-4 text-rose-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              {gameState.has_housing ? '自购房产物业税/HOA' : '租房房租'}
            </span>
            <span className="font-bold text-rose-400 tabular-nums">-${housingExpense}w</span>
          </div>

          <div className="flex justify-between items-center p-3.5 bg-zinc-950/70 rounded-2xl border border-zinc-800/80">
            <span className="text-zinc-400 flex items-center gap-2.5">
              <svg className="w-4 h-4 text-amber-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
              车辆维保与出行
            </span>
            <span className="font-bold text-amber-300 tabular-nums">-${carExpense}w</span>
          </div>

          <div className="flex justify-between items-center p-3.5 bg-zinc-950/70 rounded-2xl border border-zinc-800/80">
            <span className="text-zinc-400 flex items-center gap-2.5">
              <svg className="w-4 h-4 text-purple-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
              湾区基础日常生活
            </span>
            <span className="font-bold text-zinc-300 tabular-nums">-${livingExpense}w</span>
          </div>
        </div>

        {/* Visa & Life Status Summary */}
        <div className="bg-zinc-950/90 p-4 rounded-2xl border border-zinc-800 text-xs mb-6 space-y-2">
          <div className="flex justify-between">
            <span className="text-zinc-400 font-mono">当前签证身份:</span>
            <span className="font-bold text-amber-300">{gameState.visa}</span>
          </div>
          {(gameState.gc_progress > 0 || gameState.visa === '绿卡') && (
            <div className="flex justify-between">
              <span className="text-zinc-400 font-mono">绿卡 (PERM/排期) 进度:</span>
              <span className="font-bold text-emerald-400 font-mono tabular-nums">
                {gameState.visa === '绿卡' ? '100% (已获绿卡)' : `${Math.min(100, Math.max(0, gameState.gc_progress || 0))}%`}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-zinc-400 font-mono">算法解题储备:</span>
            <span className="font-bold text-amber-400 font-mono tabular-nums">{gameState.leetcode} 题</span>
          </div>
        </div>

        {/* Continue Button */}
        <button
          onClick={onContinue}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-zinc-950 font-extrabold text-base transition-all duration-200 shadow-lg shadow-emerald-500/20 active:scale-[0.985] cursor-pointer flex items-center justify-center gap-2"
        >
          <span>结清账单，进入下一年</span>
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      </div>
    </div>
  );
};

