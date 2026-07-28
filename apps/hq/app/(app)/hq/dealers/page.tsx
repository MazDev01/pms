"use client";

import { useState } from "react";
import { AdminGate } from "@pms/shared/components/layout/AdminGate";
import {
  HQ_TARGETS_KEY, DEFAULT_HQ_TARGETS, dealerStatusLabel, dealerStatusColor,
  type DealerRow, type DealerCredentials, type HQTargets, type DealerStatus,
} from "@pms/shared/lib/mock";
import { useRepoState, useRepoValue } from "@pms/shared/lib/useRepoState";
import { DATA_SOURCE } from "@pms/shared/lib/data/config";
import { dealers as dealersRepo, settings as settingsRepo } from "@pms/shared/lib/data";
import { createDealerAccount, deleteDealerAccount } from "@pms/shared/lib/adminApi";
import { useDealerPerformance, EMPTY_PERF } from "@pms/shared/lib/useDealerPerformance";
import { useRole } from "@pms/shared/context/RoleContext";
import { useAuditLogger } from "@pms/shared/lib/useAudit";
import { ExportMenu } from "@pms/shared/components/ui/ExportMenu";
import { useRouter } from "next/navigation";
import { Plus, Search, X, Copy, Check, Key, LogIn, Pencil, Trash2, EyeOff, Eye, AlertTriangle, BarChart2, TrendingUp, Trophy, Target, Award, Clock, Store, Coins, Briefcase } from "lucide-react";

const CARD: React.CSSProperties = { background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", boxShadow: "0 2px 14px rgba(0,51,102,.07)" };
const REGIONS = ["เหนือ", "กลาง", "ตะวันออก", "ตะวันตก", "ใต้", "อีสาน"];

// เป้ายอดขายรายปี "ค่าเริ่มต้นแนะนำ" ตามศักยภาพตลาดของแต่ละภาค — ช่วย HQ ตอนเพิ่มสาขาใหม่ (แก้ทับได้)
const REGION_TARGET_DEFAULT: Record<string, number> = {
  "ตะวันออก": 42_000_000, // อุตสาหกรรมหนาแน่น (ระยอง/ชลบุรี)
  "เหนือ":    42_000_000,
  "กลาง":     36_000_000,
  "ตะวันตก":  35_000_000,
  "อีสาน":    32_000_000,
  "ใต้":      27_000_000, // ตลาดเล็กกว่า
};
const regionDefaultTarget = (region: string) => REGION_TARGET_DEFAULT[region] ?? 30_000_000;

// ── Dealer status ───────────────────────────────────────────────
// คำเรียก/สี มาจาก @pms/shared/lib/mock (แหล่งเดียว) — หน้ารายละเอียดตัวแทนใช้ชุดเดียวกัน
// สถานะจริงมี 2 ค่าเท่านั้นตาม DealerRow.status — ไม่มี "ระงับ" (ดูเหตุผลใน mock.ts)
const dealerStatus = (d: { status: DealerStatus }): DealerStatus => d.status;
const STATUS_PILLS: { value: DealerStatus | "all"; label: string }[] = [
  { value: "all",      label: "ทั้งหมด" },
  { value: "active",   label: dealerStatusLabel.active },
  { value: "inactive", label: dealerStatusLabel.inactive },
];

function StatusBadge({ status }: { status: DealerStatus }) {
  const c = dealerStatusColor[status];
  return <span className="badge" style={{ background: c.bg, color: c.color }}>{dealerStatusLabel[status]}</span>;
}

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
      <div style={{ fontSize: "0.65rem", color: "#6b7280", marginTop: 2 }}>
        เป้า ฿{(target / 1_000_000).toFixed(0)}M
      </div>
    </div>
  );
}

// ยังไม่มีข้อมูลให้วัด = "—" (null) · ห้ามแสดง 0% เพราะ 0% แปลว่า "วัดแล้วได้ศูนย์"
function OnTimeBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span style={{ color: "#C0C0C0", fontSize: "0.8rem" }}>—</span>;
  const color = pct >= 85 ? "#059669" : pct >= 70 ? "#f59e0b" : "#dc2626";
  return (
    <span className="badge" style={{ background: color + "22", color }}>
      {pct}%
    </span>
  );
}

// secret = ปิดบังค่าไว้ก่อน ต้องกดตาถึงเห็น (ยังคัดลอกได้โดยไม่ต้องเปิดดู)
// ใช้กับรหัสผ่านในแผงรายละเอียดตัวแทน — เดิมโชว์ "PEB-CNX-3317" เต็ม ๆ ทันทีที่เปิดแถว
// ใครเดินผ่านหลังจอ/แชร์หน้าจอ/ถ่ายภาพหน้าจอ ก็ได้รหัสเข้าระบบของตัวแทนไปเลย
// (โมดัลตอนสร้าง/รีเซ็ตยังโชว์เต็มโดยตั้งใจ — เป็นจังหวะเดียวที่ HQ ต้องอ่านไปแจ้งตัวแทน)
function CopyField({ label, value, secret = false }: { label: string; value: string; secret?: boolean }) {
  const [copied, setCopied] = useState(false);
  const [shown, setShown] = useState(false);
  const masked = secret && !shown;
  function doCopy() {
    navigator.clipboard.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: "0.72rem", color: "#6b7280", marginBottom: 4, fontWeight: 600 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#f0f4f8", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 11px" }}>
        <span style={{ flex: 1, fontFamily: "monospace", fontSize: "0.86rem", fontWeight: 700, color: "#2D2D2D", letterSpacing: "0.03em" }}>
          {masked ? "••••••••••••" : value}
        </span>
        {secret && (
          <button type="button" onClick={() => setShown(v => !v)} aria-label={shown ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"} title={shown ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", padding: 0, display: "flex" }}>
            {shown ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
        <button type="button" onClick={doCopy} aria-label={`คัดลอก${label}`} title={`คัดลอก${label}`}
          style={{ background: "none", border: "none", cursor: "pointer", color: copied ? "#059669" : "#6b7280", padding: 0, display: "flex" }}>
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

const INPUT_STYLE: React.CSSProperties = { width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px solid #e5e7eb", fontSize: "0.8rem", color: "#2D2D2D", outline: "none", background: "#fafafa", boxSizing: "border-box" };

function genCredentials(code: string): DealerCredentials {
  const digits = String(1000 + ((code.charCodeAt(0) * 37 + code.charCodeAt(1) * 17) % 9000));
  return { email: `${code.toLowerCase()}@partner-agent.co.th`, password: `PEB-${code}-${digits}` };
}

// รหัสผ่านใหม่ตอนรีเซ็ต — deterministic (ไม่สุ่ม) เดโมจึงทวนซ้ำได้
// nonce = ความยาวรหัสเดิม → กดรีเซ็ตซ้ำได้รหัสใหม่เรื่อย ๆ ไม่วนกลับมาซ้ำของเดิม
// ฟอร์แมตเดียวกับ genCredentials: PEB-{รหัส}-{4 หลัก}
function genResetPassword(code: string, nonce: number): string {
  const sum = code.split("").reduce((s, c) => s + c.charCodeAt(0), 0) + nonce * 7;
  return `PEB-${code}-${1000 + (sum % 9000)}`;
}

// ── Main page ───────────────────────────────────────────────────

// จัดการตัวแทน (แก้ไข/รีเซ็ตรหัส/ลบ) = ต้องมีสิทธิ์ dealers:manage — HQ_STAFF เข้าไม่ได้
export default function HQDealersPage() {
  return <AdminGate perm="dealers:manage"><HQDealersPageInner /></AdminGate>;
}
function HQDealersPageInner() {
  const { login } = useRole();
  const logAudit = useAuditLogger(); // บันทึกการกระทำของ admin
  const router = useRouter();

  const [dealers, setDealers] = useRepoState<DealerRow[]>(() => dealersRepo.list(), (v) => dealersRepo.save(v), []);
  // เกณฑ์สี Win rate / ตรงเวลา = เป้าที่ HQ ตั้งไว้ (แหล่งเดียว) ไม่ hardcode
  const targets = useRepoValue<HQTargets>(() => settingsRepo.getTargets(), DEFAULT_HQ_TARGETS);
  const [q, setQ] = useState("");
  const [regionFilter, setRegionFilter] = useState("ทั้งหมด");
  const [statusFilter, setStatusFilter] = useState<DealerStatus | "all">("all");

  // Modals
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<DealerRow | null>(null);
  const [form, setForm] = useState({ code: "", name: "", province: "", region: "กลาง", revenueTarget: 0, status: "active" as "active" | "inactive" });
  // ผู้ใช้แก้ช่องเป้าเองหรือยัง — ถ้ายัง เปลี่ยนภาคจะเติมค่าเริ่มต้นตามภาคให้ (โหมดเพิ่มใหม่เท่านั้น)
  const [targetTouched, setTargetTouched] = useState(false);
  const [formErr, setFormErr] = useState("");
  const [creating, setCreating] = useState(false); // กำลังสร้างบัญชีที่เซิร์ฟเวอร์ — กันกดปุ่มซ้ำระหว่างรอ
  // โมดัลเดียวใช้ 2 กรณี — สร้างตัวแทนใหม่ / รีเซ็ตรหัสผ่าน · ข้อความต้องตรงกับสิ่งที่เพิ่งเกิดจริง
  const [credsModal, setCredsModal] = useState<{ name: string; creds: DealerCredentials; mode: "created" | "reset" } | null>(null);
  const [viewCredsDealer, setViewCredsDealer] = useState<DealerRow | null>(null);
  const [entering, setEntering] = useState<string | null>(null);
  const [selectedDealer, setSelectedDealer] = useState<DealerRow | null>(null);

  // ผลงานจริงจากใบเสนอราคา/ลีด — ห้ามอ่าน d.revenueActual / d.winRate / d.activeProjects อีก
  // (คอลัมน์พวกนั้นเป็นค่าเดโมที่ seed ไว้ ไม่ขยับตามข้อมูลจริง และขัดกับหน้าแดชบอร์ด)
  const perf = useDealerPerformance();
  const perfOf = (code: string) => perf.get(code) ?? EMPTY_PERF;

  // Filter + sort — กรองจริงด้วยสถานะ/ภาค/ค้นหา (local ในหน้านี้ทั้งหมด)
  const filtered = dealers.filter(d => {
    if (statusFilter !== "all" && dealerStatus(d) !== statusFilter) return false;
    if (regionFilter !== "ทั้งหมด" && d.region !== regionFilter) return false;
    if (q && !`${d.code} ${d.name} ${d.province} ${d.region}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }).sort((a, b) => perfOf(b.code).revenue - perfOf(a.code).revenue);

  // Stats — คำนวณจากชุดที่กรองแล้ว (ตัวเลขสะสมจริง ไม่สเกลตามช่วงเวลา)
  const active = filtered.filter(d => dealerStatus(d) === "active");
  const totalRevenue = filtered.reduce((s, d) => s + perfOf(d.code).revenue, 0);
  const totalTarget = filtered.reduce((s, d) => s + d.revenueTarget, 0);
  const totalProjects = filtered.reduce((s, d) => s + perfOf(d.code).openLeads, 0);
  // เฉลี่ยเฉพาะตัวแทนที่ "มีข้อมูล" (onTimePct > 0) — ตัวที่เป็น 0 = ยังไม่มีข้อมูล (ตารางแสดง "—")
  // เอามาเฉลี่ยเป็น 0 ไม่ได้ = เอา 0 สวมรอย "—" · ไม่มีใครมีข้อมูล → null → การ์ดแสดง "—"
  // เฉลี่ยเฉพาะสาขาที่ "มีข้อมูลให้วัด" — สาขาที่ยังไม่มีลีด/ใบ ไม่เอา 0 มาถ่วงค่าเฉลี่ย
  const avgOf = (pick: (c: string) => number | null): number | null => {
    const vals = active.map(d => pick(d.code)).filter((v): v is number => v !== null);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  };
  const avgOnTime = avgOf(c => perfOf(c).onTimePct);
  const totalPct = totalTarget > 0 ? Math.round(totalRevenue / totalTarget * 100) : 0;

  function openAdd() { setEditTarget(null); setForm({ code: "", name: "", province: "", region: "กลาง", revenueTarget: regionDefaultTarget("กลาง"), status: "active" }); setTargetTouched(false); setFormErr(""); setShowForm(true); }
  function openEdit(d: DealerRow) { setEditTarget(d); setForm({ code: d.code, name: d.name, province: d.province, region: d.region, revenueTarget: d.revenueTarget, status: d.status }); setTargetTouched(true); setFormErr(""); setShowForm(true); }

  // เปลี่ยนภาค: อัปเดตภาค + ถ้ายังไม่แก้เป้าเอง (โหมดเพิ่มใหม่) เติมค่าเริ่มต้นตามภาคให้
  function changeRegion(region: string) {
    setForm(f => ({ ...f, region, revenueTarget: (!editTarget && !targetTouched) ? regionDefaultTarget(region) : f.revenueTarget }));
  }

  async function save() {
    const code = form.code.trim().toUpperCase();
    if (!code) { setFormErr("ต้องระบุรหัสตัวแทน"); return; }
    if (!form.name.trim()) { setFormErr("ต้องระบุชื่อตัวแทน"); return; }
    if (!form.province.trim()) { setFormErr("ต้องระบุจังหวัด"); return; }
    const dupe = dealers.find(d => d.code === code && d.id !== editTarget?.id);
    if (dupe) { setFormErr(`รหัส "${code}" มีอยู่แล้ว`); return; }

    if (editTarget) {
      setDealers(prev => prev.map(d => d.id === editTarget.id ? { ...d, name: form.name.trim(), province: form.province.trim(), region: form.region, revenueTarget: form.revenueTarget, status: form.status } : d));
      logAudit("แก้ไขตัวแทน", `${code} · ${form.name.trim()}`);
      setShowForm(false);
      return;
    }

    // ── สร้างตัวแทนใหม่ ──
    // โหมดจริง: ต้องสร้าง "บัญชีเข้าระบบ" ด้วย ซึ่งทำได้เฉพาะที่เซิร์ฟเวอร์ (service_role) → เรียก route (H5)
    //   เดิมสร้างแค่แถว dealers + โชว์รหัสปลอม → ตัวแทนล็อกอินไม่ได้เลย (บั๊ก H5)
    if (DATA_SOURCE === "supabase") {
      setCreating(true);
      setFormErr("");
      const res = await createDealerAccount({
        code, name: form.name.trim(), province: form.province.trim(),
        region: form.region, revenueTarget: form.revenueTarget,
      });
      setCreating(false);
      if (!res.ok) { setFormErr(res.error); return; } // ล้มเหลวต้องบอกจริง คงฟอร์มไว้ให้แก้
      await dealersRepo.list().then(setDealers).catch(() => {}); // route เพิ่งเพิ่มแถวที่เซิร์ฟเวอร์ → ดึงชุดจริง
      // audit บันทึกที่ route (server-side · การันตี) แล้ว — ไม่ลง client ซ้ำ
      setShowForm(false);
      // รหัสจริงจากเซิร์ฟเวอร์ (บัญชีล็อกอินได้แล้วจริง) — โชว์ให้ก๊อปไปแจ้งครั้งเดียว
      setCredsModal({ name: form.name.trim(), creds: { email: res.email, password: res.password }, mode: "created" });
      return;
    }

    // โหมดเดโม (local): ไม่มีบัญชีจริงให้ผูก — คงพฤติกรรมเดิมไว้เล่นได้
    const creds = genCredentials(code);
    setDealers(prev => [...prev, { id: code, code, name: form.name.trim(), province: form.province.trim(), region: form.region, revenueTarget: form.revenueTarget, status: form.status, credentials: creds }]);
    logAudit("สร้างตัวแทนใหม่", `${code} · ${form.name.trim()}`);
    setShowForm(false);
    setCredsModal({ name: form.name.trim(), creds, mode: "created" });
  }

  function remove(d: DealerRow) {
    if (!confirm(`ลบ "${d.name}" ออกจากระบบ?\nการกระทำนี้ไม่สามารถย้อนกลับได้`)) return;
    // โหมดจริง (supabase): ลบผ่าน route เซิร์ฟเวอร์ (service_role) → ลบบัญชี auth ของสาขาด้วย
    //   ไม่ทิ้งบัญชีกำพร้า · เดิม dealersRepo.remove ลบได้แค่แถว dealers (RLS) บัญชียังค้าง
    if (DATA_SOURCE === "supabase") {
      void deleteDealerAccount(d.code).then(res => {
        if (!res.ok) { alert("ลบตัวแทนไม่สำเร็จ: " + res.error); return; }
        setDealers(prev => prev.filter(x => x.id !== d.id));
        // audit บันทึกที่ route (server-side · การันตี) แล้ว — ไม่ลง client ซ้ำ
      });
      return;
    }
    // โหมดเดโม (local): ลบตรง ๆ — เดิมแค่เอาออกจากอาร์เรย์แล้วให้ชั้นข้อมูลเดาว่าต้องลบอะไร
    // การเดาแบบนั้นทำให้ "โหลดยังไม่เสร็จแล้วผู้ใช้แก้" กลายเป็นคำสั่งลบทั้งตาราง
    void dealersRepo.remove(d.code)
      .then(() => setDealers(prev => prev.filter(x => x.id !== d.id)))
      .catch(e => alert("ลบตัวแทนไม่สำเร็จ: " + (e instanceof Error ? e.message : String(e))));
    logAudit("ลบตัวแทน", `${d.code} · ${d.name}`);
  }

  function toggleStatus(d: DealerRow) {
    const next = d.status === "active" ? "inactive" : "active";
    setDealers(prev => prev.map(x => x.id === d.id ? { ...x, status: next } : x));
    // บันทึกให้ตรงกับสิ่งที่เกิดขึ้นจริง — เดิมเขียน "ระงับตัวแทน" ทั้งที่สั่ง "ปิดใช้งาน" (คนละคำกับที่ผู้ใช้กด)
    logAudit(next === "active" ? "เปิดใช้งานตัวแทน" : "ปิดใช้งานตัวแทน", `${d.code} · ${d.name}`);
  }

  // "เข้าระบบแทนตัวแทน" — ทำได้เฉพาะโหมดเดโมเท่านั้น
  //
  // เดิมปุ่มนี้เรียก login("dealer") ซึ่งเข้าด้วยบัญชีเดโมตัวเดียวเสมอ (CNX)
  // ไม่ว่าจะกดจากแถวไหน → HQ กดที่แถว RYG แล้วไปเห็นข้อมูล CNX โดยไม่รู้ตัว = อันตรายกว่าไม่มีปุ่ม
  //
  // ทำให้ถูกต้องในโหมดจริงไม่ได้ด้วย: รหัสผ่านตัวแทนถูก hash อยู่ใน Supabase Auth
  // การสวมสิทธิ์ต้องใช้ service_role ซึ่งอยู่ฝั่ง client ไม่ได้เด็ดขาด
  const canImpersonate = DATA_SOURCE !== "supabase";
  function enterDealer(d: DealerRow) {
    if (!canImpersonate) {
      alert([
        `เข้าระบบแทน "${d.name}" จากหน้านี้ไม่ได้`,
        "",
        "รหัสผ่านของตัวแทนถูกเข้ารหัสไว้ในระบบยืนยันตัวตน สำนักงานใหญ่จึงสวมสิทธิ์ไม่ได้",
        "ถ้าต้องการดูข้อมูลของสาขานี้ ให้กดปุ่มดูรายละเอียดตัวแทนแทน",
      ].join("\n"));
      return;
    }
    setEntering(d.id);
    login("dealer");
    router.push("/dashboard");
  }

  // ออกรหัสผ่านใหม่ให้ตัวแทน แล้วเปิดโมดัลคัดลอกรหัสใหม่ไปแจ้งต่อ
  function resetPassword(d: DealerRow) {
    // โหมด supabase: รหัสผ่านถูก hash อยู่ใน Supabase Auth — ออกรหัสใหม่จากหน้านี้ไม่ได้
    const cur = d.credentials;
    if (!cur) { alert("บัญชีนี้จัดการรหัสผ่านผ่านระบบยืนยันตัวตน (Supabase Auth)\nรีเซ็ตรหัสผ่านจากหน้านี้ไม่ได้"); return; }
    if (!confirm(`ออกรหัสผ่านใหม่ให้ "${d.name}"?\nรหัสเดิมจะใช้เข้าระบบไม่ได้ทันที`)) return;
    const creds: DealerCredentials = { email: cur.email, password: genResetPassword(d.code, cur.password.length) };
    setDealers(prev => prev.map(x => x.id === d.id ? { ...x, credentials: creds } : x));
    logAudit("รีเซ็ตรหัสผ่านตัวแทน", `${d.code} · ${d.name}`);
    setViewCredsDealer(null);
    setCredsModal({ name: d.name, creds, mode: "reset" });  // ใช้โมดัลคัดลอกรหัสตัวเดียวกับตอนสร้างตัวแทน
  }

  return (
    <div className="erp">
      {/* Header */}
      <div className="page-head">
        <div>
          <p>จัดการและติดตามผลการดำเนินงานของทุกตัวแทน</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ExportMenu filename="dealers" title="ตัวแทน (ทั้งเครือ)"
            headers={["รหัส","ตัวแทน","จังหวัด","ภาค","อีเมล","รายได้จริง","เป้า","อัตราปิดการขาย %","โอกาสการขาย","สถานะ"]}
            rows={filtered.map(d=>[d.code,d.name,d.province,d.region,d.credentials?.email ?? "—",perfOf(d.code).revenue,d.revenueTarget,perfOf(d.code).winRate ?? "—",perfOf(d.code).openLeads,dealerStatusLabel[d.status]])} />
          <button onClick={openAdd} className="btn btn-primary btn-md">
            <Plus size={14} /> เพิ่มตัวแทน
          </button>
        </div>
      </div>

      {/* ── KPI 4 ใบ — มาตรฐานเดียวกับหน้า HQ อื่นทั้งหมด (แดชบอร์ด · ภาพรวมยอดขาย · ใบเสนอราคา · ลูกค้า) ──
          เดิมหน้านี้ใช้ .stat-card ของเก่า: แถบสีซ้าย + ตัวเลขสีใหญ่ + หน่วยติดในตัวเลข ("10 ตัวแทน")
          ซึ่งเป็นที่เดียวในระบบที่ทำแบบนั้น · .stat-grid ยังไม่มี breakpoint ด้วย (จอแคบบีบ 4 ใบค้าง)
          กติกาของ .hq-kpi4: ป้าย → ตัวเลข (เข้ม ไม่ใส่สี) → หน่วย/บริบท · ไอคอนในกล่องสีจางมุมขวา */}
      <div className="hq-kpi4" style={{ marginBottom: "1.25rem" }}>
        {([
          { label: "ตัวแทนทั้งหมด", value: `${filtered.length}`, sub: `เปิดใช้งาน ${active.length} ตัวแทน`, Icon: Store, color: "#003366", bg: "#E8F0FE" },
          { label: "รายได้รวม", value: `฿${(totalRevenue / 1_000_000).toFixed(1)}M`, sub: `${totalPct}% ของเป้า ฿${(totalTarget / 1_000_000).toFixed(0)}M`, Icon: Coins, color: "#059669", bg: "#E6F6EF" },
          { label: "โอกาสการขายทั้งหมด", value: `${totalProjects}`, sub: `${active.filter(d => perfOf(d.code).openLeads > 0).length} ตัวแทนมีงาน`, Icon: Briefcase, color: "#0891B2", bg: "#E6F4F9" },
          { label: "ติดตามตรงเวลา", value: avgOnTime === null ? "—" : `${avgOnTime}%`, sub: avgOnTime === null ? "ยังไม่มีข้อมูล" : `${avgOnTime >= 85 ? "ดี" : avgOnTime >= 70 ? "พอใช้" : "ต้องปรับปรุง"} · เฉลี่ยเท่าที่มีข้อมูล`, Icon: Clock, color: "#7C3AED", bg: "#F0EBFB" },
        ] as const).map(t => (
          <div key={t.label} className="card" style={{ marginBottom: 0, padding: "18px 18px 15px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: "0.72rem", color: "var(--muted-foreground)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.label}</div>
              <div style={{ fontSize: "1.7rem", fontWeight: 800, color: "#1F2937", marginTop: 7, lineHeight: 1, letterSpacing: "-0.015em", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{t.value}</div>
              <div style={{ fontSize: "0.7rem", color: "var(--muted-foreground)", marginTop: 7, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.sub}</div>
            </div>
            <span style={{ width: 36, height: 36, borderRadius: 10, background: t.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <t.Icon size={18} color={t.color} strokeWidth={2.1} />
            </span>
          </div>
        ))}
      </div>

      {/* Toolbar — ค้นหา + ตัวแทน/ภาค/สถานะ รวมแถวเดียว (เหมือนหน้าอื่นทั้งระบบ) */}
      <div className="card hq-sticky-filter" style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center", flexWrap: "wrap", padding: "10px 14px" }}>
        <div className="search-bar">
          <Search size={13} color="#6b7280" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="ค้นหาตัวแทน..." />
        </div>
        <div style={{ flex: 1 }} />
        <select value={regionFilter} onChange={e => setRegionFilter(e.target.value)} className="form-select" style={{ width: "auto", cursor: "pointer" }}>
          {["ทั้งหมด", ...REGIONS].map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as DealerStatus | "all")} className="form-select" style={{ width: "auto", cursor: "pointer" }}>
          {STATUS_PILLS.map(p => <option key={p.value} value={p.value}>{p.value === "all" ? "ทุกสถานะ" : p.label}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-wrap">
          <table>
            {/* เพิ่มคอลัมน์ "จังหวัด" → เกลี่ย % ใหม่ทั้งชุด (รวมต้องได้ 100)
                เดิมมีแค่คอลัมน์ "จังหวัด"/ปุ่ม ที่ตั้ง minWidth ไว้ — คอลัมน์อื่นเป็น % ล้วน
                พอจอแคบ (768px) จึงบีบสัดส่วนจนตัวอักษรเหลือตัวเดียว+จุดไข่ปลา แทนที่จะดัน .table-wrap ให้ scroll
                (ต่างจากตาราง /customers ที่ตั้ง minWidth ครบทุกคอลัมน์) → เติม minWidth ให้ครบเหมือนกัน */}
            <colgroup>
              <col style={{ width: "4%", minWidth: 32 }} />{/* # */}
              <col style={{ width: "6%", minWidth: 64 }} />{/* รหัส */}
              <col style={{ width: "14%", minWidth: 190 }} />{/* ชื่อตัวแทน */}
              <col style={{ width: "9%", minWidth: 96 }} />{/* จังหวัด */}
              <col style={{ width: "7%", minWidth: 64 }} />{/* ภาค */}
              <col style={{ width: "13%", minWidth: 130 }} />{/* ยอด / เป้า */}
              <col style={{ width: "9%", minWidth: 130 }} />{/* โอกาสการขาย */}
              <col style={{ width: "9%", minWidth: 140 }} />{/* ติดตามตรงเวลา */}
              <col style={{ width: "7%", minWidth: 76 }} />{/* สถานะ */}
              {/* คอลัมน์ปุ่ม: เข้าระบบ + ไอคอน 4 ปุ่ม ต้องการ ~230px — ให้พื้นที่พอ ไม่ล้นออกนอกตาราง */}
              <col style={{ width: "22%", minWidth: 268 }} />
            </colgroup>
            <thead>
              <tr>
                {["#", "รหัส", "ชื่อตัวแทน", "จังหวัด", "ภาค", "ยอด / เป้า", "โอกาสการขาย", "ติดตามตรงเวลา", "สถานะ", ""].map((h, i) => (
                  <th key={i}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={10} style={{ padding: "32px", textAlign: "center", fontSize: "0.8rem", color: "#6b7280" }}>ไม่พบข้อมูล</td></tr>
              ) : filtered.map((d, i) => (
                <tr key={d.id} className="clickable" style={{ opacity: dealerStatus(d) === "active" ? 1 : 0.55 }}
                  onClick={() => setSelectedDealer(d)}>
                  <td style={{ fontSize: "0.72rem", color: "#6b7280", fontWeight: 600 }}>{i + 1}</td>
                  <td>
                    <span style={{ fontWeight: 800, color: "#003366", fontSize: "0.8rem", letterSpacing: "0.05em" }}>{d.code}</span>
                  </td>
                  <td style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={d.name}>
                    <span style={{ fontSize: "0.86rem", fontWeight: 700, color: "#2D2D2D" }}>{d.name}</span>
                  </td>
                  <td style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontSize: "0.82rem", color: "#374151" }} title={d.province}>
                    {d.province || "—"}
                  </td>
                  <td>
                    <span className="badge" style={{ background: "#f0f0f5", color: "#6b7280" }}>{d.region}</span>
                  </td>
                  <td><RevBar actual={perfOf(d.code).revenue} target={d.revenueTarget} /></td>
                  <td>
                    {perfOf(d.code).openLeads > 0
                      ? <span style={{ fontWeight: 700, color: "#2D2D2D", fontSize: "0.86rem" }}>{perfOf(d.code).openLeads}<span style={{ fontSize: "0.72rem", color: "#6b7280", fontWeight: 500 }}> โอกาสการขาย</span></span>
                      : <span style={{ color: "#C0C0C0", fontSize: "0.8rem" }}>—</span>}
                  </td>
                  <td><OnTimeBadge pct={perfOf(d.code).onTimePct} /></td>
                  <td>
                    <StatusBadge status={dealerStatus(d)} />
                  </td>
                  <td style={{ overflow: "visible" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "nowrap", justifyContent: "flex-end" }}>
                      {canImpersonate && (
                        <button onClick={e => { e.stopPropagation(); enterDealer(d); }} disabled={entering === d.id} title="เข้าระบบตัวแทน (โหมดเดโมเท่านั้น)"
                          className="btn btn-primary btn-sm" style={{ opacity: entering === d.id ? 0.6 : 1, whiteSpace: "nowrap", flexShrink: 0 }}>
                          <LogIn size={12} /> {entering === d.id ? "..." : "เข้าระบบ"}
                        </button>
                      )}
                      <button onClick={e => { e.stopPropagation(); router.push(`/hq/dealers/${d.code}`); }} title="ดูรายละเอียดตัวแทน"
                        style={{ width: 28, height: 28, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#f0f4f8", border: "1px solid #e5e7eb", borderRadius: 7, color: "#003366", cursor: "pointer" }}>
                        <BarChart2 size={12} />
                      </button>
                      <button onClick={e => { e.stopPropagation(); setViewCredsDealer(d); }} title="รหัสเข้าระบบ"
                        style={{ width: 28, height: 28, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#f0f4f8", border: "1px solid #e5e7eb", borderRadius: 7, color: "#003366", cursor: "pointer" }}>
                        <Key size={12} />
                      </button>
                      <button onClick={e => { e.stopPropagation(); openEdit(d); }} title="แก้ไข"
                        style={{ width: 28, height: 28, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 7, color: "#6b7280", cursor: "pointer" }}>
                        <Pencil size={12} />
                      </button>
                      <button onClick={e => { e.stopPropagation(); toggleStatus(d); }} title={d.status === "active" ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                        style={{ width: 28, height: 28, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 7, color: "#6b7280", cursor: "pointer" }}>
                        {d.status === "active" ? <EyeOff size={12} /> : <Eye size={12} />}
                      </button>
                      <button onClick={e => { e.stopPropagation(); remove(d); }} title="ลบ"
                        style={{ width: 28, height: 28, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", border: "1px solid #fee2e2", borderRadius: 7, color: "#dc2626", cursor: "pointer" }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Add / Edit Modal ── */}
      {showForm && (
        <div onClick={() => setShowForm(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.42)", zIndex: 1050, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ ...CARD, width: 460, maxWidth: "100%" }}>
            <div style={{ padding: "18px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "#2D2D2D" }}>{editTarget ? "แก้ไขข้อมูลตัวแทน" : "เพิ่มตัวแทนใหม่"}</h2>
              <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", display: "flex" }}><X size={18} /></button>
            </div>
            <div style={{ padding: "18px 20px" }}>
              {formErr && <div style={{ background: "#fee2e2", border: "1px solid #dc262630", borderRadius: 8, padding: "8px 12px", marginBottom: 14, fontSize: "0.8rem", color: "#dc2626", fontWeight: 600 }}>{formErr}</div>}

              {!editTarget && (
                <div style={{ background: "#dce5f0", border: "1px solid #C0C0C0", borderRadius: 8, padding: "8px 12px", marginBottom: 14, fontSize: "0.72rem", color: "#003366", fontWeight: 600 }}>
                  ระบบจะสร้างรหัสเข้าสู่ระบบอัตโนมัติหลังบันทึก
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
                <InputField label="รหัสตัวแทน *">
                  <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase().slice(0, 6) }))} placeholder="เช่น BKK" disabled={!!editTarget}
                    style={{ ...INPUT_STYLE, textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.06em", opacity: editTarget ? 0.6 : 1 }} />
                  {editTarget && <div style={{ fontSize: "0.65rem", color: "#6b7280", marginTop: 3 }}>แก้ไขรหัสไม่ได้</div>}
                </InputField>
                <InputField label="ชื่อตัวแทน *">
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="บจ. ตัวอย่างสตีล..." style={INPUT_STYLE} />
                </InputField>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <InputField label="จังหวัดที่ตั้ง">
                  <input value={form.province} onChange={e => setForm(f => ({ ...f, province: e.target.value }))} placeholder="เช่น ระยอง" style={INPUT_STYLE} />
                </InputField>
                <InputField label="ภาค">
                  <select value={form.region} onChange={e => changeRegion(e.target.value)} style={{ ...INPUT_STYLE, cursor: "pointer" }}>
                    {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </InputField>
                <InputField label="เป้ายอดขาย (บาท/ปี)">
                  <input type="number" value={form.revenueTarget || ""} onChange={e => { setTargetTouched(true); setForm(f => ({ ...f, revenueTarget: Number(e.target.value) || 0 })); }} placeholder="0" style={INPUT_STYLE} />
                  {!editTarget && !targetTouched && (
                    <div style={{ fontSize: "0.65rem", color: "#6b7280", marginTop: 3 }}>
                      ค่าเริ่มต้นแนะนำตามภาค {form.region} · ฿{(regionDefaultTarget(form.region) / 1_000_000).toFixed(0)}M — แก้ไขได้
                    </div>
                  )}
                </InputField>
              </div>

              <InputField label="สถานะ">
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as DealerStatus }))} style={{ ...INPUT_STYLE, cursor: "pointer" }}>
                  <option value="active">{dealerStatusLabel.active}</option>
                  <option value="inactive">{dealerStatusLabel.inactive}</option>
                </select>
              </InputField>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
                <button onClick={() => setShowForm(false)} disabled={creating} className="btn btn-secondary btn-md">ยกเลิก</button>
                <button onClick={() => void save()} disabled={creating} className="btn btn-primary btn-md"
                  style={creating ? { opacity: .6, cursor: "not-allowed" } : undefined}>
                  {editTarget ? "บันทึกการแก้ไข" : creating ? "กำลังสร้างบัญชี…" : "สร้างตัวแทน"}
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
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: credsModal.mode === "reset" ? "#fef3cd" : "#e5faf0", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                {credsModal.mode === "reset" ? <Key size={22} color="#b45309" /> : <Check size={22} color="#059669" />}
              </div>
              <h3 style={{ margin: "0 0 4px", fontWeight: 800, color: "#2D2D2D" }}>
                {credsModal.mode === "reset" ? "รีเซ็ตรหัสผ่านแล้ว" : "สร้างตัวแทนสำเร็จ!"}
              </h3>
              <p style={{ fontSize: "0.8rem", color: "#6b7280", margin: 0 }}>{credsModal.name}</p>
            </div>
            <div style={{ padding: "0 20px 20px" }}>
              <div style={{ background: "#f0f4f8", border: "1px solid #e5e7eb", borderRadius: 10, padding: "14px 16px", marginBottom: 14 }}>
                <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>รหัสเข้าสู่ระบบตัวแทน</div>
                <CopyField label="อีเมล" value={credsModal.creds.email} />
                <CopyField label={credsModal.mode === "reset" ? "รหัสผ่านใหม่" : "รหัสผ่านเริ่มต้น"} value={credsModal.creds.password} />
              </div>
              <div style={{ background: "#fef3cd", border: "1px solid #f59e0b30", borderRadius: 8, padding: "8px 12px", marginBottom: 16, fontSize: "0.72rem", color: "#f59e0b", fontWeight: 600 }}>
                {credsModal.mode === "reset"
                  ? "รหัสเดิมใช้ไม่ได้แล้ว — แจ้งรหัสใหม่ให้ตัวแทนทันที"
                  : "แจ้งรหัสผ่านให้ตัวแทนและแนะนำให้เปลี่ยนรหัสหลังเข้าครั้งแรก"}
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
        const dPerf = perfOf(d.code);
        const revPct = d.revenueTarget > 0 ? Math.round(dPerf.revenue / d.revenueTarget * 100) : 0;
        const revColor = revPct >= 100 ? "#059669" : revPct >= 75 ? "#003366" : revPct >= 50 ? "#f59e0b" : "#dc2626";
        // ระดับผลงานตัดสินจาก % เป้า + อัตราปิดการขาย (ข้อมูลที่ระบบมีจริง)
        // เดิมใช้ onTimePct = อัตราส่งมอบตรงเวลา ซึ่งเป็นตัวชี้วัดงานก่อสร้าง ไม่มีในระบบขายล้วนนี้
        const wr = dPerf.winRate ?? 0;
        const tier = revPct >= 90 && wr >= 50
          ? { label: "ตัวแทนดีเด่น", color: "#059669", bg: "#e5faf0" }
          : revPct >= 70 && wr >= 35
          ? { label: "ผลงานดี", color: "#003366", bg: "#dce5f0" }
          : revPct >= 50
          ? { label: "กำลังพัฒนา", color: "#f59e0b", bg: "#fef3cd" }
          : { label: "ต้องปรับปรุง", color: "#dc2626", bg: "#fee2e2" };
        return (
          <>
            <div onClick={() => setSelectedDealer(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.3)", zIndex: 1040 }} />
            <div className="modal-pop" style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 460, maxWidth: "calc(100vw - 32px)", height: "min(680px, calc(100vh - 48px))", background: "#fff", zIndex: 1050, borderRadius: 18, boxShadow: "0 24px 80px rgba(0,0,0,.28)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
              {/* Header */}
              <div style={{ padding: "20px", borderBottom: "1px solid #e5e7eb", background: "#f8f9fb" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 900, fontSize: "0.8rem", color: "#003366", background: "#dce5f0", padding: "3px 10px", borderRadius: 8, letterSpacing: "0.06em" }}>{d.code}</span>
                    <StatusBadge status={dealerStatus(d)} />
                    <span className="badge" style={{ background: tier.bg, color: tier.color }}>{tier.label}</span>
                  </div>
                  <button onClick={() => setSelectedDealer(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", display: "flex" }}><X size={18} /></button>
                </div>
                <div style={{ fontSize: "1rem", fontWeight: 800, color: "#2D2D2D", marginBottom: 2 }}>{d.name}</div>
                <div style={{ fontSize: "0.72rem", color: "#6b7280" }}>ภาค{d.region}</div>
              </div>

              {/* Scrollable content */}
              <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>

                {/* Revenue card */}
                <div style={{ background: "#f8f9fb", border: "1px solid #e5e7eb", borderRadius: 12, padding: "14px 16px", marginBottom: 12 }}>
                  <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>ยอดขายเทียบเป้าหมาย</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                    <span style={{ fontSize: "1.5rem", fontWeight: 800, color: revColor }}>฿{(dPerf.revenue / 1_000_000).toFixed(1)}M</span>
                    <span style={{ fontSize: "0.72rem", color: "#6b7280" }}>เป้า ฿{(d.revenueTarget / 1_000_000).toFixed(0)}M</span>
                  </div>
                  <div style={{ height: 8, background: "#e5e7eb", borderRadius: 99, overflow: "hidden", marginBottom: 5 }}>
                    <div className="top5-bar" style={{ height: "100%", width: `${Math.min(revPct, 100)}%`, background: revColor, borderRadius: 99 }} />
                  </div>
                  <div style={{ fontSize: "0.72rem", fontWeight: 700, color: revColor }}>{revPct}% ของเป้าหมาย</div>
                </div>

                {/* 3 metrics */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
                  <div style={{ background: "#f8f9fb", border: "1px solid #e5e7eb", borderRadius: 12, padding: "12px", textAlign: "center" }}>
                    <div style={{ fontSize: "1.15rem", fontWeight: 800, color: wr >= targets.winRateTarget ? "#059669" : wr >= targets.winRateTarget - 15 ? "#f59e0b" : "#dc2626" }}>{dPerf.winRate === null ? "—" : `${wr}%`}</div>
                    <div style={{ fontSize: "0.65rem", color: "#6b7280", fontWeight: 600, marginTop: 3 }}>อัตราปิดการขาย</div>
                  </div>
                  <div style={{ background: "#f8f9fb", border: "1px solid #e5e7eb", borderRadius: 12, padding: "12px", textAlign: "center" }}>
                    <div style={{ fontSize: "1.15rem", fontWeight: 800, color: dPerf.onTimePct === null ? "#C0C0C0" : dPerf.onTimePct >= targets.onTimeTarget ? "#059669" : dPerf.onTimePct >= targets.onTimeTarget - 15 ? "#f59e0b" : "#dc2626" }}>{dPerf.onTimePct === null ? "—" : `${dPerf.onTimePct}%`}</div>
                    <div style={{ fontSize: "0.65rem", color: "#6b7280", fontWeight: 600, marginTop: 3 }}>ติดตามตรงเวลา</div>
                  </div>
                  <div style={{ background: "#f8f9fb", border: "1px solid #e5e7eb", borderRadius: 12, padding: "12px", textAlign: "center" }}>
                    <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "#003366" }}>{dPerf.openLeads}</div>
                    <div style={{ fontSize: "0.65rem", color: "#6b7280", fontWeight: 600, marginTop: 3 }}>โอกาสการขาย</div>
                  </div>
                </div>

                {/* Performance analysis */}
                <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "14px 16px", marginBottom: 12 }}>
                  <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>วิเคราะห์ผลงาน</div>
                  {revPct < 50 && (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8, fontSize: "0.8rem", color: "#dc2626" }}>
                      <AlertTriangle size={14} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} /><span>ยอดขายต่ำกว่าเป้ามาก ควรติดตามโอกาสการขายและช่วยปิดการขายที่ค้าง</span>
                    </div>
                  )}
                  {revPct >= 50 && revPct < 75 && (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8, fontSize: "0.8rem", color: "#f59e0b" }}>
                      <BarChart2 size={14} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} /><span>ยอดขายอยู่ระดับกลาง — ยังมีช่องว่างถึงเป้าหมาย ควรเร่งลูกค้าเป้าหมายที่รอ</span>
                    </div>
                  )}
                  {revPct >= 75 && revPct < 100 && (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8, fontSize: "0.8rem", color: "#003366" }}>
                      <TrendingUp size={14} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} /><span>ยอดขายใกล้เป้าแล้ว — คาดว่าปิดได้ครบก่อนสิ้นไตรมาส</span>
                    </div>
                  )}
                  {revPct >= 100 && (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8, fontSize: "0.8rem", color: "#059669" }}>
                      <Trophy size={14} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} /><span>ถึงเป้าหมายแล้ว! ยอดขายเกินเป้า {revPct - 100}%</span>
                    </div>
                  )}
                  {dPerf.onTimePct !== null && dPerf.onTimePct < 70 && (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8, fontSize: "0.8rem", color: "#dc2626" }}>
                      <Clock size={14} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} /><span>อัตราติดตามตรงเวลาต่ำ ควรตรวจสอบโอกาสการขายที่ค้างคา</span>
                    </div>
                  )}
                  {wr < 25 && dPerf.winRate !== null && (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8, fontSize: "0.8rem", color: "#f59e0b" }}>
                      <Target size={14} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} /><span>อัตราปิดการขายต่ำกว่าค่าเฉลี่ยเครือ — ควรพิจารณาฝึกสอนทีมขาย</span>
                    </div>
                  )}
                  {revPct >= 88 && (dPerf.onTimePct ?? 0) >= 85 && (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: "0.8rem", color: "#059669" }}>
                      <Award size={14} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} /><span>ตัวแทนผลงานดีเด่น — สามารถใช้เป็นต้นแบบให้ตัวแทนอื่นได้</span>
                    </div>
                  )}
                </div>

                {/* Credentials */}
                <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "14px 16px" }}>
                  <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>ข้อมูลเข้าสู่ระบบ</div>
                  <CopyField label="อีเมล" value={d.credentials?.email ?? "—"} />
                  {/* โหมด supabase ไม่มีรหัสผ่านให้แสดง (hash อยู่ใน Auth) — ขึ้น "—" ตามจริง ห้ามกุ */}
                  <CopyField label="รหัสผ่าน" value={d.credentials?.password ?? "—"} secret />
                </div>
              </div>

              {/* Footer */}
              <div style={{ padding: "14px 20px", borderTop: "1px solid #e5e7eb", display: "flex", gap: 8 }}>
                <button onClick={e => { e.stopPropagation(); router.push(`/hq/dealers/${d.code}`); }}
                  className="btn btn-primary btn-md" style={{ flex: 1, justifyContent: "center" }}>
                  <BarChart2 size={14} /> ดูรายละเอียดเต็ม
                </button>
                <button onClick={e => { e.stopPropagation(); enterDealer(d); }} disabled={entering === d.id}
                  className="btn btn-tint btn-md" style={{ cursor: entering === d.id ? "not-allowed" : "pointer", opacity: entering === d.id ? 0.7 : 1 }}>
                  <LogIn size={14} /> {entering === d.id ? "กำลังเข้า..." : "เข้าระบบ"}
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
                <h3 style={{ margin: 0, fontSize: "0.92rem", fontWeight: 800, color: "#2D2D2D" }}>รหัสเข้าระบบ</h3>
                <div style={{ fontSize: "0.72rem", color: "#6b7280", marginTop: 2 }}>{viewCredsDealer.name}</div>
              </div>
              <button onClick={() => setViewCredsDealer(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", display: "flex" }}><X size={16} /></button>
            </div>
            <div style={{ padding: "16px 20px" }}>
              <CopyField label="อีเมล" value={viewCredsDealer.credentials?.email ?? "—"} />
              <CopyField label="รหัสผ่าน" value={viewCredsDealer.credentials?.password ?? "—"} />
              <div style={{ fontSize: "0.72rem", color: "#6b7280", background: "#f0f4f8", borderRadius: 8, padding: "8px 12px", marginTop: 4 }}>
                ตัวแทนใช้อีเมลนี้เข้าสู่ระบบที่หน้าเข้าสู่ระบบของตัวแทน
              </div>
              {/* ย้ายมาจากแท็บ "ตัวแทนจำหน่าย" ในหน้าตั้งค่า (แท็บนั้นถูกยุบ — ข้อมูลซ้ำกับหน้านี้ทั้งใบ)
                  มีผลทันที ไม่ผ่านปุ่มบันทึก · ลงบันทึกการใช้งานทุกครั้ง เพราะเป็นการแตะบัญชีคนอื่น */}
              <button onClick={() => resetPassword(viewCredsDealer)}
                style={{ width: "100%", marginTop: 12, padding: "9px", borderRadius: 9, border: "1px solid #fecaca",
                  background: "#fff", color: "#dc2626", fontSize: "0.78rem", fontWeight: 700, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                <Key size={13} /> รีเซ็ตรหัสผ่าน
              </button>
              <div style={{ fontSize: "0.68rem", color: "#9ca3af", marginTop: 6, textAlign: "center" }}>
                รหัสเดิมจะใช้ไม่ได้ทันที — ต้องแจ้งรหัสใหม่ให้ตัวแทน
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
