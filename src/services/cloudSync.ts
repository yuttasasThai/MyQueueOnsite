import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  Unsubscribe,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { INITIAL_SHOP_SETTINGS } from '../data/initialData';
import {
  LineNotifySettings,
  RenewalCode,
  RepairJob,
  RepairStatus,
  ShopSettings,
  SmsNotifySettings,
  SmsProvider,
  StatusPhotoItem,
  StatusPhotosMap,
  UserAccount,
} from '../types';

export const BOOTSTRAPPED_ADMIN_EMAIL = 'yuttasas.54@gmail.com';
export const ADMIN_MASTER_WORKSPACE_ID = 'admin_master';

const VALID_ID_REGEX = /^[a-zA-Z0-9_-]+$/;
const VALID_STATUSES: RepairStatus[] = [
  'รับงาน',
  'กำลังไป',
  'กำลังซ่อม',
  'ซ่อมแล้ว',
  'ปิดงาน',
  'นัดหมายต่อ',
  'ยกเลิก',
];

const DELETED_JOBS_TOMBSTONE_KEY = 'myqueue_deleted_job_ids_v1';
const SETTINGS_LOCAL_KEY = 'repair_onsite_settings_v1';
const JOBS_LOCAL_KEY = 'repair_onsite_jobs_v1';
const USERS_LOCAL_KEY = 'repair_onsite_users_v1';

export interface CloudSessionContext {
  uid: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
  isBootstrappedAdmin: boolean;
  workspaceId: string;
  linkedUserId?: string;
  linkedUsername?: string;
}

export interface CloudWorkspaceSnapshot {
  settings: ShopSettings | null;
  jobs: RepairJob[];
  accounts: UserAccount[];
  linkedUserId?: string;
  linkedUsername?: string;
  hasCloudData: boolean;
}

// Track existing document createdAt Timestamps to satisfy Firestore rule:
// incoming().createdAt == existing().createdAt && incoming().updatedAt == request.time
const createdAtCache = new Map<string, Timestamp>();

// Cache uploaded/synced media signatures to avoid unnecessary updates to immutable media docs
const syncedMediaMetaCache = new Map<
  string,
  { jobId: string; jobStatus: RepairStatus; note?: string }
>();

function clip(val: unknown, maxLen: number, fallback = ''): string {
  const str = typeof val === 'string' ? val : val == null ? fallback : String(val);
  return str.length > maxLen ? str.slice(0, maxLen) : str;
}

function nonEmptyClip(val: unknown, maxLen: number, fallback: string): string {
  const str = clip(val, maxLen).trim();
  return str.length > 0 ? str : fallback.slice(0, maxLen);
}

export function sanitizeDocId(rawId: unknown, prefix = 'id'): string {
  const base = typeof rawId === 'string' ? rawId.trim() : '';
  const cleaned = base.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  if (cleaned.length > 0 && VALID_ID_REGEX.test(cleaned)) {
    return cleaned;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function normalizeStatus(status: unknown): RepairStatus {
  if (typeof status === 'string' && VALID_STATUSES.includes(status as RepairStatus)) {
    return status as RepairStatus;
  }
  return 'รับงาน';
}

export function isBootstrappedAdminEmail(email?: string | null): boolean {
  return (email || '').trim().toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL;
}

export function isQuotaExceededError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.toLowerCase().includes('quota exceeded') ||
    msg.toLowerCase().includes('resource-exhausted')
  );
}

export function loadDeletedJobTombstones(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_JOBS_TOMBSTONE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.map((x) => String(x))) : new Set();
  } catch {
    return new Set();
  }
}

export function markJobDeletedTombstone(jobId: string): void {
  try {
    const set = loadDeletedJobTombstones();
    set.add(jobId);
    const trimmed = Array.from(set).slice(-500);
    localStorage.setItem(DELETED_JOBS_TOMBSTONE_KEY, JSON.stringify(trimmed));
  } catch {}
}

export function removeJobDeletedTombstone(jobId: string): void {
  try {
    const set = loadDeletedJobTombstones();
    if (set.delete(jobId)) {
      localStorage.setItem(DELETED_JOBS_TOMBSTONE_KEY, JSON.stringify(Array.from(set)));
    }
  } catch {}
}

/**
 * Ensures image Data URL fits safely within Firestore blueprint field limit (default <= 330KB)
 * so multi-photo jobs and custom cover images never hit the 1 MiB document or field maxLength cap.
 */
async function shrinkDataUrlForFirestore(
  dataUrl: string,
  maxChars = 330000
): Promise<string> {
  if (!dataUrl || dataUrl.length <= maxChars) return dataUrl;
  if (!dataUrl.startsWith('data:image/')) {
    return dataUrl.slice(0, maxChars);
  }
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return '';
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onerror = () => resolve('');
    img.onload = () => {
      try {
        const steps: Array<{ maxDim: number; quality: number }> = [
          { maxDim: 800, quality: 0.64 },
          { maxDim: 640, quality: 0.52 },
          { maxDim: 480, quality: 0.42 },
          { maxDim: 360, quality: 0.34 },
        ];
        for (const step of steps) {
          let { width, height } = img;
          if (width > step.maxDim || height > step.maxDim) {
            if (width >= height) {
              height = Math.max(1, Math.round((height * step.maxDim) / width));
              width = step.maxDim;
            } else {
              width = Math.max(1, Math.round((width * step.maxDim) / height));
              height = step.maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, width);
          canvas.height = Math.max(1, height);
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const compressed = canvas.toDataURL('image/jpeg', step.quality);
          if (compressed.length <= maxChars) {
            resolve(compressed);
            return;
          }
        }
        resolve('');
      } catch {
        resolve('');
      }
    };
    img.src = dataUrl;
  });
}

function removeUndefinedFields<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      out[k] = v;
    }
  }
  return out as T;
}

async function getCachedOrRemoteCreatedAt(
  path: string
): Promise<{ exists: boolean; createdAt: Timestamp | null; data: Record<string, unknown> | null }> {
  const cached = createdAtCache.get(path);
  try {
    const snap = await getDoc(doc(db, path));
    if (snap.exists()) {
      const data = snap.data() as Record<string, unknown>;
      if (data.createdAt instanceof Timestamp) {
        createdAtCache.set(path, data.createdAt);
        return { exists: true, createdAt: data.createdAt, data };
      }
      if (cached) {
        return { exists: true, createdAt: cached, data };
      }
      return { exists: true, createdAt: null, data };
    }
    createdAtCache.delete(path);
    return { exists: false, createdAt: null, data: null };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

async function upsertDocWithTimestamps(
  path: string,
  buildPayload: (isCreate: boolean, existingCreatedAt: Timestamp | null, existingData: Record<string, unknown> | null) => Record<string, unknown> | null
): Promise<void> {
  const existing = await getCachedOrRemoteCreatedAt(path);
  const payload = buildPayload(!existing.exists, existing.createdAt, existing.data);
  if (!payload) return;

  const cleanPayload = removeUndefinedFields({
    ...payload,
    createdAt:
      existing.exists && existing.createdAt ? existing.createdAt : serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  try {
    await setDoc(doc(db, path), cleanPayload);
  } catch (error) {
    handleFirestoreError(
      error,
      existing.exists ? OperationType.UPDATE : OperationType.CREATE,
      path
    );
  }

  // Refresh cache of server-assigned createdAt when newly created
  if (!existing.exists) {
    try {
      const createdSnap = await getDoc(doc(db, path));
      const ts = createdSnap.data()?.createdAt;
      if (ts instanceof Timestamp) {
        createdAtCache.set(path, ts);
      }
    } catch {
      // Non-fatal cache warmup failure
    }
  }
}

async function buildShopSettingsDocData(
  settings: ShopSettings,
  ownerUid: string
): Promise<Record<string, unknown>> {
  const rawCover = clip(settings.coverImage, 340000);
  const safeCoverImage =
    rawCover.startsWith('data:image/')
      ? await shrinkDataUrlForFirestore(rawCover, 340000)
      : clip(settings.coverImage, 340000);

  const safeCategories = Array.isArray(settings.repairCategories)
    ? settings.repairCategories
        .filter((c) => typeof c === 'string' && c.trim().length > 0)
        .slice(0, 50)
        .map((c) => clip(c.trim(), 100))
    : [];

  const safeTechnicians = Array.isArray(settings.technicians)
    ? settings.technicians
        .filter((t) => typeof t === 'string' && t.trim().length > 0)
        .slice(0, 50)
        .map((t) => clip(t.trim(), 100))
    : [];

  const ln = settings.lineNotify;
  const lineProvider =
    ln?.provider === 'line_notify' ? 'line_notify' : 'messaging_api';
  const lineSendMode = ln?.sendMode === 'broadcast' ? 'broadcast' : 'push';

  const sms = settings.smsNotify;
  const smsProvider: SmsProvider =
    sms?.provider === 'thaibulksms' || sms?.provider === 'twilio' || sms?.provider === 'webhook'
      ? sms.provider
      : 'device_sms';

  return removeUndefinedFields({
    ownerUid,
    shopName: clip(settings.shopName ?? '', 200),
    phone: clip(settings.phone ?? '', 60),
    lineId: clip(settings.lineId ?? '', 120),
    lineUrl: clip(settings.lineUrl ?? '', 400),
    facebook: clip(settings.facebook ?? '', 200),
    facebookUrl: clip(settings.facebookUrl ?? '', 400),
    address: clip(settings.address ?? '', 500),
    coverImage: safeCoverImage,
    coverTitle: clip(settings.coverTitle ?? '', 150),
    coverSubtitle: clip(settings.coverSubtitle ?? '', 200),
    repairCategories: safeCategories,
    technicians: safeTechnicians,
    lineEnabled: Boolean(ln?.enabled),
    lineProvider,
    lineSendMode,
    notifyOnNewJob: ln?.notifyOnNewJob !== false,
    notifyOnStatusChange: ln?.notifyOnStatusChange !== false,
    notifyBefore30Min: ln?.notifyBefore30Min !== false,
    repeatIntervalMinutes: Math.max(1, Number(ln?.repeatIntervalMinutes) || 2),
    includeCustomerPhone: ln?.includeCustomerPhone !== false,
    includeMapLink: ln?.includeMapLink !== false,
    smsEnabled: sms?.enabled !== false,
    smsProvider,
    smsOnlyWhenNoCustomerLine: sms?.onlyWhenNoCustomerLine !== false,
    smsAutoSendOnCreate: sms?.autoSendOnCreate !== false,
    smsAutoSendOnStatusChange: sms?.autoSendOnStatusChange !== false,
    smsSenderName: clip(sms?.senderName ?? '', 60),
    smsNotifyOnNewJob: sms?.notifyOnNewJob !== false,
    smsNotifyOnStatusChange: sms?.notifyOnStatusChange !== false,
    smsNotifyOnReschedule: sms?.notifyOnReschedule !== false,
    smsIncludeShopPhone: sms?.includeShopPhone !== false,
    smsIncludeMapLink: Boolean(sms?.includeMapLink),
  });
}

function buildWorkspaceSecretsDocData(
  settings: ShopSettings,
  ownerUid: string
): Record<string, unknown> {
  const ln = settings.lineNotify;
  const sms = settings.smsNotify;
  return removeUndefinedFields({
    ownerUid,
    adminPassword: clip(settings.adminPassword ?? '', 120),
    adminSecretToken: clip(settings.adminSecretToken ?? '', 160),
    lineToken: clip(ln?.token ?? '', 500),
    lineChannelAccessToken: clip(ln?.channelAccessToken ?? '', 500),
    lineChannelSecret: clip(ln?.channelSecret ?? '', 200),
    lineTargetId: clip(ln?.targetId ?? '', 120),
    smsApiKey: clip(sms?.apiKey ?? '', 300),
    smsApiSecret: clip(sms?.apiSecret ?? '', 300),
    smsWebhookUrl: clip(sms?.webhookUrl ?? '', 500),
  });
}

function buildRepairJobDocData(
  job: RepairJob,
  docId: string,
  ownerUid: string
): Record<string, unknown> {
  const safeActualCost =
    job.actualCost !== null &&
    job.actualCost !== undefined &&
    Number.isFinite(Number(job.actualCost))
      ? Math.max(0, Number(job.actualCost))
      : null;

  return removeUndefinedFields({
    id: docId,
    ownerUid,
    queueNumber: nonEmptyClip(job.queueNumber, 40, 'Q-00'),
    loggedDate: clip(job.loggedDate ?? '', 40),
    product: nonEmptyClip(job.product, 200, 'งานซ่อม'),
    productCategory: clip(job.productCategory ?? '', 120),
    jobDetails: clip(job.jobDetails ?? '', 1000),
    symptoms: clip(job.symptoms ?? '', 1000),
    customerName: nonEmptyClip(job.customer?.name, 160, 'ลูกค้า'),
    customerPhone: clip(job.customer?.phone ?? '', 60),
    customerLineId: clip(job.customer?.lineId ?? '', 120),
    customerFacebook: clip(job.customer?.facebook ?? '', 160),
    customerAddress: clip(job.customer?.address ?? '', 500),
    customerMapCoordinates: clip(job.customer?.mapCoordinates ?? '', 100),
    appointmentDate: clip(job.appointmentDate ?? '', 40),
    appointmentTime: clip(job.appointmentTime ?? '', 80),
    estimatedCost: Math.max(0, Number(job.estimatedCost) || 0),
    actualCost: safeActualCost,
    status: normalizeStatus(job.status),
    warrantyDays: Math.max(0, Number(job.warrantyDays) || 0),
    warrantyStartDate: clip(job.warrantyStartDate ?? '', 40),
    warrantyEndDate: clip(job.warrantyEndDate ?? '', 40),
    assignedUserId: clip(job.assignedUserId ?? '', 128),
    assignedUserName: clip(job.assignedUserName ?? '', 160),
    closedAt: clip(job.closedAt ?? '', 40),
    cancelReason: clip(job.cancelReason ?? '', 500),
    notes: clip(job.notes ?? '', 1500),
  });
}

function encodeRenewalCodesSummary(list?: RenewalCode[]): string {
  if (!Array.isArray(list) || list.length === 0) return '[]';
  const compact = list.slice(0, 60).map((c) => ({
    c: clip(c.code, 60),
    d: Number(c.daysToAdd) || 30,
    u: Boolean(c.isUsed),
    at: c.usedAt ? clip(c.usedAt, 40) : undefined,
  }));
  let serialized = JSON.stringify(compact);
  while (serialized.length > 3900 && compact.length > 0) {
    compact.pop();
    serialized = JSON.stringify(compact);
  }
  return clip(serialized, 4000);
}

function decodeRenewalCodesSummary(raw?: string): RenewalCode[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        if (item && typeof item.c === 'string') {
          return {
            code: item.c,
            daysToAdd: Number(item.d) || 30,
            isUsed: Boolean(item.u),
            usedAt: typeof item.at === 'string' ? item.at : undefined,
          } as RenewalCode;
        }
        if (item && typeof item.code === 'string') {
          return item as RenewalCode;
        }
        return null;
      })
      .filter((x): x is RenewalCode => x !== null);
  } catch {
    return [];
  }
}

function buildUserAccountDocData(
  account: UserAccount,
  docId: string,
  ownerUid: string
): Record<string, unknown> {
  return removeUndefinedFields({
    id: docId,
    ownerUid,
    name: nonEmptyClip(account.name, 160, 'ผู้ใช้งาน'),
    phone: clip(account.phone ?? '', 60),
    username: nonEmptyClip(account.username, 80, docId),
    password: clip(account.password ?? '', 120),
    role: account.role === 'admin' ? 'admin' : 'user',
    linkToken: nonEmptyClip(account.linkToken, 128, docId),
    userLink: clip(account.userLink ?? '', 600),
    expiresAt: nonEmptyClip(account.expiresAt, 60, new Date().toISOString()),
    renewalCode: clip(account.renewalCode ?? '', 120),
    renewalCodesSummary: encodeRenewalCodesSummary(account.renewalCodesList),
    accountCreatedAt: clip(account.createdAt ?? new Date().toISOString(), 60),
    notes: clip(account.notes ?? '', 500),
  });
}

function parseCloudSettings(
  settingsData: Record<string, unknown> | null,
  secretsData: Record<string, unknown> | null
): ShopSettings | null {
  if (!settingsData) return null;
  const lineNotify: LineNotifySettings = {
    enabled: Boolean(settingsData.lineEnabled),
    provider:
      settingsData.lineProvider === 'line_notify' ? 'line_notify' : 'messaging_api',
    token: clip(secretsData?.lineToken ?? '', 500),
    channelAccessToken: clip(secretsData?.lineChannelAccessToken ?? '', 500),
    channelSecret: clip(secretsData?.lineChannelSecret ?? '', 200),
    targetId: clip(secretsData?.lineTargetId ?? '', 120),
    sendMode: settingsData.lineSendMode === 'broadcast' ? 'broadcast' : 'push',
    notifyOnNewJob: settingsData.notifyOnNewJob !== false,
    notifyOnStatusChange: settingsData.notifyOnStatusChange !== false,
    notifyBefore30Min: settingsData.notifyBefore30Min !== false,
    repeatIntervalMinutes: Math.max(1, Number(settingsData.repeatIntervalMinutes) || 2),
    includeCustomerPhone: settingsData.includeCustomerPhone !== false,
    includeMapLink: settingsData.includeMapLink !== false,
  };

  const smsProviderRaw = settingsData.smsProvider;
  const smsProvider: SmsProvider =
    smsProviderRaw === 'thaibulksms' || smsProviderRaw === 'twilio' || smsProviderRaw === 'webhook'
      ? smsProviderRaw
      : 'device_sms';

  const smsNotify: SmsNotifySettings = {
    enabled: settingsData.smsEnabled !== false,
    provider: smsProvider,
    onlyWhenNoCustomerLine: settingsData.smsOnlyWhenNoCustomerLine !== false,
    autoSendOnCreate: settingsData.smsAutoSendOnCreate !== false,
    autoSendOnStatusChange: settingsData.smsAutoSendOnStatusChange !== false,
    senderName: clip(settingsData.smsSenderName ?? '', 60),
    apiKey: clip(secretsData?.smsApiKey ?? '', 300),
    apiSecret: clip(secretsData?.smsApiSecret ?? '', 300),
    webhookUrl: clip(secretsData?.smsWebhookUrl ?? '', 500),
    notifyOnNewJob: settingsData.smsNotifyOnNewJob !== false,
    notifyOnStatusChange: settingsData.smsNotifyOnStatusChange !== false,
    notifyOnReschedule: settingsData.smsNotifyOnReschedule !== false,
    includeShopPhone: settingsData.smsIncludeShopPhone !== false,
    includeMapLink: Boolean(settingsData.smsIncludeMapLink),
  };

  return {
    ...INITIAL_SHOP_SETTINGS,
    shopName: typeof settingsData.shopName === 'string' ? settingsData.shopName : '',
    phone: typeof settingsData.phone === 'string' ? settingsData.phone : '',
    lineId: typeof settingsData.lineId === 'string' ? settingsData.lineId : '',
    lineUrl: typeof settingsData.lineUrl === 'string' ? settingsData.lineUrl : '',
    facebook: typeof settingsData.facebook === 'string' ? settingsData.facebook : '',
    facebookUrl:
      typeof settingsData.facebookUrl === 'string' ? settingsData.facebookUrl : '',
    address: typeof settingsData.address === 'string' ? settingsData.address : '',
    coverImage:
      typeof settingsData.coverImage === 'string'
        ? settingsData.coverImage
        : INITIAL_SHOP_SETTINGS.coverImage,
    coverTitle:
      typeof settingsData.coverTitle === 'string' ? settingsData.coverTitle : '',
    coverSubtitle:
      typeof settingsData.coverSubtitle === 'string'
        ? settingsData.coverSubtitle
        : '',
    repairCategories: Array.isArray(settingsData.repairCategories)
      ? settingsData.repairCategories.filter((x): x is string => typeof x === 'string')
      : [],
    technicians: Array.isArray(settingsData.technicians)
      ? settingsData.technicians.filter((x): x is string => typeof x === 'string')
      : [],
    adminPassword:
      typeof secretsData?.adminPassword === 'string' && secretsData.adminPassword
        ? secretsData.adminPassword
        : INITIAL_SHOP_SETTINGS.adminPassword,
    adminSecretToken:
      typeof secretsData?.adminSecretToken === 'string' && secretsData.adminSecretToken
        ? secretsData.adminSecretToken
        : INITIAL_SHOP_SETTINGS.adminSecretToken,
    lineNotify,
    smsNotify,
  };
}

function assembleJobsWithMedia(
  jobDocs: Array<Record<string, unknown>>,
  mediaDocs: Array<Record<string, unknown>>
): RepairJob[] {
  const mediaByJobId = new Map<string, StatusPhotosMap>();

  for (const m of mediaDocs) {
    const jobId = typeof m.jobId === 'string' ? m.jobId : '';
    const mediaId = typeof m.id === 'string' ? m.id : '';
    if (!jobId || !mediaId) continue;

    const status = normalizeStatus(m.jobStatus);
    const item: StatusPhotoItem = {
      id: mediaId,
      dataUrl: typeof m.dataUrl === 'string' ? m.dataUrl : '',
      mediaType: m.mediaType === 'video' ? 'video' : 'image',
      thumbnailDataUrl:
        typeof m.thumbnailDataUrl === 'string' && m.thumbnailDataUrl
          ? m.thumbnailDataUrl
          : undefined,
      fileName: typeof m.fileName === 'string' ? m.fileName : undefined,
      mimeType: typeof m.mimeType === 'string' ? m.mimeType : undefined,
      sizeBytes: typeof m.sizeBytes === 'number' ? m.sizeBytes : undefined,
      durationSec: typeof m.durationSec === 'number' ? m.durationSec : undefined,
      createdAt:
        typeof m.itemCreatedAt === 'string' && m.itemCreatedAt
          ? m.itemCreatedAt
          : new Date().toISOString(),
      note: typeof m.note === 'string' && m.note ? m.note : undefined,
    };

    const existingMap = mediaByJobId.get(jobId) || {};
    const listForStatus = existingMap[status] || [];
    listForStatus.push(item);
    existingMap[status] = listForStatus;
    mediaByJobId.set(jobId, existingMap);

    syncedMediaMetaCache.set(mediaId, {
      jobId,
      jobStatus: status,
      note: item.note,
    });
  }

  return jobDocs.map((d) => {
    const id = String(d.id || '');
    const attachedPhotos = mediaByJobId.get(id);
    const job: RepairJob = {
      id,
      queueNumber: String(d.queueNumber || 'Q-00'),
      loggedDate: String(d.loggedDate || ''),
      product: String(d.product || ''),
      productCategory: String(d.productCategory || ''),
      jobDetails: String(d.jobDetails || ''),
      symptoms: String(d.symptoms || ''),
      customer: {
        name: String(d.customerName || ''),
        phone: String(d.customerPhone || ''),
        lineId: String(d.customerLineId || ''),
        facebook: String(d.customerFacebook || ''),
        address: String(d.customerAddress || ''),
        mapCoordinates:
          typeof d.customerMapCoordinates === 'string' && d.customerMapCoordinates
            ? d.customerMapCoordinates
            : undefined,
      },
      appointmentDate: String(d.appointmentDate || ''),
      appointmentTime: String(d.appointmentTime || ''),
      estimatedCost: Number(d.estimatedCost) || 0,
      actualCost:
        d.actualCost === null || d.actualCost === undefined
          ? null
          : Number(d.actualCost),
      status: normalizeStatus(d.status),
      warrantyDays: Number(d.warrantyDays) || 0,
      warrantyStartDate: String(d.warrantyStartDate || ''),
      warrantyEndDate: String(d.warrantyEndDate || ''),
      assignedUserId:
        typeof d.assignedUserId === 'string' && d.assignedUserId
          ? d.assignedUserId
          : undefined,
      assignedUserName:
        typeof d.assignedUserName === 'string' && d.assignedUserName
          ? d.assignedUserName
          : undefined,
      closedAt:
        typeof d.closedAt === 'string' && d.closedAt ? d.closedAt : undefined,
      cancelReason:
        typeof d.cancelReason === 'string' && d.cancelReason
          ? d.cancelReason
          : undefined,
      notes: typeof d.notes === 'string' && d.notes ? d.notes : undefined,
      statusPhotos: attachedPhotos,
    };
    return job;
  });
}

function parseCloudUserAccount(d: Record<string, unknown>): UserAccount {
  return {
    id: String(d.id || ''),
    name: String(d.name || 'ผู้ใช้งาน'),
    phone: String(d.phone || '-'),
    username: String(d.username || ''),
    password: String(d.password || ''),
    role: d.role === 'admin' ? 'admin' : 'user',
    linkToken: String(d.linkToken || ''),
    userLink: String(d.userLink || ''),
    expiresAt: String(d.expiresAt || new Date().toISOString()),
    renewalCode: String(d.renewalCode || ''),
    renewalCodesList: decodeRenewalCodesSummary(
      typeof d.renewalCodesSummary === 'string' ? d.renewalCodesSummary : ''
    ),
    createdAt: String(d.accountCreatedAt || new Date().toISOString()),
    notes: typeof d.notes === 'string' && d.notes ? d.notes : undefined,
  };
}

async function ensureUserAndWorkspaceDocs(
  user: User,
  options: {
    linkedUserId?: string;
    linkedUsername?: string;
    forceAdminWorkspace?: boolean;
  }
): Promise<CloudSessionContext> {
  const uid = sanitizeDocId(user.uid, 'uid');
  const email = clip(user.email || `${uid}@users.local`, 200);
  const displayName = nonEmptyClip(
    user.displayName || user.email?.split('@')[0] || 'ผู้ใช้งาน',
    120,
    'ผู้ใช้งาน'
  );
  const bootstrapped = isBootstrappedAdminEmail(user.email);

  let isAdmin = bootstrapped;
  if (!isAdmin) {
    const adminPath = `admins/${uid}`;
    const adminSnap = await getCachedOrRemoteCreatedAt(adminPath);
    if (adminSnap.exists) {
      isAdmin = true;
    }
  }

  const workspaceId =
    isAdmin && options.forceAdminWorkspace !== false
      ? ADMIN_MASTER_WORKSPACE_ID
      : `ws_${uid}`;

  // If admin exists or bootstrapped, ensure /admins/{uid} marker exists
  if (isAdmin) {
    await upsertDocWithTimestamps(`admins/${uid}`, (isCreate) => {
      if (isCreate) {
        return { uid, email };
      }
      return { uid, email };
    });
  }

  // Read existing user profile first so we preserve previously bound linkedUserId/linkedUsername on new phone
  const userPath = `users/${uid}`;
  const existingProfile = await getCachedOrRemoteCreatedAt(userPath);
  const existingLinkedUserId =
    typeof existingProfile.data?.linkedUserId === 'string'
      ? existingProfile.data.linkedUserId
      : '';
  const existingLinkedUsername =
    typeof existingProfile.data?.linkedUsername === 'string'
      ? existingProfile.data.linkedUsername
      : '';

  const resolvedLinkedUserId =
    options.linkedUserId || existingLinkedUserId || undefined;
  const resolvedLinkedUsername =
    options.linkedUsername || existingLinkedUsername || undefined;

  await upsertDocWithTimestamps(userPath, (isCreate, _ts, prev) => {
    const baseRole = isAdmin ? 'admin' : prev?.role === 'admin' ? 'admin' : 'user';
    return removeUndefinedFields({
      uid,
      displayName,
      role: isCreate ? (isAdmin ? 'admin' : 'user') : baseRole,
      activeWorkspaceId: workspaceId,
      linkedUserId: resolvedLinkedUserId ?? prev?.linkedUserId,
      linkedUsername: resolvedLinkedUsername ?? prev?.linkedUsername,
    });
  });

  // Store email in isolated /users/{uid}/private/info
  await upsertDocWithTimestamps(`users/${uid}/private/info`, () => ({
    uid,
    email,
  }));

  // Ensure workspace root document exists
  const wsPath = `workspaces/${workspaceId}`;
  const wsSnap = await getCachedOrRemoteCreatedAt(wsPath);
  const effectiveWsOwnerUid =
    wsSnap.exists && typeof wsSnap.data?.ownerUid === 'string'
      ? wsSnap.data.ownerUid
      : uid;

  await upsertDocWithTimestamps(wsPath, (isCreate, _ts, prev) =>
    removeUndefinedFields({
      workspaceId,
      ownerUid: isCreate ? uid : effectiveWsOwnerUid,
      kind: isCreate
        ? workspaceId === ADMIN_MASTER_WORKSPACE_ID
          ? 'admin_master'
          : 'user_workspace'
        : prev?.kind || 'user_workspace',
      boundUserId: resolvedLinkedUserId ?? prev?.boundUserId,
      boundUsername: resolvedLinkedUsername ?? prev?.boundUsername,
      label:
        workspaceId === ADMIN_MASTER_WORKSPACE_ID
          ? 'ฐานข้อมูลหลักแอดมิน (Admin Master)'
          : `ฐานข้อมูลร้าน (${displayName})`,
    })
  );

  // Ensure member doc exists
  await upsertDocWithTimestamps(`workspaces/${workspaceId}/members/${uid}`, () => ({
    uid,
    ownerUid: effectiveWsOwnerUid,
    role: effectiveWsOwnerUid === uid ? 'owner' : 'editor',
    displayName,
  }));

  return {
    uid,
    email,
    displayName,
    isAdmin,
    isBootstrappedAdmin: bootstrapped,
    workspaceId,
    linkedUserId: resolvedLinkedUserId,
    linkedUsername: resolvedLinkedUsername,
  };
}

function buildCollectionListQuery(
  ctx: CloudSessionContext,
  subcollection: 'jobs' | 'media' | 'accounts'
) {
  const colRef = collection(db, `workspaces/${ctx.workspaceId}/${subcollection}`);
  // Non-bootstrapped users MUST constrain list queries by ownerUid to satisfy Firestore rules!
  if (!ctx.isBootstrappedAdmin) {
    return query(colRef, where('ownerUid', '==', ctx.uid));
  }
  return colRef;
}

export async function syncSingleJobToCloud(
  ctx: CloudSessionContext,
  job: RepairJob
): Promise<void> {
  const jobId = sanitizeDocId(job.id, 'job');
  const jobPath = `workspaces/${ctx.workspaceId}/jobs/${jobId}`;

  // Step 1: Write job document BEFORE any media documents (rules enforce exists(jobId) on media create)
  await upsertDocWithTimestamps(jobPath, () =>
    buildRepairJobDocData(job, jobId, ctx.uid)
  );

  removeJobDeletedTombstone(job.id);
  removeJobDeletedTombstone(jobId);

  // Step 2: Sync statusPhotos media items cleanly (create new, update changed note/status, remove deleted)
  const desiredMedia = new Map<
    string,
    { status: RepairStatus; item: StatusPhotoItem }
  >();
  if (job.statusPhotos) {
    for (const statusKey of VALID_STATUSES) {
      const list = job.statusPhotos[statusKey];
      if (!Array.isArray(list)) continue;
      for (const item of list) {
        if (!item?.id || !item?.dataUrl) continue;
        const mId = sanitizeDocId(item.id, 'media');
        desiredMedia.set(mId, { status: statusKey, item });
      }
    }
  }

  // Delete media items removed from this job
  const mediaColPath = `workspaces/${ctx.workspaceId}/media`;
  try {
    const existingMediaQuery = query(
      collection(db, mediaColPath),
      where('jobId', '==', jobId),
      ...(!ctx.isBootstrappedAdmin ? [where('ownerUid', '==', ctx.uid)] : [])
    );
    const existingSnap = await getDocs(existingMediaQuery);
    for (const docSnap of existingSnap.docs) {
      const data = docSnap.data();
      if (data.createdAt instanceof Timestamp) {
        createdAtCache.set(`${mediaColPath}/${docSnap.id}`, data.createdAt);
      }
      if (!desiredMedia.has(docSnap.id)) {
        try {
          await deleteDoc(doc(db, `${mediaColPath}/${docSnap.id}`));
          createdAtCache.delete(`${mediaColPath}/${docSnap.id}`);
          syncedMediaMetaCache.delete(docSnap.id);
        } catch (delErr) {
          handleFirestoreError(
            delErr,
            OperationType.DELETE,
            `${mediaColPath}/${docSnap.id}`
          );
        }
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, mediaColPath);
  }

  // Create or update desired media items
  for (const [mId, { status, item }] of desiredMedia.entries()) {
    const mediaPath = `${mediaColPath}/${mId}`;
    const cachedMeta = syncedMediaMetaCache.get(mId);
    const alreadyExists = createdAtCache.has(mediaPath);

    // If media doc already exists and neither note nor status changed, skip write
    if (
      alreadyExists &&
      cachedMeta &&
      cachedMeta.jobId === jobId &&
      cachedMeta.jobStatus === status &&
      (cachedMeta.note || '') === (item.note || '')
    ) {
      continue;
    }

    const safeDataUrl =
      item.dataUrl.startsWith('data:image/')
        ? await shrinkDataUrlForFirestore(item.dataUrl, 340000)
        : nonEmptyClip(item.dataUrl, 450000, 'idb://missing');

    if (!safeDataUrl) continue;

    const safeThumb =
      item.thumbnailDataUrl && item.thumbnailDataUrl.startsWith('data:image/')
        ? await shrinkDataUrlForFirestore(item.thumbnailDataUrl, 180000)
        : undefined;

    await upsertDocWithTimestamps(mediaPath, () =>
      removeUndefinedFields({
        id: mId,
        ownerUid: ctx.uid,
        jobId,
        jobStatus: status,
        mediaType: item.mediaType === 'video' ? 'video' : 'image',
        dataUrl: safeDataUrl,
        thumbnailDataUrl: safeThumb,
        fileName: item.fileName ? clip(item.fileName, 200) : undefined,
        mimeType: item.mimeType ? clip(item.mimeType, 100) : undefined,
        sizeBytes:
          typeof item.sizeBytes === 'number' ? item.sizeBytes : undefined,
        durationSec:
          typeof item.durationSec === 'number' ? item.durationSec : undefined,
        itemCreatedAt: clip(item.createdAt || new Date().toISOString(), 60),
        note: item.note ? clip(item.note, 400) : '',
      })
    );

    syncedMediaMetaCache.set(mId, {
      jobId,
      jobStatus: status,
      note: item.note,
    });
  }
}

export async function deleteSingleJobFromCloud(
  ctx: CloudSessionContext,
  jobIdRaw: string
): Promise<void> {
  const jobId = sanitizeDocId(jobIdRaw, 'job');
  markJobDeletedTombstone(jobIdRaw);
  markJobDeletedTombstone(jobId);

  const mediaColPath = `workspaces/${ctx.workspaceId}/media`;
  try {
    const existingMediaQuery = query(
      collection(db, mediaColPath),
      where('jobId', '==', jobId),
      ...(!ctx.isBootstrappedAdmin ? [where('ownerUid', '==', ctx.uid)] : [])
    );
    const snap = await getDocs(existingMediaQuery);
    for (const d of snap.docs) {
      const mPath = `${mediaColPath}/${d.id}`;
      try {
        await deleteDoc(doc(db, mPath));
        createdAtCache.delete(mPath);
        syncedMediaMetaCache.delete(d.id);
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, mPath);
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, mediaColPath);
  }

  const jobPath = `workspaces/${ctx.workspaceId}/jobs/${jobId}`;
  try {
    await deleteDoc(doc(db, jobPath));
    createdAtCache.delete(jobPath);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, jobPath);
  }
}

export async function clearAllJobsFromCloud(
  ctx: CloudSessionContext
): Promise<void> {
  const jobsColPath = `workspaces/${ctx.workspaceId}/jobs`;
  try {
    const snap = await getDocs(buildCollectionListQuery(ctx, 'jobs'));
    for (const d of snap.docs) {
      await deleteSingleJobFromCloud(ctx, d.id);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, jobsColPath);
  }
}

export async function syncSettingsToCloud(
  ctx: CloudSessionContext,
  settings: ShopSettings
): Promise<void> {
  const settingsPath = `workspaces/${ctx.workspaceId}/settings/main`;
  const settingsPayload = await buildShopSettingsDocData(settings, ctx.uid);
  await upsertDocWithTimestamps(settingsPath, (_isCreate, _ts, prev) => ({
    ...settingsPayload,
    ownerUid:
      typeof prev?.ownerUid === 'string' && prev.ownerUid ? prev.ownerUid : ctx.uid,
  }));

  const secretsPath = `workspaces/${ctx.workspaceId}/private/secrets`;
  const secretsPayload = buildWorkspaceSecretsDocData(settings, ctx.uid);
  await upsertDocWithTimestamps(secretsPath, (_isCreate, _ts, prev) => ({
    ...secretsPayload,
    ownerUid:
      typeof prev?.ownerUid === 'string' && prev.ownerUid ? prev.ownerUid : ctx.uid,
  }));
}

export async function syncAccountsToCloud(
  ctx: CloudSessionContext,
  users: UserAccount[]
): Promise<void> {
  if (!ctx.isAdmin) return;
  const accountsColPath = `workspaces/${ctx.workspaceId}/accounts`;

  const desiredIds = new Set<string>();
  for (const u of users) {
    const docId = sanitizeDocId(u.id, 'usr');
    desiredIds.add(docId);
    const accPath = `${accountsColPath}/${docId}`;
    await upsertDocWithTimestamps(accPath, (_isCreate, _ts, prev) => {
      const built = buildUserAccountDocData(u, docId, ctx.uid);
      return {
        ...built,
        accountCreatedAt:
          typeof prev?.accountCreatedAt === 'string' && prev.accountCreatedAt
            ? prev.accountCreatedAt
            : built.accountCreatedAt,
        ownerUid:
          typeof prev?.ownerUid === 'string' && prev.ownerUid ? prev.ownerUid : ctx.uid,
      };
    });
  }

  try {
    const existingSnap = await getDocs(buildCollectionListQuery(ctx, 'accounts'));
    for (const d of existingSnap.docs) {
      if (!desiredIds.has(d.id)) {
        const delPath = `${accountsColPath}/${d.id}`;
        try {
          await deleteDoc(doc(db, delPath));
          createdAtCache.delete(delPath);
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, delPath);
        }
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, accountsColPath);
  }
}

export async function bindUserIdToCloudProfile(
  ctx: CloudSessionContext,
  userAccount: { id?: string; username?: string; name?: string }
): Promise<CloudSessionContext> {
  const linkedUserId = userAccount.id ? clip(userAccount.id, 128) : ctx.linkedUserId;
  const linkedUsername = userAccount.username
    ? clip(userAccount.username, 80)
    : ctx.linkedUsername;

  await upsertDocWithTimestamps(`users/${ctx.uid}`, (_isCreate, _ts, prev) =>
    removeUndefinedFields({
      uid: ctx.uid,
      displayName: clip(prev?.displayName || ctx.displayName, 120),
      role: prev?.role === 'admin' ? 'admin' : ctx.isAdmin ? 'admin' : 'user',
      activeWorkspaceId: ctx.workspaceId,
      linkedUserId,
      linkedUsername,
    })
  );

  await upsertDocWithTimestamps(
    `workspaces/${ctx.workspaceId}`,
    (_isCreate, _ts, prev) =>
      removeUndefinedFields({
        workspaceId: ctx.workspaceId,
        ownerUid:
          typeof prev?.ownerUid === 'string' && prev.ownerUid
            ? prev.ownerUid
            : ctx.uid,
        kind: prev?.kind || (ctx.workspaceId === ADMIN_MASTER_WORKSPACE_ID ? 'admin_master' : 'user_workspace'),
        boundUserId: linkedUserId,
        boundUsername: linkedUsername,
        label: clip(
          prev?.label || `ฐานข้อมูลร้าน (${ctx.displayName})`,
          120
        ),
      })
  );

  return {
    ...ctx,
    linkedUserId,
    linkedUsername,
  };
}

/**
 * Initializes Firebase workspace for the signed-in Google user, reads existing cloud state,
 * and safely migrates existing local data ONLY when appropriate so:
 *  - Phone 1 (old phone) backs up 100% of existing settings, jobs, photos, and admin accounts to Firestore
 *  - Phone 2 (new phone) restores 100% of cloud settings, jobs, photos, and admin accounts WITHOUT wiping or overwriting cloud data with factory mocks!
 */
export async function initializeAndMergeCloudWorkspace(params: {
  user: User;
  localJobs: RepairJob[];
  localSettings: ShopSettings;
  localUsers: UserAccount[];
  linkedUserAccount?: { id?: string; username?: string; name?: string } | null;
  forceAdminWorkspace?: boolean;
}): Promise<{
  ctx: CloudSessionContext;
  snapshot: CloudWorkspaceSnapshot;
  migratedCount: number;
}> {
  const ctx = await ensureUserAndWorkspaceDocs(params.user, {
    linkedUserId: params.linkedUserAccount?.id,
    linkedUsername: params.linkedUserAccount?.username,
    forceAdminWorkspace: params.forceAdminWorkspace,
  });

  const wsPrefix = `workspaces/${ctx.workspaceId}`;

  // 1. Read existing cloud settings & secrets
  const settingsInfo = await getCachedOrRemoteCreatedAt(`${wsPrefix}/settings/main`);
  let secretsInfo: { exists: boolean; data: Record<string, unknown> | null } = {
    exists: false,
    data: null,
  };
  try {
    const sSnap = await getCachedOrRemoteCreatedAt(`${wsPrefix}/private/secrets`);
    secretsInfo = { exists: sSnap.exists, data: sSnap.data };
  } catch {
    secretsInfo = { exists: false, data: null };
  }

  // 2. Read existing cloud jobs & media
  let cloudJobDocs: Array<Record<string, unknown>> = [];
  try {
    const jobsSnap = await getDocs(buildCollectionListQuery(ctx, 'jobs'));
    cloudJobDocs = jobsSnap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      if (data.createdAt instanceof Timestamp) {
        createdAtCache.set(`${wsPrefix}/jobs/${d.id}`, data.createdAt);
      }
      return data;
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `${wsPrefix}/jobs`);
  }

  let cloudMediaDocs: Array<Record<string, unknown>> = [];
  try {
    const mediaSnap = await getDocs(buildCollectionListQuery(ctx, 'media'));
    cloudMediaDocs = mediaSnap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      if (data.createdAt instanceof Timestamp) {
        createdAtCache.set(`${wsPrefix}/media/${d.id}`, data.createdAt);
      }
      return data;
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `${wsPrefix}/media`);
  }

  // 3. Read existing cloud accounts (Admin only)
  let cloudAccountDocs: Array<Record<string, unknown>> = [];
  if (ctx.isAdmin) {
    try {
      const accSnap = await getDocs(buildCollectionListQuery(ctx, 'accounts'));
      cloudAccountDocs = accSnap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        if (data.createdAt instanceof Timestamp) {
          createdAtCache.set(`${wsPrefix}/accounts/${d.id}`, data.createdAt);
        }
        return data;
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, `${wsPrefix}/accounts`);
    }
  }

  const cloudHasData =
    settingsInfo.exists ||
    cloudJobDocs.length > 0 ||
    cloudAccountDocs.length > 0;

  let migratedCount = 0;

  // Check whether this phone has explicit user-saved localStorage data vs untouched factory fresh install
  const hasExplicitLocalSettings =
    typeof localStorage !== 'undefined' &&
    localStorage.getItem(SETTINGS_LOCAL_KEY) !== null;
  const hasExplicitLocalJobs =
    typeof localStorage !== 'undefined' &&
    localStorage.getItem(JOBS_LOCAL_KEY) !== null;
  const hasExplicitLocalUsers =
    typeof localStorage !== 'undefined' &&
    localStorage.getItem(USERS_LOCAL_KEY) !== null;

  // Determine whether localSettings has meaningful shop customization or LINE config (not wiped blank)
  const localSettingsHasShopInfo = Boolean(
    params.localSettings.shopName?.trim() ||
      params.localSettings.coverTitle?.trim() ||
      (params.localSettings.repairCategories?.length || 0) > 0 ||
      (params.localSettings.technicians?.length || 0) > 0 ||
      params.localSettings.lineNotify?.token ||
      params.localSettings.lineNotify?.channelAccessToken
  );

  // Merge Settings:
  // - If cloud has NO settings yet -> upload Phone 1 settings (or backup if settings were wiped on a user link)
  // - If cloud ALREADY has settings -> keep cloud settings!
  let effectiveSettings = parseCloudSettings(settingsInfo.data, secretsInfo.data);
  if (!effectiveSettings) {
    let settingsToUpload = params.localSettings;
    if (!localSettingsHasShopInfo && !hasExplicitLocalSettings) {
      settingsToUpload = INITIAL_SHOP_SETTINGS;
    }
    await syncSettingsToCloud(ctx, settingsToUpload);
    effectiveSettings = settingsToUpload;
    migratedCount++;
  }

  // Merge Jobs:
  const tombstones = loadDeletedJobTombstones();
  const cloudJobs = assembleJobsWithMedia(cloudJobDocs, cloudMediaDocs);
  const cloudJobIds = new Set(cloudJobs.map((j) => sanitizeDocId(j.id, 'job')));

  // Upload local jobs ONLY if:
  // (a) Cloud currently has NO jobs & user had explicit local jobs or this is first-ever backup on Phone 1
  // (b) OR this device has explicitly saved local jobs whose IDs don't exist in cloud & aren't deleted tombstones
  const shouldMigrateLocalJobs =
    (!cloudHasData && params.localJobs.length > 0) ||
    hasExplicitLocalJobs;

  const extraUploadedJobs: RepairJob[] = [];
  if (shouldMigrateLocalJobs) {
    for (const localJob of params.localJobs) {
      const sanitizedId = sanitizeDocId(localJob.id, 'job');
      if (tombstones.has(localJob.id) || tombstones.has(sanitizedId)) {
        continue;
      }
      if (!cloudJobIds.has(sanitizedId)) {
        // On a device where cloud ALREADY had data, skip untouched factory sample IDs ('job-1'..'job-6')
        if (cloudHasData && /^job-[1-6]$/.test(localJob.id)) {
          continue;
        }
        await syncSingleJobToCloud(ctx, localJob);
        extraUploadedJobs.push(localJob);
        migratedCount++;
      }
    }
  }

  const mergedJobs = [...extraUploadedJobs, ...cloudJobs];

  // Merge Admin Accounts (User Links):
  let effectiveAccounts = cloudAccountDocs.map(parseCloudUserAccount);
  if (ctx.isAdmin) {
    const cloudAccIds = new Set(effectiveAccounts.map((a) => sanitizeDocId(a.id, 'usr')));
    const shouldUploadLocalUsers =
      effectiveAccounts.length === 0 || hasExplicitLocalUsers;
    if (shouldUploadLocalUsers) {
      const newLocalUsers = params.localUsers.filter(
        (u) => !cloudAccIds.has(sanitizeDocId(u.id, 'usr'))
      );
      if (newLocalUsers.length > 0) {
        const combined = [...effectiveAccounts, ...newLocalUsers];
        await syncAccountsToCloud(ctx, combined);
        effectiveAccounts = combined;
        migratedCount += newLocalUsers.length;
      }
    }
  }

  return {
    ctx,
    snapshot: {
      settings: effectiveSettings,
      jobs: mergedJobs,
      accounts: effectiveAccounts,
      linkedUserId: ctx.linkedUserId,
      linkedUsername: ctx.linkedUsername,
      hasCloudData: true,
    },
    migratedCount,
  };
}

/**
 * Forces pushing all current device state (jobs, media, settings, admin accounts) to Firestore.
 */
export async function forcePushAllLocalToCloud(
  ctx: CloudSessionContext,
  data: {
    jobs: RepairJob[];
    settings: ShopSettings;
    users: UserAccount[];
  }
): Promise<number> {
  let count = 0;
  await syncSettingsToCloud(ctx, data.settings);
  count++;
  for (const job of data.jobs) {
    await syncSingleJobToCloud(ctx, job);
    count++;
  }
  if (ctx.isAdmin && data.users.length > 0) {
    await syncAccountsToCloud(ctx, data.users);
    count++;
  }
  return count;
}

/**
 * Attaches real-time Firestore onSnapshot listeners for the active workspace.
 * Caller MUST only invoke when Firebase Auth is authenticated & ctx is ready.
 */
export function subscribeToCloudWorkspace(
  ctx: CloudSessionContext,
  callbacks: {
    onSettingsUpdate: (settings: ShopSettings) => void;
    onJobsUpdate: (jobs: RepairJob[]) => void;
    onAccountsUpdate?: (accounts: UserAccount[]) => void;
  }
): () => void {
  const wsPrefix = `workspaces/${ctx.workspaceId}`;
  const unsubscribers: Unsubscribe[] = [];

  let latestSettingsData: Record<string, unknown> | null = null;
  let latestSecretsData: Record<string, unknown> | null = null;
  let latestJobDocs: Array<Record<string, unknown>> = [];
  let latestMediaDocs: Array<Record<string, unknown>> = [];
  let hasJobsSnap = false;
  let hasMediaSnap = false;

  const emitSettings = () => {
    const parsed = parseCloudSettings(latestSettingsData, latestSecretsData);
    if (parsed) {
      callbacks.onSettingsUpdate(parsed);
    }
  };

  const emitJobs = () => {
    if (!hasJobsSnap || !hasMediaSnap) return;
    callbacks.onJobsUpdate(assembleJobsWithMedia(latestJobDocs, latestMediaDocs));
  };

  // 1. Settings listener
  const settingsPath = `${wsPrefix}/settings/main`;
  unsubscribers.push(
    onSnapshot(
      doc(db, settingsPath),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Record<string, unknown>;
          if (data.createdAt instanceof Timestamp) {
            createdAtCache.set(settingsPath, data.createdAt);
          }
          latestSettingsData = data;
          emitSettings();
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, settingsPath);
      }
    )
  );

  // 2. Secrets listener (owner / admin)
  const secretsPath = `${wsPrefix}/private/secrets`;
  unsubscribers.push(
    onSnapshot(
      doc(db, secretsPath),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Record<string, unknown>;
          if (data.createdAt instanceof Timestamp) {
            createdAtCache.set(secretsPath, data.createdAt);
          }
          latestSecretsData = data;
          emitSettings();
        }
      },
      (err) => {
        // Non-owner editors may not read private/secrets
        if (String(err).toLowerCase().includes('permission')) {
          return;
        }
        handleFirestoreError(err, OperationType.GET, secretsPath);
      }
    )
  );

  // 3. Jobs listener
  const jobsColPath = `${wsPrefix}/jobs`;
  unsubscribers.push(
    onSnapshot(
      buildCollectionListQuery(ctx, 'jobs'),
      (snap) => {
        latestJobDocs = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          if (data.createdAt instanceof Timestamp) {
            createdAtCache.set(`${jobsColPath}/${d.id}`, data.createdAt);
          }
          return data;
        });
        hasJobsSnap = true;
        emitJobs();
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, jobsColPath);
      }
    )
  );

  // 4. Media listener
  const mediaColPath = `${wsPrefix}/media`;
  unsubscribers.push(
    onSnapshot(
      buildCollectionListQuery(ctx, 'media'),
      (snap) => {
        latestMediaDocs = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          if (data.createdAt instanceof Timestamp) {
            createdAtCache.set(`${mediaColPath}/${d.id}`, data.createdAt);
          }
          return data;
        });
        hasMediaSnap = true;
        emitJobs();
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, mediaColPath);
      }
    )
  );

  // 5. Accounts listener (Admin only)
  if (ctx.isAdmin && callbacks.onAccountsUpdate) {
    const accountsColPath = `${wsPrefix}/accounts`;
    const onAccountsCb = callbacks.onAccountsUpdate;
    unsubscribers.push(
      onSnapshot(
        buildCollectionListQuery(ctx, 'accounts'),
        (snap) => {
          const accounts = snap.docs.map((d) => {
            const data = d.data() as Record<string, unknown>;
            if (data.createdAt instanceof Timestamp) {
              createdAtCache.set(`${accountsColPath}/${d.id}`, data.createdAt);
            }
            return parseCloudUserAccount(data);
          });
          onAccountsCb(accounts);
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, accountsColPath);
        }
      )
    );
  }

  return () => {
    for (const unsub of unsubscribers) {
      unsub();
    }
  };
}
