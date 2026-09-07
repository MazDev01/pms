-- ลบคอลัมน์ "ต้องอนุมัติก่อนส่งใบเสนอราคา" ที่ไม่เคยถูกใช้ (บอสสั่ง 4 ก.ย. 69)
--
-- ที่มา: 0001 สร้าง hq_policy.require_approval ไว้ตั้งแต่โครงร่างแรก ตั้งค่าเริ่มต้นเป็น true
--   แต่ฟีเจอร์อนุมัติไม่เคยถูกสร้างจริง — ไล่ทั้งระบบแล้วพบว่า:
--     · ใบเสนอราคามี 5 สถานะ (ร่าง/ส่งแล้ว/ตอบรับ/ปฏิเสธ/หมดอายุ) ไม่มี "รออนุมัติ"
--     · ไม่มีหน้าอนุมัติ และไม่มีสวิตช์ให้ผู้ดูแลตั้งค่านี้ในหน้าตั้งค่าเลย
--     · ไม่มีโค้ดไหนอ่านค่านี้ไปกั้นการส่งใบสักบรรทัด (ตรวจ 4 ก.ย. 69: ใช้จริง 0 จุด)
--   ผลเสียของการเก็บไว้: ไฟล์สำรองการตั้งค่าที่ส่งให้ลูกค้ามีบรรทัด
--   "ใบเสนอราคาต้องผ่านการอนุมัติก่อนส่ง: ใช่" ซึ่งไม่จริง — ตัวแทนกดส่งได้ทันทีเสมอ
--
-- ⚠️ ถ้าวันหนึ่งธุรกิจต้องการขั้นอนุมัติจริง ต้องสร้างใหม่ทั้งชุด
--    (สถานะ "รออนุมัติ" + หน้าอนุมัติของสำนักงานใหญ่ + แจ้งเตือน + กันการส่งที่ฝั่ง RLS)
--    ไม่ใช่แค่เปิดคอลัมน์นี้กลับมา

alter table public.hq_policy drop column if exists require_approval;

-- RPC เขียนค่าตั้งแบบ all-or-nothing (0093) เคยเซ็ตคอลัมน์นี้ด้วย — ประกาศใหม่ให้ตรงกัน
-- (เนื้อในเหมือน 0093 ทุกประการ ตัดออกเฉพาะบรรทัด require_approval)
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

-- สิทธิ์เหมือนเดิมทุกประการ (0093 + 0096) — ประกาศซ้ำเพราะ create or replace ไม่รีเซ็ตสิทธิ์
-- แต่เขียนไว้ให้ครบเพื่อกันพลาดถ้าฟังก์ชันถูกสร้างใหม่บนฐานที่ยังไม่มีสิทธิ์เดิม
revoke all on function public.restore_hq_settings(jsonb,jsonb,jsonb,jsonb,jsonb) from public;
revoke execute on function public.restore_hq_settings(jsonb,jsonb,jsonb,jsonb,jsonb) from anon;
grant execute on function public.restore_hq_settings(jsonb,jsonb,jsonb,jsonb,jsonb) to authenticated;
