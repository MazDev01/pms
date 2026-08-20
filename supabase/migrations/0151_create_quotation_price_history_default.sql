-- ── สร้างใบเสนอราคาไม่ได้เลย หลังเพิ่มคอลัมน์ประวัติการต่อรองราคา ──────────────
--
-- เจอจากรอบตรวจรับระบบ 19 ส.ค. 69 (ชุดทดสอบหน้าจอล้ม 11 ชุดจากสาเหตุเดียวกันนี้)
--
-- ต้นเหตุ: ใบ 0148 เพิ่มคอลัมน์ price_history แบบ "ห้ามว่าง" (not null default '[]')
--   แต่ create_quotation ประกอบแถวด้วย jsonb_populate_record(null::quotations, ...)
--   ซึ่งเริ่มจากแถวที่ "ทุกคอลัมน์เป็น NULL" แล้วระบุครบทุกคอลัมน์ตอน insert
--   → Postgres ไม่ใช้ค่าตั้งต้นของตารางเลย → price_history เป็น NULL → ชนกฎ not null ทุกครั้ง
--
-- นี่คือกับดักตัวเดิมที่โปรเจกต์นี้เคยเจอมาแล้วสองรอบ (ใบ 0106 ตารางลูกค้า · ใบ 0118 ใบเสนอราคา)
--   บทเรียนคือ: เพิ่มคอลัมน์ที่มีค่าตั้งต้นให้ตาราง quotations/customers เมื่อไร
--   ต้องเติมค่านั้นเข้าไปใน defaults ของ RPC ที่สร้างแถวด้วยเสมอ ไม่งั้นค่าตั้งต้นจะถูกข้าม
create or replace function public.create_quotation(
  p_dealer text, p_prefix text, p_payload jsonb
) returns quotations
language plpgsql
security definer
set search_path = public
as $$
declare
  n        integer;
  num      text;
  result   quotations;
  defaults jsonb := jsonb_build_object(
    'total_value',   0,
    'material_cost', 0,
    'items',         0,
    'line_items',    '[]'::jsonb,
    'price_history', '[]'::jsonb,   -- 0148 · ห้ามว่าง — ต้องมีที่นี่ ไม่งั้นสร้างใบไม่ได้เลย
    'status',        'draft'
  );
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
      defaults || p_payload || jsonb_build_object('id', num, 'dealer_code', p_dealer, 'created_at', now()))
    returning * into result;

  return result;
end $$;

revoke all     on function public.create_quotation(text, text, jsonb) from public, anon;
grant  execute on function public.create_quotation(text, text, jsonb) to   authenticated;

-- เซฟตี้เน็ตชั้นสอง: ต่อให้มีเส้นทางอื่นที่ลืมเติมค่าตั้งต้น ก็ต้องไม่ทำให้บันทึกไม่ได้
--   ประวัติที่ "ว่าง" กับ "ไม่มี" มีความหมายเดียวกันคือยังไม่เคยต่อรอง
create or replace function public.fill_price_history() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.price_history is null then new.price_history := '[]'::jsonb; end if;
  return new;
end $$;

drop trigger if exists trg_fill_price_history on quotations;
create trigger trg_fill_price_history
  before insert on quotations
  for each row execute function public.fill_price_history();
