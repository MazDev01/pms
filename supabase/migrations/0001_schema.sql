-- Benjamin PMS — Schema (เฟส B) · รันบน Supabase SQL editor
-- คอลัมน์เป็น snake_case · โค้ดแอปแปลงเป็น camelCase ด้วย mappers.ts
-- jsonb = ฟิลด์ที่เป็น array/object (tasks, line_items, price_history, contacts, issuer ...)

-- ── ENUMS ─────────────────────────────────────────────────────────────
create type user_role       as enum ('SUPER_ADMIN','HQ_MANAGEMENT','HQ_STAFF','DEALER_ADMIN','DEALER_SALES','DEALER_SITE');
create type lead_status      as enum ('WAITING','BULLET','QUOTED','FOLLOWUP','NEGO','PAID','CANCELLED');
create type quotation_status as enum ('draft','sent_to_client','won','lost','expired');
create type dealer_status    as enum ('active','inactive');

-- ── PROFILES (1:1 กับ auth.users — ตัวตัดสินสิทธิ์) ────────────────────
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        user_role   not null default 'DEALER_SALES',
  dealer_code text        not null default '',
  name        text        not null default '',
  status      dealer_status not null default 'active',
  avatar      text,
  created_at  timestamptz not null default now()
);

-- ── DEALERS ───────────────────────────────────────────────────────────
create table dealers (
  code           text primary key,
  name           text not null,
  province       text,
  region         text,
  revenue_actual numeric default 0,
  revenue_target numeric default 0,
  win_rate       numeric default 0,
  active_projects integer default 0,
  on_time_pct    numeric default 0,
  status         dealer_status not null default 'active',
  created_at     timestamptz not null default now()
);

-- ── MASTER CATALOG (ราคากลาง — HQ เป็นเจ้าของ) ────────────────────────
create table master_catalog (
  id             text primary key,
  name           text not null,
  spec           text,
  price          numeric default 0,
  unit           text,
  effective_date text,
  image          text,
  subtypes       jsonb default '[]',
  price_history  jsonb default '[]',
  created_at     timestamptz not null default now()
);

-- ── RESPONSIBLE PERSONS (พนักงานขายของสาขา — ไม่ใช่ user login) ────────
create table responsible_persons (
  id          bigint generated always as identity primary key,
  dealer_code text not null,
  name        text not null,
  title       text,
  phone       text,
  email       text,
  active      boolean default true,
  avatar      text
);

-- ── FILES ─────────────────────────────────────────────────────────────
create table files (
  id           bigint generated always as identity primary key,
  dealer_code  text not null,
  name         text not null,
  size         text,
  ext          text,
  category     text,
  project      text,
  uploaded_by  text,
  uploaded_at  text,
  source       text,
  record_id    integer,
  customer_id  integer,
  storage_path text
);

-- ── LEADS ─────────────────────────────────────────────────────────────
create table leads (
  id          bigint primary key,
  dealer_code text not null,
  num_id      integer,
  name        text,
  company     text,
  contact     text,
  phone       text,
  email       text,
  province    text,
  product     text,
  category    text,
  status      lead_status not null default 'WAITING',
  value       text,
  area        text,
  assigned    text,
  source      text,
  note        text,
  customer_id integer,
  lost_reason text,
  report      text,
  tasks       jsonb default '[]',
  activities  jsonb default '[]',
  logo        text,
  created_at  timestamptz not null default now()
);

-- ── QUOTATIONS ────────────────────────────────────────────────────────
create table quotations (
  id            text primary key,
  dealer_code   text not null,
  quote_no      text,
  customer      text,
  project       text,
  total         text,
  total_value   numeric default 0,
  material_cost numeric default 0,
  province      text,
  building_type text,
  area          text,
  status        quotation_status not null default 'draft',
  date          text,
  items         integer default 0,
  line_items    jsonb default '[]',
  customer_id   integer,
  project_id    integer,
  deal_id       integer,
  revision      integer,
  expiry        text,
  note          text,
  issuer        jsonb,
  created_at    timestamptz not null default now()
);

-- ── CUSTOMERS ─────────────────────────────────────────────────────────
create table customers (
  id          bigint primary key,
  dealer_code text not null,
  name        text,
  company     text,
  email       text,
  phone       text,
  address     text,
  province    text,
  category    text,
  status      text default 'active',
  projects    integer default 0,
  join_date   text,
  owner       text,
  initials    text,
  color       text,
  total_value numeric default 0,
  contacts    jsonb default '[]',
  logo        text,
  imported    boolean default false,
  created_at  timestamptz not null default now()
);

-- ── APPOINTMENTS ──────────────────────────────────────────────────────
create table appointments (
  id            bigint primary key,
  dealer_code   text not null,
  company       text,
  contact       text,
  phone         text,
  lead_id       integer,
  project       text,
  building_type text,
  area          text,
  province      text,
  date          text,
  time          text,
  type          text,
  assigned      text,
  status        text,
  note          text
);

-- ── SETTINGS ระดับเครือ (singleton row id=1) ──────────────────────────
create table hq_policy (
  id integer primary key default 1,
  require_approval boolean default true,
  vat integer default 7,
  quote_validity_days integer default 30,
  check (id = 1)
);
create table hq_targets (
  id integer primary key default 1,
  annual_target numeric default 260000000,
  win_rate_target integer default 40,
  on_time_target integer default 85,
  check (id = 1)
);
create table hq_notif_rules (
  id integer primary key default 1,
  alerts jsonb default '{}',
  lead_idle_days integer default 30,
  quote_expiring_days integer default 7,
  dealer_idle_days integer default 30,
  target_achieved_pct integer default 90,
  lost_rate_pct integer default 50,
  lost_rate_min_closed integer default 5,
  check (id = 1)
);
create table dealer_lead_rules (
  dealer_code text primary key,
  follow_up_alert_days integer default 7,
  unassigned_alert_hours integer default 48
);

-- ── AUDIT LOG ─────────────────────────────────────────────────────────
create table audit_log (
  id      bigint generated always as identity primary key,
  "user"  text,
  role    text,
  action  text,
  target  text,
  at      timestamptz not null default now()
);

-- ── INDEXES (คิวรีตาม dealer_code / status บ่อย) ──────────────────────
create index idx_leads_dealer        on leads(dealer_code);
create index idx_quotations_dealer   on quotations(dealer_code);
create index idx_customers_dealer    on customers(dealer_code);
create index idx_appointments_dealer on appointments(dealer_code);
create index idx_files_dealer        on files(dealer_code);
