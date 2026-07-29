import React, { useRef, useEffect, useState } from 'react';
import type { GameState } from '../types';

interface WarReportModalProps {
  gameState: GameState;
  onClose: () => void;
}

export const WarReportModal: React.FC<WarReportModalProps> = ({ gameState, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set high resolution canvas dimensions (800 x 1200)
    canvas.width = 800;
    canvas.height = 1200;

    // Background Gradient (Dark Cyberpunk / Silicon Valley Theme)
    const bgGradient = ctx.createLinearGradient(0, 0, 0, 1200);
    bgGradient.addColorStop(0, '#09090b');
    bgGradient.addColorStop(0.5, '#18181b');
    bgGradient.addColorStop(1, '#09090b');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, 800, 1200);

    // Glowing Neon Accent Orbs
    const isWin = gameState.status === 'win';
    const primaryColor = isWin ? '#10b981' : '#ef4444';
    const primaryColorAlpha = isWin ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)';

    const orbGradient = ctx.createRadialGradient(700, 100, 10, 700, 100, 300);
    orbGradient.addColorStop(0, primaryColorAlpha);
    orbGradient.addColorStop(1, 'transparent');
    ctx.fillStyle = orbGradient;
    ctx.fillRect(0, 0, 800, 1200);

    // Card Outer Border
    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 4;
    ctx.strokeRect(30, 30, 740, 1140);

    // Top Header - Title
    ctx.font = '900 42px sans-serif';
    ctx.fillStyle = '#f4f4f5';
    ctx.textAlign = 'left';
    ctx.fillText('硅谷人生重启 · 最终战报', 70, 100);

    ctx.font = '600 18px monospace';
    ctx.fillStyle = primaryColor;
    ctx.fillText(isWin ? 'STATUS: FIRE ACHIEVED // 胜利通关' : 'STATUS: SURVIVAL TERMINATED // 生存终止', 70, 135);

    // Divider Line
    ctx.strokeStyle = '#3f3f46';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(70, 160);
    ctx.lineTo(730, 160);
    ctx.stroke();

    // Summary Box
    ctx.fillStyle = '#18181b';
    ctx.fillRect(70, 190, 660, 140);
    ctx.strokeStyle = isWin ? '#10b981' : '#ef4444';
    ctx.lineWidth = 2;
    ctx.strokeRect(70, 190, 660, 140);

    ctx.font = '700 24px sans-serif';
    ctx.fillStyle = isWin ? '#34d399' : '#f87171';
    ctx.fillText(isWin ? '成功撕掉社畜标签，实现财务自由！' : '硅谷生存中断战报', 95, 235);

    // Wrap long message text
    ctx.font = '500 18px sans-serif';
    ctx.fillStyle = '#a1a1aa';
    const msg = gameState.message || '硅谷风云变幻，你在这里留下了独特的足迹。';
    const words = msg.split('');
    let line = '';
    let y = 275;
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n];
      const metrics = ctx.measureText(testLine);
      if (metrics.width > 610 && n > 0) {
        ctx.fillText(line, 95, y);
        line = words[n];
        y += 26;
        if (y > 310) break;
      } else {
        line = testLine;
      }
    }
    if (y <= 310) ctx.fillText(line, 95, y);

    // Main Attributes Grid
    const drawStatBox = (x: number, y: number, w: number, h: number, label: string, val: string, color: string) => {
      ctx.fillStyle = '#18181b';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#27272a';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);

      ctx.font = '600 14px monospace';
      ctx.fillStyle = '#71717a';
      ctx.fillText(label, x + 20, y + 35);

      ctx.font = '800 32px monospace';
      ctx.fillStyle = color;
      ctx.fillText(val, x + 20, y + 80);
    };

    drawStatBox(70, 360, 315, 110, '最终现金资产 (CASH)', `$${gameState.cash.toFixed(1)}w`, '#34d399');
    drawStatBox(415, 360, 315, 110, '峰值年薪总包 (TC)', `$${gameState.tc.toFixed(1)}w`, '#f4f4f5');

    drawStatBox(70, 490, 315, 110, 'LEETCODE 解题量', `${gameState.leetcode} 题`, '#fbbf24');
    drawStatBox(415, 490, 315, 110, '存活年龄 / 奋斗时长', `${gameState.age} 岁 / 奋斗 ${Math.max(1, gameState.age - 17)} 年`, '#a78bfa');

    // Medals Section Header
    ctx.font = '700 20px monospace';
    ctx.fillStyle = '#f4f4f5';
    ctx.fillText('[ACHIEVED_MEDALS] 生涯成就荣誉勋章', 70, 650);

    const medals: { tag: string; title: string; desc: string; rarity: 'SSR' | 'SR' | 'R'; color: string }[] = [];
    
    if (gameState.leetcode >= 60) medals.push({ tag: 'ALG', title: '【做题神仙】', desc: 'LeetCode 算法手撕 Hard 题无压力', rarity: 'SSR', color: '#fbbf24' });
    if ((gameState.network || 0) >= 50) medals.push({ tag: 'NET', title: '【硅谷社交天花板】', desc: '手握强大人脉网 (Referral)，在大厂与 VC 圈游刃有余', rarity: 'SSR', color: '#38bdf8' });
    if (gameState.charm >= 24) medals.push({ tag: 'SOC', title: '【南湾顶流名流】', desc: '风采绝伦，Santana Row 社交收割机', rarity: 'SR', color: '#f43f5e' });
    if (gameState.relationship_status === 'married' || gameState.is_married) medals.push({ tag: 'REL', title: '【湾区神仙眷侣】', desc: '成功领证结婚，组成大厂双职工家庭', rarity: 'SR', color: '#f43f5e' });
    else if (gameState.relationship_status === 'dating') medals.push({ tag: 'REL', title: '【湾区甜蜜热恋】', desc: '告别单身内卷，享受温暖的情侣生活', rarity: 'R', color: '#fb7185' });
    if (gameState.cash >= 300 || ['Atherton 顶级豪宅', 'Sunnyvale 老破小', 'North San Jose 联排', 'Fremont 学区房'].includes(gameState.housing_name || '')) medals.push({ tag: 'EST', title: '【Atherton 征服者】', desc: '积攒重金，成功跨越硅谷阶级门槛', rarity: 'SSR', color: '#10b981' });
    if (gameState.car === 'porsche') medals.push({ tag: 'LUX', title: '【脱离民工车鄙视链】', desc: '开上保时捷 Porsche 震撼全场', rarity: 'SR', color: '#c084fc' });
    if (gameState.car === 'cybertruck') medals.push({ tag: 'RAW', title: '【赛博朋克硬核族】', desc: '驾驶多边形皮卡征服 237 号公路', rarity: 'SR', color: '#22d3ee' });
    if (gameState.visa === '公民') medals.push({ tag: 'SSR', title: '【出生在终点线】', desc: '天生具备美国国籍，不知 H1B 与排期为何物', rarity: 'SSR', color: '#fbbf24' });
    else if (gameState.visa === '绿卡') medals.push({ tag: 'PR', title: '【上岸自由身】', desc: '彻底甩开 USCIS 抽签与签证枷锁', rarity: 'SSR', color: '#60a5fa' });
    if (medals.length === 0) medals.push({ tag: 'SURV', title: '【硅谷打工特种兵】', desc: '在湾区高压环境中顽强奋斗', rarity: 'R', color: '#9ca3af' });

    let medalY = 680;
    medals.forEach((m) => {
      ctx.fillStyle = '#18181b';
      ctx.fillRect(70, medalY, 660, 65);
      ctx.strokeStyle = m.color;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(70, medalY, 660, 65);

      // Rarity Badge
      ctx.fillStyle = m.color;
      ctx.fillRect(85, medalY + 15, 50, 35);
      ctx.font = '900 14px monospace';
      ctx.fillStyle = '#09090b';
      ctx.fillText(m.rarity, 95, medalY + 38);

      ctx.font = '700 18px sans-serif';
      ctx.fillStyle = m.color;
      ctx.fillText(m.title, 150, medalY + 38);

      ctx.font = '400 14px sans-serif';
      ctx.fillStyle = '#a1a1aa';
      ctx.fillText(m.desc, 340, medalY + 38);

      medalY += 75;
    });

    // Footer - Branding & QR code simulation
    ctx.fillStyle = '#18181b';
    ctx.fillRect(70, 1020, 660, 110);
    ctx.strokeStyle = '#3f3f46';
    ctx.lineWidth = 1;
    ctx.strokeRect(70, 1020, 660, 110);

    ctx.font = '700 20px sans-serif';
    ctx.fillStyle = '#f4f4f5';
    ctx.fillText('硅谷人生重启 (SV Life Reboot)', 95, 1060);
    ctx.font = '400 14px monospace';
    ctx.fillStyle = '#71717a';
    ctx.fillText('扫描或搜索加入湾区打工人模拟挑战', 95, 1090);

    // QR Code Box Placeholder
    ctx.fillStyle = '#27272a';
    ctx.fillRect(630, 1035, 80, 80);
    ctx.font = '900 24px monospace';
    ctx.fillStyle = '#10b981';
    ctx.fillText('SV', 655, 1083);

    // Export Data URL
    setDataUrl(canvas.toDataURL('image/png'));
  }, [gameState]);

  const handleDownload = () => {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `SV_Life_Reboot_Report_${Date.now()}.png`;
    a.click();
  };

  const handleShare = async () => {
    if (!dataUrl) return;
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], 'SV_Life_Reboot_Report.png', { type: 'image/png' });
      
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: '硅谷人生重启 - 最终战报',
          text: '快来看看我在《硅谷人生重启》里的最终资产！你也来挑战试试吧！',
          files: [file]
        });
      } else {
        handleDownload(); // Fallback if Web Share API doesn't support files
      }
    } catch (e) {
      console.error('Sharing failed', e);
      handleDownload(); // Fallback on error
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center p-4 sm:p-6 bg-zinc-950/90 backdrop-blur-2xl overflow-y-auto animate-in fade-in duration-300">
      <div className="relative w-full max-w-xl bg-zinc-900 border border-zinc-700/80 rounded-3xl p-6 shadow-2xl my-8 flex flex-col items-center">
        <div className="flex justify-between items-center w-full mb-4 pb-2 border-b border-zinc-800">
          <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            炫彩战报已生成 (READY TO SHARE)
          </span>
          <button
            onClick={onClose}
            className="text-xs text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-3 py-1 rounded-full font-bold border border-zinc-700 active:scale-95 transition-all cursor-pointer"
          >
            关闭 
          </button>
        </div>

        {/* Hidden Canvas Element */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Rendered PNG Image Preview */}
        {dataUrl ? (
          <img
            src={dataUrl}
            alt="SV Life Reboot War Report"
            className="w-full max-w-md rounded-2xl border border-zinc-700 shadow-2xl mb-6"
          />
        ) : (
          <div className="w-full h-96 flex items-center justify-center text-zinc-500 font-mono">
            生成战报海报中...
          </div>
        )}

        {/* Download / Share Actions */}
        <div className="flex gap-4 w-full max-w-md">
          <button
            onClick={handleDownload}
            className="flex-1 py-3.5 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-bold text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>保存到相册</span>
          </button>
          
          <button
            onClick={handleShare}
            className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-zinc-950 font-bold text-sm transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3"></circle>
              <circle cx="6" cy="12" r="3"></circle>
              <circle cx="18" cy="19" r="3"></circle>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
            </svg>
            <span>一键分享炫耀</span>
          </button>
        </div>
      </div>
    </div>
  );
};
