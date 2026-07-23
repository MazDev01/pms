"use client";

// ─── HQ · ผู้ใช้งานและสิทธิ์ (HQ Users เท่านั้น) ─────────────────────────────────
// บริหารผู้ใช้ของ "สำนักงานใหญ่" เท่านั้น — ไม่แสดงผู้ใช้ Dealer (ดีลเลอร์จัดการใน Workspace ตัวเอง
// ผ่านเมนู "ตัวแทน" → เจาะรายตัว). Stat · Filter · Data table · Action dropdown · Detail Drawer+Timeline · Permission Matrix
import { useState, useMemo, useRef, useEffect } from "react";
import { usePersistentState } from "@pms/shared/lib/usePersistentState";
import { useAuditLogger, useAuditEntries } from "@pms/shared/lib/useAudit";
import { RightDrawer } from "@pms/shared/components/ui/RightDrawer";
import { CountUp } from "@pms/shared/components/ui/CountUp";
import { fileToResizedDataURL } from "@pms/shared/lib/imageResize";
import { hasPermission, type Permission } from "@pms/shared/lib/permissions";
import { users as usersRepo } from "@pms/shared/lib/data";
import type { UserRole } from "@pms/shared/lib/mock";
import {
  Users, Shield, Check, X, Plus, Search, KeyRound, Copy, RefreshCw, MoreHorizontal,
  Eye, Pencil, Power, Clock, LogIn, UserPlus, Phone, ImagePlus,
} from "lucide-react";

const PRIMARY = "#003366";
const STEEL = "#2D2D2D";
const BORDER = "#e5e7eb";
const MUTED = "#6b7280";
const MOCK_TODAY = "30 มิ.ย. 2569";

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
function CopyField({ label, value }: { label: string; value: string }) {
  const [c, setC] = useState(false);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: "0.72rem", color: MUTED, marginBottom: 4, fontWeight: 600 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#f0f4f8", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 11px" }}>
        <span style={{ flex: 1, fontFamily: "monospace", fontSize: "0.84rem", fontWeight: 700, color: STEEL, overflow: "hidden", textOverflow: "ellipsis" }}>{value}</span>
        <button type="button" onClick={() => navigator.clipboard.writeText(value).then(() => { setC(true); setTimeout(() => setC(false), 1500); })} style={{ background: "none", border: "none", cursor: "pointer", color: c ? "#059669" : MUTED, padding: 0, display: "flex", flexShrink: 0 }}>{c ? <Check size={14} /> : <Copy size={14} />}</button>
      </div>
    </div>
  );
}
function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return <div style={{ marginBottom: 12 }}><div style={{ fontSize: "0.68rem", color: MUTED, fontWeight: 600, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div><div style={{ fontSize: "0.86rem", color: STEEL, fontWeight: 600 }}>{value}</div></div>;
}

// ── Add/Edit Dialog (modal กลาง) ─────────────────────────────────────────────────
type UserForm = { firstName: string; lastName: string; email: string; phone: string; role: RoleKey; department: string; tempPassword: string; status: UserStatus; avatar?: string };
function UserDialog({ initial, onSave, onClose }: { initial?: AppUser; onSave: (u: Omit<AppUser, "id" | "createdAt">) => void; onClose: () => void }) {
  const [f, setF] = useState<UserForm>(() => {
    if (initial) { const [fn, ...ln] = initial.name.split(" "); return { firstName: fn, lastName: ln.join(" "), email: initial.email, phone: initial.phone, role: initial.role, department: initial.department, tempPassword: "", status: initial.status, avatar: initial.avatar }; }
    return { firstName: "", lastName: "", email: "", phone: "", role: "HQ_STAFF", department: "ฝ่ายขาย", tempPassword: genTempPassword("newuser@benjamin.co.th"), status: "active" };
  });
  const fileRef = useRef<HTMLInputElement>(null);
  async function pickAvatar(e: React.ChangeEvent<HTMLInputElement>) { const file = e.target.files?.[0]; e.target.value = ""; if (!file) return; setF(p => ({ ...p, avatar: undefined })); const url = await fileToResizedDataURL(file, 160); setF(p => ({ ...p, avatar: url })); }
  const valid = f.firstName.trim() && /\S+@\S+\.\S+/.test(f.email);
  const inp: React.CSSProperties = { width: "100%", padding: "9px 12px", borderRadius: 9, border: `1px solid ${BORDER}`, fontSize: "0.84rem", color: STEEL, background: "#fff", outline: "none", boxSizing: "border-box" };
  const submit = () => { if (!valid) return; onSave({ name: `${f.firstName.trim()} ${f.lastName.trim()}`.trim(), email: f.email.trim(), phone: f.phone.trim(), role: f.role, department: f.department, status: f.status, avatar: f.avatar }); onClose(); };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(45,45,45,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 520, background: "#fff", borderRadius: 18, overflow: "hidden", boxShadow: "0 24px 80px rgba(0,0,0,.28)" }}>
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
                : <span style={{ width: 84, height: 84, borderRadius: "50%", background: ROLE_BY_KEY[f.role].tone, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "2rem" }}>{f.firstName.charAt(0) || "?"}</span>}
              <span style={{ position: "absolute", right: 0, bottom: 2, width: 26, height: 26, borderRadius: "50%", background: PRIMARY, border: "2px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}><ImagePlus size={13} /></span>
              {f.avatar && <button type="button" onClick={e => { e.preventDefault(); setF(p => ({ ...p, avatar: undefined })); }} style={{ position: "absolute", left: 0, bottom: 2, width: 24, height: 24, borderRadius: "50%", background: "#fff", border: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", color: "#dc2626", cursor: "pointer" }}><X size={12} /></button>}
            </label>
          </div>
          <div><label className="form-label">ชื่อ *</label><input style={inp} value={f.firstName} autoFocus onChange={e => setF({ ...f, firstName: e.target.value })} placeholder="ชื่อ" /></div>
          <div><label className="form-label">นามสกุล</label><input style={inp} value={f.lastName} onChange={e => setF({ ...f, lastName: e.target.value })} placeholder="นามสกุล" /></div>
          <div style={{ gridColumn: "1/-1" }}><label className="form-label">อีเมล (ใช้เข้าระบบ) *</label><input style={inp} value={f.email} onChange={e => setF({ ...f, email: e.target.value })} placeholder="name@benjamin.co.th" /></div>
          <div><label className="form-label">เบอร์โทร</label><input style={inp} value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} placeholder="08x-xxx-xxxx" /></div>
          <div><label className="form-label">แผนก</label><select style={inp} value={f.department} onChange={e => setF({ ...f, department: e.target.value })}>{DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
          <div><label className="form-label">บทบาท (Role)</label><select style={inp} value={f.role} onChange={e => setF({ ...f, role: e.target.value as RoleKey, department: defaultDept(e.target.value as RoleKey) })}>{ROLES.map(r => <option key={r.key} value={r.key}>{r.th}</option>)}</select></div>
          <div><label className="form-label">สถานะ</label><select style={inp} value={f.status} onChange={e => setF({ ...f, status: e.target.value as UserStatus })}><option value="active">ใช้งาน</option><option value="inactive">ปิดใช้งาน</option></select></div>
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
function ActionMenu({ pos, onClose, items }: { pos: { x: number; y: number }; onClose: () => void; items: { label: string; icon: React.ReactNode; onClick: () => void }[] }) {
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 300 }} />
      <div style={{ position: "fixed", top: pos.y, left: pos.x, zIndex: 301, background: "#fff", borderRadius: 12, border: `1px solid ${BORDER}`, boxShadow: "0 16px 40px rgba(0,0,0,.16)", padding: 6, minWidth: 190, transform: "translateX(-100%)" }}>
        {items.map((it, i) => (
          <button key={i} onClick={() => { it.onClick(); onClose(); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 12px", border: "none", background: "none", cursor: "pointer", borderRadius: 8, fontSize: "0.82rem", fontWeight: 600, color: STEEL, textAlign: "left", fontFamily: "inherit" }} onMouseEnter={e => (e.currentTarget.style.background = "#f5f7fa")} onMouseLeave={e => (e.currentTarget.style.background = "none")}>{it.icon} {it.label}</button>
        ))}
      </div>
    </>
  );
}

// ═══════════════════════ PAGE ═══════════════════════════════════════════════════
type SortKey = "name" | "createdAt";
const PAGE_SIZE = 8;

export function UsersPanel({ embedded }: { embedded?: boolean } = {}) {
  // ผู้ใช้จริงในระบบ (ตาราง profiles) — เฉพาะฝั่งสำนักงานใหญ่ (dealerCode ว่าง)
  const [users, setUsers] = useState<AppUser[]>([]);
  const canCreate = usersRepo.canCreate();
  useEffect(() => {
    let alive = true;
    usersRepo.list()
      .then(rows => {
        if (!alive) return;
        setUsers(rows.filter(u => !u.dealerCode).map(u => ({
          id: u.id, name: u.name, email: u.email, phone: u.phone,
          role: (ROLE_BY_KEY[u.role as RoleKey] ? u.role : "HQ_STAFF") as RoleKey,
          department: u.department, status: u.status, createdAt: u.createdAt, avatar: u.avatar,
        })));
      })
      .catch(e => console.error("[users.list]", e));
    return () => { alive = false; };
  }, []);
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
  const [resetInfo, setResetInfo] = useState<{ user: AppUser; pw: string } | null>(null);
  const [menu, setMenu] = useState<{ user: AppUser; x: number; y: number } | null>(null);
  const [matrixRole, setMatrixRole] = useState<RoleKey>("SUPER_ADMIN");

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
    void usersRepo.update({ id, name: next.name, role: next.role, department: next.department, status: next.status })
      .catch(e => alert("บันทึกผู้ใช้ไม่สำเร็จ: " + (e instanceof Error ? e.message : String(e))));
  };
  function saveUser(id: string | null, data: Omit<AppUser, "id" | "createdAt">) {
    if (id !== null) { update(id, data); logAudit("แก้ไขผู้ใช้", data.email); return; }
    // สร้างบัญชีใหม่ต้องผ่านระบบยืนยันตัวตน (ต้องใช้ service_role ซึ่งอยู่ฝั่งเบราว์เซอร์ไม่ได้)
    if (!canCreate) {
      alert("เพิ่มผู้ใช้จากหน้านี้ไม่ได้\n\nบัญชีเข้าระบบถูกจัดการโดยระบบยืนยันตัวตน — ต้องสร้างบัญชีที่นั่นก่อน แล้วชื่อจะขึ้นในหน้านี้เอง");
      return;
    }
    const nid = String(Date.now());
    setUsers(prev => [{ id: nid, ...data, createdAt: MOCK_TODAY }, ...prev]);
    logAudit("เพิ่มผู้ใช้ HQ", data.email);
  }
  function toggleStatus(u: AppUser) { update(u.id, { status: u.status === "active" ? "inactive" : "active" }); logAudit(u.status === "active" ? "ปิดใช้งานผู้ใช้" : "เปิดใช้งานผู้ใช้", u.email); }
  function resetPassword(u: AppUser) { const pw = genTempPassword(u.email + Date.now()); setResetInfo({ user: u, pw }); logAudit("รีเซ็ตรหัสผ่านผู้ใช้", u.email); }

  const th = (label: string, key?: SortKey) => (
    <th style={key ? { cursor: "pointer", userSelect: "none" } : undefined} onClick={key ? () => setSort(s => ({ key, dir: s.key === key && s.dir === "asc" ? "desc" : "asc" })) : undefined}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>{label}{key && sort.key === key && <span style={{ fontSize: "0.7rem" }}>{sort.dir === "asc" ? "▲" : "▼"}</span>}</span>
    </th>
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
          <select style={selCls} value={roleF} onChange={e => { setRoleF(e.target.value as RoleKey | "all"); setPage(1); }}><option value="all">ทุกบทบาท</option>{ROLES.map(r => <option key={r.key} value={r.key}>{r.th}</option>)}</select>
          <select style={selCls} value={deptF} onChange={e => { setDeptF(e.target.value); setPage(1); }}><option value="all">ทุกแผนก</option>{DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}</select>
          <div style={{ display: "flex", gap: 2, background: "#f1f5f9", borderRadius: 9, padding: 3 }}>
            {([["all", "ทั้งหมด"], ["active", "ใช้งาน"], ["inactive", "ปิด"]] as const).map(([v, l]) => (
              <button key={v} onClick={() => { setStatusF(v); setPage(1); }} style={{ border: "none", cursor: "pointer", borderRadius: 7, padding: "6px 12px", fontSize: "0.76rem", fontWeight: 700, fontFamily: "inherit", background: statusF === v ? "#fff" : "transparent", color: statusF === v ? PRIMARY : MUTED, boxShadow: statusF === v ? "0 1px 3px rgba(16,40,80,.12)" : "none" }}>{l}</button>
            ))}
          </div>
        </div>

        <div className="card-body" style={{ padding: 0 }}>
          <div className="table-wrap" style={{ maxHeight: 460, overflow: "auto" }}>
            <table>
              <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
                <tr>{th("ผู้ใช้", "name")}<th>บทบาท</th><th>แผนก</th><th>สถานะ</th>{th("สร้างบัญชี", "createdAt")}<th className="ovf-visible" style={{ textAlign: "right" }}>จัดการ</th></tr>
              </thead>
              <tbody>
                {pageRows.length === 0 && <tr><td colSpan={6} style={{ padding: 36, textAlign: "center", color: "#9ca3af", fontSize: "0.82rem" }}>ไม่พบผู้ใช้ตามเงื่อนไข</td></tr>}
                {pageRows.map(u => (
                  <tr key={u.id} className="clickable" onClick={() => setDetailUser(u)}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Avatar name={u.name} role={u.role} avatar={u.avatar} />
                        <div style={{ minWidth: 0 }}><div style={{ fontWeight: 700, color: STEEL }}>{u.name}</div><div style={{ fontSize: "0.72rem", color: MUTED, overflow: "hidden", textOverflow: "ellipsis" }}>{u.email}</div></div>
                      </div>
                    </td>
                    <td><RoleBadge role={u.role} /></td>
                    <td style={{ fontSize: "0.8rem", color: STEEL, fontWeight: 600 }}>{u.department}</td>
                    <td><StatusDot status={u.status} /></td>
                    <td style={{ color: MUTED, fontSize: "0.72rem", whiteSpace: "nowrap" }}>{u.createdAt}</td>
                    <td className="ovf-visible" onClick={e => e.stopPropagation()}>
                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <button className="btn btn-icon btn-sm" title="จัดการ" onClick={e => { const r = e.currentTarget.getBoundingClientRect(); setMenu({ user: u, x: r.right, y: r.bottom + 4 }); }}><MoreHorizontal size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderTop: `1px solid ${BORDER}`, fontSize: "0.76rem", color: MUTED }}>
            <span>หน้า {curPage} / {pageCount}</span>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn btn-secondary btn-sm" disabled={curPage <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} style={curPage <= 1 ? { opacity: .5, cursor: "not-allowed" } : undefined}>ก่อนหน้า</button>
              <button className="btn btn-secondary btn-sm" disabled={curPage >= pageCount} onClick={() => setPage(p => Math.min(pageCount, p + 1))} style={curPage >= pageCount ? { opacity: .5, cursor: "not-allowed" } : undefined}>ถัดไป</button>
            </div>
          </div>
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

      {/* Action dropdown (ห้ามลบจริง — ใช้ปิดใช้งาน) */}
      {menu && (
        <ActionMenu pos={{ x: menu.x, y: menu.y }} onClose={() => setMenu(null)} items={[
          { label: "ดูรายละเอียด", icon: <Eye size={14} />, onClick: () => setDetailUser(menu.user) },
          { label: "แก้ไข", icon: <Pencil size={14} />, onClick: () => setDialogUser(menu.user) },
          { label: "รีเซ็ตรหัสผ่าน", icon: <KeyRound size={14} />, onClick: () => resetPassword(menu.user) },
          { label: menu.user.status === "active" ? "ปิดใช้งาน" : "เปิดใช้งาน", icon: <Power size={14} />, onClick: () => toggleStatus(menu.user) },
        ]} />
      )}

      {detailUser && <UserDetailDrawer user={detailUser} onClose={() => setDetailUser(null)} onEdit={() => { setDialogUser(detailUser); setDetailUser(null); }} />}
      {addOpen && <UserDialog onSave={data => saveUser(null, data)} onClose={() => setAddOpen(false)} />}
      {dialogUser && <UserDialog initial={dialogUser} onSave={data => saveUser(dialogUser.id, data)} onClose={() => setDialogUser(null)} />}

      {/* Reset password result (แสดงรหัสใหม่ให้คัดลอก) */}
      {resetInfo && (
        <div onClick={() => setResetInfo(null)} style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(45,45,45,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 400, background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,.22)" }}>
            <div style={{ background: PRIMARY, color: "#fff", padding: "15px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}><div style={{ display: "flex", alignItems: "center", gap: 9, fontWeight: 800 }}><KeyRound size={16} /> รีเซ็ตรหัสผ่านแล้ว</div><button onClick={() => setResetInfo(null)} style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(255,255,255,.15)", color: "#fff", border: "none", cursor: "pointer" }}><X size={14} /></button></div>
            <div style={{ padding: 20 }}>
              <div style={{ fontSize: "0.82rem", color: MUTED, marginBottom: 12 }}>รหัสผ่านชั่วคราวใหม่ของ <strong style={{ color: STEEL }}>{resetInfo.user.name}</strong> — แจ้งให้ผู้ใช้เปลี่ยนเองหลังเข้าระบบ</div>
              <CopyField label="รหัสผ่านชั่วคราว" value={resetInfo.pw} />
            </div>
          </div>
        </div>
      )}
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
