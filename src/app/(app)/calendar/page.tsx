"use client";

import { useState, useMemo } from "react";
import { appointments, apptTypeColor, apptTypeLabel, type AppointmentMock } from "@/lib/mock";
import { ChevronLeft, ChevronRight, Clock, MapPin, CalendarDays, CalendarCheck } from "lucide-react";

// ── Tokens (CI) ───────────────────────────────────────────────
const PRIMARY = "#003366";
const BORDER  = "#e5e7eb";
const MUTED   = "#6b7280";

const THAI_DAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const THAI_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const TODAY = "2026-06-24";

function ymd(y: number, m: number, d: number) { return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`; }

export default function CalendarPage() {
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(5); // June
  const [selectedDate, setSelectedDate] = useState<string>(TODAY);

  const byDate = useMemo(() => {
    const map: Record<string, AppointmentMock[]> = {};
    appointments.forEach(a => { (map[a.date] ??= []).push(a); });
    return map;
  }, []);

  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  function prevMonth() { let m = month - 1, y = year; if (m < 0) { m = 11; y--; } setMonth(m); setYear(y); }
  function nextMonth() { let m = month + 1, y = year; if (m > 11) { m = 0; y++; } setMonth(m); setYear(y); }

  const selectedAppts = (byDate[selectedDate] ?? []).sort((a, b) => a.time.localeCompare(b.time));
  const upcoming = useMemo(() =>
    [...appointments].filter(a => a.date >= TODAY && a.status === "upcoming").sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).slice(0, 5)
  , []);

  const monthAppts = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
    return appointments.filter(a => a.date.startsWith(prefix));
  }, [year, month]);
  const monthUpcoming = monthAppts.filter(a => a.status === "upcoming").length;
  const monthDays = new Set(monthAppts.map(a => a.date)).size;

  return (
    <div className="erp">
      {/* Header */}
      <div className="page-head">
        <div>
          <h2>ปฏิทิน</h2>
          <p>นัดหมายและกิจกรรมการขายของคุณ</p>
        </div>
      </div>

      {/* Summary KPI bar */}
      <div className="kpi-bar">
        <div className="kpi">
          <div className="kpi-icon kpi-navy"><CalendarDays size={18} /></div>
          <div><div className="kpi-val">{monthAppts.length}</div><div className="kpi-label">นัดหมายเดือนนี้</div></div>
        </div>
        <div className="kpi">
          <div className="kpi-icon kpi-amber"><CalendarCheck size={18} /></div>
          <div><div className="kpi-val">{monthUpcoming}</div><div className="kpi-label">กำลังจะถึง</div></div>
        </div>
        <div className="kpi">
          <div className="kpi-icon kpi-green"><CalendarDays size={18} /></div>
          <div><div className="kpi-val">{monthDays}</div><div className="kpi-label">วันที่มีนัด</div></div>
        </div>
        <div className="kpi">
          <div className="kpi-icon kpi-steel"><Clock size={18} /></div>
          <div><div className="kpi-val">{selectedAppts.length}</div><div className="kpi-label">นัดวันที่เลือก</div></div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16, alignItems: "start" }}>
        {/* Calendar */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">{THAI_MONTHS[month]} {year + 543}</div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={prevMonth} className="btn btn-secondary btn-sm" style={{ padding: "6px 10px" }}><ChevronLeft size={16} /></button>
              <button onClick={() => { setYear(2026); setMonth(5); setSelectedDate(TODAY); }} className="btn btn-secondary btn-sm" style={{ color: PRIMARY }}>วันนี้</button>
              <button onClick={nextMonth} className="btn btn-secondary btn-sm" style={{ padding: "6px 10px" }}><ChevronRight size={16} /></button>
            </div>
          </div>
          <div className="card-body">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
              {THAI_DAYS.map(d => (
                <div key={d} style={{ textAlign: "center", fontSize: "0.66rem", fontWeight: 700, color: MUTED, padding: "4px 0" }}>{d}</div>
              ))}
              {cells.map((d, i) => {
                if (d === null) return <div key={i} />;
                const date = ymd(year, month, d);
                const appts = byDate[date] ?? [];
                const isToday = date === TODAY;
                const isSel = date === selectedDate;
                return (
                  <button key={i} onClick={() => setSelectedDate(date)}
                    style={{
                      minHeight: 64, borderRadius: 10, border: isSel ? `1.5px solid ${PRIMARY}` : `1px solid ${BORDER}`,
                      background: isSel ? "#dce5f0" : isToday ? "#eef3f8" : "#fff", cursor: "pointer", padding: "5px 6px",
                      display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 3, transition: "background .12s",
                    }}
                    onMouseEnter={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = "#f4f6f9"; }}
                    onMouseLeave={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = isToday ? "#eef3f8" : "#fff"; }}>
                    <span style={{ fontSize: "0.74rem", fontWeight: isToday ? 800 : 600, color: isToday ? PRIMARY : "#2D2D2D" }}>{d}</span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                      {appts.slice(0, 3).map(a => (
                        <span key={a.id} style={{ width: 6, height: 6, borderRadius: "50%", background: apptTypeColor[a.type].text }} />
                      ))}
                      {appts.length > 3 && <span style={{ fontSize: "0.55rem", color: MUTED }}>+{appts.length - 3}</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Side: selected day + upcoming */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card">
            <div className="card-header">
              <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 7, fontSize: "0.9rem" }}>
                <CalendarDays size={15} color={PRIMARY} /> {selectedDate === TODAY ? "วันนี้" : `วันที่ ${parseInt(selectedDate.split("-")[2])}`}
              </div>
            </div>
            {selectedAppts.length === 0 ? (
              <div className="card-body" style={{ fontSize: "0.78rem", color: MUTED, textAlign: "center", padding: "20px 0 24px" }}>ไม่มีนัดหมาย</div>
            ) : (
              <div>
                {selectedAppts.map(a => <ApptRow key={a.id} a={a} />)}
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title" style={{ fontSize: "0.9rem" }}>นัดหมายที่กำลังจะถึง</div>
            </div>
            <div>
              {upcoming.map(a => <ApptRow key={a.id} a={a} showDate />)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ApptRow({ a, showDate }: { a: AppointmentMock; showDate?: boolean }) {
  const c = apptTypeColor[a.type].text;
  return (
    <div className="activity">
      <div className="activity-icon" style={{ background: apptTypeColor[a.type].bg, color: c }}>
        <CalendarDays size={15} />
      </div>
      <div className="activity-text">
        <div className="activity-title" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.company}</div>
        <div className="activity-meta" style={{ marginBottom: 3 }}>
          <span style={{ color: c, fontWeight: 700 }}>{apptTypeLabel[a.type]}</span>
        </div>
        <div className="activity-meta" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><Clock size={10} /> {showDate ? `${parseInt(a.date.split("-")[2])}/${parseInt(a.date.split("-")[1])} · ` : ""}{a.time} น.</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><MapPin size={10} /> {a.province}</span>
        </div>
      </div>
    </div>
  );
}
