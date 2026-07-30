-- Benjamin PMS — เก็บกวาดจากผลตรวจสอบระบบเต็มรูปแบบ (Database engineer, 30 ก.ค. 69)
--
-- บั๊กที่ยืนยันจริง: ปิดการขายลีดเดียวกันพร้อมกันจาก 2 session (เช่น เปิด 2 แท็บ หรือ retry
-- ตอนเน็ตช้า) สร้างลูกค้าซ้ำ 2 แถวจากการปิดครั้งเดียว — เพราะ "เช็คว่ามีลูกค้าชื่อนี้อยู่แล้วไหม"
-- (matchCustomers ใน convertLeadToCustomer, SalesContext.tsx) เป็น check-then-act ฝั่ง client
-- ล้วนๆ อ่านจาก state ในเครื่องของแต่ละแท็บเอง ไม่มี lock ระดับ DB มารองรับ "หนึ่งบริษัท = หนึ่ง
-- ลูกค้าต่อสาขา" ที่โค้ดตั้งใจไว้ (ต่างจากบั๊ก race ที่แก้ไปแล้วเมื่อเช้า ซึ่งเป็นการเขียนไม่ atomic
-- ภายในการเรียกครั้งเดียว — อันนี้คือแข่งกันข้าม 2 การเรียกที่แยกอิสระ ไม่มีเซฟตี้เน็ตรับเลย)
--
-- แก้: ย้าย "หาลูกค้าเดิมหรือสร้างใหม่" ไปเป็นทรานแซกชันเดียวที่ DB ตามแบบ create_quotation (0034)
-- ใช้ pg_advisory_xact_lock คีย์ (สาขา, ชื่อบริษัทที่ normalize แล้ว) กันเรียกพร้อมกันสำหรับบริษัท
-- เดียวกันชนกัน — เรียกสำหรับบริษัทคนละชื่อไม่ถูกบล็อกกัน (lock คีย์ต่างกัน)
--
-- ครอบคลุมเฉพาะกรณี "ชื่อตรงเป๊ะ" (matchCustomers().exact เดิม) — กรณี "คล้ายกัน" ยังคงเป็น
-- คำเตือนที่หน้าจอให้ผู้ใช้ยืนยันเองเหมือนเดิม ไม่เกี่ยวกับ race นี้
create or replace function public.upsert_customer_for_company(p_dealer text, p_payload jsonb)
returns customers
language plpgsql
security definer
set search_path = public
as $$
declare
  existing     customers;
  result       customers;
  n            bigint;
  norm_company text;
begin
  if not (can_write_sales() and p_dealer = auth_dealer()) then
    raise exception 'forbidden: no permission to create customer for %', p_dealer;
  end if;
  if p_dealer is null or p_dealer = '' then
    raise exception 'forbidden: empty dealer';
  end if;

  norm_company := lower(regexp_replace(btrim(p_payload->>'company'), '\s+', ' ', 'g'));
  if norm_company = '' then
    raise exception 'invalid: empty company name';
  end if;

  -- serialize เฉพาะการเรียกที่ชนกันจริง (สาขาเดียวกัน + ชื่อบริษัทเดียวกัน) — ปลดล็อกอัตโนมัติ
  -- ตอนจบทรานแซกชัน (xact lock) ไม่ต้องปลดเอง
  perform pg_advisory_xact_lock(hashtextextended(p_dealer || '|' || norm_company, 0));

  select * into existing from customers
    where dealer_code = p_dealer
      and lower(regexp_replace(btrim(company), '\s+', ' ', 'g')) = norm_company
    limit 1;
  if found then
    return existing; -- มีอยู่แล้ว → คืนของเดิม ไม่สร้างซ้ำ (ผู้เรียกไปผูก/relink ใบเสนอราคาต่อเอง)
  end if;

  n := next_entity_id(p_dealer, 'customers');
  insert into customers
    select * from jsonb_populate_record(
      null::customers,
      p_payload || jsonb_build_object('id', n, 'dealer_code', p_dealer, 'created_at', now()))
    returning * into result;

  return result;
end $$;

revoke execute on function public.upsert_customer_for_company(text, jsonb) from public;
grant   execute on function public.upsert_customer_for_company(text, jsonb) to   authenticated;
