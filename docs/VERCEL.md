# ตั้งค่า Vercel สำหรับ Benjamin PMS

> ใช้คู่กับ [DEPLOY.md](./DEPLOY.md) — ใบนี้เฉพาะส่วนที่เป็นของ Vercel

## ต้องสร้าง 2 โปรเจกต์ ไม่ใช่โปรเจกต์เดียว

ระบบเป็น 2 เว็บแยกกัน (สำนักงานใหญ่ / ตัวแทน) ใช้โค้ดชุดเดียวกันแต่คนละที่อยู่

| โปรเจกต์ | Root Directory | ที่อยู่ที่แนะนำ |
|---|---|---|
| `benjamin-hq` | `apps/hq` | `hq.<โดเมนบริษัท>` |
| `benjamin-dealer` | `apps/dealer` | `dealer.<โดเมนบริษัท>` |

**ตั้ง Root Directory ให้ถูก** แล้วกรอกคำสั่งในหน้า Settings → Build & Development Settings

| ช่อง | ค่าของ `benjamin-hq` | ค่าของ `benjamin-dealer` |
|---|---|---|
| Install Command | `cd ../.. && pnpm install --frozen-lockfile` | เหมือนกัน |
| Build Command | `cd ../.. && npx turbo build --filter=hq` | `--filter=dealer` |
| Ignored Build Step | `cd ../.. && npx turbo-ignore hq` | `npx turbo-ignore dealer` |

> ⚠️ ต้องกรอกเองในหน้าเว็บ — ไฟล์ `vercel.json` ที่เคยเก็บค่าพวกนี้ไว้ในโค้ดถูกเอาออกแล้ว (11 ส.ค. 69)
> เป็นโมโนเรโป ถ้าไม่ตั้งคำสั่งพวกนี้ Vercel จะ build จากโฟลเดอร์แอปเดี่ยว ๆ แล้วหาแพ็กเกจร่วมไม่เจอ
> ส่วน Ignored Build Step มีไว้ข้าม build เมื่อคอมมิตนั้นไม่ได้แตะแอปนี้ (ไม่ตั้งก็ได้ แค่ build บ่อยเกินจำเป็น)

---

## ตั้งค่าลับ (Settings → Environment Variables)

ใส่ทั้ง Production และ Preview · ดูรายละเอียดแต่ละตัวใน [DEPLOY.md](./DEPLOY.md#ขั้นที่-2--ตั้งค่าลับบนเซิร์ฟเวอร์)

**โปรเจกต์สำนักงานใหญ่** — 6 ตัว รวม `SUPABASE_SERVICE_ROLE_KEY` และ `DEALER_SECRET_KEY`
🔒 ทั้งสองตัวนี้ให้ติ๊ก **Sensitive** เพื่อไม่ให้อ่านย้อนหลังได้จากหน้าเว็บ

**โปรเจกต์ตัวแทน** — 3 ตัว
🔒 **ห้ามใส่ `SUPABASE_SERVICE_ROLE_KEY`** — แอปตัวแทนไม่ได้ใช้ และการมีไว้เฉย ๆ คือความเสี่ยงเปล่า ๆ

⚠️ `NEXT_PUBLIC_*` ถูกฝังลงโค้ดตอน build — **แก้แล้วต้อง deploy ใหม่** ค่าถึงจะเปลี่ยน

---

## ทำไมตั้ง region เป็น `hnd1` (โตเกียว)

ฐานข้อมูลอยู่ที่โตเกียว (`ap-northeast-1`) — ถ้าปล่อยให้ Vercel รันที่อเมริกาตามค่าเริ่มต้น
ทุกคำขอจะวิ่งข้ามมหาสมุทรไปกลับ เพิ่มเวลารอครั้งละ 150–250 มิลลิวินาที **ต่อคำขอ**
หน้าเดียวยิงหลายคำขอ ผู้ใช้ในไทยจะรู้สึกได้ชัดว่าช้า

> ถ้าวันหนึ่งย้ายฐานข้อมูลไปที่อื่น ต้องไปแก้ Region ของทั้งสองโปรเจกต์ในหน้า Settings → Functions ให้ตรงกัน
> (ฐานข้อมูลปัจจุบันอยู่โตเกียว `ap-northeast-1` → ฝั่งเว็บควรเป็น `hnd1`)

---

## หลัง deploy ครั้งแรก — ต้องทำ 2 อย่างนี้

1. **แก้ `NEXT_PUBLIC_DEALER_APP_URL`** ของโปรเจกต์สำนักงานใหญ่ ให้ชี้ที่อยู่จริงของแอปตัวแทน
   (ตอนแรกยังไม่รู้ที่อยู่ จึงต้องกลับมาแก้ทีหลัง แล้ว deploy ใหม่)
   ถ้าไม่แก้: ปุ่ม "เข้าระบบแทนตัวแทน" จะพาไปที่ localhost ซึ่งผู้ใช้เปิดไม่ได้

2. **ยืนยันว่าใช้งานได้จริง**
   ```
   curl https://<ที่อยู่ HQ>/api/health        → ต้องได้ "status":"ok"
   curl https://<ที่อยู่ตัวแทน>/api/health     → ต้องได้ "status":"ok"
   ```
   แล้วเปิดหน้าจอจริง ล็อกอิน กดปุ่มสักปุ่ม — **ถ้าหน้าขึ้นแต่กดอะไรไม่ได้เลย**
   แปลว่ากฎความปลอดภัยบล็อกสคริปต์อยู่ ให้ดูใน Runtime Logs ว่า middleware ทำงานปกติไหม

---

## เฝ้าระวัง

Vercel มี **Monitoring → Alerts** ในตัว ตั้งให้ยิงถาม `/api/health` ทุก 1–5 นาที
แล้วแจ้งเตือนเมื่อได้ 503 ติดกัน 2 ครั้ง — ใช้ตัวนี้ก่อนได้ ยังไม่ต้องหาบริการเฝ้าระวังแยก

---

## ข้อควรระวังเฉพาะของ Vercel

- **middleware รันบน Edge runtime เสมอ** ใช้ของฝั่ง Node ไม่ได้ (เช่น `Buffer`)
  เคยพลาดมาแล้ว 7 ส.ค. 69 — บนเครื่องผ่านเพราะรันด้วย Node แต่บน Vercel จะพังทุกคำขอ
  ถ้าแก้ `middleware.ts` ให้ใช้เฉพาะของมาตรฐานเว็บ (`btoa`, `crypto`, `fetch`)
- **Preview deployment ใช้ฐานข้อมูลตัวเดียวกับของจริง** — ระวังการทดลองบน Preview
  ไปแก้ข้อมูลจริง (มีฐานทดสอบแยกแล้ว ดู GO-LIVE-CHECKLIST.md — ถ้าจะให้ Preview
  ใช้ฐานทดสอบ ต้องแก้ตัวแปรของ Preview ให้ชี้ `pms-test` แทน)

---

## ผูกกับ GitHub ให้อัพเองเมื่อ push (ตั้งแล้ว 11 ส.ค. 69)

ทั้งสองโปรเจกต์ผูกกับ `github.com/MazDev01/pms` แล้ว

| โปรเจกต์ | Root Directory | ที่อยู่ |
|---|---|---|
| `benjamin-hq` | `apps/hq` | https://benjamin-hq.vercel.app |
| `benjamin-dealer` | `apps/dealer` | https://benjamin-dealer.vercel.app |

⚠️ **ต้องตั้ง Production Branch เป็น `monorepo` เองในหน้าเว็บ** — คำสั่งบรรทัดคำสั่งตั้งค่านี้ไม่ได้

**Settings → Environments → Production → Branch Tracking** → เปลี่ยนเป็น `monorepo` → Save (ทำทั้ง 2 โปรเจกต์)

> เดิมใบนี้เขียนว่าอยู่ที่ Settings → Git ซึ่ง**ไม่ใช่แล้ว** (Vercel ย้ายไปหน้า Environments)
> หน้า Git เหลือแค่ Connected Repository / Git LFS / Deploy Hooks — เลื่อนหาเท่าไรก็ไม่เจอ

ตั้งเสร็จแล้ว Vercel **ไม่ย้อนไปเลื่อนของเก่าขึ้นให้** ต้องกระตุ้นเองอีกทีอย่างใดอย่างหนึ่ง:
Deployments → ตัวล่าสุดของสาขา `monorepo` → ⋯ → **Promote to Production** · หรือ push commit ใหม่ · หรือสั่ง deploy จากเครื่องตามหัวข้อถัดไป

ถ้าไม่ตั้ง Vercel จะถือว่าสาขาผลิตจริงคือสาขาเริ่มต้นของที่เก็บโค้ด (`main`)
ซึ่งเก่ากว่าสาขา `monorepo` อยู่มาก — push ขึ้น `monorepo` จะได้แค่ Preview ไม่ทับของจริง
(ปลอดภัยกว่าในแง่หนึ่ง แต่ไม่ใช่สิ่งที่ต้องการ)

### สั่งอัพเองจากเครื่อง (ไม่ต้องผ่าน git)

```bash
cp apps/hq/.vercel/project.json .vercel/project.json && npx vercel deploy --prod --yes
```
เปลี่ยน `apps/hq` เป็น `apps/dealer` สำหรับอีกแอป — ทั้งสองอ่านค่า Root Directory
จากหน้าจัดการโปรเจกต์ จึง build แยกกันถูกต้องแม้จะสั่งจากรากโปรเจกต์เดียวกัน
