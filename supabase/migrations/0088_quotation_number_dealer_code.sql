-- Benjamin PMS — เลขที่ใบเสนอราคาฝังรหัสสาขาเสมอ: Q-{DealerCode}-{Year}-{Running}
-- (Enterprise Production Readiness Mission, Phase 1 — 31 ก.ค. 69)
--
-- เดิม: เลขที่ใบ = "{คำนำหน้า}{เลข 4 หลัก}" เช่น Q-2026-0001 — คำนำหน้า default เหมือนกันทุกสาขา
--   ถึงแม้ primary key จะเป็น (dealer_code, id) แล้วตั้งแต่ 0022 (กันชนกันจริงในฐานข้อมูล ไม่มี
--   duplicate key error) แต่ตัวเลขที่ "แสดงผล" ให้คนอ่าน สองสาขาที่ไม่ได้ตั้งคำนำหน้าเองจะได้เลข
--   หน้าตาเหมือนกันเป๊ะ (ทั้งคู่เป็น Q-2026-0001) — สร้างความสับสนเวลา HQ เห็นใบจากหลายสาขาปนกัน
--   แม้จะไม่ใช่บั๊กทางเทคนิค แต่ไม่ตรงมาตรฐาน "เลขที่เอกสารต้องไม่ซ้ำหน้าตา" ที่ควรมี
--
-- แก้ให้เลขที่ใบฝังรหัสสาขา + ปีปัจจุบันเสมอ (ไม่ต้องรอให้สาขาไปตั้งคำนำหน้าเอง) — p_prefix ที่เหลือ
-- ใช้เป็นแค่ป้ายนำหน้า (ปกติ "Q-") ไม่ได้เป็นตัวกันชนอีกต่อไป เพราะรหัสสาขา+ปี+เลขรันเป็นตัวกันชนจริง
--
-- ปีใช้ to_char(now(),'YYYY') แบบไดนามิก (ปีปฏิทินคริสต์ศักราชของระบบ) แทนเลขปีตายตัว "2026" เดิม
-- ที่ฝังไว้ในคำนำหน้า default — กันปัญหาเดียวกับที่เคยพบใน cron ตัดใบหมดอายุ (เลขตายตัวไม่อัปเดตตามจริง)

create or replace function public.create_quotation(p_dealer text, p_prefix text, p_payload jsonb)
returns quotations
language plpgsql
security definer
set search_path = public
as $$
declare
  n      integer;
  num    text;
  result quotations;
begin
  if not (can_write_sales() and p_dealer = auth_dealer()) then
    raise exception 'forbidden: no permission to create quotation for %', p_dealer;
  end if;
  if p_dealer is null or p_dealer = '' then
    raise exception 'forbidden: empty dealer';
  end if;
  if coalesce(jsonb_array_length(p_payload->'line_items'), 0) = 0 then
    raise exception 'invalid: quotation must have at least one line item';
  end if;

  insert into quote_counters(dealer_code, next_no) values (p_dealer, 2)
    on conflict (dealer_code) do update set next_no = quote_counters.next_no + 1
    returning next_no - 1 into n;
  num := coalesce(nullif(p_prefix, ''), 'Q-') || p_dealer || '-' || to_char(now(), 'YYYY') || '-' || lpad(n::text, 4, '0');

  insert into quotations
    select * from jsonb_populate_record(
      null::quotations,
      p_payload || jsonb_build_object('id', num, 'dealer_code', p_dealer, 'created_at', now()))
    returning * into result;

  return result;
end $$;

-- next_quote_no (0031) ไม่ได้ถูกเรียกจากแอปจริงเลย (grep ยืนยัน — เหลือแต่ทดสอบเรียกตรง) แต่ default
-- prefix เดิม 'Q-2026-' ขัดกับมาตรฐานใหม่ — อัปเดตให้สอดคล้องกันไว้ก่อน (ไม่ลบฟังก์ชันทิ้งในรอบนี้
-- เพื่อจำกัดผลกระทบ — ควรพิจารณาลบเป็นงาน dead-code cleanup แยกต่างหาก)
create or replace function public.next_quote_no(p_dealer text, p_prefix text default 'Q-')
returns text
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  if p_dealer is distinct from auth_dealer() and not can_write_master() then
    raise exception 'forbidden: dealer mismatch';
  end if;
  if p_dealer is null or p_dealer = '' then
    raise exception 'forbidden: empty dealer';
  end if;

  insert into quote_counters(dealer_code, next_no) values (p_dealer, 2)
    on conflict (dealer_code) do update set next_no = quote_counters.next_no + 1
    returning next_no - 1 into n;
  return p_prefix || p_dealer || '-' || to_char(now(), 'YYYY') || '-' || lpad(n::text, 4, '0');
end $$;
