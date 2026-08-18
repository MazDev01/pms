-- ── ระยะ 2 · ย้ายกฎธุรกิจลงฐานข้อมูล — "ลบลูกค้า" และ "ลบลูกค้าเป้าหมาย" ───────────
--
-- ทำไมต้องลงมาที่ฐานข้อมูล ไม่ใช่แค่ที่หน้าเว็บ:
--   กฎที่อยู่ในหน้าเว็บ "ข้ามได้" — คนที่ล็อกอินแล้วเปิด Console สั่งงานเข้าฐานข้อมูลตรง ๆ ได้เลย
--   สิทธิ์ระดับแถว (RLS) ตอบได้แค่ "แถวนี้เป็นของสาขาคุณไหม" ตอบไม่ได้ว่า "ทำแบบนี้ถูกกติกาไหม"
--
-- ── เรื่องที่ 1: ลบลูกค้า ──────────────────────────────────────────────────────
--
-- กติกา (customerDeletion.ts): ดีลที่ "จบแล้ว" (ปิดการขายสำเร็จ/ไม่สำเร็จ) = ประวัติของลูกค้ารายนี้
--   → ลบไปพร้อมกัน · ดีลที่ "ยังเดินอยู่" → กันไว้ ลบลูกค้าไม่ได้
--
-- เดิมหน้าเว็บทำเป็นคำสั่งแยกกันหลายคำสั่ง (ลบใบ → ลบดีล → ลบลูกค้า) ปัญหาคือ
--   • เน็ตหลุดกลางทาง = ประวัติลูกค้าหายไปครึ่งเดียว ลูกค้ายังอยู่แต่ใบหาย (ย้อนกลับไม่ได้)
--   • ตัวนับที่กล่องยืนยันบอก กับของที่ถูกลบจริง อาจไม่ตรงกันถ้าข้อมูลเปลี่ยนระหว่างนั้น
-- รวมเป็นคำสั่งเดียวที่ฐานข้อมูล = ได้ทั้งก้อนหรือไม่ได้เลย และนับจากภาพเดียวกันเสมอ
--
-- ⚠️ ไบต์ของไฟล์ใน Storage ลบจากที่นี่ไม่ได้ (คนละระบบกัน) — คืนรายการพาธกลับไปให้แอปลบตาม
--    ถ้าลบไบต์ไม่สำเร็จ แถวข้อมูลก็หายไปแล้ว เหลือแค่ไบต์กำพร้าที่ไม่มีใครอ้างถึง
--    ซึ่งดีกว่าทางกลับกัน (แถวหายแต่ไบต์ยังกินที่ โดยไม่มีใครรู้ว่ามีอยู่)
--
-- ── เรื่องที่ 2: ลบลูกค้าเป้าหมายที่ยังมีใบเสนอราคาผูกอยู่ ────────────────────────
--
-- หน้าเว็บกันไว้แล้ว แต่ฐานข้อมูลไม่ได้กัน — FK เดิม (0089) ตั้งเป็น `on delete set null`
--   แปลว่าสั่งลบตรง ๆ "สำเร็จ" แล้วใบเสนอราคาถูกตัดสายเงียบ ๆ (deal_id กลายเป็นว่าง)
--   ใบยังอยู่ในระบบแต่ไม่รู้ว่ามาจากดีลไหนอีกต่อไป — ข้อมูลเสียหายแบบไม่มีอะไรฟ้อง
-- เปลี่ยนเป็น restrict = ปฏิเสธไปเลย ให้ตรงกับสิ่งที่หน้าเว็บบอกผู้ใช้อยู่แล้ว
--
-- ไม่กระทบเส้นทางลบปกติ: หน้าเว็บเช็คก่อนอยู่แล้ว · ตัวลบลูกค้าด้านล่างลบใบก่อนลบดีลเสมอ
-- ไม่กระทบการลบสาขา: delete_dealer_atomic ไม่ได้ลบงานขาย (ถูก FK กันไว้ตั้งแต่ต้นทาง)

-- ══════════════════════════════════════════════════════════════════════════
-- 1) ลบลูกค้าเป้าหมายที่ยังมีใบผูกอยู่ → ปฏิเสธที่ฐานข้อมูล (เดิมตัดสายเงียบ ๆ)
-- ══════════════════════════════════════════════════════════════════════════
alter table quotations drop constraint if exists quotations_deal_fk;
alter table quotations
  add constraint quotations_deal_fk
  foreign key (dealer_code, deal_id) references leads (dealer_code, num_id)
  on update cascade on delete restrict;

-- ══════════════════════════════════════════════════════════════════════════
-- 2) ลบลูกค้าพร้อมประวัติ ในทรานแซกชันเดียว
-- ══════════════════════════════════════════════════════════════════════════
create or replace function public.delete_customer_cascade(p_customer_id bigint)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_dealer   text := auth_dealer();
  v_active   int;
  v_paths    text[];
  v_quotes   int;
  v_leads    int;
  v_closed   int[];
begin
  if not can_write_sales() then
    raise exception 'forbidden: ไม่มีสิทธิ์ลบลูกค้า';
  end if;

  -- จองแถวลูกค้าไว้ก่อน — กันอีกคนปิดการขายใบใหม่เข้ามาระหว่างที่เรากำลังนับว่า "ลบได้ไหม"
  perform 1 from customers
    where id = p_customer_id and dealer_code = v_dealer
    for update;
  if not found then
    raise exception 'not_found: ไม่พบลูกค้ารายนี้ในสาขา %', v_dealer;
  end if;

  -- ดีลที่ยังขายอยู่ = ห้ามลบ · ข้อความต้องบอกจำนวนให้ตรงกับที่หน้าจอนับ (นับจากภาพเดียวกัน)
  select count(*) into v_active from leads
    where dealer_code = v_dealer and customer_id = p_customer_id
      and status not in ('PAID', 'CANCELLED');
  if v_active > 0 then
    raise exception 'active_deals: ลบลูกค้าไม่ได้ — ยังมีดีลที่ขายอยู่ % รายการ', v_active;
  end if;

  -- ดีลที่จบแล้วของลูกค้ารายนี้ (เก็บเลขไว้ใช้ตามล่าใบ/ไฟล์ที่ผูกกับดีลเหล่านั้น)
  select coalesce(array_agg(num_id), '{}') into v_closed from leads
    where dealer_code = v_dealer and customer_id = p_customer_id and num_id is not null;

  -- พาธไฟล์ทั้งหมดที่กำลังจะหายไป — รวบไว้ก่อนลบแถว (ลบแล้วตามหาไม่ได้อีก)
  select coalesce(array_agg(storage_path), '{}') into v_paths from files
    where dealer_code = v_dealer and storage_path is not null
      and ( (source = 'customer' and (record_id = p_customer_id or customer_id = p_customer_id))
         or (source = 'lead' and record_id = any(v_closed)) );

  delete from files
    where dealer_code = v_dealer
      and ( (source = 'customer' and (record_id = p_customer_id or customer_id = p_customer_id))
         or (source = 'lead' and record_id = any(v_closed)) );

  -- ลำดับสำคัญ: ใบ → ดีล → ลูกค้า (FK เป็น restrict ทั้งสองชั้น ลบสลับลำดับจะถูกปฏิเสธ)
  with gone as (
    delete from quotations
      where dealer_code = v_dealer
        and (customer_id = p_customer_id or deal_id = any(v_closed))
      returning 1
  ) select count(*) into v_quotes from gone;

  with gone as (
    delete from leads
      where dealer_code = v_dealer and customer_id = p_customer_id
      returning 1
  ) select count(*) into v_leads from gone;

  -- โน้ตลูกค้าไปเองด้วย FK cascade (0089) ไม่ต้องลบซ้ำที่นี่
  delete from customers where id = p_customer_id and dealer_code = v_dealer;

  return jsonb_build_object(
    'quotations', v_quotes,
    'leads',      v_leads,
    'storagePaths', to_jsonb(v_paths)
  );
end $$;

revoke all on function public.delete_customer_cascade(bigint) from public;
grant execute on function public.delete_customer_cascade(bigint) to authenticated;

comment on function public.delete_customer_cascade(bigint) is
  'ลบลูกค้าพร้อมประวัติ (ดีลที่จบแล้ว + ใบ + ไฟล์) ในทรานแซกชันเดียว · ปฏิเสธถ้ายังมีดีลที่ขายอยู่ · คืนพาธไฟล์ให้แอปลบไบต์ตาม';
