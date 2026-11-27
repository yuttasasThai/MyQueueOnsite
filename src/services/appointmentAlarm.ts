// File: /src/services/appointmentAlarm.ts | Revision: Rev 21 | Version: 1.5.2 | Modified: 2026-11-16
import { RepairJob } from '../types';

const ACK_STORAGE_KEY = 'myqueue_appt_30m_acks_v1';

export type QueueReminderPhase = 'before_30m' | 'overdue_queue';

export interface AppointmentReminderSchedule {
  id: string;
  queueNumber: string;
  product: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  mapCoordinates?: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentAt: number; // Epoch ms
  reminderAt: number; // Epoch ms (30 minutes before appointmentAt)
  ackKey: string;
  phase?: QueueReminderPhase;
}

export interface OverdueTwoDaysItem {
  job: RepairJob;
  overdueDays: number;
  overdueHours: number;
  referenceDateStr: string;
}

/**
 * Parse start hour & minute from free-form Thai/24h time strings like:
 * "10:00 - 12:00", "09.30 - 11.30", "14:00", "9:30", "เช้า", "บ่าย", "เย็น"
 */
export function parseAppointmentStartTime(timeStr?: string): { hour: number; minute: number } | null {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const cleaned = timeStr.trim();
  if (!cleaned) return null;

  // Match HH:MM or HH.MM (first occurrence is start time)
  const match = cleaned.match(/(\d{1,2})\s*[:.]\s*(\d{2})/);
  if (match) {
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return { hour, minute };
    }
  }

  // Fallback for bare hour like "10 น." or "14"
  const hourOnly = cleaned.match(/\b(\d{1,2})\b/);
  if (hourOnly) {
    const hour = Number(hourOnly[1]);
    if (hour >= 0 && hour <= 23) {
      return { hour, minute: 0 };
    }
  }

  if (cleaned.includes('เช้า')) return { hour: 9, minute: 0 };
  if (cleaned.includes('เที่ยง') || cleaned.includes('บ่าย')) return { hour: 13, minute: 0 };
  if (cleaned.includes('เย็น')) return { hour: 17, minute: 0 };

  return null;
}

export function getAppointmentTimestamps(
  appointmentDate: string,
  appointmentTime?: string
): { appointmentAt: number; reminderAt: number; startLabel: string } | null {
  if (!appointmentDate || !/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)) return null;
  const parsedTime = parseAppointmentStartTime(appointmentTime);
  if (!parsedTime) return null;

  const [y, m, d] = appointmentDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d, parsedTime.hour, parsedTime.minute, 0, 0);
  const appointmentAt = dt.getTime();
  if (Number.isNaN(appointmentAt)) return null;

  const reminderAt = appointmentAt - 30 * 60 * 1000; // Exact 30 minutes before
  const startLabel = `${String(parsedTime.hour).padStart(2, '0')}:${String(
    parsedTime.minute
  ).padStart(2, '0')}`;
  return { appointmentAt, reminderAt, startLabel };
}

export function getAckKeyForJob(job: RepairJob, phase: QueueReminderPhase = 'before_30m'): string {
  const parsed = parseAppointmentStartTime(job.appointmentTime);
  const timeToken = parsed
    ? `${String(parsed.hour).padStart(2, '0')}${String(parsed.minute).padStart(2, '0')}`
    : 'none';
  const base = `${job.id}_${job.appointmentDate}_${timeToken}`;
  return phase === 'overdue_queue' ? `${base}_overdue` : base;
}

export function loadAcknowledgedAppointmentKeys(): string[] {
  try {
    const raw = localStorage.getItem(ACK_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveAcknowledgedAppointmentKey(ackKey: string): string[] {
  const existing = loadAcknowledgedAppointmentKeys();
  if (!existing.includes(ackKey)) {
    const updated = [...existing.slice(-200), ackKey];
    try {
      localStorage.setItem(ACK_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
    syncAckToServiceWorker(ackKey);
    return updated;
  }
  return existing;
}

/**
 * Build schedule entries covering BOTH:
 * 1) Before appointment (30 minutes before appointmentAt)
 * 2) Overdue queue (from appointmentAt up to 48 hours past appointmentAt)
 */
export function buildUpcomingAppointmentSchedules(
  jobs: RepairJob[],
  now = Date.now()
): AppointmentReminderSchedule[] {
  const list: AppointmentReminderSchedule[] = [];
  const fortyEightHoursMs = 48 * 60 * 60 * 1000;

  for (const job of jobs) {
    if (job.status === 'ซ่อมแล้ว' || job.status === 'ปิดงาน' || job.status === 'ยกเลิก') {
      continue;
    }
    const ts = getAppointmentTimestamps(job.appointmentDate, job.appointmentTime);
    if (!ts) continue;

    // Skip if past 48 hours (handed over to >2-day unclosed job alarm)
    if (now > ts.appointmentAt + fortyEightHoursMs) continue;

    const isOverdueNow = now >= ts.appointmentAt;
    // When overdue, skip if technician already actively started repairing ('กำลังไป' / 'กำลังซ่อม')
    if (isOverdueNow && (job.status === 'กำลังไป' || job.status === 'กำลังซ่อม')) {
      continue;
    }

    const phase: QueueReminderPhase = isOverdueNow ? 'overdue_queue' : 'before_30m';

    list.push({
      id: job.id,
      queueNumber: job.queueNumber,
      product: job.product,
      customerName: job.customer.name,
      customerPhone: job.customer.phone,
      customerAddress: job.customer.address,
      mapCoordinates: job.customer.mapCoordinates,
      appointmentDate: job.appointmentDate,
      appointmentTime: job.appointmentTime || ts.startLabel,
      appointmentAt: ts.appointmentAt,
      reminderAt: ts.reminderAt,
      ackKey: getAckKeyForJob(job, phase),
      phase,
    });
  }

  return list.sort((a, b) => a.reminderAt - b.reminderAt);
}

/**
 * Return all jobs whose alarm is currently due — BOTH:
 * - Before queue: within 30 minutes before appointmentAt
 * - Overdue queue: past appointmentAt (up to 48 hours) while job is still pending/unstarted
 */
export function getDueAppointmentReminders(
  jobs: RepairJob[],
  now = Date.now()
): { job: RepairJob; schedule: AppointmentReminderSchedule }[] {
  const ackSet = new Set(loadAcknowledgedAppointmentKeys());
  const schedules = buildUpcomingAppointmentSchedules(jobs, now);
  const due: { job: RepairJob; schedule: AppointmentReminderSchedule }[] = [];
  const fortyEightHoursMs = 48 * 60 * 60 * 1000;

  for (const sched of schedules) {
    if (ackSet.has(sched.ackKey)) continue;
    if (now >= sched.reminderAt && now <= sched.appointmentAt + fortyEightHoursMs) {
      const job = jobs.find((j) => j.id === sched.id);
      if (job) {
        due.push({ job, schedule: sched });
      }
    }
  }
  return due;
}

export const getDueOneHourReminders = getDueAppointmentReminders;

/**
 * Detect jobs that are still NOT closed ('ปิดงาน') or cancelled ('ยกเลิก')
 * and have been pending for MORE THAN 2 days (> 48 hours / > 2 days past appointment or logged date).
 */
export function getOverdueTwoDaysUnclosedJobs(
  jobs: RepairJob[],
  now = Date.now()
): OverdueTwoDaysItem[] {
  const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
  const results: OverdueTwoDaysItem[] = [];

  for (const job of jobs) {
    if (job.status === 'ปิดงาน' || job.status === 'ยกเลิก') {
      continue;
    }

    let refMs: number | null = null;
    let referenceDateStr = job.appointmentDate || job.loggedDate || '';

    if (job.appointmentDate && /^\d{4}-\d{2}-\d{2}$/.test(job.appointmentDate)) {
      const ts = getAppointmentTimestamps(job.appointmentDate, job.appointmentTime);
      if (ts) {
        refMs = ts.appointmentAt;
      } else {
        const [y, m, d] = job.appointmentDate.split('-').map(Number);
        refMs = new Date(y, m - 1, d, 9, 0, 0, 0).getTime();
      }
      referenceDateStr = job.appointmentDate;
    } else if (job.loggedDate && /^\d{4}-\d{2}-\d{2}$/.test(job.loggedDate)) {
      const [y, m, d] = job.loggedDate.split('-').map(Number);
      refMs = new Date(y, m - 1, d, 9, 0, 0, 0).getTime();
      referenceDateStr = job.loggedDate;
    }

    if (refMs === null || Number.isNaN(refMs)) continue;

    const diffMs = now - refMs;
    if (diffMs > TWO_DAYS_MS) {
      const overdueHours = Math.floor(diffMs / (60 * 60 * 1000));
      const overdueDays = Math.floor(overdueHours / 24);
      results.push({
        job,
        overdueDays,
        overdueHours,
        referenceDateStr,
      });
    }
  }

  return results.sort((a, b) => b.overdueHours - a.overdueHours);
}

export async function syncSchedulesToServiceWorker(jobs: RepairJob[]): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const schedules = buildUpcomingAppointmentSchedules(jobs);
    const acknowledgedKeys = loadAcknowledgedAppointmentKeys();

    const target = reg.active || reg.waiting || reg.installing || navigator.serviceWorker.controller;
    if (target) {
      target.postMessage({
        type: 'SYNC_APPOINTMENT_ALARMS',
        schedules,
        acknowledgedKeys,
      });
    }

    // Also try registering periodicSync (~15 min minimum interval supported by Chrome PWA)
    const regWithSync = reg as ServiceWorkerRegistration & {
      periodicSync?: { register: (tag: string, opts: { minInterval: number }) => Promise<void> };
    };
    if (regWithSync.periodicSync) {
      try {
        await regWithSync.periodicSync.register('myqueue-appointment-check', {
          minInterval: 15 * 60 * 1000,
        });
      } catch {
        // periodicSync may require site engagement / PWA install
      }
    }
  } catch (err) {
    console.warn('[appointmentAlarm] SW sync skipped:', err);
  }
}

export async function syncAckToServiceWorker(ackKey: string): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const target = reg.active || navigator.serviceWorker.controller;
    if (target) {
      target.postMessage({
        type: 'ACK_APPOINTMENT_ALARM',
        ackKey,
      });
    }
  } catch {}
}

export async function requestBackgroundNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  if (Notification.permission === 'granted') {
    return 'granted';
  }
  try {
    const res = await Notification.requestPermission();
    return res;
  } catch {
    return Notification.permission;
  }
}

export async function showAppointmentSystemNotification(
  schedule: AppointmentReminderSchedule
): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission !== 'granted') return false;

  const diffMins = Math.round((schedule.appointmentAt - Date.now()) / 60000);
  const title =
    diffMins > 0
      ? `⏰ อีก ${diffMins} นาที ถึงเวลานัด! (${schedule.queueNumber})`
      : diffMins === 0
      ? `🔔 ถึงเวลานัดหมายแล้ว! (${schedule.queueNumber})`
      : `🔴 เกินคิวงานแล้ว ${Math.abs(diffMins)} นาที! (${schedule.queueNumber})`;

  const body = `งาน: ${schedule.product}\nลูกค้า: ${schedule.customerName} (${schedule.customerPhone})\nเวลานัด: ${schedule.appointmentTime}`;

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      const options: NotificationOptions & { vibrate?: number[]; renotify?: boolean } = {
        body,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: `appt-30m-due-${schedule.ackKey}`,
        renotify: true,
        requireInteraction: true,
        vibrate: [450, 150, 450, 150, 600],
        data: {
          jobId: schedule.id,
          ackKey: schedule.ackKey,
          url: `/?alarm_job=${encodeURIComponent(schedule.id)}`,
        },
      };
      await reg.showNotification(title, options);
      return true;
    }

    new Notification(title, {
      body,
      icon: '/pwa-192x192.png',
      tag: `appt-30m-due-${schedule.ackKey}`,
      requireInteraction: true,
    });
    return true;
  } catch {
    return false;
  }
}

export function isTimestampTriggerSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'showTrigger' in Notification.prototype
  );
}

/**
 * Download an .ics calendar event with a built-in 30-minute VALARM
 */
export function downloadAppointmentIcsAlarm(job: RepairJob): boolean {
  const ts = getAppointmentTimestamps(job.appointmentDate, job.appointmentTime);
  if (!ts) return false;

  const formatIcsUtc = (ms: number) => {
    const d = new Date(ms);
    return (
      d.getUTCFullYear().toString() +
      String(d.getUTCMonth() + 1).padStart(2, '0') +
      String(d.getUTCDate()).padStart(2, '0') +
      'T' +
      String(d.getUTCHours()).padStart(2, '0') +
      String(d.getUTCMinutes()).padStart(2, '0') +
      '00Z'
    );
  };

  const dtStart = formatIcsUtc(ts.appointmentAt);
  const dtEnd = formatIcsUtc(ts.appointmentAt + 60 * 60 * 1000);
  const dtStamp = formatIcsUtc(Date.now());
  const summary = `คิวซ่อม ${job.queueNumber}: ${job.product} (${job.customer.name})`.replace(
    /[\r\n]/g,
    ' '
  );
  const desc = `ลูกค้า: ${job.customer.name} โทร: ${job.customer.phone} อาการ: ${job.symptoms || '-'}`.replace(
    /[\r\n]/g,
    ' '
  );
  const loc = (job.customer.address || '').replace(/[\r\n]/g, ' ');

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MyQueue Onsite Service//TH',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${job.id}@myqueue-onsite`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${desc}`,
    `LOCATION:${loc}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    `DESCRIPTION:แจ้งเตือนล่วงหน้า 30 นาที ${summary}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `alarm_${job.queueNumber}_${job.appointmentDate}.ics`;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}
