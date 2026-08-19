"use client";

// ─── ตัวแก้รายงานติดตามของลูกค้าเป้าหมาย — แหล่งเดียวของทั้งแอป ──────────────────
// เดิมเขียนฝังอยู่ในหน้า /leads หน้าเดียว · ย้ายออกมาเพื่อให้แผงงานขายในหน้า /customers ใช้ซ้ำได้
// รายงานเก็บที่ LeadRow.report = ผูกกับ "ดีล" ไม่ใช่ลูกค้า → 1 ลูกค้ามีหลายดีล แต่ละดีลมีรายงานของตัวเอง
import { useState, useRef, useEffect } from "react";
import { buildLeadReport, type LeadRow } from "@pms/shared/lib/mock";
import { APP_NOW } from "@pms/shared/context/FilterContext";
import { leads as leadsRepo } from "@pms/shared/lib/data";
import { logRepoRead } from "@pms/shared/lib/repoLog";

const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const thaiDateStr = (d: Date) => `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
// วันหัวรายงาน = "วันนี้" ของระบบ (APP_NOW) ไม่ใช่นาฬิกาเครื่อง — เดิม new Date() ได้วันจริงที่ล้ำยุคข้อมูล
const todayStr = () => thaiDateStr(APP_NOW);

export function ReportEditor({ lead, onSave }: { lead: LeadRow; onSave: (l: LeadRow) => void }) {
  // ⚠ รายการลูกค้าเป้าหมายไม่ได้ส่ง report มาด้วย (เป็นข้อความยาว กินขนส่งราว 1 ใน 3 ของขนาดแถว)
  //   ตัวนี้จึงโหลดเองตอนเปิด — ทำที่เดียวตรงนี้ ทุกหน้าที่เรียกใช้จึงปลอดภัยเหมือนกัน
  //   ห้ามเดาว่าไม่มีรายงานแล้วเสนอเทมเพลตทันที — ผู้ใช้กดบันทึกครั้งเดียว รายงานจริงหายทันที
  const [text, setText] = useState("");
  const [พร้อม, setพร้อม] = useState(false);   // รู้เนื้อหาจริงของรายนี้แล้วหรือยัง
  const [เดิม, setเดิม] = useState("");             // ข้อความที่บันทึกไว้จริง (ใช้เทียบว่ามีการแก้หรือยัง)
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let alive = true;
    const ใช้ = (r: string | undefined) => {
      if (!alive) return;
      setเดิม(r ?? "");
      setText(r ?? buildLeadReport(lead, todayStr()));
      setพร้อม(true);
    };
    if (lead.report !== undefined) { ใช้(lead.report); return () => { alive = false; }; }
    setพร้อม(false); setText("");
    leadsRepo.get(lead.id)
      .then(full => ใช้(full?.report ?? ""))
      .catch(e => { logRepoRead("leads.get", e); if (alive) setพร้อม(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id, lead.report]);

  const dirty = พร้อม && text !== เดิม;

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
      <div style={{ fontSize: "0.65rem", fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: "#003366", marginBottom: 10 }}>
        รายงานการติดตาม · แก้ไขได้ทั้งหมด
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
        <label style={lbl}>เนื้อหารายงาน</label>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" onClick={insertBullet} className="btn btn-secondary btn-sm" style={{ color: "#374151", padding: "4px 10px" }}>+ หัวข้อย่อย</button>
          <button type="button" onClick={resetTemplate} className="btn btn-secondary btn-sm" style={{ color: "#374151", padding: "4px 10px" }}>รีเซ็ตเทมเพลต</button>
        </div>
      </div>
      <textarea ref={ref} aria-label="เนื้อหารายงาน" value={พร้อม ? text : "กำลังโหลดรายงาน…"} onChange={e => setText(e.target.value)}
        readOnly={!พร้อม} spellCheck={false}
        style={{ width: "100%", minHeight: 320, padding: "12px 14px", borderRadius: 10, border: "1px solid #e5e7eb",
          fontSize: "0.8rem", lineHeight: 1.7, fontFamily: "inherit", color: "#2D2D2D", background: "#fff", resize: "vertical", whiteSpace: "pre-wrap" }} />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
        {dirty && <button onClick={() => setText(เดิม || buildLeadReport(lead, todayStr()))} className="btn btn-secondary btn-sm" style={{ color: "#374151" }}>ยกเลิก</button>}
        <button onClick={() => onSave({ ...lead, report: text })} disabled={!dirty}
          className="btn btn-primary btn-sm" style={!dirty ? { opacity: 0.5, cursor: "not-allowed" } : undefined}>
          บันทึกรายงาน
        </button>
      </div>
    </div>
  );
}
