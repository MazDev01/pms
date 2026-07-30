-- Benjamin PMS — เก็บกวาดจากการทดสอบระบบเต็มรูปแบบ (Security/Backend/Database engineer, 30 ก.ค. 69)
--
-- ไม่มีข้อไหนเป็นช่องโหว่ที่ถูกเจาะได้จริงในตอนนี้ (แอปชั้นบนกันไว้ครบแล้ว) — แต่เป็น "เซฟตี้เน็ตชั้นที่ 2"
-- ที่ระดับฐานข้อมูล กันไว้เผื่อโค้ดเส้นทางอื่นในอนาคต (API route ใหม่, batch job, แก้ข้อมูลตรงผ่าน console)
-- ที่ไม่ได้เดินผ่านตรรกะของแอปที่มีอยู่วันนี้ — ยืนยันก่อนใส่ว่าไม่กระทบข้อมูลปัจจุบันเลย (0 แถวผิดเงื่อนไขทุกจุด)

-- ── 1) กันมูลค่าติดลบ (Backend engineer test พบว่า DB ยอมรับเงียบๆ) ──────────────
alter table quotations add constraint quotations_total_value_nonneg check (total_value >= 0);
alter table customers  add constraint customers_total_value_nonneg  check (total_value >= 0);

-- ── 2) กันใบเสนอราคา "ปิดการขายสำเร็จ" (won) หลุดไม่ผูกลูกค้า ──────────────────
-- เดิม trigger เคยมีแล้วถูกลบใน 0033 (ตั้งใจย้าย atomicity ไปที่แอป: SalesContext.setQuotationStatus
-- สร้าง/ผูกลูกค้าก่อน สำเร็จแล้วค่อย mark won) — CHECK นี้เป็นเซฟตี้เน็ตสำรอง ไม่ได้แทนที่ตรรกะแอป
alter table quotations add constraint quotations_won_requires_customer
  check (status <> 'won' or customer_id is not null);

-- ── 3) เติม NOT NULL ให้คอลัมน์ตั้งค่าระบบที่แอปคาดว่าไม่ว่างเสมอ (TS type ไม่ optional) ──────
-- ยืนยันก่อนรันว่าไม่มี NULL ในข้อมูลปัจจุบันสักคอลัมน์ (query จริงก่อนเขียนใบนี้)
alter table hq_policy
  alter column require_approval set not null,
  alter column vat set not null,
  alter column quote_validity_days set not null;

alter table hq_targets
  alter column annual_target set not null,
  alter column win_rate_target set not null,
  alter column on_time_target set not null;

alter table hq_notif_rules
  alter column alerts set not null,
  alter column lead_idle_days set not null,
  alter column quote_expiring_days set not null,
  alter column dealer_idle_days set not null,
  alter column target_achieved_pct set not null,
  alter column lost_rate_pct set not null,
  alter column lost_rate_min_closed set not null;

-- master_catalog: เฉพาะ price (ตัวเลขที่แอปคำนวณราคาใบเสนอราคาต่อจริง — ว่างแล้วราคากลางพัง)
-- name มี not null อยู่แล้วตั้งแต่ 0001 · unit/spec/effective_date ยังไม่บังคับ เพราะเป็น text
-- ที่ HQ กรอกเสริมทีหลังได้ ไม่กระทบการคำนวณโดยตรงเท่า price
alter table master_catalog
  alter column price set not null;

alter table dealer_lead_rules
  alter column follow_up_alert_days set not null,
  alter column unassigned_alert_hours set not null;

-- responsible_persons: ตรวจฟอร์มจริงแล้วพบว่า title/phone/email "ไม่มี *" และปุ่มบันทึกเช็คแค่
-- disabled={!name.trim()} — ผู้ใช้กรอกแค่ชื่อแล้วบันทึกได้จริง (ตั้งใจ ไม่ใช่บั๊ก) ทั้งที่ ResponsiblePerson
-- type (mock.ts) ประกาศ non-optional — เป็นจุดที่ type เข้มกว่า UX จริง ไม่ใช่กรณีที่ควรบังคับที่ DB
-- ใส่ NOT NULL เฉพาะ active (ตั้งค่าจาก logic แอปเสมอ ไม่ใช่ free-text ที่ผู้ใช้เว้นว่างได้)
alter table responsible_persons
  alter column active set not null;
