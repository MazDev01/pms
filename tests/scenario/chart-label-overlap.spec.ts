import { test, expect } from "@playwright/test";
import { RYG, ADMIN, skipReason } from "./supabaseEnv";
import { openAs, settle } from "./helpers";

// ── ตัวเลข/ป้ายในกราฟห้ามซ้อนทับกัน (บอสสั่ง 19 ส.ค. 69: "ตรวจทุกกราฟว่าเลขมันซ้ำทับ") ──
// กราฟทุกใบเคยวาดป้ายแกนนอนทุกจุดเสมอ ไม่มีการเว้นป้าย พอช่วง 12 เดือนหรือการ์ดแคบ
// ชื่อเดือนจะซ้อนกันจนอ่านไม่ออก · เทสนี้วัดกล่องข้อความจริงในหน้าเว็บ แล้วจับคู่ที่ทับกัน
test.skip(() => skipReason() !== "", skipReason() || "พร้อมรัน");
test.setTimeout(300_000);

/** คู่ข้อความใน svg เดียวกันที่กล่องซ้อนกันเกินเกณฑ์ — คืนรายการไว้ฟ้องพร้อมข้อความจริง */
async function overlaps(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const bad: string[] = [];
    document.querySelectorAll("svg").forEach((svg, si) => {
      const texts = [...svg.querySelectorAll("text")]
        .filter(t => (t.textContent ?? "").trim() !== "" && t.getBoundingClientRect().width > 0);
      // ป้ายที่หลุดออกเหนือกรอบกราฟ — svg ตั้ง overflow:visible มันจึงไปทับหัวข้อ/คำอธิบายของการ์ด
      //   (เคสจริง 19 ส.ค. 69: ขีดบนสุดเกินเพดาน → ตำแหน่งติดลบ ล้นขึ้นไป 40px)
      //   เทสที่ดูแค่ "ป้ายทับกันเอง" จับเคสนี้ไม่ได้
      const box = svg.getBoundingClientRect();
      texts.forEach(t => {
        const b = t.getBoundingClientRect();
        if (b.top < box.top - 0.5) bad.push(`svg#${si}: “${t.textContent}” ล้นเหนือกรอบกราฟ ${(box.top - b.top).toFixed(1)}px`);
      });
      for (let a = 0; a < texts.length; a++) {
        for (let b = a + 1; b < texts.length; b++) {
          const r1 = texts[a].getBoundingClientRect(), r2 = texts[b].getBoundingClientRect();
          const ox = Math.min(r1.right, r2.right) - Math.max(r1.left, r2.left);
          const oy = Math.min(r1.bottom, r2.bottom) - Math.max(r1.top, r2.top);
          // เผื่อ 1px กันเคสขอบชนกันพอดีจากการปัดเศษ
          if (ox > 1 && oy > 1) {
            bad.push(`svg#${si}: “${texts[a].textContent}” ทับ “${texts[b].textContent}”`);
          }
        }
      }
    });
    return [...new Set(bad)];
  });
}

const หน้าตัวแทน = ["/dashboard", "/leads", "/quotations", "/customers"];
const หน้าสำนักงานใหญ่ = ["/hq/dashboard", "/hq/leads", "/hq/pipeline", "/hq/quotations", "/hq/customers", "/hq/dealers"];

for (const path of หน้าตัวแทน) {
  test(`[ui·dealer] ป้ายในกราฟหน้า ${path} ต้องไม่ทับกัน`, async ({ page }) => {
    await openAs(page, RYG, "dealer", path);
    await settle(page);
    await page.waitForTimeout(1500);   // รอกราฟวาดจบ (มี transition ตอนแท่ง/เส้นขึ้น)
    expect(await overlaps(page), `พบป้ายทับกันในกราฟหน้า ${path}`).toEqual([]);
  });
}

for (const path of หน้าสำนักงานใหญ่) {
  test(`[ui·hq] ป้ายในกราฟหน้า ${path} ต้องไม่ทับกัน`, async ({ page }) => {
    await openAs(page, ADMIN, "hq", path);
    await settle(page);
    await page.waitForTimeout(1500);
    expect(await overlaps(page), `พบป้ายทับกันในกราฟหน้า ${path}`).toEqual([]);
  });
}
