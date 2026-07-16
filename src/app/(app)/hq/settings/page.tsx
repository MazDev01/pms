"use client";

// ─── HQ · ตั้งค่า (Enterprise Administration) ──────────────────────────────────
// แท็บแนวนอน 7 หัวข้อตามพิมพ์เขียว Benjamin PMS (เลย์เอาต์เดียวกับหน้าตั้งค่าตัวแทน /settings):
//   บริษัท · ผู้ใช้งานและสิทธิ์ · เส้นทางการขาย · ตัวแทนจำหน่าย · เป้าหมายยอดขาย · กฎธุรกิจ · การแจ้งเตือน
// ตัวแทนไม่มีสิทธิ์เข้าหน้านี้ · ทุกอย่างชิดซ้าย · ปุ่มบันทึก/รีเซ็ตอยู่บนแถบบน
//
// ไม่มีในหน้านี้ (ตัดตามสเปก): สินทรัพย์แบรนด์ · โลโก้/ธีม/สี/ฟอนต์ · ความปลอดภัย · SLA · LSA · AI · ส่วนลด
//
// กติกาของหน้านี้: ทุกช่องตั้งค่าต้องมีโค้ดอ่านไปใช้จริง — ห้ามมีช่องที่กดแล้วไม่เกิดอะไร
//   เกณฑ์ 48 ชม. / 7 วัน  → /hq/leads · /leads · แดชบอร์ดตัวแทน (ผ่าน useHQLeadRules)
//   กฎแจ้งเตือน 6 ข้อ     → กระดิ่ง HQ (ผ่าน @/lib/hqAlerts)
//   เหตุผลปิดไม่สำเร็จ     → ตัวเลือกตอนปิดดีลของตัวแทน (loadLostReasons)
//   VAT / อายุใบ / เลขที่ → ใบเสนอราคาทั้งเครือ
//   เป้าทั้งปี            → แดชบอร์ด HQ + แดชบอร์ดตัวแทน
import {
  useState, useEffect, useRef, useCallback, useMemo, useContext,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { usePersistentState } from "@/lib/usePersistentState";
import { useRole } from "@/context/RoleContext";
import {
  HQ_POLICY_KEY, DEFAULT_HQ_POLICY,
  HQ_TARGETS_KEY, DEFAULT_HQ_TARGETS,
  HQ_LEAD_RULES_KEY, DEFAULT_HQ_LEAD_RULES, HQ_LEAD_RULES_EVENT,
  HQ_NOTIF_KEY, HQ_NOTIF_EVENTS, DEFAULT_HQ_NOTIFS, HQ_NOTIF_UPDATED_EVENT,
  HQ_NOTIF_RULES_KEY, DEFAULT_HQ_NOTIF_RULES, HQ_DEALERS_KEY, dealerLeaderboard,
  HQ_ALERT_META, leadStatusLabel, leadStatusColor, LEAD_TASK_TEMPLATE,
  type HQPolicy, type HQTargets, type HQLeadRules, type HQNotifChannels, type HQNotifRules,
  type HQAlertKey, type DealerRow, type DealerCredentials, type LeadStatus,
} from "@/lib/mock";
// แท็บ "บริษัท" / "ผู้ใช้งาน" ฝังหน้าจัดการจริงเต็ม
import { CompanyPanel } from "@/components/hq/CompanyPanel";
import { UsersPanel } from "@/components/hq/UsersPanel";
import { TopbarActions } from "@/components/layout/TopbarActions";
import { useAuditLogger } from "@/lib/useAudit";
import { SettingsBusCtx as BusCtx, type SectionApi } from "@/lib/settingsBus";
import {
  Building2, Users, Store, GitMerge, Target, Bell, SlidersHorizontal, Scale,
  Save, RotateCcw, Plus, Trash2, Check, X, Copy, Key, LogIn, Eye, Power,
  Download, Upload, RefreshCw, Mail, Smartphone, Lock, AlertCircle,
  ShieldCheck, Package,
} from "lucide-react";

// ── tokens (Benjamin CI) ────────────────────────────────────────────────────
const NAVY = "#003366";   // Dark Blue — สีหลัก
const STEEL = "#2D2D2D";  // Steel Gray — ตัวอักษรเข้ม
const SILVER = "#C0C0C0"; // Silver — เส้นแบ่ง / ค่าว่าง

// ── shared bus (report dirty/save/reset ของแท็บที่ active + toast) — ดู @/lib/settingsBus
function useReport(api: SectionApi) {
  const { report } = useContext(BusCtx);
  useEffect(() => { report(api); return () => report(null); }, [api, report]);
}
function useToast() { return useContext(BusCtx).toast; }

// draft = state ที่แก้ไขได้ + เทียบกับค่าที่บันทึกไว้ (dirty) → ใช้กับ Save/Reset กลาง
function usePersistentDraft<T>(key: string, initial: T) {
  const [saved, setSaved] = usePersistentState<T>(key, initial);
  const [draft, setDraft] = useState<T>(saved);
  const editedRef = useRef(false);
  const draftRef = useRef(draft); draftRef.current = draft;
  const savedRef = useRef(saved); savedRef.current = saved;
  // ระหว่าง hydration (โหลดค่าเก่า) sync draft ← saved จนกว่าผู้ใช้จะแก้เอง
  useEffect(() => { if (!editedRef.current) setDraft(saved); }, [saved]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const set = useCallback((updater: (prev: T) => T) => { editedRef.current = true; setDraft(updater); }, []);
  const save = useCallback(() => setSaved(draftRef.current), [setSaved]);
  const reset = useCallback(() => { editedRef.current = false; setDraft(savedRef.current); }, []);
  return { draft, set, dirty, save, reset };
}

// ── reusable UI ───────────────────────────────────────────────────────────────
function SectionCard({ icon, title, desc, children, action }: { icon?: ReactNode; title: string; desc?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {icon && <span style={{ color: "var(--primary)", display: "flex" }}>{icon}</span>}{title}
          </div>
          {desc && <div className="card-desc">{desc}</div>}
        </div>
        {action}
      </div>
      <div className="card-body">{children}</div>
    </div>
  );
}
function Row({ label, desc, children, error }: { label: string; desc?: string; children: ReactNode; error?: string }) {
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", padding: "13px 0", borderTop: "1px solid var(--border,#f1f5f9)" }}>
      <div style={{ flex: "1 1 220px", minWidth: 0 }}>
        <div style={{ fontSize: "0.84rem", fontWeight: 700, color: `var(--foreground,${STEEL})` }}>{label}</div>
        {desc && <div style={{ fontSize: "0.72rem", color: "var(--muted-foreground,#6b7280)", marginTop: 2 }}>{desc}</div>}
      </div>
      <div style={{ flex: "0 0 340px", maxWidth: "100%" }}>
        {children}
        {error && <div style={{ fontSize: "0.68rem", color: "#dc2626", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}><AlertCircle size={11} /> {error}</div>}
      </div>
    </div>
  );
}
function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button role="switch" aria-checked={on} onClick={onChange}
      style={{ width: 42, height: 24, borderRadius: 99, border: "none", cursor: "pointer", flexShrink: 0, background: on ? NAVY : "#d1d5db", position: "relative", transition: "background .15s" }}>
      <span style={{ position: "absolute", top: 3, left: on ? 21 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.25)", transition: "left .15s" }} />
    </button>
  );
}
// กติกาที่ระบบบังคับใช้อยู่แล้ว — ไม่ใช่ช่องตั้งค่า
function PolicyList({ items }: { items: string[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
      {items.map((t, i) => (
        <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 14px", background: "#f8fafc", border: "1px solid #eef1f5", borderRadius: 10 }}>
          <Check size={15} color={NAVY} style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: "0.8rem", color: "#374151", lineHeight: 1.5 }}>{t}</span>
        </div>
      ))}
    </div>
  );
}
// แถบบอกว่า "ค่านี้ถูกใช้ที่ไหน" — กันไม่ให้ตั้งค่าแล้วเข้าใจผิดว่าไม่มีผล
function UsedAt({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "#f5f7fa", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 14px", marginTop: 12, fontSize: "0.76rem", color: "#6b7280", lineHeight: 1.6 }}>
      <Lock size={14} color={NAVY} style={{ flexShrink: 0, marginTop: 2 }} /> <span>{children}</span>
    </div>
  );
}
const numInput = (value: number, onChange: (n: number) => void, unit: string, step?: number) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
    <input type="number" step={step} className="form-input" style={{ textAlign: "right", fontWeight: 700 }} value={value} onChange={e => onChange(Number(e.target.value))} />
    <span style={{ fontSize: "0.72rem", color: "#6b7280", whiteSpace: "nowrap" }}>{unit}</span>
  </div>
);
const fmtB = (n: number) => n >= 1e6 ? `฿${(n / 1e6).toFixed(1)}M` : `฿${n.toLocaleString("th-TH")}`;
const regionDisplay = (r: string) => r === "อีสาน" ? "ภาคตะวันออกเฉียงเหนือ" : `ภาค${r}`;

// ═══════════════════════ 3 · เส้นทางการขาย ════════════════════════════════════
// ขั้นการขาย = สถานะลีดจริงของระบบ (LeadStatus 7 ขั้น) — แสดงอย่างเดียว
// แก้ชื่อ/สี/ลำดับที่นี่ไม่ได้ เพราะคัมบัง/ตาราง/แดชบอร์ด/งานมาตรฐาน ผูกกับสถานะจริงในโค้ด
// (ของเดิมเป็นตัวแก้ไขที่แก้แล้วไม่มีผลกับหน้าไหนเลย)
const STAGE_ORDER: LeadStatus[] = ["WAITING", "BULLET", "QUOTED", "FOLLOWUP", "NEGO", "PAID", "CANCELLED"];
type SystemCfg = { runningPrefix: string; runningNext: number };
const DEFAULT_SYSTEM: SystemCfg = { runningPrefix: "Q-2026-", runningNext: 1101 };

function JourneyTab() {
  // กฎใบเสนอราคา + เลขที่ใบ อยู่ที่นี่ (ใบเสนอราคาเป็นขั้นหนึ่งของเส้นทางการขาย)
  const pol = usePersistentDraft<HQPolicy>(HQ_POLICY_KEY, DEFAULT_HQ_POLICY);
  const sys = usePersistentDraft<SystemCfg>("hq_system", DEFAULT_SYSTEM);
  useReport(useMemo(() => ({
    dirty: pol.dirty || sys.dirty,
    save: () => { pol.save(); sys.save(); },
    reset: () => { pol.reset(); sys.reset(); },
  }), [pol.dirty, sys.dirty, pol.save, sys.save, pol.reset, sys.reset]));

  const active = STAGE_ORDER.filter(s => s !== "PAID" && s !== "CANCELLED");
  const tasksOf = (s: LeadStatus) => LEAD_TASK_TEMPLATE.filter(t => t.stage === s).map(t => t.label);

  return (
    <>
      <SectionCard icon={<GitMerge size={19} />} title="ขั้นตอนการขายมาตรฐาน"
        desc="เส้นทางเดียวกันทุกตัวแทน — สำนักงานใหญ่กำหนด ตัวแทนแก้ไขไม่ได้">
        <div style={{ border: "1px solid var(--border,#e5e7eb)", borderRadius: 12, overflow: "hidden", marginTop: 6 }}>
          {active.map((s, idx) => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderBottom: idx < active.length - 1 ? "1px solid #f1f5f9" : "none", flexWrap: "wrap" }}>
              <span style={{ width: 24, height: 24, borderRadius: "50%", background: leadStatusColor[s].bg, color: leadStatusColor[s].text, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.65rem", fontWeight: 800, flexShrink: 0 }}>{idx + 1}</span>
              <span style={{ flex: "1 1 140px", fontSize: "0.84rem", fontWeight: 700, color: STEEL }}>{leadStatusLabel[s]}</span>
              {/* งานมาตรฐานของขั้นนี้ = ตัวขับความคืบหน้าจริง (เช็กงาน → เลื่อนขั้นเอง) */}
              <span style={{ flex: "2 1 260px", display: "flex", gap: 5, flexWrap: "wrap" }}>
                {tasksOf(s).map(t => <span key={t} className="badge" style={{ background: "#f1f5f9", color: "#6b7280", fontWeight: 600 }}>{t}</span>)}
                {!tasksOf(s).length && <span style={{ fontSize: "0.72rem", color: SILVER }}>—</span>}
              </span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          {(["PAID", "CANCELLED"] as LeadStatus[]).map(s => (
            <div key={s} style={{ flex: "1 1 220px", display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 10, background: s === "PAID" ? "#f0fdf4" : "#fff5f5", border: `1px solid ${s === "PAID" ? "#bbf7d0" : "#fecaca"}` }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: leadStatusColor[s].text }} />
              <span style={{ flex: 1, fontSize: "0.8rem", fontWeight: 700, color: leadStatusColor[s].text }}>{leadStatusLabel[s]}</span>
              <span className="badge" style={{ background: leadStatusColor[s].bg, color: leadStatusColor[s].text, border: "none" }}>ขั้นปิด</span>
            </div>
          ))}
        </div>
        <UsedAt>
          7 ขั้นนี้คือสถานะจริงของลูกค้าเป้าหมายทั้งระบบ — ความคืบหน้าเลื่อนขั้นเองจาก “งานมาตรฐาน” ที่ตัวแทนเช็ก
          <br />ไม่มีขั้น “ลูกค้าเป้าหมายใหม่” เพราะตัวแทนสร้างลีดหลังติดต่อลูกค้าแล้ว
        </UsedAt>
      </SectionCard>

      {/* กฎใบเสนอราคา — VAT/อายุใบ/เลขที่ ใช้จริงทั้งเครือ */}
      <SectionCard icon={<SlidersHorizontal size={19} />} title="กฎใบเสนอราคา (Quotation Rules)" desc="มาตรฐานเอกสารที่ใช้ทั้งเครือ">
        <Row label="อายุใบเสนอราคาเริ่มต้น" desc="กี่วันก่อนใบเสนอราคาหมดอายุ">
          {numInput(pol.draft.quoteValidityDays, n => pol.set(p => ({ ...p, quoteValidityDays: n })), "วัน")}
        </Row>
        <Row label="ภาษีมูลค่าเพิ่ม (VAT)" desc="อัตรามาตรฐานบนใบเสนอราคาทุกตัวแทน">
          {numInput(pol.draft.vat, n => pol.set(p => ({ ...p, vat: n })), "%")}
        </Row>
        <Row label="คำนำหน้าเลขที่ + เลขถัดไป" desc="รูปแบบเลขที่ใบเสนอราคา (ใช้ทั้งเครือ)">
          <div style={{ display: "flex", gap: 8 }}>
            <input className="form-input" style={{ flex: 1 }} value={sys.draft.runningPrefix} onChange={e => sys.set(p => ({ ...p, runningPrefix: e.target.value }))} />
            <input type="number" className="form-input" style={{ width: 100, textAlign: "right", fontWeight: 700 }} value={sys.draft.runningNext} onChange={e => sys.set(p => ({ ...p, runningNext: Number(e.target.value) }))} />
          </div>
        </Row>
        <PolicyList items={["แบบฟอร์ม PDF มาตรฐานเดียวทั้งเครือ — ใบเสนอราคาของตัวแทนใช้ “ข้อมูลบริษัทของตัวแทน” (ชื่อ / ที่อยู่ / เลขผู้เสียภาษี) เสมอ"]} />
      </SectionCard>

      <SectionCard icon={<Lock size={19} />} title="นโยบายราคา (Pricing Policy)" desc="โมเดลราคา — สำนักงานใหญ่ขายให้ตัวแทน ตัวแทนบวกกำไรเอง">
        <PolicyList items={[
          "ตัวแทนซื้อสินค้าจากสำนักงานใหญ่ด้วย “ราคากลาง” (Master Price)",
          "ตัวแทนแก้ราคากลางไม่ได้ — ดูได้อย่างเดียว",
          "ตัวแทนกำหนดราคาขายต่อให้ลูกค้าเองได้ (บวกกำไรเอง) — ระบบไม่มีส่วนลด ราคาที่เสนอคือราคาสุทธิ",
          "เส้นทางการขายนี้กำหนดโดยสำนักงานใหญ่ — ตัวแทนแก้ไขไม่ได้ ดูได้อย่างเดียว",
        ]} />
      </SectionCard>
    </>
  );
}

// ═══════════════════════ 4 · ตัวแทนจำหน่าย ════════════════════════════════════
// บัญชีและการเข้าระบบของตัวแทน — รหัส / บริษัท / ภาค / อีเมลเข้าระบบ / สถานะ
// + ดู · รีเซ็ตรหัสผ่าน · ระงับ · เข้าระบบแทน (โหมดดู)
// ไม่มีปุ่มเพิ่มลูกค้าเป้าหมาย/เพิ่มลูกค้า (ตามสเปก) · รายชื่อ/ผลงาน/เป้า จัดการที่หน้า “ตัวแทน”
type DealerDefaults = { defaultQuota: number; allowResetPwd: boolean };
const DEFAULT_DEALER_DEFAULTS: DealerDefaults = { defaultQuota: 30_000_000, allowResetPwd: true };

// รหัสผ่านใหม่แบบ deterministic (ไม่ใช้ random → เดโมทวนซ้ำได้) — อิงรหัสตัวแทน + ความยาวรหัสเดิม
function genPassword(code: string, nonce: number): string {
  const sum = code.split("").reduce((s, c) => s + c.charCodeAt(0), 0) + nonce * 7;
  return `PEB-${code}-${1000 + (sum % 9000)}`;
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [c, setC] = useState(false);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: "0.72rem", color: "#6b7280", marginBottom: 4, fontWeight: 600 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#f0f4f8", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 11px" }}>
        <span style={{ flex: 1, fontFamily: "monospace", fontSize: "0.84rem", fontWeight: 700, color: STEEL, overflow: "hidden", textOverflow: "ellipsis" }}>{value}</span>
        <button type="button" onClick={() => navigator.clipboard.writeText(value).then(() => { setC(true); setTimeout(() => setC(false), 1500); })}
          style={{ background: "none", border: "none", cursor: "pointer", color: c ? "#059669" : "#6b7280", padding: 0, display: "flex", flexShrink: 0 }}>
          {c ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
    </div>
  );
}

function DealersTab() {
  const router = useRouter();
  const { login } = useRole();
  const logAudit = useAuditLogger();
  const toast = useToast();
  const [dealers, setDealers] = usePersistentState<DealerRow[]>(HQ_DEALERS_KEY, dealerLeaderboard);
  const dd = usePersistentDraft<DealerDefaults>("hq_dealer_settings", DEFAULT_DEALER_DEFAULTS);
  useReport(useMemo(() => ({ dirty: dd.dirty, save: dd.save, reset: dd.reset }), [dd.dirty, dd.save, dd.reset]));
  const [resetInfo, setResetInfo] = useState<{ d: DealerRow; creds: DealerCredentials } | null>(null);

  // การกระทำกับบัญชีมีผลทันที (ไม่ผ่านปุ่มบันทึกกลาง) — และลงบันทึกการใช้งานทุกครั้ง
  function resetPassword(d: DealerRow) {
    const creds: DealerCredentials = { email: d.credentials.email, password: genPassword(d.code, d.credentials.password.length) };
    setDealers(prev => prev.map(x => x.id === d.id ? { ...x, credentials: creds } : x));
    logAudit("รีเซ็ตรหัสผ่านตัวแทน", `${d.code} · ${d.name}`);
    setResetInfo({ d, creds });
  }
  function toggleSuspend(d: DealerRow) {
    const next = d.status === "active" ? "inactive" : "active";
    if (next === "inactive" && !confirm(`ระงับ "${d.name}" ไม่ให้เข้าระบบ?`)) return;
    setDealers(prev => prev.map(x => x.id === d.id ? { ...x, status: next } : x));
    logAudit(next === "active" ? "เปิดใช้งานตัวแทน" : "ระงับตัวแทน", `${d.code} · ${d.name}`);
    toast(next === "active" ? "เปิดใช้งานตัวแทนแล้ว" : "ระงับตัวแทนแล้ว");
  }
  function enterDealer(d: DealerRow) {
    logAudit("เข้าระบบแทนตัวแทน (โหมดดู)", `${d.code} · ${d.name}`);
    login("dealer");
    router.push("/dashboard");
  }

  const iconBtn: React.CSSProperties = {
    width: 28, height: 28, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
    background: "#f0f4f8", border: "1px solid #e5e7eb", borderRadius: 7, color: NAVY, cursor: "pointer",
  };

  return (
    <>
      <SectionCard icon={<Store size={19} />} title="บัญชีและการเข้าระบบของตัวแทน"
        desc={`${dealers.length} ตัวแทนในเครือ — ตัวแทน 1 บริษัท = 1 บัญชี`}>
        <div className="table-wrap" style={{ marginTop: 6 }}>
          <table>
            <colgroup>
              <col style={{ width: "10%", minWidth: 68 }} />
              <col style={{ width: "26%", minWidth: 150 }} />
              <col style={{ width: "18%", minWidth: 110 }} />
              <col style={{ width: "24%", minWidth: 150 }} />
              <col style={{ width: "10%", minWidth: 84 }} />
              <col style={{ width: "12%", minWidth: 132 }} />
            </colgroup>
            <thead>
              <tr>
                <th>รหัส</th>
                <th>บริษัท</th>
                <th>ภาค</th>
                <th>อีเมลเข้าระบบ</th>
                <th>สถานะ</th>
                <th style={{ textAlign: "right" }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {dealers.map(d => (
                <tr key={d.id}>
                  <td style={{ fontWeight: 800, color: NAVY, fontFamily: "monospace" }}>{d.code}</td>
                  <td style={{ fontWeight: 600, color: STEEL }}>{d.name}</td>
                  <td style={{ color: "#6b7280", fontSize: "0.78rem" }}>{regionDisplay(d.region)}</td>
                  <td style={{ color: "#6b7280", fontSize: "0.76rem", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis" }}>{d.credentials.email}</td>
                  <td>
                    <span className="badge" style={d.status === "active"
                      ? { background: "#e5faf0", color: "#059669" }
                      : { background: "#fee2e2", color: "#dc2626" }}>
                      {d.status === "active" ? "ใช้งาน" : "ระงับ"}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 5, justifyContent: "flex-end" }}>
                      <button style={iconBtn} title="ดูรายละเอียด" onClick={() => router.push(`/hq/dealers/${d.code}`)}><Eye size={12} /></button>
                      <button style={{ ...iconBtn, opacity: dd.draft.allowResetPwd ? 1 : .4, cursor: dd.draft.allowResetPwd ? "pointer" : "not-allowed" }}
                        title={dd.draft.allowResetPwd ? "รีเซ็ตรหัสผ่าน" : "ปิดการรีเซ็ตรหัสผ่านไว้"}
                        disabled={!dd.draft.allowResetPwd} onClick={() => resetPassword(d)}><Key size={12} /></button>
                      <button style={{ ...iconBtn, color: d.status === "active" ? "#dc2626" : "#059669" }}
                        title={d.status === "active" ? "ระงับ" : "เปิดใช้งาน"} onClick={() => toggleSuspend(d)}><Power size={12} /></button>
                      <button style={iconBtn} title="เข้าระบบแทนตัวแทน (โหมดดู)" onClick={() => enterDealer(d)}><LogIn size={12} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <UsedAt>เพิ่ม/แก้ไขตัวแทน · จังหวัด · เป้ายอดขาย · ผลงาน จัดการที่หน้า “ตัวแทน” — หน้านี้ดูแลเฉพาะบัญชีและการเข้าระบบ</UsedAt>
      </SectionCard>

      <SectionCard icon={<SlidersHorizontal size={19} />} title="ค่ามาตรฐานตัวแทนจำหน่าย" desc="ค่าตั้งต้นเวลาสร้างตัวแทนใหม่ + สิทธิ์รวม">
        <Row label="เป้ายอดขายเริ่มต้น (ต่อปี)" desc="เป้าตั้งต้นของตัวแทนใหม่">
          {numInput(dd.draft.defaultQuota, n => dd.set(p => ({ ...p, defaultQuota: n })), "บาท", 1_000_000)}
        </Row>
        <Row label="เปิดให้รีเซ็ตรหัสผ่านตัวแทนได้" desc="ปิดไว้ = ล็อกปุ่มรีเซ็ตรหัสผ่านในตารางด้านบน">
          <Toggle on={dd.draft.allowResetPwd} onChange={() => dd.set(p => ({ ...p, allowResetPwd: !p.allowResetPwd }))} />
        </Row>
      </SectionCard>

      <SectionCard icon={<ShieldCheck size={19} />} title="นโยบายตัวแทน (Dealer Policy)" desc="สิทธิ์และข้อจำกัดของตัวแทนในเครือ">
        <PolicyList items={[
          "ตัวแทน 1 บริษัท = 1 บัญชี — สร้างโดยสำนักงานใหญ่เท่านั้น",
          "ตัวแทนเปลี่ยนอีเมลเข้าสู่ระบบและรหัสผ่านเองไม่ได้ — ต้องแจ้งสำนักงานใหญ่",
          "สำนักงานใหญ่รีเซ็ตรหัสผ่าน ระงับบัญชี และเข้าระบบแทนตัวแทนได้",
          "ทั้งระบบใช้แบรนด์ Benjamin — ตัวแทนเปลี่ยนโลโก้/แบรนด์/ธีมเองไม่ได้",
          "ตัวแทนแก้แม่แบบและราคากลางของสำนักงานใหญ่ไม่ได้ — ดูได้อย่างเดียว",
        ]} />
      </SectionCard>

      {/* รหัสผ่านใหม่หลังรีเซ็ต — ให้คัดลอกไปแจ้งตัวแทน */}
      {resetInfo && (
        <div onClick={() => setResetInfo(null)} style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(45,45,45,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 400, background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,.22)" }}>
            <div style={{ background: NAVY, color: "#fff", padding: "15px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, fontWeight: 800 }}><Key size={16} /> รีเซ็ตรหัสผ่านแล้ว</div>
              <button onClick={() => setResetInfo(null)} style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(255,255,255,.15)", color: "#fff", border: "none", cursor: "pointer" }}><X size={14} /></button>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ fontSize: "0.82rem", color: "#6b7280", marginBottom: 12 }}>
                รหัสผ่านใหม่ของ <strong style={{ color: STEEL }}>{resetInfo.d.name}</strong> — แจ้งให้ตัวแทนเปลี่ยนเองหลังเข้าระบบ
              </div>
              <CopyRow label="อีเมลเข้าระบบ" value={resetInfo.creds.email} />
              <CopyRow label="รหัสผ่านใหม่" value={resetInfo.creds.password} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ═══════════════════════ 5 · เป้าหมายยอดขาย ═══════════════════════════════════
// เป้าทั้งปี = แหล่งเดียว (แดชบอร์ด HQ/ตัวแทนอ่านค่านี้) · ไตรมาส/เดือน = แบ่งจากเป้าทั้งปี
// เป้ารายตัวแทน = DealerRow.revenueTarget (ตั้งที่หน้า “ตัวแทน”) · ความคืบหน้า = ยอดจริงเทียบเป้า
// ไม่มี "คาดการณ์" (Forecast) — ระบบไม่มีข้อมูลคาดการณ์ (ไม่มี expectedClose / ค่าความน่าจะเป็น)
function RollupTable({ title, hint, rows, countryTarget }: {
  title: string; hint: string;
  rows: { key: string; target: number; actual: number; dealers: number }[];
  countryTarget?: number;
}) {
  const sorted = [...rows].sort((a, b) => b.target - a.target);
  return (
    <SectionCard icon={<Target size={19} />} title={title} desc={hint}>
      <div className="table-wrap" style={{ marginTop: 6 }}>
        <table>
          <colgroup>
            <col style={{ width: "34%" }} />
            <col style={{ width: "12%", minWidth: 76 }} />
            <col style={{ width: "18%", minWidth: 96 }} />
            <col style={{ width: "18%", minWidth: 96 }} />
            <col style={{ width: "18%", minWidth: 96 }} />
          </colgroup>
          <thead>
            <tr>
              <th>พื้นที่</th>
              <th className="num">ตัวแทน</th>
              <th className="num">เป้า</th>
              <th className="num">ทำได้จริง</th>
              <th className="num">ความคืบหน้า</th>
            </tr>
          </thead>
          <tbody>
            {!sorted.length ? (
              <tr><td colSpan={5} style={{ textAlign: "center", padding: "24px", color: "#6b7280", fontSize: "0.8rem" }}>—</td></tr>
            ) : sorted.map(r => {
              const pct = r.target > 0 ? Math.round(r.actual / r.target * 100) : 0;
              return (
                <tr key={r.key}>
                  <td style={{ fontWeight: 600, color: STEEL }}>{r.key}</td>
                  <td className="num" style={{ color: "#6b7280" }}>{r.dealers}</td>
                  <td className="num" style={{ fontWeight: 700 }}>{fmtB(r.target)}</td>
                  <td className="num" style={{ fontWeight: 700, color: NAVY }}>{fmtB(r.actual)}</td>
                  <td className="num" style={{ fontWeight: 800, color: pct >= 100 ? "#059669" : pct >= 70 ? NAVY : "#b45309" }}>{pct}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {countryTarget != null && (() => {
        const sum = rows.reduce((s, r) => s + r.target, 0);
        const diff = sum - countryTarget;
        if (diff === 0) return null;
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: diff < 0 ? "#fff7ed" : "#f0f4fa", border: `1px solid ${diff < 0 ? "#fed7aa" : "#dbe4f0"}`, borderRadius: 10, padding: "10px 14px", marginTop: 12, fontSize: "0.78rem", color: diff < 0 ? "#b45309" : NAVY }}>
            <AlertCircle size={14} style={{ flexShrink: 0 }} />
            ผลรวมเป้าตัวแทน {fmtB(sum)} {diff < 0 ? "ต่ำกว่า" : "สูงกว่า"}เป้าทั้งเครือ {fmtB(countryTarget)} อยู่ {fmtB(Math.abs(diff))}
          </div>
        );
      })()}
    </SectionCard>
  );
}

function TargetsTab() {
  const { draft, set, dirty, save, reset } = usePersistentDraft<HQTargets>(HQ_TARGETS_KEY, DEFAULT_HQ_TARGETS);
  const [dealers] = usePersistentState<DealerRow[]>(HQ_DEALERS_KEY, dealerLeaderboard);
  useReport(useMemo(() => ({ dirty, save, reset }), [dirty, save, reset]));

  // รวมเป้า/ผลจริงตามพื้นที่ — มาจากเป้ารายตัวแทนที่ตั้งไว้จริง ไม่ได้กุตัวเลข
  const byRegion = useMemo(() => {
    const m = new Map<string, { target: number; actual: number; dealers: number }>();
    dealers.forEach(d => {
      const k = regionDisplay(d.region) || "ไม่ระบุ";
      const r = m.get(k) ?? { target: 0, actual: 0, dealers: 0 };
      r.target += d.revenueTarget; r.actual += d.revenueActual; r.dealers += 1;
      m.set(k, r);
    });
    return [...m.entries()].map(([key, v]) => ({ key, ...v }));
  }, [dealers]);
  const byDealer = useMemo(() => dealers.map(d => ({ key: `${d.code} · ${d.name}`, target: d.revenueTarget, actual: d.revenueActual, dealers: 1 })), [dealers]);

  const totalActual = dealers.reduce((s, d) => s + d.revenueActual, 0);
  const achievement = draft.annualTarget > 0 ? Math.round(totalActual / draft.annualTarget * 100) : 0;

  return (
    <>
      <SectionCard icon={<Target size={19} />} title="เป้าหมายยอดขายทั้งเครือ" desc="ตั้งเป้าทั้งปี — แดชบอร์ดสำนักงานใหญ่และแดชบอร์ดตัวแทนใช้ค่านี้">
        <Row label="เป้ายอดขายทั้งปี" desc="ยอดปิดการขายรวมทุกตัวแทนใน 1 ปี">
          {numInput(draft.annualTarget, n => set(p => ({ ...p, annualTarget: n })), "บาท", 1_000_000)}
        </Row>
        <Row label="เป้าอัตราปิดการขายเฉลี่ย" desc="เกณฑ์สีบนหน้าตัวแทน — ต่ำกว่านี้ขึ้นสีเตือน">
          {numInput(draft.winRateTarget, n => set(p => ({ ...p, winRateTarget: n })), "%")}
        </Row>
        <Row label="เป้าติดตามตรงเวลา" desc="เกณฑ์สีบนหน้าตัวแทน — งานติดตามที่ทำทันเวลา">
          {numInput(draft.onTimeTarget, n => set(p => ({ ...p, onTimeTarget: n })), "%")}
        </Row>

        {/* ไตรมาส/เดือน = แบ่งจากเป้าทั้งปี — ไม่ให้ตั้งแยก จะได้ไม่ขัดกับเป้าทั้งปี */}
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "#6b7280", marginBottom: 8 }}>แบ่งจากเป้าทั้งปี</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
            {[
              { label: "เป้าทั้งปี", value: fmtB(draft.annualTarget) },
              { label: "เป้าต่อไตรมาส", value: fmtB(Math.round(draft.annualTarget / 4)) },
              { label: "เป้าต่อเดือน", value: fmtB(Math.round(draft.annualTarget / 12)) },
            ].map(s => (
              <div key={s.label} style={{ background: "#f8fafc", border: "1px solid #eef1f5", borderRadius: 12, padding: "14px 16px" }}>
                <div style={{ fontSize: "0.7rem", color: "#6b7280" }}>{s.label}</div>
                <div style={{ fontSize: "1.15rem", fontWeight: 800, color: NAVY, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>

      {/* ความคืบหน้า: เป้า / ทำได้จริง / % — ไม่มี "คาดการณ์" เพราะระบบไม่มีข้อมูล forecast */}
      <SectionCard icon={<Target size={19} />} title="ความคืบหน้าทั้งเครือ" desc="ยอดสะสมทั้งปีของทุกตัวแทน เทียบเป้าที่ตั้งไว้ด้านบน">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginTop: 6 }}>
          {[
            { label: "เป้าหมาย", value: fmtB(draft.annualTarget), color: STEEL },
            { label: "ทำได้จริง", value: fmtB(totalActual), color: NAVY },
            { label: "ความคืบหน้า", value: `${achievement}%`, color: achievement >= 100 ? "#059669" : achievement >= 70 ? NAVY : "#b45309" },
          ].map(s => (
            <div key={s.label} style={{ background: "#f8fafc", border: "1px solid #eef1f5", borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ fontSize: "0.7rem", color: "#6b7280" }}>{s.label}</div>
              <div style={{ fontSize: "1.15rem", fontWeight: 800, color: s.color, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{s.value}</div>
            </div>
          ))}
        </div>
        <div style={{ height: 10, background: "#eef1f5", borderRadius: 999, overflow: "hidden", marginTop: 14 }}>
          <div className="bar-grow" style={{ height: "100%", width: `${Math.min(100, achievement)}%`, background: achievement >= 100 ? "#059669" : NAVY, borderRadius: 999 }} />
        </div>
      </SectionCard>

      <RollupTable title="เป้าหมายรายภูมิภาค" hint="รวมจากเป้าของตัวแทนในภาคนั้น — ตั้งเป้ารายตัวแทนที่หน้า “ตัวแทน”" rows={byRegion} countryTarget={draft.annualTarget} />
      <RollupTable title="เป้าหมายรายตัวแทน" hint="ตั้งค่าได้ที่หน้า “ตัวแทน” → แก้ไขตัวแทน" rows={byDealer} />
    </>
  );
}

// ═══════════════════════ 6 · กฎธุรกิจ ═════════════════════════════════════════
// กฎที่ระบบบังคับใช้จริงกับทุกตัวแทน — ทุกข้อมีหน้าที่อ่านค่าไปใช้
// ไม่มี: SLA · LSA · เพดานส่วนลด (ส่วนลดถูกลบทั้งฟีเจอร์ตามคำสั่ง 15 ก.ค. 69)
// ไม่มี "ลบลีดอัตโนมัติ" — ระบบไม่มีตัวลบจริง จึงเป็นการแจ้งเตือนลีดเงียบแทน
type Journey = { lost: string[] };
const DEFAULT_JOURNEY: Journey = {
  lost: ["ราคาสูงเกินงบประมาณ", "คู่แข่งให้ข้อเสนอดีกว่า", "งบประมาณไม่พร้อม", "ลูกค้าไม่ตอบสนอง"],
};

function BusinessRulesTab() {
  const router = useRouter();
  const lead = usePersistentDraft<HQLeadRules>(HQ_LEAD_RULES_KEY, DEFAULT_HQ_LEAD_RULES);
  const jn = usePersistentDraft<Journey>("hq_sales_journey", DEFAULT_JOURNEY);
  const [newLost, setNewLost] = useState("");
  // บันทึกแล้วยิง event → หน้าลีด/แดชบอร์ดที่เปิดค้างอยู่อัปเดตเกณฑ์ทันที
  // dep ต้องเป็นฟังก์ชันข้างใน (useCallback แล้ว) ไม่ใช่กล่องที่ usePersistentDraft คืนมา — กล่องใหม่ทุกเรนเดอร์
  const saveAll = useCallback(() => {
    lead.save(); jn.save();
    window.dispatchEvent(new Event(HQ_LEAD_RULES_EVENT));
  }, [lead.save, jn.save]);
  useReport(useMemo(() => ({
    dirty: lead.dirty || jn.dirty,
    save: saveAll,
    reset: () => { lead.reset(); jn.reset(); },
  }), [lead.dirty, jn.dirty, saveAll, lead.reset, jn.reset]));

  const addLost = () => { if (newLost.trim()) { jn.set(p => ({ ...p, lost: [...p.lost, newLost.trim()] })); setNewLost(""); } };

  return (
    <>
      <SectionCard icon={<Scale size={19} />} title="กฎการดูแลลูกค้าเป้าหมาย" desc="เกณฑ์กลางที่บังคับใช้กับทุกตัวแทน — ตัวแทนแก้เองไม่ได้">
        <Row label="ต้องมีผู้รับผิดชอบภายใน" desc="ลีดใหม่ที่ยังไม่มีผู้รับผิดชอบเกินกำหนด → ขึ้นการ์ดเตือน">
          {numInput(lead.draft.unassignedAlertHours, n => lead.set(p => ({ ...p, unassignedAlertHours: n })), "ชั่วโมง")}
        </Row>
        <Row label="เตือนเมื่อลีดไม่มีการติดต่อเกิน" desc="ลีดที่ยังไม่ปิดและเงียบเกินกำหนด → ขึ้นป้าย “ต้องติดตามด่วน”">
          {numInput(lead.draft.followUpAlertDays, n => lead.set(p => ({ ...p, followUpAlertDays: n })), "วัน")}
        </Row>
        <UsedAt>
          สองเกณฑ์นี้ถูกใช้จริงที่: ลูกค้าเป้าหมายทั้งเครือ · หน้าลูกค้าเป้าหมายของตัวแทน · แดชบอร์ดตัวแทน · กระดิ่งแจ้งเตือน
          <br />ลีดที่เงียบนานจะถูก “เตือน” เท่านั้น — ระบบไม่ลบลีดอัตโนมัติ (ข้อมูลลูกค้าเป้าหมายไม่หายเอง)
        </UsedAt>
      </SectionCard>

      <SectionCard icon={<X size={19} />} title="เหตุผลปิดการขายไม่สำเร็จ" desc="ตัวเลือกมาตรฐานที่ตัวแทนต้องเลือกตอนปิดดีลไม่สำเร็จ">
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
          {jn.draft.lost.map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 12px" }}>
              <span style={{ flex: 1, fontSize: "0.8rem", color: STEEL }}>{r}</span>
              <button onClick={() => jn.set(p => ({ ...p, lost: p.lost.filter((_, x) => x !== i) }))}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", display: "flex", padding: 2 }}><Trash2 size={13} /></button>
            </div>
          ))}
          {!jn.draft.lost.length && (
            <div style={{ fontSize: "0.78rem", color: "#b45309", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8, padding: "9px 12px" }}>
              ต้องมีอย่างน้อย 1 เหตุผล — ไม่งั้นตัวแทนจะไม่มีตัวเลือกตอนปิดดีลไม่สำเร็จ
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 10, maxWidth: 420 }}>
          <input className="form-input" value={newLost} placeholder="เพิ่มเหตุผล…" onChange={e => setNewLost(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") addLost(); }} />
          <button className="btn btn-primary btn-sm" style={{ flexShrink: 0 }} onClick={addLost}><Plus size={14} /></button>
        </div>
        <UsedAt>รายการนี้คือตัวเลือกจริงในหน้าปิดดีลของตัวแทน และเป็นที่มาของรายงาน “เหตุผลที่เสียโอกาส”</UsedAt>
      </SectionCard>

      <SectionCard icon={<Package size={19} />} title="ประเภทสินค้าและแม่แบบ" desc="สำนักงานใหญ่กำหนดแม่แบบและราคากลาง — ตัวแทนดูได้อย่างเดียว"
        action={<button className="btn btn-secondary btn-sm" onClick={() => router.push("/hq/master")}>เปิดแคตตาล็อกแม่แบบ</button>}>
        <PolicyList items={[
          "ประเภทสินค้า/แม่แบบทั้งหมดจัดการที่หน้า “แคตตาล็อกแม่แบบ” ที่เดียว — ไม่ตั้งซ้ำที่นี่",
          "ตัวแทนเลือกแม่แบบจากแคตตาล็อกกลางเท่านั้น เพิ่ม/แก้แม่แบบเองไม่ได้",
          "ราคากลางของแม่แบบใช้ร่วมกันทั้งเครือ — เปลี่ยนที่สำนักงานใหญ่แล้วมีผลทุกตัวแทน",
        ]} />
      </SectionCard>
    </>
  );
}

// ═══════════════════════ 7 · การแจ้งเตือน ═════════════════════════════════════
// 2 การ์ด:
//  1) กฎแจ้งเตือน 6 เรื่อง — คำนวณจากข้อมูลจริง แล้วขึ้นกระดิ่ง HQ (ดู @/lib/hqAlerts)
//  2) บันทึกการใช้งาน — หมวดจาก Audit Log ที่กรองกระดิ่ง HQ (Topbar อ่าน hqAuditCategory + inapp)
// ช่องทาง = อีเมล + ในระบบ เท่านั้น (ไลน์ถูกตัดตามสเปก)
type Notifs = Record<string, HQNotifChannels>;
const CHANNELS: { k: keyof HQNotifChannels; label: string }[] = [
  { k: "email", label: "อีเมล" },
  { k: "inapp", label: "ในระบบ" },
];
// เกณฑ์ของแต่ละกฎ (ถ้ามี) — 2 ข้อแรกใช้เกณฑ์จาก "กฎธุรกิจ" จึงไม่มีช่องกรอกซ้ำที่นี่
const ALERT_THRESHOLD: Partial<Record<HQAlertKey, { field: "quoteExpiringDays" | "dealerIdleDays" | "targetAchievedPct" | "lostRatePct"; unit: string }>> = {
  quoteExpiring:  { field: "quoteExpiringDays",  unit: "วัน" },
  dealerIdle:     { field: "dealerIdleDays",     unit: "วัน" },
  targetAchieved: { field: "targetAchievedPct",  unit: "% ของเป้า" },
  lostRate:       { field: "lostRatePct",        unit: "%" },
};

function NotificationsTab() {
  const ch = usePersistentDraft<Notifs>(HQ_NOTIF_KEY, DEFAULT_HQ_NOTIFS);
  const rules = usePersistentDraft<HQNotifRules>(HQ_NOTIF_RULES_KEY, DEFAULT_HQ_NOTIF_RULES);
  // บันทึกแล้วยิง event → กระดิ่ง HQ อัปเดตทันที (Topbar ฟัง HQ_NOTIF_UPDATED_EVENT)
  // dep ต้องเป็น "ฟังก์ชันข้างใน" ไม่ใช่ตัวกล่องที่ usePersistentDraft คืนมา
  // กล่องเป็น object literal ใหม่ทุกเรนเดอร์ → ถ้า dep เป็น rules/ch ทั้งก้อน saveAndBroadcast
  // จะใหม่ทุกเรนเดอร์ → useMemo ของ api ใหม่ → useReport ยิง setApi → เรนเดอร์ใหม่ = วนไม่จบ
  const saveAndBroadcast = useCallback(() => {
    ch.save(); rules.save();
    window.dispatchEvent(new Event(HQ_NOTIF_UPDATED_EVENT));
  }, [ch.save, rules.save]);
  useReport(useMemo(() => ({
    dirty: ch.dirty || rules.dirty,
    save: saveAndBroadcast,
    reset: () => { ch.reset(); rules.reset(); },
  }), [ch.dirty, rules.dirty, saveAndBroadcast, ch.reset, rules.reset]));

  const setAlert = (k: HQAlertKey, patch: Partial<{ on: boolean; email: boolean; inapp: boolean }>) =>
    rules.set(p => ({ ...p, alerts: { ...p.alerts, [k]: { ...p.alerts[k], ...patch } } }));

  return (
    <>
      <SectionCard icon={<Bell size={19} />} title="การแจ้งเตือนของสำนักงานใหญ่"
        desc="6 เรื่องที่ระบบเฝ้าให้ — คำนวณจากข้อมูลจริงของเครือ แล้วขึ้นที่กระดิ่ง">
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 28, padding: "0 4px 8px", fontSize: "0.68rem", fontWeight: 700, color: "#9ca3af" }}>
          {CHANNELS.map(c => <span key={c.k} style={{ width: 60, textAlign: "center" }}>{c.label}</span>)}
          <span style={{ width: 42, textAlign: "center" }}>เปิด</span>
        </div>
        <div style={{ border: "1px solid var(--border,#e5e7eb)", borderRadius: 12, overflow: "hidden" }}>
          {HQ_ALERT_META.map((a, i) => {
            const pref = rules.draft.alerts[a.key];
            const th = ALERT_THRESHOLD[a.key];
            return (
              <div key={a.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderTop: i ? "1px solid #f1f5f9" : "none", flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                  <div style={{ fontSize: "0.84rem", fontWeight: 700, color: STEEL }}>{a.label}</div>
                  <div style={{ fontSize: "0.72rem", color: "#6b7280", marginTop: 2 }}>{a.desc}</div>
                </div>
                {/* ช่องเกณฑ์ + ช่องทาง — ปิดกฎแล้วจาง สื่อว่าไม่ถูกใช้ */}
                <div style={{ flex: "0 0 176px", opacity: pref.on ? 1 : .4, pointerEvents: pref.on ? "auto" : "none", transition: "opacity .15s" }}>
                  {th && numInput(rules.draft[th.field], n => rules.set(p => ({ ...p, [th.field]: n })), th.unit)}
                </div>
                {CHANNELS.map(c => (
                  <div key={c.k} style={{ width: 60, display: "flex", justifyContent: "center", opacity: pref.on ? 1 : .4, pointerEvents: pref.on ? "auto" : "none" }}>
                    <Toggle on={pref[c.k]} onChange={() => setAlert(a.key, { [c.k]: !pref[c.k] })} />
                  </div>
                ))}
                <div style={{ width: 42, display: "flex", justifyContent: "center" }}>
                  <Toggle on={pref.on} onChange={() => setAlert(a.key, { on: !pref.on })} />
                </div>
              </div>
            );
          })}
        </div>
        <UsedAt>
          เกณฑ์ของ 2 เรื่องแรก (ผู้รับผิดชอบ / ลีดเงียบ) ตั้งที่หัวข้อ “กฎธุรกิจ” — ที่นี่คุมแค่เปิด/ปิดและช่องทาง
          <br />ช่อง “ในระบบ” คุมกระดิ่งจริง · ช่อง “อีเมล” เก็บค่าไว้ให้ระบบส่งอีเมล (ยังไม่ได้ต่อระบบส่งจริง)
        </UsedAt>
      </SectionCard>

      <SectionCard icon={<ShieldCheck size={19} />} title="บันทึกการใช้งานที่อยากรู้"
        desc="เรื่องที่สำนักงานใหญ่อยากเห็นจากบันทึกการใช้งาน · ปิด “ในระบบ” เพื่อซ่อนจากกระดิ่ง">
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 28, padding: "0 4px 8px", fontSize: "0.68rem", fontWeight: 700, color: "#9ca3af" }}>
          {CHANNELS.map(c => <span key={c.k} style={{ width: 60, textAlign: "center" }}>{c.label}</span>)}
        </div>
        <div style={{ border: "1px solid var(--border,#e5e7eb)", borderRadius: 12, overflow: "hidden" }}>
          {HQ_NOTIF_EVENTS.map((ev, i) => (
            <div key={ev.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderTop: i ? "1px solid #f1f5f9" : "none" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.84rem", fontWeight: 700, color: STEEL }}>{ev.label}</div>
                <div style={{ fontSize: "0.72rem", color: "#6b7280", marginTop: 1 }}>{ev.desc}</div>
              </div>
              {CHANNELS.map(c => (
                <div key={c.k} style={{ width: 60, display: "flex", justifyContent: "center" }}>
                  <Toggle on={ch.draft[ev.key]?.[c.k] ?? false}
                    onChange={() => ch.set(p => ({ ...p, [ev.key]: { ...p[ev.key], [c.k]: !p[ev.key]?.[c.k] } }))} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </SectionCard>
    </>
  );
}

// ═══════════════════════ 1 · บริษัท (+ สำรอง/กู้คืน) ══════════════════════════
// คีย์จริงที่ใช้ทั้งระบบ → backup/restore ครบจริง
const SETTINGS_KEYS = [
  "hq_company_profile", "hq_users_v4",
  "hq_dealer_settings", HQ_DEALERS_KEY, "hq_sales_journey", HQ_TARGETS_KEY,
  HQ_NOTIF_KEY, HQ_NOTIF_RULES_KEY, HQ_LEAD_RULES_KEY, "hq_system", HQ_POLICY_KEY,
];
function BackupCard() {
  const toast = useToast();
  function exportAll() {
    const out: Record<string, unknown> = {};
    SETTINGS_KEYS.forEach(k => { try { const s = localStorage.getItem(k); if (s) out[k] = JSON.parse(s); } catch {} });
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "benjamin-settings-backup.json"; a.click(); URL.revokeObjectURL(a.href);
    toast("ส่งออกการตั้งค่าแล้ว");
  }
  function importAll(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = ""; if (!file) return;
    const r = new FileReader();
    r.onload = () => { try { const obj = JSON.parse(String(r.result)); Object.entries(obj).forEach(([k, v]) => { if (SETTINGS_KEYS.includes(k)) localStorage.setItem(k, JSON.stringify(v)); }); toast("นำเข้าสำเร็จ — กำลังโหลดใหม่"); setTimeout(() => location.reload(), 900); } catch { toast("ไฟล์ไม่ถูกต้อง"); } };
    r.readAsText(file);
  }
  function restoreDefaults() {
    if (!confirm("คืนค่าเริ่มต้นทั้งหมด? การตั้งค่าปัจจุบันจะถูกลบ")) return;
    SETTINGS_KEYS.forEach(k => localStorage.removeItem(k)); location.reload();
  }
  return (
    <SectionCard icon={<RefreshCw size={19} />} title="สำรองและกู้คืนข้อมูล" desc="ส่งออก/นำเข้าการตั้งค่าทั้งหมดของสำนักงานใหญ่">
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 6 }}>
        <button className="btn btn-secondary btn-md" onClick={exportAll}><Download size={14} /> ส่งออก (สำรองข้อมูล)</button>
        <label className="btn btn-secondary btn-md" style={{ cursor: "pointer" }}><Upload size={14} /> นำเข้า (กู้คืน)<input type="file" accept="application/json" style={{ display: "none" }} onChange={importAll} /></label>
        <button className="btn btn-md" style={{ background: "#fff", color: "#dc2626", border: "1px solid #fecaca" }} onClick={restoreDefaults}><RotateCcw size={14} /> คืนค่าเริ่มต้นทั้งหมด</button>
      </div>
    </SectionCard>
  );
}
function CompanyTab() {
  return (
    <>
      <CompanyPanel embedded />
      <BackupCard />
    </>
  );
}

// ═══════════════════════ ROOT ═════════════════════════════════════════════════
// 7 หัวข้อตามสเปก — ไม่มี ความปลอดภัย / SLA / LSA / แบรนด์ / ธีม / AI / ส่วนลด
type TabKey = "company" | "users" | "journey" | "dealers" | "targets" | "rules" | "notifications";
const TABS: { key: TabKey; label: string; icon: ReactNode; render: () => ReactNode }[] = [
  { key: "company", label: "บริษัท", icon: <Building2 size={15} />, render: () => <CompanyTab /> },
  { key: "users", label: "ผู้ใช้งานและสิทธิ์", icon: <Users size={15} />, render: () => <UsersPanel embedded /> },
  { key: "journey", label: "เส้นทางการขาย", icon: <GitMerge size={15} />, render: () => <JourneyTab /> },
  { key: "dealers", label: "ตัวแทนจำหน่าย", icon: <Store size={15} />, render: () => <DealersTab /> },
  { key: "targets", label: "เป้าหมายยอดขาย", icon: <Target size={15} />, render: () => <TargetsTab /> },
  { key: "rules", label: "กฎธุรกิจ", icon: <Scale size={15} />, render: () => <BusinessRulesTab /> },
  { key: "notifications", label: "การแจ้งเตือน", icon: <Bell size={15} />, render: () => <NotificationsTab /> },
];

export default function HQSettingsPage() {
  const [tab, setTab] = useState<TabKey>("company");
  const [api, setApi] = useState<SectionApi | null>(null);
  const [toast, setToastMsg] = useState<string | null>(null);
  const report = useCallback((a: SectionApi | null) => setApi(a), []);
  const showToast = useCallback((m: string) => { setToastMsg(m); setTimeout(() => setToastMsg(null), 2400); }, []);
  const logAudit = useAuditLogger();
  const dirty = !!api?.dirty;

  function switchTab(next: TabKey) {
    if (next === tab) return;
    if (dirty && !confirm("ส่วนนี้ยังไม่บันทึก · ทิ้งที่แก้ไว้ไหม?")) return;
    setTab(next);
  }
  const active = TABS.find(t => t.key === tab)!;
  function saveAll() { if (dirty && api) { api.save(); logAudit("บันทึกการตั้งค่า", active.label); showToast("บันทึกการตั้งค่าแล้ว"); } }
  function resetAll() { if (dirty && api) api.reset(); }

  return (
    <BusCtx.Provider value={{ report, toast: showToast }}>
      <div className="erp">
        {/* ปุ่มบันทึก/รีเซ็ต → แถบบน (ชื่อหน้ามาจาก Topbar) — เลย์เอาต์เดียวกับหน้าตั้งค่าตัวแทน */}
        <TopbarActions>
          {dirty && <span style={{ fontSize: "0.72rem", color: "#d97706", fontWeight: 600 }}>ยังไม่บันทึก</span>}
          <button className="btn btn-secondary btn-sm" onClick={resetAll} disabled={!dirty} style={!dirty ? { opacity: .5, cursor: "not-allowed" } : undefined}><RotateCcw size={14} /> รีเซ็ต</button>
          <button className="btn btn-primary btn-sm" onClick={saveAll} disabled={!dirty} style={!dirty ? { opacity: .5, cursor: "not-allowed" } : undefined}><Save size={14} /> บันทึก</button>
        </TopbarActions>
        <p className="page-sub">Enterprise Administration · สิ่งที่แก้ในหน้านี้จะมีผลกับตัวแทนจำหน่ายตามสิทธิ์ที่ได้รับ</p>

        {/* แท็บแนวนอน */}
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="tab-bar" style={{ overflowX: "auto" }}>
            {TABS.map(t => (
              <button key={t.key} onClick={() => switchTab(t.key)}
                className={`tab-item${tab === t.key ? " active" : ""}`}
                style={{ display: "flex", alignItems: "center", gap: 7, whiteSpace: "nowrap" }}>
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Active section — ห่อด้วย section-stack ให้การ์ดทุกใบห่างเท่ากัน */}
        <div className="section-stack" style={{ minWidth: 0 }}>
          {active.render()}
        </div>

        {/* Toast */}
        {toast && (
          <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999, background: "#111827", color: "#fff", padding: "12px 18px", borderRadius: 12, fontSize: "0.82rem", fontWeight: 600, boxShadow: "0 12px 32px rgba(0,0,0,.28)", display: "flex", alignItems: "center", gap: 9 }}>
            <Check size={15} color="#7ee2b8" /> {toast}
          </div>
        )}
      </div>
    </BusCtx.Provider>
  );
}
