"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  leads as initialLeads, leadStatusLabel, leadStatusColor,
  responsiblePersons, RP_STORAGE_KEY,
  type LeadStatus, type LeadRow, type ResponsiblePerson,
} from "@/lib/mock";
import {
  Plus, Search, X, Phone, Mail,
  UserPlus, CheckCircle2, User, Tag, Calendar,
  MessageSquare, Paperclip, CheckSquare, Trash2, Bell,
  Check, ChevronDown, Zap, LayoutList, Columns3,
  ArrowUpDown, ArrowUp, ArrowDown, Filter, Globe,
} from "lucide-react";

// ─── Design tokens ────────────────────────────────────────────────────────
const CARD: React.CSSProperties = {
  background: "#fff", borderRadius: 16,
  border: "1px solid #e5e7eb", boxShadow: "0 2px 14px rgba(0,0,0,.07)",
};

const ALL_STATUSES: LeadStatus[] = [
  "NEW","WAITING","BULLET","QUOTED","PAID","CANCELLED"
];
const DEFAULT_PERSONS = responsiblePersons.filter(p => p.active).map(p => p.name);
const SOURCES = ["โทรเข้า","เว็บไซต์","อ้างอิง","งานแสดง","Social Media","Line","อื่นๆ"];
const PROVINCES = ["กรุงเทพฯ","เชียงใหม่","ระยอง","เชียงราย","นนทบุรี","สมุทรสาคร","นครสวรรค์","ราชบุรี","ขอนแก่น","อื่นๆ"];
const AVAILABLE_TAGS = ["VIP","ลูกค้าประจำ","ติดตามด่วน","โอกาสการขายใหญ่","รอเสนอราคา","ส่งใบเสนอแล้ว"];
const TAG_COLORS: Record<string,string> = {
  "VIP":"#f59e0b","ลูกค้าประจำ":"#059669","ติดตามด่วน":"#dc2626",
  "โอกาสการขายใหญ่":"#003366","รอเสนอราคา":"#6b7280","ส่งใบเสนอแล้ว":"#003366",
};

// ─── Types ────────────────────────────────────────────────────────────────
type ChecklistItem = { id: string; text: string; done: boolean };
type SortKey = "id"|"company"|"value"|"status"|"province"|"assigned";
type AddressData = {
  company: string; position: string; street: string;
  city: string; state: string; postalCode: string;
  country: string; website: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────
function parseValue(v: string) {
  const n = parseFloat(v.replace(/[฿,]/g,""));
  return v.includes("M") ? n*1e6 : v.includes("K") ? n*1e3 : n;
}
function fmtM(n: number) {
  if (n >= 1e6) return "฿"+(n/1e6).toFixed(1)+"M";
  if (n >= 1e3) return "฿"+(n/1e3).toFixed(0)+"K";
  return "฿"+n.toLocaleString();
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

// ─── ADD LEAD FORM ────────────────────────────────────────────────────────
function AddLeadModal({ onClose, onAdd, persons }: { onClose:()=>void; onAdd:(l:LeadRow)=>void; persons:string[] }) {
  const [form, setForm] = useState({
    company:"", contact:"", phone:"", email:"",
    province:"กรุงเทพฯ", product:"โกดังสินค้า",
    value:"฿1.2M", status:"NEW" as LeadStatus,
    assigned: persons[0] ?? "สมชาย เชียงใหม่", source:"โทรเข้า", note:"",
  });
  function set(k: keyof typeof form, v: string) { setForm(p=>({...p,[k]:v})); }
  function submit() {
    if (!form.company.trim() || !form.contact.trim()) return;
    const id = "L-"+(Math.floor(Math.random()*900)+100);
    onAdd({
      id, numId: Math.floor(Math.random()*900)+100,
      name: form.company,
      company: form.company, contact: form.contact,
      phone: form.phone, email: form.email,
      province: form.province, product: form.product,
      category: form.product, value: form.value,
      status: form.status, assigned: form.assigned,
      source: form.source, note: form.note,
    });
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
      <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(45,45,45,.45)", zIndex:60 }} />
      <div style={{ position:"fixed", inset:0, zIndex:70, display:"flex", alignItems:"center", justifyContent:"center", padding:24, pointerEvents:"none" }}>
        <div onClick={e=>e.stopPropagation()}
          style={{ width:"100%", maxWidth:600, background:"#fff", borderRadius:20,
            border:"1px solid #e5e7eb", boxShadow:"0 24px 80px rgba(0,0,0,.2)",
            pointerEvents:"auto", overflow:"hidden" }}>

          {/* Header */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
            padding:"18px 24px", borderBottom:"1px solid #e5e7eb", background:"#003366" }}>
            <div>
              <div style={{ fontSize:"1rem", fontWeight:800, color:"#fff" }}>เพิ่มผู้สนใจใหม่</div>
              <div style={{ fontSize:"0.7rem", color:"#374151" }}>กรอกข้อมูลผู้สนใจ</div>
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
                <label style={labelStyle}>หมวดหมู่</label>
                <select value={form.product} onChange={e=>set("product",e.target.value)} style={inputStyle}>
                  {["โกดังสินค้า","โรงงาน","อาคารพาณิชย์","อาคารเกษตร","อาคารการศึกษา","อื่นๆ"].map(p=><option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>มูลค่าประเมิน</label>
                <input value={form.value} onChange={e=>set("value",e.target.value)}
                  placeholder="฿1.5M" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>สถานะ</label>
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
        <span style={{ fontSize:"0.78rem", fontWeight:800, color:"#003366" }}>{lead.value}</span>
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
  const [leadsData, setLeadsData] = useState<LeadRow[]>(initialLeads);
  const [view, setView] = useState<"list"|"kanban">("list");
  const [query, setQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<LeadStatus|"ALL">("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("id");
  const [sortDir, setSortDir] = useState<"asc"|"desc">("asc");
  const [showFilters, setShowFilters] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Advanced filters
  const [fAssignee, setFAssignee] = useState("");
  const [fValueMin, setFValueMin] = useState("");
  const [fValueMax, setFValueMax] = useState("");
  const [fProvince, setFProvince] = useState("");
  const [fSource, setFSource] = useState("");

  // Panel state
  const [selectedLead, setSelectedLead] = useState<LeadRow|null>(null);
  const [converted, setConverted] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"lead"|"address">("lead");
  const [editingField, setEditingField] = useState<string|null>(null);
  const [draft, setDraft] = useState<LeadRow|null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Checklist
  const [checklists, setChecklists] = useState<Record<string,ChecklistItem[]>>({});
  const [showChecklistInput, setShowChecklistInput] = useState(false);
  const [newCheckText, setNewCheckText] = useState("");

  // Files
  const [leadFiles, setLeadFiles] = useState<Record<string,string[]>>({});

  // Tags
  const [leadTags, setLeadTags] = useState<Record<string,string[]>>({});
  const [showTagEditor, setShowTagEditor] = useState(false);

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
      const matchA = !fAssignee || l.assigned === fAssignee;
      const matchP = !fProvince || l.province === fProvince;
      const matchSrc = !fSource || (l.source ?? "") === fSource;
      const val = parseValue(l.value);
      const matchMin = !fValueMin || val >= parseFloat(fValueMin.replace(/[฿,M]/g,""))*1e6;
      const matchMax = !fValueMax || val <= parseFloat(fValueMax.replace(/[฿,M]/g,""))*1e6;
      return matchQ && matchS && matchA && matchP && matchSrc && matchMin && matchMax;
    });

    arr = [...arr].sort((a,b) => {
      let av: string|number = 0, bv: string|number = 0;
      if (sortKey === "value") { av = parseValue(a.value); bv = parseValue(b.value); }
      else if (sortKey === "id") { av = a.numId; bv = b.numId; }
      else { av = (a[sortKey] as string) ?? ""; bv = (b[sortKey] as string) ?? ""; }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [leadsData, query, filterStatus, fAssignee, fProvince, fSource, fValueMin, fValueMax, sortKey, sortDir]);

  const totalValue = leadsData.reduce((s,l) => s + parseValue(l.value), 0);
  const wonLeads = leadsData.filter(l => l.status === "PAID").length;
  const nonLost = leadsData.filter(l => l.status !== "CANCELLED").length;
  const winRate = nonLost ? Math.round((wonLeads / nonLost)*100) : 0;
  const hasActiveFilters = !!(fAssignee || fProvince || fSource || fValueMin || fValueMax);

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
    setActiveTab("lead");
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
    setLeadsData(prev => prev.map(l => l.id === draft.id ? draft : l));
    setSelectedLead(draft); setEditingField(null);
  }
  function patchDraft(field: string, value: string) {
    setDraft(prev => prev ? {...prev, [field]: value} : prev);
  }
  function deleteLead() {
    setLeadsData(prev => prev.filter(l => l.id !== selectedLead!.id));
    closePanel();
  }
  function handleStatusChange(val: string) {
    if (!draft) return;
    const next = {...draft, status: val as LeadStatus};
    setLeadsData(prev => prev.map(l => l.id === next.id ? next : l));
    setSelectedLead(next); setDraft(next);
  }

  // Checklist
  const items: ChecklistItem[] = checklists[lid] ?? [];
  const doneCount = items.filter(i=>i.done).length;
  function addChecklistItem() {
    if (!newCheckText.trim() || !lid) return;
    setChecklists(p=>({...p,[lid]:[...(p[lid]??[]),{id:Math.random().toString(36).slice(2),text:newCheckText.trim(),done:false}]}));
    setNewCheckText(""); setShowChecklistInput(false);
  }
  function toggleChecklistItem(id:string) {
    setChecklists(p=>({...p,[lid]:(p[lid]??[]).map(i=>i.id===id?{...i,done:!i.done}:i)}));
  }
  function deleteChecklistItem(id:string) {
    setChecklists(p=>({...p,[lid]:(p[lid]??[]).filter(i=>i.id!==id)}));
  }

  // Files
  const myFiles: string[] = leadFiles[lid] ?? [];
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f || !lid) return;
    setLeadFiles(p=>({...p,[lid]:[...(p[lid]??[]),f.name]}));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // Tags
  const myTags: string[] = leadTags[lid] ?? [];
  function toggleTag(tag:string) {
    setLeadTags(p=>{const c=p[lid]??[];return{...p,[lid]:c.includes(tag)?c.filter(t=>t!==tag):[...c,tag]};});
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
    setLeadsData(prev => prev.map(l => l.id === updated.id ? updated : l));
    setSelectedLead(updated); setDraft(updated);
    closeFieldPopup();
  }

  // ─── RENDER ────────────────────────────────────────────────────────────
  return (
    <>
      {/* ═══ PAGE ═══════════════════════════════════════════════════ */}
      <div className="erp">
        {/* Header row */}
        <div className="page-head">
          <div>
            <h2>ผู้สนใจ</h2>
            <p>ทั้งหมด {leadsData.length} ราย · ปิดการขาย {winRate}%</p>
          </div>
          <button onClick={() => setShowAddForm(true)} className="btn btn-primary btn-md">
            <Plus size={15} /> เพิ่มผู้สนใจ
          </button>
        </div>

        {/* Stat pills */}
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:14 }}>
          {[
            { label:"ทั้งหมด", value:leadsData.length, color:"#003366", bg:"#dce5f0", key:"ALL" as const },
            { label:"ใหม่", value:leadsData.filter(l=>l.status==="NEW").length, color:"#6b7280", bg:"#f0f0f5", key:"NEW" as const },
            { label:"ชำระเงินแล้ว", value:wonLeads, color:"#059669", bg:"#e5faf0", key:"PAID" as const },
            { label:"ยกเลิก", value:leadsData.filter(l=>l.status==="CANCELLED").length, color:"#dc2626", bg:"#fee2e2", key:"CANCELLED" as const },
          ].map(s=>(
            <button key={s.key} onClick={()=>setFilterStatus(s.key)}
              style={{ display:"flex", alignItems:"center", gap:8,
                background:filterStatus===s.key?s.bg:"#fff",
                border:`1px solid ${filterStatus===s.key?s.color:"#e5e7eb"}`,
                borderRadius:99, padding:"7px 16px", fontSize:"0.78rem", fontWeight:600,
                color:filterStatus===s.key?s.color:"#374151", cursor:"pointer" }}>
              {s.label} <strong>{s.value}</strong>
            </button>
          ))}
          <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:6, fontSize:"0.78rem", fontWeight:700,
            background:"#fff", border:"1px solid #e5e7eb", borderRadius:99, padding:"7px 16px" }}>
            มูลค่ารวม: <span style={{ color:"#003366" }}>{fmtM(totalValue)}</span>
          </div>
        </div>

        {/* Status funnel */}
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
                  {val >= 1e6 ? "฿"+(val/1e6).toFixed(1)+"M" : val>0?"฿"+(val/1e3).toFixed(0)+"K":"—"}
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

            {/* View toggle */}
            <div style={{ display:"flex", background:"#fafafa", borderRadius:10, padding:3, gap:2 }}>
              {([["list","รายการ",<LayoutList size={13}/>],["kanban","คัมบัง",<Columns3 size={13}/>]] as const).map(([v,label,icon])=>(
                <button key={v} onClick={()=>setView(v as "list"|"kanban")}
                  style={{ display:"flex", alignItems:"center", gap:5, padding:"6px 12px",
                    borderRadius:8, border:"none", fontSize:"0.73rem", fontWeight:600,
                    background:view===v?"#fff":"transparent",
                    color:view===v?"#003366":"#6b7280",
                    boxShadow:view===v?"0 1px 4px rgba(0,0,0,.08)":"none",
                    cursor:"pointer" }}>
                  {icon} {label}
                </button>
              ))}
            </div>
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
                  <button onClick={()=>{ setFAssignee(""); setFProvince(""); setFSource(""); setFValueMin(""); setFValueMax(""); }}
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
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {([
                      ["id","รหัส"],["company","บริษัท / ผู้ติดต่อ"],
                      [null,"หมวดหมู่"],[null,"แหล่งที่มา"],["province","จังหวัด"],
                      ["status","สถานะ"],["value","มูลค่า"],["assigned","ผู้รับผิดชอบ"],[null,""],
                    ] as [SortKey|null,string][]).map(([key,label])=>(
                      <th key={label} style={key ? { cursor:"pointer", userSelect:"none" } : undefined}
                        onClick={key ? ()=>onSort(key) : undefined}>
                        <span style={{ display:"flex", alignItems:"center", gap:4 }}>
                          {label} {key && <SortIcon field={key} sortKey={sortKey} sortDir={sortDir} />}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(l => {
                    const sc = leadStatusColor[l.status];
                    const done = converted.has(l.id) || !!l.customerId;
                    const isSel = selectedLead?.id === l.id;
                    return (
                      <tr key={l.id} onClick={()=>openPanel(l)} className="clickable"
                        style={{ background:isSel?"#f0f4f8":undefined }}>
                        <td style={{ fontSize:"0.73rem", color:"#374151", fontWeight:600 }}>{l.id}</td>
                        <td>
                          <div style={{ fontSize:"0.84rem", fontWeight:700, color:"#2D2D2D" }}>{l.company}</div>
                          <div style={{ fontSize:"0.68rem", color:"#374151", marginTop:1 }}>{l.contact}</div>
                        </td>
                        <td>
                          <span className="badge" style={{ background:"#dce5f0", color:"#003366" }}>
                            {l.product}
                          </span>
                        </td>
                        <td style={{ fontSize:"0.75rem", color:"#374151" }}>{l.source || "—"}</td>
                        <td style={{ fontSize:"0.82rem", color:"#374151" }}>{l.province}</td>
                        <td style={{ position:"relative" }}
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
                                      onClick={e => { e.stopPropagation(); setLeadsData(prev=>prev.map(r=>r.id===l.id?{...r,status:s}:r)); setOpenStatusId(null); }}
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
                        <td className="num" style={{ fontSize:"0.82rem", fontWeight:700, color:"#2D2D2D" }}>{l.value}</td>
                        <td>
                          <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                            <div style={{ width:26, height:26, borderRadius:"50%", background:"#003366",
                              display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                              <span style={{ color:"#fff", fontSize:"0.6rem", fontWeight:800 }}>{l.assigned.charAt(0)}</span>
                            </div>
                            <span style={{ fontSize:"0.75rem", color:"#374151" }}>{l.assigned}</span>
                          </div>
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                            {done && l.status==="PAID" && (
                              <span style={{ display:"inline-flex", alignItems:"center", gap:4,
                                fontSize:"0.65rem", fontWeight:700, color:"#059669" }}>
                                <CheckCircle2 size={11} /> ลูกค้าแล้ว
                              </span>
                            )}
                            <button onClick={() => router.push(`/leads/${l.numId}`)}
                              className="btn btn-secondary btn-sm" style={{ color:"#003366" }}>
                              ดู →
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={9} style={{ padding:"40px", textAlign:"center", color:"#374151", fontSize:"0.82rem" }}>
                      ไม่พบข้อมูล
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ padding:"11px 16px", borderTop:"1px solid #e5e7eb", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <span style={{ fontSize:"0.73rem", color:"#374151" }}>แสดง {filtered.length} จาก {leadsData.length} รายการ</span>
              {filtered.length > 0 && (
                <span style={{ fontSize:"0.73rem", color:"#003366", fontWeight:700 }}>
                  มูลค่ารวม {fmtM(filtered.reduce((s,l)=>s+parseValue(l.value),0))}
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── KANBAN VIEW ── */}
        {view === "kanban" && (
          <div style={{ display:"flex", gap:12, overflowX:"auto", paddingBottom:8 }}>
            {ALL_STATUSES.map(status => {
              const col = leadStatusColor[status];
              const cards = filtered.filter(l=>l.status===status);
              const colVal = cards.reduce((s,l)=>s+parseValue(l.value),0);
              const isDropTarget = dragOverStatus === status && dragLeadId !== null;
              const draggedCard = leadsData.find(l=>l.id===dragLeadId);
              const canDrop = isDropTarget && draggedCard?.status !== status;
              return (
                <div key={status}
                  onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverStatus(status); }}
                  onDragLeave={e => {
                    // only clear if leaving the column entirely (not entering a child)
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverStatus(null);
                  }}
                  onDrop={e => {
                    e.preventDefault();
                    if (dragLeadId && draggedCard?.status !== status) {
                      setLeadsData(prev => prev.map(l => l.id === dragLeadId ? {...l, status} : l));
                    }
                    setDragLeadId(null); setDragOverStatus(null);
                  }}
                  style={{ minWidth:220, maxWidth:240, flexShrink:0, display:"flex", flexDirection:"column", gap:8,
                    borderRadius:14, transition:"background .15s",
                    padding:canDrop ? 4 : 0,
                    background: canDrop ? col.bg : "transparent",
                    outline: canDrop ? `2px dashed ${col.text}` : "2px dashed transparent",
                  }}>
                  {/* Column header */}
                  <div style={{ padding:"10px 14px", borderRadius:12, background:col.bg, border:`1px solid ${col.text}22` }}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:3 }}>
                      <span style={{ fontSize:"0.78rem", fontWeight:700, color:col.text }}>{leadStatusLabel[status]}</span>
                      <span style={{ width:22, height:22, borderRadius:"50%", background:col.text+"22",
                        display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize:"0.65rem", fontWeight:800, color:col.text }}>{cards.length}</span>
                    </div>
                    <div style={{ fontSize:"0.65rem", color:col.text, opacity:0.8, fontWeight:600 }}>
                      {colVal >= 1e6 ? "฿"+(colVal/1e6).toFixed(1)+"M" : colVal>0?"฿"+(colVal/1e3).toFixed(0)+"K":"ไม่มีมูลค่า"}
                    </div>
                  </div>
                  {/* Cards */}
                  <div style={{ display:"flex", flexDirection:"column", gap:7, maxHeight:"60vh", overflowY:"auto" }}>
                    {cards.map(l=>(
                      <KanbanCard
                        key={l.id} lead={l} onClick={()=>{ if(!dragLeadId) openPanel(l); }}
                        isDragging={dragLeadId===l.id}
                        onDragStart={()=>setDragLeadId(l.id)}
                        onDragEnd={()=>{ setDragLeadId(null); setDragOverStatus(null); }}
                      />
                    ))}
                    {cards.length === 0 && (
                      <div style={{ padding:"24px 12px", textAlign:"center", fontSize:"0.72rem",
                        color: canDrop ? col.text : "#C0C0C0",
                        border:`2px dashed ${canDrop ? col.text : "#f0f4f8"}`,
                        borderRadius:12, transition:"border-color .15s, color .15s",
                        fontWeight: canDrop ? 700 : 400 }}>
                        {canDrop ? `วาง "${draggedCard?.company}" ที่นี่` : "ไม่มีรายการ"}
                      </div>
                    )}
                    {canDrop && cards.length > 0 && (
                      <div style={{ height:48, borderRadius:10, border:`2px dashed ${col.text}`,
                        display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize:"0.7rem", fontWeight:700, color:col.text, background:col.bg+"88" }}>
                        วางที่นี่ →
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
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
        <AddLeadModal
          onClose={()=>setShowAddForm(false)}
          onAdd={l=>setLeadsData(p=>[l,...p])}
          persons={personsList}
        />
      )}

      {/* ═══ DETAIL PANEL ════════════════════════════════════════════ */}
      {selectedLead && current && (
        <>
          <div onClick={closePanel}
            style={{ position:"fixed", inset:0, background:"rgba(45,45,45,.4)", zIndex:40 }} />

            <div onClick={e=>e.stopPropagation()}
              style={{ position:"fixed", top:"50%", left:"50%", transform:"translate(-50%,-50%)",
                width:760, maxWidth:"calc(100vw - 32px)", maxHeight:"calc(100vh - 48px)",
                zIndex:50, background:"#fff", borderRadius:18, boxShadow:"0 24px 80px rgba(0,0,0,.22)",
                display:"flex", flexDirection:"column", overflow:"hidden" }}>

              {/* Drawer header (CI navy) — รูปแบบเดียวกับลิ้นชักลูกค้า */}
              <div style={{ background:"#003366", padding:"16px 18px 14px", flexShrink:0 }}>
                <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:10 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:11, minWidth:0 }}>
                    <div style={{ width:44, height:44, borderRadius:13, background:"rgba(255,255,255,.18)", border:"2px solid rgba(255,255,255,.25)", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:800, fontSize:"0.95rem", flexShrink:0 }}>
                      {(current.company || current.name || "?").trim().slice(0,2)}
                    </div>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontSize:"0.92rem", fontWeight:800, color:"#fff", lineHeight:1.2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{current.company || current.name}</div>
                      <div style={{ fontSize:"0.68rem", color:"rgba(255,255,255,.65)", marginTop:2 }}>{current.category} · {current.province}</div>
                    </div>
                  </div>
                  <button onClick={closePanel}
                    style={{ width:30, height:30, borderRadius:8, border:"1px solid rgba(255,255,255,.2)", background:"rgba(255,255,255,.12)", color:"#fff", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    <X size={15} />
                  </button>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:12 }}>
                  <span style={{ padding:"3px 11px", borderRadius:99, fontSize:"0.68rem", fontWeight:700, background:leadStatusColor[current.status].bg, color:leadStatusColor[current.status].text }}>
                    {leadStatusLabel[current.status]}
                  </span>
                  <button onClick={() => router.push(`/leads/${current.numId}`)}
                    style={{ display:"flex", alignItems:"center", gap:5, padding:"4px 11px", borderRadius:99, border:"1px solid rgba(255,255,255,.25)", background:"rgba(255,255,255,.12)", color:"#fff", fontSize:"0.68rem", fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}>
                    เปิดหน้าเต็ม →
                  </button>
                </div>
              </div>

              {/* Tabs bar */}
              <div className="tab-bar" style={{ padding:"0 24px", flexShrink:0 }}>
                {[{key:"lead",label:"ผู้สนใจ"},{key:"address",label:"ที่อยู่"}].map(t=>(
                  <button key={t.key} onClick={()=>setActiveTab(t.key as "lead"|"address")}
                    className={`tab-item${activeTab===t.key?" active":""}`}
                    style={{ padding:"12px 18px", fontSize:"0.82rem" }}>
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Body — 760px 2 คอลัมน์ */}
              <div style={{ display:"flex", flex:1, overflow:"hidden" }}>

                {/* ── LEFT ── */}
                <div style={{ flex:1, padding:"24px 28px", overflowY:"auto", borderRight:"1px solid #f0f4f8" }}>
                  {activeTab === "lead" && (
                    <>
                      {editingField === "title"
                        ? <input value={draft?.category??""} onChange={e=>patchDraft("category",e.target.value)}
                            onBlur={commitDraft} autoFocus
                            style={{ fontSize:"1.6rem", fontWeight:800, color:"#2D2D2D", border:"none",
                              outline:"none", width:"100%", borderBottom:"2px solid #003366", paddingBottom:2, marginBottom:6 }} />
                        : <h2 onClick={()=>setEditingField("title")} title="คลิกแก้ไข"
                            style={{ fontSize:"1.6rem", fontWeight:800, color:"#2D2D2D", marginBottom:6, cursor:"text" }}>
                            {current.category} — {current.province}
                          </h2>
                      }
                      <p style={{ fontSize:"0.8rem", color:"#374151", marginBottom:2 }}>
                        ผู้ติดต่อ: <strong style={{ color:"#2D2D2D" }}>{current.contact}</strong>
                      </p>
                      <p style={{ fontSize:"0.8rem", color:"#374151", marginBottom:24 }}>
                        บริษัท: <strong style={{ color:"#2D2D2D" }}>{current.company}</strong>
                      </p>

                      <div style={{ height:1, background:"#f0f4f8", marginBottom:22 }} />

                      {/* คำอธิบาย */}
                      <div style={{ marginBottom:24 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                          <MessageSquare size={15} color="#2D2D2D" />
                          <span style={{ fontSize:"0.88rem", fontWeight:700, color:"#2D2D2D" }}>คำอธิบาย</span>
                        </div>
                        {editingField === "note" ? (
                          <>
                            <textarea value={draft?.note??""} onChange={e=>patchDraft("note",e.target.value)}
                              rows={4} autoFocus
                              style={{ width:"100%", border:"1px solid #003366", borderRadius:10,
                                padding:"10px 12px", fontSize:"0.82rem", color:"#2D2D2D", outline:"none",
                                resize:"vertical", fontFamily:"inherit", lineHeight:1.7 }} />
                            <div style={{ display:"flex", gap:6, marginTop:6 }}>
                              <button onClick={commitDraft}
                                style={{ padding:"7px 14px", borderRadius:8, background:"#003366",
                                  border:"none", color:"#fff", fontSize:"0.72rem", fontWeight:700, cursor:"pointer" }}>บันทึก</button>
                              <button onClick={()=>{ setDraft({...selectedLead}); setEditingField(null); }}
                                style={{ padding:"7px 14px", borderRadius:8, background:"#fff",
                                  border:"1px solid #e5e7eb", color:"#374151", fontSize:"0.72rem", cursor:"pointer" }}>ยกเลิก</button>
                            </div>
                          </>
                        ) : (
                          <>
                            <p onClick={()=>setEditingField("note")}
                              style={{ fontSize:"0.82rem", color:current.note?"#2D2D2D":"#9ca3af",
                                lineHeight:1.8, cursor:"text", minHeight:50 }}>
                              {current.note || "คลิกเพื่อเพิ่มคำอธิบาย..."}
                            </p>
                            <button onClick={()=>setEditingField("note")}
                              style={{ fontSize:"0.73rem", color:"#003366", background:"none",
                                border:"none", cursor:"pointer", padding:0, marginTop:4 }}>
                              แก้ไขคำอธิบาย
                            </button>
                          </>
                        )}
                      </div>

                      <div style={{ height:1, background:"#f0f4f8", marginBottom:22 }} />

                      {/* รายการตรวจสอบ */}
                      <div style={{ marginBottom:24 }}>
                        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                            <CheckSquare size={15} color="#2D2D2D" />
                            <span style={{ fontSize:"0.88rem", fontWeight:700, color:"#2D2D2D" }}>รายการตรวจสอบ</span>
                          </div>
                          <span style={{ fontSize:"0.7rem",
                            color:doneCount===items.length&&items.length>0?"#059669":"#C0C0C0", fontWeight:600 }}>
                            {doneCount}/{items.length}
                          </span>
                        </div>
                        {items.length > 0 && (
                          <div style={{ height:4, borderRadius:99, background:"#f0f4f8", marginBottom:10, overflow:"hidden" }}>
                            <div className="top5-bar" style={{ height:"100%", width:`${(doneCount/items.length)*100}%`,
                              background:"#059669", borderRadius:99 }} />
                          </div>
                        )}
                        <div style={{ display:"flex", flexDirection:"column", gap:4, marginBottom:8 }}>
                          {items.map(item=>(
                            <div key={item.id} style={{ display:"flex", alignItems:"center", gap:8,
                              padding:"7px 10px", borderRadius:8,
                              background:item.done?"#f0f7f0":"#fafafa", border:"1px solid #f0f4f8" }}>
                              <button onClick={()=>toggleChecklistItem(item.id)}
                                style={{ width:18, height:18, borderRadius:5,
                                  border:`2px solid ${item.done?"#059669":"#e5e7eb"}`,
                                  background:item.done?"#059669":"#fff",
                                  display:"flex", alignItems:"center", justifyContent:"center",
                                  cursor:"pointer", flexShrink:0, padding:0 }}>
                                {item.done&&<Check size={11} color="#fff"/>}
                              </button>
                              <span style={{ flex:1, fontSize:"0.8rem",
                                color:item.done?"#6b7280":"#2D2D2D",
                                textDecoration:item.done?"line-through":"none" }}>
                                {item.text}
                              </span>
                              <button onClick={()=>deleteChecklistItem(item.id)}
                                style={{ background:"none", border:"none", cursor:"pointer",
                                  color:"#e5e7eb", padding:0, display:"flex" }}
                                onMouseEnter={e=>(e.currentTarget.style.color="#dc2626")}
                                onMouseLeave={e=>(e.currentTarget.style.color="#e5e7eb")}>
                                <X size={12}/>
                              </button>
                            </div>
                          ))}
                        </div>
                        {showChecklistInput ? (
                          <div style={{ display:"flex", gap:6 }}>
                            <input value={newCheckText} onChange={e=>setNewCheckText(e.target.value)}
                              onKeyDown={e=>{ if(e.key==="Enter")addChecklistItem(); if(e.key==="Escape"){setShowChecklistInput(false);setNewCheckText("");} }}
                              placeholder="พิมพ์รายการ..." autoFocus
                              style={{ flex:1, border:"1px solid #003366", borderRadius:8,
                                padding:"7px 11px", fontSize:"0.8rem", outline:"none", color:"#2D2D2D" }} />
                            <button onClick={addChecklistItem}
                              style={{ padding:"7px 12px", borderRadius:8, background:"#003366",
                                border:"none", color:"#fff", fontSize:"0.72rem", fontWeight:700, cursor:"pointer" }}>เพิ่ม</button>
                            <button onClick={()=>{setShowChecklistInput(false);setNewCheckText("");}}
                              style={{ padding:"7px 10px", borderRadius:8, background:"#fff",
                                border:"1px solid #e5e7eb", color:"#374151", fontSize:"0.72rem", cursor:"pointer" }}>ยกเลิก</button>
                          </div>
                        ) : (
                          <button onClick={()=>setShowChecklistInput(true)}
                            style={{ fontSize:"0.75rem", color:"#003366", background:"none", border:"none", cursor:"pointer", padding:0 }}>
                            + สร้างรายการใหม่
                          </button>
                        )}
                      </div>

                      <div style={{ height:1, background:"#f0f4f8", marginBottom:22 }} />

                      {/* ไฟล์แนบ */}
                      <div>
                        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                          <Paperclip size={15} color="#2D2D2D" />
                          <span style={{ fontSize:"0.88rem", fontWeight:700, color:"#2D2D2D" }}>ไฟล์แนบ</span>
                          {myFiles.length>0&&<span style={{ fontSize:"0.65rem", background:"#003366",
                            color:"#fff", borderRadius:99, padding:"1px 7px", fontWeight:700 }}>{myFiles.length}</span>}
                        </div>
                        {myFiles.length>0&&(
                          <div style={{ display:"flex", flexDirection:"column", gap:4, marginBottom:8 }}>
                            {myFiles.map(fname=>(
                              <div key={fname} style={{ display:"flex", alignItems:"center", gap:8,
                                padding:"7px 10px", borderRadius:8, background:"#fafafa", border:"1px solid #f0f4f8" }}>
                                <Paperclip size={13} color="#C0C0C0"/>
                                <span style={{ flex:1, fontSize:"0.78rem", color:"#2D2D2D" }}>{fname}</span>
                                <button onClick={()=>setLeadFiles(p=>({...p,[lid]:(p[lid]??[]).filter(n=>n!==fname)}))}
                                  style={{ background:"none", border:"none", cursor:"pointer",
                                    color:"#e5e7eb", padding:0, display:"flex" }}
                                  onMouseEnter={e=>(e.currentTarget.style.color="#dc2626")}
                                  onMouseLeave={e=>(e.currentTarget.style.color="#e5e7eb")}>
                                  <X size={12}/>
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <button onClick={()=>fileInputRef.current?.click()}
                          style={{ fontSize:"0.75rem", color:"#003366", background:"none", border:"none", cursor:"pointer", padding:0 }}>
                          + เพิ่มไฟล์แนบ
                        </button>
                      </div>
                    </>
                  )}

                  {activeTab === "address" && (() => {
                    const addr = getAddress(lid, current);
                    const fields: [string, keyof AddressData][] = [
                      ["ชื่อ บริษัท", "company"],
                      ["ตำแหน่งงาน", "position"],
                      ["ถนน", "street"],
                      ["เมือง", "city"],
                      ["สถานะ", "state"],
                      ["รหัสไปรษณีย์", "postalCode"],
                      ["ประเทศ", "country"],
                      ["เว็บไซต์", "website"],
                    ];
                    return (
                      <div>
                        {/* Company header */}
                        <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:28 }}>
                          <div style={{ width:48, height:48, borderRadius:13, background:"#003366", flexShrink:0,
                            display:"flex", alignItems:"center", justifyContent:"center" }}>
                            <span style={{ color:"#fff", fontWeight:900, fontSize:"1rem" }}>{current.company.charAt(0)}</span>
                          </div>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:"0.95rem", fontWeight:800, color:"#2D2D2D" }}>{current.company}</div>
                            <div style={{ fontSize:"0.72rem", color:"#374151", marginTop:2 }}>{current.contact}</div>
                          </div>
                          {!editingAddress ? (
                            <button onClick={()=>{ setEditingAddress(true); setAddressDraft(addr); }}
                              style={{ padding:"7px 16px", borderRadius:9, border:"1px solid #e5e7eb",
                                background:"#fff", color:"#374151", fontSize:"0.75rem", fontWeight:600,
                                cursor:"pointer", display:"flex", alignItems:"center", gap:5, flexShrink:0 }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                              แก้ไข
                            </button>
                          ) : (
                            <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                              <button onClick={()=>setEditingAddress(false)}
                                style={{ padding:"7px 12px", borderRadius:9, border:"1px solid #e5e7eb",
                                  background:"#fff", color:"#374151", fontSize:"0.73rem", fontWeight:600, cursor:"pointer" }}>ยกเลิก</button>
                              <button onClick={saveAddress}
                                style={{ padding:"7px 14px", borderRadius:9, border:"none",
                                  background:"#003366", color:"#fff", fontSize:"0.73rem", fontWeight:700, cursor:"pointer" }}>บันทึก</button>
                            </div>
                          )}
                        </div>

                        {/* Section: องค์กร */}
                        <div style={{ marginBottom:24 }}>
                          <div style={{ fontSize:"0.67rem", fontWeight:700, color:"#374151",
                            textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:12 }}>ข้อมูลองค์กร</div>
                          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                            {(["company","position"] as (keyof AddressData)[]).map(key => {
                              const labels: Record<string,string> = { company:"ชื่อ บริษัท", position:"ตำแหน่งงาน" };
                              return (
                                <div key={key}>
                                  <div style={{ fontSize:"0.65rem", fontWeight:600, color:"#374151", marginBottom:5 }}>{labels[key]}</div>
                                  {editingAddress
                                    ? <input value={addressDraft[key]??""} onChange={e=>setAddressDraft(p=>({...p,[key]:e.target.value}))}
                                        style={{ width:"100%", border:"none", borderBottom:"1.5px solid #003366", outline:"none",
                                          fontSize:"0.82rem", fontWeight:600, color:"#2D2D2D", background:"transparent", padding:"3px 0", boxSizing:"border-box" as const }} />
                                    : <div style={{ fontSize:"0.82rem", fontWeight:600, color:addr[key]?"#2D2D2D":"#6b7280" }}>{addr[key]||"—"}</div>
                                  }
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div style={{ height:1, background:"#f0f4f8", marginBottom:20 }}/>

                        {/* Section: ที่อยู่ */}
                        <div style={{ marginBottom:24 }}>
                          <div style={{ fontSize:"0.67rem", fontWeight:700, color:"#374151",
                            textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:12 }}>ที่อยู่</div>
                          {/* ถนน full-width */}
                          <div style={{ marginBottom:14 }}>
                            <div style={{ fontSize:"0.65rem", fontWeight:600, color:"#374151", marginBottom:5 }}>ถนน</div>
                            {editingAddress
                              ? <input value={addressDraft.street??""} onChange={e=>setAddressDraft(p=>({...p,street:e.target.value}))}
                                  style={{ width:"100%", border:"none", borderBottom:"1.5px solid #003366", outline:"none",
                                    fontSize:"0.82rem", fontWeight:600, color:"#2D2D2D", background:"transparent", padding:"3px 0", boxSizing:"border-box" as const }} />
                              : <div style={{ fontSize:"0.82rem", fontWeight:600, color:addr.street?"#2D2D2D":"#6b7280" }}>{addr.street||"—"}</div>
                            }
                          </div>
                          {/* 2-col grid */}
                          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                            {(["city","state","postalCode","country"] as (keyof AddressData)[]).map(key => {
                              const labels: Record<string,string> = { city:"เมือง", state:"สถานะ/จังหวัด", postalCode:"รหัสไปรษณีย์", country:"ประเทศ" };
                              return (
                                <div key={key}>
                                  <div style={{ fontSize:"0.65rem", fontWeight:600, color:"#374151", marginBottom:5 }}>{labels[key]}</div>
                                  {editingAddress
                                    ? <input value={addressDraft[key]??""} onChange={e=>setAddressDraft(p=>({...p,[key]:e.target.value}))}
                                        style={{ width:"100%", border:"none", borderBottom:"1.5px solid #003366", outline:"none",
                                          fontSize:"0.82rem", fontWeight:600, color:"#2D2D2D", background:"transparent", padding:"3px 0", boxSizing:"border-box" as const }} />
                                    : <div style={{ fontSize:"0.82rem", fontWeight:600, color:addr[key]?"#2D2D2D":"#6b7280" }}>{addr[key]||"—"}</div>
                                  }
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div style={{ height:1, background:"#f0f4f8", marginBottom:20 }}/>

                        {/* เว็บไซต์ */}
                        <div>
                          <div style={{ fontSize:"0.65rem", fontWeight:600, color:"#374151", marginBottom:5, display:"flex", alignItems:"center", gap:5 }}>
                            <Globe size={11}/> เว็บไซต์
                          </div>
                          {editingAddress
                            ? <input value={addressDraft.website??""} onChange={e=>setAddressDraft(p=>({...p,website:e.target.value}))}
                                placeholder="https://..."
                                style={{ width:"100%", border:"none", borderBottom:"1.5px solid #003366", outline:"none",
                                  fontSize:"0.82rem", fontWeight:600, color:"#2D2D2D", background:"transparent", padding:"3px 0", boxSizing:"border-box" as const }} />
                            : addr.website
                              ? <a href={addr.website} target="_blank" rel="noreferrer"
                                  style={{ fontSize:"0.82rem", fontWeight:600, color:"#003366", textDecoration:"none" }}>
                                  {addr.website}
                                </a>
                              : <div style={{ fontSize:"0.82rem", fontWeight:600, color:"#374151" }}>—</div>
                          }
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* ── RIGHT SIDEBAR ── */}
                <div style={{ width:292, flexShrink:0, padding:"24px 20px",
                  overflowY:"auto", display:"flex", flexDirection:"column", gap:18 }}>

                  {/* Assignees */}
                  <div style={{ position:"relative" }}>
                    <div style={{ fontSize:"0.65rem", fontWeight:700, color:"#374151",
                      textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:10 }}>ผู้รับผิดชอบ</div>
                    <div style={{ display:"flex", alignItems:"center", gap:0, flexWrap:"wrap" }}>
                      {getAssignees().map((name,i)=>(
                        <div key={name} title={name}
                          style={{ width:34, height:34, borderRadius:"50%", background:"#003366",
                            display:"flex", alignItems:"center", justifyContent:"center",
                            marginLeft:i>0?-8:0, border:"2px solid #fff", position:"relative", zIndex:getAssignees().length-i }}>
                          <span style={{ color:"#374151", fontSize:"0.7rem", fontWeight:800 }}>{name.charAt(0)}</span>
                        </div>
                      ))}
                      <button onClick={()=>setShowAssigneePicker(p=>!p)}
                        style={{ width:34, height:34, borderRadius:"50%", border:"2px dashed #e5e7eb",
                          background:"#fff", display:"flex", alignItems:"center", justifyContent:"center",
                          cursor:"pointer", color:"#374151", marginLeft:getAssignees().length>0?-8:0, zIndex:0 }}>
                        <Plus size={14}/>
                      </button>
                    </div>
                    {showAssigneePicker && (
                      <div style={{ position:"absolute", top:"100%", left:0, zIndex:20,
                        background:"#fff", border:"1px solid #e5e7eb", borderRadius:12,
                        boxShadow:"0 8px 24px rgba(0,0,0,.12)", padding:8, minWidth:180, marginTop:4 }}>
                        <div style={{ fontSize:"0.65rem", fontWeight:700, color:"#374151",
                          padding:"4px 8px 8px", borderBottom:"1px solid #f0f4f8", marginBottom:4 }}>เลือกผู้รับผิดชอบ</div>
                        {personsList.map(name=>{
                          const sel = getAssignees().includes(name);
                          return (
                            <button key={name} onClick={()=>toggleAssignee(name)}
                              style={{ display:"flex", alignItems:"center", gap:8, width:"100%",
                                padding:"7px 10px", borderRadius:8, border:"none",
                                background:sel?"#dce5f0":"transparent", cursor:"pointer" }}>
                              <div style={{ width:26, height:26, borderRadius:"50%",
                                background:sel?"#003366":"#e5e7eb",
                                display:"flex", alignItems:"center", justifyContent:"center" }}>
                                <span style={{ color:sel?"#C0C0C0":"#6b7280", fontSize:"0.65rem", fontWeight:800 }}>{name.charAt(0)}</span>
                              </div>
                              <span style={{ fontSize:"0.78rem", fontWeight:sel?700:500,
                                color:sel?"#003366":"#2D2D2D", flex:1 }}>{name}</span>
                              {sel && <Check size={13} color="#003366"/>}
                            </button>
                          );
                        })}
                        <button onClick={()=>setShowAssigneePicker(false)}
                          style={{ display:"block", width:"100%", marginTop:4, padding:"7px", borderRadius:8,
                            border:"none", background:"#f8f9fb", color:"#374151", fontSize:"0.73rem",
                            cursor:"pointer", fontWeight:600 }}>เสร็จสิ้น</button>
                      </div>
                    )}
                  </div>

                  {/* Detail rows */}
                  <div>
                    <div style={{ fontSize:"0.65rem", fontWeight:700, color:"#374151",
                      textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:8 }}>รายละเอียด</div>
                    <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                      {([
                        [<User size={13}/>, "ชื่อ", "contact", "text", null],
                        [<span style={{fontSize:"0.78rem",fontWeight:700}}>฿</span>, "มูลค่า", "value", "text", null],
                        [<Calendar size={13}/>, "หมวดหมู่", "category", "select", ["โกดังสินค้า","โรงงาน","อาคารพาณิชย์","อาคารเกษตร","อาคารการศึกษา","อื่นๆ"]],
                        [<Phone size={13}/>, "โทรศัพท์", "phone", "tel", null],
                        [<Mail size={13}/>, "อีเมล", "email", "email", null],
                        [<Zap size={13}/>, "แหล่งที่มา", "source", "select", SOURCES],
                        [<MessageSquare size={13}/>, "ติดต่อล่าสุด", "lastContact", "date", null],
                      ] as [React.ReactNode,string,string,string,string[]|null][]).map(([icon,label,field,type,opts])=>(
                        <div key={field} onClick={(e)=>openFieldPopup(field,label,type,e,opts??undefined)} style={{ cursor:"pointer" }}>
                          <DetailRow icon={icon} label={label}
                            value={(current as unknown as Record<string,string>)[field]} />
                        </div>
                      ))}

                      {/* Status dropdown */}
                      <div style={{ position:"relative" }}>
                        <button onClick={()=>setShowStatusDropdown(p=>!p)}
                          style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 12px",
                            borderRadius:10, background:"#f8f9fb", border:"1px solid #f0f4f8",
                            width:"100%", cursor:"pointer", textAlign:"left" }}>
                          <span style={{ color:"#374151", flexShrink:0, display:"flex" }}><Tag size={13}/></span>
                          <span style={{ fontSize:"0.7rem", color:"#374151", minWidth:72, flexShrink:0 }}>สถานะ</span>
                          <span style={{ flex:1, fontSize:"0.78rem", fontWeight:700,
                            color:leadStatusColor[current.status].text }}>
                            {leadStatusLabel[current.status]}
                          </span>
                          <ChevronDown size={11} color="#C0C0C0" style={{
                            transition:"transform .2s",
                            transform: showStatusDropdown ? "rotate(180deg)" : "none",
                            flexShrink:0,
                          }}/>
                        </button>

                        {showStatusDropdown && (
                          <>
                            <div onClick={()=>setShowStatusDropdown(false)}
                              style={{ position:"fixed", inset:0, zIndex:90 }} />
                            <div style={{ position:"absolute", top:"calc(100% + 6px)", left:0, right:0,
                              background:"#fff", border:"1px solid #e5e7eb", borderRadius:12,
                              boxShadow:"0 8px 28px rgba(0,0,0,.15)", zIndex:100,
                              overflow:"hidden", padding:"4px" }}>
                              {ALL_STATUSES.map(s => {
                                const sc = leadStatusColor[s];
                                const active = current.status === s;
                                return (
                                  <button key={s}
                                    onClick={() => { handleStatusChange(s); setShowStatusDropdown(false); }}
                                    style={{ display:"flex", alignItems:"center", gap:9, width:"100%",
                                      padding:"8px 10px", borderRadius:8, border:"none",
                                      background: active ? sc.bg : "transparent",
                                      cursor:"pointer", textAlign:"left" }}>
                                    <span style={{ width:8, height:8, borderRadius:"50%",
                                      background: sc.text, flexShrink:0 }} />
                                    <span style={{ fontSize:"0.78rem", fontWeight: active ? 700 : 500,
                                      color: active ? sc.text : "#2D2D2D", flex:1 }}>
                                      {leadStatusLabel[s]}
                                    </span>
                                    {active && <Check size={13} color={sc.text} />}
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>

                    </div>
                  </div>

                  {/* Reminder */}
                  <div>
                    {myReminder ? (
                      <div style={{ padding:"10px 12px", borderRadius:10, background:"#dce5f0", border:"1px solid #c5d4e8" }}>
                        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:"0.75rem", fontWeight:700, color:"#003366" }}>
                            <Bell size={14}/> การเตือนความจำ
                          </div>
                          <button onClick={()=>setReminders(p=>{const n={...p};delete n[lid];return n;})}
                            style={{ background:"none", border:"none", color:"#374151", cursor:"pointer", padding:0, display:"flex" }}>
                            <X size={13}/>
                          </button>
                        </div>
                        <div style={{ fontSize:"0.72rem", color:"#003366", fontWeight:600 }}>{myReminder.date}</div>
                        {myReminder.note&&<div style={{ fontSize:"0.7rem", color:"#374151", marginTop:2 }}>{myReminder.note}</div>}
                        <button onClick={()=>{setReminderDate(myReminder.date);setReminderNote(myReminder.note);setShowReminderForm(true);}}
                          style={{ fontSize:"0.7rem", color:"#003366", background:"none", border:"none", cursor:"pointer", padding:0, marginTop:4 }}>แก้ไข</button>
                      </div>
                    ) : showReminderForm ? (
                      <div style={{ padding:"12px", borderRadius:10, background:"#f8f9fb", border:"1px solid #e5e7eb" }}>
                        <div style={{ fontSize:"0.7rem", fontWeight:700, color:"#2D2D2D", marginBottom:8 }}>ตั้งการเตือน</div>
                        <input type="date" value={reminderDate} onChange={e=>setReminderDate(e.target.value)}
                          style={{ width:"100%", border:"1px solid #e5e7eb", borderRadius:8,
                            padding:"7px 10px", fontSize:"0.78rem", outline:"none", marginBottom:6, color:"#2D2D2D" }} />
                        <input placeholder="หมายเหตุ (ไม่บังคับ)" value={reminderNote} onChange={e=>setReminderNote(e.target.value)}
                          style={{ width:"100%", border:"1px solid #e5e7eb", borderRadius:8,
                            padding:"7px 10px", fontSize:"0.78rem", outline:"none", marginBottom:8, color:"#2D2D2D" }} />
                        <div style={{ display:"flex", gap:6 }}>
                          <button onClick={saveReminder}
                            style={{ flex:1, padding:"7px", borderRadius:8, background:"#003366",
                              border:"none", color:"#fff", fontSize:"0.7rem", fontWeight:700, cursor:"pointer" }}>บันทึก</button>
                          <button onClick={()=>setShowReminderForm(false)}
                            style={{ flex:1, padding:"7px", borderRadius:8, background:"#fff",
                              border:"1px solid #e5e7eb", color:"#374151", fontSize:"0.7rem", cursor:"pointer" }}>ยกเลิก</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={()=>setShowReminderForm(true)}
                        style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 12px",
                          borderRadius:10, background:"#dce5f0", border:"1px solid #c5d4e8",
                          color:"#003366", fontSize:"0.75rem", fontWeight:600, cursor:"pointer", width:"100%" }}>
                        <Bell size={14}/> เพิ่มการเตือนความจำ
                      </button>
                    )}
                  </div>

                  {/* Tags */}
                  <div>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                      <div style={{ fontSize:"0.65rem", fontWeight:700, color:"#374151",
                        textTransform:"uppercase", letterSpacing:"0.07em" }}>แท็ก</div>
                      <button onClick={()=>setShowTagEditor(p=>!p)}
                        style={{ fontSize:"0.65rem", color:"#003366", background:"none", border:"none", cursor:"pointer", padding:0, fontWeight:700 }}>
                        {showTagEditor ? "เสร็จ" : "+ เพิ่ม"}
                      </button>
                    </div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom: showTagEditor ? 8 : 0 }}>
                      {myTags.length > 0
                        ? myTags.map(tag => (
                            <span key={tag} onClick={() => toggleTag(tag)}
                              style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"3px 9px",
                                borderRadius:99, fontSize:"0.65rem", fontWeight:700, cursor:"pointer",
                                background:(TAG_COLORS[tag]??"#6b7280")+"22",
                                color:TAG_COLORS[tag]??"#6b7280",
                                border:`1px solid ${TAG_COLORS[tag]??"#6b7280"}44` }}>
                              {tag} <span style={{ fontSize:"0.6rem" }}>×</span>
                            </span>
                          ))
                        : !showTagEditor && <span style={{ fontSize:"0.72rem", color:"#9ca3af" }}>ไม่มีแท็ก</span>
                      }
                    </div>
                    {showTagEditor && (
                      <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                        {AVAILABLE_TAGS.map(tag => {
                          const active = myTags.includes(tag);
                          return (
                            <button key={tag} onClick={() => toggleTag(tag)}
                              style={{ padding:"3px 9px", borderRadius:99, fontSize:"0.65rem", fontWeight:700,
                                cursor:"pointer", border:`1px solid ${active ? TAG_COLORS[tag]??"#6b7280" : "#e5e7eb"}`,
                                background: active ? (TAG_COLORS[tag]??"#6b7280")+"22" : "#fff",
                                color: active ? TAG_COLORS[tag]??"#6b7280" : "#6b7280" }}>
                              {active ? "✓ " : ""}{tag}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div>
                    <div style={{ fontSize:"0.65rem", fontWeight:700, color:"#374151",
                      textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:8 }}>การกระทำ</div>
                    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                      {/* Navigate to full lead page */}
                      <button onClick={() => { closePanel(); router.push(`/leads/${current.numId}`); }}
                        style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 14px",
                          borderRadius:10, background:"#dce5f0", border:"1px solid #c5d4e8",
                          cursor:"pointer", width:"100%", transition:"background .15s" }}
                        onMouseEnter={e=>{ (e.currentTarget as HTMLElement).style.background="#ccd8ec"; }}
                        onMouseLeave={e=>{ (e.currentTarget as HTMLElement).style.background="#dce5f0"; }}>
                        <UserPlus size={15} color="#003366"/>
                        <span style={{ fontSize:"0.78rem", fontWeight:700, color:"#003366" }}>ดูรายละเอียดเต็ม</span>
                        <span style={{ marginLeft:"auto", fontSize:"0.72rem", color:"#003366" }}>→</span>
                      </button>
                      {/* สร้างใบเสนอราคา */}
                      <button onClick={() => router.push("/quotations")}
                        style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 14px",
                          borderRadius:10, background:"#f8f9fb", border:"1px solid #e2e8f0",
                          cursor:"pointer", width:"100%", transition:"background .15s" }}
                        onMouseEnter={e=>{ (e.currentTarget as HTMLElement).style.background="#eef2f7"; }}
                        onMouseLeave={e=>{ (e.currentTarget as HTMLElement).style.background="#f8f9fb"; }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                        <span style={{ fontSize:"0.78rem", fontWeight:600, color:"#374151" }}>สร้างใบเสนอราคา</span>
                      </button>
                      {/* เพิ่มนัดหมาย */}
                      <button onClick={() => router.push("/appointments")}
                        style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 14px",
                          borderRadius:10, background:"#f8f9fb", border:"1px solid #e2e8f0",
                          cursor:"pointer", width:"100%", transition:"background .15s" }}
                        onMouseEnter={e=>{ (e.currentTarget as HTMLElement).style.background="#eef2f7"; }}
                        onMouseLeave={e=>{ (e.currentTarget as HTMLElement).style.background="#f8f9fb"; }}>
                        <Calendar size={15} color="#6b7280"/>
                        <span style={{ fontSize:"0.78rem", fontWeight:600, color:"#374151" }}>เพิ่มนัดหมาย</span>
                      </button>
                      {/* แปลงเป็นลูกค้า */}
                      {(converted.has(current.id)||!!current.customerId) ? (
                        <button
                          onClick={()=>{ closePanel(); router.push(current.customerId ? `/customers/${current.customerId}` : "/customers"); }}
                          style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 14px",
                            borderRadius:10, background:"#e5faf0", border:"1px solid #bbf1d8",
                            cursor:"pointer", width:"100%", transition:"background .15s" }}
                          onMouseEnter={e=>{ (e.currentTarget as HTMLElement).style.background="#d0f5e6"; }}
                          onMouseLeave={e=>{ (e.currentTarget as HTMLElement).style.background="#e5faf0"; }}>
                          <CheckCircle2 size={15} color="#059669"/>
                          <span style={{ fontSize:"0.78rem", fontWeight:600, color:"#059669" }}>แปลงเป็นลูกค้าแล้ว</span>
                          <span style={{ marginLeft:"auto", fontSize:"0.72rem", color:"#059669" }}>ดูข้อมูล →</span>
                        </button>
                      ) : (
                        <button onClick={()=>setConverted(p=>new Set([...p,current.id]))}
                          style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 14px",
                            borderRadius:10, background:"#f8f9fb", border:"1px solid #e2e8f0",
                            cursor:"pointer", width:"100%", transition:"background .15s" }}
                          onMouseEnter={e=>{ (e.currentTarget as HTMLElement).style.background="#eef2f7"; }}
                          onMouseLeave={e=>{ (e.currentTarget as HTMLElement).style.background="#f8f9fb"; }}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 2v6h-6"/><path d="M21 13a9 9 0 1 1-3-7.7L21 8"/>
                          </svg>
                          <span style={{ fontSize:"0.78rem", fontWeight:600, color:"#374151" }}>แปลงเป็นลูกค้า</span>
                        </button>
                      )}
                      {!showDeleteConfirm ? (
                        <button onClick={()=>setShowDeleteConfirm(true)}
                          style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 12px",
                            borderRadius:10, background:"#fff", border:"1px solid #e5e7eb",
                            color:"#dc2626", fontSize:"0.75rem", fontWeight:700, cursor:"pointer", width:"100%" }}>
                          <Trash2 size={15}/> ลบ
                        </button>
                      ) : (
                        <div style={{ borderRadius:10, border:"1px solid #fca5a5", overflow:"hidden" }}>
                          <div style={{ padding:"8px 12px", background:"#fee2e2", fontSize:"0.7rem", color:"#dc2626", fontWeight:600 }}>
                            ยืนยันลบ "{current.company}"?
                          </div>
                          <div style={{ display:"flex" }}>
                            <button onClick={deleteLead}
                              style={{ flex:1, padding:"8px", background:"#dc2626", border:"none",
                                color:"#fff", fontSize:"0.7rem", fontWeight:700, cursor:"pointer" }}>ลบเลย</button>
                            <button onClick={()=>setShowDeleteConfirm(false)}
                              style={{ flex:1, padding:"8px", background:"#fff",
                                border:"none", borderLeft:"1px solid #fca5a5",
                                color:"#374151", fontSize:"0.7rem", cursor:"pointer" }}>ยกเลิก</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            </div>
        </>
      )}
    </>
  );
}

