-- Benjamin PMS — เก็บกวาดจากผลตรวจสอบระบบเต็มรูปแบบ (Backend/API engineer, 30 ก.ค. 69)
--
-- พบว่าฝั่งแอปกดสร้างใบเสนอราคาที่ไม่มีรายการ BOQ เลยได้ (ยืนยันจริง: POST rpc/create_quotation
-- คืน 200 พร้อม total_value=0, items=0, line_items=[]) แล้วแก้ไม่ได้อีกเลยผ่านหน้าจอ เพราะโหมด
-- แก้ไขใช้ editor ตัวเดียวกับตอนสร้างที่ไม่มีปุ่มเพิ่มรายการ (showCatalog=false) — เสียเลขที่
-- เอกสารจริงถาวร ตรงข้ามเจตนาของ migration 0034 ที่ต้องการกันเลขที่หายไปโดยเปล่าประโยชน์
--
-- แก้ฝั่งแอปแล้ว (LeadQuotationsPanel.tsx: ปิดปุ่มบันทึกเมื่อยังไม่มีรายการ) ใบนี้เป็นเซฟตี้เน็ต
-- ชั้นที่ 2 ที่ตัว RPC เอง กันเส้นทางอื่นในอนาคต (ไม่ผ่าน UI ปัจจุบัน) ยิงเข้ามาตรงๆ
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
  if not ((can_write_sales() and p_dealer = auth_dealer()) or can_write_master()) then
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
  num := coalesce(nullif(p_prefix, ''), 'Q-2026-') || lpad(n::text, 4, '0');

  insert into quotations
    select * from jsonb_populate_record(
      null::quotations,
      p_payload || jsonb_build_object('id', num, 'dealer_code', p_dealer, 'created_at', now()))
    returning * into result;

  return result;
end $$;
