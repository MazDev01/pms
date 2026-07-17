import { test, expect } from "@playwright/test";
import { open } from "./helpers";

const HQ = ["/hq/dashboard", "/hq/pipeline", "/hq/leads", "/hq/quotations", "/hq/customers",
            "/hq/dealers", "/hq/users", "/hq/master", "/hq/company", "/hq/settings", "/hq/audit"];
const DEALER = ["/dashboard", "/leads", "/customers", "/quotations", "/calendar", "/files", "/products", "/settings", "/profile"];

// ตรวจ 3 อาการที่จอแคบมักพัง — วัดจาก DOM จริง ไม่เดา
async function audit(page: any) {
  return page.evaluate(() => {
    const squeezed: string[] = [];
    // ข้อความที่โดนบีบเป็นคอลัมน์ผอม: แคบ < 130px แต่สูง > 60px
    document.querySelectorAll<HTMLElement>(".card-title, .page-head p, .page-sub, .card-desc, h1, h2, h3, label").forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.width < 130 && r.height > 60) {
        squeezed.push(`"${(el.textContent ?? "").trim().slice(0, 20)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
    });
    const tb = document.querySelector(".erp-topbar") as HTMLElement | null;
    // ปุ่ม/ลิงก์ที่เล็กเกินนิ้วกด (< 32px)
    const tiny: string[] = [];
    document.querySelectorAll<HTMLElement>("button, a[href]").forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.height < 28 && (el.textContent ?? "").trim().length > 0) {
        tiny.push(`"${(el.textContent ?? "").trim().slice(0, 14)}" h=${Math.round(r.height)}`);
      }
    });
    return {
      squeezed,
      tinyCount: tiny.length,
      tiny: tiny.slice(0, 3),
      topbarOver: tb ? Math.round(tb.scrollWidth - tb.clientWidth) : 0,
      docOver: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
}

for (const [name, w, h] of [["iPhone SE", 375, 667], ["iPad Mini", 768, 1024]] as const) {
  test(`[${name}] ตรวจครบ 20 หน้า`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    const bad: string[] = [];
    for (const p of [...HQ, ...DEALER]) {
      await open(page, p.startsWith("/hq") ? "hq" : "dealer", p);
      await page.waitForTimeout(400);
      const m = await audit(page);
      const issues: string[] = [];
      if (m.squeezed.length) issues.push(`บีบ:${m.squeezed.join(", ")}`);
      if (m.topbarOver > 1) issues.push(`topbarล้น:${m.topbarOver}`);
      if (m.docOver > 3) issues.push(`docล้น:${m.docOver}`);
      if (issues.length) { bad.push(`${p} → ${issues.join(" | ")}`); console.log(`✗ ${p}\n    ${issues.join("\n    ")}`); }
      else console.log(`✓ ${p}`);
    }
    console.log(`\n[${name}] สรุป: ${bad.length ? bad.length + " หน้ามีปัญหา" : "ผ่านครบ 20 หน้า"}`);
    expect(bad, `${name} ต้องไม่มีหน้าที่เลย์เอาต์พัง`).toEqual([]);
  });
}
