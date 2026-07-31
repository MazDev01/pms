-- Benjamin PMS — close_won_quotation: รวบ flow "ปิดการขายสำเร็จ" ทั้งก้อนเป็นทรานแซกชันเดียว
-- (Phase 4 ต่อจาก 0093 — ทำหลังพิสูจน์ด้วย baseline test จริงแล้วว่ามีเครื่องมือยืนยันได้: func-quote-win.spec.ts)
--
-- เดิม: สร้าง/ผูกลูกค้า (upsert_customer_for_company, atomic อยู่แล้ว) → ผูกใบกำพร้าทั้งชุด
--   (relink_customer_quotes, atomic ตั้งแต่ 0093) → บังคับใบเป้าหมายเป็น won (setStatus แยก) →
--   รวมยอดใหม่ (reconcile_customer_won_total, atomic อยู่แล้ว) — 4 ก้าวนี้เป็นคนละคำสั่งเขียนแยกกัน
--   ถ้าเน็ตหลุดระหว่างก้าวที่ 2 กับ 3 จะได้ลูกค้า+ใบอื่นถูก relink แล้ว แต่ใบที่กดจริงยังค้างไม่ won
--   (ไม่ใช่ "won ไม่มีลูกค้า" ที่ constraint 0071 กันไว้แล้ว แต่เป็น partial-progress อีกแบบหนึ่ง)
--
-- รวบทั้ง 4 ก้าวเป็น RPC เดียว — เรียกฟังก์ชันที่มีอยู่แล้วต่อกันภายในทรานแซกชันเดียวกัน (ไม่เขียนตรรกะ
-- ซ้ำใหม่ ลดความเสี่ยงพลาด mirror จาก JS ผิด) ยืนยันด้วย baseline test (func-quote-win.spec.ts, 5/5
-- ผ่านก่อนแก้) แล้วรันซ้ำหลังแก้ต้องผ่านเท่าเดิมก่อนถือว่าเสร็จ

create or replace function public.close_won_quotation(
  p_dealer             text,
  p_known_customer_id  bigint,   -- lead.customerId ถ้ามีอยู่แล้ว (null = ยังไม่มี ต้องหา/สร้างจากชื่อบริษัท)
  p_lead_company       text,     -- ชื่อบริษัทของลีดต้นทาง (ใช้ relink ใบกำพร้า + upsert หาลูกค้า)
  p_target_quote_id    text,     -- ใบที่ต้อง "บังคับ" เป็น won เสมอ (null = ไม่มี พึ่ง cascade อย่างเดียว)
  p_cascade_won        boolean,  -- true = เลื่อนใบกำพร้าอื่นทั้งหมดของบริษัทนี้เป็น won ด้วย (ปิดจากฝั่งลีด)
  p_customer_payload   jsonb     -- ใช้เฉพาะตอนต้องสร้างลูกค้าใหม่จริง (ไม่มี known id และไม่เจอชื่อตรง)
) returns customers
language plpgsql
security definer
set search_path = public
as $$
declare
  cust customers;
begin
  if not (can_write_sales() and p_dealer = auth_dealer()) then
    raise exception 'forbidden: no permission to close won for %', p_dealer;
  end if;

  -- 1) ลูกค้ารู้ id อยู่แล้ว (ลีดเคยผูกไว้ก่อน) → ใช้ตรงๆ ไม่ต้อง upsert ซ้ำ (mirror convertLeadToCustomer
  --    ที่เช็ก lead.customerId != null ก่อนเป็นอันดับแรก)
  if p_known_customer_id is not null then
    select * into cust from customers where dealer_code = p_dealer and id = p_known_customer_id;
  end if;

  -- 2) ยังไม่รู้ตัวลูกค้า → หา/สร้างจากชื่อบริษัท (RPC เดิม, atomic + advisory lock กันซ้ำอยู่แล้ว)
  if cust.id is null then
    cust := upsert_customer_for_company(p_dealer, p_customer_payload);
  end if;

  -- 3) ผูกใบกำพร้าทั้งชุดของบริษัทนี้ (RPC เดิมจาก 0093)
  perform relink_customer_quotes(p_dealer, cust.id, p_lead_company, p_cascade_won);

  -- 4) บังคับใบเป้าหมายเป็น won เสมอ (เผื่อ cascade=false ไม่ได้แตะมัน หรือใบนี้มี customer_id เดิมอยู่แล้ว
  --    จากลูกค้าเก่า — กรณี "ปิดดีลที่สองของลูกค้าเดิม" ที่ relink คัดออกเพราะ customer_id ไม่ null)
  if p_target_quote_id is not null then
    update quotations set customer_id = cust.id, status = 'won'
     where dealer_code = p_dealer and id = p_target_quote_id;
  end if;

  -- 5) รวมยอดใหม่จากฐานข้อมูลสด (RPC เดิม, atomic อยู่แล้ว)
  cust := reconcile_customer_won_total(cust.id);

  return cust;
end $$;

revoke all on function public.close_won_quotation(text,bigint,text,text,boolean,jsonb) from public;
grant execute on function public.close_won_quotation(text,bigint,text,text,boolean,jsonb) to authenticated;
