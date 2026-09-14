-- Benjamin PMS — ใบเสนอแพ็กเกจตัวแทน: เพิ่มช่องตัวเลข 3 ช่อง (บอสสั่ง 14 ก.ย. 69 · "เอา 3 ช่อง")
--
--   1) ค่าแรกเข้า (บาท · จ่ายครั้งเดียว) — ใช้คอลัมน์ amount เดิม เปลี่ยนแค่ความหมายให้ชัด
--      (ในไฟล์ของเบนจามินมีคอลัมน์ "DM" ที่มีตัวเลข แต่ยังไม่รู้ว่าย่อมาจากอะไร — จึงไม่ตั้งชื่อตาม DM)
--   2) ระยะสัญญา (เดือน) — ในไฟล์มีรายที่ "พิจารณาแบบ 1 ปี" = ทีมคุยเรื่องระยะเวลากับลูกค้าจริง
--   3) เป้ายอดซื้อต่อปี (บาท) — ตั้งเป็นตัวแทนแล้วกลายเป็น "เป้ายอดขายรายปี" ของสาขา (dealers.revenue_target)
--      ไม่ต้องกรอกซ้ำ · route สร้างตัวแทนอ่านจากใบที่ตอบรับ (หรือใบล่าสุดที่ส่งแล้ว)
--
-- ทั้งสามช่องไม่บังคับ — ว่าง = หน้าจอ/เอกสารขึ้น "—" (ห้ามเติมตัวเลขให้)
alter table public.dealer_package_proposals
  add column if not exists contract_months int
    check (contract_months is null or contract_months between 1 and 120),
  add column if not exists annual_target numeric
    check (annual_target is null or annual_target >= 0);

comment on column public.dealer_package_proposals.amount is 'ค่าแรกเข้า (บาท · จ่ายครั้งเดียว) — ไม่บังคับ';
comment on column public.dealer_package_proposals.contract_months is 'ระยะสัญญา (เดือน) 1–120 — ไม่บังคับ';
comment on column public.dealer_package_proposals.annual_target is 'เป้ายอดซื้อต่อปี (บาท) — ตั้งเป็นตัวแทนแล้วใช้เป็นเป้ายอดขายรายปีของสาขา';

-- ตัวดักเดิม (0172) ต้องล็อกสองช่องใหม่ด้วย — ส่งแล้วแก้ไม่ได้ เหมือนเนื้อหาอื่นในใบ
--   ถ้าไม่เพิ่ม ใบที่ลูกค้าถืออยู่บอก "สัญญา 12 เดือน" แต่ในระบบแก้เป็น 24 ได้เงียบ ๆ
create or replace function public.dealer_package_proposals_before_write() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  y int;
  n int;
begin
  if tg_op = 'INSERT' then
    y := extract(year from (now() at time zone 'Asia/Bangkok'))::int;
    insert into dealer_proposal_counters(year, next_no) values (y, 2)
      on conflict (year) do update set next_no = dealer_proposal_counters.next_no + 1
      returning next_no - 1 into n;
    new.proposal_no := 'DP-' || y || '-' || lpad(n::text, 4, '0');
  else
    new.id := old.id;
    new.prospect_id := old.prospect_id;
    new.proposal_no := old.proposal_no;
    new.created_at := old.created_at;

    if new.status is distinct from old.status and not (
         (old.status = 'draft' and new.status = 'sent')
      or (old.status = 'sent'  and new.status in ('accepted', 'rejected'))
    ) then
      raise exception 'proposal_status: เปลี่ยนสถานะใบเสนอแพ็กเกจจาก % เป็น % ไม่ได้', old.status, new.status;
    end if;

    if old.status <> 'draft' and (
         new.package         is distinct from old.package
      or new.region          is distinct from old.region
      or new.province        is distinct from old.province
      or new.amount          is distinct from old.amount
      or new.contract_months is distinct from old.contract_months
      or new.annual_target   is distinct from old.annual_target
      or new.terms           is distinct from old.terms
      or new.proposed_date   is distinct from old.proposed_date
      or new.valid_until     is distinct from old.valid_until
    ) then
      raise exception 'proposal_locked: ใบที่ส่งแล้วแก้เนื้อหาไม่ได้ — เปลี่ยนได้แค่สถานะ';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
