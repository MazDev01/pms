"use client";

// ─── ลิ้นชักรายละเอียดใบเสนอราคา (เปิดจากปุ่ม "ดู" — ไม่เปลี่ยนหน้า) ──────────
// อ่านอย่างเดียว ไม่มีปุ่มแก้ไข/ลบ/อนุมัติ
//
// หน้าตาต้องเป็นชุดเดียวกับแผง "ลูกค้าเป้าหมายทั้งเครือ" (บอสสั่ง 2 ก.ย. 69)
//   แผงลอยจากขอบจอ มนทุกมุม · หัวแผงมีวงย่อชื่อ + ป้ายสถานะ/มูลค่า
//   · การ์ดสรุปบนสุด · เนื้อหาแบ่งเป็นการ์ดหัวข้อพร้อมไอคอน (PanelSection/PanelRow)
//   ใช้ชิ้นส่วนกลางชุดเดียวกัน (DetailPanel) — แก้ที่เดียวแล้วเปลี่ยนเหมือนกันทุกหน้า
//
// สิ่งที่ระบบไม่มีข้อมูล จึงไม่แสดง (ห้ามกุ):
//  · ประวัติการเปิดอ่าน — ลบทั้งฟีเจอร์แล้ว (ไม่มีการติดตามจริง)
//  · ไทม์ไลน์/ประวัติการแก้ไขของ "ใบเสนอราคา" — ระบบเก็บไทม์ไลน์ไว้ที่ดีล ไม่ได้ผูกรายใบ
//  · เอกสารแนบรายใบ — คลังไฟล์ผูกกับลูกค้า/ลูกค้าเป้าหมาย ไม่ได้ผูกกับเลขที่ใบเสนอราคา
//  · รายการสินค้า — มีเฉพาะใบที่ตัวแทนสร้างจริง ที่เหลือขึ้น "—"
import { X, FileText, User, Store, Wallet, Package, CalendarDays, CalendarClock, Clock, MapPin, IdCard, UserCheck, Building2 } from "lucide-react";
import { useModalA11y } from "@pms/shared/lib/useModalA11y";
import { quotationStatusLabel, quotationStatusColor } from "@pms/shared/lib/mock";
import { fmtBaht } from "@pms/shared/lib/format";
import { regionDisplay, type QuoteRow } from "@pms/shared/lib/hqQuotations";
import { PanelSection, PanelRow, PanelStats, PanelStat, ย่อชื่อ } from "@pms/shared/components/ui/DetailPanel";

const PRIMARY = "#003366";

export function QuotationDrawer({ quote, onClose }: {
  quote: QuoteRow;
  onClose: () => void;
}) {
  const sc = quotationStatusColor[quote.status];
  const items = quote.lineItems ?? [];
  // Esc ปิดได้ · Tab วนอยู่ในลิ้นชัก · ปิดแล้วโฟกัสกลับไปที่แถวที่กดเปิด
  const dialogRef = useModalA11y<HTMLElement>(onClose);
  // ใบที่ปิดการขายแล้ว/ยังไม่ได้ส่ง อ่านจากสถานะเดียวกับที่ตารางใช้ — ไม่คิดเงื่อนไขใหม่ให้ขัดกัน
  const ปิดการขายแล้ว = quote.status === "won";
  const หมดอายุ = quote.status === "expired";

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(45,45,45,.45)", zIndex: 200 }}>
      {/* แผงลอยจากขอบจอเล็กน้อยแล้วมนทุกมุม — มาตรฐานเดียวกับแผงลูกค้าเป้าหมายทั้งเครือ */}
      <aside
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="รายละเอียดใบเสนอราคา"
        onClick={e => e.stopPropagation()}
        className="side-drawer"
        style={{ position: "fixed", top: 12, right: 12, bottom: 12, width: 440, maxWidth: "calc(100vw - 24px)",
          background: "#F8FAFC", boxShadow: "0 24px 70px rgba(0,0,0,.24)", borderRadius: 18, overflow: "hidden",
          display: "flex", flexDirection: "column" }}
      >
        {/* หัวแผง — เลขที่ใบเด่น + วงย่อชื่อลูกค้า · ป้ายสถานะกับมูลค่าอยู่บรรทัดเดียวกัน */}
        <div style={{ background: "linear-gradient(135deg,#003366 0%,#00284F 60%,#001B36 100%)", padding: "18px 20px 16px",
          display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 12, minWidth: 0 }}>
            <span style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.2)",
              color: "#fff", fontWeight: 800, fontSize: "0.92rem", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {ย่อชื่อ(quote.customer)}
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{quote.quoteNo}</div>
              <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,.7)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {quote.customer} · {quote.dealerCode}
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 9, flexWrap: "wrap" }}>
                <span className="badge" style={{ background: sc.bg, color: sc.text }}>{quotationStatusLabel[quote.status]}</span>
                <span className="badge" style={{ background: "rgba(255,255,255,.15)", color: "#fff" }}>{fmtBaht(quote.valueNum)}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} aria-label="ปิด" title="ปิด" style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid rgba(255,255,255,.2)",
            background: "rgba(255,255,255,.12)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px 20px" }}>
          {/* แถบสรุปบนสุด — มูลค่ากับอายุใบ อ่านได้ตั้งแต่ยังไม่เลื่อนจอ (เหมือนแผงลูกค้าเป้าหมาย) */}
          <PanelStats>
            <PanelStat label="มูลค่างาน (ก่อน VAT)" value={fmtBaht(quote.valueNum)} />
            <PanelStat
              label="สถานะใบ"
              tone={ปิดการขายแล้ว ? "good" : "plain"}
              value={quotationStatusLabel[quote.status]}
              sub={หมดอายุ ? "เลยวันที่ยืนราคาแล้ว"
                : quote.agingDays != null ? `อายุใบ ${quote.agingDays} วัน` : undefined}
            />
          </PanelStats>

          <PanelSection icon={FileText} title="ข้อมูลใบเสนอราคา">
            <PanelRow icon={CalendarDays} label="วันที่สร้าง" value={quote.createdAt} />
            <PanelRow icon={CalendarClock} label="ใช้ได้ถึง" value={quote.validUntil} />
            <PanelRow icon={Clock} label="อายุใบ" value={quote.agingDays != null ? `${quote.agingDays} วัน` : undefined} />
          </PanelSection>

          <PanelSection icon={User} title="ข้อมูลลูกค้า">
            <PanelRow icon={User} label="ชื่อลูกค้า" value={quote.customer} />
            <PanelRow icon={Building2} label="ประเภทอาคาร" value={quote.productLine} />
            <PanelRow icon={Wallet} label="มูลค่างาน (ก่อน VAT)" value={fmtBaht(quote.valueNum)} strong />
          </PanelSection>

          <PanelSection icon={Store} title="ข้อมูลตัวแทนจำหน่าย">
            <PanelRow icon={IdCard} label="รหัสตัวแทน" value={quote.dealerCode} />
            <PanelRow icon={Store} label="ตัวแทน" value={quote.dealerName} />
            <PanelRow icon={MapPin} label="จังหวัด" value={quote.dealerProvince} />
            <PanelRow icon={MapPin} label="ภูมิภาค" value={regionDisplay(quote.region)} />
            <PanelRow icon={UserCheck} label="ผู้รับผิดชอบ" value={quote.salesperson} />
          </PanelSection>

          <PanelSection icon={Package} title="รายการสินค้า" bodyStyle={items.length ? { padding: 0 } : undefined}>
            {!items.length ? (
              <div style={{ fontSize: "0.76rem", color: "#94A3B8", padding: "10px 0" }}>
                — ใบนี้ไม่มีรายการสินค้าบันทึกไว้ในระบบ
              </div>
            ) : (
              <div>
                {items.map((li, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "10px 12px",
                    borderTop: i ? "1px solid #F1F5F9" : "none" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "#1F2937", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{li.name}</div>
                      <div style={{ fontSize: "0.66rem", color: "#64748B", marginTop: 2 }}>{li.qty.toLocaleString()} {li.unit} × {fmtBaht(li.unitPrice)}</div>
                    </div>
                    <div style={{ fontSize: "0.76rem", fontWeight: 800, color: "#1F2937", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                      {fmtBaht(li.qty * li.unitPrice)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </PanelSection>
        </div>

        {/* แถบล่าง — บอกขอบเขตสิทธิ์ให้ชัด + ปุ่มปิดที่นิ้วโป้งถึง (เหมือนแผงลูกค้าเป้าหมาย) */}
        <div style={{ borderTop: "1px solid #E7EDF4", background: "#fff", padding: "10px 14px", display: "flex",
          alignItems: "center", justifyContent: "space-between", gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: "0.68rem", color: "#94A3B8", lineHeight: 1.5 }}>
            สำนักงานใหญ่ดูอย่างเดียว — แก้ไข/ลบใบได้ที่ตัวแทนเจ้าของใบ
          </span>
          <button onClick={onClose} className="btn btn-secondary btn-sm" style={{ color: PRIMARY, flexShrink: 0 }}>ปิด</button>
        </div>
      </aside>
    </div>
  );
}
