"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

// หัวหน้าจอมาตรฐาน — breadcrumb + ชื่อหน้า + subtitle + ปุ่ม action (ขวา)
// ใช้ทุกหน้าเพื่อความสม่ำเสมอ (Enterprise SaaS)
export function PageHeader({
  title, subtitle, crumbs, actions,
}: {
  title: string;
  subtitle?: string;
  crumbs?: { label: string; href?: string }[];
  actions?: React.ReactNode;
}) {
  return (
    <div className="pg-head">
      <div style={{ minWidth: 0 }}>
        {crumbs && crumbs.length > 0 && (
          <nav className="pg-crumb" aria-label="breadcrumb">
            {crumbs.map((c, i) => (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                {i > 0 && <ChevronRight size={11} style={{ opacity: .5 }} />}
                {c.href ? <Link href={c.href}>{c.label}</Link> : <span>{c.label}</span>}
              </span>
            ))}
          </nav>
        )}
        <h1 className="pg-title">{title}</h1>
        {subtitle && <p className="pg-sub">{subtitle}</p>}
      </div>
      {actions && <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>{actions}</div>}
    </div>
  );
}
