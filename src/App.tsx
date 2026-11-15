// File: /src/App.tsx | Revision: Rev 19 | Version: 1.5.0 | Modified: 2026-11-15
import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { UserLoginModal } from './components/UserLoginModal';
import { UserLinkLoginModal } from './components/UserLinkLoginModal';
import { RenewCodeModal } from './components/RenewCodeModal';
import { DownloadSourceCodeModal } from './components/DownloadSourceCodeModal';
import { ExpiredWarrantyModal } from './components/ExpiredWarrantyModal';
import { DailyQueueAlarmModal } from './components/DailyQueueAlarmModal';
import { AppointmentReminderModal } from './components/AppointmentReminderModal';
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
  addNotificationLog,
  fetchLineMessagingStatus,
  postServerAlarmAck,
  syncSchedulesAndLineConfigToServer,
} from './services/lineNotify';
import {
  AppointmentReminderSchedule,
  buildUpcomingAppointmentSchedules,
  getDueAppointmentReminders,
  loadAcknowledgedAppointmentKeys,
  saveAcknowledgedAppointmentKey,
  showAppointmentSystemNotification,
  syncSchedulesToServiceWorker,
} from './services/appointmentAlarm';
import { ShieldAlert, AlertTriangle, KeyRound, RotateCcw, BellRing, CheckCircle, Phone, Lock } from 'lucide-react';

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

  // Calculate jobs whose warranty has expired
  const allExpiredWarrantyJobs = jobs.filter((j) => {
    const ws = getWarrantyStatus(j.warrantyEndDate, j.warrantyDays || 30);
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

  // Trigger 30-min-before alarm highest priority; otherwise Daily Pending Queue Alarm, then Expired Warranty Alarm
  useEffect(() => {
    if (isBooting || isUserLinkLoginOpen || showExpiredWarning) return;
    if (dueThirtyMinItems.length > 0) return;

    if (unacknowledgedDailyJobs.length > 0) {
      setIsDailyQueueModalOpen(true);
      return;
    }

    if (!isDailyQueueModalOpen && unacknowledgedExpiredJobs.length > 0) {
      setIsExpiredWarrantyModalOpen(true);
    }
  }, [
    jobs,
    isBooting,
    isUserLinkLoginOpen,
    showExpiredWarning,
    dueThirtyMinItems.length,
    isDailyQueueModalOpen,
    unacknowledgedDailyJobs.length,
    unacknowledgedExpiredJobs.length,
  ]);

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

  // Helper: Clear old mock jobs + old cover/shop/category/technician defaults when a User Link starts for the first time
  const initializeFreshUserLinkEnvironment = (linkToken: string) => {
    const firstInitKey = `user_link_cleared_first_time_${linkToken}`;
    if (!localStorage.getItem(firstInitKey)) {
      clearAllJobs();
      setJobs([]);
      setSettings((prev) => {
        // Backup admin settings once if not yet backed up and non-empty
        if (prev.shopName && !localStorage.getItem('repair_onsite_admin_settings_backup_v1')) {
          try {
            localStorage.setItem('repair_onsite_admin_settings_backup_v1', JSON.stringify(prev));
          } catch {}
        }
        const cleaned: ShopSettings = {
          ...prev,
          coverTitle: '',
          coverSubtitle: '',
          shopName: '',
          phone: '',
          lineId: '',
          lineUrl: '',
          facebook: '',
          facebookUrl: '',
          address: '',
          repairCategories: [],
          technicians: [],
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

  // Save changes to localStorage
  const handleSaveSettings = (newSettings: ShopSettings) => {
    setSettings(newSettings);
    saveShopSettings(newSettings);
  };

  const handleSaveUsers = (newUsers: UserAccount[]) => {
    setUsers(newUsers);
    saveUsers(newUsers);
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
    setEditingJob(null);
  };

  const handleDeleteJob = (jobId: string) => {
    if (confirm('คุณแน่ใจหรือไม่ว่าต้องการลบรายการคิวงานนี้?')) {
      const updated = jobs.filter((j) => j.id !== jobId);
      handleSaveJobs(updated);
      if (selectedJob?.id === jobId) setSelectedJob(null);
    }
  };

  const handleClearAllJobs = () => {
    clearAllJobs();
    setJobs([]);
    setSelectedJob(null);
    setEditingJob(null);
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
    if (selectedJob?.id === jobId && updatedJob) {
      setSelectedJob(updatedJob);
    }
  };

  const handleUpdateActualCost = (jobId: string, cost: number) => {
    const updated = jobs.map((j) => (j.id === jobId ? { ...j, actualCost: cost } : j));
    handleSaveJobs(updated);
    if (selectedJob?.id === jobId) {
      setSelectedJob({ ...selectedJob, actualCost: cost });
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

    if (expiry.isExpired) {
      setShowExpiredWarning(true);
    } else {
      // แสดงการบูทเข้าสู่ระบบประมาณ 3-4 วินาที พร้อมพิมพ์ดีด "สร้างสรรค์โดยช่างหน่อยชุมแพ"
      setIsBooting(true);
    }

    // If currently on admin-only tabs (create_link), redirect to dashboard
    if (currentTab === 'create_link') {
      setCurrentTab('dashboard');
    }
  };

  const handleLogout = () => {
    saveCurrentAuth(null);
    setIsLoginModalOpen(true);
  };

  // Security guard: user cannot access admin settings
  const isAdmin = auth.role === 'admin';

  const handleTabChange = (tab: ViewTab) => {
    if (!isAdmin && tab === 'create_link') {
      alert('ขออภัย ผู้ใช้งานทั่วไปไม่สามารถเข้าถึงหน้าสร้าง link user ได้');
      return;
    }
    setCurrentTab(tab);
  };

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-clip bg-slate-100/70 text-slate-900 flex flex-col font-['Prompt',sans-serif]">
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
        onOpenDownloadCode={() => setIsDownloadCodeModalOpen(true)}
        expiredWarrantyCount={allExpiredWarrantyJobs.length}
        onOpenExpiredWarrantyModal={() => setIsExpiredWarrantyModalOpen(true)}
        onRequestAdminLogin={() => setIsAdminPinModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">

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

        {currentTab === 'create_link' && isAdmin && (
          <CreateUserLinkPage
            users={users}
            onSaveUsers={handleSaveUsers}
            onSwitchToUser={handleSwitchToUser}
          />
        )}

        {currentTab === 'settings' && (
          <AdminSettings
            settings={settings}
            onSaveSettings={handleSaveSettings}
            isAdmin={isAdmin}
            jobs={jobs}
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
        onUpdateActualCost={handleUpdateActualCost}
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

      {/* Modal: 30-Minute-Before Appointment Voice + LINE Messaging API Alarm */}
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

      {/* Modal: Daily Pending Queue Voice Alarm ("วันนี้มีกี่คิวงาน กดยืนยันเพื่อรับทราบ" หยุดเองเมื่อเลย 5 นาที) */}
      <DailyQueueAlarmModal
        isOpen={isDailyQueueModalOpen && dueThirtyMinItems.length === 0}
        pendingJobs={todayPendingJobs}
        onAcknowledge={handleAcknowledgeDailyQueue}
        onSelectJob={(job) => {
          setSelectedJob(job);
        }}
      />

      {/* Modal: Expired Warranty Alarm & Voice Alert Pop up (งานหมดระยะประกันพร้อมเสียงเตือนซ้ำๆ) */}
      <ExpiredWarrantyModal
        isOpen={isExpiredWarrantyModalOpen && !isDailyQueueModalOpen && dueThirtyMinItems.length === 0}
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
