-- Benjamin PMS — index ตามรูปแบบ query ที่แอปยิงจริง (M4)
--
-- ที่มา: SupabaseAdapter อ่านทุกตารางแบบ "กรองสาขา + เรียงตาม id + แบ่งหน้า"
--        (selectScoped → .eq('dealer_code',?).order('id').range(from,to))
--        0001 ให้ index ไว้แค่คอลัมน์ dealer_code เดี่ยว ๆ → Postgres ใช้ index กรองได้
--        แต่ต้อง sort ผลลัพธ์เองทุกครั้ง (และ sort ก่อน แล้วค่อยตัด range = ทำงานทั้งกอง)
--        index ผสม (dealer_code, id) ตรงกับทั้งเงื่อนไขและลำดับ → อ่านตามลำดับ index แล้วหยุดเมื่อครบหน้า
--
-- ตารางที่ไม่ต้องแตะ:
--   customers / appointments — 0012 ตั้ง PK เป็น (dealer_code, id) อยู่แล้ว = ได้ index ผสมฟรี
--   audit_log               — เรียงตาม id ล้วน ใช้ PK ได้เลย (btree อ่านย้อนได้)
--   dealer_lead_rules       — PK เป็น dealer_code อยู่แล้ว

-- ── 1. อ่านรายสาขา + เรียง id ──────────────────────────────────────────────
create index if not exists idx_leads_dealer_id      on leads      (dealer_code, id);
create index if not exists idx_quotations_dealer_id on quotations (dealer_code, id);
create index if not exists idx_files_dealer_id      on files      (dealer_code, id);

-- index คอลัมน์เดี่ยวของ 0001 ซ้ำซ้อนแล้ว (คอลัมน์นำของตัวผสมคือ dealer_code ตัวเดียวกัน
-- ครอบทั้งการกรองสาขาและการเช็ค FK ของ 0018) — ทิ้งไป ลดภาระตอนเขียน
drop index if exists idx_leads_dealer;
drop index if exists idx_quotations_dealer;
drop index if exists idx_files_dealer;
drop index if exists idx_customers_dealer;
drop index if exists idx_appointments_dealer;

-- ── 2. แก้/ลบรายแถวด้วย id ล้วน ────────────────────────────────────────────
-- adapter อัปเดต/ลบด้วย .eq('id', id) เฉย ๆ (สาขาถูกจำกัดด้วย RLS อยู่แล้ว)
-- แต่ PK ของสองตารางนี้ขึ้นต้นด้วย dealer_code → เงื่อนไข id ล้วนใช้ PK ไม่ได้ ต้องสแกนทั้งตาราง
create index if not exists idx_customers_id    on customers    (id);
create index if not exists idx_appointments_id on appointments (id);

-- ── 3. ผู้รับผิดชอบรายสาขา ─────────────────────────────────────────────────
-- persons.save ลบทั้งสาขาแล้วใส่ใหม่ (delete where dealer_code=?) + อ่านแบบกรองสาขา
create index if not exists idx_responsible_persons_dealer on responsible_persons (dealer_code);

-- ── 4. ปิดใบที่เลยกำหนด (expire_quotations ของ 0019) ───────────────────────
-- ใบที่ "ส่งแล้ว" เป็นส่วนน้อยของตาราง และเป็นชุดเดียวที่ฟังก์ชันแตะ
-- partial index จึงเล็กมากและตรงงาน (เงื่อนไข expiry เป็น text + regex ใช้ index ไม่ได้อยู่แล้ว
-- แต่แค่ตัดเหลือเฉพาะใบที่ส่งแล้วก็ไม่ต้องสแกนทั้งตาราง)
create index if not exists idx_quotations_sent_expiry
  on quotations (expiry) where status = 'sent_to_client';
