-- Benjamin PMS — Phase 7: Performance Audit (Enterprise Production Readiness Mission, 31 ก.ค. 69)
--
-- รัน `supabase db advisors --type performance` จริงกับ production พบ 2 เรื่องคุ้มแก้ตอนนี้:
--
-- 1) auth_rls_initplan — RLS policy ทุกตัวในระบบเรียก is_hq()/auth_dealer()/can_write_sales()/
--    can_write_master()/auth_role()/auth.uid() "ตรงๆ" ใน USING/WITH CHECK — Postgres query planner
--    ต้อง re-evaluate ฟังก์ชันพวกนี้ "ทุกแถว" แทนที่จะประเมินครั้งเดียวต่อคำสั่ง ที่สเกลข้อมูลมาก
--    (leads/quotations/customers หลักหมื่น-แสนแถว) นี่คือคอขวดจริงเพราะ RLS ครอบทุก SELECT/UPDATE/
--    DELETE ในระบบ — ห่อด้วย (select ...) ให้ planner รู้ว่าเป็นค่าคงที่ต่อคำสั่ง (InitPlan) ไม่ต้อง
--    ประเมินซ้ำ — ความหมายเดิมทุกประการ (ฟังก์ชันเหล่านี้เป็น stable ไม่ขึ้นกับแถวที่กำลังตรวจอยู่แล้ว)
--    ใช้ ALTER POLICY แทน DROP+CREATE — คง owner/สิทธิ์เดิมทั้งหมด เปลี่ยนแค่ expression
--
-- 2) unindexed_foreign_keys — quotations.quotations_deal_fk (dealer_code, deal_id) → leads
--    (dealer_code, num_id) ไม่มี index คลุม — ทุกครั้งที่แก้ไข/ลบลีด ต้องกวาดทั้งตาราง quotations
--    เพื่อเช็ก FK (referential integrity check) ช้าลงเรื่อยๆ ตามขนาดตาราง
--
-- ⚠️ สิ่งที่ "ตั้งใจไม่แตะ" รอบนี้:
--   • multiple_permissive_policies (หลายตาราง มี _select/_read กับ _write/_all ทับ SELECT กัน) —
--     แก้ต้องรื้อโครงสร้าง policy (แยก FOR ALL ออกเป็น FOR INSERT/UPDATE/DELETE ไม่ครอบ SELECT)
--     เสี่ยงเปลี่ยนพฤติกรรมสิทธิ์จริงถ้าพลาด ควรทำแยกพร้อมทดสอบเต็มรูปแบบ ไม่ใช่รวบในรอบตรวจนี้
--   • unused_index (idx_leads_province/idx_audit_log_at/idx_quotations_date_normalized) — ยังไม่มี
--     query จริงมาใช้ ณ ตอนนี้ (ข้อมูลน้อย) ไม่ใช่แปลว่า "ไม่จำเป็น" — เก็บไว้ก่อน ไม่ลบ

-- ══════════════════════════════════════════════════════════════════════════
-- ① auth_rls_initplan — ห่อ auth.<fn>()/is_hq()/auth_dealer()/can_write_sales()/can_write_master()/
--    auth_role() ทุกจุดใน RLS policy ด้วย (select ...) ครบทุกตาราง (ความหมายเดิม เปลี่ยนแค่ประสิทธิภาพ)
-- ══════════════════════════════════════════════════════════════════════════
alter policy appointments_select on appointments
  using ( (select is_hq()) or (dealer_code = (select auth_dealer())) );
alter policy appointments_write on appointments
  using ( (select can_write_sales()) and (dealer_code = (select auth_dealer())) )
  with check ( (select can_write_sales()) and (dealer_code = (select auth_dealer())) );

alter policy audit_insert on audit_log
  with check ( (select is_hq()) and (role = (select auth_role())) );
alter policy audit_read on audit_log
  using ( (select is_hq()) );

alter policy customer_notes_select on customer_notes
  using ( (select is_hq()) or (dealer_code = (select auth_dealer())) );
alter policy customer_notes_write on customer_notes
  using ( (select can_write_sales()) and (dealer_code = (select auth_dealer())) )
  with check ( (select can_write_sales()) and (dealer_code = (select auth_dealer())) );

alter policy customers_select on customers
  using ( (select is_hq()) or (dealer_code = (select auth_dealer())) );
alter policy customers_write on customers
  using ( (select can_write_sales()) and (dealer_code = (select auth_dealer())) )
  with check ( (select can_write_sales()) and (dealer_code = (select auth_dealer())) );

alter policy dealer_lead_rules_read on dealer_lead_rules
  using ( (select is_hq()) or (dealer_code = (select auth_dealer())) );
alter policy dealer_lead_rules_write on dealer_lead_rules
  using ( (select is_hq()) or ((dealer_code = (select auth_dealer())) and (select can_write_sales())) )
  with check ( (select is_hq()) or ((dealer_code = (select auth_dealer())) and (select can_write_sales())) );

alter policy dealer_settings_select on dealer_settings
  using ( (select is_hq()) or (dealer_code = (select auth_dealer())) );
alter policy dealer_settings_write on dealer_settings
  using ( (select can_write_sales()) and (dealer_code = (select auth_dealer())) )
  with check ( (select can_write_sales()) and (dealer_code = (select auth_dealer())) );

alter policy dealers_write on dealers
  using ( (select can_write_master()) )
  with check ( (select can_write_master()) );

alter policy files_select on files
  using ( (select is_hq()) or (dealer_code = (select auth_dealer())) );
alter policy files_write on files
  using ( (select can_write_sales()) and (dealer_code = (select auth_dealer())) )
  with check ( (select can_write_sales()) and (dealer_code = (select auth_dealer())) );

alter policy hq_company_write on hq_company
  using ( (select can_write_master()) )
  with check ( (select can_write_master()) );
alter policy hq_notif_rules_write on hq_notif_rules
  using ( (select can_write_master()) )
  with check ( (select can_write_master()) );
alter policy hq_policy_write on hq_policy
  using ( (select can_write_master()) )
  with check ( (select can_write_master()) );
alter policy hq_sales_journey_write on hq_sales_journey
  using ( (select can_write_master()) )
  with check ( (select can_write_master()) );
alter policy hq_targets_write on hq_targets
  using ( (select can_write_master()) )
  with check ( (select can_write_master()) );
alter policy master_catalog_write on master_catalog
  using ( (select can_write_master()) )
  with check ( (select can_write_master()) );

alter policy leads_select on leads
  using ( (select is_hq()) or (dealer_code = (select auth_dealer())) );
alter policy leads_write on leads
  using ( (select can_write_sales()) and (dealer_code = (select auth_dealer())) )
  with check ( (select can_write_sales()) and (dealer_code = (select auth_dealer())) );

alter policy profiles_mgmt_update on profiles
  using ( (select can_write_master()) )
  with check ( (select can_write_master()) );
alter policy profiles_read on profiles
  using ( (id = (select auth.uid())) or (select is_hq()) );
alter policy profiles_self_update on profiles
  using ( id = (select auth.uid()) )
  with check ( id = (select auth.uid()) );
alter policy profiles_write on profiles
  using ( (select auth_role()) = 'SUPER_ADMIN' )
  with check ( (select auth_role()) = 'SUPER_ADMIN' );

alter policy quotations_select on quotations
  using ( (select is_hq()) or (dealer_code = (select auth_dealer())) );
alter policy quotations_write on quotations
  using ( (select can_write_sales()) and (dealer_code = (select auth_dealer())) )
  with check ( (select can_write_sales()) and (dealer_code = (select auth_dealer())) );

alter policy responsible_persons_select on responsible_persons
  using ( (select is_hq()) or (dealer_code = (select auth_dealer())) );
alter policy responsible_persons_write on responsible_persons
  using ( (select can_write_sales()) and (dealer_code = (select auth_dealer())) )
  with check ( (select can_write_sales()) and (dealer_code = (select auth_dealer())) );

-- ══════════════════════════════════════════════════════════════════════════
-- ② unindexed_foreign_keys — quotations_deal_fk (dealer_code, deal_id) → leads (dealer_code, num_id)
-- ══════════════════════════════════════════════════════════════════════════
create index if not exists idx_quotations_deal_fk on quotations (dealer_code, deal_id);
