-- Benjamin PMS — M9: เติม onTimePct ให้ dealer_rollup (ปิดงาน Phase 1 ที่ค้าง)
--
-- Phase 1 เว้น onTimePct ("ติดตามตรงเวลา") ไว้ client เพราะวันติดต่อล่าสุดอยู่ใน activities JSONB
-- ตอนนี้ 0046 มี leads.last_contact_at (= max วัน activities ?? created_date) แล้ว → คิดที่ DB ได้
--
-- เพิ่มคอลัมน์ stale_leads = ลีดที่ยังไม่ปิด "และเงียบเกินเกณฑ์" (= needsFollowUp ฝั่ง client)
--   needsFollowUp = isLeadOpen ∧ (as_of − last_contact_at) > เกณฑ์รายสาขา
--   เกณฑ์รายสาขา = p_follow_up_days[dealer] ?? p_default_days  (ตรงกับ rules[code] ?? DEFAULT)
-- onTimePct คิดในฮุก: openLeads>0 ? round((open − stale)/open*100) : null  (เท่าเดิม)
--
-- return table เปลี่ยน (เพิ่มคอลัมน์) → ต้อง DROP ก่อน
drop function if exists dealer_rollup(int);

create function dealer_rollup(
  p_year           int,
  p_as_of          date  default '2026-06-30',
  p_default_days   int   default 7,
  p_follow_up_days jsonb default null
)
returns table (
  dealer_code text,
  quotes      bigint,
  won         bigint,
  lost        bigint,
  revenue     numeric,
  open_leads  bigint,
  stale_leads bigint
)
language sql
stable
as $$
  with qd as (
    select
      coalesce(dealer_code, 'CNX') as dealer_code,
      status,
      total_value,
      case when date ~ '^\d{4}-\d{2}-\d{2}'
           then extract(year from substring(date, 1, 10)::date)::int end as yr
    from quotations
  ),
  q as (
    select
      dealer_code,
      count(*)                                                             as quotes,
      count(*) filter (where status = 'won')                              as won,
      count(*) filter (where status = 'lost')                             as lost,
      coalesce(sum(total_value) filter (where status = 'won' and yr = p_year), 0) as revenue
    from qd
    group by dealer_code
  ),
  l as (
    select
      coalesce(dealer_code, 'CNX') as dealer_code,
      count(*) filter (where status not in ('PAID', 'CANCELLED')) as open_leads,
      count(*) filter (where status not in ('PAID', 'CANCELLED')
        and last_contact_at is not null
        and (p_as_of - last_contact_at) > coalesce((p_follow_up_days ->> coalesce(dealer_code, 'CNX'))::int, p_default_days)
      ) as stale_leads
    from leads
    group by coalesce(dealer_code, 'CNX')
  )
  select
    coalesce(q.dealer_code, l.dealer_code)          as dealer_code,
    coalesce(q.quotes, 0)                           as quotes,
    coalesce(q.won, 0)                              as won,
    coalesce(q.lost, 0)                             as lost,
    coalesce(q.revenue, 0)                          as revenue,
    coalesce(l.open_leads, 0)                       as open_leads,
    coalesce(l.stale_leads, 0)                      as stale_leads
  from q
  full outer join l on q.dealer_code = l.dealer_code;
$$;
