import { type LeadStatus, leadStatusLabel, leadStatusColor } from "@/lib/mock";

// ใช้ป้ายสถานะ Sales Journey มาตรฐานเดียวจาก mock (ไม่ซ้ำซ้อน)
export function StatusBadge({ status }: { status: LeadStatus }) {
  const c = leadStatusColor[status];
  return (
    <span className="badge" style={{ background: c.bg, color: c.text }}>
      {leadStatusLabel[status]}
    </span>
  );
}
