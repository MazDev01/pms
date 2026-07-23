import { test, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON, RYG, CNX, ADMIN, skipReason, type Account } from "./supabaseEnv";

// กฎความปลอดภัยที่ "มีจริงเฉพาะโหมด supabase" — RLS / สิทธิ์เขียน / FK / ตัวนับเลขที่ (M5)
//
// ทำไมไม่ทดสอบผ่านหน้าจอ: กฎพวกนี้บังคับที่ฐานข้อมูล ไม่ใช่ที่ UI
// การกดผ่านหน้าจอพิสูจน์ได้แค่ว่า "ปุ่มไม่โผล่" ซึ่งข้ามได้ด้วยการยิง API ตรง
// ชุดนี้จึงล็อกอินด้วยบัญชีจริงแล้วยิง PostgREST ตรง ๆ เหมือนผู้ไม่หวังดีจะทำ
//
// ตารางงานขายบน DB จริงยังว่าง (ไม่ยัด mock ลงของจริง) → เทสต์ที่ต้องมีข้อมูล
// จะสร้างแถวของตัวเองแล้วลบทิ้งเสมอ ไม่งั้นจะ "ผ่านเพราะไม่มีอะไรให้เจอ" ซึ่งไม่ได้พิสูจน์อะไรเลย

test.skip(() => skipReason() !== "", skipReason() || "พร้อมรัน");

async function signIn(who: Account): Promise<SupabaseClient> {
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: false, autoRefreshToken: false } });
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

test("[hq→dealer] เหตุผลปิดการขายไม่สำเร็จที่ HQ ตั้ง ไปถึงตัวแทนจริง (0021)", async () => {
  const hq = await signIn(ADMIN);
  const dealer = await signIn(RYG);
  const before = (await hq.from("hq_sales_journey").select("lost").eq("id", 1)).data?.[0]?.lost as string[];
  expect(before, "ต้องมีแถวตั้งค่าอยู่แล้ว (0021 seed ให้)").toBeTruthy();

  const probe = [...before, "เทสต์อัตโนมัติ-ห้ามค้าง"];
  try {
    // ตัวแทนแก้เองไม่ได้
    const blocked = await dealer.from("hq_sales_journey").update({ lost: probe }).eq("id", 1).select();
    expect(wasBlocked(blocked), "ตัวแทนต้องแก้รายการเหตุผลไม่ได้").toBe(true);

    // HQ แก้ได้ แล้วตัวแทนต้องอ่านเห็นค่าใหม่ (คนละ session — พิสูจน์ว่าไม่ได้ผ่าน localStorage)
    const saved = await hq.from("hq_sales_journey").update({ lost: probe }).eq("id", 1).select();
    expect(saved.error).toBeNull();
    const seen = (await dealer.from("hq_sales_journey").select("lost").eq("id", 1)).data?.[0]?.lost as string[];
    expect(seen, "ตัวแทนต้องเห็นรายการที่ HQ เพิ่งตั้ง").toEqual(probe);
  } finally {
    await hq.from("hq_sales_journey").update({ lost: before }).eq("id", 1);
  }
});

test("[multi-tenant] สองสาขาสร้างลีด/ใบเสนอราคาเลขเดียวกันได้ (0022)", async () => {
  const ryg = await signIn(RYG);
  const cnx = await signIn(CNX);
  // เลขที่แอปออกให้ "ลีดแรก" ของทุกสาขาเหมือนกัน เพราะนับจากลีดที่ตัวเองเห็น (RLS กรองรายสาขา)
  const LID = "#L-40322";
  const QID = "Q-2026-0001";
  try {
    const a = await ryg.from("leads").insert({ id: LID, dealer_code: "RYG", company: "ทดสอบ RYG", status: "WAITING" }).select();
    const b = await cnx.from("leads").insert({ id: LID, dealer_code: "CNX", company: "ทดสอบ CNX", status: "WAITING" }).select();
    expect(a.error, `RYG สร้างลีดไม่ได้: ${JSON.stringify(a.error)}`).toBeNull();
    expect(b.error, `CNX สร้างลีดเลขเดียวกันไม่ได้ = ระบบใช้หลายสาขาไม่ได้: ${JSON.stringify(b.error)}`).toBeNull();

    // ต่างสาขาต่างเห็นของตัวเอง ไม่ปนกัน
    expect(((await ryg.from("leads").select("company").eq("id", LID)).data ?? [])[0]?.company).toBe("ทดสอบ RYG");
    expect(((await cnx.from("leads").select("company").eq("id", LID)).data ?? [])[0]?.company).toBe("ทดสอบ CNX");

    const qa = await ryg.from("quotations").insert({ id: QID, dealer_code: "RYG", customer: "ทดสอบ RYG", status: "draft" }).select();
    const qb = await cnx.from("quotations").insert({ id: QID, dealer_code: "CNX", customer: "ทดสอบ CNX", status: "draft" }).select();
    expect(qa.error, `RYG ออกใบไม่ได้: ${JSON.stringify(qa.error)}`).toBeNull();
    expect(qb.error, `CNX ออกใบเลขเดียวกันไม่ได้: ${JSON.stringify(qb.error)}`).toBeNull();
  } finally {
    await ryg.from("leads").delete().eq("id", LID);
    await cnx.from("leads").delete().eq("id", LID);
    await ryg.from("quotations").delete().eq("id", QID);
    await cnx.from("quotations").delete().eq("id", QID);
  }
});

test("[rpc] คำนำหน้าเลขที่ที่ตัวแทนตั้ง มีผลกับเลขที่ DB ออกให้ (A3)", async () => {
  const sb = await signIn(RYG);
  // ไม่ส่งคำนำหน้า → ใช้ค่า default ของฟังก์ชัน
  const def = await sb.rpc("next_quote_no", { p_dealer: "RYG" });
  expect(def.error).toBeNull();
  expect(String(def.data), "ค่า default ต้องขึ้นต้น Q-2026-").toMatch(/^Q-2026-\d{4}$/);

  // ส่งคำนำหน้าของตัวแทน → ต้องใช้ตามนั้น (เดิม adapter ไม่เคยส่ง p_prefix เลย ค่าที่ตั้งไว้จึงไร้ผล)
  const mine = await sb.rpc("next_quote_no", { p_dealer: "RYG", p_prefix: "RYG-2569-" });
  expect(mine.error).toBeNull();
  expect(String(mine.data), "ต้องใช้คำนำหน้าที่ส่งไป").toMatch(/^RYG-2569-\d{4}$/);

  // ตัวนับต้องเดินหน้าต่อเนื่อง ไม่รีเซ็ตเพราะเปลี่ยนคำนำหน้า
  const a = parseInt(String(def.data).slice(-4), 10);
  const b = parseInt(String(mine.data).slice(-4), 10);
  expect(b - a, "เรียกสองครั้งติดกันต้องได้เลขต่างกัน 1").toBe(1);
});

test("[repo] HQ ลบตัวแทนแล้วหายจาก DB จริง ไม่ใช่แค่หายจากหน้าจอ (A4)", async () => {
  const sb = await signIn(ADMIN);
  const CODE = "ZTEST";
  const before = (await sb.from("dealers").select("code")).data ?? [];
  expect(before.length, "ต้องมีตัวแทนอยู่ก่อน").toBeGreaterThan(0);
  try {
    // เพิ่มตัวแทนชั่วคราว
    const ins = await sb.from("dealers").insert({
      code: CODE, name: "สาขาทดสอบอัตโนมัติ", province: "กรุงเทพฯ", region: "กลาง", status: "active",
    }).select();
    expect(ins.error, `เพิ่มไม่ได้: ${JSON.stringify(ins.error)}`).toBeNull();
    expect(((await sb.from("dealers").select("code")).data ?? []).length).toBe(before.length + 1);

    // จำลองสิ่งที่ dealers.save ทำ: upsert ชุดที่ "ไม่มี ZTEST" แล้วลบส่วนเกิน
    const keep = before.map(d => `"${d.code}"`).join(",");
    const del = await sb.from("dealers").delete().not("code", "in", `(${keep})`).select();
    expect(del.error, `ลบไม่ได้: ${JSON.stringify(del.error)}`).toBeNull();

    const after = (await sb.from("dealers").select("code")).data ?? [];
    expect(after.length, "ตัวแทนที่ถูกเอาออกต้องหายจาก DB").toBe(before.length);
    expect(after.some(d => d.code === CODE), "ZTEST ต้องไม่เหลือ").toBe(false);
  } finally {
    await sb.from("dealers").delete().eq("code", CODE);
  }
});

test("[schema] ตาราง dealers ไม่มีคอลัมน์ KPI เดโมแล้ว (0023)", async () => {
  const sb = await signIn(ADMIN);
  const { data, error } = await sb.from("dealers").select("*").limit(1);
  expect(error).toBeNull();
  const row = (data ?? [])[0];
  expect(row, "ต้องมีตัวแทนอย่างน้อย 1 สาขา").toBeTruthy();
  // ค่าพวกนี้เป็น "ผลลัพธ์ที่คำนวณได้" จากใบเสนอราคา/ลีด — เก็บในตารางเมื่อไหร่ก็เพี้ยนจากของจริง
  for (const col of ["revenue_actual", "win_rate", "active_projects", "on_time_pct"]) {
    expect(Object.keys(row), `คอลัมน์ ${col} ต้องถูกลบไปแล้ว`).not.toContain(col);
  }
  // เป้าทั้งปียังต้องอยู่ — เป็นค่าที่ HQ กรอกเอง คำนวณจากที่ไหนไม่ได้
  expect(Object.keys(row), "revenue_target ต้องยังอยู่").toContain("revenue_target");
});
