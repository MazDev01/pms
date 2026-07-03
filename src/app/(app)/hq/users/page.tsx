"use client";

import { useState } from "react";
import { Users, Shield, Check, Eye, X, Plus, Pencil, Ban, User as UserIcon } from "lucide-react";

// ── Tokens ────────────────────────────────────────────────────
const PRIMARY = "#003366";
const STEEL   = "#2D2D2D";
const BORDER  = "#e5e7eb";
const MUTED   = "#6b7280";

// ── Types ─────────────────────────────────────────────────────
type RoleKey = "hq_admin" | "hq_manager" | "dealer_admin" | "dealer_sales";
type UserStatus = "active" | "inactive";
type PermLevel = "all" | "view" | "own" | "none";

type AppUser = {
  id: number;
  name: string;
  email: string;
  role: RoleKey;
  status: UserStatus;
};

// ── Role meta ─────────────────────────────────────────────────
const ROLES: { key: RoleKey; en: string; th: string; tone: string }[] = [
  { key: "hq_admin",     en: "HQ Admin",     th: "ผู้ดูแลสำนักงานใหญ่",   tone: PRIMARY  },
  { key: "hq_manager",   en: "HQ Manager",   th: "ผู้จัดการสำนักงานใหญ่", tone: "#0369a1" },
  { key: "dealer_admin", en: "Dealer Admin", th: "ผู้ดูแลสาขา",          tone: "#7c3aed" },
  { key: "dealer_sales", en: "Dealer Sales", th: "เซลส์สาขา",            tone: "#059669" },
];
const ROLE_BY_KEY: Record<RoleKey, { en: string; th: string; tone: string }> = Object.fromEntries(
  ROLES.map((r) => [r.key, { en: r.en, th: r.th, tone: r.tone }])
) as Record<RoleKey, { en: string; th: string; tone: string }>;

// ── Permission meta ───────────────────────────────────────────
const PERM_META: Record<PermLevel, { label: string; bg: string; color: string; icon: React.ReactNode }> = {
  all:  { label: "ทั้งหมด",   bg: "#dce5f0", color: PRIMARY,   icon: <Check size={13} /> },
  view: { label: "ดู",        bg: "#e0f2fe", color: "#0369a1", icon: <Eye size={13} /> },
  own:  { label: "เฉพาะของตน", bg: "#dcfce7", color: "#059669", icon: <UserIcon size={13} /> },
  none: { label: "ไม่มี",      bg: "#f5f5f5", color: "#9ca3af", icon: <X size={13} /> },
};

// ── Permission matrix: module → per-role level ────────────────
const MODULES: { name: string; perms: Record<RoleKey, PermLevel> }[] = [
  { name: "ผู้สนใจ",            perms: { hq_admin: "all", hq_manager: "all",  dealer_admin: "view", dealer_sales: "own"  } },
  { name: "ลูกค้า",          perms: { hq_admin: "all", hq_manager: "all",  dealer_admin: "view", dealer_sales: "own"  } },
  { name: "เส้นทางการขาย",  perms: { hq_admin: "all", hq_manager: "all",  dealer_admin: "view", dealer_sales: "own"  } },
  { name: "ใบเสนอราคา",     perms: { hq_admin: "all", hq_manager: "all",  dealer_admin: "all",  dealer_sales: "own"  } },
  { name: "สินค้า",          perms: { hq_admin: "all", hq_manager: "view", dealer_admin: "view", dealer_sales: "view" } },
  { name: "รายงาน",         perms: { hq_admin: "all", hq_manager: "all",  dealer_admin: "view", dealer_sales: "none" } },
  { name: "ผู้ใช้",           perms: { hq_admin: "all", hq_manager: "view", dealer_admin: "view", dealer_sales: "none" } },
  { name: "ตั้งค่า",          perms: { hq_admin: "all", hq_manager: "none", dealer_admin: "view", dealer_sales: "none" } },
];

// ── Mock users ────────────────────────────────────────────────
const USERS_INIT: AppUser[] = [
  { id: 1, name: "อารยา สุขวิเศษ",    email: "araya@benjamin.co.th",    role: "hq_admin",     status: "active"   },
  { id: 2, name: "กิตติ พรมมา",        email: "kitti@benjamin.co.th",    role: "hq_manager",   status: "active"   },
  { id: 3, name: "ประภัสสร ดาวรุ่ง",   email: "prapas@benjamin.co.th",   role: "hq_manager",   status: "active"   },
  { id: 4, name: "ธนพล วิชาศิลป์",    email: "thanapol@dealer-cm.co.th", role: "dealer_admin", status: "active"   },
  { id: 5, name: "นิภาพร จันทร์สว่าง", email: "nipaporn@dealer-bkk.co.th", role: "dealer_sales", status: "active"   },
  { id: 6, name: "สมชาย พันธ์ดี",      email: "somchai@dealer-bkk.co.th", role: "dealer_sales", status: "inactive" },
];

// ── Sub-components ────────────────────────────────────────────
function RoleBadge({ role }: { role: RoleKey }) {
  const r = ROLE_BY_KEY[role];
  return (
    <span className="badge" style={{ background: r.tone + "1a", color: r.tone, fontWeight: 700 }}>
      {r.en}
    </span>
  );
}

function StatusBadge({ status }: { status: UserStatus }) {
  const active = status === "active";
  return (
    <span
      className="badge"
      style={{ background: active ? "#dcfce7" : "#f5f5f5", color: active ? "#059669" : "#9ca3af", fontWeight: 700 }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: active ? "#059669" : "#cbd5e1", display: "inline-block", marginRight: 5 }} />
      {active ? "ใช้งาน" : "ปิดใช้งาน"}
    </span>
  );
}

function PermCell({ level }: { level: PermLevel }) {
  const m = PERM_META[level];
  return (
    <span
      className="badge"
      style={{ background: m.bg, color: m.color, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}
    >
      {m.icon}
      {m.label}
    </span>
  );
}

// ── Add-user modal ────────────────────────────────────────────
type UserForm = { name: string; email: string; role: RoleKey; status: UserStatus };
const BLANK_USER: UserForm = { name: "", email: "", role: "dealer_sales", status: "active" };

function AddUserModal({ onClose, onAdd, initial }: { onClose: () => void; onAdd: (f: UserForm) => void; initial?: UserForm }) {
  const [form, setForm] = useState<UserForm>(initial ?? BLANK_USER);
  const isEdit = !!initial;
  const valid = form.name.trim() !== "" && /\S+@\S+\.\S+/.test(form.email);

  function submit() {
    if (!valid) return;
    onAdd({ ...form, name: form.name.trim(), email: form.email.trim() });
    onClose();
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(45,45,45,.45)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 440, background: "#fff", borderRadius: 14, overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,.22)" }}>
        {/* header */}
        <div style={{ background: PRIMARY, color: "#fff", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 800 }}>{isEdit ? "แก้ไขผู้ใช้" : "เพิ่มผู้ใช้ใหม่"}</h2>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,.15)", color: "#fff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={16} /></button>
        </div>
        {/* body */}
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label className="form-label">ชื่อ-นามสกุล</label>
            <input className="form-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="เช่น สมชาย ใจดี" />
          </div>
          <div>
            <label className="form-label">อีเมล</label>
            <input className="form-input" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="name@benjamin.co.th" />
          </div>
          <div>
            <label className="form-label">บทบาท</label>
            <select className="form-select" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as RoleKey }))}>
              {ROLES.map((r) => <option key={r.key} value={r.key}>{r.en} · {r.th}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">สถานะ</label>
            <select className="form-select" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as UserStatus }))}>
              <option value="active">ใช้งาน</option>
              <option value="inactive">ปิดใช้งาน</option>
            </select>
          </div>
        </div>
        {/* footer */}
        <div style={{ padding: "14px 20px", borderTop: `1px solid ${BORDER}`, display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="btn btn-secondary btn-md" onClick={onClose}>ยกเลิก</button>
          <button className="btn btn-primary btn-md" onClick={submit} disabled={!valid} style={!valid ? { opacity: 0.5, cursor: "not-allowed" } : undefined}>
            <Plus size={14} /> {isEdit ? "บันทึก" : "เพิ่มผู้ใช้"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────
export default function HQUsersPage() {
  const [users, setUsers] = useState<AppUser[]>(USERS_INIT);
  const [showAdd, setShowAdd] = useState(false);
  const [editUser, setEditUser] = useState<AppUser | null>(null);

  function toggleStatus(id: number) {
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, status: u.status === "active" ? "inactive" : "active" } : u))
    );
  }

  function addUser(form: UserForm) {
    const maxId = users.reduce((m, u) => Math.max(m, u.id), 0);
    setUsers((prev) => [{ id: maxId + 1, ...form }, ...prev]);
  }

  function updateUser(form: UserForm) {
    if (!editUser) return;
    setUsers((prev) => prev.map((u) => (u.id === editUser.id ? { ...u, ...form } : u)));
  }

  const activeCount = users.filter((u) => u.status === "active").length;

  return (
    <div className="erp">
      {/* Page head */}
      <div className="page-head" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h2>ผู้ใช้งาน</h2>
          <p>จัดการผู้ใช้ บทบาท และสิทธิ์การเข้าถึง</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn" style={{ background: PRIMARY, color: "#fff", display: "inline-flex", alignItems: "center", gap: 7 }}>
          <Plus size={16} /> เพิ่มผู้ใช้
        </button>
      </div>

      {showAdd && <AddUserModal onClose={() => setShowAdd(false)} onAdd={addUser} />}
      {editUser && <AddUserModal initial={{ name: editUser.name, email: editUser.email, role: editUser.role, status: editUser.status }} onClose={() => setEditUser(null)} onAdd={updateUser} />}

      {/* Users card */}
      <div className="card" style={{ marginBottom: 22 }}>
        <div className="card-header" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Users size={18} color={PRIMARY} />
          <div style={{ flex: 1 }}>
            <div className="card-title">ผู้ใช้งาน</div>
            <div className="card-desc">รายชื่อผู้ใช้ทั้งหมด {users.length} คน · ใช้งานอยู่ {activeCount} คน</div>
          </div>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <colgroup>
                <col style={{ width: "26%" }} />
                <col style={{ width: "26%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "20%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>ชื่อ</th>
                  <th>อีเมล</th>
                  <th>บทบาท</th>
                  <th>สถานะ</th>
                  <th style={{ textAlign: "right" }}>การจัดการ</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span
                          style={{
                            width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                            background: ROLE_BY_KEY[u.role].tone, color: "#fff",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontWeight: 800, fontSize: "0.82rem",
                          }}
                        >
                          {u.name.charAt(0)}
                        </span>
                        <span style={{ fontWeight: 700, color: STEEL }}>{u.name}</span>
                      </div>
                    </td>
                    <td style={{ color: MUTED }}>{u.email}</td>
                    <td><RoleBadge role={u.role} /></td>
                    <td><StatusBadge status={u.status} /></td>
                    <td>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                        <button
                          onClick={() => setEditUser(u)}
                          className="btn"
                          style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", fontSize: "0.78rem" }}
                        >
                          <Pencil size={13} /> แก้ไข
                        </button>
                        <button
                          onClick={() => toggleStatus(u.id)}
                          className="btn"
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", fontSize: "0.78rem",
                            color: u.status === "active" ? "#dc2626" : "#059669",
                            borderColor: u.status === "active" ? "#fecaca" : "#bbf7d0",
                          }}
                        >
                          {u.status === "active" ? <><Ban size={13} /> ปิดใช้งาน</> : <><Check size={13} /> เปิดใช้งาน</>}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Permission matrix card */}
      <div className="card">
        <div className="card-header" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Shield size={18} color={PRIMARY} />
          <div style={{ flex: 1 }}>
            <div className="card-title">สิทธิ์ตามบทบาท (Permission Matrix)</div>
            <div className="card-desc">สิทธิ์การเข้าถึงแต่ละโมดูลตามบทบาท — HQ เห็นทุกอย่าง, Dealer เห็นเฉพาะของตน</div>
          </div>
        </div>

        {/* Role legend */}
        <div className="card-body" style={{ paddingBottom: 0 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 4 }}>
            {ROLES.map((r) => (
              <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: r.tone, display: "inline-block", flexShrink: 0 }} />
                <span style={{ fontSize: "0.78rem", fontWeight: 700, color: STEEL }}>{r.en}</span>
                <span style={{ fontSize: "0.72rem", color: MUTED }}>{r.th}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card-body" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <colgroup>
                <col style={{ width: "24%" }} />
                <col style={{ width: "19%" }} />
                <col style={{ width: "19%" }} />
                <col style={{ width: "19%" }} />
                <col style={{ width: "19%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={{ minWidth: 130 }}>โมดูล</th>
                  {ROLES.map((r) => (
                    <th key={r.key} style={{ textAlign: "center" }}>
                      <div style={{ fontWeight: 700, color: STEEL }}>{r.en}</div>
                      <div style={{ fontSize: "0.68rem", color: MUTED, fontWeight: 500, marginTop: 2 }}>{r.th}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MODULES.map((mod) => (
                  <tr key={mod.name}>
                    <td style={{ fontWeight: 700, color: STEEL }}>{mod.name}</td>
                    {ROLES.map((r) => (
                      <td key={r.key} style={{ textAlign: "center" }}>
                        <PermCell level={mod.perms[r.key]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Permission legend */}
        <div className="card-body" style={{ paddingTop: 4 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
            <span style={{ fontSize: "0.74rem", color: MUTED, fontWeight: 600 }}>ความหมายสิทธิ์:</span>
            {(["all", "view", "own", "none"] as PermLevel[]).map((lvl) => (
              <PermCell key={lvl} level={lvl} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
