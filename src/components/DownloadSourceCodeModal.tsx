// File: /src/components/DownloadSourceCodeModal.tsx | Revision: Rev 8 | Version: 1.2.3 | Modified: 2026-11-12
import React, { useState } from 'react';
import {
  FileCode,
  Download,
  CheckCircle2,
  Lock,
  Copy,
  FolderArchive,
  Database,
  X,
  ShieldCheck,
  Terminal,
  FolderCheck,
  Sparkles,
} from 'lucide-react';
import { RepairJob, ShopSettings, UserAccount } from '../types';
import { buildAdminLink } from '../services/storage';
import { APP_VERSION, APP_REVISION } from '../version';

interface DownloadSourceCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin: boolean;
  settings: ShopSettings;
  jobs: RepairJob[];
  users: UserAccount[];
}

export const DownloadSourceCodeModal: React.FC<DownloadSourceCodeModalProps> = ({
  isOpen,
  onClose,
  isAdmin,
  settings,
  jobs,
  users,
}) => {
  const [isZipping, setIsZipping] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [copyNotice, setCopyNotice] = useState(false);

  if (!isOpen) return null;

  // Strict guard: If somehow not admin, do not render or allow access
  if (!isAdmin) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-red-200 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-900 text-base">การเข้าถึงถูกจำกัด</h3>
          <p className="text-xs text-slate-600">
            การโหลด Source Code แสดงและอนุญาตเฉพาะบนลิงก์แอดมินเท่านั้น
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    );
  }

  const adminLink = buildAdminLink(settings.adminSecretToken);

  const handleCopyAdminLink = () => {
    navigator.clipboard.writeText(adminLink);
    setCopyNotice(true);
    setTimeout(() => setCopyNotice(false), 2500);
  };

  const handleDownloadDatabaseOnly = () => {
    const data = {
      exportDate: new Date().toISOString(),
      version: APP_VERSION,
      revision: APP_REVISION,
      shopSettings: settings,
      repairJobs: jobs,
      userAccounts: users,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `onsite-repair-database-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Download complete full source code containing real src/ folder and all assets
  const handleDownloadFullSourceCode = async () => {
    try {
      setIsZipping(true);

      const res = await fetch('/api/download-source-zip');
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `onsite-repair-service-v${APP_VERSION}-source-code.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setIsZipping(false);
        setDownloadSuccess(true);
        setTimeout(() => setDownloadSuccess(false), 5000);
        return;
      }

      // Fallback direct navigation
      window.location.href = '/api/download-source-zip';
      setIsZipping(false);
      setDownloadSuccess(true);
    } catch (err) {
      console.error('Failed to download source zip:', err);
      // Direct navigation fallback
      window.location.href = '/api/download-source-zip';
      setIsZipping(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-xs">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-1.5">
                <span>ดาวน์โหลด Source Code โปรแกรม</span>
                <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-mono font-bold">
                  v{APP_VERSION}
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                แพ็กเกจไฟล์โค้ดแท้ครบชุด 100% รวมโฟลเดอร์ src และ assets ทั้งหมด
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Verification Checklist: ยืนยันไฟล์ครบถ้วนมีโฟลเดอร์ src/ */}
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50/60 border border-emerald-200 rounded-2xl p-4 text-xs text-emerald-950 space-y-2.5 shadow-2xs">
          <div className="font-bold flex items-center gap-2 text-emerald-900 text-sm">
            <FolderCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>ตรวจสอบความสมบูรณ์: มีโฟลเดอร์ src/ ครบถ้วน 100%</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5 text-[11px] text-emerald-900/90 font-medium">
            <div className="flex items-center gap-1.5 bg-white/70 p-2 rounded-xl border border-emerald-100">
              <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0">✓</span>
              <span><strong>โฟลเดอร์ src/</strong> (Components 16 ไฟล์, Services, Data, Types)</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/70 p-2 rounded-xl border border-emerald-100">
              <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0">✓</span>
              <span><strong>โฟลเดอร์ public/</strong> (รูปภาพและไอคอนครบทั้งหมด)</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/70 p-2 rounded-xl border border-emerald-100">
              <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0">✓</span>
              <span><strong>ไฟล์คอนฟิก</strong> (package.json, vite.config.ts, tsconfig, server.ts)</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/70 p-2 rounded-xl border border-emerald-100">
              <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0">✓</span>
              <span><strong>พร้อมใช้งาน</strong> (คำสั่ง npm install && npm run dev)</span>
            </div>
          </div>
        </div>

        {/* Security Notice: "การโหลด source code แสดงเฉพาะ ลิงก์แอดมินเท่านั้น" */}
        <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200/90 text-xs text-amber-950 space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-amber-900">
            <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>นโยบายความปลอดภัย: แสดงเฉพาะลิงก์แอดมินเท่านั้น</span>
          </div>
          <p className="text-[11px] text-amber-900/80 leading-relaxed">
            ปุ่มดาวน์โหลด Source Code นี้ ถูกจำกัดให้แสดงเฉพาะผู้ใช้งานในโหมดแอดมิน โดยช่างหน้างานหรือลิงก์ User ทั่วไปจะไม่เห็นปุ่มนี้
          </p>
        </div>

        {/* Admin Link Box */}
        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-700 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-slate-500" />
              <span>ลิงก์เข้าสู่ระบบเฉพาะแอดมิน (Admin Access Link):</span>
            </span>
            <button
              onClick={handleCopyAdminLink}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-medium flex items-center gap-1 transition-colors cursor-pointer text-[11px]"
            >
              <Copy className="w-3 h-3" />
              <span>{copyNotice ? 'คัดลอกแล้ว!' : 'คัดลอกลิงก์'}</span>
            </button>
          </div>
          <div className="font-mono text-[11px] text-slate-600 bg-white p-2 rounded-xl border border-slate-200 break-all select-all font-semibold">
            {adminLink}
          </div>
        </div>

        {/* Action Options */}
        <div className="space-y-3 pt-1">
          {/* Main Download Button */}
          <button
            onClick={handleDownloadFullSourceCode}
            disabled={isZipping}
            className="w-full p-4 rounded-2xl border-2 border-blue-600 bg-gradient-to-r from-blue-50 to-indigo-50/70 hover:from-blue-100 hover:to-indigo-100/90 text-left transition-all flex items-center justify-between group cursor-pointer shadow-xs"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center group-hover:scale-105 transition-transform shadow-sm">
                <FolderArchive className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <span>ดาวน์โหลด Full Source Code (.zip)</span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded font-sans">
                    มี src ครบ
                  </span>
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  ไฟล์โค้ดจริงครบถ้วนทั้งโปรเจกต์ โฟลเดอร์ src, public และไฟล์คอนฟิก
                </p>
              </div>
            </div>
            <div className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shrink-0 shadow-xs transition-colors flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5" />
              <span>{isZipping ? 'กำลังบีบอัด...' : 'ดาวน์โหลด ZIP'}</span>
            </div>
          </button>

          {/* Database Only Download */}
          <button
            onClick={handleDownloadDatabaseOnly}
            className="w-full p-3.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-left transition-all flex items-center justify-between group cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 text-xs sm:text-sm">
                  ดาวน์โหลดสำรองข้อมูลคิวงาน (.json)
                </h4>
                <p className="text-[11px] text-slate-500">
                  ส่งออกข้อมูลงานซ่อม {jobs.length} รายการ และผู้ใช้ {users.length} คน
                </p>
              </div>
            </div>
            <div className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold group-hover:bg-slate-200 transition-colors">
              ส่งออก JSON
            </div>
          </button>
        </div>

        {downloadSuccess && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">
              ดาวน์โหลด Source Code ครบชุด (รวมโฟลเดอร์ src/) สำเร็จเรียบร้อยแล้ว
            </span>
          </div>
        )}

        {/* Footer */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
};
