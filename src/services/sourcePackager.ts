import JSZip from 'jszip';
import { APP_VERSION, APP_REVISION, APP_RELEASE_DATE } from '../version';
import { rawCodeModules, mediaAssetUrls } from './rawSourceBundle';
import rawSourceBundleContent from './rawSourceBundle.ts?raw';

export interface BundledSourceFile {
  path: string;
  content: string;
  sizeBytes: number;
  category: 'src' | 'api' | 'public' | 'config';
}

export interface PackageVerificationInfo {
  packageJsonVersion: string;
  appVersion: string;
  appRevision: string;
  appReleaseDate: string;
  isVersionSynced: boolean;
  totalCodeFiles: number;
  srcFilesCount: number;
  apiFilesCount: number;
  configFilesCount: number;
  totalCodeBytes: number;
  mediaAssetsCount: number;
}

const PUBLIC_BINARY_ASSETS: Array<{ zipPath: string; fetchUrl: string }> = [
  { zipPath: 'public/pwa-192x192.png', fetchUrl: '/pwa-192x192.png' },
  { zipPath: 'public/pwa-512x512.png', fetchUrl: '/pwa-512x512.png' },
  { zipPath: 'public/pwa-maskable-512x512.png', fetchUrl: '/pwa-maskable-512x512.png' },
  { zipPath: 'public/apple-touch-icon.png', fetchUrl: '/apple-touch-icon.png' },
];

function normalizeZipPath(rawKey: string): string {
  return rawKey.replace(/^\/+/, '').replace(/\\/g, '/');
}

function classifyPath(zipPath: string): BundledSourceFile['category'] {
  if (zipPath.startsWith('src/')) return 'src';
  if (zipPath.startsWith('api/')) return 'api';
  if (zipPath.startsWith('public/')) return 'public';
  return 'config';
}

export function getBundledSourceFiles(): BundledSourceFile[] {
  const encoder = new TextEncoder();
  const list: BundledSourceFile[] = [];
  const seenPaths = new Set<string>();

  for (const [key, rawContent] of Object.entries(rawCodeModules)) {
    if (typeof rawContent !== 'string') continue;
    const zipPath = normalizeZipPath(key);
    seenPaths.add(zipPath);
    list.push({
      path: zipPath,
      content: rawContent,
      sizeBytes: encoder.encode(rawContent).byteLength,
      category: classifyPath(zipPath),
    });
  }

  // Ensure rawSourceBundle.ts itself (excluded by Vite's self-glob guard) is always included
  if (!seenPaths.has('src/services/rawSourceBundle.ts') && typeof rawSourceBundleContent === 'string') {
    list.push({
      path: 'src/services/rawSourceBundle.ts',
      content: rawSourceBundleContent,
      sizeBytes: encoder.encode(rawSourceBundleContent).byteLength,
      category: 'src',
    });
  }

  return list.sort((a, b) => a.path.localeCompare(b.path));
}

export function verifyPackageSnapshot(): PackageVerificationInfo {
  const files = getBundledSourceFiles();
  const pkgFile = files.find((f) => f.path === 'package.json');
  let packageJsonVersion = 'unknown';

  if (pkgFile) {
    try {
      const parsed = JSON.parse(pkgFile.content);
      if (parsed?.version) packageJsonVersion = String(parsed.version);
    } catch {}
  }

  const srcFilesCount = files.filter((f) => f.category === 'src').length;
  const apiFilesCount = files.filter((f) => f.category === 'api').length;
  const configFilesCount = files.filter((f) => f.category === 'config').length;
  const totalCodeBytes = files.reduce((sum, f) => sum + f.sizeBytes, 0);
  const mediaAssetsCount = Object.keys(mediaAssetUrls).length + PUBLIC_BINARY_ASSETS.length;

  return {
    packageJsonVersion,
    appVersion: APP_VERSION,
    appRevision: APP_REVISION,
    appReleaseDate: APP_RELEASE_DATE,
    isVersionSynced: packageJsonVersion === APP_VERSION,
    totalCodeFiles: files.length,
    srcFilesCount,
    apiFilesCount,
    configFilesCount,
    totalCodeBytes,
    mediaAssetsCount,
  };
}

export type ZipBuildStage =
  | 'verify'
  | 'collect_code'
  | 'collect_media'
  | 'compress'
  | 'validate_zip'
  | 'done';

export interface PreDownloadCheckReport {
  checkedAt: string;
  allPassed: boolean;
  versionSynced: boolean;
  packageJsonVersion: string;
  appVersion: string;
  appRevision: string;
  requiredFilesPresent: boolean;
  missingRequiredFiles: string[];
  serverCheckStatus: 'matched' | 'stale' | 'offline';
  serverVersion?: string;
  serverTimestamp?: string;
  codeChecksumSha256: string;
  totalFilesChecked: number;
  totalCodeBytes: number;
}

const REQUIRED_CORE_FILES = [
  'package.json',
  'index.html',
  'vite.config.ts',
  'tsconfig.json',
  'vercel.json',
  'firebase-applet-config.json',
  'server.ts',
  'api/health.ts',
  'api/sms/send.ts',
  'src/App.tsx',
  'src/main.tsx',
  'src/firebase.ts',
  'src/version.ts',
  'src/services/sourcePackager.ts',
  'src/services/rawSourceBundle.ts',
  'src/components/SourceCodeDownloadPage.tsx',
];

async function computeSha256Hex(data: ArrayBuffer | Uint8Array): Promise<string> {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const buf = data instanceof Uint8Array ? data.slice().buffer : data;
      const hashBuffer = await crypto.subtle.digest('SHA-256', buf);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch {}
  // Lightweight deterministic fallback hash if subtle crypto is unavailable
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let h1 = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    h1 ^= bytes[i];
    h1 = Math.imul(h1, 0x01000193);
  }
  return (h1 >>> 0).toString(16).padStart(8, '0');
}

export async function runPreDownloadVerification(): Promise<PreDownloadCheckReport> {
  const files = getBundledSourceFiles();
  const snapshot = verifyPackageSnapshot();

  const filePathsSet = new Set(files.map((f) => f.path));
  const missingRequiredFiles = REQUIRED_CORE_FILES.filter(
    (reqPath) => !filePathsSet.has(reqPath)
  );
  const requiredFilesPresent =
    missingRequiredFiles.length === 0 &&
    files.every((f) => f.sizeBytes > 0);

  // Compute deterministic SHA-256 checksum across all bundled source files
  const combinedSourceText = files
    .map((f) => `${f.path}:${f.sizeBytes}:${f.content}`)
    .join('\n');
  const encodedCombined = new TextEncoder().encode(combinedSourceText);
  const codeChecksumSha256 = await computeSha256Hex(encodedCombined);

  // Live freshness check against server /api/health (if running with Express backend)
  let serverCheckStatus: PreDownloadCheckReport['serverCheckStatus'] = 'offline';
  let serverVersion: string | undefined;
  let serverTimestamp: string | undefined;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(`/api/health?t=${Date.now()}`, {
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.ok) {
      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      if (contentType.includes('application/json')) {
        const data = await res.json();
        serverVersion = typeof data?.version === 'string' ? data.version : undefined;
        serverTimestamp = typeof data?.timestamp === 'string' ? data.timestamp : undefined;
        if (serverVersion && serverVersion !== APP_VERSION) {
          serverCheckStatus = 'stale';
        } else {
          serverCheckStatus = 'matched';
        }
      }
    }
  } catch {
    serverCheckStatus = 'offline';
  }

  const allPassed =
    snapshot.isVersionSynced &&
    requiredFilesPresent &&
    serverCheckStatus !== 'stale';

  return {
    checkedAt: new Date().toISOString(),
    allPassed,
    versionSynced: snapshot.isVersionSynced,
    packageJsonVersion: snapshot.packageJsonVersion,
    appVersion: snapshot.appVersion,
    appRevision: snapshot.appRevision,
    requiredFilesPresent,
    missingRequiredFiles,
    serverCheckStatus,
    serverVersion,
    serverTimestamp,
    codeChecksumSha256,
    totalFilesChecked: files.length,
    totalCodeBytes: snapshot.totalCodeBytes,
  };
}

export interface BuildZipResult {
  blob: Blob;
  filename: string;
  includedCodeFiles: number;
  includedMediaFiles: number;
  skippedMediaFiles: string[];
  zipSizeBytes: number;
  isZipHeaderValid: boolean;
  zipSha256: string;
  createdAt: string;
}

export async function buildClientSourceZip(options: {
  includeMediaAssets: boolean;
  onProgress?: (percent: number, label: string, stage: ZipBuildStage) => void;
}): Promise<BuildZipResult> {
  const { includeMediaAssets, onProgress } = options;
  const zip = new JSZip();
  const files = getBundledSourceFiles();

  onProgress?.(12, `กำลังรวบรวมไฟล์โค้ดล่าสุด ${files.length} ไฟล์...`, 'collect_code');

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    zip.file(file.path, file.content, { compression: 'DEFLATE' });
    if (i % 15 === 0) {
      const pct = 12 + Math.round(((i + 1) / Math.max(1, files.length)) * 16);
      onProgress?.(pct, `กำลังจัดเรียงโค้ดล่าสุด (${i + 1}/${files.length} ไฟล์)...`, 'collect_code');
    }
  }

  let includedMediaFiles = 0;
  const skippedMediaFiles: string[] = [];

  if (includeMediaAssets) {
    const mediaTasks: Array<{ zipPath: string; fetchUrl: string }> = [
      ...Object.entries(mediaAssetUrls).map(([key, url]) => ({
        zipPath: normalizeZipPath(key),
        fetchUrl: url,
      })),
      ...PUBLIC_BINARY_ASSETS,
    ];

    for (let i = 0; i < mediaTasks.length; i++) {
      const item = mediaTasks[i];
      const pct = 30 + Math.round(((i + 1) / Math.max(1, mediaTasks.length)) * 38);
      onProgress?.(pct, `กำลังรวมไฟล์รูปภาพ (${i + 1}/${mediaTasks.length})...`, 'collect_media');
      try {
        const res = await fetch(item.fetchUrl, { cache: 'no-store' });
        if (res.ok) {
          const buf = await res.arrayBuffer();
          zip.file(item.zipPath, buf, { compression: 'STORE' });
          includedMediaFiles++;
        } else {
          skippedMediaFiles.push(item.zipPath);
        }
      } catch {
        skippedMediaFiles.push(item.zipPath);
      }
    }
  }

  onProgress?.(72, 'กำลังบีบอัดไฟล์ .zip ในเบราว์เซอร์...', 'compress');

  const blob = await zip.generateAsync(
    {
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    },
    (meta) => {
      const pct = 72 + Math.round((meta.percent / 100) * 20);
      onProgress?.(pct, `กำลังบีบอัดข้อมูล (${Math.round(meta.percent)}%)...`, 'compress');
    }
  );

  onProgress?.(95, 'กำลังตรวจสอบความสมบูรณ์ของไฟล์ ZIP (PK Header & SHA-256)...', 'validate_zip');

  const zipBuffer = await blob.arrayBuffer();
  const headerBytes = new Uint8Array(zipBuffer.slice(0, 4));
  const isZipHeaderValid =
    headerBytes.length >= 4 && headerBytes[0] === 0x50 && headerBytes[1] === 0x4b;
  if (!isZipHeaderValid) {
    throw new Error('โครงสร้างไฟล์ .zip ที่สร้างขึ้นไม่สมบูรณ์ (Invalid PK header)');
  }
  const zipSha256 = await computeSha256Hex(zipBuffer);

  onProgress?.(100, 'ตรวจสอบเสร็จสิ้น พร้อมส่งดาวน์โหลดทันที!', 'done');

  const suffix = includeMediaAssets ? 'full' : 'code-lite';
  const filename = `onsite-repair-service-v${APP_VERSION}-${suffix}.zip`;

  return {
    blob,
    filename,
    includedCodeFiles: files.length,
    includedMediaFiles,
    skippedMediaFiles,
    zipSizeBytes: blob.size,
    isZipHeaderValid,
    zipSha256,
    createdAt: new Date().toISOString(),
  };
}

export function triggerFileDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export async function forceRefreshLatestVersion(): Promise<void> {
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.update().catch(() => {})));
    }
  } catch {}
  const url = new URL(window.location.href);
  url.searchParams.set('_cb', String(Date.now()));
  window.location.replace(url.toString());
}
