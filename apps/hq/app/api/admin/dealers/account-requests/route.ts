// ── คำขอเปลี่ยนบัญชีเข้าระบบจากตัวแทน — ฝั่งสำนักงานใหญ่ (อนุมัติ/ปฏิเสธ) ──────────
//
// ตัวแทนแก้อีเมล/รหัสผ่านเองได้ 2 ครั้งตลอดอายุบัญชี (ดู /api/account)
// ครั้งที่ 3 เป็นต้นไปจะกลายเป็น "คำขอ" ที่ยังไม่มีผล — ต้องอนุมัติที่นี่ก่อน
//
// อนุมัติแล้วมีผลทันที: ระบบเปลี่ยนอีเมล/รหัสผ่านให้ตามที่ขอ แล้วเก็บสำเนารหัสไว้ให้ HQ เปิดดูได้
// ปฏิเสธ = ไม่แตะบัญชี แต่บันทึกไว้ว่าใครปฏิเสธเพราะอะไร

import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit } from "@pms/shared/lib/rateLimit";
import { bad, authorizeAdmin, auditLog, withErrors, findDealerAccount, อีเมลถูกใช้แล้ว } from "@pms/shared/lib/adminRoute";
import { decryptSecret, dealerSecretReady } from "@pms/shared/lib/dealerSecret";

export const runtime = "nodejs";

// ใช้ตรวจ "อีเมลซ้ำ" กับระบบยืนยันตัวตนโดยตรง (ดู อีเมลถูกใช้แล้ว ใน adminRoute.ts)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const DENY = "ไม่มีสิทธิ์จัดการคำขอเปลี่ยนบัญชีของตัวแทน";
const NOT_CONFIGURED = "ยังไม่ได้ตั้งค่าเซิร์ฟเวอร์ (SUPABASE_SERVICE_ROLE_KEY) — จัดการคำขอจากที่นี่ยังไม่ได้";

// ── รายการคำขอ (ค้างก่อน แล้วตามด้วยที่ตัดสินแล้ว) ──
export const GET = withErrors("list-account-requests", async (req: NextRequest) => {
  const authz = await authorizeAdmin(req, "dealers:manage", DENY, NOT_CONFIGURED);
  if (!authz.ok) return authz.res;
  const { admin } = authz.auth;

  const { data, error } = await admin.from("dealer_account_requests")
    .select("id, dealer_code, kind, new_email, status, requested_at, decided_at, decided_by, reason")
    .order("status", { ascending: true })          // pending มาก่อน (p < a/r ตามลำดับตัวอักษร)
    .order("requested_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error("[account-requests] อ่านคำขอไม่สำเร็จ", error);
    return bad(503, "อ่านคำขอไม่สำเร็จชั่วคราว — ลองใหม่อีกครั้ง");
  }

  // ชื่อสาขาไว้แสดงคู่รหัส — อ่านทีเดียวแล้วจับคู่ ไม่ยิงทีละแถว
  const codes = Array.from(new Set((data ?? []).map(r => String(r.dealer_code))));
  const { data: dealers } = codes.length
    ? await admin.from("dealers").select("code, name").in("code", codes)
    : { data: [] as { code: string; name: string }[] };
  const ชื่อของ = new Map((dealers ?? []).map(d => [String(d.code), String(d.name)]));

  return NextResponse.json({
    requests: (data ?? []).map(r => ({
      id: String(r.id),
      dealerCode: String(r.dealer_code),
      dealerName: ชื่อของ.get(String(r.dealer_code)),
      kind: r.kind,
      newEmail: r.new_email ?? undefined,
      status: r.status,
      requestedAt: String(r.requested_at),
      decidedAt: r.decided_at ? String(r.decided_at) : undefined,
      decidedBy: r.decided_by ?? undefined,
      reason: r.reason ?? undefined,
    })),
  });
});

// ── อนุมัติ / ปฏิเสธ ──
export const PATCH = withErrors("decide-account-request", async (req: NextRequest) => {
  const authz = await authorizeAdmin(req, "dealers:manage", DENY, NOT_CONFIGURED);
  if (!authz.ok) return authz.res;
  const { admin, callerId, prof } = authz.auth;

  if (!(await checkRateLimit(admin, `decide-account-request:${callerId}`, 30, 60))) {
    return bad(429, "ตัดสินคำขอถี่เกินไป — รอสักครู่แล้วลองใหม่");
  }

  const body = (await req.json().catch(() => null)) as null | { id?: string; action?: string; reason?: string };
  const id = String(body?.id ?? "").trim();
  const action = String(body?.action ?? "");
  const reason = String(body?.reason ?? "").trim();
  if (!id) return bad(400, "ไม่ได้ระบุคำขอ");
  if (action !== "approve" && action !== "reject") return bad(400, "คำสั่งไม่ถูกต้อง");

  const { data: ใบ, error: readErr } = await admin.from("dealer_account_requests")
    .select("id, dealer_code, kind, new_email, secret, status").eq("id", id).maybeSingle();
  if (readErr) {
    console.error(`[account-requests] อ่านคำขอ ${id} ไม่สำเร็จ`, readErr);
    return bad(503, "อ่านคำขอไม่สำเร็จชั่วคราว — ลองใหม่อีกครั้ง");
  }
  if (!ใบ) return bad(404, "ไม่พบคำขอนี้");
  if (String(ใบ.status) !== "pending") return bad(409, "คำขอนี้ถูกตัดสินไปแล้ว");

  const code = String(ใบ.dealer_code);
  const อีเมลใหม่ = ใบ.new_email ? String(ใบ.new_email) : "";

  if (action === "approve") {
    const found = await findDealerAccount(admin, code);
    if (!found.ok) return found.res;

    let รหัสใหม่ = "";
    if (ใบ.secret) {
      if (!dealerSecretReady()) return bad(501, "ยังไม่ได้ตั้ง DEALER_SECRET_KEY ที่เซิร์ฟเวอร์ — อนุมัติคำขอเปลี่ยนรหัสผ่านไม่ได้");
      รหัสใหม่ = decryptSecret(String(ใบ.secret)) ?? "";
      if (!รหัสใหม่) return bad(500, "ถอดรหัสคำขอไม่สำเร็จ — ให้ตัวแทนส่งคำขอใหม่");
    }

    // อีเมลซ้ำ = คำขอนี้อนุมัติไม่ได้ ต้องบอกให้ชัด (ระบบยืนยันตัวตนตอบ 500 เนื้อความว่าง จับจากข้อความไม่ได้)
    if (อีเมลใหม่ && (await อีเมลถูกใช้แล้ว(SUPABASE_URL, SERVICE_KEY, อีเมลใหม่, found.id)) === true) {
      return bad(400, `อีเมล ${อีเมลใหม่} ถูกใช้ไปแล้วในระบบ — ให้ตัวแทนส่งคำขอใหม่ด้วยอีเมลอื่น`);
    }
    const { error: upErr } = await admin.auth.admin.updateUserById(found.id, {
      ...(รหัสใหม่ ? { password: รหัสใหม่ } : {}),
      ...(อีเมลใหม่ ? { email: อีเมลใหม่, email_confirm: true } : {}),
    });
    if (upErr) {
      if (/already|registered|exists/i.test(upErr.message ?? "")) return bad(400, `อีเมล ${อีเมลใหม่} ถูกใช้ไปแล้วในระบบ`);
      console.error(`[account-requests] อนุมัติคำขอของ ${code} ไม่สำเร็จ`, upErr);
      return bad(503, "อนุมัติไม่สำเร็จชั่วคราว — ลองใหม่อีกครั้ง");
    }

    // สำเนารหัสให้ HQ เปิดดูได้ (ที่เดียวกับรหัสที่ HQ ตั้งให้)
    if (รหัสใหม่) {
      const secret = ใบ.secret as string;
      const { error } = await admin.from("dealer_login_secrets")
        .upsert({ dealer_code: code, secret, updated_at: new Date().toISOString(), updated_by: `${prof?.name ?? ""} (อนุมัติคำขอตัวแทน)` });
      if (error) console.error(`[account-requests] เก็บสำเนารหัสของ ${code} ไม่สำเร็จ`, error);
    }
    // การเปลี่ยนที่ผ่านการอนุมัติ ไม่นับโควตาแก้เอง (by_self = false)
    const { error: logErr } = await admin.from("dealer_account_changes").insert({
      dealer_code: code, kind: ใบ.kind, new_email: อีเมลใหม่ || null, by_self: false,
    });
    if (logErr) console.error(`[account-requests] บันทึกการเปลี่ยนของ ${code} ไม่สำเร็จ`, logErr);
  }

  const { error: updErr } = await admin.from("dealer_account_requests").update({
    status: action === "approve" ? "approved" : "rejected",
    decided_at: new Date().toISOString(),
    decided_by: prof?.name ?? "",
    reason: reason || null,
  }).eq("id", id);
  if (updErr) {
    console.error(`[account-requests] อัปเดตสถานะคำขอ ${id} ไม่สำเร็จ`, updErr);
    return bad(503, "บันทึกผลไม่สำเร็จชั่วคราว — ลองใหม่อีกครั้ง");
  }

  await auditLog(admin, prof,
    action === "approve" ? "อนุมัติคำขอเปลี่ยนบัญชีของตัวแทน" : "ปฏิเสธคำขอเปลี่ยนบัญชีของตัวแทน",
    `${code}${อีเมลใหม่ ? ` · ${อีเมลใหม่}` : ""}${reason ? ` · ${reason}` : ""}`);

  return NextResponse.json({ ok: true });
});
