import { test, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import path from "node:path";

// กฎความปลอดภัยที่ "มีจริงเฉพาะโหมด supabase" — RLS / สิทธิ์เขียน / FK / ตัวนับเลขที่ (M5)
//
// ทำไมไม่ทดสอบผ่านหน้าจอ: กฎพวกนี้บังคับที่ฐานข้อมูล ไม่ใช่ที่ UI
// การกดผ่านหน้าจอพิสูจน์ได้แค่ว่า "ปุ่มไม่โผล่" ซึ่งข้ามได้ด้วยการยิง API ตรง
// ชุดนี้จึงล็อกอินด้วยบัญชีจริงแล้วยิง PostgREST ตรง ๆ เหมือนผู้ไม่หวังดีจะทำ
//
// ตารางงานขายบน DB จริงยังว่าง (ไม่ยัด mock ลงของจริง) → เทสต์ที่ต้องมีข้อมูล
// จะสร้างแถวของตัวเองแล้วลบทิ้งเสมอ ไม่งั้นจะ "ผ่านเพราะไม่มีอะไรให้เจอ" ซึ่งไม่ได้พิสูจน์อะไรเลย

function env(key: string): string {
  try {
    const raw = readFileSync(path.join(__dirname, "../../apps/dealer/.env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const i = line.indexOf("=");
      if (i > 0 && line.slice(0, i).trim() === key) return line.slice(i + 1).trim();
    }
    return "";
  } catch { return ""; }
}

const URL = env("NEXT_PUBLIC_SUPABASE_URL");
const ANON = env("NEXT_PUBLIC_SUPABASE_ANON_KEY");

test.skip(env("NEXT_PUBLIC_DATA_SOURCE") !== "supabase" || !URL || !ANON,
  "ข้ามเพราะแอปตั้งเป็นโหมด local (ชุดนี้ทดสอบกฎที่ฐานข้อมูลจริง)");

const RYG   = { email: "sales@rayongsteel.co.th",  password: "PEB-RYG-4821" };
const CNX   = { email: "sales@cmsteelbuild.co.th", password: "PEB-CNX-3317" };
const ADMIN = { email: "admin@benjamin.com",       password: "benjamin" };

async function signIn(who: { email: string; password: string }): Promise<SupabaseClient> {
  const sb = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await sb.auth.signInWithPassword(who);
  if (error) throw new Error(`ล็อกอิน ${who.email} ไม่ผ่าน: ${error.message}`);
  return sb;
}

// PostgREST ปฏิเสธการเขียนที่ผิด RLS ได้สองแบบ: ตอบ error ตรง ๆ หรือเงียบแล้วไม่มีแถวถูกแตะ
// ทั้งสองแบบถือว่า "กันได้" — แต่ "สำเร็จและมีแถวเปลี่ยน" คือรั่ว
function wasBlocked(res: { error: unknown; data: unknown }): boolean {
  if (res.error) return true;
  return Array.isArray(res.data) ? res.data.length === 0 : res.data == null;
}

const lead = (id: string, dealer: string) => ({
  id, dealer_code: dealer, company: `เทสต์อัตโนมัติ ${id}`, status: "WAITING",
});

test("[rls] แต่ละสาขาเห็นเฉพาะลีดของตัวเอง · HQ เห็นทั้งสองสาขา", async () => {
  const ryg = await signIn(RYG);
  const cnx = await signIn(CNX);
  const hq  = await signIn(ADMIN);
  const idR = "TEST-RLS-RYG", idC = "TEST-RLS-CNX";
  const both = [idR, idC];

  try {
    // สร้างลีดจริงคนละสาขา — ถ้าสร้างไม่ได้ ทั้งเทสต์ไม่มีความหมาย จึงต้องฟ้องทันที
    const insR = await ryg.from("leads").insert(lead(idR, "RYG")).select();
    const insC = await cnx.from("leads").insert(lead(idC, "CNX")).select();
    expect(insR.error, `RYG สร้างลีดของตัวเองไม่ได้: ${JSON.stringify(insR.error)}`).toBeNull();
    expect(insC.error, `CNX สร้างลีดของตัวเองไม่ได้: ${JSON.stringify(insC.error)}`).toBeNull();

    const seen = async (sb: SupabaseClient) =>
      ((await sb.from("leads").select("id").in("id", both)).data ?? []).map(r => r.id).sort();

    expect(await seen(ryg), "RYG ต้องเห็นเฉพาะลีดของ RYG").toEqual([idR]);
    expect(await seen(cnx), "CNX ต้องเห็นเฉพาะลีดของ CNX").toEqual([idC]);
    expect(await seen(hq),  "HQ ต้องเห็นลีดของทั้งสองสาขา").toEqual([idC, idR].sort());
  } finally {
    await ryg.from("leads").delete().eq("id", idR);
    await cnx.from("leads").delete().eq("id", idC);
  }
});

test("[rls] ตัวแทนแก้/ลบลีดของสาขาอื่นไม่ได้", async () => {
  const ryg = await signIn(RYG);
  const cnx = await signIn(CNX);
  const id = "TEST-RLS-CROSS";
  try {
    expect((await cnx.from("leads").insert(lead(id, "CNX")).select()).error).toBeNull();

    const edited = await ryg.from("leads").update({ company: "โดนแก้ข้ามสาขา" }).eq("id", id).select();
    expect(wasBlocked(edited), "RYG ต้องแก้ลีดของ CNX ไม่ได้").toBe(true);

    const deleted = await ryg.from("leads").delete().eq("id", id).select();
    expect(wasBlocked(deleted), "RYG ต้องลบลีดของ CNX ไม่ได้").toBe(true);

    // ของจริงต้องยังอยู่ครบ ไม่ถูกแตะ
    const still = (await cnx.from("leads").select("company").eq("id", id)).data ?? [];
    expect(still[0]?.company, "ข้อมูลของ CNX ต้องไม่เปลี่ยน").toBe(`เทสต์อัตโนมัติ ${id}`);
  } finally {
    await cnx.from("leads").delete().eq("id", id);
  }
});

test("[rls] ตัวแทนสร้างลีดใส่สาขาอื่นไม่ได้", async () => {
  const sb = await signIn(RYG);
  const res = await sb.from("leads").insert(lead("TEST-RLS-XDEALER", "CNX")).select();
  expect(wasBlocked(res), "เขียนข้ามสาขาต้องถูกปฏิเสธ").toBe(true);
});

test("[rls] HQ เขียนงานขายของตัวแทนไม่ได้ (C3)", async () => {
  const sb = await signIn(ADMIN);
  const res = await sb.from("leads").insert(lead("TEST-RLS-HQWRITE", "RYG")).select();
  expect(wasBlocked(res), "HQ มีสิทธิ์อ่านงานขาย แต่ต้องเขียนไม่ได้").toBe(true);
});

test("[fk] สร้างลีดใส่รหัสสาขาที่ไม่มีจริงไม่ได้ (0018)", async () => {
  const sb = await signIn(RYG);
  const res = await sb.from("leads").insert(lead("TEST-RLS-GHOST", "ZZZ")).select();
  expect(wasBlocked(res), "รหัสสาขาที่ไม่มีใน dealers ต้องถูกปฏิเสธ").toBe(true);
});

test("[rls] ตัวแทนแก้แคตตาล็อกกลางไม่ได้ · HQ แก้ได้ (0015)", async () => {
  const hq = await signIn(ADMIN);
  const { data: rows, error } = await hq.from("master_catalog").select("id,name").limit(1);
  expect(error).toBeNull();
  const row = (rows ?? [])[0];
  expect(row, "ต้องมีแม่แบบในแคตตาล็อกกลางอย่างน้อย 1 รายการ").toBeTruthy();

  // ตัวแทนพยายามแก้ราคากลาง → ต้องไม่มีแถวไหนเปลี่ยน
  const dealer = await signIn(CNX);
  const blocked = await dealer.from("master_catalog").update({ name: row.name }).eq("id", row.id).select();
  expect(wasBlocked(blocked), "ตัวแทนต้องแก้แคตตาล็อกกลางไม่ได้").toBe(true);

  // HQ แก้ได้ — เขียนทับด้วยค่าเดิม ไม่เปลี่ยนข้อมูลจริง
  const allowed = await hq.from("master_catalog").update({ name: row.name }).eq("id", row.id).select();
  expect(allowed.error).toBeNull();
  expect(allowed.data?.length, "HQ ต้องแก้แคตตาล็อกกลางได้").toBe(1);
});

test("[rpc] เลข id ลูกค้าเดินหน้าทีละหนึ่ง แยกตามสาขา (0016)", async () => {
  const sb = await signIn(RYG);
  const a = await sb.rpc("next_entity_id", { p_dealer: "RYG", p_entity: "customers" });
  const b = await sb.rpc("next_entity_id", { p_dealer: "RYG", p_entity: "customers" });
  expect(a.error).toBeNull();
  expect(b.error).toBeNull();
  expect(Number(b.data) - Number(a.data), "เรียกสองครั้งต้องได้เลขต่างกัน 1").toBe(1);
});

test("[rpc] ใบที่ส่งแล้วและเลยกำหนด ถูกปิดเป็น 'หมดอายุ' · HQ สั่งไม่ได้ (H5+C3)", async () => {
  const ryg = await signIn(RYG);
  const hq  = await signIn(ADMIN);
  const id = "TEST-RLS-EXPIRE";
  try {
    const ins = await ryg.from("quotations").insert({
      id, dealer_code: "RYG", customer: "เทสต์อัตโนมัติ", status: "sent_to_client",
      expiry: "2026-01-01", date: "2025-12-01",
    }).select();
    expect(ins.error, `สร้างใบทดสอบไม่ได้: ${JSON.stringify(ins.error)}`).toBeNull();

    // HQ เรียกได้แต่ไม่มีสิทธิ์เขียนงานขาย → ต้องไม่ปิดใบของใครเลย
    const byHQ = await hq.rpc("expire_quotations", { p_as_of: "2026-06-30" });
    expect(byHQ.error).toBeNull();
    expect(Number(byHQ.data), "HQ ต้องปิดใบของตัวแทนไม่ได้").toBe(0);
    expect((await ryg.from("quotations").select("status").eq("id", id)).data?.[0]?.status,
      "ใบต้องยังไม่ถูกปิดโดย HQ").toBe("sent_to_client");

    // สาขาเจ้าของเรียกเอง → ใบของตัวเองต้องถูกปิด
    const byDealer = await ryg.rpc("expire_quotations", { p_as_of: "2026-06-30" });
    expect(byDealer.error).toBeNull();
    expect((await ryg.from("quotations").select("status").eq("id", id)).data?.[0]?.status,
      "ใบที่เลยกำหนดต้องกลายเป็นหมดอายุ").toBe("expired");
  } finally {
    await ryg.from("quotations").delete().eq("id", id);
  }
});
