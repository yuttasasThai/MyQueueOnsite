import React, { useState } from 'react';
import { RotateCcw, X, CheckCircle, AlertCircle, Clock, ShieldCheck } from 'lucide-react';
import { UserAccount } from '../types';
import { applyUserRenewal, checkUserLinkExpiry } from '../services/storage';

interface RenewCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeUser: UserAccount | null;
  users: UserAccount[];
  onUserUpdated: (updatedUser: UserAccount) => void;
}

export const RenewCodeModal: React.FC<RenewCodeModalProps> = ({
  isOpen,
  onClose,
  activeUser,
  users,
  onUserUpdated,
}) => {
  const [renewalInput, setRenewalInput] = useState('');
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  if (!isOpen || !activeUser) return null;

  const expiry = checkUserLinkExpiry(activeUser.expiresAt);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    const trimmed = renewalInput.trim();
    if (!trimmed) {
      setStatusMessage({ type: 'error', text: 'กรุณากรอกรหัสต่ออายุการใช้งาน' });
      return;
    }

    const result = applyUserRenewal(activeUser, trimmed, users);
    if (result.success && result.updatedUser) {
      onUserUpdated(result.updatedUser);
      setStatusMessage({ type: 'success', text: result.message });
      setRenewalInput('');
      setTimeout(() => {
        onClose();
      }, 2500);
    } else {
      setStatusMessage({ type: 'error', text: result.message });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">ต่ออายุการใช้งานลิงก์</h3>
              <p className="text-xs text-slate-500">กรอกรหัสต่ออายุที่ได้รับจากแอดมิน</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current status display */}
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
          <div className="flex justify-between items-center text-slate-700">
            <span>ผู้ใช้งาน:</span>
            <span className="font-bold text-slate-900">{activeUser.name}</span>
          </div>
          <div className="flex justify-between items-center text-slate-700">
            <span>วันหมดอายุลิงก์:</span>
            <span className="font-mono text-slate-900 font-semibold">{expiry.formattedDate}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>สถานะคงเหลือ:</span>
            <span
              className={`font-semibold font-mono ${
                expiry.isExpired
                  ? 'text-red-600'
                  : expiry.daysRemaining <= 7
                  ? 'text-amber-600'
                  : 'text-emerald-600'
              }`}
            >
              {expiry.isExpired ? 'หมดอายุแล้ว' : `เหลืออีก ${expiry.daysRemaining} วัน`}
            </span>
          </div>
        </div>

        {statusMessage && (
          <div
            className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              รหัสต่ออายุการใช้งาน (Renewal Code) *
            </label>
            <input
              type="text"
              required
              value={renewalInput}
              onChange={(e) => setRenewalInput(e.target.value)}
              placeholder="เช่น RENEW-SOMSAK-90D-7182"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono uppercase"
            />
          </div>

          {/* Quick helper for demo: show available unused codes for this user */}
          {activeUser.renewalCodesList.filter((c) => !c.isUsed).length > 0 && (
            <div className="text-[11px] text-slate-500 space-y-1 bg-amber-50/50 p-2.5 rounded-lg border border-amber-200/50">
              <span className="font-semibold text-slate-700 block">
                รหัสต่ออายุที่คุณมีสิทธิ์ใช้งาน:
              </span>
              <div className="flex flex-wrap gap-1 mt-1">
                {activeUser.renewalCodesList
                  .filter((c) => !c.isUsed)
                  .map((c, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setRenewalInput(c.code)}
                      className="px-2 py-0.5 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded font-mono text-[10px]"
                    >
                      {c.code} (+{c.daysToAdd}ว.)
                    </button>
                  ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              ยืนยันการต่ออายุ
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
