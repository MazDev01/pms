import { test, expect } from "@playwright/test";
import { open } from "./helpers";
import { skipReason } from "./supabaseEnv";

// ── ปุ่มลูกตาเปิดดูรหัสที่พิมพ์ ในหน้าโปรไฟล์ (บอสสั่ง 2 ก.ย. 69) ────────────────
//
// ทำไมต้องมี: ช่องรหัสผ่านปิดบังตัวอักษรทั้งหมด พิมพ์ผิดแล้วไม่รู้ตัวจนกดบันทึกไม่ผ่าน
// ที่ล็อกไว้: กดแล้วเห็นจริง · กดซ้ำแล้วปิดกลับ · เปิดทีละช่อง ไม่ใช่เปิดพร้อมกันทั้งสามช่อง
//   (ช่อง "ยืนยันรหัสผ่านใหม่" มีไว้กันพิมพ์ผิด — เปิดดูพร้อมกันหมดก็ไม่เหลืออะไรให้ยืนยัน)
test.skip(() => skipReason() !== "", skipReason() || "พร้อมรัน");
test.setTimeout(120_000);

test("[ux·hq] ช่องรหัสผ่านในหน้าโปรไฟล์ มีปุ่มลูกตาเปิดดูได้ทีละช่อง", async ({ page }) => {
  await open(page, "hq", "/profile");

  const รหัสใหม่ = page.getByPlaceholder("อย่างน้อย 6 ตัวอักษร");
  const ยืนยัน = page.getByPlaceholder("พิมพ์รหัสผ่านใหม่อีกครั้ง");
  await expect(รหัสใหม่).toBeVisible({ timeout: 20_000 });
  await รหัสใหม่.fill("Benjamin-2569");

  await expect(รหัสใหม่, "ค่าตั้งต้นต้องปิดบังไว้").toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "แสดงรหัสผ่านใหม่" }).click();
  await expect(รหัสใหม่, "กดลูกตาแล้วต้องเห็นตัวอักษรจริง").toHaveAttribute("type", "text");
  await expect(ยืนยัน, "ช่องอื่นต้องยังปิดบังอยู่ — เปิดทีละช่องเท่านั้น").toHaveAttribute("type", "password");

  await page.getByRole("button", { name: "ซ่อนรหัสผ่านใหม่" }).click();
  await expect(รหัสใหม่, "กดซ้ำต้องปิดกลับ").toHaveAttribute("type", "password");

  // ครบทั้งสามช่อง
  for (const ป้าย of ["รหัสผ่านปัจจุบัน", "รหัสผ่านใหม่", "ยืนยันรหัสผ่านใหม่"]) {
    await expect(page.getByRole("button", { name: `แสดง${ป้าย}` }),
      `ช่อง ${ป้าย} ต้องมีปุ่มลูกตา`).toBeVisible();
  }
});
