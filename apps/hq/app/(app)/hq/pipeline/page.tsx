"use client";

// ─── HQ · ภาพรวมยอดขายทั้งเครือ (Sales Analytics) ──────────────────────────────
// ศูนย์บัญชาการยอดขายของสำนักงานใหญ่ — อ่านอย่างเดียว ไม่มีสร้าง/แก้/ลบ (Action = ดู · วิเคราะห์ · ส่งออก)
// กราฟใช้ได้เฉพาะ แท่งแนวนอน / แท่งคู่ / แท่งซ้อน / เส้น (ไม่มีกรวย/เกจ/วงกลม)
//
// ── สิ่งที่ตัดออกจากสเปก เพราะข้อมูลจริงไม่รองรับ (อย่าใส่กลับโดยไม่มีข้อมูลก่อน) ──
// • Forecast / คาดการณ์รายได้ — ระบบไม่มีวันคาดปิดการขาย (ลบทั้งฟีเจอร์แล้ว) และไม่มีฟิลด์ % ความน่าจะเป็น
//   จึงถ่วงน้ำหนัก pipeline ไม่ได้ · บอสสั่งตัดออก
// • ย้อนหลังฟิกซ์ 12 เดือน — ตัวแทน 9/10 รายมีข้อมูลแค่ 3 เดือน · กราฟตัดตามตัวกรองเวลา "เท่าที่มีข้อมูล"
// • Last Updated รายตัวแทน — DealerRow ไม่มีฟิลด์นี้ · ใช้ "ใบเสนอราคาล่าสุด" ที่หาได้จริงแทน (ชื่อคอลัมน์ตรงกับสิ่งที่มันเป็น)
// • Refresh — ระบบไม่มี backend ให้ refresh (ข้อมูลสดจาก SalesContext อยู่แล้ว)
import { useMemo, useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  FileText, Percent, Target, Trophy, Eye, X, Building2, Users, Coins, CalendarDays, FolderOpen,
} from "lucide-react";
import { DealerQuotationPerformance, DealerQuotationTable } from "@pms/shared/components/hq/pipeline/DealerQuotationPerformance";
import { ExportMenu } from "@pms/shared/components/ui/ExportMenu";
import { EmptyState } from "@pms/shared/components/ui/EmptyState";
import {
  DEFAULT_HQ_TARGETS,
  DEALER_FILES_EVENT, fmtISOToThai, QUOTED_UP,
  type DealerRow, type HQTargets, type DealerFile,
} from "@pms/shared/lib/mock";
import { useRepoValue } from "@pms/shared/lib/useRepoState";
import { useDealerPerformance, EMPTY_PERF } from "@pms/shared/lib/useDealerPerformance";
import { dealers as dealersRepo, settings as settingsRepo, files as filesRepo } from "@pms/shared/lib/data";
import { logRepoRead } from "@pms/shared/lib/repoLog";
import { ClickableRow } from "@pms/shared/components/ui/ClickableRow";
import { useFilters, APP_NOW } from "@pms/shared/context/FilterContext";
import { useSales } from "@pms/shared/context/SalesContext";
import { FilterBar } from "@pms/shared/components/filters/FilterBar";
import { useNetworkQuotations, useNetworkLeads, useNetworkCustomers, useHQQuotationsSummary, useLeadSummary, useDealerDrawerData } from "@pms/shared/lib/useNetworkData";
import { regionDisplay } from "@pms/shared/lib/hqQuotations";
import { fmtBaht } from "@pms/shared/lib/format";

const PRIMARY = "#003366";
const STEEL = "#2D2D2D";
const MUTED = "var(--muted-foreground)";
const RAMP = ["#003366", "#0891b2", "#059669", "#d97706", "#7c3aed", "#dc2626"];
const TH_ABBR = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const isoDateOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const TH_MONTH: Record<string, number> = Object.fromEntries(TH_ABBR.map((m, i) => [m, i]));
const parseThaiDate = (s: string): Date | null => {
  const mt = /^(\d{1,2})\s+(\S+)\s+(\d{4})/.exec((s || "").trim());
  if (!mt || !(mt[2] in TH_MONTH)) return null;
  const y = +mt[3] > 2500 ? +mt[3] - 543 : +mt[3];
  return new Date(y, TH_MONTH[mt[2]], +mt[1]);
};
const ALL = "ALL";
// ตัวกรองว่าง (ทั้งเครือ ทุกช่วง) — อ้างอิงคงที่ ดึง product_line ทั้งหมดครั้งเดียว
const EMPTY_QF = {};

// ── แท่งแนวนอนคู่ — ใช้ซ้ำใน Section 1 / 2 / 3 (แท่งหลัก + แท่งเทียบ) ──
// เปิดมาโชว์ครบทุกแถวเลย (บอสสั่ง 17 ก.ค. 69) — ให้อ่านคู่กับตารางข้าง ๆ ที่ก็ลิสต์ครบทุกตัวแทนเหมือนกัน
// การ์ดไม่ยืดตามจำนวนแถว เพราะความสูงตรึงด้วย .chart-l แล้วให้ .chart-scroll เลื่อนข้างใน
// (กติกาใน globals.css: ข้อมูลล้น = เลื่อนใน .chart-scroll หรือตัด Top N + ปุ่มดูทั้งหมด — ที่นี่ใช้แบบเลื่อน)
// ปุ่มย่อกลับเป็น 5 อันดับแรกยังอยู่ เผื่ออยากดูเฉพาะหัวตาราง
const TOP_N = 5;
type HRow = { key: string; label: string; a: number; b: number; note?: string; onClick?: () => void };
function HBars({ rows, aLabel, bLabel, aColor = PRIMARY, bColor = "#C0C0C0", fmt }: {
  rows: HRow[]; aLabel: string; bLabel: string; aColor?: string; bColor?: string; fmt: (v: number) => string;
}) {
  const [all, setAll] = useState(true);
  // max คิดจากทุกแถวเสมอ — ไม่งั้นพอกด "ดูทั้งหมด" ความยาวแท่งจะขยับ ทั้งที่ข้อมูลเท่าเดิม
  const max = Math.max(...rows.flatMap(r => [r.a, r.b]), 1);
  const shown = all ? rows : rows.slice(0, TOP_N);
  const hidden = rows.length - shown.length;
  // flex: 1 — เดิมได้ความยืดมาจากคลาส chart-l ของการ์ด พอเลิกล็อกความสูงตายตัวก็ต้องยืดเอง
  // ไม่งั้นเนื้อในหดตามจำนวนข้อมูล การ์ดเลยเตี้ยกลับไปไม่เท่าเพื่อนในแถวเหมือนเดิม
  return (
    <div className="card-body" style={{ paddingTop: 4, display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
      {/* คำอธิบายสี — ต้องมี ไม่งั้นแท่งคู่อ่านไม่ออกว่าอันไหนคืออะไร */}
      <div style={{ display: "flex", gap: 14, marginBottom: 12, flexShrink: 0 }}>
        {[[aLabel, aColor], [bLabel, bColor]].map(([l, c]) => (
          <span key={l} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.66rem", fontWeight: 700, color: MUTED }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: c, flexShrink: 0 }} /> {l}
          </span>
        ))}
      </div>
      {!rows.length ? (
        <EmptyState icon={<Coins size={26} />} title="ไม่พบข้อมูลในช่วงที่เลือก" description="ลองปรับตัวกรอง" compact />
      ) : (<>
        <div className="chart-scroll" style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
          {shown.map(r => (
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
        {/* บอกจำนวนที่ซ่อนไว้เสมอ — ห้ามตัดเงียบ ไม่งั้นคนอ่านนึกว่าเห็นครบแล้ว */}
        {(hidden > 0 || all) && (
          <button type="button" onClick={() => setAll(v => !v)}
            style={{ marginTop: 10, flexShrink: 0, alignSelf: "flex-start", background: "none", border: "none", padding: 0,
              cursor: "pointer", fontFamily: "inherit", fontSize: "0.68rem", fontWeight: 700, color: PRIMARY }}>
            {all ? "ย่อกลับเป็น 5 อันดับแรก" : `ดูทั้งหมด (อีก ${hidden} ราย)`}
          </button>
        )}
      </>)}
    </div>
  );
}

export default function SalesAnalyticsPage() {
  const router = useRouter();
  const { timeRange, inRange } = useFilters();
  const allDealers = useRepoValue<DealerRow[]>(() => dealersRepo.list(), []);
  // ยอดขายจริงรายสาขา — จากใบที่ปิดการขายได้ ไม่ใช่คอลัมน์ revenue_actual ที่ seed ไว้
  const dealerPerf = useDealerPerformance();
  const perfOf = (code: string) => dealerPerf.get(code) ?? EMPTY_PERF;
  // ยอดขายที่ยังโหลดไม่เสร็จต้องขึ้น "—" ไม่ใช่ ฿0 — ศูนย์แปลว่า "ขายไม่ได้เลย" ซึ่งคนละเรื่องกับ "ยังไม่รู้"
  const money = (v: number) => (dealerPerf.ready ? fmtBaht(v) : "—");
  const targets = useRepoValue<HQTargets>(() => settingsRepo.getTargets(), DEFAULT_HQ_TARGETS);

  const netQuotes = useNetworkQuotations();
  const netLeads = useNetworkLeads();
  const netCustomers = useNetworkCustomers();
  const { appointments } = useSales();

  // ไฟล์แนบ — ใช้เฉพาะใน Drawer (ผูกกับลีดด้วย recordId = numId)
  const [dealerFiles, setDealerFiles] = useState<DealerFile[]>([]);
  // request token กันผลลัพธ์เก่าทับใหม่ — read ถูกยิงซ้ำได้ทุกครั้งที่มีการอัปโหลด/ลบไฟล์ทั้งเครือ
  const dealerFilesReqRef = useRef(0);
  useEffect(() => {
    const read = () => {
      const myReq = ++dealerFilesReqRef.current;
      filesRepo.list({ isHQ: true }).then(r => { if (dealerFilesReqRef.current === myReq) setDealerFiles(r); }).catch(e => logRepoRead("files.list", e)); // HQ เห็นไฟล์ทั้งเครือ
    };
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
      (salesSel === ALL || (SALES_BANDS.find(b => b.v === salesSel)?.hit(perfOf(d.code).revenue) ?? true)) &&
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

  // filter(Boolean) จำเป็น ไม่ใช่กันไว้เฉย ๆ — ตัวแทนที่บันทึกไว้ก่อนมีฟิลด์ province/region จะได้ค่า undefined
  // กลายเป็น <option> ที่เลือกแล้วกรองอะไรไม่ได้ + React เตือน "unique key" (key={undefined})
  const regionOpts = useMemo(() => [...new Set(allDealers.map(d => d.region).filter(Boolean))].sort(), [allDealers]);
  const provOpts = useMemo(() => [...new Set(allDealers.map(d => d.province).filter(Boolean))].sort(), [allDealers]);
  // ตัวเลือกประเภทอาคาร — product_line ทั้งหมดในเครือ · supabase: hq_quotations_summary(ว่าง).byProduct · local: netQuotes
  const allProdSummary = useHQQuotationsSummary(EMPTY_QF);
  const btOpts = useMemo(() => (allProdSummary
    ? allProdSummary.byProduct.map(p => p.product ?? "").filter(Boolean)
    : [...new Set(netQuotes.map(x => x.productLine).filter(Boolean))]).sort(), [allProdSummary, netQuotes]);

  // สถิติใบรายตัวแทน "หลังกรอง" ที่ DB (M9 Phase 2) — supabase · local/ยังไม่กลับ = client จาก quotes
  // ตัวกรอง = ชุดเดียวกับ quotes: dealerCodes (codes ที่ผ่านตัวกรอง) · productLines (btSel) · ช่วงเวลา
  const qSummary = useHQQuotationsSummary(useMemo(() => ({
    dealerCodes: [...codes], productLines: btSel !== ALL ? [btSel] : undefined,
    dateStart: isoDateOf(timeRange.start), dateEnd: isoDateOf(timeRange.end), asOf: isoDateOf(APP_NOW),
  }), [codes, btSel, timeRange.start, timeRange.end]));
  const byDealer = useMemo(() => qSummary ? new Map(qSummary.byDealer.map(d => [d.dealerCode, d])) : null, [qSummary]);
  // ลีดรายสาขา (leads/quoted) ที่ DB — ตัวกรองชุดเดียวกับ leads (codes + product · ไม่กรองเวลา)
  const leadSum = useLeadSummary(useMemo(() => ({ dealerCodes: [...codes], product: btSel !== ALL ? btSel : undefined }), [codes, btSel]));
  const leadByDealer = useMemo(() => leadSum ? new Map(leadSum.byDealer.map(d => [d.dealerCode, d])) : null, [leadSum]);

  // ── สถิติรายตัวแทน — แหล่งเดียวของทุกกราฟ/ตาราง (คำนวณครั้งเดียว) ──
  const perf = useMemo(() => dealers.map(d => {
    const dq = quotes.filter(x => x.dealerCode === d.code);
    const dl = leads.filter(l => l.dealerCode === d.code);
    const lbd = leadByDealer?.get(d.code);
    // นับ/รวมยอด: supabase = จาก byDealer (parity) · ไม่มี = client จาก dq
    const a = byDealer?.get(d.code);
    // ใบเสนอราคาล่าสุด: supabase = byDealer.latest (ISO) · fallback = client dq
    let latestStr = "—";
    if (a) {
      if (a.latest) { const p = a.latest.split("-").map(Number); latestStr = `${p[2]} ${TH_ABBR[p[1] - 1]} ${p[0] + 543}`; }
    } else {
      const latest = dq.map(x => parseThaiDate(x.createdAt)).filter(Boolean).sort((x, y) => +y! - +x!)[0] ?? null;
      if (latest) latestStr = `${latest.getDate()} ${TH_ABBR[latest.getMonth()]} ${latest.getFullYear() + 543}`;
    }
    const quotesN = a ? a.count : dq.length;
    const quoteVal = a ? a.value : dq.reduce((s, x) => s + x.valueNum, 0);
    const wonCount = a ? a.won : dq.filter(x => x.status === "won").length;
    const lostCount = a ? a.lost : dq.filter(x => x.status === "lost").length;
    const wonVal = a ? a.wonVal : dq.filter(x => x.status === "won").reduce((s, x) => s + x.valueNum, 0);
    const closed = wonCount + lostCount;
    return {
      ...d,
      leads: lbd ? lbd.leads : dl.length,
      quoted: lbd ? lbd.quoted : dl.filter(l => QUOTED_UP.includes(l.status)).length,
      quotes: quotesN,
      quoteVal,
      wonCount,
      lostCount,   // ปฏิเสธจริงเท่านั้น — ไม่ใช่ "ใบทั้งหมด − ปิดได้"
      wonVal,
      conv: closed ? Math.round(wonCount / closed * 100) : null,
      revenueActual: perfOf(d.code).revenue,
      tpct: d.revenueTarget > 0 ? Math.round(perfOf(d.code).revenue / d.revenueTarget * 100) : 0,
      latest: latestStr,
    };
  }).sort((a, b) => b.revenueActual - a.revenueActual), [dealers, quotes, leads, byDealer, leadByDealer]);

  // ── Executive KPI (4 การ์ด — ตัด Forecast ออก ไม่มีข้อมูล · ตัด "ตัวแทนยอดขายสูงสุด" ตามคำสั่ง) ──
  const kpi = useMemo(() => {
    // รวมจาก perf (มาจาก byDealer ที่ DB เมื่อพร้อม · client เมื่อ fallback) — ชุดเดียวกับตาราง/กราฟ
    const wonCount = perf.reduce((s, d) => s + d.wonCount, 0), lostCount = perf.reduce((s, d) => s + d.lostCount, 0);
    const closed = wonCount + lostCount;
    const actual = dealers.reduce((s, d) => s + perfOf(d.code).revenue, 0);
    // เป้าทั้งเครือใช้ค่าที่ HQ ตั้งไว้ · แต่ถ้ากรองเหลือบางตัวแทน ต้องรวมเป้าเฉพาะรายนั้น ไม่งั้น % ผิด
    const filtered = dealers.length !== allDealers.length;
    const target = filtered ? dealers.reduce((s, d) => s + d.revenueTarget, 0) : targets.annualTarget;
    return {
      wonVal: perf.reduce((s, d) => s + d.wonVal, 0), wonCount,
      quotes: perf.reduce((s, d) => s + d.quotes, 0), quoteVal: perf.reduce((s, d) => s + d.quoteVal, 0),
      conv: closed ? Math.round(wonCount / closed * 100) : null,
      actual, target, tpct: target > 0 ? Math.round(actual / target * 100) : 0, filtered,
    };
  }, [perf, dealers, allDealers.length, targets.annualTarget]);

  // ── Section 1 · ลูกค้าเป้าหมาย เทียบ ใบเสนอราคา — สลับมุมมองได้ 4 แบบ ──
  // "อัตราแปลง" ที่เคยต่อท้ายแต่ละแถวถูกตัดออก (บอสสั่ง 17 ก.ค. 69) — มันคิดจากสถานะลีด
  // (ถึงขั้นเสนอราคาขึ้นไป ÷ ลีดทั้งหมด) ไม่ใช่เลขคู่ "ลีด / ใบ" ที่โชว์อยู่ข้างหน้า คนอ่านเลยตีความผิด
  // และ seed วนสถานะเท่า ๆ กันจนได้ 50% แทบทุกแถว ไม่มีสาระให้เทียบ
  const leadVsQuote = useMemo(() => {
    const useRpc = leadSum && qSummary; // ลีด (leadSum, all-time) + ใบ (qSummary, ในช่วง) ที่ DB · ไม่งั้น client
    if (view === "month") {
      const lM = new Map<string, number>(), qM = new Map<string, number>();
      if (useRpc) {
        leadSum.byMonth.forEach(r => lM.set(`${r.y}-${r.m}`, r.created));
        qSummary.byMonth.forEach(r => qM.set(`${r.y}-${r.m}`, r.quotes));
      } else {
        const mk = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
        leads.forEach(l => { const d = parseThaiDate(l.createdAt ?? ""); if (!d) return; lM.set(mk(d), (lM.get(mk(d)) ?? 0) + 1); });
        quotes.forEach(x => { const d = parseThaiDate(x.createdAt); if (!d) return; qM.set(mk(d), (qM.get(mk(d)) ?? 0) + 1); });
      }
      const out: { key: string; label: string; a: number; b: number }[] = [];
      const cur = new Date(timeRange.start.getFullYear(), timeRange.start.getMonth(), 1);
      const end = new Date(timeRange.end.getFullYear(), timeRange.end.getMonth(), 1);
      while (cur <= end) {
        const k = `${cur.getFullYear()}-${cur.getMonth()}`;
        out.push({ key: k, label: TH_ABBR[cur.getMonth()], a: lM.get(k) ?? 0, b: qM.get(k) ?? 0 });
        cur.setMonth(cur.getMonth() + 1);
      }
      return out;
    }
    const keyOf = (code: string) => view === "dealer" ? code
      : view === "region" ? (DEALER_META.get(code)?.region ?? "—")
      : (DEALER_META.get(code)?.province ?? "—");
    const m = new Map<string, { a: number; b: number }>();
    const add = (k: string, f: "a" | "b", n: number) => { const r = m.get(k) ?? { a: 0, b: 0 }; r[f] += n; m.set(k, r); };
    if (useRpc) {
      leadSum.byDealer.forEach(d => add(keyOf(d.dealerCode), "a", d.leads));
      qSummary.byDealer.forEach(d => add(keyOf(d.dealerCode), "b", d.count));
    } else {
      leads.forEach(l => add(keyOf(l.dealerCode ?? ""), "a", 1));
      quotes.forEach(x => add(keyOf(x.dealerCode), "b", 1));
    }
    return [...m.entries()].map(([k, v]) => ({
      key: k, a: v.a, b: v.b,
      label: view === "dealer" ? `${k} – ${DEALER_META.get(k)?.name ?? k}` : view === "region" ? regionDisplay(k) : k,
      onClick: view === "dealer" ? () => router.push(`/hq/dealers/${k}`) : undefined,
    })).sort((x, y) => y.a - x.a);
  }, [view, leadSum, qSummary, leads, quotes, DEALER_META, timeRange, router]);

  // ── Section 2 · มูลค่าใบเสนอราคา เทียบ ยอดขายจริง (รายตัวแทน) ──
  const quoteVsSales = useMemo(() => perf.map(d => ({
    key: d.code, label: `${d.code} – ${d.name}`, a: d.quoteVal, b: d.wonVal,
    // สัดส่วน "มูลค่า" ไม่ใช่ "จำนวนใบ" — คนละตัวกับ "อัตราปิดการขาย" ที่นับใบ ต้องกำกับหน่วยไว้ ไม่งั้นอ่านว่าขัดกัน
    note: d.quoteVal ? `ปิดได้ ${Math.round(d.wonVal / d.quoteVal * 100)}% ของมูลค่า` : undefined,
    onClick: () => router.push(`/hq/dealers/${d.code}`),
  })).sort((a, b) => b.a - a.a), [perf, router]);

  // ── Section 2b · วิเคราะห์ประสิทธิภาพการปิดการขายของตัวแทน ──
  // แท่งคู่ทุกตัวแทน: ออกใบกี่ใบ เทียบ ปิดได้กี่ใบ · เรียงออกใบมาก→น้อย
  // "ยังไม่รู้ผล" ต้องแยกออกมาเสมอ ไม่ยุบเข้า "ปิดไม่ได้" (ดูเหตุผลในคอมเมนต์ของคอมโพเนนต์)
  const quotePerf = useMemo(
    () => perf
      .filter(d => d.quotes > 0)  // ไม่มีใบเลย = ไม่มีอะไรให้วัด
      .map(d => ({
        code: d.code, name: d.name,
        quotes: d.quotes, won: d.wonCount, lost: d.lostCount,
        pending: d.quotes - d.wonCount - d.lostCount,
        conv: d.conv,
      }))
      .sort((a, b) => b.quotes - a.quotes || b.won - a.won),
    [perf],
  );

  // ── Section 3 · เป้าหมายทั้งปี เทียบ ยอดขายจริง — สลับกลุ่มได้ ──
  const [tgView, setTgView] = useState<"dealer" | "region" | "province">("dealer");
  const targetVsActual = useMemo(() => {
    const keyOf = (d: DealerRow) => tgView === "dealer" ? d.code : tgView === "region" ? d.region : d.province;
    const m = new Map<string, { a: number; b: number }>();
    dealers.forEach(d => {
      const k = keyOf(d);
      const r = m.get(k) ?? { a: 0, b: 0 };
      r.a += perfOf(d.code).revenue; r.b += d.revenueTarget;
      m.set(k, r);
    });
    return [...m.entries()].map(([k, v]) => ({
      key: k, a: v.a, b: v.b,
      label: tgView === "dealer" ? `${k} – ${DEALER_META.get(k)?.name ?? k}` : tgView === "region" ? regionDisplay(k) : k,
      note: v.b ? `${Math.round(v.a / v.b * 100)}% ของเป้า` : undefined,
      onClick: tgView === "dealer" ? () => router.push(`/hq/dealers/${k}`) : undefined,
    })).sort((x, y) => y.a - x.a);
  }, [tgView, dealers, DEALER_META, router]);

  // เดิมมี regional / lostReasons / trend สำหรับกราฟ 4 ใบที่ถูกตัดออก (ข้อมูลซ้ำกับหน้าอื่น) — ลบทิ้งพร้อมกัน

  // ── Drawer (View) — เจาะรายตัวแทน ไม่เปลี่ยนหน้า ──
  const [drawer, setDrawer] = useState<typeof perf[number] | null>(null);
  // ข้อมูลรายสาขาใน drawer — supabase: ดึงตรงจาก repo (M9 Phase 4) · local/ยังไม่กลับ: กรอง array เดิม
  const drawerData = useDealerDrawerData(drawer?.code ?? null);
  const anyFilter = q.trim() !== "" || [dealerSel, regionSel, provSel, btSel, salesSel].some(v => v !== ALL);

  const kNum: React.CSSProperties = { fontSize: "1.15rem", fontWeight: 800, color: "#1F2937", lineHeight: 1.15, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.015em", whiteSpace: "nowrap" };
  const kSub: React.CSSProperties = { fontSize: "0.72rem", color: MUTED };
  const kpiCards = [
    { label: "ยอดขายจริง (ในช่วง)", value: fmtBaht(kpi.wonVal), sub: `${kpi.wonCount} ดีล · จากใบเสนอราคาที่ปิดได้`, Icon: Trophy, color: "#059669", bg: "#E6F6EF" },
    { label: "มูลค่าใบเสนอราคา", value: fmtBaht(kpi.quoteVal), sub: `${kpi.quotes} ใบ · ในช่วงที่เลือก`, Icon: FileText, color: "#0891B2", bg: "#E6F4F9" },
    { label: "อัตราปิดการขาย", value: kpi.conv === null ? "—" : `${kpi.conv}%`, sub: "ตอบรับ ÷ (ตอบรับ + ปฏิเสธ)", Icon: Percent, color: "#7C3AED", bg: "#F0EBFB" },
    { label: "เป้าหมายทั้งปี", value: dealerPerf.ready ? `${kpi.tpct}%` : "—", sub: `ยอดสะสม ${money(kpi.actual)} จาก ${fmtBaht(kpi.target)}`, Icon: Target, color: "#2563EB", bg: "#E8F0FE" },
  ];

  const sel = (v: string, on: (x: string) => void, caption: string, opts: { v: string; l: string }[]) => (
    <select aria-label={caption} value={v} onChange={e => on(e.target.value)} className="form-input"
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
      <div className="card hq-sticky-filter" style={{ marginBottom: "1.25rem" }}>
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
        </div>
      </div>

      {/* ── แถว 1 · วิเคราะห์ประสิทธิภาพการปิดการขายของตัวแทน — เต็มความกว้าง ──
          คำถามหลักของหน้า "ใครออกใบเยอะแต่ปิดได้น้อย" จึงขึ้นก่อนเพื่อน
          แท่งคู่ 10 ตัวแทน · ตัวเลขชุดเดียวกันอยู่ในตารางแถว 3 (แยกการ์ดเพื่อไม่ให้ใบเดียวสูง 1,010px) */}
      <DealerQuotationPerformance rows={quotePerf} />

      {/* ── แถว 2 · เปรียบเทียบรายตัวแทน: ลีด→ใบเสนอราคา | มูลค่า→ยอดขายจริง ──
          สองใบนี้เป็นแท่งคู่รายตัวแทนเหมือนกันและสูงพอ ๆ กัน จับคู่ไว้แถวเดียว
          (เดิมทั้งหน้าเป็นการ์ดเต็มความกว้าง 8 ใบเรียงซ้อนกัน ยาว 4,800px) */}
      <div className="hq-dealer-charts" style={{ marginBottom: "1.25rem", alignItems: "stretch" }}>
      <div className="card chart-m" style={{ marginBottom: 0 }}>
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
      <div className="card chart-m" style={{ marginBottom: 0 }}>
        <div className="card-header">
          <div className="card-title">มูลค่าใบเสนอราคา เทียบ ยอดขายจริง · รายตัวแทน</div>
          <span style={{ fontSize: "0.62rem", color: MUTED }}>ในช่วงที่เลือก · คลิกเพื่อเจาะรายตัวแทน</span>
        </div>
        <HBars rows={quoteVsSales} aLabel="มูลค่าใบเสนอราคา" bLabel="ยอดขายจริง" aColor="#0891b2" bColor="#059669" fmt={fmtBaht} />
      </div>
      </div>

      {/* ── แถว 3 · ตัวเลขการปิดการขาย (ตารางของกราฟแถว 1) | เป้าหมายทั้งปี เทียบ ยอดขายจริง ──
          โดนัท "เหตุผลที่เสียโอกาสการขาย" ที่เคยอยู่แถวนี้ถูกตัดออก — ซ้ำกับ /hq/leads และ /hq/quotations */}
      <div className="hq-dealer-charts" style={{ marginBottom: "1.25rem", alignItems: "stretch" }}>
      <DealerQuotationTable rows={quotePerf} avgConv={kpi.conv} />

      {/* ไม่ใช้ chart-l (ล็อกสูง 420px ตายตัว) — การ์ดคู่กันเป็นตารางที่สูงตามจำนวนตัวแทน
          ความสูงตายตัวชนะ align-items: stretch เสมอ → การ์ดขวาเตี้ยกว่า เหลือช่องว่างใต้การ์ด
          ยืดเองด้วย flex column แทน แล้วปล่อยให้ .chart-scroll ข้างในกินที่ที่เหลือ */}
      <div className="card" style={{ marginBottom: 0, display: "flex", flexDirection: "column" }}>
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
      </div>

      {/* กราฟที่ถูกตัดออกจากหน้านี้ (ข้อมูลซ้ำ — ดูที่เจ้าของเรื่องแทน):
          · เหตุผลที่เสียโอกาสการขาย → /hq/leads และ /hq/quotations
          · เทียบรายภูมิภาค          → /hq/quotations
          · แนวโน้มจำนวนรายการ/ยอดขาย → แดชบอร์ด HQ (SalesTrendChart + ลีด·ใบเสนอราคา·ปิดการขาย รายเดือน) */}
      {/* ── PERFORMANCE TABLE — ตารางเต็มท้ายหน้าตามเดิม (ตามที่บอสสั่ง ไม่แยกแท็บ) ── */}
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
                <th style={{ textAlign: "right" }} title="ปิดได้ ÷ (ปิดได้ + ปิดไม่ได้) — นับเฉพาะใบที่รู้ผลแล้ว · คนละสูตรกับ “อัตราปิดการขาย” ที่หน้าใบเสนอราคาทั้งเครือ">อัตราปิด</th>
                <th style={{ textAlign: "right" }}>เป้าทั้งปี</th>
                <th style={{ textAlign: "right" }}>% เป้า</th>
                <th>ใบเสนอราคาล่าสุด</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {!perf.length && <tr><td colSpan={12} style={{ padding: 32, textAlign: "center", fontSize: "0.8rem", color: "#9ca3af" }}>ไม่พบตัวแทนที่ตรงกับตัวกรอง</td></tr>}
              {perf.map(d => (
                <ClickableRow key={d.code} className="clickable" onActivate={() => setDrawer(d)} label={`เปิดรายละเอียดตัวแทน ${d.name}`}>
                  <td style={{ fontFamily: "monospace", fontWeight: 700, color: PRIMARY }}>{d.code}</td>
                  <td style={{ fontWeight: 600, color: "#1F2937", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {d.name}
                    {d.status === "inactive" && <span style={{ marginLeft: 6, fontSize: "0.62rem", fontWeight: 700, color: MUTED }}>(ปิดใช้งาน)</span>}
                  </td>
                  <td style={{ color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{regionDisplay(d.region)}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{d.leads}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{d.quotes}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtBaht(d.quoteVal)}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 800, color: "#1F2937" }}>{money(d.revenueActual)}</td>
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
                </ClickableRow>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── DRAWER — เจาะรายตัวแทน (อ่านอย่างเดียว ไม่มีแก้/ลบ) ── */}
      {drawer && <DealerDrawer d={drawer} onClose={() => setDrawer(null)}
        customers={drawerData ? drawerData.customers : netCustomers.filter(c => c.dealerCode === drawer.code)}
        leads={drawerData ? drawerData.leads : netLeads.filter(l => l.dealerCode === drawer.code)}
        quotes={drawerData ? drawerData.quotes : netQuotes.filter(x => x.dealerCode === drawer.code)}
        appointments={drawerData ? drawerData.appointments : appointments} files={dealerFiles} onOpenDealer={() => router.push(`/hq/dealers/${drawer.code}`)} />}
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
