"use client";

// ─── HQ · ลูกค้าเป้าหมายทั้งเครือ (Network Leads) ──────────────────────────────
// ภาพรวมลีดของทุกตัวแทน · กรอง (ค้นหา/สถานะ/จังหวัด/ช่วงเวลา) · KPI · กราฟ · ตาราง drill-down
// ใช้ข้อมูลจริงจาก SalesContext (leads) — HQ ดูอย่างเดียว (Sales CRM เท่านั้น)
import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Users, PhoneCall, AlarmClock, Percent, Search, X, ChevronRight, MapPin, GitBranch, Eye } from "lucide-react";
import { useNetworkLeads, useNetworkQuotations } from "@/lib/useNetworkData";
import { useHQLeadRules } from "@/lib/useHQRules";
import { unassignedLeads } from "@/lib/hqAlerts";
import { dealerLeaderboard, fmtISOToThai, type LeadRow } from "@/lib/mock";
import { regionDisplay } from "@/lib/hqQuotations";  // แหล่งเดียวของชื่อภาค — ไม่ก็อปโค้ดซ้ำ
import { ExportMenu } from "@/components/ui/ExportMenu";
import { useSales } from "@/context/SalesContext";
import { loadDealerFiles, DEALER_FILES_EVENT, type DealerFile } from "@/lib/mock";
import { useFilters } from "@/context/FilterContext";
import { FilterBar } from "@/components/filters/FilterBar";
import { MultiLineChart, Donut } from "@/components/ui/Charts";
import { EmptyState } from "@/components/ui/EmptyState";
import { leadStatusLabel, leadStatusColor, type LeadStatus } from "@/lib/mock";
import { parseBaht, fmtBaht } from "@/lib/format";

const PRIMARY = "#003366";
// 8 สี — โดนัท "ตามแหล่งที่มา" มีได้ถึง 8 ชิ้น ถ้าสีวนซ้ำจะอ่านผิดว่าเป็นชิ้นเดียวกัน
const RAMP = ["#003366", "#0891b2", "#059669", "#d97706", "#7c3aed", "#dc2626", "#0f766e", "#b45309"];
// โทนแดง-ส้ม สำหรับ "เหตุผลที่ปิดการขายไม่สำเร็จ" — คงความหมายเดิม (แท่งเคยเป็นสีแดงทั้งหมด)
const LOST_RAMP = ["#dc2626", "#ea580c", "#d97706", "#b45309", "#9f1239", "#7c2d12"];
const TH_MONTH: Record<string, number> = { "ม.ค.": 0, "ก.พ.": 1, "มี.ค.": 2, "เม.ย.": 3, "พ.ค.": 4, "มิ.ย.": 5, "ก.ค.": 6, "ส.ค.": 7, "ก.ย.": 8, "ต.ค.": 9, "พ.ย.": 10, "ธ.ค.": 11 };
const TH_ABBR = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const parseThaiDate = (s: string): Date | null => {
  const mt = /^(\d{1,2})\s+(\S+)\s+(\d{4})/.exec((s ?? "").trim());
  if (!mt || !(mt[2] in TH_MONTH)) return null;
  const y = +mt[3] > 2500 ? +mt[3] - 543 : +mt[3];
  return new Date(y, TH_MONTH[mt[2]], +mt[1]);
};
const ACTIVE: LeadStatus[] = ["WAITING", "BULLET", "QUOTED", "FOLLOWUP", "NEGO"];
const NEED_FOLLOWUP: LeadStatus[] = ["WAITING", "FOLLOWUP"]; // ยังไม่ติดตาม (กฎ 7 วัน HQ)

export default function HQLeadsPage() {
  const router = useRouter();
  const { timeRange } = useFilters();
  const leads = useNetworkLeads();
  const { unassignedAlertHours } = useHQLeadRules(); // เกณฑ์จากกฎธุรกิจ (/hq/settings → กฎธุรกิจ)
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<LeadStatus | "ALL">("ALL");
  const [province, setProvince] = useState<string>("ALL");
  const [viewLead, setViewLead] = useState<LeadRow | null>(null);  // Drawer — ดูอย่างเดียว
  const [dealerSel, setDealerSel] = useState<string>("ALL");
  const [regionSel, setRegionSel] = useState<string>("ALL");
  const [btSel, setBtSel] = useState<string>("ALL");
  const [srcSel, setSrcSel] = useState<string>("ALL");

  // ลีดในช่วงเวลาที่เลือก (ตาม createdAt) — แหล่งเดียวของทั้งหน้า
  const scoped = useMemo(() => leads.filter(l => {
    const d = parseThaiDate(l.createdAt ?? "");
    return !d || (d >= timeRange.start && d <= timeRange.end);
  }), [leads, timeRange.start, timeRange.end]);

  // นัดหมาย + ไฟล์ — ใช้แสดงใน Drawer เท่านั้น (HQ ดูอย่างเดียว)
  // นัดหมายผูกด้วย leadId · ไฟล์ผูกด้วย source="lead" + recordId — ทั้งคู่คือ numId ของลีด
  const { appointments } = useSales();
  const [dealerFiles, setDealerFiles] = useState<DealerFile[]>([]);
  useEffect(() => {
    const read = () => setDealerFiles(loadDealerFiles());
    read();
    window.addEventListener(DEALER_FILES_EVENT, read);
    return () => window.removeEventListener(DEALER_FILES_EVENT, read);
  }, []);

  // ภาคของตัวแทน — ใช้ทั้งตัวกรองภาคและ Section 6 (แหล่งเดียว ไม่คำนวณซ้ำ)
  const REGION_OF = useMemo(() => new Map(dealerLeaderboard.map(d => [d.code, d.region])), []);

  // ตัวเลือกตัวกรอง — สร้างจากลีดจริงที่มีในช่วง ไม่ hardcode
  const dealerOpts = useMemo(() => [...new Set(scoped.map(l => l.dealerCode).filter(Boolean))].sort() as string[], [scoped]);
  const regionOpts = useMemo(() => [...new Set(scoped.map(l => REGION_OF.get(l.dealerCode ?? "")).filter(Boolean))].sort() as string[], [scoped, REGION_OF]);
  const btOpts = useMemo(() => [...new Set(scoped.map(l => l.product).filter(Boolean))].sort((a, b) => a.localeCompare(b, "th")), [scoped]);
  const srcOpts = useMemo(() => [...new Set(scoped.map(l => l.source || "ไม่ระบุ"))].sort((a, b) => a.localeCompare(b, "th")), [scoped]);

  // ── เตือน: ลีดยังไม่มีผู้รับผิดชอบนานเกินเกณฑ์ (กฎธุรกิจ HQ · ค่าเริ่มต้น 48 ชม.) ──
  // ตอนนี้ลีดทุกใบมีผู้รับผิดชอบ → ขึ้น 0 ซึ่งเป็นความจริง
  // ตรรกะพร้อมใช้: พอมีลีดที่ assigned ว่างนานเกินเกณฑ์เมื่อไร การ์ดจะเด้งเอง
  const unassigned = useMemo(() => unassignedLeads(scoped, unassignedAlertHours), [scoped, unassignedAlertHours]);

  const provinces = useMemo(() => [...new Set(scoped.map(l => l.province).filter(Boolean))].sort(), [scoped]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scoped.filter(l =>
      (status === "ALL" || l.status === status) &&
      (province === "ALL" || l.province === province) &&
      (dealerSel === "ALL" || l.dealerCode === dealerSel) &&
      (regionSel === "ALL" || REGION_OF.get(l.dealerCode ?? "") === regionSel) &&
      (btSel === "ALL" || l.product === btSel) &&
      (srcSel === "ALL" || (l.source || "ไม่ระบุ") === srcSel) &&
      (!q || (l.company + l.contact + l.province + l.product + l.assigned + (l.id ?? "") + (l.dealerCode ?? "")).toLowerCase().includes(q))
    );
  }, [scoped, query, status, province, dealerSel, regionSel, btSel, srcSel]);

  // KPI
  const kpis = useMemo(() => {
    const total = scoped.length;
    const won = scoped.filter(l => l.status === "PAID").length;
    const lost = scoped.filter(l => l.status === "CANCELLED").length;
    const closed = won + lost;
    const followUp = scoped.filter(l => NEED_FOLLOWUP.includes(l.status)).length;
    const lastM = timeRange.end.getMonth();
    const newThis = scoped.filter(l => { const d = parseThaiDate(l.createdAt ?? ""); return d && d.getMonth() === lastM; }).length;
    return { total, followUp, newThis, conv: closed ? Math.round(won / closed * 100) : 0 };
  }, [scoped, timeRange.end]);

  // ── Section 1 · ลีด เทียบ ใบเสนอราคา รายตัวแทน ─────────────────────────────
  // สาขาไหนรับลีดเยอะแต่ออกใบเสนอราคาน้อย = จุดที่ผู้บริหารต้องเร่ง
  //
  // อัตราแปลง = ลีดที่ไปถึงขั้น "เสนอราคา" ขึ้นไป ÷ ลีดทั้งหมด
  // ตั้งใจไม่ใช้ "จำนวนใบเสนอราคา ÷ จำนวนลีด" เพราะผิดความจริง 2 ทาง:
  //   1) ลีด 1 ใบออกใบเสนอราคาได้หลายใบ (revision/เสนอใหม่) → หารแล้วเกิน 100% ได้
  //   2) ใบเสนอราคา seed ของสาขาอื่นไม่ได้ผูกกับลีด → เอามาหารกันคนละชุดข้อมูล
  // สถานะของลีดบอกเองว่าเคยเสนอราคาแล้วหรือยัง — ใช้แหล่งเดียว ไม่มีทางเกิน 100%
  const netQuotes = useNetworkQuotations();
  const DEALER_NAME = useMemo(() => new Map(dealerLeaderboard.map(d => [d.code, d.name])), []);
  const leadVsQuote = useMemo(() => {
    const QUOTED_UP: LeadStatus[] = ["QUOTED", "FOLLOWUP", "NEGO", "PAID"];
    const m = new Map<string, { leads: number; quoted: number; quotes: number }>();
    const at = (c: string) => m.get(c) ?? (m.set(c, { leads: 0, quoted: 0, quotes: 0 }), m.get(c)!);
    scoped.forEach(l => {
      const r = at(l.dealerCode || "—");
      r.leads++;
      if (QUOTED_UP.includes(l.status)) r.quoted++;
    });
    // จำนวนใบเสนอราคาที่ออกจริงในช่วง (แสดงคู่กันเพื่อดูปริมาณงาน — ไม่เอาไปหารเป็น %)
    netQuotes.forEach(q => {
      const d = parseThaiDate(q.createdAt ?? "");
      if (d && (d < timeRange.start || d > timeRange.end)) return;
      at(q.dealerCode).quotes++;
    });
    const arr = [...m.entries()].map(([code, v]) => ({
      code, name: DEALER_NAME.get(code) ?? code,
      leads: v.leads, quotes: v.quotes,
      conv: v.leads > 0 ? Math.round(v.quoted / v.leads * 100) : null,  // ไม่มีลีด = คำนวณไม่ได้ ไม่ใส่ 0%
    })).sort((a, b) => b.leads - a.leads);
    const max = Math.max(1, ...arr.flatMap(a => [a.leads, a.quotes]));
    return arr.map(a => ({ ...a, lPct: Math.round(a.leads / max * 100), qPct: Math.round(a.quotes / max * 100) }));
  }, [scoped, netQuotes, timeRange.start, timeRange.end, DEALER_NAME]);
  const kpiCards = [
    { label: "ลูกค้าเป้าหมายทั้งหมด", value: `${kpis.total}`, sub: "ทั้งเครือ", Icon: Users, color: "#2563a8", on: status === "ALL", onClick: () => setStatus("ALL") },
    { label: "ลีดใหม่ (เดือนนี้)", value: `${kpis.newThis}`, sub: "รายการ", Icon: PhoneCall, color: "#7c3aed", on: false, onClick: () => setStatus("ALL") },
    { label: "ยังไม่ติดตาม (>7 วัน)", value: `${kpis.followUp}`, sub: "ต้องติดตามด่วน", Icon: AlarmClock, color: "#EA580C", on: status === "FOLLOWUP", onClick: () => setStatus(status === "FOLLOWUP" ? "ALL" : "FOLLOWUP") },
    { label: "อัตราแปลงเป็นลูกค้า", value: `${kpis.conv}%`, sub: "ปิดได้ / ปิดทั้งหมด", Icon: Percent, color: "#059669", on: false, onClick: () => setStatus("ALL") },
  ];

  // ── Section 7 · แนวโน้มรายเดือน — 4 เส้น: ลีดใหม่ · ใบเสนอราคา · ปิดได้ · ปิดไม่สำเร็จ ──
  // ลีดนับตามเดือนที่สร้าง · ใบเสนอราคานับตามเดือนที่ออก (คนละแหล่ง จับคู่ด้วยเดือน)
  // ช่วงเดือนตัดตามตัวกรองเวลา — ไม่ฟิกซ์ 12 เดือน เพราะระบบมีข้อมูลปี 2569 ปีเดียว
  const trend = useMemo(() => {
    const newM = Array(12).fill(0), wonM = Array(12).fill(0), lostM = Array(12).fill(0), quoteM = Array(12).fill(0);
    scoped.forEach(l => {
      const d = parseThaiDate(l.createdAt ?? ""); if (!d) return;
      newM[d.getMonth()]++;
      if (l.status === "PAID") wonM[d.getMonth()]++;
      if (l.status === "CANCELLED") lostM[d.getMonth()]++;
    });
    netQuotes.forEach(q => {
      const d = parseThaiDate(q.createdAt ?? ""); if (!d) return;
      quoteM[d.getMonth()]++;
    });
    const a = timeRange.start.getMonth(), b = timeRange.end.getMonth();
    const cut = (arr: number[]) => arr.slice(a, b + 1);
    return { months: TH_ABBR.slice(a, b + 1), newM: cut(newM), wonM: cut(wonM), lostM: cut(lostM), quoteM: cut(quoteM) };
  }, [scoped, netQuotes, timeRange]);

  // ลีดตามแหล่งที่มา + ตามสถานะ (แท่งแนวนอน)
  const sources = useMemo(() => {
    const m = new Map<string, number>();
    scoped.forEach(l => m.set(l.source || "ไม่ระบุ", (m.get(l.source || "ไม่ระบุ") ?? 0) + 1));
    const arr = [...m.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
    const max = Math.max(...arr.map(a => a.count), 1);
    const total = arr.reduce((s, a) => s + a.count, 0) || 1;
    // pct = เทียบตัวมากสุด (ใช้กับแท่ง) · share = สัดส่วนของทั้งหมด (ใช้กับโดนัท) — คนละความหมาย อย่าสลับ
    return arr.map(a => ({ ...a, pct: Math.round(a.count / max * 100), share: Math.round(a.count / total * 100) }));
  }, [scoped]);

  const byStatus = useMemo(() => {
    const order: LeadStatus[] = ["WAITING", "BULLET", "QUOTED", "FOLLOWUP", "NEGO", "PAID", "CANCELLED"];
    const max = Math.max(...order.map(s => scoped.filter(l => l.status === s).length), 1);
    return order.map(s => ({ status: s, count: scoped.filter(l => l.status === s).length, pct: Math.round(scoped.filter(l => l.status === s).length / max * 100) }));
  }, [scoped]);

  // ── Section 3 · ประเภทอาคารที่ลูกค้าสนใจ ──────────────────────────────────
  // จัดกลุ่มด้วย "แม่แบบที่สนใจ" ของลีด (product) — ใช้ค่าจริงในระบบ ไม่ยุบ/ไม่แปลงชื่อ
  const buildingTypes = useMemo(() => {
    const m = new Map<string, number>();
    scoped.forEach(l => { const k = l.product || "ไม่ระบุ"; m.set(k, (m.get(k) ?? 0) + 1); });
    const arr = [...m.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
    const max = Math.max(...arr.map(a => a.count), 1);
    const total = arr.reduce((s, a) => s + a.count, 0) || 1;
    return arr.map(a => ({ ...a, pct: Math.round(a.count / max * 100), share: Math.round(a.count / total * 100) }));
  }, [scoped]);

  // ── Section 4 · เหตุผลที่ปิดการขายไม่สำเร็จ ────────────────────────────────
  // นับเฉพาะลีดที่ปิดไม่สำเร็จ "และบันทึกเหตุผลไว้จริง" — ไม่เดาเหตุผลให้ลีดที่ไม่ได้ระบุ
  // รายการเหตุผลเป็นของ HQ (ตั้งค่า › เส้นทางการขาย) ใช้ร่วมทุกตัวแทน
  const lostReasons = useMemo(() => {
    const m = new Map<string, number>();
    scoped.filter(l => l.status === "CANCELLED" && l.lostReason)
      .forEach(l => m.set(l.lostReason!, (m.get(l.lostReason!) ?? 0) + 1));
    const arr = [...m.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count);
    const max = Math.max(...arr.map(a => a.count), 1);
    const total = arr.reduce((s, a) => s + a.count, 0) || 1;
    return arr.map(a => ({ ...a, pct: Math.round(a.count / max * 100), share: Math.round(a.count / total * 100) }));
  }, [scoped]);


  // ── Section 5 · ผลงานตัวแทน (Top 10) ─────────────────────────────────────
  // ใช้ leadVsQuote ที่คำนวณไว้แล้ว (แหล่งเดียว ไม่คำนวณซ้ำ) + ยอดขายจากใบที่ตอบรับ
  const dealerPerf = useMemo(() => {
    const sales = new Map<string, number>();
    netQuotes.forEach(q => {
      const d = parseThaiDate(q.createdAt ?? "");
      if (d && (d < timeRange.start || d > timeRange.end)) return;
      if (q.status === "won") sales.set(q.dealerCode, (sales.get(q.dealerCode) ?? 0) + q.valueNum);
    });
    return leadVsQuote
      .map(d => ({ ...d, sales: sales.get(d.code) ?? 0 }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 10);
  }, [leadVsQuote, netQuotes, timeRange.start, timeRange.end]);

  // ── Section 6 · เทียบรายภูมิภาค (แท่งซ้อน: ลีด / ใบเสนอราคา / ปิดการขาย) ──
  // ภาคมาจากข้อมูลตัวแทนจริง (dealerLeaderboard.region) — ไม่เดาภาคจากจังหวัด
  const regions = useMemo(() => {
    const REGION_OF = new Map(dealerLeaderboard.map(d => [d.code, d.region]));
    const m = new Map<string, { leads: number; quotes: number; won: number }>();
    const at = (r: string) => m.get(r) ?? (m.set(r, { leads: 0, quotes: 0, won: 0 }), m.get(r)!);
    scoped.forEach(l => { const r = REGION_OF.get(l.dealerCode ?? ""); if (r) at(r).leads++; });
    netQuotes.forEach(q => {
      const d = parseThaiDate(q.createdAt ?? "");
      if (d && (d < timeRange.start || d > timeRange.end)) return;
      const r = REGION_OF.get(q.dealerCode); if (!r) return;
      at(r).quotes++;
      if (q.status === "won") at(r).won++;
    });
    const arr = [...m.entries()].map(([region, v]) => ({ region, ...v, total: v.leads + v.quotes + v.won }))
      .sort((a, b) => b.total - a.total);
    const max = Math.max(1, ...arr.map(a => a.total));
    return arr.map(a => ({ ...a, max }));
  }, [scoped, netQuotes, timeRange.start, timeRange.end]);

  return (
    <div className="erp">
      <div className="page-head">
        <div>
          <p>ภาพรวมลูกค้าเป้าหมายของทุกตัวแทน · {timeRange.subtitle}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <FilterBar dims={[]} />
          {/* ส่งออก = สิ่งที่เห็นบนจอตอนนี้ (ผ่านตัวกรองทุกตัวแล้ว) · คอลัมน์เรียงตรงกับตาราง */}
          <ExportMenu filename="hq-leads" title="ลูกค้าเป้าหมายทั้งเครือ"
            headers={["รหัสลีด","รหัสตัวแทน","ตัวแทน","ลูกค้า","ผู้ติดต่อ","จังหวัด","ประเภทอาคาร","แหล่งที่มา","มูลค่า","เสนอราคาแล้ว","ติดต่อล่าสุด","เตือน 7 วัน","ผู้รับผิดชอบ","สถานะ"]}
            rows={filtered.map(l => [
              l.id, l.dealerCode ?? "—", DEALER_NAME.get(l.dealerCode ?? "") ?? "—", l.company, l.contact,
              l.province, l.product, l.source || "—", l.value || "—",
              ["QUOTED","FOLLOWUP","NEGO","PAID"].includes(l.status) ? "เสนอแล้ว" : "—",
              l.activities?.length ? l.activities[0].date : "—",
              NEED_FOLLOWUP.includes(l.status) ? "ต้องติดตาม" : "—",
              l.assigned || "—", leadStatusLabel[l.status],
            ])} />
        </div>
      </div>

      {/* KPI */}
      {/* kpi-4 = หน้านี้มี KPI 4 ใบ (ค่าเริ่มต้นของ .dash-kpis คือ 5 คอลัมน์) */}
      <div className="dash-kpis kpi-4" style={{ marginBottom: 16 }}>
        {kpiCards.map(k => (
          <button key={k.label} onClick={k.onClick} className="card" style={{ padding: "16px 14px", display: "flex", flexDirection: "column", gap: 6, textAlign: "left", cursor: "pointer", fontFamily: "inherit", width: "100%", border: k.on ? "1.5px solid #003366" : "1px solid #E5E7EB", boxShadow: k.on ? "0 0 0 3px rgba(0,51,102,.08)" : undefined }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, width: "100%" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "0.72rem", color: "#6B7280" }}>{k.label}</div>
                <div style={{ fontSize: "1.42rem", fontWeight: 800, color: "#1F2937", marginTop: 6, fontVariantNumeric: "tabular-nums" }}>{k.value}</div>
                <div style={{ fontSize: "0.72rem", color: "#6B7280", marginTop: 2 }}>{k.sub}</div>
              </div>
              <span style={{ width: 42, height: 42, borderRadius: 12, background: k.color + "1a", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><k.Icon size={20} color={k.color} strokeWidth={2.1} /></span>
            </div>
          </button>
        ))}
      </div>

      {/* ── เตือน: ลีดยังไม่มีผู้รับผิดชอบเกิน 48 ชม. (กฎ HQ) ──
          อยู่บนสุดใต้ KPI — เป็นเรื่องต้องรีบ ไม่ควรให้ต้องเลื่อนผ่านกราฟ 4 ใบกว่าจะเจอ
          แสดงเฉพาะตอนมีจริง — ไม่มี = ไม่ขึ้นการ์ดเปล่า */}
      {unassigned.length > 0 && (
        <div className="card" style={{ marginBottom: 16, borderLeft: "3px solid #dc2626" }}>
          <div className="card-body" style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px" }}>
            <span style={{ width: 34, height: 34, borderRadius: 9, background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <AlarmClock size={16} color="#dc2626" />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#1F2937" }}>ลูกค้าเป้าหมายยังไม่มีผู้รับผิดชอบ</span>
              <span style={{ display: "block", fontSize: "0.68rem", color: "var(--muted-foreground)", marginTop: 2 }}>ต้องมอบหมายภายใน {unassignedAlertHours} ชั่วโมงตามกฎสำนักงานใหญ่</span>
            </span>
            <span style={{ fontSize: "1.15rem", fontWeight: 800, color: "#dc2626", fontVariantNumeric: "tabular-nums" }}>{unassigned.length}</span>
            <span style={{ fontSize: "0.66rem", color: "var(--muted-foreground)" }}>ราย</span>
          </div>
        </div>
      )}

      {/* ── แถว 1 · ใครทำได้แค่ไหน · ที่ไหน ── ลีด→ใบเสนอราคา รายตัวแทน | เทียบรายภูมิภาค
          จับคู่กราฟแท่งสองใบไว้แถวเดียว — เดิมต่างคนต่างกินเต็มความกว้าง ทำให้หน้ายาวโดยไม่จำเป็น
          stretch = การ์ดสองใบสูงเท่ากัน (ตัวแทน 10 ราย ยาวกว่าภูมิภาค 6 ภาคอยู่แล้ว)
          ถ้าปล่อย start ขอบล่างจะเหลื่อมกันเป็นรอยหยัก */}
      <div className="hq-dealer-charts" style={{ marginBottom: 16, alignItems: "stretch" }}>
      <div className="card" style={{ marginBottom: 0 }}>
        <div className="card-header">
          <div className="card-title">ลูกค้าเป้าหมาย เทียบ ใบเสนอราคา · รายตัวแทน</div>
          <span style={{ display: "flex", alignItems: "center", gap: 12, fontSize: "0.62rem", color: "var(--muted-foreground)" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><i style={{ width: 9, height: 9, borderRadius: 2, background: "#003366", display: "inline-block" }} /> ลีด</span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><i style={{ width: 9, height: 9, borderRadius: 2, background: "#0891b2", display: "inline-block" }} /> ใบเสนอราคา</span>
            <span>· เรียงตามจำนวนลีด</span>
          </span>
        </div>
        <div className="card-body" style={{ paddingTop: 6, display: "flex", flexDirection: "column", gap: 13 }}>
          {!leadVsQuote.length ? (
            <div style={{ fontSize: "0.74rem", color: "var(--muted-foreground)" }}>— ไม่มีข้อมูลในช่วงที่เลือก</div>
          ) : leadVsQuote.map(d => (
            <button key={d.code} onClick={() => router.push(`/hq/dealers/${d.code}`)}
              style={{ border: "none", background: "none", padding: 0, cursor: "pointer", textAlign: "left", fontFamily: "inherit", width: "100%" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: "0.72rem", marginBottom: 5 }}>
                <span style={{ color: "#374151", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</span>
                <span style={{ flexShrink: 0, fontVariantNumeric: "tabular-nums", color: "var(--muted-foreground)" }}>
                  {d.leads} ลีด · {d.quotes} ใบ
                  {d.conv !== null && <span style={{ fontWeight: 800, color: "#003366", marginLeft: 6 }}>{d.conv}%</span>}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <div style={{ height: 7, background: "var(--muted)", borderRadius: 999, overflow: "hidden" }}>
                  <div className="bar-grow" style={{ height: "100%", width: `${d.lPct}%`, background: "#003366", borderRadius: 999 }} />
                </div>
                <div style={{ height: 7, background: "var(--muted)", borderRadius: 999, overflow: "hidden" }}>
                  <div className="bar-grow" style={{ height: "100%", width: `${d.qPct}%`, background: "#0891b2", borderRadius: 999 }} />
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* เทียบรายภูมิภาค (แท่งซ้อน) — ย้ายขึ้นมาคู่กับกราฟรายตัวแทน (เดิมอยู่เดี่ยวเต็มความกว้าง สูงแค่ 320px)
          .card ไม่ได้เป็น flex เอง → ต้องสั่งตรงนี้ card-body ถึงจะยืดเต็มความสูงได้ */}
      <div className="card" style={{ marginBottom: 0, display: "flex", flexDirection: "column" }}>
        <div className="card-header"><div className="card-title">เทียบรายภูมิภาค</div>
          <span style={{ display: "flex", alignItems: "center", gap: 12, fontSize: "0.62rem", color: "var(--muted-foreground)" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><i style={{ width: 9, height: 9, borderRadius: 2, background: "#003366", display: "inline-block" }} /> ลีด</span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><i style={{ width: 9, height: 9, borderRadius: 2, background: "#0891b2", display: "inline-block" }} /> ใบเสนอราคา</span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><i style={{ width: 9, height: 9, borderRadius: 2, background: "#059669", display: "inline-block" }} /> ปิดการขาย</span>
          </span></div>
        {/* ภาคมี 6 แถว แต่การ์ดสูงตามกราฟรายตัวแทน (10 ราย) → เกลี่ยแถวให้เต็มความสูง
            ไม่งั้นเหลือที่ว่างก้อนใหญ่ท้ายการ์ด ดูเหมือนข้อมูลหาย */}
        <div className="card-body" style={{ paddingTop: 6, flex: 1, display: "flex", flexDirection: "column", gap: 12, justifyContent: "space-around" }}>
          {!regions.length ? (
            <div style={{ fontSize: "0.74rem", color: "var(--muted-foreground)" }}>— ไม่มีข้อมูลในช่วงที่เลือก</div>
          ) : regions.map(r => (
            <div key={r.region}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: "0.72rem", marginBottom: 4 }}>
                <span style={{ color: "#374151", fontWeight: 600 }}>{regionDisplay(r.region)}</span>
                <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--muted-foreground)" }}>{r.leads} ลีด · {r.quotes} ใบ · {r.won} ปิดได้</span>
              </div>
              <div style={{ display: "flex", height: 8, borderRadius: 999, overflow: "hidden", background: "var(--muted)" }}>
                <div className="bar-grow" style={{ width: `${r.leads / r.max * 100}%`, background: "#003366" }} />
                <div className="bar-grow" style={{ width: `${r.quotes / r.max * 100}%`, background: "#0891b2" }} />
                <div className="bar-grow" style={{ width: `${r.won / r.max * 100}%`, background: "#059669" }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      </div>

      {/* ── แถว 2 · ลีดสนใจอะไร · ทำไมถึงไม่ปิด ── (stretch: ประเภทอาคารมี 11 แถว เหตุผลมี 6 → ขอบล่างเสมอกัน) */}
      <div className="hq-dealer-charts" style={{ marginBottom: 16, alignItems: "stretch" }}>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header"><div className="card-title">ประเภทอาคารที่สนใจ</div>
            <span style={{ fontSize: "0.62rem", color: "var(--muted-foreground)" }}>แม่แบบที่ลีดสนใจ · หน่วย: ราย</span></div>
          <div className="card-body" style={{ paddingTop: 6, display: "flex", flexDirection: "column", gap: 11 }}>
            {!buildingTypes.length ? (
              <div style={{ fontSize: "0.74rem", color: "var(--muted-foreground)" }}>— ไม่มีข้อมูลในช่วงที่เลือก</div>
            ) : buildingTypes.map(r => (
              <div key={r.label}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: "0.72rem", marginBottom: 4 }}>
                  <span style={{ color: "#374151", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</span>
                  <span style={{ flexShrink: 0, fontVariantNumeric: "tabular-nums", color: "var(--muted-foreground)" }}>
                    {r.count} ราย <span style={{ fontWeight: 800, color: "#003366" }}>{r.share}%</span>
                  </span>
                </div>
                <div style={{ height: 6, background: "var(--muted)", borderRadius: 999, overflow: "hidden" }}>
                  <div className="bar-grow" style={{ height: "100%", width: `${r.pct}%`, background: "#003366", borderRadius: 999 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* โดนัท: เหตุผลรวมกันได้ 100% ของลีดที่ปิดไม่สำเร็จพอดี → เป็นสัดส่วนของก้อนเดียว เหมาะกับโดนัทมากกว่าแท่ง
            (และช่วยให้แถวนี้ไม่ใช่แท่งนอนคู่กับแท่งนอน) */}
        <div className="card" style={{ marginBottom: 0, display: "flex", flexDirection: "column" }}>
          <div className="card-header"><div className="card-title">เหตุผลที่ปิดการขายไม่สำเร็จ</div>
            <span style={{ fontSize: "0.62rem", color: "var(--muted-foreground)" }}>เฉพาะลีดที่บันทึกเหตุผลไว้ · หน่วย: ราย</span></div>
          <div className="card-body" style={{ paddingTop: 6, flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 18 }}>
            {!lostReasons.length ? (
              <div style={{ fontSize: "0.74rem", color: "var(--muted-foreground)" }}>— ไม่มีข้อมูลในช่วงที่เลือก</div>
            ) : (<>
              <Donut
                segments={lostReasons.map((r, i) => ({ label: r.reason, value: r.count, color: LOST_RAMP[i % LOST_RAMP.length] }))}
                centerLabel="ปิดไม่สำเร็จ"
                centerValue={`${lostReasons.reduce((s, r) => s + r.count, 0)}`}
                size={168}
              />
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 9 }}>
                {lostReasons.map((r, i) => (
                  <div key={r.reason} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.72rem" }}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: LOST_RAMP[i % LOST_RAMP.length], flexShrink: 0 }} />
                    <span style={{ flex: 1, color: "#374151", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.reason}</span>
                    <span style={{ fontWeight: 800, color: "#1F2937", fontVariantNumeric: "tabular-nums" }}>{r.count}</span>
                    <span style={{ color: "var(--muted-foreground)", minWidth: 34, textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{r.share}%</span>
                  </div>
                ))}
              </div>
            </>)}
          </div>
        </div>
      </div>

      {/* ── แถว 3 · แนวโน้ม + แหล่งที่มา + สถานะ ── */}
      <div className="hq-row3" style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr", gap: "1.25rem", alignItems: "stretch", marginBottom: 16 }}>
        {/* กราฟเส้นเป็น SVG ที่ย่อ/ขยายตามความกว้างการ์ด → ความสูงจริงไม่เท่า height ที่ส่งเข้าไป
            การ์ดถูกยืดให้สูงเท่าเพื่อนในแถว จึงเหลือที่ว่างท้ายการ์ด ~190px → จัดกึ่งกลางแนวตั้งแทน */}
        <div className="card" style={{ marginBottom: 0, display: "flex", flexDirection: "column" }}>
          <div className="card-header"><div className="card-title">แนวโน้มลูกค้าเป้าหมายรายเดือน</div></div>
          <div className="card-body" style={{ paddingTop: 4, flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            {/* vw = ความกว้าง viewBox ต้องใกล้ความกว้างการ์ดจริง (~480px) ไม่งั้น SVG ถูกย่อตามสัดส่วน
                เดิมไม่ได้ส่ง vw → ใช้ค่าเริ่มต้น 1180 → อัตราส่วน 1180:250 ทำให้กราฟสูงจริงแค่ ~100px ลอยอยู่กลางการ์ด
                (หน้าอื่นที่การ์ดแคบส่ง vw กันหมดแล้ว — หน้านี้ตกหล่นอยู่หน้าเดียว) */}
            <MultiLineChart months={trend.months} vw={560} height={280} fmt={v => `${Math.round(v)}`}
              series={[
                { name: "ลีดใหม่", color: "#003366", data: trend.newM },
                { name: "ใบเสนอราคา", color: "#0891b2", data: trend.quoteM },
                { name: "ปิดการขาย", color: "#10B981", data: trend.wonM },
                { name: "ปิดไม่สำเร็จ", color: "#dc2626", data: trend.lostM },
              ]} />
          </div>
        </div>
        {/* โดนัท: แหล่งที่มารวมกัน = ลีดทั้งหมดพอดี → เป็นสัดส่วนของก้อนเดียว
            การ์ดนี้แคบ (1fr) → วางโดนัทไว้บน legend ไว้ล่าง (ถ้าวางข้างกันจะเหลือที่ให้ชื่อไม่พอ) */}
        <div className="card" style={{ marginBottom: 0, display: "flex", flexDirection: "column" }}>
          <div className="card-header"><div className="card-title">ตามแหล่งที่มา</div><GitBranch size={16} color="#9ca3af" /></div>
          <div className="card-body" style={{ paddingTop: 6, flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            {!sources.length ? (
              <div style={{ fontSize: "0.74rem", color: "var(--muted-foreground)", alignSelf: "flex-start" }}>— ไม่มีข้อมูลในช่วงที่เลือก</div>
            ) : (<>
              <Donut
                segments={sources.map((s, i) => ({ label: s.label, value: s.count, color: RAMP[i % RAMP.length] }))}
                centerLabel="ลีดทั้งหมด"
                centerValue={`${sources.reduce((s, x) => s + x.count, 0)}`}
                size={150}
              />
              <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 7 }}>
                {sources.map((s, i) => (
                  <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: "0.7rem" }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: RAMP[i % RAMP.length], flexShrink: 0 }} />
                    <span style={{ flex: 1, color: "#374151", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</span>
                    <span style={{ fontWeight: 800, color: "#1F2937", fontVariantNumeric: "tabular-nums" }}>{s.count}</span>
                    <span style={{ color: "var(--muted-foreground)", minWidth: 32, textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{s.share}%</span>
                  </div>
                ))}
              </div>
            </>)}
          </div>
        </div>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header"><div className="card-title">ตามสถานะ</div></div>
          <div className="card-body" style={{ paddingTop: 6, display: "flex", flexDirection: "column", gap: 10 }}>
            {byStatus.map(s => { const c = leadStatusColor[s.status]; return (
              <div key={s.status}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", marginBottom: 3 }}>
                  <span style={{ color: "#374151", fontWeight: 600 }}>{leadStatusLabel[s.status]}</span><span style={{ fontWeight: 800, color: c.text }}>{s.count}</span>
                </div>
                <div style={{ height: 6, background: "var(--muted)", borderRadius: 999, overflow: "hidden" }}>
                  <div className="bar-grow" style={{ height: "100%", width: `${s.pct}%`, background: c.text, borderRadius: 999 }} />
                </div>
              </div>
            ); })}
          </div>
        </div>
      </div>

      {/* ── Section 5 · ผลงานตัวแทน Top 10 ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><div className="card-title">ผลงานตัวแทนจำหน่าย (Top 10)</div>
          <span style={{ fontSize: "0.62rem", color: "var(--muted-foreground)" }}>เรียงตามยอดขายในช่วง</span></div>
        <div className="table-wrap">
          <table>
            <colgroup>
              <col style={{ width: "6%", minWidth: 64 }} />
              <col style={{ width: "30%", minWidth: 180 }} />
              <col style={{ width: "14%", minWidth: 90 }} />
              <col style={{ width: "16%", minWidth: 110 }} />
              <col style={{ width: "16%", minWidth: 110 }} />
              <col style={{ width: "18%", minWidth: 120 }} />
            </colgroup>
            <thead><tr>
              <th>อันดับ</th><th>ตัวแทนจำหน่าย</th>
              <th className="num">ลีด</th><th className="num">ใบเสนอราคา</th>
              <th className="num">อัตราแปลง</th><th className="num">ยอดขาย</th>
            </tr></thead>
            <tbody>
              {!dealerPerf.length ? (
                <tr><td colSpan={6} style={{ textAlign: "center", padding: "28px 14px", color: "var(--muted-foreground)" }}>ไม่มีข้อมูลในช่วงที่เลือก</td></tr>
              ) : dealerPerf.map((d, i) => (
                <tr key={d.code} className="clickable" onClick={() => router.push(`/hq/dealers/${d.code}`)} style={{ cursor: "pointer" }}>
                  <td style={{ fontWeight: 700, color: "var(--muted-foreground)" }}>{i + 1}</td>
                  <td title={d.name} style={{ fontWeight: 600, color: "#1F2937", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</td>
                  <td className="num" style={{ fontVariantNumeric: "tabular-nums" }}>{d.leads}</td>
                  <td className="num" style={{ fontVariantNumeric: "tabular-nums" }}>{d.quotes}</td>
                  <td className="num" style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{d.conv === null ? "—" : `${d.conv}%`}</td>
                  <td className="num" style={{ fontWeight: 800, color: "#003366", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{fmtBaht(d.sales)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Toolbar: ค้นหา + กรองสถานะ/จังหวัด */}
      <div className="card" style={{ borderRadius: "var(--radius-xl) var(--radius-xl) 0 0", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fafafa", border: "1px solid var(--border,#e6eaf0)", borderRadius: 10, padding: "0 12px", height: 36, width: 300, maxWidth: "100%" }}>
          <Search size={13} color="#8a929c" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="ค้นหาบริษัท / จังหวัด / ผู้รับผิดชอบ..." style={{ border: "none", outline: "none", fontSize: "0.8rem", background: "transparent", flex: 1, color: "#2D2D2D" }} />
          {query && <button onClick={() => setQuery("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "#8a929c", display: "flex" }}><X size={12} /></button>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <select value={dealerSel} onChange={e => setDealerSel(e.target.value)} className="form-input" style={{ height: 36, fontSize: "0.78rem", width: 150 }}>
            <option value="ALL">ทุกตัวแทน</option>
            {dealerOpts.map(o => <option key={o} value={o}>{`${o} – ${DEALER_NAME.get(o) ?? o}`}</option>)}
          </select>
          <select value={regionSel} onChange={e => setRegionSel(e.target.value)} className="form-input" style={{ height: 36, fontSize: "0.78rem", width: 150 }}>
            <option value="ALL">ทุกภูมิภาค</option>
            {regionOpts.map(o => <option key={o} value={o}>{regionDisplay(o)}</option>)}
          </select>
          <select value={btSel} onChange={e => setBtSel(e.target.value)} className="form-input" style={{ height: 36, fontSize: "0.78rem", width: 150 }}>
            <option value="ALL">ทุกประเภทอาคาร</option>
            {btOpts.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <select value={srcSel} onChange={e => setSrcSel(e.target.value)} className="form-input" style={{ height: 36, fontSize: "0.78rem", width: 150 }}>
            <option value="ALL">ทุกแหล่งที่มา</option>
            {srcOpts.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <select value={province} onChange={e => setProvince(e.target.value)} className="form-input" style={{ height: 36, fontSize: "0.78rem", width: 160 }}>
            <option value="ALL">ทุกจังหวัด</option>
            {provinces.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={status} onChange={e => setStatus(e.target.value as LeadStatus | "ALL")} className="form-input" style={{ height: 36, fontSize: "0.78rem", width: 150 }}>
            <option value="ALL">ทุกสถานะ</option>
            {(["WAITING", "BULLET", "QUOTED", "FOLLOWUP", "NEGO", "PAID", "CANCELLED"] as LeadStatus[]).map(s => <option key={s} value={s}>{leadStatusLabel[s]}</option>)}
          </select>
        </div>
      </div>

      {/* ── ตารางลีดทั้งเครือ — คอลัมน์ตามสเปก ──
          13 คอลัมน์ต้องการ ~1,500px แต่กรอบมี ~1,012px → เลื่อนแนวนอน (.table-wrap overflow-x:auto)
          ดีกว่าบีบจนอ่านไม่ออก · ความกว้างคุมที่ colgroup เท่านั้น (table-layout:fixed) */}
      <div className="card" style={{ borderRadius: "0 0 var(--radius-xl) var(--radius-xl)", borderTop: "none", marginBottom: 0 }}>
        <div className="table-wrap" style={{ borderTop: "none" }}>
          <table>
            <colgroup>
              <col style={{ width: "8%", minWidth: 100 }} />{/* รหัสลีด */}
              <col style={{ width: "6%", minWidth: 78 }} />{/* รหัสตัวแทน */}
              <col style={{ width: "12%", minWidth: 150 }} />{/* ตัวแทน */}
              <col style={{ width: "14%", minWidth: 170 }} />{/* ลูกค้า */}
              <col style={{ width: "8%", minWidth: 100 }} />{/* จังหวัด */}
              <col style={{ width: "11%", minWidth: 140 }} />{/* ประเภทอาคาร */}
              <col style={{ width: "8%", minWidth: 106 }} />{/* แหล่งที่มา */}
              <col style={{ width: "8%", minWidth: 96 }} />{/* มูลค่า */}
              <col style={{ width: "8%", minWidth: 104 }} />{/* เสนอราคาแล้ว */}
              <col style={{ width: "9%", minWidth: 112 }} />{/* ติดต่อล่าสุด */}
              <col style={{ width: "7%", minWidth: 92 }} />{/* เตือน 7 วัน */}
              <col style={{ width: "9%", minWidth: 118 }} />{/* สถานะ */}
              <col style={{ width: "6%", minWidth: 74 }} />{/* ดู */}
            </colgroup>
            <thead><tr>
              <th>รหัสลีด</th><th>รหัสตัวแทน</th><th>ตัวแทน</th><th>ลูกค้า</th>
              <th>จังหวัด</th><th>ประเภทอาคาร</th><th>แหล่งที่มา</th>
              <th className="num">มูลค่า</th><th>เสนอราคาแล้ว</th><th>ติดต่อล่าสุด</th>
              <th>เตือน 7 วัน</th><th>สถานะ</th><th></th>
            </tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={13} style={{ padding: 0 }}><EmptyState icon={<Users size={26} />} title="ไม่พบลูกค้าเป้าหมาย" description="ลองปรับตัวกรองหรือคำค้น" /></td></tr>
              ) : filtered.map(l => {
                const c = leadStatusColor[l.status];
                const followUp = NEED_FOLLOWUP.includes(l.status);
                const quoted = ["QUOTED", "FOLLOWUP", "NEGO", "PAID"].includes(l.status);
                // ติดต่อล่าสุด = กิจกรรมล่าสุดของลีด · ลีดที่ไม่มีบันทึกกิจกรรม = "—" (ไม่เดาวันให้)
                const last = l.activities?.length ? l.activities[0].date : "—";
                return (
                  <tr key={l.id} className="clickable" onClick={() => setViewLead(l)} style={{ cursor: "pointer" }}>
                    <td style={{ fontFamily: "monospace", fontWeight: 700, color: PRIMARY, whiteSpace: "nowrap" }}>{l.id}</td>
                    <td><span className="badge" style={{ background: "#eef2f7", color: PRIMARY, fontFamily: "monospace" }}>{l.dealerCode || "—"}</span></td>
                    <td title={DEALER_NAME.get(l.dealerCode ?? "") ?? ""} style={{ color: "var(--muted-foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{DEALER_NAME.get(l.dealerCode ?? "") ?? l.dealerCode ?? "—"}</td>
                    <td title={l.company}>
                      <div style={{ fontWeight: 700, color: "#1F2937", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.company}</div>
                      <div style={{ fontSize: "0.66rem", color: "var(--muted-foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.contact}</div>
                    </td>
                    <td style={{ color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>{l.province}</td>
                    <td title={l.product} style={{ color: "var(--muted-foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.product}</td>
                    <td style={{ color: "var(--muted-foreground)", fontSize: "0.78rem", whiteSpace: "nowrap" }}>{l.source || "—"}</td>
                    <td className="num" style={{ fontWeight: 800, color: PRIMARY, whiteSpace: "nowrap" }}>{l.value || "—"}</td>
                    <td>
                      {/* ระบบไม่มี dealId ผูกใบเสนอราคากับลีด → นับจำนวนใบไม่ได้
                          ใช้สถานะของลีดแทน (ไปถึงขั้นเสนอราคา = เคยออกใบแล้วจริง) */}
                      {quoted ? <span style={{ color: "#059669", fontWeight: 700, fontSize: "0.76rem" }}>เสนอแล้ว</span>
                              : <span style={{ color: "#9ca3af" }}>—</span>}
                    </td>
                    <td style={{ color: "var(--muted-foreground)", fontSize: "0.76rem", whiteSpace: "nowrap" }}>{last}</td>
                    <td>
                      {followUp
                        ? <span className="badge" style={{ background: "#fff3e6", color: "#d97706", whiteSpace: "nowrap" }}>ต้องติดตาม</span>
                        : <span style={{ color: "#9ca3af" }}>—</span>}
                    </td>
                    <td><span className="badge" style={{ background: c.bg, color: c.text, whiteSpace: "nowrap" }}>{leadStatusLabel[l.status]}</span></td>
                    <td onClick={e => e.stopPropagation()}>
                      <button onClick={() => setViewLead(l)} title="ดูรายละเอียด" className="btn btn-secondary btn-sm" style={{ gap: 4, color: PRIMARY }}>
                        <Eye size={13} /> ดู
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Drawer · ดูรายละเอียดลีด (HQ ดูอย่างเดียว — ไม่มีแก้/ลบ/มอบหมาย) ──
          เปิดทับหน้าเดิม ไม่เปลี่ยนหน้า ตามสเปก · ไม่มีข้อมูล = "—" ไม่เดาให้ */}
      {viewLead && (() => {
        const l = viewLead;
        const c = leadStatusColor[l.status];
        const quoted = ["QUOTED", "FOLLOWUP", "NEGO", "PAID"].includes(l.status);
        return (
          <>
            <div onClick={() => setViewLead(null)} style={{ position: "fixed", inset: 0, background: "rgba(45,45,45,.45)", zIndex: 240 }} />
            <div className="side-drawer" style={{ position: "fixed", top: 0, right: 0, height: "100vh", width: 420, maxWidth: "100vw", zIndex: 241,
              background: "#F8FAFC", boxShadow: "-16px 0 60px rgba(0,0,0,.2)", borderRadius: "18px 0 0 18px", display: "flex", flexDirection: "column" }}>

              <div style={{ background: "#003366", padding: "16px 20px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, flexShrink: 0 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.company}</div>
                  <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,.75)", marginTop: 3 }}>{l.id} · {l.contact}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                    <span className="badge" style={{ background: c.bg, color: c.text }}>{leadStatusLabel[l.status]}</span>
                    <span className="badge" style={{ background: "rgba(255,255,255,.15)", color: "#fff" }}>{l.value || "—"}</span>
                  </div>
                </div>
                <button onClick={() => setViewLead(null)} title="ปิด" style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid rgba(255,255,255,.2)",
                  background: "rgba(255,255,255,.12)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><X size={14} /></button>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "4px 20px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.62rem", fontWeight: 800, color: "#8a929c", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 18, marginBottom: 8 }}>
            ข้อมูลลูกค้า
          </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "7px 0", borderBottom: "1px solid #f0f4f8", fontSize: "0.76rem" }}>
              <span style={{ color: "#8a929c", flexShrink: 0 }}>ผู้ติดต่อ</span>
              <span style={{ fontWeight: 700, color: "#2D2D2D", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis" }}>{l.contact || "—"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "7px 0", borderBottom: "1px solid #f0f4f8", fontSize: "0.76rem" }}>
              <span style={{ color: "#8a929c", flexShrink: 0 }}>โทรศัพท์</span>
              <span style={{ fontWeight: 700, color: "#2D2D2D", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis" }}>{l.phone || "—"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "7px 0", borderBottom: "1px solid #f0f4f8", fontSize: "0.76rem" }}>
              <span style={{ color: "#8a929c", flexShrink: 0 }}>อีเมล</span>
              <span style={{ fontWeight: 700, color: "#2D2D2D", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis" }}>{l.email || "—"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "7px 0", borderBottom: "1px solid #f0f4f8", fontSize: "0.76rem" }}>
              <span style={{ color: "#8a929c", flexShrink: 0 }}>จังหวัด</span>
              <span style={{ fontWeight: 700, color: "#2D2D2D", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis" }}>{l.province || "—"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "7px 0", borderBottom: "1px solid #f0f4f8", fontSize: "0.76rem" }}>
              <span style={{ color: "#8a929c", flexShrink: 0 }}>ประเภทอาคารที่สนใจ</span>
              <span style={{ fontWeight: 700, color: "#2D2D2D", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis" }}>{l.product || "—"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "7px 0", borderBottom: "1px solid #f0f4f8", fontSize: "0.76rem" }}>
              <span style={{ color: "#8a929c", flexShrink: 0 }}>แหล่งที่มา</span>
              <span style={{ fontWeight: 700, color: "#2D2D2D", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis" }}>{l.source || "—"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "7px 0", borderBottom: "1px solid #f0f4f8", fontSize: "0.76rem" }}>
              <span style={{ color: "#8a929c", flexShrink: 0 }}>มูลค่าประเมิน</span>
              <span style={{ fontWeight: 700, color: "#2D2D2D", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis" }}>{l.value || "—"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "7px 0", borderBottom: "1px solid #f0f4f8", fontSize: "0.76rem" }}>
              <span style={{ color: "#8a929c", flexShrink: 0 }}>สร้างเมื่อ</span>
              <span style={{ fontWeight: 700, color: "#2D2D2D", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis" }}>{l.createdAt || "—"}</span>
            </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.62rem", fontWeight: 800, color: "#8a929c", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 18, marginBottom: 8 }}>
            ข้อมูลตัวแทนจำหน่าย
          </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "7px 0", borderBottom: "1px solid #f0f4f8", fontSize: "0.76rem" }}>
              <span style={{ color: "#8a929c", flexShrink: 0 }}>รหัสตัวแทน</span>
              <span style={{ fontWeight: 700, color: "#2D2D2D", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis" }}>{l.dealerCode || "—"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "7px 0", borderBottom: "1px solid #f0f4f8", fontSize: "0.76rem" }}>
              <span style={{ color: "#8a929c", flexShrink: 0 }}>ตัวแทน</span>
              <span style={{ fontWeight: 700, color: "#2D2D2D", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis" }}>{DEALER_NAME.get(l.dealerCode ?? "") ?? "—"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "7px 0", borderBottom: "1px solid #f0f4f8", fontSize: "0.76rem" }}>
              <span style={{ color: "#8a929c", flexShrink: 0 }}>ผู้รับผิดชอบ</span>
              <span style={{ fontWeight: 700, color: "#2D2D2D", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis" }}>{l.assigned || "—"}</span>
            </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.62rem", fontWeight: 800, color: "#8a929c", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 18, marginBottom: 8 }}>
            ใบเสนอราคา
          </div>
            <div style={{ fontSize: "0.78rem", color: quoted ? "#059669" : "var(--muted-foreground)", fontWeight: quoted ? 700 : 400 }}>
              {quoted ? "เสนอราคาแล้ว (ดูใบได้ที่ ใบเสนอราคาทั้งเครือ)" : "— ยังไม่ได้เสนอราคา"}
            </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.62rem", fontWeight: 800, color: "#8a929c", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 18, marginBottom: 8 }}>
            กิจกรรม / ไทม์ไลน์
          </div>
            {!l.activities?.length ? (
              <div style={{ fontSize: "0.78rem", color: "var(--muted-foreground)" }}>— ไม่มีบันทึกกิจกรรม</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {l.activities.map(a => (
                  <div key={a.id} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#003366", marginTop: 6, flexShrink: 0 }} />
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: "0.76rem", color: "#2D2D2D" }}>{a.text}</span>
                      <span style={{ display: "block", fontSize: "0.66rem", color: "var(--muted-foreground)", marginTop: 1 }}>{a.date}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.62rem", fontWeight: 800, color: "#8a929c", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 18, marginBottom: 8 }}>
            ประวัตินัดหมาย
          </div>
            {(() => {
              const appts = appointments.filter(a => a.leadId === l.numId);
              return !appts.length ? (
                <div style={{ fontSize: "0.78rem", color: "var(--muted-foreground)" }}>— ไม่มีนัดหมาย</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {appts.map(a => (
                    <div key={a.id} style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 9, padding: "8px 10px" }}>
                      <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "#2D2D2D", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.project || a.company}</div>
                      <div style={{ fontSize: "0.66rem", color: "var(--muted-foreground)", marginTop: 2 }}>{fmtISOToThai(a.date)} · {a.time} · {a.assigned}</div>
                    </div>
                  ))}
                </div>
              );
            })()}
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.62rem", fontWeight: 800, color: "#8a929c", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 18, marginBottom: 8 }}>
            ไฟล์แนบ
          </div>
            {(() => {
              const files = dealerFiles.filter(f => f.source === "lead" && f.recordId === l.numId);
              return !files.length ? (
                <div style={{ fontSize: "0.78rem", color: "var(--muted-foreground)" }}>— ไม่มีไฟล์แนบ</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {files.map(f => (
                    <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", border: "1px solid #E5E7EB", borderRadius: 9, padding: "7px 10px" }}>
                      <span style={{ flex: 1, minWidth: 0, fontSize: "0.74rem", fontWeight: 700, color: "#2D2D2D", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                      <span style={{ fontSize: "0.65rem", color: "var(--muted-foreground)", flexShrink: 0 }}>{f.size}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.62rem", fontWeight: 800, color: "#8a929c", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 18, marginBottom: 8 }}>
            หมายเหตุ
          </div>
            <div style={{ fontSize: "0.78rem", color: l.note ? "#374151" : "var(--muted-foreground)", lineHeight: 1.6 }}>{l.note || "— ไม่มีหมายเหตุ"}</div>
            {l.status === "CANCELLED" && (
              <>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.62rem", fontWeight: 800, color: "#8a929c", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 18, marginBottom: 8 }}>
            เหตุผลที่ปิดการขายไม่สำเร็จ
          </div>
                <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#dc2626" }}>{l.lostReason || "— ไม่ได้ระบุเหตุผล"}</div>
              </>
            )}
              </div>

              <div style={{ padding: "12px 20px", borderTop: "1px solid #E5E7EB", background: "#fff", flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: "0.66rem", color: "var(--muted-foreground)", flex: 1 }}>สำนักงานใหญ่ดูอย่างเดียว — แก้ไขได้ที่ตัวแทนเจ้าของลีด</span>
                <button onClick={() => setViewLead(null)} className="btn btn-secondary btn-md" style={{ color: "#374151" }}>ปิด</button>
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}
