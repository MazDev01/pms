-- Benjamin PMS — Phase 7 (ต่อ): แก้ multiple_permissive_policies จริง (Enterprise Production
-- Readiness Mission, 31 ก.ค. 69) — ตามคำสั่งบอส "แก้ด้วยก่อนไปทำ Phase ถัดไป"
--
-- ปัญหา: ทุกตารางมี 2 นโยบายที่ "ครอบ SELECT" พร้อมกัน — {table}_select/{table}_read (FOR SELECT)
-- กับ {table}_write (FOR ALL — ครอบ SELECT/INSERT/UPDATE/DELETE ทั้งหมด) เมื่อมีนโยบาย permissive
-- 2 ตัวครอบ SELECT พร้อมกัน Postgres ต้องประเมิน "ทั้งคู่" แล้ว OR กันทุกครั้งที่ query — ซ้ำซ้อน
-- โดยไม่จำเป็น เพราะพิสูจน์ได้ว่า write ⟹ select เสมอทุกตาราง (ดูด้านล่าง) นั่นคือ _write ไม่เคย
-- เห็นแถวไหนที่ _select มองไม่เห็นอยู่แล้ว — เอา SELECT ออกจาก _write ไม่ทำให้ใครเห็นข้อมูลน้อยลง
--
-- พิสูจน์ (per ตาราง จาก 0098 ที่ optimize expression ไว้แล้ว):
--   • {t}_select: is_hq() OR dealer_code=auth_dealer() | {t}_write: can_write_sales() AND dealer_code=auth_dealer()
--     ⟹ write true → dealer_code=auth_dealer() true → select true เสมอ
--   • dealer_lead_rules_read: is_hq() OR dealer_code=auth_dealer() | _write: is_hq() OR (dealer_code=auth_dealer() AND can_write_sales())
--     ⟹ ทั้งสองกรณีของ write ล้วนทำให้ read true
--   • {t}_read (hq_*/master_catalog/dealers): true (ไม่จำกัด) | _write: can_write_master()
--     ⟹ read เป็น true อยู่แล้วเสมอ ไม่ต้องพิสูจน์เพิ่ม
--   • profiles_read: id=auth.uid() OR is_hq() | profiles_write: auth_role()='SUPER_ADMIN'
--     ⟹ is_hq() นิยามว่า auth_role() like 'HQ_%' or auth_role()='SUPER_ADMIN' → write true ⟹ is_hq() true ⟹ read true
--
-- Postgres ไม่รองรับ "FOR INSERT, UPDATE, DELETE" รวมในนโยบายเดียว (FOR รับคำสั่งเดียวต่อนโยบาย)
-- จึงต้องแยก {table}_write เดิม (FOR ALL) เป็น 3 นโยบาย: _insert (WITH CHECK เท่านั้น — ไม่มีแถวเดิม
-- ให้ USING ตรวจ) / _update (USING+WITH CHECK) / _delete (USING เท่านั้น — ไม่มีแถวใหม่ให้ WITH CHECK)
-- เงื่อนไขแต่ละอันเหมือนของเดิมทุกประการ (คัดลอกจาก 0098) — เปลี่ยนแค่ "ขอบเขตคำสั่งที่ครอบ" ไม่เปลี่ยน
-- เงื่อนไขสิทธิ์เลย

do $$
declare
  t text;
  cond text;
begin
  -- กลุ่ม dealer_code = auth_dealer() (can_write_sales) — เหมือนกันทุกตาราง
  foreach t in array array['appointments','customer_notes','customers','dealer_settings','files','leads','quotations','responsible_persons'] loop
    execute format('drop policy if exists %1$s_write on %1$I', t);
    cond := '(select can_write_sales()) and (dealer_code = (select auth_dealer()))';
    execute format('create policy %1$s_insert on %1$I for insert with check ( %2$s )', t, cond);
    execute format('create policy %1$s_update on %1$I for update using ( %2$s ) with check ( %2$s )', t, cond);
    execute format('create policy %1$s_delete on %1$I for delete using ( %2$s )', t, cond);
  end loop;

  -- กลุ่ม can_write_master() ล้วน — ตารางระดับเครือ
  foreach t in array array['dealers','hq_company','hq_notif_rules','hq_policy','hq_sales_journey','hq_targets','master_catalog'] loop
    execute format('drop policy if exists %1$s_write on %1$I', t);
    cond := '(select can_write_master())';
    execute format('create policy %1$s_insert on %1$I for insert with check ( %2$s )', t, cond);
    execute format('create policy %1$s_update on %1$I for update using ( %2$s ) with check ( %2$s )', t, cond);
    execute format('create policy %1$s_delete on %1$I for delete using ( %2$s )', t, cond);
  end loop;
end $$;

-- dealer_lead_rules — เงื่อนไขเฉพาะตัว (is_hq() หรือ เจ้าของสาขา+can_write_sales)
drop policy if exists dealer_lead_rules_write on dealer_lead_rules;
create policy dealer_lead_rules_insert on dealer_lead_rules for insert
  with check ( (select is_hq()) or ((dealer_code = (select auth_dealer())) and (select can_write_sales())) );
create policy dealer_lead_rules_update on dealer_lead_rules for update
  using      ( (select is_hq()) or ((dealer_code = (select auth_dealer())) and (select can_write_sales())) )
  with check ( (select is_hq()) or ((dealer_code = (select auth_dealer())) and (select can_write_sales())) );
create policy dealer_lead_rules_delete on dealer_lead_rules for delete
  using      ( (select is_hq()) or ((dealer_code = (select auth_dealer())) and (select can_write_sales())) );

-- profiles_write — เงื่อนไขเฉพาะตัว (SUPER_ADMIN ล้วน) — profiles_mgmt_update/profiles_self_update
-- เป็น FOR UPDATE อยู่แล้วตั้งแต่ต้น ไม่ครอบ SELECT ไม่ต้องแตะ
drop policy if exists profiles_write on profiles;
create policy profiles_insert on profiles for insert
  with check ( (select auth_role()) = 'SUPER_ADMIN' );
create policy profiles_update on profiles for update
  using      ( (select auth_role()) = 'SUPER_ADMIN' )
  with check ( (select auth_role()) = 'SUPER_ADMIN' );
create policy profiles_delete on profiles for delete
  using      ( (select auth_role()) = 'SUPER_ADMIN' );
