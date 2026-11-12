import React, { useEffect, useState } from 'react';
import {
  ShieldAlert,
  Volume2,
  VolumeX,
  CheckCircle,
  AlertOctagon,
  Calendar,
  User,
  Wrench,
  Clock,
  Phone,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { RepairJob } from '../types';
import { getWarrantyStatus } from '../services/storage';
import { warrantyAlarmService } from '../services/soundAlarm';

interface ExpiredWarrantyModalProps {
  expiredJobs: RepairJob[];
  isOpen: boolean;
  onAcknowledgeAll: () => void;
  onSelectJob?: (job: RepairJob) => void;
}

export const ExpiredWarrantyModal: React.FC<ExpiredWarrantyModalProps> = ({
  expiredJobs,
  isOpen,
  onAcknowledgeAll,
  onSelectJob,
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [pulseCount, setPulseCount] = useState(0);

  // Construct Thai speech text from the list of expired jobs
  const buildSpeechText = (): string => {
    if (expiredJobs.length === 0) return '';
    if (expiredJobs.length === 1) {
      const job = expiredJobs[0];
      return `แจ้งเตือน งานหมดระยะประกัน เลขที่ ${job.queueNumber} ลูกค้าคุณ ${job.customer.name} รายการ ${job.product}`;
    }
    // Multiple jobs: announce summary and first 2 jobs
    const firstTwo = expiredJobs.slice(0, 2);
    const details = firstTwo
      .map((j) => `คิว ${j.queueNumber} ลูกค้าคุณ ${j.customer.name} รายการ ${j.product}`)
      .join(' และ ');
    return `แจ้งเตือน มีงานหมดระยะประกัน ${expiredJobs.length} รายการ ได้แก่ ${details}`;
  };

  // Start sound & speech loop when modal opens
  useEffect(() => {
    if (isOpen && expiredJobs.length > 0) {
      setIsMuted(false);
      const speech = buildSpeechText();
      warrantyAlarmService.startAlarm(speech);

      // Pulse visual ticker
      const interval = setInterval(() => {
        setPulseCount((c) => c + 1);
      }, 1000);

      return () => {
        clearInterval(interval);
        warrantyAlarmService.stopAlarm();
      };
    } else {
      warrantyAlarmService.stopAlarm();
    }
  }, [isOpen, expiredJobs]);

  const handleToggleMute = () => {
    if (isMuted) {
      const speech = buildSpeechText();
      warrantyAlarmService.startAlarm(speech);
      setIsMuted(false);
    } else {
      warrantyAlarmService.stopAlarm();
      setIsMuted(true);
    }
  };

  const handleAcknowledge = () => {
    warrantyAlarmService.stopAlarm();
    onAcknowledgeAll();
  };

  if (!isOpen || expiredJobs.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl border-2 border-red-500 space-y-6 relative overflow-hidden my-6 max-h-[92vh] flex flex-col">
        {/* Urgent Animated Header Banner */}
        <div className="relative -mx-6 -mt-6 p-5 sm:p-6 bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white shadow-md">
          <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>

          <div className="flex items-start justify-between gap-4 relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white text-red-600 flex items-center justify-center shadow-lg animate-bounce shrink-0">
                <AlertOctagon className="w-7 h-7" />
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-900/40 text-red-100 text-xs font-bold mb-1 border border-white/20">
                  <span className="w-2 h-2 rounded-full bg-amber-300 animate-ping"></span>
                  <span>ระบบตรวจพบงานหมดระยะประกัน</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white font-['Plus_Jakarta_Sans',sans-serif]">
                  แจ้งเตือนงานหมดระยะประกัน ({expiredJobs.length} รายการ)
                </h2>
                <p className="text-xs sm:text-sm text-red-100 mt-0.5">
                  เสียงเตือนจะดังซ้ำๆ และพูดแจ้งชื่อคิวงาน จนกว่าท่านจะกดปุ่มรับทราบ
                </p>
              </div>
            </div>

            {/* Mute / Unmute Quick Button */}
            <button
              type="button"
              onClick={handleToggleMute}
              className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
                isMuted
                  ? 'bg-red-800/80 border-red-400 text-red-200 hover:bg-red-800'
                  : 'bg-white text-red-700 border-white hover:bg-red-50 shadow-md'
              }`}
              title={isMuted ? 'เปิดเสียงเตือน' : 'ปิดเสียงชั่วคราว'}
            >
              {isMuted ? (
                <>
                  <VolumeX className="w-4 h-4" />
                  <span className="hidden sm:inline">ปิดเสียงอยู่</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4 animate-pulse text-red-600" />
                  <span className="hidden sm:inline font-bold">กำลังส่งเสียงเตือน</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Audio Speaking Status Indicator */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-red-50 border border-red-200 text-xs">
          <div className="flex items-center gap-2 text-red-900 font-semibold">
            <Volume2 className={`w-4 h-4 text-red-600 ${!isMuted ? 'animate-bounce' : ''}`} />
            <span>
              {isMuted
                ? 'เสียงเตือนถูกปิดชั่วคราว (กรุณากดรับทราบเพื่อปิดหน้าต่างนี้)'
                : 'กำลังส่งเสียงปี๊บและเสียงอ่านภาษาไทย: เลขที่ Job, ชื่อลูกค้า, และรายการงานซ่อม'}
            </span>
          </div>
          <span className="font-mono text-[11px] text-red-600 font-bold bg-white px-2 py-0.5 rounded border border-red-200 shrink-0">
            วนซ้ำทุก 7 วินาที
          </span>
        </div>

        {/* List of Expired Jobs */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[46vh]">
          {expiredJobs.map((job) => {
            const ws = getWarrantyStatus(job.warrantyEndDate, job.warrantyDays);
            return (
              <div
                key={job.id}
                className="p-4 rounded-2xl bg-white border-2 border-red-200 hover:border-red-400 transition-all shadow-xs space-y-3"
              >
                {/* Header row */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-sm bg-red-600 text-white px-2.5 py-1 rounded-lg shadow-xs">
                      {job.queueNumber}
                    </span>
                    <span className="font-bold text-sm sm:text-base text-slate-900">
                      {job.product}
                    </span>
                  </div>

                  <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700 bg-red-100 px-2.5 py-0.5 rounded-full border border-red-300">
                    <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                    <span>{ws.label}</span>
                  </span>
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-2 text-slate-700">
                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>
                      ลูกค้า: <strong className="text-slate-900">{job.customer.name}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-slate-700">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-mono">{job.customer.phone}</span>
                  </div>

                  <div className="flex items-center gap-2 text-slate-700 sm:col-span-2">
                    <Wrench className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>
                      รายการงานซ่อม: <span className="text-slate-800">{job.jobDetails || job.symptoms}</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-slate-600">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>ระยะประกัน: {job.warrantyDays} วัน</span>
                  </div>

                  <div className="flex items-center gap-2 text-red-700 font-semibold">
                    <Clock className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    <span>สิ้นสุดเมื่อ: {ws.formattedEndDate}</span>
                  </div>
                </div>

                {/* Action to view job */}
                {onSelectJob && (
                  <div className="pt-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        warrantyAlarmService.stopAlarm();
                        onSelectJob(job);
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <span>ดูรายละเอียดงานนี้</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer Actions: Big Acknowledge Button */}
        <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 text-center sm:text-left">
            <span>เมื่อกด <strong>"รับทราบและหยุดเสียงเตือน"</strong> หน้าต่างนี้จะปิดลงและหยุดส่งเสียงทันที</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleToggleMute}
              className="py-3 px-4 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {isMuted ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              <span>{isMuted ? 'เปิดเสียง' : 'ปิดเสียง'}</span>
            </button>

            <button
              type="button"
              onClick={handleAcknowledge}
              className="flex-1 sm:flex-initial py-3 px-6 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer ring-4 ring-red-100"
            >
              <CheckCircle className="w-5 h-5 text-white" />
              <span>รับทราบและหยุดเสียงเตือน</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
