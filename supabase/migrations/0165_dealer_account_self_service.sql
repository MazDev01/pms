-- ── ตัวแทนแก้อีเมล/รหัสผ่านเข้าระบบเองได้ (บอสสั่ง 28 ส.ค. 69) ────────────────────
--
-- กติกา:
--   • ตัวแทนแก้เองได้ 2 ครั้ง "ตลอดอายุบัญชี" (dealer_account_changes ที่ by_self = true)
--   • ครั้งที่ 3 เป็นต้นไป ต้องเปิดคำขอ (dealer_account_requests) ให้สำนักงานใหญ่อนุมัติก่อน
--   • สำนักงานใหญ่เห็นทุกการเปลี่ยน (audit_log) และเปิดดูรหัสที่ตัวแทนตั้งเองได้
--     — รหัสถูกเก็บเข้ารหัสไว้ใน dealer_login_secrets เหมือนรหัสที่ HQ ตั้งให้ (0xxx เดิม)
--
-- ⚠️ ทั้งสองตารางนี้ "ไม่มี policy" โดยตั้งใจ = เข้าถึงได้ทางเดียวคือ service_role
--    ผ่าน API ของแอปสำนักงานใหญ่ (เหมือน dealer_login_secrets)
--    ถ้าเผลอเปิด policy ให้ authenticated อ่านได้ = ตัวแทนอ่านคำขอ/รหัสของสาขาอื่นได้ทันที

create table if not exists dealer_account_changes (
  id            bigserial primary key,
  dealer_code   text        not null,
  kind          text        not null check (kind in ('email','password','both')),
  old_email     text,
  new_email     text,
  -- true = ตัวแทนแก้เอง (นับโควตา) · false = สำนักงานใหญ่เป็นคนเปลี่ยนให้ / อนุมัติคำขอ
  by_self       boolean     not null default true,
  changed_at    timestamptz not null default now()
);
create index if not exists dealer_account_changes_code_idx
  on dealer_account_changes (dealer_code, changed_at desc);

create table if not exists dealer_account_requests (
  id            bigserial primary key,
  dealer_code   text        not null,
  kind          text        not null check (kind in ('email','password','both')),
  new_email     text,
  -- รหัสผ่านใหม่ที่ขอ — เข้ารหัสด้วย DEALER_SECRET_KEY เหมือน dealer_login_secrets
  -- (เก็บไว้เพื่อให้ "อนุมัติแล้วมีผลทันที" โดยไม่ต้องให้ตัวแทนพิมพ์ใหม่)
  secret        text,
  status        text        not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_at  timestamptz not null default now(),
  decided_at    timestamptz,
  decided_by    text,
  reason        text
);
create index if not exists dealer_account_requests_status_idx
  on dealer_account_requests (status, requested_at desc);

-- มีคำขอค้างได้ทีละใบต่อสาขา — กันตัวแทนกดรัวจนสำนักงานใหญ่เห็นคำขอซ้ำสิบใบ
create unique index if not exists dealer_account_requests_one_pending
  on dealer_account_requests (dealer_code) where status = 'pending';

alter table dealer_account_changes  enable row level security;
alter table dealer_account_requests enable row level security;
