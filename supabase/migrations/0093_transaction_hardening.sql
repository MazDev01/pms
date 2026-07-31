-- Benjamin PMS — Phase 4: Transaction (Enterprise Production Readiness Mission, 31 ก.ค. 69)
--
-- เป้าหมาย: business flow ที่เขียนหลายตาราง/หลายแถวต้อง all-or-nothing จริง ไม่ใช่ยิงหลายคำสั่งแยก
-- แล้วหวังว่าจะไม่มีจุดไหนพังกลางทาง — สคริปต์นี้ปิด 2 จุดที่ปลอดภัยพอจะรวบเป็น RPC เดียวในรอบนี้:
--
--   1) restore_hq_settings() — ปุ่ม "นำเข้า (กู้คืน)" / "คืนค่าเริ่มต้น" ในหน้า HQ ตั้งค่า เดิมยิง
--      Promise.all แยก 4-5 คำขอ (policy/targets/notifRules/lostReasons/company) คนละ UPDATE
--      ถ้าเน็ตหลุดกลางทาง = กู้คืนได้แค่บางส่วน ค่าตั้งเครือทั้งระบบเพี้ยนแบบไม่รู้ตัว
--
--   2) relink_customer_quotes() — ส่วนย่อยของ flow "ปิดการขาย → ผูกลูกค้า" ที่เดิม relink ใบเสนอราคา
--      กำพร้าหลายใบด้วย Promise.all ของ N คำขอ update แยกกัน (N round-trip เขียนแยก) รวบเป็น
--      UPDATE เดียวที่ครอบทุกแถวพร้อมกัน (atomic โดยธรรมชาติ)
--
-- ⚠️ สิ่งที่ "ตั้งใจไม่แตะ" ในรอบนี้: ตัว flow ปิดการขาย (Closed Won) ทั้งก้อน — สร้าง/ผูกลูกค้า →
--    เปลี่ยนสถานะใบเป็น won → รวมยอดลูกค้าใหม่ — เป็นจุดที่เคยพัง production มาแล้ว 3 รอบ
--    (0069→0070→0071) แก้ด้วยการเรียงลำดับ await ฝั่ง JS ให้ถูกต้อง + มี DB CHECK constraint
--    (quotations_won_requires_customer) เป็นเซฟตี้เน็ตกันผลลัพธ์ผิดแบบโครงสร้าง (won ไม่มีลูกค้า
--    เป็นไปไม่ได้ที่ระดับ DB อยู่แล้ว) และมี integration test คุมอยู่ (func-quote-win.spec.ts)
--    การรวบทั้งก้อนเป็น RPC เดียวในรอบนี้โดยไม่มีเครื่องมือรัน integration test เต็มรูปแบบ
--    เสี่ยงเกินไปสำหรับจุดที่แพงที่สุดในระบบ (เงิน+ลูกค้า) — ควรทำแยกต่างหากพร้อมทดสอบเต็มรูปแบบ

-- ══════════════════════════════════════════════════════════════════════════
-- 1) restore_hq_settings — all-or-nothing สำหรับปุ่มนำเข้า/คืนค่าเริ่มต้น
--    รับพารามิเตอร์แยกตามกลุ่ม (null = ไม่แตะกลุ่มนั้น) เพื่อใช้ได้ทั้ง "นำเข้าเฉพาะที่มีในไฟล์"
--    (ของเดิม importAll เช็คทีละ key) และ "คืนค่าเริ่มต้นบางกลุ่ม" (ของเดิม restoreDefaults ส่งครบ 4)
-- ══════════════════════════════════════════════════════════════════════════
create or replace function public.restore_hq_settings(
  p_policy       jsonb default null,
  p_targets      jsonb default null,
  p_notif_rules  jsonb default null,
  p_lost_reasons jsonb default null,
  p_company      jsonb default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not can_write_master() then
    raise exception 'forbidden: no permission to restore hq settings';
  end if;

  if p_policy is not null then
    update hq_policy set
      require_approval    = coalesce((p_policy->>'require_approval')::boolean, require_approval),
      vat                  = coalesce((p_policy->>'vat')::integer, vat),
      quote_validity_days  = coalesce((p_policy->>'quote_validity_days')::integer, quote_validity_days)
    where id = 1;
  end if;

  if p_targets is not null then
    update hq_targets set
      annual_target   = coalesce((p_targets->>'annual_target')::numeric, annual_target),
      win_rate_target = coalesce((p_targets->>'win_rate_target')::integer, win_rate_target),
      on_time_target  = coalesce((p_targets->>'on_time_target')::integer, on_time_target)
    where id = 1;
  end if;

  if p_notif_rules is not null then
    update hq_notif_rules set
      alerts               = coalesce(p_notif_rules->'alerts', alerts),
      lead_idle_days       = coalesce((p_notif_rules->>'lead_idle_days')::integer, lead_idle_days),
      quote_expiring_days  = coalesce((p_notif_rules->>'quote_expiring_days')::integer, quote_expiring_days),
      dealer_idle_days     = coalesce((p_notif_rules->>'dealer_idle_days')::integer, dealer_idle_days),
      target_achieved_pct  = coalesce((p_notif_rules->>'target_achieved_pct')::integer, target_achieved_pct),
      lost_rate_pct        = coalesce((p_notif_rules->>'lost_rate_pct')::integer, lost_rate_pct),
      lost_rate_min_closed = coalesce((p_notif_rules->>'lost_rate_min_closed')::integer, lost_rate_min_closed),
      channels             = coalesce(p_notif_rules->'channels', channels)
    where id = 1;
  end if;

  if p_lost_reasons is not null then
    update hq_sales_journey set
      lost = (select coalesce(array_agg(x), '{}') from jsonb_array_elements_text(p_lost_reasons) x)
    where id = 1;
  end if;

  if p_company is not null then
    update hq_company set
      name    = coalesce(p_company->>'name', name),
      address = coalesce(p_company->>'address', address),
      tax_id  = coalesce(p_company->>'tax_id', tax_id),
      phone   = coalesce(p_company->>'phone', phone),
      email   = coalesce(p_company->>'email', email),
      website = coalesce(p_company->>'website', website)
    where id = 1;
  end if;
end $$;

revoke all on function public.restore_hq_settings(jsonb,jsonb,jsonb,jsonb,jsonb) from public;
grant execute on function public.restore_hq_settings(jsonb,jsonb,jsonb,jsonb,jsonb) to authenticated;

-- ══════════════════════════════════════════════════════════════════════════
-- 2) relink_customer_quotes — ผูกใบเสนอราคากำพร้า (customer_id ว่าง, ชื่อลูกค้าตรงกัน) เข้ากับ
--    ลูกค้าที่เพิ่งสร้าง/พบ ในคำสั่งเดียว (เดิมเป็น Promise.all แยกทีละใบฝั่ง JS)
-- ══════════════════════════════════════════════════════════════════════════
create or replace function public.relink_customer_quotes(
  p_dealer text, p_customer_id bigint, p_company text, p_cascade_won boolean default false
) returns setof quotations
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (can_write_sales() and p_dealer = auth_dealer()) then
    raise exception 'forbidden: no permission to relink quotations for %', p_dealer;
  end if;

  return query
  update quotations
  set customer_id = p_customer_id,
      status = case
        when p_cascade_won and status not in ('lost', 'expired') then 'won'::quotation_status
        else status
      end
  where dealer_code = p_dealer
    and customer_id is null
    and customer = p_company
  returning *;
end $$;

revoke all on function public.relink_customer_quotes(text,bigint,text,boolean) from public;
grant execute on function public.relink_customer_quotes(text,bigint,text,boolean) to authenticated;
