-- Benjamin PMS — ปิดช่องโหว่จากผลตรวจสอบระบบเต็มรูปแบบรอบ 2 (Backend/Security, 31 ก.ค. 69)
--
-- create_quotation (มาตั้งแต่ 0034, สืบทอดต่อมาที่ 0073) มีเงื่อนไข "or can_write_master()"
-- ทำให้บัญชี HQ (SUPER_ADMIN/HQ_MANAGEMENT) ข้ามการตรวจ p_dealer = auth_dealer() ได้ สร้างใบเสนอ
-- ราคาจริงแทนสาขาไหนก็ได้โดยไม่เคยล็อกอินเป็นสาขานั้น — ขัดกับกฎ 2 ระดับสิทธิ์ที่ยึดถือมาตลอด
-- (HQ = ดูภาพรวมอย่างเดียว ไม่มีสิทธิ์เขียนข้อมูลขาย) ยืนยันซ้ำแล้วว่าเกิดจริงผ่าน RPC ตรงๆ
--
-- เทียบกับ RPC เขียนข้อมูลของสาขาตัวอื่นที่เขียนทีหลัง (0074 upsert_customer_for_company,
-- 0078 reconcile_customer_won_total) ทั้งคู่ไม่มีช่องนี้ — ตรวจแค่ can_write_sales() ∧ เจ้าของสาขา
-- แก้ให้ create_quotation ตรงตามแพทเทิร์นเดียวกัน ตัด "or can_write_master()" ออก
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
  num := coalesce(nullif(p_prefix, ''), 'Q-2026-') || lpad(n::text, 4, '0');

  insert into quotations
    select * from jsonb_populate_record(
      null::quotations,
      p_payload || jsonb_build_object('id', num, 'dealer_code', p_dealer, 'created_at', now()))
    returning * into result;

  return result;
end $$;
