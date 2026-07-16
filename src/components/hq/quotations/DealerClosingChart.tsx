"use client";

// ─── ตัวแทนที่ออกใบเสนอราคาเยอะ แต่ปิดได้น้อย ────────────────────────────────
// รวมมาจากกราฟ "สถานะใบเสนอราคา แยกตามตัวแทน" (แท่งซ้อน 5 สถานะ) — ข้อมูลชุดเดียวกัน
// แต่จัดใหม่ให้ตอบคำถามได้เลย: เรียงตามจำนวนใบที่ส่ง + แยกผลลัพธ์ + บอกอัตราปิด
//
// ⚠️ กฎสำคัญ: "ยังรอลูกค้าตอบ" ≠ "ปิดไม่ได้"
//    ใบที่ส่งแล้วแต่ลูกค้ายังไม่ตอบ = ยังไม่รู้ผล ห้ามนับเป็นล้มเหลว
//    (จริง: CNX ออก 24 ใบ · ปิดได้ 10 · ปิดไม่ได้จริง 5 · อีก 9 ยังรอตอบ
//     ถ้าเหมา 14 ใบเป็น "ปิดไม่ได้" = กล่าวหาตัวแทนผิด)
// ไม่นับใบร่าง — ยังไม่ถึงมือลูกค้า จึงยังไม่มีสิทธิ์ปิดได้/ไม่ได้ (ตัวหารเดียวกับ "อัตราปิดการขาย" บน KPI)
import { groupBy, type QuoteRow } from "@/lib/hqQuotations";

const WON = "#059669";      // ปิดได้
const LOST = "#dc2626";     // ลูกค้าปฏิเสธ
const EXPIRED = "#d97706";  // หมดอายุ
const PENDING = "#94a3b8";  // ยังรอลูกค้าตอบ — เทา = ยังไม่รู้ผล (ห้ามใช้สีลบ)

const LEGEND = [
  { label: "ปิดได้", color: WON },
  { label: "ปิดไม่ได้", color: LOST },
  { label: "หมดอายุ", color: EXPIRED },
  { label: "ยังรอลูกค้าตอบ", color: PENDING },
];

export function DealerClosingChart({ rows }: { rows: QuoteRow[] }) {
  const dealers = [...groupBy(rows, r => r.dealerCode).entries()]
    .map(([code, list]) => {
      const n = (s: string) => list.filter(q => q.status === s).length;
      const won = n("won"), lost = n("lost"), expired = n("expired"), pending = n("sent_to_client");
      const sent = won + lost + expired + pending;   // = ใบที่ถึงมือลูกค้าแล้ว (ไม่รวมร่าง)
      return { code, name: list[0].dealerName, won, lost, expired, pending, sent };
    })
    .filter(d => d.sent > 0)                          // ตัวแทนที่มีแต่ใบร่าง = ยังไม่ได้เสนอใคร ไม่เข้าเกณฑ์
    .sort((a, b) => b.sent - a.sent || b.won - a.won); // "ออกเยอะ" มาก่อน

  // ค่าเฉลี่ยทั้งเครือ — ใช้เป็นเส้นเทียบว่าใคร "ปิดได้น้อยกว่าปกติ" (ไม่ใช่เกณฑ์ที่กุขึ้นเอง)
  const totalSent = dealers.reduce((s, d) => s + d.sent, 0);
  const totalWon = dealers.reduce((s, d) => s + d.won, 0);
  const avg = totalSent ? Math.round((totalWon / totalSent) * 100) : 0;
  const max = Math.max(...dealers.map(d => d.sent), 1);

  return (
    <div className="card" style={{ marginBottom: 0 }}>
      <div className="card-header">
        <div>
          <div className="card-title">ออกใบเสนอราคาเยอะ แต่ปิดได้น้อย</div>
          <div className="card-desc">
            เรียงตามจำนวนใบที่ส่งถึงลูกค้า · ค่าเฉลี่ยทั้งเครือปิดได้ {avg}% — ตัวแทนที่ต่ำกว่านี้ขึ้นสีแดง
          </div>
        </div>
        <span style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: "0.62rem", color: "var(--muted-foreground)", flexShrink: 0 }}>
          {LEGEND.map(l => (
            <span key={l.label} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: l.color }} />{l.label}
            </span>
          ))}
        </span>
      </div>
      <div className="card-body" style={{ paddingTop: 8, display: "flex", flexDirection: "column", gap: 13 }}>
        {!dealers.length ? (
          <div style={{ fontSize: "0.74rem", color: "var(--muted-foreground)" }}>— ไม่มีใบเสนอราคาที่ส่งถึงลูกค้าในช่วงที่เลือก</div>
        ) : dealers.map(d => {
          const conv = Math.round((d.won / d.sent) * 100);
          const below = conv < avg;
          // ความยาวแท่งเทียบกับตัวแทนที่ออกเยอะสุด → เห็น "ใครออกเยอะ" จากความยาวได้ทันที
          const w = (v: number) => `${(v / max) * 100}%`;
          return (
            <div key={d.code}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: "0.72rem", marginBottom: 5 }}>
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#003366", marginRight: 6 }}>{d.code}</span>
                  <span style={{ color: "#374151", fontWeight: 600 }}>{d.name}</span>
                </span>
                <span style={{ flexShrink: 0, fontVariantNumeric: "tabular-nums", color: "var(--muted-foreground)" }}>
                  ปิดได้ {d.won} / {d.sent} ใบ
                  <span style={{ fontWeight: 800, color: below ? LOST : WON, marginLeft: 6 }}>{conv}%</span>
                </span>
              </div>
              {/* แท่งซ้อน: ปิดได้ → ปิดไม่ได้ → หมดอายุ → ยังรอตอบ (เรียงจาก "รู้ผลแล้ว" ไป "ยังไม่รู้ผล") */}
              <div style={{ display: "flex", height: 9, borderRadius: 999, overflow: "hidden", background: "var(--muted)" }}>
                {d.won > 0 && <div className="bar-grow" title={`ปิดได้ ${d.won} ใบ`} style={{ width: w(d.won), background: WON }} />}
                {d.lost > 0 && <div className="bar-grow" title={`ปิดไม่ได้ ${d.lost} ใบ`} style={{ width: w(d.lost), background: LOST }} />}
                {d.expired > 0 && <div className="bar-grow" title={`หมดอายุ ${d.expired} ใบ`} style={{ width: w(d.expired), background: EXPIRED }} />}
                {d.pending > 0 && <div className="bar-grow" title={`ยังรอลูกค้าตอบ ${d.pending} ใบ`} style={{ width: w(d.pending), background: PENDING }} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
