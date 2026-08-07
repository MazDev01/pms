-- ── quotation_salesperson(): เลือกใบด้วย "สาขา + เลขที่" ไม่ใช่เลขที่อย่างเดียว ───────
--
-- ปัญหา: เลขที่ใบเสนอราคาไม่ได้ไม่ซ้ำทั้งระบบ — คีย์จริงคือ (dealer_code, id) ตั้งแต่ 0022
--   ที่ตั้งใจให้แต่ละสาขาเดินเลขของตัวเองได้อิสระ (สองสาขาออกเลข Q-2026-0001 พร้อมกันได้)
--   แต่ฟังก์ชันนี้ยังค้นด้วย `where q.id = p_quote_id` เฉย ๆ
--
-- ผลที่เกิดจริง: HQ เปิดดูใบเสนอราคาของสาขาหนึ่ง แล้วช่อง "ผู้รับผิดชอบ" อาจขึ้นชื่อพนักงาน
--   ของอีกสาขาที่บังเอิญมีเลขที่ใบตรงกัน (limit 1 หยิบมาแถวเดียวโดยไม่รู้ว่าเป็นของใคร)
--   = ข้อมูลบุคคลข้ามสาขา และทำให้ HQ ติดต่อผิดคน
--   (ผลตรวจสอบระบบรอบ 2 · แก้รอบ 0104 เฉพาะเงื่อนไข join แต่ยังไม่ได้แก้เงื่อนไขเลือกใบ)
--
-- p_dealer_code เป็น optional เพื่อไม่ให้ของเดิมที่เรียกอยู่พัง — แต่ถ้าไม่ส่งมา จะบังคับให้
-- ต้องมีใบตรงเลขนั้นเพียงสาขาเดียวเท่านั้น (กำกวมเมื่อไหร่ = คืน null ดีกว่าคืนชื่อผิดคน)
create or replace function quotation_salesperson(p_quote_id text, p_dealer_code text default null)
returns text
language sql
stable
as $$
  with target as (
    select q.*
    from quotations q
    where q.id = p_quote_id
      and (p_dealer_code is null or q.dealer_code = p_dealer_code)
  ), unambiguous as (
    -- ไม่ระบุสาขา + เจอหลายสาขา = กำกวม → ไม่คืนชื่อใครเลย (ห้ามเดา)
    select * from target
    where p_dealer_code is not null or (select count(*) from target) = 1
  )
  select l.assigned
  from unambiguous q
  join leads l
    on (q.deal_id is not null and l.num_id = q.deal_id and coalesce(l.dealer_code,'CNX') = coalesce(q.dealer_code,'CNX'))
    or (coalesce(q.customer_id, 0) > 0 and l.customer_id = q.customer_id and coalesce(l.dealer_code,'CNX') = coalesce(q.dealer_code,'CNX'))
  order by (q.deal_id is not null and l.num_id = q.deal_id) desc  -- ให้ deal_id ชนะ customer_id (ตรงกว่า)
  limit 1;
$$;
