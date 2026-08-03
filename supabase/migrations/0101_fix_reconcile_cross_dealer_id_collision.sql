-- Benjamin PMS — แก้บั๊กร้ายแรงที่พบจากทดสอบโหลดจริง 10 สาขาพร้อมกัน (3 ส.ค. 69)
--
-- ปัญหา: reconcile_customer_won_total(p_customer_id) — 0096 แก้แค่ครึ่งเดียว: ครึ่งแรก (select ...
--   into result เพื่อเช็คสิทธิ์) สโคปด้วย dealer_code = auth_dealer() ถูกต้องแล้ว แต่ครึ่งหลัง
--   (subquery รวมยอด + UPDATE ที่เขียนค่าจริง) ยังใช้ "where id = p_customer_id" เปลือย ๆ
--   ไม่ผูก dealer_code เลย — customers.id เป็นเลขนับ "ต่อสาขา" (composite PK dealer_code+id)
--   ลูกค้ารายแรกของทุกสาขาได้ id=1 เหมือนกันหมดโดยตั้งใจ (ออกแบบปกติของระบบ)
--
-- ผลที่ยืนยันจริงจากทดสอบ (10 สาขาปิดการขายสำเร็จพร้อมกัน — เจอ 5/5 ครั้งที่ทดสอบ = 100%):
--   ทันทีที่มี ≥2 สาขามีลูกค้า id ชนกัน (แทบจะเกิดเสมอ เพราะลูกค้ารายแรก ๆ ของทุกสาขาคือ 1,2,3...)
--   UPDATE ... RETURNING INTO result จะพังด้วย "query returned more than one row" (Postgres ปฏิเสธ
--   ไม่ยอม assign หลายแถวใส่ตัวแปรแถวเดียว) ธุรกรรมทั้งก้อน rollback → ยอดลูกค้า (total_value) ค้าง
--   ที่ค่าเดิม (มักเป็น 0) ทั้งที่ปิดการขายสำเร็จไปแล้วจริง สถานะใบเสนอราคาเองยังบันทึก "won" ถูกต้อง
--   (คนละ statement แยกกัน ไม่ได้ rollback ไปด้วย) — โชคดีที่ Postgres เลือก "พังทั้งก้อน" แทนที่จะ
--   เขียนทับข้อมูลผิดสาขาแบบเงียบ ๆ (ป้องกันเองโดยไม่ตั้งใจ) แต่ผลลัพธ์ที่ตัวแทนเห็นคือยอดขายไม่อัปเดต
--
-- กระทบทั้งสองช่องทางปิดการขายสำเร็จในระบบ (เรียก reconcile_customer_won_total ตัวเดียวกัน):
--   close_won_quotation (0094/0095, จากลิ้นชักลีด) และเส้นทางจากหน้าใบเสนอราคาโดยตรง
--
-- แก้: ผูก dealer_code = result.dealer_code (ได้ค่าจริงจากแถวที่เช็คสิทธิ์ผ่านแล้วด้านบน) ทั้ง subquery
--   รวมยอดและ UPDATE ที่เขียนค่า — ให้ตรงเฉพาะแถว/ใบของสาขานั้นจริง ๆ ไม่ชนข้ามสาขาอีกต่อไป
create or replace function public.reconcile_customer_won_total(p_customer_id bigint)
returns customers
language plpgsql security definer set search_path = public as $$
declare
  result customers;
begin
  select * into result from customers
    where id = p_customer_id and dealer_code = auth_dealer();
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
