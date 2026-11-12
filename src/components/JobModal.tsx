import React, { useState, useEffect } from 'react';
import {
  Wrench,
  User,
  Phone,
  MessageCircle,
  Facebook,
  MapPin,
  Calendar,
  Clock,
  ShieldCheck,
  Save,
  X,
  DollarSign,
  Tag,
} from 'lucide-react';
import { RepairJob, RepairStatus, UserAccount } from '../types';

interface JobModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (job: RepairJob) => void;
  initialJob?: RepairJob | null;
  users: UserAccount[];
  nextQueueNumber: string;
}

const PRODUCT_CATEGORIES = [
  'เครื่องปรับอากาศ (แอร์)',
  'ตู้เย็น / ตู้แช่',
  'เครื่องซักผ้า / เครื่องอบผ้า',
  'ปั๊มน้ำ / แท้งค์น้ำ',
  'เครื่องทำน้ำอุ่น / ระบบประปา',
  'ทีวี / เครื่องเสียง',
  'กล้องวงจรปิด / ระบบเครือข่าย',
  'คอมพิวเตอร์ / โน้ตบุ๊ก / ปริ้นเตอร์',
  'อุปกรณ์เครื่องใช้ไฟฟ้าทั่วไป',
];

const STATUS_OPTIONS: RepairStatus[] = [
  'รับงาน',
  'กำลังไป',
  'กำลังซ่อม',
  'ซ่อมแล้ว',
  'ปิดงาน',
  'นัดหมายต่อ',
  'ยกเลิก',
];

export const JobModal: React.FC<JobModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialJob,
  users,
  nextQueueNumber,
}) => {
  const isEditing = Boolean(initialJob);

  // Form states
  const [queueNumber, setQueueNumber] = useState(nextQueueNumber);
  const [loggedDate, setLoggedDate] = useState(new Date().toISOString().split('T')[0]);
  const [product, setProduct] = useState('');
  const [productCategory, setProductCategory] = useState(PRODUCT_CATEGORIES[0]);
  const [jobDetails, setJobDetails] = useState('');
  const [symptoms, setSymptoms] = useState('');

  // Customer states
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerLineId, setCustomerLineId] = useState('');
  const [customerFacebook, setCustomerFacebook] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [mapCoordinates, setMapCoordinates] = useState('');

  // Appointment & Costs
  const [appointmentDate, setAppointmentDate] = useState(new Date().toISOString().split('T')[0]);
  const [appointmentTime, setAppointmentTime] = useState('10:00 - 12:00');
  const [estimatedCost, setEstimatedCost] = useState<number | string>(1500);
  const [actualCost, setActualCost] = useState<number | string>('');
  const [status, setStatus] = useState<RepairStatus>('รับงาน');

  // Warranty
  const [warrantyDays, setWarrantyDays] = useState<number>(90);
  const [assignedUserId, setAssignedUserId] = useState<string>('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (initialJob) {
      setQueueNumber(initialJob.queueNumber);
      setLoggedDate(initialJob.loggedDate);
      setProduct(initialJob.product);
      setProductCategory(initialJob.productCategory || PRODUCT_CATEGORIES[0]);
      setJobDetails(initialJob.jobDetails);
      setSymptoms(initialJob.symptoms);
      setCustomerName(initialJob.customer.name);
      setCustomerPhone(initialJob.customer.phone);
      setCustomerLineId(initialJob.customer.lineId || '');
      setCustomerFacebook(initialJob.customer.facebook || '');
      setCustomerAddress(initialJob.customer.address);
      setMapCoordinates(initialJob.customer.mapCoordinates || '');
      setAppointmentDate(initialJob.appointmentDate);
      setAppointmentTime(initialJob.appointmentTime || '');
      setEstimatedCost(initialJob.estimatedCost);
      setActualCost(initialJob.actualCost !== null ? initialJob.actualCost : '');
      setStatus(initialJob.status);
      setWarrantyDays(initialJob.warrantyDays);
      setAssignedUserId(initialJob.assignedUserId || '');
      setNotes(initialJob.notes || '');
    } else {
      setQueueNumber(nextQueueNumber);
      setLoggedDate(new Date().toISOString().split('T')[0]);
      setProduct('');
      setProductCategory(PRODUCT_CATEGORIES[0]);
      setJobDetails('');
      setSymptoms('');
      setCustomerName('');
      setCustomerPhone('');
      setCustomerLineId('');
      setCustomerFacebook('');
      setCustomerAddress('');
      setMapCoordinates('');
      setAppointmentDate(new Date().toISOString().split('T')[0]);
      setAppointmentTime('10:00 - 12:00');
      setEstimatedCost(1500);
      setActualCost('');
      setStatus('รับงาน');
      setWarrantyDays(90);
      setAssignedUserId(users[0]?.id || '');
      setNotes('');
    }
  }, [initialJob, isOpen, nextQueueNumber, users]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Calculate warranty end date from appointmentDate or loggedDate
    const baseDate = new Date(appointmentDate || loggedDate);
    const endDate = new Date(baseDate);
    endDate.setDate(endDate.getDate() + Number(warrantyDays));
    const warrantyEndDate = endDate.toISOString().split('T')[0];

    const assignedUser = users.find((u) => u.id === assignedUserId);

    const jobToSave: RepairJob = {
      id: initialJob ? initialJob.id : `job-${Date.now()}`,
      queueNumber: queueNumber.trim(),
      loggedDate,
      product: product.trim(),
      productCategory,
      jobDetails: jobDetails.trim(),
      symptoms: symptoms.trim(),
      customer: {
        name: customerName.trim(),
        phone: customerPhone.trim(),
        lineId: customerLineId.trim(),
        facebook: customerFacebook.trim(),
        address: customerAddress.trim(),
        mapCoordinates: mapCoordinates.trim(),
      },
      appointmentDate,
      appointmentTime: appointmentTime.trim(),
      estimatedCost: Number(estimatedCost) || 0,
      actualCost: actualCost !== '' ? Number(actualCost) : null,
      status,
      warrantyDays: Number(warrantyDays),
      warrantyStartDate: appointmentDate,
      warrantyEndDate,
      assignedUserId,
      assignedUserName: assignedUser ? assignedUser.name : undefined,
      notes: notes.trim(),
    };

    onSave(jobToSave);
    onClose();
  };

// File: /src/components/JobModal.tsx | Revision: Rev 6 | Version: 1.2.1 | Modified: 2026-11-11
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex justify-center items-start sm:items-center overflow-y-auto p-2 sm:p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-2 sm:my-6 max-h-[92vh] flex flex-col overflow-hidden">
        {/* Sticky Header: ตารางและหัวข้อบนสุดมองเห็นชัดเจน ไม่ถูกดันหลุดจอ */}
        <div className="flex items-center justify-between border-b border-slate-100 p-4 sm:p-5 bg-slate-50/90 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
              <Wrench className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base leading-tight">
                {isEditing ? 'แก้ไขข้อมูลงานซ่อม' : 'เปิดรับคิวงานซ่อมนอกสถานที่ใหม่'}
              </h3>
              <p className="text-xs text-slate-500">กรอกข้อมูลงาน ลูกค้า และรายละเอียดนัดหมาย</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body: เลื่อนดูข้อมูลได้พอดีกับหน้าจอมือถือและเดสก์ท็อป */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs sm:text-sm">
          {/* Row 1: Queue Number & Logged Date */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                คิวงาน (Queue No.) *
              </label>
              <input
                type="text"
                required
                value={queueNumber}
                onChange={(e) => setQueueNumber(e.target.value)}
                placeholder="Q-01"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono font-bold text-blue-700"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                วันที่รับแจ้ง *
              </label>
              <input
                type="date"
                required
                value={loggedDate}
                onChange={(e) => setLoggedDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                สถานะงาน *
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as RepairStatus)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              >
                {STATUS_OPTIONS.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Section: Product & Problem Symptoms */}
          <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-3">
            <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-blue-600" />
              <span>สินค้า และอาการที่รับแจ้ง</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  สินค้า / ยี่ห้อ / รุ่น *
                </label>
                <input
                  type="text"
                  required
                  value={product}
                  onChange={(e) => setProduct(e.target.value)}
                  placeholder="เช่น แอร์ Daikin Inverter 18000 BTU"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  หมวดหมู่สินค้า
                </label>
                <select
                  value={productCategory}
                  onChange={(e) => setProductCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {PRODUCT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                อาการที่รับแจ้ง (Symptom / ปัญหา) *
              </label>
              <input
                type="text"
                required
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                placeholder="เช่น แอร์ไม่เย็น พัดลมไม่หมุน มีกลิ่นเหม็นไหม้"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                รายละเอียดงาน (Job Details / วิธีการแก้ไข)
              </label>
              <textarea
                rows={2}
                value={jobDetails}
                onChange={(e) => setJobDetails(e.target.value)}
                placeholder="เช่น ล้างทำความสะอาดชุดใหญ่ เช็คเติมน้ำยา เปลี่ยนแคปสตาร์ท..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none"
              />
            </div>
          </div>

          {/* Section: Customer Information (ชื่อ, เบอร์, ไลน์, เฟสบุ๊ค, พิกัด) */}
          <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-3">
            <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-600" />
              <span>ข้อมูลลูกค้า & พิกัดนำทาง</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  ชื่อลูกค้า *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="คุณสมเกียรติ"
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  เบอร์โทรศัพท์ลูกค้า *
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="081-234-5678"
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  LINE ID ลูกค้า
                </label>
                <div className="relative">
                  <MessageCircle className="w-4 h-4 text-emerald-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={customerLineId}
                    onChange={(e) => setCustomerLineId(e.target.value)}
                    placeholder="line_customer"
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Facebook ลูกค้า
                </label>
                <div className="relative">
                  <Facebook className="w-4 h-4 text-blue-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={customerFacebook}
                    onChange={(e) => setCustomerFacebook(e.target.value)}
                    placeholder="ชื่อเฟสบุ๊คลูกค้า"
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                ที่อยู่หน้างาน Onsite *
              </label>
              <textarea
                rows={2}
                required
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                placeholder="บ้านเลขที่ ซอย ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                พิกัด GPS ละติจูด,ลองจิจูด (สำหรับคลิกนำทาง Google Maps)
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <MapPin className="w-4 h-4 text-rose-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={mapCoordinates}
                    onChange={(e) => setMapCoordinates(e.target.value)}
                    placeholder="เช่น 13.7563,100.5018 หรือวางลิงก์ Google Maps"
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-mono text-xs"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (navigator.geolocation) {
                      navigator.geolocation.getCurrentPosition(
                        (pos) => {
                          setMapCoordinates(`${pos.coords.latitude.toFixed(5)},${pos.coords.longitude.toFixed(5)}`);
                        },
                        () => alert('ไม่สามารถดึงตำแหน่งปัจจุบันได้ กรุณากรอกเอง')
                      );
                    }
                  }}
                  className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-medium whitespace-nowrap"
                >
                  ใช้พิกัดปัจจุบัน
                </button>
              </div>
            </div>
          </div>

          {/* Section: Appointment, Cost & Warranty */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                วันนัดหมาย *
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="date"
                  required
                  value={appointmentDate}
                  onChange={(e) => setAppointmentDate(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                เวลานัดหมาย
              </label>
              <div className="relative">
                <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={appointmentTime}
                  onChange={(e) => setAppointmentTime(e.target.value)}
                  placeholder="เช่น 09:30 - 11:30"
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                ช่างผู้รับผิดชอบงาน
              </label>
              <select
                value={assignedUserId}
                onChange={(e) => setAssignedUserId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              >
                <option value="">-- ยังไม่มอบหมายช่าง --</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.phone})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                ประเมินค่าซ่อม (บาท) *
              </label>
              <input
                type="number"
                required
                min="0"
                value={estimatedCost}
                onChange={(e) => setEstimatedCost(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                ค่าซ่อมจริง (บาท)
              </label>
              <input
                type="number"
                min="0"
                placeholder="เว้นว่างไว้หากยังไม่ปิดงาน"
                value={actualCost}
                onChange={(e) => setActualCost(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                ระยะประกันงานซ่อม (วัน) *
              </label>
              <select
                value={warrantyDays}
                onChange={(e) => setWarrantyDays(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              >
                <option value={30}>30 วัน (1 เดือน)</option>
                <option value={60}>60 วัน (2 เดือน)</option>
                <option value={90}>90 วัน (3 เดือน)</option>
                <option value={180}>180 วัน (6 เดือน)</option>
                <option value={365}>365 วัน (1 ปี)</option>
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isEditing ? 'บันทึกการแก้ไข' : 'บันทึกคิวงานซ่อม'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
