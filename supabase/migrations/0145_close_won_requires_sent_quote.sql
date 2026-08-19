-- ── ปิดการขายสำเร็จต้องมีใบเสนอราคาที่ส่งถึงลูกค้าแล้ว ────────────────────────────
--
-- พบจากการทดสอบหาบั๊ก (19 ส.ค. 69) แล้วบอสสั่งให้ล็อกแบบเข้มสุด:
--   ลูกค้าเป้าหมายที่ยังอยู่ขั้น "รวบรวมความต้องการ" กดปุ่ม "ได้งาน" ได้ทันที
--   → ระบบสร้างลูกค้าใหม่ยอดสะสม ฿0 ใบผูก 0 ใบ เข้าฐานข้อมูล
--   ผลคือ "อัตราปิดการขาย" และ "ยอดขาย" ในรายงานนับดีลที่ไม่มีมูลค่าจริงเข้าไปด้วย
--
-- ขัดกับกติกาที่ระบบมีอยู่แล้ว: ขั้น "เสนอราคา" บังคับว่าต้องมีใบจริงถึงจะเลื่อนขั้นได้ (0089 + ด่านฝั่งแอป)
--   แต่ปุ่มปิดการขายข้ามด่านนั้นไปเลย — ปิดจากขั้นไหนก็ได้
--
-- กติกาที่บังคับในใบนี้: ต้องมีใบของสาขานั้นที่ผูกกับดีล/ชื่อบริษัทเดียวกัน
--   และสถานะไม่ใช่ 'draft' (คือส่งถึงลูกค้าแล้ว / ตอบรับแล้ว) อย่างน้อย 1 ใบ
--   · ใบเป้าหมายที่กำลังกด (p_target_quote_id) นับด้วย — เส้นทาง "ลูกค้าตอบรับ" จากหน้าใบเสนอราคา
--     กดจากตัวใบเองอยู่แล้ว ใบนั้นมีจริงแน่นอน จึงต้องผ่านได้
--
-- หน้าจอกันไว้แล้วทั้งสองทาง (ปุ่ม "ได้งาน" ถูกปิดพร้อมบอกเหตุผล · เปลี่ยนสถานะเป็นปิดการขายจะพาไปออก/ส่งใบ)
-- ใบนี้คือด่านสุดท้ายที่ฐานข้อมูล — กันเส้นทางอื่นในอนาคตและการยิงคำสั่งตรง
create or replace function public.close_won_quotation(
  p_dealer             text,
  p_known_customer_id  bigint,
  p_lead_company       text,
  p_target_quote_id    text,
  p_cascade_won        boolean,
  p_customer_payload   jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cust   customers;
  result jsonb;
begin
  if not (can_write_sales() and p_dealer = auth_dealer()) then
    raise exception 'forbidden: no permission to close won for %', p_dealer;
  end if;

  -- ── ด่านใหม่: ต้องมีใบที่ส่งถึงลูกค้าแล้วอย่างน้อยหนึ่งใบ ──
  if p_target_quote_id is null and not exists (
    select 1 from quotations q
     where q.dealer_code = p_dealer
       and q.customer = p_lead_company
       and q.status <> 'draft'
  ) then
    raise exception 'no_sent_quotation: ปิดการขายสำเร็จไม่ได้ — ยังไม่มีใบเสนอราคาที่ส่งถึงลูกค้า';
  end if;

  if p_known_customer_id is not null then
    select * into cust from customers where dealer_code = p_dealer and id = p_known_customer_id;
  end if;

  if cust.id is null then
    cust := upsert_customer_for_company(p_dealer, p_customer_payload);
  end if;

  perform relink_customer_quotes(p_dealer, cust.id, p_lead_company, p_cascade_won);

  if p_target_quote_id is not null then
    update quotations set customer_id = cust.id, status = 'won'
     where dealer_code = p_dealer and id = p_target_quote_id;
  end if;

  cust := reconcile_customer_won_total(cust.id);

  -- ใบที่เกี่ยวข้องทั้งหมด: ตรงชื่อบริษัท (ทั้งที่เพิ่ง relink และที่เคยผูกอยู่ก่อนแล้วจากการปิดดีลก่อนหน้า)
  -- หรือคือใบเป้าหมายที่กำลังกด — ครอบทั้ง cascade case และ single-target case ในคำสั่งเดียว
  select jsonb_build_object(
    'customer', to_jsonb(cust),
    'quotations', coalesce(jsonb_agg(q), '[]'::jsonb)
  ) into result
  from quotations q
  where q.dealer_code = p_dealer and q.customer_id = cust.id
    and (q.customer = p_lead_company or q.id = p_target_quote_id);

  return result;
end $$;

revoke all on function public.close_won_quotation(text,bigint,text,text,boolean,jsonb) from public;
grant execute on function public.close_won_quotation(text,bigint,text,text,boolean,jsonb) to authenticated;
