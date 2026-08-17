"use client";

// ─── #1 ลูกค้าเป้าหมาย → ใบเสนอราคา รายตัวแทน ─────────────────────────────────
// วัดว่าแต่ละสาขาเปลี่ยน "ลูกค้าเป้าหมาย" เป็น "ใบเสนอราคา" ได้ดีแค่ไหน
// ลูกค้าเป้าหมาย = รายการจริงในระบบที่ผูก dealerCode · ใบเสนอราคา = ใบของสาขานั้นในตัวกรองปัจจุบัน
// อัตรา = ใบเสนอราคา ÷ ลูกค้าเป้าหมาย (เกิน 100% ได้ — ลูกค้ารายเดียวออกใบได้หลายใบ)
// ⚠️ คำที่ผู้ใช้เห็นต้องเป็น "ลูกค้าเป้าหมาย" เสมอ ห้ามใช้ "ลูกค้าเป้าหมาย" (บอสสั่ง 14 ส.ค. 69 — ดู thai-ui-glossary)
import { TopNRows } from "@pms/shared/components/hq/TopNRows";
import { type DealerAgg } from "@pms/shared/lib/hqQuotations";

const QUOTE_COLOR = "#003366";
const LEAD_COLOR = "#94a3b8";

// leadsByDealer = จำนวนลูกค้าเป้าหมายต่อรหัสสาขา (supabase: lead_summary.byDealer · local: นับจาก leadRows)
export function LeadsVsQuotationsChart({ dealerAgg, leadsByDealer }: { dealerAgg: DealerAgg[]; leadsByDealer: Record<string, number> }) {
  const quoteByDealer = new Map(dealerAgg.map(d => [d.code, d]));
  const leadByDealer = new Map<string, number>(Object.entries(leadsByDealer));

  // แสดงทุกสาขาที่มีลูกค้าเป้าหมายหรือมีใบเสนอราคาอย่างน้อยหนึ่งอย่าง
  const codes = [...new Set([...quoteByDealer.keys(), ...leadByDealer.keys()])];
  const bars = codes.map(code => ({
    code,
    name: quoteByDealer.get(code)?.name ?? code,
    leads: leadByDealer.get(code) ?? 0,
    quotes: quoteByDealer.get(code)?.count ?? 0,
  })).sort((a, b) => b.quotes - a.quotes || b.leads - a.leads);

  const max = Math.max(...bars.map(b => Math.max(b.leads, b.quotes)), 1);

  return (
    <div className="card chart-l" style={{ marginBottom: 0 }}>
      <div className="card-header">
        <div>
          <div className="card-title">ลูกค้าเป้าหมาย → ใบเสนอราคา รายตัวแทน</div>
          <div className="card-desc">มีลูกค้าเป้าหมายกี่ราย ออกใบเสนอราคาได้กี่ใบ</div>
        </div>
        <span style={{ display: "flex", gap: 10, fontSize: "0.62rem", color: "var(--muted-foreground)", flexShrink: 0 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: LEAD_COLOR }} />ลูกค้าเป้าหมาย
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: QUOTE_COLOR }} />ใบเสนอราคา
          </span>
        </span>
      </div>
      <div className="card-body" style={{ paddingTop: 6, display: "flex", flexDirection: "column" }}>
        {!bars.length ? (
          <div style={{ fontSize: "0.74rem", color: "var(--muted-foreground)" }}>—</div>
        ) : (
        <TopNRows topN={4} unit="ราย" gap={14}>
          {bars.map(b => (
          <div key={b.code}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: "0.74rem", marginBottom: 4 }}>
              <span style={{ color: "#374151", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                <span style={{ fontFamily: "monospace", fontWeight: 700, color: QUOTE_COLOR, marginRight: 6 }}>{b.code}</span>
                {b.name}
              </span>
              <span style={{ flexShrink: 0, fontVariantNumeric: "tabular-nums", fontWeight: 700, color: "var(--muted-foreground)" }}>
                {/* ไม่มีลูกค้าเป้าหมาย = หารไม่ได้ → ขึ้น "—" ห้ามโชว์ 0% ให้เข้าใจผิด */}
                {b.leads ? `${Math.round((b.quotes / b.leads) * 100)}%` : "—"}
              </span>
            </div>
            {/* แถบลูกค้าเป้าหมาย */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
              <div style={{ flex: 1, height: 6, background: "var(--muted)", borderRadius: 999, overflow: "hidden" }}>
                <div className="bar-grow" style={{ height: "100%", width: `${Math.round(b.leads / max * 100)}%`, background: LEAD_COLOR, borderRadius: 999 }} />
              </div>
              <span style={{ fontSize: "0.62rem", color: "var(--muted-foreground)", fontWeight: 700, minWidth: 46, textAlign: "right" }}>{b.leads} ราย</span>
            </div>
            {/* แถบใบเสนอราคา */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ flex: 1, height: 6, background: "var(--muted)", borderRadius: 999, overflow: "hidden" }}>
                <div className="bar-grow" style={{ height: "100%", width: `${Math.round(b.quotes / max * 100)}%`, background: QUOTE_COLOR, borderRadius: 999 }} />
              </div>
              <span style={{ fontSize: "0.62rem", color: "var(--muted-foreground)", fontWeight: 700, minWidth: 46, textAlign: "right" }}>{b.quotes} ใบ</span>
            </div>
          </div>
          ))}
        </TopNRows>
        )}
      </div>
    </div>
  );
}
