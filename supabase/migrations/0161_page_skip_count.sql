-- ── ตารางแบ่งหน้า: ไม่ต้องนับยอดรวมใหม่ทุกครั้งที่กดเปลี่ยนหน้า ──────────────
--
-- วัดจริง 27 ส.ค. 69 ที่ข้อมูล 20,000 ลูกค้าเป้าหมาย:
--   leads_page ยิงด้วยกุญแจระดับระบบ (ข้ามกฎความปลอดภัย)  ~200ms
--   leads_page ยิงในนามผู้ใช้จริง (กฎความปลอดภัยตรวจ)    ~2,080ms
--   อ่านข้อมูล 20 แถวเท่ากันทั้งสองแบบ (~240ms) — ตัวถ่วงคือ "นับยอดรวมแบบเป๊ะ"
--   เพราะการนับต้องไล่ตรวจสิทธิ์ครบทุกแถวในตาราง ไม่ใช่แค่ 20 แถวที่จะแสดง
--
-- แก้: เพิ่มสวิตช์ "ไม่ต้องนับ" — ฝั่งแอปนับครั้งเดียวตอนเข้าหน้า/เปลี่ยนตัวกรอง
--   แล้วใช้ตัวเลขเดิมซ้ำตอนกดเปลี่ยนหน้า (ตัวกรองเท่าเดิม จำนวนรวมย่อมเท่าเดิม)
--   คืน total = -1 เมื่อไม่ได้นับ เพื่อให้ผู้เรียกรู้ชัดว่า "ไม่ใช่ศูนย์ แต่ไม่ได้นับ"
--
-- ⚠️ ค่าตั้งต้นเป็น false = ผู้เรียกเดิมทุกตัวได้พฤติกรรมเดิมเป๊ะ ไม่ต้องแก้อะไร
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
  p_follow_up_days jsonb   default null,
  p_skip_count     boolean default false
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
    'total', case when p_skip_count then -1 else (select count(*) from f) end,
    'rows', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_date desc nulls last, x.num_id desc, x.dealer_code)
      from (
        select * from f
        order by created_date desc nulls last, num_id desc, dealer_code
        limit p_limit offset p_offset
      ) x
    ), '[]'::jsonb)
  )
$$;

alter function public.leads_page(int, int, text, text[], text, text, text, text, date, date, boolean, date, int, jsonb, boolean)
  set search_path = public;
