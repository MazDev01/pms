import { statuses, ADMIN_SUPABASE_URL, ADMIN_SERVICE_ROLE_KEY } from "./adminEnv";
import { createClient } from "@supabase/supabase-js";
import { test, expect } from "@playwright/test";
import { ADMIN, RYG, skipReason } from "./supabaseEnv";
import {
  HQ_ORIGIN, DEALER_ORIGIN, loginUI, watchErrors, assertNoErrors,
  db, waitRow, waitGone, TAG, fillDealerForm,
} from "./funcHelpers";

// ฝั่งสำนักงานใหญ่ — ข้อมูลกลางที่ทั้งเครือใช้ร่วมกัน
// รวมถึงบทพิสูจน์สำคัญที่สุดของโมเดล: HQ แก้ที่ :3002 แล้วตัวแทนที่ :3001 เห็นตาม
test.skip(() => skipReason() !== "", skipReason() || "พร้อมรัน");
test.setTimeout(240_000);
test.describe.configure({ mode: "serial" });

const CODE = "ZZT";                      // fixture สำหรับเทสต์ "ตัวกรอง/ลบ" — ใส่ตรง ๆ ใน beforeAll
const DEALER_NAME = `${TAG}-สาขาทดสอบ`;
const NEW_CODE = "ZZC";                  // สร้างผ่าน UI (แยกรหัสกับ fixture กันชน)
const NEW_NAME = `${TAG}-สาขาสร้างใหม่`;

// ลบตัวแทน "พร้อมบัญชี auth" ผ่าน route (service_role) — test harness ไม่ถือ service_role เอง
// จึงลบ auth user ที่ NEW_CODE สร้างไว้ผ่าน DELETE /api/admin/dealers ได้ · ทำให้เทสต์ H5 รันซ้ำได้ไม่ทิ้ง orphan
async function purgeDealerAccount(code: string) {
  const sb = await db(ADMIN);
  const token = (await sb.auth.getSession()).data.session?.access_token ?? "";
  await fetch(`${HQ_ORIGIN}/api/admin/dealers?code=${code}`, {
    method: "DELETE", headers: { authorization: `Bearer ${token}` },
  }).catch(() => { /* best-effort cleanup */ });

  // เก็บ "บัญชีเข้าระบบที่ค้าง" ด้วย — เส้นทางลบผ่าน route จะข้ามการลบบัญชีเมื่อไม่เจอแถวสาขาแล้ว
  // (เคยเจอจริง: รอบก่อนลบแถวสาขาสำเร็จแต่ลบบัญชีไม่ผ่าน → รอบถัดไปสร้างไม่ได้เพราะ "อีเมลถูกใช้แล้ว"
  //  แล้วเทสต์ตกโดยไม่เกี่ยวกับสิ่งที่กำลังวัดเลย)
  if (!ADMIN_SERVICE_ROLE_KEY || !/^ZZ[A-Z]{0,3}$/.test(code)) return; // กันพลาด: เฉพาะรหัสทดสอบเท่านั้น
  const admin = createClient(ADMIN_SUPABASE_URL, ADMIN_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const orphan = (data?.users ?? []).filter(u => (u.email ?? "").toLowerCase().startsWith(`${code.toLowerCase()}@`));
  for (const u of orphan) await admin.auth.admin.deleteUser(u.id);
}

test.beforeAll(async () => {
  const sb = await db(ADMIN);
  // ล้างของค้างจากรอบก่อน: NEW_CODE ลบทั้งบัญชี auth+แถว (route) · CODE เป็น fixture ใส่ตรงไม่มี auth
  await purgeDealerAccount(NEW_CODE);
  await sb.from("dealers").delete().in("code", [CODE, NEW_CODE]);
  await sb.from("master_catalog").delete().like("name", `%${TAG}%`);
  // fixture: สาขาที่ "มีอยู่แล้ว" สำหรับเทสต์ตัวกรอง/ลบ — ใส่ตรงผ่าน ADMIN
  // (การสร้างตัวแทน "พร้อมบัญชี" ต้องใช้ service_role ที่เซิร์ฟเวอร์ · เทสต์ตัวกรอง/ลบไม่ควรผูกกับเรื่องนั้น)
  await sb.from("dealers").insert({ code: CODE, name: DEALER_NAME, province: "ระยอง", region: "ตะวันออก", status: "active" });
});
test.afterAll(async () => {
  const sb = await db(ADMIN);
  // NEW_CODE: ลบบัญชี auth ที่เทสต์สร้างด้วย (กัน orphan) · แล้วเก็บกวาดแถวที่เหลือ
  await purgeDealerAccount(NEW_CODE);
  await sb.from("dealers").delete().in("code", [CODE, NEW_CODE]);
  await sb.from("master_catalog").delete().like("name", `%${TAG}%`);
});

// H5 — สร้างตัวแทน "พร้อมบัญชีเข้าระบบ" ต้องทำผ่าน route เซิร์ฟเวอร์ (service_role)
// เทสต์นี้ทน "ทั้งสองสภาพ" ได้:
//   • ตั้ง service_role แล้ว → โมดัลรหัส + ตัวแทนลง DB จริง (บัญชีล็อกอินได้)
//   • ยังไม่ตั้ง → ต้องขึ้น error จริง และ "ไม่มีตัวแทนผี" ใน DB (เดิมโชว์รหัสปลอมทั้งที่ล็อกอินไม่ได้ = บั๊ก H5)
test("[func·hq] สร้างตัวแทน = สร้างบัญชีจริง (มี key→ลง DB · ไม่มี key→error ไม่ทิ้งตัวแทนผี) (H5)", async ({ page }) => {
  const sb = await db(ADMIN);

  await loginUI(page, HQ_ORIGIN, "/hq/login", ADMIN);
  await page.goto(`${HQ_ORIGIN}/hq/dealers`, { waitUntil: "domcontentloaded" });
  await expect.poll(async () => page.evaluate(() => document.body.innerText),
    { timeout: 25_000, message: "ทะเบียนตัวแทนต้องโหลดเสร็จก่อน" }).toContain("ระยองสตีลเวิร์คส์");
  await page.getByRole("button", { name: "เพิ่มตัวแทน" }).first().click();

  await fillDealerForm(page, NEW_CODE, NEW_NAME);
  await page.getByRole("button", { name: "สร้างตัวแทน" }).click();

  // ผลอย่างใดอย่างหนึ่ง: โมดัลสำเร็จ (มี key) หรือ ข้อความ error ในฟอร์ม (ไม่มี key)
  const okModal = page.getByText("สร้างตัวแทนสำเร็จ");
  const errMsg = page.getByText(/service_role|ยังไม่ได้ตั้งค่าเซิร์ฟเวอร์/i);
  await expect(okModal.or(errMsg).first(), "ต้องเห็นผลจริงอย่างใดอย่างหนึ่ง").toBeVisible({ timeout: 25_000 });

  const rows = (await sb.from("dealers").select("code,name").eq("code", NEW_CODE)).data ?? [];
  if (await okModal.isVisible()) {
    expect(rows.length, "ตั้ง key แล้ว → ตัวแทนต้องลง DB").toBe(1);
    expect(rows[0].name).toBe(NEW_NAME);
  } else {
    expect(rows.length, "ไม่มี key → ต้องไม่เหลือตัวแทนผีใน DB (บัญชีล็อกอินไม่ได้)").toBe(0);
  }
});

// H5 — ประตูความปลอดภัยของ route (durable ทั้งสองสภาพ):
//   ไม่มี token = ห้ามผ่านเด็ดขาด · token ของตัวแทน (ไม่ใช่ HQ) ก็ห้ามสร้างตัวแทน
//   ตั้ง key แล้ว → 401/403 · ยังไม่ตั้ง → 501 · ทั้งหมดต้อง "ไม่ใช่ 200" และไม่มีสาขาเกิดขึ้น
test("[func·hq] route สร้างตัวแทนปฏิเสธคำขอที่ไม่มีสิทธิ์ (H5)", async ({ request }) => {
  const sb = await db(ADMIN);
  const payload = { code: "ZZX", name: "ทดสอบสิทธิ์", province: "กรุงเทพฯ", region: "กลาง", revenueTarget: 0 };
  try {
    // 1) ไม่มี token
    const noAuth = await request.post(`${HQ_ORIGIN}/api/admin/dealers`, { data: payload });
    expect(noAuth.status(), "ไม่มี token ต้องไม่ผ่าน").not.toBe(200);
    expect(statuses(401), `สถานะที่ยอมรับ (ได้ ${noAuth.status()})`).toContain(noAuth.status());

    // 2) token ของ "ตัวแทน" (ไม่ใช่ HQ) — ต้องไม่มีสิทธิ์สร้างตัวแทน
    const rygToken = (await (await db(RYG)).auth.getSession()).data.session?.access_token ?? "";
    const asDealer = await request.post(`${HQ_ORIGIN}/api/admin/dealers`, {
      headers: { authorization: `Bearer ${rygToken}` }, data: payload,
    });
    expect(asDealer.status(), "ตัวแทนสร้างตัวแทนไม่ได้").not.toBe(200);
    expect(statuses(403), `สถานะที่ยอมรับ (ได้ ${asDealer.status()})`).toContain(asDealer.status());

    // ไม่ว่ากรณีไหน ต้องไม่มีสาขา ZZX เกิดขึ้น
    const rows = (await sb.from("dealers").select("code").eq("code", "ZZX")).data ?? [];
    expect(rows.length, "คำขอที่ถูกปฏิเสธต้องไม่สร้างสาขา").toBe(0);
  } finally {
    await sb.from("dealers").delete().eq("code", "ZZX");
  }
});

test("[func·hq] สาขาที่เพิ่งเพิ่ม โผล่ในตัวกรองของหน้าอื่นทันที", async ({ page }) => {
  const errs = watchErrors(page);
  await loginUI(page, HQ_ORIGIN, "/hq/login", ADMIN);

  // ทะเบียนตัวแทนเป็นแหล่งเดียวของทุกหน้า — สาขาใหม่ต้องไม่ตกหล่นที่ไหน
  await page.goto(`${HQ_ORIGIN}/hq/dealers`, { waitUntil: "domcontentloaded" });
  await expect.poll(async () => page.evaluate(() => document.body.innerText),
    { timeout: 20_000, message: "หน้าตัวแทนต้องเห็นสาขาใหม่" }).toContain(DEALER_NAME);

  assertNoErrors(errs, "สาขาใหม่ในหน้าอื่น");
});

test("[func·hq] ลบตัวแทนผ่านหน้าจอ → หายจาก DB จริง", async ({ page }) => {
  const errs = watchErrors(page);
  const sb = await db(ADMIN);

  await loginUI(page, HQ_ORIGIN, "/hq/login", ADMIN);
  await page.goto(`${HQ_ORIGIN}/hq/dealers`, { waitUntil: "domcontentloaded" });

  const row = page.locator("tbody tr").filter({ hasText: DEALER_NAME }).first();
  await expect(row).toBeVisible({ timeout: 20_000 });

  // รับทุกกล่องโต้ตอบ — ทั้งกล่องยืนยัน และกล่องแจ้ง error ถ้าลบไม่ผ่าน (จะได้เห็นสาเหตุ)
  const dialogs: string[] = [];
  page.on("dialog", d => { dialogs.push(d.message().slice(0, 120)); void d.accept(); });
  await row.getByTitle("ลบ").first().click();
  await page.waitForTimeout(2500);
  console.log("กล่องโต้ตอบ:", JSON.stringify(dialogs));

  await waitGone(sb, "dealers", { code: CODE }, 20_000);
  assertNoErrors(errs, "ลบตัวแทน");
});

test("[func·hq→dealer] HQ เพิ่มแม่แบบในแคตตาล็อกกลาง → ตัวแทนเห็น", async ({ page }) => {
  const errs = watchErrors(page);
  const sb = await db(ADMIN);
  const PRODUCT = `${TAG}-แม่แบบทดสอบ`;

  // เพิ่มผ่าน repo ฝั่ง HQ (ฟอร์มแคตตาล็อกมีหลายช่อง — ที่ต้องพิสูจน์คือ "ถึงตัวแทนไหม")
  const ins = await sb.from("master_catalog")
    .insert({ id: "zzt-test", name: PRODUCT, price: 9999, unit: "ตร.ม." }).select();
  expect(ins.error, `HQ เพิ่มแม่แบบไม่ได้: ${JSON.stringify(ins.error)}`).toBeNull();

  try {
    // ตัวแทนคนละ origin (:3001) — ถ้ายังเป็นโหมด local จะไม่มีทางเห็นเลย
    await loginUI(page, DEALER_ORIGIN, "/login", RYG);
    await page.goto(`${DEALER_ORIGIN}/products`, { waitUntil: "domcontentloaded" });
    await expect.poll(async () => page.evaluate(() => document.body.innerText),
      { timeout: 20_000, message: "ตัวแทนต้องเห็นแม่แบบที่ HQ เพิ่งเพิ่ม" }).toContain(PRODUCT);

    assertNoErrors(errs, "แคตตาล็อกถึงตัวแทน");
  } finally {
    await sb.from("master_catalog").delete().eq("id", "zzt-test");
  }
});

test("[func·hq→dealer] HQ เปลี่ยน VAT → ตัวแทนใช้ค่าใหม่ทันที", async ({ page }) => {
  const errs = watchErrors(page);
  const sb = await db(ADMIN);
  const { data: before } = await sb.from("hq_policy").select("vat").eq("id", 1).maybeSingle();
  const origVat = (before?.vat as number) ?? 7;
  const newVat = origVat === 7 ? 10 : 7;

  try {
    // HQ เปลี่ยนอัตราภาษีของทั้งเครือ
    const up = await sb.from("hq_policy").update({ vat: newVat }).eq("id", 1).select();
    expect(up.error, `HQ แก้ VAT ไม่ได้: ${JSON.stringify(up.error)}`).toBeNull();

    // ตัวแทนต้องเห็นค่าใหม่ที่หน้าตั้งค่า (ช่องติดกุญแจ + ป้าย HQ)
    await loginUI(page, DEALER_ORIGIN, "/login", RYG);
    await page.goto(`${DEALER_ORIGIN}/settings`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "ตั้งค่าใบเสนอราคา" }).first().click();

    await expect.poll(async () => page.evaluate(() => document.body.innerText),
      { timeout: 20_000, message: "ตัวแทนต้องเห็น VAT ที่ HQ ตั้งใหม่" }).toContain(String(newVat));

    assertNoErrors(errs, "VAT ถึงตัวแทน");
  } finally {
    await sb.from("hq_policy").update({ vat: origVat }).eq("id", 1);
  }
});

test("[func·hq] HQ เปิดหน้างานขายได้ แต่ไม่มีปุ่มสร้าง/แก้/ลบ", async ({ page }) => {
  const errs = watchErrors(page);
  await loginUI(page, HQ_ORIGIN, "/hq/login", ADMIN);
  await page.goto(`${HQ_ORIGIN}/hq/quotations`, { waitUntil: "domcontentloaded" });
  await expect.poll(async () => (await page.evaluate(() => document.body.innerText)).length,
    { timeout: 20_000 }).toBeGreaterThan(100);

  // สิทธิ์ที่ DB ห้าม HQ เขียนงานขายอยู่แล้ว — หน้าจอต้องไม่หลอกให้กด
  for (const label of ["สร้างใบเสนอราคา", "เพิ่มใบเสนอราคา", "ลบใบเสนอราคา"]) {
    expect(await page.getByRole("button", { name: label }).count(),
      `หน้า HQ ต้องไม่มีปุ่ม "${label}"`).toBe(0);
  }

  assertNoErrors(errs, "หน้าใบเสนอราคา HQ");
});

test("[func·hq] กดเพิ่มตัวแทน 'ก่อนทะเบียนโหลดเสร็จ' ต้องไม่ลบสาขาจริง", async ({ page }) => {
  // กับดักเดิม: save เคยเป็น "แทนที่ทั้งชุด" → ถ้าผู้ใช้กดเพิ่มก่อนโหลดจบ
  // อาร์เรย์จะมีแค่แถวใหม่แถวเดียว แล้วสั่งลบสาขาจริงที่เหลือทั้งหมด
  // (เคยเกิดจริง เห็นเป็น DELETE ...code=not.in.("ZZT") · รอดเพราะ FK ของตารางไฟล์)
  // — จุดประสงค์ของเทสต์นี้คือ "จำนวนสาขาต้องไม่ลด" เท่านั้น
  //   ไม่เช็ก console error เพราะการกดสร้างจริงจะยิง route (ตั้ง key แล้ว→200 · ยังไม่ตั้ง→501)
  //   501 ที่แอปจัดการแล้ว (ขึ้น error ในฟอร์ม) เบราว์เซอร์ยัง log "resource 501" เป็นเสียงรบกวน
  const BCODE = "ZZB"; // รหัสอิสระ ไม่ชนกับ fixture/เทสต์อื่น
  const sb = await db(ADMIN);
  await purgeDealerAccount(BCODE); // ล้างของค้างรอบก่อน: บัญชี auth + แถว (กัน orphan)
  const before = ((await sb.from("dealers").select("code")).data ?? []).length;
  expect(before, "ต้องมีสาขาจริงอยู่ก่อน").toBeGreaterThan(1);

  try {
    await loginUI(page, HQ_ORIGIN, "/hq/login", ADMIN);
    // จงใจ "ไม่รอ" ให้ทะเบียนโหลดเสร็จ แล้วรีบกดเพิ่มทันที
    await page.goto(`${HQ_ORIGIN}/hq/dealers`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "เพิ่มตัวแทน" }).first().click();
    await fillDealerForm(page, BCODE, `${TAG}-ก่อนโหลด`);
    await page.getByRole("button", { name: "สร้างตัวแทน" }).click();
    await page.waitForTimeout(4000);

    const after = ((await sb.from("dealers").select("code")).data ?? []).map(d => d.code);
    expect(after.length, `สาขาจริงต้องอยู่ครบ (ก่อน ${before} หลัง ${after.length})`)
      .toBeGreaterThanOrEqual(before);
  } finally {
    await purgeDealerAccount(BCODE); // ลบบัญชี auth ที่การกดสร้างอาจสร้างไว้ด้วย (กัน orphan)
  }
});

// H4 — รีเซ็ตรหัสผ่านผู้ใช้ HQ = "ส่งลิงก์ทางอีเมล" (ไม่ใช่โชว์รหัสปลอมแบบเดิม)
// ไม่กด "ส่ง" จริงในเทสต์ เพื่อเลี่ยง rate limit อีเมลของ Supabase — ตรวจแค่ว่า UI เปลี่ยนเป็นแบบส่งอีเมล
test("[func·hq] รีเซ็ตรหัสผ่านผู้ใช้ = โมดัลส่งลิงก์อีเมล ไม่ใช่รหัสชั่วคราวปลอม (H4)", async ({ page }) => {
  await loginUI(page, HQ_ORIGIN, "/hq/login", ADMIN);
  await page.goto(`${HQ_ORIGIN}/hq/users`, { waitUntil: "domcontentloaded" });

  const firstRow = page.locator("tbody tr").first();
  await expect(firstRow, "ต้องมีผู้ใช้ในตาราง").toBeVisible({ timeout: 25_000 });
  await firstRow.getByRole("button", { name: "จัดการ" }).click();
  await page.getByRole("button", { name: "รีเซ็ตรหัสผ่าน" }).click();

  // โมดัลใหม่ = ส่งลิงก์อีเมล (มีปุ่ม "ส่งลิงก์รีเซ็ต") · ต้องไม่มี "รหัสผ่านชั่วคราว" แบบเก่า
  await expect(page.getByRole("button", { name: "ส่งลิงก์รีเซ็ต" }), "ต้องเป็นโมดัลส่งอีเมล").toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("รหัสผ่านชั่วคราว"), "ต้องไม่มีรหัสปลอมแบบเดิม").toHaveCount(0);
});

// H4 — หน้าปลายทางของลิงก์รีเซ็ต: เปิดตรงโดยไม่มี recovery token → ต้องบอกว่าลิงก์ไม่ถูกต้อง (ไม่ค้าง/ไม่พัง)
test("[func·hq] หน้า /reset-password เปิดตรงโดยไม่มี token → แจ้งลิงก์ไม่ถูกต้อง (H4)", async ({ page }) => {
  await page.goto(`${HQ_ORIGIN}/reset-password`, { waitUntil: "domcontentloaded" });
  await expect(page.getByText("ลิงก์ไม่ถูกต้องหรือหมดอายุ"), "ไม่มี token ต้องแจ้งลิงก์ไม่ถูกต้อง")
    .toBeVisible({ timeout: 10_000 });
});

// ── ฟอร์มตัวแทน: ภาคต้องเลือกก่อนจังหวัด (ผู้ใช้แจ้ง 18 ส.ค. 69) ──
// เดิมช่อง "ภาค" ตั้งต้นเป็น "กลาง" ให้เองทั้งที่ไม่มีใครเลือก — ตัวแทนภาคอื่นจึงถูกบันทึกเป็นภาคกลางได้ง่าย ๆ
// และเพราะรายการจังหวัดขึ้นกับภาค ถ้ายังไม่เลือกภาคก็เลือกจังหวัดไม่ได้เลย — ต้องบอกให้รู้ ห้ามเงียบ
test("[func·hq] ฟอร์มตัวแทน: ภาคเริ่มที่ “ยังไม่ระบุ” · ไม่เลือกภาค = เลือกจังหวัดไม่ได้ และบันทึกไม่ผ่าน", async ({ page }) => {
  await loginUI(page, HQ_ORIGIN, "/hq/login", ADMIN);
  await page.goto(`${HQ_ORIGIN}/hq/dealers`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /เพิ่มตัวแทน/ }).first().click();
  const dlg = page.getByRole("dialog");
  const region = dlg.getByLabel("ภูมิภาค", { exact: true });
  const prov = dlg.getByLabel("จังหวัดที่ตั้ง", { exact: true });

  await expect(region, "ต้องไม่เลือกภาคให้เอง").toHaveValue("");
  expect((await prov.locator("option").allInnerTexts()).join(" "),
    "ยังไม่เลือกภาค → ต้องบอกว่าให้เลือกภาคก่อน").toContain("เลือกภาคก่อน");

  await dlg.getByPlaceholder("เช่น BKK").fill("ZZR");
  await dlg.getByPlaceholder("บจ. ตัวอย่างสตีล...").fill("ZZ ทดสอบภาค");
  await dlg.getByRole("button", { name: /สร้างตัวแทน/ }).click();
  await expect(dlg.getByText(/ต้องเลือกภาคก่อน/),
    "กดบันทึกโดยไม่เลือกภาค → ต้องฟ้อง ห้ามบันทึกผ่าน").toBeVisible();

  await region.selectOption({ index: 1 });
  expect((await prov.locator("option").count()),
    "เลือกภาคแล้วต้องมีจังหวัดให้เลือก").toBeGreaterThan(1);
});

// ── สร้างตัวแทน → ต้องตั้งชื่อบริษัทให้ด้วย (บอสสั่ง 18 ส.ค. 69) ──
// เดิมสาขาใหม่เกิดมาโดยช่อง "ชื่อบริษัท" ว่าง → หัวเอกสาร/แถบบน/เมนูซ้ายตกไปขึ้น "รหัสสาขา"
// ชื่อที่ HQ เห็นกับที่สาขาเห็นจึงไม่ตรงกัน — ผู้ใช้แจ้งจริง
test("[func·hq] สร้างตัวแทน → ชื่อบริษัทของสาขาถูกตั้งให้ตั้งแต่ต้น ไม่ปล่อยว่าง", async ({ page }) => {
  // ⚠️ ห้ามชนรหัสกับ NEW_CODE ของเทสต์ H5 ด้านบน — รันคู่กันแล้วบัญชี auth ชนกัน สร้างไม่ผ่าน
  const CODE = "ZZS", NAME = "ZZ บริษัทชื่อทดสอบ";
  const sb = await db(ADMIN);
  // ต้องลบบัญชี auth ด้วย — ลบแค่แถวในตาราง รอบถัดไปจะสร้างไม่ผ่าน ("อีเมลถูกใช้ไปแล้ว")
  const wipe = async () => {
    await purgeDealerAccount(CODE);
    await sb.from("dealer_settings").delete().eq("dealer_code", CODE);
    await sb.from("dealers").delete().eq("code", CODE);
  };
  await wipe();

  await loginUI(page, HQ_ORIGIN, "/hq/login", ADMIN);
  await page.goto(`${HQ_ORIGIN}/hq/dealers`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /เพิ่มตัวแทน/ }).first().click();
  await fillDealerForm(page, CODE, NAME);
  await page.getByRole("button", { name: /สร้างตัวแทน/ }).click();

  await expect.poll(async () => {
    const r = (await sb.from("dealer_settings").select("issuer").eq("dealer_code", CODE).maybeSingle()).data as { issuer?: { company?: string } } | null;
    return r?.issuer?.company ?? "";
  }, { timeout: 30_000, message: "ต้องตั้งชื่อบริษัทให้ตั้งแต่ตอนสร้าง" }).toBe(NAME);

  await wipe();
});
