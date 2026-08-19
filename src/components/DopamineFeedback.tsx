import React, { useMemo } from 'react';
import { gameRandom } from '../utils/random';

export interface DopaminePill {
  id: string;
  text: string;
  subtext?: string;
  type: 'cash_up' | 'cash_down' | 'promo' | 'tc_up' | 'heal' | 'damage' | 'leetcode' | 'impact' | 'offer_win' | 'layoff' | 'special';
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

export type ScreenEffectType = 'none' | 'gold_celebration' | 'red_threat' | 'blue_promotion';

interface DopamineFeedbackProps {
  pills: DopaminePill[];
  screenEffect: ScreenEffectType;
}

export const DopamineFeedback: React.FC<DopamineFeedbackProps> = ({ pills, screenEffect }) => {
  // Generate deterministic particles for confetti when gold celebration is active
  const confettiParticles = useMemo(() => {
    if (screenEffect !== 'gold_celebration' && screenEffect !== 'blue_promotion') return [];
    const colors = screenEffect === 'gold_celebration' 
      ? ['#fbbf24', '#f59e0b', '#10b981', '#34d399', '#f43f5e', '#a855f7', '#38bdf8']
      : ['#38bdf8', '#818cf8', '#c084fc', '#34d399', '#60a5fa'];
    
    return Array.from({ length: 36 }).map((_, i) => {
      const left = gameRandom() * 100;
      const animDelay = gameRandom() * 0.8;
      const animDuration = 2.0 + gameRandom() * 1.5;
      const size = 6 + gameRandom() * 8;
      const driftX = (gameRandom() - 0.5) * 200;
      const rot = (gameRandom() - 0.5) * 1080;
      const color = colors[i % colors.length];
      const isCircle = i % 3 === 0;

      return {
        id: `confetti-${i}`,
        left: `${left}%`,
        animDelay: `${animDelay}s`,
        animDuration: `${animDuration}s`,
        size: `${size}px`,
        color,
        isCircle,
        style: {
          left: `${left}%`,
          top: '-15px',
          width: `${size}px`,
          height: isCircle ? `${size}px` : `${size * 1.6}px`,
          backgroundColor: color,
          borderRadius: isCircle ? '50%' : '2px',
          animationDelay: `${animDelay}s`,
          animationDuration: `${animDuration}s`,
          '--tw-confetti-x': `${driftX}px`,
          '--tw-confetti-r': `${rot}deg`,
        } as React.CSSProperties,
      };
    });
  }, [screenEffect]);

  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      {/* 1. Screen-Level Red Threat Glitch / Vignette */}
      {screenEffect === 'red_threat' && (
        <div 
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-b from-red-600/25 via-transparent to-red-950/40 animate-red-vignette border-4 border-red-500/40 pointer-events-none"
        />
      )}

      {/* 2. Golden High-Impact Celebration Shimmer */}
      {screenEffect === 'gold_celebration' && (
        <div 
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-b from-amber-500/15 via-emerald-500/10 to-transparent animate-golden-shimmer pointer-events-none"
        />
      )}

      {/* 3. Blue/Indigo Promotion Shimmer */}
      {screenEffect === 'blue_promotion' && (
        <div 
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-b from-sky-500/15 via-indigo-500/10 to-transparent animate-golden-shimmer pointer-events-none"
        />
      )}

      {/* 4. Confetti Particles Burst */}
      {confettiParticles.length > 0 && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {confettiParticles.map((p) => (
            <div
              key={p.id}
              className="absolute animate-confetti shadow-sm"
              style={p.style}
            />
          ))}
        </div>
      )}

      {/* 5. Floating Stat Delta Badges (Right Top / Center Floating Dock) */}
      <div 
        aria-live="polite" 
        className="fixed top-20 sm:top-24 right-4 sm:right-8 flex flex-col items-end gap-2.5 max-w-xs sm:max-w-sm pointer-events-none z-50"
      >
        {pills.map((pill, idx) => (
          <div
            key={pill.id}
            style={{
              animationDelay: `${idx * 0.1}s`,
            }}
            className={`animate-float-pill flex items-center gap-2 px-3.5 py-2 rounded-2xl shadow-xl backdrop-blur-xl border ${pill.bgColor} ${pill.borderColor} pointer-events-none`}
          >
            <span className="text-base shrink-0 select-none">{pill.icon}</span>
            <div className="flex flex-col">
              <span className={`font-mono font-black text-xs sm:text-sm tracking-tight ${pill.color}`}>
                {pill.text}
              </span>
              {pill.subtext && (
                <span className="font-sans font-medium text-[10px] text-zinc-400 leading-tight">
                  {pill.subtext}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
