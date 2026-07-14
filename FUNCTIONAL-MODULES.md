# Benjamin PMS — โมดูล & ระบบการทำงาน (ฟังก์ชัน)

> เอกสารนี้อธิบาย **โมดูลทั้งหมด + ฟังก์ชันการทำงาน (business logic)** ของโปรเจค
> — เจาะเฉพาะ *สิ่งที่ระบบทำ* ไม่รวมรายละเอียด UI / สี / สไตล์

---

## 0. ภาพรวมสถาปัตยกรรม

- **Frontend-only demo** — Next.js 15 (App Router) + React 19 + TypeScript · **ไม่มี backend / ไม่มี DB**
- **ที่เก็บข้อมูล = `localStorage`** ทั้งหมด (persist ข้ามการรีเฟรช) ผ่าน `usePersistentState` + loader/saver รายโมดูล
- **การซิงก์ข้ามหน้า** ใช้ 2 กลไก: (1) React Context (state กลางในหน่วยความจำ) (2) `window` **CustomEvent** (เช่น ไฟล์/โปรไฟล์/นโยบาย เปลี่ยนแล้วยิง event ให้ทุกหน้าที่ subscribe อัปเดตสด)
- **2 workspace**: **ตัวแทน (Dealer)** = งานขาย · **สำนักงานใหญ่ (HQ)** = ควบคุมนโยบาย/ภาพรวมทั้งเครือ
- **ขอบเขตธุรกิจ (hard scope):** วงจรการขาย **Lead → Won/Lost เท่านั้น** (ไม่มี ก่อสร้าง/ผลิต/ติดตั้ง/ซ่อมบำรุง)
- **"วันนี้" ของ mock = 2026-06-30** (deterministic)

---

## 1. Data Model (Entity หลัก) — `src/lib/mock.ts`

| Type | ความหมาย / ฟิลด์เชิงฟังก์ชัน |
|---|---|
| `UserRole` | บทบาทผู้ใช้ (dealer / hq ระดับต่าง ๆ) — ใช้กับ permission |
| `LeadStatus` | สเตจการขาย 7 ค่า: `WAITING`(ติดต่อแล้ว) → `BULLET`(รวบรวมความต้องการ) → `QUOTED`(เสนอราคา) → `FOLLOWUP`(ติดตามผล) → `NEGO`(เจรจาต่อรอง) → `PAID`(ปิดสำเร็จ) / `CANCELLED`(ปิดไม่สำเร็จ) |
| `LeadRow` | **ลูกค้าเป้าหมาย / ดีล** — บริษัท ผู้ติดต่อ โทร อีเมล จังหวัด แม่แบบ มูลค่า สเตจ ผู้รับผิดชอบ `customerId`(ผูกเมื่อเป็นลูกค้า) `numId`(=dealId) `tasks[]` `activities[]` |
| `LeadTask` | งานในเช็กลิสต์ Sales Journey (`key/label/done/doneAt/doneBy`) — เช็กแล้วเลื่อนสเตจอัตโนมัติ |
| `CustomerRow` | **ลูกค้า** (เกิดจาก Lead→Won หรือคีย์/นำเข้า) — บริษัท ผู้ติดต่อ ประเภท(บุคคล/บริษัท) สถานะ(active/inactive) แม่แบบ ยอดสะสม เจ้าของ `imported?` |
| `QuotationMock` | **ใบเสนอราคา** — `id`,`customer`,`project`,`total`(สตริง ก่อน VAT),`totalValue`(ตัวเลข ก่อน VAT),`materialCost`,`lineItems[]`(BOQ),`status`,`date`,`expiry`,`customerId`,`dealId`,`revision`,`discountPct`,`note`,`paymentTerms`,`deliveryTime`,`issuer?` |
| `QuoteLineItem` | รายการ BOQ 1 แถว: `name/qty/unit/unitPrice` |
| `QuotationStatus` | `draft`→`sent_to_client`→`viewed`→`won`/`lost`/`expired` |
| `AppointmentMock` / `ApptType` | นัดหมาย (เยี่ยม/ประชุมแบบ/นำเสนอ/เซ็นสัญญา/ปิดการขาย/ติดตาม) |
| `NoteMock` | โน้ต/รายงานติดตาม (หมวด + เนื้อหา + เวลาแก้ไข) |
| `SolutionProduct` | **แม่แบบในแคตตาล็อก** — ชื่อ สเปก ราคากลาง หน่วย `subtypes[]` + ประวัติราคา (`SolutionPriceHistory`) |
| `DealerFile` | ไฟล์แนบ — ชื่อ นามสกุล ขนาด หมวด ที่มา (`lead/customer/upload`) `recordId`/`customerId` ผู้/เวลาอัปโหลด |
| `DealerRow` / `TeamMock` | ตัวแทนในเครือ / สมาชิกทีม (สำหรับ HQ) |
| `ResponsiblePerson` | **ผู้รับผิดชอบ (RP)** = ชื่อเซลส์สำหรับ assign — *ไม่ใช่ user, login ไม่ได้* |
| `HQPolicy` | นโยบาย HQ: `maxDiscount`,`requireApproval`,`vat`,`quoteValidityDays` |
| `HQTargets` | เป้ายอดขายรายปีต่อตัวแทน |
| `IssuerProfile` / `DocProfile` | โปรไฟล์บริษัทผู้ออกเอกสาร + ตั้งค่า VAT/ตรา/ลายเซ็น |

---

## 2. State Layer (Context)

### `SalesContext` (`context/SalesContext.tsx`) — แหล่งข้อมูลกลางเดียวทั้งแอป
ยก state ขึ้นมากลาง เพื่อให้ทุกหน้าใช้ชุดเดียวกันสด (`useSales()`):

- **Deals (pipeline):** `deals`, `addDeal`, `updateDealTask`, `moveDealStage`, `closeDeal(won/lost)`, `updateDealNotes`, `addDealFile`, `logDealActivity`
- **Lead ↔ Deal:** `leadDealMap`(leadId→dealId), `openDealFromLead(lead)`(สร้าง/คืน deal ของลีด), `getDealForLead`
- **เช็กลิสต์ลีด:** `leadChecklists`, `updateLeadChecklist` (ซิงก์ leads ↔ pipeline)
- **Leads:** `leads`, `addLead`, `updateLead`, `deleteLead`, `updateLeadStatus`
  - `updateLead` ทำ **auto-convert**: เมื่อสถานะเป็น `PAID` และยังไม่มี `customerId` → สร้าง Customer ให้อัตโนมัติ (`convertLeadToCustomer`)
- **Customers:** `customers`, `addCustomer`, `updateCustomer`, `deleteCustomer`
- **Quotations:** `quotations`, `addQuotation`, `updateQuotation`, `deleteQuotation`, `setQuotationStatus`
- **Appointments:** `appointments`, `addAppointment`, `updateAppointment`, `deleteAppointment` (ปฏิทิน/แดชบอร์ด/แจ้งเตือน ใช้ชุดเดียว)
- **Conversion:** `convertLeadToCustomer(lead, removeLead?)` → สร้าง Customer จริงจากลีด

**โมเดลความสัมพันธ์:** `Deal = LeadRow` (ผูกด้วย `numId`) · 1 Customer → หลาย Deal · ใบเสนอราคาผูกดีลด้วย `quotation.dealId === lead.numId` · Won → สร้าง Customer อัตโนมัติ

### `RoleContext` (`context/RoleContext.tsx`)
- อ่าน role จาก session (`pms_session_key` ใน localStorage) ตอน mount
- `useRole()` คืนบทบาท + ข้อมูล session ปัจจุบัน → ใช้กำหนดเมนู/สิทธิ์/ป้ายเจ้าของบัญชี (Dealer vs HQ)

### `FilterContext` (`context/FilterContext.tsx`) — ระบบตัวกรองกลาง
- **มิติกรอง (`FilterDim`):** `dealer`, `province`, `product`, `status`, `person` + **ช่วงเวลา** (`TimePreset`: last7/last30/thisMonth/quarter/thisYear/custom)
- `parseDate`, `TimeRange` — คำนวณช่วงวันที่จาก preset
- ตัวเลือกสำเร็จรูป: `DEALER_OPTIONS`, `PRODUCT_OPTIONS`, `PROVINCE_OPTIONS`, `PERSON_OPTIONS`
- `useFilters()` + `RecordFields` — ฟังก์ชัน `passes(record)` ตรวจว่าเรคคอร์ดผ่านตัวกรองปัจจุบันไหม (ใช้ทุกหน้าตาราง/บอร์ด)
- persist ค่าตัวกรองผ่าน `storageKey`

---

## 3. Persistence & Settings — โหลด/บันทึก + Event

### `usePersistentState` (`lib/usePersistentState.ts`)
Hook `useState` ที่ sync กับ `localStorage` อัตโนมัติ (อ่านตอน mount, เขียนตอนเปลี่ยน)

### Loaders / Savers ใน `mock.ts` (อ่านค่าตั้งค่าจริงเสมอ)
- **โปรไฟล์ผู้ใช้:** `profileKey`, `loadUserProfile`, `defaultProfileEmail` + event `PROFILE_UPDATED_EVENT`
- **ผู้รับผิดชอบ (RP):** `loadResponsiblePersons` (คีย์ `RP_STORAGE_KEY`)
- **นโยบาย HQ:** `loadHQPolicy` (เพดานส่วนลด/ต้องอนุมัติ/VAT/อายุใบเสนอราคา)
- **เป้ายอดขาย HQ:** `loadHQTargets`
- **เลขที่ใบเสนอราคา:** `loadQuoteNumbering` (prefix + running) · `loadQuoteValidityDays` · `loadDefaultDiscount`
- **เหตุผลปิดการขายไม่สำเร็จ:** `loadLostReasons`
- **การแจ้งเตือน:** dealer → `loadNotifPrefs` + `notifCategoryOf` · HQ → `loadHQNotifPrefs` (email/inapp/line) + event
- **หมวด audit:** `hqAuditCategory(action)`

### Dealer File Store (`mock.ts`) — คลังไฟล์แหล่งเดียว
- `loadDealerFiles`, `saveDealerFiles`, `addDealerFile`, `removeDealerFile` (คีย์ `DEALER_FILES_KEY`, event `DEALER_FILES_EVENT`)
- `extOfName` (เดานามสกุล), `guessFileCategory` (เดาหมวดจากชื่อ)
- `quotationToFile` / `syncAddQuotationFile` / `syncRemoveQuotationFile` — แปลง/ซิงก์ใบเสนอราคาเป็นไฟล์
- **หลักการ:** หน้าไฟล์ *ดึง* ไฟล์ที่ผูกกับ lead/customer มาแสดง (ไม่ auto-generate จากใบเสนอราคา)

### `settingsBus` (`lib/settingsBus.tsx`) — บัสหน้าตั้งค่า
- `useReportSection(api)` — แต่ละแท็บรายงาน `{dirty, save, reset}` ขึ้นบัสกลาง → ปุ่ม **บันทึกกลางเดียว** บนหัว + เตือน unsaved
- `useSettingsToast()` — ยิง toast จากที่ไหนก็ได้

### `theme.ts`
ค่าคงที่โทเคนสี (นอกขอบเขตเอกสารนี้) — เฉพาะ export ตัวแปรสี ไม่มี logic

---

## 4. Business Logic (lib)

### `permissions.ts` — สิทธิ์ตามบทบาท
- `Permission` (รายการสิทธิ์), `ROLE_PERMISSIONS` (map role→สิทธิ์), `hasPermission(role, perm)` → ควบคุมว่าบทบาทใดทำอะไรได้

### `useAudit.ts` — บันทึกการใช้งาน (HQ)
- `loadAudit`, `appendAudit({user,role,action,target})` (คีย์ localStorage)
- `useAuditLogger()` — คืนฟังก์ชัน log ผูก user/role ปัจจุบัน (เรียกตอน mutation ใน dealers/master/settings)
- `useAuditEntries()` — คืนรายการ audit สำหรับหน้า `/hq/audit`

### `useNetworkData.ts` — ข้อมูลรวมทั้งเครือ (HQ, read-only)
- `CURRENT_DEALER` (ตัวแทนที่กำลังดู)
- `useNetworkQuotations()` — ใบเสนอราคาทั้งเครือ
- `useNetworkCustomers()` — ลูกค้าทั้งเครือ
- `useNetworkDealerDetail(code)` — รายละเอียดตัวแทนรายราย (สถิติ/ลูกค้า/ใบเสนอราคา)

### `useMasterCatalog.ts`
- `useMasterCatalog()` — คืนแคตตาล็อกแม่แบบ (`SolutionProduct[]`) แบบ reactive · `loadMasterCatalog` + `mainTemplateOf(name)` (แม่แบบหลักจากชื่อ)

### `quotationPrint.ts` — สร้าง/พิมพ์เอกสาร (แหล่งความจริงของ VAT)
- `loadIssuer`, `loadDoc`, `loadWordmark` — โปรไฟล์บริษัท/เอกสาร/หัวกระดาษ
- `buildQuotationHTML(q, issuer, cust?, doc, wordmark)` — สร้าง HTML A4 เต็มรูปแบบ:
  - **`subtotal = q.totalValue` = "มูลค่างาน (ก่อน VAT)"** → `vat = subtotal × vatPct%` → `grand = subtotal + vat` = "ยอดรวมสุทธิ (รวม VAT)"
  - VAT บังคับมาจาก `loadHQPolicy().vat` เสมอ (ตัวแทนแก้ไม่ได้)
- `printQuotation(q, cust?)` — เปิดหน้าต่างพิมพ์ด้วย HTML ข้างต้น
> นิยามยอดเงินทั้งระบบ: `total`/`totalValue` = **ก่อน VAT** · เอกสาร/โมดัลบวก VAT เพื่อแสดง grand total

### `format.ts` — จัดรูปแบบเงิน
- `parseBaht(v)` (สตริง `฿1.2M/480K/2.8B` → ตัวเลข) · `fmtBaht(v)` (ย่อ M/K) · `fmtFull(v)` (เต็ม มี comma) · `fmtM(v)`

### `imageResize.ts`
- `fileToResizedDataURL(file, maxSize, quality)` — ย่อรูป/โลโก้เป็น dataURL ก่อนเก็บ localStorage

---

## 5. Feature Modules ตาม Route

### Auth
| Route | ฟังก์ชัน |
|---|---|
| `/` , `(auth)/login` | ล็อกอินตัวแทน — ตั้ง `pms_session_key`, `pms_logged_in` |
| `(auth)/login/hq` | ล็อกอินสำนักงานใหญ่ (session แยก role) |
| `layout` guard | `AuthGuard` กันเข้าเมื่อยังไม่ล็อกอิน · `AppShell` = โครง Sidebar+Topbar |

### Dealer Workspace
| Route | ฟังก์ชันหลัก |
|---|---|
| `/dashboard` | KPI งานขาย, YTD vs เป้ารายปี (ไม่ prorate ตามตัวกรอง) + Won-This-Month, กราฟแนวโน้ม, นัด/งานที่ต้องทำ |
| `/leads` | จัดการลูกค้าเป้าหมาย: สร้าง/แก้/ลบ, เปลี่ยนสเตจ (dropdown), Sales Journey (เช็กลิสต์ล็อกลำดับ), ใบเสนอราคา/นัด/ไฟล์/โน้ต, ปิด Won/Lost (+เหตุผล). โมดัลรายละเอียด **Split 70/30** |
| `/leads/[id]` | Deep-link รายลีด |
| `/customers` | ลูกค้า: ดู/แก้ในตัว, ประวัติดีล, ใบเสนอราคา (ดูอย่างเดียว), นัด/ไฟล์/โน้ต, "สร้างดีลใหม่" (=addLead ผูก customerId). โมดัล **Split 70/30** · นำเข้า CSV / คีย์ลูกค้าเดิม |
| `/customers/[id]` | Deep-link รายลูกค้า |
| `/quotations` | ใบเสนอราคา: ตาราง/การ์ด, **สร้าง (wizard หน้าเดียว)**, แก้ไข (ฟอร์ม), ดู (Split 70/30 + BOQ + VAT breakdown), เปลี่ยนสถานะ, ส่งอีกครั้ง, พิมพ์ PDF, ทำสำเนา, ลบ |
| `/calendar` | ปฏิทินนัดหมาย (ใช้ `appointments` กลาง) |
| `/products` | แคตตาล็อกแม่แบบ (ดูฝั่งตัวแทน) |
| `/files` | คลังไฟล์ (ดึงไฟล์ผูก lead/customer) — Skeleton loading, EmptyState, พรีวิวไฟล์ |
| `/reports` | รายงานยอดขายฝั่งตัวแทน |
| `/settings` | ตั้งค่าตัวแทน — ปุ่มบันทึกกลาง + เตือน unsaved (ผ่าน settingsBus) |
| `/profile` | โปรไฟล์ผู้ใช้ (ชื่อ/อีเมล/รูป) → sync การ์ด sidebar |

### HQ Workspace (สำนักงานใหญ่)
| Route | ฟังก์ชันหลัก |
|---|---|
| `/hq/dashboard` | ภาพรวมยอดขายทั้งเครือ |
| `/hq/dealers` , `/hq/dealers/[dealerCode]` | จัดการตัวแทน + รายละเอียด (อ่านอย่างเดียว + แท็บกิจกรรม) — log audit |
| `/hq/customers` | ลูกค้าทั้งเครือ (network, read-only) + empty state |
| `/hq/pipeline` | ภาพรวม pipeline/ยอดขายทั้งเครือ |
| `/hq/quotations` | ใบเสนอราคาทั้งเครือ |
| `/hq/master` | **แคตตาล็อกแม่แบบกลาง** (ราคากลาง HQ) — ตัวแทนดึงไปใช้ · log audit |
| `/hq/company` | ข้อมูลบริษัท — ปุ่มบันทึกเดียว |
| `/hq/users` | ผู้ใช้ HQ เท่านั้น + สถิติ/matrix + รีเซ็ตรหัสผ่าน |
| `/hq/reports` | รายงาน HQ (dashboard รวมทุกส่วน) |
| `/hq/audit` | บันทึกการใช้งาน (ใคร/ทำอะไร/เมื่อไหร่) |
| `/hq/settings` | นโยบายกลาง: เพดานส่วนลด, ต้องอนุมัติ, VAT, อายุใบเสนอราคา, เลขที่ใบเสนอราคา, เป้ายอดขาย, การแจ้งเตือน — บังคับใช้ทั้งเครือ |

---

## 6. Functional Components (เฉพาะ logic การทำงาน)

| Component | หน้าที่ (ฟังก์ชัน) |
|---|---|
| `LeadTasks` | เช็กลิสต์ Sales Journey — **ล็อกตามลำดับ**: ติ๊กขั้นถัดไปไม่ได้ถ้าขั้นก่อนหน้ายังไม่ครบ, ปลดติ๊กย้อนหลังไม่ได้ถ้าขั้นถัดไปติ๊กแล้ว · เช็กครบ → เลื่อนสเตจอัตโนมัติ · แสดง % จากงาน (ลาก/ปรับเองไม่ได้) |
| `LeadQuotationsPanel` | แผงใบเสนอราคาแบบ inline ในหน้า Lead/Customer — list/create/edit/view · รองรับ lead (ยังไม่เป็นลูกค้า ผูก dealId) และ customer (ดูอย่างเดียว) · totals แบบ ก่อน/รวม VAT |
| `QuotationCreateModal` | **ตัวช่วยสร้างใบเสนอราคา (หน้าเดียว)** — เลือกลูกค้า (combobox) / เพิ่มลูกค้าใหม่ · เลือก/สร้างดีล · เลือกแม่แบบ+พื้นที่ (ราคาประมาณการ) · BOQ (เลือกจากแคตตาล็อก/รายการเอง) · ข้อมูลใบเสนอราคา (เลขอัตโนมัติ/สถานะ/วันที่/หมดอายุ/เงื่อนไข) · แถบสรุป real-time (มูลค่า ก่อน/รวม VAT) · ตรวจ `canSave` + บอกเหตุผลถ้าบันทึกไม่ได้ · เพดานส่วนลด HQ |
| `LineItemsEditor` | ตาราง BOQ — เพิ่มจากแคตตาล็อก (ดึงราคากลาง HQ) หรือเพิ่มเอง, แก้จำนวน/ราคา/หน่วย, ลบแถว, คิดยอดรวมต่อแถว/รวม |
| `FilterBar` | UI ตัวกรองกลาง — เชื่อม `useFilters` (เวลา/ตัวแทน/จังหวัด/แม่แบบ/สถานะ) |
| `TableTools` | pagination + sort ตาราง (`useTableLayout`, `Col`) + ซ่อน/แสดงคอลัมน์ |
| `ExportMenu` | ส่งออกข้อมูลตาราง (CSV) |
| `FilePreviewModal` | พรีวิวไฟล์ (PDF/รูป/pptx/generic) จาก DealerFile |
| `ActivityTimeline` | ไทม์ไลน์กิจกรรมจาก `ActivityTimelineItem[]` |
| `PersonPicker` / `AssigneeAvatars` | เลือก/แสดงผู้รับผิดชอบ (RP) |
| `TemplateSelect` | dropdown เลือกแม่แบบจากแคตตาล็อก |
| `Charts` / `SalesTrendChart` | กราฟยอดขาย/แนวโน้ม (คำนวณจากข้อมูลกลาง) |
| `KpiCard` / `StatCard` / `CountUp` | แสดงตัวเลข KPI (CountUp = นับขึ้น) |
| `PageHeader` / `Sidebar` / `Topbar` / `AppShell` | โครงเลย์เอาต์ + เมนูตาม role + แจ้งเตือน (dealer=งานขาย, HQ=บันทึกการใช้งาน) |
| `Badge` / `EmptyState` / `Skeleton` / `RightDrawer` | primitive สถานะ/ว่าง/โหลด/ลิ้นชัก |

---

## 7. Cross-cutting Flows (การทำงานข้ามโมดูล)

1. **วงจรการขาย:** Lead(WAITING) → ติ๊กงานใน Sales Journey → เลื่อนสเตจอัตโนมัติ → QUOTED(ออกใบเสนอราคา) → FOLLOWUP/NEGO → **Won(PAID)** หรือ **Lost(CANCELLED + เหตุผล)**
2. **Won → Customer:** `updateLead` เห็นสถานะ PAID + ยังไม่มี customerId → เรียก `convertLeadToCustomer` สร้างลูกค้าจริงอัตโนมัติ
3. **Deal = Lead:** "สร้างดีลใหม่" จากลูกค้า = `addLead` (LeadRow ใหม่ผูก `customerId`) · ใบเสนอราคาผูกดีลด้วย `dealId = lead.numId`
4. **ใบเสนอราคา → ไฟล์:** ออกใบ → `syncAddQuotationFile` เพิ่มเข้าคลังไฟล์ · ลบใบ → `syncRemoveQuotationFile`
5. **นโยบาย HQ บังคับใช้:** เพดานส่วนลด/VAT/อายุใบ/เลขที่ มาจาก `loadHQPolicy`+`loadQuoteNumbering` → dealer แก้ไม่ได้ (เกินเพดาน = ต้องอนุมัติ)
6. **VAT ตรงกันทุกจุด:** สร้าง/บันทึก/ดู/พิมพ์ ใช้ `totalValue` = ก่อน VAT เป็นยอดบันทึก แล้วบวก VAT ตามนโยบายเพื่อแสดงยอดรวมสุทธิ
7. **Audit (HQ):** ทุก mutation สำคัญ (dealers/master/settings) → `appendAudit` → แสดงที่ `/hq/audit`
8. **แจ้งเตือนแยก role:** dealer = เหตุการณ์งานขาย (`NotifPrefs`) · HQ = บันทึกการใช้งาน (`HQNotifChannels`)

---

*สร้างจากการสำรวจซอร์สโค้ดจริง — โฟกัสฟังก์ชัน/logic ตามที่ร้องขอ (ไม่รวม UI/สี)*
