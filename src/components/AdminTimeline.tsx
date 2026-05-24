import { useState } from "react";
import { format } from "date-fns";
import { QueueItem } from "../types";
import { MAX_CONCURRENT_BOOKINGS } from "../lib/utils";

export function AdminTimeline({ queues }: { queues: QueueItem[] }) {
  const [filterDate, setFilterDate] = useState(() => format(new Date(), "yyyy-MM-dd"));

  const shopOpenMins = 0; // 00:00
  const shopCloseMins = 24 * 60; // 24:00
  const totalMins = shopCloseMins - shopOpenMins;

  // Render Axis Time markers
  const axisHtml = [];
  for (let h = 0; h <= 24; h += 3) {
    const posPercent = ((h * 60 - shopOpenMins) / totalMins) * 100;
    axisHtml.push(
      <div key={`axis-${h}`} style={{ position: 'absolute', left: `calc(60px + ${posPercent}%)`, borderLeft: '1px solid var(--color-light-brown)', height: '100%', paddingLeft: '4px', fontSize: '10px', color: '#847568' }}>
        {h}:00
      </div>
    );
  }

  // Get slots for specific date
  const occupied = queues.filter(q => q.bookingDate === filterDate && ['Waiting', 'Serving', 'Pending'].includes(q.status))
    .map(q => {
      const h = parseInt(q.bookingTime.split(":")[0]);
      const m = parseInt(q.bookingTime.split(":")[1]);
      const start = h * 60 + m;
      const dur = q.course.includes('90') ? 90 : 60;
      return { start, end: start + dur, id: q.id, nickname: q.nickname };
    });

  // Sort by start time
  occupied.sort((a, b) => a.start - b.start);

  let r1End = 0, r2End = 0, r3End = 0;
  const room1Slots = [];
  const room2Slots = [];
  const room3Slots = [];

  occupied.forEach(slot => {
    let renderStart = Math.max(shopOpenMins, slot.start);
    let renderEnd = Math.min(shopCloseMins, slot.end);
    if (renderStart >= renderEnd) return; // Out of bounds

    const leftPercent = ((renderStart - shopOpenMins) / totalMins) * 100;
    const widthPercent = ((renderEnd - renderStart) / totalMins) * 100;

    let targetRoom = 1;
    if (slot.start >= r1End) {
      targetRoom = 1;
      r1End = slot.end;
    } else if (slot.start >= r2End) {
      targetRoom = 2;
      r2End = slot.end;
    } else if (slot.start >= r3End) {
      targetRoom = 3;
      r3End = slot.end;
    } else {
      targetRoom = 3;
      r3End = slot.end;
    }

    const blockHtml = (
      <div key={`slot-${slot.id}`} className="absolute h-[40px] rounded-lg top-[5px] text-white text-[10px] p-1 overflow-hidden whitespace-nowrap text-ellipsis shadow-sm border border-white/30 flex flex-col justify-center transition-all hover:z-10 hover:scale-105 bg-gradient-to-r from-[var(--color-primary-brown)] to-[#705C4D]"
            style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
            title={`${slot.nickname} | ${Math.floor(slot.start / 60).toString().padStart(2, '0')}:${(slot.start % 60).toString().padStart(2, '0')} - ${Math.floor(slot.end / 60).toString().padStart(2, '0')}:${(slot.end % 60).toString().padStart(2, '0')}`}>
          <span className="font-bold">{slot.id}</span>
          <span className="opacity-80">{slot.nickname}</span>
      </div>
    );

    if (targetRoom === 1) room1Slots.push(blockHtml);
    else if (targetRoom === 2) room2Slots.push(blockHtml);
    else room3Slots.push(blockHtml);
  });

  return (
    <div className="bg-white p-6 rounded-3xl border border-[var(--color-light-brown)] shadow-sm overflow-x-auto">
      <div className="flex justify-between items-center mb-4">
          <h3 className="text-[var(--color-dark-brown)] font-bold text-lg flex items-center gap-2">⏰ Schedule View</h3>
          <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="glass-input !py-1 w-auto h-10 text-sm bg-white/60" />
      </div>

      <div className="relative w-full h-[200px] bg-[#FDFBF7] rounded-xl border border-[var(--color-light-brown)] overflow-hidden min-w-[600px]">
          <div className="absolute top-0 left-0 w-full h-[30px] border-b border-dashed border-[var(--color-light-brown)] flex">
              {axisHtml}
          </div>

          <div className="absolute left-0 w-full h-[55px] border-b border-dashed border-[#D4C4B7]/50 flex items-center pl-2 text-[10px] font-bold text-[var(--color-primary-brown)]" style={{ top: '30px' }}>
              Room 1
              <div className="absolute left-[60px] right-0 h-full border-l border-[var(--color-light-brown)]">
                 {room1Slots}
              </div>
          </div>

          <div className="absolute left-0 w-full h-[55px] border-b border-dashed border-[#D4C4B7]/50 flex items-center pl-2 text-[10px] font-bold text-[var(--color-primary-brown)]" style={{ top: '85px' }}>
              Room 2
              <div className="absolute left-[60px] right-0 h-full border-l border-[var(--color-light-brown)]">
                 {room2Slots}
              </div>
          </div>
          
          <div className="absolute left-0 w-full h-[55px] border-b border-dashed border-[#D4C4B7]/50 flex items-center pl-2 text-[10px] font-bold text-[var(--color-primary-brown)]" style={{ top: '140px' }}>
              Room 3
              <div className="absolute left-[60px] right-0 h-full border-l border-[var(--color-light-brown)]">
                 {room3Slots}
              </div>
          </div>
      </div>
    </div>
  );
}
