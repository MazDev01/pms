# Benjamin PMS — โครงสร้างระบบให้เชื่อมต่อ Backend ได้ (Integration / Data Layer Design)

> **สถานะ:** เอกสารออกแบบ (design-only) — ยังไม่เขียนโค้ด
> **เป้าหมาย:** จัดโครงทั้งระบบให้ **สลับจาก mock/localStorage → backend จริง (Supabase/REST) ได้โดยหน้าและ context ไม่ต้องแก้**
> **เอกสารพี่น้อง:** [PROJECT-BRIEF.md](PROJECT-BRIEF.md) · [AUTH-DESIGN.md](AUTH-DESIGN.md) · [BACKEND-DESIGN.md](BACKEND-DESIGN.md)

---

## 0. หลักการ (Ports & Adapters)

ปัญหาปัจจุบัน: หน้าและ context **เรียก localStorage/mock ตรง ๆ** กระจายทั่วโค้ด → พอจะต่อ backend ต้องไล่แก้ทุกจุด

หลักการเป้าหมาย: คั่นด้วย **ชั้น Data Layer เดียว** — ทุกการอ่าน/เขียนข้อมูลผ่าน "repository" ที่มี interface คงที่ · เบื้องหลังเปลี่ยน adapter ได้ (local ↔ supabase) โดยผู้เรียกไม่รู้

```
หน้า (pages) ──► Context / Hooks ──► Repository (interface) ──► Adapter
                                          │                      ├─ LocalAdapter    (วันนี้: localStorage + mock)
                                          │                      └─ SupabaseAdapter (พรุ่งนี้: DB + RLS)
                                     (API เดิมไม่เปลี่ยน)      เลือกด้วย ENV
```

**กติกาเหล็ก:** หลังจัดโครงนี้ **ห้ามให้หน้า/component เรียก `localStorage` หรือ import `mock.ts` ตรง ๆ อีก** — ต้องผ่าน repository เท่านั้น

---

## 1. สภาพปัจจุบัน — แหล่งข้อมูลที่กระจายอยู่ (ต้องรวบเข้า Data Layer)

| แหล่ง | ที่อยู่ | เก็บที่ | domain |
|---|---|---|---|
| งานขายสด | `SalesContext` (`usePersistentState`) | localStorage `sales_*_v*` | leads · deals · customers · quotations · appointments |
| ข้อมูลเครือ (HQ) | `useNetworkData.ts` | derive จาก SalesContext + seed | network leads/quotations/customers/dealer detail |
| ตัวแทน | `loadHQDealers()` / `usePersistentState(HQ_DEALERS_KEY)` | `hq_dealers_v4` | dealers + credentials |
| ผู้ใช้ HQ | `usePersistentState("hq_users_v4")` | `hq_users_v4` | users |
| ราคากลาง/แม่แบบ | `loadMasterCatalog()` / `useMasterCatalog()` | `master_catalog_v2` | catalog + price history |
| นโยบาย/เป้า/กฎ | `loadHQPolicy/Targets/NotifRules`, `loadDealerLeadRulesMap` | `hq_*` keys | settings |
| ไฟล์ | `loadDealerFiles/addDealerFile/removeDealerFile` | `dealer_files_*` | files |
| ผู้รับผิดชอบ | `loadResponsiblePersons()` | `bpms_responsible_persons` | persons |
| audit | `loadAudit/appendAudit` (useAudit) | `hq_audit_log_v1` | audit |
| ลูกค้า DB | `useCustomerDb()` | derive จาก quotations won | customer database |
| โปรไฟล์/บริษัท | `loadUserProfile`, company panel | `bpms_profile_*`, `hq_company_profile` | profile · company |
| **auth** | `authenticate()` (`auth.ts`) ✅ | 2 คลัง | **มี interface แล้ว** |

> **ข้อดีที่มีอยู่:** `auth.ts` ถูกวางเป็น interface กลางไว้แล้ว (Phase A) — เป็นต้นแบบของ pattern นี้ ทำที่เหลือให้เหมือนกัน

---

## 2. โครงสร้างเป้าหมาย `src/lib/data/`

```
src/lib/data/
  types.ts            re-export type จาก mock (Lead/Quotation/... เป็นสัญญาข้อมูล)
  config.ts           อ่าน ENV → เลือก adapter (local | supabase)
  adapter.ts          interface DataAdapter (สัญญาที่ทุก adapter ต้องมี)

  repositories/       ← ชั้นที่ context/hook เรียก (API สาธารณะ)
    leads.ts          listLeads(scope) · getLead(id) · addLead() · updateLead() · deleteLead()
    quotations.ts     listQuotations() · addQuotation() · setStatus() ...
    customers.ts · appointments.ts · deals.ts
    dealers.ts · users.ts · catalog.ts · files.ts · persons.ts
    settings.ts       policy/targets/notifRules/leadRules (get/save)
    audit.ts          list() · append()
    network.ts        aggregation ฝั่ง HQ (view)

  local/              ← Adapter วันนี้ (localStorage + mock)
    LocalAdapter.ts   ห่อโค้ด load*/usePersistentState เดิม (ย้ายมารวมที่นี่)
    seed.ts           re-use mock.ts เป็นค่าเริ่มต้น

  supabase/           ← Adapter พรุ่งนี้ (ว่างไว้ก่อน — เฟส B)
    client.ts         createClient(env)
    SupabaseAdapter.ts map ตาราง ↔ type · ใช้ RLS
    realtime.ts       subscribe postgres_changes

  index.ts            export repositories (ผูก adapter ตาม config)
```

**สัญญา (interface) ตัวอย่าง:**
```ts
// repositories/leads.ts — signature เป็น async ตั้งแต่แรก (กันแก้ตอนต่อ backend)
export interface LeadsRepo {
  list(scope: Scope): Promise<Lead[]>;      // scope = { dealerCode? } → RLS/filter
  get(id: number): Promise<Lead | null>;
  add(input: NewLead): Promise<Lead>;
  update(id: number, patch: Partial<Lead>): Promise<Lead>;
  remove(id: number): Promise<void>;
}
```
- **local:** อ่าน/เขียน localStorage (sync ห่อใน `Promise.resolve`)
- **supabase:** `supabase.from("leads").select()...` (RLS กรอง scope ให้อัตโนมัติ)

---

## 3. สลับ adapter ด้วย ENV

```
.env.local
  NEXT_PUBLIC_DATA_SOURCE = local            # หรือ "supabase"
  NEXT_PUBLIC_SUPABASE_URL = ...
  NEXT_PUBLIC_SUPABASE_ANON_KEY = ...
```
```ts
// config.ts
export const DATA_SOURCE = process.env.NEXT_PUBLIC_DATA_SOURCE ?? "local";
// index.ts
const adapter = DATA_SOURCE === "supabase" ? new SupabaseAdapter() : new LocalAdapter();
export const leads: LeadsRepo = adapter.leads;
```
→ เปลี่ยน backend = แก้ ENV ตัวเดียว (dev ใช้ local, prod ใช้ supabase, เทสต์ใช้ local) — ไม่ redeploy โค้ดหน้า

---

## 4. Context / Hooks เชื่อมยังไง (API เดิมไม่เปลี่ยน)

`SalesContext` เป็นจุดที่ทุกหน้า Dealer พึ่ง — **API ของ `useSales()` คงเดิมทุกตัว** เปลี่ยนแค่ภายใน:
```
เดิม:  usePersistentState("sales_leads_v2", seed)  → setState + localStorage
ใหม่:  useEffect(() => { leadsRepo.list(scope).then(setLeads) })
       addLead = async (x) => { const r = await leadsRepo.add(x); setLeads(prev=>[...]) }
       + subscribe realtime (เฟส B) แทน event bus
```
- หน้า/component **ไม่ต้องแก้** เพราะยังเรียก `useSales().addLead(...)` เหมือนเดิม
- `useNetworkData`/`useCustomerDb`/`useAudit` ก็ห่อ repository แบบเดียวกัน

---

## 5. เรื่องที่ต้องรับมือตอนเป็น async (localStorage sync → network async)

| ประเด็น | วิธีจัดการ |
|---|---|
| **Loading state** | ทุก list มี `loading`/`error` (มี `Skeleton`/`EmptyState` อยู่แล้ว) |
| **Error handling** | repository โยน error → context เก็บ `error` → แสดง toast/retry |
| **Optimistic update** | เขียน state ทันที + rollback ถ้า repo ล้มเหลว (UX ไม่กระตุก) |
| **SSR / hydration** | list เริ่ม `[]` แล้ว fetch หลัง mount (แพตเทิร์นเดิมของ `usePersistentState`/`useMasterCatalog`) |
| **Realtime** | เฟส B: subscribe แทน event bus — sync ข้ามผู้ใช้/เครื่อง |
| **Caching** | เริ่มด้วย fetch-on-mount · ถ้าต้องการค่อยเสริม SWR/React Query ทีหลัง (ไม่บังคับ) |

---

## 6. ส่วนที่ต่อกับ Data Layer นอกจาก DB

| ระบบ | วันนี้ (local) | backend (supabase) |
|---|---|---|
| **Auth** | `auth.ts` ค้น 2 คลัง localStorage | `supabase.auth` + `profiles` (interface เดิม) |
| **Files (Storage)** | metadata + data URL | `filesRepo` upload → Supabase Storage, คืน signed URL |
| **Realtime** | `window.dispatchEvent` event bus | `supabase.channel().on("postgres_changes")` |
| **Server logic** | ทำใน context (เลขที่ใบ/cascade Won→ลูกค้า) | RPC/trigger ฝั่ง DB (ดู BACKEND-DESIGN §7) |

---

## 7. ลำดับ Migration (ทำทีละ domain — หน้าไม่พัง)

```
0. โครง data/ + config + LocalAdapter (ห่อโค้ดเดิม ไม่เปลี่ยนพฤติกรรม)   ← ทำได้เลย ไม่มี Supabase
1. ย้าย SalesContext ให้เรียก repository (ยังชี้ LocalAdapter)          ← พิสูจน์ว่า API เดิมไม่พัง
2. ย้าย loader อื่น ๆ (dealers/catalog/settings/files/audit) เข้า repo
3. เขียน SupabaseAdapter + client + schema/RLS (BACKEND-DESIGN)
4. สลับ ENV = supabase ทีละ domain (leads ก่อน) + เทสต์ RLS
5. เปิด realtime แทน event bus
6. เลิกใช้ APP_NOW (ใช้ created_at จริง) + ลบ localStorage stores ที่ย้ายแล้ว
```
**สเต็ป 0-2 ทำได้ทันทีโดยไม่ต้องมี backend** — เป็นการ "จัดบ้าน" ให้พร้อมเสียบ · สเต็ป 3+ ค่อยทำเมื่อมี Supabase

---

## 8. Checklist ความพร้อมต่อ backend

- [ ] หน้า/component ไม่มี `localStorage.*` และไม่ import `mock.ts` ตรง (ผ่าน repo หมด)
- [ ] ทุก repository เป็น **async** ตั้งแต่แรก (signature ไม่ต้องแก้ตอนต่อ network)
- [ ] Context เปิด `loading`/`error` ให้ UI
- [ ] scope (dealerCode) ส่งเข้า repository ทุก query (พร้อมให้ RLS ทำงาน)
- [ ] `auth.ts` เป็น interface เดียว (✅ มีแล้ว Phase A)
- [ ] ENV คุมแหล่งข้อมูล (`NEXT_PUBLIC_DATA_SOURCE`)
- [ ] type เดียวกัน (`types.ts`) ใช้ทั้ง local และ supabase (สัญญาข้อมูลไม่ drift)

---

## สรุป (mental model)

- **ปัญหาวันนี้:** ข้อมูลเรียกตรงจาก localStorage/mock กระจายทั่วโค้ด → ต่อ backend ยาก
- **ทางแก้:** ชั้น `src/lib/data/` (repository + adapter) เป็น "ปลั๊กเดียว" — หน้า/context เรียกผ่านมันเสมอ
- **ผลลัพธ์:** สลับ local ↔ Supabase ด้วย ENV ตัวเดียว โดยหน้าไม่ต้องแก้ · `auth.ts` คือต้นแบบที่พิสูจน์แล้วว่าใช้ได้
- **เริ่มได้ทันที:** สเต็ป 0-2 (จัดบ้าน) ไม่ต้องรอ Supabase — พอ backend พร้อมก็เสียบ (สเต็ป 3+)
