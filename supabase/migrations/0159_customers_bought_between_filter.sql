-- ── หน้าฐานข้อมูลลูกค้าทั้งเครือ: เพิ่มตัวกรอง "ซื้อล่าสุด" (บอสสั่ง 24 ส.ค. 69) ──
--
-- เดิมหน้านี้ตั้งใจไม่มีตัวกรองช่วงเวลา เพราะเป็น "ฐานข้อมูล" ไม่ใช่รายงานรายงวด
-- ตอนนี้บอสสั่งให้เพิ่ม → เพิ่มเป็นตัวกรองของหน้านี้เอง ค่าเริ่มต้น "ทั้งหมด" (ไม่กรอง)
-- เพื่อไม่ให้เปิดหน้ามาแล้วลูกค้าเก่าหายไปเงียบ ๆ ซึ่งเป็นเหตุผลเดิมที่ไม่ใส่ไว้
--
-- กรองด้วย last_purchase_at = วันปิดการขายล่าสุดของลูกค้ารายนั้น (ค่าที่มีอยู่แล้ว ไม่ได้เพิ่มข้อมูลใหม่)
--
-- ⚠️ ลายเซ็นเปลี่ยน (p_delivery_year ที่ตายแล้ว → p_bought_from/p_bought_to)
--    ต้อง drop ตัวเดิมทิ้งก่อนเสมอ ไม่งั้นจะมีสองฟังก์ชันชื่อเดียวกัน แล้ว PostgREST เลือกไม่ถูก (PGRST203)

drop function if exists public.hq_customers_page(text, text, text[], text, int, int, int);

create or replace function public.hq_customers_page(
  p_search        text default null,
  p_dealer_code   text default null,
  p_provinces     text[] default null,
  p_building_type text default null,
  p_bought_from   date default null,
  p_bought_to     date default null,
  p_limit         int default 50,
  p_offset        int default 0
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  result jsonb;
  s text := nullif(btrim(coalesce(p_search, '')), '');
begin
  if not is_hq() then
    raise exception 'forbidden: HQ only';
  end if;

  with subtype_map(subtype, parent) as (
    values
      ('โกดังเก็บสินค้าทั่วไป','โกดังสำเร็จรูป'), ('โกดังเก็บสินค้าเกษตร','โกดังสำเร็จรูป'),
      ('โกดังห้องเย็น','โกดังสำเร็จรูป'), ('คลังกระจายสินค้า','โกดังสำเร็จรูป'), ('โกดังเก็บวัตถุดิบ','โกดังสำเร็จรูป'),
      ('โรงงานอาหาร','โรงงาน'), ('โรงงานผลิตเหล็ก','โรงงาน'), ('โรงงานพลาสติก','โรงงาน'),
      ('โรงงานสิ่งทอ','โรงงาน'), ('โรงงานอิเล็กทรอนิกส์','โรงงาน'), ('โรงงานยา','โรงงาน'), ('โรงงานทั่วไป','โรงงาน'),
      ('อาคารสำนักงาน','อาคารสำเร็จรูปทุกประเภท'), ('โชว์รูม','อาคารสำเร็จรูปทุกประเภท'),
      ('อาคารพาณิชย์','อาคารสำเร็จรูปทุกประเภท'), ('อาคารเรียน','อาคารสำเร็จรูปทุกประเภท'), ('สถานพยาบาล','อาคารสำเร็จรูปทุกประเภท'),
      ('ออกแบบเฉพาะโครงการ','งานตามแบบของลูกค้า'), ('อาคารผสมผสาน','งานตามแบบของลูกค้า'), ('งานโครงสร้างพิเศษ','งานตามแบบของลูกค้า'),
      ('ปรับปรุงโกดังเดิม','งานรีโนเวท'), ('ต่อเติมอาคาร','งานรีโนเวท'), ('เปลี่ยนหลังคา','งานรีโนเวท'), ('เสริมโครงสร้าง','งานรีโนเวท'),
      ('โรงยิมอเนกประสงค์','สนามกีฬาในร่ม'), ('สนามแบดมินตัน','สนามกีฬาในร่ม'),
      ('สนามบาสเกตบอล','สนามกีฬาในร่ม'), ('สระว่ายน้ำในร่ม','สนามกีฬาในร่ม')
  ),
  -- ใบเสนอราคาที่ปิดการขายได้ (won) แต่ละใบ → แม่แบบหลัก/แม่แบบย่อย/วันส่งมอบ
  -- ต้องพก dealer_code ติดมาด้วย (แก้ไข) — customer_id เป็นเลขต่อสาขา รวม/join ข้ามสาขาไม่ได้ถ้าไม่มี dealer_code คู่
  won_quotes as (
    select
      q.customer_id,
      q.dealer_code,
      coalesce(sm.parent, nullif(q.building_type, '')) as building_type,
      case when sm.parent is not null then q.building_type else null end as template,
      (case when q.date ~ '^\d{4}-\d{2}-\d{2}' then substring(q.date, 1, 10)::date else null end) as won_date
    from quotations q
    left join subtype_map sm on sm.subtype = q.building_type
    where q.status = 'won' and q.customer_id is not null
  ),
  won_quotes_d as (
    select * from won_quotes where won_date is not null
  ),
  -- แก้: group by (dealer_code, customer_id) แทน customer_id เฉย ๆ — กันลูกค้า id ชนกันข้ามสาขาถูกรวมยอดปนกัน
  cust_agg as (
    select
      dealer_code,
      customer_id,
      coalesce(array_agg(distinct building_type) filter (where building_type is not null), '{}') as building_types,
      coalesce(array_agg(distinct template) filter (where template is not null), '{}') as templates,
      max(won_date) as last_purchase_at,
      count(*) as building_count
    from won_quotes_d
    group by dealer_code, customer_id
  ),
  base as (
    select
      c.id, c.company as name, c.dealer_code, coalesce(d.name, c.dealer_code) as dealer_name,
      c.province, c.total_value,
      coalesce(ca.building_types, '{}') as building_types,
      coalesce(ca.templates, '{}') as templates,
      ca.last_purchase_at,
      coalesce(ca.building_count, 0) > 1 as is_repeat
    from customers c
    left join dealers d on d.code = c.dealer_code
    -- แก้: เทียบ dealer_code คู่กับ customer_id ตอน join กลับ — กันข้อมูลลูกค้าคนละสาขาที่ id ตรงกันมาปนกัน
    left join cust_agg ca on ca.customer_id = c.id and ca.dealer_code = c.dealer_code
  ),
  filtered as (
    select * from base b
    where
      (s is null or b.name ilike '%'||s||'%' or b.province ilike '%'||s||'%')
      and (p_dealer_code is null or b.dealer_code = p_dealer_code)
      and (p_provinces is null or b.province = any(p_provinces))
      and (p_building_type is null or p_building_type = any(b.building_types))
      -- ตัวกรอง "ซื้อล่าสุด" — ลูกค้าที่ยังไม่มีใบปิดการขาย (last_purchase_at ว่าง) จะไม่เข้าเกณฑ์
      -- เพราะไม่มีวันที่ให้เทียบ ไม่ใช่เพราะระบบตัดทิ้ง (หน้าจอเขียนบอกไว้แล้ว)
      and (p_bought_from is null or b.last_purchase_at >= p_bought_from)
      and (p_bought_to   is null or b.last_purchase_at <= p_bought_to)
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'kpi', (select jsonb_build_object(
      'total', count(*),
      -- "ยังซื้ออยู่" = มีการซื้อภายใน 12 เดือนล่าสุด (นับจากวันปิดการขายล่าสุดของลูกค้ารายนั้น)
      'active', count(*) filter (where last_purchase_at is not null and last_purchase_at >= (current_date - interval '12 months')),
      'revenue', coalesce(sum(total_value), 0),
      'repeat', count(*) filter (where is_repeat)
    ) from filtered),
    'charts', jsonb_build_object(
      'byType', (select coalesce(jsonb_agg(jsonb_build_object('label', t, 'value', cnt) order by cnt desc), '[]'::jsonb)
        from (select unnest(building_types) as t, count(*) as cnt from filtered group by 1) x),
      'bySubtype', (select coalesce(jsonb_agg(jsonb_build_object('label', t, 'value', cnt) order by cnt desc), '[]'::jsonb)
        from (select unnest(templates) as t, count(*) as cnt from filtered group by 1) x),
      'byProvince', (select coalesce(jsonb_agg(jsonb_build_object('label', province, 'value', cnt) order by cnt desc), '[]'::jsonb)
        from (select province, count(*) as cnt from filtered where province is not null and province <> '' group by 1 order by 2 desc limit 10) x),
      'byDealer', (select coalesce(jsonb_agg(jsonb_build_object('code', dealer_code, 'name', dealer_name, 'value', cnt) order by cnt desc), '[]'::jsonb)
        from (select dealer_code, dealer_name, count(*) as cnt from filtered group by 1, 2) x),
      'revenueByDealer', (select coalesce(jsonb_agg(jsonb_build_object('code', dealer_code, 'revenue', rev) order by rev desc), '[]'::jsonb)
        from (select dealer_code, sum(total_value) as rev from filtered group by 1) x)
    ),
    'rows', (select coalesce(jsonb_agg(row_to_json(p)), '[]'::jsonb) from (
      select id, name, dealer_code, dealer_name, province, total_value, building_types, templates,
             last_purchase_at
      from filtered
      order by total_value desc, id asc
      limit p_limit offset p_offset
    ) p)
  ) into result;

  return result;
end $$;
