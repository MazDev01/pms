-- Benjamin PMS — ปิดรูสิทธิ์ที่ตรวจพบในรอบ Backend Audit (R1: C1 · C2 · C3 · M1 · M2)
--
-- ทั้งใบนี้แตะเฉพาะ "สิทธิ์" ไม่แตะโครงสร้างตารางหรือข้อมูล และไม่ต้องแก้โค้ดแอปเลย
-- เพราะทุกหน้าจอที่ใช้ข้อมูลเหล่านี้ล็อกอินอยู่ก่อนแล้ว
--
-- ══════════════════════════════════════════════════════════════════════════
-- C1 · ข้อมูลกลางทั้งเครือเปิดให้อ่านโดยไม่ต้องล็อกอิน
-- ══════════════════════════════════════════════════════════════════════════
-- 0002 (และ 0021/0028 ที่ทำตามแบบเดียวกัน) เขียนนโยบายอ่านว่า
--     create policy X_read on X for select using ( true )
-- โดยไม่ระบุ `to authenticated`
--
-- นโยบายที่ไม่ระบุ role มีผลกับ role `public` ซึ่งรวม `anon` ด้วย
-- และ anon key เป็นค่าที่ฝังอยู่ในบันเดิล JavaScript ของทุกหน้า = ใครก็หยิบไปใช้ได้
--
-- พิสูจน์แล้วตอนตรวจ (ยิงด้วย anon key เปล่า ไม่มี session):
--     dealers          → 10 สาขา พร้อม revenue_target รายสาขา
--     master_catalog   → ราคากลางครบ 6 รายการ (5,100–7,400 บาท/ตร.ม.)
--     hq_policy · hq_targets · hq_notif_rules · hq_company · hq_sales_journey → อ่านได้หมด
--
-- เจตนาเดิมของคอมเมนต์ใน 0002/0021/0028 คือ "อ่านได้ทุกคน" ในความหมาย
-- "ทุกคนในระบบ" (ตัวแทนต้องเห็นทะเบียนเครือ/ราคากลาง/นโยบาย) ไม่ใช่ "ทุกคนบนอินเทอร์เน็ต"
-- จึงเปลี่ยนเป็น to authenticated ให้ตรงกับเจตนา
do $$
declare t text;
begin
  foreach t in array array[
    'dealers', 'master_catalog',
    'hq_policy', 'hq_targets', 'hq_notif_rules',
    'dealer_lead_rules', 'hq_sales_journey', 'hq_company'
  ] loop
    execute format('drop policy if exists %1$s_read on %1$I', t);
    execute format(
      'create policy %1$s_read on %1$I for select to authenticated using ( true )', t);
  end loop;
end $$;

-- ══════════════════════════════════════════════════════════════════════════
-- C2 · quote_counters ไม่เคยเปิด RLS เลย
-- ══════════════════════════════════════════════════════════════════════════
-- 0002 เปิด RLS ให้ตารางตามรายชื่อที่ระบุไว้ แล้ว 0003 มาสร้างตารางนี้ "ทีหลัง"
-- จึงไม่มีใครกลับไปเปิดให้ และผ่านมาอีก 27 migration ก็ไม่มีใครสังเกต
--
-- พิสูจน์แล้ว: ตัวแทน RYG อ่านตัวนับของ CNX ได้ และ anon ที่ไม่ล็อกอินก็อ่านได้
-- (รู้ว่าแต่ละสาขาออกใบไปกี่ใบแล้ว = ปริมาณธุรกิจของคู่แข่ง)
-- ฝั่งเขียนยิ่งหนักกว่า: เมื่อไม่มี RLS สิทธิ์ DML ปกติของ anon/authenticated มีผล
-- → รีเซ็ตตัวนับของสาขาอื่นให้เลขที่ใบวนกลับไปชนของเดิมได้
--
-- แก้แบบเดียวกับ entity_counters ใน 0016 ที่ทำถูกอยู่แล้ว:
-- เปิด RLS โดย "ไม่สร้าง policy ใด ๆ" = ปิดสนิทสำหรับทุก role ที่ไม่ใช่เจ้าของตาราง
-- การเข้าถึงทั้งหมดต้องผ่านฟังก์ชัน next_quote_no เท่านั้น (ดู C3 ข้างล่าง)
alter table quote_counters enable row level security;

-- ══════════════════════════════════════════════════════════════════════════
-- C3 · next_quote_no ไม่ตรวจว่าเรียกให้สาขาตัวเอง
-- ══════════════════════════════════════════════════════════════════════════
-- 0003 รับ p_dealer เป็นพารามิเตอร์อิสระแล้วเดินตัวนับให้เลย ไม่เทียบกับ auth_dealer()
-- → ใครก็เรียก rpc('next_quote_no', {p_dealer:'CNX'}) รัว ๆ เพื่อเผาเลขที่ใบของสาขาอื่นได้
--   สาขานั้นออกใบครั้งถัดไปจะได้เลขกระโดดจาก 0003 ไป 5000 และทำซ้ำได้ไม่จำกัด
--
-- 0016 เขียน next_entity_id ไว้ถูกแล้ว (มี guard ครบ) — ช่องนี้คือ
-- "ทำถูกไปแล้วครั้งหนึ่ง แต่ไม่ได้ย้อนกลับไปแก้ตัวเก่า" จึงยกรูปแบบเดียวกันมาใช้
--
-- ต้องเป็น security definer ด้วย เพราะ C2 เพิ่งปิด quote_counters ไป
-- ถ้ารันด้วยสิทธิ์ผู้เรียกจะแตะตารางไม่ได้ = ออกเลขที่ใบไม่ได้ทั้งระบบ
-- (เจ้าของฟังก์ชัน = เจ้าของตาราง จึงข้าม RLS ได้ตามปกติของ Postgres)
create or replace function public.next_quote_no(p_dealer text, p_prefix text default 'Q-2026-')
returns text
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  -- ออกเลขได้เฉพาะสาขาตัวเอง (ผู้ดูแลข้อมูลกลางอนุญาต เผื่อสคริปต์ดูแลระบบ)
  -- เงื่อนไขเดียวกับ next_entity_id ใน 0016 ทุกประการ
  if p_dealer is distinct from auth_dealer() and not can_write_master() then
    raise exception 'forbidden: dealer mismatch';
  end if;
  -- สาขาต้องมีอยู่จริง — กันการสร้างแถวตัวนับขยะด้วยรหัสที่พิมพ์มั่ว
  if p_dealer is null or p_dealer = '' then
    raise exception 'forbidden: empty dealer';
  end if;

  insert into quote_counters(dealer_code, next_no) values (p_dealer, 2)
    on conflict (dealer_code) do update set next_no = quote_counters.next_no + 1
    returning next_no - 1 into n;
  return p_prefix || lpad(n::text, 4, '0');
end $$;

-- ⚠️ REVOKE ต้องทำกับ `public` ไม่ใช่ `anon`
--
--    Postgres ให้ EXECUTE กับ PUBLIC เป็นค่าเริ่มต้นเมื่อสร้างฟังก์ชัน
--    และสิทธิ์ที่ให้ PUBLIC ครอบทุก role อยู่แล้ว — การ revoke จาก role รายตัว
--    "ไม่ได้" ลบสิทธิ์ที่มาจาก PUBLIC ออก
--    → บรรทัด `revoke ... from anon` ใน 0016/0019 จึงไม่เคยมีผลจริงเลย
--      (ตรวจพบระหว่างแก้ข้อนี้ — แก้ให้ถูกทั้งชุดในคราวเดียว)
revoke execute on function public.next_quote_no(text, text)   from public;
grant  execute on function public.next_quote_no(text, text)   to   authenticated;

revoke execute on function public.next_entity_id(text, text)  from public;
grant  execute on function public.next_entity_id(text, text)  to   authenticated;

revoke execute on function public.expire_quotations(date)     from public;
grant  execute on function public.expire_quotations(date)     to   authenticated;

-- ══════════════════════════════════════════════════════════════════════════
-- M1 · bucket avatars — ใครก็เขียนทับรูปของใครก็ได้
-- ══════════════════════════════════════════════════════════════════════════
-- 0010 เขียนว่า `to authenticated using (bucket_id = 'avatars')` เฉย ๆ
-- ไม่มีเงื่อนไขเจ้าของพาธ ต่างจาก dealer-files ที่คุมด้วย foldername[1]
-- → ผู้ใช้คนใดก็ได้ลบหรือทับรูปโปรไฟล์ของคนอื่นทั้งระบบ
--
-- คุมด้วยโฟลเดอร์ชั้นแรก = id ของผู้ใช้ (รูปแบบเดียวกับ dealer-files/{รหัสสาขา}/…)
-- ตอนนี้ยังไม่มีโค้ดไหนอัปโหลดเข้า bucket นี้ (รูปโปรไฟล์เก็บเป็น data URI ในตาราง)
-- จึงรัดสิทธิ์ได้โดยไม่กระทบการทำงานใด ๆ และพร้อมไว้ให้ตอนย้ายรูปออกจากตาราง
drop policy if exists avatars_write on storage.objects;
create policy avatars_write on storage.objects for all
  to authenticated
  using      ( bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text )
  with check ( bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text );

-- ══════════════════════════════════════════════════════════════════════════
-- M2 · บันทึกตรวจสอบเปิดให้ใครก็ยิงรายการปลอมเข้ามาได้
-- ══════════════════════════════════════════════════════════════════════════
-- 0002 เขียน `for insert with check ( true )` = ทุก role รวม anon
-- → ปลอมรายการเข้าบันทึกที่ใช้สอบสวนได้ ทำให้บันทึกทั้งกองเชื่อถือไม่ได้
--
-- บันทึกนี้เป็นของสำนักงานใหญ่ (นโยบายอ่านคือ is_hq() มาตั้งแต่ต้น)
-- และผู้เรียกจริงมีแค่หน้า HQ เท่านั้น — ตรวจแล้ว: /hq/dealers · /hq/master ·
-- /hq/settings · UsersPanel และ trigger log_catalog_change ของ 0003
-- ไม่มีฝั่งตัวแทนเรียกเลย
--
-- role = auth_role() กันการสวมบทบาท: จะบันทึกในนามบทบาทอื่นไม่ได้
-- (แอปส่งค่านี้มาจาก JWT claim อยู่แล้ว — ดู useAuditLogger → session.role)
drop policy if exists audit_insert on audit_log;
create policy audit_insert on audit_log for insert
  to authenticated
  with check ( is_hq() and role = auth_role() );

-- ══════════════════════════════════════════════════════════════════════════
-- หมายเหตุ: สิ่งที่ "จงใจไม่แตะ" ในใบนี้
-- ══════════════════════════════════════════════════════════════════════════
--   • bucket catalog-images ตั้งเป็น public = true ตั้งแต่ 0010
--     การรัด policy ไม่ช่วยอะไร เพราะ Storage เสิร์ฟผ่าน public URL อยู่แล้ว
--     ถ้าจะปิดต้องเปลี่ยน bucket เป็น private ซึ่งกระทบทุกหน้าที่แสดงรูปแม่แบบ — คนละงาน
--   • dealer_files_read ไม่ระบุ to authenticated แต่ปฏิเสธ anon อยู่แล้วโดยผล
--     (anon ได้ auth_dealer() = '' และ is_hq() = false จึงไม่ตรงเงื่อนไขใด)
--   • C4 (สถานะ inactive ยังล็อกอินได้) และ C6 (trigger สร้างลูกค้า id = 0)
--     เป็นคนละเรื่องและเสี่ยงกว่ามาก — แยกเป็นใบของตัวเอง
