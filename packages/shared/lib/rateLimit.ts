// Rate limiter แบบ in-memory (นับต่อ instance ของเซิร์ฟเวอร์) — best-effort กันยิงถล่ม
//
// ใช้กับ Route Handler งาน admin (สร้างบัญชี) ที่แพงและถูกยิงรัวได้
// เดิม: createUser/createDealer ไม่จำกัดจำนวนครั้ง → บัญชีที่ถูกเจาะยิงรัวสร้างบัญชีขยะได้ไม่จำกัด
//
// ⚠️ ข้อจำกัด: บน serverless (Vercel) แต่ละ instance ถือ state แยกกัน + cold start ล้าง state
//    → กันได้ "ระดับหนึ่ง" (ต่อ instance ที่อุ่นอยู่) · ถ้าต้องเข้มข้ามทุก instance
//    ต้องใช้ shared store (Upstash Redis / ตาราง Supabase) — เกินความจำเป็นตอนนี้
//    (ผู้เรียกต้องผ่าน JWT + บทบาท SUPER_ADMIN/HQ_MANAGEMENT อยู่แล้ว = วงแคบ)

const hits = new Map<string, number[]>();

/** คืน true = ผ่าน (ยังไม่เกินโควตา) · false = เกิน (ควรตอบ 429)
 *  key = ตัวระบุผู้เรียก (เช่น callerId) · max ครั้ง ต่อ windowMs มิลลิวินาที */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent); // เก็บ timestamp เดิมไว้ให้หน้าต่างเลื่อนต่อ (ไม่รีเซ็ต)
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}
