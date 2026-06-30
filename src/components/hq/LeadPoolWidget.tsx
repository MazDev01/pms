"use client";

import Link from "next/link";
import { XCircle, AlertTriangle, Check } from "lucide-react";
import { leadPool } from "@/lib/mock";

function slaStyle(h: number): { Icon: React.ElementType; color: string; bg: string } {
  if (h >= 48) return { Icon: XCircle,       color: "#dc2626", bg: "#fee2e2" };
  if (h >= 24) return { Icon: AlertTriangle, color: "#d97706", bg: "#fef3cd" };
  return               { Icon: Check,        color: "#003366", bg: "#dce5f0" };
}

function formatWait(h: number): string {
  if (h < 24) return `${h} ชม.`;
  const d = Math.floor(h / 24);
  const r = h % 24;
  return r > 0 ? `${d} วัน ${r} ชม.` : `${d} วัน`;
}

export function LeadPoolWidget() {
  const total = leadPool.reduce((sum, r) => sum + r.valueNum, 0);
  const totalLabel = `฿${(total / 1_000_000).toFixed(1)}M`;
  const criticalCount = leadPool.filter(r => r.waitHours >= 48).length;

  // เรียงตาม urgency (รอนานสุดก่อน)
  const topLeads = [...leadPool].sort((a, b) => b.waitHours - a.waitHours).slice(0, 3);

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column" }}>
      <div className="card-header" style={{ alignItems: "flex-start" }}>
        <div>
          <div className="card-title">ลีดส่วนกลาง</div>
          <div className="card-desc">
            มูลค่ารวม <strong style={{ color: "#003366" }}>{totalLabel}</strong>
          </div>
        </div>
        <div style={{ display: "flex", gap: 5 }}>
          {criticalCount > 0 && (
            <span className="badge" style={{ background: "#fee2e2", color: "#dc2626" }}>
              <XCircle size={10} strokeWidth={2.5} /> {criticalCount} เกิน SLA
            </span>
          )}
          <span className="badge" style={{ background: "#fef3cd", color: "#d97706" }}>
            {leadPool.length} รอ
          </span>
        </div>
      </div>

      <div className="table-wrap" style={{ flex: 1 }}>
        <table>
          <tbody>
            {topLeads.map((r) => {
              const sla = slaStyle(r.waitHours);
              return (
                <tr key={r.id}>
                  <td style={{ width: 22 }}>
                    <span style={{
                      width: 22, height: 22, borderRadius: "50%", background: sla.bg,
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}><sla.Icon size={11} color={sla.color} strokeWidth={2.5} /></span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: "#2D2D2D", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.name}
                    </div>
                    <div style={{ fontSize: "0.62rem", display: "flex", gap: 6, marginTop: 1 }}>
                      <span style={{ color: "#6b7280" }}>{r.province} · {r.product}</span>
                      <span style={{ color: sla.color, fontWeight: 700 }}>{formatWait(r.waitHours)}</span>
                    </div>
                  </td>
                  <td className="num" style={{ fontWeight: 700, color: "#003366" }}>
                    {r.value}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ padding: "10px 1.2rem", borderTop: "1px solid var(--border)" }}>
        <Link href="/hq/lead-pool" style={{
          fontSize: "0.72rem", fontWeight: 700, color: "#003366", textDecoration: "none",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          จัดการลีดทั้งหมด →
        </Link>
      </div>
    </div>
  );
}
