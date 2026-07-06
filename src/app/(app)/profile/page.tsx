"use client";

// ─── โปรไฟล์ของฉัน — ใช้ได้ทั้ง HQ และตัวแทน (แยก persist ต่อ workspace) ─────
// แก้รูป/ชื่อ/อีเมล/เบอร์ + เปลี่ยนรหัสผ่าน (เดโม) · บันทึกลง localStorage แล้วอัปเดต Topbar ทันที
import { useState, useRef, useEffect } from "react";
import { useRole } from "@/context/RoleContext";
import {
  profileKey, loadUserProfile, defaultProfileEmail, PROFILE_UPDATED_EVENT, type UserProfile,
} from "@/lib/mock";
import { PRIMARY, STEEL } from "@/lib/theme";
import { fileToResizedDataURL } from "@/lib/imageResize";
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
  // เริ่มด้วยค่า default (deterministic — server/client ตรงกัน) แล้วโหลดจาก localStorage หลัง mount กัน hydration mismatch
  const [form, setForm] = useState<UserProfile>({ name: session.name, email: defaultProfileEmail(session.dealerCode), phone: "" });
  useEffect(() => { setForm(loadUserProfile(session.dealerCode, session.name)); }, [session.dealerCode, session.name]);
  const [saved, setSaved] = useState(false);
  const [pw, setPw] = useState({ cur: "", next: "", confirm: "" });
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const roleLabel = ROLE_LABEL[session.role] ?? "สมาชิก";
  const initial = (form.name || session.name).charAt(0).toUpperCase();
  const set = (k: keyof UserProfile, v: string) => { setForm(f => ({ ...f, [k]: v })); setSaved(false); };

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    set("avatar", await fileToResizedDataURL(file, 256)); // ย่อก่อนเก็บ กัน quota เต็ม
  }

  function save() {
    const clean: UserProfile = {
      name: form.name.trim() || session.name,
      email: form.email.trim() || defaultProfileEmail(session.dealerCode),
      phone: form.phone.trim(),
      avatar: form.avatar,
    };
    try {
      localStorage.setItem(profileKey(session.dealerCode), JSON.stringify(clean));
      window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT)); // ให้ Topbar อัปเดตทันที
    } catch {}
    setForm(clean);
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  }

  function changePassword() {
    if (!pw.cur || !pw.next) { setPwMsg({ ok: false, text: "กรอกรหัสผ่านปัจจุบันและรหัสผ่านใหม่" }); return; }
    if (pw.next.length < 6) { setPwMsg({ ok: false, text: "รหัสผ่านใหม่ต้องยาวอย่างน้อย 6 ตัวอักษร" }); return; }
    if (pw.next !== pw.confirm) { setPwMsg({ ok: false, text: "ยืนยันรหัสผ่านใหม่ไม่ตรงกัน" }); return; }
    setPw({ cur: "", next: "", confirm: "" });
    setPwMsg({ ok: true, text: "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว" });
    setTimeout(() => setPwMsg(null), 2600);
  }

  const inp: React.CSSProperties = { width: "100%", border: `1px solid ${BORDER}`, borderRadius: 9, padding: "9px 12px 9px 36px", fontSize: "0.85rem", color: STEEL, outline: "none", boxSizing: "border-box", fontFamily: "inherit", background: "#fff" };
  const lbl: React.CSSProperties = { display: "block", fontSize: "0.7rem", fontWeight: 700, color: MUTED, marginBottom: 6 };
  const roBox: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, border: `1px solid ${BORDER}`, background: "#f7f8fa", borderRadius: 9, padding: "9px 12px", fontSize: "0.85rem", color: STEEL };

  return (
    <div className="erp">
      <div className="page-head">
        <div>
          <h2>โปรไฟล์ของฉัน</h2>
          <p>ข้อมูลส่วนตัวและความปลอดภัยของบัญชี · {isHQ ? "สำนักงานใหญ่" : "ตัวแทน"}</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(340px,100%), 1fr))", gap: 18, alignItems: "start" }}>

        {/* ── การ์ดข้อมูลส่วนตัว ── */}
        <div className="card" style={{ padding: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
            <UserCircle size={18} color={PRIMARY} />
            <span style={{ fontSize: "0.95rem", fontWeight: 800, color: STEEL }}>ข้อมูลส่วนตัว</span>
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
              <div style={{ fontSize: "1.05rem", fontWeight: 800, color: STEEL }}>{form.name || session.name}</div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 5, fontSize: "0.68rem", fontWeight: 700, color: PRIMARY, background: "#eef3f8", border: `1px solid #dce5f0`, borderRadius: 999, padding: "3px 10px" }}>
                <ShieldCheck size={11} /> {roleLabel}
              </div>
              {form.avatar && (
                <button onClick={() => set("avatar", "")} style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 8, background: "none", border: "none", color: "#dc2626", fontSize: "0.68rem", fontWeight: 600, cursor: "pointer", padding: 0 }}>
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
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 5, fontSize: "0.66rem", color: "#9ca3af" }}>
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
            {saved && <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.78rem", fontWeight: 700, color: "#059669" }}><Check size={14} /> บันทึกแล้ว</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 12, fontSize: "0.66rem", color: "#9ca3af" }}>
            <Lock size={11} /> ตำแหน่งและหน่วยงานกำหนดโดยผู้ดูแลระบบ — แก้ไขที่นี่ไม่ได้
          </div>
        </div>

        {/* ── การ์ดความปลอดภัย ── HQ เปลี่ยนรหัสผ่านเองได้ · ตัวแทนจัดการโดยสำนักงานใหญ่ */}
        <div className="card" style={{ padding: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
            <KeyRound size={18} color={PRIMARY} />
            <span style={{ fontSize: "0.95rem", fontWeight: 800, color: STEEL }}>ความปลอดภัย</span>
          </div>

          {isHQ ? (
            <>
              <div style={{ fontSize: "0.78rem", color: MUTED, marginBottom: 16 }}>เปลี่ยนรหัสผ่านสำหรับเข้าสู่ระบบ</div>
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
                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: pwMsg.ok ? "#059669" : "#dc2626", marginBottom: 12 }}>
                  {pwMsg.text}
                </div>
              )}
              <button className="btn btn-secondary btn-md" onClick={changePassword} style={{ color: STEEL }}><KeyRound size={14} /> เปลี่ยนรหัสผ่าน</button>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 14, fontSize: "0.66rem", color: "#9ca3af" }}>
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
                  <div style={{ fontSize: "0.84rem", fontWeight: 700, color: STEEL, marginBottom: 3 }}>รหัสผ่านจัดการโดยสำนักงานใหญ่</div>
                  <div style={{ fontSize: "0.76rem", color: MUTED, lineHeight: 1.6 }}>
                    บัญชีตัวแทนถูกสร้างและตั้งรหัสผ่านโดยสำนักงานใหญ่ · หากต้องการรีเซ็ตรหัสผ่าน กรุณาติดต่อผู้ดูแลระบบสำนักงานใหญ่
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 14, fontSize: "0.66rem", color: "#9ca3af" }}>
                <ShieldCheck size={11} /> เพื่อความปลอดภัย ตัวแทนไม่สามารถเปลี่ยนรหัสผ่านเองได้
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
