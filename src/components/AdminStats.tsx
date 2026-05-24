import { useState } from "react";
import { format } from "date-fns";
import { Download, TrendingUp } from "lucide-react";
import { QueueItem } from "../types";

const money = (value: number) => `฿${value.toLocaleString()}`;

function StatBox({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-light-brown)] bg-white p-4 shadow-sm">
      <div className="text-[11px] font-bold uppercase text-[#847568]">{label}</div>
      <div className="mt-1 text-2xl font-bold text-[var(--color-dark-brown)]">{value}</div>
      <div className="mt-1 text-xs text-[#847568]">{detail}</div>
    </div>
  );
}

export function AdminStats({ queues }: { queues: QueueItem[] }) {
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);

  const sDateStr = startDate <= endDate ? startDate : endDate;
  const eDateStr = startDate <= endDate ? endDate : startDate;

  const stats = queues.reduce(
    (acc, q) => {
      if (q.status !== "Completed" || !q.isPaid) return acc;

      const qDateStr = q.bookingDate || q.timestamp.split("T")[0];
      const price = q.actualPrice || 0;

      if (qDateStr >= sDateStr && qDateStr <= eDateStr) {
        acc.rangeCount++;
        acc.rangeRev += price;
      }
      if (qDateStr.substring(0, 7) === todayStr.substring(0, 7)) {
        acc.monthCount++;
        acc.monthRev += price;
      }
      if (qDateStr === todayStr) {
        acc.dayCount++;
        acc.dayRev += price;
      }

      return acc;
    },
    { rangeCount: 0, rangeRev: 0, dayCount: 0, dayRev: 0, monthCount: 0, monthRev: 0 },
  );

  const handleExportCSV = () => {
    const data = queues.filter((q) => {
      const qDateStr = q.bookingDate || q.timestamp.split("T")[0];
      return qDateStr >= sDateStr && qDateStr <= eDateStr;
    });

    if (data.length === 0) {
      window.alert("ไม่มีข้อมูลในช่วงวันที่เลือก");
      return;
    }

    const headers = ["ID", "Status", "Date", "Time", "Type", "Name", "Phone", "Gender", "Course", "Actual Price"];
    const rows = data.map((q) =>
      [
        q.id,
        q.status,
        q.bookingDate,
        q.bookingTime,
        q.orderType,
        `"${q.nickname}"`,
        `"${q.phone}"`,
        q.gender,
        q.course,
        q.actualPrice || 0,
      ].join(","),
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Bloom-Luxe-${sDateStr}-${eDateStr}.csv`);
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-[var(--color-light-brown)] bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase text-[#847568]">
              <TrendingUp size={16} />
              Reports
            </div>
            <h3 className="mt-1 text-lg font-bold text-[var(--color-dark-brown)]">สรุปยอดขาย</h3>
            <p className="mt-1 text-sm text-[#847568]">เลือกช่วงวันที่เพื่อดูยอดขายและส่งออก CSV</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="glass-input !rounded-md bg-[#FAF8F5] text-sm font-semibold" />
            <span className="text-center text-xs font-bold uppercase text-[#847568]">to</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="glass-input !rounded-md bg-[#FAF8F5] text-sm font-semibold" />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-[var(--color-light-brown)] bg-[var(--color-dark-brown)] p-5 text-white shadow-sm">
        <div className="text-xs font-bold uppercase text-white/70">Selected Range</div>
        <div className="mt-1 text-sm text-white/80">{sDateStr} ถึง {eDateStr}</div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-white/15 bg-white/10 p-4">
            <div className="text-xs font-bold text-white/70">Customers</div>
            <div className="mt-1 text-3xl font-bold">{stats.rangeCount}</div>
          </div>
          <div className="rounded-lg border border-white/15 bg-white/10 p-4">
            <div className="text-xs font-bold text-white/70">Revenue</div>
            <div className="mt-1 text-3xl font-bold text-green-300">{money(stats.rangeRev)}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <StatBox label="วันนี้" value={money(stats.dayRev)} detail={`${stats.dayCount} customers`} />
        <StatBox label="เดือนนี้" value={money(stats.monthRev)} detail={`${stats.monthCount} customers`} />
      </div>

      <button onClick={handleExportCSV} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[var(--color-dark-brown)] text-sm font-bold text-white shadow-sm hover:bg-[#2c231e]">
        <Download size={17} />
        Export Data (CSV)
      </button>
    </section>
  );
}
