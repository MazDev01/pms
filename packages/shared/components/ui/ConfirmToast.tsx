"use client";

// ── กล่องยืนยันของระบบ — ใช้ sonner แทนกล่องของเบราว์เซอร์ (บอสสั่ง 28 ส.ค. 69) ──────
//
// ทำไมต้องเปลี่ยน: confirm() ของเบราว์เซอร์หน้าตาเป็นของ Chrome/Windows ไม่ใช่ของระบบเรา
//   ขึ้นหัวว่า "localhost:3001 บอกว่า" · ใช้ฟอนต์คนละตัว · สีคนละชุด · จัดวางแก้ไม่ได้เลย
//   และมันหยุดทั้งหน้าจอไว้ (blocking) ซึ่งต่างจากส่วนอื่นของระบบทั้งหมด
//
// ⚠️ กติกาที่ห้ามหลุด: ตัวนี้แทน "คำถามที่ต้องได้คำตอบ" ไม่ใช่ข้อความแจ้งเตือนทั่วไป
//   • ห้ามหายเอง — duration: Infinity เสมอ · งานที่ย้อนกลับไม่ได้ต้องรอคนตอบ ไม่ใช่หายไปเงียบ ๆ
//   • ปัดทิ้ง / กด Esc = "ยกเลิก" เสมอ (ตอบ false) ไม่ใช่ค้างรอตลอดกาล
//   • ทีละใบเท่านั้น — ถามซ้อนกันแล้วผู้ใช้ตอบผิดใบได้ · ใบใหม่มาปิดใบเก่าแล้วตอบว่ายกเลิก
//
// การใช้งาน (ต้อง await เสมอ — ต่างจาก confirm() เดิมที่คืนค่าทันที):
//   if (!(await ยืนยัน({ หัวข้อ: "ลบรายการนี้?", รายละเอียด: "ย้อนกลับไม่ได้", อันตราย: true }))) return;
import { useEffect, useRef } from "react";
import { Toaster, toast } from "sonner";
import { AlertTriangle } from "lucide-react";

export type ตัวเลือกยืนยัน = {
  หัวข้อ: string;
  /** บรรทัดอธิบายผลของการกดตกลง — เขียนให้ผู้ใช้ตัดสินใจได้โดยไม่ต้องเดา */
  รายละเอียด?: string;
  /** ข้อความบนปุ่มตกลง — ตั้งให้เป็น "คำกริยาของงานนั้น" อ่านแล้วรู้ว่ากดแล้วเกิดอะไร */
  ปุ่มตกลง?: string;
  ปุ่มยกเลิก?: string;
  /** งานที่ย้อนกลับไม่ได้ (ลบ/ปิดการขาย/คืนค่าเริ่มต้น) — ปุ่มตกลงเป็นสีเตือน + มีไอคอน */
  อันตราย?: boolean;
};

/** ใบที่ค้างอยู่ตอนนี้ — ถามใบใหม่ต้องปิดใบเก่าและตอบว่า "ยกเลิก" ให้ผู้เรียกเดิมก่อนเสมอ
 *  (ไม่งั้นผู้เรียกเดิมจะรอ Promise ที่ไม่มีวันตอบ — งานค้างแบบไม่มีใครเห็น) */
let ใบที่ค้าง: { id: string | number; ยกเลิก: () => void } | null = null;

/** ถามผู้ใช้แบบ "ต้องได้คำตอบ" — true = ตกลง · false = ยกเลิก/ปัดทิ้ง */
export function ยืนยัน(o: ตัวเลือกยืนยัน): Promise<boolean> {
  if (ใบที่ค้าง) { const เก่า = ใบที่ค้าง; ใบที่ค้าง = null; เก่า.ยกเลิก(); toast.dismiss(เก่า.id); }

  return new Promise<boolean>((resolve) => {
    let ตอบแล้ว = false;
    const ตอบ = (ผล: boolean) => {
      if (ตอบแล้ว) return;      // กดรัว/กดแล้วปัดทิ้ง = คำตอบแรกเท่านั้นที่นับ
      ตอบแล้ว = true;
      if (ใบที่ค้าง?.id === id) ใบที่ค้าง = null;
      resolve(ผล);
    };

    const id = toast.custom((t) => (
      <div className="pms-confirm" role="alertdialog" aria-modal="false" aria-label={o.หัวข้อ}>
        <div className="pms-confirm-head">
          {o.อันตราย && <AlertTriangle size={16} className="pms-confirm-icon" aria-hidden />}
          <div className="pms-confirm-title">{o.หัวข้อ}</div>
        </div>
        {o.รายละเอียด && <div className="pms-confirm-detail">{o.รายละเอียด}</div>}
        <div className="pms-confirm-actions">
          <button type="button" className="btn btn-secondary btn-sm"
            onClick={() => { ตอบ(false); toast.dismiss(t); }}>
            {o.ปุ่มยกเลิก ?? "ยกเลิก"}
          </button>
          {/* โฟกัสอยู่ที่ปุ่มตกลง แต่ "ตกลง" ไม่ใช่ค่าตั้งต้นของการกด Esc — Esc = ยกเลิกเสมอ */}
          <button type="button" autoFocus
            className={`btn btn-sm ${o.อันตราย ? "pms-confirm-danger" : "btn-primary"}`}
            onClick={() => { ตอบ(true); toast.dismiss(t); }}>
            {o.ปุ่มตกลง ?? "ตกลง"}
          </button>
        </div>
      </div>
    ), {
      duration: Infinity,        // คำถามต้องรอคำตอบ ห้ามหายเอง
      onDismiss: () => ตอบ(false),
      onAutoClose: () => ตอบ(false),   // ไม่ควรเกิด (Infinity) แต่ถ้าเกิดต้องไม่ค้าง
      className: "pms-confirm-toast",
    });

    ใบที่ค้าง = { id, ยกเลิก: () => ตอบ(false) };
  });
}

/** ปิดใบที่ค้างอยู่แล้วตอบว่า "ยกเลิก" — ใช้ตอนออกจากหน้า/เปลี่ยนบริบทกลางคัน */
export function ปิดคำถามที่ค้าง(): void {
  if (!ใบที่ค้าง) return;
  const เก่า = ใบที่ค้าง; ใบที่ค้าง = null;
  เก่า.ยกเลิก(); toast.dismiss(เก่า.id);
}

/** ที่วางกล่องยืนยัน — ครอบไว้ที่ layout ราก จึงใช้ได้ทุกหน้า รวมหน้าที่ยังไม่ล็อกอิน
 *
 *  ⚠️ ต้องอยู่ที่ layout ราก ไม่ใช่ใน (app) — หน้าเข้าสู่ระบบ/รีเซ็ตรหัสผ่านอยู่คนละกลุ่ม
 *     ถ้าวางผิดที่ กดยืนยันในหน้าพวกนั้นจะไม่มีอะไรขึ้นเลย และไม่มีอะไรฟ้อง */
export function ConfirmToaster() {
  // Esc = ยกเลิก (เหมือนกล่องของเบราว์เซอร์เดิม) — sonner ไม่ได้ผูก Esc ให้เอง
  const พร้อม = useRef(false);
  useEffect(() => {
    พร้อม.current = true;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") ปิดคำถามที่ค้าง(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Toaster
      position="top-center"        // คำถามต้องอยู่ในสายตา ไม่ใช่มุมจอที่มองข้ามได้
      expand
      visibleToasts={1}            // ทีละใบ — ถามซ้อนกันแล้วตอบผิดใบ
      toastOptions={{ unstyled: true, classNames: { toast: "pms-confirm-toast" } }}
    />
  );
}
