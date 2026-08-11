-- ── บันทึกแคตตาล็อก: หนึ่งการกระทำ = หนึ่งแถว และอ่านรู้เรื่อง ────────────────────────
--
-- บั๊กจริง (เอเจนต์สวมบทผู้ดูแล HQ เจอเอง 10 ส.ค. 69 · รอบสุดท้าย):
--   แก้แม่แบบ 1 ครั้ง ได้บันทึก 2 แถว เพราะจดสองที่:
--     • ฝั่งแอป  → "แก้ไขแม่แบบ | โกดังสำเร็จรูป"        ผู้ใช้ = "ผู้ดูแลระบบสำนักงานใหญ่" (ชื่อที่แสดง)
--     • ตัวดัก DB → "UPDATE แคตตาล็อก | โกดังสำเร็จรูป"   ผู้ใช้ = "admin@benjamin.com" (อีเมล)
--   ผลที่เห็นบนจอ: ตัวกรอง "ผู้ใช้" แยกคนคนเดียวเป็น 2 รายการ
--   และการ์ด "ผู้ใช้ที่มีกิจกรรม" ขึ้น 6 ทั้งที่ทั้งระบบมีบัญชีจริง 4
--
--   ซ้ำร้าย ฝั่งแอปจดแม้ "กดบันทึกโดยไม่ได้แก้อะไรเลย" (ยืนยันแล้วว่า 0 คอลัมน์เปลี่ยน)
--   ซึ่งเป็นบั๊กชนิดเดียวกับที่ 0133 ตั้งใจปิด เพียงแต่ปิดไว้แค่ชั้นฐานข้อมูล ไม่ได้ปิดชั้นแอป
--
-- ทางที่เลือก: ให้ตัวดักที่ฐานข้อมูลเป็นผู้จดเพียงผู้เดียว แล้วตัดการจดฝั่งแอปออก
--   เหตุผล: ตัวดักครอบทุกทางที่ข้อมูลถูกแก้ (หน้าจอ · คำสั่งเซิร์ฟเวอร์ · สคริปต์กู้คืน)
--   และยิงเฉพาะตอนเนื้อหาเปลี่ยนจริงอยู่แล้ว (0133) จึงไม่มีทางจดเกิน
--
-- แต่ข้อความเดิมของตัวดักสั้นเกินไป ("UPDATE แคตตาล็อก | ชื่อ") — ผู้ตรวจย้อนหลังอยากรู้ว่า
-- "ราคาเปลี่ยนจากเท่าไหร่เป็นเท่าไหร่" จึงเติมรายละเอียดให้เท่าที่ฝั่งแอปเคยให้

create or replace function public.log_catalog_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action text;
  v_target text;
begin
  if tg_op = 'INSERT' then
    v_action := 'เพิ่มแม่แบบ';
    v_target := coalesce(new.name, '—') ||
                case when new.price is not null then ' · ฿' || trim(to_char(new.price, 'FM999,999,999')) else '' end;
  elsif tg_op = 'DELETE' then
    v_action := 'ลบแม่แบบ';
    v_target := coalesce(old.name, '—');
  else
    -- ราคาเปลี่ยน = เรื่องที่ผู้ตรวจสนใจที่สุด แยกคำให้ชัดและบอกค่าเดิม→ค่าใหม่
    if new.price is distinct from old.price then
      v_action := 'ปรับราคากลาง';
      v_target := coalesce(new.name, '—') || ' · ฿' || trim(to_char(old.price, 'FM999,999,999'))
                  || ' → ฿' || trim(to_char(new.price, 'FM999,999,999'));
    else
      v_action := 'แก้ไขแม่แบบ';
      v_target := coalesce(new.name, old.name, '—');
    end if;
  end if;

  insert into audit_log("user", role, action, target)
  values (coalesce(auth.jwt() ->> 'email', 'system'), auth_role(), v_action, v_target);
  return coalesce(new, old);
end $$;

comment on function public.log_catalog_change() is
  'จดบันทึกการเปลี่ยนแคตตาล็อก — เป็นผู้จดเพียงผู้เดียว (ฝั่งแอปไม่จดซ้ำแล้ว) และยิงเฉพาะตอนเนื้อหาเปลี่ยนจริง (0133)';
