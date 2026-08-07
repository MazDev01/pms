-- ── ลบตัวแทนให้เป็น "ธุรกรรมเดียว" — สำเร็จทั้งหมด หรือไม่เกิดอะไรเลย ────────────
--
-- ปัญหาเดิม (ผลตรวจสอบระบบรอบ 2 · Part 8): ฝั่งเซิร์ฟเวอร์ยิงคำสั่งลบทีละก้อนแยกกัน
--   1) ลบ responsible_persons   ← ไม่เช็กผลด้วย
--   2) ลบ dealer_lead_rules     ← ไม่เช็กผลด้วย
--   3) ลบแถว dealers            ← ถ้าพลาดตรงนี้ สองก้อนแรกหายไปแล้วและกู้กลับไม่ได้
--   ผลคือสาขายังอยู่ แต่ผู้รับผิดชอบและกฎติดตามของสาขาหายเกลี้ยง โดยหน้าจอแจ้งว่า "ลบไม่สำเร็จ"
--   ผู้ดูแลจึงไม่รู้เลยว่ามีของหายไปแล้ว
--
-- ย้ายทั้งชุดมาไว้ในฟังก์ชันเดียว = อยู่ในธุรกรรมเดียวกันโดยอัตโนมัติ
--   ถ้าขั้นไหนพัง ฐานข้อมูลจะย้อนกลับให้ทั้งหมดเอง ไม่มีสภาพ "ลบครึ่งทาง" อีก
--
-- คืนรายชื่อบัญชีที่ต้องลบตามให้ผู้เรียก — การลบบัญชีเข้าระบบทำใน SQL ไม่ได้
-- (อยู่คนละสคีมาและย้อนไม่ได้) จึงยังทำที่ฝั่งเซิร์ฟเวอร์ "หลัง" ธุรกรรมนี้สำเร็จแล้วเท่านั้น
create or replace function public.delete_dealer_atomic(p_code text)
returns table (member_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  t text;
  n integer;
begin
  if not can_write_master() then
    raise exception 'forbidden: no permission to delete dealer';
  end if;

  -- ต้องไม่มีข้อมูลงานขายค้างอยู่เลย (FK เป็น on delete restrict อยู่แล้ว แต่เช็กก่อนเพื่อ
  -- ให้ข้อความบอกได้ว่าติดตารางไหน แทนที่จะโยน error ของฐานข้อมูลดิบ ๆ ให้ผู้ใช้อ่าน)
  foreach t in array array['leads','quotations','customers','appointments','files','customer_notes'] loop
    execute format('select count(*) from %I where dealer_code = $1', t) into n using p_code;
    if n > 0 then
      raise exception 'dealer_has_data:%:%', t, n;
    end if;
  end loop;

  -- เก็บรายชื่อบัญชีไว้ก่อนลบ (หลังลบแถว dealers จะหาไม่เจอแล้ว)
  create temp table if not exists _members_to_delete (id uuid) on commit drop;
  delete from _members_to_delete;
  insert into _members_to_delete select id from profiles where dealer_code = p_code;

  delete from responsible_persons where dealer_code = p_code;
  delete from dealer_lead_rules   where dealer_code = p_code;

  delete from dealers where code = p_code;
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'dealer_not_found:%', p_code;
  end if;

  return query select id from _members_to_delete;
end $$;

revoke all     on function public.delete_dealer_atomic(text) from public, anon;
grant  execute on function public.delete_dealer_atomic(text) to   authenticated;
