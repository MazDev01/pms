import { expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON, type Account } from "./supabaseEnv";

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

/** ล็อกอินผ่านหน้าจอจริง — กรอกหลัง hydrate เท่านั้น ไม่งั้น controlled input ถูกล้างแล้วส่งฟอร์มเปล่า */
export async function loginUI(page: Page, origin: string, path: string, who: Account) {
  await page.goto(`${origin}${path}`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
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
export const specNS = (name: string) => `${TAG}-${name}`;
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
