"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  leadStatusLabel, leadStatusColor,
  RP_STORAGE_KEY,
  quotationStatusLabel, quotationStatusColor,
  buildLeadReport, buildLeadTasks, seedLeadTasks, taskProgress, mainTemplateOf, apptTypeLabel, fmtISOToThai,
  loadDealerFiles, addDealerFile, DEALER_FILES_EVENT, extOfName, guessFileCategory,
  type LeadStatus, type LeadRow, type ResponsiblePerson, type ApptType, type DealerFile,
} from "@pms/shared/lib/mock";
import { FilePreviewModal } from "@pms/shared/components/ui/FilePreviewModal";
import { EmptyState } from "@pms/shared/components/ui/EmptyState";
import { LeadTasks } from "@pms/shared/components/ui/LeadTasks";
import { LeadQuotationsPanel } from "@pms/shared/components/ui/LeadQuotationsPanel";
import { PersonPicker, AssigneeAvatars } from "@pms/shared/components/ui/PersonPicker";
import { useMasterCatalog } from "@pms/shared/lib/useMasterCatalog";
import { matchCustomers } from "@pms/shared/lib/customerMatch";
import { useLeadRules } from "@pms/shared/lib/useHQRules";
import { useLostReasons } from "@pms/shared/lib/useHQConfig";
import { fileToResizedDataURL } from "@pms/shared/lib/imageResize";
import { TemplateSelect } from "@pms/shared/components/ui/TemplateSelect";
import { useRole } from "@pms/shared/context/RoleContext";
import {
  Plus, Search, X,
  CheckCircle2, User, ArrowRight, Building2,
  MessageSquare, Paperclip, Trash2, Eye, Trophy, XCircle, Coins, Target, TrendingUp, Percent, Package, Layers,
  Phone, Mail, Users, FileText, StickyNote, CalendarClock, MapPin, CheckSquare, Calendar,
  Check, ChevronDown,
  ArrowUpDown, ArrowUp, ArrowDown,
  LayoutList, Columns3, AlarmClock, ChevronRight, Ruler,
} from "lucide-react";
import { ExportMenu } from "@pms/shared/components/ui/ExportMenu";
import { useSales } from "@pms/shared/context/SalesContext";
import { DrawerSection } from "@pms/shared/components/ui/RightDrawer";
import { useTableLayout } from "@pms/shared/components/ui/TableTools";
import { useFilters, APP_NOW, APP_NOW_ISO } from "@pms/shared/context/FilterContext";
import { FilterBar } from "@pms/shared/components/filters/FilterBar";
import { FilterRow, FilterSelect } from "@pms/shared/components/filters/FilterRow";
import { TopbarActions } from "@pms/shared/components/layout/TopbarActions";
import { MultiLineChart, Donut } from "@pms/shared/components/ui/Charts";
import { leadCreatedDate } from "@pms/shared/lib/leadMetrics";
import { useCurrentDealer } from "@pms/shared/lib/useCurrentDealer";
import { persons as personsRepo, files as filesRepo, storage as fileStorage } from "@pms/shared/lib/data";
import { ReportEditor } from "@pms/shared/components/ui/ReportEditor";

// ─── Design tokens ────────────────────────────────────────────────────────

const ALL_STATUSES: LeadStatus[] = [
  "WAITING","BULLET","QUOTED","FOLLOWUP","NEGO","PAID","CANCELLED"
];
// ความคืบหน้าตามขั้นตอน (module-level เพื่อใช้ใน OverviewEditor) — PAID=100, CANCELLED=0
// (DEFAULT_PERSONS ถูกลบ — เดิมเป็นพนักงาน 5 คนจากชุดตัวอย่าง
//  ตาราง responsible_persons ว่าง = ไม่มีวันถูกแทนที่ → ตัวแทนเลือกชื่อคนที่ไม่มีอยู่จริง
//  แล้วชื่อนั้นถูกบันทึกลงลีดใน DB จริง)
// Lead Source ตามสเปก: Facebook / Website / LINE / Walk-in / Referral / Exhibition / Other
// สีของแต่ละแหล่งที่มา (โดนัท) — วนใช้ตามลำดับจำนวนมาก→น้อย
const SOURCE_COLORS = ["#2563EB", "#16A34A", "#F59E0B", "#7C3AED", "#EA580C", "#0D9488", "#94A3B8"];
const SOURCES = ["Facebook","เว็บไซต์","LINE","Walk-in","แนะนำต่อ","งานแสดงสินค้า","อื่นๆ"];
// ช่วงมูลค่าใน FilterRow — เดิมเป็นช่องกรอก "มูลค่าขั้นต่ำ/สูงสุด (M฿)" สองช่องในแผงตัวกรอง
// เก็บเป็นสตริงหน่วยล้านบาท เพราะตัวกรองจริง (fValueMin/fValueMax) อ่านค่าแบบนั้นอยู่แล้ว
const VALUE_BANDS = [
  { v:"lt1",   l:"ต่ำกว่า 1 ล้าน",  min:"",   max:"1"  },
  { v:"1to5",  l:"1 – 5 ล้าน",      min:"1",  max:"5"  },
  { v:"5to10", l:"5 – 10 ล้าน",     min:"5",  max:"10" },
  { v:"gte10", l:"มากกว่า 10 ล้าน", min:"10", max:""   },
];
const PROVINCES = ["กรุงเทพฯ","เชียงใหม่","ระยอง","เชียงราย","นนทบุรี","สมุทรสาคร","นครสวรรค์","ราชบุรี","ขอนแก่น","อื่นๆ"];
const THAI_MONTHS = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
function thaiDateStr(d: Date) { return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`; }

type SortKey = "company"|"value"|"status"|"assigned"|"priority";

// คอลัมน์ที่ซ่อน/แสดงได้ (optional) สำหรับ TableTools — key ตรงกับ th/td/col ในตาราง
const COLS: { key: string; label: string }[] = [
  { key: "province", label: "จังหวัด" },
  { key: "source",   label: "ช่องทางที่มา" },
  { key: "product",  label: "แม่แบบ" },
  { key: "area",     label: "พื้นที่" },
  { key: "activity", label: "กิจกรรมล่าสุด" },
];
// ─── Helpers ─────────────────────────────────────────────────────────────
function parseValue(v: string) {
  const n = parseFloat(String(v).replace(/[฿,\s]/g,""));
  if (!isFinite(n)) return 0;
  if (/T/i.test(v)) return n*1e12;
  if (/B/i.test(v)) return n*1e9;
  if (/M/i.test(v)) return n*1e6;
  if (/K/i.test(v)) return n*1e3;
  return n;
}
function fmtM(n: number) {
  if (!isFinite(n) || n <= 0) return "฿0";
  if (n >= 1e12) return "฿"+(n/1e12).toFixed(1)+"T";
  if (n >= 1e9)  return "฿"+(n/1e9).toFixed(1)+"B";
  if (n >= 1e6) return "฿"+(n/1e6).toFixed(1)+"M";
  if (n >= 1e3) return "฿"+Math.round(n/1e3)+"K";
  return "฿"+n.toLocaleString();
}
// ฟอร์แมตมูลค่าจากสตริงดิบ/มีหน่วย → ดูง่าย (฿1.2B / ฿1.2M / ฿480K)
function fmtVal(v: string) { return fmtM(parseValue(v)); }

// ความคืบหน้าของลีด (%) — จากงานที่เช็ก (แหล่งเดียวกับ LeadTasks) · PAID=100 · CANCELLED=0
function leadProg(l: LeadRow): number {
  if (l.status === "PAID") return 100;
  if (l.status === "CANCELLED") return 0;
  return taskProgress(l.tasks?.length ? l.tasks : buildLeadTasks());
}
// จำนวนงานที่ทำเสร็จ / ทั้งหมด (ไว้แสดงบนการ์ดบอร์ด)
function leadTaskCount(l: LeadRow): { done: number; total: number } {
  const t = l.tasks?.length ? l.tasks : buildLeadTasks();
  return { done: t.filter(x => x.done).length, total: t.length };
}
// กิจกรรมล่าสุดของลีด (activities เรียงใหม่สุดอยู่บน) — ไม่มีกิจกรรม/ไม่มีวันที่สร้าง = "—"
// ห้าม fallback ไป leadCreatedDate(): มันสังเคราะห์วันจาก numId (numId × 17 % 150 วันก่อนวันนี้)
// ซึ่งใช้ได้แค่กับกราฟรวมของลีด seed — เอามาโชว์เป็น "ติดต่อล่าสุด" คือโกหกคนอ่าน
// (ลีดที่เพิ่งสร้างเคยขึ้น "11 ก.พ. 2569" ย้อนหลัง 5 เดือน → เซลส์นึกว่าลีดถูกทิ้งค้าง)
// กติกาเดียวกับ lastContactLabel() ใน leadMetrics และคอมเมนต์ที่ hq/leads/page.tsx:559
function lastActivity(l: LeadRow): string { return l.activities?.[0]?.date ?? l.createdAt ?? "—"; }
// ผู้รับผิดชอบเก็บได้หลายคน (คั่นด้วย ", ") → เทียบแบบ "มีคนนี้อยู่ในรายชื่อ" ไม่ใช่เท่ากันเป๊ะ
function assignedHas(assigned: string, person: string): boolean {
  return assigned.split(",").map(s => s.trim()).includes(person);
}

// แปลงวันที่ไทยของกิจกรรม ("22 มิ.ย. 2569") → Date เพื่อใช้กรองตามช่วงเวลา (พ.ศ. − 543)
const TH_MONTH: Record<string, number> = { "ม.ค.":0, "ก.พ.":1, "มี.ค.":2, "เม.ย.":3, "พ.ค.":4, "มิ.ย.":5, "ก.ค.":6, "ส.ค.":7, "ก.ย.":8, "ต.ค.":9, "พ.ย.":10, "ธ.ค.":11 };
function parseThaiDate(s?: string): Date | null {
  if (!s) return null;
  const m = /^(\d{1,2})\s+(\S+)\s+(\d{4})/.exec(s.trim());
  if (!m || !(m[2] in TH_MONTH)) return null;
  const y = +m[3] > 2500 ? +m[3] - 543 : +m[3];
  return new Date(y, TH_MONTH[m[2]], +m[1]);
}
// วันที่ล่าสุดของลีด (จากกิจกรรม) — ไม่มีกิจกรรม = ไม่ตัดออกจากตัวกรองเวลา
function leadLatestDate(l: LeadRow): Date | null {
  const dates = (l.activities ?? []).map(a => parseThaiDate(a.date)).filter(Boolean) as Date[];
  if (!dates.length) return null;
  return new Date(Math.max(...dates.map(d => d.getTime())));
}
// ── ลีดที่ต้องรีบติดตาม (ขาดการติดต่อเกิน 7 วัน) — กฎธุรกิจเดียวที่ต้องมี (ไม่มี SLA) ──
const MOCK_TODAY_LEAD = new Date(2026, 5, 30); // 2026-06-30
const CUR_YEAR = MOCK_TODAY_LEAD.getFullYear(); // กราฟรายเดือน = ปีปัจจุบันเท่านั้น (ข้อมูลมีของปีที่แล้วปนอยู่)
function daysSinceContact(l: LeadRow): number | null {
  const d = leadLatestDate(l) ?? parseThaiDate(l.createdAt);
  if (!d) return null;
  return Math.floor((MOCK_TODAY_LEAD.getTime() - d.getTime()) / 86400000);
}
function needsFollowUp(l: LeadRow, threshold = 7): boolean {
  if (l.status === "PAID" || l.status === "CANCELLED") return false; // ปิดแล้วไม่ต้องตาม
  const days = daysSinceContact(l);
  return days !== null && days > threshold;
}

// ─── Priority (ความสำคัญ) — deterministic by value tier ──────────────────────
type Priority = "HIGH" | "MEDIUM" | "LOW";
// PRIORITIES ถูกลบพร้อมตัวกรอง "ความสำคัญ" — ป้ายความสำคัญในแผงรายละเอียดลีดยังใช้ leadPriority/priorityLabel อยู่
const priorityLabel: Record<Priority, string> = { HIGH: "สูง", MEDIUM: "กลาง", LOW: "ต่ำ" };
const priorityColor: Record<Priority, { text: string; bg: string }> = {
  HIGH:   { text: "#dc2626", bg: "#fee2e2" },
  MEDIUM: { text: "#d97706", bg: "#fff3cd" },
  LOW:    { text: "#6b7280", bg: "#f0f0f5" },
};
const priorityRank: Record<Priority, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
// value≥3M → สูง, ≥1M → กลาง, ต่ำกว่า → ต่ำ (deterministic, ไม่มีการสุ่ม)
function leadPriority(lead: LeadRow): Priority {
  const v = parseValue(lead.value);
  if (v >= 3e6) return "HIGH";
  if (v >= 1e6) return "MEDIUM";
  return "LOW";
}

// ─── Deterministic drawer seeds (no randomness) ───────────────────────────
// กิจกรรม — เริ่มว่าง (เกิดจากการทำงานจริง ไม่ใส่ข้อมูลกระป๋อง)
// งานแต่ละอย่าง → ประเภทกิจกรรม (ไอคอน) เพื่อสร้างไทม์ไลน์จากงานที่ทำเสร็จจริง
const TASK_ACTIVITY_TYPE: Record<string, string> = {
  contact: "call", collect: "note", requirement: "meeting", catalog: "email",
  appointment: "meeting", makeQuote: "doc", sendQuote: "doc",
  followup: "call", negotiate: "meeting", close: "doc",
};
// ไทม์ไลน์กิจกรรม — ถ้าลีดยังไม่มี activities ที่บันทึกไว้ ให้สร้างจากงานที่ติ๊กเสร็จจริง (ใหม่สุดอยู่บน)
function seedActivities(lead: LeadRow): { date: string; text: string; type?: string }[] {
  return (lead.tasks ?? [])
    .filter(t => t.done && t.doneAt)
    .slice().reverse()
    .map(t => ({
      date: t.doneAt!,
      text: t.doneBy ? `${t.label} · ${t.doneBy}` : t.label,
      type: TASK_ACTIVITY_TYPE[t.key] ?? "task",
    }));
}
// ไฟล์ — เริ่มว่าง (อัปโหลดจริงเท่านั้น)
function seedFiles(_lead: LeadRow): string[] {
  return [];
}

// ─── Sub-components ───────────────────────────────────────────────────────
function SortIcon({ field, sortKey, sortDir }: { field:string; sortKey:string; sortDir:"asc"|"desc" }) {
  if (sortKey !== field) return <ArrowUpDown size={11} color="#e5e7eb" />;
  return sortDir === "asc" ? <ArrowUp size={11} color="#003366" /> : <ArrowDown size={11} color="#003366" />;
}

// ─── ภาพรวม (แก้ไขในตัว) — ฟอร์มแก้ไขข้อมูลลูกค้าเป้าหมายในแท็บภาพรวมของโมดัลรายละเอียด ─────
// สไตล์ + Cell ต้องอยู่นอก OverviewEditor — ประกาศข้างในจะได้ "ฟังก์ชันตัวใหม่" ทุกเรนเดอร์
// React ถือเป็นคนละคอมโพเนนต์ → unmount/mount ลูกใหม่ทุกครั้งที่พิมพ์ → ช่องกรอกหลุดโฟกัสหลังพิมพ์ 1 ตัวอักษร
// ช่องกรอกไม่มีกรอบของตัวเอง (บอสสั่ง) — กรอบมีแค่ชั้นเดียวคือขอบแถว หน้าตาเหมือนตอนอ่าน
const OV_INP: React.CSSProperties = { width:"100%", height:26, padding:"0 8px", borderRadius:6, border:"none", outline:"none", fontSize:"0.8rem", fontWeight:700, fontFamily:"inherit", color:"#2D2D2D", background:"transparent", boxSizing:"border-box" };
const OV_CELL: React.CSSProperties = { display:"flex", alignItems:"center", gap:10, padding:"5px 10px", border:"1px solid #eef1f5", borderRadius:9, background:"#fafbfc", minWidth:0 };
const OV_CELL_LBL: React.CSSProperties = { fontSize:"0.7rem", color:"#8a929c", fontWeight:600, flexShrink:0 };
function OvCell({ icon:Ic, label, children }:{ icon: typeof User; label:string; children:React.ReactNode }) {
  return (
    <div style={OV_CELL}>
      <Ic size={14} color="#94a3b8" style={{ flexShrink:0 }} />
      <span style={OV_CELL_LBL}>{label}</span>
      <span style={{ flex:1, minWidth:0 }}>{children}</span>
    </div>
  );
}

function OverviewEditor({ lead, persons, onSave }: {
  lead: LeadRow; persons: string[]; onSave: (l: LeadRow) => void;
}) {
  const catalog = useMasterCatalog(); // แม่แบบจากแคตตาล็อกกลาง (HQ แก้ → เห็นตรงกัน)
  const lostReasons = useLostReasons(); // เหตุผลปิดไม่สำเร็จที่ HQ กำหนด (ผ่าน repo)
  const seed = () => ({
    company: lead.company ?? "", contact: lead.contact ?? "", phone: lead.phone ?? "",
    email: lead.email ?? "", province: lead.province ?? PROVINCES[0], source: lead.source ?? SOURCES[0],
    product: lead.product ?? catalog[0]?.name ?? "", status: lead.status,
    assigned: lead.assigned ?? persons[0], value: lead.value ?? "",
    area: lead.area != null ? String(lead.area) : "",
    project: lead.project ?? "",
    note: lead.note ?? "", lostReason: lead.lostReason ?? "", logo: lead.logo ?? "",
  });
  const [f, setF] = useState(seed);
  const logoRef = useRef<HTMLInputElement>(null);
  // reseed เมื่อสลับลูกค้าเป้าหมาย
  useEffect(() => { setF(seed()); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [lead.id]);
  const set = (k: keyof ReturnType<typeof seed>, v: string) => setF(p => ({ ...p, [k]: v }));
  async function uploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    set("logo", await fileToResizedDataURL(file, 256)); // ย่อก่อนเก็บ กัน quota เต็ม
  }

  const dirty =
    f.company !== (lead.company ?? "") || f.contact !== (lead.contact ?? "") ||
    f.phone !== (lead.phone ?? "") || f.email !== (lead.email ?? "") ||
    f.province !== (lead.province ?? "") || f.source !== (lead.source ?? "") ||
    f.product !== (lead.product ?? "") || f.status !== lead.status ||
    f.assigned !== (lead.assigned ?? "") || f.value !== (lead.value ?? "") ||
    f.area !== (lead.area != null ? String(lead.area) : "") ||
    f.project !== (lead.project ?? "") ||
    f.note !== (lead.note ?? "") || f.lostReason !== (lead.lostReason ?? "") || f.logo !== (lead.logo ?? "");
  // ความคืบหน้า = แหล่งเดียวกับแท็บ "งาน/ความคืบหน้า" (LeadTasks) → เลขตรงกันทุกแท็บ
  const pct = lead.status === "PAID" ? 100 : lead.status === "CANCELLED" ? 0
    : taskProgress(lead.tasks?.length ? lead.tasks : buildLeadTasks());

  const inp = OV_INP;

  function save() {
    onSave({
      ...lead, ...f, logo: f.logo || undefined, category: mainTemplateOf(f.product), value: fmtVal(f.value),
      // เว้นว่าง = ไม่มีข้อมูลพื้นที่ (undefined) ไม่ใช่ 0
      area: f.area.trim() && Number(f.area) > 0 ? Number(f.area) : undefined,
      project: f.project.trim() || undefined,
      lostReason: f.status === "CANCELLED" ? (f.lostReason || undefined) : undefined,
    });
  }

  // แก้ไข "ในที่เดิม" — ใช้แถวหน้าตาเดียวกับตอนอ่าน (ไอคอน + ป้าย + ค่า) ค่ากลายเป็นช่องกรอก
  // ไม่เด้งป็อบอัพ (บอสสั่ง — ให้เหมือนหน้าลูกค้า) · Cell/สไตล์อยู่นอกคอมโพเนนต์ (ดูคอมเมนต์ข้างบน)
  const cell = OV_CELL, cellLbl = OV_CELL_LBL, Cell = OvCell;

  return (
    <div>
      {/* มูลค่า + ป้ายสถานะ — ตำแหน่งเดียวกับตอนอ่าน */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12, marginBottom:12 }}>
        <div style={{ minWidth:0 }}>
          <div style={{ fontSize:"0.62rem", color:"#8a929c", fontWeight:700 }}>มูลค่าประเมิน</div>
          <input value={f.value} onChange={e=>set("value",e.target.value)} placeholder="฿1.4M"
            style={{ ...inp, width:170, marginTop:4, fontSize:"1rem", fontWeight:800, color:"#003366" }} />
          <div style={{ display:"flex", gap:8, marginTop:8, flexWrap:"wrap", alignItems:"center" }}>
            {/* สถานะลอยเดี่ยวนอกแถว — คงกรอบบางไว้ให้รู้ว่ากดได้ (กรอบที่ถอดคือกรอบซ้อนในแถวข้อมูล) */}
            <select value={f.status} onChange={e=>set("status",e.target.value)} style={{ ...inp, width:"auto", height:"auto", padding:"5px 8px", fontSize:"0.72rem", fontWeight:700, border:"1px solid #eef1f5", background:"#fafbfc" }}>
              {(Object.keys(leadStatusLabel) as LeadStatus[]).map(k => <option key={k} value={k}>{leadStatusLabel[k]}</option>)}
            </select>
            {/* ป้ายความสำคัญ — ย้ายมาจากมุมมองอ่านเดิม (คิดจากมูลค่าที่บันทึกแล้ว ไม่ใช่ค่าที่กำลังพิมพ์) */}
            {(() => { const pr = leadPriority(lead), pc = priorityColor[pr];
              return <span style={{ padding:"3px 10px", borderRadius:99, fontSize:"0.65rem", fontWeight:700, background:pc.bg, color:pc.text }}>ความสำคัญ {priorityLabel[pr]}</span>; })()}
          </div>
        </div>
      </div>

      {/* รายละเอียด — แถวเดียวกับตอนอ่าน แต่ค่าแก้ได้ */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, borderTop:"1px solid #eef1f5", paddingTop:14 }}>
        <div style={{ gridColumn:"1/-1", ...cell }}>
          <Building2 size={14} color="#94a3b8" style={{ flexShrink:0 }} />
          <span style={cellLbl}>บริษัท</span>
          <span style={{ flex:1, minWidth:0 }}><input value={f.company} onChange={e=>set("company",e.target.value)} style={inp} /></span>
        </div>
        {/* ชื่อโครงการมีเฉพาะดีลที่สร้างจากลูกค้าเดิม — โชว์ให้แก้เมื่อมีจริงเท่านั้น (ลีดทั่วไปไม่มีฟิลด์นี้) */}
        {(lead.project ?? "") !== "" && (
          <div style={{ gridColumn:"1/-1", ...cell }}>
            <FileText size={14} color="#94a3b8" style={{ flexShrink:0 }} />
            <span style={cellLbl}>ชื่อโครงการ</span>
            <span style={{ flex:1, minWidth:0 }}><input value={f.project} onChange={e=>set("project",e.target.value)} style={inp} /></span>
          </div>
        )}
        <Cell icon={User}    label="ผู้ติดต่อ"><input value={f.contact} onChange={e=>set("contact",e.target.value)} style={inp} /></Cell>
        <Cell icon={Phone}   label="โทรศัพท์"><input value={f.phone} onChange={e=>set("phone",e.target.value)} placeholder="0XX-XXX-XXXX" style={inp} /></Cell>
        <Cell icon={Mail}    label="อีเมล"><input value={f.email} onChange={e=>set("email",e.target.value)} type="email" style={inp} /></Cell>
        <Cell icon={MapPin}  label="จังหวัด">
          <select value={f.province} onChange={e=>set("province",e.target.value)} style={inp}>{PROVINCES.map(x=><option key={x}>{x}</option>)}</select>
        </Cell>
        <Cell icon={Package} label="แม่แบบที่สนใจ">
          <select value={f.product} onChange={e=>set("product",e.target.value)} style={inp}>
            {catalog.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
          </select>
        </Cell>
        <Cell icon={Ruler}   label="พื้นที่ (ตร.ม.)">
          <input type="number" min={0} value={f.area} onChange={e=>set("area",e.target.value)} placeholder="—" style={inp} />
        </Cell>
        <Cell icon={Target}  label="แหล่งที่มา">
          <select value={f.source} onChange={e=>set("source",e.target.value)} style={inp}>{SOURCES.map(x=><option key={x}>{x}</option>)}</select>
        </Cell>
        <Cell icon={Users}   label="ผู้รับผิดชอบ">
          <select value={f.assigned} onChange={e=>set("assigned",e.target.value)} style={inp}>{persons.map(x=><option key={x}>{x}</option>)}</select>
        </Cell>
        {f.status === "CANCELLED" && (
          <Cell icon={XCircle} label="เหตุผลที่เสีย">
            <select value={f.lostReason} onChange={e=>set("lostReason",e.target.value)} style={inp}>
              <option value="">— เลือก —</option>
              {lostReasons.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </Cell>
        )}
        {/* สองแถวนี้ระบบคำนวณ/ประทับเอง — โชว์ไว้ให้ครบเหมือนมุมมองอ่านเดิม แต่แก้ไม่ได้ */}
        <Cell icon={MessageSquare} label="ติดต่อล่าสุด"><span style={{ display:"block", fontSize:"0.82rem", fontWeight:700, color:"#2D2D2D", textAlign:"right" }}>{lastActivity(lead)}</span></Cell>
        <Cell icon={CalendarClock} label="สร้างเมื่อ"><span style={{ display:"block", fontSize:"0.82rem", fontWeight:700, color:"#2D2D2D", textAlign:"right" }}>{lead.createdAt || "—"}</span></Cell>
      </div>

      {/* หมายเหตุ — ตำแหน่งเดียวกับตอนอ่าน */}
      <div style={{ background:"#f7f9fc", border:"1px solid #eef1f5", borderRadius:10, padding:"10px 12px", marginTop:12 }}>
        <div style={{ fontSize:"0.62rem", color:"#9ca3af", fontWeight:700, marginBottom:4 }}>หมายเหตุ</div>
        <textarea value={f.note} onChange={e=>set("note",e.target.value)} rows={2} placeholder="รายละเอียดเพิ่มเติม…"
          style={{ ...inp, height:"auto", resize:"vertical", lineHeight:1.6 }} />
      </div>

      {/* รูป/โลโก้ + ปุ่ม — บรรทัดเดียว กันการ์ดขยายตอนสลับโหมด */}
      <div style={{ display:"flex", alignItems:"center", gap:10, marginTop:12, paddingTop:10, borderTop:"1px solid #f4f6f9", flexWrap:"wrap" }}>
        <span style={{ width:28, height:28, borderRadius:8, flexShrink:0, overflow:"hidden", background:f.logo?"#fff":"#f8fafc",
          border:`1px ${f.logo?"solid":"dashed"} #e5e7eb`, display:"flex", alignItems:"center", justifyContent:"center" }}>
          {f.logo ? <img src={f.logo} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : <User size={13} color="#9ca3af" />}
        </span>
        <input ref={logoRef} type="file" accept="image/*" style={{ display:"none" }} onChange={uploadLogo} />
        <button type="button" onClick={()=>logoRef.current?.click()} className="btn btn-secondary btn-sm" style={{ color:"#374151" }}>
          <Paperclip size={12} /> {f.logo ? "เปลี่ยนรูป" : "อัปโหลดรูป"}
        </button>
        {f.logo && (
          <button type="button" onClick={()=>set("logo","")} className="btn btn-secondary btn-sm" style={{ color:"#dc2626" }}>
            <X size={12} /> ลบรูป
          </button>
        )}
        <span style={{ flex:1 }} />
        {dirty && <button onClick={()=>setF(seed())} className="btn btn-secondary btn-sm" style={{ color:"#374151" }}>ยกเลิก</button>}
        <button onClick={save} disabled={!dirty} className="btn btn-primary btn-sm"
          style={{ opacity: dirty ? 1 : 0.5, cursor: dirty ? "pointer" : "default" }}>
          <Check size={13} /> บันทึกการแก้ไข
        </button>
      </div>
    </div>
  );
}

// ─── ADD / EDIT LEAD FORM ─────────────────────────────────────────────────
// ฟอร์มเดียวใช้ได้ทั้งเพิ่ม (initial ว่าง) และแก้ไข (มี initial) — อัปเดต local state ผ่าน onSave
function LeadFormModal({ onClose, onSave, persons, initial }: {
  onClose:()=>void; onSave:(l:LeadRow)=>void; persons:string[]; initial?:LeadRow|null;
}) {
  const isEdit = !!initial;
  const catalog = useMasterCatalog(); // แม่แบบจากแคตตาล็อกกลาง
  const { customers } = useSales();   // สมุดลูกค้าของสาขา — ใช้เตือนว่าบริษัทนี้เป็นลูกค้าอยู่แล้ว
  const myDealer = useCurrentDealer();
  const [form, setForm] = useState({
    company: initial?.company ?? "", contact: initial?.contact ?? "",
    phone: initial?.phone ?? "", email: initial?.email ?? "",
    province: initial?.province ?? "กรุงเทพฯ", product: initial?.product ?? catalog[0]?.name ?? "",
    value: initial?.value ?? "",
    // เก็บเป็นสตริง ให้ปล่อยว่างได้ (= ยังไม่รู้พื้นที่) — ตอนบันทึกค่อยแปลงเป็นตัวเลข
    area: initial?.area != null ? String(initial.area) : "",
    status: (initial?.status ?? "WAITING") as LeadStatus,
    assigned: initial?.assigned ?? persons[0] ?? "",  // ไม่มีทะเบียนพนักงาน = ไม่ระบุ (ห้ามยัดชื่อสมมติลง DB)
    source: initial?.source ?? "เว็บไซต์", note: initial?.note ?? "",
    logo: initial?.logo ?? "",
  });
  const logoInputRef = useRef<HTMLInputElement>(null);
  // เตือนตั้งแต่ตอนพิมพ์ว่าบริษัทนี้เป็นลูกค้าอยู่แล้ว — กันเปิดลีดซ้ำแล้วได้ลูกค้าซ้ำตอนปิดการขาย (M3)
  // แค่บอก ไม่ได้ห้าม (บางทีก็อยากเปิดลีดใหม่จริง ๆ) · ทางที่ถูกคือกด "สร้างดีลใหม่" จากหน้าลูกค้า
  const dupHint = useMemo(() => {
    if (isEdit || !form.company.trim()) return "";
    const { exact, similar } = matchCustomers(customers, form.company, myDealer.code);
    if (exact)        return `"${exact.company}" เป็นลูกค้าอยู่แล้ว — ปิดการขายได้ ระบบจะผูกเข้ากับลูกค้ารายเดิมให้ ไม่สร้างซ้ำ`;
    if (similar[0])   return `ชื่อใกล้เคียงกับลูกค้าเดิม "${similar[0].company}" — ถ้าเป็นบริษัทเดียวกัน ควรกด "สร้างดีลใหม่" จากหน้าลูกค้าแทน`;
    return "";
  }, [isEdit, form.company, customers, myDealer.code]);
  function set(k: keyof typeof form, v: string) { setForm(p=>({...p,[k]:v})); }
  async function uploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    set("logo", await fileToResizedDataURL(file, 256)); // ย่อก่อนเก็บ กัน quota เต็ม
  }
  function submit() {
    if (!form.company.trim() || !form.contact.trim()) return;
    const base = {
      name: form.company,
      company: form.company, contact: form.contact,
      phone: form.phone, email: form.email,
      province: form.province, product: form.product,
      category: mainTemplateOf(form.product), value: form.value,
      status: form.status, assigned: form.assigned,
      source: form.source, note: form.note,
      logo: form.logo || undefined,
      // เว้นว่าง/ไม่ใช่ตัวเลข = ไม่มีข้อมูลพื้นที่ (undefined) — ห้ามบันทึกเป็น 0 เพราะ 0 แปลว่า "พื้นที่ศูนย์" ซึ่งไม่จริง
      area: form.area.trim() && Number(form.area) > 0 ? Number(form.area) : undefined,
    };
    if (initial) {
      onSave({ ...initial, ...base });
    } else {
      // id/numId ถูกกำหนดจริงในหน้า (handleAddLead) แบบ max+1 กันชนกัน
      onSave({ id: "", numId: 0, ...base });
    }
    onClose();
  }

  const inputStyle: React.CSSProperties = {
    width:"100%", border:"1px solid #e5e7eb", borderRadius:8,
    padding:"8px 11px", fontSize:"0.8rem", outline:"none", color:"#2D2D2D",
  };
  const labelStyle: React.CSSProperties = {
    display:"block", fontSize:"0.65rem", fontWeight:700,
    color:"#374151", marginBottom:4, textTransform:"uppercase", letterSpacing:"0.04em",
  };
  const dupHintStyle: React.CSSProperties = {
    marginTop:6, padding:"7px 10px", borderRadius:8, background:"#fff8ed",
    border:"1px solid #fcd9a4", color:"#8a5a10", fontSize:"0.7rem", lineHeight:1.5,
  };
  const secHead: React.CSSProperties = {
    gridColumn:"1/-1", fontSize:"0.7rem", fontWeight:800, color:"#003366",
    letterSpacing:"0.04em", paddingBottom:6, marginTop:6, borderBottom:"1px solid #eef1f5",
  };

  return (
    <>
      <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(45,45,45,.45)", zIndex:1100 }} />
      <div style={{ position:"fixed", inset:0, zIndex:1110, display:"flex", alignItems:"center", justifyContent:"center", padding:24, pointerEvents:"none" }}>
        <div onClick={e=>e.stopPropagation()}
          style={{ width:"100%", maxWidth:600, background:"#fff", borderRadius:20,
            border:"1px solid #e5e7eb", boxShadow:"0 24px 80px rgba(0,0,0,.2)",
            pointerEvents:"auto", overflow:"hidden" }}>

          {/* Header */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
            padding:"18px 24px", borderBottom:"1px solid #e5e7eb", background:"#003366" }}>
            <div>
              <div style={{ fontSize:"1rem", fontWeight:800, color:"#fff" }}>{isEdit ? "แก้ไขลูกค้าเป้าหมาย" : "เพิ่มลูกค้าเป้าหมาย"}</div>
              <div style={{ fontSize:"0.72rem", color:"#374151" }}>{isEdit ? `แก้ไขข้อมูล ${initial?.id}` : "กรอกข้อมูลลูกค้าเป้าหมาย"}</div>
            </div>
            <button onClick={onClose}
              style={{ width:32, height:32, borderRadius:9, border:"1px solid rgba(255,255,255,.2)",
                background:"rgba(255,255,255,.1)", color:"#fff", cursor:"pointer",
                display:"flex", alignItems:"center", justifyContent:"center" }}>
              <X size={15} />
            </button>
          </div>

          {/* Body */}
          <div style={{ padding:"24px", overflowY:"auto", maxHeight:"65vh" }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>

              {/* ── ข้อมูลบริษัท ── */}
              <div style={secHead}>ข้อมูลบริษัท</div>
              <div style={{ gridColumn:"1/-1", display:"flex", alignItems:"center", gap:14 }}>
                <div style={{ width:56, height:56, borderRadius:14, flexShrink:0, overflow:"hidden",
                  border:`2px dashed ${form.logo ? "transparent" : "#e5e7eb"}`, background:form.logo ? "#fff" : "#f8fafc",
                  display:"flex", alignItems:"center", justifyContent:"center" }}>
                  {form.logo
                    ? <img src={form.logo} alt="โลโก้" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                    : <User size={24} color="#9ca3af" />}
                </div>
                <div style={{ minWidth:0 }}>
                  <label style={labelStyle}>รูป / โลโก้ลูกค้า</label>
                  <input ref={logoInputRef} type="file" accept="image/*" style={{ display:"none" }} onChange={uploadLogo} />
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                    <button type="button" onClick={()=>logoInputRef.current?.click()} className="btn btn-secondary btn-sm" style={{ color:"#374151" }}>
                      <Paperclip size={13} /> {form.logo ? "เปลี่ยนรูป" : "อัปโหลดรูป"}
                    </button>
                    {form.logo && (
                      <button type="button" onClick={()=>set("logo","")} className="btn btn-secondary btn-sm" style={{ color:"#dc2626" }}>
                        <X size={13} /> ลบรูป
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <label style={labelStyle}>บริษัท *</label>
                <input value={form.company} onChange={e=>set("company",e.target.value)}
                  placeholder="เช่น บริษัท ตัวอย่าง จำกัด" style={inputStyle} autoFocus />
                {dupHint && <div style={dupHintStyle}>{dupHint}</div>}
              </div>
              <div>
                <label style={labelStyle}>จังหวัด</label>
                <select value={form.province} onChange={e=>set("province",e.target.value)} style={inputStyle}>
                  {PROVINCES.map(p=><option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>แม่แบบที่สนใจ</label>
                <TemplateSelect value={form.product} onChange={v=>set("product",v)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>พื้นที่ (ตร.ม.)</label>
                <input type="number" min={0} value={form.area} onChange={e=>set("area",e.target.value)}
                  placeholder="เช่น 1200" style={inputStyle} />
                <div style={{fontSize:"0.62rem",color:"#9ca3af",marginTop:4}}>ยังไม่รู้ก็เว้นว่างได้ · ใช้เป็นค่าตั้งต้นตอนออกใบเสนอราคา</div>
              </div>

              <div>
                <label style={labelStyle}>ผู้ติดต่อ *</label>
                <input value={form.contact} onChange={e=>set("contact",e.target.value)}
                  placeholder="ชื่อผู้ติดต่อ" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>โทรศัพท์</label>
                <input value={form.phone} onChange={e=>set("phone",e.target.value)}
                  placeholder="0XX-XXX-XXXX" style={inputStyle} />
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <label style={labelStyle}>อีเมล</label>
                <input value={form.email} onChange={e=>set("email",e.target.value)}
                  placeholder="email@company.com" type="email" style={inputStyle} />
              </div>

              <div>
                <label style={labelStyle}>มูลค่าประเมิน</label>
                <input value={form.value} onChange={e=>set("value",e.target.value)}
                  onBlur={()=>{ if(form.value.trim()) set("value", fmtVal(form.value)); }}
                  placeholder="เช่น 1200000 หรือ ฿1.2M" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>ขั้นตอน</label>
                {/* เลือกได้เฉพาะขั้นก่อน "เสนอราคา" — ขั้นเสนอราคาขึ้นไปเลื่อนอัตโนมัติเมื่อมีใบเสนอราคา
                    aria-label: ชื่อเดียวกับ label — กันสับสนกับ dropdown "ทุกสถานะ" บนแถบเครื่องมือที่มีครบทุกขั้น */}
                <select aria-label="ขั้นตอน" value={form.status} onChange={e=>set("status",e.target.value as LeadStatus)} style={inputStyle}>
                  {(isEdit ? ALL_STATUSES : (["WAITING","BULLET"] as LeadStatus[])).map(s=><option key={s} value={s}>{leadStatusLabel[s]}</option>)}
                </select>
                {!isEdit && <div style={{fontSize:"0.62rem",color:"#9ca3af",marginTop:4}}>ขั้น “เสนอราคา” ขึ้นไปจะเลื่อนอัตโนมัติเมื่อสร้างใบเสนอราคา</div>}
              </div>
              <div>
                <label style={labelStyle}>แหล่งที่มา</label>
                <select value={form.source} onChange={e=>set("source",e.target.value)} style={inputStyle}>
                  {SOURCES.map(s=><option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>ผู้รับผิดชอบ</label>
                <PersonPicker value={form.assigned} onChange={v=>set("assigned",v)} multiple />
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <label style={labelStyle}>หมายเหตุ</label>
                <textarea value={form.note} onChange={e=>set("note",e.target.value)}
                  rows={3} placeholder="รายละเอียดเพิ่มเติม..."
                  style={{ ...inputStyle, resize:"vertical", fontFamily:"inherit", lineHeight:1.6 }} />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ padding:"16px 24px", borderTop:"1px solid #e5e7eb", display:"flex", gap:8, justifyContent:"flex-end", background:"#fafafa" }}>
            <button onClick={onClose}
              style={{ padding:"9px 20px", borderRadius:9, border:"1px solid #e5e7eb",
                background:"#fff", color:"#374151", fontSize:"0.8rem", fontWeight:600, cursor:"pointer" }}>
              ยกเลิก
            </button>
            <button onClick={submit}
              style={{ padding:"9px 22px", borderRadius:9, border:"none",
                background:"#003366", color:"#fff", fontSize:"0.8rem", fontWeight:700,
                cursor:"pointer", boxShadow:"0 4px 12px rgba(0,0,0,.3)" }}>
              บันทึก
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── รายงานการติดตาม (Lead Report) — textarea แก้ไข/เพิ่ม/ลบ/ขึ้นบรรทัด/bullet ได้ทั้งหมด ──

// ─── MAIN PAGE ────────────────────────────────────────────────────────────
export default function LeadsPage() {
  const router = useRouter();
  const { session } = useRole(); // ผู้ดำเนินการ (บันทึกลง task ที่เช็ก)
  const currentDealer = useCurrentDealer(); // สาขาที่ล็อกอิน (multi-tenant) — scope ข้อมูล/กฎด้วย code นี้
  const { followUpAlertDays } = useLeadRules(currentDealer.code); // กฎของสาขานี้ — ตั้งเองที่ ตั้งค่า › การแจ้งเตือน
  const lostReasons = useLostReasons(); // เหตุผลปิดไม่สำเร็จที่ HQ กำหนด (ผ่าน repo)
  const fileInputRef = useRef<HTMLInputElement>(null);

  // List state
  const {
    leads: allLeads, addLead, updateLead, deleteLead: removeLead, updateLeadStatus,
    appointments, addAppointment, newAppointmentId, quotations,
  } = useSales();
  // ปิดการขายสำเร็จ = เป็น "ลูกค้า" แล้ว → ไม่แสดงในหน้าลูกค้าเป้าหมาย (ไปอยู่ที่ /customers)
  // สมุดงานของ "ตัวแทนที่ล็อกอิน" เท่านั้น — กรองด้วย dealerCode
  // จำเป็นตั้งแต่มีลีดของสาขาอื่นในระบบ (ก่อนหน้านี้มีสาขาเดียวเลยไม่กรองก็ไม่มีใครเห็นความต่าง)
  // ลีดที่ตัวแทนสร้างเองไม่มี dealerCode → ถือเป็นของสาขาตัวเอง
  // สมุดงานของสาขาตัวเอง "ทุกสถานะ" (รวมที่ปิดการขายสำเร็จแล้ว) — ใช้คิดอัตราปิดการขาย
  const myAllLeads = useMemo(
    () => allLeads.filter(l => (l.dealerCode ?? "CNX") === currentDealer.code),
    [allLeads, currentDealer.code],
  );
  const leadsData = useMemo(() => myAllLeads.filter(l => l.status !== "PAID"), [myAllLeads]);

  // sync งาน/สถานะที่ระบบติ๊กอัตโนมัติ (เช่น สร้าง/ส่งใบเสนอราคา) เข้าโมดัลที่เปิดอยู่
  // — อัปเดตเฉพาะ tasks/status ไม่ทับฟิลด์ที่ผู้ใช้กำลังแก้ใน draft
  useEffect(() => {
    if (!selectedLead) return;
    const fresh = allLeads.find(l => l.id === selectedLead.id);
    if (!fresh) return;
    if (fresh.tasks !== selectedLead.tasks || fresh.status !== selectedLead.status) {
      setSelectedLead(prev => prev ? { ...prev, tasks: fresh.tasks, status: fresh.status } : prev);
      setDraft(prev => prev ? { ...prev, tasks: fresh.tasks, status: fresh.status } : prev);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allLeads]);

  // บันทึกลีด + sync snapshot ในโมดัลทันที (กันปัญหา "เช็ก task แล้วไม่ติ๊ก" เพราะ c เป็นค่าเก่า)
  function saveLead(l: LeadRow) {
    const prevStatus = selectedLead?.status;
    updateLead(l); setSelectedLead(l); setDraft(l);
    // เช็กงานแล้วสถานะเลื่อนอัตโนมัติ → แจ้ง toast ให้เห็นชัด (ป้ายหัวโมดัล/ตาราง/บอร์ด/funnel เปลี่ยนตามทันที)
    if (prevStatus && l.status !== prevStatus) {
      setToast(l.status === "PAID"
        ? "ปิดการขายสำเร็จ — สร้างลูกค้าให้อัตโนมัติแล้ว"
        : l.status === "CANCELLED"
        ? "บันทึกปิดการขายไม่สำเร็จแล้ว"
        : `เลื่อนสถานะอัตโนมัติ → ${leadStatusLabel[l.status]}`);
    }
  }
  // Global filter: ผู้รับผิดชอบ + ช่วงเวลา (วันเดือนปีจากตัวกรองกลาง — กรองจากวันที่กิจกรรมล่าสุดของลีด)
  const { person, timeRange } = useFilters();
  // Table toolbar: density + column show/hide (localStorage-backed)
  const { density, setDensity, hiddenCols, toggleCol } = useTableLayout("leads");
  const [view, setView] = useState<"list"|"kanban">("list"); // ค่าเริ่มต้น = ตาราง (สลับไปบอร์ดได้ที่ปุ่มมุมขวา)
  const [dragId, setDragId] = useState<string|null>(null); // การ์ดที่กำลังลากในมุมมอง Kanban
  const [dragOver, setDragOver] = useState<LeadStatus|null>(null); // คอลัมน์ที่กำลังลากค้างอยู่ (ไฮไลต์)
  const [hideEmpty, setHideEmpty] = useState(false); // ซ่อนคอลัมน์ที่ไม่มีการ์ด
  const [query, setQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<LeadStatus|"ALL">("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("company");
  const [sortDir, setSortDir] = useState<"asc"|"desc">("asc");
  const [followUpDays, setFollowUpDays] = useState(0); // Smart filter: 0=off · 7/14/30 = ขาดติดต่อเกินกี่วัน
  // quick filter chips ถูกลบตามที่บอสสั่ง — state นี้ไม่มีใครตั้งค่าได้แล้ว จึงลบทิ้ง
  const [dTab, setDTab] = useState<"overview"|"tasks"|"quotation"|"timeline">("overview"); // แท็บใน drawer รายละเอียด
  const [showAddForm, setShowAddForm] = useState(false);

  // List pagination (LIST view only)
  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);

  // Advanced filters
  const [fAssignee, setFAssignee] = useState("");
  const [fValueMin, setFValueMin] = useState("");
  const [fValueMax, setFValueMax] = useState("");
  const [fProvince, setFProvince] = useState("");
  const [fSource, setFSource] = useState("");
  // ตัวกรอง "ความสำคัญ" (fPriority) ถูกลบตามที่บอสสั่ง — ไม่เหลือ UI ที่ตั้งค่าได้

  // Panel state
  const [selectedLead, setSelectedLead] = useState<LeadRow|null>(null);
  // (โหมดแก้ไข/อ่านถูกถอดแล้ว — OverviewEditor reseed เองเมื่อสลับลีดผ่าน useEffect ของมัน)
  const [activeTab, setActiveTab] = useState<"overview"|"tasks"|"report"|"activities"|"appts"|"quotation"|"files">("overview");
  const [editingField, setEditingField] = useState<string|null>(null);
  // Lead Detail (split layout) — refs สำหรับ quick action เลื่อนไปการ์ด + ปิดการขายไม่สำเร็จ (เลือกเหตุผล)
  const journeyRef = useRef<HTMLDivElement>(null);
  const rightQuoteRef = useRef<HTMLDivElement>(null);
  const rightApptRef = useRef<HTMLDivElement>(null);
  const [quickLost, setQuickLost] = useState(false);
  const [quickLostReason, setQuickLostReason] = useState("");
  // ฟอร์มนัดหมายในแท็บนัดหมายของลีด (นัดก่อนปิดการขาย)
  const [apptAdding, setApptAdding] = useState(false);
  const [apptForm, setApptForm] = useState<{ type: ApptType; date: string; time: string; title: string; note: string }>({ type: "visit", date: "2026-07-06", time: "10:00", title: "", note: "" });
  const [draft, setDraft] = useState<LeadRow|null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // โมดัลรายละเอียด: ล็อกสกรอลล์พื้นหลังเท่านั้น — การปิดด้วย Esc จัดการโดย effect ปิดทีละชั้นด้านล่าง
  useEffect(() => {
    if (!selectedLead) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [selectedLead]);

  // Files — คลังไฟล์รวม (แหล่งเดียว) กรองเฉพาะของลูกค้าเป้าหมายนี้
  const [dealerFiles, setDealerFiles] = useState<DealerFile[]>([]);
  const [previewFile, setPreviewFile] = useState<DealerFile | null>(null);
  useEffect(() => {
    // ไฟล์ของสาขานี้ผ่าน repository (local: localStorage · supabase: DB)
    const sync = () => { filesRepo.list({ dealerCode: currentDealer.code, isHQ: false }).then(setDealerFiles).catch(() => {}); };
    sync();
    window.addEventListener(DEALER_FILES_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(DEALER_FILES_EVENT, sync); window.removeEventListener("storage", sync); };
  }, [currentDealer.code]);

  // Persons registry — พนักงานขายของสาขานี้ ผ่าน repository (local: localStorage · supabase: DB)
  // ยังไม่มีพนักงานในทะเบียน = รายการว่าง (ไปเพิ่มที่ ตั้งค่า › ผู้รับผิดชอบ)
  // ห้ามใส่ค่าตั้งต้นปลอม และห้ามใช้ `if (names.length)` — ทะเบียนว่างต้องแปลว่าว่างจริง
  const [personsList, setPersonsList] = useState<string[]>([]);
  useEffect(() => {
    personsRepo.list({ dealerCode: currentDealer.code, isHQ: false })
      .then(arr => setPersonsList(arr.filter(p => p.active).map(p => p.name)))
      .catch(() => {});
  }, [currentDealer.code]);

  // Inline status dropdown (table view)
  const [openStatusId, setOpenStatusId] = useState<string|null>(null);
  // แก้ไข "มูลค่า" ในตารางโดยตรง (inline) — persist ผ่าน updateLead → ข้อมูลเดียวกับ Kanban
  const [editValueId, setEditValueId] = useState<string|null>(null);
  const [valueDraft, setValueDraft] = useState("");
  function commitValue(l: LeadRow) {
    const v = valueDraft.trim();
    if (v) updateLead({ ...l, value: fmtVal(v) });
    setEditValueId(null);
  }

  // success toast
  const [toast, setToast] = useState<string|null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);


  // ─── Derived ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let arr = leadsData.filter(l => {
      const q = query.toLowerCase();
      const matchQ = !query
        || l.company.toLowerCase().includes(q)
        || l.contact.toLowerCase().includes(q)
        || l.province.toLowerCase().includes(q)
        || l.id.toLowerCase().includes(q);
      const matchS = filterStatus === "ALL" || l.status === filterStatus;
      // Global Responsible Person filter (FilterBar): drop leads not owned by selected person
      const matchPerson = person === "all" || assignedHas(l.assigned, person);
      // ช่วงเวลา: เทียบวันที่กิจกรรมล่าสุด (ลีดที่ยังไม่มีกิจกรรมไม่ถูกตัดออก)
      const latest = leadLatestDate(l);
      const matchTime = !latest || (latest.getTime() >= timeRange.start.getTime() && latest.getTime() <= timeRange.end.getTime());
      const matchA = !fAssignee || assignedHas(l.assigned, fAssignee);
      const matchP = !fProvince || l.province === fProvince;
      const matchSrc = !fSource || (l.source ?? "") === fSource;
      const val = parseValue(l.value);
      const matchMin = !fValueMin || val >= parseFloat(fValueMin.replace(/[฿,M]/g,""))*1e6;
      const matchMax = !fValueMax || val <= parseFloat(fValueMax.replace(/[฿,M]/g,""))*1e6;
      const matchFollow = followUpDays === 0 || needsFollowUp(l, followUpDays);
      // ตัวกรอง quick (วันนี้/สัปดาห์นี้/ของฉัน/ค้างเกิน 7 วัน/ปิดไม่สำเร็จ) ถูกลบพร้อมชิปกรองด่วน
      return matchQ && matchS && matchPerson && matchTime && matchA && matchP && matchSrc && matchMin && matchMax && matchFollow;
    });

    arr = [...arr].sort((a,b) => {
      let av: string|number = 0, bv: string|number = 0;
      if (sortKey === "value") { av = parseValue(a.value); bv = parseValue(b.value); }
      else if (sortKey === "priority") { av = priorityRank[leadPriority(a)]; bv = priorityRank[leadPriority(b)]; }
      else { av = (a[sortKey] as string) ?? ""; bv = (b[sortKey] as string) ?? ""; }
      // เรียงข้อความไทยตามพยัญชนะ (locale "th") — เรียงด้วย < > ตรงๆ จะได้ลำดับ Unicode ที่ไม่ตรงตามตัวอักษรไทย
      if (typeof av === "string" && typeof bv === "string") {
        const cmp = av.localeCompare(bv, "th");
        return sortDir === "asc" ? cmp : -cmp;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [leadsData, query, filterStatus, person, timeRange, fAssignee, fProvince, fSource, fValueMin, fValueMax, sortKey, sortDir, followUpDays, session.name]);

  // จำนวนลีดที่ต้องรีบติดตาม (ขาดการติดต่อเกินเกณฑ์กฎธุรกิจ) — สำหรับแจ้งเตือน "ด่วน"
  const followUpCount = useMemo(() => leadsData.filter(l => needsFollowUp(l, followUpAlertDays)).length, [leadsData, followUpAlertDays]);

  // ─── List pagination (LIST view only) ──────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // Reset to page 1 whenever filters / search / sort change the result set
  useEffect(() => { setPage(1); }, [query, filterStatus, person, fAssignee, fProvince, fSource, fValueMin, fValueMax, sortKey, sortDir]);
  // Clamp page into range if the list shrinks
  useEffect(() => { setPage(p => Math.min(p, totalPages)); }, [totalPages]);
  const paged = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);
  const pageStart = filtered.length === 0 ? 0 : (page-1)*PAGE_SIZE + 1;
  const pageEnd = Math.min(page*PAGE_SIZE, filtered.length);

  // totalValue / wonLeads / nonLost / winRate ถูกลบ — คำนวณไว้แต่ไม่มีใครแสดง
  // และทั้งสามคิดจาก allLeads (ทั้งเครือ) ซึ่งผิดขอบเขตของหน้าตัวแทนอยู่แล้ว
  // อัตราปิดการขายที่แสดงจริงคือ convRate ด้านล่าง (คิดจาก myAllLeads)
  const hasActiveFilters = !!(fAssignee || fProvince || fSource || fValueMin || fValueMax);
  // ช่วงมูลค่าใน FilterRow ↔ fValueMin/fValueMax ที่ตัวกรองจริงใช้ (แหล่งความจริงเดียวยังเป็นสองค่านี้)
  const valueBand = VALUE_BANDS.find(b => b.min === fValueMin && b.max === fValueMax)?.v ?? "ALL";
  const pickValueBand = (v: string) => {
    const b = VALUE_BANDS.find(x => x.v === v);
    setFValueMin(b?.min ?? ""); setFValueMax(b?.max ?? "");
  };

  function onSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  // ─── Panel helpers ─────────────────────────────────────────────────────
  const current = draft ?? selectedLead;
  const lid = current?.id ?? "";

  function resetApptForm() { setApptAdding(false); setApptForm({ type: "visit", date: "2026-07-06", time: "10:00", title: "", note: "" }); }
  function openPanel(l: LeadRow) {
    if (selectedLead?.id === l.id) return closePanel();
    setSelectedLead(l); setDraft({...l});
    setEditingField(null); setShowDeleteConfirm(false);
    setActiveTab("overview"); setDTab("overview");
    setPopupField(null); setEditPopupPos(null);
    setShowStatusDropdown(false);
    resetApptForm(); // กันฟอร์มนัดหมายค้างข้ามลีด
  }
  function closePanel() {
    setSelectedLead(null); setDraft(null);
    setEditingField(null); setShowDeleteConfirm(false);
    setPopupField(null); setEditPopupPos(null);
    setShowStatusDropdown(false);
    resetApptForm();
  }

  // เปิดโมดัลจากพารามิเตอร์ ?open=N — ใช้ทั้งตอนโหลดหน้า (deep link/ลิงก์เดิม) และตอนค้นหาจาก Topbar หน้าเดิม
  const allLeadsRef = useRef(allLeads);
  allLeadsRef.current = allLeads;
  useEffect(() => {
    const openByParam = (qs: string) => {
      const p = new URLSearchParams(qs).get("open");
      if (!p) return;
      const target = allLeadsRef.current.find(l => String(l.numId) === p || l.id === p);
      if (target) {
        if (target.status === "PAID") {
          // เป็นลูกค้าแล้ว — ส่งต่อไปหน้าลูกค้าแทน (โปรไฟล์อยู่ที่นั่น)
          router.replace(target.customerId != null ? `/customers?open=${target.customerId}` : "/customers");
          return;
        }
        openPanel(target);
      }
      window.history.replaceState(null, "", "/leads"); // ล้าง param กันเปิดซ้ำเมื่อรีเฟรช
    };
    // 1) ตอนโหลดหน้า (mount) — จาก URL จริง
    openByParam(window.location.search);
    // 2) ตอนค้นหาจาก Topbar ขณะอยู่หน้าเดิม — Topbar ยิง event พร้อม href ปลายทาง
    const onOpen = (e: Event) => {
      const href = (e as CustomEvent<string>).detail ?? "";
      const [path, query = ""] = href.split("?");
      if (path === "/leads" && query) openByParam(`?${query}`);
    };
    window.addEventListener("bpms:open-record", onOpen);
    return () => window.removeEventListener("bpms:open-record", onOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function deleteLead() {
    removeLead(selectedLead!.id);
    closePanel();
  }
  function handleStatusChange(val: string) {
    if (!draft) return;
    const next = {...draft, status: val as LeadStatus};
    updateLead(next);
    setSelectedLead(next); setDraft(next);
  }

  // หมายเหตุ: ลูกค้าถูกสร้างอัตโนมัติเมื่อปิดการขายสำเร็จ (WON) ผ่าน context — ไม่มีปุ่มสร้างเองแล้ว
  // (ระบบ "ดีล" แยกถูกตัดออก — Kanban ลูกค้าเป้าหมายคือบอร์ดการขายเดียว)

  // ความคืบหน้า (Progress) จากลำดับขั้นตอน — PAID=100%, CANCELLED=0% (ใช้ใน drawer)
  function leadProgress(status: LeadStatus): number {
    if (status === "PAID") return 100;
    if (status === "CANCELLED") return 0;
    const stages: LeadStatus[] = ["WAITING","BULLET","QUOTED","FOLLOWUP","NEGO"];
    const idx = stages.indexOf(status);
    if (idx < 0) return 0;
    return Math.round(((idx + 1) / (stages.length + 1)) * 100);
  }

  // Files — ของลูกค้าเป้าหมายรายนี้ (ผูกด้วย numId) จากคลังไฟล์รวม
  const myFiles: DealerFile[] = current
    ? dealerFiles.filter(f => f.source === "lead" && f.recordId === current.numId)
    : [];
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f || !current) return;
    const size = f.size > 1024*1024 ? `${(f.size/1024/1024).toFixed(1)} MB` : `${(f.size/1024).toFixed(0)} KB`;
    // อัปโหลด bytes เข้า Storage ก่อน (local คืน null = เก็บแค่ metadata) แล้วบันทึก metadata
    void fileStorage.upload(currentDealer.code, f).catch(() => null)
      .then(storagePath => filesRepo.add({
        name: f.name, size, ext: extOfName(f.name), category: guessFileCategory(f.name),
        project: current.company || current.name, uploadedBy: current.assigned || "คุณ",
        uploadedAt: APP_NOW_ISO, source: "lead", recordId: current.numId, dealerCode: currentDealer.code,
        ...(storagePath ? { storagePath } : {}),
      }))
      .then(() => filesRepo.list({ dealerCode: currentDealer.code, isHQ: false }).then(setDealerFiles)).catch(() => {});
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // Status dropdown
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  // Field popup (right sidebar detail rows)
  const [popupField, setPopupField] = useState<string|null>(null);
  const [editPopupPos, setEditPopupPos] = useState<{top:number;left:number}|null>(null);
  const [editPopupLabel, setEditPopupLabel] = useState("");
  const [editPopupVal, setEditPopupVal] = useState("");
  const [editPopupType, setEditPopupType] = useState("text");
  const [editPopupOptions, setEditPopupOptions] = useState<string[]|null>(null);

  function openFieldPopup(field: string, label: string, type: string, e: React.MouseEvent, options?: string[]) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const popW = 300;
    let left = rect.left;
    if (left + popW > window.innerWidth - 16) left = window.innerWidth - popW - 16;
    const top = rect.bottom + 8 + 160 > window.innerHeight ? rect.top - 168 : rect.bottom + 8;
    const curVal = (draft as unknown as Record<string,string>|null)?.[field] ?? (current as unknown as Record<string,string>)?.[field] ?? "";
    setPopupField(field);
    setEditPopupLabel(label);
    setEditPopupVal(curVal);
    setEditPopupType(type);
    setEditPopupOptions(options ?? null);
    setEditPopupPos({ top, left });
  }
  function closeFieldPopup() { setPopupField(null); setEditPopupPos(null); setEditPopupVal(""); setEditPopupOptions(null); }
  function commitFieldPopup() {
    if (!draft || !popupField) return;
    const updated = { ...draft, [popupField]: editPopupVal };
    updateLead(updated);
    setSelectedLead(updated); setDraft(updated);
    closeFieldPopup();
  }

  // Escape closes the detail modal (or the topmost nested overlay first)
  useEffect(() => {
    if (!selectedLead) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (showDeleteConfirm) setShowDeleteConfirm(false);
      else if (popupField) closeFieldPopup();
      else closePanel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLead, showDeleteConfirm, popupField]);

  // ─── สรุปด้านบน: 5 ตัวชี้วัด + กราฟแนวโน้ม + แหล่งที่มา ────────────────
  // นับจาก leadsData (ชุดที่ผ่านตัวกรองหลักแล้ว) — คลิกการ์ดเพื่อกรองต่อ
  const newThisMonth = useMemo(
    () => leadsData.filter(l => { const d = leadCreatedDate(l); return d.getMonth() === MOCK_TODAY_LEAD.getMonth() && d.getFullYear() === MOCK_TODAY_LEAD.getFullYear(); }).length,
    [leadsData]);
  const overdue7 = useMemo(() => leadsData.filter(l => needsFollowUp(l, followUpAlertDays)).length, [leadsData, followUpAlertDays]);
  const meetingToday = useMemo(() => appointments.filter(a => a.date === "2026-06-30" && a.status !== "cancelled" && a.type !== "follow_up").length, [appointments]);
  const newWaiting = useMemo(() => leadsData.filter(l => l.status === "WAITING").length, [leadsData]);
  // Sales Opportunity = มูลค่ารวมของลีดที่ยังเปิดอยู่ (Expected Revenue)
  const openValue = useMemo(() => leadsData.filter(l => l.status !== "PAID" && l.status !== "CANCELLED").reduce((s, l) => s + parseValue(l.value), 0), [leadsData]);
  // Conversion Rate = ปิดได้ / (ปิดได้ + ปิดไม่ได้) — ใช้ myAllLeads เพราะ leadsData ตัด PAID ออกแล้ว
  // ต้องเป็นของสาขาตัวเองเท่านั้น: เดิมใช้ allLeads จึงคิดรวมลีดของอีก 9 สาขาเข้ามาด้วย
  const convRate = useMemo(() => {
    const won = myAllLeads.filter(l => l.status === "PAID").length;
    const lost = myAllLeads.filter(l => l.status === "CANCELLED").length;
    return won + lost ? Math.round((won / (won + lost)) * 1000) / 10 : 0;
  }, [myAllLeads]);
  const fmtCompact = (v:number) => v>=1e6 ? `฿${(v/1e6).toFixed(1)}M` : v>=1e3 ? `฿${Math.round(v/1e3)}K` : `฿${v}`;

  // การ์ด = ปุ่มกรอง · on = กำลังกรองด้วยเงื่อนไขนี้อยู่ (กดซ้ำ = ล้าง)
  // ช่วงวันในดรอปดาวน์ — เกณฑ์ของสาขาต้องเป็นตัวเลือกแรกเสมอ (การ์ด "เกิน N วัน" กดแล้วเซ็ตค่านี้)
  // เดิมฟิกซ์ [7,14,30] ไว้ พอสาขาตั้ง 3 วัน ค่าที่การ์ดเซ็ตจะไม่มีในลิสต์ → ดรอปดาวน์เด้งกลับ
  const followUpBands = useMemo(
    () => [...new Set([followUpAlertDays, 7, 14, 30])].sort((a, b) => a - b),
    [followUpAlertDays],
  );
  const noFilter = filterStatus === "ALL" && followUpDays === 0;
  const leadKpis = [
    { label:"ลูกค้าเป้าหมายทั้งหมด", value:`${leadsData.length}`,   sub:"รายการ",       Icon:Users,      color:"#2563EB", bg:"#E8F0FE", on: noFilter,                 onClick:()=>{ setFilterStatus("ALL"); setFollowUpDays(0); } },
    { label:"โอกาสการขาย",          value:fmtCompact(openValue),    sub:"มูลค่าที่เปิดอยู่", Icon:TrendingUp, color:"#16A34A", bg:"#E6F7EE", on: false,                   onClick:()=>{ setFilterStatus("ALL"); setFollowUpDays(0); } },
    { label:`เกิน ${followUpAlertDays} วัน`, value:`${overdue7}`,     sub:"รายการ",       Icon:AlarmClock, color:"#EA580C", bg:"#FEF0E6", on: followUpDays === followUpAlertDays, onClick:()=>{ setFilterStatus("ALL"); setFollowUpDays(followUpDays === followUpAlertDays ? 0 : followUpAlertDays); } },
    { label:"อัตราปิดการขาย",       value:`${convRate}%`,           sub:"ปิดได้/ปิดทั้งหมด", Icon:Percent,   color:"#0D9488", bg:"#E6F7F5", on: false,                   onClick:()=>{ setFilterStatus("ALL"); setFollowUpDays(0); } },
  ];

  // แนวโน้ม 12 เดือน — ลูกค้าเป้าหมายใหม่ เทียบ ปิดการขาย · ปีปัจจุบันเท่านั้น
  // ข้อมูลมีทั้งปี 2568 และ 2569 — เดิมนับแต่เดือนโดยไม่ดูปี ของปีที่แล้วเลยมาโผล่ในกราฟปีนี้
  const leadTrend = useMemo(() => {
    const newLeads = Array(12).fill(0), won = Array(12).fill(0);
    leadsData.forEach(l => {
      const d = leadCreatedDate(l);
      if (d.getFullYear() !== CUR_YEAR) return;
      newLeads[d.getMonth()]++;
      if (l.status === "PAID") won[d.getMonth()]++;
    });
    return { newLeads, won };
  }, [leadsData]);

  // Lead vs Quotations — จำนวนลีด (น้ำเงิน) เทียบ ใบเสนอราคา (ส้ม) รายเดือน · ปีปัจจุบันเท่านั้น
  const leadVsQuote = useMemo(() => {
    const leadC = Array(12).fill(0), quoteC = Array(12).fill(0);
    leadsData.forEach(l => { const d = leadCreatedDate(l); if (d.getFullYear() === CUR_YEAR) leadC[d.getMonth()]++; });
    quotations.filter(q => q.date.slice(0, 4) === String(CUR_YEAR))
      .forEach(q => { const mo = parseInt(q.date.slice(5, 7), 10) - 1; if (mo >= 0 && mo < 12) quoteC[mo]++; });
    return { leadC, quoteC };
  }, [leadsData, quotations]);

  // stageStats (Sales Journey) ถูกลบพร้อมการ์ดเส้นทาง/action center — เหลือแต่การคำนวณที่ไม่มีใครอ่าน
  // และนับจาก allLeads ทั้งเครือ ซึ่งผิดขอบเขตของหน้าตัวแทน

  // ─── RENDER ────────────────────────────────────────────────────────────
  return (
    <>
      {/* ═══ PAGE ═══════════════════════════════════════════════════ */}
      <div className="erp">
        {/* หัวหน้า/ปุ่ม → ไปอยู่บนแถบบน (ชื่อหน้ามาจาก Topbar) · เหลือคำบรรยายไว้ในเนื้อหา */}
        <TopbarActions>
          {/* ตัวเลือกของมุมมองบอร์ด — โผล่เฉพาะตอนดูบอร์ด */}
          {view === "kanban" && (
            <button onClick={()=>setHideEmpty(v=>!v)}
              style={{ display:"flex", alignItems:"center", gap:6, padding:"0 12px", height:33, boxSizing:"border-box", borderRadius:9, cursor:"pointer",
                border:`1px solid ${hideEmpty?"#003366":"#e5e7eb"}`, background: hideEmpty?"#dce5f0":"#fff",
                color: hideEmpty?"#003366":"#6b7280", fontFamily:"inherit", fontSize:"0.72rem", fontWeight:600 }}>
              {hideEmpty ? <Check size={13} /> : <Columns3 size={13} />} ซ่อนคอลัมน์ว่าง
            </button>
          )}
          <FilterBar dims={[]} />
          <ExportMenu filename="leads" title="รายชื่อลูกค้าเป้าหมาย"
            headers={["รหัส","ชื่อ","ผู้ติดต่อ","จังหวัด","ช่องทางที่มา","แม่แบบ","พื้นที่ (ตร.ม.)","สถานะ","ความคืบหน้า","มูลค่า","ผู้รับผิดชอบ","กิจกรรมล่าสุด"]}
            rows={filtered.map(l=>[l.id,l.name,l.contact,l.province,l.source??"—",l.product,l.area ?? "—",leadStatusLabel[l.status],`${leadProg(l)}%`,fmtVal(l.value),l.assigned,lastActivity(l)])} />
          <button onClick={() => setShowAddForm(true)} className="btn btn-primary btn-sm">
            <Plus size={15} /> เพิ่มลูกค้าเป้าหมาย
          </button>
        </TopbarActions>
        {/* จำนวน/อัตราปิดการขาย อยู่บนการ์ด KPI แล้ว — บรรทัดนี้บอกแค่ช่วงเวลาที่กำลังดู */}
        <p className="page-sub">จัดการและติดตามลูกค้าเป้าหมาย · {timeRange.subtitle}</p>

        {/* ── สรุป 4 ตัวชี้วัด — ทั้งการ์ดคือปุ่มกรอง (กดซ้ำ = ล้าง) · ไม่มีลิงก์ซ้ำในการ์ด ── */}
        <div className="dash-kpis" style={{ marginBottom: 16 }}>
          {/* สถานะ "ถูกเลือก" คุมด้วย .kpi-toggle + aria-pressed ใน globals.css — ห้ามใส่ border/boxShadow เป็น inline */}
          {leadKpis.map(k => (
            <button key={k.label} onClick={k.onClick} aria-pressed={k.on} title={k.on ? "กดอีกครั้งเพื่อล้างตัวกรอง" : `กรอง: ${k.label}`}
              className="card clickable kpi-toggle" style={{ padding:"16px 14px", display:"flex", flexDirection:"column", gap:6, textAlign:"left",
                cursor:"pointer", fontFamily:"inherit", width:"100%" }}>
              <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:10, width:"100%" }}>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:"0.72rem", color:"#6B7280" }}>{k.label}</div>
                  <div style={{ fontSize:"1.42rem", fontWeight:800, color:"#1F2937", marginTop:6, fontVariantNumeric:"tabular-nums" }}>{k.value}</div>
                  <div style={{ fontSize:"0.72rem", color:"#6B7280", marginTop:2 }}>{k.sub}</div>
                </div>
                <span style={{ width:42, height:42, borderRadius:12, background:k.bg, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <k.Icon size={20} color={k.color} strokeWidth={2.1} />
                </span>
              </div>
            </button>
          ))}
        </div>


        {/* ชิปกรองด่วน (ทั้งหมด/วันนี้/สัปดาห์นี้/ของฉัน/ค้างเกิน 7 วัน/ปิดไม่สำเร็จ) เอาออกตามที่บอสสั่ง */}

        {/* ── แถบตัวกรองแถวเดียว (มาตรฐานเดียวกับหน้า /hq/pipeline) ──
            เดิมเป็นปุ่ม "ตัวกรอง" + แผงเลื่อนจากขวา — ตอนนี้เห็นตัวกรองทุกตัวพร้อมกัน
            "ทุกสถานะ" ใช้ state เดียวกับการ์ด KPI ด้านบน → กดที่ไหนก็ตรงกัน
            ปิดการขายสำเร็จ (PAID) ไม่อยู่ในตัวเลือก — ลีดที่ปิดแล้วย้ายไปหน้าลูกค้า (leadsData ตัดออก) */}
        <FilterRow
          query={query} onQuery={setQuery} placeholder="ค้นหาบริษัท ผู้ติดต่อ..."
          showClear={hasActiveFilters || filterStatus!=="ALL" || followUpDays!==0 || !!query}
          onClear={()=>{ setQuery(""); setFilterStatus("ALL"); setFollowUpDays(0); setFAssignee(""); setFProvince(""); setFSource(""); setFValueMin(""); setFValueMax(""); }}
          right={
            /* สลับมุมมอง ตาราง/บอร์ด — กลับมาอยู่ท้ายแถบตัวกรองเหมือนเดิม (ช่อง right ของ FilterRow เตรียมไว้ให้พอดี)
               ขนาดเล็กกว่าช่องกรอง (สูง 30 · ไอคอน 12) เพราะเป็นตัวควบคุมรอง ไม่ใช่ตัวกรอง */
            <div style={{ display:"flex", border:"1px solid #e5e7eb", borderRadius:8, overflow:"hidden", height:30, boxSizing:"border-box", flexShrink:0 }}>
              {([["list", LayoutList, "ตาราง"], ["kanban", Columns3, "บอร์ด"]] as const).map(([v, Ico, tip]) => (
                <button key={v} title={tip} onClick={()=>setView(v)}
                  style={{ display:"flex", alignItems:"center", gap:4, padding:"0 8px", height:"100%", border:"none", cursor:"pointer",
                    background: view===v ? "#003366" : "#fff", color: view===v ? "#fff" : "#6b7280", fontFamily:"inherit", fontSize:"0.68rem", fontWeight:600 }}>
                  <Ico size={12} /> {tip}
                </button>
              ))}
            </div>
          }
        >
          {/* ไม่ตั้ง minWidth เกินจำเป็น — select กว้างตามคำ caption อยู่แล้ว
              ตั้งเกินไว้ = กินที่ฟรีจนแถบตกบรรทัดที่จอ 1440 */}
          <FilterSelect caption="ทุกสถานะ" value={filterStatus} onChange={v=>setFilterStatus(v as LeadStatus|"ALL")}
            options={ALL_STATUSES.filter(s=>s!=="PAID").map(s=>({v:s,l:leadStatusLabel[s]}))} />
          <FilterSelect caption="ทุกผู้รับผิดชอบ" value={fAssignee} onChange={setFAssignee} all=""
            options={personsList.map(p=>({v:p,l:p}))} />
          <FilterSelect caption="ทุกจังหวัด" value={fProvince} onChange={setFProvince} all=""
            options={PROVINCES.map(p=>({v:p,l:p}))} />
          <FilterSelect caption="ทุกช่องทางที่มา" value={fSource} onChange={setFSource} all=""
            options={SOURCES.map(s=>({v:s,l:s}))} />
          <FilterSelect caption="ทุกช่วงมูลค่า" value={valueBand} onChange={pickValueBand}
            options={VALUE_BANDS.map(b=>({v:b.v,l:b.l}))} />
          {/* ค้างติดต่อเกิน N วัน — เกณฑ์วันอย่างเดียว (จำนวนอยู่บนการ์ด "เกิน 7 วัน" ด้านบนแล้ว ไม่ซ้ำ) */}
          {followUpCount > 0 && (
            <FilterSelect caption="ค้างติดต่อทุกช่วง" value={String(followUpDays)} onChange={v=>setFollowUpDays(Number(v))} all="0"
              options={followUpBands.map(d=>({v:String(d),l:`ค้างติดต่อ >${d} วัน`}))} />
          )}
        </FilterRow>

        {/* ── LIST VIEW ── */}
        {view === "list" && (
          <div className="card">
            <div className={`table-wrap${density === "compact" ? " dense" : ""}`}>
              <table>
                <colgroup>
                  <col style={{width:"18%"}} />
                  {!hiddenCols.includes("province") && <col style={{width:"9%"}} />}
                  {!hiddenCols.includes("source")   && <col style={{width:"10%"}} />}
                  {!hiddenCols.includes("product")  && <col style={{width:"13%"}} />}
                  {!hiddenCols.includes("area")     && <col style={{width:"8%"}} />}
                  <col style={{width:"13%"}} />
                  <col style={{width:"13%"}} />
                  <col style={{width:"11%"}} />
                  <col style={{width:"12%"}} />
                  {!hiddenCols.includes("activity") && <col style={{width:"9%"}} />}
                  <col style={{width:"12%"}} />
                </colgroup>
                <thead>
                  <tr>
                    {([
                      ["company","บริษัท / ผู้ติดต่อ",null],
                      [null,"จังหวัด","province"],
                      [null,"ช่องทางที่มา","source"],
                      [null,"แม่แบบ","product"],
                      [null,"พื้นที่ (ตร.ม.)","area"],
                      ["status","ขั้นตอน",null],
                      [null,"ความคืบหน้า",null],
                      ["value","มูลค่า",null],
                      ["assigned","ผู้รับผิดชอบ",null],
                      [null,"กิจกรรมล่าสุด","activity"],
                      [null,"",null], // คอลัมน์ปุ่มลบ — ไม่ต้องมีหัวคอลัมน์ (มาตรฐานเดียวกับตารางใบเสนอราคา)
                    ] as [SortKey|null,string,string|null][])
                      .filter(([,,colKey]) => !colKey || !hiddenCols.includes(colKey))
                      .map(([key,label])=>{
                      const isNum = key === "value" || label === "พื้นที่ (ตร.ม.)"; // คอลัมน์ตัวเลข — จัดหัวคอลัมน์ชิดขวาให้ตรงกับค่าในเซลล์ (.num)
                      return (
                      <th key={label || "actions"}
                        className={isNum ? "num" : undefined}
                        style={key ? { cursor:"pointer", userSelect:"none" } : undefined}
                        onClick={key ? ()=>onSort(key) : undefined}>
                        <span style={{ display:"flex", alignItems:"center", gap:4, justifyContent: isNum ? "flex-end" : "flex-start" }}>
                          {label} {key && <SortIcon field={key} sortKey={sortKey} sortDir={sortDir} />}
                        </span>
                      </th>
                    );})}
                  </tr>
                </thead>
                <tbody>
                  {paged.map(l => {
                    const sc = leadStatusColor[l.status];
                    const done = !!l.customerId;
                    const isSel = selectedLead?.id === l.id;
                    return (
                      <tr key={l.id} onClick={()=>openPanel(l)} className="clickable"
                        style={{ background:isSel?"#f0f4f8":undefined }}>
                        <td style={{ minWidth:0 }}>
                          <div style={{ fontSize:"0.86rem", fontWeight:700, color:"#2D2D2D", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={l.company}>{l.company}</div>
                          <div style={{ fontSize:"0.65rem", color:"#374151", marginTop:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={l.contact}>{l.contact}</div>
                        </td>
                        {!hiddenCols.includes("province") && (
                          <td style={{ fontSize:"0.72rem", color:"#374151" }}>{l.province || "—"}</td>
                        )}
                        {!hiddenCols.includes("source") && (
                          <td style={{ fontSize:"0.72rem", color:"#374151", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={l.source}>{l.source || "—"}</td>
                        )}
                        {!hiddenCols.includes("product") && (
                          <td style={{ fontSize:"0.72rem", color:"#374151", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={l.product}>{l.product || "—"}</td>
                        )}
                        {!hiddenCols.includes("area") && (
                          <td className="num" style={{ fontSize:"0.72rem", color:"#374151", whiteSpace:"nowrap", fontVariantNumeric:"tabular-nums" }}>
                            {l.area != null ? l.area.toLocaleString() : "—"}
                          </td>
                        )}
                        <td className="ovf-visible" style={{ position:"relative" }}
                          onClick={e => { e.stopPropagation(); setOpenStatusId(openStatusId === l.id ? null : l.id); }}>
                          <button className="badge" style={{ background:sc.bg, color:sc.text, border:"none", cursor:"pointer" }}>
                            {leadStatusLabel[l.status]} ▾
                          </button>
                          {openStatusId === l.id && (
                            <>
                              <div onClick={e => { e.stopPropagation(); setOpenStatusId(null); }}
                                style={{ position:"fixed", inset:0, zIndex:19 }}/>
                              <div style={{ position:"absolute", top:"calc(100% - 4px)", left:10, zIndex:20,
                                background:"#fff", border:"1px solid #e5e7eb", borderRadius:12,
                                boxShadow:"0 8px 24px rgba(0,0,0,.14)", minWidth:168, overflow:"hidden" }}>
                                {ALL_STATUSES.map(s => {
                                  const c = leadStatusColor[s];
                                  return (
                                    <button key={s}
                                      onClick={e => { e.stopPropagation(); updateLeadStatus(l.id, s); setOpenStatusId(null); }}
                                      style={{ display:"flex", alignItems:"center", gap:8, width:"100%", padding:"9px 14px",
                                        border:"none", background:s===l.status?"#f0f4f8":"transparent",
                                        cursor:"pointer", textAlign:"left" }}>
                                      <span style={{ width:8, height:8, borderRadius:"50%", background:c.text, flexShrink:0 }}/>
                                      <span style={{ fontSize:"0.8rem", color:s===l.status?"#003366":"#2D2D2D", fontWeight:s===l.status?700:400 }}>
                                        {leadStatusLabel[s]}
                                      </span>
                                      {s===l.status && <span style={{ marginLeft:"auto", fontSize:"0.65rem", color:"#003366" }}>✓</span>}
                                    </button>
                                  );
                                })}
                              </div>
                            </>
                          )}
                        </td>
                        <td>
                          {(() => {
                            const p = leadProg(l);
                            const col = l.status==="CANCELLED" ? "#dc2626" : p>=100 ? "#059669" : "#003366";
                            return (
                              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                                <div style={{ flex:1, height:6, background:"#eef2f7", borderRadius:99, overflow:"hidden", minWidth:44 }}>
                                  <div className="bar-grow" style={{ height:"100%", width:`${p}%`, background:col, borderRadius:99 }} />
                                </div>
                                <span style={{ fontSize:"0.72rem", fontWeight:800, color:col, fontVariantNumeric:"tabular-nums", minWidth:30, textAlign:"right" }}>{p}%</span>
                              </div>
                            );
                          })()}
                        </td>
                        {(
                          <td className="num" style={{ fontSize:"0.8rem", fontWeight:700, color:"#2D2D2D" }}
                            onClick={e => { e.stopPropagation(); setEditValueId(l.id); setValueDraft(String(parseValue(l.value) || "")); }}>
                            {editValueId === l.id ? (
                              <input autoFocus type="number" value={valueDraft}
                                onChange={e => setValueDraft(e.target.value)}
                                onClick={e => e.stopPropagation()}
                                onBlur={() => commitValue(l)}
                                onKeyDown={e => { if (e.key === "Enter") commitValue(l); if (e.key === "Escape") setEditValueId(null); }}
                                style={{ width:"100%", textAlign:"right", border:"1px solid #003366", borderRadius:7, padding:"4px 7px", fontSize:"0.8rem", fontWeight:700, outline:"none", fontFamily:"inherit" }} />
                            ) : (
                              <span title="คลิกเพื่อแก้ไขมูลค่า" style={{ cursor:"text" }}>{fmtVal(l.value)}</span>
                            )}
                          </td>
                        )}
                        <td>
                          <AssigneeAvatars value={l.assigned} size={26} />
                        </td>
                        {!hiddenCols.includes("activity") && (
                          <td style={{ fontSize:"0.72rem", color:"#6b7280" }}>{lastActivity(l)}</td>
                        )}
                        {/* ── จัดการ: ปุ่มลัด (โทร / แก้ไข / ดูรายละเอียด) · WON = ป้ายลูกค้าแล้ว ── */}
                        <td onClick={e => e.stopPropagation()}>
                          <div style={{ display:"flex", alignItems:"center", gap:5, justifyContent:"flex-end" }}>
                            {done && l.status==="PAID" && (
                              <span title="ปิดการขายแล้ว" style={{ display:"inline-flex", alignItems:"center", gap:3, fontSize:"0.62rem", fontWeight:700, color:"#059669", marginRight:2 }}>
                                <CheckCircle2 size={11} /> ลูกค้าแล้ว
                              </span>
                            )}
                            <button title="ดูรายละเอียด" onClick={()=>openPanel(l)}
                              style={{ width:28, height:28, borderRadius:7, border:"1px solid #dbe3ec", background:"#fff", color:"#003366", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                              <Eye size={13} />
                            </button>
                            <button title="ลบลูกค้าเป้าหมาย" onClick={()=>{ if (window.confirm(`ลบ "${l.company}" ใช่หรือไม่?`)) { removeLead(l.id); setToast("ลบลูกค้าเป้าหมายแล้ว"); } }}
                              style={{ width:28, height:28, borderRadius:7, border:"1px solid #fecaca", background:"#fff", color:"#dc2626", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={10 - COLS.filter(c => hiddenCols.includes(c.key)).length} style={{ padding:0 }}>
                      <EmptyState icon={<Users size={28} />} title="ไม่พบลูกค้าเป้าหมาย"
                        description="ลองปรับตัวกรอง หรือเพิ่มลูกค้าเป้าหมายรายใหม่เพื่อเริ่มการขาย"
                        action={<button className="btn btn-primary btn-md" onClick={()=>setShowAddForm(true)}><Plus size={14} /> เพิ่มลูกค้าเป้าหมาย</button>} />
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ padding:"11px 16px", borderTop:"1px solid #e5e7eb", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
              {/* Left: range summary */}
              <span style={{ fontSize:"0.72rem", color:"#374151" }}>
                แสดง {pageStart}–{pageEnd} จาก {filtered.length} รายการ
              </span>
              {/* Right: pagination controls */}
              <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <button
                    onClick={()=>setPage(p=>Math.max(1, p-1))}
                    disabled={page<=1}
                    style={{ display:"flex", alignItems:"center", gap:3, padding:"5px 11px", borderRadius:8,
                      border:"1px solid #e5e7eb", fontSize:"0.72rem", fontWeight:600,
                      background: page<=1 ? "#fafafa" : "#fff",
                      color: page<=1 ? "#C0C0C0" : "#003366",
                      cursor: page<=1 ? "not-allowed" : "pointer" }}>
                    <ChevronDown size={12} style={{ transform:"rotate(90deg)" }} /> ก่อนหน้า
                  </button>
                  <span style={{ fontSize:"0.72rem", fontWeight:700, color:"#374151", padding:"0 4px", whiteSpace:"nowrap" }}>
                    หน้า {page} / {totalPages}
                  </span>
                  <button
                    onClick={()=>setPage(p=>Math.min(totalPages, p+1))}
                    disabled={page>=totalPages}
                    style={{ display:"flex", alignItems:"center", gap:3, padding:"5px 11px", borderRadius:8,
                      border:"1px solid #e5e7eb", fontSize:"0.72rem", fontWeight:600,
                      background: page>=totalPages ? "#fafafa" : "#fff",
                      color: page>=totalPages ? "#C0C0C0" : "#003366",
                      cursor: page>=totalPages ? "not-allowed" : "pointer" }}>
                    ถัดไป <ChevronDown size={12} style={{ transform:"rotate(-90deg)" }} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── KANBAN VIEW — คอลัมน์ตามสถานะ · ลากการ์ดเพื่อเปลี่ยนสถานะ (รวม "เส้นทางการขาย") ── */}
        {view === "kanban" && (() => {
          const ACTIVE: LeadStatus[] = ["WAITING","BULLET","QUOTED","FOLLOWUP","NEGO"];
          // PAID ไม่มีคอลัมน์แล้ว — ปิดการขายสำเร็จจะย้ายไปหน้า "ลูกค้า" อัตโนมัติ
          const TERMINAL: LeadStatus[] = ["CANCELLED"];
          const renderColumn = (status: LeadStatus, wide: boolean) => {
            const col = filtered.filter(l => l.status === status);
            if (hideEmpty && col.length === 0) return null;
            const sc = leadStatusColor[status];
            const isOver = dragOver === status;
            const total = col.reduce((s, l) => s + parseValue(l.value), 0);
            const w = wide ? 300 : 264;
            return (
              <div key={status}
                onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (dragOver !== status) setDragOver(status); }}
                onDragLeave={() => setDragOver(o => o === status ? null : o)}
                onDrop={() => { if (dragId) { updateLeadStatus(dragId, status); setDragId(null); } setDragOver(null); }}
                style={{ minWidth:w, width:w, flexShrink:0, alignSelf:"flex-start",
                  background: isOver ? "#eaf1fb" : "#f6f7f9", borderRadius:12, padding:10,
                  border: isOver ? "1.5px dashed #003366" : "1.5px solid transparent", transition:"background .12s, border-color .12s" }}>
                {/* header */}
                <div style={{ padding:"7px 6px 11px", borderTop:`3px solid ${sc.text}`, marginBottom:2 }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:6 }}>
                    <span style={{ display:"inline-flex", alignItems:"center", gap:6, minWidth:0 }}>
                      <span style={{ width:9, height:9, borderRadius:"50%", background:sc.text, flexShrink:0 }} />
                      <span style={{ fontSize:"0.8rem", fontWeight:800, color:"#2D2D2D", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{leadStatusLabel[status]}</span>
                    </span>
                    <span className="badge" style={{ background:sc.bg, color:sc.text, flexShrink:0 }}>{col.length}</span>
                  </div>
                  {total > 0 && <div style={{ fontSize:"0.65rem", color:"#9ca3af", fontWeight:600, marginTop:3, fontVariantNumeric:"tabular-nums" }}>{fmtM(total)}</div>}
                </div>
                {/* cards */}
                <div style={{ display:"flex", flexDirection:"column", gap:10, minHeight:44 }}>
                  {col.map(l => (
                    <div key={l.id} draggable
                      onDragStart={e => {
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", l.id);
                        // drag image เอง — ทึบ มีขอบกรม+เงา+เอียงเล็กน้อย ไม่ให้กลืนพื้นหลัง
                        const node = e.currentTarget as HTMLElement;
                        const ghost = node.cloneNode(true) as HTMLElement;
                        Object.assign(ghost.style, {
                          width: `${node.offsetWidth}px`, position:"absolute", top:"-9999px", left:"-9999px",
                          opacity:"1", background:"#fff", border:"2px solid #003366", borderRadius:"10px",
                          boxShadow:"0 14px 32px rgba(0,51,102,.32)", transform:"rotate(-2deg)", pointerEvents:"none",
                        } as CSSStyleDeclaration);
                        document.body.appendChild(ghost);
                        e.dataTransfer.setDragImage(ghost, 24, 22);
                        setTimeout(() => ghost.remove(), 0);
                        setDragId(l.id);
                      }}
                      onDragEnd={() => { setDragId(null); setDragOver(null); }}
                      onClick={() => openPanel(l)}
                      className="card"
                      style={{ padding:"12px 14px", cursor: dragId===l.id ? "grabbing" : "pointer", userSelect:"none", borderRadius:10,
                        opacity: dragId===l.id ? 0.5 : 1,
                        outline: dragId===l.id ? "2px dashed #94a9c9" : "none", outlineOffset: dragId===l.id ? "-1px" : 0,
                        boxShadow: dragId===l.id ? "none" : "0 1px 4px rgba(0,0,0,.05)", transition:"box-shadow .12s, transform .12s" }}
                      onMouseEnter={e => { if (dragId!==l.id) (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 14px rgba(0,51,102,.12)"; }}
                      onMouseLeave={e => { if (dragId!==l.id) (e.currentTarget as HTMLElement).style.boxShadow = "0 1px 4px rgba(0,0,0,.05)"; }}>
                      {/* Sales-only — ไม่มีรูปอาคาร/building type (โฟกัสโอกาสการขายอย่างเดียว) */}
                      <div style={{ fontSize:"0.86rem", fontWeight:700, color:"#2D2D2D", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={l.company}>{l.company}</div>
                      <div style={{ display:"flex", alignItems:"center", gap:4, fontSize:"0.72rem", color:"#6b7280", marginBottom:6 }}>
                        <User size={10} /> {l.contact}
                      </div>
                      {l.product && (
                        <div style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:"0.66rem", fontWeight:600, color:"#003366",
                          background:"#eef3f8", border:"1px solid #dce5f0", borderRadius:6, padding:"2px 8px", marginBottom:8, maxWidth:"100%", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={l.product}>
                          สนใจ: {l.product}
                        </div>
                      )}

                      {/* ข้อมูลติดต่อ + เตือนขาดการติดต่อ */}
                      <div style={{ display:"flex", flexDirection:"column", gap:3, fontSize:"0.68rem", color:"#475569",
                        borderTop:"1px solid #f1f5f9", borderBottom:"1px solid #f1f5f9", padding:"7px 0", marginBottom:9 }}>
                        {l.phone && <span style={{ display:"inline-flex", alignItems:"center", gap:5 }}><Phone size={10} color="#94a3b8" /> {l.phone}</span>}
                        {l.province && <span style={{ display:"inline-flex", alignItems:"center", gap:5 }}><MapPin size={10} color="#94a3b8" /> {l.province}</span>}
                        {(() => {
                          const d = daysSinceContact(l);
                          if (d === null) return null;
                          const late = d > followUpAlertDays;
                          return (
                            <span style={{ display:"inline-flex", alignItems:"center", gap:5, color: late ? "#DC3545" : "#94a3b8", fontWeight: late ? 700 : 600 }}>
                              <AlarmClock size={10} /> ติดต่อล่าสุด {d} วันที่แล้ว
                            </span>
                          );
                        })()}
                      </div>

                      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
                        <span>
                          <span style={{ display:"block", fontSize:"0.6rem", color:"#9ca3af", fontWeight:700 }}>มูลค่าโครงการ</span>
                          <span style={{ fontSize:"0.86rem", fontWeight:800, color:"#003366", fontVariantNumeric:"tabular-nums" }}>{fmtVal(l.value)}</span>
                        </span>
                        <AssigneeAvatars value={l.assigned} size={24} showName={false} />
                      </div>

                      {/* Progress + จำนวนงาน + กิจกรรมล่าสุด */}
                      <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:5 }}>
                        <div style={{ flex:1, height:5, background:"#eef2f7", borderRadius:99, overflow:"hidden" }}>
                          <div className="bar-grow" style={{ height:"100%", width:`${leadProg(l)}%`, background:"#003366", borderRadius:99 }} />
                        </div>
                        <span style={{ fontSize:"0.65rem", fontWeight:700, color:"#6b7280", fontVariantNumeric:"tabular-nums" }}>{leadProg(l)}%</span>
                      </div>
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", fontSize:"0.65rem", color:"#9ca3af", fontWeight:600 }}>
                        <span style={{ display:"inline-flex", alignItems:"center", gap:3 }}>
                          <CheckSquare size={10} /> {leadTaskCount(l).done}/{leadTaskCount(l).total} งาน
                        </span>
                        {lastActivity(l) !== "—" && (
                          <span style={{ display:"inline-flex", alignItems:"center", gap:3 }}>
                            <CalendarClock size={10} /> {lastActivity(l)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {col.length === 0 && (
                    <div style={{ textAlign:"center", padding:"16px 6px", fontSize:"0.65rem", color: isOver ? "#003366" : "#c7ccd3", border:`1.5px dashed ${isOver ? "#003366" : "#e5e7eb"}`, borderRadius:10 }}>วางการ์ดที่นี่</div>
                  )}
                </div>
              </div>
            );
          };
          return (
            <div style={{ display:"flex", gap:16, overflowX:"auto", paddingBottom:10, alignItems:"flex-start" }}>
              {ACTIVE.map(s => renderColumn(s, true))}
              {/* เส้นคั่นก่อนกลุ่มปิดการขาย (ปิดการขายสำเร็จ/ปิดการขายไม่สำเร็จ) — หัวคอลัมน์ตรงแนวเดียวกัน */}
              <div style={{ width:1, alignSelf:"stretch", background:"#e5e7eb", flexShrink:0, margin:"2px 0" }} />
              {TERMINAL.map(s => renderColumn(s, false))}
            </div>
          );
        })()}

      </div>

      {/* hidden file input */}
      <input ref={fileInputRef} type="file" style={{ display:"none" }} onChange={handleFileSelect} />

      {/* Field edit popup */}
      {popupField && editPopupPos && (
        <>
          <div onClick={closeFieldPopup}
            style={{ position:"fixed", inset:0, zIndex:200 }} />
          <div style={{ position:"fixed", top:editPopupPos.top, left:editPopupPos.left,
            zIndex:201, background:"#fff", borderRadius:14, border:"1px solid #e5e7eb",
            boxShadow:"0 8px 32px rgba(0,0,0,.18)", padding:"18px 20px", width:300 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
              <span style={{ fontSize:"0.86rem", fontWeight:700, color:"#2D2D2D" }}>{editPopupLabel}</span>
              <button onClick={closeFieldPopup}
                style={{ width:28, height:28, borderRadius:8, border:"1px solid #e5e7eb",
                  background:"#f8f9fb", cursor:"pointer", display:"flex", alignItems:"center",
                  justifyContent:"center", color:"#374151", padding:0 }}>
                <X size={13}/>
              </button>
            </div>
            {editPopupOptions ? (
              <select autoFocus
                value={editPopupVal}
                onChange={e=>setEditPopupVal(e.target.value)}
                style={{ width:"100%", border:"1px solid #e5e7eb", borderRadius:9,
                  padding:"9px 12px", fontSize:"0.8rem", outline:"none", color:"#2D2D2D",
                  marginBottom:12, background:"#fff", cursor:"pointer",
                  boxSizing:"border-box" as const }}>
                {editPopupOptions.map(o=><option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input autoFocus
                type={editPopupType}
                value={editPopupVal}
                onChange={e=>setEditPopupVal(e.target.value)}
                onKeyDown={e=>{ if(e.key==="Enter") commitFieldPopup(); if(e.key==="Escape") closeFieldPopup(); }}
                style={{ width:"100%", border:"1px solid #e5e7eb", borderRadius:9,
                  padding:"9px 12px", fontSize:"0.8rem", outline:"none", color:"#2D2D2D",
                  marginBottom:12, boxSizing:"border-box" as const }} />
            )}
            <div style={{ display:"flex", justifyContent:"flex-end" }}>
              <button onClick={commitFieldPopup} className="btn btn-primary btn-md">
                อัปเดต
              </button>
            </div>
          </div>
        </>
      )}

      {/* Add lead modal */}
      {showAddForm && (
        <LeadFormModal
          onClose={()=>setShowAddForm(false)}
          onSave={(l)=>{
            // กำหนด id/numId แบบ max+1 กันชนกับลีดเดิม (แทน Math.random)
            // ต้องคิดจาก allLeads (ดิบ ทุกสถานะ/ทุกสาขา) — ไม่ใช่ leadsData ที่ตัด PAID ออก
            // ไม่งั้นถ้าลีด numId สูงสุดถูกปิดเป็น PAID แล้ว nid จะซ้ำกับลีดเดิม (ไฟล์/ลิงก์ ?open= สับสน)
            const nid = Math.max(0, ...allLeads.map(x=>x.numId)) + 1;
            // สร้าง "รายงานการติดตาม" + "Report Checklist (Task)" อัตโนมัติทุกครั้งที่สร้าง Lead
            // createdAt ต้องมีตั้งแต่ตอนสร้าง — ไม่มีแล้วหน้าไหนก็โชว์ "สร้างเมื่อ —"
            // และ leadCreatedDate() จะไปสังเคราะห์วันจาก numId แทน (ได้วันย้อนหลังหลายเดือน)
            // ติด dealerCode ของสาขาที่ล็อกอิน → ลีดใหม่เป็นของสาขานั้น (multi-tenant) ไม่ตกเป็นของ CNX
            const withIds = { ...l, dealerCode: currentDealer.code, numId: nid, id: `#L-${40321 + nid}`, createdAt: l.createdAt || thaiDateStr(APP_NOW) };
            addLead({
              ...withIds,
              report: l.report || buildLeadReport(withIds, thaiDateStr(APP_NOW)),
              // ดีลเลอร์สร้างลีดหลังติดต่อลูกค้าแล้ว → ติ๊กงานให้ถึงสถานะที่เลือก (เริ่มต้น "ติดต่อแล้ว" = ติ๊กติดต่อครั้งแรก/เก็บข้อมูล)
              tasks: l.tasks?.length ? l.tasks : seedLeadTasks(l.status, l.assigned || "—", 30),
            });
          }}
          persons={personsList}
        />
      )}

      {/* Delete confirm dialog */}
      {showDeleteConfirm && selectedLead && (
        <>
          <div onClick={()=>setShowDeleteConfirm(false)}
            style={{ position:"fixed", inset:0, background:"rgba(45,45,45,.45)", zIndex:1120 }} />
          <div style={{ position:"fixed", top:"50%", left:"50%", transform:"translate(-50%,-50%)", zIndex:1121,
            background:"#fff", borderRadius:16, border:"1px solid #e5e7eb",
            boxShadow:"0 24px 80px rgba(0,0,0,.2)", width:"100%", maxWidth:380, padding:24 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
              <span style={{ width:38, height:38, borderRadius:"50%", background:"#fee2e2",
                display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <Trash2 size={17} color="#dc2626" />
              </span>
              <div style={{ fontSize:"1rem", fontWeight:800, color:"#2D2D2D" }}>ลบลูกค้าเป้าหมาย</div>
            </div>
            <p style={{ fontSize:"0.8rem", color:"#6b7280", lineHeight:1.6, margin:"0 0 20px" }}>
              ต้องการลบ <strong style={{ color:"#2D2D2D" }}>{selectedLead.company}</strong> ({selectedLead.id}) หรือไม่?
              การลบไม่สามารถย้อนกลับได้
            </p>
            <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
              <button onClick={()=>setShowDeleteConfirm(false)}
                style={{ padding:"9px 20px", borderRadius:9, border:"1px solid #e5e7eb",
                  background:"#fff", color:"#374151", fontSize:"0.8rem", fontWeight:600, cursor:"pointer" }}>
                ยกเลิก
              </button>
              <button onClick={deleteLead}
                style={{ padding:"9px 22px", borderRadius:9, border:"none",
                  background:"#dc2626", color:"#fff", fontSize:"0.8rem", fontWeight:700, cursor:"pointer",
                  display:"flex", alignItems:"center", gap:6 }}>
                <Trash2 size={13} /> ลบ
              </button>
            </div>
          </div>
        </>
      )}

      {/* ═══ DETAIL MODAL (2-column, navy header — same as customers) ═══ */}
      {selectedLead && current && (() => {
        const c = current;
        const sc = leadStatusColor[c.status];
        const pri = leadPriority(c);
        const pc = priorityColor[pri];
        const cInitials = (c.company || c.name).replace(/บจ\.|หจก\./g, "").trim().slice(0, 2) || "—";
        const activities = (c.activities && c.activities.length) ? c.activities : seedActivities(c);
        const drawerFiles = myFiles;
        // เป็นลูกค้าเมื่อปิดการขายสำเร็จ (WON) เท่านั้น — mock บางลีดมี customerId ผูกไว้แต่ยังไม่ WON จึงไม่นับ
        const isCustomer = c.status === "PAID";

        const detailTabs = [
          { key: "overview",   label: "ภาพรวม" },
          { key: "tasks",      label: "งาน/ความคืบหน้า" },
          { key: "report",     label: "รายงานติดตาม" },
          { key: "activities", label: "กิจกรรม" },
          { key: "appts",      label: "นัดหมาย" },
          { key: "quotation",  label: "ใบเสนอราคา" },
          { key: "files",      label: "ไฟล์" },
        ] as const;

        // ── Tab: นัดหมาย — นัดกับลูกค้าเป้าหมายก่อนปิดการขาย (แสดงในปฏิทิน+แจ้งเตือนด้วย) ──
        const leadAppts = appointments.filter(a => a.leadId === c.numId)
          .slice().sort((a, b) => (a.date + a.time) < (b.date + b.time) ? 1 : -1);
        const saveAppt = async () => {
          addAppointment({
            id: await newAppointmentId(), // เลขจาก DB แบบ atomic — เดิมใช้ max+1 ของชุดที่โหลดมา
            leadId: c.numId,
            company: c.company, contact: c.contact ?? "", phone: c.phone ?? "", province: c.province ?? "",
            project: apptForm.title.trim() || apptTypeLabel[apptForm.type],
            buildingType: c.product ?? "", area: 0,
            date: apptForm.date, time: apptForm.time, type: apptForm.type,
            assigned: c.assigned || session.name, status: "upcoming", note: apptForm.note.trim(),
          });
          setApptForm({ type: "visit", date: "2026-07-06", time: "10:00", title: "", note: "" });
          setApptAdding(false);
          setToast("บันทึกนัดหมายแล้ว");
        };
        const aInp: React.CSSProperties = { width:"100%", border:"1px solid #e5e7eb", borderRadius:9, padding:"8px 11px", fontSize:"0.8rem", color:"#2D2D2D", outline:"none", boxSizing:"border-box", fontFamily:"inherit", background:"#fff" };
        const aLbl: React.CSSProperties = { display:"block", fontSize:"0.65rem", fontWeight:700, color:"#6b7280", marginBottom:5 };
        const tabAppts = (
          <DrawerSection title="นัดหมาย">
            {!apptAdding ? (
              <button onClick={() => setApptAdding(true)} className="btn btn-primary btn-sm" style={{ marginBottom:12 }}>
                <Plus size={13} /> เพิ่มนัดหมาย
              </button>
            ) : (
              <div style={{ border:"1px solid #e5e7eb", borderRadius:12, padding:14, marginBottom:12, background:"#fafbfc" }}>
                <div style={{ fontSize:"0.8rem", fontWeight:800, color:"#2D2D2D", marginBottom:12 }}>นัดหมายใหม่ · {c.company}</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                  <div style={{ gridColumn:"1/-1" }}>
                    <label style={aLbl}>ประเภทนัดหมาย</label>
                    <select value={apptForm.type} onChange={e => setApptForm(f => ({ ...f, type: e.target.value as ApptType }))} style={aInp}>
                      {(Object.keys(apptTypeLabel) as ApptType[]).map(t => <option key={t} value={t}>{apptTypeLabel[t]}</option>)}
                    </select>
                  </div>
                  <div><label style={aLbl}>วันที่</label>
                    <input type="date" value={apptForm.date} onChange={e => setApptForm(f => ({ ...f, date: e.target.value }))} style={aInp} /></div>
                  <div><label style={aLbl}>เวลา</label>
                    <input type="time" value={apptForm.time} onChange={e => setApptForm(f => ({ ...f, time: e.target.value }))} style={aInp} /></div>
                  <div style={{ gridColumn:"1/-1" }}><label style={aLbl}>หัวข้อ</label>
                    <input value={apptForm.title} onChange={e => setApptForm(f => ({ ...f, title: e.target.value }))} placeholder={apptTypeLabel[apptForm.type]} style={aInp} /></div>
                  <div style={{ gridColumn:"1/-1" }}><label style={aLbl}>รายละเอียด</label>
                    <input value={apptForm.note} onChange={e => setApptForm(f => ({ ...f, note: e.target.value }))} placeholder="บันทึกเพิ่มเติม" style={aInp} /></div>
                </div>
                <div style={{ display:"flex", justifyContent:"flex-end", gap:8, marginTop:12 }}>
                  <button onClick={() => setApptAdding(false)} className="btn btn-secondary btn-sm">ยกเลิก</button>
                  <button onClick={saveAppt} className="btn btn-primary btn-sm"><Check size={13} /> บันทึกนัดหมาย</button>
                </div>
                <div style={{ fontSize:"0.65rem", color:"#9ca3af", marginTop:8 }}>ผู้รับผิดชอบ: {c.assigned || session.name} · นัดหมายจะแสดงในปฏิทินด้วย</div>
              </div>
            )}
            {leadAppts.length === 0 ? (
              <div style={{ color:"#9aa2ad", fontSize:"0.8rem", padding:"18px 0", textAlign:"center" }}>ยังไม่มีนัดหมาย</div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {leadAppts.map(a => (
                  <div key={a.id} style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"10px 12px", borderRadius:10, background:"#f8f9fb", border:"1px solid #eef0f4" }}>
                    <span style={{ width:32, height:32, borderRadius:"50%", background:"#e7eef7", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}><Calendar size={15} color="#003366" /></span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:"0.8rem", fontWeight:700, color:"#2D2D2D" }}>{a.project}</div>
                      <div style={{ fontSize:"0.65rem", color:"#6b7280", marginTop:2 }}>{apptTypeLabel[a.type]} · {fmtISOToThai(a.date)} · {a.time} น.</div>
                    </div>
                    <span className="badge" style={{ flexShrink:0, background:"#dce5f0", color:"#003366" }}>
                      {a.status === "upcoming" ? "กำลังจะมาถึง" : a.status === "done" ? "เสร็จแล้ว" : "ยกเลิก"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </DrawerSection>
        );

        // ── Tab: งาน/ความคืบหน้า (Task-driven) — เช็กแล้วเลื่อน Stage อัตโนมัติ ──
        const tabTasks = (
          // ผู้ทำงาน = ผู้รับผิดชอบของลีดนั้น (ไม่ใช่บัญชีดีลเลอร์ที่ล็อกอิน)
          <LeadTasks lead={c} performedBy={c.assigned || session.name} onSave={saveLead} />
        );

        // ── Tab: รายงานการติดตาม (Lead Report) — แก้ไข/เพิ่ม/ลบได้ทั้งหมด ──
        const tabReport = (
          <ReportEditor lead={c} onSave={saveLead} />
        );

        // แท็บภาพรวมแบบอ่านอย่างเดียว (tabOverview) ถูกลบ — การ์ด "ข้อมูลลูกค้า (Overview)"
        // เรนเดอร์ OverviewEditor ตรง ๆ แล้ว (แก้ไขในที่เดิมได้ตลอด ไม่มีปุ่มสลับโหมด — บอสสั่ง 17 ก.ค. 69)

        // ── Tab: กิจกรรม (Activities) — ไทม์ไลน์ ไอคอนตามประเภท + empty state ──
        const ACT_ICON: Record<string, { Icon: typeof Phone; color: string; bg: string }> = {
          call:    { Icon: Phone,        color: "#003366", bg: "#e7eef7" },
          email:   { Icon: Mail,         color: "#0369a1", bg: "#e0f2fe" },
          meeting: { Icon: Users,        color: "#4338ca", bg: "#e0e7ff" },
          doc:     { Icon: FileText,     color: "#b45309", bg: "#fef3e2" },
          note:    { Icon: StickyNote,   color: "#6b7280", bg: "#f0f0f5" },
          task:    { Icon: CheckCircle2, color: "#059669", bg: "#e6f6ef" },
        };
        const tabActivities = (
          <DrawerSection title="กิจกรรม">
            {activities.length === 0 ? (
              <div style={{ color:"#9aa2ad", fontSize:"0.8rem", padding:"22px 0", textAlign:"center" }}>
                <MessageSquare size={26} color="#C0C0C0" style={{ marginBottom:8 }} />
                <div>ยังไม่มีกิจกรรม</div>
                <div style={{ fontSize:"0.72rem", marginTop:3 }}>กิจกรรมจะถูกบันทึกอัตโนมัติเมื่อทำงานในแท็บ “งาน/ความคืบหน้า”</div>
              </div>
            ) : (
              <div style={{ position:"relative", display:"flex", flexDirection:"column", gap:2 }}>
                {activities.map((a,i) => {
                  const meta = ACT_ICON[(a as { type?: string }).type ?? "task"] ?? ACT_ICON.task;
                  const last = i === activities.length - 1;
                  return (
                    <div key={i} style={{ display:"flex", gap:11, position:"relative" }}>
                      {/* เส้นไทม์ไลน์ + จุดไอคอน */}
                      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", flexShrink:0 }}>
                        <div style={{ width:28, height:28, borderRadius:"50%", background:meta.bg,
                          display:"flex", alignItems:"center", justifyContent:"center" }}>
                          <meta.Icon size={14} color={meta.color} />
                        </div>
                        {!last && <div style={{ width:2, flex:1, minHeight:14, background:"#eef1f5" }} />}
                      </div>
                      <div style={{ minWidth:0, paddingBottom:last ? 0 : 12 }}>
                        <div style={{ fontSize:"0.8rem", color:"#2D2D2D", fontWeight:600, lineHeight:1.4 }}>{a.text}</div>
                        <div style={{ display:"flex", alignItems:"center", gap:4, fontSize:"0.65rem", color:"#6b7280", marginTop:3 }}>
                          <CalendarClock size={11} /> {a.date}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </DrawerSection>
        );

        // ── Tab: ใบเสนอราคา (Quotation) ──
        // ── Tab: ใบเสนอราคา — สร้าง/แก้/ดู/พิมพ์/ทำสำเนา/ลบ inline (ไม่ออกจากหน้า) ──
        const tabQuotation = (
          <DrawerSection title="ใบเสนอราคา">
            <LeadQuotationsPanel lead={c} onToast={setToast} />
          </DrawerSection>
        );

        // ── Tab: ไฟล์ (Files) ──
        const tabFiles = (
          <DrawerSection title="ไฟล์">
            {drawerFiles.length === 0 ? (
              <div style={{ color:"#9aa2ad", fontSize:"0.8rem", padding:"18px 0", textAlign:"center" }}>
                ยังไม่มีไฟล์แนบ
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                {drawerFiles.map(file => (
                  <button key={file.id} type="button" onClick={()=>setPreviewFile(file)} title="กดเพื่อดูไฟล์"
                    className="file-row" style={{ display:"flex", alignItems:"center", gap:8, textAlign:"left",
                    padding:"8px 10px", borderRadius:8, background:"#fafafa", border:"1px solid #f0f4f8", cursor:"pointer", width:"100%" }}>
                    <Paperclip size={13} color="#C0C0C0" />
                    <span style={{ flex:1, fontSize:"0.8rem", color:"#2D2D2D", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{file.name}</span>
                    <Eye size={13} color="#003366" />
                  </button>
                ))}
              </div>
            )}
            <button onClick={()=>fileInputRef.current?.click()}
              style={{ fontSize:"0.72rem", color:"#003366", background:"none", border:"none", cursor:"pointer", padding:0, marginTop:10 }}>
              + เพิ่มไฟล์แนบ
            </button>
          </DrawerSection>
        );

        // ── สรุป/เมตริก + การกระทำด่วน (Lead Detail split layout) ──
        const cardStyle: React.CSSProperties = { background:"#fff", border:"1px solid #eef1f5", borderRadius:14, padding:16 };
        const secLabel: React.CSSProperties = { display:"flex", alignItems:"center", gap:6, fontSize:"0.62rem", fontWeight:800, color:"#8a929c", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:12 };
        const qa: React.CSSProperties = { background:"rgba(255,255,255,.15)", border:"none", borderRadius:8, height:30, padding:"0 11px", cursor:"pointer", color:"#fff", display:"flex", alignItems:"center", gap:6, fontSize:"0.72rem", fontWeight:600, fontFamily:"inherit", whiteSpace:"nowrap" };
        const progressPct = leadProg(c);
        const scrollTo = (r: React.RefObject<HTMLDivElement|null>) => r.current?.scrollIntoView({ behavior:"smooth", block:"nearest" });
        const markWon = () => { const t = (c.tasks?.length ? c.tasks : buildLeadTasks()).map(x => ({ ...x, done:true })); saveLead({ ...c, tasks:t, status:"PAID" }); setToast("ปิดการขายสำเร็จ — ระบบสร้างลูกค้าให้อัตโนมัติ"); };
        const markLost = (reason:string) => { saveLead({ ...c, status:"CANCELLED", lostReason:reason }); setQuickLost(false); setQuickLostReason(""); setToast("บันทึกปิดการขายไม่สำเร็จแล้ว"); };

        return (
          <>
            {/* Backdrop */}
            <div onClick={closePanel} className="drawer-overlay"
              style={{ position:"fixed", inset:0, background:"rgba(45,45,45,.45)", zIndex:200 }} />

            {/* Lead Detail — แผงกลางจอ · คอลัมน์เดียว (Overview / Tasks / Quotation / Timeline) */}
            <div className="modal-pop" style={{ position:"fixed", top:"50%", left:"50%", transform:"translate(-50%,-50%)",
              width:820, maxWidth:"calc(100vw - 24px)", height:"min(920px, calc(100vh - 24px))",
              zIndex:210, background:"#fff", boxShadow:"0 30px 90px rgba(0,0,0,.32)", borderRadius:18,
              display:"flex", flexDirection:"column", overflow:"hidden" }}>

              {/* Sticky navy header + quick actions */}
              <div style={{ background:"#003366", padding:"14px 20px", flexShrink:0 }}>
                <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:14, flexWrap:"wrap" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:12, minWidth:0 }}>
                    <div style={{ width:46, height:46, borderRadius:13, background:"rgba(255,255,255,.18)",
                      display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", overflow:"hidden",
                      fontWeight:800, fontSize:"1rem", border:"2px solid rgba(255,255,255,.25)", flexShrink:0 }}>
                      {c.logo ? <img src={c.logo} alt="โลโก้" style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : cInitials}
                    </div>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontSize:"1.12rem", fontWeight:800, color:"#fff", lineHeight:1.2 }}>{c.company || c.name}</div>
                      {/* หัวแผงบอกแค่ว่า "นี่คือใคร ที่ไหน" — โทรศัพท์/อีเมล/วันที่สร้าง ตัดออกแล้ว
                          เพราะซ้ำกับการ์ด "ข้อมูลลูกค้า (OVERVIEW)" ในแท็บภาพรวมที่มีครบกว่า (มีแหล่งที่มา/ผู้รับผิดชอบ/ติดต่อล่าสุดด้วย)
                          รหัสลีดก็ตัดออก — หัวแผงใช้ชื่อบริษัทระบุตัวอยู่แล้ว (และของเดิมเรนเดอร์เพี้ยนเป็น "##L-40336"
                          เพราะ c.id มี "#" ติดมาอยู่แล้วแต่โค้ดเติม "#" ซ้ำอีกตัว) */}
                      <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap", fontSize:"0.72rem", color:"rgba(255,255,255,.72)", marginTop:4 }}>
                        <span>{c.contact}</span>
                        <span style={{ display:"flex", alignItems:"center", gap:3 }}><MapPin size={11} /> {c.province}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:7, flexShrink:0, flexWrap:"wrap" }}>
                    {/* หัว = การกระทำด่วนเท่านั้น · Won/Lost/ใบเสนอราคา อยู่แถบล่าง (ไม่ซ้ำ)
                        ปุ่ม "โทร" (tel: ลิงก์) ถูกเอาออก (บอสสั่ง 17 ก.ค. 69) — เบอร์โทรยังอยู่ในการ์ดข้อมูลลูกค้า แท็บภาพรวม */}
                    <button title="สร้างนัดหมาย" onClick={()=>{ setDTab("timeline"); setApptAdding(true); }} style={qa}><CalendarClock size={13} /> นัดหมาย</button>
                    {isCustomer && (
                      <button title="ดูโปรไฟล์ลูกค้า" onClick={()=>{ closePanel(); router.push(c.customerId ? `/customers?open=${c.customerId}` : "/customers"); }} style={qa}><CheckCircle2 size={13} /> ลูกค้า</button>
                    )}
                    <button title="ลบ" onClick={()=>setShowDeleteConfirm(true)} style={{ ...qa, width:30, padding:0, justifyContent:"center", color:"#fecaca" }}><Trash2 size={14} /></button>
                    <button onClick={closePanel} title="ปิด" style={{ ...qa, width:30, padding:0, justifyContent:"center" }}><X size={15} /></button>
                  </div>
                </div>
                {/* Badges: stage · priority · template · est value */}
                <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap", marginTop:12 }}>
                  <span style={{ padding:"2px 10px", borderRadius:99, fontSize:"0.65rem", fontWeight:700, background:sc.bg, color:sc.text }}>{leadStatusLabel[c.status]}</span>
                  <span style={{ padding:"2px 10px", borderRadius:99, fontSize:"0.65rem", fontWeight:700, background:pc.bg, color:pc.text }}>{priorityLabel[pri]}</span>
                  <span style={{ display:"flex", alignItems:"center", gap:4, padding:"2px 10px", borderRadius:99, fontSize:"0.65rem", fontWeight:700, background:"rgba(255,255,255,.18)", color:"#fff" }}><Package size={11} /> {c.product}</span>
                  <span style={{ display:"flex", alignItems:"center", gap:4, padding:"2px 10px", borderRadius:99, fontSize:"0.65rem", fontWeight:800, background:"#fff", color:"#003366" }}><Coins size={11} /> {c.value}</span>
                </div>
              </div>

              {/* Tab bar — Overview / Tasks / Quotation / Timeline */}
              <div style={{ display:"flex", gap:0, borderBottom:"1px solid #e5e7eb", background:"#fff", flexShrink:0, padding:"0 8px" }}>
                {([["overview","ภาพรวม"],["tasks","งาน"],["quotation","ใบเสนอราคา"],["timeline","ไทม์ไลน์"]] as ["overview"|"tasks"|"quotation"|"timeline",string][]).map(([k,label])=>(
                  <button key={k} onClick={()=>setDTab(k)}
                    style={{ padding:"11px 14px", border:"none", borderBottom:`2px solid ${dTab===k?"#003366":"transparent"}`, background:"transparent",
                      cursor:"pointer", fontFamily:"inherit", fontSize:"0.8rem", fontWeight:dTab===k?800:600, color:dTab===k?"#003366":"#6b7280", marginBottom:-1 }}>
                    {label}
                  </button>
                ))}
              </div>

              {/* Body — เนื้อหาตามแท็บ */}
              <div style={{ flex:1, overflowY:"auto", background:"#f5f7fa" }}>
                {/* ── TAB: ภาพรวม ── */}
                <div style={{ padding:16, display:dTab==="overview"?"flex":"none", flexDirection:"column", gap:14 }}>
                  <div style={cardStyle}>
                    {/* แก้ไขได้ในที่เดิมตลอดเวลา — ปุ่มสลับโหมด "แก้ไขข้อมูล" ถูกถอดออก (บอสสั่ง 17 ก.ค. 69)
                        ปุ่ม "บันทึกการแก้ไข" ท้ายการ์ดติดไฟเมื่อมีการแก้จริงเท่านั้น */}
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
                      <div style={{ ...secLabel, marginBottom:0 }}><User size={13} color="#003366" /> ข้อมูลลูกค้า (Overview)</div>
                    </div>
                    <OverviewEditor lead={c} persons={personsList} onSave={saveLead} />
                  </div>
                </div>

                {/* ── TAB: งาน ── */}
                <div style={{ padding:16, display:dTab==="tasks"?"flex":"none", flexDirection:"column", gap:14 }}>
                  <div ref={journeyRef} style={cardStyle}>{tabTasks}</div>
                </div>

                {/* ── TAB: ใบเสนอราคา ── */}
                <div style={{ padding:16, display:dTab==="quotation"?"flex":"none", flexDirection:"column", gap:14 }}>
                  <div ref={rightQuoteRef} style={cardStyle}>{tabQuotation}</div>
                </div>

                {/* ── TAB: ไทม์ไลน์ + นัดหมาย + ไฟล์ + โน้ต ── */}
                <div style={{ padding:16, display:dTab==="timeline"?"flex":"none", flexDirection:"column", gap:14 }}>
                  <div style={cardStyle}>{tabActivities}</div>
                  <div ref={rightApptRef} style={cardStyle}>{tabAppts}</div>
                  <div style={cardStyle}>{tabFiles}</div>
                  <div style={cardStyle}><div style={secLabel}><StickyNote size={13} color="#003366" /> โน้ต / รายงานติดตาม</div>{tabReport}</div>
                </div>
              </div>

              {/* แถบปุ่มติดล่าง */}
              <div style={{ flexShrink:0, borderTop:"1px solid #e6eaf0", background:"#fff", padding:"12px 20px",
                display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, flexWrap:"wrap" }}>
                <div />{/* ปุ่มสร้างใบเสนอราคา/นัดหมาย เอาออกตามที่บอสสั่ง — ทำได้ที่แท็บ "ใบเสนอราคา" และ "ไทม์ไลน์" */}
                {!isCustomer && (
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <button onClick={()=>setQuickLost(true)} className="btn btn-md" style={{ background:"#fef2f2", color:"#dc2626", border:"1px solid #fecaca" }}><XCircle size={14} /> ปิดการขายไม่สำเร็จ</button>
                    <button onClick={markWon} className="btn btn-md" style={{ background:"#059669", color:"#fff", boxShadow:"0 4px 12px rgba(5,150,105,.25)" }}><Trophy size={14} /> ปิดการขาย (Won)</button>
                  </div>
                )}
              </div>
            </div>

            {/* ปิดการขายไม่สำเร็จ — เลือกเหตุผล */}
            {quickLost && (
              <>
                <div onClick={()=>setQuickLost(false)} style={{ position:"fixed", inset:0, background:"rgba(45,45,45,.5)", zIndex:230 }} />
                <div style={{ position:"fixed", top:"50%", left:"50%", transform:"translate(-50%,-50%)", zIndex:240, width:420, maxWidth:"calc(100vw - 32px)", background:"#fff", borderRadius:16, overflow:"hidden", boxShadow:"0 24px 80px rgba(0,0,0,.3)" }}>
                  <div style={{ padding:"14px 18px", borderBottom:"1px solid #f0f4f8", display:"flex", alignItems:"center", gap:9 }}>
                    <XCircle size={17} color="#dc2626" /><span style={{ fontSize:"0.9rem", fontWeight:800, color:"#dc2626" }}>ปิดการขายไม่สำเร็จ</span>
                  </div>
                  <div style={{ padding:"16px 18px" }}>
                    <div style={{ fontSize:"0.75rem", color:"#6b7280", marginBottom:10 }}>เลือกเหตุผลที่ปิดการขายไม่ได้</div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
                      {lostReasons.map(r => (
                        <button key={r} onClick={()=>setQuickLostReason(r)} style={{ padding:"8px 10px", borderRadius:8, cursor:"pointer", fontSize:"0.78rem", fontFamily:"inherit", textAlign:"left",
                          border:`1px solid ${quickLostReason===r ? "#dc2626" : "#e5e7eb"}`, background:quickLostReason===r ? "#fee2e2" : "#fff", color:quickLostReason===r ? "#dc2626" : "#2D2D2D", fontWeight:quickLostReason===r ? 700 : 400 }}>{r}</button>
                      ))}
                    </div>
                  </div>
                  <div style={{ padding:"12px 18px", borderTop:"1px solid #f0f4f8", background:"#fafafa", display:"flex", justifyContent:"flex-end", gap:8 }}>
                    <button onClick={()=>{ setQuickLost(false); setQuickLostReason(""); }} className="btn btn-secondary btn-sm" style={{ color:"#374151" }}>ยกเลิก</button>
                    <button onClick={()=>markLost(quickLostReason)} disabled={!quickLostReason} className="btn btn-sm" style={{ background:quickLostReason ? "#dc2626" : "#f3f4f6", color:quickLostReason ? "#fff" : "#9ca3af", cursor:quickLostReason ? "pointer" : "not-allowed" }}>ยืนยันปิดการขาย</button>
                  </div>
                </div>
              </>
            )}
          </>
        );
      })()}

      {/* Success toast (Convert to Customer) */}
      {toast && (
        <div style={{ position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)",
          zIndex:300, display:"flex", alignItems:"center", gap:9,
          background:"#003366", color:"#fff", borderRadius:12, padding:"12px 18px",
          boxShadow:"0 10px 32px rgba(0,0,0,.25)", fontSize:"0.8rem", fontWeight:600,
          maxWidth:"calc(100vw - 32px)" }}>
          <CheckCircle2 size={17} color="#34d399" />
          <span>{toast}</span>
        </div>
      )}
      {previewFile && <FilePreviewModal file={previewFile} onClose={()=>setPreviewFile(null)} />}
    </>
  );
}

