"use client";

import { useState, useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { pipelineDeals } from "@/lib/mock";
import { Activity } from "lucide-react";

// ── Activity type → icon (clean SVG) + tint ───────────────────
const TYPE_META: Record<string, { icon: ReactNode; color: string; bg: string }> = {
  deal_created: {
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
    color: "#003366", bg: "#dce5f0",
  },
  stage_change: {
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
    color: "#0369a1", bg: "#e0f2fe",
  },
  task_done: {
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><polyline points="20 6 9 17 4 12"/></svg>,
    color: "#059669", bg: "#e5faf0",
  },
  task_undone: {
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>,
    color: "#6b7280", bg: "#f0f0f5",
  },
  note_added: {
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>,
    color: "#b45309", bg: "#fef3cd",
  },
  file_added: {
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
    color: "#475569", bg: "#f0f4f8",
  },
  won: {
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
    color: "#059669", bg: "#e5faf0",
  },
  lost: {
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
    color: "#dc2626", bg: "#fee2e2",
  },
};
const FALLBACK = {
  icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="12" r="4"/></svg>,
  color: "#6b7280", bg: "#f0f0f5",
};
function meta(t: string) { return TYPE_META[t] ?? FALLBACK; }

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "ทั้งหมด" },
  { key: "stage_change", label: "เปลี่ยนขั้นตอน" },
  { key: "task_done", label: "งานเสร็จ" },
  { key: "won", label: "ปิดการขาย" },
  { key: "note_added", label: "บันทึก" },
];

function fmtTime(ts: string) {
  const d = new Date(ts);
  const day = d.getDate(), mo = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."][d.getMonth()];
  const hh = String(d.getHours()).padStart(2, "0"), mm = String(d.getMinutes()).padStart(2, "0");
  return `${day} ${mo} ${d.getFullYear() + 543} · ${hh}:${mm}`;
}
function dayKey(ts: string) { return ts.slice(0, 10); }
function dayLabel(key: string) {
  const [y, m, d] = key.split("-");
  return `${parseInt(d)} ${["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."][parseInt(m) - 1]} ${parseInt(y) + 543}`;
}

export default function ActivityPage() {
  const router = useRouter();
  const [filter, setFilter] = useState("all");

  const events = useMemo(() => {
    const all = pipelineDeals.flatMap(d =>
      (d.activities ?? []).map(a => ({ ...a, customer: d.customer, project: d.project, dealId: d.id }))
    );
    return all.sort((a, b) => (b.timestamp ?? "").localeCompare(a.timestamp ?? ""));
  }, []);

  const filtered = filter === "all" ? events : events.filter(e => e.type === filter);

  // group by day
  const groups = useMemo(() => {
    const map: Record<string, typeof filtered> = {};
    filtered.forEach(e => { const k = dayKey(e.timestamp ?? ""); (map[k] ??= []).push(e); });
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  return (
    <div className="erp" style={{ maxWidth: 820 }}>
      {/* Header */}
      <div className="page-head">
        <div>
          <h2>ไทม์ไลน์กิจกรรม</h2>
          <p>ความเคลื่อนไหวล่าสุดของโอกาสการขายและงานขายทั้งหมด</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="tab-bar" style={{ marginBottom: "1.25rem" }}>
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`tab-item ${filter === f.key ? "active" : ""}`}>
            {f.label}
          </button>
        ))}
      </div>

      {groups.length === 0 ? (
        <div className="card" style={{ padding: "48px", textAlign: "center", color: "var(--muted-foreground)" }}>
          <Activity size={32} color="#cbd5e1" style={{ marginBottom: 10 }} />
          <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>ไม่มีกิจกรรม</div>
        </div>
      ) : groups.map(([day, items]) => (
        <div key={day} style={{ marginBottom: "1.25rem" }}>
          <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10, paddingLeft: 2 }}>{dayLabel(day)}</div>
          <div className="card">
            {items.map((e) => {
              const m = meta(e.type);
              return (
                <div key={`${e.dealId}-${e.id}`} className="activity clickable"
                  onClick={() => router.push("/pipeline")}
                  title={`ดูโอกาสการขาย: ${e.project}`}
                  style={{ cursor: "pointer" }}>
                  <div className="activity-icon" style={{ background: m.bg, color: m.color }}>{m.icon}</div>
                  <div className="activity-text">
                    <div className="activity-title">{e.text}</div>
                    <div className="activity-meta">
                      <span style={{ fontWeight: 700, color: "var(--primary)" }}>{e.customer}</span> · {e.project}
                    </div>
                  </div>
                  <div style={{ fontSize: "0.66rem", color: "#9ca3af", whiteSpace: "nowrap", flexShrink: 0 }}>{fmtTime(e.timestamp ?? "")}</div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
