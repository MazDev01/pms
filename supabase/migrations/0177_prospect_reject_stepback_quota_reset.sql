-- ── 0177 · บอสสั่ง 15 ก.ย. 69 "เอาตามที่แนะนำเลย" ─────────────────────────────────────
--
-- 1) คืนสิทธิ์แก้บัญชีเอง: dealer_account_changes.quota_reset_at
--    สำนักงานใหญ่กด "คืนสิทธิ์แก้เอง" → ตั้งเวลาให้แถวที่ตัวแทนแก้เอง (by_self) ที่ยังนับอยู่
--    ประวัติเดิมยังอยู่ครบ แค่ไม่นับโควตาอีก (นับเฉพาะ by_self = true และ quota_reset_at is null)
--    ใครคืนให้สาขาไหน → audit_log (ทำที่ /api/admin/dealers/self-quota)
--
-- 2) ใบเสนอแพ็กเกจถูกปฏิเสธ และไม่มีใบที่ส่งแล้ว/ตอบรับเหลืออยู่
--    → ลูกค้าเป้าหมายถอยจาก "รอตัดสินใจ" กลับไป "นัดคุยแล้ว" ให้เอง
--    ประวัติเขียนว่า "ใบเสนอแพ็กเกจ DP-… ถูกปฏิเสธ → กลับไปนัดคุยแล้ว"
--    ยังมีใบอื่นที่ส่งแล้วค้างอยู่ = ไม่ถอย (ยังรอคำตอบของใบนั้น)

alter table public.dealer_account_changes add column if not exists quota_reset_at timestamptz;

-- ── ประวัติของลูกค้าเป้าหมาย: รับข้อความเหตุผลจากตัวดักอื่นได้ (app.prospect_step_note) ──
--   ค่าเป็นของธุรกรรมเดียว (set_config ... true) และตัวดักที่ตั้งจะล้างกลับเองทันทีหลังอัปเดต
create or replace function public.dealer_prospects_log() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  เหตุผล text := nullif(current_setting('app.prospect_step_note', true), '');
begin
  if tg_op = 'INSERT' then
    insert into public.dealer_prospect_activities (prospect_id, kind, body, to_status)
    values (new.id, 'created',
            'เพิ่มลูกค้าเป้าหมาย' || case when new.status <> 'new' then ' · ขั้น ' || prospect_status_th(new.status) else '' end,
            new.status);
  elsif new.status is distinct from old.status then
    insert into public.dealer_prospect_activities (prospect_id, kind, body, from_status, to_status)
    values (new.id, 'status',
            case
              when เหตุผล is not null then เหตุผล
              when new.status = 'won'  then 'เป็นตัวแทนจำหน่ายแล้ว · รหัส ' || coalesce(new.dealer_code, '—')
              when new.status = 'lost' then 'ปิดว่าไม่สำเร็จ' || coalesce(' · เหตุผล: ' || nullif(btrim(new.lost_reason), ''), '')
              when old.status = 'lost' then 'เปิดติดตามใหม่ · ' || prospect_status_th(new.status)
              else prospect_status_th(old.status) || ' → ' || prospect_status_th(new.status)
            end,
            old.status, new.status);
  end if;
  return null;
end $$;

-- ── ประวัติของใบเสนอแพ็กเกจ + ส่งแล้วเลื่อนไปรอตัดสินใจ + ปฏิเสธแล้วถอยกลับนัดคุยแล้ว ──
create or replace function public.dealer_package_proposals_log() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  ป้าย text := case new.status when 'draft' then 'ร่าง' when 'sent' then 'ส่งแล้ว'
                               when 'accepted' then 'ตอบรับ' when 'rejected' then 'ปฏิเสธ' else new.status end;
begin
  if tg_op = 'INSERT' then
    insert into public.dealer_prospect_activities (prospect_id, kind, body)
    values (new.prospect_id, 'proposal', 'ออกใบเสนอแพ็กเกจ ' || new.proposal_no || ' · ' || ป้าย);
  elsif new.status is distinct from old.status then
    insert into public.dealer_prospect_activities (prospect_id, kind, body)
    values (new.prospect_id, 'proposal', 'ใบเสนอแพ็กเกจ ' || new.proposal_no || ' · ' || ป้าย);
  else
    return null;
  end if;

  if new.status = 'sent' then
    update public.dealer_prospects set status = 'considering'
    where id = new.prospect_id and status = 'meeting';
  elsif tg_op = 'UPDATE' and new.status = 'rejected' and not exists (
    select 1 from public.dealer_package_proposals
    where prospect_id = new.prospect_id and id <> new.id and status in ('sent', 'accepted')
  ) then
    perform set_config('app.prospect_step_note',
      'ใบเสนอแพ็กเกจ ' || coalesce(new.proposal_no, '') || ' ถูกปฏิเสธ → กลับไปนัดคุยแล้ว', true);
    update public.dealer_prospects set status = 'meeting'
    where id = new.prospect_id and status = 'considering';
    perform set_config('app.prospect_step_note', '', true);
  end if;
  return null;
end $$;
