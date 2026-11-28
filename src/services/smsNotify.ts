// File: /src/services/smsNotify.ts | Revision: Rev 30 | Version: 1.6.1 | Modified: 2026-11-27
import { CustomerInfo, RepairJob, RepairStatus, ShopSettings, SmsNotifySettings } from '../types';
import { addNotificationLog, getMapUrlForJob } from './lineNotify';

export const DEFAULT_SMS_SETTINGS: SmsNotifySettings = {
  enabled: true,
  provider: 'device_sms',
  onlyWhenNoCustomerLine: true,
  autoSendOnCreate: true,
  autoSendOnStatusChange: true,
  senderName: '',
  apiKey: '',
  apiSecret: '',
  webhookUrl: '',
  notifyOnNewJob: true,
  notifyOnStatusChange: true,
  notifyOnReschedule: true,
  includeShopPhone: true,
  includeMapLink: false,
};

export function resolveSmsSettings(cfg?: Partial<SmsNotifySettings>): SmsNotifySettings {
  return {
    ...DEFAULT_SMS_SETTINGS,
    ...(cfg || {}),
    provider:
      cfg?.provider === 'thaibulksms' || cfg?.provider === 'twilio' || cfg?.provider === 'webhook'
        ? cfg.provider
        : 'device_sms',
  };
}

/**
 * Clean phone string to dialable digits (preserves optional leading '+')
 */
export function cleanSmsPhone(phone?: string): string {
  if (!phone) return '';
  const trimmed = phone.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/[^0-9]/g, '');
  if (!digits) return '';
  return hasPlus ? `+${digits}` : digits;
}

/**
 * Check whether customer has a real phone number (vs "ไม่มีเบอร์")
 */
export function hasCustomerPhone(customer?: Partial<CustomerInfo> | null): boolean {
  if (!customer) return false;
  if (customer.hasPhone === false) return false;
  const raw = (customer.phone || '').trim();
  if (!raw || raw === 'ไม่มีเบอร์' || raw === '-') return false;
  return cleanSmsPhone(raw).length > 0;
}

/**
 * Format customer phone for display ("ไม่มีเบอร์" when customer has no phone)
 */
export function formatCustomerPhone(customer?: Partial<CustomerInfo> | null): string {
  return hasCustomerPhone(customer) ? (customer!.phone || '').trim() : 'ไม่มีเบอร์';
}

/**
 * Format phone into Thai E.164 (+66xxxxxxxxx) for international SMS gateways like Twilio
 */
export function formatThaiE164Phone(phone?: string): string {
  const cleaned = cleanSmsPhone(phone);
  if (!cleaned) return '';
  if (cleaned.startsWith('+')) return cleaned;
  if (cleaned.startsWith('0') && cleaned.length >= 9) {
    return `+66${cleaned.slice(1)}`;
  }
  if (cleaned.startsWith('66') && cleaned.length >= 10) {
    return `+${cleaned}`;
  }
  return `+${cleaned}`;
}

/**
 * Check if an automated server-side SMS Gateway (ThaiBulkSMS / Twilio / Webhook) has valid credentials
 */
export function isSmsGatewayConfigured(cfg?: SmsNotifySettings): boolean {
  const resolved = resolveSmsSettings(cfg);
  if (!resolved.enabled) return false;
  if (resolved.provider === 'thaibulksms') {
    return Boolean(resolved.apiKey.trim() && resolved.apiSecret.trim());
  }
  if (resolved.provider === 'twilio') {
    return Boolean(
      resolved.apiKey.trim() && resolved.apiSecret.trim() && resolved.senderName.trim()
    );
  }
  if (resolved.provider === 'webhook') {
    return Boolean(resolved.webhookUrl?.trim());
  }
  return false;
}

/**
 * Check whether this repair job qualifies for customer SMS notification
 * (respecting onlyWhenNoCustomerLine when customer has not added shop LINE)
 */
export function shouldNotifyCustomerBySms(
  job: RepairJob,
  cfg?: SmsNotifySettings,
  ignoreLineFilter = false
): boolean {
  const resolved = resolveSmsSettings(cfg);
  if (!resolved.enabled) return false;
  if (job.customer?.hasPhone === false) return false;
  const phone = cleanSmsPhone(job.customer?.phone);
  if (!phone || phone.length < 8) return false;
  if (!ignoreLineFilter && resolved.onlyWhenNoCustomerLine) {
    if (job.customer?.lineId && job.customer.lineId.trim().length > 0) {
      return false;
    }
  }
  return true;
}

function getShortShopFooter(settings: ShopSettings, cfg: SmsNotifySettings): string {
  const shopName = (settings.shopName || 'ศูนย์บริการซ่อม').trim();
  if (cfg.includeShopPhone && settings.phone?.trim()) {
    return `${shopName} โทร ${settings.phone.trim()}`;
  }
  return shopName;
}

/**
 * Concise customer-facing SMS for newly booked repair queue
 */
export function formatCustomerNewJobSms(job: RepairJob, settings: ShopSettings): string {
  const cfg = resolveSmsSettings(settings.smsNotify);
  const parts: string[] = [
    `เรียนคุณ${job.customer?.name || 'ลูกค้า'} ร้านได้รับคิวซ่อม ${job.queueNumber} (${job.product})`,
    `นัดหมาย: ${job.appointmentDate} เวลา ${job.appointmentTime || 'ตามนัด'}`,
  ];

  if (job.estimatedCost > 0) {
    parts.push(`ประเมินเบื้องต้น ฿${job.estimatedCost.toLocaleString('th-TH')}`);
  }
  if (job.assignedUserName) {
    parts.push(`ช่างผู้ดูแล: ${job.assignedUserName}`);
  }
  if (cfg.includeMapLink) {
    const mapUrl = getMapUrlForJob(job);
    if (mapUrl) parts.push(`พิกัด: ${mapUrl}`);
  }
  parts.push(`ติดต่อ: ${getShortShopFooter(settings, cfg)}`);

  return parts.join('\n');
}

/**
 * Concise customer-facing SMS for job status updates
 */
export function formatCustomerStatusSms(
  job: RepairJob,
  newStatus: RepairStatus,
  settings: ShopSettings
): string {
  const cfg = resolveSmsSettings(settings.smsNotify);
  const parts: string[] = [];

  if (newStatus === 'กำลังไป') {
    parts.push(
      `[แจ้งคิว ${job.queueNumber}] ช่างกำลังเดินทางไปบริการซ่อม "${job.product}" ให้คุณ${job.customer?.name || 'ลูกค้า'} กรุณารอรับสายช่างครับ`
    );
  } else if (newStatus === 'กำลังซ่อม') {
    parts.push(
      `[แจ้งคิว ${job.queueNumber}] ช่างเริ่มดำเนินการตรวจเช็ค/ซ่อม "${job.product}" แล้วครับ`
    );
  } else if (newStatus === 'ซ่อมแล้ว' || newStatus === 'ปิดงาน') {
    const finalCost =
      job.actualCost !== null && job.actualCost !== undefined
        ? job.actualCost
        : job.estimatedCost;
    const costText =
      finalCost > 0 ? ` ค่าบริการ ฿${finalCost.toLocaleString('th-TH')}` : '';
    const warrantyText =
      job.warrantyDays > 0
        ? ` รับประกัน ${job.warrantyDays} วัน (ถึง ${job.warrantyEndDate})`
        : ' (ไม่มีประกัน)';
    parts.push(
      `[แจ้งคิว ${job.queueNumber}] งานซ่อม "${job.product}" ${newStatus === 'ปิดงาน' ? 'ปิดงานเรียบร้อย' : 'ซ่อมเสร็จแล้ว'}${costText}${warrantyText}`
    );
  } else if (newStatus === 'นัดหมายต่อ') {
    parts.push(
      `[แจ้งคิว ${job.queueNumber}] งานซ่อม "${job.product}" เปลี่ยนสถานะเป็นนัดหมายต่อ วันนัด: ${job.appointmentDate} (${job.appointmentTime || 'ตามนัด'})`
    );
  } else if (newStatus === 'ยกเลิก') {
    parts.push(
      `[แจ้งคิว ${job.queueNumber}] แจ้งยกเลิกคิวซ่อม "${job.product}"${job.cancelReason ? ` (${job.cancelReason})` : ''}`
    );
  } else {
    parts.push(
      `[แจ้งคิว ${job.queueNumber}] สถานะงานซ่อม "${job.product}": ${newStatus} (นัด ${job.appointmentDate} ${job.appointmentTime || ''})`
    );
  }

  if (job.assignedUserName && newStatus !== 'ปิดงาน' && newStatus !== 'ยกเลิก') {
    parts.push(`ช่าง: ${job.assignedUserName}`);
  }
  if (cfg.includeMapLink && (newStatus === 'รับงาน' || newStatus === 'กำลังไป')) {
    const mapUrl = getMapUrlForJob(job);
    if (mapUrl) parts.push(`พิกัด: ${mapUrl}`);
  }
  parts.push(getShortShopFooter(settings, cfg));

  return parts.join('\n');
}

/**
 * Concise customer-facing SMS for appointment reschedule
 */
export function formatCustomerRescheduleSms(
  job: RepairJob,
  settings: ShopSettings,
  reason?: string
): string {
  const cfg = resolveSmsSettings(settings.smsNotify);
  const parts: string[] = [
    `[เลื่อนนัดคิว ${job.queueNumber}] เรียนคุณ${job.customer?.name || 'ลูกค้า'} เปลี่ยนนัดซ่อม "${job.product}"`,
    `วัน/เวลานัดใหม่: ${job.appointmentDate} (${job.appointmentTime || 'ตามนัด'})`,
  ];
  if (reason?.trim()) {
    parts.push(`หมายเหตุ: ${reason.trim()}`);
  }
  parts.push(`ติดต่อ: ${getShortShopFooter(settings, cfg)}`);
  return parts.join('\n');
}

/**
 * Sample test SMS text
 */
export function formatTestSms(settings: ShopSettings): string {
  const cfg = resolveSmsSettings(settings.smsNotify);
  return [
    `[ทดสอบ SMS] แจ้งเตือนคิวงาน Q-01 (แอร์บ้าน)`,
    `นัดหมาย: วันนี้ 10:00 - 12:00`,
    `ระบบแจ้งเตือนลูกค้าพร้อมใช้งานแล้ว`,
    getShortShopFooter(settings, cfg),
  ].join('\n');
}

/**
 * Build native device SMS URI (`sms:<phone>?body=<encodedText>`)
 * Compatible with Android Chrome & modern iOS Safari without window.open/alert.
 */
export function buildDeviceSmsUri(phone: string, text: string): string {
  const cleaned = cleanSmsPhone(phone);
  return `sms:${cleaned}?body=${encodeURIComponent(text)}`;
}

/**
 * Open device SMS composer cleanly via temporary anchor click (iframe-safe)
 */
export function openDeviceSmsComposer(phone: string, text: string): boolean {
  const cleaned = cleanSmsPhone(phone);
  if (!cleaned || typeof document === 'undefined') return false;
  const uri = buildDeviceSmsUri(cleaned, text);
  const anchor = document.createElement('a');
  anchor.href = uri;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  setTimeout(() => {
    try {
      anchor.remove();
    } catch {}
  }, 200);
  return true;
}

export interface SendSmsResult {
  success: boolean;
  mode: 'gateway' | 'device_sms';
  smsUri?: string;
  message: string;
  details?: any;
}

/**
 * Dispatch customer SMS either automatically via configured SMS Gateway (/api/sms/send)
 * or via native mobile SMS app composer (`sms:` URI). Always appends to notification history logs.
 */
export async function sendSmsNotification(params: {
  cfg?: SmsNotifySettings;
  toPhone: string;
  message: string;
  settings: ShopSettings;
  job?: RepairJob;
  eventType?: 'new_job' | 'status_change' | 'manual_test' | 'sms_customer';
  forceDeviceSms?: boolean;
}): Promise<SendSmsResult> {
  const resolved = resolveSmsSettings(params.cfg ?? params.settings.smsNotify);
  const cleanedPhone = cleanSmsPhone(params.toPhone);
  const eventType = params.eventType || 'sms_customer';

  if (!cleanedPhone || cleanedPhone.length < 8) {
    return {
      success: false,
      mode: resolved.provider === 'device_sms' || params.forceDeviceSms ? 'device_sms' : 'gateway',
      message: 'ไม่พบเบอร์โทรศัพท์ลูกค้าที่ถูกต้องสำหรับส่ง SMS',
    };
  }

  const useDeviceSms = params.forceDeviceSms || resolved.provider === 'device_sms';

  if (useDeviceSms) {
    const smsUri = buildDeviceSmsUri(cleanedPhone, params.message);
    openDeviceSmsComposer(cleanedPhone, params.message);
    addNotificationLog({
      channel: 'sms',
      recipientPhone: params.toPhone,
      type: eventType,
      jobQueueNumber: params.job?.queueNumber,
      jobProduct: params.job?.product,
      status: params.job?.status,
      success: true,
      message: `เปิดแอป SMS เตรียมส่งถึง ${params.toPhone}${params.job ? ` (คิว ${params.job.queueNumber})` : ''}`,
      responseMessage: 'Device SMS Composer',
    });
    return {
      success: true,
      mode: 'device_sms',
      smsUri,
      message: `เปิดแอปข้อความ SMS ของมือถือพร้อมข้อความถึง ${params.toPhone} เรียบร้อยแล้ว`,
    };
  }

  try {
    const response = await fetch('/api/sms/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: resolved.provider,
        toPhone: cleanedPhone,
        message: params.message,
        senderName: resolved.senderName.trim(),
        apiKey: resolved.apiKey.trim(),
        apiSecret: resolved.apiSecret.trim(),
        webhookUrl: resolved.webhookUrl?.trim() || '',
      }),
    });

    const data = await response.json().catch(() => null);
    const success = Boolean(response.ok && data?.success);
    const resultMsg =
      data?.message ||
      (success
        ? `ส่ง SMS แจ้งเตือนไปยัง ${params.toPhone} สำเร็จ!`
        : `ส่ง SMS ไม่สำเร็จ (HTTP ${response.status})`);

    addNotificationLog({
      channel: 'sms',
      recipientPhone: params.toPhone,
      type: eventType,
      jobQueueNumber: params.job?.queueNumber,
      jobProduct: params.job?.product,
      status: params.job?.status,
      success,
      message: `ส่ง SMS ถึง ${params.toPhone}${params.job ? ` คิว ${params.job.queueNumber}` : ''}`,
      responseMessage: resultMsg,
    });

    return {
      success,
      mode: 'gateway',
      message: resultMsg,
      details: data,
    };
  } catch (err: any) {
    const errMsg = `เชื่อมต่อเซิร์ฟเวอร์ส่ง SMS ไม่สำเร็จ: ${err?.message || 'Network error'}`;
    addNotificationLog({
      channel: 'sms',
      recipientPhone: params.toPhone,
      type: eventType,
      jobQueueNumber: params.job?.queueNumber,
      jobProduct: params.job?.product,
      status: params.job?.status,
      success: false,
      message: `ส่ง SMS ถึง ${params.toPhone}${params.job ? ` คิว ${params.job.queueNumber}` : ''}`,
      responseMessage: errMsg,
    });
    return {
      success: false,
      mode: 'gateway',
      message: errMsg,
    };
  }
}
