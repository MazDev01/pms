"use client";

import { useState } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { use } from "react";
import {
  dealerLeaderboard, dealerDetails,
  type DealerDetail, type DealerLeadItem, type DealerProjectItem, type DealerQuoteItem,
} from "@/lib/mock";
import { ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";

// ── Helpers ─────────────────────────────────────────────────────

function fmtM(n: number) {
  return n >= 1_000_000 ? `฿${(n / 1_000_000).toFixed(1)}M` : `฿${(n / 1000).toFixed(0)}K`;
}

const BADGE = (bg: string, color: string): React.CSSProperties => ({ background: bg, color });

const LEAD_STATUS: Record<DealerLeadItem["status"], { label: string; bg: string; color: string }> = {
  new:       { label: "ลีดใหม่",    bg: "#dce5f0", color: "#003366" },
  contacted: { label: "ติดต่อแล้ว", bg: "#fef3cd", color: "#d97706" },
  quoted:    { label: "ส่งใบเสนอ", bg: "#dce5f0", color: "#003366" },
  won:       { label: "ปิดได้",     bg: "#e5faf0", color: "#059669" },
  lost:      { label: "เสีย",       bg: "#fee2e2", color: "#dc2626" },
};

const PROJ_STATUS: Record<DealerProjectItem["status"], { label: string; bg: string; color: string; bar: string }> = {
  in_progress: { label: "กำลังดำเนินการ", bg: "#dce5f0", color: "#003366", bar: "#003366" },
  completed:   { label: "ปิดได้",         bg: "#e5faf0", color: "#059669", bar: "#059669" },
  on_hold:     { label: "พักโอกาสการขาย",         bg: "#fef3cd", color: "#d97706", bar: "#f59e0b" },
  overdue:     { label: "เกินกำหนด",      bg: "#fee2e2", color: "#dc2626", bar: "#dc2626" },
};

const QUOTE_STATUS: Record<DealerQuoteItem["status"], { label: string; bg: string; color: string }> = {
  draft:    { label: "ร่าง",         bg: "#f0f0f5", color: "#6b7280" },
  sent:     { label: "ส่งแล้ว",      bg: "#dce5f0", color: "#003366" },
  won:      { label: "ปิดได้",       bg: "#e5faf0", color: "#059669" },
  lost:     { label: "เสีย",         bg: "#fee2e2", color: "#dc2626" },
};

// ── Mini bar chart ───────────────────────────────────────────────

function MiniBarChart({ data }: { data: { month: string; value: number }[] }) {
  const max = Math.max(...data.map(d => d.value));
  const last = data[data.length - 1];
  const prev = data[data.length - 2];
  const delta = prev ? Math.round(((last.value - prev.value) / prev.value) * 100) : 0;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 72, marginBottom: 6 }}>
        {data.map((d, i) => {
          const pct = max > 0 ? Math.round((d.value / max) * 100) : 0;
          const isLast = i === data.length - 1;
          return (
            <div key={d.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" }}>
              <div title={`${d.month}: ฿${(d.value / 1_000_000).toFixed(1)}M`}
                style={{ width: "100%", height: `${pct}%`, minHeight: 4, borderRadius: "4px 4px 0 0", background: isLast ? "#003366" : "#dce5f0" }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        {data.map(d => (
          <span key={d.month} style={{ flex: 1, textAlign: "center", fontSize: "0.58rem", color: "#9ca3af" }}>{d.month}</span>
        ))}
      </div>
      <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 5 }}>
        {delta >= 0
          ? <TrendingUp size={12} color="#059669" />
          : <TrendingDown size={12} color="#dc2626" />}
        <span style={{ fontSize: "0.7rem", fontWeight: 700, color: delta >= 0 ? "#059669" : "#dc2626" }}>
          {delta >= 0 ? "+" : ""}{delta}% เทียบเดือนก่อน
        </span>
      </div>
    </div>
  );
}

// ── Tab components ───────────────────────────────────────────────

function OverviewTab({ dealer, detail }: { dealer: typeof dealerLeaderboard[0]; detail: DealerDetail }) {
  const targetPct = dealer.revenueTarget > 0 ? Math.min(100, Math.round(dealer.revenueActual / dealer.revenueTarget * 100)) : 0;
  const barColor  = targetPct >= 80 ? "#059669" : targetPct >= 50 ? "#003366" : "#dc2626";
  const isAtRisk  = targetPct < 50;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      {/* Revenue progress */}
      <div className="card" style={{ padding: "18px 20px", gridColumn: "1 / -1" }}>
        <p style={{ fontSize: "0.72rem", fontWeight: 700, color: "#6b7280", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>ความคืบหน้าเป้าหมายรายเดือน</p>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: "1.3rem", fontWeight: 800, color: "#2D2D2D" }}>฿{(dealer.revenueActual / 1_000_000).toFixed(1)}M</span>
              <span style={{ fontSize: "1rem", fontWeight: 700, color: barColor }}>{targetPct}%</span>
            </div>
            <div style={{ height: 8, background: "#f0f0f5", borderRadius: 99, overflow: "hidden" }}>
              <div className="top5-bar" style={{ height: "100%", width: `${targetPct}%`, background: barColor, borderRadius: 99 }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
              <span style={{ fontSize: "0.66rem", color: "#6b7280" }}>ยอดจริง</span>
              <span style={{ fontSize: "0.66rem", color: "#6b7280" }}>เป้า ฿{(dealer.revenueTarget / 1_000_000).toFixed(0)}M</span>
            </div>
            {isAtRisk && (
              <div style={{ marginTop: 10, padding: "6px 12px", background: "#fee2e2", borderRadius: 8, fontSize: "0.72rem", color: "#dc2626", fontWeight: 600 }}>
                ⚠ ยอดขายต่ำกว่า 50% ของเป้า — ต้องกระตุ้นการปิดการขาย
              </div>
            )}
          </div>
          <div style={{ minWidth: 180 }}>
            <MiniBarChart data={detail.monthlySales} />
          </div>
        </div>
      </div>

      {/* Stats */}
      {[
        { label: "โอกาสการขายที่กำลังดำเนินการ", value: String(dealer.activeProjects),  unit: "โอกาสการขาย",     color: "#003366" },
        { label: "อัตราปิดการขาย",     value: String(dealer.winRate),         unit: "%",       color: dealer.winRate >= 40 ? "#059669" : "#dc2626" },
        { label: "ส่งตรงเวลา",         value: String(dealer.onTimePct),       unit: "%",       color: dealer.onTimePct >= 80 ? "#059669" : dealer.onTimePct >= 60 ? "#f59e0b" : "#dc2626" },
        { label: "ใบเสนอราคา",         value: String(detail.quotes.length),   unit: "ใบ",      color: "#2D2D2D" },
      ].map(s => (
        <div key={s.label} className="stat-card">
          <div className="stat-label">{s.label}</div>
          <div className="stat-value" style={{ color: s.color }}>
            {s.value}<span style={{ fontSize: "0.8rem", fontWeight: 500, color: "#6b7280", marginLeft: 4 }}>{s.unit}</span>
          </div>
        </div>
      ))}

      {/* Top products */}
      <div className="card" style={{ padding: "18px 20px", gridColumn: "1 / -1" }}>
        <p style={{ fontSize: "0.72rem", fontWeight: 700, color: "#6b7280", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>สินค้าที่ขาย</p>
        {(() => {
          const byProduct: Record<string, number> = {};
          detail.projects.forEach(p => { byProduct[p.product] = (byProduct[p.product] || 0) + p.valueNum; });
          const sorted = Object.entries(byProduct).sort((a, b) => b[1] - a[1]);
          const total = sorted.reduce((s, [, v]) => s + v, 0);
          const colors = ["#003366", "#0a4f8c", "#1e6fbf", "#4d94d4", "#82b4e3", "#b8d4f0"];
          return sorted.map(([product, value], i) => (
            <div key={product} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span className="badge" style={BADGE(colors[i % colors.length] + "22", colors[i % colors.length])}>{product}</span>
              <div style={{ flex: 1, height: 6, background: "#f0f0f5", borderRadius: 99, overflow: "hidden" }}>
                <div className="top5-bar" style={{ height: "100%", width: `${Math.round(value / total * 100)}%`, background: colors[i % colors.length], borderRadius: 99 }} />
              </div>
              <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "#2D2D2D", minWidth: 60, textAlign: "right" }}>{fmtM(value)}</span>
            </div>
          ));
        })()}
      </div>
    </div>
  );
}

function LeadsTab({ leads }: { leads: DealerLeadItem[] }) {
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">ลีดที่ได้รับมอบหมาย</div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {["รหัสลีด", "ลูกค้า", "จังหวัด", "สินค้า", "มูลค่า", "สถานะ", "มอบหมายเมื่อ"].map(h => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", fontSize: "0.8rem", color: "#9ca3af" }}>ไม่มีลีด</td></tr>
            )}
            {leads.map(l => {
              const st = LEAD_STATUS[l.status];
              return (
                <tr key={l.id}>
                  <td style={{ fontSize: "0.72rem", color: "#6b7280", fontWeight: 600 }}>{l.id}</td>
                  <td style={{ fontSize: "0.82rem", fontWeight: 700, color: "#2D2D2D" }}>{l.name}</td>
                  <td style={{ fontSize: "0.78rem", color: "#6b7280" }}>{l.province}</td>
                  <td><span className="badge" style={BADGE("#f0f0f5", "#6b7280")}>{l.product}</span></td>
                  <td className="num" style={{ fontSize: "0.82rem", fontWeight: 700, color: "#003366" }}>{fmtM(l.valueNum)}</td>
                  <td><span className="badge" style={BADGE(st.bg, st.color)}>{st.label}</span></td>
                  <td style={{ fontSize: "0.72rem", color: "#9ca3af" }}>{l.assignedAt}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProjectsTab({ projects }: { projects: DealerProjectItem[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {projects.length === 0 && (
        <div className="card" style={{ padding: 32, textAlign: "center", fontSize: "0.8rem", color: "#9ca3af" }}>ไม่มีโอกาสการขาย</div>
      )}
      {projects.map(p => {
        const st = PROJ_STATUS[p.status];
        return (
          <div key={p.id} className="card" style={{ padding: "14px 18px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: "0.84rem", fontWeight: 700, color: "#2D2D2D" }}>{p.name}</span>
                  <span className="badge" style={BADGE(st.bg, st.color)}>{st.label}</span>
                  <span className="badge" style={BADGE("#f0f0f5", "#6b7280")}>{p.product}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 8 }}>
                  <span style={{ fontSize: "0.72rem", color: "#6b7280" }}>กำหนดส่ง: {p.dueDate}</span>
                  <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#003366" }}>{fmtM(p.valueNum)}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1, height: 6, background: "#f0f0f5", borderRadius: 99, overflow: "hidden" }}>
                    <div className="top5-bar" style={{ height: "100%", width: `${p.progress}%`, background: st.bar, borderRadius: 99 }} />
                  </div>
                  <span style={{ fontSize: "0.72rem", fontWeight: 700, color: st.color, minWidth: 36 }}>{p.progress}%</span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function QuotesTab({ quotes }: { quotes: DealerQuoteItem[] }) {
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">ใบเสนอราคา</div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {["เลขที่", "ลูกค้า", "สินค้า", "มูลค่า", "ส่วนลด", "สถานะ", "วันที่"].map(h => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {quotes.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", fontSize: "0.8rem", color: "#9ca3af" }}>ไม่มีใบเสนอ</td></tr>
            )}
            {quotes.map(q => {
              const st = QUOTE_STATUS[q.status];
              return (
                <tr key={q.quoteNo}>
                  <td style={{ fontSize: "0.76rem", fontWeight: 700, color: "#003366" }}>{q.quoteNo}</td>
                  <td style={{ fontSize: "0.82rem", fontWeight: 600, color: "#2D2D2D" }}>{q.customer}</td>
                  <td><span className="badge" style={BADGE("#f0f0f5", "#6b7280")}>{q.product}</span></td>
                  <td className="num" style={{ fontSize: "0.82rem", fontWeight: 700, color: "#003366" }}>{fmtM(q.valueNum)}</td>
                  <td>
                    {q.discountPct > 0
                      ? <span style={{ fontSize: "0.74rem", fontWeight: 700, color: q.discountPct >= 10 ? "#dc2626" : "#d97706" }}>−{q.discountPct}%</span>
                      : <span style={{ fontSize: "0.72rem", color: "#9ca3af" }}>—</span>}
                  </td>
                  <td><span className="badge" style={BADGE(st.bg, st.color)}>{st.label}</span></td>
                  <td style={{ fontSize: "0.72rem", color: "#9ca3af" }}>{q.date}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────

const TABS = [
  { key: "overview",  label: "ภาพรวม" },
  { key: "leads",     label: "ลีด" },
  { key: "projects",  label: "โอกาสการขาย" },
  { key: "quotes",    label: "ใบเสนอ" },
] as const;

type TabKey = typeof TABS[number]["key"];

export default function DealerDrillDownPage({ params }: { params: Promise<{ dealerCode: string }> }) {
  const { dealerCode } = use(params);
  const dealer = dealerLeaderboard.find(d => d.code === dealerCode.toUpperCase());
  const detail = dealerDetails[dealerCode.toUpperCase()];

  if (!dealer) return notFound();

  const [tab, setTab] = useState<TabKey>("overview");

  const targetPct = dealer.revenueTarget > 0 ? Math.min(100, Math.round(dealer.revenueActual / dealer.revenueTarget * 100)) : 0;
  const isAtRisk  = targetPct < 50;
  const isWarn    = targetPct >= 50 && targetPct < 70;

  return (
    <div className="erp">
      {/* Back link */}
      <Link href="/hq/dealers" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "0.78rem", color: "#6b7280", textDecoration: "none", marginBottom: 16, fontWeight: 600 }}>
        <ArrowLeft size={14} /> กลับไปหน้าสาขา
      </Link>

      {/* Header */}
      <div className="page-head">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <h2 style={{ marginBottom: 0 }}>{dealer.name}</h2>
            <span className="badge" style={BADGE("#f0f0f5", "#6b7280")}>{dealer.code}</span>
            {isAtRisk && <span className="badge" style={BADGE("#fee2e2", "#dc2626")}>🔴 ล้าหลังเป้า</span>}
            {isWarn   && <span className="badge" style={BADGE("#fef3cd", "#d97706")}>⚠ ระวัง</span>}
            {dealer.status === "inactive" && <span className="badge" style={BADGE("#f0f0f5", "#9ca3af")}>ปิดใช้งาน</span>}
          </div>
          <p>
            ภาค{dealer.region} · {dealer.activeProjects} โอกาสการขาย · อัตราปิดการขาย {dealer.winRate}% · ส่งตรงเวลา {dealer.onTimePct}%
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-bar" style={{ marginBottom: 20 }}>
        {TABS.map(t => {
          const count = t.key === "leads" ? detail?.leads.length
            : t.key === "projects" ? detail?.projects.length
            : t.key === "quotes" ? detail?.quotes.length
            : null;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`tab-item ${tab === t.key ? "active" : ""}`}
              style={{ display: "flex", alignItems: "center", gap: 5 }}>
              {t.label}
              {count !== null && (
                <span style={{ fontSize: "0.62rem", fontWeight: 700, background: tab === t.key ? "#dce5f0" : "#e5e7eb", color: tab === t.key ? "#003366" : "#6b7280", borderRadius: 99, padding: "1px 6px" }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {!detail && (
        <div className="card" style={{ padding: 32, textAlign: "center", fontSize: "0.84rem", color: "#9ca3af" }}>
          ยังไม่มีข้อมูลรายละเอียดสำหรับสาขานี้
        </div>
      )}
      {detail && tab === "overview"  && <OverviewTab dealer={dealer} detail={detail} />}
      {detail && tab === "leads"     && <LeadsTab    leads={detail.leads} />}
      {detail && tab === "projects"  && <ProjectsTab projects={detail.projects} />}
      {detail && tab === "quotes"    && <QuotesTab   quotes={detail.quotes} />}
    </div>
  );
}
