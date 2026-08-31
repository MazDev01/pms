// ── ฟอร์มในกล่องต้องไม่ล้นแนวนอน (บอสทัก 28 ส.ค. 69) ────────────────────────────
//
// อาการที่บอสเจอ: ฟอร์มแก้ไขแม่แบบมีแถบเลื่อนแนวนอนโผล่ใต้ฟอร์ม ต้องลากไปมาถึงจะเห็นครบ
// ต้นเหตุ: <input> มีความกว้างขั้นต่ำในตัวราว 170px และ flexbox จะไม่ยอมย่อให้ต่ำกว่านั้น
//   ถ้าไม่สั่ง minWidth:0 → แถวแม่แบบย่อย (รูป+ชื่อ+ราคา+ปุ่ม) ล้นกล่อง
//
// ⚠️ การขยายกล่องให้กว้างขึ้นอย่างเดียว "ไม่ใช่การแก้" — แค่ทำให้พ้นอาการที่จอใหญ่
//    เทสต์จึงวัดที่จอแคบด้วย ถ้าวันหนึ่งมีคนเอา minWidth:0 ออก จะจับได้ทันที
import { test, expect } from "@playwright/test";
import { ADMIN, skipReason } from "./supabaseEnv";
import { HQ_ORIGIN, loginUI } from "./funcHelpers";
import { settle } from "./helpers";

test.skip(() => skipReason() !== "", skipReason() || "พร้อมรัน");

for (const กว้าง of [1280, 900]) {
  test(`[ui·hq] ฟอร์มแก้ไขแม่แบบต้องไม่ล้นแนวนอน ที่จอกว้าง ${กว้าง}`, async ({ page }) => {
    await page.setViewportSize({ width: กว้าง, height: 900 });
    await loginUI(page, HQ_ORIGIN, "/hq/login", ADMIN);
    await page.goto(`${HQ_ORIGIN}/hq/master`, { waitUntil: "domcontentloaded" });
    await settle(page);
    await page.getByRole("button", { name: "แก้ไข", exact: true }).first().click();
    await expect(page.getByLabel("ราคากลาง (บาท)")).toBeVisible({ timeout: 15_000 });

    const ผล = await page.evaluate(() => {
      const ช่อง = document.querySelector('input[aria-label="ราคากลาง (บาท)"]');
      const กล่อง = ช่อง?.closest('[role="dialog"]') ?? ช่อง?.closest("div");
      const ล้น: { cls: string; scroll: number; client: number }[] = [];
      gather(กล่อง as HTMLElement);
      function gather(root: HTMLElement | null) {
        if (!root) return;
        for (const el of [root, ...Array.from(root.querySelectorAll("*"))] as HTMLElement[]) {
          if (el.scrollWidth - el.clientWidth > 1) {
            ล้น.push({ cls: `${el.tagName}.${(el.className || "").toString().slice(0, 40)}`, scroll: el.scrollWidth, client: el.clientWidth });
          }
        }
      }
      return { กว้างกล่อง: Math.round((กล่อง as HTMLElement)?.getBoundingClientRect().width ?? 0), ล้น };
    });
    expect(ผล.ล้น, "ต้องไม่มีอะไรในฟอร์มล้นแนวนอน (แถบเลื่อนล่างจะโผล่)").toEqual([]);
  });
}
