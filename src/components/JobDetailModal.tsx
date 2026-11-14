// File: /src/components/JobDetailModal.tsx | Revision: Rev 16 | Version: 1.3.1 | Modified: 2026-11-14
import React, { useState, useEffect } from 'react';
import {
  X,
  Phone,
  MessageCircle,
  Facebook,
  MapPin,
  Calendar,
  Clock,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Wrench,
  Printer,
  DollarSign,
  User,
  Camera,
  Navigation,
  Edit,
  Edit3,
  BellRing,
  Send,
  Copy,
  Check,
  RefreshCw,
  ArrowRight,
  Lock,
  Save,
  Shield,
} from 'lucide-react';
import { RepairJob, RepairStatus, ShopSettings } from '../types';
import { getWarrantyStatus } from '../services/storage';
import {
  StatusStepperIcons,
  getNextForwardStatus,
  isForwardTransitionAllowed,
} from './StatusStepperIcons';
import {
  sendLineNotify,
  formatStatusChangeNotification,
  getLineShareUrl,
  addNotificationLog,
} from '../services/lineNotify';

const ALL_STATUSES: RepairStatus[] = [
  'รับงาน',
  'กำลังไป',
  'กำลังซ่อม',
  'ซ่อมแล้ว',
  'ปิดงาน',
  'นัดหมายต่อ',
  'ยกเลิก',
];

interface JobDetailModalProps {
  job: RepairJob | null;
  onClose: () => void;
  onStatusChange: (jobId: string, status: RepairStatus, allowOverride?: boolean) => void;
  onUpdateActualCost: (jobId: string, actualCost: number) => void;
  onEdit: (job: RepairJob) => void;
  onPrint: (job: RepairJob) => void;
  settings: ShopSettings;
  isAdmin: boolean;
}

export const JobDetailModal: React.FC<JobDetailModalProps> = ({
  job,
  onClose,
  onStatusChange,
  onUpdateActualCost,
  onEdit,
  onPrint,
  settings,
  isAdmin,
}) => {
  const [actualCostInput, setActualCostInput] = useState<string>('');
  const [costSaved, setCostSaved] = useState(false);

  // Status forward confirmation & explicit edit mode states
  const [pendingForwardStatus, setPendingForwardStatus] = useState<RepairStatus | null>(null);
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [draftEditStatus, setDraftEditStatus] = useState<RepairStatus>('รับงาน');

  // LINE notification states
  const [isSendingLine, setIsSendingLine] = useState(false);
  const [lineResultMsg, setLineResultMsg] = useState<{ success: boolean; text: string } | null>(null);
  const [copiedLine, setCopiedLine] = useState(false);

  useEffect(() => {
    if (job) {
      setActualCostInput(job.actualCost !== null ? String(job.actualCost) : '');
      setPendingForwardStatus(null);
      setIsEditingStatus(false);
      setDraftEditStatus(job.status);
    }
  }, [job?.id, job?.status, job?.actualCost]);

  if (!job) return null;

  const warrantyStatus = getWarrantyStatus(job.warrantyEndDate, job.warrantyDays);
  const nextForwardStatus = getNextForwardStatus(job.status);

  const getMapsUrl = () => {
    if (job.customer.mapCoordinates && job.customer.mapCoordinates.includes(',')) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        job.customer.mapCoordinates
      )}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      job.customer.address
    )}`;
  };

  const handleSaveCost = () => {
    const cost = Number(actualCostInput);
    if (!isNaN(cost) && cost >= 0) {
      onUpdateActualCost(job.id, cost);
      setCostSaved(true);
      setTimeout(() => setCostSaved(false), 2000);
    }
  };

  // Send current job details/status to LINE Notify
  const handleSendToLineNotify = async () => {
    const token = settings.lineNotify?.token?.trim();
    const formatted = formatStatusChangeNotification(job, undefined, job.status, settings);

    if (!token) {
      setLineResultMsg({
        success: false,
        text: 'ยังไม่ได้ใส่ Token ในหน้าตั้งค่า แนะนำคัดลอกข้อความเพื่อส่งเข้า LINE ด้วยตนเอง',
      });
      return;
    }

    setIsSendingLine(true);
    setLineResultMsg(null);

    const res = await sendLineNotify(token, formatted);

    addNotificationLog({
      type: 'status_change',
      jobQueueNumber: job.queueNumber,
      jobProduct: job.product,
      status: job.status,
      success: res.success,
      message: `ส่งแจ้งเตือนคิว ${job.queueNumber} สถานะ "${job.status}" ไปยัง LINE`,
      responseMessage: res.message,
    });

    setLineResultMsg({
      success: res.success,
      text: res.message,
    });
    setIsSendingLine(false);

    setTimeout(() => {
      setLineResultMsg(null);
    }, 4000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150 my-6 max-h-[90vh] overflow-y-auto">
        {/* Header Bar */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-lg font-mono font-bold text-sm sm:text-base">
              {job.queueNumber}
            </span>
            <div>
              <h3 className="font-bold text-slate-900 text-base sm:text-lg">
                {job.product}
              </h3>
              <p className="text-xs text-slate-500">
                นัดหมาย: {job.appointmentDate} ({job.appointmentTime})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {isAdmin && (
              <button
                onClick={() => {
                  onClose();
                  onEdit(job);
                }}
                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="แก้ไขข้อมูล"
              >
                <Edit className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => onPrint(job)}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              title="พิมพ์ใบส่งมอบงาน / ใบเสร็จ"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Real-time Forward-Only Circular Status Workflow Stepper */}
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>อัปเดตสถานะงาน (เดินหน้าทางเดียว ห้ามย้อนหลัง)</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                ปัจจุบัน: {job.status}
              </span>
              <button
                type="button"
                onClick={() => {
                  setPendingForwardStatus(null);
                  setDraftEditStatus(job.status);
                  setIsEditingStatus(!isEditingStatus);
                }}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                  isEditingStatus
                    ? 'bg-slate-200 text-slate-800 border-slate-300'
                    : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300'
                }`}
              >
                <Edit3 className="w-3 h-3" />
                <span>{isEditingStatus ? 'ยกเลิกการแก้ไข' : 'แก้ไขสถานะ'}</span>
              </button>
            </div>
          </div>

          {!isEditingStatus ? (
            <>
              <StatusStepperIcons
                mode="interactive"
                currentStatus={job.status}
                pendingStatus={pendingForwardStatus}
                onChangeStatus={(st) => {
                  if (isForwardTransitionAllowed(job.status, st)) {
                    setPendingForwardStatus(st);
                  }
                }}
              />

              {/* Confirmation prompt before advancing to avoid wrong updates */}
              {pendingForwardStatus ? (
                <div className="p-3 bg-blue-50 border border-blue-300 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 animate-in fade-in duration-150">
                  <div className="text-xs text-slate-800 flex flex-wrap items-center gap-1.5">
                    <span>ยืนยันอัปเดตสถานะ:</span>
                    <strong className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                      {job.status}
                    </strong>
                    <ArrowRight className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <strong className="px-2 py-0.5 rounded bg-blue-600 text-white">
                      {pendingForwardStatus}
                    </strong>
                  </div>
                  <div className="flex items-center justify-end gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setPendingForwardStatus(null)}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onStatusChange(job.id, pendingForwardStatus, false);
                        setPendingForwardStatus(null);
                      }}
                      className="px-3.5 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs flex items-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>ยืนยันอัปเดต</span>
                    </button>
                  </div>
                </div>
              ) : nextForwardStatus ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                  <span className="text-[11px] text-slate-500">
                    กดที่วงกลมขั้นถัดไป หรือกดปุ่มด้านขวาเพื่อเดินหน้าสถานะ (หากอัปเดตผิดให้กด &quot;แก้ไขสถานะ&quot;)
                  </span>
                  <button
                    type="button"
                    onClick={() => setPendingForwardStatus(nextForwardStatus)}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors shrink-0 cursor-pointer"
                  >
                    <span>ขั้นถัดไป: {nextForwardStatus}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="text-[11px] text-slate-500 text-center pt-0.5">
                  {job.status === 'ปิดงาน'
                    ? 'งานนี้ปิดงานเรียบร้อยแล้ว (หากต้องการปรับสถานะ ให้กดปุ่ม "แก้ไขสถานะ")'
                    : 'อยู่ในสถานะพิเศษ (หากต้องการเปลี่ยนสถานะ ให้กดปุ่ม "แก้ไขสถานะ")'}
                </div>
              )}
            </>
          ) : (
            /* Explicit Edit Status Mode */
            <div className="p-3 bg-amber-50/90 border border-amber-300 rounded-xl space-y-3 animate-in fade-in duration-150">
              <div className="flex items-start gap-2 text-xs text-amber-900">
                <Shield className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block">โหมดแก้ไขสถานะงาน</strong>
                  <span className="text-[11px] text-amber-800">
                    เลือกสถานะที่ถูกต้องด้านล่าง แล้วกด &quot;บันทึกสถานะ&quot; เพื่อแก้ไข
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {ALL_STATUSES.map((st) => {
                  const isSelected = draftEditStatus === st;
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setDraftEditStatus(st)}
                      className={`py-2 px-2.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-amber-600 text-white border-amber-700 shadow-sm ring-2 ring-amber-400/50'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-amber-100/50'
                      }`}
                    >
                      {st}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-end gap-2 pt-1 border-t border-amber-200/80">
                <button
                  type="button"
                  onClick={() => {
                    setDraftEditStatus(job.status);
                    setIsEditingStatus(false);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={draftEditStatus === job.status}
                  onClick={() => {
                    onStatusChange(job.id, draftEditStatus, true);
                    setIsEditingStatus(false);
                  }}
                  className="px-4 py-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>บันทึกสถานะ</span>
                </button>
              </div>
            </div>
          )}

          {!isEditingStatus && (job.status === 'นัดหมายต่อ' || job.status === 'ยกเลิก') && (
            <div className="p-2 bg-orange-50 border border-orange-200 rounded-lg text-xs text-orange-800 font-medium">
              สถานะพิเศษ: <strong>{job.status}</strong>
            </div>
          )}
        </div>

        {/* Customer Quick Actions Bar */}
        <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs text-blue-800 font-semibold block">ลูกค้า:</span>
              <span className="font-bold text-slate-900 text-sm sm:text-base">
                {job.customer.name}
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500 block">เบอร์ติดต่อ:</span>
              <span className="font-mono font-bold text-slate-900">{job.customer.phone}</span>
            </div>
          </div>

          <div className="text-xs text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200">
            <span className="font-semibold block text-slate-800 mb-0.5">ที่อยู่หน้างาน:</span>
            {job.customer.address || '-'}
          </div>

          {/* Quick Buttons for Technician Onsite */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            <a
              href={`tel:${job.customer.phone.replace(/[^0-9]/g, '')}`}
              className="flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>โทรหาลูกค้า</span>
            </a>

            {job.customer.lineId ? (
              <a
                href={`https://line.me/ti/p/~${job.customer.lineId.replace('@', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 py-2 px-3 bg-[#06C755] hover:bg-[#05b34c] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>ทัก LINE</span>
              </a>
            ) : (
              <span className="flex items-center justify-center py-2 px-3 bg-slate-100 text-slate-400 rounded-lg text-xs">
                ไม่มี LINE
              </span>
            )}

            {job.customer.facebook ? (
              <a
                href={
                  job.customer.facebook.startsWith('http')
                    ? job.customer.facebook
                    : `https://facebook.com/${encodeURIComponent(job.customer.facebook)}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 py-2 px-3 bg-[#1877F2] hover:bg-[#166fe5] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
              >
                <Facebook className="w-3.5 h-3.5" />
                <span>Facebook</span>
              </a>
            ) : (
              <span className="flex items-center justify-center py-2 px-3 bg-slate-100 text-slate-400 rounded-lg text-xs">
                ไม่มี Facebook
              </span>
            )}

            <a
              href={getMapsUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>นำทาง GPS</span>
            </a>
          </div>
        </div>

        {/* Problem & Repair Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
          <div className="space-y-1.5">
            <span className="font-semibold text-slate-700 block">อาการที่รับแจ้ง:</span>
            <div className="p-3 bg-amber-50/70 text-amber-900 border border-amber-200/80 rounded-lg leading-relaxed">
              {job.symptoms}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="font-semibold text-slate-700 block">รายละเอียดงาน / แนวทางแก้ไข:</span>
            <div className="p-3 bg-slate-50 text-slate-800 border border-slate-200 rounded-lg leading-relaxed">
              {job.jobDetails || 'ตรวจเช็คตามมาตรฐาน onsite service'}
            </div>
          </div>
        </div>

        {/* Cost & Payment Section */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs text-slate-500 block">ประเมินราคาไว้:</span>
            <span className="text-lg font-bold font-mono text-slate-900 tabular-nums">
              ฿{job.estimatedCost.toLocaleString()}
            </span>
          </div>

          <div className="flex-1 max-w-xs">
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              ค่าซ่อมจริงที่เก็บลูกค้า (บาท):
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                value={actualCostInput}
                onChange={(e) => setActualCostInput(e.target.value)}
                placeholder="ระบุค่าซ่อมจริง"
                className="w-full px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono font-bold"
              />
              <button
                type="button"
                onClick={handleSaveCost}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold whitespace-nowrap transition-colors"
              >
                บันทึกยอด
              </button>
            </div>
            {costSaved && (
              <span className="text-[11px] text-emerald-600 font-medium block mt-1">
                ✓ บันทึกค่าซ่อมจริงแล้ว
              </span>
            )}
          </div>
        </div>

        {/* Warranty Status Box (ระยะประกัน ให้เเสดงเวลาคงเหลือประกันเพื่อเตือนว่ายังอยู่ในประกันหรือหมดประกัน) */}
        <div
          className={`p-4 rounded-xl border space-y-2 ${
            warrantyStatus.status === 'valid'
              ? 'bg-emerald-50/70 border-emerald-200'
              : warrantyStatus.status === 'warning'
              ? 'bg-amber-50/80 border-amber-300'
              : 'bg-red-50/70 border-red-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {warrantyStatus.status === 'valid' && (
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
              )}
              {warrantyStatus.status === 'warning' && (
                <ShieldAlert className="w-5 h-5 text-amber-600 animate-pulse" />
              )}
              {warrantyStatus.status === 'expired' && (
                <ShieldX className="w-5 h-5 text-red-600" />
              )}
              <div>
                <span className="font-bold text-sm text-slate-900 block">
                  {warrantyStatus.label}
                </span>
                <span className="text-xs text-slate-600">
                  ระยะประกัน {job.warrantyDays} วัน (สิ้นสุดวันที่ {warrantyStatus.formattedEndDate})
                </span>
              </div>
            </div>

            <div className="text-right font-mono font-bold text-sm">
              {warrantyStatus.status === 'expired' ? (
                <span className="text-red-700 bg-red-100 px-2.5 py-1 rounded-md text-xs">
                  หมดประกันแล้ว
                </span>
              ) : (
                <span className="text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-md text-xs">
                  คุ้มครองอยู่
                </span>
              )}
            </div>
          </div>
        </div>

        {/* LINE Notify Action Card */}
        <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/60 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                <BellRing className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-xs sm:text-sm text-slate-900 block">
                  ส่งการแจ้งเตือนงานนี้ผ่าน LINE
                </span>
                <span className="text-[11px] text-slate-500">
                  {settings.lineNotify?.enabled && settings.lineNotify?.token
                    ? 'ระบบ LINE Notify เชื่อมต่อแล้ว พร้อมส่งข้อความอัตโนมัติ'
                    : 'ยังไม่ได้ใส่ Token ในหน้าตั้งค่า สามารถคัดลอกข้อความไปวางใน LINE ได้'}
                </span>
              </div>
            </div>

            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              สถานะ: {job.status}
            </span>
          </div>

          {/* Feedback banner */}
          {lineResultMsg && (
            <div
              className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                lineResultMsg.success
                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                  : 'bg-rose-100 text-rose-900 border border-rose-200'
              }`}
            >
              <Check className="w-4 h-4 shrink-0" />
              <span>{lineResultMsg.text}</span>
            </div>
          )}

          {/* Buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleSendToLineNotify}
              disabled={isSendingLine}
              className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isSendingLine ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>{isSendingLine ? 'กำลังส่งแจ้งเตือน...' : 'ส่งแจ้งเตือน LINE Notify ทันที'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const text = formatStatusChangeNotification(job, undefined, job.status, settings);
                navigator.clipboard.writeText(text);
                setCopiedLine(true);
                setTimeout(() => setCopiedLine(false), 2000);
              }}
              className="py-2 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {copiedLine ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>คัดลอกแล้ว</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>คัดลอกข้อความ</span>
                </>
              )}
            </button>

            <a
              href={getLineShareUrl(
                formatStatusChangeNotification(job, undefined, job.status, settings)
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2 px-3 bg-[#06C755] hover:bg-[#05b34c] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <span>เปิดใน LINE</span>
            </a>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={() => onPrint(job)}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>พิมพ์ใบส่งมอบงาน / ใบเสร็จ</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
