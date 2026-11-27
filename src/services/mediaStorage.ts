// File: /src/services/mediaStorage.ts | Revision: Rev 22 | Version: 1.5.3 | Modified: 2026-11-17
// ระบบจัดเก็บวิดีโอใน IndexedDB เพื่อให้แนบวิดีโอตอนปิดงานได้โดยไม่ทำให้ localStorage เต็ม

const MEDIA_DB_NAME = 'myqueue_onsite_media_v1';
const MEDIA_STORE_NAME = 'media_blobs';
const MEDIA_DB_VERSION = 1;
const IDB_PREFIX = 'idb://';
const MAX_VIDEO_SIZE_BYTES = 80 * 1024 * 1024; // 80 MB

interface StoredMediaRecord {
  id: string;
  blob: Blob;
  mimeType: string;
  fileName: string;
  sizeBytes: number;
  createdAt: string;
}

function openMediaDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('เบราว์เซอร์ไม่รองรับ IndexedDB สำหรับจัดเก็บวิดีโอ'));
      return;
    }
    const req = indexedDB.open(MEDIA_DB_NAME, MEDIA_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(MEDIA_STORE_NAME)) {
        db.createObjectStore(MEDIA_STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('เปิดฐานข้อมูลวิดีโอไม่สำเร็จ'));
  });
}

export function isIdbMediaRef(value?: string): boolean {
  return typeof value === 'string' && value.startsWith(IDB_PREFIX);
}

/**
 * Capture a lightweight JPEG poster thumbnail and duration from a video File.
 */
export function extractVideoMetadata(
  file: File
): Promise<{ thumbnailDataUrl?: string; durationSec?: number }> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined' || typeof URL === 'undefined') {
      resolve({});
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.src = objectUrl;

    let finished = false;
    const cleanup = () => {
      if (finished) return;
      finished = true;
      try {
        URL.revokeObjectURL(objectUrl);
      } catch {}
    };

    const timer = window.setTimeout(() => {
      cleanup();
      resolve({
        durationSec: isFinite(video.duration) && video.duration > 0 ? Math.round(video.duration) : undefined,
      });
    }, 3500);

    const captureFrame = () => {
      try {
        const durationSec =
          isFinite(video.duration) && video.duration > 0 ? Math.round(video.duration) : undefined;
        const vw = video.videoWidth || 480;
        const vh = video.videoHeight || 270;
        const maxDim = 480;
        let width = vw;
        let height = vh;
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');
        if (ctx && video.videoWidth > 0 && video.videoHeight > 0) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.68);
          window.clearTimeout(timer);
          cleanup();
          resolve({ thumbnailDataUrl, durationSec });
          return;
        }
        window.clearTimeout(timer);
        cleanup();
        resolve({ durationSec });
      } catch {
        window.clearTimeout(timer);
        cleanup();
        resolve({});
      }
    };

    video.onloadedmetadata = () => {
      const targetTime =
        isFinite(video.duration) && video.duration > 0.6 ? 0.3 : 0;
      try {
        video.currentTime = targetTime;
      } catch {
        captureFrame();
      }
    };

    video.onseeked = () => {
      captureFrame();
    };

    video.onloadeddata = () => {
      // Fallback if seek event doesn't fire on some mobile codecs
      window.setTimeout(() => {
        if (!finished) captureFrame();
      }, 450);
    };

    video.onerror = () => {
      window.clearTimeout(timer);
      cleanup();
      resolve({});
    };
  });
}

/**
 * Store a video File Blob inside IndexedDB and return its reference key + thumbnail.
 */
export async function saveVideoToMediaStore(file: File): Promise<{
  mediaKey: string;
  thumbnailDataUrl?: string;
  durationSec?: number;
}> {
  if (file.size > MAX_VIDEO_SIZE_BYTES) {
    throw new Error('ไฟล์วิดีโอมีขนาดใหญ่เกิน 80 MB กรุณาเลือกวิดีโอที่สั้นลง');
  }

  const meta = await extractVideoMetadata(file);
  const id = `vid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    const db = await openMediaDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(MEDIA_STORE_NAME, 'readwrite');
      const store = tx.objectStore(MEDIA_STORE_NAME);
      const record: StoredMediaRecord = {
        id,
        blob: file,
        mimeType: file.type || 'video/mp4',
        fileName: file.name || `${id}.mp4`,
        sizeBytes: file.size,
        createdAt: new Date().toISOString(),
      };
      store.put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('บันทึกวิดีโอลงฐานข้อมูลไม่สำเร็จ'));
    });
    db.close();
    return {
      mediaKey: `${IDB_PREFIX}${id}`,
      thumbnailDataUrl: meta.thumbnailDataUrl,
      durationSec: meta.durationSec,
    };
  } catch (err) {
    // Fallback for tiny videos (< 1.5MB) if IndexedDB is unavailable
    if (file.size <= 1.5 * 1024 * 1024) {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
          typeof reader.result === 'string'
            ? resolve(reader.result)
            : reject(new Error('อ่านไฟล์วิดีโอไม่สำเร็จ'));
        reader.onerror = () => reject(new Error('อ่านไฟล์วิดีโอไม่สำเร็จ'));
        reader.readAsDataURL(file);
      });
      return {
        mediaKey: dataUrl,
        thumbnailDataUrl: meta.thumbnailDataUrl,
        durationSec: meta.durationSec,
      };
    }
    throw err;
  }
}

/**
 * Resolve an `idb://...` key or Data URL into a playable src URL.
 * Caller should revoke Object URLs created from `blob:` when unmounting.
 */
export async function resolveMediaUrl(
  dataUrlOrKey: string
): Promise<{ url: string; isObjectUrl: boolean } | null> {
  if (!dataUrlOrKey) return null;
  if (!isIdbMediaRef(dataUrlOrKey)) {
    return { url: dataUrlOrKey, isObjectUrl: false };
  }

  const id = dataUrlOrKey.slice(IDB_PREFIX.length);
  try {
    const db = await openMediaDatabase();
    const record = await new Promise<StoredMediaRecord | undefined>((resolve, reject) => {
      const tx = db.transaction(MEDIA_STORE_NAME, 'readonly');
      const store = tx.objectStore(MEDIA_STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result as StoredMediaRecord | undefined);
      req.onerror = () => reject(req.error);
    });
    db.close();
    if (!record?.blob) return null;
    const url = URL.createObjectURL(record.blob);
    return { url, isObjectUrl: true };
  } catch (err) {
    console.warn('Failed to resolve video from IndexedDB:', err);
    return null;
  }
}

export async function deleteMediaFromStore(dataUrlOrKey?: string): Promise<void> {
  if (!dataUrlOrKey || !isIdbMediaRef(dataUrlOrKey)) return;
  const id = dataUrlOrKey.slice(IDB_PREFIX.length);
  try {
    const db = await openMediaDatabase();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(MEDIA_STORE_NAME, 'readwrite');
      tx.objectStore(MEDIA_STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    db.close();
  } catch {
    // ignore cleanup error
  }
}

export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatVideoDuration(sec?: number): string {
  if (!sec || sec <= 0) return '';
  const mins = Math.floor(sec / 60);
  const rem = sec % 60;
  return `${mins}:${String(rem).padStart(2, '0')}`;
}
