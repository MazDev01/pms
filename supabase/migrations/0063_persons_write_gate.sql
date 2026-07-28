-- Benjamin PMS — ปิดช่องสิทธิ์ของ replace_responsible_persons (0060) ให้ผ่าน can_write_sales()
--
-- 0060 (security definer) กันแค่ p_dealer = auth_dealer() → บทบาทใดก็ได้ในสาขา (รวม DEALER_SITE ที่
--   เขียนงานขายไม่ได้) และสาขาที่เพิ่งถูกปิด (token ยังไม่หมดอายุ) ยังแทนที่รายชื่อพนักงานได้
--   = ช่องเดียวกับที่ 0058 ปิดให้ dealer_lead_rules · เป็น RPC เดียวที่ self-enforce น้อยกว่าเพื่อน
--
-- แก้: ต้องเป็น "เจ้าของสาขา + มีสิทธิ์เขียนงานขาย" (can_write_sales() = DEALER_ADMIN/DEALER_SALES ∧
--   is_account_active() ตาม 0032) — ตรงกับ policy persons_write (0017)

create or replace function public.replace_responsible_persons(p_dealer text, p_rows jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- สิทธิ์: เจ้าของสาขา + มีสิทธิ์เขียนงานขาย (กัน DEALER_SITE / บัญชี-สาขาที่ถูกปิด)
  if p_dealer is distinct from auth_dealer() or not can_write_sales() then
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
