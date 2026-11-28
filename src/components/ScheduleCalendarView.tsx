import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Phone,
  Plus,
  User,
  Wrench,
  X,
} from 'lucide-react';
import { RepairJob, RepairStatus } from '../types';
import { formatCustomerPhone, hasCustomerPhone } from '../services/smsNotify';

interface ScheduleCalendarViewProps {
  jobs: RepairJob[];
  onSelectJob: (job: RepairJob) => void;
  onOpenNewJob: (dateStr?: string) => void;
}

const THAI_MONTHS = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
];

const WEEKDAYS_TH = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];

function toYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseYMD(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function getStatusColorClass(status: RepairStatus): string {
  switch (status) {
    case 'รับงาน':
      return 'bg-blue-50 text-blue-800 border-blue-200';
    case 'กำลังไป':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'กำลังซ่อม':
      return 'bg-purple-50 text-purple-800 border-purple-200';
    case 'ซ่อมแล้ว':
      return 'bg-teal-50 text-teal-800 border-teal-200';
    case 'ปิดงาน':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    case 'นัดหมายต่อ':
      return 'bg-orange-50 text-orange-800 border-orange-200';
    case 'ยกเลิก':
      return 'bg-slate-100 text-slate-600 border-slate-200';
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200';
  }
}

export const ScheduleCalendarView: React.FC<ScheduleCalendarViewProps> = ({
  jobs,
  onSelectJob,
  onOpenNewJob,
}) => {
  const todayStr = useMemo(() => toYMD(new Date()), []);
  const [viewMonth, setViewMonth] = useState<{ year: number; month: number }>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [popupDate, setPopupDate] = useState<string | null>(null);

  // Group jobs by local appointment date (fallback to loggedDate)
  const jobsByDate = useMemo(() => {
    const map: Record<string, RepairJob[]> = {};
    jobs.forEach((job) => {
      const d = (job.appointmentDate || job.loggedDate || '').slice(0, 10);
      if (!d) return;
      if (!map[d]) map[d] = [];
      map[d].push(job);
    });
    Object.values(map).forEach((list) => {
      list.sort((a, b) => (a.appointmentTime || '').localeCompare(b.appointmentTime || ''));
    });
    return map;
  }, [jobs]);

  // Build full 1-month grid cells (Sun - Sat, 35 or 42 cells)
  const calendarCells = useMemo(() => {
    const firstOfMonth = new Date(viewMonth.year, viewMonth.month, 1);
    const startWeekday = firstOfMonth.getDay(); // 0=Sun..6=Sat
    const daysInMonth = new Date(viewMonth.year, viewMonth.month + 1, 0).getDate();
    const totalNeeded = startWeekday + daysInMonth;
    const totalCells = totalNeeded <= 35 ? 35 : 42;

    const cells: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];
    for (let i = 0; i < totalCells; i++) {
      const cellDate = new Date(viewMonth.year, viewMonth.month, 1 - startWeekday + i);
      cells.push({
        dateStr: toYMD(cellDate),
        dayNum: cellDate.getDate(),
        isCurrentMonth: cellDate.getMonth() === viewMonth.month,
      });
    }
    return cells;
  }, [viewMonth]);

  // Monthly statistics
  const monthSummary = useMemo(() => {
    const monthPrefix = `${viewMonth.year}-${String(viewMonth.month + 1).padStart(2, '0')}`;
    let pinnedDays = 0;
    let totalJobsInMonth = 0;
    let activeJobsInMonth = 0;

    Object.entries(jobsByDate).forEach(([dateStr, dayJobs]) => {
      if (dateStr.startsWith(monthPrefix) && dayJobs.length > 0) {
        pinnedDays += 1;
        totalJobsInMonth += dayJobs.length;
        activeJobsInMonth += dayJobs.filter(
          (j) => j.status !== 'ปิดงาน' && j.status !== 'ยกเลิก'
        ).length;
      }
    });

    return { pinnedDays, totalJobsInMonth, activeJobsInMonth };
  }, [jobsByDate, viewMonth]);

  const handlePrevMonth = () => {
    setViewMonth((prev) =>
      prev.month === 0 ? { year: prev.year - 1, month: 11 } : { year: prev.year, month: prev.month - 1 }
    );
  };

  const handleNextMonth = () => {
    setViewMonth((prev) =>
      prev.month === 11 ? { year: prev.year + 1, month: 0 } : { year: prev.year, month: prev.month + 1 }
    );
  };

  const handleGoToday = () => {
    const now = new Date();
    setViewMonth({ year: now.getFullYear(), month: now.getMonth() });
  };

  const monthTitleTh = `${THAI_MONTHS[viewMonth.month]} ${viewMonth.year + 543}`;
  const popupJobs = popupDate ? jobsByDate[popupDate] || [] : [];

  const formatThaiDateFull = (ymd: string) => {
    const d = parseYMD(ymd);
    return d.toLocaleDateString('th-TH', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-3.5 sm:p-5 space-y-4">
      {/* Header: Month Navigation & Summary */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <CalendarIcon className="w-5 h-5 text-blue-600 shrink-0" />
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              ปฏิทินตารางนัดหมายรายเดือน
            </h3>
          </div>
          <p className="text-xs text-slate-500">
            แสดงภาพรวมทั้งเดือนและปักหมุดวันที่ที่มีคิวงาน — กดที่หมุดเพื่อเปิดหน้าต่างดูรายละเอียดคิวงาน
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2">
          {/* Monthly Counter Summary */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700 tabular-nums">
            <MapPin className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <span>
              ปักหมุด <strong className="text-slate-900">{monthSummary.pinnedDays}</strong> วัน
            </span>
            <span className="text-slate-300">·</span>
            <span>
              รวม <strong className="text-blue-700">{monthSummary.totalJobsInMonth}</strong> คิว
            </span>
            {monthSummary.activeJobsInMonth > 0 && (
              <>
                <span className="text-slate-300">·</span>
                <span className="text-amber-700 font-semibold">
                  รอทำ {monthSummary.activeJobsInMonth}
                </span>
              </>
            )}
          </div>

          {/* Month Controls */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
              title="เดือนก่อนหน้า"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="min-w-[130px] sm:min-w-[150px] text-center px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs sm:text-sm font-bold whitespace-nowrap">
              {monthTitleTh}
            </div>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
              title="เดือนถัดไป"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleGoToday}
              className="px-3 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer"
            >
              เดือนนี้
            </button>
          </div>
        </div>
      </div>

      {/* Pin Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-rose-600 fill-rose-100" />
            <span>มีคิวงานรอดำเนินการ</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-emerald-600 fill-emerald-100" />
            <span>ปิดงาน / เสร็จสิ้นทั้งหมด</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-blue-600 inline-block" />
            <span>วันนี้</span>
          </span>
        </div>

        <button
          type="button"
          onClick={() => onOpenNewJob(todayStr)}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>เพิ่มคิวนัดหมาย</span>
        </button>
      </div>

      {/* Full 1-Month Grid Calendar */}
      <div className="border border-slate-300 rounded-xl overflow-hidden bg-slate-200">
        {/* Weekday Header */}
        <div className="grid grid-cols-7 bg-slate-100 border-b border-slate-300">
          {WEEKDAYS_TH.map((day, idx) => (
            <div
              key={day}
              className={`py-2 text-center text-[11px] sm:text-xs font-bold border-r last:border-r-0 border-slate-200 ${
                idx === 0 ? 'text-rose-600' : idx === 6 ? 'text-blue-700' : 'text-slate-700'
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Month Days Grid */}
        <div className="grid grid-cols-7 gap-px bg-slate-200">
          {calendarCells.map(({ dateStr, dayNum, isCurrentMonth }) => {
            const dayJobs = jobsByDate[dateStr] || [];
            const hasJobs = dayJobs.length > 0;
            const isToday = dateStr === todayStr;
            const pendingCount = dayJobs.filter(
              (j) => j.status !== 'ปิดงาน' && j.status !== 'ยกเลิก'
            ).length;
            const allClosedOrCancelled = hasJobs && pendingCount === 0;

            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => setPopupDate(dateStr)}
                className={`min-h-[68px] sm:min-h-[96px] p-1 sm:p-1.5 text-left flex flex-col justify-between transition-colors cursor-pointer relative focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 ${
                  !isCurrentMonth
                    ? 'bg-slate-50/70 text-slate-400 hover:bg-slate-100/80'
                    : hasJobs
                    ? allClosedOrCancelled
                      ? 'bg-emerald-50/40 hover:bg-emerald-50'
                      : 'bg-rose-50/35 hover:bg-rose-50/70'
                    : 'bg-white hover:bg-slate-50'
                } ${isToday ? 'ring-2 ring-inset ring-blue-600 bg-blue-50/40' : ''}`}
              >
                {/* Top row: Day number + Pin indicator */}
                <div className="flex items-start justify-between gap-1 w-full">
                  <span
                    className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-mono font-bold tabular-nums ${
                      isToday
                        ? 'bg-blue-600 text-white'
                        : !isCurrentMonth
                        ? 'text-slate-400'
                        : 'text-slate-800'
                    }`}
                  >
                    {dayNum}
                  </span>

                  {hasJobs && (
                    <span
                      className={`inline-flex items-center gap-0.5 px-1 sm:px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tabular-nums border ${
                        allClosedOrCancelled
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : 'bg-rose-100 text-rose-800 border-rose-300'
                      }`}
                      title={`มีคิวงาน ${dayJobs.length} งาน — กดเพื่อดูรายละเอียด`}
                    >
                      <MapPin
                        className={`w-3 h-3 shrink-0 ${
                          allClosedOrCancelled
                            ? 'text-emerald-700 fill-emerald-200'
                            : 'text-rose-600 fill-rose-200'
                        }`}
                      />
                      <span>{dayJobs.length}</span>
                    </span>
                  )}
                </div>

                {/* Queue Preview Chips (Desktop / Tablet sm+) */}
                {hasJobs ? (
                  <div className="mt-1 space-y-0.5 w-full overflow-hidden">
                    <div className="hidden sm:block space-y-0.5">
                      {dayJobs.slice(0, 2).map((job) => (
                        <div
                          key={job.id}
                          className={`px-1.5 py-0.5 rounded border text-[10px] truncate font-medium ${getStatusColorClass(
                            job.status
                          )}`}
                        >
                          <span className="font-mono font-bold mr-1">{job.queueNumber}</span>
                          <span>{job.product}</span>
                        </div>
                      ))}
                      {dayJobs.length > 2 && (
                        <div className="text-[10px] text-slate-600 font-semibold px-1 tabular-nums">
                          +{dayJobs.length - 2} คิวเพิ่มเติม
                        </div>
                      )}
                    </div>

                    {/* Mobile compact label (< sm) */}
                    <div className="sm:hidden text-[10px] font-semibold text-center truncate px-0.5 text-slate-700">
                      {pendingCount > 0 ? `รอทำ ${pendingCount}` : `ปิด ${dayJobs.length}`}
                    </div>
                  </div>
                ) : (
                  <div className="mt-1 hidden sm:block text-[10px] text-slate-300">&nbsp;</div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Popup Modal: Date Queue Details when clicking a pinned day */}
      {popupDate && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          onClick={() => setPopupDate(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Popup Header */}
            <div className="bg-slate-900 text-white px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-400/40 text-rose-300 flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm sm:text-base font-bold text-white truncate">
                    {formatThaiDateFull(popupDate)}
                  </h4>
                  <p className="text-xs text-slate-300 tabular-nums">
                    พบคิวงานปักหมุดทั้งหมด {popupJobs.length} รายการ
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPopupDate(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Popup Body: Job List */}
            <div className="p-4 sm:p-5 max-h-[65vh] overflow-y-auto space-y-3 bg-slate-50/70">
              {popupJobs.length === 0 ? (
                <div className="py-10 text-center bg-white rounded-xl border border-dashed border-slate-300 space-y-2">
                  <CalendarIcon className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="text-sm font-semibold text-slate-700">
                    ยังไม่มีคิวงานนัดหมายในวันนี้
                  </p>
                  <p className="text-xs text-slate-500">
                    กดปุ่ม &quot;+ เพิ่มงานวันนี้&quot; ด้านล่างเพื่อสร้างคิวนัดหมายใหม่
                  </p>
                </div>
              ) : (
                popupJobs.map((job) => {
                  const phoneAvailable = hasCustomerPhone(job.customer);
                  const phoneText = formatCustomerPhone(job.customer);

                  return (
                    <div
                      key={job.id}
                      onClick={() => {
                        setPopupDate(null);
                        onSelectJob(job);
                      }}
                      className="bg-white rounded-xl border border-slate-200 hover:border-blue-400 p-3.5 sm:p-4 space-y-2.5 transition-colors cursor-pointer shadow-2xs"
                    >
                      {/* Row 1: Queue # + Time + Status */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-mono font-bold text-xs shrink-0 tabular-nums">
                            {job.queueNumber}
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 font-mono tabular-nums">
                            <Clock className="w-3.5 h-3.5 shrink-0" />
                            <span>{job.appointmentTime || 'ไม่ระบุเวลา'}</span>
                          </span>
                        </div>

                        <span
                          className={`text-xs font-bold px-2.5 py-0.5 rounded border shrink-0 ${getStatusColorClass(
                            job.status
                          )}`}
                        >
                          {job.status}
                        </span>
                      </div>

                      {/* Row 2: Product & Symptoms */}
                      <div className="space-y-1">
                        <div className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                          <Wrench className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="break-words">{job.product}</span>
                        </div>
                        {job.symptoms && (
                          <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1 break-words">
                            อาการ: {job.symptoms}
                          </div>
                        )}
                      </div>

                      {/* Row 3: Customer, Phone, Address */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-slate-600 pt-1 border-t border-slate-100">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-semibold text-slate-800 truncate">
                            {job.customer.name}
                          </span>
                        </div>

                        <div
                          className="flex items-center gap-1.5 sm:justify-end"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          {phoneAvailable ? (
                            <a
                              href={`tel:${job.customer.phone.replace(/[^0-9]/g, '')}`}
                              className="font-mono font-semibold text-emerald-700 hover:underline tabular-nums"
                            >
                              {phoneText}
                            </a>
                          ) : (
                            <span className="text-slate-400 font-medium">{phoneText}</span>
                          )}
                        </div>

                        {job.customer.address && (
                          <div className="sm:col-span-2 flex items-start gap-1.5 text-slate-500">
                            <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                            <span className="line-clamp-2 break-words">{job.customer.address}</span>
                          </div>
                        )}
                      </div>

                      {/* Row 4: Technician + Cost + Open Prompt */}
                      <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-100 text-xs">
                        <span className="text-slate-500 truncate">
                          {job.assignedUserName ? `ช่าง: ${job.assignedUserName}` : 'คลิกเพื่อดูรายละเอียด / อัปเดตสถานะ'}
                        </span>
                        <span className="font-mono font-bold text-slate-900 tabular-nums shrink-0">
                          ฿{(job.actualCost ?? job.estimatedCost ?? 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Popup Footer */}
            <div className="px-4 sm:px-5 py-3 bg-white border-t border-slate-200 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  const targetDate = popupDate;
                  setPopupDate(null);
                  onOpenNewJob(targetDate);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ เพิ่มงานวันนี้</span>
              </button>

              <button
                type="button"
                onClick={() => setPopupDate(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
