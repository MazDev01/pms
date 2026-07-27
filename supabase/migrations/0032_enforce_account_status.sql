-- Benjamin PMS — ทำให้ "ปิดใช้งาน" มีผลจริง (C4)
--
-- ปัญหา: ผู้ดูแลกดปิดใช้งานผู้ใช้ที่ /hq/users หรือปิดสาขาที่ /hq/dealers
--        หน้าจอเปลี่ยนเป็น "ปิดใช้งาน" · คอลัมน์ status ใน DB เปลี่ยนจริง
--        แต่คนนั้น "ยังล็อกอินได้และใช้งานได้เต็มสิทธิ์เหมือนเดิม"
--
--        เพราะไม่มีจุดไหนดู status เลยสักจุด:
--          • custom_access_token_hook อ่านแค่ role กับ dealer_code
--          • sbSignIn ไม่ตรวจอะไรหลัง GoTrue คืน session
--          • ไม่มี RLS policy ตัวใดใน 31 migration ที่อ้าง status
--
--        โหมด local ตรวจถูกมาตลอด (auth.ts บรรทัด 76 และ 94) — ความไม่ตรงกันนี้
--        คือเหตุผลที่อาการถูกมองข้ามมานาน
--
-- ตัวอย่างที่เกิดขึ้นจริงตอนตรวจ: สาขา HYI (บจ. หาดใหญ่สตีลกรุ๊ป) มี dealers.status = 'inactive'
-- มาตั้งแต่ต้น แต่ผู้ใช้ของสาขานั้นยังเข้าระบบและทำงานได้ทุกอย่าง
--
-- ══════════════════════════════════════════════════════════════════════════
-- ชั้นที่ 1 · ไม่ออก token ให้บัญชีที่ถูกปิด (ด่านหลัก)
-- ══════════════════════════════════════════════════════════════════════════
-- hook ทำงานทั้งตอนล็อกอินและตอนต่ออายุ token → ปิดที่นี่ที่เดียวได้ทั้งสองทาง
--
-- เงื่อนไข "ใช้งานได้" = โปรไฟล์ active  และ  (เป็นผู้ใช้ HQ  หรือ  สาขาที่สังกัด active)
-- สาขาถูกปิด = คนของสาขานั้นเข้าไม่ได้ทั้งสาขา — ตรงกับที่โหมด local ทำอยู่แล้ว
--
-- ⚠️ ความปลอดภัยของการแก้: เส้นทางของบัญชีที่ active ไม่เปลี่ยนเลยแม้แต่บรรทัดเดียว
--    สาขาที่เพิ่มเข้ามาทำงานเฉพาะกรณี inactive เท่านั้น
--    → ต่อให้รูปแบบ error payload ไม่ตรงกับที่ GoTrue คาดหวัง คนที่ยังใช้งานอยู่ก็ไม่ได้รับผล
--      และบัญชีที่ถูกปิดก็ยังไม่ได้ claim สิทธิ์อยู่ดี (RLS ปฏิเสธทุกอย่าง) = ล้มไปทางปลอดภัย
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  claims jsonb := coalesce(event -> 'claims', '{}'::jsonb);
  p record;
begin
  select pr.role                                as role,
         coalesce(pr.dealer_code, '')           as dealer_code,
         pr.status::text                        as user_status,
         coalesce(d.status::text, 'active')     as dealer_status
    into p
    from public.profiles pr
    left join public.dealers d on d.code = pr.dealer_code
   where pr.id = (event ->> 'user_id')::uuid;

  -- ไม่มีโปรไฟล์ = ไม่ใส่ claim สิทธิ์ให้ (พฤติกรรมเดิมของ 0005 — RLS จะปฏิเสธเอง)
  if not found then
    return jsonb_set(event, '{claims}', claims);
  end if;

  -- บัญชีหรือสาขาถูกปิด → ไม่ออก token
  if p.user_status <> 'active' or (p.dealer_code <> '' and p.dealer_status <> 'active') then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403,
      'message',   'บัญชีนี้ถูกปิดใช้งาน — กรุณาติดต่อผู้ดูแลระบบ'));
  end if;

  claims := jsonb_set(claims, '{user_role}',   to_jsonb(p.role::text));
  claims := jsonb_set(claims, '{dealer_code}', to_jsonb(p.dealer_code));
  return jsonb_set(event, '{claims}', claims);
end;
$$;

grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;

-- ══════════════════════════════════════════════════════════════════════════
-- ชั้นที่ 2 · ปิดการ "เขียน" ทันที ไม่ต้องรอ token หมดอายุ
-- ══════════════════════════════════════════════════════════════════════════
-- ชั้นที่ 1 กันการออก token ใหม่ได้ แต่ token ที่ออกไปก่อนหน้ายังใช้ได้จนหมดอายุ
-- (ค่าเริ่มต้นของ Supabase = 1 ชั่วโมง) — ธรรมชาติของ JWT ที่ไม่มีบัญชีดำ
--
-- สำหรับ "การอ่าน" ยอมรับช่วงนี้ได้ แต่ "การเขียน" ไม่ควรรอ
-- จึงให้ตัวตัดสินสิทธิ์เขียนทั้งสองตัวถามสถานะสด ๆ จากตารางแทนการเชื่อ claim ใน token
--
-- security definer: ต้องข้าม RLS ของ profiles ไม่งั้นจะวนกลับมาเรียกตัวเอง
--   (profiles_read เรียก is_hq() → auth_role() → ถ้าอ่าน profiles อีกก็วนไม่จบ)
-- stable + ไม่มีพารามิเตอร์: Postgres ประเมินครั้งเดียวต่อคำสั่ง ไม่ใช่ต่อแถว
create or replace function public.is_account_active() returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select pr.status = 'active'
       and (pr.dealer_code = '' or exists (
              select 1 from dealers d
               where d.code = pr.dealer_code and d.status = 'active'))
      from profiles pr
     where pr.id = auth.uid()
  ), false)
$$;

revoke execute on function public.is_account_active() from public;
grant  execute on function public.is_account_active() to   authenticated;

-- ผูกเข้ากับตัวตัดสินสิทธิ์เขียนทั้งสองตัว — ไม่ต้องแก้ policy สักใบ
-- เพราะทุก policy เขียนในระบบเดินผ่านสองฟังก์ชันนี้อยู่แล้ว (0015 · 0017 · 0024 · 0028)
create or replace function can_write_master() returns boolean
  language sql stable as $$
    select auth_role() in ('SUPER_ADMIN', 'HQ_MANAGEMENT') and public.is_account_active()
  $$;

create or replace function can_write_sales() returns boolean
  language sql stable as $$
    select auth_role() in ('DEALER_ADMIN', 'DEALER_SALES') and public.is_account_active()
  $$;

-- ══════════════════════════════════════════════════════════════════════════
-- ที่ "ยังเหลืออยู่" และแก้ที่นี่ไม่ได้ — ต้องบอกให้ชัด ไม่ใช่ปล่อยให้เข้าใจว่าปิดสนิทแล้ว
-- ══════════════════════════════════════════════════════════════════════════
--   • token ที่ออกไปแล้วยัง "อ่าน" ข้อมูลได้จนหมดอายุ (สูงสุด ~1 ชม.)
--     การตัดทันทีต้องเพิกถอน session ที่ระบบยืนยันตัวตน ซึ่งต้องใช้ service_role
--     = ต้องมีชั้นเซิร์ฟเวอร์ก่อน (ข้อเสนอ R2) · การเขียนถูกตัดทันทีแล้วด้วยชั้นที่ 2
--   • dealer_lead_rules_write ยอมให้ `dealer_code = auth_dealer()` เขียนได้ตรง ๆ
--     โดยไม่ผ่าน can_write_sales() (มาตั้งแต่ 0008/0015) — สาขาที่เพิ่งถูกปิด
--     ยังแก้กฎติดตามของตัวเองได้จนกว่า token จะหมดอายุ ผลกระทบต่ำมากจึงไม่แตะในใบนี้
