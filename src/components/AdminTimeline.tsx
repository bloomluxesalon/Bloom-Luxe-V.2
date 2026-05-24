import { useState } from "react";
import type { ReactNode } from "react";
import { format } from "date-fns";
import { CalendarDays, Clock } from "lucide-react";
import { QueueItem } from "../types";

export function AdminTimeline({ queues }: { queues: QueueItem[] }) {
  const [filterDate, setFilterDate] = useState(() => format(new Date(), "yyyy-MM-dd"));

  const shopOpenMins = 0;
  const shopCloseMins = 24 * 60;
  const totalMins = shopCloseMins - shopOpenMins;

  const axis = [];
  for (let h = 0; h <= 24; h += 3) {
    const posPercent = ((h * 60 - shopOpenMins) / totalMins) * 100;
    axis.push(
      <div
        key={`axis-${h}`}
        className="absolute h-full border-l border-dashed border-[#D4C4B7] pl-1 text-[10px] text-[#847568]"
        style={{ left: `calc(64px + ${posPercent}%)` }}
      >
        {h.toString().padStart(2, "0")}:00
      </div>,
    );
  }

  const occupied = queues
    .filter((q) => q.bookingDate === filterDate && ["Waiting", "Serving", "Pending"].includes(q.status))
    .map((q) => {
      const [hour = "0", minute = "0"] = q.bookingTime.split(":");
      const start = parseInt(hour, 10) * 60 + parseInt(minute, 10);
      const dur = q.course.includes("90") ? 90 : 60;
      return { start, end: start + dur, id: q.id, nickname: q.nickname, status: q.status };
    })
    .sort((a, b) => a.start - b.start);

  const rooms: ReactNode[][] = [[], [], []];
  const roomEnds = [0, 0, 0];

  occupied.forEach((slot) => {
    const renderStart = Math.max(shopOpenMins, slot.start);
    const renderEnd = Math.min(shopCloseMins, slot.end);
    if (renderStart >= renderEnd) return;

    const leftPercent = ((renderStart - shopOpenMins) / totalMins) * 100;
    const widthPercent = ((renderEnd - renderStart) / totalMins) * 100;
    const roomIndex = roomEnds.findIndex((end) => slot.start >= end);
    const targetRoom = roomIndex === -1 ? 2 : roomIndex;
    roomEnds[targetRoom] = slot.end;

    const tone =
      slot.status === "Serving"
        ? "from-green-700 to-green-600"
        : slot.status === "Pending"
          ? "from-blue-700 to-blue-600"
          : "from-[var(--color-primary-brown)] to-[#705C4D]";

    rooms[targetRoom].push(
      <div
        key={`slot-${slot.id}`}
        className={`absolute top-2 flex h-10 flex-col justify-center overflow-hidden rounded-md bg-gradient-to-r ${tone} px-2 text-[10px] text-white shadow-sm transition hover:z-10 hover:scale-[1.03]`}
        style={{ left: `${leftPercent}%`, width: `${Math.max(widthPercent, 4)}%` }}
        title={`${slot.nickname} | ${Math.floor(slot.start / 60).toString().padStart(2, "0")}:${(slot.start % 60).toString().padStart(2, "0")} - ${Math.floor(slot.end / 60).toString().padStart(2, "0")}:${(slot.end % 60).toString().padStart(2, "0")}`}
      >
        <span className="truncate font-bold">{slot.id}</span>
        <span className="truncate opacity-85">{slot.nickname}</span>
      </div>,
    );
  });

  return (
    <section className="rounded-lg border border-[var(--color-light-brown)] bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase text-[#847568]">
            <Clock size={16} />
            Schedule
          </div>
          <h3 className="mt-1 text-lg font-bold text-[var(--color-dark-brown)]">Timeline คิวประจำวัน</h3>
        </div>
        <label className="flex items-center gap-2 rounded-md border border-[var(--color-light-brown)] bg-[#FAF8F5] px-3 py-2 text-sm font-semibold">
          <CalendarDays size={16} className="text-[#847568]" />
          <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="bg-transparent outline-none" />
        </label>
      </div>

      <div className="overflow-x-auto">
        <div className="relative h-[218px] min-w-[720px] overflow-hidden rounded-lg border border-[#E5DFD4] bg-[#FDFBF7]">
          <div className="absolute left-0 top-0 h-8 w-full border-b border-[#E5DFD4]">{axis}</div>

          {["Room 1", "Room 2", "Room 3"].map((room, index) => (
            <div
              key={room}
              className="absolute left-0 w-full border-b border-dashed border-[#D4C4B7]/70 text-[11px] font-bold text-[var(--color-primary-brown)]"
              style={{ top: `${32 + index * 60}px`, height: "60px" }}
            >
              <div className="flex h-full w-16 items-center px-2">{room}</div>
              <div className="absolute bottom-0 left-16 right-0 top-0 border-l border-[#D4C4B7]">{rooms[index]}</div>
            </div>
          ))}
        </div>
      </div>

      {occupied.length === 0 && <div className="mt-3 rounded-md bg-[#FAF8F5] px-3 py-2 text-sm text-[#847568]">ยังไม่มีคิวในวันที่เลือก</div>}
    </section>
  );
}
