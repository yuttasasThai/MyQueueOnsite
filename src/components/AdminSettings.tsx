// File: /src/components/AdminSettings.tsx | Revision: Rev 19 | Version: 1.5.0 | Modified: 2026-11-15
import React, { useState, useEffect } from 'react';
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
  Tag,
  Wrench,
  UserPlus,
  X,
  Copy,
  Link2,
  AlarmClock,
  Cloud,
  CloudOff,
  LogOut,
  ShieldCheck,
  MessageSquare,
  Link as LinkIcon,
  FileCode,
  Download,
  Lock,
} from 'lucide-react';
import {
  ShopSettings,
  NotificationLog,
  RepairJob,
  LineNotifySettings,
  SmsNotifySettings,
  SmsProvider,
} from '../types';
import { COVER_PRESETS, resolveCoverImage } from '../data/initialData';
import { PWAInstallButton } from './PWAInstallButton';
import {
  sendLineNotification,
  getActiveLineChannelToken,
  getLineSendMode,
  fetchLineMessagingStatus,
  CapturedLineTarget,
  formatTestNotification,
  loadNotificationLogs,
  addNotificationLog,
  clearNotificationLogs,
  getLineShareUrl,
} from '../services/lineNotify';
import {
  resolveSmsSettings,
  isSmsGatewayConfigured,
  formatTestSms,
  sendSmsNotification,
} from '../services/smsNotify';
import type { CloudSessionContext } from '../services/cloudSync';

interface AdminSettingsProps {
  settings: ShopSettings;
  onSaveSettings: (newSettings: ShopSettings) => void;
  isAdmin?: boolean;
  jobs?: RepairJob[];
  cloudCtx?: CloudSessionContext | null;
  cloudUserEmail?: string | null;
  cloudSyncStatus?: 'disconnected' | 'syncing' | 'synced' | 'error';
  lastCloudSyncAt?: string | null;
  onGoogleSignIn?: () => Promise<void> | void;
  onForceCloudBackup?: () => Promise<void> | void;
  onCloudSignOut?: () => Promise<void> | void;
  onNavigateToCreateLink?: () => void;
  onNavigateToSourceCode?: () => void;
  onExitAdmin?: () => void;
}

export const AdminSettings: React.FC<AdminSettingsProps> = ({
  settings,
  onSaveSettings,
  isAdmin = true,
  jobs = [],
  cloudCtx = null,
  cloudUserEmail = null,
  cloudSyncStatus = 'disconnected',
  lastCloudSyncAt = null,
  onGoogleSignIn,
  onForceCloudBackup,
  onCloudSignOut,
  onNavigateToCreateLink,
  onNavigateToSourceCode,
  onExitAdmin,
}) => {
  const [subTab, setSubTab] = useState<'shop' | 'line_notify' | 'sms_notify'>('shop');

  const defaultLineCfg = (prev?: Partial<LineNotifySettings>): LineNotifySettings => ({
    enabled: true,
    provider: 'messaging_api',
    token: '',
    channelAccessToken: '',
    targetId: '',
    sendMode: 'broadcast',
    notifyOnNewJob: true,
    notifyOnStatusChange: true,
    notifyBefore30Min: true,
    repeatIntervalMinutes: 2,
    includeCustomerPhone: true,
    includeMapLink: true,
    ...prev,
  });

  const defaultSmsCfg = (prev?: Partial<SmsNotifySettings>): SmsNotifySettings =>
    resolveSmsSettings(prev);

  // Shop Settings Form State (สำหรับ User ไม่แสดงค่าเดิมของร้าน/หน้าปกที่ค้างไว้)
  const sanitizeForRole = (s: ShopSettings): ShopSettings => {
    const base = {
      ...s,
      lineNotify: defaultLineCfg(s.lineNotify),
      smsNotify: defaultSmsCfg(s.smsNotify),
      repairCategories: Array.isArray(s.repairCategories) ? s.repairCategories : [],
      technicians: Array.isArray(s.technicians) ? s.technicians : [],
    };
    if (!isAdmin) {
      return {
        ...base,
        coverTitle: base.coverTitle === 'Repair Onsite Service' ? '' : base.coverTitle || '',
        coverSubtitle: base.coverSubtitle === 'ช่างหน่อยชุมแพ' ? '' : base.coverSubtitle || '',
      };
    }
    return base;
  };

  const [formData, setFormData] = useState<ShopSettings>(() => sanitizeForRole(settings));
  const [isSaved, setIsSaved] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [newTechnicianInput, setNewTechnicianInput] = useState('');

  useEffect(() => {
    setFormData(sanitizeForRole(settings));
  }, [settings, isAdmin]);

  const handleAddCategory = () => {
    const val = newCategoryInput.trim();
    if (!val) return;
    const current = formData.repairCategories || [];
    if (current.includes(val)) {
      setNewCategoryInput('');
      return;
    }
    const updated: ShopSettings = { ...formData, repairCategories: [...current, val] };
    setFormData(updated);
    onSaveSettings(updated);
    setNewCategoryInput('');
  };

  const handleDeleteCategory = (cat: string) => {
    const current = formData.repairCategories || [];
    const updated: ShopSettings = {
      ...formData,
      repairCategories: current.filter((c) => c !== cat),
    };
    setFormData(updated);
    onSaveSettings(updated);
  };

  const handleAddTechnician = () => {
    const val = newTechnicianInput.trim();
    if (!val) return;
    const current = formData.technicians || [];
    if (current.includes(val)) {
      setNewTechnicianInput('');
      return;
    }
    const updated: ShopSettings = { ...formData, technicians: [...current, val] };
    setFormData(updated);
    onSaveSettings(updated);
    setNewTechnicianInput('');
  };

  const handleDeleteTechnician = (tech: string) => {
    const current = formData.technicians || [];
    const updated: ShopSettings = {
      ...formData,
      technicians: current.filter((t) => t !== tech),
    };
    setFormData(updated);
    onSaveSettings(updated);
  };

  // LINE Messaging API Testing & Target Capture State
  const [showLineToken, setShowLineToken] = useState(false);
  const [isTestingLine, setIsTestingLine] = useState(false);
  const [capturedTargets, setCapturedTargets] = useState<CapturedLineTarget[]>([]);
  const [isRefreshingTargets, setIsRefreshingTargets] = useState(false);
  const [lineTestResult, setLineTestResult] = useState<{
    success: boolean;
    message: string;
    timestamp: string;
  } | null>(null);
  const [notificationLogs, setNotificationLogs] = useState<NotificationLog[]>(() =>
    loadNotificationLogs()
  );
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // SMS Customer Notification Testing State
  const [testSmsPhone, setTestSmsPhone] = useState<string>(() => settings.phone || '');
  const [testSmsCustomMsg, setTestSmsCustomMsg] = useState<string>('');
  const [isTestingSms, setIsTestingSms] = useState(false);
  const [showSmsSecret, setShowSmsSecret] = useState(false);
  const [smsTestResult, setSmsTestResult] = useState<{
    success: boolean;
    message: string;
    timestamp: string;
  } | null>(null);

  const loadCapturedTargets = async () => {
    setIsRefreshingTargets(true);
    const status = await fetchLineMessagingStatus();
    if (status?.capturedTargets) {
      setCapturedTargets(status.capturedTargets);
    }
    setIsRefreshingTargets(false);
  };

  useEffect(() => {
    if (subTab === 'line_notify') {
      loadCapturedTargets();
    }
  }, [subTab]);

  // Handle Save Shop Settings
  const handleSaveShop = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formData);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  // Handle Test LINE Messaging API
  const handleTestLineNotify = async () => {
    const cfg = formData.lineNotify;
    const token = getActiveLineChannelToken(cfg);
    if (!token) {
      setLineTestResult({
        success: false,
        message: 'กรุณากรอก Channel Access Token (LINE Messaging API) ก่อนกดทดสอบ',
        timestamp: new Date().toLocaleTimeString('th-TH'),
      });
      return;
    }

    setIsTestingLine(true);
    setLineTestResult(null);

    const testMessage = formatTestNotification(formData);
    const res = await sendLineNotification(cfg, testMessage);

    addNotificationLog({
      type: 'manual_test',
      success: res.success,
      message: 'ทดสอบการส่งข้อความแจ้งเตือนเข้าสู่ LINE Messaging API',
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

  // Handle Test SMS Dispatch
  const handleTestSmsNotify = async () => {
    const smsCfg = defaultSmsCfg(formData.smsNotify);
    const targetPhone = testSmsPhone.trim();
    if (!targetPhone || targetPhone.replace(/[^0-9]/g, '').length < 8) {
      setSmsTestResult({
        success: false,
        message: 'กรุณากรอกเบอร์โทรศัพท์ปลายทางที่ถูกต้องสำหรับทดสอบส่ง SMS',
        timestamp: new Date().toLocaleTimeString('th-TH'),
      });
      return;
    }

    if (smsCfg.provider !== 'device_sms' && !isSmsGatewayConfigured({ ...smsCfg, enabled: true })) {
      setSmsTestResult({
        success: false,
        message: 'กรุณากรอกข้อมูล API / Webhook ของผู้ให้บริการ SMS ให้ครบก่อนกดทดสอบ',
        timestamp: new Date().toLocaleTimeString('th-TH'),
      });
      return;
    }

    setIsTestingSms(true);
    setSmsTestResult(null);

    const sampleMsg = testSmsCustomMsg.trim() || formatTestSms(formData);
    const res = await sendSmsNotification({
      cfg: { ...smsCfg, enabled: true },
      toPhone: targetPhone,
      message: sampleMsg,
      settings: formData,
      eventType: 'manual_test',
    });

    setNotificationLogs(loadNotificationLogs());
    setSmsTestResult({
      success: res.success,
      message: res.message,
      timestamp: new Date().toLocaleTimeString('th-TH'),
    });
    setIsTestingSms(false);
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

  const activeLineToken = getActiveLineChannelToken(formData.lineNotify);
  const webhookUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/api/line-webhook` : '/api/line-webhook';

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Sub Tabs: Shop Settings vs LINE Messaging API */}
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
            <span>{isAdmin ? 'ตั้งค่าร้านค้า & ไอค่อนปุ่ม' : 'ตั้งค่าหน้าปก & ไอค่อนปุ่ม'}</span>
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
            <BellRing className={`w-4 h-4 ${subTab === 'line_notify' ? 'text-emerald-100' : 'text-emerald-500'}`} />
            <span>ตั้งค่า LINE Messaging API</span>
            {formData.lineNotify?.enabled && Boolean(activeLineToken) && (
              <span className="w-2 h-2 rounded-full bg-emerald-300"></span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setSubTab('sms_notify')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
              subTab === 'sms_notify'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <MessageSquare className={`w-4 h-4 ${subTab === 'sms_notify' ? 'text-sky-100' : 'text-sky-600'}`} />
            <span>ตั้งค่า SMS แจ้งเตือนลูกค้า</span>
            {formData.smsNotify?.enabled && (
              <span className="w-2 h-2 rounded-full bg-sky-300"></span>
            )}
          </button>
        </div>

        {!isAdmin && (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-medium">
            <span>ตั้งค่าพื้นฐาน: เปลี่ยนไอค่อนปุ่มและข้อความหน้าปก</span>
          </div>
        )}
      </div>

      {/* Admin Tools Hub (เฉพาะเมื่อเข้าสู่ระบบแอดมินผ่านรหัส + บูทหน้าจอแล้วเท่านั้น) */}
      {isAdmin && (
        <div className="bg-slate-900 text-white rounded-2xl border border-slate-700 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white">ศูนย์จัดการแอดมิน (Admin Console)</h3>
              <p className="text-xs text-slate-300">
                สร้าง Link User, ดาวน์โหลด Source Code และจัดการฐานข้อมูลคลาวด์
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {onNavigateToCreateLink && (
              <button
                type="button"
                onClick={onNavigateToCreateLink}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LinkIcon className="w-3.5 h-3.5" />
                <span>สร้าง Link User</span>
              </button>
            )}
            {onNavigateToSourceCode && (
              <button
                type="button"
                onClick={onNavigateToSourceCode}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>ดาวน์โหลด Source Code</span>
                <Download className="w-3.5 h-3.5" />
              </button>
            )}
            {onExitAdmin && (
              <button
                type="button"
                onClick={onExitAdmin}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                title="ล็อกหน้าแอดมิน (ครั้งต่อไปต้องใส่รหัสและบูทใหม่)"
              >
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>ล็อกแอดมิน</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* TAB 1: SHOP & BUTTON ICON SETTINGS */}
      {subTab === 'shop' && (
        <form onSubmit={handleSaveShop} className="space-y-6">
          {/* Card 0: ฐานข้อมูลคลาวด์ & ซิงค์ข้ามเครื่อง (Firebase Cloud Sync) */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    cloudUserEmail
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {cloudUserEmail ? (
                    <Cloud className="w-5 h-5" />
                  ) : (
                    <CloudOff className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base flex items-center gap-2 flex-wrap">
                    <span>ฐานข้อมูลคลาวด์ & ซิงค์ข้ามเครื่อง</span>
                    {cloudUserEmail ? (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        ซิงค์อัตโนมัติ
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                        เก็บเฉพาะในเครื่องนี้
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500">
                    ผูกข้อมูลคิวงาน การตั้งค่าร้าน รูปถ่าย และข้อมูลแอดมิน/User ID ไว้บนคลาวด์ เปลี่ยนโทรศัพท์เครื่องใหม่ข้อมูลไม่หาย
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {cloudUserEmail ? (
                  <>
                    {onForceCloudBackup && (
                      <button
                        type="button"
                        disabled={cloudSyncStatus === 'syncing'}
                        onClick={() => onForceCloudBackup()}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${
                            cloudSyncStatus === 'syncing' ? 'animate-spin' : ''
                          }`}
                        />
                        <span>สำรองข้อมูลขึ้นคลาวด์ทันที</span>
                      </button>
                    )}
                    {onCloudSignOut && (
                      <button
                        type="button"
                        onClick={() => onCloudSignOut()}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>ออกจากคลาวด์</span>
                      </button>
                    )}
                  </>
                ) : (
                  onGoogleSignIn && (
                    <button
                      type="button"
                      disabled={cloudSyncStatus === 'syncing'}
                      onClick={() => onGoogleSignIn()}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-colors cursor-pointer disabled:opacity-60"
                    >
                      <Cloud className="w-4 h-4" />
                      <span>
                        {cloudSyncStatus === 'syncing'
                          ? 'กำลังเชื่อมต่อ...'
                          : 'เข้าสู่ระบบ Google (สำรองข้อมูลข้ามเครื่อง)'}
                      </span>
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="text-[11px] text-slate-500">บัญชีคลาวด์ (Google)</div>
                <div className="font-bold text-slate-900 truncate mt-0.5">
                  {cloudUserEmail || 'ยังไม่เชื่อมต่อ'}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="text-[11px] text-slate-500">รหัสฐานข้อมูล / User ID</div>
                <div className="font-bold text-slate-900 truncate mt-0.5 flex items-center gap-1">
                  {cloudCtx?.isAdmin && (
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  )}
                  <span className="truncate font-mono">
                    {cloudCtx
                      ? cloudCtx.linkedUsername ||
                        cloudCtx.linkedUserId ||
                        cloudCtx.workspaceId
                      : 'LocalStorage'}
                  </span>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="text-[11px] text-slate-500">รายการคิวงาน & ซิงค์ล่าสุด</div>
                <div className="font-bold text-slate-900 mt-0.5">
                  {jobs.length} คิวงาน
                  {lastCloudSyncAt ? ` · ${lastCloudSyncAt}` : ''}
                </div>
              </div>
            </div>
          </div>

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
                  placeholder={isAdmin ? 'Repair Onsite Service' : 'กรอกข้อความหัวเรื่องหน้าปก'}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  สโลวแกนร้าน
                </label>
                <input
                  type="text"
                  value={formData.coverSubtitle}
                  onChange={(e) => setFormData({ ...formData, coverSubtitle: e.target.value })}
                  placeholder={isAdmin ? 'สโลวแกนร้าน เช่น ศูนย์บริการซ่อมด่วนถึงบ้าน...' : 'กรอกสโลวแกนร้าน'}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Card 1.5: หมวดงานซ่อม & ช่างผู้รับผิดชอบ (ผู้ใช้งานเพิ่ม/ลบเอง เริ่มต้นไม่มีค่าค้าง) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* หมวดงานซ่อม */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Tag className="w-5 h-5 text-blue-600 shrink-0" />
                <div>
                  <h3 className="font-bold text-slate-900 text-base">หมวดงานซ่อม</h3>
                  <p className="text-xs text-slate-500">
                    เพิ่มหมวดงานซ่อมที่ใช้งานจริงในร้านด้วยตนเอง (ไม่มีหมวดเก่าค้างไว้)
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCategoryInput}
                  onChange={(e) => setNewCategoryInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCategory();
                    }
                  }}
                  placeholder="เช่น แอร์, ตู้เย็น, เครื่องซักผ้า..."
                  className="flex-1 min-w-0 px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={handleAddCategory}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>เพิ่ม</span>
                </button>
              </div>

              {(formData.repairCategories || []).length === 0 ? (
                <div className="py-5 px-3 text-center rounded-xl bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-500">
                  <Wrench className="w-6 h-6 mx-auto mb-1 text-slate-300" />
                  ยังไม่มีหมวดงานซ่อม กรุณาพิมพ์เพิ่มด้านบน
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(formData.repairCategories || []).map((cat) => (
                    <span
                      key={cat}
                      className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs font-semibold"
                    >
                      <span>{cat}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(cat)}
                        className="p-0.5 rounded-md text-blue-500 hover:text-red-600 hover:bg-red-100 transition-colors cursor-pointer"
                        title={`ลบหมวด "${cat}"`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* ช่างผู้รับผิดชอบ */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <UserPlus className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <h3 className="font-bold text-slate-900 text-base">ช่างผู้รับผิดชอบ</h3>
                  <p className="text-xs text-slate-500">
                    เพิ่มรายชื่อช่างผู้รับผิดชอบงานด้วยตนเอง สำหรับเลือกตอนรับคิวงาน
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTechnicianInput}
                  onChange={(e) => setNewTechnicianInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTechnician();
                    }
                  }}
                  placeholder="พิมพ์ชื่อช่างผู้รับผิดชอบ..."
                  className="flex-1 min-w-0 px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleAddTechnician}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>เพิ่ม</span>
                </button>
              </div>

              {(formData.technicians || []).length === 0 ? (
                <div className="py-5 px-3 text-center rounded-xl bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-500">
                  <UserPlus className="w-6 h-6 mx-auto mb-1 text-slate-300" />
                  ยังไม่มีรายชื่อช่างผู้รับผิดชอบ กรุณาพิมพ์เพิ่มด้านบน
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(formData.technicians || []).map((tech) => (
                    <span
                      key={tech}
                      className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold"
                    >
                      <span>{tech}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteTechnician(tech)}
                        className="p-0.5 rounded-md text-emerald-600 hover:text-red-600 hover:bg-red-100 transition-colors cursor-pointer"
                        title={`ลบ "${tech}"`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Shop Contact Details — เฉพาะแอดมินเท่านั้น (ลบออกจากหน้าลิงก์ User) */}
          {isAdmin && (
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
          )}

          {/* Card 3: แจ้งเตือนก่อนเวลานัด 30 นาที & ติดตั้งแอปลงมือถือ (PWA) */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <BellRing className="w-5 h-5 text-blue-600 shrink-0" />
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  แจ้งเตือนคิวงานล่วงหน้า 30 นาที (แม้ปิด Google Chrome)
                </h3>
                <p className="text-xs text-slate-500">
                  เปิดสิทธิ์แจ้งเตือนพื้นหลังและติดตั้งแอป PWA ลงมือถือเพื่อให้แจ้งเตือนทำงานอัตโนมัติ
                </p>
              </div>
            </div>
            <PWAInstallButton jobs={jobs} variant="settings" />
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

      {/* TAB 2: LINE MESSAGING API SETTINGS */}
      {subTab === 'line_notify' && (
        <div className="space-y-6">
          {/* Header Status Banner */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
            <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-44 h-44 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-xs text-xs font-semibold">
                  <BellRing className="w-3.5 h-3.5 text-emerald-200" />
                  <span>ทดแทน LINE Notify ที่ยกเลิกแล้ว — รองรับปุ่มกดยืนยันจาก LINE</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold">
                  แจ้งเตือนผ่าน LINE Messaging API (LINE Official Account)
                </h3>
                <p className="text-emerald-100 text-xs sm:text-sm max-w-2xl leading-relaxed">
                  ส่งเสียงแจ้งเตือนเข้า LINE ทันทีเมื่อใกล้ถึงเวลานัดหมาย <strong>30 นาที</strong> และเตือนซ้ำต่อเนื่องจนกว่าคุณจะกดปุ่ม <strong>&quot;ยืนยันรับทราบ&quot;</strong> ทางแชท LINE หรือในโปรแกรม
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="bg-white/15 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/20 text-center">
                  <div className="text-[11px] text-emerald-100 font-medium">สถานะการทำงาน</div>
                  <div className="text-sm font-bold flex items-center gap-1.5 justify-center mt-0.5">
                    {formData.lineNotify?.enabled && Boolean(activeLineToken) ? (
                      <>
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-300 animate-pulse"></span>
                        <span>พร้อมใช้งาน</span>
                      </>
                    ) : (
                      <>
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-300"></span>
                        <span>ยังไม่ระบุ Token</span>
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
              <form onSubmit={handleSaveShop} className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <BellRing className="w-4 h-4 text-emerald-600" />
                    <span>ตั้งค่าการเชื่อมต่อ LINE Messaging API</span>
                  </h4>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.lineNotify?.enabled ?? true}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          lineNotify: defaultLineCfg({
                            ...prev.lineNotify,
                            enabled: e.target.checked,
                          }),
                        }))
                      }
                      className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                    />
                    <span className="text-xs font-semibold text-slate-700">เปิดระบบแจ้งเตือน</span>
                  </label>
                </div>

                {/* Channel Access Token */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 flex items-center justify-between gap-2 flex-wrap">
                    <span>Channel Access Token (Messaging API) *</span>
                    <a
                      href="https://developers.line.biz/console/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-emerald-600 hover:text-emerald-700 font-medium hover:underline"
                    >
                      สร้าง Channel ฟรีที่ LINE Developers Console &rarr;
                    </a>
                  </label>

                  <div className="relative">
                    <input
                      type={showLineToken ? 'text' : 'password'}
                      value={activeLineToken}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        setFormData((prev) => ({
                          ...prev,
                          lineNotify: defaultLineCfg({
                            ...prev.lineNotify,
                            provider: 'messaging_api',
                            channelAccessToken: val,
                            token: val,
                          }),
                        }));
                      }}
                      placeholder="วาง Channel Access Token (long-lived) จาก LINE Developers ที่นี่"
                      className="w-full pl-3 pr-20 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                    />

                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setShowLineToken(!showLineToken)}
                        title={showLineToken ? 'ซ่อน Token' : 'แสดง Token'}
                        className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        {showLineToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const text = await navigator.clipboard.readText();
                            if (text) {
                              const val = text.trim();
                              setFormData((prev) => ({
                                ...prev,
                                lineNotify: defaultLineCfg({
                                  ...prev.lineNotify,
                                  provider: 'messaging_api',
                                  channelAccessToken: val,
                                  token: val,
                                }),
                              }));
                            }
                          } catch {}
                        }}
                        className="px-2 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
                      >
                        วาง
                      </button>
                    </div>
                  </div>
                </div>

                {/* Send Mode & Target User/Group ID */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-800">ผู้รับข้อความแจ้งเตือน (Target)</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            lineNotify: defaultLineCfg({ ...prev.lineNotify, sendMode: 'broadcast' }),
                          }))
                        }
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                          getLineSendMode(formData.lineNotify) === 'broadcast'
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Broadcast (ส่งทุกคนใน OA)
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            lineNotify: defaultLineCfg({ ...prev.lineNotify, sendMode: 'push' }),
                          }))
                        }
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                          getLineSendMode(formData.lineNotify) === 'push'
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Push (ระบุ User / Group ID)
                      </button>
                    </div>
                  </div>

                  {getLineSendMode(formData.lineNotify) === 'push' ? (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={formData.lineNotify?.targetId || ''}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              lineNotify: defaultLineCfg({
                                ...prev.lineNotify,
                                sendMode: 'push',
                                targetId: e.target.value.trim(),
                              }),
                            }))
                          }
                          placeholder="วาง User ID (U...) หรือ Group ID (C...) ของช่าง/ร้าน"
                          className="flex-1 min-w-0 px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <button
                          type="button"
                          onClick={loadCapturedTargets}
                          disabled={isRefreshingTargets}
                          className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0 cursor-pointer"
                          title="ดึง ID ล่าสุดที่ทักเข้ามาใน LINE OA ผ่าน Webhook"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingTargets ? 'animate-spin' : ''}`} />
                          <span>ดึง ID จากแชท</span>
                        </button>
                      </div>

                      {capturedTargets.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[11px] text-slate-600 font-medium block">
                            พบ ID ล่าสุดที่ทัก LINE OA (คลิกเพื่อเลือกใช้):
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {capturedTargets.map((t) => (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    lineNotify: defaultLineCfg({
                                      ...prev.lineNotify,
                                      sendMode: 'push',
                                      targetId: t.id,
                                    }),
                                  }))
                                }
                                className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 text-[10px] font-mono cursor-pointer"
                              >
                                [{t.type}] {t.id.slice(0, 12)}...
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      โหมด <strong>Broadcast</strong> จะส่งแจ้งเตือนเข้าแชท LINE OA ของทุกคนที่เพิ่มเพื่อนไว้ทันทีโดยไม่ต้องกรอก User ID (ประหยัดโควต้าส่งและใช้งานง่ายที่สุด)
                    </p>
                  )}
                </div>

                {/* Webhook URL Box (Required for tapping "ยืนยันรับทราบ" inside LINE chat) */}
                <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                      <Link2 className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>Webhook URL (สำหรับกดปุ่ม &quot;ยืนยันรับทราบ&quot; ใน LINE เพื่อปิดเสียงเตือน)</span>
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={webhookUrl}
                      className="flex-1 min-w-0 px-3 py-1.5 text-xs bg-white border border-blue-200 rounded-lg font-mono text-slate-700"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(webhookUrl);
                        setCopyFeedback('webhook');
                        setTimeout(() => setCopyFeedback(null), 2000);
                      }}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      {copyFeedback === 'webhook' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copyFeedback === 'webhook' ? 'คัดลอกแล้ว' : 'คัดลอก'}</span>
                    </button>
                  </div>

                  <p className="text-[11px] text-blue-900/80 leading-relaxed">
                    นำลิงก์นี้ไปวางใน LINE Developers Console &rarr; Messaging API &rarr; <strong>Webhook URL</strong> แล้วเปิด <strong>Use webhook</strong> จากนั้นเวลาเตือนใน LINE สามารถกดปุ่ม <strong>&quot;✅ ยืนยันรับทราบ&quot;</strong> หรือพิมพ์ <strong>&quot;ยืนยัน&quot;</strong> เพื่อหยุดเสียงเตือนในโปรแกรมได้ทันที
                  </p>
                </div>

                {/* Notification Trigger Toggles */}
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    เงื่อนไขการส่งแจ้งเตือนอัตโนมัติ
                  </h5>

                  <div className="space-y-2.5">
                    {/* Toggle 0: 30-Minute Repeating Reminder */}
                    <div className="p-3.5 rounded-xl border-2 border-rose-200 bg-rose-50/50 space-y-2.5">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.lineNotify?.notifyBefore30Min ?? true}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              lineNotify: defaultLineCfg({
                                ...prev.lineNotify,
                                notifyBefore30Min: e.target.checked,
                              }),
                            }))
                          }
                          className="mt-0.5 w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500"
                        />
                        <div className="text-xs">
                          <span className="font-bold text-rose-900 flex items-center gap-1.5">
                            <AlarmClock className="w-4 h-4 text-rose-600 shrink-0" />
                            <span>แจ้งเตือนก่อนเวลานัด 30 นาที (เตือนซ้ำจนกว่าจะกดยืนยันทาง LINE หรือในโปรแกรม)</span>
                          </span>
                          <span className="text-rose-800/80 block mt-0.5">
                            ส่งเสียง + Flex Message พร้อมปุ่มกด &quot;ยืนยันรับทราบ&quot; เข้า LINE และส่งเสียงเตือนในแอปต่อเนื่อง
                          </span>
                        </div>
                      </label>

                      {(formData.lineNotify?.notifyBefore30Min ?? true) && (
                        <div className="pl-7 flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-semibold text-slate-700">ส่งเตือนซ้ำทาง LINE ทุกๆ:</span>
                          <select
                            value={formData.lineNotify?.repeatIntervalMinutes || 2}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                lineNotify: defaultLineCfg({
                                  ...prev.lineNotify,
                                  repeatIntervalMinutes: Number(e.target.value),
                                }),
                              }))
                            }
                            className="px-2.5 py-1 border border-rose-200 rounded-lg bg-white text-xs font-bold text-rose-900"
                          >
                            <option value={1}>1 นาที (ถี่มาก)</option>
                            <option value={2}>2 นาที (แนะนำ)</option>
                            <option value={3}>3 นาที</option>
                            <option value={5}>5 นาที</option>
                          </select>
                          <span className="text-[11px] text-slate-500">จนกว่าจะกดยืนยัน</span>
                        </div>
                      )}
                    </div>

                    {/* Toggle 1: New Appointment */}
                    <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.lineNotify?.notifyOnNewJob ?? true}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            lineNotify: defaultLineCfg({
                              ...prev.lineNotify,
                              notifyOnNewJob: e.target.checked,
                            }),
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
                            lineNotify: defaultLineCfg({
                              ...prev.lineNotify,
                              notifyOnStatusChange: e.target.checked,
                            }),
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
                            lineNotify: defaultLineCfg({
                              ...prev.lineNotify,
                              includeCustomerPhone: e.target.checked,
                            }),
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
                            lineNotify: defaultLineCfg({
                              ...prev.lineNotify,
                              includeMapLink: e.target.checked,
                            }),
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
                    disabled={isTestingLine || !activeLineToken}
                    className="px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 font-semibold rounded-xl text-xs flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isTestingLine ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                    ) : (
                      <Send className="w-4 h-4 text-emerald-600" />
                    )}
                    <span>{isTestingLine ? 'กำลังส่งทดสอบ...' : 'ทดสอบส่ง LINE Messaging API'}</span>
                  </button>

                  <div className="flex items-center gap-2">
                    {isSaved && (
                      <span className="text-xs font-medium text-emerald-600 flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" />
                        บันทึกแล้ว
                      </span>
                    )}
                    <button
                      type="submit"
                      className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      <span>บันทึกการตั้งค่า LINE</span>
                    </button>
                  </div>
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
                      ตัวอย่างแจ้งเตือนก่อนนัด 30 นาทีใน LINE
                    </h4>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-semibold">
                    Flex Message
                  </span>
                </div>

                {/* Simulated LINE Chat Screen */}
                <div className="bg-[#7292a7] rounded-xl p-3 sm:p-4 text-slate-900 shadow-inner font-sans">
                  <div className="flex items-center gap-2 pb-2 mb-3 border-b border-black/10">
                    <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                      OA
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white leading-tight">
                        {formData.shopName || 'MyQueue LINE OA'}
                      </div>
                      <div className="text-[10px] text-white/80">LINE Messaging API</div>
                    </div>
                  </div>

                  {/* Simulated Flex Bubble */}
                  <div className="bg-white rounded-2xl overflow-hidden shadow-md border border-slate-100 max-w-[95%]">
                    <div className="bg-red-600 text-white px-3.5 py-2.5">
                      <div className="text-[10px] font-bold text-amber-200">🚨 แจ้งเตือนก่อนนัด 30 นาที</div>
                      <div className="text-sm font-extrabold">อีก 30 นาที ถึงเวลานัด!</div>
                    </div>
                    <div className="p-3 space-y-1.5 text-xs">
                      <div className="font-bold text-slate-900">คิว Q-01 • แอร์ Daikin Inverter</div>
                      <div className="text-red-600 font-bold text-[11px]">⏰ เวลานัด: วันนี้ (10:00 - 12:00)</div>
                      <div className="text-slate-600 text-[11px]">👤 ลูกค้า: คุณสมชาย (081-234-5678)</div>
                      <div className="text-[10px] text-amber-700 pt-1">
                        ระบบจะเตือนซ้ำจนกว่าจะกดปุ่มยืนยัน หรือพิมพ์ &quot;ยืนยัน&quot; / &quot;รับทราบ&quot;
                      </div>
                    </div>
                    <div className="px-3 pb-3 space-y-1.5">
                      <div className="w-full py-2 bg-emerald-600 text-white rounded-lg text-center font-bold text-[11px]">
                        ✅ ยืนยันรับทราบ (ปิดเสียงเตือน)
                      </div>
                      <div className="w-full py-1.5 bg-slate-100 text-slate-700 rounded-lg text-center font-semibold text-[11px]">
                        📱 เปิดแอป &amp; ปิดเสียงเตือน
                      </div>
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
                      เมื่อมีการเตือนก่อนนัด 30 นาที หรือเปลี่ยนสถานะงาน ประวัติจะแสดงที่นี่
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {notificationLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-2.5 rounded-xl border border-slate-100 bg-slate-50 text-xs space-y-1 hover:bg-slate-100/80 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                                log.channel === 'sms'
                                  ? 'bg-sky-100 text-sky-800 border border-sky-200'
                                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              }`}
                            >
                              {log.channel === 'sms' ? 'SMS' : 'LINE'}
                            </span>
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
                          </div>
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

      {/* TAB 3: SMS CUSTOMER NOTIFICATION SETTINGS */}
      {subTab === 'sms_notify' && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-sky-600 to-blue-700 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
            <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-44 h-44 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-xs text-xs font-semibold">
                  <MessageSquare className="w-3.5 h-3.5 text-sky-200" />
                  <span>แจ้งเตือนลูกค้ากรณีไม่ได้แอด LINE ร้าน — ส่งเข้าเบอร์โทรโดยตรง</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold">
                  ส่ง SMS แจ้งเตือนคิวงานให้ลูกค้า (เสริมจาก LINE)
                </h3>
                <p className="text-sky-100 text-xs sm:text-sm max-w-2xl leading-relaxed">
                  รองรับทั้งการ<strong>ส่งผ่านแอป SMS ในมือถือฟรีทันที (1 คลิก)</strong> และเชื่อมต่อ{' '}
                  <strong>SMS Gateway อัตโนมัติ (ThaiBulkSMS / Twilio / Webhook)</strong> เพื่อแจ้งคิวรับงาน สถานะกำลังเดินทาง และปิดงานให้ลูกค้าที่ไม่มี LINE
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="bg-white/15 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/20 text-center">
                  <div className="text-[11px] text-sky-100 font-medium">สถานะ SMS</div>
                  <div className="text-sm font-bold flex items-center gap-1.5 justify-center mt-0.5">
                    {!formData.smsNotify?.enabled ? (
                      <>
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-300"></span>
                        <span>ปิดใช้งาน</span>
                      </>
                    ) : formData.smsNotify?.provider === 'device_sms' ? (
                      <>
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-300 animate-pulse"></span>
                        <span>แอป SMS มือถือ (ฟรี)</span>
                      </>
                    ) : isSmsGatewayConfigured(formData.smsNotify) ? (
                      <>
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-300 animate-pulse"></span>
                        <span>Gateway พร้อมส่งอัตโนมัติ</span>
                      </>
                    ) : (
                      <>
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-300"></span>
                        <span>รอตั้งค่า API</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: SMS Configuration Form */}
            <div className="lg:col-span-7 space-y-6">
              <form
                onSubmit={handleSaveShop}
                className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-sky-600" />
                    <span>ตั้งค่าช่องทางส่ง SMS แจ้งเตือนลูกค้า</span>
                  </h4>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.smsNotify?.enabled ?? true}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          smsNotify: defaultSmsCfg({
                            ...prev.smsNotify,
                            enabled: e.target.checked,
                          }),
                        }))
                      }
                      className="w-4 h-4 text-sky-600 rounded border-slate-300 focus:ring-sky-500"
                    />
                    <span className="text-xs font-semibold text-slate-700">เปิดใช้งานส่ง SMS</span>
                  </label>
                </div>

                {/* Provider Mode Selection */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-800 block">
                    เลือกรูปแบบการส่ง SMS
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {(
                      [
                        {
                          id: 'device_sms',
                          title: 'แอป SMS ในมือถือ (ฟรี)',
                          desc: 'กดส่ง 1 คลิก เปิดแอปข้อความในมือถือพร้อมข้อความลูกค้าทันที ไม่ต้องสมัคร API',
                        },
                        {
                          id: 'thaibulksms',
                          title: 'ThaiBulkSMS (อัตโนมัติ)',
                          desc: 'ส่ง SMS เข้ามือถือลูกค้าในไทยอัตโนมัติทันทีด้วย API Key & Secret',
                        },
                        {
                          id: 'twilio',
                          title: 'Twilio SMS (อัตโนมัติ)',
                          desc: 'ส่งอัตโนมัติผ่านบัญชี Twilio (Account SID + Auth Token)',
                        },
                        {
                          id: 'webhook',
                          title: 'Custom Webhook SMS',
                          desc: 'ยิงข้อมูล JSON ไปยัง Webhook / n8n / Make ของร้านเอง',
                        },
                      ] as Array<{ id: SmsProvider; title: string; desc: string }>
                    ).map((opt) => {
                      const active = (formData.smsNotify?.provider || 'device_sms') === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              smsNotify: defaultSmsCfg({
                                ...prev.smsNotify,
                                provider: opt.id,
                              }),
                            }))
                          }
                          className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                            active
                              ? 'border-sky-500 bg-sky-50/70 shadow-2xs'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`text-xs font-bold ${
                                active ? 'text-sky-900' : 'text-slate-800'
                              }`}
                            >
                              {opt.title}
                            </span>
                            {active && (
                              <span className="w-2 h-2 rounded-full bg-sky-600 shrink-0"></span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                            {opt.desc}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Gateway Credentials (Only when provider !== device_sms) */}
                {formData.smsNotify?.provider && formData.smsNotify.provider !== 'device_sms' && (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="text-xs font-bold text-slate-800">
                      ข้อมูลเชื่อมต่อผู้ให้บริการ (
                      {formData.smsNotify.provider === 'thaibulksms'
                        ? 'ThaiBulkSMS'
                        : formData.smsNotify.provider === 'twilio'
                        ? 'Twilio'
                        : 'Webhook URL'}
                      )
                    </div>

                    {formData.smsNotify.provider === 'webhook' ? (
                      <div className="space-y-2">
                        <div>
                          <label className="text-xs font-semibold text-slate-700 block mb-1">
                            Webhook URL (รับ POST JSON: toPhone, message, senderName) *
                          </label>
                          <input
                            type="url"
                            value={formData.smsNotify.webhookUrl || ''}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                smsNotify: defaultSmsCfg({
                                  ...prev.smsNotify,
                                  webhookUrl: e.target.value.trim(),
                                }),
                              }))
                            }
                            placeholder="https://hook.example.com/sms-send"
                            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-700 block mb-1">
                            ชื่อผู้ส่ง (Sender Name - ถ้ามี)
                          </label>
                          <input
                            type="text"
                            value={formData.smsNotify.senderName || ''}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                smsNotify: defaultSmsCfg({
                                  ...prev.smsNotify,
                                  senderName: e.target.value,
                                }),
                              }))
                            }
                            placeholder="เช่น MyQueueShop"
                            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs font-semibold text-slate-700 block mb-1">
                            {formData.smsNotify.provider === 'twilio'
                              ? 'Twilio From Phone Number (เช่น +12025550199) *'
                              : 'Sender Name (ชื่อผู้ส่งที่อนุมัติแล้วใน ThaiBulkSMS)'}
                          </label>
                          <input
                            type="text"
                            value={formData.smsNotify.senderName || ''}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                smsNotify: defaultSmsCfg({
                                  ...prev.smsNotify,
                                  senderName: e.target.value,
                                }),
                              }))
                            }
                            placeholder={
                              formData.smsNotify.provider === 'twilio'
                                ? '+12025550199'
                                : 'เช่น ProService (เว้นว่างใช้ค่ามาตรฐานได้)'
                            }
                            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-semibold text-slate-700 block mb-1">
                              {formData.smsNotify.provider === 'twilio'
                                ? 'Account SID *'
                                : 'API Key *'}
                            </label>
                            <input
                              type="text"
                              value={formData.smsNotify.apiKey || ''}
                              onChange={(e) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  smsNotify: defaultSmsCfg({
                                    ...prev.smsNotify,
                                    apiKey: e.target.value.trim(),
                                  }),
                                }))
                              }
                              placeholder={
                                formData.smsNotify.provider === 'twilio' ? 'ACxxxxxxxx...' : 'API Key'
                              }
                              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
                            />
                          </div>

                          <div>
                            <label className="text-xs font-semibold text-slate-700 block mb-1">
                              {formData.smsNotify.provider === 'twilio'
                                ? 'Auth Token *'
                                : 'API Secret *'}
                            </label>
                            <div className="relative">
                              <input
                                type={showSmsSecret ? 'text' : 'password'}
                                value={formData.smsNotify.apiSecret || ''}
                                onChange={(e) =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    smsNotify: defaultSmsCfg({
                                      ...prev.smsNotify,
                                      apiSecret: e.target.value.trim(),
                                    }),
                                  }))
                                }
                                placeholder="Secret / Token"
                                className="w-full pl-3 pr-9 py-2 text-xs border border-slate-200 rounded-lg bg-white font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
                              />
                              <button
                                type="button"
                                onClick={() => setShowSmsSecret(!showSmsSecret)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                              >
                                {showSmsSecret ? (
                                  <EyeOff className="w-3.5 h-3.5" />
                                ) : (
                                  <Eye className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Customer LINE Fallback & Event Conditions */}
                <div className="space-y-2.5 pt-2 border-t border-slate-100">
                  <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    เงื่อนไขการส่ง SMS แจ้งเตือนลูกค้า
                  </h5>

                  <label className="flex items-start gap-3 p-3.5 rounded-xl border-2 border-sky-200 bg-sky-50/60 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.smsNotify?.onlyWhenNoCustomerLine ?? true}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          smsNotify: defaultSmsCfg({
                            ...prev.smsNotify,
                            onlyWhenNoCustomerLine: e.target.checked,
                          }),
                        }))
                      }
                      className="mt-0.5 w-4 h-4 text-sky-600 rounded border-slate-300 focus:ring-sky-500"
                    />
                    <div className="text-xs">
                      <span className="font-bold text-sky-950 block">
                        ส่ง SMS เฉพาะกรณีลูกค้าไม่ได้กรอก LINE ID / ไม่ได้แอด LINE ร้าน (แนะนำ)
                      </span>
                      <span className="text-sky-800/80 block mt-0.5">
                        หากลูกค้ามี LINE ID อยู่แล้ว ระบบจะข้ามการส่ง SMS อัตโนมัติ (ยังกดส่งเองจากหน้ารายละเอียดงานได้ตลอดเวลา)
                      </span>
                    </div>
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.smsNotify?.autoSendOnCreate ?? true}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            smsNotify: defaultSmsCfg({
                              ...prev.smsNotify,
                              autoSendOnCreate: e.target.checked,
                            }),
                          }))
                        }
                        className="mt-0.5 w-4 h-4 text-sky-600 rounded border-slate-300"
                      />
                      <div className="text-xs">
                        <span className="font-semibold text-slate-800 block">
                          {formData.smsNotify?.provider === 'device_sms'
                            ? 'แสดงปุ่มลัดส่ง SMS เมื่อรับคิวใหม่'
                            : 'ส่ง SMS อัตโนมัติเมื่อรับคิวใหม่'}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          แจ้งเลขคิว วันและเวลานัดให้ลูกค้า
                        </span>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.smsNotify?.autoSendOnStatusChange ?? true}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            smsNotify: defaultSmsCfg({
                              ...prev.smsNotify,
                              autoSendOnStatusChange: e.target.checked,
                            }),
                          }))
                        }
                        className="mt-0.5 w-4 h-4 text-sky-600 rounded border-slate-300"
                      />
                      <div className="text-xs">
                        <span className="font-semibold text-slate-800 block">
                          {formData.smsNotify?.provider === 'device_sms'
                            ? 'แสดงปุ่มลัดส่ง SMS เมื่อเปลี่ยนสถานะ'
                            : 'ส่ง SMS อัตโนมัติเมื่อเปลี่ยนสถานะ'}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          แจ้งกำลังเดินทาง / ปิดงาน / เลื่อนนัด
                        </span>
                      </div>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={formData.smsNotify?.notifyOnNewJob ?? true}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            smsNotify: defaultSmsCfg({
                              ...prev.smsNotify,
                              notifyOnNewJob: e.target.checked,
                            }),
                          }))
                        }
                        className="w-4 h-4 text-sky-600 rounded border-slate-300"
                      />
                      <span>แจ้งเมื่อรับคิวใหม่</span>
                    </label>

                    <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={formData.smsNotify?.notifyOnStatusChange ?? true}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            smsNotify: defaultSmsCfg({
                              ...prev.smsNotify,
                              notifyOnStatusChange: e.target.checked,
                            }),
                          }))
                        }
                        className="w-4 h-4 text-sky-600 rounded border-slate-300"
                      />
                      <span>แจ้งเมื่อเปลี่ยนสถานะ</span>
                    </label>

                    <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={formData.smsNotify?.notifyOnReschedule ?? true}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            smsNotify: defaultSmsCfg({
                              ...prev.smsNotify,
                              notifyOnReschedule: e.target.checked,
                            }),
                          }))
                        }
                        className="w-4 h-4 text-sky-600 rounded border-slate-300"
                      />
                      <span>แจ้งเมื่อเลื่อนนัดหมาย</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={formData.smsNotify?.includeShopPhone ?? true}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            smsNotify: defaultSmsCfg({
                              ...prev.smsNotify,
                              includeShopPhone: e.target.checked,
                            }),
                          }))
                        }
                        className="w-4 h-4 text-sky-600 rounded border-slate-300"
                      />
                      <span>แนบเบอร์โทรร้านท้ายข้อความ SMS</span>
                    </label>

                    <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={formData.smsNotify?.includeMapLink ?? false}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            smsNotify: defaultSmsCfg({
                              ...prev.smsNotify,
                              includeMapLink: e.target.checked,
                            }),
                          }))
                        }
                        className="w-4 h-4 text-sky-600 rounded border-slate-300"
                      />
                      <span>แนบลิงก์แผนที่ Google Maps ใน SMS</span>
                    </label>
                  </div>
                </div>

                {/* Test Phone & Save Buttons */}
                <div className="pt-4 border-t border-slate-100 space-y-3">
                  <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                    <input
                      type="tel"
                      value={testSmsPhone}
                      onChange={(e) => setTestSmsPhone(e.target.value)}
                      placeholder="เบอร์มือถือสำหรับทดสอบส่ง SMS เช่น 0812345678"
                      className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                    <button
                      type="button"
                      onClick={handleTestSmsNotify}
                      disabled={isTestingSms}
                      className="px-4 py-2 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-300 font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer shrink-0"
                    >
                      {isTestingSms ? (
                        <RefreshCw className="w-4 h-4 animate-spin text-sky-600" />
                      ) : (
                        <Send className="w-4 h-4 text-sky-600" />
                      )}
                      <span>
                        {isTestingSms
                          ? 'กำลังส่งทดสอบ...'
                          : formData.smsNotify?.provider === 'device_sms'
                          ? 'ทดสอบเปิดแอป SMS'
                          : 'ทดสอบส่ง SMS ทันที'}
                      </span>
                    </button>
                  </div>

                  {smsTestResult && (
                    <div
                      className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                        smsTestResult.success
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border border-rose-200'
                      }`}
                    >
                      {smsTestResult.success ? (
                        <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      )}
                      <span>{smsTestResult.message}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-1">
                    {isSaved && (
                      <span className="text-xs font-medium text-emerald-600 flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" />
                        บันทึกแล้ว
                      </span>
                    )}
                    <button
                      type="submit"
                      className="px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl text-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      <span>บันทึกการตั้งค่า SMS</span>
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* Right Column: Live SMS Preview & Shared Logs */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-sky-600" />
                    <h4 className="font-bold text-slate-900 text-sm">
                      ตัวอย่างข้อความ SMS ที่ลูกค้าจะได้รับ
                    </h4>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 font-semibold font-mono">
                    {(testSmsCustomMsg.trim() || formatTestSms(formData)).length} ตัวอักษร
                  </span>
                </div>

                {/* Simulated Smartphone SMS Bubble */}
                <div className="bg-slate-900 rounded-2xl p-4 text-white space-y-3 shadow-inner">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-[11px] text-slate-400">
                    <span>ข้อความ SMS ขาเข้า</span>
                    <span className="font-mono">
                      {formData.smsNotify?.senderName || formData.shopName || 'ServiceSMS'}
                    </span>
                  </div>

                  <div className="bg-sky-500 text-white rounded-2xl rounded-tl-sm p-3 text-xs leading-relaxed whitespace-pre-line shadow-sm">
                    {testSmsCustomMsg.trim() || formatTestSms(formData)}
                  </div>

                  <div className="text-[10px] text-slate-400 text-right">
                    ส่งถึงเบอร์มือถือลูกค้าโดยตรง แม้ลูกค้าไม่ได้แอด LINE
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    ข้อความทดสอบเอง (เว้นว่างเพื่อใช้ข้อความตัวอย่างด้านบน):
                  </label>
                  <textarea
                    rows={2}
                    value={testSmsCustomMsg}
                    onChange={(e) => setTestSmsCustomMsg(e.target.value)}
                    placeholder="พิมพ์ข้อความทดสอบเพิ่มเติมได้..."
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const sample = testSmsCustomMsg.trim() || formatTestSms(formData);
                    navigator.clipboard.writeText(sample);
                    setCopyFeedback('sample-sms');
                    setTimeout(() => setCopyFeedback(null), 2000);
                  }}
                  className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  {copyFeedback === 'sample-sms' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>คัดลอกข้อความตัวอย่างแล้ว</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>คัดลอกข้อความตัวอย่าง SMS</span>
                    </>
                  )}
                </button>
              </div>

              {/* Notification History Logs */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-600" />
                    <h4 className="font-bold text-slate-900 text-sm">
                      ประวัติการส่งแจ้งเตือน LINE &amp; SMS ({notificationLogs.length})
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
                    <MessageSquare className="w-8 h-8 mx-auto mb-1.5 opacity-30" />
                    <p>ยังไม่มีประวัติการส่งแจ้งเตือน</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {notificationLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-2.5 rounded-xl border border-slate-100 bg-slate-50 text-xs space-y-1 hover:bg-slate-100/80 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                                log.channel === 'sms'
                                  ? 'bg-sky-100 text-sky-800 border border-sky-200'
                                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              }`}
                            >
                              {log.channel === 'sms' ? 'SMS' : 'LINE'}
                            </span>
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
                          </div>
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
