-- ── ตัวคำนวณยอดลูกค้า: ต้องจองแถวก่อนคำนวณ ไม่งั้นยอดยังหายตอนทำพร้อมกัน ────────────
--
-- 0114 เพิ่ม trigger ให้ฐานข้อมูลคำนวณยอดเองทุกครั้งที่ใบเสนอราคาเปลี่ยน — ถูกทางแล้ว
-- แต่ยังไม่พอ: เทสต์ "ปิดการขาย 5 ใบพร้อมกัน" จับได้ว่ายอดออกมา 1,000,000 แทนที่จะเป็น 1,500,000
--
-- เพราะอะไร: แต่ละคำสั่งคำนวณผลรวมจาก "ภาพ ณ เวลาที่คำสั่งของตัวเองเริ่ม" (read committed)
--   ทั้ง 5 ตัวเริ่มไล่เลี่ยกัน จึงยังไม่เห็นใบของกันและกัน → ต่างคนต่างเขียนผลรวมที่ขาดของคนอื่น
--   คนที่เขียนทีหลังทับคนก่อน = ยอดหาย · การล็อกที่ 0114 ใส่ไว้อยู่ที่ reconcile (ที่แอปเรียก)
--   ไม่ได้ครอบมาถึง trigger ซึ่งเป็นเส้นทางที่ทำงานจริงตอนเขียนข้อมูลตรง
--
-- แก้: จองแถวลูกค้าไว้ก่อน (for update) — คนที่มาทีหลังต้องรอคนแรกเขียนเสร็จและ commit
--   พอได้คิวแล้ว คำสั่งถัดไปในธุรกรรมนั้นจะอ่านภาพใหม่ที่รวมใบของคนก่อนหน้าไว้แล้ว
--
-- ราคาที่จ่าย: การปิดการขายของ "ลูกค้ารายเดียวกัน" จะเข้าคิวทีละคน (คนละรายไม่กระทบกัน)
--   แลกกับความถูกต้องของตัวเลขเงิน — คุ้ม
create or replace function public.sync_customer_won_total()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  target_dealer text;
  target_customer bigint;
begin
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
    -- เข้าคิวก่อน แล้วค่อยคำนวณ — ถ้าไม่ล็อก ยอดจะหายเมื่อปิดหลายใบพร้อมกัน
    perform 1 from customers
     where id = target_customer and dealer_code = target_dealer
     for update;

    update customers c
       set total_value = coalesce((
             select sum(q.total_value) from quotations q
             where q.customer_id = target_customer
               and q.dealer_code = target_dealer
               and q.status = 'won'
           ), 0)
     where c.id = target_customer and c.dealer_code = target_dealer;
  end loop;
  return null;
end $$;
