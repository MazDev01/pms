"use client";

import { useState, useMemo } from "react";
import { HQCustomer } from "@/lib/mock";
import { useFilters } from "@/context/FilterContext";
import { useNetworkCustomers } from "@/lib/useNetworkData";
import { FilterBar } from "@/components/filters/FilterBar";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { Search, X } from "lucide-react";

const PRIMARY = "#003366";

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
  const [segFilter, setSegFilter] = useState<HQCustomer["segment"] | "all">("all");
  // ตัวเลือกตัวแทนเฉพาะหน้านี้ (แต่ละหน้า HQ เลือกแยกกัน ไม่จำข้ามหน้า)
  const [dealerSel, setDealerSel] = useState<string>("all");
  // สถานะ/จังหวัด — ตัวกรองเฉพาะหน้านี้ (local) รวมแถวเดียวกับค้นหา+ตัวแทน ในทูลบาร์
  const [statusFilter, setStatusFilter] = useState<"all" | HQCustomer["status"]>("all");
  const [provinceFilter, setProvinceFilter] = useState<string>("all");
  const [viewC, setViewC] = useState<HQCustomer | null>(null); // View → เจาะดูรายละเอียดลูกค้า (HQ Data Ownership)

  // ลูกค้าทั้งเครือ (แหล่งเดียว) — ที่ Dealer สร้างจริง + seed สาขาอื่น → HQ เห็นข้อมูลที่ปลายทางสร้าง
  const source = useNetworkCustomers();

  // กรองจริงด้วย FilterBar (เฉพาะเวลา) + ตัวแทน/สถานะ/จังหวัด/ค้นหา (local ในหน้านี้)
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return source
      .filter((c) => {
        if (q && !c.name.toLowerCase().includes(q) && !c.province.toLowerCase().includes(q))
          return false;
        if (segFilter !== "all" && c.segment !== segFilter) return false;
        if (dealerSel !== "all" && c.dealerCode !== dealerSel) return false;
        if (statusFilter !== "all" && c.status !== statusFilter) return false;
        if (provinceFilter !== "all" && c.province !== provinceFilter) return false;
        return passes({ date: c.lastContact });
      })
      .sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [search, passes, source, segFilter, dealerSel, statusFilter, provinceFilter]);

  // ตัวเลือกตัวแทนจากข้อมูลจริงในหน้า
  const dealerOptions = useMemo(() => {
    const m = new Map<string, string>();
    source.forEach(c => m.set(c.dealerCode, c.dealerName));
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [source]);

  // ตัวเลือกจังหวัดจากข้อมูลจริงในหน้า
  const provinceOptions = useMemo(() => {
    const set = new Set<string>();
    source.forEach(c => c.province && set.add(c.province));
    return [...set].sort((a, b) => a.localeCompare(b, "th"));
  }, [source]);

  // ขอบเขตข้อมูลของ pills/การ์ดสรุป = ตัวแทนที่เลือก
  const scoped = useMemo(
    () => dealerSel === "all" ? source : source.filter(c => c.dealerCode === dealerSel),
    [source, dealerSel],
  );

  return (
    <div className="erp">
      {/* Header */}
      <div className="page-head">
        <div>
          <p>ฐานข้อมูลลูกค้าทุกตัวแทน · {timeRange.subtitle}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <FilterBar dims={[]} />
          <ExportMenu filename="hq-customers" title="ลูกค้าทั้งเครือ"
            headers={["ลูกค้า","ประเภท","จังหวัด","ตัวแทน","โอกาสการขายที่ชนะ","รายได้รวม","สถานะ","ติดต่อล่าสุด"]}
            rows={filtered.map(c=>[c.name,c.type,c.province,c.dealerName,c.dealsWon,c.totalRevenue,c.status==="active"?"ใช้งาน":"ไม่ใช้งาน",c.lastContact])} />
        </div>
      </div>

      {/* สรุป: pills + การ์ดกลุ่มลูกค้าคลิกกรอง (pattern เดียวกับฝั่งตัวแทน) */}
      {(() => {
        const BORDER = "#e5e7eb";
        const totalRevenue = scoped.reduce((s, c) => s + c.totalRevenue, 0);
        const activeCount = scoped.filter((c) => c.status === "active").length;
        const pill = (label: string, value: string) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem", fontWeight: 700, color: "#2D2D2D", background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 99, padding: "7px 16px" }}>
            {label} <span style={{ color: PRIMARY }}>{value}</span>
          </div>
        );
        const SEGMENTS: HQCustomer["segment"][] = ["enterprise", "sme", "government"];
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: "1.25rem" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {pill("ลูกค้าทั้งหมด", `${scoped.length} ราย`)}
              {pill("ใช้งานอยู่", `${activeCount} ราย`)}
              {pill("มูลค่ารวม", `฿${fmtM(totalRevenue)}`)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {SEGMENTS.map((seg) => {
                const cfg = segmentBadgeMap[seg];
                const items = scoped.filter((c) => c.segment === seg);
                const active = segFilter === seg;
                return (
                  <button key={seg} onClick={() => setSegFilter(active ? "all" : seg)}
                    style={{ textAlign: "left", cursor: "pointer", background: "#fff", borderRadius: 12, padding: "12px 14px",
                      border: active ? `2px solid ${PRIMARY}` : `1px solid ${BORDER}`,
                      boxShadow: active ? "0 4px 14px rgba(0,51,102,.12)" : "none" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 26, height: 26, borderRadius: 99, background: cfg.bg, color: cfg.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem", fontWeight: 800 }}>{items.length}</span>
                      <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#2D2D2D" }}>{segmentLabel[seg]}</span>
                    </div>
                    <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#6b7280", marginTop: 7 }}>฿{fmtM(items.reduce((t, c) => t + c.totalRevenue, 0))}</div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Toolbar — ค้นหา + ตัวแทน/สถานะ/จังหวัด รวมแถวเดียว (เหมือนหน้าใบเสนอราคาทั้งเครือ) */}
      <div className="card" style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center", flexWrap: "wrap", padding: "10px 14px" }}>
        <div className="search-bar">
          <Search size={14} color="#9ca3af" strokeWidth={2} />
          <input
            type="text"
            placeholder="ค้นหาชื่อลูกค้า หรือจังหวัด..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ flex: 1 }} />
        <select value={dealerSel} onChange={(e) => setDealerSel(e.target.value)} className="form-select" style={{ width: "auto", cursor: "pointer" }}>
          <option value="all">ทุกตัวแทน</option>
          {dealerOptions.map(([code, name]) => (
            <option key={code} value={code}>{code} – {name}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className="form-select" style={{ width: "auto", cursor: "pointer" }}>
          <option value="all">ทุกสถานะ</option>
          <option value="active">ใช้งาน</option>
          <option value="inactive">ไม่ใช้งาน</option>
        </select>
        <select value={provinceFilter} onChange={(e) => setProvinceFilter(e.target.value)} className="form-select" style={{ width: "auto", cursor: "pointer" }}>
          <option value="all">ทุกจังหวัด</option>
          {provinceOptions.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
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
            </colgroup>
            <thead>
              <tr>
                <th>ลูกค้า</th>
                <th>ประเภท</th>
                <th>ตัวแทน</th>
                <th>จังหวัด</th>
                <th>กลุ่มลูกค้า</th>
                <th className="num">โอกาสการขายที่ชนะ</th>
                <th className="num">มูลค่ารวม</th>
                <th>ติดต่อล่าสุด</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", padding: "40px 14px", color: "#6b7280" }}>
                    ไม่พบลูกค้า
                  </td>
                </tr>
              ) : (
                filtered.map((c) => {
                  const typeCfg = typeBadgeMap[c.type];
                  const segCfg = segmentBadgeMap[c.segment];
                  return (
                    <tr key={c.id} onClick={() => setViewC(c)} style={{ cursor: "pointer" }}>
                      {/* ลูกค้า */}
                      <td style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{c.name}</td>

                      {/* ประเภท */}
                      <td>
                        <span className="badge" style={{ background: typeCfg.bg, color: typeCfg.color }}>
                          {c.type}
                        </span>
                      </td>

                      {/* ตัวแทน */}
                      <td style={{ whiteSpace: "nowrap" }}>
                        <span style={{ fontWeight: 600, color: PRIMARY }}>{c.dealerCode}</span>
                        <span style={{ color: "#6b7280", marginLeft: 4, fontSize: "0.72rem" }}>
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
              fontSize: "0.72rem",
              color: "#6b7280",
            }}
          >
            แสดง {filtered.length} รายการ จากทั้งหมด {source.length} ลูกค้า
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
                <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,.7)", marginTop: 2 }}>{viewC.dealerName} · {viewC.province}</div>
              </div>
              <button onClick={() => setViewC(null)} style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,.15)", color: "#fff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={15} /></button>
            </div>
            <div style={{ padding: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {([
                ["ประเภท", viewC.type],
                ["กลุ่มลูกค้า", segmentLabel[viewC.segment]],
                ["จังหวัด", viewC.province],
                ["ตัวแทนที่ดูแล", `${viewC.dealerCode} · ${viewC.dealerName}`],
                ["โอกาสการขายที่ชนะ", `${viewC.dealsWon}`],
                ["มูลค่ารวม", viewC.totalRevenue > 0 ? fmtM(viewC.totalRevenue) : "-"],
                ["ติดต่อล่าสุด", viewC.lastContact],
                ["สถานะ", viewC.status === "active" ? "ใช้งาน" : "ไม่ใช้งาน"],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} style={{ background: "#f8f9fb", borderRadius: 10, padding: "10px 12px" }}>
                  <div style={{ fontSize: "0.65rem", color: "#6b7280", marginBottom: 2 }}>{k}</div>
                  <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#2D2D2D" }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ padding: "0 20px 16px", fontSize: "0.65rem", color: "#9ca3af" }}>ข้อมูลเป็นของ Benjamin (HQ) — เจาะดูได้ทุกตัวแทน (Data Ownership)</div>
          </div>
        </div>
      )}
    </div>
  );
}
