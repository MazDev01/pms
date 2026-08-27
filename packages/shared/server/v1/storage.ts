// ── /api/v1/storage — ไฟล์จริง (bytes) ใน Supabase Storage ─────────────────────
//
// ระยะ 1 กลุ่มที่ 17 · bucket dealer-files/{รหัสสาขา}/... — Storage RLS คุมด้วย foldername[1]
// จึงต้องขึ้นต้นพาธด้วยรหัสสาขาเสมอ ห้ามแตะกติกานี้
//
// ⚠️ ชื่อไฟล์ที่เป็น key ต้องเป็น ASCII ล้วน — ไทย/ช่องว่างทำให้ Storage ตอบ "Invalid key"
//    ชื่อจริงที่ผู้ใช้เห็นเก็บแยกอยู่ใน files.name อยู่แล้ว
//
// ⚠️ อัปโหลดเป็น multipart ไม่ใช่ JSON — เส้นทางนี้จึงไม่ผ่าน apiFetch ปกติของฝั่งแอป
import type { NextRequest } from "next/server";
import { handler, ok, dbFail, fail } from "./_ctx";

const BUCKET = "dealer-files";
export { runtime } from "./_ctx";

export const POST = handler("storage.upload", async (req: NextRequest, sb) => {
  const form = await req.formData().catch(() => null);
  const dealer = String(form?.get("dealerCode") ?? "").trim();
  const file = form?.get("file");
  if (!dealer || !(file instanceof File)) return fail(400, "ต้องระบุสาขาและไฟล์");
  const stamp = Number(form?.get("stamp")) || Date.now();
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_") || "file";
  const path = `${dealer}/${stamp}-${safe}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, file, { upsert: false });
  if (error) return dbFail("storage.upload", error as { message: string; code?: string });
  return ok(path);
});

export const GET = handler("storage.signedUrl", async (req: NextRequest, sb) => {
  const path = new URL(req.url).searchParams.get("path") ?? "";
  if (!path) return fail(400, "ไม่ได้ระบุไฟล์");
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error) return dbFail("storage.signedUrl", error as { message: string; code?: string });
  return ok(data?.signedUrl ?? null);
});

export const DELETE = handler("storage.remove", async (req: NextRequest, sb) => {
  const path = new URL(req.url).searchParams.get("path") ?? "";
  if (!path) return fail(400, "ไม่ได้ระบุไฟล์");
  // ⚠️ ที่เก็บไฟล์ "ไม่ฟ้อง error" เมื่อกฎความปลอดภัยกันไว้ — คืนรายการที่ลบได้จริงเป็นอาร์เรย์ว่างแทน
  //    เดิมตอบ {ok:true} ทุกครั้ง → สาขาอื่นสั่งลบไฟล์ของเราแล้วหน้าจอขึ้นว่า "ลบแล้ว" ทั้งที่ไฟล์ยังอยู่
  //    (ยิงจริงยืนยัน 27 ส.ค. 69: CNX สั่งลบไฟล์ของ RYG ได้ 200 แต่ไฟล์ยังดาวน์โหลดได้อยู่)
  const { data, error } = await sb.storage.from(BUCKET).remove([path]);
  if (error) return dbFail("storage.remove", error as { message: string; code?: string });
  if (!data?.length) return fail(404, "ลบไฟล์ไม่สำเร็จ — ไม่พบไฟล์นี้ หรือไม่มีสิทธิ์ลบ");
  return ok({ ok: true });
});
