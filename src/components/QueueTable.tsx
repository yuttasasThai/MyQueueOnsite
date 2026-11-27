import React, { useState, useMemo } from 'react';
import {
  Phone,
  MessageCircle,
  MapPin,
  Clock,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Search,
  SlidersHorizontal,
  ChevronRight,
  Printer,
  Calendar,
  CalendarClock,
  AlertTriangle,
  FileSpreadsheet,
  Edit,
  Edit3,
  ArrowRight,
  User,
  Camera,
  Award,
  Ban,
} from 'lucide-react';
import { RepairJob, RepairStatus } from '../types';
import { getWarrantyStatus } from '../services/storage';
import { getTotalJobPhotosCount } from '../services/imageUtils';
import { StatusStepperIcons, getNextForwardStatus } from './StatusStepperIcons';
import {
  EditStatusModal,
  RescheduleJobModal,
  CancelJobModal,
} from './StatusActionModals';

interface QueueTableProps {
  jobs: RepairJob[];
  onSelectJob: (job: RepairJob) => void;
  onEditJob: (job: RepairJob) => void;
  onDeleteJob: (jobId: string) => void;
  onStatusChange: (jobId: string, newStatus: RepairStatus, allowOverride?: boolean) => void;
  onRescheduleJob: (jobId: string, newDate: string, newTime: string, reason?: string) => void;
  onCancelJob: (jobId: string, reason?: string) => void;
  onPrintJob: (job: RepairJob) => void;
  onOpenStatusPhotos: (job: RepairJob, status?: RepairStatus) => void;
  isAdmin: boolean;
  currentUserId?: string;
  initialStatusFilter?: string;
  initialSheet?: 'all' | 'closed';
}

const ALL_STATUSES: RepairStatus[] = [
  'รับงาน',
  'กำลังไป',
  'กำลังซ่อม',
  'ซ่อมแล้ว',
  'ปิดงาน',
  'นัดหมายต่อ',
  'ยกเลิก',
];

export const QueueTable: React.FC<QueueTableProps> = ({
  jobs,
  onSelectJob,
  onEditJob,
  onStatusChange,
  onRescheduleJob,
  onCancelJob,
  onPrintJob,
  onOpenStatusPhotos,
  isAdmin,
  currentUserId,
  initialStatusFilter = 'all',
  initialSheet = 'all',
}) => {
  const [activeSheet, setActiveSheet] = useState<'all' | 'closed'>(initialSheet);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>(initialStatusFilter);
  const [selectedWarranty, setSelectedWarranty] = useState<string>('all');
  const [onlyMyJobs, setOnlyMyJobs] = useState(false);
  const [closedMonthFilter, setClosedMonthFilter] = useState<string>('all');
  const [editingStatusJob, setEditingStatusJob] = useState<RepairJob | null>(null);
  const [reschedulingJob, setReschedulingJob] = useState<RepairJob | null>(null);
  const [cancellingJob, setCancellingJob] = useState<RepairJob | null>(null);

  React.useEffect(() => {
    if (initialStatusFilter) {
      setSelectedStatus(initialStatusFilter);
    }
  }, [initialStatusFilter]);

  React.useEffect(() => {
    setActiveSheet(initialSheet);
  }, [initialSheet]);

  // Filter logic
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const query = searchTerm.toLowerCase().trim();
      const matchSearch =
        !query ||
        job.queueNumber.toLowerCase().includes(query) ||
        job.product.toLowerCase().includes(query) ||
        job.jobDetails.toLowerCase().includes(query) ||
        job.symptoms.toLowerCase().includes(query) ||
        job.customer.name.toLowerCase().includes(query) ||
        job.customer.phone.includes(query) ||
        job.customer.address.toLowerCase().includes(query);

      const matchStatus = selectedStatus === 'all' || job.status === selectedStatus;

      const ws = getWarrantyStatus(job.warrantyEndDate, job.warrantyDays);
      let matchWarranty = true;
      if (selectedWarranty === 'valid') matchWarranty = ws.status === 'valid';
      if (selectedWarranty === 'warning') matchWarranty = ws.status === 'warning';
      if (selectedWarranty === 'expired') matchWarranty = ws.status === 'expired';

      let matchUser = true;
      if (onlyMyJobs && currentUserId) {
        matchUser = job.assignedUserId === currentUserId;
      }

      return matchSearch && matchStatus && matchWarranty && matchUser;
    });
  }, [jobs, searchTerm, selectedStatus, selectedWarranty, onlyMyJobs, currentUserId]);

  // Summary calculations for Excel status bar
  const totalEstimatedCost = useMemo(() => {
    return filteredJobs.reduce((acc, j) => acc + (j.estimatedCost || 0), 0);
  }, [filteredJobs]);

  const totalActualCost = useMemo(() => {
    return filteredJobs.reduce(
      (acc, j) => acc + (j.actualCost !== null ? j.actualCost : 0),
      0
    );
  }, [filteredJobs]);

  // Closed Jobs Summary Sheet calculations
  const allClosedJobs = useMemo(() => {
    return jobs.filter((j) => j.status === 'ปิดงาน');
  }, [jobs]);

  const closedMonthOptions = useMemo(() => {
    const months = new Set<string>();
    allClosedJobs.forEach((j) => {
      const refDate = j.closedAt || j.appointmentDate || j.loggedDate;
      if (refDate && refDate.length >= 7) {
        months.add(refDate.slice(0, 7));
      }
    });
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [allClosedJobs]);

  const filteredClosedJobs = useMemo(() => {
    return allClosedJobs.filter((job) => {
      const query = searchTerm.toLowerCase().trim();
      const matchSearch =
        !query ||
        job.queueNumber.toLowerCase().includes(query) ||
        job.product.toLowerCase().includes(query) ||
        job.customer.name.toLowerCase().includes(query) ||
        job.customer.phone.includes(query) ||
        (job.assignedUserName || '').toLowerCase().includes(query);

      const refDate = job.closedAt || job.appointmentDate || job.loggedDate;
      const matchMonth =
        closedMonthFilter === 'all' || (refDate && refDate.startsWith(closedMonthFilter));

      const ws = getWarrantyStatus(job.warrantyEndDate, job.warrantyDays);
      let matchWarranty = true;
      if (selectedWarranty === 'valid') matchWarranty = ws.status === 'valid';
      if (selectedWarranty === 'warning') matchWarranty = ws.status === 'warning';
      if (selectedWarranty === 'expired') matchWarranty = ws.status === 'expired';

      return matchSearch && matchMonth && matchWarranty;
    });
  }, [allClosedJobs, searchTerm, closedMonthFilter, selectedWarranty]);

  const closedTotalEstimated = useMemo(
    () => filteredClosedJobs.reduce((acc, j) => acc + (j.estimatedCost || 0), 0),
    [filteredClosedJobs]
  );

  const closedTotalActual = useMemo(
    () =>
      filteredClosedJobs.reduce(
        (acc, j) => acc + (j.actualCost !== null ? j.actualCost : 0),
        0
      ),
    [filteredClosedJobs]
  );

  const closedValidWarrantyCount = useMemo(
    () =>
      filteredClosedJobs.filter((j) => {
        const ws = getWarrantyStatus(j.warrantyEndDate, j.warrantyDays);
        return j.warrantyDays > 0 && ws.status !== 'expired';
      }).length,
    [filteredClosedJobs]
  );

  // Status helper styles
  const getStatusBadge = (status: RepairStatus) => {
    switch (status) {
      case 'รับงาน':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'กำลังไป':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'กำลังซ่อม':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'ซ่อมแล้ว':
        return 'bg-teal-100 text-teal-800 border-teal-300';
      case 'ปิดงาน':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold';
      case 'นัดหมายต่อ':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'ยกเลิก':
        return 'bg-slate-200 text-slate-700 border-slate-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  const getWarrantyInfo = (job: RepairJob) => {
    return getWarrantyStatus(job.warrantyEndDate, job.warrantyDays);
  };

  const getMapsUrl = (address: string, coords?: string) => {
    if (coords && coords.includes(',')) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coords)}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  };

  // Export visible data to Excel CSV format with UTF-8 BOM
  const handleExportCSV = () => {
    const headers = [
      'ลำดับ',
      'เลขคิว',
      'วันบันทึก',
      'วันนัดหมาย',
      'เวลานัดหมาย',
      'ชื่อลูกค้า',
      'เบอร์โทรศัพท์',
      'ที่อยู่ลูกค้า',
      'สินค้า/อุปกรณ์',
      'หมวดงานซ่อม',
      'รายละเอียดงานซ่อม',
      'อาการที่รับแจ้ง',
      'ประเมินค่าซ่อม(บาท)',
      'ค่าซ่อมจริง(บาท)',
      'สถานะ',
      'ช่างผู้รับผิดชอบ',
      'ระยะประกัน(วัน)',
      'วันสิ้นสุดประกัน',
    ];

    const rows = filteredJobs.map((job, idx) => [
      idx + 1,
      job.queueNumber,
      job.loggedDate,
      job.appointmentDate,
      job.appointmentTime,
      `"${job.customer.name.replace(/"/g, '""')}"`,
      `"${job.customer.phone}"`,
      `"${job.customer.address.replace(/"/g, '""')}"`,
      `"${job.product.replace(/"/g, '""')}"`,
      `"${job.productCategory}"`,
      `"${(job.jobDetails || '').replace(/"/g, '""')}"`,
      `"${(job.symptoms || '').replace(/"/g, '""')}"`,
      job.estimatedCost || 0,
      job.actualCost !== null ? job.actualCost : '',
      job.status,
      `"${job.assignedUserName || ''}"`,
      job.warrantyDays,
      job.warrantyEndDate,
    ]);

    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `myqueue_onsite_excel_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Export dedicated Closed Jobs Summary Excel CSV with totals row
  const handleExportClosedCSV = () => {
    const headers = [
      'ลำดับ',
      'เลขคิว',
      'วันที่ปิดงาน',
      'วันนัดหมาย',
      'ชื่อลูกค้า',
      'เบอร์โทรศัพท์',
      'สินค้า/อุปกรณ์',
      'หมวดงานซ่อม',
      'รายละเอียดงานซ่อม',
      'ช่างผู้รับผิดชอบ',
      'ประเมินค่าซ่อม(บาท)',
      'ค่าซ่อมจริง(บาท)',
      'ระยะประกัน(วัน)',
      'วันเริ่มประกัน',
      'วันสิ้นสุดประกัน',
      'สถานะประกัน',
      'หมายเหตุปิดงาน',
    ];

    const rows = filteredClosedJobs.map((job, idx) => {
      const ws = getWarrantyStatus(job.warrantyEndDate, job.warrantyDays);
      const warrantyStatusLabel =
        job.warrantyDays === 0
          ? 'ไม่มีประกัน'
          : ws.status === 'expired'
          ? 'หมดประกันแล้ว'
          : `อยู่ในประกัน (เหลือ ${ws.daysRemaining} วัน)`;
      return [
        idx + 1,
        job.queueNumber,
        job.closedAt || job.appointmentDate,
        job.appointmentDate,
        `"${job.customer.name.replace(/"/g, '""')}"`,
        `"${job.customer.phone}"`,
        `"${job.product.replace(/"/g, '""')}"`,
        `"${job.productCategory || ''}"`,
        `"${(job.jobDetails || '').replace(/"/g, '""')}"`,
        `"${job.assignedUserName || ''}"`,
        job.estimatedCost || 0,
        job.actualCost !== null ? job.actualCost : 0,
        job.warrantyDays,
        job.warrantyStartDate || job.appointmentDate,
        job.warrantyEndDate,
        `"${warrantyStatusLabel}"`,
        `"${(job.notes || '').replace(/"/g, '""')}"`,
      ];
    });

    const summaryRow = [
      '',
      'รวมทั้งหมด',
      '',
      '',
      `"${filteredClosedJobs.length} งาน"`,
      '',
      '',
      '',
      '',
      '',
      closedTotalEstimated,
      closedTotalActual,
      '',
      '',
      '',
      '',
      '',
    ];

    const csvContent =
      '\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(',')), summaryRow.join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `myqueue_closed_jobs_summary_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3 font-sans">
      {/* Excel Workbook Sheet Switcher (ตารางคิวงานทั้งหมด vs สรุปงานที่ปิดแล้ว) */}
      <div className="bg-white rounded-xl border border-slate-300 shadow-xs p-1.5 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setActiveSheet('all')}
          className={`flex-1 min-w-[160px] py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeSheet === 'all'
              ? 'bg-emerald-700 text-white shadow-sm'
              : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 shrink-0" />
          <span>Sheet 1: ตารางคิวงานทั้งหมด</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-mono tabular-nums ${
              activeSheet === 'all' ? 'bg-emerald-900 text-emerald-100' : 'bg-slate-200 text-slate-700'
            }`}
          >
            {jobs.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSheet('closed')}
          className={`flex-1 min-w-[180px] py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeSheet === 'closed'
              ? 'bg-indigo-700 text-white shadow-sm'
              : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Award className="w-4 h-4 shrink-0" />
          <span>Sheet 2: สรุปงานที่ปิดแล้ว (Excel)</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-mono tabular-nums ${
              activeSheet === 'closed' ? 'bg-indigo-900 text-indigo-100' : 'bg-indigo-100 text-indigo-800'
            }`}
          >
            {allClosedJobs.length}
          </span>
        </button>
      </div>

      {/* Excel Ribbon Control Bar */}
      <div className="bg-white rounded-xl border border-slate-300 shadow-xs p-3.5 space-y-3">
        {/* Top row: Search, Filters, Excel Export */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Live Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหาคิวงาน, ชื่อลูกค้า, เบอร์โทร, สินค้า, อาการที่แจ้ง..."
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 px-1"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter Dropdowns & Excel Export Button */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
              <span>ประกัน:</span>
            </div>
            <select
              value={selectedWarranty}
              onChange={(e) => setSelectedWarranty(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2 font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-600 cursor-pointer"
            >
              <option value="all">ระยะประกันทั้งหมด</option>
              <option value="valid">อยู่ในประกัน</option>
              <option value="warning">ใกล้หมดประกัน (&le; 7 วัน)</option>
              <option value="expired">หมดประกันแล้ว</option>
            </select>

            {/* Month filter when on Closed Jobs Sheet */}
            {activeSheet === 'closed' && (
              <select
                value={closedMonthFilter}
                onChange={(e) => setClosedMonthFilter(e.target.value)}
                className="text-xs bg-indigo-50 border border-indigo-200 rounded-lg px-2.5 py-2 font-semibold text-indigo-800 focus:outline-none focus:ring-1 focus:ring-indigo-600 cursor-pointer"
              >
                <option value="all">ทุกเดือน ({allClosedJobs.length})</option>
                {closedMonthOptions.map((ym) => (
                  <option key={ym} value={ym}>
                    เดือน {ym}
                  </option>
                ))}
              </select>
            )}

            {/* Toggle Only My Jobs if in user mode */}
            {activeSheet === 'all' && !isAdmin && currentUserId && (
              <button
                type="button"
                onClick={() => setOnlyMyJobs(!onlyMyJobs)}
                className={`text-xs px-3 py-2 rounded-lg font-medium transition-colors border cursor-pointer ${
                  onlyMyJobs
                    ? 'bg-emerald-700 text-white border-emerald-700'
                    : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                เฉพาะงานของฉัน
              </button>
            )}

            {/* Excel Download button */}
            <button
              type="button"
              onClick={activeSheet === 'closed' ? handleExportClosedCSV : handleExportCSV}
              className={`flex items-center gap-1.5 px-3 py-2 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer ${
                activeSheet === 'closed'
                  ? 'bg-indigo-700 hover:bg-indigo-800'
                  : 'bg-emerald-700 hover:bg-emerald-800'
              }`}
              title={
                activeSheet === 'closed'
                  ? 'ส่งออกสรุปงานที่ปิดแล้วเป็น Excel (.csv)'
                  : 'ส่งออกตารางข้อมูลเป็น Excel (.csv)'
              }
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>
                {activeSheet === 'closed' ? 'ส่งออก Excel สรุปงานปิดแล้ว' : 'ส่งออก Excel'}
              </span>
            </button>
          </div>
        </div>

        {/* Real-time Circular Horizontal Status Icons Bar (Sheet 1 only) */}
        {activeSheet === 'all' && (
          <>
            <StatusStepperIcons
              mode="summary"
              variant="light"
              jobs={jobs}
              selectedStatus={selectedStatus}
              onSelectStatus={setSelectedStatus}
            />

            {/* Status Segmented Tabs Bar (Excel Sheet-like Tabs) */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs border-t border-slate-200 pt-2.5 scrollbar-none">
              <button
                type="button"
                onClick={() => setSelectedStatus('all')}
                className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  selectedStatus === 'all'
                    ? 'bg-emerald-800 text-white shadow-xs'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                ทั้งหมด ({jobs.length})
              </button>

              {ALL_STATUSES.map((status) => {
                const count = jobs.filter((j) => j.status === status).length;
                const isSelected = selectedStatus === status;
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setSelectedStatus(status)}
                    className={`px-2.5 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-700 text-white shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <span>{status}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono tabular-nums ${
                        isSelected ? 'bg-emerald-900 text-white' : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {activeSheet === 'all' ? (
      <>

      {/* Sheet 1 Mobile Card Layout (< md) */}
      <div className="md:hidden space-y-2.5">
        <div className="bg-gradient-to-r from-emerald-800 to-teal-800 text-white rounded-xl px-3.5 py-2.5 flex items-center justify-between text-xs shadow-xs">
          <div className="flex items-center gap-2 font-semibold min-w-0">
            <FileSpreadsheet className="w-4 h-4 text-emerald-300 shrink-0" />
            <span className="truncate">คิวงานซ่อม Onsite</span>
          </div>
          <span className="font-mono text-[11px] text-emerald-100 shrink-0 tabular-nums">
            แสดง {filteredJobs.length} / {jobs.length} งาน
          </span>
        </div>

        {filteredJobs.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="font-semibold text-slate-700 text-sm">
              ไม่พบข้อมูลงานซ่อมตามตัวกรองนี้
            </p>
            <p className="text-xs text-slate-400 mt-1">
              ลองเปลี่ยนคำค้นหา หรือกดเลือกแท็บ &quot;ทั้งหมด&quot;
            </p>
          </div>
        ) : (
          filteredJobs.map((job) => {
            const ws = getWarrantyInfo(job);
            const nextStatus = getNextForwardStatus(job.status);
            const photosCount = getTotalJobPhotosCount(job);

            return (
              <div
                key={job.id}
                onClick={() => onSelectJob(job)}
                className="bg-white rounded-xl border border-slate-200 shadow-2xs p-3.5 space-y-2.5 hover:border-emerald-400 active:bg-emerald-50/40 transition-colors cursor-pointer"
              >
                {/* Card Top Row: Queue Number + Status + Appointment */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                    <span className="font-mono font-bold text-xs bg-slate-800 text-white px-2 py-0.5 rounded shadow-2xs">
                      {job.queueNumber}
                    </span>
                    <span
                      className={`inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded border ${getStatusBadge(
                        job.status
                      )}`}
                    >
                      {job.status}
                    </span>
                    {job.assignedUserName && (
                      <span className="text-[11px] text-slate-500 font-medium truncate">
                        • ช่าง {job.assignedUserName.split(' ')[0]}
                      </span>
                    )}
                  </div>

                  <div className="text-right shrink-0 font-mono text-[11px] text-slate-700">
                    <div className="flex items-center justify-end gap-1 font-semibold text-slate-900">
                      <Calendar className="w-3 h-3 text-blue-600 shrink-0" />
                      <span>{job.appointmentDate}</span>
                    </div>
                    <div className="flex items-center justify-end gap-1 text-[10px] text-slate-500">
                      <Clock className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                      <span>{job.appointmentTime || 'ไม่ระบุเวลา'}</span>
                    </div>
                  </div>
                </div>

                {/* Customer Name, Address & Contact Quick Buttons */}
                <div className="flex items-start justify-between gap-2 pt-0.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 font-bold text-sm text-slate-900">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{job.customer.name}</span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-600 mt-0.5">
                      {job.customer.phone}
                    </div>
                    {job.customer.address && (
                      <div className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 break-words">
                        {job.customer.address}
                      </div>
                    )}
                  </div>

                  <div
                    className="flex items-center gap-1.5 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <a
                      href={`tel:${job.customer.phone.replace(/[^0-9]/g, '')}`}
                      className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-700 transition-colors"
                      title={`โทร: ${job.customer.phone}`}
                    >
                      <Phone className="w-4 h-4" />
                    </a>
                    {job.customer.lineId && (
                      <a
                        href={`https://line.me/ti/p/~${job.customer.lineId.replace('@', '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg bg-slate-100 hover:bg-emerald-100 text-emerald-600 transition-colors"
                        title={`LINE: ${job.customer.lineId}`}
                      >
                        <MessageCircle className="w-4 h-4" />
                      </a>
                    )}
                    <a
                      href={getMapsUrl(job.customer.address, job.customer.mapCoordinates)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg bg-slate-100 hover:bg-rose-100 text-rose-500 transition-colors"
                      title="เปิด Google Maps นำทาง"
                    >
                      <MapPin className="w-4 h-4" />
                    </a>
                  </div>
                </div>

                {/* Product, Job Details & Symptoms */}
                <div className="border-t border-slate-100 pt-2 space-y-1">
                  <div className="text-xs font-bold text-slate-900 break-words">
                    {job.product}
                  </div>
                  {job.jobDetails && (
                    <div className="text-xs text-slate-600 line-clamp-2 break-words">
                      {job.jobDetails}
                    </div>
                  )}
                  {job.symptoms && (
                    <div className="text-[11px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-block max-w-full break-words">
                      อาการ: {job.symptoms}
                    </div>
                  )}
                </div>

                {/* Costs & Warranty Summary */}
                <div className="border-t border-slate-100 pt-2 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <div className="text-[10px] text-slate-500">ประเมิน</div>
                    <div className="font-mono font-semibold text-slate-800 tabular-nums">
                      ฿{job.estimatedCost?.toLocaleString() || '0'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500">ค่าซ่อมจริง</div>
                    <div className="font-mono tabular-nums">
                      {job.actualCost !== null ? (
                        <span className="font-bold text-emerald-700">
                          ฿{job.actualCost.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-500">ประกัน</div>
                    <div className="text-[11px] font-semibold">
                      {ws.status === 'none' && (
                        <span className="text-slate-600">ไม่มี (0 วัน)</span>
                      )}
                      {ws.status === 'valid' && (
                        <span className="text-emerald-700 inline-flex items-center justify-end gap-0.5">
                          <ShieldCheck className="w-3 h-3 shrink-0" />
                          <span>เหลือ {ws.daysRemaining} ว.</span>
                        </span>
                      )}
                      {ws.status === 'warning' && (
                        <span className="text-amber-700 inline-flex items-center justify-end gap-0.5">
                          <ShieldAlert className="w-3 h-3 shrink-0" />
                          <span>ใกล้หมด {ws.daysRemaining} ว.</span>
                        </span>
                      )}
                      {ws.status === 'expired' && (
                        <span className="text-red-700 inline-flex items-center justify-end gap-0.5">
                          <ShieldX className="w-3 h-3 shrink-0" />
                          <span>หมดประกัน</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Footer */}
                <div
                  className="border-t border-slate-100 pt-2.5 flex flex-wrap items-center justify-between gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    {nextStatus && (
                      <button
                        type="button"
                        onClick={() => onStatusChange(job.id, nextStatus, false)}
                        className="min-h-[36px] inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                      >
                        <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                        <span>{nextStatus}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setEditingStatusJob(job)}
                      className="min-h-[36px] inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 shrink-0" />
                      <span>แก้ไขสถานะ</span>
                    </button>

                    {job.status !== 'ปิดงาน' && job.status !== 'ยกเลิก' && (
                      <button
                        type="button"
                        onClick={() => setReschedulingJob(job)}
                        className="min-h-[36px] inline-flex items-center gap-1 px-2 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                        title="เปลี่ยนวัน/เวลานัดหมาย"
                      >
                        <CalendarClock className="w-3.5 h-3.5 shrink-0" />
                        <span>เลื่อนนัด</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onOpenStatusPhotos(job)}
                      className="relative min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                      title={`รูป/วิดีโอ (${photosCount})`}
                    >
                      <Camera className="w-4 h-4" />
                      {photosCount > 0 && (
                        <span className="absolute top-0.5 right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-blue-600 text-white text-[9px] font-mono font-bold flex items-center justify-center">
                          {photosCount}
                        </span>
                      )}
                    </button>

                    {job.status !== 'ปิดงาน' && job.status !== 'ยกเลิก' && (
                      <button
                        type="button"
                        onClick={() => setCancellingJob(job)}
                        className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="ยกเลิกงาน"
                      >
                        <Ban className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onPrintJob(job)}
                      className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                      title="พิมพ์ใบเสร็จ/ส่งมอบ"
                    >
                      <Printer className="w-4 h-4" />
                    </button>

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => onEditJob(job)}
                        className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                        title="แก้ไขงาน"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onSelectJob(job)}
                      className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                      title="ดูรายละเอียดงาน"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Mobile Summary Bar */}
        <div className="bg-slate-100 rounded-xl border border-slate-200 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700 font-mono">
          <span className="font-semibold text-slate-900">
            รวม {filteredJobs.length} งาน (ปิดแล้ว {filteredJobs.filter((j) => j.status === 'ปิดงาน').length})
          </span>
          <div className="flex items-center gap-3 tabular-nums">
            <span>ประเมิน ฿{totalEstimatedCost.toLocaleString()}</span>
            <strong className="text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
              จริง ฿{totalActualCost.toLocaleString()}
            </strong>
          </div>
        </div>
      </div>

      {/* Excel Sheet Container with Green Toolbar Top (Desktop md+) */}
      <div className="hidden md:block bg-white rounded-xl border border-slate-300 shadow-sm overflow-hidden">
        {/* Excel Title Bar */}
        <div className="bg-gradient-to-r from-emerald-800 to-teal-800 text-white px-4 py-2.5 flex items-center justify-between text-xs border-b border-emerald-900">
          <div className="flex items-center gap-2 font-semibold">
            <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
            <span className="tracking-wide">
              ตารางคิวงานซ่อม Onsite (Excel Sheet View)
            </span>
          </div>
          <div className="font-mono text-[11px] text-emerald-200 flex items-center gap-3">
            <span>แสดง {filteredJobs.length} แถว</span>
            <span>|</span>
            <span>รวม {jobs.length} รายการ</span>
          </div>
        </div>

        {/* Excel Spreadsheet Table */}
        <div className="overflow-x-auto max-h-[70vh] relative">
          <table className="w-full text-left border-collapse text-xs select-text">
            {/* Excel Header (Thick border, distinct background, column headers) */}
            <thead className="sticky top-0 z-20 bg-slate-100 shadow-xs">
              <tr className="border-b-2 border-slate-300 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-2 px-2.5 border-r border-slate-300 text-center w-12 bg-slate-200 text-slate-600">
                  #
                </th>
                <th className="py-2.5 px-3 border-r border-slate-300 min-w-[85px] text-center">
                  เลขคิวงาน
                </th>
                <th className="py-2.5 px-3 border-r border-slate-300 min-w-[130px]">
                  วันนัดหมาย / เวลา
                </th>
                <th className="py-2.5 px-3 border-r border-slate-300 min-w-[200px]">
                  อุปกรณ์ & รายละเอียดงาน
                </th>
                <th className="py-2.5 px-3 border-r border-slate-300 min-w-[190px]">
                  ลูกค้า & ที่อยู่หน้างาน
                </th>
                <th className="py-2.5 px-3 border-r border-slate-300 min-w-[110px] text-center">
                  เบอร์โทร / แผนที่
                </th>
                <th className="py-2.5 px-3 border-r border-slate-300 text-right min-w-[100px]">
                  ประเมิน (฿)
                </th>
                <th className="py-2.5 px-3 border-r border-slate-300 text-right min-w-[100px]">
                  ค่าซ่อมจริง (฿)
                </th>
                <th className="py-2.5 px-3 border-r border-slate-300 text-center min-w-[120px]">
                  สถานะงาน
                </th>
                <th className="py-2.5 px-3 border-r border-slate-300 text-center min-w-[140px]">
                  ระยะประกัน
                </th>
                <th className="py-2.5 px-3 min-w-[95px] text-center bg-slate-100">
                  จัดการ
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400 bg-white">
                    <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-700 text-sm">
                      ไม่พบข้อมูลงานซ่อมในตารางตามตัวกรองนี้
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      ลองเปลี่ยนคำค้นหา หรือกดเลือกแท็บ "ทั้งหมด"
                    </p>
                  </td>
                </tr>
              ) : (
                filteredJobs.map((job, idx) => {
                  const ws = getWarrantyInfo(job);
                  const isEven = idx % 2 === 0;

                  return (
                    <tr
                      key={job.id}
                      onClick={() => onSelectJob(job)}
                      className={`transition-colors cursor-pointer group hover:bg-emerald-50/60 ${
                        isEven ? 'bg-white' : 'bg-slate-50/70'
                      }`}
                    >
                      {/* Excel Row Index */}
                      <td className="py-2 px-2.5 border-r border-slate-200 text-center font-mono text-slate-400 text-[11px] bg-slate-100/60 group-hover:bg-emerald-100/40">
                        {idx + 1}
                      </td>

                      {/* เลขคิวงาน */}
                      <td className="py-2 px-3 border-r border-slate-200 text-center whitespace-nowrap">
                        <span className="font-mono font-bold text-xs bg-slate-800 text-white px-2 py-0.5 rounded shadow-2xs">
                          {job.queueNumber}
                        </span>
                      </td>

                      {/* วันนัดหมาย & เวลา */}
                      <td className="py-2 px-3 border-r border-slate-200 text-slate-800">
                        <div className="flex items-center gap-1 font-mono font-semibold text-slate-900">
                          <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span>{job.appointmentDate}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                          <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{job.appointmentTime || 'ไม่ระบุเวลา'}</span>
                        </div>
                        {job.status !== 'ปิดงาน' && job.status !== 'ยกเลิก' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setReschedulingJob(job);
                            }}
                            className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[10px] font-semibold transition-colors cursor-pointer"
                            title="เปลี่ยนวัน/เวลานัดหมาย"
                          >
                            <CalendarClock className="w-2.5 h-2.5" />
                            <span>เปลี่ยนนัด</span>
                          </button>
                        )}
                      </td>

                      {/* สินค้า & รายละเอียดงาน */}
                      <td className="py-2 px-3 border-r border-slate-200">
                        <div className="font-bold text-slate-900 line-clamp-1">
                          {job.product}
                        </div>
                        <div className="text-[11px] text-slate-600 line-clamp-1 mt-0.5">
                          {job.jobDetails}
                        </div>
                        {job.symptoms && (
                          <div className="text-[10px] text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 mt-0.5 line-clamp-1 inline-block">
                            อาการ: {job.symptoms}
                          </div>
                        )}
                      </td>

                      {/* ข้อมูลลูกค้า & ที่อยู่ */}
                      <td className="py-2 px-3 border-r border-slate-200">
                        <div className="font-bold text-slate-900 flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{job.customer.name}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                          {job.customer.address || '-'}
                        </div>
                      </td>

                      {/* ช่องทางการติดต่อ & แผนที่ */}
                      <td
                        className="py-2 px-3 border-r border-slate-200 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Call */}
                          <a
                            href={`tel:${job.customer.phone.replace(/[^0-9]/g, '')}`}
                            className="p-1.5 rounded-md bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-700 transition-colors"
                            title={`โทร: ${job.customer.phone}`}
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>

                          {/* Line */}
                          {job.customer.lineId && (
                            <a
                              href={`https://line.me/ti/p/~${job.customer.lineId.replace('@', '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-md bg-slate-100 hover:bg-emerald-100 text-slate-700 transition-colors"
                              title={`LINE: ${job.customer.lineId}`}
                            >
                              <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                            </a>
                          )}

                          {/* Map Pin */}
                          <a
                            href={getMapsUrl(job.customer.address, job.customer.mapCoordinates)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-md bg-slate-100 hover:bg-rose-100 text-slate-700 transition-colors"
                            title="เปิด Google Maps นำทาง"
                          >
                            <MapPin className="w-3.5 h-3.5 text-rose-500" />
                          </a>
                        </div>
                        <div className="font-mono text-[10px] text-slate-600 mt-0.5">
                          {job.customer.phone}
                        </div>
                      </td>

                      {/* ประเมินค่าซ่อม (บาท) */}
                      <td className="py-2 px-3 border-r border-slate-200 text-right font-mono font-medium text-slate-700 tabular-nums">
                        ฿{job.estimatedCost?.toLocaleString() || '0'}
                      </td>

                      {/* ค่าซ่อมจริง (บาท) */}
                      <td className="py-2 px-3 border-r border-slate-200 text-right font-mono tabular-nums">
                        {job.actualCost !== null ? (
                          <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            ฿{job.actualCost.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* สถานะ (เดินหน้าทางเดียว + ปุ่มแก้ไขสถานะ) */}
                      <td
                        className="py-2 px-2.5 border-r border-slate-200 text-center min-w-[140px]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex flex-col items-center gap-1">
                          <span
                            className={`inline-flex items-center justify-center w-full max-w-[125px] text-[11px] font-bold px-2 py-0.5 rounded border ${getStatusBadge(
                              job.status
                            )}`}
                          >
                            {job.status}
                          </span>

                          <div className="flex items-center justify-center gap-1 w-full max-w-[130px]">
                            {getNextForwardStatus(job.status) && (
                              <button
                                type="button"
                                onClick={() => {
                                  const next = getNextForwardStatus(job.status);
                                  if (next) {
                                    onStatusChange(job.id, next, false);
                                  }
                                }}
                                className="flex-1 inline-flex items-center justify-center gap-0.5 px-1.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold shadow-2xs transition-colors cursor-pointer whitespace-nowrap"
                                title={`เดินหน้าสถานะเป็น "${getNextForwardStatus(job.status)}" ทันที`}
                              >
                                <ArrowRight className="w-2.5 h-2.5 shrink-0" />
                                <span className="truncate">{getNextForwardStatus(job.status)}</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => setEditingStatusJob(job)}
                              className="inline-flex items-center justify-center gap-0.5 px-1.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded text-[10px] font-bold transition-colors cursor-pointer whitespace-nowrap"
                              title="แก้ไขสถานะงาน"
                            >
                              <Edit3 className="w-2.5 h-2.5 shrink-0" />
                              <span>แก้ไขสถานะ</span>
                            </button>
                          </div>
                        </div>
                        {job.assignedUserName && (
                          <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                            ช่าง: {job.assignedUserName.split(' ')[0]}
                          </div>
                        )}
                      </td>

                      {/* ระยะประกัน */}
                      <td className="py-2 px-3 border-r border-slate-200 text-center">
                        {ws.status === 'none' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-medium text-[11px]">
                            ไม่มีประกัน (0 วัน)
                          </span>
                        )}
                        {ws.status === 'valid' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 font-medium text-[11px]">
                            <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span>เหลือ {ws.daysRemaining} วัน</span>
                          </span>
                        )}
                        {ws.status === 'warning' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[11px] animate-pulse">
                            <ShieldAlert className="w-3 h-3 text-amber-600 shrink-0" />
                            <span>ใกล้หมด ({ws.daysRemaining} ว.)</span>
                          </span>
                        )}
                        {ws.status === 'expired' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-100 text-red-800 border border-red-300 font-semibold text-[11px]">
                            <ShieldX className="w-3 h-3 text-red-600 shrink-0" />
                            <span>หมดประกัน</span>
                          </span>
                        )}
                        {ws.status !== 'none' && (
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            {job.warrantyDays} วัน ({job.warrantyEndDate})
                          </div>
                        )}
                      </td>

                      {/* จัดการ (Actions - เปิด Pop-up รูปแยกต่างหาก ไม่แสดงรูปในตาราง) */}
                      <td
                        className="py-2 px-2.5 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => onOpenStatusPhotos(job)}
                            className="relative p-1 rounded text-blue-600 hover:text-blue-800 hover:bg-blue-50 transition-colors cursor-pointer"
                            title={`ถ่ายรูป/แนบรูปและวิดีโอแต่ละสถานะ (${getTotalJobPhotosCount(job)} ไฟล์)`}
                          >
                            <Camera className="w-3.5 h-3.5" />
                            {getTotalJobPhotosCount(job) > 0 && (
                              <span className="absolute -top-1 -right-1 min-w-[13px] h-[13px] px-0.5 rounded-full bg-blue-600 text-white text-[8px] font-mono font-bold flex items-center justify-center">
                                {getTotalJobPhotosCount(job)}
                              </span>
                            )}
                          </button>
                          {job.status !== 'ปิดงาน' && job.status !== 'ยกเลิก' && (
                            <>
                              <button
                                type="button"
                                onClick={() => setReschedulingJob(job)}
                                className="p-1 rounded text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 transition-colors cursor-pointer"
                                title="เปลี่ยนวัน/เวลานัดหมาย"
                              >
                                <CalendarClock className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setCancellingJob(job)}
                                className="p-1 rounded text-rose-600 hover:text-rose-800 hover:bg-rose-50 transition-colors cursor-pointer"
                                title="ยกเลิกงาน"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => onSelectJob(job)}
                            className="p-1 rounded text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                            title="ดูรายละเอียดงาน"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onPrintJob(job)}
                            className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                            title="พิมพ์ใบเสร็จ/ส่งมอบ"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => onEditJob(job)}
                              className="p-1 rounded text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                              title="แก้ไขงาน"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Excel Status Bar (Sum / Count summary footer) */}
        <div className="bg-slate-100 border-t border-slate-300 px-4 py-2 flex flex-wrap items-center justify-between text-xs text-slate-600 font-mono select-none">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-slate-800">
              จำนวนงาน (COUNT): {filteredJobs.length}
            </span>
            <span>•</span>
            <span>
              ปิดงานแล้ว: {filteredJobs.filter((j) => j.status === 'ปิดงาน').length}
            </span>
            <span>•</span>
            <span>
              กำลังดำเนินการ:{' '}
              {
                filteredJobs.filter(
                  (j) =>
                    j.status === 'รับงาน' ||
                    j.status === 'กำลังไป' ||
                    j.status === 'กำลังซ่อม'
                ).length
              }
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div>
              <span>รวมประเมิน: </span>
              <strong className="text-slate-900 font-bold">
                ฿{totalEstimatedCost.toLocaleString()}
              </strong>
            </div>
            <div>
              <span>รวมค่าซ่อมจริง (SUM): </span>
              <strong className="text-emerald-800 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                ฿{totalActualCost.toLocaleString()}
              </strong>
            </div>
          </div>
        </div>
      </div>
      </>
      ) : (
        /* Sheet 2: ตาราง Excel แยกสำหรับสรุปงานที่ปิดแล้ว */
        <div className="space-y-3">
          {/* Closed Jobs Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="bg-white rounded-xl border border-indigo-200 p-3 flex items-center justify-between shadow-2xs">
              <div>
                <span className="text-[11px] font-semibold text-slate-500 block">
                  จำนวนงานที่ปิดแล้ว (COUNT)
                </span>
                <strong className="text-xl font-mono font-black text-indigo-800 tabular-nums">
                  {filteredClosedJobs.length} งาน
                </strong>
              </div>
              <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                <Award className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-emerald-200 p-3 flex items-center justify-between shadow-2xs">
              <div>
                <span className="text-[11px] font-semibold text-slate-500 block">
                  ยอดค่าซ่อมจริงรวมทั้งหมด (SUM)
                </span>
                <strong className="text-xl font-mono font-black text-emerald-700 tabular-nums">
                  ฿{closedTotalActual.toLocaleString()}
                </strong>
              </div>
              <div className="text-right text-[10px] text-slate-500 font-mono">
                <div>ประเมินรวม</div>
                <div className="font-bold text-slate-700">
                  ฿{closedTotalEstimated.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-blue-200 p-3 flex items-center justify-between shadow-2xs">
              <div>
                <span className="text-[11px] font-semibold text-slate-500 block">
                  งานที่ยังอยู่ในระยะประกัน
                </span>
                <strong className="text-xl font-mono font-black text-blue-700 tabular-nums">
                  {closedValidWarrantyCount} งาน
                </strong>
              </div>
              <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Sheet 2 Mobile Card Layout (< md) */}
          <div className="md:hidden space-y-2.5">
            <div className="bg-gradient-to-r from-indigo-800 to-blue-800 text-white rounded-xl px-3.5 py-2.5 flex items-center justify-between text-xs shadow-xs">
              <div className="flex items-center gap-2 font-semibold min-w-0">
                <FileSpreadsheet className="w-4 h-4 text-indigo-200 shrink-0" />
                <span className="truncate">สรุปงานที่ปิดแล้ว</span>
              </div>
              <span className="font-mono text-[11px] text-indigo-100 shrink-0 tabular-nums">
                {filteredClosedJobs.length} งาน • ฿{closedTotalActual.toLocaleString()}
              </span>
            </div>

            {filteredClosedJobs.length === 0 ? (
              <div className="bg-white rounded-xl border border-indigo-200 p-8 text-center text-slate-400">
                <Award className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="font-semibold text-slate-700 text-sm">
                  ยังไม่มีรายการงานที่ปิดแล้วในตารางสรุป
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  เมื่ออัปเดตงานใดเป็นสถานะ &quot;ปิดงาน&quot; ระบบจะจัดเก็บลงตารางนี้อัตโนมัติ
                </p>
              </div>
            ) : (
              filteredClosedJobs.map((job) => {
                const ws = getWarrantyInfo(job);
                const closedDateLabel = job.closedAt || job.appointmentDate;
                const photosCount = getTotalJobPhotosCount(job);

                return (
                  <div
                    key={job.id}
                    onClick={() => onSelectJob(job)}
                    className="bg-white rounded-xl border border-indigo-200/80 shadow-2xs p-3.5 space-y-2.5 hover:border-indigo-400 active:bg-indigo-50/40 transition-colors cursor-pointer"
                  >
                    {/* Top Row: Queue + Closed Status + Dates */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                        <span className="font-mono font-bold text-xs bg-indigo-800 text-white px-2 py-0.5 rounded shadow-2xs">
                          {job.queueNumber}
                        </span>
                        <span className="inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded border bg-emerald-100 text-emerald-800 border-emerald-300">
                          ปิดงาน
                        </span>
                        {job.assignedUserName && (
                          <span className="text-[11px] text-slate-500 font-medium truncate">
                            • ช่าง {job.assignedUserName.split(' ')[0]}
                          </span>
                        )}
                      </div>

                      <div className="text-right shrink-0 font-mono text-[11px]">
                        <div className="font-bold text-indigo-800">
                          ปิด: {closedDateLabel}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          นัด: {job.appointmentDate}
                        </div>
                      </div>
                    </div>

                    {/* Customer Name & Phone */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 font-bold text-sm text-slate-900">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{job.customer.name}</span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-600 mt-0.5">
                          {job.customer.phone}
                        </div>
                      </div>

                      <div
                        className="flex items-center gap-1.5 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <a
                          href={`tel:${job.customer.phone.replace(/[^0-9]/g, '')}`}
                          className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-700 transition-colors"
                          title={`โทร: ${job.customer.phone}`}
                        >
                          <Phone className="w-4 h-4" />
                        </a>
                      </div>
                    </div>

                    {/* Product, Details & Closing Notes */}
                    <div className="border-t border-slate-100 pt-2 space-y-1">
                      <div className="text-xs font-bold text-slate-900 break-words">
                        {job.product}
                      </div>
                      {(job.jobDetails || job.symptoms) && (
                        <div className="text-xs text-slate-600 line-clamp-2 break-words">
                          {job.jobDetails || job.symptoms}
                        </div>
                      )}
                      {job.notes && (
                        <div className="text-[11px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 inline-block max-w-full break-words">
                          หมายเหตุ: {job.notes}
                        </div>
                      )}
                    </div>

                    {/* Financial & Warranty Strip */}
                    <div className="border-t border-slate-100 pt-2 grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <div className="text-[10px] text-slate-500">ประเมิน</div>
                        <div className="font-mono text-slate-700 tabular-nums">
                          ฿{(job.estimatedCost || 0).toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500">ค่าซ่อมจริง</div>
                        <div className="font-mono font-bold text-emerald-700 tabular-nums">
                          ฿{(job.actualCost ?? 0).toLocaleString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-slate-500">ประกัน</div>
                        <div className="text-[11px] font-semibold">
                          {job.warrantyDays === 0 ? (
                            <span className="text-slate-600">ไม่มี (0 วัน)</span>
                          ) : ws.status === 'expired' ? (
                            <span className="text-red-700 inline-flex items-center justify-end gap-0.5">
                              <ShieldX className="w-3 h-3 shrink-0" />
                              <span>หมดประกัน</span>
                            </span>
                          ) : (
                            <span className="text-emerald-700 inline-flex items-center justify-end gap-0.5">
                              <ShieldCheck className="w-3 h-3 shrink-0" />
                              <span>เหลือ {ws.daysRemaining} ว.</span>
                            </span>
                          )}
                        </div>
                        {job.warrantyDays > 0 && (
                          <div className="text-[10px] text-slate-400 font-mono">
                            ถึง {job.warrantyEndDate}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions Row */}
                    <div
                      className="border-t border-slate-100 pt-2 flex items-center justify-between gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onOpenStatusPhotos(job)}
                          className="relative min-h-[36px] inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold transition-colors cursor-pointer"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>รูปภาพ ({photosCount})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onPrintJob(job)}
                          className="min-h-[36px] inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>พิมพ์</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => onSelectJob(job)}
                        className="min-h-[36px] inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-indigo-700 hover:bg-indigo-50 text-xs font-bold transition-colors cursor-pointer"
                      >
                        <span>รายละเอียด</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}

            {/* Mobile Closed Summary Bar */}
            <div className="bg-indigo-50 rounded-xl border border-indigo-200 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-indigo-900">
              <span className="font-bold">
                ปิดแล้ว {filteredClosedJobs.length} งาน • ในประกัน {closedValidWarrantyCount}
              </span>
              <div className="flex items-center gap-3 tabular-nums">
                <span>ประเมิน ฿{closedTotalEstimated.toLocaleString()}</span>
                <strong className="text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                  จริง ฿{closedTotalActual.toLocaleString()}
                </strong>
              </div>
            </div>
          </div>

          {/* Dedicated Closed Jobs Excel Table (Desktop md+) */}
          <div className="hidden md:block bg-white rounded-xl border border-indigo-300 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-800 to-blue-800 text-white px-4 py-2.5 flex items-center justify-between text-xs border-b border-indigo-900">
              <div className="flex items-center gap-2 font-semibold">
                <FileSpreadsheet className="w-4 h-4 text-indigo-200" />
                <span className="tracking-wide">
                  ตาราง Excel สรุปงานที่ปิดแล้ว (Closed Jobs Summary)
                </span>
              </div>
              <div className="font-mono text-[11px] text-indigo-200 flex items-center gap-3">
                <span>แสดง {filteredClosedJobs.length} แถว</span>
                <span>|</span>
                <span>รวมค่าซ่อมจริง ฿{closedTotalActual.toLocaleString()}</span>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[70vh] relative">
              <table className="w-full text-left border-collapse text-xs select-text">
                <thead className="sticky top-0 z-20 bg-indigo-50 shadow-xs">
                  <tr className="border-b-2 border-indigo-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-2 px-2.5 border-r border-indigo-200 text-center w-12 bg-indigo-100 text-indigo-800">
                      #
                    </th>
                    <th className="py-2.5 px-3 border-r border-indigo-200 min-w-[85px] text-center">
                      เลขคิวงาน
                    </th>
                    <th className="py-2.5 px-3 border-r border-indigo-200 min-w-[130px]">
                      วันที่ปิดงาน / นัด
                    </th>
                    <th className="py-2.5 px-3 border-r border-indigo-200 min-w-[200px]">
                      สินค้า &amp; รายละเอียดปิดงาน
                    </th>
                    <th className="py-2.5 px-3 border-r border-indigo-200 min-w-[160px]">
                      ลูกค้า &amp; เบอร์โทร
                    </th>
                    <th className="py-2.5 px-3 border-r border-indigo-200 min-w-[110px]">
                      ช่างผู้รับผิดชอบ
                    </th>
                    <th className="py-2.5 px-3 border-r border-indigo-200 text-right min-w-[95px]">
                      ประเมิน (฿)
                    </th>
                    <th className="py-2.5 px-3 border-r border-indigo-200 text-right min-w-[110px] bg-emerald-50 text-emerald-900">
                      ค่าซ่อมจริง (฿)
                    </th>
                    <th className="py-2.5 px-3 border-r border-indigo-200 text-center min-w-[155px]">
                      ระยะประกัน &amp; หมดอายุ
                    </th>
                    <th className="py-2.5 px-3 min-w-[110px] text-center bg-indigo-50">
                      จัดการ
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                  {filteredClosedJobs.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400 bg-white">
                        <Award className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <p className="font-semibold text-slate-700 text-sm">
                          ยังไม่มีรายการงานที่ปิดแล้วในตารางสรุป
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          เมื่ออัปเดตงานใดเป็นสถานะ &quot;ปิดงาน&quot; พร้อมใส่ค่าซ่อมและระยะประกัน ระบบจะจัดเก็บลงตารางนี้อัตโนมัติ
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredClosedJobs.map((job, idx) => {
                      const ws = getWarrantyInfo(job);
                      const isEven = idx % 2 === 0;
                      const closedDateLabel = job.closedAt || job.appointmentDate;
                      return (
                        <tr
                          key={job.id}
                          onClick={() => onSelectJob(job)}
                          className={`transition-colors cursor-pointer group hover:bg-indigo-50/60 ${
                            isEven ? 'bg-white' : 'bg-slate-50/70'
                          }`}
                        >
                          <td className="py-2 px-2.5 border-r border-slate-200 text-center font-mono text-slate-400 text-[11px] bg-slate-100/60">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200 text-center whitespace-nowrap">
                            <span className="font-mono font-bold text-xs bg-indigo-800 text-white px-2 py-0.5 rounded shadow-2xs">
                              {job.queueNumber}
                            </span>
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200">
                            <div className="font-mono font-bold text-indigo-800">
                              ปิด: {closedDateLabel}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                              นัด: {job.appointmentDate}
                            </div>
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200">
                            <div className="font-bold text-slate-900 line-clamp-1">
                              {job.product}
                            </div>
                            <div className="text-[11px] text-slate-600 line-clamp-1 mt-0.5">
                              {job.jobDetails || job.symptoms}
                            </div>
                            {job.notes && (
                              <div className="text-[10px] text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200 mt-0.5 line-clamp-1 inline-block">
                                หมายเหตุ: {job.notes}
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200">
                            <div className="font-bold text-slate-900">{job.customer.name}</div>
                            <div className="font-mono text-[11px] text-slate-600">
                              {job.customer.phone}
                            </div>
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200 text-slate-700">
                            {job.assignedUserName || '-'}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200 text-right font-mono text-slate-600 tabular-nums">
                            ฿{(job.estimatedCost || 0).toLocaleString()}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200 text-right font-mono tabular-nums bg-emerald-50/40">
                            <span className="font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                              ฿{(job.actualCost ?? 0).toLocaleString()}
                            </span>
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200 text-center">
                            {job.warrantyDays === 0 ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 text-[11px]">
                                ไม่มีประกัน (0 วัน)
                              </span>
                            ) : ws.status === 'expired' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-100 text-red-800 border border-red-300 font-semibold text-[11px]">
                                <ShieldX className="w-3 h-3 shrink-0" />
                                <span>หมดประกัน</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 font-medium text-[11px]">
                                <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                                <span>เหลือ {ws.daysRemaining} วัน</span>
                              </span>
                            )}
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                              {job.warrantyDays} วัน (ถึง {job.warrantyEndDate})
                            </div>
                          </td>
                          <td
                            className="py-2 px-2.5 text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => onOpenStatusPhotos(job)}
                                className="relative p-1 rounded text-blue-600 hover:text-blue-800 hover:bg-blue-50 transition-colors cursor-pointer"
                                title={`ดู/เพิ่มรูปภาพแต่ละสถานะ (${getTotalJobPhotosCount(job)} รูป)`}
                              >
                                <Camera className="w-3.5 h-3.5" />
                                {getTotalJobPhotosCount(job) > 0 && (
                                  <span className="absolute -top-1 -right-1 min-w-[13px] h-[13px] px-0.5 rounded-full bg-blue-600 text-white text-[8px] font-mono font-bold flex items-center justify-center">
                                    {getTotalJobPhotosCount(job)}
                                  </span>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => onSelectJob(job)}
                                className="p-1 rounded text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 transition-colors cursor-pointer"
                                title="ดูรายละเอียด"
                              >
                                <ChevronRight className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onPrintJob(job)}
                                className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                                title="พิมพ์ใบเสร็จ/ส่งมอบ"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Excel Summary Footer */}
            <div className="bg-indigo-50 border-t border-indigo-200 px-4 py-2.5 flex flex-wrap items-center justify-between text-xs text-indigo-900 font-mono select-none">
              <div className="flex items-center gap-3">
                <span className="font-bold">
                  สรุปงานที่ปิดแล้ว (COUNT): {filteredClosedJobs.length} งาน
                </span>
                <span>•</span>
                <span>อยู่ในประกัน: {closedValidWarrantyCount} งาน</span>
              </div>
              <div className="flex items-center gap-4">
                <div>
                  <span>รวมประเมิน: </span>
                  <strong>฿{closedTotalEstimated.toLocaleString()}</strong>
                </div>
                <div>
                  <span>รวมค่าซ่อมจริง (SUM): </span>
                  <strong className="text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                    ฿{closedTotalActual.toLocaleString()}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Explicit Edit Status Modal */}
      <EditStatusModal
        job={editingStatusJob}
        onClose={() => setEditingStatusJob(null)}
        onSaveStatus={(jobId, newStatus) => onStatusChange(jobId, newStatus, true)}
      />

      {/* Reschedule Appointment Modal */}
      <RescheduleJobModal
        job={reschedulingJob}
        onClose={() => setReschedulingJob(null)}
        onConfirmReschedule={onRescheduleJob}
      />

      {/* Cancel Job Confirmation Modal */}
      <CancelJobModal
        job={cancellingJob}
        onClose={() => setCancellingJob(null)}
        onConfirmCancel={onCancelJob}
      />
    </div>
  );
};
