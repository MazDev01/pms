# Benjamin PMS — แผนแยกเป็น Monorepo (Turborepo · HQ + Dealer แยกแอป)

> **สถานะ:** เอกสารแผน — ยังไม่ย้ายไฟล์จริง (tree มีงาน in-flight ของ process อื่นอยู่)
> **การตัดสินใจ:** Turborepo + pnpm · 2 แอปแยก (`apps/hq`, `apps/dealer`) · หน้า login แยก · deploy แยก
> **ลำดับที่เลือก: A → B** — แยก monorepo ก่อน (ช่วงแรก HQ เห็นแต่ seed) แล้วต่อ backend Supabase ทีหลัง (HQ ดูข้อมูล dealer จริงได้)
> **ยังไม่เริ่ม (prerequisite):** (1) tree ต้องว่าง — process อื่น commit/หยุดก่อน · (2) ติดตั้ง `pnpm` (ยังไม่มีในเครื่อง)
> **เอกสารพี่น้อง:** [PROJECT-BRIEF.md](PROJECT-BRIEF.md) · [BACKEND-DESIGN.md](BACKEND-DESIGN.md) · [INTEGRATION-DESIGN.md](INTEGRATION-DESIGN.md)

---

## ⚠️ ข้อค้นพบสำคัญ (อ่านก่อน) — แยกแอป = ต้องมี backend ร่วม

เป้าหมาย: "**dealer ทำงานของตัวเอง · HQ ดูข้อมูลได้ · login แยกกัน**"

ปัจจุบันข้อมูลทั้งหมดอยู่ใน **localStorage ของเบราว์เซอร์** และ HQ เห็นข้อมูล dealer ผ่าน `useNetworkData` เพราะ**อยู่แอปเดียวกัน = localStorage ก้อนเดียวกัน**

**พอแยกเป็น 2 แอป (คนละ origin/โดเมน) → localStorage คนละก้อน** → แอป HQ **จะมองไม่เห็นข้อมูลที่ dealer สร้าง** (เห็นแต่ seed) เพราะเบราว์เซอร์แยก storage ตาม origin

→ **การแยกแอปให้ "HQ ดูข้อมูล dealer ได้จริง" ต้องมี backend ร่วม (Supabase — เฟส B ใน [BACKEND-DESIGN.md](BACKEND-DESIGN.md))** เป็นแหล่งข้อมูลกลาง

**3 ทางเลือกลำดับงาน:**
| ทาง | ผล |
|---|---|
| **A. แยก monorepo ก่อน + backend ทีหลัง** | โครงแยกพร้อม แต่ช่วงแรกแอป HQ เห็นแต่ seed (ยังดูข้อมูล dealer จริงไม่ได้จนต่อ Supabase) |
| **B. ทำ backend (Supabase) ก่อน + แยก monorepo ทีหลัง** | HQ ดูข้อมูล dealer ได้จริงตั้งแต่วันแยก · แต่ backend ต้องเสร็จก่อน |
| **C. ทำคู่กัน** | แยก monorepo + วาง Data Layer ให้ชี้ Supabase (Step 1-2 ของ INTEGRATION) พร้อมกัน |
> Data Layer ที่เพิ่งวาง (`src/lib/data/`) คือชิ้นที่ทำให้ทางเหล่านี้ราบรื่น — ย้ายเข้า `packages/core` แล้วสลับ adapter เป็น Supabase

---

## 1. โครงสร้างเป้าหมาย

```
benjamin-pms/                    ← root workspace
  package.json                   ← workspaces + scripts (turbo)
  pnpm-workspace.yaml
  turbo.json                     ← pipeline: build/dev/lint/typecheck
  tsconfig.base.json             ← path alias @pms/*

  apps/
    dealer/                      ← Next app · โดเมน dealer (เช่น app.benjamin.co.th)
      app/                       routes: /dashboard /leads /customers /quotations
      │                                  /products /calendar /files /settings
      app/login/                 หน้า login ของ dealer
      next.config.ts · package.json · tsconfig.json
    hq/                          ← Next app · โดเมน HQ (เช่น hq.benjamin.co.th)
      app/                       routes: /dashboard /dealers /pipeline /leads
      │                                  /quotations /customers /master /audit /settings /users
      app/login/                 หน้า login ของ HQ
      next.config.ts · package.json · tsconfig.json

  packages/
    core/                        ← ตรรกะ/ข้อมูล (ไม่มี UI)
      context/  RoleContext · SalesContext · FilterContext
      auth/     auth.ts (+ Supabase adapter เฟส B)
      data/     Data Layer (ports/adapter/repositories) ← ย้ายจาก src/lib/data
      lib/      permissions · hqAlerts · leadMetrics · hqQuotations · customerDb ·
                useAudit · useNetworkData · quotationPrint · delivery · format · ...
    ui/                          ← คอมโพเนนต์ + ดีไซน์
      charts/   Charts.tsx
      components/  ui/* · filters/* · layout/*  (Shell รับ nav config ต่อแอป)
      styles/   globals.css (design system CI)
    types/                       ← mock.ts + type (สัญญาข้อมูล)
    config/                      ← tsconfig/eslint/tailwind ที่แชร์
```

**Path alias:** `@pms/core`, `@pms/ui`, `@pms/types`, `@pms/config` (แทน `@/` เดิม) — ตั้งใน `tsconfig.base.json` + `transpilePackages` ใน next.config ของแต่ละแอป

---

## 2. อะไรย้ายไปไหน (map จากโครงปัจจุบัน)

| ปัจจุบัน (`src/`) | → ปลายทาง |
|---|---|
| `app/(app)/hq/**` + `app/(auth)/login/hq` | `apps/hq/app/**` (ตัด prefix `/hq`) |
| `app/(app)/{dashboard,leads,customers,quotations,products,calendar,files,settings,profile}` + `login` | `apps/dealer/app/**` |
| `context/*` | `packages/core/context` |
| `lib/auth.ts` · `lib/data/*` | `packages/core/auth` · `packages/core/data` |
| `lib/{permissions,hqAlerts,leadMetrics,hqQuotations,customerDb,useAudit,useNetworkData,useHQAlerts,useHQRules,quotationPrint,delivery,format,...}` | `packages/core/lib` |
| `lib/mock.ts` | `packages/types` |
| `components/ui/*` · `components/filters/*` | `packages/ui/components` |
| `components/ui/Charts.tsx` | `packages/ui/charts` |
| `components/layout/*` (AppShell/Sidebar/Topbar) | `packages/ui/components/layout` (nav config ส่งจากแต่ละแอป) |
| `components/hq/*` | `apps/hq` (เฉพาะ HQ) |
| `components/dashboard/DealerDashboard` | `apps/dealer` (เฉพาะ dealer) |
| `app/globals.css` | `packages/ui/styles` (แต่ละแอป import) |

**หลักแบ่ง:** แชร์ = ใช้ทั้งสองฝั่ง (core/ui/types) · เฉพาะแอป = `components/hq/*` ไป hq, `DealerDashboard` ไป dealer

---

## 3. Login แยก (ตามที่ต้องการ)

- แต่ละแอปมี `app/login/` ของตัวเอง (dealer = ฟอร์มตัวแทน · hq = ฟอร์ม HQ stripe เข้ม)
- ตรรกะ `auth.ts` + `RoleContext` อยู่ `packages/core` (แชร์) — แต่ละแอปเรียกใช้เฉพาะ session ฝั่งตัวเอง
- **แยก origin จริง:** cookie/session ของ dealer กับ hq ไม่ปนกัน (คนละโดเมน) — ปลอดภัยขึ้น (dealer ไม่มีทางกดสลับเข้า HQ ได้เลย ไม่เหมือนตอนเป็นแอปเดียว)
- เฟส B: Supabase Auth ตัวเดียว 2 แอปแชร์ผู้ใช้ (JWT) แต่ RLS คุมว่าเห็นอะไร

---

## 4. Tooling — ไฟล์ที่ต้องมี

```jsonc
// pnpm-workspace.yaml
packages: ["apps/*", "packages/*"]

// turbo.json — pipeline
{ "tasks": {
    "build":     { "dependsOn": ["^build"], "outputs": [".next/**"] },
    "dev":       { "cache": false, "persistent": true },
    "lint":      {}, "typecheck": {}
}}

// root package.json
{ "scripts": {
    "dev":       "turbo dev",
    "dev:hq":    "turbo dev --filter=hq",
    "dev:dealer":"turbo dev --filter=dealer",
    "build":     "turbo build"
}}
```
- แต่ละ `packages/*` มี `package.json` (`name: "@pms/core"` ฯลฯ) + `exports`
- แต่ละ `apps/*` ประกาศ dependency `"@pms/core": "workspace:*"` + `transpilePackages: ["@pms/core","@pms/ui","@pms/types"]`

---

## 5. ขั้นตอน migration (ทำตอน tree ว่าง — คนเขียนคนเดียว)

```
0. tree ต้องนิ่ง: process อื่น commit/หยุดหมดก่อน (ห้ามมีไฟล์ค้าง)
1. init workspace: pnpm-workspace.yaml + turbo.json + root package.json + tsconfig.base
2. สร้าง packages/{types,core,ui,config} + package.json/exports ของแต่ละตัว
3. git mv ไฟล์ตามตาราง §2 (ใช้ git mv รักษาประวัติ)
4. แก้ import: @/ → @pms/core|ui|types (codemod ทั้ง repo)
5. สร้าง apps/dealer + apps/hq (next.config + tsconfig + transpilePackages)
   - แยก route: hq ตัด prefix /hq · dealer = root
   - Shell รับ nav config ต่อแอป (เลิก branch isHQ ใน Sidebar)
6. pnpm install (hoist + workspace links)
7. verify: pnpm dev:dealer / dev:hq เปิดได้ · typecheck ผ่าน · แต่ละแอป build ได้
8. ย้าย tests/scenario → ต่อแอป (หรือ packages/e2e)
```

**เครื่องมือ:** เปลี่ยนจาก npm → **pnpm** (จำเป็นสำหรับ workspace) · ต้องมี `pnpm` ติดตั้งในเครื่อง

---

## 6. ⚠️ Blocker ตอนนี้ + วิธี execute อย่างปลอดภัย

git status: process อื่นกำลังแก้ค้าง ~16 ไฟล์ทั่ว repo (SalesContext, useAudit, useNetworkData, หน้า login ใหม่ `components/auth/`, package.json ...)

**การย้ายทั้ง repo เข้า monorepo = แตะทุกไฟล์ + root package.json** → ถ้าทำตอนนี้จะทับงานเขาที่ยังไม่ commit **พังกันหมด กู้ยาก**

**วิธี execute ที่ปลอดภัย (เลือกอย่างใดอย่างหนึ่ง):**
1. **รอ tree ว่าง** — process อื่น commit/push เสร็จ + ยืนยันไม่มีใครแก้ต่อ แล้วผมทำ migration รวดเดียว
2. **ทำใน git worktree แยก** — ผมสร้าง worktree ใหม่ ทำ migration ที่นั่นโดยไม่แตะ working copy ที่เขาใช้อยู่ · เสร็จแล้วค่อย merge ตอน main นิ่ง (แต่ merge จะมี conflict เยอะเพราะย้ายไฟล์ทั้งหมด)

**แนะนำ:** ทาง 1 (รอ tree ว่าง) — migration แบบย้ายทั้ง repo ควรทำบน tree สะอาด คนเดียว ครั้งเดียว จบ แล้ว commit เป็นก้อนเดียว
