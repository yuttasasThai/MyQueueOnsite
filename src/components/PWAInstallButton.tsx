// File: /src/components/PWAInstallButton.tsx | Revision: Rev 18 | Version: 1.4.1
import React, { useState, useEffect } from 'react';
import {
  BellRing,
  Download,
  CheckCircle2,
  Smartphone,
  Volume2,
  X,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { RepairJob } from '../types';
import {
  requestBackgroundNotificationPermission,
  syncSchedulesToServiceWorker,
  showAppointmentSystemNotification,
  buildUpcomingAppointmentSchedules,
} from '../services/appointmentAlarm';
import { warrantyAlarmService } from '../services/soundAlarm';

interface PWAInstallButtonProps {
  jobs: RepairJob[];
  variant?: 'hero' | 'settings';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  jobs,
  variant = 'hero',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [notifPermission, setNotifPermission] = useState<string>(
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'unsupported'
  );
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [testNotice, setTestNotice] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifPermission(Notification.permission);
    }
  }, []);

  const upcomingCount = buildUpcomingAppointmentSchedules(jobs).length;

  const handleEnableBackgroundAlarm = async () => {
    const res = await requestBackgroundNotificationPermission();
    setNotifPermission(res);
    if (res === 'granted') {
      await syncSchedulesToServiceWorker(jobs);
      setTestNotice('เปิดแจ้งเตือนพื้นหลังสำเร็จ! ระบบจะเตือนก่อนเวลานัด 1 ชม. อัตโนมัติ');
      setTimeout(() => setTestNotice(null), 4000);
    } else if (res === 'denied') {
      setTestNotice('การแจ้งเตือนถูกบล็อก กรุณาเปิดอนุญาตการแจ้งเตือนในตั้งค่าเบราว์เซอร์');
      setTimeout(() => setTestNotice(null), 5000);
    }
  };

  const handleTestAlarmSoundAndNotif = async () => {
    warrantyAlarmService.playOnce(
      'ทดสอบเสียงเตือนคิวงานล่วงหน้า 30 นาที ระบบพร้อมแจ้งเตือนแล้วครับ'
    );

    if (notifPermission !== 'granted') {
      const res = await requestBackgroundNotificationPermission();
      setNotifPermission(res);
    }

    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      const now = Date.now();
      await showAppointmentSystemNotification({
        id: 'test-alarm',
        queueNumber: 'TEST',
        product: 'ทดสอบแจ้งเตือนล่วงหน้า 30 นาที',
        customerName: 'ระบบแจ้งเตือนพื้นหลัง',
        customerPhone: '-',
        appointmentDate: new Date().toISOString().split('T')[0],
        appointmentTime: 'อีก 30 นาที',
        appointmentAt: now + 30 * 60 * 1000,
        reminderAt: now,
        ackKey: `test_${now}`,
      });
    }

    setTestNotice('ส่งเสียงพูด + แจ้งเตือนทดสอบเรียบร้อยแล้ว');
    setTimeout(() => setTestNotice(null), 3500);
  };

  const isDark = variant === 'hero';

  return (
    <div
      className={`w-full rounded-2xl p-3 sm:p-3.5 border text-left space-y-2.5 ${
        isDark
          ? 'bg-[#121f3f]/95 border-blue-400/30 text-white'
          : 'bg-blue-50/70 border-blue-200 text-slate-900'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
              notifPermission === 'granted'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-400/40'
                : 'bg-amber-500/20 text-amber-400 border border-amber-400/40'
            }`}
          >
            <BellRing className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold flex items-center gap-1.5 flex-wrap">
              <span>แจ้งเตือนก่อนเวลานัด 30 นาที</span>
              {notifPermission === 'granted' && (
                <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  <span>เปิดพื้นหลังแล้ว</span>
                </span>
              )}
            </div>
            <p className={`text-[11px] leading-snug ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              ตั้งเตือนอัตโนมัติ {upcomingCount} คิว • แจ้งเตือนทั้งเสียงแอปและ LINE จนกว่าจะกดยืนยัน
            </p>
          </div>
        </div>
      </div>

      {testNotice && (
        <div
          className={`text-[11px] px-2.5 py-1.5 rounded-lg font-medium ${
            isDark
              ? 'bg-emerald-900/60 text-emerald-200 border border-emerald-500/40'
              : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
          }`}
        >
          {testNotice}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {notifPermission !== 'granted' && notifPermission !== 'unsupported' && (
          <button
            type="button"
            onClick={handleEnableBackgroundAlarm}
            className="flex-1 min-w-[140px] py-1.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <BellRing className="w-3.5 h-3.5" />
            <span>เปิดแจ้งเตือนพื้นหลัง</span>
          </button>
        )}

        <button
          type="button"
          onClick={handleTestAlarmSoundAndNotif}
          className={`py-1.5 px-3 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1.5 border transition-colors cursor-pointer ${
            isDark
              ? 'bg-white/10 hover:bg-white/20 text-white border-white/15'
              : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
          }`}
        >
          <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>ทดสอบเสียงเตือน</span>
        </button>

        {!isInstalled && (
          <>
            {isInstallable ? (
              <button
                type="button"
                onClick={install}
                className="flex-1 min-w-[140px] py-1.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>ติดตั้งแอปลงมือถือ</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowGuideModal(true)}
                className={`py-1.5 px-3 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1.5 border transition-colors cursor-pointer ${
                  isDark
                    ? 'bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 border-blue-400/40'
                    : 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>วิธีติดตั้งแอปเตือนพื้นหลัง</span>
              </button>
            )}
          </>
        )}
      </div>

      {/* Install & Background Notification Guide Modal */}
      {showGuideModal && (
        <div
          className="fixed inset-0 z-[80] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowGuideModal(false)}
        >
          <div
            className="bg-white text-slate-900 rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-3.5 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-blue-600 shrink-0" />
                <h4 className="font-bold text-sm sm:text-base">
                  ติดตั้งแอปเพื่อให้เตือนแม้ปิด Chrome
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <div className="text-xs text-slate-700 space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <p className="font-bold text-slate-900">สำหรับ iPhone / iPad (Safari):</p>
                <p>1. กดปุ่ม <strong>แชร์ (Share)</strong> ด้านล่างของ Safari</p>
                <p>2. เลื่อนลงแล้วกด <strong>เพิ่มไปยังหน้าจอโฮม (Add to Home Screen)</strong></p>
                <p>3. เปิดแอปจากไอคอนหน้าจอโฮม แล้วกดอนุญาตการแจ้งเตือน</p>
              </div>
            ) : (
              <div className="text-xs text-slate-700 space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <p className="font-bold text-slate-900">สำหรับ Android / Chrome:</p>
                <p>1. กดจุดสามจุด <strong>⋮</strong> มุมขวาบนของ Google Chrome</p>
                <p>2. เลือก <strong>&quot;ติดตั้งแอป&quot; (Install app)</strong> หรือ <strong>&quot;เพิ่มลงในหน้าจอหลัก&quot;</strong></p>
                <p>3. กดปุ่ม <strong>เปิดแจ้งเตือนพื้นหลัง</strong> เพื่อให้ระบบแจ้งเตือนก่อนเวลานัด 30 นาที แม้ไม่ได้เปิด Chrome ไว้</p>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              เข้าใจแล้ว
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
