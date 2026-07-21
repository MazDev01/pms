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

let unsaved = false;

/** ถามผู้ใช้ก่อนทิ้งงานที่ยังไม่บันทึก — true = ไปต่อได้ · ไม่มีงานค้างจะไม่ถาม */
export function confirmDiscard(): boolean {
  if (!unsaved) return true;
  return confirm("ยังมีงานที่ยังไม่บันทึกในหน้านี้ · ออกจากหน้านี้แล้วสิ่งที่แก้ไว้จะหาย\n\nออกจากหน้านี้ไหม?");
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
      if (!confirmDiscard()) { e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClickCapture, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClickCapture, true);
    };
  }, [dirty]);
}
