// File: /src/components/UserLinkLoginModal.tsx | Revision: Rev 12 | Version: 1.2.7 | Modified: 2026-11-13
import React, { useState } from 'react';
import { KeyRound, User, Lock, AlertCircle, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { UserAccount } from '../types';

interface UserLinkLoginModalProps {
  isOpen: boolean;
  targetUser: UserAccount | null;
  allUsers: UserAccount[];
  onSuccess: (user: UserAccount) => void;
  onRequestAdminLogin?: () => void;
}

export const UserLinkLoginModal: React.FC<UserLinkLoginModalProps> = ({
  isOpen,
  targetUser,
  allUsers,
  onSuccess,
  onRequestAdminLogin,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const trimmedUser = username.trim().toLowerCase();
    const trimmedPass = password;

    if (!trimmedUser || !trimmedPass) {
      setErrorMessage('กรุณากรอกชื่อผู้ใช้และรหัสผ่านให้ครบถ้วน');
      return;
    }

    if (targetUser) {
      const userMatches =
        targetUser.username.trim().toLowerCase() === trimmedUser ||
        (targetUser.phone && targetUser.phone.trim().toLowerCase() === trimmedUser);
      const passMatches = targetUser.password === trimmedPass;

      if (userMatches && passMatches) {
        onSuccess(targetUser);
        return;
      }
      setErrorMessage('ชื่อผู้ใช้ (Username) หรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่');
      setPassword('');
      return;
    }

    // Fallback: if URL had only ?user_token= without encoded payload, check all local users
    const found = allUsers.find(
      (u) =>
        (u.username.trim().toLowerCase() === trimmedUser ||
          (u.phone && u.phone.trim().toLowerCase() === trimmedUser)) &&
        u.password === trimmedPass
    );

    if (found) {
      onSuccess(found);
      return;
    }

    setErrorMessage('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง หรือลิงก์นี้ไม่ถูกต้อง');
    setPassword('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center mx-auto shadow-lg">
            <KeyRound className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900">เข้าสู่ระบบผู้ใช้งาน</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              กรุณากรอก Username และรหัสผ่านที่ได้รับจากแอดมิน
            </p>
          </div>

          {targetUser && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
              <User className="w-3.5 h-3.5 text-emerald-600" />
              <span>ลิงก์ของ: {targetUser.name}</span>
            </div>
          )}
        </div>

        {/* Error notice */}
        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              ชื่อผู้ใช้ (Username)
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                required
                autoFocus
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="กรอก Username"
                className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white font-mono"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              รหัสผ่าน (Password)
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="กรอกรหัสผ่าน"
                className="w-full pl-9 pr-10 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white font-mono tracking-wider"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                tabIndex={-1}
                title={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all cursor-pointer active:scale-[0.99]"
          >
            เข้าสู่ระบบใช้งาน
          </button>
        </form>

        {onRequestAdminLogin && (
          <div className="pt-2 border-t border-slate-100 text-center">
            <button
              type="button"
              onClick={onRequestAdminLogin}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
              <span>เข้าสู่ระบบแอดมิน (Admin)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
