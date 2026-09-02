import { test, expect } from "@playwright/test";
import { RYG, skipReason } from "./supabaseEnv";
import { DEALER_ORIGIN, loginUI } from "./funcHelpers";

// ── กดรีเฟรชแล้วต้องกรอกเลขยืนยันต่อได้ จนกว่าเลขจะหมดอายุ (บอสสั่ง 2 ก.ย. 69) ────────
//
// บอสเจอจริง: ขอเลขไปแล้ว กรอกไม่ทัน/รีเฟรชหน้า → ช่องกรอกหายหมด ต้องกดขอเลขใหม่
//   แต่การขอเลขถูกจำกัดไว้ 3 ครั้งต่อ 15 นาที (กันคนยิงอีเมลถล่ม) → ขึ้น "ขอเลขยืนยันถี่เกินไป"
//   กลายเป็นเข้าไม่ได้เลยทั้งที่เลขในอีเมลยังใช้ได้อีกเกือบชั่วโมง
//
// ที่ล็อกไว้: หลังขอเลขแล้วรีเฟรช ช่องกรอกต้องยังอยู่ พร้อมบอกว่าเลขใช้ได้อีกกี่นาที
test.skip(() => skipReason() !== "", skipReason() || "พร้อมรัน");
test.setTimeout(120_000);

test("[func·dealer] ขอเลขดูรหัสผ่านแล้วรีเฟรชหน้า → ช่องกรอกต้องยังอยู่ ไม่ต้องขอเลขใหม่", async ({ page }) => {
  await loginUI(page, DEALER_ORIGIN, "/login", RYG);
  await page.goto(`${DEALER_ORIGIN}/settings/account`, { waitUntil: "domcontentloaded" });

  // จำลอง "เคยกดขอเลขไปแล้วเมื่อครู่" โดยไม่ยิงอีเมลจริง (ยิงจริงจะกินโควตาส่งอีเมลของบัญชี)
  //   สิ่งที่วัดคือหน้าจอจำสถานะข้ามการรีเฟรชได้ไหม ไม่ใช่การส่งอีเมล
  await page.evaluate(() => {
    localStorage.setItem("pms_reveal_RYG", JSON.stringify({
      sentTo: "ry••••@example.com", exp: Date.now() + 30 * 60 * 1000,
    }));
  });
  await page.reload({ waitUntil: "domcontentloaded" });

  const ช่องกรอก = page.getByLabel("เลขยืนยันจากอีเมล");
  await expect(ช่องกรอก, "รีเฟรชแล้วต้องยังกรอกเลขเดิมต่อได้").toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/ใช้ได้อีก/), "ต้องบอกด้วยว่าเลขยังใช้ได้อีกกี่นาที").toBeVisible();

  // กดยกเลิก = เลิกใช้เลขนั้น รีเฟรชแล้วต้องกลับไปเป็นปุ่ม "ดูรหัสผ่าน" ตามเดิม
  await page.getByRole("button", { name: "ยกเลิก" }).first().click();
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "ดูรหัสผ่าน" })).toBeVisible({ timeout: 20_000 });
});

test("[func·dealer] เลขที่หมดอายุแล้ว ต้องไม่โผล่ช่องกรอกค้างไว้", async ({ page }) => {
  await loginUI(page, DEALER_ORIGIN, "/login", RYG);
  await page.goto(`${DEALER_ORIGIN}/settings/account`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.setItem("pms_reveal_RYG", JSON.stringify({
      sentTo: "ry••••@example.com", exp: Date.now() - 1000,   // หมดอายุไปแล้ว
    }));
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "ดูรหัสผ่าน" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByLabel("เลขยืนยันจากอีเมล")).toHaveCount(0);
});

test("[func·dealer] กดซ่อนแล้วต้องกดดูซ้ำได้ โดยไม่ต้องขอเลขใหม่", async ({ page }) => {
  // บอสสั่ง 2 ก.ย. 69: เดิมกดซ่อนแล้วกลับไปเริ่มต้น ต้องขอเลขใหม่ทั้งที่เพิ่งยืนยันไป
  //   แล้วการขอถูกจำกัด 3 ครั้ง/15 นาที — เผลอกดซ่อนครั้งเดียวก็ติดทางตัน
  await loginUI(page, DEALER_ORIGIN, "/login", RYG);
  await page.goto(`${DEALER_ORIGIN}/settings/account`, { waitUntil: "domcontentloaded" });

  // จำลองสถานะ "ยืนยันเลขผ่านแล้ว กำลังเห็นรหัสอยู่" โดยดักคำตอบของเซิร์ฟเวอร์
  //   (ยิงขอเลขจริงจะกินโควตาส่งอีเมลของบัญชีจริง — สิ่งที่วัดคือพฤติกรรมของปุ่มซ่อน/ดูอีกครั้ง)
  await page.route("**/api/account/reveal", async route => {
    const body = JSON.parse(route.request().postData() || "{}");
    if (body.op === "send") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ sentTo: "ry••••@example.com" }) });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ password: "ZZTEST-รหัสทดสอบ" }) });
  });

  await page.getByRole("button", { name: "ดูรหัสผ่าน" }).click();
  await page.getByLabel("เลขยืนยันจากอีเมล").fill("12345678");
  await page.getByRole("button", { name: "ยืนยัน" }).click();
  await expect(page.getByText("ZZTEST-รหัสทดสอบ")).toBeVisible({ timeout: 20_000 });

  // กดซ่อน → รหัสหายจากจอ แต่ต้องมีปุ่มให้กดดูซ้ำได้ทันที
  await page.getByRole("button", { name: "ซ่อน" }).click();
  await expect(page.getByText("ZZTEST-รหัสทดสอบ")).toHaveCount(0);
  await page.getByRole("button", { name: "ดูอีกครั้ง" }).click();
  await expect(page.getByText("ZZTEST-รหัสทดสอบ"), "กดดูอีกครั้งต้องเห็นเลย ไม่ต้องขอเลขใหม่").toBeVisible();

  // กด "เสร็จสิ้น" = จบจริง กลับไปเป็นปุ่มขอเลขตามเดิม
  await page.getByRole("button", { name: "ซ่อน" }).click();
  await page.getByRole("button", { name: "เสร็จสิ้น" }).click();
  await expect(page.getByRole("button", { name: "ดูรหัสผ่าน" })).toBeVisible();
});
