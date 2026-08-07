-- ── สร้างใบเสนอราคาแล้วค่าตั้งต้นของคอลัมน์ถูกข้ามทั้งหมด ────────────────────────
--
-- ปัญหา (บั๊กชนิดเดียวกับที่เคยแก้ในตารางลูกค้าที่ 0106/0107):
--   jsonb_populate_record(null::quotations, payload) เริ่มจากแถวที่ "ทุกคอลัมน์เป็น NULL"
--   แล้วเติมเฉพาะคีย์ที่มีใน payload → คอลัมน์ที่ผู้เรียกไม่ได้ส่งมาจะกลายเป็น NULL
--   ไม่ใช่ค่าตั้งต้นที่ประกาศไว้ในตาราง (Postgres ใช้ค่าตั้งต้นเฉพาะตอนที่ "ไม่ระบุคอลัมน์" เท่านั้น
--   แต่วิธีนี้ระบุครบทุกคอลัมน์ด้วยค่า NULL)
--
-- ผลที่เกิดจริง: ใบที่สร้างโดยไม่ส่ง total_value/material_cost/items มาด้วย จะได้ NULL แทน 0
--   → ยอดเงินของใบเป็นค่าว่าง ไม่ใช่ศูนย์ · การรวมยอดของลูกค้าจะข้ามใบนั้นไปเงียบ ๆ
--   → ตัวเลขบนหน้าจอกับความจริงไม่ตรงกัน โดยไม่มี error ให้เห็น
--
-- แก้แบบเดียวกับ 0106: ประกาศค่าตั้งต้นไว้ก่อน แล้วให้ payload ทับทีหลัง
-- (payload มาทีหลัง = ค่าที่ผู้ใช้ส่งมาจริงชนะเสมอ · ที่ไม่ได้ส่งจึงได้ค่าตั้งต้นที่ถูกต้อง)
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
