-- HQ /hq/customers — server-side filter + pagination + KPI/analytics aggregate ที่ DB (M9 Phase 6)
--   เดิม useCustomerDb() ดึงลูกค้าทั้งเครือทั้งก้อนมาไว้ในเครื่อง แล้วทำ filter/KPI/กราฟ/ตารางทั้งหมดฝั่ง
--   client — ที่สเกลจริง (หลักพันลูกค้าขึ้นไป) ดึงทั้งก้อนทุกครั้งที่เปิดหน้า/เปลี่ยนตัวกรองไม่ไหว
--   ย้าย filter + KPI + 5 กราฟ (คำนวณจาก "ทั้งชุดที่กรองแล้ว" ไม่ใช่แค่หน้าที่กำลังโชว์) + ตาราง (เฉพาะหน้า
--   ปัจจุบัน) ไปทำที่ DB ในคำขอเดียว — สอดคล้องกับแพตเทิร์น hq_quotations_summary/hq_alerts (คืน jsonb ก้อนเดียว)
--
-- แม่แบบย่อย → แม่แบบหลัก (subtype_map ด้านล่าง) คัดลอกมาจาก _SUBTYPE_TO_PARENT ใน packages/shared/lib/mock.ts
--   (สร้างจาก solutionProducts[].subtypes) — เป็นข้อมูล static ของแอป ไม่ได้มาจากตาราง master_catalog
--   (คนละเรื่องกัน) ถ้าแก้ solutionProducts ต้องแก้ตารางนี้คู่กันด้วยมือ ไม่มีทางเชื่อมอัตโนมัติ
--
-- วันส่งมอบ = วันปิดการขาย (won) + 90 วัน (DEFAULT_DELIVERY_DAYS ใน mock.ts) เสมอ — ใบเสนอราคาไม่มีคอลัมน์
--   ระยะส่งมอบต่อใบในตาราง DB จริง (ต่างจาก schema สมมติที่ customerDb.ts เผื่อไว้) จึงไม่มี override ต้องคิด
create or replace function public.hq_customers_page(
  p_search        text default null,
  p_dealer_code   text default null,
  p_provinces     text[] default null,
  p_building_type text default null,
  p_delivery_year int default null,
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
  won_quotes as (
    select
      q.customer_id,
      coalesce(sm.parent, nullif(q.building_type, '')) as building_type,
      case when sm.parent is not null then q.building_type else null end as template,
      (case when q.date ~ '^\d{4}-\d{2}-\d{2}' then substring(q.date, 1, 10)::date else null end) as won_date
    from quotations q
    left join subtype_map sm on sm.subtype = q.building_type
    where q.status = 'won' and q.customer_id is not null
  ),
  won_quotes_d as (
    select *, (won_date + 90) as delivered_at from won_quotes where won_date is not null
  ),
  cust_agg as (
    select
      customer_id,
      coalesce(array_agg(distinct building_type) filter (where building_type is not null), '{}') as building_types,
      coalesce(array_agg(distinct template) filter (where template is not null), '{}') as templates,
      max(delivered_at) as delivered_at,
      max(won_date) as last_purchase_at,
      count(*) as building_count,
      coalesce(array_agg(distinct (extract(year from delivered_at)::int + 543)) filter (where delivered_at is not null), '{}') as delivery_years
    from won_quotes_d
    group by customer_id
  ),
  base as (
    select
      c.id, c.company as name, c.dealer_code, coalesce(d.name, c.dealer_code) as dealer_name,
      c.province, c.total_value,
      coalesce(ca.building_types, '{}') as building_types,
      coalesce(ca.templates, '{}') as templates,
      ca.delivered_at, ca.last_purchase_at,
      coalesce(ca.building_count, 0) > 1 as is_repeat,
      coalesce(ca.delivery_years, '{}') as delivery_years
    from customers c
    left join dealers d on d.code = c.dealer_code
    left join cust_agg ca on ca.customer_id = c.id
  ),
  filtered as (
    select * from base b
    where
      (s is null or b.name ilike '%'||s||'%' or b.province ilike '%'||s||'%')
      and (p_dealer_code is null or b.dealer_code = p_dealer_code)
      and (p_provinces is null or b.province = any(p_provinces))
      and (p_building_type is null or p_building_type = any(b.building_types))
      and (p_delivery_year is null or p_delivery_year = any(b.delivery_years))
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'kpi', (select jsonb_build_object(
      'total', count(*),
      'active', count(*) filter (where coalesce(array_length(building_types, 1), 0) > 0),
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
             delivered_at, last_purchase_at
      from filtered
      order by total_value desc, id asc
      limit p_limit offset p_offset
    ) p)
  ) into result;

  return result;
end $$;

revoke execute on function public.hq_customers_page(text, text, text[], text, int, int, int) from public;
grant  execute on function public.hq_customers_page(text, text, text[], text, int, int, int) to   authenticated;

-- ตัวเลือกตัวกรอง (ตัวแทน/จังหวัด/ประเภทอาคาร/ปีที่ส่งมอบ) — ไม่อิงตัวกรองปัจจุบันเลย (เหมือนพฤติกรรมเดิม
--   ที่คำนวณจาก source ทั้งก้อนก่อนกรอง) เรียกครั้งเดียวตอนเปิดหน้า/ข้อมูลเปลี่ยน ไม่ต้องเรียกซ้ำทุกครั้งที่กรอง
create or replace function public.hq_customers_filter_options()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare result jsonb;
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
  won_quotes as (
    select
      q.customer_id, coalesce(sm.parent, nullif(q.building_type, '')) as building_type,
      (case when q.date ~ '^\d{4}-\d{2}-\d{2}' then substring(q.date, 1, 10)::date else null end) as won_date
    from quotations q
    left join subtype_map sm on sm.subtype = q.building_type
    where q.status = 'won' and q.customer_id is not null
  )
  select jsonb_build_object(
    'dealers', (select coalesce(jsonb_agg(jsonb_build_object('code', code, 'name', name) order by code), '[]'::jsonb)
      from (select distinct c.dealer_code as code, coalesce(d.name, c.dealer_code) as name
            from customers c left join dealers d on d.code = c.dealer_code) x),
    'provinces', (select coalesce(jsonb_agg(distinct province order by province), '[]'::jsonb)
      from customers where province is not null and province <> ''),
    'types', (select coalesce(jsonb_agg(distinct building_type order by building_type), '[]'::jsonb)
      from won_quotes where building_type is not null),
    'years', (select coalesce(jsonb_agg(distinct yr order by yr desc), '[]'::jsonb)
      from (select (extract(year from (won_date + 90))::int + 543) as yr from won_quotes where won_date is not null) x)
  ) into result;

  return result;
end $$;

revoke execute on function public.hq_customers_filter_options() from public;
grant  execute on function public.hq_customers_filter_options() to   authenticated;
