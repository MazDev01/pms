"use client";

import type { CSSProperties, ReactNode } from "react";

// ── หัวคอลัมน์ที่กด "เรียงลำดับ" ได้ด้วยคีย์บอร์ด ────────────────────────────────
//
// ปัญหาเดิม (ผลตรวจสอบระบบรอบ 2): หัวคอลัมน์เรียงลำดับเขียนเป็น <th onClick={...}> เฉย ๆ
//   • กด Tab ไปไม่ถึง — คนที่ใช้คีย์บอร์ดอย่างเดียวเรียงลำดับตารางไม่ได้เลย
//   • โปรแกรมอ่านหน้าจอไม่รู้ว่าคอลัมน์นี้กดได้ และไม่รู้ว่าตอนนี้เรียงทางไหนอยู่
//     (ผู้ใช้ที่มองไม่เห็นจะไม่รู้เลยว่าตัวเลขที่กำลังฟังเรียงจากมากไปน้อยหรือน้อยไปมาก)
//
// aria-sort เป็นคุณสมบัติมาตรฐานของหัวตาราง — โปรแกรมอ่านหน้าจอจะอ่านว่า
// "เรียงจากน้อยไปมาก / มากไปน้อย" ให้อัตโนมัติ ไม่ต้องเขียนข้อความเอง
export function SortableTh({ label, active, dir, onSort, style, children }: {
  /** ข้อความหัวคอลัมน์ (ใช้เป็นชื่อเรียกให้โปรแกรมอ่านหน้าจอด้วย) */
  label: string;
  /** คอลัมน์นี้เป็นตัวที่กำลังใช้เรียงอยู่หรือไม่ */
  active: boolean;
  /** ทิศทางการเรียงปัจจุบัน (ใช้เมื่อ active) */
  dir: "asc" | "desc";
  /** ไม่ส่ง = คอลัมน์นี้เรียงไม่ได้ (แสดงเป็นหัวธรรมดา) */
  onSort?: () => void;
  style?: CSSProperties;
  /** เนื้อหาที่แสดงจริง (เช่น ข้อความ + ไอคอนลูกศร) — ไม่ส่งจะใช้ label */
  children?: ReactNode;
}) {
  if (!onSort) return <th style={style}>{children ?? label}</th>;
  return (
    <th
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
      style={{ cursor: "pointer", userSelect: "none", ...style }}
    >
      {/* ปุ่มจริงข้างใน — ได้พฤติกรรมคีย์บอร์ดครบ (Tab ถึง · Enter/Space ทำงาน · มีกรอบโฟกัส)
          โดยไม่ต้องยัด role="button" ทับ <th> ซึ่งจะทำให้โครงตารางหายไปจากโปรแกรมอ่านหน้าจอ */}
      <button
        type="button"
        onClick={onSort}
        aria-label={`เรียงตาม${label}`}
        style={{
          all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center",
          gap: 4, width: "100%", font: "inherit", color: "inherit",
        }}
      >
        {children ?? label}
      </button>
    </th>
  );
}
