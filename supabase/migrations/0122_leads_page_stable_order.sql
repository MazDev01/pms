-- ── ลำดับของ "ลีดทั้งเครือ" ต้องไม่มีทางเสมอกันได้ ────────────────────────────────
--
-- ปัญหา (ผลตรวจสอบระบบรอบ 2 · Part 8): เรียงด้วย created_date, num_id แล้วตัดหน้า
--   แต่ num_id เดินแยกกันรายสาขา — ลีดเลข 12 ของระยองกับเลข 12 ของเชียงใหม่คนละรายกันแต่ค่าเท่ากัน
--   ฝั่งตัวแทนไม่มีปัญหา (เห็นสาขาเดียว) แต่หน้า "ลีดทั้งเครือ" ของสำนักงานใหญ่รวมทุกสาขา
--   แถวที่เสมอกันทั้ง created_date และ num_id จึงถูกจัดหน้าตามใจฐานข้อมูล ไม่รับประกันว่าซ้ำเดิม
--   ผลที่ผู้ใช้เจอ: กดไปหน้า 2 แล้วเห็นลีดเดิมซ้ำ หรือลีดบางรายหายไปเลย โดยไม่มีอะไรฟ้อง
--
-- แก้: พ่วง dealer_code เป็นตัวตัดสินท้ายสุด — คู่ (num_id, dealer_code) ไม่มีทางซ้ำกันได้
--   ลำดับที่ผู้ใช้เห็นยังเหมือนเดิมทุกประการ เปลี่ยนแค่ "กรณีเสมอ" ให้มีคำตอบเดียวตายตัว
create or replace function leads_page(
  p_limit          int,
  p_offset         int,
  p_status         text    default null,
  p_dealer_codes   text[]  default null,
  p_province       text    default null,
  p_product        text    default null,
  p_source         text    default null,
  p_search         text    default null,
  p_date_start     date    default null,
  p_date_end       date    default null,
  p_overdue        boolean default false,
  p_as_of          date    default '2026-06-30',
  p_default_days   int     default 7,
  p_follow_up_days jsonb   default null
)
returns jsonb
language sql
stable
set search_path = public
as $$
  with f as (
    select * from leads
    where (created_date is null or p_date_start is null or created_date >= p_date_start)
      and (created_date is null or p_date_end   is null or created_date <= p_date_end)
      and (p_status        is null or status = p_status::lead_status)
      and (p_dealer_codes  is null or coalesce(dealer_code, 'CNX') = any(p_dealer_codes))
      and (p_province      is null or province = p_province)
      and (p_product       is null or product = p_product)
      and (p_source        is null or coalesce(nullif(source, ''), 'ไม่ระบุ') = p_source)
      and (p_search is null
           or company ilike '%'||p_search||'%' or contact ilike '%'||p_search||'%'
           or province ilike '%'||p_search||'%' or product ilike '%'||p_search||'%'
           or assigned ilike '%'||p_search||'%' or id ilike '%'||p_search||'%'
           or dealer_code ilike '%'||p_search||'%')
      and (not p_overdue or (
             status not in ('PAID', 'CANCELLED')
             and last_contact_at is not null
             and (p_as_of - last_contact_at) > coalesce((p_follow_up_days ->> coalesce(dealer_code, 'CNX'))::int, p_default_days)))
  )
  select jsonb_build_object(
    'total', (select count(*) from f),
    'rows', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_date desc nulls last, x.num_id desc, x.dealer_code)
      from (
        select * from f
        order by created_date desc nulls last, num_id desc, dealer_code
        limit p_limit offset p_offset
      ) x
    ), '[]'::jsonb)
  );
$$;
