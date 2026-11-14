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
  photos?: string[]; // รูปถ่ายหน้างาน
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
  lineNotify?: LineNotifySettings; // ตั้งค่าการแจ้งเตือน LINE Notify
  repairCategories?: string[]; // หมวดงานซ่อมที่ผู้ใช้งานเพิ่มเองในหน้าตั้งค่า
  technicians?: string[]; // รายชื่อช่างผู้รับผิดชอบที่ผู้ใช้งานเพิ่มเองในหน้าตั้งค่า
}

export interface LineNotifySettings {
  enabled: boolean;
  token: string;
  notifyOnNewJob: boolean; // แจ้งเตือนเมื่อมีคิวงาน/นัดหมายใหม่
  notifyOnStatusChange: boolean; // แจ้งเตือนเมื่อมีการอัปเดตสถานะงาน
  includeCustomerPhone: boolean; // แสดงเบอร์ลูกค้าในแจ้งเตือน
  includeMapLink: boolean; // แนบลิงก์ Google Maps ในแจ้งเตือน
}

export interface NotificationLog {
  id: string;
  timestamp: string;
  type: 'new_job' | 'status_change' | 'manual_test';
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

export type ViewTab = 'dashboard' | 'queue' | 'calendar' | 'create_link' | 'settings';
