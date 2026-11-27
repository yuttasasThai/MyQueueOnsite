// File: /src/components/JobStatusPhotosModal.tsx | Revision: Rev 22 | Version: 1.5.3 | Modified: 2026-11-17
import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  ImagePlus,
  Video,
  Film,
  X,
  Images,
  CheckCircle2,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { RepairJob, RepairStatus, StatusPhotoItem } from '../types';
import {
  filesToStatusPhotoItems,
  getTotalJobPhotosCount,
  isVideoMediaItem,
} from '../services/imageUtils';
import { deleteMediaFromStore } from '../services/mediaStorage';
import { MediaGridCard, MediaLightboxModal } from './MediaPreviewItem';

const PHOTO_STATUS_TABS: RepairStatus[] = [
  'รับงาน',
  'กำลังไป',
  'กำลังซ่อม',
  'ซ่อมแล้ว',
  'ปิดงาน',
  'นัดหมายต่อ',
  'ยกเลิก',
];

const MULTI_PHOTO_RECOMMENDED_STATUSES: RepairStatus[] = ['กำลังซ่อม', 'ซ่อมแล้ว'];

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
  const [previewItem, setPreviewItem] = useState<StatusPhotoItem | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const videoCameraInputRef = useRef<HTMLInputElement>(null);
  const videoFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (job) {
      setActiveStatus(initialStatus || job.status || 'รับงาน');
      setPreviewItem(null);
      setUploadNotice(null);
      setUploadError(null);
    }
  }, [job?.id, initialStatus]);

  if (!job) return null;

  const currentItems: StatusPhotoItem[] = job.statusPhotos?.[activeStatus] || [];
  const totalMediaCount = getTotalJobPhotosCount(job);
  const isClosingStatus = activeStatus === 'ปิดงาน';
  const isMultiPhotoRecommended = MULTI_PHOTO_RECOMMENDED_STATUSES.includes(activeStatus);

  const photoCountInTab = currentItems.filter((item) => !isVideoMediaItem(item)).length;
  const videoCountInTab = currentItems.filter((item) => isVideoMediaItem(item)).length;

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsProcessing(true);
    setUploadError(null);
    try {
      const newItems = await filesToStatusPhotoItems(files, {
        allowVideo: isClosingStatus,
      });
      if (newItems.length > 0) {
        const updated = [...currentItems, ...newItems];
        onUpdateJobPhotos(job.id, activeStatus, updated);
        const addedVideos = newItems.filter((i) => isVideoMediaItem(i)).length;
        const addedPhotos = newItems.length - addedVideos;
        const parts: string[] = [];
        if (addedPhotos > 0) parts.push(`${addedPhotos} รูป`);
        if (addedVideos > 0) parts.push(`${addedVideos} วิดีโอ`);
        setUploadNotice(`เพิ่ม${parts.join(' และ ')}ในสถานะ "${activeStatus}" แล้ว`);
        setTimeout(() => setUploadNotice(null), 2800);
      } else {
        setUploadError(
          isClosingStatus
            ? 'กรุณาเลือกไฟล์รูปภาพหรือวิดีโอที่รองรับ'
            : 'สถานะนี้รองรับเฉพาะไฟล์รูปภาพ (วิดีโอเพิ่มได้ในสถานะ "ปิดงาน")'
        );
      }
    } catch (err: any) {
      console.error('Failed to process media:', err);
      setUploadError(err?.message || 'ไม่สามารถบันทึกไฟล์รูปภาพ/วิดีโอได้');
    } finally {
      setIsProcessing(false);
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (galleryInputRef.current) galleryInputRef.current.value = '';
      if (videoCameraInputRef.current) videoCameraInputRef.current.value = '';
      if (videoFileInputRef.current) videoFileInputRef.current.value = '';
    }
  };

  const handleDeleteItem = async (target: StatusPhotoItem) => {
    const updated = currentItems.filter((p) => p.id !== target.id);
    onUpdateJobPhotos(job.id, activeStatus, updated);
    if (previewItem?.id === target.id) {
      setPreviewItem(null);
    }
    if (isVideoMediaItem(target)) {
      await deleteMediaFromStore(target.dataUrl);
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
                  รูปถ่าย / วิดีโอแยกตามสถานะ
                </h3>
              </div>
              <p className="text-xs text-slate-500 truncate mt-0.5">
                {job.product} • ลูกค้า: {job.customer.name} (รวมทั้งหมด {totalMediaCount} ไฟล์)
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
                onClick={() => {
                  setActiveStatus(st);
                  setUploadError(null);
                  setUploadNotice(null);
                }}
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

        {/* Body: Upload Actions + Media Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Hidden Inputs for Photo Camera / Gallery */}
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

          {/* Hidden Inputs for Video Capture / File Picker (สถานะปิดงาน) */}
          <input
            ref={videoCameraInputRef}
            type="file"
            accept="video/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleFilesSelected(e.target.files)}
          />
          <input
            ref={videoFileInputRef}
            type="file"
            accept="video/*"
            multiple
            className="hidden"
            onChange={(e) => handleFilesSelected(e.target.files)}
          />

          {/* Capture & Attach Buttons */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-800">
                  สถานะ: <span className="text-blue-700">&quot;{activeStatus}&quot;</span>
                </span>
                {isMultiPhotoRecommended && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold">
                    เพิ่มได้ 2–3 รูป (แนะนำ)
                  </span>
                )}
                {isClosingStatus && (
                  <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-900 border border-purple-300 text-[10px] font-bold">
                    เพิ่มได้ทั้ง รูปภาพ + วิดีโอ
                  </span>
                )}
              </div>

              <span className="text-[11px] text-slate-500 font-mono">
                {isClosingStatus
                  ? `${photoCountInTab} รูป • ${videoCountInTab} วิดีโอ`
                  : `มีแล้ว ${photoCountInTab} รูป`}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => cameraInputRef.current?.click()}
                className="py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>
                  {isProcessing
                    ? 'กำลังประมวลผลไฟล์...'
                    : photoCountInTab > 0
                    ? `ถ่ายรูปเพิ่ม (รูปที่ ${photoCountInTab + 1})`
                    : 'ถ่ายรูปหน้างาน (เปิดกล้อง)'}
                </span>
              </button>

              <button
                type="button"
                disabled={isProcessing}
                onClick={() => galleryInputRef.current?.click()}
                className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                <ImagePlus className="w-4 h-4" />
                <span>
                  {isMultiPhotoRecommended
                    ? 'แนบหลายรูปพร้อมกัน (2–3 รูป)'
                    : 'แนบรูปภาพจากเครื่อง / คลังภาพ'}
                </span>
              </button>
            </div>

            {/* Extra Video Buttons specifically for 'ปิดงาน' */}
            {isClosingStatus && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-200/80">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => videoCameraInputRef.current?.click()}
                  className="py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                >
                  <Video className="w-4 h-4" />
                  <span>{isProcessing ? 'กำลังบันทึกวิดีโอ...' : 'ถ่ายวิดีโอปิดงาน'}</span>
                </button>

                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => videoFileInputRef.current?.click()}
                  className="py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                >
                  <Film className="w-4 h-4" />
                  <span>แนบวิดีโอจากเครื่อง</span>
                </button>
              </div>
            )}

            {uploadNotice && (
              <div className="p-2 rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-semibold flex items-center gap-1.5 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>{uploadNotice}</span>
              </div>
            )}

            {uploadError && (
              <div className="p-2 rounded-lg bg-rose-100 border border-rose-300 text-rose-900 text-xs font-semibold flex items-center gap-1.5 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}
          </div>

          {/* Interactive 3-Photo Slot Grid for กำลังซ่อม / ซ่อมแล้ว */}
          {isMultiPhotoRecommended ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {currentItems.map((item, index) => (
                <MediaGridCard
                  key={item.id}
                  item={item}
                  index={index}
                  onPreview={setPreviewItem}
                  onDelete={handleDeleteItem}
                />
              ))}

              {/* Show placeholder slots up to 3 photos (and always keep 1 quick "+ เพิ่มรูป" card if < 5) */}
              {Array.from({
                length: Math.max(
                  currentItems.length < 3 ? 3 - currentItems.length : 1,
                  0
                ),
              }).map((_, slotOffset) => {
                const slotNum = currentItems.length + slotOffset + 1;
                if (slotNum > 6) return null;
                return (
                  <button
                    key={`slot-${slotNum}`}
                    type="button"
                    disabled={isProcessing}
                    onClick={() => cameraInputRef.current?.click()}
                    className="aspect-[4/3] rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/60 bg-slate-50/70 flex flex-col items-center justify-center gap-1.5 text-slate-500 hover:text-blue-700 transition-all cursor-pointer p-2"
                  >
                    <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-2xs">
                      <Plus className="w-4 h-4" />
                    </div>
                    <span className="text-[11px] font-bold">
                      {slotNum <= 3 ? `ถ่าย/เพิ่มรูปที่ ${slotNum}` : 'เพิ่มรูปอีก'}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : currentItems.length === 0 ? (
            <div className="py-10 px-4 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
              <Camera className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-xs sm:text-sm font-semibold text-slate-600">
                {isClosingStatus
                  ? 'ยังไม่มีรูปภาพหรือวิดีโอในสถานะ "ปิดงาน"'
                  : `ยังไม่มีรูปภาพในสถานะ "${activeStatus}"`}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                {isClosingStatus
                  ? 'กดปุ่มด้านบนเพื่อถ่าย/แนบทั้งรูปภาพและวิดีโอตอนปิดงาน'
                  : `กดปุ่ม "ถ่ายรูปหน้างาน" หรือ "แนบรูปภาพจากเครื่อง" ด้านบนเพื่อบันทึกรูปเฉพาะคิว ${job.queueNumber}`}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {currentItems.map((item, index) => (
                <MediaGridCard
                  key={item.id}
                  item={item}
                  index={index}
                  onPreview={setPreviewItem}
                  onDelete={handleDeleteItem}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500">
            สื่อถูกจัดเก็บแยกตามคิวและสถานะเรียบร้อยแล้ว (ไม่แสดงรกในตารางคิวงาน)
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

      {/* Fullscreen Image / Video Lightbox */}
      <MediaLightboxModal
        item={previewItem}
        caption={
          previewItem
            ? `คิว ${job.queueNumber} • สถานะ "${activeStatus}" • ${formatTimeLabel(previewItem.createdAt)}`
            : undefined
        }
        onClose={() => setPreviewItem(null)}
      />
    </div>
  );
};
