-- ── ปิดบัญชีแล้วต้อง "อ่านข้อมูลไม่ได้ทันที" ไม่ใช่รออีก 1 ชั่วโมง ──────────────────
--
-- อาการ (ผลตรวจสอบระบบ 7 ส.ค. 69 · ระดับสูง H-1 · ยิงพิสูจน์จริงแล้ว):
--   สำนักงานใหญ่สั่งปิดบัญชีตัวแทน → ล็อกอินใหม่ถูกปฏิเสธทันที ✓ · เขียนข้อมูลถูกกันทันที ✓
--   แต่ "อ่าน" ยังทำได้ต่อ ตราบใดที่ยังถือ token ใบเดิมอยู่ (อายุ 1 ชั่วโมง)
--   → พนักงานที่เพิ่งถูกปลด ยังเปิดดูฐานลูกค้า/ลีด/ใบเสนอราคาทั้งสาขาได้อีกไม่เกิน 1 ชั่วโมง
--   → token ที่หลุดออกไปแล้ว เพิกถอนทันทีไม่ได้เลย
--
-- สาเหตุ: กฎการ "อ่าน" ใช้ is_hq() / auth_dealer() ซึ่งอ่านจาก claim ใน token
--   claim ถูกประทับตอนออก token แล้วไม่ตรวจซ้ำอีกจนกว่าจะหมดอายุ
--   ส่วนกฎการ "เขียน" เดินผ่าน can_write_sales()/can_write_master() ซึ่งเรียก is_account_active()
--   ที่อ่านสถานะจากตาราง profiles สด ๆ ทุกครั้ง — ฝั่งเขียนจึงถูกต้องอยู่แล้ว ฝั่งอ่านตกหล่น
--
-- แก้: เติม is_account_active() เข้าไปในกฎการอ่านของ "ตารางที่เก็บข้อมูลธุรกิจ" ให้เท่ากับฝั่งเขียน
--
-- ขอบเขตที่ตั้งใจ "ไม่แตะ" และเหตุผล:
--   • ตารางข้อมูลกลางที่ใช้ร่วมทั้งเครือ (master_catalog · hq_policy · hq_targets · hq_notif_rules ·
--     hq_company · dealers) — เป็นค่าตั้งค่ากลาง เช่น อัตราภาษี รายชื่อแม่แบบ ไม่ใช่ข้อมูลลูกค้า
--     บัญชีที่ถูกปิดอ่านค่าพวกนี้ได้อีกชั่วโมงหนึ่งไม่ได้สร้างความเสียหาย และการแตะกฎเหล่านี้
--     เพิ่มความเสี่ยงทำหน้าจอพังโดยไม่ได้ประโยชน์ตามสัดส่วน
--   • profiles — เงื่อนไข id = auth.uid() คือ "อ่านโปรไฟล์ตัวเอง" ซึ่งต้องอ่านได้เสมอ
--     (หน้าจอใช้ตัดสินว่าจะพาไปหน้าไหน) · ส่วนสาขา is_hq() ถูกกันที่ชั้น API แล้วทุกเส้นทาง
--     (authorizeAdmin ตรวจ profiles.status สดตั้งแต่ 6 ส.ค. 69)
--
-- ⚠️ ผลต่อความเร็ว — ต้องเขียนเป็น (select is_account_active()) เท่านั้น ห้ามเรียกตรง ๆ
--   วัดจริงด้วยข้อมูล 2,000 แถว (7 รอบ เอาค่ากลาง):
--     เรียกตรง ๆ   → อ่าน 159 → 462 ms (ช้าลง 3 เท่า) · นับจำนวน 144 → 1,036 ms (ช้าลง 7 เท่า)
--     ครอบ select → ผลอยู่ในรายงาน (ตัวเลขหลังแก้)
--   เหตุผล: ถ้าเรียกฟังก์ชันตรง ๆ ในกฎ ฐานข้อมูลจะเรียกซ้ำ "ทุกแถว" ที่สแกน
--   ครอบด้วย (select ...) ทำให้ถูกยกไปคำนวณครั้งเดียวก่อนสแกน แล้วใช้ค่าเดิมกับทุกแถว
--   ผลลัพธ์ทางสิทธิ์เหมือนกันทุกประการ (ฟังก์ชันไม่ขึ้นกับแถว — ดูแค่บัญชีผู้เรียก)

-- ── 1) ตารางงานขาย 6 ตาราง (โครงเดียวกับ 0089 ข้อ 11 · เปลี่ยนเฉพาะบรรทัด using) ──
do $$
declare t text;
begin
  foreach t in array array['leads','quotations','customers','appointments','files','responsible_persons'] loop
    execute format('drop policy if exists %1$s_select on %1$I', t);
    execute format($f$
      create policy %1$s_select on %1$I for select
        to authenticated
        using ( ( is_hq() or dealer_code = auth_dealer() ) and (select is_account_active()) )
    $f$, t);
  end loop;
end $$;

-- ── 2) โน้ตลูกค้า (0028) — เป็นบันทึกการคุยกับลูกค้า อ่อนไหวเท่าข้อมูลลูกค้า ──
drop policy if exists customer_notes_select on customer_notes;
create policy customer_notes_select on customer_notes for select
  to authenticated
  using ( ( is_hq() or dealer_code = auth_dealer() ) and (select is_account_active()) );

-- ── 3) ตั้งค่าเอกสารของสาขา (0024) — หัวกระดาษ/ตราประทับ/ลายเซ็นดิจิทัลของตัวแทน ──
drop policy if exists dealer_settings_select on dealer_settings;
create policy dealer_settings_select on dealer_settings for select
  to authenticated
  using ( ( is_hq() or dealer_code = auth_dealer() ) and (select is_account_active()) );

-- ── 4) บันทึกการใช้งาน (0002) — ใครทำอะไรทั้งระบบ เห็นได้เฉพาะสำนักงานใหญ่ที่ยังทำงานอยู่ ──
drop policy if exists audit_read on audit_log;
create policy audit_read on audit_log for select
  to authenticated
  using ( is_hq() and (select is_account_active()) );
