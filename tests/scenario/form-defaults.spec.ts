// ── ช่องเลือกต้องเริ่มที่ "ยังไม่ระบุ" และจังหวัดต้องเลือกจากเขตของสาขา ─────────────
// (บอสสั่ง 20 ส.ค. 69) สองเรื่องนี้เป็นกติกาเดียวกันของทั้งระบบ:
//   ห้ามให้ช่องตอบแทนผู้ใช้ · ห้ามให้พิมพ์จังหวัดอิสระจนตัวกรองจับไม่ตรง
import { test, expect } from "@playwright/test";
import { RYG, skipReason } from "./supabaseEnv";
import { openAs, settle } from "./helpers";

test.skip(() => skipReason() !== "", skipReason() || "พร้อมรัน");
test.setTimeout(180_000);

test("[ui·dealer] ฟอร์มเพิ่มกิจกรรม: จังหวัดเป็นตัวเลือกตามเขตของสาขา ไม่ใช่ช่องพิมพ์", async ({ page }) => {
  await openAs(page, RYG, "dealer", "/calendar");
  await settle(page);
  await page.getByRole("button", { name: "เพิ่มกิจกรรม" }).first().click();

  const ช่อง = page.getByLabel("จังหวัด");
  await expect(ช่อง, "ต้องเป็นช่องเลือก (select) ไม่ใช่ input").toBeVisible({ timeout: 20_000 });
  expect(await ช่อง.evaluate(el => el.tagName)).toBe("SELECT");
  await expect(ช่อง, "ต้องเริ่มที่ยังไม่ระบุ ไม่ใช่เลือกจังหวัดให้เอง").toHaveValue("");

  const ตัวเลือก = await ช่อง.evaluate(el => [...(el as HTMLSelectElement).options].map(o => o.value).filter(Boolean));
  expect(ตัวเลือก.length, "ต้องมีจังหวัดให้เลือก").toBeGreaterThan(0);
  // RYG = ภาคตะวันออก — ต้องไม่มีจังหวัดนอกเขต เช่น เชียงใหม่ ปนมา
  expect(ตัวเลือก, "ต้องเป็นจังหวัดในเขตของสาขาเท่านั้น").not.toContain("เชียงใหม่");
});

test("[ui·dealer] ฟอร์มอัปโหลดไฟล์: โฟลเดอร์เริ่มที่ยังไม่ระบุ", async ({ page }) => {
  await openAs(page, RYG, "dealer", "/files");
  await settle(page);
  await page.getByRole("button", { name: "อัปโหลดไฟล์" }).first().click();
  // ต้องเจาะจงในหน้าต่างอัปโหลด — แถบเครื่องมือของหน้ามีตัวกรอง "กรองตามโฟลเดอร์" อยู่ด้วย
  // (ชื่อมีคำว่า "โฟลเดอร์" เหมือนกัน) ถ้าไม่เจาะจง จะไปจับตัวกรองแล้วอ่านค่าได้ "ALL"
  const ช่อง = page.getByRole("dialog", { name: "อัปโหลดไฟล์" }).getByLabel("โฟลเดอร์").first();
  await expect(ช่อง).toBeVisible({ timeout: 20_000 });
  await expect(ช่อง, 'ต้องขึ้น "— ยังไม่ระบุ —" ไม่ใช่เลือก "อื่นๆ" ไว้ให้แล้ว').toHaveValue("");
});
