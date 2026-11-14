// File: /src/components/DailyQueueAlarmModal.tsx | Revision: Rev 15 | Version: 1.3.0 | Modified: 2026-11-13
import React, { useEffect, useState } from 'react';
import {
  BellRing,
  Volume2,
  VolumeX,
  CheckCircle,
  Clock,
  Calendar,
  User,
  Wrench,
  Phone,
  ExternalLink,
} from 'lucide-react';
import { RepairJob } from '../types';
import { warrantyAlarmService } from '../services/soundAlarm';

const FIVE_MINUTES_MS = 5 * 60 * 1000;

interface DailyQueueAlarmModalProps {
  pendingJobs: RepairJob[];
  isOpen: boolean;
  onAcknowledge: () => void;
  onSelectJob?: (job: RepairJob) => void;
}

export const DailyQueueAlarmModal: React.FC<DailyQueueAlarmModalProps> = ({
  pendingJobs,
  isOpen,
  onAcknowledge,
  onSelectJob,
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [autoStopped, setAutoStopped] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(300);

  const buildSpeechText = (): string => {
    const count = pendingJobs.length;
    if (count === 0) return '';
    return `แจ้งเตือนคิวงานวันนี้ วันนี้มี ${count} คิวงาน ที่ยังไม่ได้ซ่อม กดยืนยันเพื่อรับทราบ`;
  };

  useEffect(() => {
    if (isOpen && pendingJobs.length > 0) {
      setIsMuted(false);
      setAutoStopped(false);
      setSecondsLeft(300);

      const speech = buildSpeechText();
      warrantyAlarmService.startAlarm(speech, FIVE_MINUTES_MS, () => {
        setAutoStopped(true);
        setSecondsLeft(0);
      });

      const timer = window.setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        window.clearInterval(timer);
        warrantyAlarmService.stopAlarm();
      };
    } else {
      warrantyAlarmService.stopAlarm();
    }
  }, [isOpen, pendingJobs.length]);

  const handleToggleMute = () => {
    if (isMuted || autoStopped) {
      setAutoStopped(false);
      setIsMuted(false);
      setSecondsLeft(300);
      warrantyAlarmService.startAlarm(buildSpeechText(), FIVE_MINUTES_MS, () => {
        setAutoStopped(true);
        setSecondsLeft(0);
      });
    } else {
      warrantyAlarmService.stopAlarm();
      setIsMuted(true);
    }
  };

  const handleConfirmAcknowledge = () => {
    warrantyAlarmService.stopAlarm();
    onAcknowledge();
  };

  const formatCountdown = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  if (!isOpen || pendingJobs.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl border-2 border-amber-400 space-y-5 relative overflow-hidden my-6 max-h-[92vh] flex flex-col">
        {/* Urgent Header Banner */}
        <div className="relative -mx-5 -mt-5 sm:-mx-6 sm:-mt-6 p-5 bg-gradient-to-r from-blue-700 via-indigo-700 to-amber-600 text-white shadow-md">
          <div className="flex items-start justify-between gap-3 relative z-10">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-white text-blue-700 flex items-center justify-center shadow-lg shrink-0">
                <BellRing className={`w-6 h-6 ${!isMuted && !autoStopped ? 'animate-bounce' : ''}`} />
              </div>
              <div className="min-w-0">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-amber-100 text-[11px] font-bold mb-1 border border-white/20">
                  <Calendar className="w-3 h-3" />
                  <span>แจ้งเตือนคิวงานประจำวัน</span>
                </div>
                <h2 className="text-lg sm:text-xl font-black tracking-tight text-white">
                  วันนี้มี {pendingJobs.length} คิวงาน ที่ยังไม่ได้ซ่อม
                </h2>
                <p className="text-xs text-blue-100 mt-0.5">
                  กดยืนยันเพื่อรับทราบ (เสียงเตือนจะหยุดอัตโนมัติใน 5 นาที)
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleToggleMute}
              className={`px-2.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
                isMuted || autoStopped
                  ? 'bg-slate-900/50 border-white/30 text-white hover:bg-slate-900/70'
                  : 'bg-white text-blue-700 border-white hover:bg-blue-50 shadow-md'
              }`}
              title={isMuted || autoStopped ? 'เปิดเสียงเตือนอีกครั้ง' : 'ปิดเสียงชั่วคราว'}
            >
              {isMuted || autoStopped ? (
                <>
                  <VolumeX className="w-4 h-4" />
                  <span className="hidden sm:inline">เงียบเสียง</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4 animate-pulse text-blue-600" />
                  <span className="hidden sm:inline font-bold">กำลังแจ้งเตือน</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Sound & Auto-stop Countdown Status */}
        <div
          className={`flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl border text-xs ${
            autoStopped
              ? 'bg-slate-100 border-slate-300 text-slate-700'
              : isMuted
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-blue-50 border-blue-200 text-blue-900'
          }`}
        >
          <div className="flex items-center gap-2 font-semibold">
            <Volume2 className={`w-4 h-4 shrink-0 ${!isMuted && !autoStopped ? 'text-blue-600 animate-pulse' : 'text-slate-400'}`} />
            <span>
              {autoStopped
                ? 'ครบ 5 นาทีแล้ว ระบบหยุดเสียงเตือนอัตโนมัติ'
                : isMuted
                ? 'ปิดเสียงเตือนชั่วคราว'
                : `กำลังส่งเสียงเตือน: "วันนี้มี ${pendingJobs.length} คิวงาน กดยืนยันเพื่อรับทราบ"`}
            </span>
          </div>
          {!autoStopped && !isMuted && (
            <span className="font-mono text-[11px] font-bold bg-white text-blue-700 px-2.5 py-0.5 rounded-full border border-blue-200 shrink-0 tabular-nums">
              หยุดอัตโนมัติ {formatCountdown(secondsLeft)}
            </span>
          )}
        </div>

        {/* List of Today's Pending Jobs */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 max-h-[42vh]">
          {pendingJobs.map((job) => (
            <div
              key={job.id}
              className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-blue-300 transition-all space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono font-black text-xs bg-blue-600 text-white px-2 py-0.5 rounded-md shrink-0">
                    {job.queueNumber}
                  </span>
                  <span className="font-bold text-sm text-slate-900 truncate">
                    {job.product}
                  </span>
                </div>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
                  {job.status}
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
                  <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>เวลานัด: {job.appointmentTime || 'ไม่ระบุ'}</span>
                </div>
                {job.symptoms && (
                  <div className="flex items-center gap-1.5 truncate">
                    <Wrench className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{job.symptoms}</span>
                  </div>
                )}
              </div>

              {onSelectJob && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      warrantyAlarmService.stopAlarm();
                      onSelectJob(job);
                    }}
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <span>เปิดดูคิวงานนี้</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer Confirm Button */}
        <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <span className="text-[11px] text-slate-500 text-center sm:text-left">
            กดปุ่มเพื่อยืนยันการรับทราบคิวงานวันนี้และหยุดเสียงเตือน
          </span>
          <button
            type="button"
            onClick={handleConfirmAcknowledge}
            className="w-full sm:w-auto py-3 px-6 bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 text-white rounded-xl font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <CheckCircle className="w-5 h-5" />
            <span>ยืนยันเพื่อรับทราบ</span>
          </button>
        </div>
      </div>
    </div>
  );
};
