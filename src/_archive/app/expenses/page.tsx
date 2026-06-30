"use client";

import { useState, useMemo } from "react";
import { LayoutList, PieChart, Plus, Search, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import {
  expenses,
  expenseCategoryLabel,
  billingStatusLabel,
  billingStatusColor,
  BillingStatus,
  ExpenseCategory,
  ExpenseMock,
} from "@/lib/mock";

type SortKey = "date" | "amount" | "client";
type SortDir = "asc" | "desc";
type View = "list" | "summary";

const categoryOptions: { value: "" | ExpenseCategory; label: string }[] = [
  { value: "", label: "ทั้งหมด" },
  { value: "travel", label: expenseCategoryLabel["travel"] },
  { value: "printing", label: expenseCategoryLabel["printing"] },
  { value: "testing", label: expenseCategoryLabel["testing"] },
  { value: "equipment", label: expenseCategoryLabel["equipment"] },
  { value: "other", label: expenseCategoryLabel["other"] },
];

const categoryBadgeColor: Record<ExpenseCategory, { bg: string; text: string }> = {
  travel:    { bg: "#dce5f0", text: "#003366" },
  printing:  { bg: "#fef3cd", text: "#d97706" },
  testing:   { bg: "#dce5f0", text: "#003366" },
  equipment: { bg: "#e5faf0", text: "#059669" },
  other:     { bg: "#f0f0f5", text: "#6b7280" },
};

const categoryAccentColor: Record<ExpenseCategory, string> = {
  travel:    "#003366",
  printing:  "#d97706",
  testing:   "#003366",
  equipment: "#059669",
  other:     "#6b7280",
};

function formatAmount(n: number) {
  return "฿" + n.toLocaleString("th-TH");
}

function formatDate(d: string) {
  const [y, m, day] = d.split("-");
  const months = ["","ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  return `${parseInt(day)} ${months[parseInt(m)]} ${parseInt(y) + 543}`;
}

export default function ExpensesPage() {
  const [billingFilter, setBillingFilter] = useState<"" | BillingStatus>("");
  const [categoryFilter, setCategoryFilter] = useState<"" | ExpenseCategory>("");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [view, setView] = useState<View>("list");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const filtered = useMemo(() => {
    let rows: ExpenseMock[] = [...expenses];
    if (billingFilter) rows = rows.filter((r) => r.billingStatus === billingFilter);
    if (categoryFilter) rows = rows.filter((r) => r.category === categoryFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.client.toLowerCase().includes(q) ||
          r.project.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q)
      );
    }
    rows.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "date") cmp = a.date.localeCompare(b.date);
      else if (sortKey === "amount") cmp = a.amount - b.amount;
      else if (sortKey === "client") cmp = a.client.localeCompare(b.client);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [billingFilter, categoryFilter, search, sortKey, sortDir]);

  const totalAll = expenses.length;
  const totalBillable = expenses.filter((e) => e.billingStatus === "billable").length;
  const totalNotBillable = expenses.filter((e) => e.billingStatus === "not_billable").length;
  const sumAll = expenses.reduce((s, e) => s + e.amount, 0);

  const sumFiltered = filtered.reduce((s, e) => s + e.amount, 0);
  const sumBillableFiltered = filtered
    .filter((e) => e.billingStatus === "billable" || e.billingStatus === "billed")
    .reduce((s, e) => s + e.amount, 0);

  const billingPills: { value: "" | BillingStatus; label: string }[] = [
    { value: "", label: "ทั้งหมด" },
    { value: "billable", label: billingStatusLabel["billable"] },
    { value: "not_billable", label: billingStatusLabel["not_billable"] },
    { value: "billed", label: billingStatusLabel["billed"] },
  ];

  const SortIcon = ({ col }: { col: SortKey }) =>
    sortKey === col ? (
      sortDir === "asc"
        ? <ArrowUp size={11} color="#003366" style={{ marginLeft: 4 }} />
        : <ArrowDown size={11} color="#003366" style={{ marginLeft: 4 }} />
    ) : (
      <ArrowUpDown size={11} color="#C0C0C0" style={{ marginLeft: 4 }} />
    );

  // Summary view data
  const categoryBreakdown = useMemo(() => {
    const cats: ExpenseCategory[] = ["travel", "printing", "testing", "equipment", "other"];
    return cats.map((cat) => {
      const rows = expenses.filter((e) => e.category === cat);
      const total = rows.reduce((s, e) => s + e.amount, 0);
      const pct = sumAll > 0 ? (total / sumAll) * 100 : 0;
      return { cat, count: rows.length, total, pct };
    });
  }, [sumAll]);

  const top5 = useMemo(() => {
    return [...expenses].sort((a, b) => b.amount - a.amount).slice(0, 5);
  }, []);

  const statCards = [
    { label: "ทั้งหมด", value: `${totalAll} รายการ`, sub: "รายการค่าใช้จ่าย", accent: "#003366" },
    { label: "เรียกเก็บได้", value: `${totalBillable} รายการ`, sub: "รอส่งใบแจ้งหนี้", accent: "#059669" },
    { label: "ไม่เรียกเก็บ", value: `${totalNotBillable} รายการ`, sub: "บริษัทรับผิดชอบ", accent: "#dc2626" },
    { label: "ยอดรวมทั้งหมด", value: formatAmount(sumAll), sub: "มูลค่าค่าใช้จ่ายสะสม", accent: "#d97706" },
  ];

  return (
    <div className="erp">
      {/* Header */}
      <div className="page-head">
        <div>
          <h2>ค่าใช้จ่าย</h2>
          <p>ติดตามและจัดการค่าใช้จ่ายทั้งหมดของโอกาสการขาย</p>
        </div>
        <button className="btn btn-primary btn-md">
          <Plus size={15} /> เพิ่มค่าใช้จ่าย
        </button>
      </div>

      {/* Stat Cards */}
      <div className="stat-grid">
        {statCards.map((s) => (
          <div key={s.label} className="stat-card">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.accent }} />
              <span className="stat-label" style={{ marginBottom: 0 }}>{s.label}</span>
            </div>
            <div className="stat-value">{s.value}</div>
            <div className="card-desc" style={{ marginTop: 4 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Filter + Search Bar */}
      <div className="card" style={{ padding: "14px 16px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {/* Billing Pill Filters */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {billingPills.map((p) => {
              const active = billingFilter === p.value;
              return (
                <button
                  key={p.value}
                  onClick={() => setBillingFilter(p.value)}
                  style={{
                    padding: "6px 16px",
                    borderRadius: 99,
                    border: active ? "1px solid #003366" : "1px solid #e5e7eb",
                    background: active ? "#003366" : "#fff",
                    color: active ? "#fff" : "#2D2D2D",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          <div style={{ width: 1, height: 28, background: "#e5e7eb", margin: "0 4px" }} />

          {/* Category Dropdown */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as "" | ExpenseCategory)}
            className="form-select"
            style={{ width: "auto", cursor: "pointer" }}
          >
            {categoryOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          {/* Search */}
          <div style={{ flex: 1, minWidth: 200, display: "flex", alignItems: "center", gap: 8,
            background: "#fafafa", border: "1px solid #e5e7eb", borderRadius: 10, padding: "7px 12px" }}>
            <Search size={14} color="#6b7280" />
            <input
              type="text"
              placeholder="ค้นหา ลูกค้า โอกาสการขาย รายละเอียด..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ border: "none", outline: "none", fontSize: "0.8rem", color: "#2D2D2D",
                background: "transparent", flex: 1, fontFamily: "inherit" }}
            />
          </div>

          {/* View Toggle */}
          <div style={{ display: "flex", background: "#f3f4f6", borderRadius: 99, padding: 3, gap: 2,
            marginLeft: "auto", flexShrink: 0 }}>
            <button
              onClick={() => setView("list")}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 14px",
                borderRadius: 99, border: "none", cursor: "pointer", fontSize: "0.75rem", fontWeight: 700,
                background: view === "list" ? "#003366" : "transparent",
                color: view === "list" ? "#fff" : "#6b7280", fontFamily: "inherit" }}
            >
              <LayoutList size={14} />
              รายการ
            </button>
            <button
              onClick={() => setView("summary")}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 14px",
                borderRadius: 99, border: "none", cursor: "pointer", fontSize: "0.75rem", fontWeight: 700,
                background: view === "summary" ? "#003366" : "transparent",
                color: view === "summary" ? "#fff" : "#6b7280", fontFamily: "inherit" }}
            >
              <PieChart size={14} />
              สรุป
            </button>
          </div>
        </div>
      </div>

      {/* Conditional View */}
      {view === "list" ? (
        /* Table */
        <div className="card">
          <div className="table-wrap" style={{ borderTop: "none" }}>
            <table style={{ minWidth: 860 }}>
              <thead>
                <tr>
                  {[
                    { label: "วันที่", col: "date" as SortKey, sortable: true },
                    { label: "ลูกค้า", col: "client" as SortKey, sortable: true },
                    { label: "โอกาสการขาย", col: null, sortable: false },
                    { label: "หมวดหมู่", col: null, sortable: false },
                    { label: "รายละเอียด", col: null, sortable: false },
                    { label: "ยอด", col: "amount" as SortKey, sortable: true },
                    { label: "สถานะการเรียกเก็บ", col: null, sortable: false },
                  ].map((h, i) => (
                    <th
                      key={i}
                      className={h.col === "amount" ? "num" : undefined}
                      onClick={() => h.sortable && h.col && handleSort(h.col)}
                      style={{ cursor: h.sortable ? "pointer" : "default", userSelect: "none" }}
                    >
                      {h.label}
                      {h.sortable && h.col && <SortIcon col={h.col} />}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: "40px 16px", textAlign: "center", color: "#6b7280", fontSize: "0.84rem" }}>
                      ไม่พบรายการค่าใช้จ่าย
                    </td>
                  </tr>
                ) : (
                  filtered.map((row) => {
                    const catColor = categoryBadgeColor[row.category];
                    const blColor = billingStatusColor[row.billingStatus];
                    return (
                      <tr key={row.id}>
                        <td style={{ color: "#6b7280", whiteSpace: "nowrap" }}>{formatDate(row.date)}</td>
                        <td>
                          <span style={{ fontWeight: 700, color: "#003366" }}>{row.client}</span>
                        </td>
                        <td style={{ maxWidth: 200 }}>
                          <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                            {row.project}
                          </span>
                        </td>
                        <td>
                          <span className="badge" style={{ background: catColor.bg, color: catColor.text }}>
                            {expenseCategoryLabel[row.category]}
                          </span>
                        </td>
                        <td>{row.description}</td>
                        <td className="num" style={{ fontWeight: 800, color: "#003366", whiteSpace: "nowrap" }}>
                          {formatAmount(row.amount)}
                        </td>
                        <td>
                          <span className="badge" style={{ background: blColor.bg, color: blColor.text }}>
                            {billingStatusLabel[row.billingStatus]}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div style={{ padding: "14px 16px", borderTop: "1px solid #e5e7eb", display: "flex",
            alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <span style={{ fontSize: "0.78rem", color: "#6b7280" }}>
              แสดง {filtered.length} จาก {expenses.length} รายการ
            </span>
            <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: "0.78rem", color: "#6b7280" }}>ยอดรวม:</span>
                <span style={{ fontSize: "0.95rem", fontWeight: 800, color: "#003366" }}>
                  {formatAmount(sumFiltered)}
                </span>
              </div>
              <div style={{ width: 1, height: 18, background: "#e5e7eb" }} />
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: "0.78rem", color: "#6b7280" }}>เรียกเก็บได้รวม:</span>
                <span style={{ fontSize: "0.95rem", fontWeight: 800, color: "#059669" }}>
                  {formatAmount(sumBillableFiltered)}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Summary View */
        <div>
          {/* Category Breakdown Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16, marginBottom: 16 }}>
            {categoryBreakdown.map(({ cat, count, total, pct }) => {
              const accent = categoryAccentColor[cat];
              const badge = categoryBadgeColor[cat];
              return (
                <div key={cat} className="card" style={{ padding: "18px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: badge.bg,
                        display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <PieChart size={18} color={accent} />
                      </div>
                      <div>
                        <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#2D2D2D" }}>
                          {expenseCategoryLabel[cat]}
                        </div>
                        <div className="card-desc">{count} รายการ</div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#003366" }}>
                        {formatAmount(total)}
                      </div>
                      <span className="badge" style={{ marginTop: 3, background: badge.bg, color: accent }}>
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  {/* Progress Bar */}
                  <div style={{ height: 6, borderRadius: 999, background: "var(--muted)", overflow: "hidden" }}>
                    <div
                      className="top5-bar"
                      style={{ height: "100%", width: `${pct}%`, borderRadius: 999, background: accent }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Top 5 Expenses Table */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">5 อันดับค่าใช้จ่ายสูงสุด</div>
            </div>
            <div className="table-wrap">
              <table style={{ minWidth: 640 }}>
                <thead>
                  <tr>
                    {["#", "วันที่", "ลูกค้า", "รายละเอียด", "ยอด", "สถานะการเรียกเก็บ"].map((h, i) => (
                      <th key={i} className={i === 4 ? "num" : undefined}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {top5.map((row, idx) => {
                    const blColor = billingStatusColor[row.billingStatus];
                    return (
                      <tr key={row.id}>
                        <td style={{ fontWeight: 700, color: "#C0C0C0", width: 40 }}>{idx + 1}</td>
                        <td style={{ color: "#6b7280", whiteSpace: "nowrap" }}>{formatDate(row.date)}</td>
                        <td>
                          <span style={{ fontWeight: 700, color: "#003366" }}>{row.client}</span>
                        </td>
                        <td>{row.description}</td>
                        <td className="num" style={{ fontWeight: 800, color: "#003366", whiteSpace: "nowrap" }}>
                          {formatAmount(row.amount)}
                        </td>
                        <td>
                          <span className="badge" style={{ background: blColor.bg, color: blColor.text }}>
                            {billingStatusLabel[row.billingStatus]}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
