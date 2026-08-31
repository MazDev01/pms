// ── ยุบ "ปรับราคา" เข้า "แก้ไข" + ราคาย่อยต้องลงประวัติ (บอสสั่ง 28 ส.ค. 69) ─────────
//
// เดิมมีสองปุ่มที่ทับกันอยู่เรื่องหนึ่ง: ราคาแม่แบบย่อยแก้ได้ทั้งใน "แก้ไข" และ "ปรับราคา"
//   แต่ทางฝั่ง "แก้ไข" ไม่บันทึกประวัติราคาเลย — กฎ "ราคาต้องแก้ผ่านปรับราคาเพื่อเก็บประวัติ"
//   ที่เขียนไว้ในฟอร์มเอง จึงบังคับได้แค่ราคาหลัก ส่วนราคาย่อยเลี่ยงได้
//   และไม่ว่าจะแก้ทางไหน ราคาย่อยก็ไม่เคยถูกเก็บลงประวัติเลยสักครั้ง
//
// สามข้อที่ต้องจริง (ตรวจที่ฐานข้อมูล ไม่ใช่แค่หน้าจอ):
//   1. ไม่มีปุ่ม "ปรับราคา" เหลืออยู่ — ราคาทุกระดับอยู่ในกล่องแก้ไขกล่องเดียว
//   2. เปลี่ยนราคาหลัก → ราคาย่อยที่ตั้งเฉพาะไว้ขยับตามสัดส่วนเดิม
//   3. ราคาชุดเดิม (ทั้งหลักและย่อย) ถูกดันลงประวัติ พร้อมหมายเหตุ
import { test, expect } from "@playwright/test";
import { ADMIN, skipReason } from "./supabaseEnv";
import { HQ_ORIGIN, loginUI, db, TAG } from "./funcHelpers";
import { settle } from "./helpers";

test.skip(() => skipReason() !== "", skipReason() || "พร้อมรัน");
test.setTimeout(180_000);

const ชื่อแม่แบบ = `${TAG}-ประวัติราคา`;
const ย่อยแพง = "ห้องเย็น";        // ตั้งราคาเฉพาะไว้ = ต้องขยับตามสัดส่วน
const ย่อยตามหลัก = "ทั่วไป";       // ไม่ตั้งราคา = ใช้ราคาแม่แบบหลัก ขยับตามอยู่แล้ว
const ID = "zzt-price-history";

const ราคาเดิม = 5000, ราคาย่อยเดิม = 7500;   // ย่อยแพงกว่าหลัก 50%
const ราคาใหม่ = 6000;                        // +20% → ย่อยต้องกลายเป็น 9000 (คงสัดส่วน 50%)

async function ล้างของทดสอบ() {
  const sb = await db(ADMIN);
  await sb.from("master_catalog").delete().eq("id", ID);
}
test.beforeAll(async () => {
  await ล้างของทดสอบ();
  const sb = await db(ADMIN);
  const ins = await sb.from("master_catalog").insert({
    id: ID, name: ชื่อแม่แบบ, spec: "สำหรับทดสอบประวัติราคา", price: ราคาเดิม, unit: "ตร.ม.",
    effective_date: "1 ส.ค. 2569", price_history: [],
    subtypes: [ย่อยแพง, ย่อยตามหลัก], subtype_prices: { [ย่อยแพง]: ราคาย่อยเดิม },
  }).select();
  expect(ins.error, `สร้างแม่แบบทดสอบไม่ได้: ${JSON.stringify(ins.error)}`).toBeNull();
});
test.afterAll(ล้างของทดสอบ);

test("[func·hq] แก้ราคาในกล่องแก้ไข → ราคาย่อยขยับตาม และราคาชุดเดิมลงประวัติ", async ({ page }) => {
  const sb = await db(ADMIN);
  await loginUI(page, HQ_ORIGIN, "/hq/login", ADMIN);
  await page.goto(`${HQ_ORIGIN}/hq/master`, { waitUntil: "domcontentloaded" });
  await settle(page);

  // 1) ปุ่ม "ปรับราคา" ต้องไม่เหลืออยู่แล้ว — ถ้ายังมี แปลว่ายังไม่ได้ยุบรวมจริง
  await expect(page.getByRole("button", { name: "ปรับราคา", exact: true }))
    .toHaveCount(0);

  // ค้นหาก่อนเสมอ — แคตตาล็อกมีหลายใบ ถ้าไม่กรองจะไปกดปุ่มแก้ไขของแม่แบบอื่น
  await page.getByPlaceholder("ค้นหาแม่แบบ...").fill(ชื่อแม่แบบ);
  await expect(page.getByText(ชื่อแม่แบบ).first()).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "แก้ไข", exact: true }).first().click();

  const ช่องราคา = page.getByLabel("ราคากลาง (บาท)");
  await expect(ช่องราคา).toBeVisible({ timeout: 15_000 });

  // 2) เปลี่ยนราคาหลัก → ราคาย่อยที่ตั้งเฉพาะไว้ต้องขยับตามสัดส่วนให้เห็นทันที ก่อนกดบันทึกด้วยซ้ำ
  await ช่องราคา.fill(String(ราคาใหม่));
  await expect(page.getByLabel(`ราคากลางของ ${ย่อยแพง}`),
    "ราคาย่อยต้องขยับตามสัดส่วนเดิม (แพงกว่าหลัก 50% เท่าเดิม)").toHaveValue(/9,?000/);

  await page.getByLabel("หมายเหตุของการเปลี่ยนราคา").fill("ทดสอบปรับตามราคาเหล็ก");
  await page.getByRole("button", { name: "บันทึก", exact: true }).last().click();

  // 3) พิสูจน์ที่ฐานข้อมูล
  type แถว = {
    price: number; subtype_prices: Record<string, number>;
    price_history: { price: number; note?: string; subtypePrices?: Record<string, number> }[];
  };
  const อ่าน = async (): Promise<แถว | null> => {
    const { data } = await sb.from("master_catalog")
      .select("price,subtype_prices,price_history").eq("id", ID).maybeSingle();
    return (data as แถว | null) ?? null;
  };
  await expect.poll(async () => (await อ่าน())?.price,
    { timeout: 30_000, message: "ราคาหลักใหม่ต้องลงฐานข้อมูล" }).toBe(ราคาใหม่);

  const แถวจริง = (await อ่าน())!;
  expect(แถวจริง.subtype_prices?.[ย่อยแพง], "ราคาย่อยต้องขยับตามสัดส่วนเดิม").toBe(9000);
  expect(แถวจริง.subtype_prices?.[ย่อยตามหลัก], "ตัวที่ไม่ได้ตั้งราคาเฉพาะ ต้องไม่ถูกยัดราคาให้").toBeUndefined();

  const ล่าสุด = แถวจริง.price_history?.[0];
  expect(ล่าสุด?.price, "ราคาหลักเดิมต้องถูกดันลงประวัติ").toBe(ราคาเดิม);
  expect(ล่าสุด?.note, "หมายเหตุที่กรอกต้องติดไปกับประวัติ").toContain("ราคาเหล็ก");
  expect(ล่าสุด?.subtypePrices?.[ย่อยแพง], "ราคาย่อยเดิมต้องถูกเก็บลงประวัติด้วย").toBe(ราคาย่อยเดิม);
});
