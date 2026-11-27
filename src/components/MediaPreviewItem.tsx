// File: /src/components/MediaPreviewItem.tsx | Revision: Rev 22 | Version: 1.5.3 | Modified: 2026-11-17
import React, { useEffect, useState } from 'react';
import { Film, Play, X, Trash2, ZoomIn, Clock } from 'lucide-react';
import { StatusPhotoItem } from '../types';
import { isVideoMediaItem } from '../services/imageUtils';
import {
  formatFileSize,
  formatVideoDuration,
  resolveMediaUrl,
} from '../services/mediaStorage';

interface MediaGridCardProps {
  item: StatusPhotoItem;
  index: number;
  compact?: boolean;
  onPreview: (item: StatusPhotoItem) => void;
  onDelete: (item: StatusPhotoItem) => void;
}

export const MediaGridCard: React.FC<MediaGridCardProps> = ({
  item,
  index,
  compact = false,
  onPreview,
  onDelete,
}) => {
  const isVideo = isVideoMediaItem(item);
  const previewSrc = isVideo ? item.thumbnailDataUrl || '' : item.dataUrl;
  const durationLabel = formatVideoDuration(item.durationSec);
  const sizeLabel = formatFileSize(item.sizeBytes);

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
    <div className="group relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shadow-2xs">
      <button
        type="button"
        onClick={() => onPreview(item)}
        className={`block w-full ${
          compact ? 'aspect-square' : 'aspect-[4/3]'
        } overflow-hidden cursor-pointer focus:outline-none relative bg-slate-900`}
        title={isVideo ? 'กดเพื่อเล่นวิดีโอ' : 'กดเพื่อดูรูปขนาดใหญ่'}
      >
        {previewSrc ? (
          <img
            src={previewSrc}
            alt={isVideo ? `วิดีโอ #${index + 1}` : `รูปที่ ${index + 1}`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 bg-slate-800 gap-1">
            <Film className="w-7 h-7" />
            <span className="text-[10px] font-medium">วิดีโอปิดงาน</span>
          </div>
        )}

        {isVideo && (
          <>
            <div className="absolute inset-0 bg-black/25 flex items-center justify-center group-hover:bg-black/35 transition-colors">
              <div className="w-10 h-10 rounded-full bg-white/90 text-slate-900 flex items-center justify-center shadow-lg">
                <Play className="w-5 h-5 fill-current ml-0.5" />
              </div>
            </div>
            <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-purple-700/90 text-white text-[9px] font-bold flex items-center gap-1 shadow-xs">
              <Film className="w-2.5 h-2.5" />
              <span>วิดีโอ{durationLabel ? ` ${durationLabel}` : ''}</span>
            </div>
          </>
        )}
      </button>

      {/* Top-right Actions */}
      <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
        {!compact && (
          <button
            type="button"
            onClick={() => onPreview(item)}
            className="p-1.5 rounded-lg bg-slate-900/75 hover:bg-slate-900 text-white transition-colors cursor-pointer"
            title={isVideo ? 'เล่นวิดีโอ' : 'ขยายดูรูป'}
          >
            {isVideo ? <Play className="w-3.5 h-3.5" /> : <ZoomIn className="w-3.5 h-3.5" />}
          </button>
        )}
        <button
          type="button"
          onClick={() => onDelete(item)}
          className="p-1.5 rounded-lg bg-red-600/85 hover:bg-red-700 text-white transition-colors cursor-pointer"
          title="ลบไฟล์นี้"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {!compact && (
        <div className="px-2 py-1 bg-white border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500">
          <span className="font-mono font-bold text-slate-700">
            #{index + 1}
            {isVideo && sizeLabel ? ` (${sizeLabel})` : ''}
          </span>
          <span className="inline-flex items-center gap-1 truncate">
            <Clock className="w-2.5 h-2.5 shrink-0" />
            {formatTimeLabel(item.createdAt)}
          </span>
        </div>
      )}
    </div>
  );
};

interface MediaLightboxModalProps {
  item: StatusPhotoItem | null;
  caption?: string;
  onClose: () => void;
}

export const MediaLightboxModal: React.FC<MediaLightboxModalProps> = ({
  item,
  caption,
  onClose,
}) => {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const isVideo = isVideoMediaItem(item);

  useEffect(() => {
    let active = true;
    let objectUrlToRevoke: string | null = null;

    if (!item) {
      setResolvedUrl(null);
      return;
    }

    if (!isVideo) {
      setResolvedUrl(item.dataUrl);
      return;
    }

    setIsLoading(true);
    resolveMediaUrl(item.dataUrl).then((res) => {
      if (!active) {
        if (res?.isObjectUrl) URL.revokeObjectURL(res.url);
        return;
      }
      if (res?.isObjectUrl) objectUrlToRevoke = res.url;
      setResolvedUrl(res?.url || null);
      setIsLoading(false);
    });

    return () => {
      active = false;
      if (objectUrlToRevoke) {
        try {
          URL.revokeObjectURL(objectUrlToRevoke);
        } catch {}
      }
    };
  }, [item?.id, item?.dataUrl, isVideo]);

  if (!item) return null;

  return (
    <div
      className="fixed inset-0 z-[90] bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="self-end mb-2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {isVideo ? (
          isLoading ? (
            <div className="p-10 text-white text-sm">กำลังโหลดวิดีโอ...</div>
          ) : resolvedUrl ? (
            <video
              src={resolvedUrl}
              poster={item.thumbnailDataUrl}
              controls
              autoPlay
              playsInline
              className="max-w-full max-h-[78vh] rounded-xl bg-black shadow-2xl"
            />
          ) : (
            <div className="p-6 rounded-xl bg-slate-800 text-slate-200 text-center space-y-2 max-w-md">
              <Film className="w-10 h-10 text-slate-400 mx-auto" />
              <p className="text-sm font-semibold">ไม่พบไฟล์วิดีโอบนอุปกรณ์นี้</p>
              <p className="text-xs text-slate-400">
                ไฟล์วิดีโอถูกบันทึกไว้ในหน่วยความจำของเบราว์เซอร์เครื่องที่อัปโหลด
              </p>
            </div>
          )
        ) : (
          <img
            src={resolvedUrl || item.dataUrl}
            alt="ขยายรูปภาพ"
            className="max-w-full max-h-[78vh] rounded-xl object-contain shadow-2xl"
          />
        )}

        {caption && (
          <div className="mt-2.5 text-xs text-slate-300 font-mono text-center">{caption}</div>
        )}
      </div>
    </div>
  );
};
