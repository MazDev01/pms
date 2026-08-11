"use client";

// ─── ตารางฐานข้อมูลลูกค้าทั้งเครือ ───────────────────────────────────────────────
// HQ ดูอย่างเดียว — มีแต่ปุ่ม "ดู" ไม่มี เพิ่ม/แก้ไข/ลบ
// ช่องที่ไม่มีข้อมูลจริง (ลูกค้าที่ยังไม่มีใบปิดการขาย) ขึ้น "—" ไม่เดาแทน
import { Eye } from "lucide-react";
import { customerCode, fmtISOToThai } from "@pms/shared/lib/mock";
import { regionOf } from "@pms/shared/lib/customerDb";
import type { HQCustomerPageRow } from "@pms/shared/lib/data/ports";
import { ClickableRow } from "@pms/shared/components/ui/ClickableRow";

const PRIMARY = "#003366";
const DASH = <span style={{ color: "#9ca3af" }}>—</span>;

function fmtM(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString("th-TH");
}

/** รายการหลายค่าในช่องเดียว — เกิน 1 ค่าแสดงตัวแรก + "+n" (กันตารางบวม) */
function MultiCell({ values }: { values: string[] }) {
  if (!values.length) return DASH;
  return (
    <span style={{ whiteSpace: "nowrap" }} title={values.join(", ")}>
      {values[0]}
      {values.length > 1 && (
        <span style={{ color: "var(--muted-foreground)", fontWeight: 500 }}> +{values.length - 1}</span>
      )}
    </span>
  );
}

export function CustomerTable({ rows, onView, pagination, loading }: {
  rows: HQCustomerPageRow[]; onView: (r: HQCustomerPageRow) => void;
  /** มีเมื่อแบ่งหน้าที่ DB (supabase) — local/ยังไม่กลับ: undefined = โชว์ rows ทั้งชุด ไม่มีแถบเปลี่ยนหน้า */
  pagination?: { page: number; pageCount: number; total: number; onPage: (p: number) => void };
  /** true = RPC หน้าแรกยังไม่กลับ (supabase) — ต้องแยกจาก "กรองแล้วไม่เจอจริง ๆ" ไม่งั้นโชว์ "ไม่พบลูกค้า"
   *  ทั้งที่กำลังโหลดอยู่ (ผู้ใช้เข้าใจผิดว่าไม่มีข้อมูล + คลิกแถวก็ไม่มีอะไรเกิดขึ้นเพราะยังไม่มีแถวจริง) */
  loading?: boolean;
}) {
  return (
    <div className="table-wrap" style={{ borderTop: "none" }}>
      <table>
        {/* ความกว้างทุกคอลัมน์กำหนดที่นี่เท่านั้น (table-layout: fixed) — เพิ่ม/ลบคอลัมน์ต้องแก้ที่นี่ด้วย */}
        <colgroup>
          <col style={{ width: "7%", minWidth: 92 }} />{/* รหัสลูกค้า */}
          <col style={{ width: "15%", minWidth: 148 }} />{/* ลูกค้า — ยาวเกินตัด + tooltip */}
          <col style={{ width: "5%", minWidth: 60 }} />{/* รหัสตัวแทน */}
          <col style={{ width: "12%", minWidth: 130 }} />{/* ชื่อตัวแทน */}
          <col style={{ width: "8%", minWidth: 84 }} />{/* จังหวัด */}
          <col style={{ width: "7%", minWidth: 76 }} />{/* ภาค */}
          <col style={{ width: "10%", minWidth: 104 }} />{/* ประเภทอาคาร */}
          <col style={{ width: "9%", minWidth: 96 }} />{/* แม่แบบ */}
          <col style={{ width: "8%", minWidth: 92 }} />{/* วันที่ส่งมอบ */}
          <col style={{ width: "7%", minWidth: 96 }} />{/* ยอดซื้อรวม — หัวคอลัมน์ต้องอ่านครบ (th ไม่ตัดบรรทัด) */}
          <col style={{ width: "8%", minWidth: 92 }} />{/* ซื้อล่าสุด */}
          <col style={{ width: "4%", minWidth: 56 }} />{/* ปุ่มดู */}
        </colgroup>
        <thead>
          <tr>
            <th>รหัสลูกค้า</th>
            <th>ลูกค้า</th>
            <th style={{ paddingRight: 0 }}>รหัส</th>
            <th style={{ paddingLeft: 8 }}>ชื่อตัวแทน</th>
            <th>จังหวัด</th>
            <th>ภาค</th>
            <th>ประเภทอาคาร</th>
            <th>แม่แบบ</th>
            <th>วันที่ส่งมอบ</th>
            <th className="num">ยอดซื้อรวม</th>
            <th>ซื้อล่าสุด</th>
            <th></th>{/* ปุ่มดู — ไม่ต้องมีหัวคอลัมน์ */}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={12} style={{ textAlign: "center", padding: "40px 14px", color: "#6b7280" }}>
                {loading ? "กำลังโหลด…" : "ไม่พบลูกค้า"}
              </td>
            </tr>
          ) : (
            rows.map(c => (
              // c.id นับแยกต่อสาขา (ไม่ใช่เลขทั้งเครือ) — สาขาต่างกันมี id ชนกันได้ปกติ (เช่นทุกสาขามีลูกค้า id=1)
              // key ต้องกันชนด้วย dealerCode คู่กัน ไม่งั้น React เจอ key ซ้ำข้ามสาขา (duplicate key warning จริง)
              <ClickableRow key={`${c.dealerCode}-${c.id}`} onActivate={() => onView(c)} label={`เปิดรายละเอียดลูกค้า ${c.name}`}>
                <td style={{ whiteSpace: "nowrap", fontWeight: 700, color: PRIMARY, fontFamily: "monospace" }}>
                  {customerCode(c.dealerCode, c.id)}
                </td>
                <td style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={c.name}>{c.name}</td>
                <td style={{ whiteSpace: "nowrap", fontWeight: 700, color: PRIMARY, paddingRight: 0 }}>{c.dealerCode}</td>
                <td style={{ whiteSpace: "nowrap", paddingLeft: 8, overflow: "hidden", textOverflow: "ellipsis" }} title={c.dealerName}>{c.dealerName}</td>
                <td style={{ whiteSpace: "nowrap" }}>{c.province || DASH}</td>
                <td style={{ whiteSpace: "nowrap", color: "#6b7280" }}>{regionOf(c.province) ?? DASH}</td>
                <td><MultiCell values={c.buildingTypes} /></td>
                <td><MultiCell values={c.templates} /></td>
                <td style={{ whiteSpace: "nowrap", color: "#6b7280" }}>{c.deliveredAt ? fmtISOToThai(c.deliveredAt) : DASH}</td>
                <td className="num" style={{ whiteSpace: "nowrap", fontWeight: c.totalValue > 0 ? 700 : 400, color: c.totalValue > 0 ? PRIMARY : "#6b7280" }}>
                  {c.totalValue > 0 ? fmtM(c.totalValue) : DASH}
                </td>
                <td style={{ whiteSpace: "nowrap", color: "#6b7280" }}>{c.lastPurchaseAt ? fmtISOToThai(c.lastPurchaseAt) : DASH}</td>
                <td onClick={e => e.stopPropagation()}>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button title="ดูรายละเอียด" onClick={() => onView(c)}
                      style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid #dbe3ec", background: "#fff", color: PRIMARY, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Eye size={13} />
                    </button>
                  </div>
                </td>
              </ClickableRow>
            ))
          )}
        </tbody>
      </table>
      {pagination && pagination.pageCount > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 14px", borderTop: "1px solid #f2f4f7", fontSize: "0.72rem", color: "#6b7280" }}>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>ทั้งหมด {pagination.total.toLocaleString()} ราย · หน้า {pagination.page + 1}/{pagination.pageCount}</span>
          <span style={{ display: "flex", gap: 6 }}>
            <button className="btn btn-secondary btn-sm" disabled={pagination.page <= 0} onClick={() => pagination.onPage(pagination.page - 1)}>ก่อนหน้า</button>
            <button className="btn btn-secondary btn-sm" disabled={pagination.page >= pagination.pageCount - 1} onClick={() => pagination.onPage(pagination.page + 1)}>ถัดไป</button>
          </span>
        </div>
      )}
    </div>
  );
}
