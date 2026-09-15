// ── เป้ายอดขายรายปีของตัวแทน เชื่อมกับแพ็กเกจ Standard / Exclusive (บอสสั่ง 15 ก.ย. 69 · 0178) ──
//
// สิ่งที่ต้องพิสูจน์ที่ฐานข้อมูล (ด่านจริง ใครเขียนทางไหนก็โดน):
//   1) ตัวแทนมีแพ็กเกจ + แพ็กเกจตั้งเป้าไว้ → เป้ายอดขาย = เป้าของแพ็กเกจ · กรอกทับผ่าน save_dealers ไม่ได้
//   2) แก้เป้าของแพ็กเกจที่หน้าตั้งค่า → ตัวแทนในแพ็กเกจนั้นเปลี่ยนตาม
//   3) ไม่มีแพ็กเกจ / แพ็กเกจยังไม่ตั้งเป้า → เป้าที่กรอกเองยังอยู่
//   4) save_dealers ที่ไม่ส่งคีย์ package → แพ็กเกจเดิมไม่หาย · ทะเบียนตัวแทน (view) อ่านแพ็กเกจได้
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { ADMIN, skipReason } from "./supabaseEnv";
import { ADMIN_SUPABASE_URL, ADMIN_SERVICE_ROLE_KEY } from "./adminEnv";
import { db } from "./funcHelpers";

test.skip(() => skipReason() !== "", skipReason() || "พร้อมรัน");
test.describe.configure({ mode: "serial" });

const STD = "ZZS";
const EXC = "ZZW";   // ไม่ใช้ ZZX — hq-prospects ใช้เป็น "สาขาที่ไม่มีอยู่จริง"
const admin = createClient(ADMIN_SUPABASE_URL, ADMIN_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let ค่าตั้งเดิม: unknown = null;

async function purge() {
  await admin.from("dealers").delete().in("code", [STD, EXC]);
}
test.beforeAll(async () => {
  ค่าตั้งเดิม = ((await admin.from("hq_recruit_settings").select("config").eq("id", 1).maybeSingle()).data as { config: unknown } | null)?.config ?? {};
  await purge();
});
test.afterAll(async () => {
  await purge();
  await admin.from("hq_recruit_settings").update({ config: ค่าตั้งเดิม }).eq("id", 1);
});

const ตั้งเป้าแพ็กเกจ = async (standard: number | null, exclusive: number | null) => {
  const base = (ค่าตั้งเดิม && typeof ค่าตั้งเดิม === "object" ? ค่าตั้งเดิม : {}) as Record<string, unknown>;
  const proposal = (base.proposal && typeof base.proposal === "object" ? base.proposal : {}) as Record<string, unknown>;
  const { error } = await admin.from("hq_recruit_settings").update({
    config: { ...base, proposal: { ...proposal, packages: { standard: { annualTarget: standard }, exclusive: { annualTarget: exclusive } } } },
  }).eq("id", 1);
  expect(error).toBeNull();
};
const เป้าของ = async (code: string) =>
  Number(((await admin.from("dealers").select("revenue_target").eq("code", code).single()).data as { revenue_target: number }).revenue_target);

test("[db] เป้ายอดขายตามแพ็กเกจ · แก้เป้าแพ็กเกจแล้วตัวแทนเปลี่ยนตาม · ไม่มีแพ็กเกจกรอกเองได้", async () => {
  test.skip(!ADMIN_SERVICE_ROLE_KEY, "เครื่องนี้ยังไม่ได้ตั้ง service_role");
  await ตั้งเป้าแพ็กเกจ(3_000_000, null);
  const ใส่ = await admin.from("dealers").insert([
    { code: STD, name: "ZZTEST แพ็กเกจ Standard", province: "ระยอง", region: "ตะวันออก", revenue_target: 0, status: "active", package: "standard" },
    { code: EXC, name: "ZZTEST แพ็กเกจ Exclusive", province: "ระยอง", region: "ตะวันออก", revenue_target: 1_500_000, status: "active", package: "exclusive" },
  ]);
  expect(ใส่.error).toBeNull();
  expect(await เป้าของ(STD), "มีแพ็กเกจที่ตั้งเป้าไว้ ต้องได้เป้าของแพ็กเกจ").toBe(3_000_000);
  expect(await เป้าของ(EXC), "แพ็กเกจยังไม่ตั้งเป้า ต้องคงเป้าที่กรอกเอง").toBe(1_500_000);

  // ผู้ดูแลกรอกเป้าทับผ่านหน้าตัวแทน (save_dealers) — ต้องกลับเป็นเป้าของแพ็กเกจ
  const hq = await db(ADMIN);
  const บันทึก = await hq.rpc("save_dealers", { p_rows: [
    { code: STD, name: "ZZTEST แพ็กเกจ Standard", province: "ระยอง", region: "ตะวันออก", status: "active", revenue_target: 99, package: "standard" },
  ] });
  expect(บันทึก.error).toBeNull();
  expect(await เป้าของ(STD), "กรอกทับเป้าของตัวแทนที่อยู่ในแพ็กเกจไม่ได้").toBe(3_000_000);

  // แก้เป้าของแพ็กเกจที่หน้าตั้งค่า → ตัวแทนเปลี่ยนตามทั้งสองแพ็กเกจ
  await ตั้งเป้าแพ็กเกจ(3_600_000, 8_000_000);
  expect(await เป้าของ(STD), "แก้เป้าแพ็กเกจแล้ว ตัวแทนต้องเปลี่ยนตาม").toBe(3_600_000);
  expect(await เป้าของ(EXC), "แพ็กเกจที่เพิ่งตั้งเป้า ตัวแทนต้องได้เป้านั้น").toBe(8_000_000);

  // เอาแพ็กเกจออก → กรอกเองได้
  expect((await hq.rpc("save_dealers", { p_rows: [
    { code: EXC, name: "ZZTEST แพ็กเกจ Exclusive", province: "ระยอง", region: "ตะวันออก", status: "active", revenue_target: 2_222_000, package: "" },
  ] })).error).toBeNull();
  expect(await เป้าของ(EXC), "ไม่มีแพ็กเกจแล้ว ต้องใช้เป้าที่กรอกเอง").toBe(2_222_000);

  // ผู้เรียกเก่าที่ไม่ส่งคีย์ package → แพ็กเกจเดิมต้องไม่หาย
  expect((await hq.rpc("save_dealers", { p_rows: [
    { code: STD, name: "ZZTEST แพ็กเกจ Standard (แก้ชื่อ)", province: "ระยอง", region: "ตะวันออก", status: "active", revenue_target: 1 },
  ] })).error).toBeNull();
  const { data: ทะเบียน } = await hq.from("dealers_directory").select("code, package, revenue_target").in("code", [STD, EXC]).order("code");
  expect(ทะเบียน, "ทะเบียนตัวแทนต้องอ่านแพ็กเกจได้ และแพ็กเกจเดิมไม่หาย").toEqual([
    { code: STD, package: "standard", revenue_target: 3_600_000 },
    { code: EXC, package: null, revenue_target: 2_222_000 },
  ]);
});
