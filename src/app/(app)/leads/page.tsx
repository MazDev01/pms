"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  leadStatusLabel, leadStatusColor,
  responsiblePersons, RP_STORAGE_KEY,
  quotationStatusLabel, quotationStatusColor,
  solutionProducts, LOST_REASONS, buildLeadReport, buildLeadTasks, seedLeadTasks, taskProgress,
  type LeadStatus, type LeadRow, type ResponsiblePerson,
} from "@/lib/mock";
import { LeadTasks } from "@/components/ui/LeadTasks";
import { LeadQuotationsPanel } from "@/components/ui/LeadQuotationsPanel";
import { PersonPicker } from "@/components/ui/PersonPicker";
import { useMasterCatalog } from "@/lib/useMasterCatalog";
import { useRole } from "@/context/RoleContext";
import {
  Plus, Search, X,
  CheckCircle2, User,
  MessageSquare, Paperclip, Trash2,
  Check, ChevronDown,
  ArrowUpDown, ArrowUp, ArrowDown, Filter,
  LayoutList, Columns3,
} from "lucide-react";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { useSales } from "@/context/SalesContext";
import { DrawerSection } from "@/components/ui/RightDrawer";
import { useTableLayout } from "@/components/ui/TableTools";
import { useFilters } from "@/context/FilterContext";
import { FilterBar } from "@/components/filters/FilterBar";

// ─── Design tokens ────────────────────────────────────────────────────────
const CARD: React.CSSProperties = {
  background: "#fff", borderRadius: 16,
  border: "1px solid #e5e7eb", boxShadow: "0 2px 14px rgba(0,0,0,.07)",
};

const ALL_STATUSES: LeadStatus[] = [
  "WAITING","BULLET","QUOTED","FOLLOWUP","NEGO","PAID","CANCELLED"
];
// ความคืบหน้าตามขั้นตอน (module-level เพื่อใช้ใน OverviewEditor) — PAID=100, CANCELLED=0
const DEFAULT_PERSONS = responsiblePersons.filter(p => p.active).map(p => p.name);
// Lead Source ตามสเปก: Facebook / Website / LINE / Walk-in / Referral / Exhibition / Other
const SOURCES = ["Facebook","เว็บไซต์","LINE","Walk-in","แนะนำต่อ","งานแสดงสินค้า","อื่นๆ"];
const PROVINCES = ["กรุงเทพฯ","เชียงใหม่","ระยอง","เชียงราย","นนทบุรี","สมุทรสาคร","นครสวรรค์","ราชบุรี","ขอนแก่น","อื่นๆ"];
const THAI_MONTHS = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
function thaiDateStr(d: Date) { return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`; }

type SortKey = "company"|"value"|"status"|"assigned"|"priority";

// คอลัมน์ที่ซ่อน/แสดงได้ (optional) สำหรับ TableTools — key ตรงกับ th/td/col ในตาราง
const COLS: { key: string; label: string }[] = [
  { key: "province", label: "จังหวัด" },
  { key: "product",  label: "แม่แบบ" },
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
// กิจกรรมล่าสุดของลีด (activities เรียงใหม่สุดอยู่บน)
function lastActivity(l: LeadRow): string { return l.activities?.[0]?.date ?? "—"; }
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

// ─── Priority (ความสำคัญ) — deterministic by value tier ──────────────────────
type Priority = "HIGH" | "MEDIUM" | "LOW";
const PRIORITIES: Priority[] = ["HIGH", "MEDIUM", "LOW"];
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
function seedActivities(_lead: LeadRow): { date: string; text: string }[] {
  return [];
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

// ─── ภาพรวม (แก้ไขในตัว) — ฟอร์มแก้ไขข้อมูลผู้สนใจในแท็บภาพรวมของโมดัลรายละเอียด ─────
function OverviewEditor({ lead, persons, onSave }: {
  lead: LeadRow; persons: string[]; onSave: (l: LeadRow) => void;
}) {
  const catalog = useMasterCatalog(); // แม่แบบจากแคตตาล็อกกลาง (HQ แก้ → เห็นตรงกัน)
  const seed = () => ({
    company: lead.company ?? "", contact: lead.contact ?? "", phone: lead.phone ?? "",
    email: lead.email ?? "", province: lead.province ?? PROVINCES[0], source: lead.source ?? SOURCES[0],
    product: lead.product ?? catalog[0]?.name ?? "", status: lead.status,
    assigned: lead.assigned ?? persons[0], value: lead.value ?? "",
    note: lead.note ?? "", lostReason: lead.lostReason ?? "", logo: lead.logo ?? "",
  });
  const [f, setF] = useState(seed);
  const logoRef = useRef<HTMLInputElement>(null);
  // reseed เมื่อสลับผู้สนใจ
  useEffect(() => { setF(seed()); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [lead.id]);
  const set = (k: keyof ReturnType<typeof seed>, v: string) => setF(p => ({ ...p, [k]: v }));
  function uploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => set("logo", (ev.target?.result as string) ?? "");
    reader.readAsDataURL(file);
  }

  const dirty =
    f.company !== (lead.company ?? "") || f.contact !== (lead.contact ?? "") ||
    f.phone !== (lead.phone ?? "") || f.email !== (lead.email ?? "") ||
    f.province !== (lead.province ?? "") || f.source !== (lead.source ?? "") ||
    f.product !== (lead.product ?? "") || f.status !== lead.status ||
    f.assigned !== (lead.assigned ?? "") || f.value !== (lead.value ?? "") ||
    f.note !== (lead.note ?? "") || f.lostReason !== (lead.lostReason ?? "") || f.logo !== (lead.logo ?? "");
  // ความคืบหน้า = แหล่งเดียวกับแท็บ "งาน/ความคืบหน้า" (LeadTasks) → เลขตรงกันทุกแท็บ
  const pct = lead.status === "PAID" ? 100 : lead.status === "CANCELLED" ? 0
    : taskProgress(lead.tasks?.length ? lead.tasks : buildLeadTasks());

  const lbl: React.CSSProperties = { display:"block", fontSize:"0.68rem", fontWeight:700, color:"#6b7280", marginBottom:4 };
  const inp: React.CSSProperties = { width:"100%", padding:"8px 10px", borderRadius:8, border:"1px solid #e5e7eb", fontSize:"0.82rem", fontFamily:"inherit", color:"#2D2D2D", background:"#fff" };

  function save() { onSave({ ...lead, ...f, logo: f.logo || undefined, category: f.product, value: fmtVal(f.value), lostReason: f.status === "CANCELLED" ? (f.lostReason || undefined) : undefined }); }

  return (
    <div>
      <div style={{ fontSize:"0.68rem", fontWeight:800, letterSpacing:".06em", textTransform:"uppercase", color:"#003366", marginBottom:12, paddingBottom:6, borderBottom:"1px solid #C0C0C044" }}>
        ภาพรวม · แก้ไขได้ในหน้านี้
      </div>
      {/* เปลี่ยนรูป/โลโก้ลูกค้า */}
      <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:14 }}>
        <div style={{ width:60, height:60, borderRadius:14, flexShrink:0, overflow:"hidden",
          border:`2px dashed ${f.logo ? "transparent" : "#e5e7eb"}`, background:f.logo ? "#fff" : "#f8fafc",
          display:"flex", alignItems:"center", justifyContent:"center" }}>
          {f.logo
            ? <img src={f.logo} alt="โลโก้" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
            : <User size={24} color="#9ca3af" />}
        </div>
        <div>
          <label style={lbl}>รูป / โลโก้ลูกค้า</label>
          <input ref={logoRef} type="file" accept="image/*" style={{ display:"none" }} onChange={uploadLogo} />
          <div style={{ display:"flex", gap:8 }}>
            <button type="button" onClick={()=>logoRef.current?.click()} className="btn btn-secondary btn-sm" style={{ color:"#374151" }}>
              <Paperclip size={13} /> {f.logo ? "เปลี่ยนรูป" : "อัปโหลดรูป"}
            </button>
            {f.logo && (
              <button type="button" onClick={()=>set("logo","")} className="btn btn-secondary btn-sm" style={{ color:"#dc2626" }}>
                <X size={13} /> ลบรูป
              </button>
            )}
          </div>
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <div style={{ gridColumn:"1/-1" }}>
          <label style={lbl}>บริษัท *</label>
          <input value={f.company} onChange={e=>set("company",e.target.value)} style={inp} />
        </div>
        <div><label style={lbl}>ผู้ติดต่อ *</label><input value={f.contact} onChange={e=>set("contact",e.target.value)} style={inp} /></div>
        <div><label style={lbl}>โทรศัพท์</label><input value={f.phone} onChange={e=>set("phone",e.target.value)} placeholder="0XX-XXX-XXXX" style={inp} /></div>
        <div><label style={lbl}>อีเมล</label><input value={f.email} onChange={e=>set("email",e.target.value)} type="email" placeholder="email@company.com" style={inp} /></div>
        <div><label style={lbl}>จังหวัด</label>
          <select value={f.province} onChange={e=>set("province",e.target.value)} style={inp}>{PROVINCES.map(p=><option key={p}>{p}</option>)}</select>
        </div>
        <div><label style={lbl}>แม่แบบ</label>
          <select value={f.product} onChange={e=>set("product",e.target.value)} style={inp}>
            {!catalog.some(p=>p.name===f.product) && <option value={f.product}>{f.product}</option>}
            {catalog.map(p=><option key={p.id} value={p.name}>{p.name}</option>)}
          </select>
        </div>
        <div><label style={lbl}>มูลค่าประเมิน</label>
          <input value={f.value} onChange={e=>set("value",e.target.value)} onBlur={()=>{ if(f.value.trim()) set("value",fmtVal(f.value)); }} placeholder="เช่น 1200000 หรือ ฿1.2M" style={inp} />
        </div>
        <div><label style={lbl}>ขั้นตอน</label>
          <select value={f.status} onChange={e=>set("status",e.target.value as LeadStatus)} style={inp}>{ALL_STATUSES.map(s=><option key={s} value={s}>{leadStatusLabel[s]}</option>)}</select>
        </div>
        {f.status==="CANCELLED" && (
          <div><label style={{...lbl, color:"#dc2626"}}>เหตุผลที่เสีย</label>
            <select value={f.lostReason} onChange={e=>set("lostReason",e.target.value)} style={{...inp, borderColor:"#fecaca"}}>
              <option value="">— เลือกเหตุผล —</option>
              {LOST_REASONS.map(r=><option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        )}
        <div><label style={lbl}>ผู้รับผิดชอบ</label>
          <PersonPicker value={f.assigned} onChange={v=>set("assigned",v)} multiple />
        </div>
        <div><label style={lbl}>แหล่งที่มา</label>
          <select value={f.source} onChange={e=>set("source",e.target.value)} style={inp}>{SOURCES.map(s=><option key={s}>{s}</option>)}</select>
        </div>
        <div style={{ gridColumn:"1/-1" }}><label style={lbl}>หมายเหตุ</label>
          <textarea value={f.note} onChange={e=>set("note",e.target.value)} rows={3} placeholder="รายละเอียดเพิ่มเติม..."
            style={{ ...inp, resize:"vertical", fontFamily:"inherit", lineHeight:1.6 }} />
        </div>
      </div>

      {/* ความคืบหน้า (อ่านอย่างเดียว) */}
      <div style={{ display:"flex", alignItems:"center", gap:10, marginTop:14, fontSize:"0.76rem", color:"#374151" }}>
        <span style={{ fontWeight:600 }}>ความคืบหน้า</span>
        <span style={{ flex:1, height:6, borderRadius:99, background:"#f0f4f8", overflow:"hidden" }}>
          <span className="bar-grow" style={{ display:"block", height:"100%", width:`${pct}%`, background:f.status==="CANCELLED"?"#dc2626":f.status==="PAID"?"#059669":"#003366" }} />
        </span>
        <span style={{ fontWeight:800, color:"#003366" }}>{pct}%</span>
      </div>

      {/* ปุ่มบันทึก */}
      <div style={{ display:"flex", justifyContent:"flex-end", gap:8, marginTop:16 }}>
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
  const [form, setForm] = useState({
    company: initial?.company ?? "", contact: initial?.contact ?? "",
    phone: initial?.phone ?? "", email: initial?.email ?? "",
    province: initial?.province ?? "กรุงเทพฯ", product: initial?.product ?? solutionProducts[0].name,
    value: initial?.value ?? "", status: (initial?.status ?? "WAITING") as LeadStatus,
    assigned: initial?.assigned ?? persons[0] ?? "สมชาย เชียงใหม่",
    source: initial?.source ?? "เว็บไซต์", note: initial?.note ?? "",
    logo: initial?.logo ?? "",
  });
  const logoInputRef = useRef<HTMLInputElement>(null);
  function set(k: keyof typeof form, v: string) { setForm(p=>({...p,[k]:v})); }
  function uploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => set("logo", (ev.target?.result as string) ?? "");
    reader.readAsDataURL(file);
  }
  function submit() {
    if (!form.company.trim() || !form.contact.trim()) return;
    const base = {
      name: form.company,
      company: form.company, contact: form.contact,
      phone: form.phone, email: form.email,
      province: form.province, product: form.product,
      category: form.product, value: form.value,
      status: form.status, assigned: form.assigned,
      source: form.source, note: form.note,
      logo: form.logo || undefined,
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
    padding:"8px 11px", fontSize:"0.82rem", outline:"none", color:"#2D2D2D",
  };
  const labelStyle: React.CSSProperties = {
    display:"block", fontSize:"0.68rem", fontWeight:700,
    color:"#374151", marginBottom:4, textTransform:"uppercase", letterSpacing:"0.04em",
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
              <div style={{ fontSize:"0.7rem", color:"#374151" }}>{isEdit ? `แก้ไขข้อมูล ${initial?.id}` : "กรอกข้อมูลลูกค้าเป้าหมาย"}</div>
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
              {/* อัปโหลดรูป/โลโก้ลูกค้า */}
              <div style={{ gridColumn:"1/-1", display:"flex", alignItems:"center", gap:14 }}>
                <div style={{ width:64, height:64, borderRadius:14, flexShrink:0, overflow:"hidden",
                  border:`2px dashed ${form.logo ? "transparent" : "#e5e7eb"}`, background:form.logo ? "#fff" : "#f8fafc",
                  display:"flex", alignItems:"center", justifyContent:"center" }}>
                  {form.logo
                    ? <img src={form.logo} alt="โลโก้" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                    : <User size={26} color="#9ca3af" />}
                </div>
                <div>
                  <label style={labelStyle}>รูป / โลโก้ลูกค้า</label>
                  <input ref={logoInputRef} type="file" accept="image/*" style={{ display:"none" }} onChange={uploadLogo} />
                  <div style={{ display:"flex", gap:8 }}>
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
                  placeholder="ชื่อบริษัทลูกค้า" style={inputStyle} autoFocus />
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
              <div>
                <label style={labelStyle}>อีเมล</label>
                <input value={form.email} onChange={e=>set("email",e.target.value)}
                  placeholder="email@company.com" type="email" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>จังหวัด</label>
                <select value={form.province} onChange={e=>set("province",e.target.value)} style={inputStyle}>
                  {PROVINCES.map(p=><option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>แม่แบบ</label>
                <select value={form.product} onChange={e=>set("product",e.target.value)} style={inputStyle}>
                  {/* คงค่าที่มีอยู่เดิมไว้ถ้าไม่ตรงกับแคตตาล็อก (กันข้อมูลเก่าเพี้ยน) */}
                  {!catalog.some(p=>p.name===form.product) && <option value={form.product}>{form.product}</option>}
                  {catalog.map(p=>(
                    <option key={p.id} value={p.name}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>มูลค่าประเมิน</label>
                <input value={form.value} onChange={e=>set("value",e.target.value)}
                  onBlur={()=>{ if(form.value.trim()) set("value", fmtVal(form.value)); }}
                  placeholder="เช่น 1200000 หรือ ฿1.2M" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>ขั้นตอน</label>
                <select value={form.status} onChange={e=>set("status",e.target.value as LeadStatus)} style={inputStyle}>
                  {ALL_STATUSES.map(s=><option key={s} value={s}>{leadStatusLabel[s]}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>ผู้รับผิดชอบ</label>
                <PersonPicker value={form.assigned} onChange={v=>set("assigned",v)} multiple />
              </div>
              <div>
                <label style={labelStyle}>แหล่งที่มา</label>
                <select value={form.source} onChange={e=>set("source",e.target.value)} style={inputStyle}>
                  {SOURCES.map(s=><option key={s}>{s}</option>)}
                </select>
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
function ReportEditor({ lead, onSave }: { lead: LeadRow; onSave: (l: LeadRow) => void }) {
  // ถ้ายังไม่มีรายงาน (ลีดเก่า) → เปิดด้วยเทมเพลตมาตรฐาน (พรีฟิลจากข้อมูลลีด) ให้แก้ต่อได้
  const initial = () => lead.report ?? buildLeadReport(lead, thaiDateStr(new Date()));
  const [text, setText] = useState(initial);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { setText(initial()); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [lead.id]);
  const dirty = text !== (lead.report ?? "");

  // แทรก bullet บรรทัดใหม่ที่ตำแหน่งเคอร์เซอร์
  function insertBullet() {
    const el = ref.current; if (!el) return;
    const pos = el.selectionStart ?? text.length;
    const before = text.slice(0, pos), after = text.slice(pos);
    const needNL = before && !before.endsWith("\n");
    const insert = `${needNL ? "\n" : ""}- `;
    const next = before + insert + after;
    setText(next);
    requestAnimationFrame(() => { el.focus(); const c = (before + insert).length; el.setSelectionRange(c, c); });
  }
  function resetTemplate() { setText(buildLeadReport(lead, thaiDateStr(new Date()))); }

  const lbl: React.CSSProperties = { display:"block", fontSize:"0.68rem", fontWeight:700, color:"#6b7280", marginBottom:6 };

  return (
    <div>
      <div style={{ fontSize:"0.68rem", fontWeight:800, letterSpacing:".06em", textTransform:"uppercase", color:"#003366", marginBottom:10, paddingBottom:6, borderBottom:"1px solid #C0C0C044" }}>
        รายงานการติดตาม · แก้ไขได้ทั้งหมด
      </div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, marginBottom:8 }}>
        <label style={lbl}>เนื้อหารายงาน</label>
        <div style={{ display:"flex", gap:6 }}>
          <button type="button" onClick={insertBullet} className="btn btn-secondary btn-sm" style={{ color:"#374151", padding:"4px 10px" }}>+ หัวข้อย่อย</button>
          <button type="button" onClick={resetTemplate} className="btn btn-secondary btn-sm" style={{ color:"#374151", padding:"4px 10px" }}>รีเซ็ตเทมเพลต</button>
        </div>
      </div>
      <textarea ref={ref} value={text} onChange={e=>setText(e.target.value)}
        spellCheck={false}
        style={{ width:"100%", minHeight:320, padding:"12px 14px", borderRadius:10, border:"1px solid #e5e7eb",
          fontSize:"0.82rem", lineHeight:1.7, fontFamily:"inherit", color:"#2D2D2D", background:"#fff", resize:"vertical", whiteSpace:"pre-wrap" }} />
      <div style={{ display:"flex", justifyContent:"flex-end", gap:8, marginTop:12 }}>
        {dirty && <button onClick={()=>setText(initial())} className="btn btn-secondary btn-sm" style={{ color:"#374151" }}>ยกเลิก</button>}
        <button onClick={()=>onSave({ ...lead, report: text })} disabled={!dirty}
          className="btn btn-primary btn-sm" style={!dirty ? { opacity:0.5, cursor:"not-allowed" } : undefined}>
          บันทึกรายงาน
        </button>
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────
export default function LeadsPage() {
  const router = useRouter();
  const { session } = useRole(); // ผู้ดำเนินการ (บันทึกลง task ที่เช็ก)
  const fileInputRef = useRef<HTMLInputElement>(null);

  // List state
  const {
    leads: allLeads, addLead, updateLead, deleteLead: removeLead, updateLeadStatus,
  } = useSales();
  // ปิดการขายสำเร็จ = เป็น "ลูกค้า" แล้ว → ไม่แสดงในหน้าลูกค้าเป้าหมาย (ไปอยู่ที่ /customers)
  const leadsData = useMemo(() => allLeads.filter(l => l.status !== "PAID"), [allLeads]);

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
  const [view, setView] = useState<"list"|"kanban">("list");
  const [dragId, setDragId] = useState<string|null>(null); // การ์ดที่กำลังลากในมุมมอง Kanban
  const [dragOver, setDragOver] = useState<LeadStatus|null>(null); // คอลัมน์ที่กำลังลากค้างอยู่ (ไฮไลต์)
  const [hideEmpty, setHideEmpty] = useState(false); // ซ่อนคอลัมน์ที่ไม่มีการ์ด
  const [query, setQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<LeadStatus|"ALL">("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("company");
  const [sortDir, setSortDir] = useState<"asc"|"desc">("asc");
  const [showFilters, setShowFilters] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingLead, setEditingLead] = useState<LeadRow|null>(null);

  // List pagination (LIST view only)
  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);

  // Advanced filters
  const [fAssignee, setFAssignee] = useState("");
  const [fValueMin, setFValueMin] = useState("");
  const [fValueMax, setFValueMax] = useState("");
  const [fProvince, setFProvince] = useState("");
  const [fSource, setFSource] = useState("");
  const [fPriority, setFPriority] = useState<Priority|"">("");

  // Panel state
  const [selectedLead, setSelectedLead] = useState<LeadRow|null>(null);
  const [activeTab, setActiveTab] = useState<"overview"|"tasks"|"report"|"activities"|"quotation"|"files">("overview");
  const [editingField, setEditingField] = useState<string|null>(null);
  const [draft, setDraft] = useState<LeadRow|null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // โมดัลรายละเอียด: ล็อกสกรอลล์พื้นหลังเท่านั้น — การปิดด้วย Esc จัดการโดย effect ปิดทีละชั้นด้านล่าง
  useEffect(() => {
    if (!selectedLead) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [selectedLead]);

  // Files
  const [leadFiles, setLeadFiles] = useState<Record<string,string[]>>({});

  // Persons registry (loaded from localStorage, fallback to mock)
  const [personsList, setPersonsList] = useState<string[]>(DEFAULT_PERSONS);
  useEffect(() => {
    const s = localStorage.getItem(RP_STORAGE_KEY);
    if (s) try {
      const arr: ResponsiblePerson[] = JSON.parse(s);
      setPersonsList(arr.filter(p => p.active).map(p => p.name));
    } catch {}
  }, []);

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
      const matchPri = !fPriority || leadPriority(l) === fPriority;
      const val = parseValue(l.value);
      const matchMin = !fValueMin || val >= parseFloat(fValueMin.replace(/[฿,M]/g,""))*1e6;
      const matchMax = !fValueMax || val <= parseFloat(fValueMax.replace(/[฿,M]/g,""))*1e6;
      return matchQ && matchS && matchPerson && matchTime && matchA && matchP && matchSrc && matchPri && matchMin && matchMax;
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
  }, [leadsData, query, filterStatus, person, timeRange, fAssignee, fProvince, fSource, fPriority, fValueMin, fValueMax, sortKey, sortDir]);

  // ─── List pagination (LIST view only) ──────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // Reset to page 1 whenever filters / search / sort change the result set
  useEffect(() => { setPage(1); }, [query, filterStatus, person, fAssignee, fProvince, fSource, fPriority, fValueMin, fValueMax, sortKey, sortDir]);
  // Clamp page into range if the list shrinks
  useEffect(() => { setPage(p => Math.min(p, totalPages)); }, [totalPages]);
  const paged = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);
  const pageStart = filtered.length === 0 ? 0 : (page-1)*PAGE_SIZE + 1;
  const pageEnd = Math.min(page*PAGE_SIZE, filtered.length);

  const totalValue = leadsData.reduce((s,l) => s + parseValue(l.value), 0);
  // อัตราปิดการขายคิดจากข้อมูลทั้งหมด (รวมที่กลายเป็นลูกค้าไปแล้ว) — หน้ารายการแสดงเฉพาะที่ยังไม่ปิด
  const wonLeads = allLeads.filter(l => l.status === "PAID").length;
  const nonLost = allLeads.filter(l => l.status !== "CANCELLED").length;
  const winRate = nonLost ? Math.round((wonLeads / nonLost)*100) : 0;
  const hasActiveFilters = !!(fAssignee || fProvince || fSource || fPriority || fValueMin || fValueMax);

  function onSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  // ─── Panel helpers ─────────────────────────────────────────────────────
  const current = draft ?? selectedLead;
  const lid = current?.id ?? "";

  function openPanel(l: LeadRow) {
    if (selectedLead?.id === l.id) return closePanel();
    setSelectedLead(l); setDraft({...l});
    setEditingField(null); setShowDeleteConfirm(false);
    setActiveTab("overview");
    setPopupField(null); setEditPopupPos(null);
    setShowStatusDropdown(false);
  }
  function closePanel() {
    setSelectedLead(null); setDraft(null);
    setEditingField(null); setShowDeleteConfirm(false);
    setPopupField(null); setEditPopupPos(null);
    setShowStatusDropdown(false);
  }

  // เปิดโมดัลอัตโนมัติจาก ?open=N (ลิงก์เดิม /leads/[id] redirect มาที่นี่ — deep link ยังใช้ได้)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("open");
    if (!p) return;
    const target = allLeads.find(l => String(l.numId) === p || l.id === p);
    if (target) {
      if (target.status === "PAID") {
        // เป็นลูกค้าแล้ว — ส่งต่อไปหน้าลูกค้าแทน (โปรไฟล์อยู่ที่นั่น)
        router.replace(target.customerId != null ? `/customers?open=${target.customerId}` : "/customers");
        return;
      }
      openPanel(target);
    }
    window.history.replaceState(null, "", "/leads"); // ล้าง param กันเปิดซ้ำเมื่อรีเฟรช
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

  // Files
  const myFiles: string[] = leadFiles[lid] ?? [];
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f || !lid) return;
    setLeadFiles(p=>({...p,[lid]:[...(p[lid]??[]),f.name]}));
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
      else if (editingLead) setEditingLead(null);
      else if (popupField) closeFieldPopup();
      else closePanel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLead, showDeleteConfirm, editingLead, popupField]);

  // ─── RENDER ────────────────────────────────────────────────────────────
  return (
    <>
      {/* ═══ PAGE ═══════════════════════════════════════════════════ */}
      <div className="erp">
        {/* Header row */}
        <div className="page-head">
          <div>
            <h2>ลูกค้าเป้าหมาย</h2>
            <p>{leadsData.length} รายการ · อัตราปิดการขาย {winRate}% · {timeRange.subtitle}</p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <FilterBar dims={[]} />
            <ExportMenu filename="leads" title="รายชื่อลูกค้าเป้าหมาย"
              headers={["รหัส","ชื่อ","ผู้ติดต่อ","จังหวัด","แม่แบบ","สถานะ","ความคืบหน้า","มูลค่า","ผู้รับผิดชอบ","กิจกรรมล่าสุด"]}
              rows={filtered.map(l=>[l.id,l.name,l.contact,l.province,l.product,leadStatusLabel[l.status],`${leadProg(l)}%`,fmtVal(l.value),l.assigned,lastActivity(l)])} />
            <button onClick={() => setShowAddForm(true)} className="btn btn-primary btn-md">
              <Plus size={15} /> เพิ่มลูกค้าเป้าหมาย
            </button>
          </div>
        </div>

        {/* สรุปรวม (ไม่ซ้ำกับ funnel ด้านล่าง — funnel คุมการนับ/กรองตามสถานะ) */}
        <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap", marginBottom:14 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:"0.78rem", fontWeight:700,
            background:"#fff", border:"1px solid #e5e7eb", borderRadius:99, padding:"7px 16px" }}>
            ลูกค้าเป้าหมายทั้งหมด: <span style={{ color:"#003366" }}>{leadsData.length}</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:"0.78rem", fontWeight:700,
            background:"#fff", border:"1px solid #e5e7eb", borderRadius:99, padding:"7px 16px" }}>
            มูลค่ารวม: <span style={{ color:"#003366" }}>{fmtM(totalValue)}</span>
          </div>
          {filterStatus!=="ALL" && (
            <button onClick={()=>setFilterStatus("ALL")}
              style={{ display:"flex", alignItems:"center", gap:6, fontSize:"0.76rem", fontWeight:600,
                background:"#f0f4f8", border:"1px solid #e5e7eb", borderRadius:99, padding:"7px 14px",
                color:"#374151", cursor:"pointer" }}>
              แสดงทั้งหมด
            </button>
          )}
        </div>

        {/* Status funnel — นับ+กรองตามขั้นตอนเส้นทางการขาย */}
        <div className="card" style={{ padding:"12px 16px", marginBottom:14, display:"flex", gap:6, flexWrap:"wrap" }}>
          {ALL_STATUSES.map(p=>{
            const c = leadsData.filter(l=>l.status===p).length;
            const col = leadStatusColor[p];
            const active = filterStatus===p;
            const val = leadsData.filter(l=>l.status===p).reduce((s,l)=>s+parseValue(l.value),0);
            return (
              <button key={p} onClick={()=>setFilterStatus(active?"ALL":p)}
                style={{ display:"flex", flexDirection:"column", gap:2,
                  background:active?col.bg:"#fafafa",
                  border:`1px solid ${active?col.text+"40":"#e5e7eb"}`,
                  borderRadius:10, padding:"8px 12px", fontSize:"0.72rem", fontWeight:600,
                  color:active?col.text:"#6b7280", cursor:"pointer" }}>
                <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                  <span style={{ width:18, height:18, borderRadius:"50%", background:col.bg,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:"0.6rem", color:col.text, fontWeight:800 }}>{c}</span>
                  {leadStatusLabel[p]}
                </div>
                <span style={{ fontSize:"0.62rem", color:active?col.text:"#C0C0C0", fontWeight:500 }}>
                  {val>0 ? fmtM(val) : "—"}
                </span>
              </button>
            );
          })}
        </div>

        {/* Toolbar */}
        <div className="card" style={{ padding:"12px 16px", marginBottom:14 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
            {/* Search — ชิดซ้าย */}
            <div style={{ display:"flex", alignItems:"center", gap:8, background:"#fafafa",
              border:"1px solid #e5e7eb", borderRadius:10, padding:"0 12px", height:36, boxSizing:"border-box", minWidth:240, flex:1, maxWidth:360 }}>
              <Search size={13} color="#6b7280" />
              <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="ค้นหาบริษัท ผู้ติดต่อ..."
                style={{ border:"none", outline:"none", fontSize:"0.8rem", color:"#2D2D2D", background:"transparent", flex:1 }} />
              {query && <button onClick={()=>setQuery("")}
                style={{ background:"none", border:"none", cursor:"pointer", color:"#374151", padding:0, display:"flex" }}>
                <X size={13}/>
              </button>}
            </div>

            <div style={{ flex:1 }} />
            {/* ปุ่มควบคุม — ชิดขวา: ตัวกรอง + สลับมุมมอง */}
            {/* Filter toggle */}
            <button onClick={()=>setShowFilters(p=>!p)}
              style={{ display:"flex", alignItems:"center", gap:6, background:showFilters||hasActiveFilters?"#003366":"#fff",
                border:`1px solid ${showFilters||hasActiveFilters?"#003366":"#e5e7eb"}`,
                borderRadius:10, padding:"0 13px", height:36, boxSizing:"border-box", fontSize:"0.77rem", fontWeight:600,
                color:showFilters||hasActiveFilters?"#fff":"#6b7280", cursor:"pointer" }}>
              <Filter size={13} />
              ตัวกรอง {hasActiveFilters && <span style={{ background:"rgba(255,255,255,.3)", borderRadius:99, padding:"0 5px", fontSize:"0.65rem" }}>เปิด</span>}
            </button>

            {/* สลับมุมมอง List / Kanban (รวม "เส้นทางการขาย" มาไว้ที่นี่) */}
            {view === "kanban" && (
              <button onClick={()=>setHideEmpty(v=>!v)}
                style={{ display:"flex", alignItems:"center", gap:6, padding:"0 12px", height:36, boxSizing:"border-box", borderRadius:9, cursor:"pointer",
                  border:`1px solid ${hideEmpty?"#003366":"#e5e7eb"}`, background: hideEmpty?"#dce5f0":"#fff",
                  color: hideEmpty?"#003366":"#6b7280", fontFamily:"inherit", fontSize:"0.75rem", fontWeight:600 }}>
                {hideEmpty ? <Check size={13} /> : <Columns3 size={13} />} ซ่อนคอลัมน์ว่าง
              </button>
            )}
            <div style={{ display:"flex", border:"1px solid #e5e7eb", borderRadius:9, overflow:"hidden", height:36, boxSizing:"border-box" }}>
              {([["list", LayoutList, "ตาราง"], ["kanban", Columns3, "บอร์ด"]] as const).map(([v, Ico, tip]) => (
                <button key={v} title={tip} onClick={()=>setView(v)}
                  style={{ display:"flex", alignItems:"center", gap:5, padding:"0 12px", height:"100%", border:"none", cursor:"pointer",
                    background: view===v ? "#003366" : "#fff", color: view===v ? "#fff" : "#6b7280", fontFamily:"inherit", fontSize:"0.75rem", fontWeight:600 }}>
                  <Ico size={14} /> {tip}
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* ── FILTER DRAWER (เลื่อนจากขวา) ── */}
        {showFilters && (() => {
          const lbl = { fontSize:"0.68rem", fontWeight:700, color:"#374151", marginBottom:6, display:"block" } as const;
          const inp = { width:"100%", border:"1px solid #e5e7eb", borderRadius:9, padding:"9px 12px", fontSize:"0.82rem", outline:"none", color:"#2D2D2D", background:"#fff", boxSizing:"border-box" as const };
          return (
            <>
              <div onClick={()=>setShowFilters(false)} className="drawer-overlay"
                style={{ position:"fixed", inset:0, background:"rgba(45,45,45,.4)", zIndex:150 }} />
              <div className="side-drawer" style={{ position:"fixed", top:0, right:0, height:"100vh", width:360, maxWidth:"100vw",
                zIndex:151, background:"#fff", boxShadow:"-16px 0 60px rgba(0,0,0,.2)", borderRadius:"18px 0 0 18px",
                display:"flex", flexDirection:"column" }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 20px", borderBottom:"1px solid #e5e7eb", flexShrink:0 }}>
                  <span style={{ fontSize:"1rem", fontWeight:800, color:"#003366", display:"flex", gap:8, alignItems:"center" }}><Filter size={16} /> ตัวกรอง</span>
                  <button onClick={()=>setShowFilters(false)} style={{ width:30, height:30, borderRadius:8, border:"1px solid #e5e7eb", background:"#f8f9fb", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:"#374151" }}><X size={14} /></button>
                </div>
                <div style={{ flex:1, overflowY:"auto", padding:"20px", display:"flex", flexDirection:"column", gap:16 }}>
                  <div><label style={lbl}>ผู้รับผิดชอบ</label>
                    <select value={fAssignee} onChange={e=>setFAssignee(e.target.value)} style={inp}>
                      <option value="">ทั้งหมด</option>{personsList.map(t=><option key={t}>{t}</option>)}
                    </select></div>
                  <div><label style={lbl}>จังหวัด</label>
                    <select value={fProvince} onChange={e=>setFProvince(e.target.value)} style={inp}>
                      <option value="">ทั้งหมด</option>{PROVINCES.map(p=><option key={p}>{p}</option>)}
                    </select></div>
                  <div><label style={lbl}>แหล่งที่มา</label>
                    <select value={fSource} onChange={e=>setFSource(e.target.value)} style={inp}>
                      <option value="">ทั้งหมด</option>{SOURCES.map(s=><option key={s}>{s}</option>)}
                    </select></div>
                  <div><label style={lbl}>ความสำคัญ</label>
                    <select value={fPriority} onChange={e=>setFPriority(e.target.value as Priority|"")} style={inp}>
                      <option value="">ทั้งหมด</option>{PRIORITIES.map(p=><option key={p} value={p}>{priorityLabel[p]}</option>)}
                    </select></div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                    <div><label style={lbl}>มูลค่าขั้นต่ำ (M฿)</label>
                      <input value={fValueMin} onChange={e=>setFValueMin(e.target.value)} placeholder="1" type="number" style={inp} /></div>
                    <div><label style={lbl}>มูลค่าสูงสุด (M฿)</label>
                      <input value={fValueMax} onChange={e=>setFValueMax(e.target.value)} placeholder="5" type="number" style={inp} /></div>
                  </div>
                </div>
                <div style={{ padding:"14px 20px", borderTop:"1px solid #e5e7eb", display:"flex", gap:8, flexShrink:0 }}>
                  <button className="btn btn-secondary btn-md" style={{ flex:1, justifyContent:"center", color: hasActiveFilters ? "#dc2626" : "#9ca3af" }}
                    disabled={!hasActiveFilters}
                    onClick={()=>{ setFAssignee(""); setFProvince(""); setFSource(""); setFPriority(""); setFValueMin(""); setFValueMax(""); }}>
                    ล้างทั้งหมด
                  </button>
                  <button className="btn btn-primary btn-md" style={{ flex:1, justifyContent:"center" }} onClick={()=>setShowFilters(false)}>
                    ดูผลลัพธ์
                  </button>
                </div>
              </div>
            </>
          );
        })()}

        {/* ── LIST VIEW ── */}
        {view === "list" && (
          <div className="card">
            <div className={`table-wrap${density === "compact" ? " dense" : ""}`}>
              <table>
                <colgroup>
                  <col style={{width:"20%"}} />
                  {!hiddenCols.includes("province") && <col style={{width:"9%"}} />}
                  {!hiddenCols.includes("product")  && <col style={{width:"13%"}} />}
                  <col style={{width:"13%"}} />
                  <col style={{width:"13%"}} />
                  <col style={{width:"11%"}} />
                  <col style={{width:"12%"}} />
                  {!hiddenCols.includes("activity") && <col style={{width:"10%"}} />}
                  <col style={{width:"9%"}} />
                </colgroup>
                <thead>
                  <tr>
                    {([
                      ["company","บริษัท / ผู้ติดต่อ",null],
                      [null,"จังหวัด","province"],
                      [null,"แม่แบบ","product"],
                      ["status","ขั้นตอน",null],
                      [null,"ความคืบหน้า",null],
                      ["value","มูลค่า",null],
                      ["assigned","ผู้รับผิดชอบ",null],
                      [null,"กิจกรรมล่าสุด","activity"],
                      [null,"",null],
                    ] as [SortKey|null,string,string|null][])
                      .filter(([,,colKey]) => !colKey || !hiddenCols.includes(colKey))
                      .map(([key,label])=>{
                      const isNum = key === "value"; // คอลัมน์ตัวเลข — จัดหัวคอลัมน์ชิดขวาให้ตรงกับค่าในเซลล์ (.num)
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
                          <div style={{ fontSize:"0.84rem", fontWeight:700, color:"#2D2D2D", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={l.company}>{l.company}</div>
                          <div style={{ fontSize:"0.68rem", color:"#374151", marginTop:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={l.contact}>{l.contact}</div>
                        </td>
                        {!hiddenCols.includes("province") && (
                          <td style={{ fontSize:"0.75rem", color:"#374151" }}>{l.province || "—"}</td>
                        )}
                        {!hiddenCols.includes("product") && (
                          <td style={{ fontSize:"0.75rem", color:"#374151", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={l.product}>{l.product || "—"}</td>
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
                                      <span style={{ fontSize:"0.78rem", color:s===l.status?"#003366":"#2D2D2D", fontWeight:s===l.status?700:400 }}>
                                        {leadStatusLabel[s]}
                                      </span>
                                      {s===l.status && <span style={{ marginLeft:"auto", fontSize:"0.68rem", color:"#003366" }}>✓</span>}
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
                              <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                                <div style={{ flex:1, height:6, background:"#eef2f7", borderRadius:99, overflow:"hidden", minWidth:44 }}>
                                  <div style={{ height:"100%", width:`${p}%`, background:col, borderRadius:99 }} />
                                </div>
                                <span style={{ fontSize:"0.66rem", fontWeight:700, color:"#6b7280", fontVariantNumeric:"tabular-nums", minWidth:26, textAlign:"right" }}>{p}%</span>
                              </div>
                            );
                          })()}
                        </td>
                        {(
                          <td className="num" style={{ fontSize:"0.82rem", fontWeight:700, color:"#2D2D2D" }}
                            onClick={e => { e.stopPropagation(); setEditValueId(l.id); setValueDraft(String(parseValue(l.value) || "")); }}>
                            {editValueId === l.id ? (
                              <input autoFocus type="number" value={valueDraft}
                                onChange={e => setValueDraft(e.target.value)}
                                onClick={e => e.stopPropagation()}
                                onBlur={() => commitValue(l)}
                                onKeyDown={e => { if (e.key === "Enter") commitValue(l); if (e.key === "Escape") setEditValueId(null); }}
                                style={{ width:"100%", textAlign:"right", border:"1px solid #003366", borderRadius:7, padding:"4px 7px", fontSize:"0.8rem", fontWeight:700, outline:"none", fontFamily:"inherit" }} />
                            ) : (
                              <span title="คลิกเพื่อแก้ไขมูลค่า" style={{ cursor:"text", borderBottom:"1px dashed #cbd5e1", paddingBottom:1 }}>{fmtVal(l.value)}</span>
                            )}
                          </td>
                        )}
                        <td>
                          <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                            <div style={{ width:26, height:26, borderRadius:"50%", background:"#003366",
                              display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                              <span style={{ color:"#fff", fontSize:"0.6rem", fontWeight:800 }}>{l.assigned.charAt(0)}</span>
                            </div>
                            <span style={{ fontSize:"0.75rem", color:"#374151" }}>{l.assigned}</span>
                          </div>
                        </td>
                        {!hiddenCols.includes("activity") && (
                          <td style={{ fontSize:"0.72rem", color:"#6b7280" }}>{lastActivity(l)}</td>
                        )}
                        {/* ── Row status: ลูกค้าแล้ว (WON) — งานทั้งหมดทำในโมดัล (คลิกแถว) ── */}
                        <td onClick={e => e.stopPropagation()}>
                          {done && l.status==="PAID" ? (
                            <span style={{ display:"inline-flex", alignItems:"center", gap:4,
                              fontSize:"0.65rem", fontWeight:700, color:"#059669" }}>
                              <CheckCircle2 size={11} /> ลูกค้าแล้ว
                            </span>
                          ) : (
                            <span style={{ fontSize:"0.7rem", color:"#c7ccd3" }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={9 - COLS.filter(c => hiddenCols.includes(c.key)).length} style={{ padding:"40px", textAlign:"center", color:"#374151", fontSize:"0.82rem" }}>
                      ไม่พบข้อมูล
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ padding:"11px 16px", borderTop:"1px solid #e5e7eb", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
              {/* Left: range summary */}
              <span style={{ fontSize:"0.73rem", color:"#374151" }}>
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
            const w = wide ? 286 : 240;
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
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <span style={{ fontSize:"0.8rem", fontWeight:800, color:"#2D2D2D" }}>{leadStatusLabel[status]}</span>
                    <span className="badge" style={{ background:sc.bg, color:sc.text }}>{col.length}</span>
                  </div>
                  {total > 0 && <div style={{ fontSize:"0.66rem", color:"#9ca3af", fontWeight:600, marginTop:3, fontVariantNumeric:"tabular-nums" }}>{fmtM(total)}</div>}
                </div>
                {/* cards */}
                <div style={{ display:"flex", flexDirection:"column", gap:10, minHeight:44 }}>
                  {col.map(l => (
                    <div key={l.id} draggable
                      onDragStart={e => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", l.id); setDragId(l.id); }}
                      onDragEnd={() => { setDragId(null); setDragOver(null); }}
                      onClick={() => openPanel(l)}
                      className="card"
                      style={{ padding:"12px 14px", cursor: dragId===l.id ? "grabbing" : "grab", userSelect:"none", borderRadius:10, opacity: dragId===l.id ? 0.4 : 1,
                        boxShadow:"0 1px 4px rgba(0,0,0,.05)", transition:"box-shadow .12s, transform .12s" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 14px rgba(0,51,102,.12)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 1px 4px rgba(0,0,0,.05)"; }}>
                      <div style={{ fontSize:"0.84rem", fontWeight:700, color:"#2D2D2D", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={l.company}>{l.company}</div>
                      <div style={{ fontSize:"0.7rem", color:"#6b7280", marginBottom:9 }}>{l.contact}</div>
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:9 }}>
                        <span style={{ fontSize:"0.88rem", fontWeight:800, color:"#003366", fontVariantNumeric:"tabular-nums" }}>{fmtVal(l.value)}</span>
                        <span style={{ width:24, height:24, borderRadius:"50%", background:"#003366", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.62rem", fontWeight:800, flexShrink:0 }} title={l.assigned}>{l.assigned.charAt(0)}</span>
                      </div>
                      {/* Progress */}
                      <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                        <div style={{ flex:1, height:5, background:"#eef2f7", borderRadius:99, overflow:"hidden" }}>
                          <div style={{ height:"100%", width:`${leadProg(l)}%`, background:"#003366", borderRadius:99 }} />
                        </div>
                        <span style={{ fontSize:"0.6rem", fontWeight:700, color:"#6b7280", fontVariantNumeric:"tabular-nums" }}>{leadProg(l)}%</span>
                      </div>
                    </div>
                  ))}
                  {col.length === 0 && (
                    <div style={{ textAlign:"center", padding:"16px 6px", fontSize:"0.68rem", color: isOver ? "#003366" : "#c7ccd3", border:`1.5px dashed ${isOver ? "#003366" : "#e5e7eb"}`, borderRadius:10 }}>วางการ์ดที่นี่</div>
                  )}
                </div>
              </div>
            );
          };
          return (
            <div style={{ display:"flex", gap:16, overflowX:"auto", paddingBottom:10, alignItems:"flex-start" }}>
              {ACTIVE.map(s => renderColumn(s, true))}
              {/* เส้นคั่นก่อนกลุ่มปิดการขาย (ปิดสำเร็จ/ไม่สำเร็จ) — หัวคอลัมน์ตรงแนวเดียวกัน */}
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
              <span style={{ fontSize:"0.88rem", fontWeight:700, color:"#2D2D2D" }}>{editPopupLabel}</span>
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
                  padding:"9px 12px", fontSize:"0.82rem", outline:"none", color:"#2D2D2D",
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
                  padding:"9px 12px", fontSize:"0.82rem", outline:"none", color:"#2D2D2D",
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
            const nid = Math.max(0, ...leadsData.map(x=>x.numId)) + 1;
            // สร้าง "รายงานการติดตาม" + "Report Checklist (Task)" อัตโนมัติทุกครั้งที่สร้าง Lead
            const withIds = { ...l, numId: nid, id: `#L-${40321 + nid}` };
            addLead({
              ...withIds,
              report: l.report || buildLeadReport(withIds, thaiDateStr(new Date())),
              // ดีลเลอร์สร้างลีดหลังติดต่อลูกค้าแล้ว → ติ๊กงานให้ถึงสถานะที่เลือก (เริ่มต้น "ติดต่อแล้ว" = ติ๊กติดต่อครั้งแรก/เก็บข้อมูล)
              tasks: l.tasks?.length ? l.tasks : seedLeadTasks(l.status, l.assigned || "—", 30),
            });
          }}
          persons={personsList}
        />
      )}

      {/* แก้ไขข้อมูลผู้สนใจทำได้ในแท็บ "ภาพรวม" ของโมดัลรายละเอียดโดยตรง (ไม่มีฟอร์มแก้ไขแยก) */}

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
            <p style={{ fontSize:"0.82rem", color:"#6b7280", lineHeight:1.6, margin:"0 0 20px" }}>
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
        const activities = c.activities ?? seedActivities(c);
        const drawerFiles = myFiles.length > 0 ? myFiles : seedFiles(c);
        // เป็นลูกค้าเมื่อปิดการขายสำเร็จ (WON) เท่านั้น — mock บางลีดมี customerId ผูกไว้แต่ยังไม่ WON จึงไม่นับ
        const isCustomer = c.status === "PAID";

        const detailTabs = [
          { key: "overview",   label: "ภาพรวม" },
          { key: "tasks",      label: "งาน/ความคืบหน้า" },
          { key: "report",     label: "รายงานติดตาม" },
          { key: "activities", label: "กิจกรรม" },
          { key: "quotation",  label: "ใบเสนอราคา" },
          { key: "files",      label: "ไฟล์" },
        ] as const;

        // ── Tab: งาน/ความคืบหน้า (Task-driven) — เช็กแล้วเลื่อน Stage อัตโนมัติ ──
        const tabTasks = (
          // ผู้ทำงาน = ผู้รับผิดชอบของลีดนั้น (ไม่ใช่บัญชีดีลเลอร์ที่ล็อกอิน)
          <LeadTasks lead={c} performedBy={c.assigned || session.name} onSave={saveLead} />
        );

        // ── Tab: รายงานการติดตาม (Lead Report) — แก้ไข/เพิ่ม/ลบได้ทั้งหมด ──
        const tabReport = (
          <ReportEditor lead={c} onSave={saveLead} />
        );

        // ── Tab: ภาพรวม (Overview) — แก้ไขข้อมูลได้ในตัว ──
        const tabOverview = (
          <OverviewEditor lead={c} persons={personsList} onSave={saveLead} />
        );

        // ── Tab: กิจกรรม (Activities) ──
        const tabActivities = (
          <DrawerSection title="กิจกรรม">
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {activities.map((a,i) => (
                <div key={i} style={{ display:"flex", gap:10, padding:"8px 10px", borderRadius:9,
                  background:"#f8f9fb", border:"1px solid #f0f4f8" }}>
                  <MessageSquare size={14} color="#003366" style={{ flexShrink:0, marginTop:2 }} />
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:"0.8rem", color:"#2D2D2D", fontWeight:600 }}>{a.text}</div>
                    <div style={{ fontSize:"0.68rem", color:"#6b7280", marginTop:2 }}>{a.date}</div>
                  </div>
                </div>
              ))}
            </div>
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
              <div style={{ color:"#9aa2ad", fontSize:"0.82rem", padding:"18px 0", textAlign:"center" }}>
                ยังไม่มีไฟล์แนบ
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                {drawerFiles.map(fname => (
                  <div key={fname} style={{ display:"flex", alignItems:"center", gap:8,
                    padding:"8px 10px", borderRadius:8, background:"#fafafa", border:"1px solid #f0f4f8" }}>
                    <Paperclip size={13} color="#C0C0C0" />
                    <span style={{ flex:1, fontSize:"0.78rem", color:"#2D2D2D", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{fname}</span>
                  </div>
                ))}
              </div>
            )}
            <button onClick={()=>fileInputRef.current?.click()}
              style={{ fontSize:"0.75rem", color:"#003366", background:"none", border:"none", cursor:"pointer", padding:0, marginTop:10 }}>
              + เพิ่มไฟล์แนบ
            </button>
          </DrawerSection>
        );

        return (
          <>
            {/* Backdrop */}
            <div onClick={closePanel} className="drawer-overlay"
              style={{ position:"fixed", inset:0, background:"rgba(45,45,45,.45)", zIndex:200 }} />

            {/* Centered modal — fixed height, internal scroll */}
            <div className="modal-pop" style={{ position:"fixed", top:"50%", left:"50%", transform:"translate(-50%,-50%)",
              width:820, maxWidth:"calc(100vw - 32px)", height:"min(720px, calc(100vh - 48px))",
              zIndex:210, background:"#fff", borderRadius:18, boxShadow:"0 24px 80px rgba(0,0,0,.28)",
              display:"flex", flexDirection:"column", overflow:"hidden" }}>

              {/* Navy header */}
              <div style={{ background:"#003366", padding:"16px 18px 12px", flexShrink:0 }}>
                <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:10 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{ width:44, height:44, borderRadius:13, background:"rgba(255,255,255,.18)",
                      display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", overflow:"hidden",
                      fontWeight:800, fontSize:"1rem", border:"2px solid rgba(255,255,255,.25)", flexShrink:0 }}>
                      {c.logo
                        ? <img src={c.logo} alt="โลโก้" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                        : cInitials}
                    </div>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontSize:"1.1rem", fontWeight:800, color:"#fff", lineHeight:1.2 }}>{c.company || c.name}</div>
                      <div style={{ fontSize:"0.8rem", color:"rgba(255,255,255,.7)", marginTop:3 }}>{c.contact} · {c.province}</div>
                    </div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
                    {isCustomer && (
                      <button title="ดูโปรไฟล์ลูกค้า"
                        onClick={()=>{ closePanel(); router.push(c.customerId ? `/customers?open=${c.customerId}` : "/customers"); }}
                        style={{ background:"rgba(255,255,255,.15)", border:"none", borderRadius:8, height:28, padding:"0 11px",
                          cursor:"pointer", color:"#fff", display:"flex", alignItems:"center", gap:5, fontSize:"0.7rem", fontWeight:600, fontFamily:"inherit" }}>
                        <CheckCircle2 size={13} /> ลูกค้า
                      </button>
                    )}
                    <button title="ลบลูกค้าเป้าหมาย" onClick={()=>setShowDeleteConfirm(true)}
                      style={{ background:"rgba(255,255,255,.15)", border:"none", borderRadius:8, width:28, height:28,
                        cursor:"pointer", color:"#fecaca", display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <Trash2 size={14} />
                    </button>
                    <button onClick={closePanel} title="ปิด"
                      style={{ background:"rgba(255,255,255,.15)", border:"none", borderRadius:8, width:28, height:28,
                        cursor:"pointer", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <X size={14} />
                    </button>
                  </div>
                </div>
                {/* Badge row: status · priority · source */}
                <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                  <span style={{ padding:"2px 10px", borderRadius:99, fontSize:"0.64rem", fontWeight:700,
                    background:sc.bg, color:sc.text }}>{leadStatusLabel[c.status]}</span>
                  <span style={{ padding:"2px 10px", borderRadius:99, fontSize:"0.64rem", fontWeight:700,
                    background:pc.bg, color:pc.text }}>{priorityLabel[pri]}</span>
                  {c.source && (
                    <span style={{ padding:"2px 10px", borderRadius:99, fontSize:"0.64rem", fontWeight:700,
                      background:"rgba(255,255,255,.18)", color:"#fff" }}>{c.source}</span>
                  )}
                </div>
              </div>

              {/* Tab bar */}
              <div className="tab-bar" style={{ flexShrink:0 }}>
                {detailTabs.map(t => (
                  <button key={t.key} className={`tab-item${activeTab===t.key?" active":""}`}
                    style={{ fontSize:"0.88rem", padding:"12px 16px" }}
                    onClick={()=>setActiveTab(t.key)}>
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Body — เต็มความกว้าง (ไม่มี rail ว่างด้านขวา) */}
              <div style={{ flex:1, minWidth:0, overflowY:"auto", padding:"18px 22px" }}>
                {activeTab==="overview"   && tabOverview}
                {activeTab==="tasks"      && tabTasks}
                {activeTab==="report"     && tabReport}
                {activeTab==="activities" && tabActivities}
                {activeTab==="quotation"  && tabQuotation}
                {activeTab==="files"      && tabFiles}
              </div>
            </div>
          </>
        );
      })()}

      {/* Success toast (Convert to Customer) */}
      {toast && (
        <div style={{ position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)",
          zIndex:300, display:"flex", alignItems:"center", gap:9,
          background:"#003366", color:"#fff", borderRadius:12, padding:"12px 18px",
          boxShadow:"0 10px 32px rgba(0,0,0,.25)", fontSize:"0.82rem", fontWeight:600,
          maxWidth:"calc(100vw - 32px)" }}>
          <CheckCircle2 size={17} color="#34d399" />
          <span>{toast}</span>
        </div>
      )}
    </>
  );
}

