-- ── ปิดการขายหลายใบของลูกค้ารายเดียวกันพร้อมกัน แล้ว "บางใบบันทึกไม่ลงเลย" ────────────
--
-- อาการจริงที่จับได้ (14 ส.ค. 69 · ยิงบันทึก 5 ใบพร้อมกัน 3 รอบ):
--   รอบ 1 → ล้ม 2 ใบ · รอบ 2 → ผ่านหมด · รอบ 3 → ล้ม 4 ใบ
--   ฐานข้อมูลตอบ "deadlock detected" · ยอดลูกค้าไม่ได้คำนวณผิดเลย (ตรงกับใบที่ลงจริงเสมอ)
--   ตัวที่หายคือ "ใบเสนอราคา" ทั้งใบ — งานขายที่ปิดได้จริงหายไปจากระบบเงียบ ๆ
--
-- ทำไมถึงล็อกตาย (ลำดับการจองที่สลับกันระหว่างสองคำสั่ง):
--   1) INSERT/UPDATE ใบเสนอราคา → Postgres จองแถวลูกค้าที่ FK ชี้ถึงแบบ FOR KEY SHARE ให้เองก่อน
--      (กันไม่ให้ใครลบลูกค้าทิ้งระหว่างที่ใบยังอ้างถึง)
--   2) trigger sync_customer_won_total (0116) จองแถวเดิมซ้ำด้วย FOR UPDATE
--   FOR UPDATE ชนกับ FOR KEY SHARE ที่อีกคำสั่งถืออยู่ → ต่างฝ่ายต่างถือของที่อีกฝ่ายรอ = ล็อกตาย
--   ฝั่งที่แพ้ถูกฐานข้อมูลยกเลิกทั้งธุรกรรม ใบนั้นจึงไม่ถูกบันทึกเลย
--
-- แก้: จองแบบ FOR NO KEY UPDATE แทน — แรงพอจะกัน "สองคนคำนวณยอดพร้อมกัน" ได้เหมือนเดิม
--   (NO KEY UPDATE ชนกันเอง จึงยังเข้าคิวทีละคนต่อลูกค้าหนึ่งราย = ยอดยังถูกต้อง)
--   แต่ไม่ชนกับ FOR KEY SHARE ที่ FK จองไว้ ลำดับการจองจึงไม่สลับกันอีก
--   และ UPDATE customers ที่ตามมาก็ขอสิทธิ์ระดับเดียวกันนี้อยู่แล้ว — ไม่ได้ยกระดับล็อกเพิ่ม
--
-- เหตุผลเดิมของ 0116 ยังอยู่ครบ: ห้ามคำนวณยอดโดยไม่จองแถวก่อน ไม่งั้นยอดหายตอนทำพร้อมกัน
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
    -- เข้าคิวก่อน แล้วค่อยคำนวณ — ถ้าไม่จองแถว ยอดจะหายเมื่อปิดหลายใบพร้อมกัน (0116)
    -- ⚠️ ต้องเป็น FOR NO KEY UPDATE เท่านั้น · FOR UPDATE ทำให้ล็อกตายกับ FK ของใบเสนอราคา
    perform 1 from customers
     where id = target_customer and dealer_code = target_dealer
     for no key update;

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
