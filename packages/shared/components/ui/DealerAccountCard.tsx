"use client";

// ── ข้อมูลบัญชีเข้าระบบของตัวแทน — แก้อีเมล/รหัสผ่านเองได้ (บอสสั่ง 28 ส.ค. 69) ──────
//
// กติกา (บังคับจริงที่เซิร์ฟเวอร์ ไม่ใช่แค่ซ่อนปุ่ม):
//   • แก้เองได้ 2 ครั้งตลอดอายุบัญชี
//   • ครั้งที่ 3 เป็นต้นไป กดบันทึกแล้วกลายเป็น "คำขอ" ที่ยังไม่มีผล จนกว่าสำนักงานใหญ่จะอนุมัติ
//   • ทุกครั้งที่เปลี่ยน สำนักงานใหญ่เห็นในบันทึกการใช้งาน และเปิดดูรหัสที่ตั้งใหม่ได้
//
// ⚠️ ต้องกรอกรหัสผ่านปัจจุบันทุกครั้ง — กันคนที่มานั่งหน้าจอที่เปิดค้างไว้เปลี่ยนบัญชีของสาขา

import { useCallback, useEffect, useState } from "react";
import { KeyRound, Mail, Lock, ShieldCheck, Clock } from "lucide-react";
import { account } from "@pms/shared/lib/data";
import type { AccountState } from "@pms/shared/lib/data/ports";
import { friendlyError } from "@pms/shared/lib/friendlyError";
import { fmtISOToThai } from "@pms/shared/lib/mock";

export function DealerAccountCard({ dealerCode, currentEmail }: { dealerCode: string; currentEmail: string }) {
  const [state, setState] = useState<AccountState | null>(null);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [current, setCurrent] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [โหลดพลาด, setโหลดพลาด] = useState("");

  const โหลด = useCallback(() => {
    account.state(dealerCode)
      .then(s => { setState(s); setEmail(s.email || currentEmail); setโหลดพลาด(""); })
      // อ่านสถานะไม่ได้ = ยังบอกไม่ได้ว่าเหลือสิทธิ์กี่ครั้ง → บอกเหตุผลตรงนั้น ไม่ใช่ค้างที่ "กำลังอ่าน…"
      .catch(e => setโหลดพลาด(friendlyError(e)));
  }, [dealerCode, currentEmail]);
  useEffect(โหลด, [โหลด]);

  const เหลือ = state ? Math.max(0, state.selfChangesLimit - state.selfChangesUsed) : null;
  const ต้องขออนุมัติ = เหลือ === 0;
  const มีคำขอค้าง = !!state?.pending;

  async function บันทึก() {
    setMsg(null);
    const อีเมลใหม่ = email.trim().toLowerCase() !== (state?.email || currentEmail).toLowerCase() ? email.trim() : "";
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
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.78rem", fontWeight: 800, color: "#003366",
        borderTop: "1px solid #f1f5f9", paddingTop: 18, marginBottom: 6 }}>
        <KeyRound size={14} /> ข้อมูลบัญชี
      </div>

      {/* สิทธิ์ที่เหลือ — บอกก่อนกรอก ไม่ใช่ไปเจอตอนกดบันทึก */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: "0.68rem", marginBottom: 12,
        color: โหลดพลาด ? "#b45309" : ต้องขออนุมัติ ? "#b45309" : "#64748B" }}>
        {ต้องขออนุมัติ || โหลดพลาด ? <ShieldCheck size={12} /> : <Lock size={12} />}
        {โหลดพลาด ? โหลดพลาด
          : state == null ? "กำลังอ่านสถานะบัญชี…"
          : ต้องขออนุมัติ
            ? "ใช้สิทธิ์แก้เองครบแล้ว — การเปลี่ยนครั้งต่อไปต้องรอสำนักงานใหญ่อนุมัติก่อนจึงมีผล"
            : `แก้อีเมล/รหัสผ่านเองได้อีก ${เหลือ} ครั้ง · ครบแล้วต้องขออนุมัติจากสำนักงานใหญ่ · ทุกครั้งที่เปลี่ยน สำนักงานใหญ่จะเห็น`}
      </div>

      {มีคำขอค้าง && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#FFFBEB", border: "1px solid #FDE68A",
          borderRadius: 10, padding: "10px 12px", fontSize: "0.72rem", color: "#92400E", marginBottom: 12 }}>
          <Clock size={13} />
          <span>
            ส่งคำขอเปลี่ยนบัญชีให้สำนักงานใหญ่แล้ว (
            {fmtISOToThai(String(state?.pending?.requestedAt ?? "").slice(0, 10))}) — รอผลอนุมัติ ยังใช้อีเมล/รหัสเดิมเข้าระบบได้ตามปกติ
          </span>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14 }}>
        <div>
          <label className="form-label">อีเมลเข้าสู่ระบบ</label>
          <div style={{ position: "relative" }}>
            <Mail size={14} color="#94a3b8" style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} />
            <input className="form-input" style={{ paddingLeft: 32 }} value={email} disabled={busy || มีคำขอค้าง}
              onChange={e => setEmail(e.target.value.replace(/\s/g, ""))} aria-label="อีเมลเข้าสู่ระบบ" placeholder="name@company.co.th" />
          </div>
        </div>
        <div>
          <label className="form-label">รหัสผ่านปัจจุบัน</label>
          <input className="form-input" type="password" value={current} disabled={busy || มีคำขอค้าง}
            onChange={e => setCurrent(e.target.value.replace(/\s/g, ""))} aria-label="รหัสผ่านปัจจุบัน" placeholder="ยืนยันตัวตนก่อนเปลี่ยน" autoComplete="current-password" />
        </div>
        <div>
          <label className="form-label">รหัสผ่านใหม่ (เว้นว่างถ้าไม่เปลี่ยน)</label>
          <input className="form-input" type="password" value={pw} disabled={busy || มีคำขอค้าง}
            onChange={e => setPw(e.target.value.replace(/\s/g, ""))} aria-label="รหัสผ่านใหม่" placeholder="อย่างน้อย 8 ตัวอักษร" autoComplete="new-password" />
        </div>
        <div>
          <label className="form-label">ยืนยันรหัสผ่านใหม่</label>
          <input className="form-input" type="password" value={pw2} disabled={busy || มีคำขอค้าง}
            onChange={e => setPw2(e.target.value.replace(/\s/g, ""))} aria-label="ยืนยันรหัสผ่านใหม่" placeholder="พิมพ์รหัสใหม่อีกครั้ง" autoComplete="new-password" />
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
        <button type="button" className="btn btn-primary btn-md" disabled={busy || มีคำขอค้าง || !!โหลดพลาด} onClick={บันทึก}>
          <KeyRound size={13} /> {ต้องขออนุมัติ ? "ส่งคำขอเปลี่ยนบัญชี" : "บันทึกบัญชีเข้าระบบ"}
        </button>
        {msg && (
          <span style={{ fontSize: "0.72rem", fontWeight: 600, color: msg.ok ? "#059669" : "#dc2626" }}>{msg.text}</span>
        )}
      </div>
    </>
  );
}
