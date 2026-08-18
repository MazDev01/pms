import { expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON, type Account, appEnv } from "./supabaseEnv";
import { SESSION_KEY, getSession, settle } from "./helpers";

export const DEALER_ORIGIN = "http://localhost:3001";
export const HQ_ORIGIN = "http://localhost:3002";

// เสียงรบกวนที่ไม่ใช่ error ของแอป
const NOISE = /favicon|hydrat|Download the React DevTools|Fast Refresh|preloaded using link preload/i;

/** เฝ้า error ของหน้า — ทุกเทสต์เชิงฟังก์ชันควรเรียก เพื่อจับของที่พังเงียบระหว่างกด */
export function watchErrors(page: Page): string[] {
  const errs: string[] = [];
  page.on("pageerror", e => errs.push(`[pageerror] ${e.message}`));
  page.on("console", m => { if (m.type() === "error") errs.push(`[console] ${m.text().slice(0, 200)}`); });
  page.on("response", r => {
    if (r.status() >= 400 && !/favicon/.test(r.url())) errs.push(`[http ${r.status()}] ${r.url().slice(0, 140)}`);
  });
  return errs;
}
export function assertNoErrors(errs: string[], label: string) {
  const real = errs.filter(e => !NOISE.test(e));
  expect(real, `${label} ต้องไม่มี error`).toEqual([]);
}

// ── เข้าสู่ระบบ: ใช้สิทธิ์เดิมซ้ำ ไม่ล็อกอินใหม่ทุกเทสต์ ────────────────────────────
//
// ปัญหาที่แก้ (ยืนยันจากบันทึกการรันเต็ม 7 ส.ค. 69):
//   เดิมทุกเทสต์พิมพ์อีเมล+รหัสผ่านแล้วกดปุ่มจริง — 55 จุดเรียก × รันขนาน 3 ช่องทาง ใน 8 นาที
//   จำนวนคำขอล็อกอินทะลุเพดานของ Supabase Auth แล้วโดนปฏิเสธ:
//     ล็อกอินรอบที่ 1 ไม่ผ่าน (["Request rate limit reached"]) — ลองใหม่
//   ผลที่ตามมาไม่ได้หยุดแค่ "ช้าลง": ถ้าสิทธิ์เข้าถึงไม่สมบูรณ์ ฐานข้อมูลจะคืน "ไม่มีแถว" เงียบ ๆ
//   (RLS กรองออกหมดโดยไม่ถือเป็น error) → เทสต์ตกด้วยข้อความ "หาข้อมูลไม่เจอ" ที่ชี้ไปผิดทางสนิท
//   อาการที่ค้างคาที่สุดคือ "ใบเสนอราคาที่เพิ่งหาเจอ หายไปใน 5 วินาที" ซึ่งอธิบายได้ด้วยเรื่องนี้
//
// วิธีแก้: ล็อกอินครั้งเดียวต่อบัญชี (ผ่าน API) แล้วยัด session เดิมให้ทุกเทสต์ใช้ซ้ำ
//   เป็นวิธีเดียวกับที่ helpers.ts (openAs) ใช้อยู่แล้วและไม่เคยมีปัญหา
//   ถ้ายัดแล้วแอปไม่ยอมรับ (ยังอยู่หน้าล็อกอิน) จะตกกลับไปล็อกอินผ่านหน้าจอจริงเหมือนเดิม
const HOME_AFTER_LOGIN: Record<string, string> = { "/login": "/dashboard", "/hq/login": "/hq/dashboard" };
// โหมด api เก็บใบผ่านใน cookie httpOnly (ระยะ 4) — เทสต์ต้องล็อกอินผ่าน backend
const COOKIE_AUTH = appEnv("NEXT_PUBLIC_DATA_SOURCE") === "api";

export async function loginUI(page: Page, origin: string, path: string, who: Account) {
  // ระยะ 4: โหมด api เก็บใบผ่านใน cookie httpOnly — ยัด session ลง localStorage ไม่มีผลอีกต่อไป
  // ต้องล็อกอินผ่าน backend จริงเหมือนผู้ใช้ (เหตุผลเดียวกับ openAs ใน helpers.ts)
  if (COOKIE_AUTH) {
    const res = await page.context().request.post(`${origin}/api/v1/auth?op=login`, {
      data: { email: who.email, password: who.password },
    });
    if (!res.ok()) throw new Error(`ล็อกอิน ${who.email} ผ่าน backend ไม่ผ่าน: ${res.status()} ${await res.text()}`);
    await page.goto(`${origin}${HOME_AFTER_LOGIN[path] ?? path}`, { waitUntil: "domcontentloaded" });
    await settle(page);
    return;
  }
  try {
    const session = await getSession(who);
    await page.addInitScript(({ key, session }) => {
      localStorage.setItem(key as string, JSON.stringify(session));
    }, { key: SESSION_KEY, session });
    await page.goto(`${origin}${HOME_AFTER_LOGIN[path] ?? path}`, { waitUntil: "domcontentloaded" });
    await settle(page);
    if (!page.url().includes("/login")) return;
  } catch { /* ยัด session ไม่สำเร็จ → ล็อกอินผ่านหน้าจอจริงข้างล่าง */ }

  await page.goto(`${origin}${path}`, { waitUntil: "domcontentloaded" });
  await settle(page);
  const email = page.getByLabel(/อีเมล/i).first();
  const pass = page.getByLabel(/รหัสผ่าน/i).first();
  for (let attempt = 1; attempt <= 3; attempt++) {
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
  }
  throw new Error(`ล็อกอินไม่ผ่าน (${who.email})`);
}

// ── ฝั่ง DB: ใช้ยืนยันว่าสิ่งที่กดบนหน้าจอ "ลงฐานข้อมูลจริง" ไม่ใช่แค่ขึ้นบนจอ ──
// ใช้ client เดิมซ้ำต่อบัญชี — ล็อกอินใหม่ทุกครั้งจะโดน rate limit ของ Supabase Auth
const clients = new Map<string, Promise<SupabaseClient>>();
export function db(who: Account): Promise<SupabaseClient> {
  const cached = clients.get(who.email);
  if (cached) return cached;
  const p = (async () => {
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await sb.auth.signInWithPassword(who);
    if (error) throw new Error(`ล็อกอิน DB ${who.email} ไม่ผ่าน: ${error.message}`);
    return sb;
  })();
  clients.set(who.email, p);
  return p;
}

/** รอจนแถวโผล่ใน DB — การเขียนผ่าน UI เป็น async ต้องรอ ไม่ใช่เช็คทันที
 *  ค่าเริ่มต้น 25s: เทสต์ทั้งชุดรันหลาย worker ถล่ม dev server ตัวเดียวที่คอมไพล์ route ครั้งแรกไปด้วย
 *  การเขียน optimistic → propagate ถึง DB จึงช้าเป็นครั้งคราว · 15s เดิมตึงเกินตอนรันขนานเต็มชุด
 *  (เป็น latency ของสภาพทดสอบ ไม่ใช่บั๊ก · ตัว test มี budget 180–240s เหลือเฟือ) */
export async function waitRow<T = Record<string, unknown>>(
  sb: SupabaseClient, table: string, match: Record<string, unknown>, timeoutMs = 25_000,
): Promise<T> {
  const started = Date.now();
  let last: unknown = null;
  while (Date.now() - started < timeoutMs) {
    const { data, error } = await sb.from(table).select("*").match(match).limit(1);
    if (error) last = error;
    if (data && data.length) return data[0] as T;
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`ไม่พบแถวใน ${table} ที่ ${JSON.stringify(match)} ภายใน ${timeoutMs}ms · ${JSON.stringify(last)}`);
}

/** รอจนแถวหายจาก DB (ใช้ตอนทดสอบการลบ) */
export async function waitGone(
  sb: SupabaseClient, table: string, match: Record<string, unknown>, timeoutMs = 15_000,
): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const { data } = await sb.from(table).select("*").match(match).limit(1);
    if (!data || !data.length) return;
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`แถวใน ${table} ที่ ${JSON.stringify(match)} ยังไม่ถูกลบภายใน ${timeoutMs}ms`);
}

/** ป้ายกำกับของข้อมูลทดสอบ — ใช้ค้นหาและกวาดทิ้งได้แน่นอน */
// TAG = คำนำหน้าร่วมของ "ทุก" ข้อมูลทดสอบ — สวีปทั้งหมดได้ด้วย %ZZTEST%
export const TAG = "ZZTEST";
export const tagged = (s: string) => `${TAG}-${s}`;

// ⚠️ ทุกสเปก func-* รันกับ RYG ตัวจริงตัวเดียวกัน และ playwright รันหลายไฟล์ขนานกัน (workers>1)
//   ถ้าใช้ tag ร่วม "ZZTEST" แล้ว cleanup ลบตาม tag นั้น → สเปกหนึ่งจะลบข้อมูลของอีกสเปก
//   ที่กำลังรันอยู่กลางคัน (func-dealer-sales เขียนคอมเมนต์เตือนไว้เอง)
//   → แต่ละสเปกต้องมี "ช่องของตัวเอง": specNS("APPT") = "ZZTEST-APPT" แล้วตั้งชื่อข้อมูลใต้ช่องนั้น
//     cleanup(sb, dealer, ns) จะลบเฉพาะ %ZZTEST-APPT% ไม่แตะของสเปกอื่น (ยัง sweep รวมด้วย %ZZTEST% ได้)
//
// ── ยังไม่พอ: ต้องแยก "ต่อ worker" ด้วย ────────────────────────────────────────
// ยืนยันจากบันทึกการรันเต็ม 7 ส.ค. 69 (ใส่ตัวเก็บหลักฐานไว้ในเทสต์แล้วดักได้):
//   ใบ Q-RYG-2026-1621 ถูกสร้างและหาเจอแล้ว · 5 วินาทีถัดมาค้นด้วยเลขที่ตรง ๆ ได้ [] error null
//   แต่ "อ่านใบใดก็ได้ในสาขา" ยังได้ 1 แถว → สิทธิ์เข้าถึงปกติดี ใบถูกลบออกจากฐานข้อมูลจริง
//
// ที่มา: เทสต์ตกรอบแรก → Playwright ทิ้ง worker นั้นแล้วเปิดตัวใหม่มารันซ้ำ
//   worker ที่ถูกทิ้งจะยิง afterAll (= cleanup ลบทุกอย่างใต้ช่องของสเปก) ระหว่างที่รอบรันซ้ำ
//   สร้างข้อมูลใหม่ใต้ "ช่องเดียวกัน" อยู่พอดี → ของรอบใหม่โดนลบตามไปด้วย แล้วตกซ้ำอีกครั้ง
//   (ตระกูลเดียวกับบั๊ก fullyParallel ที่เคยเจอ — ตัวเก็บกวาดวิ่งไล่ตามงานที่ยังทำอยู่)
//
// แก้: ผูกชื่อช่องกับหมายเลข worker · Playwright ให้เลขใหม่กับ worker ที่เปิดมารันซ้ำเสมอ
//   cleanup ของ worker เก่าจึงหาข้อมูลของ worker ใหม่ไม่เจอ ลบไม่โดนกัน
//   ของตกค้างข้าม worker ยังถูกกวาดด้วย %ZZTEST% ที่ global-teardown ตอนจบชุดอยู่ดี
const WORKER = process.env.TEST_WORKER_INDEX ?? "0";
export const specNS = (name: string) => `${TAG}-${name}-W${WORKER}`;
export const nsTag = (ns: string) => (s: string) => `${ns}-${s}`;

/** กวาดข้อมูลทดสอบทิ้งทุกตาราง — เรียกทั้งก่อนและหลังชุดเทสต์ · tag = ช่องของสเปก (ค่าเริ่มต้น = ร่วม) */
export async function cleanup(sb: SupabaseClient, dealerCode: string, tag: string = TAG) {
  await sb.from("customer_notes").delete().like("title", `%${tag}%`);
  await sb.from("quotations").delete().eq("dealer_code", dealerCode).like("customer", `%${tag}%`);
  await sb.from("quotations").delete().eq("dealer_code", dealerCode).like("id", `%${tag}%`);
  // appointments ไม่มีคอลัมน์ customer (ของจริงคือ company/province)
  // เดิมสั่งลบด้วย customer → PostgREST ตอบ error เงียบ ๆ แถวทดสอบเก่าจึงค้างสะสม
  // แล้วทำให้เทสต์รอบถัดไปไปเจอแถวเก่าแทนแถวที่เพิ่งสร้าง (เคยหลงคิดว่าโค้ดออกเลขผิด)
  await sb.from("appointments").delete().eq("dealer_code", dealerCode).like("company", `%${tag}%`);
  await sb.from("appointments").delete().eq("dealer_code", dealerCode).like("province", `%${tag}%`);
  await sb.from("customers").delete().eq("dealer_code", dealerCode).like("company", `%${tag}%`);
  await sb.from("leads").delete().eq("dealer_code", dealerCode).like("company", `%${tag}%`);
  await sb.from("leads").delete().like("id", `%${tag}%`);
  // ไฟล์ทดสอบ: ลบทั้งแถวใน DB และไบต์ใน Storage (ชื่อไฟล์ทดสอบมี tag)
  //   เดิม cleanup ไม่แตะตาราง files → แถวเก่าสะสมข้ามรัน แล้ว waitRow(files) ไปเจอแถวเก่า
  //   ที่ไบต์ถูก afterAll รอบก่อนลบไปแล้ว → signedUrl ล้ม (เทสต์ happy path แกว่งแบบสุ่ม)
  const { data: testFiles } = await sb.from("files").select("id,storage_path")
    .eq("dealer_code", dealerCode).like("name", `%${tag}%`);
  for (const tf of testFiles ?? []) {
    if (tf.storage_path) await sb.storage.from("dealer-files").remove([tf.storage_path as string]);
    await sb.from("files").delete().eq("id", tf.id);
  }
}

// ── กรอกฟอร์ม "เพิ่มตัวแทน" ของหน้าทะเบียนตัวแทน ──────────────────────────────────
//
// ⚠️ ทำไมต้องรวมไว้ที่เดียว (7 ส.ค. 69 แก้ 10 ส.ค. 69):
//   ช่องจังหวัดเคยเป็นช่องพิมพ์อิสระ แล้วเปลี่ยนเป็น "เลือกจากรายการที่ผูกกับภาค"
//   เพื่อกันข้อมูลขัดกันเอง (ภาค "ใต้" + จังหวัด "เชียงใหม่")
//   แต่เทสต์ 2 ไฟล์ยังพิมพ์ใส่ช่องเดิมอยู่ → ตกทั้งคู่ และเสียเวลาไล่หาว่าโค้ดพังตรงไหน
//   ทั้งที่โค้ดถูก เทสต์ต่างหากที่ตามไม่ทัน
//   รวมไว้ที่เดียว = ฟอร์มเปลี่ยนอีกก็แก้จุดเดียว ไม่ต้องไล่หาว่ามีที่ไหนอีกบ้าง
//
// ⚠️ ต้องเลือก "ภาค" ก่อนเสมอ — รายการจังหวัดขึ้นกับภาคที่เลือกไว้
//   เลือกจังหวัดที่ไม่ได้อยู่ในภาคนั้นจะไม่มีตัวเลือกให้เลย
export async function fillDealerForm(
  page: Page, code: string, name: string,
  province = "ระยอง", region = "ตะวันออก",
) {
  await page.getByPlaceholder("เช่น BKK").fill(code);
  await page.getByPlaceholder("บจ. ตัวอย่างสตีล...").fill(name);
  // ⚠️ ต้องใส่ exact — บนหน้าเดียวกันมีตัวกรอง "กรองตามภูมิภาค" อยู่ที่แถบเครื่องมือด้วย
  //   ถ้าไม่ระบุให้ตรงเป๊ะ จะเจอสองตัวแล้วไม่ยอมทำงาน (strict mode)
  await page.getByLabel("ภูมิภาค", { exact: true }).selectOption(region);
  await page.getByLabel("จังหวัดที่ตั้ง", { exact: true }).selectOption(province);
}

/** เลือก "แม่แบบจริงตัวแรก" ในช่องแม่แบบ
 *
 *  ⚠️ ห้ามใช้ selectOption({ index: 0 }) กับช่องนี้ (บทเรียน 10 ส.ค. 69)
 *    ตัวเลือกลำดับแรกคือ "— ยังไม่ระบุแม่แบบ —" ซึ่งมีไว้ให้ค่าว่างมีที่ยืน
 *    (ถ้าไม่มี เบราว์เซอร์จะโชว์แม่แบบตัวแรกทั้งที่ค่าจริงว่าง = จอโกหก)
 *    เลือกตำแหน่ง 0 จึงเท่ากับ "ไม่เลือกแม่แบบ" → ตารางรายการว่าง → ออกใบเสนอราคาไม่ได้
 *    แล้วเทสต์จะตกด้วยอาการที่ไม่เกี่ยวกับสิ่งที่มันตั้งใจตรวจเลย
 *  เลือกด้วย "ความหมาย" แทนตำแหน่ง — เพิ่ม/ลด/สลับตัวเลือกทีหลังก็ยังใช้ได้
 */
export async function pickTemplate(page: Page, label = "แม่แบบ") {
  const sel = page.getByLabel(label).first();
  // ⚠️ ต้องรอให้แคตตาล็อกมาถึงก่อน — ตอนเปิดฟอร์มใหม่ ๆ ในช่องมีแต่ "ยังไม่ระบุ" ตัวเดียว
  //   เลือกทันทีจะได้ค่าว่าง แล้วเทสต์ปลายทางจะตกด้วยอาการที่ไม่เกี่ยวกับสิ่งที่มันตรวจ
  await expect.poll(
    async () => sel.evaluate(el => [...(el as HTMLSelectElement).options].filter(o => o.value !== "").length),
    { timeout: 20_000, message: "ต้องมีแม่แบบจริงให้เลือกอย่างน้อย 1 ตัว" },
  ).toBeGreaterThan(0);
  const value = await sel.evaluate(el =>
    [...(el as HTMLSelectElement).options].map(o => o.value).find(v => v !== "") ?? "");
  await sel.selectOption(value);
}
