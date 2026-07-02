"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  leadStatusLabel, leadStatusColor,
  responsiblePersons, RP_STORAGE_KEY,
  quotationStatusLabel, quotationStatusColor,
  solutionProducts,
  type LeadStatus, type LeadRow, type ResponsiblePerson, type QuotationMock,
} from "@/lib/mock";
import {
  Plus, Search, X, Phone, Mail,
  UserPlus, CheckCircle2, User, Tag, Calendar,
  MessageSquare, Paperclip, CheckSquare, Trash2, Bell,
  Check, ChevronDown, Zap, LayoutList, Columns3,
  ArrowUpDown, ArrowUp, ArrowDown, Filter, Globe,
  FileText,
} from "lucide-react";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { useSales } from "@/context/SalesContext";
import { DrawerSection, DrawerRow } from "@/components/ui/RightDrawer";
import { useTableLayout } from "@/components/ui/TableTools";
import { useFilters } from "@/context/FilterContext";

// ─── Design tokens ────────────────────────────────────────────────────────
const CARD: React.CSSProperties = {
  background: "#fff", borderRadius: 16,
  border: "1px solid #e5e7eb", boxShadow: "0 2px 14px rgba(0,0,0,.07)",
};

const ALL_STATUSES: LeadStatus[] = [
  "NEW","WAITING","BULLET","QUOTED","FOLLOWUP","NEGO","PAID","CANCELLED"
];
// ความคืบหน้าตามขั้นตอน (module-level เพื่อใช้ใน OverviewEditor) — PAID=100, CANCELLED=0
function leadProgressPct(status: LeadStatus): number {
  if (status === "PAID") return 100;
  if (status === "CANCELLED") return 0;
  const stages: LeadStatus[] = ["NEW","WAITING","BULLET","QUOTED","FOLLOWUP","NEGO"];
  const idx = stages.indexOf(status);
  if (idx < 0) return 0;
  return Math.round(((idx + 1) / (stages.length + 1)) * 100);
}
const DEFAULT_PERSONS = responsiblePersons.filter(p => p.active).map(p => p.name);
// Lead Source ตามสเปก: Facebook / Website / LINE / Walk-in / Referral / Exhibition / Other
const SOURCES = ["Facebook","เว็บไซต์","LINE","Walk-in","แนะนำต่อ","งานแสดงสินค้า","อื่นๆ"];
const PROVINCES = ["กรุงเทพฯ","เชียงใหม่","ระยอง","เชียงราย","นนทบุรี","สมุทรสาคร","นครสวรรค์","ราชบุรี","ขอนแก่น","อื่นๆ"];

// ─── Types ────────────────────────────────────────────────────────────────
type ChecklistItem = { id: string; text: string; done: boolean; locked?: boolean };

// รายการตรวจสอบพื้นฐาน (preset เริ่มต้น — ทุกลีดมีอัตโนมัติ แต่แก้/ลบ/เพิ่มได้ ไม่ล็อก)
// ข้อความตรงกับ DEFAULT_TASKS ใน SalesContext เพื่อให้ไหลไปเป็น tasks ของดีลตรงกัน
const BASE_CHECKLIST: ChecklistItem[] = [
  "ติดต่อลูกค้าและแนะนำตัว",
  "ส่งแคตตาล็อกและข้อมูลผลิตภัณฑ์",
  "นัดประชุมนำเสนอ",
  "สำรวจความต้องการลูกค้า",
  "จัดทำใบเสนอราคา",
  "ส่งใบเสนอราคาให้ลูกค้า",
  "ติดตามผลใบเสนอราคา",
].map((text, i) => ({ id: `base-${i}`, text, done: false }));
type SortKey = "company"|"value"|"status"|"assigned"|"priority";

// คอลัมน์ที่ซ่อน/แสดงได้ (optional) สำหรับ TableTools — key ตรงกับ th/td/col ในตาราง
const COLS: { key: string; label: string }[] = [
  { key: "source",   label: "แหล่งที่มา" },
  { key: "priority", label: "ความสำคัญ" },
  { key: "value",    label: "มูลค่า" },
];
type AddressData = {
  company: string; position: string; street: string;
  city: string; state: string; postalCode: string;
  country: string; website: string;
};

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

// ─── Next Follow-up Date (วันติดตามถัดไป) — deterministic per lead ────────────
// อ้างอิงฐานคงที่ + ออฟเซ็ตจาก numId (คงเดิมทุกครั้ง ไม่มีการสุ่ม)
const FOLLOWUP_BASE = Date.UTC(2026, 5, 1); // 2026-06-01
function leadFollowupDate(lead: LeadRow): string {
  const offsetDays = ((lead.numId * 7) % 60); // 0..59 วัน — deterministic
  const d = new Date(FOLLOWUP_BASE + offsetDays * 86400000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ─── Deterministic drawer seeds (no randomness) ───────────────────────────
// วันที่แบบคงที่จากฐาน + ออฟเซ็ตตาม numId → เดิมทุกครั้งที่เปิด
function seedDate(numId: number, offsetDays: number): string {
  const d = new Date(FOLLOWUP_BASE - offsetDays * 86400000 - (numId % 5) * 86400000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
// กิจกรรมย่อ (Activities) — deterministic ตามลีด
function seedActivities(lead: LeadRow): { date: string; text: string }[] {
  return [
    { date: seedDate(lead.numId, 2),  text: `โทรติดต่อ ${lead.contact} เพื่อแนะนำผลิตภัณฑ์` },
    { date: seedDate(lead.numId, 8),  text: `ส่งแคตตาล็อกและข้อมูล ${lead.product}` },
    { date: seedDate(lead.numId, 15), text: `บันทึกความสนใจจากแหล่งที่มา ${lead.source ?? "—"}` },
    { date: seedDate(lead.numId, 21), text: `สร้างผู้สนใจในระบบ (${lead.id})` },
  ];
}
// ประวัติสถานะ (History) — ไล่ตามลำดับขั้นตอนจนถึงสถานะปัจจุบัน (deterministic)
function seedStatusHistory(lead: LeadRow): { date: string; status: LeadStatus }[] {
  const stages: LeadStatus[] = ["NEW","WAITING","BULLET","QUOTED","FOLLOWUP","NEGO","PAID"];
  const endIdx = lead.status === "CANCELLED"
    ? 1
    : Math.max(0, stages.indexOf(lead.status));
  const seq = stages.slice(0, endIdx + 1);
  if (lead.status === "CANCELLED") seq.push("CANCELLED");
  return seq.map((status, i) => ({ date: seedDate(lead.numId, (seq.length - i) * 6), status }));
}
// รายการไฟล์เริ่มต้น (Files) — seed คงที่ (แสดง empty state เมื่อไม่มี)
function seedFiles(lead: LeadRow): string[] {
  return lead.numId % 3 === 0 ? [] : [`ใบเสนอราคา-${lead.id}.pdf`, `ข้อมูลสินค้า-${lead.product}.pdf`];
}

// ─── Sub-components ───────────────────────────────────────────────────────
function DetailRow({ icon, label, value, editing, inputValue, onEdit, type="text" }: {
  icon: React.ReactNode; label: string; value?: string;
  editing?: boolean; inputValue?: string; onEdit?: (v:string)=>void; type?: string;
}) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 12px",
      borderRadius:10, background:"#f8f9fb", border:"1px solid #f0f4f8" }}>
      <span style={{ color:"#374151", flexShrink:0, display:"flex" }}>{icon}</span>
      <span style={{ fontSize:"0.7rem", color:"#374151", minWidth:72, flexShrink:0 }}>{label}</span>
      {editing && onEdit
        ? <input type={type} value={inputValue??""} onChange={e=>onEdit(e.target.value)} autoFocus
            style={{ flex:1, border:"none", outline:"none", fontSize:"0.8rem", fontWeight:600, color:"#2D2D2D", background:"transparent" }} />
        : <span title={value} style={{ fontSize:"0.8rem", fontWeight:700, color:value?"#2D2D2D":"#C0C0C0", flex:1,
            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", minWidth:0 }}>{value||"—"}</span>
      }
    </div>
  );
}

function SortIcon({ field, sortKey, sortDir }: { field:string; sortKey:string; sortDir:"asc"|"desc" }) {
  if (sortKey !== field) return <ArrowUpDown size={11} color="#e5e7eb" />;
  return sortDir === "asc" ? <ArrowUp size={11} color="#003366" /> : <ArrowDown size={11} color="#003366" />;
}

// ─── ภาพรวม (แก้ไขในตัว) — ฟอร์มแก้ไขข้อมูลผู้สนใจในแท็บภาพรวมของโมดัลรายละเอียด ─────
function OverviewEditor({ lead, persons, onSave }: {
  lead: LeadRow; persons: string[]; onSave: (l: LeadRow) => void;
}) {
  const seed = () => ({
    company: lead.company ?? "", contact: lead.contact ?? "", phone: lead.phone ?? "",
    email: lead.email ?? "", province: lead.province ?? PROVINCES[0], source: lead.source ?? SOURCES[0],
    product: lead.product ?? solutionProducts[0].name, status: lead.status,
    assigned: lead.assigned ?? persons[0], value: lead.value ?? "",
    note: lead.note ?? "", logo: lead.logo ?? "",
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
    f.note !== (lead.note ?? "") || f.logo !== (lead.logo ?? "");
  const pct = leadProgressPct(f.status);

  const lbl: React.CSSProperties = { display:"block", fontSize:"0.68rem", fontWeight:700, color:"#6b7280", marginBottom:4 };
  const inp: React.CSSProperties = { width:"100%", padding:"8px 10px", borderRadius:8, border:"1px solid #e5e7eb", fontSize:"0.82rem", fontFamily:"inherit", color:"#2D2D2D", background:"#fff" };

  function save() { onSave({ ...lead, ...f, logo: f.logo || undefined, category: f.product, value: fmtVal(f.value) }); }

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
        <div><label style={lbl}>แม่แบบที่สนใจ</label>
          <select value={f.product} onChange={e=>set("product",e.target.value)} style={inp}>
            {!solutionProducts.some(p=>p.name===f.product) && <option value={f.product}>{f.product}</option>}
            {solutionProducts.map(p=><option key={p.id} value={p.name}>{p.name}</option>)}
          </select>
        </div>
        <div><label style={lbl}>มูลค่าประเมิน</label>
          <input value={f.value} onChange={e=>set("value",e.target.value)} onBlur={()=>{ if(f.value.trim()) set("value",fmtVal(f.value)); }} placeholder="เช่น 1200000 หรือ ฿1.2M" style={inp} />
        </div>
        <div><label style={lbl}>ขั้นตอน</label>
          <select value={f.status} onChange={e=>set("status",e.target.value as LeadStatus)} style={inp}>{ALL_STATUSES.map(s=><option key={s} value={s}>{leadStatusLabel[s]}</option>)}</select>
        </div>
        <div><label style={lbl}>ผู้รับผิดชอบ</label>
          <select value={f.assigned} onChange={e=>set("assigned",e.target.value)} style={inp}>{persons.map(t=><option key={t}>{t}</option>)}</select>
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
  const [form, setForm] = useState({
    company: initial?.company ?? "", contact: initial?.contact ?? "",
    phone: initial?.phone ?? "", email: initial?.email ?? "",
    province: initial?.province ?? "กรุงเทพฯ", product: initial?.product ?? solutionProducts[0].name,
    value: initial?.value ?? "", status: (initial?.status ?? "NEW") as LeadStatus,
    assigned: initial?.assigned ?? persons[0] ?? "สมชาย เชียงใหม่",
    source: initial?.source ?? "โทรเข้า", note: initial?.note ?? "",
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
      const rnd = Math.floor(Math.random()*900)+100;
      onSave({ id: "L-"+rnd, numId: rnd, ...base });
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
              <div style={{ fontSize:"1rem", fontWeight:800, color:"#fff" }}>{isEdit ? "แก้ไขผู้สนใจ" : "เพิ่มผู้สนใจใหม่"}</div>
              <div style={{ fontSize:"0.7rem", color:"#374151" }}>{isEdit ? `แก้ไขข้อมูล ${initial?.id}` : "กรอกข้อมูลผู้สนใจ"}</div>
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
                <label style={labelStyle}>แม่แบบที่สนใจ</label>
                <select value={form.product} onChange={e=>set("product",e.target.value)} style={inputStyle}>
                  {/* คงค่าที่มีอยู่เดิมไว้ถ้าไม่ตรงกับแคตตาล็อก (กันข้อมูลเก่าเพี้ยน) */}
                  {!solutionProducts.some(p=>p.name===form.product) && <option value={form.product}>{form.product}</option>}
                  {solutionProducts.map(p=>(
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
                <select value={form.assigned} onChange={e=>set("assigned",e.target.value)} style={inputStyle}>
                  {persons.map(t=><option key={t}>{t}</option>)}
                </select>
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

// ─── KANBAN CARD ──────────────────────────────────────────────────────────
function KanbanCard({ lead, onClick, isDragging, onDragStart, onDragEnd }: {
  lead: LeadRow; onClick: ()=>void;
  isDragging?: boolean; onDragStart?: ()=>void; onDragEnd?: ()=>void;
}) {
  return (
    <div
      draggable
      onClick={onClick}
      onDragStart={e => { e.dataTransfer.effectAllowed = "move"; onDragStart?.(); }}
      onDragEnd={() => onDragEnd?.()}
      style={{ ...CARD, padding:"12px 14px", cursor:"grab", borderRadius:12,
        boxShadow: isDragging ? "0 8px 24px rgba(0,0,0,.22)" : "0 1px 6px rgba(0,0,0,.06)",
        opacity: isDragging ? 0.5 : 1,
        transform: isDragging ? "rotate(2deg) scale(1.02)" : "none",
        transition:"box-shadow .15s, opacity .15s, transform .15s" }}
      onMouseEnter={e=>{ if(!isDragging)(e.currentTarget as HTMLElement).style.boxShadow="0 4px 16px rgba(0,0,0,.13)"; }}
      onMouseLeave={e=>{ if(!isDragging)(e.currentTarget as HTMLElement).style.boxShadow="0 1px 6px rgba(0,0,0,.06)"; }}>
      <div style={{ fontSize:"0.82rem", fontWeight:700, color:"#2D2D2D", marginBottom:3 }}>{lead.company}</div>
      <div style={{ fontSize:"0.7rem", color:"#374151", marginBottom:10 }}>{lead.contact}</div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <span style={{ padding:"3px 9px", borderRadius:99, fontSize:"0.65rem", fontWeight:700,
          background:"#dce5f0", color:"#003366" }}>{lead.product}</span>
        <span style={{ fontSize:"0.78rem", fontWeight:800, color:"#003366" }}>{fmtVal(lead.value)}</span>
      </div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:10 }}>
        <span style={{ fontSize:"0.65rem", color:"#374151" }}>{lead.province}</span>
        <div style={{ width:26, height:26, borderRadius:"50%", background:"#003366",
          display:"flex", alignItems:"center", justifyContent:"center" }}>
          <span style={{ color:"#374151", fontSize:"0.6rem", fontWeight:800 }}>{lead.assigned.charAt(0)}</span>
        </div>
      </div>
      {/* Link chip */}
      <div style={{ marginTop:8, textAlign:"right" }}>
        <span style={{ fontSize:"0.62rem", color:"#003366", fontWeight:700, opacity:0.6 }}>คลิกเพื่อดูรายละเอียด</span>
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────
export default function LeadsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // List state
  const {
    leads: leadsData, addLead, updateLead, deleteLead: removeLead, updateLeadStatus, openDealFromLead,
    quotations, convertLeadToCustomer, addQuotation,
  } = useSales();
  // Global Responsible Person filter (FilterBar dim "person")
  const { person } = useFilters();
  // Table toolbar: density + column show/hide (localStorage-backed)
  const { density, setDensity, hiddenCols, toggleCol } = useTableLayout("leads");
  const [view, setView] = useState<"list"|"kanban">("list");
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
  const [converted, setConverted] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"overview"|"activities"|"quotation"|"files">("overview");
  const [editingField, setEditingField] = useState<string|null>(null);
  const [draft, setDraft] = useState<LeadRow|null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Checklist
  const [checklists, setChecklists] = useState<Record<string,ChecklistItem[]>>({});
  const [showChecklistInput, setShowChecklistInput] = useState(false);
  const [newCheckText, setNewCheckText] = useState("");

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

  // Assignees
  const [leadAssignees, setLeadAssignees] = useState<Record<string,string[]>>({});
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);

  // Address data per lead
  const [leadAddresses, setLeadAddresses] = useState<Record<string, Partial<AddressData>>>({});
  const [editingAddress, setEditingAddress] = useState(false);
  const [addressDraft, setAddressDraft] = useState<Partial<AddressData>>({});

  function getAddress(leadId: string, lead: LeadRow): AddressData {
    const s = leadAddresses[leadId] ?? {};
    return {
      company: s.company ?? lead.company ?? "",
      position: s.position ?? lead.contact ?? "",
      street: s.street ?? "",
      city: s.city ?? "",
      state: s.state ?? lead.province ?? "",
      postalCode: s.postalCode ?? "",
      country: s.country ?? "ไทย",
      website: s.website ?? "",
    };
  }
  function saveAddress() {
    if (!lid) return;
    setLeadAddresses(prev => ({ ...prev, [lid]: addressDraft }));
    setEditingAddress(false);
  }

  // Kanban drag state
  const [dragLeadId, setDragLeadId] = useState<string|null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<LeadStatus|null>(null);

  // Inline status dropdown (table view)
  const [openStatusId, setOpenStatusId] = useState<string|null>(null);

  // Inline convert menu (table view) + success toast
  const [openConvertId, setOpenConvertId] = useState<string|null>(null);
  const [toast, setToast] = useState<string|null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  // Reminder
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [reminderDate, setReminderDate] = useState("");
  const [reminderNote, setReminderNote] = useState("");
  const [reminders, setReminders] = useState<Record<string,{date:string;note:string}>>({});

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
      const matchPerson = person === "all" || l.assigned === person;
      const matchA = !fAssignee || l.assigned === fAssignee;
      const matchP = !fProvince || l.province === fProvince;
      const matchSrc = !fSource || (l.source ?? "") === fSource;
      const matchPri = !fPriority || leadPriority(l) === fPriority;
      const val = parseValue(l.value);
      const matchMin = !fValueMin || val >= parseFloat(fValueMin.replace(/[฿,M]/g,""))*1e6;
      const matchMax = !fValueMax || val <= parseFloat(fValueMax.replace(/[฿,M]/g,""))*1e6;
      return matchQ && matchS && matchPerson && matchA && matchP && matchSrc && matchPri && matchMin && matchMax;
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
  }, [leadsData, query, filterStatus, person, fAssignee, fProvince, fSource, fPriority, fValueMin, fValueMax, sortKey, sortDir]);

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
  const wonLeads = leadsData.filter(l => l.status === "PAID").length;
  const nonLost = leadsData.filter(l => l.status !== "CANCELLED").length;
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
    setShowAssigneePicker(false);
    setShowReminderForm(false); setShowChecklistInput(false);
    setActiveTab("overview");
    setPopupField(null); setEditPopupPos(null);
    setShowStatusDropdown(false);
    setEditingAddress(false);
  }
  function closePanel() {
    setSelectedLead(null); setDraft(null);
    setEditingField(null); setShowDeleteConfirm(false);
    setShowAssigneePicker(false);
    setShowReminderForm(false); setShowChecklistInput(false);
    setPopupField(null); setEditPopupPos(null);
    setShowStatusDropdown(false);
    setEditingAddress(false);
  }
  function commitDraft() {
    if (!draft) return;
    updateLead(draft);
    setSelectedLead(draft); setEditingField(null);
  }
  function patchDraft(field: string, value: string) {
    setDraft(prev => prev ? {...prev, [field]: value} : prev);
  }
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

  // ── Convert actions (per spec) ─────────────────────────────────────────
  // เปิดเป็นดีล: สร้างดีลใน pipeline จากลีด แล้วไปหน้า Pipeline
  function convertToDeal(lead: LeadRow) {
    openDealFromLead(lead);
    setOpenConvertId(null);
    closePanel();
    router.push("/pipeline");
  }
  // เพิ่มเป็นลูกค้า: สร้างลูกค้าจริงใน context แล้วไปหน้าโปรไฟล์ลูกค้า
  function convertToCustomer(lead: LeadRow) {
    // เปลี่ยนลีดเป็นลูกค้า (removeLead=true) → ลีดออกจากรายการผู้สนใจ
    const newCustomer = convertLeadToCustomer(lead, true);
    setConverted(p => new Set([...p, lead.id]));
    setOpenConvertId(null);
    closePanel();
    router.push(`/customers/${newCustomer.id}`);
  }
  // สร้างใบเสนอราคา (ร่าง) จากลีด — แปลง/หาลูกค้าให้ก่อน แล้ว prefill ลูกค้า+มูลค่าประเมิน
  function createQuotationFromLead(lead: LeadRow) {
    const customer = convertLeadToCustomer(lead);
    const est = parseValue(lead.value);
    const nums = quotations.map(q => parseInt(q.id.split("-")[2] ?? "") || 0);
    const newId = `Q-2026-${String(Math.max(...nums, 100) + 1).padStart(4, "0")}`;
    const newQ: QuotationMock = {
      id: newId,
      customer: customer.company,
      project: `${lead.product} — ${lead.company}`,
      total: "฿" + est.toLocaleString("th-TH"),
      totalValue: est,
      materialCost: est,
      province: lead.province,
      buildingType: "โกดังสินค้า",
      area: 0,
      status: "draft",
      date: "2026-06-30",
      items: 0,
      customerId: customer.id,
      projectId: 0,
      revision: "V1",
      expiry: "",
    };
    addQuotation(newQ);
    setConverted(p => new Set([...p, lead.id]));
    setOpenConvertId(null);
    closePanel();
    router.push("/quotations");
  }

  // ความคืบหน้า (Progress) จากลำดับขั้นตอน — PAID=100%, CANCELLED=0% (ใช้ใน drawer)
  function leadProgress(status: LeadStatus): number {
    if (status === "PAID") return 100;
    if (status === "CANCELLED") return 0;
    const stages: LeadStatus[] = ["NEW","WAITING","BULLET","QUOTED","FOLLOWUP","NEGO"];
    const idx = stages.indexOf(status);
    if (idx < 0) return 0;
    return Math.round(((idx + 1) / (stages.length + 1)) * 100);
  }

  // Checklist
  const items: ChecklistItem[] = checklists[lid] ?? BASE_CHECKLIST;
  const doneCount = items.filter(i=>i.done).length;
  function addChecklistItem() {
    if (!newCheckText.trim() || !lid) return;
    setChecklists(p=>({...p,[lid]:[...(p[lid]??BASE_CHECKLIST),{id:Math.random().toString(36).slice(2),text:newCheckText.trim(),done:false}]}));
    setNewCheckText(""); setShowChecklistInput(false);
  }
  function toggleChecklistItem(id:string) {
    setChecklists(p=>({...p,[lid]:(p[lid]??BASE_CHECKLIST).map(i=>i.id===id?{...i,done:!i.done}:i)}));
  }
  function deleteChecklistItem(id:string) {
    setChecklists(p=>({...p,[lid]:(p[lid]??BASE_CHECKLIST).filter(i=>i.id!==id)}));
  }

  // Files
  const myFiles: string[] = leadFiles[lid] ?? [];
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f || !lid) return;
    setLeadFiles(p=>({...p,[lid]:[...(p[lid]??BASE_CHECKLIST),f.name]}));
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

  // Assignees
  function getAssignees(): string[] { return leadAssignees[lid] ?? (current?[current.assigned]:[]); }
  function toggleAssignee(name:string) {
    const cur=getAssignees();
    const next=cur.includes(name)?cur.filter(n=>n!==name):[...cur,name];
    setLeadAssignees(p=>({...p,[lid]:next}));
    if (draft) setDraft({...draft,assigned:next[0]??draft.assigned});
  }

  // Reminder
  const myReminder = reminders[lid];
  function saveReminder() {
    if (!reminderDate||!lid) return;
    setReminders(p=>({...p,[lid]:{date:reminderDate,note:reminderNote}}));
    setShowReminderForm(false);
  }

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
            <h2>ผู้สนใจ</h2>
            <p>อัตราปิดการขาย {winRate}%</p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {/* Global Responsible Person filter (ผู้รับผิดชอบ) */}
            <ExportMenu filename="leads" title="รายชื่อผู้สนใจ"
              headers={["รหัส","ชื่อ","ผู้ติดต่อ","จังหวัด","สินค้า","ความสำคัญ","สถานะ","วันติดตามถัดไป","มูลค่า","ผู้รับผิดชอบ"]}
              rows={filtered.map(l=>[l.id,l.name,l.contact,l.province,l.product,priorityLabel[leadPriority(l)],leadStatusLabel[l.status],leadFollowupDate(l),fmtVal(l.value),l.assigned])} />
            <button onClick={() => setShowAddForm(true)} className="btn btn-primary btn-md">
              <Plus size={15} /> เพิ่มผู้สนใจ
            </button>
          </div>
        </div>

        {/* สรุปรวม (ไม่ซ้ำกับ funnel ด้านล่าง — funnel คุมการนับ/กรองตามสถานะ) */}
        <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap", marginBottom:14 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:"0.78rem", fontWeight:700,
            background:"#fff", border:"1px solid #e5e7eb", borderRadius:99, padding:"7px 16px" }}>
            ผู้สนใจทั้งหมด: <span style={{ color:"#003366" }}>{leadsData.length}</span>
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
            {/* Search */}
            <div style={{ display:"flex", alignItems:"center", gap:8, background:"#fafafa",
              border:"1px solid #e5e7eb", borderRadius:10, padding:"8px 12px", minWidth:240, flex:1, maxWidth:320 }}>
              <Search size={13} color="#6b7280" />
              <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="ค้นหาบริษัท ผู้ติดต่อ..."
                style={{ border:"none", outline:"none", fontSize:"0.8rem", color:"#2D2D2D", background:"transparent", flex:1 }} />
              {query && <button onClick={()=>setQuery("")}
                style={{ background:"none", border:"none", cursor:"pointer", color:"#374151", padding:0, display:"flex" }}>
                <X size={13}/>
              </button>}
            </div>

            {/* Filter toggle */}
            <button onClick={()=>setShowFilters(p=>!p)}
              style={{ display:"flex", alignItems:"center", gap:6, background:showFilters||hasActiveFilters?"#003366":"#fff",
                border:`1px solid ${showFilters||hasActiveFilters?"#003366":"#e5e7eb"}`,
                borderRadius:10, padding:"8px 13px", fontSize:"0.77rem", fontWeight:600,
                color:showFilters||hasActiveFilters?"#fff":"#6b7280", cursor:"pointer" }}>
              <Filter size={13} />
              ตัวกรอง {hasActiveFilters && <span style={{ background:"rgba(255,255,255,.3)", borderRadius:99, padding:"0 5px", fontSize:"0.65rem" }}>เปิด</span>}
            </button>

            <div style={{ flex:1 }} />
            {/* หน้าผู้สนใจแสดงเป็นตารางอย่างเดียว — มุมมองคัมบัง (ลากขั้น) อยู่ที่หน้า "เส้นทางการขาย" */}
          </div>

          {/* Advanced filters panel */}
          {showFilters && (
            <div style={{ marginTop:12, paddingTop:12, borderTop:"1px solid #f0f4f8",
              display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:8 }}>
              <div>
                <div style={{ fontSize:"0.65rem", fontWeight:700, color:"#374151", marginBottom:4 }}>ผู้รับผิดชอบ</div>
                <select value={fAssignee} onChange={e=>setFAssignee(e.target.value)}
                  style={{ width:"100%", border:"1px solid #e5e7eb", borderRadius:8,
                    padding:"7px 10px", fontSize:"0.78rem", outline:"none", color:"#2D2D2D" }}>
                  <option value="">ทั้งหมด</option>
                  {personsList.map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize:"0.65rem", fontWeight:700, color:"#374151", marginBottom:4 }}>จังหวัด</div>
                <select value={fProvince} onChange={e=>setFProvince(e.target.value)}
                  style={{ width:"100%", border:"1px solid #e5e7eb", borderRadius:8,
                    padding:"7px 10px", fontSize:"0.78rem", outline:"none", color:"#2D2D2D" }}>
                  <option value="">ทั้งหมด</option>
                  {PROVINCES.map(p=><option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize:"0.65rem", fontWeight:700, color:"#374151", marginBottom:4 }}>แหล่งที่มา</div>
                <select value={fSource} onChange={e=>setFSource(e.target.value)}
                  style={{ width:"100%", border:"1px solid #e5e7eb", borderRadius:8,
                    padding:"7px 10px", fontSize:"0.78rem", outline:"none", color:"#2D2D2D" }}>
                  <option value="">ทั้งหมด</option>
                  {SOURCES.map(s=><option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize:"0.65rem", fontWeight:700, color:"#374151", marginBottom:4 }}>ความสำคัญ</div>
                <select value={fPriority} onChange={e=>setFPriority(e.target.value as Priority|"")}
                  style={{ width:"100%", border:"1px solid #e5e7eb", borderRadius:8,
                    padding:"7px 10px", fontSize:"0.78rem", outline:"none", color:"#2D2D2D" }}>
                  <option value="">ทั้งหมด</option>
                  {PRIORITIES.map(p=><option key={p} value={p}>{priorityLabel[p]}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize:"0.65rem", fontWeight:700, color:"#374151", marginBottom:4 }}>มูลค่าขั้นต่ำ (M฿)</div>
                <input value={fValueMin} onChange={e=>setFValueMin(e.target.value)}
                  placeholder="เช่น 1" type="number"
                  style={{ width:"100%", border:"1px solid #e5e7eb", borderRadius:8,
                    padding:"7px 10px", fontSize:"0.78rem", outline:"none", color:"#2D2D2D" }} />
              </div>
              <div>
                <div style={{ fontSize:"0.65rem", fontWeight:700, color:"#374151", marginBottom:4 }}>มูลค่าสูงสุด (M฿)</div>
                <input value={fValueMax} onChange={e=>setFValueMax(e.target.value)}
                  placeholder="เช่น 5" type="number"
                  style={{ width:"100%", border:"1px solid #e5e7eb", borderRadius:8,
                    padding:"7px 10px", fontSize:"0.78rem", outline:"none", color:"#2D2D2D" }} />
              </div>
              {hasActiveFilters && (
                <div style={{ display:"flex", alignItems:"flex-end" }}>
                  <button onClick={()=>{ setFAssignee(""); setFProvince(""); setFSource(""); setFPriority(""); setFValueMin(""); setFValueMax(""); }}
                    style={{ width:"100%", padding:"7px 10px", borderRadius:8, border:"1px solid #fca5a5",
                      background:"#fee2e2", color:"#dc2626", fontSize:"0.73rem", fontWeight:600, cursor:"pointer" }}>
                    ล้างทั้งหมด
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── LIST VIEW ── */}
        {view === "list" && (
          <div className="card">
            <div className={`table-wrap${density === "compact" ? " dense" : ""}`}>
              <table>
                <colgroup>
                  <col style={{width:"24%"}} />
                  {!hiddenCols.includes("source")   && <col style={{width:"13%"}} />}
                  <col style={{width:"17%"}} />
                  {!hiddenCols.includes("priority") && <col style={{width:"11%"}} />}
                  {!hiddenCols.includes("value")    && <col style={{width:"12%"}} />}
                  <col style={{width:"11%"}} />
                  <col style={{width:"12%"}} />
                </colgroup>
                <thead>
                  <tr>
                    {([
                      ["company","บริษัท / ผู้ติดต่อ",null],
                      [null,"แหล่งที่มา","source"],
                      ["status","ขั้นตอน",null],
                      ["priority","ความสำคัญ","priority"],
                      ["value","มูลค่า","value"],
                      ["assigned","ผู้รับผิดชอบ",null],
                      [null,"",null],
                    ] as [SortKey|null,string,string|null][])
                      .filter(([,,colKey]) => !colKey || !hiddenCols.includes(colKey))
                      .map(([key,label])=>(
                      <th key={label || "actions"} style={key ? { cursor:"pointer", userSelect:"none" } : undefined}
                        onClick={key ? ()=>onSort(key) : undefined}>
                        <span style={{ display:"flex", alignItems:"center", gap:4 }}>
                          {label} {key && <SortIcon field={key} sortKey={sortKey} sortDir={sortDir} />}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paged.map(l => {
                    const sc = leadStatusColor[l.status];
                    const done = converted.has(l.id) || !!l.customerId;
                    const isSel = selectedLead?.id === l.id;
                    return (
                      <tr key={l.id} onClick={()=>openPanel(l)} className="clickable"
                        style={{ background:isSel?"#f0f4f8":undefined }}>
                        <td style={{ minWidth:0 }}>
                          <div style={{ fontSize:"0.84rem", fontWeight:700, color:"#2D2D2D", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={l.company}>{l.company}</div>
                          <div style={{ fontSize:"0.68rem", color:"#374151", marginTop:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={l.contact}>{l.contact}</div>
                        </td>
                        {!hiddenCols.includes("source") && (
                          <td style={{ fontSize:"0.75rem", color:"#374151" }}>{l.source || "—"}</td>
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
                        {!hiddenCols.includes("priority") && (
                          <td>
                            {(() => {
                              const pri = leadPriority(l);
                              const pc = priorityColor[pri];
                              return (
                                <span className="badge" style={{ background:pc.bg, color:pc.text }}>
                                  {priorityLabel[pri]}
                                </span>
                              );
                            })()}
                          </td>
                        )}
                        {!hiddenCols.includes("value") && (
                          <td className="num" style={{ fontSize:"0.82rem", fontWeight:700, color:"#2D2D2D" }}>{fmtVal(l.value)}</td>
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
                        {/* ── Row actions: แปลง ▾ menu (Convert to Deal / Customer) + View ── */}
                        <td className="ovf-visible" onClick={e => e.stopPropagation()} style={{ position:"relative" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                            {done && l.status==="PAID" ? (
                              <span style={{ display:"inline-flex", alignItems:"center", gap:4,
                                fontSize:"0.65rem", fontWeight:700, color:"#059669" }}>
                                <CheckCircle2 size={11} /> ลูกค้าแล้ว
                              </span>
                            ) : (
                              <button
                                onClick={e => { e.stopPropagation(); setOpenConvertId(openConvertId === l.id ? null : l.id); }}
                                className="badge"
                                style={{ background:"#dce5f0", color:"#003366", border:"none", cursor:"pointer",
                                  display:"inline-flex", alignItems:"center", gap:3 }}>
                                แปลง <ChevronDown size={11} />
                              </button>
                            )}
                          </div>
                          {openConvertId === l.id && (
                            <>
                              <div onClick={e => { e.stopPropagation(); setOpenConvertId(null); }}
                                style={{ position:"fixed", inset:0, zIndex:19 }}/>
                              <div style={{ position:"absolute", top:"calc(100% - 4px)", right:10, zIndex:20,
                                background:"#fff", border:"1px solid #e5e7eb", borderRadius:12,
                                boxShadow:"0 8px 24px rgba(0,0,0,.14)", minWidth:190, overflow:"hidden" }}>
                                <button
                                  onClick={e => { e.stopPropagation(); convertToDeal(l); }}
                                  style={{ display:"flex", alignItems:"center", gap:8, width:"100%", padding:"9px 14px",
                                    border:"none", background:"transparent", cursor:"pointer", textAlign:"left" }}
                                  onMouseEnter={e=>(e.currentTarget.style.background="#f0f4f8")}
                                  onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                                  <Zap size={13} color="#003366" />
                                  <span style={{ fontSize:"0.78rem", fontWeight:600, color:"#003366" }}>เปิดเป็นดีล</span>
                                </button>
                                <button
                                  onClick={e => { e.stopPropagation(); convertToCustomer(l); }}
                                  style={{ display:"flex", alignItems:"center", gap:8, width:"100%", padding:"9px 14px",
                                    border:"none", borderTop:"1px solid #f0f4f8", background:"transparent", cursor:"pointer", textAlign:"left" }}
                                  onMouseEnter={e=>(e.currentTarget.style.background="#e5faf0")}
                                  onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                                  <CheckCircle2 size={13} color="#059669" />
                                  <span style={{ fontSize:"0.78rem", fontWeight:600, color:"#059669" }}>เพิ่มเป็นลูกค้า</span>
                                </button>
                              </div>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={7 - COLS.filter(c => hiddenCols.includes(c.key)).length} style={{ padding:"40px", textAlign:"center", color:"#374151", fontSize:"0.82rem" }}>
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
          onSave={addLead}
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
              <div style={{ fontSize:"1rem", fontWeight:800, color:"#2D2D2D" }}>ลบผู้สนใจ</div>
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
        const relatedQuotes = c.customerId != null
          ? quotations.filter(q => q.customerId === c.customerId)
          : [];
        const activities = seedActivities(c);
        const drawerFiles = myFiles.length > 0 ? myFiles : seedFiles(c);
        const isCustomer = converted.has(c.id) || c.status === "PAID" || !!c.customerId;

        const detailTabs = [
          { key: "overview",   label: "ภาพรวม" },
          { key: "activities", label: "กิจกรรม" },
          { key: "quotation",  label: "ใบเสนอราคา" },
          { key: "files",      label: "ไฟล์" },
        ] as const;

        // ── Tab: ภาพรวม (Overview) — แก้ไขข้อมูลได้ในตัว ──
        const tabOverview = (
          <OverviewEditor lead={c} persons={personsList} onSave={updateLead} />
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
        const tabQuotation = (
          <DrawerSection title="ใบเสนอราคา">
            {relatedQuotes.length === 0 ? (
              <div style={{ color:"#9aa2ad", fontSize:"0.82rem", padding:"18px 0", textAlign:"center" }}>
                ยังไม่มีใบเสนอราคา
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {relatedQuotes.map(q => {
                  const qc = quotationStatusColor[q.status];
                  return (
                    <div key={q.id} onClick={()=>{ closePanel(); router.push("/quotations"); }}
                      style={{ padding:"10px 12px", borderRadius:10, background:"#f8f9fb",
                        border:"1px solid #f0f4f8", cursor:"pointer" }}>
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
                        <span style={{ fontSize:"0.78rem", fontWeight:700, color:"#2D2D2D" }}>{q.id}</span>
                        <span style={{ padding:"2px 9px", borderRadius:99, fontSize:"0.66rem", fontWeight:700,
                          background:qc.bg, color:qc.text }}>{quotationStatusLabel[q.status]}</span>
                      </div>
                      <div style={{ fontSize:"0.7rem", color:"#6b7280", marginTop:3 }}>{q.project}</div>
                      <div style={{ display:"flex", justifyContent:"space-between", marginTop:5 }}>
                        <span style={{ fontSize:"0.68rem", color:"#6b7280" }}>{q.date}</span>
                        <span style={{ fontSize:"0.76rem", fontWeight:700, color:"#003366" }}>{q.total}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
            <div onClick={closePanel}
              style={{ position:"fixed", inset:0, background:"rgba(45,45,45,.45)", zIndex:200 }} />

            {/* Centered container — fixed height, internal scroll */}
            <div style={{ position:"fixed", top:"50%", left:"50%", transform:"translate(-50%,-50%)",
              width:760, maxWidth:"calc(100vw - 32px)", height:"min(660px, calc(100vh - 48px))",
              zIndex:210, background:"#fff", borderRadius:18, boxShadow:"0 24px 80px rgba(0,0,0,.22)",
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
                      <div style={{ fontSize:"0.92rem", fontWeight:800, color:"#fff", lineHeight:1.2 }}>{c.company || c.name}</div>
                      <div style={{ fontSize:"0.68rem", color:"rgba(255,255,255,.65)", marginTop:2 }}>{c.contact} · {c.province}</div>
                    </div>
                  </div>
                  <button onClick={closePanel}
                    style={{ background:"rgba(255,255,255,.15)", border:"none", borderRadius:8, width:28, height:28,
                      cursor:"pointer", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    <X size={14} />
                  </button>
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
                    onClick={()=>setActiveTab(t.key)}>
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Two-column body */}
              <div style={{ display:"flex", flex:1, overflow:"hidden" }}>
                {/* Left: active tab content */}
                <div style={{ flex:1, minWidth:0, overflowY:"auto", borderRight:"1px solid #f0f4f8", padding:"16px 20px" }}>
                  {activeTab==="overview"   && tabOverview}
                  {activeTab==="activities" && tabActivities}
                  {activeTab==="quotation"  && tabQuotation}
                  {activeTab==="files"      && tabFiles}
                </div>

                {/* Right: action rail */}
                <div style={{ width:210, flexShrink:0, padding:16, display:"flex", flexDirection:"column",
                  gap:8, overflowY:"auto" }}>
                  {c.status !== "PAID" && c.status !== "CANCELLED" && (
                    <button className="btn btn-secondary btn-sm" onClick={()=>convertToDeal(c)}
                      style={{ justifyContent:"center" }}>
                      <Zap size={13} /> เปิดเป็นดีล
                    </button>
                  )}
                  <button className="btn btn-secondary btn-sm" onClick={()=>createQuotationFromLead(c)}
                    style={{ justifyContent:"center" }}>
                    <FileText size={13} /> สร้างใบเสนอราคา
                  </button>
                  {isCustomer ? (
                    <button className="btn btn-tint btn-sm"
                      onClick={()=>{ closePanel(); router.push(c.customerId ? `/customers/${c.customerId}` : "/customers"); }}
                      style={{ justifyContent:"center" }}>
                      <CheckCircle2 size={13} /> ลูกค้าแล้ว
                    </button>
                  ) : (
                    <button className="btn btn-tint btn-sm" onClick={()=>convertToCustomer(c)}
                      style={{ justifyContent:"center" }}>
                      <CheckCircle2 size={13} /> เพิ่มเป็นลูกค้า
                    </button>
                  )}
                  <div style={{ flex:1 }} />
                  {/* Destructive action pinned to bottom */}
                  <button className="btn btn-danger btn-sm" onClick={()=>setShowDeleteConfirm(true)}
                    style={{ justifyContent:"center" }}>
                    <Trash2 size={13} /> ลบ
                  </button>
                </div>
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

