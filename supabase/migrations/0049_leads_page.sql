-- Benjamin PMS — M9 Phase 4: ตารางลีดทั้งเครือ "แบ่งหน้า + กรอง ที่ DB"
--
-- แทนการโหลดลีดทั้งเครือมา render ทั้งชุด → ดึงทีละหน้าที่ DB · overdue (needsFollowUp) กรองที่ DB ด้วย
-- last_contact_at (0046) + เกณฑ์รายสาขา · คืน jsonb { total, rows } (rows = แถวดิบ snake_case ให้ rowToLead map)
-- SECURITY INVOKER → RLS คุม scope
create or replace function leads_page(
  p_limit          int,
  p_offset         int,
  p_status         text    default null,
  p_dealer_codes   text[]  default null,
  p_province       text    default null,
  p_product        text    default null,
  p_source         text    default null,   -- "ไม่ระบุ" = source ว่าง
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
      select jsonb_agg(to_jsonb(x) order by x.created_date desc nulls last, x.num_id desc)
      from (select * from f order by created_date desc nulls last, num_id desc limit p_limit offset p_offset) x
    ), '[]'::jsonb)
  );
$$;
