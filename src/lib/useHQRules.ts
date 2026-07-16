"use client";

// ─── กฎธุรกิจของสำนักงานใหญ่ (อ่านอย่างเดียว ฝั่ง client) ────────────────────────
// แหล่งเดียว: ตั้งที่ /hq/settings → "กฎธุรกิจ" แล้วทุกหน้าที่แสดงป้าย/การ์ดเตือนอ่านค่านี้
//
// ห้ามใช้ usePersistentState ที่นี่ — hook นั้น "เขียนกลับ" ลง localStorage ด้วย
// หน้าที่แค่อ่านกฎ (แดชบอร์ด/หน้าลีด) จะเขียนค่า default ทับค่าที่ HQ ตั้งไว้ตอน mount
// (เจอจริงตอนทดสอบ: ตั้ง 1000 วัน → เปิดแดชบอร์ดตัวแทน → ค่าเด้งกลับเป็น 7)
// ที่นี่จึงอ่านอย่างเดียว + ฟัง event ตอน HQ กดบันทึก และ storage ตอนเปลี่ยนจากแท็บอื่น
import { useState, useEffect } from "react";
import { loadHQLeadRules, HQ_LEAD_RULES_EVENT, DEFAULT_HQ_LEAD_RULES, type HQLeadRules } from "@/lib/mock";

export function useHQLeadRules(): HQLeadRules {
  // เริ่มที่ค่าเริ่มต้นเสมอ → SSR กับ client render แรกตรงกัน (กัน hydration mismatch)
  const [rules, setRules] = useState<HQLeadRules>(DEFAULT_HQ_LEAD_RULES);
  useEffect(() => {
    const read = () => setRules(loadHQLeadRules());
    read();
    window.addEventListener(HQ_LEAD_RULES_EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(HQ_LEAD_RULES_EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, []);
  return rules;
}
