import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { useAppContext } from "../lib/AppContext";
import { showToast } from "./Toast";
import { sendLineNotification } from "../lib/api";

import { AdminTimeline } from "./AdminTimeline";
import { AdminStats } from "./AdminStats";

function ServiceTimer({ startTime, course, onComplete }: { startTime: string, course: string, onComplete: () => void }) {
   const [timeText, setTimeText] = useState('--:--');
   
   useEffect(() => {
       const durationMs = (course.includes('90') ? 90 : 60) * 60000;
       const startTs = new Date(startTime).getTime();
       
       const interval = setInterval(() => {
           const remain = durationMs - (Date.now() - startTs);
           if (remain <= 0) {
               clearInterval(interval);
               setTimeText('00:00 (Done)');
               onComplete();
           } else {
               const m = Math.floor(remain / 60000).toString().padStart(2, '0');
               const s = Math.floor((remain % 60000) / 1000).toString().padStart(2, '0');
               setTimeText(`${m}:${s}`);
           }
       }, 1000);
       return () => clearInterval(interval);
   }, [startTime, course, onComplete]);

   return <div className={`font-mono text-xl font-bold bg-white/60 px-3 py-1 rounded-xl shadow-sm border border-[var(--color-light-brown)] ${timeText.includes('Done') ? 'text-red-600 animate-pulse border-red-200' : 'text-[#D97706]'}`}>⏱️ {timeText}</div>;
}

export function AdminView() {
  const { queues, settings, updateQueues, updateSettings } = useAppContext();
  const [tab, setTab] = useState<'walkin' | 'timeline' | 'history' | 'stats'>('walkin');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Pending' | 'Waiting' | 'Serving' | 'Completed' | 'Cancelled'>('All');
  const [historyView, setHistoryView] = useState<'card' | 'list'>('card');
  const [walkinView, setWalkinView] = useState<'card' | 'list'>('card');

  const servings = queues.filter(q => q.status === "Serving");
  const waitings = queues.filter(q => q.status === "Waiting");
  const pendings = queues.filter(q => q.status === "Pending");

  const todayStr = format(new Date(), "yyyy-MM-dd");

  const revenueToday = queues
     .filter(q => q.status === "Completed" && q.isPaid && (q.bookingDate === todayStr || q.timestamp.startsWith(todayStr)))
     .reduce((acc, q) => acc + (q.actualPrice || 0), 0);
  
  const completedToday = queues.filter(q => q.status === "Completed" && (q.bookingDate === todayStr || q.timestamp.startsWith(todayStr))).length;

  const matchesSearch = (q: any) => {
      const term = searchTerm.trim().toLowerCase();
      if (!term) return true;
      return [q.id, q.nickname, q.phone, q.bookingDate, q.bookingTime, q.orderType, q.status, q.course]
          .filter(Boolean)
          .some(value => String(value).toLowerCase().includes(term));
  };

  const applyStatusFilter = (q: any) => {
      if (statusFilter === 'All') return true;
      return q.status === statusFilter;
  };

  const renderStatusBadge = (status: string) => {
    const base = 'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold';
    switch (status) {
      case 'Pending': return <span className={`${base} bg-blue-100 text-blue-700`}>{status}</span>;
      case 'Waiting': return <span className={`${base} bg-yellow-100 text-amber-700`}>{status}</span>;
      case 'Serving': return <span className={`${base} bg-green-100 text-green-700`}>{status}</span>;
      case 'Completed': return <span className={`${base} bg-gray-100 text-gray-700`}>{status}</span>;
      case 'Cancelled': return <span className={`${base} bg-red-100 text-red-700`}>{status}</span>;
      default: return <span className={`${base} bg-slate-100 text-slate-700`}>{status}</span>;
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    const q = queues.find(x => x.id === id);
    if (!q) return;

    const newQueues = queues.map(item => {
      if (item.id === id) {
        if (newStatus === "Cancelled" || newStatus === "Completed") return { ...item, status: newStatus as any };
        else if (newStatus === "Serving") return { ...item, status: newStatus as any, serviceStartTime: new Date().toISOString() };
        return { ...item, status: newStatus as any };
      }
      return item;
    });

    const success = await updateQueues(newQueues);
    if (success) {
      showToast("อัปเดตสถานะสำเร็จ", "success");
      if (q.lineUserId) {
        if (newStatus === 'Waiting') sendLineNotification(q.lineUserId, `✅ ยืนยันการจองสำเร็จ! (${q.id})\n📅 วันที่: ${q.bookingDate}\n⏰ เวลา: ${q.bookingTime}\n📞 เบอร์โทร: ${q.phone || '-'}`);
        else if (newStatus === 'Serving') sendLineNotification(q.lineUserId, `🎉 ถึงคิวของคุณแล้ว! (${q.id})\nกรุณามาที่จุดให้บริการค่ะ`);
        else if (newStatus === 'Completed') sendLineNotification(q.lineUserId, `🌸 ขอบคุณที่ใช้บริการค่ะ (${q.id})`);
        else if (newStatus === 'Cancelled') sendLineNotification(q.lineUserId, `❌ คิวของคุณถูกยกเลิก (${q.id})`);
      }
    } else {
      showToast("❌ พลาด", "error");
    }
  };

  const [editingQueue, setEditingQueue] = useState<any>(null);

  const handleSaveEdit = async (e: React.FormEvent) => {
     e.preventDefault();
     if(!editingQueue) return;
     
     const newQueues = queues.map(item => item.id === editingQueue.id ? editingQueue : item);
     if (await updateQueues(newQueues)) {
        showToast("แก้ไขข้อมูลสำเร็จ", "success");
        setEditingQueue(null);
     } else {
        showToast("เกิดข้อผิดพลาด", "error");
     }
  };

  const handleCheckbox = async (id: string, field: 'isPaid' | 'isDepositPaid', val: boolean) => {
    const newQueues = queues.map(item => item.id === id ? { ...item, [field]: val } : item);
    if (await updateQueues(newQueues)) {
        showToast("อัปเดตสำเร็จ", "success");
    } else {
        showToast("ผิดพลาด", "error");
    }
  };

  const renderQueueCard = (q: any) => {
    const isCompleted = q.status === 'Completed';
    const isPending = q.status === 'Pending';
    const isCancelled = q.status === 'Cancelled';
    const isArchived = q.status === 'Archived';
    const isServing = q.status === 'Serving';

    return (
      <div key={q.id} className={`bg-white rounded-3xl shadow-sm border ${isPending ? 'border-[#2563EB]/50' : 'border-[var(--color-light-brown)]'} overflow-hidden mb-4 animate-slide-in ${(isCompleted || isCancelled || isArchived) ? 'opacity-75 grayscale-[20%]' : ''}`}>
          <div className={`${isServing ? 'bg-[var(--color-primary-brown)]/10' : (isPending ? 'bg-[#2563EB]/5' : '#F4EFE6')} px-5 py-4 border-b ${isPending ? 'border-[#2563EB]/30' : 'border-[var(--color-light-brown)]'}`}>
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div className="flex items-start gap-3">
                      <span className="bg-white px-3 py-2 rounded-2xl font-mono font-bold border border-[var(--color-light-brown)] shadow-sm">{q.id}</span>
                      <div>
                          <div className="flex flex-wrap items-center gap-2 text-lg font-bold text-[var(--color-dark-brown)]">
                              <span>{q.nickname}</span>
                              <span className="text-xs text-[#847568] font-normal">{q.gender}</span>
                          </div>
                          <div className="text-xs text-[#847568]">{q.phone || '-'} · {q.orderType}</div>
                      </div>
                  </div>
                  <div className="flex flex-col gap-2 items-start sm:items-end">
                      <span className={isServing ? 'status-serving' : isPending ? 'status-pending' : isCancelled ? 'bg-red-50 text-red-600 px-2.5 py-1 rounded-full text-xs font-semibold' : isCompleted||isArchived ? 'status-completed' : 'status-waiting'}>{q.status}</span>
                      {!isCompleted && !isCancelled && (
                        <button onClick={() => setEditingQueue({...q, discount: q.discount || '', actualPrice: q.actualPrice ?? calculateActualPrice(q.course, q.discount)})} className="text-[11px] bg-white/80 hover:bg-white border border-[var(--color-light-brown)] px-3 py-1 rounded-full shadow-sm text-[var(--color-primary-brown)]">✏️ Edit</button>
                      )}
                  </div>
              </div>
          </div>
          
          <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-[#5A4A3D]">
                 <div className="rounded-2xl bg-[#FAF8F5] p-4 border border-[var(--color-light-brown)]">
                    <div className="text-[10px] text-[#847568] uppercase tracking-wider mb-2">Course</div>
                    <div className="font-bold text-[var(--color-dark-brown)]">{q.course}</div>
                 </div>
                 <div className="rounded-2xl bg-[#FAF8F5] p-4 border border-[var(--color-light-brown)]">
                    <div className="text-[10px] text-[#847568] uppercase tracking-wider mb-2">ราคา</div>
                    <div className="font-bold text-[#15803D]">฿{q.actualPrice}</div>
                 </div>
                 <div className="rounded-2xl bg-[#FAF8F5] p-4 border border-[var(--color-light-brown)]">
                    <div className="text-[10px] text-[#847568] uppercase tracking-wider mb-2">น้ำ</div>
                    <div className="font-bold">{q.waterTemp || '-'}</div>
                 </div>
                 <div className="rounded-2xl bg-[#FAF8F5] p-4 border border-[var(--color-light-brown)]">
                    <div className="text-[10px] text-[#847568] uppercase tracking-wider mb-2">กลิ่น</div>
                    <div className="font-bold">{q.oil || '-'}</div>
                 </div>
                 <div className="rounded-2xl bg-[#FAF8F5] p-4 border border-[var(--color-light-brown)]">
                    <div className="text-[10px] text-[#847568] uppercase tracking-wider mb-2">สระ</div>
                    <div className="font-bold">{q.shampoo || '-'}</div>
                 </div>
                 <div className="rounded-2xl bg-[#FAF8F5] p-4 border border-[var(--color-light-brown)]">
                    <div className="text-[10px] text-[#847568] uppercase tracking-wider mb-2">นวด</div>
                    <div className="font-bold">{q.massagePressure || '-'}</div>
                 </div>
                 <div className="rounded-2xl bg-[#FAF8F5] p-4 border border-[var(--color-light-brown)] sm:col-span-2">
                    <div className="text-[10px] text-[#847568] uppercase tracking-wider mb-2">แรงกดศีรษะ</div>
                    <div className="font-bold">{q.headPressure || '-'}</div>
                 </div>
              </div>

              {q.caution && <div className="mt-1 rounded-2xl bg-red-50 border border-red-200 p-3 text-red-700 text-sm">⚠️ Caution: {q.caution}</div>}
              {q.internalNote && (
                  <div className="mt-1 rounded-2xl bg-[#FFFDF9] p-3 border border-[var(--color-primary-brown)]/30 text-sm">
                      <div className="font-bold text-[var(--color-primary-brown)] mb-1">🔒 Internal Note</div>
                      <div className="text-[var(--color-dark-brown)] whitespace-pre-wrap">{q.internalNote}</div>
                  </div>
              )}
              
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center justify-between mt-3 pt-4 border-t border-[var(--color-light-brown)]">
                 <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                    <label className="flex items-center gap-2 cursor-pointer rounded-2xl border bg-white/70 px-3 py-2 text-xs hover:bg-[#F4EFE6]">
                        <input type="checkbox" checked={q.isDepositPaid} onChange={e => handleCheckbox(q.id, 'isDepositPaid', e.target.checked)} className="w-4 h-4" />
                        <span>มัดจำแล้ว</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer rounded-2xl border bg-white/70 px-3 py-2 text-xs hover:bg-[#F4EFE6]">
                        <input type="checkbox" checked={q.isPaid} onChange={e => handleCheckbox(q.id, 'isPaid', e.target.checked)} className="w-4 h-4" />
                        <span>จ่ายเต็ม</span>
                    </label>
                 </div>
                 <div className="flex flex-wrap gap-2 items-center">
                   {isServing && q.serviceStartTime && (
                       <ServiceTimer startTime={q.serviceStartTime} course={q.course} onComplete={() => handleUpdateStatus(q.id, 'Completed')} />
                   )}
                   {isPending && (
                     <>
                        <button onClick={() => handleUpdateStatus(q.id, 'Waiting')} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-2xl text-xs font-bold text-white shadow-sm">✅ Confirm</button>
                        <button onClick={() => handleUpdateStatus(q.id, 'Cancelled')} className="bg-white text-red-500 hover:bg-red-50 border border-red-200 px-4 py-2 rounded-2xl text-xs font-bold shadow-sm">❌ Reject</button>
                     </>
                   )}
                   {q.status === 'Waiting' && (
                     <>
                        <button onClick={() => handleUpdateStatus(q.id, 'Serving')} className="bg-gradient-to-r from-[#15803D] to-green-600 text-white px-5 py-2 rounded-2xl text-sm font-bold shadow-md hover:scale-105 transition-all">▶️ Start</button>
                        <button onClick={() => handleUpdateStatus(q.id, 'Cancelled')} className="bg-white text-red-600 border border-red-200 px-4 py-2 rounded-2xl text-xs font-bold shadow-sm hover:bg-red-50">Cancel</button>
                     </>
                   )}
                   {q.status === 'Serving' && (
                     <>
                        <button onClick={() => handleUpdateStatus(q.id, 'Completed')} className="bg-[var(--color-dark-brown)] text-white px-4 py-2 rounded-2xl text-xs font-bold shadow-sm">✅ Mark Done</button>
                        <button onClick={() => handleUpdateStatus(q.id, 'Cancelled')} className="bg-white text-red-600 border border-red-200 px-4 py-2 rounded-2xl text-xs font-bold shadow-sm hover:bg-red-50">Cancel</button>
                     </>
                   )}
                 </div>
              </div>
          </div>
      </div>
    );
  };

  const toList = (list: any[]) => {
    if (list.length === 0) return <div className="text-center py-8 text-[#847568]">No Queues</div>;
    return list.map(renderQueueCard);
  };

  const walkinList = queues.filter(q => q.orderType !== 'booking' && ['Pending', 'Waiting', 'Serving'].includes(q.status));
  const historyList = queues.filter(q => ['Completed', 'Cancelled', 'Archived'].includes(q.status)).reverse();

  const filteredWalkin = walkinList.filter(q => matchesSearch(q) && applyStatusFilter(q));
  const filteredHistory = historyList.filter(q => matchesSearch(q) && applyStatusFilter(q));
  const nextWaiting = waitings[0] || null;

  const [showSettings, setShowSettings] = useState(false);

  const calculateActualPrice = (course: string, discountInput?: string) => {
    const basePrice = course.includes('90') ? 890 : 590;
    const discountRaw = (discountInput || '').trim();
    if (!discountRaw) return basePrice;

    let discountedPrice = basePrice;
    if (discountRaw.includes('%')) {
      const percent = parseFloat(discountRaw.replace('%', ''));
      if (!Number.isNaN(percent) && percent > 0) {
        discountedPrice = basePrice - (basePrice * percent / 100);
      }
    } else {
      const amount = parseFloat(discountRaw);
      if (!Number.isNaN(amount) && amount > 0) {
        discountedPrice = basePrice - amount;
      }
    }
    return Math.max(0, Math.round(discountedPrice));
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if(settings) {
       await updateSettings(settings);
       showToast("บันทึกการตั้งค่าสำเร็จ", "success");
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 pb-12 pt-6">
       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-6 border-b border-[var(--color-light-brown)] pb-4">
          <div>
              <h2 className="text-2xl md:text-3xl font-bold">Staff Dashboard</h2>
              <p className="text-[#847568] text-sm font-medium mt-1">ดูและจัดการคิวได้ทันทีอย่างชัดเจน</p>
          </div>
          <button onClick={() => setShowSettings(!showSettings)} className="text-xs text-[var(--color-primary-brown)] font-bold hover:text-[var(--color-dark-brown)] transition-all bg-white px-4 py-2 rounded-xl border border-[var(--color-light-brown)] shadow-sm mt-0 flex items-center gap-2">
              <span>⚙️</span> System Settings
          </button>
       </div>

       {showSettings && (
          <div className="glass-panel p-5 rounded-2xl mb-6 border-[var(--color-light-brown)] shadow-sm">
             <h4 className="text-[var(--color-dark-brown)] font-bold text-sm mb-3">System Configuration</h4>
             <div className="space-y-3">
                 <div className="pt-4 mt-2 border-t border-[var(--color-light-brown)]">
                     <label className="text-xs text-[var(--color-dark-brown)] font-bold mb-2 flex items-center gap-1">🔔 แจ้งเตือนพนักงาน (LINE User ID)</label>
                     <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                         {[0,1,2,3,4,5].map(i => (
                             <input key={i} type="text" value={settings?.staffLineIds[i] || ''} onChange={e => {
                                 if(!settings) return;
                                 const newIds = [...settings.staffLineIds];
                                 newIds[i] = e.target.value;
                                 // update local context state immediately
                                 updateSettings({...settings, staffLineIds: newIds});
                             }} className="glass-input text-xs bg-white" placeholder={`Staff ${i+1} LINE ID`} />
                         ))}
                     </div>
                     <button onClick={handleSaveSettings} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm">💾 บันทึกตั้งค่า (Save Settings)</button>
                 </div>
                 
                 <div className="pt-4 mt-2 border-t border-[var(--color-light-brown)]">
                     <label className="text-xs text-red-600 font-bold mb-2 flex items-center gap-1">⚠️ จัดการพื้นที่เก็บข้อมูล (Database)</label>
                     <button onClick={() => {
                        const confirm = window.confirm("ลบข้อมูลเดือนก่อนหน้า?\n(เฉพาะคิวเก่าที่จบไปแล้ว จะไม่ลบของเดือนปัจจุบัน)");
                        if(confirm) {
                            const nowStr = format(new Date(), "yyyy-MM");
                            const newQueues = queues.filter(q => {
                                const qMonth = (q.bookingDate || q.timestamp).substring(0, 7);
                                if (qMonth === nowStr) return true;
                                if (['Pending', 'Waiting', 'Serving'].includes(q.status)) return true;
                                return false;
                            });
                            updateQueues(newQueues);
                            showToast("ลบข้อมูลเก่าแล้ว", "success");
                        }
                     }} className="w-full py-2.5 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 border border-red-200">
                         <span>🗑️</span> ลบข้อมูลคิวของเดือนที่แล้ว (Clear Old Data)
                     </button>
                 </div>
             </div>
          </div>
       )}

       <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                 <div className="bg-white p-4 rounded-2xl border border-[var(--color-light-brown)] shadow-sm">
                    <div className="text-[10px] text-[#847568] font-bold uppercase tracking-wider mb-1">ยอดขายวันนี้</div>
                    <div className="text-2xl font-bold text-[#15803D]">฿{revenueToday}</div>
                    <div className="text-xs text-[#847568] mt-2">เฉพาะคิวจ่ายเงินแล้ววันนี้</div>
                 </div>
                 <div className="bg-white p-4 rounded-2xl border border-[var(--color-light-brown)] shadow-sm">
                    <div className="text-[10px] text-[#847568] font-bold uppercase tracking-wider mb-1">ประวัติวันนี้</div>
                    <div className="text-2xl font-bold">{completedToday}</div>
                    <div className="text-xs text-[#847568] mt-2">คิวเสร็จสิ้นวันนี้</div>
                 </div>
                 <div className="bg-white p-4 rounded-2xl border border-[var(--color-light-brown)] shadow-sm">
                    <div className="text-[10px] text-[#847568] font-bold uppercase tracking-wider mb-1">รอยืนยัน</div>
                    <div className="text-2xl font-bold text-[#2563EB]">{pendings.length}</div>
                    <div className="text-xs text-[#847568] mt-2">คำขอรอการยืนยัน</div>
                 </div>
                 <div className="bg-white p-4 rounded-2xl border border-[var(--color-light-brown)] shadow-sm">
                    <div className="text-[10px] text-[#847568] font-bold uppercase tracking-wider mb-1">รอรับบริการ</div>
                    <div className="text-2xl font-bold text-[#D97706]">{waitings.length}</div>
                    <div className="text-xs text-[#847568] mt-2">ลูกค้าพร้อมให้บริการทันที</div>
                 </div>
              </div>

              <div className="grid gap-3 mt-3">
                 <div className="bg-gradient-to-br from-[var(--color-primary-brown)] to-[#4A3B32] p-6 rounded-3xl text-white shadow-lg border border-[var(--color-light-brown)]">
                     <div className="text-white/80 text-xs font-bold uppercase tracking-widest mb-3">NOW SERVING</div>
                     <div className="text-6xl font-bold mb-2">{servings.length > 0 ? `${servings.length}/3` : '-'}</div>
                     <div className="text-lg text-[var(--color-bg-cream)] font-medium">{servings.length > 0 ? servings.map(s => s.id).join(', ') : 'No Serving'}</div>
                 </div>
                 <div className="bg-white p-5 rounded-3xl border border-[var(--color-light-brown)] shadow-sm">
                    <div className="text-xs uppercase tracking-wider font-bold text-[#847568] mb-1">Next in line</div>
                    {nextWaiting ? (
                      <div className="space-y-2">
                        <div className="text-2xl font-bold text-[var(--color-dark-brown)]">{nextWaiting.id}</div>
                        <div className="text-sm text-[#5A4A3D]">{nextWaiting.nickname} • {nextWaiting.course}</div>
                        <div className="text-xs text-[#847568]">{nextWaiting.bookingDate} · {nextWaiting.bookingTime}</div>
                      </div>
                    ) : (
                      <div className="text-sm text-[#847568]">ไม่มีคิวรอรับบริการ</div>
                    )}
                 </div>
              </div>
          </div>

          <div className="lg:col-span-8">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
                  <input type="search" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="ค้นหา ID, ชื่อ, เบอร์, สถานะ..." className="glass-input !py-3 !px-4 flex-1" />
                  <button onClick={() => setSearchTerm('')} className="shrink-0 bg-white border border-[var(--color-light-brown)] text-[var(--color-dark-brown)] hover:bg-[var(--color-bg-cream)] px-4 py-3 rounded-xl text-sm font-bold shadow-sm">ล้างค้นหา</button>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                  {['All', 'Pending', 'Waiting', 'Serving', 'Completed', 'Cancelled'].map(option => (
                    <button key={option} onClick={() => setStatusFilter(option as any)} className={`rounded-full px-4 py-2 text-xs font-semibold transition ${statusFilter === option ? 'bg-[var(--color-primary-brown)] text-white shadow-sm' : 'bg-white border border-[var(--color-light-brown)] text-[var(--color-dark-brown)] hover:bg-[var(--color-bg-cream)]'}`}>
                      {option === 'All' ? 'All' : option}
                    </button>
                  ))}
              </div>

              <div className="flex bg-white border border-[var(--color-light-brown)] p-1.5 rounded-2xl mb-5 gap-1 overflow-x-auto shadow-sm snap-x">
                  <button onClick={() => setTab('walkin')} className={`touch-target min-w-[120px] sm:min-w-0 sm:flex-1 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap px-2 snap-start ${tab === 'walkin' ? 'active tab-btn' : 'tab-btn'}`}>🚶 Walk-in</button>
                  <button onClick={() => setTab('timeline')} className={`touch-target min-w-[120px] sm:min-w-0 sm:flex-1 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap px-2 snap-start ${tab === 'timeline' ? 'active tab-btn' : 'tab-btn'}`}>⏰ Timeline</button>
                  <button onClick={() => setTab('history')} className={`touch-target min-w-[120px] sm:min-w-0 sm:flex-1 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap px-2 snap-start ${tab === 'history' ? 'active tab-btn' : 'tab-btn'}`}>✅ ประวัติ</button>
                  <button onClick={() => setTab('stats')} className={`touch-target min-w-[120px] sm:min-w-0 sm:flex-1 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap px-2 snap-start ${tab === 'stats' ? 'active tab-btn' : 'tab-btn'}`}>📊 Dashboard</button>
              </div>

              <div>
                  {tab === 'walkin' && (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                        <div className="flex gap-2">
                          <button onClick={() => setWalkinView('card')} className={`rounded-full px-4 py-2 text-xs font-semibold transition ${walkinView === 'card' ? 'bg-[var(--color-primary-brown)] text-white shadow-sm' : 'bg-white border border-[var(--color-light-brown)] text-[var(--color-dark-brown)] hover:bg-[var(--color-bg-cream)]'}`}>
                            Card view
                          </button>
                          <button onClick={() => setWalkinView('list')} className={`rounded-full px-4 py-2 text-xs font-semibold transition ${walkinView === 'list' ? 'bg-[var(--color-primary-brown)] text-white shadow-sm' : 'bg-white border border-[var(--color-light-brown)] text-[var(--color-dark-brown)] hover:bg-[var(--color-bg-cream)]'}`}>
                            List view
                          </button>
                        </div>
                        <div className="text-xs text-[#847568]">{filteredWalkin.length} records</div>
                      </div>
                      {walkinView === 'card' ? toList(filteredWalkin) : (
                        <div className="overflow-x-auto rounded-3xl border border-[var(--color-light-brown)] bg-white shadow-sm">
                          <table className="min-w-full divide-y divide-[#E5DFD4] text-sm">
                            <thead className="bg-[#F8F4EE] text-left text-xs uppercase tracking-wider text-[#847568]">
                              <tr>
                                <th className="px-4 py-3">ID</th>
                                <th className="px-4 py-3">ชื่อ</th>
                                <th className="px-4 py-3">คอร์ส</th>
                                <th className="px-4 py-3">ราคา</th>
                                <th className="px-4 py-3">วันที่</th>
                                <th className="px-4 py-3">เวลา</th>
                                <th className="px-4 py-3">สถานะ</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#E5DFD4]">
                              {filteredWalkin.length === 0 ? (
                                <tr>
                                  <td colSpan={7} className="px-4 py-6 text-center text-[#847568]">No Walk-in records</td>
                                </tr>
                              ) : filteredWalkin.map(q => (
                                <tr key={q.id} className="even:bg-[#FAF8F5]">
                                  <td className="px-4 py-3 font-mono text-[13px] text-[var(--color-dark-brown)]">{q.id}</td>
                                  <td className="px-4 py-3 text-[var(--color-dark-brown)]">{q.nickname} <span className="text-xs text-[#847568]">{q.phone}</span></td>
                                  <td className="px-4 py-3">{q.course}</td>
                                  <td className="px-4 py-3 text-[#15803D]">฿{q.actualPrice || '-'}</td>
                                  <td className="px-4 py-3">{q.bookingDate}</td>
                                  <td className="px-4 py-3">{q.bookingTime}</td>
                                  <td className="px-4 py-3">{renderStatusBadge(q.status)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                  {tab === 'timeline' && <AdminTimeline queues={queues} />}
                  {tab === 'history' && (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                        <div className="flex gap-2">
                          <button onClick={() => setHistoryView('card')} className={`rounded-full px-4 py-2 text-xs font-semibold transition ${historyView === 'card' ? 'bg-[var(--color-primary-brown)] text-white shadow-sm' : 'bg-white border border-[var(--color-light-brown)] text-[var(--color-dark-brown)] hover:bg-[var(--color-bg-cream)]'}`}>
                            Card view
                          </button>
                          <button onClick={() => setHistoryView('list')} className={`rounded-full px-4 py-2 text-xs font-semibold transition ${historyView === 'list' ? 'bg-[var(--color-primary-brown)] text-white shadow-sm' : 'bg-white border border-[var(--color-light-brown)] text-[var(--color-dark-brown)] hover:bg-[var(--color-bg-cream)]'}`}>
                            List view
                          </button>
                        </div>
                        <div className="text-xs text-[#847568]">{filteredHistory.length} records</div>
                      </div>
                      {historyView === 'card' ? toList(filteredHistory) : (
                        <div className="overflow-x-auto rounded-3xl border border-[var(--color-light-brown)] bg-white shadow-sm">
                          <table className="min-w-full divide-y divide-[#E5DFD4] text-sm">
                            <thead className="bg-[#F8F4EE] text-left text-xs uppercase tracking-wider text-[#847568]">
                              <tr>
                                <th className="px-4 py-3">ID</th>
                                <th className="px-4 py-3">ชื่อ</th>
                                <th className="px-4 py-3">คอร์ส</th>
                                <th className="px-4 py-3">ราคา</th>
                                <th className="px-4 py-3">วันที่</th>
                                <th className="px-4 py-3">เวลา</th>
                                <th className="px-4 py-3">สถานะ</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#E5DFD4]">
                              {filteredHistory.map(q => (
                                <tr key={q.id} className="even:bg-[#FAF8F5]">
                                  <td className="px-4 py-3 font-mono text-[13px] text-[var(--color-dark-brown)]">{q.id}</td>
                                  <td className="px-4 py-3 text-[var(--color-dark-brown)]">{q.nickname} <span className="text-xs text-[#847568]">{q.phone}</span></td>
                                  <td className="px-4 py-3">{q.course}</td>
                                  <td className="px-4 py-3 text-[#15803D]">฿{q.actualPrice || '-'}</td>
                                  <td className="px-4 py-3">{q.bookingDate}</td>
                                  <td className="px-4 py-3">{q.bookingTime}</td>
                                  <td className="px-4 py-3">{renderStatusBadge(q.status)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                  {tab === 'stats' && <AdminStats queues={queues} />}
              </div>
          </div>
       </div>

       {/* EDIT MODAL */}
       {editingQueue && (
         <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
             <div className="glass-panel p-6 rounded-3xl w-full max-w-md bg-[var(--color-bg-cream)] max-h-[90vh] overflow-y-auto">
                 <div className="flex justify-between items-center mb-4">
                     <h3 className="text-xl font-bold text-[var(--color-dark-brown)]">📝 Edit Queue</h3>
                     <button onClick={() => setEditingQueue(null)} className="text-[#847568] hover:text-red-500 font-bold text-xl">&times;</button>
                 </div>
                 <form onSubmit={handleSaveEdit} className="space-y-4">
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                         <div>
                             <label className="block text-xs font-bold text-[#847568] mb-1">Nickname</label>
                             <input type="text" value={editingQueue.nickname} onChange={e => setEditingQueue({...editingQueue, nickname: e.target.value})} className="glass-input bg-white text-sm py-2" />
                         </div>
                         <div>
                             <label className="block text-xs font-bold text-[#847568] mb-1">Phone</label>
                             <input type="tel" value={editingQueue.phone} onChange={e => setEditingQueue({...editingQueue, phone: e.target.value})} className="glass-input bg-white text-sm py-2" />
                         </div>
                     </div>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                         <div>
                             <label className="block text-xs font-bold text-[#847568] mb-1">Date</label>
                             <input type="date" value={editingQueue.bookingDate} onChange={e => setEditingQueue({...editingQueue, bookingDate: e.target.value})} className="glass-input bg-white text-sm py-2" />
                         </div>
                         <div>
                             <label className="block text-xs font-bold text-[#847568] mb-1">Time</label>
                             <input type="time" value={editingQueue.bookingTime} onChange={e => setEditingQueue({...editingQueue, bookingTime: e.target.value})} className="glass-input bg-white text-sm py-2" />
                         </div>
                     </div>
                     <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                         <div>
                             <label className="block text-xs font-bold text-[#847568] mb-1">Course</label>
                             <select value={editingQueue.course} onChange={e => {
                                 const course = e.target.value;
                                 setEditingQueue({...editingQueue, course, actualPrice: calculateActualPrice(course, editingQueue.discount)});
                             }} className="glass-input bg-white text-sm py-2 px-2">
                                 <option value="60 min">60 min</option>
                                 <option value="90 min">90 min</option>
                             </select>
                         </div>
                         <div>
                             <label className="block text-xs font-bold text-[#847568] mb-1">ส่วนลด</label>
                             <input type="text" value={editingQueue.discount || ''} onChange={e => {
                                 const discount = e.target.value;
                                 setEditingQueue({...editingQueue, discount, actualPrice: calculateActualPrice(editingQueue.course, discount)});
                             }} className="glass-input bg-white text-sm py-2" placeholder="เช่น 10% หรือ 50" />
                         </div>
                         <div>
                             <label className="block text-xs font-bold text-[#847568] mb-1">ยอดจ่ายจริง (฿)</label>
                             <input type="number" value={editingQueue.actualPrice || 0} onChange={e => setEditingQueue({...editingQueue, actualPrice: parseFloat(e.target.value) || 0})} className="glass-input bg-white text-sm py-2 font-bold text-[#15803D]" />
                         </div>
                     </div>
                     <div className="pt-2 border-t border-[var(--color-light-brown)]">
                         <label className="block text-sm font-bold text-[var(--color-primary-brown)] mb-2 flex items-center gap-1">🔒 Internal Note</label>
                         <textarea value={editingQueue.internalNote || ''} onChange={e => setEditingQueue({...editingQueue, internalNote: e.target.value})} rows={3} className="glass-input bg-white border-[var(--color-primary-brown)]/30 text-sm"></textarea>
                     </div>
                     <button type="submit" className="w-full py-3 bg-[#15803D] hover:bg-green-800 text-white rounded-xl font-bold shadow-md transition-all mt-4">💾 Save Changes</button>
                 </form>
             </div>
         </div>
       )}
    </div>
  );
}
