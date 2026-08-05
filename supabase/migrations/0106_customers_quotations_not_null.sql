-- Benjamin PMS — ปิดช่องที่ทำให้ข้อมูลลูกค้า/ใบเสนอราคามีช่องว่างเปล่าได้ (ตรวจสอบระบบ 5 ส.ค. 69)
--
-- ── ปัญหา 3 ชั้นที่เกี่ยวเนื่องกัน ──
--
-- 1) CHECK (x >= 0) ไม่กัน NULL
--    0069/0089 เพิ่ม check ให้ total_value/material_cost ตั้งใจ "กันค่าติดลบ" แต่ Postgres ถือว่า
--    NULL >= 0 เป็น "ไม่รู้" ไม่ใช่ "เท็จ" — constraint จึงผ่านเสมอเมื่อค่าเป็น NULL
--    ผลคือคอลัมน์ตัวเลขยังเป็น NULL ได้ ทั้งที่ TypeScript ประกาศว่าเป็น number เสมอ
--    (sum() ข้าม NULL เงียบ ๆ → ยอดรวมต่ำกว่าจริง · ฝั่งหน้าจอเรียก .toLocaleString() บน null = พัง)
--
-- 2) ต้นเหตุที่ทำให้เกิด NULL จริง: upsert_customer_for_company (0074)
--    ใช้ jsonb_populate_record(null::customers, payload) ซึ่งเริ่มจาก "แถวว่างทั้งแถว"
--    คอลัมน์ไหนไม่มีใน payload จะได้ NULL — ไม่ใช่ค่า DEFAULT ของคอลัมน์ (default ถูกข้ามทั้งหมด)
--    ยืนยันด้วยข้อมูลจริง: พบลูกค้า 1 แถวที่ projects/join_date/owner/initials/color/email/phone
--    เป็น NULL ทั้งชุด ทั้งที่คอลัมน์เหล่านั้นมี default ตั้งไว้แล้ว
--
-- 3) ฟิลด์หลักของลูกค้าไม่มี NOT NULL เลย
--    ทีมเคยแก้ปัญหาเดียวกันให้ leads.company ไปแล้ว (0072 หลัง QA เจอว่ารับค่าว่างได้)
--    แต่ customers ไม่เคยถูกไล่ตาม ทั้งที่ company/name เป็นคีย์ที่ใช้จับคู่ลูกค้าซ้ำและใช้แสดงผล

-- ── ขั้นที่ 1: แก้ต้นเหตุ — ให้ค่าตั้งต้นทำงานเมื่อ payload ไม่ได้ส่งฟิลด์นั้นมา ──
-- วิธี: เอา "ค่าตั้งต้น" ตั้งไว้ก่อน แล้วให้ payload ทับ (|| ใน jsonb = ฝั่งขวาชนะ)
-- ทำให้พฤติกรรมเหมือน INSERT ปกติที่ไม่ระบุคอลัมน์ = ได้ค่า DEFAULT ไม่ใช่ NULL
create or replace function public.upsert_customer_for_company(p_dealer text, p_payload jsonb)
returns customers
language plpgsql
security definer
set search_path = public
as $$
declare
  existing     customers;
  result       customers;
  n            bigint;
  norm_company text;
  defaults     jsonb;
begin
  if not (can_write_sales() and p_dealer = auth_dealer()) then
    raise exception 'forbidden: no permission to create customer for %', p_dealer;
  end if;
  if p_dealer is null or p_dealer = '' then
    raise exception 'forbidden: empty dealer';
  end if;

  norm_company := lower(regexp_replace(btrim(p_payload->>'company'), '\s+', ' ', 'g'));
  if norm_company = '' then
    raise exception 'invalid: empty company name';
  end if;

  -- serialize เฉพาะการเรียกที่ชนกันจริง (สาขาเดียวกัน + ชื่อบริษัทเดียวกัน) — ปลดล็อกอัตโนมัติ
  -- ตอนจบทรานแซกชัน (xact lock) ไม่ต้องปลดเอง
  perform pg_advisory_xact_lock(hashtextextended(p_dealer || '|' || norm_company, 0));

  select * into existing from customers
    where dealer_code = p_dealer
      and lower(regexp_replace(btrim(company), '\s+', ' ', 'g')) = norm_company
    limit 1;
  if found then
    return existing; -- มีอยู่แล้ว → คืนของเดิม ไม่สร้างซ้ำ (ผู้เรียกไปผูก/relink ใบเสนอราคาต่อเอง)
  end if;

  n := next_entity_id(p_dealer, 'customers');

  -- ค่าตั้งต้นของทุกคอลัมน์ที่ TypeScript ประกาศว่า "ต้องมีค่าเสมอ"
  -- ต้องอยู่ก่อน p_payload เพื่อให้ค่าที่ผู้เรียกส่งมาทับได้
  defaults := jsonb_build_object(
    'name', '', 'email', '', 'phone', '', 'province', '', 'category', '',
    'owner', '', 'initials', '', 'color', '',
    'join_date', to_char(now() at time zone 'Asia/Bangkok', 'YYYY-MM-DD'),
    'status', 'active', 'projects', 0, 'total_value', 0, 'imported', false,
    'contacts', '[]'::jsonb
  );

  insert into customers
    select * from jsonb_populate_record(
      null::customers,
      defaults || p_payload || jsonb_build_object('id', n, 'dealer_code', p_dealer, 'created_at', now()))
    returning * into result;

  return result;
end $$;

revoke execute on function public.upsert_customer_for_company(text, jsonb) from public, anon;
grant   execute on function public.upsert_customer_for_company(text, jsonb) to   authenticated;

-- ── ขั้นที่ 2: เติมค่าให้แถวที่ค้างอยู่ก่อน ไม่งั้นใส่ NOT NULL ไม่ผ่าน ──
-- ใช้ค่าตั้งต้นชุดเดียวกับข้างบน เพื่อให้ข้อมูลเก่ากับใหม่หน้าตาเหมือนกัน
update customers set
  name       = coalesce(name, ''),
  email      = coalesce(email, ''),
  phone      = coalesce(phone, ''),
  province   = coalesce(province, ''),
  category   = coalesce(category, ''),
  owner      = coalesce(owner, ''),
  initials   = coalesce(initials, ''),
  color      = coalesce(color, ''),
  join_date  = coalesce(join_date, to_char(created_at at time zone 'Asia/Bangkok', 'YYYY-MM-DD')),
  status     = coalesce(status, 'active'),
  projects   = coalesce(projects, 0),
  total_value = coalesce(total_value, 0),
  imported   = coalesce(imported, false),
  contacts   = coalesce(contacts, '[]'::jsonb)
where name is null or email is null or phone is null or province is null or category is null
   or owner is null or initials is null or color is null or join_date is null
   or status is null or projects is null or total_value is null or imported is null or contacts is null;

update quotations set
  total_value   = coalesce(total_value, 0),
  material_cost = coalesce(material_cost, 0)
where total_value is null or material_cost is null;

-- ── ขั้นที่ 3: บังคับที่ระดับฐานข้อมูล ──
-- ตัวเลข/สถานะ: กันไม่ให้เป็น NULL อีก (คู่กับ CHECK >= 0 ที่มีอยู่แล้ว ซึ่งกันได้แค่ค่าติดลบ)
alter table customers
  alter column total_value set not null,
  alter column projects    set not null,
  alter column status      set not null,
  alter column imported    set not null,
  alter column contacts    set not null;

alter table quotations
  alter column total_value   set not null,
  alter column material_cost set not null;

-- ฟิลด์แสดงผล/ระบุตัวตนของลูกค้า: TypeScript ประกาศว่าเป็น string เสมอ — ให้ DB ตรงกัน
-- ยอมให้เป็นค่าว่าง ("") ได้ เพราะแอปเขียนแบบนั้นอยู่แล้วเมื่อผู้ใช้ไม่กรอก
-- แต่ห้ามเป็น NULL ซึ่งเป็นคนละเรื่อง (NULL ทำให้การเปรียบเทียบ/ต่อสตริงพังทั้งชุด)
alter table customers
  alter column name      set not null,
  alter column email     set not null,
  alter column phone     set not null,
  alter column province  set not null,
  alter column category  set not null,
  alter column owner     set not null,
  alter column initials  set not null,
  alter column color     set not null,
  alter column join_date set not null;

-- company = คีย์ที่ใช้จับคู่ลูกค้าซ้ำและใช้แสดงผล — ต้องมีค่าจริง ไม่ใช่แค่ไม่ NULL
-- (แนวเดียวกับ leads.company ที่ทีมแก้ไว้แล้วใน 0072 หลัง QA เจอว่ารับค่าว่างได้)
alter table customers alter column company set not null;
alter table customers drop constraint if exists customers_company_not_blank;
alter table customers add  constraint customers_company_not_blank check (btrim(company) <> '');
