"use client";

import { Inbox } from "lucide-react";

// Empty State มาตรฐาน — ใช้ทุกตาราง/บอร์ด/รายงานที่ไม่มีข้อมูล
// ไอคอน + หัวข้อ + คำอธิบาย + ปุ่ม action (ไม่บังคับ)
export function EmptyState({
  icon, title, description, action, compact,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      textAlign: "center", gap: 4, padding: compact ? "28px 20px" : "56px 24px",
    }}>
      <div style={{
        width: compact ? 44 : 60, height: compact ? 44 : 60, borderRadius: "50%",
        background: "#f0f4f8", display: "flex", alignItems: "center", justifyContent: "center",
        color: "#94a3b8", marginBottom: 10,
      }}>
        {icon ?? <Inbox size={compact ? 22 : 28} />}
      </div>
      <div style={{ fontSize: compact ? "0.86rem" : "0.95rem", fontWeight: 800, color: "#2D2D2D" }}>{title}</div>
      {description && <div style={{ fontSize: "0.78rem", color: "#8a929c", maxWidth: 360, lineHeight: 1.6 }}>{description}</div>}
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  );
}
