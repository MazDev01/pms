-- Benjamin PMS — ปิดช่องอ่านทะเบียนตัวแทนโดยไม่ต้องล็อกอิน (ตรวจสอบระบบรอบ 2 · 5 ส.ค. 69)
--
-- ══════════════════════════════════════════════════════════════════════════
-- อาการที่ยืนยันจริงกับ production (ยิงด้วย anon key ล้วน ไม่มี Authorization header):
--     GET /rest/v1/dealers            → []                    ← RLS ของตารางทำงานถูก
--     GET /rest/v1/dealers_directory  → 7 สาขาครบ ชื่อ/จังหวัด/ภาค/สถานะ/วันเปิด
--   (revenue_target ยังถูกมาสก์เป็น null ถูกต้อง เพราะ is_hq()/auth_dealer() อ่าน JWT ผู้เรียกเสมอ)
--   สแกนแล้ว object อื่นทั้ง 18 ตัวไม่รั่ว — จุดนี้จุดเดียว
--
-- ── ต้นเหตุ 2 ชั้นซ้อนกัน ──
--
-- ชั้นที่ 1 — security_invoker หายไปตอนเขียน view ทับ
--   0077 สร้าง view ด้วย `with (security_invoker = true)` ถูกต้อง
--   0090 สั่ง `create or replace view ... as select ...` โดยไม่ใส่ `with (...)` กลับมา
--   Postgres รีเซ็ต reloptions ทั้งชุดเมื่อ replace → view กลับไปรันด้วยสิทธิ์ "เจ้าของ view"
--   = ข้าม RLS ของตาราง dealers ทั้งหมด
--   คอมเมนต์ใน 0090 รู้ตัวว่า security_invoker หายไป แต่ประเมินว่า "มาสก์ยังถูกคนอยู่" ซึ่งจริง —
--   ที่ตกไปคือเรื่อง RLS bypass ซึ่งเป็นคนละเรื่องกับการมาสก์คอลัมน์
--
-- ชั้นที่ 2 — default privilege ของ Supabase ให้ anon อ่าน object ใหม่ใน public อัตโนมัติ
--   เป็นบทเรียนเดียวกับที่ 0091 เขียนอธิบายไว้ละเอียดสำหรับ "ตาราง" dealers
--   แต่ไม่มีใครกลับไปทำเรื่องเดียวกันกับ "view" — และ 0091 revoke จาก authenticated เท่านั้น
--
-- ทั้งสองชั้นต้องแก้คู่กัน: ปิด grant อย่างเดียวไม่พอ (view ยังข้าม RLS อยู่ ถ้าวันหน้ามีใคร grant
-- กลับมาโดยไม่รู้ตัวจะรั่วทันที) · ใส่ security_invoker อย่างเดียวก็ไม่พอ (RLS ของ dealers_read
-- ปัจจุบันคือ `using (true)` สำหรับ authenticated — ตัว grant คือด่านที่กัน anon จริง)
-- ══════════════════════════════════════════════════════════════════════════

-- 1) สร้าง view ใหม่พร้อม security_invoker — ให้ RLS ของตาราง dealers บังคับใช้กับผู้เรียกจริง
--    ⚠️ ทุกครั้งที่ create or replace view ตัวนี้ ต้องพก `with (security_invoker = true)` ไปด้วยเสมอ
create or replace view public.dealers_directory
with (security_invoker = true) as
select
  code, name, province, region, status, created_at,
  case when is_hq() or code = auth_dealer() then revenue_target else null end as revenue_target
from public.dealers;

-- 2) ถอนสิทธิ์อ่านของผู้ที่ยังไม่ล็อกอิน
--    ต้อง revoke จาก PUBLIC ด้วย ไม่ใช่แค่ anon — สิทธิ์ที่มาจาก PUBLIC ครอบ role ทุกตัว
--    การ revoke เฉพาะ anon จะไม่ลบสิทธิ์ที่สืบทอดมาจาก PUBLIC (บทเรียนเดียวกับ 0031 บรรทัด 100-108)
revoke all on public.dealers_directory from public, anon;
grant select on public.dealers_directory to authenticated;

-- ตั้งใจไม่แตะ grant ของ "ตาราง" dealers ในไฟล์นี้:
--   สแกนแล้วตารางไม่รั่ว (anon ได้ 0 แถว — RLS กันอยู่) และตารางนี้ถูกอ่าน/เขียนโดย service_role
--   ใน /api/admin/dealers · การ revoke จาก PUBLIC อาจกระทบสิทธิ์ที่ service_role สืบทอดมา
--   ซึ่งจะทำให้ API จัดการตัวแทนพังทั้งชุด — ความเสี่ยงสูงกว่าประโยชน์ในรอบที่แก้เรื่องด่วน
--   ถ้าจะทำ ควรแยกเป็น migration ของตัวเองพร้อมทดสอบ API ครบทุก handler ก่อน
