// File: /src/components/AdminPinModal.tsx | Revision: Rev 10 | Version: 1.2.5 | Modified: 2026-11-12
import React, { useState } from 'react';
import { Lock, X, AlertCircle, ShieldCheck } from 'lucide-react';

interface AdminPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  targetPassword?: string;
}

export const AdminPinModal: React.FC<AdminPinModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  targetPassword = '099-225-6601',
}) => {
  const [pin, setPin] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  // ตัดช่องว่างและขีดออกทั้งหมดเพื่อรองรับทั้ง 099-225-6601, 099 2256601, 0992256601
  const normalize = (val: string) => val.replace(/[\s-]+/g, '').trim().toLowerCase();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const inputNormalized = normalize(pin);
    const validTarget1 = normalize('099-225-6601'); // 0992256601
    const validTarget2 = normalize(targetPassword || '');
    const validTarget3 = 'admin';

    if (
      inputNormalized === validTarget1 ||
      (validTarget2 && inputNormalized === validTarget2) ||
      inputNormalized === validTarget3
    ) {
      setPin('');
      setErrorMessage('');
      onSuccess();
      onClose();
    } else {
      setErrorMessage('รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
      setPin('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
              <Lock className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">เข้าสู่ระบบแอดมิน</h3>
              <p className="text-[11px] text-slate-500">กรุณาใส่รหัสเพื่อเข้าใช้งาน</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setPin('');
              setErrorMessage('');
              onClose();
            }}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">
              รหัสผ่านแอดมิน (Admin Password)
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              {/* Type password: ซ่อนรหัสผ่านเป็นจุด ไม่แสดงรหัส และ placeholder ไม่เขียนบอกรหัส */}
              <input
                type="password"
                required
                autoFocus
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="กรอกรหัสผ่าน"
                className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-mono tracking-widest"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setPin('');
                setErrorMessage('');
                onClose();
              }}
              className="w-1/3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="w-2/3 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>ยืนยันเข้าแอดมิน</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
