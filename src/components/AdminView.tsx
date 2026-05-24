import React, { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import {
  Ban,
  Check,
  CheckCircle2,
  Clock,
  Edit3,
  History,
  LayoutDashboard,
  ListFilter,
  Play,
  Search,
  Settings,
  SlidersHorizontal,
  Wallet,
  X,
} from "lucide-react";
import { useAppContext } from "../lib/AppContext";
import { showToast } from "./Toast";
import { sendLineNotification } from "../lib/api";
import { QueueItem } from "../types";
import { AdminTimeline } from "./AdminTimeline";
import { AdminStats } from "./AdminStats";

type AdminTab = "walkin" | "timeline" | "history" | "stats";
type ViewMode = "card" | "list";
type StatusFilter = "All" | QueueItem["status"];

const activeStatuses: QueueItem["status"][] = ["Pending", "Waiting", "Serving"];
const historyStatuses: QueueItem["status"][] = ["Completed", "Cancelled", "Archived"];
const statusOptions: StatusFilter[] = ["All", "Pending", "Waiting", "Serving", "Completed", "Cancelled"];

const money = (value?: number) => `฿${(value || 0).toLocaleString()}`;

function ServiceTimer({
  startTime,
  course,
  onComplete,
}: {
  startTime: string;
  course: string;
  onComplete: () => void;
}) {
  const [timeText, setTimeText] = useState("--:--");
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const durationMs = (course.includes("90") ? 90 : 60) * 60000;
    const startTs = new Date(startTime).getTime();

    const interval = setInterval(() => {
      const remain = durationMs - (Date.now() - startTs);
      if (remain <= 0) {
        clearInterval(interval);
        setTimeText("00:00");
        onCompleteRef.current();
        return;
      }
      const m = Math.floor(remain / 60000).toString().padStart(2, "0");
      const s = Math.floor((remain % 60000) / 1000).toString().padStart(2, "0");
      setTimeText(`${m}:${s}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime, course]);

  return (
    <div className="inline-flex h-9 items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 font-mono text-sm font-bold text-amber-700">
      <Clock size={15} />
      {timeText}
    </div>
  );
}

function StatusBadge({ status }: { status: QueueItem["status"] }) {
  const styles: Record<QueueItem["status"], string> = {
    Pending: "border-blue-200 bg-blue-50 text-blue-700",
    Waiting: "border-amber-200 bg-amber-50 text-amber-700",
    Serving: "border-green-200 bg-green-50 text-green-700",
    Completed: "border-slate-200 bg-slate-50 text-slate-600",
    Cancelled: "border-red-200 bg-red-50 text-red-700",
    Archived: "border-zinc-200 bg-zinc-50 text-zinc-500",
  };

  return (
    <span className={`inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-semibold ${styles[status]}`}>
      {status}
    </span>
  );
}

function MetricCard({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  detail: string;
  tone?: "neutral" | "blue" | "amber" | "green";
}) {
  const toneClass = {
    neutral: "text-[var(--color-dark-brown)]",
    blue: "text-blue-700",
    amber: "text-amber-700",
    green: "text-green-700",
  }[tone];

  return (
    <div className="rounded-lg border border-[var(--color-light-brown)] bg-white p-4 shadow-sm">
      <div className="text-[11px] font-bold uppercase text-[#847568]">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${toneClass}`}>{value}</div>
      <div className="mt-1 text-xs text-[#847568]">{detail}</div>
    </div>
  );
}

export function AdminView() {
  const { queues, settings, updateQueues, updateSettings } = useAppContext();
  const [tab, setTab] = useState<AdminTab>("walkin");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [historyView, setHistoryView] = useState<ViewMode>("list");
  const [walkinView, setWalkinView] = useState<ViewMode>("card");
  const [showSettings, setShowSettings] = useState(false);
  const [editingQueue, setEditingQueue] = useState<QueueItem | null>(null);
  const [staffLineIdsDraft, setStaffLineIdsDraft] = useState<string[]>([]);

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const servings = queues.filter((q) => q.status === "Serving");
  const waitings = queues.filter((q) => q.status === "Waiting");
  const pendings = queues.filter((q) => q.status === "Pending");
  const nextWaiting = waitings[0] || null;

  const revenueToday = queues
    .filter((q) => q.status === "Completed" && q.isPaid && (q.bookingDate === todayStr || q.timestamp.startsWith(todayStr)))
    .reduce((acc, q) => acc + (q.actualPrice || 0), 0);

  const completedToday = queues.filter(
    (q) => q.status === "Completed" && (q.bookingDate === todayStr || q.timestamp.startsWith(todayStr)),
  ).length;

  useEffect(() => {
    setStaffLineIdsDraft(settings?.staffLineIds || ["", "", "", "", "", ""]);
  }, [settings]);

  const calculateActualPrice = (course: string, discountInput?: string) => {
    const basePrice = course.includes("90") ? 890 : 590;
    const discountRaw = (discountInput || "").trim();
    if (!discountRaw) return basePrice;

    if (discountRaw.includes("%")) {
      const percent = parseFloat(discountRaw.replace("%", ""));
      return Number.isNaN(percent) ? basePrice : Math.max(0, Math.round(basePrice - (basePrice * percent) / 100));
    }

    const amount = parseFloat(discountRaw);
    return Number.isNaN(amount) ? basePrice : Math.max(0, Math.round(basePrice - amount));
  };

  const matchesSearch = (q: QueueItem) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return [q.id, q.nickname, q.phone, q.bookingDate, q.bookingTime, q.orderType, q.status, q.course]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term));
  };

  const applyStatusFilter = (q: QueueItem) => statusFilter === "All" || q.status === statusFilter;

  const walkinList = useMemo(
    () => queues.filter((q) => q.orderType !== "booking" && activeStatuses.includes(q.status)),
    [queues],
  );
  const historyList = useMemo(
    () => queues.filter((q) => historyStatuses.includes(q.status)).slice().reverse(),
    [queues],
  );

  const filteredWalkin = walkinList.filter((q) => matchesSearch(q) && applyStatusFilter(q));
  const filteredHistory = historyList.filter((q) => matchesSearch(q) && applyStatusFilter(q));

  const handleUpdateStatus = async (id: string, newStatus: QueueItem["status"]) => {
    const q = queues.find((x) => x.id === id);
    if (!q) return;

    const newQueues = queues.map((item) => {
      if (item.id !== id) return item;
      if (newStatus === "Serving") return { ...item, status: newStatus, serviceStartTime: new Date().toISOString() };
      return { ...item, status: newStatus };
    });

    const success = await updateQueues(newQueues);
    if (!success) {
      showToast("อัปเดตไม่สำเร็จ", "error");
      return;
    }

    showToast("อัปเดตสถานะสำเร็จ", "success");
    if (!q.lineUserId) return;

    if (newStatus === "Waiting") {
      sendLineNotification(q.lineUserId, `ยืนยันการจองสำเร็จ (${q.id})\nวันที่: ${q.bookingDate}\nเวลา: ${q.bookingTime}\nเบอร์โทร: ${q.phone || "-"}`);
    } else if (newStatus === "Serving") {
      sendLineNotification(q.lineUserId, `ถึงคิวของคุณแล้ว (${q.id})\nกรุณามาที่จุดให้บริการค่ะ`);
    } else if (newStatus === "Completed") {
      sendLineNotification(q.lineUserId, `ขอบคุณที่ใช้บริการค่ะ (${q.id})`);
    } else if (newStatus === "Cancelled") {
      sendLineNotification(q.lineUserId, `คิวของคุณถูกยกเลิก (${q.id})`);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQueue) return;

    const newQueues = queues.map((item) => (item.id === editingQueue.id ? editingQueue : item));
    if (await updateQueues(newQueues)) {
      showToast("แก้ไขข้อมูลสำเร็จ", "success");
      setEditingQueue(null);
    } else {
      showToast("เกิดข้อผิดพลาด", "error");
    }
  };

  const handleCheckbox = async (id: string, field: "isPaid" | "isDepositPaid", val: boolean) => {
    const newQueues = queues.map((item) => (item.id === id ? { ...item, [field]: val } : item));
    const success = await updateQueues(newQueues);
    showToast(success ? "อัปเดตสำเร็จ" : "อัปเดตไม่สำเร็จ", success ? "success" : "error");
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    if (await updateSettings({ ...settings, staffLineIds: staffLineIdsDraft })) showToast("บันทึกการตั้งค่าสำเร็จ", "success");
    else showToast("บันทึกการตั้งค่าไม่สำเร็จ", "error");
  };

  const openEdit = (q: QueueItem) => {
    setEditingQueue({
      ...q,
      discount: q.discount || "",
      actualPrice: q.actualPrice ?? calculateActualPrice(q.course, q.discount),
    });
  };

  const renderActions = (q: QueueItem) => (
    <div className="flex flex-wrap items-center gap-2">
      {q.status === "Serving" && q.serviceStartTime && (
        <ServiceTimer startTime={q.serviceStartTime} course={q.course} onComplete={() => handleUpdateStatus(q.id, "Completed")} />
      )}
      {q.status === "Pending" && (
        <>
          <button onClick={() => handleUpdateStatus(q.id, "Waiting")} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-blue-600 px-3 text-xs font-bold text-white hover:bg-blue-700">
            <Check size={15} /> Confirm
          </button>
          <button onClick={() => handleUpdateStatus(q.id, "Cancelled")} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 text-xs font-bold text-red-700 hover:bg-red-50">
            <X size={15} /> Reject
          </button>
        </>
      )}
      {q.status === "Waiting" && (
        <>
          <button onClick={() => handleUpdateStatus(q.id, "Serving")} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-green-700 px-3 text-xs font-bold text-white hover:bg-green-800">
            <Play size={15} /> Start
          </button>
          <button onClick={() => handleUpdateStatus(q.id, "Cancelled")} className="inline-flex h-9 items-center rounded-md border border-red-200 bg-white px-3 text-xs font-bold text-red-700 hover:bg-red-50">
            Cancel
          </button>
        </>
      )}
      {q.status === "Serving" && (
        <>
          <button onClick={() => handleUpdateStatus(q.id, "Completed")} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[var(--color-dark-brown)] px-3 text-xs font-bold text-white hover:bg-[#2c231e]">
            <CheckCircle2 size={15} /> Done
          </button>
          <button onClick={() => handleUpdateStatus(q.id, "Cancelled")} className="inline-flex h-9 items-center rounded-md border border-red-200 bg-white px-3 text-xs font-bold text-red-700 hover:bg-red-50">
            Cancel
          </button>
        </>
      )}
      {!["Completed", "Cancelled", "Archived"].includes(q.status) && (
        <button onClick={() => openEdit(q)} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--color-light-brown)] bg-white px-3 text-xs font-bold text-[var(--color-primary-brown)] hover:bg-[#F8F4EE]">
          <Edit3 size={14} /> Edit
        </button>
      )}
    </div>
  );

const renderQueueCard = (q: QueueItem) => {
  const inactive = ["Completed", "Cancelled", "Archived"].includes(q.status);

  return (
    <div
      key={q.id}
      className={`rounded-lg border bg-white shadow-sm ${
        q.status === "Pending"
          ? "border-blue-300"
          : "border-[var(--color-light-brown)]"
      } ${inactive ? "opacity-75" : ""}`}
    >
      <div className="flex flex-col gap-3 border-b border-[#E5DFD4] px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-md bg-[#F8F4EE] font-mono text-sm font-bold text-[var(--color-dark-brown)]">
            {q.id}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-base font-bold text-[var(--color-dark-brown)]">
                {q.nickname || "ไม่ระบุชื่อ"}
              </h3>
              <StatusBadge status={q.status} />
            </div>

            <div className="mt-1 text-xs text-[#847568]">
              {q.bookingDate} · {q.bookingTime} · {q.phone || "-"} ·{" "}
              {q.gender || "-"}
            </div>
          </div>
        </div>

        {renderActions(q)}
      </div>

      <div className="grid gap-3 px-4 py-3 md:grid-cols-[1fr_auto]">
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 lg:grid-cols-8">
          <div>
            <div className="text-[11px] font-bold uppercase text-[#847568]">
              Course
            </div>
            <div className="font-semibold">{q.course || "-"}</div>
          </div>

          <div>
            <div className="text-[11px] font-bold uppercase text-[#847568]">
              Price
            </div>
            <div className="font-semibold text-green-700">
              {money(q.actualPrice)}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-bold uppercase text-[#847568]">
              Gender
            </div>
            <div className="font-semibold">{q.gender || "-"}</div>
          </div>

          <div>
            <div className="text-[11px] font-bold uppercase text-[#847568]">
              Water
            </div>
            <div className="truncate font-semibold">
              {q.waterTemp || "-"}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-bold uppercase text-[#847568]">
              Oil
            </div>
            <div className="truncate font-semibold">{q.oil || "-"}</div>
          </div>

          <div>
            <div className="text-[11px] font-bold uppercase text-[#847568]">
              Shampoo
            </div>
            <div className="truncate font-semibold">
              {q.shampoo || "-"}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-bold uppercase text-[#847568]">
              Massage
            </div>
            <div className="truncate font-semibold">
              {q.massagePressure || "-"}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-bold uppercase text-[#847568]">
              Head
            </div>
            <div className="truncate font-semibold">
              {q.headPressure || "-"}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 md:justify-end">
          <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-[#E5DFD4] bg-[#FAF8F5] px-3 text-xs font-semibold">
            <input
              type="checkbox"
              checked={q.isDepositPaid}
              onChange={(e) =>
                handleCheckbox(q.id, "isDepositPaid", e.target.checked)
              }
              className="h-4 w-4"
            />
            มัดจำแล้ว
          </label>

          <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-[#E5DFD4] bg-[#FAF8F5] px-3 text-xs font-semibold">
            <input
              type="checkbox"
              checked={q.isPaid}
              onChange={(e) =>
                handleCheckbox(q.id, "isPaid", e.target.checked)
              }
              className="h-4 w-4"
            />
            จ่ายครบ
          </label>
        </div>
      </div>

      {(q.caution || q.internalNote) && (
        <div className="grid gap-2 border-t border-[#E5DFD4] bg-[#FFFDF9] px-4 py-3 text-sm sm:grid-cols-2">
          {q.caution && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700">
              ⚠️ ข้อควรระวัง: {q.caution}
            </div>
          )}

          {q.internalNote && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
              📝 โน้ตพนักงาน: {q.internalNote}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

  const renderTable = (list: QueueItem[], emptyText: string) => (
    <div className="overflow-x-auto rounded-lg border border-[var(--color-light-brown)] bg-white shadow-sm">
      <table className="min-w-[900px] w-full divide-y divide-[#E5DFD4] text-sm">
        <thead className="bg-[#F8F4EE] text-left text-xs uppercase text-[#847568]">
          <tr>
            <th className="px-4 py-3">ID</th>
            <th className="px-4 py-3">ลูกค้า</th>
            <th className="px-4 py-3">คอร์ส</th>
            <th className="px-4 py-3">วันเวลา</th>
            <th className="px-4 py-3">ราคา</th>
            <th className="px-4 py-3">สถานะ</th>
            <th className="px-4 py-3">ชำระเงิน</th>
            <th className="px-4 py-3">จัดการ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E5DFD4]">
          {list.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-4 py-8 text-center text-[#847568]">{emptyText}</td>
            </tr>
          ) : (
            list.map((q) => (
              <tr key={q.id} className="align-top even:bg-[#FAF8F5]">
                <td className="px-4 py-3 font-mono font-bold">{q.id}</td>
                <td className="px-4 py-3">
                  <div className="font-semibold text-[var(--color-dark-brown)]">{q.nickname}</div>
                  <div className="text-xs text-[#847568]">{q.phone || "-"}</div>
                </td>
                <td className="px-4 py-3">{q.course}</td>
                <td className="px-4 py-3">
                  <div>{q.bookingDate}</div>
                  <div className="text-xs text-[#847568]">{q.bookingTime}</div>
                </td>
                <td className="px-4 py-3 font-semibold text-green-700">{money(q.actualPrice)}</td>
                <td className="px-4 py-3"><StatusBadge status={q.status} /></td>
                <td className="px-4 py-3 text-xs">
                  <div>{q.isDepositPaid ? "มัดจำแล้ว" : "ยังไม่มัดจำ"}</div>
                  <div>{q.isPaid ? "จ่ายครบ" : "ยังไม่ครบ"}</div>
                </td>
                <td className="px-4 py-3">{renderActions(q)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  const renderModeSwitch = (mode: ViewMode, setMode: (mode: ViewMode) => void) => (
    <div className="inline-flex rounded-md border border-[var(--color-light-brown)] bg-white p-1">
      {(["card", "list"] as ViewMode[]).map((option) => (
        <button
          key={option}
          onClick={() => setMode(option)}
          className={`h-8 rounded px-3 text-xs font-bold ${mode === option ? "bg-[var(--color-primary-brown)] text-white" : "text-[#847568] hover:bg-[#F8F4EE]"}`}
        >
          {option === "card" ? "Cards" : "List"}
        </button>
      ))}
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-3 pb-12 pt-4 sm:px-4">
      <div className="mb-4 flex flex-col gap-3 border-b border-[var(--color-light-brown)] pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase text-[#847568]">
            <LayoutDashboard size={16} />
            Admin Console
          </div>
          <h2 className="mt-1 text-2xl font-bold text-[var(--color-dark-brown)]">Staff Dashboard</h2>
          <p className="mt-1 text-sm text-[#847568]">จัดการคิว ยืนยันการจอง และดูยอดขายประจำวัน</p>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[var(--color-light-brown)] bg-white px-4 text-sm font-bold text-[var(--color-primary-brown)] shadow-sm hover:bg-[#F8F4EE]"
        >
          <Settings size={16} />
          Settings
        </button>
      </div>

      {showSettings && (
        <form onSubmit={handleSaveSettings} className="mb-4 rounded-lg border border-[var(--color-light-brown)] bg-white p-4 shadow-sm">
          <h3 className="text-sm font-bold text-[var(--color-dark-brown)]">System Configuration</h3>
          <label className="mt-4 block text-xs font-bold text-[#847568]">แจ้งเตือนพนักงาน (LINE User ID)</label>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <input
                key={i}
                type="text"
                value={staffLineIdsDraft[i] || ""}
                onChange={(e) => {
                  const newIds = [...staffLineIdsDraft];
                  newIds[i] = e.target.value;
                  setStaffLineIdsDraft(newIds);
                }}
                className="glass-input !rounded-md !py-2 text-sm"
                placeholder={`Staff ${i + 1}`}
              />
            ))}
          </div>
          <button type="submit" className="mt-3 inline-flex h-10 items-center rounded-md bg-[var(--color-dark-brown)] px-4 text-sm font-bold text-white">
            Save Settings
          </button>
        </form>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="รายได้วันนี้" value={money(revenueToday)} detail="เฉพาะคิวที่จ่ายครบ" tone="green" />
        <MetricCard label="เสร็จวันนี้" value={completedToday} detail="จำนวนคิวที่ปิดงานแล้ว" />
        <MetricCard label="รอยืนยัน" value={pendings.length} detail="คำขอที่ต้องตรวจ" tone="blue" />
        <MetricCard label="รอรับบริการ" value={waitings.length} detail="ลูกค้าพร้อมเข้ารับบริการ" tone="amber" />
      </div>

      <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_280px]">
        <div className="rounded-lg border border-[var(--color-light-brown)] bg-[var(--color-dark-brown)] p-4 text-white shadow-sm">
          <div className="flex items-center gap-2 text-xs font-bold uppercase text-white/70">
            <Wallet size={16} />
            Now Serving
          </div>
          <div className="mt-2 flex items-end gap-3">
            <div className="text-4xl font-bold">{servings.length}/3</div>
            <div className="pb-1 text-sm text-white/75">{servings.length ? servings.map((s) => s.id).join(", ") : "ยังไม่มีคิวที่กำลังให้บริการ"}</div>
          </div>
        </div>
        <div className="rounded-lg border border-[var(--color-light-brown)] bg-white p-4 shadow-sm">
          <div className="text-xs font-bold uppercase text-[#847568]">Next In Line</div>
          {nextWaiting ? (
            <div className="mt-2">
              <div className="text-xl font-bold text-[var(--color-dark-brown)]">{nextWaiting.id}</div>
              <div className="text-sm font-semibold">{nextWaiting.nickname} · {nextWaiting.course}</div>
              <div className="text-xs text-[#847568]">{nextWaiting.bookingDate} · {nextWaiting.bookingTime}</div>
            </div>
          ) : (
            <div className="mt-3 text-sm text-[#847568]">ไม่มีคิวรอรับบริการ</div>
          )}
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-[var(--color-light-brown)] bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#847568]" size={17} />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหา ID, ชื่อ, เบอร์, สถานะ..."
              className="glass-input !rounded-md !py-2.5 !pl-10 text-sm"
            />
          </div>
          <button onClick={() => setSearchTerm("")} className="inline-flex h-10 items-center justify-center rounded-md border border-[var(--color-light-brown)] px-3 text-sm font-bold text-[var(--color-dark-brown)] hover:bg-[#F8F4EE]">
            Clear
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1 text-xs font-bold uppercase text-[#847568]">
            <ListFilter size={15} />
            Status
          </div>
          {statusOptions.map((option) => (
            <button
              key={option}
              onClick={() => setStatusFilter(option)}
              className={`h-8 rounded-full px-3 text-xs font-bold ${statusFilter === option ? "bg-[var(--color-primary-brown)] text-white" : "border border-[#E5DFD4] bg-white text-[var(--color-dark-brown)] hover:bg-[#F8F4EE]"}`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-4 gap-1 rounded-lg border border-[var(--color-light-brown)] bg-white p-1 shadow-sm">
        {[
          { key: "walkin", label: "Walk-in", icon: SlidersHorizontal },
          { key: "timeline", label: "Timeline", icon: Clock },
          { key: "history", label: "History", icon: History },
          { key: "stats", label: "Dashboard", icon: LayoutDashboard },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key as AdminTab)}
            className={`inline-flex h-10 items-center justify-center gap-2 rounded-md px-2 text-xs font-bold sm:text-sm ${tab === key ? "bg-[var(--color-primary-brown)] text-white shadow-sm" : "text-[#847568] hover:bg-[#F8F4EE]"}`}
          >
            <Icon size={16} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {tab === "walkin" && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            {renderModeSwitch(walkinView, setWalkinView)}
            <div className="text-xs font-semibold text-[#847568]">{filteredWalkin.length} records</div>
          </div>
          {walkinView === "card" ? (
            <div className="space-y-3">{filteredWalkin.length ? filteredWalkin.map(renderQueueCard) : <div className="rounded-lg border border-[var(--color-light-brown)] bg-white py-8 text-center text-sm text-[#847568]">ไม่มีคิว Walk-in</div>}</div>
          ) : (
            renderTable(filteredWalkin, "ไม่มีคิว Walk-in")
          )}
        </section>
      )}

      {tab === "timeline" && <AdminTimeline queues={queues} />}
      {tab === "stats" && <AdminStats queues={queues} />}

      {tab === "history" && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            {renderModeSwitch(historyView, setHistoryView)}
            <div className="text-xs font-semibold text-[#847568]">{filteredHistory.length} records</div>
          </div>
          {historyView === "card" ? (
            <div className="space-y-3">{filteredHistory.length ? filteredHistory.map(renderQueueCard) : <div className="rounded-lg border border-[var(--color-light-brown)] bg-white py-8 text-center text-sm text-[#847568]">ไม่มีประวัติ</div>}</div>
          ) : (
            renderTable(filteredHistory, "ไม่มีประวัติ")
          )}
        </section>
      )}

      {editingQueue && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-lg border border-[var(--color-light-brown)] bg-[var(--color-bg-cream)] p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-[var(--color-dark-brown)]">Edit Queue</h3>
              <button onClick={() => setEditingQueue(null)} className="rounded-md p-2 text-[#847568] hover:bg-white hover:text-red-600">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="text-xs font-bold text-[#847568]">
                  Nickname
                  <input type="text" value={editingQueue.nickname} onChange={(e) => setEditingQueue({ ...editingQueue, nickname: e.target.value })} className="glass-input mt-1 !rounded-md bg-white text-sm" />
                </label>
                <label className="text-xs font-bold text-[#847568]">
                  Phone
                  <input type="tel" value={editingQueue.phone} onChange={(e) => setEditingQueue({ ...editingQueue, phone: e.target.value })} className="glass-input mt-1 !rounded-md bg-white text-sm" />
                </label>
                <label className="text-xs font-bold text-[#847568]">
                  Date
                  <input type="date" value={editingQueue.bookingDate} onChange={(e) => setEditingQueue({ ...editingQueue, bookingDate: e.target.value })} className="glass-input mt-1 !rounded-md bg-white text-sm" />
                </label>
                <label className="text-xs font-bold text-[#847568]">
                  Time
                  <input type="time" value={editingQueue.bookingTime} onChange={(e) => setEditingQueue({ ...editingQueue, bookingTime: e.target.value })} className="glass-input mt-1 !rounded-md bg-white text-sm" />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="text-xs font-bold text-[#847568]">
                  Course
                  <select
                    value={editingQueue.course}
                    onChange={(e) => {
                      const course = e.target.value;
                      setEditingQueue({ ...editingQueue, course, actualPrice: calculateActualPrice(course, editingQueue.discount) });
                    }}
                    className="glass-input mt-1 !rounded-md bg-white text-sm"
                  >
                    <option value="60 min">60 min</option>
                    <option value="90 min">90 min</option>
                  </select>
                </label>
                <label className="text-xs font-bold text-[#847568]">
                  ส่วนลด
                  <input
                    type="text"
                    value={editingQueue.discount || ""}
                    onChange={(e) => {
                      const discount = e.target.value;
                      setEditingQueue({ ...editingQueue, discount, actualPrice: calculateActualPrice(editingQueue.course, discount) });
                    }}
                    className="glass-input mt-1 !rounded-md bg-white text-sm"
                    placeholder="10% หรือ 50"
                  />
                </label>
                <label className="text-xs font-bold text-[#847568]">
                  ยอดจ่ายจริง (฿)
                  <input type="number" value={editingQueue.actualPrice || 0} onChange={(e) => setEditingQueue({ ...editingQueue, actualPrice: parseFloat(e.target.value) || 0 })} className="glass-input mt-1 !rounded-md bg-white text-sm font-bold text-green-700" />
                </label>
              </div>

              <label className="block text-xs font-bold text-[#847568]">
                Internal Note
                <textarea value={editingQueue.internalNote || ""} onChange={(e) => setEditingQueue({ ...editingQueue, internalNote: e.target.value })} rows={3} className="glass-input mt-1 !rounded-md bg-white text-sm" />
              </label>

              <button type="submit" className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-green-700 text-sm font-bold text-white hover:bg-green-800">
                <Check size={17} />
                Save Changes
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
