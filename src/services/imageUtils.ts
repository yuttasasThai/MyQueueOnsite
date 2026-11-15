// File: /src/services/imageUtils.ts | Revision: Rev 17 | Version: 1.4.0 | Modified: 2026-11-15
import { RepairJob, RepairStatus, StatusPhotoItem } from '../types';

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

export async function filesToStatusPhotoItems(files: FileList): Promise<StatusPhotoItem[]> {
  const items: StatusPhotoItem[] = [];
  const fileArr = Array.from(files);
  for (let i = 0; i < fileArr.length; i++) {
    const file = fileArr[i];
    if (!file.type.startsWith('image/')) continue;
    const dataUrl = await compressImageFileToDataUrl(file);
    items.push({
      id: `photo-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      dataUrl,
      createdAt: new Date().toISOString(),
    });
  }
  return items;
}
