import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { ADMIN_SUPABASE_URL, ADMIN_SERVICE_ROLE_KEY } from "./adminEnv";
import { REAL_BACKEND } from "./supabaseEnv";

// ── ยอดสะสมของลูกค้า ต้องตรงกับใบที่ปิดการขายได้ "เสมอ" แม้ไม่มีใครสั่งให้คำนวณ ─────────
//
// เดิมยอดนี้ถูกต้องได้ก็ต่อเมื่อแอปเรียกคำสั่งคำนวณให้ถูกที่ถูกเวลา — เส้นทางไหนลืมเรียก
// หรือเรียกไม่สำเร็จ (เน็ตหลุดกลางทาง) ยอดจะเพี้ยนค้างไว้โดยไม่มีใครรู้
// เคยเจอจริงจากชุดตรวจรับ: ลูกค้าที่มียอดสะสมหลายล้าน แต่ไม่มีใบเสนอราคาสักใบ
//
// 0114 ย้ายการรับประกันลงไปที่ชั้นฐานข้อมูล — เทสต์นี้เขียนข้อมูลตรงเข้าฐานข้อมูล
// (ไม่ผ่านแอปเลย) แล้วดูว่ายอดขยับเองถูกต้องไหม
test.skip(!REAL_BACKEND, "ต้องใช้ฐานข้อมูลจริง");
test.describe.configure({ mode: "serial" });

const db = createClient(ADMIN_SUPABASE_URL, ADMIN_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const TAG = "ZZTEST-TOTAL";
const CID = 990301;
const DEALER = "RYG";

async function totalOf(): Promise<number> {
  const { data } = await db.from("customers").select("total_value").eq("dealer_code", DEALER).eq("id", CID);
  return Number(data?.[0]?.total_value ?? -1);
}
async function cleanup() {
  await db.from("quotations").delete().like("id", `${TAG}%`);
  await db.from("customers").delete().eq("dealer_code", DEALER).eq("id", CID);
}

test.beforeAll(async () => {
  await cleanup();
  const { error } = await db.from("customers").insert({
    id: CID, dealer_code: DEALER, company: `${TAG}-ลูกค้า`, name: `${TAG}-ลูกค้า`,
    province: "ระยอง", status: "active", total_value: 0,
  });
  if (error) throw new Error(`เตรียมลูกค้าไม่สำเร็จ: ${error.message}`);
});
test.afterAll(async () => { await cleanup(); });

test("เพิ่มใบที่ปิดการขายได้ → ยอดลูกค้าขยับเองทันที", async () => {
  const { error } = await db.from("quotations").insert({
    id: `${TAG}-Q1`, dealer_code: DEALER, customer_id: CID, status: "won",
    total_value: 500_000, customer: `${TAG}-ลูกค้า`, date: "2026-05-01",
  });
  expect(error?.message ?? "", "เพิ่มใบต้องสำเร็จ").toBe("");
  expect(await totalOf(), "ยอดลูกค้าต้องเท่ากับใบที่ปิดได้ โดยไม่ต้องมีใครสั่งคำนวณ").toBe(500_000);
});

test("เพิ่มใบที่ยังไม่ปิด → ยอดต้องไม่ขยับ", async () => {
  const { error } = await db.from("quotations").insert({
    id: `${TAG}-Q2`, dealer_code: DEALER, customer_id: CID, status: "draft",
    total_value: 999_999, customer: `${TAG}-ลูกค้า`, date: "2026-05-02",
  });
  expect(error?.message ?? "").toBe("");
  expect(await totalOf(), "ใบร่างต้องไม่ถูกนับเป็นยอดขาย").toBe(500_000);
});

test("เลื่อนใบร่างเป็นปิดการขายได้ → ยอดเพิ่มตาม", async () => {
  await db.from("quotations").update({ status: "won" }).eq("id", `${TAG}-Q2`).eq("dealer_code", DEALER);
  expect(await totalOf(), "ยอดต้องรวมใบที่เพิ่งปิดด้วย").toBe(1_499_999);
});

test("ย้อนใบกลับเป็นไม่สำเร็จ → ยอดลดลงตาม ไม่ค้างเกินจริง", async () => {
  await db.from("quotations").update({ status: "lost" }).eq("id", `${TAG}-Q2`).eq("dealer_code", DEALER);
  expect(await totalOf(), "ยอดต้องลดกลับ").toBe(500_000);
});

test("ลบใบที่ปิดการขายได้ → ยอดลดลงตาม", async () => {
  await db.from("quotations").delete().eq("id", `${TAG}-Q1`).eq("dealer_code", DEALER);
  expect(await totalOf(), "ลบใบแล้วยอดต้องกลับเป็น 0").toBe(0);
});

test("ปิดการขายหลายใบพร้อมกัน → ยอดต้องครบทุกใบ ไม่หายไปใบใดใบหนึ่ง", async () => {
  // จุดที่พังจริง: สองคำสั่งรวมยอดจาก "ภาพ ณ เวลาของตัวเอง" คนเขียนทีหลังทับด้วยยอดที่ยังไม่เห็นอีกใบ
  const ids = [1, 2, 3, 4, 5].map(n => `${TAG}-P${n}`);
  await db.from("quotations").delete().in("id", ids);
  await Promise.all(ids.map((id, i) => db.from("quotations").insert({
    id, dealer_code: DEALER, customer_id: CID, status: "won",
    total_value: (i + 1) * 100_000, customer: `${TAG}-ลูกค้า`, date: "2026-05-10",
  })));
  // 100k+200k+300k+400k+500k = 1,500,000
  await expect.poll(totalOf, { timeout: 20_000, message: "ยอดต้องรวมครบทั้ง 5 ใบ" }).toBe(1_500_000);
});
