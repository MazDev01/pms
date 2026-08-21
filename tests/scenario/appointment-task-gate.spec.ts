// ── งาน "นัดหมาย" ต้องมีนัดจริงก่อน ถึงจะติ๊กได้ (บอสสั่ง 20 ส.ค. 69) ──────────
// กติกาเดียวกับงาน "จัดทำ/ส่งใบเสนอราคา" ที่ต้องมีเอกสารจริง
// ติ๊กเองไม่ได้ = ตัวเลขความคืบหน้าและขั้นของลูกค้าเป้าหมายสะท้อนงานที่ทำจริงเท่านั้น
import { test, expect } from "@playwright/test";
import { RYG, skipReason } from "./supabaseEnv";
import { DEALER_ORIGIN, loginUI, db, cleanup, specNS, nsTag, งานก่อนหน้าครบถึง } from "./funcHelpers";

test.skip(() => skipReason() !== "", skipReason() || "พร้อมรัน");
test.setTimeout(240_000);
test.describe.configure({ mode: "serial" });

const NS = specNS("APPTGATE");
const COMPANY = nsTag(NS)("ด่านนัดหมาย");

async function seedLead() {
  const sb = await db(RYG);
  const numId = 966000 + (Date.now() % 900);
  const done = (key: string, label: string) => ({ key, label, done: true });
  await sb.from("leads").insert({
    id: `#L-${numId}`, num_id: numId, dealer_code: "RYG", company: COMPANY, name: COMPANY,
    contact: "ผู้ทดสอบ", province: "ระยอง", product: "โกดังสำเร็จรูป", status: "WAITING",
    value: "฿600,000", assigned: "ผู้ทดสอบ",
    // ติ๊กงานก่อนหน้าให้ครบ เพื่อให้ "นัดหมาย" เป็นงานถัดไปที่ติ๊กได้
    // ⚠️ ต้องอิง "เส้นทางจริง" ไม่ใช่รายการที่พิมพ์ตายตัว — ลำดับ/รหัสงานเปลี่ยนได้เมื่อสำนักงานใหญ่แก้
    //    (เจอจริง 21 ส.ค. 69: นัดหมายถูกย้ายไปหลัง "สรุปความต้องการ" seed เดิมจึงทำให้งานถูกล็อก)
    tasks: await งานก่อนหน้าครบถึง(sb, "นัด"),
  });
}

test.beforeAll(async () => { await cleanup(await db(RYG), "RYG", NS); await seedLead(); });
test.afterAll(async () => { await cleanup(await db(RYG), "RYG", NS); });

test("[func] ติ๊กงาน 'นัดหมาย' เองทั้งที่ยังไม่มีนัด → ไม่ติ๊กให้ และพาไปลงนัด", async ({ page }) => {
  const sb = await db(RYG);
  await loginUI(page, DEALER_ORIGIN, "/login", RYG);
  await page.goto(`${DEALER_ORIGIN}/leads`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "ตาราง" }).click();
  await page.getByPlaceholder("ค้นหาบริษัท ผู้ติดต่อ...").fill(COMPANY);
  const row = page.locator("tbody tr").filter({ hasText: COMPANY }).first();
  await expect(row).toBeVisible({ timeout: 20_000 });
  await row.getByRole("button", { name: "ดูรายละเอียด" }).first().click();

  await page.getByRole("button", { name: "งาน", exact: true }).first().click();
  // ⚠️ คำว่า "นัดหมาย" มีทั้งชื่อแท็บและหัวข้อในแผง — ต้องเจาะที่ "ปุ่มงาน" ในรายการงานเท่านั้น
  await page.getByRole("button", { name: "นัดหมาย", exact: true }).last().click();

  // ต้องพาไปหน้าลงนัด และต้องไม่ติ๊กงานให้
  await expect(page.getByText(/ลงนัดหมายจริงก่อน/), "ต้องบอกว่าติ๊กเองไม่ได้").toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(2500);
  const lead = (await sb.from("leads").select("tasks").eq("dealer_code", "RYG").eq("company", COMPANY).single())
    .data as { tasks?: { key: string; label?: string; done: boolean }[] };
  // ⚠️ หาด้วย "ชื่องาน" ไม่ใช่รหัส — รหัสเปลี่ยนได้เมื่อสำนักงานใหญ่แก้ชื่องาน (task_bullet_1)
  const งานนัด = (lead.tasks ?? []).find(t => String((t as { label?: string }).label ?? "").includes("นัด"));
  expect(งานนัด?.done, "ยังไม่มีนัดจริง → งานต้องไม่ถูกติ๊ก").toBe(false);
});
