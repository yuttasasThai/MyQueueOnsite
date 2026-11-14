import React from 'react';
import { X, Printer, Wrench, ShieldCheck, Phone, MapPin } from 'lucide-react';
import { RepairJob, ShopSettings } from '../types';
import { getWarrantyStatus } from '../services/storage';

interface PrintableWorkOrderProps {
  job: RepairJob | null;
  settings: ShopSettings;
  onClose: () => void;
}

export const PrintableWorkOrder: React.FC<PrintableWorkOrderProps> = ({
  job,
  settings,
  onClose,
}) => {
  if (!job) return null;

  const warranty = getWarrantyStatus(job.warrantyEndDate, job.warrantyDays);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      {/* Top Floating Action Bar */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2 print:hidden">
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-lg text-xs font-semibold cursor-pointer transition-colors"
        >
          <Printer className="w-4 h-4" />
          <span>สั่งพิมพ์ / บันทึก PDF</span>
        </button>
        <button
          onClick={onClose}
          className="p-2 bg-white hover:bg-slate-100 text-slate-700 rounded-lg shadow-lg border border-slate-200 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Printable Sheet (Standard A4 / Receipt style) */}
      <div className="bg-white rounded-2xl max-w-3xl w-full p-8 shadow-2xl border border-slate-300 text-slate-900 my-8 print:my-0 print:border-none print:shadow-none print:p-4">
        {/* Header: Shop Info */}
        <div className="border-b-2 border-slate-900 pb-4 mb-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center print:hidden">
                <Wrench className="w-4 h-4" />
              </div>
              <h2 className="text-xl font-black tracking-tight text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
                {settings.shopName}
              </h2>
            </div>
            <p className="text-xs text-slate-600 mt-1 max-w-md">{settings.address}</p>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-700 mt-2 font-mono">
              <span>โทร: <strong>{settings.phone}</strong></span>
              {settings.lineId && <span>LINE: <strong>{settings.lineId}</strong></span>}
              {settings.facebook && <span>FB: <strong>{settings.facebook}</strong></span>}
            </div>
          </div>

          <div className="text-left sm:text-right shrink-0 bg-slate-50 sm:bg-transparent p-3 sm:p-0 rounded-lg">
            <div className="inline-block px-3 py-1 bg-slate-900 text-white text-xs font-bold rounded mb-1">
              ใบส่งมอบงาน & ใบรับประกัน
            </div>
            <div className="text-sm font-bold text-slate-800">
              เลขที่คิวงาน: <span className="font-mono text-blue-700">{job.queueNumber}</span>
            </div>
            <div className="text-xs text-slate-500 font-mono">
              วันที่บันทึก: {job.loggedDate}
            </div>
            <div className="text-xs text-slate-500 font-mono">
              วันนัดหมาย/ส่งมอบ: {job.appointmentDate}
            </div>
          </div>
        </div>

        {/* Customer Information */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-5">
          <div className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
            ข้อมูลลูกค้า & สถานที่ให้บริการ Onsite
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-slate-500">ชื่อลูกค้า:</span>{' '}
              <strong className="text-slate-900 text-sm">{job.customer.name}</strong>
            </div>
            <div>
              <span className="text-slate-500">เบอร์โทรศัพท์:</span>{' '}
              <strong className="text-slate-900 font-mono">{job.customer.phone}</strong>
            </div>
            <div className="sm:col-span-2">
              <span className="text-slate-500">ที่อยู่หน้างาน:</span>{' '}
              <span className="text-slate-800">{job.customer.address || '-'}</span>
            </div>
          </div>
        </div>

        {/* Repair Details Table */}
        <table className="w-full text-xs border border-slate-200 mb-5">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold">
              <th className="py-2.5 px-3 text-left">รายการ / สินค้า</th>
              <th className="py-2.5 px-3 text-left">อาการที่รับแจ้ง & รายละเอียดงาน</th>
              <th className="py-2.5 px-3 text-right w-28">จำนวนเงิน</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            <tr>
              <td className="py-3 px-3 align-top font-semibold text-slate-900">
                {job.product}
                <div className="text-[11px] text-slate-500 font-normal mt-0.5">
                  หมวดงานซ่อม: {job.productCategory || '-'}
                </div>
              </td>
              <td className="py-3 px-3 align-top text-slate-700 space-y-1">
                <div>
                  <span className="font-semibold text-amber-900">อาการ:</span> {job.symptoms}
                </div>
                <div>
                  <span className="font-semibold text-slate-800">งานที่ดำเนินการ:</span>{' '}
                  {job.jobDetails}
                </div>
              </td>
              <td className="py-3 px-3 align-top text-right font-mono font-bold text-slate-900">
                ฿{(job.actualCost ?? job.estimatedCost).toLocaleString()}
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 border-t-2 border-slate-300 font-bold text-sm">
              <td colSpan={2} className="py-3 px-3 text-right">
                ยอดรวมสุทธิ (Total Amount):
              </td>
              <td className="py-3 px-3 text-right font-mono text-blue-700">
                ฿{(job.actualCost ?? job.estimatedCost).toLocaleString()}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Warranty Section (เงื่อนไขและระยะเวลาการรับประกัน) */}
        <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 mb-6">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 mb-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>การรับประกันงานซ่อม (Warranty Terms)</span>
          </div>
          <div className="text-xs text-slate-600 space-y-1">
            <p>
              • ระยะเวลารับประกัน <strong>{job.warrantyDays} วัน</strong> (สิ้นสุดวันที่{' '}
              <strong>{warranty.formattedEndDate}</strong>)
            </p>
            <p>
              • สถานะปัจจุบัน:{' '}
              <span
                className={`font-semibold ${
                  warranty.status === 'valid'
                    ? 'text-emerald-700'
                    : warranty.status === 'warning'
                    ? 'text-amber-700'
                    : 'text-red-700'
                }`}
              >
                {warranty.label}
              </span>
            </p>
            <p className="text-[11px] text-slate-500">
              * การรับประกันครอบคลุมเฉพาะอาการและอะไหล่ที่ได้ทำการซ่อมแซมหรือเปลี่ยนตามใบแจ้งนี้
              ไม่ครอบคลุมความเสียหายจากอุบัติเหตุ ภัยธรรมชาติ หรือการดัดแปลงแก้ไขจากบุคคลอื่น
            </p>
          </div>
        </div>

        {/* Signature Blocks */}
        <div className="grid grid-cols-2 gap-8 pt-4 border-t border-slate-200 text-xs text-center">
          <div>
            <div className="h-16 border-b border-dashed border-slate-400 mb-2 flex items-end justify-center pb-1 text-slate-400 font-serif">
              {job.assignedUserName || 'ช่างเทคนิคผู้ปฏิบัติงาน'}
            </div>
            <p className="font-semibold text-slate-800">
              ({job.assignedUserName || 'ช่างประจำงาน Onsite'})
            </p>
            <p className="text-slate-500">ช่างเทคนิคผู้ส่งมอบงาน</p>
          </div>

          <div>
            <div className="h-16 border-b border-dashed border-slate-400 mb-2"></div>
            <p className="font-semibold text-slate-800">({job.customer.name})</p>
            <p className="text-slate-500">ลูกค้าผู้ตรวจรับมอบงาน</p>
          </div>
        </div>
      </div>
    </div>
  );
};
