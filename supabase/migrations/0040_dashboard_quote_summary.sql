-- Benjamin PMS — M9 Phase 1 (ต่อ): RPC สรุปใบเสนอราคาของ /hq/dashboard รอบเดียว
--
-- แทนการวน winQuotes ฝั่ง client หลายรอบ (productAgg/buildingPerf/quoteStatus/pipeline/
-- quoteWonSeries/monthly/bottomMetrics/trendMonthly/wonValNum) ด้วย RPC เดียว → คืน 3 ชุด:
--   byMonth   : ราย (ปี, เดือน 0-11) — quotes/won/lost + won_val  (ป้อนกราฟรายเดือน)
--   byStatus  : รายสถานะ — count + value                          (ป้อน quoteStatus/pipeline/wonVal)
--   byProduct : ราย productLine (building_type || project) — value + projects
--
-- parity กับ client เป๊ะ: ช่วง/สาขา/สถานะ/มูลค่า เหมือน winQuotes
--   เดือน 0-11 = getMonth() ฝั่ง JS · productLine = buildingType || project
-- SECURITY INVOKER: RLS คุม scope (HQ=ทั้งเครือ · ตัวแทน=สาขาตน)
create or replace function dashboard_quote_summary(
  p_start   date,
  p_end     date,
  p_dealer  text default null
)
returns jsonb
language sql
stable
as $$
  with f as (
    select
      status::text                                        as status,
      total_value,
      extract(year  from substring(date, 1, 10)::date)::int as y,
      extract(month from substring(date, 1, 10)::date)::int as mo,   -- 1..12
      coalesce(nullif(building_type, ''), nullif(project, '')) as product
    from quotations
    where date ~ '^\d{4}-\d{2}-\d{2}'
      and substring(date, 1, 10)::date between p_start and p_end
      and (p_dealer is null or coalesce(dealer_code, 'CNX') = p_dealer)
  )
  select jsonb_build_object(
    'byMonth', coalesce((select jsonb_agg(x order by x.y, x.m) from (
        select y, (mo - 1) as m,                              -- 0..11 ให้ตรง getMonth()
          count(*)                                             as quotes,
          count(*) filter (where status = 'won')              as won,
          count(*) filter (where status = 'lost')             as lost,
          coalesce(sum(total_value) filter (where status = 'won'), 0) as won_val
        from f group by y, mo
      ) x), '[]'::jsonb),
    'byStatus', coalesce((select jsonb_agg(x) from (
        select status,
          count(*)                          as count,
          coalesce(sum(total_value), 0)     as value
        from f group by status
      ) x), '[]'::jsonb),
    'byProduct', coalesce((select jsonb_agg(x order by x.value desc) from (
        select product,
          coalesce(sum(total_value), 0)     as value,
          count(*)                          as projects
        from f group by product
      ) x), '[]'::jsonb)
  );
$$;
