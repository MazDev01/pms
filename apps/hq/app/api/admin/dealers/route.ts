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
import type { SupabaseClient } from "@supabase/supabase-js";
import { checkRateLimit } from "@pms/shared/lib/rateLimit";
import {
  bad, authorizeAdmin, auditLog, withErrors, strongPassword, findDealerAccount, deleteAuthUserLoud,
} from "@pms/shared/lib/adminRoute";
import { encryptSecret, dealerSecretReady } from "@pms/shared/lib/dealerSecret";

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

/** เก็บสำเนารหัสผ่าน (เข้ารหัส) ให้ HQ เปิดดูย้อนหลังได้ — บอสสั่ง 5 ส.ค. 69
 *  ล้มเหลวต้องไม่ทำให้การสร้าง/รีเซ็ตพัง (รหัสถูกตั้งที่ Auth ไปแล้ว) แต่ต้องดังพอให้รู้
 *  ถ้ายังไม่ตั้ง DEALER_SECRET_KEY จะ "ไม่เก็บ" ไม่ใช่เก็บเป็นข้อความเปล่า — ดู dealerSecret.ts */
async function rememberSecret(admin: SupabaseClient, code: string, password: string, by: string) {
  if (!dealerSecretReady()) {
    console.warn(`[dealer-secret] ยังไม่ได้ตั้ง DEALER_SECRET_KEY — ไม่เก็บสำเนารหัสของ ${code}`);
    return;
  }
  const secret = encryptSecret(password);
  if (!secret) { console.error(`[dealer-secret] เข้ารหัสรหัสของ ${code} ไม่สำเร็จ`); return; }
  const { error } = await admin.from("dealer_login_secrets")
    .upsert({ dealer_code: code, secret, updated_at: new Date().toISOString(), updated_by: by });
  if (error) console.error(`[dealer-secret] เก็บสำเนารหัสของ ${code} ไม่สำเร็จ`, error);
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
    email?: string; password?: string;
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

  // ── อีเมล/รหัสผ่าน: HQ กรอกเองได้ (บอสสั่ง 20 ส.ค. 69) · ไม่กรอก = ระบบตั้งให้เหมือนเดิม ──
  //
  // ทำไมต้องให้กรอกเอง: สาขาจริงใช้อีเมลธุรกิจของตัวเอง (เช่น sales@cmsteelbuild.co.th)
  //   อีเมลที่ระบบประกอบจากรหัสสาขาไม่มีอยู่จริง — รับอีเมลยืนยัน/ลืมรหัสผ่านไม่ได้เลย
  //
  // ⚠️ ต้องตรวจที่เซิร์ฟเวอร์เสมอ ห้ามเชื่อว่าหน้าจอตรวจมาแล้ว (ใครยิง route ตรงก็ถึง)
  //    รหัสผ่านสั้น ๆ ที่หลุดเข้ามาทางนี้ = บัญชีของสาขาถูกเดารหัสได้จริง
  const อีเมลที่กรอก = String(body.email ?? "").trim().toLowerCase();
  const รหัสที่กรอก = String(body.password ?? "");
  if (อีเมลที่กรอก && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(อีเมลที่กรอก)) {
    return bad(400, "รูปแบบอีเมลไม่ถูกต้อง");
  }
  if (รหัสที่กรอก && รหัสที่กรอก.length < 8) {
    return bad(400, "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร");
  }
  const email = อีเมลที่กรอก || `${code.toLowerCase()}@${DEALER_EMAIL_DOMAIN}`;
  const password = รหัสที่กรอก || strongPassword("PEB-");

  // ── 3) สร้างบัญชี auth (ยืนยันอีเมลให้เลย เพราะเป็นบัญชีที่ HQ ออกให้) ──
  const { data: createdUser, error: createErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (createErr || !createdUser.user) {
    const msg = createErr?.message ?? "สร้างบัญชีเข้าระบบไม่สำเร็จ";
    // แยกให้ชัดว่าเป็นความผิดของ "คำขอ" หรือของ "ระบบ" — ผู้ใช้ทำต่างกันคนละเรื่อง
    //   400 = ผู้ใช้แก้เองได้ (เปลี่ยนรหัสสาขา) · 503 = ระบบขัดข้อง ให้ลองใหม่ ไม่ใช่ความผิดผู้ใช้
    // เดิมตอบ 400 พร้อมข้อความดิบจากระบบยืนยันตัวตนทุกกรณี — ผู้ใช้เห็นแล้วนึกว่าตัวเองกรอกผิด
    // แล้วลองแก้ข้อมูลไปเรื่อย ๆ ทั้งที่ปัญหาอยู่ที่เซิร์ฟเวอร์ · ทั้งยังเผยรายละเอียดภายในออกไปด้วย
    if (/already/i.test(msg)) return bad(400, `อีเมล ${email} ถูกใช้ไปแล้วในระบบยืนยันตัวตน`);
    console.error(`[create-dealer] สร้างบัญชีเข้าระบบของสาขา ${code} ไม่สำเร็จ`, createErr);
    return bad(503, "สร้างบัญชีเข้าระบบไม่สำเร็จชั่วคราว — ลองใหม่อีกครั้ง");
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
    // ชื่อบริษัทตั้งต้น = ชื่อที่ HQ ตั้งให้ตอนเปิดสาขา (บอสสั่ง 18 ส.ค. 69)
    //   เดิมช่อง "ชื่อบริษัท" ของสาขาว่างเอาไว้ → หัวเอกสาร/แถบบน/เมนูซ้ายเลยตกไปขึ้น "รหัสสาขา"
    //   จนกว่าสาขาจะไปกรอกเอง — ชื่อใน HQ กับที่สาขาเห็นจึงไม่ตรงกัน (ผู้ใช้แจ้ง)
    //   ⚙️ เป็นแค่ "ค่าตั้งต้น" — สาขาแก้ทีหลังได้ตามปกติที่หน้าตั้งค่า และจะไม่ทับของสาขาที่เคยตั้งไว้ (onConflict do nothing)
    const { error: setErr } = await admin.from("dealer_settings")
      .insert({ dealer_code: code, issuer: { company: name } });
    // ล้มตรงนี้ไม่ควรทำให้การสร้างสาขาล้มทั้งหมด — แต่ห้ามเงียบ ต้องมีร่องรอยให้ตามได้
    if (setErr && setErr.code !== "23505") console.error(`[create-dealer] ตั้งชื่อบริษัทตั้งต้นของสาขา ${code} ไม่สำเร็จ`, setErr);
  } catch (e) {
    // ย้อนทุกอย่างที่อาจสร้างไปแล้ว ไม่ให้เหลือบัญชี/แถวกำพร้า
    // ต้อง log ถ้าการย้อนเองล้มเหลว — ไม่งั้นเหลือของกำพร้าโดยไม่มีใครรู้ (คือบั๊กที่การย้อนพยายามกันอยู่แท้ ๆ)
    await deleteAuthUserLoud(admin, uid, "create-dealer");
    try {
      const { error: delErr } = await admin.from("dealers").delete().eq("code", code);
      if (delErr) console.error(`[create-dealer] ย้อนลบทะเบียนสาขา ${code} ไม่สำเร็จ`, delErr);
    } catch (re) { console.error(`[create-dealer] ย้อนลบทะเบียนสาขา ${code} ไม่สำเร็จ`, re); }
    // ถึงตรงนี้แปลว่าคำขอผ่านการตรวจความถูกต้องมาหมดแล้ว — ที่พังคือฝั่งเซิร์ฟเวอร์ ไม่ใช่ข้อมูลที่กรอก
    console.error(`[create-dealer] สร้างทะเบียน/โปรไฟล์สาขา ${code} ไม่สำเร็จ`, e);
    return bad(503, "สร้างตัวแทนไม่สำเร็จชั่วคราว — ลองใหม่อีกครั้ง");
  }

  await rememberSecret(admin, code, password, String(prof.name ?? ""));
  await auditLog(admin, prof, "สร้างตัวแทน", `${code} · ${name}`);
  // คืนรหัสให้หน้าจอโชว์ให้ก๊อปไปแจ้งตัวแทน (และเก็บสำเนาเข้ารหัสไว้ให้ HQ เปิดดูภายหลังได้)
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

  // ── HQ แก้อีเมล/ตั้งรหัสผ่านเองได้ (บอสสั่ง 20 ส.ค. 69) ────────────────────────
  //   ไม่ส่งอะไรมาเลย = "รีเซ็ตรหัสผ่าน" แบบเดิม (สุ่มรหัสให้)
  //   ส่ง email มา = เปลี่ยนอีเมลเข้าระบบของสาขา · ส่ง password มา = ตั้งรหัสตามที่กรอก
  //   ⚠️ ตรวจที่เซิร์ฟเวอร์เสมอ เหมือนตอนสร้าง — ห้ามเชื่อว่าหน้าจอตรวจมาแล้ว
  const แก้ = (await req.json().catch(() => null)) as null | { email?: string; password?: string };
  const อีเมลใหม่ = String(แก้?.email ?? "").trim().toLowerCase();
  const รหัสที่กรอก = String(แก้?.password ?? "");
  if (อีเมลใหม่ && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(อีเมลใหม่)) return bad(400, "รูปแบบอีเมลไม่ถูกต้อง");
  if (รหัสที่กรอก && รหัสที่กรอก.length < 8) return bad(400, "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร");

  // ขอแก้เฉพาะอีเมล = ห้ามเปลี่ยนรหัสผ่านทิ้งโดยไม่ได้ขอ (สาขาที่ใช้รหัสเดิมอยู่จะหลุดทันที)
  const แก้อีเมลอย่างเดียว = !!อีเมลใหม่ && !รหัสที่กรอก;
  const password = แก้อีเมลอย่างเดียว ? "" : (รหัสที่กรอก || strongPassword("PEB-"));

  const { data: updated, error: updateErr } = await admin.auth.admin.updateUserById(found.id, {
    ...(password ? { password } : {}),
    ...(อีเมลใหม่ ? { email: อีเมลใหม่, email_confirm: true } : {}),
  });
  if (updateErr || !updated.user) {
    const msg = updateErr?.message ?? "";
    // อีเมลชนกับบัญชีอื่น = ผู้ใช้แก้เองได้ (เปลี่ยนอีเมล) ไม่ใช่ระบบขัดข้อง
    if (/already|registered|exists/i.test(msg)) return bad(400, `อีเมล ${อีเมลใหม่} ถูกใช้ไปแล้วในระบบยืนยันตัวตน`);
    console.error(`[reset-dealer-pw] แก้บัญชีเข้าระบบของสาขา ${code} ไม่สำเร็จ`, updateErr);
    return bad(503, "แก้บัญชีเข้าระบบไม่สำเร็จชั่วคราว — ลองใหม่อีกครั้ง");
  }

  if (password) await rememberSecret(admin, code, password, String(prof.name ?? ""));
  await auditLog(admin, prof,
    อีเมลใหม่ ? (password ? "แก้อีเมลและรหัสผ่านตัวแทน" : "แก้อีเมลเข้าระบบตัวแทน") : "รีเซ็ตรหัสผ่านตัวแทน",
    อีเมลใหม่ ? `${code} · ${อีเมลใหม่}` : code);
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
  // ── ตรวจ + ลบทั้งชุดในธุรกรรมเดียว (RPC 0119) ──
  //
  // เดิมยิงคำสั่งลบทีละก้อนแยกกันจากที่นี่: responsible_persons → dealer_lead_rules → dealers
  //   สองก้อนแรกไม่เช็กผลด้วย · ถ้าก้อนสุดท้ายพลาด ค่าตั้งของสาขาหายไปแล้วและกู้กลับไม่ได้
  //   สาขายังอยู่ แต่ผู้รับผิดชอบ/กฎติดตามหายเกลี้ยง ขณะที่หน้าจอแจ้งว่า "ลบไม่สำเร็จ"
  //   → ผู้ดูแลไม่รู้เลยว่ามีของหายไปแล้ว (ผลตรวจสอบระบบรอบ 2 · Part 8)
  //
  // ตอนนี้ทั้งชุดอยู่ในฟังก์ชันเดียวที่ฐานข้อมูล = ธุรกรรมเดียว พังตรงไหนย้อนกลับให้หมดเอง
  // การลบ "บัญชีเข้าระบบ" ยังทำที่นี่ (SQL แตะสคีมา auth ไม่ได้) และทำหลังธุรกรรมสำเร็จเท่านั้น
  const { data: memberRows, error: delErr } = await admin.rpc("delete_dealer_atomic", { p_code: code });
  if (delErr) {
    const msg = delErr.message ?? "";
    const hasData = /dealer_has_data:([a-z_]+):(\d+)/.exec(msg);
    if (hasData) {
      return bad(409, `สาขา "${code}" ยังมีข้อมูล (${hasData[1]}) — ต้องย้าย/ลบข้อมูลก่อนจึงจะลบสาขาได้`);
    }
    if (/dealer_not_found:/.test(msg)) return bad(404, `ไม่พบตัวแทนรหัส "${code}"`);
    if (/forbidden:/.test(msg)) return bad(403, DENY);
    console.error(`[delete-dealer] ลบสาขา ${code} ไม่สำเร็จ`, delErr);
    return bad(503, "ลบตัวแทนไม่สำเร็จชั่วคราว — ลองใหม่อีกครั้ง");
  }
  const members = (memberRows ?? []) as { member_id: string }[];

  // ── ล้างประวัติ/คำขอเปลี่ยนบัญชีของรหัสนี้ทิ้งด้วย ────────────────────────────────
  //
  // ตารางสองใบนี้ (0165) ผูกกับสาขาด้วย "รหัสสาขา" เฉย ๆ ไม่ได้ผูกกุญแจนอกไว้แบบ
  // dealer_login_secrets จึงไม่หายตามตอนลบสาขา — และรหัสสาขาถูกนำกลับมาใช้ใหม่ได้
  //
  // ถ้าไม่ล้าง (พิสูจน์ด้วยของจริง 31 ส.ค. 69): ลบสาขา ZQJ ที่เคยแก้บัญชีเองไป 1 ครั้ง
  //   แล้วเปิดสาขาใหม่ด้วยรหัส ZQJ → สาขาใหม่เห็นโควตาเป็น "ใช้ไปแล้ว 1/2" ตั้งแต่วันแรก
  //   ถ้าสาขาเดิมใช้ครบ 2 ครั้ง สาขาใหม่จะแก้อีเมล/รหัสเองไม่ได้เลย ต้องขออนุมัติทุกครั้ง
  //   โดยไม่มีใครรู้ว่าทำไม · คำขอที่ค้างอยู่ก็จะกลายเป็นคำขอของคนใหม่ไปด้วย
  for (const table of ["dealer_account_changes", "dealer_account_requests"] as const) {
    const { error } = await admin.from(table).delete().eq("dealer_code", code);
    // ยังไม่ได้ติดตั้ง 0165 = ไม่มีอะไรต้องล้าง (ไม่ใช่ความผิดพลาด)
    if (error && error.code !== "42P01") console.error(`[delete-dealer] ล้าง ${table} ของ ${code} ไม่สำเร็จ`, error);
  }

  // ลบบัญชี auth ของผู้ใช้สังกัดสาขา (profile หายตาม cascade) — ทำท้ายสุด
  // เก็บรายชื่อที่ลบไม่สำเร็จไว้บอกผู้เรียกตรง ๆ ไม่กลืนเงียบ — บัญชีที่ค้างคือช่องข้ามสาขาถ้ารหัสถูกใช้ซ้ำ
  const orphans: string[] = [];
  for (const m of members) {
    if (!(await deleteAuthUserLoud(admin, String(m.member_id), "delete-dealer"))) orphans.push(String(m.member_id));
  }

  if (orphans.length) {
    // ทะเบียนสาขาถูกลบไปแล้ว (ย้อนไม่ได้) แต่ต้องไม่รายงานว่าสำเร็จทั้งหมด — และห้ามนำรหัสนี้กลับมาใช้ใหม่
    // จนกว่าจะเคลียร์บัญชีค้างเสร็จ ไม่งั้นบัญชีเก่าจะเห็นข้อมูลของสาขาใหม่
    await auditLog(admin, prof, "ลบตัวแทน (บัญชีค้าง)", `${code} · เหลือบัญชีที่ลบไม่สำเร็จ ${orphans.length} บัญชี`);
    // ── ต้องตอบว่า "สำเร็จบางส่วน" ไม่ใช่ "ล้มเหลว" ──
    // ทะเบียนสาขาถูกลบไปแล้วจริงและย้อนไม่ได้ · เดิมตอบ 500 ซึ่งหน้าจอตีความว่าลบไม่สำเร็จ
    // แล้ว "คงสาขาไว้บนหน้าจอ" ทั้งที่ในระบบไม่มีแล้ว — ผู้ดูแลเห็นสาขาที่ลบไปแล้วเหมือนฟื้นกลับมา
    // และเข้าใจผิดว่าไม่ต้องทำอะไรต่อ ทั้งที่ยังมีบัญชีค้างที่ต้องเคลียร์ (ผลตรวจรอบ 2 · ระดับสูง)
    return NextResponse.json({
      ok: true,
      warning: `ลบทะเบียนสาขา "${code}" เรียบร้อยแล้ว แต่ลบบัญชีเข้าระบบไม่สำเร็จ ${orphans.length} บัญชี — ` +
        `ห้ามนำรหัส "${code}" กลับมาใช้ใหม่จนกว่าผู้ดูแลระบบจะเคลียร์บัญชีค้างเสร็จ`,
    });
  }

  await auditLog(admin, prof, "ลบตัวแทน", code);
  return NextResponse.json({ ok: true });
});
