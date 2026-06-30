# Benjamin PMS — สเปกการจัดการดีลเลอร์ (Dealer Management)

> ครอบคลุม: การเพิ่มดีลเลอร์ + สร้าง Dealer Admin อัตโนมัติ, หน้าจัดการดีลเลอร์ (เพิ่ม/แก้/ปิด/ดูผลงาน)
> สิทธิ์: เฉพาะ **SUPER_ADMIN / HQ_MANAGEMENT** (HQ_STAFF อ่านอย่างเดียว) — ดู [PERMISSIONS.md](./PERMISSIONS.md)
> schema: [prisma/schema.prisma](../prisma/schema.prisma) → `Dealer`, `User`

---

## 1. Flow การเพิ่มดีลเลอร์ (Onboarding)

```
HQ กรอกฟอร์มเพิ่มดีลเลอร์
   │
   ├─► [1] สร้าง Dealer record (dealerId ใหม่, type=DEALER, status=ACTIVE)
   │
   ├─► [2] สร้าง User คนแรก = DEALER_ADMIN  ← อัตโนมัติ
   │        (ยังไม่มีรหัสผ่าน → สถานะ PENDING_INVITE)
   │
   ├─► [3] ส่งลิงก์ตั้งรหัสผ่าน (อีเมล/LINE) ให้ Dealer Admin
   │        → ดีลเลอร์คลิก → ตั้งรหัสเอง → status=ACTIVE
   │        (HQ ไม่เห็นรหัส = ปลอดภัย)
   │
   ├─► [4] ผูกจังหวัดรับผิดชอบ + เป้ายอดขาย
   │
   └─► [5] เขียน AuditLog (action=CREATE, entity=Dealer + User)
```

### ฟอร์มเพิ่มดีลเลอร์ — ฟิลด์
| ฟิลด์ | บังคับ | ไปที่ | หมายเหตุ |
|-------|:---:|------|---------|
| รหัสดีลเลอร์ (code) | ✓ | `Dealer.code` | unique, ตัวพิมพ์ใหญ่ เช่น CNX/RYG, แก้ไม่ได้ภายหลัง |
| ชื่อดีลเลอร์ | ✓ | `Dealer.name` | |
| ภาค (region) | ✓ | `Dealer.region` | เหนือ/กลาง/ตะวันออก/ตะวันตก/ใต้ |
| จังหวัดรับผิดชอบ | ✓ | `Dealer.provinces[]` | ใช้ auto-routing ลีด |
| เป้ายอดขาย/ปี | – | `Dealer.targetRevenue` | ใช้คำนวณ % เป้า |
| ที่อยู่/เบอร์/อีเมล | – | `Dealer.*` | |
| **ชื่อ + อีเมล Dealer Admin** | ✓ | `User` (คนแรก) | ใช้สร้างบัญชี + ส่งคำเชิญ |

### Service (pseudo)
```ts
async function createDealer(input, ctx) {
  policy.assert(ctx.role, 'dealer:create')        // SUPER / HQ_MANAGEMENT
  return db.$transaction(async (tx) => {
    const dealer = await tx.dealer.create({ data: { ...input, type: 'DEALER', status: 'ACTIVE' } })
    const admin  = await tx.user.create({ data: {
      dealerId: dealer.id, role: 'DEALER_ADMIN',
      name: input.adminName, email: input.adminEmail,
      passwordHash: '', status: 'INACTIVE',         // รอตั้งรหัส
    }})
    await sendInvite(admin)                          // อีเมล/LINE ลิงก์ตั้งรหัส
    await audit(tx, ctx, 'CREATE', 'Dealer', dealer.id)
    await audit(tx, ctx, 'CREATE', 'User', admin.id)
    return dealer
  })
}
```

---

## 2. หน้า "จัดการดีลเลอร์" (`/dealers`)

### เลย์เอาต์
```
┌──────────────────────────────────────────────────────────────┐
│  จัดการดีลเลอร์            [ค้นหา]  [ภาค▾] [สถานะ▾]  [+ เพิ่ม] │
├──────────────────────────────────────────────────────────────┤
│ รหัส │ ชื่อ        │ ภาค   │ ยอด/เป้า │ Active │ สถานะ │ ⋯    │
│ CNX  │ เชียงใหม่   │ เหนือ │ 68% ▓▓▓░ │  5    │ ●ใช้  │ แก้   │
│ RYG  │ ระยอง       │ ตอ.   │ 92% ▓▓▓▓ │  3    │ ●ใช้  │ แก้   │
│ CRI  │ เชียงราย    │ เหนือ │ 41% ▓▓░░ │  2    │ ●ใช้  │ แก้   │
│ MST  │ แม่สอด      │ ตต.   │  –       │  0    │ ○ปิด  │ แก้   │
└──────────────────────────────────────────────────────────────┘
```

### คอลัมน์ในตาราง + แหล่งข้อมูล
| คอลัมน์ | แหล่งข้อมูล |
|---------|-------------|
| รหัส / ชื่อ / ภาค | `Dealer` |
| ยอด/เป้า (%) | `Quotation(WON)` รวม `total` ÷ `Dealer.targetRevenue` |
| โครงการ Active | `Project(IN_PROGRESS|QC|HANDOVER)` count by dealer |
| สถานะ | `Dealer.status` |

```ts
db.dealer.findMany({
  where: { type: 'DEALER' },                       // HQ: ไม่กรอง dealerId
  include: { _count: { select: { projects: true, users: true } } },
  orderBy: { name: 'asc' },
})
// ยอดขายดึงแยกแล้ว merge (groupBy quotation by dealerId)
```

### หน้ารายละเอียดดีลเลอร์ (`/dealers/[id]`) — แท็บ
1. **ข้อมูล** — แก้ชื่อ/ภาค/จังหวัด/เป้า/ที่อยู่
2. **ผู้ใช้** — รายชื่อ User ในดีลเลอร์ (เชิญใหม่/รีเซ็ตรหัส/ปิดบัญชี)
3. **ผลงาน** — ยอดขาย, win rate, funnel, โครงการ (เหมือน Leaderboard เจาะรายตัว)
4. **กิจกรรม/Audit** — log ของดีลเลอร์นี้ (รวม act-on-behalf ของ HQ)

---

## 3. การแก้ไข / ปิดดีลเลอร์
| การกระทำ | กฎ |
|----------|-----|
| แก้ข้อมูล | แก้ได้ทุกฟิลด์ **ยกเว้น `code`** (ผูกเอกสาร/เลขที่) |
| ปิดดีลเลอร์ | ตั้ง `status=INACTIVE` (**soft**, ไม่ลบ) → User ในดีลเลอร์ล็อกอินไม่ได้ แต่ข้อมูลเดิมยังอยู่ |
| เปิดใหม่ | ตั้งกลับ `ACTIVE` |
| ลบจริง | ไม่อนุญาต (ข้อมูลลีด/โครงการอ้างอิงอยู่) |

> ปิดดีลเลอร์ → ลีด/โครงการที่ค้างควรเตือน HQ ให้ **โอนให้ดีลเลอร์อื่น** ก่อน

---

## 4. จุดเชื่อมกับส่วนอื่น
- **Auto-routing ลีด** ← `Dealer.provinces[]`
- **Leaderboard / ยอดรายภาค** ใน [DASHBOARD-HQ.md](./DASHBOARD-HQ.md) ← ข้อมูลหน้านี้
- **Act-on-behalf** — HQ เข้าไปช่วยกรอกแทนดีลเลอร์ได้ (บันทึก `onBehalfOfDealerId`)
