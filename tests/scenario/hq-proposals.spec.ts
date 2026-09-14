import { test, expect } from "@playwright/test";
import { ADMIN, skipReason } from "./supabaseEnv";
import { HQ_ORIGIN, loginUI, watchErrors, assertNoErrors, db, waitRow, specNS } from "./funcHelpers";

// ── หน้ารวม "ใบเสนอแพ็กเกจตัวแทน" ของสำนักงานใหญ่ (บอสสั่ง 14 ก.ย. 69: "ทำหน้า ใบเสนอแพ็กเกจ ด้วย") ──
//
// สิ่งที่ต้องพิสูจน์:
//   1) เห็นใบของทุกรายในตารางเดียว · ค้นหา/กรองสถานะได้ · กดแถวเปิดแผงใบของรายนั้น
//   2) ลิงก์ "ไปที่ลูกค้าเป้าหมาย" เปิดหน้าต่างของรายนั้นให้จริง (?open=)
//   3) ออกใบใหม่จากหน้านี้: เลือกราย → ฟอร์มขึ้นทันที → บันทึกได้ใบร่างจริงในฐานข้อมูล
test.skip(() => skipReason() !== "", skipReason() || "พร้อมรัน");
test.setTimeout(180_000);
test.describe.configure({ mode: "serial" });

const NS = specNS("PROPOSALPAGE");

async function cleanup() {
  // ลบลูกค้าเป้าหมาย → ใบของรายนั้นลบตามให้เอง (on delete cascade · ใบที่ส่งแล้วก็ลบตามได้)
  const { error } = await (await db(ADMIN)).from("dealer_prospects").delete().like("name", `${NS}%`);
  if (error) console.warn("[hq-proposals] ล้างข้อมูลทดสอบไม่สำเร็จ", error.message);
}
test.beforeAll(cleanup);
test.afterAll(cleanup);

test("[func·hq] หน้าใบเสนอแพ็กเกจ: เห็นใบในตาราง · ค้นหา/กรอง · กดแถวเปิดแผง · ลิงก์ไปลูกค้าเป้าหมาย", async ({ page }) => {
  const errs = watchErrors(page);
  const sb = await db(ADMIN);
  const name = `${NS}-มีใบส่งแล้ว`;
  const { data: pr, error } = await sb.from("dealer_prospects").insert({ name, province: "ขอนแก่น", status: "considering" }).select("id").single();
  expect(error).toBeNull();
  const prospectId = (pr as { id: number }).id;
  const { data: ใบ, error: ใบErr } = await sb.from("dealer_package_proposals")
    .insert({ prospect_id: prospectId, package: "exclusive", status: "draft", proposed_date: "2026-09-14", amount: 250_000, contract_months: 24, annual_target: 3_000_000 })
    .select("id, proposal_no").single();
  expect(ใบErr).toBeNull();
  const { id: ใบId, proposal_no: เลขที่ } = ใบ as { id: number; proposal_no: string };
  expect((await sb.from("dealer_package_proposals").update({ status: "sent" }).eq("id", ใบId)).error).toBeNull();

  await loginUI(page, HQ_ORIGIN, "/hq/proposals", ADMIN);
  await expect(page.getByRole("link", { name: "ใบเสนอแพ็กเกจตัวแทน" }), "ต้องมีเมนูข้าง").toBeVisible({ timeout: 25_000 });

  // ค้นก่อนเสมอ — ตารางแบ่งหน้าละ 10 ใบ ข้อมูลของเทสต์อื่นอาจดันใบนี้ไปหน้าถัดไป
  await page.getByLabel("ค้นหาใบเสนอแพ็กเกจ").fill(name);
  const แถว = page.getByRole("row", { name: new RegExp(เลขที่) });
  await expect(แถว).toBeVisible({ timeout: 25_000 });
  await expect(แถว).toContainText(name);
  await expect(แถว).toContainText("Exclusive");
  await expect(แถว).toContainText("250,000");
  await expect(แถว).toContainText("24 เดือน");
  await expect(แถว).toContainText("3,000,000");
  await expect(แถว).toContainText("ส่งแล้ว");

  // กรองสถานะที่ไม่ตรง → ใบนี้ต้องหาย · กลับมาทุกสถานะ → ต้องกลับมา
  await page.getByLabel("กรองตามสถานะใบ").selectOption("accepted");
  await expect(แถว, "กรอง “ตอบรับ” ต้องไม่เห็นใบที่ส่งแล้ว").toHaveCount(0);
  await page.getByLabel("กรองตามสถานะใบ").selectOption("sent");
  await expect(แถว).toBeVisible();

  // กดแถว → แผงใบของรายนั้น (ตัวเดียวกับหน้าลูกค้าเป้าหมาย) · เปลี่ยนสถานะได้จากตรงนี้
  await แถว.click();
  const แผง = page.getByRole("dialog", { name: "ใบเสนอแพ็กเกจของลูกค้าเป้าหมาย" });
  await expect(แผง.getByText(เลขที่)).toBeVisible();
  await expect(แผง.getByLabel(`สถานะใบ ${เลขที่}`), "ใบที่ส่งแล้วเปลี่ยนเป็นตอบรับ/ปฏิเสธได้").toBeVisible();

  // ลิงก์ไปลูกค้าเป้าหมาย → หน้าต่างรายนั้นต้องเปิดเอง
  await แผง.getByRole("link", { name: "ไปที่ลูกค้าเป้าหมาย" }).click();
  await expect(page).toHaveURL(/\/hq\/prospects/, { timeout: 25_000 });
  const รายละเอียด = page.getByRole("dialog", { name: "ข้อมูลลูกค้าเป้าหมาย" });
  await expect(รายละเอียด.locator("#pr-name"), "ต้องเปิดหน้าต่างของรายที่กดมา").toHaveValue(name, { timeout: 25_000 });
  await expect(page, "ล้างพารามิเตอร์แล้ว รีเฟรชไม่เปิดซ้ำ").not.toHaveURL(/open=/);
  assertNoErrors(errs, "หน้าใบเสนอแพ็กเกจตัวแทน");
});

test("[func·hq] ออกใบเสนอแพ็กเกจจากหน้ารวม: เลือกราย → ฟอร์มขึ้นทันที → ได้ใบร่าง", async ({ page }) => {
  const errs = watchErrors(page);
  const sb = await db(ADMIN);
  const name = `${NS}-ออกใบจากหน้ารวม`;
  const { data: pr, error } = await sb.from("dealer_prospects").insert({ name, province: "ลำปาง", status: "meeting" }).select("id").single();
  expect(error).toBeNull();
  const prospectId = (pr as { id: number }).id;

  await loginUI(page, HQ_ORIGIN, "/hq/proposals", ADMIN);
  await page.getByRole("button", { name: "ออกใบเสนอแพ็กเกจ" }).first().click({ timeout: 25_000 });
  const เลือก = page.getByRole("dialog", { name: "เลือกลูกค้าเป้าหมาย" });
  await expect(เลือก.getByRole("button", { name: "ต่อไป" }), "ยังไม่เลือกราย ต้องกดต่อไม่ได้").toBeDisabled();
  await เลือก.locator("#pick-prospect").selectOption(String(prospectId));
  await เลือก.getByRole("button", { name: "ต่อไป" }).click();

  const ฟอร์ม = page.getByRole("dialog", { name: "ใบเสนอแพ็กเกจตัวแทน", exact: true });
  await expect(ฟอร์ม, "ฟอร์มออกใบต้องขึ้นเองทันที ไม่ต้องกดซ้ำ").toBeVisible({ timeout: 25_000 });
  await expect(ฟอร์ม.locator("#pp-province"), "จังหวัดเติมจากลูกค้าเป้าหมายให้").toHaveValue("ลำปาง");
  await ฟอร์ม.locator("#pp-package").selectOption("standard");
  await ฟอร์ม.locator("#pp-amount").fill("90000");
  await ฟอร์ม.getByRole("button", { name: "บันทึกใบ" }).click();

  const แถวใบ = await waitRow<{ proposal_no: string; status: string; amount: number }>(sb, "dealer_package_proposals", { prospect_id: prospectId });
  expect(แถวใบ.status).toBe("draft");
  expect(Number(แถวใบ.amount)).toBe(90_000);

  // ปิดแผง → ตารางหน้ารวมต้องดึงใหม่ เห็นใบที่เพิ่งออก
  const แผง = page.getByRole("dialog", { name: "ใบเสนอแพ็กเกจของลูกค้าเป้าหมาย" });
  await expect(แผง.getByText(แถวใบ.proposal_no)).toBeVisible();
  await แผง.getByRole("button", { name: "ปิด" }).click();
  await page.getByLabel("ค้นหาใบเสนอแพ็กเกจ").fill(name);
  const แถว = page.getByRole("row", { name: new RegExp(แถวใบ.proposal_no) });
  await expect(แถว).toBeVisible({ timeout: 25_000 });
  await expect(แถว).toContainText("ร่าง");
  assertNoErrors(errs, "ออกใบเสนอแพ็กเกจจากหน้ารวม");
});
