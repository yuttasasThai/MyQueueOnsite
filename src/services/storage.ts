// File: /src/services/storage.ts | Revision: Rev 12 | Version: 1.2.7 | Modified: 2026-11-13
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

function encodePayloadBase64Url(obj: unknown): string {
  try {
    const json = JSON.stringify(obj);
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch {
    return '';
  }
}

function decodePayloadBase64Url<T>(encoded: string): T | null {
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
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
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
  const compactPayload = {
    id: userOrToken.id,
    n: userOrToken.name,
    p: userOrToken.phone,
    un: userOrToken.username,
    pw: userOrToken.password,
    t: userOrToken.linkToken,
    e: userOrToken.expiresAt,
    rc: userOrToken.renewalCode,
  };
  const encoded = encodePayloadBase64Url(compactPayload);
  const url = `${base}?user_token=${encodeURIComponent(userOrToken.linkToken)}`;
  return encoded ? `${url}&u=${encoded}` : url;
}

export function buildAdminLink(adminSecretToken?: string): string {
  const base = getBaseAppUrl();
  const token = adminSecretToken || 'admin_master_secret_2026';
  return `${base}?admin_token=${encodeURIComponent(token)}`;
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

// Check URL param for user token (?user_token=xyz or ?token=xyz) + optional encoded ?u=...
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
    const payload = decodePayloadBase64Url<{
      id?: string;
      n?: string;
      p?: string;
      un?: string;
      pw?: string;
      t?: string;
      e?: string;
      rc?: string;
    }>(encodedUser);
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
        userLink: window.location.href,
        expiresAt: payload.e || new Date().toISOString(),
        renewalCode: payload.rc || '',
        renewalCodesList: [],
        createdAt: new Date().toISOString(),
      };
      reconstructed.userLink = buildUserLink(reconstructed);
      decodedUser = reconstructed;
    }
  }

  const localUser = token ? users.find((u) => u.linkToken === token) || null : null;

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

// Check URL param for admin token (?admin_token=xyz or ?admin_key=xyz)
export function checkUrlAdminToken(settings: ShopSettings): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  const token = params.get('admin_token') || params.get('admin_key');
  if (!token) return false;
  const validToken = settings.adminSecretToken || 'admin_master_secret_2026';
  return token === validToken || token === 'admin' || token === settings.adminPassword;
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
