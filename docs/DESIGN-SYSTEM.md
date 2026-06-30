# Benjamin PMS — Design System (สีแบรนด์ CI)

> อิงจาก CI ของ Benjamin — ใช้สีแบรนด์เป็นหลักทั่วทั้งระบบ
> Stack: Tailwind + shadcn/ui (ดู [PMS-PLAN.md](./PMS-PLAN.md) §7)

---

## 1. สีแบรนด์หลัก (CI Palette)

| สี | HEX | ความหมาย | ใช้กับ |
|----|-----|----------|--------|
| **DARK BLUE** | `#003366` | มั่นคง น่าเชื่อถือ มาตรฐานสูง (โครงเหล็ก Portal Frame) | **สีหลัก (primary)** — sidebar, ปุ่มหลัก, header, ลิงก์, active state |
| **STEEL GRAY** | `#2D2D2D` | วัสดุเหล็ก แข็งแรง ทนทาน | ตัวอักษรหลัก, พื้นมืด, footer |
| **SILVER** | `#C0C0C0` | แม่นยำ นวัตกรรม | เส้นขอบ, พื้นรอง, ข้อความรอง, disabled |

### สีเสริม (derived) — ให้พาเลตทำงานได้จริงบน UI
| Token | HEX | ใช้กับ |
|-------|-----|--------|
| Dark Blue 700 (hover) | `#00284f` | ปุ่มหลักตอน hover |
| Dark Blue 50 (tint) | `#e6edf3` | พื้น highlight อ่อน, badge อ่อน |
| Background | `#f7f8fa` | พื้นหน้าจอ |
| Surface (card) | `#ffffff` | การ์ด/พาเนล |
| Border | `#e2e5ea` (silver อ่อน) | เส้นแบ่ง |
| Muted text | `#6b7280` | ข้อความรอง |

### สีสถานะ (Functional — เลือกให้เข้ากับโทนน้ำเงิน-เทา)
| สถานะ | HEX | ใช้กับ |
|-------|-----|--------|
| Success | `#1f8a4c` | งานเสร็จ/อนุมัติ/WON |
| Warning | `#c98a00` | รออนุมัติ/ใกล้ครบกำหนด |
| Danger | `#c0392b` | ล่าช้า/LOST/ปฏิเสธ |
| Info | `#003366` | ทั่วไป (ใช้ Dark Blue) |

---

## 2. การนำไปใช้ในหน้าจอ (Usage)

| ส่วน UI | สี |
|---------|-----|
| **Sidebar** | พื้น Dark Blue `#003366`, ตัวอักษรขาว, active = Silver/ขาวเข้ม |
| **Topbar** | พื้นขาว, เส้นล่าง Border, โลโก้ + ชื่อผู้ใช้ |
| **ปุ่มหลัก (Primary)** | พื้น Dark Blue, ตัวอักษรขาว, hover = Dark Blue 700 |
| **ปุ่มรอง (Secondary)** | ขอบ Silver, ตัวอักษร Steel Gray, พื้นขาว |
| **การ์ด KPI** | พื้นขาว, ขอบ Border, ตัวเลขเด่น Steel Gray, ป้ายสีตามสถานะ |
| **Progress bar (เฟส)** | แท่ง Dark Blue บนราง Silver อ่อน |
| **ตาราง** | หัวตารางพื้น Dark Blue 50, เส้น Border, hover แถว = Dark Blue 50 |
| **ข้อความหลัก/รอง** | หลัก Steel Gray `#2D2D2D` / รอง Muted `#6b7280` |

> โทนรวม: **สะอาด มืออาชีพ น้ำเงินเข้ม-เทาเหล็ก** สื่อความมั่นคงตาม CI — หลีกเลี่ยงสีจัดจ้านนอกพาเลต

---

## 3. Design Tokens (Tailwind v4 / CSS variables)

ใส่ใน `src/app/globals.css`:
```css
@theme {
  --color-brand-blue: #003366;        /* primary */
  --color-brand-blue-hover: #00284f;
  --color-brand-blue-50: #e6edf3;
  --color-steel: #2d2d2d;             /* text/dark */
  --color-silver: #c0c0c0;            /* accent/border */

  --color-background: #f7f8fa;
  --color-surface: #ffffff;
  --color-border: #e2e5ea;
  --color-muted: #6b7280;

  --color-success: #1f8a4c;
  --color-warning: #c98a00;
  --color-danger: #c0392b;
}
```

### map เข้า shadcn/ui (HSL semantic tokens)
```css
:root {
  --primary: 210 100% 20%;            /* #003366 */
  --primary-foreground: 0 0% 100%;
  --foreground: 0 0% 18%;             /* #2D2D2D */
  --border: 220 13% 90%;
  --muted-foreground: 220 9% 46%;
  --ring: 210 100% 20%;
}
```

ใช้งานในคลาส:
```html
<button class="bg-brand-blue hover:bg-brand-blue-hover text-white">บันทึก</button>
<aside class="bg-brand-blue text-white">…sidebar…</aside>
<span class="text-steel">หัวข้อ</span>
```

---

## 4. ตัวอักษร (Typography) — แนะนำ
- ภาษาไทย: **IBM Plex Sans Thai** หรือ **Noto Sans Thai** (อ่านง่าย เป็นทางการ)
- ตัวเลข/อังกฤษ: **Inter**
- หัวข้อใหญ่ตัวหนา (bold) โทน Steel Gray ให้ความรู้สึกแข็งแรงตามแบรนด์

---

## 5. หมายเหตุตอน implement
- ตั้ง token เหล่านี้ตั้งแต่ M0 (Foundation) ก่อนทำหน้าจอ
- โลโก้/ไอคอนใช้โทนเดียวกัน; รูปงานจริง (โครงเหล็ก) ใช้เป็น hero/พื้นหลังได้ตาม CI
- ตรวจ contrast ให้ผ่าน WCAG AA (Dark Blue บนขาว, ขาวบน Dark Blue ผ่านอยู่แล้ว)
