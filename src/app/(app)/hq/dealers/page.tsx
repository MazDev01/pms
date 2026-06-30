"use client";

import { useState } from "react";
import { dealerLeaderboard, type DealerRow, type DealerCredentials } from "@/lib/mock";
import { useRole } from "@/context/RoleContext";
import { useFilters } from "@/context/FilterContext";
import { FilterBar } from "@/components/filters/FilterBar";
import { useRouter } from "next/navigation";
import { Plus, Search, X, Copy, Check, Key, LogIn, Pencil, Trash2, EyeOff, Eye, AlertTriangle, BarChart2, TrendingUp, Trophy, Target, Award, Clock } from "lucide-react";

const CARD: React.CSSProperties = { background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", boxShadow: "0 2px 14px rgba(0,0,0,.07)" };
const REGIONS = ["เหนือ", "กลาง", "ตะวันออก", "ตะวันตก", "ใต้", "อีสาน"];

// ── Sub-components ──────────────────────────────────────────────

function RevBar({ actual, target }: { actual: number; target: number }) {
  const pct = target > 0 ? Math.min(100, Math.round(actual / target * 100)) : 0;
  const color = pct >= 100 ? "#059669" : pct >= 75 ? "#003366" : pct >= 50 ? "#f59e0b" : "#dc2626";
  return (
    <div style={{ minWidth: 130 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", marginBottom: 3 }}>
        <span style={{ color: "#6b7280" }}>฿{(actual / 1_000_000).toFixed(1)}M</span>
        <span style={{ fontWeight: 700, color }}>{pct}%</span>
      </div>
      <div style={{ height: 6, background: "#f0f0f5", borderRadius: 99, overflow: "hidden" }}>
        <div className="top5-bar" style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 99 }} />
      </div>
      <div style={{ fontSize: "0.66rem", color: "#6b7280", marginTop: 2 }}>
        เป้า ฿{(target / 1_000_000).toFixed(0)}M
      </div>
    </div>
  );
}

function OnTimeBadge({ pct }: { pct: number }) {
  if (pct === 0) return <span style={{ color: "#C0C0C0", fontSize: "0.78rem" }}>—</span>;
  const color = pct >= 85 ? "#059669" : pct >= 70 ? "#f59e0b" : "#dc2626";
  return (
    <span className="badge" style={{ background: color + "22", color }}>
      {pct}%
    </span>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  function doCopy() {
    navigator.clipboard.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: "0.7rem", color: "#6b7280", marginBottom: 4, fontWeight: 600 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#f0f4f8", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 11px" }}>
        <span style={{ flex: 1, fontFamily: "monospace", fontSize: "0.86rem", fontWeight: 700, color: "#2D2D2D", letterSpacing: "0.03em" }}>{value}</span>
        <button type="button" onClick={doCopy} style={{ background: "none", border: "none", cursor: "pointer", color: copied ? "#059669" : "#6b7280", padding: 0, display: "flex" }}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
    </div>
  );
}

function InputField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label className="form-label" style={{ textTransform: "none", letterSpacing: "normal", fontSize: "0.72rem" }}>{label}</label>
      {children}
    </div>
  );
}

const INPUT_STYLE: React.CSSProperties = { width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px solid #e5e7eb", fontSize: "0.82rem", color: "#2D2D2D", outline: "none", background: "#fafafa", boxSizing: "border-box" };

function genCredentials(code: string): DealerCredentials {
  const digits = String(1000 + ((code.charCodeAt(0) * 37 + code.charCodeAt(1) * 17) % 9000));
  return { email: `${code.toLowerCase()}@benjamin.co.th`, password: `PEB-${code}-${digits}` };
}

// ── Main page ───────────────────────────────────────────────────

export default function HQDealersPage() {
  const { login } = useRole();
  const { timeRange, passes } = useFilters();
  const router = useRouter();

  const [dealers, setDealers] = useState<DealerRow[]>(dealerLeaderboard);
  const [q, setQ] = useState("");
  const [regionFilter, setRegionFilter] = useState("ทั้งหมด");

  // Modals
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<DealerRow | null>(null);
  const [form, setForm] = useState({ code: "", name: "", region: "กลาง", revenueTarget: 0, status: "active" as "active" | "inactive" });
  const [formErr, setFormErr] = useState("");
  const [credsModal, setCredsModal] = useState<{ name: string; creds: DealerCredentials } | null>(null);
  const [viewCredsDealer, setViewCredsDealer] = useState<DealerRow | null>(null);
  const [entering, setEntering] = useState<string | null>(null);
  const [selectedDealer, setSelectedDealer] = useState<DealerRow | null>(null);

  // Filter + sort — กรองจริงด้วย FilterBar (dealer/status) + search/region ในหน้า
  const filtered = dealers.filter(d => {
    if (!passes({ dealer: d.code, status: d.status })) return false;
    if (regionFilter !== "ทั้งหมด" && d.region !== regionFilter) return false;
    if (q && !`${d.code} ${d.name} ${d.region}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }).sort((a, b) => b.revenueActual - a.revenueActual);

  // Stats — คำนวณจากชุดที่กรองแล้ว; ตัวเลขสะสม (รายได้/โครงการ) สเกลด้วย timeRange.factor
  const f = timeRange.factor;
  const active = filtered.filter(d => d.status === "active");
  const totalRevenue = Math.round(filtered.reduce((s, d) => s + d.revenueActual, 0) * f);
  const totalTarget = Math.round(filtered.reduce((s, d) => s + d.revenueTarget, 0) * f);
  const totalProjects = Math.round(filtered.reduce((s, d) => s + d.activeProjects, 0) * f);
  const avgOnTime = active.length > 0 ? Math.round(active.reduce((s, d) => s + d.onTimePct, 0) / active.length) : 0;
  const totalPct = totalTarget > 0 ? Math.round(totalRevenue / totalTarget * 100) : 0;

  function openAdd() { setEditTarget(null); setForm({ code: "", name: "", region: "กลาง", revenueTarget: 0, status: "active" }); setFormErr(""); setShowForm(true); }
  function openEdit(d: DealerRow) { setEditTarget(d); setForm({ code: d.code, name: d.name, region: d.region, revenueTarget: d.revenueTarget, status: d.status }); setFormErr(""); setShowForm(true); }

  function save() {
    const code = form.code.trim().toUpperCase();
    if (!code) { setFormErr("ต้องระบุรหัสสาขา"); return; }
    if (!form.name.trim()) { setFormErr("ต้องระบุชื่อสาขา"); return; }
    const dupe = dealers.find(d => d.code === code && d.id !== editTarget?.id);
    if (dupe) { setFormErr(`รหัส "${code}" มีอยู่แล้ว`); return; }

    if (editTarget) {
      setDealers(prev => prev.map(d => d.id === editTarget.id ? { ...d, name: form.name.trim(), region: form.region, revenueTarget: form.revenueTarget, status: form.status } : d));
      setShowForm(false);
    } else {
      const creds = genCredentials(code);
      setDealers(prev => [...prev, { id: code, code, name: form.name.trim(), region: form.region, revenueActual: 0, revenueTarget: form.revenueTarget, winRate: 0, activeProjects: 0, onTimePct: 0, status: form.status, credentials: creds }]);
      setShowForm(false);
      setCredsModal({ name: form.name.trim(), creds });
    }
  }

  function remove(d: DealerRow) {
    if (!confirm(`ลบ "${d.name}" ออกจากระบบ?\nการกระทำนี้ไม่สามารถย้อนกลับได้`)) return;
    setDealers(prev => prev.filter(x => x.id !== d.id));
  }

  function toggleStatus(d: DealerRow) {
    setDealers(prev => prev.map(x => x.id === d.id ? { ...x, status: x.status === "active" ? "inactive" : "active" } : x));
  }

  function enterDealer(d: DealerRow) {
    setEntering(d.id);
    login("dealer");
    router.push("/dashboard");
  }

  const selectStyle: React.CSSProperties = { border: "1px solid #e5e7eb", borderRadius: 10, padding: "8px 12px", fontSize: "0.78rem", color: "#6b7280", background: "#fff", cursor: "pointer", outline: "none" };

  return (
    <div className="erp">
      {/* Header */}
      <div className="page-head">
        <div>
          <h2>สาขา</h2>
          <p>จัดการและติดตามผลการดำเนินงานของทุกสาขา · {timeRange.subtitle}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <FilterBar
            dims={["dealer", "status"]}
            statusOptions={[{ value: "active", label: "ใช้งาน" }, { value: "inactive", label: "ไม่ใช้งาน" }]}
          />
          <button onClick={openAdd} className="btn btn-primary btn-md">
            <Plus size={14} /> เพิ่มสาขา
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">สาขาทั้งหมด</div>
          <div className="stat-value" style={{ color: "#003366" }}>{dealers.length} สาขา</div>
          <div className="stat-delta delta-up">เปิดใช้งาน {active.length} สาขา</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">รายได้รวม</div>
          <div className="stat-value" style={{ color: "#059669" }}>฿{(totalRevenue / 1_000_000).toFixed(1)}M</div>
          <div className="stat-delta" style={{ color: totalPct >= 100 ? "#059669" : "#f59e0b" }}>
            {totalPct}% ของเป้า ฿{(totalTarget / 1_000_000).toFixed(0)}M
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">โอกาสการขายทั้งหมด</div>
          <div className="stat-value" style={{ color: "#f59e0b" }}>{totalProjects} โอกาสการขาย</div>
          <div className="stat-delta" style={{ color: "#6b7280" }}>
            {active.filter(d => d.activeProjects > 0).length} สาขามีงาน
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">ส่งตรงเวลา</div>
          <div className="stat-value" style={{ color: "#003366" }}>{avgOnTime}%</div>
          <div className="stat-delta" style={{ color: avgOnTime >= 85 ? "#059669" : avgOnTime >= 70 ? "#f59e0b" : "#dc2626" }}>
            {avgOnTime >= 85 ? "↑ ดี" : avgOnTime >= 70 ? "— พอใช้" : "↓ ต้องปรับปรุง"} เฉลี่ยทุกสาขา
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        {/* Toolbar */}
        <div className="card-header" style={{ gap: 8, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fafafa", border: "1px solid #e5e7eb", borderRadius: 10, padding: "8px 12px", minWidth: 200 }}>
              <Search size={13} color="#6b7280" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="ค้นหาสาขา..." style={{ border: "none", outline: "none", fontSize: "0.8rem", color: "#2D2D2D", background: "transparent", flex: 1 }} />
            </div>
            <select value={regionFilter} onChange={e => setRegionFilter(e.target.value)} style={selectStyle}>
              {["ทั้งหมด", ...REGIONS].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {["#", "รหัส", "ชื่อสาขา", "ภาค", "ยอด / เป้า", "โอกาสการขาย", "ส่งตรงเวลา", "สถานะ", ""].map((h, i) => (
                  <th key={i}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: "32px", textAlign: "center", fontSize: "0.82rem", color: "#6b7280" }}>ไม่พบข้อมูล</td></tr>
              ) : filtered.map((d, i) => (
                <tr key={d.id} className="clickable" style={{ opacity: d.status === "inactive" ? 0.55 : 1 }}
                  onClick={() => setSelectedDealer(d)}>
                  <td style={{ fontSize: "0.72rem", color: "#6b7280", fontWeight: 600 }}>{i + 1}</td>
                  <td>
                    <span style={{ fontWeight: 800, color: "#003366", fontSize: "0.82rem", letterSpacing: "0.05em" }}>{d.code}</span>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <span style={{ fontSize: "0.86rem", fontWeight: 700, color: "#2D2D2D" }}>{d.name}</span>
                  </td>
                  <td>
                    <span className="badge" style={{ background: "#f0f0f5", color: "#6b7280" }}>{d.region}</span>
                  </td>
                  <td><RevBar actual={d.revenueActual} target={d.revenueTarget} /></td>
                  <td>
                    {d.activeProjects > 0
                      ? <span style={{ fontWeight: 700, color: "#2D2D2D", fontSize: "0.84rem" }}>{d.activeProjects}<span style={{ fontSize: "0.7rem", color: "#6b7280", fontWeight: 500 }}> โอกาสการขาย</span></span>
                      : <span style={{ color: "#C0C0C0", fontSize: "0.78rem" }}>—</span>}
                  </td>
                  <td><OnTimeBadge pct={d.onTimePct} /></td>
                  <td>
                    {d.status === "active"
                      ? <span className="badge" style={{ background: "#e5faf0", color: "#059669" }}>ใช้งาน</span>
                      : <span className="badge" style={{ background: "#f0f0f5", color: "#6b7280" }}>ปิดใช้งาน</span>}
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <button onClick={e => { e.stopPropagation(); enterDealer(d); }} disabled={entering === d.id} title="เข้าระบบสาขา"
                        className="btn btn-primary btn-sm" style={{ opacity: entering === d.id ? 0.6 : 1 }}>
                        <LogIn size={12} /> {entering === d.id ? "..." : "เข้าระบบ"}
                      </button>
                      <button onClick={e => { e.stopPropagation(); setViewCredsDealer(d); }} title="รหัสเข้าระบบ"
                        style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", background: "#f0f4f8", border: "1px solid #e5e7eb", borderRadius: 7, color: "#003366", cursor: "pointer" }}>
                        <Key size={12} />
                      </button>
                      <button onClick={e => { e.stopPropagation(); openEdit(d); }} title="แก้ไข"
                        style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 7, color: "#6b7280", cursor: "pointer" }}>
                        <Pencil size={12} />
                      </button>
                      <button onClick={e => { e.stopPropagation(); toggleStatus(d); }} title={d.status === "active" ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                        style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 7, color: "#6b7280", cursor: "pointer" }}>
                        {d.status === "active" ? <EyeOff size={12} /> : <Eye size={12} />}
                      </button>
                      <button onClick={e => { e.stopPropagation(); remove(d); }} title="ลบ"
                        style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", border: "1px solid #fee2e2", borderRadius: 7, color: "#dc2626", cursor: "pointer" }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ padding: "11px 16px", borderTop: "1px solid #e5e7eb" }}>
          <span style={{ fontSize: "0.73rem", color: "#6b7280" }}>แสดง {filtered.length} จาก {dealers.length} สาขา Benjamin</span>
        </div>
      </div>

      {/* ── Add / Edit Modal ── */}
      {showForm && (
        <div onClick={() => setShowForm(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.42)", zIndex: 1050, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ ...CARD, width: 460, maxWidth: "100%" }}>
            <div style={{ padding: "18px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "#2D2D2D" }}>{editTarget ? "แก้ไขข้อมูลสาขา" : "เพิ่มสาขาใหม่"}</h2>
              <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", display: "flex" }}><X size={18} /></button>
            </div>
            <div style={{ padding: "18px 20px" }}>
              {formErr && <div style={{ background: "#fee2e2", border: "1px solid #dc262630", borderRadius: 8, padding: "8px 12px", marginBottom: 14, fontSize: "0.78rem", color: "#dc2626", fontWeight: 600 }}>{formErr}</div>}

              {!editTarget && (
                <div style={{ background: "#dce5f0", border: "1px solid #C0C0C0", borderRadius: 8, padding: "8px 12px", marginBottom: 14, fontSize: "0.75rem", color: "#003366", fontWeight: 600 }}>
                  ระบบจะสร้างรหัสเข้าสู่ระบบอัตโนมัติหลังบันทึก
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
                <InputField label="รหัสสาขา *">
                  <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase().slice(0, 6) }))} placeholder="เช่น BKK" disabled={!!editTarget}
                    style={{ ...INPUT_STYLE, textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.06em", opacity: editTarget ? 0.6 : 1 }} />
                  {editTarget && <div style={{ fontSize: "0.66rem", color: "#6b7280", marginTop: 3 }}>แก้ไขรหัสไม่ได้</div>}
                </InputField>
                <InputField label="ชื่อสาขา *">
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Benjamin สาขา..." style={INPUT_STYLE} />
                </InputField>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <InputField label="ภาค">
                  <select value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))} style={{ ...INPUT_STYLE, cursor: "pointer" }}>
                    {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </InputField>
                <InputField label="เป้ายอดขาย (บาท/ปี)">
                  <input type="number" value={form.revenueTarget || ""} onChange={e => setForm(f => ({ ...f, revenueTarget: Number(e.target.value) || 0 }))} placeholder="0" style={INPUT_STYLE} />
                </InputField>
              </div>

              <InputField label="สถานะ">
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))} style={{ ...INPUT_STYLE, cursor: "pointer" }}>
                  <option value="active">เปิดใช้งาน</option>
                  <option value="inactive">ปิดใช้งาน</option>
                </select>
              </InputField>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
                <button onClick={() => setShowForm(false)} className="btn btn-secondary btn-md">ยกเลิก</button>
                <button onClick={save} className="btn btn-primary btn-md">
                  {editTarget ? "บันทึกการแก้ไข" : "สร้างสาขา"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── New Dealer Credentials Modal ── */}
      {credsModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.52)", zIndex: 1060, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ ...CARD, width: 400, maxWidth: "100%" }}>
            <div style={{ padding: "24px 20px 18px", textAlign: "center" }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#e5faf0", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                <Check size={22} color="#059669" />
              </div>
              <h3 style={{ margin: "0 0 4px", fontWeight: 800, color: "#2D2D2D" }}>สร้างสาขาสำเร็จ!</h3>
              <p style={{ fontSize: "0.8rem", color: "#6b7280", margin: 0 }}>{credsModal.name}</p>
            </div>
            <div style={{ padding: "0 20px 20px" }}>
              <div style={{ background: "#f0f4f8", border: "1px solid #e5e7eb", borderRadius: 10, padding: "14px 16px", marginBottom: 14 }}>
                <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>รหัสเข้าสู่ระบบสาขา</div>
                <CopyField label="อีเมล" value={credsModal.creds.email} />
                <CopyField label="รหัสผ่านเริ่มต้น" value={credsModal.creds.password} />
              </div>
              <div style={{ background: "#fef3cd", border: "1px solid #f59e0b30", borderRadius: 8, padding: "8px 12px", marginBottom: 16, fontSize: "0.73rem", color: "#f59e0b", fontWeight: 600 }}>
                แจ้งรหัสผ่านให้สาขาและแนะนำให้เปลี่ยนรหัสหลังเข้าครั้งแรก
              </div>
              <button onClick={() => setCredsModal(null)} className="btn btn-primary btn-md" style={{ width: "100%", justifyContent: "center" }}>
                รับทราบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Dealer Detail Drawer ── */}
      {selectedDealer && (() => {
        const d = selectedDealer;
        const revPct = d.revenueTarget > 0 ? Math.round(d.revenueActual / d.revenueTarget * 100) : 0;
        const revColor = revPct >= 100 ? "#059669" : revPct >= 75 ? "#003366" : revPct >= 50 ? "#f59e0b" : "#dc2626";
        const tier = revPct >= 90 && d.onTimePct >= 85
          ? { label: "สาขาดีเด่น", color: "#059669", bg: "#e5faf0" }
          : revPct >= 70 && d.onTimePct >= 70
          ? { label: "ผลงานดี", color: "#003366", bg: "#dce5f0" }
          : revPct >= 50
          ? { label: "กำลังพัฒนา", color: "#f59e0b", bg: "#fef3cd" }
          : { label: "ต้องปรับปรุง", color: "#dc2626", bg: "#fee2e2" };
        return (
          <>
            <div onClick={() => setSelectedDealer(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.3)", zIndex: 1040 }} />
            <div style={{ position: "fixed", top: 0, right: 0, width: 420, height: "100vh", background: "#fff", zIndex: 1050, boxShadow: "-4px 0 30px rgba(0,0,0,.12)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
              {/* Header */}
              <div style={{ padding: "20px", borderBottom: "1px solid #e5e7eb", background: "#f8f9fb" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 900, fontSize: "0.82rem", color: "#003366", background: "#dce5f0", padding: "3px 10px", borderRadius: 8, letterSpacing: "0.06em" }}>{d.code}</span>
                    <span className="badge" style={{ background: d.status === "active" ? "#e5faf0" : "#f0f0f5", color: d.status === "active" ? "#059669" : "#6b7280" }}>{d.status === "active" ? "ใช้งาน" : "ปิดใช้งาน"}</span>
                    <span className="badge" style={{ background: tier.bg, color: tier.color }}>{tier.label}</span>
                  </div>
                  <button onClick={() => setSelectedDealer(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", display: "flex" }}><X size={18} /></button>
                </div>
                <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#2D2D2D", marginBottom: 2 }}>{d.name}</div>
                <div style={{ fontSize: "0.73rem", color: "#6b7280" }}>ภาค{d.region}</div>
              </div>

              {/* Scrollable content */}
              <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>

                {/* Revenue card */}
                <div style={{ background: "#f8f9fb", border: "1px solid #e5e7eb", borderRadius: 12, padding: "14px 16px", marginBottom: 12 }}>
                  <div style={{ fontSize: "0.67rem", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>ยอดขายเทียบเป้าหมาย</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                    <span style={{ fontSize: "1.5rem", fontWeight: 800, color: revColor }}>฿{(d.revenueActual / 1_000_000).toFixed(1)}M</span>
                    <span style={{ fontSize: "0.76rem", color: "#6b7280" }}>เป้า ฿{(d.revenueTarget / 1_000_000).toFixed(0)}M</span>
                  </div>
                  <div style={{ height: 8, background: "#e5e7eb", borderRadius: 99, overflow: "hidden", marginBottom: 5 }}>
                    <div className="top5-bar" style={{ height: "100%", width: `${Math.min(revPct, 100)}%`, background: revColor, borderRadius: 99 }} />
                  </div>
                  <div style={{ fontSize: "0.72rem", fontWeight: 700, color: revColor }}>{revPct}% ของเป้าหมาย</div>
                </div>

                {/* 3 metrics */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
                  <div style={{ background: "#f8f9fb", border: "1px solid #e5e7eb", borderRadius: 12, padding: "12px", textAlign: "center" }}>
                    <div style={{ fontSize: "1.2rem", fontWeight: 800, color: d.winRate >= 40 ? "#059669" : d.winRate >= 25 ? "#f59e0b" : "#dc2626" }}>{d.winRate}%</div>
                    <div style={{ fontSize: "0.64rem", color: "#6b7280", fontWeight: 600, marginTop: 3 }}>อัตราปิดการขาย</div>
                  </div>
                  <div style={{ background: "#f8f9fb", border: "1px solid #e5e7eb", borderRadius: 12, padding: "12px", textAlign: "center" }}>
                    <div style={{ fontSize: "1.2rem", fontWeight: 800, color: d.onTimePct >= 85 ? "#059669" : d.onTimePct >= 70 ? "#f59e0b" : d.onTimePct === 0 ? "#C0C0C0" : "#dc2626" }}>{d.onTimePct === 0 ? "—" : `${d.onTimePct}%`}</div>
                    <div style={{ fontSize: "0.64rem", color: "#6b7280", fontWeight: 600, marginTop: 3 }}>ส่งตรงเวลา</div>
                  </div>
                  <div style={{ background: "#f8f9fb", border: "1px solid #e5e7eb", borderRadius: 12, padding: "12px", textAlign: "center" }}>
                    <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#003366" }}>{d.activeProjects}</div>
                    <div style={{ fontSize: "0.64rem", color: "#6b7280", fontWeight: 600, marginTop: 3 }}>โอกาสการขาย</div>
                  </div>
                </div>

                {/* Performance analysis */}
                <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "14px 16px", marginBottom: 12 }}>
                  <div style={{ fontSize: "0.67rem", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>วิเคราะห์ผลงาน</div>
                  {revPct < 50 && (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8, fontSize: "0.78rem", color: "#dc2626" }}>
                      <AlertTriangle size={14} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} /><span>ยอดขายต่ำกว่าเป้ามาก ควรติดตามโอกาสการขายและช่วยปิดการขายที่ค้าง</span>
                    </div>
                  )}
                  {revPct >= 50 && revPct < 75 && (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8, fontSize: "0.78rem", color: "#f59e0b" }}>
                      <BarChart2 size={14} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} /><span>ยอดขายอยู่ระดับกลาง — ยังมีช่องว่างถึงเป้าหมาย ควรเร่งผู้สนใจที่รอ</span>
                    </div>
                  )}
                  {revPct >= 75 && revPct < 100 && (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8, fontSize: "0.78rem", color: "#003366" }}>
                      <TrendingUp size={14} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} /><span>ยอดขายใกล้เป้าแล้ว — คาดว่าปิดได้ครบก่อนสิ้นไตรมาส</span>
                    </div>
                  )}
                  {revPct >= 100 && (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8, fontSize: "0.78rem", color: "#059669" }}>
                      <Trophy size={14} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} /><span>ถึงเป้าหมายแล้ว! ยอดขายเกินเป้า {revPct - 100}%</span>
                    </div>
                  )}
                  {d.onTimePct > 0 && d.onTimePct < 70 && (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8, fontSize: "0.78rem", color: "#dc2626" }}>
                      <Clock size={14} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} /><span>อัตราส่งตรงเวลาต่ำ ควรตรวจสอบโอกาสการขายที่ค้างคา</span>
                    </div>
                  )}
                  {d.winRate < 25 && (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8, fontSize: "0.78rem", color: "#f59e0b" }}>
                      <Target size={14} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} /><span>อัตราปิดการขายต่ำกว่าค่าเฉลี่ยเครือ — ควรพิจารณาฝึกสอนทีมขาย</span>
                    </div>
                  )}
                  {revPct >= 88 && d.onTimePct >= 85 && (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: "0.78rem", color: "#059669" }}>
                      <Award size={14} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} /><span>สาขาผลงานดีเด่น — สามารถใช้เป็นต้นแบบให้สาขาอื่นได้</span>
                    </div>
                  )}
                </div>

                {/* Credentials */}
                <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "14px 16px" }}>
                  <div style={{ fontSize: "0.67rem", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>ข้อมูลเข้าสู่ระบบ</div>
                  <CopyField label="อีเมล" value={d.credentials.email} />
                  <CopyField label="รหัสผ่าน" value={d.credentials.password} />
                </div>
              </div>

              {/* Footer */}
              <div style={{ padding: "14px 20px", borderTop: "1px solid #e5e7eb", display: "flex", gap: 8 }}>
                <button onClick={e => { e.stopPropagation(); enterDealer(d); }} disabled={entering === d.id}
                  className="btn btn-primary btn-md" style={{ flex: 1, justifyContent: "center", cursor: entering === d.id ? "not-allowed" : "pointer", opacity: entering === d.id ? 0.7 : 1 }}>
                  <LogIn size={14} /> {entering === d.id ? "กำลังเข้า..." : "เข้าระบบสาขา"}
                </button>
                <button onClick={e => { e.stopPropagation(); setSelectedDealer(null); openEdit(d); }}
                  className="btn btn-tint btn-md">
                  <Pencil size={14} /> แก้ไข
                </button>
              </div>
            </div>
          </>
        );
      })()}

      {/* ── View Credentials Modal ── */}
      {viewCredsDealer && (
        <div onClick={() => setViewCredsDealer(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.42)", zIndex: 1060, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ ...CARD, width: 380, maxWidth: "100%" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "0.96rem", fontWeight: 800, color: "#2D2D2D" }}>รหัสเข้าระบบ</h3>
                <div style={{ fontSize: "0.72rem", color: "#6b7280", marginTop: 2 }}>{viewCredsDealer.name}</div>
              </div>
              <button onClick={() => setViewCredsDealer(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", display: "flex" }}><X size={16} /></button>
            </div>
            <div style={{ padding: "16px 20px" }}>
              <CopyField label="อีเมล" value={viewCredsDealer.credentials.email} />
              <CopyField label="รหัสผ่าน" value={viewCredsDealer.credentials.password} />
              <div style={{ fontSize: "0.72rem", color: "#6b7280", background: "#f0f4f8", borderRadius: 8, padding: "8px 12px", marginTop: 4 }}>
                สาขาใช้อีเมลนี้เข้าสู่ระบบที่หน้าเข้าสู่ระบบของดีลเลอร์
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
