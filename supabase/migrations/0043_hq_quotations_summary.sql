-- Benjamin PMS — M9 Phase 2: สรุปใบเสนอราคา "หลังกรอง" สำหรับ /hq/quotations (analytics)
--
-- หน้า quotations กรองด้วย status/dealer/region/province/product/search/time แล้วรวมยอด client
-- (aggregate/RegionalComparison/TopDealerRanking/BuildingType/Aging/Trend) → ย้ายมารวมที่ DB
-- โดยรับ "ชุดกรองเดียวกับ listPage" (derived filter ผู้เรียก resolve เป็น dealerCodes/productLines มาก่อน)
--
-- คืน 4 ชุด (parity กับตัวช่วยฝั่ง client ใน hqQuotations.ts):
--   byDealer  : ราย dealer_code — count/value/sent(≠draft)/won/lost/wonVal
--               → client รวมเป็น KPI รวม + จัดกลุ่มเป็นภูมิภาค + อันดับตัวแทน (มี region map อยู่แล้ว)
--   byMonth   : ราย (ปี,เดือน 0-11) — quotes/won/lost/wonVal (กราฟแนวโน้ม)
--   byProduct : ราย product_line — value/projects (ประเภทอาคาร)
--   aging     : เฉพาะใบ "ค้าง" (sent_to_client) แยกช่วงอายุ (as_of − date) — count/value ต่อช่วง
--
-- p_as_of = "วันนี้ของระบบ" (APP_NOW) สำหรับคิดอายุใบ · SECURITY INVOKER → RLS คุม scope
create or replace function hq_quotations_summary(
  p_status        text     default null,
  p_dealer_codes  text[]   default null,
  p_product_lines text[]   default null,
  p_search        text     default null,
  p_date_start    date     default null,
  p_date_end      date     default null,
  p_as_of         date     default '2026-06-30'
)
returns jsonb
language sql
stable
as $$
  with f as (
    select
      coalesce(dealer_code, 'CNX')                          as dealer_code,
      status::text                                          as status,
      total_value,
      product_line,
      extract(year  from substring(date, 1, 10)::date)::int as y,
      extract(month from substring(date, 1, 10)::date)::int as mo,
      greatest(0, (p_as_of - substring(date, 1, 10)::date)) as aging_days
    from quotations
    where date ~ '^\d{4}-\d{2}-\d{2}'
      and (p_status        is null or status = p_status::quotation_status)
      and (p_dealer_codes  is null or coalesce(dealer_code, 'CNX') = any(p_dealer_codes))
      and (p_product_lines is null or product_line = any(p_product_lines))
      and (p_search        is null or id ilike '%' || p_search || '%' or customer ilike '%' || p_search || '%')
      and (p_date_start    is null or substring(date, 1, 10)::date >= p_date_start)
      and (p_date_end      is null or substring(date, 1, 10)::date <= p_date_end)
  )
  select jsonb_build_object(
    'byDealer', coalesce((select jsonb_agg(x order by x.value desc) from (
        select dealer_code,
          count(*)                                                     as count,
          coalesce(sum(total_value), 0)                                as value,
          count(*) filter (where status <> 'draft')                    as sent,
          count(*) filter (where status = 'won')                       as won,
          count(*) filter (where status = 'lost')                      as lost,
          coalesce(sum(total_value) filter (where status = 'won'), 0)  as won_val
        from f group by dealer_code) x), '[]'::jsonb),
    'byMonth', coalesce((select jsonb_agg(x order by x.y, x.m) from (
        select y, (mo - 1) as m,
          count(*)                                                     as quotes,
          count(*) filter (where status = 'won')                       as won,
          count(*) filter (where status = 'lost')                      as lost,
          coalesce(sum(total_value) filter (where status = 'won'), 0)  as won_val
        from f group by y, mo) x), '[]'::jsonb),
    'byProduct', coalesce((select jsonb_agg(x order by x.value desc) from (
        select product_line as product,
          coalesce(sum(total_value), 0)  as value,
          count(*)                       as projects
        from f group by product_line) x), '[]'::jsonb),
    'aging', coalesce((select jsonb_agg(x) from (
        select
          case when aging_days <= 7 then '0-7'
               when aging_days <= 14 then '8-14'
               when aging_days <= 30 then '15-30'
               else '30+' end            as bucket,
          count(*)                       as count,
          coalesce(sum(total_value), 0)  as value
        from f where status = 'sent_to_client'
        group by 1) x), '[]'::jsonb)
  );
$$;
