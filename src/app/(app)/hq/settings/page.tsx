"use client";

import { useState, useEffect } from "react";
import {
  ChevronUp, ChevronDown, Plus, Trash2, Check, Save,
  GitMerge, Building2, Shield, Target, Bell,
} from "lucide-react";
// หน้า ตั้งค่า แสดง "เนื้อหาจริงทั้งหมด" ในแท็บเลย — embed หน้าจัดการจริง ไม่ใช่การ์ดลิงก์
import HQCompanyPage from "../company/page";
import HQUsersPage from "../users/page";
import { usePersistentState } from "@/lib/usePersistentState";


// ─────────────────────────────────────────────────────────────────────────────
// 2. SALES JOURNEY
// ─────────────────────────────────────────────────────────────────────────────
type Stage  = { id: number; code: string; label: string; color: string; isDefault: boolean; locked: boolean; terminal?: "won" | "lost" };
type Reason = { id: number; label: string };

const STAGE_COLORS = ["#6b7280", "#d97706", "#003366", "#4338ca", "#059669", "#0ea5e9", "#0891b2", "#dc2626"];

const INIT_STAGES: Stage[] = [
  { id: 2, code: "WAITING",   label: "ติดต่อแล้ว",         color: "#475569", isDefault: true,  locked: false },
  { id: 7, code: "BULLET",    label: "รวบรวมความต้องการ", color: "#003366", isDefault: false, locked: false },
  { id: 3, code: "QUOTED",    label: "ใบเสนอราคา",       color: "#4338ca", isDefault: false, locked: false },
  { id: 8, code: "FOLLOWUP",  label: "ติดตามผล",         color: "#d97706", isDefault: false, locked: false },
  { id: 4, code: "NEGO",      label: "เจรจาต่อรอง",      color: "#b45309", isDefault: false, locked: false },
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

const HQ_JOURNEY_KEY = "hq_sales_journey";

function SalesJourneyTab() {
  const [stages,  setStages]  = useState<Stage[]>(INIT_STAGES);
  const [won,     setWon]     = useState<Reason[]>(INIT_WON);
  const [lost,    setLost]    = useState<Reason[]>(INIT_LOST);
  const [saved,   setSaved]   = useState(false);
  const [editId,  setEditId]  = useState<number | null>(null);
  const [editVal, setEditVal] = useState("");
  const [newWon,  setNewWon]  = useState("");
  const [newLost, setNewLost] = useState("");

  // โหลดค่าที่บันทึกไว้ (persist จริงผ่าน localStorage)
  useEffect(() => {
    const s = localStorage.getItem(HQ_JOURNEY_KEY);
    if (s) try { const d = JSON.parse(s); if (d.stages) setStages(d.stages); if (d.won) setWon(d.won); if (d.lost) setLost(d.lost); } catch {}
  }, []);
  function saveJourney() {
    localStorage.setItem(HQ_JOURNEY_KEY, JSON.stringify({ stages, won, lost }));
    setSaved(true); setTimeout(() => setSaved(false), 2500);
  }

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
          <div className="card-desc">กำหนดขั้นการขาย ลำดับขั้นตอน และเหตุผลปิดสำเร็จ / ไม่สำเร็จ สำหรับทุกตัวแทน</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={saveJourney}>
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
// เป้าหมายการขาย (HQ) — เป้ารายปีของเครือ + เกณฑ์คุณภาพ (persist จริง)
// ─────────────────────────────────────────────────────────────────────────────
type HQTargets = { annualTarget: number; winRateTarget: number; onTimeTarget: number };
const DEFAULT_TARGETS: HQTargets = { annualTarget: 260_000_000, winRateTarget: 40, onTimeTarget: 85 };

function TargetsTab() {
  const [targets, setTargets] = usePersistentState<HQTargets>("hq_targets", DEFAULT_TARGETS);
  const [draft, setDraft] = useState<HQTargets>(targets);
  const [saved, setSaved] = useState(false);
  useEffect(() => { setDraft(targets); }, [targets]);
  function save() { setTargets(draft); setSaved(true); setTimeout(() => setSaved(false), 2500); }

  const fields: { key: keyof HQTargets; label: string; desc: string; unit: string; step: number }[] = [
    { key: "annualTarget",  label: "เป้ายอดขายรวมทั้งเครือ (รายปี)", desc: "ใช้เทียบกับยอดสะสมจริงบนแดชบอร์ด HQ", unit: "บาท", step: 1_000_000 },
    { key: "winRateTarget", label: "เป้าอัตราปิดการขายเฉลี่ย",       desc: "เกณฑ์ขั้นต่ำที่ตัวแทนควรทำได้",          unit: "%",   step: 1 },
    { key: "onTimeTarget",  label: "เป้าติดตามตรงเวลา",              desc: "สัดส่วนงานติดตามที่ทำภายในกำหนด",       unit: "%",   step: 1 },
  ];

  return (
    <>
      <div className="card-header">
        <div>
          <div className="card-title">เป้าหมายการขาย</div>
          <div className="card-desc">กำหนดเป้าระดับเครือ — เป้ารายตัวแทนตั้งได้ที่หน้า ตัวแทน (แก้ไขรายตัว)</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={save}>
          {saved ? <><Check size={13} /> บันทึกแล้ว</> : <><Save size={13} /> บันทึก</>}
        </button>
      </div>
      <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {fields.map(f => (
          <div key={f.key} style={{ display: "flex", alignItems: "center", gap: 14, border: "1px solid #e5e7eb", borderRadius: 12, padding: "12px 16px" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "0.84rem", fontWeight: 700, color: "#2D2D2D" }}>{f.label}</div>
              <div style={{ fontSize: "0.72rem", color: "#6b7280", marginTop: 2 }}>{f.desc}</div>
            </div>
            <input type="number" step={f.step} value={draft[f.key]}
              onChange={e => setDraft(d => ({ ...d, [f.key]: Number(e.target.value) }))}
              className="form-input" style={{ width: 170, textAlign: "right", fontWeight: 700 }} />
            <span style={{ fontSize: "0.76rem", color: "#6b7280", width: 34 }}>{f.unit}</span>
          </div>
        ))}
        <div style={{ fontSize: "0.72rem", color: "#9ca3af" }}>
          เป้ายอดขายรายปีปัจจุบัน: ฿{(draft.annualTarget / 1_000_000).toFixed(0)}M · ระบบใช้ค่านี้แสดง % ความคืบหน้าบนแดชบอร์ด
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// การแจ้งเตือน (HQ) — เปิด/ปิดเหตุการณ์ที่ต้องการรับแจ้ง (persist จริง)
// ─────────────────────────────────────────────────────────────────────────────
type NotifyPrefs = Record<string, boolean>;
const NOTIFY_ITEMS: { key: string; label: string; desc: string }[] = [
  { key: "newQuote",    label: "ใบเสนอราคาใหม่จากตัวแทน",       desc: "แจ้งทันทีเมื่อตัวแทนออกใบเสนอราคาใหม่" },
  { key: "won",         label: "ปิดการขายสำเร็จ",                desc: "แจ้งเมื่อตัวแทนปิดการขายได้" },
  { key: "belowTarget", label: "ตัวแทนต่ำกว่าเป้า",              desc: "แจ้งเมื่อยอดสะสมของตัวแทนต่ำกว่า 50% ของเป้า" },
  { key: "expiring",    label: "ใบเสนอราคาใกล้หมดอายุ",          desc: "แจ้งล่วงหน้า 7 วันก่อนใบเสนอราคาหมดอายุ" },
  { key: "weekly",      label: "สรุปผลงานรายสัปดาห์ (อีเมล)",    desc: "ส่งสรุปยอดขายทุกตัวแทนทางอีเมลทุกวันจันทร์" },
];
const DEFAULT_NOTIFY: NotifyPrefs = { newQuote: true, won: true, belowTarget: true, expiring: true, weekly: false };

function NotificationsTab() {
  const [prefs, setPrefs] = usePersistentState<NotifyPrefs>("hq_notifications", DEFAULT_NOTIFY);
  return (
    <>
      <div className="card-header">
        <div>
          <div className="card-title">การแจ้งเตือน</div>
          <div className="card-desc">เลือกเหตุการณ์ที่ต้องการรับแจ้งเตือน — บันทึกอัตโนมัติทันทีที่สลับ</div>
        </div>
      </div>
      <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {NOTIFY_ITEMS.map(item => {
          const on = prefs[item.key] ?? false;
          return (
            <div key={item.key} style={{ display: "flex", alignItems: "center", gap: 14, border: "1px solid #e5e7eb", borderRadius: 12, padding: "12px 16px" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.84rem", fontWeight: 700, color: "#2D2D2D" }}>{item.label}</div>
                <div style={{ fontSize: "0.72rem", color: "#6b7280", marginTop: 2 }}>{item.desc}</div>
              </div>
              <button role="switch" aria-checked={on}
                onClick={() => setPrefs(p => ({ ...p, [item.key]: !on }))}
                style={{ width: 42, height: 24, borderRadius: 99, border: "none", cursor: "pointer", flexShrink: 0,
                  background: on ? "#003366" : "#d1d5db", position: "relative", transition: "background .15s" }}>
                <span style={{ position: "absolute", top: 3, left: on ? 21 : 3, width: 18, height: 18, borderRadius: "50%",
                  background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.25)", transition: "left .15s" }} />
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT PAGE — ตั้งค่า HQ ศูนย์รวมงานบริหาร: ทุกแท็บแสดง "เนื้อหาจริงทั้งหมด" ในหน้านี้เลย
// (embed หน้าจัดการจริง — ไม่มีการ์ดลิงก์ให้คลิกต่อ)
// ─────────────────────────────────────────────────────────────────────────────
// ตัวแทน/แม่แบบ ไม่อยู่ในแท็บ — มีหน้าจัดการของตัวเองในเมนูหลักแล้ว (ไม่ทำซ้ำ 2 ที่)
type HQSettingTab = "company" | "users" | "sales-journey" | "targets" | "notifications";

const TABS: { key: HQSettingTab; label: string; icon: React.ReactNode }[] = [
  { key: "company",       label: "บริษัท",           icon: <Building2 size={15} /> },
  { key: "users",         label: "ผู้ใช้งาน",        icon: <Shield    size={15} /> },
  { key: "sales-journey", label: "เส้นทางการขาย",   icon: <GitMerge  size={15} /> },
  { key: "targets",       label: "เป้าหมายการขาย",  icon: <Target    size={15} /> },
  { key: "notifications", label: "การแจ้งเตือน",     icon: <Bell      size={15} /> },
];

export default function HQSettingsPage() {
  const [activeTab, setActiveTab] = useState<HQSettingTab>("company");

  return (
    <div className="erp">
      <div className="page-head">
        <div>
          <h2>ตั้งค่า</h2>
          <p>ศูนย์รวมงานบริหารของเครือ — จัดการได้ครบทุกส่วนในหน้านี้</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="tab-bar">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`tab-item${activeTab === t.key ? " active" : ""}`}
              style={{ display: "flex", alignItems: "center", gap: 7, fontSize: "0.85rem", padding: "12px 16px" }}>
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* เนื้อหาเต็มของแต่ละส่วน — แสดงในหน้านี้เลย */}
      {activeTab === "company"       && <HQCompanyPage />}
      {activeTab === "users"         && <HQUsersPage />}
      {activeTab === "sales-journey" && <div className="card"><SalesJourneyTab /></div>}
      {activeTab === "targets"       && <div className="card"><TargetsTab /></div>}
      {activeTab === "notifications" && <div className="card"><NotificationsTab /></div>}
    </div>
  );
}
