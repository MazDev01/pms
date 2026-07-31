-- Benjamin PMS — Database Hardening รอบ 2 (Phase 3 ส่วนที่เหลือ, 31 ก.ค. 69)
--
-- ปิด 2 จุดที่เหลือจากรอบตรวจสอบเดิมที่ตั้งใจเลื่อนไว้ก่อน (เสี่ยงกว่าจุดอื่นในรอบแรก):
--   1) dealers.revenue_target ยังอ่านได้ตรงๆ ผ่านตารางฐาน ข้าม view ที่บังไว้ (0077)
--   2) quotations.date เป็น text ล้วน ไม่มีคอลัมน์วันจริงเหมือนที่ leads มี (0046)
--
-- ส่วนที่เหลืออีก 3 จุด "ตั้งใจไม่แตะ" ด้วยเหตุผล:
--   • profiles.dealer_code — ใช้ trigger ตรวจแทน FK ตรงไปแล้วใน 0089 (ปลอดภัยกว่าเพราะ '' = บัญชี HQ)
--   • migration เก่า (0069/0071/0072/0084) ที่ไม่ idempotent — ไม่แก้ไฟล์ที่ apply ขึ้น production
--     ไปแล้ว (ผิดหลัก migration hygiene) + Supabase CLI เองก็ track ว่า apply ไปแล้ว ไม่รันซ้ำอัตโนมัติ
--     อยู่แล้ว ความเสี่ยงจริงต่ำ ไม่คุ้มที่จะแก้ประวัติ
--   • audit_log index เพิ่มเติม — ตรวจโค้ดจริงแล้ว query จริงมีแค่ order by id desc (ใช้ PK อยู่แล้ว)
--     กับ retention job filter บน at (มี index จาก 0089 แล้ว) ไม่มี filter อื่นที่ต้องการ index เพิ่ม

-- ══════════════════════════════════════════════════════════════════════════
-- 1) dealers.revenue_target — บังคับมาสก์ที่ชั้นสิทธิ์คอลัมน์จริง ไม่ใช่แค่ "หวังว่าทุกคนจะ query ผ่าน view"
--    RLS ปิดได้แค่ "ทั้งแถว" (dealers_read = using(true) ตั้งใจให้เห็นทะเบียนทุกสาขา) แต่คอลัมน์นี้
--    อ่อนไหวข้ามสาขา — ใช้ column-level REVOKE บนตารางฐาน แล้วให้ view (สิทธิ์เจ้าของ ไม่ใช่ invoker)
--    เป็นทางเดียวที่อ่านค่าจริงได้ พร้อมมาสก์ตาม is_hq()/auth_dealer() ก่อนคืนออกไป
--    (is_hq()/auth_dealer() อ่าน auth.jwt() ของ "ผู้เรียกจริง" เสมอ ไม่ว่า view จะรันด้วยสิทธิ์ใคร
--     จึงมาสก์ถูกคนแม้ view จะไม่ได้ตั้ง security_invoker แล้วก็ตาม)
-- ══════════════════════════════════════════════════════════════════════════
revoke select (revenue_target) on public.dealers from authenticated;
grant select (code, name, province, region, status, created_at) on public.dealers to authenticated;

create or replace view public.dealers_directory as
select
  code, name, province, region, status, created_at,
  case when is_hq() or code = auth_dealer() then revenue_target else null end as revenue_target
from public.dealers;

grant select on public.dealers_directory to authenticated;

-- ══════════════════════════════════════════════════════════════════════════
-- 2) quotations.date_normalized — mirror รูปแบบเดียวกับ leads.created_date (0046) แต่ตัวนี้เป็น
--    ISO string อยู่แล้ว (ไม่ใช่ไทย) จึงไม่ต้อง parse_thai_date — cast ตรงๆ พร้อม guard regex
--    เพิ่ม "คอลัมน์วันจริง" ไว้เป็นโครงสร้างพื้นฐานสำหรับ query ในอนาคต (index range scan ได้จริง)
--    โดยตั้งใจ "ไม่แตะ" RPC ที่ใช้ text parsing เดิม (expire_quotations/hq_alerts/hq_quotations_summary
--    ฯลฯ) ในรอบนี้ — ของเดิมทำงานถูกต้องอยู่แล้ว เปลี่ยนไปใช้คอลัมน์ใหม่ทีละจุดควรทำแยกพร้อมทดสอบ
--    เต็มรูปแบบ ไม่ใช่รวบทำทีเดียวแบบเสี่ยง regression ในรอบตรวจนี้
-- ══════════════════════════════════════════════════════════════════════════
alter table quotations add column if not exists date_normalized date;

create or replace function set_quotation_date_normalized() returns trigger
language plpgsql as $$
begin
  new.date_normalized := case
    when new.date ~ '^\d{4}-\d{2}-\d{2}' then substring(new.date, 1, 10)::date
    else null
  end;
  return new;
end $$;

drop trigger if exists trg_quotation_date_normalized on quotations;
create trigger trg_quotation_date_normalized
  before insert or update of date on quotations
  for each row execute function set_quotation_date_normalized();

-- backfill แถวที่มีอยู่แล้ว
update quotations set date_normalized = case
  when date ~ '^\d{4}-\d{2}-\d{2}' then substring(date, 1, 10)::date
  else null
end
where date_normalized is null and date is not null;

create index if not exists idx_quotations_date_normalized on quotations (date_normalized);
