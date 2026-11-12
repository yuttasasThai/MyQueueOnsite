// File: /src/components/HeroCover.tsx | Revision: Rev 8 | Version: 1.2.3 | Modified: 2026-11-12
import React, { useState } from 'react';
import { Clock, ArrowRight, Wrench, Plus, RotateCcw, AlertTriangle, X, CheckCircle2 } from 'lucide-react';
import { RepairJob, ShopSettings } from '../types';
import { APP_VERSION, APP_REVISION } from '../version';

interface HeroCoverProps {
  jobs: RepairJob[];
  settings?: ShopSettings;
  onOpenNewJob: () => void;
  onNavigateToQueue?: () => void;
  isAdmin?: boolean;
  onOpenSettings?: () => void;
  onNavigateToDashboard?: () => void;
  onClearAllJobs?: () => void;
}

export const HeroCover: React.FC<HeroCoverProps> = ({
  jobs,
  settings,
  onOpenNewJob,
  onNavigateToQueue,
  onClearAllJobs,
}) => {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetSuccessNotice, setResetSuccessNotice] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];

  // คิวงานใหม่วันนี้ (loggedDate เป็นวันนี้ หรือ appointmentDate เป็นวันนี้)
  const todayNewJobs = jobs.filter(
    (j) => j.loggedDate === todayStr || j.appointmentDate === todayStr
  );

  // คิวงานเก่า (งานก่อนวันนี้)
  const oldJobs = jobs.filter(
    (j) => j.loggedDate !== todayStr && j.appointmentDate !== todayStr
  );

  const pendingOldJobs = oldJobs.filter(
    (j) => j.status !== 'ปิดงาน' && j.status !== 'ยกเลิก'
  );

  // Use the active toolbag icon selected by user/admin from settings
  const toolbagImage =
    settings?.coverImage && settings.coverImage.startsWith('/assets/aistudio/')
      ? settings.coverImage
      : '/assets/aistudio/icon_1_893a5ecf.png';

  const handleConfirmReset = () => {
    if (onClearAllJobs) {
      onClearAllJobs();
      setShowResetConfirm(false);
      setResetSuccessNotice(true);
      setTimeout(() => setResetSuccessNotice(false), 3000);
    }
  };

  return (
    <section className="w-full max-w-xl mx-auto bg-gradient-to-b from-[#111c38] via-[#0d162e] to-[#0a1024] text-white rounded-3xl shadow-[0_24px_60px_-12px_rgba(0,0,0,0.7),0_0_0_1px_rgba(59,130,246,0.3),inset_0_1px_1px_rgba(255,255,255,0.15)] p-5 sm:p-7 relative overflow-hidden flex flex-col items-center text-center">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-40 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />

      {/* Top Pill: เวอร์ชั่นแสดงเเค่ตัวเลข ต่อจาก ระบบคิวงานซ่อม onsite version xxxx */}
      <div className="relative z-10 mb-3">
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-blue-500/20 text-blue-200 text-xs font-semibold border border-blue-400/30 shadow-xs">
          <Wrench className="w-3.5 h-3.5 text-emerald-400" />
          <span>
            ระบบคิวงานซ่อม Onsite version {APP_VERSION} ({APP_REVISION})
          </span>
        </div>
      </div>

      {/* Title & Subtitle */}
      <div className="relative z-10 mb-4 space-y-1">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white font-['Plus_Jakarta_Sans',sans-serif]">
          {settings?.coverTitle || 'Repair Onsite Service'}
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 font-medium">
          {settings?.coverSubtitle || 'ช่างหน่อยชุมแพ'}
        </p>
      </div>

      {/* Center: Toolbag Icon & "+ กดเพื่อสร้างคิวงานใหม่" Button with Modern Dimensional Bezel Frame */}
      <div className="relative z-10 my-2 flex flex-col items-center">
        {/* Toolbag Button with Modern Dimensional Border (ขอบรูปทันสมัยและมีมิติ) */}
        <button
          type="button"
          onClick={onOpenNewJob}
          className="group relative flex flex-col items-center justify-center focus:outline-none cursor-pointer select-none transition-all duration-300"
          title="กดเพื่อสร้างคิวงานใหม่"
        >
          {/* Ambient Lighting Glow Behind Frame */}
          <div className="absolute -inset-2 bg-gradient-to-r from-emerald-500/25 via-cyan-400/20 to-blue-600/30 rounded-[34px] blur-xl opacity-75 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500 pointer-events-none" />

          {/* Dimensional Frame (ขอบรูปทันสมัยและมีมิติ มีแสงสะท้อนและขอบหลายชั้น) */}
          <div className="relative p-[2.5px] rounded-[30px] bg-gradient-to-br from-emerald-400/80 via-teal-400/40 to-blue-600/70 shadow-[0_16px_36px_rgba(0,0,0,0.7),inset_0_1px_2px_rgba(255,255,255,0.45)] group-hover:shadow-[0_20px_45px_rgba(16,185,129,0.45),inset_0_1px_2px_rgba(255,255,255,0.7)] group-hover:scale-[1.02] transition-all duration-300">
            {/* Inner Glass Chamber */}
            <div className="relative rounded-[27px] bg-gradient-to-b from-[#16254a]/95 via-[#0e1832]/98 to-[#070b18] p-3 sm:p-4 backdrop-blur-xl border border-white/10 ring-1 ring-white/10 overflow-hidden shadow-[inset_0_2px_10px_rgba(0,0,0,0.8),inset_0_-2px_6px_rgba(16,185,129,0.2)]">
              {/* Glossy diagonal sheen reflection */}
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/20 rounded-[27px] pointer-events-none" />

              {/* Modern Tech Corner Brackets */}
              <div className="absolute top-2.5 left-2.5 w-2.5 h-2.5 border-t-2 border-l-2 border-emerald-400/90 rounded-tl-sm pointer-events-none shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
              <div className="absolute top-2.5 right-2.5 w-2.5 h-2.5 border-t-2 border-r-2 border-emerald-400/90 rounded-tr-sm pointer-events-none shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
              <div className="absolute bottom-2.5 left-2.5 w-2.5 h-2.5 border-b-2 border-l-2 border-cyan-400/90 rounded-bl-sm pointer-events-none shadow-[0_0_6px_rgba(34,211,238,0.8)]" />
              <div className="absolute bottom-2.5 right-2.5 w-2.5 h-2.5 border-b-2 border-r-2 border-cyan-400/90 rounded-br-sm pointer-events-none shadow-[0_0_6px_rgba(34,211,238,0.8)]" />

              {/* Toolbag Image: ขนาดพอดีตามในหน้าแดชบอร์ด */}
              <div className="relative z-10 w-36 h-36 sm:w-44 sm:h-44 flex items-center justify-center">
                <img
                  src={toolbagImage}
                  alt="สร้างคิวงานใหม่"
                  className="w-full h-full object-contain filter drop-shadow-[0_12px_22px_rgba(0,0,0,0.85)] group-hover:drop-shadow-[0_18px_32px_rgba(16,185,129,0.65)] group-hover:-translate-y-1 transition-all duration-300"
                />
              </div>

              {/* 3D Pedestal Floor Reflection under the toolbox */}
              <div className="w-28 h-3.5 bg-gradient-to-r from-emerald-500/0 via-emerald-400/40 to-emerald-500/0 rounded-full blur-xs mx-auto -mt-2 group-hover:via-emerald-400/70 transition-all duration-300 pointer-events-none" />
            </div>
          </div>

          {/* Button: + กดเพื่อสร้างคิวงานใหม่ */}
          <div className="relative z-10 mt-3.5 px-6 py-2.5 rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-600 hover:from-emerald-400 hover:to-blue-500 text-white font-bold text-sm tracking-wide shadow-[0_8px_20px_rgba(16,185,129,0.35)] border border-emerald-300/50 flex items-center gap-2 group-hover:scale-105 active:scale-95 transition-all">
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>กดเพื่อสร้างคิวงานใหม่</span>
          </div>
        </button>
      </div>

      {/* Success Notification after Reset */}
      {resetSuccessNotice && (
        <div className="relative z-10 mt-3 p-2.5 bg-emerald-500/20 border border-emerald-400/50 text-emerald-200 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>ล้างข้อมูลเก่าเรียบร้อยแล้ว พร้อมเริ่มต้นบันทึกคิวใหม่</span>
        </div>
      )}

      {/* Bottom Summary Boxes (แสดงสั้นๆ ตามภาพที่แนบ) */}
      <div className="relative z-10 w-full max-w-sm mt-5 space-y-2.5 text-xs">
        {/* คิวงานใหม่วันนี้ */}
        <div className="flex items-center justify-between bg-[#0e2a22] border border-emerald-500/40 px-4 py-2.5 rounded-xl text-emerald-200">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
            <span className="font-medium">คิวงานใหม่วันนี้มี:</span>
          </div>
          <div>
            <strong className="text-white font-mono text-base font-black tabular-nums mr-1">
              {todayNewJobs.length}
            </strong>
            <span>งาน</span>
          </div>
        </div>

        {/* คิวงานเก่า */}
        <div className="flex items-center justify-between bg-[#152342] border border-slate-700 px-4 py-2.5 rounded-xl text-slate-300">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="font-medium">คิวงานเก่า:</span>
            <strong className="text-amber-300 font-mono text-base font-black tabular-nums">
              {oldJobs.length}
            </strong>
            <span>งาน</span>
          </div>
          <span className="text-[11px] text-slate-400">
            (ค้างซ่อม {pendingOldJobs.length} งาน)
          </span>
        </div>

        {/* Actions row: ดูรายการคิวงานทั้งหมด & ปุ่มล้างข้อมูลเก่า */}
        <div className="pt-1 flex items-center justify-between gap-2">
          {onNavigateToQueue && (
            <button
              type="button"
              onClick={onNavigateToQueue}
              className="text-xs text-blue-300 hover:text-white inline-flex items-center gap-1.5 font-semibold transition-colors hover:underline cursor-pointer"
            >
              <span>ดูคิวงานทั้งหมด ({jobs.length} งาน)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {/* ปุ่มล้างข้อมูลเก่า เพื่อเริ่มต้นใช้งานใหม่ */}
          {onClearAllJobs && (
            <button
              type="button"
              onClick={() => setShowResetConfirm(true)}
              className="text-[11px] text-slate-400 hover:text-red-300 hover:bg-red-950/40 px-2.5 py-1 rounded-lg border border-slate-800 transition-colors inline-flex items-center gap-1 cursor-pointer ml-auto"
              title="ล้างข้อมูลคิวงานเก่าทั้งหมด เพื่อเริ่มต้นรับงานใหม่"
            >
              <RotateCcw className="w-3 h-3 text-red-400" />
              <span>ล้างข้อมูลเก่า</span>
            </button>
          )}
        </div>
      </div>

      {/* Modal: ยืนยันการล้างข้อมูลเก่า เพื่อเริ่มต้นใช้งานใหม่ */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-slate-900 text-center space-y-4 shadow-2xl border-2 border-red-200 animate-in fade-in zoom-in-95">
            <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto shadow-inner">
              <AlertTriangle className="w-8 h-8 animate-bounce" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                ล้างข้อมูลเก่า เพื่อเริ่มต้นใช้งานใหม่?
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                ระบบจะล้างรายการคิวงานเก่าทั้งหมดออก เพื่อให้คุณเริ่มต้นใช้งานโปรแกรมใหม่ได้อย่างสะอาดเรียบร้อย และเริ่มนับคิวงานใหม่จาก <strong>Q-01</strong>
              </p>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs shadow-md transition-colors cursor-pointer"
              >
                ยืนยันล้างข้อมูล
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
