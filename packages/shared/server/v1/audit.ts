// ── /api/v1/audit — บันทึกการใช้งาน ─────────────────────────────────────────────
//
// ย้ายตามมาเป็นกลุ่มที่ 2 เพราะ append ถูกเรียกจากแทบทุกหน้า (useAudit)
// ถ้าไม่ย้าย จะทดสอบโหมด api ต่อไม่ได้เลย — ทุกหน้าจะสะดุดที่ audit.append
//
// พฤติกรรมคัดมาจาก SupabaseAdapter.audit เป๊ะ ๆ:
//   list   : id desc · ไล่ดึงทีละหน้า (DB คืนสูงสุด 1,000 แถว/คำขอ ขอ 5,000 ก็ได้ 1,000)
//            ⚠️ ห้ามยิง range(0, limit-1) ครั้งเดียว — เคยทำให้ข้อมูลขาดแบบเงียบ ๆ
//              หน้า /hq/audit เห็น 1,000 รายการเหมือนเป็นทั้งหมด ทั้งที่ในระบบมี 9,666 (พบ 7 ส.ค. 69)
//   append : ประทับเวลาด้วย "วันนี้ของระบบ" (APP_NOW) + เวลาจริง เพื่อให้อยู่ในช่วงตัวกรองของหน้า
//
// ⚠️ ห้ามให้ผู้เรียกส่ง user/role มาเอง — ต้องอ่านจากใบผ่านของเขา
//    ไม่งั้นลงบันทึกในนามคนอื่นได้ ซึ่งเป็นช่องโหว่ที่ปิดไปแล้วที่ migration 0115
//    (ตรงนี้ยังพึ่ง RLS ของ 0115 เป็นด่านจริงอยู่ — backend แค่ไม่เปิดช่องเพิ่ม)
import type { NextRequest } from "next/server";
import { handler, ok, dbFail, fail } from "./_ctx";
import { toCamel, toSnake } from "@pms/shared/lib/data/supabase/mappers";
import type { AuditEntry } from "@pms/shared/lib/data/types";

type Row = Record<string, unknown>;
const PAGE = 1000;

export { runtime } from "./_ctx";

/** timestamptz → สตริงไทยแบบเดียวกับที่หน้า /hq/audit อ่านได้ (parseDate) */
function fmtAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const M = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getDate()} ${M[d.getMonth()]} ${d.getFullYear() + 543} · ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export const GET = handler("audit.list", async (req: NextRequest, sb) => {
  const raw = Number(new URL(req.url).searchParams.get("limit") ?? 5000);
  const limit = Number.isFinite(raw) && raw > 0 ? Math.min(raw, 20000) : 5000;
  const rows: Row[] = [];
  for (let from = 0; from < limit; from += PAGE) {
    const to = Math.min(from + PAGE, limit) - 1;
    const { data, error } = await sb.from("audit_log").select("*").order("id", { ascending: false }).range(from, to);
    if (error) return dbFail("audit.list", error);
    const got = (data ?? []) as Row[];
    rows.push(...got);
    if (got.length < to - from + 1) break;   // หมดแล้ว ไม่ต้องยิงต่อ
  }
  return ok(rows.map(r => ({ ...toCamel<AuditEntry>(r), at: fmtAt(String(r.at)) })));
});

export const POST = handler("audit.append", async (req: NextRequest, sb) => {
  const body = (await req.json().catch(() => null)) as (Omit<AuditEntry, "id" | "at"> & { at?: string }) | null;
  if (!body || typeof body !== "object") return fail(400, "ข้อมูลบันทึกไม่ถูกต้อง");
  // at ต้องคิดที่นี่ ไม่รับจากผู้เรียก — ผู้เรียกกำหนดเวลาเองได้ = ปลอมลำดับเหตุการณ์ได้
  const { at: _ignored, ...entry } = body;
  const stamp = new URL(req.url).searchParams.get("at");   // "วันนี้ของระบบ" ที่ฝั่งแอปตรึงไว้
  const iso = stamp && !Number.isNaN(new Date(stamp).getTime()) ? new Date(stamp).toISOString() : new Date().toISOString();
  const { error } = await sb.from("audit_log").insert({ ...toSnake(entry as unknown as Row), at: iso });
  if (error) return dbFail("audit.append", error);
  return ok({ ok: true });
});
