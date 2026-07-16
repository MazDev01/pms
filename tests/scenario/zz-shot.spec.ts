import { test, expect } from "@playwright/test";
import { open, assertHealthyPage } from "./helpers";

test.use({ viewport: { width: 1280, height: 1600 } });

test("[shot] กราฟประสิทธิภาพการปิดการขายของตัวแทน", async ({ page }) => {
  await open(page, "hq", "/hq/pipeline");
  await assertHealthyPage(page, "ภาพรวมยอดขาย");

  const card = page.locator(".card").filter({ hasText: "วิเคราะห์ประสิทธิภาพการปิดการขายของตัวแทน" }).first();
  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await card.screenshot({ path: "shot-chart.png" });

  await card.locator("svg g").first().hover({ force: true });
  await page.waitForTimeout(300);
  await card.screenshot({ path: "shot-hover.png" });

  await expect(page.getByText("เปิดใบเสนอราคาเยอะ แต่ปิดการขายได้น้อย")).toHaveCount(0);
});
