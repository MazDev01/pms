-- ── บันทึกตรวจสอบ: ห้ามลงชื่อคนอื่น ────────────────────────────────────────────
--
-- สถานะก่อนหน้า (ยิงทดสอบจริง 6 ส.ค. 69):
--   ✅ ตัวแทนเขียนบันทึกไม่ได้เลย        ✅ สวมบทบาท (role) ไม่ได้
--   ✅ แก้ย้อนหลังไม่ได้                  ✅ ลบย้อนหลังไม่ได้
--   ❌ ผู้ดูแล HQ เขียนบันทึก "ในนามคนอื่น" ได้ — ช่อง user รับข้อความอะไรก็ได้
--
-- ทำไมสำคัญ: บันทึกตรวจสอบมีไว้ตอบคำถามว่า "ใครทำ" ถ้าลงชื่อคนอื่นได้ ก็ใช้เป็นหลักฐานไม่ได้
--   และร้ายกว่านั้นคือใช้ใส่ร้ายกันได้ (ผลตรวจสอบระบบรอบ 2 · ความปลอดภัย)
--
-- ⚠️ ข้อควรระวังที่ตรวจเจอก่อนแก้: แอปเขียน "อีเมล" ลงช่อง user (ไม่ใช่ชื่อในโปรไฟล์)
--   ถ้ารัดว่าต้องเท่ากับชื่อในโปรไฟล์อย่างเดียว บันทึกทั้งระบบจะเขียนไม่ได้ทันที
--   จึงยอมรับ "ตัวระบุตัวตนของผู้เรียกเอง" ได้ทั้งอีเมลและชื่อ — ห้ามเป็นของคนอื่นเท่านั้น
--
-- ต้องเป็น security definer เพราะต้องอ่าน auth.users ซึ่งผู้ใช้ทั่วไปอ่านตรงไม่ได้
create or replace function public.is_own_identity(p_name text)
returns boolean
language sql stable security definer set search_path = public, auth as $$
  select coalesce(p_name, '') <> '' and (
    p_name = (select name  from public.profiles where id = auth.uid())
    or
    p_name = (select email::text from auth.users where id = auth.uid())
  );
$$;

revoke execute on function public.is_own_identity(text) from public, anon;
grant  execute on function public.is_own_identity(text) to   authenticated;

alter policy audit_insert on public.audit_log
  with check (
    (select is_hq())
    and role = (select auth_role())
    and public.is_own_identity("user")
  );
