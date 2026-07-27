-- Benjamin PMS — Row-Level Security (เฟส B) · idempotent (drop policy if exists ก่อน create)
-- ตัวแทนเห็น/แก้เฉพาะ dealer_code ตัวเอง · HQ เห็นทั้งเครือ (แก้งานขายตัวแทนไม่ได้)
-- อ่าน claim จาก JWT ที่ access-token hook ใส่ให้ (ดู 0003_functions.sql)
-- หมายเหตุ: policy หลายตัวถูก "แทน" ด้วยเวอร์ชันเข้มขึ้นในใบหลัง (0008/0015/0017/0031/0032/0058) —
--           ใบนี้ตั้งฐานเริ่มต้น · การรัน db push ทั้งลำดับจะจบที่เวอร์ชันล่าสุดเสมอ

-- helper: role / dealer_code จาก JWT
create or replace function auth_role() returns text
  language sql stable as $$ select coalesce(auth.jwt() ->> 'user_role', '') $$;
create or replace function auth_dealer() returns text
  language sql stable as $$ select coalesce(auth.jwt() ->> 'dealer_code', '') $$;
create or replace function is_hq() returns boolean
  language sql stable as $$ select auth_role() like 'HQ_%' or auth_role() = 'SUPER_ADMIN' $$;

-- ── ตารางงานขาย (มี dealer_code) — dealer=สาขาตัวเอง · HQ=อ่านทั้งหมด ──
do $$
declare t text;
begin
  foreach t in array array['leads','quotations','customers','appointments','files','responsible_persons'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %1$s_select on %1$I', t);
    execute format($f$
      create policy %1$s_select on %1$I for select
        using ( is_hq() or dealer_code = auth_dealer() )
    $f$, t);
    execute format('drop policy if exists %1$s_write on %1$I', t);
    execute format($f$
      create policy %1$s_write on %1$I for all
        using ( dealer_code = auth_dealer() )
        with check ( dealer_code = auth_dealer() )
    $f$, t);
  end loop;
end $$;

-- ── ตารางระดับเครือ (HQ เป็นเจ้าของ) — อ่านได้ทุกคน · เขียนเฉพาะ HQ ──
do $$
declare t text;
begin
  foreach t in array array['dealers','master_catalog','hq_policy','hq_targets','hq_notif_rules','dealer_lead_rules'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %1$s_read on %1$I', t);
    execute format('create policy %1$s_read on %1$I for select using ( true )', t);
    execute format('drop policy if exists %1$s_write on %1$I', t);
    execute format('create policy %1$s_write on %1$I for all using ( is_hq() ) with check ( is_hq() )', t);
  end loop;
end $$;

-- ── AUDIT LOG — อ่านเฉพาะ HQ · insert ได้ (ไม่มีใครแก้/ลบ) ──
alter table audit_log enable row level security;
drop policy if exists audit_read   on audit_log;
create policy audit_read   on audit_log for select using ( is_hq() );
drop policy if exists audit_insert on audit_log;
create policy audit_insert on audit_log for insert with check ( true );

-- ── PROFILES — เห็นของตัวเอง + HQ · แก้เฉพาะ SUPER_ADMIN ──
alter table profiles enable row level security;
drop policy if exists profiles_read  on profiles;
create policy profiles_read  on profiles for select using ( id = auth.uid() or is_hq() );
drop policy if exists profiles_write on profiles;
create policy profiles_write on profiles for all using ( auth_role() = 'SUPER_ADMIN' ) with check ( auth_role() = 'SUPER_ADMIN' );
