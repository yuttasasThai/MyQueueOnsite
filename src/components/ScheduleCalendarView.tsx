import React, { useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, MapPin, Wrench } from 'lucide-react';
import { RepairJob } from '../types';

interface ScheduleCalendarViewProps {
  jobs: RepairJob[];
  onSelectJob: (job: RepairJob) => void;
  onOpenNewJob: () => void;
}

export const ScheduleCalendarView: React.FC<ScheduleCalendarViewProps> = ({
  jobs,
  onSelectJob,
  onOpenNewJob,
}) => {
  // Current active date view (default to today or latest job date)
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  // Group jobs by date
  const jobsByDate = React.useMemo(() => {
    const map: Record<string, RepairJob[]> = {};
    jobs.forEach((job) => {
      const d = job.appointmentDate || job.loggedDate;
      if (!map[d]) map[d] = [];
      map[d].push(job);
    });
    return map;
  }, [jobs]);

  // Generate 7 days around selected date
  const dateRange = React.useMemo(() => {
    const dates: string[] = [];
    const base = new Date(selectedDate);
    // start 3 days before
    base.setDate(base.getDate() - 3);

    for (let i = 0; i < 7; i++) {
      dates.push(base.toISOString().split('T')[0]);
      base.setDate(base.getDate() + 1);
    }
    return dates;
  }, [selectedDate]);

  const activeDayJobs = jobsByDate[selectedDate] || [];

  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const getDayLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-5">
      {/* Date Navigation Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-blue-600" />
            <span>ตารางนัดหมายงานซ่อมนอกสถานที่</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            เลือกดูคิวงานตามวันนัดหมาย และการวางแผนเส้นทางของช่าง
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevDay}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-semibold px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg font-mono">
            {getDayLabel(selectedDate)}
          </span>
          <button
            onClick={handleNextDay}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
            className="text-xs px-2.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg font-medium"
          >
            วันนี้
          </button>
        </div>
      </div>

      {/* 7-Day Quick Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
        {dateRange.map((d) => {
          const isSelected = d === selectedDate;
          const count = (jobsByDate[d] || []).length;
          const dateObj = new Date(d);
          const dayName = dateObj.toLocaleDateString('th-TH', { weekday: 'short' });
          const dayNum = dateObj.getDate();
          const monthName = dateObj.toLocaleDateString('th-TH', { month: 'short' });

          return (
            <button
              key={d}
              onClick={() => setSelectedDate(d)}
              className={`p-2.5 rounded-xl border text-center transition-all ${
                isSelected
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <div className="text-[10px] font-medium uppercase">{dayName}</div>
              <div className="text-lg font-bold font-mono">{dayNum}</div>
              <div className="text-[10px] opacity-80">{monthName}</div>
              <div className="mt-1.5">
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold ${
                    isSelected
                      ? 'bg-blue-800 text-white'
                      : count > 0
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {count} งาน
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Day Queue List */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
          <span>รายการคิวงานวันที่ {getDayLabel(selectedDate)} ({activeDayJobs.length} งาน)</span>
          <button
            onClick={onOpenNewJob}
            className="text-blue-600 hover:text-blue-700 text-xs font-semibold"
          >
            + เพิ่มงานในวันนี้
          </button>
        </div>

        {activeDayJobs.length === 0 ? (
          <div className="py-12 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <CalendarIcon className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">ไม่มีคิวงานนัดหมายในวันที่เลือก</p>
            <p className="text-xs text-slate-400 mt-1">สามารถกดปุ่ม "เพิ่มงานในวันนี้" เพื่อสร้างคิวงานใหม่</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeDayJobs.map((job) => (
              <div
                key={job.id}
                onClick={() => onSelectJob(job)}
                className="p-4 rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-xs transition-all cursor-pointer bg-white group"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 font-mono font-bold text-xs rounded">
                      {job.queueNumber}
                    </span>
                    <span className="text-xs font-semibold text-slate-900 group-hover:text-blue-600 truncate max-w-[180px]">
                      {job.product}
                    </span>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded font-semibold bg-slate-100 text-slate-700 shrink-0">
                    {job.status}
                  </span>
                </div>

                <div className="text-xs text-slate-600 space-y-1 mb-2">
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>เวลานัดหมาย: <strong>{job.appointmentTime || 'ตลอดทั้งวัน'}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-500 truncate">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{job.customer.address}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-700 font-medium">ลูกค้า: {job.customer.name}</span>
                  <span className="font-mono font-bold text-slate-900">
                    ฿{(job.actualCost ?? job.estimatedCost).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
