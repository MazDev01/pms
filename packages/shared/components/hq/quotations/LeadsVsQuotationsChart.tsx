"use client";

// ─── #1 ลีด → ใบเสนอราคา รายตัวแทน ────────────────────────────────────────────
// วัดว่าแต่ละสาขาเปลี่ยน "ลีด" เป็น "ใบเสนอราคา" ได้ดีแค่ไหน
// ลีด = ลีดจริงในระบบที่ผูก dealerCode · ใบเสนอราคา = ใบของสาขานั้นในตัวกรองปัจจุบัน
// อัตรา = ใบเสนอราคา ÷ ลีด (เกิน 100% ได้ — ลีดหนึ่งรายออกใบได้หลายใบ)
import { TopNRows } from "@pms/shared/components/hq/TopNRows";
import { groupBy, type QuoteRow } from "@pms/shared/lib/hqQuotations";
import type { LeadRow } from "@pms/shared/lib/mock";

const QUOTE_COLOR = "#003366";
const LEAD_COLOR = "#94a3b8";

export function LeadsVsQuotationsChart({ rows, leads }: { rows: QuoteRow[]; leads: LeadRow[] }) {
  const quoteByDealer = groupBy(rows, r => r.dealerCode);
  const leadByDealer = new Map<string, number>();
  leads.forEach(l => {
    const code = l.dealerCode || "";
    if (code) leadByDealer.set(code, (leadByDealer.get(code) ?? 0) + 1);
  });

  // แสดงทุกสาขาที่มีลีดหรือมีใบเสนอราคาอย่างน้อยหนึ่งอย่าง
  const codes = [...new Set([...quoteByDealer.keys(), ...leadByDealer.keys()])];
  const bars = codes.map(code => {
    const quotes = quoteByDealer.get(code) ?? [];
    return {
      code,
      name: quotes[0]?.dealerName ?? code,
      leads: leadByDealer.get(code) ?? 0,
      quotes: quotes.length,
    };
  }).sort((a, b) => b.quotes - a.quotes || b.leads - a.leads);

  const max = Math.max(...bars.map(b => Math.max(b.leads, b.quotes)), 1);

  return (
    <div className="card chart-l" style={{ marginBottom: 0 }}>
      <div className="card-header">
        <div>
          <div className="card-title">ลีด → ใบเสนอราคา รายตัวแทน</div>
          <div className="card-desc">วัดการเปลี่ยนลีดเป็นใบเสนอราคา</div>
        </div>
        <span style={{ display: "flex", gap: 10, fontSize: "0.62rem", color: "var(--muted-foreground)", flexShrink: 0 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: LEAD_COLOR }} />ลีด
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
                {/* ไม่มีลีด = หารไม่ได้ → ขึ้น "—" ห้ามโชว์ 0% ให้เข้าใจผิด */}
                {b.leads ? `${Math.round((b.quotes / b.leads) * 100)}%` : "—"}
              </span>
            </div>
            {/* แถบลีด */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
              <div style={{ flex: 1, height: 6, background: "var(--muted)", borderRadius: 999, overflow: "hidden" }}>
                <div className="bar-grow" style={{ height: "100%", width: `${Math.round(b.leads / max * 100)}%`, background: LEAD_COLOR, borderRadius: 999 }} />
              </div>
              <span style={{ fontSize: "0.62rem", color: "var(--muted-foreground)", fontWeight: 700, minWidth: 46, textAlign: "right" }}>{b.leads} ลีด</span>
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
