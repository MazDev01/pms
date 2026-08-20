// ── การ์ดบนกระดานต้องแสดงข้อมูลแบบแถวป้ายกำกับ (บอสสั่ง 20 ส.ค. 69) ─────────────
// อ้างอิงระบบเดิมที่บอสใช้อยู่: "หัวข้อ: ค่า" ทีละบรรทัด — โทรศัพท์ / อีเมล / จังหวัด /
// วันที่สร้าง / ติดต่อล่าสุด  และช่องที่ยังไม่มีข้อมูลต้องขึ้น "—" ไม่ใช่หายไปทั้งบรรทัด
import { test, expect } from "@playwright/test";
import { RYG, skipReason } from "./supabaseEnv";
import { openAs, settle } from "./helpers";

test.skip(() => skipReason() !== "", skipReason() || "พร้อมรัน");
test.setTimeout(180_000);

test("[ui·dealer] การ์ดกระดานแสดงป้ายกำกับครบทุกบรรทัด และไม่มีข้อมูลขึ้น —", async ({ page }) => {
  await openAs(page, RYG, "dealer", "/leads");
  await settle(page);
  await page.getByRole("button", { name: "บอร์ด" }).click();

  const การ์ด = page.locator('[draggable="true"]').first();
  await expect(การ์ด, "ต้องมีการ์ดอย่างน้อยหนึ่งใบ").toBeVisible({ timeout: 30_000 });

  for (const ป้าย of ["โทรศัพท์:", "อีเมล:", "จังหวัด:", "สร้าง:", "ติดต่อล่าสุด:"]) {
    await expect(การ์ด.getByText(ป้าย, { exact: true }), `การ์ดต้องมีบรรทัด "${ป้าย}"`).toBeVisible();
  }

  // ทุกบรรทัดต้องมีค่าต่อท้ายเสมอ — ถ้ายังไม่มีข้อมูลต้องเป็น "—" (ห้ามปล่อยว่าง)
  const บรรทัด = await การ์ด.evaluate(el =>
    Array.from(el.querySelectorAll("span"))
      .filter(s => /^(โทรศัพท์|อีเมล|จังหวัด|สร้าง|ติดต่อล่าสุด):$/.test(s.textContent ?? ""))
      .map(s => ({ ป้าย: s.textContent, ค่า: (s.nextElementSibling?.textContent ?? "").trim() })));
  expect(บรรทัด.length, "ต้องเจอครบ 5 บรรทัด").toBe(5);
  for (const b of บรรทัด) expect(b.ค่า, `บรรทัด ${b.ป้าย} ต้องมีค่าหรือขีด`).not.toBe("");

  // มูลค่าต้องแสดงที่เดียว (ป้ายด้านบน) ไม่ใช่ซ้ำกับหัวข้อ "มูลค่าโครงการ" เดิม
  await expect(การ์ด.getByText("มูลค่าโครงการ")).toHaveCount(0);
});
