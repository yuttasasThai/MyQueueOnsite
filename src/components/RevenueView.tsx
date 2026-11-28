import React, { useMemo, useState } from 'react';
import {
  FileSpreadsheet,
  Search,
  Wallet,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { RepairJob, RepairStatus } from '../types';

interface RevenueViewProps {
  jobs: RepairJob[];
  onSelectJob: (job: RepairJob) => void;
}

type RevenueStatusScope = 'active_and_closed' | 'closed_only' | 'pending_only' | 'all';

function getStatusBadgeClass(status: RepairStatus): string {
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
      return 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold';
    case 'นัดหมายต่อ':
      return 'bg-orange-50 text-orange-800 border-orange-200';
    case 'ยกเลิก':
      return 'bg-slate-200 text-slate-600 border-slate-300';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

export const RevenueView: React.FC<RevenueViewProps> = ({ jobs, onSelectJob }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [statusScope, setStatusScope] = useState<RevenueStatusScope>('active_and_closed');

  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    jobs.forEach((j) => {
      const ref = j.closedAt || j.appointmentDate || j.loggedDate;
      if (ref && ref.length >= 7) {
        set.add(ref.slice(0, 7));
      }
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return jobs
      .filter((job) => {
        if (statusScope === 'active_and_closed' && job.status === 'ยกเลิก') return false;
        if (statusScope === 'closed_only' && job.status !== 'ปิดงาน') return false;
        if (
          statusScope === 'pending_only' &&
          (job.status === 'ปิดงาน' || job.status === 'ยกเลิก')
        ) {
          return false;
        }

        const refDate = job.closedAt || job.appointmentDate || job.loggedDate || '';
        if (monthFilter !== 'all' && !refDate.startsWith(monthFilter)) return false;

        if (!q) return true;
        return (
          job.queueNumber.toLowerCase().includes(q) ||
          job.customer.name.toLowerCase().includes(q) ||
          job.product.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const da = a.closedAt || a.appointmentDate || a.loggedDate || '';
        const db = b.closedAt || b.appointmentDate || b.loggedDate || '';
        return db.localeCompare(da);
      });
  }, [jobs, searchTerm, monthFilter, statusScope]);

  const summary = useMemo(() => {
    let totalEstimated = 0;
    let totalActual = 0;
    let receivedCount = 0;
    let diffOnReceived = 0;

    filteredJobs.forEach((job) => {
      const est = Number(job.estimatedCost) || 0;
      totalEstimated += est;
      if (job.actualCost !== null && job.actualCost !== undefined) {
        const act = Number(job.actualCost) || 0;
        totalActual += act;
        receivedCount += 1;
        diffOnReceived += act - est;
      }
    });

    return {
      totalEstimated,
      totalActual,
      receivedCount,
      diffOnReceived,
    };
  }, [filteredJobs]);

  const formatShortDate = (ymd?: string) => {
    if (!ymd || ymd.length < 10) return ymd || '-';
    const [, m, d] = ymd.slice(0, 10).split('-');
    return `${d}/${m}`;
  };

  const handleExportExcel = () => {
    const headers = [
      'ลำดับ',
      'เลขคิว',
      'วันที่',
      'ลูกค้า',
      'อุปกรณ์/งานซ่อม',
      'สถานะ',
      'รายได้ก่อนประเมิน(บาท)',
      'รับจริง(บาท)',
      'ส่วนต่าง(บาท)',
    ];

    const rows = filteredJobs.map((job, idx) => {
      const est = Number(job.estimatedCost) || 0;
      const hasAct = job.actualCost !== null && job.actualCost !== undefined;
      const act = hasAct ? Number(job.actualCost) || 0 : '';
      const diff = hasAct ? (Number(job.actualCost) || 0) - est : '';
      const refDate = job.closedAt || job.appointmentDate || job.loggedDate;
      return [
        idx + 1,
        job.queueNumber,
        refDate,
        `"${job.customer.name.replace(/"/g, '""')}"`,
        `"${job.product.replace(/"/g, '""')}"`,
        job.status,
        est,
        act,
        diff,
      ];
    });

    const summaryRow = [
      '',
      'รวมทั้งหมด (SUM)',
      '',
      `"${filteredJobs.length} รายการ"`,
      `"รับเงินจริงแล้ว ${summary.receivedCount} งาน"`,
      '',
      summary.totalEstimated,
      summary.totalActual,
      summary.diffOnReceived,
    ];

    const csv =
      '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(',')), summaryRow.join(',')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `myqueue_revenue_excel_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3.5 font-sans">
      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 block">
              รายได้ก่อนประเมินรวม ({filteredJobs.length} งาน)
            </span>
            <strong className="text-xl sm:text-2xl font-mono font-bold text-slate-900 tabular-nums">
              ฿{summary.totalEstimated.toLocaleString()}
            </strong>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-emerald-200 p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-emerald-700 block">
              รายได้รับจริงรวม ({summary.receivedCount} งาน)
            </span>
            <strong className="text-xl sm:text-2xl font-mono font-bold text-emerald-700 tabular-nums">
              ฿{summary.totalActual.toLocaleString()}
            </strong>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <Wallet className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 block">
              ส่วนต่าง (รับจริง - ก่อนประเมิน)
            </span>
            <strong
              className={`text-xl sm:text-2xl font-mono font-bold tabular-nums ${
                summary.diffOnReceived >= 0 ? 'text-indigo-700' : 'text-rose-600'
              }`}
            >
              {summary.diffOnReceived >= 0 ? '+' : ''}฿{summary.diffOnReceived.toLocaleString()}
            </strong>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter & Export Controls */}
      <div className="bg-white rounded-xl border border-slate-300 shadow-xs p-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ค้นหาเลขคิว, ชื่อลูกค้า, อุปกรณ์..."
            className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2 font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-600 cursor-pointer"
          >
            <option value="all">ทุกเดือน</option>
            {monthOptions.map((ym) => (
              <option key={ym} value={ym}>
                เดือน {ym}
              </option>
            ))}
          </select>

          <select
            value={statusScope}
            onChange={(e) => setStatusScope(e.target.value as RevenueStatusScope)}
            className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2 font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-600 cursor-pointer"
          >
            <option value="active_and_closed">ทั้งหมด (ไม่รวมยกเลิก)</option>
            <option value="closed_only">เฉพาะปิดงานแล้ว</option>
            <option value="pending_only">ยังไม่ปิดงาน (รอดำเนินการ)</option>
            <option value="all">ทุกสถานะ (รวมยกเลิก)</option>
          </select>

          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 shrink-0" />
            <span>ส่งออก Excel (.csv)</span>
          </button>
        </div>
      </div>

      {/* Excel Revenue Spreadsheet */}
      <div className="bg-white rounded-xl border border-slate-300 shadow-xs overflow-hidden">
        {/* Excel Title Bar */}
        <div className="bg-emerald-800 text-white px-3.5 py-2 flex items-center justify-between text-xs border-b border-emerald-900">
          <div className="flex items-center gap-2 font-semibold min-w-0">
            <FileSpreadsheet className="w-4 h-4 text-emerald-200 shrink-0" />
            <span className="truncate">ตารางสรุปรายได้งานซ่อม (ก่อนประเมิน vs รับจริง)</span>
          </div>
          <span className="font-mono text-[11px] text-emerald-100 shrink-0 tabular-nums">
            {filteredJobs.length} รายการ
          </span>
        </div>

        {/* Mobile Viewport-Fitting Excel Grid (< md) */}
        <div className="md:hidden">
          <table className="w-full table-fixed border-collapse text-[11px]">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold">
                <th className="w-[22%] py-2 px-1.5 border-r border-slate-300 text-left">
                  คิว / วันที่
                </th>
                <th className="w-[38%] py-2 px-1.5 border-r border-slate-300 text-left">
                  ลูกค้า / รายการ
                </th>
                <th className="w-[20%] py-2 px-1.5 border-r border-slate-300 text-right">
                  ก่อนประเมิน
                </th>
                <th className="w-[20%] py-2 px-1.5 text-right bg-emerald-50 text-emerald-900">
                  รับจริง
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-10 px-4 text-center text-slate-400 bg-white">
                    <AlertTriangle className="w-7 h-7 mx-auto mb-1.5 text-slate-300" />
                    <p className="font-semibold text-slate-700 text-xs">ไม่พบรายการรายได้</p>
                  </td>
                </tr>
              ) : (
                filteredJobs.map((job, idx) => {
                  const refDate = job.closedAt || job.appointmentDate || job.loggedDate;
                  const est = Number(job.estimatedCost) || 0;
                  const hasAct = job.actualCost !== null && job.actualCost !== undefined;
                  const act = hasAct ? Number(job.actualCost) || 0 : 0;

                  return (
                    <tr
                      key={job.id}
                      onClick={() => onSelectJob(job)}
                      className={`border-b border-slate-300 cursor-pointer active:bg-emerald-50 ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'
                      }`}
                    >
                      <td className="py-2 px-1.5 border-r border-slate-300 align-top">
                        <span className="font-mono font-bold text-[10px] bg-slate-800 text-white px-1 py-0.5 rounded inline-block tabular-nums">
                          {job.queueNumber}
                        </span>
                        <div className="font-mono text-[10px] text-slate-500 mt-1 tabular-nums">
                          {formatShortDate(refDate)}
                        </div>
                      </td>
                      <td className="py-2 px-1.5 border-r border-slate-300 align-top overflow-hidden">
                        <div className="font-bold text-slate-900 truncate">{job.customer.name}</div>
                        <div className="text-[11px] text-slate-600 truncate">{job.product}</div>
                        <span
                          className={`inline-block mt-0.5 text-[9px] px-1 py-0.2 rounded border ${getStatusBadgeClass(
                            job.status
                          )}`}
                        >
                          {job.status}
                        </span>
                      </td>
                      <td className="py-2 px-1.5 border-r border-slate-300 align-top text-right font-mono text-slate-700 tabular-nums">
                        ฿{est.toLocaleString()}
                      </td>
                      <td className="py-2 px-1.5 align-top text-right font-mono tabular-nums bg-emerald-50/40">
                        {hasAct ? (
                          <span className="font-bold text-emerald-700">
                            ฿{act.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {filteredJobs.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold text-[11px] font-mono tabular-nums">
                  <td colSpan={2} className="py-2 px-2 border-r border-slate-300 text-slate-900">
                    รวมทั้งหมด ({filteredJobs.length})
                  </td>
                  <td className="py-2 px-1.5 border-r border-slate-300 text-right text-slate-900">
                    ฿{summary.totalEstimated.toLocaleString()}
                  </td>
                  <td className="py-2 px-1.5 text-right bg-emerald-100 text-emerald-900">
                    ฿{summary.totalActual.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Desktop Viewport-Fitting Excel Grid (md+) */}
        <div className="hidden md:block max-h-[68vh] overflow-y-auto relative">
          <table className="w-full table-fixed text-left border-collapse text-xs select-text">
            <thead className="sticky top-0 z-20 bg-slate-100">
              <tr className="border-b-2 border-slate-300 text-slate-700 font-bold text-[11px]">
                <th className="w-10 py-2 px-1.5 border-r border-slate-300 text-center bg-slate-200 text-slate-600">
                  #
                </th>
                <th className="w-[14%] py-2 px-2.5 border-r border-slate-300">คิว / วันที่</th>
                <th className="w-[31%] py-2 px-2.5 border-r border-slate-300">
                  ลูกค้า / รายการงานซ่อม
                </th>
                <th className="w-[13%] py-2 px-2 border-r border-slate-300 text-center">
                  สถานะงาน
                </th>
                <th className="w-[15%] py-2 px-2.5 border-r border-slate-300 text-right">
                  รายได้ก่อนประเมิน (฿)
                </th>
                <th className="w-[15%] py-2 px-2.5 border-r border-slate-300 text-right bg-emerald-50 text-emerald-900">
                  รับจริง (฿)
                </th>
                <th className="w-[12%] py-2 px-2.5 text-right">ส่วนต่าง (฿)</th>
              </tr>
            </thead>

            <tbody>
              {filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 bg-white">
                    <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-700 text-sm">
                      ไม่พบข้อมูลรายได้ตามเงื่อนไขที่เลือก
                    </p>
                  </td>
                </tr>
              ) : (
                filteredJobs.map((job, idx) => {
                  const refDate = job.closedAt || job.appointmentDate || job.loggedDate;
                  const est = Number(job.estimatedCost) || 0;
                  const hasAct = job.actualCost !== null && job.actualCost !== undefined;
                  const act = hasAct ? Number(job.actualCost) || 0 : 0;
                  const diff = act - est;

                  return (
                    <tr
                      key={job.id}
                      onClick={() => onSelectJob(job)}
                      className={`border-b border-slate-300 transition-colors cursor-pointer hover:bg-emerald-50/60 ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'
                      }`}
                    >
                      <td className="py-2 px-1.5 border-r border-slate-300 text-center font-mono text-[11px] text-slate-500 bg-slate-100/80 tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-2.5 border-r border-slate-300">
                        <span className="font-mono font-bold text-[11px] bg-slate-800 text-white px-1.5 py-0.5 rounded tabular-nums">
                          {job.queueNumber}
                        </span>
                        <div className="font-mono text-[11px] text-slate-500 mt-0.5 tabular-nums">
                          {refDate}
                        </div>
                      </td>
                      <td className="py-2 px-2.5 border-r border-slate-300 overflow-hidden">
                        <div className="font-bold text-slate-900 truncate">{job.customer.name}</div>
                        <div className="text-[11px] text-slate-600 truncate">{job.product}</div>
                      </td>
                      <td className="py-2 px-2 border-r border-slate-300 text-center">
                        <span
                          className={`inline-block w-full truncate text-[11px] px-1.5 py-0.5 rounded border ${getStatusBadgeClass(
                            job.status
                          )}`}
                        >
                          {job.status}
                        </span>
                      </td>
                      <td className="py-2 px-2.5 border-r border-slate-300 text-right font-mono font-semibold text-slate-700 tabular-nums">
                        ฿{est.toLocaleString()}
                      </td>
                      <td className="py-2 px-2.5 border-r border-slate-300 text-right font-mono tabular-nums bg-emerald-50/40">
                        {hasAct ? (
                          <span className="inline-flex items-center gap-1 font-bold text-emerald-800">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>฿{act.toLocaleString()}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">รอรับเงิน</span>
                        )}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono tabular-nums">
                        {hasAct ? (
                          <span
                            className={`font-semibold ${
                              diff > 0
                                ? 'text-indigo-700'
                                : diff < 0
                                ? 'text-rose-600'
                                : 'text-slate-500'
                            }`}
                          >
                            {diff > 0 ? `+฿${diff.toLocaleString()}` : diff < 0 ? `-฿${Math.abs(diff).toLocaleString()}` : '฿0'}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {filteredJobs.length > 0 && (
              <tfoot className="sticky bottom-0 z-10 bg-slate-100 border-t-2 border-slate-300 font-mono text-xs tabular-nums">
                <tr>
                  <td colSpan={4} className="py-2.5 px-3 border-r border-slate-300 font-bold text-slate-900">
                    รวมทั้งหมด (SUM / COUNT: {filteredJobs.length} งาน · รับเงินแล้ว {summary.receivedCount} งาน)
                  </td>
                  <td className="py-2.5 px-2.5 border-r border-slate-300 text-right font-bold text-slate-900">
                    ฿{summary.totalEstimated.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-2.5 border-r border-slate-300 text-right font-bold bg-emerald-100 text-emerald-900">
                    ฿{summary.totalActual.toLocaleString()}
                  </td>
                  <td
                    className={`py-2.5 px-2.5 text-right font-bold ${
                      summary.diffOnReceived >= 0 ? 'text-indigo-700' : 'text-rose-700'
                    }`}
                  >
                    {summary.diffOnReceived >= 0 ? '+' : ''}฿{summary.diffOnReceived.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
