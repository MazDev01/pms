"use client";

import { salesByMonth, leads, projects, leadStatusLabel, type LeadStatus } from "@/lib/mock";
import { useFilters } from "@/context/FilterContext";
import { FilterBar } from "@/components/filters/FilterBar";

const W = 560;
const H = 140;
const PAD = { top: 12, right: 12, bottom: 24, left: 36 };
const chartW = W - PAD.left - PAD.right;
const chartH = H - PAD.top - PAD.bottom;

function AreaChart({ data }: { data: { month: string; value: number }[] }) {
  const max = Math.max(...data.map(d => d.value)) * 1.15;
  const xs = data.map((_, i) => PAD.left + (i / (data.length - 1)) * chartW);
  const ys = data.map(d => PAD.top + chartH - (d.value / max) * chartH);
  const line = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  const area = line + ` L${xs[xs.length - 1].toFixed(1)},${(PAD.top + chartH).toFixed(1)} L${xs[0].toFixed(1)},${(PAD.top + chartH).toFixed(1)} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", display: "block" }}>
      <defs>
        <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#003366" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#003366" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#ag)" className="chart-area-fill" />
      <path d={line} fill="none" stroke="#003366" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {xs.map((x, i) => (
        <g key={i}>
          <circle cx={x} cy={ys[i]} r="3" fill="#003366" />
          <text x={x} y={H - 4} textAnchor="middle" fontSize="8" fill="#6b7280">{data[i].month}</text>
        </g>
      ))}
    </svg>
  );
}

const FUNNEL_ORDER: LeadStatus[] = ["NEW", "WAITING", "BULLET", "QUOTED", "PAID", "CANCELLED"];
const FUNNEL_COLOR: Record<LeadStatus, string> = {
  NEW: "#9ca3af", WAITING: "#82b4e3", BULLET: "#4d94d4",
  QUOTED: "#003366", PAID: "#059669", CANCELLED: "#dc2626",
};

export default function AnalyticsPage() {
  const { timeRange, passes } = useFilters();

  // กรองลีดจริงตามจังหวัด/สถานะ (ลีดไม่มีวันที่ → date ข้าม)
  const filteredLeads = leads.filter(l => passes({ province: l.province, status: l.status }));
  const funnelData = FUNNEL_ORDER.map(s => ({ status: s, count: filteredLeads.filter(l => l.status === s).length }));
  const maxFunnel = Math.max(...funnelData.map(d => d.count), 1);

  const projectByStatus = {
    in_progress: projects.filter(p => p.status === "in_progress").length,
    completed: projects.filter(p => p.status === "completed").length,
    not_started: projects.filter(p => p.status === "not_started").length,
    on_hold: projects.filter(p => p.status === "on_hold").length,
  };

  // สเกลยอดขายในกราฟตามช่วงเวลา (auto-refresh)
  const scaledSales = salesByMonth.map(d => ({ ...d, value: Math.round(d.value * timeRange.factor) }));

  return (
    <div className="erp">
      <div className="page-head">
        <div>
          <h2>วิเคราะห์การขาย</h2>
          <p>วิเคราะห์ข้อมูลยอดขาย ลีด และโอกาสการขาย · {timeRange.subtitle}</p>
        </div>
        <FilterBar dims={["province", "status"]} statusOptions={FUNNEL_ORDER.map(s => ({ value: s, label: leadStatusLabel[s] }))} />
      </div>

      {/* Stat cards — อัตรา/ค่าเฉลี่ย (intensive) ไม่สเกลตามช่วงเวลา; ส่วนนับลีดสเกลตามตัวกรอง */}
      <div className="stat-grid">
        {[
          { label: "อัตราปิดการขาย", value: "35%", delta: "+4.2%", up: true },
          { label: "มูลค่าโอกาสการขายเฉลี่ย", value: "฿1.8M", delta: "+8.6%", up: true },
          { label: "รอบการขาย", value: "42 วัน", delta: "-3 วัน", up: true },
          { label: "ลีดในมุมมองนี้", value: String(filteredLeads.length), delta: `จาก ${leads.length} ลีด`, up: true },
        ].map((s, i) => (
          <div key={i} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
            <div className={`stat-delta ${s.up ? "delta-up" : "delta-down"}`}>{s.delta}</div>
          </div>
        ))}
      </div>

      <div className="row-2-eq">
        {/* Area Chart */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">ยอดขายรายเดือน (K฿)</div>
              <div className="card-desc">{timeRange.subtitle}</div>
            </div>
          </div>
          <div className="card-body"><AreaChart data={scaledSales} /></div>
        </div>

        {/* Lead Funnel */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">ช่องทางลีด</div>
            </div>
          </div>
          <div className="card-body">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {funnelData.map((f, i) => (
                <div key={f.status} className="top5-row" style={{ display: "grid", gridTemplateColumns: "90px 1fr 28px", alignItems: "center", gap: 8, animationDelay: `${0.1 + i * 0.08}s` }}>
                  <span style={{ fontSize: "0.7rem", color: "#6b7280", fontWeight: 600, textAlign: "right" }}>{leadStatusLabel[f.status]}</span>
                  <div style={{ height: 8, background: "#f0f0f5", borderRadius: 99, overflow: "hidden" }}>
                    <div className="top5-bar" style={{ height: "100%", width: `${(f.count / maxFunnel) * 100}%`, background: FUNNEL_COLOR[f.status], borderRadius: 99, animationDelay: `${0.2 + i * 0.08}s` }} />
                  </div>
                  <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#2D2D2D" }}>{f.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Project status breakdown */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">สถานะโอกาสการขาย</div>
          </div>
        </div>
        <div className="card-body">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            {[
              { label: "กำลังดำเนินการ", value: projectByStatus.in_progress, color: "#003366", bg: "#dce5f0" },
              { label: "เสร็จแล้ว", value: projectByStatus.completed, color: "#059669", bg: "#e5faf0" },
              { label: "ยังไม่เริ่ม", value: projectByStatus.not_started, color: "#6b7280", bg: "#f0f0f5" },
              { label: "หยุดชั่วคราว", value: projectByStatus.on_hold, color: "#f59e0b", bg: "#fef3cd" },
            ].map(s => (
              <div key={s.label} style={{ background: s.bg, borderRadius: 12, padding: "14px 16px", textAlign: "center" }}>
                <div style={{ fontSize: "2rem", fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: "0.72rem", color: s.color, fontWeight: 600, marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
