export type RepairStatus =
  | 'รับงาน'
  | 'กำลังไป'
  | 'กำลังซ่อม'
  | 'ซ่อมแล้ว'
  | 'ปิดงาน'
  | 'นัดหมายต่อ'
  | 'ยกเลิก';

export interface CustomerInfo {
  name: string;
  phone: string;
  lineId: string;
  facebook: string;
  address: string;
  mapCoordinates?: string; // e.g. "13.7563,100.5018" or address for Google Maps
}

export interface StatusPhotoItem {
  id: string;
  dataUrl: string; // Data URL สำหรับรูปภาพ หรือ 'idb://...' สำหรับไฟล์วิดีโอใน IndexedDB
  mediaType?: 'image' | 'video';
  thumbnailDataUrl?: string; // ภาพตัวอย่างหน้าปกวิดีโอ
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  durationSec?: number;
  createdAt: string;
  note?: string;
}

export type StatusPhotosMap = Partial<Record<RepairStatus, StatusPhotoItem[]>>;

export interface RepairJob {
  id: string;
  queueNumber: string; // คิวงาน เช่น Q-01, Q-02
  loggedDate: string; // วันที่บันทึก YYYY-MM-DD
  product: string; // สินค้า เช่น แอร์ Daikin Inverter 18000 BTU
  productCategory: string; // หมวดหมู่ เช่น แอร์/เครื่องปรับอากาศ, ตู้เย็น, ปั๊มน้ำ, เครื่องซักผ้า
  jobDetails: string; // รายละเอียดงาน เช่น ล้างแอร์ใหญ่พร้อมตรวจเช็คน้ำยา
  symptoms: string; // อาการที่รับแจ้ง เช่น แอร์ไม่เย็น มีเสียงดัง คอยล์ร้อนไม่หมุน
  customer: CustomerInfo;
  appointmentDate: string; // วันนัดหมาย YYYY-MM-DD
  appointmentTime: string; // เวลานัดหมาย เช่น 10:00 - 12:00
  estimatedCost: number; // ประเมินค่าซ่อม (บาท)
  actualCost: number | null; // ค่าซ่อมจริง (บาท)
  status: RepairStatus; // สถานะ
  warrantyDays: number; // ระยะประกัน (วัน เช่น 30, 90, 180, 365)
  warrantyStartDate: string; // วันที่เริ่มนับประกัน (มักเป็นวันที่ซ่อมแล้ว/ปิดงาน หรือวันที่บันทึก)
  warrantyEndDate: string; // วันที่สิ้นสุดประกัน YYYY-MM-DD
  assignedUserId?: string; // ช่างที่รับผิดชอบ
  assignedUserName?: string;
  photos?: string[]; // รูปถ่ายหน้างาน (legacy)
  statusPhotos?: StatusPhotosMap; // รูปถ่าย/วิดีโอ/แนบรูปแยกตามแต่ละสถานะของคิวงาน
  closedAt?: string; // วันที่ปิดงานซ่อม YYYY-MM-DD
  cancelReason?: string; // เหตุผลการยกเลิกงาน (หากมี)
  notes?: string;
}

export interface ShopSettings {
  shopName: string;
  phone: string;
  lineId: string;
  lineUrl?: string;
  facebook: string;
  facebookUrl?: string;
  address: string;
  coverImage: string;
  coverTitle: string;
  coverSubtitle: string;
  adminPassword: string; // รหัสผ่านแอดมินสำหรับเข้าหน้าตั้งค่า
  adminSecretToken?: string; // โทเคนสำหรับสร้างลิงก์แอดมินโดยเฉพาะ
  lineNotify?: LineNotifySettings; // ตั้งค่าการแจ้งเตือน LINE Notify / LINE Messaging API
  smsNotify?: SmsNotifySettings; // ตั้งค่าการส่ง SMS แจ้งเตือนลูกค้า (กรณีไม่ได้แอด LINE ร้าน)
  repairCategories?: string[]; // หมวดงานซ่อมที่ผู้ใช้งานเพิ่มเองในหน้าตั้งค่า
  technicians?: string[]; // รายชื่อช่างผู้รับผิดชอบที่ผู้ใช้งานเพิ่มเองในหน้าตั้งค่า
}

export type SmsProvider = 'device_sms' | 'thaibulksms' | 'twilio' | 'webhook';

export interface SmsNotifySettings {
  enabled: boolean;
  provider: SmsProvider;
  onlyWhenNoCustomerLine: boolean; // ส่ง SMS เฉพาะกรณีลูกค้าไม่ได้กรอก LINE ID / ไม่ได้แอด LINE ร้าน
  autoSendOnCreate: boolean; // แสดงปุ่มส่งด่วน / ส่งอัตโนมัติเมื่อรับคิวงานใหม่
  autoSendOnStatusChange: boolean; // แสดงปุ่มส่งด่วน / ส่งอัตโนมัติเมื่ออัปเดตสถานะงานหรือปิดงาน
  senderName: string; // ชื่อผู้ส่ง (Sender Name สำหรับ ThaiBulkSMS) หรือเบอร์ From (Twilio)
  apiKey: string; // API Key (ThaiBulkSMS) หรือ Account SID (Twilio)
  apiSecret: string; // API Secret (ThaiBulkSMS) หรือ Auth Token (Twilio)
  webhookUrl?: string; // Custom Webhook URL (เช่น n8n / Make / SMS Gateway อื่น)
  notifyOnNewJob: boolean; // แจ้งเตือน SMS เมื่อมีคิวงานใหม่
  notifyOnStatusChange: boolean; // แจ้งเตือน SMS เมื่อเปลี่ยนสถานะ/ซ่อมเสร็จ/ปิดงาน
  notifyOnReschedule: boolean; // แจ้งเตือน SMS เมื่อเปลี่ยนวัน/เวลานัดหมาย
  includeShopPhone: boolean; // แนบเบอร์โทรศัพท์ร้านในข้อความ SMS
  includeMapLink: boolean; // แนบลิงก์แผนที่หน้างาน (หากมี)
}

export interface LineNotifySettings {
  enabled: boolean;
  provider?: 'messaging_api' | 'line_notify';
  token: string; // Channel Access Token (LINE Messaging API) หรือ Legacy LINE Notify Token
  channelAccessToken?: string; // Channel Access Token สำหรับ LINE Messaging API
  channelSecret?: string; // Optional Channel Secret
  targetId?: string; // User ID (U...) หรือ Group ID (C...) ผู้รับข้อความ
  sendMode?: 'push' | 'broadcast'; // push (เจาะจง User/Group ID) หรือ broadcast (ส่งทุกคนใน OA)
  notifyOnNewJob: boolean; // แจ้งเตือนเมื่อมีคิวงาน/นัดหมายใหม่
  notifyOnStatusChange: boolean; // แจ้งเตือนเมื่อมีการอัปเดตสถานะงาน
  notifyBefore30Min?: boolean; // แจ้งเตือนก่อนเวลานัดหมาย 30 นาที (เตือนซ้ำจนกว่าจะกดยืนยัน)
  repeatIntervalMinutes?: number; // ช่วงเวลาส่งเตือนซ้ำทาง LINE (นาที) จนกว่าจะกดยืนยัน
  includeCustomerPhone: boolean; // แสดงเบอร์ลูกค้าในแจ้งเตือน
  includeMapLink: boolean; // แนบลิงก์ Google Maps ในแจ้งเตือน
}

export interface NotificationLog {
  id: string;
  timestamp: string;
  channel?: 'line' | 'sms';
  recipientPhone?: string;
  type: 'new_job' | 'status_change' | 'manual_test' | 'reminder_30m' | 'sms_customer';
  jobQueueNumber?: string;
  jobProduct?: string;
  status?: RepairStatus;
  success: boolean;
  message: string;
  responseMessage?: string;
}

export interface RenewalCode {
  code: string;
  daysToAdd: number;
  isUsed: boolean;
  usedAt?: string;
}

export interface UserAccount {
  id: string;
  name: string;
  phone: string;
  username: string; // รหัส login
  password: string; // รหัสผ่าน
  role: 'admin' | 'user';
  linkToken: string; // โทเคนสำหรับสร้างลิงก์ user เช่น ?token=tech_somsak_771
  userLink: string; // ลิงก์เต็มสำหรับส่งให้ user เข้าใช้งาน
  expiresAt: string; // วันหมดอายุลิงก์ YYYY-MM-DDTHH:mm:ss หรือ YYYY-MM-DD
  renewalCode: string; // รหัสต่ออายุใช้งานหลัก
  renewalCodesList: RenewalCode[]; // รายการรหัสต่ออายุ
  createdAt: string;
  notes?: string;
}

export type ViewTab = 'dashboard' | 'queue' | 'calendar' | 'map' | 'create_link' | 'source_code' | 'settings';
