import { test, expect } from "@playwright/test";
import { RYG, skipReason } from "./supabaseEnv";
import {
  DEALER_ORIGIN, loginUI, watchErrors, assertNoErrors,
  db, waitRow, cleanup, tagged,
} from "./funcHelpers";

// นัดหมาย + ไฟล์แนบ — สองส่วนสุดท้ายของงานตัวแทนที่ยังไม่มีเทสต์เชิงฟังก์ชัน
// ไฟล์เป็นกรณีพิเศษ: ต้องขึ้น Supabase Storage จริง ไม่ใช่แค่แถวใน DB
test.skip(() => skipReason() !== "", skipReason() || "พร้อมรัน");
test.setTimeout(240_000);
test.describe.configure({ mode: "serial" });

const CUSTOMER = tagged("นัดหมาย");

test.beforeAll(async () => { await cleanup(await db(RYG), "RYG"); });
test.afterAll(async () => {
  const sb = await db(RYG);
  await cleanup(sb, "RYG");
  // ไฟล์ทดสอบ: ลบทั้งแถวใน DB และไบต์ใน Storage
  const { data } = await sb.from("files").select("id,storage_path").like("name", `%ZZTEST%`);
  for (const f of data ?? []) {
    if (f.storage_path) await sb.storage.from("dealer-files").remove([f.storage_path as string]);
    await sb.from("files").delete().eq("id", f.id);
  }
});

test("[func] สร้างนัดหมายผ่านหน้าจอ → ลง DB ของสาขา", async ({ page }) => {
  const errs = watchErrors(page);
  const sb = await db(RYG);

  await loginUI(page, DEALER_ORIGIN, "/login", RYG);
  await page.goto(`${DEALER_ORIGIN}/calendar`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});

  await page.getByRole("button", { name: "เพิ่มกิจกรรม" }).first().click();
  const note = page.getByPlaceholder("รายละเอียดกิจกรรม");
  await expect(note, "ฟอร์มนัดหมายต้องเปิด").toBeVisible({ timeout: 10_000 });
  await page.getByPlaceholder("จังหวัด").fill(CUSTOMER);
  await note.fill("นัดทดสอบอัตโนมัติ");
  await page.getByRole("button", { name: "เพิ่มกิจกรรม" }).last().click();

  const row = await waitRow<{ dealer_code: string; id: number }>(
    sb, "appointments", { province: CUSTOMER }, 20_000);
  expect(row.dealer_code, "นัดใหม่ต้องเป็นของสาขาที่ล็อกอิน").toBe("RYG");
  // เลขต้องมาจากตัวนับของ DB (next_entity_id) ไม่ใช่ Date.now()
  // ค่าจาก Date.now() เป็นเลข 13 หลัก (~1.7e12) — เลขนับของสาขาต้องเล็กกว่ามาก
  expect(row.id, "เลขนัดต้องมาจากตัวนับของสาขา").toBeGreaterThan(0);
  expect(row.id, "เลขนัดต้องไม่ใช่ timestamp (Date.now)").toBeLessThan(1_000_000);

  assertNoErrors(errs, "สร้างนัดหมาย");
});

test("[func] แนบไฟล์ที่ลีด → ไบต์ขึ้น Storage และมีแถวใน DB", async ({ page }) => {
  const errs = watchErrors(page);
  const sb = await db(RYG);
  const COMPANY = tagged("ลีดไฟล์");
  const FILENAME = "ZZTEST-เอกสารทดสอบ.txt";

  await loginUI(page, DEALER_ORIGIN, "/login", RYG);

  // ต้องมีลีดก่อน — การแนบไฟล์อยู่ในลิ้นชักรายละเอียดลีด ไม่ใช่หน้าคลังไฟล์
  await page.goto(`${DEALER_ORIGIN}/leads`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "เพิ่มลูกค้าเป้าหมาย" }).first().click();
  await page.getByPlaceholder("เช่น บริษัท ตัวอย่าง จำกัด").fill(COMPANY);
  await page.getByPlaceholder("ชื่อผู้ติดต่อ").fill("คุณไฟล์");
  await page.getByRole("button", { name: "บันทึก" }).click();
  await waitRow(sb, "leads", { company: COMPANY });

  await page.getByRole("button", { name: "ตาราง" }).click();
  const row = page.locator("tbody tr").filter({ hasText: COMPANY }).first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.getByRole("button", { name: "ดูรายละเอียด" }).first().click();

  // ส่วน "ไฟล์" อยู่ท้ายลิ้นชัก · ปุ่มอาจยังไม่อยู่ในระยะมองเห็น แต่ input มีอยู่ใน DOM แล้ว
  // (input ถูกซ่อนไว้โดยตั้งใจ — ปุ่มเป็นตัวสั่งเปิดหน้าต่างเลือกไฟล์)
  // ตัวที่ไม่มี accept คือช่องแนบไฟล์ทั่วไป · ที่มี accept="image/*" คือช่องอัปโหลดโลโก้
  const fileInput = page.locator('input[type="file"]:not([accept])').first();
  await expect(fileInput, "ลิ้นชักลีดต้องมีช่องแนบไฟล์").toBeAttached({ timeout: 15_000 });
  await fileInput
    .setInputFiles({ name: FILENAME, mimeType: "text/plain", buffer: Buffer.from("benjamin test") });

  // แถว metadata ต้องลง DB
  const f = await waitRow<{ dealer_code: string; storage_path: string | null }>(
    sb, "files", { name: FILENAME }, 25_000);
  expect(f.dealer_code, "ไฟล์ต้องเป็นของสาขาที่ล็อกอิน").toBe("RYG");

  // และไบต์ต้องอยู่ใน Storage จริง — ไม่ใช่ metadata ลอย ๆ
  expect(f.storage_path, "ต้องมีพาธไฟล์ใน Storage").toBeTruthy();
  expect(f.storage_path!.startsWith("RYG/"),
    "พาธต้องขึ้นต้นด้วยรหัสสาขา (Storage RLS คุมด้วยชื่อโฟลเดอร์)").toBe(true);
  const signed = await sb.storage.from("dealer-files").createSignedUrl(f.storage_path!, 60);
  expect(signed.error, `ดึงไฟล์จาก Storage ไม่ได้: ${JSON.stringify(signed.error)}`).toBeNull();

  assertNoErrors(errs, "แนบไฟล์ที่ลีด");
});

// หมายเหตุความครอบคลุม — ยังไม่ได้เทสต์:
//   • "นัดที่บันทึกไว้แสดงบนปฏิทิน" — เขียนแล้วแต่หาไม่เจอบนหน้าจอ
//     ลองทั้งกด "วันนี้" (เพราะวันนี้ของระบบตรึงที่ 30 มิ.ย. 2569 คนละเดือนกับนาฬิกาจริง)
//     และกดเลือกวันที่ ก็ยังไม่เจอ · ยังแยกไม่ได้ว่าเป็นเทสต์เลือก selector ผิด
//     หรือปฏิทินไม่แสดงนัดจริง — ต้องตรวจด้วยตาก่อน ไม่เดา
//   • แก้/ลบนัดหมายผ่านหน้าจอ
//   • ลบไฟล์แนบผ่านหน้าจอ (ต้องลบทั้งแถวใน files และไบต์ใน Storage)
//   • แท็บการแจ้งเตือนในหน้าตั้งค่าตัวแทน
