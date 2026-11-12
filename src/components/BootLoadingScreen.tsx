// File: /src/components/BootLoadingScreen.tsx | Revision: Rev 7 | Version: 1.2.2 | Modified: 2026-11-11
import React, { useState, useEffect } from 'react';
import { Terminal, Cpu, Wrench, Sparkles, CheckCircle2 } from 'lucide-react';
import { APP_VERSION, APP_REVISION } from '../version';

interface BootLoadingScreenProps {
  onComplete: () => void;
  userName?: string;
}

export const BootLoadingScreen: React.FC<BootLoadingScreenProps> = ({
  onComplete,
  userName = 'ผู้ใช้งาน',
}) => {
  const [progress, setProgress] = useState(0);
  const [typedText, setTypedText] = useState('');
  const fullText = 'สร้างสรรค์โดยช่างหน่อยชุมแพ';
  const [bootLogs, setBootLogs] = useState<string[]>([]);

  // 1. Typewriter effect for "สร้างสรรค์โดยช่างหน่อยชุมแพ"
  useEffect(() => {
    let currentIndex = 0;
    const interval = setInterval(() => {
      if (currentIndex <= fullText.length) {
        setTypedText(fullText.slice(0, currentIndex));
        currentIndex++;
      } else {
        clearInterval(interval);
      }
    }, 65); // ~1.8 seconds to type complete phrase

    return () => clearInterval(interval);
  }, []);

  // 2. Boot progress from 0 to 100 over 3.5 seconds (3-4 วิ)
  useEffect(() => {
    const startTime = Date.now();
    const duration = 3500; // 3.5 seconds

    const logMessages = [
      { time: 300, text: 'CORE: Initializing Onsite Repair Service v' + APP_VERSION + '...' },
      { time: 900, text: 'DATABASE: Loading offline cache & active job queues... OK' },
      { time: 1600, text: 'AUTH: Session validated - no startup password required.' },
      { time: 2300, text: 'MODULES: Calendar, warranty alarms & LINE Notify ready.' },
      { time: 3000, text: 'SYSTEM: Boot sequence 100% complete. Launching app...' },
    ];

    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / duration) * 100));
      setProgress(pct);

      const currentLogs = logMessages
        .filter((m) => elapsed >= m.time)
        .map((m) => m.text);
      setBootLogs(currentLogs);

      if (elapsed >= duration) {
        clearInterval(timer);
        setTimeout(() => {
          onComplete();
        }, 150);
      }
    }, 40);

    return () => clearInterval(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-emerald-400 flex flex-col items-center justify-center p-4 font-mono select-none">
      {/* Background radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.12)_0%,rgba(2,6,23,0.98)_75%)] pointer-events-none" />

      <div className="max-w-md w-full bg-slate-900/90 border border-emerald-500/30 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 relative z-10 backdrop-blur-md">
        {/* Terminal Header */}
        <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3 text-xs">
          <div className="flex items-center gap-2 text-emerald-300">
            <Terminal className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span className="font-bold tracking-wider uppercase">System Booting</span>
          </div>
          <span className="text-[11px] text-emerald-400/80 font-mono">
            v{APP_VERSION} ({APP_REVISION})
          </span>
        </div>

        {/* Center: Animated Toolbox Boot Icon */}
        <div className="py-2 text-center space-y-3">
          <div className="relative inline-block mx-auto">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border-2 border-emerald-400/50 p-2 flex items-center justify-center shadow-lg relative group">
              {/* Spinning glow ring */}
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 opacity-30 blur-sm animate-pulse" />
              <img
                src="/assets/aistudio/icon_1_893a5ecf.png"
                alt="Boot Toolbox Icon"
                className="w-full h-full object-contain relative z-10 animate-bounce"
                style={{ animationDuration: '2s' }}
                onError={(e) => {
                  // Fallback if image path differs
                  e.currentTarget.style.display = 'none';
                }}
              />
              <Wrench className="w-10 h-10 text-emerald-400 absolute z-0" />
            </div>
          </div>

          {/* Typewriter text line "สร้างสรรค์โดยช่างหน่อยชุมแพ" */}
          <div className="pt-1">
            <div className="min-h-[36px] flex items-center justify-center">
              <span className="text-lg sm:text-xl font-bold text-white tracking-wide font-sans">
                {typedText}
              </span>
              <span className="inline-block w-2.5 h-5 bg-emerald-400 ml-1.5 animate-pulse" />
            </div>
            <p className="text-xs text-emerald-400/80 mt-1 font-sans">
              ระบบคิวงานซ่อมนอกสถานที่ (MyQueue Onsite Service)
            </p>
          </div>
        </div>

        {/* Boot Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-emerald-300">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
              <span>กำลังเตรียมความพร้อมระบบ...</span>
            </span>
            <span className="font-bold font-mono text-emerald-200">{progress}%</span>
          </div>
          <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden border border-emerald-500/30 p-0.5">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300 rounded-full transition-all duration-75"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Diagnostic logs */}
        <div className="bg-slate-950/80 p-3 rounded-xl border border-emerald-500/20 text-[11px] text-emerald-400/90 space-y-1 min-h-[90px] font-mono leading-tight">
          {bootLogs.map((log, index) => (
            <div key={index} className="flex items-center gap-1.5">
              <span className="text-emerald-600">&gt;</span>
              <span className="truncate">{log}</span>
            </div>
          ))}
        </div>

        {/* Footer info */}
        <div className="text-center text-[10px] text-slate-500 pt-1 border-t border-slate-800 font-sans">
          <span>ติดต่อผู้ดูแลระบบ: ช่างหน่อยชุมแพ 099-2256601</span>
        </div>
      </div>
    </div>
  );
};
