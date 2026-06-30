import type { LeadStatus } from "@/lib/mock";

const config: Record<LeadStatus, { label: string; bg: string; color: string }> = {
  NEW:       { label: "ใหม่",                  bg: "#f0f0f5", color: "#6b7280" },
  WAITING:   { label: "กำลังรอรายละเอียด",     bg: "#dce5f0", color: "#003366" },
  BULLET:    { label: "เสนอบูเลท",             bg: "#dce5f0", color: "#003366" },
  QUOTED:    { label: "ออกใบเสนอราคา",         bg: "#dce5f0", color: "#003366" },
  PAID:      { label: "ชำระเงินแล้ว ✓",        bg: "#e5faf0", color: "#059669" },
  CANCELLED: { label: "ยกเลิก",               bg: "#fee2e2", color: "#dc2626" },
};

export function StatusBadge({ status }: { status: LeadStatus }) {
  const { label, bg, color } = config[status];
  return (
    <span className="badge" style={{ background: bg, color }}>
      {label}
    </span>
  );
}
