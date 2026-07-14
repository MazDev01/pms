"use client";

// ── ปุ่มเฉพาะหน้า → ไปแสดงบน "แถบบน" แถวเดียวกับชื่อหน้า/ค้นหา/กระดิ่ง/โปรไฟล์ ──
// ใช้แทน .page-head เดิม: หน้าไหนมีปุ่ม (ตัวกรอง · ส่งออก · เพิ่มรายการ) ครอบด้วย <TopbarActions> พอ
// ชื่อหน้ามาจาก TITLE_MAP ใน Topbar (แหล่งเดียว) — ห้ามใส่หัวซ้ำในเนื้อหาอีก
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function TopbarActions({ children }: { children: React.ReactNode }) {
  // ช่องเสียบมีจริงหลัง mount เท่านั้น → กัน hydration mismatch
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => { setSlot(document.getElementById("topbar-slot")); }, []);
  if (!slot) return null;
  return createPortal(children, slot);
}
