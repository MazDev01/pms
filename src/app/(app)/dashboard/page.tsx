"use client";

import { useState, useMemo } from "react";
import {
  leads, appointments, customers,
  quotations, pipelineDeals,
  apptTypeLabel,
} from "@/lib/mock";
import { useFilters } from "@/context/FilterContext";
import { FilterBar } from "@/components/filters/FilterBar";

// --- TOKENS ------------------------------------------------------
const PRIMARY = "#003366";
const AMBER   = "#ECC94B";
const DARK    = "#2D2D2D";
const MUTED   = "#6b7280";

// --- MONTHLY DATA (a = actual, p = plan; K฿) ---------------------
const MONTHLY = [
  { m:"ม.ค.", a:380, p:450 }, { m:"ก.พ.", a:490, p:520 },
  { m:"มี.ค.", a:650, p:600 }, { m:"เม.ย.", a:420, p:480 },
  { m:"พ.ค.", a:820, p:700 }, { m:"มิ.ย.", a:290, p:350 },
  { m:"ก.ค.", a:0, p:580 },   { m:"ส.ค.", a:0, p:620 },
  { m:"ก.ย.", a:0, p:540 },   { m:"ต.ค.", a:0, p:590 },
  { m:"พ.ย.", a:0, p:610 },   { m:"ธ.ค.", a:0, p:680 },
];

// --- HELPERS -----------------------------------------------------
function fmt(n: number) {
  if (n >= 1e6) return `฿${(n / 1e6).toFixed(1)}M`;
  if (n >= 1000) return `฿${(n / 1000).toFixed(0)}K`;
  return `฿${n.toLocaleString()}`;
}
function leadValue(v: string): number {
  const n = parseFloat(v.replace(/[฿,]/g, ""));
  if (v.includes("M")) return n * 1e6;
  if (v.includes("K")) return n * 1e3;
  return n || 0;
}
// Catmull-Rom → cubic-bezier smoothing
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return "";
  let d = `M${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  return d;
}

// --- ICONS -------------------------------------------------------
const Ico = {
  money: (c = "#059669") => <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke={c} strokeWidth="1.9"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
  phone: (c = PRIMARY) => <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke={c} strokeWidth="1.9"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.9 10.82 19.79 19.79 0 01.84 2.18 2 2 0 012.83 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L7.09 7.91a16 16 0 006 6l.98-.98a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>,
  deal: (c = "#d97706") => <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke={c} strokeWidth="1.9"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
  users: (c = DARK) => <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke={c} strokeWidth="1.9"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
  check: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
  bell: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  calendar: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  doc: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
};

// --- LINE CHART (ERP-style: reveal + area + hover tooltip) -------
function RevenueChart() {
  const [hover, setHover] = useState<number | null>(null);
  const W = 600, H = 220, PL = 50, RX = 585, TOP = 20, BOT = 170;
  const n = MONTHLY.length;
  const maxV = Math.max(...MONTHLY.flatMap(d => [d.a, d.p])) * 1.15;
  const xAt = (i: number) => PL + i * ((RX - PL) / (n - 1));
  const yAt = (v: number) => BOT - (v / maxV) * (BOT - TOP);

  const actualPts = MONTHLY.map((d, i) => ({ x: xAt(i), y: yAt(d.a), v: d.a, has: d.a > 0 }))
    .filter(p => p.has);
  const planPts = MONTHLY.map((d, i) => ({ x: xAt(i), y: yAt(d.p) }));

  const actualPath = smoothPath(actualPts);
  const planPath   = smoothPath(planPts);
  const areaPath   = actualPts.length
    ? `${actualPath} L${actualPts[actualPts.length - 1].x.toFixed(2)},${BOT} L${actualPts[0].x.toFixed(2)},${BOT} Z`
    : "";
  const lastActual = actualPts[actualPts.length - 1];

  const grid = [0, 0.25, 0.5, 0.75, 1].map(f => ({ y: BOT - f * (BOT - TOP), v: Math.round(maxV * f) }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ overflow: "visible", cursor: "crosshair" }}
      onMouseMove={e => {
        const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
        const sx = ((e.clientX - r.left) / r.width) * W;
        const i = Math.max(0, Math.min(n - 1, Math.round((sx - PL) / ((RX - PL) / (n - 1)))));
        setHover(i);
      }}
      onMouseLeave={() => setHover(null)}>
      <defs>
        <linearGradient id="benAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={PRIMARY} stopOpacity="0.28" />
          <stop offset="95%" stopColor={PRIMARY} stopOpacity="0" />
        </linearGradient>
        <clipPath id="benReveal">
          <rect x={PL} y="0" height={BOT + 20} width={RX - PL + 5} />
        </clipPath>
      </defs>

      {/* gridlines */}
      {grid.map((g, i) => (
        <g key={i}>
          <line x1={PL} y1={g.y} x2={RX} y2={g.y} stroke="#eef0f3" strokeDasharray={i === 0 ? "0" : "3 3"} />
          <text x={PL - 8} y={g.y + 3} textAnchor="end" fontSize="9.5" fill="#9ca3af">
            {g.v >= 1000 ? `${(g.v / 1000).toFixed(1)}M` : `${g.v}k`}
          </text>
        </g>
      ))}

      <g clipPath="url(#benReveal)">
        {/* Plan (amber dashed) */}
        <path d={planPath} fill="none" stroke={AMBER} strokeWidth="2" strokeDasharray="5 4" />
        {/* Actual (navy) + area */}
        <path d={areaPath} fill="url(#benAreaGrad)" className="chart-area-fill" />
        <path d={actualPath} fill="none" stroke={PRIMARY} strokeWidth="2.5" />
      </g>
      {lastActual && (
        <circle cx={lastActual.x} cy={lastActual.y} r="5" fill={PRIMARY} stroke="#fff" strokeWidth="2" className="chart-dot-end" />
      )}

      {/* x labels */}
      {MONTHLY.map((d, i) => (
        <text key={i} x={xAt(i)} y={H - 12} textAnchor="middle" fontSize="9" fill="#9ca3af">{d.m}</text>
      ))}

      {/* Hover overlay */}
      {hover !== null && (() => {
        const d = MONTHLY[hover];
        const cx = xAt(hover);
        const cyA = yAt(d.a), cyP = yAt(d.p);
        const tipW = 140, tipH = 64;
        const tipX = cx + 12 > RX - tipW ? cx - tipW - 12 : cx + 12;
        const tipY = Math.max(8, Math.min(cyP, d.a > 0 ? cyA : cyP) - tipH / 2);
        return (
          <g>
            <line x1={cx} y1={TOP} x2={cx} y2={BOT} stroke="#c4cbd4" strokeWidth="1" strokeDasharray="3 3" />
            {d.a > 0 && <circle cx={cx} cy={cyA} r="4.5" fill={PRIMARY} stroke="#fff" strokeWidth="2" />}
            <circle cx={cx} cy={cyP} r="4" fill={AMBER} stroke="#fff" strokeWidth="2" />
            <rect x={tipX} y={tipY} width={tipW} height={tipH} rx="8" fill="#fff" stroke="#e5e7eb" filter="drop-shadow(0 4px 10px rgba(0,0,0,0.10))" />
            <text x={tipX + 12} y={tipY + 17} fontSize="10.5" fontWeight="700" fill={DARK}>{d.m} 2569</text>
            <rect x={tipX + 12} y={tipY + 26} width="8" height="8" rx="2" fill={PRIMARY} />
            <text x={tipX + 24} y={tipY + 33} fontSize="9.5" fill="#404040">ยอดจริง</text>
            <text x={tipX + tipW - 12} y={tipY + 33} fontSize="9.5" fontWeight="700" fill={DARK} textAnchor="end">{d.a ? `${d.a}k฿` : "—"}</text>
            <rect x={tipX + 12} y={tipY + 42} width="8" height="8" rx="2" fill={AMBER} />
            <text x={tipX + 24} y={tipY + 49} fontSize="9.5" fill="#404040">แผน</text>
            <text x={tipX + tipW - 12} y={tipY + 49} fontSize="9.5" fontWeight="700" fill={DARK} textAnchor="end">{d.p}k฿</text>
          </g>
        );
      })()}
    </svg>
  );
}

// --- PAGE --------------------------------------------------------
export default function DashboardPage() {
  const { timeRange } = useFilters();
  const factor = timeRange.factor;
  const scale = (n: number) => Math.round(n * factor);

  const wonValue = useMemo(() =>
    quotations.filter(q => q.status === "won").reduce((s, q) => s + q.totalValue, 0), []);
  const activeDeals = useMemo(() => pipelineDeals.filter(d => d.outcome === "active"), []);
  const pipelineValue = useMemo(() => activeDeals.reduce((s, d) => s + d.value, 0), [activeDeals]);
  const activeLeads = useMemo(() => leads.filter(l => l.status !== "PAID" && l.status !== "CANCELLED"), []);

  const top5 = useMemo(() => {
    const sorted = [...leads].sort((a, b) => leadValue(b.value) - leadValue(a.value)).slice(0, 5);
    const max = leadValue(sorted[0]?.value ?? "0") || 1;
    return sorted.map(l => ({ l, pct: Math.round((leadValue(l.value) / max) * 100) }));
  }, []);

  const upcomingAppts = useMemo(() =>
    [...appointments].filter(a => a.date >= "2026-06-24" && a.status === "upcoming")
      .sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4), []);

  const recent = useMemo(() => {
    const wonQ = quotations.find(q => q.status === "won");
    const newLead = leads[0];
    return [
      { tone: "success", icon: Ico.check(), title: `ปิดการขาย ${wonQ?.project ?? "โอกาสการขาย"} สำเร็จ`, meta: `มูลค่า ${wonQ?.total ?? "—"} · ส่งต่อ HQ แล้ว · 8 นาทีที่แล้ว` },
      { tone: "navy", icon: Ico.phone("currentColor"), title: `ผู้สนใจใหม่ ${newLead?.name ?? ""}`, meta: `${newLead?.province ?? ""} · ${newLead?.product ?? ""} · 24 นาทีที่แล้ว` },
      { tone: "navy", icon: Ico.doc(), title: "ส่งใบเสนอราคา Q-2026-0098 ให้ลูกค้า", meta: "บจ. อุตรดิตถ์โลหะ · รอตอบกลับ · 1 ชั่วโมงที่แล้ว" },
      { tone: "amber", icon: Ico.bell(), title: "ครบกำหนดติดตาม: หจก. ราชบุรีโลหะ", meta: "โอกาสการขายโกดัง PEB ราชบุรี · วันนี้ 10:00 · 2 ชั่วโมงที่แล้ว" },
      { tone: "navy", icon: Ico.calendar(), title: "นัดนำเสนอ บจ. ไทยสตีล", meta: "พรุ่งนี้ 09:30 น. · เพิ่งสร้าง" },
    ];
  }, []);

  const toneStyle: Record<string, { bg: string; color: string }> = {
    success: { bg: "#e5faf0", color: "#059669" },
    navy:    { bg: "#dce5f0", color: PRIMARY },
    amber:   { bg: "#fff3cd", color: "#d97706" },
  };

  const STATS = [
    { label: "ยอดขายปิดได้", value: fmt(scale(wonValue)), icon: Ico.money(PRIMARY), delta: "+12.4% จากเดือนก่อน", up: true, href: "/quotations" },
    { label: "ผู้สนใจทั้งหมด", value: String(scale(leads.length)), icon: Ico.phone(PRIMARY), delta: `${scale(activeLeads.length)} กำลังดำเนินการ`, up: true, href: "/leads" },
    { label: "โอกาสการขายในมือ", value: String(scale(activeDeals.length)), icon: Ico.deal(PRIMARY), delta: `มูลค่า ${fmt(scale(pipelineValue))}`, up: true, href: "/pipeline" },
    { label: "ลูกค้า", value: String(customers.length), icon: Ico.users(PRIMARY), delta: "ทั้งหมดในระบบ", up: true, href: "/customers" },
  ];

  return (
    <div className="erp">
      {/* Header */}
      <div className="page-head">
        <div>
          <h2>แดชบอร์ด</h2>
          <p>สรุปภาพรวมงานขาย Benjamin PMS · {timeRange.subtitle}</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <FilterBar dims={[]} />
          <button type="button" className="btn btn-secondary" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            ส่งออก
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="stat-grid">
        {STATS.map(s => (
          <a key={s.label} href={s.href} className="stat-card clickable" style={{ textDecoration: "none", display: "block" }}>
            <div className="stat-icon" style={{ background: "var(--accent)" }}>{s.icon}</div>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
            <div className={`stat-delta ${s.up ? "delta-up" : "delta-down"}`}>{s.delta}</div>
          </a>
        ))}
      </div>

      {/* Chart + Top5 */}
      <div className="row-2">
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">รายได้รายเดือน</div>
              <div className="card-desc">ยอดขายจริง เทียบ เป้าหมายปี (K฿)</div>
            </div>
            <div style={{ display: "flex", gap: "0.75rem", fontSize: "0.72rem" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: PRIMARY }} />ยอดจริง</span>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: AMBER }} />แผน</span>
            </div>
          </div>
          <div className="card-body"><RevenueChart /></div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">ผู้สนใจมูลค่าสูง 5 อันดับแรก</div>
              <div className="card-desc">เรียงตามมูลค่าโอกาส</div>
            </div>
          </div>
          <div className="card-body" style={{ paddingTop: 0 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
              {top5.map((t, i) => (
                <a key={t.l.id} href={`/leads/${t.l.numId}`} className="top5-row" style={{ animationDelay: `${0.1 + i * 0.1}s`, textDecoration: "none", display: "block" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: "0.25rem" }}>
                    <span style={{ color: DARK }}><strong>{t.l.name}</strong> · {t.l.province}</span>
                    <span style={{ color: MUTED, fontWeight: 700 }}>{t.l.value}</span>
                  </div>
                  <div style={{ height: 6, background: "#f4f6f9", borderRadius: 999 }}>
                    <div className="top5-bar" style={{ height: "100%", width: `${t.pct}%`, background: PRIMARY, borderRadius: 999, animationDelay: `${0.25 + i * 0.1}s` }} />
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Activity + Upcoming */}
      <div className="row-2-eq">
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">กิจกรรมล่าสุด</div>
              <div className="card-desc">ความเคลื่อนไหวงานขายของคุณ</div>
            </div>
            <a href="/activity" className="btn btn-ghost btn-sm">ดูทั้งหมด</a>
          </div>
          <div>
            {recent.map((a, i) => {
              const t = toneStyle[a.tone];
              return (
                <div key={i} className="activity">
                  <div className="activity-icon" style={{ background: t.bg, color: t.color }}>{a.icon}</div>
                  <div className="activity-text">
                    <div className="activity-title">{a.title}</div>
                    <div className="activity-meta">{a.meta}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">นัดหมายของฉัน</div>
              <div className="card-desc">กำลังจะถึง</div>
            </div>
            <a href="/calendar" className="btn btn-ghost btn-sm">ปฏิทิน</a>
          </div>
          <div>
            {upcomingAppts.map(a => {
              const [, mm, dd] = a.date.split("-");
              const months = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
              return (
                <div key={a.id} className="activity">
                  <div className="activity-icon" style={{ background: "#dce5f0", color: PRIMARY, flexDirection: "column", lineHeight: 1 }}>
                    <span style={{ fontSize: "0.72rem", fontWeight: 800 }}>{parseInt(dd)}</span>
                    <span style={{ fontSize: "0.5rem" }}>{months[parseInt(mm)]}</span>
                  </div>
                  <div className="activity-text">
                    <div className="activity-title">{a.company}</div>
                    <div className="activity-meta">{apptTypeLabel[a.type]} · {a.time} น.</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Top leads table */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">ผู้สนใจอันดับต้น</div>
            <div className="card-desc">โอกาสการขายที่ควรเร่งติดตาม</div>
          </div>
          <a href="/leads" className="btn btn-ghost btn-sm">ดูทั้งหมด</a>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ลูกค้า</th><th>สินค้า</th><th className="num">มูลค่า</th><th>จังหวัด</th><th>ผู้รับผิดชอบ</th>
              </tr>
            </thead>
            <tbody>
              {[...leads].sort((a, b) => leadValue(b.value) - leadValue(a.value)).slice(0, 6).map(l => (
                <tr key={l.id} className="clickable" onClick={() => { window.location.href = `/leads/${l.numId}`; }}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <div style={{ width: 30, height: 30, borderRadius: 9, background: PRIMARY, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 800, flexShrink: 0 }}>{l.name.charAt(0)}</div>
                      <span style={{ fontWeight: 600 }}>{l.name}</span>
                    </div>
                  </td>
                  <td style={{ color: MUTED }}>{l.product}</td>
                  <td className="num" style={{ fontWeight: 700 }}>{l.value}</td>
                  <td style={{ color: MUTED }}>{l.province}</td>
                  <td style={{ color: MUTED }}>{l.assigned}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
