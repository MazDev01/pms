-- Benjamin PMS — แก้ 0094: close_won_quotation ต้องคืนใบเสนอราคาที่ถูก relink กลับมาด้วย ไม่ใช่แค่ลูกค้า
--
-- ผู้เรียก (SalesContext.tsx) ต้องอัปเดต local state ของ quotations ทันทีหลังเรียกสำเร็จ (เหมือนที่
-- relink_customer_quotes เดิมคืน setof quotations ให้อยู่แล้ว) ไม่งั้น UI ค้างข้อมูลเก่าจนกว่า realtime
-- จะตามมาอัปเดต (มีดีเลย์ ไม่ตรงกับ UX เดิมที่เห็นผลทันทีหลังกด "ปิดการขายสำเร็จ")
--
-- เปลี่ยน return type จาก customers เป็น jsonb {customer, quotations[]} — ต้อง drop ก่อนเพราะ
-- Postgres ไม่ให้ CREATE OR REPLACE เปลี่ยน return type ของฟังก์ชันเดิม

drop function if exists public.close_won_quotation(text, bigint, text, text, boolean, jsonb);

create or replace function public.close_won_quotation(
  p_dealer             text,
  p_known_customer_id  bigint,
  p_lead_company       text,
  p_target_quote_id    text,
  p_cascade_won        boolean,
  p_customer_payload   jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cust   customers;
  result jsonb;
begin
  if not (can_write_sales() and p_dealer = auth_dealer()) then
    raise exception 'forbidden: no permission to close won for %', p_dealer;
  end if;

  if p_known_customer_id is not null then
    select * into cust from customers where dealer_code = p_dealer and id = p_known_customer_id;
  end if;

  if cust.id is null then
    cust := upsert_customer_for_company(p_dealer, p_customer_payload);
  end if;

  perform relink_customer_quotes(p_dealer, cust.id, p_lead_company, p_cascade_won);

  if p_target_quote_id is not null then
    update quotations set customer_id = cust.id, status = 'won'
     where dealer_code = p_dealer and id = p_target_quote_id;
  end if;

  cust := reconcile_customer_won_total(cust.id);

  -- ใบที่เกี่ยวข้องทั้งหมด: ตรงชื่อบริษัท (ทั้งที่เพิ่ง relink และที่เคยผูกอยู่ก่อนแล้วจากการปิดดีลก่อนหน้า)
  -- หรือคือใบเป้าหมายที่กำลังกด — ครอบทั้ง cascade case และ single-target case ในคำสั่งเดียว
  select jsonb_build_object(
    'customer', to_jsonb(cust),
    'quotations', coalesce(jsonb_agg(q), '[]'::jsonb)
  ) into result
  from quotations q
  where q.dealer_code = p_dealer and q.customer_id = cust.id
    and (q.customer = p_lead_company or q.id = p_target_quote_id);

  return result;
end $$;

revoke all on function public.close_won_quotation(text,bigint,text,text,boolean,jsonb) from public;
grant execute on function public.close_won_quotation(text,bigint,text,text,boolean,jsonb) to authenticated;
