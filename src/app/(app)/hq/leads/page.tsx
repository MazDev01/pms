"use client";

// ─── HQ · ลูกค้าเป้าหมายทั้งเครือ (Network Leads) ──────────────────────────────
// ภาพรวมลีดของทุกตัวแทน · กรอง (ค้นหา/สถานะ/จังหวัด/ช่วงเวลา) · KPI · กราฟ · ตาราง drill-down
// ใช้ข้อมูลจริงจาก SalesContext (leads) — HQ ดูอย่างเดียว (Sales CRM เท่านั้น)
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, PhoneCall, AlarmClock, Percent, Search, X, ChevronRight, MapPin, GitBranch } from "lucide-react";
import { useNetworkLeads } from "@/lib/useNetworkData";
import { useFilters } from "@/context/FilterContext";
import { FilterBar } from "@/components/filters/FilterBar";
import { MultiLineChart } from "@/components/ui/Charts";
import { EmptyState } from "@/components/ui/EmptyState";
import { leadStatusLabel, leadStatusColor, type LeadStatus } from "@/lib/mock";
import { parseBaht, fmtBaht } from "@/lib/format";

const PRIMARY = "#003366";
const RAMP = ["#003366", "#0891b2", "#059669", "#d97706", "#7c3aed", "#dc2626"];
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
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<LeadStatus | "ALL">("ALL");
  const [province, setProvince] = useState<string>("ALL");

  // ลีดในช่วงเวลาที่เลือก (ตาม createdAt) — แหล่งเดียวของทั้งหน้า
  const scoped = useMemo(() => leads.filter(l => {
    const d = parseThaiDate(l.createdAt ?? "");
    return !d || (d >= timeRange.start && d <= timeRange.end);
  }), [leads, timeRange.start, timeRange.end]);

  const provinces = useMemo(() => [...new Set(scoped.map(l => l.province).filter(Boolean))].sort(), [scoped]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scoped.filter(l =>
      (status === "ALL" || l.status === status) &&
      (province === "ALL" || l.province === province) &&
      (!q || (l.company + l.contact + l.province + l.product + l.assigned).toLowerCase().includes(q))
    );
  }, [scoped, query, status, province]);

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

  const kpiCards = [
    { label: "ลูกค้าเป้าหมายทั้งหมด", value: `${kpis.total}`, sub: "ทั้งเครือ", Icon: Users, color: "#2563a8", on: status === "ALL", onClick: () => setStatus("ALL") },
    { label: "ลีดใหม่ (เดือนนี้)", value: `${kpis.newThis}`, sub: "รายการ", Icon: PhoneCall, color: "#7c3aed", on: false, onClick: () => setStatus("ALL") },
    { label: "ยังไม่ติดตาม (>7 วัน)", value: `${kpis.followUp}`, sub: "ต้องติดตามด่วน", Icon: AlarmClock, color: "#EA580C", on: status === "FOLLOWUP", onClick: () => setStatus(status === "FOLLOWUP" ? "ALL" : "FOLLOWUP") },
    { label: "อัตราแปลงเป็นลูกค้า", value: `${kpis.conv}%`, sub: "ปิดได้ / ปิดทั้งหมด", Icon: Percent, color: "#059669", on: false, onClick: () => setStatus("ALL") },
  ];

  // แนวโน้มลีดรายเดือน (สร้างใหม่ vs ปิดการขาย)
  const trend = useMemo(() => {
    const newM = Array(12).fill(0), wonM = Array(12).fill(0);
    scoped.forEach(l => { const d = parseThaiDate(l.createdAt ?? ""); if (!d) return; newM[d.getMonth()]++; if (l.status === "PAID") wonM[d.getMonth()]++; });
    const a = timeRange.start.getMonth(), b = timeRange.end.getMonth();
    return { months: TH_ABBR.slice(a, b + 1), newM: newM.slice(a, b + 1), wonM: wonM.slice(a, b + 1) };
  }, [scoped, timeRange]);

  // ลีดตามแหล่งที่มา + ตามสถานะ (แท่งแนวนอน)
  const sources = useMemo(() => {
    const m = new Map<string, number>();
    scoped.forEach(l => m.set(l.source || "ไม่ระบุ", (m.get(l.source || "ไม่ระบุ") ?? 0) + 1));
    const arr = [...m.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
    const max = Math.max(...arr.map(a => a.count), 1);
    return arr.map(a => ({ ...a, pct: Math.round(a.count / max * 100) }));
  }, [scoped]);

  const byStatus = useMemo(() => {
    const order: LeadStatus[] = ["WAITING", "BULLET", "QUOTED", "FOLLOWUP", "NEGO", "PAID", "CANCELLED"];
    const max = Math.max(...order.map(s => scoped.filter(l => l.status === s).length), 1);
    return order.map(s => ({ status: s, count: scoped.filter(l => l.status === s).length, pct: Math.round(scoped.filter(l => l.status === s).length / max * 100) }));
  }, [scoped]);

  return (
    <div className="erp">
      <div className="page-head">
        <div>
          <p>ภาพรวมลูกค้าเป้าหมายของทุกตัวแทน · {timeRange.subtitle}</p>
        </div>
        <FilterBar dims={[]} />
      </div>

      {/* KPI */}
      <div className="dash-kpis" style={{ marginBottom: 16 }}>
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

      {/* กราฟ: แนวโน้ม + แหล่งที่มา + สถานะ */}
      <div className="hq-row3" style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr", gap: "1.25rem", alignItems: "stretch", marginBottom: 16 }}>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header"><div className="card-title">แนวโน้มลูกค้าเป้าหมายรายเดือน</div></div>
          <div className="card-body" style={{ paddingTop: 4 }}>
            <MultiLineChart months={trend.months} height={250} fmt={v => `${Math.round(v)}`}
              series={[{ name: "ลีดใหม่", color: "#003366", data: trend.newM }, { name: "ปิดการขาย", color: "#10B981", data: trend.wonM }]} />
          </div>
        </div>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header"><div className="card-title">ตามแหล่งที่มา</div><GitBranch size={16} color="#9ca3af" /></div>
          <div className="card-body" style={{ paddingTop: 6, display: "flex", flexDirection: "column", gap: 12 }}>
            {sources.map((s, i) => (
              <div key={s.label}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.74rem", marginBottom: 4 }}>
                  <span style={{ color: "#374151", fontWeight: 600 }}>{s.label}</span><span style={{ fontWeight: 800, color: PRIMARY }}>{s.count}</span>
                </div>
                <div style={{ height: 6, background: "var(--muted)", borderRadius: 999, overflow: "hidden" }}>
                  <div className="bar-grow" style={{ height: "100%", width: `${s.pct}%`, background: RAMP[i % RAMP.length], borderRadius: 999 }} />
                </div>
              </div>
            ))}
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

      {/* Toolbar: ค้นหา + กรองสถานะ/จังหวัด */}
      <div className="card" style={{ borderRadius: "var(--radius-xl) var(--radius-xl) 0 0", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fafafa", border: "1px solid var(--border,#e6eaf0)", borderRadius: 10, padding: "0 12px", height: 36, width: 300, maxWidth: "100%" }}>
          <Search size={13} color="#8a929c" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="ค้นหาบริษัท / จังหวัด / ผู้รับผิดชอบ..." style={{ border: "none", outline: "none", fontSize: "0.8rem", background: "transparent", flex: 1, color: "#2D2D2D" }} />
          {query && <button onClick={() => setQuery("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "#8a929c", display: "flex" }}><X size={12} /></button>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
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

      {/* ตารางลีดทั้งเครือ */}
      <div className="card" style={{ borderRadius: "0 0 var(--radius-xl) var(--radius-xl)", borderTop: "none", marginBottom: 0 }}>
        <div className="table-wrap" style={{ borderTop: "none" }}>
          <table>
            <thead><tr>
              <th>บริษัท / ผู้ติดต่อ</th><th>จังหวัด</th><th>แม่แบบ</th><th>ผู้รับผิดชอบ</th>
              <th className="num">มูลค่า</th><th>แหล่งที่มา</th><th>สถานะ</th><th></th>
            </tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 0 }}><EmptyState icon={<Users size={26} />} title="ไม่พบลูกค้าเป้าหมาย" description="ปรับตัวกรองหรือช่วงเวลา" /></td></tr>
              ) : filtered.map(l => {
                const c = leadStatusColor[l.status];
                const followUp = NEED_FOLLOWUP.includes(l.status);
                return (
                  <tr key={l.id} className="clickable" onClick={() => router.push(`/hq/customers`)}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {followUp && <span title="ยังไม่ติดตาม >7 วัน" style={{ width: 7, height: 7, borderRadius: "50%", background: "#EA580C", flexShrink: 0 }} />}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, color: "#1F2937", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.company}</div>
                          <div style={{ fontSize: "0.68rem", color: "var(--muted-foreground)" }}>{l.contact}</div>
                        </div>
                      </div>
                    </td>
                    <td><span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--muted-foreground)" }}><MapPin size={12} /> {l.province}</span></td>
                    <td style={{ color: "var(--muted-foreground)" }}>{l.product}</td>
                    <td style={{ color: "var(--muted-foreground)" }}>{l.assigned}</td>
                    <td className="num" style={{ fontWeight: 800, color: PRIMARY, whiteSpace: "nowrap" }}>{l.value?.startsWith("฿") ? l.value : fmtBaht(parseBaht(l.value))}</td>
                    <td style={{ color: "var(--muted-foreground)", fontSize: "0.78rem" }}>{l.source || "—"}</td>
                    <td><span className="badge" style={{ background: c.bg, color: c.text }}>{leadStatusLabel[l.status]}</span></td>
                    <td className="num"><ChevronRight size={15} color="#c0c0c0" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
