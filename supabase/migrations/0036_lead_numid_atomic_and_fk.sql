-- Benjamin PMS — num_id ของลีดออกจากตัวนับ atomic + FK นัดหมาย→ลีด (M7 ฉบับบัคจริง)
--
-- ข้อค้นพบ: leads.id (text "#L-40322") กับ leads.num_id (integer) เป็น 1:1 กันจริง
--   id = '#L-' || (40321 + num_id) — id เป็นแค่ "รูปแบบข้อความของ num_id" ไม่ใช่ตัวตนอิสระ
--   จึงไม่ต้องรื้อ identifier ทั้งแอป · แก้เฉพาะ "บั๊กจริง" 2 อย่าง:
--
-- ปัญหา 1 (concurrency): แอปออก num_id ด้วย Math.max(...loadedLeads)+1 ฝั่ง client
--   พนักงาน 2 คนในสาขาเดียวสร้างลีดพร้อมกัน → num_id ชน → id (ที่ derive จาก num_id) ชน
--   → คนที่สอง insert ไม่ผ่าน (PK ซ้ำ) · แบบเดียวกับบั๊กลูกค้า/นัดก่อนมี next_entity_id (0016)
--   แก้: ให้ DB ออก num_id แบบ atomic ต่อสาขา (ขยาย next_entity_id รองรับ 'leads')
--
-- ปัญหา 2 (integrity): appointments.lead_id อ้าง num_id แต่ผูก FK ไม่ได้ (num_id ไม่ unique)
--   แก้: UNIQUE(dealer_code, num_id) แล้วผูก FK นัด→ลีด (0018 เว้นไว้เพราะเหตุนี้)

-- ══ 1. ขยาย next_entity_id รองรับ 'leads' (ตั้งต้นจาก max(num_id) เพราะ id เป็น text) ══
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
  if p_entity not in ('customers', 'appointments', 'leads') then
    raise exception 'unsupported entity: %', p_entity;
  end if;
  if p_dealer is distinct from auth_dealer() and not can_write_master() then
    raise exception 'forbidden: dealer mismatch';
  end if;

  if not exists (select 1 from entity_counters where dealer_code = p_dealer and entity = p_entity) then
    if p_entity = 'customers' then
      select coalesce(max(id), 0) into cur from customers where dealer_code = p_dealer;
    elsif p_entity = 'appointments' then
      select coalesce(max(id), 0) into cur from appointments where dealer_code = p_dealer;
    else -- leads: ใช้ num_id (id เป็น text)
      select coalesce(max(num_id), 0) into cur from leads where dealer_code = p_dealer;
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

-- ══ 2. UNIQUE(dealer_code, num_id) — ทำให้ num_id เป็นเป้า FK ได้ ══
--   เลขซ้ำข้ามสาขาได้โดยตั้งใจ (เหมือน id/customers) จึง unique แบบคู่กับ dealer_code
alter table leads drop constraint if exists leads_dealer_num_id_unique;
alter table leads add constraint leads_dealer_num_id_unique unique (dealer_code, num_id);

-- ══ 3. FK นัดหมาย → ลีด (0018 เว้นไว้เพราะข้อ 2 ยังไม่มี) ══
--   lead_id เป็น NULL ได้ (นัดที่ไม่ผูกลีด) → MATCH SIMPLE ไม่ตรวจ
--   on delete set null: ลบลีดแล้วนัดยังอยู่ (มี company/contact ของตัวเอง) แค่หลุดการผูก
alter table appointments drop constraint if exists appointments_lead_fk;
alter table appointments
  add constraint appointments_lead_fk
  foreign key (dealer_code, lead_id) references leads(dealer_code, num_id)
  on update cascade on delete set null;

-- หมายเหตุที่ "ยังไม่ทำ" (ตั้งใจ):
--   • files.record_id → polymorphic (ลีด num_id หรือ ลูกค้า id) ผูก FK ตรง ๆ ไม่ได้
--   • quotations.deal_id → อ้าง num_id เช่นกัน ผูก FK ได้แล้ว แต่รอบนี้โฟกัสที่นัดหมายตามที่ตกลง
