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

/** บันทึกความล้มเหลวของการอ่าน — ข้ามกรณีที่คำขอถูกยกเลิกเพราะเปลี่ยนหน้า */
export function logRepoRead(tag: string, e: unknown): void {
  if (isAbortedRequest(e)) return;
  console.error(`[${tag}]`, e);
}
