# Benjamin PMS — Operator Go-Live Runbook (Supabase จริง)

> **ใครทำ:** ผู้ที่มีสิทธิ์เข้า Supabase Dashboard ของโปรเจกต์ + ถือ service_role key
> **ทำเมื่อไหร่:** ครั้งเดียวตอนเปิดใช้ backend จริง (M9 P0 · แทนที่ขั้นตอนเก่าใน `README.md` ซึ่งล้าสมัย)
> **สถานะตอนนี้:** env ทั้งสองแอปตั้ง `NEXT_PUBLIC_DATA_SOURCE=supabase` + มี URL/anon key แล้ว ·
> ที่ยังขาด = (ก) service_role ฝั่ง HQ server · (ข) เปิด access-token hook · (ค) รัน migration+seed บนโปรเจกต์จริง

ทำตามลำดับ — แต่ละขั้นมีวิธี "เช็กว่าผ่าน" กำกับ

---

## 1) ใช้โปรเจกต์ Supabase ให้ถูกตัว
- ยืนยันว่าเข้าถึง Dashboard ของโปรเจกต์ที่ env ชี้อยู่ได้ (`NEXT_PUBLIC_SUPABASE_URL` ใน `apps/hq/.env.local`)
- คัดลอกไว้จาก **Settings → API**: `Project URL`, `anon key`, **`service_role key`** (อันหลังนี้ลับสุด)

## 2) รัน migrations ทั้งหมด (ตามลำดับชื่อไฟล์)
มี 56 ไฟล์ใน `supabase/migrations/` (0001 → 0057) — **หมายเหตุ: เลข 0051 หายไปโดยตั้งใจ ไม่ใช่ error** (ไม่มีอะไรอ้างถึง)

**วิธี A (แนะนำ):** ผูกโปรเจกต์แล้ว push
```bash
supabase link --project-ref <project-ref>
supabase db push
```
**วิธี B:** เปิด SQL Editor แล้ววางรันทีละไฟล์ตั้งแต่ `0001_schema.sql` เรียงเลขไปจนถึง `0057_hq_alerts.sql`

✅ เช็กผ่าน: ตาราง `profiles`, `dealers`, `quotations`, `leads` ฯลฯ ครบ และ **มี function `public.custom_access_token_hook`, `public.hq_alerts`, `public.customer_rollup`** (Database → Functions)

## 3) เปิด access-token hook (สำคัญมาก — ถ้าไม่เปิด RLS พัง)
Dashboard → **Authentication → Hooks → Customize Access Token** = `public.custom_access_token_hook`

hook นี้ยัด `role` + `dealer_code` ลงใน JWT → RLS ใช้ตัดสินว่าใครเห็นอะไร
ถ้าไม่เปิด: ตัวแทนจะมองไม่เห็นข้อมูลสาขาตัวเอง และ HQ จะไม่ได้สิทธิ์ทั้งเครือ

✅ เช็กผ่าน: หลังตั้ง จะยืนยันได้จริงในขั้น 7 (ล็อกอินแล้วเห็นข้อมูล)

## 4) สร้าง Storage buckets
- `dealer-files` — **private**
- `catalog-images` — public
- `avatars` — public

## 5) ตั้ง ENV
### 5.1 ฝั่ง client (ตั้งไว้แล้ว — แค่ยืนยัน) — ทั้ง `apps/hq/.env.local` และ `apps/dealer/.env.local`
```
NEXT_PUBLIC_DATA_SOURCE=supabase
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

### 5.2 ฝั่ง server (ยังขาด) — **เฉพาะแอป HQ เท่านั้น**
route `/api/admin/dealers` และ `/api/admin/users` (สร้าง/ลบบัญชี) อ่าน `SUPABASE_SERVICE_ROLE_KEY` ฝั่งเซิร์ฟเวอร์

- **ตอน dev (เครื่องตัวเอง):** เพิ่มบรรทัดนี้ใน `apps/hq/.env.local` — **ห้ามใส่ `NEXT_PUBLIC_` นำหน้า**
  ```
  SUPABASE_SERVICE_ROLE_KEY=<service_role key>
  ```
  ตัวแปรที่ไม่มี `NEXT_PUBLIC_` Next.js กันไว้ให้เห็นเฉพาะฝั่งเซิร์ฟเวอร์ ไม่หลุดไป bundle ของ browser
- **ตอน deploy:** ตั้งเป็น secret env var ของแอป HQ บนแพลตฟอร์ม (Vercel/host) — **อย่า** commit ลงไฟล์

> ⚠️ คำเตือนใน `.env.local` ที่เขียน "ห้ามใส่ service_role ที่นี่" หมายถึง **ห้ามใส่แบบ `NEXT_PUBLIC_` และห้ามใส่ในแอป dealer** — การใส่แบบ server-only ในแอป HQ คือที่ที่ถูกต้อง
> แอป **dealer ไม่ต้องมี** key นี้ (ไม่มี route admin)
> key นี้ข้าม RLS ทั้งระบบ — ถ้าหลุดเมื่อไหร่ให้ rotate ที่ Settings → API ทันที

## 6) Seed ข้อมูลตั้งต้น (ครั้งเดียว)
ต้องมี `@supabase/supabase-js` ติดตั้งแล้ว (มีใน devDependencies) · รันจาก root:
```bash
# Git Bash
SUPABASE_URL=https://<project>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<key> node supabase/seed.mjs
SUPABASE_URL=https://<project>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<key> node supabase/seed-catalog.mjs
```
```powershell
# PowerShell
$env:SUPABASE_URL="https://<project>.supabase.co"; $env:SUPABASE_SERVICE_ROLE_KEY="<key>"; node supabase/seed.mjs
$env:SUPABASE_SERVICE_ROLE_KEY="<key>"; node supabase/seed-catalog.mjs
```
- `seed.mjs` = 10 สาขา + auth users + profiles (role/dealer_code) + บัญชี HQ
- `seed-catalog.mjs` = ราคากลาง master catalog

> ⚠️ seed สร้างบัญชีผู้ดูแลตั้งต้น **`admin@benjamin.com` / `benjamin`** (รหัสอ่อน — สำหรับ bootstrap เท่านั้น)
> หลัง go-live ให้เข้าไปเปลี่ยนรหัส หรือสร้าง SUPER_ADMIN ตัวจริงที่หน้า `/hq/users` แล้วลบบัญชี bootstrap ทิ้ง

## 7) ยืนยันว่าใช้งานได้จริง (end-to-end)
1. **การเชื่อมต่อ:** เรียก `checkConnection()` จาก `@pms/shared/lib/data/supabase/client` → ต้องได้ `{ ok: true }`
2. **RLS/hook:** ล็อกอินเป็นตัวแทน (เช่น `sales@cmsteelbuild.co.th`) → เห็นเฉพาะข้อมูลสาขาตัวเอง · ล็อกอิน HQ → เห็นทั้งเครือ
   (ถ้าเห็นว่าง/ไม่เห็นข้อมูลตัวเอง = hook ขั้น 3 ยังไม่เปิด)
3. **service_role (จุดที่เพิ่งเปิด):** ล็อกอินเป็น SUPER_ADMIN → `/hq/users` → กด "เพิ่มผู้ใช้งาน HQ"
   - **ผ่าน:** สร้างได้ + เด้ง modal โชว์อีเมล/รหัสผ่านครั้งเดียว → ผู้ใช้ใหม่ล็อกอินได้จริง
   - **ยัง 501 "ยังไม่ได้ตั้งค่าเซิร์ฟเวอร์":** service_role ยังไม่ถึง process ของ HQ → ตั้ง env ขั้น 5.2 แล้ว **restart dev / redeploy**
   - ทดสอบ "ลบผู้ใช้" (พิมพ์อีเมลยืนยัน) → บัญชีถูกลบถาวร

---

## สถานะจริง (ตรวจ read-only บนโปรเจกต์ `yhhhcrvhkforwsagojho` — 27 ก.ค. 69)
- [x] ขั้น 2 — **migrations รันแล้ว** (ทุกตารางมีครบ: profiles/dealers/quotations/leads/master_catalog/audit_log/appointments)
- [x] ขั้น 3 — **access-token hook เปิดอยู่** (JWT มี claim `user_role`/`dealer_code` · RLS ทำงาน: HQ เห็นทั้งเครือ, anon เห็น 0)
- [x] ขั้น 6 — **seed รันแล้ว** (dealers=10 · profiles=12 · master_catalog=6 · ล็อกอิน `admin@benjamin.com` ได้)
- [~] ขั้น 4 — **buckets: ยืนยันไม่ได้ด้วย anon key** (listBuckets ต้อง service_role) แต่มีเทสต์ Storage ที่ผ่านแล้ว (commit `1c2d2fb`) → `dealer-files` มีจริง · ตรวจ `catalog-images`/`avatars` ใน Dashboard ให้ชัวร์
- [x] ขั้น 5.2 — **`SUPABASE_SERVICE_ROLE_KEY` ใส่ให้ HQ server (dev) แล้ว** · ⚠️ deploy: ยังต้องตั้ง env var เดียวกันบน Vercel ของแอป HQ แยกอีกที
- [x] ขั้น 7.3 — **ยืนยัน E2E ผ่านแล้ว** (27 ก.ค. 69): POST/DELETE `/api/admin/users` บน dev(3002)+production — สร้าง user → บัญชีล็อกอินได้จริง (hook ใส่บทบาทถูก) → อีเมลซ้ำ/ไม่มี JWT/ลบตัวเอง ถูกปฏิเสธ → ลบแล้วล็อกอินไม่ได้อีก · ไม่มี user ทดสอบค้าง

> ⚠️ บัญชี bootstrap `admin@benjamin.com` / `benjamin` **ยังใช้รหัสอ่อนอยู่** — เปลี่ยน/ลบหลังตั้ง SUPER_ADMIN ตัวจริง

โค้ดฝั่งแอปพร้อมหมดแล้ว (route/adapter/hook migration/seed script อยู่ครบใน repo)
