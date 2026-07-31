-- Benjamin PMS — Database Hardening รอบ 1 (Enterprise Production Readiness Mission, Phase 3, 31 ก.ค. 69)
--
-- สรุปจากการไล่อ่าน migration 0001-0088 ทั้งหมดเพื่อดูสถานะ schema จริงปัจจุบัน (ไม่ใช่แค่ 0001)
-- แก้เฉพาะจุดที่ยืนยันแล้วว่าปลอดภัย (ไม่กระทบข้อมูลที่มีอยู่จริงในทุกกรณีที่ตรวจสอบได้)
-- ส่วนที่เสี่ยงกว่านี้ (เช่น profiles.dealer_code FK ตรงๆ ซึ่งจะพังบัญชี HQ ที่ dealer_code='') ใช้ trigger
-- ตรวจแทนการใส่ FK ตรงๆ เพื่อไม่กระทบ sentinel '' ที่ทั้งระบบพึ่งพาอยู่

-- ══════════════════════════════════════════════════════════════════════════
-- 1) quotations.deal_id → leads(dealer_code, num_id) — ค้างมาตั้งแต่ 0036 (คอมเมนต์บอกไว้ว่า
--    "ผูก FK ได้แล้ว แต่รอบนี้โฟกัสที่นัดหมาย") ไม่เคยมีใบไหนตามมาปิดจริง — เพิ่มให้ครบตามที่ appointments.lead_id มี
-- ══════════════════════════════════════════════════════════════════════════
alter table quotations drop constraint if exists quotations_deal_fk;
alter table quotations
  add constraint quotations_deal_fk
  foreign key (dealer_code, deal_id) references leads (dealer_code, num_id)
  on update cascade on delete set null (deal_id);

-- ══════════════════════════════════════════════════════════════════════════
-- 2) customer_notes.customer_id → customers(dealer_code, id) — มี index รองรับ join นี้อยู่แล้ว
--    (idx_customer_notes_customer) แต่ไม่เคยมี FK จริง ลบลูกค้าแล้วโน้ตลอยไม่มีเจ้าของแบบเงียบๆ
--    ใช้ CASCADE (ต่างจาก quotations/leads ที่ restrict) เพราะโน้ตเป็นข้อมูลรองที่ผูกกับลูกค้า
--    ไม่ใช่บันทึกธุรกิจหลักที่ต้องกันลบ — ลบลูกค้าแล้วโน้ตของลูกค้านั้นควรหายไปด้วย
-- ══════════════════════════════════════════════════════════════════════════
alter table customer_notes drop constraint if exists customer_notes_customer_fk;
alter table customer_notes
  add constraint customer_notes_customer_fk
  foreign key (dealer_code, customer_id) references customers (dealer_code, id)
  on update cascade on delete cascade;

-- ══════════════════════════════════════════════════════════════════════════
-- 3) customer_notes.dealer_code / dealer_settings.dealer_code ขาด "on update cascade"
--    (ตารางอื่นทุกตัวที่มี FK ไป dealers(code) ผ่านลูปใน 0018 ได้ทั้ง cascade+restrict คู่กัน
--    แต่สองตารางนี้สร้างทีหลัง นอกลูป เลยตกหล่นแค่ on update — เปลี่ยน dealer code ทีหลังจะพังสองจุดนี้)
-- ══════════════════════════════════════════════════════════════════════════
alter table customer_notes drop constraint if exists customer_notes_dealer_code_fkey;
alter table customer_notes
  add constraint customer_notes_dealer_code_fkey
  foreign key (dealer_code) references dealers (code)
  on update cascade on delete restrict;

alter table dealer_settings drop constraint if exists dealer_settings_dealer_code_fkey;
alter table dealer_settings
  add constraint dealer_settings_dealer_code_fkey
  foreign key (dealer_code) references dealers (code)
  on update cascade on delete cascade;

-- ══════════════════════════════════════════════════════════════════════════
-- 4) quote_counters / entity_counters ไม่มี FK ไป dealers(code) — รหัสสาขาพิมพ์ผิดสร้างแถวตัวนับขยะ
--    ค้างถาวรได้ ใช้ CASCADE (ลบสาขาแล้วตัวนับของสาขานั้นไม่มีประโยชน์อีกต่อไป)
-- ══════════════════════════════════════════════════════════════════════════
alter table quote_counters drop constraint if exists quote_counters_dealer_code_fkey;
alter table quote_counters
  add constraint quote_counters_dealer_code_fkey
  foreign key (dealer_code) references dealers (code)
  on update cascade on delete cascade;

alter table entity_counters drop constraint if exists entity_counters_dealer_code_fkey;
alter table entity_counters
  add constraint entity_counters_dealer_code_fkey
  foreign key (dealer_code) references dealers (code)
  on update cascade on delete cascade;

-- ══════════════════════════════════════════════════════════════════════════
-- 5) customers.status เป็น text อิสระ ไม่มี CHECK เลย ต่างจาก leads.status/quotations.status ที่เป็น
--    enum จริง — TS type (CustomerStatus) ปิดแค่ "active"|"inactive" แต่ DB รับสตริงอะไรก็ได้ตอนนี้
-- ══════════════════════════════════════════════════════════════════════════
alter table customers drop constraint if exists customers_status_check;
alter table customers
  add constraint customers_status_check check (status in ('active', 'inactive'));

-- ══════════════════════════════════════════════════════════════════════════
-- 6) quotations.material_cost ไม่มี CHECK กันติดลบ ทั้งที่เป็นค่าเงินคู่กับ total_value ที่มีแล้ว (0069)
-- ══════════════════════════════════════════════════════════════════════════
alter table quotations drop constraint if exists quotations_material_cost_nonneg;
alter table quotations
  add constraint quotations_material_cost_nonneg check (material_cost >= 0);

-- ══════════════════════════════════════════════════════════════════════════
-- 7) master_catalog.subtypes / price_history ไม่มีการตรวจรูปร่างเลย (jsonb อิสระ) — บังคับอย่างน้อย
--    ต้องเป็น array (ไม่ใช่ object/string/number ที่ผิดรูปร่างจนโค้ดฝั่งเว็บ .map() แล้วพัง)
-- ══════════════════════════════════════════════════════════════════════════
alter table master_catalog drop constraint if exists master_catalog_subtypes_is_array;
alter table master_catalog
  add constraint master_catalog_subtypes_is_array check (jsonb_typeof(subtypes) = 'array');

alter table master_catalog drop constraint if exists master_catalog_price_history_is_array;
alter table master_catalog
  add constraint master_catalog_price_history_is_array check (jsonb_typeof(price_history) = 'array');

-- ══════════════════════════════════════════════════════════════════════════
-- 8) audit_log ไม่มี index บนคอลัมน์ at — งานลบข้อมูลเก่ารายวัน (0062, retention 2 ปี) จะ full-scan
--    ทั้งตารางทุกคืนเมื่อข้อมูลโตขึ้น
-- ══════════════════════════════════════════════════════════════════════════
create index if not exists idx_audit_log_at on audit_log (at);

-- ══════════════════════════════════════════════════════════════════════════
-- 9) profiles.dealer_code ไม่มี FK ไป dealers(code) ตรงๆ ไม่ได้ (dealer_code='' สำหรับบัญชี HQ
--    ซึ่งไม่มีแถวใน dealers ที่ code='' จริง — ใส่ FK ตรงจะพังทุกบัญชี HQ ทันที)
--    ใช้ trigger ตรวจแทน: อนุญาต '' (บัญชี HQ) แต่ถ้าไม่ว่างต้องมีอยู่จริงใน dealers เท่านั้น
--    ปิดช่องที่ custom_access_token_hook() (0032) coalesce ปัญหานี้เป็น 'active' แบบเงียบๆ เวลา
--    dealer_code ชี้ไปสาขาที่ไม่มีจริง (พิมพ์ผิด/สาขาถูกลบ) — ตอนนี้จะ error ตั้งแต่ตอนเขียนแทน
-- ══════════════════════════════════════════════════════════════════════════
create or replace function guard_profile_dealer_exists() returns trigger
  language plpgsql as $$
begin
  if new.dealer_code is not null and new.dealer_code <> '' then
    if not exists (select 1 from dealers where code = new.dealer_code) then
      raise exception 'profiles.dealer_code "%" ไม่มีสาขานี้อยู่จริงในตาราง dealers', new.dealer_code;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_profile_dealer_exists on profiles;
create trigger trg_guard_profile_dealer_exists
  before insert or update of dealer_code on profiles
  for each row execute function guard_profile_dealer_exists();

-- ══════════════════════════════════════════════════════════════════════════
-- 10) quotations.items ไม่ถูกบังคับให้ตรงกับ jsonb_array_length(line_items) เสมอ — RPC create_quotation
--     (0073) เช็คแค่ตอนสร้างว่ามีอย่างน้อย 1 รายการ แต่ UPDATE ทีหลังทำให้ items เพี้ยนจาก line_items
--     จริงได้ (ไม่มีอะไรกันไว้) — ใช้ trigger sync ให้ตรงกันเสมอ แทนที่จะเป็น CHECK ตรงๆ (CHECK อาจ
--     ชนกับแถวเก่าที่มีอยู่แล้วถ้าเพี้ยนอยู่ก่อน — trigger self-correct ปลอดภัยกว่า ไม่ทำให้แถวเดิม error)
-- ══════════════════════════════════════════════════════════════════════════
create or replace function sync_quotation_items_count() returns trigger
  language plpgsql as $$
begin
  new.items := coalesce(jsonb_array_length(new.line_items), 0);
  return new;
end $$;

drop trigger if exists trg_sync_quotation_items_count on quotations;
create trigger trg_sync_quotation_items_count
  before insert or update of line_items on quotations
  for each row execute function sync_quotation_items_count();

-- ══════════════════════════════════════════════════════════════════════════
-- 11) ตาราง sales (leads/quotations/customers/appointments/files/responsible_persons) policy
--     select/write ไม่เคยระบุ "to authenticated" (ค่าเริ่มต้น = PUBLIC รวม anon) — ตารางเครือข่าย
--     (dealers/master_catalog/hq_*) ปิดช่องนี้ไปแล้วใน 0031 แต่ตารางงานขายตกหล่น ไม่เคยตามไปปิด
--     ปัจจุบันไม่ถูกเจาะได้จริงเพราะ auth_dealer()/is_hq() คืนค่าว่าง/false สำหรับ anon อยู่แล้ว
--     (เหตุผลเดียวกับที่ 0031 เองก็ใช้อธิบายว่าทำไมไม่ต้องแตะ dealer_files_read) แต่ควรระบุให้ชัดเจน
--     สอดคล้องกับตารางอื่นทั้งระบบ ไม่ใช่พึ่งพฤติกรรม "บังเอิญปลอดภัย" ของฟังก์ชัน
-- ══════════════════════════════════════════════════════════════════════════
do $$
declare t text;
begin
  foreach t in array array['leads','quotations','customers','appointments','files','responsible_persons'] loop
    execute format('drop policy if exists %1$s_select on %1$I', t);
    execute format($f$
      create policy %1$s_select on %1$I for select
        to authenticated
        using ( is_hq() or dealer_code = auth_dealer() )
    $f$, t);
    execute format('drop policy if exists %1$s_write on %1$I', t);
    execute format($f$
      create policy %1$s_write on %1$I for all
        to authenticated
        using ( can_write_sales() and dealer_code = auth_dealer() )
        with check ( can_write_sales() and dealer_code = auth_dealer() )
    $f$, t);
  end loop;
end $$;
