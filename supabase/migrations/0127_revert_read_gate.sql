-- ── ถอยด่านตรวจสถานะบัญชีออกจาก "ฝั่งอ่าน" ทั้งหมด (ยกเลิก 0123–0126) ────────────────
--
-- ทำไมต้องถอย — พังจริง ไม่ใช่แค่ช้า:
--   ชุดทดสอบ "10 ตัวแทนทำงานพร้อมกัน" ล้มทั้ง 10 ราย ทั้งรอบแรกและรอบรันซ้ำ
--   ข้อความจริงจากเบราว์เซอร์:
--     [http 500] .../rest/v1/audit_log?select=*&order=id.desc&limit=200
--     DbError: canceling statement due to statement timeout
--   คือการอ่านบันทึกการใช้งาน (ตอนนี้ 8,801 แถว) "หมดเวลา" จนฐานข้อมูลยกเลิกคำสั่งทิ้ง
--   ผู้ใช้จะเห็นหน้าจอแจ้งเตือนพังทันทีในการใช้งานจริง ไม่ใช่แค่ในชุดทดสอบ
--
--   สาเหตุ: ฐานข้อมูลเรียกฟังก์ชันตรวจสถานะซ้ำ "ทุกแถวที่สแกน" ไม่ใช่ครั้งเดียวต่อคำสั่ง
--   ลองแล้ว 3 รูปแบบ (เรียกตรง ๆ · ครอบ select · ฟังก์ชัน SQL ธรรมดา) ไม่มีแบบไหนถูกพอ
--   ตัวเลขที่วัดได้ด้วยข้อมูล 2,000 แถว: อ่านช้าลง 1.9–4 เท่า · นับทั้งตารางช้าลง 4–11 เท่า
--   และยิ่งข้อมูลโต ยิ่งแพงขึ้นตามจำนวนแถวที่ต้องไล่ดู
--
-- สรุปการตัดสินใจ: ราคาที่ต้องจ่ายสูงเกินกว่าประโยชน์ที่ได้
--   ช่องโหว่เดิม (H-1) คือ "ปิดบัญชีแล้วยังอ่านข้อมูลได้อีกไม่เกิน 1 ชั่วโมง"
--   ซึ่งกันได้ด้วยวิธีที่ไม่มีต้นทุนต่อคำสั่งเลย: ลดอายุ token ที่หน้าตั้งค่า Supabase Auth
--   (เช่นเหลือ 5–10 นาที) → ช่วงเสี่ยงสั้นลงตามนั้น โดยความเร็วไม่เปลี่ยนแม้แต่นิดเดียว
--   เรื่องนี้ตั้งที่ SQL ไม่ได้ ต้องให้ผู้ดูแลระบบไปตั้งที่หน้าตั้งค่า — บันทึกไว้เป็นงานค้าง
--
-- ใบนี้คืนกฎการอ่านกลับเป็นของเดิมทุกตาราง (ตามที่ 0089 · 0028 · 0024 · 0002 เคยตั้งไว้)
do $$
declare t text;
begin
  foreach t in array array['leads','quotations','customers','appointments','files','responsible_persons'] loop
    execute format('drop policy if exists %1$s_select on %1$I', t);
    execute format($f$
      create policy %1$s_select on %1$I for select
        to authenticated
        using ( is_hq() or dealer_code = auth_dealer() )
    $f$, t);
  end loop;
end $$;

drop policy if exists customer_notes_select on customer_notes;
create policy customer_notes_select on customer_notes for select
  to authenticated
  using ( is_hq() or dealer_code = auth_dealer() );

drop policy if exists dealer_settings_select on dealer_settings;
create policy dealer_settings_select on dealer_settings for select
  to authenticated
  using ( is_hq() or dealer_code = auth_dealer() );

drop policy if exists audit_read on audit_log;
create policy audit_read on audit_log for select
  to authenticated
  using ( is_hq() );

drop function if exists public.is_self_active();
