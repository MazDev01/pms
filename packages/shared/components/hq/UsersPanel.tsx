"use client";

// ─── HQ · ผู้ใช้งานและสิทธิ์ (HQ Users เท่านั้น) ─────────────────────────────────
// บริหารผู้ใช้ของ "สำนักงานใหญ่" เท่านั้น — ไม่แสดงผู้ใช้ Dealer (ดีลเลอร์จัดการใน Workspace ตัวเอง
// ผ่านเมนู "ตัวแทน" → เจาะรายตัว). Stat · Filter · Data table · Action dropdown · Detail Drawer+Timeline · Permission Matrix
import { useState, useMemo, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { SortableTh } from "@pms/shared/components/ui/SortableTh";
import { TablePagination } from "@pms/shared/components/ui/TablePagination";
import { useModalA11y } from "@pms/shared/lib/useModalA11y";
import { logRepoRead } from "@pms/shared/lib/repoLog";
import { friendlyError } from "@pms/shared/lib/friendlyError";
import { useAuditLogger, useAuditEntries } from "@pms/shared/lib/useAudit";
import { APP_NOW_ISO } from "@pms/shared/context/FilterContext";
import { fmtISOToThai } from "@pms/shared/lib/mock";
import { RightDrawer } from "@pms/shared/components/ui/RightDrawer";
import { CountUp } from "@pms/shared/components/ui/CountUp";
import { fileToResizedDataURL } from "@pms/shared/lib/imageResize";
import { resetHQUserPassword } from "@pms/shared/lib/adminApi";
import { ClickableRow } from "@pms/shared/components/ui/ClickableRow";
import { hasPermission, type Permission } from "@pms/shared/lib/permissions";
import { users as usersRepo } from "@pms/shared/lib/data";
import { DATA_SOURCE } from "@pms/shared/lib/data/config";
import { sbSendPasswordReset } from "@pms/shared/lib/supabaseAuth";
import { createHQUser, deleteHQUser } from "@pms/shared/lib/adminApi";
import { useRole } from "@pms/shared/context/RoleContext";
import type { UserRole } from "@pms/shared/lib/mock";
import {
  Users, Shield, Check, X, Plus, Search, KeyRound, Copy, MoreHorizontal,
  Eye, EyeOff, Pencil, Power, Clock, UserPlus, Phone, ImagePlus, Trash2, AlertTriangle,
} from "lucide-react";

const PRIMARY = "#003366";
const STEEL = "#2D2D2D";
const BORDER = "#e5e7eb";
const MUTED = "#6b7280";
const MOCK_TODAY = fmtISOToThai(APP_NOW_ISO); // วันที่เพิ่มผู้ใช้ = วันนี้ของระบบ (supabase=จริง / local=ตรึง)

// ── Roles (HQ เท่านั้น · 3 บทบาทจริงในระบบ) ─────────────────────────────────────
// บทบาทต้องเป็นชุดเดียวกับที่ระบบบังคับใช้จริง (user_role ใน DB + ROLE_PERMISSIONS)
// เดิมหน้านี้มีคำศัพท์บทบาทของตัวเอง 5 แบบ (sales_manager / central_sales / …)
// ซึ่งไม่มีอยู่จริงในระบบเลย → ตั้งบทบาทให้ใครก็ไม่มีผลกับสิทธิ์ที่ได้จริง
type RoleKey = "SUPER_ADMIN" | "HQ_MANAGEMENT" | "HQ_STAFF";
type UserStatus = "active" | "inactive";
const ROLES: { key: RoleKey; en: string; th: string; tone: string }[] = [
  { key: "SUPER_ADMIN",   en: "Super Admin",  th: "ผู้ดูแลระบบ",        tone: "#003366" },
  { key: "HQ_MANAGEMENT", en: "HQ Management", th: "ผู้บริหารสำนักงานใหญ่", tone: "#7c3aed" },
  { key: "HQ_STAFF",      en: "HQ Staff",      th: "เจ้าหน้าที่สำนักงานใหญ่", tone: "#0891b2" },
];
const ROLE_BY_KEY = Object.fromEntries(ROLES.map(r => [r.key, r])) as Record<RoleKey, typeof ROLES[number]>;
const DEPARTMENTS = ["บริหาร", "ฝ่ายขาย", "ปฏิบัติการ", "ไอทีและระบบ", "การเงิน"];
const defaultDept = (role: RoleKey): string =>
  role === "HQ_MANAGEMENT" ? "บริหาร" : role === "HQ_STAFF" ? "ฝ่ายขาย" : "ไอทีและระบบ";

// ── Permission model: role → module → level → CRUD-E ────────────────────────────
type Cap = { v: boolean; c: boolean; e: boolean; d: boolean; x: boolean };
const LEVEL_CAP: Record<string, Cap> = {
  full:   { v: true,  c: true,  e: true,  d: true,  x: true  },
  manage: { v: true,  c: true,  e: true,  d: false, x: true  },
  edit:   { v: true,  c: true,  e: true,  d: false, x: false },
  view:   { v: true,  c: false, e: false, d: false, x: true  },
  none:   { v: false, c: false, e: false, d: false, x: false },
};
// โมดูลในตารางสิทธิ์ = 7 หัวข้อตามสเปก Enterprise (ไม่มีเมนู "ความปลอดภัย" แยก)
const MODULE_LIST = ["แดชบอร์ด", "ตัวแทน", "ลูกค้าเป้าหมาย", "ลูกค้า", "ใบเสนอราคา", "รายงาน", "ตั้งค่า"];
// ตารางสิทธิ์คำนวณจาก ROLE_PERMISSIONS ซึ่งเป็นชุดเดียวกับที่ RLS ที่ DB บังคับ
//
// เดิมตารางนี้เขียนไว้ตายตัวและ "ขัดกับของจริง" — บอกว่าผู้จัดการฝ่ายขายจัดการลีด/ลูกค้า/
// ใบเสนอราคาได้ ทั้งที่ทุกบทบาทฝั่งสำนักงานใหญ่เขียนงานขายไม่ได้เลย (ดู C3)
// ใครอ่านตารางนี้แล้วเชื่อ จะเข้าใจสิทธิ์ของทีมตัวเองผิดทั้งหมด
const MODULE_PERMS: Record<string, { read: Permission; create?: Permission; update?: Permission; del?: Permission }> = {
  "แดชบอร์ด":       { read: "reports:view" },
  "ตัวแทน":         { read: "reports:view", create: "dealers:manage", update: "dealers:manage", del: "dealers:manage" },
  "ลูกค้าเป้าหมาย": { read: "leads:read", create: "leads:create", update: "leads:update", del: "leads:delete" },
  "ลูกค้า":         { read: "customers:read", create: "customers:create", update: "customers:update", del: "customers:delete" },
  "ใบเสนอราคา":     { read: "quotations:read", create: "quotations:create", update: "quotations:update", del: "quotations:delete" },
  "รายงาน":         { read: "reports:view" },
  "ตั้งค่า":        { read: "hq:all_data", create: "catalog:edit", update: "catalog:edit", del: "catalog:edit" },
};
const capOf = (role: RoleKey, module: string): Cap => {
  const m = MODULE_PERMS[module];
  if (!m) return LEVEL_CAP.none;
  const has = (perm?: Permission) => !!perm && hasPermission(role as UserRole, perm);
  const v = has(m.read);
  return { v, c: v && has(m.create), e: v && has(m.update), d: v && has(m.del), x: v };
};
const roleSummary: Record<RoleKey, string> = {
  SUPER_ADMIN:   "จัดการทุกอย่างในระบบ · แก้ข้อมูลกลางและผู้ใช้ได้",
  HQ_MANAGEMENT: "ดูงานขายทั้งเครือ · แก้ข้อมูลกลาง (แคตตาล็อก/ตัวแทน/นโยบาย) ได้",
  HQ_STAFF:      "ดูงานขายทั้งเครือได้อย่างเดียว · แก้ข้อมูลกลางไม่ได้",
};

// ไม่มีฟิลด์ "เข้าใช้ล่าสุด" — ระบบไม่ได้บันทึกเวลาเข้าสู่ระบบจริง (เดิมเป็นข้อความ seed ตายตัวที่ไม่มีอะไรอัปเดต)
type AppUser = {
  id: string; name: string; email: string; phone: string; role: RoleKey; department: string;
  status: UserStatus; createdAt: string; avatar?: string;
};
// (USERS_INIT ถูกลบ — เดิมเป็นผู้ใช้สมมติ 7 คนที่ไม่มีอยู่จริงในระบบยืนยันตัวตน
//  หน้านี้เลยบริหารรายชื่อที่ล็อกอินไม่ได้ และลบชื่อออกก็ไม่ได้ตัดสิทธิ์ใครจริง ๆ)

// ── Helpers ─────────────────────────────────────────────────────────────────────
function genTempPassword(seed: string): string {
  const local = ((seed.split("@")[0] || "user").replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase()) || "USR";
  const sum = seed.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  return `BJ-${local}-${1000 + (sum % 9000)}`;
}

// ── Small UI ─────────────────────────────────────────────────────────────────────
function Avatar({ name, role, size = 34, avatar }: { name: string; role: RoleKey; size?: number; avatar?: string }) {
  if (avatar) return <img src={avatar} alt="" style={{ width: size, height: size, borderRadius: size * 0.29, objectFit: "cover", flexShrink: 0 }} />;
  return <span style={{ width: size, height: size, borderRadius: size * 0.29, flexShrink: 0, background: ROLE_BY_KEY[role].tone, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: size * 0.42 }}>{name.charAt(0)}</span>;
}
function RoleBadge({ role }: { role: RoleKey }) {
  const r = ROLE_BY_KEY[role];
  return <span className="badge" style={{ background: r.tone + "1a", color: r.tone, fontWeight: 700 }}>{r.th}</span>;
}
function StatusDot({ status }: { status: UserStatus }) {
  const a = status === "active";
  return <span className="badge" style={{ background: a ? "#e5faf0" : "#f0f0f5", color: a ? "#059669" : "#9ca3af" }}><span style={{ width: 7, height: 7, borderRadius: "50%", display: "inline-block", background: a ? "#059669" : "#C0C0C0" }} />{a ? "ใช้งาน" : "ปิดใช้งาน"}</span>;
}
function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return <div style={{ marginBottom: 12 }}><div style={{ fontSize: "0.68rem", color: MUTED, fontWeight: 600, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div><div style={{ fontSize: "0.86rem", color: STEEL, fontWeight: 600 }}>{value}</div></div>;
}

// ── Add/Edit Dialog (modal กลาง) ─────────────────────────────────────────────────
type UserForm = { firstName: string; lastName: string; email: string; phone: string; role: RoleKey; department: string; tempPassword: string; status: UserStatus; avatar?: string };
function UserDialog({ initial, onSave, onClose, canEditPrivileges = true }: { initial?: AppUser; onSave: (u: Omit<AppUser, "id" | "createdAt">) => void; onClose: () => void; canEditPrivileges?: boolean }) {
  // ล็อกบทบาท/สถานะตอน "แก้ไข" ถ้าไม่มีสิทธิ์ (HQ_MANAGEMENT) — RLS/trigger จะปฏิเสธการเปลี่ยนอยู่แล้ว
  const lockPriv = !!initial && !canEditPrivileges;
  const [f, setF] = useState<UserForm>(() => {
    if (initial) { const [fn, ...ln] = initial.name.split(" "); return { firstName: fn, lastName: ln.join(" "), email: initial.email, phone: initial.phone, role: initial.role, department: initial.department, tempPassword: "", status: initial.status, avatar: initial.avatar }; }
    return { firstName: "", lastName: "", email: "", phone: "", role: "HQ_STAFF", department: "ฝ่ายขาย", tempPassword: genTempPassword("newuser@benjamin.co.th"), status: "active" };
  });
  const fileRef = useRef<HTMLInputElement>(null);
  async function pickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = ""; if (!file) return;
    // ไฟล์ที่ไม่ผ่านการตรวจต้องบอกเหตุผล และต้องไม่ล้างรูปเดิมทิ้งก่อนรู้ผล
    try {
      const url = await fileToResizedDataURL(file, 160);
      setF(p => ({ ...p, avatar: url }));
    } catch (err) { alert(err instanceof Error ? err.message : "ใช้ไฟล์นี้เป็นรูปโปรไฟล์ไม่ได้"); }
  }
  const valid = f.firstName.trim() && /\S+@\S+\.\S+/.test(f.email);
  const inp: React.CSSProperties = { width: "100%", padding: "9px 12px", borderRadius: 9, border: `1px solid ${BORDER}`, fontSize: "0.84rem", color: STEEL, background: "#fff", outline: "none", boxSizing: "border-box" };
  const submit = () => { if (!valid) return; onSave({ name: `${f.firstName.trim()} ${f.lastName.trim()}`.trim(), email: f.email.trim(), phone: f.phone.trim(), role: f.role, department: f.department, status: f.status, avatar: f.avatar }); onClose(); };
  const dialogRef = useModalA11y<HTMLDivElement>(onClose);   // Esc ปิด · Tab วนในกล่อง · คืนโฟกัสเดิม
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(45,45,45,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="ฟอร์มผู้ใช้ HQ" onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 520, background: "#fff", borderRadius: 18, overflow: "hidden", boxShadow: "0 24px 80px rgba(0,0,0,.28)" }}>
        <div style={{ background: PRIMARY, color: "#fff", padding: "16px 22px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, fontWeight: 800 }}>{initial ? <Pencil size={16} /> : <UserPlus size={17} />} {initial ? "แก้ไขผู้ใช้ HQ" : "เพิ่มผู้ใช้งาน HQ"}</div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,.15)", color: "#fff", border: "none", cursor: "pointer" }}><X size={15} /></button>
        </div>
        <div style={{ padding: 22, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {/* รูปโปรไฟล์ — คลิกเพื่ออัปโหลด/เปลี่ยน */}
          <div style={{ gridColumn: "1/-1", display: "flex", justifyContent: "center", marginBottom: 4 }}>
            <label title="อัปโหลด/เปลี่ยนรูปโปรไฟล์" style={{ cursor: "pointer", position: "relative", display: "inline-block" }}>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={pickAvatar} />
              {f.avatar
                ? <img src={f.avatar} alt="" style={{ width: 84, height: 84, borderRadius: "50%", objectFit: "cover", border: `3px solid ${PRIMARY}` }} />
                : f.firstName.trim()
                ? <span style={{ width: 84, height: 84, borderRadius: "50%", background: ROLE_BY_KEY[f.role].tone, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "2rem" }}>{f.firstName.trim().charAt(0)}</span>
                // ฟอร์มเปล่า (ยังไม่พิมพ์ชื่อ) ต้องเห็นไอคอน "เพิ่มรูป" ไม่ใช่ "?" ที่อ่านได้ว่ารูปเสีย
                //   แบบเดียวกับฟอร์มเพิ่มผู้รับผิดชอบฝั่งตัวแทน (ผู้ใช้แจ้ง 7 ส.ค. 69)
                : <span style={{ width: 84, height: 84, borderRadius: "50%", background: "#eef3f8", border: `2px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", color: PRIMARY }}><ImagePlus size={30} strokeWidth={1.8} /></span>}
              <span style={{ position: "absolute", right: 0, bottom: 2, width: 26, height: 26, borderRadius: "50%", background: PRIMARY, border: "2px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}><ImagePlus size={13} /></span>
              {f.avatar && <button type="button" onClick={e => { e.preventDefault(); setF(p => ({ ...p, avatar: undefined })); }} style={{ position: "absolute", left: 0, bottom: 2, width: 24, height: 24, borderRadius: "50%", background: "#fff", border: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", color: "#dc2626", cursor: "pointer" }}><X size={12} /></button>}
            </label>
          </div>
          <div><label className="form-label">ชื่อ *</label><input style={inp} value={f.firstName} autoFocus onChange={e => setF({ ...f, firstName: e.target.value })} placeholder="ชื่อ" /></div>
          <div><label className="form-label">นามสกุล</label><input style={inp} value={f.lastName} onChange={e => setF({ ...f, lastName: e.target.value })} placeholder="นามสกุล" /></div>
          <div style={{ gridColumn: "1/-1" }}><label className="form-label">อีเมล (ใช้เข้าระบบ) *</label><input style={inp} value={f.email} onChange={e => setF({ ...f, email: e.target.value })} placeholder="name@benjamin.co.th" /></div>
          <div><label className="form-label">เบอร์โทร</label><input style={inp} value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} placeholder="08x-xxx-xxxx" /></div>
          <div><label className="form-label">แผนก</label><select style={inp} value={f.department} onChange={e => setF({ ...f, department: e.target.value })}>{DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
          <div><label className="form-label">บทบาท (Role){lockPriv && <span style={{ fontSize: "0.6rem", color: MUTED, fontWeight: 400 }}> · เฉพาะผู้ดูแลระบบ</span>}</label><select style={{ ...inp, ...(lockPriv ? { background: "#f3f4f6", cursor: "not-allowed", opacity: .7 } : {}) }} disabled={lockPriv} value={f.role} onChange={e => setF({ ...f, role: e.target.value as RoleKey, department: defaultDept(e.target.value as RoleKey) })}>{ROLES.filter(r => r.key !== "SUPER_ADMIN" || canEditPrivileges).map(r => <option key={r.key} value={r.key}>{r.th}</option>)}</select></div>
          <div><label className="form-label">สถานะ{lockPriv && <span style={{ fontSize: "0.6rem", color: MUTED, fontWeight: 400 }}> · เฉพาะผู้ดูแลระบบ</span>}</label><select style={{ ...inp, ...(lockPriv ? { background: "#f3f4f6", cursor: "not-allowed", opacity: .7 } : {}) }} disabled={lockPriv} value={f.status} onChange={e => setF({ ...f, status: e.target.value as UserStatus })}><option value="active">ใช้งาน</option><option value="inactive">ปิดใช้งาน</option></select></div>
          {!initial && <div style={{ gridColumn: "1/-1" }}><label className="form-label">รหัสผ่านชั่วคราว</label><input style={{ ...inp, fontFamily: "monospace", fontWeight: 700 }} value={f.tempPassword} onChange={e => setF({ ...f, tempPassword: e.target.value })} /><div style={{ fontSize: "0.66rem", color: MUTED, marginTop: 4 }}>ผู้ใช้ต้องเปลี่ยนเองหลังเข้าระบบครั้งแรก</div></div>}
        </div>
        <div style={{ padding: "14px 22px", borderTop: `1px solid ${BORDER}`, background: "#fafafa", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="btn btn-secondary btn-md" onClick={onClose}>ยกเลิก</button>
          <button className="btn btn-primary btn-md" disabled={!valid} style={!valid ? { opacity: .5, cursor: "not-allowed" } : undefined} onClick={submit}><Check size={14} /> บันทึก</button>
        </div>
      </div>
    </div>
  );
}

// ── Action dropdown (fixed-position, ไม่โดน clip) ────────────────────────────────
//
// ⚠️ ต้องดันขึ้นเองเมื่อชนขอบล่างจอ (แก้ 14 ส.ค. 69)
//   เดิมวางที่ตำแหน่งปุ่มตรง ๆ โดยไม่ดูว่าเมนูสูงเท่าไรและเหลือที่ข้างล่างพอไหม
//   แถวท้าย ๆ ของตาราง (หรือเมนูที่มีหลายรายการ) จึงถูกตัดหายไปครึ่งหนึ่ง
//   ผู้ใช้กดคำสั่งที่อยู่ล่างสุดไม่ได้เลย และไม่รู้ด้วยซ้ำว่ามีคำสั่งอะไรอยู่ข้างล่าง
//   (ผู้ใช้แจ้งหลังเพิ่มรายการ "ตั้งรหัสผ่านใหม่ทันที" ซึ่งทำให้เมนูสูงขึ้นจนพ้นจอ)
function ActionMenu({ pos, onClose, items }: { pos: { x: number; y: number }; onClose: () => void; items: { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean }[] }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(pos.y);
  // วัดความสูงจริงหลังวาด แล้วเลื่อนขึ้นให้พอดีจอ — วัดเองดีกว่าเดาจากจำนวนรายการ
  // (ความสูงต่อรายการเปลี่ยนได้ตามความยาวข้อความที่ตัดขึ้นบรรทัดใหม่)
  useLayoutEffect(() => {
    const h = boxRef.current?.offsetHeight ?? 0;
    const M = 8; // เว้นขอบจอไว้หน่อย ไม่ให้ติดขอบพอดีเป๊ะ
    setTop(Math.max(M, Math.min(pos.y, window.innerHeight - h - M)));
  }, [pos.y, items.length]);

  // ── เลื่อนหน้าจอแล้วต้องปิดเมนูเอง (แก้ 14 ส.ค. 69) ──
  // ฉากหลังใสที่คลุมทั้งจอไว้ดักคลิก ดัก "ล้อเมาส์" ไปด้วย — และหน้านี้เลื่อนในกล่องเนื้อหา
  // ไม่ใช่เลื่อนทั้งหน้า ล้อจึงไปไม่ถึงกล่องที่เลื่อนได้จริง ผลคือเปิดเมนูค้างไว้แล้วหน้าจอนิ่งสนิท
  // ต้องกดปิดก่อนถึงจะเลื่อนได้ (ผู้ใช้แจ้ง) · ปิดเมื่อเริ่มเลื่อน = ท่ามาตรฐานของเมนูแบบนี้
  // ปิดเมื่อ resize ด้วย — ไม่งั้นเมนูค้างอยู่ตำแหน่งเดิมที่ไม่ตรงกับปุ่มอีกต่อไป
  useEffect(() => {
    const close = () => onClose();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    // capture=true → จับได้แม้กล่องด้านในเป็นตัวที่เลื่อน (scroll ไม่ bubble ขึ้น document)
    window.addEventListener("scroll", close, true);
    window.addEventListener("wheel", close, { passive: true });
    window.addEventListener("touchmove", close, { passive: true });
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("wheel", close);
      window.removeEventListener("touchmove", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 300 }} />
      <div ref={boxRef} style={{ position: "fixed", top, left: pos.x, zIndex: 301, background: "#fff", borderRadius: 12, border: `1px solid ${BORDER}`, boxShadow: "0 16px 40px rgba(0,0,0,.16)", padding: 6, minWidth: 190, maxHeight: "calc(100vh - 16px)", overflowY: "auto", transform: "translateX(-100%)" }}>
        {items.map((it, i) => (
          <button key={i} onClick={() => { it.onClick(); onClose(); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 12px", border: "none", background: "none", cursor: "pointer", borderRadius: 8, fontSize: "0.82rem", fontWeight: 600, color: it.danger ? "#dc2626" : STEEL, textAlign: "left", fontFamily: "inherit" }} onMouseEnter={e => (e.currentTarget.style.background = it.danger ? "#fef2f2" : "#f5f7fa")} onMouseLeave={e => (e.currentTarget.style.background = "none")}>{it.icon} {it.label}</button>
        ))}
      </div>
    </>
  );
}

// ═══════════════════════ PAGE ═══════════════════════════════════════════════════
type SortKey = "name" | "createdAt";
const PAGE_SIZE = 10;

export function UsersPanel({ embedded }: { embedded?: boolean } = {}) {
  // ผู้ใช้จริงในระบบ (ตาราง profiles) — เฉพาะฝั่งสำนักงานใหญ่ (dealerCode ว่าง)
  const [users, setUsers] = useState<AppUser[]>([]);
  const canCreate = usersRepo.canCreate();
  // แก้บทบาท/สถานะของผู้ใช้ = เฉพาะ SUPER_ADMIN (RLS/trigger บังคับ · 0026/0064) —
  // HQ_MANAGEMENT แก้ได้แค่ข้อมูลทั่วไป → ล็อกช่อง role/status ในโหมดแก้ไข กันกดแล้ว error
  const { role: currentRole } = useRole();
  const canEditPrivileges = String(currentRole) === "SUPER_ADMIN";
  const reload = useCallback(() => {
    usersRepo.list()
      .then(rows => setUsers(rows.filter(u => !u.dealerCode).map(u => ({
        id: u.id, name: u.name, email: u.email, phone: u.phone,
        role: (ROLE_BY_KEY[u.role as RoleKey] ? u.role : "HQ_STAFF") as RoleKey,
        department: u.department, status: u.status, createdAt: u.createdAt, avatar: u.avatar,
      }))))
      .catch(e => logRepoRead("users.list", e));
  }, []);
  useEffect(() => { reload(); }, [reload]);
  const logAudit = useAuditLogger();

  const [q, setQ] = useState("");
  const [roleF, setRoleF] = useState<RoleKey | "all">("all");
  const [deptF, setDeptF] = useState<string>("all");
  const [statusF, setStatusF] = useState<UserStatus | "all">("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "name", dir: "asc" });
  const [page, setPage] = useState(1);

  const [dialogUser, setDialogUser] = useState<AppUser | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [detailUser, setDetailUser] = useState<AppUser | null>(null);

  // toast มาตรฐานของหน้านี้เอง — ใช้ได้ทั้งตอน standalone (/hq/users) และ embedded ใน /hq/settings
  // (BusCtx toast ของหน้าตั้งค่าใช้ไม่ได้ตอน standalone เพราะไม่มี provider ครอบ) แทน alert() เดิม
  // ที่บล็อกทั้งหน้าจอและดูไม่ตรงกับ pattern ของแอป (พบจาก /scenario 31 ก.ค. 69)
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const notify = useCallback((m: string) => { setToastMsg(m); setTimeout(() => setToastMsg(null), 2800); }, []);
  const [resetInfo, setResetInfo] = useState<{ user: AppUser } | null>(null);
  const [menu, setMenu] = useState<{ user: AppUser; x: number; y: number } | null>(null);
  const [matrixRole, setMatrixRole] = useState<RoleKey>("SUPER_ADMIN");
  const [creds, setCreds] = useState<{ name: string; email: string; password: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null);

  const stats = useMemo(() => ({
    total: users.length,
    active: users.filter(u => u.status === "active").length,
    inactive: users.filter(u => u.status === "inactive").length,
  }), [users]);

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return [...users.filter(u =>
      (!kw || u.name.toLowerCase().includes(kw) || u.email.toLowerCase().includes(kw)) &&
      (roleF === "all" || u.role === roleF) &&
      (deptF === "all" || u.department === deptF) &&
      (statusF === "all" || u.status === statusF))]
      .sort((a, b) => { const av = a[sort.key], bv = b[sort.key]; return (av < bv ? -1 : av > bv ? 1 : 0) * (sort.dir === "asc" ? 1 : -1); });
  }, [users, q, roleF, deptF, statusF, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const curPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE);

  const update = (id: string, patch: Partial<AppUser>) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...patch } : u));
    const cur = users.find(u => u.id === id);
    if (!cur) return;
    const next = { ...cur, ...patch };
    // ⚠️ ต้องส่งทุกช่องที่ฟอร์มให้แก้ได้ — เดิมส่งแค่ ชื่อ/บทบาท/แผนก/สถานะ
    //   ฟอร์มให้เปลี่ยนรูป เบอร์ และอีเมลติดต่อได้ด้วย พอกดบันทึกหน้าจอขึ้นค่าใหม่ให้ดู
    //   (เพราะอัปเดตในหน้าจอไปแล้วบรรทัดบน) แต่ไม่เคยถูกบันทึกลงฐานข้อมูลเลย
    //   โหลดหน้าใหม่ทีไรรูปเก่ากลับมาทุกครั้ง — ผู้ใช้แจ้ง 11 ส.ค. 69
    void usersRepo.update({
      id, name: next.name, role: next.role, department: next.department, status: next.status,
      ...("avatar" in patch ? { avatar: next.avatar } : {}),
      ...(patch.phone !== undefined ? { phone: next.phone } : {}),
      ...(patch.email !== undefined ? { email: next.email } : {}),
    }).catch(e => notify("บันทึกผู้ใช้ไม่สำเร็จ: " + friendlyError(e)));
  };
  function saveUser(id: string | null, data: Omit<AppUser, "id" | "createdAt">) {
    if (id !== null) {
      // เปลี่ยนบทบาท = ยกระดับ/ลดสิทธิ์ผู้ใช้ — เหตุการณ์อ่อนไหว ต้องบันทึกแยกให้เห็นการเปลี่ยนแปลงชัดเจน
      // (ไม่ปนกับ "แก้ไขผู้ใช้" ทั่วไปที่อาจแค่แก้ชื่อ/แผนก) — Phase 9 (Logging/Audit)
      const cur = users.find(u => u.id === id);
      if (cur && cur.role !== data.role) {
        logAudit("เปลี่ยนบทบาทผู้ใช้", `${data.email}: ${ROLE_BY_KEY[cur.role]?.th ?? cur.role} → ${ROLE_BY_KEY[data.role]?.th ?? data.role}`);
      }
      update(id, data);
      logAudit("แก้ไขผู้ใช้", data.email);
      return;
    }
    // โหมดจริง (supabase): สร้างบัญชีเข้าระบบจริงผ่าน Route Handler ฝั่งเซิร์ฟเวอร์ (service_role)
    if (DATA_SOURCE === "supabase") { void createRemote(data); return; }
    // โหมดเดโม (local): ไม่มีระบบยืนยันตัวตนจริง — เพิ่มไว้ในมุมมองพอให้ทดลอง UI
    if (!canCreate) {
      notify("เพิ่มผู้ใช้จากหน้านี้ไม่ได้ — บัญชีเข้าระบบถูกจัดการโดยระบบยืนยันตัวตน ต้องสร้างบัญชีที่นั่นก่อน แล้วชื่อจะขึ้นในหน้านี้เอง");
      return;
    }
    const nid = String(Date.now());
    setUsers(prev => [{ id: nid, ...data, createdAt: MOCK_TODAY }, ...prev]);
    logAudit("เพิ่มผู้ใช้ HQ", data.email);
  }
  // สร้างบัญชีเข้าระบบจริง — รหัสผ่านสุ่มที่เซิร์ฟเวอร์ กลับมาโชว์ครั้งเดียวใน modal
  async function createRemote(data: Omit<AppUser, "id" | "createdAt">) {
    const res = await createHQUser({
      name: data.name, email: data.email, phone: data.phone, role: data.role,
      department: data.department, status: data.status, avatar: data.avatar,
    });
    if (!res.ok) { notify("เพิ่มผู้ใช้ไม่สำเร็จ: " + res.error); return; }
    // audit บันทึกที่ route (server-side · การันตี) แล้ว — ไม่ลง client ซ้ำ
    setCreds({ name: data.name, email: res.email, password: res.password });
    reload();
  }
  // ลบผู้ใช้ HQ จริง — supabase: ลบ auth+profile ผ่าน route · local: เอาออกจากมุมมอง
  async function doDelete(u: AppUser): Promise<{ ok: boolean; error?: string }> {
    if (DATA_SOURCE === "supabase") {
      const r = await deleteHQUser(u.id);
      if (!r.ok) return { ok: false, error: r.error };
      reload(); return { ok: true }; // audit บันทึกที่ route (server-side · การันตี) แล้ว
    }
    setUsers(prev => prev.filter(x => x.id !== u.id));
    logAudit("ลบผู้ใช้ HQ", u.email);
    return { ok: true };
  }
  function toggleStatus(u: AppUser) { update(u.id, { status: u.status === "active" ? "inactive" : "active" }); logAudit(u.status === "active" ? "ปิดใช้งานผู้ใช้" : "เปิดใช้งานผู้ใช้", u.email); }
  // H4 — รีเซ็ตรหัสผ่าน = "ส่งลิงก์ตั้งรหัสใหม่ทางอีเมล" (ไม่ใช่ออกรหัสปลอมแล้วโชว์แบบเดิม)
  // เดิม genTempPassword() สร้างสตริงที่ล็อกอินไม่ได้จริง + ลง audit ว่ารีเซ็ตแล้วทั้งที่ไม่เคยส่งไปที่ระบบยืนยันตัวตน
  function resetPassword(u: AppUser) { setResetInfo({ user: u }); }
  // ── ตั้งรหัสผ่านใหม่ให้ทันที (บอสสั่ง 14 ส.ค. 69) ──
  // ต่างจาก "ส่งลิงก์ทางอีเมล" ตรงที่ไม่พึ่งอีเมลเลย — ใช้ได้แม้ยังไม่ได้ตั้ง SMTP
  // หรือผู้ใช้เข้าอีเมลไม่ได้ · เซิร์ฟเวอร์สุ่มรหัสให้แล้วคืนมาโชว์ครั้งเดียว
  const [pwBusy, setPwBusy] = useState<string | null>(null);
  async function setPasswordNow(u: AppUser) {
    if (!confirm(`ตั้งรหัสผ่านใหม่ให้ "${u.name}"?
รหัสเดิมจะใช้ไม่ได้ทันที และระบบจะแสดงรหัสใหม่ให้คัดลอกเพียงครั้งเดียว`)) return;
    setPwBusy(u.id);
    const res = await resetHQUserPassword(u.id);
    setPwBusy(null);
    if (!res.ok) { notify(`ตั้งรหัสผ่านไม่สำเร็จ: ${res.error}`); return; }
    setCreds({ name: u.name, email: res.email || u.email, password: res.password });
    // audit บันทึกที่เซิร์ฟเวอร์แล้ว (การันตีกว่า) — ไม่จดซ้ำที่นี่
  }

  // หัวคอลัมน์เรียงลำดับ — ใช้ตัวกลาง SortableTh เพื่อให้กดด้วยคีย์บอร์ดได้
  // และประกาศทิศทางการเรียงให้โปรแกรมอ่านหน้าจอรู้ (aria-sort)
  const th = (label: string, key?: SortKey) => (
    <SortableTh
      label={label}
      active={!!key && sort.key === key}
      dir={sort.dir}
      onSort={key ? () => setSort(s => ({ key, dir: s.key === key && s.dir === "asc" ? "desc" : "asc" })) : undefined}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>{label}{key && sort.key === key && <span style={{ fontSize: "0.7rem" }}>{sort.dir === "asc" ? "▲" : "▼"}</span>}</span>
    </SortableTh>
  );
  const selCls: React.CSSProperties = { padding: "8px 10px", borderRadius: 9, border: `1px solid ${BORDER}`, fontSize: "0.78rem", color: STEEL, background: "#fff", outline: "none", cursor: "pointer" };
  const STAT = [
    { label: "ผู้ใช้ทั้งหมด", value: stats.total, color: PRIMARY },
    { label: "ผู้ใช้งานอยู่", value: stats.active, color: "#059669" },
    { label: "ปิดใช้งาน", value: stats.inactive, color: "#9ca3af" },
  ];

  return (
    <div className="erp">
      {!embedded && <div className="page-head"><div><p>บริหารผู้ใช้ของสำนักงานใหญ่ (HQ) — ผู้ใช้ของตัวแทนจัดการที่เมนู “ตัวแทน”</p></div></div>}

      {/* Summary cards (4) */}
      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        {STAT.map(s => <div key={s.label} className="stat-card"><div className="stat-label">{s.label}</div><div className="stat-value" style={{ color: s.color }}><CountUp value={`${s.value}`} /></div></div>)}
      </div>

      {/* Table card */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-header" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Users size={18} color={PRIMARY} />
          <div style={{ flex: 1, minWidth: 120 }}><div className="card-title">ผู้ใช้งานสำนักงานใหญ่</div><div className="card-desc">เฉพาะผู้ใช้งานสำนักงานใหญ่</div></div>
          <button onClick={() => setAddOpen(true)} className="btn btn-primary btn-md" style={{ flexShrink: 0 }}><Plus size={15} /> เพิ่มผู้ใช้งาน HQ</button>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "0 16px 12px", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, border: `1px solid ${BORDER}`, borderRadius: 9, padding: "0 10px", height: 36, flex: "1 1 220px", minWidth: 180 }}>
            <Search size={14} color={MUTED} /><input value={q} onChange={e => { setQ(e.target.value); setPage(1); }} placeholder="ค้นหาชื่อ หรือ อีเมล…" style={{ border: "none", outline: "none", flex: 1, fontSize: "0.82rem", color: STEEL, background: "transparent" }} />
          </div>
          <select aria-label="กรองตามบทบาท" style={selCls} value={roleF} onChange={e => { setRoleF(e.target.value as RoleKey | "all"); setPage(1); }}><option value="all">ทุกบทบาท</option>{ROLES.map(r => <option key={r.key} value={r.key}>{r.th}</option>)}</select>
          <select aria-label="กรองตามแผนก" style={selCls} value={deptF} onChange={e => { setDeptF(e.target.value); setPage(1); }}><option value="all">ทุกแผนก</option>{DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}</select>
          <div style={{ display: "flex", gap: 2, background: "#f1f5f9", borderRadius: 9, padding: 3 }}>
            {([["all", "ทั้งหมด"], ["active", "ใช้งาน"], ["inactive", "ปิด"]] as const).map(([v, l]) => (
              <button key={v} onClick={() => { setStatusF(v); setPage(1); }} style={{ border: "none", cursor: "pointer", borderRadius: 7, padding: "6px 12px", fontSize: "0.76rem", fontWeight: 700, fontFamily: "inherit", background: statusF === v ? "#fff" : "transparent", color: statusF === v ? PRIMARY : MUTED, boxShadow: statusF === v ? "0 1px 3px rgba(16,40,80,.12)" : "none" }}>{l}</button>
            ))}
          </div>
        </div>

        <div className="card-body" style={{ padding: 0 }}>
          <div className="table-wrap" style={{ maxHeight: 460, overflow: "auto" }}>
            <table>
              {/* ตารางใน .table-wrap ใช้ table-layout: fixed — ความกว้างทุกคอลัมน์ต้องกำหนดที่นี่เท่านั้น
                  ไม่มี colgroup = ทุกคอลัมน์กว้างเท่ากันหมด ทั้งที่ "ผู้ใช้" (รูป+ชื่อ+อีเมล) ต้องการที่มาก
                  ส่วน "จัดการ" มีแค่ปุ่มไอคอนเดียว (พบจากผลตรวจสอบระบบ 5 ส.ค. 69)
                  เพิ่ม/ลบคอลัมน์ ต้องแก้ที่นี่คู่กันเสมอ */}
              <colgroup>
                <col style={{ width: "34%", minWidth: 220 }} />{/* ผู้ใช้ (รูป + ชื่อ + อีเมล) */}
                <col style={{ width: "16%", minWidth: 110 }} />{/* บทบาท */}
                <col style={{ width: "16%", minWidth: 100 }} />{/* แผนก */}
                <col style={{ width: "11%", minWidth: 84 }} />{/* สถานะ */}
                <col style={{ width: "15%", minWidth: 104 }} />{/* สร้างเมื่อ */}
                <col style={{ width: "8%", minWidth: 56 }} />{/* จัดการ (ปุ่มไอคอน) */}
              </colgroup>
              <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
                <tr>{th("ผู้ใช้", "name")}<th>บทบาท</th><th>แผนก</th><th>สถานะ</th>{th("สร้างบัญชี", "createdAt")}<th className="ovf-visible" style={{ textAlign: "right" }}>จัดการ</th></tr>
              </thead>
              <tbody>
                {pageRows.length === 0 && <tr><td colSpan={6} style={{ padding: 36, textAlign: "center", color: "#9ca3af", fontSize: "0.82rem" }}>ไม่พบผู้ใช้ตามเงื่อนไข</td></tr>}
                {pageRows.map(u => (
                  <ClickableRow key={u.id} className="clickable" onActivate={() => setDetailUser(u)} label={`เปิดรายละเอียดผู้ใช้ ${u.name}`}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Avatar name={u.name} role={u.role} avatar={u.avatar} />
                        <div style={{ minWidth: 0 }}><div style={{ fontWeight: 700, color: STEEL }}>{u.name}</div><div style={{ fontSize: "0.72rem", color: MUTED, overflow: "hidden", textOverflow: "ellipsis" }}>{u.email}</div></div>
                      </div>
                    </td>
                    <td><RoleBadge role={u.role} /></td>
                    <td style={{ fontSize: "0.8rem", color: STEEL, fontWeight: 600 }}>{u.department?.trim() || "—"}</td>
                    <td><StatusDot status={u.status} /></td>
                    {/* ⚠️ เดิมโชว์ค่าดิบจากฐานข้อมูล ("2026-08-04T08:20:57.7…") ซึ่งเป็นรูปแบบของเครื่อง ไม่ใช่ของคนอ่าน */}
                    <td style={{ color: MUTED, fontSize: "0.72rem", whiteSpace: "nowrap" }}>{fmtISOToThai(String(u.createdAt).slice(0, 10)) || "—"}</td>
                    <td className="ovf-visible" onClick={e => e.stopPropagation()}>
                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <button className="btn btn-icon btn-sm" title="จัดการ" onClick={e => { const r = e.currentTarget.getBoundingClientRect(); setMenu({ user: u, x: r.right, y: r.bottom + 4 }); }}><MoreHorizontal size={16} /></button>
                      </div>
                    </td>
                  </ClickableRow>
                ))}
              </tbody>
            </table>
          </div>
          {/* แถบเปลี่ยนหน้ากลางของระบบ — หน้านี้นับหน้าเริ่มที่ 1 จึงต้องแปลงเป็นฐาน 0 ให้คอมโพเนนต์ */}
          <TablePagination
            page={curPage - 1} total={filtered.length} onPage={p => setPage(p + 1)}
            size={PAGE_SIZE} unit="คน"
          />
        </div>
      </div>

      {/* Permission matrix */}
      <div className="card">
        <div className="card-header"><div><div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}><Shield size={17} color={PRIMARY} /> สิทธิ์ตามบทบาท (Permission Matrix)</div><div className="card-desc">เลือกบทบาทเพื่อดูสิทธิ์แต่ละโมดูล</div></div></div>
        <div className="card-body">
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {ROLES.map(r => <button key={r.key} onClick={() => setMatrixRole(r.key)} className="badge" style={{ border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, background: matrixRole === r.key ? r.tone : r.tone + "14", color: matrixRole === r.key ? "#fff" : r.tone }}>{r.th}</button>)}
          </div>
          <div style={{ fontSize: "0.76rem", color: MUTED, marginBottom: 12 }}>{roleSummary[matrixRole]}</div>
          <div className="table-wrap" style={{ border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
            <table>
              {/* fixed layout — ชื่อโมดูลยาวกว่าคอลัมน์ติ๊กถูกมาก ต้องกำหนดสัดส่วนเอง (ดูหมายเหตุตารางด้านบน) */}
              <colgroup>
                <col style={{ width: "40%", minWidth: 150 }} />{/* โมดูล */}
                <col style={{ width: "12%", minWidth: 52 }} />{/* ดู */}
                <col style={{ width: "12%", minWidth: 52 }} />{/* สร้าง */}
                <col style={{ width: "12%", minWidth: 52 }} />{/* แก้ไข */}
                <col style={{ width: "12%", minWidth: 52 }} />{/* ลบ */}
                <col style={{ width: "12%", minWidth: 60 }} />{/* ส่งออก */}
              </colgroup>
              <thead><tr><th>โมดูล</th><th className="num">ดู</th><th className="num">สร้าง</th><th className="num">แก้ไข</th><th className="num">ลบ</th><th className="num">ส่งออก</th></tr></thead>
              <tbody>
                {MODULE_LIST.map(m => {
                  const c = capOf(matrixRole, m);
                  const cell = (on: boolean) => <td className="num">{on ? <Check size={15} color="#059669" style={{ display: "inline" }} /> : <X size={14} color="#d1d5db" style={{ display: "inline" }} />}</td>;
                  return <tr key={m}><td style={{ fontWeight: 600 }}>{m}</td>{cell(c.v)}{cell(c.c)}{cell(c.e)}{cell(c.d)}{cell(c.x)}</tr>;
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Action dropdown — ปิดใช้งาน (พักบัญชี) แยกจาก "ลบ" (ลบถาวรพร้อมยืนยัน) */}
      {menu && (
        <ActionMenu pos={{ x: menu.x, y: menu.y }} onClose={() => setMenu(null)} items={[
          { label: "ดูรายละเอียด", icon: <Eye size={14} />, onClick: () => setDetailUser(menu.user) },
          { label: "แก้ไข", icon: <Pencil size={14} />, onClick: () => setDialogUser(menu.user) },
          { label: "รีเซ็ตรหัสผ่าน (ส่งลิงก์ทางอีเมล)", icon: <KeyRound size={14} />, onClick: () => resetPassword(menu.user) },
          // ตั้งรหัสให้ตรง ๆ = สวมสิทธิ์เข้าระบบแทนเขาได้ จึงเปิดเฉพาะผู้ดูแลสูงสุด
          // (เซิร์ฟเวอร์ตรวจซ้ำอีกชั้น — ซ่อนเมนูอย่างเดียวไม่ใช่การป้องกัน)
          ...(canEditPrivileges ? [{
            label: pwBusy === menu.user.id ? "กำลังตั้งรหัส…" : "ตั้งรหัสผ่านใหม่ทันที",
            icon: <KeyRound size={14} />, onClick: () => void setPasswordNow(menu.user),
          }] : []),
          { label: menu.user.status === "active" ? "ปิดใช้งาน" : "เปิดใช้งาน", icon: <Power size={14} />, onClick: () => toggleStatus(menu.user) },
          { label: "ลบผู้ใช้", icon: <Trash2 size={14} />, danger: true, onClick: () => setDeleteTarget(menu.user) },
        ]} />
      )}

      {detailUser && <UserDetailDrawer user={detailUser} onClose={() => setDetailUser(null)} onEdit={() => { setDialogUser(detailUser); setDetailUser(null); }} />}
      {addOpen && <UserDialog onSave={data => saveUser(null, data)} onClose={() => setAddOpen(false)} />}
      {dialogUser && <UserDialog initial={dialogUser} canEditPrivileges={canEditPrivileges} onSave={data => saveUser(dialogUser.id, data)} onClose={() => setDialogUser(null)} />}

      {/* Reset password = ส่งลิงก์ตั้งรหัสใหม่ทางอีเมล (H4) */}
      {resetInfo && (
        <ResetEmailDialog user={resetInfo.user}
          onSent={email => logAudit("ส่งลิงก์รีเซ็ตรหัสผ่าน", email)}
          onClose={() => setResetInfo(null)} />
      )}

      {/* บัญชีใหม่: โชว์อีเมล+รหัสผ่านครั้งเดียว ให้ HQ ก๊อปไปแจ้งผู้ใช้ */}
      {creds && <NewCredsDialog name={creds.name} email={creds.email} password={creds.password} onClose={() => setCreds(null)} />}

      {/* ลบผู้ใช้ HQ — ต้องพิมพ์อีเมลยืนยัน (กันลบพลาด) */}
      {deleteTarget && (
        <DeleteUserDialog user={deleteTarget} onConfirm={() => doDelete(deleteTarget)} onClose={() => setDeleteTarget(null)} />
      )}

      {/* Toast — เหมือน pattern มาตรฐานของหน้าตั้งค่า (fixed bottom-right) */}
      {toastMsg && (
        <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999, background: "#111827", color: "#fff", padding: "12px 18px", borderRadius: 12, fontSize: "0.82rem", fontWeight: 600, boxShadow: "0 12px 32px rgba(0,0,0,.28)", display: "flex", alignItems: "center", gap: 9, maxWidth: 360 }}>
          <Check size={15} color="#7ee2b8" style={{ flexShrink: 0 }} /> {toastMsg}
        </div>
      )}
    </div>
  );
}

// ── บัญชีใหม่: โชว์รหัสเข้าระบบครั้งเดียว (แจ้งครั้งเดียว — ไม่เก็บไว้ที่ไหน) ──────────
function NewCredsDialog({ name, email, password, onClose }: { name: string; email: string; password: string; onClose: () => void }) {
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState("");
  const copy = (label: string, value: string) => navigator.clipboard.writeText(value).then(() => { setCopied(label); setTimeout(() => setCopied(""), 1600); });
  const row = (label: string, value: string, secret = false) => (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: "0.72rem", color: MUTED, marginBottom: 4, fontWeight: 600 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#f0f4f8", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 11px" }}>
        <span style={{ flex: 1, fontFamily: "monospace", fontSize: "0.84rem", fontWeight: 700, color: STEEL, letterSpacing: "0.03em", overflow: "hidden", textOverflow: "ellipsis" }}>{secret && !shown ? "••••••••••••" : value}</span>
        {secret && <button type="button" onClick={() => setShown(v => !v)} title={shown ? "ซ่อน" : "แสดง"} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, padding: 0, display: "flex" }}>{shown ? <EyeOff size={14} /> : <Eye size={14} />}</button>}
        <button type="button" onClick={() => copy(label, value)} title={`คัดลอก${label}`} style={{ background: "none", border: "none", cursor: "pointer", color: copied === label ? "#059669" : MUTED, padding: 0, display: "flex" }}>{copied === label ? <Check size={14} /> : <Copy size={14} />}</button>
      </div>
    </div>
  );
  const dialogRef = useModalA11y<HTMLDivElement>(onClose);   // Esc ปิด · Tab วนในกล่อง · คืนโฟกัสเดิม
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 420, background: "rgba(45,45,45,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="รหัสเข้าระบบของผู้ใช้ใหม่" onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,.22)" }}>
        <div style={{ background: PRIMARY, color: "#fff", padding: "15px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, fontWeight: 800 }}><UserPlus size={16} /> สร้างบัญชีแล้ว</div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(255,255,255,.15)", color: "#fff", border: "none", cursor: "pointer" }}><X size={14} /></button>
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ fontSize: "0.82rem", color: MUTED, marginBottom: 14, lineHeight: 1.6 }}>
            บัญชีเข้าระบบของ <strong style={{ color: STEEL }}>{name}</strong> พร้อมใช้แล้ว · <strong style={{ color: "#b45309" }}>รหัสนี้แสดงครั้งเดียว</strong> — ก๊อปไปแจ้งผู้ใช้ แล้วให้เปลี่ยนเองหลังเข้าครั้งแรก
          </div>
          {row("อีเมลเข้าสู่ระบบ", email)}
          {row("รหัสผ่านชั่วคราว", password, true)}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
            <button onClick={onClose} className="btn btn-primary btn-md">เสร็จสิ้น</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ลบผู้ใช้ HQ (ถาวร) — พิมพ์อีเมลยืนยันก่อน · เซิร์ฟเวอร์กันลบตัวเอง/SUPER_ADMIN คนสุดท้ายอีกชั้น ──
function DeleteUserDialog({ user, onConfirm, onClose }: { user: AppUser; onConfirm: () => Promise<{ ok: boolean; error?: string }>; onClose: () => void }) {
  const [typed, setTyped] = useState("");
  const [state, setState] = useState<"idle" | "deleting">("idle");
  const [err, setErr] = useState("");
  const match = typed.trim().toLowerCase() === (user.email || "").trim().toLowerCase() && !!user.email;
  async function go() {
    if (!match) return;
    setErr(""); setState("deleting");
    const r = await onConfirm();
    if (!r.ok) { setState("idle"); setErr(r.error || "ลบไม่สำเร็จ"); return; }
    onClose();
  }
  const dialogRef = useModalA11y<HTMLDivElement>(onClose);   // Esc ปิด · Tab วนในกล่อง · คืนโฟกัสเดิม
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 420, background: "rgba(45,45,45,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="ยืนยันการลบผู้ใช้" onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,.22)" }}>
        <div style={{ background: "#dc2626", color: "#fff", padding: "15px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, fontWeight: 800 }}><AlertTriangle size={16} /> ลบผู้ใช้ถาวร</div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(255,255,255,.15)", color: "#fff", border: "none", cursor: "pointer" }}><X size={14} /></button>
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ fontSize: "0.82rem", color: STEEL, marginBottom: 6, lineHeight: 1.6 }}>
            กำลังจะลบ <strong>{user.name}</strong> ({user.email || "ไม่มีอีเมล"}) — <strong style={{ color: "#dc2626" }}>บัญชีเข้าระบบจะถูกลบถาวร ล็อกอินไม่ได้อีก</strong> และย้อนกลับไม่ได้
          </div>
          {!user.email && <div style={{ fontSize: "0.76rem", color: "#b45309", marginBottom: 10 }}>ผู้ใช้นี้ไม่มีอีเมลติดต่อในระบบ — ยืนยันด้วยการพิมพ์ไม่ได้ กรุณาปิดใช้งานแทน หรือเพิ่มอีเมลก่อน</div>}
          <label style={{ fontSize: "0.72rem", color: MUTED, fontWeight: 600, display: "block", marginBottom: 5 }}>พิมพ์อีเมลของผู้ใช้เพื่อยืนยัน</label>
          <input value={typed} onChange={e => { setTyped(e.target.value); setErr(""); }} placeholder={user.email || "—"} disabled={!user.email}
            style={{ width: "100%", border: `1px solid ${BORDER}`, borderRadius: 9, padding: "9px 12px", fontSize: "0.86rem", color: STEEL, outline: "none", boxSizing: "border-box", fontFamily: "inherit", background: user.email ? "#fff" : "#f3f4f6" }} />
          {err && <div style={{ fontSize: "0.74rem", color: "#dc2626", fontWeight: 600, marginTop: 8 }}>{err}</div>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
            <button onClick={onClose} className="btn btn-secondary btn-md">ยกเลิก</button>
            <button onClick={() => void go()} disabled={!match || state === "deleting"} className="btn btn-md"
              style={{ background: "#dc2626", color: "#fff", border: "none", ...(!match || state === "deleting" ? { opacity: .5, cursor: "not-allowed" } : { cursor: "pointer" }) }}>
              <Trash2 size={14} /> {state === "deleting" ? "กำลังลบ…" : "ลบถาวร"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── H4 · ส่งลิงก์ตั้งรหัสผ่านใหม่ทางอีเมล ─────────────────────────────────────────
// อ่าน "อีเมลล็อกอิน" จาก auth.users ที่ฝั่ง client ไม่ได้ (ต้อง service_role) → ให้ผู้ดูแลยืนยันอีเมล
// (เติมอีเมลติดต่อไว้เป็นค่าเริ่มต้น) แล้วส่งลิงก์ · Supabase ตอบสำเร็จแม้ไม่พบอีเมล (กัน enumeration)
function ResetEmailDialog({ user, onSent, onClose }: { user: AppUser; onSent: (email: string) => void; onClose: () => void }) {
  const [email, setEmail] = useState(user.email || "");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [err, setErr] = useState("");
  async function send() {
    setErr("");
    if (DATA_SOURCE !== "supabase") { setErr("โหมดเดโม: ส่งลิงก์รีเซ็ตจริงไม่ได้ (ต้องมีระบบยืนยันตัวตน)"); return; }
    setState("sending");
    const r = await sbSendPasswordReset(email);
    if (!r.ok) { setState("idle"); setErr(r.error); return; }
    setState("sent"); onSent(email.trim().toLowerCase());
  }
  const dialogRef = useModalA11y<HTMLDivElement>(onClose);   // Esc ปิด · Tab วนในกล่อง · คืนโฟกัสเดิม
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(45,45,45,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="ส่งลิงก์ตั้งรหัสผ่านใหม่" onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 400, background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,.22)" }}>
        <div style={{ background: PRIMARY, color: "#fff", padding: "15px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, fontWeight: 800 }}><KeyRound size={16} /> รีเซ็ตรหัสผ่าน</div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(255,255,255,.15)", color: "#fff", border: "none", cursor: "pointer" }}><X size={14} /></button>
        </div>
        <div style={{ padding: 20 }}>
          {state === "sent" ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#e7f6ee", display: "flex", alignItems: "center", justifyContent: "center", margin: "4px auto 12px" }}><Check size={22} color="#059669" /></div>
              <div style={{ fontSize: "0.86rem", fontWeight: 700, color: STEEL, marginBottom: 6 }}>ส่งลิงก์แล้ว</div>
              <div style={{ fontSize: "0.78rem", color: MUTED, lineHeight: 1.6 }}>
                ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่ <strong style={{ color: STEEL }}>{email}</strong> แล้ว · ผู้ใช้กดลิงก์ในอีเมลเพื่อตั้งรหัสเอง
              </div>
              <button onClick={onClose} className="btn btn-secondary btn-md" style={{ marginTop: 16 }}>ปิด</button>
            </div>
          ) : (
            <>
              <div style={{ fontSize: "0.82rem", color: MUTED, marginBottom: 12 }}>
                ส่งลิงก์ตั้งรหัสผ่านใหม่ให้ <strong style={{ color: STEEL }}>{user.name}</strong> — ยืนยันอีเมลที่ใช้เข้าสู่ระบบ
              </div>
              <label style={{ fontSize: "0.72rem", color: MUTED, fontWeight: 600, display: "block", marginBottom: 5 }}>อีเมลเข้าสู่ระบบ</label>
              <input value={email} onChange={e => { setEmail(e.target.value); setErr(""); }} placeholder="name@benjamin.co.th"
                style={{ width: "100%", border: `1px solid ${BORDER}`, borderRadius: 9, padding: "9px 12px", fontSize: "0.86rem", color: STEEL, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
              {/* ค่าเริ่มต้นมาจาก "อีเมลติดต่อ" (profiles.contact_email) ซึ่งอาจไม่ตรงกับอีเมลล็อกอินจริง
                  (client อ่าน auth.users ไม่ได้) + Supabase ตอบสำเร็จเสมอแม้พิมพ์ผิด (กัน enumeration)
                  → ต้องเตือนให้ตรวจสอบเองเสมอ ไม่งั้น HQ อาจพิมพ์ผิดแล้วไม่รู้ตัวว่าไม่มีใครได้ลิงก์
                  (พบจาก /scenario 31 ก.ค. 69) */}
              <div style={{ fontSize: "0.7rem", color: "#b45309", marginTop: 6, lineHeight: 1.5, display: "flex", gap: 5 }}>
                <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>ตรวจสอบให้แน่ใจว่าเป็นอีเมลที่ผู้ใช้ใช้ล็อกอินจริง — ระบบจะแจ้งว่า &quot;ส่งลิงก์แล้ว&quot; เสมอแม้พิมพ์อีเมลผิด (ป้องกันข้อมูลรั่วไหล)</span>
              </div>
              {err && <div style={{ fontSize: "0.74rem", color: "#dc2626", fontWeight: 600, marginTop: 8 }}>{err}</div>}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
                <button onClick={onClose} className="btn btn-secondary btn-md">ยกเลิก</button>
                <button onClick={() => void send()} disabled={state === "sending" || !email} className="btn btn-primary btn-md"
                  style={state === "sending" || !email ? { opacity: .6, cursor: "not-allowed" } : undefined}>
                  {state === "sending" ? "กำลังส่ง…" : "ส่งลิงก์รีเซ็ต"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Detail Drawer (ข้อมูลทั่วไป + Timeline) ──────────────────────────────────────
// Timeline = บันทึกการใช้งานจริงของผู้ใช้คนนี้ (audit log) — เดิมเป็นวันที่ปลอมที่ hardcode ไว้
// ระบบไม่ได้บันทึกการเข้าสู่ระบบ จึงไม่มีรายการ "เข้าสู่ระบบล่าสุด"
function UserDetailDrawer({ user, onClose, onEdit }: { user: AppUser; onClose: () => void; onEdit: () => void }) {
  const auditEntries = useAuditEntries();
  const iconOf = (action: string) =>
    action.includes("รหัสผ่าน") ? { icon: <KeyRound size={13} />, color: "#d97706" }
    : action.includes("สิทธิ์") || action.includes("ตั้งค่า") ? { icon: <Shield size={13} />, color: PRIMARY }
    : action.includes("ปิดใช้งาน") || action.includes("เปิดใช้งาน") ? { icon: <Power size={13} />, color: "#7c3aed" }
    : { icon: <Clock size={13} />, color: MUTED };
  const timeline = [
    // การกระทำที่ผู้ใช้คนนี้ทำ + การกระทำที่กระทำ "ต่อ" ผู้ใช้คนนี้ (target = อีเมล)
    ...auditEntries
      .filter(e => e.user === user.name || e.target === user.email)
      .slice(0, 8)
      .map(e => ({ ...iconOf(e.action), label: e.target && e.target !== user.email ? `${e.action} · ${e.target}` : e.action, at: e.at })),
    { icon: <UserPlus size={13} />, color: MUTED, label: "สร้างบัญชี", at: user.createdAt },
  ];

  const info = (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <Avatar name={user.name} role={user.role} size={52} avatar={user.avatar} />
        <div><div style={{ fontSize: "1rem", fontWeight: 800, color: STEEL }}>{user.name}</div><div style={{ marginTop: 3 }}><RoleBadge role={user.role} /></div></div>
      </div>
      <Field label="อีเมล" value={user.email} />
      <Field label="เบอร์โทร" value={<span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Phone size={12} color={MUTED} />{user.phone || "—"}</span>} />
      <Field label="แผนก" value={user.department} />
      <Field label="สถานะ" value={<StatusDot status={user.status} />} />
      <Field label="วันที่สร้างบัญชี" value={user.createdAt} />
    </div>
  );
  const perms = (
    <div style={{ padding: 20 }}>
      <div style={{ fontSize: "0.78rem", color: MUTED, marginBottom: 4 }}>บทบาท <strong style={{ color: STEEL }}>{ROLE_BY_KEY[user.role].th}</strong></div>
      <div style={{ fontSize: "0.74rem", color: MUTED, marginBottom: 14 }}>{roleSummary[user.role]}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {MODULE_LIST.filter(m => capOf(user.role, m).v).map(m => {
          const c = capOf(user.role, m);
          const tags = [c.v && "ดู", c.c && "สร้าง", c.e && "แก้ไข", c.d && "ลบ", c.x && "ส่งออก"].filter(Boolean) as string[];
          return <div key={m} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 12px", background: "#f8fafc", border: `1px solid ${BORDER}`, borderRadius: 10 }}><span style={{ fontSize: "0.82rem", fontWeight: 700, color: STEEL }}>{m}</span><span style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>{tags.map(t => <span key={t} className="badge" style={{ background: "#dce5f0", color: PRIMARY, fontSize: "0.62rem" }}>{t}</span>)}</span></div>;
        })}
        {MODULE_LIST.filter(m => capOf(user.role, m).v).length === 0 && <div style={{ fontSize: "0.8rem", color: MUTED, textAlign: "center", padding: 16 }}>ไม่มีสิทธิ์เข้าถึงโมดูลใด</div>}
      </div>
    </div>
  );
  const activity = (
    <div style={{ padding: 20 }}>
      <div style={{ fontSize: "0.72rem", color: MUTED, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 12 }}>Timeline กิจกรรม</div>
      <div style={{ position: "relative" }}>
        {timeline.map((t, i) => (
          <div key={i} style={{ display: "flex", gap: 12, paddingBottom: i < timeline.length - 1 ? 16 : 0 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span style={{ width: 28, height: 28, borderRadius: "50%", background: t.color + "1a", color: t.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{t.icon}</span>
              {i < timeline.length - 1 && <span style={{ width: 2, flex: 1, background: "#eef2f7", marginTop: 2 }} />}
            </div>
            <div style={{ paddingTop: 3 }}><div style={{ fontSize: "0.82rem", fontWeight: 700, color: STEEL }}>{t.label}</div><div style={{ fontSize: "0.7rem", color: MUTED, marginTop: 1 }}>{t.at}</div></div>
          </div>
        ))}
      </div>
    </div>
  );
  return (
    <RightDrawer open onClose={onClose} title={user.name} subtitle={`${ROLE_BY_KEY[user.role].th} · ${user.department}`}
      headerRight={<button className="btn btn-secondary btn-sm" onClick={onEdit}><Pencil size={13} /> แก้ไข</button>}
      tabs={[{ key: "info", label: "ข้อมูล", content: info }, { key: "perms", label: "สิทธิ์", content: perms }, { key: "activity", label: "กิจกรรม", content: activity }]} width={440} />
  );
}
