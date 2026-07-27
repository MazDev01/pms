-- Benjamin PMS — M9 Phase 4: ปลดหน้า dashboard ออกจาก array ทั้งเครือ (ลีด + ลูกค้า)
--   1) parse_baht(text)         — มิเรอร์ parseBaht ฝั่ง client ("฿1.2M"→1200000) ใน SQL
--   2) lead_summary.byStatus    — เพิ่ม value (Σ parse_baht(value)) ป้อน journeyStages (มูลค่าต่อขั้น)
--   3) network_customer_summary — total + byProvince(revenue) ป้อน KPI ลูกค้า + provinceTop6

-- 1) parse_baht — แปลงสตริงมูลค่าเป็นตัวเลขบาท (รองรับ B/M/K, คอมมา, ฿)
create or replace function parse_baht(v text)
returns numeric
language sql
immutable
as $$
  select case
    when v is null or v = '' then 0
    else coalesce(nullif(regexp_replace(v, '[^0-9.]', '', 'g'), '')::numeric, 0)
       * case when v ~* 'b' then 1e9
              when v ~* 'm' then 1e6
              when v ~* 'k' then 1e3
              else 1 end
  end;
$$;

-- 2) lead_summary — เพิ่ม value ใน byStatus (คงพารามิเตอร์/โครงเดิมทุกอย่าง)
create or replace function lead_summary(
  p_dealer_codes text[]  default null,
  p_province     text    default null,
  p_product      text    default null,
  p_source       text    default null,
  p_search       text    default null,
  p_status       text    default null,
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
      value                                       as value_txt,
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
        select status, count(*) as count, coalesce(sum(parse_baht(value_txt)), 0) as value
        from f group by status) x), '[]'::jsonb),
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
        from f where created_date is not null group by y, mo) x), '[]'::jsonb),
    'byDealer', coalesce((select jsonb_agg(x) from (
        select dealer_code,
          count(*)                                                                 as leads,
          count(*) filter (where status in ('QUOTED','FOLLOWUP','NEGO','PAID'))    as quoted
        from f group by dealer_code) x), '[]'::jsonb)
  );
$$;

-- 3) network_customer_summary — จำนวนลูกค้าทั้งเครือ + ยอดขายรายจังหวัด (RLS auto-scope)
create or replace function network_customer_summary()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'total', (select count(*) from customers),
    'byProvince', coalesce((select jsonb_agg(x order by x.revenue desc) from (
        select coalesce(nullif(province, ''), 'ไม่ระบุ') as province,
               coalesce(sum(total_value), 0)             as revenue,
               count(*)                                  as count
        from customers group by 1) x), '[]'::jsonb)
  );
$$;
