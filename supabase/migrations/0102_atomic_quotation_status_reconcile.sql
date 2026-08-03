-- Benjamin PMS — แก้ยอดขายลูกค้าค้างที่ 0 บางครั้งหลังปิดการขายสำเร็จ (พบจากทดสอบโหลดรอบ 2, 3 ส.ค. 69)
--
-- ปัญหา: เส้นทาง "ตอบรับ/ปฏิเสธ" ของใบเสนอราคาที่ "มี customer_id ผูกอยู่แล้ว" (ต่างจากเส้นทางปิดจากลิ้นชักลีด
--   ที่ใช้ close_won_quotation ทั้งก้อนอยู่แล้ว) ฝั่ง SalesContext.tsx เดิมเรียก 2 คำขอแยกกัน:
--     1) quotations.setStatus(id, status)         — REST call แยก
--     2) customers.reconcileWonTotal(customerId)  — RPC call แยกอีกที
--   ทั้งสองคำขอ "ไม่ได้อยู่ในทรานแซกชันเดียวกัน" ภายใต้โหลดสูง (20+ ทำพร้อมกัน) พบว่า reconcile
--   บางครั้งคำนวณได้ 0 ทั้งที่ setStatus ไปก่อนหน้าแล้วจริง — ยืนยันจาก log ทดสอบ ไม่มี error ใด ๆ โผล่เลย
--   (isTransientNetworkError ไม่จับ เพราะไม่ใช่ error เครือข่าย) ชี้ว่าเป็นช่องว่างจังหวะเวลาระหว่าง 2 คำขอ
--   ไม่ใช่ปัญหาเน็ตสะดุดแบบที่ withNetworkRetry (เพิ่มไปก่อนหน้านี้ในวันเดียวกัน) ออกแบบมาแก้
--
-- แก้: รวม "เปลี่ยนสถานะ + คำนวณยอดลูกค้าใหม่" เป็น RPC เดียวแบบ atomic (ทรานแซกชันเดียว) — ตัดช่องว่าง
--   จังหวะเวลาทิ้งไปเลยแทนที่จะพยายามลองใหม่ (ลองใหม่แก้ไม่ได้ถ้าปัญหาคือจังหวะเวลา ไม่ใช่คำขอล้มเหลว)
create or replace function public.set_quotation_status_reconciled(p_quote_id text, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  q    quotations;
  cust customers;
  result jsonb;
begin
  if not can_write_sales() then
    raise exception 'forbidden: no permission to update quotation status';
  end if;

  update quotations set status = p_status
    where id = p_quote_id and dealer_code = auth_dealer()
    returning * into q;

  if not found then
    raise exception 'quotation % not found for dealer %', p_quote_id, auth_dealer();
  end if;

  -- รวมยอดใหม่เฉพาะใบที่ผูกลูกค้าไว้แล้ว (ใบที่ยังไม่มี customer_id ไม่เกี่ยวกับ reconcile)
  if q.customer_id is not null and q.customer_id > 0 then
    cust := reconcile_customer_won_total(q.customer_id);
  end if;

  select jsonb_build_object('quotation', to_jsonb(q), 'customer', to_jsonb(cust)) into result;
  return result;
end $$;

revoke all on function public.set_quotation_status_reconciled(text, text) from public, anon;
grant execute on function public.set_quotation_status_reconciled(text, text) to authenticated;
