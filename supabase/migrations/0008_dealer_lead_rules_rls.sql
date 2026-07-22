-- Benjamin PMS — แก้ RLS ของ dealer_lead_rules (Phase 5)
-- เจ้าของกฎเปลี่ยนแล้ว (บอสสั่ง): เดิม HQ ตั้งค่าเดียวบังคับทุกสาขา → ตอนนี้ "ตัวแทนตั้งกฎของตัวเอง"
-- แต่ 0002 ตั้ง dealer_lead_rules เป็น HQ-write-only → ตัวแทนบันทึกกฎตัวเองไม่ได้
-- แก้: เขียนได้ถ้าเป็น HQ หรือเป็นแถวสาขาตัวเอง (dealer_code = auth_dealer()) · อ่านได้ทุกคน (คงเดิม)

drop policy if exists dealer_lead_rules_write on dealer_lead_rules;
create policy dealer_lead_rules_write on dealer_lead_rules for all
  using ( is_hq() or dealer_code = auth_dealer() )
  with check ( is_hq() or dealer_code = auth_dealer() );
