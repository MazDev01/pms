"use client";

import { useState } from "react";
import { Check, Trophy, XCircle, RotateCcw } from "lucide-react";
import {
  buildLeadTasks, taskProgress, stageFromTasks, leadStatusLabel, loadLostReasons,
  type LeadRow, type LeadTask,
} from "@/lib/mock";

const THAI_MONTHS = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
function stamp(d: Date) {
  const hh = String(d.getHours()).padStart(2, "0"), mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543} · ${hh}:${mm}`;
}

// Task-driven Sales Journey — เช็ก Task → บันทึกเวลา/ผู้ทำ → คำนวณ % → เลื่อน Stage อัตโนมัติ
export function LeadTasks({ lead, performedBy, onSave }: {
  lead: LeadRow; performedBy: string; onSave: (l: LeadRow) => void;
}) {
  const tasks: LeadTask[] = lead.tasks?.length ? lead.tasks : buildLeadTasks();
  const closed = lead.status === "PAID" || lead.status === "CANCELLED";
  const pct = closed ? 100 : taskProgress(tasks);
  const [lostOpen, setLostOpen] = useState(false);
  const [lostReason, setLostReason] = useState("");

  function toggle(key: string) {
    if (closed) return;
    const now = stamp(new Date());
    const next = tasks.map(t => t.key === key
      ? (t.done
          ? { ...t, done: false, doneAt: undefined, doneBy: undefined }
          : { ...t, done: true, doneAt: now, doneBy: performedBy })
      : t);
    // เช็ก Task → คำนวณ stage ใหม่อัตโนมัติ (เลื่อน stage ตาม task ที่ทำล่าสุด)
    onSave({ ...lead, tasks: next, status: stageFromTasks(next) });
  }

  function close(outcome: "won" | "lost", reason?: string) {
    const now = stamp(new Date());
    // ปิดการขาย → ทุก task ถือว่าเสร็จ = 100% · stage = Won / Lost
    const next = tasks.map(t => ({ ...t, done: true, doneAt: t.doneAt ?? now, doneBy: t.doneBy ?? performedBy }));
    onSave({ ...lead, tasks: next, status: outcome === "won" ? "PAID" : "CANCELLED", lostReason: outcome === "lost" ? (reason ?? "") : undefined });
    setLostOpen(false); setLostReason("");
  }

  function reopen() {
    const next = tasks.map(t => t.key === "close" ? { ...t, done: false, doneAt: undefined, doneBy: undefined } : t);
    onSave({ ...lead, tasks: next, status: stageFromTasks(next), lostReason: undefined });
  }

  const barColor = lead.status === "CANCELLED" ? "#dc2626" : lead.status === "PAID" ? "#059669" : "#003366";
  const normalTasks = tasks.filter(t => t.key !== "close");

  return (
    <div>
      <div style={{ fontSize: "0.65rem", fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: "#003366", marginBottom: 12, paddingBottom: 6, borderBottom: "1px solid #C0C0C044" }}>
        รายงานการทำงาน · เช็กแล้วเลื่อน Stage อัตโนมัติ
      </div>

      {/* ── ความคืบหน้า (คำนวณจากจำนวน Task · อ่านอย่างเดียว) ── */}
      <div style={{ background: "#f8f9fb", border: "1px solid #f0f4f8", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div>
            <span style={{ fontSize: "0.72rem", color: "#6b7280", fontWeight: 600 }}>สถานะปัจจุบัน</span>
            <div style={{ fontSize: "0.92rem", fontWeight: 800, color: barColor }}>{leadStatusLabel[lead.status]}</div>
          </div>
          <div style={{ fontSize: "1.7rem", fontWeight: 800, color: barColor, fontVariantNumeric: "tabular-nums" }}>{pct}%</div>
        </div>
        <div style={{ height: 10, background: "#e5e7eb", borderRadius: 999, overflow: "hidden" }}>
          <div className="bar-grow" style={{ height: "100%", width: `${pct}%`, borderRadius: 999, background: barColor }} />
        </div>
        <div style={{ fontSize: "0.65rem", color: "#9ca3af", marginTop: 6 }}>
          คำนวณจาก {tasks.filter(t => t.done).length}/{tasks.length} งาน — เลื่อน Stage อัตโนมัติเมื่อเช็กงาน (ปรับ % / ลาก bar เองไม่ได้)
        </div>
      </div>

      {/* ── Checklist งาน ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {normalTasks.map(t => (
          <button key={t.key} type="button" onClick={() => toggle(t.key)} disabled={closed}
            style={{
              display: "flex", alignItems: "flex-start", gap: 11, width: "100%", textAlign: "left",
              padding: "10px 12px", borderRadius: 10, border: `1px solid ${t.done ? "#bbf7d0" : "#e5e7eb"}`,
              background: t.done ? "#f0fdf4" : "#fff", cursor: closed ? "default" : "pointer", fontFamily: "inherit",
              opacity: closed && !t.done ? 0.55 : 1,
            }}>
            <span style={{
              width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 1,
              border: `2px solid ${t.done ? "#059669" : "#cbd5e1"}`, background: t.done ? "#059669" : "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {t.done && <Check size={13} color="#fff" strokeWidth={3} />}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: "0.86rem", fontWeight: 600, color: t.done ? "#065f46" : "#2D2D2D", textDecoration: t.done ? "line-through" : "none" }}>{t.label}</span>
              {t.done && (t.doneBy || t.doneAt) && (
                <span style={{ display: "block", fontSize: "0.65rem", color: "#6b7280", marginTop: 2 }}>
                  ✓ {t.doneBy ?? "—"}{t.doneAt ? ` · ${t.doneAt}` : ""}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>

      {/* ── ปิดการขาย (Won / Lost) → 100% ── */}
      <div style={{ marginTop: 14, borderTop: "1px solid #eef0f4", paddingTop: 14 }}>
        {closed ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 14px", borderRadius: 10, background: lead.status === "PAID" ? "#e5faf0" : "#fee2e2" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              {lead.status === "PAID" ? <Trophy size={18} color="#059669" /> : <XCircle size={18} color="#dc2626" />}
              <div>
                <div style={{ fontSize: "0.86rem", fontWeight: 800, color: lead.status === "PAID" ? "#059669" : "#dc2626" }}>
                  {lead.status === "PAID" ? "ปิดการขายสำเร็จ (Won)" : "ปิดการขายไม่สำเร็จ (Lost)"}
                </div>
                {lead.status === "CANCELLED" && lead.lostReason && <div style={{ fontSize: "0.72rem", color: "#991b1b" }}>เหตุผล: {lead.lostReason}</div>}
              </div>
            </div>
            <button type="button" onClick={reopen} className="btn btn-secondary btn-sm" style={{ color: "#374151" }}>
              <RotateCcw size={13} /> เปิดใหม่
            </button>
          </div>
        ) : lostOpen ? (
          <div style={{ padding: "12px 14px", borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca" }}>
            <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#dc2626", marginBottom: 8 }}>เลือกเหตุผลที่ปิดการขายไม่ได้</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
              {loadLostReasons().map(r => (
                <button key={r} type="button" onClick={() => setLostReason(r)}
                  style={{ padding: "8px 10px", borderRadius: 8, cursor: "pointer", fontSize: "0.8rem", fontFamily: "inherit", textAlign: "left",
                    border: `1px solid ${lostReason === r ? "#dc2626" : "#e5e7eb"}`, background: lostReason === r ? "#fee2e2" : "#fff",
                    color: lostReason === r ? "#dc2626" : "#2D2D2D", fontWeight: lostReason === r ? 700 : 400 }}>{r}</button>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setLostOpen(false); setLostReason(""); }}>ยกเลิก</button>
              <button type="button" className="btn btn-sm" disabled={!lostReason}
                style={{ background: lostReason ? "#dc2626" : "#f3f4f6", color: lostReason ? "#fff" : "#9ca3af", cursor: lostReason ? "pointer" : "not-allowed" }}
                onClick={() => close("lost", lostReason)}>ยืนยันปิดการขาย</button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <span style={{ flex: 1, fontSize: "0.8rem", fontWeight: 700, color: "#374151", alignSelf: "center" }}>ปิดการขาย :</span>
            <button type="button" className="btn btn-sm" onClick={() => close("won")}
              style={{ background: "#059669", color: "#fff" }}><Trophy size={13} /> ได้งาน (Won)</button>
            <button type="button" className="btn btn-sm" onClick={() => setLostOpen(true)}
              style={{ background: "#fff", color: "#dc2626", border: "1px solid #fecaca" }}><XCircle size={13} /> ไม่ได้งาน (Lost)</button>
          </div>
        )}
      </div>
    </div>
  );
}
