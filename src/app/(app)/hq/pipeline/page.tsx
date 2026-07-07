"use client";

import { useState } from "react";
import {
  Download, Users, Target, CheckCircle2, Trophy, TrendingDown,
} from "lucide-react";
import {
  hqPipelineLostReasons, hqPipelineByProduct, hqAllQuotations, dealerLeaderboard, mainTemplateOf,
} from "@/lib/mock";
import { useFilters } from "@/context/FilterContext";
import { FilterBar } from "@/components/filters/FilterBar";

function fmtM(n: number) {
  return n >= 1_000_000 ? `฿${(n / 1_000_000).toFixed(1)}M` : `฿${(n / 1000).toFixed(0)}K`;
}

// Color ramp: slate → light blue → blue → dark blue → navy
const STAGE_PALETTE = ["#94a3b8", "#60a5fa", "#2563eb", "#1e40af", "#003366"];

// ── Funnel ────────────────────────────────────────────────────────
type FunnelStage = { key: string; label: string; count: number; valueNum: number };
function FunnelChart({ stages }: { stages: FunnelStage[] }) {
  const maxCount = stages[0]?.count || 1; // || กัน 0/0 = NaN ตอนไม่มีใบเสนอราคาในช่วงเวลา

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {stages.map((stage, i) => {
        const prev      = stages[i - 1];
        const convRate  = prev && prev.count > 0 ? Math.round((stage.count / prev.count) * 100) : null;
        const widthPct  = Math.round((stage.count / maxCount) * 100);
        const isLast    = i === stages.length - 1;
        const color     = STAGE_PALETTE[Math.min(i, STAGE_PALETTE.length - 1)];
        const convColor = !convRate ? "#6b7280"
          : convRate >= 70 ? "#059669"
          : convRate >= 50 ? "#f59e0b"
          : "#dc2626";

        return (
          <div key={stage.key}>
            {/* Conversion connector */}
            {convRate !== null && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0 4px 19px" }}>
                <div style={{ width: 1.5, height: 16, background: "#dde1e7", flexShrink: 0 }} />
                <span style={{
                  fontSize: "0.65rem", fontWeight: 700, color: convColor,
                  background: convColor + "18", borderRadius: 20,
                  padding: "2px 9px", border: `1px solid ${convColor}28`,
                  display: "flex", alignItems: "center", gap: 4,
                }}>
                  <TrendingDown size={9} color={convColor} /> {convRate}% ผ่านมา
                </span>
              </div>
            )}

            {/* Stage card */}
            <div style={{
              border: `1.5px solid ${isLast ? "#003366" : "#e5e7eb"}`,
              borderRadius: 12, padding: "13px 16px",
              background: isLast ? "#eef3f8" : "#fff",
              boxShadow: isLast ? "0 4px 16px rgba(0,51,102,.10)" : "var(--shadow-sm)",
            }}>
              {/* Top row */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                    background: isLast ? "#003366" : color + "20",
                    color: isLast ? "#fff" : color,
                    fontSize: "0.65rem", fontWeight: 800,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>{i + 1}</div>
                  <span style={{ fontSize: "0.8rem", fontWeight: 700, color: isLast ? "#003366" : "#2D2D2D" }}>
                    {stage.label}
                  </span>
                </div>
                <span style={{
                  fontSize: "0.72rem", fontWeight: 800,
                  color: isLast ? "#003366" : color,
                  background: (isLast ? "#003366" : color) + "15",
                  borderRadius: 8, padding: "3px 10px",
                }}>
                  {stage.count} ราย
                </span>
              </div>

              {/* Progress bar */}
              <div style={{ height: 7, background: "#f4f6f9", borderRadius: 99, overflow: "hidden", marginBottom: 9 }}>
                <div className="top5-bar" style={{
                  height: "100%", width: `${widthPct}%`, borderRadius: 99,
                  background: isLast ? "#003366" : color,
                }} />
              </div>

              {/* Bottom row */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                <div>
                  <div style={{ fontSize: "0.65rem", color: "#9ca3af", marginBottom: 1 }}>มูลค่ารวม</div>
                  <div style={{ fontSize: "0.92rem", fontWeight: 800, color: isLast ? "#003366" : "#2D2D2D" }}>
                    {fmtM(stage.valueNum)}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "0.65rem", color: "#9ca3af", marginBottom: 1 }}>เฉลี่ย/โอกาสการขาย</div>
                  <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#6b7280" }}>
                    {fmtM(stage.count ? Math.round(stage.valueNum / stage.count) : 0)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Lost reasons ──────────────────────────────────────────────────
function LostReasons() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {hqPipelineLostReasons.map((r, i) => (
        <div key={r.reason} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
            background: i === 0 ? "#fef2f2" : "#f4f6f9",
            color: i === 0 ? "#dc2626" : "#9ca3af",
            fontSize: "0.65rem", fontWeight: 800,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>{i + 1}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: "0.72rem", color: "#2D2D2D", fontWeight: 600 }}>{r.reason}</span>
              <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#dc2626", flexShrink: 0, marginLeft: 8 }}>
                {r.count} ราย
              </span>
            </div>
            <div style={{ height: 5, background: "#fef2f2", borderRadius: 99, overflow: "hidden" }}>
              <div className="top5-bar" style={{
                height: "100%", width: `${r.pct}%`,
                background: i === 0 ? "#dc2626" : "#f87171",
                opacity: 1 - i * 0.14, borderRadius: 99,
              }} />
            </div>
          </div>
          <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#9ca3af", minWidth: 28, textAlign: "right" }}>
            {r.pct}%
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Product breakdown ─────────────────────────────────────────────
type ProductItem = { product: string; count: number; valueNum: number; color: string };
function ProductBreakdown({ items }: { items: ProductItem[] }) {
  const total = items.reduce((s, p) => s + p.valueNum, 0) || 1;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map(p => {
        const pct = Math.round((p.valueNum / total) * 100);
        return (
          <div key={p.product} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* label กว้างคงที่ — แถบทุกอันเริ่มตรงแนวเดียวกัน */}
            <span title={p.product} style={{
              width: 150, flexShrink: 0,
              fontSize: "0.65rem", fontWeight: 700, padding: "3px 8px",
              borderRadius: 6, background: p.color + "18", color: p.color,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>{p.product}</span>
            <div style={{ flex: 1, height: 6, background: "#f4f6f9", borderRadius: 99, overflow: "hidden" }}>
              <div className="top5-bar" style={{ height: "100%", width: `${pct}%`, background: p.color, borderRadius: 99 }} />
            </div>
            <div style={{ textAlign: "right", flexShrink: 0, width: 70 }}>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#2D2D2D" }}>{fmtM(p.valueNum)}</div>
              <div style={{ fontSize: "0.65rem", color: "#9ca3af" }}>{pct}%</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Dealer table ──────────────────────────────────────────────────

// ── Main ──────────────────────────────────────────────────────────
export default function SalesOverviewPage() {
  const { timeRange, inRange } = useFilters();
  const pf = 1; // ตัวเลขจริง — ไม่สเกลปลอม

  const [toast, setToast]           = useState<string | null>(null);
  const [showExport, setShowExport] = useState(false);
  // ตัวเลือกตัวแทนเฉพาะหน้านี้ (แต่ละหน้า HQ เลือกแยกกัน)
  const [dealerSel, setDealerSel]   = useState<string>("all");
  const selDealer = dealerSel === "all" ? null : dealerLeaderboard.find(d => d.code === dealerSel) ?? null;

  // ใบเสนอราคาในขอบเขต = ตัวแทนที่เลือก (ถ้ามี) + ช่วงเวลาจากตัวกรองหลัก → funnel/สินค้า กรองตามเวลาจริง
  const branchQs = hqAllQuotations.filter(q => (!selDealer || q.dealerCode === selDealer.code) && inRange(q.createdAt));
  const stages: { key: string; label: string; count: number; valueNum: number }[] = (() => {
    const by = (f: (s: string) => boolean) => branchQs.filter(q => f(q.status));
    const sum = (qs: typeof branchQs) => qs.reduce((s, q) => s + q.valueNum, 0);
    const sent   = by(s => s !== "draft");
    const viewed = by(s => s === "viewed" || s === "won" || s === "lost");
    const won    = by(s => s === "won");
    return [
      { key: "all",    label: "ใบเสนอราคาทั้งหมด",  count: branchQs.length, valueNum: sum(branchQs) },
      { key: "sent",   label: "ส่งถึงลูกค้า",        count: sent.length,     valueNum: sum(sent) },
      { key: "viewed", label: "ลูกค้าเปิดดู",        count: viewed.length,   valueNum: sum(viewed) },
      { key: "won",    label: "ปิดการขายสำเร็จ",    count: won.length,      valueNum: sum(won) },
    ];
  })();
  const products: ProductItem[] = (() => {
    const colorOf = new Map(hqPipelineByProduct.map(p => [p.product, p.color]));
    const m = new Map<string, { count: number; valueNum: number }>();
    branchQs.forEach(q => {
      const key = mainTemplateOf(q.productLine); // ยุบแม่แบบย่อยเข้าแม่แบบหลัก
      const r = m.get(key) ?? { count: 0, valueNum: 0 };
      r.count += 1; r.valueNum += q.valueNum;
      m.set(key, r);
    });
    return [...m.entries()]
      .map(([product, v]) => ({ product, ...v, color: colorOf.get(product) ?? "#003366" }))
      .sort((a, b) => b.valueNum - a.valueNum);
  })();

  const first = stages[0];
  const last  = stages[stages.length - 1];
  const overallConv = first.count ? Math.round((last.count / first.count) * 100) : 0;

  // ส่งออกจริง — รวม funnel + เหตุผลเสียโอกาส + แยกตามสินค้า เป็น CSV (เปิดใน Excel ได้)
  function doExport(fmt: string) {
    setShowExport(false);
    const rows: string[] = [];
    rows.push(selDealer ? `ช่องทางการขาย (Funnel) — ตัวแทน ${selDealer.code}` : "ช่องทางการขาย (Funnel)");
    rows.push(["ขั้นตอน", "จำนวน (ราย)", "มูลค่า (บาท)"].join(","));
    stages.forEach(s => rows.push([s.label, Math.round(s.count * pf), Math.round(s.valueNum * pf)].join(",")));
    if (!selDealer) {
      rows.push("");
      rows.push("เหตุผลที่เสียโอกาสการขาย");
      rows.push(["เหตุผล", "จำนวน", "สัดส่วน (%)"].join(","));
      hqPipelineLostReasons.forEach(r => rows.push([r.reason, r.count, r.pct].join(",")));
    }
    rows.push("");
    rows.push("แยกตามแม่แบบ / บริการ");
    rows.push(["แม่แบบ", "จำนวนโอกาสการขาย", "มูลค่า (บาท)"].join(","));
    products.forEach(p => rows.push([p.product, p.count, Math.round(p.valueNum * pf)].join(",")));
    const blob = new Blob(["﻿" + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `hq-pipeline-${timeRange.preset}.csv`; a.click();
    URL.revokeObjectURL(url);
    setToast(`ส่งออก ${fmt} แล้ว`);
    setTimeout(() => setToast(null), 2600);
  }

  const midStage = stages[1]; // funnel จากใบเสนอราคา (โครงสร้างเดียวกันทั้งมุมมองรวม/รายตัวแทน)
  const kpis = [
    {
      label: "ใบเสนอราคาทั้งหมด",
      value: `${Math.round(first.count * pf).toLocaleString()} ราย`,
      sub: fmtM(Math.round(first.valueNum * pf)),
      iconClass: "kpi-navy",
      icon: <Users size={16} />,
    },
    {
      label: "ในกระบวนการ",
      value: `${Math.round(midStage.count * pf).toLocaleString()} ราย`,
      sub: "ส่งถึงลูกค้าแล้ว",
      iconClass: "kpi-navy",
      icon: <Target size={16} />,
    },
    {
      label: "อัตราแปลงทั้งกรวย",
      value: `${overallConv}%`,
      sub: "ใบเสนอราคา → ปิดสำเร็จ",
      iconClass: overallConv >= 30 ? "kpi-green" : "kpi-amber",
      icon: <CheckCircle2 size={16} />,
    },
    {
      label: "ปิดได้ช่วงนี้",
      value: fmtM(Math.round(last.valueNum * pf)),
      sub: `${Math.round(last.count * pf)} โอกาสการขาย`,
      iconClass: "kpi-green",
      icon: <Trophy size={16} />,
    },
  ];

  const summaryStat = [
    { label: "อัตราแปลงทั้งกรวย", value: `${overallConv}%`,                                                     color: "#003366" },
    { label: "มูลค่าโอกาสการขาย", value: fmtM(first.valueNum),                                                  color: "#2D2D2D" },
    { label: "ปิดได้เดือนนี้", value: fmtM(last.valueNum),                                                      color: "#059669" },
    { label: "รอปิด (เสนอราคาขึ้นไป)", value: fmtM(stages.slice(selDealer ? 1 : 2, -1).reduce((s, x) => s + x.valueNum, 0)), color: "#f59e0b" },
  ];

  return (
    <div className="erp">
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 9999,
          background: "#2D2D2D", color: "#fff",
          padding: "11px 18px", borderRadius: 12, fontSize: "0.8rem", fontWeight: 600,
          boxShadow: "var(--shadow-lg)", display: "flex", alignItems: "center", gap: 8,
        }}>
          <Download size={14} /> {toast}
        </div>
      )}

      {/* ── Header ── */}
      <div className="page-head">
        <div>
          <h2>ภาพรวมยอดขาย</h2>
          <p>{selDealer ? `มุมมองตัวแทน: ${selDealer.name.replace("Benjamin ", "")} (${selDealer.code}) · อิงจากใบเสนอราคาจริงของตัวแทน` : "ภาพรวมยอดขายและโอกาสการขายทั้งเครือข่าย"} · {timeRange.subtitle}</p>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {/* เลือกดูทั้งเครือ หรือเจาะรายตัวแทน — ตัวเลือกเฉพาะหน้านี้ */}
          <select value={dealerSel} onChange={e => setDealerSel(e.target.value)} className="form-select" style={{ width: "auto", cursor: "pointer" }}>
            <option value="all">ทุกตัวแทน (ทั้งเครือ)</option>
            {dealerLeaderboard.map(d => (
              <option key={d.code} value={d.code}>{d.code} – {d.name.replace("Benjamin ", "")}</option>
            ))}
          </select>
          <FilterBar dims={[]} />
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowExport(v => !v)}
              className="btn btn-secondary btn-md"
            >
              <Download size={14} /> ส่งออก
            </button>
            {showExport && (
              <>
                <div onClick={() => setShowExport(false)} style={{ position: "fixed", inset: 0, zIndex: 100 }} />
                <div style={{
                  position: "absolute", top: "calc(100% + 6px)", right: 0,
                  background: "#fff", border: "1px solid #e5e7eb",
                  borderRadius: 10, boxShadow: "var(--shadow-md)",
                  zIndex: 101, minWidth: 158, overflow: "hidden",
                }}>
                  {["CSV (Excel)"].map(f => (
                    <button key={f} onClick={() => doExport(f)} style={{
                      width: "100%", padding: "10px 16px", textAlign: "left",
                      background: "none", border: "none", fontSize: "0.8rem",
                      color: "#2D2D2D", cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
                    }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#eef3f8"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "none"; }}
                    >
                      <Download size={12} color="#6b7280" /> {f}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── KPI Strip ── */}
      <div className="kpi-bar">
        {kpis.map(k => (
          <div key={k.label} className="kpi">
            <div className={`kpi-icon ${k.iconClass}`}>{k.icon}</div>
            <div>
              <div className="kpi-val">{k.value}</div>
              <div className="kpi-label">{k.label}</div>
              <div className="kpi-label" style={{ marginTop: 2 }}>{k.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Main content ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 310px", gap: 16, alignItems: "start", marginBottom: 16 }}>

        {/* Funnel */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">ช่องทางการขาย</div>
              <div className="card-desc">{selDealer ? `ใบเสนอราคาของตัวแทน ${selDealer.code} จนถึงการปิดการขาย` : "จากผู้สนใจจนถึงการปิดการขาย"}</div>
            </div>
          </div>
          <div className="card-body">
            <FunnelChart stages={stages} />

            {/* Summary strip */}
            <div style={{
              marginTop: 16, paddingTop: 14,
              borderTop: "1px solid #e5e7eb",
              display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
            }}>
              {summaryStat.map((s, si) => (
                <div key={s.label} style={{
                  textAlign: "center", padding: "0 8px",
                  borderRight: si < 3 ? "1px solid #e5e7eb" : "none",
                }}>
                  <div style={{ fontSize: "0.65rem", color: "#9ca3af", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    {s.label}
                  </div>
                  <div style={{ fontSize: "0.92rem", fontWeight: 800, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* เหตุผลเสียโอกาส มีเฉพาะข้อมูลรวมเครือ — ไม่แสดงเลขหลอกตอนดูรายตัวแทน */}
          {!selDealer && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">เหตุผลที่เสียโอกาสการขาย</div>
              </div>
              <div className="card-body"><LostReasons /></div>
            </div>
          )}
          <div className="card">
            <div className="card-header">
              <div className="card-title">แยกตามแม่แบบ / บริการ</div>
            </div>
            <div className="card-body"><ProductBreakdown items={products} /></div>
          </div>
          {selDealer && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">ใบเสนอราคาล่าสุดของตัวแทน</div>
              </div>
              <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {(branchQs ?? []).slice(0, 6).map(q => (
                  <div key={q.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.72rem" }}>
                    <span style={{ fontWeight: 700, color: "#003366", flexShrink: 0 }}>{q.quoteNo}</span>
                    <span style={{ flex: 1, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.customer}</span>
                    <span style={{ fontWeight: 800, color: "#2D2D2D", flexShrink: 0 }}>{fmtM(q.valueNum)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ตารางผลงานต่อตัวแทน (leaderboard) ย้ายไปเป็นเจ้าของเดียวที่ HQ Dashboard */}
    </div>
  );
}
