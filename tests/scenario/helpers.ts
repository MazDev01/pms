import { Page, expect } from "@playwright/test";
import { createClient, type Session } from "@supabase/supabase-js";
import { RYG, CNX, ADMIN, SUPABASE_URL, SUPABASE_ANON, REAL_BACKEND, type Account, appEnv } from "./supabaseEnv";

// สลับ role ก่อนโหลดหน้า (RoleProvider อ่านจาก localStorage ตอน mount) — ใช้ได้เฉพาะโหมด local mock data
export async function loginAs(page: Page, role: "hq" | "dealer") {
  await page.addInitScript((r) => {
    localStorage.setItem("pms_session_key", r as string);
    localStorage.setItem("pms_logged_in", "true");
  }, role);
}

// ── โหมด supabase: ยัด session จริงลง localStorage ตรงๆ แทนล็อกอินผ่านหน้าจอทุกเทสต์ ──
// เร็วกว่ามาก (ไม่ต้องรอ UI) และไม่ชน rate limit ของ Supabase Auth (เข้าสู่ระบบครั้งเดียวต่อบัญชี
// แล้ว cache ไว้ใช้ซ้ำได้ตลอดการรัน — เทียบกับเดิมที่ล็อกอินผ่านหน้าจอทุกเทสต์)
// ⚠️ ต้องเป็น localStorage ให้ตรงกับ client.ts (11 ส.ค. 69 ย้ายกลับจาก sessionStorage
//    เพราะ sessionStorage ทำให้เปิดแท็บใหม่แล้วต้องล็อกอินซ้ำ) — ยัดผิดที่ = แอปไม่เห็น session เลย
// (กัน session สลับข้ามแท็บ, ดู packages/shared/lib/data/supabase/client.ts) คีย์ต้องตรงกับที่แอปใช้จริง
export const SESSION_KEY = `sb-${new URL(SUPABASE_URL || "https://x.supabase.co").hostname.split(".")[0]}-auth-token`;

const sessionCache = new Map<string, Promise<Session>>();
export async function getSession(who: Account): Promise<Session> {
  const cached = sessionCache.get(who.email);
  if (cached) return cached;
  const p = (async () => {
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await sb.auth.signInWithPassword(who);
    if (error || !data.session) throw new Error(`[helpers] ล็อกอิน ${who.email} ไม่ผ่าน: ${error?.message}`);
    return data.session;
  })();
  sessionCache.set(who.email, p);
  return p;
}

// โมโนเรโป: แอปตัวแทน (dealer) รันที่ :3001 · แอปสำนักงานใหญ่ (hq) รันที่ :3002
const APP_ORIGIN = { hq: "http://localhost:3002", dealer: "http://localhost:3001" } as const;
// โหมด api เก็บใบผ่านใน cookie httpOnly (ระยะ 4) — เทสต์ต้องล็อกอินผ่าน backend ไม่ใช่ยัด localStorage
const COOKIE_AUTH = appEnv("NEXT_PUBLIC_DATA_SOURCE") === "api";
// role ทั่วไปแมปกับบัญชีจริงบัญชีเดียว (RYG/ADMIN) — เทสต์ที่ต้องเจาะจงบัญชีอื่น (เช่น CNX สำหรับ
// branch-isolation.spec.ts) ใช้ openAs() แทน
const ROLE_ACCOUNT: Record<"hq" | "dealer", Account> = { hq: ADMIN, dealer: RYG };

/** เปิดหน้าแบบล็อกอินจริง (โหมด supabase) หรือจำลอง role (โหมด local) ตามที่แอปตั้งค่าไว้ */
export async function open(page: Page, role: "hq" | "dealer", path: string) {
  if (REAL_BACKEND) return openAs(page, ROLE_ACCOUNT[role], role, path);
  await loginAs(page, role);
  await page.goto(APP_ORIGIN[role] + path, { waitUntil: "domcontentloaded" });
}

/** เปิดหน้าด้วยบัญชีจริงที่ระบุเจาะจง (เช่น CNX สำหรับเทสต์ตรวจการกันข้ามสาขา) */
export async function openAs(page: Page, who: Account, appRole: "hq" | "dealer", path: string) {
  if (COOKIE_AUTH) {
    // ระยะ 4: ใบผ่านอยู่ใน cookie httpOnly แล้ว — ยัด session ลง localStorage ไม่มีผลอีกต่อไป
    // ต้องล็อกอินผ่าน backend จริงเพื่อให้ได้ cookie มาอยู่ในเบราว์เซอร์ของเทสต์
    const res = await page.context().request.post(`${APP_ORIGIN[appRole]}/api/v1/auth?op=login`, {
      data: { email: who.email, password: who.password },
    });
    if (!res.ok()) throw new Error(`ล็อกอิน ${who.email} ผ่าน backend ไม่ผ่าน: ${res.status()} ${await res.text()}`);
  } else {
    const session = await getSession(who);
    await page.addInitScript(({ key, session }) => {
      localStorage.setItem(key, JSON.stringify(session));
    }, { key: SESSION_KEY, session });
  }
  await page.goto(APP_ORIGIN[appRole] + path, { waitUntil: "domcontentloaded" });
  await settle(page);
}

/** รอจน "ไม่มีคำขอข้อมูลค้างแล้ว" — เวอร์ชันที่ไม่นับสายอัปเดตสด
 *
 * ⚠️ ห้ามใช้ waitForLoadState("networkidle") กับแอปนี้:
 *    โหมด api เปิดสายอัปเดตสด (SSE) ค้างไว้ตลอดโดยตั้งใจ — เป็นคำขอ HTTP ที่ไม่มีวันจบ
 *    เงื่อนไข "ไม่มีคำขอค้างเลย" จึงไม่มีวันเป็นจริง → รอจนหมดเวลา 20 วินาทีทุกครั้งที่เปิดหน้า
 *    (วัดจริง 18 ส.ค. 69: ชุดเต็มโหมด api 31 นาที เทียบโหมดปกติ 9 นาที · ทุกหน้าเสียคงที่ ~20 วินาที)
 *    โหมดปกติไม่เจอเพราะใช้ WebSocket ซึ่งตัวนับ networkidle ไม่นับ — ไม่ได้แปลว่าแอปเร็วกว่าจริง
 *
 * ⚠️ และห้ามเปลี่ยนไปหน่วงเวลาตายตัวแทน — เคยลองแล้วพัง:
 *    รอ 600 มิลลิวินาทีเฉย ๆ ทำให้เทสต์อ่านหน้าก่อนข้อมูลมาถึง ล้มเพิ่ม 7 ข้อ "ทั้งสองโหมด"
 *    ต้องรอ "จนคำขอข้อมูลหยุดจริง" เหมือน networkidle เดิม แค่ไม่นับสายอัปเดตสดเข้าไปด้วย
 */
export async function settle(page: Page, quietMs = 500, timeoutMs = 15_000) {
  await page.waitForLoadState("load").catch(() => {});
  const isStream = (u: string) => u.includes("/api/v1/events");
  let pending = 0;
  const onStart = (r: { url(): string }) => { if (!isStream(r.url())) pending += 1; };
  const onEnd   = (r: { url(): string }) => { if (!isStream(r.url())) pending = Math.max(0, pending - 1); };
  page.on("request", onStart);
  page.on("requestfinished", onEnd);
  page.on("requestfailed", onEnd);
  const deadline = Date.now() + timeoutMs;
  let quietSince = Date.now();
  try {
    while (Date.now() < deadline) {
      if (pending > 0) quietSince = Date.now();
      else if (Date.now() - quietSince >= quietMs) return;
      await page.waitForTimeout(50);
    }
  } catch { /* หน้าถูกปิดระหว่างรอ — ไม่ใช่ความผิดพลาด */ }
  finally {
    page.off("request", onStart);
    page.off("requestfinished", onEnd);
    page.off("requestfailed", onEnd);
  }
}

export { RYG, CNX, ADMIN };

// เปิดฟอร์ม "สร้างใบเสนอราคาใหม่" — ตอนนี้อยู่ในแผงรายละเอียดลูกค้าเป้าหมาย (แท็บใบเสนอราคา)
// wizard เดิมบนหน้า /quotations ถูกลบทั้งฟีเจอร์ → ตัวแทนออกใบจากลูกค้าเป้าหมายเท่านั้น
export async function openLeadQuotationForm(page: Page, opts?: { ใบใหม่เท่านั้น?: boolean }) {
  await open(page, "dealer", "/leads");
  await page.getByRole("button", { name: "ตาราง" }).click(); // ค่าเริ่มต้น=บอร์ด → สลับเป็นตาราง

  // ⚠️ ลูกค้าเป้าหมายแถวแรกอาจ "มีใบเสนอราคาอยู่แล้ว" (หนึ่งดีล = ใบเดียว → ปุ่มกลายเป็น "เพิ่มรายการในใบเดิม")
  //    เทสต์ที่ต้องการ "ใบที่เพิ่งสร้างใหม่" จะได้ใบเก่ามาแทน แล้วตกแบบงง ๆ (เจอจริง 21 ส.ค. 69:
  //    ไปแก้ใบ ZZTEST-BASE-Q-RYG-6 ซึ่งวันที่ออกเป็นของเดิม ไม่ใช่วันนี้ — ถูกต้องแล้วแต่ไม่ใช่สิ่งที่วัด)
  //    ตัวเลือกนี้จึงไล่หาแถวที่ยังไม่มีใบจริง ๆ ก่อน
  const เปิดแถว = async (i: number) => {
    await page.getByRole("button", { name: "ดูรายละเอียด" }).nth(i).click();
    await page.getByRole("button", { name: "ใบเสนอราคา", exact: true }).first().click();
  };
  if (opts?.ใบใหม่เท่านั้น) {
    const จำนวนแถว = Math.min(await page.getByRole("button", { name: "ดูรายละเอียด" }).count(), 10);
    let เจอ = false;
    for (let i = 0; i < จำนวนแถว; i++) {
      await เปิดแถว(i);
      if (await page.getByRole("button", { name: "สร้างใบเสนอราคา", exact: true }).count() > 0) { เจอ = true; break; }
      await page.keyboard.press("Escape");   // ปิดแผงแล้วลองแถวถัดไป
      await page.waitForTimeout(200);
    }
    if (!เจอ) throw new Error("หาลูกค้าเป้าหมายที่ยังไม่มีใบเสนอราคาไม่เจอใน 10 แถวแรก");
  } else {
    await เปิดแถว(0);
  }

  // ── กติกา 20 ส.ค. 69: หนึ่งดีล = ใบเสนอราคาใบเดียว ──────────────────────────
  // ลูกค้าเป้าหมายที่ยังไม่มีใบ → ปุ่มเขียนว่า "สร้างใบเสนอราคา" (เข้าฟอร์มออกใบใหม่)
  // ลูกค้าเป้าหมายที่มีใบที่ยังแก้ได้ → ปุ่มเขียนว่า "เพิ่มรายการในใบเสนอราคา" (เข้าฟอร์มแก้ใบเดิม)
  // เทสต์ที่แค่ "ขอให้ได้ฟอร์มใบเสนอราคา" จึงต้องรับได้ทั้งสองทาง
  await page.getByRole("button", { name: /(สร้าง|เพิ่มรายการใน)ใบเสนอราคา/ }).first().click();
  await expect(page.getByText(/สร้างใบเสนอราคาใหม่|^แก้ไข /)).toBeVisible();

  // BOQ ต้องมีอย่างน้อย 1 รายการ ปุ่มบันทึกถึงจะกดได้
  //   ลูกค้าเป้าหมายบางรายตั้งต้นไม่ได้ (แม่แบบไม่ตรงแคตตาล็อก / ยังไม่มีราคากลาง / ไม่ได้กรอกพื้นที่)
  //   ตอนนี้ปุ่มเลือกจากแคตตาล็อกเปิดไว้เสมอแล้ว จึงเติมเองได้ ไม่ต้องพึ่งว่าลูกค้าเป้าหมายใบไหนถูกหยิบมา
  const ราคาต่อหน่วย = page.getByLabel("ราคาต่อหน่วย");
  if (await ราคาต่อหน่วย.count() === 0) {
    await page.getByRole("button", { name: /เลือกจากแคตตาล็อก/ }).click();
    await page.locator("button").filter({ hasText: /฿[\d,]+\/\S+/ }).first().click();
    await expect(ราคาต่อหน่วย.first()).toBeVisible({ timeout: 10_000 });
  }
}

// ตรวจหน้าโหลดสมบูรณ์: มีหัวข้อ h2 + ไม่มี uncaught error + ไม่มี body เลื่อนแนวนอน
export async function assertHealthyPage(page: Page, label: string) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  await expect(page.locator("h1, h2, h3").first(), `${label} ควรมีหัวข้อหน้า`).toBeVisible({ timeout: 12_000 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${label} ไม่ควรมี horizontal scroll (เกิน ${overflow}px)`).toBeLessThanOrEqual(3);
  expect(errors, `${label} ไม่ควรมี JS error`).toEqual([]);
}
