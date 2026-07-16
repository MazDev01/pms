"use client";

// ── Dealer Dashboard — ตาม design reference (Enterprise SaaS CRM) ──────────────
// S1: 5 KPI (icon พาสเทลคนละสี · Sales Target = ring) · S2: 3 charts · S3: 4 analytics cards
// S4: Recent Activities timeline (แนวนอน + ลูกศร) · stack เดิม (SVG charts, ไม่ลง Recharts)
import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Target, TrendingUp, PhoneCall, Activity, Building2,
  CalendarClock, FileText, Trophy, AlarmClock, ChevronRight, ArrowRight,
  UserPlus, CheckCircle2, Mail, Info,
} from "lucide-react";
import { useSales } from "@/context/SalesContext";
import { useFilters } from "@/context/FilterContext";
import { FilterBar } from "@/components/filters/FilterBar";
import { TopbarActions } from "@/components/layout/TopbarActions";
import { MultiLineChart, Donut } from "@/components/ui/Charts";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  loadHQTargets, leadStatusLabel, leadStatusColor, apptTypeLabel, fmtISOToThai,
  quotationStatusLabel, quotationStatusColor, dealerLeaderboard,
} from "@/lib/mock";
import { CURRENT_DEALER } from "@/lib/useNetworkData";
import {
  parseValue, isLeadOpen, needsFollowUp, daysSinceContact,
  MOCK_TODAY, leadCreatedDate,
} from "@/lib/leadMetrics";
import { useHQLeadRules } from "@/lib/useHQRules";

const NAVY = "#003366", AMBER = "#F59E0B", SUCCESS = "#16A34A", DANGER = "#DC2626";
const TEXT = "#1F2937", SUB = "#6B7280", BORDER = "#E5E7EB";
const TODAY_ISO = "2026-06-30";
const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const CUR_M = MOCK_TODAY.getMonth();

// วงกลมความคืบหน้า
function Ring({ pct, size = 72 }: { pct: number; size?: number }) {
  const r = (size - 11) / 2, c = 2 * Math.PI * r;
  // วงแหวนต้องวิ่งจาก 0 → ค่าจริง (มาตรฐานเดียวกับแถบความคืบหน้า .bar-grow ที่วิ่งจากซ้าย)
  // เดิมมี transition .8s อยู่แล้วแต่ "ไม่มีวันทำงาน" เพราะค่าถูกตั้งตั้งแต่เรนเดอร์แรก
  // CSS transition วิ่งเมื่อค่าเปลี่ยน "หลัง mount" เท่านั้น → ต้องเริ่มที่ 0 แล้วค่อยตั้งค่าจริงในเฟรมถัดไป
  // เริ่มที่ 0 เท่ากันทั้งเซิร์ฟเวอร์และเบราว์เซอร์ → ไม่เกิด hydration mismatch
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);
  // เส้นโค้งวาดได้สูงสุด 1 รอบ (เกิน 100% วาดเพิ่มไม่ได้) — แต่ "ตัวเลขเก็บค่าจริง" ไม่ถูกตัด
  const arc = Math.max(0, Math.min(100, shown));
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }} role="img" aria-label={`${pct}%`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EEF2F7" strokeWidth={9} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={NAVY} strokeWidth={9} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - arc / 100)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dashoffset 1s cubic-bezier(.4,0,.2,1)" }} />
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central" fontSize={size * 0.24} fontWeight={800} fill={NAVY}>{pct}%</text>
    </svg>
  );
}

// จำนวนเงินเต็มจำนวน (฿10,000,000) — ใช้บนการ์ด KPI ตาม design reference
function baht(v: number): string { return `฿${Math.round(v).toLocaleString("en-US")}`; }

export default function DealerDashboard() {
  const router = useRouter();
  const { leads, quotations, appointments } = useSales();
  const { timeRange } = useFilters();
  const targets = loadHQTargets();
  const { followUpAlertDays } = useHQLeadRules(); // กฎ HQ — ตัวแทนแก้เองไม่ได้

  const wonByMonth = useMemo(() => {
    const m = Array(12).fill(0);
    quotations.filter(q => q.status === "won").forEach(q => { const mo = parseInt(q.date.slice(5, 7), 10) - 1; if (mo >= 0 && mo < 12) m[mo] += q.totalValue; });
    return m;
  }, [quotations]);

  // ── KPI ── เป้าหมาย = รายปีของตัวแทนรายนี้ (HQ ตั้งที่ /hq/dealers) · ยอดขาย = สะสมตั้งแต่ต้นปี (YTD)
  // ไม่เฉลี่ย/ไม่หารตามช่วงตัวกรอง — เทียบ YTD กับเป้าทั้งปีเสมอ
  const annualTarget = useMemo(() => {
    const me = dealerLeaderboard.find(d => d.code === CURRENT_DEALER.code);
    return me?.revenueTarget ?? targets.annualTarget ?? 0;
  }, [targets.annualTarget]);
  const monthTarget = annualTarget / 12; // ใช้เป็นเส้นเป้าหมายในกราฟรายเดือนเท่านั้น
  const ytdSales = useMemo(() => wonByMonth.slice(0, CUR_M + 1).reduce((s, v) => s + v, 0), [wonByMonth]);
  const achievePct = annualTarget > 0 ? Math.round((ytdSales / annualTarget) * 100) : 0;
  const openLeads = useMemo(() => leads.filter(isLeadOpen), [leads]);
  const openValue = useMemo(() => openLeads.reduce((s, l) => s + parseValue(l.value), 0), [openLeads]);
  const followUpToday = useMemo(() => appointments.filter(a => a.date === TODAY_ISO && a.status !== "cancelled").length, [appointments]);
  const winRate = useMemo(() => {
    const won = quotations.filter(q => q.status === "won").length, lost = quotations.filter(q => q.status === "lost").length;
    return won + lost ? Math.round((won / (won + lost)) * 1000) / 10 : 0;
  }, [quotations]);

  // ── Charts ──
  const salesSeries = useMemo(() => wonByMonth.map(v => Math.round((v / 1e6) * 10) / 10), [wonByMonth]);
  const targetSeries = useMemo(() => Array(12).fill(Math.round((monthTarget / 1e6) * 10) / 10), [monthTarget]);
  const leadQuoteMonthly = useMemo(() => {
    const lC = Array(12).fill(0), qC = Array(12).fill(0);
    leads.forEach(l => { lC[leadCreatedDate(l).getMonth()]++; });
    quotations.forEach(q => { const mo = parseInt(q.date.slice(5, 7), 10) - 1; if (mo >= 0 && mo < 12) qC[mo]++; });
    return { lC, qC };
  }, [leads, quotations]);
  const dealStatus = useMemo(() => {
    const order = ["WAITING", "BULLET", "QUOTED", "FOLLOWUP", "NEGO", "PAID", "CANCELLED"] as const;
    const m = new Map<string, number>();
    leads.forEach(l => m.set(l.status, (m.get(l.status) ?? 0) + 1));
    const total = leads.length || 1;
    return order.filter(s => m.get(s)).map(s => ({
      label: leadStatusLabel[s], value: m.get(s)!, color: leadStatusColor[s].text,
      pct: Math.round((m.get(s)! / total) * 100),
    }));
  }, [leads]);

  // ── ผลงานผู้รับผิดชอบ · ยอดขายตามสินค้า · แหล่งที่มาของผู้สนใจ (แถวใต้กราฟ) ──
  const teamPerf = useMemo(() => {
    const m = new Map<string, { deals: number; won: number }>();
    leads.forEach(l => {
      const key = l.assigned || "ไม่ระบุ";
      const e = m.get(key) ?? { deals: 0, won: 0 };
      e.deals++;
      if (l.status === "PAID") e.won += parseValue(l.value);
      m.set(key, e);
    });
    const arr = [...m.entries()].map(([name, v]) => ({ name, ...v }));
    const max = Math.max(1, ...arr.map(a => a.won));
    return arr.sort((a, b) => b.won - a.won || b.deals - a.deals).slice(0, 6).map(a => ({ ...a, pct: Math.round((a.won / max) * 100) }));
  }, [leads]);

  const salesByProduct = useMemo(() => {
    const m = new Map<string, number>();
    const paid = leads.filter(l => l.status === "PAID");
    const src = paid.length ? paid : leads;
    src.forEach(l => { const k = l.product || "อื่นๆ"; m.set(k, (m.get(k) ?? 0) + parseValue(l.value)); });
    const arr = [...m.entries()].map(([name, value]) => ({ name, value }));
    const max = Math.max(1, ...arr.map(a => a.value));
    return arr.sort((a, b) => b.value - a.value).slice(0, 6).map(a => ({ ...a, pct: Math.round((a.value / max) * 100) }));
  }, [leads]);

  const leadSources = useMemo(() => {
    const COLORS = ["#2563EB", "#16A34A", "#F59E0B", "#7C3AED", "#EA580C", "#0D9488", "#94A3B8"];
    const m = new Map<string, number>();
    leads.forEach(l => { const s = l.source || "อื่นๆ"; m.set(s, (m.get(s) ?? 0) + 1); });
    const total = leads.length || 1;
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([label, value], i) => ({ label, value, color: COLORS[i % COLORS.length], pct: Math.round((value / total) * 100) }));
  }, [leads]);
  const cmpBaht = (v: number) => v >= 1e6 ? `฿${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `฿${Math.round(v / 1e3)}K` : `฿${v}`;

  // ── Analytics cards ──
  const urgentLeads = useMemo(() => leads.filter(l => needsFollowUp(l, followUpAlertDays)).sort((a, b) => (daysSinceContact(b) ?? 0) - (daysSinceContact(a) ?? 0)).slice(0, 4), [leads, followUpAlertDays]);
  const todayTasks = useMemo(() => appointments.filter(a => a.date === TODAY_ISO && a.status !== "cancelled").sort((a, b) => a.time.localeCompare(b.time)).slice(0, 4), [appointments]);
  const latestQuotes = useMemo(() => [...quotations].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4), [quotations]);
  const topDeals = useMemo(() => openLeads.slice().sort((a, b) => parseValue(b.value) - parseValue(a.value)).slice(0, 5), [openLeads]);

  // ── Recent Activities ──
  const recent = useMemo(() => {
    type Ev = { kind: string; icon: typeof FileText; title: string; customer: string; date: string; time?: string; color: string; bg: string };
    const ev: Ev[] = [];
    leads.forEach(l => ev.push({ kind: "lead", icon: UserPlus, title: "สร้างลีดใหม่", customer: l.company, date: leadCreatedDate(l).toISOString().slice(0, 10), color: "#2563EB", bg: "#E8F0FE" }));
    appointments.forEach(a => ev.push({ kind: "appt", icon: CalendarClock, title: "นัดหมาย", customer: a.company, date: a.date, time: a.time, color: "#7C3AED", bg: "#F0EBFB" }));
    quotations.forEach(q => {
      ev.push({ kind: "quote", icon: Mail, title: `ส่งใบเสนอราคา ${q.id}`, customer: q.customer, date: q.date, color: "#EA580C", bg: "#FEF0E6" });
      if (q.status === "won") ev.push({ kind: "won", icon: CheckCircle2, title: "ปิดการขายสำเร็จ", customer: q.customer, date: q.date, color: SUCCESS, bg: "#E6F7EE" });
    });
    // แสดง "ล่าสุดของแต่ละประเภท" → ไทม์ไลน์หลากหลาย (ไม่ซ้ำชนิดเดียว) แล้วเรียงตามวัน
    const byKind = new Map<string, Ev>();
    ev.sort((a, b) => b.date.localeCompare(a.date)).forEach(e => { if (!byKind.has(e.kind)) byKind.set(e.kind, e); });
    const picked = [...byKind.values()];
    // เติมด้วยรายการล่าสุดที่เหลือให้ครบ 5
    ev.forEach(e => { if (picked.length < 5 && !picked.includes(e)) picked.push(e); });
    return picked.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
  }, [leads, appointments, quotations]);

  // ── styles ──
  const card: React.CSSProperties = { background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, padding: 24, boxShadow: "0 1px 2px rgba(16,40,80,.04)" };
  const hd: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 16, flexWrap: "nowrap" };
  const title: React.CSSProperties = { fontSize: "0.85rem", fontWeight: 700, color: TEXT, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
  const sub: React.CSSProperties = { fontSize: "0.72rem", color: SUB };
  const num: React.CSSProperties = { fontSize: "1.05rem", fontWeight: 800, color: TEXT, lineHeight: 1.15, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.015em", whiteSpace: "nowrap" };
  const more = (href: string) => (
    <button onClick={() => router.push(href)} style={{ display: "inline-flex", alignItems: "center", gap: 2, fontSize: "0.7rem", fontWeight: 700, color: SUB, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", flexShrink: 0 }}>
      ดูทั้งหมด <ChevronRight size={13} />
    </button>
  );
  const detail = (href: string) => (
    <button onClick={() => router.push(href)} style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: "0.72rem", fontWeight: 700, color: NAVY, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", marginTop: "auto" }}>
      ดูรายละเอียด <ChevronRight size={13} />
    </button>
  );
  const IconBox = ({ Icon, color, bg }: { Icon: typeof Target; color: string; bg: string }) => (
    <span style={{ width: 42, height: 42, borderRadius: 12, background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <Icon size={20} color={color} strokeWidth={2.1} />
    </span>
  );
  const Thumb = ({ logo }: { logo?: string }) => (
    <span style={{ width: 40, height: 40, borderRadius: 9, background: "#F1F5F9", border: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
      {logo ? <img src={logo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Building2 size={18} color="#94A3B8" />}
    </span>
  );

  const kpis = [
    { label: "เป้าหมายยอดขาย", tip: "เป้าหมายยอดขายทั้งปีที่สำนักงานใหญ่กำหนด เทียบกับยอดปิดการขายสะสมตั้งแต่ต้นปี", Icon: Target, color: "#2563EB", bg: "#E8F0FE", href: "/quotations", ring: true },
    { label: "โอกาสทางการขาย", tip: "มูลค่ารวมของดีลที่ยังเปิดอยู่ (ยังไม่ปิดการขาย/ยกเลิก)", Icon: TrendingUp, color: SUCCESS, bg: "#E6F7EE", href: "/leads", value: baht(openValue), sub1: "มูลค่าโอกาสทั้งหมด", sub2: `${openLeads.length} ดีล` },
    { label: "ติดตามวันนี้", tip: "งานติดตาม/นัดหมายที่ต้องทำวันนี้", Icon: PhoneCall, color: "#EA580C", bg: "#FEF0E6", href: "/calendar", value: `${followUpToday}`, sub1: "รายการ" },
    { label: "อัตราการปิดการขาย", tip: "สัดส่วนใบเสนอราคาที่ตอบรับ เทียบกับที่ปิดแล้วทั้งหมด (ตอบรับ + ปฏิเสธ)", Icon: Activity, color: "#0D9488", bg: "#E6F7F5", href: "/quotations", value: `${winRate}%`, sub1: "อัตราการปิดการขาย" },
  ];
  const KpiLabel = ({ label, tip }: { label: string; tip: string }) => (
    <span style={{ ...sub, display: "inline-flex", alignItems: "center", gap: 4 }}>
      {label}
      <span title={tip} aria-label={tip} style={{ display: "inline-flex", cursor: "help" }}>
        <Info size={12} color="#94A3B8" />
      </span>
    </span>
  );

  return (
    <div className="anim-rise">
      {/* ปุ่มหัวหน้า — เหลือแค่ช่วงวันที่ (เอา ตัวกรอง/รีเฟรช ออก) */}
      <TopbarActions>
        <FilterBar dims={[]} />
      </TopbarActions>

      {/* SECTION 1 — 4 KPI (แถวเดียวบนจอกว้าง · ยุบเป็น 2/1 คอลัมน์บนจอแคบ) */}
      <div className="dash-kpis" style={{ marginBottom: 24 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ ...card, display: "flex", flexDirection: "column", gap: 10 }}>
            {k.ring ? (
              <>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <KpiLabel label={k.label} tip={k.tip} />
                    <div style={{ ...num, marginTop: 6 }}>{baht(annualTarget)}</div>
                    <div style={{ ...sub, marginTop: 2 }}>เป้าหมายทั้งปี</div>
                  </div>
                  <Ring pct={achievePct} size={50} />
                </div>
                <div>
                  <div style={{ fontSize: "1.05rem", fontWeight: 800, color: NAVY, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{baht(ytdSales)}</div>
                  <div style={sub}>ยอดขายปัจจุบัน</div>
                </div>
                {detail(k.href)}
              </>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <KpiLabel label={k.label} tip={k.tip} />
                    <div style={{ ...num, marginTop: 6 }}>{k.value}</div>
                    <div style={{ ...sub, marginTop: 2 }}>{k.sub1}</div>
                    {k.sub2 && <div style={{ fontSize: "1.05rem", fontWeight: 800, color: TEXT, marginTop: 6, fontVariantNumeric: "tabular-nums" }}>{k.sub2}</div>}
                  </div>
                  <IconBox Icon={k.Icon} color={k.color} bg={k.bg} />
                </div>
                {detail(k.href)}
              </>
            )}
          </div>
        ))}
      </div>

      {/* SECTION 2 — 3 charts (การ์ดสถานะดีลกว้างกว่า เพื่อให้ donut + คำอธิบายอยู่แถวเดียว) */}
      <div className="dash-charts" style={{ marginBottom: 24 }}>
        <div style={card}>
          <div style={hd}><span style={title}>ยอดขายรายเดือน</span>{more("/quotations")}</div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <MultiLineChart months={THAI_MONTHS} vw={520} height={300} fmt={v => `฿${v.toFixed(0)}M`}
              series={[{ name: "ยอดขาย (บาท)", color: "#2563EB", data: salesSeries }, { name: "เป้าหมาย (บาท)", color: "#C0C0C0", data: targetSeries }]} />
          </div>
        </div>
        <div style={card}>
          <div style={hd}><span style={title}>ลีดเทียบใบเสนอราคา</span>{more("/leads")}</div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <MultiLineChart months={THAI_MONTHS} vw={520} height={300} fmt={v => `${Math.round(v)}`}
              series={[{ name: "จำนวนลีด", color: "#2563EB", data: leadQuoteMonthly.lC }, { name: "จำนวนใบเสนอราคา", color: AMBER, data: leadQuoteMonthly.qC }]} />
          </div>
        </div>
        <div style={card}>
          <div style={hd}><span style={title}>สถานะดีล</span>{more("/leads")}</div>
          {dealStatus.length === 0 ? <EmptyState icon={<Target size={26} />} title="ไม่มีดีล" description="กรุณาปรับตัวกรอง" compact /> : (
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
              <Donut segments={dealStatus} centerLabel="ดีลทั้งหมด" centerValue={`${leads.length}`} size={118} />
              <div style={{ display: "flex", flexDirection: "column", gap: 7, flex: 1, minWidth: 168 }}>
                {dealStatus.map(s => (
                  <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.72rem", whiteSpace: "nowrap" }}>
                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, color: TEXT, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</span>
                    <span style={{ fontWeight: 800, color: TEXT, fontVariantNumeric: "tabular-nums" }}>{s.value}</span>
                    <span style={{ color: SUB, fontVariantNumeric: "tabular-nums" }}>({s.pct}%)</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 2.5 — ผลงานผู้รับผิดชอบ · ยอดขายตามสินค้า · แหล่งที่มาของผู้สนใจ */}
      <div className="dash-charts" style={{ marginBottom: 24 }}>
        {/* ผลงานผู้รับผิดชอบ */}
        <div style={card}>
          <div style={hd}><span style={title}>ผลงานผู้รับผิดชอบ</span>{more("/leads")}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 4, maxHeight: 320, overflowY: "auto", paddingRight: 4 }}>
            {teamPerf.map((t, i) => (
              <div key={t.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 26, height: 26, borderRadius: "50%", background: i === 0 ? NAVY : "#EEF2F7", color: i === 0 ? "#fff" : SUB, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.68rem", fontWeight: 800, flexShrink: 0 }}>{i + 1}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: "0.76rem", fontWeight: 700, color: TEXT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>
                    <span style={{ fontSize: "0.74rem", fontWeight: 800, color: NAVY, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{cmpBaht(t.won)}</span>
                  </span>
                  <span style={{ display: "block", height: 6, background: "#eef2f7", borderRadius: 99, overflow: "hidden" }}>
                    <span className="bar-grow" style={{ display: "block", height: "100%", width: `${t.pct}%`, background: NAVY, borderRadius: 99 }} />
                  </span>
                  <span style={{ fontSize: "0.65rem", color: SUB }}>{t.deals} ดีล</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ยอดขายตามสินค้า */}
        <div style={card}>
          <div style={hd}><span style={title}>ยอดขายตามสินค้า</span>{more("/products")}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 4, maxHeight: 320, overflowY: "auto", paddingRight: 4 }}>
            {salesByProduct.map((p, i) => {
              const col = ["#2563EB", "#16A34A", "#F59E0B", "#7C3AED", "#EA580C", "#0D9488"][i % 6];
              return (
                <div key={p.name}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: "0.76rem", fontWeight: 700, color: TEXT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                    <span style={{ fontSize: "0.74rem", fontWeight: 800, color: col, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{cmpBaht(p.value)}</span>
                  </div>
                  <div style={{ height: 6, background: "#eef2f7", borderRadius: 99, overflow: "hidden" }}>
                    <div className="bar-grow" style={{ height: "100%", width: `${p.pct}%`, background: col, borderRadius: 99 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* งานที่ต้องทำวันนี้ (ย้ายมาสลับกับกิจกรรมล่าสุด) */}
        <div style={card}>
          <div style={hd}><span style={{ ...title, display: "flex", alignItems: "center", gap: 6 }}><CalendarClock size={15} color={NAVY} /> งานที่ต้องทำวันนี้</span>{more("/calendar")}</div>
          {todayTasks.length === 0 ? <EmptyState icon={<CheckCircle2 size={26} />} title="ไม่มีงานวันนี้" description="—" compact /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: 320, overflowY: "auto", paddingRight: 4 }}>
              {todayTasks.map(a => (
                <div key={a.id} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <IconBox Icon={a.type === "follow_up" ? PhoneCall : a.type === "presentation" ? Mail : CalendarClock}
                    color={a.type === "follow_up" ? "#2563EB" : a.type === "presentation" ? "#EA580C" : "#7C3AED"}
                    bg={a.type === "follow_up" ? "#E8F0FE" : a.type === "presentation" ? "#FEF0E6" : "#F0EBFB"} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: TEXT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{apptTypeLabel[a.type]} {a.company}</span>
                    <span style={{ display: "block", fontSize: "0.68rem", color: SUB, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.project}</span>
                  </span>
                  <span style={{ fontSize: "0.74rem", fontWeight: 700, color: SUB, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{a.time}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SECTION 3 — 4 analytics cards (แถวเดียว) */}
      <div className="dash-cards" style={{ marginBottom: 24 }}>
        {/* Urgent Leads */}
        <div style={card}>
          <div style={hd}><span style={{ ...title, display: "flex", alignItems: "center", gap: 6, flexShrink: 1 }}><AlarmClock size={15} color={DANGER} style={{ flexShrink: 0 }} /> <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>ลีดที่ต้องติดตาม (เกิน 7 วัน)</span></span>{more("/leads")}</div>
          {urgentLeads.length === 0 ? <EmptyState icon={<PhoneCall size={26} />} title="ไม่มีลีดค้าง" description="ทุกลีดติดต่อใน 7 วัน" compact /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: 320, overflowY: "auto", paddingRight: 4 }}>
              {urgentLeads.map(l => (
                <button key={l.id} onClick={() => router.push(`/leads?open=${l.numId}`)} style={{ display: "flex", gap: 10, alignItems: "center", textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit" }}>
                  <Thumb logo={l.logo} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: TEXT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.company}</span>
                    <span style={{ display: "block", fontSize: "0.68rem", color: SUB }}>สนใจ: {l.product}</span>
                    <span style={{ display: "block", fontSize: "0.68rem", color: DANGER, fontWeight: 700 }}>ไม่ได้ติดต่อ {daysSinceContact(l)} วัน</span>
                  </span>
                  <span style={{ textAlign: "right", flexShrink: 0 }}>
                    <span style={{ display: "block", fontSize: "0.65rem", color: SUB }}>มูลค่าโอกาส</span>
                    <span style={{ display: "block", fontSize: "0.8rem", fontWeight: 800, color: NAVY }}>{l.value}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* กิจกรรมล่าสุด (ย้ายมาสลับกับงานที่ต้องทำวันนี้) */}
        <div style={card}>
          <div style={hd}><span style={{ ...title, display: "flex", alignItems: "center", gap: 6 }}><Activity size={15} color={NAVY} /> กิจกรรมล่าสุด</span>{more("/leads")}</div>
          {recent.length === 0 ? <EmptyState icon={<Activity size={26} />} title="ไม่มีกิจกรรม" description="—" compact /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 4, maxHeight: 320, overflowY: "auto", paddingRight: 4 }}>
              {recent.map((e, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "9px 0", borderTop: i === 0 ? "none" : "1px solid #f0f4f8" }}>
                  <IconBox Icon={e.icon} color={e.color} bg={e.bg} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: "0.76rem", fontWeight: 700, color: TEXT, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.title}</div>
                    <div style={{ fontSize: "0.68rem", color: SUB, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.customer}</div>
                    <div style={{ fontSize: "0.65rem", color: "#94A3B8", marginTop: 2 }}>{fmtISOToThai(e.date)}{e.time ? ` ${e.time}` : ""}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Latest Quotations */}
        <div style={card}>
          <div style={hd}><span style={{ ...title, display: "flex", alignItems: "center", gap: 6 }}><FileText size={15} color={NAVY} /> ใบเสนอราคาล่าสุด</span>{more("/quotations")}</div>
          {latestQuotes.length === 0 ? <EmptyState icon={<FileText size={26} />} title="ไม่มีใบเสนอราคา" description="—" compact /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: 320, overflowY: "auto", paddingRight: 4 }}>
              {latestQuotes.map(q => { const sc = quotationStatusColor[q.status]; return (
                <button key={q.id} onClick={() => router.push("/quotations")} style={{ display: "flex", gap: 10, alignItems: "center", textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit" }}>
                  <IconBox Icon={FileText} color={NAVY} bg="#F1F5F9" />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, color: TEXT, fontFamily: "monospace" }}>{q.id}</span>
                    <span style={{ display: "block", fontSize: "0.68rem", color: SUB, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.customer}</span>
                    <span style={{ display: "block", fontSize: "0.78rem", fontWeight: 800, color: NAVY }}>{q.total}</span>
                  </span>
                  <span style={{ textAlign: "right", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                    <span className="badge" style={{ background: sc.bg, color: sc.text }}>{quotationStatusLabel[q.status]}</span>
                    <span style={{ fontSize: "0.65rem", color: SUB }}>{fmtISOToThai(q.date)}</span>
                  </span>
                </button>
              ); })}
            </div>
          )}
        </div>

        {/* Top Deals */}
        <div style={card}>
          <div style={hd}><span style={{ ...title, display: "flex", alignItems: "center", gap: 6 }}><Trophy size={15} color={NAVY} /> ดีลที่มูลค่าสูงสุด</span>{more("/leads")}</div>
          {topDeals.length === 0 ? <EmptyState icon={<Target size={26} />} title="ไม่มีดีล" description="—" compact /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: 320, overflowY: "auto", paddingRight: 4 }}>
              {topDeals.map((d, i) => (
                <button key={d.id} onClick={() => router.push(`/leads?open=${d.numId}`)} style={{ display: "flex", gap: 9, alignItems: "center", textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit" }}>
                  <span style={{ width: 20, height: 20, borderRadius: 6, background: i === 0 ? NAVY : "#F1F5F9", color: i === 0 ? "#fff" : SUB, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "0.66rem", flexShrink: 0 }}>{i + 1}</span>
                  <Thumb logo={d.logo} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: TEXT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.company}</span>
                    <span style={{ display: "block", fontSize: "0.68rem", color: SUB, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.project || d.product}</span>
                  </span>
                  <span style={{ fontSize: "0.8rem", fontWeight: 800, color: NAVY, whiteSpace: "nowrap", flexShrink: 0 }}>{d.value}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
