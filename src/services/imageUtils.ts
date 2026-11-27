// File: /src/services/imageUtils.ts | Revision: Rev 22 | Version: 1.5.3 | Modified: 2026-11-17
import { RepairJob, RepairStatus, StatusPhotoItem } from '../types';
import { saveVideoToMediaStore } from './mediaStorage';

export function isVideoMediaItem(item?: StatusPhotoItem | null): boolean {
  if (!item) return false;
  if (item.mediaType === 'video') return true;
  if (item.dataUrl?.startsWith('data:video/')) return true;
  if (item.dataUrl?.startsWith('idb://vid-')) return true;
  return false;
}

export function getTotalJobPhotosCount(job: RepairJob): number {
  if (!job.statusPhotos) return 0;
  return Object.values(job.statusPhotos).reduce(
    (sum, list) => sum + (Array.isArray(list) ? list.length : 0),
    0
  );
}

export function getStatusPhotosCount(job: RepairJob, status: RepairStatus): number {
  return job.statusPhotos?.[status]?.length || 0;
}

/**
 * Compress an uploaded or camera-captured image File into a compact JPEG Data URL
 * so multiple job photos fit comfortably inside browser localStorage.
 */
export function compressImageFileToDataUrl(
  file: File,
  maxDimension = 960,
  quality = 0.72
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์รูปภาพได้'));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('ข้อมูลรูปภาพไม่ถูกต้อง'));
        return;
      }

      const img = new Image();
      img.onerror = () => {
        // Fallback to raw dataUrl if browser cannot decode via Image
        resolve(result);
      };
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width >= height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(result);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        try {
          const compressed = canvas.toDataURL('image/jpeg', quality);
          resolve(compressed);
        } catch {
          resolve(result);
        }
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  });
}

function isVideoFile(file: File): boolean {
  if (file.type && file.type.startsWith('video/')) return true;
  const lower = (file.name || '').toLowerCase();
  return /\.(mp4|mov|webm|m4v|3gp|mkv|avi)$/.test(lower);
}

export async function filesToStatusPhotoItems(
  files: FileList,
  options?: { allowVideo?: boolean; maxItems?: number }
): Promise<StatusPhotoItem[]> {
  const items: StatusPhotoItem[] = [];
  const fileArr = Array.from(files);
  const limit = options?.maxItems ? Math.min(fileArr.length, options.maxItems) : fileArr.length;

  for (let i = 0; i < limit; i++) {
    const file = fileArr[i];
    if (file.type.startsWith('image/')) {
      const dataUrl = await compressImageFileToDataUrl(file);
      items.push({
        id: `photo-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        dataUrl,
        mediaType: 'image',
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        createdAt: new Date().toISOString(),
      });
    } else if (options?.allowVideo && isVideoFile(file)) {
      const saved = await saveVideoToMediaStore(file);
      items.push({
        id: `video-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        dataUrl: saved.mediaKey,
        mediaType: 'video',
        thumbnailDataUrl: saved.thumbnailDataUrl,
        durationSec: saved.durationSec,
        fileName: file.name,
        mimeType: file.type || 'video/mp4',
        sizeBytes: file.size,
        createdAt: new Date().toISOString(),
      });
    }
  }
  return items;
}
