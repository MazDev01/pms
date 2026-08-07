"use client";

// ─── ตัวแก้รายงานติดตามของลูกค้าเป้าหมาย — แหล่งเดียวของทั้งแอป ──────────────────
// เดิมเขียนฝังอยู่ในหน้า /leads หน้าเดียว · ย้ายออกมาเพื่อให้แผงงานขายในหน้า /customers ใช้ซ้ำได้
// รายงานเก็บที่ LeadRow.report = ผูกกับ "ดีล" ไม่ใช่ลูกค้า → 1 ลูกค้ามีหลายดีล แต่ละดีลมีรายงานของตัวเอง
import { useState, useRef, useEffect } from "react";
import { buildLeadReport, type LeadRow } from "@pms/shared/lib/mock";
import { APP_NOW } from "@pms/shared/context/FilterContext";

const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const thaiDateStr = (d: Date) => `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
// วันหัวรายงาน = "วันนี้" ของระบบ (APP_NOW) ไม่ใช่นาฬิกาเครื่อง — เดิม new Date() ได้วันจริงที่ล้ำยุคข้อมูล
const todayStr = () => thaiDateStr(APP_NOW);

export function ReportEditor({ lead, onSave }: { lead: LeadRow; onSave: (l: LeadRow) => void }) {
  // ถ้ายังไม่มีรายงาน (ลีดเก่า) → เปิดด้วยเทมเพลตมาตรฐาน (พรีฟิลจากข้อมูลลีด) ให้แก้ต่อได้
  const initial = () => lead.report ?? buildLeadReport(lead, todayStr());
  const [text, setText] = useState(initial);
  const ref = useRef<HTMLTextAreaElement>(null);
  // ตั้งใจให้รีเซ็ตข้อความ "เฉพาะตอนเปลี่ยนลีด" เท่านั้น — ไม่ใช่ทุกครั้งที่ initial ถูกสร้างใหม่
  // ไม่งั้นสิ่งที่ผู้ใช้กำลังพิมพ์ค้างอยู่จะถูกเขียนทับด้วยเทมเพลตตั้งต้นระหว่างพิมพ์
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setText(initial()); }, [lead.id]);
  const dirty = text !== (lead.report ?? "");

  // แทรก bullet บรรทัดใหม่ที่ตำแหน่งเคอร์เซอร์
  function insertBullet() {
    const el = ref.current; if (!el) return;
    const pos = el.selectionStart ?? text.length;
    const before = text.slice(0, pos), after = text.slice(pos);
    const needNL = before && !before.endsWith("\n");
    const insert = `${needNL ? "\n" : ""}- `;
    setText(before + insert + after);
    requestAnimationFrame(() => { el.focus(); const c = (before + insert).length; el.setSelectionRange(c, c); });
  }
  function resetTemplate() { setText(buildLeadReport(lead, todayStr())); }

  const lbl: React.CSSProperties = { display: "block", fontSize: "0.65rem", fontWeight: 700, color: "#6b7280", marginBottom: 6 };

  return (
    <div>
      <div style={{ fontSize: "0.65rem", fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: "#003366", marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid #C0C0C044" }}>
        รายงานการติดตาม · แก้ไขได้ทั้งหมด
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
        <label style={lbl}>เนื้อหารายงาน</label>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" onClick={insertBullet} className="btn btn-secondary btn-sm" style={{ color: "#374151", padding: "4px 10px" }}>+ หัวข้อย่อย</button>
          <button type="button" onClick={resetTemplate} className="btn btn-secondary btn-sm" style={{ color: "#374151", padding: "4px 10px" }}>รีเซ็ตเทมเพลต</button>
        </div>
      </div>
      <textarea ref={ref} aria-label="เนื้อหารายงาน" value={text} onChange={e => setText(e.target.value)}
        spellCheck={false}
        style={{ width: "100%", minHeight: 320, padding: "12px 14px", borderRadius: 10, border: "1px solid #e5e7eb",
          fontSize: "0.8rem", lineHeight: 1.7, fontFamily: "inherit", color: "#2D2D2D", background: "#fff", resize: "vertical", whiteSpace: "pre-wrap" }} />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
        {dirty && <button onClick={() => setText(initial())} className="btn btn-secondary btn-sm" style={{ color: "#374151" }}>ยกเลิก</button>}
        <button onClick={() => onSave({ ...lead, report: text })} disabled={!dirty}
          className="btn btn-primary btn-sm" style={!dirty ? { opacity: 0.5, cursor: "not-allowed" } : undefined}>
          บันทึกรายงาน
        </button>
      </div>
    </div>
  );
}
