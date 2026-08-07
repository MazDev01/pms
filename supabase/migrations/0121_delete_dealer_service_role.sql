-- ── delete_dealer_atomic: ให้ฝั่งเซิร์ฟเวอร์ (service_role) เรียกได้ ────────────────
--
-- อาการ: ลบตัวแทนแล้วได้ 403 "ไม่มีสิทธิ์จัดการตัวแทน" ทั้งที่ผู้เรียกเป็นผู้ดูแลตัวจริง
--
-- สาเหตุ: ฟังก์ชันเช็ก can_write_master() ซึ่งดูจาก "ผู้ใช้ที่ล็อกอินอยู่" (auth.uid())
--   แต่ Route Handler เรียกด้วย service_role ซึ่งไม่มีผู้ใช้ผูกอยู่ → auth.uid() เป็นค่าว่าง
--   → can_write_master() เป็นเท็จ → ฟังก์ชันปฏิเสธคำขอของตัวเอง
--   (โค้ดเดิมลบผ่านตารางตรง ๆ ด้วย service_role ซึ่งข้าม RLS อยู่แล้ว จึงไม่เจอปัญหานี้)
--
-- แก้: ยอมให้ผ่านเมื่อ "ไม่มีผู้ใช้ผูกอยู่" = ถูกเรียกจากฝั่งเซิร์ฟเวอร์ด้วย service_role
--   ซึ่งเป็นคีย์ที่อยู่บนเซิร์ฟเวอร์เท่านั้น และ Route Handler ตรวจสิทธิ์ผู้เรียกไปแล้วก่อนถึงตรงนี้
--   (authorizeAdmin: ตรวจ JWT → อ่านบทบาทจาก profiles → เช็ก dealers:manage → เช็กสถานะบัญชี)
--   ส่วนผู้ใช้ที่ล็อกอินปกติยังต้องผ่าน can_write_master() เหมือนเดิมทุกประการ
create or replace function public.delete_dealer_atomic(p_code text)
returns table (member_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  t       text;
  n       integer;
  members uuid[];
begin
  -- auth.uid() ว่าง = เรียกจากเซิร์ฟเวอร์ด้วย service_role (ผ่านการตรวจสิทธิ์มาแล้วที่ชั้น route)
  if auth.uid() is not null and not can_write_master() then
    raise exception 'forbidden: no permission to delete dealer';
  end if;

  foreach t in array array['leads','quotations','customers','appointments','files','customer_notes'] loop
    execute format('select count(*) from %I where dealer_code = $1', t) into n using p_code;
    if n > 0 then
      raise exception 'dealer_has_data:%:%', t, n;
    end if;
  end loop;

  select coalesce(array_agg(id), '{}') into members from profiles where dealer_code = p_code;

  delete from responsible_persons where dealer_code = p_code;
  delete from dealer_lead_rules   where dealer_code = p_code;

  delete from dealers where code = p_code;
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'dealer_not_found:%', p_code;
  end if;

  return query select unnest(members);
end $$;

revoke all     on function public.delete_dealer_atomic(text) from public, anon;
grant  execute on function public.delete_dealer_atomic(text) to   authenticated;
