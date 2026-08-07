-- ── ยอดสะสมของลูกค้า ต้องตรงกับใบที่ปิดการขายได้เสมอ ─────────────────────────────
--
-- ปัญหา 1 — ปิดการขายพร้อมกันแล้วยอดหาย (ผลตรวจสอบระบบรอบ 2 · ระดับสูง)
--   reconcile_customer_won_total อ่านแถวลูกค้าโดยไม่ล็อก แล้วค่อยรวมยอดและเขียนทับ
--   ถ้าสองใบของลูกค้ารายเดียวกันถูกปิดพร้อมกัน ทั้งสองธุรกรรมรวมยอดจาก "ภาพ ณ เวลาของตัวเอง"
--   คนที่เขียนทีหลังอาจเขียนด้วยผลรวมที่ยังไม่เห็นใบของอีกคน → ยอดขายหายไปหนึ่งใบเงียบ ๆ
--   แก้ด้วย `for update` ที่แถวลูกค้า: ธุรกรรมที่สองรอคนแรกจบก่อน แล้วค่อยรวมยอดใหม่จากภาพล่าสุด
--
-- ปัญหา 2 — ไม่มีอะไรการันตีที่ชั้นฐานข้อมูล
--   ยอดลูกค้าถูกอัปเดตจาก "แอปเรียก reconcile ให้ถูกที่ถูกเวลา" เท่านั้น
--   ถ้ามีเส้นทางใดลืมเรียก (หรือเรียกไม่สำเร็จเพราะเน็ตหลุด) ยอดจะเพี้ยนค้างไว้โดยไม่มีใครรู้
--   เคยเกิดจริง: พบลูกค้าที่มียอดสะสมแต่ไม่มีใบเสนอราคาสักใบ
--   แก้ด้วย trigger ที่ฐานข้อมูล — ทุกครั้งที่ใบเสนอราคาถูกเพิ่ม/แก้/ลบ ระบบคำนวณยอดของลูกค้า
--   เจ้าของใบใหม่ให้เอง ไม่ต้องรอให้ใครเรียก

-- 1) ล็อกแถวลูกค้าก่อนรวมยอด
create or replace function public.reconcile_customer_won_total(p_customer_id bigint)
returns customers
language plpgsql security definer set search_path = public as $$
declare
  result customers;
begin
  -- for update = จองแถวนี้ไว้ก่อน ใครมาทีหลังต้องรอ แล้วจะได้อ่านภาพหลังคนแรกเขียนเสร็จ
  select * into result from customers
    where id = p_customer_id and dealer_code = auth_dealer()
    for update;
  if not found or not can_write_sales() then
    raise exception 'forbidden: no permission to reconcile customer %', p_customer_id;
  end if;

  update customers set total_value = coalesce((
    select sum(total_value) from quotations
    where customer_id = p_customer_id and dealer_code = result.dealer_code and status = 'won'
  ), 0)
  where id = p_customer_id and dealer_code = result.dealer_code
  returning * into result;

  return result;
end $$;

revoke execute on function public.reconcile_customer_won_total(bigint) from public, anon;
grant  execute on function public.reconcile_customer_won_total(bigint) to   authenticated;

-- 2) ตาข่ายที่ชั้นฐานข้อมูล — ใบเปลี่ยน ยอดลูกค้าเปลี่ยนตามทันที
create or replace function public.sync_customer_won_total()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  target_dealer text;
  target_customer bigint;
begin
  -- แถวเดียวอาจกระทบลูกค้าได้ 2 ราย ถ้ามีการย้ายใบข้ามลูกค้า (customer_id เปลี่ยน) — อัปเดตทั้งคู่
  for target_dealer, target_customer in
    select x.dc, x.cid from (
      select (case when tg_op <> 'INSERT' then old.dealer_code end) as dc,
             (case when tg_op <> 'INSERT' then old.customer_id end) as cid
      union
      select (case when tg_op <> 'DELETE' then new.dealer_code end),
             (case when tg_op <> 'DELETE' then new.customer_id end)
    ) x
    where x.dc is not null and coalesce(x.cid, 0) > 0
  loop
    update customers c
       set total_value = coalesce((
             select sum(q.total_value) from quotations q
             where q.customer_id = target_customer
               and q.dealer_code = target_dealer
               and q.status = 'won'
           ), 0)
     where c.id = target_customer and c.dealer_code = target_dealer;
  end loop;
  return null; -- after trigger: ค่าที่คืนไม่มีผล
end $$;

drop trigger if exists trg_sync_customer_won_total on public.quotations;
create trigger trg_sync_customer_won_total
after insert or update of status, total_value, customer_id, dealer_code or delete
on public.quotations
for each row execute function public.sync_customer_won_total();
