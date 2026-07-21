# Benjamin PMS — โครงสร้างระบบ Login ตามสิทธิ์ผู้ใช้ (Auth Design)

> **สถานะ:** เอกสารออกแบบ (design-only) — ยังไม่เขียนโค้ด ยังไม่แตะ Supabase
> **ขอบเขต:** วางโครงสร้างระบบเข้าสู่ระบบ + การควบคุมสิทธิ์ตาม role ทั้ง 6 · เตรียมต่อ backend จริง (Supabase)
> **ที่มา:** เขียนจากการอ่านโค้ดจริง — ทุกจุดอ้าง `ไฟล์:บรรทัด`
> เอกสารพี่น้อง: [PROJECT-BRIEF.md](PROJECT-BRIEF.md) (โครงสร้างระบบทั้งหมด)

---

## สภาพปัจจุบัน (ยืนยันจากโค้ด)

| จุด | ความจริงตอนนี้ | ไฟล์ |
|---|---|---|
| หน้า login | มี 2 หน้า แต่ **ไม่ตรวจ email/password** — กรอกอะไรก็ได้ กด → `setTimeout(700ms)` → `login()` | `(auth)/login/page.tsx:44-51`, `login/hq/page.tsx:36-43` |
| `login(key)` | รับได้แค่ `"hq" \| "dealer"` = 2 session ตายตัว | `RoleContext.tsx:15,43-48` |
| role | มี **6 role** + `ROLE_PERMISSIONS` ครบ แต่ล็อกอินเข้าได้แค่ 2 (hq→`HQ_MANAGEMENT`, dealer→`DEALER_ADMIN`) — อีก 4 role เข้าไม่ถึง | `permissions.ts:23-30`, `mock.ts:19-34` |
| การบังคับสิทธิ์ | `can(permission)` มีอยู่ **แต่แทบไม่ถูกเรียก** — หน้าจริงเช็ค `isHQ` (binary) แทน | `RoleContext.tsx:65` |
| ขอบเขตข้อมูล | "เห็นเฉพาะสาขาตัวเอง" บังคับที่ **frontend** (`filter dealerCode`) — เลี่ยงได้ถ้า query ตรง | หลายหน้า |
| บัญชีผู้ใช้จริง | **มีอยู่แล้ว 2 คลัง** — ผู้ใช้ HQ ใน `hq_users_v4` (UsersPanel) + credentials ตัวแทนใน `hq_dealers_v4` | `UsersPanel.tsx`, `mock.ts` |

**สรุปช่องว่าง:** ไม่ต้องสร้างคลังผู้ใช้ใหม่ — แค่ทำให้ login **ตรวจจริง** กับคลังที่มีอยู่ แล้วจ่าย role ที่แท้จริงให้ session และบังคับสิทธิ์ตาม role

---

## โครงสร้าง 5 ชั้น (ภาพรวม)

```
ชั้น 1  USER STORE     คลังบัญชี — authenticate(email,pwd) → AuthUser | null
   ↓
ชั้น 2  AUTH           ตรวจตัวตน — รหัสผิด/บัญชีปิด → error · สำเร็จ → สร้าง session
   ↓
ชั้น 3  SESSION        RoleContext ถือ role จริงทั้ง 6 · scopeAll คำนวณจาก role
   ↓
ชั้น 4  ROUTE GUARD    กันเข้าหน้าที่ไม่มีสิทธิ์ (AuthGuard + hq/layout + permission)
   ↓
ชั้น 5  UI GATING      ซ่อน/disable ปุ่มตาม can(permission) ผ่าน <Gate>
```

**หลักคิดสำคัญ:** วาง `auth.ts` เป็น **interface กลาง** — เฟส A อ่าน localStorage, เฟส B ต่อ Supabase → เปลี่ยน backend แก้แค่ไฟล์เดียว หน้า/Context/Guard ไม่ต้องรู้ว่า backend คือใคร

---

## แม็พ role → สิทธิ์ (ใช้ ROLE_PERMISSIONS ที่มีอยู่)

| Role | login ที่ | เห็นข้อมูล | ทำได้ |
|---|---|---|---|
| `SUPER_ADMIN` | /login/hq | ทั้งเครือ | ทุกอย่าง + จัดการผู้ใช้ |
| `HQ_MANAGEMENT` | /login/hq | ทั้งเครือ | ตั้งนโยบาย/ราคา/เป้า/ตัวแทน |
| `HQ_STAFF` | /login/hq | ทั้งเครือ | **ดู+วิเคราะห์อย่างเดียว** (ไม่มี catalog/dealers) |
| `DEALER_ADMIN` | /login | สาขาตัวเอง | งานขายครบ + analytics |
| `DEALER_SALES` | /login | สาขาตัวเอง | งานขายครบ (ไม่มี analytics) |
| `DEALER_SITE` | /login | สาขาตัวเอง | **อ่านลีด/ลูกค้าอย่างเดียว** |

`scopeAll` (isHQ) = `["SUPER_ADMIN","HQ_MANAGEMENT","HQ_STAFF"].includes(role)` — คำนวณจาก role ไม่ hardcode

---

# เฟส A — โครง role ในแอป (ไม่แตะ backend)

ทำได้ทันทีโดยไม่ต้องมี Supabase — ตรวจจริงกับคลัง localStorage ที่มีอยู่

## A1. USER STORE (ชั้น 1) — รวม 2 คลังเดิมเป็นแหล่งเดียว
```
authenticate(email, password) → ค้นใน 2 คลัง:
  • hq_users_v4      → ผู้ใช้ HQ  (role: super_admin / hq_management / hq_staff)
  • hq_dealers_v4    → ตัวแทน     (role: dealer_admin, พร้อม dealerCode)
คืน AuthUser { email, role, dealerCode, name, status } หรือ null
```

## A2. โมเดลข้อมูลที่ต้องเพิ่ม (mock.ts)
```ts
type AuthUser = {
  email: string;
  passwordHash: string;   // demo อาจ plain — เฟส B ย้ายไป Supabase (bcrypt)
  role: UserRole;         // ครบทั้ง 6
  name: string;
  dealerCode: string;     // "" สำหรับ HQ
  status: "active" | "inactive";
};

// ขยาย MockSession: + email · เปลี่ยน scopeAll ให้คำนวณจาก role
scopeAll = ["SUPER_ADMIN","HQ_MANAGEMENT","HQ_STAFF"].includes(role)
```

## A3. AUTH (ชั้น 2) — login ตรวจจริง
```
login(email, password):
  1. หา user · ไม่เจอ/รหัสผิด → error "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
  2. status = inactive       → error "บัญชีถูกปิดใช้งาน ติดต่อผู้ดูแล"
  3. สำเร็จ → สร้าง session จาก user (role จริง ไม่ใช่แค่ hq/dealer)
```

## A4. SESSION (ชั้น 3) — RoleContext
```
• login(email, pwd) แทน login(key)
• session ถือ role จริงทั้ง 6
• persist: pms_session_key เก็บ "email" (แทน "hq"/"dealer")
```

## A5. ROUTE GUARD (ชั้น 4)
```
• AuthGuard: ยังไม่ล็อกอิน → /login                    (มีแล้ว)
• hq/layout: !isHQ → /dashboard                        (มีแล้ว)
• + DEALER_SITE (อ่านอย่างเดียว) → กันหน้าที่ต้อง create/update
• + เช็ค can(permission) ต่อ route ที่อ่อนไหว
```

## A6. UI GATING (ชั้น 5) — คอมโพเนนต์ `<Gate>` ใหม่
```tsx
<Gate permission="dealers:manage"> ...ปุ่มเพิ่ม/ลบตัวแทน... </Gate>
<Gate permission="catalog:edit">   ...ปุ่มปรับราคากลาง...   </Gate>
<Gate permission="leads:update">   ...แก้ลีด (DEALER_SITE เห็นแต่แก้ไม่ได้)... </Gate>
```

## ไฟล์ที่ต้องแตะ (เฟส A)
| ไฟล์ | แก้อะไร |
|---|---|
| `src/lib/auth.ts` *(ใหม่)* | `authenticate(email,pwd)` ค้น 2 คลัง + `hashPassword` |
| `src/context/RoleContext.tsx` | `login(email,pwd)` · session ถือ role จริง · persist email |
| `src/lib/mock.ts` | `AuthUser` + ขยาย `MockSession` + คำนวณ `scopeAll` |
| `src/app/(auth)/login/page.tsx` + `hq/page.tsx` | ตรวจจริง + แสดง error (ปุ่ม demo ยังอยู่ได้) |
| `src/components/layout/AuthGuard.tsx` | + guard ตาม permission |
| `src/components/ui/Gate.tsx` *(ใหม่)* | ห่อ UI ตาม `can(permission)` |

---

# เฟส B — เสียบ Supabase (backend จริง)

ยก "ความจริง" ทั้งหมดจาก localStorage ไป Supabase — **ขอบเขตข้อมูลบังคับที่ DB ด้วย RLS** ไม่ใช่ frontend → บั๊กรั่วข้ามสาขาเกิดไม่ได้เชิงโครงสร้าง

## B1. Schema
```
auth.users            Supabase Auth จัดการเอง (email + bcrypt + JWT)
                      แทน hq_users_v4 (รหัส) + credentials ใน hq_dealers_v4

profiles              1:1 กับ auth.users — ตัวตัดสินสิทธิ์
  id (FK auth.users) · role · dealer_code · name · status
  ↑ role + dealer_code ยัดเป็น JWT claim ตอน login

dealers               แทน hq_dealers_v4 (ส่วนที่ไม่ใช่รหัสผ่าน)
  code (PK) · name · province · region · revenue_target · status

── ตารางข้อมูลงานขาย (ย้ายจาก sales_*_v*) ──
leads · quotations · customers · appointments   (ทุกตารางมี dealer_code)

── ตารางระดับเครือ (HQ เป็นเจ้าของ) ──
master_catalog · policy · targets · notif_rules · audit_log
```

## B2. RLS Policies — หัวใจของเฟส B
ทุกตารางที่มี `dealer_code` ใช้กฎเดียวกัน:
```sql
-- select: HQ เห็นทั้งเครือ · ตัวแทนเห็นเฉพาะสาขาตัวเอง
create policy "dealer sees own branch" on leads for select using (
  (auth.jwt()->>'role') like 'HQ_%'
  or (auth.jwt()->>'role') = 'SUPER_ADMIN'
  or dealer_code = (auth.jwt()->>'dealer_code')
);
-- insert/update/delete: เฉพาะ dealer เจ้าของสาขา (HQ อ่านอย่างเดียว)
create policy "dealer edits own branch" on leads for all using (
  dealer_code = (auth.jwt()->>'dealer_code')
);
```

| ตาราง | select | insert/update/delete |
|---|---|---|
| `leads / quotations / customers / appointments` | HQ=ทั้งหมด · dealer=สาขาตัวเอง | เฉพาะ dealer เจ้าของสาขา (HQ อ่านอย่างเดียว) |
| `master_catalog / policy / targets / notif_rules` | ทุกคน (ตัวแทนอ่านราคากลาง) | เฉพาะ HQ (`role like 'HQ_%'` + `catalog:edit`) |
| `dealers` | HQ=ทั้งหมด · dealer=แถวตัวเอง | เฉพาะ HQ |
| `audit_log` | เฉพาะ HQ | insert เท่านั้น (ไม่มีใครแก้/ลบ) |
| `profiles` | ตัวเอง + HQ | เฉพาะ SUPER_ADMIN |

> **จุดที่ฆ่าบั๊กรั่วข้ามสาขาทั้งคลาส:** `useNetworkDealerDetail` ที่ลืมกรอง dealerCode (ยืนยันบั๊กที่ [useNetworkData.ts:88](src/lib/useNetworkData.ts#L88)) — ต่อให้ query ตรง DB ก็คืนเฉพาะแถวที่ JWT อนุญาต ลีดสาขาอื่นไม่มีทางหลุดมา

## B3. Role → JWT claim (custom access token hook)
ตอน login Supabase ยิง hook เติม claim จาก `profiles`:
```
access_token.claims = { role: "DEALER_ADMIN", dealer_code: "CNX", ... }
```
RLS ทุกตารางอ่าน claim นี้ · frontend ยังใช้ `ROLE_PERMISSIONS` สำหรับ UI gating แต่การบังคับจริงอยู่ที่ DB

## B4. auth.ts — สลับ interface (แก้ไฟล์เดียว)
```
เฟส A (localStorage)          →   เฟส B (Supabase)
signIn(email,pwd)                 supabase.auth.signInWithPassword()
  ค้น hq_users/hq_dealers          + JWT ออกให้อัตโนมัติ
getCurrentUser()                  supabase.auth.getUser() (อ่าน JWT)
—                                 onAuthStateChange → auto logout token หมดอายุ
```
หน้า login / RoleContext / Guard / Gate **ไม่ต้องแก้** (เรียกผ่าน auth.ts เท่านั้น)

## B5. Migration — localStorage → Supabase
| localStorage key เดิม | → ตาราง |
|---|---|
| `sales_leads_v2` / `sales_quotations_v1` / `sales_customers_v1` / `sales_appointments_v1` | `leads` / `quotations` / `customers` / `appointments` |
| `hq_dealers_v4` | `dealers` + `profiles` (แยกรหัสไป auth.users) |
| `hq_users_v4` | `auth.users` + `profiles` |
| `master_catalog_v2` | `master_catalog` |
| `hq_notif_rules_v2` / `hq_targets` / `hq_policy` | `notif_rules` / `targets` / `policy` |
| `hq_audit_log_v1` | `audit_log` |

SalesContext เปลี่ยนจาก `usePersistentState` เป็น query Supabase (+ realtime subscription แทน event bus) — actions เดิม (`addLead`/`addQuotation`/...) กลายเป็น insert/update ที่มี RLS คุม

## ลำดับงานเฟส B
```
B1. สร้าง Supabase project + schema (SQL migration) + RLS policies
B2. custom access token hook (ยัด role/dealer_code เข้า JWT)
B3. seed ข้อมูล mock ปัจจุบัน → ตาราง (สคริปต์ import ครั้งเดียว)
B4. สลับ auth.ts เป็น Supabase (login/getUser/logout)
B5. สลับ SalesContext เป็น query + realtime
B6. ลบ localStorage stores ที่ย้ายแล้ว (เหลือแค่ prefs/ตัวกรองต่อหน้า)
B7. เทสต์: ตัวแทน query ข้ามสาขา → DB ปฏิเสธ (ยืนยัน RLS ทำงาน)
```

**ข้อควรระวัง:** B5 (SalesContext → Supabase) กระเทือนมากสุด เพราะทุกหน้าฝั่ง Dealer อ่านผ่าน `useSales()` — ควรทำหลัง B1-B4 นิ่งแล้ว และทำทีละ entity (leads ก่อน แล้วค่อย quotations/customers)

---

## สรุปสั้น (mental model)

- **เฟส A ทำก่อนได้เลย** ไม่ต้องมี Supabase — ปิดช่องว่าง "login ไม่ตรวจจริง" + "role 6 ตัวเข้าไม่ถึง" + "สิทธิ์บังคับแค่ isHQ"
- **เฟส B ค่อยสลับ `auth.ts` + ย้ายข้อมูลไป DB** — ส่วนที่เหลือไม่ต้องแก้ เพราะวาง interface กลางไว้แล้ว
- **RLS คือ payoff จริง** — ย้าย "เห็นเฉพาะสาขาตัวเอง" จาก frontend ไป DB → บั๊กรั่วข้ามสาขาเกิดไม่ได้อีก
