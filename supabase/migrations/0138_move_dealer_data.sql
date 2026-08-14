-- ── ย้ายข้อมูลงานขายทั้งหมดจากสาขาหนึ่งไปอีกสาขาหนึ่ง ─────────────────────────────
--
-- ทำไมต้องมี: สาขาที่ยังมีข้อมูลงานขายลบไม่ได้ (delete_dealer_atomic คืน dealer_has_data)
--   ซึ่งถูกแล้ว — แต่เดิมไม่มีทางออกอื่นนอกจาก "ลบข้อมูลลูกค้าจริงทิ้ง" ซึ่งไม่มีใครกล้าทำ
--   ผู้ดูแลจึงติดค้างสาขาที่เลิกทำแล้วไว้ในระบบตลอดไป
--   ตอนนี้มีทางที่สาม: ย้ายให้สาขาที่รับช่วงต่อ แล้วค่อยลบสาขาเปล่า
--
-- ⚠️ ข้อจำกัดสำคัญ — "เลขที่รายการเดินแยกรายสาขา"
--   กุญแจหลักของ customers/appointments/leads/quotations คือ (dealer_code, id) — ดู 0012 และ 0022
--   ทุกสาขาเริ่มนับจาก 1 เหมือนกัน ลูกค้าเลข 1 ของเชียงใหม่กับของระยองจึงคนละคนแต่เลขเท่ากัน
--   ย้ายเข้าหากันตรง ๆ = ชน primary key
--
--   ทางเลือกคือ (ก) ออกเลขใหม่ให้ทุกแถวแล้วไล่แก้การอ้างอิงทั้งหมด หรือ (ข) ปฏิเสธเมื่อเลขชน
--   เลือก (ข) ตามที่ตกลงไว้ — เหตุผล: การออกเลขใหม่ต้องไล่แก้ลูกโซ่ (ลีด→ลูกค้า→ใบเสนอราคา→
--   นัดหมาย→ไฟล์→บันทึก) พลาดจุดเดียวคือข้อมูลผูกผิดคนแบบเงียบ ๆ ซึ่งร้ายกว่าการย้ายไม่ได้
--   ในทางปฏิบัติกรณีที่ใช้จริงคือ "ตั้งสาขาใหม่มารับช่วงต่อ" ซึ่งปลายทางว่างอยู่แล้ว ไม่มีทางชน
--
-- สิ่งที่ "ไม่" ย้ายตามไป — ตั้งค่าของสาขา (โลโก้/หัวกระดาษ/ตราประทับ/ตั้งค่าใบเสนอราคา/กฎดูแลลีด)
--   เพราะเป็นของประจำสาขา ปลายทางมีของตัวเองอยู่แล้ว ย้ายไปจะทับของเขา
--
-- สิ่งที่ "คัดลอก" ตามไป — รายชื่อผู้รับผิดชอบเฉพาะคนที่ถูกอ้างอิงอยู่จริง
--   ลีด/ลูกค้าอ้างผู้รับผิดชอบด้วย "ชื่อ" (ไม่ใช่ id) ถ้าไม่คัดลอกไป ชื่อคนดูแลจะกลายเป็นค่าที่
--   ไม่มีอยู่ในรายชื่อของสาขาปลายทาง → ช่องผู้รับผิดชอบว่างเปล่าเวลาเปิดแก้ไข

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
  -- ต้องตรวจก่อนเขียน ไม่ใช่ปล่อยให้ชนแล้วให้ธุรกรรมย้อนกลับ เพราะข้อความ error ของ PK
  -- อ่านไม่รู้เรื่องสำหรับผู้ดูแล (บอกแค่ชื่อ constraint ไม่บอกว่าชนกี่แถวที่ตารางไหน)
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
  -- ไม่ระบุ id — responsible_persons.id เป็น identity ระดับระบบ (generated always) DB ออกเลขให้เอง
  insert into responsible_persons (dealer_code, name, title, phone, email, active, avatar)
  select p_to, rp.name, rp.title, rp.phone, rp.email, rp.active, rp.avatar
    from responsible_persons rp
   where rp.dealer_code = p_from
     and rp.name is not null and rp.name <> ''
     -- เฉพาะคนที่มีงานอ้างถึงจริง — ไม่ยกรายชื่อทั้งกองไปรกสาขาปลายทาง
     and (exists (select 1 from leads     l where l.dealer_code = p_from and l.assigned = rp.name)
       or exists (select 1 from customers c where c.dealer_code = p_from and c.owner    = rp.name))
     -- ปลายทางมีชื่อนี้อยู่แล้ว = ถือว่าคนเดียวกัน ไม่ต้องคัดลอกซ้ำ
     and not exists (select 1 from responsible_persons y where y.dealer_code = p_to and y.name = rp.name);

  -- ── ย้ายจริง ──
  -- files/customer_notes เลขที่ไม่ซ้ำทั้งระบบ (identity) จึงย้ายได้ตรง ๆ ไม่ต้องตรวจเลขชน
  foreach t in array array['leads','quotations','customers','appointments','files','customer_notes'] loop
    execute format('update %I set dealer_code = $2 where dealer_code = $1', t) using p_from, p_to;
    get diagnostics n = row_count;
    entity := t; moved := n; return next;
  end loop;

  -- ── ตัวนับเลขที่ ──
  -- ลบทิ้งทั้งสองฝั่ง: next_entity_id จะตั้งต้นใหม่จาก max(id) จริงของสาขานั้นเองเมื่อถูกเรียกครั้งถัดไป
  -- ไม่ลบ = ปลายทางออกเลขทับแถวที่เพิ่งย้ายเข้ามา (ชน PK ตอนสร้างลูกค้ารายถัดไป)
  delete from entity_counters where dealer_code in (p_from, p_to);

  return;
end $$;

revoke all     on function public.move_dealer_data_atomic(text, text) from public, anon;
grant  execute on function public.move_dealer_data_atomic(text, text) to   authenticated;

comment on function public.move_dealer_data_atomic(text, text) is
  'ย้ายข้อมูลงานขายทั้งหมดของสาขาต้นทางไปสาขาปลายทางในธุรกรรมเดียว · ปฏิเสธถ้าเลขที่ชนกัน (id_conflict:ตาราง:จำนวน)';
