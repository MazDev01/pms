"use client";

// ─── โปรไฟล์ของฉัน — ใช้ได้ทั้ง HQ และตัวแทน (แยก persist ต่อ workspace) ─────
// แก้รูป/ชื่อ/อีเมล/เบอร์ + เปลี่ยนรหัสผ่าน (เดโม) · บันทึกลง localStorage แล้วอัปเดต Topbar ทันที
//
// เดิมไฟล์นี้อยู่แค่ apps/dealer/app/(app)/profile/page.tsx เท่านั้น — ตอนแยกโมโนเรโปจาก main
// (ที่เดิมเป็นแอปเดียว มีแค่ /profile เส้นทางเดียวใช้ร่วมกัน) ไม่ได้ย้ายมาไว้ที่ apps/hq ด้วย
// ปุ่ม "โปรไฟล์" ใน Topbar ของ HQ จึงพา router.push("/profile") ไปเจอ 404 เสมอ (ไม่มี route จริง)
// ย้ายมาไว้ที่นี่ (SSOT) ให้ page.tsx ทั้งสองแอป re-export ไฟล์เดียวกัน — เหมือนแพทเทิร์น DealerDashboard
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRole } from "@pms/shared/context/RoleContext";
import {
  defaultProfileEmail, type UserProfile,
} from "@pms/shared/lib/mock";
import { useUserProfile } from "@pms/shared/lib/useUserProfile";
import { friendlyError } from "@pms/shared/lib/friendlyError";
import { sbChangeOwnPassword } from "@pms/shared/lib/supabaseAuth";
import { DATA_SOURCE } from "@pms/shared/lib/data/config";
import { PRIMARY, STEEL } from "@pms/shared/lib/theme";
import { fileToResizedDataURL } from "@pms/shared/lib/imageResize";
import {
  UserCircle, Mail, Phone, Camera, Check, ShieldCheck, Building2, Lock, KeyRound, Trash2,
} from "lucide-react";

const MUTED = "#6b7280";
const BORDER = "#e5e7eb";

const ROLE_LABEL: Record<string, string> = {
  HQ_MANAGEMENT: "ผู้บริหารสำนักงานใหญ่",
  DEALER_ADMIN: "ผู้จัดการตัวแทน",
  DEALER_SALES: "เซลส์",
  DEALER_SITE: "เซลส์ภาคสนาม",
};

export default function ProfilePage() {
  const { session, isHQ } = useRole();
  const router = useRouter();
  // ฝั่งตัวแทน: โปรไฟล์ส่วนตัวถูกรวมเป็น "บัญชีดีลเลอร์" ในหน้าตั้งค่าแล้ว → ส่งไปที่นั่น (HQ ยังใช้หน้านี้)
  useEffect(() => { if (!isHQ) router.replace("/settings"); }, [isHQ, router]);
  // เริ่มด้วยค่า default (deterministic — server/client ตรงกัน) แล้วโหลดจาก localStorage หลัง mount กัน hydration mismatch
  const userProfile = useUserProfile(); // อ่าน/เขียนผ่าน repo (โหมด supabase = ตาราง profiles)
  const [form, setForm] = useState<UserProfile>({ name: session.name, email: defaultProfileEmail(session.dealerCode), phone: "" });
  useEffect(() => { if (userProfile.loaded) setForm(userProfile.profile); }, [userProfile.loaded, userProfile.profile]);
  const [saved, setSaved] = useState(false);
  const [pw, setPw] = useState({ cur: "", next: "", confirm: "" });
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const roleLabel = ROLE_LABEL[session.role] ?? "สมาชิก";
  const initial = (form.name || session.name).charAt(0).toUpperCase();
  const set = (k: keyof UserProfile, v: string) => { setForm(f => ({ ...f, [k]: v })); setSaved(false); };

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // ให้เลือกไฟล์เดิมซ้ำได้หลังถูกปฏิเสธ
    if (!file) return;
    // ไฟล์ที่ไม่ผ่านการตรวจต้องบอกเหตุผล ไม่ใช่เงียบแล้วไม่มีอะไรเกิดขึ้น (ผู้ใช้จะนึกว่าปุ่มเสีย)
    try { set("avatar", await fileToResizedDataURL(file, 256)); } // ย่อก่อนเก็บ กัน quota เต็ม
    catch (err) { alert(err instanceof Error ? err.message : "ใช้ไฟล์นี้เป็นรูปโปรไฟล์ไม่ได้"); }
  }

  function save() {
    const clean: UserProfile = {
      name: form.name.trim() || session.name,
      email: form.email.trim() || defaultProfileEmail(session.dealerCode),
      phone: form.phone.trim(),
      avatar: form.avatar,
    };
    // เขียนผ่าน repo · ล้มเหลวต้องบอก ไม่ใช่กลืน error แล้วขึ้นว่าบันทึกแล้ว
    void userProfile.save(clean)
      .catch(e => alert("บันทึกโปรไฟล์ไม่สำเร็จ: " + friendlyError(e)));
    setForm(clean);
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  }

  const [pwBusy, setPwBusy] = useState(false);
  async function changePassword() {
    if (pwBusy) return;
    if (!pw.cur || !pw.next) { setPwMsg({ ok: false, text: "กรอกรหัสผ่านปัจจุบันและรหัสผ่านใหม่" }); return; }
    if (pw.next.length < 8) { setPwMsg({ ok: false, text: "รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัวอักษร" }); return; }
    if (pw.next !== pw.confirm) { setPwMsg({ ok: false, text: "ยืนยันรหัสผ่านใหม่ไม่ตรงกัน" }); return; }

    // H3 — เปลี่ยนรหัสจริงในโหมด supabase (ยืนยันรหัสปัจจุบันก่อน) · โหมดเดโมไม่มีระบบยืนยันตัวตนจริง
    if (DATA_SOURCE !== "supabase") {
      setPwMsg({ ok: false, text: "โหมดเดโม: เปลี่ยนรหัสผ่านจริงไม่ได้ (ต้องมีระบบยืนยันตัวตน)" });
      return;
    }
    setPwBusy(true);
    const r = await sbChangeOwnPassword(pw.cur, pw.next);
    setPwBusy(false);
    if (!r.ok) { setPwMsg({ ok: false, text: r.error }); return; }
    setPw({ cur: "", next: "", confirm: "" });
    setPwMsg({ ok: true, text: "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว" });
    setTimeout(() => setPwMsg(null), 2600);
  }

  const inp: React.CSSProperties = { width: "100%", border: `1px solid ${BORDER}`, borderRadius: 9, padding: "9px 12px 9px 36px", fontSize: "0.86rem", color: STEEL, outline: "none", boxSizing: "border-box", fontFamily: "inherit", background: "#fff" };
  const lbl: React.CSSProperties = { display: "block", fontSize: "0.72rem", fontWeight: 700, color: MUTED, marginBottom: 6 };
  const roBox: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, border: `1px solid ${BORDER}`, background: "#f7f8fa", borderRadius: 9, padding: "9px 12px", fontSize: "0.86rem", color: STEEL };

  if (!isHQ) return null; // ฝั่งตัวแทน redirect ไป /settings (บัญชีดีลเลอร์) แล้ว — ไม่เรนเดอร์โปรไฟล์เดิม

  return (
    <div className="erp">
      <div className="page-head">
        <div>
          <p>ข้อมูลส่วนตัวและความปลอดภัยของบัญชี · {isHQ ? "สำนักงานใหญ่" : "ตัวแทน"}</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(340px,100%), 1fr))", gap: 18, alignItems: "start" }}>

        {/* ── การ์ดข้อมูลส่วนตัว ── */}
        <div className="card" style={{ padding: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
            <UserCircle size={18} color={PRIMARY} />
            <span style={{ fontSize: "0.92rem", fontWeight: 800, color: STEEL }}>ข้อมูลส่วนตัว</span>
          </div>

          {/* Avatar */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              {form.avatar ? (
                <img src={form.avatar} alt="" style={{ width: 76, height: 76, borderRadius: "50%", objectFit: "cover", boxShadow: "0 2px 8px rgba(0,51,102,.25)" }} />
              ) : (
                <div style={{ width: 76, height: 76, borderRadius: "50%", background: PRIMARY, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.7rem", fontWeight: 900, boxShadow: "0 2px 8px rgba(0,51,102,.25)" }}>{initial}</div>
              )}
              <button onClick={() => fileRef.current?.click()} title="เปลี่ยนรูปโปรไฟล์"
                style={{ position: "absolute", bottom: -2, right: -2, width: 28, height: 28, borderRadius: "50%", background: "#fff", border: `1px solid ${BORDER}`, boxShadow: "0 2px 6px rgba(0,0,0,.15)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: PRIMARY }}>
                <Camera size={14} />
              </button>
              <input ref={fileRef} type="file" accept="image/*" onChange={onPickAvatar} style={{ display: "none" }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: "1rem", fontWeight: 800, color: STEEL }}>{form.name || session.name}</div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 5, fontSize: "0.65rem", fontWeight: 700, color: PRIMARY, background: "#eef3f8", border: `1px solid #dce5f0`, borderRadius: 999, padding: "3px 10px" }}>
                <ShieldCheck size={11} /> {roleLabel}
              </div>
              {form.avatar && (
                <button onClick={() => set("avatar", "")} style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 8, background: "none", border: "none", color: "#dc2626", fontSize: "0.65rem", fontWeight: 600, cursor: "pointer", padding: 0 }}>
                  <Trash2 size={11} /> ลบรูป
                </button>
              )}
            </div>
          </div>

          {/* ชื่อ */}
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>ชื่อ–นามสกุล</label>
            <div style={{ position: "relative" }}>
              <UserCircle size={15} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: MUTED }} />
              <input style={inp} value={form.name} onChange={e => set("name", e.target.value)} placeholder="ชื่อ–นามสกุล" />
            </div>
          </div>

          {/* อีเมล — HQ แก้ได้ · ตัวแทนใช้อีเมลล็อกอินที่ HQ ตั้งให้ (read-only) */}
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>อีเมล{!isHQ && " (สำหรับเข้าสู่ระบบ)"}</label>
            {isHQ ? (
              <div style={{ position: "relative" }}>
                <Mail size={15} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: MUTED }} />
                <input style={inp} type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="name@email.com" />
              </div>
            ) : (
              <>
                <div style={{ ...roBox, gap: 8 }}>
                  <Mail size={14} color={MUTED} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{form.email}</span>
                  <Lock size={12} color="#9ca3af" style={{ marginLeft: "auto", flexShrink: 0 }} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 5, fontSize: "0.65rem", color: "#9ca3af" }}>
                  <Lock size={10} /> อีเมลล็อกอินกำหนดโดยสำนักงานใหญ่ — แก้ไขที่นี่ไม่ได้
                </div>
              </>
            )}
          </div>

          {/* เบอร์โทร */}
          <div style={{ marginBottom: 18 }}>
            <label style={lbl}>เบอร์โทรศัพท์</label>
            <div style={{ position: "relative" }}>
              <Phone size={15} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: MUTED }} />
              <input style={inp} value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="08X-XXX-XXXX" />
            </div>
          </div>

          {/* Read-only: ตำแหน่ง + workspace */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
            <div>
              <label style={lbl}>ตำแหน่ง</label>
              <div style={roBox}><ShieldCheck size={14} color={MUTED} /> {roleLabel}</div>
            </div>
            <div>
              <label style={lbl}>{isHQ ? "หน่วยงาน" : "บริษัทตัวแทน"}</label>
              <div style={roBox}><Building2 size={14} color={MUTED} /> <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{session.dealerName}{session.dealerCode ? ` (${session.dealerCode})` : ""}</span></div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button className="btn btn-primary btn-md" onClick={save}><Check size={15} /> บันทึกโปรไฟล์</button>
            {saved && <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.8rem", fontWeight: 700, color: "#059669" }}><Check size={14} /> บันทึกแล้ว</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 12, fontSize: "0.65rem", color: "#9ca3af" }}>
            <Lock size={11} /> ตำแหน่งและหน่วยงานกำหนดโดยผู้ดูแลระบบ — แก้ไขที่นี่ไม่ได้
          </div>
        </div>

        {/* ── การ์ดความปลอดภัย ── HQ เปลี่ยนรหัสผ่านเองได้ · ตัวแทนจัดการโดยสำนักงานใหญ่ */}
        <div className="card" style={{ padding: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
            <KeyRound size={18} color={PRIMARY} />
            <span style={{ fontSize: "0.92rem", fontWeight: 800, color: STEEL }}>ความปลอดภัย</span>
          </div>

          {isHQ ? (
            <>
              <div style={{ fontSize: "0.8rem", color: MUTED, marginBottom: 16 }}>เปลี่ยนรหัสผ่านสำหรับเข้าสู่ระบบ</div>
              {[
                { k: "cur" as const, label: "รหัสผ่านปัจจุบัน", ph: "••••••••" },
                { k: "next" as const, label: "รหัสผ่านใหม่", ph: "อย่างน้อย 6 ตัวอักษร" },
                { k: "confirm" as const, label: "ยืนยันรหัสผ่านใหม่", ph: "พิมพ์รหัสผ่านใหม่อีกครั้ง" },
              ].map(f => (
                <div key={f.k} style={{ marginBottom: 14 }}>
                  <label style={lbl}>{f.label}</label>
                  <div style={{ position: "relative" }}>
                    <Lock size={15} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: MUTED }} />
                    <input style={inp} type="password" value={pw[f.k]} placeholder={f.ph}
                      onChange={e => { setPw(p => ({ ...p, [f.k]: e.target.value })); setPwMsg(null); }} />
                  </div>
                </div>
              ))}
              {pwMsg && (
                <div style={{ fontSize: "0.72rem", fontWeight: 600, color: pwMsg.ok ? "#059669" : "#dc2626", marginBottom: 12 }}>
                  {pwMsg.text}
                </div>
              )}
              <button className="btn btn-secondary btn-md" onClick={() => void changePassword()} disabled={pwBusy} style={{ color: STEEL, ...(pwBusy ? { opacity: .6, cursor: "not-allowed" } : {}) }}><KeyRound size={14} /> {pwBusy ? "กำลังเปลี่ยน…" : "เปลี่ยนรหัสผ่าน"}</button>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 14, fontSize: "0.65rem", color: "#9ca3af" }}>
                <ShieldCheck size={11} /> รหัสผ่านถูกเข้ารหัสและไม่ถูกจัดเก็บเป็นข้อความธรรมดา
              </div>
            </>
          ) : (
            // ตัวแทน: รหัสผ่านออกและจัดการโดยสำนักงานใหญ่ — แก้เองไม่ได้
            <div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "#f5f7fa", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "14px 16px" }}>
                <span style={{ width: 34, height: 34, borderRadius: "50%", background: "#eef3f8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Lock size={16} color={PRIMARY} />
                </span>
                <div>
                  <div style={{ fontSize: "0.86rem", fontWeight: 700, color: STEEL, marginBottom: 3 }}>รหัสผ่านจัดการโดยสำนักงานใหญ่</div>
                  <div style={{ fontSize: "0.72rem", color: MUTED, lineHeight: 1.6 }}>
                    บัญชีตัวแทนถูกสร้างและตั้งรหัสผ่านโดยสำนักงานใหญ่ · หากต้องการรีเซ็ตรหัสผ่าน กรุณาติดต่อผู้ดูแลระบบสำนักงานใหญ่
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 14, fontSize: "0.65rem", color: "#9ca3af" }}>
                <ShieldCheck size={11} /> เพื่อความปลอดภัย ตัวแทนไม่สามารถเปลี่ยนรหัสผ่านเองได้
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
