"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  leads, quotations, appointments, notes,
  quotationStatusLabel, quotationStatusColor, noteCategoryColor,
  responsiblePersons, RP_STORAGE_KEY, type ResponsiblePerson,
} from "@/lib/mock";
import { useFilters } from "@/context/FilterContext";
import { FilterBar } from "@/components/filters/FilterBar";
import {
  Plus, Search, X, ChevronUp, ChevronDown,
  Phone, Mail, MapPin, Building2, Edit2, ExternalLink,
  LayoutList, LayoutGrid, Download, Filter, Trash2,
  Calendar, FileText, StickyNote,
} from "lucide-react";

// ── Design tokens ────────────────────────────────────────────
const PRIMARY = "#003366";
const STEEL   = "#2D2D2D";
const BORDER  = "#e5e7eb";
const MUTED   = "#6b7280";

// ── Types ────────────────────────────────────────────────────
type CustomerStatus = "active" | "inactive";
type CustomerRow = {
  id:number; name:string; company:string; email:string; phone:string;
  province:string; category:string; status:CustomerStatus; projects:number;
  joinDate:string; owner:string; initials:string; color:string;
  totalValue:number;
};
type SortKey = "company"|"category"|"status"|"projects"|"province"|"joinDate";
type SortDir = "asc"|"desc";

const INIT_CUSTOMERS: CustomerRow[] = [
  { id:1, name:"คุณสมชาย ใจดี",      company:"บจ. ไทยสตีล",          email:"somchai@thaisteel.co.th",  phone:"081-234-5678", province:"นนทบุรี",       category:"คลังสินค้า",  status:"active",   projects:2, joinDate:"2025-09-15", owner:"สมชาย เชียงใหม่",  initials:"สช", color:"#003366", totalValue:1800000 },
  { id:2, name:"คุณกาญจนา ม.",        company:"บจ. ซีซีเอส",           email:"kanjana@ccs.co.th",        phone:"082-345-6789", province:"เชียงใหม่",    category:"อุตสาหกรรม", status:"active",   projects:1, joinDate:"2025-11-03", owner:"วิภา รัตนกุล",    initials:"กม", color:"#059669", totalValue:3200000 },
  { id:3, name:"คุณประยุทธ ร.",        company:"หจก. ราชบุรีโลหะ",      email:"prayuth@rajburi.co.th",    phone:"083-456-7890", province:"ราชบุรี",      category:"อุตสาหกรรม", status:"active",   projects:1, joinDate:"2026-01-20", owner:"วิภา รัตนกุล",    initials:"ปร", color:"#f59e0b", totalValue:760000 },
  { id:4, name:"คุณดารัล ส.",          company:"บจ. สมุทรโกดัง",        email:"darat@smgodown.co.th",     phone:"084-567-8901", province:"สมุทรปราการ", category:"คลังสินค้า",  status:"active",   projects:2, joinDate:"2026-02-10", owner:"สมชาย เชียงใหม่",  initials:"ดส", color:"#dc2626", totalValue:2000000 },
  { id:5, name:"VCS Asia (ระยอง)",     company:"VCS Asia Co., Ltd.",     email:"vcs@vcsasia.com",           phone:"085-678-9012", province:"ระยอง",        category:"อุตสาหกรรม", status:"inactive", projects:3, joinDate:"2025-08-01", owner:"วิชัย ประสิทธิ์",  initials:"VC", color:"#002244", totalValue:6200000 },
  { id:6, name:"คุณสุรัตน์ ล.",        company:"บจ. แม่สอดโลหะ",       email:"surat@maesot.co.th",       phone:"086-789-0123", province:"ตาก",           category:"คลังสินค้า",  status:"active",   projects:1, joinDate:"2025-12-01", owner:"สมชาย เชียงใหม่",  initials:"สล", color:"#8fa3b8", totalValue:4100000 },
  { id:7, name:"บจ. อุตรดิตถ์โลหะ",   company:"บจ. อุตรดิตถ์โลหะ",    email:"info@uttaradit.co.th",      phone:"087-890-1234", province:"อุตรดิตถ์",    category:"เกษตรกรรม",status:"inactive", projects:0, joinDate:"2026-06-01", owner:"วิภา รัตนกุล",    initials:"อต", color:"#8fa3b8", totalValue:0 },
  { id:8, name:"บจ. นครสวรรค์โลหะ",   company:"บจ. นครสวรรค์โลหะ",    email:"nakhon@nsloha.co.th",      phone:"088-901-2345", province:"นครสวรรค์",    category:"งานตามแบบ", status:"active",   projects:2, joinDate:"2025-07-15", owner:"กาญจนา มีสุข",    initials:"นส", color:"#059669", totalValue:5400000 },
];

const CATEGORIES    = ["อุตสาหกรรม","คลังสินค้า","โชว์รูม","เกษตรกรรม","งานตามแบบ"];
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

// ── Add / Edit Modal ─────────────────────────────────────────
type CustomerForm = Omit<CustomerRow,"id"|"initials"|"color"|"totalValue">;
const BLANK_FORM: CustomerForm = { name:"",company:"",email:"",phone:"",province:"กรุงเทพฯ",category:"คลังสินค้า",status:"active",projects:0,joinDate:"",owner:"สมชาย เชียงใหม่" };

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
                <label className="form-label">หมวดหมู่</label>
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

// ── Export CSV ───────────────────────────────────────────────
function exportCSV(rows: CustomerRow[]){
  const header = ["ID","บริษัท","ผู้ติดต่อ","อีเมล","โทรศัพท์","จังหวัด","หมวด","สถานะ","โอกาสการขาย","ผู้รับผิดชอบ","วันที่เพิ่ม"];
  const lines  = rows.map(c=>[c.id,c.company,c.name,c.email,c.phone,c.province,c.category,c.status===("active" as CustomerStatus)?"ใช้งาน":"ไม่ใช้งาน",c.projects,c.owner,c.joinDate].join(","));
  const csv    = [header.join(","),...lines].join("\n");
  const blob   = new Blob(["﻿"+csv],{type:"text/csv;charset=utf-8;"});
  const url    = URL.createObjectURL(blob);
  const a      = document.createElement("a"); a.href=url; a.download="customers.csv"; a.click();
  URL.revokeObjectURL(url);
}

// ── Main Page ────────────────────────────────────────────────
export default function CustomersPage(){
  const router = useRouter();
  const { timeRange, passes } = useFilters();
  const [data, setData] = useState<CustomerRow[]>(INIT_CUSTOMERS);
  const [query, setQuery]             = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL"|CustomerStatus>("ALL");
  const [catFilter, setCatFilter]     = useState("ALL");
  const [sortKey, setSortKey]         = useState<SortKey>("company");
  const [sortDir, setSortDir]         = useState<SortDir>("asc");
  const [selected, setSelected]       = useState<CustomerRow|null>(null);
  const [ownersList, setOwnersList]   = useState<string[]>(DEFAULT_OWNERS);
  useEffect(() => {
    const s = localStorage.getItem(RP_STORAGE_KEY);
    if (s) try {
      const arr: ResponsiblePerson[] = JSON.parse(s);
      setOwnersList(arr.filter(p => p.active).map(p => p.name));
    } catch {}
  }, []);

  const [view, setView]               = useState<"card"|"table">("card");
  const [showFilter, setShowFilter]   = useState(false);
  const [showAdd, setShowAdd]         = useState(false);
  const [editingRow, setEditingRow]   = useState<CustomerRow|null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [detailTab, setDetailTab]     = useState<"info"|"quotes"|"appts"|"notes">("info");

  function handleSort(k: SortKey){ if(sortKey===k) setSortDir(d=>d==="asc"?"desc":"asc"); else{setSortKey(k);setSortDir("asc");} }

  const filtered = useMemo(()=>{
    let rows=data.filter(c=>{
      const q=query.toLowerCase();
      const matchQ=!q||c.company.toLowerCase().includes(q)||c.name.toLowerCase().includes(q)||c.province.toLowerCase().includes(q)||c.phone.includes(q);
      const matchS=statusFilter==="ALL"||c.status===statusFilter;
      const matchC=catFilter==="ALL"||c.category===catFilter;
      // FilterBar กลาง: ช่วงเวลา (joinDate) + สถานะ (active/inactive) + จังหวัด
      const matchGlobal=passes({ date:c.joinDate, status:c.status, province:c.province });
      return matchQ&&matchS&&matchC&&matchGlobal;
    });
    rows=[...rows].sort((a,b)=>{
      let va: string|number=a[sortKey] as string|number;
      let vb: string|number=b[sortKey] as string|number;
      if(typeof va==="string") va=va.toLowerCase();
      if(typeof vb==="string") vb=vb.toLowerCase();
      if(va<vb) return sortDir==="asc"?-1:1;
      if(va>vb) return sortDir==="asc"?1:-1;
      return 0;
    });
    return rows;
  },[data,query,statusFilter,catFilter,sortKey,sortDir,passes]);

  // สรุปด้านบนนับจากชุดที่อยู่ในช่วงเวลา/จังหวัดของ FilterBar (ไม่ผูกกับตัวกรองสถานะ/หมวดในเครื่อง)
  const scoped        = useMemo(()=>data.filter(c=>passes({ date:c.joinDate, province:c.province })),[data,passes]);
  const totalAll      = scoped.length;
  const totalActive   = scoped.filter(c=>c.status==="active").length;
  const totalInactive = scoped.filter(c=>c.status==="inactive").length;
  const totalValue    = scoped.reduce((s,c)=>s+c.totalValue,0);

  // Related data for selected customer
  const relatedQuotations   = selected ? quotations.filter(q=>q.customerId===selected.id) : [];
  const relatedLeads        = selected ? leads.filter(l=>l.company===selected.company||l.customerId===selected.id) : [];
  const relatedAppointments = selected ? appointments.filter(a=>a.company===selected.company) : [];
  const relatedNotes        = selected ? notes.filter(n=>n.customerId===selected.id) : [];

  function addCustomer(form: CustomerForm){
    const maxId = Math.max(...data.map(c=>c.id),0);
    const color = PALETTE[maxId % PALETTE.length];
    setData(p=>[...p,{...form,id:maxId+1,initials:initials(form.company),color,totalValue:0}]);
  }
  function saveEdit(form: CustomerForm){
    if(!editingRow) return;
    setData(p=>p.map(c=>c.id===editingRow.id?{...c,...form,initials:initials(form.company)}:c));
    setSelected(p=>p&&p.id===editingRow.id?{...p,...form,initials:initials(form.company)}:p);
  }
  function deleteCustomer(){
    if(!selected) return;
    setData(p=>p.filter(c=>c.id!==selected.id));
    setSelected(null); setShowDeleteConfirm(false);
  }
  function toggleStatus(id:number){
    setData(p=>p.map(c=>c.id===id?{...c,status:c.status==="active"?"inactive":"active"}:c));
    setSelected(p=>p&&p.id===id?{...p,status:p.status==="active"?"inactive":"active"}:p);
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

  return (
    <div className="erp" style={{display:"flex",gap:16,alignItems:"flex-start"}}>

      {/* ══ MAIN ══════════════════════════════════════════════ */}
      <div style={{flex:1,minWidth:0}}>

        {/* Header */}
        <div className="page-head">
          <div>
            <h2>ลูกค้า</h2>
            <p>จัดการข้อมูลลูกค้าและความสัมพันธ์ทางธุรกิจ · {timeRange.subtitle}</p>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <button className={`btn btn-md ${showFilter?"btn-primary":"btn-secondary"}`} onClick={()=>setShowFilter(f=>!f)}>
              <Filter size={13}/> ตัวกรอง
            </button>
            <button className="btn btn-secondary btn-md" onClick={()=>exportCSV(filtered)}>
              <Download size={13}/> ส่งออก CSV
            </button>
            <button className="btn btn-primary btn-md" onClick={()=>setShowAdd(true)}>
              <Plus size={13}/> เพิ่มลูกค้า
            </button>
          </div>
        </div>

        {/* ── Global Filter Bar (ช่วงเวลา joinDate + สถานะลูกค้า) ── */}
        <div style={{marginBottom:14}}>
          <FilterBar dims={["status"]} statusOptions={CUSTOMER_STATUS_OPTIONS} />
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
              <span style={{fontSize:"0.68rem",fontWeight:700,color:MUTED,marginRight:2}}>หมวด:</span>
              {["ALL",...CATEGORIES].map(cat=>(
                <button key={cat} onClick={()=>setCatFilter(cat)}
                  style={{padding:"5px 11px",borderRadius:99,border:`1px solid ${catFilter===cat?"#C0C0C0":BORDER}`,background:catFilter===cat?"#f0f4f8":"#fff",color:catFilter===cat?STEEL:MUTED,fontSize:"0.68rem",fontWeight:600,cursor:"pointer"}}>
                  {cat==="ALL"?"ทั้งหมด":cat}
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
                {filtered.map(c=>{
                  const isSel=selected?.id===c.id;
                  return (
                    <div key={c.id} className="card" onClick={()=>{ setSelected(s=>s?.id===c.id?null:c); setDetailTab("info"); setShowDeleteConfirm(false); }}
                      style={{cursor:"pointer",overflow:"hidden",position:"relative",border:isSel?`1.5px solid ${PRIMARY}`:`1px solid ${BORDER}`,boxShadow:isSel?"0 4px 18px rgba(0,0,0,.15)":undefined,transition:"box-shadow .15s,border .15s",opacity:c.status==="inactive"?0.78:1}}
                      onMouseEnter={e=>{if(!isSel)(e.currentTarget as HTMLElement).style.boxShadow="0 6px 22px rgba(0,0,0,.13)";}}
                      onMouseLeave={e=>{if(!isSel)(e.currentTarget as HTMLElement).style.boxShadow="";}}>
                      {/* view link */}
                      <button className="btn btn-secondary btn-sm" onClick={e=>{e.stopPropagation();router.push(`/customers/${c.id}`);}}
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
                        <span className="badge" style={{background:c.status==="active"?"#e5faf0":"#f1f5f9",color:c.status==="active"?"#059669":"#64748b"}}>
                          {c.status==="active"?"ใช้งาน":"ไม่ใช้งาน"}
                        </span>
                        <span className="badge" style={{background:c.projects>0?"#dce5f0":"#f1f5f9",color:c.projects>0?PRIMARY:"#9ca3af"}}>
                          {c.projects} โอกาสการขาย
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{marginTop:10,padding:"4px 2px"}}>
              <span style={{fontSize:"0.7rem",color:MUTED}}>แสดง {filtered.length} จาก {data.length} รายการ</span>
            </div>
          </div>
        )}

        {/* ── TABLE VIEW ── */}
        {view==="table"&&(
          <div className="card">
            <div className="table-wrap" style={{borderTop:"none"}}>
              <table>
                <thead>
                  <tr>
                    {([{label:"บริษัท / ผู้ติดต่อ",key:"company"},{label:"หมวดหมู่",key:"category"},{label:"สถานะ",key:"status"},{label:"โอกาสการขาย",key:"projects"},{label:"จังหวัด",key:"province"},{label:"วันที่เพิ่ม",key:"joinDate"}] as {label:string;key:SortKey}[]).map(col=>(
                      <th key={col.key} onClick={()=>handleSort(col.key)} style={{cursor:"pointer",userSelect:"none"}}>
                        <span style={{display:"inline-flex",alignItems:"center"}}>{col.label}<SortIcon k={col.key}/></span>
                      </th>
                    ))}
                    <th/>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length===0&&(
                    <tr><td colSpan={7} style={{textAlign:"center",padding:"40px 0",color:MUTED,fontSize:"0.82rem"}}>ไม่พบลูกค้า</td></tr>
                  )}
                  {filtered.map(c=>{
                    const isSel=selected?.id===c.id;
                    return(
                      <tr key={c.id} className="clickable" onClick={()=>{setSelected(s=>s?.id===c.id?null:c);setDetailTab("info");setShowDeleteConfirm(false);}}
                        style={isSel?{background:"#f0f6ff"}:undefined}>
                        <td>
                          <div style={{display:"flex",alignItems:"center",gap:10}}>
                            <div style={{width:34,height:34,borderRadius:10,background:c.color,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:"0.7rem"}}>{c.initials}</div>
                            <div>
                              <div style={{fontSize:"0.83rem",fontWeight:700,color:STEEL}}>{c.company}</div>
                              <div style={{fontSize:"0.69rem",color:MUTED,marginTop:1}}>{c.name}</div>
                            </div>
                          </div>
                        </td>
                        <td><span className="badge" style={{background:"#dce5f0",color:PRIMARY}}>{c.category}</span></td>
                        <td>
                          <span className="badge" style={{background:c.status==="active"?"#e5faf0":"#f1f5f9",color:c.status==="active"?"#059669":"#64748b"}}>
                            {c.status==="active"?"ใช้งาน":"ไม่ใช้งาน"}
                          </span>
                        </td>
                        <td>
                          <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",minWidth:24,height:22,padding:"0 8px",borderRadius:99,fontSize:"0.7rem",fontWeight:800,background:c.projects>0?"#dce5f0":"#f1f5f9",color:c.projects>0?PRIMARY:"#9ca3af"}}>{c.projects}</span>
                        </td>
                        <td style={{color:MUTED}}>{c.province}</td>
                        <td style={{color:MUTED,whiteSpace:"nowrap"}}>{fmtDate(c.joinDate)}</td>
                        <td onClick={e=>e.stopPropagation()}>
                          <button className="btn btn-secondary btn-sm" onClick={()=>router.push(`/customers/${c.id}`)} style={{color:PRIMARY}}>ดู →</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{padding:"10px 16px",borderTop:`1px solid ${BORDER}`}}>
              <span style={{fontSize:"0.7rem",color:MUTED}}>แสดง {filtered.length} จาก {data.length} รายการ</span>
            </div>
          </div>
        )}
      </div>

      {/* ══ DETAIL PANEL ══════════════════════════════════════ */}
      {selected&&(
        <>
          <div onClick={()=>setSelected(null)} style={{position:"fixed",inset:0,background:"rgba(45,45,45,.45)",zIndex:200}}/>
          <div style={{position:"fixed",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:760,maxWidth:"calc(100vw - 32px)",maxHeight:"calc(100vh - 48px)",zIndex:210,background:"#fff",borderRadius:18,boxShadow:"0 24px 80px rgba(0,0,0,.22)",display:"flex",flexDirection:"column",overflow:"hidden"}}>

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
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <button onClick={()=>toggleStatus(selected.id)}
                  style={{padding:"2px 10px",borderRadius:99,fontSize:"0.64rem",fontWeight:700,background:selected.status==="active"?"#e5faf0":"#f1f5f9",color:selected.status==="active"?"#059669":"#9ca3af",border:"none",cursor:"pointer"}}>
                  {selected.status==="active"?"ใช้งาน":"ไม่ใช้งาน"}
                </button>
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

                {/* Sales summary — มูลค่าการขายสะสม (ฝ่ายขาย; ไม่ใช่การเงินกลาง/HQ) */}
                <div style={{padding:"14px 16px",borderBottom:`1px solid #f0f4f8`}}>
                  <div style={{fontSize:"0.63rem",fontWeight:700,color:MUTED,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10}}>สรุปการขาย</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    {[
                      {label:"โอกาสการขายทั้งหมด",   val:selected.projects.toString(),  accent:PRIMARY, bg:"#dce5f0"},
                      {label:"มูลค่าการขาย",  val:fmtMoney(selected.totalValue),  accent:STEEL,   bg:"#f0f4f8"},
                    ].map((item,i)=>(
                      <div key={i} style={{background:item.bg,borderRadius:10,padding:"10px 8px",textAlign:"center"}}>
                        <div style={{fontSize:"0.75rem",fontWeight:800,color:item.accent,lineHeight:1.2}}>{item.val}</div>
                        <div style={{fontSize:"0.6rem",color:MUTED,marginTop:3,fontWeight:600}}>{item.label}</div>
                      </div>
                    ))}
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
            <div style={{width:260,flexShrink:0,overflowY:"auto",padding:"16px",display:"flex",flexDirection:"column",gap:8}}>
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

      {/* Add Modal */}
      {showAdd&&<CustomerModal initial={BLANK_FORM} title="เพิ่มลูกค้าใหม่" onSave={addCustomer} onClose={()=>setShowAdd(false)} owners={ownersList}/>}

      {/* Edit Modal */}
      {editingRow&&(
        <CustomerModal
          initial={{name:editingRow.name,company:editingRow.company,email:editingRow.email,phone:editingRow.phone,province:editingRow.province,category:editingRow.category,status:editingRow.status,projects:editingRow.projects,joinDate:editingRow.joinDate,owner:editingRow.owner}}
          title="แก้ไขข้อมูลลูกค้า" onSave={saveEdit} onClose={()=>setEditingRow(null)} owners={ownersList}/>
      )}
    </div>
  );
}
