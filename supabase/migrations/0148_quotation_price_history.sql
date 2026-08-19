-- Benjamin PMS — บันทึกการต่อรองราคา (P1 ข้อ 3 จากผลตรวจระบบ 19 ส.ค. 69)
--
-- ปัญหา: ขั้น "เจรจาต่อรอง" มีงานให้ติ๊กอย่างเดียว ไม่มีที่บันทึกว่าต่อรองจากเท่าไรเหลือเท่าไร
--   เซลส์แก้ยอดในใบเสนอราคาทับของเดิม ยอดก่อนต่อรองหายทันที
--   พอปิดการขายแล้วย้อนดูว่าลดไปกี่เปอร์เซ็นต์ กี่รอบ ก็ไม่มีข้อมูลให้ดู
--
-- ทำไมเก็บด้วย trigger ไม่ใช่ให้แอปเขียนเอง:
--   ยอดในใบถูกแก้ได้จากหลายทาง (แผงใบเสนอราคา · แก้รายการสินค้า · เส้นทางในอนาคต)
--   ถ้าให้แต่ละทางจำไว้เขียนประวัติเอง เดี๋ยวก็มีทางที่ลืม แล้วประวัติจะขาดแบบไม่มีใครรู้
--   ล็อกที่ฐานข้อมูลทางเดียว = ยอดเปลี่ยนเมื่อไร ประวัติได้ทุกครั้ง
alter table quotations add column if not exists price_history jsonb not null default '[]'::jsonb;

-- แต่ละรอบเก็บ: เวลา · ยอดก่อน · ยอดหลัง · ใครแก้
--   ไม่เก็บ "เหตุผล" ที่ชั้นนี้ — trigger ไม่รู้เจตนาของคนกด แอปเติมทีหลังได้ที่ช่องหมายเหตุของรอบนั้น
create or replace function public.log_quotation_price_change() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- สนใจเฉพาะ "ยอดเปลี่ยนจริง" — บันทึกฟิลด์อื่นแล้วยอดเท่าเดิม ไม่ต้องมีรอบใหม่
  if new.total_value is distinct from old.total_value then
    new.price_history := coalesce(old.price_history, '[]'::jsonb) || jsonb_build_object(
      'at',   to_char(now() at time zone 'Asia/Bangkok', 'YYYY-MM-DD"T"HH24:MI:SS'),
      'from', coalesce(old.total_value, 0),
      'to',   coalesce(new.total_value, 0),
      'by',   coalesce(auth.uid()::text, 'system')
    );
  end if;
  return new;
end $$;

drop trigger if exists trg_quotation_price_history on quotations;
create trigger trg_quotation_price_history
  before update on quotations
  for each row execute function public.log_quotation_price_change();

-- ประวัติเป็นของ "การต่อรอง" — แก้ย้อนหลังไม่ได้ ไม่งั้นบันทึกก็ไม่มีความหมาย
--   ยอมให้ต่อท้ายได้อย่างเดียว (เช่น แอปเติมหมายเหตุของรอบล่าสุด ก็ยังนับเป็นความยาวเท่าเดิมหรือมากขึ้น)
create or replace function public.guard_price_history_append_only() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if jsonb_array_length(coalesce(new.price_history, '[]'::jsonb))
   < jsonb_array_length(coalesce(old.price_history, '[]'::jsonb)) then
    raise exception 'price_history_shrink' using
      errcode = 'check_violation',
      message = 'ลบประวัติการต่อรองราคาย้อนหลังไม่ได้';
  end if;
  return new;
end $$;

drop trigger if exists trg_price_history_append_only on quotations;
create trigger trg_price_history_append_only
  before update on quotations
  for each row execute function public.guard_price_history_append_only();
