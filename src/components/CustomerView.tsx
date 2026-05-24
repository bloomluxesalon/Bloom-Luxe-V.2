import React, { useEffect, useState } from "react";
import { format } from "date-fns";
import { useAppContext } from "../lib/AppContext";
import { MAX_CONCURRENT_BOOKINGS, SERVICE_PRICES } from "../lib/utils";
import { showToast } from "./Toast";
import { sendLineNotification } from "../lib/api";

declare const liff: any;

export function CustomerView() {
  const { queues, settings, updateQueues } = useAppContext();
  const [isSuccess, setIsSuccess] = useState(false);
  const formType = "walkin";

  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [lineUserId, setLineUserId] = useState<string | null>(null);
  const [liffProfile, setLiffProfile] = useState<{
    displayName: string;
    pictureUrl: string;
  } | null>(null);

  const [course, setCourse] = useState("60 min");
  const [gender, setGender] = useState("Male");
  const [waterTemp, setWaterTemp] = useState("Warm");
  const [oil, setOil] = useState("Jasmine Rice");
  const [shampoo, setShampoo] = useState("Chance rich");
  const [massagePressure, setMassagePressure] = useState("Medium");
  const [headPressure, setHeadPressure] = useState("Medium");
  const [caution, setCaution] = useState("");

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const [bookingDate, setBookingDate] = useState("");
  const [bookingTime, setBookingTime] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

useEffect(() => {
  async function initLiff() {
    try {
      if (typeof liff === "undefined") {
        console.error("LIFF SDK not loaded");
        return;
      }

      await liff.init({
        liffId: "2009162443-gCuBKaOD",
      });

      console.log("LIFF READY");
      console.log("isInClient:", liff.isInClient());
      console.log("isLoggedIn:", liff.isLoggedIn());

      // เปิดจาก browser ปกติ
      // ไม่ต้อง login LINE
      if (!liff.isInClient()) {
        console.log("Normal browser mode");
        return;
      }

      // เปิดจาก LINE แต่ยังไม่ได้ login
      if (!liff.isLoggedIn()) {
        liff.login();
        return;
      }

      // ดึง profile LINE
      const profile = await liff.getProfile();

      console.log("LINE PROFILE:", profile);

      setNickname(profile.displayName || "");

      setLineUserId(profile.userId || null);

      setLiffProfile({
        displayName: profile.displayName || "",
        pictureUrl: profile.pictureUrl || "",
      });

    } catch (error) {
      console.error("LIFF ERROR:", error);
    }
  }

  initLiff();
}, []);

  const getOccupiedSlots = (dateStr: string) =>
    queues
      .filter(
        (q) =>
          q.bookingDate === dateStr &&
          ["Waiting", "Serving", "Pending"].includes(q.status)
      )
      .map((q) => {
        const [hh = "0", mm = "0"] = (q.bookingTime || "00:00").split(":");
        const h = parseInt(hh, 10);
        const m = parseInt(mm, 10);
        const start = h * 60 + m;
        const dur = q.course.includes("90") ? 90 : 60;
        return { start, end: start + dur };
      });

  const getAvailableTimeOptions = () => {
    if (!bookingDate) return [];

    const occupied = getOccupiedSlots(bookingDate);
    const interval = 30;
    const isToday = bookingDate === todayStr;
    const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
    const duration = course.includes("90") ? 90 : 60;
    const slots: string[] = [];

    for (let time = 0; time <= 24 * 60 - duration; time += interval) {
      if (isToday && time <= nowMins) continue;

      let maxOverlap = 0;

      for (
        let checkTime = time;
        checkTime < time + duration;
        checkTime += interval
      ) {
        const overlap = occupied.filter(
          (o) => checkTime < o.end && checkTime + interval > o.start
        ).length;

        if (overlap > maxOverlap) maxOverlap = overlap;
      }

      if (maxOverlap >= MAX_CONCURRENT_BOOKINGS) continue;

      slots.push(
        `${Math.floor(time / 60).toString().padStart(2, "0")}:${(time % 60)
          .toString()
          .padStart(2, "0")}`
      );
    }

    return slots;
  };

  const availableTimeOptions = getAvailableTimeOptions();

  const staffLineIds = (settings?.staffLineIds || [])
    .map((id) => id.trim())
    .filter(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!bookingDate) {
      return showToast("Please select booking date / กรุณาเลือกวันที่จอง", "error");
    }

    if (!bookingTime) {
      return showToast("Please select booking time / กรุณาเลือกเวลาจอง", "error");
    }

    if (!availableTimeOptions.includes(bookingTime)) {
      return showToast("Selected time is unavailable / เวลาที่เลือกไม่ว่าง", "error");
    }

    setIsSubmitting(true);

    const maxId = queues.reduce(
      (max, q) => Math.max(max, parseInt(q.id.replace(/\D/g, ""), 10) || 0),
      0
    );

    const newId = "Q-" + String(maxId + 1).padStart(3, "0");

    const defaultPrice = course.includes("90")
      ? SERVICE_PRICES["90 min"]
      : SERVICE_PRICES["60 min"];

    const newQueue = {
      id: newId,
      orderType: formType,
      nickname,
      phone,
      course,
      bookingDate,
      bookingTime,
      gender,
      waterTemp,
      oil,
      shampoo,
      massagePressure,
      headPressure,
      caution,
      status: "Waiting" as const,
      timestamp: new Date().toISOString(),
      isPaid: false,
      isDepositPaid: false,
      actualPrice: defaultPrice,
      lineUserId: lineUserId || undefined,
      lineDisplayName: liffProfile?.displayName || nickname,
      linePictureUrl: liffProfile?.pictureUrl || "",
    };

    const success = await updateQueues([...queues, newQueue]);

    if (success) {
      localStorage.setItem("bloom_my_queue_id", newId);
      localStorage.setItem("bloom_my_queue_status", "Waiting");

      if (lineUserId) {
        await sendLineNotification(
          lineUserId,
          `✅ จองสำเร็จค่ะ\n\n` +
            `เลขคิว: ${newId}\n` +
            `ชื่อ: ${nickname}\n` +
            `เบอร์โทร: ${phone}\n` +
            `วันที่: ${bookingDate}\n` +
            `เวลา: ${bookingTime}\n` +
            `คอร์ส: ${course}\n\n` +
            `ขอบคุณที่ใช้บริการ Bloom Luxe Salon 🌸`
        );
      }

      const staffMessage =
        `🔔 มีคิวจองใหม่ ${newId}\n\n` +
        `👤 ลูกค้า: ${nickname}\n` +
        `📞 เบอร์: ${phone}\n` +
        `📅 วันที่: ${bookingDate}\n` +
        `⏰ เวลา: ${bookingTime}\n` +
        `🧾 คอร์ส: ${course}`;

      staffLineIds.forEach((staffId) => {
        sendLineNotification(staffId, staffMessage);
      });

      setIsSuccess(true);
    } else {
      showToast("Failed to save booking / บันทึกการจองไม่สำเร็จ", "error");
    }

    setIsSubmitting(false);
  };

  if (isSuccess) {
    return (
      <div className="max-w-2xl mx-auto px-4 pb-20 pt-16 text-center animate-slide-in">
        <div className="glass-panel p-8 rounded-3xl inline-block max-w-sm">
          <div className="text-6xl mb-4">✅</div>

          <h2 className="text-2xl font-bold text-[#15803D] mb-2">
            Success / สำเร็จ
          </h2>

          <p className="text-[#847568] font-medium text-sm">
            Booking saved successfully / บันทึกข้อมูลเรียบร้อยแล้ว
          </p>

          <button
            onClick={() => window.location.reload()}
            className="mt-8 px-6 py-3 bg-[var(--color-primary-brown)] text-white rounded-xl font-bold shadow-md w-full"
          >
            New Booking / จองคิวใหม่
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pb-20 pt-6 animate-slide-in w-full">
      <div className="glass-panel rounded-3xl p-5 md:p-6 mb-6 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[var(--color-primary-brown)] to-[var(--color-light-brown)]" />

        <h2 className="text-xl font-bold text-[var(--color-dark-brown)] mb-1">
          BLOOM LUXE SALON
        </h2>

        <p className="text-[#847568] text-sm font-bold text-[var(--color-primary-brown)] bg-white/60 inline-block px-3 py-1 rounded-full border border-[var(--color-primary-brown)]/20 mt-1">
          Service Details / รายละเอียดการบริการ
        </p>

        {liffProfile && (
          <div className="mt-3 flex items-center justify-center gap-2">
            {liffProfile.pictureUrl && (
              <img
                src={liffProfile.pictureUrl}
                className="w-7 h-7 rounded-full border border-[var(--color-light-brown)] object-cover"
                alt="LINE Profile"
              />
            )}

            <span className="text-sm text-[#6B5C50] font-medium">
              Hi / สวัสดี {liffProfile.displayName}
            </span>
          </div>
        )}
      </div>

      <div className="glass-panel rounded-3xl p-5 md:p-8 shadow-xl animate-slide-in w-full">
        <form onSubmit={handleSubmit} className="space-y-6 md:space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[#5A4A3D] font-medium text-sm mb-2">
                Nickname / ชื่อเล่น
              </label>
              <input
                required
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="glass-input"
                placeholder="Enter your nickname / กรอกชื่อเล่น"
              />
            </div>

            <div>
              <label className="block text-[#5A4A3D] font-medium text-sm mb-2">
                Phone Number / เบอร์โทรศัพท์
              </label>
              <input
                required
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="glass-input"
                placeholder="08xxxxxxxx"
              />
            </div>
          </div>

          <div>
            <label className="block text-[#5A4A3D] font-medium text-sm mb-3">
              Duration (Course) / คอร์สบริการ
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="radio-box flex-1">
                <input
                  type="radio"
                  checked={course === "60 min"}
                  onChange={() => setCourse("60 min")}
                  className="accent-[var(--color-primary-brown)]"
                />
                <span className="text-xs">
                  Origin 60 min / คอร์สปกติ 60 นาที
                </span>
              </label>

              <label className="radio-box flex-1">
                <input
                  type="radio"
                  checked={course === "90 min"}
                  onChange={() => setCourse("90 min")}
                  className="accent-[var(--color-primary-brown)]"
                />
                <span className="text-xs">
                  Premium 90 min / คอร์สพรีเมียม 90 นาที
                </span>
              </label>
            </div>
          </div>

          <div className="bg-white/40 border border-[var(--color-light-brown)] rounded-2xl p-4 md:p-5 relative overflow-hidden shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2 text-[var(--color-primary-brown)]">
                <span className="text-xl">📅</span>
                <span className="font-bold text-sm">
                  Select Date & Time / เลือกวันและเวลา
                </span>
              </div>

              <span className="text-[10px] font-medium text-[#847568] bg-[var(--color-bg-cream)] px-2 py-1 rounded-md border border-[var(--color-light-brown)]">
                24 Hours
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="min-w-0">
                <label className="block text-[#847568] text-xs mb-1.5 ml-1">
                  Date / วันที่
                </label>

                <div className="min-w-0 w-full overflow-hidden rounded-xl">
                  <input
                    required
                    type="date"
                    value={bookingDate}
                    min={todayStr}
                    onChange={(e) => {
                      setBookingDate(e.target.value);
                      setBookingTime("");
                    }}
                    className="glass-input h-12 bg-white/60 min-w-0 w-full max-w-full box-border"
                  />
                </div>
              </div>

              <div className="md:col-span-2 min-w-0">
                <label className="block text-[#847568] text-xs mb-2 ml-1">
                  Time / เวลา
                </label>

                <div className="min-w-0 w-full overflow-hidden rounded-xl">
                  <input
                    required
                    type="time"
                    step={1800}
                    value={bookingTime}
                    disabled={!bookingDate}
                    onChange={(e) => setBookingTime(e.target.value)}
                    className="glass-input h-12 bg-white/60 min-w-0 w-full max-w-full box-border disabled:opacity-60"
                  />
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[#5A4A3D] font-medium text-sm mb-2">
              Gender / เพศ
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="radio-box flex-1">
                <input
                  type="radio"
                  checked={gender === "Male"}
                  onChange={() => setGender("Male")}
                  className="accent-[var(--color-primary-brown)]"
                />
                <span>Male / ชาย</span>
              </label>

              <label className="radio-box flex-1">
                <input
                  type="radio"
                  checked={gender === "Female"}
                  onChange={() => setGender("Female")}
                  className="accent-[var(--color-primary-brown)]"
                />
                <span>Female / หญิง</span>
              </label>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-[#5A4A3D] font-medium text-sm mb-3">
                Water Temperature / อุณหภูมิน้ำ
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="radio-box flex-1">
                  <input
                    type="radio"
                    checked={waterTemp === "Warm"}
                    onChange={() => setWaterTemp("Warm")}
                    className="accent-[var(--color-primary-brown)]"
                  />
                  <span>Warm / อุ่น</span>
                </label>

                <label className="radio-box flex-1">
                  <input
                    type="radio"
                    checked={waterTemp === "Cold"}
                    onChange={() => setWaterTemp("Cold")}
                    className="accent-[var(--color-primary-brown)]"
                  />
                  <span>Cold / เย็น</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-[#5A4A3D] font-medium text-sm mb-3">
                Signature Oil Massage / น้ำมันนวดซิกเนเจอร์
              </label>

              <div className="grid grid-cols-2 gap-3">
                {["Jasmine Rice", "White Tea", "Marigold", "Orchid"].map(
                  (item) => (
                    <label key={item} className="radio-box">
                      <input
                        type="radio"
                        checked={oil === item}
                        onChange={() => setOil(item)}
                        className="accent-[var(--color-primary-brown)]"
                      />
                      <span className="text-xs">{item}</span>
                    </label>
                  )
                )}

                <label className="radio-box col-span-2 justify-center border-dashed bg-white/40">
                  <input
                    type="radio"
                    checked={oil === "Choose at shop"}
                    onChange={() => setOil("Choose at shop")}
                    className="accent-[var(--color-primary-brown)]"
                  />
                  <span className="text-[var(--color-primary-brown)] text-xs font-semibold">
                    Choose at shop / เลือกที่ร้าน
                  </span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-[#5A4A3D] font-medium text-sm mb-3">
                The Scent of Shampoo / กลิ่นแชมพู
              </label>

              <div className="grid grid-cols-2 gap-3">
                {["Chance rich", "Honey sunset", "Pink Gold"].map((item) => (
                  <label key={item} className="radio-box">
                    <input
                      type="radio"
                      checked={shampoo === item}
                      onChange={() => setShampoo(item)}
                      className="accent-[var(--color-primary-brown)]"
                    />
                    <span className="text-xs">{item}</span>
                  </label>
                ))}

                <label className="radio-box border-dashed bg-white/40">
                  <input
                    type="radio"
                    checked={shampoo === "Choose at shop"}
                    onChange={() => setShampoo("Choose at shop")}
                    className="accent-[var(--color-primary-brown)]"
                  />
                  <span className="text-[var(--color-primary-brown)] text-xs font-semibold">
                    Choose at shop / เลือกที่ร้าน
                  </span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-[#5A4A3D] font-medium text-sm mb-3">
                Massage Pressure / ระดับแรงนวด
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  ["Gentle", "Gentle / เบา"],
                  ["Medium", "Medium / กลาง"],
                  ["Strong", "Strong / หนัก"],
                ].map(([value, label]) => (
                  <label key={value} className="radio-box flex-1">
                    <input
                      type="radio"
                      checked={massagePressure === value}
                      onChange={() => setMassagePressure(value)}
                      className="accent-[var(--color-primary-brown)]"
                    />
                    <span className="text-[11px] sm:text-xs">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[#5A4A3D] font-medium text-sm mb-3">
                Hair Wash Pressure / ระดับน้ำหนักมือตอนสระ
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  ["Gentle", "Gentle / เบา"],
                  ["Medium", "Medium / กลาง"],
                  ["Strong", "Strong / หนัก"],
                ].map(([value, label]) => (
                  <label key={value} className="radio-box flex-1">
                    <input
                      type="radio"
                      checked={headPressure === value}
                      onChange={() => setHeadPressure(value)}
                      className="accent-[var(--color-primary-brown)]"
                    />
                    <span className="text-[11px] sm:text-xs">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[#5A4A3D] font-medium text-sm mb-2">
                Special Caution Areas / จุดที่ต้องระวังเป็นพิเศษ
              </label>

              <textarea
                rows={2}
                value={caution}
                onChange={(e) => setCaution(e.target.value)}
                className="glass-input w-full"
                placeholder="e.g. Surgery wound, Sensitive skin / เช่น แผลผ่าตัด, ผิวแพ้ง่าย"
              />
            </div>
          </div>

          <button
            disabled={isSubmitting}
            type="submit"
            className="w-full py-4 rounded-xl font-bold text-white text-lg bg-gradient-to-r from-[var(--color-primary-brown)] to-[#705C4D] shadow-lg shadow-[var(--color-primary-brown)]/30 transition-all hover:scale-[1.02] disabled:opacity-75"
          >
            {isSubmitting
              ? "Requesting... / กำลังส่งคำขอ..."
              : "Select Details / ยืนยัน"}
          </button>
        </form>
      </div>
    </div>
  );
}
