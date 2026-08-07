-- ── สรุปด่าน "ปิดบัญชีแล้วอ่านไม่ได้ทันที" — เลือกแบบที่วัดแล้วเร็วที่สุด ────────────────
--
-- ลองมา 3 แบบ วัดจริงทุกแบบด้วยข้อมูล 2,000 แถว (7 รอบ เอาค่ากลาง · หน่วย ms):
--
--   แบบ                                          อ่าน 1,000 แถว    นับทั้งตาราง
--   ─────────────────────────────────────────────────────────────────────────
--   ไม่มีด่านเลย (ของเดิม ก่อนแก้)                      159             144
--   เรียก is_account_active() ตรง ๆ                    462           1,036
--   ครอบ (select is_account_active())  ← เลือกใช้      298             594
--   ฟังก์ชัน SQL ธรรมดาที่ inline ได้ (0125)            642           1,603
--
-- ผลที่ไม่คาดคิด: แบบ "SQL ธรรมดาที่น่าจะ inline ได้" กลับแพงที่สุด
--   เพราะมันอ่านตาราง profiles ในสิทธิ์ผู้เรียก → ต้องผ่านกฎ RLS ของ profiles ซ้ำอีกทุกแถว
--   ส่วน is_account_active() เป็น security definer จึงข้าม RLS ชั้นในไปได้ แม้จะ inline ไม่ได้ก็ตาม
--   → ใบ 0125 จึงถูกยกเลิก และเลิกใช้ is_self_active()
--
-- ต้นทุนที่ต้องยอมรับ: อ่านช้าลง ~1.9 เท่า · นับทั้งตารางช้าลง ~4 เท่า
--   ค่านี้ผูกกับ "จำนวนแถวที่สแกน" ไม่ใช่จำนวนแถวที่ได้ → จะแพงขึ้นตามขนาดข้อมูลที่โตในอนาคต
--   ทางเลือกที่ไม่มีต้นทุนต่อคำสั่งเลยคือ "ลดอายุ token" (ตั้งที่ Supabase Auth ไม่ใช่ที่ SQL)
--   ซึ่งย่นช่วงเสี่ยงจาก 60 นาทีเหลือเท่าอายุ token ที่ตั้ง — บันทึกไว้ให้ผู้บริหารตัดสิน
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

drop function if exists public.is_self_active();
