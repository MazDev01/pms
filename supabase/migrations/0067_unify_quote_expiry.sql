-- Benjamin PMS — รวม "วันหมดอายุใบเสนอราคา" ให้เป็นนิยามเดียว (เดิม 2 จุดคิดคนละแบบ)
--
-- ปัญหา: expire_quotations (0019) ปิดใบตาม "expiry" ที่กรอกเอง
--        hq_alerts 'expiring' (0057) เตือน "ใกล้หมดอายุ" ตาม date+quote_validity_days เสมอ (ไม่สนใจ expiry)
--   ผลที่ตามมา:
--     • ฟอร์มออกใบ (LeadQuotationsPanel) ค่าเริ่มต้น expiry = ว่าง → ใบส่วนใหญ่ไม่มี expiry เลย
--       → expire_quotations "ไม่เคยปิดใบพวกนี้ให้เลย" (cron 0066 no-op กับใบส่วนใหญ่)
--     • ใบที่ตั้ง expiry เองไว้ไกลจากวันนี้ ก็ยังโดนเตือน "ใกล้หมดอายุ" ผิด ๆ จาก date+validity
--
-- แก้: นิยามเดียว "effective_expiry" = expiry ที่กรอกเอง (ถ้ามีและอ่านได้) ไม่งั้น date + validity_days
--   ใช้ทั้งการปิดใบจริง (expire_quotations) และการเตือนล่วงหน้า (hq_alerts) → เห็นวันหมดอายุตรงกันทุกจุด

-- ── expire_quotations: เพิ่ม p_validity_days (default 30 เท่าเดิม) ───────────────
-- เปลี่ยน signature (เดิมมีแค่ p_as_of) → ต้อง drop ก่อนสร้างใหม่ (พารามิเตอร์เพิ่ม = คนละ overload)
-- เรียกแบบเดิม (ส่งแค่ p_as_of) ยังใช้ได้ปกติ เพราะ p_validity_days มีค่า default
drop function if exists public.expire_quotations(date);

create or replace function public.expire_quotations(p_as_of date, p_validity_days integer default 30)
returns integer
language plpgsql
as $$
declare n integer;
begin
  update quotations
     set status = 'expired'
   where status = 'sent_to_client'
     and (
       case
         when expiry is not null and expiry ~ '^\d{4}-\d{2}-\d{2}$' then expiry::date
         when date ~ '^\d{4}-\d{2}-\d{2}' then substring(date,1,10)::date + p_validity_days
         else null
       end
     ) < p_as_of;
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function public.expire_quotations(date, integer) from anon;
grant   execute on function public.expire_quotations(date, integer) to authenticated;

-- ── hq_alerts: 'expiring' ใช้นิยามเดียวกัน (expiry ก่อน ไม่มีค่อย fallback date+validity) ──
-- signature เดิมไม่เปลี่ยน (p_quote_validity_days มีอยู่แล้ว) — create or replace แทนที่ตัวเดิมได้ตรง ๆ
create or replace function hq_alerts(
  p_as_of                    date    default '2026-06-30',
  p_unassigned_default_hours int     default 48,
  p_unassigned_per_dealer    jsonb   default null,
  p_lead_idle_days           int     default 30,
  p_quote_validity_days      int     default 30,
  p_quote_expiring_days      int     default 7,
  p_dealer_idle_days         int     default 30
)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'unassigned', coalesce((select jsonb_agg(x order by x.num_id) from (
        select num_id, coalesce(nullif(company,''), name) as company, province, value
        from leads
        where (assigned is null or btrim(assigned) = '')
          and status not in ('PAID','CANCELLED')
          and created_date is not null
          and (p_as_of - created_date) * 24
              > coalesce((p_unassigned_per_dealer ->> coalesce(dealer_code,'CNX'))::int, p_unassigned_default_hours)
      ) x), '[]'::jsonb),
    'idle', coalesce((select jsonb_agg(x order by x.idle_days desc) from (
        select num_id, coalesce(nullif(company,''), name) as company, assigned,
               (p_as_of - last_contact_at) as idle_days
        from leads
        where status not in ('PAID','CANCELLED')
          and last_contact_at is not null
          and (p_as_of - last_contact_at) > p_lead_idle_days
      ) x), '[]'::jsonb),
    -- ใกล้หมดอายุ: effective_expiry = expiry ที่กรอกเอง ไม่งั้น date+validity (นิยามเดียวกับ expire_quotations)
    'expiring', coalesce((select jsonb_agg(x order by x.days_left) from (
        select id as quote_no, customer, total_value as value, dealer_code,
               (eff_expiry - p_as_of) as days_left
        from (
          select id, customer, total_value, dealer_code,
                 case
                   when expiry is not null and expiry ~ '^\d{4}-\d{2}-\d{2}$' then expiry::date
                   when date ~ '^\d{4}-\d{2}-\d{2}' then substring(date,1,10)::date + p_quote_validity_days
                   else null
                 end as eff_expiry
          from quotations
          where status = 'sent_to_client'
        ) q
        where eff_expiry is not null
          and (eff_expiry - p_as_of) between 0 and p_quote_expiring_days
      ) x), '[]'::jsonb),
    'dealer_latest', coalesce((select jsonb_agg(x) from (
        select dealer_code,
               (p_as_of - max(substring(date,1,10)::date)) as idle_days
        from quotations where date ~ '^\d{4}-\d{2}-\d{2}' and dealer_code is not null
        group by dealer_code
      ) x), '[]'::jsonb),
    'lost_rate', coalesce((select jsonb_agg(x) from (
        select dealer_code,
               count(*) filter (where status = 'CANCELLED') as lost,
               count(*) filter (where status in ('PAID','CANCELLED')) as closed
        from leads where dealer_code is not null group by dealer_code
      ) x), '[]'::jsonb)
  );
$$;
