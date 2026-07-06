"use client";

import { useState, useMemo } from "react";
import { hqAllQuotations, quotationStatusLabel, quotationStatusColor, type HQQuotation, type QuotationStatus } from "@/lib/mock";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { FilterBar } from "@/components/filters/FilterBar";
import { Search, Eye, X } from "lucide-react";

const PRIMARY = "#003366";
const MUTED = "#6b7280";
const AMBER = "#d97706";
const RED = "#dc2626";

function fmtM(n: number): string {
  if (n >= 1_000_000) return `฿${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `฿${(n / 1_000).toFixed(0)}K`;
  return `฿${n.toLocaleString()}`;
}

// สถานะ = enum เดียวกับฝั่งดีลเลอร์ (quotationStatusLabel/Color จาก mock) — แหล่งเดียว
function statusMeta(s: QuotationStatus) {
  const c = quotationStatusColor[s];
  return { label: quotationStatusLabel[s], bg: c.bg, color: c.text };
}

const STATUS_ORDER: Record<QuotationStatus, number> = {
  draft: 1, sent_to_client: 2, viewed: 3, won: 4, lost: 5, expired: 6,
};

const ALL_DEALERS = Array.from(
  new Map(
    hqAllQuotations.map((q) => [q.dealerCode, q.dealerName])
  ).entries()
).sort((a, b) => a[0].localeCompare(b[0]));

const ALL_PRODUCT_LINES = Array.from(
  new Set(hqAllQuotations.map((q) => q.productLine))
).sort();

const STATUS_OPTIONS: { value: QuotationStatus | "all"; label: string }[] = [
  { value: "all", label: "ทุกสถานะ" },
  { value: "draft", label: quotationStatusLabel.draft },
  { value: "sent_to_client", label: quotationStatusLabel.sent_to_client },
  { value: "won", label: quotationStatusLabel.won },
  { value: "lost", label: quotationStatusLabel.lost },
];

export default function HQQuotationsPage() {
  const [search, setSearch] = useState("");
  const [dealerFilter, setDealerFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<HQQuotation["status"] | "all">("all");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [viewQ, setViewQ] = useState<HQQuotation | null>(null); // View → เจาะดูใบเสนอราคา (HQ Data Ownership)

  // ขอบเขตของ pills/การ์ดสถานะ = ตัวแทนที่เลือก (ตัวเลือกเฉพาะหน้านี้)
  const scoped = useMemo(
    () => dealerFilter === "all" ? hqAllQuotations : hqAllQuotations.filter((q) => q.dealerCode === dealerFilter),
    [dealerFilter],
  );

  const stats = useMemo(() => {
    const total = scoped.length;
    const totalValue = scoped.reduce((s, q) => s + q.valueNum, 0);
    const won = scoped.filter((q) => q.status === "won").length;
    const lost = scoped.filter((q) => q.status === "lost").length;
    const winRate = won + lost > 0 ? Math.round((won / (won + lost)) * 100) : 0;
    const sent = scoped.filter((q) => q.status === "sent_to_client").length;
    return { total, totalValue, winRate, sent };
  }, [scoped]);

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
          <p>ติดตามใบเสนอราคาทุกตัวแทนในเครือ</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <FilterBar dims={[]} />
          <ExportMenu filename="hq-quotations" title="ใบเสนอราคา (ทั้งเครือ)"
            headers={["เลขที่","ตัวแทน","ลูกค้า","มูลค่า","ส่วนลด %","สถานะ","เซลส์","สายผลิตภัณฑ์"]}
            rows={filtered.map(q=>[q.quoteNo,q.dealerName,q.customer,q.valueNum,q.discountPct,quotationStatusLabel[q.status]??q.status,q.salesperson,q.productLine])} />
        </div>
      </div>

      {/* สรุป: pills + การ์ดสถานะคลิกกรอง (pattern เดียวกับฝั่งตัวแทน) */}
      {(() => {
        const BORDER = "#e5e7eb";
        const pill = (label: string, value: string) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.78rem", fontWeight: 700, color: "#2D2D2D", background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 99, padding: "7px 16px" }}>
            {label} <span style={{ color: PRIMARY }}>{value}</span>
          </div>
        );
        const ORDER: QuotationStatus[] = ["draft", "sent_to_client", "viewed", "won", "lost", "expired"];
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: "1.25rem" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {pill("ทั้งหมด", `${stats.total} ใบ`)}
              {pill("มูลค่ารวม", fmtM(stats.totalValue))}
              {pill("อัตราปิดการขาย", `${stats.winRate}%`)}
              {pill("ส่งแล้ว", `${stats.sent} ใบ`)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
              {ORDER.map((s) => {
                const sm = statusMeta(s);
                const items = scoped.filter((q) => q.status === s);
                const active = statusFilter === s;
                return (
                  <button key={s} onClick={() => setStatusFilter(active ? "all" : s)}
                    style={{ textAlign: "left", cursor: "pointer", background: "#fff", borderRadius: 12, padding: "12px 14px",
                      border: active ? `2px solid ${PRIMARY}` : `1px solid ${BORDER}`,
                      boxShadow: active ? "0 4px 14px rgba(0,51,102,.12)" : "none" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 26, height: 26, borderRadius: 99, background: sm.bg, color: sm.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.78rem", fontWeight: 800 }}>{items.length}</span>
                      <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "#2D2D2D" }}>{sm.label}</span>
                    </div>
                    <div style={{ fontSize: "0.72rem", fontWeight: 700, color: MUTED, marginTop: 7 }}>{fmtM(items.reduce((t, q) => t + q.valueNum, 0))}</div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Toolbar */}
      <div
        className="card"
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: "1.25rem",
          padding: "10px 14px",
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
          <option value="all">ทุกตัวแทน</option>
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
            <colgroup>
              <col style={{ width: "9%" }} />
              <col style={{ width: "21%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "9%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>เลขที่</th>
                <th>ลูกค้า</th>
                <th>ตัวแทน</th>
                <th>สายผลิตภัณฑ์</th>
                <th className="num">มูลค่า</th>
                <th className="num">ส่วนลด</th>
                <th>พนักงานขาย</th>
                <th>วันที่</th>
                <th>สถานะ</th>
                <th style={{ textAlign: "right" }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    style={{ textAlign: "center", padding: "32px 14px", color: MUTED }}
                  >
                    ไม่พบข้อมูลที่ค้นหา
                  </td>
                </tr>
              ) : (
                filtered.map((q) => {
                  const sm = statusMeta(q.status);
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

                      {/* Date — createdAt เป็นสตริงไทย (เช่น "24 มิ.ย. 2026") ใช้ new Date() ไม่ได้ จึงแสดงดิบ */}
                      <td style={{ color: MUTED, fontSize: "0.78rem", whiteSpace: "nowrap" }}>
                        {q.createdAt}
                      </td>

                      {/* Status Badge */}
                      <td style={{ whiteSpace: "nowrap" }}>
                        <span className="badge" style={{ background: sm.bg, color: sm.color }}>
                          {sm.label}
                        </span>
                      </td>
                      {/* View — HQ เจาะดูใบเสนอราคา */}
                      <td style={{ textAlign: "right" }}>
                        <button onClick={() => setViewQ(q)} className="btn btn-secondary btn-sm" style={{ color: PRIMARY }}>
                          <Eye size={13} /> ดู
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* View detail modal — HQ Data Ownership */}
      {viewQ && (
        <div onClick={() => setViewQ(null)} style={{ position: "fixed", inset: 0, background: "rgba(45,45,45,.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 460, background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,.22)" }}>
            <div style={{ background: PRIMARY, color: "#fff", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: "1rem", fontWeight: 800 }}>{viewQ.quoteNo}</div>
                <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,.7)", marginTop: 2 }}>{viewQ.customer} · {viewQ.dealerName}</div>
              </div>
              <button onClick={() => setViewQ(null)} style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,.15)", color: "#fff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={15} /></button>
            </div>
            <div style={{ padding: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {([
                ["ลูกค้า", viewQ.customer],
                ["ตัวแทน", `${viewQ.dealerCode} · ${viewQ.dealerName}`],
                ["สายผลิตภัณฑ์", viewQ.productLine],
                ["พนักงานขาย", viewQ.salesperson],
                ["มูลค่า", `฿${viewQ.valueNum.toLocaleString()}`],
                ["ส่วนลด", `${viewQ.discountPct}%`],
                ["สถานะ", quotationStatusLabel[viewQ.status]],
                ["วันที่", viewQ.createdAt],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} style={{ background: "#f8f9fb", borderRadius: 10, padding: "10px 12px" }}>
                  <div style={{ fontSize: "0.63rem", color: "#6b7280", marginBottom: 2 }}>{k}</div>
                  <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#2D2D2D" }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ padding: "0 20px 16px", fontSize: "0.66rem", color: "#9ca3af" }}>ข้อมูลเป็นของ Benjamin (HQ) — เจาะดูใบเสนอราคาได้ทุกตัวแทน (Data Ownership)</div>
          </div>
        </div>
      )}
    </div>
  );
}
