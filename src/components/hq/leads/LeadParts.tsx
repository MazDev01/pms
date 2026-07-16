"use client";

// ─── ชิ้นส่วนของ Lead Pool (HQ) ───────────────────────────────────────────────
// ทุกค่าคำนวณจากข้อมูลจริงของลีดเท่านั้น — ไม่มี SLA / ไม่มีการให้คะแนน / ไม่มี slider
import { AlertTriangle, CheckCircle2, Circle, ChevronRight } from "lucide-react";
import type { LeadRow } from "@/lib/mock";
import { LEAD_TASK_TEMPLATE, buildLeadTasks } from "@/lib/mock";
import { daysSinceContact, lastContactLabel, leadProgress } from "@/lib/leadMetrics";
import { useHQLeadRules } from "@/lib/useHQRules";
import { EmptyState } from "@/components/ui/EmptyState";

const PRIMARY = "#003366";
// เกณฑ์ "ไม่มีการติดต่อเกินกี่วัน" มาจากกฎธุรกิจของ HQ (/hq/settings → กฎธุรกิจ) — ไม่ hardcode

/** ความคืบหน้า = งานที่ทำเสร็จ ÷ งานมาตรฐานทั้งหมด × 100 (คำนวณล้วน · แก้มือไม่ได้) */
export function ProgressCell({ lead }: { lead: LeadRow }) {
  const pct = leadProgress(lead);
  const tasks = lead.tasks?.length ? lead.tasks : buildLeadTasks();
  const done = tasks.filter(t => t.done).length;
  const color = pct >= 80 ? "#059669" : pct >= 40 ? PRIMARY : "#F59E0B";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 108 }}>
      <div style={{ flex: 1, height: 6, background: "var(--muted)", borderRadius: 999, overflow: "hidden" }}>
        <div className="bar-grow" style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 999 }} />
      </div>
      <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#1F2937", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}
        title={`${done}/${tasks.length} งาน`}>{pct}%</span>
    </div>
  );
}

/** จำนวนวันที่ไม่มีการติดต่อ — เกินเกณฑ์กฎธุรกิจขึ้นสีแดง */
export function DaysIdleCell({ lead }: { lead: LeadRow }) {
  const { followUpAlertDays } = useHQLeadRules();
  const d = daysSinceContact(lead);
  if (d == null) return <span style={{ color: "#9CA3AF", fontSize: "0.72rem" }}>—</span>; // ไม่มีวันติดต่อบันทึกไว้
  const over = d > followUpAlertDays;
  return (
    <span className="badge" style={over ? { background: "#FDECEC", color: "#DC2626" } : { background: "#F1F5F9", color: "#6B7280" }}
      title={`ติดต่อล่าสุด ${lastContactLabel(lead)}`}>
      {over && <AlertTriangle size={11} style={{ marginRight: 3, verticalAlign: "-1px" }} />}
      {d} วัน
    </span>
  );
}

/** การ์ดเตือนลีดค้าง — เกณฑ์วันมาจากกฎธุรกิจของ HQ · แสดงวันที่ไม่ติดต่อ / ติดต่อล่าสุด / กดดูได้ทันที */
export function SevenDayAlertCard({ leads, onView }: { leads: LeadRow[]; onView: (l: LeadRow) => void }) {
  const { followUpAlertDays } = useHQLeadRules();
  // นับเฉพาะลีดที่มีวันติดต่อบันทึกไว้จริง — ไม่มีข้อมูล = ไม่เดาว่าค้าง
  const overdue = leads
    .map(l => ({ l, d: daysSinceContact(l) }))
    .filter((x): x is { l: LeadRow; d: number } => x.d != null && x.d > followUpAlertDays)
    .sort((a, b) => b.d - a.d);

  return (
    <div className="card" style={{ marginBottom: 0 }}>
      <div className="card-header">
        <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <AlertTriangle size={15} color="#DC2626" /> ลีดที่ไม่มีการติดต่อเกิน {followUpAlertDays} วัน
        </div>
        <span className="badge" style={{ background: "#FDECEC", color: "#DC2626" }}>{overdue.length} ลีด</span>
      </div>
      <div className="card-body" style={{ paddingTop: 4, display: "flex", flexDirection: "column", gap: 8, maxHeight: 300, overflowY: "auto" }}>
        {!overdue.length ? (
          <EmptyState icon={<CheckCircle2 size={26} />} title="ไม่มีลีดค้าง" description={`ทุกลีดถูกติดต่อภายใน ${followUpAlertDays} วัน`} compact />
        ) : overdue.map(({ l, d }) => (
          <button key={l.id} onClick={() => onView(l)}
            style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", cursor: "pointer", fontFamily: "inherit",
              background: "#FEF6F6", border: "1px solid #F6D5D5", borderRadius: 12, padding: "9px 11px" }}>
            <span style={{ width: 30, height: 30, borderRadius: 9, background: "#fff", color: "#DC2626", border: "1px solid #F6D5D5", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <AlertTriangle size={15} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, color: "#1F2937", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                ไม่มีการติดต่อ {d} วัน · {l.company}
              </span>
              <span style={{ display: "block", fontSize: "0.68rem", color: "#6B7280" }}>
                ติดต่อล่าสุด {lastContactLabel(l)} · ผู้รับผิดชอบ {l.assigned}
              </span>
            </span>
            <ChevronRight size={14} color="#c0c0c0" style={{ flexShrink: 0 }} />
          </button>
        ))}
      </div>
    </div>
  );
}

/** รายการงานมาตรฐานของลีด (อ่านอย่างเดียวสำหรับ HQ) — ขับเคลื่อนความคืบหน้า */
export function TaskChecklist({ lead }: { lead: LeadRow }) {
  const tasks = lead.tasks?.length ? lead.tasks : buildLeadTasks();
  const done = tasks.filter(t => t.done).length;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "#6B7280", marginBottom: 10 }}>
        <span>ทำเสร็จ {done} จาก {tasks.length} งาน</span>
        <span style={{ fontWeight: 800, color: PRIMARY }}>{leadProgress(lead)}%</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {tasks.map((t, i) => {
          const stage = LEAD_TASK_TEMPLATE.find(x => x.key === t.key)?.stage;
          return (
            <div key={t.key + i} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 0", borderTop: i === 0 ? "none" : "1px solid #F1F5F9" }}>
              {t.done ? <CheckCircle2 size={15} color="#059669" style={{ flexShrink: 0 }} /> : <Circle size={15} color="#CBD5E1" style={{ flexShrink: 0 }} />}
              <span style={{ flex: 1, minWidth: 0, fontSize: "0.78rem", fontWeight: t.done ? 700 : 500, color: t.done ? "#1F2937" : "#6B7280" }}>{t.label}</span>
              {t.doneAt && <span style={{ fontSize: "0.66rem", color: "#94A3B8", flexShrink: 0 }}>{t.doneAt}</span>}
              {stage && <span className="badge" style={{ background: "#F1F5F9", color: "#6B7280", flexShrink: 0 }}>{stage}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
