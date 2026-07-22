-- Benjamin PMS — บังคับความสัมพันธ์ "ทุกข้อมูลต้องสังกัดสาขาที่มีอยู่จริง" (H1)
--
-- ปัญหา: schema เดิมไม่มี FK เลยแม้แต่ตัวเดียว (นอกจาก profiles → auth.users)
--        dealer_code เป็นข้อความลอย ๆ → พิมพ์ผิด/สาขาถูกลบ แล้วข้อมูลกลายเป็นกำพร้าได้เงียบ ๆ
--
-- แก้: FK dealer_code → dealers(code) ทุกตารางที่ผูกกับสาขา
--      • on update cascade : เปลี่ยนรหัสสาขาแล้วข้อมูลตามไปด้วย
--      • on delete restrict: ลบสาขาที่ยังมีข้อมูลค้างไม่ได้ (ต้องย้าย/ลบข้อมูลก่อน)
--
-- หมายเหตุที่ "ยังไม่ทำ" (ตั้งใจ) — ต้องแก้ความหมายของข้อมูลก่อน จึงจะใส่ FK ได้:
--   • quotations.customer_id → customers(dealer_code,id): ตอนนี้ใช้ 0 แทน "ยังไม่มีลูกค้า"
--     ต้องเปลี่ยนเป็น NULL ก่อน ไม่งั้น FK จะปฏิเสธใบที่ออกให้ลีด
--   • appointments.lead_id → leads: lead_id เป็น integer อ้าง lead.num_id แต่ leads.id เป็น text
--   • files.record_id: อ้างได้ทั้งลีดและลูกค้า (polymorphic) จึงผูก FK ตรง ๆ ไม่ได้

do $$
declare t text;
begin
  foreach t in array array['leads','quotations','customers','appointments','files','responsible_persons','dealer_lead_rules'] loop
    execute format('alter table %I drop constraint if exists %I', t, t || '_dealer_fk');
    execute format(
      'alter table %I add constraint %I foreign key (dealer_code) references dealers(code) on update cascade on delete restrict',
      t, t || '_dealer_fk');
  end loop;
end $$;
