-- Benjamin PMS — เก็บสำเนารหัสผ่านของผู้ใช้สำนักงานใหญ่ ให้เจ้าของบัญชีเปิดดูเองได้ (บอสสั่ง 2 ก.ย. 69)
--
-- ══════════════════════════════════════════════════════════════════════════
-- ⚠️ อ่านก่อนแก้ไฟล์นี้ — ตารางนี้เก็บของอ่อนไหวที่สุดในระบบ (คู่กับ dealer_login_secrets ใบ 0110)
--
-- ที่มา: Supabase Auth เก็บรหัสผ่านเป็น hash ทางเดียว อ่านกลับไม่ได้เลยแม้แต่ service_role
--   ฝั่งตัวแทนแก้ด้วยการเก็บ "สำเนาที่เข้ารหัสไว้" (0110) — ใบนี้ทำแบบเดียวกันให้ฝั่งสำนักงานใหญ่
--   ต่างกันตรง "ใครดูได้": ของตัวแทน HQ เป็นคนดู · ของใบนี้ **เจ้าของบัญชีดูของตัวเองเท่านั้น**
--
-- เงื่อนไขที่ทำให้ความเสี่ยงนี้พอรับได้ — ห้ามถอดออกทีละข้อโดยไม่คิด:
--   1) ค่าที่เก็บเข้ารหัส AES-256-GCM ด้วยกุญแจใน env ฝั่งเซิร์ฟเวอร์ (DEALER_SECRET_KEY)
--      ฐานข้อมูลหลุดอย่างเดียวยังอ่านไม่ได้ ต้องได้กุญแจไปด้วย
--   2) ไม่มี RLS policy เลยแม้แต่อันเดียว = ไม่มีใครอ่านผ่าน PostgREST ได้
--      เข้าถึงได้ทางเดียวคือ service_role ใน /api/account/hq-secret
--   3) จะเห็นรหัสได้ต้องยืนยันด้วยเลขที่ส่งไปทางอีเมลของบัญชีนั้นก่อนทุกครั้ง
--      (จอที่เปิดค้างไว้ในออฟฟิศจึงยังเปิดดูไม่ได้ ต้องเข้าถึงกล่องจดหมายได้จริง)
--   4) ทุกครั้งที่เปิดดูต้องลง audit_log
--
-- ⛔ ห้ามเพิ่ม policy ให้ตารางนี้ · ห้าม select ผ่าน anon/authenticated · ห้าม join เข้า view ใด ๆ
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists public.hq_login_secrets (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  -- ciphertext รูปแบบ "v1:<iv b64>:<tag b64>:<data b64>" — ถอดด้วย DEALER_SECRET_KEY เท่านั้น
  secret     text not null,
  updated_at timestamptz not null default now()
);

comment on table public.hq_login_secrets is
  'สำเนารหัสผ่านผู้ใช้สำนักงานใหญ่ (เข้ารหัส) ให้เจ้าของบัญชีเปิดดูเองได้ — เข้าถึงผ่าน /api/account/hq-secret เท่านั้น ห้ามเพิ่ม RLS policy';

-- เปิด RLS แล้ว "ไม่ใส่ policy" = ปฏิเสธทุกคนที่ไม่ใช่ service_role
alter table public.hq_login_secrets enable row level security;

-- ถอนสิทธิ์ที่ Supabase ให้มาโดยปริยายกับ object ใหม่ใน public
-- (บทเรียนจาก 0091/0108/0110 — revoke จาก anon อย่างเดียวไม่พอ ต้องถอน PUBLIC ด้วย)
revoke all on public.hq_login_secrets from public, anon, authenticated;
