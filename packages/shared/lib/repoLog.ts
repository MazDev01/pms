"use client";

// การรายงานความล้มเหลวของ "การอ่าน" ข้อมูลผ่าน repository
//
// ปัญหา: เบราว์เซอร์ยกเลิกคำขอที่ยังค้างอยู่เมื่อผู้ใช้เปลี่ยนหน้า แล้ว fetch จะ reject
//        ด้วย TypeError: Failed to fetch — เหมือนกับตอนเน็ตหลุดทุกประการ
//        คอมโพเนนต์ที่อยู่ยาว (Topbar/Sidebar/AppShell) ไม่ถูก unmount ตอนเปลี่ยนหน้า
//        ตัวกัน `alive` ในเอฟเฟกต์จึงไม่ช่วย → console เต็มไปด้วย error ที่ไม่ใช่ error
//
// ทำไมต้องแยก: ถ้าปล่อยให้ทุกอย่างเป็น console.error คนจะชินแล้วเลิกอ่าน
//              พอมี error จริงก็จะมองข้าม (และชุดเทสต์ที่ห้ามมี error จะแกว่งจนเชื่อไม่ได้)
//
// ขอบเขต: ใช้กับ "การอ่าน" เท่านั้น — การเขียนล้มเหลวต้องดังเสมอ
//         (ดู syncError ใน SalesContext และ REPO_SAVE_ERROR_EVENT ใน useRepoState)
//         การอ่านที่พลาดจริง ๆ จะถูกลองใหม่รอบถัดไปอยู่แล้ว (เปลี่ยนหน้า/มี event/รีเฟรช)

/** คำขอถูกยกเลิกกลางคัน (เปลี่ยนหน้า/ปิดแท็บ/AbortController) ไม่ใช่ความผิดพลาดของระบบ */
export function isAbortedRequest(e: unknown): boolean {
  if (typeof DOMException !== "undefined" && e instanceof DOMException && e.name === "AbortError") return true;
  const msg = e instanceof Error ? e.message : String(e);
  // เบราว์เซอร์แต่ละตัวใช้ข้อความต่างกัน แต่ทั้งหมดหมายถึง "คำขอไม่ถึงปลายทาง"
  return /Failed to fetch|NetworkError when attempting|Load failed|aborted/i.test(msg);
}

// แจ้งการอ่านที่ล้มเหลวจริง (ไม่ใช่ถูกยกเลิกเพราะเปลี่ยนหน้า) ผ่าน event เดียวกันทั้งแอป —
// คู่ขนานกับ REPO_SAVE_ERROR_EVENT (useRepoState.ts) แต่ฝั่งอ่าน · จุดที่แก้จริงคือ AppShell
// (แถบเตือนเดียวกับ "บันทึกไม่สำเร็จ") ไม่ต้องแก้ทีละ hook ที่เรียก logRepoRead อยู่แล้วนับสิบจุด
//
// ทำไมต้องมี: hook พวกนี้ (useNetworkCustomersDb ฯลฯ) เดิม catch แล้วแค่ log ขึ้น console — ถ้าโหลด
// พังจริง (RLS/เน็ตหลุด/query error) หน้าจอจะโชว์ "0 รายการ" เหมือนข้อมูลว่างจริงเป๊ะ ผู้ใช้แยกไม่ออก
// ว่า "ยังไม่มีข้อมูล" กับ "โหลดไม่สำเร็จ" — พบจริงจากผลตรวจสอบระบบ 30 ก.ค. 69 (severity: Critical)
export const REPO_READ_ERROR_EVENT = "pms:repo-read-error";
function reportRepoReadError(tag: string, e: unknown): void {
  if (typeof window === "undefined") return;
  const msg = e instanceof Error ? e.message : String(e);
  try { window.dispatchEvent(new CustomEvent(REPO_READ_ERROR_EVENT, { detail: `${tag}: ${msg}` })); } catch { /* ignore */ }
}

/** บันทึกความล้มเหลวของการอ่าน — ข้ามกรณีที่คำขอถูกยกเลิกเพราะเปลี่ยนหน้า */
export function logRepoRead(tag: string, e: unknown): void {
  if (isAbortedRequest(e)) return;
  console.error(`[${tag}]`, e);
  reportRepoReadError(tag, e);
}
