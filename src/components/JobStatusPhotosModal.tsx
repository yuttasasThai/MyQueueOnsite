// File: /src/components/JobStatusPhotosModal.tsx | Revision: Rev 17 | Version: 1.4.0 | Modified: 2026-11-15
import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  ImagePlus,
  X,
  Trash2,
  ZoomIn,
  Clock,
  Images,
  CheckCircle2,
} from 'lucide-react';
import { RepairJob, RepairStatus, StatusPhotoItem } from '../types';
import { filesToStatusPhotoItems, getTotalJobPhotosCount } from '../services/imageUtils';

const PHOTO_STATUS_TABS: RepairStatus[] = [
  'รับงาน',
  'กำลังไป',
  'กำลังซ่อม',
  'ซ่อมแล้ว',
  'ปิดงาน',
  'นัดหมายต่อ',
  'ยกเลิก',
];

interface JobStatusPhotosModalProps {
  job: RepairJob | null;
  initialStatus?: RepairStatus;
  onClose: () => void;
  onUpdateJobPhotos: (jobId: string, status: RepairStatus, photos: StatusPhotoItem[]) => void;
}

export const JobStatusPhotosModal: React.FC<JobStatusPhotosModalProps> = ({
  job,
  initialStatus,
  onClose,
  onUpdateJobPhotos,
}) => {
  const [activeStatus, setActiveStatus] = useState<RepairStatus>('รับงาน');
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<StatusPhotoItem | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (job) {
      setActiveStatus(initialStatus || job.status || 'รับงาน');
      setPreviewPhoto(null);
      setUploadNotice(null);
    }
  }, [job?.id, initialStatus]);

  if (!job) return null;

  const currentPhotos: StatusPhotoItem[] = job.statusPhotos?.[activeStatus] || [];
  const totalPhotos = getTotalJobPhotosCount(job);

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsProcessing(true);
    try {
      const newItems = await filesToStatusPhotoItems(files);
      if (newItems.length > 0) {
        const updated = [...currentPhotos, ...newItems];
        onUpdateJobPhotos(job.id, activeStatus, updated);
        setUploadNotice(`เพิ่มรูปในสถานะ "${activeStatus}" แล้ว ${newItems.length} รูป`);
        setTimeout(() => setUploadNotice(null), 2500);
      }
    } catch (err) {
      console.error('Failed to process photos:', err);
    } finally {
      setIsProcessing(false);
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  };

  const handleDeletePhoto = (photoId: string) => {
    const updated = currentPhotos.filter((p) => p.id !== photoId);
    onUpdateJobPhotos(job.id, activeStatus, updated);
    if (previewPhoto?.id === photoId) {
      setPreviewPhoto(null);
    }
  };

  const formatTimeLabel = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString('th-TH', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-4 sm:p-5 bg-slate-50 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Images className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 bg-slate-800 text-white rounded font-mono font-bold text-xs">
                  {job.queueNumber}
                </span>
                <h3 className="font-bold text-slate-900 text-sm sm:text-base truncate">
                  รูปถ่าย / แนบรูปแยกตามสถานะ
                </h3>
              </div>
              <p className="text-xs text-slate-500 truncate mt-0.5">
                {job.product} • ลูกค้า: {job.customer.name} (รวมทั้งหมด {totalPhotos} รูป)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Tabs Selector */}
        <div className="px-4 py-2.5 bg-white border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0">
          {PHOTO_STATUS_TABS.map((st) => {
            const count = job.statusPhotos?.[st]?.length || 0;
            const isActive = activeStatus === st;
            const isCurrentJobStatus = job.status === st;
            return (
              <button
                key={st}
                type="button"
                onClick={() => setActiveStatus(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 border cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : isCurrentJobStatus
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span>{st}</span>
                {count > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono tabular-nums ${
                      isActive
                        ? 'bg-white/25 text-white'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Body: Upload Actions + Photo Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Hidden Inputs for Camera & File Picker */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleFilesSelected(e.target.files)}
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFilesSelected(e.target.files)}
          />

          {/* Capture & Attach Buttons */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800">
                เพิ่มรูปสำหรับสถานะ: <span className="text-blue-700">&quot;{activeStatus}&quot;</span>
              </span>
              <span className="text-[11px] text-slate-500">
                มีแล้ว {currentPhotos.length} รูป
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => cameraInputRef.current?.click()}
                className="py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>{isProcessing ? 'กำลังประมวลผลรูป...' : 'ถ่ายรูปหน้างาน (เปิดกล้อง)'}</span>
              </button>

              <button
                type="button"
                disabled={isProcessing}
                onClick={() => galleryInputRef.current?.click()}
                className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                <ImagePlus className="w-4 h-4" />
                <span>แนบรูปภาพจากเครื่อง / คลังภาพ</span>
              </button>
            </div>

            {uploadNotice && (
              <div className="p-2 rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-semibold flex items-center gap-1.5 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>{uploadNotice}</span>
              </div>
            )}
          </div>

          {/* Photos Grid for Active Status */}
          {currentPhotos.length === 0 ? (
            <div className="py-10 px-4 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
              <Camera className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-xs sm:text-sm font-semibold text-slate-600">
                ยังไม่มีรูปภาพในสถานะ &quot;{activeStatus}&quot;
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                กดปุ่ม &quot;ถ่ายรูปหน้างาน&quot; หรือ &quot;แนบรูปภาพจากเครื่อง&quot; ด้านบนเพื่อบันทึกรูปเฉพาะคิว {job.queueNumber}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {currentPhotos.map((photo, index) => (
                <div
                  key={photo.id}
                  className="group relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shadow-2xs"
                >
                  <button
                    type="button"
                    onClick={() => setPreviewPhoto(photo)}
                    className="block w-full aspect-[4/3] overflow-hidden cursor-pointer focus:outline-none"
                    title="กดเพื่อดูรูปขนาดใหญ่"
                  >
                    <img
                      src={photo.dataUrl}
                      alt={`${job.queueNumber} ${activeStatus} ${index + 1}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  </button>

                  {/* Top-right Actions */}
                  <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPreviewPhoto(photo)}
                      className="p-1.5 rounded-lg bg-slate-900/70 hover:bg-slate-900 text-white transition-colors cursor-pointer"
                      title="ขยายดูรูป"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePhoto(photo.id)}
                      className="p-1.5 rounded-lg bg-red-600/85 hover:bg-red-700 text-white transition-colors cursor-pointer"
                      title="ลบรูปนี้"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Bottom Timestamp */}
                  <div className="px-2 py-1 bg-white border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500">
                    <span className="font-mono font-bold text-slate-700">#{index + 1}</span>
                    <span className="inline-flex items-center gap-1 truncate">
                      <Clock className="w-2.5 h-2.5 shrink-0" />
                      {formatTimeLabel(photo.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500">
            รูปถูกจัดเก็บแยกตามคิวและสถานะเรียบร้อยแล้ว (ไม่แสดงรกในตารางคิวงาน)
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>

      {/* Fullscreen Image Lightbox */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-[80] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setPreviewPhoto(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <button
              type="button"
              onClick={() => setPreviewPhoto(null)}
              className="absolute -top-10 right-0 p-2 text-white hover:text-slate-300 cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={previewPhoto.dataUrl}
              alt="ขยายรูปภาพ"
              className="max-w-full max-h-[82vh] rounded-xl object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="mt-2 text-xs text-slate-300 font-mono">
              คิว {job.queueNumber} • สถานะ &quot;{activeStatus}&quot; • {formatTimeLabel(previewPhoto.createdAt)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
