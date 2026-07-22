# แผนต่อแอป → Supabase (ทุกโมดูล / ทุกฟังก์ชัน)

> สถานะ backend: ✅ เสร็จ (migrations 0001-0005 + seed + auth hook + RLS พิสูจน์แล้ว)
> เอกสารนี้ = แผนต่อ "ฝั่งแอป" เข้ากับ backend · ทำทีละ Phase, verify ก่อนไป Phase ถัดไป
> หลักการ: `DATA_SOURCE=local` (mock) และ `=supabase` ต้องใช้ได้ทั้งคู่เสมอ

---

## ภาพรวม: อะไรย้ายไป DB / อะไรอยู่ที่แอป

| เดิม (แอปทำเอง) | หลังต่อ Supabase |
|---|---|
| กรอง dealerCode ในโค้ด | **RLS ที่ DB** (มีแล้ว) |
| numId ลีด/เลขใบ ฝั่ง client | leads.id / `next_quote_no()` (DB) |
| Lead→Won สร้าง customer ในโค้ด | trigger `on_quote_won` (DB — auto) |
| audit ยิงเองทุกที่ | บางส่วน trigger (เช่น catalog) + append ที่เหลือ |
| event bus (localStorage) ข้ามแท็บ | Realtime (ข้ามเครื่อง) |

---

## Phase 0 — Foundation (ต้องก่อนทุกอย่าง) 🔑

**0.1 Client session sharing**
- `getSupabase()` เป็น singleton — client ตัวที่ auth ต้องเป็นตัวเดียวกับ adapter ใช้ query (session ติดไป → RLS ทำงาน)
- ✅ มี client.ts แล้ว · ต้องมั่นใจ persistSession=true ฝั่ง browser

**0.2 Auth → Supabase**
- `signInWithPassword(email, password)` แทน mock signIn (เมื่อ DATA_SOURCE=supabase)
- อ่าน session → `dealer_code`, `user_role` จาก JWT → เข้า RoleContext (`isHQ`, `dealerCode`, `role`)
- `signOut()`, ฟื้น session ตอน reload (`onAuthStateChange`)
- คงโหมด mock: DATA_SOURCE=local → ใช้ signIn เดิม
- **verify:** login RYG ในแอปจริง → RoleContext.dealerCode = "RYG"

**0.3 เพิ่ม write methods ใน ports** (sales repos ตอนนี้มีแค่ list)
- LeadsRepo: `create / update / remove / setStatus`
- QuotationsRepo: `create / update / remove / setStatus`
- CustomersRepo: `create / update / remove`
- AppointmentsRepo: `create / update / remove`
- implement ทั้ง LocalAdapter (ห่อ SalesContext เดิม) + SupabaseAdapter (insert/update/delete + mappers)

---

## Phase 1 — Leads (โมดูลแรก · พิสูจน์ end-to-end)

| ฟังก์ชันแอป | ต่อกับ | หมายเหตุ |
|---|---|---|
| อ่านรายการลีด (myAllLeads) | `leads.list(scope)` | RLS กรองให้ — ไม่ต้องกรอง dealerCode เอง |
| `addLead` | `leads.create` | dealer_code = สาขา session (RLS with check) |
| `updateLead` | `leads.update` | |
| `deleteLead` | `leads.remove` | |
| `updateLeadStatus` | `leads.setStatus` (หรือ update) | |
| tasks/activities (jsonb) | เก็บใน column `tasks`/`activities` | |
| `completeLeadQuoteTasks` | logic ฝั่งแอป (อ่าน/เขียน lead) | หรือย้ายเป็น RPC ทีหลัง |
| `leadCreatedDate` (สังเคราะห์จาก numId) | ใช้ `created_at` จริงจาก DB | เลิกพึ่ง APP_NOW |

**Steps:** เพิ่ม leads CRUD ใน adapter → SalesContext.leads อ่านจาก `leads.list()` (async) → เขียนผ่าน repo → verify: RYG login เห็น/สร้าง/แก้ลีดตัวเองจาก DB (CNX ไม่เห็น)

---

## Phase 2 — Customers

| ฟังก์ชัน | ต่อกับ | หมายเหตุ |
|---|---|---|
| อ่านลูกค้า | `customers.list(scope)` | RLS |
| สร้างลูกค้า (Lead→Won) | **trigger `on_quote_won` (DB)** | ไม่ต้องสร้างในโค้ด — ตั้ง quote=won พอ |
| `updateCustomer` | `customers.update` | |
| `deleteCustomer` | `customers.remove` | |
| รหัสลูกค้า (customerCode) | คงคำนวณฝั่งแอปจาก id + dealer_code | |

**verify:** ตั้งใบเป็น won → customer โผล่ใน DB อัตโนมัติ (ผ่าน trigger)

---

## Phase 3 — Quotations

| ฟังก์ชัน | ต่อกับ | หมายเหตุ |
|---|---|---|
| อ่านใบเสนอราคา | `quotations.list(scope)` | RLS |
| `addQuotation` | `quotations.create` | line_items = jsonb |
| เลขใบ (quote_no) | **`next_quote_no(dealer)` RPC (DB)** | atomic กันเลขชน — เลิก numId client |
| `updateQuotation` | `quotations.update` | |
| `setQuotationStatus` (won/lost) | `quotations.setStatus` | won → trigger สร้าง customer |
| `deleteQuotation` | `quotations.remove` | |
| ไฟล์แนบใบ (syncAddQuotationFile) | Phase 6 (files + Storage) | |

---

## Phase 4 — Appointments (ปฏิทิน)

| ฟังก์ชัน | ต่อกับ |
|---|---|
| อ่านนัดหมาย | `appointments.list(scope)` (RLS) |
| add/update/delete | `appointments.create/update/remove` |

---

## Phase 5 — โมดูลระดับเครือ (HQ เป็นเจ้าของ · RLS: อ่านทุกคน เขียนเฉพาะ HQ)

| โมดูล | repo methods | ตาราง |
|---|---|---|
| **Dealers** (จัดการตัวแทน) | `dealers.list / save` | dealers |
| **Master Catalog** (ราคากลาง/BOQ) | `catalog.list / save` | master_catalog · trigger audit อัตโนมัติ |
| **Responsible Persons** | `persons.list / save` | responsible_persons |
| **Settings** (นโยบาย/เป้า/กฎแจ้งเตือน) | `settings.getPolicy/getTargets/getNotifRules/getLeadRulesMap/saveLeadRules/getQuoteValidityDays` | hq_policy, hq_targets, hq_notif_rules, dealer_lead_rules |
| **Audit Log** | `audit.list / append` | audit_log (insert-only · อ่าน HQ) |

---

## Phase 6 — Files + Storage

- สร้าง buckets: `dealer-files`(private), `catalog-images`(public), `avatars`(public)
- `files.list / add / remove` → ตาราง files (metadata) + upload ไฟล์จริงเข้า Storage
- แทน DealerFile store (localStorage/base64) ด้วย Storage URL

---

## Phase 7 — Realtime + Migration + เก็บกวาด

- **Realtime:** subscribe `leads/quotations/customers` → HQ เห็น dealer อัปเดตสด (แทน event bus localStorage)
- **Seed sales data** (ถ้าต้องการ): mock leads/quotes → ตาราง (สคริปต์ครั้งเดียว · created_at จริง)
- **Auth accounts → profiles** (seed แล้ว) · UsersPanel จัดการ profiles
- **เก็บกวาด:** ลบ path localStorage เดิมที่ไม่ใช้ · usePersistentState เหลือเฉพาะ UI state (density, tab)

---

## ลำดับแนะนำ + Definition of Done ต่อ Phase

```
0 Foundation (auth + ports write)   ← ปลดล็อก ทุก Phase พึ่งอันนี้
1 Leads        ← พิสูจน์ end-to-end แรก (login → CRUD ลีดจาก DB, RLS แยกสาขา)
2 Customers    ← trigger won→customer
3 Quotations   ← next_quote_no + won trigger
4 Appointments
5 HQ modules (dealers/catalog/persons/settings/audit)
6 Files + Storage
7 Realtime + migration + cleanup
```

**DoD ต่อ Phase:** ทั้ง 2 โหมด (local/supabase) ใช้ได้ · ชุดเทสต์ scenario เขียว · verify กับ project จริง (RLS แยกสาขาถูก)

---

## ความเสี่ยง/กับดักที่ต้องระวัง
1. **async ทุกที่** — SalesContext เดิม sync (localStorage) → Supabase เป็น async → ต้องปรับ context เป็น loading/await (กระทบทุกหน้าที่อ่าน)
2. **session ต้องพร้อมก่อน query** — ถ้า query ก่อน login เสร็จ RLS คืนว่าง → ต้องรอ auth ready
3. **optimistic update** — เขียนแล้วรอ DB → UI ต้องมี pending state (ไม่งั้นดูช้า)
4. **โหมด local ห้ามพัง** — DATA_SOURCE=local ต้องทำงานเหมือนเดิมทุกจุด
5. **RLS write check** — insert ต้องใส่ dealer_code = สาขาตัวเอง ไม่งั้นโดนปฏิเสธ
