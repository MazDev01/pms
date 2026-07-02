"use client";

import { useState, useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { apptTypeLabel, type AppointmentMock, type ApptType } from "@/lib/mock";
import { useSales } from "@/context/SalesContext";
import { ChevronLeft, ChevronRight, Clock, MapPin, CalendarDays, CalendarCheck, Plus, X, User, Phone, Building2, GitBranch, Users, Edit2, Trash2 } from "lucide-react";

// ── Tokens (CI) ───────────────────────────────────────────────
const PRIMARY = "#003366";
const BORDER  = "#e5e7eb";
const MUTED   = "#6b7280";

const THAI_DAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const THAI_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
// Mock clock — the single source of "today" (used for highlighting, nav, and grouping)
const TODAY = "2026-06-30";
const GROUP_TODAY = TODAY;

// ── Activity-type color buckets ───────────────────────────────
// Consistent color-by-type used across Month / Week / Day (dot, left-bar, badge).
type ActivityBucket = "meeting" | "call" | "followup" | "quotation";

const BUCKET_META: Record<ActivityBucket, { label: string; labelTh: string; color: string; bg: string }> = {
  meeting:   { label: "Meeting",       labelTh: "ประชุม",              color: "#003366", bg: "#eef3f8" },
  call:      { label: "Call",          labelTh: "โทร",                 color: "#0284c7", bg: "#e6f4fb" },
  followup:  { label: "Follow-up",     labelTh: "ติดตาม",              color: "#d97706", bg: "#fef6e7" },
  quotation: { label: "Quotation Due", labelTh: "ใบเสนอราคาครบกำหนด", color: "#dc2626", bg: "#fdecec" },
};

// Map the mock ApptType values to activity buckets.
// visit / design_meet / presentation / contract_sign / close → Meeting
// follow_up → Follow-up
const APPT_BUCKET: Record<ApptType, ActivityBucket> = {
  visit:         "meeting",
  design_meet:   "meeting",
  presentation:  "meeting",
  contract_sign: "meeting",
  close:         "meeting",
  follow_up:     "followup",
};

function bucketOf(a: AppointmentMock): ActivityBucket { return APPT_BUCKET[a.type]; }
function bucketMeta(a: AppointmentMock) { return BUCKET_META[bucketOf(a)]; }

// CI colors for the quick-filter groups
const GROUP_COLORS = {
  today:    { key: PRIMARY,   bg: "#eef3f8" },
  upcoming: { key: "#f59e0b", bg: "#fef6e7" },
  overdue:  { key: "#dc2626", bg: "#fdecec" },
} as const;

type GroupFilter = "all" | "today" | "upcoming" | "overdue";
type ViewMode = "month" | "week" | "day";

function apptGroup(a: AppointmentMock): Exclude<GroupFilter, "all"> | null {
  if (a.date === GROUP_TODAY) return "today";
  if (a.date > GROUP_TODAY && a.status !== "cancelled") return "upcoming";
  if (a.date < GROUP_TODAY && a.status !== "done" && a.status !== "cancelled") return "overdue";
  return null;
}

function ymd(y: number, m: number, d: number) { return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`; }
function parseYmd(s: string) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
function ymdOf(dt: Date) { return ymd(dt.getFullYear(), dt.getMonth(), dt.getDate()); }
function addDays(s: string, n: number) { const dt = parseYmd(s); dt.setDate(dt.getDate() + n); return ymdOf(dt); }
// Sunday-start week containing the given date
function startOfWeek(s: string) { const dt = parseYmd(s); dt.setDate(dt.getDate() - dt.getDay()); return ymdOf(dt); }

export default function CalendarPage() {
  const router = useRouter();
  const TODAY_DT = parseYmd(TODAY);
  const [year, setYear] = useState(TODAY_DT.getFullYear());
  const [month, setMonth] = useState(TODAY_DT.getMonth());
  const [selectedDate, setSelectedDate] = useState<string>(TODAY);
  const [groupFilter, setGroupFilter] = useState<GroupFilter>("all");
  const [view, setView] = useState<ViewMode>("month");
  // นัดหมายทั้งหมดมาจาก SalesContext (ใช้ร่วมกับแดชบอร์ด/แจ้งเตือน)
  const { appointments: allAppts, addAppointment: ctxAddAppt, updateAppointment: ctxUpdateAppt, deleteAppointment: ctxDeleteAppt } = useSales();
  const [detail, setDetail] = useState<AppointmentMock | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editAppt, setEditAppt] = useState<AppointmentMock | null>(null);

  // นัดหมายทั้งหมดจาก context (allAppts มาจาก useSales ด้านบน)

  // Today / Upcoming / Overdue grouping (relative to GROUP_TODAY)
  const groups = useMemo(() => {
    const g = { today: [] as AppointmentMock[], upcoming: [] as AppointmentMock[], overdue: [] as AppointmentMock[] };
    allAppts.forEach(a => { const key = apptGroup(a); if (key) g[key].push(a); });
    const sortFn = (a: AppointmentMock, b: AppointmentMock) => (a.date + a.time).localeCompare(b.date + b.time);
    g.today.sort(sortFn); g.upcoming.sort(sortFn); g.overdue.sort(sortFn);
    return g;
  }, [allAppts]);

  const groupedList = useMemo(() => {
    if (groupFilter === "all") return [...groups.today, ...groups.overdue, ...groups.upcoming];
    return groups[groupFilter];
  }, [groups, groupFilter]);

  const byDate = useMemo(() => {
    const map: Record<string, AppointmentMock[]> = {};
    allAppts.forEach(a => { (map[a.date] ??= []).push(a); });
    return map;
  }, [allAppts]);

  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  function prevMonth() { let m = month - 1, y = year; if (m < 0) { m = 11; y--; } setMonth(m); setYear(y); }
  function nextMonth() { let m = month + 1, y = year; if (m > 11) { m = 0; y++; } setMonth(m); setYear(y); }

  // Keep month grid in sync when navigating by week/day
  function selectDate(date: string) {
    setSelectedDate(date);
    const dt = parseYmd(date);
    if (dt.getFullYear() !== year) setYear(dt.getFullYear());
    if (dt.getMonth() !== month) setMonth(dt.getMonth());
  }
  function goToday() { setYear(TODAY_DT.getFullYear()); setMonth(TODAY_DT.getMonth()); setSelectedDate(TODAY); }

  // Week nav (7-day step) / Day nav (1-day step)
  const weekStart = useMemo(() => startOfWeek(selectedDate), [selectedDate]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  function prevWeek() { selectDate(addDays(selectedDate, -7)); }
  function nextWeek() { selectDate(addDays(selectedDate, 7)); }
  function prevDay() { selectDate(addDays(selectedDate, -1)); }
  function nextDay() { selectDate(addDays(selectedDate, 1)); }

  const selectedAppts = (byDate[selectedDate] ?? []).sort((a, b) => a.time.localeCompare(b.time));
  const upcoming = useMemo(() =>
    [...allAppts].filter(a => a.date >= TODAY && a.status === "upcoming").sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).slice(0, 5)
  , [allAppts]);

  const monthAppts = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
    return allAppts.filter(a => a.date.startsWith(prefix));
  }, [allAppts, year, month]);

  // เพิ่ม/แก้ไข/ลบ นัดหมาย ผ่าน SalesContext (สะท้อนแดชบอร์ด/แจ้งเตือนทันที)
  function addAppointment(a: AppointmentMock) {
    ctxAddAppt(a);
    selectDate(a.date);
    setAddOpen(false);
  }
  function editAppointment(a: AppointmentMock) {
    ctxUpdateAppt(a);
    setEditAppt(null);
    setDetail(null);
    selectDate(a.date);
  }
  function deleteAppointment(id: number) {
    ctxDeleteAppt(id);
    setDetail(null);
  }
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
        {/* View switcher + add */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <ViewSwitcher view={view} onChange={setView} />
          <button onClick={() => setAddOpen(true)} className="btn btn-primary btn-md">
            <Plus size={15} /> เพิ่มกิจกรรม
          </button>
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

      {/* Color legend (activity type) */}
      <TypeLegend />

      {/* Quick-filter: Today / Upcoming / Overdue */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <GroupChip label="ทั้งหมด" count={groups.today.length + groups.upcoming.length + groups.overdue.length}
          keyColor={PRIMARY} bg="#f4f6f9" active={groupFilter === "all"} onClick={() => setGroupFilter("all")} plain />
        <GroupChip label="วันนี้" count={groups.today.length}
          keyColor={GROUP_COLORS.today.key} bg={GROUP_COLORS.today.bg} active={groupFilter === "today"} onClick={() => setGroupFilter("today")} />
        <GroupChip label="กำลังจะถึง" count={groups.upcoming.length}
          keyColor={GROUP_COLORS.upcoming.key} bg={GROUP_COLORS.upcoming.bg} active={groupFilter === "upcoming"} onClick={() => setGroupFilter("upcoming")} />
        <GroupChip label="เกินกำหนด" count={groups.overdue.length}
          keyColor={GROUP_COLORS.overdue.key} bg={GROUP_COLORS.overdue.bg} active={groupFilter === "overdue"} onClick={() => setGroupFilter("overdue")} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 340px", gap: 16, alignItems: "start" }}>
        {/* Calendar (Month / Week / Day) */}
        <div className="card" style={{ minWidth: 0 }}>
          <div className="card-header">
            <div className="card-title">
              {view === "month" && `${THAI_MONTHS[month]} ${year + 543}`}
              {view === "week" && `สัปดาห์ ${parseInt(weekStart.split("-")[2])} ${THAI_MONTHS[parseYmd(weekStart).getMonth()]} – ${parseInt(weekDays[6].split("-")[2])} ${THAI_MONTHS[parseYmd(weekDays[6]).getMonth()]}`}
              {view === "day" && `${parseInt(selectedDate.split("-")[2])} ${THAI_MONTHS[parseYmd(selectedDate).getMonth()]} ${parseYmd(selectedDate).getFullYear() + 543}`}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={view === "month" ? prevMonth : view === "week" ? prevWeek : prevDay} className="btn btn-secondary btn-sm" style={{ padding: "6px 10px" }}><ChevronLeft size={16} /></button>
              <button onClick={goToday} className="btn btn-secondary btn-sm" style={{ color: PRIMARY }}>วันนี้</button>
              <button onClick={view === "month" ? nextMonth : view === "week" ? nextWeek : nextDay} className="btn btn-secondary btn-sm" style={{ padding: "6px 10px" }}><ChevronRight size={16} /></button>
            </div>
          </div>
          <div className="card-body">
            {/* ── Month view ─────────────────────────────── */}
            {view === "month" && (
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
                          <span key={a.id} style={{ width: 6, height: 6, borderRadius: "50%", background: bucketMeta(a).color }} />
                        ))}
                        {appts.length > 3 && <span style={{ fontSize: "0.55rem", color: MUTED }}>+{appts.length - 3}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* ── Week view ──────────────────────────────── */}
            {view === "week" && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6, alignItems: "start" }}>
                {weekDays.map(date => {
                  const dt = parseYmd(date);
                  const appts = (byDate[date] ?? []).slice().sort((a, b) => a.time.localeCompare(b.time));
                  const isToday = date === TODAY;
                  const isSel = date === selectedDate;
                  return (
                    <div key={date} onClick={() => selectDate(date)}
                      style={{
                        border: isSel ? `1.5px solid ${PRIMARY}` : `1px solid ${BORDER}`,
                        borderRadius: 10, background: isSel ? "#f6f9fc" : isToday ? "#eef3f8" : "#fff",
                        cursor: "pointer", minWidth: 0, minHeight: 150, padding: 6, display: "flex", flexDirection: "column", gap: 6,
                      }}>
                      <div style={{ textAlign: "center", borderBottom: `1px solid ${BORDER}`, paddingBottom: 4 }}>
                        <div style={{ fontSize: "0.62rem", fontWeight: 700, color: MUTED }}>{THAI_DAYS[dt.getDay()]}</div>
                        <div style={{ fontSize: "0.9rem", fontWeight: isToday ? 800 : 700, color: isToday ? PRIMARY : "#2D2D2D" }}>{dt.getDate()}</div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {appts.length === 0 ? (
                          <div style={{ fontSize: "0.6rem", color: "#c0c4cc", textAlign: "center", padding: "6px 0" }}>—</div>
                        ) : appts.map(a => <WeekChip key={a.id} a={a} onOpen={() => setDetail(a)} />)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Day view ───────────────────────────────── */}
            {view === "day" && (
              <div>
                {selectedAppts.length === 0 ? (
                  <div style={{ fontSize: "0.8rem", color: MUTED, textAlign: "center", padding: "28px 0" }}>ไม่มีนัดหมายในวันนี้</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {selectedAppts.map(a => <DayRow key={a.id} a={a} onOpen={() => setDetail(a)} />)}
                  </div>
                )}
              </div>
            )}
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
                {selectedAppts.map(a => <ApptRow key={a.id} a={a} onOpen={() => setDetail(a)} />)}
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title" style={{ fontSize: "0.9rem" }}>นัดหมายที่กำลังจะถึง</div>
            </div>
            <div>
              {upcoming.map(a => <ApptRow key={a.id} a={a} showDate onOpen={() => setDetail(a)} />)}
            </div>
          </div>
        </div>
      </div>

      {/* Filtered list by group (Today / Upcoming / Overdue / All) */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header">
          <div className="card-title" style={{ fontSize: "0.9rem" }}>
            {groupFilter === "today" ? "วันนี้"
              : groupFilter === "upcoming" ? "กำลังจะถึง"
              : groupFilter === "overdue" ? "เกินกำหนด"
              : "นัดหมายทั้งหมด"}
            <span style={{ color: MUTED, fontWeight: 600, marginLeft: 8 }}>({groupedList.length})</span>
          </div>
        </div>
        {groupedList.length === 0 ? (
          <div className="card-body" style={{ fontSize: "0.78rem", color: MUTED, textAlign: "center", padding: "20px 0 24px" }}>ไม่มีนัดหมาย</div>
        ) : (
          <div>
            {groupedList.map(a => {
              const g = apptGroup(a);
              return <ApptRow key={a.id} a={a} showDate groupColor={g ? GROUP_COLORS[g].key : undefined} onOpen={() => setDetail(a)} />;
            })}
          </div>
        )}
      </div>

      {/* Appointment detail modal */}
      {detail && (
        <ApptDetailModal
          a={detail}
          onClose={() => setDetail(null)}
          onEdit={() => { const a = detail; setDetail(null); setEditAppt(a); }}
          onDelete={() => { if (window.confirm(`ต้องการลบกิจกรรม "${detail.company}" ใช่หรือไม่?`)) deleteAppointment(detail.id); }}
          router={router}
        />
      )}

      {/* Add appointment modal */}
      {addOpen && <AddApptModal defaultDate={selectedDate} onSave={addAppointment} onClose={() => setAddOpen(false)} />}

      {/* Edit appointment modal */}
      {editAppt && <AddApptModal initial={editAppt} defaultDate={editAppt.date} onSave={editAppointment} onClose={() => setEditAppt(null)} />}
    </div>
  );
}

// Appointment detail modal — read-only summary + related-record links
function ApptDetailModal({ a, onClose, onEdit, onDelete, router }: { a: AppointmentMock; onClose: () => void; onEdit: () => void; onDelete: () => void; router: ReturnType<typeof useRouter> }) {
  const m = bucketMeta(a);
  const statusLabel = a.status === "upcoming" ? "กำลังจะถึง" : a.status === "done" ? "เสร็จสิ้น" : "ยกเลิก";
  const rows: [ReactNode, string][] = [
    [<Building2 key="b" size={13} />, a.project],
    [<User key="u" size={13} />, a.contact],
    [<Phone key="p" size={13} />, a.phone],
    [<MapPin key="mp" size={13} />, a.province],
    [<Clock key="c" size={13} />, `${a.date} · ${a.time} น.`],
    [<User key="a" size={13} />, `ผู้รับผิดชอบ: ${a.assigned}`],
  ];
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(45,45,45,.45)", zIndex: 200 }} />
      <div style={{ position: "fixed", inset: 0, zIndex: 210, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, pointerEvents: "none" }}>
        <div onClick={e => e.stopPropagation()} className="card" style={{ width: "100%", maxWidth: 440, pointerEvents: "auto", overflow: "hidden", boxShadow: "0 24px 80px rgba(0,51,102,.24)" }}>
          <div style={{ background: PRIMARY, padding: "16px 20px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#fff" }}>{a.company}</div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                <span style={{ fontSize: "0.68rem", fontWeight: 700, color: m.color, background: "#fff", borderRadius: 999, padding: "2px 10px" }}>{apptTypeLabel[a.type]}</span>
                <span style={{ fontSize: "0.66rem", color: "rgba(255,255,255,.8)" }}>{statusLabel}</span>
              </div>
            </div>
            <button onClick={onClose} style={{ background: "rgba(255,255,255,.15)", border: "none", borderRadius: 7, width: 28, height: 28, cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><X size={13} /></button>
          </div>
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
            {rows.map(([icon, val], i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.8rem", color: "#2D2D2D" }}>
                <span style={{ color: MUTED, flexShrink: 0, display: "flex" }}>{icon}</span>
                <span style={{ minWidth: 0 }}>{val}</span>
              </div>
            ))}
            {a.note && (
              <div style={{ fontSize: "0.76rem", color: MUTED, background: "#f4f6f9", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 12px", marginTop: 2 }}>{a.note}</div>
            )}
          </div>
          <div style={{ padding: "13px 20px", borderTop: `1px solid ${BORDER}`, display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", background: "#fafafa", flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={onEdit} className="btn btn-secondary btn-md" style={{ color: PRIMARY }}>
                <Edit2 size={13} /> แก้ไข
              </button>
              <button onClick={onDelete} className="btn btn-md" style={{ background: "#fff", color: "#dc2626", border: "1px solid #fecaca" }}>
                <Trash2 size={13} /> ลบ
              </button>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { onClose(); router.push("/customers"); }} className="btn btn-secondary btn-md" style={{ color: PRIMARY }}>
                <Users size={13} /> ดูลูกค้า
              </button>
              <button onClick={() => { onClose(); router.push("/pipeline"); }} className="btn btn-primary btn-md">
                <GitBranch size={13} /> ดูไปป์ไลน์
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// Add / Edit appointment modal — writes to local state only (mock.ts untouched)
function AddApptModal({ initial, defaultDate, onSave, onClose }: { initial?: AppointmentMock; defaultDate: string; onSave: (a: AppointmentMock) => void; onClose: () => void }) {
  const isEdit = !!initial;
  const [company, setCompany] = useState(initial?.company ?? "");
  const [date, setDate] = useState(initial?.date ?? defaultDate);
  const [time, setTime] = useState(initial?.time ?? "09:00");
  const [type, setType] = useState<ApptType>(initial?.type ?? "visit");
  const [province, setProvince] = useState(initial?.province ?? "");
  const [note, setNote] = useState(initial?.note ?? "");

  function save() {
    const name = company.trim() || initial?.company || "กิจกรรมใหม่";
    onSave({
      // preserve all non-edited fields when editing (contact/phone/assigned/status/etc.)
      ...(initial ?? {
        id: Date.now(),
        contact: "—", phone: "—",
        buildingType: "—", area: 0,
        assigned: "คุณ", status: "upcoming",
      }),
      company: name,
      project: initial?.project ?? name,
      province: province.trim() || "—",
      date, time, type,
      note: note.trim(),
    });
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(45,45,45,.45)", zIndex: 200 }} />
      <div style={{ position: "fixed", inset: 0, zIndex: 210, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, pointerEvents: "none" }}>
        <div onClick={e => e.stopPropagation()} className="card" style={{ width: "100%", maxWidth: 460, pointerEvents: "auto", overflow: "hidden", boxShadow: "0 24px 80px rgba(0,51,102,.24)" }}>
          <div style={{ background: PRIMARY, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontWeight: 800, color: "#fff", fontSize: "0.9rem" }}>{isEdit ? "แก้ไขกิจกรรม" : "เพิ่มกิจกรรม"}</span>
            <button onClick={onClose} style={{ background: "rgba(255,255,255,.15)", border: "none", borderRadius: 7, width: 28, height: 28, cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={13} /></button>
          </div>
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label className="form-label">ชื่อลูกค้า / กิจกรรม</label>
              <input value={company} onChange={e => setCompany(e.target.value)} placeholder="เช่น บจ. ไทยสตีล" className="form-input" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label className="form-label">วันที่</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="form-input" />
              </div>
              <div>
                <label className="form-label">เวลา</label>
                <input type="time" value={time} onChange={e => setTime(e.target.value)} className="form-input" />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label className="form-label">ประเภท</label>
                <select value={type} onChange={e => setType(e.target.value as ApptType)} className="form-select">
                  {(Object.keys(apptTypeLabel) as ApptType[]).map(t => <option key={t} value={t}>{apptTypeLabel[t]}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">จังหวัด</label>
                <input value={province} onChange={e => setProvince(e.target.value)} placeholder="จังหวัด" className="form-input" />
              </div>
            </div>
            <div>
              <label className="form-label">บันทึก</label>
              <input value={note} onChange={e => setNote(e.target.value)} placeholder="รายละเอียดกิจกรรม" className="form-input" />
            </div>
          </div>
          <div style={{ padding: "13px 20px", borderTop: `1px solid ${BORDER}`, display: "flex", gap: 8, justifyContent: "flex-end", background: "#fafafa" }}>
            <button onClick={onClose} className="btn btn-secondary btn-md">ยกเลิก</button>
            <button onClick={save} className="btn btn-primary btn-md">{isEdit ? <><Edit2 size={13} /> บันทึก</> : <><Plus size={13} /> เพิ่มกิจกรรม</>}</button>
          </div>
        </div>
      </div>
    </>
  );
}

// View switcher: Month / Week / Day (เดือน / สัปดาห์ / วัน)
function ViewSwitcher({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  const items: { v: ViewMode; label: string }[] = [
    { v: "month", label: "เดือน" },
    { v: "week", label: "สัปดาห์" },
    { v: "day", label: "วัน" },
  ];
  return (
    <div style={{ display: "inline-flex", border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden", background: "#fff" }}>
      {items.map((it, i) => {
        const active = view === it.v;
        return (
          <button key={it.v} onClick={() => onChange(it.v)}
            style={{
              padding: "7px 16px", fontSize: "0.8rem", fontWeight: 700, cursor: "pointer", border: "none",
              borderLeft: i === 0 ? "none" : `1px solid ${BORDER}`,
              background: active ? PRIMARY : "#fff", color: active ? "#fff" : "#2D2D2D", transition: "background .12s",
            }}
            onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "#f4f6f9"; }}
            onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "#fff"; }}>
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

// Color legend for activity types
function TypeLegend() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16, padding: "8px 2px", marginBottom: 12 }}>
      {(Object.keys(BUCKET_META) as ActivityBucket[]).map(k => {
        const m = BUCKET_META[k];
        return (
          <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.75rem", color: "#2D2D2D" }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: m.color, flexShrink: 0 }} />
            <span style={{ fontWeight: 700 }}>{m.labelTh}</span>
          </span>
        );
      })}
    </div>
  );
}

// Compact appointment chip for the Week view columns
function WeekChip({ a, onOpen }: { a: AppointmentMock; onOpen?: () => void }) {
  const m = bucketMeta(a);
  return (
    <div onClick={e => { e.stopPropagation(); onOpen?.(); }} style={{
      borderLeft: `3px solid ${m.color}`, background: m.bg, borderRadius: 6,
      padding: "3px 6px", display: "flex", flexDirection: "column", gap: 1, cursor: "pointer",
    }}>
      <span style={{ fontSize: "0.6rem", fontWeight: 800, color: m.color }}>{a.time}</span>
      <span style={{ fontSize: "0.62rem", fontWeight: 600, color: "#2D2D2D", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.company}</span>
    </div>
  );
}

// Time-ordered row for the Day view
function DayRow({ a, onOpen }: { a: AppointmentMock; onOpen?: () => void }) {
  const m = bucketMeta(a);
  return (
    <div onClick={onOpen} style={{ display: "flex", gap: 12, alignItems: "stretch", borderLeft: `3px solid ${m.color}`, padding: "10px 0 10px 12px", borderBottom: `1px solid ${BORDER}`, cursor: onOpen ? "pointer" : undefined }}>
      <div style={{ minWidth: 56, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
        <span style={{ fontSize: "0.86rem", fontWeight: 800, color: PRIMARY }}>{a.time}</span>
        <span style={{ fontSize: "0.62rem", color: MUTED }}>น.</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#2D2D2D", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.company}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
          <span style={{ fontSize: "0.68rem", fontWeight: 700, color: m.color, background: m.bg, borderRadius: 999, padding: "1px 9px" }}>{apptTypeLabel[a.type]}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: "0.7rem", color: MUTED }}><MapPin size={11} /> {a.province}</span>
        </div>
        {a.note && <div style={{ fontSize: "0.7rem", color: MUTED, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.note}</div>}
      </div>
    </div>
  );
}

function GroupChip({ label, count, keyColor, bg, active, onClick, plain }: {
  label: string; count: number; keyColor: string; bg: string; active: boolean; onClick: () => void; plain?: boolean;
}) {
  return (
    <button onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
        padding: "10px 14px", borderRadius: 12, textAlign: "left",
        border: active ? `1.5px solid ${keyColor}` : `1px solid ${BORDER}`,
        background: active ? bg : "#fff", transition: "background .12s, border-color .12s",
      }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "#f4f6f9"; }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "#fff"; }}>
      {!plain && <span style={{ width: 10, height: 10, borderRadius: "50%", background: keyColor, flexShrink: 0 }} />}
      <span style={{ fontSize: "0.8rem", fontWeight: 700, color: active ? keyColor : "#2D2D2D" }}>{label}</span>
      <span style={{
        fontSize: "0.8rem", fontWeight: 800, minWidth: 22, textAlign: "center",
        color: "#fff", background: keyColor, borderRadius: 999, padding: "1px 8px",
      }}>{count}</span>
    </button>
  );
}

function ApptRow({ a, showDate, groupColor, onOpen }: { a: AppointmentMock; showDate?: boolean; groupColor?: string; onOpen?: () => void }) {
  const m = bucketMeta(a);
  const c = m.color;
  return (
    <div className="activity" onClick={onOpen} style={{ ...(groupColor ? { borderLeft: `3px solid ${groupColor}`, paddingLeft: 9 } : {}), cursor: onOpen ? "pointer" : undefined }}>
      <div className="activity-icon" style={{ background: m.bg, color: c }}>
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
