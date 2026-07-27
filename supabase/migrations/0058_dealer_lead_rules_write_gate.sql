-- Benjamin PMS — ปิด residual ที่ 0032 บันทึกไว้: dealer_lead_rules write ให้ผ่าน can_write_sales()
--
-- เดิม (0008): dealer_lead_rules_write ยอมให้ `dealer_code = auth_dealer()` เขียนได้ตรง ๆ
--   → ผู้ใช้สาขา "บทบาทใดก็ได้" (รวม DEALER_SITE ที่เขียนงานขายไม่ได้) แก้กฎติดตามของสาขาได้
--   → และสาขาที่เพิ่งถูก "ปิดใช้งาน" ยังแก้กฎของตัวเองได้จน token หมดอายุ (0032 ตัดการเขียนอื่น ๆ
--     ด้วย is_account_active() ผ่าน can_write_sales()/can_write_master() แต่ใบนี้พลาด dealer_lead_rules)
--
-- แก้: ฝั่งสาขาต้องผ่าน can_write_sales() (= DEALER_ADMIN/DEALER_SALES และบัญชี/สาขา active)
--   ปิดทั้งช่องบทบาทและช่อง deactivation ในใบเดียว · ฝั่ง HQ คงเดิม (is_hq()) ไม่เปลี่ยนพฤติกรรม
--   อ่านได้ทุกคนคงเดิม (นโยบายอ่านไม่แตะ)

drop policy if exists dealer_lead_rules_write on dealer_lead_rules;
create policy dealer_lead_rules_write on dealer_lead_rules for all
  using      ( is_hq() or (dealer_code = auth_dealer() and can_write_sales()) )
  with check ( is_hq() or (dealer_code = auth_dealer() and can_write_sales()) );
