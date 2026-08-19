-- Benjamin PMS — ประวัติการแก้ไขงานขาย (P2 จากผลตรวจระบบ 19 ส.ค. 69)
--
-- เดิม audit_log บันทึกเฉพาะสิ่งที่ "สำนักงานใหญ่" ทำ (แคตตาล็อก · ตัวแทน · ตั้งค่า)
--   ส่วนงานขายจริง — ใครเลื่อนขั้นลูกค้าเป้าหมาย ใครกดปิดการขาย ใครลบใบเสนอราคา — ไม่มีบันทึกเลย
--   พอมีข้อโต้แย้ง ("ดีลนี้ใครกดปิด" / "ใบนี้หายไปไหน") ก็ไม่มีอะไรให้ย้อนดู
--
-- ทำไมต้องเป็น trigger แบบ security definer:
--   1) กติกาเดิม (0031/0098) ยอมให้เขียน audit_log ได้เฉพาะบัญชีสำนักงานใหญ่ — ถ้าให้แอปฝั่งตัวแทน
--      เขียนเอง ต้องเปิดสิทธิ์เขียนให้ทุกคน ซึ่งแปลว่าใครก็ปลอมประวัติได้ ผิดวัตถุประสงค์ของบันทึก
--   2) เขียนที่ฐานข้อมูลทางเดียว = ทุกเส้นทางที่แก้ข้อมูลถูกบันทึกครบ ไม่ว่าจะแก้ผ่านหน้าจอไหน
--      หรือสคริปต์อะไร · ให้แต่ละหน้าจอจำไว้เขียนเองเมื่อไรก็มีหน้าที่ลืมเมื่อนั้น
--
-- บันทึกเฉพาะ "เหตุการณ์ที่มีความหมายทางธุรกิจ" ไม่ใช่ทุกการกดบันทึก:
--   สร้าง/ลบ ลูกค้าเป้าหมาย · เปลี่ยนขั้น · สร้าง/ลบ ใบเสนอราคา · เปลี่ยนสถานะใบ
--   (แก้ชื่อ/เบอร์/หมายเหตุ ไม่บันทึก — จะท่วมจนหาของจริงไม่เจอ)

-- ผู้ทำ: อีเมลจาก JWT · ระบบเบื้องหลัง (สคริปต์/งานตามเวลา) ไม่มี JWT → "system"
create or replace function public.audit_actor() returns text
language sql stable set search_path = public as $$
  select coalesce(nullif(auth.jwt() ->> 'email', ''), 'system');
$$;

-- ── ลูกค้าเป้าหมาย ──────────────────────────────────────────────────────────
create or replace function public.log_lead_change() returns trigger
language plpgsql
security definer                -- ต้องข้าม RLS ของ audit_log (เขียนได้เฉพาะ HQ) โดยเจตนา
set search_path = public
as $$
declare ป้าย text;
begin
  ป้าย := coalesce(new.company, old.company, new.id, old.id);
  if tg_op = 'INSERT' then
    insert into audit_log("user", role, action, target)
    values (audit_actor(), auth_role(), 'สร้างลูกค้าเป้าหมาย',
            coalesce(new.dealer_code,'') || ' · ' || new.id || ' · ' || ป้าย);
  elsif tg_op = 'DELETE' then
    insert into audit_log("user", role, action, target)
    values (audit_actor(), auth_role(), 'ลบลูกค้าเป้าหมาย',
            coalesce(old.dealer_code,'') || ' · ' || old.id || ' · ' || ป้าย);
  elsif new.status is distinct from old.status then
    insert into audit_log("user", role, action, target)
    values (audit_actor(), auth_role(),
            'เปลี่ยนขั้นลูกค้าเป้าหมาย ' || old.status::text || ' → ' || new.status::text,
            coalesce(new.dealer_code,'') || ' · ' || new.id || ' · ' || ป้าย);
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists trg_lead_audit on leads;
create trigger trg_lead_audit
  after insert or update or delete on leads
  for each row execute function public.log_lead_change();

-- ── ใบเสนอราคา ──────────────────────────────────────────────────────────────
create or replace function public.log_quotation_change() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare ป้าย text;
begin
  ป้าย := coalesce(new.customer, old.customer, '');
  if tg_op = 'INSERT' then
    insert into audit_log("user", role, action, target)
    values (audit_actor(), auth_role(), 'สร้างใบเสนอราคา',
            coalesce(new.dealer_code,'') || ' · ' || new.id || ' · ' || ป้าย);
  elsif tg_op = 'DELETE' then
    insert into audit_log("user", role, action, target)
    values (audit_actor(), auth_role(), 'ลบใบเสนอราคา',
            coalesce(old.dealer_code,'') || ' · ' || old.id || ' · ' || ป้าย);
  elsif new.status is distinct from old.status then
    insert into audit_log("user", role, action, target)
    values (audit_actor(), auth_role(),
            'เปลี่ยนสถานะใบเสนอราคา ' || old.status::text || ' → ' || new.status::text,
            coalesce(new.dealer_code,'') || ' · ' || new.id || ' · ' || ป้าย);
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists trg_quotation_audit on quotations;
create trigger trg_quotation_audit
  after insert or update or delete on quotations
  for each row execute function public.log_quotation_change();
