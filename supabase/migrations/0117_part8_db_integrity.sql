-- ── ความรัดกุมของฐานข้อมูล 2 เรื่อง (ผลตรวจสอบระบบรอบ 2 · Part 8) ────────────────

-- ══════════════════════════════════════════════════════════════════════════
-- 1) save_dealers ต้อง "อัปเดตอย่างเดียว" — ห้ามสร้างสาขาใหม่
-- ══════════════════════════════════════════════════════════════════════════
-- ปัญหา: ฟังก์ชันนี้เป็น upsert (ไม่มีก็สร้างให้) ทั้งที่หน้าที่จริงคือ "บันทึกการแก้ไข"
--   การสร้างสาขาที่ถูกต้องต้องผ่าน /api/admin/dealers ซึ่งสร้าง "บัญชีเข้าระบบ" คู่กันเสมอ
--   ถ้าสร้างผ่านทางนี้ได้ จะได้แถวสาขาที่ไม่มีบัญชีเข้าระบบ = "สาขาผี" ที่ไม่มีใครเข้าได้
--   และไม่มีใครรู้ตัวจนกว่าจะมีคนถามหา (บั๊กชนิดเดียวกับที่ไล่ปิดไปหลายรอบในระบบนี้)
--
-- เปลี่ยนเป็น update ล้วน ๆ และคืนจำนวนแถวที่แก้จริง เพื่อให้ผู้เรียกจับได้ว่ามีรหัสที่ไม่มีอยู่จริง
-- (ของเดิมคืน void — เรียกด้วยรหัสมั่ว ๆ ก็ผ่านเงียบ ๆ)
-- ⚠️ ต้อง drop ก่อน — เดิมคืน void การเปลี่ยนชนิดค่าที่คืนทำผ่าน create or replace ไม่ได้
--    (Postgres ปฏิเสธ: cannot change return type of existing function)
drop function if exists public.save_dealers(jsonb);
create or replace function public.save_dealers(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb;
  touched integer := 0;
  n integer;
begin
  if not can_write_master() then
    raise exception 'forbidden: no permission to write dealers';
  end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    update dealers set
      name           = r->>'name',
      province       = r->>'province',
      region         = r->>'region',
      status         = coalesce(r->>'status', 'active')::dealer_status,
      revenue_target = greatest(coalesce(nullif(r->>'revenue_target', '')::numeric, 0), 0)
    where code = r->>'code';
    get diagnostics n = row_count;
    touched := touched + n;
  end loop;

  return touched;
end $$;

revoke all    on function public.save_dealers(jsonb) from public, anon;
grant  execute on function public.save_dealers(jsonb) to   authenticated;

-- ══════════════════════════════════════════════════════════════════════════
-- 2) ห้ามลบ/ลดสิทธิ์ "ผู้ดูแลสูงสุดคนสุดท้าย"
-- ══════════════════════════════════════════════════════════════════════════
-- ตอนนี้ระบบมีผู้ดูแลสูงสุด (SUPER_ADMIN) เพียงคนเดียว — ถ้าบัญชีนั้นถูกลบหรือถูกลดบทบาท
-- จะไม่เหลือใครจัดการระบบได้เลย และกู้คืนจากหน้าจอไม่ได้ ต้องเข้าไปแก้ที่ฐานข้อมูลโดยตรง
-- ด่านนี้อยู่ที่ฐานข้อมูล จึงกันได้ทุกช่องทาง รวมถึงคำสั่งที่ใช้ service_role (ซึ่งข้าม RLS ได้)
create or replace function public.guard_last_super_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare remaining integer;
begin
  -- สนใจเฉพาะกรณีที่ "เลิกเป็นผู้ดูแลสูงสุด": ถูกลบ · เปลี่ยนบทบาท · ถูกปิดการใช้งาน
  if tg_op = 'UPDATE'
     and new.role = 'SUPER_ADMIN' and new.status = 'active' then
    return new;
  end if;
  if old.role <> 'SUPER_ADMIN' or old.status <> 'active' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  select count(*) into remaining
  from profiles
  where role = 'SUPER_ADMIN' and status = 'active' and id <> old.id;

  if remaining = 0 then
    raise exception 'ห้ามลบหรือลดสิทธิ์ผู้ดูแลสูงสุดคนสุดท้าย — ต้องตั้งผู้ดูแลสูงสุดคนใหม่ก่อน';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end $$;

drop trigger if exists trg_guard_last_super_admin on public.profiles;
create trigger trg_guard_last_super_admin
before update or delete on public.profiles
for each row execute function public.guard_last_super_admin();
