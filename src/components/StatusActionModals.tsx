// File: /src/components/StatusActionModals.tsx | Revision: Rev 16 | Version: 1.3.1 | Modified: 2026-11-14
import React, { useState, useEffect } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Edit3,
  AlertTriangle,
  X,
  Save,
  ShieldAlert,
} from 'lucide-react';
import { RepairJob, RepairStatus } from '../types';

const ALL_STATUSES: RepairStatus[] = [
  'รับงาน',
  'กำลังไป',
  'กำลังซ่อม',
  'ซ่อมแล้ว',
  'ปิดงาน',
  'นัดหมายต่อ',
  'ยกเลิก',
];

const getStatusPillClass = (status: RepairStatus) => {
  switch (status) {
    case 'รับงาน':
      return 'bg-blue-100 text-blue-800 border-blue-300';
    case 'กำลังไป':
      return 'bg-amber-100 text-amber-800 border-amber-300';
    case 'กำลังซ่อม':
      return 'bg-purple-100 text-purple-800 border-purple-300';
    case 'ซ่อมแล้ว':
      return 'bg-teal-100 text-teal-800 border-teal-300';
    case 'ปิดงาน':
      return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    case 'นัดหมายต่อ':
      return 'bg-orange-100 text-orange-800 border-orange-300';
    case 'ยกเลิก':
      return 'bg-slate-200 text-slate-700 border-slate-300';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-300';
  }
};

interface ConfirmForwardStatusModalProps {
  job: RepairJob | null;
  targetStatus: RepairStatus | null;
  onClose: () => void;
  onConfirm: (jobId: string, newStatus: RepairStatus) => void;
}

export const ConfirmForwardStatusModal: React.FC<ConfirmForwardStatusModalProps> = ({
  job,
  targetStatus,
  onClose,
  onConfirm,
}) => {
  if (!job || !targetStatus) return null;

  return (
    <div
      className="fixed inset-0 z-[60] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-sm sm:text-base">
                ยืนยันอัปเดตสถานะงาน
              </h4>
              <p className="text-[11px] text-slate-500">
                คิว {job.queueNumber} • {job.customer.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2.5">
          <div className="text-xs text-slate-700 font-medium line-clamp-1">
            งาน: <strong className="text-slate-900">{job.product}</strong>
          </div>

          <div className="flex items-center justify-center gap-2.5 py-1">
            <span
              className={`px-2.5 py-1 rounded-lg border text-xs font-bold ${getStatusPillClass(
                job.status
              )}`}
            >
              {job.status}
            </span>
            <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
            <span
              className={`px-2.5 py-1 rounded-lg border text-xs font-bold ring-2 ring-blue-400/40 ${getStatusPillClass(
                targetStatus
              )}`}
            >
              {targetStatus}
            </span>
          </div>

          <p className="text-[11px] text-slate-500 text-center">
            ระบบเดินหน้าทางเดียว (ไม่สามารถกดย้อนหลังได้) หากกดผิดภายหลังให้ใช้ปุ่ม &quot;แก้ไขสถานะ&quot;
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm(job.id, targetStatus);
              onClose();
            }}
            className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>ยืนยันอัปเดตสถานะ</span>
          </button>
        </div>
      </div>
    </div>
  );
};

interface EditStatusModalProps {
  job: RepairJob | null;
  onClose: () => void;
  onSaveStatus: (jobId: string, newStatus: RepairStatus) => void;
}

export const EditStatusModal: React.FC<EditStatusModalProps> = ({
  job,
  onClose,
  onSaveStatus,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<RepairStatus>('รับงาน');

  useEffect(() => {
    if (job) {
      setSelectedStatus(job.status);
    }
  }, [job]);

  if (!job) return null;

  const isChanged = selectedStatus !== job.status;

  return (
    <div
      className="fixed inset-0 z-[60] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-sm sm:text-base">
                แก้ไขสถานะงานซ่อม ({job.queueNumber})
              </h4>
              <p className="text-[11px] text-slate-500 line-clamp-1">
                {job.product} • {job.customer.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2 text-[11px] text-amber-900">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>
            โหมดแก้ไขสถานะ: ใช้สำหรับแก้ไขสถานะที่อัปเดตผิดพลาด หรือเปลี่ยนเป็นสถานะพิเศษ (นัดหมายต่อ / ยกเลิก)
          </span>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700">เลือกสถานะที่ถูกต้อง:</span>
            <span className="text-[11px] text-slate-500">
              สถานะเดิม: <strong>{job.status}</strong>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {ALL_STATUSES.map((st) => {
              const isSelected = selectedStatus === st;
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => setSelectedStatus(st)}
                  className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center ${
                    isSelected
                      ? `${getStatusPillClass(st)} ring-2 ring-amber-500 shadow-sm scale-[1.02]`
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {st}
                </button>
              );
            })}
          </div>
        </div>

        {isChanged && (
          <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center gap-2 text-xs">
            <AlertTriangle className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="text-slate-700">เปลี่ยนจาก</span>
            <strong className="text-slate-900">{job.status}</strong>
            <ArrowRight className="w-3.5 h-3.5 text-blue-600" />
            <strong className="text-blue-700">{selectedStatus}</strong>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            disabled={!isChanged}
            onClick={() => {
              onSaveStatus(job.id, selectedStatus);
              onClose();
            }}
            className="px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>บันทึกการแก้ไขสถานะ</span>
          </button>
        </div>
      </div>
    </div>
  );
};
