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
  expect(row.id, "เลขนัดต้องมาจากตัวนับของ DB").toBeGreaterThan(0);

  assertNoErrors(errs, "สร้างนัดหมาย");
});

test("[func] อัปโหลดไฟล์แนบ → ไบต์ขึ้น Storage และมีแถวใน DB", async ({ page }) => {
  const errs = watchErrors(page);
  const sb = await db(RYG);
  const FILENAME = "ZZTEST-เอกสารทดสอบ.txt";

  await loginUI(page, DEALER_ORIGIN, "/login", RYG);
  await page.goto(`${DEALER_ORIGIN}/files`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});

  // หน้า /files เป็น "คลังรวม" อ่านอย่างเดียว — ดึงไฟล์ที่แนบไว้กับลีด/ลูกค้ามารวมกัน
  // การแนบไฟล์จริงอยู่ในแผงรายละเอียดลีด ยังไม่ได้เขียนเทสต์ทางนั้น (ดูหมายเหตุท้ายไฟล์)
  const input = page.locator('input[type="file"]').first();
  if (await input.count() === 0) {
    test.skip(true, "หน้าคลังไฟล์ไม่มีช่องอัปโหลด (อัปโหลดอยู่ที่แผงลีด) — ยังไม่ได้เขียนเทสต์ทางนั้น");
    return;
  }

  await input.setInputFiles({ name: FILENAME, mimeType: "text/plain", buffer: Buffer.from("benjamin test") });

  // แถว metadata ต้องลง DB
  const row = await waitRow<{ dealer_code: string; storage_path: string | null; name: string }>(
    sb, "files", { name: FILENAME }, 25_000);
  expect(row.dealer_code, "ไฟล์ต้องเป็นของสาขาที่ล็อกอิน").toBe("RYG");

  // และไบต์ต้องอยู่ใน Storage จริง — ไม่ใช่แค่ metadata ลอย ๆ
  expect(row.storage_path, "ต้องมีพาธไฟล์ใน Storage").toBeTruthy();
  expect(row.storage_path!.startsWith("RYG/"), "พาธต้องขึ้นต้นด้วยรหัสสาขา (Storage RLS คุมด้วยโฟลเดอร์)").toBe(true);
  const signed = await sb.storage.from("dealer-files").createSignedUrl(row.storage_path!, 60);
  expect(signed.error, `ดึงไฟล์จาก Storage ไม่ได้: ${JSON.stringify(signed.error)}`).toBeNull();

  assertNoErrors(errs, "อัปโหลดไฟล์");
});

// หมายเหตุความครอบคลุม — ยังไม่ได้เทสต์:
//   • "นัดที่บันทึกไว้แสดงบนปฏิทิน" — เขียนแล้วแต่หาไม่เจอบนหน้าจอ
//     ลองทั้งกด "วันนี้" (เพราะวันนี้ของระบบตรึงที่ 30 มิ.ย. 2569 คนละเดือนกับนาฬิกาจริง)
//     และกดเลือกวันที่ ก็ยังไม่เจอ · ยังแยกไม่ได้ว่าเป็นเทสต์เลือก selector ผิด
//     หรือปฏิทินไม่แสดงนัดจริง — ต้องตรวจด้วยตาก่อน ไม่เดา
//   • แก้/ลบนัดหมายผ่านหน้าจอ
//   • อัปโหลด/ลบไฟล์แนบ — ทำที่แผงรายละเอียดลีด ไม่ใช่หน้าคลังไฟล์
//     ต้องยืนยันทั้งแถวใน files และไบต์ใน Storage (พาธต้องขึ้นต้นด้วยรหัสสาขา)
//   • แท็บการแจ้งเตือนในหน้าตั้งค่าตัวแทน
