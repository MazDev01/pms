"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useRole } from "@pms/shared/context/RoleContext";
import { REAL_BACKEND } from "@pms/shared/lib/data/config";
import { DEMO_PASSWORD, DEMO_LOGINS } from "@pms/shared/lib/auth";
import { sbSendPasswordReset } from "@pms/shared/lib/supabaseAuth";

// ── ทางเข้าเดโมของอีกฝั่ง (ตั้งที่ Vercel ของโปรเจกต์เดโมเท่านั้น) ──
// ว่าง = ไม่มีปุ่ม · ระบบจริงไม่ตั้งค่านี้
// ⚠️ เก็บเฉพาะ "ที่อยู่" ในค่าตั้งค่า — ข้อความไทยอยู่ในโค้ด
//    (เคยเอาข้อความไปไว้ในค่าตั้งค่าแล้วภาษาไทยเพี้ยนเป็น ????? บนหน้าเว็บจริง · 18 ส.ค. 69)
//    และผูกชื่อปุ่มกับฝั่งที่เปิดอยู่ — ชื่อกับปลายทางจึงสลับกันไม่ได้
const OTHER_DEMO_URL = process.env.NEXT_PUBLIC_DEMO_OTHER_URL ?? "";

const FORGOT_MSG = "กรุณาติดต่อผู้ดูแลระบบ (HQ) เพื่อรีเซ็ตรหัสผ่าน\nอีเมล: support@benjamin.co.th";

// ── inline SVG (feather/lucide style) — ไม่พึ่ง icon library ──
const IconMail = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" />
  </svg>
);
const IconLock = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);
const IconEye = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
  </svg>
);
const IconEyeOff = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10.7 5.1A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3 3.8M6.6 6.6A17.6 17.6 0 0 0 2 12s3.5 7 10 7a10.6 10.6 0 0 0 4.4-.9" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M2 2l20 20" />
  </svg>
);

export default function LoginCard({ variant = "dealer" }: { variant?: "dealer" | "hq" }) {
  const { signIn } = useRole();
  const router = useRouter();
  const isHQ = variant === "hq";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // "ลืมรหัสผ่าน?" — โหมด supabase ส่งลิงก์ตั้งรหัสใหม่ทางอีเมลจริง (H4/sbSendPasswordReset)
  //   โหมด local (เดโม) ไม่มีระบบยืนยันตัวตนจริงให้ส่งอีเมล → คงข้อความ "ติดต่อ HQ" เดิมไว้
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotMsg, setForgotMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const busy = loading;
  const go = (scopeAll: boolean) => router.push(scopeAll ? "/hq/dashboard" : "/dashboard");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    // signIn เป็น async แล้ว — โหมด supabase รอ signInWithPassword จริง · โหมด local เร็วทันที
    const r = await signIn(email.trim(), password);
    if (r.ok) go(r.session.scopeAll);
    else { setError(r.error); setLoading(false); }
  }

  // ── เข้าระบบทันที (เฉพาะโหมดเดโม) ─────────────────────────────────────────────
  // ⚠️ ต้องผูกกับ !REAL_BACKEND เท่านั้น ห้ามใช้ธงอื่น (เช่น NODE_ENV) เด็ดขาด
  //    ระบบจริงตั้ง NEXT_PUBLIC_DATA_SOURCE=supabase → REAL_BACKEND=true → ปุ่มนี้ไม่ถูกเรนเดอร์เลย
  //    ถ้าหลุดไปโผล่บนระบบจริง = ใครก็กดเข้าเป็นผู้ดูแลได้โดยไม่ต้องรู้รหัสผ่าน
  async function quickLogin(demoEmail: string) {
    setError(null);
    setLoading(true);
    const r = await signIn(demoEmail, DEMO_PASSWORD);
    if (r.ok) go(r.session.scopeAll);
    else { setError(r.error); setLoading(false); }
  }

  // ใช้อีเมลในช่องที่กรอกไว้แล้ว — ไม่ต้องเปิดฟอร์มใหม่ซ้อน
  // ตัวแทนไม่มีสิทธิ์ตั้ง/ขอรีเซ็ตรหัสผ่านเอง — HQ เป็นผู้คุมรหัสผ่านของตัวแทนทั้งหมด (บอสสั่ง)
  // จึงเปิดลิงก์รีเซ็ตทางอีเมลจริงให้เฉพาะฝั่ง HQ เท่านั้น ฝั่งตัวแทนให้ไปติดต่อ HQ เสมอ
  async function handleForgot() {
    if (!REAL_BACKEND || !isHQ) { alert(FORGOT_MSG); return; } // โหมดเดโม/ฝั่งตัวแทน ไม่มีสิทธิ์รีเซ็ตเอง
    const e = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(e)) {
      setForgotMsg({ ok: false, text: "กรอกอีเมลในช่องด้านบนก่อน แล้วกด \"ลืมรหัสผ่าน?\" อีกครั้ง" });
      return;
    }
    setForgotBusy(true);
    setForgotMsg(null);
    const r = await sbSendPasswordReset(e);
    setForgotBusy(false);
    setForgotMsg(r.ok
      ? { ok: true, text: `ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่ ${e} แล้ว — เปิดอีเมลเพื่อตั้งรหัสใหม่` }
      : { ok: false, text: r.error });
  }

  const inputWrap =
    "flex h-11 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-slate-500 " +
    "transition focus-within:border-[#2563eb] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#2563eb]/15";
  const inputEl = "w-full bg-transparent text-[0.92rem] text-slate-800 outline-none placeholder:text-slate-400";
  // globals.css มี global `input:focus-visible { outline }` แบบ unlayered → utility ใน @layer แพ้เสมอ
  // ใช้ inline style (ชนะทุก layer) กันกรอบซ้อนเล็กๆ รอบ input; ตัวบอกโฟกัสใช้ focus-within ring ของ wrapper
  const noOutline: React.CSSProperties = { outline: "none" };

  return (
    <div className="flex min-h-[600px] flex-col bg-white px-8 py-8 sm:px-12">
      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-sm">
          {/* Heading */}
          <h2 className="text-[2rem] font-extrabold tracking-tight text-[#0e2a5c]">Login</h2>
          <p className="mt-1.5 text-sm text-slate-500">{isHQ ? "เข้าสู่ระบบสำนักงานใหญ่" : "เข้าสู่ระบบเพื่อใช้งานระบบ"}</p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4" noValidate>
            {/* Email */}
            <div>
              <label htmlFor="login-email" className="mb-1 block text-[0.78rem] font-bold text-[#0e2a5c]">อีเมล / Email</label>
              <div className={inputWrap}>
                <IconMail />
                <input id="login-email" type="text" inputMode="email" autoComplete="username" value={email}
                  onChange={(e) => setEmail(e.target.value)} placeholder={isHQ ? "name@benjamin.com" : "dealer@example.com"} required className={inputEl} style={noOutline} />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="login-password" className="mb-1 block text-[0.78rem] font-bold text-[#0e2a5c]">รหัสผ่าน / Password</label>
              <div className={inputWrap}>
                <IconLock />
                <input id="login-password" type={showPass ? "text" : "password"} autoComplete="current-password" value={password}
                  onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required className={inputEl} style={noOutline} />
                <button type="button" onClick={() => setShowPass((v) => !v)}
                  aria-label={showPass ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"} aria-pressed={showPass}
                  className="shrink-0 rounded-md p-1 text-slate-400 transition hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]/40">
                  {showPass ? <IconEyeOff /> : <IconEye />}
                </button>
              </div>
            </div>

            {/* Forgot — เดิมมี checkbox "จดจำฉันไว้ในระบบ" คู่กัน แต่ไม่เคยถูกส่งเข้า signIn() เลย
                (session ตั้งใจแยกต่อแท็บกันบัญชีรั่วข้ามแท็บ — ดู client.ts) ลบทิ้งแทนแก้ให้ทำงานจริง
                เพื่อไม่ย้อนกลับไปเจอบั๊กเดิมที่ร้ายแรงกว่า (พบจากผลตรวจสอบระบบรอบ 2, 31 ก.ค. 69) */}
            <div className="flex items-center justify-end">
              <button type="button" onClick={handleForgot} disabled={forgotBusy}
                className="text-[0.85rem] font-bold text-[#1d4ed8] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]/40 rounded disabled:opacity-60">
                {forgotBusy ? "กำลังส่ง…" : "ลืมรหัสผ่าน?"}
              </button>
            </div>

            {forgotMsg && (
              <p role="alert" className={`rounded-xl border px-3.5 py-2.5 text-sm font-medium ${forgotMsg.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-600"}`}>
                {forgotMsg.text}
              </p>
            )}

            {error && (
              <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-600">{error}</p>
            )}

            {/* Submit */}
            <button type="submit" disabled={busy}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0e2a5c] text-[0.95rem] font-bold text-white shadow-[0_10px_30px_-12px_rgba(14,42,92,0.55)] transition hover:bg-[#12326e] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2563eb]/30 disabled:cursor-not-allowed disabled:opacity-70">
              {loading
                ? <span className="h-5 w-5 animate-spin rounded-full border-[2.5px] border-white/30 border-t-white" aria-hidden="true" />
                : "เข้าสู่ระบบ"}
            </button>
          </form>

          {/* ── โหมดเดโม: กดเข้าใช้งานได้เลย ไม่ต้องจำอีเมล/รหัส ──
              ไม่มีในระบบจริง (REAL_BACKEND=true) — ดูเหตุผลที่ quickLogin */}
          {!REAL_BACKEND && (
            <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3.5">
              <p className="mb-2.5 text-center text-[0.72rem] font-bold uppercase tracking-wide text-slate-500">
                โหมดสาธิต — เข้าใช้งานได้เลย
              </p>
              <div className="flex flex-col gap-2">
                {DEMO_LOGINS.filter(d => (isHQ ? d.scopeAll : !d.scopeAll)).map(d => (
                  <button key={d.email} type="button" disabled={busy} onClick={() => void quickLogin(d.email)}
                    className="flex h-10 w-full items-center justify-center rounded-lg border border-[#0e2a5c]/25 bg-white text-[0.85rem] font-bold text-[#0e2a5c] transition hover:bg-[#0e2a5c]/5 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60">
                    {d.label}
                  </button>
                ))}
                {/* ── ข้ามไปเดโมของอีกฝั่ง (บอสสั่ง 18 ส.ค. 69: รวมทางเข้าไว้ที่เดียว) ──
                    ฝั่งตัวแทนกับสำนักงานใหญ่เป็นคนละแอป จึงคนละที่อยู่เว็บ — เชื่อมด้วยลิงก์
                    ⚠️ ปลายทางมาจากค่าตั้งค่า ไม่ฝังในโค้ด · ระบบจริงไม่ตั้งค่านี้ = ไม่มีปุ่มนี้เลย
                       (และถึงตั้ง ก็อยู่ในบล็อก !REAL_BACKEND ซึ่งระบบจริงไม่เรนเดอร์อยู่แล้ว) */}
                {OTHER_DEMO_URL && (
                  <a href={OTHER_DEMO_URL}
                    className="flex h-10 w-full items-center justify-center rounded-lg border border-dashed border-[#0e2a5c]/30 bg-white text-[0.85rem] font-bold text-[#0e2a5c] transition hover:bg-[#0e2a5c]/5">
                    {isHQ ? "เข้าใช้งานเป็น ตัวแทนจำหน่าย" : "เข้าใช้งานเป็น สำนักงานใหญ่"}
                  </a>
                )}
              </div>
              <p className="mt-2.5 text-center text-[0.68rem] text-slate-400">ข้อมูลทั้งหมดเป็นข้อมูลตัวอย่าง</p>
            </div>
          )}

          {/* Helper */}
          <p className="mt-4 text-center text-[0.8rem] text-slate-500">
            ยังไม่มีบัญชี?{" "}
            <button type="button" onClick={() => alert(FORGOT_MSG)}
              className="font-bold text-[#1d4ed8] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]/40 rounded">
              ติดต่อผู้ดูแลระบบ
            </button>
          </p>
        </div>
      </div>

      {/* Footer — ล่างสุดของคอลัมน์ */}
      <footer className="pt-5 text-center text-[0.7rem] text-slate-400">
        © 2569 Benjamin PEB Steel Co., Ltd. All rights reserved.
      </footer>
    </div>
  );
}
