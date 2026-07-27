-- Benjamin PMS — ออกเลขที่ใบเสนอราคา + insert ใน "ทรานแซกชันเดียว" (H8 ราก)
--
-- ปัญหา: เดิมแอปทำ 2 สเต็ปแยกกัน
--   1) newQuoteId() → RPC next_quote_no  (เดินตัวนับ คืนเลข "Q-2026-0001")
--   2) insert quotations ด้วยเลขนั้น      (ยิงตามหลัง)
-- ถ้าสเต็ป 2 ล้ม (เน็ตหลุด/คอนสเทรนต์) เลขที่สเต็ป 1 เดินไปแล้ว "หายเฉย ๆ"
-- → เลขที่ใบเสนอราคามีช่องว่าง (เป็นปัญหาเชิงเอกสาร/บัญชี)
-- การกันกดซ้ำ (ref ที่ฝั่งแอป) แก้ "double-click" ได้ แต่ไม่แก้ "insert ล้มหลังออกเลข"
--
-- แก้: รวมออกเลข+insert เป็นฟังก์ชันเดียว = ทรานแซกชันเดียว
--   insert ล้ม → ทั้งฟังก์ชัน rollback → ตัวนับ "ไม่เดิน" → ไม่มีเลขหาย
--
-- ⚠️ security definer: ต้องแตะ quote_counters ที่ปิด RLS ไว้ (0031) จึงต้องรันในสิทธิ์เจ้าของ
--   และเพราะ insert จะข้าม RLS ของ quotations ไปด้วย → ต้อง "บังคับสิทธิ์เอง" ให้เท่ากับ
--   นโยบายเขียนปกติ (can_write_sales ∧ สาขาตัวเอง) ก่อนทุกครั้ง · ไม่ให้สิทธิ์เกินการ insert ธรรมดา
create or replace function public.create_quotation(p_dealer text, p_prefix text, p_payload jsonb)
returns quotations
language plpgsql
security definer
set search_path = public
as $$
declare
  n      integer;
  num    text;
  result quotations;
begin
  -- สิทธิ์ต้องเท่ากับ policy quotations_write เดิม (0017): ขายได้ + สาขาตัวเอง · หรือผู้ดูแลข้อมูลกลาง
  if not ((can_write_sales() and p_dealer = auth_dealer()) or can_write_master()) then
    raise exception 'forbidden: no permission to create quotation for %', p_dealer;
  end if;
  if p_dealer is null or p_dealer = '' then
    raise exception 'forbidden: empty dealer';
  end if;

  -- ออกเลขที่ใบ (atomic ต่อสาขา) — เดินตัวนับใน "ทรานแซกชันเดียวกับ" การ insert ข้างล่าง
  insert into quote_counters(dealer_code, next_no) values (p_dealer, 2)
    on conflict (dealer_code) do update set next_no = quote_counters.next_no + 1
    returning next_no - 1 into n;
  num := coalesce(nullif(p_prefix, ''), 'Q-2026-') || lpad(n::text, 4, '0');

  -- jsonb_populate_record: map payload → แถว quotations อัตโนมัติ (ทนต่อการเพิ่มคอลัมน์)
  --   บังคับ id = เลขที่เพิ่งออก · dealer_code = สาขาผู้เรียก · created_at = เวลาจริงของ DB
  --   (คีย์อื่นใน payload ที่ client ตั้งได้อยู่แล้วผ่าน insert ปกติ จึงไม่ได้ให้สิทธิ์เพิ่ม)
  insert into quotations
    select * from jsonb_populate_record(
      null::quotations,
      p_payload || jsonb_build_object('id', num, 'dealer_code', p_dealer, 'created_at', now()))
    returning * into result;

  return result;
end $$;

revoke execute on function public.create_quotation(text, text, jsonb) from public;
grant   execute on function public.create_quotation(text, text, jsonb) to   authenticated;
