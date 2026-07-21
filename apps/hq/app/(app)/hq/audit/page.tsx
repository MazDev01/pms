"use client";

// ─── HQ · บันทึกการใช้งาน (Audit Log) — ตรวจว่า admin ของ HQ ทำอะไรไปบ้าง ──────
import { useMemo, useState } from "react";
import { ScrollText, Search, X, User, Activity } from "lucide-react";
import { useAuditEntries } from "@pms/shared/lib/useAudit";
import { hqAuditCategory, HQ_NOTIF_EVENTS } from "@pms/shared/lib/mock";
import { useFilters, APP_NOW, parseDate } from "@pms/shared/context/FilterContext";
import { FilterBar } from "@pms/shared/components/filters/FilterBar";
import { ExportMenu } from "@pms/shared/components/ui/ExportMenu";
import { TopbarActions } from "@pms/shared/components/layout/TopbarActions";

const PRIMARY = "#003366";
// ชื่อโมดูล = ชุดเดียวกับหัวข้อใน ตั้งค่า → การแจ้งเตือน (hqAuditCategory จัดหมวดให้)
const MODULE_LABEL: Record<string, string> = Object.fromEntries(HQ_NOTIF_EVENTS.map(e => [e.key, e.label]));
const ROLE_LABEL: Record<string, { label: string; bg: string; color: string }> = {
  HQ_MANAGEMENT: { label: "ผู้บริหาร HQ", bg: "#dce5f0", color: "#003366" },
  DEALER_ADMIN: { label: "ตัวแทน", bg: "#fff3cd", color: "#92400e" },
  DEALER_SALES: { label: "ฝ่ายขาย", bg: "#eef2f7", color: "#475569" },
};

export default function HQAuditPage() {
  const entries = useAuditEntries();
  const { inRange, timeRange } = useFilters();
  const [q, setQ] = useState("");
  const [userFilter, setUserFilter] = useState("all");
  const [moduleFilter, setModuleFilter] = useState("all");

  const users = useMemo(() => [...new Set(entries.map(e => e.user))], [entries]);
  // โมดูลที่มีจริงในบันทึกเท่านั้น — ไม่ขึ้นตัวเลือกที่กรองแล้วไม่เจออะไร
  const modules = useMemo(
    () => [...new Set(entries.map(e => hqAuditCategory(e.action)))],
    [entries],
  );

  const filtered = useMemo(() => entries.filter(e => {
    if (userFilter !== "all" && e.user !== userFilter) return false;
    if (moduleFilter !== "all" && hqAuditCategory(e.action) !== moduleFilter) return false;
    if (!inRange(e.at)) return false;
    const s = q.trim().toLowerCase();
    return !s || `${e.user} ${e.action} ${e.target}`.toLowerCase().includes(s);
  }), [entries, userFilter, moduleFilter, q, inRange]);

  // "วันนี้" = วันนี้ของระบบ (30 มิ.ย. 2569) ไม่ใช่นาฬิกาเครื่อง
  // ของเดิมเทียบสตริงด้วย new Date().getDate() → เลขเปลี่ยนไปเรื่อยตามวันจริง และ "17 ก.ค." กับ "17 มิ.ย." ก็ชนกัน
  const stats = useMemo(() => {
    const sameDay = (s: string) => {
      const d = parseDate(s);
      return !!d && d.getDate() === APP_NOW.getDate() && d.getMonth() === APP_NOW.getMonth() && d.getFullYear() === APP_NOW.getFullYear();
    };
    return {
      total: entries.length,
      users: users.length,
      today: entries.filter(e => sameDay(e.at)).length,
    };
  }, [entries, users]);

  return (
    <div className="erp">
      <TopbarActions>
        {/* HQ คือคนที่ต้องเอาบันทึกไปตอบผู้ตรวจ/ผู้บริหาร — ส่งออกได้ตามที่กรองอยู่ */}
        <ExportMenu
          filename="hq-audit-log"
          headers={["ผู้ใช้", "บทบาท", "โมดูล", "การกระทำ", "รายละเอียด", "เวลา"]}
          rows={filtered.map(e => [
            e.user,
            ROLE_LABEL[e.role]?.label ?? e.role,
            MODULE_LABEL[hqAuditCategory(e.action)] ?? hqAuditCategory(e.action),
            e.action, e.target, e.at,
          ])}
        />
      </TopbarActions>
      <div className="page-head">
        <div>
          <p>ตรวจสอบว่าผู้ใช้งานสำนักงานใหญ่แต่ละคนทำอะไรไปบ้าง — ใคร แก้อะไร เมื่อไร · {timeRange.subtitle}</p>
        </div>
        <FilterBar dims={[]} />
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
        <select value={moduleFilter} onChange={e => setModuleFilter(e.target.value)} className="form-select" style={{ width: "auto", cursor: "pointer" }}>
          <option value="all">ทุกโมดูล</option>
          {modules.map(m => <option key={m} value={m}>{MODULE_LABEL[m] ?? m}</option>)}
        </select>
        <select value={userFilter} onChange={e => setUserFilter(e.target.value)} className="form-select" style={{ width: "auto", cursor: "pointer" }}>
          <option value="all">ผู้ใช้ทุกคน</option>
          {users.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>

      {/* ตาราง */}
      <div className="card">
        <div className="table-wrap" style={{ borderTop: "none" }}>
          <table>
            {/* เพิ่มคอลัมน์ "โมดูล" → ต้องแก้ colgroup ด้วย (ใส่ที่ th ไม่มีผล เพราะ table-layout: fixed) */}
            <colgroup><col style={{ width: "18%" }} /><col style={{ width: "13%" }} /><col style={{ width: "14%" }} /><col style={{ width: "16%" }} /><col style={{ width: "23%" }} /><col style={{ width: "16%" }} /></colgroup>
            <thead>
              <tr><th>ผู้ใช้</th><th>บทบาท</th><th>โมดูล</th><th>การกระทำ</th><th>รายละเอียด</th><th>เวลา</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: "center", padding: "36px 14px", color: "#9ca3af", fontSize: "0.8rem" }}>
                  {entries.length === 0 ? "ยังไม่มีบันทึกกิจกรรม" : "ไม่พบบันทึกตามตัวกรองที่เลือก"}
                </td></tr>
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
                    <td style={{ fontSize: "0.76rem", color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {MODULE_LABEL[hqAuditCategory(e.action)] ?? "—"}
                    </td>
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
