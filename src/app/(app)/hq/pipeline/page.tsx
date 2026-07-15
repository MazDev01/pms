"use client";

// ─── HQ · ภาพรวมยอดขาย (Executive Dashboard) ───────────────────────────────────
// หน้าอ่านอย่างเดียวสำหรับผู้บริหาร HQ — ไม่มีการสร้าง/แก้/ลบข้อมูล (Action = ดู/วิเคราะห์/ส่งออก)
// กราฟใช้แท่ง/เส้นเท่านั้น (ไม่มีกรวย/พีระมิด/เกจ/วงกลม) · ทุกตัวเลขมาจากข้อมูลจริงในระบบ
// ไม่รองรับ = ไม่แสดง (ไม่มีสัญญา ไม่มีคาดการณ์ยอดขาย — ระบบไม่มีข้อมูลสองอย่างนี้)
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Download, FileText, Percent, Store, Target, Trophy, TrendingUp,
} from "lucide-react";
import { MultiLineChart } from "@/components/ui/Charts";
import { DealerChart } from "@/components/hq/DealerChart";
import {
  dealerLeaderboard, mainTemplateOf, DEFAULT_HQ_TARGETS, HQ_TARGETS_KEY,
  type DealerRow, type HQTargets,
} from "@/lib/mock";
import { usePersistentState } from "@/lib/usePersistentState";
import { useFilters } from "@/context/FilterContext";
import { FilterBar, SelectFilter } from "@/components/filters/FilterBar";
import { useNetworkQuotations, useNetworkLeads } from "@/lib/useNetworkData";
import { fmtBaht } from "@/lib/format";

const PRIMARY = "#003366";
const RAMP = ["#003366", "#0891b2", "#059669", "#d97706", "#7c3aed", "#dc2626"];
const TH_ABBR = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const TH_MONTH: Record<string, number> = Object.fromEntries(TH_ABBR.map((m, i) => [m, i]));
const parseThaiDate = (s: string): Date | null => {
  const mt = /^(\d{1,2})\s+(\S+)\s+(\d{4})/.exec((s || "").trim());
  if (!mt || !(mt[2] in TH_MONTH)) return null;
  const y = +mt[3] > 2500 ? +mt[3] - 543 : +mt[3];
  return new Date(y, TH_MONTH[mt[2]], +mt[1]);
};
const regionDisplay = (r: string) => r === "อีสาน" ? "ภาคตะวันออกเฉียงเหนือ" : `ภาค${r}`;

// สถานะใบเสนอราคา — ป้าย/สีชุดเดียวกับทั้งระบบ
const QUOTE_STATES = [
  { k: "draft",          label: "ร่าง",     color: "#9ca3af" },
  { k: "sent_to_client", label: "ส่งแล้ว",   color: "#003366" },
  { k: "viewed",         label: "เปิดอ่าน",  color: "#7c3aed" },
  { k: "won",            label: "ตอบรับ",   color: "#059669" },
  { k: "lost",           label: "ปฏิเสธ",   color: "#dc2626" },
  { k: "expired",        label: "หมดอายุ",  color: "#d97706" },
];

export default function SalesOverviewPage() {
  const router = useRouter();
  const { timeRange, inRange } = useFilters();
  const [allDealers] = usePersistentState<DealerRow[]>("hq_dealers_v2", dealerLeaderboard);
  const [targets] = usePersistentState<HQTargets>(HQ_TARGETS_KEY, DEFAULT_HQ_TARGETS);
  const [dealerSel, setDealerSel] = useState<string>("all");
  const selDealer = dealerSel === "all" ? null : allDealers.find(d => d.code === dealerSel) ?? null;

  const netQuotes = useNetworkQuotations();
  const netLeads = useNetworkLeads();

  // ── ขอบเขตข้อมูลของทั้งหน้า = ตัวแทนที่เลือก (ถ้ามี) + ช่วงเวลาจากตัวกรอง ──
  const scoped = useMemo(
    () => netQuotes.filter(q => (!selDealer || q.dealerCode === selDealer.code) && inRange(q.createdAt)),
    [netQuotes, selDealer, inRange],
  );

  // ── KPI ──
  const kpi = useMemo(() => {
    const won = scoped.filter(q => q.status === "won");
    const lost = scoped.filter(q => q.status === "lost");
    const closed = won.length + lost.length;
    const activeCodes = new Set(scoped.map(q => q.dealerCode));
    return {
      wonVal: won.reduce((s, q) => s + q.valueNum, 0),
      wonCount: won.length,
      quotes: scoped.length,
      quoteVal: scoped.reduce((s, q) => s + q.valueNum, 0),
      conv: closed ? Math.round((won.length / closed) * 100) : 0,
      activeDealers: selDealer ? (activeCodes.size ? 1 : 0) : activeCodes.size,
    };
  }, [scoped, selDealer]);

  // ── ความสำเร็จตามเป้า = ยอดสะสมทั้งปี เทียบเป้าทั้งปี (ไม่เฉลี่ยตามช่วงเวลาที่กรอง) ──
  // ใช้ตัวเลข "ทางการ" ของตัวแทน (revenueActual/revenueTarget) ให้ตรงกับหน้าตัวแทนและอันดับ
  const goal = useMemo(() => {
    const actual = selDealer ? selDealer.revenueActual : allDealers.reduce((s, d) => s + d.revenueActual, 0);
    const target = selDealer ? selDealer.revenueTarget : targets.annualTarget;
    return { actual, target, pct: target > 0 ? Math.round((actual / target) * 100) : 0 };
  }, [selDealer, allDealers, targets.annualTarget]);

  // ── สถานะใบเสนอราคา (แถบแนวนอน — จำนวน + มูลค่า) ──
  const statusRows = useMemo(() => {
    const rows = QUOTE_STATES.map(s => {
      const arr = scoped.filter(q => q.status === s.k);
      return { ...s, count: arr.length, value: arr.reduce((a, q) => a + q.valueNum, 0) };
    });
    const max = Math.max(...rows.map(r => r.value), 1);
    return rows.map(r => ({ ...r, pct: Math.round((r.value / max) * 100) }));
  }, [scoped]);

  // ── มูลค่าใบเสนอราคา เทียบ ยอดปิดการขาย รายเดือน (ล้านบาท) ──
  const monthly = useMemo(() => {
    const qM = Array(12).fill(0), wM = Array(12).fill(0);
    scoped.forEach(q => {
      const d = parseThaiDate(q.createdAt); if (!d) return;
      qM[d.getMonth()] += q.valueNum;
      if (q.status === "won") wM[d.getMonth()] += q.valueNum;
    });
    const a = timeRange.start.getMonth(), b = timeRange.end.getMonth();
    const toM = (arr: number[]) => arr.slice(a, b + 1).map(v => Math.round(v / 1e6 * 10) / 10);
    return { months: TH_ABBR.slice(a, b + 1), quote: toM(qM), won: toM(wM) };
  }, [scoped, timeRange]);

  // ── สถิติรายตัวแทนในช่วง (ใบเสนอราคา/ปิดได้) — ใช้ทั้งกราฟอันดับและตารางล่าง ──
  const dealerStats = useMemo(() => {
    const m = new Map<string, { quotes: number; won: number; wonVal: number }>();
    netQuotes.filter(q => inRange(q.createdAt)).forEach(q => {
      const r = m.get(q.dealerCode) ?? { quotes: 0, won: 0, wonVal: 0 };
      r.quotes += 1;
      if (q.status === "won") { r.won += 1; r.wonVal += q.valueNum; }
      m.set(q.dealerCode, r);
    });
    return m;
  }, [netQuotes, inRange]);

  const ranked = useMemo(() => allDealers.map(d => {
    const st = dealerStats.get(d.code) ?? { quotes: 0, won: 0, wonVal: 0 };
    return { ...d, ...st, tpct: d.revenueTarget > 0 ? Math.round((d.revenueActual / d.revenueTarget) * 100) : 0 };
  }).sort((a, b) => b.revenueActual - a.revenueActual), [allDealers, dealerStats]);

  // ── เทียบรายภูมิภาค (ยอดขายสะสม + จำนวนใบเสนอราคาในช่วง) ──
  const regions = useMemo(() => {
    const m = new Map<string, { revenue: number; quotes: number; dealers: number }>();
    ranked.forEach(d => {
      const r = m.get(d.region) ?? { revenue: 0, quotes: 0, dealers: 0 };
      r.revenue += d.revenueActual; r.quotes += d.quotes; r.dealers += 1;
      m.set(d.region, r);
    });
    const arr = [...m.entries()].map(([region, v]) => ({ region, ...v })).sort((a, b) => b.revenue - a.revenue);
    const maxR = Math.max(...arr.map(a => a.revenue), 1);
    const maxQ = Math.max(...arr.map(a => a.quotes), 1);
    return arr.map(a => ({ ...a, rPct: Math.round(a.revenue / maxR * 100), qPct: Math.round(a.quotes / maxQ * 100) }));
  }, [ranked]);

  // ── เหตุผลที่เสียโอกาสการขาย — จากลีดที่ถูกยกเลิกและ "บันทึกเหตุผลไว้จริง" เท่านั้น ──
  const lostReasons = useMemo(() => {
    const m = new Map<string, number>();
    netLeads
      .filter(l => l.status === "CANCELLED" && l.lostReason && (!selDealer || l.dealerCode === selDealer.code))
      .forEach(l => m.set(l.lostReason!, (m.get(l.lostReason!) ?? 0) + 1));
    const arr = [...m.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count);
    const total = arr.reduce((s, r) => s + r.count, 0) || 1;
    const max = Math.max(...arr.map(a => a.count), 1);
    return arr.map(a => ({ ...a, pct: Math.round(a.count / max * 100), share: Math.round(a.count / total * 100) }));
  }, [netLeads, selDealer]);

  // ── แยกตามแม่แบบ / บริการ (มูลค่าใบเสนอราคาในช่วง) ──
  const templates = useMemo(() => {
    const m = new Map<string, { value: number; count: number }>();
    scoped.forEach(q => {
      const key = mainTemplateOf(q.productLine);
      const r = m.get(key) ?? { value: 0, count: 0 };
      r.value += q.valueNum; r.count += 1;
      m.set(key, r);
    });
    const arr = [...m.entries()].map(([product, v]) => ({ product, ...v })).sort((a, b) => b.value - a.value);
    const total = arr.reduce((s, p) => s + p.value, 0) || 1;
    const max = Math.max(...arr.map(a => a.value), 1);
    return arr.map((p, i) => ({ ...p, pct: Math.round(p.value / max * 100), share: Math.round(p.value / total * 100), color: RAMP[i % RAMP.length] }));
  }, [scoped]);

  // ── ส่งออกรายงาน (CSV เปิดใน Excel ได้) ──
  const [toast, setToast] = useState<string | null>(null);
  function doExport() {
    const rows: string[] = [];
    rows.push(selDealer ? `ภาพรวมยอดขาย — ตัวแทน ${selDealer.code}` : "ภาพรวมยอดขาย — ทั้งเครือ");
    rows.push(timeRange.subtitle);
    rows.push("");
    rows.push("สถานะใบเสนอราคา");
    rows.push(["สถานะ", "จำนวน (ใบ)", "มูลค่า (บาท)"].join(","));
    statusRows.forEach(r => rows.push([r.label, r.count, Math.round(r.value)].join(",")));
    rows.push("");
    rows.push("ผลงานตัวแทนจำหน่าย");
    rows.push(["รหัส", "ตัวแทน", "ภูมิภาค", "ใบเสนอราคา", "ปิดได้", "อัตราปิด (%)", "ยอดขายสะสม (บาท)", "% เป้า"].join(","));
    ranked.forEach(d => rows.push([d.code, d.name, regionDisplay(d.region), d.quotes, d.won, d.winRate, d.revenueActual, d.tpct].join(",")));
    if (lostReasons.length) {
      rows.push("");
      rows.push("เหตุผลที่เสียโอกาสการขาย");
      rows.push(["เหตุผล", "จำนวน (ราย)", "สัดส่วน (%)"].join(","));
      lostReasons.forEach(r => rows.push([r.reason, r.count, r.share].join(",")));
    }
    rows.push("");
    rows.push("แยกตามแม่แบบ / บริการ");
    rows.push(["แม่แบบ", "จำนวนใบเสนอราคา", "มูลค่า (บาท)", "สัดส่วน (%)"].join(","));
    templates.forEach(p => rows.push([p.product, p.count, Math.round(p.value), p.share].join(",")));

    const blob = new Blob(["﻿" + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `hq-sales-overview-${timeRange.preset}.csv`; a.click();
    URL.revokeObjectURL(url);
    setToast("ส่งออกรายงาน CSV แล้ว");
    setTimeout(() => setToast(null), 2600);
  }

  // ── การ์ด KPI (ไม่มีวงแหวน/เกจ — ความคืบหน้าใช้แถบ) ──
  const kSub: React.CSSProperties = { fontSize: "0.72rem", color: "var(--muted-foreground)" };
  const kNum: React.CSSProperties = { fontSize: "1.15rem", fontWeight: 800, color: "#1F2937", lineHeight: 1.15, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.015em", whiteSpace: "nowrap" };
  const kpiCards = [
    { label: "ยอดขายที่ปิดได้", value: fmtBaht(kpi.wonVal), sub: `${kpi.wonCount} ดีล · ในช่วงที่เลือก`, Icon: Trophy, color: "#059669", bg: "#E6F6EF" },
    { label: "ใบเสนอราคา", value: `${kpi.quotes}`, sub: `${fmtBaht(kpi.quoteVal)} · ในช่วงที่เลือก`, Icon: FileText, color: "#0891B2", bg: "#E6F4F9" },
    { label: "อัตราปิดการขาย", value: `${kpi.conv}%`, sub: "ตอบรับ ÷ (ตอบรับ + ปฏิเสธ)", Icon: Percent, color: "#7C3AED", bg: "#F0EBFB" },
    { label: "เป้าหมายทั้งปี", value: fmtBaht(goal.target), sub: selDealer ? `ตัวแทน ${selDealer.code}` : "ทั้งเครือ", Icon: Target, color: "#2563EB", bg: "#E8F0FE" },
    { label: "ตัวแทนที่มีผลงาน", value: `${kpi.activeDealers}`, sub: `จากตัวแทนทั้งหมด ${allDealers.length} ราย`, Icon: Store, color: "#D97706", bg: "#FEF0E6" },
  ];

  return (
    <div className="erp">
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 9999,
          background: "#2D2D2D", color: "#fff", padding: "11px 18px", borderRadius: 12,
          fontSize: "0.8rem", fontWeight: 600, boxShadow: "var(--shadow-lg)",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <Download size={14} /> {toast}
        </div>
      )}

      {/* ── หัวหน้า ── */}
      <div className="page-head">
        <div>
          <p style={{ margin: 0 }}>
            {selDealer ? `มุมมองตัวแทน: ${selDealer.name} (${selDealer.code})` : "ภาพรวมยอดขายทุกตัวแทน · ทุกตัวเลขคำนวณจากใบเสนอราคาจริงในช่วงที่เลือก"} · {timeRange.subtitle}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <SelectFilter caption="ทุกตัวแทน (ทั้งเครือ)" value={dealerSel}
            options={allDealers.map(d => ({ value: d.code, label: `${d.code} – ${d.name}` }))}
            onChange={setDealerSel} />
          <FilterBar dims={[]} />
          <button onClick={doExport} className="btn btn-secondary btn-md">
            <Download size={14} /> ส่งออกรายงาน
          </button>
        </div>
      </div>

      {/* ── KPI ── */}
      <div className="hq-kpi5" style={{ marginBottom: "1.25rem" }}>
        {kpiCards.map(k => (
          <div key={k.label} className="card" style={{ marginBottom: 0, padding: "18px 18px 15px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ ...kSub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k.label}</div>
              <div style={{ ...kNum, marginTop: 6 }}>{k.value}</div>
              <div style={{ ...kSub, marginTop: 2 }}>{k.sub}</div>
            </div>
            <span style={{ width: 42, height: 42, borderRadius: 12, background: k.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <k.Icon size={20} color={k.color} strokeWidth={2.1} />
            </span>
          </div>
        ))}
      </div>

      {/* ── ความสำเร็จตามเป้า (แถบ — สะสมทั้งปี ไม่ขึ้นกับตัวกรองเวลา) ── */}
      <div className="card" style={{ marginBottom: "1.25rem" }}>
        <div className="card-header">
          <div className="card-title">ความสำเร็จตามเป้าหมาย {selDealer ? `· ${selDealer.name}` : "· ทั้งเครือ"}</div>
          <span style={{ fontSize: "0.62rem", color: "var(--muted-foreground)" }}>ยอดสะสมทั้งปี เทียบเป้าทั้งปี — ไม่ขึ้นกับตัวกรองช่วงเวลา</span>
        </div>
        <div className="card-body" style={{ paddingTop: 8 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: "1.5rem", fontWeight: 800, color: PRIMARY, fontVariantNumeric: "tabular-nums" }}>{goal.pct}%</span>
            <span style={{ fontSize: "0.78rem", color: "#374151", fontWeight: 600 }}>
              {fmtBaht(goal.actual)} <span style={{ color: "var(--muted-foreground)", fontWeight: 400 }}>จากเป้า {fmtBaht(goal.target)}</span>
            </span>
          </div>
          <div style={{ height: 10, background: "var(--muted)", borderRadius: 999, overflow: "hidden" }}>
            <div className="bar-grow" style={{ height: "100%", width: `${Math.min(100, goal.pct)}%`, background: goal.pct >= 100 ? "#059669" : PRIMARY, borderRadius: 999 }} />
          </div>
        </div>
      </div>

      {/* ── แถว 1: มูลค่าใบเสนอราคา เทียบ ยอดปิดการขาย · สถานะใบเสนอราคา ── */}
      <div className="hq-row2a" style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "1.25rem", alignItems: "stretch", marginBottom: "1.25rem" }}>
        <div className="card" style={{ marginBottom: 0, display: "flex", flexDirection: "column" }}>
          <div className="card-header">
            <div className="card-title">มูลค่าใบเสนอราคา เทียบ ยอดปิดการขาย (รายเดือน)</div>
            <span style={{ fontSize: "0.62rem", color: "var(--muted-foreground)" }}>หน่วย: ล้านบาท</span>
          </div>
          <div className="card-body" style={{ paddingTop: 4, flex: 1 }}>
            <MultiLineChart months={monthly.months} vw={820} height={280} fmt={v => `${v.toFixed(1)}M`}
              series={[
                { name: "มูลค่าใบเสนอราคา", color: "#0891b2", data: monthly.quote },
                { name: "ยอดปิดการขาย", color: "#003366", data: monthly.won },
              ]} />
          </div>
        </div>

        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <div className="card-title">สถานะใบเสนอราคา</div>
            <span style={{ fontSize: "0.62rem", color: "var(--muted-foreground)" }}>ความยาวแถบ = มูลค่า</span>
          </div>
          <div className="card-body" style={{ paddingTop: 6, display: "flex", flexDirection: "column", gap: 13 }}>
            {statusRows.map(s => (
              <div key={s.k}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: "0.72rem", marginBottom: 4 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#374151", fontWeight: 600 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: s.color, flexShrink: 0 }} />{s.label}
                  </span>
                  <span style={{ display: "flex", gap: 8, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                    <span style={{ color: "var(--muted-foreground)", fontWeight: 600 }}>{s.count} ใบ</span>
                    <span style={{ fontWeight: 800, color: "#1F2937" }}>{fmtBaht(s.value)}</span>
                  </span>
                </div>
                <div style={{ height: 7, background: "var(--muted)", borderRadius: 999, overflow: "hidden" }}>
                  <div className="bar-grow" style={{ height: "100%", width: `${s.pct}%`, background: s.color, borderRadius: 999 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── แถว 2: อันดับตัวแทน (เทียบเป้า) · เทียบรายภูมิภาค ── */}
      <div className="hq-dealer-charts">
        <DealerChart
          title="อันดับตัวแทนจำหน่าย (ยอดขายสะสม เทียบ เป้าหมาย)"
          hint="คลิกเพื่อดูรายตัวแทน"
          rows={ranked.map(d => ({ code: d.code, name: d.name, value: d.revenueActual, compare: d.revenueTarget, note: `${d.tpct}% ของเป้า` }))}
          fmt={fmtBaht}
          compareLabel="เป้าหมายทั้งปี"
        />
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <div className="card-title">เทียบรายภูมิภาค</div>
            <span style={{ fontSize: "0.62rem", color: "var(--muted-foreground)" }}>ยอดขายสะสม · ใบเสนอราคาในช่วง</span>
          </div>
          <div className="card-body" style={{ paddingTop: 6, display: "flex", flexDirection: "column", gap: 14 }}>
            {regions.map((r, i) => (
              <div key={r.region}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: "0.72rem", marginBottom: 4 }}>
                  <span style={{ color: "#374151", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {regionDisplay(r.region)} <span style={{ color: "var(--muted-foreground)", fontWeight: 400 }}>({r.dealers} ตัวแทน)</span>
                  </span>
                  <span style={{ fontWeight: 800, color: "#1F2937", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{fmtBaht(r.revenue)}</span>
                </div>
                <div style={{ height: 7, background: "var(--muted)", borderRadius: 999, overflow: "hidden", marginBottom: 3 }}>
                  <div className="bar-grow" style={{ height: "100%", width: `${r.rPct}%`, background: RAMP[i % RAMP.length], borderRadius: 999 }} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ flex: 1, height: 4, background: "var(--muted)", borderRadius: 999, overflow: "hidden" }}>
                    <div className="bar-grow" style={{ height: "100%", width: `${r.qPct}%`, background: "#C0C0C0", borderRadius: 999 }} />
                  </div>
                  <span style={{ fontSize: "0.62rem", color: "var(--muted-foreground)", fontWeight: 700, minWidth: 52, textAlign: "right" }}>{r.quotes} ใบเสนอราคา</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── แถว 3: เหตุผลที่เสียโอกาส · แยกตามแม่แบบ ── */}
      <div className="hq-row2b" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem", alignItems: "stretch", marginBottom: "1.25rem" }}>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <div className="card-title">เหตุผลที่เสียโอกาสการขาย</div>
            <span style={{ fontSize: "0.62rem", color: "var(--muted-foreground)" }}>จากลีดที่บันทึกเหตุผลไว้</span>
          </div>
          <div className="card-body" style={{ paddingTop: 6, display: "flex", flexDirection: "column", gap: 13 }}>
            {!lostReasons.length ? (
              <div style={{ fontSize: "0.74rem", color: "var(--muted-foreground)" }}>—</div>
            ) : lostReasons.map(r => (
              <div key={r.reason}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: "0.72rem", marginBottom: 4 }}>
                  <span style={{ color: "#374151", fontWeight: 600 }}>{r.reason}</span>
                  <span style={{ fontWeight: 700, color: "var(--muted-foreground)", fontVariantNumeric: "tabular-nums" }}>{r.count} ราย ({r.share}%)</span>
                </div>
                <div style={{ height: 7, background: "var(--muted)", borderRadius: 999, overflow: "hidden" }}>
                  <div className="bar-grow" style={{ height: "100%", width: `${r.pct}%`, background: "#dc2626", borderRadius: 999 }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <div className="card-title">แยกตามแม่แบบ / บริการ</div>
            <span style={{ fontSize: "0.62rem", color: "var(--muted-foreground)" }}>มูลค่าใบเสนอราคาในช่วง</span>
          </div>
          <div className="card-body" style={{ paddingTop: 6, display: "flex", flexDirection: "column", gap: 13 }}>
            {!templates.length ? (
              <div style={{ fontSize: "0.74rem", color: "var(--muted-foreground)" }}>—</div>
            ) : templates.map(p => (
              <div key={p.product}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: "0.72rem", marginBottom: 4 }}>
                  <span style={{ color: "#374151", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.product}</span>
                  <span style={{ display: "flex", gap: 8, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                    <span style={{ color: "var(--muted-foreground)", fontWeight: 600 }}>{p.count} ใบ</span>
                    <span style={{ fontWeight: 800, color: "#1F2937" }}>{fmtBaht(p.value)}</span>
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ flex: 1, height: 7, background: "var(--muted)", borderRadius: 999, overflow: "hidden" }}>
                    <div className="bar-grow" style={{ height: "100%", width: `${p.pct}%`, background: p.color, borderRadius: 999 }} />
                  </div>
                  <span style={{ fontSize: "0.62rem", color: "var(--muted-foreground)", fontWeight: 700, minWidth: 28, textAlign: "right" }}>{p.share}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── ตารางผลงานตัวแทนจำหน่าย ── */}
      <div className="card" style={{ marginBottom: 0 }}>
        <div className="card-header">
          <div className="card-title">ผลงานตัวแทนจำหน่าย</div>
          <span style={{ fontSize: "0.62rem", color: "var(--muted-foreground)" }}>ใบเสนอราคา/ปิดได้ = ในช่วงที่เลือก · ยอดขายสะสม/% เป้า = ทั้งปี</span>
        </div>
        <div className="table-wrap">
          <table>
            <colgroup>
              <col style={{ width: "6%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "26%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "9%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>อันดับ</th>
                <th>รหัส</th>
                <th>ตัวแทนจำหน่าย</th>
                <th>ภูมิภาค</th>
                <th style={{ textAlign: "right" }}>ใบเสนอราคา</th>
                <th style={{ textAlign: "right" }}>ปิดได้</th>
                <th style={{ textAlign: "right" }}>อัตราปิด</th>
                <th style={{ textAlign: "right" }}>ยอดขายสะสม</th>
                <th style={{ textAlign: "right" }}>% เป้า</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((d, i) => (
                <tr key={d.code} className="clickable" onClick={() => router.push(`/hq/dealers/${d.code}`)} style={{ cursor: "pointer" }}>
                  <td style={{ fontWeight: 700, color: "var(--muted-foreground)" }}>{i + 1}</td>
                  <td style={{ fontFamily: "monospace", fontWeight: 700, color: PRIMARY }}>{d.code}</td>
                  <td style={{ fontWeight: 600, color: "#1F2937" }}>
                    {d.name}
                    {d.status === "inactive" && <span style={{ marginLeft: 6, fontSize: "0.62rem", fontWeight: 700, color: "var(--muted-foreground)" }}>(ปิดใช้งาน)</span>}
                  </td>
                  <td style={{ color: "#374151" }}>{regionDisplay(d.region)}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{d.quotes}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{d.won}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700, color: d.winRate >= targets.winRateTarget ? "#059669" : "#374151" }}>{d.winRate}%</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 800, color: "#1F2937" }}>{fmtBaht(d.revenueActual)}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700, color: d.tpct >= 100 ? "#059669" : PRIMARY }}>{d.tpct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
