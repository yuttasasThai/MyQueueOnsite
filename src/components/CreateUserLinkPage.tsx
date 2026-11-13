// File: /src/components/CreateUserLinkPage.tsx | Revision: Rev 12 | Version: 1.2.7 | Modified: 2026-11-13
import React, { useState, useMemo } from 'react';
import {
  Link as LinkIcon,
  Plus,
  Copy,
  Check,
  Calendar,
  Clock,
  Trash2,
  ExternalLink,
  ShieldAlert,
  AlertTriangle,
  RotateCcw,
  UserCheck,
  KeyRound,
  Eye,
  EyeOff,
  Phone,
  Search,
  Sparkles,
  CheckCircle2,
  X,
  Share2,
  MessageCircle,
} from 'lucide-react';
import { UserAccount, RenewalCode } from '../types';
import {
  buildUserLink,
  checkUserLinkExpiry,
  generateRenewalCode,
  applyUserRenewal,
} from '../services/storage';

interface CreateUserLinkPageProps {
  users: UserAccount[];
  onSaveUsers: (newUsers: UserAccount[]) => void;
  onSwitchToUser: (user: UserAccount) => void;
}

export const CreateUserLinkPage: React.FC<CreateUserLinkPageProps> = ({
  users,
  onSaveUsers,
  onSwitchToUser,
}) => {
  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('user1234');
  const [tokenSlug, setTokenSlug] = useState('');
  const [expiryDays, setExpiryDays] = useState<number>(30); // Default 1 month
  const [notes, setNotes] = useState('');

  // UI State
  const [searchQuery, setSearchQuery] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [renewNotice, setRenewNotice] = useState<string | null>(null);
  const [selectedUserForRenew, setSelectedUserForRenew] = useState<UserAccount | null>(null);
  const [quickRenewDays, setQuickRenewDays] = useState<number>(30);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [showExpiredPopup, setShowExpiredPopup] = useState<boolean>(true);

  // Fast preset expiration options (เมนูด่วน: 1 อาทิตย์ 1 เดือน 3 เดือน 6 เดือน 9 เดือน 12 เดือน)
  const PRESET_EXPIRY_OPTIONS = [
    { label: '1 อาทิตย์', days: 7, desc: '7 วัน' },
    { label: '1 เดือน', days: 30, desc: '30 วัน' },
    { label: '3 เดือน', days: 90, desc: '90 วัน' },
    { label: '6 เดือน', days: 180, desc: '180 วัน' },
    { label: '9 เดือน', days: 270, desc: '270 วัน' },
    { label: '12 เดือน', days: 365, desc: '1 ปี (365 วัน)' },
  ];

  // Calculated expiration date for form
  const calculatedExpiryDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + (Number(expiryDays) || 0));
    return d.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, [expiryDays]);

  // Find expired users
  const expiredUsers = useMemo(() => {
    return users.filter((u) => {
      const exp = checkUserLinkExpiry(u.expiresAt);
      return exp.isExpired;
    });
  }, [users]);

  // Filtered users for table
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.toLowerCase();
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.phone.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        (u.notes && u.notes.toLowerCase().includes(q))
    );
  }, [users, searchQuery]);

  // Auto-generate slug when name changes if slug wasn't manually typed
  const handleNameChange = (val: string) => {
    setName(val);
    if (!tokenSlug) {
      const rand = Math.floor(100 + Math.random() * 900);
      const clean = val.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      const prefix = clean ? clean.slice(0, 8) : 'tech';
      setTokenSlug(`${prefix}_${rand}`);
    }
    if (!username) {
      const rand = Math.floor(10 + Math.random() * 90);
      const clean = val.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      setUsername(`${clean || 'tech'}${rand}`);
    }
  };

  // Create User Link
  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const days = Math.max(1, Number(expiryDays) || 30);
    const expireDate = new Date();
    expireDate.setDate(expireDate.getDate() + days);

    const safeSlug = (
      tokenSlug.trim() ||
      `tech_${name.trim().toLowerCase().replace(/[^a-z0-9]/g, '')}_${Math.floor(
        100 + Math.random() * 900
      )}`
    ).replace(/[^a-zA-Z0-9_-]/g, '_');

    const newRenewalCode = generateRenewalCode(safeSlug, 30);

    const initialRenewalCodes: RenewalCode[] = [
      { code: newRenewalCode, daysToAdd: 30, isUsed: false },
      { code: generateRenewalCode(safeSlug, 90), daysToAdd: 90, isUsed: false },
    ];

    const newUser: UserAccount = {
      id: `usr_${Date.now()}`,
      name: name.trim(),
      phone: phone.trim() || '-',
      username: username.trim() || `user_${Date.now().toString().slice(-4)}`,
      password: password.trim() || 'user1234',
      role: 'user',
      linkToken: safeSlug,
      userLink: '',
      expiresAt: expireDate.toISOString(),
      renewalCode: newRenewalCode,
      renewalCodesList: initialRenewalCodes,
      createdAt: new Date().toISOString(),
      notes: notes.trim(),
    };
    newUser.userLink = buildUserLink(newUser);

    onSaveUsers([newUser, ...users]);

    // Reset Form
    setName('');
    setPhone('');
    setUsername('');
    setPassword('user1234');
    setTokenSlug('');
    setExpiryDays(30);
    setNotes('');

    setRenewNotice(`สร้าง Link User สำหรับ "${newUser.name}" เรียบร้อยแล้ว!`);
    setTimeout(() => setRenewNotice(null), 4000);
  };

  // Copy to clipboard helper
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopyFeedback(label);
    setTimeout(() => setCopyFeedback(null), 2500);
  };

  // Delete User
  const handleDeleteUser = (userId: string, userName: string) => {
    if (confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบ Link User ของ "${userName}"?`)) {
      const updated = users.filter((u) => u.id !== userId);
      onSaveUsers(updated);
      setRenewNotice(`ลบ Link User "${userName}" เรียบร้อยแล้ว`);
      setTimeout(() => setRenewNotice(null), 3000);
    }
  };

  // Quick Renew
  const handleQuickRenew = (user: UserAccount, days: number) => {
    const res = applyUserRenewal(user, days, users);
    if (res.success && res.updatedUser) {
      const updatedList = users.map((u) => (u.id === user.id ? res.updatedUser! : u));
      onSaveUsers(updatedList);
      setSelectedUserForRenew(null);
      setRenewNotice(`ต่ออายุการใช้งาน "${user.name}" เพิ่มอีก ${days} วัน เรียบร้อยแล้ว!`);
      setTimeout(() => setRenewNotice(null), 4000);
    }
  };

  // Toggle visible password in table
  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-blue-900 via-slate-900 to-indigo-950 text-white p-6 sm:p-7 rounded-3xl shadow-lg border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-semibold">
              <LinkIcon className="w-3.5 h-3.5 text-blue-400" />
              <span>ระบบจัดการสร้าง Link User สำหรับแอดมิน</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              สร้าง Link User & กำหนดวันหมดอายุ
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              แอดมินสามารถสร้างลิงก์เข้าใช้งานและรหัสผ่านสำหรับช่างหรือผู้ใช้งาน พร้อมกำหนดอายุการใช้งานแบบระบุวันหรือเลือกเมนูด่วนได้ตามต้องการ
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-slate-800/80 px-4 py-2.5 rounded-2xl border border-slate-700 text-center">
              <span className="text-[11px] text-slate-400 block font-medium">Link User ทั้งหมด</span>
              <span className="text-lg font-black text-white font-mono">{users.length} บัญชี</span>
            </div>
            {expiredUsers.length > 0 && (
              <div className="bg-red-950/80 px-4 py-2.5 rounded-2xl border border-red-700/60 text-center animate-pulse">
                <span className="text-[11px] text-red-300 block font-medium">หมดอายุแล้ว</span>
                <span className="text-lg font-black text-red-400 font-mono">{expiredUsers.length} บัญชี</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pop-up Alert: แจ้งเตือนเมื่อมี Link User หมดอายุ (ถ้ามี) */}
      {expiredUsers.length > 0 && showExpiredPopup && (
        <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-4 sm:p-5 shadow-sm text-red-900 space-y-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-100 text-red-600 rounded-xl shrink-0 mt-0.5">
                <ShieldAlert className="w-6 h-6 animate-bounce" />
              </div>
              <div>
                <h4 className="font-bold text-base text-red-900 flex items-center gap-2">
                  <span>แจ้งเตือน Link User ที่หมดอายุการใช้งาน ({expiredUsers.length} บัญชี)</span>
                </h4>
                <p className="text-xs text-red-700 mt-0.5">
                  ตรวจพบ Link User ที่หมดอายุแล้ว ผู้ใช้จะไม่สามารถเข้าใช้งานได้จนกว่าจะต่ออายุหรืออัปเดตวันหมดอายุ
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowExpiredPopup(false)}
              className="text-red-400 hover:text-red-700 p-1 rounded-lg"
              title="ปิดการแจ้งเตือนชั่วคราว"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
            {expiredUsers.map((u) => {
              const exp = checkUserLinkExpiry(u.expiresAt);
              return (
                <div
                  key={u.id}
                  className="bg-white border border-red-200 rounded-xl p-3 flex items-center justify-between shadow-2xs"
                >
                  <div className="truncate pr-2">
                    <span className="font-bold text-xs text-slate-900 block truncate">{u.name}</span>
                    <span className="text-[11px] text-red-600 font-medium font-mono block">
                      หมดเมื่อ {exp.formattedDate}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">User: {u.username}</span>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedUserForRenew(u);
                    }}
                    className="shrink-0 px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-2xs"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>ต่ออายุ</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Success / Notification Notice */}
      {renewNotice && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs sm:text-sm flex items-center gap-2.5 shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-semibold">{renewNotice}</span>
        </div>
      )}

      {/* Copy Toast */}
      {copyFeedback && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-5 py-2.5 rounded-full shadow-2xl text-xs font-bold flex items-center gap-2 border border-slate-700 animate-in fade-in zoom-in-95">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{copyFeedback}</span>
        </div>
      )}

      {/* Section 1: Form สร้าง Link User ใหม่ */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-7">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4 mb-5">
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Plus className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              ฟอร์มสร้าง Link User / Password & กำหนดวันหมดอายุ
            </h2>
            <p className="text-xs text-slate-500">
              กำหนดข้อมูลช่าง/ผู้ใช้ เลือกระยะเวลาหมดอายุผ่านเมนูด่วน หรือระบุจำนวนวันได้เอง
            </p>
          </div>
        </div>

        <form onSubmit={handleCreateUser} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {/* 1. Name */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                ชื่อช่าง หรือ ผู้ใช้งาน *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="เช่น ช่างสมศักดิ์ ชุมแพ"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* 2. Phone */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                เบอร์โทรศัพท์
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="081-234-5678"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>
            </div>

            {/* 3. Username */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                ชื่อผู้ใช้ (Username สำหรับ Login) *
              </label>
              <div className="relative">
                <UserCheck className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="เช่น somsak01"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>
            </div>

            {/* 4. Password */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                รหัสผ่าน (Password สำหรับ Login) *
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="รหัสผ่าน"
                  className="w-full pl-9 pr-10 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* 5. Custom Link Slug / Token */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                โทเคนรหัสลิงก์ (URL Token Slug)
              </label>
              <div className="relative">
                <LinkIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={tokenSlug}
                  onChange={(e) => setTokenSlug(e.target.value)}
                  placeholder="เช่น somsak_771"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-blue-700"
                />
              </div>
            </div>

            {/* 6. Notes */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                หมายเหตุเพิ่มเติม (ถ้ามี)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="เช่น ช่างซ่อมแอร์ เขต 1 ชุมแพ"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* วันหมดอายุ: กำหนดเป็นวันได้ และ แบบเมนูด่วน */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-blue-600" />
                <span>กำหนดระยะเวลาหมดอายุ (เลือกเมนูด่วน หรือระบุจำนวนวัน):</span>
              </label>
              <div className="text-xs font-bold text-blue-700 bg-blue-100/70 px-3 py-1 rounded-full flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>จะหมดอายุในวันที่: {calculatedExpiryDate}</span>
                <span className="font-mono">({expiryDays} วัน)</span>
              </div>
            </div>

            {/* เมนูด่วน: 1 อาทิตย์ 1 เดือน 3 เดือน 6 เดือน 9 เดือน 12 เดือน */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
              {PRESET_EXPIRY_OPTIONS.map((item) => {
                const isSelected = expiryDays === item.days;
                return (
                  <button
                    key={item.days}
                    type="button"
                    onClick={() => setExpiryDays(item.days)}
                    className={`py-2 px-3 rounded-xl border text-center transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm font-bold scale-[1.02]'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50/50'
                    }`}
                  >
                    <span className="block text-xs font-bold">{item.label}</span>
                    <span className={`block text-[10px] mt-0.5 ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                      {item.desc}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* ช่องระบุจำนวนวันเอง */}
            <div className="flex items-center gap-3 pt-1">
              <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                หรือระบุจำนวนวันเอง:
              </span>
              <div className="flex items-center gap-2 max-w-xs">
                <input
                  type="number"
                  min="1"
                  max="3650"
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-24 px-3 py-1.5 text-sm font-bold font-mono border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
                <span className="text-xs text-slate-600">วันนับจากวันนี้</span>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>สร้าง Link User & บันทึกเข้าระบบ</span>
            </button>
          </div>
        </form>
      </div>

      {/* Section 2: ตาราง User ที่บันทึกไว้ (ตารางแสดงรายการ user ทั้งหมด) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Table Header & Search */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                ตารางบันทึก Link User ({filteredUsers.length} รายการ)
              </h3>
              <p className="text-xs text-slate-500">
                รายการบัญชีช่าง/ผู้ใช้ทั้งหมด พร้อมลิงก์ด่วน วันหมดอายุ และเครื่องมือจัดการ
              </p>
            </div>
          </div>

          <div className="relative max-w-xs w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาชื่อ, เบอร์, username..."
              className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Table View (Excel / Spreadsheet Style) */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/80 text-slate-700 border-b border-slate-200 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3 text-center w-12">#</th>
                <th className="py-3 px-3">ชื่อช่าง / เบอร์โทร</th>
                <th className="py-3 px-3">Username / Password</th>
                <th className="py-3 px-3">วันหมดอายุ / สถานะ</th>
                <th className="py-3 px-3">ลิงก์เข้าใช้งาน (User Link)</th>
                <th className="py-3 px-3 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">
                    ไม่พบข้อมูล Link User
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u, idx) => {
                  const exp = checkUserLinkExpiry(u.expiresAt);
                  const isPassVisible = visiblePasswords[u.id];

                  return (
                    <tr
                      key={u.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        exp.isExpired ? 'bg-red-50/40' : ''
                      }`}
                    >
                      {/* 1. Index */}
                      <td className="py-3 px-3 text-center text-slate-400 font-mono">
                        {idx + 1}
                      </td>

                      {/* 2. Name & Phone */}
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                          <span>{u.name}</span>
                          {exp.isExpired && (
                            <span className="text-[10px] font-bold bg-red-100 text-red-700 px-1.5 py-0.2 rounded">
                              หมดอายุ
                            </span>
                          )}
                        </div>
                        <div className="text-slate-500 font-mono text-[11px] flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{u.phone}</span>
                          {u.notes && (
                            <span className="text-slate-400 font-sans ml-1 truncate max-w-[120px]">
                              ({u.notes})
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 3. Username & Password */}
                      <td className="py-3 px-3">
                        <div className="font-mono text-slate-800 text-[11px]">
                          <span className="text-slate-400">User: </span>
                          <span className="font-bold">{u.username}</span>
                        </div>
                        <div className="font-mono text-slate-600 text-[11px] flex items-center gap-1 mt-0.5">
                          <span className="text-slate-400">Pass: </span>
                          <span>{isPassVisible ? u.password : '••••••'}</span>
                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility(u.id)}
                            className="text-slate-400 hover:text-slate-600 ml-1 p-0.5"
                            title={isPassVisible ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                          >
                            {isPassVisible ? (
                              <EyeOff className="w-3 h-3" />
                            ) : (
                              <Eye className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* 4. Expiration Status */}
                      <td className="py-3 px-3">
                        <div className="font-medium text-slate-800 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{exp.formattedDate}</span>
                        </div>
                        <div className="mt-1">
                          {exp.isExpired ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full font-mono">
                              <AlertTriangle className="w-3 h-3" />
                              <span>หมดอายุแล้ว</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-mono">
                              <Clock className="w-3 h-3" />
                              <span>เหลือ {exp.daysRemaining} วัน</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 5. User Link & Copy Button */}
                      <td className="py-3 px-3 min-w-[200px] max-w-[240px]">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            readOnly
                            value={u.userLink}
                            className="bg-slate-100 text-slate-700 font-mono text-[10px] px-2 py-1.5 rounded border border-slate-200 w-full min-w-[120px] truncate focus:outline-none select-all"
                          />
                          <button
                            type="button"
                            onClick={() => handleCopy(u.userLink, `คัดลอกลิงก์ของ ${u.name} เรียบร้อยแล้ว`)}
                            className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors shrink-0 cursor-pointer"
                            title="คัดลอกลิงก์ใช้งาน"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const shareText = `ลิงก์เข้าใช้งานระบบคิวงานซ่อม Onsite สำหรับ: ${u.name}\nลิงก์: ${u.userLink}\nชื่อผู้ใช้: ${u.username}\nรหัสผ่าน: ${u.password}\nวันหมดอายุ: ${exp.formattedDate}`;
                              handleCopy(shareText, `คัดลอกข้อมูลส่ง LINE เรียบร้อยแล้ว`);
                            }}
                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-colors shrink-0 cursor-pointer"
                            title="คัดลอกข้อความสำหรับส่ง LINE ให้ช่าง"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* 6. Actions */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Quick Renew Button */}
                          <button
                            type="button"
                            onClick={() => setSelectedUserForRenew(u)}
                            className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg font-bold text-[11px] transition-colors flex items-center gap-1 cursor-pointer"
                            title="ต่ออายุการใช้งาน"
                          >
                            <RotateCcw className="w-3 h-3 text-amber-600" />
                            <span>ต่ออายุ</span>
                          </button>

                          {/* Test Login Button */}
                          <button
                            type="button"
                            onClick={() => onSwitchToUser(u)}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium text-[11px] transition-colors flex items-center gap-1 cursor-pointer"
                            title="ทดสอบเข้าใช้งานในชื่อช่างคนนี้"
                          >
                            <ExternalLink className="w-3 h-3 text-slate-500" />
                            <span className="hidden sm:inline">ทดสอบ</span>
                          </button>

                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(u.id, u.name)}
                            className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors cursor-pointer"
                            title="ลบ Link User นี้"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Renew Modal (เปิดเมื่อกดต่ออายุในตาราง) */}
      {selectedUserForRenew && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-slate-900 text-base">
                  ต่ออายุ Link User: {selectedUserForRenew.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedUserForRenew(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl space-y-1">
              <div>
                <span className="font-semibold text-slate-700">วันหมดอายุเดิม: </span>
                <span className="font-mono">
                  {checkUserLinkExpiry(selectedUserForRenew.expiresAt).formattedDate}
                </span>
              </div>
              <div>
                <span className="font-semibold text-slate-700">สถานะปัจจุบัน: </span>
                <span className="font-mono text-amber-700">
                  {checkUserLinkExpiry(selectedUserForRenew.expiresAt).isExpired
                    ? 'หมดอายุแล้ว'
                    : `เหลือ ${checkUserLinkExpiry(selectedUserForRenew.expiresAt).daysRemaining} วัน`}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-800 block">
                เลือกจำนวนวันที่ต้องการต่ออายุเพิ่ม (เมนูด่วน):
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: '1 อาทิตย์', days: 7 },
                  { label: '1 เดือน', days: 30 },
                  { label: '3 เดือน', days: 90 },
                  { label: '6 เดือน', days: 180 },
                  { label: '9 เดือน', days: 270 },
                  { label: '12 เดือน', days: 365 },
                ].map((p) => (
                  <button
                    key={p.days}
                    type="button"
                    onClick={() => handleQuickRenew(selectedUserForRenew, p.days)}
                    className="py-2.5 px-3 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-600 hover:text-white text-amber-900 font-bold text-xs transition-colors flex flex-col items-center justify-center cursor-pointer"
                  >
                    <span>+{p.label}</span>
                    <span className="text-[10px] font-normal opacity-80">({p.days} วัน)</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedUserForRenew(null)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
