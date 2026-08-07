import { Page, expect } from "@playwright/test";
import { createClient, type Session } from "@supabase/supabase-js";
import { RYG, CNX, ADMIN, SUPABASE_URL, SUPABASE_ANON, SUPABASE_MODE, type Account } from "./supabaseEnv";

// สลับ role ก่อนโหลดหน้า (RoleProvider อ่านจาก localStorage ตอน mount) — ใช้ได้เฉพาะโหมด local mock data
export async function loginAs(page: Page, role: "hq" | "dealer") {
  await page.addInitScript((r) => {
    localStorage.setItem("pms_session_key", r as string);
    localStorage.setItem("pms_logged_in", "true");
  }, role);
}

// ── โหมด supabase: ยัด session จริงลง sessionStorage ตรงๆ แทนล็อกอินผ่านหน้าจอทุกเทสต์ ──
// เร็วกว่ามาก (ไม่ต้องรอ UI) และไม่ชน rate limit ของ Supabase Auth (เข้าสู่ระบบครั้งเดียวต่อบัญชี
// แล้ว cache ไว้ใช้ซ้ำได้ตลอดการรัน — เทียบกับเดิมที่ล็อกอินผ่านหน้าจอทุกเทสต์)
// ⚠️ ต้องเป็น sessionStorage ไม่ใช่ localStorage — client.ts เปลี่ยนมาใช้ sessionStorage แล้ว
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
// role ทั่วไปแมปกับบัญชีจริงบัญชีเดียว (RYG/ADMIN) — เทสต์ที่ต้องเจาะจงบัญชีอื่น (เช่น CNX สำหรับ
// branch-isolation.spec.ts) ใช้ openAs() แทน
const ROLE_ACCOUNT: Record<"hq" | "dealer", Account> = { hq: ADMIN, dealer: RYG };

/** เปิดหน้าแบบล็อกอินจริง (โหมด supabase) หรือจำลอง role (โหมด local) ตามที่แอปตั้งค่าไว้ */
export async function open(page: Page, role: "hq" | "dealer", path: string) {
  if (SUPABASE_MODE) return openAs(page, ROLE_ACCOUNT[role], role, path);
  await loginAs(page, role);
  await page.goto(APP_ORIGIN[role] + path, { waitUntil: "domcontentloaded" });
}

/** เปิดหน้าด้วยบัญชีจริงที่ระบุเจาะจง (เช่น CNX สำหรับเทสต์ตรวจการกันข้ามสาขา) */
export async function openAs(page: Page, who: Account, appRole: "hq" | "dealer", path: string) {
  const session = await getSession(who);
  await page.addInitScript(({ key, session }) => {
    sessionStorage.setItem(key, JSON.stringify(session));
  }, { key: SESSION_KEY, session });
  await page.goto(APP_ORIGIN[appRole] + path, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
}

export { RYG, CNX, ADMIN };

// เปิดฟอร์ม "สร้างใบเสนอราคาใหม่" — ตอนนี้อยู่ในแผงรายละเอียดลูกค้าเป้าหมาย (แท็บใบเสนอราคา)
// wizard เดิมบนหน้า /quotations ถูกลบทั้งฟีเจอร์ → ตัวแทนออกใบจากลีดเท่านั้น
export async function openLeadQuotationForm(page: Page) {
  await open(page, "dealer", "/leads");
  await page.getByRole("button", { name: "ตาราง" }).click(); // ค่าเริ่มต้น=บอร์ด → สลับเป็นตาราง
  await page.getByRole("button", { name: "ดูรายละเอียด" }).first().click();
  await page.getByRole("button", { name: "ใบเสนอราคา", exact: true }).first().click();
  await page.getByRole("button", { name: "สร้างใบเสนอราคา" }).first().click();
  await expect(page.getByText("สร้างใบเสนอราคาใหม่")).toBeVisible();
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
