// ── /api/v1/catalog — แคตตาล็อกแม่แบบ/ราคากลาง (กลุ่มแรกที่ย้ายมา backend) ──────────
//
// เลือกกลุ่มนี้ขึ้นก่อนเพราะเสี่ยงต่ำสุด: อ่านบ่อยมาก เขียนน้อย ไม่มี pagination ไม่มี RPC
// และมีเทสต์เดิมครอบอยู่แล้วหลายจุด (ราคากลางไปโผล่ในใบเสนอราคาทุกใบ)
//
// พฤติกรรมต้องเหมือน SupabaseAdapter.catalog เป๊ะ — คัดมาจากที่นั่นตรง ๆ:
//   list   : เรียงตาม id · แปลง snake_case → camelCase
//   save   : upsert ตามชุดที่ส่งมา (ไม่ลบแถวที่ไม่ได้ส่ง) · ตัด created_at ทิ้ง (เป็นของ DB)
//   remove : ลบตาม id ตรง ๆ
import type { NextRequest } from "next/server";
import { handler, ok, dbFail, fail } from "./_ctx";
import { toCamelList, toSnakeList } from "@pms/shared/lib/data/supabase/mappers";
import type { SolutionProduct } from "@pms/shared/lib/data/types";

type Row = Record<string, unknown>;

export { runtime } from "./_ctx";

export const GET = handler("catalog.list", async (_req: NextRequest, sb) => {
  const { data, error } = await sb.from("master_catalog").select("*").order("id", { ascending: true });
  if (error) return dbFail("catalog.list", error);
  return ok(toCamelList<SolutionProduct>((data ?? []) as Row[]));
});

export const PUT = handler("catalog.save", async (req: NextRequest, sb) => {
  const body = (await req.json().catch(() => null)) as SolutionProduct[] | null;
  if (!Array.isArray(body)) return fail(400, "ต้องส่งรายการแม่แบบมาเป็น array");
  // created_at เป็นของฐานข้อมูล — ส่งกลับไปจะทับเวลาสร้างเดิม (เหตุผลเดียวกับ dealers.save)
  const rows = toSnakeList(body as unknown as Row[]).map(r => {
    const c = { ...r };
    delete c.created_at;
    // ช่องที่ผู้เรียกไม่ได้ส่งมา = "ไม่ได้แก้" ไม่ใช่ "ให้ล้างเป็นค่าว่าง" — ตัดทิ้งไปเลย
    for (const k of Object.keys(c)) if (c[k] === undefined) delete c[k];
    return c;
  });

  // ── ต้องแบ่งกลุ่มตาม "ชุดคอลัมน์ที่ส่งมา" ก่อนบันทึก (แก้ 28 ส.ค. 69) ──────────
  //
  // อาการที่ผู้ใช้เจอ: กด "เพิ่มแม่แบบ" แล้วขึ้น
  //   "บันทึกไม่สำเร็จ: ข้อมูลไม่ครบ — มีช่องที่จำเป็นถูกเว้นว่าง" ทั้งที่กรอกครบ
  //
  // สาเหตุ: ส่งหลายแถวพร้อมกันในคำสั่งเดียว ตัวเชื่อมฐานข้อมูลจะทำให้ทุกแถว
  //   "มีคอลัมน์เท่ากัน" โดยเติม NULL ให้แถวที่ขาดคอลัมน์นั้น
  //   แม่แบบที่ยังไม่มีราคารายแม่แบบย่อยจึงถูกเติม subtype_prices = NULL
  //   ซึ่งคอลัมน์นั้นห้ามว่าง → ฐานข้อมูลปฏิเสธทั้งชุด (23502)
  //
  // แก้: จัดกลุ่มแถวที่มีชุดคอลัมน์เหมือนกัน แล้วส่งทีละกลุ่ม
  //   ไม่มีการเติม NULL ให้ใคร และคอลัมน์ที่ไม่ได้ส่งมาก็คงค่าเดิมไว้ตามเจตนาของ upsert
  const กลุ่ม = new Map<string, Row[]>();
  for (const r of rows) {
    const คีย์ = Object.keys(r).sort().join("|");
    const ก = กลุ่ม.get(คีย์);
    if (ก) ก.push(r); else กลุ่ม.set(คีย์, [r]);
  }
  for (const ชุด of กลุ่ม.values()) {
    const { error } = await sb.from("master_catalog").upsert(ชุด);
    if (error) return dbFail("catalog.save", error);
  }
  return ok({ ok: true });
});

export const DELETE = handler("catalog.remove", async (req: NextRequest, sb) => {
  const id = (new URL(req.url).searchParams.get("id") ?? "").trim();
  if (!id) return fail(400, "ไม่ได้ระบุแม่แบบที่จะลบ");
  const { error } = await sb.from("master_catalog").delete().eq("id", id);
  if (error) return dbFail("catalog.remove", error);
  return ok({ ok: true });
});
