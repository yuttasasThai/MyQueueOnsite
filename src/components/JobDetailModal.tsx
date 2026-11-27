// File: /src/components/JobDetailModal.tsx | Revision: Rev 22 | Version: 1.5.3 | Modified: 2026-11-17
import React, { useState, useEffect } from 'react';
import {
  X,
  Phone,
  MessageCircle,
  Facebook,
  Calendar,
  CalendarPlus,
  CalendarClock,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Printer,
  Navigation,
  Edit,
  Edit3,
  BellRing,
  Send,
  Copy,
  Check,
  RefreshCw,
  Lock,
  Save,
  Shield,
  Camera,
  Images,
  Ban,
  ZoomIn,
  Play,
  Film,
  DollarSign,
  Award,
} from 'lucide-react';
import { RepairJob, RepairStatus, ShopSettings, StatusPhotoItem } from '../types';
import { getWarrantyStatus } from '../services/storage';
import { getTotalJobPhotosCount, isVideoMediaItem } from '../services/imageUtils';
import { downloadAppointmentIcsAlarm } from '../services/appointmentAlarm';
import {
  StatusStepperIcons,
  getNextForwardStatus,
  isForwardTransitionAllowed,
} from './StatusStepperIcons';
import { RescheduleJobModal, CancelJobModal } from './StatusActionModals';
import { MediaLightboxModal } from './MediaPreviewItem';
import {
  sendLineNotification,
  getActiveLineChannelToken,
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

const WARRANTY_PRESETS = [
  { label: '30 วัน', days: 30 },
  { label: '60 วัน', days: 60 },
  { label: '90 วัน', days: 90 },
  { label: '180 วัน', days: 180 },
  { label: '1 ปี (365)', days: 365 },
];

interface JobDetailModalProps {
  job: RepairJob | null;
  onClose: () => void;
  onStatusChange: (jobId: string, status: RepairStatus, allowOverride?: boolean) => void;
  onRescheduleJob: (jobId: string, newDate: string, newTime: string, reason?: string) => void;
  onCancelJob: (jobId: string, reason?: string) => void;
  onUpdateActualCost: (jobId: string, actualCost: number) => void;
  onUpdateClosingDetails: (jobId: string, actualCost: number, warrantyDays: number) => void;
  onOpenCloseJobModal: (job: RepairJob) => void;
  onEdit: (job: RepairJob) => void;
  onPrint: (job: RepairJob) => void;
  onOpenStatusPhotos: (job: RepairJob, status?: RepairStatus) => void;
  settings: ShopSettings;
  isAdmin: boolean;
}

export const JobDetailModal: React.FC<JobDetailModalProps> = ({
  job,
  onClose,
  onStatusChange,
  onRescheduleJob,
  onCancelJob,
  onUpdateActualCost,
  onUpdateClosingDetails,
  onOpenCloseJobModal,
  onEdit,
  onPrint,
  onOpenStatusPhotos,
  settings,
  isAdmin,
}) => {
  const [actualCostInput, setActualCostInput] = useState<string>('');
  const [warrantyDaysInput, setWarrantyDaysInput] = useState<number>(90);
  const [costSaved, setCostSaved] = useState(false);
  const [closingSaved, setClosingSaved] = useState(false);

  // Explicit edit mode states
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [draftEditStatus, setDraftEditStatus] = useState<RepairStatus>('รับงาน');

  // Inline status media preview below status icons
  const [mediaFilterStatus, setMediaFilterStatus] = useState<'all' | RepairStatus>('all');
  const [previewMediaEntry, setPreviewMediaEntry] = useState<{
    item: StatusPhotoItem;
    status: RepairStatus;
  } | null>(null);

  // Reschedule & Cancel modal states
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);

  // LINE notification states
  const [isSendingLine, setIsSendingLine] = useState(false);
  const [lineResultMsg, setLineResultMsg] = useState<{ success: boolean; text: string } | null>(null);
  const [copiedLine, setCopiedLine] = useState(false);

  useEffect(() => {
    if (job) {
      setActualCostInput(
        job.actualCost !== null
          ? String(job.actualCost)
          : job.status === 'ปิดงาน' && job.estimatedCost > 0
          ? String(job.estimatedCost)
          : ''
      );
      setWarrantyDaysInput(typeof job.warrantyDays === 'number' ? job.warrantyDays : 90);
      setIsEditingStatus(false);
      setDraftEditStatus(job.status);
      setMediaFilterStatus('all');
      setPreviewMediaEntry(null);
      setIsRescheduleOpen(false);
      setIsCancelOpen(false);
      setClosingSaved(false);
    }
  }, [job?.id, job?.status, job?.actualCost, job?.warrantyDays]);

  if (!job) return null;

  const warrantyStatus = getWarrantyStatus(job.warrantyEndDate, job.warrantyDays);
  const nextForwardStatus = getNextForwardStatus(job.status);
  const totalPhotosCount = getTotalJobPhotosCount(job);

  const statusMediaEntries = ALL_STATUSES.flatMap((st) =>
    (job.statusPhotos?.[st] || []).map((item) => ({ status: st, item }))
  );
  const statusesWithMedia = ALL_STATUSES.filter(
    (st) => (job.statusPhotos?.[st]?.length || 0) > 0
  );
  const visibleMediaEntries =
    mediaFilterStatus === 'all'
      ? statusMediaEntries
      : statusMediaEntries.filter((entry) => entry.status === mediaFilterStatus);

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
    if (actualCostInput.trim() !== '' && !isNaN(cost) && cost >= 0) {
      onUpdateActualCost(job.id, cost);
      setCostSaved(true);
      setTimeout(() => setCostSaved(false), 2000);
    }
  };

  const handleSaveClosingDetails = () => {
    const cost = actualCostInput.trim() === '' ? 0 : Number(actualCostInput);
    if (isNaN(cost) || cost < 0) return;
    const cleanDays = Math.max(0, Math.floor(Number(warrantyDaysInput) || 0));
    onUpdateClosingDetails(job.id, cost, cleanDays);
    setClosingSaved(true);
    setTimeout(() => setClosingSaved(false), 2500);
  };

  // Send current job details/status to LINE Messaging API
  const handleSendToLineNotify = async () => {
    const token = getActiveLineChannelToken(settings.lineNotify);
    const formatted = formatStatusChangeNotification(job, undefined, job.status, settings);

    if (!token) {
      setLineResultMsg({
        success: false,
        text: 'ยังไม่ได้ใส่ Channel Access Token ในหน้าตั้งค่า แนะนำคัดลอกข้อความเพื่อส่งเข้า LINE ด้วยตนเอง',
      });
      return;
    }

    setIsSendingLine(true);
    setLineResultMsg(null);

    const res = await sendLineNotification(settings.lineNotify, formatted);

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
              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>
                    นัดหมาย: <strong className="text-slate-700 font-mono">{job.appointmentDate}</strong> ({job.appointmentTime || 'ไม่ระบุเวลา'})
                  </span>
                </p>
                {job.status !== 'ปิดงาน' && job.status !== 'ยกเลิก' && (
                  <button
                    type="button"
                    onClick={() => setIsRescheduleOpen(true)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[11px] font-bold transition-colors cursor-pointer"
                    title="เปลี่ยนวันและเวลานัดหมาย"
                  >
                    <CalendarClock className="w-3 h-3" />
                    <span>เปลี่ยนวัน/เวลา</span>
                  </button>
                )}
              </div>
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
                statusPhotos={job.statusPhotos}
                onChangeStatus={(st) => {
                  if (isForwardTransitionAllowed(job.status, st)) {
                    onStatusChange(job.id, st, false);
                  }
                }}
              />

              {/* แสดงรูปภาพ / วิดีโอของสถานะงานใต้ไอค่อนสถานะ กดดูขยายเป็นภาพใหญ่ได้ */}
              {statusMediaEntries.length > 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-2.5 sm:p-3 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
                      <Images className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span>รูปภาพ / ไฟล์งานตามสถานะ (กดเพื่อขยายใหญ่)</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setMediaFilterStatus('all')}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors cursor-pointer ${
                          mediaFilterStatus === 'all'
                            ? 'bg-slate-800 text-white border-slate-800'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        ทั้งหมด ({statusMediaEntries.length})
                      </button>
                      {statusesWithMedia.map((st) => {
                        const count = job.statusPhotos?.[st]?.length || 0;
                        const active = mediaFilterStatus === st;
                        return (
                          <button
                            key={st}
                            type="button"
                            onClick={() => setMediaFilterStatus(st)}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors cursor-pointer ${
                              active
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-blue-50/70 text-blue-800 border-blue-200 hover:bg-blue-100'
                            }`}
                          >
                            {st} ({count})
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {visibleMediaEntries.map(({ status: st, item }, idx) => {
                      const isVid = isVideoMediaItem(item);
                      const thumbSrc = isVid ? item.thumbnailDataUrl || '' : item.dataUrl;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setPreviewMediaEntry({ item, status: st })}
                          className="group relative aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-900 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                          title={`กดดูขยายใหญ่ (${st} #${idx + 1})`}
                        >
                          {thumbSrc ? (
                            <img
                              src={thumbSrc}
                              alt={`${st} ${idx + 1}`}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 bg-slate-800 gap-0.5">
                              <Film className="w-5 h-5" />
                              <span className="text-[9px]">วิดีโอ</span>
                            </div>
                          )}

                          <span className="absolute top-1 left-1 px-1.5 py-0.2 rounded bg-slate-900/75 text-white text-[9px] font-bold backdrop-blur-xs max-w-[85%] truncate">
                            {st}
                          </span>

                          {isVid ? (
                            <div className="absolute inset-0 bg-black/25 flex items-center justify-center">
                              <div className="w-7 h-7 rounded-full bg-white/90 text-slate-900 flex items-center justify-center shadow">
                                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                              </div>
                            </div>
                          ) : (
                            <span className="absolute bottom-1 right-1 p-1 rounded bg-slate-900/65 text-white opacity-85 group-hover:opacity-100 transition-opacity">
                              <ZoomIn className="w-3 h-3" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="bg-white/80 rounded-xl border border-dashed border-slate-300 px-3 py-2 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                  <span>ยังไม่มีรูปภาพในสถานะงาน (เมื่อเพิ่มรูปแล้ว รูปจะแสดงใต้ไอคอนตรงนี้)</span>
                  <button
                    type="button"
                    onClick={() => onOpenStatusPhotos(job, job.status)}
                    className="text-blue-600 hover:underline font-bold shrink-0 cursor-pointer"
                  >
                    + เพิ่มรูป
                  </button>
                </div>
              )}

              {/* Direct helper text & Per-status Photo Pop-up triggers */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1.5 border-t border-slate-200/80">
                <span className="text-[11px] text-slate-500">
                  {nextForwardStatus
                    ? `กดที่ไอคอน "${nextForwardStatus}" หรือขั้นตอนถัดไปเพื่ออัปเดตทันที`
                    : job.status === 'ปิดงาน'
                    ? 'ปิดงานเรียบร้อยแล้ว (หากต้องการแก้ไข ให้กด "แก้ไขสถานะ")'
                    : 'กดปุ่ม "แก้ไขสถานะ" เพื่อปรับเปลี่ยนสถานะ'}
                </span>

                <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                  <button
                    type="button"
                    onClick={() => onOpenStatusPhotos(job, job.status)}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>
                      {job.status === 'ปิดงาน'
                        ? 'รูป / วิดีโอ (ปิดงาน)'
                        : `ถ่าย/แนบรูป (${job.status})`}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenStatusPhotos(job)}
                    className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    title="เปิดหน้าต่างรูปภาพ/วิดีโอแยกแต่ละสถานะของคิวนี้"
                  >
                    <Images className="w-3.5 h-3.5 text-blue-600" />
                    <span>ไฟล์ทั้งหมด ({totalPhotosCount})</span>
                  </button>
                </div>
              </div>
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
            <div
              className={`p-2.5 rounded-lg text-xs font-medium border ${
                job.status === 'ยกเลิก'
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : 'bg-orange-50 border-orange-200 text-orange-800'
              }`}
            >
              <div>
                สถานะพิเศษ: <strong>{job.status}</strong>
              </div>
              {job.status === 'ยกเลิก' && job.cancelReason && (
                <div className="text-[11px] mt-0.5 text-rose-700">
                  เหตุผลยกเลิก: {job.cancelReason}
                </div>
              )}
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

        {/* Cost & Warranty Section */}
        {job.status === 'ปิดงาน' ? (
          <div className="p-4 rounded-xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50/90 to-teal-50/70 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200/80 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <Award className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-emerald-950">
                    อัปเดตค่าซ่อมจริง &amp; ระบุการรับประกัน (ปิดงาน)
                  </h4>
                  <p className="text-[11px] text-emerald-800">
                    ประเมินราคาไว้: <strong className="font-mono">฿{job.estimatedCost.toLocaleString()}</strong>
                    {job.closedAt && ` • ปิดงานวันที่ ${job.closedAt}`}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onOpenCloseJobModal(job)}
                className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px] font-bold transition-colors cursor-pointer"
              >
                หน้าต่างปิดงาน (รูป/วิดีโอ)
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* ค่าซ่อมจริง */}
              <div className="bg-white p-3 rounded-xl border border-emerald-200 space-y-1.5">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                  <span>ค่าซ่อมจริงที่เก็บลูกค้า (บาท)</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={actualCostInput}
                  onChange={(e) => setActualCostInput(e.target.value)}
                  placeholder="กรอกค่าซ่อมจริง เช่น 1500"
                  className="w-full px-3 py-2 text-sm font-mono font-bold text-emerald-900 bg-emerald-50/40 border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* ระบุการประกัน */}
              <div className="bg-white p-3 rounded-xl border border-blue-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                    <span>ระบุการรับประกัน</span>
                  </label>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      warrantyDaysInput === 0
                        ? 'bg-slate-200 text-slate-700'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {warrantyDaysInput === 0 ? 'ไม่มีประกัน' : `${warrantyDaysInput} วัน`}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setWarrantyDaysInput(0)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                      warrantyDaysInput === 0
                        ? 'bg-slate-800 text-white border-slate-800'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    ไม่มีประกัน (0 วัน)
                  </button>
                  {WARRANTY_PRESETS.map((preset) => (
                    <button
                      key={preset.days}
                      type="button"
                      onClick={() => setWarrantyDaysInput(preset.days)}
                      className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                        warrantyDaysInput === preset.days
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white hover:bg-blue-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-600 whitespace-nowrap">กำหนดวันเอง:</span>
                  <input
                    type="number"
                    min="0"
                    max="3650"
                    value={warrantyDaysInput}
                    onChange={(e) =>
                      setWarrantyDaysInput(Math.max(0, Number(e.target.value) || 0))
                    }
                    className="w-20 px-2 py-1 text-xs font-mono font-bold border border-slate-300 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-[11px] text-slate-500">วัน</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="text-xs text-slate-700">
                {job.warrantyDays === 0 || warrantyStatus.status === 'none' ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-200/80 text-slate-800 font-semibold">
                    สถานะประกันปัจจุบัน: ไม่มีประกัน (0 วัน)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-emerald-200 text-emerald-900 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>
                      {warrantyStatus.label} (ถึง {warrantyStatus.formattedEndDate})
                    </span>
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={handleSaveClosingDetails}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>บันทึกค่าซ่อมจริง &amp; ประกัน</span>
              </button>
            </div>

            {closingSaved && (
              <div className="text-xs text-emerald-800 font-bold bg-emerald-100 border border-emerald-300 rounded-lg px-3 py-1.5">
                ✓ อัปเดตค่าซ่อมจริงและการรับประกันลงตารางเรียบร้อยแล้ว
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Cost & Payment Section for non-closed jobs */}
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
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer"
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

            {/* Warranty Status Box */}
            <div
              className={`p-4 rounded-xl border space-y-2 ${
                warrantyStatus.status === 'none'
                  ? 'bg-slate-50 border-slate-200'
                  : warrantyStatus.status === 'valid'
                  ? 'bg-emerald-50/70 border-emerald-200'
                  : warrantyStatus.status === 'warning'
                  ? 'bg-amber-50/80 border-amber-300'
                  : 'bg-red-50/70 border-red-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {warrantyStatus.status === 'none' && (
                    <Shield className="w-5 h-5 text-slate-500" />
                  )}
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
                      {warrantyStatus.status === 'none'
                        ? 'ไม่ได้ระบุระยะรับประกัน (0 วัน)'
                        : `ระยะประกัน ${job.warrantyDays} วัน (สิ้นสุดวันที่ ${warrantyStatus.formattedEndDate})`}
                    </span>
                  </div>
                </div>

                <div className="text-right font-mono font-bold text-sm">
                  {warrantyStatus.status === 'none' ? (
                    <span className="text-slate-700 bg-slate-200 px-2.5 py-1 rounded-md text-xs">
                      ไม่มีประกัน
                    </span>
                  ) : warrantyStatus.status === 'expired' ? (
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
          </>
        )}

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
                  {settings.lineNotify?.enabled && getActiveLineChannelToken(settings.lineNotify)
                    ? 'ระบบ LINE Messaging API เชื่อมต่อแล้ว พร้อมส่งข้อความอัตโนมัติ'
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
              <span>{isSendingLine ? 'กำลังส่งแจ้งเตือน...' : 'ส่งแจ้งเตือน LINE ทันที'}</span>
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
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onPrint(job)}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>พิมพ์ใบส่งมอบงาน / ใบเสร็จ</span>
            </button>

            <button
              type="button"
              onClick={() => downloadAppointmentIcsAlarm(job)}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              title="เพิ่มลงปฏิทินมือถือ พร้อมตั้งปลุกเตือนล่วงหน้า 30 นาที"
            >
              <CalendarPlus className="w-4 h-4 text-blue-600" />
              <span>ลงปฏิทินเตือนก่อน 30 นาที</span>
            </button>

            {job.status !== 'ปิดงาน' && job.status !== 'ยกเลิก' && (
              <>
                <button
                  type="button"
                  onClick={() => setIsRescheduleOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  <CalendarClock className="w-4 h-4 text-indigo-600" />
                  <span>เปลี่ยนนัดหมาย</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsCancelOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  <Ban className="w-4 h-4 text-rose-600" />
                  <span>ยกเลิกงาน</span>
                </button>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>

      {/* Reschedule Appointment Modal */}
      <RescheduleJobModal
        job={isRescheduleOpen ? job : null}
        onClose={() => setIsRescheduleOpen(false)}
        onConfirmReschedule={onRescheduleJob}
      />

      {/* Cancel Job Confirmation Modal */}
      <CancelJobModal
        job={isCancelOpen ? job : null}
        onClose={() => setIsCancelOpen(false)}
        onConfirmCancel={onCancelJob}
      />

      {/* Fullscreen Image / Video Lightbox */}
      <MediaLightboxModal
        item={previewMediaEntry?.item || null}
        caption={
          previewMediaEntry
            ? `คิว ${job.queueNumber} • สถานะ "${previewMediaEntry.status}"`
            : undefined
        }
        onClose={() => setPreviewMediaEntry(null)}
      />
    </div>
  );
};
