-- Benjamin PMS — RLS แยก "บทบาทย่อยภายในสาขา" (H3)
--
-- ปัญหา: 0002 ตั้ง policy เขียนงานขายเป็น dealer_code = auth_dealer() อย่างเดียว
--        → ทุก role ในสาขาเขียนได้เท่ากันหมด แม้แต่ DEALER_SITE ที่ permissions.ts
--          ให้สิทธิ์แค่ "อ่าน" (leads:read, customers:read)
--        คนที่ยิง API ตรงจึงข้ามข้อจำกัดของหน้าจอได้
--
-- แก้: เพิ่ม can_write_sales() = เฉพาะ DEALER_ADMIN / DEALER_SALES
--      อ่าน: คงเดิม (is_hq() หรือสาขาตัวเอง) → DEALER_SITE ยังเห็นข้อมูลสาขาตัวเองได้
--      เขียน: ต้องเป็น role ที่มีสิทธิ์ขาย + อยู่สาขาเดียวกับข้อมูล

create or replace function can_write_sales() returns boolean
  language sql stable as $$ select auth_role() in ('DEALER_ADMIN', 'DEALER_SALES') $$;

do $$
declare t text;
begin
  foreach t in array array['leads','quotations','customers','appointments','files','responsible_persons'] loop
    execute format('drop policy if exists %1$s_write on %1$I', t);
    execute format($f$
      create policy %1$s_write on %1$I for all
        using ( can_write_sales() and dealer_code = auth_dealer() )
        with check ( can_write_sales() and dealer_code = auth_dealer() )
    $f$, t);
  end loop;
end $$;
