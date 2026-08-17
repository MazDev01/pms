// ย่อรูปก่อนเก็บ — กัน QuotaExceededError (data URL ดิบของรูปใหญ่กิน quota ~5MB)
// คืน data URL ที่ย่อแล้ว: จำกัดด้านยาวสุด maxSize px · คงพื้นโปร่งใสถ้าเป็น PNG
//
// ⚠️ ฟังก์ชันนี้เป็น "ด่านเดียว" ที่ทุกจุดอัปโหลดรูปในระบบใช้ร่วมกัน (รูปโปรไฟล์ · โลโก้ลูกค้า/ลูกค้าเป้าหมาย ·
//    โลโก้สาขา · รูปในแคตตาล็อกกลาง) และรูปเหล่านี้ถูกเก็บเป็น data URL ลงคอลัมน์ text ตรง ๆ
//    ไม่ได้ผ่าน Supabase Storage จึงไม่มีเพดานขนาด/ชนิดไฟล์ของ bucket มาช่วยเลย — ต้องตรวจที่นี่
//
//    เดิมไม่ตรวจอะไรเลย และที่แย่กว่าคือ ถ้าไฟล์ถอดรหัสเป็นรูปไม่ได้ (img.onerror) จะ "คืนไฟล์ดิบ
//    ทั้งก้อนที่ยังไม่ย่อ" ออกไปเก็บแทน — เลือกไฟล์อะไรก็ได้ (เปลี่ยน accept ในกล่องเลือกไฟล์เป็น
//    "ไฟล์ทั้งหมด") ก็บันทึกลงฐานข้อมูลได้ทั้งก้อน (พบจากผลตรวจสอบระบบ 5 ส.ค. 69)

/** ชนิดไฟล์รูปที่รับ — ตรงกับ allowed_mime_types ของ bucket avatars (0097) */
export const ACCEPTED_IMAGE_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

/** เพดานขนาด "ไฟล์ต้นทาง" ที่ยอมให้อ่านเข้ามาย่อ
 *  ไม่ใช่ขนาดที่เก็บจริง (ย่อเหลือ ≤512px แล้วมักไม่ถึง 100KB) — เพดานนี้กันการอ่านไฟล์ยักษ์
 *  เข้าหน่วยความจำเบราว์เซอร์ · 10MB เผื่อรูปจากมือถือความละเอียดสูงไว้พอสมควรแล้ว */
export const MAX_IMAGE_INPUT_BYTES = 10 * 1024 * 1024;

/** ตรวจไฟล์ก่อนอ่าน — คืนข้อความบอกเหตุผลถ้าไม่ผ่าน, คืน null ถ้าผ่าน
 *  แยกออกมาให้เรียกเองได้ เผื่อหน้าจอไหนอยากเตือนก่อนเริ่มอ่านไฟล์ */
export function validateImageFile(file: File): string | null {
  const type = (file.type || "").toLowerCase();
  if (!(ACCEPTED_IMAGE_MIME as readonly string[]).includes(type)) {
    return `ไฟล์ชนิด "${type || "ไม่ทราบชนิด"}" ใช้เป็นรูปไม่ได้ — รับเฉพาะ JPG, PNG, WebP, GIF`;
  }
  if (file.size > MAX_IMAGE_INPUT_BYTES) {
    return `รูปใหญ่เกินไป (${(file.size / 1024 / 1024).toFixed(1)} MB) — จำกัดไม่เกิน ${MAX_IMAGE_INPUT_BYTES / 1024 / 1024} MB`;
  }
  return null;
}

/**
 * ย่อรูปเป็น data URL
 * @throws Error พร้อมข้อความภาษาไทยที่เอาไปแสดงให้ผู้ใช้ได้ตรง ๆ เมื่อไฟล์ไม่ผ่านการตรวจ
 *         หรือถอดรหัสเป็นรูปไม่ได้ — ผู้เรียก "ต้อง" ครอบ try/catch แล้วแจ้งผู้ใช้
 *         (ห้ามคืนไฟล์ดิบเป็น fallback เด็ดขาด — นั่นคือช่องที่ทำให้เก็บอะไรก็ได้ลงฐานข้อมูล)
 */
export function fileToResizedDataURL(file: File, maxSize = 256, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const invalid = validateImageFile(file);
    if (invalid) { reject(new Error(invalid)); return; }

    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("เบราว์เซอร์ประมวลผลรูปไม่ได้ในขณะนี้ — ลองใหม่อีกครั้ง")); return; }
        ctx.drawImage(img, 0, 0, w, h);
        // PNG → คงพื้นโปร่งใส (โลโก้) · อื่นๆ → JPEG เพื่อขนาดเล็ก
        const type = file.type === "image/png" ? "image/png" : "image/jpeg";
        try { resolve(canvas.toDataURL(type, quality)); }
        catch { reject(new Error("แปลงรูปไม่สำเร็จ — ลองไฟล์อื่น")); }
      };
      // ชนิดไฟล์บอกว่าเป็นรูป แต่ถอดรหัสไม่ได้ = ไฟล์เสียหรือไม่ใช่รูปจริง — ต้องปฏิเสธ ไม่ใช่เก็บไฟล์ดิบแทน
      img.onerror = () => reject(new Error("ไฟล์นี้เปิดเป็นรูปไม่ได้ — อาจเสียหายหรือไม่ใช่ไฟล์รูปจริง"));
      img.src = src;
    };
    reader.onerror = () => reject(new Error("อ่านไฟล์ไม่สำเร็จ — ลองใหม่อีกครั้ง"));
    reader.readAsDataURL(file);
  });
}
