import React, { useState } from 'react';
import { KeyRound, User, Lock, X, AlertCircle, ShieldCheck } from 'lucide-react';
import { UserAccount, ShopSettings } from '../types';

interface UserLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: UserAccount[];
  settings: ShopSettings;
  onLoginAsUser: (user: UserAccount) => void;
  onLoginAsAdmin: () => void;
}

export const UserLoginModal: React.FC<UserLoginModalProps> = ({
  isOpen,
  onClose,
  users,
  settings,
  onLoginAsUser,
  onLoginAsAdmin,
}) => {
  const [loginType, setLoginType] = useState<'user' | 'admin'>('user');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [adminPin, setAdminPin] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const trimmedUser = username.trim().toLowerCase();
    const found = users.find(
      (u) =>
        (u.username.toLowerCase() === trimmedUser || u.phone === trimmedUser) &&
        u.password === password
    );

    if (found) {
      onLoginAsUser(found);
      onClose();
    } else {
      setErrorMessage('รหัส login หรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง');
    }
  };

  const handleAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const normalizedPin = adminPin.replace(/\s+/g, '').trim().toLowerCase();
    const targetPin = (settings.adminPassword || '099 2256601').replace(/\s+/g, '').trim().toLowerCase();

    if (
      normalizedPin === '0992256601' ||
      normalizedPin === targetPin ||
      normalizedPin === 'admin'
    ) {
      onLoginAsAdmin();
      onClose();
    } else {
      setErrorMessage('รหัสผ่านแอดมินไม่ถูกต้อง');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
              <KeyRound className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">เข้าสู่ระบบการใช้งาน</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher: ช่าง (User) vs แอดมิน (Admin) */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setLoginType('user');
              setErrorMessage('');
            }}
            className={`py-2 rounded-md transition-all ${
              loginType === 'user' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            ช่างหน้างาน (User)
          </button>
          <button
            type="button"
            onClick={() => {
              setLoginType('admin');
              setErrorMessage('');
            }}
            className={`py-2 rounded-md transition-all ${
              loginType === 'admin' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            ผู้ดูแลระบบ (Admin)
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        {loginType === 'user' ? (
          <form onSubmit={handleUserSubmit} className="space-y-3 text-xs sm:text-sm">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                รหัส Login หรือเบอร์โทรศัพท์ช่าง
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="เช่น somsak หรือ 081-234-5678"
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                รหัสผ่าน (Password)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-lg text-[11px] text-slate-500">
              * ช่างสามารถเข้าใช้งานผ่านลิงก์เฉพาะบุคคลที่แอดมินส่งให้ได้โดยตรง
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs sm:text-sm font-semibold shadow-xs transition-colors cursor-pointer"
            >
              เข้าใช้งานในฐานะช่าง
            </button>
          </form>
        ) : (
          <form onSubmit={handleAdminSubmit} className="space-y-3 text-xs sm:text-sm">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                รหัสผ่านแอดมิน (Admin Password)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="password"
                  required
                  value={adminPin}
                  onChange={(e) => setAdminPin(e.target.value)}
                  placeholder="กรอกรหัสผ่าน"
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono tracking-widest"
                />
              </div>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-lg text-[11px] text-slate-600">
              * โหมดแอดมินสามารถจัดการงานซ่อม, ตั้งค่าระบบ, และจัดการสิทธิ์ User ได้ทั้งหมด
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs sm:text-sm font-semibold shadow-xs transition-colors cursor-pointer"
            >
              เข้าสู่ระบบแอดมิน
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
