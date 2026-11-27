// File: /src/components/OverdueTwoDaysAlarmModal.tsx | Revision: Rev 21 | Version: 1.5.2 | Modified: 2026-11-16
import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Volume2,
  VolumeX,
  CheckCircle2,
  Clock,
  Calendar,
  User,
  Phone,
  ExternalLink,
} from 'lucide-react';
import { RepairJob } from '../types';
import { warrantyAlarmService } from '../services/soundAlarm';
import { OverdueTwoDaysItem } from '../services/appointmentAlarm';

interface OverdueTwoDaysAlarmModalProps {
  overdueItems: OverdueTwoDaysItem[];
  isOpen: boolean;
  onAcknowledge: () => void;
  onSelectJob?: (job: RepairJob) => void;
}

export const OverdueTwoDaysAlarmModal: React.FC<OverdueTwoDaysAlarmModalProps> = ({
  overdueItems,
  isOpen,
  onAcknowledge,
  onSelectJob,
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const count = overdueItems.length;

  const buildSpeechText = (): string => {
    if (count === 0) return '';
    return `มีงานค้างยังไม่ปิดงานเกิน 2 วัน กดเพื่อยืนยัน (${count} รายการ)`;
  };

  useEffect(() => {
    if (!isOpen || count === 0) return;

    setElapsedSeconds(0);

    if (!isMuted) {
      warrantyAlarmService.startAlarm(buildSpeechText());
    } else {
      warrantyAlarmService.stopAlarm();
    }

    const timerId = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => {
      window.clearInterval(timerId);
      warrantyAlarmService.stopAlarm();
    };
  }, [isOpen, count, isMuted]);

  if (!isOpen || count === 0) return null;

  const formatElapsed = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleConfirm = () => {
    warrantyAlarmService.stopAlarm();
    onAcknowledge();
  };

  return (
    <div className="fixed inset-0 z-[88] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border-2 border-amber-500 overflow-hidden my-4 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 text-white p-4 sm:p-5 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-white text-orange-600 flex items-center justify-center shadow-lg shrink-0 animate-bounce">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-black/25 text-amber-100 text-[11px] font-bold mb-1">
                <span>แจ้งเตือนงานค้างเกินกำหนด</span>
              </div>
              <h2 className="text-base sm:text-lg font-black leading-tight text-white">
                มีงานค้างยังไม่ปิดงานเกิน 2 วัน ({count} งาน)
              </h2>
              <p className="text-xs text-amber-100 mt-0.5">
                &quot;มีงานค้างยังไม่ปิดงานเกิน2วัน กดเพื่อยืนยัน&quot;
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsMuted(!isMuted)}
            className="p-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white transition-colors shrink-0 cursor-pointer"
            title={isMuted ? 'เปิดเสียงเตือน' : 'ปิดเสียงชั่วคราว'}
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5 animate-pulse" />}
          </button>
        </div>

        {/* Audio Banner */}
        <div className="px-4 sm:px-5 pt-4">
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-2 text-xs text-amber-950">
            <div className="flex items-center gap-2 font-semibold">
              <Volume2 className={`w-4 h-4 text-orange-600 shrink-0 ${!isMuted ? 'animate-pulse' : ''}`} />
              <span>
                {isMuted
                  ? 'ปิดเสียงชั่วคราว (ยังรอการกดยืนยัน)'
                  : 'กำลังส่งเสียงเตือน: "มีงานค้างยังไม่ปิดงานเกิน2วัน กดเพื่อยืนยัน"'}
              </span>
            </div>
            <span className="font-mono font-bold text-orange-700 tabular-nums shrink-0">
              {formatElapsed(elapsedSeconds)}
            </span>
          </div>
        </div>

        {/* Overdue Jobs List */}
        <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-2.5 max-h-[45vh]">
          {overdueItems.map(({ job, overdueDays, overdueHours, referenceDateStr }) => {
            const remHours = overdueHours % 24;
            return (
              <div
                key={job.id}
                className="p-3.5 rounded-2xl bg-slate-50 border border-amber-200 hover:border-orange-400 transition-all space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono font-black text-xs bg-orange-600 text-white px-2 py-0.5 rounded-md shrink-0">
                      {job.queueNumber}
                    </span>
                    <span className="font-bold text-sm text-slate-900 truncate">
                      {job.product}
                    </span>
                  </div>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200 shrink-0">
                    ค้าง {overdueDays} วัน{remHours > 0 ? ` ${remHours} ชม.` : ''}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate font-medium text-slate-800">{job.customer.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-mono">{job.customer.phone}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>นัด/รับงาน: {referenceDateStr}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                    <span>
                      สถานะปัจจุบัน: <strong className="text-orange-700">{job.status}</strong>
                    </span>
                  </div>
                </div>

                {onSelectJob && (
                  <div className="flex justify-end pt-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        warrantyAlarmService.stopAlarm();
                        onSelectJob(job);
                      }}
                      className="text-[11px] text-blue-600 hover:text-blue-800 font-bold inline-flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <span>เปิดดู / ปิดงานซ่อม</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer Confirm */}
        <div className="p-4 bg-slate-50 border-t border-slate-200">
          <button
            type="button"
            onClick={handleConfirm}
            className="w-full py-3 px-5 rounded-2xl bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-extrabold text-sm shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>กดเพื่อยืนยันรับทราบ &amp; ปิดเสียงเตือน</span>
          </button>
        </div>
      </div>
    </div>
  );
};
