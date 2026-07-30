-- ยอดลูกค้า (customers.total_value) อาจ stale ตอนแก้สถานะ "won" ของ 2 ใบพร้อมกัน (2 แท็บ/2 คน)
--   พบจากผลตรวจสอบระบบ 30 ก.ค. 69 (Medium, ยืนยันจากอ่านโค้ด — reconcileCustomerTotal เดิมคำนวณ
--   wonTotal จาก quotationsRef.current ของฝั่ง client (สแนปช็อตในเครื่อง) แล้ว UPDATE ทับตรง ๆ
--   ไม่มีการล็อก/อ่านสดจาก DB เลย — ถ้าอีกแท็บเพิ่งปิดใบอื่นสำเร็จแต่แท็บนี้ยังไม่รู้ (ยังไม่ sync)
--   ผลรวมที่คำนวณจะไม่รวมใบนั้น → เขียนทับด้วยยอดที่ขาดไป (แพ้ทางไทม์มิ่ง ไม่ใช่ merge)
--
-- แก้แบบเดียวกับ upsert_customer_for_company (0074): ย้ายการคำนวณไปทำที่ DB ในสเตตเมนต์เดียว
--   (subquery ใน UPDATE เดียวกัน) แทนที่จะพึ่ง snapshot ฝั่ง client — ไม่ว่าจะสลับลำดับกันยังไง
--   ผลลัพธ์สุดท้ายคือผลรวมจริงของใบ won ทั้งหมด ณ ตอนนั้นเสมอ (self-correcting ไม่ใช่ merge เพราะไม่ต้อง merge)
create or replace function public.reconcile_customer_won_total(p_customer_id bigint)
returns customers
language plpgsql security definer set search_path = public as $$
declare
  result customers;
begin
  select * into result from customers where id = p_customer_id;
  if not found then
    raise exception 'customer % not found', p_customer_id;
  end if;
  if not (can_write_sales() and result.dealer_code = auth_dealer()) then
    raise exception 'forbidden: no permission to reconcile customer %', p_customer_id;
  end if;

  update customers set total_value = coalesce((
    select sum(total_value) from quotations
    where customer_id = p_customer_id and status = 'won'
  ), 0)
  where id = p_customer_id
  returning * into result;

  return result;
end $$;

revoke execute on function public.reconcile_customer_won_total(bigint) from public;
grant  execute on function public.reconcile_customer_won_total(bigint) to   authenticated;
