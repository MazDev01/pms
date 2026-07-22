-- Benjamin PMS — แยก "สิทธิ์อ่านระดับเครือ" ออกจาก "สิทธิ์แก้ข้อมูลกลาง" (C4)
--
-- ปัญหา: 0002 ใช้ is_hq() (role like 'HQ_%' or SUPER_ADMIN) เป็นทั้งเงื่อนไข "อ่านทั้งเครือ"
--        และ "เขียนข้อมูลกลาง" → HQ_STAFF ซึ่งฝั่งแอปห้ามแก้ catalog/dealers/settings
--        กลับเขียนได้จริงที่ DB ถ้ายิง API ตรง (ยกระดับสิทธิ์)
--
-- แก้: เพิ่ม can_write_master() = เฉพาะ SUPER_ADMIN / HQ_MANAGEMENT
--      • is_hq()            → ใช้ต่อสำหรับ "อ่านทั้งเครือ" (HQ_STAFF ยังอ่านได้ตามเดิม)
--      • can_write_master() → ใช้กับ policy เขียนของตารางข้อมูลกลาง
-- ให้ตรงกับ permissions.ts (HQ_MASTER = SUPER_ADMIN, HQ_MANAGEMENT เท่านั้น)

create or replace function can_write_master() returns boolean
  language sql stable as $$ select auth_role() in ('SUPER_ADMIN', 'HQ_MANAGEMENT') $$;

-- ตารางข้อมูลกลางที่ HQ เป็นเจ้าของ — อ่านได้ทุกคน (คงเดิม) · เขียนเฉพาะผู้มีสิทธิ์แก้ข้อมูลกลาง
do $$
declare t text;
begin
  foreach t in array array['dealers','master_catalog','hq_policy','hq_targets','hq_notif_rules'] loop
    execute format('drop policy if exists %1$s_write on %1$I', t);
    execute format($f$
      create policy %1$s_write on %1$I for all
        using ( can_write_master() )
        with check ( can_write_master() )
    $f$, t);
  end loop;
end $$;

-- กฎรายสาขา: HQ ที่แก้ข้อมูลกลางได้ หรือ ตัวแทนแก้ของสาขาตัวเอง (คงเจตนาเดิมของ 0008)
drop policy if exists dealer_lead_rules_write on dealer_lead_rules;
create policy dealer_lead_rules_write on dealer_lead_rules for all
  using ( can_write_master() or dealer_code = auth_dealer() )
  with check ( can_write_master() or dealer_code = auth_dealer() );
