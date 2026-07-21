"use client";

// Badge/Status มาตรฐาน — โทนสีเดียวทั้งระบบ (คลาส .badge-* ใน globals.css)
export type BadgeTone = "primary" | "success" | "warning" | "danger" | "neutral" | "info";

export function Badge({ tone = "neutral", icon, children, style }: {
  tone?: BadgeTone;
  icon?: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <span className={`badge badge-${tone}`} style={style}>
      {icon}{children}
    </span>
  );
}
