-- ── ทำให้ด่าน "บัญชียังเปิดใช้งานอยู่ไหม" ถูกพอจะใส่ในกฎการอ่านได้จริง ────────────────
--
-- ที่มา: 0123/0124 ปิดช่อง H-1 ได้ถูกต้องเรื่องสิทธิ์ แต่วัดแล้วแพงเกินรับ
--   นับ 2,000 แถว: ข้าม RLS 132 ms · ผ่าน RLS 594 ms → ส่วนต่าง ~460 ms
--   และส่วนต่างไม่ได้ขึ้นกับ "จำนวนแถวที่ได้" แต่ขึ้นกับ "จำนวนแถวที่สแกน"
--   = ฐานข้อมูลเรียกฟังก์ชันซ้ำทุกแถวจริง แม้ครอบด้วย (select ...) แล้วก็ตาม
--
-- สาเหตุ: is_account_active() เป็น security definer → ตัววางแผนคำสั่งของ Postgres
--   "inline" เข้าไปในคำสั่งไม่ได้ ต้องเรียกเป็นฟังก์ชันจริงทุกครั้ง
--   ยิ่งอยู่ในกฎที่ต้องตัดสินทีละแถว ยิ่งคูณตามจำนวนแถวที่สแกน
--
-- แนวทางนี้: ทำตัวใหม่ที่ "inline ได้" — เป็น SQL ธรรมดา (security invoker) อ่านตารางเดียว
--   ผู้ใช้อ่านโปรไฟล์ของตัวเองได้อยู่แล้วตามกฎ profiles_read (id = auth.uid()) จึงไม่ต้องยกสิทธิ์
--   Postgres inline ฟังก์ชันแบบนี้เข้าไปเป็นเงื่อนไขธรรมดาได้ → ต้นทุนใกล้ศูนย์
--
-- ⚠️ ต่างจาก is_account_active() ตรงที่ตัวนี้ดู "สถานะบัญชี" อย่างเดียว ไม่ได้ดู "สถานะสาขา"
--   จงใจ: สาขาที่ถูกปิดยังต้องถูกกันอยู่ ซึ่งกันอยู่แล้ว 2 ชั้นและไม่ได้พึ่งใบนี้เลย
--     1) custom_access_token_hook ไม่ออก token ให้เลยถ้าสาขาถูกปิด (0032) — ล็อกอินใหม่ไม่ผ่าน
--     2) ฝั่งเขียนยังเดินผ่าน can_write_sales() → is_account_active() ตัวเดิมที่ดูสาขาด้วย
--   ใบนี้แก้เฉพาะ "ฝั่งอ่าน" ซึ่งเป้าหมายคือกันคนที่ถูกปลดออกจากบัญชีเป็นรายคน
create or replace function public.is_self_active() returns boolean
language sql
stable
as $$
  select coalesce((select pr.status = 'active' from public.profiles pr where pr.id = auth.uid()), false)
$$;

revoke execute on function public.is_self_active() from public;
grant  execute on function public.is_self_active() to   authenticated;

do $$
declare t text;
begin
  foreach t in array array['leads','quotations','customers','appointments','files','responsible_persons'] loop
    execute format('drop policy if exists %1$s_select on %1$I', t);
    execute format($f$
      create policy %1$s_select on %1$I for select
        to authenticated
        using ( ( is_hq() or dealer_code = auth_dealer() ) and is_self_active() )
    $f$, t);
  end loop;
end $$;

drop policy if exists customer_notes_select on customer_notes;
create policy customer_notes_select on customer_notes for select
  to authenticated
  using ( ( is_hq() or dealer_code = auth_dealer() ) and is_self_active() );

drop policy if exists dealer_settings_select on dealer_settings;
create policy dealer_settings_select on dealer_settings for select
  to authenticated
  using ( ( is_hq() or dealer_code = auth_dealer() ) and is_self_active() );

drop policy if exists audit_read on audit_log;
create policy audit_read on audit_log for select
  to authenticated
  using ( is_hq() and is_self_active() );
