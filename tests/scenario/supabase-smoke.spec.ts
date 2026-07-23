import { test, expect, type Page } from "@playwright/test";
import { RYG, ADMIN, skipReason, type Account } from "./supabaseEnv";

test.skip(() => skipReason() !== "", skipReason() || "พร้อมรัน");

// ── สโมคเทสต์โหมด supabase — พิสูจน์ว่า "ตัวแอปจริง" ใช้งานได้กับ backend จริง ────────
// ต่างจากเทสต์ชุดอื่นที่รันโหมด local (mock): ชุดนี้ล็อกอินด้วยบัญชีจริงผ่านหน้าจอ
// แล้วดูว่า auth (JWT+RLS) / การโหลดข้อมูลผ่าน repo / ค่าคุมจาก HQ ทำงานครบ
// รันเมื่อ NEXT_PUBLIC_DATA_SOURCE=supabase เท่านั้น — ถ้าเป็น local ให้ข้าม
const DEALER = "http://localhost:3001";
const HQ = "http://localhost:3002";

// เก็บ error ของหน้า (crash/exception) เพื่อฟ้องว่าแอปพังเงียบ ๆ ไหม
function trackErrors(page: Page): string[] {
  const errs: string[] = [];
  page.on("pageerror", e => errs.push(`pageerror: ${e.message}`));
  page.on("console", m => { if (m.type() === "error") errs.push(`console: ${m.text()}`); });
  return errs;
}

// ล็อกอินผ่านหน้าจอจริง แล้วรอจนออกจากหน้า login
// ถ้าไม่ออก ให้ดึงข้อความ error ที่ฟอร์มโชว์มาใส่ใน assertion (จะได้รู้สาเหตุจริง ไม่ใช่แค่ timeout)
async function login(page: Page, origin: string, path: string, who: Account) {
  await page.goto(`${origin}${path}`, { waitUntil: "domcontentloaded" });
  // รอให้ React hydrate เสร็จก่อนแตะฟอร์ม — กรอกก่อน hydrate แล้ว controlled input จะถูกล้างทิ้ง
  // แล้วฟอร์มถูกส่งไปเปล่า ๆ (Supabase ตอบ "missing email or phone" · โผล่เป็น console error ด้วย)
  await page.waitForLoadState("networkidle").catch(() => {});
  const email = page.getByLabel(/อีเมล/i).first();
  const pass = page.getByLabel(/รหัสผ่าน/i).first();

  // ต้องกรอก "หลัง React hydrate" เท่านั้น — ถ้ากรอกก่อน controlled input จะถูกรีเซ็ตเป็นค่าว่าง
  // ตอน hydrate แล้วส่งฟอร์มเปล่า (Supabase ตอบ "missing email or phone")
  // เช็คค่าก่อนกดอย่างเดียวยังไม่พอ: hydrate อาจมาคั่นระหว่าง "เช็ค" กับ "กด"
  // จึงกรอก→กด→ถ้ายังไม่ออกจากหน้า login ให้เริ่มใหม่ทั้งรอบ
  let alerts: string[] = [];
  for (let attempt = 1; attempt <= 3; attempt++) {
    // กรอกแล้วต้อง "อยู่นิ่ง" สองรอบติดกัน ไม่ใช่แค่ถูกต้องตอนเช็คครั้งเดียว
    // (hydrate อาจมาคั่นระหว่างเช็คกับกด แล้วส่งฟอร์มเปล่า)
    for (let i = 0; i < 6; i++) {
      await email.fill(who.email);
      await pass.fill(who.password);
      await page.waitForTimeout(300);
      const ok1 = await email.inputValue() === who.email && await pass.inputValue() === who.password;
      await page.waitForTimeout(300);
      const ok2 = await email.inputValue() === who.email && await pass.inputValue() === who.password;
      if (ok1 && ok2) break;
    }
    await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).first().click();

    const left = await page.waitForFunction(() => !location.pathname.includes("/login"), null, { timeout: 20_000 })
      .then(() => true).catch(() => false);
    if (left) return;
    alerts = await page.getByRole("alert").allInnerTexts().catch(() => []);
    console.log(`ล็อกอินรอบที่ ${attempt} ไม่ผ่าน (${JSON.stringify(alerts)}) — ลองใหม่`);
  }
  throw new Error(`ล็อกอินไม่ผ่าน (${who.email}) — ยังอยู่ที่ ${page.url()} · ข้อความบนฟอร์ม: ${JSON.stringify(alerts)}`);
}

test("[supabase] ตัวแทน RYG ล็อกอินผ่านหน้าจอจริงแล้วเข้าระบบได้", async ({ page }) => {
  const errs = trackErrors(page);
  await login(page, DEALER, "/login", RYG);
  // ล็อกอินสำเร็จ = เด้งออกจากหน้า login
  await page.waitForTimeout(2500);
  console.log("URL หลังล็อกอิน:", page.url());
  const body = await page.evaluate(() => document.body.innerText);
  expect(body.length, "หน้าต้องเรนเดอร์เนื้อหา ไม่ใช่จอเปล่า").toBeGreaterThan(200);
  const fatal = errs.filter(e => !/favicon|hydrat|Download the React/i.test(e));
  console.log(fatal.length ? `errors:\n${fatal.slice(0, 5).join("\n")}` : "ไม่มี error");
  expect(fatal, "ต้องไม่มี error ตอนเข้าระบบด้วย backend จริง").toEqual([]);
});

test("[supabase] ตัวแทนเปิดหน้าหลักได้ครบ ไม่พัง", async ({ page }) => {
  const errs = trackErrors(page);
  await login(page, DEALER, "/login", RYG);
  for (const p of ["/dashboard", "/leads", "/customers", "/quotations", "/products", "/calendar", "/files"]) {
    await page.goto(`${DEALER}${p}`, { waitUntil: "domcontentloaded" });
    // รอจนหน้ามีเนื้อหาจริง — หน่วงคงที่ไม่พอเมื่อรันหลาย worker พร้อมกัน (เครื่องช้าลง → เทสต์แกว่ง)
    await expect.poll(async () => (await page.evaluate(() => document.body.innerText)).length,
      { timeout: 20_000, message: `${p} ต้องเรนเดอร์ได้` }).toBeGreaterThan(100);
    const txt = await page.evaluate(() => document.body.innerText);
    console.log(`${p} ✓ (${txt.length} chars)`);
  }
  const fatal = errs.filter(e => !/favicon|hydrat|Download the React/i.test(e));
  if (fatal.length) console.log(`errors:\n${fatal.slice(0, 8).join("\n")}`);
  expect(fatal, "ทุกหน้าต้องไม่มี error").toEqual([]);
});

test("[supabase] หน้าแม่แบบของตัวแทนดึงแคตตาล็อกจาก HQ ได้จริง", async ({ page }) => {
  await login(page, DEALER, "/login", RYG);
  await page.goto(`${DEALER}/products`, { waitUntil: "domcontentloaded" });
  // แม่แบบที่ seed ไว้ใน master_catalog ต้องโผล่ (ไม่ใช่ mock ในเครื่อง)
  await expect.poll(async () => page.evaluate(() => document.body.innerText), { timeout: 15_000 })
    .toContain("โกดังสำเร็จรูป");
  const txt = await page.evaluate(() => document.body.innerText);
  for (const name of ["โรงงาน", "งานรีโนเวท"]) expect(txt, `ต้องมีแม่แบบ "${name}"`).toContain(name);
  console.log("แม่แบบจากแคตตาล็อกกลางแสดงครบ");
});

test("[supabase] HQ ล็อกอินแล้วเปิดหน้าเครือได้", async ({ page }) => {
  const errs = trackErrors(page);
  await login(page, HQ, "/hq/login", ADMIN);
  for (const p of ["/hq/dashboard", "/hq/dealers", "/hq/leads", "/hq/master", "/hq/settings"]) {
    await page.goto(`${HQ}${p}`, { waitUntil: "domcontentloaded" });
    await expect.poll(async () => (await page.evaluate(() => document.body.innerText)).length,
      { timeout: 20_000, message: `${p} ต้องเรนเดอร์ได้` }).toBeGreaterThan(100);
    const txt = await page.evaluate(() => document.body.innerText);
    console.log(`${p} ✓ (${txt.length} chars)`);
  }
  const fatal = errs.filter(e => !/favicon|hydrat|Download the React/i.test(e));
  if (fatal.length) console.log(`errors:\n${fatal.slice(0, 8).join("\n")}`);
  expect(fatal, "หน้า HQ ต้องไม่มี error").toEqual([]);
});

test("[supabase] HQ เห็นตัวแทนครบ 10 สาขาจาก DB", async ({ page }) => {
  await login(page, HQ, "/hq/login", ADMIN);
  await page.goto(`${HQ}/hq/dealers`, { waitUntil: "domcontentloaded" });
  await expect.poll(async () => page.evaluate(() => document.body.innerText), { timeout: 15_000 })
    .toContain("ระยองสตีลเวิร์คส์");
  const txt = await page.evaluate(() => document.body.innerText);
  for (const d of ["เชียงใหม่สตีลบิลด์", "ภูเก็ตสตรัคเจอรัล"]) expect(txt).toContain(d);
  console.log("รายชื่อตัวแทนจาก DB แสดงครบ");
});

test("[supabase] หน้าจอโชว์ชื่อคน/ชื่อสาขาจริง ไม่ใช่อีเมล/รหัสสาขา (B5)", async ({ page }) => {
  await login(page, DEALER, "/login", RYG);
  await page.goto(`${DEALER}/dashboard`, { waitUntil: "domcontentloaded" });
  await expect.poll(async () => page.evaluate(() => document.body.innerText), { timeout: 15_000 })
    .toContain("ระยอง");
  const txt = await page.evaluate(() => document.body.innerText);
  // ชื่อสาขาต้องเป็นชื่อบริษัทจาก dealers.name ไม่ใช่รหัส 3 ตัว
  expect(txt, "ต้องเห็นชื่อสาขาจริง").toMatch(/ระยองสตีลเวิร์คส|ระยอง/);
  console.log("ชื่อที่แสดง:", txt.split("\n").filter(l => /ระยอง|@/.test(l)).slice(0, 4).join(" | "));
});
