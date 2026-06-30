"use client";

import React, { useState, useMemo } from "react";
import {
  commissions as INIT_DATA, commissionStatusLabel, commissionStatusColor,
  type CommissionMock, type CommissionStatus,
} from "@/lib/mock";
import { TrendingUp, DollarSign, Clock, CheckCircle2, Receipt, ChevronDown, ChevronUp } from "lucide-react";

const PRIMARY = "#003366";
const MUTED   = "#6b7280";

function fmt(n: number) { return "฿" + n.toLocaleString("th-TH"); }
function fmtDate(d: string | undefined) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  const mo = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  return `${parseInt(day)} ${mo[parseInt(m)-1]} ${parseInt(y)+543}`;
}

type SortKey = "closedDate" | "dealValue" | "commissionAmount" | "status";
type SortDir = "asc" | "desc";

export default function CommissionPage() {
  const [data]          = useState<CommissionMock[]>(INIT_DATA);
  const [filterStatus, setFilter] = useState<CommissionStatus | "ALL">("ALL");
  const [sortKey, setSortKey]     = useState<SortKey>("closedDate");
  const [sortDir, setSortDir]     = useState<SortDir>("desc");

  function handleSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("desc"); }
  }
  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ChevronDown size={10} style={{ marginLeft: 2, opacity: 0.3 }} />;
    return sortDir === "asc" ? <ChevronUp size={10} style={{ marginLeft: 2 }} /> : <ChevronDown size={10} style={{ marginLeft: 2 }} />;
  }

  const filtered = useMemo(() => {
    let rows = filterStatus === "ALL" ? data : data.filter(c => c.status === filterStatus);
    return [...rows].sort((a, b) => {
      const va = a[sortKey] as string | number;
      const vb = b[sortKey] as string | number;
      const cmp = typeof va === "number" ? (va - (vb as number)) : (va as string).localeCompare(vb as string, "th");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, filterStatus, sortKey, sortDir]);

  const stats = useMemo(() => {
    const paid     = data.filter(c => c.status === "paid");
    const approved = data.filter(c => c.status === "approved");
    const pending  = data.filter(c => c.status === "pending");
    return {
      totalEarned:   data.reduce((s, c) => s + c.commissionAmount, 0),
      paidAmount:    paid.reduce((s, c) => s + c.commissionAmount, 0),
      approvedAmount: approved.reduce((s, c) => s + c.commissionAmount, 0),
      pendingAmount: pending.reduce((s, c) => s + c.commissionAmount, 0),
      deals: data.length,
    };
  }, [data]);

  // Group by period for summary
  const byPeriod = useMemo(() => {
    const map: Record<string, { period: string; total: number; count: number; paid: boolean }> = {};
    data.forEach(c => {
      if (!map[c.period]) map[c.period] = { period: c.period, total: 0, count: 0, paid: c.status === "paid" };
      map[c.period].total += c.commissionAmount;
      map[c.period].count += 1;
      if (c.status !== "paid") map[c.period].paid = false;
    });
    return Object.values(map).reverse();
  }, [data]);

  const STATUSES: (CommissionStatus | "ALL")[] = ["ALL", "pending", "approved", "paid"];

  const STAT_CARDS = [
    { label: "รวมทุกงาน",    value: fmt(stats.totalEarned),    color: "#2D2D2D", icon: <TrendingUp size={20} />,  iconBg: "#eceef0", iconColor: "#2D2D2D" },
    { label: "จ่ายแล้ว",    value: fmt(stats.paidAmount),     color: "#059669", icon: <CheckCircle2 size={20} />, iconBg: "#e5faf0", iconColor: "#059669" },
    { label: "อนุมัติแล้ว", value: fmt(stats.approvedAmount), color: PRIMARY,   icon: <DollarSign size={20} />,   iconBg: "#dce5f0", iconColor: PRIMARY },
    { label: "รอการอนุมัติ", value: fmt(stats.pendingAmount),  color: "#d97706", icon: <Clock size={20} />,        iconBg: "#fff3cd", iconColor: "#d97706" },
  ];

  return (
    <div className="erp">
      {/* Header */}
      <div className="page-head">
        <div>
          <h2>คอมมิชชัน</h2>
          <p>รายได้ค่าคอมมิชชันจากการปิดการขาย</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="stat-grid">
        {STAT_CARDS.map((s, i) => (
          <div key={i} className="stat-card">
            <div className="stat-icon" style={{ background: s.iconBg, color: s.iconColor }}>{s.icon}</div>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 14 }}>
        {/* Main table */}
        <div>
          {/* Filter tabs */}
          <div className="tab-bar" style={{ marginBottom: 12 }}>
            {STATUSES.map(s => {
              const cnt = s === "ALL" ? data.length : data.filter(c => c.status === s).length;
              const active = filterStatus === s;
              return (
                <button key={s} onClick={() => setFilter(s)} className={`tab-item${active ? " active" : ""}`}>
                  {s === "ALL" ? "ทั้งหมด" : commissionStatusLabel[s]} ({cnt})
                </button>
              );
            })}
          </div>

          <div className="card" style={{ overflow: "hidden" }}>
            <div className="table-wrap" style={{ borderTop: "none" }}>
              <table>
                <thead>
                  <tr>
                    {([
                      { l: "รหัส / โอกาสการขาย", k: null },
                      { l: "ลูกค้า",         k: null },
                      { l: "งวด",            k: null },
                      { l: "วันปิดการขาย",       k: "closedDate" as SortKey },
                      { l: "มูลค่าโอกาสการขาย",       k: "dealValue" as SortKey, num: true },
                      { l: "% คอม",          k: null },
                      { l: "คอมมิชชัน",      k: "commissionAmount" as SortKey, num: true },
                      { l: "สถานะ",          k: "status" as SortKey },
                    ] as { l: string; k: SortKey | null; num?: boolean }[]).map((col, i) => (
                      <th key={i} onClick={col.k ? () => handleSort(col.k!) : undefined}
                        className={col.num ? "num" : undefined}
                        style={{ cursor: col.k ? "pointer" : "default" }}>
                        <span style={{ display: "inline-flex", alignItems: "center" }}>
                          {col.l}{col.k && <SortIcon k={col.k} />}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={8} style={{ textAlign: "center", padding: "40px 0", color: MUTED, fontSize: "0.82rem" }}>ไม่พบรายการ</td></tr>
                  )}
                  {filtered.map(c => {
                    const sc = commissionStatusColor[c.status];
                    return (
                      <tr key={c.id}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 30, height: 30, borderRadius: 8, background: "#dce5f0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <Receipt size={13} color={PRIMARY} />
                            </div>
                            <div>
                              <div style={{ fontSize: "0.72rem", fontWeight: 700, color: MUTED, fontFamily: "monospace" }}>{c.id}</div>
                              <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#2D2D2D", marginTop: 1 }}>{c.projectTitle}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ color: PRIMARY, fontWeight: 600 }}>{c.client}</td>
                        <td style={{ color: MUTED }}>{c.period}</td>
                        <td style={{ color: MUTED, whiteSpace: "nowrap" }}>{fmtDate(c.closedDate)}</td>
                        <td className="num" style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{fmt(c.dealValue)}</td>
                        <td>
                          <span className="badge" style={{ background: "#dce5f0", color: PRIMARY, fontWeight: 800 }}>
                            {c.commissionRate}%
                          </span>
                        </td>
                        <td className="num" style={{ fontSize: "1rem", fontWeight: 800, color: c.status === "paid" ? "#059669" : c.status === "approved" ? PRIMARY : "#d97706", whiteSpace: "nowrap" }}>
                          {fmt(c.commissionAmount)}
                        </td>
                        <td>
                          <div>
                            <span className="badge" style={{ background: sc.bg, color: sc.text }}>
                              {commissionStatusLabel[c.status]}
                            </span>
                            {c.paidDate && (
                              <div style={{ fontSize: "0.62rem", color: MUTED, marginTop: 3 }}>จ่าย: {fmtDate(c.paidDate)}</div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", fontSize: "0.72rem", color: MUTED }}>
              แสดง {filtered.length}/{data.length} รายการ
            </div>
          </div>
        </div>

        {/* Period summary sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Rate info */}
          <div className="card">
            <div className="card-body" style={{ padding: "16px 18px" }}>
              <div className="card-title" style={{ marginBottom: 12 }}>อัตราคอมมิชชัน</div>
              <div style={{ background: "#dce5f0", borderRadius: 12, padding: "14px 16px", textAlign: "center" }}>
                <div style={{ fontSize: "2.2rem", fontWeight: 900, color: PRIMARY, lineHeight: 1 }}>5%</div>
                <div style={{ fontSize: "0.7rem", color: MUTED, marginTop: 4 }}>ของมูลค่าโอกาสการขายที่ปิดแล้ว</div>
              </div>
              <div style={{ marginTop: 12, fontSize: "0.72rem", color: MUTED, lineHeight: 1.6 }}>
                คำนวณจากยอด <strong>ปิดการขาย (won)</strong> เท่านั้น<br />
                ชำระทุกต้นเดือนถัดไป หลัง HQ อนุมัติ
              </div>
            </div>
          </div>

          {/* Period breakdown */}
          <div className="card">
            <div className="card-body" style={{ padding: "16px 18px" }}>
              <div className="card-title" style={{ marginBottom: 14 }}>สรุปรายเดือน</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {byPeriod.map((p, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: "var(--muted)", borderRadius: 10, border: "1px solid var(--border)" }}>
                    <div>
                      <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#2D2D2D" }}>{p.period}</div>
                      <div style={{ fontSize: "0.65rem", color: MUTED, marginTop: 2 }}>{p.count} โอกาสการขาย</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "0.9rem", fontWeight: 800, color: p.paid ? "#059669" : "#d97706" }}>{fmt(p.total)}</div>
                      <div style={{ fontSize: "0.62rem", color: p.paid ? "#059669" : MUTED, marginTop: 2 }}>
                        {p.paid ? "จ่ายแล้ว" : "รอดำเนินการ"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Total summary */}
          <div className="card" style={{ background: PRIMARY, border: "none" }}>
            <div className="card-body" style={{ padding: "16px 18px" }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "rgba(255,255,255,.7)", marginBottom: 6 }}>คอมมิชชันรวมทั้งหมด</div>
              <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#fff" }}>{fmt(stats.totalEarned)}</div>
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                {[
                  { label: "จ่ายแล้ว",    value: fmt(stats.paidAmount),     color: "#4ade80" },
                  { label: "อนุมัติแล้ว", value: fmt(stats.approvedAmount), color: "#93c5fd" },
                  { label: "รอการอนุมัติ", value: fmt(stats.pendingAmount),  color: "#fcd34d" },
                ].map((r, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem" }}>
                    <span style={{ color: "rgba(255,255,255,.65)" }}>{r.label}</span>
                    <span style={{ color: r.color, fontWeight: 700 }}>{r.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
