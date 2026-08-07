-- ── แก้ delete_dealer_atomic ให้ทำงานได้จริง ─────────────────────────────────────
--
-- 0119 ใช้ "ตารางชั่วคราว" เก็บรายชื่อบัญชีก่อนลบ ซึ่งใช้ไม่ได้จริงในบริบทนี้:
--   ฟังก์ชันรันอยู่ในธุรกรรมของผู้เรียก · ตารางชั่วคราวแบบ on commit drop จึงมีอายุคาบเกี่ยว
--   กับการเรียกครั้งถัดไปในเซสชันเดียวกัน แล้วทำให้ลบตัวแทนพังทั้งเส้นทาง (เทสต์จับได้ทันที)
--
-- เปลี่ยนมาเก็บใส่ "ตัวแปรอาร์เรย์" แทน — ไม่มีสถานะค้างข้ามการเรียก และยังอยู่ในธุรกรรมเดียวเหมือนเดิม
create or replace function public.delete_dealer_atomic(p_code text)
returns table (member_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  t       text;
  n       integer;
  members uuid[];
begin
  if not can_write_master() then
    raise exception 'forbidden: no permission to delete dealer';
  end if;

  -- ต้องไม่มีข้อมูลงานขายค้างอยู่เลย — บอกให้ได้ด้วยว่าติดตารางไหน ผู้ดูแลจะได้รู้ว่าต้องไปเคลียร์อะไร
  foreach t in array array['leads','quotations','customers','appointments','files','customer_notes'] loop
    execute format('select count(*) from %I where dealer_code = $1', t) into n using p_code;
    if n > 0 then
      raise exception 'dealer_has_data:%:%', t, n;
    end if;
  end loop;

  -- เก็บรายชื่อบัญชีไว้ก่อน (หลังลบแถว dealers จะหาไม่เจอแล้ว)
  select coalesce(array_agg(id), '{}') into members from profiles where dealer_code = p_code;

  delete from responsible_persons where dealer_code = p_code;
  delete from dealer_lead_rules   where dealer_code = p_code;

  delete from dealers where code = p_code;
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'dealer_not_found:%', p_code;
  end if;

  return query select unnest(members);
end $$;

revoke all     on function public.delete_dealer_atomic(text) from public, anon;
grant  execute on function public.delete_dealer_atomic(text) to   authenticated;
