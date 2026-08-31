"use client";

// ─── เตือนก่อนทิ้งงานที่ยังไม่บันทึก (แหล่งเดียวของทั้งแอป) ────────────────────
// หน้าไหนมีฟอร์มค้าง เรียก useUnsavedGuard(dirty) แล้วครอบให้ครบ 3 ทางออก:
//   1) ปิดแท็บ / รีเฟรช        → beforeunload
//   2) กดลิงก์ในแอป (sidebar)  → ดัก click แบบ capture ก่อน <Link> ของ Next จะทำงาน
//   3) router.push จากที่อื่น   → จุดนั้นต้องเรียก confirmDiscard() เอง (ดู Topbar)
// ข้อ 3 ต้องเก็บสถานะไว้นอก React เพราะ Topbar อยู่คนละต้นไม้กับหน้าที่ dirty
//
// App Router ไม่มี router events ให้ดักกลางทางเหมือน Pages Router — จึงต้องดักที่ต้นทางแบบนี้
// เตือนครึ่งเดียวอันตรายกว่าไม่เตือนเลย เพราะสอนให้ผู้ใช้ไว้ใจว่าระบบจะเตือนให้เสมอ
import { useEffect } from "react";
import { ยืนยัน } from "@pms/shared/components/ui/ConfirmToast";

let unsaved = false;

/** มีงานค้างอยู่ไหม — ให้ผู้เรียกตัดสินใจได้ "ทันที" โดยไม่ต้องรอคำตอบจากผู้ใช้
 *  จำเป็นสำหรับจุดที่ต้องหยุดการนำทางแบบทันที (ดัก click) ซึ่งรอ Promise ไม่ได้ */
export function มีงานค้าง(): boolean { return unsaved; }

/** ถามผู้ใช้ก่อนทิ้งงานที่ยังไม่บันทึก — true = ไปต่อได้ · ไม่มีงานค้างจะไม่ถาม
 *
 *  ⚠️ เป็น async แล้ว (เดิมเป็น confirm() ของเบราว์เซอร์ซึ่งตอบทันที) — ผู้เรียกต้อง await
 *     ลืม await = ได้ Promise ซึ่งเป็นค่าจริงเสมอ → เตือนแล้วไปต่อทันทีโดยไม่รอคำตอบ
 *     (ตรวจชนิดข้อมูลจับให้แล้วทุกจุด เพราะค่าที่คืนเปลี่ยนจาก boolean เป็น Promise<boolean>) */
export async function confirmDiscard(): Promise<boolean> {
  if (!unsaved) return true;
  return ยืนยัน({
    หัวข้อ: "ยังมีงานที่ยังไม่บันทึกในหน้านี้",
    รายละเอียด: "ออกจากหน้านี้แล้วสิ่งที่แก้ไว้จะหาย",
    ปุ่มตกลง: "ออกจากหน้านี้",
    ปุ่มยกเลิก: "อยู่หน้าเดิม",
    อันตราย: true,
  });
}

export function useUnsavedGuard(dirty: boolean) {
  useEffect(() => {
    unsaved = dirty;
    return () => { unsaved = false; }; // ออกจากหน้าแล้วต้องเคลียร์ ไม่งั้นค้างไปเตือนหน้าอื่น
  }, [dirty]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    const onClickCapture = (e: MouseEvent) => {
      // ปล่อยผ่าน: คลิกขวา/กลาง · เปิดแท็บใหม่ (ctrl/cmd/shift) — พวกนี้ไม่ได้พาออกจากหน้า
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank") return;
      const href = a.getAttribute("href") ?? "";
      if (!href.startsWith("/") || href === window.location.pathname) return;
      // ── ต้องหยุดการนำทาง "ทันที" แล้วค่อยถาม ─────────────────────────────────
      // กล่องยืนยันตัวใหม่ตอบเป็น Promise (async) แต่ตัวดัก click หยุดการนำทางได้เฉพาะ
      // "ในจังหวะเดียวกับที่เกิดเหตุ" เท่านั้น — รอคำตอบก่อนแล้วค่อย preventDefault ไม่ทัน
      // เบราว์เซอร์พาออกจากหน้าไปแล้ว (งานที่ค้างหายทั้งที่ยังไม่ได้ถามด้วยซ้ำ)
      // จึงหยุดไว้ก่อนเสมอเมื่อมีงานค้าง แล้วถ้าผู้ใช้ตอบว่าไปต่อ ค่อยพาไปเองด้วย href เดิม
      if (!มีงานค้าง()) return;
      e.preventDefault(); e.stopPropagation();
      void confirmDiscard().then(ไปต่อ => {
        if (!ไปต่อ) return;
        unsaved = false;               // ตอบแล้วว่ายอมทิ้ง — ไม่ต้องถามซ้ำระหว่างเปลี่ยนหน้า
        window.location.href = href;
      });
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClickCapture, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClickCapture, true);
    };
  }, [dirty]);
}
