-- ── สรุปลูกค้าทั้งเครือ ต้องรับตัวกรองของหน้าจอได้ (บอสสั่ง 21 ส.ค. 69) ─────────────
--
-- ปัญหา: การ์ด "ลูกค้าทั้งเครือ" บนแดชบอร์ดสำนักงานใหญ่ไม่ขยับตามตัวกรองเลย
--   เลือกตัวแทนหรือช่วงเวลาแล้วการ์ดใบอื่นเปลี่ยนหมด แต่ใบนี้ยังเป็นยอดทั้งเครือทุกช่วงเวลา
--   อ่านคู่กันในหน้าเดียวแล้วขัดกันเอง — ผู้ดูแลสรุปตัวเลขผิดได้ง่ายมาก
--   ต้นเหตุ: network_customer_summary() ไม่มีพารามิเตอร์ให้กรองเลยสักตัว
--
-- ⚠️ ทำไมต้องคงรุ่นไม่มีพารามิเตอร์ไว้ด้วย:
--   หน้าอื่น (เช่น /hq/customers) ยังเรียกแบบไม่ส่งอะไรอยู่ · ถ้าเปลี่ยนลายเซ็นทิ้งดื้อ ๆ
--   PostgREST จะหาไม่เจอแล้วหน้าจอพังทันทีตอน deploy — ใช้ default ทุกตัวจึงเรียกได้ทั้งสองแบบ
--   (บทเรียนจากใบ 0111/0113/0153: ฟังก์ชันซ้อนลายเซ็นทำให้ PostgREST เลือกไม่ถูก → PGRST203
--    ที่นี่จึงเป็น "ฟังก์ชันเดียว พารามิเตอร์มี default" ไม่ใช่สร้างรุ่นที่สองขึ้นมาซ้อน)
--
-- ⚠️ ช่วงเวลา = "วันที่เป็นลูกค้า" (join_date) ซึ่งเก็บเป็น text รูปแบบ YYYY-MM-DD
--   ค่าที่ว่าง/รูปแบบเพี้ยนต้อง "ไม่ถูกตัดทิ้งเงียบ ๆ" เมื่อไม่ได้กรองช่วงเวลา
--   แต่ถ้ากรองช่วงเวลาแล้วอ่านวันไม่ออก = ตอบไม่ได้ว่าอยู่ในช่วงไหม จึงไม่นับ (ห้ามเดา)
--
-- RLS ยังทำงานตามเดิม: ตัวแทนเห็นเฉพาะของตัวเอง · สำนักงานใหญ่เห็นทั้งเครือ
create or replace function public.network_customer_summary(
  p_dealer_code text default null,
  p_date_start  date default null,
  p_date_end    date default null
)
returns jsonb
language sql
stable
set search_path = public
as $$
  with f as (
    select *
    from customers c
    where (p_dealer_code is null or c.dealer_code = p_dealer_code)
      and (
        (p_date_start is null and p_date_end is null)
        or (
          -- อ่านวันไม่ออก = ไม่นับเมื่อมีการกรองช่วงเวลา (ตอบไม่ได้ว่าอยู่ในช่วงไหม)
          c.join_date ~ '^\d{4}-\d{2}-\d{2}'
          and (p_date_start is null or substring(c.join_date from 1 for 10)::date >= p_date_start)
          and (p_date_end   is null or substring(c.join_date from 1 for 10)::date <= p_date_end)
        )
      )
  )
  select jsonb_build_object(
    'total', (select count(*) from f),
    'byProvince', coalesce((select jsonb_agg(x order by x.revenue desc) from (
        select coalesce(nullif(province, ''), 'ไม่ระบุ') as province,
               coalesce(sum(total_value), 0)             as revenue,
               count(*)                                  as count
        from f group by 1) x), '[]'::jsonb)
  );
$$;
