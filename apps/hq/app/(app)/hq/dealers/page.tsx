"use client";

import { useEffect, useState } from "react";
import { TablePagination, pageSlice, pageCountOf, ROWS_PER_PAGE } from "@pms/shared/components/ui/TablePagination";
import { ModalCard } from "@pms/shared/components/ui/ModalCard";
import { AdminGate } from "@pms/shared/components/layout/AdminGate";
import {
  DEFAULT_HQ_TARGETS, dealerStatusLabel, dealerStatusColor, fmtISOToThai,
  type DealerRow, type DealerCredentials, type HQTargets, type DealerStatus,
} from "@pms/shared/lib/mock";
import { useRepoState, useRepoValue } from "@pms/shared/lib/useRepoState";
import { friendlyError } from "@pms/shared/lib/friendlyError";
import { REAL_BACKEND } from "@pms/shared/lib/data/config";
import { dealers as dealersRepo, settings as settingsRepo } from "@pms/shared/lib/data";
import { logRepoRead } from "@pms/shared/lib/repoLog";
import { provincesOfRegion } from "@pms/shared/lib/provinces";
import { ClickableRow } from "@pms/shared/components/ui/ClickableRow";
import { createDealerAccount, deleteDealerAccount, impersonateDealer, listDealerLoginEmails, moveDealerData } from "@pms/shared/lib/adminApi";
import { CopyField, DealerPasswordField } from "@pms/shared/components/hq/DealerCredentialsCard";
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
  // ⚠️ ตัวเลขที่โชว์ต้องเป็นค่าจริง · ตัดที่ 100 ได้เฉพาะ "ความยาวแท่ง" (บอสสั่ง 24 ส.ค. 69)
  //   เดิมใช้ค่าที่ตัดแล้วทั้งสองที่ → ตัวแทนที่ทำได้ 410% ของเป้าขึ้นว่า "100%"
  //   อ่านแล้วเข้าใจว่าถึงเป้าพอดี ทั้งที่ทำได้เกินเป้าสี่เท่า และหน้าเดียวกัน (แผงเจาะรายสาขา)
  //   กลับโชว์ 410% อยู่ — เลขสองตัวในหน้าเดียวขัดกันเอง
  const pct = target > 0 ? Math.round(actual / target * 100) : 0;
  const pctBar = Math.min(100, pct);
  const color = pct >= 100 ? "#059669" : pct >= 75 ? "#003366" : pct >= 50 ? "#f59e0b" : "#dc2626";
  return (
    // ⚠️ ห้ามใส่ minWidth ที่กล่องข้างใน (แก้ 10 ส.ค. 69)
    //   ช่องตารางมีระยะขอบซ้ายขวารวม ~32px · กล่องข้างในที่กว้างตายตัวจึงล้นออกนอกช่อง
    //   แล้วโดน overflow:hidden ตัดทิ้ง → ป้าย "100%" ถูกเฉือนเหลือ "10" อ่านเป็นสิบเปอร์เซ็นต์
    //   ตัวแทนที่ทำได้เต็มเป้าถูกอ่านว่าทำได้แค่ 10% · ความกว้างคุมที่ colgroup แทน (table-layout:fixed)
    <div>
      {/* ⚠️ ตัวเลขย่อ (฿24.6M) ต้องดูค่าเต็มได้ — ฝั่งตัวแทนโชว์เต็ม (฿24,600,000) พอเอามาเทียบกันแล้ว
          ผู้ใช้ไม่แน่ใจว่าเป็นเลขเดียวกันไหม (ผลตรวจภายนอก DL-12 · 24 ส.ค. 69) */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 6, fontSize: "0.72rem", marginBottom: 3 }}
        title={`ยอดขายสะสม ฿${Math.round(actual).toLocaleString("th-TH")} · เป้า ฿${Math.round(target).toLocaleString("th-TH")}`}>
        <span style={{ color: "#6b7280" }}>฿{(actual / 1_000_000).toFixed(1)}M</span>
        <span style={{ fontWeight: 700, color }}>{pct}%</span>
      </div>
      <div style={{ height: 6, background: "#f0f0f5", borderRadius: 99, overflow: "hidden" }}>
        <div className="top5-bar" style={{ height: "100%", width: `${pctBar}%`, background: color, borderRadius: 99 }} />
      </div>
      <div style={{ fontSize: "0.65rem", color: "#6b7280", marginTop: 2 }}>
        เป้า ฿{(target / 1_000_000).toFixed(1)}M
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
// ใช้กับรหัสผ่านในแผงรายละเอียดตัวแทน — เดิมโชว์รหัสจริงเต็ม ๆ ทันทีที่เปิดแถว
// ใครเดินผ่านหลังจอ/แชร์หน้าจอ/ถ่ายภาพหน้าจอ ก็ได้รหัสเข้าระบบของตัวแทนไปเลย
// (โมดัลตอนสร้าง/รีเซ็ตยังโชว์เต็มโดยตั้งใจ — เป็นจังหวะเดียวที่ HQ ต้องอ่านไปแจ้งตัวแทน)
// CopyField / DealerPasswordField ย้ายไปเป็นของกลางที่ DealerCredentialsCard.tsx แล้ว (13 ส.ค. 69)

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

// ⛔ ห้ามสร้างฟังก์ชัน "เดาอีเมลจากรหัสสาขา" กลับมาอีก
//   เคยมี dealerLoginEmail(code) = `<code>@partner-agent.co.th` ซึ่งเป็นสูตรของบัญชีที่สร้างผ่านหน้าจอนี้
//   เท่านั้น · สาขาที่มีอยู่จริงใช้อีเมลธุรกิจของตัวเอง (CNX = sales@cmsteelbuild.co.th)
//   → หน้าจอโชว์อีเมลที่ไม่มีอยู่จริงคู่กับรหัสผ่านที่ถูกต้อง HQ คัดลอกไปแล้วเข้าระบบไม่ได้
//   อีเมลจริงต้องมาจาก /api/admin/dealers/logins เท่านั้น · ไม่รู้ = ขึ้น "—"

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

  const [dealers, setDealers, dealersLoaded] = useRepoState<DealerRow[]>(() => dealersRepo.list(), (v) => dealersRepo.save(v), []);
  // อีเมลเข้าระบบจริงของแต่ละสาขา (ถามเซิร์ฟเวอร์ครั้งเดียวตอนเปิดหน้า)
  //   ห้ามคำนวณจากรหัสสาขาเด็ดขาด — สูตร `<code>@partner-agent.co.th` ใช้ได้เฉพาะบัญชีที่สร้าง
  //   ผ่านหน้าจอนี้ · สาขาที่มีอยู่จริงใช้อีเมลธุรกิจของตัวเอง (CNX = sales@cmsteelbuild.co.th)
  //   เดิมโชว์อีเมลที่เดาไว้ HQ คัดลอกไปใช้คู่กับรหัสผ่านที่ถูกต้อง แล้วเข้าระบบไม่ได้
  const [loginEmails, setLoginEmails] = useState<Record<string, string>>({});
  useEffect(() => {
    let alive = true;
    listDealerLoginEmails().then(m => { if (alive) setLoginEmails(m); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  // อีเมลที่ "ยืนยันแล้วว่ามีจริง" เท่านั้น — ไม่รู้ ให้ขึ้น "—" ไม่เดาให้ผู้ใช้เข้าใจผิด
  const loginEmailOf = (code: string) => loginEmails[code] ?? "—";
  // เกณฑ์สี Win rate / ตรงเวลา = เป้าที่ HQ ตั้งไว้ (แหล่งเดียว) ไม่ hardcode
  const targets = useRepoValue<HQTargets>(() => settingsRepo.getTargets(), DEFAULT_HQ_TARGETS);
  const [q, setQ] = useState("");
  const [regionFilter, setRegionFilter] = useState("ทั้งหมด");
  const [statusFilter, setStatusFilter] = useState<DealerStatus | "all">("all");
  // แบ่งหน้า 10 แถวเท่ากับทุกตารางในระบบ (สั่งโดยผู้บริหาร 7 ส.ค. 69)
  // ⚠️ ทุกตัวกรองต้องพากลับหน้า 1 — ไม่งั้นกรองแล้วค้างอยู่หน้ากลางลิสต์ที่ไม่มีข้อมูลแล้ว
  const [page, setPage] = useState(0);

  // Modals
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<DealerRow | null>(null);
  const [form, setForm] = useState({ code: "", name: "", province: "", region: "", revenueTarget: 0, status: "active" as "active" | "inactive" });
  // บัญชีเข้าระบบของสาขาใหม่ — HQ กรอกเองได้ (บอสสั่ง 20 ส.ค. 69) · เว้นว่าง = ระบบตั้งให้
  //   สาขาจริงใช้อีเมลธุรกิจของตัวเอง อีเมลที่ระบบประกอบจากรหัสสาขาไม่มีอยู่จริง
  const [บัญชีใหม่, setบัญชีใหม่] = useState({ email: "", password: "" });
  // ผู้ใช้แก้ช่องเป้าเองหรือยัง — ถ้ายัง เปลี่ยนภาคจะเติมค่าเริ่มต้นตามภาคให้ (โหมดเพิ่มใหม่เท่านั้น)
  const [targetTouched, setTargetTouched] = useState(false);
  const [formErr, setFormErr] = useState("");
  const [creating, setCreating] = useState(false); // กำลังสร้างบัญชีที่เซิร์ฟเวอร์ — กันกดปุ่มซ้ำระหว่างรอ
  // โมดัลแสดงรหัสหลังสร้างตัวแทนใหม่ (กรณีรีเซ็ตรหัสย้ายไปหน้ารายละเอียดตัวแทนแล้ว)
  const [credsModal, setCredsModal] = useState<{ name: string; creds: DealerCredentials; mode: "created" | "reset" } | null>(null);
  // สาขาที่ลบไม่ได้เพราะยังมีข้อมูล → เปิดกล่อง "ย้ายข้อมูลไปสาขาอื่น" ให้แทนที่จะจบแค่แจ้งเตือน
  const [moveFrom, setMoveFrom] = useState<DealerRow | null>(null);
  const [moveTo, setMoveTo] = useState("");
  const [moving, setMoving] = useState(false);
  const [moveErr, setMoveErr] = useState("");
  const [entering, setEntering] = useState<string | null>(null);
  const [selectedDealer, setSelectedDealer] = useState<DealerRow | null>(null);

  // ผลงานจริงจากใบเสนอราคา/ลูกค้าเป้าหมาย — ห้ามอ่าน d.revenueActual / d.winRate / d.activeProjects อีก
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
  // ── ตัวแทนที่ปิดใช้งาน ยังถูกนับรวมในการ์ดยอดรวม (บอสตัดสิน 24 ส.ค. 69) ──
  // เหตุผล: ยอดขายที่เคยทำไว้ยังเป็นของเครือ ตัดออกแล้วยอดรวมทั้งเครือจะหด ทั้งที่เงินเข้าจริง
  // แต่ต้องเขียนบอกไว้ ไม่งั้นอ่านแล้วขัดกับ "เปิดใช้งาน N ตัวแทน" บนการ์ดใบแรก (ผลตรวจภายนอก HQ-11)
  const ปิดใช้งาน = filtered.filter(d => dealerStatus(d) !== "active");
  const มีงานค้างที่ปิดใช้งาน = ปิดใช้งาน.filter(d => perfOf(d.code).openLeads > 0).length;
  const หมายเหตุปิดใช้งาน = ปิดใช้งาน.length > 0 ? ` · รวมตัวแทนที่ปิดใช้งาน ${ปิดใช้งาน.length} ราย` : "";
  // เฉลี่ยเฉพาะตัวแทนที่ "มีข้อมูล" (onTimePct > 0) — ตัวที่เป็น 0 = ยังไม่มีข้อมูล (ตารางแสดง "—")
  // เอามาเฉลี่ยเป็น 0 ไม่ได้ = เอา 0 สวมรอย "—" · ไม่มีใครมีข้อมูล → null → การ์ดแสดง "—"
  // เฉลี่ยเฉพาะสาขาที่ "มีข้อมูลให้วัด" — สาขาที่ยังไม่มีลูกค้าเป้าหมาย/ใบ ไม่เอา 0 มาถ่วงค่าเฉลี่ย
  const avgOf = (pick: (c: string) => number | null): number | null => {
    const vals = active.map(d => pick(d.code)).filter((v): v is number => v !== null);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  };
  const avgOnTime = avgOf(c => perfOf(c).onTimePct);
  const totalPct = totalTarget > 0 ? Math.round(totalRevenue / totalTarget * 100) : 0;

  function openAdd() { setEditTarget(null); setForm({ code: "", name: "", province: "", region: "", revenueTarget: 0, status: "active" }); setบัญชีใหม่({ email: "", password: "" }); setTargetTouched(false); setFormErr(""); setShowForm(true); }
  function openEdit(d: DealerRow) { setEditTarget(d); setForm({ code: d.code, name: d.name, province: d.province, region: d.region, revenueTarget: d.revenueTarget, status: d.status }); setTargetTouched(true); setFormErr(""); setShowForm(true); }

  // เปลี่ยนภาค: อัปเดตภาค + ถ้ายังไม่แก้เป้าเอง (โหมดเพิ่มใหม่) เติมค่าเริ่มต้นตามภาคให้
  //   และล้างจังหวัดทิ้งถ้ามันไม่ได้อยู่ในภาคใหม่ — กันข้อมูลขัดกันเอง (เช่น ภาค "ใต้" + จังหวัด "เชียงใหม่")
  //   ซึ่งเคยเกิดได้เพราะจังหวัดเป็นช่องพิมพ์อิสระ ไม่ผูกกับภาคเลย
  function changeRegion(region: string) {
    setForm(f => ({
      ...f,
      region,
      province: provincesOfRegion(region).includes(f.province) ? f.province : "",
      revenueTarget: (!editTarget && !targetTouched) ? regionDefaultTarget(region) : f.revenueTarget,
    }));
  }

  async function save() {
    const code = form.code.trim().toUpperCase();
    if (!code) { setFormErr("ต้องระบุรหัสตัวแทน"); return; }
    if (!form.name.trim()) { setFormErr("ต้องระบุชื่อตัวแทน"); return; }
    if (!form.region.trim()) { setFormErr("ต้องเลือกภาคก่อน — รายการจังหวัดขึ้นกับภาคที่เลือก"); return; }
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
    if (REAL_BACKEND) {
      setCreating(true);
      setFormErr("");
      // ตรวจที่หน้าจอก่อนยิง เพื่อบอกผู้ใช้ทันทีตรงช่องที่ผิด — เซิร์ฟเวอร์ยังตรวจซ้ำเสมอ
      const อีเมล = บัญชีใหม่.email.trim();
      const รหัส = บัญชีใหม่.password;
      if (อีเมล && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(อีเมล)) { setFormErr("รูปแบบอีเมลไม่ถูกต้อง"); return; }
      if (รหัส && รหัส.length < 8) { setFormErr("รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร"); return; }
      const res = await createDealerAccount({
        code, name: form.name.trim(), province: form.province.trim(),
        region: form.region, revenueTarget: form.revenueTarget,
        email: อีเมล || undefined, password: รหัส || undefined,
      });
      setCreating(false);
      if (!res.ok) { setFormErr(res.error); return; } // ล้มเหลวต้องบอกจริง คงฟอร์มไว้ให้แก้
      await dealersRepo.list().then(setDealers).catch(e => logRepoRead("dealers.list", e)); // route เพิ่งเพิ่มแถวที่เซิร์ฟเวอร์ → ดึงชุดจริง
      // อีเมลเข้าระบบของสาขาที่เพิ่งสร้าง — ต้องเติมเข้าตารางเองด้วย (ผู้ใช้แจ้ง 18 ส.ค. 69)
      //   รายชื่ออีเมลถูกดึงครั้งเดียวตอนเปิดหน้า → สาขาที่สร้างหลังจากนั้นจึงขึ้น "—" จนกว่าจะรีโหลดหน้า
      //   ใช้ค่าที่ route คืนมาตรง ๆ — แม่นกว่ายิงถามซ้ำ และไม่เดาสูตรอีเมลเอง
      setLoginEmails(m => ({ ...m, [code]: res.email }));
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
    if (REAL_BACKEND) {
      void deleteDealerAccount(d.code).then(res => {
        if (!res.ok) {
          // สาขาที่ยังมีข้อมูลงานขายลบไม่ได้โดยตั้งใจ (409) — เดิมจบแค่แจ้งว่าลบไม่ได้
          // แล้วผู้ดูแลไม่มีทางไปต่อ นอกจากลบข้อมูลลูกค้าจริงทิ้ง ซึ่งไม่มีใครกล้าทำ
          // → เสนอทางที่สาม: ยกงานทั้งหมดให้สาขาที่รับช่วงต่อ แล้วค่อยลบสาขาที่ว่างแล้ว
          if (/ยังมีข้อมูล/.test(res.error)) { setMoveFrom(d); return; }
          alert("ลบตัวแทนไม่สำเร็จ: " + res.error); return;
        }
        // ลบสำเร็จ (หรือสำเร็จบางส่วน) = ทะเบียนสาขาหายไปจากระบบจริงแล้ว ต้องเอาออกจากหน้าจอเสมอ
        //   เดิมกรณี "สำเร็จบางส่วน" ถูกตีความเป็นล้มเหลว แล้วคงสาขาไว้บนจอ ทั้งที่ในระบบไม่มีแล้ว
        //   ผู้ดูแลจึงเห็นเหมือนสาขาฟื้นกลับมา และไม่รู้ว่ายังมีบัญชีค้างต้องเคลียร์
        setDealers(prev => prev.filter(x => x.id !== d.id));
        if (res.warning) alert(res.warning);
        // audit บันทึกที่ route (server-side · การันตี) แล้ว — ไม่ลง client ซ้ำ
      });
      return;
    }
    // โหมดเดโม (local): ลบตรง ๆ — เดิมแค่เอาออกจากอาร์เรย์แล้วให้ชั้นข้อมูลเดาว่าต้องลบอะไร
    // การเดาแบบนั้นทำให้ "โหลดยังไม่เสร็จแล้วผู้ใช้แก้" กลายเป็นคำสั่งลบทั้งตาราง
    void dealersRepo.remove(d.code)
      .then(() => setDealers(prev => prev.filter(x => x.id !== d.id)))
      .catch(e => alert("ลบตัวแทนไม่สำเร็จ: " + friendlyError(e)));
    logAudit("ลบตัวแทน", `${d.code} · ${d.name}`);
  }

  function toggleStatus(d: DealerRow) {
    const next = d.status === "active" ? "inactive" : "active";
    setDealers(prev => prev.map(x => x.id === d.id ? { ...x, status: next } : x));
    // บันทึกให้ตรงกับสิ่งที่เกิดขึ้นจริง — เดิมเขียน "ระงับตัวแทน" ทั้งที่สั่ง "ปิดใช้งาน" (คนละคำกับที่ผู้ใช้กด)
    logAudit(next === "active" ? "เปิดใช้งานตัวแทน" : "ปิดใช้งานตัวแทน", `${d.code} · ${d.name}`);
  }

  // "เข้าระบบแทนตัวแทน" — HQ มีสิทธิ์เข้าบัญชีตัวแทนไหนก็ได้ (บอสยืนยัน)
  //
  // โหมดเดโม (local): เดิมปุ่มนี้เรียก login("dealer") ซึ่งเข้าด้วยบัญชีเดโมตัวเดียวเสมอ (CNX)
  // ไม่ว่าจะกดจากแถวไหน → คงพฤติกรรมเดิมไว้ (ไม่มีระบบยืนยันตัวตนจริงให้ผูกต่อสาขา)
  //
  // โหมดจริง (supabase): เดิมเข้าใจผิดว่าทำไม่ได้เพราะรหัสผ่านตัวแทนถูก hash ไว้ — แต่ service_role
  // ไม่จำเป็นต้อง "รู้" รหัสผ่านเพื่อสร้าง session แทนผู้ใช้อื่น: ใช้ Supabase magic-link
  // (generateLink ฝั่งเซิร์ฟเวอร์ — ดู /api/admin/dealers/impersonate) ออกลิงก์เข้าระบบครั้งเดียว
  // เปิดในแท็บใหม่ไปยังแอปตัวแทน (คนละ origin กับ HQ · session แยกต่อแท็บอยู่แล้ว — ดู client.ts)
  // จึงไม่กระทบ session ของ HQ เองในแท็บปัจจุบันเลย
  const canImpersonate = true;
  async function enterDealer(d: DealerRow) {
    if (!REAL_BACKEND) {
      setEntering(d.id);
      login("dealer");
      router.push("/dashboard");
      return;
    }
    // ── เปิดแท็บ "ตอนคลิก" เท่านั้น (แก้ 20 ส.ค. 69: กดแล้วไม่มีอะไรเกิดขึ้น) ──
    //
    // เดิมขอลิงก์จากเซิร์ฟเวอร์ก่อน แล้วค่อย window.open หลัง await
    //   เบราว์เซอร์ถือว่า "ไม่ได้เกิดจากการคลิกของผู้ใช้" แล้วบล็อกป๊อปอัพเงียบ ๆ
    //   ผู้ใช้เห็นเป็น "กดปุ่มแล้วไม่มีอะไรเกิดขึ้น" โดยไม่มีข้อความอะไรบอกเลย
    // แก้: จองแท็บไว้ตั้งแต่จังหวะคลิก แล้วค่อยพาไปที่ลิงก์เมื่อได้มา
    //   ถ้าจองไม่ได้ (ตัวกันป๊อปอัพเข้มมาก) → ไปในแท็บเดิมแทน ดีกว่าเงียบหาย
    //   (แอปตัวแทนคนละ origin กับ HQ · session ของ HQ ไม่หายไปด้วย)
    const แท็บ = window.open("", "_blank");
    setEntering(d.id);
    const res = await impersonateDealer(d.code);
    setEntering(null);
    if (!res.ok) { แท็บ?.close(); alert(`เข้าระบบแทน "${d.name}" ไม่สำเร็จ: ${res.error}`); return; }
    if (แท็บ) แท็บ.location.href = res.link;
    else window.location.href = res.link;
    // ⚠️ ห้ามบันทึกซ้ำจากตรงนี้ (แก้ 10 ส.ค. 69) — ฝั่งเซิร์ฟเวอร์บันทึกให้แล้วตอนออกลิงก์
    //   กดครั้งเดียวเคยได้บันทึก 2 แถว ("ZZP" กับ "ZZP · ชื่อสาขา") ทำให้นับจำนวนครั้งผิด
    //   และของฝั่งเซิร์ฟเวอร์เชื่อถือได้กว่า เพราะข้ามไม่ได้แม้ผู้ใช้ปิดหน้าจอทันทีหลังกด
    //   (ดู apps/hq/app/api/admin/dealers/impersonate/route.ts)
  }

  // การรีเซ็ตรหัสผ่านให้ตัวแทน ย้ายไปอยู่ในการ์ด "ข้อมูลเข้าระบบของตัวแทน"
  // ที่หน้ารายละเอียดตัวแทนแล้ว (DealerCredentialsCard · 13 ส.ค. 69)

  return (
    <div className="erp">
      {/* Header */}
      <div className="page-head">
        {/* คำโปรยใต้ชื่อหน้าถูกเอาออกทุกหน้า (บอสสั่ง 14 ส.ค. 69) */}
        <div />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ExportMenu filename="dealers" title="ตัวแทน (ทั้งเครือ)"
            headers={["รหัส","ตัวแทน","จังหวัด","ภาค","อีเมล","รายได้จริง","เป้า","อัตราปิดการขาย %","โอกาสการขาย","สถานะ"]}
            rows={filtered.map(d=>[d.code,d.name,d.province,d.region,loginEmailOf(d.code),perfOf(d.code).revenue,d.revenueTarget,perfOf(d.code).winRate ?? "—",perfOf(d.code).openLeads,dealerStatusLabel[d.status]])} />
          <button onClick={openAdd} className="btn btn-primary btn-md">
            <Plus size={14} /> เพิ่มตัวแทน
          </button>
        </div>
      </div>

      {/* ── KPI 4 ใบ — มาตรฐานเดียวกับหน้า HQ อื่นทั้งหมด (แดชบอร์ด · ภาพรวมยอดขาย · ใบเสนอราคา · ลูกค้า) ──
          เดิมหน้านี้ใช้ .stat-card ของเก่า: แถบสีซ้าย + ตัวเลขสีใหญ่ + หน่วยติดในตัวเลข ("10 ตัวแทน")
          ซึ่งเป็นที่เดียวในระบบที่ทำแบบนั้น · .stat-grid ยังไม่มี breakpoint ด้วย (จอแคบบีบ 4 ใบค้าง)
          กติกาของ .hq-kpi4: ป้าย → ตัวเลข (เข้ม ไม่ใส่สี) → หน่วย/บริบท · ไอคอนในกล่องสีจางมุมขวา */}
      {/* ⚠️ ทุกใบต้องรอข้อมูลก่อนประกาศตัวเลข — เลข 0 ระหว่างโหลดคือ "ข้อมูลผิด" ไม่ใช่ "ยังว่าง"
          รอบก่อนแก้เฉพาะใบแรก อีก 3 ใบยังประกาศ 0 อยู่ (พบจากผลตรวจรอบสุดท้าย 10 ส.ค. 69) */}
      <div className="hq-kpi4" style={{ marginBottom: "1.25rem" }}>
        {([
          { label: "ตัวแทนทั้งหมด", value: dealersLoaded ? `${filtered.length}` : "—", sub: dealersLoaded ? `เปิดใช้งาน ${active.length} ตัวแทน` : "กำลังโหลด…", Icon: Store, color: "#003366", bg: "#E8F0FE" },
          { label: "รายได้รวม", value: dealersLoaded ? `฿${(totalRevenue / 1_000_000).toFixed(1)}M` : "—", sub: `${totalPct}% ของผลรวมเป้ารายตัวแทน ฿${(totalTarget / 1_000_000).toFixed(1)}M${หมายเหตุปิดใช้งาน}`, Icon: Coins, color: "#059669", bg: "#E6F6EF" },
          { label: "โอกาสการขายทั้งหมด", value: dealersLoaded ? `${totalProjects}` : "—", sub: dealersLoaded ? `${active.filter(d => perfOf(d.code).openLeads > 0).length} จาก ${active.length} ตัวแทนที่เปิดใช้งาน มีงานอยู่${มีงานค้างที่ปิดใช้งาน > 0 ? ` · ปิดใช้งานแต่ยังมีงานค้าง ${มีงานค้างที่ปิดใช้งาน} ราย` : ""}` : "กำลังโหลด…", Icon: Briefcase, color: "#0891B2", bg: "#E6F4F9" },
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
          <input value={q} onChange={e => { setQ(e.target.value); setPage(0); }} placeholder="ค้นหาตัวแทน..." />
        </div>
        <div style={{ flex: 1 }} />
        <select aria-label="กรองตามภูมิภาค" value={regionFilter} onChange={e => { setRegionFilter(e.target.value); setPage(0); }} className="form-select" style={{ width: "auto", cursor: "pointer" }}>
          {["ทั้งหมด", ...REGIONS].map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select aria-label="กรองตามสถานะตัวแทน" value={statusFilter} onChange={e => { setStatusFilter(e.target.value as DealerStatus | "all"); setPage(0); }} className="form-select" style={{ width: "auto", cursor: "pointer" }}>
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
            {/* ── ความกว้างขั้นต่ำต้องรวมกันไม่เกินพื้นที่จริงของตาราง ─────────────────
                วัดจริง 11 ส.ค. 69 ที่จอ 1440: พื้นที่ตาราง = 1,128px
                ชุดเดิมรวมกัน 1,260px → เกินไป 132px ตารางจึงมีแถบเลื่อนแนวนอนคาอยู่ตลอด
                และคอลัมน์ปุ่มถูกดันออกนอกจอ (ผู้ใช้แจ้ง 11 ส.ค. 69)
                ชุดนี้รวม 1,102px — พอดีจอทำงานทั่วไปโดยยังไม่ต้องตัดปุ่มใด ๆ ออก
                จอกว้างกว่านั้นคอลัมน์จะยืดตาม % เองเหมือนตารางอื่นทั้งระบบ
                ⚠️ เพิ่ม/ลดคอลัมน์เมื่อไหร่ ต้องคำนวณผลรวมใหม่ทุกครั้ง (% ก็ต้องรวมได้ 100) */}
            {/* ⚠️ ทุกช่องมีระยะขอบซ้ายขวารวม 32px — minWidth ต้องเผื่อส่วนนี้เสมอ
                ไม่งั้นได้ความกว้างพอดีตัวอักษรแต่เนื้อหาโดนเฉือน (เคยได้ "C..." แทน "CNX") */}
            <colgroup>
              <col style={{ width: "3%", minWidth: 42 }} />{/* # */}
              <col style={{ width: "6%", minWidth: 68 }} />{/* รหัส — ต้องอ่านครบ 3 ตัวอักษร ห้ามตัด */}
              <col style={{ width: "11%", minWidth: 98 }} />{/* ชื่อตัวแทน — ยาวเกินตัดด้วยจุดไข่ปลา + tooltip (ยอมให้ตัดได้) */}
              <col style={{ width: "8%", minWidth: 88 }} />{/* จังหวัด — ยาวเกินตัด + tooltip เช่นกัน */}
              <col style={{ width: "8%", minWidth: 104 }} />{/* ภาค — ป้ายชื่อ ห้ามตัด (ยาวสุด "ตะวันออก" + ระยะขอบของป้าย) */}
              <col style={{ width: "13%", minWidth: 148 }} />{/* ยอด / เป้า — เผื่อระยะขอบช่อง ไม่งั้นป้าย % โดนตัด */}
              <col style={{ width: "8%", minWidth: 92 }} />{/* โอกาสขาย */}
              <col style={{ width: "7%", minWidth: 80 }} />{/* ตรงเวลา — เนื้อหาเป็นป้าย % สั้น ๆ */}
              <col style={{ width: "8%", minWidth: 108 }} />{/* สถานะ — ป้ายชื่อ ห้ามตัด ("เปิดใช้งาน" + ระยะขอบของป้ายเอง) */}
              {/* คอลัมน์ปุ่ม: เข้าระบบ (~99px) + ไอคอน 5 ปุ่ม (28px × 5) + gap 4px × 5 ช่อง ≈ 259px
                  บวกระยะขอบช่อง 32px = 291px · ตั้ง 292px คือพอดีเนื้อหาจริงโดยไม่เผื่อทิ้งเปล่า
                  (เดิม 300px เผื่อไว้เกินจำเป็น ซึ่งไปเบียดพื้นที่คอลัมน์อื่นจนตารางล้นจอ) */}
              <col style={{ width: "25%", minWidth: 292 }} />
            </colgroup>
            <thead>
              <tr>
                {/* หัวคอลัมน์ต้องสั้นพอที่จะไม่ถูกตัด (th ตั้ง white-space: nowrap ไว้ทั้งระบบ)
                    "โอกาสการขาย"/"ติดตามตรงเวลา" ยาวเกินความกว้างที่คอลัมน์นั้นต้องใช้จริง จึงย่อเหลือคำที่สื่อเท่ากัน */}
                {["#", "รหัส", "ชื่อตัวแทน", "จังหวัด", "ภาค", "ยอด / เป้า", "โอกาสขาย", "ตรงเวลา", "สถานะ", ""].map((h, i) => (
                  <th key={i}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={10} style={{ padding: "32px", textAlign: "center", fontSize: "0.8rem", color: "#6b7280" }}>{dealersLoaded ? "ไม่พบข้อมูล" : "กำลังโหลดข้อมูล…"}</td></tr>
              ) : pageSlice(filtered, Math.min(page, pageCountOf(filtered.length) - 1)).map((d, i) => (
                <ClickableRow key={d.id} className="clickable" style={{ opacity: dealerStatus(d) === "active" ? 1 : 0.55 }}
                  onActivate={() => setSelectedDealer(d)} label={`เปิดรายละเอียดตัวแทน ${d.name}`}>
                  <td style={{ fontSize: "0.72rem", color: "#6b7280", fontWeight: 600 }}>{Math.min(page, pageCountOf(filtered.length) - 1) * ROWS_PER_PAGE + i + 1}</td>
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
                        <button onClick={e => { e.stopPropagation(); enterDealer(d); }} disabled={entering === d.id} title="เข้าระบบแทนตัวแทน"
                          className="btn btn-primary btn-sm" style={{ opacity: entering === d.id ? 0.6 : 1, whiteSpace: "nowrap", flexShrink: 0 }}>
                          <LogIn size={12} /> {entering === d.id ? "..." : "เข้าระบบ"}
                        </button>
                      )}
                      <button onClick={e => { e.stopPropagation(); router.push(`/hq/dealers/${d.code}`); }} title="ดูรายละเอียดตัวแทน"
                        style={{ width: 28, height: 28, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#f0f4f8", border: "1px solid #e5e7eb", borderRadius: 7, color: "#003366", cursor: "pointer" }}>
                        <BarChart2 size={12} />
                      </button>
                      {/* ปุ่มรูปกุญแจ (ดูรหัสเข้าระบบ/รีเซ็ตรหัสผ่าน) ย้ายไปหน้ารายละเอียดตัวแทนแล้ว (บอสสั่ง 13 ส.ค. 69)
                          เป็นงานราย "สาขา" ไม่ใช่งานที่ต้องทำรัวจากลิสต์ · ตารางนี้เคยมีปุ่มต่อแถวถึง 6 ปุ่มจนแน่น
                          เข้าถึงได้ที่ปุ่มรูปกราฟข้างบน → การ์ด "ข้อมูลเข้าระบบของตัวแทน" ในแท็บภาพรวม */}
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
                </ClickableRow>
              ))}
            </tbody>
          </table>
        </div>
        <TablePagination page={page} total={filtered.length} onPage={setPage} unit="สาขา" />
      </div>

      {/* ── Add / Edit Modal ── */}
      {showForm && (
        <div onClick={() => setShowForm(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.42)", zIndex: 1050, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <ModalCard onClose={() => setShowForm(false)} label="ฟอร์มข้อมูลตัวแทน" style={{ ...CARD, width: 460, maxWidth: '100%' }}>
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

              <div className="form-grid" style={{ gridTemplateColumns: "1fr 2fr" }}>
                <div className="form-section">ข้อมูลตัวแทน</div>
                <InputField label="รหัสตัวแทน *">
                  <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase().slice(0, 6) }))} placeholder="เช่น BKK" disabled={!!editTarget}
                    style={{ ...INPUT_STYLE, textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.06em", opacity: editTarget ? 0.6 : 1 }} />
                  {editTarget && <div style={{ fontSize: "0.65rem", color: "#6b7280", marginTop: 3 }}>แก้ไขรหัสไม่ได้</div>}
                </InputField>
                <InputField label="ชื่อตัวแทน *">
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="บจ. ตัวอย่างสตีล..." style={INPUT_STYLE} />
                </InputField>
              </div>

              <div className="form-grid">
                <div className="form-section">พื้นที่รับผิดชอบ</div>
                {/* ภาคมาก่อนจังหวัด — เพราะจังหวัดที่เลือกได้ขึ้นกับภาคที่เลือกไว้ */}
                <InputField label="ภาค *">
                  {/* ต้องมี "ยังไม่ระบุ" เหมือนช่องอื่น — เดิมเด้งเป็น "กลาง" ให้เองทั้งที่ไม่มีใครเลือก
                      และติดดาว * เพราะ "จังหวัด" ขึ้นกับภาค — ไม่เลือกภาคก็เลือกจังหวัดไม่ได้เลย (ผู้ใช้แจ้ง 18 ส.ค. 69) */}
                  <select aria-label="ภูมิภาค" value={form.region} onChange={e => changeRegion(e.target.value)} style={{ ...INPUT_STYLE, cursor: "pointer" }}>
                    <option value="">— ยังไม่ระบุ —</option>
                    {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </InputField>
                <InputField label="จังหวัดที่ตั้ง *">
                  {/* จังหวัดของตัวแทนเดิมที่ไม่อยู่ในรายการของภาคนั้น (สะกดต่าง/ข้อมูลเก่า) ต้องยังเห็นค่าเดิมอยู่
                      ไม่งั้นแค่เปิดฟอร์มมาแก้ชื่อ จังหวัดก็หายไปเงียบ ๆ แล้วถูกบันทึกทับเป็นค่าว่าง */}
                  <select aria-label="จังหวัดที่ตั้ง" value={form.province} onChange={e => setForm(f => ({ ...f, province: e.target.value }))}
                    style={{ ...INPUT_STYLE, cursor: "pointer" }}>
                    <option value="">{form.region ? "— ยังไม่ระบุ —" : "— เลือกภาคก่อน —"}</option>
                    {provincesOfRegion(form.region).map(p => <option key={p} value={p}>{p}</option>)}
                    {form.province && !provincesOfRegion(form.region).includes(form.province) && (
                      <option value={form.province}>{form.province} (นอกภาค {form.region})</option>
                    )}
                  </select>
                </InputField>
                {!editTarget && (<>
                  {/* ── บัญชีเข้าระบบของสาขา (เฉพาะตอนสร้างใหม่) ──────────────────────
                      แก้อีเมล/รหัสผ่านของสาขาที่มีอยู่แล้วต้องใช้ปุ่ม "รีเซ็ตรหัสผ่าน" ในตาราง
                      ไม่ใช่ฟอร์มนี้ — ฟอร์มนี้แก้ทะเบียนสาขา ไม่ได้แตะระบบยืนยันตัวตน */}
                  <div className="form-section">บัญชีเข้าระบบ</div>
                  <InputField label="อีเมลเข้าระบบ">
                    <input type="email" value={บัญชีใหม่.email} onChange={e => setบัญชีใหม่(v => ({ ...v, email: e.target.value }))}
                      aria-label="อีเมลเข้าระบบ" placeholder={form.code ? `${form.code.toLowerCase()}@partner-agent.co.th` : "เว้นว่าง = ระบบตั้งให้"} style={INPUT_STYLE} />
                    <div style={{ fontSize: "0.65rem", color: "#6b7280", marginTop: 3 }}>
                      เว้นว่าง = ระบบตั้งให้จากรหัสสาขา · แนะนำให้ใส่อีเมลจริงของสาขา จะได้รับอีเมลลืมรหัสผ่านได้
                    </div>
                  </InputField>
                  <InputField label="รหัสผ่าน">
                    <input type="text" value={บัญชีใหม่.password} onChange={e => setบัญชีใหม่(v => ({ ...v, password: e.target.value }))}
                      aria-label="รหัสผ่าน" placeholder="เว้นว่าง = ระบบสุ่มให้" style={INPUT_STYLE} />
                    <div style={{ fontSize: "0.65rem", color: "#6b7280", marginTop: 3 }}>
                      อย่างน้อย 8 ตัวอักษร · แสดงเป็นตัวอักษรปกติโดยตั้งใจ — HQ ต้องคัดลอกไปแจ้งสาขา
                    </div>
                  </InputField>
                </>)}
                <div className="form-section">เป้าหมายและสถานะ</div>
                <InputField label="เป้ายอดขาย (บาท/ปี)">
                  {/* เป้ายอดขายติดลบไม่มีอยู่จริงในทางธุรกิจ และทำให้ตัวเลขอื่นเพี้ยนตามเป็นทอด ๆ:
                      เปอร์เซ็นต์ความสำเร็จของสาขา · เป้ารวมทั้งเครือบนหัวตาราง · กราฟเทียบเป้า
                      เดิมรับค่าติดลบตรง ๆ (พิมพ์ -5000000 แล้วบันทึกลงระบบได้จริง · พบ 6 ส.ค. 69) */}
                  <input type="number" min={0} value={form.revenueTarget || ""} onChange={e => { setTargetTouched(true); setForm(f => ({ ...f, revenueTarget: Math.max(0, Number(e.target.value) || 0) })); }} placeholder="0" style={INPUT_STYLE} />
                  {/* ยังไม่เลือกภาค = ยังแนะนำค่าไม่ได้ — ห้ามขึ้นเลขลอย ๆ ที่ไม่รู้ว่ามาจากไหน */}
                  {!editTarget && !targetTouched && form.region && (
                    <div style={{ fontSize: "0.65rem", color: "#6b7280", marginTop: 3 }}>
                      ค่าเริ่มต้นแนะนำตามภาค {form.region} · ฿{(regionDefaultTarget(form.region) / 1_000_000).toFixed(0)}M — แก้ไขได้
                    </div>
                  )}
                </InputField>
                <InputField label="สถานะ">
                  <select aria-label="สถานะตัวแทน" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as DealerStatus }))} style={{ ...INPUT_STYLE, cursor: "pointer" }}>
                    <option value="active">{dealerStatusLabel.active}</option>
                    <option value="inactive">{dealerStatusLabel.inactive}</option>
                  </select>
                </InputField>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
                <button onClick={() => setShowForm(false)} disabled={creating} className="btn btn-secondary btn-md">ยกเลิก</button>
                <button onClick={() => void save()} disabled={creating} className="btn btn-primary btn-md"
                  style={creating ? { opacity: .6, cursor: "not-allowed" } : undefined}>
                  {editTarget ? "บันทึกการแก้ไข" : creating ? "กำลังสร้างบัญชี…" : "สร้างตัวแทน"}
                </button>
              </div>
            </div>
          </ModalCard>
        </div>
      )}

      {/* ── New Dealer Credentials Modal ── */}
      {/* ── ย้ายข้อมูลไปสาขาอื่น (ทางออกของสาขาที่ลบไม่ได้เพราะยังมีข้อมูล) ── */}
      {moveFrom && (
        <div onClick={() => !moving && setMoveFrom(null)}
          style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(45,45,45,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <ModalCard onClose={() => !moving && setMoveFrom(null)} label="ย้ายข้อมูลตัวแทน"
            style={{ width: "100%", maxWidth: 520, background: "#fff", borderRadius: 18, overflow: "hidden", boxShadow: "0 24px 80px rgba(0,0,0,.28)" }}>
            <div style={{ background: "#003366", color: "#fff", padding: "16px 22px", fontWeight: 800 }}>
              ลบ &quot;{moveFrom.name}&quot; ไม่ได้ — ยังมีข้อมูลอยู่
            </div>
            <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ fontSize: "0.84rem", color: "#2D2D2D", lineHeight: 1.7 }}>
                สาขานี้ยังมีลูกค้า/ลูกค้าเป้าหมาย/ใบเสนอราคาอยู่ ระบบจึงไม่ยอมให้ลบ (กันข้อมูลการขายหายถาวร)
                <br />ยกงานทั้งหมดให้สาขาที่รับช่วงต่อก่อน แล้วค่อยลบสาขานี้ได้
              </div>
              <div>
                <label className="form-label">ย้ายไปที่สาขา</label>
                <select className="form-input" value={moveTo} onChange={e => { setMoveTo(e.target.value); setMoveErr(""); }} disabled={moving}>
                  <option value="">— เลือกสาขาปลายทาง —</option>
                  {dealers.filter(x => x.code !== moveFrom.code).map(x => (
                    <option key={x.code} value={x.code}>{x.code} · {x.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "10px 14px", fontSize: "0.76rem", color: "#9a3412", lineHeight: 1.6 }}>
                <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>
                  ย้ายได้เฉพาะเข้าสาขาที่ <b>ยังไม่มีข้อมูล</b> — ระบบนับเลขที่รายการแยกรายสาขา
                  ถ้าปลายทางมีข้อมูลอยู่แล้วเลขจะชนกัน ระบบจะปฏิเสธและไม่แก้อะไรเลย
                  <br />ย้ายแล้ว<b>ย้อนกลับอัตโนมัติไม่ได้</b> · ตั้งค่าสาขา (โลโก้/หัวกระดาษ) ไม่ย้ายตามไป
                </span>
              </div>
              {moveErr && <div style={{ fontSize: "0.8rem", color: "#dc2626", fontWeight: 600, lineHeight: 1.6 }}>{moveErr}</div>}
            </div>
            <div style={{ padding: "14px 22px", borderTop: "1px solid #e5e7eb", background: "#fafafa", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn btn-secondary btn-md" disabled={moving} onClick={() => setMoveFrom(null)}>ยกเลิก</button>
              <button className="btn btn-primary btn-md" disabled={!moveTo || moving}
                style={!moveTo || moving ? { opacity: .5, cursor: "not-allowed" } : undefined}
                onClick={async () => {
                  if (!moveTo) return;
                  setMoving(true); setMoveErr("");
                  const res = await moveDealerData(moveFrom.code, moveTo);
                  setMoving(false);
                  if (!res.ok) { setMoveErr(res.error); return; }
                  setMoveFrom(null); setMoveTo("");
                  alert(`ย้ายข้อมูล ${res.total} รายการจาก "${moveFrom.code}" ไป "${moveTo}" เรียบร้อย — ลบสาขา "${moveFrom.code}" ได้แล้ว`);
                }}>
                {moving ? "กำลังย้าย…" : "ย้ายข้อมูล"}
              </button>
            </div>
          </ModalCard>
        </div>
      )}

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
                <CopyField label={credsModal.mode === "reset" ? "รหัสผ่านใหม่" : "รหัสผ่านเริ่มต้น"} value={credsModal.creds.password ?? "—"} />
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
                    <span style={{ fontSize: "0.72rem", color: "#6b7280" }}>เป้า ฿{(d.revenueTarget / 1_000_000).toFixed(1)}M</span>
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
                  <CopyField label="อีเมล" value={loginEmailOf(d.code)} />
                  {/* ช่องเดียวกับในหน้าต่าง "รหัสเข้าระบบ" — ต้องใช้ตัวเดียวกันทั้งสองที่
                      เดิมจุดนี้ค้างเป็น CopyField ที่ขึ้น "—" เสมอ (รหัสจริงอยู่ใน Auth เป็น hash)
                      พอเปิดฟีเจอร์ให้ HQ ดูรหัสได้แล้ว ยังลืมเปลี่ยนจุดนี้ HQ จึงเห็น "—" ที่แผงนี้
                      แต่เห็นรหัสจริงในหน้าต่างอีกใบ — สับสนว่าตกลงระบบมีรหัสให้ดูหรือไม่ */}
                  <DealerPasswordField code={d.code} fallback={d.credentials?.password} />
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

      {/* โมดัล "รหัสเข้าระบบ/รีเซ็ตรหัสผ่าน" ย้ายไปเป็นการ์ดในหน้ารายละเอียดตัวแทนแล้ว (13 ส.ค. 69)
          ดู DealerCredentialsCard — ความสามารถเท่าเดิมทุกอย่าง */}
    </div>
  );
}
