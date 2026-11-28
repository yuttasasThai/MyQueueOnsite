// File: /src/services/lineNotify.ts | Revision: Rev 19 | Version: 1.5.0 | Modified: 2026-11-15
import { RepairJob, RepairStatus, ShopSettings, NotificationLog, LineNotifySettings } from '../types';
import { AppointmentReminderSchedule } from './appointmentAlarm';

const NOTIFICATION_LOGS_KEY = 'repair_onsite_line_logs_v1';

/**
 * Resolve active LINE Channel Access Token (Messaging API primary, fallback to legacy token field)
 */
export function getActiveLineChannelToken(cfg?: LineNotifySettings): string {
  if (!cfg) return '';
  return (cfg.channelAccessToken || cfg.token || '').trim();
}

export function getActiveLineProvider(cfg?: LineNotifySettings): 'messaging_api' | 'line_notify' {
  if (!cfg) return 'messaging_api';
  if (cfg.provider === 'line_notify') return 'line_notify';
  return 'messaging_api';
}

export function getLineSendMode(cfg?: LineNotifySettings): 'push' | 'broadcast' {
  if (!cfg) return 'broadcast';
  if (cfg.sendMode === 'push' && cfg.targetId?.trim()) return 'push';
  if (cfg.sendMode === 'broadcast') return 'broadcast';
  return cfg.targetId?.trim() ? 'push' : 'broadcast';
}

export function isLineConfigured(cfg?: LineNotifySettings): boolean {
  if (!cfg || cfg.enabled === false) return false;
  return Boolean(getActiveLineChannelToken(cfg));
}

/**
 * Format Google Maps link for easy navigation
 */
export function getMapUrlForJob(job: RepairJob): string {
  if (job.customer.mapCoordinates && job.customer.mapCoordinates.includes(',')) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      job.customer.mapCoordinates
    )}`;
  }
  if (job.customer.address) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      job.customer.address
    )}`;
  }
  return '';
}

/**
 * Format new appointment job alert message
 */
export function formatNewJobNotification(job: RepairJob, settings: ShopSettings): string {
  const cfg = settings.lineNotify;
  const lines: string[] = [];

  lines.push(`🔔 [มีนัดหมายงานซ่อมใหม่] 🛠️`);
  lines.push(`━━━━━━━━━━━━━━━━`);
  lines.push(`📌 คิวงาน: ${job.queueNumber}`);
  lines.push(`📦 สินค้า: ${job.product}`);
  if (job.symptoms) {
    lines.push(`⚠️ อาการแจ้ง: ${job.symptoms}`);
  }
  if (job.jobDetails) {
    lines.push(`📝 รายละเอียด: ${job.jobDetails}`);
  }
  lines.push(`📅 วันนัดหมาย: ${job.appointmentDate} (${job.appointmentTime || 'ไม่ระบุเวลา'})`);

  lines.push(`👤 ลูกค้า: ${job.customer.name}`);
  if (cfg?.includeCustomerPhone && job.customer.hasPhone !== false && job.customer.phone && job.customer.phone !== 'ไม่มีเบอร์') {
    lines.push(`📞 โทร: ${job.customer.phone}`);
  }
  if (job.customer.lineId) {
    lines.push(`💬 LINE: ${job.customer.lineId}`);
  }
  if (job.customer.address) {
    lines.push(`🏠 ที่อยู่: ${job.customer.address}`);
  }

  if (cfg?.includeMapLink) {
    const mapUrl = getMapUrlForJob(job);
    if (mapUrl) {
      lines.push(`📍 แผนที่: ${mapUrl}`);
    }
  }

  if (job.estimatedCost > 0) {
    lines.push(`💰 ประเมินค่าซ่อม: ฿${job.estimatedCost.toLocaleString('th-TH')}`);
  }

  if (job.assignedUserName) {
    lines.push(`👷 ช่างผู้รับผิดชอบ: ${job.assignedUserName}`);
  }

  lines.push(`━━━━━━━━━━━━━━━━`);
  lines.push(`🏪 ${settings.shopName || 'Repair Onsite Service'}`);
  lines.push(`⏰ ${new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`);

  return lines.join('\n');
}

/**
 * Format status change alert message
 */
export function formatStatusChangeNotification(
  job: RepairJob,
  previousStatus: RepairStatus | undefined,
  newStatus: RepairStatus,
  settings: ShopSettings
): string {
  const cfg = settings.lineNotify;
  const lines: string[] = [];

  const statusEmoji: Record<RepairStatus, string> = {
    รับงาน: '📥',
    กำลังไป: '🚗💨',
    กำลังซ่อม: '🔧⚙️',
    ซ่อมแล้ว: '✅✨',
    ปิดงาน: '🏁🎉',
    นัดหมายต่อ: '📆🔁',
    ยกเลิก: '❌⚠️',
  };

  const emoji = statusEmoji[newStatus] || '⚡';

  lines.push(`${emoji} [อัปเดตสถานะงานซ่อม]`);
  lines.push(`━━━━━━━━━━━━━━━━`);
  lines.push(`📌 คิวงาน: ${job.queueNumber}`);
  lines.push(`🔄 สถานะ: 👉 "${newStatus}"` + (previousStatus ? ` (เดิม: ${previousStatus})` : ''));
  lines.push(`📦 สินค้า: ${job.product}`);
  lines.push(`👤 ลูกค้า: ${job.customer.name}`);

  if (cfg?.includeCustomerPhone && job.customer.hasPhone !== false && job.customer.phone && job.customer.phone !== 'ไม่มีเบอร์') {
    lines.push(`📞 โทร: ${job.customer.phone}`);
  }

  if (job.assignedUserName) {
    lines.push(`👷 ช่างประจำงาน: ${job.assignedUserName}`);
  }

  if (newStatus === 'ซ่อมแล้ว' || newStatus === 'ปิดงาน') {
    if (job.actualCost !== null) {
      lines.push(`💵 ค่าซ่อมจริง: ฿${job.actualCost.toLocaleString('th-TH')}`);
    } else if (job.estimatedCost > 0) {
      lines.push(`💵 ค่าซ่อม: ฿${job.estimatedCost.toLocaleString('th-TH')}`);
    }
    lines.push(`🛡️ ประกัน: ${job.warrantyDays} วัน (ถึง ${job.warrantyEndDate})`);
  } else {
    lines.push(`📅 วันนัดหมาย: ${job.appointmentDate} (${job.appointmentTime || 'ตามนัด'})`);
  }

  if (newStatus === 'ยกเลิก' && job.cancelReason) {
    lines.push(`📝 เหตุผลยกเลิก: ${job.cancelReason}`);
  }

  if (cfg?.includeMapLink) {
    const mapUrl = getMapUrlForJob(job);
    if (mapUrl && (newStatus === 'กำลังไป' || newStatus === 'รับงาน')) {
      lines.push(`📍 พิกัดหน้างาน: ${mapUrl}`);
    }
  }

  lines.push(`━━━━━━━━━━━━━━━━`);
  lines.push(`🏪 ${settings.shopName || 'Repair Onsite Service'}`);
  lines.push(`⏰ ${new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`);

  return lines.join('\n');
}

/**
 * Format appointment reschedule notification message
 */
export function formatRescheduleNotification(
  job: RepairJob,
  previousDate: string,
  previousTime: string,
  settings: ShopSettings,
  reason?: string
): string {
  const cfg = settings.lineNotify;
  const lines: string[] = [];

  lines.push(`📆 [แจ้งเปลี่ยนวัน/เวลานัดหมายซ่อม]`);
  lines.push(`━━━━━━━━━━━━━━━━`);
  lines.push(`📌 คิวงาน: ${job.queueNumber}`);
  lines.push(`📦 สินค้า: ${job.product}`);
  lines.push(`👤 ลูกค้า: ${job.customer.name}`);
  if (cfg?.includeCustomerPhone && job.customer.hasPhone !== false && job.customer.phone && job.customer.phone !== 'ไม่มีเบอร์') {
    lines.push(`📞 โทร: ${job.customer.phone}`);
  }
  lines.push(`❌ นัดเดิม: ${previousDate} (${previousTime || 'ไม่ระบุเวลา'})`);
  lines.push(`✅ นัดใหม่: ${job.appointmentDate} (${job.appointmentTime || 'ไม่ระบุเวลา'})`);
  if (reason) {
    lines.push(`📝 เหตุผล/หมายเหตุ: ${reason}`);
  }
  if (job.assignedUserName) {
    lines.push(`👷 ช่างประจำงาน: ${job.assignedUserName}`);
  }
  lines.push(`━━━━━━━━━━━━━━━━`);
  lines.push(`🏪 ${settings.shopName || 'Repair Onsite Service'}`);
  lines.push(`⏰ ${new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`);

  return lines.join('\n');
}

/**
 * Format 30-minute urgent appointment reminder text fallback
 */
export function formatThirtyMinReminderText(
  job: RepairJob,
  schedule: AppointmentReminderSchedule,
  settings?: ShopSettings
): string {
  const diffMins = Math.round((schedule.appointmentAt - Date.now()) / 60000);
  const timeText =
    diffMins > 0
      ? `อีก ${diffMins} นาที จะถึงเวลานัดหมาย!`
      : diffMins === 0
      ? `ถึงเวลานัดหมายซ่อมแล้ว!`
      : `เกินกำหนดคิวงานแล้ว ${Math.abs(diffMins)} นาที!`;
  const tagHeader = diffMins < 0 ? '🔴 [แจ้งเตือนเกินคิวงาน!]' : '🚨 [แจ้งเตือนก่อนนัด 30 นาที]';
  const lines = [
    `${tagHeader} ${timeText}`,
    `━━━━━━━━━━━━━━━━`,
    `📌 คิวงาน: ${job.queueNumber}`,
    `📦 งาน: ${job.product}`,
    `⏰ เวลานัด: ${job.appointmentDate} (${job.appointmentTime})`,
    `👤 ลูกค้า: ${job.customer.name} (${job.customer.hasPhone === false || !job.customer.phone ? 'ไม่มีเบอร์' : job.customer.phone})`,
  ];
  if (job.customer.address) {
    lines.push(`🏠 ที่อยู่: ${job.customer.address}`);
  }
  const mapUrl = getMapUrlForJob(job);
  if (mapUrl) {
    lines.push(`📍 นำทาง: ${mapUrl}`);
  }
  lines.push(`━━━━━━━━━━━━━━━━`);
  lines.push(`👉 พิมพ์ "ยืนยัน" หรือ "รับทราบ" ในแชทนี้ หรือกดปุ่มยืนยันในโปรแกรมเพื่อหยุดการเตือนซ้ำ`);
  if (settings?.shopName) {
    lines.push(`🏪 ${settings.shopName}`);
  }
  return lines.join('\n');
}

/**
 * Build interactive LINE Flex Message for before-30m and overdue-queue appointment alarms
 * Includes both Postback "ยืนยันรับทราบทาง LINE" and App URI confirmation fallback
 */
export function buildThirtyMinReminderFlexMessage(
  job: RepairJob,
  schedule: AppointmentReminderSchedule,
  appBaseUrl: string
) {
  const diffMins = Math.round((schedule.appointmentAt - Date.now()) / 60000);
  const isOverdue = diffMins < 0;
  const headerTitle = isOverdue ? '🔴 แจ้งเตือนเกินคิวงาน!' : '🚨 แจ้งเตือนก่อนนัด 30 นาที';
  const headerSubtitle =
    diffMins > 0
      ? `อีก ${diffMins} นาที ถึงเวลานัด!`
      : diffMins === 0
      ? 'ถึงเวลานัดหมายซ่อมแล้ว!'
      : `เลยเวลานัดมาแล้ว ${Math.abs(diffMins)} นาที!`;
  const mapUrl = getMapUrlForJob(job);
  const cleanOrigin = (appBaseUrl || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
  const ackUri = cleanOrigin
    ? `${cleanOrigin}/?ack_alarm=${encodeURIComponent(schedule.ackKey)}&alarm_job=${encodeURIComponent(job.id)}`
    : '';

  const bodyContents: any[] = [
    {
      type: 'box',
      layout: 'horizontal',
      contents: [
        {
          type: 'text',
          text: `คิว ${job.queueNumber}`,
          weight: 'bold',
          size: 'md',
          color: '#FFFFFF',
          align: 'center',
        },
      ],
      backgroundColor: '#0F172A',
      cornerRadius: '8px',
      paddingAll: '6px',
      width: '90px',
    },
    {
      type: 'text',
      text: job.product || 'งานซ่อมนอกสถานที่',
      weight: 'bold',
      size: 'md',
      wrap: true,
      color: '#0F172A',
      margin: 'md',
    },
    {
      type: 'box',
      layout: 'vertical',
      margin: 'md',
      spacing: 'xs',
      contents: [
        {
          type: 'text',
          text: `⏰ เวลานัด: ${job.appointmentDate} (${job.appointmentTime})`,
          size: 'sm',
          weight: 'bold',
          color: '#DC2626',
          wrap: true,
        },
        {
          type: 'text',
          text: `👤 ลูกค้า: ${job.customer.name} (${job.customer.hasPhone === false || !job.customer.phone ? 'ไม่มีเบอร์' : job.customer.phone})`,
          size: 'xs',
          color: '#334155',
          wrap: true,
        },
        ...(job.customer.address
          ? [
              {
                type: 'text',
                text: `🏠 ที่อยู่: ${job.customer.address}`,
                size: 'xs',
                color: '#475569',
                wrap: true,
              },
            ]
          : []),
      ],
    },
    {
      type: 'text',
      text: 'ระบบจะแจ้งเตือนซ้ำจนกว่าจะกดปุ่มยืนยันรับทราบด้านล่าง หรือพิมพ์ "ยืนยัน" / "รับทราบ"',
      size: 'xxs',
      color: '#B45309',
      wrap: true,
      margin: 'md',
    },
  ];

  const footerContents: any[] = [
    {
      type: 'button',
      style: 'primary',
      color: '#059669',
      height: 'sm',
      action: {
        type: 'postback',
        label: '✅ ยืนยันรับทราบ (ปิดเสียงเตือน)',
        displayText: `ยืนยันรับทราบคิว ${job.queueNumber}`,
        data: `action=ack_alarm&ackKey=${encodeURIComponent(schedule.ackKey)}&queueNumber=${encodeURIComponent(job.queueNumber)}`,
      },
    },
  ];

  if (ackUri) {
    footerContents.push({
      type: 'button',
      style: 'secondary',
      height: 'sm',
      action: {
        type: 'uri',
        label: '📱 เปิดแอป & ปิดเสียงเตือน',
        uri: ackUri,
      },
    });
  }

  if (mapUrl) {
    footerContents.push({
      type: 'button',
      style: 'link',
      height: 'sm',
      action: {
        type: 'uri',
        label: '📍 เปิดแผนที่นำทาง GPS',
        uri: mapUrl,
      },
    });
  }

  return {
    type: 'flex',
    altText: `🚨 เตือนนัดหมาย ${headerSubtitle} คิว ${job.queueNumber}: ${job.product} (${job.appointmentTime}) — กดหรือพิมพ์ "ยืนยัน" เพื่อหยุดเตือน`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#DC2626',
        paddingAll: '14px',
        contents: [
          {
            type: 'text',
            text: headerTitle,
            color: '#FEF3C7',
            size: 'xs',
            weight: 'bold',
          },
          {
            type: 'text',
            text: headerSubtitle,
            color: '#FFFFFF',
            size: 'lg',
            weight: 'bold',
            margin: 'xs',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '16px',
        contents: bodyContents,
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: '12px',
        contents: footerContents,
      },
    },
  };
}

/**
 * Format connection test message
 */
export function formatTestNotification(settings: ShopSettings): string {
  const lines: string[] = [];
  lines.push(`🧪 [ทดสอบระบบ LINE Messaging API] ✅`);
  lines.push(`━━━━━━━━━━━━━━━━`);
  lines.push(`เชื่อมต่อ LINE Messaging API สำเร็จพร้อมใช้งาน!`);
  lines.push(`🏪 ร้าน: ${settings.shopName || 'Repair Onsite Service'}`);
  lines.push(`📞 เบอร์ติดต่อร้าน: ${settings.phone || '-'}`);
  lines.push(`⏰ พร้อมแจ้งเตือนก่อนเวลานัด 30 นาที (เตือนซ้ำจนกว่าจะกดยืนยัน)`);
  lines.push(`━━━━━━━━━━━━━━━━`);
  lines.push(`🕒 ${new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`);
  return lines.join('\n');
}

/**
 * Dispatch message via LINE Messaging API (or legacy LINE Notify if explicitly selected)
 */
export async function sendLineNotification(
  cfg: LineNotifySettings | undefined,
  textMessage: string,
  flexMessages?: any[]
): Promise<{ success: boolean; message: string; details?: any }> {
  const token = getActiveLineChannelToken(cfg);
  if (!token) {
    return {
      success: false,
      message: 'ยังไม่ได้ระบุ LINE Channel Access Token ในหน้าตั้งค่า',
    };
  }

  const provider = getActiveLineProvider(cfg);
  if (provider === 'line_notify') {
    return sendLegacyLineNotify(token, textMessage);
  }

  const sendMode = getLineSendMode(cfg);
  const targetId = (cfg?.targetId || '').trim();
  const messages =
    Array.isArray(flexMessages) && flexMessages.length > 0
      ? flexMessages
      : [{ type: 'text', text: textMessage.trim() }];

  try {
    const response = await fetch('/api/line-messaging/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channelAccessToken: token,
        targetId,
        sendMode,
        messages,
      }),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success) {
      return {
        success: false,
        message: data?.message || `ส่ง LINE Messaging API ไม่สำเร็จ (HTTP ${response.status})`,
        details: data,
      };
    }

    return {
      success: true,
      message: data?.message || 'ส่งแจ้งเตือนผ่าน LINE Messaging API สำเร็จเรียบร้อย!',
      details: data,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ LINE Messaging API ได้: ${err?.message || 'Network error'}`,
    };
  }
}

export async function sendLegacyLineNotify(
  token: string,
  message: string
): Promise<{ success: boolean; message: string; details?: any }> {
  if (!token || !token.trim()) {
    return {
      success: false,
      message: 'ยังไม่ได้ระบุ Token ในหน้าตั้งค่า',
    };
  }

  try {
    const response = await fetch('/api/line-notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token.trim(), message: message.trim() }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        success: false,
        message: data?.message || `เกิดข้อผิดพลาดจากเซิร์ฟเวอร์ (HTTP ${response.status})`,
        details: data,
      };
    }
    return {
      success: true,
      message: data?.message || 'ส่งแจ้งเตือนสำเร็จ!',
      details: data,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้: ${err?.message || 'Network error'}`,
    };
  }
}

/**
 * Compatibility wrapper used across existing code
 */
export async function sendLineNotify(
  tokenOrCfg: string | LineNotifySettings,
  message: string
): Promise<{ success: boolean; message: string; details?: any }> {
  if (typeof tokenOrCfg === 'string') {
    return sendLineNotification(
      {
        enabled: true,
        provider: 'messaging_api',
        token: tokenOrCfg,
        channelAccessToken: tokenOrCfg,
        sendMode: 'broadcast',
        notifyOnNewJob: true,
        notifyOnStatusChange: true,
        includeCustomerPhone: true,
        includeMapLink: true,
      },
      message
    );
  }
  return sendLineNotification(tokenOrCfg, message);
}

export interface CapturedLineTarget {
  id: string;
  type: 'user' | 'group' | 'room';
  lastMessage?: string;
  lastSeenAt: string;
}

export async function fetchLineMessagingStatus(): Promise<{
  acknowledgedKeys: string[];
  capturedTargets: CapturedLineTarget[];
  lastSentAt: Record<string, number>;
} | null> {
  try {
    const res = await fetch('/api/line-messaging/status');
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function postServerAlarmAck(
  ackKeys: string[],
  source: 'app' | 'line_uri' = 'app'
): Promise<void> {
  try {
    await fetch('/api/line-messaging/ack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ackKeys, source }),
    });
  } catch {}
}

export async function syncSchedulesAndLineConfigToServer(
  schedules: AppointmentReminderSchedule[],
  settings: ShopSettings,
  acknowledgedKeys: string[]
): Promise<{ acknowledgedKeys?: string[]; capturedTargets?: CapturedLineTarget[] } | null> {
  try {
    const cfg = settings.lineNotify;
    const channelAccessToken = getActiveLineChannelToken(cfg);
    const appBaseUrl = typeof window !== 'undefined' ? window.location.origin : '';

    const res = await fetch('/api/line-messaging/sync-schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schedules,
        acknowledgedKeys,
        lineConfig: {
          enabled: cfg?.enabled !== false && Boolean(channelAccessToken),
          provider: getActiveLineProvider(cfg),
          channelAccessToken,
          targetId: (cfg?.targetId || '').trim(),
          sendMode: getLineSendMode(cfg),
          notifyBefore30Min: cfg?.notifyBefore30Min !== false,
          repeatIntervalMinutes: Number(cfg?.repeatIntervalMinutes) || 2,
          includeCustomerPhone: cfg?.includeCustomerPhone !== false,
          includeMapLink: cfg?.includeMapLink !== false,
          appBaseUrl,
          shopName: settings.shopName || 'Repair Onsite Service',
        },
      }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Generate LINE direct share link for fallback manual sending
 */
export function getLineShareUrl(text: string): string {
  return `https://line.me/R/share?text=${encodeURIComponent(text)}`;
}

/**
 * Load notification logs from localStorage
 */
export function loadNotificationLogs(): NotificationLog[] {
  try {
    const raw = localStorage.getItem(NOTIFICATION_LOGS_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to load notification logs', e);
  }
  return [];
}

/**
 * Save a new log entry
 */
export function addNotificationLog(log: Omit<NotificationLog, 'id' | 'timestamp'>): NotificationLog {
  const fullLog: NotificationLog = {
    ...log,
    id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
  };

  try {
    const existing = loadNotificationLogs();
    const updated = [fullLog, ...existing].slice(0, 50);
    localStorage.setItem(NOTIFICATION_LOGS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to save notification log', e);
  }

  return fullLog;
}

/**
 * Clear all logs
 */
export function clearNotificationLogs(): void {
  try {
    localStorage.removeItem(NOTIFICATION_LOGS_KEY);
  } catch (e) {
    console.error('Failed to clear logs', e);
  }
}
