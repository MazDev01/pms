-- Benjamin PMS — Phase 5: Authorization Audit (Enterprise Production Readiness Mission, 31 ก.ค. 69)
--
-- รัน `supabase db advisors --type security` จริงกับ production พบ 3 เรื่องที่ยืนยันแล้วด้วยการยิง
-- RPC จริงด้วย anon key (ไม่ล็อกอินเลย):
--
-- 1) SECURITY DEFINER RPC เกือบทั้งหมด "ยิงถึงตัวฟังก์ชันได้" แม้เป็น anon (ไม่ได้ล็อกอิน) —
--    ยืนยันจริง: close_won_quotation/save_dealers/restore_hq_settings/upsert_customer_for_company
--    ทุกตัวคืน error จากภายในฟังก์ชันเอง (P0001 "forbidden: ...") ไม่ใช่ error สิทธิ์ระดับ Postgres
--    (42501) — แปลว่า "ยิงถึงตัว logic ข้างในได้" เพียงแต่ logic ข้างในปฏิเสธเองอีกที (กันไว้ได้
--    แต่ไม่ใช่ defense-in-depth ที่ตั้งใจ) สาเหตุ: ทุก migration ทำ `revoke ... from public` เข้าใจผิดว่า
--    ครอบคลุม anon ด้วย — แต่ Postgres/Supabase ให้สิทธิ์ EXECUTE แก่ anon/authenticated แยกต่างหาก
--    จาก PUBLIC pseudo-role (ยืนยันจาก information_schema.routine_privileges ตรง ๆ) ต้อง
--    `revoke ... from anon` แยกออกมาให้ชัด — มีตัวอย่างที่ทำถูกอยู่แล้ว 1 ตัว (next_entity_id, 0016)
--    แต่ไม่เคยถูกยึดเป็นแพตเทิร์นมาตรฐานให้ RPC ตัวอื่นตามเลย
--
-- 2) 24 ฟังก์ชัน (ตัวช่วย/trigger/รายงาน — ทั้งหมด SECURITY INVOKER ไม่ใช่ DEFINER จึงไม่ใช่ช่อง
--    escalate สิทธิ์ได้จริง) ไม่ได้ตั้ง search_path — ผิดหลัก Postgres security best practice
--    (search_path hijacking) แก้ด้วย ALTER FUNCTION ล้วน ๆ ไม่แตะ logic ข้างในเลย
--
-- 3) reconcile_customer_won_total(p_customer_id) เช็ก "มีลูกค้านี้ไหม" ก่อนเช็กสิทธิ์ — ยืนยันจริง:
--    ยิงด้วย anon ได้ error message ต่างกันระหว่าง "customer 1 not found" กับ "forbidden: ..." —
--    เปิดช่องให้ผู้ไม่ได้ล็อกอินไล่เดา (enumerate) ว่า customer_id ไหนมีอยู่จริงในระบบข้ามทุกสาขาได้
--    (ยังปิดการเข้าถึงข้อมูลจริงอยู่ — แค่รั่ว "มี/ไม่มี" ของเลข id) แก้ด้วยรวมเช็กสิทธิ์+มีอยู่จริงเป็น
--    query เดียว ให้ error message เดียวกันไม่ว่ากรณีไหน

-- ══════════════════════════════════════════════════════════════════════════
-- ① revoke execute จาก anon ให้ครบทุก RPC ที่ตั้งใจให้ "ผู้ล็อกอินแล้วเท่านั้น" เรียกได้
--    (เช็กสิทธิ์ภายในฟังก์ชันเองยังอยู่ครบเหมือนเดิม — นี่คือชั้นป้องกันเพิ่ม ไม่ใช่แทนที่)
-- ══════════════════════════════════════════════════════════════════════════
revoke execute on function public.close_won_quotation(text, bigint, text, text, boolean, jsonb) from anon;
revoke execute on function public.create_quotation(text, text, jsonb) from anon;
revoke execute on function public.hq_customers_filter_options() from anon;
revoke execute on function public.hq_customers_page(text, text, text[], text, int, int, int) from anon;
revoke execute on function public.next_quote_no(text, text) from anon;
revoke execute on function public.reconcile_customer_won_total(bigint) from anon;
revoke execute on function public.relink_customer_quotes(text, bigint, text, boolean) from anon;
revoke execute on function public.replace_responsible_persons(text, jsonb) from anon;
revoke execute on function public.restore_hq_settings(jsonb, jsonb, jsonb, jsonb, jsonb) from anon;
revoke execute on function public.save_dealers(jsonb) from anon;
revoke execute on function public.upsert_customer_for_company(text, jsonb) from anon;
-- guard_profile_privilege: ฟังก์ชัน trigger ล้วน ๆ (NEW/OLD ไม่มีความหมายนอกบริบท trigger) —
--   ไม่มีเหตุผลให้ใครเรียกตรงเลย ตัดสิทธิ์ authenticated ออกด้วย เหลือแค่รันผ่าน trigger เท่านั้น
revoke execute on function public.guard_profile_privilege() from anon, authenticated;
-- is_account_active: คืนแค่สถานะบัญชี "ของผู้เรียกเอง" (auth.uid()) ไม่รั่วข้อมูลคนอื่นแม้ anon เรียก
--   แต่ไม่มีเหตุผลให้ anon เรียกตรงเช่นกัน (ใช้เป็นส่วนประกอบใน RLS policy ของ authenticated เท่านั้น)
revoke execute on function public.is_account_active() from anon;

-- ══════════════════════════════════════════════════════════════════════════
-- ② ตั้ง search_path ให้ครบ 24 ฟังก์ชันที่ขาด (ALTER FUNCTION ล้วน ๆ ไม่แตะ logic)
-- ══════════════════════════════════════════════════════════════════════════
alter function public.auth_role() set search_path = public;
alter function public.auth_dealer() set search_path = public;
alter function public.is_hq() set search_path = public;
alter function public.can_write_master() set search_path = public;
alter function public.can_write_sales() set search_path = public;
alter function public.log_catalog_change() set search_path = public;
alter function public.guard_profile_dealer_exists() set search_path = public;
alter function public.set_lead_dates() set search_path = public;
alter function public.set_quotation_product_line() set search_path = public;
alter function public.sync_quotation_items_count() set search_path = public;
alter function public.set_quotation_date_normalized() set search_path = public;
alter function public.customer_rollup() set search_path = public;
alter function public.network_customer_summary() set search_path = public;
alter function public.parse_baht(text) set search_path = public;
alter function public.parse_thai_date(text) set search_path = public;
alter function public.quotation_salesperson(text) set search_path = public;
alter function public.lead_last_activity_date(jsonb) set search_path = public;
alter function public.expire_quotations(date, integer) set search_path = public;
alter function public.dashboard_quote_summary(date, date, text) set search_path = public;
alter function public.network_quote_range(date, date, text) set search_path = public;
alter function public.dealer_rollup(integer, date, integer, jsonb) set search_path = public;
alter function public.hq_alerts(date, integer, jsonb, integer, integer, integer, integer) set search_path = public;
alter function public.hq_quotations_summary(text, text[], text[], text, date, date, date, text[]) set search_path = public;
alter function public.lead_summary(text[], text, text, text, text, text, date, date) set search_path = public;
alter function public.unassigned_leads(date, integer, jsonb, text[], text, text, text, text, date, date) set search_path = public;
alter function public.leads_page(integer, integer, text, text[], text, text, text, text, date, date, boolean, date, integer, jsonb) set search_path = public;

-- ══════════════════════════════════════════════════════════════════════════
-- ③ reconcile_customer_won_total — รวมเช็ก "มีอยู่จริง" กับ "มีสิทธิ์" เป็นคำสั่งเดียว ปิดช่อง
--    เดาเลข customer_id ข้ามสาขาจาก error message ที่ต่างกัน (ยืนยันจริงด้วย anon key)
-- ══════════════════════════════════════════════════════════════════════════
create or replace function public.reconcile_customer_won_total(p_customer_id bigint)
returns customers
language plpgsql security definer set search_path = public as $$
declare
  result customers;
begin
  select * into result from customers
    where id = p_customer_id and dealer_code = auth_dealer();
  if not found or not can_write_sales() then
    raise exception 'forbidden: no permission to reconcile customer %', p_customer_id;
  end if;

  update customers set total_value = coalesce((
    select sum(total_value) from quotations
    where customer_id = p_customer_id and status = 'won'
  ), 0)
  where id = p_customer_id
  returning * into result;

  return result;
end $$;

revoke execute on function public.reconcile_customer_won_total(bigint) from public, anon;
grant  execute on function public.reconcile_customer_won_total(bigint) to   authenticated;
