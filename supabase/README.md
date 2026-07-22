# Benjamin PMS — ตั้งค่า Supabase Backend (เฟส B)

> ไฟล์ในโฟลเดอร์นี้ = ทุกอย่างที่ **เตรียมไว้ก่อนเชื่อม backend** · เอกสารออกแบบเต็ม: [../BACKEND-DESIGN.md](../BACKEND-DESIGN.md)

## ไฟล์
```
migrations/
  0001_schema.sql     ตาราง + enum + index (14 ตาราง)
  0002_rls.sql        RLS — ตัวแทนเห็นเฉพาะสาขาตัวเอง · HQ เห็นทั้งเครือ
  0003_functions.sql  access-token hook (role/dealer_code → JWT) + trigger (quote no / won→customer / audit)
```

## ขั้นตอนติดตั้ง (ทำครั้งเดียว)
1. **สร้าง Supabase project** → คัดลอก `Project URL` + `anon key`
2. **รัน SQL ตามลำดับ** (SQL Editor): `0001_schema` → `0002_rls` → `0003_functions`
3. **เปิด access-token hook**: Dashboard → Authentication → Hooks → *Customize Access Token* = `public.custom_access_token_hook`
   (ถ้าไม่เปิด RLS จะไม่รู้ role/dealer_code → ตัวแทนจะมองไม่เห็นข้อมูลตัวเอง)
4. **สร้าง Storage buckets**: `dealer-files` (private), `catalog-images` (public), `avatars` (public)
5. **ตั้ง ENV** ใน `apps/dealer/.env.local` และ `apps/hq/.env.local`:
   ```
   NEXT_PUBLIC_DATA_SOURCE=supabase
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```
6. **ทดสอบการเชื่อมต่อ**: เรียก `checkConnection()` จาก `@pms/shared/lib/data/supabase/client` → ต้องได้ `{ ok: true }`

## สถานะโค้ดฝั่งแอป (พร้อมแล้ว)
- ✅ `client.ts` — Supabase client จาก ENV + `checkConnection()`
- ✅ `SupabaseAdapter.ts` — ทุก repository map เข้าตาราง + กรอง `dealer_code` (คู่กับ RLS)
- ✅ `mappers.ts` — แปลง snake_case (DB) ↔ camelCase (type)
- ✅ สลับด้วย ENV: `DATA_SOURCE=supabase` → `index.ts` ใช้ `SupabaseAdapter` อัตโนมัติ (หน้า/context ไม่ต้องแก้)

## ยังต้องทำตอน "เชื่อมจริง" (หลังมี project + รัน migration)
- [ ] **Seed ข้อมูล** mock → ตาราง (สคริปต์ครั้งเดียว · ให้ `created_at` จริง เลิกพึ่ง APP_NOW)
- [ ] **ต่อ SalesContext → repository** (Integration Step 1) — ให้หน้าอ่าน/เขียนผ่าน data layer แทน `usePersistentState`
- [ ] **auth.ts → Supabase Auth** (`signInWithPassword`) + ย้ายบัญชี → ตาราง `profiles`
- [ ] **Realtime** subscription แทน event bus (HQ เห็น dealer อัปเดตสด)

## จุดสำคัญ
- **RLS คือตัวทำให้ "HQ ดูข้อมูล dealer ได้"** — 2 แอปคนละ localStorage แต่แชร์ DB เดียว · RLS ตัดสินว่าใครเห็นอะไร
- ถ้ายังไม่ตั้ง ENV supabase → ระบบใช้ `LocalAdapter` (localStorage) เหมือนเดิม ไม่พัง
