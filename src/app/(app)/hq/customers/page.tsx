"use client";

import { useState, useMemo } from "react";
import { hqAllCustomers, HQCustomer } from "@/lib/mock";
import { useFilters } from "@/context/FilterContext";
import { FilterBar } from "@/components/filters/FilterBar";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { Search, Users, Building2, Landmark, User, Eye, X } from "lucide-react";

const PRIMARY = "#003366";
const GREEN = "#059669";

function fmtM(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString("th-TH");
}

type TypeBadgeConfig = {
  bg: string;
  color: string;
};

const typeBadgeMap: Record<HQCustomer["type"], TypeBadgeConfig> = {
  บริษัท: { bg: "#dce5f0", color: "#003366" },
  "หจก.": { bg: "#fef3cd", color: "#92400e" },
  บุคคล: { bg: "#f0f0f5", color: "#4b5563" },
  หน่วยงานรัฐ: { bg: "#e5faf0", color: "#065f46" },
};

const segmentBadgeMap: Record<HQCustomer["segment"], TypeBadgeConfig> = {
  enterprise: { bg: "#dce5f0", color: "#003366" },
  sme: { bg: "#fef3cd", color: "#92400e" },
  government: { bg: "#e5faf0", color: "#065f46" },
};

const segmentLabel: Record<HQCustomer["segment"], string> = {
  enterprise: "องค์กรขนาดใหญ่",
  sme: "SME",
  government: "ภาครัฐ",
};

export default function HQCustomersPage() {
  const { timeRange, passes } = useFilters();
  const [search, setSearch] = useState("");
  const [viewC, setViewC] = useState<HQCustomer | null>(null); // View → เจาะดูรายละเอียดลูกค้า (HQ Data Ownership)

  // กรองจริงด้วย FilterBar (time/dealer/province/status) + search ในหน้า
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return hqAllCustomers
      .filter((c) => {
        if (q && !c.name.toLowerCase().includes(q) && !c.province.toLowerCase().includes(q))
          return false;
        return passes({
          date: c.lastContact,
          dealer: c.dealerCode,
          province: c.province,
          status: c.status,
        });
      })
      .sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [search, passes]);

  // KPI สรุปคำนวณจากชุดที่กรองแล้ว
  const enterpriseCount = filtered.filter((c) => c.segment === "enterprise").length;
  const smeCount = filtered.filter((c) => c.segment === "sme").length;
  const govCount = filtered.filter((c) => c.segment === "government").length;

  const STATS = [
    { label: "ลูกค้าทั้งหมด", value: filtered.length, icon: <Users size={20} color={PRIMARY} strokeWidth={2} />, iconBg: "#dce5f0" },
    { label: "องค์กรขนาดใหญ่", value: enterpriseCount, icon: <Building2 size={20} color={PRIMARY} strokeWidth={2} />, iconBg: "#dce5f0" },
    { label: "SME", value: smeCount, icon: <User size={20} color="#d97706" strokeWidth={2} />, iconBg: "#fff3cd" },
    { label: "หน่วยงานรัฐ", value: govCount, icon: <Landmark size={20} color={GREEN} strokeWidth={2} />, iconBg: "#e5faf0" },
  ];

  return (
    <div className="erp">
      {/* Header */}
      <div className="page-head">
        <div>
          <h2>ลูกค้าทั้งเครือ</h2>
          <p>ฐานข้อมูลลูกค้าทุกสาขา · {timeRange.subtitle}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <FilterBar
            dims={["dealer", "province", "status"]}
            statusOptions={[{ value: "active", label: "ใช้งาน" }, { value: "inactive", label: "ไม่ใช้งาน" }]}
          />
          <ExportMenu filename="hq-customers" title="ลูกค้าทั้งเครือ"
            headers={["ลูกค้า","ประเภท","จังหวัด","สาขา","ดีลที่ปิด","รายได้รวม","สถานะ","ติดต่อล่าสุด"]}
            rows={filtered.map(c=>[c.name,c.type,c.province,c.dealerName,c.dealsWon,c.totalRevenue,c.status==="active"?"ใช้งาน":"ไม่ใช้งาน",c.lastContact])} />
        </div>
      </div>

      {/* Stat cards */}
      <div className="stat-grid">
        {STATS.map((s) => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon" style={{ background: s.iconBg }}>{s.icon}</div>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          gap: 10,
          marginBottom: 16,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div className="search-bar" style={{ flex: "1 1 220px", minWidth: 180 }}>
          <Search size={14} color="#9ca3af" strokeWidth={2} />
          <input
            type="text"
            placeholder="ค้นหาชื่อลูกค้า หรือจังหวัด..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table Card */}
      <div className="card">
        <div className="table-wrap" style={{ borderTop: "none" }}>
          <table>
            <colgroup>
              <col style={{ width: "21%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "8%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>ลูกค้า</th>
                <th>ประเภท</th>
                <th>สาขา</th>
                <th>จังหวัด</th>
                <th>กลุ่มลูกค้า</th>
                <th className="num">โอกาสการขายที่ชนะ</th>
                <th className="num">มูลค่ารวม</th>
                <th>ติดต่อล่าสุด</th>
                <th>สถานะ</th>
                <th style={{ textAlign: "right" }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: "center", padding: "40px 14px", color: "#6b7280" }}>
                    ไม่พบลูกค้า
                  </td>
                </tr>
              ) : (
                filtered.map((c) => {
                  const typeCfg = typeBadgeMap[c.type];
                  const segCfg = segmentBadgeMap[c.segment];
                  return (
                    <tr key={c.id}>
                      {/* ลูกค้า */}
                      <td style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{c.name}</td>

                      {/* ประเภท */}
                      <td>
                        <span className="badge" style={{ background: typeCfg.bg, color: typeCfg.color }}>
                          {c.type}
                        </span>
                      </td>

                      {/* สาขา */}
                      <td style={{ whiteSpace: "nowrap" }}>
                        <span style={{ fontWeight: 600, color: PRIMARY }}>{c.dealerCode}</span>
                        <span style={{ color: "#6b7280", marginLeft: 4, fontSize: "0.75rem" }}>
                          {c.dealerName}
                        </span>
                      </td>

                      {/* จังหวัด */}
                      <td style={{ whiteSpace: "nowrap" }}>{c.province}</td>

                      {/* Segment */}
                      <td>
                        <span className="badge" style={{ background: segCfg.bg, color: segCfg.color }}>
                          {segmentLabel[c.segment]}
                        </span>
                      </td>

                      {/* ดีลที่ชนะ */}
                      <td className="num">{c.dealsWon}</td>

                      {/* มูลค่ารวม */}
                      <td
                        className="num"
                        style={{
                          whiteSpace: "nowrap",
                          fontWeight: c.totalRevenue > 0 ? 700 : 400,
                          color: c.totalRevenue > 0 ? PRIMARY : "#6b7280",
                        }}
                      >
                        {c.totalRevenue > 0 ? fmtM(c.totalRevenue) : "-"}
                      </td>

                      {/* ติดต่อล่าสุด */}
                      <td style={{ color: "#6b7280", whiteSpace: "nowrap" }}>{c.lastContact}</td>

                      {/* สถานะ */}
                      <td>
                        {c.status === "active" ? (
                          <span className="badge" style={{ background: "#d1fae5", color: "#065f46" }}>
                            ใช้งาน
                          </span>
                        ) : (
                          <span className="badge" style={{ background: "#f3f4f6", color: "#6b7280" }}>
                            ไม่ใช้งาน
                          </span>
                        )}
                      </td>
                      {/* View — HQ เจาะดูรายละเอียดลูกค้า */}
                      <td style={{ textAlign: "right" }}>
                        <button onClick={() => setViewC(c)} className="btn btn-secondary btn-sm" style={{ color: PRIMARY }}>
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

        {/* Footer count */}
        {filtered.length > 0 && (
          <div
            style={{
              padding: "10px 16px",
              borderTop: "1px solid var(--border)",
              fontSize: "0.75rem",
              color: "#6b7280",
            }}
          >
            แสดง {filtered.length} รายการ จากทั้งหมด {hqAllCustomers.length} ลูกค้า
          </div>
        )}
      </div>

      {/* View detail modal — HQ Data Ownership */}
      {viewC && (
        <div onClick={() => setViewC(null)} style={{ position: "fixed", inset: 0, background: "rgba(45,45,45,.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 460, background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,.22)" }}>
            <div style={{ background: PRIMARY, color: "#fff", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: "1rem", fontWeight: 800 }}>{viewC.name}</div>
                <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,.7)", marginTop: 2 }}>{viewC.dealerName} · {viewC.province}</div>
              </div>
              <button onClick={() => setViewC(null)} style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,.15)", color: "#fff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={15} /></button>
            </div>
            <div style={{ padding: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {([
                ["ประเภท", viewC.type],
                ["กลุ่มลูกค้า", segmentLabel[viewC.segment]],
                ["จังหวัด", viewC.province],
                ["สาขาที่ดูแล", `${viewC.dealerCode} · ${viewC.dealerName}`],
                ["โอกาสการขายที่ชนะ", `${viewC.dealsWon}`],
                ["มูลค่ารวม", viewC.totalRevenue > 0 ? fmtM(viewC.totalRevenue) : "-"],
                ["ติดต่อล่าสุด", viewC.lastContact],
                ["สถานะ", viewC.status === "active" ? "ใช้งาน" : "ไม่ใช้งาน"],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} style={{ background: "#f8f9fb", borderRadius: 10, padding: "10px 12px" }}>
                  <div style={{ fontSize: "0.63rem", color: "#6b7280", marginBottom: 2 }}>{k}</div>
                  <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#2D2D2D" }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ padding: "0 20px 16px", fontSize: "0.66rem", color: "#9ca3af" }}>ข้อมูลเป็นของ Benjamin (HQ) — เจาะดูได้ทุกสาขา (Data Ownership)</div>
          </div>
        </div>
      )}
    </div>
  );
}
