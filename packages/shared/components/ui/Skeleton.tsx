"use client";

// Skeleton loading มาตรฐาน — shimmer ผ่านคลาส .skeleton (globals.css)
export function Skeleton({ w = "100%", h = 14, r = 8, style }: {
  w?: number | string; h?: number | string; r?: number; style?: React.CSSProperties;
}) {
  return <span className="skeleton" style={{ display: "block", width: w, height: h, borderRadius: r, ...style }} />;
}

// ข้อความหลายบรรทัด (บรรทัดสุดท้ายสั้นลง)
export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} h={12} w={i === lines - 1 ? "60%" : "100%"} />
      ))}
    </div>
  );
}

// การ์ด KPI/สรุป — แถวการ์ดสี่เหลี่ยม
export function SkeletonCards({ count = 4, height = 92 }: { count?: number; height?: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(180px, 1fr))`, gap: 14 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ border: "1px solid #eef1f5", borderRadius: 14, padding: 16, background: "#fff", display: "flex", flexDirection: "column", gap: 10 }}>
          <Skeleton w={90} h={11} />
          <Skeleton w="55%" h={22} />
          <Skeleton w="40%" h={10} />
        </div>
      ))}
    </div>
  );
}

// ตาราง — หัว + แถว
export function SkeletonTable({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div style={{ border: "1px solid #eef1f5", borderRadius: 14, overflow: "hidden", background: "#fff" }}>
      <div style={{ display: "flex", gap: 16, padding: "12px 16px", background: "#f7f9fc", borderBottom: "1px solid #eef1f5" }}>
        {Array.from({ length: cols }).map((_, i) => <Skeleton key={i} h={11} w={i === 0 ? "22%" : "14%"} />)}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{ display: "flex", gap: 16, padding: "14px 16px", borderBottom: r === rows - 1 ? "none" : "1px solid #f4f6fa" }}>
          {Array.from({ length: cols }).map((_, i) => <Skeleton key={i} h={13} w={i === 0 ? "22%" : "14%"} />)}
        </div>
      ))}
    </div>
  );
}
