// File: /src/services/storage.ts | Revision: Rev 14 | Version: 1.2.9 | Modified: 2026-11-13
import { RepairJob, ShopSettings, UserAccount, RenewalCode } from '../types';
import {
  INITIAL_SHOP_SETTINGS,
  INITIAL_USERS,
  INITIAL_REPAIR_JOBS,
} from '../data/initialData';

const SETTINGS_KEY = 'repair_onsite_settings_v1';
const JOBS_KEY = 'repair_onsite_jobs_v1';
const USERS_KEY = 'repair_onsite_users_v1';
const CURRENT_AUTH_KEY = 'repair_onsite_auth_v1';

function encodeStringBase64Url(text: string): string {
  try {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch {
    return '';
  }
}

function decodeStringBase64Url(encoded: string): string | null {
  try {
    let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

const EPOCH_2026_MS = Date.UTC(2026, 0, 1);
const SHORT_ALPH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_';

function isShortSafe(str: string): boolean {
  return str.length > 0 && /^[A-Za-z0-9_]+$/.test(str);
}

function scrambleSeg(str: string, salt: number): string {
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const idx = SHORT_ALPH.indexOf(str[i]);
    if (idx === -1) return '';
    const nextIdx = (idx + 17 + i * 7 + salt * 13) % SHORT_ALPH.length;
    out += SHORT_ALPH[nextIdx];
  }
  return out;
}

function unscrambleSeg(str: string, salt: number): string | null {
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const idx = SHORT_ALPH.indexOf(str[i]);
    if (idx === -1) return null;
    const shift = (17 + i * 7 + salt * 13) % SHORT_ALPH.length;
    const origIdx = (idx - shift + SHORT_ALPH.length) % SHORT_ALPH.length;
    out += SHORT_ALPH[origIdx];
  }
  return out;
}

function encodeExpDayB36(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime();
  if (!Number.isFinite(ms)) return '1';
  const days = Math.max(0, Math.ceil((ms - EPOCH_2026_MS) / 86400000));
  return days.toString(36);
}

function decodeExpCodeToIso(code: string): string {
  const val = parseInt(code, 36);
  if (!Number.isFinite(val) || val < 0) {
    return new Date().toISOString();
  }
  // Legacy Rev 13 hourly epoch (values >= 400000) vs Rev 14 days since 2026-01-01
  if (val >= 400000) {
    return new Date(val * 3600000).toISOString();
  }
  return new Date(EPOCH_2026_MS + val * 86400000 + 86399000).toISOString();
}

export function getBaseAppUrl(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin + window.location.pathname;
  }
  return '';
}

export function buildUserLink(userOrToken: UserAccount | string): string {
  const base = getBaseAppUrl();
  if (typeof userOrToken === 'string') {
    return `${base}?user_token=${encodeURIComponent(userOrToken)}`;
  }
  const un = userOrToken.username || 'user';
  const pw = userOrToken.password || '1234';
  const expB36 = encodeExpDayB36(userOrToken.expiresAt);

  // Ultra-short 1-to-1 URL-safe encoding (no Base64 bloat) when username & password use [A-Za-z0-9_]
  if (isShortSafe(un) && isShortSafe(pw) && isShortSafe(expB36)) {
    const s1 = scrambleSeg(un, 1);
    const s2 = scrambleSeg(pw, 2);
    const s3 = scrambleSeg(expB36, 3);
    if (s1 && s2 && s3) {
      return `${base}?u=${s1}.${s2}.${s3}`;
    }
  }

  // Compact Base64Url fallback for special characters / Thai usernames
  const encoded = encodeStringBase64Url([un, pw, expB36].join('\x1f'));
  if (encoded) {
    return `${base}?u=${encoded}`;
  }
  return `${base}?user_token=${encodeURIComponent(userOrToken.linkToken)}`;
}

export function buildAdminLink(adminSecretToken?: string): string {
  const base = getBaseAppUrl();
  const token =
    adminSecretToken && adminSecretToken !== 'admin_master_secret_2026'
      ? adminSecretToken
      : 'cn2026';
  return `${base}?a=${encodeURIComponent(token)}`;
}

export function loadShopSettings(): ShopSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      return { ...INITIAL_SHOP_SETTINGS, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.error('Failed to load shop settings', e);
  }
  return INITIAL_SHOP_SETTINGS;
}

export function saveShopSettings(settings: ShopSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save shop settings', e);
  }
}

export function loadUsers(): UserAccount[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (raw) {
      const parsed: UserAccount[] = JSON.parse(raw);
      return parsed.map((u) => ({
        ...u,
        userLink: buildUserLink(u),
      }));
    }
  } catch (e) {
    console.error('Failed to load users', e);
  }
  // Initialize with links
  return INITIAL_USERS.map((u) => ({
    ...u,
    userLink: buildUserLink(u),
  }));
}

export function saveUsers(users: UserAccount[]): void {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch (e) {
    console.error('Failed to save users', e);
  }
}

export function loadJobs(): RepairJob[] {
  try {
    const raw = localStorage.getItem(JOBS_KEY);
    if (raw !== null) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to load jobs', e);
  }
  return INITIAL_REPAIR_JOBS;
}

export function saveJobs(jobs: RepairJob[]): void {
  try {
    localStorage.setItem(JOBS_KEY, JSON.stringify(jobs));
  } catch (e) {
    console.error('Failed to save jobs', e);
  }
}

export function clearAllJobs(): void {
  try {
    localStorage.setItem(JOBS_KEY, JSON.stringify([]));
  } catch (e) {
    console.error('Failed to clear jobs', e);
  }
}

export interface AuthSession {
  role: 'admin' | 'user';
  userId?: string;
  userName?: string;
  userPhone?: string;
  linkToken?: string;
  expiresAt?: string;
}

export function loadCurrentAuth(): AuthSession | null {
  try {
    const raw = localStorage.getItem(CURRENT_AUTH_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to load auth', e);
  }
  // Default to user so the Admin button is prominent and requires PIN 099-225-6601 to enter admin
  return { role: 'user', userName: 'ช่างหน้างาน' };
}

export function saveCurrentAuth(auth: AuthSession | null): void {
  try {
    if (auth) {
      localStorage.setItem(CURRENT_AUTH_KEY, JSON.stringify(auth));
    } else {
      localStorage.removeItem(CURRENT_AUTH_KEY);
    }
  } catch (e) {
    console.error('Failed to save auth', e);
  }
}

// Check URL param for user token (?u=... short link, or legacy ?user_token=xyz / ?token=xyz)
export function checkUrlUserToken(users: UserAccount[]): {
  hasUserParam: boolean;
  foundUser: UserAccount | null;
  isExpired: boolean;
  daysRemaining: number;
} {
  if (typeof window === 'undefined') {
    return { hasUserParam: false, foundUser: null, isExpired: false, daysRemaining: 0 };
  }
  const params = new URLSearchParams(window.location.search);
  const token = params.get('user_token') || params.get('token');
  const encodedUser = params.get('u');

  if (!token && !encodedUser) {
    return { hasUserParam: false, foundUser: null, isExpired: false, daysRemaining: 0 };
  }

  let decodedUser: UserAccount | null = null;
  if (encodedUser) {
    // Rev 14 ultra-short dot-separated scrambled link (?u=xxx.yyy.zzz)
    if (encodedUser.includes('.')) {
      const segs = encodedUser.split('.');
      if (segs.length === 3) {
        const un = unscrambleSeg(segs[0], 1);
        const pw = unscrambleSeg(segs[1], 2);
        const expCode = unscrambleSeg(segs[2], 3);
        if (un && pw !== null && expCode) {
          const linkToken = token || `u_${un}`;
          const existingLocal = users.find(
            (u) => u.username.toLowerCase() === un.toLowerCase() || u.linkToken === linkToken
          );
          const reconstructed: UserAccount = {
            id: existingLocal?.id || `usr_${un}`,
            name: existingLocal?.name || un,
            phone: existingLocal?.phone || '-',
            username: un,
            password: pw,
            role: 'user',
            linkToken: existingLocal?.linkToken || linkToken,
            userLink: '',
            expiresAt: decodeExpCodeToIso(expCode),
            renewalCode: existingLocal?.renewalCode || generateRenewalCode(un, 30),
            renewalCodesList: existingLocal?.renewalCodesList || [],
            createdAt: existingLocal?.createdAt || new Date().toISOString(),
          };
          reconstructed.userLink = buildUserLink(reconstructed);
          decodedUser = reconstructed;
        }
      }
    } else {
      const rawStr = decodeStringBase64Url(encodedUser);
      if (rawStr && rawStr.includes('\x1f')) {
        const parts = rawStr.split('\x1f');
        const un = parts[0] || 'user';
        const pw = parts[1] || '';
        const expCode = parts[2] || '';
        const linkToken = parts[3] || token || `u_${un}`;
        const existingLocal = users.find(
          (u) => u.username.toLowerCase() === un.toLowerCase() || u.linkToken === linkToken
        );
        const name = parts[4] || existingLocal?.name || un;
        const phone = parts[5] || existingLocal?.phone || '-';
        const expiresAt = expCode ? decodeExpCodeToIso(expCode) : new Date().toISOString();

        const reconstructed: UserAccount = {
          id: existingLocal?.id || `usr_${linkToken}`,
          name,
          phone,
          username: un,
          password: pw,
          role: 'user',
          linkToken: existingLocal?.linkToken || linkToken,
          userLink: '',
          expiresAt,
          renewalCode: existingLocal?.renewalCode || generateRenewalCode(linkToken, 30),
          renewalCodesList: existingLocal?.renewalCodesList || [],
          createdAt: existingLocal?.createdAt || new Date().toISOString(),
        };
        reconstructed.userLink = buildUserLink(reconstructed);
        decodedUser = reconstructed;
      } else if (rawStr && rawStr.trim().startsWith('{')) {
        try {
          const payload = JSON.parse(rawStr) as {
            id?: string;
            n?: string;
            p?: string;
            un?: string;
            pw?: string;
            t?: string;
            e?: string;
            rc?: string;
          };
          if (payload && (payload.t || token)) {
            const linkToken = payload.t || token || '';
            const reconstructed: UserAccount = {
              id: payload.id || `usr_${linkToken}`,
              name: payload.n || 'ผู้ใช้งาน',
              phone: payload.p || '-',
              username: payload.un || 'user',
              password: payload.pw || '',
              role: 'user',
              linkToken,
              userLink: '',
              expiresAt: payload.e || new Date().toISOString(),
              renewalCode: payload.rc || '',
              renewalCodesList: [],
              createdAt: new Date().toISOString(),
            };
            reconstructed.userLink = buildUserLink(reconstructed);
            decodedUser = reconstructed;
          }
        } catch {
          // Ignore malformed legacy JSON
        }
      }
    }
  }

  const lookupToken = token || decodedUser?.linkToken;
  const localUser = lookupToken
    ? users.find(
        (u) =>
          u.linkToken === lookupToken ||
          (decodedUser && u.username.toLowerCase() === decodedUser.username.toLowerCase())
      ) || null
    : null;

  let resolvedUser: UserAccount | null = localUser;
  if (decodedUser && localUser) {
    // Pick the more recently extended expiration date if already renewed locally
    const localExp = new Date(localUser.expiresAt).getTime();
    const urlExp = new Date(decodedUser.expiresAt).getTime();
    resolvedUser = urlExp > localExp ? { ...localUser, ...decodedUser } : localUser;
  } else if (decodedUser) {
    resolvedUser = decodedUser;
  }

  if (!resolvedUser) {
    return { hasUserParam: true, foundUser: null, isExpired: false, daysRemaining: 0 };
  }

  const expiryStatus = checkUserLinkExpiry(resolvedUser.expiresAt);
  return {
    hasUserParam: true,
    foundUser: resolvedUser,
    isExpired: expiryStatus.isExpired,
    daysRemaining: expiryStatus.daysRemaining,
  };
}

// Check URL param for permanent admin token (?a=cn2026, ?admin_token=..., ?admin_key=...)
export function checkUrlAdminToken(settings: ShopSettings): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  const token = params.get('a') || params.get('admin_token') || params.get('admin_key');
  if (!token) return false;
  const validTokens = [
    'cn2026',
    'admin_master_secret_2026',
    'admin',
    settings.adminSecretToken,
    settings.adminPassword,
    '0992256601',
    '099-225-6601',
  ].filter(Boolean);
  return validTokens.includes(token);
}

export function checkUserLinkExpiry(expiresAtStr: string): {
  isExpired: boolean;
  daysRemaining: number;
  formattedDate: string;
} {
  const expiryDate = new Date(expiresAtStr);
  const now = new Date();
  const diffTime = expiryDate.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  };
  const formattedDate = expiryDate.toLocaleDateString('th-TH', options);

  return {
    isExpired: daysRemaining < 0,
    daysRemaining: Math.max(0, daysRemaining),
    formattedDate,
  };
}

// Calculate Warranty status
export interface WarrantyStatus {
  status: 'valid' | 'warning' | 'expired';
  daysRemaining: number;
  label: string;
  formattedEndDate: string;
}

export function getWarrantyStatus(endDateStr: string, _daysTotal: number): WarrantyStatus {
  const endDate = new Date(endDateStr);
  const now = new Date();
  // set times to midnight for fair day comparison
  endDate.setHours(23, 59, 59, 999);
  now.setHours(0, 0, 0, 0);

  const diffTime = endDate.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const formattedEndDate = new Date(endDateStr).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  if (daysRemaining < 0) {
    const overdueDays = Math.abs(daysRemaining);
    return {
      status: 'expired',
      daysRemaining,
      label: `หมดประกัน (${overdueDays} วันที่แล้ว)`,
      formattedEndDate,
    };
  }

  if (daysRemaining <= 7) {
    return {
      status: 'warning',
      daysRemaining,
      label: daysRemaining === 0 ? 'หมดประกันวันนี้' : `ใกล้หมดประกัน (เหลือ ${daysRemaining} วัน)`,
      formattedEndDate,
    };
  }

  return {
    status: 'valid',
    daysRemaining,
    label: `อยู่ในประกัน (เหลืออีก ${daysRemaining} วัน)`,
    formattedEndDate,
  };
}

// Generate unique renewal code
export function generateRenewalCode(userName: string, days: number): string {
  const prefix = 'RENEW';
  const cleanName = userName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase() || 'USER';
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${cleanName}-${days}D-${randomSuffix}`;
}

// Renew user expiry by days or by code
export function applyUserRenewal(
  user: UserAccount,
  daysOrCode: number | string,
  users: UserAccount[]
): { success: boolean; message: string; updatedUser?: UserAccount } {
  let daysToAdd = 0;
  let codeMatched: RenewalCode | null = null;

  if (typeof daysOrCode === 'number') {
    daysToAdd = daysOrCode;
  } else {
    // It's a string code
    const trimmedCode = daysOrCode.trim();
    if (trimmedCode === user.renewalCode) {
      daysToAdd = 30; // default 30 days for main code
    } else {
      const foundInList = user.renewalCodesList.find(
        (c) => c.code.toLowerCase() === trimmedCode.toLowerCase()
      );
      if (foundInList) {
        if (foundInList.isUsed) {
          return { success: false, message: 'รหัสต่ออายุนี้ถูกใช้งานไปแล้ว' };
        }
        daysToAdd = foundInList.daysToAdd;
        codeMatched = foundInList;
      } else {
        return { success: false, message: 'รหัสต่ออายุไม่ถูกต้อง โปรดติดต่อแอดมิน' };
      }
    }
  }

  if (daysToAdd <= 0) {
    return { success: false, message: 'จำนวนวันต่ออายุไม่ถูกต้อง' };
  }

  // Calculate new expiry: if already expired, start from today; else add to current expiresAt
  const currentExpiry = new Date(user.expiresAt);
  const now = new Date();
  const baseDate = currentExpiry.getTime() > now.getTime() ? currentExpiry : now;
  baseDate.setDate(baseDate.getDate() + daysToAdd);

  const updatedCodesList = user.renewalCodesList.map((c) => {
    if (codeMatched && c.code === codeMatched.code) {
      return { ...c, isUsed: true, usedAt: new Date().toISOString() };
    }
    return c;
  });

  const updatedUser: UserAccount = {
    ...user,
    expiresAt: baseDate.toISOString(),
    renewalCodesList: updatedCodesList,
  };
  updatedUser.userLink = buildUserLink(updatedUser);

  const updatedAllUsers = users.map((u) => (u.id === user.id ? updatedUser : u));
  saveUsers(updatedAllUsers);

  return {
    success: true,
    message: `ต่ออายุสำเร็จ! ขยายเวลาเพิ่ม ${daysToAdd} วัน (ใช้ได้ถึง ${baseDate.toLocaleDateString('th-TH')})`,
    updatedUser,
  };
}
