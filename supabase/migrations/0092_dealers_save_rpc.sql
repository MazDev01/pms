-- Benjamin PMS — แก้ regression จาก 0090/0091: dealers.save() (upsert ตรงบนตาราง) พังเพราะ
-- INSERT...ON CONFLICT DO UPDATE ต้องมี SELECT privilege บนคอลัมน์ที่ SET (revenue_target) ด้วย
-- ไม่ใช่แค่ INSERT/UPDATE ตามที่คาดไว้ — ยืนยันจากการทดสอบจริง: upsert คืน
-- "permission denied for table dealers" ทันทีหลัง 0091 ถอด SELECT ทั้งตารางออก
--
-- ทางแก้ที่ถูกต้อง (ตรงกับแพทเทิร์นที่ระบบนี้ใช้อยู่แล้วสำหรับกรณีเดียวกัน — next_entity_id,
-- create_quotation, upsert_customer_for_company ทุกตัวเป็น SECURITY DEFINER RPC ทั้งสิ้น):
-- ย้ายการเขียนไปเป็น RPC ที่รันด้วยสิทธิ์เจ้าของฟังก์ชัน (ข้าม column-grant ของผู้เรียกได้) แล้ว
-- ตรวจสิทธิ์ can_write_master() เองในฟังก์ชันแทน — ไม่ต้องพึ่ง grant ระดับคอลัมน์ของผู้เรียกอีก

create or replace function public.save_dealers(p_rows jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare r jsonb;
begin
  if not can_write_master() then
    raise exception 'forbidden: no permission to write dealers';
  end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    insert into dealers (code, name, province, region, status, revenue_target)
    values (
      r->>'code', r->>'name', r->>'province', r->>'region',
      coalesce(r->>'status', 'active')::dealer_status,
      nullif(r->>'revenue_target', '')::numeric
    )
    on conflict (code) do update set
      name           = excluded.name,
      province       = excluded.province,
      region         = excluded.region,
      status         = excluded.status,
      revenue_target = excluded.revenue_target;
  end loop;
end $$;

revoke all on function public.save_dealers(jsonb) from public;
grant execute on function public.save_dealers(jsonb) to authenticated;
