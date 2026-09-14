import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { ADMIN, RYG, skipReason } from "./supabaseEnv";
import { ADMIN_SUPABASE_URL, ADMIN_SERVICE_ROLE_KEY } from "./adminEnv";
import { HQ_ORIGIN, loginUI, watchErrors, assertNoErrors, db, waitRow, specNS } from "./funcHelpers";

// ── ลูกค้าเป้าหมายของสำนักงานใหญ่ = ผู้สนใจเป็นตัวแทนจำหน่าย (บอสสั่ง 14 ก.ย. 69) ─────────
//   "เพิ่มโมดูลลูกค้าเป้าหมายของทางฝั่ง HQ และเมื่อสำเร็จจากลูกค้าเป้าหมายจะกลายเป็นตัวแทนจำหน่าย"
//
// สิ่งที่ต้องพิสูจน์:
//   1) ตัวแทนจำหน่ายมองไม่เห็นรายชื่อนี้เลย (ข้อมูลอ่อนไหว — ผู้สนใจรายอื่นในพื้นที่เดียวกัน)
//   2) เซิร์ฟเวอร์ไม่ยอมให้นับ "เป็นตัวแทนแล้ว" ถ้าไม่ได้ผูกสาขาจริง
//   3) เส้นทางผ่านหน้าจอครบ: เพิ่ม → เปลี่ยนขั้น → ผูกกับตัวแทนที่มีอยู่
//   4) สร้างตัวแทนใหม่จากรายนี้ได้บัญชีจริง และกดซ้ำไม่ได้สาขาซ้อน
test.skip(() => skipReason() !== "", skipReason() || "พร้อมรัน");
test.setTimeout(240_000);
test.describe.configure({ mode: "serial" });

const NS = specNS("PROSPECT");
const NEW_CODE = "ZZP";      // สร้างผ่านหน้าจอ
const DUP_CODE = "ZZQ";      // รหัสที่ใช้ลองสร้างซ้อน — ต้องไม่ถูกสร้างจริง

async function adminToken(): Promise<string> {
  const sb = await db(ADMIN);
  return (await sb.auth.getSession()).data.session?.access_token ?? "";
}

// ลบสาขาทดสอบ "พร้อมบัญชีเข้าระบบ" — แบบเดียวกับ func-hq.spec.ts (ไม่ทิ้งบัญชีกำพร้าให้รอบถัดไปสร้างไม่ได้)
async function purgeDealer(code: string) {
  const token = await adminToken();
  await fetch(`${HQ_ORIGIN}/api/admin/dealers?code=${code}`, {
    method: "DELETE", headers: { authorization: `Bearer ${token}` },
  }).catch(() => { /* best-effort cleanup */ });
  if (!ADMIN_SERVICE_ROLE_KEY || !/^ZZ[A-Z]{0,3}$/.test(code)) return; // กันพลาด: เฉพาะรหัสทดสอบเท่านั้น
  const admin = createClient(ADMIN_SUPABASE_URL, ADMIN_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const orphan = (data?.users ?? []).filter(u => (u.email ?? "").toLowerCase().startsWith(`${code.toLowerCase()}@`));
  for (const u of orphan) await admin.auth.admin.deleteUser(u.id);
}

async function cleanupProspects() {
  const sb = await db(ADMIN);
  const { error } = await sb.from("dealer_prospects").delete().like("name", `${NS}%`);
  if (error) console.warn("[hq-prospects] ล้างข้อมูลทดสอบไม่สำเร็จ", error.message);
}

test.beforeAll(async () => {
  await cleanupProspects();
  await purgeDealer(NEW_CODE);
  await purgeDealer(DUP_CODE);
});
test.afterAll(async () => {
  await cleanupProspects();
  await purgeDealer(NEW_CODE);
  await purgeDealer(DUP_CODE);
});

test("[security] ตัวแทนจำหน่ายมองไม่เห็น และเขียนลูกค้าเป้าหมายของสำนักงานใหญ่ไม่ได้", async () => {
  const hq = await db(ADMIN);
  const { error: hqErr } = await hq.from("dealer_prospects").insert({ name: `${NS}-ลับ`, phone: "0800000000" });
  expect(hqErr, "ผู้ดูแลสำนักงานใหญ่ต้องเพิ่มได้").toBeNull();

  const dealer = await db(RYG);
  const { data, error } = await dealer.from("dealer_prospects").select("id").like("name", `${NS}%`);
  expect(error).toBeNull();
  expect(data ?? [], "ตัวแทนต้องไม่เห็นสักแถว (RLS กรองทิ้ง ไม่ใช่แค่ซ่อนเมนู)").toHaveLength(0);

  const { error: dealerErr } = await dealer.from("dealer_prospects").insert({ name: `${NS}-ปลอม` });
  expect(dealerErr, "ตัวแทนต้องเพิ่มไม่ได้").not.toBeNull();
});

test("[api] ตั้งสถานะ “เป็นตัวแทนแล้ว” โดยไม่ผูกรหัสตัวแทน ต้องถูกปฏิเสธที่เซิร์ฟเวอร์", async () => {
  const token = await adminToken();
  const res = await fetch(`${HQ_ORIGIN}/api/v1/prospects`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ name: `${NS}-สำเร็จปลอม`, status: "won" }),
  });
  expect(res.status).toBe(400);
  expect(((await res.json()) as { error?: string }).error ?? "").toMatch(/ผูกกับตัวแทน/);
});

test("[func·hq] เพิ่มลูกค้าเป้าหมาย → เปลี่ยนขั้น → ผูกกับตัวแทนที่มีอยู่แล้ว", async ({ page }) => {
  const errs = watchErrors(page);
  const name = `${NS}-ผูกสาขาเดิม`;
  const sb = await db(ADMIN);

  await loginUI(page, HQ_ORIGIN, "/hq/prospects", ADMIN);
  await page.getByRole("button", { name: "เพิ่มลูกค้าเป้าหมาย" }).first().click();
  const แก้ไข = page.getByRole("dialog", { name: "ข้อมูลลูกค้าเป้าหมาย" });
  await แก้ไข.locator("#pr-name").fill(name);
  await แก้ไข.locator("#pr-phone").fill("089 980 4558");
  await แก้ไข.getByRole("button", { name: "เพิ่มลูกค้าเป้าหมาย" }).click();
  const row = await waitRow<{ status: string }>(sb, "dealer_prospects", { name });
  expect(row.status).toBe("new");

  const แถว = page.getByRole("row", { name: new RegExp(name) });
  await expect(แถว).toBeVisible();
  await แถว.click();
  await แก้ไข.locator("#pr-status").selectOption("profile_sent");
  await แก้ไข.getByRole("button", { name: "บันทึก", exact: true }).click();
  await waitRow(sb, "dealer_prospects", { name, status: "profile_sent" });

  await แถว.click();
  await แก้ไข.getByRole("button", { name: "ตั้งเป็นตัวแทนจำหน่าย" }).click();
  const ตั้ง = page.getByRole("dialog", { name: "ตั้งเป็นตัวแทนจำหน่าย" });
  await ตั้ง.getByLabel("ผูกกับตัวแทนจำหน่ายที่มีอยู่แล้ว").check();
  await ตั้ง.locator("#cv-existing").selectOption("RYG");
  await ตั้ง.getByRole("button", { name: "ผูกกับตัวแทนนี้" }).click();

  await waitRow(sb, "dealer_prospects", { name, status: "won", dealer_code: "RYG" });
  await expect(แถว).toContainText("เป็นตัวแทนแล้ว");
  await expect(แถว).toContainText("RYG");
  assertNoErrors(errs, "หน้าลูกค้าเป้าหมาย (HQ)");
});

test("[func·hq] ตั้งเป็นตัวแทนจำหน่ายใหม่ → ได้สาขาพร้อมบัญชี · กดซ้ำไม่ได้สาขาซ้อน", async ({ page }) => {
  const errs = watchErrors(page);
  const name = `${NS}-สาขาใหม่`;
  const sb = await db(ADMIN);
  const { data: ins, error } = await sb.from("dealer_prospects")
    .insert({ name, province: "ระยอง", status: "meeting" }).select("id").single();
  expect(error).toBeNull();
  const id = (ins as { id: number }).id;

  await loginUI(page, HQ_ORIGIN, "/hq/prospects", ADMIN);
  await page.getByRole("row", { name: new RegExp(name) }).click();
  await page.getByRole("dialog", { name: "ข้อมูลลูกค้าเป้าหมาย" }).getByRole("button", { name: "ตั้งเป็นตัวแทนจำหน่าย" }).click();
  const ตั้ง = page.getByRole("dialog", { name: "ตั้งเป็นตัวแทนจำหน่าย" });
  // ภาค/จังหวัดเติมจากที่บันทึกไว้ให้แล้ว — ไม่ต้องเลือกซ้ำ
  await expect(ตั้ง.locator("#cv-province")).toHaveValue("ระยอง");
  await expect(ตั้ง.locator("#cv-region")).not.toHaveValue("");
  await ตั้ง.locator("#cv-code").fill(NEW_CODE);
  await ตั้ง.getByRole("button", { name: "สร้างตัวแทนจำหน่าย" }).click();

  await expect(page.getByText("สร้างตัวแทนจำหน่ายสำเร็จ")).toBeVisible({ timeout: 30_000 });
  await waitRow(sb, "dealers", { code: NEW_CODE });
  await waitRow(sb, "dealer_prospects", { id, status: "won", dealer_code: NEW_CODE });

  // ยิงซ้ำด้วยรายเดิม (เช่น กดสองครั้ง / สองคนกดพร้อมกัน) ต้องถูกปฏิเสธก่อนสร้างบัญชี
  const token = await adminToken();
  const again = await fetch(`${HQ_ORIGIN}/api/admin/dealers`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ code: DUP_CODE, name, province: "ระยอง", region: "ตะวันออก", revenueTarget: 0, prospectId: id }),
  });
  expect(again.status).toBe(409);
  const { data: ซ้อน } = await sb.from("dealers").select("code").eq("code", DUP_CODE);
  expect(ซ้อน ?? [], "ต้องไม่มีสาขาซ้อนถูกสร้าง").toHaveLength(0);
  assertNoErrors(errs, "ตั้งเป็นตัวแทนจำหน่ายใหม่");
});

test("[api] สร้างตัวแทนโดยไม่ผูกลูกค้าเป้าหมาย ต้องถูกปฏิเสธ และไม่มีสาขาเกิดขึ้น (บอสสั่ง 14 ก.ย. 69)", async () => {
  const token = await adminToken();
  const res = await fetch(`${HQ_ORIGIN}/api/admin/dealers`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ code: DUP_CODE, name: `${NS}-สร้างตรง`, province: "ระยอง", region: "ตะวันออก", revenueTarget: 0 }),
  });
  expect(res.status, "ต้องปฏิเสธ — ตัวแทนต้องมาจากลูกค้าเป้าหมายที่สำเร็จแล้วเท่านั้น").toBe(400);
  expect(((await res.json()) as { error?: string }).error ?? "").toMatch(/ลูกค้าเป้าหมาย/);
  const { data } = await (await db(ADMIN)).from("dealers").select("code").eq("code", DUP_CODE);
  expect(data ?? [], "คำขอที่ถูกปฏิเสธต้องไม่สร้างสาขา").toHaveLength(0);
});

test("[ui·hq] ฟอร์มลูกค้าเป้าหมาย: เลือกภาคก่อนแล้วค่อยเลือกจังหวัด · มีทุกภาค (บอสสั่ง 14 ก.ย. 69)", async ({ page }) => {
  const errs = watchErrors(page);
  await loginUI(page, HQ_ORIGIN, "/hq/prospects", ADMIN);
  await page.getByRole("button", { name: "เพิ่มลูกค้าเป้าหมาย" }).first().click();
  const ฟอร์ม = page.getByRole("dialog", { name: "ข้อมูลลูกค้าเป้าหมาย" });
  const ภาค = ฟอร์ม.locator("#pr-region");
  const จังหวัด = ฟอร์ม.locator("#pr-province");

  await expect(ภาค, "ภาคต้องเริ่มที่ยังไม่ระบุ").toHaveValue("");
  expect((await จังหวัด.locator("option").allInnerTexts()).join(" "), "ยังไม่เลือกภาค → ให้เลือกภาคก่อน").toContain("เลือกภาคก่อน");
  expect((await ภาค.locator("option").allInnerTexts()).join(" "), "ต้องมีตัวเลือกทุกภาค").toContain("ทุกภาค");

  await ภาค.selectOption("ทุกภาค");
  await expect(จังหวัด, "ทุกภาค → จังหวัดเป็นทุกจังหวัดให้เอง").toHaveValue("ทุกจังหวัด");

  await ภาค.selectOption("อีสาน");
  const ตัวเลือก = await จังหวัด.locator("option").allInnerTexts();
  expect(ตัวเลือก, "เลือกอีสาน → ต้องมีจังหวัดในภาคอีสาน").toContain("บุรีรัมย์");
  expect(ตัวเลือก, "เลือกอีสาน → ต้องไม่มีจังหวัดภาคอื่นปน").not.toContain("ระยอง");

  const name = `${NS}-มีภาค`;
  await ฟอร์ม.locator("#pr-name").fill(name);
  await จังหวัด.selectOption("บุรีรัมย์");
  await ฟอร์ม.getByRole("button", { name: "เพิ่มลูกค้าเป้าหมาย" }).click();
  await waitRow(await db(ADMIN), "dealer_prospects", { name, region: "อีสาน", province: "บุรีรัมย์" });
  assertNoErrors(errs, "ฟอร์มลูกค้าเป้าหมาย: ภาค/จังหวัด");
});

