// ── H5 · สร้างตัวแทน "พร้อมบัญชีเข้าระบบจริง" (ต้องใช้ service_role) ────────────────
//
// ทำไมต้องเป็น Route Handler ฝั่งเซิร์ฟเวอร์:
//   การสร้างบัญชีใน auth.users ต้องใช้ service_role ซึ่ง "ห้ามอยู่ในเบราว์เซอร์เด็ดขาด"
//   (ใครถือคีย์นี้ข้าม RLS ได้ทั้งระบบ) — จึงทำได้เฉพาะที่นี่ ที่รันบนเซิร์ฟเวอร์เท่านั้น
//
// เดิม (บั๊ก H5): หน้า /hq/dealers สร้างเฉพาะแถวใน dealers + โชว์รหัสให้ก๊อป
//   แต่ไม่มีบัญชี auth ผูกอยู่ → ตัวแทนใหม่ล็อกอินไม่ได้เลย · รหัสที่โชว์ไม่มีความหมายกับระบบใด
//
// ความปลอดภัยของ handler นี้ (ไล่ตามลำดับ):
//   1) ตรวจ JWT ของ "ผู้เรียก" ที่เซิร์ฟเวอร์เอง แล้วดูบทบาทจาก profiles จริง
//      — ห้ามเชื่อว่า route ถูกเรียกจากหน้าจอที่ถูกต้อง (ใครยิงตรงก็ถึง)
//   2) service_role อ่านจาก env ฝั่งเซิร์ฟเวอร์เท่านั้น (ไม่มี NEXT_PUBLIC_)
//   3) ล้มเหลวกลางทาง = ลบ auth user ที่เพิ่งสร้างทิ้ง ไม่ให้เหลือบัญชีกำพร้า
import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit } from "@pms/shared/lib/rateLimit";
import {
  bad, authorizeAdmin, auditLog, withErrors, strongPassword, findDealerAccount,
} from "@pms/shared/lib/adminRoute";

// รันบน Node เสมอ (ต้องใช้ service_role — ห้าม edge ที่อาจแคช env แปลก ๆ)
export const runtime = "nodejs";

const DEALER_EMAIL_DOMAIN = "partner-agent.co.th";

// ขั้นตอนตรวจ service_role → JWT → บทบาท → สิทธิ์ ย้ายไปอยู่ที่ adminRoute.ts (ใช้ร่วมกับ route อื่น)
// permission "dealers:manage" ผูกตรงกับ permissions.ts/RLS can_write_master · SSOT
const NOT_CONFIGURED = "ยังไม่ได้ตั้งค่าเซิร์ฟเวอร์ (SUPABASE_SERVICE_ROLE_KEY) — จัดการตัวแทนจากที่นี่ยังไม่ได้";
const DENY = "ไม่มีสิทธิ์จัดการตัวแทน";

async function must(p: PromiseLike<{ error: { message: string } | null }>) {
  const { error } = await p;
  if (error) throw new Error(error.message);
}

export const POST = withErrors("create-dealer", async (req: NextRequest) => {
  // ── 1) ตรวจ service_role + ยืนยันตัวตน + สิทธิ์ของ "ผู้เรียก" ที่เซิร์ฟเวอร์ (ห้ามเชื่อหน้าจอ) ──
  const authz = await authorizeAdmin(req, "dealers:manage", DENY, NOT_CONFIGURED);
  if (!authz.ok) return authz.res;
  const { admin, callerId, prof } = authz.auth;

  // กันยิงรัวแบบหลุดลูป (distributed ผ่าน DB · ดู rateLimit.ts)
  // 30/นาที: เดิม 10 ตึงเกินไปจนงานปกติชนเพดาน — การเปิดสาขาเป็นชุด (onboarding หลายสาขารวดเดียว
  // และชุดทดสอบโหลดที่สร้าง 10 สาขาพอดี) ชนบ่อยจนต้องล้างตัวนับด้วยมือ ซึ่งอันตรายกว่าตัวเพดานเอง
  // 30 ยังกันสคริปต์ที่หลุดลูปได้ (นับเป็นร้อย) แต่ไม่ขวางงานจริงของผู้ดูแล
  if (!(await checkRateLimit(admin, `create-dealer:${callerId}`, 30, 60))) {
    return bad(429, "สร้างตัวแทนถี่เกินไป — รอสักครู่แล้วลองใหม่");
  }

  // ── 2) ตรวจ payload ──
  const body = (await req.json().catch(() => null)) as null | {
    code?: string; name?: string; province?: string; region?: string; revenueTarget?: number;
  };
  if (!body) return bad(400, "รูปแบบข้อมูลไม่ถูกต้อง");
  const code = String(body.code ?? "").trim().toUpperCase();
  const name = String(body.name ?? "").trim();
  const province = String(body.province ?? "").trim();
  const region = String(body.region ?? "").trim();
  const revenueTarget = Number(body.revenueTarget ?? 0);
  if (!/^[A-Z]{2,5}$/.test(code)) return bad(400, "รหัสตัวแทนต้องเป็นตัวอักษร A–Z 2–5 ตัว");
  if (!name || !province) return bad(400, "ต้องระบุชื่อและจังหวัด");
  // เป้ายอดขายต้องเป็นตัวเลขที่ใช้ได้จริง — ต้องเช็ค "ก่อน" สร้างบัญชี auth ไม่งั้นค่าเพี้ยน (NaN/ติดลบ)
  // จะไปพังตอน insert แล้วต้องย้อนลบบัญชีที่เพิ่งสร้างทิ้งฟรี ๆ ทั้งที่เป็นแค่ input ผิด
  if (!Number.isFinite(revenueTarget) || revenueTarget < 0) {
    return bad(400, "เป้ายอดขายต้องเป็นตัวเลขไม่ติดลบ");
  }

  // สาขาซ้ำ = ปฏิเสธก่อนแตะ auth (กันสร้าง auth user ทิ้งฟรี)
  const { data: dupe, error: dupeErr } = await admin.from("dealers").select("code").eq("code", code).maybeSingle();
  if (dupeErr) {
    console.error("[create-dealer] ตรวจรหัสซ้ำไม่สำเร็จ", dupeErr);
    return bad(503, "ตรวจสอบรหัสตัวแทนไม่สำเร็จชั่วคราว — ลองใหม่อีกครั้ง");
  }
  if (dupe) return bad(409, `รหัส "${code}" มีอยู่แล้ว`);

  const email = `${code.toLowerCase()}@${DEALER_EMAIL_DOMAIN}`;
  const password = strongPassword("PEB-");

  // ── 3) สร้างบัญชี auth (ยืนยันอีเมลให้เลย เพราะเป็นบัญชีที่ HQ ออกให้) ──
  const { data: createdUser, error: createErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (createErr || !createdUser.user) {
    const msg = createErr?.message ?? "สร้างบัญชีเข้าระบบไม่สำเร็จ";
    // อีเมลชนกับบัญชีเดิม = โดยมากรหัสสาขาถูกใช้ไปแล้วในระบบยืนยันตัวตน
    return bad(400, /already/i.test(msg) ? `อีเมล ${email} ถูกใช้ไปแล้วในระบบยืนยันตัวตน` : msg);
  }
  const uid = createdUser.user.id;

  // ── 4) ทะเบียนสาขา + โปรไฟล์ (ผูกกับบัญชีที่เพิ่งสร้าง) · ล้มเหลว = ย้อน auth user ──
  try {
    await must(admin.from("dealers").insert({
      code, name, province, region, revenue_target: revenueTarget, status: "active",
    }));
    // profiles.id → auth.users(id) · บทบาทตั้งต้นของหัวสาขา = DEALER_ADMIN
    await must(admin.from("profiles").upsert({
      id: uid, role: "DEALER_ADMIN", dealer_code: code, name, status: "active",
    }, { onConflict: "id" }));
  } catch (e) {
    // ย้อนทุกอย่างที่อาจสร้างไปแล้ว ไม่ให้เหลือบัญชี/แถวกำพร้า
    // ต้อง log ถ้าการย้อนเองล้มเหลว — ไม่งั้นเหลือของกำพร้าโดยไม่มีใครรู้ (คือบั๊กที่การย้อนพยายามกันอยู่แท้ ๆ)
    try { await admin.auth.admin.deleteUser(uid); }
    catch (re) { console.error(`[create-dealer] ย้อนลบบัญชี ${uid} ไม่สำเร็จ — อาจเหลือบัญชีกำพร้า`, re); }
    try {
      const { error: delErr } = await admin.from("dealers").delete().eq("code", code);
      if (delErr) console.error(`[create-dealer] ย้อนลบทะเบียนสาขา ${code} ไม่สำเร็จ`, delErr);
    } catch (re) { console.error(`[create-dealer] ย้อนลบทะเบียนสาขา ${code} ไม่สำเร็จ`, re); }
    return bad(400, `สร้างทะเบียน/โปรไฟล์ไม่สำเร็จ: ${e instanceof Error ? e.message : String(e)}`);
  }

  await auditLog(admin, prof, "สร้างตัวแทน", `${code} · ${name}`);
  // คืนรหัสให้หน้าจอโชว์ให้ก๊อปไปแจ้งตัวแทน (แจ้งครั้งเดียว — ไม่เก็บไว้ที่ไหน)
  return NextResponse.json({ ok: true, email, password });
});

// ── ออกรหัสผ่านใหม่ให้ตัวแทน (HQ เท่านั้นที่คุมรหัสผ่านของตัวแทนได้ — ตัวแทนไม่มีสิทธิ์ตั้ง/ขอรีเซ็ตเอง) ──
// เดิม: หน้า /hq/dealers มีปุ่ม "รีเซ็ตรหัสผ่าน" แต่โหมด supabase กดแล้วขึ้น alert บอกว่าทำจากหน้านี้ไม่ได้
//   (รหัสผ่านตัวแทนถูก hash อยู่ใน Supabase Auth — ไม่มี route ฝั่งเซิร์ฟเวอร์รองรับมาก่อน)
// รูปแบบเดียวกับ POST: รหัสใหม่สุ่มที่เซิร์ฟเวอร์เสมอ (ไม่ให้ HQ พิมพ์รหัสเองเพื่อกันรหัสอ่อน) คืนให้โชว์ครั้งเดียว
export const PATCH = withErrors("reset-dealer-pw", async (req: NextRequest) => {
  const authz = await authorizeAdmin(req, "dealers:manage", DENY, NOT_CONFIGURED);
  if (!authz.ok) return authz.res;
  const { admin, callerId, prof } = authz.auth;

  // กันยิงรัว: รีเซ็ตรหัสผ่านได้ไม่เกิน 10 ครั้ง/นาที ต่อผู้เรียก
  if (!(await checkRateLimit(admin, `reset-dealer-pw:${callerId}`, 10, 60))) {
    return bad(429, "รีเซ็ตรหัสผ่านถี่เกินไป — รอสักครู่แล้วลองใหม่");
  }

  const code = (new URL(req.url).searchParams.get("code") ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2,5}$/.test(code)) return bad(400, "รหัสตัวแทนไม่ถูกต้อง");

  // บัญชีเข้าระบบของสาขา = โปรไฟล์เดียวที่ dealer_code ตรงกับสาขานี้ (หนึ่งสาขาหนึ่งบัญชี — ดู H5)
  const found = await findDealerAccount(admin, code);
  if (!found.ok) return found.res;

  const password = strongPassword("PEB-");
  const { data: updated, error: updateErr } = await admin.auth.admin.updateUserById(found.id, { password });
  if (updateErr || !updated.user) return bad(400, `รีเซ็ตรหัสผ่านไม่สำเร็จ: ${updateErr?.message ?? ""}`);

  await auditLog(admin, prof, "รีเซ็ตรหัสผ่านตัวแทน", code);
  return NextResponse.json({ ok: true, email: updated.user.email ?? "", password });
});

// ── ลบตัวแทน "พร้อมบัญชีเข้าระบบ" (hard delete) ────────────────────────────────────
// เดิม: ลบตัวแทนทำได้แค่ลบแถว dealers (ผ่าน RLS) → บัญชี auth ของสาขายังค้าง = บัญชีกำพร้า
//   (ล็อกอินได้แต่ไม่มีสาขา · และรหัสสาขาเดิมกลับมาสร้างซ้ำไม่ได้เพราะอีเมลชนบัญชีเก่า)
// ที่นี่ลบให้ครบ: auth user ของผู้ใช้สังกัดสาขานี้ (profile หายตาม FK cascade) + แถว dealers
export const DELETE = withErrors("delete-dealer", async (req: NextRequest) => {
  // ยืนยันตัวตน + สิทธิ์ของผู้เรียกที่เซิร์ฟเวอร์ (เหมือน POST — ห้ามเชื่อหน้าจอ)
  const authz = await authorizeAdmin(req, "dealers:manage", DENY, NOT_CONFIGURED);
  if (!authz.ok) return authz.res;
  const { admin, callerId, prof } = authz.auth;

  // กันยิงรัวแบบหลุดลูป — เพดานสูงกว่าจุดอื่น (30/นาที) เพราะการเคลียร์สาขาทีละหลายสิบเป็นงานปกติ
  // ของผู้ดูแล (และของชุดทดสอบโหลด) ต่างจากการ "สร้าง" ที่ทำทีละรายเสมอ
  // ความเสี่ยงลบผิดถูกกันด้วยด่านอื่นอยู่แล้ว: สาขาที่ยังมีข้อมูลงานขายลบไม่ได้เลย (409)
  if (!(await checkRateLimit(admin, `delete-dealer:${callerId}`, 30, 60))) {
    return bad(429, "ลบตัวแทนถี่เกินไป — รอสักครู่แล้วลองใหม่");
  }

  const code = (new URL(req.url).searchParams.get("code") ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2,5}$/.test(code)) return bad(400, "รหัสตัวแทนไม่ถูกต้อง");

  // ── กันทำลายครึ่งทาง ──
  // dealer FK เป็น on delete restrict (0018) — ถ้าสาขายังมีข้อมูลงานขาย แถว dealers ลบไม่ได้
  // เดิมลบ auth users "ก่อน" แล้วค่อยลบแถว → พอแถวลบไม่ได้ = บัญชี login หายไปแล้วแต่สาขายังอยู่
  // (สาขากำพร้าไม่มีคนเข้าได้ · ย้อนไม่ได้) → ต้องเช็ก + ลบแถวให้สำเร็จ "ก่อน" แตะ auth
  // ต้องเช็ก "ทุกตาราง" ที่ FK on delete restrict → dealers ให้ครบก่อนลบอะไรทั้งสิ้น
  //   customer_notes (0028) ก็ restrict เช่นกัน — เดิมตกหล่น → ถ้าสาขามี notes แต่ไม่มีข้อมูลใน 5 ตารางแรก
  //   จะเลย 409 ไปลบ responsible_persons/dealer_lead_rules แล้วค่อย fail ตอนลบ dealers = ลบครึ่งทาง ย้อนไม่ได้
  for (const t of ["leads", "quotations", "customers", "appointments", "files", "customer_notes"]) {
    const { count, error: cntErr } = await admin.from(t)
      .select("dealer_code", { count: "exact", head: true }).eq("dealer_code", code);
    // นับไม่ได้ ≠ ไม่มีข้อมูล — ถ้าปล่อยผ่านจะลบสาขาทั้งที่อาจยังมีข้อมูลค้างอยู่จริง
    if (cntErr) {
      console.error(`[delete-dealer] นับข้อมูลค้างในตาราง ${t} ของสาขา ${code} ไม่สำเร็จ`, cntErr);
      return bad(503, "ตรวจสอบข้อมูลค้างของสาขาไม่สำเร็จชั่วคราว — ลองใหม่อีกครั้ง");
    }
    if ((count ?? 0) > 0) {
      return bad(409, `สาขา "${code}" ยังมีข้อมูล (${t}) — ต้องย้าย/ลบข้อมูลก่อนจึงจะลบสาขาได้`);
    }
  }

  // ── หา "บัญชีที่ต้องลบตาม" ให้ครบ ก่อน แตะอะไรทั้งสิ้น ──
  // เดิมอ่าน profiles หลังลบแถว dealers ไปแล้ว และไม่เช็ค error ของ select → ถ้า select พลาด
  // จะได้ลิสต์ว่าง ลบบัญชีไปศูนย์บัญชี แต่ยังตอบ ok:true — เหลือบัญชีกำพร้าที่ยังผูก dealer_code เดิม
  // ถ้ารหัสสาขานั้นถูกนำกลับมาใช้ใหม่ภายหลัง บัญชีเก่าจะเห็นข้อมูลของสาขาใหม่ทันที (พบจากตรวจสอบระบบ 5 ส.ค. 69)
  const { data: members, error: memErr } = await admin.from("profiles").select("id").eq("dealer_code", code);
  if (memErr) {
    console.error(`[delete-dealer] อ่านรายชื่อบัญชีของสาขา ${code} ไม่สำเร็จ`, memErr);
    return bad(503, "อ่านรายชื่อบัญชีของสาขาไม่สำเร็จชั่วคราว — ลองใหม่อีกครั้ง");
  }

  // ค่าตั้งของสาขาเอง (FK restrict เช่นกัน) — ลบก่อนแถว dealers
  await admin.from("responsible_persons").delete().eq("dealer_code", code);
  await admin.from("dealer_lead_rules").delete().eq("dealer_code", code);
  // ลบแถว dealers ก่อน — จุดที่อาจ fail · สำเร็จแล้วค่อยแตะ auth ที่ย้อนไม่ได้
  // .select() เพื่อรู้จำนวนแถวที่ลบจริง — PostgREST ไม่ error เมื่อ filter ไม่ตรงแถวไหนเลย
  //   เดิมไม่เช็ก → ลบรหัสสาขาที่ไม่มีจริงก็ได้ 200 + เขียน audit log "ลบตัวแทน" ทั้งที่ไม่มีอะไรถูกลบ (Medium, 30 ก.ค. 69)
  const { data: deleted, error } = await admin.from("dealers").delete().eq("code", code).select("code");
  if (error) return bad(400, `ลบตัวแทนไม่สำเร็จ: ${error.message}`);
  if (!deleted || deleted.length === 0) return bad(404, `ไม่พบตัวแทนรหัส "${code}"`);

  // ลบบัญชี auth ของผู้ใช้สังกัดสาขา (profile หายตาม cascade) — ทำท้ายสุด
  // เก็บรายชื่อที่ลบไม่สำเร็จไว้บอกผู้เรียกตรง ๆ ไม่กลืนเงียบ — บัญชีที่ค้างคือช่องข้ามสาขาถ้ารหัสถูกใช้ซ้ำ
  const orphans: string[] = [];
  for (const m of members ?? []) {
    try {
      const { error: delErr } = await admin.auth.admin.deleteUser(String(m.id));
      if (delErr) { orphans.push(String(m.id)); console.error(`[delete-dealer] ลบบัญชี ${m.id} ของสาขา ${code} ไม่สำเร็จ`, delErr); }
    } catch (e) {
      orphans.push(String(m.id));
      console.error(`[delete-dealer] ลบบัญชี ${m.id} ของสาขา ${code} ไม่สำเร็จ`, e);
    }
  }

  if (orphans.length) {
    // ทะเบียนสาขาถูกลบไปแล้ว (ย้อนไม่ได้) แต่ต้องไม่รายงานว่าสำเร็จทั้งหมด — และห้ามนำรหัสนี้กลับมาใช้ใหม่
    // จนกว่าจะเคลียร์บัญชีค้างเสร็จ ไม่งั้นบัญชีเก่าจะเห็นข้อมูลของสาขาใหม่
    await auditLog(admin, prof, "ลบตัวแทน (บัญชีค้าง)", `${code} · เหลือบัญชีที่ลบไม่สำเร็จ ${orphans.length} บัญชี`);
    return bad(500, `ลบทะเบียนสาขา "${code}" แล้ว แต่ลบบัญชีเข้าระบบไม่สำเร็จ ${orphans.length} บัญชี — ` +
      `ห้ามนำรหัส "${code}" กลับมาใช้ใหม่จนกว่าผู้ดูแลระบบจะเคลียร์บัญชีค้างเสร็จ`);
  }

  await auditLog(admin, prof, "ลบตัวแทน", code);
  return NextResponse.json({ ok: true });
});
