"use client";

// ─── ตารางใบเสนอราคาทั้งเครือ ─────────────────────────────────────────────────
// อ่านอย่างเดียว — มีปุ่ม "ดู" เท่านั้น ไม่มีสร้าง/แก้ไข/ลบ/อนุมัติ (HQ เป็นเจ้าของข้อมูล แต่ไม่ออกใบเอง)
// คอลัมน์ "วันที่เปิดอ่าน" ไม่มี เพราะระบบไม่เก็บ — เก็บได้แค่ว่าสถานะปัจจุบันคือเปิดอ่านแล้วหรือยัง
import { Eye } from "lucide-react";
import { quotationStatusLabel, quotationStatusColor } from "@/lib/mock";
import { fmtBaht } from "@/lib/format";
import type { QuoteRow } from "@/lib/hqQuotations";

const PRIMARY = "#003366";
const MUTED = "#6b7280";

export function QuotationTable({ rows, onView, maxDiscount }: {
  rows: QuoteRow[];
  onView: (q: QuoteRow) => void;
  maxDiscount: number;
}) {
  return (
    <div className="card" style={{ marginBottom: 0 }}>
      <div className="table-wrap" style={{ borderTop: "none" }}>
        <table>
          {/* ความกว้างคุมที่ colgroup เท่านั้น (ตาราง table-layout:fixed — ใส่ที่ th ไม่มีผล)
              ค่าที่วัดจากเบราว์เซอร์จริง (td padding ข้างละ 16px):
              ปุ่ม "ดู" 53px → ต้องการ 96px · badge "เปิดอ่านแล้ว" → ต้องการ ~112px
              วันที่ไทยเต็ม "27 มิ.ย. 2569" → ต้องการ ~112px
              เหลือให้ ตัวแทน/ลูกค้า/ประเภทอาคาร ยืดหยุ่น (ชื่อยาวตัด … ตามปกติ) */}
          <colgroup>
            <col style={{ width: "10%", minWidth: 104 }} />
            <col style={{ width: "7%", minWidth: 78 }} />
            <col style={{ width: "10%", minWidth: 110 }} />
            <col style={{ width: "10%", minWidth: 120 }} />
            <col style={{ width: "9%", minWidth: 104 }} />
            <col style={{ width: "8%", minWidth: 88 }} />
            <col style={{ width: "10%", minWidth: 114 }} />
            <col style={{ width: "7%", minWidth: 78 }} />
            <col style={{ width: "10%", minWidth: 112 }} />
            <col style={{ width: "10%", minWidth: 112 }} />
            <col style={{ width: "9%", minWidth: 96 }} />
          </colgroup>
          <thead>
            <tr>
              <th>เลขที่</th>
              <th>รหัส</th>
              <th>ตัวแทน</th>
              <th>ลูกค้า</th>
              <th>ประเภทอาคาร</th>
              <th className="num">มูลค่า</th>
              <th>สถานะ</th>
              <th>เปิดอ่าน</th>
              <th>วันที่สร้าง</th>
              <th>ใช้ได้ถึง</th>
              <th>ดู</th>
            </tr>
          </thead>
          <tbody>
            {!rows.length ? (
              <tr><td colSpan={11} style={{ textAlign: "center", padding: "32px 14px", color: MUTED }}>ไม่พบข้อมูลที่ค้นหา</td></tr>
            ) : rows.map(q => {
              const sc = quotationStatusColor[q.status];
              const overCap = q.discountPct > maxDiscount;
              return (
                <tr key={q.id} onClick={() => onView(q)} style={{ cursor: "pointer" }}>
                  <td style={{ color: PRIMARY, fontWeight: 700, whiteSpace: "nowrap" }}>{q.quoteNo}</td>
                  <td>
                    <span className="badge" style={{ background: "#eef2f7", color: PRIMARY, fontFamily: "monospace" }}>{q.dealerCode}</span>
                  </td>
                  {/* ชื่อยาวตัด … — ใส่ title ให้ hover อ่านเต็มได้ (ชื่อเต็มอยู่ในลิ้นชักด้วย) */}
                  <td title={q.dealerName} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.dealerName}</td>
                  <td title={q.customer} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.customer}</td>
                  <td title={q.productLine} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.productLine}</td>
                  <td className="num" style={{ color: PRIMARY, fontWeight: 800, whiteSpace: "nowrap" }}>
                    {fmtBaht(q.valueNum)}
                    {overCap && <span title={`ส่วนลด ${q.discountPct}% เกินเพดาน ${maxDiscount}%`} style={{ marginLeft: 5, color: "#dc2626", fontWeight: 800 }}>!</span>}
                  </td>
                  <td>
                    <span className="badge" style={{ background: sc.bg, color: sc.text, whiteSpace: "nowrap" }}>{quotationStatusLabel[q.status]}</span>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {!q.sent
                      ? <span style={{ color: "#9ca3af" }}>—</span>
                      : q.opened
                        ? <span style={{ color: "#7c3aed", fontWeight: 700 }}>ใช่</span>
                        : <span style={{ color: MUTED }}>ไม่</span>}
                  </td>
                  <td style={{ color: MUTED, fontSize: "0.78rem", whiteSpace: "nowrap" }}>{q.createdAt}</td>
                  <td style={{ color: MUTED, fontSize: "0.78rem", whiteSpace: "nowrap" }}>{q.validUntil ?? "—"}</td>
                  <td>
                    <button
                      onClick={e => { e.stopPropagation(); onView(q); }}
                      className="btn btn-secondary btn-sm"
                      title="ดูรายละเอียด"
                      style={{ gap: 4 }}
                    >
                      <Eye size={13} /> ดู
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
