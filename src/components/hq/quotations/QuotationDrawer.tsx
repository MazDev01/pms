"use client";

// ─── ลิ้นชักรายละเอียดใบเสนอราคา (เปิดจากปุ่ม "ดู" — ไม่เปลี่ยนหน้า) ──────────
// อ่านอย่างเดียว ไม่มีปุ่มแก้ไข/ลบ/อนุมัติ
//
// สิ่งที่ระบบไม่มีข้อมูล จึงไม่แสดง (ห้ามกุ):
//  · ประวัติการเปิดอ่าน — ลบทั้งฟีเจอร์แล้ว (ไม่มีการติดตามจริง)
//  · ไทม์ไลน์/ประวัติการแก้ไขของ "ใบเสนอราคา" — ระบบเก็บไทม์ไลน์ไว้ที่ดีล ไม่ได้ผูกรายใบ
//  · เอกสารแนบรายใบ — คลังไฟล์ผูกกับลูกค้า/ลีด ไม่ได้ผูกกับเลขที่ใบเสนอราคา
//  · รายการสินค้า — มีเฉพาะใบที่ดีลเลอร์สร้างจริง (CNX) ที่เหลือขึ้น "—"
import { X } from "lucide-react";
import { quotationStatusLabel, quotationStatusColor } from "@/lib/mock";
import { fmtBaht } from "@/lib/format";
import { regionDisplay, type QuoteRow } from "@/lib/hqQuotations";

const PRIMARY = "#003366";
const MUTED = "#6b7280";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: "1px solid #f2f4f7" }}>
      <span style={{ fontSize: "0.72rem", color: MUTED, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#2D2D2D", textAlign: "right", minWidth: 0, wordBreak: "break-word" }}>{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: "0.68rem", fontWeight: 800, color: PRIMARY, letterSpacing: "0.03em", marginBottom: 4 }}>{title}</div>
      {children}
    </div>
  );
}

export function QuotationDrawer({ quote, onClose }: {
  quote: QuoteRow;
  onClose: () => void;
}) {
  const sc = quotationStatusColor[quote.status];
  const items = quote.lineItems ?? [];

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(45,45,45,.45)", zIndex: 200, display: "flex", justifyContent: "flex-end" }}>
      <aside
        role="dialog"
        aria-label="รายละเอียดใบเสนอราคา"
        onClick={e => e.stopPropagation()}
        style={{ width: 460, maxWidth: "100%", background: "#F8FAFC", height: "100%", overflowY: "auto", boxShadow: "-14px 0 44px rgba(0,0,0,.18)", display: "flex", flexDirection: "column" }}
      >
        {/* หัวลิ้นชัก (ติดบน) */}
        <div style={{ position: "sticky", top: 0, zIndex: 2, background: PRIMARY, color: "#fff", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "1rem", fontWeight: 800 }}>{quote.quoteNo}</div>
            <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,.72)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {quote.customer} · {quote.dealerCode}
            </div>
          </div>
          <button onClick={onClose} aria-label="ปิด" style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,.15)", color: "#fff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <X size={15} />
          </button>
        </div>

        <div style={{ padding: 20, flex: 1 }}>

          <Section title="ข้อมูลใบเสนอราคา">
            <Row label="สถานะ" value={<span className="badge" style={{ background: sc.bg, color: sc.text }}>{quotationStatusLabel[quote.status]}</span>} />
            <Row label="วันที่สร้าง" value={quote.createdAt} />
            <Row label="ใช้ได้ถึง" value={quote.validUntil ?? "—"} />
            <Row label="อายุใบ" value={quote.agingDays != null ? `${quote.agingDays} วัน` : "—"} />
          </Section>

          <Section title="ลูกค้า">
            <Row label="ชื่อลูกค้า" value={quote.customer} />
            <Row label="ประเภทอาคาร" value={quote.productLine} />
          </Section>

          <Section title="ตัวแทนจำหน่าย">
            <Row label="รหัสตัวแทน" value={quote.dealerCode} />
            <Row label="ตัวแทน" value={quote.dealerName} />
            <Row label="จังหวัด" value={quote.dealerProvince} />
            <Row label="ภูมิภาค" value={regionDisplay(quote.region)} />
            <Row label="ผู้รับผิดชอบ" value={quote.salesperson} />
          </Section>

          <Section title="ราคา">
            <Row label="มูลค่างาน (ก่อน VAT)" value={<span style={{ color: PRIMARY }}>{fmtBaht(quote.valueNum)}</span>} />
          </Section>

          <Section title="รายการสินค้า">
            {!items.length ? (
              <div style={{ fontSize: "0.72rem", color: "#9ca3af", padding: "8px 0" }}>
                — ใบนี้ไม่มีรายการสินค้าบันทึกไว้ในระบบ
              </div>
            ) : (
              <div className="card" style={{ marginBottom: 0, padding: 0, overflow: "hidden" }}>
                {items.map((li, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "9px 12px", borderTop: i ? "1px solid #f2f4f7" : "none" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: "0.74rem", fontWeight: 600, color: "#2D2D2D", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{li.name}</div>
                      <div style={{ fontSize: "0.65rem", color: MUTED }}>{li.qty.toLocaleString()} {li.unit} × {fmtBaht(li.unitPrice)}</div>
                    </div>
                    <div style={{ fontSize: "0.74rem", fontWeight: 800, color: "#1F2937", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                      {fmtBaht(li.qty * li.unitPrice)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <div style={{ fontSize: "0.65rem", color: "#9ca3af", lineHeight: 1.6 }}>
            ข้อมูลเป็นของ Benjamin (HQ) — เจาะดูใบเสนอราคาได้ทุกตัวแทน แต่ HQ ไม่แก้ไข/ลบใบของตัวแทน
          </div>
        </div>
      </aside>
    </div>
  );
}
