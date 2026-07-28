-- Benjamin PMS — จำกัดการ "อ่าน" dealer_lead_rules ให้เฉพาะสาขาตัวเอง + HQ
--
-- เดิม (0002 กลุ่ม network-read): dealer_lead_rules อ่านได้ด้วย using(true) — ทุกสาขาเห็นกฎติดตาม
--   (follow_up_alert_days / unassigned_alert_hours) ของทุกสาขา = ข้อมูลรั่วเล็กน้อยข้ามสาขา
--
-- แก้: อ่านได้ถ้าเป็น HQ หรือเป็นแถวสาขาตัวเอง — ตรงกับ policy เขียน (0058)
--   ปลอดภัยกับแอป: ฝั่ง dealer เรียก getLeadRulesMap แต่ใช้แค่ของสาขาตัวเอง (useLeadRules(code))
--   → RLS คืนเฉพาะแถวตัวเอง แผนที่มี 1 รายการ ยังทำงาน · HQ (is_hq) เห็นครบเหมือนเดิม
--   (การคำนวณแจ้งเตือนฝั่ง HQ เดินผ่าน RPC hq_alerts — RLS scope ให้ตามผู้เรียก และไม่ได้อ่าน
--    dealer_lead_rules อยู่แล้ว จึงไม่มี cross-dealer leak ไม่ว่า policy นี้จะเข้มแค่ไหน)

drop policy if exists dealer_lead_rules_read on dealer_lead_rules;
create policy dealer_lead_rules_read on dealer_lead_rules for select
  using ( is_hq() or dealer_code = auth_dealer() );
