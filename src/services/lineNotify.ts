import { RepairJob, RepairStatus, ShopSettings, NotificationLog } from '../types';

const NOTIFICATION_LOGS_KEY = 'repair_onsite_line_logs_v1';

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
 * Format new appointment job alert message for LINE Notify
 */
export function formatNewJobNotification(job: RepairJob, settings: ShopSettings): string {
  const cfg = settings.lineNotify;
  const lines: string[] = [];

  lines.push(`\n🔔 [มีนัดหมายงานซ่อมใหม่] 🛠️`);
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
  if (cfg?.includeCustomerPhone && job.customer.phone) {
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
  lines.push(`⏰ ${new Date().toLocaleDateString('th-TH', { hour: '2-digit', minute: '2-digit' })}`);

  return lines.join('\n');
}

/**
 * Format status change alert message for LINE Notify
 */
export function formatStatusChangeNotification(
  job: RepairJob,
  previousStatus: RepairStatus | undefined,
  newStatus: RepairStatus,
  settings: ShopSettings
): string {
  const cfg = settings.lineNotify;
  const lines: string[] = [];

  // Status emoji mapper
  const statusEmoji: Record<RepairStatus, string> = {
    'รับงาน': '📥',
    'กำลังไป': '🚗💨',
    'กำลังซ่อม': '🔧⚙️',
    'ซ่อมแล้ว': '✅✨',
    'ปิดงาน': '🏁🎉',
    'นัดหมายต่อ': '📆🔁',
    'ยกเลิก': '❌⚠️',
  };

  const emoji = statusEmoji[newStatus] || '⚡';

  lines.push(`\n${emoji} [อัปเดตสถานะงานซ่อม]`);
  lines.push(`━━━━━━━━━━━━━━━━`);
  lines.push(`📌 คิวงาน: ${job.queueNumber}`);
  lines.push(`🔄 สถานะ: 👉 "${newStatus}"` + (previousStatus ? ` (เดิม: ${previousStatus})` : ''));
  lines.push(`📦 สินค้า: ${job.product}`);
  lines.push(`👤 ลูกค้า: ${job.customer.name}`);

  if (cfg?.includeCustomerPhone && job.customer.phone) {
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

  if (cfg?.includeMapLink) {
    const mapUrl = getMapUrlForJob(job);
    if (mapUrl && (newStatus === 'กำลังไป' || newStatus === 'รับงาน')) {
      lines.push(`📍 พิกัดหน้างาน: ${mapUrl}`);
    }
  }

  lines.push(`━━━━━━━━━━━━━━━━`);
  lines.push(`🏪 ${settings.shopName || 'Repair Onsite Service'}`);
  lines.push(`⏰ ${new Date().toLocaleDateString('th-TH', { hour: '2-digit', minute: '2-digit' })}`);

  return lines.join('\n');
}

/**
 * Format connection test message
 */
export function formatTestNotification(settings: ShopSettings): string {
  const lines: string[] = [];
  lines.push(`\n🧪 [ทดสอบระบบ LINE Notify] ✅`);
  lines.push(`━━━━━━━━━━━━━━━━`);
  lines.push(`การเชื่อมต่อระหว่างระบบ Onsite Service กับ LINE สำเร็จสมบูรณ์!`);
  lines.push(`🏪 ร้าน: ${settings.shopName || 'Repair Onsite Service'}`);
  lines.push(`📞 เบอร์ติดต่อร้าน: ${settings.phone || '-'}`);
  lines.push(`📱 LINE ร้าน: ${settings.lineId || '-'}`);
  lines.push(`⚡ ระบบพร้อมส่งการแจ้งเตือนงานนัดหมายใหม่และสถานะงานเรียลไทม์`);
  lines.push(`━━━━━━━━━━━━━━━━`);
  lines.push(`⏰ ${new Date().toLocaleDateString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`);
  return lines.join('\n');
}

/**
 * Send notification to LINE Notify via server backend proxy
 */
export async function sendLineNotify(
  token: string,
  message: string
): Promise<{ success: boolean; message: string; details?: any }> {
  if (!token || !token.trim()) {
    return {
      success: false,
      message: 'ยังไม่ได้ระบุ LINE Notify Token ในหน้าตั้งค่า',
    };
  }

  try {
    const response = await fetch('/api/line-notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token: token.trim(),
        message: message.trim(),
      }),
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
      message: data?.message || 'ส่งแจ้งเตือนผ่าน LINE Notify สำเร็จเรียบร้อย!',
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
    const updated = [fullLog, ...existing].slice(0, 50); // Keep latest 50 logs
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
