"use client";

// ─── ข้อมูลเข้าระบบของตัวแทน (ดูอีเมล/รหัสผ่าน · รีเซ็ตรหัสผ่าน) ─────────────────────
//
// ย้ายมาจากปุ่มรูปกุญแจในตารางหน้า "ตัวแทนจำหน่าย" (บอสสั่งเอาออกจากตาราง 13 ส.ค. 69)
// ตารางนั้นมีปุ่มต่อแถวถึง 6 ปุ่มจนแน่น — งานนี้เป็นงานราย "สาขา" ไม่ใช่งานที่ต้องทำรัวจากลิสต์
// จึงย้ายมาอยู่ในหน้ารายละเอียดของสาขานั้น ๆ แทน · ความสามารถเท่าเดิมทุกอย่าง ไม่ได้ตัดอะไรทิ้ง
//
// ⚠️ รหัสผ่านต้อง "ดึงตอนกดดู" เท่านั้น ห้ามส่งมากับข้อมูลตัวแทนตั้งแต่แรก
//    ครั้งก่อนรหัสถูกฝังในไฟล์ที่เบราว์เซอร์โหลดทุกหน้า ใครเปิดดูซอร์สก็อ่านได้ (Critical · 5 ส.ค. 69)
//    ฝั่งเซิร์ฟเวอร์บันทึกทุกครั้งว่าใครเปิดดูรหัสของสาขาไหน
import { useEffect, useState } from "react";
import { Eye, EyeOff, Copy, Check, Key, X } from "lucide-react";
import { ModalCard } from "@pms/shared/components/ui/ModalCard";
import { viewDealerPassword, resetDealerPassword, listDealerLoginEmails } from "@pms/shared/lib/adminApi";
import { REAL_BACKEND } from "@pms/shared/lib/data/config";
import { fmtISOToThai, type DealerRow } from "@pms/shared/lib/mock";
import { useRole } from "@pms/shared/context/RoleContext";

/** ช่องคัดลอกค่า (ปิดบังได้) — ใช้ทั้งที่นี่และตอนสร้างตัวแทนใหม่ */
export function CopyField({ label, value, secret = false, defaultShown = false }: {
  label: string; value: string; secret?: boolean; defaultShown?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  // defaultShown = ผู้ใช้กด "ดูรหัสผ่าน" มาแล้ว ไม่ต้องให้กดปุ่มรูปตาซ้ำอีกชั้น (แก้ 10 ส.ค. 69)
  const [shown, setShown] = useState(defaultShown);
  const masked = secret && !shown;
  function doCopy() {
    navigator.clipboard.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: "0.72rem", color: "#6b7280", marginBottom: 4, fontWeight: 600 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#f0f4f8", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 11px" }}>
        <span style={{ flex: 1, fontFamily: "monospace", fontSize: "0.86rem", fontWeight: 700, color: "#2D2D2D", letterSpacing: "0.03em", overflow: "hidden", textOverflow: "ellipsis" }}>
          {masked ? "••••••••••••" : value}
        </span>
        {secret && (
          <button type="button" onClick={() => setShown(v => !v)} aria-label={shown ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"} title={shown ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", padding: 0, display: "flex" }}>
            {shown ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
        <button type="button" onClick={doCopy} aria-label={`คัดลอก${label}`} title={`คัดลอก${label}`}
          style={{ background: "none", border: "none", cursor: "pointer", color: copied ? "#059669" : "#6b7280", padding: 0, display: "flex" }}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
    </div>
  );
}

/** ช่องรหัสผ่าน — ยังไม่ดึงจนกว่าจะกดดู (ดูหมายเหตุด้านบนไฟล์) */
export function DealerPasswordField({ code, fallback }: { code: string; fallback?: string }) {
  const [pw, setPw] = useState<string | null>(fallback ?? null);
  const [meta, setMeta] = useState<{ at: string; by: string } | null>(null);
  // กด "ดูรหัสผ่าน" แล้วต้องเห็นทันที ไม่ต้องกดปุ่มรูปตาซ้ำอีกชั้น (บั๊กจริง · 10 ส.ค. 69)
  const [revealed, setRevealed] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function reveal() {
    if (loading || pw) return;
    setLoading(true); setErr("");
    const res = await viewDealerPassword(code);
    setLoading(false);
    if (!res.ok) { setErr(res.error); return; }
    setPw(res.password);
    setRevealed(true);
    setMeta({ at: res.updatedAt, by: res.updatedBy });
  }

  if (pw) return (
    <>
      <CopyField label="รหัสผ่าน" value={pw} secret defaultShown={revealed} />
      {meta?.at && (
        <div style={{ fontSize: "0.68rem", color: "#6b7280", marginTop: -6, marginBottom: 10 }}>
          ตั้งเมื่อ {fmtISOToThai(meta.at.slice(0, 10))}{meta.by ? ` โดย ${meta.by}` : ""}
        </div>
      )}
    </>
  );

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: "0.72rem", color: "#6b7280", marginBottom: 4, fontWeight: 600 }}>รหัสผ่าน</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#f0f4f8", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 12px" }}>
        <span style={{ flex: 1, fontFamily: "monospace", fontSize: "0.86rem", fontWeight: 700, color: "#9ca3af", letterSpacing: "0.03em" }}>
          ••••••••••••
        </span>
        <button type="button" onClick={reveal} disabled={loading}
          title="ดูรหัสผ่าน (ระบบจะบันทึกว่าใครเปิดดู)"
          style={{ background: "none", border: "none", cursor: loading ? "wait" : "pointer", color: "#003366", padding: 0, display: "flex", alignItems: "center", gap: 5, fontFamily: "inherit", fontSize: "0.74rem", fontWeight: 700 }}>
          <Eye size={14} /> {loading ? "กำลังดึง…" : "ดูรหัสผ่าน"}
        </button>
      </div>
      {err && <div style={{ fontSize: "0.7rem", color: "#dc2626", marginTop: 5 }}>{err}</div>}
    </div>
  );
}

export function DealerCredentialsCard({ dealer }: { dealer: DealerRow }) {
  const { can } = useRole();
  // อีเมลเข้าระบบจริง — ห้ามคำนวณจากรหัสสาขา (สูตรนั้นใช้ได้เฉพาะบัญชีที่สร้างผ่านหน้าจอนี้
  //   สาขาที่มีอยู่จริงใช้อีเมลธุรกิจของตัวเอง) · ไม่รู้ = "—" ไม่เดาให้ผู้ใช้เข้าใจผิด
  const [email, setEmail] = useState("—");
  const [resetting, setResetting] = useState(false);
  const [newCreds, setNewCreds] = useState<{ email: string; password: string } | null>(null);

  useEffect(() => {
    let alive = true;
    listDealerLoginEmails().then(m => { if (alive) setEmail(m[dealer.code] ?? "—"); }).catch(() => {});
    return () => { alive = false; };
  }, [dealer.code]);

  // จัดการบัญชีตัวแทนได้เฉพาะผู้มีสิทธิ์ — ผู้ใช้ HQ ระดับปฏิบัติงานไม่ควรเห็นรหัสของสาขา
  if (!can("dealers:manage")) return null;

  async function doReset() {
    if (!confirm(`ออกรหัสผ่านใหม่ให้ "${dealer.name}"?\nรหัสเดิมจะใช้เข้าระบบไม่ได้ทันที`)) return;
    if (!REAL_BACKEND) { alert("โหมดทดลองใช้งานไม่รองรับการรีเซ็ตรหัสผ่าน"); return; }
    setResetting(true);
    const res = await resetDealerPassword(dealer.code);
    setResetting(false);
    if (!res.ok) { alert("รีเซ็ตรหัสผ่านไม่สำเร็จ: " + res.error); return; }
    // audit บันทึกที่ฝั่งเซิร์ฟเวอร์แล้ว (การันตีว่าลงเสมอ) — ไม่ลงซ้ำที่ฝั่งหน้าจอ
    setNewCreds({ email: res.email, password: res.password });
  }

  return (
    <div className="card" style={{ padding: "18px 20px", gridColumn: "1 / -1" }}>
      <p style={{ fontSize: "0.72rem", fontWeight: 700, color: "#6b7280", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em",
        display: "flex", alignItems: "center", gap: 7 }}>
        <Key size={13} color="#003366" /> ข้อมูลเข้าระบบของตัวแทน
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 18px" }}>
        <CopyField label="อีเมลเข้าสู่ระบบ" value={email} />
        <DealerPasswordField code={dealer.code} fallback={dealer.credentials?.password} />
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginTop: 4 }}>
        <div style={{ fontSize: "0.72rem", color: "#6b7280" }}>
          ตัวแทนใช้อีเมลนี้เข้าสู่ระบบที่หน้าเข้าสู่ระบบของตัวแทน
        </div>
        <button onClick={doReset} disabled={resetting}
          style={{ padding: "8px 14px", borderRadius: 9, border: "1px solid #fecaca", background: "#fff", color: "#dc2626",
            fontSize: "0.76rem", fontWeight: 700, cursor: resetting ? "not-allowed" : "pointer", opacity: resetting ? 0.6 : 1,
            display: "flex", alignItems: "center", gap: 7, fontFamily: "inherit" }}>
          <Key size={13} /> {resetting ? "กำลังรีเซ็ต…" : "รีเซ็ตรหัสผ่าน"}
        </button>
      </div>

      {/* รหัสใหม่หลังรีเซ็ต — ต้องคัดลอกไปแจ้งตัวแทนทันที ปิดแล้วดูซ้ำได้ที่ปุ่ม "ดูรหัสผ่าน" ด้านบน */}
      {newCreds && (
        <div onClick={() => setNewCreds(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.42)", zIndex: 1060, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <ModalCard onClose={() => setNewCreds(null)} label="รหัสผ่านใหม่ของตัวแทน"
            style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", boxShadow: "0 2px 14px rgba(0,51,102,.07)", width: 380, maxWidth: "100%" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "0.92rem", fontWeight: 800, color: "#2D2D2D" }}>รหัสผ่านใหม่</h3>
                <div style={{ fontSize: "0.72rem", color: "#6b7280", marginTop: 2 }}>{dealer.name}</div>
              </div>
              <button onClick={() => setNewCreds(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", display: "flex" }}><X size={16} /></button>
            </div>
            <div style={{ padding: "16px 20px" }}>
              <CopyField label="อีเมล" value={newCreds.email} />
              <CopyField label="รหัสผ่านใหม่" value={newCreds.password} secret defaultShown />
              <div style={{ fontSize: "0.72rem", color: "#7a5b12", background: "#fff8e6", border: "1px solid #f5d78e", borderRadius: 8, padding: "9px 12px", marginTop: 6 }}>
                รหัสเดิมใช้ไม่ได้แล้ว — ต้องแจ้งรหัสใหม่นี้ให้ตัวแทนทราบ
              </div>
            </div>
          </ModalCard>
        </div>
      )}
    </div>
  );
}
