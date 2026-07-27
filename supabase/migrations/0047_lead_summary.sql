-- Benjamin PMS — M9 Phase 2: สรุปลีด "หลังกรอง" สำหรับ /hq/leads (analytics)
--
-- ใช้ created_date (normalize 0046) กรองช่วงเวลาแบบ permissive (null = ไม่ตัด — ตรงกับ !d || inRange)
-- ตัวกรอง = kpiBase ฝั่ง client: dealerCodes (dealer+region resolve) · province · product · source · search · status
-- คืน 5 ชุด: byStatus / bySource / byProduct / byLostReason / byMonth  (client คิด KPI + ป้อนกราฟต่อ)
--   followUp / overdue คง client (พึ่ง last_contact_at + เกณฑ์รายสาขา · leads โหลดอยู่แล้ว)
-- SECURITY INVOKER → RLS คุม scope
create or replace function lead_summary(
  p_dealer_codes text[]  default null,
  p_province     text    default null,
  p_product      text    default null,
  p_source       text    default null,   -- "ไม่ระบุ" = source ว่าง/null
  p_search       text    default null,
  p_status       text    default null,   -- lead_status หรือ null (ทุกสถานะ)
  p_date_start   date    default null,
  p_date_end     date    default null
)
returns jsonb
language sql
stable
as $$
  with f as (
    select
      coalesce(dealer_code, 'CNX')                as dealer_code,
      status::text                                as status,
      coalesce(nullif(source, ''), 'ไม่ระบุ')      as source_g,
      coalesce(nullif(product, ''), 'ไม่ระบุ')     as product_g,
      lost_reason,
      created_date,
      extract(year  from created_date)::int       as y,
      extract(month from created_date)::int       as mo
    from leads
    where (created_date is null or (p_date_start is null or created_date >= p_date_start))
      and (created_date is null or (p_date_end   is null or created_date <= p_date_end))
      and (p_dealer_codes is null or coalesce(dealer_code, 'CNX') = any(p_dealer_codes))
      and (p_province is null or province = p_province)
      and (p_product  is null or product = p_product)
      and (p_source   is null or coalesce(nullif(source, ''), 'ไม่ระบุ') = p_source)
      and (p_status   is null or status = p_status::lead_status)
      and (p_search is null
           or company ilike '%'||p_search||'%' or contact ilike '%'||p_search||'%'
           or province ilike '%'||p_search||'%' or product ilike '%'||p_search||'%'
           or assigned ilike '%'||p_search||'%' or id ilike '%'||p_search||'%'
           or dealer_code ilike '%'||p_search||'%')
  )
  select jsonb_build_object(
    'byStatus', coalesce((select jsonb_agg(x) from (
        select status, count(*) as count from f group by status) x), '[]'::jsonb),
    'bySource', coalesce((select jsonb_agg(x order by x.count desc) from (
        select source_g as source, count(*) as count from f group by source_g) x), '[]'::jsonb),
    'byProduct', coalesce((select jsonb_agg(x order by x.count desc) from (
        select product_g as product, count(*) as count from f group by product_g) x), '[]'::jsonb),
    'byLostReason', coalesce((select jsonb_agg(x order by x.count desc) from (
        select lost_reason as reason, count(*) as count from f
        where status = 'CANCELLED' and lost_reason is not null and lost_reason <> ''
        group by lost_reason) x), '[]'::jsonb),
    'byMonth', coalesce((select jsonb_agg(x order by x.y, x.m) from (
        select y, (mo - 1) as m,
          count(*)                                     as new,
          count(*) filter (where status = 'PAID')      as won,
          count(*) filter (where status = 'CANCELLED') as lost
        from f where created_date is not null group by y, mo) x), '[]'::jsonb)
  );
$$;
