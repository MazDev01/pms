import { test, expect } from "@playwright/test";
import { open } from "./helpers";
import { leads as allLeads } from "../../packages/shared/lib/mock";

// ── ขอบเขตข้อมูลข้ามสาขา (regression) — บั๊กประเภท "กระดิ่ง/หน้า HQ รั่วข้ามสาขา" ──
// SalesContext.leads ถือลีดทั้งเครือ (mock.leads รวม seed สาขาอื่น) — ทุก surface ของตัวแทน
// และหน้าเจาะสาขา CNX ฝั่ง HQ ต้องกรอง dealerCode ก่อนแสดง ไม่งั้นลีดของ RYG/MST รั่วเข้ามา
// เคยหลุดมาแล้ว 2 จุด: Topbar (กระดิ่ง+ค้นหา) และ useNetworkDealerDetail (หน้าเจาะสาขา)
// ── repro: กระดิ่ง/หน้า ของตัวแทน (CNX) ต้องไม่โผล่ข้อมูลของสาขาอื่น ──
// รายชื่อบริษัทของ "สาขาอื่น" (dealerCode != CNX) — ถ้าโผล่ในกระดิ่ง/ค้นหา = รั่วข้ามสาขา
// ต้องหักชื่อที่เป็นของ CNX ด้วยออก: mock มีบริษัทชื่อซ้ำข้ามสาขา (เช่น "บจ. เชียงรายฟู้ดส์" มีทั้ง CNX numId15 และ CRI)
// ถ้าไม่หัก จะเป็นผลบวกลวง — CNX โชว์ลีดของตัวเองถูกต้องแต่ชื่อไปตรงกับสาขาอื่น
const dc = (l: { dealerCode?: string }) => l.dealerCode ?? "CNX";
const CNX_NAMES = new Set(allLeads.filter(l => dc(l) === "CNX").map(l => l.company));
const OTHER_BRANCH = [...new Set(
  allLeads.filter(l => dc(l) !== "CNX").map(l => l.company)
)].filter(name => !CNX_NAMES.has(name));

async function openBell(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "การแจ้งเตือน" }).click();
  await page.waitForTimeout(500);
}

test("กระดิ่งตัวแทน (CNX) ไม่โผล่ลีดสาขาอื่น", async ({ page }) => {
  await open(page, "dealer", "/dashboard");
  await page.waitForTimeout(1500);
  await openBell(page);

  const panelText = await page.evaluate(() => {
    // แผงกระดิ่ง = div ลอยที่มีหัวข้อ "การแจ้งเตือน"
    const heads = [...document.querySelectorAll("span")].filter(s => s.textContent?.trim() === "การแจ้งเตือน");
    const panel = heads[0]?.closest("div[style*='position']")?.parentElement ?? document.body;
    return (panel as HTMLElement).innerText;
  });

  const leaked = OTHER_BRANCH.filter(name => panelText.includes(name));
  console.log(`บริษัทสาขาอื่นทั้งหมด ${OTHER_BRANCH.length} ราย · โผล่ในกระดิ่ง: ${leaked.length}`);
  if (leaked.length) console.log("  รั่ว:", JSON.stringify(leaked.slice(0, 6)));
  expect(leaked, "กระดิ่งตัวแทนต้องไม่มีบริษัทของสาขาอื่น").toEqual([]);
});

test("หน้า HQ เจาะสาขา CNX ไม่โผล่ลีดของสาขาอื่น", async ({ page }) => {
  await open(page, "hq", "/hq/dealers/CNX");
  await page.waitForTimeout(1500);
  // แท็บ "ลูกค้าเป้าหมาย" — ตารางลีดของสาขานี้
  await page.getByRole("button", { name: /ลูกค้าเป้าหมาย/ }).first().click().catch(() => {});
  await page.waitForTimeout(500);
  const bodyText = await page.evaluate(() => document.body.innerText);
  const leaked = OTHER_BRANCH.filter(name => bodyText.includes(name));
  console.log(`หน้าเจาะ CNX → โผล่บริษัทสาขาอื่น: ${leaked.length}`, JSON.stringify(leaked.slice(0, 6)));
  expect(leaked, "หน้าเจาะสาขา CNX ต้องมีเฉพาะลีดของ CNX").toEqual([]);
  // จำนวนแถวในตารางลีด ต้อง = จำนวนลีด CNX จริง (16) ไม่ใช่ทั้งเครือ (61)
  const cnxCount = allLeads.filter(l => dc(l) === "CNX").length;
  const rows = await page.locator("table tbody tr").count();
  console.log(`แถวตารางลีด = ${rows} · ลีด CNX จริง = ${cnxCount}`);
  expect(rows, "จำนวนแถว = ลีด CNX เท่านั้น").toBe(cnxCount);
});

test("ค้นหาบน Topbar (CNX) ไม่โผล่ลูกค้า/ใบเสนอราคาสาขาอื่น", async ({ page }) => {
  await open(page, "dealer", "/dashboard");
  await page.waitForTimeout(1500);
  // เปิดช่องค้นหา แล้วพิมพ์ token ที่มีเฉพาะในสาขาอื่น
  await page.getByRole("button", { name: "ค้นหา" }).click();
  await page.waitForTimeout(300);
  await page.getByRole("textbox").first().fill("ระยอง"); // สาขา RYG — CNX ไม่มีบริษัทชื่อนี้
  await page.waitForTimeout(500);
  const resultText = await page.evaluate(() => document.body.innerText);
  const leaked = OTHER_BRANCH.filter(name => name.includes("ระยอง") && resultText.includes(name));
  console.log(`ค้นหา "ระยอง" → โผล่บริษัทสาขาอื่น: ${leaked.length}`, JSON.stringify(leaked.slice(0, 4)));
  expect(leaked, "ค้นหาของตัวแทนต้องไม่เจอบริษัทสาขาอื่น").toEqual([]);
});
