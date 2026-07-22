-- Benjamin PMS — ออกเลข id ต่อสาขาแบบ atomic (C5)
--
-- ปัญหา: แอปคำนวณ id ลูกค้า/นัดหมายเองด้วย max(id)+1 จากข้อมูลที่โหลดมาในเครื่อง
--        ถ้าพนักงาน 2 คนในสาขาเดียวกันกดสร้างพร้อมกัน จะได้เลขเดียวกัน → ชน PK (dealer_code,id)
--        คนที่สองบันทึกไม่สำเร็จ
--
-- แก้: ให้ DB เป็นคนออกเลข (แบบเดียวกับ next_quote_no ที่ใช้กับใบเสนอราคาอยู่แล้ว)
--      ครั้งแรกของแต่ละสาขา/ชนิด จะตั้งต้นจาก max(id) ที่มีอยู่จริง +1 เพื่อไม่ชนข้อมูลเดิม

create table if not exists entity_counters (
  dealer_code text   not null,
  entity      text   not null,           -- 'customers' | 'appointments'
  next_id     bigint not null default 1,
  primary key (dealer_code, entity)
);

alter table entity_counters enable row level security;
-- เข้าถึงผ่านฟังก์ชันเท่านั้น (SECURITY DEFINER) — ไม่เปิด policy ให้ client แตะตรง ๆ

create or replace function public.next_entity_id(p_dealer text, p_entity text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  n   bigint;
  cur bigint;
begin
  if p_entity not in ('customers', 'appointments') then
    raise exception 'unsupported entity: %', p_entity;
  end if;
  -- ออกเลขได้เฉพาะสาขาตัวเอง (HQ ที่ดูแลข้อมูลกลางก็อนุญาต เผื่อสคริปต์ดูแลระบบ)
  if p_dealer is distinct from auth_dealer() and not can_write_master() then
    raise exception 'forbidden: dealer mismatch';
  end if;

  -- ตั้งต้นครั้งแรกจากข้อมูลที่มีอยู่จริงของสาขานั้น
  if not exists (select 1 from entity_counters where dealer_code = p_dealer and entity = p_entity) then
    if p_entity = 'customers' then
      select coalesce(max(id), 0) into cur from customers where dealer_code = p_dealer;
    else
      select coalesce(max(id), 0) into cur from appointments where dealer_code = p_dealer;
    end if;
    insert into entity_counters(dealer_code, entity, next_id)
      values (p_dealer, p_entity, cur + 1)
      on conflict (dealer_code, entity) do nothing;
  end if;

  update entity_counters
     set next_id = next_id + 1
   where dealer_code = p_dealer and entity = p_entity
   returning next_id - 1 into n;
  return n;
end $$;

revoke execute on function public.next_entity_id(text, text) from anon;
grant   execute on function public.next_entity_id(text, text) to authenticated;
