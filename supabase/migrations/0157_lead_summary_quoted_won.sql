-- ── lead_summary: byMonth ต้องบอก "กี่รายออกใบเสนอราคาแล้ว" + byDealer ต้องบอก "กี่รายเป็นลูกค้าแล้ว" ──
--
-- ที่มา (บอสสั่ง 21 ส.ค. 69): การ์ด "ลูกค้าเป้าหมาย เทียบ ที่ออกใบเสนอราคาแล้ว" ต้องไม่นับรายที่
--   ปิดการขายได้แล้ว เพราะรายนั้นกลายเป็น "ลูกค้า" ไปแล้ว ไม่ใช่เป้าหมายที่ยังต้องไล่
--   ของเดิมสรุปนี้ไม่มีตัวเลข "เป็นลูกค้าแล้ว" รายสาขา และไม่มี "ออกใบเสนอราคาแล้ว" รายเดือน
--   หน้าจอจึงหักเองไม่ได้ ต้องไปนับจากรายการดิบซึ่งฝั่งสำนักงานใหญ่ไม่ได้โหลดไว้ (ได้การ์ดว่างเปล่า)
--
-- ⚠️ ลายเซ็นเดิมทุกตัวอักษร (8 พารามิเตอร์ ชนิดเดิม ลำดับเดิม) = แทนที่ของเดิมจริง
--    ห้ามเพิ่ม/ลดพารามิเตอร์ ไม่งั้นจะกลายเป็นฟังก์ชันตัวที่สองที่ชื่อซ้ำ แล้ว PostgREST เลือกไม่ถูก
--    (PGRST203 — บทเรียนจากใบ 0111/0113/0153/0155 ที่พลาดซ้ำมาแล้วสี่ครั้ง)
-- ⚠️ เพิ่มคีย์ใหม่เท่านั้น ไม่ลบ/ไม่เปลี่ยนความหมายของคีย์เดิม — หน้าที่อ่านของเดิมอยู่ทำงานเหมือนเดิม

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
-- ⚠️ ต้องเขียน set search_path ไว้ในตัวฟังก์ชันเอง — create or replace เขียนทับคุณสมบัติทั้งก้อน
--    ของเดิมถูกตั้งไว้ทีหลังด้วย alter function (ใบ 0096) ถ้าไม่ใส่ซ้ำตรงนี้ การแข็งแรงนั้นจะหลุดหายไปเงียบ ๆ
set search_path = public
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
          count(*) filter (where status = 'CANCELLED') as lost,
          -- ราย (ไม่ใช่ใบ) ที่ไปถึงขั้นเสนอราคาแล้ว ของรุ่นที่เข้ามาเดือนนั้น
          count(*) filter (where status in ('QUOTED','FOLLOWUP','NEGO','PAID')) as quoted
        from f where created_date is not null group by y, mo) x), '[]'::jsonb),
    'byDealer', coalesce((select jsonb_agg(x) from (
        select dealer_code,
          count(*)                                                                 as leads,
          count(*) filter (where status in ('QUOTED','FOLLOWUP','NEGO','PAID'))    as quoted,
          -- ปิดการขายได้ = เป็นลูกค้าแล้ว · หน้าจอเอาไปหักออกเวลาต้องการเฉพาะรายที่ยังไล่อยู่
          count(*) filter (where status = 'PAID')                                  as won
        from f group by dealer_code) x), '[]'::jsonb)
  );
$$;
