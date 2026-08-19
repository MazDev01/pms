import { test, expect } from "@playwright/test";
import { RYG, CNX, skipReason } from "./supabaseEnv";
import { getSession } from "./helpers";
import { createClient } from "@supabase/supabase-js";
import { ADMIN_SUPABASE_URL, ADMIN_SERVICE_ROLE_KEY } from "./adminEnv";

// ── ด่านจำกัดจำนวนคำขอบนเส้นทางงานขาย (ผลตรวจระบบ 19 ส.ค. 69) ──────────────────
// เดิมด่านนี้มีเฉพาะ /api/admin/* งานขายทั้งหมดยิงได้ไม่จำกัด
// บัญชีที่ถูกขโมยจึงดูดข้อมูลทั้งสาขาออกไปได้เร็วมากโดยไม่มีอะไรหน่วง
//
// ที่ล็อกไว้: เกินโควตาต้องได้ 429 · โควตาอ่านกับเขียนแยกถัง · โควตาของแต่ละคนแยกกัน
test.skip(() => skipReason() !== "", skipReason() || "พร้อมรัน");
test.setTimeout(180_000);

const DEALER = "http://localhost:3001";
const admin = createClient(ADMIN_SUPABASE_URL, ADMIN_SERVICE_ROLE_KEY);
const WRITE_QUOTA = 120;   // ต้องตรงกับ LIMIT_WRITE ใน packages/shared/server/v1/_ctx.ts

async function ยิง(token: string, method: "GET" | "POST") {
  const r = await fetch(`${DEALER}/api/v1/leads?dealerCode=RYG`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: method === "GET" ? undefined : JSON.stringify({ company: "" }),
  });
  return r.status;
}

test("[security] ยิงคำขอเขียนเกินโควตา → ถูกปฏิเสธ 429 และงานอ่านยังทำได้", async () => {
  const s = await getSession(RYG);
  await admin.from("rate_limits").delete().like("key", `v1:%${s.user.id}`);

  // ยิงพร้อมกันให้จบก่อนหน้าต่างเวลารีเซ็ต (ยิงทีละครั้งจะช้าเกิน 60 วิ แล้วตัวนับเริ่มใหม่)
  const ผล = await Promise.all(Array.from({ length: WRITE_QUOTA + 60 }, () => ยิง(s.access_token, "POST")));
  const ถูกปฏิเสธ = ผล.filter(x => x === 429).length;
  expect(ถูกปฏิเสธ, "ยิงเกินโควตาแล้วต้องมีคำขอที่ถูกปฏิเสธ").toBeGreaterThan(0);
  expect(ผล.filter(x => x !== 429 && x !== 0).length, "จำนวนที่ผ่านต้องไม่เกินโควตา").toBeLessThanOrEqual(WRITE_QUOTA);

  // ถังอ่านต้องไม่ถูกกระทบ — คนทำงานยังเปิดหน้าดูข้อมูลได้แม้ฝั่งเขียนโดนจำกัด
  expect(await ยิง(s.access_token, "GET"), "อ่านข้อมูลต้องยังทำได้").toBe(200);

  await admin.from("rate_limits").delete().like("key", `v1:%${s.user.id}`);
});

test("[security] โควตาของแต่ละบัญชีแยกกัน — คนหนึ่งยิงเต็มไม่ทำให้อีกคนใช้งานไม่ได้", async () => {
  const a = await getSession(RYG), b = await getSession(CNX);
  await admin.from("rate_limits").delete().like("key", "v1:%");

  await Promise.all(Array.from({ length: WRITE_QUOTA + 30 }, () => ยิง(a.access_token, "POST")));
  // อีกบัญชีต้องยังยิงได้ตามปกติ (ต้องไม่ใช่ 429)
  expect(await ยิง(b.access_token, "GET"), "บัญชีอื่นต้องไม่โดนหางเลข").not.toBe(429);

  await admin.from("rate_limits").delete().like("key", "v1:%");
});
