-- Benjamin PMS — M9 Phase 2 (prerequisite): normalize วันที่ลีดให้เป็นคอลัมน์วันจริง
--
-- ปัญหา: ลีดเก็บวันเป็น "สตริงไทย" 2 ที่ → กรอง/รวมยอดที่ DB ไม่ได้ตรงกับ client
--   • created_label ("12 มิ.ย. 2569") = วันที่แอปใช้ (created_at timestamptz = วัน insert คนละวัน)
--   • activities (jsonb) แต่ละรายการมี date เป็นสตริงไทย → ใช้หา "วันติดต่อล่าสุด" (needsFollowUp)
-- แก้: เพิ่มคอลัมน์ "วันจริง" ที่ trigger ดูแล → SQL กรอง/บั๊กเก็ต/คิด follow-up ได้ตรง client
--   created_date    = วันที่สร้าง (จาก created_label)
--   last_contact_at = วันติดต่อล่าสุด = max(วันของ activities) ?? created_date  (ตรงกับ leadLatestDate ?? createdAt)

-- parse_thai_date: มิเรอร์ parseThaiDate ฝั่ง JS เป๊ะ ("D เดือนไทย พ.ศ." → date · พ.ศ.>2500 ลบ 543)
create or replace function parse_thai_date(s text) returns date
language plpgsql immutable as $$
declare
  m text[]; yr int; mon int;
  months text[] := array['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
begin
  if s is null then return null; end if;
  m := regexp_match(btrim(s), '^(\d{1,2})\s+(\S+)\s+(\d{4})');
  if m is null then return null; end if;
  mon := array_position(months, m[2]);
  if mon is null then return null; end if;
  yr := m[3]::int;
  if yr > 2500 then yr := yr - 543; end if;
  return make_date(yr, mon, m[1]::int);
exception when others then return null; -- วันไม่ถูกต้อง (เช่น 31 มิ.ย.) → null
end $$;

alter table leads add column if not exists created_date    date;
alter table leads add column if not exists last_contact_at date;

-- วันติดต่อล่าสุดจาก activities (jsonb) — max ของวันที่ parse ได้
create or replace function lead_last_activity_date(p_activities jsonb) returns date
language sql immutable as $$
  select max(parse_thai_date(a->>'date'))
  from jsonb_array_elements(coalesce(p_activities, '[]'::jsonb)) a;
$$;

create or replace function set_lead_dates() returns trigger
language plpgsql as $$
begin
  new.created_date := parse_thai_date(new.created_label);
  new.last_contact_at := coalesce(lead_last_activity_date(new.activities), new.created_date);
  return new;
end $$;

drop trigger if exists trg_lead_dates on leads;
create trigger trg_lead_dates
  before insert or update on leads
  for each row execute function set_lead_dates();

-- backfill แถวเดิม
update leads set
  created_date = parse_thai_date(created_label),
  last_contact_at = coalesce(lead_last_activity_date(activities), parse_thai_date(created_label));

create index if not exists idx_leads_created_date on leads (created_date);
