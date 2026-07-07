"use client";

import { useMemo } from "react";
import { salesByMonth, team, quotationStatusLabel, mainTemplateOf, type QuotationStatus } from "@/lib/mock";
import { useSales } from "@/context/SalesContext";
import { useFilters } from "@/context/FilterContext";
import { FilterBar } from "@/components/filters/FilterBar";
import { KpiCard } from "@/components/ui/KpiCard";
import { Donut } from "@/components/ui/Charts";
import { SalesTrendChart } from "@/components/ui/SalesTrendChart";
import { fmtBaht } from "@/lib/format";

const SOURCE_COLORS = ["#003366", "#0a4f8c", "#1e6fbf", "#82b4e3", "#8fa3b8", "#C0C0C0"];

// แปลงสตริงมูลค่า "฿1.2M" / "฿480K" → ตัวเลข
function parseBaht(s: string): number {
  const m = s.replace(/[฿,\s]/g, "");
  if (/M$/i.test(m)) return parseFloat(m) * 1e6;
  if (/K$/i.test(m)) return parseFloat(m) * 1e3;
  return parseFloat(m) || 0;
}

// แถบแนวนอน (reuse mini-bar pattern) — ใช้ทั่วทั้งหน้า
function BarRow({ label, value, pct, valueLabel }: { label: string; value: number; pct: number; valueLabel?: string }) {
  return (
    <div key={label}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: "0.72rem" }}>
        <span style={{ fontWeight: 700, color: "var(--text)" }}>{label}</span>
        <span style={{ fontWeight: 800, color: "var(--pr)" }}>{valueLabel ?? fmtBaht(value)}</span>
      </div>
      <div className="mini-bar" style={{ marginTop: 0 }}><div className="mini-fill bar-grow" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

// ตัวกรองแยกอิสระต่อหน้าถูกครอบให้แล้วใน AppShell (bpms_filters:<pathname>)
export default function ReportsPage() {
  return <ReportsPageInner />;
}

function ReportsPageInner() {
  // ข้อมูลสด: อ่านผู้สนใจ/ใบเสนอราคาจาก SalesContext → รายงานสะท้อนสิ่งที่ผู้ใช้สร้างจริง
  const { leads: allLeads, quotations: allQuotations } = useSales();
  const { timeRange } = useFilters();

  // ── กรองตามช่วงเวลาจริง (แทนการคูณ factor) — ใบเสนอราคาใช้ field date, ผู้สนใจสร้างวันที่คงที่จาก numId ──
  const within = (iso: string) => { const t = new Date(iso).getTime(); return t >= timeRange.start.getTime() && t <= timeRange.end.getTime(); };
  const leadIso = (numId: number) => { const d = new Date(2026, 5, 30); d.setDate(d.getDate() - ((numId * 17) % 150)); return d.toISOString().slice(0, 10); };
  const leads = useMemo(() => allLeads.filter(l => within(leadIso(l.numId))), [allLeads, timeRange]);
  const quotations = useMemo(() => allQuotations.filter(q => within(q.date)), [allQuotations, timeRange]);

  // ── สรุปตัวเลข (KPI row — ใช้ทั้งสองบทบาท) ──
  const leadValue = useMemo(() => leads.reduce((s, l) => s + parseBaht(l.value), 0), [leads]);
  const sentValue = useMemo(() => quotations.filter(q => q.status === "sent_to_client" || q.status === "won").reduce((s, q) => s + q.totalValue, 0), [quotations]);
  const wonCount = quotations.filter(q => q.status === "won").length;
  const lostCount = quotations.filter(q => q.status === "lost").length;
  const closedCount = wonCount + lostCount;
  const winRate = closedCount ? Math.round((wonCount / closedCount) * 100) : 0;
  const avgDeal = wonCount ? quotations.filter(q => q.status === "won").reduce((s, q) => s + q.totalValue, 0) / wonCount : 0;

  const kpis = [
    { label: "มูลค่าผู้สนใจรวม", value: fmtBaht(leadValue), icon: "phone", current: leadValue / 1e6, target: 15, targetLabel: "฿15M", href: "/leads" },
    { label: "ใบเสนอราคาที่ส่ง", value: fmtBaht(sentValue), icon: "doc", current: sentValue / 1e6, target: 20, targetLabel: "฿20M", href: "/quotations" },
    { label: "อัตราปิดการขาย", value: `${winRate}%`, icon: "target", current: winRate, target: 50, targetLabel: "50%", href: "/leads" },
    { label: "มูลค่าเฉลี่ยต่อโอกาส", value: fmtBaht(avgDeal), icon: "award", current: avgDeal / 1e6, target: 5, targetLabel: "฿5M", href: "/quotations" },
  ];

  // ข้อมูลรายเดือนหน่วยล้านบาท ป้อนให้กราฟแนวโน้ม (กราฟมีปุ่มช่วงเวลาในตัว ไม่ใช้ factor)
  const trendMonthly = useMemo(() => salesByMonth.map(d => ({ month: d.month, value: Math.round(d.value / 200 * 10) / 10 })), []);

  // ── แหล่งที่มาของผู้สนใจ (โดนัท) ──
  const sources = useMemo(() => {
    const m = new Map<string, number>();
    leads.forEach(l => { const k = l.source ?? "อื่น ๆ"; m.set(k, (m.get(k) ?? 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([label, value], i) => ({ label, value, color: SOURCE_COLORS[i % SOURCE_COLORS.length] }));
  }, [leads]);

  // ── อัตราการแปลงการขาย (Conversion Funnel) — จากสถานะลีดตามลำดับเส้นทางการขาย ──
  const funnel = useMemo(() => {
    // ลำดับขั้นเส้นทางการขาย (CANCELLED = ไม่ได้งาน ไม่นับเป็นขั้นที่คืบหน้า)
    const rank: Record<string, number> = { WAITING: 0, BULLET: 1, QUOTED: 2, FOLLOWUP: 3, NEGO: 4, PAID: 5 };
    const rankOf = (s: string) => (s in rank ? rank[s] : -1);
    const total = leads.length;
    const atLeast = (r: number) => leads.filter(l => rankOf(l.status) >= r).length;
    const stages = [
      { label: "ผู้สนใจทั้งหมด", count: total },
      { label: "เสนอราคา", count: atLeast(rank.QUOTED) },
      { label: "เจรจา", count: atLeast(rank.NEGO) },
      { label: "ปิดการขาย", count: atLeast(rank.PAID) },
    ];
    return stages.map(s => ({
      label: s.label,
      count: s.count,
      pct: total ? Math.round((s.count / total) * 100) : 0,
    }));
  }, [leads]);

  // ── ยอดขายตามสินค้า (leads.product + fallback quotations.buildingType) ──
  const byProduct = useMemo(() => {
    // จัดกลุ่มตามแม่แบบหลัก — แม่แบบย่อย (เช่น "โรงงานอาหาร") ถูก roll-up เข้า "โรงงาน"
    const m = new Map<string, number>();
    leads.forEach(l => { const k = mainTemplateOf(l.product) || "อื่น ๆ"; m.set(k, (m.get(k) ?? 0) + parseBaht(l.value)); });
    quotations.forEach(q => { const k = mainTemplateOf(q.buildingType) || "อื่น ๆ"; m.set(k, (m.get(k) ?? 0) + q.totalValue); });
    const arr = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    const max = arr.length ? arr[0][1] : 1;
    return arr.map(([label, value], i) => ({ label, value, pct: Math.round((value / max) * 100), color: SOURCE_COLORS[i % SOURCE_COLORS.length] }));
  }, [leads, quotations]);

  // ── รายงานใบเสนอราคา — จำนวน+มูลค่า ต่อสถานะ ──
  const quoteByStatus = useMemo(() => {
    const order: QuotationStatus[] = ["draft", "sent_to_client", "viewed", "won", "lost", "expired"];
    const colorOf: Record<string, string> = {
      draft: "#8a94a3", sent_to_client: "#0a4f8c", viewed: "#4338ca",
      won: "#059669", lost: "#dc2626", expired: "#f59e0b",
    };
    const rows = order.map(st => {
      const items = quotations.filter(q => q.status === st);
      return { status: st, label: quotationStatusLabel[st], count: items.length, value: items.reduce((s, q) => s + q.totalValue, 0), color: colorOf[st] };
    }).filter(r => r.count > 0);
    const max = rows.reduce((m, r) => Math.max(m, r.count), 1);
    return { rows, max, total: quotations.length };
  }, [quotations]);


  // ── ผลงานเซลส์ (Dealer) ──
  const salesPerf = useMemo(() => {
    return team
      .map(t => {
        // ผู้รับผิดชอบเก็บได้หลายคน (คั่นด้วย ", ") → นับให้ทุกคนที่ร่วมรับผิดชอบ
        const own = leads.filter(l => l.assigned.split(",").map(s => s.trim()).includes(t.name));
        const value = own.reduce((s, l) => s + parseBaht(l.value), 0);
        const won = own.filter(l => l.status === "PAID").length;
        return { name: t.name, initials: t.initials, color: t.color, leads: own.length, value, won };
      })
      .filter(t => t.leads > 0)
      .sort((a, b) => b.value - a.value);
  }, [leads]);
  const perfMax = salesPerf.length ? salesPerf[0].value : 1;

  // ── Export CSV — ส่งออก "ตรงกับทุกส่วนที่แสดงบนหน้ารายงาน" (deterministic via Blob) ──
  const exportRankingsCsv = () => {
    const esc = (v: string | number) => {
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines: string[] = ["หมวด,รายการ,ค่า 1,ค่า 2"];
    const add = (section: string, name: string, v1: string | number, v2: string | number = "") =>
      lines.push([section, name, v1, v2].map(esc).join(","));

    // KPI สรุป
    kpis.forEach(k => add("KPI สรุป", k.label, k.value));
    // ยอดขายตามสินค้า
    byProduct.forEach(p => add("ยอดขายตามสินค้า", p.label, fmtBaht(p.value)));
    // แหล่งที่มาของผู้สนใจ
    sources.forEach(s => add("แหล่งที่มาของผู้สนใจ", s.label, `${s.value} ราย`));
    // ผลงานทีมขาย
    salesPerf.forEach(t => add("ผลงานทีมขาย", t.name, `${t.leads} ราย · ปิดได้ ${t.won}`, fmtBaht(t.value)));
    // รายงานใบเสนอราคา (ตามสถานะ)
    quoteByStatus.rows.forEach(r => add("รายงานใบเสนอราคา", r.label, `${r.count} ใบ`, fmtBaht(r.value)));
    // อัตราการแปลงการขาย
    funnel.forEach(f => add("อัตราการแปลงการขาย", f.label, `${f.count} ราย`, `${f.pct}%`));
    // ปิดได้ / ปิดไม่ได้
    add("ปิดการขาย", "ปิดได้", `${wonCount} ใบ`);
    add("ปิดการขาย", "ปิดไม่ได้", `${lostCount} ใบ`);

    const csv = "﻿" + lines.join("\r\n"); // BOM เพื่อให้ Excel อ่านภาษาไทยได้
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "รายงานยอดขาย.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const subtitle = `ยอดขายตามสินค้า · แหล่งผู้สนใจ · อัตราการแปลง · ปิดการขาย · ${timeRange.subtitle}`;

  return (
    <div className="pms-dash anim-rise">
      <div className="pg-head">
        <div>
          <h1 className="pg-title">รายงาน</h1>
          <p className="pg-sub">{subtitle}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <FilterBar dims={[]} />
        <button
          type="button"
          onClick={exportRankingsCsv}
          className="btn btn-sm"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.72rem", fontWeight: 700, padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border, #dde3ea)", background: "var(--panel-2, #eef1f5)", color: "var(--text)", cursor: "pointer" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export CSV
        </button>
        </div>
      </div>

      <div className="kpi-row" style={{ marginBottom: 16 }}>
        {kpis.map(k => <KpiCard key={k.label} {...k} />)}
      </div>

      {/* ─────────────── DEALER REPORTS ─────────────── */}
      <div className="dg">
        <div className="dg-l" style={{ minWidth: 0 }}>
          {/* Sales trend */}
          <div className="cc">
            <SalesTrendChart title="แนวโน้มยอดขาย" desc="มูลค่ายอดขาย (ล้านบาท)" monthly={trendMonthly} />
          </div>

          {/* Sales by Product */}
          <div className="cc">
            <div className="cc-hd"><div className="cc-title">ยอดขายตามสินค้า</div><span style={{ fontSize: "0.72rem", color: "var(--sub)" }}>{byProduct.length} กลุ่ม</span></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {byProduct.length === 0
                ? <div style={{ fontSize: "0.8rem", color: "var(--sub)", textAlign: "center", padding: "20px 0" }}>ไม่มีข้อมูลในช่วงเวลานี้</div>
                : byProduct.map(p => <BarRow key={p.label} label={p.label} value={p.value} pct={p.pct} />)}
            </div>
          </div>

          {/* Salesperson performance */}
          <div className="cc">
            <div className="cc-hd"><div className="cc-title">ผลงานทีมขาย</div><span style={{ fontSize: "0.72rem", color: "var(--sub)" }}>{salesPerf.length} คน</span></div>
            <div className="table-wrap" style={{ borderTop: "none" }}>
              <table>
                <colgroup><col style={{ width: "34%" }} /><col style={{ width: "16%" }} /><col style={{ width: "16%" }} /><col style={{ width: "34%" }} /></colgroup>
                <thead><tr><th>เซลส์</th><th className="num">ผู้สนใจ</th><th className="num">ปิดได้</th><th className="num">มูลค่ารวม</th></tr></thead>
                <tbody>
                  {salesPerf.length === 0 && <tr><td colSpan={4} style={{ textAlign: "center", padding: "20px 0", color: "var(--sub)", fontSize: "0.8rem" }}>ไม่มีข้อมูลในช่วงเวลานี้</td></tr>}
                  {salesPerf.map(s => (
                    <tr key={s.name}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                          <span style={{ width: 30, height: 30, borderRadius: 8, background: s.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.65rem", fontWeight: 800, flexShrink: 0 }}>{s.initials}</span>
                          <span style={{ fontWeight: 700 }}>{s.name}</span>
                        </div>
                      </td>
                      <td className="num">{s.leads}</td>
                      <td className="num"><span className="badge" style={{ background: "var(--success-bg)", color: "var(--success)" }}>{s.won}</span></td>
                      <td className="num">
                        <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-end" }}>
                          <span style={{ fontWeight: 800 }}>{fmtBaht(s.value)}</span>
                          <div className="mini-bar" style={{ width: "100%", marginTop: 0 }}><div className="mini-fill bar-grow" style={{ width: `${Math.round((s.value / perfMax) * 100)}%` }} /></div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* รายงานใบเสนอราคา (ตามสถานะ) */}
          <div className="cc">
            <div className="cc-hd"><div className="cc-title">รายงานใบเสนอราคา</div><span style={{ fontSize: "0.72rem", color: "var(--sub)" }}>{quoteByStatus.total} ใบ</span></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {quoteByStatus.rows.length === 0 && <div style={{ fontSize: "0.8rem", color: "var(--sub)", textAlign: "center", padding: "20px 0" }}>ไม่มีใบเสนอราคาในช่วงเวลานี้</div>}
              {quoteByStatus.rows.map(r => (
                <div key={r.status}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5, fontSize: "0.72rem" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 700, color: "var(--text)" }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: r.color, flexShrink: 0 }} />
                      {r.label}
                      <span style={{ fontWeight: 700, color: "var(--sub)", fontSize: "0.72rem" }}>· {r.count} ใบ</span>
                    </span>
                    <span style={{ fontWeight: 800, color: "var(--pr)" }}>{fmtBaht(r.value)}</span>
                  </div>
                  <div className="mini-bar" style={{ marginTop: 0 }}><div className="mini-fill bar-grow" style={{ width: `${Math.round((r.count / quoteByStatus.max) * 100)}%`, background: r.color }} /></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right rail */}
        <div className="dg-r" style={{ minWidth: 0 }}>
          {/* Lead source donut */}
          <div className="cc">
            <div className="cc-hd"><div className="cc-title">แหล่งที่มาของผู้สนใจ</div></div>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
              <Donut segments={sources} centerLabel="ผู้สนใจทั้งหมด" centerValue={`${leads.length}`} />
            </div>
            <div className="stats-legend">
              {sources.length === 0 && <div style={{ fontSize: "0.8rem", color: "var(--sub)", textAlign: "center", padding: "12px 0", width: "100%" }}>ไม่มีข้อมูลในช่วงเวลานี้</div>}
              {sources.map(s => (
                <div key={s.label} className="sl">
                  <span className="sl-dot" style={{ background: s.color }} />
                  <span style={{ flex: 1, color: "var(--text)" }}>{s.label}</span>
                  <span style={{ fontWeight: 800, color: "var(--text)" }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Conversion funnel + ผลปิดการขาย (รวมการ์ดเดียว — ไม่ซ้ำซ้อน) */}
          <div className="cc">
            <div className="cc-hd"><div className="cc-title">อัตราการแปลงการขาย (Conversion)</div><span style={{ fontSize: "0.72rem", color: "var(--sub)" }}>{funnel.length} ขั้น</span></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {funnel.map(s => (
                <div key={s.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: "0.72rem" }}>
                    <span style={{ fontWeight: 700, color: "var(--text)" }}>{s.label}</span>
                    <span style={{ fontWeight: 800, color: "var(--pr)" }}>{s.count} <span style={{ fontWeight: 700, color: "var(--sub)", fontSize: "0.72rem" }}>· {s.pct}%</span></span>
                  </div>
                  <div className="mini-bar" style={{ marginTop: 0, height: 10 }}>
                    <div className="mini-fill bar-grow" style={{ width: `${s.pct}%`, background: "#003366" }} />
                  </div>
                </div>
              ))}
            </div>
            {/* ผลปิดการขาย (Won/Lost) */}
            <div style={{ display: "flex", gap: 10, marginTop: 16, paddingTop: 14, borderTop: "1px solid #f0f4f8" }}>
              <div style={{ flex: 1, textAlign: "center", padding: "10px 8px", borderRadius: 10, background: "var(--success-bg, #e5faf0)" }}>
                <div style={{ fontSize: "1.7rem", fontWeight: 800, color: "#059669", lineHeight: 1 }}>{wonCount}</div>
                <div style={{ fontSize: "0.72rem", color: "var(--sub)", marginTop: 4 }}>ปิดได้</div>
              </div>
              <div style={{ flex: 1, textAlign: "center", padding: "10px 8px", borderRadius: 10, background: "var(--danger-bg, #fee2e2)" }}>
                <div style={{ fontSize: "1.7rem", fontWeight: 800, color: "#dc2626", lineHeight: 1 }}>{lostCount}</div>
                <div style={{ fontSize: "0.72rem", color: "var(--sub)", marginTop: 4 }}>ปิดไม่ได้</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
