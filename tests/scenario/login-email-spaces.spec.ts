import { test, expect } from "@playwright/test";

// ─── ช่องอีเมลหน้าเข้าสู่ระบบ ต้องไม่รับช่องว่าง (ผู้ใช้แจ้ง 25 ส.ค. 69) ────────
// เดิมตัดช่องว่างตอนกดเข้าระบบเท่านั้น ผู้ใช้จึงเห็นช่องว่างค้างอยู่หน้าอีเมล
// แล้วไม่แน่ใจว่าที่เข้าไม่ได้เป็นเพราะช่องว่างหรือเพราะรหัสผิด

for (const [ชื่อ, url] of [["สำนักงานใหญ่", "http://localhost:3002/hq/login"], ["ตัวแทน", "http://localhost:3001/login"]] as const) {
  test(`[func] หน้าเข้าสู่ระบบ${ชื่อ}: พิมพ์เว้นวรรคในช่องอีเมล/รหัสผ่านต้องไม่ติด`, async ({ page }) => {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    const ช่องอีเมล = page.getByLabel("อีเมล / Email");
    await expect(ช่องอีเมล).toBeVisible();

    // เคาะเว้นวรรคนำหน้า แล้วพิมพ์อีเมล — ช่องว่างต้องไม่เข้าไปอยู่ในช่อง
    await ช่องอีเมล.click();
    // พิมพ์ทีละตัวแบบคนพิมพ์จริง (เร็วเกินไป React ตามไม่ทัน เทสต์จะวูบ)
    await ช่องอีเมล.pressSequentially("  admin@benjamin.com ", { delay: 15 });
    await expect(ช่องอีเมล).toHaveValue("admin@benjamin.com");

    // วางค่าที่มีช่องว่างปนกลางก็ต้องถูกตัดเหมือนกัน
    await ช่องอีเมล.fill("");
    await ช่องอีเมล.fill(" admin @benjamin.com ");
    await expect(ช่องอีเมล).toHaveValue("admin@benjamin.com");

    // ช่องรหัสผ่านต้องกันช่องว่างเหมือนกัน (บอสสั่ง 25 ส.ค. 69)
    const ช่องรหัส = page.getByLabel("รหัสผ่าน / Password");
    await ช่องรหัส.click();
    await ช่องรหัส.pressSequentially(" ab cd ", { delay: 15 });
    await expect(ช่องรหัส).toHaveValue("abcd");
    await ช่องรหัส.fill("");
    await ช่องรหัส.fill("  P@ss w0rd  ");
    await expect(ช่องรหัส).toHaveValue("P@ssw0rd");
  });
}
