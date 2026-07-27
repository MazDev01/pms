-- Benjamin PMS — M9 Phase 1: DB aggregation (rollup ผลงานรายสาขา)
--
-- ย้าย "การรวมยอด" ของ useDealerPerformance ไปคำนวณที่ DB แทนการโหลดทุกแถวมารวมฝั่ง client
-- นิยาม/สูตรต้องตรงกับฝั่ง client เป๊ะ (parity) — มิฉะนั้นตัวเลขบนจอกับ DB จะขัดกัน:
--   quotes  = จำนวนใบทั้งหมดของสาขา
--   won/lost= นับตามสถานะ
--   revenue = Σ total_value ของใบ "won" ที่ปีของ date (ISO ธุรกิจ) = p_year
--             client ใช้ parseThaiDate(fmtISOToThai(q.date)).getFullYear() = ปี "literal" ของ date
--             (fmtISOToThai ตัด YYYY-MM-DD ตรง ๆ ไม่ shift timezone) → SQL ใช้ปีของ substring(date,1,10)
--   open_leads = ลีดที่ยังไม่ปิด (status ไม่ใช่ PAID/CANCELLED) · สาขา null = 'CNX' (ตรงกับ useNetworkLeads)
--
-- SECURITY INVOKER (ค่าปริยาย): ฟังก์ชันอ่าน quotations/leads ด้วยสิทธิ์ผู้เรียก → RLS คุม scope ให้เอง
--   (ตัวแทน = เฉพาะสาขาตน · HQ = ทั้งเครือ) เหมือน useNetworkQuotations/Leads ที่ client เห็น
create or replace function dealer_rollup(p_year int)
returns table (
  dealer_code text,
  quotes      bigint,
  won         bigint,
  lost        bigint,
  revenue     numeric,
  open_leads  bigint
)
language sql
stable
as $$
  with qd as (
    select
      coalesce(dealer_code, 'CNX') as dealer_code,
      status,
      total_value,
      -- ปีของ date แบบ literal — เฉพาะที่ขึ้นต้นด้วย YYYY-MM-DD (ตรงกับ regex ของ fmtISOToThai)
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
      count(*)                     as open_leads
    from leads
    where status not in ('PAID', 'CANCELLED')
    group by coalesce(dealer_code, 'CNX')
  )
  select
    coalesce(q.dealer_code, l.dealer_code)          as dealer_code,
    coalesce(q.quotes, 0)                           as quotes,
    coalesce(q.won, 0)                              as won,
    coalesce(q.lost, 0)                             as lost,
    coalesce(q.revenue, 0)                          as revenue,
    coalesce(l.open_leads, 0)                       as open_leads
  from q
  full outer join l on q.dealer_code = l.dealer_code;
$$;
