-- Benjamin PMS — M9 Phase 4: ปลดกระดิ่งแจ้งเตือน HQ (useHQAlerts) ออกจาก array ทั้งเครือ
-- คืน "ผู้สมัคร" ของกฎที่พึ่งลีด/ใบ (unassigned/idle/expiring/dealerLatest/lostRate) — client ประกอบเป็นข้อความ+toggle
--   targetAchieved ไม่อยู่ที่นี่ (พึ่งยอดจริงจาก dealer_rollup + ทะเบียนตัวแทน — client คิดเอง)
-- mirror ตรง ๆ กับ hqAlerts.ts:
--   unassignedLeads: assigned ว่าง + เปิด + (as_of-created_date)*24 > เกณฑ์ชม.รายสาขา
--   idleLeads:       เปิด + (as_of-last_contact_at) วัน > p_lead_idle_days
--   expiringQuotes:  status sent_to_client + daysLeft=round(qdate+validity-as_of) ∈ [0, within]
--   idleDealers:     (as_of - max(qdate) รายสาขา) วัน  (client กรอง > p_dealer_idle_days + ต่อทะเบียน)
--   lostRate:        รายสาขา lost=CANCELLED / closed=(PAID|CANCELLED)  (client กรอง pct/minClosed)
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
    -- 1) ลีดไร้ผู้รับผิดชอบ (รายใบ)
    'unassigned', coalesce((select jsonb_agg(x order by x.num_id) from (
        select num_id, coalesce(nullif(company,''), name) as company, province, value
        from leads
        where (assigned is null or btrim(assigned) = '')
          and status not in ('PAID','CANCELLED')
          and created_date is not null
          and (p_as_of - created_date) * 24
              > coalesce((p_unassigned_per_dealer ->> coalesce(dealer_code,'CNX'))::int, p_unassigned_default_hours)
      ) x), '[]'::jsonb),
    -- 2) ลีดเงียบ (ไม่ติดต่อเกินเกณฑ์ HQ)
    'idle', coalesce((select jsonb_agg(x order by x.idle_days desc) from (
        select num_id, coalesce(nullif(company,''), name) as company, assigned,
               (p_as_of - last_contact_at) as idle_days
        from leads
        where status not in ('PAID','CANCELLED')
          and last_contact_at is not null
          and (p_as_of - last_contact_at) > p_lead_idle_days
      ) x), '[]'::jsonb),
    -- 3) ใบเสนอราคาใกล้หมดอายุ (ส่งแล้ว)
    'expiring', coalesce((select jsonb_agg(x order by x.days_left) from (
        select id as quote_no, customer, total_value as value, dealer_code,
               (substring(date,1,10)::date + p_quote_validity_days - p_as_of) as days_left
        from quotations
        where status = 'sent_to_client'
          and date ~ '^\d{4}-\d{2}-\d{2}'
          and (substring(date,1,10)::date + p_quote_validity_days - p_as_of) between 0 and p_quote_expiring_days
      ) x), '[]'::jsonb),
    -- 4) วันใบล่าสุดรายสาขา (client → idleDealers) — key = dealer_code ดิบ (null ไม่ผูกสาขาใด = ตรงกับ JS)
    'dealer_latest', coalesce((select jsonb_agg(x) from (
        select dealer_code,
               (p_as_of - max(substring(date,1,10)::date)) as idle_days
        from quotations where date ~ '^\d{4}-\d{2}-\d{2}' and dealer_code is not null
        group by dealer_code
      ) x), '[]'::jsonb),
    -- 5) อัตราปิดไม่สำเร็จรายสาขา (client → lostRate) — key = dealer_code ดิบ (null ไม่ผูกสาขาใด)
    'lost_rate', coalesce((select jsonb_agg(x) from (
        select dealer_code,
               count(*) filter (where status = 'CANCELLED') as lost,
               count(*) filter (where status in ('PAID','CANCELLED')) as closed
        from leads where dealer_code is not null group by dealer_code
      ) x), '[]'::jsonb)
  );
$$;
