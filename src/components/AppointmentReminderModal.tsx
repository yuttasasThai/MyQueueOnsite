// File: /src/components/AppointmentReminderModal.tsx | Revision: Rev 21 | Version: 1.5.2 | Modified: 2026-11-16
import React, { useState, useEffect } from 'react';
import {
  AlarmClock,
  Volume2,
  VolumeX,
  Phone,
  Navigation,
  CheckCircle2,
  CalendarPlus,
  Send,
  RefreshCw,
  MessageCircle,
} from 'lucide-react';
import { RepairJob } from '../types';
import { warrantyAlarmService } from '../services/soundAlarm';
import {
  AppointmentReminderSchedule,
  downloadAppointmentIcsAlarm,
} from '../services/appointmentAlarm';

interface AppointmentReminderModalProps {
  dueItems: { job: RepairJob; schedule: AppointmentReminderSchedule }[];
  isOpen: boolean;
  onAcknowledgeAll: (ackKeys: string[]) => void;
  onOpenJobDetail?: (job: RepairJob) => void;
  lineConfigured?: boolean;
  repeatIntervalMinutes?: number;
  lineSendCount?: number;
  onResendLineNow?: () => Promise<void>;
}

function formatOverdueDuration(overdueMins: number): string {
  if (overdueMins < 60) return `${overdueMins} นาที`;
  const hrs = Math.floor(overdueMins / 60);
  const mins = overdueMins % 60;
  return mins > 0 ? `${hrs} ชั่วโมง ${mins} นาที` : `${hrs} ชั่วโมง`;
}

export const AppointmentReminderModal: React.FC<AppointmentReminderModalProps> = ({
  dueItems,
  isOpen,
  onAcknowledgeAll,
  onOpenJobDetail,
  lineConfigured = false,
  repeatIntervalMinutes = 2,
  lineSendCount = 0,
  onResendLineNow,
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isSendingLine, setIsSendingLine] = useState(false);

  const count = dueItems.length;
  const firstItem = dueItems[0];
  const hasOverdueQueue = dueItems.some((d) => Date.now() >= d.schedule.appointmentAt);
  const hasBeforeQueue = dueItems.some((d) => Date.now() < d.schedule.appointmentAt);

  useEffect(() => {
    if (!isOpen || count === 0) return;

    setElapsedSeconds(0);

    const buildSpeech = () => {
      if (count === 1 && firstItem) {
        const diffMins = Math.round((firstItem.schedule.appointmentAt - Date.now()) / 60000);
        const timePhrase =
          diffMins > 0
            ? `ก่อนถึงคิวงาน! อีก ${diffMins} นาที จะถึงเวลานัดหมาย`
            : diffMins === 0
            ? 'ถึงเวลานัดหมายซ่อมแล้ว!'
            : `แจ้งเตือนเกินคิวงาน! เลยเวลานัดหมายมาแล้ว ${formatOverdueDuration(Math.abs(diffMins))}`;
        return `แจ้งเตือนคิวงาน! ${timePhrase} คิว ${firstItem.job.queueNumber} งาน ${firstItem.job.product} ลูกค้าคุณ${firstItem.job.customer.name} เวลานัด ${firstItem.job.appointmentTime} กรุณากดยืนยันเพื่อรับทราบทางไลน์ หรือในโปรแกรม`;
      }
      if (hasOverdueQueue && hasBeforeQueue) {
        return `แจ้งเตือนคิวงาน! มี ${count} คิวงาน ทั้งใกล้ถึงเวลานัดและเกินเวลานัดหมายแล้ว กรุณากดยืนยันเพื่อรับทราบทางไลน์ หรือในโปรแกรม`;
      }
      if (hasOverdueQueue) {
        return `แจ้งเตือนเกินคิวงาน! มี ${count} คิวงาน ที่เลยเวลานัดหมายแล้ว กรุณากดยืนยันเพื่อรับทราบทางไลน์ หรือในโปรแกรม`;
      }
      return `แจ้งเตือนก่อนถึงคิวงาน! มี ${count} คิวงาน ที่จะถึงเวลานัดหมายภายใน 30 นาที กรุณากดยืนยันเพื่อรับทราบทางไลน์ หรือในโปรแกรม`;
    };

    if (!isMuted) {
      // Continuously loop alarm until user acknowledges either in LINE or in App
      warrantyAlarmService.startAlarm(buildSpeech());
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
  }, [isOpen, count, firstItem?.schedule.ackKey, isMuted, hasOverdueQueue, hasBeforeQueue]);

  if (!isOpen || count === 0) return null;

  const formatElapsed = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleConfirmAck = () => {
    warrantyAlarmService.stopAlarm();
    onAcknowledgeAll(dueItems.map((d) => d.schedule.ackKey));
  };

  const handleManualResendLine = async () => {
    if (!onResendLineNow || isSendingLine) return;
    setIsSendingLine(true);
    try {
      await onResendLineNow();
    } finally {
      setIsSendingLine(false);
    }
  };

  const getMapsUrl = (job: RepairJob) => {
    if (job.customer.mapCoordinates && job.customer.mapCoordinates.includes(',')) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        job.customer.mapCoordinates
      )}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      job.customer.address || job.customer.name
    )}`;
  };

  const headerTag =
    hasOverdueQueue && hasBeforeQueue
      ? 'แจ้งเตือนก่อนถึงคิว 30 นาที & เกินคิวงาน'
      : hasOverdueQueue
      ? 'แจ้งเตือนเกินคิวงานแล้ว (เลยเวลานัดหมาย)'
      : 'แจ้งเตือนก่อนเวลานัดหมาย 30 นาที';

  return (
    <div className="fixed inset-0 z-[90] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border-2 border-rose-500 overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-4">
        {/* Urgent Header */}
        <div
          className={`text-white p-4 sm:p-5 flex items-center justify-between gap-3 ${
            hasOverdueQueue && !hasBeforeQueue
              ? 'bg-gradient-to-r from-red-700 via-rose-700 to-orange-600'
              : 'bg-gradient-to-r from-rose-600 via-red-600 to-amber-600'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center shrink-0 animate-bounce">
              <AlarmClock className="w-7 h-7 text-white" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-100">
                {headerTag}
              </div>
              <h3 className="font-extrabold text-base sm:text-lg leading-tight">
                {count === 1 && firstItem
                  ? Date.now() >= firstItem.schedule.appointmentAt
                    ? `คิว ${firstItem.job.queueNumber} เกินกำหนดเวลานัดแล้ว!`
                    : `คิว ${firstItem.job.queueNumber} ใกล้ถึงเวลานัด!`
                  : `มี ${count} คิวงาน ต้องเร่งดำเนินการ!`}
              </h3>
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

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-3.5 max-h-[60vh] overflow-y-auto">
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-rose-800 flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-rose-600 animate-pulse" />
                {isMuted
                  ? 'ปิดเสียงชั่วคราว (ยังรอการยืนยัน)'
                  : 'กำลังส่งเสียงเตือนซ้ำ จนกว่าจะกดยืนยันทาง LINE หรือในโปรแกรม'}
              </span>
              <span className="font-mono font-bold text-rose-700 tabular-nums shrink-0 ml-2">
                {formatElapsed(elapsedSeconds)}
              </span>
            </div>

            {lineConfigured ? (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-rose-200/70 text-[11px] text-emerald-800">
                <span className="inline-flex items-center gap-1 font-semibold">
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                  <span>
                    LINE Messaging API กำลังเตือนซ้ำทุก {repeatIntervalMinutes} นาที (ส่งแล้ว {lineSendCount} ครั้ง)
                  </span>
                </span>
                {onResendLineNow && (
                  <button
                    type="button"
                    onClick={handleManualResendLine}
                    disabled={isSendingLine}
                    className="px-2 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    {isSendingLine ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <Send className="w-3 h-3" />
                    )}
                    <span>ส่งเข้า LINE ทันที</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="text-[11px] text-amber-800 pt-1 border-t border-rose-200/70">
                หมายเหตุ: หากต้องการให้แจ้งเตือนซ้ำเข้า LINE ด้วย ให้ใส่ Channel Access Token ในเมนู &quot;ตั้งค่า &rarr; ตั้งค่า LINE Messaging API&quot;
              </div>
            )}
          </div>

          <div className="space-y-2.5">
            {dueItems.map(({ job, schedule }) => {
              const diffMins = Math.round((schedule.appointmentAt - Date.now()) / 60000);
              const isOverdue = diffMins < 0;
              return (
                <div
                  key={schedule.ackKey}
                  className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 bg-slate-900 text-white rounded font-mono font-bold text-xs">
                          {job.queueNumber}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            isOverdue
                              ? 'bg-red-600 text-white'
                              : diffMins === 0
                              ? 'bg-orange-500 text-white'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {diffMins > 0
                            ? `ก่อนถึงคิว • อีก ${diffMins} นาที`
                            : diffMins === 0
                            ? 'ถึงเวลานัดแล้ว!'
                            : `เกินคิวงาน • เลยมาแล้ว ${formatOverdueDuration(Math.abs(diffMins))}`}
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-900 text-sm mt-1">{job.product}</h4>
                      <p className="text-xs text-slate-600">
                        ลูกค้า: <strong>{job.customer.name}</strong> ({job.customer.phone})
                      </p>
                      <p className="text-xs text-blue-700 font-semibold mt-0.5">
                        เวลานัด: {job.appointmentDate} เวลา {job.appointmentTime}
                      </p>
                      {job.customer.address && (
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                          ที่อยู่: {job.customer.address}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <a
                      href={`tel:${job.customer.phone.replace(/[^0-9]/g, '')}`}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>โทรหาลูกค้า</span>
                    </a>

                    <a
                      href={getMapsUrl(job)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold inline-flex items-center gap-1"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      <span>นำทาง GPS</span>
                    </a>

                    <button
                      type="button"
                      onClick={() => downloadAppointmentIcsAlarm(job)}
                      className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                      title="เพิ่มลงปฏิทินมือถือพร้อมปลุกเตือนล่วงหน้า 30 นาที"
                    >
                      <CalendarPlus className="w-3.5 h-3.5 text-blue-600" />
                      <span>ลงปฏิทิน</span>
                    </button>

                    {onOpenJobDetail && (
                      <button
                        type="button"
                        onClick={() => {
                          handleConfirmAck();
                          onOpenJobDetail(job);
                        }}
                        className="ml-auto px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
                      >
                        เปิดคิวงาน &rarr;
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Confirm */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-2">
          <button
            type="button"
            onClick={handleConfirmAck}
            className="w-full py-3 px-5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-sm shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>ยืนยันรับทราบ &amp; ปิดเสียงเตือน (หยุดเตือนทั้งในแอปและ LINE)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
