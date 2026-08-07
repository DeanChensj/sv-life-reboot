import React from 'react';
import type { GameState } from '../types';
import { getTCBreakdown } from '../utils/gameStateSelectors';

interface YearEndStatementModalProps {
  gameState: GameState;
  onContinue: () => void;
}

export const YearEndStatementModal: React.FC<YearEndStatementModalProps> = ({ gameState, onContinue }) => {
  const isHomeowner = ['Atherton 顶级豪宅', 'Sunnyvale 老破小', 'North San Jose 联排', 'Fremont 学区房'].includes(gameState.housing_name || '');
  
  const tcInfo = getTCBreakdown(gameState);
  const preTaxBase = tcInfo.preTaxBase;
  const preTaxRSU = tcInfo.preTaxRSU;
  const taxAmountNum = tcInfo.taxAmount;
  const postTaxIncomeNum = tcInfo.postTaxBase;
  const rsuTaxAmountNum = tcInfo.rsuTaxAmount;
  const postTaxRSUNum = tcInfo.postTaxRSU;
  
  const taxAmount = taxAmountNum.toFixed(1);
  const postTaxIncome = postTaxIncomeNum.toFixed(1);
  const rentalIncomeNum = gameState.rental_income || 0;

  // Expenses matched with App.tsx handleYearEndContinue
  const housingExpenseNum = gameState.rent !== undefined 
    ? gameState.rent 
    : (isHomeowner ? (gameState.housing_name === 'Atherton 顶级豪宅' ? 5.0 : 2.0) : 4.0);
  const housingExpense = housingExpenseNum.toFixed(1);
  const carExpenseNum = gameState.car === 'porsche' ? 2.5 : gameState.car === 'cybertruck' ? 2.0 : gameState.car === 'model_y' ? 1.0 : 0.3;
  const carExpense = carExpenseNum.toFixed(1);
  const livingExpenseNum = 3.0;
  const livingExpense = livingExpenseNum.toFixed(1);
  const petExpenseNum = gameState.has_pet ? 0.3 : 0;
  const petExpense = petExpenseNum.toFixed(1);

  const totalExpense = housingExpenseNum + carExpenseNum + livingExpenseNum + petExpenseNum;
  const estNetChange = (postTaxIncomeNum + rentalIncomeNum - totalExpense).toFixed(1);
  const isNetPositive = parseFloat(estNetChange) >= 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center p-3 sm:p-4 bg-zinc-950/85 backdrop-blur-xl animate-in fade-in duration-300 overflow-y-auto">
      <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-700/80 rounded-3xl p-5 sm:p-8 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Background Accent */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

        {/* Modal Title */}
        <div className="flex justify-between items-center border-b border-zinc-800 pb-4 mb-5">
          <div>
            <span className="text-[11px] font-mono text-emerald-400 font-bold uppercase tracking-widest block">
              ANNUAL FINANCIAL & STATUS REPORT
            </span>
            <h3 className="text-2xl font-extrabold text-zinc-50 tracking-tight mt-0.5">
              第 {Math.max(1, gameState.age - 17)} 年 · 年终财务与人生账单
            </h3>
          </div>
          <span className="text-xs font-mono font-bold bg-zinc-800 text-zinc-300 px-3 py-1.5 rounded-full border border-zinc-700">
            {gameState.age} 岁
          </span>
        </div>

        {/* Latest Mid-Year Event Outcome Banner */}
        {gameState.message && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 mb-5 text-xs sm:text-sm flex flex-col gap-1.5 backdrop-blur-xl">
            <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-amber-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              <span>最新行动 / 事件反馈结果</span>
            </div>
            <div className="text-zinc-200 font-medium leading-relaxed">
              {gameState.message}
            </div>
          </div>
        )}

        {/* Net Cash Banner */}
        <div className="flex flex-col gap-2 mb-6">
          <div className={`p-4 rounded-2xl border flex justify-between items-center ${isNetPositive ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'}`}>
            <div>
              <div className="text-xs font-mono uppercase tracking-wider opacity-80">本年预估净现金流量</div>
              <div className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums mt-0.5">
                {isNetPositive ? `+$${estNetChange}w` : `-$${Math.abs(parseFloat(estNetChange)).toFixed(1)}w`}
              </div>
            </div>
            <div className="text-right font-mono">
              <div className="text-[10px] text-zinc-400 uppercase">现金总额</div>
              <div className="text-xl font-bold text-zinc-100">${gameState.cash.toFixed(1)}w</div>
            </div>
          </div>

          {(gameState.stocks !== undefined && gameState.stocks > 0) && (
            <div className="p-4 rounded-2xl border bg-indigo-500/10 border-indigo-500/30 text-indigo-300 flex justify-between items-center">
              <div>
                <div className="text-xs font-mono uppercase tracking-wider opacity-80">股票/投资组合现值</div>
                <div className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums mt-0.5">
                  ${gameState.stocks.toFixed(1)}w
                </div>
              </div>
              <div className="text-right font-mono flex flex-col justify-end">
                <div className="text-[10px] text-zinc-400 uppercase">个人净资产</div>
                <div className="text-xl font-bold text-emerald-400">${(gameState.cash + gameState.stocks).toFixed(1)}w</div>
              </div>
            </div>
          )}
        </div>

        {/* Detailed Financial Breakdown Table */}
        <div className="space-y-2.5 font-mono text-xs mb-6">
          <div className="flex justify-between items-center p-3.5 bg-zinc-950/70 rounded-2xl border border-zinc-800/80">
            <span className="text-zinc-400 flex items-center gap-2.5">
              <svg className="w-4 h-4 text-emerald-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>
              {gameState.job_type === 'trader' ? '年度操盘收益 (Cash)' : gameState.job_type === 'startup_founder' ? '创始人薪水/套现 (Cash)' : '年度 Base 薪资 (Cash)'}
            </span>
            <span className="font-bold text-emerald-400 tabular-nums">+${preTaxBase.toFixed(1)}w</span>
          </div>

          {preTaxBase > 0 && (
            <div className="flex justify-between items-center p-3.5 bg-zinc-950/70 rounded-2xl border border-zinc-800/80">
              <span className="text-zinc-400 flex items-center gap-2.5">
                <svg className="w-4 h-4 text-rose-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                {gameState.job_type === 'trader' ? '资本利得税 (-25%)' : '现金所得税 (-25%)'}
              </span>
              <span className="font-bold text-rose-400 tabular-nums">-${taxAmount}w</span>
            </div>
          )}

          {preTaxRSU > 0 && (
            <>
              <div className="flex justify-between items-center p-3.5 bg-zinc-950/70 rounded-2xl border border-zinc-800/80">
                <span className="text-zinc-400 flex items-center gap-2.5">
                  <svg className="w-4 h-4 text-emerald-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                  年度 RSU 归属 (转入股票资产)
                </span>
                <span className="font-bold text-emerald-400 tabular-nums">+${preTaxRSU.toFixed(1)}w</span>
              </div>
              <div className="flex justify-between items-center p-3.5 bg-zinc-950/70 rounded-2xl border border-zinc-800/80">
                <span className="text-zinc-400 flex items-center gap-2.5">
                  <svg className="w-4 h-4 text-rose-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                  股票所得税 (-25% 补充预扣)
                </span>
                <span className="font-bold text-rose-400 tabular-nums">-${rsuTaxAmountNum.toFixed(1)}w</span>
              </div>
            </>
          )}

          {rentalIncomeNum > 0 && (
            <div className="flex justify-between items-center p-3.5 bg-emerald-950/30 rounded-2xl border border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.1)]">
              <span className="text-emerald-300 flex items-center gap-2.5 font-bold">
                <svg className="w-4 h-4 text-emerald-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                房产出租净租金收益 (ADU/投资房)
              </span>
              <span className="font-bold text-emerald-400 tabular-nums">+${rentalIncomeNum.toFixed(1)}w</span>
            </div>
          )}

          <div className="flex justify-between items-center p-3.5 bg-zinc-950/70 rounded-2xl border border-zinc-800/80">
            <span className="text-zinc-400 flex items-center gap-2.5">
              <svg className="w-4 h-4 text-rose-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              {isHomeowner ? `自购房产维保/HOA/物业税 (${gameState.housing_name})` : `租房房租 (${gameState.housing_name || '租房'})`}
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

          {gameState.has_pet && (
            <div className="flex justify-between items-center p-3.5 bg-zinc-950/70 rounded-2xl border border-zinc-800/80">
              <span className="text-zinc-400 flex items-center gap-2.5">
                <svg className="w-4 h-4 text-amber-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a5 5 0 0 0-5 5v3a5 5 0 0 0 10 0V7a5 5 0 0 0-5-5z"/><path d="M7 14.5a4.5 4.5 0 0 0-3 4.2V21a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2.3a4.5 4.5 0 0 0-3-4.2"/></svg>
                {`宠物抚养与医疗 (${gameState.pet_name || '宠物'})`}
              </span>
              <span className="font-bold text-amber-300 tabular-nums">-${petExpense}w</span>
            </div>
          )}
        </div>

        {/* Visa & Life Status Summary */}
        <div className="bg-zinc-950/90 p-4 rounded-2xl border border-zinc-800 text-xs mb-6 space-y-2">
          <div className="flex justify-between">
            <span className="text-zinc-400 font-mono">当前签证身份:</span>
            <span className="font-bold text-amber-300">{gameState.visa}</span>
          </div>
          {(gameState.gc_progress > 0 || gameState.visa === '绿卡' || gameState.visa === '公民') && (
            <div className="flex justify-between">
              <span className="text-zinc-400 font-mono">身份/绿卡 状态进度:</span>
              <span className="font-bold text-emerald-400 font-mono tabular-nums">
                {gameState.visa === '公民' ? '100% (美籍公民)' : (gameState.visa === '绿卡' ? '100% (已获绿卡)' : `${Math.round(Math.min(100, Math.max(0, ((gameState.gc_progress || 0) / 5) * 100)))}% (${gameState.gc_progress || 0}/5 年排期)`)}
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

