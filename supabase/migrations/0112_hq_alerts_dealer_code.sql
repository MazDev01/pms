-- ── กระดิ่งแจ้งเตือน HQ: ต้องบอกด้วยว่าเป็นลีดของ "สาขาไหน" ──────────────────────
--
-- ปัญหา: รายการ unassigned/idle คืนมาแค่ num_id + ชื่อบริษัท ไม่มีรหัสสาขาเลย
--   • หน้าจอจึงขึ้นแค่ "บริษัท ก. ยังไม่มีผู้รับผิดชอบ" — HQ ไม่รู้ว่าต้องโทรหาสาขาไหน
--   • ลิงก์ในกระดิ่งพาไปด้วย num_id อย่างเดียว ซึ่งซ้ำกันได้ข้ามสาขา (คีย์จริง = dealer_code + num_id)
--     ถ้าวันหน้าหน้าจอรองรับพารามิเตอร์นี้ จะเปิดลีดผิดสาขาทันทีโดยไม่มีใครรู้
--   (ผลตรวจสอบระบบรอบ 2 · ข้อมูลปนข้ามสาขา)
--
-- แก้: เติม dealer_code ลงในสองก้อนนี้ ให้เท่ากับ 'expiring' ที่มีอยู่แล้ว
-- ส่วนที่เหลือของฟังก์ชันคงเดิมทุกบรรทัด (คัดลอกจาก 0057 มาแก้เฉพาะ select สองจุด)

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
        select num_id, dealer_code, coalesce(nullif(company,''), name) as company, province, value
        from leads
        where (assigned is null or btrim(assigned) = '')
          and status not in ('PAID','CANCELLED')
          and created_date is not null
          and (p_as_of - created_date) * 24
              > coalesce((p_unassigned_per_dealer ->> coalesce(dealer_code,'CNX'))::int, p_unassigned_default_hours)
      ) x), '[]'::jsonb),
    -- 2) ลีดเงียบ (ไม่ติดต่อเกินเกณฑ์ HQ)
    'idle', coalesce((select jsonb_agg(x order by x.idle_days desc) from (
        select num_id, dealer_code, coalesce(nullif(company,''), name) as company, assigned,
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
