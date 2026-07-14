"use client";

// ─── HQ · บันทึกการใช้งาน (Audit Log) — ตรวจว่า admin ของ HQ ทำอะไรไปบ้าง ──────
import { useMemo, useState } from "react";
import { ScrollText, Search, X, User, Activity } from "lucide-react";
import { useAuditEntries } from "@/lib/useAudit";

const PRIMARY = "#003366";
const ROLE_LABEL: Record<string, { label: string; bg: string; color: string }> = {
  HQ_MANAGEMENT: { label: "ผู้บริหาร HQ", bg: "#dce5f0", color: "#003366" },
  DEALER_ADMIN: { label: "ตัวแทน", bg: "#fff3cd", color: "#92400e" },
  DEALER_SALES: { label: "ฝ่ายขาย", bg: "#eef2f7", color: "#475569" },
};

export default function HQAuditPage() {
  const entries = useAuditEntries();
  const [q, setQ] = useState("");
  const [userFilter, setUserFilter] = useState("all");

  const users = useMemo(() => [...new Set(entries.map(e => e.user))], [entries]);
  const filtered = useMemo(() => entries.filter(e => {
    const matchU = userFilter === "all" || e.user === userFilter;
    const s = q.trim().toLowerCase();
    const matchQ = !s || `${e.user} ${e.action} ${e.target}`.toLowerCase().includes(s);
    return matchU && matchQ;
  }), [entries, userFilter, q]);

  const todayStr = `${new Date().getDate()} `; // สำหรับนับ "วันนี้" แบบหยาบจากสตริงไทย
  const stats = useMemo(() => ({
    total: entries.length,
    users: users.length,
    today: entries.filter(e => e.at.startsWith(todayStr)).length,
  }), [entries, users, todayStr]);

  return (
    <div className="erp">
      <div className="page-head">
        <div>
          <h2>บันทึกการใช้งาน</h2>
          <p>ตรวจสอบว่าผู้ใช้งานสำนักงานใหญ่แต่ละคนทำอะไรไปบ้าง — ใคร แก้อะไร เมื่อไร</p>
        </div>
      </div>

      {/* สรุป */}
      <div className="kpi-bar">
        <div className="kpi"><div className="kpi-icon kpi-navy"><Activity size={16} /></div><div><div className="kpi-val">{stats.total}</div><div className="kpi-label">รายการทั้งหมด</div></div></div>
        <div className="kpi"><div className="kpi-icon kpi-navy"><User size={16} /></div><div><div className="kpi-val">{stats.users}</div><div className="kpi-label">ผู้ใช้ที่มีกิจกรรม</div></div></div>
        <div className="kpi"><div className="kpi-icon kpi-green"><ScrollText size={16} /></div><div><div className="kpi-val">{stats.today}</div><div className="kpi-label">กิจกรรมวันนี้</div></div></div>
      </div>

      {/* Toolbar */}
      <div className="card" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "10px 14px", marginBottom: 16 }}>
        <div className="search-bar" style={{ width: 300, maxWidth: "100%" }}>
          <Search size={14} color="#9ca3af" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="ค้นหาผู้ใช้ / การกระทำ / รายละเอียด..." />
          {q && <button onClick={() => setQ("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", display: "flex", padding: 0 }}><X size={13} /></button>}
        </div>
        <div style={{ flex: 1 }} />
        <select value={userFilter} onChange={e => setUserFilter(e.target.value)} className="form-select" style={{ width: "auto", cursor: "pointer" }}>
          <option value="all">ผู้ใช้ทุกคน</option>
          {users.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>

      {/* ตาราง */}
      <div className="card">
        <div className="table-wrap" style={{ borderTop: "none" }}>
          <table>
            <colgroup><col style={{ width: "20%" }} /><col style={{ width: "16%" }} /><col style={{ width: "18%" }} /><col style={{ width: "28%" }} /><col style={{ width: "18%" }} /></colgroup>
            <thead>
              <tr><th>ผู้ใช้</th><th>บทบาท</th><th>การกระทำ</th><th>รายละเอียด</th><th>เวลา</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: "center", padding: "36px 14px", color: "#9ca3af", fontSize: "0.8rem" }}>ยังไม่มีบันทึกกิจกรรม</td></tr>
              )}
              {filtered.map(e => {
                const rm = ROLE_LABEL[e.role] ?? { label: e.role, bg: "#f0f0f5", color: "#6b7280" };
                return (
                  <tr key={e.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                        <span style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, background: "linear-gradient(135deg,#003366,#0a4a86)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.66rem", fontWeight: 800 }}>{e.user.slice(0, 2)}</span>
                        <span style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.user}</span>
                      </div>
                    </td>
                    <td><span className="badge" style={{ background: rm.bg, color: rm.color }}>{rm.label}</span></td>
                    <td><span className="badge" style={{ background: "#eef2f7", color: PRIMARY }}>{e.action}</span></td>
                    <td style={{ fontSize: "0.8rem", color: "#2D2D2D" }}>{e.target}</td>
                    <td style={{ fontSize: "0.72rem", color: "#9ca3af", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{e.at}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
