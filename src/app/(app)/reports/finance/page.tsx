"use client";

import { quotations, projects } from "@/lib/mock";
import { useFilters } from "@/context/FilterContext";
import { FilterBar } from "@/components/filters/FilterBar";

const TXN_STATUS_OPTIONS = [
  { value: "รายรับ", label: "รายรับ" },
  { value: "รายจ่าย", label: "รายจ่าย" },
];

const TRANSACTIONS = [
  { date: "2026-06-20", name: "งวดที่ 1 — โกดัง EASYBUILD", client: "บจ. ไทยสตีล", type: "รายรับ", amount: "฿540,000", pos: true },
  { date: "2026-06-18", name: "ค่าวัสดุ", client: "โกดัง PEB ราชบุรี", type: "รายจ่าย", amount: "฿120,000", pos: false },
  { date: "2026-06-15", name: "งวดสุดท้าย — VCS Asia", client: "VCS Asia", type: "รายรับ", amount: "฿1,240,000", pos: true },
  { date: "2026-06-12", name: "เงินเดือนพนักงาน", client: "ภายใน", type: "รายจ่าย", amount: "฿185,000", pos: false },
  { date: "2026-06-10", name: "งวดที่ 2 — ERP ซีซีเอส", client: "บจ. ซีซีเอส", type: "รายรับ", amount: "฿800,000", pos: true },
];

const MONTHLY_CASH: { month: string; income: number; expense: number }[] = [
  { month: "ม.ค.", income: 1200, expense: 420 },
  { month: "ก.พ.", income: 980,  expense: 380 },
  { month: "มี.ค.", income: 1650, expense: 510 },
  { month: "เม.ย.", income: 2100, expense: 680 },
  { month: "พ.ค.", income: 1450, expense: 490 },
  { month: "มิ.ย.", income: 1820, expense: 560 },
];

const BAR_W = 600;
const BAR_H = 150;
const BAR_PL = 8;
const BAR_PB = 22;

function DualBar({ data }: { data: typeof MONTHLY_CASH }) {
  const max = Math.max(...data.flatMap(d => [d.income, d.expense])) * 1.1;
  const gH = BAR_H - BAR_PB;
  const n = data.length;
  const colW = (BAR_W - BAR_PL * 2) / n;
  const barW = Math.min(colW * 0.32, 26);
  const gap = colW * 0.06;
  const yOf = (v: number) => gH - (v / max) * gH;
  return (
    <svg width="100%" viewBox={`0 0 ${BAR_W} ${BAR_H}`} style={{ display: "block", overflow: "visible", minWidth: 320 }}>
      {data.map((d, i) => {
        const cx = BAR_PL + i * colW + colW / 2;
        const x1 = cx - barW - gap / 2;
        const x2 = cx + gap / 2;
        const hI = gH - yOf(d.income);
        const hE = gH - yOf(d.expense);
        return (
          <g key={i}>
            <rect className="sales-bar" x={x1} y={yOf(d.income)} width={barW} height={hI} rx={3} fill="#003366" />
            <rect className="sales-bar" x={x2} y={yOf(d.expense)} width={barW} height={hE} rx={3} fill="#ECC94B" />
            <text x={cx} y={BAR_H - 6} textAnchor="middle" fontSize={9} fill="#6b7280" fontFamily="'Noto Sans Thai',sans-serif">{d.month}</text>
          </g>
        );
      })}
    </svg>
  );
}

export default function FinancePage() {
  const { timeRange, passes } = useFilters();

  // สเกลกระแสเงินสดในกราฟ + ยอดสะสมตามช่วงเวลา (auto-refresh)
  const scaledCash = MONTHLY_CASH.map(d => ({
    ...d,
    income: Math.round(d.income * timeRange.factor),
    expense: Math.round(d.expense * timeRange.factor),
  }));
  const totalIncome = scaledCash.reduce((s, d) => s + d.income, 0);
  const totalExpense = scaledCash.reduce((s, d) => s + d.expense, 0);
  const totalApproved = quotations.filter(q => q.status === "won").reduce((s, q) => s + q.totalValue, 0);
  const projectValue = projects.filter(p => p.status === "in_progress").reduce((s, p) => {
    const v = parseFloat(p.value.replace(/[฿,MKB]/g, "").trim());
    return s + (p.value.includes("M") ? v * 1000000 : p.value.includes("K") ? v * 1000 : v);
  }, 0);

  // รายการล่าสุด: กรองจริงตามวันที่ + ประเภท (รายรับ/รายจ่าย)
  const filteredTxns = TRANSACTIONS.filter(t => passes({ date: t.date, status: t.type }));

  return (
    <div className="erp">
      <div className="page-head">
        <div>
          <h2>รายงานการเงิน</h2>
          <p>สรุปรายรับ รายจ่าย และกระแสเงินสด · {timeRange.subtitle}</p>
        </div>
        <FilterBar dims={["status"]} statusOptions={TXN_STATUS_OPTIONS} />
      </div>

      {/* Stat cards */}
      <div className="stat-grid">
        {[
          { label: "รายรับรวม (สะสม)", value: `฿${(totalIncome / 1000).toFixed(1)}M`, color: "#059669" },
          { label: "รายจ่ายรวม (สะสม)", value: `฿${(totalExpense / 1000).toFixed(1)}M`, color: "#dc2626" },
          { label: "กำไรสุทธิ (สะสม)", value: `฿${((totalIncome - totalExpense) / 1000).toFixed(1)}M`, color: "#003366" },
          { label: "มูลค่าโอกาสการขายที่กำลังดำเนินการ", value: `฿${(projectValue / 1000000).toFixed(1)}M`, color: "#2D2D2D" },
        ].map((s, i) => (
          <div key={i} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="row-2">
        {/* Cash flow chart */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">กระแสเงินสดรายเดือน (K฿)</div>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.68rem", color: "#6b7280" }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: "#003366", display: "inline-block" }} /> รายรับ
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.68rem", color: "#6b7280" }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: "#ECC94B", display: "inline-block" }} /> รายจ่าย
              </span>
            </div>
          </div>
          <div className="card-body"><DualBar data={scaledCash} /></div>
        </div>

        {/* Quick summary */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">สรุปการเงิน</div>
            </div>
          </div>
          <div className="card-body">
            {[
              { label: "ใบแจ้งหนี้ที่อนุมัติ", value: `฿${(totalApproved / 1000000).toFixed(1)}M`, color: "#059669" },
              { label: "รอเก็บเงิน", value: "฿4.2M", color: "#f59e0b" },
              { label: "เกินกำหนดชำระ", value: "฿0.8M", color: "#dc2626" },
              { label: "กำไรขั้นต้น", value: "65%", color: "#003366" },
            ].map(row => (
              <div key={row.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #f0f4f8" }}>
                <span style={{ fontSize: "0.78rem", color: "#6b7280", fontWeight: 600 }}>{row.label}</span>
                <span style={{ fontSize: "0.9rem", fontWeight: 800, color: row.color }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Transaction table */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">รายการล่าสุด</div>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {["วันที่", "รายการ", "ลูกค้า/โอกาสการขาย", "ประเภท", "จำนวน"].map(h => (
                  <th key={h} className={h === "จำนวน" ? "num" : undefined}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredTxns.map((r, i) => (
                <tr key={i}>
                  <td style={{ color: "#6b7280" }}>{r.date}</td>
                  <td style={{ fontWeight: 600 }}>{r.name}</td>
                  <td style={{ color: "#6b7280" }}>{r.client}</td>
                  <td>
                    <span className="badge" style={{ background: r.pos ? "#e5faf0" : "#fee2e2", color: r.pos ? "#059669" : "#dc2626" }}>{r.type}</span>
                  </td>
                  <td className="num" style={{ fontWeight: 800, color: r.pos ? "#059669" : "#dc2626" }}>
                    {r.pos ? "+" : "-"}{r.amount}
                  </td>
                </tr>
              ))}
              {filteredTxns.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: "center", color: "#6b7280", padding: 20 }}>ไม่มีรายการในช่วง/ตัวกรองที่เลือก</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
