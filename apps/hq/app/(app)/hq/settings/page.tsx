"use client";

// ─── HQ · ตั้งค่า (Enterprise Administration) ──────────────────────────────────
// แท็บแนวนอน 6 หัวข้อ (เลย์เอาต์เดียวกับหน้าตั้งค่าตัวแทน /settings):
//   บริษัท · ผู้ใช้งานและสิทธิ์ · เส้นทางการขาย · ตัวแทนจำหน่าย · เป้าหมายยอดขาย · การแจ้งเตือน
// แท็บ "กฎธุรกิจ" ถูกยุบเข้า "เส้นทางการขาย" (เหลือ: เหตุผลปิดไม่สำเร็จ) — คีย์ localStorage เดิมทุกตัว ค่าที่ตั้งไว้ไม่หาย
// การ์ดที่เป็นข้อความนโยบายล้วน ๆ (นโยบายราคา · ประเภทสินค้าและแม่แบบ) บอสสั่งลบ 17 ก.ค. 69 — ไม่มีช่องตั้งค่า ไม่ต้องมีในหน้าตั้งค่า
// การ์ด "กฎใบเสนอราคา" (VAT · อายุใบ · เลขที่) บอสสั่งลบ 17 ก.ค. 69 — ค่ายังทำงานอยู่แต่ตรึงที่ค่าตั้งต้น แก้ผ่านหน้าจอไม่ได้แล้ว
// ตัวแทนไม่มีสิทธิ์เข้าหน้านี้ · ทุกอย่างชิดซ้าย · ปุ่มบันทึก/รีเซ็ตอยู่บนแถบบน
//
// ไม่มีในหน้านี้ (ตัดตามสเปก): สินทรัพย์แบรนด์ · โลโก้/ธีม/สี/ฟอนต์ · ความปลอดภัย · SLA · LSA · AI · ส่วนลด
//
// กติกาของหน้านี้: ทุกช่องตั้งค่าต้องมีโค้ดอ่านไปใช้จริง — ห้ามมีช่องที่กดแล้วไม่เกิดอะไร
//   (เกณฑ์ 48 ชม. / 7 วัน ย้ายไปหน้าตั้งค่าของตัวแทนแล้ว — ตัวแทนตั้งเอง แยกรายสาขา)
//   กฎแจ้งเตือน 6 ข้อ     → กระดิ่ง HQ (ผ่าน @pms/shared/lib/hqAlerts)
//   เหตุผลปิดไม่สำเร็จ     → ตัวเลือกตอนปิดดีลของตัวแทน (loadLostReasons)
//   เป้าทั้งปี            → แดชบอร์ด HQ + แดชบอร์ดตัวแทน
import {
  useState, useEffect, useRef, useCallback, useMemo, useContext,
  type ReactNode, type Dispatch, type SetStateAction,
} from "react";
import { useRouter } from "next/navigation";
import { usePersistentState } from "@pms/shared/lib/usePersistentState";
import { useRepoState } from "@pms/shared/lib/useRepoState";
import { useDealerPerformance, EMPTY_PERF } from "@pms/shared/lib/useDealerPerformance";
import { settings as settingsRepo, dealers as dealersRepo, hqCompany as hqCompanyRepo, catalog as catalogRepo } from "@pms/shared/lib/data";
import { APP_NOW_ISO } from "@pms/shared/context/FilterContext";
import type { HQCompany } from "@pms/shared/lib/data/types";
import { AdminGate } from "@pms/shared/components/layout/AdminGate";
import {
  HQ_POLICY_KEY, DEFAULT_HQ_POLICY,
  HQ_TARGETS_KEY, DEFAULT_HQ_TARGETS,
  HQ_NOTIF_KEY, HQ_NOTIF_EVENTS, DEFAULT_HQ_NOTIFS, HQ_NOTIF_UPDATED_EVENT,
  HQ_NOTIF_RULES_KEY, DEFAULT_HQ_NOTIF_RULES, HQ_DEALERS_KEY, loadHQDealers,
  HQ_ALERT_META, leadStatusLabel, leadStatusColor, LEAD_TASK_TEMPLATE,
  HQ_SYSTEM_KEY, DEFAULT_QUOTE_NUMBERING, HQ_JOURNEY_KEY, LOST_REASONS,
  type SolutionProduct,
  type HQPolicy, type HQTargets, type HQNotifChannels, type HQNotifRules,
  type HQAlertKey, type DealerRow, type LeadStatus,
} from "@pms/shared/lib/mock";
// แท็บ "บริษัท" / "ผู้ใช้งาน" ฝังหน้าจัดการจริงเต็ม
import { CompanyPanel } from "@pms/shared/components/hq/CompanyPanel";
import { UsersPanel } from "@pms/shared/components/hq/UsersPanel";
import { TopbarActions } from "@pms/shared/components/layout/TopbarActions";
import { useAuditLogger } from "@pms/shared/lib/useAudit";
import { useUnsavedGuard } from "@pms/shared/lib/useUnsavedGuard";
import { SettingsBusCtx as BusCtx, type SectionApi } from "@pms/shared/lib/settingsBus";
import {
  Building2, Users, GitMerge, Target, Bell,
  Save, RotateCcw, Plus, Trash2, Check, X,
  Download, Upload, RefreshCw, Mail, Smartphone, Lock, AlertCircle,
  ShieldCheck,
} from "lucide-react";

// ── tokens (Benjamin CI) ────────────────────────────────────────────────────
const NAVY = "#003366";   // Dark Blue — สีหลัก
const STEEL = "#2D2D2D";  // Steel Gray — ตัวอักษรเข้ม
const SILVER = "#C0C0C0"; // Silver — เส้นแบ่ง / ค่าว่าง

// ── shared bus (report dirty/save/reset ของแท็บที่ active + toast) — ดู @pms/shared/lib/settingsBus
function useReport(api: SectionApi) {
  const { report } = useContext(BusCtx);
  useEffect(() => { report(api); return () => report(null); }, [api, report]);
}
function useToast() { return useContext(BusCtx).toast; }

// draft = state ที่แก้ไขได้ + เทียบกับค่าที่บันทึกไว้ (dirty) → ใช้กับ Save/Reset กลาง
function useDraft<T>(saved: T, setSaved: Dispatch<SetStateAction<T>>) {
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
// draft ที่ persist ผ่าน repository (local: localStorage · supabase: DB · RLS is_hq) — นโยบาย/เป้า/กฎแจ้งเตือน
function useRepoDraft<T>(load: () => Promise<T>, save: (v: T) => void, initial: T) {
  const [saved, setSaved] = useRepoState<T>(load, save, initial);
  return useDraft(saved, setSaved);
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
// เหตุผลปิดการขายไม่สำเร็จ — ขั้น "ปิดไม่สำเร็จ" เป็นปลายทางหนึ่งของเส้นทางการขาย จึงอยู่แท็บนี้
// (เดิมอยู่แท็บ "กฎธุรกิจ" ซึ่งยุบไปแล้ว — คีย์ hq_sales_journey เหมือนเดิม ค่าที่ตั้งไว้ไม่หาย)
// เก็บผ่าน repository — เดิมเขียนลง localStorage ของ origin ฝั่ง HQ ซึ่งตัวแทน (คนละ origin)
// อ่านไม่เห็นเลย รายการที่ตั้งไว้จึงไม่เคยมีผลกับใคร (ค่าเริ่มต้นใช้ LOST_REASONS แหล่งเดียวกับตัวแทน)
type Journey = { lost: string[] };
const DEFAULT_JOURNEY: Journey = { lost: [...LOST_REASONS] };

function JourneyTab() {
  // ทุกกฎของเส้นทางการขายรวมที่แท็บนี้: นโยบาย (VAT/อายุใบ) · เหตุผลปิดไม่สำเร็จ
  // (เดิมมี sys=เลขรันใบเสนอราคาใน localStorage แต่การ์ดที่แก้ค่านั้นถูกลบไปแล้ว → เป็น plumbing ตาย ตัดออก · L6)
  const pol = useRepoDraft<HQPolicy>(() => settingsRepo.getPolicy(), (v) => settingsRepo.savePolicy(v), DEFAULT_HQ_POLICY);
  const jn = useRepoDraft<Journey>(
    async () => ({ lost: await settingsRepo.getLostReasons() }),
    (v) => { void settingsRepo.saveLostReasons(v.lost); },
    DEFAULT_JOURNEY,
  );
  const [newLost, setNewLost] = useState("");
  const saveAll = useCallback(() => { pol.save(); jn.save(); }, [pol.save, jn.save]);
  useReport(useMemo(() => ({
    dirty: pol.dirty || jn.dirty,
    save: saveAll,
    reset: () => { pol.reset(); jn.reset(); },
  }), [pol.dirty, jn.dirty, saveAll, pol.reset, jn.reset]));

  const addLost = () => { if (newLost.trim()) { jn.set(p => ({ ...p, lost: [...p.lost, newLost.trim()] })); setNewLost(""); } };
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

      {/* การ์ด "กฎการดูแลลูกค้าเป้าหมาย" (48 ชม. / 7 วัน) ถูกย้ายไปหน้าตั้งค่าของตัวแทนตามคำสั่ง
          เจ้าของกฎเปลี่ยนจาก HQ → ตัวแทน และแยกเป็นรายสาขา (ตั้งที่ /settings → การแจ้งเตือน)
          HQ ตั้งเกณฑ์นี้ให้ตัวแทนไม่ได้แล้ว · หน้า HQ อ่านเกณฑ์ของแต่ละสาขามาแสดงแทน (ผ่าน useLeadRulesOf)
          ⚠️ อย่าใส่กลับมาที่นี่ — จะกลายเป็นสองแหล่งที่ขัดกันเอง */}

      {/* การ์ด "กฎใบเสนอราคา (Quotation Rules)" ถูกลบตามคำสั่ง (17 ก.ค. 69)
          ค่าที่การ์ดนี้เคยแก้ได้ยังทำงานอยู่ แต่ตอนนี้ตรึงที่ค่าตั้งต้น แก้ผ่านหน้าจอไม่ได้แล้ว:
          · VAT 7%              (DEFAULT_HQ_POLICY.vat) — ใช้คิดภาษีในใบเสนอราคาทุกใบ
          · อายุใบเสนอราคา 30 วัน (DEFAULT_HQ_POLICY.quoteValidityDays) — ใช้คิดวันหมดอายุ
          · เลขที่ Q-2026- / 1101 (DEFAULT_QUOTE_NUMBERING) — ใช้ออกเลขใบเสนอราคาใหม่
          pol/sys ยังคงอยู่ เพราะกลไกบันทึกรวมของหน้านี้ (saveAll/dirty/reset) ใช้ร่วมกับการ์ดอื่น */}

      {/* เหตุผลปิดการขายไม่สำเร็จ — ปลายทาง "ปิดไม่สำเร็จ" ของเส้นทางการขาย (ย้ายมาจากแท็บ "กฎธุรกิจ") */}
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


    </>
  );
}


// ═══════════════════════ 5 · เป้าหมายยอดขาย ═══════════════════════════════════
// เป้าทั้งปี = แหล่งเดียว (แดชบอร์ด HQ/ตัวแทนอ่านค่านี้) · ไตรมาส/เดือน = แบ่งจากเป้าทั้งปี
// เป้ารายตัวแทน = DealerRow.revenueTarget (ตั้งที่หน้า “ตัวแทน”) · ความคืบหน้า = ยอดจริงเทียบเป้า
// ไม่มี "คาดการณ์" (Forecast) — ระบบไม่มีข้อมูลคาดการณ์ (ไม่มีวันคาดปิดการขาย / ค่าความน่าจะเป็น)
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
  const { draft, set, dirty, save, reset } = useRepoDraft<HQTargets>(() => settingsRepo.getTargets(), (v) => settingsRepo.saveTargets(v), DEFAULT_HQ_TARGETS);
  // แท็บนี้ "อ่านอย่างเดียว" — เป้ารายตัวแทนแก้ที่แท็บตัวแทนจำหน่าย/หน้า /hq/dealers
  // ห้ามใช้ usePersistentState: มันเขียนกลับตอน mount → กลายเป็นคนเขียน hq_dealers_v3 คนที่ 3
  // ทั้งที่ไม่เคยแก้ตัวแทนเลย (กติกาเดียวกับที่ mock.ts:893 เตือนไว้)
  const [dealers, setDealers] = useState<DealerRow[]>([]); // ของจริงมาจาก repo — ห้ามตั้งต้นด้วย seed
  // "ทำได้จริง" = ยอดจากใบที่ปิดการขายได้ ไม่ใช่คอลัมน์ revenue_actual ที่ seed ไว้
  const perf = useDealerPerformance();
  const actualOf = (code: string) => (perf.get(code) ?? EMPTY_PERF).revenue;
  useEffect(() => { dealersRepo.list().then(setDealers).catch(() => {}); }, []);
  useReport(useMemo(() => ({ dirty, save, reset }), [dirty, save, reset]));

  // รวมเป้า/ผลจริงตามพื้นที่ — มาจากเป้ารายตัวแทนที่ตั้งไว้จริง ไม่ได้กุตัวเลข
  const byRegion = useMemo(() => {
    const m = new Map<string, { target: number; actual: number; dealers: number }>();
    dealers.forEach(d => {
      const k = regionDisplay(d.region) || "ไม่ระบุ";
      const r = m.get(k) ?? { target: 0, actual: 0, dealers: 0 };
      r.target += d.revenueTarget; r.actual += actualOf(d.code); r.dealers += 1;
      m.set(k, r);
    });
    return [...m.entries()].map(([key, v]) => ({ key, ...v }));
  }, [dealers]);
  const byDealer = useMemo(() => dealers.map(d => ({ key: `${d.code} · ${d.name}`, target: d.revenueTarget, actual: actualOf(d.code), dealers: 1 })), [dealers, perf]);

  const totalActual = dealers.reduce((s, d) => s + actualOf(d.code), 0);
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

        {/* ไตรมาส/เดือน = แบ่งจากเป้าทั้งปี — ไม่ให้ตั้งแยก จะได้ไม่ขัดกับเป้าทั้งปี
            ไม่มีการ์ด "เป้าทั้งปี" ซ้ำตรงนี้ — ค่านั้นคือช่องกรอกด้านบนอยู่แล้ว และมันไม่ใช่ "ส่วนที่แบ่งมา" */}
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "#6b7280", marginBottom: 8 }}>แบ่งจากเป้าทั้งปี</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
            {[
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

// ═══════════════════════ 7 · การแจ้งเตือน ═════════════════════════════════════
// 2 การ์ด:
//  1) กฎแจ้งเตือน 6 เรื่อง — คำนวณจากข้อมูลจริง แล้วขึ้นกระดิ่ง HQ (ดู @pms/shared/lib/hqAlerts)
//  2) บันทึกการใช้งาน — หมวดจาก Audit Log ที่กรองกระดิ่ง HQ (Topbar อ่าน hqAuditCategory + inapp)
// ช่องทาง = อีเมล + ในระบบ เท่านั้น (ไลน์ถูกตัดตามสเปก)
type Notifs = Record<string, HQNotifChannels>;
const CHANNELS: { k: keyof HQNotifChannels; label: string }[] = [
  { k: "email", label: "อีเมล" },
  { k: "inapp", label: "ในระบบ" },
];
// เกณฑ์ของแต่ละกฎ (ถ้ามี) — "ผู้รับผิดชอบ" ใช้เกณฑ์จาก "เส้นทางการขาย" จึงไม่มีช่องกรอกซ้ำที่นี่
// ลีดเงียบมีเกณฑ์ของ HQ เอง (คนละตัวกับกฎติดตาม 7 วันที่บังคับตัวแทน — ดู @pms/shared/lib/hqAlerts)
type NumRuleKey = Exclude<keyof HQNotifRules, "alerts" | "channels">;
const ALERT_THRESHOLD: Partial<Record<HQAlertKey, { field: NumRuleKey; unit: string }[]>> = {
  idleLead:       [{ field: "leadIdleDays",      unit: "วัน" }],
  quoteExpiring:  [{ field: "quoteExpiringDays", unit: "วัน" }],
  dealerIdle:     [{ field: "dealerIdleDays",    unit: "วัน" }],
  targetAchieved: [{ field: "targetAchievedPct", unit: "% ของเป้า" }],
  // ต้องมีทั้ง % และกลุ่มตัวอย่างขั้นต่ำ — ตัวแทนที่ปิดลีดใบเดียวแล้วแพ้ได้ 100% ทันที ซึ่งไม่ได้แปลว่าแย่
  lostRate:       [{ field: "lostRatePct",       unit: "%" }, { field: "lostRateMinClosed", unit: "ลีดขึ้นไป" }],
};

function NotificationsTab() {
  // ช่องทางแจ้งเตือน (อีเมล/ในระบบ) เก็บรวมกับ hq_notif_rules ใน DB แล้ว
  // เดิมอยู่ใน localStorage คีย์ hq_notifications_v2 → ผู้ดูแลคนหนึ่งตั้งไว้ อีกคนไม่เห็น
  const rules = useRepoDraft<HQNotifRules>(() => settingsRepo.getNotifRules(), (v) => settingsRepo.saveNotifRules(v), DEFAULT_HQ_NOTIF_RULES);
  const chDraft: Notifs = { ...DEFAULT_HQ_NOTIFS, ...(rules.draft.channels ?? {}) };
  const setCh = (key: string, patch: Partial<HQNotifChannels>) =>
    rules.set(p => ({ ...p, channels: { ...DEFAULT_HQ_NOTIFS, ...(p.channels ?? {}), [key]: { ...DEFAULT_HQ_NOTIFS[key], ...(p.channels?.[key] ?? {}), ...patch } } }));
  // บันทึกแล้วยิง event → กระดิ่ง HQ อัปเดตทันที (Topbar ฟัง HQ_NOTIF_UPDATED_EVENT)
  // dep ต้องเป็น "ฟังก์ชันข้างใน" ไม่ใช่ตัวกล่องที่ usePersistentDraft คืนมา
  // กล่องเป็น object literal ใหม่ทุกเรนเดอร์ → ถ้า dep เป็น rules/ch ทั้งก้อน saveAndBroadcast
  // จะใหม่ทุกเรนเดอร์ → useMemo ของ api ใหม่ → useReport ยิง setApi → เรนเดอร์ใหม่ = วนไม่จบ
  const saveAndBroadcast = useCallback(() => {
    rules.save();
    window.dispatchEvent(new Event(HQ_NOTIF_UPDATED_EVENT));
  }, [rules.save]);
  useReport(useMemo(() => ({
    dirty: rules.dirty,
    save: saveAndBroadcast,
    reset: () => rules.reset(),
  }), [rules.dirty, saveAndBroadcast, rules.reset]));

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
                {/* ช่องเกณฑ์ + ช่องทาง — ปิดกฎแล้วจาง สื่อว่าไม่ถูกใช้ · บางกฎมีเกณฑ์มากกว่า 1 ช่อง จึงเรียงลง */}
                <div style={{ flex: "0 0 176px", display: "flex", flexDirection: "column", gap: 6, opacity: pref.on ? 1 : .4, pointerEvents: pref.on ? "auto" : "none", transition: "opacity .15s" }}>
                  {th?.map(t => (
                    <div key={t.field}>{numInput(rules.draft[t.field], n => rules.set(p => ({ ...p, [t.field]: n })), t.unit)}</div>
                  ))}
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
                  <Toggle on={chDraft[ev.key]?.[c.k] ?? false}
                    onChange={() => setCh(ev.key, { [c.k]: !chDraft[ev.key]?.[c.k] })} />
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
// สำรอง/กู้คืนอ่าน-เขียนผ่าน repo ทั้งหมด (ดู exportAll/importAll) ไม่พึ่งรายชื่อคีย์ localStorage อีกแล้ว
function BackupCard() {
  const toast = useToast();

  // สำรอง/กู้คืน "ค่าจริงที่ระบบใช้อยู่" — อ่านผ่าน repo ทั้งหมด
  // เดิมอ่าน/เขียน localStorage ตรง ๆ ซึ่งพังไปแล้วตั้งแต่ค่าพวกนี้ย้ายเข้า DB:
  //   ส่งออกได้ไฟล์ว่าง · นำเข้าไม่มีผล · "คืนค่าเริ่มต้น" ขึ้น confirm แล้วไม่เกิดอะไรขึ้น
  async function exportAll() {
    try {
      const [policy, targets, notifRules, lostReasons, company, dealers, catalog] = await Promise.all([
        settingsRepo.getPolicy(), settingsRepo.getTargets(), settingsRepo.getNotifRules(),
        settingsRepo.getLostReasons(), hqCompanyRepo.get(), dealersRepo.list(), catalogRepo.list(),
      ]);
      const out = { version: 1, exportedAt: APP_NOW_ISO, policy, targets, notifRules, lostReasons, company, dealers, catalog };
      const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = "benjamin-settings-backup.json"; a.click();
      URL.revokeObjectURL(a.href);
      toast("ส่งออกการตั้งค่าแล้ว");
    } catch (e) {
      toast("ส่งออกไม่สำเร็จ: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  function importAll(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = ""; if (!file) return;
    const r = new FileReader();
    r.onload = async () => {
      let obj: Record<string, unknown>;
      try { obj = JSON.parse(String(r.result)) as Record<string, unknown>; }
      catch { toast("ไฟล์ไม่ถูกต้อง"); return; }
      // เขียนเฉพาะส่วนที่มีในไฟล์ — ไฟล์เก่าที่ไม่มีบางหัวข้อต้องไม่ไปล้างของที่ตั้งไว้แล้ว
      try {
        const jobs: Promise<unknown>[] = [];
        if (obj.policy)       jobs.push(settingsRepo.savePolicy(obj.policy as HQPolicy));
        if (obj.targets)      jobs.push(settingsRepo.saveTargets(obj.targets as HQTargets));
        if (obj.notifRules)   jobs.push(settingsRepo.saveNotifRules(obj.notifRules as HQNotifRules));
        if (Array.isArray(obj.lostReasons)) jobs.push(settingsRepo.saveLostReasons(obj.lostReasons as string[]));
        if (obj.company)      jobs.push(hqCompanyRepo.save(obj.company as HQCompany));
        if (Array.isArray(obj.dealers)) jobs.push(dealersRepo.save(obj.dealers as DealerRow[]));
        if (Array.isArray(obj.catalog)) jobs.push(catalogRepo.save(obj.catalog as SolutionProduct[]));
        await Promise.all(jobs);
        toast("นำเข้าสำเร็จ — กำลังโหลดใหม่");
        setTimeout(() => location.reload(), 900);
      } catch (err) {
        toast("นำเข้าไม่สำเร็จ: " + (err instanceof Error ? err.message : String(err)));
      }
    };
    r.readAsText(file);
  }

  async function restoreDefaults() {
    if (!confirm("คืนค่าเริ่มต้นของนโยบาย เป้าหมาย กฎแจ้งเตือน และเหตุผลปิดการขาย?\n\nทะเบียนตัวแทนและแคตตาล็อกจะไม่ถูกแตะ")) return;
    try {
      await Promise.all([
        settingsRepo.savePolicy(DEFAULT_HQ_POLICY),
        settingsRepo.saveTargets(DEFAULT_HQ_TARGETS),
        settingsRepo.saveNotifRules(DEFAULT_HQ_NOTIF_RULES),
        settingsRepo.saveLostReasons([...LOST_REASONS]),
      ]);
      toast("คืนค่าเริ่มต้นแล้ว — กำลังโหลดใหม่");
      setTimeout(() => location.reload(), 900);
    } catch (e) {
      toast("คืนค่าไม่สำเร็จ: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  return (
    <SectionCard icon={<RefreshCw size={19} />} title="สำรองและกู้คืนข้อมูล" desc="ส่งออก/นำเข้าการตั้งค่าทั้งหมดของสำนักงานใหญ่">
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 6 }}>
        <button className="btn btn-secondary btn-md" onClick={() => void exportAll()}><Download size={14} /> ส่งออก (สำรองข้อมูล)</button>
        <label className="btn btn-secondary btn-md" style={{ cursor: "pointer" }}><Upload size={14} /> นำเข้า (กู้คืน)<input type="file" accept="application/json" style={{ display: "none" }} onChange={importAll} /></label>
        <button className="btn btn-md" style={{ background: "#fff", color: "#dc2626", border: "1px solid #fecaca" }} onClick={() => void restoreDefaults()}><RotateCcw size={14} /> คืนค่าเริ่มต้น (นโยบาย/เป้า/แจ้งเตือน)</button>
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
// ไม่มี ความปลอดภัย / SLA / LSA / แบรนด์ / ธีม / AI / ส่วนลด
// แท็บ "ตัวแทนจำหน่าย" ถูกยุบตามคำสั่ง — ทั้งใบซ้ำกับหน้า /hq/dealers (ตารางบัญชี · สลับสถานะ · เข้าระบบแทน)
//   "รีเซ็ตรหัสผ่าน" ย้ายไปอยู่ในโมดัล "รหัสเข้าระบบ" ของหน้า /hq/dealers แล้ว (ไม่มีที่อื่นมาก่อน)
//   "ค่ามาตรฐานตัวแทน" (defaultQuota) ถูกลบ — ไม่มีใครอ่านค่านั้นเลย ค่าจริงตอนสร้างตัวแทนอยู่ที่ /hq/dealers
type TabKey = "company" | "users" | "journey" | "targets" | "notifications";
const TABS: { key: TabKey; label: string; icon: ReactNode; render: () => ReactNode }[] = [
  { key: "company", label: "บริษัท", icon: <Building2 size={15} />, render: () => <CompanyTab /> },
  { key: "users", label: "ผู้ใช้งานและสิทธิ์", icon: <Users size={15} />, render: () => <UsersPanel embedded /> },
  { key: "journey", label: "เส้นทางการขาย", icon: <GitMerge size={15} />, render: () => <JourneyTab /> },
  { key: "targets", label: "เป้าหมายยอดขาย", icon: <Target size={15} />, render: () => <TargetsTab /> },
  { key: "notifications", label: "การแจ้งเตือน", icon: <Bell size={15} />, render: () => <NotificationsTab /> },
];

// ตั้งค่าส่วนกลาง (ผู้ใช้/นโยบาย/เป้า/ตัวแทน) = ต้องมีสิทธิ์ hq:all_data — HQ_STAFF เข้าไม่ได้
export default function HQSettingsPage() {
  return <AdminGate perm="hq:all_data"><HQSettingsPageInner /></AdminGate>;
}
function HQSettingsPageInner() {
  const [tab, setTab] = useState<TabKey>("company");
  const [api, setApi] = useState<SectionApi | null>(null);
  const [toast, setToastMsg] = useState<string | null>(null);
  const report = useCallback((a: SectionApi | null) => setApi(a), []);
  const showToast = useCallback((m: string) => { setToastMsg(m); setTimeout(() => setToastMsg(null), 2400); }, []);
  const logAudit = useAuditLogger();
  const dirty = !!api?.dirty;
  // เตือนตอนออกจากหน้า/ปิดแท็บด้วย — switchTab ข้างล่างเตือนแค่ตอนสลับแท็บในหน้าเดียวกัน
  useUnsavedGuard(dirty);

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
