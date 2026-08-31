-- ── ภาษีมูลค่าเพิ่ม + ภาษีหัก ณ ที่จ่าย บนใบเสนอราคา (บอสสั่ง 28 ส.ค. 69) ──────
--
-- กติกาที่ต้องคงไว้ (ห้ามแตะ):
--   ยอดก่อน VAT (total_value) = ผลรวมรายการ BOQ เสมอ — เป็นตัวเดียวกับที่รายงาน/เป้าใช้อยู่
--   คอลัมน์ใหม่ทั้งหมดในใบนี้เป็น "ข้อมูลภาษีเพิ่มเติม" ไม่ได้ไปแทนยอดขายเดิม
--   (Dashboard / KPI / เป้า / Win rate ยังใช้ total_value เหมือนเดิมทุกประการ)
--
-- ทำไมต้องเก็บเป็นสแนปช็อต: อัตราภาษีเปลี่ยนได้ในอนาคต ถ้าไม่เก็บไว้กับใบ
--   ใบเก่าจะถูกคำนวณใหม่ด้วยอัตราปัจจุบัน แล้วเอกสารที่ลูกค้าถืออยู่จะไม่ตรงกับระบบ
--
-- สูตร (ตรงกับ lib/quoteTax.ts ที่หน้าจอและเอกสารใช้ร่วมกัน):
--   vat_amount   = total_value * vat_rate / 100
--   total_amount = total_value + vat_amount
--   wht_amount   = total_value * wht_rate / 100        (คิดจากยอดก่อน VAT)
--   net_payable  = total_amount - wht_amount
alter table public.quotations
  add column if not exists vat_amount   numeric,
  add column if not exists wht_rate     numeric,
  add column if not exists wht_amount   numeric,
  add column if not exists total_amount numeric,
  add column if not exists net_payable  numeric;

comment on column public.quotations.vat_percent  is 'อัตรา VAT ที่ตรึงไว้กับใบ (%) — null/0 = ใบนี้ไม่คิด VAT';
comment on column public.quotations.vat_amount   is 'จำนวนเงิน VAT ที่ตรึงไว้กับใบ (บาท)';
comment on column public.quotations.wht_rate     is 'อัตราภาษีหัก ณ ที่จ่ายที่ตรึงไว้กับใบ (%) — null/0 = ไม่หัก';
comment on column public.quotations.wht_amount   is 'จำนวนเงินภาษีหัก ณ ที่จ่าย (บาท) — คิดจากยอดก่อน VAT';
comment on column public.quotations.total_amount is 'ยอดรวมเป็นเงิน = ยอดก่อน VAT + VAT';
comment on column public.quotations.net_payable  is 'ยอดชำระสุทธิ = ยอดรวม - หัก ณ ที่จ่าย · เก็บไว้ทำรายงานภายหลัง ยังไม่ใช้แทนยอดขาย';

-- อัตราภาษีติดลบ/เกิน 100 เป็นข้อมูลผิดแน่นอน — กันไว้ที่ฐานข้อมูล
alter table public.quotations drop constraint if exists quotations_tax_rate_range;
alter table public.quotations add constraint quotations_tax_rate_range check (
  (vat_percent is null or (vat_percent >= 0 and vat_percent <= 100))
  and (wht_rate is null or (wht_rate >= 0 and wht_rate <= 100))
);
