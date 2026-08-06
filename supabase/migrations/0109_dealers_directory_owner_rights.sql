-- Benjamin PMS — แก้ผลข้างเคียงของ 0108 (ทันที · 5 ส.ค. 69)
--
-- ══════════════════════════════════════════════════════════════════════════
-- สิ่งที่เกิดขึ้น: 0108 ใส่ `security_invoker = true` กลับเข้าไปตามที่ 0077 เคยตั้งไว้
--   ผลคือ view รันด้วยสิทธิ์ของ "ผู้เรียก" → ผู้เรียกต้องมีสิทธิ์อ่านทุกคอลัมน์ที่ view แตะ
--   แต่ view ต้องอ่าน revenue_target เพื่อเอามา "มาสก์" ด้วย CASE
--   และ 0091 ตั้งใจถอนสิทธิ์อ่าน revenue_target ออกจาก authenticated ไปแล้ว
--   → ตัวแทนที่ล็อกอินอยู่ได้ `permission denied for table dealers` ทันที (ยืนยันด้วยการยิงจริง)
--
-- นี่คือเหตุผลที่ 0090/0091 เลิกใช้ security_invoker — ไม่ใช่ความพลาด แต่เป็นเงื่อนไขที่จำเป็น
-- ของวิธี "มาสก์คอลัมน์ผ่าน view" คอมเมนต์ใน 0091 อธิบายไว้แล้วว่า is_hq()/auth_dealer()
-- อ่าน JWT ของผู้เรียกจริงเสมอ ไม่ว่า view จะรันด้วยสิทธิ์ใคร → การมาสก์จึงยังถูกคนอยู่
--
-- ── สรุปว่าอะไรกันอะไร ──
--   • กัน "คนไม่ล็อกอิน"  → การถอน grant ออกจาก anon/PUBLIC (0108 ส่วนนี้ถูกต้องแล้ว คงไว้)
--   • กัน "ตัวแทนเห็นเป้าสาขาอื่น" → CASE ใน view ที่อ่าน JWT ผู้เรียก (ทำงานได้โดยไม่ต้องพึ่ง invoker)
--   • RLS ของ dealers สำหรับ authenticated คือ `using (true)` อยู่แล้วโดยเจตนา
--     (ทุกสาขาเห็นทะเบียนเครือได้) → การที่ view รันด้วยสิทธิ์เจ้าของจึงไม่ได้เปิดอะไรเกินจากที่ออกแบบ
--
-- แก้: เอา security_invoker ออก (กลับไปเหมือน 0090/0091) แต่ "คง" การถอน grant ของ anon ไว้
create or replace view public.dealers_directory as
select
  code, name, province, region, status, created_at,
  case when is_hq() or code = auth_dealer() then revenue_target else null end as revenue_target
from public.dealers;

-- create or replace view รีเซ็ต ACL — ต้องถอน anon/PUBLIC ซ้ำทุกครั้ง ไม่งั้นรูรั่วของ 0108 กลับมา
revoke all on public.dealers_directory from public, anon;
grant select on public.dealers_directory to authenticated;
