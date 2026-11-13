// File: /src/version.ts | Revision: Rev 14 | Version: 1.2.9 | Modified: 2026-11-13
// ระบบจัดเก็บข้อมูลเวอร์ชันและประวัติการแก้ไขไฟล์ (Revision Tracking)

export const APP_VERSION = '1.2.9';
export const APP_REVISION = 'Rev 14';
export const APP_RELEASE_DATE = '2026-11-13';

export interface RevisionRecord {
  revision: string;
  version: string;
  date: string;
  description: string;
  modifiedFiles: string[];
}

export const REVISION_HISTORY: RevisionRecord[] = [
  {
    revision: 'Rev 14',
    version: '1.2.9',
    date: '2026-11-13',
    description:
      'เพิ่มลิงก์แอดมินถาวรไม่มีวันหมดอายุ (?a=cn2026) พร้อมปุ่มคัดลอกในหน้าสร้าง Link User, ยกเลิกบูทสกรีนและล้างค่าอายุลิงก์ 45 วันค้างเมื่อเปิดหน้าหลัก/แอดมิน (ยังคงบูทสกรีนไว้สำหรับลิงก์ User), และบีบอัดลิงก์ User ให้สั้นลงสูงสุดเหลือ ~15-20 ตัวอักษรหลัง ?u= ด้วยการเข้ารหัสแบบ 1-ต่อ-1 ไม่ขยายขนาด Base64',
    modifiedFiles: [
      'src/version.ts',
      'src/services/storage.ts',
      'src/App.tsx',
      'src/components/CreateUserLinkPage.tsx',
      'package.json',
    ],
  },
  {
    revision: 'Rev 13',
    version: '1.2.8',
    date: '2026-11-13',
    description:
      'บีบอัดลิงก์ User ให้สั้นลงมากกว่า 70% (?u=...) โดยยังคงรองรับการเข้าใช้งานข้ามอุปกรณ์และลิงก์เดิม, เปลี่ยนป้ายข้อความ "คำโปรยรองใต้หัวเรื่อง" เป็น "สโลวแกนร้าน", และอัปเดตแถบด้านล่างสุดเป็น "ผู้จัดทำ ช่างหน่อยชุมแพ 0992256601" แทนเบอร์โทร/LINE ร้าน',
    modifiedFiles: [
      'src/version.ts',
      'src/services/storage.ts',
      'src/components/AdminSettings.tsx',
      'src/App.tsx',
      'package.json',
    ],
  },
  {
    revision: 'Rev 12',
    version: '1.2.7',
    date: '2026-11-13',
    description:
      'แก้ไขระบบลิงก์ User ที่แชร์ให้ใช้งานข้ามอุปกรณ์ได้อย่างสมบูรณ์: เข้ารหัสข้อมูลบัญชีและวันหมดอายุลงในลิงก์ที่สร้าง, บังคับเปิดหน้าต่างใส่ Username และ Password ก่อนเข้าใช้งาน (ไม่สลับเป็น Admin และไม่วนหน้าจอบูตก่อนล็อกอิน), ลบข้อมูลร้านค้าในหน้าตั้งค่าและแถบ Footer ด้านล่างออกทั้งหมดในโหมด User, และเคลียร์ข้อความหัวเรื่องหน้าปกกับคำโปรยใต้หัวเรื่องไม่ให้มีค่าเดิมค้างไว้',
    modifiedFiles: [
      'src/version.ts',
      'src/components/UserLinkLoginModal.tsx',
      'src/services/storage.ts',
      'src/components/CreateUserLinkPage.tsx',
      'src/components/AdminSettings.tsx',
      'src/components/HeroCover.tsx',
      'src/App.tsx',
      'package.json',
    ],
  },
  {
    revision: 'Rev 11',
    version: '1.2.6',
    date: '2026-11-13',
    description:
      'แก้ไขภาพปุ่มสร้างคิวงานหายบน Vercel โดยย้ายไฟล์ไอคอนเข้า src/assets/icons/ และ import ผ่าน Vite module พร้อมตัวแปลง path เก่าและปรับ vercel.json ไม่ให้ rewrite ทับ /assets/*, แก้ไขหน้าจอ BootLoadingScreen ไม่ให้ล้นจอมือถือ (จำกัดความกว้าง ความสูง และจัดการ truncate/min-w-0), และปรับสัดส่วน Navbar แถบเมนูด้านบนบนมือถือไม่ให้ดันหน้าจอล้นด้านข้าง',
    modifiedFiles: [
      'src/version.ts',
      'src/data/initialData.ts',
      'src/components/HeroCover.tsx',
      'src/components/BootLoadingScreen.tsx',
      'src/components/AdminSettings.tsx',
      'src/components/Navbar.tsx',
      'src/App.tsx',
      'src/index.css',
      'vercel.json',
      'package.json',
    ],
  },
  {
    revision: 'Rev 10',
    version: '1.2.5',
    date: '2026-11-12',
    description:
      'เพิ่มปุ่มแอดมิน (Admin) ที่แถบเมนูด้านบนและในการ์ดหน้าแรกแดชบอร์ด พร้อมระบบกรอกรหัสผ่าน 099-225-6601 แบบซ่อนรหัสผ่านเป็นจุด (Password dots masking) โดยไม่แสดงตัวเลขบนช่องพิมพ์และไม่เขียนบอกรหัส เมื่อเข้าสู่ระบบแอดมินแล้วจะเปิดหน้า "สร้าง link user" ให้ทันที พร้อมแสดงแท็บเมนูสร้าง link user ให้แอดมินเข้าถึงได้อย่างชัดเจน',
    modifiedFiles: [
      'src/version.ts',
      'src/components/AdminPinModal.tsx',
      'src/components/Navbar.tsx',
      'src/components/HeroCover.tsx',
      'src/components/Dashboard.tsx',
      'src/services/storage.ts',
      'src/App.tsx',
      'package.json',
    ],
  },
  {
    revision: 'Rev 9',
    version: '1.2.4',
    date: '2026-11-12',
    description:
      'แก้ไขปัญหา Deploy ไม่ผ่านบน Vercel (npm error ERESOLVE esbuild conflict): ลบ esbuild ออกจาก devDependencies ใน package.json เพื่อแก้ peer conflict กับ vite, เพิ่มไฟล์ .npmrc (legacy-peer-deps=true) และ vercel.json สำหรับ Vercel build และ SPA routing',
    modifiedFiles: [
      'package.json',
      '.npmrc',
      'vercel.json',
      'server.ts',
      'src/version.ts',
    ],
  },
  {
    revision: 'Rev 8',
    version: '1.2.3',
    date: '2026-11-12',
    description:
      'ปรับขอบรูปปุ่มสร้างคิวงานให้ดูทันสมัยมีมิติ (ขอบ Bezel หลายชั้น, แสงเรืองรอง, เงาสะท้อน 3D และโครงสร้างกระจก), แก้ไขการดาวน์โหลด Source Code ให้มีโฟลเดอร์ src/ ครบถ้วน 100% ผ่าน /api/download-source-zip, เพิ่มปุ่มล้างข้อมูลเก่าเพื่อเริ่มต้นใช้งานใหม่พร้อมหน้าต่างยืนยันความปลอดภัย, เคลียร์ข้อมูลเก่าอัตโนมัติเมื่อ User Link เริ่มต้นใช้งานครั้งแรก, แก้ไขปัญหา Deploy โดยปรับการตรวจจับ dist ใน production server.ts',
    modifiedFiles: [
      'src/version.ts',
      'src/components/HeroCover.tsx',
      'src/components/Dashboard.tsx',
      'src/components/DownloadSourceCodeModal.tsx',
      'src/services/storage.ts',
      'src/App.tsx',
      'server.ts',
      'package.json',
    ],
  },
  {
    revision: 'Rev 7',
    version: '1.2.2',
    date: '2026-11-11',
    description:
      'หน้าตั้งค่าตัดส่วนจัดการช่าง/user, ดาวน์โหลด source code และการตั้งรหัสผ่าน admin ออก (เหลือเฉพาะข้อมูลร้าน, LINE Notify, และไอค่อนปุ่ม 6 รูป), ลบหน้าช่าง/user ออกจาก Navbar, สร้างหน้า "สร้าง link user" ให้ Admin กำหนด User/Password และวันหมดอายุ (พิมพ์วันเอง + เมนูด่วน 1 อาทิตย์, 1, 3, 6, 9, 12 เดือน) พร้อมบันทึกตาราง user และ Pop-up แจ้งเตือน link user หมดอายุ, นำรหัสผ่านเริ่มต้นโปรแกรมออก เข้าสู่ระบบผ่านบูตไอคอนพิมพ์ดีด 3-4 วิ "สร้างสรรค์โดยช่างหน่อยชุมแพ"',
    modifiedFiles: [
      'src/version.ts',
      'src/types.ts',
      'src/components/CreateUserLinkPage.tsx',
      'src/components/AdminSettings.tsx',
      'src/components/Navbar.tsx',
      'src/components/BootLoadingScreen.tsx',
      'src/App.tsx',
      'package.json',
    ],
  },
  {
    revision: 'Rev 6',
    version: '1.2.1',
    date: '2026-11-11',
    description:
      'ปรับแดชบอร์ดตามภาพถ่าย (เอาไอคอนเล็กบนสุดออก, รวมข้อความระบบคิวงานซ่อม onsite version 1.2.1, ขยับชื่อขึ้น, แสดงเฉพาะการ์ดตามรูป), หน้าตั้งค่าเปลี่ยนเป็นเลือกไอคอนปุ่มสร้างคิว 6 รูปไม่ล้นจอ, ปรับขนาด Modal สร้างคิวงานให้ตารางบนสุดมองเห็นพอดี, ซ่อนการตั้งค่าลิงก์ใน user, เพิ่มรหัสแอดมิน 099-225-6601 ซ่อนรหัส, เพิ่มระบบบูต 3-4 วินาทีพิมพ์ดีด "สร้างสรรค์โดยช่างหน่อยชุมแพ", เพิ่มเมนูลัดสร้างลิงก์ 7 วัน 1, 3, 6, 9 เดือน 1 ปี และ Pop-up แจ้งเตือนหมดอายุช่างหน่อยชุมแพ',
    modifiedFiles: [
      'src/version.ts',
      'src/components/BootLoadingScreen.tsx',
      'src/components/HeroCover.tsx',
      'src/components/Dashboard.tsx',
      'src/components/JobModal.tsx',
      'src/components/AdminPinModal.tsx',
      'src/components/Navbar.tsx',
      'src/components/AdminSettings.tsx',
      'src/App.tsx',
      'package.json',
    ],
  },
  {
    revision: 'Rev 5',
    version: '1.2.0',
    date: '2026-11-11',
    description:
      'ปรับปุ่มสร้างคิวงานใหม่เป็นรูปภาพกล่องเครื่องมือใหญ่ชัดเจนพร้อมข้อความใต้รูป "กดเพื่อสร้างคิวงานใหม่", ตัดส่วนรายได้รวมและกราฟรายได้ในหน้าแดชบอร์ดให้เรียบง่าย, อนุญาตให้สิทธิ์ User เข้าหน้าตั้งค่าพื้นฐานเปลี่ยนภาพหน้าปกพรีเซ็ต 6 สไตล์, แสดง Revision และ Version บนภาพหน้าปก',
    modifiedFiles: [
      'src/version.ts',
      'src/data/initialData.ts',
      'src/components/HeroCover.tsx',
      'src/components/Dashboard.tsx',
      'src/components/Navbar.tsx',
      'src/components/AdminSettings.tsx',
      'src/App.tsx',
      'package.json',
    ],
  },
  {
    revision: 'Rev 4',
    version: '1.1.2',
    date: '2026-11-11',
    description:
      'ปรับลดขนาดหน้าปกลง 20% "MyQueue งานนอกสถานที่", ปรับตารางคิวงานเป็น Excel Spreadsheet View, ล็อกปุ่ม Admin ด้วยรหัสผ่าน 099 2256601 แบบซ่อนรหัส',
    modifiedFiles: [
      'src/components/HeroCover.tsx',
      'src/components/QueueTable.tsx',
      'src/components/AdminPinModal.tsx',
      'src/components/Navbar.tsx',
    ],
  },
  {
    revision: 'Rev 3',
    version: '1.1.1',
    date: '2026-11-11',
    description:
      'เพิ่ม Pop-up เตือนงานหมดระยะประกันพร้อมเสียงพูดไทยและเสียงเตือนซ้ำๆ จนกว่าจะกดรับทราบ, ซ่อนหน้าปกในหน้าคิวงาน ปฏิทิน และตั้งค่า',
    modifiedFiles: [
      'src/components/ExpiredWarrantyModal.tsx',
      'src/services/soundAlarm.ts',
      'src/App.tsx',
    ],
  },
  {
    revision: 'Rev 2',
    version: '1.1.0',
    date: '2026-11-11',
    description:
      'เพิ่มระบบส่งแจ้งเตือนผ่าน LINE Notify เมื่อมีงานใหม่และเปลี่ยนสถานะ, จำกัดการดาวน์โหลด Source code เฉพาะลิงก์แอดมิน',
    modifiedFiles: [
      'src/services/lineNotify.ts',
      'src/components/AdminSettings.tsx',
      'src/components/DownloadSourceCodeModal.tsx',
      'src/types.ts',
    ],
  },
  {
    revision: 'Rev 1',
    version: '1.0.0',
    date: '2026-10-23',
    description: 'ระบบจัดคิวงานซ่อมนอกสถานที่ Onsite Service เบื้องต้น พร้อมระบบแบ่งสิทธิ์แอดมินและช่าง',
    modifiedFiles: ['src/App.tsx', 'src/components/QueueTable.tsx'],
  },
];
