-- Benjamin PMS — ลูกค้าเป้าหมาย (HQ): เส้นทางการทำงาน · บันทึกการติดต่อ · ประวัติ
--   บอสสั่ง 14 ก.ย. 69: "ทำให้ ลูกค้าเป้าหมาย ออกแบบการทำออกมาใช้งานให้เสร็จ"
--
-- ══════════════════════════════════════════════════════════════════════════
-- แนวเดียวกับลูกค้าเป้าหมายของตัวแทน (สเปกหลัก: เส้นทางคิดจากงาน · ประวัติระบบบันทึกเอง แก้/ลบไม่ได้)
--
--   1) เลื่อนขั้นได้ทีละขั้น ห้ามข้ามขั้น (เดินหน้า/ถอยหลังทีละหนึ่ง)
--        รอติดต่อ → ติดต่อแล้ว → ส่งข้อมูลบริษัทแล้ว → นัดคุยแล้ว → รอตัดสินใจ
--      • "รอตัดสินใจ" ต้องมีใบเสนอแพ็กเกจที่ส่งแล้ว/ตอบรับ (ของจริงที่ถึงมือผู้สนใจ)
--      • ปิดว่าไม่สำเร็จได้ทุกขั้น · เปิดติดตามใหม่จากไม่สำเร็จได้
--      • เป็นตัวแทนแล้ว = จบ เปลี่ยนขั้นไม่ได้อีก (มีสาขาและบัญชีจริงแล้ว)
--      ⚠️ บังคับที่ฐานข้อมูล ไม่ใช่แค่หน้าจอ — ใครยิง API ตรงก็โดนกติกาเดียวกัน
--      ⚠️ บังคับเฉพาะ "การแก้ไข" ไม่บังคับตอนเพิ่มรายใหม่ — นำเข้าข้อมูลเก่าที่คุยถึงขั้นไหนแล้วต้องใส่ขั้นนั้นได้เลย
--
--   2) บันทึกการติดต่อ (ช่องทาง · คุยอะไร · นัดติดตามครั้งถัดไป)
--      บันทึกแล้วระบบทำต่อให้เอง: ติดต่อล่าสุด · นัดติดตาม · วันเริ่มติดต่อ (ถ้ายังว่าง) · รอติดต่อ → ติดต่อแล้ว
--
--   3) ประวัติ (dealer_prospect_activities) — ระบบเขียนเองจากตัวดัก ผู้ใช้เพิ่มได้แค่ "บันทึกการติดต่อ"
--      ไม่มีสิทธิ์แก้/ลบแถวใด ๆ · ผู้ทำและเวลาฐานข้อมูลตั้งเอง ปลอมไม่ได้
--      ลบลูกค้าเป้าหมายทั้งราย = ประวัติหายตาม (สเปก: รายที่ไม่มีโอกาสต้องลบได้)
-- ══════════════════════════════════════════════════════════════════════════

alter table public.dealer_prospects
  add column if not exists last_contact_at timestamptz;
comment on column public.dealer_prospects.last_contact_at is
  'ติดต่อล่าสุด — ตัวดักตั้งให้เมื่อมีบันทึกการติดต่อ (ห้ามแอปเขียนเอง) · ว่าง = ยังไม่เคยบันทึกการติดต่อ';

create table if not exists public.dealer_prospect_activities (
  id             bigint generated always as identity primary key,
  prospect_id    bigint not null references public.dealer_prospects(id) on delete cascade,
  kind           text not null check (kind in ('created', 'status', 'contact', 'proposal')),
  channel        text,          -- เฉพาะบันทึกการติดต่อ: โทรศัพท์ / LINE / Facebook / พบตัว / อีเมล / อื่น ๆ
  body           text not null check (btrim(body) <> '' and char_length(body) <= 2000),
  from_status    text,          -- เฉพาะการเปลี่ยนขั้น (ใช้พากลับขั้นเดิมตอนเปิดติดตามใหม่)
  to_status      text,
  next_follow_up date,          -- เฉพาะบันทึกการติดต่อ
  actor          text not null default 'system',
  created_at     timestamptz not null default now()
);
comment on table public.dealer_prospect_activities is
  'ประวัติลูกค้าเป้าหมาย (HQ) — ระบบบันทึกเอง + บันทึกการติดต่อ · แก้/ลบไม่ได้ (0174)';

create index if not exists dealer_prospect_activities_prospect_idx
  on public.dealer_prospect_activities (prospect_id, created_at desc, id desc);

-- ── ป้ายภาษาไทย / ลำดับขั้น — ชุดเดียวกับ lib/dealerProspects.ts · lib/prospectJourney.ts ──
create or replace function public.prospect_status_th(s text) returns text
  language sql immutable set search_path = public as $$
  select case s
    when 'new' then 'รอติดต่อ'           when 'contacted' then 'ติดต่อแล้ว'
    when 'profile_sent' then 'ส่งข้อมูลบริษัทแล้ว' when 'meeting' then 'นัดคุยแล้ว'
    when 'considering' then 'รอตัดสินใจ'  when 'won' then 'เป็นตัวแทนแล้ว'
    when 'lost' then 'ไม่สำเร็จ'          else s end
$$;

create or replace function public.prospect_stage_no(s text) returns int
  language sql immutable set search_path = public as $$
  select case s when 'new' then 0 when 'contacted' then 1 when 'profile_sent' then 2
                when 'meeting' then 3 when 'considering' then 4 else null end
$$;

-- ── ประวัติย้อนหลังของข้อมูลที่มีอยู่แล้ว (ทำก่อนสร้างตัวดัก — ตัวดักจะทับเวลาเป็น "ตอนนี้") ──
--   ใส่เฉพาะสิ่งที่รู้จริง: วันที่เพิ่มรายชื่อ · วันที่ออกใบ · สถานะปัจจุบันของใบ (ขั้นกลางทางไม่เคยเก็บ = ไม่เดา)
insert into public.dealer_prospect_activities (prospect_id, kind, body, to_status, actor, created_at)
select p.id, 'created', 'เพิ่มลูกค้าเป้าหมาย', p.status, 'system', p.created_at
from public.dealer_prospects p
where not exists (select 1 from public.dealer_prospect_activities a where a.prospect_id = p.id);

insert into public.dealer_prospect_activities (prospect_id, kind, body, actor, created_at)
select d.prospect_id, 'proposal', 'ออกใบเสนอแพ็กเกจ ' || d.proposal_no, 'system', d.created_at
from public.dealer_package_proposals d
where not exists (select 1 from public.dealer_prospect_activities a
                  where a.prospect_id = d.prospect_id and a.kind = 'proposal');

insert into public.dealer_prospect_activities (prospect_id, kind, body, actor, created_at)
select d.prospect_id, 'proposal',
       'ใบเสนอแพ็กเกจ ' || d.proposal_no || ' · ' ||
         case d.status when 'sent' then 'ส่งแล้ว' when 'accepted' then 'ตอบรับ' else 'ปฏิเสธ' end,
       'system', d.updated_at
from public.dealer_package_proposals d
where d.status <> 'draft'
  and (select count(*) from public.dealer_prospect_activities a
       where a.prospect_id = d.prospect_id and a.kind = 'proposal' and a.body like '% · %') = 0;

-- ── ประวัติ: ผู้ทำ/เวลา ฐานข้อมูลตั้งเองเสมอ ──────────────────────────────────────
create or replace function public.dealer_prospect_activities_before_insert() returns trigger
  language plpgsql set search_path = public as $$
begin
  new.actor := audit_actor();
  new.created_at := now();
  new.body := btrim(new.body);
  if new.kind = 'contact' then
    new.channel := nullif(btrim(coalesce(new.channel, '')), '');
    if new.channel is null then
      raise exception 'prospect_contact: ต้องระบุช่องทางที่ติดต่อ';
    end if;
    new.from_status := null;
    new.to_status := null;
  else
    new.next_follow_up := null;
  end if;
  return new;
end $$;

drop trigger if exists dealer_prospect_activities_before_insert on public.dealer_prospect_activities;
create trigger dealer_prospect_activities_before_insert before insert on public.dealer_prospect_activities
  for each row execute function public.dealer_prospect_activities_before_insert();

-- ── บันทึกการติดต่อ → ติดต่อล่าสุด / นัดติดตาม / วันเริ่มติดต่อ / รอติดต่อ → ติดต่อแล้ว ──
--   security definer: ผู้บันทึกผ่าน RLS ของตารางประวัติมาแล้ว (ผู้ดูแลข้อมูลกลาง) — ตรงนี้แค่ทำงานต่อให้
create or replace function public.dealer_prospect_activities_after_contact() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  -- ตัวดักกติกาขั้นกันไม่ให้แอปทับ last_contact_at — เปิดสวิตช์เฉพาะคำสั่งนี้ (ปิดคืนทันทีหลังใช้)
  perform set_config('app.prospect_contact', 'on', true);
  update public.dealer_prospects set
    last_contact_at = new.created_at,
    follow_up       = coalesce(new.next_follow_up, follow_up),
    first_contact   = coalesce(first_contact, (new.created_at at time zone 'Asia/Bangkok')::date),
    status          = case when status = 'new' then 'contacted' else status end
  where id = new.prospect_id;
  perform set_config('app.prospect_contact', 'off', true);
  return null;
end $$;

drop trigger if exists dealer_prospect_activities_after_contact on public.dealer_prospect_activities;
create trigger dealer_prospect_activities_after_contact after insert on public.dealer_prospect_activities
  for each row when (new.kind = 'contact') execute function public.dealer_prospect_activities_after_contact();

-- ── กติกาเลื่อนขั้น ────────────────────────────────────────────────────────────────
create or replace function public.dealer_prospects_stage_guard() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  a int := prospect_stage_no(old.status);
  b int := prospect_stage_no(new.status);
begin
  -- ติดต่อล่าสุดตั้งได้จากบันทึกการติดต่อทางเดียว — แอปส่งทั้งแถวกลับมา ห้ามทับค่าที่ตัวดักตั้งไว้
  if current_setting('app.prospect_contact', true) is distinct from 'on' then
    new.last_contact_at := old.last_contact_at;
  end if;

  if new.status is not distinct from old.status then return new; end if;

  if old.status = 'won' then
    raise exception 'prospect_stage: รายนี้เป็นตัวแทนจำหน่ายแล้ว เปลี่ยนขั้นไม่ได้';
  end if;
  if new.status = 'won' then
    if new.dealer_code is null then
      raise exception 'prospect_stage: สถานะ “เป็นตัวแทนแล้ว” ต้องผูกกับตัวแทนจำหน่าย';
    end if;
    return new;
  end if;
  if new.status = 'lost' then return new; end if;

  -- จากขั้นติดตามไปขั้นติดตาม: ทีละหนึ่งขั้นเท่านั้น (เปิดติดตามใหม่จากไม่สำเร็จ ไปขั้นเดิมได้เลย)
  if old.status <> 'lost' and abs(b - a) <> 1 then
    raise exception 'prospect_stage: เลื่อนขั้นได้ทีละขั้น ห้ามข้ามขั้น (% → %)',
      prospect_status_th(old.status), prospect_status_th(new.status);
  end if;
  if new.status = 'considering' and not exists (
    select 1 from public.dealer_package_proposals
    where prospect_id = new.id and status in ('sent', 'accepted')
  ) then
    raise exception 'prospect_stage: ต้องส่งใบเสนอแพ็กเกจตัวแทนก่อน ถึงจะเป็น “รอตัดสินใจ”';
  end if;
  return new;
end $$;

drop trigger if exists dealer_prospects_stage_guard on public.dealer_prospects;
create trigger dealer_prospects_stage_guard before update on public.dealer_prospects
  for each row execute function public.dealer_prospects_stage_guard();

-- ตอนเพิ่มรายใหม่: ติดต่อล่าสุดต้องมาจากบันทึกการติดต่อเท่านั้น
create or replace function public.dealer_prospects_insert_clean() returns trigger
  language plpgsql set search_path = public as $$
begin
  new.last_contact_at := null;
  return new;
end $$;

drop trigger if exists dealer_prospects_insert_clean on public.dealer_prospects;
create trigger dealer_prospects_insert_clean before insert on public.dealer_prospects
  for each row execute function public.dealer_prospects_insert_clean();

-- ── ประวัติของลูกค้าเป้าหมาย: เพิ่มราย / เปลี่ยนขั้น ─────────────────────────────────
create or replace function public.dealer_prospects_log() returns trigger
  language plpgsql security definer set search_path = public as $$
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
              when new.status = 'won'  then 'เป็นตัวแทนจำหน่ายแล้ว · รหัส ' || coalesce(new.dealer_code, '—')
              when new.status = 'lost' then 'ปิดว่าไม่สำเร็จ' || coalesce(' · เหตุผล: ' || nullif(btrim(new.lost_reason), ''), '')
              when old.status = 'lost' then 'เปิดติดตามใหม่ · ' || prospect_status_th(new.status)
              else prospect_status_th(old.status) || ' → ' || prospect_status_th(new.status)
            end,
            old.status, new.status);
  end if;
  return null;
end $$;

drop trigger if exists dealer_prospects_log on public.dealer_prospects;
create trigger dealer_prospects_log after insert or update on public.dealer_prospects
  for each row execute function public.dealer_prospects_log();

-- ── ประวัติของใบเสนอแพ็กเกจ + ส่งใบแล้วเลื่อน "นัดคุยแล้ว" → "รอตัดสินใจ" ให้เอง ──────────
--   ไม่บันทึกตอนลบใบร่าง: ลบลูกค้าเป้าหมายทั้งราย ใบถูกลบตาม — เขียนประวัติอ้างรายที่กำลังถูกลบจะพังทั้งคำสั่ง
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
  end if;
  return null;
end $$;

drop trigger if exists dealer_package_proposals_log on public.dealer_package_proposals;
create trigger dealer_package_proposals_log after insert or update on public.dealer_package_proposals
  for each row execute function public.dealer_package_proposals_log();

-- ── สิทธิ์ ──────────────────────────────────────────────────────────────────────
--   อ่าน = ฝั่งสำนักงานใหญ่ (is_hq) · เพิ่ม = ผู้ดูแลข้อมูลกลาง และเพิ่มได้แค่ "บันทึกการติดต่อ"
--   ไม่มีสิทธิ์แก้/ลบ — ประวัติต้องเชื่อถือได้ · ตัวแทนจำหน่ายไม่เห็นสักแถว
alter table public.dealer_prospect_activities enable row level security;

revoke all on public.dealer_prospect_activities from public, anon, authenticated;
grant select, insert on public.dealer_prospect_activities to authenticated;

drop policy if exists dealer_prospect_activities_read on public.dealer_prospect_activities;
create policy dealer_prospect_activities_read on public.dealer_prospect_activities
  for select using ( is_hq() );

drop policy if exists dealer_prospect_activities_contact on public.dealer_prospect_activities;
create policy dealer_prospect_activities_contact on public.dealer_prospect_activities
  for insert with check ( can_write_master() and kind = 'contact' );
