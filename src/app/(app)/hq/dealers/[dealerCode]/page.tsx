"use client";

import { useState } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { use } from "react";
import {
  HQ_TARGETS_KEY, DEFAULT_HQ_TARGETS,
  type DealerRow, type DealerDetail, type DealerLeadItem, type DealerProjectItem, type DealerQuoteItem, type HQTargets, type HQCustomer,
} from "@/lib/mock";
import { dealerLeaderboard } from "@/lib/mock";
import { usePersistentState } from "@/lib/usePersistentState";
import { useNetworkDealerDetail, useNetworkCustomers } from "@/lib/useNetworkData";
import { CountUp } from "@/components/ui/CountUp";
import { ArrowLeft, TrendingUp, TrendingDown, Users, Lock, ScrollText } from "lucide-react";

// ── Helpers ─────────────────────────────────────────────────────

function fmtM(n: number) {
  return n >= 1_000_000 ? `฿${(n / 1_000_000).toFixed(1)}M` : `฿${(n / 1000).toFixed(0)}K`;
}

const BADGE = (bg: string, color: string): React.CSSProperties => ({ background: bg, color });

const LEAD_STATUS: Record<DealerLeadItem["status"], { label: string; bg: string; color: string }> = {
  contacted: { label: "ติดต่อแล้ว", bg: "#eef2f7", color: "#475569" },
  quoted:    { label: "ส่งใบเสนอ", bg: "#dce5f0", color: "#003366" },
  won:       { label: "ปิดการขายสำเร็จ",     bg: "#e5faf0", color: "#059669" },
  lost:      { label: "ปิดการขายไม่สำเร็จ",  bg: "#fee2e2", color: "#dc2626" },
};

const PROJ_STATUS: Record<DealerProjectItem["status"], { label: string; bg: string; color: string; bar: string }> = {
  in_progress: { label: "กำลังดำเนินการ", bg: "#dce5f0", color: "#003366", bar: "#003366" },
  completed:   { label: "ปิดได้",         bg: "#e5faf0", color: "#059669", bar: "#059669" },
  on_hold:     { label: "พักโอกาสการขาย",         bg: "#fef3cd", color: "#d97706", bar: "#f59e0b" },
  overdue:     { label: "เกินกำหนด",      bg: "#fee2e2", color: "#dc2626", bar: "#dc2626" },
};

const QUOTE_STATUS: Record<DealerQuoteItem["status"], { label: string; bg: string; color: string }> = {
  draft:          { label: "ร่าง",         bg: "#f0f0f5", color: "#6b7280" },
  sent_to_client: { label: "ส่งแล้ว",      bg: "#dce5f0", color: "#003366" },
  viewed:         { label: "เปิดอ่านแล้ว", bg: "#e0e7ff", color: "#4338ca" },
  won:            { label: "ตอบรับ",       bg: "#e5faf0", color: "#059669" },
  lost:           { label: "ปฏิเสธ",       bg: "#fee2e2", color: "#dc2626" },
  expired:        { label: "หมดอายุ",      bg: "#f5f5f5", color: "#9ca3af" },
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
              <div title={`${d.month}: ฿${(d.value / 1000).toFixed(1)}M`} className="vbar-grow"
                style={{ width: "100%", height: `${pct}%`, minHeight: 4, borderRadius: "4px 4px 0 0", background: isLast ? "#003366" : "#dce5f0", animationDelay: `${i * 60}ms` }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        {data.map(d => (
          <span key={d.month} style={{ flex: 1, textAlign: "center", fontSize: "0.65rem", color: "#9ca3af" }}>{d.month}</span>
        ))}
      </div>
      <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 5 }}>
        {delta >= 0
          ? <TrendingUp size={12} color="#059669" />
          : <TrendingDown size={12} color="#dc2626" />}
        <span style={{ fontSize: "0.72rem", fontWeight: 700, color: delta >= 0 ? "#059669" : "#dc2626" }}>
          {delta >= 0 ? "+" : ""}{delta}% เทียบเดือนก่อน
        </span>
      </div>
    </div>
  );
}

// ── Tab components ───────────────────────────────────────────────

function OverviewTab({ dealer, detail }: { dealer: DealerRow; detail: DealerDetail }) {
  // เกณฑ์ Win rate / ตรงเวลา = เป้าที่ HQ ตั้งไว้ (แหล่งเดียว) ไม่ hardcode
  const [targets] = usePersistentState<HQTargets>(HQ_TARGETS_KEY, DEFAULT_HQ_TARGETS);
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
              <span style={{ fontSize: "0.65rem", color: "#6b7280" }}>ยอดจริง</span>
              <span style={{ fontSize: "0.65rem", color: "#6b7280" }}>เป้า ฿{(dealer.revenueTarget / 1_000_000).toFixed(0)}M</span>
            </div>
            {isAtRisk && (
              <div style={{ marginTop: 10, padding: "6px 12px", background: "#fee2e2", borderRadius: 8, fontSize: "0.72rem", color: "#dc2626", fontWeight: 600 }}>
                ⚠ ยอดขายต่ำกว่า 50% ของเป้า — ต้องกระตุ้นการปิดการขาย
              </div>
            )}
          </div>
          <div style={{ minWidth: 180 }}>
            {detail && <MiniBarChart data={detail.monthlySales} />}
          </div>
        </div>
      </div>

      {/* Stats */}
      {[
        { label: "โอกาสการขายที่กำลังดำเนินการ", value: String(dealer.activeProjects),  unit: "โอกาสการขาย",     color: "#003366" },
        { label: "อัตราปิดการขาย",     value: String(dealer.winRate),         unit: "%",       color: dealer.winRate >= targets.winRateTarget ? "#059669" : "#dc2626" },
        { label: "ติดตามตรงเวลา",         value: String(dealer.onTimePct),       unit: "%",       color: dealer.onTimePct >= targets.onTimeTarget ? "#059669" : dealer.onTimePct >= targets.onTimeTarget - 20 ? "#f59e0b" : "#dc2626" },
        { label: "ใบเสนอราคา",         value: String(detail?.quotes.length ?? 0),   unit: "ใบ",      color: "#2D2D2D" },
      ].map(s => (
        <div key={s.label} className="stat-card">
          <div className="stat-label">{s.label}</div>
          <div className="stat-value" style={{ color: s.color }}>
            <CountUp value={s.value} /><span style={{ fontSize: "0.8rem", fontWeight: 500, color: "#6b7280", marginLeft: 4 }}>{s.unit}</span>
          </div>
        </div>
      ))}

      {/* Top products */}
      <div className="card" style={{ padding: "18px 20px", gridColumn: "1 / -1" }}>
        <p style={{ fontSize: "0.72rem", fontWeight: 700, color: "#6b7280", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>แม่แบบที่ขาย</p>
        {(() => {
          const byProduct: Record<string, number> = {};
          (detail?.projects ?? []).forEach(p => { byProduct[p.product] = (byProduct[p.product] || 0) + p.valueNum; });
          const sorted = Object.entries(byProduct).sort((a, b) => b[1] - a[1]);
          const total = sorted.reduce((s, [, v]) => s + v, 0);
          const colors = ["#003366", "#0a4f8c", "#1e6fbf", "#4d94d4", "#82b4e3", "#b8d4f0"];
          return sorted.map(([product, value], i) => (
            <div key={product} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span className="badge" style={BADGE(colors[i % colors.length] + "22", colors[i % colors.length])}>{product}</span>
              <div style={{ flex: 1, height: 6, background: "#f0f0f5", borderRadius: 99, overflow: "hidden" }}>
                <div className="top5-bar" style={{ height: "100%", width: `${Math.round(value / total * 100)}%`, background: colors[i % colors.length], borderRadius: 99 }} />
              </div>
              <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#2D2D2D", minWidth: 60, textAlign: "right" }}>{fmtM(value)}</span>
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
        <div className="card-title">ลูกค้าเป้าหมายที่ได้รับมอบหมาย</div>
      </div>
      <div className="table-wrap">
        <table>
          <colgroup>
            <col style={{ width: "10%" }} />
            <col style={{ width: "24%" }} />
            <col style={{ width: "13%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "14%" }} />
          </colgroup>
          <thead>
            <tr>
              {["รหัสลูกค้าเป้าหมาย", "ลูกค้า", "จังหวัด", "แม่แบบ", "มูลค่า", "สถานะ", "มอบหมายเมื่อ"].map(h => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", fontSize: "0.8rem", color: "#9ca3af" }}>ไม่มีลูกค้าเป้าหมาย</td></tr>
            )}
            {leads.map(l => {
              const st = LEAD_STATUS[l.status];
              return (
                <tr key={l.id}>
                  <td style={{ fontSize: "0.72rem", color: "#6b7280", fontWeight: 600 }}>{l.id}</td>
                  <td style={{ fontSize: "0.8rem", fontWeight: 700, color: "#2D2D2D" }}>{l.name}</td>
                  <td style={{ fontSize: "0.8rem", color: "#6b7280" }}>{l.province}</td>
                  <td><span className="badge" style={BADGE("#f0f0f5", "#6b7280")}>{l.product}</span></td>
                  <td className="num" style={{ fontSize: "0.8rem", fontWeight: 700, color: "#003366" }}>{fmtM(l.valueNum)}</td>
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
                  <span style={{ fontSize: "0.86rem", fontWeight: 700, color: "#2D2D2D" }}>{p.name}</span>
                  <span className="badge" style={BADGE(st.bg, st.color)}>{st.label}</span>
                  <span className="badge" style={BADGE("#f0f0f5", "#6b7280")}>{p.product}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <span style={{ fontSize: "0.72rem", color: "#6b7280" }}>คาดปิดการขาย: {p.dueDate}</span>
                  <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#003366" }}>{fmtM(p.valueNum)}</span>
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
          <colgroup>
            <col style={{ width: "10%" }} />
            <col style={{ width: "26%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "14%" }} />
          </colgroup>
          <thead>
            <tr>
              {["เลขที่", "ลูกค้า", "แม่แบบ", "มูลค่า", "ส่วนลด", "สถานะ", "วันที่"].map(h => (
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
                  <td style={{ fontSize: "0.72rem", fontWeight: 700, color: "#003366" }}>{q.quoteNo}</td>
                  <td style={{ fontSize: "0.8rem", fontWeight: 600, color: "#2D2D2D" }}>{q.customer}</td>
                  <td><span className="badge" style={BADGE("#f0f0f5", "#6b7280")}>{q.product}</span></td>
                  <td className="num" style={{ fontSize: "0.8rem", fontWeight: 700, color: "#003366" }}>{fmtM(q.valueNum)}</td>
                  <td>
                    {q.discountPct > 0
                      ? <span style={{ fontSize: "0.72rem", fontWeight: 700, color: q.discountPct >= 10 ? "#dc2626" : "#d97706" }}>−{q.discountPct}%</span>
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
  { key: "leads",     label: "ลูกค้าเป้าหมาย" },
  { key: "projects",  label: "โอกาสการขาย" },
  { key: "quotes",    label: "ใบเสนอ" },
  { key: "customers", label: "ลูกค้า" },
  { key: "activity",  label: "กิจกรรม" },
] as const;

// ── Customer tab (read-only) — ลูกค้าที่ตัวแทนนี้ดูแล ────────────────────────────
function CustomerTab({ customers }: { customers: HQCustomer[] }) {
  return (
    <div className="card">
      <div className="card-header"><div className="card-title">ลูกค้าที่ตัวแทนนี้ดูแล</div></div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>{["ลูกค้า", "จังหวัด", "ประเภท", "ดีลที่ปิด", "มูลค่ารวม", "สถานะ"].map(h => <th key={h}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {customers.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", fontSize: "0.8rem", color: "#9ca3af" }}>ยังไม่มีลูกค้า</td></tr>
            )}
            {customers.map(c => (
              <tr key={c.id}>
                <td style={{ fontSize: "0.8rem", fontWeight: 700, color: "#2D2D2D" }}>{c.name}</td>
                <td style={{ fontSize: "0.8rem", color: "#6b7280" }}>{c.province}</td>
                <td><span className="badge" style={BADGE("#f0f0f5", "#6b7280")}>{c.type}</span></td>
                <td className="num" style={{ fontSize: "0.8rem", fontWeight: 700, color: "#2D2D2D" }}>{c.dealsWon}</td>
                <td className="num" style={{ fontSize: "0.8rem", fontWeight: 700, color: "#003366" }}>{fmtM(c.totalRevenue)}</td>
                <td><span className="badge" style={c.status === "active" ? BADGE("#e5faf0", "#059669") : BADGE("#f0f0f5", "#9ca3af")}>{c.status === "active" ? "ใช้งาน" : "ไม่ใช้งาน"}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Activity tab (read-only) — ไทม์ไลน์งาน: ออกใบเสนอ + รับมอบหมายลูกค้าเป้าหมาย ──
function ActivityTab({ leads, quotes }: { leads: DealerLeadItem[]; quotes: DealerQuoteItem[] }) {
  const items = [
    ...quotes.map(q => ({ id: `q-${q.quoteNo}`, icon: <ScrollText size={14} />, color: "#003366",
      title: `ออกใบเสนอราคา ${q.customer}`, sub: `${q.product} · ${fmtM(q.valueNum)} · ${QUOTE_STATUS[q.status].label}`, date: q.date })),
    ...leads.map(l => ({ id: `l-${l.id}`, icon: <Users size={14} />, color: "#6b7280",
      title: `รับมอบหมายลูกค้าเป้าหมาย ${l.name}`, sub: `${l.product} · ${fmtM(l.valueNum)}`, date: l.assignedAt })),
  ];
  return (
    <div className="card">
      <div className="card-header"><div className="card-title">กิจกรรมล่าสุด</div></div>
      <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {items.length === 0 && <div style={{ padding: 20, textAlign: "center", fontSize: "0.8rem", color: "#9ca3af" }}>ยังไม่มีกิจกรรม</div>}
        {items.map((it, i) => (
          <div key={it.id} style={{ display: "flex", gap: 12, padding: "12px 4px", borderTop: i ? "1px solid #f1f5f9" : "none" }}>
            <span style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0, background: it.color + "14", color: it.color, display: "flex", alignItems: "center", justifyContent: "center" }}>{it.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#2D2D2D" }}>{it.title}</div>
              <div style={{ fontSize: "0.72rem", color: "#6b7280", marginTop: 1 }}>{it.sub}</div>
            </div>
            <span style={{ fontSize: "0.7rem", color: "#9ca3af", flexShrink: 0 }}>{it.date}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

type TabKey = typeof TABS[number]["key"];

export default function DealerDrillDownPage({ params }: { params: Promise<{ dealerCode: string }> }) {
  const { dealerCode } = use(params);
  // อ่านจากชุดที่ persist (hq_dealers_v2) — ตัวแทนที่ HQ เพิ่มใหม่ต้องเปิดหน้านี้ได้ ไม่ใช่ 404
  const [dealers] = usePersistentState<DealerRow[]>("hq_dealers_v2", dealerLeaderboard);
  const [tab, setTab] = useState<TabKey>("overview");
  const code = dealerCode.toUpperCase();
  const dealer = dealers.find(d => d.code === code) ?? dealerLeaderboard.find(d => d.code === code);
  // รายละเอียดตัวแทนแบบเชื่อมต่อ: CNX = ข้อมูลสด (leads/projects/quotes/ยอดรายเดือน) · สาขาอื่น = seed
  const detail = useNetworkDealerDetail(code);
  const custs = useNetworkCustomers().filter(c => c.dealerCode === code); // ลูกค้าของตัวแทนนี้ (แหล่งเดียว)

  if (!dealer) return notFound();

  const targetPct = dealer.revenueTarget > 0 ? Math.min(100, Math.round(dealer.revenueActual / dealer.revenueTarget * 100)) : 0;
  const isAtRisk  = targetPct < 50;
  const isWarn    = targetPct >= 50 && targetPct < 70;

  return (
    <div className="erp">
      {/* Back link */}
      <Link href="/hq/dealers" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "0.8rem", color: "#6b7280", textDecoration: "none", marginBottom: 16, fontWeight: 600 }}>
        <ArrowLeft size={14} /> กลับไปหน้าตัวแทน
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
            ภาค{dealer.region} · {dealer.activeProjects} โอกาสการขาย · อัตราปิดการขาย {dealer.winRate}% · ติดตามตรงเวลา {dealer.onTimePct}%
          </p>
        </div>
      </div>

      {/* โหมดดูอย่างเดียว — HQ เจาะดูข้อมูลตัวแทนได้ทั้งหมด แก้ไม่ได้ (จัดการที่หน้าตัวแทน) */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", background: "#f5f7fa", border: "1px solid #e5e7eb",
        borderLeft: "3px solid #003366", borderRadius: 10, padding: "10px 14px", marginBottom: 16 }}>
        <Lock size={15} color="#003366" style={{ flexShrink: 0 }} />
        <span style={{ fontSize: "0.78rem", color: "#374151", flex: 1, minWidth: 180 }}>
          <strong style={{ color: "#003366" }}>โหมดดูอย่างเดียว</strong> — HQ ดูข้อมูลของตัวแทนได้ทั้งหมด แต่แก้ไขไม่ได้จากหน้านี้
        </span>
        <button disabled title="เฉพาะ Super Admin" className="btn btn-secondary btn-sm"
          style={{ opacity: .55, cursor: "not-allowed" }}><Lock size={12} /> เข้าสู่โหมดจัดการ</button>
      </div>

      {/* Tabs */}
      <div className="tab-bar" style={{ marginBottom: 20, overflowX: "auto" }}>
        {TABS.map(t => {
          const count = t.key === "leads" ? detail.leads.length
            : t.key === "projects" ? detail.projects.length
            : t.key === "quotes" ? detail.quotes.length
            : t.key === "customers" ? custs.length
            : null;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`tab-item ${tab === t.key ? "active" : ""}`}
              style={{ display: "flex", alignItems: "center", gap: 5 }}>
              {t.label}
              {count !== null && (
                <span style={{ fontSize: "0.65rem", fontWeight: 700, background: tab === t.key ? "#dce5f0" : "#e5e7eb", color: tab === t.key ? "#003366" : "#6b7280", borderRadius: 99, padding: "1px 6px" }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content — เชื่อมต่อ: CNX = ข้อมูลสด · สาขาอื่น = seed (แต่ละแท็บมี empty state ในตัว) */}
      {tab === "overview"  && <OverviewTab dealer={dealer} detail={detail} />}
      {tab === "leads"     && <LeadsTab    leads={detail.leads} />}
      {tab === "projects"  && <ProjectsTab projects={detail.projects} />}
      {tab === "quotes"    && <QuotesTab   quotes={detail.quotes} />}
      {tab === "customers" && <CustomerTab customers={custs} />}
      {tab === "activity"  && <ActivityTab leads={detail.leads} quotes={detail.quotes} />}
    </div>
  );
}
