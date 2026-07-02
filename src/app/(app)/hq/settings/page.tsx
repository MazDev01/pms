"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  GitMerge, Store, Package, Building2, Shield,
  ChevronUp, ChevronDown, Plus, Trash2, Upload, Check, Save,
  Lock, ArrowRight,
} from "lucide-react";
import { dealerLeaderboard } from "@/lib/mock";

type HQSettingTab = "company" | "users" | "dealers" | "products" | "sales-journey";

const TABS: { key: HQSettingTab; label: string; icon: React.ReactNode }[] = [
  { key: "company",       label: "บริษัท",          icon: <Building2 size={15} /> },
  { key: "users",         label: "ผู้ใช้งาน",       icon: <Shield    size={15} /> },
  { key: "dealers",       label: "ตัวแทนจำหน่าย",   icon: <Store     size={15} /> },
  { key: "products",      label: "สินค้า",          icon: <Package   size={15} /> },
  { key: "sales-journey", label: "เส้นทางการขาย",   icon: <GitMerge  size={15} /> },
];

const HQ_PROFILE_KEY = "hq_company_profile";
const HQ_LOGO_KEY    = "hq_company_logo";

// ─────────────────────────────────────────────────────────────────────────────
// COMPANY (ข้อมูลบริษัท Benjamin HQ)
// ─────────────────────────────────────────────────────────────────────────────
type CompanyProfile = { name: string; address: string; phone: string; email: string; website: string; taxId: string };
const PROFILE_DEFAULT: CompanyProfile = {
  name: "บริษัท เบนจามิน พรี-เอนจิเนียร์ บิลดิ้ง จำกัด",
  address: "123 ถ.รัชดาภิเษก แขวงห้วยขวาง เขตห้วยขวาง กรุงเทพมหานคร 10310",
  phone: "02-XXX-XXXX", email: "info@benjamin.co.th",
  website: "www.benjamin.co.th", taxId: "0105XXXXXXXXX",
};

function CompanyTab() {
  const [form,  setForm]  = useState<CompanyProfile>(PROFILE_DEFAULT);
  const [logo,  setLogo]  = useState("");
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const s = localStorage.getItem(HQ_PROFILE_KEY);
    if (s) try { setForm({ ...PROFILE_DEFAULT, ...JSON.parse(s) }); } catch {}
    const l = localStorage.getItem(HQ_LOGO_KEY);
    if (l) setLogo(l);
  }, []);

  function set<K extends keyof CompanyProfile>(k: K, v: CompanyProfile[K]) {
    setForm(p => ({ ...p, [k]: v }));
    setSaved(false);
  }
  function save() {
    localStorage.setItem(HQ_PROFILE_KEY, JSON.stringify(form));
    if (logo) localStorage.setItem(HQ_LOGO_KEY, logo);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }
  function uploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { setLogo(ev.target?.result as string); setSaved(false); };
    reader.readAsDataURL(file);
  }
  const initials = form.name.trim().slice(0, 2).toUpperCase() || "BJ";

  return (
    <>
      <div className="card-header">
        <div>
          <div className="card-title">ข้อมูลบริษัท</div>
          <div className="card-desc">ข้อมูลองค์กรของเบนจามิน HQ สำหรับใช้อ้างอิงในเอกสารและระบบ</div>
        </div>
      </div>
      <div className="card-body">

        {/* Logo */}
        <div style={{ marginBottom: 24 }}>
          <label className="form-label">โลโก้บริษัท</label>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 80, height: 80, borderRadius: 12, flexShrink: 0,
              background: logo ? "transparent" : "#003366",
              border: "2px dashed #e5e7eb",
              display: "flex", alignItems: "center", justifyContent: "center",
              overflow: "hidden",
            }}>
              {logo
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={logo} alt="logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                : <span style={{ color: "#fff", fontWeight: 900, fontSize: "1.1rem" }}>{initials}</span>}
            </div>
            <div>
              <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>
                <Upload size={13} /> อัปโหลดโลโก้
              </button>
              {logo && (
                <button className="btn btn-ghost btn-sm" style={{ marginLeft: 6 }}
                  onClick={() => { setLogo(""); localStorage.removeItem(HQ_LOGO_KEY); }}>
                  ลบ
                </button>
              )}
              <div style={{ fontSize: "0.68rem", color: "#9ca3af", marginTop: 5 }}>PNG, JPG · แนะนำ 400×400 px</div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={uploadLogo} />
            </div>
          </div>
        </div>

        {/* Fields */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <div style={{ gridColumn: "1/-1" }}>
            <label className="form-label">ชื่อบริษัท (ภาษาไทย)</label>
            <input className="form-input" value={form.name} onChange={e => set("name", e.target.value)} />
          </div>
          <div>
            <label className="form-label">เลขประจำตัวผู้เสียภาษี</label>
            <input className="form-input" value={form.taxId} onChange={e => set("taxId", e.target.value)} placeholder="0105XXXXXXXXX" />
          </div>
          <div>
            <label className="form-label">โทรศัพท์</label>
            <input className="form-input" value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="02-000-0000" />
          </div>
          <div>
            <label className="form-label">อีเมล</label>
            <input className="form-input" value={form.email} onChange={e => set("email", e.target.value)} placeholder="info@example.co.th" />
          </div>
          <div>
            <label className="form-label">เว็บไซต์</label>
            <input className="form-input" value={form.website} onChange={e => set("website", e.target.value)} placeholder="www.example.co.th" />
          </div>
        </div>
        <div style={{ marginBottom: 28 }}>
          <label className="form-label">ที่อยู่</label>
          <textarea className="form-textarea" value={form.address} rows={3}
            onChange={e => set("address", e.target.value)}
            placeholder="ที่อยู่เต็ม รวมจังหวัดและรหัสไปรษณีย์"
            style={{ resize: "vertical" }} />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", borderTop: "1px solid #f1f5f9", paddingTop: 16 }}>
          <button className="btn btn-primary btn-md" onClick={save}>
            {saved ? <><Check size={14} /> บันทึกแล้ว</> : <><Save size={14} /> บันทึก</>}
          </button>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. SALES JOURNEY
// ─────────────────────────────────────────────────────────────────────────────
type Stage  = { id: number; code: string; label: string; color: string; isDefault: boolean; locked: boolean; terminal?: "won" | "lost" };
type Reason = { id: number; label: string };

const STAGE_COLORS = ["#6b7280", "#d97706", "#003366", "#7c3aed", "#059669", "#0ea5e9", "#ec4899", "#dc2626"];

const INIT_STAGES: Stage[] = [
  { id: 1, code: "NEW",       label: "ลีดใหม่",          color: "#6b7280", isDefault: true,  locked: false },
  { id: 2, code: "WAITING",   label: "รวบรวมความต้องการ", color: "#d97706", isDefault: false, locked: false },
  { id: 3, code: "QUOTED",    label: "ใบเสนอราคา",       color: "#7c3aed", isDefault: false, locked: false },
  { id: 4, code: "BULLET",    label: "เจรจาต่อรอง",      color: "#003366", isDefault: false, locked: false },
  { id: 5, code: "PAID",      label: "ปิดการขาย",        color: "#059669", isDefault: false, locked: true, terminal: "won"  },
  { id: 6, code: "CANCELLED", label: "ไม่สำเร็จ",        color: "#dc2626", isDefault: false, locked: true, terminal: "lost" },
];
const INIT_WON:  Reason[] = [
  { id: 1, label: "ราคาดีที่สุดในตลาด" }, { id: 2, label: "คุณภาพสินค้าสูง" },
  { id: 3, label: "บริการดี / ไว้วางใจ" }, { id: 4, label: "ความสัมพันธ์ที่ดี" },
];
const INIT_LOST: Reason[] = [
  { id: 1, label: "ราคาสูงเกินงบประมาณ" }, { id: 2, label: "คู่แข่งให้ข้อเสนอดีกว่า" },
  { id: 3, label: "ลูกค้ายกเลิกการสั่งซื้อ" }, { id: 4, label: "งบประมาณไม่พร้อม" },
  { id: 5, label: "ลูกค้าไม่ตอบสนอง" },
];

function SalesJourneyTab() {
  const [stages,  setStages]  = useState<Stage[]>(INIT_STAGES);
  const [won,     setWon]     = useState<Reason[]>(INIT_WON);
  const [lost,    setLost]    = useState<Reason[]>(INIT_LOST);
  const [saved,   setSaved]   = useState(false);
  const [editId,  setEditId]  = useState<number | null>(null);
  const [editVal, setEditVal] = useState("");
  const [newWon,  setNewWon]  = useState("");
  const [newLost, setNewLost] = useState("");

  const active   = stages.filter(s => !s.locked);
  const terminal = stages.filter(s =>  s.locked);

  function move(id: number, dir: -1 | 1) {
    setStages(prev => {
      const arr = [...prev.filter(s => !s.locked)];
      const i = arr.findIndex(s => s.id === id);
      const j = i + dir;
      if (j < 0 || j >= arr.length) return prev;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return [...arr, ...prev.filter(s => s.locked)];
    });
  }
  function setColor(id: number, color: string) {
    setStages(p => p.map(s => s.id === id ? { ...s, color } : s));
  }
  function setDefault(id: number) {
    setStages(p => p.map(s => ({ ...s, isDefault: s.id === id })));
  }
  function commitEdit(id: number) {
    if (editVal.trim()) setStages(p => p.map(s => s.id === id ? { ...s, label: editVal.trim() } : s));
    setEditId(null);
  }
  function deleteStage(id: number) {
    setStages(prev => {
      const next = prev.filter(s => s.id !== id);
      if (!next.some(s => s.isDefault && !s.locked)) {
        const first = next.find(s => !s.locked);
        if (first) return next.map(s => ({ ...s, isDefault: s.id === first.id }));
      }
      return next;
    });
  }
  function addStage() {
    const id = Date.now();
    setStages(prev => [
      ...prev.filter(s => !s.locked),
      { id, code: `S${id}`, label: "ขั้นการขายใหม่", color: "#6b7280", isDefault: false, locked: false },
      ...prev.filter(s => s.locked),
    ]);
    setEditId(id); setEditVal("ขั้นการขายใหม่");
  }
  function addReason(type: "won" | "lost") {
    const label = (type === "won" ? newWon : newLost).trim();
    if (!label) return;
    const item = { id: Date.now(), label };
    if (type === "won") { setWon(p => [...p, item]); setNewWon(""); }
    else                { setLost(p => [...p, item]); setNewLost(""); }
  }

  return (
    <>
      <div className="card-header">
        <div>
          <div className="card-title">เส้นทางการขาย</div>
          <div className="card-desc">กำหนดขั้นการขาย ลำดับขั้นตอน และเหตุผลปิดสำเร็จ / ไม่สำเร็จ สำหรับทุกสาขา</div>
        </div>
        <button className="btn btn-primary btn-sm"
          onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2500); }}>
          {saved ? <><Check size={13} /> บันทึกแล้ว</> : <><Save size={13} /> บันทึก</>}
        </button>
      </div>

      <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Stage list */}
        <div>
          <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "#003366", letterSpacing: "0.05em",
            textTransform: "uppercase", marginBottom: 12 }}>
            ขั้นการขาย
          </div>
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", marginBottom: 8 }}>
            {active.map((s, idx) => (
              <div key={s.id} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                background: "#fff",
                borderBottom: idx < active.length - 1 ? "1px solid #f1f5f9" : "none",
              }}>
                {/* Reorder */}
                <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
                  <button onClick={() => move(s.id, -1)} disabled={idx === 0}
                    className="btn btn-ghost btn-sm"
                    style={{ width: 22, height: 22, padding: 0, opacity: idx === 0 ? 0.25 : 1,
                      display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <ChevronUp size={12} />
                  </button>
                  <button onClick={() => move(s.id, 1)} disabled={idx === active.length - 1}
                    className="btn btn-ghost btn-sm"
                    style={{ width: 22, height: 22, padding: 0, opacity: idx === active.length - 1 ? 0.25 : 1,
                      display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <ChevronDown size={12} />
                  </button>
                </div>

                {/* Step badge */}
                <div style={{
                  width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                  background: s.color + "20", color: s.color,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.66rem", fontWeight: 800,
                }}>
                  {idx + 1}
                </div>

                {/* Color swatches */}
                <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                  {STAGE_COLORS.map(c => (
                    <button key={c} onClick={() => setColor(s.id, c)} style={{
                      width: 12, height: 12, borderRadius: "50%", background: c,
                      border: "none", cursor: "pointer", padding: 0,
                      outline: s.color === c ? `2.5px solid ${c}` : "none",
                      outlineOffset: 1.5,
                    }} />
                  ))}
                </div>

                {/* Label — click to edit */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {editId === s.id
                    ? <input autoFocus value={editVal}
                        className="form-input"
                        style={{ padding: "4px 8px" }}
                        onChange={e => setEditVal(e.target.value)}
                        onBlur={() => commitEdit(s.id)}
                        onKeyDown={e => { if (e.key === "Enter") commitEdit(s.id); if (e.key === "Escape") setEditId(null); }} />
                    : <span onClick={() => { setEditId(s.id); setEditVal(s.label); }}
                        style={{ fontSize: "0.85rem", fontWeight: 600, color: "#2D2D2D",
                          cursor: "text", borderBottom: "1.5px dashed transparent",
                          display: "inline-block", paddingBottom: 1 }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderBottomColor = "#e2e8f0"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderBottomColor = "transparent"; }}>
                        {s.label}
                      </span>}
                </div>

                {/* Default */}
                <button onClick={() => setDefault(s.id)}
                  className="badge"
                  style={{ cursor: "pointer", border: `1px solid ${s.isDefault ? "#003366" : "#e2e8f0"}`,
                    background: s.isDefault ? "#f0f4fa" : "transparent",
                    color: s.isDefault ? "#003366" : "#9ca3af", fontFamily: "inherit",
                    fontWeight: 700, fontSize: "0.67rem", letterSpacing: "0.02em" }}>
                  {s.isDefault ? "✓ ค่าเริ่มต้น" : "ตั้งเป็นค่าเริ่มต้น"}
                </button>

                {/* Delete */}
                {active.length > 1 && (
                  <button className="btn btn-danger btn-sm"
                    style={{ width: 28, height: 28, padding: 0,
                      display: "flex", alignItems: "center", justifyContent: "center" }}
                    onClick={() => deleteStage(s.id)}>
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Terminal (locked) stages */}
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            {terminal.map(s => (
              <div key={s.id} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
                borderRadius: 10, flex: 1,
                background: s.terminal === "won" ? "#f0fdf4" : "#fff5f5",
                border: `1px solid ${s.terminal === "won" ? "#bbf7d0" : "#fecaca"}`,
              }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.color }} />
                <span style={{ flex: 1, fontSize: "0.82rem", fontWeight: 700,
                  color: s.terminal === "won" ? "#059669" : "#dc2626" }}>
                  {s.label}
                </span>
                <span className="badge" style={{
                  background: s.terminal === "won" ? "#dcfce7" : "#fee2e2",
                  color: s.terminal === "won" ? "#059669" : "#dc2626",
                  border: "none",
                }}>
                  {s.terminal === "won" ? "ปิดสำเร็จ" : "ไม่สำเร็จ"}
                </span>
              </div>
            ))}
          </div>

          {/* Add stage */}
          <button onClick={addStage} style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "9px 14px", borderRadius: 10, width: "100%",
            border: "1.5px dashed #e5e7eb", background: "transparent",
            cursor: "pointer", color: "#6b7280", fontSize: "0.82rem", fontWeight: 600,
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#003366"; (e.currentTarget as HTMLElement).style.color = "#003366"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#e5e7eb"; (e.currentTarget as HTMLElement).style.color = "#6b7280"; }}>
            <Plus size={14} /> เพิ่มขั้นการขาย
          </button>
        </div>

        {/* Won / Lost reasons */}
        <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 20 }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "#003366", letterSpacing: "0.05em",
            textTransform: "uppercase", marginBottom: 16 }}>
            เหตุผลปิดสำเร็จ และ ไม่สำเร็จ
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            {(["won", "lost"] as const).map(type => {
              const items    = type === "won" ? won  : lost;
              const setItems = type === "won" ? setWon : setLost;
              const newVal   = type === "won" ? newWon : newLost;
              const setNew   = type === "won" ? setNewWon : setNewLost;
              const accent   = type === "won" ? "#059669" : "#dc2626";
              const lightBg  = type === "won" ? "#f0fdf4" : "#fff5f5";
              const lightBdr = type === "won" ? "#bbf7d0" : "#fecaca";
              return (
                <div key={type}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: accent }} />
                    <span style={{ fontSize: "0.75rem", fontWeight: 800, color: accent }}>
                      {type === "won" ? "เหตุผลปิดการขายสำเร็จ" : "เหตุผลไม่สำเร็จ"}
                    </span>
                  </div>
                  <div style={{ border: `1px solid ${lightBdr}`, borderRadius: 10, overflow: "hidden", marginBottom: 8 }}>
                    {items.map((r, idx) => (
                      <div key={r.id} style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "9px 12px", background: lightBg,
                        borderBottom: idx < items.length - 1 ? `1px solid ${lightBdr}` : "none",
                      }}>
                        <span style={{ flex: 1, fontSize: "0.8rem", color: "#2D2D2D" }}>{r.label}</span>
                        <button onClick={() => setItems(p => p.filter(x => x.id !== r.id))}
                          style={{ background: "none", border: "none", cursor: "pointer",
                            color: accent, opacity: 0.5, display: "flex", alignItems: "center", padding: 2 }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                    {items.length === 0 && (
                      <div style={{ padding: "16px", textAlign: "center", fontSize: "0.75rem", color: "#9ca3af" }}>
                        ยังไม่มีเหตุผล
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input value={newVal} onChange={e => setNew(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") addReason(type); }}
                      placeholder="เพิ่มเหตุผล..."
                      className="form-input"
                      style={{ flex: 1 }} />
                    <button onClick={() => addReason(type)}
                      className="btn btn-primary btn-sm"
                      style={{ flexShrink: 0 }}>
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT PAGE
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// Shared bits
// ─────────────────────────────────────────────────────────────────────────────
function StatBox({ value, label, tone = "#003366" }: { value: React.ReactNode; label: string; tone?: string }) {
  return (
    <div style={{
      flex: 1, minWidth: 120, padding: "16px 18px", borderRadius: 14,
      border: "1px solid #eef1f5", background: "#fafbfc",
    }}>
      <div style={{ fontSize: "1.6rem", fontWeight: 900, color: tone, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: "0.74rem", color: "#6b7280", marginTop: 3 }}>{label}</div>
    </div>
  );
}

function CapabilityChips({ items }: { items: string[] }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {items.map(c => (
        <span key={c} style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "6px 12px", borderRadius: 99, background: "#f0f4fa",
          border: "1px solid #dce5f0", fontSize: "0.74rem", fontWeight: 600, color: "#003366",
        }}>
          <Check size={12} /> {c}
        </span>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. DEALER MANAGEMENT (overview → ลิงก์หน้าจัดการเต็ม)
// ─────────────────────────────────────────────────────────────────────────────
// แท็บลิงก์ไปหน้าจัดการเต็ม (ใช้ร่วมกับ บริษัท / ผู้ใช้งาน / เทมเพลต)
function LinkTab({ title, desc, items, icon, panelTitle, panelDesc, href }: {
  title: string; desc: string; items: string[]; icon: React.ReactNode;
  panelTitle: string; panelDesc: string; href: string;
}) {
  return (
    <>
      <div className="card-header">
        <div>
          <div className="card-title">{title}</div>
          <div className="card-desc">{desc}</div>
        </div>
      </div>
      <div className="card-body">
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "#003366", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 12 }}>
            สิ่งที่จัดการได้
          </div>
          <CapabilityChips items={items} />
        </div>
        <div style={{
          marginTop: 22, padding: "18px 20px", borderRadius: 14,
          border: "1px solid #dce5f0", background: "#f7f9fc",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "#003366", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {icon}
            </div>
            <div>
              <div style={{ fontSize: "0.9rem", fontWeight: 800, color: "#2D2D2D" }}>{panelTitle}</div>
              <div style={{ fontSize: "0.74rem", color: "#6b7280", marginTop: 2 }}>{panelDesc}</div>
            </div>
          </div>
          <Link href={href} className="btn btn-primary btn-md" style={{ gap: 7 }}>
            เปิดหน้าจัดการ <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </>
  );
}

function DealerManagementTab() {
  const total    = dealerLeaderboard.length;
  const active   = dealerLeaderboard.filter(d => d.status === "active").length;
  const inactive = total - active;

  return (
    <>
      <div className="card-header">
        <div>
          <div className="card-title">จัดการตัวแทนจำหน่าย</div>
          <div className="card-desc">สร้าง แก้ไข เปิด/ปิดใช้งาน และดูแลความปลอดภัยบัญชีของตัวแทนทั้งเครือข่าย</div>
        </div>
      </div>
      <div className="card-body">
        {/* สรุปจำนวน */}
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 24 }}>
          <StatBox value={total} label="ตัวแทนทั้งหมด" />
          <StatBox value={active} label="กำลังใช้งาน" tone="#059669" />
          <StatBox value={inactive} label="ปิดใช้งาน" tone="#9ca3af" />
        </div>

        {/* ความสามารถ */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "#003366", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 12 }}>
            สิ่งที่จัดการได้
          </div>
          <CapabilityChips items={["สร้างตัวแทน", "แก้ไขข้อมูล", "เปิด/ปิดใช้งาน", "ลบตัวแทน", "รีเซ็ตรหัสผ่าน", "ล็อก/ปลดล็อกบัญชี"]} />
        </div>

        {/* ลิงก์หน้าจัดการเต็ม */}
        <div style={{
          marginTop: 22, padding: "18px 20px", borderRadius: 14,
          border: "1px solid #dce5f0", background: "#f7f9fc",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "#003366", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Store size={20} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: "0.9rem", fontWeight: 800, color: "#2D2D2D" }}>หน้าจัดการตัวแทนเต็มรูปแบบ</div>
              <div style={{ fontSize: "0.74rem", color: "#6b7280", marginTop: 2 }}>ตาราง ค้นหา ฟอร์มสร้าง/แก้ไข และเครื่องมือความปลอดภัยบัญชี</div>
            </div>
          </div>
          <Link href="/hq/dealers" className="btn btn-primary btn-md" style={{ gap: 7 }}>
            เปิดหน้าจัดการ <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. PRODUCT CATALOG (overview → ลิงก์หน้าแคตตาล็อกเต็ม)
// ─────────────────────────────────────────────────────────────────────────────
const PRODUCT_LINES = [
  { code: "EASYBUILD", label: "EASYBUILD", desc: "อาคารสำเร็จรูปมาตรฐาน พร้อมใช้งานไว", tone: "#003366" },
  { code: "RANBUILD",  label: "RANBUILD",  desc: "โครงสร้างเหล็กสำหรับโรงงาน/คลังสินค้า", tone: "#0284c7" },
  { code: "PREFAB",    label: "PREFAB",    desc: "อาคารพรีแฟบ สำนักงาน/อาคารเฉพาะกิจ", tone: "#7c3aed" },
];

function ProductCatalogTab() {
  return (
    <>
      <div className="card-header">
        <div>
          <div className="card-title">แคตตาล็อกสินค้า</div>
          <div className="card-desc">มาตรฐานสินค้าและราคากลางของเบนจามิน ที่ตัวแทนทุกสาขาใช้อ้างอิง</div>
        </div>
      </div>
      <div className="card-body">
        {/* สายผลิตภัณฑ์ */}
        <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "#003366", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 12 }}>
          สายผลิตภัณฑ์หลัก
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 22 }}>
          {PRODUCT_LINES.map(p => (
            <div key={p.code} style={{ padding: "16px 18px", borderRadius: 14, border: "1px solid #eef1f5", background: "#fafbfc" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: p.tone }} />
                <span style={{ fontSize: "0.86rem", fontWeight: 800, color: p.tone, letterSpacing: "0.02em" }}>{p.label}</span>
              </div>
              <div style={{ fontSize: "0.76rem", color: "#6b7280", lineHeight: 1.5 }}>{p.desc}</div>
            </div>
          ))}
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "#003366", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 12 }}>
            สิ่งที่จัดการได้
          </div>
          <CapabilityChips items={["ชื่อสินค้า", "หมวดหมู่", "รายละเอียด", "รูปภาพ", "ราคากลาง", "สถานะการขาย"]} />
        </div>

        {/* ลิงก์หน้าแคตตาล็อกเต็ม */}
        <div style={{
          marginTop: 22, padding: "18px 20px", borderRadius: 14,
          border: "1px solid #dce5f0", background: "#f7f9fc",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "#003366", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Package size={20} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: "0.9rem", fontWeight: 800, color: "#2D2D2D" }}>หน้าแคตตาล็อกสินค้าเต็มรูปแบบ</div>
              <div style={{ fontSize: "0.74rem", color: "#6b7280", marginTop: 2 }}>รายการสินค้า ราคากลาง ระยะเวลารอสินค้า และการจัดการสถานะ</div>
            </div>
          </div>
          <Link href="/hq/master" className="btn btn-primary btn-md" style={{ gap: 7 }}>
            เปิดแคตตาล็อก <ArrowRight size={15} />
          </Link>
        </div>

        <div style={{ marginTop: 16, fontSize: "0.72rem", color: "#9ca3af", display: "flex", alignItems: "center", gap: 6 }}>
          <Lock size={12} /> ตัวแทนไม่สามารถแก้ไขสินค้าหรือราคากลางได้ — กำหนดโดย HQ เท่านั้น
        </div>
      </div>
    </>
  );
}

export default function HQSettingsPage() {
  const [activeTab, setActiveTab] = useState<HQSettingTab>("company");

  return (
    <div className="erp">
      <div className="page-head">
        <div>
          <h2>ตั้งค่า</h2>
          <p>ศูนย์ควบคุมงานบริหารธุรกิจของเบนจามิน · จัดการตัวแทน · สินค้า · เส้นทางการขาย · บริษัท</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="tab-bar">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`tab-item${activeTab === t.key ? " active" : ""}`}
              style={{ display: "flex", alignItems: "center", gap: 7 }}>
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content card */}
      <div className="card">
        {activeTab === "dealers"       && <DealerManagementTab />}
        {activeTab === "products"      && <ProductCatalogTab />}
        {activeTab === "sales-journey" && <SalesJourneyTab />}
        {activeTab === "company"       && (
          <LinkTab title="บริษัท" desc="ข้อมูลบริษัทเบนจามินและสินทรัพย์แบรนด์"
            items={["ข้อมูลบริษัท", "โลโก้", "ที่อยู่ / เลขภาษี", "สี CI / ฟอนต์", "สาขา"]}
            icon={<Building2 size={20} color="#fff" />}
            panelTitle="หน้าบริษัทและสินทรัพย์แบรนด์" panelDesc="ข้อมูลองค์กร โลโก้ สี CI ฟอนต์ และรายชื่อสาขา"
            href="/hq/company" />
        )}
        {activeTab === "users"         && (
          <LinkTab title="ผู้ใช้งาน" desc="จัดการผู้ใช้ บทบาท และสิทธิ์การเข้าถึง"
            items={["ผู้ใช้งาน", "บทบาท 4 ระดับ", "สิทธิ์ CRUD", "Role-based access"]}
            icon={<Shield size={20} color="#fff" />}
            panelTitle="หน้าจัดการผู้ใช้และสิทธิ์" panelDesc="ตารางผู้ใช้ บทบาท และเมทริกซ์สิทธิ์ตามโมดูล"
            href="/hq/users" />
        )}
      </div>
    </div>
  );
}
