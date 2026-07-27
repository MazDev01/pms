# Benjamin PMS — Backend Connection Audit

> Audit ณ snapshot ปัจจุบัน (โค้ดกำลังถูกพัฒนาต่อเนื่อง) · ตรวจจากการอ่านโค้ดจริง + รันคำสั่งจริง ไม่มีการกุ
> **ข้อค้นพบหลัก: ระบบรันบน Supabase จริง (live) เต็มระบบแล้ว** — ทั้ง 2 แอปตั้ง `NEXT_PUBLIC_DATA_SOURCE=supabase` + มี URL/anon key จริง (`yhhhcrvhkforwsagojho.supabase.co`) · LocalAdapter เหลือเป็น fallback เดโมเท่านั้น

---

## 1. ตารางต่อโมดูล

### Dealer (apps/dealer)
| Module | Backend | CRUD | Wired | Status |
|---|---|---|---|---|
| Dashboard | Supabase | Read | ✅ | ✅ |
| Leads (ลูกค้าเป้าหมาย) | Supabase | Complete | ✅ | ✅ |
| Customers | Supabase | Complete* | ✅ | ✅ *สร้างได้ทาง Lead→Won ตามสเปก |
| Quotations | Supabase | Complete | ✅ | ✅ |
| Products (แม่แบบ) | Supabase | Read-only | ✅ | ✅ อ่านราคากลาง (realtime) |
| Calendar/Appointments | Supabase | Complete | ✅ | ✅ (id ผ่าน RPC atomic) |
| Files | Supabase | Complete | ✅ | ✅ ไบต์จริงใน bucket `dealer-files` |
| Notes | Supabase | Complete | ✅ | ✅ ตาราง `customer_notes` |
| Tasks | Supabase | Complete | ✅ | ✅ (อยู่ใน Leads — task-driven) |
| Settings | Supabase | Complete | ✅ | ✅ |
| Profile | Supabase | Complete | ✅ | ✅ ตาราง `profiles` ผูก auth |

### HQ (apps/hq)
| Module | Backend | CRUD | Wired | Status |
|---|---|---|---|---|
| Dashboard | Supabase | Read | ✅ | ✅ |
| Dealers | Supabase | Complete | ✅ | ✅ + สร้างบัญชี auth ผ่าน API route |
| Dealer detail | Supabase | Read | ✅ | ✅ |
| Pipeline | Supabase | Read | ✅ | ✅ |
| Leads (ทั้งเครือ) | Supabase | Read | ✅ | ✅ |
| Quotations (ทั้งเครือ) | Supabase | Read | ✅ | ✅ |
| Customers (ทั้งเครือ) | Supabase | Read | ✅ | ✅ (ดูอย่างเดียวตามสเปก) |
| Master (แคตตาล็อก/ราคากลาง) | Supabase | Complete | ✅ | ✅ |
| Audit | Supabase | Read+Append | ✅ | ✅ ตาราง `audit_log` |
| Company | Supabase | Complete | ✅ | ✅ |
| Settings | Supabase | Complete | ⚠️ | แท็บ "ระบบ" (`HQ_SYSTEM_KEY`) ยัง localStorage |
| Users | Supabase | Read+Update | ⚠️ | สร้าง/ลบ client ทำไม่ได้ (ต้อง service_role route) |

**Contacts / Contracts** = ไม่มีเป็นโมดูลแยก (Contacts อยู่ใน Customers · ไม่มี Contracts เพราะ Sales-only) · **Reports** = อยู่ในแดชบอร์ด/Pipeline

---

## 2. API Folder (`app/api`)
- **มี 1 route:** `apps/hq/app/api/admin/dealers/route.ts` — `POST` (server-side, `runtime="nodejs"`, ใช้ `service_role` สร้างบัญชี auth ตัวแทน) · ตรวจ JWT ผู้เรียก + role จาก `profiles` ก่อนทำ · rollback auth user เมื่อ insert ล้ม · คืน 501 ถ้าไม่ตั้ง key (ไม่แกล้งสำเร็จ)
- client wrapper: `packages/shared/lib/adminApi.ts`
- **สถาปัตยกรรมหลักคือ client → Supabase ตรง (PostgREST + RLS)** ไม่ใช่ REST API layer → จึงมี route เดียวเท่าที่ต้องใช้ service_role · **ยังขาด:** route สร้าง/ลบผู้ใช้ HQ (หน้า Users จึงทำได้แค่ list+update)

---

## 3. Database (`supabase/migrations/` — 33 ไฟล์ 0001→0033)
| หมวด | สถานะ | หมายเหตุ |
|---|---|---|
| ตาราง (~18-20) | ✅ | + ENUMs (user_role/lead_status/quotation_status/dealer_status) |
| Foreign keys | ✅ (จงใจไม่ครบ) | 0018 เพิ่ม `dealer_code→dealers` 7 ตาราง · polymorphic (quotations.customer_id, appointments.lead_id, files.record_id) จงใจไม่ผูก |
| Indexes | ✅ | composite `(dealer_code,id)` + partial index (0020/0022) |
| **Views** | ❌ **ไม่มี** | HQ aggregate คำนวณฝั่ง client (useNetworkData/useDealerPerformance) |
| Functions | ✅ (12) | access-token hook, next_quote_no, next_entity_id, expire_quotations, is_hq, can_write_master/sales, guard_profile_privilege ฯลฯ |
| Triggers | ✅ (2) | catalog_audit, guard_profile_privilege · `trg_quote_won` **ถูก drop (0033)** เพราะสร้างลูกค้า id=0 ผี |
| RLS | ✅ ทุกตาราง | ดู §5 |
| Storage buckets | ✅ | dealer-files (private) · catalog-images (public) · avatars (public) |
| Realtime publications | ✅ (6) | sales, catalog, settings, sales_journey, dealer_settings, customer_notes |
| Seed | ✅ | seed.mjs, seed-catalog.mjs |

---

## 4. Authentication
- **Supabase Auth wired** (`supabaseAuth.ts`): `signInWithPassword`, signOut, restore (getSession), `onAuthStateChange` (sync ตอน login/logout/**token refresh**) · session/refresh จัดการโดย supabase-js (`autoRefreshToken:true`)
- **role + dealer_code มาจาก JWT claim** (ผ่าน `custom_access_token_hook`)
- **2 โหมด สลับด้วย ENV:** supabase → JWT จริง · local → auth.ts เดิม (localStorage + `DEMO_PASSWORD`) สำหรับเดโม
- Password reset: email link จริง (ไม่มี temp password ปลอม)
- **ไม่มี Next middleware** — protected route เป็น **client-side + RLS**: `AuthGuard` (redirect เมื่อไม่ล็อกอิน) + `hq/layout.tsx` (`!isHQ → /dashboard`, คืน null จนยืนยันเป็น HQ)
- **dealer → HQ: เข้าไม่ได้** (client redirect + RLS ที่ DB — JWT ตัวแทน query ข้ามสาขาไม่ได้) · **HQ → dealer:** HQ อ่านได้ทุกสาขาผ่าน RLS แต่แอปแยกกันจริง (dealer app ไม่มี route /hq) → **บังคับด้วย RLS + แยกแอป เป็นหลัก**
- ⚠️ security boundary จริงคือ RLS (ไม่มี server gate ตรวจ JWT ตอนโหลดหน้า — แต่หน้าเป็นแค่ UI ข้อมูลทั้งหมดผ่าน RLS)

---

## 5. Row-Level Security
**ทุกตาราง enable RLS + มี policy** (ไม่มีตารางที่ลืม policy โดยบังเอิญ)
| กลุ่ม | SELECT | WRITE |
|---|---|---|
| leads/quotations/customers/appointments/files/persons | `is_hq() OR dealer_code=auth_dealer()` | `FOR ALL`: `can_write_sales() AND own` |
| dealers/master_catalog/hq_* | `to authenticated` (0031 ปิด anon แล้ว) | `can_write_master()` |
| dealer_settings / customer_notes | HQ หรือ เจ้าของ | `can_write_sales() AND own` |
| profiles | ตัวเอง + HQ | SUPER_ADMIN + self (col-guard trigger) |
| audit_log | HQ | insert-only (immutable) |
| quote_counters / entity_counters | **RLS on, no policy (sealed)** | เข้าผ่าน SECURITY DEFINER function เท่านั้น (จงใจ) |

- **ช่องโหว่ anon-read เดิม (อ่าน hq_* ด้วย anon key) → ปิดแล้วใน 0031**
- residual (บันทึกไว้ ยังไม่แก้): JWT หมดอายุยังอ่านได้ ≤1 ชม. · `dealer_lead_rules` write ไม่ผ่าน `can_write_sales()` · bucket `catalog-images` เป็น public

---

## 6. Mock Data
- **ไม่มีหน้าไหน "mock ล้วน"** — domain data ทั้งหมดผ่าน data layer → Supabase
- `mock.ts` (1,485 บรรทัด) เหลือบทบาท: **types / labels / helpers / seed** (seed ใช้เฉพาะโหมด local)
- localStorage ที่เหลือ = **client preference/session** (FilterContext, RoleContext demo, UI prefs) + **1 จุด business:** แท็บ "ระบบ" HQ Settings (`HQ_SYSTEM_KEY`) ยังไม่ย้ายเข้า repo
- `layout.tsx` ทั้ง 2 แอปยัง import `leads` seed จาก mock (ตั้งต้นให้ LocalAdapter fallback)
- `UsersPanel.tsx` import `usePersistentState` แต่ **ไม่ถูกเรียก** (dead import)

---

## 7. Dashboard KPIs
ทุก KPI/กราฟ (Revenue, Win Rate, Sales, Dealer Ranking, Leads, Pipeline, Opportunity) มาจาก **Supabase (live)** ผ่าน `useSales` + `useNetwork*` · aggregate คำนวณฝั่ง client (ยังไม่มี SQL view) → ตัวเลขถูกต้องแต่ถ้าข้อมูลโตควรทำ view/materialized view

---

## 8. CRUD
CRUD ครบเกือบทุกโมดูล (list/create/update/remove + setStatus/RPC) · **ข้อยกเว้น:** Users สร้าง/ลบ client ทำไม่ได้ (ต้อง service_role route ที่ยังไม่สร้าง) · dealers/catalog เป็น upsert (save ไม่ลบแถวที่หาย — จงใจกันลบพลาด) · **Validation:** มี (145 try/catch, 35 toast, mapper แปลง type)

---

## 9. Error Handling
- `try/catch`: **145 จุด** · `toast`: **35 จุด** · sync-error handling ใน SalesContext
- EmptyState: มีจริง ใช้ 8 หน้า · **Skeleton: ใช้จริงแค่หน้า Files** (หน้าอื่น render ทันที) → ควรเพิ่ม loading state ให้ทั่วเมื่อ latency network สูงขึ้น

---

## 10. Performance
- **Pagination ครบทุก list** (`pageAll` + `.range()` 1000/รอบ กัน PostgREST ตัด 1000 แถวเงียบ ๆ) · ทุก query มี `.order()` เสถียร
- **N+1: ไม่พบ** (0 แมตช์)
- `select("*")`: 7 จุด → ควรเลือกคอลัมน์เมื่อสเกลโต · ไม่มี SQL view (aggregate client-side)

---

## 11. Security
- **service_role: ถูกต้อง** — อ่านเฉพาะใน Route Handler (`runtime=nodejs`, **ไม่มี** `NEXT_PUBLIC_`) → ไม่หลุด client · route ตรวจ JWT ผู้เรียกเอง + rollback
- **anon key:** อยู่ใน `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public by nature — RLS คุม) · **`.env.local` ถูก gitignore** (`git check-ignore` ยืนยัน) · service_role ไม่อยู่ใน env ที่ commit
- **ไม่พบ** hardcoded key/secret ในซอร์ส (แมตช์ทั้งหมดเป็น comment หรือ `process.env.SUPABASE_SERVICE_ROLE_KEY` ที่ถูกต้อง) · ไม่พบ SQL injection (ใช้ PostgREST builder) · XSS มี `esc()` ในใบเสนอราคา

---

## 12. Realtime — ✅ wired ถึง UI
- `SalesContext` → `realtime.subscribeSales` (postgres_changes 4 ตาราง, RLS กรอง event ตามสาขา, DELETE ผ่าน replica-identity-full) → leads/customers/quotations/appointments sync สด
- `useMasterCatalog` → `subscribeCatalog` · settings → `subscribeSettings`
- channel topic ไม่ซ้ำ (`channelSeq`) กันบั๊ก "cannot add callbacks after subscribe()"

---

## 13. Storage — ✅ wired ถึง UI
- `storage.upload` (key ASCII-safe `{dealer}/{ts}-{name}`), `signedUrl` (TTL 1 ชม.), `remove`
- หน้า Files เรียก `filesRepo` + `storage` จริง (ไบต์จริงใน bucket) · buckets + policies ครบ (0010)

---

## 14. TypeScript — สะอาดมาก
- **typecheck: dealer 0 error · hq 0 error**
- `as any` = **1** (`hq/dealers/page.tsx:497`) · `@ts-ignore` = **0** · `eslint-disable` = 35 (ปลอดภัย: no-img-element / exhaustive-deps) · **TODO/FIXME จริง = 0** (7 แมตช์เป็น `XXX` ใน placeholder)

---

## 15. Code Quality
- Dead code น้อย: `usePersistentState` import ค้างใน UsersPanel (ไม่เรียก) · comment ล้าสมัยใน index.ts ("SupabaseAdapter เป็นโครงว่าง" — ไม่จริงแล้ว)
- **`supabase/README.md` ล้าสมัย** (บอก 3 migration/14 ตาราง จริง 33/~18)
- ไม่มี `src/` เก่าค้าง · ไม่มี orphan directory

---

## 16. Production-Ready Score (เต็ม 100)
| ด้าน | คะแนน | เหตุผล |
|---|---|---|
| Database | 90 | schema/RLS/functions/triggers/storage/realtime ครบ · ขาด views + README เก่า |
| Auth | 85 | Supabase auth + JWT + refresh ครบ · ไม่มี server middleware · ยังมี dual-mode |
| API | 75 | client→Supabase ตรง (โอเค) · ขาด route สร้าง/ลบผู้ใช้ HQ |
| Dashboard | 85 | live ครบ · aggregate client-side (ไม่มี view) |
| CRUD | 85 | ครบเกือบทุกโมดูล · Users create/delete ยังไม่ได้ |
| Performance | 80 | pagination ครบ ไม่มี N+1 · select("*") + ไม่มี view/memo audit |
| Security | 85 | service_role ถูก · ปิด anon hole (0031) · residual ที่บันทึกไว้ |
| **Testing** | **30** | scenario harness พังหลัง monorepo (ยังชี้ :3000/`@/`) · ไม่มี unit test · ยังไม่เทสต์กับ Supabase จริง |
| **รวม (ถ่วงน้ำหนัก)** | **≈ 78/100** | แข็งแรงด้าน data/auth/RLS · จุดฉุดหลัก = Testing |

---

## 17. Backend Summary

### ✅ เชื่อมแล้ว (live บน Supabase)
Dashboard · Leads · Customers · Quotations · Products · Appointments · Files · Notes · Tasks · Profile · HQ Dashboard/Dealers/Pipeline/Leads/Quotations/Customers/Master/Audit/Company · Auth · RLS · Realtime · Storage

### ⚠️ ต้องแก้ก่อน Production
- แท็บ "ระบบ" HQ Settings ยัง localStorage → ย้ายเข้า repo
- หน้า Users สร้าง/ลบไม่ได้ → สร้าง API route (service_role) แบบเดียวกับ admin/dealers
- ยืนยันฝั่ง Supabase project จริง: seed ครบ · เปิด access-token hook · operator ตั้ง `SUPABASE_SERVICE_ROLE_KEY` (ตอนนี้ route คืน 501)
- `README.md` อัปเดต · comment index.ts ล้าสมัย · `as any` 1 จุด

### ❌ ยังไม่มี
- SQL views (HQ aggregate) · server middleware (edge auth gate) · Testing (harness พัง + ไม่มี unit test)

### Priority
- **P0 (Critical):** (1) ตั้ง `SUPABASE_SERVICE_ROLE_KEY` + เปิด access-token hook + seed บน project จริง แล้วทดสอบ end-to-end · (2) **กู้ Testing** — migrate scenario harness (ชี้ :3001/:3002 + `@pms/*`) แล้วรันจริงกับ Supabase · (3) commit งานที่ค้าง (`apps/hq/app/api/`, `adminApi.ts`, migrations 0031-0033)
- **P1 (High):** route สร้าง/ลบผู้ใช้ HQ · แท็บ "ระบบ" → repo · แก้ stale-JWT revocation (R2) · `dealer_lead_rules` write gate
- **P2 (Medium):** SQL views/materialized สำหรับ HQ aggregate · `select` เลือกคอลัมน์ · Skeleton ให้ทั่วหน้า · README/comment
- **P3 (Low):** `as any` 1 จุด · dead import UsersPanel · bucket catalog-images public

---

## 18. Checklist (การเชื่อม backend)
- [x] Dashboard — Supabase live
- [x] Leads — CRUD ครบ
- [x] Customers — CRUD (Lead→Won)
- [x] Pipeline — read live
- [x] Quotations — CRUD ครบ
- [~] Contracts — ไม่มีในสเปก (Sales-only)
- [x] Files — storage จริง
- [x] Tasks — ใน Leads
- [x] Appointments — CRUD ครบ
- [x] Notes — customer_notes
- [x] Reports — ในแดชบอร์ด/Pipeline
- [x] Dealer (จัดการตัวแทน) — CRUD + API route
- [x] HQ — ครบ (ยกเว้น Users create/delete, แท็บระบบ)
- [~] Settings — เกือบครบ (แท็บ "ระบบ" ยัง local)

**Completed ≈ 90%** ของการเชื่อม backend ต่อโมดูล · **ความพร้อมระบบรวม ≈ 78%** (Testing ฉุด)

### ระบบพร้อม Production หรือยัง? — **ยังไม่พร้อม 100% (ใกล้แล้ว ~78%)**
**เหตุผล:**
- ✅ **แข็งแรง:** data layer + Supabase live เต็มระบบ · RLS ครบทุกตาราง (ปิด anon hole แล้ว) · Auth + JWT + refresh · Realtime + Storage wired · typecheck 0/0 · service_role ปลอดภัย
- ❌ **บล็อก Production:**
  1. **Testing แทบไม่มี** — scenario harness พังหลัง monorepo, ยังไม่เทสต์ end-to-end กับ Supabase จริง (นี่คือความเสี่ยงสูงสุด: โค้ด adapter/RLS สวยแต่ยังไม่พิสูจน์กับ DB จริงครบทุก flow)
  2. **Operator setup ยังไม่ครบ** — service_role key ยังไม่ตั้ง (admin route คืน 501) · ต้องยืนยัน hook/seed บน project จริง
  3. **ช่องว่างฟังก์ชัน** — สร้าง/ลบผู้ใช้ HQ ยังทำไม่ได้ · แท็บระบบยัง local
  4. **งานค้างยังไม่ commit** (api/, migrations 0031-0033)

**สรุป:** backend เชื่อมจริงและออกแบบดีมาก แต่ยัง**ไม่ควรขึ้น production จนกว่า** (ก) ทดสอบ end-to-end กับ Supabase จริงครบทุก flow (ข) operator ตั้ง service_role + hook + seed (ค) ปิดช่องว่าง P0/P1
