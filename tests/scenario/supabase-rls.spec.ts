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

// ใช้ client เดิมซ้ำต่อหนึ่งบัญชี — ชุดนี้มีหลายสิบเทสต์ ถ้าล็อกอินใหม่ทุกครั้ง
// Supabase Auth จะตอบ "Request rate limit reached" แล้วเทสต์ตกแบบสุ่ม (ไม่ใช่บั๊กของแอป)
const clients = new Map<string, Promise<SupabaseClient>>();
function signIn(who: Account): Promise<SupabaseClient> {
  const cached = clients.get(who.email);
  if (cached) return cached;
  const p = (async () => {
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await sb.auth.signInWithPassword(who);
    if (error) throw new Error(`ล็อกอิน ${who.email} ไม่ผ่าน: ${error.message}`);
    return sb;
  })();
  clients.set(who.email, p);
  return p;
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
  // ⚠️ ห้ามใช้เลขที่แอปออกให้จริง — "#L-40322" / "Q-2026-0001" คือเลขใบแรกเมื่อตารางว่าง
  //    เทสต์ func-* สร้างลีด/ใบผ่านหน้าจอด้วย worker คนละตัวในเวลาเดียวกัน แล้วได้เลขชุดเดียวกันพอดี
  //    → ชน leads_pkey แบบสุ่ม · รันเดี่ยวผ่าน รันรวมพัง = เทสต์ที่เชื่อผลไม่ได้
  //    ประเด็นของเทสต์นี้คือ "สองสาขาใช้เลขเดียวกันได้" ตัวเลขเป็นอะไรก็ได้ ขอแค่ทั้งคู่ใช้ตัวเดียวกัน
  //    จึงใช้รูปแบบที่ตัวออกเลขของแอปไม่มีทางสร้างได้ (มีตัวอักษรตรงส่วนที่แอปใช้ตัวเลขล้วน)
  //
  //    และต้องไม่มีคำว่า ZZTEST อยู่ในเลขด้วย — เป็นแท็กที่ funcHelpers.cleanup() ใช้กวาดข้อมูล
  //    (`leads.delete().like("id", "%ZZTEST%")`) เทสต์ชุด func-* จะลบแถวของเทสต์นี้ทิ้งกลางคัน
  const LID = "#L-RLSPAIR";
  const QID = "Q-RLSPAIR-01";
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

test("[dealer-settings] หัวกระดาษ/เอกสารของสาขาเก็บที่ DB · สาขาอื่นแตะไม่ได้ (0024)", async () => {
  const ryg = await signIn(RYG);
  const cnx = await signIn(CNX);
  const hq  = await signIn(ADMIN);
  const issuer = { company: "บจ. ทดสอบอัตโนมัติ", address: "ที่อยู่ทดสอบ", phone: "000", taxId: "0000000000000" };
  try {
    // สาขาบันทึกหัวกระดาษของตัวเองได้
    const up = await ryg.from("dealer_settings")
      .upsert({ dealer_code: "RYG", issuer, document: { quotePrefix: "RYG-" } }, { onConflict: "dealer_code" }).select();
    expect(up.error, `RYG บันทึกไม่ได้: ${JSON.stringify(up.error)}`).toBeNull();

    // อ่านกลับมาได้ครบ — นี่คือสิ่งที่ทำให้ "ย้ายเครื่องแล้วหัวกระดาษไม่หาย"
    const mine = (await ryg.from("dealer_settings").select("issuer,document").eq("dealer_code", "RYG")).data?.[0];
    expect((mine?.issuer as typeof issuer)?.company).toBe(issuer.company);
    expect((mine?.document as { quotePrefix: string })?.quotePrefix).toBe("RYG-");

    // สาขาอื่นแก้ไม่ได้ และมองไม่เห็นด้วย
    const hack = await cnx.from("dealer_settings").update({ issuer: { company: "โดนแก้" } }).eq("dealer_code", "RYG").select();
    expect(wasBlocked(hack), "CNX ต้องแก้หัวกระดาษของ RYG ไม่ได้").toBe(true);
    expect(((await cnx.from("dealer_settings").select("dealer_code").eq("dealer_code", "RYG")).data ?? []).length,
      "CNX ต้องมองไม่เห็นตั้งค่าของ RYG").toBe(0);

    // HQ อ่านได้ (ดูแลทั้งเครือ) แต่แก้ไม่ได้ — เป็นข้อมูลบริษัทของสาขา
    expect(((await hq.from("dealer_settings").select("dealer_code").eq("dealer_code", "RYG")).data ?? []).length).toBe(1);
    const byHQ = await hq.from("dealer_settings").update({ issuer: { company: "HQ แก้" } }).eq("dealer_code", "RYG").select();
    expect(wasBlocked(byHQ), "HQ ต้องแก้หัวกระดาษของตัวแทนไม่ได้").toBe(true);
  } finally {
    await ryg.from("dealer_settings").delete().eq("dealer_code", "RYG");
  }
});

test("[profile] ผู้ใช้แก้โปรไฟล์ตัวเองได้ แต่ยกระดับสิทธิ์/ย้ายสาขาตัวเองไม่ได้ (0026)", async () => {
  const sb = await signIn(RYG);
  const { data: sess } = await sb.auth.getSession();
  const uid = sess.session?.user?.id;
  expect(uid, "ต้องมี session").toBeTruthy();

  const before = (await sb.from("profiles").select("name,role,dealer_code").eq("id", uid!).maybeSingle()).data as
    { name: string; role: string; dealer_code: string } | null;
  expect(before, "ต้องมีโปรไฟล์ของผู้ใช้นี้").toBeTruthy();

  try {
    // แก้ข้อมูลส่วนตัวได้ — นี่คือสิ่งที่ทำให้ "ชื่อ/รูปไม่หายเมื่อย้ายเครื่อง"
    const ok = await sb.from("profiles").update({ name: "ทดสอบอัตโนมัติ", phone: "000" }).eq("id", uid!).select();
    expect(ok.error, `แก้โปรไฟล์ตัวเองไม่ได้: ${JSON.stringify(ok.error)}`).toBeNull();
    expect(ok.data?.length).toBe(1);

    // ยกระดับตัวเองเป็นผู้ดูแลระบบไม่ได้ (RLS จำกัดแถวได้ แต่จำกัดคอลัมน์ไม่ได้ → ต้องมี trigger กัน)
    const esc = await sb.from("profiles").update({ role: "SUPER_ADMIN" }).eq("id", uid!).select();
    expect(wasBlocked(esc), "ต้องยกระดับสิทธิ์ตัวเองไม่ได้").toBe(true);

    // ย้ายตัวเองไปสาขาอื่นไม่ได้ (ไม่งั้นเห็นข้อมูลสาขาอื่นทันทีเพราะ RLS อิง dealer_code)
    const move = await sb.from("profiles").update({ dealer_code: "CNX" }).eq("id", uid!).select();
    expect(wasBlocked(move), "ต้องย้ายสาขาตัวเองไม่ได้").toBe(true);

    // ของจริงต้องไม่เปลี่ยน
    const after = (await sb.from("profiles").select("role,dealer_code").eq("id", uid!).maybeSingle()).data as
      { role: string; dealer_code: string };
    expect(after.role).toBe(before!.role);
    expect(after.dealer_code).toBe(before!.dealer_code);
  } finally {
    await sb.from("profiles").update({ name: before!.name, phone: "" }).eq("id", uid!);
  }
});

test("[notes] โน้ตลูกค้าเก็บที่ DB · สาขาอื่นเห็นไม่ได้ · HQ อ่านได้แต่เขียนไม่ได้ (0028)", async () => {
  const ryg = await signIn(RYG);
  const cnx = await signIn(CNX);
  const hq  = await signIn(ADMIN);
  let id: number | null = null;
  try {
    const ins = await ryg.from("customer_notes")
      .insert({ dealer_code: "RYG", customer_id: 1, title: "โน้ตทดสอบ", content: "เนื้อหา", author: "อัตโนมัติ" })
      .select().single();
    expect(ins.error, `สร้างโน้ตไม่ได้: ${JSON.stringify(ins.error)}`).toBeNull();
    id = (ins.data as { id: number }).id;

    // สาขาอื่นมองไม่เห็นและแก้ไม่ได้
    expect(((await cnx.from("customer_notes").select("id").eq("id", id)).data ?? []).length,
      "CNX ต้องมองไม่เห็นโน้ตของ RYG").toBe(0);
    const hack = await cnx.from("customer_notes").update({ content: "โดนแก้" }).eq("id", id).select();
    expect(wasBlocked(hack), "CNX ต้องแก้โน้ตของ RYG ไม่ได้").toBe(true);

    // HQ อ่านได้ทั้งเครือ แต่เขียนงานขายไม่ได้ (นิยามเดียวกับลีด/ใบเสนอราคา)
    expect(((await hq.from("customer_notes").select("id").eq("id", id)).data ?? []).length).toBe(1);
    const byHQ = await hq.from("customer_notes").update({ content: "HQ แก้" }).eq("id", id).select();
    expect(wasBlocked(byHQ), "HQ ต้องแก้โน้ตของตัวแทนไม่ได้").toBe(true);
  } finally {
    if (id !== null) await ryg.from("customer_notes").delete().eq("id", id);
  }
});

test("[hq-company] ข้อมูลบริษัท HQ อ่านได้ทุกคน · เขียนเฉพาะผู้มีสิทธิ์ข้อมูลกลาง (0028)", async () => {
  const hq = await signIn(ADMIN);
  const dealer = await signIn(RYG);
  const before = (await hq.from("hq_company").select("name").eq("id", 1)).data?.[0] as { name: string };
  expect(before, "ต้องมีแถวข้อมูลบริษัท (0028 seed ให้)").toBeTruthy();
  try {
    // ตัวแทนอ่านได้ (อ้างอิงชื่อบริษัทแม่) แต่แก้ไม่ได้
    expect(((await dealer.from("hq_company").select("name").eq("id", 1)).data ?? []).length).toBe(1);
    const blocked = await dealer.from("hq_company").update({ name: "ตัวแทนแก้" }).eq("id", 1).select();
    expect(wasBlocked(blocked), "ตัวแทนต้องแก้ข้อมูลบริษัท HQ ไม่ได้").toBe(true);

    const ok = await hq.from("hq_company").update({ name: "ทดสอบอัตโนมัติ" }).eq("id", 1).select();
    expect(ok.error).toBeNull();
    expect(ok.data?.length).toBe(1);
  } finally {
    await hq.from("hq_company").update({ name: before.name }).eq("id", 1);
  }
});
