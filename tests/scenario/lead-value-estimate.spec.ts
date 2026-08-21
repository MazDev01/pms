// ── ประเมินราคาคิดให้อัตโนมัติ = พื้นที่ × ราคาขายของสาขา (บอสสั่ง 20 ส.ค. 69) ────
//
// ที่มา: บอสถามว่า "ทำไมมูลค่าถึงไม่มี แล้วเอามูลค่ามาจากไหน" — เดิมมาจากช่องที่เซลส์
// กรอกเองล้วน ๆ ไม่กรอกก็ว่าง ตอนนี้ระบบคิดให้เป็นค่าตั้งต้น แต่พิมพ์ทับได้เสมอ
//
// และช่องนี้ต้องอยู่ "ที่เดียวกัน" ทั้งฟอร์มเพิ่มและแผงแก้ไข
// (บอสแจ้ง: "ข้อมูลที่กรอกและที่แก้ไม่ตรงกัน ข้อมูลกรอกมีประเมินราคา แต่ที่แก้ไม่มี")
import { test, expect } from "@playwright/test";
import { RYG, skipReason } from "./supabaseEnv";
import { DEALER_ORIGIN, loginUI, db, pickTemplate } from "./funcHelpers";

test.skip(() => skipReason() !== "", skipReason() || "พร้อมรัน");
test.setTimeout(240_000);

test("[func] กรอกพื้นที่ + เลือกแม่แบบ → ประเมินราคาขึ้นให้เอง และพิมพ์ทับได้", async ({ page }) => {
  const sb = await db(RYG);
  await loginUI(page, DEALER_ORIGIN, "/login", RYG);
  await page.goto(`${DEALER_ORIGIN}/leads`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "เพิ่มลูกค้าเป้าหมาย" }).first().click();

  const ช่องราคา = page.getByRole("dialog").getByLabel("ประเมินราคา").or(page.locator('input[placeholder="เช่น 1200000 หรือ ฿1.2M"]')).first();
  await expect(ช่องราคา, "เปิดฟอร์มมาต้องยังว่าง — ยังไม่มีพื้นที่/แม่แบบให้คิด").toHaveValue("");

  await pickTemplate(page);
  await page.getByPlaceholder("เช่น 1200", { exact: true }).fill("100");

  // ราคาที่ต้องได้ = พื้นที่ × ราคาขายของสาขา (ราคากลางของแม่แบบที่ถูกเลือก + % ที่ตั้งไว้)
  const เลือกไว้ = await page.getByRole("dialog").getByLabel("แม่แบบ").first().inputValue();
  const { data: cat } = await sb.from("master_catalog").select("name,price,unit,subtypes,subtype_prices");
  const prod = (cat ?? []).find(c => c.name === เลือกไว้) ?? (cat ?? []).find(c => (c.subtypes as string[] | null)?.includes(เลือกไว้));
  const ย่อย = (prod?.subtype_prices as Record<string, number> | null)?.[เลือกไว้];
  const ราคากลาง = ย่อย && ย่อย > 0 ? ย่อย : Number(prod?.price ?? 0);
  test.skip(!(ราคากลาง > 0) || prod?.unit !== "ตร.ม.", "แม่แบบตัวแรกยังไม่มีราคากลาง/ไม่ได้ขายเป็น ตร.ม. ในฐานทดสอบ");

  const { data: st } = await sb.from("dealer_settings").select("pricing").eq("dealer_code", "RYG").maybeSingle();
  const pricing = (st?.pricing ?? {}) as { defaultPct?: number; byTemplate?: Record<string, number> };
  const pct = pricing.byTemplate?.[String(prod?.name && (cat ?? []).find(c => c.name === prod.name) ? "" : "")] ?? pricing.defaultPct ?? 0;
  // ช่องนี้แสดงแบบอ่านง่าย "510,000 บาท" ตอนไม่ได้พิมพ์ (บอสสั่ง 21 ส.ค. 69) — เทียบแบบมีลูกน้ำ + หน่วย
  const ตัวเลข = Math.round(Math.round(ราคากลาง * (1 + pct / 100)) * 100);
  const ที่คาด = `${ตัวเลข.toLocaleString("th-TH")} บาท`;

  await expect(ช่องราคา, "กรอกพื้นที่แล้วราคาต้องขึ้นให้เอง").toHaveValue(ที่คาด, { timeout: 15_000 });

  // พิมพ์ทับแล้วต้องอยู่กับที่ — แก้พื้นที่ต่อก็ห้ามเขียนทับของที่เซลส์ตั้งใจใส่
  await ช่องราคา.fill("999999");
  await page.getByPlaceholder("เช่น 1200", { exact: true }).fill("150");
  // พอออกจากช่องแล้วจะแสดงแบบอ่านง่าย — สิ่งที่ต้องคงอยู่คือ "ค่าที่พิมพ์เอง" ไม่ถูกคิดทับ
  await expect(ช่องราคา, "กรอกเองแล้วระบบห้ามคิดทับ").toHaveValue(/^999,999 บาท$|^999999$/);
});

test("[ui] ช่องประเมินราคาต้องมีทั้งตอนเพิ่มและตอนแก้ไข อยู่กลุ่มเดียวกัน", async ({ page }) => {
  await loginUI(page, DEALER_ORIGIN, "/login", RYG);
  await page.goto(`${DEALER_ORIGIN}/leads`, { waitUntil: "domcontentloaded" });

  const row = page.locator("tbody tr").first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  await row.getByRole("button", { name: "ดูรายละเอียด" }).first().click();

  const ช่องแก้ = page.getByLabel("ประเมินราคา").first();
  await expect(ช่องแก้, "แผงแก้ไขต้องมีช่องประเมินราคาเหมือนฟอร์มเพิ่ม").toBeVisible({ timeout: 20_000 });

  // ต้องอยู่ในกลุ่ม "รายละเอียดงาน" คู่กับแม่แบบ/พื้นที่ — ที่เดียวกับฟอร์มเพิ่ม
  const อยู่ใต้ = await ช่องแก้.evaluate(el => {
    const box = el.getBoundingClientRect();
    const หัวข้อ = Array.from(document.querySelectorAll("div")).find(d => d.textContent?.trim() === "รายละเอียดงาน");
    const พื้นที่ = document.querySelector('input[type="number"]');
    return { หลังหัวข้อ: !!หัวข้อ && หัวข้อ.getBoundingClientRect().top < box.top,
             ใกล้พื้นที่: !!พื้นที่ && Math.abs(พื้นที่.getBoundingClientRect().top - box.top) < 200 };
  });
  expect(อยู่ใต้.หลังหัวข้อ, 'ช่องประเมินราคาต้องอยู่ใต้หัวข้อ "รายละเอียดงาน"').toBe(true);
  expect(อยู่ใต้.ใกล้พื้นที่, "ต้องอยู่ใกล้ช่องพื้นที่ (กลุ่มเดียวกัน)").toBe(true);
});
