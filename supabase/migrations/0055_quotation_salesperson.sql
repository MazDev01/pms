-- Benjamin PMS — M9 Phase 4: ผู้รับผิดชอบใบเสนอราคา (จากลีดที่ผูกกับใบ) รายใบ
--   ระบบไม่เก็บ salesperson ที่ใบ — เดิม client หาใน netLeads array (q.dealId=l.numId | q.customerId=l.customerId)
--   drawer ดูใบทีละใบ → RPC รายใบพอ (ไม่ต้องโหลดลีดทั้งเครือ) · RLS คุม scope
create or replace function quotation_salesperson(p_quote_id text)
returns text
language sql
stable
as $$
  select l.assigned
  from quotations q
  join leads l
    on (q.deal_id is not null and l.num_id = q.deal_id and coalesce(l.dealer_code,'CNX') = coalesce(q.dealer_code,'CNX'))
    or (coalesce(q.customer_id, 0) > 0 and l.customer_id = q.customer_id)
  where q.id = p_quote_id
  order by (q.deal_id is not null and l.num_id = q.deal_id) desc  -- ให้ deal_id ชนะ customer_id (ตรงกว่า)
  limit 1;
$$;
