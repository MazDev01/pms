import { test, expect } from "@playwright/test";
import { ADMIN, RYG, skipReason } from "./supabaseEnv";
import { HQ_ORIGIN, db, TAG } from "./funcHelpers";
import { createClient } from "@supabase/supabase-js";
import { ADMIN_SUPABASE_URL, ADMIN_SERVICE_ROLE_KEY } from "./adminEnv";

// ── ความแข็งแรงของ route ผู้ดูแล (/api/admin/*) — regression จากผลตรวจสอบระบบ 5 ส.ค. 69 ──
//
// จุดที่แก้ (ดู packages/shared/lib/adminRoute.ts):
//   • ตรวจ input ให้ครบก่อนแตะบัญชี auth (เป้ายอดขายต้องเป็นตัวเลขไม่ติดลบ)
//   • ทุก handler มี rate limit — เดิม DELETE ผู้ใช้ HQ เป็นตัวเดียวที่ไม่มี ทั้งที่ทำลายล้างที่สุด
//   • "หนึ่งสาขาหนึ่งบัญชี" บังคับที่ DB จริง (0105) ไม่ใช่แค่ธรรมเนียมใน logic
//   • error ของการอ่านบทบาท/ข้อมูล ไม่ถูกกลืนเป็น 403/404 อีกต่อไป
test.skip(() => skipReason() !== "", skipReason() || "พร้อมรัน");
test.setTimeout(180_000);
// serial: หลายเทสต์ใช้รหัสสาขาทดสอบตัวเดียวกัน (ZZV) และแตะตัวนับ rate limit ของบัญชี ADMIN ร่วมกัน
// ถ้าปล่อยขนานจะล้างของกันและกันกลางคัน
test.describe.configure({ mode: "serial" });

const admin = createClient(ADMIN_SUPABASE_URL, ADMIN_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function adminToken(): Promise<string> {
  const sb = await db(ADMIN);
  return (await sb.auth.getSession()).data.session?.access_token ?? "";
}

/** ล้างสาขาทดสอบให้หมดจริง — ทั้งแถวสาขา โปรไฟล์ และบัญชี auth
 *  ลบแค่แถว dealers ไม่พอ: บัญชี auth + โปรไฟล์จะค้าง แล้วรอบถัดไปจะสร้างซ้ำไม่ได้
 *  (อีเมลชนบัญชีเดิม) — เจอจริงตอนเขียนเทสต์นี้ */
async function purge(code: string) {
  const { data: profs } = await admin.from("profiles").select("id").eq("dealer_code", code);
  for (const p of profs ?? []) await admin.auth.admin.deleteUser(String(p.id)).catch(() => {});
  await admin.from("profiles").delete().eq("dealer_code", code);
  await admin.from("dealers").delete().eq("code", code);
}

test.describe("ตรวจ input ก่อนสร้างบัญชี", () => {
  const CODE = "ZZV";

  test.beforeEach(async () => { await purge(CODE); });
  test.afterEach(async () => { await purge(CODE); });

  // หมายเหตุ: ส่ง Number.NaN ตรง ๆ ทดสอบไม่ได้ — JSON.stringify แปลง NaN เป็น null เสมอ
  // ค่าที่ทำให้เกิด NaN จริงในทางปฏิบัติคือ "ข้อความที่แปลงเป็นตัวเลขไม่ได้" ซึ่งเทสต์ไว้แล้วด้านล่าง
  for (const [label, revenueTarget] of [
    ["ไม่ใช่ตัวเลข", "ห้าล้าน" as unknown as number],
    ["ติดลบ", -1],
  ] as const) {
    test(`เป้ายอดขาย${label} → ปฏิเสธ 400 และไม่สร้างอะไรทิ้งไว้`, async ({ request }) => {
      const res = await request.post(`${HQ_ORIGIN}/api/admin/dealers`, {
        headers: { authorization: `Bearer ${await adminToken()}` },
        data: { code: CODE, name: `${TAG}-เป้าผิด`, province: "ระยอง", region: "ตะวันออก", revenueTarget },
      });
      expect(res.status(), `เป้ายอดขาย${label} ต้องได้ 400 (ได้ ${res.status()})`).toBe(400);

      // สำคัญกว่าตัวเลขสถานะ: ต้องไม่มีสาขา และไม่มีบัญชี auth ค้างจากคำขอที่ถูกปฏิเสธ
      const { data: rows } = await admin.from("dealers").select("code").eq("code", CODE);
      expect(rows ?? [], "คำขอที่ถูกปฏิเสธต้องไม่สร้างสาขา").toEqual([]);
      const { data: profs } = await admin.from("profiles").select("id").eq("dealer_code", CODE);
      expect(profs ?? [], "คำขอที่ถูกปฏิเสธต้องไม่สร้างบัญชีค้าง").toEqual([]);
    });
  }

  test("เป้ายอดขายที่ถูกต้อง (0) ยังสร้างได้ตามปกติ", async ({ request }) => {
    const res = await request.post(`${HQ_ORIGIN}/api/admin/dealers`, {
      headers: { authorization: `Bearer ${await adminToken()}` },
      data: { code: CODE, name: `${TAG}-เป้าถูก`, province: "ระยอง", region: "ตะวันออก", revenueTarget: 0 },
    });
    // 501 = ยังไม่ได้ตั้ง service_role ที่เครื่องนี้ (ไม่ใช่บั๊กของโค้ด)
    const body = res.status() === 200 ? null : await res.text();
    expect([200, 501], `ต้องผ่านหรือบอกว่ายังไม่ได้ตั้งค่า (ได้ ${res.status()} · ${body})`).toContain(res.status());
    // เก็บกวาดทำที่ afterEach (purge) แล้ว — ครอบคลุมทั้งบัญชี auth และโปรไฟล์ ไม่ใช่แค่แถวสาขา
  });
});

test("หนึ่งสาขาหนึ่งบัญชี — DB ปฏิเสธโปรไฟล์ซ้ำ dealer_code (0105)", async () => {
  // ยิงตรงที่ DB ด้วย service_role (ข้าม RLS) — พิสูจน์ว่า constraint อยู่ที่ฐานข้อมูลจริง
  // ไม่ใช่แค่ logic ใน route ที่เลี่ยงได้ถ้าเขียนข้อมูลทางอื่น
  const { data: existing } = await admin.from("profiles")
    .select("id, dealer_code").not("dealer_code", "eq", "").limit(1);
  test.skip(!existing?.length, "ยังไม่มีบัญชีตัวแทนในระบบให้ทดสอบ");

  const code = String(existing![0].dealer_code);
  const fakeId = "00000000-0000-4000-8000-0000000000ff";
  const { error } = await admin.from("profiles")
    .insert({ id: fakeId, role: "DEALER_ADMIN", dealer_code: code, name: `${TAG}-บัญชีซ้ำ`, status: "active" });

  // ต้องถูกปฏิเสธ — ถ้าผ่านแปลว่า unique index หาย (route รีเซ็ตรหัสผ่าน/impersonate จะพังตามทีหลัง)
  expect(error, `เพิ่มบัญชีที่ 2 ให้สาขา ${code} ต้องถูกปฏิเสธที่ DB`).not.toBeNull();
  expect(String(error?.message ?? ""), "ต้องเป็น error เรื่องข้อมูลซ้ำ").toMatch(/duplicate|unique/i);

  // เผื่อกรณีหลุด (ไม่ควรเกิด) — ล้างทิ้งไม่ให้ทำสาขาพัง
  await admin.from("profiles").delete().eq("id", fakeId);
});

test("route ที่ไม่มีสิทธิ์ยังถูกปฏิเสธเหมือนเดิมทุกช่องทาง (ไม่หลุดจากการ refactor)", async ({ request }) => {
  const rygToken = (await (await db(RYG)).auth.getSession()).data.session?.access_token ?? "";
  const cases: Array<{ name: string; run: () => Promise<{ status(): number }> }> = [
    {
      name: "ตัวแทนขอเข้าระบบแทนตัวแทน (impersonate)",
      run: () => request.post(`${HQ_ORIGIN}/api/admin/dealers/impersonate?code=CNX`, {
        headers: { authorization: `Bearer ${rygToken}` },
      }),
    },
    {
      name: "ตัวแทนรีเซ็ตรหัสผ่านตัวแทน",
      run: () => request.patch(`${HQ_ORIGIN}/api/admin/dealers?code=CNX`, {
        headers: { authorization: `Bearer ${rygToken}` },
      }),
    },
    {
      name: "ตัวแทนลบตัวแทน",
      run: () => request.delete(`${HQ_ORIGIN}/api/admin/dealers?code=CNX`, {
        headers: { authorization: `Bearer ${rygToken}` },
      }),
    },
    {
      name: "ตัวแทนสร้างผู้ใช้ HQ",
      run: () => request.post(`${HQ_ORIGIN}/api/admin/users`, {
        headers: { authorization: `Bearer ${rygToken}` },
        data: { name: "x", email: "x@y.co", role: "SUPER_ADMIN" },
      }),
    },
    {
      name: "ตัวแทนลบผู้ใช้ HQ",
      run: () => request.delete(`${HQ_ORIGIN}/api/admin/users?id=00000000-0000-4000-8000-000000000001`, {
        headers: { authorization: `Bearer ${rygToken}` },
      }),
    },
    {
      name: "ไม่มี token เลย (impersonate)",
      run: () => request.post(`${HQ_ORIGIN}/api/admin/dealers/impersonate?code=CNX`),
    },
  ];

  for (const c of cases) {
    const res = await c.run();
    expect([401, 403, 501], `${c.name} ต้องถูกปฏิเสธ (ได้ ${res.status()})`).toContain(res.status());
  }

  // สาขา CNX ต้องยังอยู่ครบหลังโดนยิงทุกช่องทาง
  const { data: cnx } = await admin.from("dealers").select("code").eq("code", "CNX");
  expect(cnx ?? [], "สาขา CNX ต้องไม่ถูกลบจากคำขอที่ไม่มีสิทธิ์").toHaveLength(1);
});

test("ลบผู้ใช้ HQ มีการจำกัดจำนวนครั้ง (rate limit)", async ({ request }) => {
  const token = await adminToken();
  // ล้างตัวนับก่อน เพื่อไม่ให้ผลตกค้างจากเทสต์อื่น
  const { data: me } = await admin.auth.getUser(token);
  const key = `delete-user:${me.user?.id ?? ""}`;
  await admin.from("rate_limits").delete().eq("key", key);

  // ยิง 12 ครั้งด้วย id ที่ไม่มีจริง — ควรได้ 404 ตอนแรก แล้วเจอ 429 เมื่อเกินโควตา 10/นาที
  const statuses: number[] = [];
  for (let i = 0; i < 12; i++) {
    const res = await request.delete(
      `${HQ_ORIGIN}/api/admin/users?id=00000000-0000-4000-8000-0000000000${String(i).padStart(2, "0")}`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    statuses.push(res.status());
  }
  expect(statuses, `ต้องเจอ 429 หลังยิงเกินโควตา (ได้ ${statuses.join(",")})`).toContain(429);

  await admin.from("rate_limits").delete().eq("key", key);
});
