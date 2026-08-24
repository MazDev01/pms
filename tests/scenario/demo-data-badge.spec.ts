// ── ป้าย "ข้อมูลตัวอย่าง" ต้องขึ้นเฉพาะโหมดเดโม (บอสสั่ง 24 ส.ค. 69) ──
//
// โหมดเดโมตรึง "วันนี้ของระบบ" ไว้ที่ยุคของข้อมูลตัวอย่าง (ดู appTime.ts) ผู้ใช้จึงต้องรู้ตัว
// แต่ระบบจริงเดินตามปฏิทินจริง — ถ้าป้ายนี้หลุดไปโผล่บนระบบจริง จะกลายเป็นข้อมูลผิด
import { test, expect } from "@playwright/test";
import { ADMIN, RYG, skipReason } from "./supabaseEnv";
import { openAs, settle } from "./helpers";
import { REAL_BACKEND } from "./supabaseEnv";
test.skip(() => skipReason() !== "", skipReason() || "พร้อมรัน");
test.setTimeout(180_000);
test("ระบบจริง (ต่อฐานข้อมูล) ต้องไม่มีป้ายข้อมูลตัวอย่าง", async ({ page }) => {
  await openAs(page, ADMIN, "hq", "/hq/dashboard");
  await settle(page); await page.waitForTimeout(1500);
  const มีป้าย = (await page.locator("body").innerText()).includes("ข้อมูลตัวอย่าง ·");
  console.log("โหมด backend จริง:", REAL_BACKEND, "· มีป้ายบนจอ:", มีป้าย);
  expect(มีป้าย, "โหมดต่อฐานข้อมูลจริงห้ามมีป้ายนี้").toBe(false);
});
