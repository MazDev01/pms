"use client";

import { useState, useMemo } from "react";
import { hqAllQuotations, HQQuotation } from "@/lib/mock";
import {
  Search,
  FileText,
  TrendingUp,
  CheckCircle2,
  Send,
} from "lucide-react";

const PRIMARY = "#003366";
const MUTED = "#6b7280";
const AMBER = "#d97706";
const RED = "#dc2626";
const GREEN = "#059669";

function fmtM(n: number): string {
  if (n >= 1_000_000) return `฿${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `฿${(n / 1_000).toFixed(0)}K`;
  return `฿${n.toLocaleString()}`;
}

const STATUS_META: Record<
  HQQuotation["status"],
  { label: string; bg: string; color: string }
> = {
  draft: { label: "ร่าง", bg: "#f0f0f5", color: "#6b7280" },
  sent: { label: "ส่งแล้ว", bg: "#dce5f0", color: "#003366" },
  won: { label: "ชนะ ✓", bg: "#e5faf0", color: "#059669" },
  lost: { label: "แพ้", bg: "#fee2e2", color: "#dc2626" },
};

const STATUS_ORDER: Record<HQQuotation["status"], number> = {
  draft: 1,
  sent: 2,
  won: 3,
  lost: 4,
};

const ALL_DEALERS = Array.from(
  new Map(
    hqAllQuotations.map((q) => [q.dealerCode, q.dealerName])
  ).entries()
).sort((a, b) => a[0].localeCompare(b[0]));

const ALL_PRODUCT_LINES = Array.from(
  new Set(hqAllQuotations.map((q) => q.productLine))
).sort();

const STATUS_OPTIONS: { value: HQQuotation["status"] | "all"; label: string }[] = [
  { value: "all", label: "ทุกสถานะ" },
  { value: "draft", label: "ร่าง" },
  { value: "sent", label: "ส่งแล้ว" },
  { value: "won", label: "ชนะ" },
  { value: "lost", label: "แพ้" },
];

export default function HQQuotationsPage() {
  const [search, setSearch] = useState("");
  const [dealerFilter, setDealerFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<HQQuotation["status"] | "all">("all");
  const [productFilter, setProductFilter] = useState<string>("all");

  const stats = useMemo(() => {
    const total = hqAllQuotations.length;
    const totalValue = hqAllQuotations.reduce((s, q) => s + q.valueNum, 0);
    const won = hqAllQuotations.filter((q) => q.status === "won").length;
    const lost = hqAllQuotations.filter((q) => q.status === "lost").length;
    const winRate = won + lost > 0 ? Math.round((won / (won + lost)) * 100) : 0;
    const sent = hqAllQuotations.filter((q) => q.status === "sent").length;
    return { total, totalValue, winRate, sent };
  }, []);

  const filtered = useMemo(() => {
    let list = [...hqAllQuotations];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.quoteNo.toLowerCase().includes(q) ||
          r.customer.toLowerCase().includes(q)
      );
    }
    if (dealerFilter !== "all") {
      list = list.filter((r) => r.dealerCode === dealerFilter);
    }
    if (statusFilter !== "all") {
      list = list.filter((r) => r.status === statusFilter);
    }
    if (productFilter !== "all") {
      list = list.filter((r) => r.productLine === productFilter);
    }

    list.sort((a, b) => {
      const so = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      if (so !== 0) return so;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return list;
  }, [search, dealerFilter, statusFilter, productFilter]);

  return (
    <div className="erp">
      {/* Header */}
      <div className="page-head">
        <div>
          <h2>ใบเสนอราคาทั้งเครือ</h2>
          <p>ติดตามใบเสนอราคาทุกสาขาในเครือ</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="stat-grid">
        {/* Total */}
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#dce5f0", color: PRIMARY }}>
            <FileText size={18} strokeWidth={2} />
          </div>
          <div className="stat-label">ทั้งหมด</div>
          <div className="stat-value">{stats.total}</div>
          <div className="stat-delta" style={{ color: MUTED, fontWeight: 600 }}>ใบเสนอราคา</div>
        </div>

        {/* Total Value */}
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#e5faf0", color: GREEN }}>
            <TrendingUp size={18} strokeWidth={2} />
          </div>
          <div className="stat-label">มูลค่ารวม</div>
          <div className="stat-value" style={{ color: GREEN }}>{fmtM(stats.totalValue)}</div>
          <div className="stat-delta" style={{ color: MUTED, fontWeight: 600 }}>มูลค่าทั้งหมด</div>
        </div>

        {/* Win Rate */}
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#dce5f0", color: PRIMARY }}>
            <CheckCircle2 size={18} strokeWidth={2} />
          </div>
          <div className="stat-label">อัตราปิดการขาย</div>
          <div className="stat-value">{stats.winRate}%</div>
          <div className="stat-delta" style={{ color: MUTED, fontWeight: 600 }}>อัตราชนะต่อปิด</div>
        </div>

        {/* Sent to client */}
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#eceef0", color: "#2D2D2D" }}>
            <Send size={18} strokeWidth={2} />
          </div>
          <div className="stat-label">ส่งแล้ว</div>
          <div className="stat-value">{stats.sent}</div>
          <div className="stat-delta" style={{ color: MUTED, fontWeight: 600 }}>รายการที่ส่งให้ลูกค้า</div>
        </div>
      </div>

      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: "1.25rem",
        }}
      >
        {/* Search */}
        <div style={{ position: "relative", flex: "1 1 220px", minWidth: 180 }}>
          <Search
            size={14}
            color={MUTED}
            strokeWidth={2}
            style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}
          />
          <input
            type="text"
            placeholder="ค้นหาเลขที่ / ลูกค้า..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input"
            style={{ paddingLeft: 32 }}
          />
        </div>

        {/* Dealer Filter */}
        <select
          value={dealerFilter}
          onChange={(e) => setDealerFilter(e.target.value)}
          className="form-select"
          style={{ width: "auto", cursor: "pointer" }}
        >
          <option value="all">ทุกสาขา</option>
          {ALL_DEALERS.map(([code, name]) => (
            <option key={code} value={code}>
              {code} – {name}
            </option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as HQQuotation["status"] | "all")
          }
          className="form-select"
          style={{ width: "auto", cursor: "pointer" }}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Product Line Filter */}
        <select
          value={productFilter}
          onChange={(e) => setProductFilter(e.target.value)}
          className="form-select"
          style={{ width: "auto", cursor: "pointer" }}
        >
          <option value="all">ทุกสายผลิตภัณฑ์</option>
          {ALL_PRODUCT_LINES.map((pl) => (
            <option key={pl} value={pl}>
              {pl}
            </option>
          ))}
        </select>

        <span style={{ fontSize: "0.78rem", color: MUTED, whiteSpace: "nowrap" }}>
          แสดง {filtered.length} / {hqAllQuotations.length} รายการ
        </span>
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-wrap" style={{ borderTop: "none" }}>
          <table>
            <thead>
              <tr>
                <th>เลขที่</th>
                <th>ลูกค้า</th>
                <th>สาขา</th>
                <th>สายผลิตภัณฑ์</th>
                <th className="num">มูลค่า</th>
                <th className="num">ส่วนลด</th>
                <th>พนักงานขาย</th>
                <th>วันที่</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    style={{ textAlign: "center", padding: "32px 14px", color: MUTED }}
                  >
                    ไม่พบข้อมูลที่ค้นหา
                  </td>
                </tr>
              ) : (
                filtered.map((q) => {
                  const sm = STATUS_META[q.status];
                  const discountColor =
                    q.discountPct >= 10
                      ? RED
                      : q.discountPct >= 5
                      ? AMBER
                      : MUTED;

                  return (
                    <tr key={q.id}>
                      {/* Quote No */}
                      <td style={{ color: PRIMARY, fontWeight: 700, whiteSpace: "nowrap" }}>
                        {q.quoteNo}
                      </td>

                      {/* Customer */}
                      <td
                        style={{
                          maxWidth: 180,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {q.customer}
                      </td>

                      {/* Dealer */}
                      <td style={{ whiteSpace: "nowrap" }}>
                        <span className="badge" style={{ background: "#eef2f7", color: PRIMARY }}>
                          {q.dealerCode}
                        </span>
                        <span style={{ marginLeft: 6, fontSize: "0.75rem", color: MUTED }}>
                          {q.dealerName}
                        </span>
                      </td>

                      {/* Product Line */}
                      <td style={{ whiteSpace: "nowrap" }}>{q.productLine}</td>

                      {/* Value */}
                      <td
                        className="num"
                        style={{ color: PRIMARY, fontWeight: 800, whiteSpace: "nowrap" }}
                      >
                        {fmtM(q.valueNum)}
                      </td>

                      {/* Discount */}
                      <td
                        className="num"
                        style={{
                          color: discountColor,
                          fontWeight: q.discountPct >= 5 ? 700 : 400,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {q.discountPct}%
                      </td>

                      {/* Salesperson */}
                      <td style={{ whiteSpace: "nowrap" }}>{q.salesperson}</td>

                      {/* Date */}
                      <td style={{ color: MUTED, fontSize: "0.78rem", whiteSpace: "nowrap" }}>
                        {new Date(q.createdAt).toLocaleDateString("th-TH", {
                          day: "2-digit",
                          month: "short",
                          year: "2-digit",
                        })}
                      </td>

                      {/* Status Badge */}
                      <td style={{ whiteSpace: "nowrap" }}>
                        <span className="badge" style={{ background: sm.bg, color: sm.color }}>
                          {sm.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
