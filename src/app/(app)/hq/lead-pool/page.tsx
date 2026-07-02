"use client";

import { LeadPoolTable } from "@/components/hq/LeadPoolTable";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { leadPool } from "@/lib/mock";

export default function HQLeadPoolPage() {
  const totalValue = leadPool.reduce((s, l) => {
    const v = parseFloat(l.value.replace(/[฿,MKB]/g, "").trim());
    return s + (l.value.includes("M") ? v * 1000000 : l.value.includes("K") ? v * 1000 : v);
  }, 0);

  const KPIS = [
    { label: "ลีดรอมอบหมาย", value: String(leadPool.length), icon: "kpi-amber", glyph: "⏳" },
    { label: "มูลค่ารวม", value: `฿${(totalValue / 1000000).toFixed(1)}M`, icon: "kpi-navy", glyph: "฿" },
    { label: "ช่องทางหลัก", value: "เว็บไซต์", icon: "kpi-green", glyph: "@" },
  ];

  return (
    <div className="erp">
      {/* Header */}
      <div className="page-head">
        <div>
          <h2>ผู้สนใจส่วนกลาง</h2>
          <p>ผู้สนใจจากช่องทาง HQ ที่ยังไม่ได้มอบหมายสาขา</p>
        </div>
        <ExportMenu filename="hq-lead-pool" title="ผู้สนใจส่วนกลาง (รอมอบหมาย)"
          headers={["รหัส","ชื่อ","จังหวัด","ช่องทาง","สินค้า","มูลค่า","เข้ามาเมื่อ","รอ (ชม.)"]}
          rows={leadPool.map(l=>[l.id,l.name,l.province,l.channel,l.product,l.value,l.createdAt,l.waitHours])} />
      </div>

      {/* KPI counts */}
      <div className="kpi-bar" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {KPIS.map(k => (
          <div key={k.label} className="kpi" style={{ flexDirection: "row", alignItems: "center", gap: "0.75rem" }}>
            <div className={`kpi-icon ${k.icon}`} style={{ fontWeight: 900 }}>{k.glyph}</div>
            <div>
              <div className="kpi-val">{k.value}</div>
              <div className="kpi-label">{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Lead pool table (self-contained card) */}
      <LeadPoolTable />
    </div>
  );
}
