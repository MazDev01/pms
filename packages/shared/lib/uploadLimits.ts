// ── กฎการรับไฟล์แนบ — แหล่งเดียวของทั้งระบบ ─────────────────────────────────────
//
// ทำไมต้องรวมไว้ที่เดียว:
//   ทุกช่องแนบไฟล์ (หน้าไฟล์ · แผงลูกค้า · แผงลูกค้าเป้าหมาย) เขียนลง "คลังไฟล์รวม" ก้อนเดียวกัน
//   แต่เดิมแต่ละหน้าเขียนกฎของตัวเองซ้ำกัน แล้วตกหล่นทีละหน้า:
//     • หน้าไฟล์ — เดิมไม่เช็กเลย อัปโหลด .exe ได้ (ผลตรวจ 30 ก.ค. 69)
//     • แผงลูกค้า — เดิมไม่เช็กเลย ตามไปแก้ทีหลัง (ผลตรวจ 31 ก.ค. 69)
//     • แผงลูกค้าเป้าหมาย — ยังไม่เคยเช็กอะไรเลยจนถึง 6 ส.ค. 69 (ไฟล์ใหญ่แค่ไหน ชนิดอะไรก็แนบได้)
//   เพิ่มช่องแนบใหม่ที่ไหน ให้เรียก validateUpload() ตัวนี้ ห้ามเขียนกฎใหม่ซ้ำอีก
//
// เช็กที่ "นามสกุลไฟล์" ไม่ใช่ MIME — ไฟล์ CAD (.dwg/.dxf) ไม่มี MIME มาตรฐานที่เบราว์เซอร์รู้จัก
// (มักได้ octet-stream เหมือนไฟล์ไม่รู้จักทั่วไป) เช็ก MIME จะกันไฟล์งานจริงของลูกค้าไปด้วย

export const UPLOAD_ACCEPTED_EXT = [
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".dwg", ".dxf", ".jpg", ".jpeg", ".png",
];
export const UPLOAD_MAX_BYTES = 25 * 1024 * 1024; // 25 MB

/** นามสกุลไฟล์ตัวพิมพ์เล็กพร้อมจุดนำหน้า (".pdf") — ไม่มีนามสกุลคืน "" */
export function uploadExtOf(name: string): string {
  const parts = String(name).split(".");
  return parts.length > 1 ? "." + parts.pop()!.toLowerCase() : "";
}

/** ข้อความบอกผู้ใช้ว่าทำไมแนบไม่ได้ — คืน null ถ้าไฟล์ผ่านเกณฑ์ */
export function validateUpload(file: { name: string; size: number }): string | null {
  const ext = uploadExtOf(file.name);
  if (!UPLOAD_ACCEPTED_EXT.includes(ext)) {
    return `ไม่รองรับไฟล์ชนิด "${ext || "ไม่ทราบ"}" — รับเฉพาะ PDF, Word, Excel, PowerPoint, CAD, รูปภาพ`;
  }
  if (file.size > UPLOAD_MAX_BYTES) {
    return `ไฟล์ใหญ่เกินไป (${(file.size / 1024 / 1024).toFixed(1)} MB) — จำกัดไม่เกิน ${(UPLOAD_MAX_BYTES / 1024 / 1024).toFixed(0)} MB`;
  }
  return null;
}

/** ขนาดไฟล์แบบอ่านง่ายไว้เก็บลงทะเบียนไฟล์ ("1.4 MB" / "820 KB") */
export function humanFileSize(bytes: number): string {
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}
