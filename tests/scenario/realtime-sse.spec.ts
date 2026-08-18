import { test, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON, RYG, CNX, appEnv, skipReason, type Account } from "./supabaseEnv";
import { HQ_ORIGIN } from "./funcHelpers";

// ── ระยะ 3 · สายอัปเดตสดที่วิ่งผ่าน backend ของเราเอง (SSE) ────────────────────────
//
// โหมด api เบราว์เซอร์ไม่ต่อ WebSocket ไปหาฐานข้อมูลเองแล้ว — เซิร์ฟเวอร์ต่อแทนในนามผู้ใช้
// แล้วส่งต่อลงมาทาง /api/v1/events
//
// ⚠️ ข้อที่สำคัญที่สุดคือข้อ 2 (การกันข้ามสาขา):
//    ถ้าเซิร์ฟเวอร์ลืมบอก realtime ว่า "นี่คือใคร" (realtime.setAuth) ช่องจะต่อแบบไม่มีตัวตน
//    ผลที่เป็นไปได้มีสองแบบ และแบบที่สองคือหายนะ:
//      ก) ไม่ได้รับอะไรเลย — เห็นชัด แก้ง่าย
//      ข) ได้รับของทุกสาขา — หน้าจอดูปกติทุกอย่าง แต่ข้อมูลสาขาอื่นรั่วมาถึงเครื่องผู้ใช้
//    จึงต้องมีเทสต์ที่ "รอแล้วยืนยันว่าไม่มีอะไรมา" ไม่ใช่แค่เทสต์ว่าของมาถึง
const API_MODE = appEnv("NEXT_PUBLIC_DATA_SOURCE") === "api";
test.skip(() => skipReason() !== "", skipReason() || "พร้อมรัน");
test.skip(() => !API_MODE, "สายนี้มีเฉพาะโหมด api (โหมด supabase เบราว์เซอร์ต่อ WebSocket เอง)");
test.setTimeout(90_000);

const TAG = "ZZTEST-SSE";

async function signIn(who: Account): Promise<SupabaseClient> {
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await sb.auth.signInWithPassword(who);
  if (error) throw new Error(`ล็อกอิน ${who.email} ไม่ผ่าน: ${error.message}`);
  return sb;
}
const tokenOf = async (sb: SupabaseClient) => (await sb.auth.getSession()).data.session?.access_token ?? "";

/** เปิดสาย /api/v1/events แล้วเก็บ event ที่ได้ · คืนตัวปิดสายและกล่องเก็บของ */
async function openStream(token: string) {
  const events: string[] = [];
  const ac = new AbortController();
  const res = await fetch(`${HQ_ORIGIN}/api/v1/events`, {
    headers: { authorization: `Bearer ${token}` }, signal: ac.signal,
  });
  expect(res.status, "สายต้องเปิดได้").toBe(200);
  expect(res.headers.get("content-type") ?? "", "ต้องเป็นสายแบบ SSE").toContain("text/event-stream");

  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  void (async () => {
    let buf = "";
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n"); buf = parts.pop() ?? "";
        for (const p of parts) {
          const line = p.split("\n").find(l => l.startsWith("data:"));
          if (line) events.push(line.slice(5).trim());
        }
      }
    } catch { /* ปิดสายตามปกติ */ }
  })();

  // รอให้ช่องสมัครเสร็จก่อน — ไม่งั้นแทรกข้อมูลไปตอนที่ยังไม่มีใครฟัง แล้วสรุปผิดว่า "ไม่มาเลย"
  await expect.poll(() => events.some(e => e.includes('"ready"')), { timeout: 15_000 }).toBe(true);
  await new Promise(r => setTimeout(r, 1_500));
  return { events, close: () => ac.abort() };
}

/** สร้างลูกค้าของสาขาหนึ่ง แล้วคืนตัวลบ */
async function makeCustomer(sb: SupabaseClient, dealer: string, label: string) {
  const id = Number((await sb.rpc("next_entity_id", { p_dealer: dealer, p_entity: "customers" })).data);
  const company = `${TAG} ${label}`;
  const ins = await sb.from("customers").insert({ id, dealer_code: dealer, company, name: company }).select();
  expect(ins.error, `สร้างลูกค้าทดสอบไม่ได้: ${JSON.stringify(ins.error)}`).toBeNull();
  return { id, company, remove: () => sb.from("customers").delete().eq("id", id).eq("dealer_code", dealer) };
}

test("[sse] ข้อมูลเปลี่ยนที่ฐานข้อมูล → เบราว์เซอร์ได้รับสัญญาณผ่าน backend ของเราเอง", async () => {
  const ryg = await signIn(RYG);
  const s = await openStream(await tokenOf(ryg));
  const cust = await makeCustomer(ryg, "RYG", "สัญญาณมาถึง");
  try {
    await expect
      .poll(() => s.events.filter(e => e.includes('"ch":"sales"') && e.includes(String(cust.id))).length,
        { timeout: 20_000, message: "ต้องได้รับสัญญาณงานขายของสาขาตัวเอง" })
      .toBeGreaterThan(0);
  } finally {
    s.close();
    await cust.remove();
  }
});

test("[sse] สาขาอื่นเปลี่ยนข้อมูล → ต้องไม่หลุดมาถึงสายของเรา (RLS ยังบังคับเหมือนเดิม)", async () => {
  const cnx = await signIn(CNX);
  const ryg = await signIn(RYG);
  const s = await openStream(await tokenOf(cnx));       // ฟังในนาม CNX
  const cust = await makeCustomer(ryg, "RYG", "ห้ามรั่วข้ามสาขา");  // แต่ RYG เป็นคนเขียน
  try {
    // ต้อง "รอแล้วยืนยันว่าไม่มา" — ถ้าเช็คทันทีจะผ่านเพราะยังมาไม่ถึง ไม่ใช่เพราะถูกกัน
    await new Promise(r => setTimeout(r, 8_000));
    const leaked = s.events.filter(e => e.includes(String(cust.id)) || e.includes(cust.company));
    expect(leaked, `สัญญาณของสาขาอื่นต้องไม่หลุดมา — ได้: ${JSON.stringify(leaked).slice(0, 300)}`).toEqual([]);
  } finally {
    s.close();
    await cust.remove();
  }
});

test("[sse] ไม่มีใบผ่าน → เปิดสายไม่ได้", async () => {
  const res = await fetch(`${HQ_ORIGIN}/api/v1/events`);
  expect(res.status, "ไม่มีใบผ่านต้องถูกปฏิเสธ").toBe(401);
  await res.body?.cancel();
});
