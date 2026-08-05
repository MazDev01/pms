"use client";

// ─── แถวตารางที่คลิกเปิดรายละเอียดได้ — ใช้คีย์บอร์ดได้ด้วย ────────────────────────
//
// ปัญหาเดิม: ทุกหน้าลิสต์ในระบบเขียน <tr onClick={...} className="clickable"> ตรง ๆ ซึ่งเมาส์ใช้ได้
// แต่คีย์บอร์ดเข้าไม่ถึงเลย — โฟกัสไม่เคยลงบนแถว และไม่มีปุ่มไหนเปิดรายละเอียดได้
// ผู้ใช้ที่ใช้คีย์บอร์ดอย่างเดียว/โปรแกรมอ่านหน้าจอ จึงเปิดรายละเอียดจากตารางไม่ได้เลยแทบทุกหน้า
// (พบจากผลตรวจสอบระบบ 5 ส.ค. 69 · 10 จุดทั่วทั้งสองแอป)
//
// ทำเป็นคอมโพเนนต์กลางแทนการไล่แก้ทีละไฟล์ — เพิ่มหน้าใหม่ก็ได้พฤติกรรมถูกต้องมาตั้งแต่ต้น
// และถ้าต้องปรับเรื่องคีย์บอร์ดอีกในอนาคต แก้ที่เดียวมีผลทุกตาราง
//
// หมายเหตุการออกแบบ:
//   • ไม่ใส่ role="button" ทับ <tr> — จะทำให้โปรแกรมอ่านหน้าจอมองไม่เห็นโครงตาราง (แถว/คอลัมน์)
//     ซึ่งเสียมากกว่าได้ · ใช้ aria-label บอกว่ากดแล้วเกิดอะไรแทน
//   • Enter/Space ทำงานเฉพาะตอนโฟกัสอยู่ที่ "ตัวแถว" เท่านั้น — ถ้าโฟกัสอยู่ที่ปุ่มข้างในแถว
//     (เช่นปุ่มลบ/แก้ไข) ต้องปล่อยให้ปุ่มนั้นทำงานของมัน ไม่ใช่เปิดรายละเอียดซ้อนขึ้นมา
//   • Space ต้อง preventDefault ไม่งั้นหน้าเลื่อนลงตามพฤติกรรมปกติของเบราว์เซอร์
//   • เส้นโฟกัสมาจากกฎกลางใน globals.css ([tabindex]:focus-visible) ไม่ต้องตั้งเพิ่มที่นี่

import type { CSSProperties, KeyboardEvent, ReactNode } from "react";

export function ClickableRow({ onActivate, label, className, style, children }: {
  /** สิ่งที่เกิดขึ้นเมื่อคลิกหรือกด Enter/Space บนแถว */
  onActivate: () => void;
  /** คำอธิบายว่ากดแล้วเกิดอะไร เช่น "เปิดรายละเอียดลูกค้า บริษัท ก" — ผู้ใช้โปรแกรมอ่านหน้าจอต้องรู้ */
  label: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  function onKeyDown(e: KeyboardEvent<HTMLTableRowElement>) {
    // โฟกัสอยู่ที่ปุ่ม/ลิงก์ข้างในแถว → ปล่อยให้ตัวนั้นจัดการเอง
    if (e.target !== e.currentTarget) return;
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault(); // Space: กันหน้าเลื่อน
    onActivate();
  }

  return (
    <tr
      onClick={onActivate}
      onKeyDown={onKeyDown}
      tabIndex={0}
      aria-label={label}
      className={className}
      style={{ cursor: "pointer", ...style }}
    >
      {children}
    </tr>
  );
}
