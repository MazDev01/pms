# Benjamin PMS — โครงสร้าง Backend ทั้งระบบ (Backend Design)

> **สถานะ:** เอกสารออกแบบ (design-only) — ยังไม่เขียนโค้ด ยังไม่สร้าง Supabase project
> **ที่มา:** ต่อยอดจากโมเดลข้อมูลจริงในโค้ด (mock.ts ~45 type) และการไหลของข้อมูลปัจจุบัน
> **เอกสารพี่น้อง:** [PROJECT-BRIEF.md](PROJECT-BRIEF.md) (ระบบทั้งหมด) · [AUTH-DESIGN.md](AUTH-DESIGN.md) (login/สิทธิ์/RLS)

---

## 0. สภาพปัจจุบัน → เป้าหมาย

**ตอนนี้ไม่มี backend เลย** — ทุกอย่างเป็น mock + localStorage/sessionStorage + custom event bus:
- ข้อมูลงานขายอยู่ใน `SalesContext` (persist localStorage `sales_*_v*`)
- นโยบาย/ตัวแทน/ผู้ใช้/ราคากลาง/audit อยู่ใน localStorage `hq_*` keys
- ไฟล์เป็น metadata อย่างเดียว (ไม่มีไฟล์จริง)
- "วันนี้" ตรึงที่ `APP_NOW = 30 มิ.ย. 2569`
- ข้อมูล HQ ทั้งเครือ = live CNX (สมุดสด) + seed สาขาอื่น รวมกันฝั่ง client (`useNetworkData`)

**เป้าหมาย backend:** ย้าย "ความจริง" ทั้งหมดไป **Supabase** (Postgres + Auth + Storage + Realtime + Edge Functions) โดยขอบเขตข้อมูลบังคับที่ DB (RLS) และตรรกะที่อ่อนไหวย้ายไปฝั่ง server

---

## 1. สแตก Backend (Supabase)

| ส่วนประกอบ | ใช้ทำอะไร | แทนที่อะไรเดิม |
|---|---|---|
| **Postgres** | ฐานข้อมูลหลัก ทุก entity | localStorage `sales_*` + `hq_*` |
| **Auth** (GoTrue) | login/JWT/รหัสผ่าน (bcrypt) | หน้า login ที่ไม่ตรวจจริง + credentials ใน localStorage |
| **Row-Level Security** | ขอบเขตข้อมูล "เห็นเฉพาะสาขาตัวเอง" | `filter(dealerCode)` ฝั่ง frontend |
| **Storage** | ไฟล์จริง (เอกสาร/รูปแม่แบบ/avatar) | `DealerFile` metadata + data URL |
| **Realtime** | sync ข้ามหน้า/ข้ามผู้ใช้ | custom event bus (`window.dispatchEvent`) |
| **Edge Functions / RPC** | ตรรกะ server-side (audit, เลขที่ใบ, cascade) | ตรรกะที่ทำใน context ฝั่ง client |
| **Database Views** | สรุปข้อมูลทั้งเครือ (aggregation) | คำนวณฝั่ง client ใน `useNetworkData`/`hqQuotations` |

---

## 2. Entity-Relationship (ภาพรวมตาราง)

```
auth.users ─1:1─ profiles ─N:1─ dealers
                    │
   ┌────────────────┼───────────────────────────────┐
 (dealer_code เชื่อมทุกตารางงานขายเข้ากับ dealers)
   │
dealers ─1:N─ leads ─1:N─ lead_tasks
   │            │   └─1:N─ lead_activities
   │            └─N:1─ customers ─1:N─ customer_contacts
   │            └─1:1─ deals (pipeline) ─1:N─ deal_tasks / deal_activities
   │
   ├─1:N─ quotations ─1:N─ quote_line_items (BOQ)
   ├─1:N─ appointments ──N:1── leads
   ├─1:N─ files ──(ผูก lead/customer/quotation)
   └─1:N─ responsible_persons   (พนักงานขายของสาขา — ไม่ใช่ user login)

── ระดับเครือ (HQ เป็นเจ้าของ ไม่มี dealer_code) ──
master_catalog ─1:N─ catalog_subtypes / price_history
hq_policy · hq_targets · hq_notif_rules · lost_reasons · company_profile
dealer_lead_rules  (กฎการดูแลลีด — รายสาขา · dealer ตั้งเอง)
audit_log · notes
```

**ความสัมพันธ์หลักที่ต้องรักษา (จากโมเดลจริง):**
- **1 Customer → many Deals/Quotations** · Lead มี `customer_id` (nullable — ลีดใหม่ยังไม่มีลูกค้า)
- **Lead ↔ Deal** = 1:1 (เดิมผ่าน `leadDealMap`) · Quotation ผูก `deal_id`/`customer_id`
- **dealer_code** เป็น FK ที่ทุกตารางงานขายอ้าง → เป็นแกนของ RLS

---

## 3. รายละเอียดตารางหลัก (columns)

> ชนิดคอลัมน์อ้างจาก type จริงใน `mock.ts` · `id uuid default gen_random_uuid()` ทุกตาราง · `created_at`/`updated_at timestamptz`

```sql
profiles          id(FK auth.users) · role(enum 6) · dealer_code · name · status · avatar_url
dealers           code(PK) · name · province · region · revenue_target · win_rate · status
                  -- revenue_actual = คำนวณจาก view ไม่เก็บ (กันตัวเลขขัดกัน)

leads             id · dealer_code(FK) · num_id · name · company · contact · phone · email
                  · province · product · category · status(enum) · value · area · assigned
                  · source · note · customer_id(FK nullable) · lost_reason · report · created_at
lead_tasks        id · lead_id(FK) · key · label · done · done_at · done_by
lead_activities   id · lead_id(FK) · date · icon · text · type

customers         id · dealer_code(FK) · name · company · email · phone · address · province
                  · category · status · owner · total_value · join_date · imported(bool)
customer_contacts id · customer_id(FK) · name · role · phone · email

quotations        id · dealer_code(FK) · quote_no(unique/สาขา) · customer_id(FK) · deal_id
                  · project · building_type · area · province · status(enum) · total_value
                  · material_cost · date · expiry · revision · note · issuer(jsonb snapshot)
quote_line_items  id · quotation_id(FK) · name · qty · unit · unit_price · sort

deals             id · dealer_code(FK) · lead_id(FK) · customer_id(FK) · stage_id · outcome
deal_tasks        id · deal_id(FK) · text · done
deal_activities   id · deal_id(FK) · type · text · timestamp

appointments      id · dealer_code(FK) · lead_id(FK nullable) · company · contact · phone
                  · project · building_type · area · province · date · time · type · status · note

files             id · dealer_code(FK) · name · size · ext · category · source(lead/customer/upload)
                  · record_id · customer_id · storage_path · uploaded_by · uploaded_at

responsible_persons id · dealer_code(FK) · name · title · phone · email · active · avatar_url

── ระดับเครือ ──
master_catalog    id · name · spec · price · unit · effective_date · image_url
catalog_subtypes  id · catalog_id(FK) · name · image_url
price_history     id · catalog_id(FK) · price · note · changed_at · changed_by
dealer_lead_rules dealer_code(PK) · follow_up_alert_days · unassigned_alert_hours
hq_policy         id(singleton) · require_approval · vat · quote_validity_days
hq_targets        id(singleton) · annual_target · win_rate_target · on_time_target
hq_notif_rules    id(singleton) · alerts(jsonb) · lead_idle_days · quote_expiring_days ...
lost_reasons      id · label · sort
company_profile   id(singleton) · name · tax_id · phone · email · website · address
audit_log         id · user · role · action · target · at
notes             id · dealer_code · customer_id · title · content · category · pinned · author
```

---

## 4. RLS (สรุป — รายละเอียดใน AUTH-DESIGN §B2)

กฎเดียวทุกตารางที่มี `dealer_code`:
- **select:** `role like 'HQ_%' or role = 'SUPER_ADMIN' or dealer_code = jwt.dealer_code`
- **insert/update/delete:** `dealer_code = jwt.dealer_code` (HQ อ่านอย่างเดียว)

ตารางระดับเครือ: อ่านได้ทุกคน (ตัวแทนอ่านราคากลาง/นโยบาย) · เขียนเฉพาะ HQ (`role like 'HQ_%'`) · `audit_log` insert-only · `profiles` เขียนเฉพาะ SUPER_ADMIN

---

## 5. Storage (ไฟล์จริง)

| Bucket | เก็บอะไร | สิทธิ์ |
|---|---|---|
| `dealer-files` | เอกสารแนบลีด/ลูกค้า (PDF/แบบแปลน/รูป) | path `{dealer_code}/...` → RLS ตาม dealer_code |
| `catalog-images` | รูปแม่แบบ + แม่แบบย่อย | อ่านสาธารณะ · เขียนเฉพาะ HQ |
| `avatars` | รูปผู้ใช้/ผู้รับผิดชอบ | อ่านสาธารณะ · เขียนเจ้าของ |

- แทน data URL ปัจจุบัน → `imageResize.ts` ยังใช้ย่อก่อนอัปโหลด (ประหยัด bandwidth)
- `files.storage_path` ชี้ object ใน bucket · ดาวน์โหลดผ่าน signed URL (หมดอายุได้)

---

## 6. Realtime (แทน event bus)

ปัจจุบันใช้ `window.dispatchEvent` sync ภายในแท็บ · Supabase Realtime sync **ข้ามผู้ใช้/ข้ามเครื่อง**:

| event เดิม | → Realtime subscription |
|---|---|
| `DEALER_FILES_EVENT` | `files` (filter dealer_code) |
| `HQ_NOTIF_UPDATED_EVENT` / `DEALER_LEAD_RULES_EVENT` | `hq_notif_rules` / `dealer_lead_rules` |
| `bpms-audit-updated` | `audit_log` insert |
| `bpms-profile-updated` / `bpms-company-updated` | `profiles` / `company_profile` |
| SalesContext state | `leads` / `quotations` / `customers` / `appointments` (postgres_changes) |

→ HQ เปิดหน้าค้างไว้ ตัวแทนออกใบใหม่ → เห็นทันทีโดยไม่ต้องรีเฟรช

---

## 7. Server Logic — ย้ายจาก client ไป server

ตรรกะที่ **ต้องเชื่อถือได้/กันโกง** ย้ายไป Postgres function (RPC) หรือ trigger:

| ตรรกะ | ที่อยู่เดิม | ย้ายไป | เหตุผล |
|---|---|---|---|
| **เลขที่ใบเสนอราคา** (`Q-2026-####`) | `loadQuoteNumbering` client | RPC + sequence ต่อสาขา | กันเลขชนกันเมื่อหลายคนออกพร้อมกัน |
| **ปิดการขาย → สร้างลูกค้า** | `closeDeal`/`convertLeadToCustomer` client | trigger `on quotations.status='won'` | atomic · กันลูกค้าซ้ำ/หาย |
| **task-driven stage** (ติ๊กงาน→เลื่อน stage) | `updateDealTask` client | trigger บน `lead_tasks`/`deal_tasks` | source of truth เดียว |
| **JWT claim** (role/dealer_code) | — | custom access token hook | RLS พึ่งพา claim นี้ |
| **audit logging** | `useAuditLogger` client | trigger บนตารางที่ HQ แก้ | บันทึกครบ กันลืม log |
| **VAT** | `loadHQPolicy().vat` client | อ่านจาก `hq_policy` (RLS อ่านได้) | นโยบายเดียวทั้งเครือ |

**ตรรกะที่คงไว้ฝั่ง client ได้** (แค่ derive เพื่อแสดงผล ไม่กระทบความจริง): กราฟ, aging bucket, priority, progress %, ฟอร์แมตวันที่/บาท

---

## 8. Database Views — สรุปข้อมูลทั้งเครือ (HQ)

ปัจจุบัน `useNetworkData`/`hqQuotations`/`customerDb` คำนวณ aggregation ฝั่ง client · ย้ายเป็น **view/materialized view** ให้ HQ query ตรง:

| View | แทน | คำนวณ |
|---|---|---|
| `v_dealer_performance` | `useNetworkDealerDetail` + pipeline table | ยอดขาย/ลีด/ใบเสนอ/อัตราปิด ต่อสาขา (จากใบ won จริง) |
| `v_network_quotations` | `useNetworkQuotations` | ใบทั้งเครือ + region/aging/valid_until |
| `v_customer_db` | `useCustomerDb` | ลูกค้า + อาคารที่ซื้อ (จากใบ won) + is_repeat |
| `v_quotation_aggregate` | `hqQuotations.aggregate` | count/value/sent/accepted/conversion ต่อกลุ่ม |

> **ผลพลอยได้:** ปัญหา "ยอดขาย CNX ขัดกัน ฿24.6M vs ฿22.4M" (จากรอบ /scenario — client คิดสด vs อ่าน field ซีด) หายไป เพราะทุกหน้าอ่านจาก view เดียวที่คิดจากใบจริง

---

## 9. ⚠️ ประเด็นสำคัญ: เวลาจริงแทน APP_NOW

ทั้งระบบตรึง "วันนี้" = **30 มิ.ย. 2569** ตอนย้าย backend ต้องตัดสินใจ:
- ข้อมูล seed ทั้งหมดเป็นปี 2569 (ครึ่งปีแรก) — ถ้าใช้ `now()` จริง (เช่น 2568/2570) กราฟ/ตัวกรอง "ปีนี้"/"เดือนนี้" จะว่างหมด
- ตรรกะ deterministic (เช่น `leadCreatedDate` จาก `numId`, `stampNow()`) จะเปลี่ยนพฤติกรรม
- **ทางเลือก:** (ก) seed ข้อมูลใหม่ให้อิงวันจริงตอน go-live · (ข) เก็บ `created_at` จริงทุกแถวตั้งแต่แรก แล้วเลิกใช้ deterministic fallback
- **แนะนำ:** พอมี backend ให้ทุกเรคคอร์ดมี `created_at` จริงจาก `now()` และเลิกพึ่ง APP_NOW — เป็นการปลดหนี้ทางเทคนิคที่ตั้งใจไว้ตั้งแต่ต้น (คอมเมนต์ในโค้ดยอมรับว่าตรึงเวลาเพราะเป็น demo)

---

## 10. Data Access Layer ในแอป

วาง repository ต่อ entity — หน้า/context เรียกผ่านชั้นนี้เท่านั้น (ไม่เรียก supabase client ตรง):
```
src/lib/db/
  client.ts        supabase client (จาก env)
  auth.ts          signIn / getCurrentUser / signOut  (จาก AUTH-DESIGN)
  leads.ts         listLeads() / addLead() / updateLead() ...   (มี RLS คุม)
  quotations.ts · customers.ts · appointments.ts · files.ts
  catalog.ts · dealers.ts · settings.ts · audit.ts
```
`SalesContext` เปลี่ยนภายใน จาก `usePersistentState` → เรียก repository + subscribe realtime · **API ของ context (`useSales()`) เหมือนเดิม** → หน้าต่าง ๆ ไม่ต้องแก้

---

## 11. Migration & Seeding
```
1. schema.sql (ตาราง + enum + FK + index) → Supabase migration
2. rls.sql (policies ทุกตาราง)
3. functions.sql (RPC + triggers + access token hook)
4. views.sql (aggregation)
5. seed.ts — import ข้อมูล mock ปัจจุบัน → ตาราง (ครั้งเดียว, ให้ created_at จริง)
6. storage buckets + policies
```

---

## 12. Security posture (สรุป)

| ชั้น | กันอะไร |
|---|---|
| Auth (JWT) | ต้องล็อกอินก่อนเข้าถึงข้อมูล |
| RLS | ตัวแทน query ข้ามสาขาไม่ได้ (แม้ frontend พลาด) · HQ เขียนงานขายตัวแทนไม่ได้ |
| Server logic (trigger/RPC) | เลขที่ใบ/cascade/audit เชื่อถือได้ กันแก้จาก client |
| Storage RLS | ไฟล์สาขาอื่นดาวน์โหลดไม่ได้ · signed URL หมดอายุ |
| Audit trigger | ทุกการแก้ของ HQ ถูกบันทึก กันลืม log |

---

## ลำดับงานรวม (เมื่อสั่งลงมือ)
```
Phase A (แอป)     : role 6 ตัว + login ตรวจจริง + Gate + guard  (localStorage, ทำก่อนได้)
Phase B1 (schema) : สร้าง Supabase + ตาราง + enum + FK + index
Phase B2 (RLS)    : policies ทุกตาราง + storage
Phase B3 (logic)  : access token hook + triggers (audit/cascade/quote-no) + views
Phase B4 (seed)   : import mock → DB (created_at จริง)
Phase B5 (auth)   : สลับ auth.ts เป็น Supabase
Phase B6 (data)   : สลับ SalesContext + repositories + realtime (ทีละ entity)
Phase B7 (cleanup): ลบ localStorage stores · เลิกใช้ APP_NOW · เทสต์ RLS
```

**ลำดับความเสี่ยง:** B6 หนักสุด (ทุกหน้า Dealer พึ่ง `useSales()`) — ทำหลัง B1-B5 นิ่ง และทีละ entity (leads → quotations → customers → appointments)
