-- Benjamin PMS — Phase 9: Logging/Audit (Enterprise Production Readiness Mission, 31 ก.ค. 69)
--
-- ช่องว่างจริง: ระบบไม่เคย audit log "เข้าสู่ระบบ/ออกจากระบบ" เลย (มีแต่ mutation ของ admin)
-- แก้ที่ RoleContext.tsx (shared — ใช้ร่วมกันทั้ง HQ/Dealer) ให้ log ทุกครั้งที่ signIn/login/logout
-- สำเร็จ — แต่ทดสอบจริงแล้วพัง: audit_insert (0031) ล็อกไว้เฉพาะ is_hq() เท่านั้น (ตอนนั้น dealer
-- ไม่เคยเรียก useAuditLogger เลย จึงไม่จำเป็นต้องเปิดให้) บัญชีตัวแทน login แล้วโดน RLS ปฏิเสธ (403)
--
-- แก้: เปิดช่องแคบๆ เฉพาะ 2 action นี้ให้ "ทุกคนที่ล็อกอินแล้ว" insert ได้ (ยังคง role = auth_role()
-- กันสวมบทบาทเหมือนเดิม) — action อื่นทั้งหมดยังคงจำกัดเฉพาะ is_hq() เท่านั้นเหมือนเดิมทุกประการ
-- (ไม่เปิดกว้างเป็น insert ได้ทุกอย่าง — เจตนาเดิมของ 0031 ยังคงอยู่ แค่เพิ่มข้อยกเว้นที่จำเป็นจริง)
alter policy audit_insert on audit_log
  with check (
    (role = (select auth_role()))
    and ((select is_hq()) or (action in ('เข้าสู่ระบบ', 'ออกจากระบบ')))
  );
