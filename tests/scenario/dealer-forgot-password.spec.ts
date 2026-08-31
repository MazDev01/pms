import { test, expect } from "@playwright/test";
const OUT = "C:/Users/boomb/AppData/Local/Temp/claude/c---claude-Benjamin-HQ-main/0b483470-aee6-4cee-b441-de2f8b9c366f/scratchpad";

test("[dealer] ลืมรหัสผ่าน → ส่งลิงก์ทางอีเมล", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("http://localhost:3001/login", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "ลืมรหัสผ่าน?" })).toBeVisible({ timeout: 20_000 });

  // ยังไม่กรอกอีเมล = ต้องบอกให้กรอกก่อน (ไม่ใช่เงียบ)
  await page.getByRole("button", { name: "ลืมรหัสผ่าน?" }).click();
  await expect(page.getByText(/กรอกอีเมลในช่องด้านบนก่อน/)).toBeVisible({ timeout: 15_000 });

  // กรอกอีเมลแล้วกดใหม่ = ต้องขึ้นว่าส่งลิงก์แล้ว
  await page.getByPlaceholder("dealer@example.com").fill("sales@rayongsteel.co.th");
  await page.getByRole("button", { name: "ลืมรหัสผ่าน?" }).click();
  // บัญชีทดสอบใช้โดเมนที่ไม่มีจริง ระบบอีเมลจึงปฏิเสธ — ต้องบอกสาเหตุจริง ไม่ใช่ "เกิดข้อผิดพลาด"
  await expect(page.getByText(/ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่|อีเมลนี้ใช้ส่งจริงไม่ได้/)).toBeVisible({ timeout: 25_000 });
  await page.screenshot({ path: `${OUT}/forgot-sent.png` });
});

test("[dealer] หน้า /reset-password เปิดตรงโดยไม่มีลิงก์ → บอกว่าไม่ถูกต้อง", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("http://localhost:3001/reset-password", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("ลิงก์ไม่ถูกต้องหรือหมดอายุ")).toBeVisible({ timeout: 25_000 });
  await expect(page.getByRole("link", { name: /กลับไปหน้าเข้าสู่ระบบ/ })).toBeVisible();
});
