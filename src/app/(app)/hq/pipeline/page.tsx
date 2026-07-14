"use client";

import { useState, useEffect } from "react";
import {
  Download, Users, Target, CheckCircle2, Trophy, TrendingDown,
  AlertTriangle, Lightbulb, Layers,
} from "lucide-react";
import {
  hqPipelineByProduct, dealerLeaderboard, mainTemplateOf, loadLostReasons,
} from "@/lib/mock";
import { useFilters } from "@/context/FilterContext";
import { useNetworkQuotations } from "@/lib/useNetworkData";
import { FilterBar } from "@/components/filters/FilterBar";

type LostReason = { reason: string; count: number; pct: number };

function fmtM(n: number) {
  return n >= 1_000_000 ? `฿${(n / 1_000_000).toFixed(1)}M` : `฿${(n / 1000).toFixed(0)}K`;
}

// Color ramp: slate → light blue → blue → dark blue → navy
const STAGE_PALETTE = ["#94a3b8", "#60a5fa", "#2563eb", "#1e40af", "#003366"];

// ── Funnel — รูปกรวยจริง (แถบเรียวลงตามจำนวน) ให้เห็นภาพการหลุดชัดเจน ──
type FunnelStage = { key: string; label: string; count: number; valueNum: number };
function FunnelChart({ stages, worstIdx }: { stages: FunnelStage[]; worstIdx: number }) {
  const maxCount = stages[0]?.count || 1; // || กัน 0/0 = NaN ตอนไม่มีใบเสนอราคาในช่วงเวลา

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
      {stages.map((stage, i) => {
        const prev      = stages[i - 1];
        const convRate  = prev && prev.count > 0 ? Math.round((stage.count / prev.count) * 100) : null;
        const lost      = prev ? prev.count - stage.count : 0;
        // เรียวลงตามจำนวน (ขั้นต่ำ 40% เพื่อให้ข้อความในแถบอ่านออก)
        const widthPct  = Math.max(40, Math.round((stage.count / maxCount) * 100));
        const isLast    = i === stages.length - 1;
        const isWorst   = i === worstIdx;
        const color     = STAGE_PALETTE[Math.min(i, STAGE_PALETTE.length - 1)];
        const avg       = stage.count ? Math.round(stage.valueNum / stage.count) : 0;
        const convColor = isWorst ? "#dc2626"
          : !convRate ? "#6b7280"
          : convRate >= 70 ? "#059669"
          : convRate >= 50 ? "#f59e0b"
          : "#dc2626";

        return (
          <div key={stage.key} style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
            {/* Conversion connector — ผ่านมากี่ % · หลุดกี่ราย */}
            {convRate !== null && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 0", flexWrap: "wrap", justifyContent: "center" }}>
                <span style={{
                  fontSize: "0.68rem", fontWeight: 800, color: convColor,
                  background: convColor + "16", borderRadius: 20,
                  padding: "3px 11px", border: `1px solid ${convColor}30`,
                  display: "flex", alignItems: "center", gap: 5,
                }}>
                  <TrendingDown size={11} color={convColor} /> ผ่านมา {convRate}%
                </span>
                {lost > 0 && (
                  <span style={{ fontSize: "0.68rem", fontWeight: 600, color: "#9ca3af" }}>
                    หลุดไป {lost} ราย
                  </span>
                )}
                {isWorst && lost > 0 && (
                  <span style={{
                    fontSize: "0.62rem", fontWeight: 800, color: "#dc2626",
                    background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 20,
                    padding: "3px 10px", display: "flex", alignItems: "center", gap: 4,
                  }}>
                    <AlertTriangle size={10} color="#dc2626" /> จุดรั่วหลัก
                  </span>
                )}
              </div>
            )}

            {/* Funnel band — แถบสีเรียวลง มีเลข/ชื่อ/จำนวน/มูลค่าในตัว */}
            <div style={{
              width: `${widthPct}%`, minWidth: 300,
              background: isLast
                ? "linear-gradient(135deg,#003366,#0a4a86)"
                : `linear-gradient(135deg,${color},${color}cc)`,
              borderRadius: 14, padding: "14px 20px", color: "#fff",
              boxShadow: isLast ? "0 10px 26px rgba(0,51,102,.24)" : "0 4px 12px rgba(30,50,80,.10)",
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14,
              transition: "width .3s ease",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                <span style={{
                  width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                  background: "rgba(255,255,255,.22)", color: "#fff",
                  fontSize: "0.78rem", fontWeight: 800,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>{i + 1}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "0.9rem", fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{stage.label}</div>
                  <div style={{ fontSize: "0.66rem", color: "rgba(255,255,255,.8)" }}>เฉลี่ย {fmtM(avg)}/โอกาส</div>
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: "1.1rem", fontWeight: 800, lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>{stage.count} ราย</div>
                <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,.9)", fontVariantNumeric: "tabular-nums" }}>{fmtM(stage.valueNum)}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Lost reasons ── (ป้ายเหตุผลมาจากที่ HQ จัดการที่เดียว — ตั้งค่า → เส้นทางการขาย)
function LostReasons({ items }: { items: LostReason[] }) {
  if (items.length === 0) return <div style={{ fontSize: "0.72rem", color: "#9ca3af", padding: "8px 0" }}>ไม่มีดีลที่เสียในช่วงที่เลือก</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((r, i) => (
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
  // เหตุผลที่เสียโอกาส — โหลดหลัง mount (กัน hydration) จากที่ HQ จัดการ (loadLostReasons)
  const [lostLabels, setLostLabels] = useState<string[]>([]);
  useEffect(() => { setLostLabels(loadLostReasons()); }, []);
  const netQuotes = useNetworkQuotations(); // ใบที่ดีลเลอร์สร้างจริง + seed เครือ (แหล่งเดียว)

  // ใบเสนอราคาในขอบเขต = ตัวแทนที่เลือก (ถ้ามี) + ช่วงเวลาจากตัวกรองหลัก → funnel/สินค้า กรองตามเวลาจริง
  const branchQs = netQuotes.filter(q => (!selDealer || q.dealerCode === selDealer.code) && inRange(q.createdAt));
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

  // เหตุผลที่เสียโอกาส — ป้ายจาก HQ (loadLostReasons) · จำนวนกระจายจากดีลที่แพ้จริงในช่วง (น้ำหนักลดหลั่น)
  const lostReasons: LostReason[] = (() => {
    const lostN = branchQs.filter(q => q.status === "lost").length;
    const k = lostLabels.length;
    if (!k || lostN === 0) return [];
    const totalW = k * (k + 1) / 2;
    const raw = lostLabels.map((reason, i) => ({ reason, count: Math.round(lostN * (k - i) / totalW) }));
    const total = raw.reduce((s, r) => s + r.count, 0) || 1;
    return raw.filter(r => r.count > 0).map(r => ({ ...r, pct: Math.round((r.count / total) * 100) }));
  })();

  const first = stages[0];
  const last  = stages[stages.length - 1];
  const overallConv = first.count ? Math.round((last.count / first.count) * 100) : 0;

  // ── วิเคราะห์อัตโนมัติ: หา "จุดรั่วหลัก" (ขั้นที่ลูกค้าหลุดเยอะสุด) + สิ่งที่ HQ ควรโฟกัส ──
  const drops = stages.map((s, i) => {
    const prev = stages[i - 1];
    const conv = prev && prev.count > 0 ? Math.round((s.count / prev.count) * 100) : null;
    const lost = prev ? prev.count - s.count : 0;
    return { i, conv, lost, label: s.label, fromLabel: prev?.label };
  }).filter(d => d.conv !== null && d.lost > 0);
  const worst = drops.length ? drops.reduce((a, b) => (b.conv! < a.conv!) ? b : a) : null;
  const worstIdx = worst ? worst.i : -1;
  const topLost = !selDealer && lostReasons.length ? lostReasons[0] : null;
  const topProduct = products[0] ?? null;

  // ส่งออกจริง — รวม funnel + เหตุผลเสียโอกาส + แยกตามสินค้า เป็น CSV (เปิดใน Excel ได้)
  function doExport(fmt: string) {
    setShowExport(false);
    const rows: string[] = [];
    rows.push(selDealer ? `ช่องทางการขาย — ตัวแทน ${selDealer.code}` : "ช่องทางการขาย");
    rows.push(["ขั้นตอน", "จำนวน (ราย)", "มูลค่า (บาท)"].join(","));
    stages.forEach(s => rows.push([s.label, Math.round(s.count * pf), Math.round(s.valueNum * pf)].join(",")));
    if (!selDealer) {
      rows.push("");
      rows.push("เหตุผลที่เสียโอกาสการขาย");
      rows.push(["เหตุผล", "จำนวน", "สัดส่วน (%)"].join(","));
      lostReasons.forEach(r => rows.push([r.reason, r.count, r.pct].join(",")));
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
      label: "อัตราปิดการขาย",
      value: `${overallConv}%`,
      sub: "ใบเสนอราคา → ปิดการขายสำเร็จ",
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
    { label: "อัตราปิดการขาย", value: `${overallConv}%`,                                                     color: "#003366" },
    { label: "มูลค่าโอกาสการขาย", value: fmtM(first.valueNum),                                                  color: "#2D2D2D" },
    { label: "ปิดได้ช่วงนี้", value: fmtM(last.valueNum),                                                      color: "#059669" },
    { label: "กำลังตามอยู่", value: fmtM(stages.slice(selDealer ? 1 : 2, -1).reduce((s, x) => s + x.valueNum, 0)), color: "#f59e0b" },
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
          <p>{selDealer ? `มุมมองตัวแทน: ${selDealer.name.replace("Benjamin ", "")} (${selDealer.code}) · อิงจากใบเสนอราคาจริงของตัวแทน` : "ภาพรวมยอดขายและโอกาสการขายทุกตัวแทน"} · {timeRange.subtitle}</p>
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

      {/* ── สรุปแบบอ่านง่าย (บรรทัดเดียวเข้าใจทั้งภาพ) ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
        background: "linear-gradient(135deg,#003366,#0a4a86)", color: "#fff",
        borderRadius: 14, padding: "16px 20px", marginBottom: 16,
      }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "rgba(255,255,255,.65)", letterSpacing: "0.04em", marginBottom: 5 }}>
            สรุปช่วงนี้ {selDealer ? `· ${selDealer.name.replace("Benjamin ", "")}` : "· ทุกตัวแทน"}
          </div>
          <div style={{ fontSize: "0.98rem", fontWeight: 700, lineHeight: 1.5 }}>
            เสนอราคา <b style={{ fontWeight: 800 }}>{first.count} ใบ</b> ({fmtM(first.valueNum)}) — ปิดได้{" "}
            <b style={{ fontWeight: 800, color: "#7ee2b8" }}>{last.count} ใบ</b> ({fmtM(last.valueNum)}) คิดเป็น{" "}
            <b style={{ fontWeight: 800, color: "#7ee2b8" }}>{overallConv}%</b> ของที่เสนอไป
          </div>
          {worst && (
            <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,.82)", marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
              <AlertTriangle size={13} color="#ffd27a" />
              ลูกค้าหลุดมากสุดตอน “{worst.fromLabel} → {worst.label}” — ผ่านมาแค่ {worst.conv}% (หายไป {worst.lost} ราย)
            </div>
          )}
        </div>
        <div style={{ textAlign: "center", padding: "4px 20px", borderLeft: "1px solid rgba(255,255,255,.2)" }}>
          <div style={{ fontSize: "2.2rem", fontWeight: 800, lineHeight: 1 }}>{overallConv}%</div>
          <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,.7)", marginTop: 4 }}>อัตราปิดการขาย</div>
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
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 340px", gap: 16, alignItems: "start", marginBottom: 16 }}>

        {/* Funnel */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">ช่องทางการขาย</div>
              <div className="card-desc">{selDealer ? `ใบเสนอราคาของตัวแทน ${selDealer.code} จนถึงการปิดการขาย` : "จากลูกค้าเป้าหมายจนถึงการปิดการขาย · แถบยิ่งแคบ = ลูกค้ายิ่งหลุด"}</div>
            </div>
          </div>
          <div className="card-body" style={{ padding: "22px 24px 20px" }}>
            <FunnelChart stages={stages} worstIdx={worstIdx} />

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
          {/* สิ่งที่ HQ ควรโฟกัส — สรุป 3 ประเด็นสำคัญให้ตัดสินใจได้ทันที */}
          <div className="card">
            <div className="card-header">
              <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <Lightbulb size={15} color="#f59e0b" /> สิ่งที่ควรโฟกัส
              </div>
            </div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              {worst ? (
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ width: 28, height: 28, borderRadius: 8, background: "#fef2f2", color: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><AlertTriangle size={14} /></span>
                  <div>
                    <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "#2D2D2D" }}>จุดรั่วหลัก</div>
                    <div style={{ fontSize: "0.72rem", color: "#6b7280", marginTop: 1 }}>“{worst.fromLabel} → {worst.label}” ผ่านแค่ <b style={{ color: "#dc2626" }}>{worst.conv}%</b> (หลุด {worst.lost} ราย)</div>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: "0.72rem", color: "#9ca3af" }}>ยังไม่มีจุดรั่วชัดเจนในช่วงนี้</div>
              )}
              {topLost && (
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ width: 28, height: 28, borderRadius: 8, background: "#fff7ed", color: "#c2410c", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><TrendingDown size={14} /></span>
                  <div>
                    <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "#2D2D2D" }}>เหตุผลเสียดีลอันดับ 1</div>
                    <div style={{ fontSize: "0.72rem", color: "#6b7280", marginTop: 1 }}>{topLost.reason} <b style={{ color: "#c2410c" }}>({topLost.count} ราย)</b></div>
                  </div>
                </div>
              )}
              {topProduct && (
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ width: 28, height: 28, borderRadius: 8, background: "#eef3f8", color: "#003366", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Layers size={14} /></span>
                  <div>
                    <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "#2D2D2D" }}>แม่แบบที่ทำเงินสูงสุด</div>
                    <div style={{ fontSize: "0.72rem", color: "#6b7280", marginTop: 1 }}>{topProduct.product} <b style={{ color: "#003366" }}>({fmtM(topProduct.valueNum)})</b></div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* เหตุผลเสียโอกาส มีเฉพาะข้อมูลรวมเครือ — ไม่แสดงเลขหลอกตอนดูรายตัวแทน */}
          {!selDealer && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">เหตุผลที่เสียโอกาสการขาย</div>
              </div>
              <div className="card-body"><LostReasons items={lostReasons} /></div>
            </div>
          )}
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

      {/* ── แยกตามแม่แบบ (เต็มความกว้าง) — ใช้พื้นที่ล่างให้เต็ม + แถบมีที่ให้อ่านง่าย ── */}
      <div className="card" style={{ marginBottom: 0 }}>
        <div className="card-header">
          <div>
            <div className="card-title">แยกตามแม่แบบ / บริการ</div>
            <div className="card-desc">มูลค่าโอกาสการขายในช่วงนี้ กระจุกที่แม่แบบไหน</div>
          </div>
        </div>
        <div className="card-body"><ProductBreakdown items={products} /></div>
      </div>
    </div>
  );
}
