-- ── ปรับตัวนับเลขอัตโนมัติให้ตรงกับข้อมูลจริง (ใช้หลังกู้คืนข้อมูล) ────────────────────
--
-- ปัญหาที่ต้องกันไว้ (พบตอนสร้างระบบกู้คืน 7 ส.ค. 69):
--   บางตารางใช้เลขรันอัตโนมัติเป็นคีย์ (audit_log.id, hq_targets.id)
--   เวลากู้ข้อมูลกลับ เราใส่เลขเดิมกลับเข้าไปตรง ๆ แต่ "ตัวนับ" ของฐานข้อมูลไม่ได้ขยับตาม
--   → ตัวนับยังชี้ที่ 1 ขณะที่ข้อมูลมีถึง 9,670 แล้ว
--   ผลที่จะเกิด: กู้เสร็จดูเหมือนเรียบร้อยทุกอย่าง แต่พอมีการบันทึกรายการใหม่
--   ระบบจะขอเลข 1 ซึ่งมีอยู่แล้ว → บันทึกไม่ผ่าน ซ้ำแบบนี้ไปอีกเก้าพันครั้ง
--   นี่คือกับดัก "กู้แล้วดูปกติ แต่ใช้งานต่อไม่ได้" ซึ่งจะรู้ตัวก็ต่อเมื่อสายไปแล้ว
--
-- ไล่ทุกตารางเองจากสคีมาจริง ไม่ระบุชื่อตายตัว — เพิ่มตารางใหม่ในอนาคตก็ครอบคลุมเอง
--
-- 🔒 เรียกได้เฉพาะสิทธิ์ระดับเซิร์ฟเวอร์ (service_role) เท่านั้น ผู้ใช้ทั่วไปเรียกไม่ได้

create or replace function public.restore_sync_sequences()
returns table (seq_name text, new_value bigint)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  r record;
  v_max bigint;
begin
  for r in
    select c.relname::text as tbl, a.attname::text as col,
           pg_get_serial_sequence(quote_ident(n.nspname) || '.' || quote_ident(c.relname), a.attname) as seq
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
    where n.nspname = 'public' and c.relkind = 'r'
      and pg_get_serial_sequence(quote_ident(n.nspname) || '.' || quote_ident(c.relname), a.attname) is not null
  loop
    execute format('select coalesce(max(%I), 0) from public.%I', r.col, r.tbl) into v_max;
    -- is_called = true เมื่อมีข้อมูลอยู่แล้ว → เลขถัดไปคือ max+1
    -- ถ้าตารางว่าง ต้องตั้งเป็น 1 พร้อม is_called = false ไม่งั้นจะข้ามเลข 1 ไปเฉย ๆ
    if v_max > 0 then
      perform setval(r.seq, v_max, true);
    else
      perform setval(r.seq, 1, false);
    end if;
    seq_name := r.seq; new_value := greatest(v_max, 1);
    return next;
  end loop;
end;
$$;

revoke all on function public.restore_sync_sequences() from public, anon, authenticated;
grant execute on function public.restore_sync_sequences() to service_role;

comment on function public.restore_sync_sequences() is
  'ปรับตัวนับเลขอัตโนมัติให้ตรงกับข้อมูลจริง — ต้องเรียกทุกครั้งหลังกู้คืนข้อมูล (scripts/restore.mjs เรียกให้เอง)';
