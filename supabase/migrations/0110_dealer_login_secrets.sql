-- Benjamin PMS — เก็บรหัสผ่านตัวแทนให้ HQ เปิดดูย้อนหลังได้ (บอสสั่ง 5 ส.ค. 69)
--
-- ══════════════════════════════════════════════════════════════════════════
-- ⚠️ อ่านก่อนแก้ไฟล์นี้ — ตารางนี้เก็บของอ่อนไหวที่สุดในระบบ
--
-- ที่มา: Supabase Auth เก็บรหัสผ่านเป็น hash ทางเดียว อ่านกลับไม่ได้เลย (แม้ service_role)
--   แต่ธุรกิจต้องการให้ HQ เปิดดูรหัสของตัวแทนได้ตลอด ไม่ใช่แค่ตอนรีเซ็ตครั้งเดียว
--   → ต้องเก็บ "สำเนา" ไว้ต่างหาก ซึ่งเป็นความเสี่ยงที่รับไว้อย่างรู้ตัว
--
-- เงื่อนไขที่ทำให้ความเสี่ยงนี้พอรับได้ — ห้ามถอดออกทีละข้อโดยไม่คิด:
--   1) ค่าที่เก็บ "เข้ารหัสแล้ว" (AES-256-GCM) ด้วยกุญแจที่อยู่ใน env ฝั่งเซิร์ฟเวอร์เท่านั้น
--      → ฐานข้อมูลหลุดอย่างเดียวยังอ่านไม่ได้ ต้องได้กุญแจไปด้วย (ดู packages/shared/lib/dealerSecret.ts)
--   2) ตารางนี้ "ไม่มี RLS policy เลยแม้แต่อันเดียว" = ไม่มีใครอ่านผ่าน PostgREST ได้
--      เข้าถึงได้ทางเดียวคือ service_role ใน /api/admin/dealers/secret ซึ่งตรวจสิทธิ์ dealers:manage
--      (แพตเทิร์นเดียวกับ rate_limits/entity_counters — ดู 0031, 0065)
--   3) ทุกครั้งที่มีคนเปิดดู ต้องบันทึกลง audit_log ว่าใครดูของสาขาไหน (บังคับในโค้ด route)
--   4) ห้ามส่งค่านี้ไปกับหน้าเว็บโดยไม่มีคนกดดู — จุดที่พลาดครั้งก่อนคือรหัสถูกฝังใน mock.ts
--      แล้วติดไปกับ bundle ของทุกหน้า รวมหน้าล็อกอิน (Critical, ตรวจสอบระบบรอบ 2)
--
-- ⛔ ห้ามเพิ่ม policy ให้ตารางนี้ · ห้าม select ผ่าน anon/authenticated client · ห้าม join เข้า view ใด ๆ
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists public.dealer_login_secrets (
  dealer_code text primary key references public.dealers(code) on update cascade on delete cascade,
  -- ciphertext รูปแบบ "v1:<iv b64>:<tag b64>:<data b64>" — ถอดด้วย DEALER_SECRET_KEY เท่านั้น
  secret      text not null,
  updated_at  timestamptz not null default now(),
  -- ใครเป็นคนตั้ง/รีเซ็ตรหัสนี้ล่าสุด (ชื่อผู้ใช้ HQ) — ใช้ประกอบการตรวจสอบย้อนหลัง
  updated_by  text not null default ''
);

comment on table public.dealer_login_secrets is
  'สำเนารหัสผ่านตัวแทน (เข้ารหัส) ให้ HQ เปิดดูได้ — เข้าถึงผ่าน /api/admin/dealers/secret เท่านั้น ห้ามเพิ่ม RLS policy';

-- เปิด RLS แล้ว "ไม่ใส่ policy" = ปฏิเสธทุกคนที่ไม่ใช่ service_role
alter table public.dealer_login_secrets enable row level security;

-- ถอนสิทธิ์ที่ Supabase ให้มาโดยปริยายกับ object ใหม่ใน public
-- (บทเรียนจาก 0091/0108 — revoke จาก anon อย่างเดียวไม่พอ ต้องถอน PUBLIC ด้วย)
revoke all on public.dealer_login_secrets from public, anon, authenticated;
