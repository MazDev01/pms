"use client";

import { useEffect, useRef } from "react";

// ── โมดัลที่ใช้คีย์บอร์ดได้จริง ─────────────────────────────────────────────────
//
// ปัญหาเดิม (ผลตรวจสอบระบบรอบ 2 · ระดับสูง · ~25 โมดัลทั้งระบบ):
//   • กด Escape ปิดไม่ได้ — ต้องเล็งเมาส์ไปคลิกปุ่ม X หรือฉากหลังเท่านั้น
//   • โฟกัสไม่ถูกกักไว้ในโมดัล — กด Tab ไปเรื่อย ๆ แล้วหลุดไปอยู่กับปุ่มที่อยู่ "ข้างหลัง" โมดัล
//     ผู้ใช้คีย์บอร์ด/โปรแกรมอ่านหน้าจอจึงหลงทาง กดปุ่มที่มองไม่เห็น และออกจากโมดัลไม่ได้
//   • ปิดโมดัลแล้วโฟกัสหายไปที่ต้นหน้า ต้อง Tab ไล่ใหม่ทั้งหน้าเพื่อกลับไปจุดเดิม
//
// รวมไว้ที่เดียว = โมดัลใหม่ในอนาคตได้พฤติกรรมถูกต้องมาตั้งแต่ต้น ไม่ต้องจำมาทำซ้ำทีละที่
//
// วิธีใช้:
//   const ref = useModalA11y<HTMLDivElement>(onClose);
//   return <div ref={ref} role="dialog" aria-modal="true"> ... </div>
export function useModalA11y<T extends HTMLElement>(onClose: () => void) {
  const ref = useRef<T>(null);
  // เก็บ onClose ล่าสุดไว้ใน ref — ผู้เรียกส่ง arrow function ใหม่ทุกครั้งที่ re-render
  // ถ้าใส่ไว้ใน dependency ตรง ๆ จะถอด/ใส่ event listener ใหม่ทุกเฟรมโดยไม่จำเป็น
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // จำไว้ว่าก่อนเปิดโมดัล โฟกัสอยู่ที่ไหน — ปิดแล้วต้องคืนกลับไปที่เดิม
    const previous = document.activeElement as HTMLElement | null;

    const focusables = () => Array.from(
      node.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter(el => el.offsetParent !== null || el === document.activeElement);

    // ย้ายโฟกัสเข้าโมดัลทันทีที่เปิด — ไม่งั้นคนใช้คีย์บอร์ดต้อง Tab ไล่ทั้งหน้าเพื่อเข้าถึงเนื้อหา
    const first = focusables()[0];
    if (first) first.focus();
    else { node.setAttribute("tabindex", "-1"); node.focus(); }

    function onKeyDown(e: KeyboardEvent) {
      if (!node) return; // node ถูกจับไว้ตอน effect เริ่มแล้ว — เช็คซ้ำเพื่อให้ตัวตรวจชนิดข้อมูลมั่นใจ
      if (e.key === "Escape") { e.stopPropagation(); closeRef.current(); return; }
      if (e.key !== "Tab") return;

      const items = focusables();
      if (items.length === 0) { e.preventDefault(); return; }
      const firstEl = items[0], lastEl = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;

      // วนกลับหัว/ท้ายแทนที่จะหลุดออกไปข้างนอกโมดัล
      if (!e.shiftKey && active === lastEl) { e.preventDefault(); firstEl.focus(); }
      else if (e.shiftKey && active === firstEl) { e.preventDefault(); lastEl.focus(); }
      else if (active && !node.contains(active)) { e.preventDefault(); firstEl.focus(); }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      // คืนโฟกัสให้ปุ่มที่กดเปิดโมดัล (ถ้ายังอยู่บนหน้า)
      if (previous && document.contains(previous)) previous.focus();
    };
  }, []);

  return ref;
}
