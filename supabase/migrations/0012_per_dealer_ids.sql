-- Benjamin PMS — id ลูกค้า/นัดหมายเป็น "เลขนับต่อสาขา" (Phase 7)
-- โมเดลของแอป (ดู customerCode ใน mock.ts): id เป็นเลขนับของแต่ละสาขา ไม่ใช่ของทั้งเครือ
-- รหัสลูกค้าจึงมีรหัสสาขานำหน้า ({DEALER}-00001) เพราะเลขซ้ำข้ามสาขาได้โดยตั้งใจ
-- แต่ 0001 ตั้ง id เป็น PRIMARY KEY เดี่ยว = บังคับ unique ทั้งเครือ → สาขาที่สองสร้างลูกค้าคนแรก (id=1) จะชนทันที
-- แก้ให้ DB ตรงกับโมเดลแอป: PK = (dealer_code, id)
--
-- ปลอดภัย: ไม่มี FK ชี้มาที่ customers.id / appointments.id (customer_id ในตารางอื่นเป็น integer เปล่า)

alter table customers    drop constraint customers_pkey;
alter table customers    add primary key (dealer_code, id);

alter table appointments drop constraint appointments_pkey;
alter table appointments add primary key (dealer_code, id);

-- trigger on_quote_won upsert ด้วย (id) เดิม → ต้องเปลี่ยนเป็นคีย์ผสมให้ตรง PK ใหม่
create or replace function public.on_quote_won()
returns trigger language plpgsql as $$
begin
  if new.status = 'won' and (old.status is distinct from 'won') then
    insert into customers(id, dealer_code, company, province, total_value, status)
    values (coalesce(new.customer_id, new.deal_id),
            new.dealer_code, new.customer, new.province, new.total_value, 'active')
    on conflict (dealer_code, id) do update
      set total_value = customers.total_value + excluded.total_value;
  end if;
  return new;
end $$;
