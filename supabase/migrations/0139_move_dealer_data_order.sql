-- ── แก้ลำดับการย้ายข้อมูลระหว่างสาขา — ย้ายลูกค้าก่อนเสมอ ─────────────────────────
--
-- อาการที่ผู้ใช้เจอ (14 ส.ค. 69): กด "ย้ายข้อมูล" ที่หน้าลบตัวแทน แล้วขึ้น
--   "ย้ายข้อมูลไม่สำเร็จชั่วคราว — ลองใหม่อีกครั้ง" ทุกครั้ง กดกี่ทีก็ไม่ผ่าน
--   (ข้อความนั้นคือกรณี "ไม่รู้สาเหตุ" ของ route — ที่จริงไม่ใช่เรื่องชั่วคราวเลย)
--
-- ข้อความจริงจากฐานข้อมูล (จาก log ของเซิร์ฟเวอร์จริง):
--   insert or update on table "leads" violates foreign key constraint "leads_customer_fk"
--   Key (dealer_code, customer_id)=(FFF, 1) is not present in table "customers"
--
-- ต้นเหตุ: 0138 ย้ายทีละตารางตามลำดับ leads → quotations → customers → …
--   พอ leads ย้ายไปเป็นของสาขาปลายทางแล้ว แต่ลูกค้าที่ลีดนั้นอ้างถึงยังอยู่สาขาเดิม
--   คู่ (dealer_code, customer_id) จึงชี้ไปยังลูกค้าที่ไม่มีอยู่ของสาขาปลายทาง = ผิดกฎความสัมพันธ์ทันที
--   ธุรกรรมย้อนกลับทั้งหมด ไม่มีอะไรถูกย้ายจริง (ข้อมูลไม่เสียหาย แต่ก็ทำงานไม่ได้เลย)
--
-- ความสัมพันธ์ที่มีอยู่จริงในระบบ (ตัวลูก → ตัวแม่):
--   leads        → customers   (leads_customer_fk · 0083)
--   quotations   → customers   (quotations_customer_fk · 0035)
--   quotations   → leads       (quotations_deal_fk · 0089)
--   appointments → leads       (appointments_lead_fk · 0036/0037)
--
-- แก้: ย้ายตามลำดับ "แม่ก่อนลูก" — customers → leads → quotations → appointments → ที่เหลือ
--   ทุกขั้นตอนอื่นคงเดิมทั้งหมด (ด่านเลขชน · คัดลอกผู้รับผิดชอบ · ล้างตัวนับเลขที่)
create or replace function public.move_dealer_data_atomic(p_from text, p_to text)
returns table(entity text, moved bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  t text;
  n bigint;
begin
  -- auth.uid() ว่าง = เรียกจากเซิร์ฟเวอร์ด้วย service_role (ผ่านการตรวจสิทธิ์มาแล้วที่ชั้น route)
  if auth.uid() is not null and not can_write_master() then
    raise exception 'forbidden: no permission to move dealer data';
  end if;

  if p_from is null or p_to is null or p_from = p_to then
    raise exception 'same_dealer: ต้นทางและปลายทางต้องคนละสาขา';
  end if;
  if not exists (select 1 from dealers where code = p_from) then
    raise exception 'dealer_not_found:%', p_from;
  end if;
  if not exists (select 1 from dealers where code = p_to) then
    raise exception 'dealer_not_found:%', p_to;
  end if;

  -- ── ด่านเลขชน — ตรวจให้ครบทุกตารางก่อน แล้วค่อยเริ่มย้าย ──
  foreach t in array array['leads','quotations','customers','appointments'] loop
    execute format(
      'select count(*) from %I a where a.dealer_code = $1 and exists '
      '(select 1 from %I b where b.dealer_code = $2 and b.id = a.id)', t, t)
      into n using p_from, p_to;
    if n > 0 then
      raise exception 'id_conflict:%:%', t, n;
    end if;
  end loop;

  -- ── คัดลอกผู้รับผิดชอบที่ถูกอ้างอิงอยู่จริง (ตามชื่อ) ──
  insert into responsible_persons (dealer_code, name, title, phone, email, active, avatar)
  select p_to, rp.name, rp.title, rp.phone, rp.email, rp.active, rp.avatar
    from responsible_persons rp
   where rp.dealer_code = p_from
     and rp.name is not null and rp.name <> ''
     and (exists (select 1 from leads     l where l.dealer_code = p_from and l.assigned = rp.name)
       or exists (select 1 from customers c where c.dealer_code = p_from and c.owner    = rp.name))
     and not exists (select 1 from responsible_persons y where y.dealer_code = p_to and y.name = rp.name);

  -- ── ย้ายจริง · ลำดับสำคัญ: แม่ก่อนลูก ──
  --   customers ต้องมาก่อน leads/quotations ที่อ้างถึง
  --   leads ต้องมาก่อน quotations/appointments ที่อ้างถึง
  --   files/customer_notes เลขที่ไม่ซ้ำทั้งระบบ (identity) ไม่มีใครอ้างถึง จึงอยู่ท้ายสุดได้
  foreach t in array array['customers','leads','quotations','appointments','files','customer_notes'] loop
    execute format('update %I set dealer_code = $2 where dealer_code = $1', t) using p_from, p_to;
    get diagnostics n = row_count;
    entity := t; moved := n; return next;
  end loop;

  -- ── ตัวนับเลขที่ ──
  -- ลบทิ้งทั้งสองฝั่ง: next_entity_id จะตั้งต้นใหม่จาก max(id) จริงของสาขานั้นเองเมื่อถูกเรียกครั้งถัดไป
  delete from entity_counters where dealer_code in (p_from, p_to);

  return;
end $$;

revoke all     on function public.move_dealer_data_atomic(text, text) from public, anon;
grant  execute on function public.move_dealer_data_atomic(text, text) to   authenticated;

comment on function public.move_dealer_data_atomic(text, text) is
  'ย้ายข้อมูลงานขายทั้งหมดของสาขาต้นทางไปสาขาปลายทางในธุรกรรมเดียว · ย้ายแม่ก่อนลูกตามความสัมพันธ์ · ปฏิเสธถ้าเลขที่ชนกัน (id_conflict:ตาราง:จำนวน)';
