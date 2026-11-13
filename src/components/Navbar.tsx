// File: /src/components/Navbar.tsx | Revision: Rev 11 | Version: 1.2.6 | Modified: 2026-11-13
import React from 'react';
import {
  Wrench,
  Calendar,
  Link as LinkIcon,
  Settings,
  Plus,
  ShieldCheck,
  UserCheck,
  LogOut,
  Clock,
  KeyRound,
  RotateCcw,
  BarChart3,
  FileCode,
  ShieldAlert,
} from 'lucide-react';
import { ViewTab, UserAccount } from '../types';
import { AuthSession, checkUserLinkExpiry } from '../services/storage';

interface NavbarProps {
  currentTab: ViewTab;
  onTabChange: (tab: ViewTab) => void;
  auth: AuthSession;
  activeUserAccount?: UserAccount;
  onOpenNewJob: () => void;
  onOpenLoginModal: () => void;
  onOpenRenewModal: () => void;
  onSwitchToAdmin: () => void;
  onSwitchToUser: (user: UserAccount) => void;
  users: UserAccount[];
  onLogout: () => void;
  onOpenDownloadCode?: () => void;
  expiredWarrantyCount?: number;
  onOpenExpiredWarrantyModal?: () => void;
  onRequestAdminLogin?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onTabChange,
  auth,
  activeUserAccount,
  onOpenNewJob,
  onOpenLoginModal,
  onOpenRenewModal,
  onSwitchToAdmin,
  onSwitchToUser,
  users,
  onLogout,
  onOpenDownloadCode,
  expiredWarrantyCount = 0,
  onOpenExpiredWarrantyModal,
  onRequestAdminLogin,
}) => {
  const isAdmin = auth.role === 'admin';
  const [showUserDropdown, setShowUserDropdown] = React.useState(false);

  // Link expiry check for user
  const expiryInfo = activeUserAccount
    ? checkUserLinkExpiry(activeUserAccount.expiresAt)
    : auth.expiresAt
    ? checkUserLinkExpiry(auth.expiresAt)
    : null;

  return (
    <header className="sticky top-0 z-40 w-full max-w-full bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs overflow-x-clip">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-2 sm:gap-4 md:gap-6 h-14 sm:h-16 min-w-0">
          {/* Zone 1: Wordmark & Logo */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 md:flex-initial">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <Wrench className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <button
              onClick={() => onTabChange('dashboard')}
              className="text-left group cursor-pointer min-w-0 flex-1"
            >
              <span className="text-sm sm:text-lg font-bold tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors truncate block font-['Plus_Jakarta_Sans',sans-serif]">
                Repair Onsite Service
              </span>
              <span className="hidden sm:block text-[11px] text-slate-500 leading-none font-normal truncate">
                ระบบจัดตารางคิวงานซ่อมนอกสถานที่
              </span>
            </button>
          </div>

          {/* Zone 2: Navigation Links (ลบหน้าช่าง/user ออก, เพิ่มหน้า สร้าง link user สำหรับ admin) */}
          <nav className="hidden md:flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => onTabChange('dashboard')}
              className={`flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                currentTab === 'dashboard'
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>แดชบอร์ด</span>
            </button>

            <button
              onClick={() => onTabChange('queue')}
              className={`flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                currentTab === 'queue'
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Wrench className="w-4 h-4" />
              <span>คิวงาน</span>
            </button>

            <button
              onClick={() => onTabChange('calendar')}
              className={`flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                currentTab === 'calendar'
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>ปฏิทิน</span>
            </button>

            {/* Admin-only Navigation: สร้าง link user */}
            {isAdmin && (
              <button
                onClick={() => onTabChange('create_link')}
                className={`flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  currentTab === 'create_link'
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <LinkIcon className="w-4 h-4 text-blue-600" />
                <span>สร้าง link user</span>
              </button>
            )}

            {/* Settings Tab: Accessible by both Admin and User */}
            <button
              onClick={() => onTabChange('settings')}
              className={`flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                currentTab === 'settings'
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>{isAdmin ? 'ตั้งค่า' : 'ตั้งค่า'}</span>
            </button>
          </nav>

          {/* Zone 3: Primary Action & User Expiry Indicator */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* User Link Expiry Indicator (desktop/tablet inline; mobile uses compact bar below) */}
            {!isAdmin && expiryInfo && (
              <div className="hidden lg:flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <div className="leading-tight">
                  <div className="font-semibold flex items-center gap-1">
                    <span>อายุลิงก์:</span>
                    <span className="font-mono text-amber-700 tabular-nums">
                      {expiryInfo.isExpired
                        ? 'หมดอายุแล้ว!'
                        : `เหลือ ${expiryInfo.daysRemaining} วัน`}
                    </span>
                  </div>
                  <div className="text-[10px] text-amber-700">
                    ถึง {expiryInfo.formattedDate}
                  </div>
                </div>
                <button
                  onClick={onOpenRenewModal}
                  className="ml-1 text-[11px] font-medium text-amber-700 hover:text-amber-900 bg-amber-200/60 hover:bg-amber-200 px-2 py-0.5 rounded transition-colors whitespace-nowrap cursor-pointer"
                  title="ใส่รหัสต่ออายุใช้งาน"
                >
                  ต่ออายุ
                </button>
              </div>
            )}

            {/* Direct Admin Access Button when in User Mode (ใส่รหัส 099-225-6601 แบบซ่อนรหัส) */}
            {!isAdmin && (
              <button
                type="button"
                onClick={() => {
                  if (onRequestAdminLogin) {
                    onRequestAdminLogin();
                  } else {
                    onSwitchToAdmin();
                  }
                }}
                className="flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold bg-slate-950 hover:bg-slate-800 text-white border border-amber-500/50 shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-95 shrink-0 whitespace-nowrap"
                title="กดเพื่อเข้าสู่ระบบแอดมิน (ใส่รหัสผ่าน)"
              >
                <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 shrink-0" />
                <span className="sm:hidden">แอดมิน</span>
                <span className="hidden sm:inline">แอดมิน (Admin)</span>
              </button>
            )}

            {/* Quick Link to Create User Link when already Admin */}
            {isAdmin && (
              <button
                type="button"
                onClick={() => onTabChange('create_link')}
                className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
                  currentTab === 'create_link'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
                }`}
                title="เปิดหน้าสร้าง link user"
              >
                <LinkIcon className="w-3.5 h-3.5" />
                <span>สร้าง link user</span>
              </button>
            )}

            {/* Role / User Account Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                  isAdmin
                    ? 'bg-slate-900 text-white border-slate-800 hover:bg-slate-800'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                }`}
                title={isAdmin ? 'แอดมิน (Admin)' : activeUserAccount?.name || auth.userName || 'ช่างหน้างาน'}
              >
                {isAdmin ? (
                  <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                ) : (
                  <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                )}
                <div className="hidden sm:block text-left max-w-[130px] truncate">
                  <span className="font-semibold block truncate">
                    {isAdmin ? 'แอดมิน (Admin)' : activeUserAccount?.name || auth.userName || 'ช่างหน้างาน'}
                  </span>
                </div>
              </button>

              {/* Account / Quick Switch Dropdown */}
              {showUserDropdown && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-3 py-2 border-b border-slate-100">
                    <p className="text-xs font-semibold text-slate-800">
                      เข้าใช้งานในฐานะ:
                    </p>
                    <p className="text-xs text-slate-500 font-medium truncate">
                      {isAdmin ? 'ผู้ดูแลระบบ (Admin Master)' : activeUserAccount?.name || auth.userName}
                    </p>
                    {!isAdmin && expiryInfo && (
                      <p className="text-[11px] text-amber-600 mt-1 font-mono">
                        วันหมดอายุ: {expiryInfo.formattedDate} ({expiryInfo.daysRemaining} วัน)
                      </p>
                    )}
                  </div>

                  <div className="py-1">
                    <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      สลับโหมด / ทดสอบสิทธิ์
                    </div>

                    <button
                      onClick={() => {
                        setShowUserDropdown(false);
                        if (!isAdmin && onRequestAdminLogin) {
                          onRequestAdminLogin();
                        } else {
                          onSwitchToAdmin();
                        }
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-slate-50 cursor-pointer ${
                        isAdmin ? 'font-semibold text-blue-600' : 'text-slate-700'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                        <span>โหมดแอดมิน (ใส่รหัสผ่าน)</span>
                      </span>
                      {isAdmin && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">ปัจจุบัน</span>}
                    </button>

                    {/* Exit Admin Mode Option (Switch back to user) */}
                    {isAdmin && (
                      <button
                        onClick={() => {
                          setShowUserDropdown(false);
                          onSwitchToUser(users[0] || { id: 'usr_guest', name: 'ช่างหน้างาน' });
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-amber-700 hover:bg-amber-50 flex items-center gap-2 cursor-pointer font-medium"
                      >
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                        <span>ออกจากโหมดแอดมิน (สลับเป็นผู้ใช้)</span>
                      </button>
                    )}

                    {users.map((u) => {
                      const uExpiry = checkUserLinkExpiry(u.expiresAt);
                      const isSelected = !isAdmin && (activeUserAccount?.id === u.id || auth.userId === u.id);
                      return (
                        <button
                          key={u.id}
                          onClick={() => {
                            setShowUserDropdown(false);
                            onSwitchToUser(u);
                          }}
                          className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-slate-50 cursor-pointer ${
                            isSelected ? 'font-semibold text-emerald-600' : 'text-slate-700'
                          }`}
                        >
                          <span className="flex items-center gap-2 truncate">
                            <UserCheck className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{u.name}</span>
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
                            uExpiry.isExpired ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {uExpiry.isExpired ? 'หมดอายุ' : `${uExpiry.daysRemaining}ว.`}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="border-t border-slate-100 pt-1 mt-1">
                    {!isAdmin && (
                      <button
                        onClick={() => {
                          setShowUserDropdown(false);
                          onOpenRenewModal();
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-amber-700 hover:bg-amber-50 flex items-center gap-2 font-medium cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>ใส่รหัสต่ออายุการใช้งาน</span>
                      </button>
                    )}
                    {isAdmin && onOpenDownloadCode && (
                      <button
                        onClick={() => {
                          setShowUserDropdown(false);
                          onOpenDownloadCode();
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-blue-700 hover:bg-blue-50 flex items-center gap-2 font-medium cursor-pointer"
                      >
                        <FileCode className="w-3.5 h-3.5" />
                        <span>ดาวน์โหลด Source Code (แอดมิน)</span>
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setShowUserDropdown(false);
                        onOpenLoginModal();
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                      <span>เข้าสู่ระบบด้วย User ID / Pass</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowUserDropdown(false);
                        onLogout();
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>ออกจากระบบ</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Expired Warranty Alert Quick Button */}
            {expiredWarrantyCount > 0 && onOpenExpiredWarrantyModal && (
              <button
                type="button"
                onClick={onOpenExpiredWarrantyModal}
                className="flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all shadow-sm shrink-0 whitespace-nowrap cursor-pointer animate-pulse"
                title={`มีงานหมดระยะประกัน ${expiredWarrantyCount} รายการ คลิกเพื่อฟังเสียงเตือนและดูรายการ`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">หมดประกัน</span>
                <span className="bg-white text-red-700 text-[10px] font-black px-1.5 py-0.2 rounded-full font-mono">
                  {expiredWarrantyCount}
                </span>
              </button>
            )}

            {/* Primary Action Button: "เปิดคิวงานซ่อมใหม่" */}
            <button
              onClick={onOpenNewJob}
              className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] sm:text-sm font-semibold transition-colors shadow-xs shrink-0 whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="sm:hidden">รับงาน</span>
              <span className="hidden sm:inline">รับงานใหม่</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation bar for small screens (ลบหน้าช่าง/user ออก, เพิ่ม สร้าง link user สำหรับ admin) */}
        <div className="flex md:hidden items-center justify-between gap-1 py-1.5 border-t border-slate-100 text-[11px] w-full overflow-x-auto">
          <button
            onClick={() => onTabChange('dashboard')}
            className={`flex items-center justify-center gap-1 py-1 px-2 rounded font-medium flex-1 min-w-0 whitespace-nowrap cursor-pointer ${
              currentTab === 'dashboard' ? 'text-blue-600 font-bold bg-blue-50' : 'text-slate-600'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">แดชบอร์ด</span>
          </button>
          <button
            onClick={() => onTabChange('queue')}
            className={`flex items-center justify-center gap-1 py-1 px-2 rounded font-medium flex-1 min-w-0 whitespace-nowrap cursor-pointer ${
              currentTab === 'queue' ? 'text-blue-600 font-bold bg-blue-50' : 'text-slate-600'
            }`}
          >
            <Wrench className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">คิวงาน</span>
          </button>
          <button
            onClick={() => onTabChange('calendar')}
            className={`flex items-center justify-center gap-1 py-1 px-2 rounded font-medium flex-1 min-w-0 whitespace-nowrap cursor-pointer ${
              currentTab === 'calendar' ? 'text-blue-600 font-bold bg-blue-50' : 'text-slate-600'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">ปฏิทิน</span>
          </button>
          {isAdmin && (
            <button
              onClick={() => onTabChange('create_link')}
              className={`flex items-center justify-center gap-1 py-1 px-2 rounded font-medium flex-1 min-w-0 whitespace-nowrap cursor-pointer ${
                currentTab === 'create_link' ? 'text-blue-600 font-bold bg-blue-50' : 'text-slate-600'
              }`}
            >
              <LinkIcon className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">สร้าง link</span>
            </button>
          )}
          <button
            onClick={() => onTabChange('settings')}
            className={`flex items-center justify-center gap-1 py-1 px-2 rounded font-medium flex-1 min-w-0 whitespace-nowrap cursor-pointer ${
              currentTab === 'settings' ? 'text-blue-600 font-bold bg-blue-50' : 'text-slate-600'
            }`}
          >
            <Settings className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">ตั้งค่า</span>
          </button>
        </div>

        {/* Compact Mobile Link Expiry Strip (never overflows header) */}
        {!isAdmin && expiryInfo && (
          <div className="flex lg:hidden items-center justify-between gap-2 px-2.5 py-1 mb-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px]">
            <div className="flex items-center gap-1.5 min-w-0 truncate">
              <Clock className="w-3 h-3 text-amber-600 shrink-0" />
              <span className="font-medium truncate">
                อายุลิงก์:{' '}
                <strong className="font-mono text-amber-700">
                  {expiryInfo.isExpired ? 'หมดอายุแล้ว!' : `เหลือ ${expiryInfo.daysRemaining} วัน`}
                </strong>
              </span>
            </div>
            <button
              onClick={onOpenRenewModal}
              className="text-[10px] font-bold text-amber-800 bg-amber-200/80 hover:bg-amber-200 px-2 py-0.5 rounded shrink-0 cursor-pointer"
            >
              ต่ออายุ
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
