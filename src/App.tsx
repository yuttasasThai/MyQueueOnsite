// File: /src/App.tsx | Revision: Rev 11 | Version: 1.2.6 | Modified: 2026-11-13
import React, { useState, useEffect } from 'react';
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
import { RenewCodeModal } from './components/RenewCodeModal';
import { DownloadSourceCodeModal } from './components/DownloadSourceCodeModal';
import { ExpiredWarrantyModal } from './components/ExpiredWarrantyModal';
import { AdminPinModal } from './components/AdminPinModal';
import { BootLoadingScreen } from './components/BootLoadingScreen';
import {
  RepairJob,
  RepairStatus,
  ShopSettings,
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
  sendLineNotify,
  formatNewJobNotification,
  formatStatusChangeNotification,
  addNotificationLog,
} from './services/lineNotify';
import { ShieldAlert, AlertTriangle, KeyRound, RotateCcw, BellRing, CheckCircle, Phone, Lock } from 'lucide-react';

export default function App() {
  // Persistence state
  const [settings, setSettings] = useState<ShopSettings>(loadShopSettings);
  const [users, setUsers] = useState<UserAccount[]>(loadUsers);
  const [jobs, setJobs] = useState<RepairJob[]>(loadJobs);
  const [auth, setAuth] = useState<AuthSession>(() => loadCurrentAuth() || { role: 'user', userName: 'ช่างหน้างาน' });

  // Navigation tab
  const [currentTab, setCurrentTab] = useState<ViewTab>('dashboard');
  const [statusFilterForQueue, setStatusFilterForQueue] = useState<string>('all');

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
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  const [isDownloadCodeModalOpen, setIsDownloadCodeModalOpen] = useState(false);
  const [isAdminPinModalOpen, setIsAdminPinModalOpen] = useState(false);
  const [isBooting, setIsBooting] = useState(true);

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

  // Automatically trigger the Expired Warranty Pop-up on load or when new expired jobs are detected
  useEffect(() => {
    if (unacknowledgedExpiredJobs.length > 0) {
      setIsExpiredWarrantyModalOpen(true);
    }
  }, [jobs]);

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

  // Link Expiry Warning Modal for user
  const [showExpiredWarning, setShowExpiredWarning] = useState(false);

  // Find active User Account if logged in as user
  const activeUserAccount = users.find(
    (u) => u.id === auth.userId || u.linkToken === auth.linkToken
  );

  // Check URL parameters for direct admin link or user link on mount
  useEffect(() => {
    // 1. Check if accessed via Admin link (?admin_token=... or ?admin_key=...)
    if (checkUrlAdminToken(settings)) {
      const adminAuth: AuthSession = {
        role: 'admin',
        userName: 'แอดมินเจ้าของร้าน (ผ่านลิงก์แอดมิน)',
      };
      setAuth(adminAuth);
      saveCurrentAuth(adminAuth);
      return;
    }

    // 2. Check if accessed via User link (?user_token=... or ?token=...)
    const tokenCheck = checkUrlUserToken(users);
    if (tokenCheck.foundUser) {
      const user = tokenCheck.foundUser;
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

      // ลิ้ง user เมื่อเริ่มต้นใช้งานครั้งแรกให้เคลียร์ข้อมูลเก่าออกให้หมด
      const firstInitKey = `user_link_cleared_first_time_${user.linkToken}`;
      if (!localStorage.getItem(firstInitKey)) {
        clearAllJobs();
        setJobs([]);
        localStorage.setItem(firstInitKey, 'true');
      }

      if (tokenCheck.isExpired) {
        setShowExpiredWarning(true);
      }
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

      // Automatically trigger LINE Notify for new appointments if enabled
      if (
        settings.lineNotify?.enabled &&
        settings.lineNotify?.notifyOnNewJob &&
        settings.lineNotify?.token?.trim()
      ) {
        const msg = formatNewJobNotification(job, settings);
        sendLineNotify(settings.lineNotify.token, msg)
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
                'ส่ง LINE Notify นัดหมายใหม่ 🔔',
                `คิวงาน ${job.queueNumber} (${job.customer.name}) แจ้งเตือนเข้า LINE เรียบร้อยแล้ว`,
                'success'
              );
            } else {
              showLineToast(
                'LINE Notify ไม่สามารถส่งได้',
                res.message,
                'error'
              );
            }
          })
          .catch((err) => {
            console.error('Failed to dispatch LINE Notify', err);
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

  const handleStatusChange = (jobId: string, newStatus: RepairStatus) => {
    const targetJob = jobs.find((j) => j.id === jobId);
    const previousStatus = targetJob?.status;

    const updated = jobs.map((j) => {
      if (j.id === jobId) {
        // If status becomes completed, update warranty start date to today
        let warrantyEndDate = j.warrantyEndDate;
        if (newStatus === 'ซ่อมแล้ว' || newStatus === 'ปิดงาน') {
          const now = new Date();
          const end = new Date(now);
          end.setDate(end.getDate() + j.warrantyDays);
          warrantyEndDate = end.toISOString().split('T')[0];
        }
        return {
          ...j,
          status: newStatus,
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

    // Automatically trigger LINE Notify for status update if enabled
    if (
      updatedJob &&
      previousStatus !== newStatus &&
      settings.lineNotify?.enabled &&
      settings.lineNotify?.notifyOnStatusChange &&
      settings.lineNotify?.token?.trim()
    ) {
      const msg = formatStatusChangeNotification(
        updatedJob,
        previousStatus,
        newStatus,
        settings
      );
      sendLineNotify(settings.lineNotify.token, msg)
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
            onNavigateToQueue={() => setCurrentTab('queue')}
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
            isAdmin={isAdmin}
            currentUserId={auth.userId}
            initialStatusFilter={statusFilterForQueue}
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
          />
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>{settings.shopName} · ระบบจัดตารางคิวงานซ่อมนอกสถานที่ (Onsite Service)</span>
          <div className="flex items-center gap-3">
            <span>โทร: {settings.phone}</span>
            <span>·</span>
            <span>LINE: {settings.lineId}</span>
          </div>
        </div>
      </footer>

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
        nextQueueNumber={nextQueueNumber}
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
        settings={settings}
        isAdmin={isAdmin}
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

      {/* Modal: Admin PIN Login (รหัสผ่าน 099-225-6601 ซ่อนรหัส) */}
      <AdminPinModal
        isOpen={isAdminPinModalOpen}
        onClose={() => setIsAdminPinModalOpen(false)}
        targetPassword="099-225-6601"
        onSuccess={() => {
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

      {/* Modal: Expired Warranty Alarm & Voice Alert Pop up (งานหมดระยะประกันพร้อมเสียงเตือนซ้ำๆ) */}
      <ExpiredWarrantyModal
        isOpen={isExpiredWarrantyModalOpen}
        expiredJobs={allExpiredWarrantyJobs}
        onAcknowledgeAll={handleAcknowledgeAllExpired}
        onSelectJob={(job) => {
          setSelectedJob(job);
        }}
      />

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
