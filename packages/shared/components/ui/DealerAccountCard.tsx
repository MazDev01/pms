"use client";

// ── บัญชีเข้าระบบของตัวแทน — สรุปในหน้าตั้งค่า + ฟอร์มแก้ในหน้าแยก ───────────────
//
// กติกา (บังคับจริงที่เซิร์ฟเวอร์ ไม่ใช่แค่ซ่อนปุ่ม):
//   • แก้อีเมล/รหัสผ่านเองได้ 2 ครั้งตลอดอายุบัญชี
//   • ครั้งที่ 3 เป็นต้นไป กดบันทึกแล้วกลายเป็น "คำขอ" ที่ยังไม่มีผล จนกว่าสำนักงานใหญ่จะอนุมัติ
//   • ทุกครั้งที่เปลี่ยน สำนักงานใหญ่เห็นในบันทึกการใช้งาน
//
// ⚠️ ตัวแทน "ดูรหัสผ่านของตัวเองไม่ได้" (บอสสั่ง 28 ส.ค. 69) — หน้าสรุปโชว์ได้แค่อีเมล
//    รหัสผ่านมีทางเดียวคือ "ตั้งใหม่" โดยยืนยันด้วยรหัสปัจจุบัน
// ⚠️ การแก้ไม่อยู่ในหน้าตั้งค่ารวม — ต้องกดเข้าหน้าบัญชีแยก ให้เป็นการตั้งใจ ไม่ใช่เผลอแก้
//    ระหว่างแก้ข้อมูลบริษัท และหน้าจอที่เปิดค้างไว้จะไม่มีช่องรหัสผ่านทิ้งไว้ให้ใครมากรอก

import { useCallback, useEffect, useState } from "react";
import { KeyRound, Mail, Lock, ShieldCheck, Clock, ChevronRight } from "lucide-react";
import { account } from "@pms/shared/lib/data";
import type { AccountState } from "@pms/shared/lib/data/ports";
import { friendlyError } from "@pms/shared/lib/friendlyError";
import { fmtISOToThai } from "@pms/shared/lib/mock";

const กล่อง: React.CSSProperties = {
  background: "#F8FAFC", border: "1px solid #E7EDF4", borderRadius: 12, padding: "12px 14px",
};

/** โหลดสถานะบัญชีของสาขา — ใช้ทั้งหน้าสรุปและหน้าแก้ */
function useAccountState(dealerCode: string, currentEmail: string) {
  const [state, setState] = useState<AccountState | null>(null);
  const [โหลดพลาด, setโหลดพลาด] = useState("");
  const โหลด = useCallback(() => {
    account.state(dealerCode)
      .then(s => { setState(s); setโหลดพลาด(""); })
      // อ่านสถานะไม่ได้ = ยังบอกไม่ได้ว่าเหลือสิทธิ์กี่ครั้ง → บอกเหตุผลตรงนั้น ไม่ใช่ค้างที่ "กำลังอ่าน…"
      .catch(e => setโหลดพลาด(friendlyError(e)));
  }, [dealerCode]);
  useEffect(โหลด, [โหลด]);
  return { state, โหลดพลาด, โหลด, email: state?.email || currentEmail };
}

/* ── 1) หน้าตั้งค่า: สรุปบัญชี + ปุ่มเข้าไปหน้าจัดการ ───────────────────────── */
export function DealerAccountSummary({ dealerCode, currentEmail, onOpen }: {
  dealerCode: string; currentEmail: string; onOpen: () => void;
}) {
  const { state, โหลดพลาด, email } = useAccountState(dealerCode, currentEmail);
  const เหลือ = state ? Math.max(0, state.selfChangesLimit - state.selfChangesUsed) : null;

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.78rem", fontWeight: 800, color: "#003366",
        borderTop: "1px solid #f1f5f9", paddingTop: 18, marginBottom: 10 }}>
        <KeyRound size={14} /> ข้อมูลบัญชี
      </div>

      <div style={กล่อง}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", fontSize: "0.78rem" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8, color: "#64748B" }}>
            <Mail size={14} color="#94A3B8" /> อีเมลเข้าสู่ระบบ
          </span>
          <span style={{ fontWeight: 700, color: email ? "#1F2937" : "#94A3B8", overflow: "hidden", textOverflow: "ellipsis" }}>
            {email || "—"}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", fontSize: "0.78rem",
          borderTop: "1px solid #F1F5F9", marginTop: 8, paddingTop: 10 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8, color: "#64748B" }}>
            <Lock size={14} color="#94A3B8" /> รหัสผ่าน
          </span>
          {/* ไม่มีที่ไหนในระบบให้ตัวแทนอ่านรหัสของตัวเอง — เปลี่ยนได้อย่างเดียว */}
          <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#94A3B8", letterSpacing: 2 }}>••••••••</span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
        <button type="button" className="btn btn-secondary btn-md" onClick={onOpen} style={{ color: "#003366" }}>
          <ShieldCheck size={14} /> จัดการบัญชีเข้าระบบ <ChevronRight size={13} />
        </button>
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.68rem", color: โหลดพลาด ? "#b45309" : "#64748B" }}>
          <Lock size={11} />
          {โหลดพลาด ? โหลดพลาด
            : state == null ? "กำลังอ่านสถานะบัญชี…"
            : state.pending ? "มีคำขอรอสำนักงานใหญ่อนุมัติอยู่"
            : เหลือ === 0 ? "ใช้สิทธิ์แก้เองครบแล้ว — ครั้งต่อไปต้องขออนุมัติ"
            : `แก้อีเมล/รหัสผ่านเองได้อีก ${เหลือ} ครั้ง`}
        </span>
      </div>
    </>
  );
}

/* ── 2) หน้าจัดการบัญชี (หน้าแยก) — ที่เดียวที่แก้อีเมล/รหัสผ่านได้ ────────────── */
export function DealerAccountForm({ dealerCode, currentEmail }: { dealerCode: string; currentEmail: string }) {
  const { state, โหลดพลาด, โหลด, email: อีเมลปัจจุบัน } = useAccountState(dealerCode, currentEmail);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [current, setCurrent] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [พิมพ์เอง, setพิมพ์เอง] = useState(false);

  // ช่องอีเมลตามค่าปัจจุบันจนกว่าผู้ใช้จะพิมพ์เอง — อีเมลจริงมาถึงช้ากว่าเรนเดอร์แรก
  // ถ้าเติมแค่ตอนช่องว่าง จะค้างค่าที่มาก่อน (เคยโชว์อีเมลคนละอันกับบัญชีจริง)
  useEffect(() => { if (!พิมพ์เอง) setEmail(อีเมลปัจจุบัน); }, [อีเมลปัจจุบัน, พิมพ์เอง]);

  const เหลือ = state ? Math.max(0, state.selfChangesLimit - state.selfChangesUsed) : null;
  const ต้องขออนุมัติ = เหลือ === 0;
  const มีคำขอค้าง = !!state?.pending;
  const ล็อกฟอร์ม = busy || มีคำขอค้าง || !!โหลดพลาด;

  async function บันทึก() {
    setMsg(null);
    const อีเมลใหม่ = email.trim().toLowerCase() !== อีเมลปัจจุบัน.toLowerCase() ? email.trim() : "";
    if (!อีเมลใหม่ && !pw) { setMsg({ ok: false, text: "ยังไม่ได้เปลี่ยนอะไร — แก้อีเมลหรือกรอกรหัสผ่านใหม่ก่อน" }); return; }
    if (pw && pw !== pw2) { setMsg({ ok: false, text: "รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน" }); return; }
    if (!current) { setMsg({ ok: false, text: "ต้องกรอกรหัสผ่านปัจจุบันเพื่อยืนยันตัวตน" }); return; }
    setBusy(true);
    try {
      const r = await account.change({ dealerCode, currentPassword: current, email: อีเมลใหม่ || undefined, password: pw || undefined });
      setMsg({ ok: true, text: r.message });
      setPw(""); setPw2(""); setCurrent("");
      โหลด();
    } catch (e) {
      setMsg({ ok: false, text: friendlyError(e) });
    } finally { setBusy(false); }
  }

  return (
    <>
      {/* บัญชีที่ใช้อยู่ — อีเมลเท่านั้น (รหัสผ่านดูไม่ได้ เปลี่ยนได้อย่างเดียว) */}
      <div style={{ ...กล่อง, marginBottom: 14 }}>
        <div style={{ fontSize: "0.62rem", fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
          บัญชีที่ใช้อยู่ตอนนี้
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: "0.78rem" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8, color: "#64748B" }}><Mail size={14} color="#94A3B8" /> อีเมลเข้าสู่ระบบ</span>
          <span style={{ fontWeight: 700, color: อีเมลปัจจุบัน ? "#1F2937" : "#94A3B8" }}>{อีเมลปัจจุบัน || "—"}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: "0.78rem", borderTop: "1px solid #F1F5F9", marginTop: 8, paddingTop: 10 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8, color: "#64748B" }}><Lock size={14} color="#94A3B8" /> รหัสผ่าน</span>
          <span style={{ fontSize: "0.72rem", color: "#94A3B8" }}>ดูไม่ได้ด้วยเหตุผลด้านความปลอดภัย — ตั้งใหม่ได้ด้านล่าง</span>
        </div>
      </div>

      {/* สิทธิ์ที่เหลือ — บอกก่อนกรอก ไม่ใช่ไปเจอตอนกดบันทึก */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: "0.7rem", marginBottom: 14,
        color: โหลดพลาด || ต้องขออนุมัติ ? "#b45309" : "#64748B" }}>
        {โหลดพลาด || ต้องขออนุมัติ ? <ShieldCheck size={12} /> : <Lock size={12} />}
        {โหลดพลาด ? โหลดพลาด
          : state == null ? "กำลังอ่านสถานะบัญชี…"
          : ต้องขออนุมัติ
            ? "ใช้สิทธิ์แก้เองครบแล้ว — การเปลี่ยนครั้งต่อไปต้องรอสำนักงานใหญ่อนุมัติก่อนจึงมีผล"
            : `แก้อีเมล/รหัสผ่านเองได้อีก ${เหลือ} ครั้ง · ครบแล้วต้องขออนุมัติจากสำนักงานใหญ่ · ทุกครั้งที่เปลี่ยน สำนักงานใหญ่จะเห็น`}
      </div>

      {มีคำขอค้าง && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#FFFBEB", border: "1px solid #FDE68A",
          borderRadius: 10, padding: "10px 12px", fontSize: "0.72rem", color: "#92400E", marginBottom: 14 }}>
          <Clock size={13} />
          <span>
            ส่งคำขอเปลี่ยนบัญชีให้สำนักงานใหญ่แล้ว ({fmtISOToThai(String(state?.pending?.requestedAt ?? "").slice(0, 10))})
            — รอผลอนุมัติ ยังใช้อีเมล/รหัสเดิมเข้าระบบได้ตามปกติ
          </span>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14 }}>
        <div>
          <label className="form-label">อีเมลเข้าสู่ระบบใหม่</label>
          <input className="form-input" value={email} disabled={ล็อกฟอร์ม}
            onChange={e => { setพิมพ์เอง(true); setEmail(e.target.value.replace(/\s/g, "")); }}
            aria-label="อีเมลเข้าสู่ระบบ" placeholder="name@company.co.th" />
        </div>
        <div>
          <label className="form-label">รหัสผ่านปัจจุบัน *</label>
          <input className="form-input" type="password" value={current} disabled={ล็อกฟอร์ม}
            onChange={e => setCurrent(e.target.value.replace(/\s/g, ""))} aria-label="รหัสผ่านปัจจุบัน"
            placeholder="ยืนยันตัวตนก่อนเปลี่ยน" autoComplete="current-password" />
        </div>
        <div>
          <label className="form-label">รหัสผ่านใหม่ (เว้นว่างถ้าไม่เปลี่ยน)</label>
          <input className="form-input" type="password" value={pw} disabled={ล็อกฟอร์ม}
            onChange={e => setPw(e.target.value.replace(/\s/g, ""))} aria-label="รหัสผ่านใหม่"
            placeholder="อย่างน้อย 8 ตัวอักษร" autoComplete="new-password" />
        </div>
        <div>
          <label className="form-label">ยืนยันรหัสผ่านใหม่</label>
          <input className="form-input" type="password" value={pw2} disabled={ล็อกฟอร์ม}
            onChange={e => setPw2(e.target.value.replace(/\s/g, ""))} aria-label="ยืนยันรหัสผ่านใหม่"
            placeholder="พิมพ์รหัสใหม่อีกครั้ง" autoComplete="new-password" />
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
        <button type="button" className="btn btn-primary btn-md" disabled={ล็อกฟอร์ม} onClick={บันทึก}>
          <KeyRound size={13} /> {ต้องขออนุมัติ ? "ส่งคำขอเปลี่ยนบัญชี" : "บันทึกบัญชีเข้าระบบ"}
        </button>
        {msg && <span style={{ fontSize: "0.74rem", fontWeight: 600, color: msg.ok ? "#059669" : "#dc2626" }}>{msg.text}</span>}
      </div>
    </>
  );
}
