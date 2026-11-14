// File: /src/components/StatusStepperIcons.tsx | Revision: Rev 16 | Version: 1.3.1 | Modified: 2026-11-14
import React from 'react';
import {
  ClipboardCheck,
  Navigation,
  Wrench,
  CheckCircle2,
  Award,
  Check,
  Lock,
} from 'lucide-react';
import { RepairJob, RepairStatus } from '../types';

export interface StatusStepDef {
  status: RepairStatus;
  shortLabel: string;
  Icon: React.FC<{ className?: string }>;
  activeBg: string;
  activeRing: string;
  activeText: string;
  badgeBg: string;
}

export const REALTIME_STATUS_STEPS: StatusStepDef[] = [
  {
    status: 'รับงาน',
    shortLabel: 'รับงาน',
    Icon: ClipboardCheck,
    activeBg: 'bg-blue-500',
    activeRing: 'ring-blue-400/40',
    activeText: 'text-blue-400',
    badgeBg: 'bg-blue-600',
  },
  {
    status: 'กำลังไป',
    shortLabel: 'กำลังไป',
    Icon: Navigation,
    activeBg: 'bg-amber-500',
    activeRing: 'ring-amber-400/40',
    activeText: 'text-amber-400',
    badgeBg: 'bg-amber-600',
  },
  {
    status: 'กำลังซ่อม',
    shortLabel: 'กำลังซ่อม',
    Icon: Wrench,
    activeBg: 'bg-purple-500',
    activeRing: 'ring-purple-400/40',
    activeText: 'text-purple-400',
    badgeBg: 'bg-purple-600',
  },
  {
    status: 'ซ่อมแล้ว',
    shortLabel: 'ซ่อมแล้ว',
    Icon: CheckCircle2,
    activeBg: 'bg-teal-500',
    activeRing: 'ring-teal-400/40',
    activeText: 'text-teal-400',
    badgeBg: 'bg-teal-600',
  },
  {
    status: 'ปิดงาน',
    shortLabel: 'ปิดงาน',
    Icon: Award,
    activeBg: 'bg-emerald-500',
    activeRing: 'ring-emerald-400/40',
    activeText: 'text-emerald-400',
    badgeBg: 'bg-emerald-600',
  },
];

export const MAIN_STATUS_ORDER: RepairStatus[] = REALTIME_STATUS_STEPS.map((s) => s.status);

export function getStatusFlowIndex(status: RepairStatus): number {
  return MAIN_STATUS_ORDER.indexOf(status);
}

export function getNextForwardStatus(currentStatus: RepairStatus): RepairStatus | null {
  const idx = getStatusFlowIndex(currentStatus);
  if (idx === -1 || idx >= MAIN_STATUS_ORDER.length - 1) {
    return null;
  }
  return MAIN_STATUS_ORDER[idx + 1];
}

export function isForwardTransitionAllowed(
  currentStatus: RepairStatus,
  nextStatus: RepairStatus
): boolean {
  if (currentStatus === nextStatus) return false;
  const currentIdx = getStatusFlowIndex(currentStatus);
  const nextIdx = getStatusFlowIndex(nextStatus);
  if (currentIdx === -1 || nextIdx === -1) return false;
  return nextIdx > currentIdx;
}

interface StatusStepperSummaryProps {
  mode: 'summary';
  variant?: 'dark' | 'light';
  jobs: RepairJob[];
  selectedStatus?: string;
  onSelectStatus?: (status: string) => void;
}

interface StatusStepperInteractiveProps {
  mode: 'interactive';
  variant?: 'light' | 'dark';
  currentStatus: RepairStatus;
  pendingStatus?: RepairStatus | null;
  allowAllSelectable?: boolean;
  onChangeStatus: (newStatus: RepairStatus) => void;
}

type StatusStepperIconsProps = StatusStepperSummaryProps | StatusStepperInteractiveProps;

export const StatusStepperIcons: React.FC<StatusStepperIconsProps> = (props) => {
  const variant = props.variant || 'light';
  const isDark = variant === 'dark';

  if (props.mode === 'interactive') {
    const currentIdx = REALTIME_STATUS_STEPS.findIndex((s) => s.status === props.currentStatus);
    const isSpecialStatus = props.currentStatus === 'ยกเลิก' || props.currentStatus === 'นัดหมายต่อ';
    const allowAll = Boolean(props.allowAllSelectable);

    return (
      <div className="w-full py-1">
        <div className="relative grid grid-cols-5 gap-1 items-start">
          {/* Connecting track line across centers of 5 columns */}
          <div className="absolute top-[18px] sm:top-[20px] left-[10%] right-[10%] h-0.5 bg-slate-200 z-0 pointer-events-none" />

          {REALTIME_STATUS_STEPS.map((step, idx) => {
            const StepIcon = step.Icon;
            const isCurrent = props.currentStatus === step.status;
            const isPending = props.pendingStatus === step.status;
            const isPassed = !isSpecialStatus && currentIdx > idx;
            const isLocked =
              !allowAll &&
              (isSpecialStatus || isCurrent || (currentIdx !== -1 && idx <= currentIdx));

            return (
              <button
                key={step.status}
                type="button"
                disabled={isLocked}
                onClick={() => {
                  if (!isLocked) {
                    props.onChangeStatus(step.status);
                  }
                }}
                className={`relative z-10 flex flex-col items-center group focus:outline-none ${
                  isLocked ? 'cursor-not-allowed' : 'cursor-pointer'
                }`}
                title={
                  isPassed && !allowAll
                    ? `ผ่านขั้นตอน "${step.status}" แล้ว (เดินหน้าทางเดียว ห้ามย้อนหลัง)`
                    : isCurrent
                    ? `สถานะปัจจุบัน: ${step.status}`
                    : isSpecialStatus && !allowAll
                    ? `กรุณากดปุ่ม "แก้ไขสถานะ" เพื่อเปลี่ยนจากสถานะ "${props.currentStatus}"`
                    : `เลือกอัปเดตสถานะเป็น "${step.status}"`
                }
              >
                <div className="relative">
                  <div
                    className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all duration-200 border-2 ${
                      isPending
                        ? 'bg-blue-600 text-white border-white ring-4 ring-blue-400/50 shadow-lg scale-110 animate-pulse'
                        : isCurrent
                        ? `${step.activeBg} text-white border-white ring-4 ${step.activeRing} shadow-md scale-110`
                        : isPassed
                        ? 'bg-emerald-500 text-white border-emerald-200 shadow-xs opacity-90'
                        : isLocked
                        ? 'bg-slate-100 text-slate-300 border-slate-200'
                        : 'bg-white text-slate-600 border-slate-300 group-hover:border-blue-500 group-hover:text-blue-600 group-hover:scale-105 shadow-2xs'
                    }`}
                  >
                    {isPassed ? (
                      <Check className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2.5]" />
                    ) : (
                      <StepIcon className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                    )}
                  </div>
                  {isPassed && !allowAll && (
                    <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-slate-700 text-white flex items-center justify-center border border-white shadow-2xs">
                      <Lock className="w-2.5 h-2.5" />
                    </span>
                  )}
                </div>
                <span
                  className={`mt-1.5 text-[10px] sm:text-[11px] leading-tight text-center truncate max-w-full px-0.5 ${
                    isPending
                      ? 'font-bold text-blue-700'
                      : isCurrent
                      ? 'font-bold text-slate-900'
                      : isPassed
                      ? 'font-semibold text-emerald-700'
                      : isLocked
                      ? 'font-medium text-slate-400'
                      : 'font-semibold text-slate-600 group-hover:text-blue-700'
                  }`}
                >
                  {step.shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Summary mode: Real-time circular horizontal status bar with live counts
  const { jobs, selectedStatus, onSelectStatus } = props;

  return (
    <div
      className={`w-full rounded-2xl px-2.5 py-3 sm:px-4 sm:py-3.5 border ${
        isDark
          ? 'bg-[#0e1a36]/90 border-blue-500/25 text-white shadow-inner'
          : 'bg-slate-50/90 border-slate-200 text-slate-800'
      }`}
    >
      <div className="flex items-center justify-between mb-2.5 px-1">
        <div className="flex items-center gap-1.5 text-[11px] font-bold">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
          <span className={isDark ? 'text-slate-200' : 'text-slate-700'}>
            สถานะรับงานเรียลไทม์
          </span>
        </div>
        {onSelectStatus && selectedStatus && selectedStatus !== 'all' && (
          <button
            type="button"
            onClick={() => onSelectStatus('all')}
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full cursor-pointer transition-colors ${
              isDark
                ? 'bg-white/10 text-blue-200 hover:bg-white/20'
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            }`}
          >
            แสดงทั้งหมด
          </button>
        )}
      </div>

      <div className="relative grid grid-cols-5 gap-1 items-start">
        {/* Horizontal connecting rail */}
        <div
          className={`absolute top-[18px] sm:top-[20px] left-[10%] right-[10%] h-0.5 z-0 pointer-events-none ${
            isDark ? 'bg-slate-700/80' : 'bg-slate-200'
          }`}
        />

        {REALTIME_STATUS_STEPS.map((step) => {
          const StepIcon = step.Icon;
          const count = jobs.filter((j) => j.status === step.status).length;
          const hasJobs = count > 0;
          const isSelected = selectedStatus === step.status;

          return (
            <button
              key={step.status}
              type="button"
              onClick={() => {
                if (onSelectStatus) {
                  onSelectStatus(isSelected ? 'all' : step.status);
                }
              }}
              className={`relative z-10 flex flex-col items-center group focus:outline-none ${
                onSelectStatus ? 'cursor-pointer' : 'cursor-default'
              }`}
              title={`${step.status}: ${count} งาน`}
            >
              <div className="relative">
                <div
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all duration-300 border ${
                    isSelected
                      ? `${step.activeBg} text-white border-white ring-4 ${step.activeRing} scale-110 shadow-lg`
                      : hasJobs
                      ? `${step.activeBg} text-white ${
                          isDark ? 'border-white/30' : 'border-white'
                        } shadow-md group-hover:scale-105`
                      : isDark
                      ? 'bg-[#17254a] text-slate-400 border-slate-700 group-hover:border-slate-500'
                      : 'bg-white text-slate-400 border-slate-200 group-hover:border-slate-300'
                  }`}
                >
                  <StepIcon className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                </div>

                {/* Live Count Pill Badge on top-right of circle */}
                <span
                  className={`absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-mono font-black flex items-center justify-center border shadow-xs tabular-nums ${
                    hasJobs
                      ? `${step.badgeBg} text-white ${isDark ? 'border-[#0e1a36]' : 'border-white'}`
                      : isDark
                      ? 'bg-slate-800 text-slate-400 border-slate-700'
                      : 'bg-slate-200 text-slate-500 border-white'
                  }`}
                >
                  {count}
                </span>
              </div>

              <span
                className={`mt-1.5 text-[10px] sm:text-[11px] leading-tight text-center truncate max-w-full px-0.5 ${
                  isSelected
                    ? isDark
                      ? 'font-bold text-white'
                      : 'font-bold text-slate-900'
                    : hasJobs
                    ? isDark
                      ? 'font-semibold text-slate-200'
                      : 'font-semibold text-slate-800'
                    : isDark
                    ? 'font-normal text-slate-400'
                    : 'font-normal text-slate-500'
                }`}
              >
                {step.shortLabel}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
