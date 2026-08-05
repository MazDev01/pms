-- Benjamin PMS — บังคับ "หนึ่งสาขา หนึ่งบัญชีเข้าระบบ" ที่ระดับฐานข้อมูล (ตรวจสอบระบบ 5 ส.ค. 69)
--
-- ปัญหา: route รีเซ็ตรหัสผ่านตัวแทน (PATCH /api/admin/dealers) และเข้าระบบแทนตัวแทน (impersonate)
--   ต่างสมมติว่า "หนึ่ง dealer_code มีโปรไฟล์เดียว" แล้วใช้ .maybeSingle() ดึงบัญชี — แต่กฎนี้
--   บังคับอยู่แค่ใน logic ของ route ที่สร้างบัญชีเท่านั้น ไม่มี constraint ที่ DB เลย
--   ถ้ามีข้อมูลซ้ำเกิดขึ้น (แก้มือ/ฟีเจอร์ใหม่/บั๊ก) .maybeSingle() จะคืน error แทนแถว
--   → ทั้งสอง route รายงานว่า "ไม่พบบัญชีเข้าระบบของตัวแทนรหัส X" (404) ทั้งที่สาขามีอยู่จริง
--   แอดมินจะรีเซ็ตรหัสผ่าน/เข้าระบบแทนสาขานั้นไม่ได้เลย โดยไม่มีเบาะแสว่าเพราะอะไร
--
-- แก้ 2 ชั้นคู่กัน:
--   1) โค้ด (adminRoute.findDealerAccount) — แยก "อ่านไม่ได้ / ไม่พบ / เจอหลายบัญชี" ออกจากกันแล้ว
--   2) ที่นี่ — partial unique index กันไม่ให้ข้อมูลซ้ำเกิดขึ้นตั้งแต่แรก
--
-- ทำไมต้อง partial (where dealer_code <> ''): โปรไฟล์ของสำนักงานใหญ่ทุกคนใช้ dealer_code = ''
--   ร่วมกัน (ดู 0001_schema.sql — default '') ถ้า unique ทั้งคอลัมน์จะเพิ่มผู้ใช้ HQ คนที่ 2 ไม่ได้เลย

-- ตรวจก่อนว่ามีข้อมูลซ้ำค้างอยู่หรือไม่ — ถ้ามี ต้องแก้ข้อมูลก่อน ไม่ใช่สร้าง index ทับแล้วพัง
do $$
declare dup record;
begin
  for dup in
    select dealer_code, count(*) as n
    from public.profiles
    where coalesce(dealer_code, '') <> ''
    group by dealer_code having count(*) > 1
  loop
    raise exception 'สาขา % มีโปรไฟล์ % รายการ — ต้องเหลือบัญชีเดียวก่อนจึงจะสร้าง unique index ได้', dup.dealer_code, dup.n;
  end loop;
end $$;

create unique index if not exists profiles_dealer_code_unique
  on public.profiles (dealer_code)
  where coalesce(dealer_code, '') <> '';
