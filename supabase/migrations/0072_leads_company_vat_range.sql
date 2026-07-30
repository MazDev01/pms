-- Benjamin PMS — เก็บกวาดจากผลทดสอบ QA Edge/Abuse Case รอบสอง (30 ก.ค. 69)
--
-- ยืนยันก่อนใส่ทั้ง 2 จุด: query จริงไม่มีแถวผิดเงื่อนไขค้าง (เจอ 1 แถวขยะจากการทดสอบ security เก่า
-- ที่ชื่อ "SECTEST-RYG-REAL-LEAD" ไม่มีข้อมูลอะไรเลย — ลบทิ้งก่อนแล้วค่อยใส่ constraint นี้)

-- ── 1) leads.company ห้ามว่าง (QA เคส 6b: ยิง insert ตรง company="" DB เคยยอมรับเงียบๆ) ──────
-- ใช้ CHECK ไม่ใช่แค่ NOT NULL เพราะ NOT NULL ปฏิเสธแค่ NULL ไม่ปฏิเสธสตริงว่าง ""
alter table leads add constraint leads_company_nonempty
  check (company is not null and company <> '');

-- ── 2) hq_policy.vat ต้องอยู่ในช่วงที่เป็นไปได้จริง (QA เคส A5/A6: ยิง update vat=-15 หรือ 999 ตรง
-- ผ่านได้เงียบๆ — ฟีเจอร์แก้ VAT ถูกถอดจากหน้าจอแล้ว แต่ยังกันไว้ที่ DB เผื่อ path อื่นในอนาคต) ────
alter table hq_policy add constraint hq_policy_vat_range
  check (vat >= 0 and vat <= 100);
