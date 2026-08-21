// ── สร้างตัวแทน: HQ กรอกอีเมล/รหัสผ่านเองได้ (บอสสั่ง 20 ส.ค. 69) ────────────────
//
// ทำไมต้องกรอกเอง: สาขาจริงใช้อีเมลธุรกิจของตัวเอง (CNX = sales@cmsteelbuild.co.th)
//   อีเมลที่ระบบประกอบจากรหัสสาขา (`ztc@partner-agent.co.th`) ไม่มีอยู่จริง
//   → สาขารับอีเมลยืนยัน/ลืมรหัสผ่านไม่ได้เลย
//
// สิ่งที่ต้องจริง ไม่ใช่แค่ "ฟอร์มมีช่อง": บัญชีที่ได้ต้อง "ล็อกอินได้จริง" ด้วยอีเมล/รหัสที่กรอก
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { ADMIN, SUPABASE_URL, SUPABASE_ANON, skipReason } from "./supabaseEnv";
import { ADMIN_SUPABASE_URL, ADMIN_SERVICE_ROLE_KEY } from "./adminEnv";
import { HQ_ORIGIN, db } from "./funcHelpers";
import { openAs, settle } from "./helpers";

test.skip(() => skipReason() !== "", skipReason() || "พร้อมรัน");
test.setTimeout(240_000);

const CODE = "ZTC";
const CODE3 = "ZTF";
const EMAIL3 = "zztest-dealer-ui@example.co.th";
const CODE2 = "ZTE";
const EMAIL2 = "zztest-dealer-edit@example.co.th";
const EMAIL2_NEW = "zztest-dealer-edit2@example.co.th";
const EMAIL = "zztest-dealer-login@example.co.th";
const PASSWORD = "ZZtest-Pass-2569";
const admin = createClient(ADMIN_SUPABASE_URL, ADMIN_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function purge() {
  for (const code of [CODE, CODE2, CODE3, "ZTD"]) {
    const { data: profs } = await admin.from("profiles").select("id").eq("dealer_code", code);
    for (const p of profs ?? []) await admin.auth.admin.deleteUser(String(p.id)).catch(() => {});
    await admin.from("dealer_login_secrets").delete().eq("dealer_code", code);
    await admin.from("dealer_settings").delete().eq("dealer_code", code);
    await admin.from("dealers").delete().eq("code", code);
  }
  // เผื่อบัญชีค้างจากรอบก่อนที่ profiles ถูกลบไปแล้ว
  const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const ของเทสต์ = new Set([EMAIL, EMAIL2, EMAIL2_NEW, EMAIL3, EMAIL3.replace("@", "2@")]);
  for (const u of users?.users ?? []) if (u.email && ของเทสต์.has(u.email)) await admin.auth.admin.deleteUser(u.id).catch(() => {});
}
test.beforeAll(purge);
test.afterAll(purge);

test("[admin] สร้างตัวแทนด้วยอีเมล/รหัสผ่านที่กรอกเอง แล้วล็อกอินได้จริง", async ({ request }) => {
  const token = (await (await db(ADMIN)).auth.getSession()).data.session?.access_token ?? "";
  const res = await request.post(`${HQ_ORIGIN}/api/admin/dealers`, {
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    data: { code: CODE, name: "ZZTEST สาขาทดสอบรหัสผ่าน", province: "ระยอง", region: "ตะวันออก",
            revenueTarget: 1_000_000, email: EMAIL, password: PASSWORD },
  });
  test.skip(res.status() === 501, "เครื่องนี้ยังไม่ได้ตั้ง service_role");
  expect(res.status(), `ต้องสร้างสำเร็จ (ได้ ${res.status()} · ${await res.text()})`).toBe(200);

  const body = await res.json() as { email?: string; password?: string };
  expect(body.email, "ต้องคืนอีเมลที่กรอกไป ไม่ใช่อีเมลที่ระบบประกอบเอง").toBe(EMAIL);
  expect(body.password, "ต้องคืนรหัสที่กรอกไป").toBe(PASSWORD);

  // ★ ของจริง: ล็อกอินด้วยอีเมล/รหัสที่กรอกต้องผ่าน และได้สิทธิ์ของสาขานี้
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: signed, error } = await sb.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  expect(error, `ต้องล็อกอินด้วยรหัสที่ HQ ตั้งได้จริง (${error?.message ?? ""})`).toBeNull();
  const { data: prof } = await admin.from("profiles").select("dealer_code").eq("id", String(signed.user?.id)).maybeSingle();
  expect(prof?.dealer_code, "บัญชีต้องผูกกับสาขาที่เพิ่งสร้าง").toBe(CODE);
  await sb.auth.signOut().catch(() => {});
});

test("[admin] รหัสผ่านสั้นเกินไป/อีเมลผิดรูปแบบ ต้องถูกปฏิเสธที่เซิร์ฟเวอร์", async ({ request }) => {
  const token = (await (await db(ADMIN)).auth.getSession()).data.session?.access_token ?? "";
  const call = (extra: Record<string, unknown>) => request.post(`${HQ_ORIGIN}/api/admin/dealers`, {
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    data: { code: "ZTD", name: "ZZTEST ตรวจค่าที่กรอก", province: "ระยอง", region: "ตะวันออก", revenueTarget: 0, ...extra },
  });

  const สั้น = await call({ password: "1234" });
  test.skip(สั้น.status() === 501, "เครื่องนี้ยังไม่ได้ตั้ง service_role");
  expect(สั้น.status(), "รหัสสั้นต้องถูกปฏิเสธ ไม่ใช่สร้างบัญชีที่เดารหัสได้").toBe(400);

  const เพี้ยน = await call({ email: "ไม่ใช่อีเมล" });
  expect(เพี้ยน.status(), "อีเมลผิดรูปแบบต้องถูกปฏิเสธ").toBe(400);

  // ต้องไม่มีสาขา/บัญชีตกค้างจากคำขอที่ถูกปฏิเสธ
  const { data: ตกค้าง } = await admin.from("dealers").select("code").eq("code", "ZTD");
  expect(ตกค้าง ?? [], "คำขอที่ถูกปฏิเสธต้องไม่ทิ้งสาขาไว้").toEqual([]);
});

test("[admin] HQ แก้อีเมล/รหัสผ่านของสาขาที่มีอยู่แล้วได้ · แก้อีเมลอย่างเดียวต้องไม่เตะรหัสเดิม", async ({ request }) => {
  const token = (await (await db(ADMIN)).auth.getSession()).data.session?.access_token ?? "";
  const hdr = { authorization: `Bearer ${token}`, "content-type": "application/json" };

  // สร้างสาขาไว้ก่อน (อีเมล/รหัสตั้งเอง) — ใช้ตัวเดียวกับเคสแรกไม่ได้ เพราะรันขนานกันได้
  const สร้าง = await request.post(`${HQ_ORIGIN}/api/admin/dealers`, {
    headers: hdr,
    data: { code: CODE2, name: "ZZTEST สาขาแก้บัญชี", province: "ระยอง", region: "ตะวันออก",
            revenueTarget: 0, email: EMAIL2, password: PASSWORD },
  });
  test.skip(สร้าง.status() === 501, "เครื่องนี้ยังไม่ได้ตั้ง service_role");
  expect(สร้าง.status(), await สร้าง.text()).toBe(200);

  // ── แก้อีเมลอย่างเดียว → รหัสเดิมต้องยังใช้ได้ (ห้ามสุ่มรหัสใหม่ทับโดยไม่ได้ขอ) ──
  const แก้อีเมล = await request.patch(`${HQ_ORIGIN}/api/admin/dealers?code=${CODE2}`, {
    headers: hdr, data: { email: EMAIL2_NEW },
  });
  expect(แก้อีเมล.status(), await แก้อีเมล.text()).toBe(200);
  const ผล = await แก้อีเมล.json() as { email?: string; password?: string };
  expect(ผล.email, "ต้องคืนอีเมลใหม่").toBe(EMAIL2_NEW);
  expect(ผล.password ?? "", "แก้อีเมลอย่างเดียวต้องไม่ออกรหัสใหม่").toBe("");

  const sb = createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: e1 } = await sb.auth.signInWithPassword({ email: EMAIL2_NEW, password: PASSWORD });
  expect(e1, `อีเมลใหม่ + รหัสเดิมต้องเข้าได้ (${e1?.message ?? ""})`).toBeNull();
  await sb.auth.signOut().catch(() => {});

  // ── ตั้งรหัสผ่านเอง → ต้องเข้าด้วยรหัสใหม่ได้ และรหัสเดิมใช้ไม่ได้แล้ว ──
  const รหัสใหม่ = "ZZtest-Changed-2569";
  const แก้รหัส = await request.patch(`${HQ_ORIGIN}/api/admin/dealers?code=${CODE2}`, {
    headers: hdr, data: { password: รหัสใหม่ },
  });
  expect(แก้รหัส.status(), await แก้รหัส.text()).toBe(200);

  const sb2 = createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: e2 } = await sb2.auth.signInWithPassword({ email: EMAIL2_NEW, password: รหัสใหม่ });
  expect(e2, `ต้องเข้าด้วยรหัสที่ HQ ตั้งเองได้ (${e2?.message ?? ""})`).toBeNull();
  await sb2.auth.signOut().catch(() => {});

  const sb3 = createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: e3 } = await sb3.auth.signInWithPassword({ email: EMAIL2_NEW, password: PASSWORD });
  expect(e3, "รหัสเดิมต้องใช้ไม่ได้แล้วหลังตั้งรหัสใหม่").not.toBeNull();

  // ค่าที่กรอกผิดต้องถูกปฏิเสธที่เซิร์ฟเวอร์เหมือนตอนสร้าง
  const สั้น = await request.patch(`${HQ_ORIGIN}/api/admin/dealers?code=${CODE2}`, { headers: hdr, data: { password: "123" } });
  expect(สั้น.status(), "รหัสสั้นต้องถูกปฏิเสธ").toBe(400);
});

test("[ui·hq] แก้อีเมล/รหัสผ่านผ่านหน้าจอจริงได้ครบวง (ไม่ใช่แค่ API)", async ({ page, request }) => {
  const token = (await (await db(ADMIN)).auth.getSession()).data.session?.access_token ?? "";
  const สร้าง = await request.post(`${HQ_ORIGIN}/api/admin/dealers`, {
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    data: { code: CODE3, name: "ZZTEST สาขาแก้ผ่านหน้าจอ", province: "ระยอง", region: "ตะวันออก",
            revenueTarget: 0, email: EMAIL3, password: PASSWORD },
  });
  test.skip(สร้าง.status() === 501, "เครื่องนี้ยังไม่ได้ตั้ง service_role");
  expect(สร้าง.status(), await สร้าง.text()).toBe(200);

  await openAs(page, ADMIN, "hq", `/hq/dealers/${CODE3}`);
  await settle(page);

  // ป้าย "โหมดดูอย่างเดียว" ต้องไม่บอกคลุมว่าแก้อะไรไม่ได้เลย — หน้านี้แก้บัญชีเข้าระบบได้จริง
  await expect(page.getByText("โหมดดูอย่างเดียว").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("บัญชีเข้าระบบแก้ได้ที่การ์ด"),
    "ป้ายต้องชี้ทางว่าบัญชีเข้าระบบแก้ได้ที่ไหน").toBeVisible();

  // ปุ่ม "รีเซ็ตรหัสผ่าน" ถูกถอดออกแล้ว (บอสสั่ง 20 ส.ค. 69) — เหลือทางเดียวคือปุ่มแก้
  await expect(page.getByRole("button", { name: "รีเซ็ตรหัสผ่าน" }),
    "ต้องไม่มีปุ่มรีเซ็ตรหัสผ่านซ้ำอีก").toHaveCount(0);

  await page.getByRole("button", { name: "แก้อีเมล/รหัสผ่าน" }).first().click();
  const ช่องอีเมล = page.getByLabel("อีเมลเข้าสู่ระบบใหม่");
  await expect(ช่องอีเมล).toBeVisible({ timeout: 15_000 });

  // ช่องอีเมลต้องมีอีเมลปัจจุบันอยู่แล้ว ไม่ใช่ว่างเปล่าให้เดาเอง
  // (กดปุ่มก่อนอีเมลโหลดเสร็จก็ต้องเติมให้ทีหลัง — เคสที่บอสเจอจริง)
  await expect(ช่องอีเมล, "ต้องเติมอีเมลปัจจุบันให้ในช่อง").toHaveValue(EMAIL3, { timeout: 15_000 });
  await expect(page.getByText(`อีเมลปัจจุบัน: ${EMAIL3}`), "ต้องบอกของเดิมไว้ด้วย").toBeVisible();

  // คลิกในโมดัลแล้วโมดัลต้องไม่ปิดหนีไปเอง (กับดักคลาสสิกของโมดัลที่ปิดเมื่อคลิกฉากหลัง)
  await ช่องอีเมล.click();
  await expect(ช่องอีเมล, "คลิกในโมดัลแล้วต้องยังกรอกต่อได้").toBeVisible();

  // ★ ปุ่มบันทึกต้องไม่ถูกอะไรทับ (บอสเจอ 20 ส.ค. 69: การ์ด "ความคืบหน้าเทียบเป้า" วาดทับครึ่งล่างของโมดัล)
  //   สาเหตุคือโมดัลอยู่ในกล่อง .card ที่มี transform → position:fixed ไปยึดกับการ์ดแทนขอบจอ
  //   ตรวจด้วยการถามเบราว์เซอร์ว่า "จุดกลางปุ่มบันทึก ใครอยู่บนสุด" ต้องเป็นตัวปุ่มเอง
  const บนสุดตรงปุ่ม = await page.getByRole("button", { name: "บันทึก" }).first().evaluate(el => {
    const b = el.getBoundingClientRect();
    const บน = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    return { เป็นปุ่มเอง: el === บน || el.contains(บน), อยู่ในจอ: b.bottom <= window.innerHeight };
  });
  expect(บนสุดตรงปุ่ม.เป็นปุ่มเอง, "ปุ่มบันทึกต้องไม่ถูกการ์ดอื่นวาดทับ").toBe(true);
  expect(บนสุดตรงปุ่ม.อยู่ในจอ, "ปุ่มบันทึกต้องอยู่ในหน้าจอ ไม่ถูกตัดขอบล่าง").toBe(true);

  const อีเมลใหม่ = EMAIL3.replace("@", "2@");
  await ช่องอีเมล.fill(อีเมลใหม่);
  await page.getByLabel("รหัสผ่านใหม่").fill("ZZtest-UI-2569");
  await page.getByRole("button", { name: "บันทึก" }).first().click();

  // บันทึกแล้วอีเมลบนการ์ดต้องเปลี่ยนตามทันที ไม่ต้องรีโหลดหน้า
  await expect(page.getByText(อีเมลใหม่).first(), "การ์ดต้องแสดงอีเมลใหม่ทันที").toBeVisible({ timeout: 20_000 });

  // และของจริง: ล็อกอินด้วยคู่ใหม่ได้
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await sb.auth.signInWithPassword({ email: อีเมลใหม่, password: "ZZtest-UI-2569" });
  expect(error, `ต้องล็อกอินด้วยคู่ใหม่ที่แก้ผ่านหน้าจอได้ (${error?.message ?? ""})`).toBeNull();
  await sb.auth.signOut().catch(() => {});
});
