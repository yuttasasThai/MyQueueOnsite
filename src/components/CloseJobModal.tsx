// File: /src/components/CloseJobModal.tsx | Revision: Rev 22 | Version: 1.5.3 | Modified: 2026-11-17
import React, { useState, useEffect, useRef } from 'react';
import {
  Award,
  DollarSign,
  ShieldCheck,
  X,
  Save,
  Camera,
  ImagePlus,
  Video,
  Film,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { RepairJob, StatusPhotoItem } from '../types';
import { filesToStatusPhotoItems, isVideoMediaItem } from '../services/imageUtils';
import { deleteMediaFromStore } from '../services/mediaStorage';
import { MediaGridCard, MediaLightboxModal } from './MediaPreviewItem';

export interface CloseJobPayload {
  actualCost: number;
  warrantyDays: number;
  warrantyStartDate: string;
  warrantyEndDate: string;
  closedAt: string;
  closingPhotos: StatusPhotoItem[];
  notes?: string;
}

interface CloseJobModalProps {
  job: RepairJob | null;
  onClose: () => void;
  onConfirmCloseJob: (jobId: string, payload: CloseJobPayload) => void;
}

const WARRANTY_PRESETS = [
  { label: 'ไม่มีประกัน', days: 0 },
  { label: '30 วัน', days: 30 },
  { label: '60 วัน', days: 60 },
  { label: '90 วัน', days: 90 },
  { label: '180 วัน', days: 180 },
  { label: '1 ปี (365)', days: 365 },
];

export const CloseJobModal: React.FC<CloseJobModalProps> = ({
  job,
  onClose,
  onConfirmCloseJob,
}) => {
  const [actualCostInput, setActualCostInput] = useState<string>('');
  const [warrantyDaysInput, setWarrantyDaysInput] = useState<number>(90);
  const [notesInput, setNotesInput] = useState<string>('');
  const [closingPhotos, setClosingPhotos] = useState<StatusPhotoItem[]>([]);
  const [isProcessingMedia, setIsProcessingMedia] = useState(false);
  const [previewItem, setPreviewItem] = useState<StatusPhotoItem | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const videoCameraRef = useRef<HTMLInputElement>(null);
  const videoFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (job) {
      setActualCostInput(
        job.actualCost !== null
          ? String(job.actualCost)
          : job.estimatedCost > 0
          ? String(job.estimatedCost)
          : ''
      );
      setWarrantyDaysInput(typeof job.warrantyDays === 'number' ? job.warrantyDays : 90);
      setNotesInput(job.notes || '');
      setClosingPhotos([]);
      setPreviewItem(null);
      setErrorMsg(null);
    }
  }, [job?.id]);

  if (!job) return null;

  const todayStr = new Date().toISOString().split('T')[0];
  const effectiveStartDate =
    job.status === 'ปิดงาน' && job.warrantyStartDate ? job.warrantyStartDate : todayStr;
  const effectiveClosedAt =
    job.status === 'ปิดงาน' && job.closedAt ? job.closedAt : todayStr;

  const calculateEndDate = (startDateStr: string, days: number) => {
    const d = new Date(startDateStr);
    d.setDate(d.getDate() + Math.max(0, Number(days) || 0));
    return d.toISOString().split('T')[0];
  };

  const calculatedEndDate = calculateEndDate(effectiveStartDate, warrantyDaysInput);
  const photoCount = closingPhotos.filter((i) => !isVideoMediaItem(i)).length;
  const videoCount = closingPhotos.filter((i) => isVideoMediaItem(i)).length;

  const handleMediaFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsProcessingMedia(true);
    setErrorMsg(null);
    try {
      const items = await filesToStatusPhotoItems(files, { allowVideo: true });
      if (items.length > 0) {
        setClosingPhotos((prev) => [...prev, ...items]);
      }
    } catch (err: any) {
      console.error('Failed to load closing media', err);
      setErrorMsg(err?.message || 'ไม่สามารถแนบไฟล์รูป/วิดีโอได้');
    } finally {
      setIsProcessingMedia(false);
      if (cameraRef.current) cameraRef.current.value = '';
      if (galleryRef.current) galleryRef.current.value = '';
      if (videoCameraRef.current) videoCameraRef.current.value = '';
      if (videoFileRef.current) videoFileRef.current.value = '';
    }
  };

  const handleRemoveDraftItem = async (item: StatusPhotoItem) => {
    setClosingPhotos((prev) => prev.filter((p) => p.id !== item.id));
    if (previewItem?.id === item.id) {
      setPreviewItem(null);
    }
    if (isVideoMediaItem(item)) {
      await deleteMediaFromStore(item.dataUrl);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (actualCostInput.trim() === '' || isNaN(Number(actualCostInput)) || Number(actualCostInput) < 0) {
      setErrorMsg('กรุณากรอกยอดค่าซ่อมจริง (บาท) ก่อนบันทึกปิดงาน');
      return;
    }

    const cleanDays = Math.max(0, Math.floor(Number(warrantyDaysInput) || 0));

    onConfirmCloseJob(job.id, {
      actualCost: Number(actualCostInput),
      warrantyDays: cleanDays,
      warrantyStartDate: effectiveStartDate,
      warrantyEndDate: calculateEndDate(effectiveStartDate, cleanDays),
      closedAt: effectiveClosedAt,
      closingPhotos,
      notes: notesInput.trim() || undefined,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[75] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-emerald-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-4 max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-4 sm:p-5 bg-gradient-to-r from-emerald-700 to-teal-700 text-white shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
              <Award className="w-5 h-5 text-emerald-200" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-white text-emerald-800 font-mono font-bold text-xs">
                  {job.queueNumber}
                </span>
                <h3 className="font-bold text-sm sm:text-base truncate">
                  ปิดงานซ่อม &amp; สรุปยอดปิดงาน
                </h3>
              </div>
              <p className="text-xs text-emerald-100 truncate mt-0.5">
                {job.product} • คุณ{job.customer.name}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-100 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. ยอดค่าซ่อมจริง */}
          <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                <span>ยอดค่าซ่อมจริงที่เก็บลูกค้า (บาท) *</span>
              </label>
              <span className="text-[11px] text-slate-500 font-mono">
                ประเมินไว้: ฿{(job.estimatedCost || 0).toLocaleString()}
              </span>
            </div>

            <input
              type="number"
              min="0"
              step="1"
              required
              autoFocus
              value={actualCostInput}
              onChange={(e) => {
                setActualCostInput(e.target.value);
                setErrorMsg(null);
              }}
              placeholder="กรอกยอดค่าซ่อมจริง เช่น 1500"
              className="w-full px-3.5 py-2.5 text-base font-mono font-bold text-emerald-900 bg-white border-2 border-emerald-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* 2. ระบุการประกันงานซ่อม */}
          <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                <span>ระบุการประกันงานซ่อม *</span>
              </label>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  warrantyDaysInput === 0
                    ? 'bg-slate-200 text-slate-700'
                    : 'bg-blue-100 text-blue-800'
                }`}
              >
                {warrantyDaysInput === 0 ? 'ไม่มีประกัน' : `รับประกัน ${warrantyDaysInput} วัน`}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setWarrantyDaysInput(0)}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  warrantyDaysInput === 0
                    ? 'bg-slate-800 text-white border-slate-800 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                ไม่มีประกัน (0 วัน)
              </button>
              <button
                type="button"
                onClick={() => {
                  if (warrantyDaysInput === 0) setWarrantyDaysInput(90);
                }}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  warrantyDaysInput > 0
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-blue-50'
                }`}
              >
                มีระยะประกัน
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {WARRANTY_PRESETS.filter((p) => p.days > 0).map((preset) => {
                const isSelected = Number(warrantyDaysInput) === preset.days;
                return (
                  <button
                    key={preset.days}
                    type="button"
                    onClick={() => setWarrantyDaysInput(preset.days)}
                    className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-blue-100/50'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-slate-600 whitespace-nowrap">ระบุระยะประกันเอง:</span>
              <input
                type="number"
                min="0"
                max="3650"
                value={warrantyDaysInput}
                onChange={(e) => setWarrantyDaysInput(Math.max(0, Number(e.target.value) || 0))}
                className="w-24 px-2.5 py-1.5 text-xs font-mono font-bold bg-white border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
              />
              <span className="text-xs text-slate-600">วัน (ใส่ 0 = ไม่มีประกัน)</span>
            </div>

            <div className="p-2 rounded-lg bg-white border border-blue-100 text-[11px] text-slate-700 flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                เริ่มประกัน: <strong className="font-mono">{warrantyDaysInput === 0 ? '-' : todayStr}</strong>
              </span>
              <span>
                สิ้นสุดประกัน:{' '}
                <strong className="font-mono text-blue-700">
                  {warrantyDaysInput === 0 ? 'ไม่มีประกัน (0 วัน)' : calculatedEndDate}
                </strong>
              </span>
            </div>
          </div>

          {/* 3. ถ่ายรูป / วิดีโอตอนปิดงาน (ถ้ามี) */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-800">
                รูปถ่าย / วิดีโอหลังซ่อมตอนปิดงาน (ถ้ามี)
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                แนบแล้ว {photoCount} รูป • {videoCount} วิดีโอ
              </span>
            </div>

            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handleMediaFiles(e.target.files)}
            />
            <input
              ref={galleryRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleMediaFiles(e.target.files)}
            />
            <input
              ref={videoCameraRef}
              type="file"
              accept="video/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handleMediaFiles(e.target.files)}
            />
            <input
              ref={videoFileRef}
              type="file"
              accept="video/*"
              multiple
              className="hidden"
              onChange={(e) => handleMediaFiles(e.target.files)}
            />

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={isProcessingMedia}
                onClick={() => cameraRef.current?.click()}
                className="py-2 px-3 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Camera className="w-3.5 h-3.5 text-blue-600" />
                <span>ถ่ายรูปปิดงาน</span>
              </button>
              <button
                type="button"
                disabled={isProcessingMedia}
                onClick={() => galleryRef.current?.click()}
                className="py-2 px-3 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <ImagePlus className="w-3.5 h-3.5 text-emerald-600" />
                <span>แนบรูปภาพ</span>
              </button>
              <button
                type="button"
                disabled={isProcessingMedia}
                onClick={() => videoCameraRef.current?.click()}
                className="py-2 px-3 rounded-lg bg-purple-50 hover:bg-purple-100 border border-purple-300 text-purple-800 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Video className="w-3.5 h-3.5 text-purple-600" />
                <span>ถ่ายวิดีโอปิดงาน</span>
              </button>
              <button
                type="button"
                disabled={isProcessingMedia}
                onClick={() => videoFileRef.current?.click()}
                className="py-2 px-3 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-300 text-indigo-800 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Film className="w-3.5 h-3.5 text-indigo-600" />
                <span>แนบวิดีโอ</span>
              </button>
            </div>

            {isProcessingMedia && (
              <div className="text-[11px] text-purple-700 font-semibold text-center py-1">
                กำลังประมวลผลไฟล์รูปภาพ / วิดีโอ...
              </div>
            )}

            {closingPhotos.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-1">
                {closingPhotos.map((item, idx) => (
                  <MediaGridCard
                    key={item.id}
                    item={item}
                    index={idx}
                    compact
                    onPreview={setPreviewItem}
                    onDelete={handleRemoveDraftItem}
                  />
                ))}
              </div>
            )}
          </div>

          {/* 4. หมายเหตุปิดงาน */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              หมายเหตุเพิ่มเติม (หากมี)
            </label>
            <input
              type="text"
              value={notesInput}
              onChange={(e) => setNotesInput(e.target.value)}
              placeholder="เช่น เปลี่ยนอะไหล่แท้ รับประกันตามเงื่อนไข..."
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isProcessingMedia}
              className="px-5 py-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl shadow-md flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>บันทึกปิดงาน &amp; ลงตารางสรุป Excel</span>
            </button>
          </div>
        </form>
      </div>

      {/* Preview Image / Video Lightbox */}
      <MediaLightboxModal
        item={previewItem}
        caption={previewItem ? `ตัวอย่างไฟล์ปิดงาน คิว ${job.queueNumber}` : undefined}
        onClose={() => setPreviewItem(null)}
      />
    </div>
  );
};
