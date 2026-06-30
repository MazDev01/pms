"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import {
  hqFinanceSummary, hqFinanceByMonth, hqInvoiceAging,
  hqServiceLineRevenue,
} from "@/lib/mock";
import { useFilters } from "@/context/FilterContext";
import { FilterBar } from "@/components/filters/FilterBar";

// ── Tokens ──────────────────────────────────────────────────────
const PRIMARY = "#003366";
const AMBER   = "#ECC94B";

// ── Helpers ─────────────────────────────────────────────────────

function fmtM(n: number, decimals = 1) {
  return n >= 1_000_000 ? `฿${(n / 1_000_000).toFixed(decimals)}M` : `฿${(n / 1000).toFixed(0)}K`;
}
function pctBar(n: number, total: number) {
  return total > 0 ? Math.round(n / total * 100) : 0;
}

// ── SVG grouped bar chart (revenue vs target + collected) ───────

function RevenueBarChart() {
  const W = 560, H = 180, padL = 8, padR = 8, padT = 28, padB = 26;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const n = hqFinanceByMonth.length;
  const max = Math.max(...hqFinanceByMonth.map(r => r.target)) * 1.12;
  const groupW = innerW / n;
  const barW   = groupW * 0.52;

  function barY(v: number) { return padT + innerH - (v / max) * innerH; }
  function barH(v: number) { return (v / max) * innerH; }

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H }}>
        <defs>
          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#003366" stopOpacity="1" />
            <stop offset="100%" stopColor="#1a5b8f" stopOpacity="1" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(t => (
          <line key={t}
            x1={padL} x2={W - padR}
            y1={padT + t * innerH} y2={padT + t * innerH}
            stroke="#eef0f3" strokeWidth="1"
          />
        ))}

        {hqFinanceByMonth.map((row, i) => {
          const cx    = padL + (i + 0.5) * groupW;
          const bx    = cx - barW / 2;
          const pct   = Math.round(row.revenue / row.target * 100);
          const isLast = i === n - 1;
          const barColor = pct >= 100 ? "#059669" : pct >= 80 ? (isLast ? "url(#revGrad)" : "#8fa3c0") : AMBER;
          const pctColor = pct >= 100 ? "#059669" : pct >= 80 ? "#003366" : "#d97706";
          const tarY  = barY(row.target);
          const colY  = barY(row.collected);

          return (
            <g key={row.month}>
              {/* Revenue bar */}
              <rect
                className="sales-bar"
                x={bx} y={barY(row.revenue)}
                width={barW} height={barH(row.revenue)}
                fill={barColor} rx={4}
                opacity={isLast ? 1 : 0.8}
                style={{ animationDelay: `${i * 0.06}s` }}
              />
              {/* Collected dot on revenue bar */}
              <circle cx={cx} cy={colY} r="4" fill="#059669" stroke="white" strokeWidth="1.5" />
              {/* Target dashed line spanning bar width */}
              <line
                x1={bx - 4} x2={bx + barW + 4}
                y1={tarY} y2={tarY}
                stroke="#9ca3af" strokeWidth="1.5" strokeDasharray="4,2"
              />
              {/* % achievement badge above bar */}
              <text x={cx} y={barY(row.revenue) - 5}
                textAnchor="middle" fontSize="8.5" fontWeight="700" fill={pctColor}>
                {pct}%
              </text>
              {/* Month label */}
              <text x={cx} y={H - 4}
                textAnchor="middle" fontSize="9" fill={isLast ? "#2D2D2D" : "#6b7280"} fontWeight={isLast ? "700" : "400"}>
                {row.month}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginTop: 2 }}>
        {[
          { color: PRIMARY, label: "ยอดขาย (แท่ง)" },
          { color: "#059669", label: "เก็บได้ (จุดเขียว)" },
          { color: "#9ca3af", label: "เป้าหมาย (เส้นประ)", dashed: true },
        ].map(l => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            {l.dashed
              ? <div style={{ width: 14, borderTop: "2px dashed #9ca3af" }} />
              : <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color }} />
            }
            <span style={{ fontSize: "0.62rem", color: "#6b7280" }}>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Invoice aging ────────────────────────────────────────────────

function InvoiceAging() {
  const total = hqInvoiceAging.reduce((s, b) => s + b.amount, 0);
  return (
    <div>
      {hqInvoiceAging.map((b, i) => (
        <div key={b.label} style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: "0.76rem", color: "#2D2D2D", fontWeight: 600 }}>{b.label}</span>
            <span style={{ fontSize: "0.76rem", fontWeight: 700, color: b.color }}>{fmtM(b.amount)}</span>
          </div>
          <div style={{ height: 6, background: "#f4f6f9", borderRadius: 99, overflow: "hidden" }}>
            <div className="top5-bar" style={{ height: "100%", width: `${pctBar(b.amount, total)}%`, background: b.color, borderRadius: 99, animationDelay: `${0.15 + i * 0.08}s` }} />
          </div>
          <div style={{ fontSize: "0.62rem", color: "#9ca3af", marginTop: 2 }}>{pctBar(b.amount, total)}% ของยอดค้าง</div>
        </div>
      ))}
      <div style={{ padding: "10px 14px", background: "var(--accent)", borderRadius: 8, display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "#003366" }}>รวมค้างชำระ</span>
        <span style={{ fontSize: "0.8rem", fontWeight: 800, color: "#003366" }}>{fmtM(total)}</span>
      </div>
    </div>
  );
}

// ── Service line revenue ─────────────────────────────────────────

function ServiceLineRevenue() {
  const total = hqServiceLineRevenue.reduce((s, r) => s + r.value, 0);
  return (
    <div>
      {hqServiceLineRevenue.map((r, i) => (
        <div key={r.line} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <span style={{ fontSize: "0.68rem", fontWeight: 700, minWidth: 88, color: r.color }}>{r.line}</span>
          <div style={{ flex: 1, height: 7, background: "#f4f6f9", borderRadius: 99, overflow: "hidden" }}>
            <div className="top5-bar" style={{ height: "100%", width: `${pctBar(r.value, total)}%`, background: r.color, borderRadius: 99, animationDelay: `${0.15 + i * 0.08}s` }} />
          </div>
          <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#2D2D2D", minWidth: 55, textAlign: "right" }}>{fmtM(r.value)}</span>
          <span style={{ fontSize: "0.62rem", color: "#9ca3af", minWidth: 30, textAlign: "right" }}>{pctBar(r.value, total)}%</span>
        </div>
      ))}
    </div>
  );
}

// ── Monthly detail table ─────────────────────────────────────────

function MonthlyTable() {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {["เดือน", "ยอดขาย", "เป้า", "% เป้า", "เก็บได้", "ค่าใช้จ่าย", "กำไรขั้นต้น"].map(h => (
              <th key={h} className={h === "เดือน" ? "" : "num"}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {hqFinanceByMonth.map((row, i) => {
            const pct   = Math.round(row.revenue / row.target * 100);
            const gp    = row.revenue - row.expenses;
            const gpPct = Math.round(gp / row.revenue * 100);
            const pctColor = pct >= 100 ? "#059669" : pct >= 80 ? "#d97706" : "#dc2626";
            const isLast = i === hqFinanceByMonth.length - 1;
            return (
              <tr key={row.month} style={{ background: isLast ? "var(--accent)" : "transparent" }}>
                <td style={{ fontWeight: isLast ? 700 : 400, color: "#2D2D2D" }}>{row.month}{isLast ? " (ปัจจุบัน)" : ""}</td>
                <td className="num" style={{ fontWeight: 700, color: "#003366" }}>{fmtM(row.revenue)}</td>
                <td className="num" style={{ color: "#6b7280" }}>{fmtM(row.target)}</td>
                <td className="num">
                  <span style={{ fontWeight: 700, color: pctColor }}>{pct}%</span>
                </td>
                <td className="num" style={{ color: "#059669", fontWeight: 600 }}>{fmtM(row.collected)}</td>
                <td className="num" style={{ color: "#dc2626", fontWeight: 600 }}>({fmtM(row.expenses)})</td>
                <td className="num">
                  <span style={{ fontWeight: 700, color: "#2D2D2D" }}>{fmtM(gp)}</span>
                  <span style={{ fontSize: "0.64rem", color: "#6b7280", marginLeft: 4 }}>({gpPct}%)</span>
                </td>
              </tr>
            );
          })}
          {/* YTD total row */}
          {(() => {
            const rev  = hqFinanceByMonth.reduce((s, r) => s + r.revenue,   0);
            const tar  = hqFinanceByMonth.reduce((s, r) => s + r.target,    0);
            const col  = hqFinanceByMonth.reduce((s, r) => s + r.collected, 0);
            const exp  = hqFinanceByMonth.reduce((s, r) => s + r.expenses,  0);
            const gp   = rev - exp;
            const pct  = Math.round(rev / tar * 100);
            return (
              <tr style={{ background: "var(--accent)", borderTop: "2px solid var(--border)" }}>
                <td style={{ fontWeight: 800, color: "#003366" }}>YTD รวม</td>
                <td className="num" style={{ fontWeight: 800, color: "#003366", fontSize: "0.88rem" }}>{fmtM(rev)}</td>
                <td className="num" style={{ color: "#6b7280" }}>{fmtM(tar)}</td>
                <td className="num">
                  <span style={{ fontWeight: 800, color: pct >= 80 ? "#059669" : "#d97706" }}>{pct}%</span>
                </td>
                <td className="num" style={{ fontWeight: 700, color: "#059669" }}>{fmtM(col)}</td>
                <td className="num" style={{ fontWeight: 700, color: "#dc2626" }}>({fmtM(exp)})</td>
                <td className="num">
                  <span style={{ fontSize: "0.84rem", fontWeight: 800, color: "#2D2D2D" }}>{fmtM(gp)}</span>
                  <span style={{ fontSize: "0.66rem", color: "#6b7280", marginLeft: 4 }}>({Math.round(gp / rev * 100)}%)</span>
                </td>
              </tr>
            );
          })()}
        </tbody>
      </table>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────

export default function HQFinancePage() {
  const { timeRange } = useFilters();
  const pf = timeRange.factor;

  const s        = hqFinanceSummary;
  const ytdRev   = Math.round(s.ytdRevenue   * pf);
  const ytdTgt   = Math.round(s.ytdTarget    * pf);
  const monRev   = Math.round(s.monthRevenue * pf);
  const monTgt   = Math.round(s.monthTarget  * pf);
  const ytdPct   = Math.round(ytdRev / ytdTgt * 100);
  const monPct   = Math.round(monRev / monTgt * 100);
  const totalOut = Math.round(hqInvoiceAging.reduce((x, b) => x + b.amount, 0) * Math.min(pf, 1.6));

  const [toast, setToast]         = useState<string | null>(null);
  const [showExport, setShowExport] = useState(false);

  function doExport(format: string) {
    setShowExport(false);
    setToast(`กำลังส่งออก ${format}... ดาวน์โหลดจะเริ่มในไม่ช้า`);
    setTimeout(() => setToast(null), 2800);
  }

  const KPIS = [
    { label: "ยอดขาย",              value: fmtM(ytdRev),          sub: `${ytdPct}% ของเป้า ${fmtM(ytdTgt)}`,        color: "#003366",  subColor: ytdPct >= 80 ? "#059669" : "#d97706" },
    { label: "ยอดขายล่าสุด",        value: fmtM(monRev),          sub: `${monPct}% ของเป้า ${fmtM(monTgt)}`,         color: "#003366",  subColor: monPct >= 80 ? "#059669" : "#d97706" },
    { label: "ค้างชำระทั้งหมด",    value: fmtM(totalOut),         sub: `เกินกำหนด ${fmtM(Math.round(s.overdue * Math.min(pf, 1.4)))}`, color: "#d97706", subColor: "#dc2626" },
    { label: "อัตรากำไรขั้นต้น",          value: `${s.grossMarginPct}%`, sub: "หลังหักต้นทุนประมาณ",                    color: s.grossMarginPct >= 20 ? "#059669" : "#d97706", subColor: "#6b7280" },
  ];

  return (
    <div className="erp">
      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, background: "#2D2D2D", color: "#fff", padding: "10px 18px", borderRadius: 12, fontSize: "0.78rem", fontWeight: 600, zIndex: 9999, boxShadow: "0 4px 20px rgba(0,0,0,.25)", display: "flex", alignItems: "center", gap: 8 }}>
          <Download size={14} /> {toast}
        </div>
      )}

      {/* Header */}
      <div className="page-head">
        <div>
          <h2>ภาพรวมการเงิน</h2>
          <p>รายรับ · ใบแจ้งหนี้ · การชำระเงิน · กำไร · {timeRange.subtitle}</p>
        </div>
        {/* Period + Export buttons */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <FilterBar dims={[]} />
          <div style={{ position: "relative" }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowExport(v => !v)}>
              <Download size={14} /> ส่งออก
            </button>
            {showExport && (
              <>
                <div onClick={() => setShowExport(false)} style={{ position: "fixed", inset: 0, zIndex: 100 }} />
                <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: "#fff", border: "1px solid var(--border)", borderRadius: 10, boxShadow: "var(--shadow-lg)", zIndex: 101, minWidth: 160, overflow: "hidden" }}>
                  {["Excel (.xlsx)", "PDF รายงาน"].map(f => (
                    <button key={f} onClick={() => doExport(f)}
                      style={{ width: "100%", padding: "10px 16px", textAlign: "left", background: "none", border: "none", fontSize: "0.78rem", color: "#2D2D2D", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--accent)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "none"; }}
                    >
                      <Download size={12} style={{ color: "#6b7280" }} /> {f}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="stat-grid">
        {KPIS.map(k => (
          <div key={k.label} className="stat-card">
            <div className="stat-label">{k.label}</div>
            <div className="stat-value" style={{ color: k.color }}>{k.value}</div>
            <div className="stat-delta" style={{ color: k.subColor }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="row-2">
        {/* Revenue chart */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">รายรับรายเดือน vs เป้าหมาย</div>
          </div>
          <div className="card-body"><RevenueBarChart /></div>
        </div>

        {/* Invoice aging */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">อายุใบแจ้งหนี้ค้างชำระ</div>
          </div>
          <div className="card-body"><InvoiceAging /></div>
        </div>
      </div>

      {/* Service line + Monthly table */}
      <div className="row-2" style={{ gridTemplateColumns: "1fr 1.5fr" }}>
        {/* Service line */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">รายได้ตามสายบริการ (YTD)</div>
          </div>
          <div className="card-body">
            <ServiceLineRevenue />
            <div style={{ marginTop: 14, padding: "10px 14px", background: "var(--accent)", borderRadius: 8, display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "#003366" }}>รวม YTD</span>
              <span style={{ fontSize: "0.8rem", fontWeight: 800, color: "#003366" }}>{fmtM(hqServiceLineRevenue.reduce((s, r) => s + r.value, 0))}</span>
            </div>
          </div>
        </div>

        {/* Monthly table */}
        <div className="card" style={{ overflow: "hidden" }}>
          <div className="card-header">
            <div className="card-title">ตารางรายรับรายเดือน</div>
          </div>
          <MonthlyTable />
        </div>
      </div>

      {/* Collection rate summary */}
      <div className="kpi-bar">
        {[
          { label: "เก็บได้เดือนนี้",   value: fmtM(s.collectedMonth),  note: `${Math.round(s.collectedMonth / s.monthRevenue * 100)}% ของยอดขาย`, color: "#059669", icon: "kpi-green" },
          { label: "ค้างชำระ",           value: fmtM(totalOut),           note: "รวมทุกอายุ",  color: "#d97706", icon: "kpi-amber" },
          { label: "เกินกำหนด",          value: fmtM(s.overdue),          note: "ต้องติดตามด่วน", color: "#dc2626", icon: "kpi-amber" },
          { label: "ค่าใช้จ่าย YTD",    value: fmtM(s.ytdExpenses),      note: `${Math.round(s.ytdExpenses / s.ytdRevenue * 100)}% ของรายรับ`,  color: "#2D2D2D", icon: "kpi-steel" },
        ].map(k => (
          <div key={k.label} className="kpi">
            <div className="kpi-val" style={{ color: k.color }}>{k.value}</div>
            <div>
              <div className="kpi-label">{k.label}</div>
              <div className="kpi-delta" style={{ color: "#9ca3af" }}>{k.note}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
