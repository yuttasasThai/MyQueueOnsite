// File: /src/components/StatusActionModals.tsx | Revision: Rev 22 | Version: 1.5.3 | Modified: 2026-11-17
import React, { useState, useEffect } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Edit3,
  AlertTriangle,
  X,
  Save,
  ShieldAlert,
  Calendar,
  Clock,
  Ban,
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

const TIME_SLOT_PRESETS = [
  '08:00 - 10:00',
  '09:00 - 11:00',
  '10:00 - 12:00',
  '13:00 - 15:00',
  '15:00 - 17:00',
  '17:00 - 19:00',
];

const CANCEL_REASON_PRESETS = [
  'ลูกค้าขอยกเลิกคิว',
  'ลูกค้าเลื่อนไม่มีกำหนด',
  'ซ่อมไม่คุ้ม / เปลี่ยนเครื่องใหม่',
  'ติดต่อลูกค้าไม่ได้',
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

interface RescheduleJobModalProps {
  job: RepairJob | null;
  onClose: () => void;
  onConfirmReschedule: (
    jobId: string,
    newDate: string,
    newTime: string,
    reason?: string
  ) => void;
}

export const RescheduleJobModal: React.FC<RescheduleJobModalProps> = ({
  job,
  onClose,
  onConfirmReschedule,
}) => {
  const [dateInput, setDateInput] = useState('');
  const [timeInput, setTimeInput] = useState('');
  const [reasonInput, setReasonInput] = useState('');

  useEffect(() => {
    if (job) {
      setDateInput(job.appointmentDate || new Date().toISOString().split('T')[0]);
      setTimeInput(job.appointmentTime || '10:00 - 12:00');
      setReasonInput('');
    }
  }, [job]);

  if (!job) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dateInput) return;
    onConfirmReschedule(
      job.id,
      dateInput,
      timeInput.trim() || '10:00 - 12:00',
      reasonInput.trim() || undefined
    );
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[75] bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-blue-200 space-y-4 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-sm sm:text-base">
                เปลี่ยนวัน/เวลานัดหมาย ({job.queueNumber})
              </h4>
              <p className="text-[11px] text-slate-500 line-clamp-1">
                {job.product} • คุณ{job.customer.name}
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

        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center justify-between gap-2">
          <span>นัดหมายเดิม:</span>
          <strong className="font-mono text-slate-800">
            {job.appointmentDate} ({job.appointmentTime || 'ไม่ระบุเวลา'})
          </strong>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              วันที่นัดหมายใหม่ *
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-blue-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="date"
                required
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono font-bold"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              เวลานัดหมายใหม่ (เลือกช่วงเวลาหรือพิมพ์เอง)
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Clock className="w-4 h-4 text-blue-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={timeInput}
                  onChange={(e) => setTimeInput(e.target.value)}
                  placeholder="เช่น 13:00 - 15:00 หรือ 14:30"
                  className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>
              <input
                type="time"
                aria-label="เลือกเวลาเริ่มต้น"
                onChange={(e) => {
                  if (e.target.value) setTimeInput(e.target.value);
                }}
                className="px-2 py-2 text-xs border border-slate-300 rounded-xl bg-slate-50 font-mono cursor-pointer"
                title="เลือกเวลาแบบระบุนาที"
              />
            </div>

            <div className="flex flex-wrap gap-1.5 mt-2">
              {TIME_SLOT_PRESETS.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setTimeInput(slot)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                    timeInput === slot
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                  }`}
                >
                  {slot}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              เหตุผล/หมายเหตุเลื่อนนัด (หากมี)
            </label>
            <input
              type="text"
              value={reasonInput}
              onChange={(e) => setReasonInput(e.target.value)}
              placeholder="เช่น ลูกค้าขอเลื่อนเวลาเป็นช่วงบ่าย..."
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              ปิด
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>บันทึกนัดหมายใหม่</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface CancelJobModalProps {
  job: RepairJob | null;
  onClose: () => void;
  onConfirmCancel: (jobId: string, reason?: string) => void;
}

export const CancelJobModal: React.FC<CancelJobModalProps> = ({
  job,
  onClose,
  onConfirmCancel,
}) => {
  const [reasonInput, setReasonInput] = useState('');

  useEffect(() => {
    if (job) {
      setReasonInput(job.cancelReason || '');
    }
  }, [job]);

  if (!job) return null;

  return (
    <div
      className="fixed inset-0 z-[75] bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-rose-200 space-y-4 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
              <Ban className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-sm sm:text-base">
                ยืนยันยกเลิกงานซ่อม ({job.queueNumber})
              </h4>
              <p className="text-[11px] text-slate-500 line-clamp-1">
                {job.product} • คุณ{job.customer.name}
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

        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span>
            เมื่อยกเลิกงาน สถานะจะเปลี่ยนเป็น <strong>&quot;ยกเลิก&quot;</strong> และหยุดการแจ้งเตือนเสียงของคิวงานนี้โดยอัตโนมัติ (ข้อมูลคิวจะยังถูกเก็บไว้ในระบบ)
          </span>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 block">
            เหตุผลที่ยกเลิก (หากมี)
          </label>
          <div className="flex flex-wrap gap-1.5">
            {CANCEL_REASON_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setReasonInput(preset)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer ${
                  reasonInput === preset
                    ? 'bg-rose-600 text-white border-rose-600'
                    : 'bg-slate-50 hover:bg-rose-50 text-slate-700 border-slate-200'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={reasonInput}
            onChange={(e) => setReasonInput(e.target.value)}
            placeholder="ระบุเหตุผลเพิ่มเติม..."
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
          >
            ไม่ยกเลิก
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirmCancel(job.id, reasonInput.trim() || undefined);
              onClose();
            }}
            className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Ban className="w-4 h-4" />
            <span>ยืนยันยกเลิกงาน</span>
          </button>
        </div>
      </div>
    </div>
  );
};
