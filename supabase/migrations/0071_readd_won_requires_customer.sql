-- Benjamin PMS — ใส่ constraint quotations_won_requires_customer กลับ (0069 → ถอดชั่วคราวใน 0070)
--
-- ต้นเหตุที่ถอดไปตอน 0070: SalesContext.tsx (finish() ใน convertLeadToCustomer) ยิง
-- persistQuote.update (ผูก customer_id) แบบ fire-and-forget ไม่รอผลจริง แล้ว convertLeadToCustomer
-- ก็ return ทันที ทำให้ setQuotationStatus ยิง persistQuote.setStatus(won) ตามมาได้ก่อนที่ customer_id
-- จะถึง DB จริง (race) — constraint นี้เลยปฏิเสธการเขียนบางครั้ง ทำให้ปุ่ม "ลูกค้าตอบรับ" พังเป็นบางครั้ง
--
-- แก้ต้นเหตุแล้ว: persistQuote.update คืน promise จริง (ไม่ใช้ void ทิ้ง) · finish() รวบ Promise.all
-- ของทุกใบที่ relink แล้วคืนออกมา · convertLeadToCustomer await finish(...) ก่อน return ทุกเส้นทาง
-- (ทั้ง dup.id และ newId) → ผู้เรียก (setQuotationStatus) ยิง setStatus(won) ได้ก็ต่อเมื่อ customer_id
-- ถึง DB แล้วจริง ๆ เท่านั้น — ยืนยันด้วย integration test func-quote-win.spec.ts ผ่านครบ 5/5
-- ทั้งรันเดี่ยวและรันรวมกับชุดอื่น หลังแก้โค้ดนี้
--
-- ใส่กลับเป็นเซฟตี้เน็ตชั้นที่ 2 ตามเจตนาเดิมของ 0069 (กันโค้ดเส้นทางอื่นในอนาคตที่ไม่ผ่าน SalesContext)

alter table quotations add constraint quotations_won_requires_customer
  check (status <> 'won' or customer_id is not null);
