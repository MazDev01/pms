-- Benjamin PMS — M9 Phase 4: ปลดหน้า /hq/leads ออกจาก netLeads array ส่วนที่เหลือ
--   1) lead_summary.byProvince — จังหวัด (ลูกค้า) ที่มีลีด → ป้อนตัวเลือกดรอปดาวน์ "จังหวัด"
--   2) unassigned_leads()      — ลีดที่ยังไม่มีผู้รับผิดชอบ เกินเกณฑ์ (ชม.) ของแต่ละสาขา
--      mirror unassignedLeads() ฝั่ง client: assigned ว่าง และ (as_of - created_date)*24 ชม. > เกณฑ์สาขา

-- 1) เพิ่ม byProvince ใน lead_summary (คงพารามิเตอร์/โครงเดิม)
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
      nullif(province, '')                        as province_g,
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
    'byProvince', coalesce((select jsonb_agg(x order by x.province) from (
        select province_g as province, count(*) as count from f where province_g is not null group by province_g) x), '[]'::jsonb),
    'byLostReason', coalesce((select jsonb_agg(x order by x.count desc) from (
        select lost_reason as reason, count(*) as count, coalesce(sum(parse_baht(value_txt)), 0) as value
        from f where status = 'CANCELLED' and lost_reason is not null and lost_reason <> ''
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

-- 2) unassigned_leads — จำนวนลีดไร้ผู้รับผิดชอบเกินเกณฑ์ + รายสาขา (ป้อนการ์ดเตือน + ป้ายช่วงเกณฑ์)
--    เกณฑ์ต่อสาขา: coalesce((p_per_dealer->>dealer_code)::int, p_default_hours) ชม.
--    ลีด "เปิด" เท่านั้น (ตัด PAID/CANCELLED) — ตรงกับ isLeadOpen ฝั่ง client
create or replace function unassigned_leads(
  p_as_of         date    default '2026-06-30',
  p_default_hours int     default 48,
  p_per_dealer    jsonb   default null,
  p_dealer_codes  text[]  default null,
  p_province      text    default null,
  p_product       text    default null,
  p_source        text    default null,
  p_search        text    default null,
  p_date_start    date    default null,
  p_date_end      date    default null
)
returns jsonb
language sql
stable
as $$
  with u as (
    select coalesce(dealer_code, 'CNX') as dealer_code
    from leads
    where (assigned is null or btrim(assigned) = '')
      and status not in ('PAID', 'CANCELLED')
      and created_date is not null
      and (p_as_of - created_date) * 24
          > coalesce((p_per_dealer ->> coalesce(dealer_code, 'CNX'))::int, p_default_hours)
      and (p_date_start is null or created_date >= p_date_start)
      and (p_date_end   is null or created_date <= p_date_end)
      and (p_dealer_codes is null or coalesce(dealer_code, 'CNX') = any(p_dealer_codes))
      and (p_province is null or province = p_province)
      and (p_product  is null or product = p_product)
      and (p_source   is null or coalesce(nullif(source, ''), 'ไม่ระบุ') = p_source)
      and (p_search is null
           or company ilike '%'||p_search||'%' or contact ilike '%'||p_search||'%'
           or province ilike '%'||p_search||'%' or product ilike '%'||p_search||'%'
           or id ilike '%'||p_search||'%' or dealer_code ilike '%'||p_search||'%')
  )
  select jsonb_build_object(
    'total', (select count(*) from u),
    'byDealer', coalesce((select jsonb_agg(x order by x.count desc) from (
        select dealer_code, count(*) as count from u group by dealer_code) x), '[]'::jsonb)
  );
$$;
