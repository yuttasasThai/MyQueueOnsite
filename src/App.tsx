// File: /src/App.tsx | Revision: Rev 19 | Version: 1.5.0 | Modified: 2026-11-15
import React, { useState, useEffect, useRef, useCallback, Suspense, lazy } from 'react';
import { Navbar } from './components/Navbar';
import { HeroCover } from './components/HeroCover';
import { Dashboard } from './components/Dashboard';
import { QueueTable } from './components/QueueTable';
import { JobModal } from './components/JobModal';
import { JobDetailModal } from './components/JobDetailModal';
import { PrintableWorkOrder } from './components/PrintableWorkOrder';
import { AdminSettings } from './components/AdminSettings';
import { CreateUserLinkPage } from './components/CreateUserLinkPage';
import { ScheduleCalendarView } from './components/ScheduleCalendarView';
import { JobsMapView } from './components/JobsMapView';
import { UserLoginModal } from './components/UserLoginModal';
import { UserLinkLoginModal } from './components/UserLinkLoginModal';
import { RenewCodeModal } from './components/RenewCodeModal';
import { DownloadSourceCodeModal } from './components/DownloadSourceCodeModal';

const SourceCodeDownloadPage = lazy(() =>
  import('./components/SourceCodeDownloadPage').then((m) => ({
    default: m.SourceCodeDownloadPage,
  }))
);
import { ExpiredWarrantyModal } from './components/ExpiredWarrantyModal';
import { DailyQueueAlarmModal } from './components/DailyQueueAlarmModal';
import { AppointmentReminderModal } from './components/AppointmentReminderModal';
import { OverdueTwoDaysAlarmModal } from './components/OverdueTwoDaysAlarmModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { AdminPinModal } from './components/AdminPinModal';
import { BootLoadingScreen } from './components/BootLoadingScreen';
import { CloseJobModal, CloseJobPayload } from './components/CloseJobModal';
import { JobStatusPhotosModal } from './components/JobStatusPhotosModal';
import { isForwardTransitionAllowed } from './components/StatusStepperIcons';
import {
  RepairJob,
  RepairStatus,
  ShopSettings,
  StatusPhotoItem,
  UserAccount,
  ViewTab,
} from './types';
import {
  loadShopSettings,
  saveShopSettings,
  loadUsers,
  saveUsers,
  loadJobs,
  saveJobs,
  clearAllJobs,
  loadCurrentAuth,
  saveCurrentAuth,
  AuthSession,
  checkUrlUserToken,
  checkUrlAdminToken,
  checkUserLinkExpiry,
  getWarrantyStatus,
} from './services/storage';
import {
  sendLineNotification,
  isLineConfigured,
  buildThirtyMinReminderFlexMessage,
  formatThirtyMinReminderText,
  formatNewJobNotification,
  formatStatusChangeNotification,
  formatRescheduleNotification,
  addNotificationLog,
  fetchLineMessagingStatus,
  postServerAlarmAck,
  syncSchedulesAndLineConfigToServer,
} from './services/lineNotify';
import {
  AppointmentReminderSchedule,
  buildUpcomingAppointmentSchedules,
  getDueAppointmentReminders,
  getOverdueTwoDaysUnclosedJobs,
  loadAcknowledgedAppointmentKeys,
  saveAcknowledgedAppointmentKey,
  showAppointmentSystemNotification,
  syncSchedulesToServiceWorker,
} from './services/appointmentAlarm';
import { warrantyAlarmService } from './services/soundAlarm';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  auth as firebaseAuth,
  signInWithGoogle,
  signOutFirebase,
} from './firebase';
import {
  CloudSessionContext,
  initializeAndMergeCloudWorkspace,
  subscribeToCloudWorkspace,
  syncSingleJobToCloud,
  deleteSingleJobFromCloud,
  clearAllJobsFromCloud,
  syncSettingsToCloud,
  syncAccountsToCloud,
  bindUserIdToCloudProfile,
  forcePushAllLocalToCloud,
  markJobDeletedTombstone,
  isBootstrappedAdminEmail,
  isQuotaExceededError,
} from './services/cloudSync';
import { APP_VERSION, APP_REVISION } from './version';
import {
  ShieldAlert,
  AlertTriangle,
  KeyRound,
  RotateCcw,
  BellRing,
  CheckCircle,
  Phone,
  Lock,
  ShieldCheck,
  FileCode,
  Download,
  Link as LinkIcon,
  Cloud,
  CloudOff,
  RefreshCw,
  LogOut,
} from 'lucide-react';

export default function App() {
  // Helper: inspect URL parameters synchronously on initial render so shared User Links NEVER boot as Admin
  const initialUsersList = React.useMemo(() => loadUsers(), []);
  const initialSettingsObj = React.useMemo(() => loadShopSettings(), []);
  const initialUrlAdmin = React.useMemo(
    () => checkUrlAdminToken(initialSettingsObj),
    [initialSettingsObj]
  );
  const initialUrlUserCheck = React.useMemo(
    () => checkUrlUserToken(initialUsersList),
    [initialUsersList]
  );

  const isOpenedViaUserLink = !initialUrlAdmin && initialUrlUserCheck.hasUserParam;
  const urlUserVerifiedInSession =
    isOpenedViaUserLink &&
    initialUrlUserCheck.foundUser &&
    typeof sessionStorage !== 'undefined' &&
    sessionStorage.getItem(`verified_user_link_${initialUrlUserCheck.foundUser.linkToken}`) === '1';

  // Persistence state
  const [settings, setSettings] = useState<ShopSettings>(() => {
    if (isOpenedViaUserLink) {
      return {
        ...initialSettingsObj,
        coverTitle:
          initialSettingsObj.coverTitle === 'Repair Onsite Service'
            ? ''
            : initialSettingsObj.coverTitle,
        coverSubtitle:
          initialSettingsObj.coverSubtitle === 'ช่างหน่อยชุมแพ'
            ? ''
            : initialSettingsObj.coverSubtitle,
      };
    }
    return initialSettingsObj;
  });
  const [users, setUsers] = useState<UserAccount[]>(() => {
    const found = initialUrlUserCheck.foundUser;
    if (found && !initialUsersList.some((u) => u.linkToken === found.linkToken)) {
      const merged = [found, ...initialUsersList];
      saveUsers(merged);
      return merged;
    }
    return initialUsersList;
  });
  const [jobs, setJobs] = useState<RepairJob[]>(loadJobs);
  const [auth, setAuth] = useState<AuthSession>(() => {
    if (initialUrlAdmin) {
      const adminAuth: AuthSession = {
        role: 'admin',
        userName: 'แอดมินเจ้าของร้าน (ลิงก์ถาวร)',
      };
      saveCurrentAuth(adminAuth);
      return adminAuth;
    }
    if (isOpenedViaUserLink) {
      const u = initialUrlUserCheck.foundUser;
      const userAuth: AuthSession = u
        ? {
            role: 'user',
            userId: u.id,
            userName: u.name,
            userPhone: u.phone,
            linkToken: u.linkToken,
            expiresAt: u.expiresAt,
          }
        : { role: 'user', userName: 'ผู้ใช้งาน' };
      saveCurrentAuth(userAuth);
      return userAuth;
    }
    // Root URL (/): if previously saved as admin keep admin; never carry stale User Link expiry (e.g. 45 days) onto root URL
    const saved = loadCurrentAuth();
    if (saved && saved.role === 'admin') {
      return saved;
    }
    return { role: 'user', userName: 'ช่างหน้างาน' };
  });

  // Navigation tab
  const [currentTab, setCurrentTab] = useState<ViewTab>('dashboard');
  const [statusFilterForQueue, setStatusFilterForQueue] = useState<string>('all');
  const [queueSheetForQueue, setQueueSheetForQueue] = useState<'all' | 'closed'>('all');
  const [gmpQuotaExceeded, setGmpQuotaExceeded] = useState(false);

  // Firebase Cloud Database & Cross-Device Sync State
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isFirebaseAuthReady, setIsFirebaseAuthReady] = useState(false);
  const [cloudCtx, setCloudCtx] = useState<CloudSessionContext | null>(null);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<
    'disconnected' | 'syncing' | 'synced' | 'error'
  >('disconnected');
  const [cloudErrorMsg, setCloudErrorMsg] = useState<string | null>(null);
  const [lastCloudSyncAt, setLastCloudSyncAt] = useState<string | null>(null);

  const cloudHasDataRef = useRef(false);
  const cloudCtxRef = useRef<CloudSessionContext | null>(null);
  cloudCtxRef.current = cloudCtx;
  const cloudUnsubRef = useRef<(() => void) | null>(null);
  const latestJobsRef = useRef(jobs);
  latestJobsRef.current = jobs;
  const latestSettingsRef = useRef(settings);
  latestSettingsRef.current = settings;
  const latestUsersRef = useRef(users);
  latestUsersRef.current = users;
  const latestAuthRef = useRef(auth);
  latestAuthRef.current = auth;

  useEffect(() => {
    const handleQuotaExceeded = () => setGmpQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuotaExceeded);
  }, []);

  // LINE Notification Toast state
  const [lineToast, setLineToast] = useState<{
    id: string;
    type: 'success' | 'info' | 'error';
    title: string;
    description: string;
  } | null>(null);

  const showLineToast = (
    title: string,
    description: string,
    type: 'success' | 'info' | 'error' = 'success'
  ) => {
    setLineToast({ id: String(Date.now()), title, description, type });
    setTimeout(() => {
      setLineToast((current) => (current?.title === title ? null : current));
    }, 4500);
  };

  // Modals
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<RepairJob | null>(null);
  const [selectedJob, setSelectedJob] = useState<RepairJob | null>(null);
  const [printingJob, setPrintingJob] = useState<RepairJob | null>(null);
  const [closingJobTarget, setClosingJobTarget] = useState<RepairJob | null>(null);
  const [photoModalState, setPhotoModalState] = useState<{
    jobId: string;
    initialStatus?: RepairStatus;
  } | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  const [isDownloadCodeModalOpen, setIsDownloadCodeModalOpen] = useState(false);
  const [isAdminPinModalOpen, setIsAdminPinModalOpen] = useState(false);

  // When opened via User Link (?user_token=...), require Username & Password first (no premature boot screen)
  const [pendingLinkUser, setPendingLinkUser] = useState<UserAccount | null>(
    isOpenedViaUserLink ? initialUrlUserCheck.foundUser : null
  );
  const [isUserLinkLoginOpen, setIsUserLinkLoginOpen] = useState<boolean>(
    isOpenedViaUserLink && !initialUrlUserCheck.isExpired && !urlUserVerifiedInSession
  );
  const [isBooting, setIsBooting] = useState<boolean>(
    isOpenedViaUserLink ? Boolean(urlUserVerifiedInSession && !initialUrlUserCheck.isExpired) : false
  );

  // Daily Pending Repair Queue Alarm ("วันนี้มีกี่คิวงาน กดยืนยันเพื่อรับทราบ" + หยุดเองเมื่อเลย 5 นาที)
  const todayStr = new Date().toISOString().split('T')[0];
  const dailyAckKey = `acknowledged_daily_queue_${todayStr}`;
  const [isDailyQueueModalOpen, setIsDailyQueueModalOpen] = useState(false);
  const [acknowledgedDailyJobIds, setAcknowledgedDailyJobIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(dailyAckKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const todayPendingJobs = jobs.filter(
    (j) =>
      j.appointmentDate === todayStr &&
      j.status !== 'ซ่อมแล้ว' &&
      j.status !== 'ปิดงาน' &&
      j.status !== 'ยกเลิก'
  );

  const unacknowledgedDailyJobs = todayPendingJobs.filter(
    (j) => !acknowledgedDailyJobIds.includes(j.id)
  );

  // Overdue > 2 Days Unclosed Jobs Alarm ("มีงานค้างยังไม่ปิดงานเกิน2วัน กดเพื่อยืนยัน")
  const overdue2DaysAckKey = `acknowledged_overdue_2days_${todayStr}`;
  const [isOverdue2DaysModalOpen, setIsOverdue2DaysModalOpen] = useState(false);
  const [acknowledgedOverdue2DaysIds, setAcknowledgedOverdue2DaysIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(overdue2DaysAckKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const overdueTwoDaysItems = React.useMemo(() => getOverdueTwoDaysUnclosedJobs(jobs), [jobs]);
  const unacknowledgedOverdue2DaysItems = overdueTwoDaysItems.filter(
    (item) => !acknowledgedOverdue2DaysIds.includes(item.job.id)
  );

  // Expired Warranty Modal and Audio Alarm state
  const [isExpiredWarrantyModalOpen, setIsExpiredWarrantyModalOpen] = useState(false);
  const [acknowledgedExpiredJobIds, setAcknowledgedExpiredJobIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('acknowledged_expired_warranty_jobs_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Calculate jobs whose warranty has expired (ignore jobs with ไม่มีประกัน / 0 days)
  const allExpiredWarrantyJobs = jobs.filter((j) => {
    if (!j.warrantyDays || j.warrantyDays <= 0) return false;
    const ws = getWarrantyStatus(j.warrantyEndDate, j.warrantyDays);
    return ws.status === 'expired';
  });

  // Jobs that have expired and have NOT been acknowledged yet
  const unacknowledgedExpiredJobs = allExpiredWarrantyJobs.filter(
    (j) => !acknowledgedExpiredJobIds.includes(j.id)
  );

  // Link Expiry Warning Modal for user
  const [showExpiredWarning, setShowExpiredWarning] = useState<boolean>(
    Boolean(isOpenedViaUserLink && initialUrlUserCheck.isExpired)
  );

  // 30-Minute-Before Appointment Reminders (Background SW + Voice Alarm + Repeating LINE Messaging API)
  const [dueThirtyMinItems, setDueThirtyMinItems] = useState<
    { job: RepairJob; schedule: AppointmentReminderSchedule }[]
  >([]);
  const [lineSendCount, setLineSendCount] = useState(0);
  const notifiedThirtyMinKeysRef = useRef<Set<string>>(new Set());
  const lineLastSentAtRef = useRef<Record<string, number>>({});

  const dispatchLineThirtyMinReminder = useCallback(
    async (
      items: { job: RepairJob; schedule: AppointmentReminderSchedule }[],
      force = false
    ) => {
      if (items.length === 0) return;
      if (!isLineConfigured(settings.lineNotify)) return;
      if (settings.lineNotify?.notifyBefore30Min === false) return;

      const repeatMinutes = Math.max(1, Number(settings.lineNotify?.repeatIntervalMinutes) || 2);
      const repeatMs = repeatMinutes * 60 * 1000;
      const now = Date.now();
      const appBaseUrl = typeof window !== 'undefined' ? window.location.origin : '';

      for (const { job, schedule } of items) {
        const lastSent = lineLastSentAtRef.current[schedule.ackKey] || 0;
        if (!force && now - lastSent < repeatMs - 10000) {
          continue;
        }
        lineLastSentAtRef.current[schedule.ackKey] = now;
        const flexMsg = buildThirtyMinReminderFlexMessage(job, schedule, appBaseUrl);
        const textMsg = formatThirtyMinReminderText(job, schedule, settings);

        const res = await sendLineNotification(settings.lineNotify, textMsg, [flexMsg]);
        setLineSendCount((c) => c + 1);
        addNotificationLog({
          type: 'reminder_30m',
          jobQueueNumber: job.queueNumber,
          jobProduct: job.product,
          status: job.status,
          success: res.success,
          message: `เตือนก่อนนัด 30 นาที คิว ${job.queueNumber} (${job.appointmentTime})`,
          responseMessage: res.message,
        });
      }
    },
    [settings]
  );

  const refreshDueThirtyMinReminders = useCallback(() => {
    const due = getDueAppointmentReminders(jobs);
    setDueThirtyMinItems(due);
    for (const item of due) {
      if (!notifiedThirtyMinKeysRef.current.has(item.schedule.ackKey)) {
        notifiedThirtyMinKeysRef.current.add(item.schedule.ackKey);
        showAppointmentSystemNotification(item.schedule);
      }
    }
    if (due.length > 0 && !isBooting && !isUserLinkLoginOpen && !showExpiredWarning) {
      dispatchLineThirtyMinReminder(due, false);
    }
  }, [jobs, isBooting, isUserLinkLoginOpen, showExpiredWarning, dispatchLineThirtyMinReminder]);

  // Sync upcoming schedules to Service Worker & Express/Server LINE scheduler whenever jobs or settings change
  useEffect(() => {
    syncSchedulesToServiceWorker(jobs);
    const upcomingSchedules = buildUpcomingAppointmentSchedules(jobs);
    const ackedKeys = loadAcknowledgedAppointmentKeys();
    syncSchedulesAndLineConfigToServer(upcomingSchedules, settings, ackedKeys).then((res) => {
      if (res?.acknowledgedKeys) {
        let changed = false;
        const localSet = new Set(loadAcknowledgedAppointmentKeys());
        for (const k of res.acknowledgedKeys) {
          if (!localSet.has(k)) {
            saveAcknowledgedAppointmentKey(k);
            changed = true;
          }
        }
        if (changed) {
          setDueThirtyMinItems(getDueAppointmentReminders(jobs));
        }
      }
    });
    refreshDueThirtyMinReminders();

    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const handleControllerChange = () => {
      syncSchedulesToServiceWorker(jobs);
    };
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, [jobs, settings, refreshDueThirtyMinReminders]);

  // Poll every 15s for 30-min reminders + sync server LINE acks rapidly (every 4s while alarm is active)
  useEffect(() => {
    const reminderIntervalId = window.setInterval(() => {
      refreshDueThirtyMinReminders();
    }, 15000);

    const ackPollMs = dueThirtyMinItems.length > 0 ? 4000 : 20000;
    const ackPollId = window.setInterval(async () => {
      const status = await fetchLineMessagingStatus();
      if (!status) return;
      if (status.lastSentAt) {
        for (const [k, ts] of Object.entries(status.lastSentAt)) {
          if ((ts as number) > (lineLastSentAtRef.current[k] || 0)) {
            lineLastSentAtRef.current[k] = ts as number;
          }
        }
      }
      if (Array.isArray(status.acknowledgedKeys) && status.acknowledgedKeys.length > 0) {
        const localSet = new Set(loadAcknowledgedAppointmentKeys());
        let stoppedActiveAlarm = false;
        const activeAckKeys = new Set(dueThirtyMinItems.map((d) => d.schedule.ackKey));
        for (const k of status.acknowledgedKeys) {
          if (!localSet.has(k)) {
            saveAcknowledgedAppointmentKey(k);
            if (activeAckKeys.has(k)) {
              stoppedActiveAlarm = true;
            }
          }
        }
        if (stoppedActiveAlarm) {
          refreshDueThirtyMinReminders();
          showLineToast(
            'ยืนยันรับทราบจาก LINE เรียบร้อย ✅',
            'ระบบได้รับคำสั่งยืนยันจาก LINE และปิดเสียงเตือนให้แล้ว',
            'success'
          );
        }
      }
    }, ackPollMs);

    const handleVisibilityOrFocus = () => {
      if (!document.hidden) {
        refreshDueThirtyMinReminders();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      window.clearInterval(reminderIntervalId);
      window.clearInterval(ackPollId);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [dueThirtyMinItems, refreshDueThirtyMinReminders]);

  // Listen for Service Worker notification clicks & quick-ack actions
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const handleSwMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || !data.type) return;

      if (data.type === 'ACK_FROM_SW' && data.ackKey) {
        saveAcknowledgedAppointmentKey(data.ackKey);
        postServerAlarmAck([data.ackKey], 'app');
        refreshDueThirtyMinReminders();
      } else if (data.type === 'OPEN_ALARM_FROM_SW') {
        refreshDueThirtyMinReminders();
        if (data.jobId) {
          const target = jobs.find((j) => j.id === data.jobId);
          if (target) {
            setSelectedJob(target);
          }
        }
      }
    };
    navigator.serviceWorker.addEventListener('message', handleSwMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleSwMessage);
    };
  }, [jobs, refreshDueThirtyMinReminders]);

  // Handle ?ack_alarm=... (tapped confirm URI in LINE) and ?alarm_job=... (tapped OS notification)
  useEffect(() => {
    if (isBooting || isUserLinkLoginOpen || showExpiredWarning) return;
    try {
      const params = new URLSearchParams(window.location.search);
      const ackParam = params.get('ack_alarm');
      const alarmJobId = params.get('alarm_job');
      let modifiedUrl = false;

      if (ackParam) {
        saveAcknowledgedAppointmentKey(ackParam);
        postServerAlarmAck([ackParam], 'line_uri');
        refreshDueThirtyMinReminders();
        showLineToast(
          'ยืนยันรับทราบจาก LINE เรียบร้อย ✅',
          'ปิดเสียงเตือนและการส่งเตือนซ้ำสำหรับคิวงานนี้แล้ว',
          'success'
        );
        params.delete('ack_alarm');
        modifiedUrl = true;
      }

      if (alarmJobId) {
        refreshDueThirtyMinReminders();
        const found = jobs.find((j) => j.id === alarmJobId);
        if (found) {
          setSelectedJob(found);
        }
        params.delete('alarm_job');
        modifiedUrl = true;
      }

      if (modifiedUrl) {
        const nextSearch = params.toString();
        const nextUrl = window.location.pathname + (nextSearch ? `?${nextSearch}` : '') + window.location.hash;
        window.history.replaceState({}, '', nextUrl);
      }
    } catch {}
  }, [isBooting, isUserLinkLoginOpen, showExpiredWarning, jobs, refreshDueThirtyMinReminders]);

  const handleAcknowledgeThirtyMinAlarms = (ackKeys: string[]) => {
    for (const key of ackKeys) {
      saveAcknowledgedAppointmentKey(key);
    }
    postServerAlarmAck(ackKeys, 'app');
    refreshDueThirtyMinReminders();
    syncSchedulesToServiceWorker(jobs);
  };

  // Pre-unlock browser AudioContext & Thai voices on first pointer/touch interaction
  useEffect(() => {
    const unlockOnce = () => {
      warrantyAlarmService.unlockAudio();
    };
    window.addEventListener('pointerdown', unlockOnce, { passive: true, once: true });
    window.addEventListener('touchstart', unlockOnce, { passive: true, once: true });
    return () => {
      window.removeEventListener('pointerdown', unlockOnce);
      window.removeEventListener('touchstart', unlockOnce);
    };
  }, []);

  // Trigger Priority Queue:
  // 1) Before-30m & Overdue Queue Alarm (highest priority)
  // 2) Overdue > 2 Days Unclosed Jobs Alarm ("มีงานค้างยังไม่ปิดงานเกิน2วัน กดเพื่อยืนยัน")
  // 3) Daily Pending Queue Alarm
  // 4) Expired Warranty Alarm
  useEffect(() => {
    if (isBooting || isUserLinkLoginOpen || showExpiredWarning) return;
    if (dueThirtyMinItems.length > 0) return;

    if (unacknowledgedOverdue2DaysItems.length > 0) {
      setIsOverdue2DaysModalOpen(true);
      return;
    }

    if (!isOverdue2DaysModalOpen && unacknowledgedDailyJobs.length > 0) {
      setIsDailyQueueModalOpen(true);
      return;
    }

    if (
      !isOverdue2DaysModalOpen &&
      !isDailyQueueModalOpen &&
      unacknowledgedExpiredJobs.length > 0
    ) {
      setIsExpiredWarrantyModalOpen(true);
    }
  }, [
    jobs,
    isBooting,
    isUserLinkLoginOpen,
    showExpiredWarning,
    dueThirtyMinItems.length,
    isOverdue2DaysModalOpen,
    unacknowledgedOverdue2DaysItems.length,
    isDailyQueueModalOpen,
    unacknowledgedDailyJobs.length,
    unacknowledgedExpiredJobs.length,
  ]);

  const handleAcknowledgeOverdue2Days = () => {
    const allIds = overdueTwoDaysItems.map((item) => item.job.id);
    const merged = Array.from(new Set([...acknowledgedOverdue2DaysIds, ...allIds]));
    setAcknowledgedOverdue2DaysIds(merged);
    try {
      localStorage.setItem(overdue2DaysAckKey, JSON.stringify(merged));
    } catch (e) {
      console.warn('Failed to save acknowledged >2-day overdue jobs', e);
    }
    setIsOverdue2DaysModalOpen(false);
  };

  const handleAcknowledgeDailyQueue = () => {
    const allTodayIds = todayPendingJobs.map((j) => j.id);
    const merged = Array.from(new Set([...acknowledgedDailyJobIds, ...allTodayIds]));
    setAcknowledgedDailyJobIds(merged);
    try {
      localStorage.setItem(dailyAckKey, JSON.stringify(merged));
    } catch (e) {
      console.warn('Failed to save acknowledged daily queue jobs', e);
    }
    setIsDailyQueueModalOpen(false);
  };

  const handleAcknowledgeAllExpired = () => {
    const allExpiredIds = allExpiredWarrantyJobs.map((j) => j.id);
    const merged = Array.from(new Set([...acknowledgedExpiredJobIds, ...allExpiredIds]));
    setAcknowledgedExpiredJobIds(merged);
    try {
      localStorage.setItem('acknowledged_expired_warranty_jobs_v1', JSON.stringify(merged));
    } catch (e) {
      console.warn('Failed to save acknowledged expired jobs', e);
    }
    setIsExpiredWarrantyModalOpen(false);
  };

  // Find active User Account if logged in via specific User Link (avoid matching undefined === undefined)
  const activeUserAccount =
    auth.userId || auth.linkToken
      ? users.find(
          (u) =>
            (auth.userId && u.id === auth.userId) ||
            (auth.linkToken && u.linkToken === auth.linkToken)
        )
      : undefined;

  // Helper: Clear only factory mock defaults when a fresh User Link starts for the first time
  // NEVER wipes real user data or cloud-restored data!
  const initializeFreshUserLinkEnvironment = (linkToken: string) => {
    if (cloudHasDataRef.current || cloudCtxRef.current) {
      return;
    }
    const firstInitKey = `user_link_cleared_first_time_${linkToken}`;
    if (!localStorage.getItem(firstInitKey)) {
      const realCustomJobs = latestJobsRef.current.filter((j) => !/^job-[1-6]$/.test(j.id));
      if (realCustomJobs.length === 0) {
        clearAllJobs();
        setJobs([]);
      } else {
        setJobs(realCustomJobs);
        saveJobs(realCustomJobs);
      }
      setSettings((prev) => {
        // Backup admin settings once if not yet backed up and non-empty
        if (prev.shopName && !localStorage.getItem('repair_onsite_admin_settings_backup_v1')) {
          try {
            localStorage.setItem('repair_onsite_admin_settings_backup_v1', JSON.stringify(prev));
          } catch {}
        }
        const cleaned: ShopSettings = {
          ...prev,
          coverTitle:
            prev.coverTitle === 'Repair Onsite Service' ? '' : prev.coverTitle,
          coverSubtitle:
            prev.coverSubtitle === 'ช่างหน่อยชุมแพ' ? '' : prev.coverSubtitle,
          shopName:
            prev.shopName === 'โปรซ่อมด่วน Onsite Service (Pro Onsite Service Thailand)'
              ? ''
              : prev.shopName,
          phone: prev.phone === '089-765-4321' ? '' : prev.phone,
          lineId: prev.lineId === '@proonsite' ? '' : prev.lineId,
          lineUrl:
            prev.lineUrl === 'https://line.me/ti/p/~@proonsite' ? '' : prev.lineUrl,
          facebook:
            prev.facebook === 'Pro Onsite Service ช่างซ่อมถึงบ้าน'
              ? ''
              : prev.facebook,
          facebookUrl:
            prev.facebookUrl === 'https://facebook.com/ProOnsiteServiceTH'
              ? ''
              : prev.facebookUrl,
          address:
            prev.address === '88/19 ถนนสุขุมวิท 71 แขวงพระโขนงเหนือ เขตวัฒนา กรุงเทพฯ 10110'
              ? ''
              : prev.address,
        };
        saveShopSettings(cleaned);
        return cleaned;
      });
      localStorage.setItem(firstInitKey, 'true');
    }
  };

  // Apply first-time clearing on mount when opened via User Link
  useEffect(() => {
    if (isOpenedViaUserLink && initialUrlUserCheck.foundUser) {
      initializeFreshUserLinkEnvironment(initialUrlUserCheck.foundUser.linkToken);
    }
  }, []);

  const runCloudTask = useCallback(async (task: (ctx: CloudSessionContext) => Promise<void>) => {
    const activeCtx = cloudCtxRef.current;
    if (!activeCtx) return;
    try {
      setCloudSyncStatus('syncing');
      await task(activeCtx);
      setCloudSyncStatus('synced');
      setCloudErrorMsg(null);
      setLastCloudSyncAt(new Date().toLocaleTimeString('th-TH'));
    } catch (err) {
      console.error('Cloud sync write error:', err);
      setCloudSyncStatus('error');
      const msg = isQuotaExceededError(err)
        ? 'โควต้าฐานข้อมูลฟรีวันนี้เต็มแล้ว ข้อมูลถูกบันทึกไว้ในเครื่องเรียบร้อย'
        : 'บันทึกขึ้นคลาวด์ไม่สำเร็จชั่วคราว (ข้อมูลยังเก็บในเครื่องไว้แล้ว)';
      setCloudErrorMsg(msg);
    }
  }, []);

  // Firebase Authentication & Automatic Cross-Device Restore/Backup
  useEffect(() => {
    let active = true;
    const unsubAuth = onAuthStateChanged(firebaseAuth, async (user) => {
      if (!active) return;
      setFirebaseUser(user);
      setIsFirebaseAuthReady(true);

      if (cloudUnsubRef.current) {
        cloudUnsubRef.current();
        cloudUnsubRef.current = null;
      }

      if (!user) {
        setCloudCtx(null);
        cloudCtxRef.current = null;
        cloudHasDataRef.current = false;
        setCloudSyncStatus('disconnected');
        return;
      }

      setCloudSyncStatus('syncing');
      setCloudErrorMsg(null);
      try {
        const curAuth = latestAuthRef.current;
        const { ctx, snapshot, migratedCount } = await initializeAndMergeCloudWorkspace({
          user,
          localJobs: latestJobsRef.current,
          localSettings: latestSettingsRef.current,
          localUsers: latestUsersRef.current,
          linkedUserAccount: curAuth.userId
            ? { id: curAuth.userId, username: curAuth.userName, name: curAuth.userName }
            : null,
          forceAdminWorkspace:
            curAuth.role === 'admin' || isBootstrappedAdminEmail(user.email),
        });

        if (!active) return;
        cloudHasDataRef.current = snapshot.hasCloudData;
        setCloudCtx(ctx);
        cloudCtxRef.current = ctx;

        if (snapshot.settings) {
          setSettings(snapshot.settings);
          saveShopSettings(snapshot.settings);
        }
        setJobs(snapshot.jobs);
        saveJobs(snapshot.jobs);

        if (ctx.isAdmin && snapshot.accounts.length > 0) {
          setUsers(snapshot.accounts);
          saveUsers(snapshot.accounts);
        }

        // Restore bound User ID on a fresh device automatically
        if (
          (snapshot.linkedUserId || snapshot.linkedUsername) &&
          curAuth.role === 'user' &&
          !curAuth.userId
        ) {
          const matchedAcc =
            snapshot.accounts.find(
              (a) =>
                a.id === snapshot.linkedUserId ||
                a.username === snapshot.linkedUsername
            ) ||
            latestUsersRef.current.find(
              (a) =>
                a.id === snapshot.linkedUserId ||
                a.username === snapshot.linkedUsername
            );
          const restoredAuth: AuthSession = {
            role: 'user',
            userId: matchedAcc?.id || snapshot.linkedUserId,
            userName: matchedAcc?.name || snapshot.linkedUsername || ctx.displayName,
            userPhone: matchedAcc?.phone,
            linkToken: matchedAcc?.linkToken,
            expiresAt: matchedAcc?.expiresAt,
          };
          setAuth(restoredAuth);
          saveCurrentAuth(restoredAuth);
        }

        // Attach live real-time listeners once authenticated
        cloudUnsubRef.current = subscribeToCloudWorkspace(ctx, {
          onSettingsUpdate: (cloudSettings) => {
            setSettings(cloudSettings);
            saveShopSettings(cloudSettings);
            setLastCloudSyncAt(new Date().toLocaleTimeString('th-TH'));
          },
          onJobsUpdate: (cloudJobs) => {
            setJobs(cloudJobs);
            saveJobs(cloudJobs);
            setLastCloudSyncAt(new Date().toLocaleTimeString('th-TH'));
          },
          onAccountsUpdate: (cloudAccounts) => {
            if (cloudAccounts.length > 0) {
              setUsers(cloudAccounts);
              saveUsers(cloudAccounts);
              setLastCloudSyncAt(new Date().toLocaleTimeString('th-TH'));
            }
          },
        });

        setCloudSyncStatus('synced');
        setLastCloudSyncAt(new Date().toLocaleTimeString('th-TH'));
        showLineToast(
          migratedCount > 0
            ? 'เชื่อมต่อคลาวด์ & สำรองข้อมูลเดิมแล้ว ☁️'
            : 'ซิงค์ข้อมูลจากคลาวด์สำเร็จ ☁️',
          `บัญชี ${user.email} · คิวงานทั้งหมด ${snapshot.jobs.length} รายการ`,
          'success'
        );
      } catch (err) {
        if (!active) return;
        console.error('Firebase sync initialization failed:', err);
        setCloudSyncStatus('error');
        const msg = isQuotaExceededError(err)
          ? 'โควต้าฐานข้อมูลฟรีวันนี้เต็มแล้ว กรุณาลองใหม่พรุ่งนี้'
          : 'ไม่สามารถซิงค์ข้อมูลคลาวด์ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง';
        setCloudErrorMsg(msg);
        showLineToast('เชื่อมต่อคลาวด์ไม่สำเร็จ', msg, 'error');
      }
    });

    return () => {
      active = false;
      unsubAuth();
      if (cloudUnsubRef.current) {
        cloudUnsubRef.current();
        cloudUnsubRef.current = null;
      }
    };
  }, []);

  const handleGoogleCloudSignIn = async () => {
    try {
      setCloudSyncStatus('syncing');
      setCloudErrorMsg(null);
      await signInWithGoogle();
    } catch (err: any) {
      setCloudSyncStatus(cloudCtxRef.current ? 'synced' : 'disconnected');
      const code = err?.code || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        return;
      }
      const msg =
        code === 'auth/popup-blocked'
          ? 'เบราว์เซอร์บล็อกหน้าต่างล็อกอิน Google กรุณาอนุญาต Pop-up แล้วกดอีกครั้ง'
          : 'เข้าสู่ระบบ Google ไม่สำเร็จ กรุณาลองใหม่';
      setCloudErrorMsg(msg);
      showLineToast('เข้าสู่ระบบ Google ไม่สำเร็จ', msg, 'error');
    }
  };

  const handleForceCloudBackup = async () => {
    const activeCtx = cloudCtxRef.current;
    if (!activeCtx) {
      await handleGoogleCloudSignIn();
      return;
    }
    try {
      setCloudSyncStatus('syncing');
      const count = await forcePushAllLocalToCloud(activeCtx, {
        jobs: latestJobsRef.current,
        settings: latestSettingsRef.current,
        users: latestUsersRef.current,
      });
      setCloudSyncStatus('synced');
      setLastCloudSyncAt(new Date().toLocaleTimeString('th-TH'));
      showLineToast(
        'สำรองข้อมูลทั้งหมดขึ้นคลาวด์แล้ว ✅',
        `บันทึกคิวงาน ${latestJobsRef.current.length} รายการ และการตั้งค่าร้านเรียบร้อย (${count} รายการ)`,
        'success'
      );
    } catch (err) {
      console.error('Manual cloud backup failed:', err);
      setCloudSyncStatus('error');
      showLineToast(
        'สำรองข้อมูลไม่สำเร็จ',
        isQuotaExceededError(err)
          ? 'โควต้าฐานข้อมูลฟรีวันนี้เต็มแล้ว'
          : 'เกิดข้อผิดพลาดระหว่างอัปโหลดข้อมูลขึ้นคลาวด์',
        'error'
      );
    }
  };

  const handleCloudSignOut = async () => {
    await signOutFirebase();
    showLineToast('ออกจากบัญชีคลาวด์แล้ว', 'ข้อมูลในเครื่องยังคงอยู่', 'info');
  };

  // Save changes to localStorage + Cloud Firestore
  const handleSaveSettings = (newSettings: ShopSettings) => {
    setSettings(newSettings);
    saveShopSettings(newSettings);
    void runCloudTask((ctx) => syncSettingsToCloud(ctx, newSettings));
  };

  const handleSaveUsers = (newUsers: UserAccount[]) => {
    setUsers(newUsers);
    saveUsers(newUsers);
    void runCloudTask((ctx) => syncAccountsToCloud(ctx, newUsers));
  };

  const handleSaveJobs = (newJobs: RepairJob[]) => {
    setJobs(newJobs);
    saveJobs(newJobs);
  };

  // Job operations
  const handleCreateOrUpdateJob = (job: RepairJob) => {
    const exists = jobs.some((j) => j.id === job.id);
    let updated: RepairJob[];
    if (exists) {
      updated = jobs.map((j) => (j.id === job.id ? job : j));
    } else {
      updated = [job, ...jobs];

      // Automatically trigger LINE Messaging API for new appointments if enabled
      if (
        isLineConfigured(settings.lineNotify) &&
        settings.lineNotify?.notifyOnNewJob
      ) {
        const msg = formatNewJobNotification(job, settings);
        sendLineNotification(settings.lineNotify, msg)
          .then((res) => {
            addNotificationLog({
              type: 'new_job',
              jobQueueNumber: job.queueNumber,
              jobProduct: job.product,
              status: job.status,
              success: res.success,
              message: `แจ้งเตือนนัดหมายใหม่ คิว ${job.queueNumber} (${job.product})`,
              responseMessage: res.message,
            });
            if (res.success) {
              showLineToast(
                'ส่ง LINE นัดหมายใหม่ 🔔',
                `คิวงาน ${job.queueNumber} (${job.customer.name}) แจ้งเตือนเข้า LINE เรียบร้อยแล้ว`,
                'success'
              );
            } else {
              showLineToast(
                'ส่ง LINE ไม่สำเร็จ',
                res.message,
                'error'
              );
            }
          })
          .catch((err) => {
            console.error('Failed to dispatch LINE notification', err);
          });
      }
    }
    handleSaveJobs(updated);
    void runCloudTask((ctx) => syncSingleJobToCloud(ctx, job));
    setEditingJob(null);
  };

  const handleDeleteJob = (jobId: string) => {
    if (confirm('คุณแน่ใจหรือไม่ว่าต้องการลบรายการคิวงานนี้?')) {
      markJobDeletedTombstone(jobId);
      const updated = jobs.filter((j) => j.id !== jobId);
      handleSaveJobs(updated);
      if (selectedJob?.id === jobId) setSelectedJob(null);
      void runCloudTask((ctx) => deleteSingleJobFromCloud(ctx, jobId));
    }
  };

  const handleClearAllJobs = () => {
    jobs.forEach((j) => markJobDeletedTombstone(j.id));
    clearAllJobs();
    setJobs([]);
    setSelectedJob(null);
    setEditingJob(null);
    void runCloudTask((ctx) => clearAllJobsFromCloud(ctx));
    showLineToast(
      'ล้างข้อมูลเก่าเรียบร้อย 🗑️',
      'ล้างรายการคิวงานทั้งหมดออกแล้ว พร้อมเริ่มต้นรับงานใหม่จาก Q-01',
      'info'
    );
  };

  const handleStatusChange = (
    jobId: string,
    newStatus: RepairStatus,
    allowOverride = false
  ) => {
    const targetJob = jobs.find((j) => j.id === jobId);
    if (!targetJob) return;

    const previousStatus = targetJob.status;
    if (previousStatus === newStatus) return;

    if (!allowOverride && !isForwardTransitionAllowed(previousStatus, newStatus)) {
      showLineToast(
        'ไม่สามารถย้อนสถานะงานได้',
        'ระบบอัปเดตสถานะเดินหน้าทางเดียว หากต้องการแก้ไขให้กดปุ่ม "แก้ไขสถานะ"',
        'info'
      );
      return;
    }

    // Requirement: เมื่อถึงสถานะปิดงานซ่อม ให้ใส่ยอดค่าซ่อมและระยะประกัน ก่อนกดบันทึก
    if (newStatus === 'ปิดงาน') {
      setClosingJobTarget(targetJob);
      return;
    }

    const updated = jobs.map((j) => {
      if (j.id === jobId) {
        // If status becomes completed, update warranty start date to today
        let warrantyEndDate = j.warrantyEndDate;
        let warrantyStartDate = j.warrantyStartDate;
        if (newStatus === 'ซ่อมแล้ว') {
          const now = new Date();
          warrantyStartDate = now.toISOString().split('T')[0];
          const end = new Date(now);
          end.setDate(end.getDate() + j.warrantyDays);
          warrantyEndDate = end.toISOString().split('T')[0];
        }
        return {
          ...j,
          status: newStatus,
          warrantyStartDate,
          warrantyEndDate,
        };
      }
      return j;
    });
    handleSaveJobs(updated);

    const updatedJob = updated.find((j) => j.id === jobId);
    if (updatedJob) {
      void runCloudTask((ctx) => syncSingleJobToCloud(ctx, updatedJob));
    }
    if (selectedJob?.id === jobId && updatedJob) {
      setSelectedJob(updatedJob);
    }

    // Automatically trigger LINE Messaging API for status update if enabled
    if (
      updatedJob &&
      previousStatus !== newStatus &&
      isLineConfigured(settings.lineNotify) &&
      settings.lineNotify?.notifyOnStatusChange
    ) {
      const msg = formatStatusChangeNotification(
        updatedJob,
        previousStatus,
        newStatus,
        settings
      );
      sendLineNotification(settings.lineNotify, msg)
        .then((res) => {
          addNotificationLog({
            type: 'status_change',
            jobQueueNumber: updatedJob.queueNumber,
            jobProduct: updatedJob.product,
            status: newStatus,
            success: res.success,
            message: `อัปเดตสถานะคิว ${updatedJob.queueNumber} เป็น "${newStatus}"`,
            responseMessage: res.message,
          });
          if (res.success) {
            showLineToast(
              `อัปเดตสถานะ -> "${newStatus}" 🔔`,
              `ส่งแจ้งเตือนคิว ${updatedJob.queueNumber} (${updatedJob.customer.name}) ไปยัง LINE เรียบร้อย`,
              'success'
            );
          }
        })
        .catch((err) => {
          console.error('Failed to send status update to LINE Notify', err);
        });
    }
  };

  const handleConfirmCloseJob = (jobId: string, payload: CloseJobPayload) => {
    const targetJob = jobs.find((j) => j.id === jobId);
    if (!targetJob) return;
    const previousStatus = targetJob.status;

    const updated = jobs.map((j) => {
      if (j.id !== jobId) return j;
      const existingClosingPhotos = j.statusPhotos?.['ปิดงาน'] || [];
      const mergedStatusPhotos =
        payload.closingPhotos.length > 0
          ? {
              ...(j.statusPhotos || {}),
              ปิดงาน: [...existingClosingPhotos, ...payload.closingPhotos],
            }
          : j.statusPhotos;

      return {
        ...j,
        status: 'ปิดงาน' as RepairStatus,
        actualCost: payload.actualCost,
        warrantyDays: payload.warrantyDays,
        warrantyStartDate: payload.warrantyStartDate,
        warrantyEndDate: payload.warrantyEndDate,
        closedAt: payload.closedAt,
        statusPhotos: mergedStatusPhotos,
        notes: payload.notes !== undefined ? payload.notes : j.notes,
      };
    });

    handleSaveJobs(updated);
    const updatedJob = updated.find((j) => j.id === jobId);
    if (updatedJob) {
      void runCloudTask((ctx) => syncSingleJobToCloud(ctx, updatedJob));
    }
    if (selectedJob?.id === jobId && updatedJob) {
      setSelectedJob(updatedJob);
    }

    showLineToast(
      `ปิดงานคิว ${targetJob.queueNumber} สำเร็จ ✅`,
      `บันทึกค่าซ่อมจริง ฿${payload.actualCost.toLocaleString()} และจัดเก็บลงตารางสรุปงานที่ปิดแล้ว (Excel) เรียบร้อย`,
      'success'
    );

    if (
      updatedJob &&
      isLineConfigured(settings.lineNotify) &&
      settings.lineNotify?.notifyOnStatusChange
    ) {
      const msg = formatStatusChangeNotification(
        updatedJob,
        previousStatus,
        'ปิดงาน',
        settings
      );
      sendLineNotification(settings.lineNotify, msg)
        .then((res) => {
          addNotificationLog({
            type: 'status_change',
            jobQueueNumber: updatedJob.queueNumber,
            jobProduct: updatedJob.product,
            status: 'ปิดงาน',
            success: res.success,
            message: `ปิดงานคิว ${updatedJob.queueNumber} (฿${payload.actualCost.toLocaleString()})`,
            responseMessage: res.message,
          });
        })
        .catch((err) => console.error('Failed to send close job LINE notification', err));
    }
  };

  const handleUpdateJobStatusPhotos = (
    jobId: string,
    status: RepairStatus,
    photosForStatus: StatusPhotoItem[]
  ) => {
    const updated = jobs.map((j) => {
      if (j.id !== jobId) return j;
      return {
        ...j,
        statusPhotos: {
          ...(j.statusPhotos || {}),
          [status]: photosForStatus,
        },
      };
    });
    handleSaveJobs(updated);
    const updatedJob = updated.find((j) => j.id === jobId);
    if (updatedJob) {
      void runCloudTask((ctx) => syncSingleJobToCloud(ctx, updatedJob));
    }
    if (selectedJob?.id === jobId && updatedJob) {
      setSelectedJob(updatedJob);
    }
  };

  const handleUpdateActualCost = (jobId: string, cost: number) => {
    const updated = jobs.map((j) => (j.id === jobId ? { ...j, actualCost: cost } : j));
    handleSaveJobs(updated);
    const updatedJob = updated.find((j) => j.id === jobId);
    if (updatedJob) {
      void runCloudTask((ctx) => syncSingleJobToCloud(ctx, updatedJob));
    }
    if (selectedJob?.id === jobId) {
      setSelectedJob({ ...selectedJob, actualCost: cost });
    }
  };

  const handleUpdateClosingDetails = (
    jobId: string,
    actualCost: number,
    warrantyDays: number
  ) => {
    const cleanDays = Math.max(0, Math.floor(Number(warrantyDays) || 0));
    const targetJob = jobs.find((j) => j.id === jobId);
    if (!targetJob) return;

    const startDate =
      targetJob.warrantyStartDate ||
      targetJob.closedAt ||
      targetJob.appointmentDate ||
      new Date().toISOString().split('T')[0];
    const endObj = new Date(startDate);
    endObj.setDate(endObj.getDate() + cleanDays);
    const warrantyEndDate = endObj.toISOString().split('T')[0];

    const updated = jobs.map((j) =>
      j.id === jobId
        ? {
            ...j,
            actualCost,
            warrantyDays: cleanDays,
            warrantyStartDate: startDate,
            warrantyEndDate,
          }
        : j
    );
    handleSaveJobs(updated);
    const updatedJob = updated.find((j) => j.id === jobId);
    if (updatedJob) {
      void runCloudTask((ctx) => syncSingleJobToCloud(ctx, updatedJob));
    }
    if (selectedJob?.id === jobId && updatedJob) {
      setSelectedJob(updatedJob);
    }

    showLineToast(
      `อัปเดตค่าซ่อมจริง & ประกันคิว ${targetJob.queueNumber} ✅`,
      `ค่าซ่อมจริง ฿${actualCost.toLocaleString()} • ${
        cleanDays === 0 ? 'ไม่มีประกัน (0 วัน)' : `รับประกัน ${cleanDays} วัน (ถึง ${warrantyEndDate})`
      }`,
      'success'
    );
  };

  const handleRescheduleJob = (
    jobId: string,
    newDate: string,
    newTime: string,
    reason?: string
  ) => {
    const targetJob = jobs.find((j) => j.id === jobId);
    if (!targetJob) return;

    const previousDate = targetJob.appointmentDate;
    const previousTime = targetJob.appointmentTime;

    const updated = jobs.map((j) => {
      if (j.id !== jobId) return j;
      let warrantyEndDate = j.warrantyEndDate;
      if (j.status !== 'ซ่อมแล้ว' && j.status !== 'ปิดงาน') {
        const base = new Date(newDate || j.loggedDate);
        if (!isNaN(base.getTime())) {
          base.setDate(base.getDate() + (Number(j.warrantyDays) || 0));
          warrantyEndDate = base.toISOString().split('T')[0];
        }
      }
      const noteAppend = reason
        ? `[เลื่อนนัด ${previousDate} ${previousTime || ''} -> ${newDate} ${newTime}: ${reason}]`
        : '';
      const mergedNotes = noteAppend
        ? j.notes
          ? `${j.notes} ${noteAppend}`
          : noteAppend
        : j.notes;

      return {
        ...j,
        appointmentDate: newDate,
        appointmentTime: newTime,
        warrantyEndDate,
        notes: mergedNotes,
      };
    });

    handleSaveJobs(updated);
    const updatedJob = updated.find((j) => j.id === jobId);
    if (updatedJob) {
      void runCloudTask((ctx) => syncSingleJobToCloud(ctx, updatedJob));
    }
    if (selectedJob?.id === jobId && updatedJob) {
      setSelectedJob(updatedJob);
    }

    showLineToast(
      `เปลี่ยนนัดหมายคิว ${targetJob.queueNumber} สำเร็จ 📅`,
      `นัดใหม่: ${newDate} (${newTime})`,
      'success'
    );

    if (
      updatedJob &&
      isLineConfigured(settings.lineNotify) &&
      settings.lineNotify?.notifyOnStatusChange
    ) {
      const msg = formatRescheduleNotification(
        updatedJob,
        previousDate,
        previousTime,
        settings,
        reason
      );
      sendLineNotification(settings.lineNotify, msg)
        .then((res) => {
          addNotificationLog({
            type: 'status_change',
            jobQueueNumber: updatedJob.queueNumber,
            jobProduct: updatedJob.product,
            status: updatedJob.status,
            success: res.success,
            message: `เลื่อนนัดคิว ${updatedJob.queueNumber} เป็น ${newDate} (${newTime})`,
            responseMessage: res.message,
          });
        })
        .catch((err) => console.error('Failed to send reschedule LINE notification', err));
    }
  };

  const handleCancelJob = (jobId: string, reason?: string) => {
    const targetJob = jobs.find((j) => j.id === jobId);
    if (!targetJob) return;
    const previousStatus = targetJob.status;

    const updated = jobs.map((j) => {
      if (j.id !== jobId) return j;
      const cancelNote = reason ? `[ยกเลิกงาน: ${reason}]` : '';
      const mergedNotes = cancelNote
        ? j.notes
          ? `${j.notes} ${cancelNote}`
          : cancelNote
        : j.notes;
      return {
        ...j,
        status: 'ยกเลิก' as RepairStatus,
        cancelReason: reason || j.cancelReason,
        notes: mergedNotes,
      };
    });

    handleSaveJobs(updated);
    const updatedJob = updated.find((j) => j.id === jobId);
    if (updatedJob) {
      void runCloudTask((ctx) => syncSingleJobToCloud(ctx, updatedJob));
    }
    if (selectedJob?.id === jobId && updatedJob) {
      setSelectedJob(updatedJob);
    }

    showLineToast(
      `ยกเลิกงานคิว ${targetJob.queueNumber} แล้ว`,
      reason ? `เหตุผล: ${reason}` : 'เปลี่ยนสถานะเป็น "ยกเลิก" เรียบร้อย',
      'info'
    );

    if (
      updatedJob &&
      previousStatus !== 'ยกเลิก' &&
      isLineConfigured(settings.lineNotify) &&
      settings.lineNotify?.notifyOnStatusChange
    ) {
      const msg = formatStatusChangeNotification(
        updatedJob,
        previousStatus,
        'ยกเลิก',
        settings
      );
      sendLineNotification(settings.lineNotify, msg)
        .then((res) => {
          addNotificationLog({
            type: 'status_change',
            jobQueueNumber: updatedJob.queueNumber,
            jobProduct: updatedJob.product,
            status: 'ยกเลิก',
            success: res.success,
            message: `ยกเลิกงานคิว ${updatedJob.queueNumber}`,
            responseMessage: res.message,
          });
        })
        .catch((err) => console.error('Failed to send cancel job LINE notification', err));
    }
  };

  // Generate next queue number
  const nextQueueNumber = React.useMemo(() => {
    const count = jobs.length + 1;
    return `Q-${String(count).padStart(2, '0')}`;
  }, [jobs]);

  // Auth actions
  const handleSwitchToAdmin = () => {
    const newAuth: AuthSession = { role: 'admin', userName: 'แอดมินเจ้าของร้าน' };
    setAuth(newAuth);
    saveCurrentAuth(newAuth);
    // Restore admin shop settings if cleared during user link session on same device
    if (!settings.shopName) {
      try {
        const backupRaw = localStorage.getItem('repair_onsite_admin_settings_backup_v1');
        if (backupRaw) {
          const restored = JSON.parse(backupRaw) as ShopSettings;
          setSettings(restored);
          saveShopSettings(restored);
        }
      } catch {}
    }
  };

  const handleSwitchToUser = (user: UserAccount) => {
    const expiry = checkUserLinkExpiry(user.expiresAt);
    const newAuth: AuthSession = {
      role: 'user',
      userId: user.id,
      userName: user.name,
      userPhone: user.phone,
      linkToken: user.linkToken,
      expiresAt: user.expiresAt,
    };
    setAuth(newAuth);
    saveCurrentAuth(newAuth);

    if (user.linkToken) {
      initializeFreshUserLinkEnvironment(user.linkToken);
    }

    if (cloudCtxRef.current && user.id) {
      void runCloudTask(async (ctx) => {
        const updatedCtx = await bindUserIdToCloudProfile(ctx, {
          id: user.id,
          username: user.username || user.name,
          name: user.name,
        });
        setCloudCtx(updatedCtx);
        cloudCtxRef.current = updatedCtx;
      });
    }

    if (expiry.isExpired) {
      setShowExpiredWarning(true);
    } else {
      // แสดงการบูทเข้าสู่ระบบประมาณ 3-4 วินาที พร้อมพิมพ์ดีด "สร้างสรรค์โดยช่างหน่อยชุมแพ"
      setIsBooting(true);
    }

    // If currently on admin-only tabs (create_link, source_code), redirect to dashboard
    if (currentTab === 'create_link' || currentTab === 'source_code') {
      setCurrentTab('dashboard');
    }
  };

  const handleLogout = () => {
    saveCurrentAuth(null);
    setIsLoginModalOpen(true);
  };

  // Security guard: user cannot access admin settings or source code
  const isAdmin = auth.role === 'admin';

  const handleTabChange = (tab: ViewTab) => {
    if (!isAdmin && (tab === 'create_link' || tab === 'source_code')) {
      showLineToast(
        'สิทธิ์ถูกจำกัดเฉพาะแอดมิน',
        'กรุณาเข้าสู่ระบบแอดมิน (Admin) ก่อนเข้าถึงเมนูนี้',
        'info'
      );
      return;
    }
    setCurrentTab(tab);
  };

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-clip bg-slate-100/70 text-slate-900 flex flex-col font-['Prompt',sans-serif]">
      {gmpQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {/* Top Bar Navigation */}
      <Navbar
        currentTab={currentTab}
        onTabChange={handleTabChange}
        auth={auth}
        activeUserAccount={activeUserAccount}
        onOpenNewJob={() => {
          setEditingJob(null);
          setIsJobModalOpen(true);
        }}
        onOpenLoginModal={() => setIsLoginModalOpen(true)}
        onOpenRenewModal={() => setIsRenewModalOpen(true)}
        onSwitchToAdmin={handleSwitchToAdmin}
        onSwitchToUser={handleSwitchToUser}
        users={users}
        onLogout={handleLogout}
        onOpenDownloadCode={() => setCurrentTab('source_code')}
        expiredWarrantyCount={allExpiredWarrantyJobs.length}
        onOpenExpiredWarrantyModal={() => setIsExpiredWarrantyModalOpen(true)}
        onRequestAdminLogin={() => setIsAdminPinModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">

        {/* Standalone Admin Command Bar (Visible strictly AFTER Admin Login) */}
        {isAdmin && (
          <div className="mb-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl px-4 py-3 shadow-md border border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white flex items-center gap-2 flex-wrap">
                  <span>แผงควบคุมแอดมิน (Admin)</span>
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                    v{APP_VERSION} ({APP_REVISION})
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 truncate">
                  ปุ่มดาวน์โหลด Source Code แสดงเฉพาะเมื่อเข้าสู่ระบบแอดมินแล้วเท่านั้น
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap shrink-0">
              {currentTab !== 'create_link' && (
                <button
                  type="button"
                  onClick={() => setCurrentTab('create_link')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  <LinkIcon className="w-3.5 h-3.5 text-blue-300" />
                  <span>สร้าง link user</span>
                </button>
              )}

              {currentTab !== 'source_code' ? (
                <button
                  type="button"
                  onClick={() => setCurrentTab('source_code')}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-bold border border-emerald-300/40 shadow-sm transition-all cursor-pointer active:scale-95"
                >
                  <FileCode className="w-4 h-4 shrink-0" />
                  <span>ดาวน์โหลด Source Code (v{APP_VERSION})</span>
                  <Download className="w-3.5 h-3.5 shrink-0" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setCurrentTab('dashboard')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  <span>&larr; กลับหน้าแดชบอร์ด</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Cross-Device Cloud Sync Bar (Bind Database to User ID & Admin across phones) */}
        {isFirebaseAuthReady && (
          <div
            className={`mb-4 rounded-2xl px-4 py-2.5 border shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
              firebaseUser
                ? cloudSyncStatus === 'error'
                  ? 'bg-red-50 border-red-200 text-red-900'
                  : 'bg-emerald-50/90 border-emerald-200 text-emerald-950'
                : 'bg-blue-50/90 border-blue-200 text-blue-950'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  firebaseUser
                    ? cloudSyncStatus === 'error'
                      ? 'bg-red-100 text-red-600'
                      : 'bg-emerald-600 text-white'
                    : 'bg-blue-600 text-white'
                }`}
              >
                {firebaseUser ? (
                  <Cloud className="w-4 h-4" />
                ) : (
                  <CloudOff className="w-4 h-4" />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold flex items-center gap-2 flex-wrap">
                  <span>
                    {firebaseUser
                      ? `ซิงค์คลาวด์แล้ว: ${firebaseUser.email}`
                      : 'สำรองและผูกฐานข้อมูลข้ามเครื่อง (Google Cloud)'}
                  </span>
                  {firebaseUser && cloudCtx && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/80 border border-emerald-200 text-emerald-800">
                      {cloudCtx.isAdmin
                        ? 'Admin Master'
                        : `User ID: ${
                            cloudCtx.linkedUsername ||
                            cloudCtx.linkedUserId ||
                            auth.userName ||
                            cloudCtx.workspaceId
                          }`}
                    </span>
                  )}
                </div>
                <p className="text-[11px] opacity-80 truncate">
                  {cloudErrorMsg
                    ? cloudErrorMsg
                    : firebaseUser
                    ? `คิวงาน ${jobs.length} รายการ · การตั้งค่าและข้อมูลแอดมินซิงค์อัตโนมัติทุกเครื่อง${
                        lastCloudSyncAt ? ` (ล่าสุด ${lastCloudSyncAt})` : ''
                      }`
                    : 'เข้าสู่ระบบ Google เพื่อเก็บคิวงาน การตั้งค่าร้าน และข้อมูลแอดมินไว้กับ User ID — เปลี่ยนโทรศัพท์เครื่องใหม่ข้อมูลไม่หาย'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {firebaseUser ? (
                <>
                  <button
                    type="button"
                    disabled={cloudSyncStatus === 'syncing'}
                    onClick={handleForceCloudBackup}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-emerald-100/70 text-emerald-900 border border-emerald-300 text-xs font-bold transition-colors cursor-pointer disabled:opacity-60"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${
                        cloudSyncStatus === 'syncing' ? 'animate-spin' : ''
                      }`}
                    />
                    <span>สำรองทันที</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCloudSignOut}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/80 hover:bg-white text-slate-700 border border-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                    title="ออกจากบัญชี Google Cloud"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">ออกคลาวด์</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={cloudSyncStatus === 'syncing'}
                  onClick={handleGoogleCloudSignIn}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-60"
                >
                  <Cloud className="w-3.5 h-3.5" />
                  <span>
                    {cloudSyncStatus === 'syncing'
                      ? 'กำลังเชื่อมต่อ...'
                      : 'เข้าสู่ระบบ Google (ซิงค์คลาวด์)'}
                  </span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* User Link Expiration Banner (if expired or near expiry) */}
        {!isAdmin && activeUserAccount && (
          <div className="mb-6">
            {(() => {
              const exp = checkUserLinkExpiry(activeUserAccount.expiresAt);
              if (exp.isExpired) {
                return (
                  <div className="p-4 rounded-xl bg-red-50 border border-red-300 text-red-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-red-100 rounded-lg text-red-700">
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm">
                          ลิงก์เข้าใช้งานของท่านหมดอายุแล้ว! (เมื่อวันที่ {exp.formattedDate})
                        </h4>
                        <p className="text-xs text-red-700">
                          ท่านไม่สามารถรับงานใหม่ได้ กรุณากรอกรหัสต่ออายุการใช้งาน หรือติดต่อแอดมิน
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsRenewModalOpen(true)}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shrink-0 transition-colors shadow-xs"
                    >
                      ใส่รหัสต่ออายุใช้งาน
                    </button>
                  </div>
                );
              }
              if (exp.daysRemaining <= 7) {
                return (
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        แจ้งเตือน: ลิงก์เข้าใช้งานของท่านจะหมดอายุในอีก{' '}
                        <strong>{exp.daysRemaining} วัน</strong> ({exp.formattedDate})
                      </span>
                    </div>
                    <button
                      onClick={() => setIsRenewModalOpen(true)}
                      className="text-xs font-semibold text-amber-800 bg-amber-200/80 hover:bg-amber-200 px-3 py-1 rounded-md"
                    >
                      ต่ออายุ
                    </button>
                  </div>
                );
              }
              return null;
            })()}
          </div>
        )}

        {/* View Tabs Switching */}
        {currentTab === 'dashboard' && (
          <Dashboard
            jobs={jobs}
            settings={settings}
            onNavigateToQueue={(statusFilter) => {
              if (statusFilter === 'closed_sheet') {
                setQueueSheetForQueue('closed');
                setStatusFilterForQueue('all');
              } else {
                setQueueSheetForQueue('all');
                setStatusFilterForQueue(statusFilter || 'all');
              }
              setCurrentTab('queue');
            }}
            onOpenNewJob={() => {
              setEditingJob(null);
              setIsJobModalOpen(true);
            }}
            onClearAllJobs={handleClearAllJobs}
            isAdmin={isAdmin}
            onRequestAdminLogin={() => setIsAdminPinModalOpen(true)}
            onNavigateToCreateLink={() => setCurrentTab('create_link')}
            onNavigateToSourceCode={() => setCurrentTab('source_code')}
          />
        )}

        {currentTab === 'queue' && (
          <QueueTable
            jobs={jobs}
            onSelectJob={(job) => setSelectedJob(job)}
            onEditJob={(job) => {
              setEditingJob(job);
              setIsJobModalOpen(true);
            }}
            onDeleteJob={handleDeleteJob}
            onStatusChange={handleStatusChange}
            onRescheduleJob={handleRescheduleJob}
            onCancelJob={handleCancelJob}
            onPrintJob={(job) => setPrintingJob(job)}
            onOpenStatusPhotos={(job, status) =>
              setPhotoModalState({ jobId: job.id, initialStatus: status || job.status })
            }
            isAdmin={isAdmin}
            currentUserId={auth.userId}
            initialStatusFilter={statusFilterForQueue}
            initialSheet={queueSheetForQueue}
          />
        )}

        {currentTab === 'calendar' && (
          <ScheduleCalendarView
            jobs={jobs}
            onSelectJob={(job) => setSelectedJob(job)}
            onOpenNewJob={() => {
              setEditingJob(null);
              setIsJobModalOpen(true);
            }}
          />
        )}

        {currentTab === 'map' && (
          <JobsMapView
            jobs={jobs}
            onSelectJob={(job) => setSelectedJob(job)}
            onOpenNewJob={() => {
              setEditingJob(null);
              setIsJobModalOpen(true);
            }}
          />
        )}

        {currentTab === 'create_link' && isAdmin && (
          <CreateUserLinkPage
            users={users}
            onSaveUsers={handleSaveUsers}
            onSwitchToUser={handleSwitchToUser}
            onOpenDownloadCode={() => setCurrentTab('source_code')}
          />
        )}

        {currentTab === 'source_code' && isAdmin && (
          <Suspense
            fallback={
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-xs text-slate-500">
                กำลังโหลดแพ็กเกจ Source Code ล่าสุด...
              </div>
            }
          >
            <SourceCodeDownloadPage
              isAdmin={isAdmin}
              settings={settings}
              jobs={jobs}
              users={users}
            />
          </Suspense>
        )}

        {currentTab === 'settings' && (
          <AdminSettings
            settings={settings}
            onSaveSettings={handleSaveSettings}
            isAdmin={isAdmin}
            jobs={jobs}
            cloudCtx={cloudCtx}
            cloudUserEmail={firebaseUser?.email || null}
            cloudSyncStatus={cloudSyncStatus}
            lastCloudSyncAt={lastCloudSyncAt}
            onGoogleSignIn={handleGoogleCloudSignIn}
            onForceCloudBackup={handleForceCloudBackup}
            onCloudSignOut={handleCloudSignOut}
          />
        )}
      </main>

      {/* Footer: แสดงเฉพาะโหมด Admin เท่านั้น (ลิงก์ User ลบข้อมูลร้านค้าด้านล่างออก) */}
      {isAdmin && (
        <footer className="mt-auto border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>{settings.shopName} · ระบบจัดตารางคิวงานซ่อมนอกสถานที่ (Onsite Service)</span>
            <div className="flex items-center gap-2 font-semibold text-slate-600">
              <span>ผู้จัดทำ ช่างหน่อยชุมแพ 0992256601</span>
            </div>
          </div>
        </footer>
      )}

      {/* Modal: Job Create / Edit */}
      <JobModal
        isOpen={isJobModalOpen}
        onClose={() => {
          setIsJobModalOpen(false);
          setEditingJob(null);
        }}
        onSave={handleCreateOrUpdateJob}
        initialJob={editingJob}
        users={users}
        repairCategories={settings.repairCategories || []}
        technicians={settings.technicians || []}
        nextQueueNumber={nextQueueNumber}
        onOpenSettings={() => setCurrentTab('settings')}
      />

      {/* Modal: Job Detail Drawer / Modal */}
      <JobDetailModal
        job={selectedJob}
        onClose={() => setSelectedJob(null)}
        onStatusChange={handleStatusChange}
        onRescheduleJob={handleRescheduleJob}
        onCancelJob={handleCancelJob}
        onUpdateActualCost={handleUpdateActualCost}
        onUpdateClosingDetails={handleUpdateClosingDetails}
        onOpenCloseJobModal={(job) => setClosingJobTarget(job)}
        onEdit={(job) => {
          setEditingJob(job);
          setIsJobModalOpen(true);
        }}
        onPrint={(job) => setPrintingJob(job)}
        onOpenStatusPhotos={(job, status) =>
          setPhotoModalState({ jobId: job.id, initialStatus: status || job.status })
        }
        settings={settings}
        isAdmin={isAdmin}
      />

      {/* Modal: Per-Queue & Per-Status Photo Capture / Attachment */}
      <JobStatusPhotosModal
        job={photoModalState ? jobs.find((j) => j.id === photoModalState.jobId) || null : null}
        initialStatus={photoModalState?.initialStatus}
        onClose={() => setPhotoModalState(null)}
        onUpdateJobPhotos={handleUpdateJobStatusPhotos}
      />

      {/* Modal: Close Job (กรอกยอดค่าซ่อมจริง + ระยะประกัน ก่อนบันทึกปิดงาน) */}
      <CloseJobModal
        job={closingJobTarget}
        onClose={() => setClosingJobTarget(null)}
        onConfirmCloseJob={handleConfirmCloseJob}
      />

      {/* Modal: Printable Work Order / Delivery Sheet */}
      <PrintableWorkOrder
        job={printingJob}
        settings={settings}
        onClose={() => setPrintingJob(null)}
      />

      {/* Modal: User Login / Admin Switch */}
      <UserLoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        users={users}
        settings={settings}
        onLoginAsUser={handleSwitchToUser}
        onLoginAsAdmin={handleSwitchToAdmin}
        onGoogleSignIn={handleGoogleCloudSignIn}
        cloudUserEmail={firebaseUser?.email || null}
        cloudSyncing={cloudSyncStatus === 'syncing'}
      />

      {/* Modal: Renewal Code Entry */}
      <RenewCodeModal
        isOpen={isRenewModalOpen}
        onClose={() => setIsRenewModalOpen(false)}
        activeUser={activeUserAccount || users[0]}
        users={users}
        onUserUpdated={(updatedUser) => {
          const updated = users.map((u) => (u.id === updatedUser.id ? updatedUser : u));
          handleSaveUsers(updated);
          setShowExpiredWarning(false);
        }}
      />

      {/* Modal: Expired Link Notice (Pop-up หมดอายุการใช้งาน สนใจใช้งานติดต่อ admin ช่างหน่อยชุมแพ 099-2256601) */}
      {showExpiredWarning && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border-2 border-red-300 text-center space-y-5 animate-in fade-in zoom-in-95">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <ShieldAlert className="w-9 h-9 animate-bounce" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-black text-slate-900 tracking-tight">
                หมดอายุการใช้งาน
              </h3>
              <div className="text-sm font-bold text-red-700 bg-red-50 py-3 px-4 rounded-2xl border border-red-200">
                หมดอายุการใช้งาน ติดต่อ admin ช่างหน่อยชุมแพ <br />
                <span className="font-bold font-mono text-lg text-red-900">099-2256601</span>
              </div>
              <p className="text-xs text-slate-500">
                ระยะเวลาการใช้งานของท่านสิ้นสุดลงแล้ว กรุณาติดต่อ admin เพื่อต่ออายุการใช้งาน
              </p>
            </div>

            <div className="flex flex-col gap-2.5 pt-1">
              <a
                href="tel:0992256601"
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2"
              >
                <Phone className="w-4 h-4" />
                <span>โทรติดต่อ admin ช่างหน่อยชุมแพ (099-2256601)</span>
              </a>

              <button
                type="button"
                onClick={() => {
                  setShowExpiredWarning(false);
                  setIsRenewModalOpen(true);
                }}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>ใส่รหัสต่ออายุใช้งาน</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowExpiredWarning(false);
                  setIsAdminPinModalOpen(true);
                }}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>เข้าสู่ระบบแอดมิน</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: User Link Authentication (ต้องใส่ Username & Password ก่อนเข้าใช้งานลิงก์ที่แชร์) */}
      <UserLinkLoginModal
        isOpen={isUserLinkLoginOpen}
        targetUser={pendingLinkUser}
        allUsers={users}
        onSuccess={(verifiedUser) => {
          if (typeof sessionStorage !== 'undefined' && verifiedUser.linkToken) {
            sessionStorage.setItem(`verified_user_link_${verifiedUser.linkToken}`, '1');
          }
          if (!users.some((u) => u.linkToken === verifiedUser.linkToken)) {
            handleSaveUsers([verifiedUser, ...users]);
          }
          setIsUserLinkLoginOpen(false);
          setPendingLinkUser(null);
          handleSwitchToUser(verifiedUser);
        }}
        onRequestAdminLogin={() => {
          setIsAdminPinModalOpen(true);
        }}
        onGoogleSignIn={handleGoogleCloudSignIn}
        cloudUserEmail={firebaseUser?.email || null}
        cloudSyncing={cloudSyncStatus === 'syncing'}
      />

      {/* Modal: Admin PIN Login (รหัสผ่าน 099-225-6601 ซ่อนรหัส) */}
      <AdminPinModal
        isOpen={isAdminPinModalOpen}
        onClose={() => setIsAdminPinModalOpen(false)}
        targetPassword="099-225-6601"
        onSuccess={() => {
          setIsUserLinkLoginOpen(false);
          handleSwitchToAdmin();
          setCurrentTab('create_link');
          setIsAdminPinModalOpen(false);
          showLineToast(
            'เข้าสู่ระบบแอดมินสำเร็จ 🛡️',
            'ยืนยันรหัสผ่านเรียบร้อย เปิดหน้า "สร้าง link user" ให้ทันที',
            'success'
          );
        }}
      />

      {/* Booting Sequence with Typewriter Effect "สร้างสรรค์โดยช่างหน่อยชุมแพ" (3-4 วินาที) */}
      {isBooting && (
        <BootLoadingScreen
          userName={auth.userName}
          onComplete={() => setIsBooting(false)}
        />
      )}

      {/* Modal: 30-Min-Before & Overdue Queue Appointment Voice + LINE Messaging API Alarm */}
      <AppointmentReminderModal
        dueItems={dueThirtyMinItems}
        isOpen={!isBooting && !isUserLinkLoginOpen && !showExpiredWarning && dueThirtyMinItems.length > 0}
        onAcknowledgeAll={handleAcknowledgeThirtyMinAlarms}
        onOpenJobDetail={(job) => setSelectedJob(job)}
        lineConfigured={
          isLineConfigured(settings.lineNotify) &&
          settings.lineNotify?.notifyBefore30Min !== false
        }
        repeatIntervalMinutes={Number(settings.lineNotify?.repeatIntervalMinutes) || 2}
        lineSendCount={lineSendCount}
        onResendLineNow={() => dispatchLineThirtyMinReminder(dueThirtyMinItems, true)}
      />

      {/* Modal: Overdue > 2 Days Unclosed Jobs Voice Alarm ("มีงานค้างยังไม่ปิดงานเกิน2วัน กดเพื่อยืนยัน") */}
      <OverdueTwoDaysAlarmModal
        isOpen={
          !isBooting &&
          !isUserLinkLoginOpen &&
          !showExpiredWarning &&
          isOverdue2DaysModalOpen &&
          dueThirtyMinItems.length === 0
        }
        overdueItems={overdueTwoDaysItems}
        onAcknowledge={handleAcknowledgeOverdue2Days}
        onSelectJob={(job) => {
          setSelectedJob(job);
        }}
      />

      {/* Modal: Daily Pending Queue Voice Alarm ("วันนี้มีกี่คิวงาน กดยืนยันเพื่อรับทราบ" หยุดเองเมื่อเลย 5 นาที) */}
      <DailyQueueAlarmModal
        isOpen={
          !isBooting &&
          !isUserLinkLoginOpen &&
          !showExpiredWarning &&
          isDailyQueueModalOpen &&
          !isOverdue2DaysModalOpen &&
          dueThirtyMinItems.length === 0
        }
        pendingJobs={todayPendingJobs}
        onAcknowledge={handleAcknowledgeDailyQueue}
        onSelectJob={(job) => {
          setSelectedJob(job);
        }}
      />

      {/* Modal: Expired Warranty Alarm & Voice Alert Pop up (งานหมดระยะประกันพร้อมเสียงเตือนซ้ำๆ) */}
      <ExpiredWarrantyModal
        isOpen={
          !isBooting &&
          !isUserLinkLoginOpen &&
          !showExpiredWarning &&
          isExpiredWarrantyModalOpen &&
          !isDailyQueueModalOpen &&
          !isOverdue2DaysModalOpen &&
          dueThirtyMinItems.length === 0
        }
        expiredJobs={allExpiredWarrantyJobs}
        onAcknowledgeAll={handleAcknowledgeAllExpired}
        onSelectJob={(job) => {
          setSelectedJob(job);
        }}
      />

      {/* Offline Status Toast */}
      <OfflineIndicator />

      {/* Modal: Download Source Code (การโหลด source code แสดงเฉพาะ ลิงก์แอดมินเท่านั้น) */}
      <DownloadSourceCodeModal
        isOpen={isDownloadCodeModalOpen && isAdmin}
        onClose={() => setIsDownloadCodeModalOpen(false)}
        isAdmin={isAdmin}
        settings={settings}
        jobs={jobs}
        users={users}
        onOpenSourceCodePage={() => setCurrentTab('source_code')}
      />

      {/* Floating LINE Notification Toast */}
      {lineToast && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-5 sm:bottom-5 z-50 sm:max-w-sm sm:w-full bg-slate-900 text-white rounded-2xl p-4 shadow-2xl border border-slate-700 animate-in slide-in-from-bottom-5 duration-200 flex items-start gap-3">
          <div
            className={`p-2 rounded-xl shrink-0 ${
              lineToast.type === 'error'
                ? 'bg-rose-500/20 text-rose-400'
                : 'bg-emerald-500/20 text-emerald-400'
            }`}
          >
            <BellRing className="w-5 h-5 animate-bounce" />
          </div>
          <div className="flex-1 space-y-0.5">
            <div className="text-xs font-bold flex items-center justify-between">
              <span>{lineToast.title}</span>
              <button
                onClick={() => setLineToast(null)}
                className="text-slate-400 hover:text-white text-xs leading-none p-1"
              >
                &times;
              </button>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">{lineToast.description}</p>
          </div>
        </div>
      )}
    </div>
  );
}
