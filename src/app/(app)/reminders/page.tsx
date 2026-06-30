"use client";

import { useState, useMemo } from "react";
import {
  Plus, X, Check, Trash2, BellRing, Calendar, AlertTriangle, Clock, CheckCircle2,
} from "lucide-react";

// ── Tokens (HQ) ───────────────────────────────────────────────
const PRIMARY = "#003366";
const STEEL   = "#2D2D2D";
const BORDER  = "#e5e7eb";
const MUTED   = "#6b7280";
const SUCCESS = "#059669";
const WARNING = "#d97706";
const DANGER  = "#dc2626";

const TODAY = "2026-06-29";

type Priority = "high" | "medium" | "low";
type Reminder = {
  id: number; title: string; note?: string;
  dueDate: string; dueTime?: string;
  priority: Priority; relatedTo?: string; done: boolean;
};

const PRIORITY_META: Record<Priority, { label: string; color: string; bg: string }> = {
  high:   { label: "ด่วน",  color: DANGER,  bg: "#fee2e2" },
  medium: { label: "ปกติ",  color: WARNING, bg: "#fff3cd" },
  low:    { label: "ไม่เร่ง", color: MUTED,  bg: "#f0f0f5" },
};

const INIT: Reminder[] = [
  { id: 1, title: "โทรติดตาม หจก. ราชบุรีโลหะ", note: "ลูกค้าลังเลเรื่องราคา เน้นจุดแข็ง ISO + รับประกัน 5 ปี", dueDate: "2026-06-29", dueTime: "10:00", priority: "high", relatedTo: "โอกาสการขาย: โกดัง PEB ราชบุรี", done: false },
  { id: 2, title: "ส่ง BOQ เบื้องต้นให้ VCS Asia", note: "โอกาสการขายระยอง เฟส 2 — ขยาย 2,000 ตร.ม.", dueDate: "2026-06-27", dueTime: "17:00", priority: "high", relatedTo: "ลูกค้า: VCS Asia", done: false },
  { id: 3, title: "นัดประชุมลูกค้า บจ. ไทยสตีล", note: "นำเสนอความคืบหน้าการขายโกดัง พร้อมลูกค้า", dueDate: "2026-07-05", dueTime: "09:30", priority: "medium", relatedTo: "โอกาสการขาย: โกดังไทยสตีล", done: false },
  { id: 4, title: "ติดตามใบเสนอราคา บจ. อุตรดิตถ์โลหะ", dueDate: "2026-06-30", priority: "medium", relatedTo: "ใบเสนอราคา Q-2026-0098", done: false },
  { id: 5, title: "ส่งแคตตาล็อกให้ลีดใหม่ นิคมฯ อมตะ", dueDate: "2026-07-02", priority: "low", done: false },
  { id: 6, title: "ทบทวนสเปกให้ บจ. ซีซีเอส", note: "นำเสนอรอบ 2", dueDate: "2026-06-24", dueTime: "14:00", priority: "medium", relatedTo: "โอกาสการขาย: PREFAB เชียงใหม่", done: true },
];

function daysFromToday(date: string): number {
  const d = new Date(date + "T00:00:00").getTime();
  const t = new Date(TODAY + "T00:00:00").getTime();
  return Math.round((d - t) / 86400000);
}
function fmtDate(d: string): string {
  const [y, m, day] = d.split("-");
  const mo = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  return `${parseInt(day)} ${mo[parseInt(m) - 1]} ${parseInt(y) + 543}`;
}
function dueLabel(r: Reminder): { text: string; color: string } {
  const diff = daysFromToday(r.dueDate);
  if (diff < 0) return { text: `เลยกำหนด ${-diff} วัน`, color: DANGER };
  if (diff === 0) return { text: "วันนี้", color: DANGER };
  if (diff === 1) return { text: "พรุ่งนี้", color: WARNING };
  if (diff <= 7) return { text: `อีก ${diff} วัน`, color: WARNING };
  return { text: `อีก ${diff} วัน`, color: MUTED };
}

type FormState = { title: string; note: string; dueDate: string; dueTime: string; priority: Priority; relatedTo: string };
function blank(): FormState { return { title: "", note: "", dueDate: TODAY, dueTime: "", priority: "medium", relatedTo: "" }; }

export default function RemindersPage() {
  const [items, setItems] = useState<Reminder[]>(INIT);
  const [tab, setTab] = useState<"open" | "done">("open");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(blank());

  const open = useMemo(() => items.filter(r => !r.done).sort((a, b) => a.dueDate.localeCompare(b.dueDate)), [items]);
  const done = useMemo(() => items.filter(r => r.done), [items]);
  const overdue = open.filter(r => daysFromToday(r.dueDate) < 0).length;
  const todayCount = open.filter(r => daysFromToday(r.dueDate) === 0).length;

  const list = tab === "open" ? open : done;

  function add() {
    if (!form.title.trim()) return;
    const id = Math.max(0, ...items.map(i => i.id)) + 1;
    setItems(prev => [{ id, title: form.title.trim(), note: form.note || undefined, dueDate: form.dueDate, dueTime: form.dueTime || undefined, priority: form.priority, relatedTo: form.relatedTo || undefined, done: false }, ...prev]);
    setForm(blank()); setShowForm(false);
  }
  function toggle(id: number) { setItems(prev => prev.map(r => r.id === id ? { ...r, done: !r.done } : r)); }
  function remove(id: number) { setItems(prev => prev.filter(r => r.id !== id)); }

  return (
    <div className="erp">
      {/* Header */}
      <div className="page-head">
        <div>
          <h2>แจ้งเตือน</h2>
          <p>ติดตามงานและนัดหมายที่ต้องทำ ไม่ให้พลาดโอกาสการขายสำคัญ</p>
        </div>
        <button className="btn btn-primary btn-md" onClick={() => setShowForm(true)}>
          <Plus size={14} /> เพิ่มการแจ้งเตือน
        </button>
      </div>

      {/* KPI */}
      <div className="kpi-bar" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
        {[
          { label: "รอดำเนินการ", value: open.length, cls: "kpi-navy", color: PRIMARY, icon: <BellRing size={18} /> },
          { label: "ครบกำหนดวันนี้", value: todayCount, cls: "kpi-amber", color: WARNING, icon: <Clock size={18} /> },
          { label: "เลยกำหนด", value: overdue, cls: "kpi-green", color: DANGER, icon: <AlertTriangle size={18} /> },
        ].map((k, i) => (
          <div key={i} className="kpi">
            <div className={`kpi-icon ${k.cls}`} style={i === 2 ? { background: "#fee2e2", color: DANGER } : undefined}>{k.icon}</div>
            <div className="kpi-val" style={{ color: k.color, fontSize: "1.5rem" }}>{k.value}</div>
            <div className="kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="tab-bar" style={{ marginBottom: 14 }}>
        {([["open", `รอดำเนินการ (${open.length})`], ["done", `เสร็จแล้ว (${done.length})`]] as const).map(([k, lbl]) => (
          <button key={k} className={`tab-item${tab === k ? " active" : ""}`} onClick={() => setTab(k)}>
            {lbl}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="card" style={{ overflow: "hidden" }}>
        {list.length === 0 ? (
          <div style={{ padding: "48px", textAlign: "center", color: MUTED }}>
            <CheckCircle2 size={32} color="#cbd5e1" style={{ marginBottom: 10 }} />
            <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>{tab === "open" ? "ไม่มีรายการที่ต้องทำ — เยี่ยมมาก!" : "ยังไม่มีรายการที่เสร็จ"}</div>
          </div>
        ) : list.map((r, i) => {
          const pm = PRIORITY_META[r.priority];
          const dl = dueLabel(r);
          return (
            <div key={r.id} className="activity" style={{ alignItems: "flex-start", borderTop: i === 0 ? "none" : `1px solid ${BORDER}` }}>
              <button onClick={() => toggle(r.id)} title={r.done ? "ทำเครื่องหมายว่ายังไม่เสร็จ" : "ทำเครื่องหมายว่าเสร็จ"}
                style={{ width: 22, height: 22, borderRadius: "50%", border: `2px solid ${r.done ? SUCCESS : "#cbd5e1"}`, background: r.done ? SUCCESS : "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                {r.done && <Check size={12} color="#fff" />}
              </button>
              <div className="activity-text">
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: "0.86rem", fontWeight: 700, color: r.done ? MUTED : STEEL, textDecoration: r.done ? "line-through" : "none" }}>{r.title}</span>
                  <span className="badge" style={{ background: pm.bg, color: pm.color }}>{pm.label}</span>
                </div>
                {r.note && <div style={{ fontSize: "0.74rem", color: MUTED, marginTop: 3, lineHeight: 1.45 }}>{r.note}</div>}
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6, fontSize: "0.7rem", color: MUTED, flexWrap: "wrap" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Calendar size={11} /> {fmtDate(r.dueDate)}{r.dueTime ? ` · ${r.dueTime} น.` : ""}</span>
                  {!r.done && <span style={{ fontWeight: 700, color: dl.color }}>{dl.text}</span>}
                  {r.relatedTo && <span style={{ padding: "1px 8px", borderRadius: 6, background: "#f0f4f8", color: "#475569", fontWeight: 600 }}>{r.relatedTo}</span>}
                </div>
              </div>
              <button onClick={() => remove(r.id)} title="ลบ" style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${BORDER}`, background: "#fff", color: DANGER, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Trash2 size={13} /></button>
            </div>
          );
        })}
      </div>

      {/* Add modal */}
      {showForm && (
        <div onClick={() => setShowForm(false)} style={{ position: "fixed", inset: 0, background: "rgba(45,45,45,.42)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div className="card" onClick={e => e.stopPropagation()} style={{ width: 480, maxWidth: "100%", overflow: "hidden", boxShadow: "0 24px 80px rgba(0,0,0,.2)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", background: PRIMARY }}>
              <div style={{ fontSize: "0.92rem", fontWeight: 800, color: "#fff" }}>เพิ่มการแจ้งเตือน</div>
              <button onClick={() => setShowForm(false)} style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid rgba(255,255,255,.2)", background: "rgba(255,255,255,.1)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={13} /></button>
            </div>
            <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label className="form-label">เรื่อง *</label>
                <input className="form-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="เช่น โทรติดตามลูกค้า..." />
              </div>
              <div>
                <label className="form-label">รายละเอียด</label>
                <textarea className="form-textarea" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} rows={3} placeholder="หมายเหตุ..." style={{ resize: "vertical" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="form-label">วันที่ครบกำหนด</label>
                  <input className="form-input" type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">เวลา</label>
                  <input className="form-input" type="time" value={form.dueTime} onChange={e => setForm(f => ({ ...f, dueTime: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="form-label">ความสำคัญ</label>
                  <select className="form-select" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as Priority }))}>
                    <option value="high">ด่วน</option>
                    <option value="medium">ปกติ</option>
                    <option value="low">ไม่เร่ง</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">เกี่ยวข้องกับ</label>
                  <input className="form-input" value={form.relatedTo} onChange={e => setForm(f => ({ ...f, relatedTo: e.target.value }))} placeholder="ลูกค้า/โอกาสการขาย" />
                </div>
              </div>
            </div>
            <div style={{ padding: "13px 22px", borderTop: `1px solid ${BORDER}`, display: "flex", gap: 8, justifyContent: "flex-end", background: "#fafafa" }}>
              <button className="btn btn-secondary btn-md" onClick={() => setShowForm(false)}>ยกเลิก</button>
              <button className="btn btn-primary btn-md" onClick={add}>บันทึก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
