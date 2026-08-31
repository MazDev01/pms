// ── เพิ่มแม่แบบย่อย: ใส่รูป + ชื่อ + ราคา ได้ในจังหวะเดียว (บอสสั่ง 28 ส.ค. 69) ──────
//
// เดิมแถวเพิ่มมีแค่ช่องชื่อ ต้องกด "เพิ่ม" ให้แถวโผล่ก่อน จึงจะใส่รูป/ราคาได้
//   สาเหตุ: รูปกับราคาเก็บโดยใช้ "ชื่อ" เป็นกุญแจ (subtype_images / subtype_prices)
//   ผู้ใช้มองไม่เห็นเหตุผลนั้น เห็นแค่ช่องชื่อเปล่า ๆ แล้วเข้าใจว่าใส่ราคา/รูปไม่ได้เลย
//
// เทสต์นี้พิสูจน์ที่ "ฐานข้อมูลจริง" ไม่ใช่แค่หน้าจอ — กรอกครบในแถวเพิ่มแล้วกดบันทึก
// ค่าทั้งสองต้องลงคอลัมน์ของมันจริง ไม่ใช่หายไประหว่างทาง
import { test, expect } from "@playwright/test";
import { ADMIN, skipReason } from "./supabaseEnv";
import { HQ_ORIGIN, loginUI, db, TAG } from "./funcHelpers";
import { settle } from "./helpers";

test.skip(() => skipReason() !== "", skipReason() || "พร้อมรัน");
test.setTimeout(180_000);

const ชื่อแม่แบบ = `${TAG}-แม่แบบย่อยรวดเดียว`;
const ชื่อย่อย = "โรงงานอาหาร";
const ราคาย่อย = 12345;

// รูป png 1x1 จริง — ต้องเป็นไฟล์ภาพที่อ่านได้จริง ไม่งั้นตัวย่อขนาดจะปฏิเสธตั้งแต่ต้นทาง
const รูปทดสอบ = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function ล้างของทดสอบ() {
  const sb = await db(ADMIN);
  await sb.from("master_catalog").delete().like("name", `%${ชื่อแม่แบบ}%`);
}
test.beforeAll(ล้างของทดสอบ);
test.afterAll(ล้างของทดสอบ);

test("[func·hq] เพิ่มแม่แบบย่อยพร้อมรูปและราคาในครั้งเดียว → ลงฐานข้อมูลครบ", async ({ page }) => {
  const sb = await db(ADMIN);
  await loginUI(page, HQ_ORIGIN, "/hq/login", ADMIN);
  await page.goto(`${HQ_ORIGIN}/hq/master`, { waitUntil: "domcontentloaded" });
  await settle(page);

  await page.getByRole("button", { name: /เพิ่มแม่แบบ/ }).first().click();

  // แม่แบบหลัก (ช่องชื่อไม่มี aria-label — จับด้วยข้อความตัวอย่างในช่องแทน)
  await page.getByPlaceholder("เช่น โกดังสำเร็จรูป").fill(ชื่อแม่แบบ);
  await page.getByLabel("ราคากลาง (บาท)").fill("9000");

  // ── หัวใจของเทสต์: แถวเพิ่มต้องมีครบทั้งรูป ชื่อ ราคา ตั้งแต่ก่อนกด "เพิ่ม" ──
  await page.getByLabel("เลือกรูปแม่แบบย่อยใหม่")
    .setInputFiles({ name: "ย่อย.png", mimeType: "image/png", buffer: รูปทดสอบ });
  await page.getByLabel("ชื่อแม่แบบย่อยใหม่").fill(ชื่อย่อย);
  await page.getByLabel("ราคากลางของแม่แบบย่อยใหม่").fill(String(ราคาย่อย));
  await page.getByRole("button", { name: /^\+?\s*เพิ่ม$/ }).last().click();

  // แถวที่เพิ่มแล้วต้องถือราคาที่กรอกไว้ (ไม่ใช่ว่างแล้วตกไปใช้ราคาแม่แบบหลัก)
  await expect(page.getByLabel(`ราคากลางของ ${ชื่อย่อย}`)).toHaveValue(/12,?345/);

  await page.getByRole("button", { name: /^บันทึก/ }).last().click();

  // ── พิสูจน์ที่ฐานข้อมูล ──
  type แถวแคตตาล็อก = { subtypes: string[]; subtype_prices: Record<string, number>; subtype_images: Record<string, string> };
  const อ่านแถว = async (): Promise<แถวแคตตาล็อก | null> => {
    const { data } = await sb.from("master_catalog")
      .select("subtypes,subtype_prices,subtype_images").eq("name", ชื่อแม่แบบ).maybeSingle();
    return (data as แถวแคตตาล็อก | null) ?? null;
  };
  await expect.poll(async () => (await อ่านแถว())?.subtypes ?? [],
    { timeout: 30_000, message: "แม่แบบย่อยต้องถูกบันทึกลงฐานข้อมูล" }).toContain(ชื่อย่อย);

  const แถว = (await อ่านแถว())!;
  expect(แถว.subtype_prices?.[ชื่อย่อย], "ราคาที่กรอกในแถวเพิ่มต้องลงฐานข้อมูล").toBe(ราคาย่อย);
  expect(String(แถว.subtype_images?.[ชื่อย่อย] ?? ""), "รูปที่เลือกในแถวเพิ่มต้องลงฐานข้อมูล").toMatch(/^data:image\//);
});
