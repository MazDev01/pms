"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  leads, appointments, notes,
  quotationStatusLabel, quotationStatusColor, noteCategoryColor,
  responsiblePersons, RP_STORAGE_KEY,
  type ResponsiblePerson, type QuotationMock, type PipelineDealMock,
  type CustomerRow, type CustomerStatus, type CustomerType,
} from "@/lib/mock";
import { useSales } from "@/context/SalesContext";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { RightDrawer, DrawerSection, DrawerRow, type DrawerTab } from "@/components/ui/RightDrawer";
import { useTableLayout, type Col } from "@/components/ui/TableTools";
import { ActivityTimeline, type ActivityTimelineItem } from "@/components/ui/ActivityTimeline";
import {
  Plus, Search, X, ChevronUp, ChevronDown,
  Phone, Mail, MapPin, Building2, Edit2, ExternalLink,
  LayoutList, LayoutGrid, Filter, Trash2,
  Calendar, FileText, StickyNote,
} from "lucide-react";

// ── Design tokens ────────────────────────────────────────────
const PRIMARY = "#003366";
const STEEL   = "#2D2D2D";
const BORDER  = "#e5e7eb";
const MUTED   = "#6b7280";

// ── Types ────────────────────────────────────────────────────
// CustomerRow / CustomerStatus / CustomerType imported from mock (shared app-wide)
type SortKey = "company"|"name"|"phone"|"province"|"owner"|"lastActivity"|"quotationCount"|"joinDate";
type SortDir = "asc"|"desc";

const CATEGORIES    = ["โกดัง/คลังสินค้า","โรงงาน","ค้าปลีก","เกษตรกรรม","สำนักงาน","อื่นๆ"];
const CUSTOMER_TYPES: CustomerType[] = ["บุคคล","บริษัท"];
// สถานะลูกค้า (ใช้กับ FilterBar กลาง) — label ไทย
const CUSTOMER_STATUS_OPTIONS = [
  { value: "active",   label: "ใช้งาน" },
  { value: "inactive", label: "ไม่ใช้งาน" },
];
const DEFAULT_OWNERS = responsiblePersons.filter(p => p.active).map(p => p.name);
const PROVINCES  = ["กรุงเทพฯ","เชียงใหม่","ระยอง","เชียงราย","นนทบุรี","สมุทรสาคร","สมุทรปราการ","นครสวรรค์","ราชบุรี","ขอนแก่น","ตาก","อุตรดิตถ์","อื่นๆ"];

function initials(name:string){ return name.replace(/บจ\.|หจก\./g,"").trim().slice(0,2); }
function fmtMoney(v:number){ return "฿"+v.toLocaleString("th-TH"); }
function fmtDate(d:string){
  if(!d||d==="—") return "—";
  const [y,m,day]=d.split("-");
  const months=["","ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  return `${parseInt(day)} ${months[parseInt(m)]} ${parseInt(y)+543}`;
}
const PALETTE = ["#003366","#059669","#f59e0b","#dc2626","#002244","#8fa3b8","#2D2D2D","#C0C0C0"];
const PAGE_SIZE = 10;

// ── Optional table columns (แสดง/ซ่อนได้ผ่าน TableTools) ──────
// key ต้องตรงกับที่ใช้ hide/show ทั้ง <col>/<th>/<td>
const COLS: Col[] = [
  { key: "owner",          label: "ผู้รับผิดชอบ" },
  { key: "lastActivity",   label: "กิจกรรมล่าสุด" },
  { key: "quotationCount", label: "จำนวนใบเสนอราคา" },
  { key: "currentDeal",    label: "ดีลปัจจุบัน" },
];

// ── Derived (deterministic) per-customer values ──────────────
// ทุกฟังก์ชันรับ qs = ใบเสนอราคาจาก context (แหล่งความจริงเดียว) เพื่อให้ค่าตอบ runtime
// ลูกค้า "ใช้งานอยู่" จริงหรือไม่ — มีดีลที่กำลังดำเนินการ หรือใบเสนอราคาที่ยังไม่ปิด (ไม่นับที่แพ้/หมดอายุ)
// ใช้ผลนี้คู่กับ c.status ที่บันทึกไว้ (ถ้ามีกิจกรรมจริงถือว่าใช้งานอยู่เสมอ แม้ status จะถูกตั้งเป็น "ไม่ใช้งาน")
function hasOpenActivity(customerId:number, deals:PipelineDealMock[], qs:QuotationMock[]){
  const hasActiveDeal = deals.some(d=>d.customerId===customerId && d.outcome==="active");
  const hasOpenQuote  = qs.some(q=>q.customerId===customerId && (q.status==="draft"||q.status==="sent_to_client"||q.status==="viewed"));
  return hasActiveDeal || hasOpenQuote;
}
// จำนวนใบเสนอราคาของลูกค้า
function quotationCountFor(customerId:number, qs:QuotationMock[]){
  return qs.filter(q=>q.customerId===customerId).length;
}
// กิจกรรมล่าสุด — วันที่ใบเสนอราคาล่าสุด (deterministic) มิเช่นนั้นใช้วันที่เพิ่มลูกค้า
function lastActivityFor(customerId:number, joinDate:string, qs:QuotationMock[]){
  const dates = qs.filter(q=>q.customerId===customerId).map(q=>q.date);
  if(dates.length===0) return joinDate || "—";
  return dates.reduce((a,b)=>a>b?a:b);
}
// ดีลปัจจุบัน — ดีลที่ยัง active ของลูกค้า (เอาตัวแรกตามลำดับ deterministic)
function currentDealFor(customerId:number, deals:PipelineDealMock[]){
  return deals.find(d=>d.customerId===customerId && d.outcome==="active") ?? null;
}
// ── Per-customer metrics (deterministic, derived) ────────────
// ยอดขายรวม — ผลรวม totalValue ของใบเสนอราคาที่ปิดการขาย (won)
function totalSalesFor(customerId:number, qs:QuotationMock[]){
  return qs.filter(q=>q.customerId===customerId && q.status==="won").reduce((s,q)=>s+q.totalValue,0);
}
// จำนวนดีลที่กำลังดำเนินการ — deals (context) ที่ outcome==="active"
function activeDealsCountFor(customerId:number, deals:PipelineDealMock[]){
  return deals.filter(d=>d.customerId===customerId && d.outcome==="active").length;
}
// จำนวนใบเสนอราคาที่ปิดการขายแล้ว (won)
function wonQuotationCountFor(customerId:number, qs:QuotationMock[]){
  return qs.filter(q=>q.customerId===customerId && q.status==="won").length;
}

// ── Deterministic drawer feeds (จากลูกค้า + quotations + pipelineDeals) ──
// ไทม์ไลน์กิจกรรม — สร้างจากใบเสนอราคาและดีลของลูกค้า (deterministic)
function activityItemsFor(customerId:number, joinDate:string, qs:QuotationMock[], deals:PipelineDealMock[]): ActivityTimelineItem[] {
  const items: ActivityTimelineItem[] = [];
  // จากใบเสนอราคา
  qs.filter(q=>q.customerId===customerId).forEach(q=>{
    items.push({ id:`q-${q.id}`, type:"quote", text:`ใบเสนอราคา ${q.id} — ${q.project} (${quotationStatusLabel[q.status]})`, time:fmtDate(q.date) });
    if(q.status==="won") items.push({ id:`w-${q.id}`, type:"status", text:`ปิดการขายสำเร็จ — ${q.project}`, time:fmtDate(q.date) });
  });
  // จากดีลใน pipeline
  deals.filter(d=>d.customerId===customerId).forEach(d=>{
    items.push({ id:`d-${d.id}`, type:"status", text:`ดีล: ${d.project} · ${fmtMoney(d.value)}`, time:fmtDate(d.createdAt) });
  });
  // จุดเริ่มต้น: วันที่เพิ่มลูกค้า
  items.push({ id:"joined", type:"note", text:"เพิ่มลูกค้าเข้าระบบ", time:fmtDate(joinDate) });
  return items;
}
// รายการงาน (จากดีลของลูกค้าใน context) — deterministic
function taskItemsFor(customerId:number, deals:PipelineDealMock[]){
  return deals
    .filter(d=>d.customerId===customerId)
    .flatMap(d=>(d.tasks ?? []).map(t=>({ id:`${d.id}-${t.id}`, text:t.text, done:t.done, deal:d.project })));
}
// ประวัติ (deterministic) — เรียงจากเหตุการณ์ของลูกค้า
function historyItemsFor(customerId:number, joinDate:string, qs:QuotationMock[], deals:PipelineDealMock[]){
  const rows: {label:string; date:string}[] = [
    { label:"เพิ่มลูกค้าเข้าระบบ", date:joinDate },
  ];
  qs.filter(q=>q.customerId===customerId).forEach(q=>{
    rows.push({ label:`ออกใบเสนอราคา ${q.id}`, date:q.date });
    if(q.status==="won") rows.push({ label:`ปิดการขาย ${q.id}`, date:q.date });
  });
  deals.filter(d=>d.customerId===customerId).forEach(d=>{
    rows.push({ label:`สร้างดีล ${d.project}`, date:d.createdAt });
  });
  return rows.filter(r=>r.date && r.date!=="—").sort((a,b)=>a.date<b.date?1:-1);
}

// ── Customer Type: New / Existing (สถานะลูกค้า) ───────────────
// แยกจากประเภทลูกค้า (บุคคล/บริษัท) โดยเด็ดขาด
// เกณฑ์ (deterministic): มีใบเสนอราคาปิดการขาย ≥1 หรือ joinDate เก่ากว่า ~6 เดือน → ลูกค้าเดิม, มิฉะนั้น → ลูกค้าใหม่
type LifecycleType = "existing" | "new";
// วันอ้างอิงคงที่ (deterministic) = วันที่ในระบบ (currentDate 2026-07-01) ลบ 6 เดือน = 2026-01-01
const EXISTING_CUTOFF_DATE = "2026-01-01";
function lifecycleTypeFor(customerId:number, joinDate:string, qs:QuotationMock[]): LifecycleType {
  if(wonQuotationCountFor(customerId, qs) >= 1) return "existing";
  if(joinDate && joinDate !== "—" && joinDate < EXISTING_CUTOFF_DATE) return "existing";
  return "new";
}
const LIFECYCLE_META: Record<LifecycleType,{label:string; fg:string; bg:string}> = {
  existing: { label:"ลูกค้าเดิม", fg:"#059669", bg:"#e5faf0" },
  new:      { label:"ลูกค้าใหม่",       fg:"#003366", bg:"#dce5f0" },
};

// ── Add / Edit Modal ─────────────────────────────────────────
type CustomerForm = Omit<CustomerRow,"id"|"initials"|"color"|"totalValue">;
const BLANK_FORM: CustomerForm = { name:"",company:"",type:"บริษัท",email:"",phone:"",province:"กรุงเทพฯ",category:"โกดัง/คลังสินค้า",status:"active",projects:0,joinDate:"",owner:"สมชาย เชียงใหม่" };

function CustomerModal({ initial, title, onSave, onClose, owners }:{
  initial:CustomerForm; title:string; onSave:(f:CustomerForm)=>void; onClose:()=>void; owners:string[];
}){
  const [form, setForm] = useState<CustomerForm>(initial);
  function set<K extends keyof CustomerForm>(k:K,v:CustomerForm[K]){ setForm(p=>({...p,[k]:v})); }
  function submit(){ if(!form.company.trim()||!form.name.trim()) return; onSave(form); onClose(); }
  return (
    <>
      <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(45,45,45,.45)",zIndex:200}}/>
      <div style={{position:"fixed",inset:0,zIndex:210,display:"flex",alignItems:"center",justifyContent:"center",padding:24,pointerEvents:"none"}}>
        <div onClick={e=>e.stopPropagation()}
          style={{width:"100%",maxWidth:560,background:"#fff",borderRadius:20,border:`1px solid ${BORDER}`,boxShadow:"0 24px 80px rgba(0,0,0,.2)",pointerEvents:"auto",overflow:"hidden"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"18px 24px",borderBottom:`1px solid ${BORDER}`,background:PRIMARY}}>
            <div>
              <div style={{fontSize:"1rem",fontWeight:800,color:"#fff"}}>{title}</div>
              <div style={{fontSize:"0.7rem",color:"rgba(255,255,255,.65)"}}>กรอกข้อมูลลูกค้า</div>
            </div>
            <button onClick={onClose} style={{width:32,height:32,borderRadius:9,border:"1px solid rgba(255,255,255,.2)",background:"rgba(255,255,255,.1)",color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><X size={15}/></button>
          </div>
          <div style={{padding:"22px 24px",overflowY:"auto",maxHeight:"65vh"}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
              <div style={{gridColumn:"1/-1"}}>
                <label className="form-label">ประเภทลูกค้า</label>
                <div style={{display:"flex",background:"#f0f4f8",borderRadius:10,padding:3,border:`1px solid ${BORDER}`}}>
                  {CUSTOMER_TYPES.map(t=>(
                    <button key={t} type="button" onClick={()=>set("type",t)}
                      style={{flex:1,padding:"7px 12px",borderRadius:8,border:"none",background:form.type===t?PRIMARY:"transparent",color:form.type===t?"#fff":MUTED,fontSize:"0.74rem",fontWeight:700,cursor:"pointer",transition:"all .15s"}}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{gridColumn:"1/-1"}}>
                <label className="form-label">บริษัท *</label>
                <input className="form-input" value={form.company} onChange={e=>set("company",e.target.value)} placeholder="ชื่อบริษัท" autoFocus/>
              </div>
              <div>
                <label className="form-label">ผู้ติดต่อ *</label>
                <input className="form-input" value={form.name} onChange={e=>set("name",e.target.value)} placeholder="ชื่อผู้ติดต่อ"/>
              </div>
              <div>
                <label className="form-label">โทรศัพท์</label>
                <input className="form-input" value={form.phone} onChange={e=>set("phone",e.target.value)} placeholder="0XX-XXX-XXXX"/>
              </div>
              <div style={{gridColumn:"1/-1"}}>
                <label className="form-label">อีเมล</label>
                <input className="form-input" type="email" value={form.email} onChange={e=>set("email",e.target.value)} placeholder="email@company.com"/>
              </div>
              <div>
                <label className="form-label">จังหวัด</label>
                <select className="form-select" value={form.province} onChange={e=>set("province",e.target.value)}>
                  {PROVINCES.map(p=><option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">อุตสาหกรรม</label>
                <select className="form-select" value={form.category} onChange={e=>set("category",e.target.value)}>
                  {CATEGORIES.map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">ผู้รับผิดชอบ</label>
                <select className="form-select" value={form.owner} onChange={e=>set("owner",e.target.value)}>
                  {owners.map(o=><option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">สถานะ</label>
                <select className="form-select" value={form.status} onChange={e=>set("status",e.target.value as CustomerStatus)}>
                  <option value="active">ใช้งาน</option>
                  <option value="inactive">ไม่ใช้งาน</option>
                </select>
              </div>
              <div>
                <label className="form-label">วันที่เพิ่ม</label>
                <input className="form-input" type="date" value={form.joinDate} onChange={e=>set("joinDate",e.target.value)}/>
              </div>
            </div>
          </div>
          <div style={{padding:"14px 24px",borderTop:`1px solid ${BORDER}`,display:"flex",gap:8,justifyContent:"flex-end",background:"#fafafa"}}>
            <button className="btn btn-secondary btn-md" onClick={onClose}>ยกเลิก</button>
            <button className="btn btn-primary btn-md" onClick={submit}>บันทึก</button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Main Page ────────────────────────────────────────────────
// หน้าลูกค้าไม่ใช้ตัวกรองช่วงเวลากลาง (ไม่จำเป็น) — แสดงลูกค้าทั้งหมด ใช้ค้นหา/ตัวกรองในเครื่องแทน
export default function CustomersPage(){
  const router = useRouter();
  const {
    customers: data, quotations, deals,
    addCustomer: ctxAddCustomer, updateCustomer: ctxUpdateCustomer, deleteCustomer: ctxDeleteCustomer,
  } = useSales();
  const [query, setQuery]             = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL"|CustomerStatus>("ALL");
  const [catFilter, setCatFilter]     = useState("ALL");
  const [lifecycleFilter, setLifecycleFilter] = useState<"ALL"|LifecycleType>("ALL");
  const [sortKey, setSortKey]         = useState<SortKey>("company");
  const [sortDir, setSortDir]         = useState<SortDir>("asc");
  const [selected, setSelected]       = useState<CustomerRow|null>(null);
  const [page, setPage]               = useState(1);
  const [ownersList, setOwnersList]   = useState<string[]>(DEFAULT_OWNERS);
  useEffect(() => {
    const s = localStorage.getItem(RP_STORAGE_KEY);
    if (s) try {
      const arr: ResponsiblePerson[] = JSON.parse(s);
      setOwnersList(arr.filter(p => p.active).map(p => p.name));
    } catch {}
  }, []);
  // โมดัลรายละเอียด: ปิดด้วย Esc + ล็อกสกรอลล์พื้นหลัง (parity กับ RightDrawer)
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSelected(null); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [selected]);

  const [view, setView]               = useState<"card"|"table">("card");
  const [showFilter, setShowFilter]   = useState(false);
  const [showAdd, setShowAdd]         = useState(false);
  const [editingRow, setEditingRow]   = useState<CustomerRow|null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [detailTab, setDetailTab]     = useState<"info"|"quotes"|"appts"|"notes">("info");

  // View → RightDrawer (แทนการนำทางไป /customers/{id})
  const [drawerRow, setDrawerRow]     = useState<CustomerRow|null>(null);

  // Table layout (density + hidden columns) จาก TableTools
  const { density, setDensity, hiddenCols, toggleCol } = useTableLayout("customers");

  function handleSort(k: SortKey){ if(sortKey===k) setSortDir(d=>d==="asc"?"desc":"asc"); else{setSortKey(k);setSortDir("asc");} }

  const filtered = useMemo(()=>{
    let rows=data.filter(c=>{
      const q=query.toLowerCase();
      const matchQ=!q||c.company.toLowerCase().includes(q)||c.name.toLowerCase().includes(q)||c.province.toLowerCase().includes(q)||c.phone.includes(q);
      const matchS=statusFilter==="ALL"||c.status===statusFilter;
      const matchC=catFilter==="ALL"||c.category===catFilter;
      const matchL=lifecycleFilter==="ALL"||lifecycleTypeFor(c.id,c.joinDate,quotations)===lifecycleFilter;
      return matchQ&&matchS&&matchC&&matchL;
    });
    const sortVal=(c:CustomerRow):string|number=>{
      switch(sortKey){
        case "lastActivity":   return lastActivityFor(c.id,c.joinDate,quotations);
        case "quotationCount": return quotationCountFor(c.id,quotations);
        default:               return c[sortKey] as string|number;
      }
    };
    rows=[...rows].sort((a,b)=>{
      const va=sortVal(a);
      const vb=sortVal(b);
      // เรียงข้อความไทยตามพยัญชนะ (locale "th")
      if(typeof va==="string" && typeof vb==="string"){
        const cmp=va.localeCompare(vb,"th");
        return sortDir==="asc"?cmp:-cmp;
      }
      if(va<vb) return sortDir==="asc"?-1:1;
      if(va>vb) return sortDir==="asc"?1:-1;
      return 0;
    });
    return rows;
  },[data,quotations,query,statusFilter,catFilter,lifecycleFilter,sortKey,sortDir]);

  // ── Pagination (client-side) ──────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // รีเซ็ต/clamp หน้าเมื่อค้นหา/เรียง/ตัวกรองเปลี่ยน หรือจำนวนหน้าลดลง
  useEffect(() => { setPage(1); }, [query,statusFilter,catFilter,lifecycleFilter,sortKey,sortDir]);
  useEffect(() => { setPage(p => Math.min(p, totalPages)); }, [totalPages]);
  const pageStart = (page - 1) * PAGE_SIZE;
  const paged     = filtered.slice(pageStart, pageStart + PAGE_SIZE);
  const rangeFrom = filtered.length === 0 ? 0 : pageStart + 1;
  const rangeTo   = Math.min(pageStart + PAGE_SIZE, filtered.length);

  // สรุปด้านบนนับจากลูกค้าทั้งหมด (ไม่ผูกกับตัวกรองสถานะ/หมวดในเครื่อง)
  const scoped        = data;
  const totalAll      = scoped.length;
  const totalActive   = scoped.filter(c=>c.status==="active"||hasOpenActivity(c.id,deals,quotations)).length;
  const totalInactive = totalAll - totalActive;
  const totalValue    = scoped.reduce((s,c)=>s+c.totalValue,0);

  // Related data for selected customer
  const relatedQuotations   = selected ? quotations.filter(q=>q.customerId===selected.id) : [];
  const relatedLeads        = selected ? leads.filter(l=>l.company===selected.company||l.customerId===selected.id) : [];
  const relatedAppointments = selected ? appointments.filter(a=>a.company===selected.company) : [];
  const relatedNotes        = selected ? notes.filter(n=>n.customerId===selected.id) : [];

  function addCustomer(form: CustomerForm){
    const maxId = Math.max(...data.map(c=>c.id),0);
    const color = PALETTE[maxId % PALETTE.length];
    ctxAddCustomer({...form,id:maxId+1,initials:initials(form.company),color,totalValue:0});
  }
  function saveEdit(form: CustomerForm){
    if(!editingRow) return;
    const updated: CustomerRow = {...editingRow,...form,initials:initials(form.company)};
    ctxUpdateCustomer(updated);
    setSelected(p=>p&&p.id===editingRow.id?updated:p);
  }
  function deleteCustomer(){
    if(!selected) return;
    ctxDeleteCustomer(selected.id);
    setSelected(null); setShowDeleteConfirm(false);
  }
  function toggleStatus(id:number){
    const target = data.find(c=>c.id===id);
    if(!target) return;
    const updated: CustomerRow = {...target,status:target.status==="active"?"inactive":"active"};
    ctxUpdateCustomer(updated);
    setSelected(p=>p&&p.id===id?updated:p);
  }

  const SortIcon = ({k}:{k:SortKey})=>sortKey===k
    ? (sortDir==="asc"?<ChevronUp size={11} style={{marginLeft:2}}/>:<ChevronDown size={11} style={{marginLeft:2}}/>)
    : <ChevronDown size={11} style={{marginLeft:2,opacity:0.3}}/>;

  const detailTabs: {key:"info"|"quotes"|"appts"|"notes"; label:string; icon:React.ReactNode}[] = [
    {key:"info",    label:"ข้อมูล",     icon:<Building2 size={11}/>},
    {key:"quotes",  label:`ใบเสนอ (${relatedQuotations.length})`, icon:<FileText size={11}/>},
    {key:"appts",   label:`นัดหมาย (${relatedAppointments.length})`,icon:<Calendar size={11}/>},
    {key:"notes",   label:`โน้ต (${relatedNotes.length})`, icon:<StickyNote size={11}/>},
  ];

  // Stat cards meta
  const STATS: {label:string; value:string|number; icon:React.ReactNode; iconBg:string; key:"ALL"|CustomerStatus|null}[] = [
    {label:"ลูกค้าทั้งหมด", value:totalAll,             icon:<Building2 size={20}/>, iconBg:"#dce5f0", key:"ALL"},
    {label:"ใช้งานอยู่",    value:totalActive,          icon:<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#059669" strokeWidth="1.9"><polyline points="20 6 9 17 4 12"/></svg>, iconBg:"#e5faf0", key:"active"},
    {label:"ไม่ใช้งาน",     value:totalInactive,        icon:<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#64748b" strokeWidth="1.9"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>, iconBg:"#f1f5f9", key:"inactive"},
    {label:"มูลค่ารวม",     value:fmtMoney(totalValue), icon:<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke={PRIMARY} strokeWidth="1.9"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>, iconBg:"#dce5f0", key:null},
  ];

  // แถบแบ่งหน้า — "แสดง X–Y จาก Z" ซ้าย · Prev / หน้า p / total / Next ขวา
  const Pagination = () => {
    const btnStyle = (disabled:boolean): React.CSSProperties => ({
      display:"inline-flex",alignItems:"center",justifyContent:"center",
      padding:"5px 12px",borderRadius:8,border:`1px solid ${BORDER}`,
      background:disabled?"#f1f5f9":"#fff",color:disabled?"#9ca3af":PRIMARY,
      fontSize:"0.7rem",fontWeight:700,cursor:disabled?"not-allowed":"pointer",
      opacity:disabled?0.7:1,transition:"all .15s",
    });
    return (
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
        <span style={{fontSize:"0.7rem",color:MUTED}}>แสดง {rangeFrom}–{rangeTo} จาก {filtered.length} รายการ</span>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <button type="button" onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page<=1} style={btnStyle(page<=1)}>ก่อนหน้า</button>
          <span style={{fontSize:"0.7rem",fontWeight:700,color:STEEL,padding:"0 4px"}}>หน้า {page} / {totalPages}</span>
          <button type="button" onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page>=totalPages} style={btnStyle(page>=totalPages)}>ถัดไป</button>
        </div>
      </div>
    );
  };

  // ── RightDrawer (View) — 7 แท็บ deterministic ────────────────
  const drawerTabs: DrawerTab[] = useMemo(()=>{
    const c = drawerRow;
    if(!c) return [];
    const dQuotations = quotations.filter(q=>q.customerId===c.id);
    const dActivities = activityItemsFor(c.id, c.joinDate, quotations, deals);
    const dTasks      = taskItemsFor(c.id, deals);
    const dHistory    = historyItemsFor(c.id, c.joinDate, quotations, deals);
    const lc          = lifecycleTypeFor(c.id, c.joinDate, quotations);

    const emptyState = (msg:string)=>(
      <div style={{textAlign:"center",padding:"28px 8px",color:"#9aa2ad",fontSize:"0.82rem"}}>{msg}</div>
    );

    return [
      // 1) ภาพรวม (Overview)
      { key:"overview", label:"ภาพรวม", content:(
        <>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:18}}>
            {[
              {label:"ยอดขายรวม",     val:fmtMoney(totalSalesFor(c.id,quotations)),                 accent:PRIMARY,   bg:"#dce5f0"},
              {label:"ใบเสนอราคา",    val:quotationCountFor(c.id,quotations).toString(),            accent:STEEL,     bg:"#f0f4f8"},
              {label:"ดีลที่ดำเนินการ", val:activeDealsCountFor(c.id,deals).toString(),          accent:"#059669", bg:"#e5faf0"},
            ].map((s,i)=>(
              <div key={i} style={{background:s.bg,borderRadius:10,padding:"12px 8px",textAlign:"center"}}>
                <div style={{fontSize:"0.9rem",fontWeight:800,color:s.accent,lineHeight:1.2}}>{s.val}</div>
                <div style={{fontSize:"0.58rem",color:MUTED,marginTop:4,fontWeight:600}}>{s.label}</div>
              </div>
            ))}
          </div>
          <DrawerSection title="ข้อมูลลูกค้า">
            <DrawerRow label="บริษัท"        value={c.company} />
            <DrawerRow label="ผู้ติดต่อ"      value={c.name} />
            <DrawerRow label="โทร"           value={c.phone} />
            <DrawerRow label="อีเมล"         value={c.email} />
            <DrawerRow label="จังหวัด"        value={c.province} />
            <DrawerRow label="ผู้รับผิดชอบ"    value={c.owner} />
            <DrawerRow label="ประเภท"        value={c.type} />
            <DrawerRow label="อุตสาหกรรม"    value={c.category} />
            <DrawerRow label="สถานะลูกค้า"    value={LIFECYCLE_META[lc].label} />
          </DrawerSection>
        </>
      )},
      // 2) กิจกรรม (Activities)
      { key:"activities", label:"กิจกรรม", content:(
        <DrawerSection title="ไทม์ไลน์กิจกรรม">
          <ActivityTimeline items={dActivities} />
        </DrawerSection>
      )},
      // ใบเสนอราคา (Quotation)
      { key:"quotation", label:"ใบเสนอราคา", content:(
        dQuotations.length===0 ? emptyState("ยังไม่มีใบเสนอราคา") : (
          <DrawerSection title={`ใบเสนอราคา (${dQuotations.length})`}>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {dQuotations.map(q=>(
                <button key={q.id} onClick={()=>router.push("/quotations")}
                  style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,padding:"10px 12px",borderRadius:10,background:"#f8f9fb",border:`1px solid #eef0f4`,cursor:"pointer",textAlign:"left",width:"100%",fontFamily:"inherit"}}>
                  <div style={{minWidth:0,flex:1}}>
                    <div style={{fontSize:"0.7rem",fontWeight:700,color:PRIMARY,fontFamily:"monospace"}}>{q.id}</div>
                    <div style={{fontSize:"0.78rem",fontWeight:700,color:STEEL,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{q.project}</div>
                    <div style={{fontSize:"0.68rem",color:MUTED,marginTop:1}}>{q.total} · {fmtDate(q.date)}</div>
                  </div>
                  <span className="badge" style={{flexShrink:0,background:quotationStatusColor[q.status].bg,color:quotationStatusColor[q.status].text}}>
                    {quotationStatusLabel[q.status]}
                  </span>
                </button>
              ))}
            </div>
          </DrawerSection>
        )
      )},
      // 5) ไฟล์ (Files)
      { key:"files", label:"ไฟล์", content: emptyState("ยังไม่มีไฟล์แนบ") },
    ];
  },[drawerRow,router,quotations,deals]);

  return (
    <div className="erp" style={{display:"flex",gap:16,alignItems:"flex-start"}}>

      {/* ══ MAIN ══════════════════════════════════════════════ */}
      <div style={{flex:1,minWidth:0}}>

        {/* Header */}
        <div className="page-head">
          <div>
            <h2>ลูกค้า</h2>
            <p>จัดการข้อมูลลูกค้าและความสัมพันธ์ทางธุรกิจ</p>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <ExportMenu filename="customers" title="รายชื่อลูกค้า"
              headers={["บริษัท","ผู้ติดต่อ","โทรศัพท์","จังหวัด","ผู้รับผิดชอบ","กิจกรรมล่าสุด","จำนวนใบเสนอราคา","ดีลปัจจุบัน","มูลค่าดีล"]}
              rows={filtered.map(c=>{
                const deal=currentDealFor(c.id,deals);
                return [c.company,c.name,c.phone,c.province,c.owner,lastActivityFor(c.id,c.joinDate,quotations),quotationCountFor(c.id,quotations),deal?deal.project:"—",deal?fmtMoney(deal.value):"—"];
              })} />
            <button className="btn btn-primary btn-md" onClick={()=>setShowAdd(true)}>
              <Plus size={13}/> เพิ่มลูกค้า
            </button>
          </div>
        </div>

        {/* Stat cards */}
        <div className="stat-grid">
          {STATS.map((s,i)=>(
            <div key={i}
              className={`stat-card${s.key!==null?" clickable":""}`}
              onClick={()=>s.key!==null?setStatusFilter(s.key as "ALL"|CustomerStatus):undefined}>
              <div className="stat-icon" style={{background:s.iconBg}}>{s.icon}</div>
              <div className="stat-label">{s.label}</div>
              <div className="stat-value">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div style={{marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              {/* Search */}
              <div className="search-bar" style={{minWidth:220}}>
                <Search size={13} color="#9ca3af"/>
                <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="ค้นหาลูกค้า..."/>
                {query&&<button onClick={()=>setQuery("")} style={{background:"none",border:"none",cursor:"pointer",padding:0,color:MUTED,display:"flex"}}><X size={12}/></button>}
              </div>
              {/* Filter toggle */}
              <button className={`btn btn-sm ${showFilter?"btn-primary":"btn-secondary"}`} onClick={()=>setShowFilter(f=>!f)}>
                <Filter size={13}/> ตัวกรอง
              </button>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              {/* View toggle */}
              <div style={{display:"flex",alignItems:"center",background:"#f0f4f8",borderRadius:99,padding:3,border:`1px solid ${BORDER}`}}>
                {(["card","table"] as const).map(v=>(
                  <button key={v} onClick={()=>setView(v)}
                    style={{display:"flex",alignItems:"center",gap:5,padding:"5px 12px",borderRadius:99,border:"none",background:view===v?PRIMARY:"transparent",color:view===v?"#fff":MUTED,fontSize:"0.71rem",fontWeight:700,cursor:"pointer",transition:"all .15s"}}>
                    {v==="card"?<LayoutGrid size={13}/>:<LayoutList size={13}/>}
                    {v==="card"?"การ์ด":"ตาราง"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Filter panel */}
          {showFilter&&(
            <div style={{marginTop:10,padding:"12px 14px",background:"#f8f9fb",borderRadius:12,border:`1px solid ${BORDER}`,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              <span style={{fontSize:"0.68rem",fontWeight:700,color:MUTED,marginRight:2}}>สถานะ:</span>
              {(["ALL","active","inactive"] as const).map(s=>(
                <button key={s} onClick={()=>setStatusFilter(s)}
                  style={{padding:"5px 12px",borderRadius:99,border:`1px solid ${statusFilter===s?PRIMARY:BORDER}`,background:statusFilter===s?PRIMARY:"#fff",color:statusFilter===s?"#fff":MUTED,fontSize:"0.7rem",fontWeight:700,cursor:"pointer"}}>
                  {s==="ALL"?"ทั้งหมด":s==="active"?"ใช้งาน":"ไม่ใช้งาน"}
                </button>
              ))}
              <div style={{width:1,height:20,background:BORDER,margin:"0 4px"}}/>
              <span style={{fontSize:"0.68rem",fontWeight:700,color:MUTED,marginRight:2}}>อุตสาหกรรม:</span>
              {["ALL",...CATEGORIES].map(cat=>(
                <button key={cat} onClick={()=>setCatFilter(cat)}
                  style={{padding:"5px 11px",borderRadius:99,border:`1px solid ${catFilter===cat?"#C0C0C0":BORDER}`,background:catFilter===cat?"#f0f4f8":"#fff",color:catFilter===cat?STEEL:MUTED,fontSize:"0.68rem",fontWeight:600,cursor:"pointer"}}>
                  {cat==="ALL"?"ทั้งหมด":cat}
                </button>
              ))}
              <div style={{width:1,height:20,background:BORDER,margin:"0 4px"}}/>
              <span style={{fontSize:"0.68rem",fontWeight:700,color:MUTED,marginRight:2}}>สถานะลูกค้า:</span>
              {(["ALL","new","existing"] as const).map(lc=>(
                <button key={lc} onClick={()=>setLifecycleFilter(lc)}
                  style={{padding:"5px 11px",borderRadius:99,
                    border:`1px solid ${lifecycleFilter===lc?(lc==="existing"?LIFECYCLE_META.existing.fg:lc==="new"?LIFECYCLE_META.new.fg:PRIMARY):BORDER}`,
                    background:lifecycleFilter===lc?(lc==="existing"?LIFECYCLE_META.existing.bg:lc==="new"?LIFECYCLE_META.new.bg:"#f0f4f8"):"#fff",
                    color:lifecycleFilter===lc?(lc==="existing"?LIFECYCLE_META.existing.fg:lc==="new"?LIFECYCLE_META.new.fg:STEEL):MUTED,
                    fontSize:"0.68rem",fontWeight:700,cursor:"pointer"}}>
                  {lc==="ALL"?"ทั้งหมด":lc==="new"?"ลูกค้าใหม่":"ลูกค้าเดิม"}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── CARD VIEW ── */}
        {view==="card"&&(
          <div>
            {filtered.length===0?(
              <div className="card" style={{padding:"48px 0",textAlign:"center",color:MUTED,fontSize:"0.82rem"}}>ไม่พบลูกค้าที่ตรงกับเงื่อนไข</div>
            ):(
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
                {paged.map(c=>{
                  const isSel=selected?.id===c.id;
                  const activeDeals=activeDealsCountFor(c.id,deals);
                  // มีดีล/ใบเสนอราคาที่ยังไม่ปิดอยู่จริง → ถือว่าใช้งานอยู่เสมอ แม้ status ที่บันทึกไว้จะเป็น "ไม่ใช้งาน"
                  const isActive=c.status==="active"||hasOpenActivity(c.id,deals,quotations);
                  return (
                    <div key={c.id} className="card" onClick={()=>{ setSelected(s=>s?.id===c.id?null:c); setDetailTab("info"); setShowDeleteConfirm(false); }}
                      style={{cursor:"pointer",overflow:"hidden",position:"relative",border:isSel?`1.5px solid ${PRIMARY}`:`1px solid ${BORDER}`,boxShadow:isSel?"0 4px 18px rgba(0,0,0,.15)":undefined,transition:"box-shadow .15s,border .15s",opacity:isActive?1:0.78}}
                      onMouseEnter={e=>{if(!isSel)(e.currentTarget as HTMLElement).style.boxShadow="0 6px 22px rgba(0,0,0,.13)";}}
                      onMouseLeave={e=>{if(!isSel)(e.currentTarget as HTMLElement).style.boxShadow="";}}>
                      {/* view → RightDrawer (ไม่นำทางออกหน้า) */}
                      <button className="btn btn-secondary btn-sm" onClick={e=>{e.stopPropagation();setDrawerRow(c);}}
                        style={{position:"absolute",top:10,right:10,padding:"3px 8px",fontSize:"0.62rem",color:PRIMARY}}>
                        ดู →
                      </button>
                      <div style={{padding:"20px 18px 14px",textAlign:"center"}}>
                        <div style={{width:52,height:52,borderRadius:"50%",background:c.color,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:"1rem",margin:"0 auto 10px",boxShadow:`0 4px 12px ${c.color}55`}}>
                          {c.initials}
                        </div>
                        <div style={{fontSize:"0.88rem",fontWeight:800,color:STEEL,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",paddingRight:36}}>{c.company}</div>
                        <div style={{fontSize:"0.7rem",color:MUTED,marginTop:2,fontWeight:500}}>{c.name} · {c.category}</div>
                        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:4,marginTop:6,fontSize:"0.7rem",color:MUTED}}>
                          <Phone size={10} color="#C0C0C0"/> {c.phone}
                        </div>
                        {c.totalValue>0&&(
                          <div style={{fontSize:"0.72rem",fontWeight:700,color:PRIMARY,marginTop:5}}>{fmtMoney(c.totalValue)}</div>
                        )}
                      </div>
                      <div style={{padding:"10px 16px 14px",display:"flex",alignItems:"center",justifyContent:"center",gap:6,borderTop:`1px solid #f0f4f8`}}>
                        <span className="badge" style={{background:isActive?"#e5faf0":"#f1f5f9",color:isActive?"#059669":"#64748b"}}>
                          {isActive?"ใช้งาน":"ไม่ใช้งาน"}
                        </span>
                        <span className="badge" style={{background:activeDeals>0?"#dce5f0":"#f1f5f9",color:activeDeals>0?PRIMARY:"#9ca3af"}}>
                          {activeDeals} โอกาสการขาย
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{marginTop:12,padding:"4px 2px"}}>
              <Pagination />
            </div>
          </div>
        )}

        {/* ── TABLE VIEW ── */}
        {view==="table"&&(
          <div className="card">
            <div className={`table-wrap${density==="compact"?" dense":""}`} style={{borderTop:"none"}}>
              <table>
                <colgroup>
                  <col style={{width:"20%"}} />{/* บริษัท */}
                  <col style={{width:"12%"}} />{/* ผู้ติดต่อ */}
                  <col style={{width:"11%"}} />{/* โทรศัพท์ */}
                  <col style={{width:"9%"}}  />{/* จังหวัด */}
                  {!hiddenCols.includes("owner")          && <col style={{width:"11%"}} />}{/* ผู้รับผิดชอบ */}
                  {!hiddenCols.includes("lastActivity")   && <col style={{width:"11%"}} />}{/* กิจกรรมล่าสุด */}
                  {!hiddenCols.includes("quotationCount") && <col style={{width:"8%"}}  />}{/* จำนวนใบเสนอราคา */}
                  {!hiddenCols.includes("currentDeal")    && <col style={{width:"11%"}} />}{/* ดีลปัจจุบัน */}
                  <col style={{width:"7%"}}  />{/* ดู */}
                </colgroup>
                <thead>
                  <tr>
                    {([
                      {label:"บริษัท",key:"company",colKey:null},
                      {label:"ผู้ติดต่อ",key:"name",colKey:null},
                      {label:"โทรศัพท์",key:"phone",colKey:null},
                      {label:"จังหวัด",key:"province",colKey:null},
                      {label:"ผู้รับผิดชอบ",key:"owner",colKey:"owner"},
                      {label:"กิจกรรมล่าสุด",key:"lastActivity",colKey:"lastActivity"},
                      {label:"ใบเสนอราคา",key:"quotationCount",colKey:"quotationCount"},
                    ] as {label:string;key:SortKey;colKey:string|null}[])
                      .filter(col=>col.colKey===null||!hiddenCols.includes(col.colKey))
                      .map(col=>(
                        <th key={col.key} onClick={()=>handleSort(col.key)} style={{cursor:"pointer",userSelect:"none"}}>
                          <span style={{display:"inline-flex",alignItems:"center"}}>{col.label}<SortIcon k={col.key}/></span>
                        </th>
                    ))}
                    {!hiddenCols.includes("currentDeal") && <th>ดีลปัจจุบัน</th>}
                    <th/>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length===0&&(
                    <tr><td colSpan={9} style={{textAlign:"center",padding:"40px 0",color:MUTED,fontSize:"0.82rem"}}>ไม่พบลูกค้า</td></tr>
                  )}
                  {paged.map(c=>{
                    const isSel=selected?.id===c.id;
                    const qCount=quotationCountFor(c.id,quotations);
                    const lastAct=lastActivityFor(c.id,c.joinDate,quotations);
                    const deal=currentDealFor(c.id,deals);
                    return(
                      <tr key={c.id} className="clickable" onClick={()=>{setSelected(s=>s?.id===c.id?null:c);setDetailTab("info");setShowDeleteConfirm(false);}}
                        style={isSel?{background:"#f0f6ff"}:undefined}>
                        {/* บริษัท */}
                        <td>
                          <div style={{display:"flex",alignItems:"center",gap:10}}>
                            <div style={{width:34,height:34,borderRadius:10,background:c.color,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:"0.7rem"}}>{c.initials}</div>
                            <div style={{minWidth:0}}>
                              <div style={{display:"flex",alignItems:"center",gap:6}}>
                                <div style={{fontSize:"0.83rem",fontWeight:700,color:STEEL,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.company}</div>
                                {(()=>{ const m=LIFECYCLE_META[lifecycleTypeFor(c.id,c.joinDate,quotations)];
                                  return <span style={{flexShrink:0,padding:"1px 7px",borderRadius:99,fontSize:"0.58rem",fontWeight:700,background:m.bg,color:m.fg}}>{lifecycleTypeFor(c.id,c.joinDate,quotations)==="existing"?"เดิม":"ใหม่"}</span>;
                                })()}
                              </div>
                              <div style={{fontSize:"0.69rem",color:MUTED,marginTop:1}}>{c.category}</div>
                            </div>
                          </div>
                        </td>
                        {/* ผู้ติดต่อ */}
                        <td style={{color:STEEL,fontWeight:600}}>{c.name}</td>
                        {/* โทรศัพท์ */}
                        <td style={{color:MUTED,whiteSpace:"nowrap"}}>
                          <span style={{display:"inline-flex",alignItems:"center",gap:5}}><Phone size={11} color="#C0C0C0"/>{c.phone}</span>
                        </td>
                        {/* จังหวัด */}
                        <td style={{color:MUTED}}>{c.province}</td>
                        {/* ผู้รับผิดชอบ */}
                        {!hiddenCols.includes("owner") && (
                          <td style={{color:STEEL,fontWeight:600,fontSize:"0.76rem"}}>{c.owner}</td>
                        )}
                        {/* กิจกรรมล่าสุด */}
                        {!hiddenCols.includes("lastActivity") && (
                          <td style={{color:MUTED,whiteSpace:"nowrap"}}>{fmtDate(lastAct)}</td>
                        )}
                        {/* จำนวนใบเสนอราคา */}
                        {!hiddenCols.includes("quotationCount") && (
                          <td>
                            <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",minWidth:24,height:22,padding:"0 8px",borderRadius:99,fontSize:"0.7rem",fontWeight:800,background:qCount>0?"#dce5f0":"#f1f5f9",color:qCount>0?PRIMARY:"#9ca3af"}}>{qCount}</span>
                          </td>
                        )}
                        {/* ดีลปัจจุบัน */}
                        {!hiddenCols.includes("currentDeal") && (
                          <td>
                            {deal?(
                              <div style={{minWidth:0}}>
                                <div style={{fontSize:"0.74rem",fontWeight:700,color:STEEL,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{deal.project}</div>
                                <div style={{fontSize:"0.68rem",fontWeight:700,color:PRIMARY,marginTop:1}}>{fmtMoney(deal.value)}</div>
                              </div>
                            ):(
                              <span style={{color:"#9ca3af"}}>—</span>
                            )}
                          </td>
                        )}
                        {/* ดู → RightDrawer (ไม่นำทางออกหน้า) */}
                        <td onClick={e=>e.stopPropagation()}>
                          <button className="btn btn-secondary btn-sm" onClick={()=>setDrawerRow(c)} style={{color:PRIMARY}}>ดู →</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{padding:"10px 16px",borderTop:`1px solid ${BORDER}`}}>
              <Pagination />
            </div>
          </div>
        )}
      </div>

      {/* ══ DETAIL PANEL ══════════════════════════════════════ */}
      {selected&&(
        <>
          <div onClick={()=>setSelected(null)} style={{position:"fixed",inset:0,background:"rgba(45,45,45,.45)",zIndex:200}}/>
          <div style={{position:"fixed",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:760,maxWidth:"calc(100vw - 32px)",height:"min(660px, calc(100vh - 48px))",zIndex:210,background:"#fff",borderRadius:18,boxShadow:"0 24px 80px rgba(0,0,0,.22)",display:"flex",flexDirection:"column",overflow:"hidden"}}>

            {/* Header */}
            <div style={{background:PRIMARY,padding:"16px 18px 12px",flexShrink:0}}>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:10}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:44,height:44,borderRadius:13,background:"rgba(255,255,255,.18)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:"1rem",border:"2px solid rgba(255,255,255,.25)",flexShrink:0}}>
                    {selected.initials}
                  </div>
                  <div>
                    <div style={{fontSize:"0.92rem",fontWeight:800,color:"#fff",lineHeight:1.2}}>{selected.company}</div>
                    <div style={{fontSize:"0.68rem",color:"rgba(255,255,255,.65)",marginTop:2}}>{selected.category} · {selected.province}</div>
                  </div>
                </div>
                <button onClick={()=>setSelected(null)} style={{background:"rgba(255,255,255,.15)",border:"none",borderRadius:8,width:28,height:28,cursor:"pointer",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <X size={14}/>
                </button>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                <button onClick={()=>toggleStatus(selected.id)}
                  style={{padding:"2px 10px",borderRadius:99,fontSize:"0.64rem",fontWeight:700,background:selected.status==="active"?"#e5faf0":"#f1f5f9",color:selected.status==="active"?"#059669":"#9ca3af",border:"none",cursor:"pointer"}}>
                  {selected.status==="active"?"ใช้งาน":"ไม่ใช้งาน"}
                </button>
                <span style={{padding:"2px 10px",borderRadius:99,fontSize:"0.64rem",fontWeight:700,background:"rgba(255,255,255,.18)",color:"#fff"}}>
                  {selected.type}
                </span>
                {/* สถานะลูกค้า: ลูกค้าใหม่ / ลูกค้าเดิม (แยกจากประเภทลูกค้า บุคคล/บริษัท) */}
                {(() => {
                  const lc = lifecycleTypeFor(selected.id, selected.joinDate, quotations);
                  const m  = LIFECYCLE_META[lc];
                  return (
                    <span style={{padding:"2px 10px",borderRadius:99,fontSize:"0.64rem",fontWeight:700,background:m.bg,color:m.fg}}>
                      {m.label}
                    </span>
                  );
                })()}
              </div>
            </div>

            {/* Tabs */}
            <div className="tab-bar" style={{flexShrink:0}}>
              {detailTabs.map(t=>(
                <button key={t.key} className={`tab-item${detailTab===t.key?" active":""}`} onClick={()=>setDetailTab(t.key)}
                  style={{display:"flex",alignItems:"center",gap:4}}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            {/* Body — 760px 2 คอลัมน์ */}
            <div style={{display:"flex",flex:1,overflow:"hidden"}}>
            <div style={{flex:1,overflowY:"auto",borderRight:`1px solid #f0f4f8`}}>

            {/* Tab: ข้อมูล */}
            {detailTab==="info"&&(
              <>
                {/* Customer Summary Card — 3 tiles (deterministic, derived) */}
                <div style={{padding:"14px 16px",borderBottom:`1px solid #f0f4f8`}}>
                  <div style={{fontSize:"0.63rem",fontWeight:700,color:MUTED,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10}}>สรุปข้อมูลลูกค้า</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                    {[
                      {label:"ยอดขายรวม",       val:fmtMoney(totalSalesFor(selected.id,quotations)),          accent:PRIMARY,   bg:"#dce5f0"},
                      {label:"ใบเสนอราคา",      val:quotationCountFor(selected.id,quotations).toString(),      accent:STEEL,     bg:"#f0f4f8"},
                      {label:"ดีลที่ดำเนินการ",  val:activeDealsCountFor(selected.id,deals).toString(),    accent:"#059669", bg:"#e5faf0"},
                    ].map((item,i)=>(
                      <div key={i} style={{background:item.bg,borderRadius:10,padding:"12px 8px",textAlign:"center"}}>
                        <div style={{fontSize:"0.86rem",fontWeight:800,color:item.accent,lineHeight:1.2}}>{item.val}</div>
                        <div style={{fontSize:"0.58rem",color:MUTED,marginTop:4,fontWeight:600}}>{item.label}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{display:"flex",gap:14,marginTop:8,fontSize:"0.56rem",color:"#9ca3af",fontWeight:500}}>
                    <span>ยอดขายรวม = ผลรวมใบเสนอราคาที่ปิดการขาย</span>
                    <span>ดีล = pipeline ที่กำลังดำเนินการ</span>
                  </div>
                </div>

                <div style={{padding:"14px 16px",borderBottom:`1px solid #f0f4f8`}}>
                  <div style={{fontSize:"0.63rem",fontWeight:700,color:MUTED,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10}}>ข้อมูลติดต่อ</div>
                  {([
                    {icon:<Building2 size={13} color={PRIMARY}/>,label:"เจ้าของ",   val:selected.name},
                    {icon:<Mail      size={13} color={PRIMARY}/>,label:"อีเมล",     val:selected.email},
                    {icon:<Phone     size={13} color={PRIMARY}/>,label:"โทรศัพท์", val:selected.phone},
                    {icon:<MapPin    size={13} color={PRIMARY}/>,label:"จังหวัด",   val:selected.province},
                  ]).map((row,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:8}}>
                      <div style={{width:28,height:28,borderRadius:8,background:"#dce5f0",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{row.icon}</div>
                      <div>
                        <div style={{fontSize:"0.62rem",color:"#9ca3af",fontWeight:600}}>{row.label}</div>
                        <div style={{fontSize:"0.76rem",color:STEEL,fontWeight:600,marginTop:1}}>{row.val}</div>
                      </div>
                    </div>
                  ))}
                  <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
                    <div style={{width:28,height:28,borderRadius:8,background:"#dce5f0",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <svg width={13} height={13} fill="none" viewBox="0 0 24 24" stroke={PRIMARY} strokeWidth={2}><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/></svg>
                    </div>
                    <div>
                      <div style={{fontSize:"0.62rem",color:"#9ca3af",fontWeight:600}}>ผู้รับผิดชอบ</div>
                      <div style={{fontSize:"0.76rem",color:STEEL,fontWeight:600,marginTop:1}}>{selected.owner}</div>
                    </div>
                  </div>
                </div>

                {/* Related leads */}
                {relatedLeads.length>0&&(
                  <div style={{padding:"12px 16px",borderBottom:`1px solid #f0f4f8`}}>
                    <div style={{fontSize:"0.63rem",fontWeight:700,color:MUTED,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>ผู้สนใจที่เกี่ยวข้อง ({relatedLeads.length})</div>
                    {relatedLeads.map(l=>(
                      <button key={l.id} onClick={()=>router.push(`/leads/${l.numId}`)}
                        style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"7px 10px",borderRadius:9,border:`1px solid ${BORDER}`,background:"#fff",cursor:"pointer",marginBottom:5,textAlign:"left"}}
                        onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="#dce5f0";}}
                        onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="#fff";}}>
                        <span style={{padding:"2px 7px",borderRadius:6,fontSize:"0.6rem",fontWeight:700,background:"#dce5f0",color:PRIMARY,flexShrink:0}}>ผู้สนใจ</span>
                        <span style={{fontSize:"0.75rem",fontWeight:700,color:STEEL,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.company}</span>
                        <span style={{fontSize:"0.62rem",color:PRIMARY}}>→</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Tab: ใบเสนอราคา */}
            {detailTab==="quotes"&&(
              <div style={{padding:"12px 16px"}}>
                {relatedQuotations.length===0?(
                  <div style={{fontSize:"0.78rem",color:MUTED,textAlign:"center",padding:"24px 0"}}>ยังไม่มีใบเสนอราคา</div>
                ):(
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {relatedQuotations.map(q=>(
                      <button key={q.id} onClick={()=>router.push("/quotations")}
                        style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 12px",borderRadius:10,background:"#f8f9fb",border:`1px solid #eef0f4`,cursor:"pointer",textAlign:"left",width:"100%"}}
                        onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="#fef3cd";}}
                        onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="#f8f9fb";}}>
                        <div style={{minWidth:0,flex:1}}>
                          <div style={{fontSize:"0.72rem",fontWeight:700,color:PRIMARY,fontFamily:"monospace"}}>{q.id}</div>
                          <div style={{fontSize:"0.75rem",fontWeight:700,color:STEEL,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{q.project}</div>
                          <div style={{fontSize:"0.68rem",color:MUTED,marginTop:1}}>{q.total}</div>
                        </div>
                        <span className="badge" style={{marginLeft:8,flexShrink:0,background:quotationStatusColor[q.status].bg,color:quotationStatusColor[q.status].text}}>
                          {quotationStatusLabel[q.status]}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab: นัดหมาย */}
            {detailTab==="appts"&&(
              <div style={{padding:"12px 16px"}}>
                {relatedAppointments.length===0?(
                  <div style={{fontSize:"0.78rem",color:MUTED,textAlign:"center",padding:"24px 0"}}>ยังไม่มีนัดหมาย</div>
                ):(
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {relatedAppointments.map(a=>(
                      <button key={a.id} onClick={()=>router.push("/calendar")}
                        style={{display:"flex",alignItems:"flex-start",gap:10,padding:"10px 12px",borderRadius:10,background:"#f8f9fb",border:`1px solid #eef0f4`,cursor:"pointer",textAlign:"left",width:"100%"}}
                        onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="#e5faf0";}}
                        onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="#f8f9fb";}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:"0.75rem",fontWeight:700,color:STEEL}}>{a.project}</div>
                          <div style={{fontSize:"0.68rem",color:MUTED,marginTop:2}}>{a.date} · {a.time} น.</div>
                        </div>
                        <span className="badge" style={{flexShrink:0,background:"#dce5f0",color:PRIMARY}}>
                          {a.status==="upcoming"?"กำลังจะมาถึง":a.status==="done"?"เสร็จแล้ว":"ยกเลิก"}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab: โน้ต */}
            {detailTab==="notes"&&(
              <div style={{padding:"12px 16px"}}>
                {relatedNotes.length===0?(
                  <div style={{fontSize:"0.78rem",color:MUTED,textAlign:"center",padding:"24px 0"}}>ยังไม่มีโน้ต</div>
                ):(
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {relatedNotes.map(n=>{
                      const c=noteCategoryColor[n.category];
                      return (
                        <div key={n.id} style={{padding:"10px 12px",borderRadius:10,background:"#f8f9fb",border:`1px solid #eef0f4`}}>
                          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                            <span style={{width:6,height:6,borderRadius:"50%",background:c.dot,flexShrink:0}}/>
                            <span style={{fontSize:"0.78rem",fontWeight:700,color:STEEL,flex:1}}>{n.title}</span>
                            <span style={{fontSize:"0.6rem",color:MUTED}}>{n.updatedAt}</span>
                          </div>
                          <div style={{fontSize:"0.72rem",color:"#4b5563",whiteSpace:"pre-wrap",lineHeight:1.5,maxHeight:70,overflow:"hidden"}}>{n.content}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            </div>
            {/* Actions (right rail) */}
            <div style={{width:220,flexShrink:0,overflowY:"auto",padding:"16px",display:"flex",flexDirection:"column",gap:8}}>
              <div style={{display:"flex",gap:6}}>
                <button className="btn btn-primary btn-sm" onClick={()=>setEditingRow(selected)} style={{flex:1,justifyContent:"center"}}>
                  <Edit2 size={13}/> แก้ไข
                </button>
                <button className="btn btn-secondary btn-sm" onClick={()=>router.push(`/customers/${selected.id}`)} style={{flex:1,justifyContent:"center"}}>
                  <ExternalLink size={13}/> หน้าเต็ม
                </button>
              </div>
              <button className="btn btn-tint btn-sm" onClick={()=>router.push("/calendar")} style={{justifyContent:"center"}}>
                <Calendar size={13}/> เพิ่มนัดหมาย
              </button>
              {/* Delete */}
              {!showDeleteConfirm?(
                <button className="btn btn-danger btn-sm" onClick={()=>setShowDeleteConfirm(true)} style={{justifyContent:"center"}}>
                  <Trash2 size={13}/> ลบลูกค้า
                </button>
              ):(
                <div style={{borderRadius:10,border:"1px solid #fca5a5",overflow:"hidden"}}>
                  <div style={{padding:"7px 12px",background:"#fee2e2",fontSize:"0.7rem",color:"#dc2626",fontWeight:600}}>ยืนยันลบ "{selected.company}"?</div>
                  <div style={{display:"flex"}}>
                    <button onClick={deleteCustomer} style={{flex:1,padding:"7px",background:"#dc2626",border:"none",color:"#fff",fontSize:"0.7rem",fontWeight:700,cursor:"pointer"}}>ลบ</button>
                    <button onClick={()=>setShowDeleteConfirm(false)} style={{flex:1,padding:"7px",background:"#fff",border:"none",borderLeft:"1px solid #fca5a5",color:STEEL,fontSize:"0.7rem",cursor:"pointer"}}>ยกเลิก</button>
                  </div>
                </div>
              )}
            </div>
          </div>
          </div>
        </>
      )}

      {/* ══ VIEW → RIGHT DRAWER (แทนการนำทางไป /customers/{id}) ══ */}
      <RightDrawer
        open={drawerRow!==null}
        onClose={()=>setDrawerRow(null)}
        width={480}
        title={drawerRow?.company ?? ""}
        subtitle={drawerRow ? `${drawerRow.owner} · ${drawerRow.province}` : ""}
        tabs={drawerTabs}
        headerRight={drawerRow && (
          <>
            <button
              type="button"
              onClick={()=>router.push(`/customers/${drawerRow.id}`)}
              title="ดูข้อมูลเต็ม"
              style={{display:"inline-flex",alignItems:"center",gap:5,padding:"6px 10px",borderRadius:8,border:"1px solid rgba(255,255,255,.28)",background:"rgba(255,255,255,.12)",color:"#fff",fontSize:"0.72rem",fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
              <ExternalLink size={13}/> ดูข้อมูลเต็ม
            </button>
            <button
              type="button"
              onClick={()=>{ const r=drawerRow; setDrawerRow(null); setEditingRow(r); }}
              title="แก้ไข"
              style={{display:"inline-flex",alignItems:"center",gap:5,padding:"6px 10px",borderRadius:8,border:"none",background:"#fff",color:PRIMARY,fontSize:"0.72rem",fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>
              <Edit2 size={13}/> แก้ไข
            </button>
          </>
        )}
      />

      {/* Add Modal */}
      {showAdd&&<CustomerModal initial={BLANK_FORM} title="เพิ่มลูกค้าใหม่" onSave={addCustomer} onClose={()=>setShowAdd(false)} owners={ownersList}/>}

      {/* Edit Modal */}
      {editingRow&&(
        <CustomerModal
          initial={{name:editingRow.name,company:editingRow.company,type:editingRow.type,email:editingRow.email,phone:editingRow.phone,province:editingRow.province,category:editingRow.category,status:editingRow.status,projects:editingRow.projects,joinDate:editingRow.joinDate,owner:editingRow.owner}}
          title="แก้ไขข้อมูลลูกค้า" onSave={saveEdit} onClose={()=>setEditingRow(null)} owners={ownersList}/>
      )}
    </div>
  );
}
