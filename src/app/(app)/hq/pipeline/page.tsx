"use client";

// ─── HQ · ภาพรวมยอดขายทั้งเครือ (Sales Analytics) ──────────────────────────────
// ศูนย์บัญชาการยอดขายของสำนักงานใหญ่ — อ่านอย่างเดียว ไม่มีสร้าง/แก้/ลบ (Action = ดู · วิเคราะห์ · ส่งออก)
// กราฟใช้ได้เฉพาะ แท่งแนวนอน / แท่งคู่ / แท่งซ้อน / เส้น (ไม่มีกรวย/เกจ/วงกลม)
//
// ── สิ่งที่ตัดออกจากสเปก เพราะข้อมูลจริงไม่รองรับ (อย่าใส่กลับโดยไม่มีข้อมูลก่อน) ──
// • Forecast / คาดการณ์รายได้ — ไม่มีลีดใบไหนกรอก expectedClose และไม่มีฟิลด์ % ความน่าจะเป็น
//   จึงถ่วงน้ำหนัก pipeline ไม่ได้ · บอสสั่งตัดออก
// • ย้อนหลังฟิกซ์ 12 เดือน — ตัวแทน 9/10 รายมีข้อมูลแค่ 3 เดือน · กราฟตัดตามตัวกรองเวลา "เท่าที่มีข้อมูล"
// • Last Updated รายตัวแทน — DealerRow ไม่มีฟิลด์นี้ · ใช้ "ใบเสนอราคาล่าสุด" ที่หาได้จริงแทน (ชื่อคอลัมน์ตรงกับสิ่งที่มันเป็น)
// • Refresh — ระบบไม่มี backend ให้ refresh (ข้อมูลสดจาก SalesContext อยู่แล้ว)
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText, Percent, Target, Trophy, Eye, X, Building2, Users, Coins, CalendarDays, FolderOpen,
} from "lucide-react";
import { MultiLineChart, StackedBarChart, Donut } from "@/components/ui/Charts";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  dealerLeaderboard, HQ_DEALERS_KEY, DEFAULT_HQ_TARGETS, HQ_TARGETS_KEY,
  loadDealerFiles, DEALER_FILES_EVENT, fmtISOToThai,
  type DealerRow, type HQTargets, type DealerFile,
} from "@/lib/mock";
import { usePersistentState } from "@/lib/usePersistentState";
import { useFilters } from "@/context/FilterContext";
import { useSales } from "@/context/SalesContext";
import { FilterBar } from "@/components/filters/FilterBar";
import { useNetworkQuotations, useNetworkLeads, useNetworkCustomers } from "@/lib/useNetworkData";
import { regionDisplay } from "@/lib/hqQuotations";
import { fmtBaht } from "@/lib/format";
import { useEffect } from "react";

const PRIMARY = "#003366";
const STEEL = "#2D2D2D";
const MUTED = "var(--muted-foreground)";
const RAMP = ["#003366", "#0891b2", "#059669", "#d97706", "#7c3aed", "#dc2626"];
// โทนแดง-ส้มของโดนัท "เหตุผลที่เสียโอกาส" — ชุดเดียวกับหน้า /hq/leads ให้อ่านเหมือนกันทั้งระบบ
const LOST_RAMP = ["#dc2626", "#ea580c", "#d97706", "#b45309", "#9f1239", "#7c2d12"];
const TH_ABBR = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const TH_MONTH: Record<string, number> = Object.fromEntries(TH_ABBR.map((m, i) => [m, i]));
const parseThaiDate = (s: string): Date | null => {
  const mt = /^(\d{1,2})\s+(\S+)\s+(\d{4})/.exec((s || "").trim());
  if (!mt || !(mt[2] in TH_MONTH)) return null;
  const y = +mt[3] > 2500 ? +mt[3] - 543 : +mt[3];
  return new Date(y, TH_MONTH[mt[2]], +mt[1]);
};
const QUOTED_UP = ["QUOTED", "FOLLOWUP", "NEGO", "PAID"];
const ALL = "ALL";

// ── แท่งแนวนอนคู่ — ใช้ซ้ำใน Section 1 / 2 / 3 (แท่งหลัก + แท่งเทียบ) ──
type HRow = { key: string; label: string; a: number; b: number; note?: string; onClick?: () => void };
function HBars({ rows, aLabel, bLabel, aColor = PRIMARY, bColor = "#C0C0C0", fmt }: {
  rows: HRow[]; aLabel: string; bLabel: string; aColor?: string; bColor?: string; fmt: (v: number) => string;
}) {
  const max = Math.max(...rows.flatMap(r => [r.a, r.b]), 1);
  return (
    <div className="card-body" style={{ paddingTop: 4 }}>
      {/* คำอธิบายสี — ต้องมี ไม่งั้นแท่งคู่อ่านไม่ออกว่าอันไหนคืออะไร */}
      <div style={{ display: "flex", gap: 14, marginBottom: 12 }}>
        {[[aLabel, aColor], [bLabel, bColor]].map(([l, c]) => (
          <span key={l} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.66rem", fontWeight: 700, color: MUTED }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: c, flexShrink: 0 }} /> {l}
          </span>
        ))}
      </div>
      {!rows.length ? (
        <EmptyState icon={<Coins size={26} />} title="ไม่พบข้อมูลในช่วงที่เลือก" description="ลองปรับตัวกรอง" compact />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {rows.map(r => (
            <div key={r.key} onClick={r.onClick} style={{ cursor: r.onClick ? "pointer" : "default" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: "0.72rem", marginBottom: 4 }}>
                <span style={{ color: "#374151", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</span>
                <span style={{ flexShrink: 0, fontWeight: 700, color: "#1F2937", fontVariantNumeric: "tabular-nums" }}>
                  {fmt(r.a)} <span style={{ color: MUTED, fontWeight: 400 }}>/ {fmt(r.b)}</span>
                  {r.note && <span style={{ color: MUTED, fontWeight: 400 }}> · {r.note}</span>}
                </span>
              </div>
              <div style={{ height: 8, background: "var(--muted)", borderRadius: 999, overflow: "hidden", marginBottom: 3 }}>
                <div className="bar-grow" style={{ height: "100%", width: `${Math.round(r.a / max * 100)}%`, background: aColor, borderRadius: 999 }} />
              </div>
              <div style={{ height: 5, background: "var(--muted)", borderRadius: 999, overflow: "hidden" }}>
                <div className="bar-grow" style={{ height: "100%", width: `${Math.round(r.b / max * 100)}%`, background: bColor, borderRadius: 999 }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SalesAnalyticsPage() {
  const router = useRouter();
  const { timeRange, inRange } = useFilters();
  const [allDealers] = usePersistentState<DealerRow[]>(HQ_DEALERS_KEY, dealerLeaderboard);
  const [targets] = usePersistentState<HQTargets>(HQ_TARGETS_KEY, DEFAULT_HQ_TARGETS);

  const netQuotes = useNetworkQuotations();
  const netLeads = useNetworkLeads();
  const netCustomers = useNetworkCustomers();
  const { appointments } = useSales();

  // ไฟล์แนบ — ใช้เฉพาะใน Drawer (ผูกกับลีดด้วย recordId = numId)
  const [dealerFiles, setDealerFiles] = useState<DealerFile[]>([]);
  useEffect(() => {
    const read = () => setDealerFiles(loadDealerFiles());
    read();
    window.addEventListener(DEALER_FILES_EVENT, read);
    return () => window.removeEventListener(DEALER_FILES_EVENT, read);
  }, []);

  // ── Smart Filter — ทุกตัวเลือกสร้างจากข้อมูลจริง ไม่ฮาร์ดโค้ด ──
  const [q, setQ] = useState("");
  const [dealerSel, setDealerSel] = useState(ALL);
  const [regionSel, setRegionSel] = useState(ALL);
  const [provSel, setProvSel] = useState(ALL);
  const [btSel, setBtSel] = useState(ALL);
  const [salesSel, setSalesSel] = useState(ALL);
  const [view, setView] = useState<"dealer" | "region" | "province" | "month">("dealer");

  const DEALER_META = useMemo(() => new Map(allDealers.map(d => [d.code, d])), [allDealers]);
  const SALES_BANDS = useMemo(() => [
    { v: "lt5", l: "ต่ำกว่า ฿5M", hit: (n: number) => n < 5e6 },
    { v: "5to8", l: "฿5M – ฿8M", hit: (n: number) => n >= 5e6 && n < 8e6 },
    { v: "gte8", l: "฿8M ขึ้นไป", hit: (n: number) => n >= 8e6 },
  ], []);

  // ตัวแทนที่ผ่านตัวกรอง = ขอบเขตของทั้งหน้า (ทุกกราฟ/ตารางอิงชุดนี้ชุดเดียว)
  const dealers = useMemo(() => {
    const s = q.trim().toLowerCase();
    return allDealers.filter(d =>
      (dealerSel === ALL || d.code === dealerSel) &&
      (regionSel === ALL || d.region === regionSel) &&
      (provSel === ALL || d.province === provSel) &&
      (salesSel === ALL || (SALES_BANDS.find(b => b.v === salesSel)?.hit(d.revenueActual) ?? true)) &&
      (!s || (d.code + d.name + d.province + d.region).toLowerCase().includes(s)),
    );
  }, [allDealers, q, dealerSel, regionSel, provSel, salesSel, SALES_BANDS]);
  const codes = useMemo(() => new Set(dealers.map(d => d.code)), [dealers]);

  const quotes = useMemo(
    () => netQuotes.filter(x => codes.has(x.dealerCode) && inRange(x.createdAt) && (btSel === ALL || x.productLine === btSel)),
    [netQuotes, codes, inRange, btSel],
  );
  const leads = useMemo(
    () => netLeads.filter(l => codes.has(l.dealerCode ?? "") && (btSel === ALL || l.product === btSel)),
    [netLeads, codes, btSel],
  );

  const regionOpts = useMemo(() => [...new Set(allDealers.map(d => d.region))].sort(), [allDealers]);
  const provOpts = useMemo(() => [...new Set(allDealers.map(d => d.province))].sort(), [allDealers]);
  const btOpts = useMemo(() => [...new Set(netQuotes.map(x => x.productLine).filter(Boolean))].sort(), [netQuotes]);

  // ── สถิติรายตัวแทน — แหล่งเดียวของทุกกราฟ/ตาราง (คำนวณครั้งเดียว) ──
  const perf = useMemo(() => dealers.map(d => {
    const dq = quotes.filter(x => x.dealerCode === d.code);
    const dl = leads.filter(l => l.dealerCode === d.code);
    const won = dq.filter(x => x.status === "won");
    const lost = dq.filter(x => x.status === "lost");
    const closed = won.length + lost.length;
    // ใบเสนอราคาล่าสุด — ไม่มีฟิลด์ "อัปเดตล่าสุด" ในระบบ จึงใช้ค่านี้และตั้งชื่อคอลัมน์ให้ตรงกับที่มันเป็นจริง
    const latest = dq.map(x => parseThaiDate(x.createdAt)).filter(Boolean).sort((a, b) => +b! - +a!)[0] ?? null;
    return {
      ...d,
      leads: dl.length,
      quoted: dl.filter(l => QUOTED_UP.includes(l.status)).length,
      quotes: dq.length,
      quoteVal: dq.reduce((s, x) => s + x.valueNum, 0),
      wonCount: won.length,
      wonVal: won.reduce((s, x) => s + x.valueNum, 0),
      conv: closed ? Math.round(won.length / closed * 100) : null,
      tpct: d.revenueTarget > 0 ? Math.round(d.revenueActual / d.revenueTarget * 100) : 0,
      latest: latest ? `${latest.getDate()} ${TH_ABBR[latest.getMonth()]} ${latest.getFullYear() + 543}` : "—",
    };
  }).sort((a, b) => b.revenueActual - a.revenueActual), [dealers, quotes, leads]);

  // ── Executive KPI (4 การ์ด — ตัด Forecast ออก ไม่มีข้อมูล · ตัด "ตัวแทนยอดขายสูงสุด" ตามคำสั่ง) ──
  const kpi = useMemo(() => {
    const won = quotes.filter(x => x.status === "won");
    const lost = quotes.filter(x => x.status === "lost");
    const closed = won.length + lost.length;
    const actual = dealers.reduce((s, d) => s + d.revenueActual, 0);
    // เป้าทั้งเครือใช้ค่าที่ HQ ตั้งไว้ · แต่ถ้ากรองเหลือบางตัวแทน ต้องรวมเป้าเฉพาะรายนั้น ไม่งั้น % ผิด
    const filtered = dealers.length !== allDealers.length;
    const target = filtered ? dealers.reduce((s, d) => s + d.revenueTarget, 0) : targets.annualTarget;
    return {
      wonVal: won.reduce((s, x) => s + x.valueNum, 0), wonCount: won.length,
      quotes: quotes.length, quoteVal: quotes.reduce((s, x) => s + x.valueNum, 0),
      conv: closed ? Math.round(won.length / closed * 100) : null,
      actual, target, tpct: target > 0 ? Math.round(actual / target * 100) : 0, filtered,
    };
  }, [quotes, dealers, allDealers.length, targets.annualTarget]);

  // ── Section 1 · ลูกค้าเป้าหมาย เทียบ ใบเสนอราคา — สลับมุมมองได้ 4 แบบ ──
  const leadVsQuote = useMemo(() => {
    if (view === "month") {
      const a = timeRange.start.getMonth(), b = timeRange.end.getMonth();
      const lM = Array(12).fill(0), qM = Array(12).fill(0), upM = Array(12).fill(0);
      leads.forEach(l => {
        const d = parseThaiDate(l.createdAt ?? ""); if (!d) return;
        lM[d.getMonth()]++;
        if (QUOTED_UP.includes(l.status)) upM[d.getMonth()]++;
      });
      quotes.forEach(x => { const d = parseThaiDate(x.createdAt); if (d) qM[d.getMonth()]++; });
      return TH_ABBR.slice(a, b + 1).map((m, i) => ({
        key: m, label: m, a: lM[a + i], b: qM[a + i],
        note: lM[a + i] ? `อัตราแปลง ${Math.round(upM[a + i] / lM[a + i] * 100)}%` : undefined,
      }));
    }
    const keyOf = (code: string) => view === "dealer" ? code
      : view === "region" ? (DEALER_META.get(code)?.region ?? "—")
      : (DEALER_META.get(code)?.province ?? "—");
    // up = ลีดที่ไปถึงขั้น "เสนอราคา" ขึ้นไป — ใช้คิดอัตราแปลง (นิยามเดียวกับหน้าลูกค้าเป้าหมายทั้งเครือ)
    const m = new Map<string, { a: number; b: number; up: number }>();
    const bump = (k: string, f: "a" | "b" | "up") => { const r = m.get(k) ?? { a: 0, b: 0, up: 0 }; r[f]++; m.set(k, r); };
    leads.forEach(l => {
      bump(keyOf(l.dealerCode ?? ""), "a");
      if (QUOTED_UP.includes(l.status)) bump(keyOf(l.dealerCode ?? ""), "up");
    });
    quotes.forEach(x => bump(keyOf(x.dealerCode), "b"));
    return [...m.entries()].map(([k, v]) => ({
      key: k, a: v.a, b: v.b,
      label: view === "dealer" ? `${k} – ${DEALER_META.get(k)?.name ?? k}` : view === "region" ? regionDisplay(k) : k,
      note: v.a ? `อัตราแปลง ${Math.round(v.up / v.a * 100)}%` : undefined,
      onClick: view === "dealer" ? () => router.push(`/hq/dealers/${k}`) : undefined,
    })).sort((x, y) => y.a - x.a);
  }, [view, leads, quotes, DEALER_META, timeRange, router]);

  // ── Section 2 · มูลค่าใบเสนอราคา เทียบ ยอดขายจริง (รายตัวแทน) ──
  const quoteVsSales = useMemo(() => perf.map(d => ({
    key: d.code, label: `${d.code} – ${d.name}`, a: d.quoteVal, b: d.wonVal,
    note: d.quoteVal ? `ปิดได้ ${Math.round(d.wonVal / d.quoteVal * 100)}%` : undefined,
    onClick: () => router.push(`/hq/dealers/${d.code}`),
  })).sort((a, b) => b.a - a.a), [perf, router]);

  // ── Section 3 · เป้าหมายทั้งปี เทียบ ยอดขายจริง — สลับกลุ่มได้ ──
  const [tgView, setTgView] = useState<"dealer" | "region" | "province">("dealer");
  const targetVsActual = useMemo(() => {
    const keyOf = (d: DealerRow) => tgView === "dealer" ? d.code : tgView === "region" ? d.region : d.province;
    const m = new Map<string, { a: number; b: number }>();
    dealers.forEach(d => {
      const k = keyOf(d);
      const r = m.get(k) ?? { a: 0, b: 0 };
      r.a += d.revenueActual; r.b += d.revenueTarget;
      m.set(k, r);
    });
    return [...m.entries()].map(([k, v]) => ({
      key: k, a: v.a, b: v.b,
      label: tgView === "dealer" ? `${k} – ${DEALER_META.get(k)?.name ?? k}` : tgView === "region" ? regionDisplay(k) : k,
      note: v.b ? `${Math.round(v.a / v.b * 100)}% ของเป้า` : undefined,
      onClick: tgView === "dealer" ? () => router.push(`/hq/dealers/${k}`) : undefined,
    })).sort((x, y) => y.a - x.a);
  }, [tgView, dealers, DEALER_META, router]);

  // ── Section 6 · เทียบรายภูมิภาค — แท่งซ้อน ลีด/ใบเสนอราคา/ปิดได้ ──
  const regional = useMemo(() => {
    const rs = [...new Set(perf.map(d => d.region))].sort();
    const sum = (r: string, f: "leads" | "quotes" | "wonCount") =>
      perf.filter(d => d.region === r).reduce((s, d) => s + d[f], 0);
    return {
      labels: rs.map(regionDisplay),
      series: [
        { name: "ลูกค้าเป้าหมาย", color: "#003366", data: rs.map(r => sum(r, "leads")) },
        { name: "ใบเสนอราคา", color: "#0891b2", data: rs.map(r => sum(r, "quotes")) },
        { name: "ปิดการขายได้", color: "#10B981", data: rs.map(r => sum(r, "wonCount")) },
      ],
    };
  }, [perf]);

  // ── Section 7 · เหตุผลที่เสียโอกาสการขาย — จากลีดที่บันทึกเหตุผลไว้จริงเท่านั้น ──
  const lostReasons = useMemo(() => {
    const m = new Map<string, number>();
    leads.filter(l => l.status === "CANCELLED" && l.lostReason)
      .forEach(l => m.set(l.lostReason!, (m.get(l.lostReason!) ?? 0) + 1));
    const arr = [...m.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count);
    const total = arr.reduce((s, r) => s + r.count, 0) || 1;
    const max = Math.max(...arr.map(a => a.count), 1);
    return arr.map(a => ({ ...a, pct: Math.round(a.count / max * 100), share: Math.round(a.count / total * 100) }));
  }, [leads]);

  // ── Section 8 · แนวโน้มรายเดือน — ลีด/ใบเสนอราคา/ยอดขาย · เท่าที่มีข้อมูล (ไม่ฟิกซ์ 12 เดือน) ──
  const trend = useMemo(() => {
    const lM = Array(12).fill(0), qM = Array(12).fill(0), sM = Array(12).fill(0);
    leads.forEach(l => { const d = parseThaiDate(l.createdAt ?? ""); if (d) lM[d.getMonth()]++; });
    quotes.forEach(x => {
      const d = parseThaiDate(x.createdAt); if (!d) return;
      qM[d.getMonth()]++;
      if (x.status === "won") sM[d.getMonth()] += x.valueNum;
    });
    const a = timeRange.start.getMonth(), b = timeRange.end.getMonth();
    const cut = (arr: number[]) => arr.slice(a, b + 1);
    return {
      months: TH_ABBR.slice(a, b + 1),
      counts: [
        { name: "ลูกค้าเป้าหมาย", color: "#003366", data: cut(lM) },
        { name: "ใบเสนอราคา", color: "#0891b2", data: cut(qM) },
      ],
      sales: [{ name: "ยอดขาย (ล้านบาท)", color: "#10B981", data: cut(sM).map(v => Math.round(v / 1e5) / 10) }],
    };
  }, [leads, quotes, timeRange]);

  // ── Drawer (View) — เจาะรายตัวแทน ไม่เปลี่ยนหน้า ──
  const [drawer, setDrawer] = useState<typeof perf[number] | null>(null);
  const anyFilter = q.trim() !== "" || [dealerSel, regionSel, provSel, btSel, salesSel].some(v => v !== ALL);

  const kNum: React.CSSProperties = { fontSize: "1.15rem", fontWeight: 800, color: "#1F2937", lineHeight: 1.15, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.015em", whiteSpace: "nowrap" };
  const kSub: React.CSSProperties = { fontSize: "0.72rem", color: MUTED };
  const kpiCards = [
    { label: "ยอดขายจริง (ในช่วง)", value: fmtBaht(kpi.wonVal), sub: `${kpi.wonCount} ดีล · จากใบเสนอราคาที่ปิดได้`, Icon: Trophy, color: "#059669", bg: "#E6F6EF" },
    { label: "มูลค่าใบเสนอราคา", value: fmtBaht(kpi.quoteVal), sub: `${kpi.quotes} ใบ · ในช่วงที่เลือก`, Icon: FileText, color: "#0891B2", bg: "#E6F4F9" },
    { label: "อัตราปิดการขาย", value: kpi.conv === null ? "—" : `${kpi.conv}%`, sub: "ตอบรับ ÷ (ตอบรับ + ปฏิเสธ)", Icon: Percent, color: "#7C3AED", bg: "#F0EBFB" },
    { label: "เป้าหมายทั้งปี", value: `${kpi.tpct}%`, sub: `ยอดสะสม ${fmtBaht(kpi.actual)} จาก ${fmtBaht(kpi.target)}`, Icon: Target, color: "#2563EB", bg: "#E8F0FE" },
  ];

  const sel = (v: string, on: (x: string) => void, caption: string, opts: { v: string; l: string }[]) => (
    <select value={v} onChange={e => on(e.target.value)} className="form-input"
      style={{ width: "auto", minWidth: 128, padding: "7px 10px", fontSize: "0.74rem", fontWeight: 600, cursor: "pointer" }}>
      <option value={ALL}>{caption}</option>
      {opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  );
  const viewTab = (cur: string, v: string, l: string, on: () => void) => (
    <button key={v} onClick={on} style={{
      padding: "4px 11px", borderRadius: 8, fontSize: "0.68rem", fontWeight: 700, cursor: "pointer",
      border: `1px solid ${cur === v ? PRIMARY : "#dbe3ec"}`, background: cur === v ? PRIMARY : "#fff",
      color: cur === v ? "#fff" : MUTED,
    }}>{l}</button>
  );

  return (
    <div className="erp">
      {/* ── HEADER ── */}
      <div className="page-head">
        <div>
          <p style={{ margin: 0 }}>วิเคราะห์และเปรียบเทียบประสิทธิภาพยอดขายของตัวแทนจำหน่ายทั่วประเทศ · {timeRange.subtitle}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <FilterBar dims={[]} />
          {/* ส่งออก = ตารางผลงานที่เห็นบนจอ (ผ่านตัวกรองทุกตัวแล้ว) */}
          <ExportMenu filename="hq-sales-analytics" title="ภาพรวมยอดขายทั้งเครือ"
            headers={["รหัสตัวแทน", "ตัวแทนจำหน่าย", "ภูมิภาค", "จังหวัด", "ลูกค้าเป้าหมาย", "ใบเสนอราคา", "มูลค่าใบเสนอราคา", "ยอดขายสะสมทั้งปี", "อัตราปิดการขาย", "เป้าหมายทั้งปี", "% ของเป้า", "ใบเสนอราคาล่าสุด"]}
            rows={perf.map(d => [
              d.code, d.name, regionDisplay(d.region), d.province, d.leads, d.quotes, d.quoteVal,
              d.revenueActual, d.conv === null ? "—" : `${d.conv}%`, d.revenueTarget, `${d.tpct}%`, d.latest,
            ])} />
        </div>
      </div>

      {/* ── EXECUTIVE KPI ── */}
      <div className="hq-kpi4" style={{ marginBottom: "1.25rem" }}>
        {kpiCards.map(k => (
          <div key={k.label} className="card" style={{ marginBottom: 0, padding: "18px 18px 15px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ ...kSub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k.label}</div>
              <div style={{ ...kNum, marginTop: 6 }}>{k.value}</div>
              <div style={{ ...kSub, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k.sub}</div>
            </div>
            <span style={{ width: 42, height: 42, borderRadius: 12, background: k.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <k.Icon size={20} color={k.color} strokeWidth={2.1} />
            </span>
          </div>
        ))}
      </div>

      {/* ── SMART FILTER ── อยู่ใต้ KPI เหมือนหน้า HQ อื่น (ใบเสนอราคา/ลูกค้า/ตัวแทน)
          เดิมหน้านี้หน้าเดียวที่เอาตัวกรองไว้เหนือ KPI */}
      <div className="card" style={{ marginBottom: "1.25rem" }}>
        <div className="card-body" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", paddingTop: 14, paddingBottom: 14 }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="ค้นหารหัส ชื่อตัวแทน จังหวัด…"
            className="form-input" style={{ width: 240, padding: "7px 11px", fontSize: "0.74rem" }} />
          {sel(dealerSel, setDealerSel, "ทุกตัวแทน", allDealers.map(d => ({ v: d.code, l: `${d.code} – ${d.name}` })))}
          {sel(regionSel, setRegionSel, "ทุกภูมิภาค", regionOpts.map(r => ({ v: r, l: regionDisplay(r) })))}
          {sel(provSel, setProvSel, "ทุกจังหวัด", provOpts.map(p => ({ v: p, l: p })))}
          {sel(btSel, setBtSel, "ทุกประเภทอาคาร", btOpts.map(b => ({ v: b, l: b })))}
          {sel(salesSel, setSalesSel, "ทุกช่วงยอดขาย", SALES_BANDS.map(b => ({ v: b.v, l: b.l })))}
          {anyFilter && (
            <button onClick={() => { setQ(""); setDealerSel(ALL); setRegionSel(ALL); setProvSel(ALL); setBtSel(ALL); setSalesSel(ALL); }}
              className="btn btn-secondary btn-sm">ล้างตัวกรอง</button>
          )}
          <span style={{ fontSize: "0.7rem", color: MUTED, marginLeft: "auto" }}>ตัวแทน {perf.length} จาก {allDealers.length} ราย</span>
        </div>
      </div>

      {/* ── แถว 1 · เปรียบเทียบรายตัวแทน: ลีด→ใบเสนอราคา | มูลค่า→ยอดขายจริง ──
          สองใบนี้เป็นแท่งคู่รายตัวแทนเหมือนกันและสูงพอ ๆ กัน จับคู่ไว้แถวเดียว
          (เดิมทั้งหน้าเป็นการ์ดเต็มความกว้าง 8 ใบเรียงซ้อนกัน ยาว 4,800px) */}
      <div className="hq-dealer-charts" style={{ marginBottom: "1.25rem", alignItems: "stretch" }}>
      <div className="card" style={{ marginBottom: 0 }}>
        <div className="card-header">
          <div className="card-title">ลูกค้าเป้าหมาย เทียบ ใบเสนอราคา</div>
          <div style={{ display: "flex", gap: 5 }}>
            {([["dealer", "ตัวแทน"], ["region", "ภูมิภาค"], ["province", "จังหวัด"], ["month", "รายเดือน"]] as const)
              .map(([v, l]) => viewTab(view, v, l, () => setView(v)))}
          </div>
        </div>
        <HBars rows={leadVsQuote} aLabel="ลูกค้าเป้าหมาย" bLabel="ใบเสนอราคา" bColor="#0891b2" fmt={v => `${v}`} />
      </div>

      {/* ── SECTION 2 · มูลค่าใบเสนอราคา เทียบ ยอดขายจริง ── */}
      <div className="card" style={{ marginBottom: 0 }}>
        <div className="card-header">
          <div className="card-title">มูลค่าใบเสนอราคา เทียบ ยอดขายจริง · รายตัวแทน</div>
          <span style={{ fontSize: "0.62rem", color: MUTED }}>ในช่วงที่เลือก · คลิกเพื่อเจาะรายตัวแทน</span>
        </div>
        <HBars rows={quoteVsSales} aLabel="มูลค่าใบเสนอราคา" bLabel="ยอดขายจริง" aColor="#0891b2" bColor="#059669" fmt={fmtBaht} />
      </div>
      </div>

      {/* ── แถว 2 · เป้าหมายทั้งปี | อันดับตัวแทน ── */}
      <div className="hq-dealer-charts" style={{ marginBottom: "1.25rem", alignItems: "stretch" }}>
      <div className="card" style={{ marginBottom: 0 }}>
        <div className="card-header">
          <div className="card-title">เป้าหมายทั้งปี เทียบ ยอดขายจริง</div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: "0.62rem", color: MUTED, marginRight: 4 }}>ยอดสะสมทั้งปี — ไม่ขึ้นกับตัวกรองเวลา</span>
            {([["dealer", "ตัวแทน"], ["region", "ภูมิภาค"], ["province", "จังหวัด"]] as const)
              .map(([v, l]) => viewTab(tgView, v, l, () => setTgView(v)))}
          </div>
        </div>
        <HBars rows={targetVsActual} aLabel="ยอดขายสะสมทั้งปี" bLabel="เป้าหมายทั้งปี" fmt={fmtBaht} />
      </div>

      {/* โดนัท: เหตุผลรวมกัน = ลีดที่เสียโอกาสทั้งหมดพอดี → เป็นสัดส่วนของก้อนเดียว เหมาะกับโดนัทมากกว่าแท่ง
          (ชุดสีเดียวกับหน้า /hq/leads เพื่อให้ทั้งระบบอ่านเหมือนกัน) */}
      <div className="card" style={{ marginBottom: 0, display: "flex", flexDirection: "column" }}>
        <div className="card-header">
          <div className="card-title">เหตุผลที่เสียโอกาสการขาย</div>
          <span style={{ fontSize: "0.62rem", color: MUTED }}>กำหนดโดย HQ ที่หน้าตั้งค่า · นับเฉพาะลีดที่บันทึกเหตุผลไว้จริง</span>
        </div>
        <div className="card-body" style={{ paddingTop: 6, flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 18 }}>
          {!lostReasons.length ? <div style={{ fontSize: "0.78rem", color: MUTED }}>— ไม่มีลีดที่บันทึกเหตุผลไว้ในขอบเขตนี้</div>
            : (<>
              <Donut
                segments={lostReasons.map((r, i) => ({ label: r.reason, value: r.count, color: LOST_RAMP[i % LOST_RAMP.length] }))}
                centerLabel="เสียโอกาส"
                centerValue={`${lostReasons.reduce((s, r) => s + r.count, 0)}`}
                size={168}
              />
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 9 }}>
                {lostReasons.map((r, i) => (
                  <div key={r.reason} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.72rem" }}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: LOST_RAMP[i % LOST_RAMP.length], flexShrink: 0 }} />
                    <span style={{ flex: 1, color: "#374151", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.reason}</span>
                    <span style={{ fontWeight: 800, color: "#1F2937", fontVariantNumeric: "tabular-nums" }}>{r.count}</span>
                    <span style={{ color: MUTED, minWidth: 34, textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{r.share}%</span>
                  </div>
                ))}
              </div>
            </>)}
        </div>
      </div>
      </div>

      {/* ── แถว 3 · เทียบรายภูมิภาค — เต็มความกว้าง
          แท่งซ้อนแนวตั้ง 6 ภาคอ่านง่ายกว่าตอนกว้าง · และเหลือการ์ดคี่ใบเดียวพอดี ไม่ต้องยัดคู่ให้ครึ่งขวาว่าง */}
      <div className="card" style={{ marginBottom: "1.25rem" }}>
        <div className="card-header">
          <div className="card-title">เทียบรายภูมิภาค</div>
          <span style={{ fontSize: "0.62rem", color: MUTED }}>จำนวนรายการ · ลูกค้าเป้าหมาย / ใบเสนอราคา / ปิดการขายได้</span>
        </div>
        <div className="card-body" style={{ paddingTop: 4 }}>
          {!regional.labels.length
            ? <EmptyState icon={<Building2 size={26} />} title="ไม่พบข้อมูลภูมิภาค" description="ลองปรับตัวกรอง" compact />
            : <StackedBarChart months={regional.labels} series={regional.series} height={300} fmt={v => `${Math.round(v)}`} />}
        </div>
      </div>

      {/* ── แถว 4 · แนวโน้มรายเดือน — แยกเป็น 2 การ์ดวางข้างกัน (เดิมซ้อนกันในใบเดียว สูง 818px) ── */}
      <div className="hq-dealer-charts" style={{ marginBottom: "1.25rem", alignItems: "stretch" }}>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <div className="card-title">แนวโน้มจำนวนรายการ</div>
            <span style={{ fontSize: "0.62rem", color: MUTED }}>ตามช่วงที่กรอง · แสดงเท่าที่มีข้อมูล</span>
          </div>
          <div className="card-body" style={{ paddingTop: 4 }}>
            {/* vw ต้องใกล้ความกว้างการ์ดจริง (~545px) ไม่งั้น SVG ถูกย่อจนกราฟเตี้ยผิดสัดส่วน */}
            <MultiLineChart months={trend.months} series={trend.counts} vw={560} height={260} fmt={v => `${Math.round(v)}`} />
          </div>
        </div>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <div className="card-title">แนวโน้มยอดขาย</div>
            <span style={{ fontSize: "0.62rem", color: MUTED }}>หน่วย: ล้านบาท</span>
          </div>
          <div className="card-body" style={{ paddingTop: 4 }}>
            <MultiLineChart months={trend.months} series={trend.sales} vw={560} height={260} fmt={v => `${v.toFixed(1)}M`} />
          </div>
        </div>
      </div>

      {/* ── PERFORMANCE TABLE ── */}
      <div className="card" style={{ marginBottom: 0 }}>
        <div className="card-header">
          <div className="card-title">ตารางผลงานตัวแทนจำหน่าย</div>
          <span style={{ fontSize: "0.62rem", color: MUTED }}>ลีด/ใบเสนอราคา/มูลค่า = ในช่วงที่เลือก · ยอดขายสะสม/เป้า = ทั้งปี (ตัวเลขทางการของตัวแทน)</span>
        </div>
        <div className="table-wrap">
          <table>
            <colgroup>
              <col style={{ width: "7%", minWidth: 58 }} />{/* รหัส */}
              <col style={{ width: "17%", minWidth: 150 }} />{/* ตัวแทน */}
              <col style={{ width: "12%", minWidth: 110 }} />{/* ภูมิภาค */}
              <col style={{ width: "7%", minWidth: 58 }} />{/* ลีด */}
              <col style={{ width: "8%", minWidth: 74 }} />{/* ใบเสนอราคา */}
              <col style={{ width: "10%", minWidth: 96 }} />{/* มูลค่าใบเสนอราคา */}
              <col style={{ width: "9%", minWidth: 88 }} />{/* ยอดขายจริง */}
              <col style={{ width: "7%", minWidth: 66 }} />{/* อัตราปิด */}
              <col style={{ width: "9%", minWidth: 88 }} />{/* เป้าทั้งปี */}
              <col style={{ width: "6%", minWidth: 58 }} />{/* % เป้า */}
              <col style={{ width: "9%", minWidth: 94 }} />{/* ใบเสนอราคาล่าสุด */}
              <col style={{ width: "5%", minWidth: 56 }} />{/* ปุ่มดู */}
            </colgroup>
            <thead>
              <tr>
                <th>รหัส</th>
                <th>ตัวแทนจำหน่าย</th>
                <th>ภูมิภาค</th>
                <th style={{ textAlign: "right" }}>ลีด</th>
                <th style={{ textAlign: "right" }}>ใบเสนอราคา</th>
                <th style={{ textAlign: "right" }}>มูลค่าใบเสนอราคา</th>
                <th style={{ textAlign: "right" }}>ยอดขายสะสม</th>
                <th style={{ textAlign: "right" }}>อัตราปิด</th>
                <th style={{ textAlign: "right" }}>เป้าทั้งปี</th>
                <th style={{ textAlign: "right" }}>% เป้า</th>
                <th>ใบเสนอราคาล่าสุด</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {!perf.length && <tr><td colSpan={12} style={{ padding: 32, textAlign: "center", fontSize: "0.8rem", color: "#9ca3af" }}>ไม่พบตัวแทนที่ตรงกับตัวกรอง</td></tr>}
              {perf.map(d => (
                <tr key={d.code} className="clickable" onClick={() => setDrawer(d)} style={{ cursor: "pointer" }}>
                  <td style={{ fontFamily: "monospace", fontWeight: 700, color: PRIMARY }}>{d.code}</td>
                  <td style={{ fontWeight: 600, color: "#1F2937", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {d.name}
                    {d.status === "inactive" && <span style={{ marginLeft: 6, fontSize: "0.62rem", fontWeight: 700, color: MUTED }}>(ปิดใช้งาน)</span>}
                  </td>
                  <td style={{ color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{regionDisplay(d.region)}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{d.leads}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{d.quotes}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtBaht(d.quoteVal)}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 800, color: "#1F2937" }}>{fmtBaht(d.revenueActual)}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{d.conv === null ? "—" : `${d.conv}%`}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtBaht(d.revenueTarget)}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700, color: d.tpct >= 100 ? "#059669" : PRIMARY }}>{d.tpct}%</td>
                  <td style={{ color: MUTED, whiteSpace: "nowrap" }}>{d.latest}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button title="ดูรายละเอียด" onClick={() => setDrawer(d)}
                        style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid #dbe3ec", background: "#fff", color: PRIMARY, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Eye size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── DRAWER — เจาะรายตัวแทน (อ่านอย่างเดียว ไม่มีแก้/ลบ) ── */}
      {drawer && <DealerDrawer d={drawer} onClose={() => setDrawer(null)}
        customers={netCustomers.filter(c => c.dealerCode === drawer.code)}
        leads={netLeads.filter(l => l.dealerCode === drawer.code)}
        quotes={netQuotes.filter(x => x.dealerCode === drawer.code)}
        appointments={appointments} files={dealerFiles} onOpenDealer={() => router.push(`/hq/dealers/${drawer.code}`)} />}
    </div>
  );
}

// ── Drawer ────────────────────────────────────────────────────────────────────
// นัดหมาย/ไฟล์ ไม่มี dealerCode ในระบบ → ผูกผ่าน leadId/recordId = numId ของลีดตัวแทนรายนี้
// ตัวแทนที่ยังไม่มีนัดหมาย/ไฟล์บันทึกไว้จะขึ้น "—" ตามจริง (ไม่เติมข้อมูลปลอม)
function DealerDrawer({ d, onClose, customers, leads, quotes, appointments, files, onOpenDealer }: {
  d: { code: string; name: string; region: string; province: string; status: string; revenueActual: number; revenueTarget: number; tpct: number; leads: number; quoted: number; quotes: number; quoteVal: number; wonCount: number; wonVal: number; conv: number | null; latest: string };
  onClose: () => void;
  customers: { id: number; name: string; province: string; dealsWon: number; totalRevenue: number }[];
  leads: { numId: number; company: string; status: string }[];
  quotes: { quoteNo: string; customer: string; valueNum: number; status: string; createdAt: string }[];
  appointments: { id: number; leadId?: number; company: string; project: string; date: string; time: string; assigned: string }[];
  files: DealerFile[];
  onOpenDealer: () => void;
}) {
  const leadIds = new Set(leads.map(l => l.numId));
  const appts = appointments.filter(a => a.leadId != null && leadIds.has(a.leadId));
  const docs = files.filter(f => f.source === "lead" && f.recordId != null && leadIds.has(f.recordId));

  // ยอดขายรายเดือนของตัวแทนรายนี้ — จากใบเสนอราคาที่ปิดได้จริง
  const monthly = (() => {
    const m = Array(12).fill(0);
    quotes.forEach(x => { if (x.status !== "won") return; const dt = parseThaiDate(x.createdAt); if (dt) m[dt.getMonth()] += x.valueNum; });
    const last = m.reduce((acc, v, i) => v > 0 ? i : acc, -1);
    return last < 0 ? [] : m.slice(0, last + 1).map((v, i) => ({ month: TH_ABBR[i], value: v }));
  })();
  const maxM = Math.max(...monthly.map(x => x.value), 1);

  const head: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, fontSize: "0.62rem", fontWeight: 800, color: "#8a929c", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 18, marginBottom: 8 };
  const row = (l: string, v: React.ReactNode) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "5px 0", fontSize: "0.76rem" }}>
      <span style={{ color: MUTED }}>{l}</span>
      <span style={{ fontWeight: 700, color: STEEL, textAlign: "right" }}>{v}</span>
    </div>
  );
  const empty = (t: string) => <div style={{ fontSize: "0.78rem", color: MUTED }}>— {t}</div>;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(45,45,45,.35)", zIndex: 300 }} />
      <div className="side-drawer" style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 460, maxWidth: "94vw", background: "#f8fafc", zIndex: 310, display: "flex", flexDirection: "column", boxShadow: "-18px 0 60px rgba(0,51,102,.18)" }}>
        {/* Dealer Profile */}
        <div style={{ background: PRIMARY, padding: "18px 20px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: "1rem", fontWeight: 800, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</div>
              <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,.72)", marginTop: 3 }}>
                {d.code} · {regionDisplay(d.region)} · {d.province}{d.status === "inactive" ? " · ปิดใช้งาน" : ""}
              </div>
            </div>
            <button onClick={onClose} style={{ background: "rgba(255,255,255,.15)", border: "none", borderRadius: 8, width: 30, height: 30, cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><X size={14} /></button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "4px 20px 20px" }}>
          <div style={head}><Users size={11} /> สรุปลูกค้าเป้าหมาย</div>
          {row("ลูกค้าเป้าหมายทั้งหมด", `${d.leads} ราย`)}
          {row("เสนอราคาแล้ว", `${d.quoted} ราย`)}
          {row("อัตราแปลงเป็นใบเสนอราคา", d.leads ? `${Math.round(d.quoted / d.leads * 100)}%` : "—")}

          <div style={head}><FileText size={11} /> สรุปใบเสนอราคา</div>
          {row("ใบเสนอราคา (ในช่วง)", `${d.quotes} ใบ`)}
          {row("มูลค่ารวม", fmtBaht(d.quoteVal))}
          {row("ปิดได้", `${d.wonCount} ใบ · ${fmtBaht(d.wonVal)}`)}
          {row("อัตราปิดการขาย", d.conv === null ? "—" : `${d.conv}%`)}
          {row("ใบเสนอราคาล่าสุด", d.latest)}

          <div style={head}><Building2 size={11} /> สรุปลูกค้า</div>
          {row("ลูกค้าทั้งหมด", `${customers.length} ราย`)}
          {row("มูลค่ารวมจากลูกค้า", fmtBaht(customers.reduce((s, c) => s + c.totalRevenue, 0)))}
          {!customers.length ? empty("ยังไม่มีลูกค้า") : (
            <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 6 }}>
              {[...customers].sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 5).map(c => (
                <div key={c.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, background: "#fff", border: "1px solid #E5E7EB", borderRadius: 9, padding: "7px 10px", fontSize: "0.74rem" }}>
                  <span style={{ flex: 1, minWidth: 0, fontWeight: 700, color: STEEL, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                  <span style={{ color: MUTED, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{fmtBaht(c.totalRevenue)}</span>
                </div>
              ))}
            </div>
          )}

          <div style={head}><Coins size={11} /> สรุปยอดขาย</div>
          <div style={{ fontSize: "0.66rem", color: MUTED, marginBottom: 4 }}>ยอดสะสม/เป้า = ตัวเลขทางการของตัวแทน · ไม่ใช่ผลรวมใบเสนอราคาด้านบน</div>
          {row("ยอดขายสะสมทั้งปี", fmtBaht(d.revenueActual))}
          {row("เป้าหมายทั้งปี", fmtBaht(d.revenueTarget))}
          {row("% ของเป้า", <span style={{ color: d.tpct >= 100 ? "#059669" : PRIMARY }}>{d.tpct}%</span>)}

          <div style={head}>ยอดขายรายเดือน · จากใบเสนอราคาที่ปิดได้</div>
          {!monthly.length ? empty("ยังไม่มียอดปิดการขาย") : (
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {monthly.map(m => (
                <div key={m.month} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 34, fontSize: "0.66rem", color: MUTED, fontWeight: 700, flexShrink: 0 }}>{m.month}</span>
                  <div style={{ flex: 1, height: 7, background: "var(--muted)", borderRadius: 999, overflow: "hidden" }}>
                    <div className="bar-grow" style={{ height: "100%", width: `${Math.round(m.value / maxM * 100)}%`, background: PRIMARY, borderRadius: 999 }} />
                  </div>
                  <span style={{ width: 58, textAlign: "right", fontSize: "0.66rem", fontWeight: 700, color: STEEL, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{m.value ? fmtBaht(m.value) : "—"}</span>
                </div>
              ))}
            </div>
          )}

          <div style={head}><CalendarDays size={11} /> ไทม์ไลน์นัดหมาย</div>
          {!appts.length ? empty("ไม่มีนัดหมายที่ผูกกับลีดของตัวแทนรายนี้") : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {appts.map(a => (
                <div key={a.id} style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 9, padding: "8px 10px" }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: STEEL, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.project || a.company}</div>
                  <div style={{ fontSize: "0.65rem", color: MUTED, marginTop: 2 }}>{fmtISOToThai(a.date)} · {a.time} · {a.assigned}</div>
                </div>
              ))}
            </div>
          )}

          <div style={head}><FolderOpen size={11} /> เอกสาร</div>
          {!docs.length ? empty("ไม่มีเอกสารที่ผูกกับลีดของตัวแทนรายนี้") : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {docs.map(f => (
                <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", border: "1px solid #E5E7EB", borderRadius: 9, padding: "7px 10px" }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: "0.74rem", fontWeight: 700, color: STEEL, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                  <span style={{ fontSize: "0.65rem", color: MUTED, flexShrink: 0 }}>{f.size}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ borderTop: "1px solid #e6ebf2", background: "#fff", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: "0.68rem", color: MUTED }}>สำนักงานใหญ่ดูอย่างเดียว</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onOpenDealer} className="btn btn-secondary btn-sm">เปิดหน้าตัวแทน</button>
            <button onClick={onClose} className="btn btn-primary btn-sm">ปิด</button>
          </div>
        </div>
      </div>
    </>
  );
}
