import { useState } from "react";
import { format } from "date-fns";
import { QueueItem } from "../types";

export function AdminStats({ queues }: { queues: QueueItem[] }) {
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);

  const calculateStats = (sDate: string, eDate: string) => {
    let rangeCount = 0, rangeRev = 0;
    let dayCount = 0, dayRev = 0;
    let monthCount = 0, monthRev = 0;

    queues.forEach(q => {
        if (q.status === 'Completed' && q.isPaid) {
            const qDateStr = q.bookingDate || q.timestamp.split('T')[0];
            const price = q.actualPrice || 0;

            if (qDateStr >= sDate && qDateStr <= eDate) {
                rangeCount++;
                rangeRev += price;
            }

            if (qDateStr.substring(0, 7) === todayStr.substring(0, 7)) {
                monthCount++;
                monthRev += price;
            }

            if (qDateStr === todayStr) {
                dayCount++;
                dayRev += price;
            }
        }
    });

    return { rangeCount, rangeRev, dayCount, dayRev, monthCount, monthRev };
  };

  const sDateStr = startDate <= endDate ? startDate : endDate;
  const eDateStr = startDate <= endDate ? endDate : startDate;
  
  const stats = calculateStats(sDateStr, eDateStr);

  const handleExportCSV = () => {
     // rudimentary export
     const data = queues.filter(q => {
         const qDateStr = q.bookingDate || q.timestamp.split('T')[0];
         return qDateStr >= sDateStr && qDateStr <= eDateStr;
     });
     if(data.length === 0) {
         alert("No data for date range");
         return;
     }

     const headers = ["ID", "Status", "Date", "Time", "Type", "Name", "Phone", "Gender", "Course", "Actual Price"];
     const rows = data.map(q => [q.id, q.status, q.bookingDate, q.bookingTime, q.orderType, `"${q.nickname}"`, `"${q.phone}"`, q.gender, q.course, q.actualPrice].join(","));
     const csv = [headers.join(","), ...rows].join("\n");
     const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
     const url = URL.createObjectURL(blob);
     const link = document.createElement("a");
     link.setAttribute("href", url);
     link.setAttribute("download", `Export.csv`);
     link.click();
  };

  return (
    <div className="space-y-5">
        <div className="bg-white p-5 rounded-3xl border border-[var(--color-light-brown)] shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="w-full sm:w-auto text-center sm:text-left">
                <h3 className="text-[var(--color-dark-brown)] font-bold text-lg">📅 Report Filter</h3>
                <div className="text-xs text-[#847568]">เลือกช่วงวันที่เพื่อดูยอดขาย</div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="glass-input flex-1 sm:w-auto h-12 font-bold bg-[var(--color-bg-cream)] text-sm"/>
                <span className="text-[#847568] font-bold text-sm">ถึง</span>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="glass-input flex-1 sm:w-auto h-12 font-bold bg-[var(--color-bg-cream)] text-sm"/>
            </div>
        </div>

        <div className="bg-gradient-to-br from-[var(--color-primary-brown)] to-[#705C4D] p-6 rounded-3xl border border-[var(--color-light-brown)] shadow-md text-white">
            <h3 className="font-bold mb-4 text-lg flex items-center gap-2">🎯 ยอดขายตามช่วงเวลา <span className="text-sm font-normal opacity-80">({sDateStr} - {eDateStr})</span></h3>
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/10 p-4 rounded-2xl border border-white/20 text-center shadow-sm">
                    <div className="text-xs text-white/80 font-bold mb-1">Customers</div>
                    <div className="text-4xl font-bold text-white">{stats.rangeCount}</div>
                </div>
                <div className="bg-white/10 p-4 rounded-2xl border border-white/20 text-center shadow-sm">
                    <div className="text-xs text-white/80 font-bold mb-1">Revenue (THB)</div>
                    <div className="text-4xl font-bold text-[#4ade80]">฿{stats.rangeRev.toLocaleString()}</div>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-white p-6 rounded-3xl border border-[var(--color-light-brown)] shadow-sm">
                <h3 className="text-[var(--color-dark-brown)] font-bold mb-4 text-base flex items-center gap-2">🟢 ยอดขายวันนี้</h3>
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-[var(--color-bg-cream)] p-3 rounded-2xl border border-[var(--color-light-brown)]/50 text-center">
                        <div className="text-[10px] text-[#847568] font-bold mb-1">Customers</div>
                        <div className="text-xl font-bold text-[var(--color-primary-brown)]">{stats.dayCount}</div>
                    </div>
                    <div className="bg-[var(--color-bg-cream)] p-3 rounded-2xl border border-[var(--color-light-brown)]/50 text-center">
                        <div className="text-[10px] text-[#847568] font-bold mb-1">Revenue</div>
                        <div className="text-xl font-bold text-[#15803D]">฿{stats.dayRev.toLocaleString()}</div>
                    </div>
                </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-[var(--color-light-brown)] shadow-sm">
                <h3 className="text-[var(--color-dark-brown)] font-bold mb-4 text-base flex items-center gap-2">📊 ยอดขายเดือนนี้</h3>
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-[var(--color-bg-cream)] p-3 rounded-2xl border border-[var(--color-light-brown)]/50 text-center">
                        <div className="text-[10px] text-[#847568] font-bold mb-1">Customers</div>
                        <div className="text-xl font-bold text-[var(--color-primary-brown)]">{stats.monthCount}</div>
                    </div>
                    <div className="bg-[var(--color-bg-cream)] p-3 rounded-2xl border border-[var(--color-light-brown)]/50 text-center">
                        <div className="text-[10px] text-[#847568] font-bold mb-1">Revenue</div>
                        <div className="text-xl font-bold text-[#15803D]">฿{stats.monthRev.toLocaleString()}</div>
                    </div>
                </div>
            </div>
        </div>

        <button onClick={handleExportCSV} className="w-full py-3 bg-[var(--color-dark-brown)] text-white rounded-xl font-bold shadow-md hover:bg-[#2c231e] transition-all flex justify-center items-center gap-2">
            <span>📥</span> Export Data (CSV)
        </button>
    </div>
  );
}
