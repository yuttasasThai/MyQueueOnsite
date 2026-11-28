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
  CalendarClock,
  AlertTriangle,
  FileSpreadsheet,
  Edit,
  Edit3,
  ArrowRight,
  Camera,
  Award,
  Ban,
  MessageSquare,
} from 'lucide-react';
import { RepairJob, RepairStatus, ShopSettings } from '../types';
import { INITIAL_SHOP_SETTINGS } from '../data/initialData';
import { getWarrantyStatus } from '../services/storage';
import { getTotalJobPhotosCount } from '../services/imageUtils';
import { addNotificationLog } from '../services/lineNotify';
import {
  buildDeviceSmsUri,
  cleanSmsPhone,
  formatCustomerPhone,
  formatCustomerStatusSms,
  hasCustomerPhone,
} from '../services/smsNotify';
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
  settings?: ShopSettings;
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
  settings = INITIAL_SHOP_SETTINGS,
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

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const query = searchTerm.toLowerCase().trim();
      const phoneLabel = formatCustomerPhone(job.customer).toLowerCase();
      const matchSearch =
        !query ||
        job.queueNumber.toLowerCase().includes(query) ||
        job.product.toLowerCase().includes(query) ||
        job.jobDetails.toLowerCase().includes(query) ||
        job.symptoms.toLowerCase().includes(query) ||
        job.customer.name.toLowerCase().includes(query) ||
        job.customer.phone.includes(query) ||
        phoneLabel.includes(query) ||
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

  const totalEstimatedCost = useMemo(() => {
    return filteredJobs.reduce((acc, j) => acc + (j.estimatedCost || 0), 0);
  }, [filteredJobs]);

  const totalActualCost = useMemo(() => {
    return filteredJobs.reduce(
      (acc, j) => acc + (j.actualCost !== null ? j.actualCost : 0),
      0
    );
  }, [filteredJobs]);

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
      const phoneLabel = formatCustomerPhone(job.customer).toLowerCase();
      const matchSearch =
        !query ||
        job.queueNumber.toLowerCase().includes(query) ||
        job.product.toLowerCase().includes(query) ||
        job.customer.name.toLowerCase().includes(query) ||
        job.customer.phone.includes(query) ||
        phoneLabel.includes(query) ||
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

  const getStatusBadge = (status: RepairStatus) => {
    switch (status) {
      case 'รับงาน':
        return 'bg-blue-50 text-blue-800 border-blue-300';
      case 'กำลังไป':
        return 'bg-amber-50 text-amber-800 border-amber-300';
      case 'กำลังซ่อม':
        return 'bg-purple-50 text-purple-800 border-purple-300';
      case 'ซ่อมแล้ว':
        return 'bg-teal-50 text-teal-800 border-teal-300';
      case 'ปิดงาน':
        return 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold';
      case 'นัดหมายต่อ':
        return 'bg-orange-50 text-orange-800 border-orange-300';
      case 'ยกเลิก':
        return 'bg-slate-200 text-slate-700 border-slate-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  const getMapsUrl = (address: string, coords?: string) => {
    if (coords && coords.includes(',')) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coords)}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  };

  const formatShortDate = (ymd?: string) => {
    if (!ymd || ymd.length < 10) return ymd || '-';
    const [, m, d] = ymd.slice(0, 10).split('-');
    return `${d}/${m}`;
  };

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
      `"${formatCustomerPhone(job.customer).replace(/"/g, '""')}"`,
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
        `"${formatCustomerPhone(job.customer).replace(/"/g, '""')}"`,
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
      {/* Excel Workbook Sheet Switcher */}
      <div className="bg-white rounded-xl border border-slate-300 shadow-xs p-1.5 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setActiveSheet('all')}
          className={`flex-1 min-w-[160px] py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeSheet === 'all'
              ? 'bg-emerald-800 text-white'
              : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 shrink-0" />
          <span>Sheet 1: ตารางคิวงานทั้งหมด</span>
          <span className="font-mono tabular-nums opacity-90">({jobs.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSheet('closed')}
          className={`flex-1 min-w-[180px] py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeSheet === 'closed'
              ? 'bg-indigo-800 text-white'
              : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Award className="w-4 h-4 shrink-0" />
          <span>Sheet 2: สรุปงานที่ปิดแล้ว (Excel)</span>
          <span className="font-mono tabular-nums opacity-90">({allClosedJobs.length})</span>
        </button>
      </div>

      {/* Excel Ribbon Control Bar */}
      <div className="bg-white rounded-xl border border-slate-300 shadow-xs p-3 space-y-2.5">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
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
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 px-1 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

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

            {activeSheet === 'all' && !isAdmin && currentUserId && (
              <button
                type="button"
                onClick={() => setOnlyMyJobs(!onlyMyJobs)}
                className={`text-xs px-3 py-2 rounded-lg font-medium transition-colors border cursor-pointer whitespace-nowrap ${
                  onlyMyJobs
                    ? 'bg-emerald-700 text-white border-emerald-700'
                    : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                เฉพาะงานของฉัน
              </button>
            )}

            <button
              type="button"
              onClick={activeSheet === 'closed' ? handleExportClosedCSV : handleExportCSV}
              className={`flex items-center gap-1.5 px-3 py-2 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeSheet === 'closed'
                  ? 'bg-indigo-800 hover:bg-indigo-900'
                  : 'bg-emerald-800 hover:bg-emerald-900'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 shrink-0" />
              <span>
                {activeSheet === 'closed' ? 'ส่งออก Excel สรุปงานปิดแล้ว' : 'ส่งออก Excel (.csv)'}
              </span>
            </button>
          </div>
        </div>

        {activeSheet === 'all' && (
          <>
            <StatusStepperIcons
              mode="summary"
              variant="light"
              jobs={jobs}
              selectedStatus={selectedStatus}
              onSelectStatus={setSelectedStatus}
            />

            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-xs border-t border-slate-200 pt-2 scrollbar-none">
              <button
                type="button"
                onClick={() => setSelectedStatus('all')}
                className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  selectedStatus === 'all'
                    ? 'bg-emerald-800 text-white'
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
                        ? 'bg-emerald-700 text-white font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <span>{status}</span>
                    <span className="text-[11px] font-mono tabular-nums opacity-85">({count})</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {activeSheet === 'all' ? (
        <div className="bg-white rounded-xl border border-slate-300 shadow-xs overflow-hidden">
          {/* Excel Workbook Top Toolbar */}
          <div className="bg-emerald-800 text-white px-3.5 py-2 flex items-center justify-between text-xs border-b border-emerald-900">
            <div className="flex items-center gap-2 font-semibold min-w-0">
              <FileSpreadsheet className="w-4 h-4 text-emerald-200 shrink-0" />
              <span className="truncate">ตารางคิวงานซ่อม Onsite (Excel View)</span>
            </div>
            <div className="font-mono text-[11px] text-emerald-100 flex items-center gap-2 shrink-0 tabular-nums">
              <span>แสดง {filteredJobs.length} แถว</span>
              <span className="hidden sm:inline">| รวม {jobs.length}</span>
            </div>
          </div>

          {/* Mobile Viewport-Fitting Excel Grid (< md, Zero Horizontal Scroll) */}
          <div className="md:hidden">
            <table className="w-full table-fixed border-collapse text-[11px]">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold">
                  <th className="w-[23%] py-2 px-1.5 border-r border-slate-300 text-left">
                    คิว / นัด
                  </th>
                  <th className="w-[38%] py-2 px-1.5 border-r border-slate-300 text-left">
                    ลูกค้า / อุปกรณ์
                  </th>
                  <th className="w-[24%] py-2 px-1.5 border-r border-slate-300 text-center">
                    สถานะ / ยอด
                  </th>
                  <th className="w-[15%] py-2 px-1 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-10 px-4 text-center text-slate-400 bg-white">
                      <AlertTriangle className="w-7 h-7 mx-auto mb-1.5 text-slate-300" />
                      <p className="font-semibold text-slate-700 text-xs">
                        ไม่พบข้อมูลงานซ่อมตามตัวกรองนี้
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredJobs.map((job, idx) => {
                    const hasPhone = hasCustomerPhone(job.customer);
                    const phoneText = formatCustomerPhone(job.customer);
                    const nextStatus = getNextForwardStatus(job.status);
                    const displayCost = job.actualCost !== null ? job.actualCost : job.estimatedCost;

                    return (
                      <tr
                        key={job.id}
                        onClick={() => onSelectJob(job)}
                        className={`border-b border-slate-300 cursor-pointer active:bg-emerald-50 ${
                          idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'
                        }`}
                      >
                        <td className="py-2 px-1.5 border-r border-slate-300 align-top">
                          <div className="font-mono font-bold text-[10px] bg-slate-800 text-white px-1 py-0.5 rounded inline-block tabular-nums">
                            {job.queueNumber}
                          </div>
                          <div className="font-mono text-[10px] font-semibold text-slate-800 mt-1 tabular-nums truncate">
                            {formatShortDate(job.appointmentDate)}
                          </div>
                          <div className="font-mono text-[10px] text-slate-500 tabular-nums truncate">
                            {job.appointmentTime || '-'}
                          </div>
                        </td>

                        <td className="py-2 px-1.5 border-r border-slate-300 align-top overflow-hidden">
                          <div className="font-bold text-slate-900 truncate">{job.customer.name}</div>
                          <div
                            className={`font-mono text-[10px] truncate tabular-nums ${
                              hasPhone ? 'text-slate-600' : 'text-slate-400'
                            }`}
                          >
                            {phoneText}
                          </div>
                          <div className="text-[11px] font-semibold text-blue-900 line-clamp-1 mt-0.5">
                            {job.product}
                          </div>
                        </td>

                        <td
                          className="py-2 px-1 border-r border-slate-300 align-top text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span
                            className={`inline-block w-full truncate text-[10px] font-bold px-1 py-0.5 rounded border ${getStatusBadge(
                              job.status
                            )}`}
                          >
                            {job.status}
                          </span>
                          <div
                            className={`font-mono text-[10px] font-bold mt-1 tabular-nums ${
                              job.actualCost !== null ? 'text-emerald-700' : 'text-slate-600'
                            }`}
                          >
                            ฿{(displayCost || 0).toLocaleString()}
                          </div>
                          {nextStatus && (
                            <button
                              type="button"
                              onClick={() => onStatusChange(job.id, nextStatus, false)}
                              className="mt-1 w-full py-0.5 px-1 rounded bg-emerald-700 hover:bg-emerald-800 text-white text-[9px] font-bold truncate cursor-pointer"
                            >
                              → {nextStatus}
                            </button>
                          )}
                        </td>

                        <td
                          className="py-2 px-1 align-top text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex flex-col items-center gap-1">
                            {hasPhone && (
                              <a
                                href={`tel:${job.customer.phone.replace(/[^0-9]/g, '')}`}
                                className="w-7 h-7 flex items-center justify-center rounded bg-emerald-50 text-emerald-700 border border-emerald-200"
                                title={`โทร: ${job.customer.phone}`}
                              >
                                <Phone className="w-3.5 h-3.5" />
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => setEditingStatusJob(job)}
                              className="w-7 h-7 flex items-center justify-center rounded bg-amber-50 text-amber-800 border border-amber-200 cursor-pointer"
                              title="แก้ไขสถานะ"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
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

          {/* Desktop Viewport-Fitting Excel Grid (md+, table-fixed w-full, ZERO horizontal scroll) */}
          <div className="hidden md:block max-h-[72vh] overflow-y-auto relative">
            <table className="w-full table-fixed text-left border-collapse text-xs select-text">
              <thead className="sticky top-0 z-20 bg-slate-100">
                <tr className="border-b-2 border-slate-300 text-slate-700 font-bold text-[11px]">
                  <th className="w-10 py-2 px-1.5 border-r border-slate-300 text-center bg-slate-200 text-slate-600">
                    #
                  </th>
                  <th className="w-[13%] py-2 px-2.5 border-r border-slate-300">คิว / นัดหมาย</th>
                  <th className="w-[22%] py-2 px-2.5 border-r border-slate-300">อุปกรณ์ / อาการ</th>
                  <th className="w-[22%] py-2 px-2.5 border-r border-slate-300">ลูกค้า / ติดต่อ</th>
                  <th className="w-[11%] py-2 px-2.5 border-r border-slate-300 text-right">
                    ราคา (฿)
                  </th>
                  <th className="w-[14%] py-2 px-2 border-r border-slate-300 text-center">
                    สถานะงาน
                  </th>
                  <th className="w-[10%] py-2 px-2 border-r border-slate-300 text-center">
                    ประกัน
                  </th>
                  <th className="w-[88px] py-2 px-1.5 text-center bg-slate-100">จัดการ</th>
                </tr>
              </thead>

              <tbody>
                {filteredJobs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-14 text-center text-slate-400 bg-white">
                      <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="font-semibold text-slate-700 text-sm">
                        ไม่พบข้อมูลงานซ่อมตามตัวกรองนี้
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        ลองเปลี่ยนคำค้นหา หรือกดเลือกแท็บ &quot;ทั้งหมด&quot;
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredJobs.map((job, idx) => {
                    const ws = getWarrantyStatus(job.warrantyEndDate, job.warrantyDays);
                    const hasPhone = hasCustomerPhone(job.customer);
                    const phoneText = formatCustomerPhone(job.customer);
                    const nextStatus = getNextForwardStatus(job.status);
                    const photosCount = getTotalJobPhotosCount(job);

                    return (
                      <tr
                        key={job.id}
                        onClick={() => onSelectJob(job)}
                        className={`border-b border-slate-300 transition-colors cursor-pointer hover:bg-emerald-50/60 ${
                          idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'
                        }`}
                      >
                        {/* # */}
                        <td className="py-2 px-1.5 border-r border-slate-300 text-center font-mono text-[11px] text-slate-500 bg-slate-100/80 tabular-nums align-top">
                          {idx + 1}
                        </td>

                        {/* คิว / นัดหมาย */}
                        <td className="py-2 px-2.5 border-r border-slate-300 align-top">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-mono font-bold text-[11px] bg-slate-800 text-white px-1.5 py-0.5 rounded tabular-nums">
                              {job.queueNumber}
                            </span>
                            {job.status !== 'ปิดงาน' && job.status !== 'ยกเลิก' && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setReschedulingJob(job);
                                }}
                                className="p-0.5 rounded text-blue-600 hover:bg-blue-100 cursor-pointer"
                                title="เปลี่ยนวัน/เวลานัดหมาย"
                              >
                                <CalendarClock className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          <div className="font-mono font-semibold text-[11px] text-slate-900 mt-1 tabular-nums truncate">
                            {job.appointmentDate}
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono tabular-nums truncate">
                            <Clock className="w-2.5 h-2.5 shrink-0" />
                            <span className="truncate">{job.appointmentTime || 'ไม่ระบุ'}</span>
                          </div>
                        </td>

                        {/* อุปกรณ์ / อาการ */}
                        <td className="py-2 px-2.5 border-r border-slate-300 align-top overflow-hidden">
                          <div className="font-bold text-slate-900 truncate" title={job.product}>
                            {job.product}
                          </div>
                          {(job.symptoms || job.jobDetails) && (
                            <div
                              className="text-[11px] text-slate-600 line-clamp-2 mt-0.5 break-words"
                              title={job.symptoms || job.jobDetails}
                            >
                              {job.symptoms ? `อาการ: ${job.symptoms}` : job.jobDetails}
                            </div>
                          )}
                        </td>

                        {/* ลูกค้า / ติดต่อ */}
                        <td
                          className="py-2 px-2.5 border-r border-slate-300 align-top overflow-hidden"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="font-bold text-slate-900 truncate" title={job.customer.name}>
                            {job.customer.name}
                          </div>
                          <div className="flex items-center justify-between gap-1 mt-0.5">
                            <span
                              className={`font-mono text-[11px] truncate tabular-nums ${
                                hasPhone ? 'text-slate-700 font-medium' : 'text-slate-400'
                              }`}
                            >
                              {phoneText}
                            </span>

                            <div className="flex items-center gap-1 shrink-0">
                              {hasPhone && (
                                <a
                                  href={`tel:${job.customer.phone.replace(/[^0-9]/g, '')}`}
                                  className="p-1 rounded bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-700 transition-colors"
                                  title={`โทร: ${job.customer.phone}`}
                                >
                                  <Phone className="w-3 h-3" />
                                </a>
                              )}
                              {job.customer.lineId && (
                                <a
                                  href={`https://line.me/ti/p/~${job.customer.lineId.replace('@', '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1 rounded bg-slate-100 hover:bg-emerald-100 text-emerald-600 transition-colors"
                                  title={`LINE: ${job.customer.lineId}`}
                                >
                                  <MessageCircle className="w-3 h-3" />
                                </a>
                              )}
                              {hasPhone && cleanSmsPhone(job.customer.phone) && (
                                <a
                                  href={buildDeviceSmsUri(
                                    job.customer.phone,
                                    formatCustomerStatusSms(job, job.status, settings)
                                  )}
                                  onClick={() =>
                                    addNotificationLog({
                                      channel: 'sms',
                                      recipientPhone: job.customer.phone,
                                      type: 'sms_customer',
                                      jobQueueNumber: job.queueNumber,
                                      jobProduct: job.product,
                                      status: job.status,
                                      success: true,
                                      message: `เปิดแอป SMS แจ้งคิว ${job.queueNumber} ถึง ${job.customer.phone}`,
                                      responseMessage: 'Quick SMS from Queue Table',
                                    })
                                  }
                                  className="p-1 rounded bg-slate-100 hover:bg-sky-100 text-sky-600 transition-colors"
                                  title={`ส่ง SMS: ${job.customer.phone}`}
                                >
                                  <MessageSquare className="w-3 h-3" />
                                </a>
                              )}
                              {job.customer.address && (
                                <a
                                  href={getMapsUrl(job.customer.address, job.customer.mapCoordinates)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1 rounded bg-slate-100 hover:bg-rose-100 text-rose-500 transition-colors"
                                  title="เปิด Google Maps นำทาง"
                                >
                                  <MapPin className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          </div>
                          {job.customer.address && (
                            <div
                              className="text-[10px] text-slate-500 truncate mt-0.5"
                              title={job.customer.address}
                            >
                              {job.customer.address}
                            </div>
                          )}
                        </td>

                        {/* ราคา (จริง / ประเมิน) */}
                        <td className="py-2 px-2.5 border-r border-slate-300 text-right font-mono tabular-nums align-top">
                          {job.actualCost !== null ? (
                            <div className="font-bold text-emerald-700">
                              ฿{job.actualCost.toLocaleString()}
                            </div>
                          ) : (
                            <div className="text-slate-400">-</div>
                          )}
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            ปม. ฿{(job.estimatedCost || 0).toLocaleString()}
                          </div>
                        </td>

                        {/* สถานะงาน */}
                        <td
                          className="py-2 px-2 border-r border-slate-300 text-center align-top"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex flex-col items-center gap-1">
                            <span
                              className={`inline-block w-full truncate text-[11px] font-bold px-1.5 py-0.5 rounded border ${getStatusBadge(
                                job.status
                              )}`}
                            >
                              {job.status}
                            </span>

                            <div className="flex items-center justify-center gap-1 w-full">
                              {nextStatus && (
                                <button
                                  type="button"
                                  onClick={() => onStatusChange(job.id, nextStatus, false)}
                                  className="flex-1 min-w-0 inline-flex items-center justify-center gap-0.5 px-1 py-0.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-[10px] font-bold cursor-pointer truncate"
                                  title={`เดินหน้าสถานะเป็น "${nextStatus}"`}
                                >
                                  <ArrowRight className="w-2.5 h-2.5 shrink-0" />
                                  <span className="truncate">{nextStatus}</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setEditingStatusJob(job)}
                                className="px-1.5 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded text-[10px] font-bold cursor-pointer shrink-0"
                                title="แก้ไขสถานะงาน"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </td>

                        {/* ประกัน */}
                        <td className="py-2 px-2 border-r border-slate-300 text-center align-top">
                          {ws.status === 'none' && (
                            <span className="text-[11px] text-slate-500 font-medium">ไม่มี</span>
                          )}
                          {ws.status === 'valid' && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 font-semibold text-[10px] tabular-nums">
                              <ShieldCheck className="w-3 h-3 shrink-0" />
                              <span>{ws.daysRemaining} ว.</span>
                            </span>
                          )}
                          {ws.status === 'warning' && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[10px] tabular-nums">
                              <ShieldAlert className="w-3 h-3 shrink-0" />
                              <span>{ws.daysRemaining} ว.</span>
                            </span>
                          )}
                          {ws.status === 'expired' && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-red-100 text-red-800 border border-red-300 font-semibold text-[10px]">
                              <ShieldX className="w-3 h-3 shrink-0" />
                              <span>หมด</span>
                            </span>
                          )}
                          {ws.status !== 'none' && (
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5 tabular-nums truncate">
                              {formatShortDate(job.warrantyEndDate)}
                            </div>
                          )}
                        </td>

                        {/* จัดการ */}
                        <td
                          className="py-2 px-1.5 text-center align-top"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="grid grid-cols-2 gap-1 justify-items-center">
                            <button
                              type="button"
                              onClick={() => onOpenStatusPhotos(job)}
                              className="relative p-1 rounded text-blue-600 hover:bg-blue-50 cursor-pointer"
                              title={`รูป/วิดีโอ (${photosCount} ไฟล์)`}
                            >
                              <Camera className="w-3.5 h-3.5" />
                              {photosCount > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 min-w-[12px] h-[12px] px-0.5 rounded-full bg-blue-600 text-white text-[8px] font-mono font-bold flex items-center justify-center">
                                  {photosCount}
                                </span>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => onPrintJob(job)}
                              className="p-1 rounded text-slate-600 hover:bg-slate-100 cursor-pointer"
                              title="พิมพ์ใบเสร็จ/ส่งมอบ"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>

                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => onEditJob(job)}
                                className="p-1 rounded text-slate-600 hover:text-blue-600 hover:bg-blue-50 cursor-pointer"
                                title="แก้ไขงาน"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {job.status !== 'ปิดงาน' && job.status !== 'ยกเลิก' ? (
                              <button
                                type="button"
                                onClick={() => setCancellingJob(job)}
                                className="p-1 rounded text-rose-600 hover:bg-rose-50 cursor-pointer"
                                title="ยกเลิกงาน"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onSelectJob(job)}
                                className="p-1 rounded text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                                title="ดูรายละเอียดงาน"
                              >
                                <ChevronRight className="w-3.5 h-3.5" />
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

          {/* Excel Status Bar (SUM / COUNT footer) */}
          <div className="bg-slate-100 border-t border-slate-300 px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700 font-mono tabular-nums select-none">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-bold text-slate-900">COUNT: {filteredJobs.length} งาน</span>
              <span className="text-slate-400">|</span>
              <span>ปิดงาน: {filteredJobs.filter((j) => j.status === 'ปิดงาน').length}</span>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <span>
                ประเมิน: <strong className="text-slate-900">฿{totalEstimatedCost.toLocaleString()}</strong>
              </span>
              <span>
                SUM จริง:{' '}
                <strong className="text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                  ฿{totalActualCost.toLocaleString()}
                </strong>
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* Sheet 2: ตาราง Excel สรุปงานที่ปิดแล้ว */
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="bg-white rounded-xl border border-indigo-200 p-3 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-slate-500 block">
                  จำนวนงานที่ปิดแล้ว (COUNT)
                </span>
                <strong className="text-xl font-mono font-bold text-indigo-800 tabular-nums">
                  {filteredClosedJobs.length} งาน
                </strong>
              </div>
              <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                <Award className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-emerald-200 p-3 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-slate-500 block">
                  ยอดค่าซ่อมจริงรวม (SUM)
                </span>
                <strong className="text-xl font-mono font-bold text-emerald-700 tabular-nums">
                  ฿{closedTotalActual.toLocaleString()}
                </strong>
              </div>
              <div className="text-right text-[11px] text-slate-500 font-mono tabular-nums">
                <div>ประเมินรวม</div>
                <div className="font-bold text-slate-700">
                  ฿{closedTotalEstimated.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-blue-200 p-3 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-slate-500 block">
                  ยังอยู่ในระยะประกัน
                </span>
                <strong className="text-xl font-mono font-bold text-blue-700 tabular-nums">
                  {closedValidWarrantyCount} งาน
                </strong>
              </div>
              <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-indigo-300 shadow-xs overflow-hidden">
            <div className="bg-indigo-800 text-white px-3.5 py-2 flex items-center justify-between text-xs border-b border-indigo-900">
              <div className="flex items-center gap-2 font-semibold min-w-0">
                <FileSpreadsheet className="w-4 h-4 text-indigo-200 shrink-0" />
                <span className="truncate">ตาราง Excel สรุปงานที่ปิดแล้ว</span>
              </div>
              <div className="font-mono text-[11px] text-indigo-100 shrink-0 tabular-nums">
                {filteredClosedJobs.length} แถว · ฿{closedTotalActual.toLocaleString()}
              </div>
            </div>

            {/* Sheet 2 Mobile Viewport-Fitting Excel Grid (< md) */}
            <div className="md:hidden">
              <table className="w-full table-fixed border-collapse text-[11px]">
                <thead>
                  <tr className="bg-indigo-50 border-b border-indigo-200 text-slate-700 font-bold">
                    <th className="w-[22%] py-2 px-1.5 border-r border-indigo-200 text-left">
                      คิว / ปิด
                    </th>
                    <th className="w-[38%] py-2 px-1.5 border-r border-indigo-200 text-left">
                      ลูกค้า / สินค้า
                    </th>
                    <th className="w-[25%] py-2 px-1.5 border-r border-indigo-200 text-right">
                      จริง / ประกัน
                    </th>
                    <th className="w-[15%] py-2 px-1 text-center">จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClosedJobs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-10 px-4 text-center text-slate-400 bg-white">
                        <Award className="w-7 h-7 mx-auto mb-1.5 text-slate-300" />
                        <p className="font-semibold text-slate-700 text-xs">
                          ยังไม่มีรายการงานที่ปิดแล้ว
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredClosedJobs.map((job, idx) => {
                      const ws = getWarrantyStatus(job.warrantyEndDate, job.warrantyDays);
                      const phoneText = formatCustomerPhone(job.customer);
                      return (
                        <tr
                          key={job.id}
                          onClick={() => onSelectJob(job)}
                          className={`border-b border-slate-200 cursor-pointer active:bg-indigo-50 ${
                            idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'
                          }`}
                        >
                          <td className="py-2 px-1.5 border-r border-slate-200 align-top">
                            <span className="font-mono font-bold text-[10px] bg-indigo-800 text-white px-1 py-0.5 rounded inline-block tabular-nums">
                              {job.queueNumber}
                            </span>
                            <div className="font-mono text-[10px] text-indigo-800 font-semibold mt-1 tabular-nums">
                              {formatShortDate(job.closedAt || job.appointmentDate)}
                            </div>
                          </td>
                          <td className="py-2 px-1.5 border-r border-slate-200 align-top overflow-hidden">
                            <div className="font-bold text-slate-900 truncate">{job.customer.name}</div>
                            <div className="font-mono text-[10px] text-slate-500 truncate tabular-nums">
                              {phoneText}
                            </div>
                            <div className="text-[11px] font-semibold text-slate-700 truncate mt-0.5">
                              {job.product}
                            </div>
                          </td>
                          <td className="py-2 px-1.5 border-r border-slate-200 align-top text-right font-mono tabular-nums">
                            <div className="font-bold text-emerald-700">
                              ฿{(job.actualCost ?? 0).toLocaleString()}
                            </div>
                            <div className="text-[10px] mt-0.5 font-sans">
                              {job.warrantyDays === 0 ? (
                                <span className="text-slate-400">ไม่มีประกัน</span>
                              ) : ws.status === 'expired' ? (
                                <span className="text-red-700 font-semibold">หมดประกัน</span>
                              ) : (
                                <span className="text-emerald-700 font-semibold">
                                  เหลือ {ws.daysRemaining}ว.
                                </span>
                              )}
                            </div>
                          </td>
                          <td
                            className="py-2 px-1 align-top text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => onPrintJob(job)}
                              className="w-7 h-7 mx-auto flex items-center justify-center rounded bg-slate-100 text-slate-700 border border-slate-200 cursor-pointer"
                              title="พิมพ์ใบเสร็จ"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Sheet 2 Desktop Viewport-Fitting Excel Grid (md+) */}
            <div className="hidden md:block max-h-[70vh] overflow-y-auto relative">
              <table className="w-full table-fixed text-left border-collapse text-xs select-text">
                <thead className="sticky top-0 z-20 bg-indigo-50">
                  <tr className="border-b-2 border-indigo-200 text-slate-700 font-bold text-[11px]">
                    <th className="w-10 py-2 px-1.5 border-r border-indigo-200 text-center bg-indigo-100 text-indigo-800">
                      #
                    </th>
                    <th className="w-[14%] py-2 px-2.5 border-r border-indigo-200">
                      คิว / ปิดงาน
                    </th>
                    <th className="w-[25%] py-2 px-2.5 border-r border-indigo-200">
                      สินค้า / รายละเอียด
                    </th>
                    <th className="w-[20%] py-2 px-2.5 border-r border-indigo-200">
                      ลูกค้า / ช่าง
                    </th>
                    <th className="w-[14%] py-2 px-2.5 border-r border-indigo-200 text-right bg-emerald-50 text-emerald-900">
                      จริง / ประเมิน (฿)
                    </th>
                    <th className="w-[15%] py-2 px-2.5 border-r border-indigo-200 text-center">
                      ประกัน
                    </th>
                    <th className="w-[84px] py-2 px-1.5 text-center bg-indigo-50">จัดการ</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredClosedJobs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 bg-white">
                        <Award className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <p className="font-semibold text-slate-700 text-sm">
                          ยังไม่มีรายการงานที่ปิดแล้วในตารางสรุป
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredClosedJobs.map((job, idx) => {
                      const ws = getWarrantyStatus(job.warrantyEndDate, job.warrantyDays);
                      const closedDateLabel = job.closedAt || job.appointmentDate;
                      const hasPhone = hasCustomerPhone(job.customer);
                      const phoneText = formatCustomerPhone(job.customer);
                      const photosCount = getTotalJobPhotosCount(job);

                      return (
                        <tr
                          key={job.id}
                          onClick={() => onSelectJob(job)}
                          className={`border-b border-slate-200 transition-colors cursor-pointer hover:bg-indigo-50/60 ${
                            idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'
                          }`}
                        >
                          <td className="py-2 px-1.5 border-r border-slate-200 text-center font-mono text-[11px] text-slate-400 bg-slate-100/70 tabular-nums align-top">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-2.5 border-r border-slate-200 align-top">
                            <span className="font-mono font-bold text-[11px] bg-indigo-800 text-white px-1.5 py-0.5 rounded tabular-nums">
                              {job.queueNumber}
                            </span>
                            <div className="font-mono font-bold text-[11px] text-indigo-800 mt-1 tabular-nums truncate">
                              ปิด: {closedDateLabel}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono tabular-nums truncate">
                              นัด: {job.appointmentDate}
                            </div>
                          </td>
                          <td className="py-2 px-2.5 border-r border-slate-200 align-top overflow-hidden">
                            <div className="font-bold text-slate-900 truncate" title={job.product}>
                              {job.product}
                            </div>
                            <div className="text-[11px] text-slate-600 line-clamp-1 mt-0.5">
                              {job.jobDetails || job.symptoms}
                            </div>
                            {job.notes && (
                              <div className="text-[10px] text-indigo-700 truncate mt-0.5">
                                หมายเหตุ: {job.notes}
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-2.5 border-r border-slate-200 align-top overflow-hidden">
                            <div className="font-bold text-slate-900 truncate">{job.customer.name}</div>
                            <div
                              className={`font-mono text-[11px] truncate tabular-nums ${
                                hasPhone ? 'text-slate-600' : 'text-slate-400'
                              }`}
                            >
                              {phoneText}
                            </div>
                            {job.assignedUserName && (
                              <div className="text-[10px] text-slate-500 truncate mt-0.5">
                                ช่าง: {job.assignedUserName}
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-2.5 border-r border-slate-200 text-right font-mono tabular-nums bg-emerald-50/40 align-top">
                            <div className="font-bold text-emerald-800">
                              ฿{(job.actualCost ?? 0).toLocaleString()}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              ปม. ฿{(job.estimatedCost || 0).toLocaleString()}
                            </div>
                          </td>
                          <td className="py-2 px-2.5 border-r border-slate-200 text-center align-top">
                            {job.warrantyDays === 0 ? (
                              <span className="text-[11px] text-slate-500">ไม่มีประกัน (0 วัน)</span>
                            ) : ws.status === 'expired' ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-100 text-red-800 border border-red-300 font-semibold text-[11px]">
                                <ShieldX className="w-3 h-3 shrink-0" />
                                <span>หมดประกัน</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 font-medium text-[11px] tabular-nums">
                                <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                                <span>เหลือ {ws.daysRemaining} วัน</span>
                              </span>
                            )}
                            {job.warrantyDays > 0 && (
                              <div className="text-[10px] text-slate-500 font-mono mt-0.5 tabular-nums truncate">
                                ถึง {job.warrantyEndDate}
                              </div>
                            )}
                          </td>
                          <td
                            className="py-2 px-1.5 text-center align-top"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => onOpenStatusPhotos(job)}
                                className="relative p-1 rounded text-blue-600 hover:bg-blue-50 cursor-pointer"
                                title={`รูปภาพ (${photosCount})`}
                              >
                                <Camera className="w-3.5 h-3.5" />
                                {photosCount > 0 && (
                                  <span className="absolute -top-0.5 -right-0.5 min-w-[12px] h-[12px] px-0.5 rounded-full bg-blue-600 text-white text-[8px] font-mono font-bold flex items-center justify-center">
                                    {photosCount}
                                  </span>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => onPrintJob(job)}
                                className="p-1 rounded text-slate-600 hover:bg-slate-100 cursor-pointer"
                                title="พิมพ์ใบเสร็จ/ส่งมอบ"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onSelectJob(job)}
                                className="p-1 rounded text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 cursor-pointer"
                                title="ดูรายละเอียด"
                              >
                                <ChevronRight className="w-3.5 h-3.5" />
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

            <div className="bg-indigo-50 border-t border-indigo-200 px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-indigo-900 font-mono tabular-nums select-none">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="font-bold">COUNT: {filteredClosedJobs.length} งาน</span>
                <span className="text-indigo-300">|</span>
                <span>ในประกัน: {closedValidWarrantyCount} งาน</span>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <span>
                  ประเมิน: <strong>฿{closedTotalEstimated.toLocaleString()}</strong>
                </span>
                <span>
                  SUM จริง:{' '}
                  <strong className="text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-300">
                    ฿{closedTotalActual.toLocaleString()}
                  </strong>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <EditStatusModal
        job={editingStatusJob}
        onClose={() => setEditingStatusJob(null)}
        onSaveStatus={(jobId, newStatus) => onStatusChange(jobId, newStatus, true)}
      />

      <RescheduleJobModal
        job={reschedulingJob}
        onClose={() => setReschedulingJob(null)}
        onConfirmReschedule={onRescheduleJob}
      />

      <CancelJobModal
        job={cancellingJob}
        onClose={() => setCancellingJob(null)}
        onConfirmCancel={onCancelJob}
      />
    </div>
  );
};
