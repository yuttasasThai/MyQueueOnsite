// File: /src/components/AdminSettings.tsx | Revision: Rev 11 | Version: 1.2.6 | Modified: 2026-11-13
import React, { useState } from 'react';
import {
  Image as ImageIcon,
  Store,
  Phone,
  MessageCircle,
  Facebook,
  MapPin,
  Save,
  Upload,
  CheckCircle,
  RefreshCw,
  BellRing,
  Eye,
  EyeOff,
  Send,
  Check,
  AlertCircle,
  Smartphone,
  Plus,
  Clock,
  Trash2,
} from 'lucide-react';
import { ShopSettings, NotificationLog } from '../types';
import { COVER_PRESETS, resolveCoverImage } from '../data/initialData';
import {
  sendLineNotify,
  formatTestNotification,
  loadNotificationLogs,
  addNotificationLog,
  clearNotificationLogs,
  getLineShareUrl,
} from '../services/lineNotify';

interface AdminSettingsProps {
  settings: ShopSettings;
  onSaveSettings: (newSettings: ShopSettings) => void;
  isAdmin?: boolean;
}

export const AdminSettings: React.FC<AdminSettingsProps> = ({
  settings,
  onSaveSettings,
  isAdmin = true,
}) => {
  const [subTab, setSubTab] = useState<'shop' | 'line_notify'>('shop');

  // Shop Settings Form State
  const [formData, setFormData] = useState<ShopSettings>({
    ...settings,
    lineNotify: settings.lineNotify || {
      enabled: true,
      token: '',
      notifyOnNewJob: true,
      notifyOnStatusChange: true,
      includeCustomerPhone: true,
      includeMapLink: true,
    },
  });
  const [isSaved, setIsSaved] = useState(false);

  // LINE Notify Testing State
  const [showLineToken, setShowLineToken] = useState(false);
  const [isTestingLine, setIsTestingLine] = useState(false);
  const [lineTestResult, setLineTestResult] = useState<{
    success: boolean;
    message: string;
    timestamp: string;
  } | null>(null);
  const [notificationLogs, setNotificationLogs] = useState<NotificationLog[]>(() =>
    loadNotificationLogs()
  );
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Handle Save Shop Settings
  const handleSaveShop = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formData);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  // Handle Test LINE Notify
  const handleTestLineNotify = async () => {
    const token = formData.lineNotify?.token?.trim();
    if (!token) {
      setLineTestResult({
        success: false,
        message: 'กรุณากรอก LINE Notify Token ก่อนกดทดสอบ',
        timestamp: new Date().toLocaleTimeString('th-TH'),
      });
      return;
    }

    setIsTestingLine(true);
    setLineTestResult(null);

    const testMessage = formatTestNotification(formData);
    const res = await sendLineNotify(token, testMessage);

    addNotificationLog({
      type: 'manual_test',
      success: res.success,
      message: 'ทดสอบการส่งข้อความแจ้งเตือนเข้าสู่ LINE Notify',
      responseMessage: res.message,
    });
    setNotificationLogs(loadNotificationLogs());

    setLineTestResult({
      success: res.success,
      message: res.message,
      timestamp: new Date().toLocaleTimeString('th-TH'),
    });
    setIsTestingLine(false);
  };

  // Clear notification logs
  const handleClearLogs = () => {
    if (confirm('คุณต้องการลบประวัติการแจ้งเตือนทั้งหมดหรือไม่?')) {
      clearNotificationLogs();
      setNotificationLogs([]);
    }
  };

  // Handle File Upload for Cover Image / Button Icon
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setFormData((prev) => ({ ...prev, coverImage: reader.result as string }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Sub Tabs: Shop Settings vs LINE Notify */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSubTab('shop')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
              subTab === 'shop'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Store className="w-4 h-4" />
            <span>ตั้งค่าร้านค้า & ไอค่อนปุ่ม</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('line_notify')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
              subTab === 'line_notify'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <BellRing className="w-4 h-4 text-emerald-400" />
            <span>ตั้งค่า LINE Notify</span>
            {formData.lineNotify?.enabled && Boolean(formData.lineNotify?.token) && (
              <span className="w-2 h-2 rounded-full bg-emerald-300"></span>
            )}
          </button>
        </div>

        {!isAdmin && (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>สิทธิ์ช่าง/ผู้ใช้ทั่วไป: สามารถเปลี่ยนไอค่อนปุ่มและดูข้อมูลร้านได้</span>
          </div>
        )}
      </div>

      {/* TAB 1: SHOP & BUTTON ICON SETTINGS */}
      {subTab === 'shop' && (
        <form onSubmit={handleSaveShop} className="space-y-6">
          {/* Card 1: ไอค่อนปุ่ม สร้างคิวงานใหม่ (6 สไตล์) */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    ไอค่อนปุ่ม สร้างคิวงานใหม่
                  </h3>
                  <p className="text-xs text-slate-500">
                    เลือกเปลี่ยนรูปภาพไอคอนสำหรับปุ่มสร้างคิวงานใหม่ในหน้าแดชบอร์ด (ปรับขนาดพอดีไม่ล้นจอ)
                  </p>
                </div>
              </div>
            </div>

            {/* Current Active Button Icon Preview (ขนาดพอดีตามหน้าแดชบอร์ด) */}
            <div className="p-4 rounded-2xl bg-gradient-to-b from-[#111c38] to-[#0a1024] text-white flex flex-col items-center justify-center text-center">
              <span className="text-[11px] text-blue-300 font-medium mb-2 block">
                ตัวอย่างปุ่มที่เลือกใช้งานปัจจุบัน:
              </span>
              <div className="w-28 h-28 sm:w-32 sm:h-32 p-2 flex items-center justify-center">
                <img
                  src={resolveCoverImage(formData.coverImage)}
                  alt="Active Button Icon"
                  className="w-full h-full object-contain filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)]"
                />
              </div>
              <div className="mt-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md">
                <Plus className="w-3.5 h-3.5" />
                <span>กดเพื่อสร้างคิวงานใหม่</span>
              </div>
            </div>

            {/* Change Button Icon Options: 6 Presets */}
            <div className="space-y-3 pt-1">
              <label className="text-xs font-semibold text-slate-700 block">
                เลือกเปลี่ยนรูปปุ่มได้ 6 สไตล์ตามที่กำหนด (ขนาดพอดี ไม่ล้นจอ):
              </label>

              {/* 6 Presets Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
                {COVER_PRESETS.slice(0, 6).map((preset, index) => {
                  const isSelected = resolveCoverImage(formData.coverImage) === preset.url;
                  return (
                    <div
                      key={preset.id}
                      onClick={() => setFormData({ ...formData, coverImage: preset.url })}
                      className={`cursor-pointer rounded-xl overflow-hidden border-2 transition-all p-2 flex flex-col items-center justify-between text-center ${
                        isSelected
                          ? 'border-emerald-500 ring-2 ring-emerald-200 bg-emerald-50/40 shadow-xs'
                          : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white'
                      }`}
                    >
                      <div className="w-16 h-16 sm:w-18 sm:h-18 p-1 flex items-center justify-center">
                        <img
                          src={preset.url}
                          alt={preset.name}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="mt-1 w-full">
                        <span
                          className={`text-[11px] font-bold block truncate ${
                            isSelected ? 'text-emerald-700' : 'text-slate-700'
                          }`}
                        >
                          สไตล์ {index + 1}
                        </span>
                        {isSelected && (
                          <span className="text-[10px] text-emerald-600 font-semibold block">
                            ✓ กำลังใช้
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div>
                <label className="text-xs text-slate-600 block mb-1">
                  หรืออัปโหลดรูปภาพใหม่จากโทรศัพท์ / คอมพิวเตอร์:
                </label>
                <label className="flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-slate-300 rounded-xl hover:bg-slate-50 cursor-pointer text-xs font-medium text-slate-600">
                  <Upload className="w-3.5 h-3.5" />
                  <span>เลือกไฟล์รูปภาพ (.jpg, .png)</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Cover Headlines */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  ข้อความหัวเรื่องหน้าปก
                </label>
                <input
                  type="text"
                  value={formData.coverTitle}
                  onChange={(e) => setFormData({ ...formData, coverTitle: e.target.value })}
                  placeholder="Repair Onsite Service"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  คำโปรยรองใต้หัวเรื่อง
                </label>
                <input
                  type="text"
                  value={formData.coverSubtitle}
                  onChange={(e) => setFormData({ ...formData, coverSubtitle: e.target.value })}
                  placeholder="ศูนย์บริการซ่อมด่วนถึงบ้าน..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Shop Contact Details (ข้อมูลร้านค้า & ช่องทางติดต่อ โดยไม่ต้องมีตั้งรหัสผ่าน admin) */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Store className="w-5 h-5 text-blue-600" />
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  ข้อมูลร้านค้า & ช่องทางติดต่อ
                </h3>
                <p className="text-xs text-slate-500">
                  ชื่อร้าน, เบอร์โทร, LINE, และ Facebook จะนำไปแสดงที่แถบข้อมูลและใบส่งงาน
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Shop Name */}
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  ชื่อร้าน (Shop Name) *
                </label>
                <div className="relative">
                  <Store className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={formData.shopName}
                    onChange={(e) => setFormData({ ...formData, shopName: e.target.value })}
                    placeholder="โปรซ่อมด่วน Onsite Service"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  เบอร์โทรศัพท์ร้าน *
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="089-765-4321"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>
              </div>

              {/* LINE ID */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  LINE ID (เช่น @proonsite)
                </label>
                <div className="relative">
                  <MessageCircle className="w-4 h-4 text-emerald-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={formData.lineId}
                    onChange={(e) => setFormData({ ...formData, lineId: e.target.value })}
                    placeholder="@proonsite"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Facebook Page */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Facebook Page (ชื่อเพจหรือลิงก์)
                </label>
                <div className="relative">
                  <Facebook className="w-4 h-4 text-blue-600 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={formData.facebook}
                    onChange={(e) => setFormData({ ...formData, facebook: e.target.value })}
                    placeholder="Pro Onsite Service ช่างซ่อมถึงบ้าน"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  ที่อยู่ร้าน / ศูนย์บริการ
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="88/19 ถนนสุขุมวิท..."
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex items-center justify-end gap-3">
            {isSaved && (
              <span className="text-xs font-medium text-emerald-600 flex items-center gap-1.5 animate-in fade-in">
                <CheckCircle className="w-4 h-4" />
                บันทึกการตั้งค่าเรียบร้อยแล้ว
              </span>
            )}
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>บันทึกการตั้งค่าทั้งหมด</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: LINE NOTIFY SETTINGS */}
      {subTab === 'line_notify' && (
        <div className="space-y-6">
          {/* Header Status Banner */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
            <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-44 h-44 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-xs text-xs font-semibold">
                  <BellRing className="w-3.5 h-3.5 text-emerald-200" />
                  <span>ระบบส่งแจ้งเตือนผ่านมือถือแบบเรียลไทม์</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold">
                  การแจ้งเตือนผ่าน LINE Notify สำหรับช่างและแอดมิน
                </h3>
                <p className="text-emerald-100 text-xs sm:text-sm max-w-2xl leading-relaxed">
                  ส่งแจ้งเตือนเข้าห้องแชทเดี่ยวหรือกลุ่ม LINE ของทีมงานอัตโนมัติทันที เมื่อมีการจองนัดหมายใหม่ หรือเมื่อช่างเปลี่ยนสถานะงาน (เช่น รับงาน, กำลังไป, ซ่อมแล้ว, ปิดงาน)
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="bg-white/15 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/20 text-center">
                  <div className="text-[11px] text-emerald-100 font-medium">สถานะการทำงาน</div>
                  <div className="text-sm font-bold flex items-center gap-1.5 justify-center mt-0.5">
                    {formData.lineNotify?.enabled && Boolean(formData.lineNotify?.token?.trim()) ? (
                      <>
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-300 animate-pulse"></span>
                        <span>พร้อมใช้งาน</span>
                      </>
                    ) : (
                      <>
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-300"></span>
                        <span>ยังไม่ได้ระบุ Token</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Form & Settings (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              <form onSubmit={handleSaveShop} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <BellRing className="w-4 h-4 text-emerald-600" />
                    <span>ตั้งค่าการเชื่อมต่อ LINE Notify</span>
                  </h4>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.lineNotify?.enabled ?? true}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          lineNotify: {
                            ...(prev.lineNotify || {
                              enabled: true,
                              token: '',
                              notifyOnNewJob: true,
                              notifyOnStatusChange: true,
                              includeCustomerPhone: true,
                              includeMapLink: true,
                            }),
                            enabled: e.target.checked,
                          },
                        }))
                      }
                      className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                    />
                    <span className="text-xs font-semibold text-slate-700">เปิดระบบแจ้งเตือน</span>
                  </label>
                </div>

                {/* Token Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                    <span>LINE Notify Access Token *</span>
                    <a
                      href="https://notify-bot.line.me/my/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-emerald-600 hover:text-emerald-700 font-normal hover:underline"
                    >
                      กดขอ Token ฟรีที่ notify-bot.line.me &rarr;
                    </a>
                  </label>

                  <div className="relative">
                    <input
                      type={showLineToken ? 'text' : 'password'}
                      value={formData.lineNotify?.token || ''}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          lineNotify: {
                            ...(prev.lineNotify || {
                              enabled: true,
                              notifyOnNewJob: true,
                              notifyOnStatusChange: true,
                              includeCustomerPhone: true,
                              includeMapLink: true,
                            }),
                            token: e.target.value.trim(),
                          },
                        }))
                      }
                      placeholder="วาง LINE Notify Token ของคุณที่นี่ (ความยาวประมาณ 43 ตัวอักษร)"
                      className="w-full pl-3 pr-20 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                    />

                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setShowLineToken(!showLineToken)}
                        title={showLineToken ? 'ซ่อน Token' : 'แสดง Token'}
                        className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                      >
                        {showLineToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const text = await navigator.clipboard.readText();
                            if (text) {
                              setFormData((prev) => ({
                                ...prev,
                                lineNotify: {
                                  ...(prev.lineNotify || {
                                    enabled: true,
                                    notifyOnNewJob: true,
                                    notifyOnStatusChange: true,
                                    includeCustomerPhone: true,
                                    includeMapLink: true,
                                  }),
                                  token: text.trim(),
                                },
                              }));
                            }
                          } catch {
                            // Fallback if permission not granted
                          }
                        }}
                        className="px-2 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                      >
                        วาง
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500">
                    🔒 Token จะถูกเก็บรักษาไว้ในระบบอย่างปลอดภัย และใช้สำหรับส่งการแจ้งเตือนเท่านั้น
                  </p>
                </div>

                {/* Notification Trigger Toggles */}
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    เงื่อนไขการส่งแจ้งเตือนอัตโนมัติ
                  </h5>

                  <div className="space-y-2.5">
                    {/* Toggle 1: New Appointment */}
                    <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.lineNotify?.notifyOnNewJob ?? true}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            lineNotify: {
                              ...(prev.lineNotify || {
                                enabled: true,
                                token: '',
                                notifyOnStatusChange: true,
                                includeCustomerPhone: true,
                                includeMapLink: true,
                              }),
                              notifyOnNewJob: e.target.checked,
                            },
                          }))
                        }
                        className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                      />
                      <div className="text-xs">
                        <span className="font-semibold text-slate-800 block">
                          แจ้งเตือนเมื่อมีการนัดหมายงานซ่อมใหม่ (New Job)
                        </span>
                        <span className="text-slate-500 block mt-0.5">
                          ส่งรายละเอียดคิวงาน สินค้า อาการ ลูกค้า วันเวลานัดหมาย และช่างที่ได้รับมอบหมาย
                        </span>
                      </div>
                    </label>

                    {/* Toggle 2: Status Change */}
                    <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.lineNotify?.notifyOnStatusChange ?? true}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            lineNotify: {
                              ...(prev.lineNotify || {
                                enabled: true,
                                token: '',
                                notifyOnNewJob: true,
                                includeCustomerPhone: true,
                                includeMapLink: true,
                              }),
                              notifyOnStatusChange: e.target.checked,
                            },
                          }))
                        }
                        className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                      />
                      <div className="text-xs">
                        <span className="font-semibold text-slate-800 block">
                          แจ้งเตือนเมื่อมีการอัปเดตสถานะงาน (Status Update)
                        </span>
                        <span className="text-slate-500 block mt-0.5">
                          เช่น เปลี่ยนเป็น &quot;กำลังไป&quot;, &quot;กำลังซ่อม&quot;, &quot;ซ่อมแล้ว&quot;, &quot;ปิดงาน&quot; หรือ &quot;นัดหมายต่อ&quot;
                        </span>
                      </div>
                    </label>

                    {/* Toggle 3: Include Customer Phone */}
                    <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.lineNotify?.includeCustomerPhone ?? true}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            lineNotify: {
                              ...(prev.lineNotify || {
                                enabled: true,
                                token: '',
                                notifyOnNewJob: true,
                                notifyOnStatusChange: true,
                                includeMapLink: true,
                              }),
                              includeCustomerPhone: e.target.checked,
                            },
                          }))
                        }
                        className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                      />
                      <div className="text-xs">
                        <span className="font-semibold text-slate-800 block">
                          แนบเบอร์โทรลูกค้าในข้อความแจ้งเตือน
                        </span>
                        <span className="text-slate-500 block mt-0.5">
                          เพื่อให้ช่างสามารถกดโทรออกหาลูกค้าจากแชท LINE ได้ทันที
                        </span>
                      </div>
                    </label>

                    {/* Toggle 4: Include Maps Link */}
                    <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.lineNotify?.includeMapLink ?? true}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            lineNotify: {
                              ...(prev.lineNotify || {
                                enabled: true,
                                token: '',
                                notifyOnNewJob: true,
                                notifyOnStatusChange: true,
                                includeCustomerPhone: true,
                              }),
                              includeMapLink: e.target.checked,
                            },
                          }))
                        }
                        className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                      />
                      <div className="text-xs">
                        <span className="font-semibold text-slate-800 block">
                          แนบลิงก์ Google Maps นำทาง
                        </span>
                        <span className="text-slate-500 block mt-0.5">
                          สร้างลิงก์พิกัดหรือที่อยู่ เพื่อให้ช่างกดเปิด GPS นำทางได้จาก LINE
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleTestLineNotify}
                    disabled={isTestingLine || !formData.lineNotify?.token?.trim()}
                    className="px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 font-semibold rounded-xl text-xs flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isTestingLine ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                    ) : (
                      <Send className="w-4 h-4 text-emerald-600" />
                    )}
                    <span>{isTestingLine ? 'กำลังส่งทดสอบ...' : 'ทดสอบส่งข้อความแจ้งเตือน LINE'}</span>
                  </button>

                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>บันทึกการตั้งค่า LINE</span>
                  </button>
                </div>

                {lineTestResult && (
                  <div
                    className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                      lineTestResult.success
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}
                  >
                    {lineTestResult.success ? (
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{lineTestResult.message}</span>
                  </div>
                )}
              </form>
            </div>

            {/* Right Column: Preview & Logs (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              {/* Smartphone Preview Card */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-emerald-600" />
                    <h4 className="font-bold text-slate-900 text-sm">
                      ตัวอย่างข้อความแจ้งเตือนใน LINE
                    </h4>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                    Live Preview
                  </span>
                </div>

                {/* Simulated LINE Chat Screen */}
                <div className="bg-[#7292a7] rounded-xl p-3 sm:p-4 text-slate-900 shadow-inner font-sans">
                  {/* Chat header */}
                  <div className="flex items-center gap-2 pb-2 mb-3 border-b border-black/10">
                    <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                      L
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white leading-tight">LINE Notify</div>
                      <div className="text-[10px] text-white/80">บริการแจ้งเตือนอัตโนมัติ</div>
                    </div>
                  </div>

                  {/* Chat message bubble */}
                  <div className="bg-white rounded-2xl rounded-tl-xs p-3 shadow-md space-y-2 text-xs text-slate-800 border border-slate-100 max-w-[95%]">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-700 border-b border-slate-100 pb-1.5">
                      <BellRing className="w-3.5 h-3.5" />
                      <span>[มีนัดหมายงานซ่อมใหม่] 🛠️</span>
                    </div>

                    <div className="space-y-1 font-mono text-[11px] text-slate-700 leading-relaxed">
                      <div><strong className="text-slate-900">คิวงาน:</strong> Q-01</div>
                      <div><strong className="text-slate-900">สินค้า:</strong> แอร์ Daikin Inverter 18000 BTU</div>
                      <div><strong className="text-slate-900">อาการ:</strong> แอร์ไม่เย็น มีเสียงดัง</div>
                      <div><strong className="text-slate-900">นัดหมาย:</strong> วันนี้ 09:00 - 11:30</div>
                      <div><strong className="text-slate-900">ลูกค้า:</strong> คุณธีรพงษ์ วัฒนาเจริญกิจ</div>
                      {formData.lineNotify?.includeCustomerPhone && (
                        <div><strong className="text-slate-900">โทร:</strong> 081-445-6789</div>
                      )}
                      {formData.lineNotify?.includeMapLink && (
                        <div className="text-blue-600 truncate underline">
                          📍 maps.google.com/?q=13.7314,100.5828
                        </div>
                      )}
                      <div><strong className="text-slate-900">ช่าง:</strong> ช่างสมศักดิ์ ชำนาญแอร์</div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-500 flex items-center justify-between">
                      <span className="truncate">{formData.shopName || 'Repair Onsite Service'}</span>
                      <span>เพิ่งส่ง</span>
                    </div>
                  </div>

                  <div className="text-right mt-1">
                    <span className="text-[10px] text-white/75">อ่านแล้ว</span>
                  </div>
                </div>

                {/* Quick Share / Test options */}
                <div className="pt-2 flex items-center justify-between gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      const sample = formatTestNotification(formData);
                      navigator.clipboard.writeText(sample);
                      setCopyFeedback('sample-line');
                      setTimeout(() => setCopyFeedback(null), 2000);
                    }}
                    className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-center transition-colors font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {copyFeedback === 'sample-line' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>คัดลอกแล้ว</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>คัดลอกตัวอย่างข้อความ</span>
                      </>
                    )}
                  </button>

                  <a
                    href={getLineShareUrl(formatTestNotification(formData))}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-1.5 px-3 bg-[#06C755] hover:bg-[#05b34c] text-white rounded-lg text-center transition-colors font-semibold flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>เปิดแอป LINE</span>
                  </a>
                </div>
              </div>

              {/* Notification History Logs */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-600" />
                    <h4 className="font-bold text-slate-900 text-sm">
                      ประวัติการแจ้งเตือน ({notificationLogs.length})
                    </h4>
                  </div>
                  {notificationLogs.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearLogs}
                      className="text-[11px] text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>ล้างประวัติ</span>
                    </button>
                  )}
                </div>

                {notificationLogs.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-xs">
                    <BellRing className="w-8 h-8 mx-auto mb-1.5 opacity-30" />
                    <p>ยังไม่มีประวัติการส่งแจ้งเตือน</p>
                    <p className="text-[11px] mt-0.5 text-slate-400">
                      เมื่อมีการสร้างนัดหมาย หรือเปลี่ยนสถานะงาน ประวัติจะแสดงที่นี่
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {notificationLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-2.5 rounded-xl border border-slate-100 bg-slate-50 text-xs space-y-1 hover:bg-slate-100/80 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              log.success
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {log.success ? (
                              <CheckCircle className="w-3 h-3" />
                            ) : (
                              <AlertCircle className="w-3 h-3" />
                            )}
                            {log.success ? 'ส่งสำเร็จ' : 'ส่งไม่สำเร็จ'}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {new Date(log.timestamp).toLocaleTimeString('th-TH', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>

                        <div className="font-semibold text-slate-800 text-[11px] truncate">
                          {log.message}
                        </div>

                        {log.responseMessage && (
                          <div className="text-[10px] text-slate-500 truncate font-mono">
                            {log.responseMessage}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
