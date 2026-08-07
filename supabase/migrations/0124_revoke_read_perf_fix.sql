-- ── ตามแก้ความเร็วของ 0123 — ต้องครอบด้วย (select ...) ไม่ใช่เรียกฟังก์ชันตรง ๆ ─────────
--
-- 0123 ปิดช่อง "ปิดบัญชีแล้วยังอ่านข้อมูลได้อีก 1 ชั่วโมง" ได้ถูกต้องเรื่องสิทธิ์
-- แต่วัดความเร็วแล้วแย่เกินรับได้ (ข้อมูลทดสอบ 2,000 แถว · 7 รอบ เอาค่ากลาง):
--     อ่านลูกค้า 1,000 แถว    159 ms → 462 ms   (ช้าลง ~3 เท่า)
--     นับจำนวนลูกค้า          144 ms → 1,036 ms (ช้าลง ~7 เท่า)
--
-- เหตุผล: เรียกฟังก์ชันตรง ๆ ในกฎการอ่าน ฐานข้อมูลจะเรียกซ้ำ "ทุกแถวที่สแกน"
--   ครอบด้วย (select ...) ทำให้ถูกยกไปคำนวณครั้งเดียวก่อนเริ่มสแกน แล้วใช้ค่าเดิมกับทุกแถว
--   ผลด้านสิทธิ์เหมือนกันทุกประการ — ฟังก์ชันดูแค่ "บัญชีของผู้เรียก" ไม่ได้ขึ้นกับแถวใด ๆ
--
-- ใบนี้มีไว้เพราะ 0123 ถูก apply ไปแล้วบนฐานข้อมูลจริง แก้ไฟล์เดิมย้อนหลังไม่มีผล
-- (สภาพแวดล้อมที่ตั้งใหม่จะได้รูปแบบที่ถูกตั้งแต่ 0123 แล้ววิ่งผ่านใบนี้อีกครั้ง — ผลลัพธ์เท่ากัน)

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

drop policy if exists customer_notes_select on customer_notes;
create policy customer_notes_select on customer_notes for select
  to authenticated
  using ( ( is_hq() or dealer_code = auth_dealer() ) and (select is_account_active()) );

drop policy if exists dealer_settings_select on dealer_settings;
create policy dealer_settings_select on dealer_settings for select
  to authenticated
  using ( ( is_hq() or dealer_code = auth_dealer() ) and (select is_account_active()) );

drop policy if exists audit_read on audit_log;
create policy audit_read on audit_log for select
  to authenticated
  using ( is_hq() and (select is_account_active()) );
