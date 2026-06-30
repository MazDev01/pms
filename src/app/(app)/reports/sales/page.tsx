"use client";

import { salesByMonth, leads, projects, quotations, leadStatusLabel, type LeadStatus } from "@/lib/mock";
import { useFilters } from "@/context/FilterContext";
import { FilterBar } from "@/components/filters/FilterBar";

const LEAD_STATUS_ORDER: LeadStatus[] = ["NEW", "WAITING", "BULLET", "QUOTED", "PAID", "CANCELLED"];

const BAR_W = 600;
const BAR_H = 160;
const BAR_PL = 8;
const BAR_PB = 36;

function BarChart({ data }: { data: { month: string; value: number }[] }) {
  const max = Math.max(...data.map(d => d.value)) * 1.1;
  const gH = BAR_H - BAR_PB;
  const n = data.length;
  const colW = (BAR_W - BAR_PL * 2) / n;
  const barW = Math.min(colW * 0.5, 34);
  const yOf = (v: number) => 14 + gH - (v / max) * gH;
  return (
    <svg width="100%" viewBox={`0 0 ${BAR_W} ${BAR_H}`} style={{ display: "block", overflow: "visible", minWidth: 300 }}>
      {data.map((d, i) => {
        const cx = BAR_PL + i * colW + colW / 2;
        const y = yOf(d.value);
        const h = Math.max(14 + gH - y, 0);
        const isLatest = i === data.length - 1;
        return (
          <g key={i}>
            <text x={cx} y={y - 5} textAnchor="middle" fontSize={9} fill="#6b7280" fontWeight={700} fontFamily="'Noto Sans Thai',sans-serif">{d.value}</text>
            <rect className="sales-bar" x={cx - barW / 2} y={y} width={barW} height={h} rx={4} fill={isLatest ? "#003366" : "#ECC94B"} />
            <text x={cx} y={BAR_H - 8} textAnchor="middle" fontSize={9} fill="#6b7280" fontFamily="'Noto Sans Thai',sans-serif">{d.month}</text>
          </g>
        );
      })}
    </svg>
  );
}

export default function SalesReportPage() {
  const { timeRange, passes } = useFilters();

  // กรองลีดจริงตามจังหวัด/สถานะ (ลีดไม่มีวันที่ → date ข้าม; product เป็นข้อความไทยจึงไม่กรอง)
  const filteredLeads = leads.filter(l => passes({ province: l.province, status: l.status }));
  // ใบเสนอราคามีวันที่/จังหวัด → กรองตามช่วงเวลา + จังหวัดได้จริง
  const filteredQuotes = quotations.filter(q => passes({ date: q.date, province: q.province, status: q.status }));

  const wonLeads = filteredLeads.filter(l => l.status === "PAID");
  const completedProjects = projects.filter(p => p.status === "completed");
  const approvedQuotes = filteredQuotes.filter(q => q.status === "won");
  const totalApproved = approvedQuotes.reduce((s, q) => s + q.totalValue, 0);

  // สเกลยอดขายในกราฟ + ยอดขายรวมตามช่วงเวลา
  const scaledSales = salesByMonth.map(d => ({ ...d, value: Math.round(d.value * timeRange.factor) }));
  const quarterSales = 8.4 * timeRange.factor;

  return (
    <div className="erp">
      <div className="page-head">
        <div>
          <h2>รายงานยอดขาย</h2>
          <p>สรุปยอดขาย โอกาสการขายที่ปิดได้ และมูลค่ารวม · {timeRange.subtitle}</p>
        </div>
        <FilterBar
          dims={["province", "status"]}
          statusOptions={LEAD_STATUS_ORDER.map(s => ({ value: s, label: leadStatusLabel[s] }))}
        />
      </div>

      {/* Stat cards */}
      <div className="stat-grid">
        {[
          { label: "ยอดขายในช่วงนี้", value: `฿${quarterSales.toFixed(1)}M`, delta: "+12.3%", up: true },
          { label: "โอกาสการขายที่ปิดได้", value: wonLeads.length, delta: `จาก ${filteredLeads.length} ลีด`, up: true },
          { label: "ใบเสนอราคาอนุมัติ", value: `฿${(totalApproved / 1000000).toFixed(1)}M`, delta: `${approvedQuotes.length} ฉบับ`, up: true },
          { label: "โอกาสการขายที่ปิดได้", value: completedProjects.length, delta: "ไตรมาสนี้", up: true },
        ].map((s, i) => (
          <div key={i} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
            <div className={`stat-delta ${s.up ? "delta-up" : "delta-down"}`}>{s.delta}</div>
          </div>
        ))}
      </div>

      <div className="row-2">
        {/* Monthly bar chart */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">ยอดขายรายเดือน (K฿)</div>
            </div>
            <span style={{ fontSize: "0.68rem", color: "#6b7280" }}>{timeRange.subtitle}</span>
          </div>
          <div className="card-body"><BarChart data={scaledSales} /></div>
        </div>

        {/* Win vs Lost */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">ปิด / เสียโอกาสการขาย</div>
            </div>
          </div>
          <div className="card-body">
            {[
              { label: "ชำระเงินแล้ว", count: wonLeads.length, color: "#059669", bg: "#e5faf0" },
              { label: "ยกเลิก", count: filteredLeads.filter(l => l.status === "CANCELLED").length, color: "#dc2626", bg: "#fee2e2" },
              { label: "ออกใบเสนอราคา", count: filteredLeads.filter(l => l.status === "QUOTED").length, color: "#003366", bg: "#dce5f0" },
              { label: "รอติดตาม", count: filteredLeads.filter(l => ["NEW", "WAITING"].includes(l.status)).length, color: "#6b7280", bg: "#f0f0f5" },
            ].map(row => (
              <div key={row.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 10, background: row.bg, marginBottom: 6 }}>
                <span style={{ fontSize: "0.78rem", fontWeight: 600, color: row.color }}>{row.label}</span>
                <span style={{ fontSize: "1rem", fontWeight: 800, color: row.color }}>{row.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top deals table */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">โอกาสการขายที่ปิดได้สูงสุด</div>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {["ลูกค้า", "สินค้า", "มูลค่า", "จังหวัด", "สถานะ"].map(h => (
                  <th key={h} className={h === "มูลค่า" ? "num" : undefined}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...filteredLeads].sort((a, b) => {
                const va = parseFloat(a.value.replace(/[฿,MKB]/g, "")) * (a.value.includes("M") ? 1000000 : a.value.includes("K") ? 1000 : 1);
                const vb = parseFloat(b.value.replace(/[฿,MKB]/g, "")) * (b.value.includes("M") ? 1000000 : b.value.includes("K") ? 1000 : 1);
                return vb - va;
              }).slice(0, 5).map(l => (
                <tr key={l.id}>
                  <td style={{ fontWeight: 600 }}>{l.name}</td>
                  <td><span className="badge" style={{ background: "#dce5f0", color: "#003366" }}>{l.product}</span></td>
                  <td className="num" style={{ fontWeight: 800 }}>{l.value}</td>
                  <td style={{ color: "#6b7280" }}>{l.province}</td>
                  <td>
                    <span className="badge" style={{ background: l.status === "PAID" ? "#e5faf0" : l.status === "CANCELLED" ? "#fee2e2" : "#dce5f0", color: l.status === "PAID" ? "#059669" : l.status === "CANCELLED" ? "#dc2626" : "#003366" }}>
                      {l.status === "PAID" ? "ชำระเงินแล้ว" : l.status === "CANCELLED" ? "ยกเลิก" : "กำลังดำเนินการ"}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredLeads.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: "center", color: "#6b7280", padding: 20 }}>ไม่มีโอกาสการขายในช่วง/ตัวกรองที่เลือก</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
