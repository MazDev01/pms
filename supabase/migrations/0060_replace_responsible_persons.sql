-- Benjamin PMS — replace_responsible_persons: แทนที่พนักงานขายของสาขาแบบ atomic
--
-- เดิม (adapter persons.save): delete ของสาขา แล้ว insert ใหม่ = 2 คำสั่งแยก ไม่มี transaction
--   crash/เน็ตหลุดกลางทาง (ลบแล้วยังไม่ insert) = พนักงานขายของสาขาหายทั้งชุด
--
-- แก้: ทำใน RPC เดียว (ฟังก์ชัน = 1 transaction) — ลบ+ใส่ใหม่สำเร็จหรือล้มเหลวพร้อมกัน
--   security definer → self-enforce สิทธิ์เหมือน RLS ของ responsible_persons (เจ้าของสาขาเท่านั้น)

create or replace function public.replace_responsible_persons(p_dealer text, p_rows jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- สิทธิ์: แก้ได้เฉพาะพนักงานของ "สาขาตัวเอง" (ตรงกับ policy responsible_persons_write ใน 0002)
  if p_dealer is distinct from auth_dealer() then
    raise exception 'ไม่มีสิทธิ์แก้พนักงานขายของสาขานี้';
  end if;

  delete from responsible_persons where dealer_code = p_dealer;

  insert into responsible_persons (dealer_code, name, title, phone, email, active, avatar)
  select p_dealer,
         r->>'name',
         r->>'title',
         r->>'phone',
         r->>'email',
         coalesce((r->>'active')::boolean, true),
         nullif(r->>'avatar', '')
  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) as r;
end $$;

revoke execute on function public.replace_responsible_persons(text, jsonb) from public;
grant  execute on function public.replace_responsible_persons(text, jsonb) to authenticated;
