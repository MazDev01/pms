-- ── แดชบอร์ด: "ยอดขายตามประเภทอาคาร" ต้องนับเฉพาะใบที่ปิดการขายได้ ────────────────
--
-- บั๊กจริง (เอเจนต์สวมบทผู้บริหารเจอเอง 10 ส.ค. 69):
--   การ์ด "ยอดขายตามประเภทอาคาร" บน /hq/dashboard รวมยอดของใบเสนอราคา "ทุกใบ"
--   รวมทั้งใบที่ยังเป็นร่างและใบที่ปิดการขายไม่สำเร็จ
--   ผลที่เห็นจริง: การ์ดนี้ขึ้น ฿15.6M ขณะที่การ์ดอื่นในหน้าเดียวกันขึ้น ฿10.2M
--   (ใบที่ชนะจริงมีใบเดียว ฿10.2M · อีกใบ ฿5.44M ยังเป็นร่างอยู่)
--   → หน้าแดชบอร์ดของผู้บริหารรายงานยอดขายเกินจริง และขัดกับตัวเองในหน้าเดียวกัน
--
-- ⚠️ ทำไมเพิ่มฟิลด์ใหม่ ไม่แก้ค่าเดิมทับ:
--   byProduct ตัวนี้ถูกใช้สองความหมายในระบบ และทั้งสองความหมายถูกต้องในที่ของมัน
--     • แดชบอร์ด → การ์ด "ยอดขายตามประเภทอาคาร"  = ต้องนับเฉพาะที่ปิดการขายได้
--     • ฝั่ง client ตอน fallback ก็คิดจากใบที่ชนะอยู่แล้ว (winQuotes) = ตั้งใจแบบนี้มาแต่แรก
--   แต่ถ้าไปแก้ value เดิมทับ จะกระทบผู้เรียกอื่นที่อาจต้องการยอดรวมทุกใบ
--   → เพิ่ม won_value / won_projects แยกไว้ แล้วให้การ์ดยอดขายใช้ตัวใหม่ ของเดิมไม่กระทบ
--
-- (การ์ด "ประเภทอาคาร · ใบเสนอราคาแยกตามประเภทอาคาร" บน /hq/quotations ใช้ RPC คนละตัว
--  และนับทุกใบซึ่งถูกต้องตามชื่อการ์ดอยู่แล้ว — ไม่ต้องแก้)

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
    'byProduct', coalesce((select jsonb_agg(x order by x.won_value desc, x.value desc) from (
        select product,
          coalesce(sum(total_value), 0)                                as value,
          count(*)                                                     as projects,
          -- ↓ ของใหม่: เฉพาะใบที่ปิดการขายได้ = "ยอดขาย" จริง ๆ
          coalesce(sum(total_value) filter (where status = 'won'), 0)  as won_value,
          count(*) filter (where status = 'won')                       as won_projects
        from f group by product
      ) x), '[]'::jsonb)
  );
$$;
