-- Benjamin PMS — M9 Phase 2: จับกลุ่มใบ "ปิดการขายได้" ตามลูกค้า ที่ฐานข้อมูล (customer_rollup)
--
-- useCustomerDb เดิม: โหลดใบทั้งเครือมา แล้ววน group ใบ won ตาม (dealerCode|ชื่อลูกค้า) ฝั่ง client
-- ย้ายการ group มาที่ DB — คืน "อาคารที่ซื้อ" (ใบ won) ต่อลูกค้า เป็น jsonb
--   client ยังคิด mainTemplate/วันส่งมอบ (helper JS) ต่อ · ตรงกับพฤติกรรมเดิม
--
-- parity: won = status 'won' · key = coalesce(dealer_code,'CNX') + customer (ตรงกับ HQQuotation.dealerCode|customer)
-- SECURITY INVOKER → RLS คุม scope (HQ เห็นทั้งเครือ)
create or replace function customer_rollup()
returns table (
  dealer_code text,
  customer    text,
  buildings   jsonb
)
language sql
stable
as $$
  select
    coalesce(dealer_code, 'CNX') as dealer_code,
    customer,
    jsonb_agg(
      jsonb_build_object(
        'quoteNo',     id,
        'productLine', coalesce(product_line, ''),
        'valueNum',    total_value,
        'date',        date
      ) order by date
    ) as buildings
  from quotations
  where status = 'won'
  group by coalesce(dealer_code, 'CNX'), customer;
$$;
