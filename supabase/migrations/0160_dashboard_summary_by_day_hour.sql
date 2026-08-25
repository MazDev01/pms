-- ── กราฟแดชบอร์ดต้องแยกตามวัน/ชั่วโมงได้ (บอสสั่ง 25 ส.ค. 69) ──────────────────
--
-- เดิม dashboard_quote_summary คืนแค่ระดับ "เดือน" หน้าจอจึงทำกราฟรายวันไม่ได้
-- ที่ผ่านมาหน้า HQ ไปนับจากรายการใบฝั่งเครื่องแทน แต่ HQ ไม่ได้โหลดใบทั้งเครือมาไว้ในเครื่อง
-- (ตั้งใจ — ที่สเกลจริงหลายพันใบ) ผลคือกราฟรายวัน/รายชั่วโมงขึ้น ฿0 ทั้งที่ในฐานมีข้อมูล
-- → ให้ฐานข้อมูลสรุปมาให้เลย เพิ่ม 2 ชุด:
--     byDay  = รายวันในช่วง (ใช้กับ วันนี้ / 7 วันล่าสุด / เดือนนี้ / กำหนดเองสั้น ๆ)
--     byHour = รายชั่วโมงตาม "เวลาที่บันทึกใบเข้าระบบ" (created_at) ใช้กับช่วง 1 วัน
--
-- ⚠️ byHour ใช้ created_at ไม่ใช่ date — ระบบไม่เก็บ "เวลาที่ปิดการขาย" มีแต่วันที่
--    หน้าจอเขียนกำกับไว้แล้วว่าเป็นเวลาที่บันทึกเข้าระบบ ห้ามเอาไปเรียกว่าเวลาปิดการขาย
-- ⚠️ เวลาแปลงเป็นโซนไทยก่อนตัดชั่วโมง (created_at เก็บเป็น UTC)
-- ⚠️ ลายเซ็นเดิมทุกตัวอักษร (3 พารามิเตอร์) — create or replace ทับได้เลย ไม่เกิดฟังก์ชันซ้อน

create or replace function dashboard_quote_summary(
  p_start   date,
  p_end     date,
  p_dealer  text default null
)
returns jsonb
language sql
stable
set search_path = public
as $$
  with f as (
    select
      status::text                                        as status,
      total_value,
      created_at,
      substring(date, 1, 10)::date                        as d,
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
        select y, (mo - 1) as m,
          count(*)                                             as quotes,
          count(*) filter (where status = 'won')              as won,
          count(*) filter (where status = 'lost')             as lost,
          coalesce(sum(total_value) filter (where status = 'won'), 0) as won_val
        from f group by y, mo
      ) x), '[]'::jsonb),
    'byDay', coalesce((select jsonb_agg(x order by x.d) from (
        select to_char(d, 'YYYY-MM-DD') as d,
          count(*)                                             as quotes,
          count(*) filter (where status = 'won')              as won,
          count(*) filter (where status = 'lost')             as lost,
          coalesce(sum(total_value) filter (where status = 'won'), 0) as won_val
        from f group by d
      ) x), '[]'::jsonb),
    'byHour', coalesce((select jsonb_agg(x order by x.h) from (
        select extract(hour from (created_at at time zone 'Asia/Bangkok'))::int as h,
          count(*)                                             as quotes,
          count(*) filter (where status = 'won')              as won,
          coalesce(sum(total_value) filter (where status = 'won'), 0) as won_val
        from f where created_at is not null group by 1
      ) x), '[]'::jsonb),
    'byStatus', coalesce((select jsonb_agg(x) from (
        select status,
          count(*)                          as count,
          coalesce(sum(total_value), 0)     as value
        from f group by status
      ) x), '[]'::jsonb),
    'byProduct', coalesce((select jsonb_agg(x order by x.won_value desc, x.value desc) from (
        select product,
          coalesce(sum(total_value), 0)                                as value,
          count(*)                                                     as projects,
          coalesce(sum(total_value) filter (where status = 'won'), 0)  as won_value,
          count(*) filter (where status = 'won')                       as won_projects
        from f group by product
      ) x), '[]'::jsonb)
  );
$$;
