-- ── ระยะ 2 · ยอดในใบเสนอราคา ต้องตรงกับรายการ BOQ ที่อยู่ในใบนั้น ────────────────
--
-- ทำไมสำคัญ: ยอดนี้คือตัวเลขที่ไหลต่อไปเป็น "ยอดขายของสาขา" และ "ยอดสะสมของลูกค้า"
--   ส่วนรายการ BOQ คือสิ่งที่ลูกค้าเห็นบนเอกสารที่พิมพ์ออกไป
--   ถ้าสองอย่างนี้ไม่ตรงกัน = เอกสารบอกราคาหนึ่ง ระบบรายงานอีกราคาหนึ่ง โดยไม่มีอะไรฟ้อง
--   ผู้บริหารตัดสินใจจากตัวเลขที่ไม่ตรงกับที่ขายจริง
--
-- หน้าเว็บคิดยอดจาก BOQ ให้เสมอ — ไม่มีช่องให้พิมพ์ยอดเองสักที่เดียว (ตรวจแล้วทั้งสองฟอร์ม:
--   ฟอร์มในแผงลูกค้าเป้าหมาย และฟอร์มเต็มหน้าใบเสนอราคา ต่างก็คิดจาก Σ(จำนวน × ราคา/หน่วย))
--   แต่ "คิดให้" ไม่เท่ากับ "บังคับ" — สั่งแก้ยอดเข้าฐานข้อมูลตรง ๆ ยังทำได้อยู่
--
-- ── ขอบเขตที่ตั้งใจ ────────────────────────────────────────────────────────────
-- ตรวจเฉพาะใบที่ "มีรายการ BOQ" เท่านั้น
--   ใบเก่า/ใบที่ย้ายข้อมูลมา มีแต่ยอดรวมไม่มีรายการ — ไม่มีอะไรให้เทียบ ปล่อยผ่านตามเดิม
--   (boq.ts ฝั่งหน้าจอก็สังเคราะห์รายการเดียวจากยอดให้ดูอยู่แล้ว ไม่ได้เก็บลงฐาน)
--
-- ยอม 1 บาท เพราะจำนวนเป็นทศนิยมได้ (พื้นที่ ตร.ม.) แล้วเลขทศนิยมฝั่งเบราว์เซอร์กับฐานข้อมูล
--   ปัดไม่ตรงกันในหลักสตางค์ได้ — ช่องว่างแค่นี้ไม่พอให้ใครแอบเปลี่ยนยอดอย่างมีนัยสำคัญ
--
-- ⚠️ ยิงเฉพาะตอนแตะ line_items หรือ total_value — เปลี่ยนสถานะ/ผูกลูกค้าไม่ต้องมาตรวจซ้ำ
--    (close_won_quotation · relink_customer_quotes แตะแค่ status/customer_id จึงไม่ถูกกระทบ)
--
-- ⚠️ ทำไมเป็น trigger ที่ "ปฏิเสธ" ไม่ใช่ trigger ที่ "แก้ให้ตรงเอง":
--    ตรงนี้เป็นตัวเลขเงิน — แก้ให้เองเงียบ ๆ คือเปลี่ยนยอดขายโดยไม่มีใครรู้ตัว
--    (ต่างจาก items ที่เป็นแค่ตัวนับจำนวนแถว ซึ่ง 0089 เลือก sync ให้เองอย่างถูกต้องแล้ว)
--    ตรวจแล้วว่าฐานจริงและฐานทดสอบไม่มีใบที่ยอดไม่ตรงอยู่ก่อนเลยสักใบ (17 ส.ค. 69)

create or replace function public.guard_quotation_total_matches_boq() returns trigger
  language plpgsql as $$
declare
  v_sum numeric;
  v_n   int;
begin
  v_n := coalesce(jsonb_array_length(new.line_items), 0);
  if v_n = 0 then
    return new;   -- ไม่มีรายการให้เทียบ (ใบเก่า/ใบนำเข้า) — ปล่อยผ่านตามเดิม
  end if;

  select coalesce(sum(coalesce((li ->> 'qty')::numeric, 0) * coalesce((li ->> 'unitPrice')::numeric, 0)), 0)
    into v_sum
    from jsonb_array_elements(new.line_items) as li;

  if abs(v_sum - coalesce(new.total_value, 0)) > 1 then
    raise exception
      'boq_mismatch: ยอดในใบ (%) ไม่ตรงกับรายการ BOQ (%) — ยอดต้องมาจากรายการเสมอ',
      coalesce(new.total_value, 0), v_sum;
  end if;
  return new;
end $$;

drop trigger if exists trg_quotation_total_matches_boq on quotations;
create trigger trg_quotation_total_matches_boq
  before insert or update of line_items, total_value on quotations
  for each row execute function public.guard_quotation_total_matches_boq();

comment on function public.guard_quotation_total_matches_boq() is
  'ยอดในใบเสนอราคาต้องเท่ากับ Σ(จำนวน × ราคา/หน่วย) ของรายการ BOQ ในใบนั้น (เฉพาะใบที่มีรายการ) · ระยะ 2';
