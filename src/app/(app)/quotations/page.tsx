"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  quotationStatusLabel, quotationStatusColor, leadStatusLabel, loadQuoteValidityDays, loadQuoteNumbering,
  loadHQPolicy, DEFAULT_ISSUER, ISSUER_KEY,
  type QuotationStatus, type QuotationMock, type CustomerRow, type IssuerProfile, type QuoteLineItem,
} from "@/lib/mock";
import { LineItemsEditor } from "@/components/ui/LineItemsEditor";
import { AssigneeAvatars } from "@/components/ui/PersonPicker";
import { buildQuotationHTML, DEFAULT_DOC, DOC_KEY, loadWordmark, type DocProfile } from "@/lib/quotationPrint";
import { useSales } from "@/context/SalesContext";
import { QuotationCreateModal } from "@/components/ui/QuotationCreateModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { useFilters, FilterProvider } from "@/context/FilterContext";
import { FilterBar } from "@/components/filters/FilterBar";
import { TopbarActions } from "@/components/layout/TopbarActions";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { useTableLayout, type Col } from "@/components/ui/TableTools";
import {
  Plus, Search, X, FileText, LayoutList, LayoutGrid,
  Edit2, Trash2, ChevronUp, ChevronDown, Printer,
  ExternalLink, ArrowRight, ChevronLeft, ChevronRight,
  Send, Coins, MapPin, Package, User, Layers, Target, Check, Phone, Mail, Percent,
} from "lucide-react";

// ── Tokens ────────────────────────────────────────────────────
const PRIMARY = "#003366";
const STEEL   = "#2D2D2D";
const BORDER  = "#e5e7eb";
const MUTED   = "#6b7280";
const CARD: React.CSSProperties = { background:"#fff", borderRadius:16, border:`1px solid ${BORDER}`, boxShadow:"0 2px 14px rgba(0,51,102,.07)" };

// ── Quotation workflow (Dealer self-serve — ไม่มีขั้นตอนขออนุมัติจาก HQ) ──────
// Sales (Dealer): draft → sent_to_client → won / lost / expired
// หลังปิดการขาย (won) ถือว่าจบงานฝั่งดีลเลอร์ — บันทึกเข้า HQ อัตโนมัติ
const STATUS_ORDER: QuotationStatus[] = ["draft","sent_to_client","viewed","won","lost","expired"];

const PAGE_SIZE = 10;

const STATUS_ACTIONS: Record<QuotationStatus,{label:string;next:QuotationStatus;bg:string;color:string}[]> = {
  draft:          [
    {label:"ส่งใบเสนอราคา", next:"sent_to_client", bg:"#dce5f0", color:PRIMARY},
  ],
  sent_to_client: [
    {label:"ลูกค้าเปิดอ่าน",     next:"viewed", bg:"#e0e7ff", color:"#4338ca"},
    {label:"ลูกค้าตอบรับ ✓", next:"won",  bg:"#e5faf0", color:"#059669"},
    {label:"ลูกค้าปฏิเสธ",     next:"lost", bg:"#fee2e2", color:"#dc2626"},
    {label:"หมดอายุ",                       next:"expired", bg:"#f0f0f5", color:"#6b7280"},
  ],
  viewed: [
    {label:"ลูกค้าตอบรับ ✓", next:"won",  bg:"#e5faf0", color:"#059669"},
    {label:"ลูกค้าปฏิเสธ",     next:"lost", bg:"#fee2e2", color:"#dc2626"},
    {label:"หมดอายุ",                       next:"expired", bg:"#f0f0f5", color:"#6b7280"},
  ],
  won:      [],
  lost:     [{label:"เปิดร่างใหม่", next:"draft", bg:"#f0f0f5", color:"#6b7280"}],
  expired:  [{label:"เปิดร่างใหม่", next:"draft", bg:"#f0f0f5", color:"#6b7280"}],
};

// statusOptions สำหรับ FilterBar กลาง — value = enum key, label = ไทยจาก quotationStatusLabel
const Q_STATUS_OPTIONS = STATUS_ORDER.map(s => ({ value: s, label: quotationStatusLabel[s] }));

// คอลัมน์ที่ซ่อน/แสดงได้ในตารางรายการ (เลขที่ + ลูกค้า + สถานะ + การกระทำ = คงที่เสมอ)
const COLS: Col[] = [
  { key: "owner",   label: "ผู้รับผิดชอบ" },
  { key: "value",   label: "มูลค่า" },
  { key: "expiry",  label: "วันหมดอายุ" },
];

// ── Types ─────────────────────────────────────────────────────
type SortKey = "id"|"customer"|"project"|"totalValue"|"date"|"status";
type SortDir = "asc"|"desc";
type QForm = {
  customerId:number; customer:string;
  project:string; projectId:number;
  province:string; buildingType:string; area:number;
  materialCost:number;
  status:QuotationStatus; date:string; items:number;
  lineItems:QuoteLineItem[];
  revision:string; expiry:string;
};

// แม่แบบ = แคตตาล็อกกลาง (useMasterCatalog ในคอมโพเนนต์)

// ── Dealer identity — ใบเสนอราคาออกในนามบริษัทของดีลเลอร์เอง (ไม่ใช่เบญจมินทร์) ──
// ค่าเริ่มต้น + คีย์ = แหล่งเดียวใน mock (DEFAULT_ISSUER/ISSUER_KEY) ใช้ร่วมกับใบเสนอราคา inline
type Issuer = IssuerProfile;
// ตรา/ลายเซ็น/VAT/prefix มาจาก quotationPrint (DocProfile/DEFAULT_DOC/DOC_KEY) — แหล่งเดียวร่วมกับใบเสนอ inline

// ── Helpers ───────────────────────────────────────────────────
function fmtMoney(v:number){ return "฿"+v.toLocaleString("th-TH"); }
function fmtDate(d:string){ if(!d||d==="—") return "—"; const [y,m,day]=d.split("-"); const mo=["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."]; return `${parseInt(day)} ${mo[parseInt(m)-1]} ${parseInt(y)+543}`; }
function nextQId(data:QuotationMock[]){
  // รูปแบบเลขที่ = HQ กำหนด (แหล่งเดียว loadQuoteNumbering) · ตัวแทนแก้ไม่ได้
  const { prefix, next: startNo } = loadQuoteNumbering();
  const nums = data.map(q=>{ const mt=q.id.match(/(\d+)\s*$/); return mt?parseInt(mt[1]):0; });
  const next = Math.max(startNo - 1, ...nums, 0) + 1;
  return `${prefix}${String(next).padStart(4,"0")}`;
}
// ── Add / Edit Modal ──────────────────────────────────────────
const TODAY = "2026-06-30";
// วันหมดอายุเริ่มต้น = วันนี้ + อายุใบเสนอราคา (จากกฎการขาย settings) → ISO
function defaultExpiry(): string {
  const d = new Date(TODAY); d.setDate(d.getDate() + loadQuoteValidityDays());
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
// ชื่อโครงการแนะนำจากลูกค้า — "{แม่แบบ} — {บริษัท}" (เหมือนตอนสร้างใบเสนอจากลีด) · แก้ได้
function suggestProject(c?:CustomerRow):string{
  if(!c) return "";
  return c.category ? `${c.category} — ${c.company}` : c.company;
}
function buildBlank(customers:CustomerRow[]): QForm {
  const c=customers[0];
  return { customerId:c?.id??0, customer:c?.company??"", project:suggestProject(c), projectId:0, province:c?.province??"", buildingType:c?.category||"โกดังสำเร็จรูป", area:0, materialCost:0, status:"draft", date:TODAY, items:0, lineItems:[], revision:"V1", expiry:defaultExpiry() };
}

function QuotationModal({ initial, title, onSave, onClose, customers }:{
  initial:QForm; title:string; onSave:(f:QForm)=>void; onClose:()=>void; customers:CustomerRow[];
}){
  const [form,setForm]=useState<QForm>(initial);
  const INP:React.CSSProperties={width:"100%",border:`1px solid ${BORDER}`,borderRadius:9,padding:"8px 12px",fontSize:"0.8rem",outline:"none",color:STEEL,boxSizing:"border-box"};
  const LBL:React.CSSProperties={fontSize:"0.65rem",fontWeight:700,color:MUTED,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:"0.04em"};
  function set<K extends keyof QForm>(k:K,v:QForm[K]){setForm(p=>({...p,[k]:v}));}
  const total=form.lineItems.reduce((s,it)=>s+it.qty*it.unitPrice,0); // = Σ รายการ (BOQ)
  function pickCustomer(id:number){
    const c=customers.find(c=>c.id===id);
    if(!c) return;
    // prefill ทุกช่องที่ดึงจากลูกค้าได้: จังหวัด · แม่แบบ (จาก category) · ชื่อโครงการ (แนะนำ แก้ได้)
    setForm(p=>({...p,customerId:c.id,customer:c.company,province:c.province||p.province,buildingType:c.category||p.buildingType,project:suggestProject(c)}));
  }
  function submit(){if(!form.customer||!form.project)return; onSave({...form, items:form.lineItems.length, materialCost:total}); onClose();}
  return (
    <>
      <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(45,45,45,.4)",zIndex:200}}/>
      <div onClick={e=>e.stopPropagation()} style={{position:"fixed",inset:0,zIndex:210,display:"flex",alignItems:"center",justifyContent:"center",padding:20,pointerEvents:"none"}}>
        <div style={{...CARD,width:"100%",maxWidth:580,pointerEvents:"auto",overflow:"hidden",boxShadow:"0 24px 80px rgba(0,0,0,.2)"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 22px",borderBottom:`1px solid ${BORDER}`,background:PRIMARY}}>
            <div style={{fontSize:"0.92rem",fontWeight:800,color:"#fff"}}>{title}</div>
            <button onClick={onClose} style={{width:28,height:28,borderRadius:8,border:"1px solid rgba(255,255,255,.2)",background:"rgba(255,255,255,.1)",color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><X size={13}/></button>
          </div>
          <div style={{padding:"20px 22px",overflowY:"auto",maxHeight:"68vh",display:"flex",flexDirection:"column",gap:14}}>
            {/* Customer */}
            <div>
              <label style={LBL}>ลูกค้า *</label>
              <select value={form.customerId} onChange={e=>pickCustomer(Number(e.target.value))} style={INP}>
                {customers.map(c=><option key={c.id} value={c.id}>{c.company}</option>)}
                <option value={0}>— อื่นๆ (พิมพ์เอง) —</option>
              </select>
              {form.customerId===0&&<input value={form.customer} onChange={e=>set("customer",e.target.value)} placeholder="ชื่อบริษัท..." style={{...INP,marginTop:6}}/>}
            </div>
            {/* Project */}
            <div>
              <label style={LBL}>ชื่อโครงการ *</label>
              <input value={form.project} onChange={e=>set("project",e.target.value)} placeholder="เช่น โกดังสินค้า ABC" style={INP}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div>
                <label style={LBL}>จังหวัด</label>
                <input value={form.province} onChange={e=>set("province",e.target.value)} placeholder="จังหวัด" style={INP}/>
              </div>
              <div>
                <label style={LBL}>พื้นที่ (ตร.ม.)</label>
                <input type="number" value={form.area||""} onChange={e=>set("area",Number(e.target.value))} placeholder="0" style={INP}/>
              </div>
            </div>
            {/* รายการสินค้า (BOQ) — เลือกจากแคตตาล็อก → ราคากลาง HQ · แม่แบบ derive จากรายการแรก (ไม่มีช่องแม่แบบซ้ำ) */}
            <LineItemsEditor items={form.lineItems} defaultQty={form.area}
              onChange={li=>setForm(p=>({...p,lineItems:li,buildingType:li.length?li[0].name.split(" · ")[0]:p.buildingType}))} />
            {/* Total preview */}
            {total>0&&<div style={{padding:"10px 14px",background:"#dce5f0",borderRadius:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:"0.72rem",fontWeight:700,color:MUTED}}>มูลค่ารวม (คำนวณ)</span>
              <span style={{fontSize:"1rem",fontWeight:800,color:PRIMARY}}>{fmtMoney(total)}</span>
            </div>}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div>
                <label style={LBL}>สถานะ</label>
                <select value={form.status} onChange={e=>set("status",e.target.value as QuotationStatus)} style={INP}>
                  {STATUS_ORDER.map(s=><option key={s} value={s}>{quotationStatusLabel[s]}</option>)}
                </select>
              </div>
              <div>
                <label style={LBL}>วันที่</label>
                <input type="date" value={form.date} onChange={e=>set("date",e.target.value)} style={INP}/>
              </div>
              <div>
                <label style={LBL}>วันหมดอายุ</label>
                <input type="date" value={form.expiry} onChange={e=>set("expiry",e.target.value)} style={INP}/>
              </div>
            </div>
          </div>
          <div style={{padding:"13px 22px",borderTop:`1px solid ${BORDER}`,display:"flex",gap:8,justifyContent:"flex-end",background:"#fafafa"}}>
            <button onClick={onClose} className="btn btn-secondary btn-md">ยกเลิก</button>
            <button onClick={submit} className="btn btn-primary btn-md">บันทึก</button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Pagination bar (CI-styled) ────────────────────────────────
function PaginationBar({ from, to, total, page, totalPages, onPrev, onNext }:{
  from:number; to:number; total:number; page:number; totalPages:number;
  onPrev:()=>void; onNext:()=>void;
}){
  const atFirst = page<=1;
  const atLast  = page>=totalPages;
  const navBtn=(disabled:boolean):React.CSSProperties=>({
    display:"flex",alignItems:"center",gap:4,padding:"5px 12px",borderRadius:8,
    border:`1px solid ${disabled?BORDER:PRIMARY}`,
    background:disabled?"#f3f4f6":"#fff",
    color:disabled?"#9ca3af":PRIMARY,
    fontSize:"0.72rem",fontWeight:700,cursor:disabled?"default":"pointer",
    opacity:disabled?0.7:1,transition:"all .15s",
  });
  return (
    <div style={{padding:"10px 16px",borderTop:`1px solid ${BORDER}`,display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
      <span style={{fontSize:"0.72rem",color:MUTED}}>แสดง {from}–{to} จาก {total} รายการ</span>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <button onClick={onPrev} disabled={atFirst} style={navBtn(atFirst)}>
          <ChevronLeft size={13}/> ก่อนหน้า
        </button>
        <span style={{fontSize:"0.72rem",color:STEEL,fontWeight:700}}>หน้า {page} / {totalPages}</span>
        <button onClick={onNext} disabled={atLast} style={navBtn(atLast)}>
          ถัดไป <ChevronRight size={13}/>
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
// ห่อด้วย FilterProvider ของหน้านี้เอง → ช่วงเวลาแยกอิสระจากหน้าอื่น
export default function QuotationsPage(){
  return (
    <FilterProvider>
      <QuotationsPageInner />
    </FilterProvider>
  );
}

function QuotationsPageInner(){
  const router = useRouter();
  const { timeRange, passes } = useFilters();
  const {
    quotations: data, customers, leads,
    addQuotation, updateQuotation, deleteQuotation: ctxDeleteQuotation, setQuotationStatus,
  } = useSales();
  const [query, setQuery]           = useState("");
  const [filterStatus, setFilterStatus] = useState<QuotationStatus|"ALL">("ALL");
  const [view, setView]             = useState<"list"|"card">("list");
  const [sortKey, setSortKey]       = useState<SortKey>("date");
  const [sortDir, setSortDir]       = useState<SortDir>("desc");
  const [page, setPage]             = useState(1);
  const [selected, setSelected]     = useState<QuotationMock|null>(null);
  const [showModal, setShowModal]   = useState(false);
  const [editingQ, setEditingQ]     = useState<QuotationMock|null>(null);
  const [delConfirm, setDelConfirm] = useState(false);
  const [detailTab, setDetailTab]   = useState<"info"|"customer"|"lead">("info");
  const [issuer, setIssuer]         = useState<Issuer>(DEFAULT_ISSUER);
  const [docProfile, setDocProfile] = useState<DocProfile>(DEFAULT_DOC);
  const [toast, setToast]           = useState<string|null>(null);
  // Table toolbar layout — ความหนาแน่นแถว + ซ่อน/แสดงคอลัมน์ (persist ใน localStorage)
  const { density, setDensity, hiddenCols, toggleCol } = useTableLayout("quotations");

  // แสดง toast ชั่วคราวแล้วซ่อนอัตโนมัติ
  function showToast(msg:string){ setToast(msg); }
  useEffect(()=>{ if(!toast) return; const t=setTimeout(()=>setToast(null),2600); return ()=>clearTimeout(t); },[toast]);


  // ผู้ออกใบเสนอราคา = โปรไฟล์บริษัทของสาขา (แก้ที่หน้า "โปรไฟล์บริษัท") — อ่านจาก localStorage คีย์เดียวกัน
  useEffect(() => {
    const s = localStorage.getItem(ISSUER_KEY);
    if (s) { try { setIssuer({ ...DEFAULT_ISSUER, ...JSON.parse(s) }); } catch {} }
    const d = localStorage.getItem(DOC_KEY);
    if (d) { try { const p = JSON.parse(d); setDocProfile({
      stamp: p.stamp ?? "", signature: p.signature ?? "",
      vatPercent: typeof p.vatPercent === "number" ? p.vatPercent : 7,
      quotePrefix: p.quotePrefix || "Q-2026-",
      runningNumber: typeof p.runningNumber === "number" ? p.runningNumber : 1001,
    }); } catch {} }
  }, []);

  function handleSort(k:SortKey){ if(sortKey===k) setSortDir(d=>d==="asc"?"desc":"asc"); else{setSortKey(k);setSortDir("asc");} }
  const SortIcon=({k}:{k:SortKey})=>sortKey===k?(sortDir==="asc"?<ChevronUp size={10} style={{marginLeft:2}}/>:<ChevronDown size={10} style={{marginLeft:2}}/>):<ChevronDown size={10} style={{marginLeft:2,opacity:.3}}/>;

  const filtered = useMemo(()=>{
    let rows=data.filter(q=>{
      const matchQ=!query||q.id.toLowerCase().includes(query.toLowerCase())||q.customer.toLowerCase().includes(query.toLowerCase())||q.project.toLowerCase().includes(query.toLowerCase())||q.province?.includes(query);
      const matchS=filterStatus==="ALL"||q.status===filterStatus;
      // FilterBar กลาง: ช่วงเวลา (date) + สถานะ (enum) + จังหวัด
      const matchGlobal=passes({ date:q.date, status:q.status, province:q.province });
      return matchQ&&matchS&&matchGlobal;
    });
    rows=[...rows].sort((a,b)=>{
      const va:string|number=a[sortKey] as string|number;
      const vb:string|number=b[sortKey] as string|number;
      const cmp=typeof va==="number"?(va as number)-(vb as number):(va as string).localeCompare(vb as string,"th");
      return sortDir==="asc"?cmp:-cmp;
    });
    return rows;
  },[data,query,filterStatus,sortKey,sortDir,passes]);

  // ── Pagination (client-side) ──────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // clamp/reset page เมื่อค้นหา / กรองสถานะ / จัดเรียง / ชุดข้อมูลเปลี่ยน
  useEffect(()=>{ setPage(1); },[query,filterStatus,sortKey,sortDir]);
  useEffect(()=>{ setPage(p=>Math.min(p,totalPages)); },[totalPages]);
  const pageStart = (page-1)*PAGE_SIZE;
  const paged     = useMemo(()=>filtered.slice(pageStart,pageStart+PAGE_SIZE),[filtered,pageStart]);
  const rangeFrom = filtered.length===0 ? 0 : pageStart+1;
  const rangeTo   = Math.min(pageStart+PAGE_SIZE, filtered.length);

  // สรุปด้านบนนับจากชุดที่อยู่ในช่วงเวลา/จังหวัดของ FilterBar (ไม่ผูกกับ pill สถานะในเครื่อง)
  const scoped       = useMemo(()=>data.filter(q=>passes({ date:q.date, province:q.province })),[data,passes]);

  // Related data for selected quotation
  const relCustomer  = selected ? customers.find(c=>c.id===selected.customerId) : null;
  const relLead      = selected ? leads.find(l=>l.company===selected.customer) : null;

  function openAdd(){ setEditingQ(null); setShowModal(true); }
  function openEdit(q:QuotationMock){ setEditingQ(q); setShowModal(true); }

  function saveQ(form:QForm){
    const tv=form.materialCost;
    const total=fmtMoney(tv);
    if(editingQ){
      const updated:QuotationMock={...editingQ,...form,revision:form.revision,expiry:form.expiry,total,totalValue:tv};
      updateQuotation(updated);
      setSelected(p=>p?.id===editingQ.id?updated:p);
    } else {
      const newQ:QuotationMock={...form,revision:form.revision,expiry:form.expiry,id:nextQId(data),total,totalValue:tv};
      addQuotation(newQ);
    }
  }
  function changeStatus(id:string,s:QuotationStatus){
    setQuotationStatus(id,s);
    setSelected(p=>p?.id===id?{...p,status:s}:p);
  }
  // ส่งอีกครั้ง — ตั้งสถานะกลับเป็น "ส่งแล้ว" และอัปเดตวันที่เป็น 2026-06-30
  function sendAgain(q:QuotationMock){
    const RESENT_DATE="2026-06-30";
    const updated:QuotationMock={...q,status:"sent_to_client",date:RESENT_DATE};
    updateQuotation(updated);
    setSelected(p=>p?.id===q.id?updated:p);
    showToast(`ส่งใบเสนอราคา ${q.id} ให้ลูกค้าอีกครั้งแล้ว`);
  }
  // (ทำสำเนา/สร้างเวอร์ชัน ถูกตัดออกตามการรีวิว — ปุ่มไม่ได้ใช้)
  function deleteQ(){
    if(!selected) return;
    ctxDeleteQuotation(selected.id);
    setSelected(null); setDelConfirm(false);
  }
  function selectRow(q:QuotationMock){
    setSelected(p=>p?.id===q.id?null:q);
    setDetailTab("info"); setDelConfirm(false);
  }

  // พิมพ์ใบเสนอราคาเป็นเอกสาร A4 (ต้องตั้งชื่อบริษัทผู้ออกก่อน)
  function printQuotation(q:QuotationMock){
    if(!issuer.company.trim()){ alert("กรุณาตั้งชื่อบริษัทที่ ตั้งค่า → โปรไฟล์บริษัท ก่อนพิมพ์ใบเสนอราคา"); router.push("/settings"); return; }
    const cust=customers.find(c=>c.id===q.customerId);
    const w=window.open("","_blank","width=880,height=1040");
    if(!w){ alert("เบราว์เซอร์บล็อกป็อปอัป — กรุณาอนุญาตป็อปอัปเพื่อพิมพ์ใบเสนอราคา"); return; }
    // ใบเก่าใช้สแนปช็อตผู้ออกที่ตรึงไว้ (คงชื่อเดิม); ใบที่ยังไม่มีค่อยใช้โปรไฟล์ปัจจุบัน
    w.document.write(buildQuotationHTML(q,q.issuer??issuer,cust,docProfile,loadWordmark()));
    w.document.close();
  }

  const detailTabs:[string,string][]=[["info","ข้อมูล"],["customer","ลูกค้า"],["lead","ลูกค้าเป้าหมาย"]];

  // form initial for edit
  function toForm(q:QuotationMock):QForm{
    // ใบเก่าที่ไม่มี lineItems → สังเคราะห์เป็น 1 รายการจาก แม่แบบ/พื้นที่/มูลค่า (แก้ต่อได้)
    const lineItems:QuoteLineItem[] = q.lineItems ?? (q.materialCost>0
      ? [{ name:q.buildingType||"รายการ", qty:q.area||1, unit:q.area?"ตร.ม.":"รายการ", unitPrice:q.area?Math.round(q.materialCost/q.area):q.materialCost }]
      : []);
    return {customerId:q.customerId,customer:q.customer,project:q.project,projectId:q.projectId??0,province:q.province,buildingType:q.buildingType,area:q.area,materialCost:q.materialCost,status:q.status,date:q.date,items:q.items,lineItems,revision:q.revision??"V1",expiry:q.expiry??""};
  }

  return (
    <div className="erp" style={{display:"flex",gap:16,alignItems:"flex-start"}}>

      {/* ══ MAIN ════════════════════════════════════════════ */}
      <div style={{flex:1,minWidth:0}}>

        {/* หัวหน้า/ปุ่ม → ไปอยู่บนแถบบน (ชื่อหน้ามาจาก Topbar) */}
        <TopbarActions>
          <FilterBar dims={[]} />
          <ExportMenu filename="quotations" title="ใบเสนอราคา" small
            headers={["เลขที่","ลูกค้า","ผู้รับผิดชอบ","โครงการ","จังหวัด","ประเภท","พื้นที่","มูลค่ารวม","สถานะ","วันที่"]}
            rows={filtered.map(q=>[q.id,q.customer,customers.find(c=>c.id===q.customerId)?.owner ?? "—",q.project,q.province,q.buildingType,q.area,q.totalValue,quotationStatusLabel[q.status],q.date])} />
          <button onClick={openAdd} className="btn btn-primary btn-sm">
            <Plus size={13}/> เพิ่มใบเสนอราคา
          </button>
        </TopbarActions>
        <p className="page-sub">จัดการใบเสนอราคาและติดตามสถานะ · {timeRange.subtitle}</p>

        {/* ── สรุป 5 ตัวชี้วัด — การ์ด KPI คลิกกรองได้ (มาตรฐานเดียวกับหน้าลูกค้าเป้าหมาย/ลูกค้า) ── */}
        {(() => {
          const fmtC = (v:number) => v>=1e6 ? `฿${(v/1e6).toFixed(1)}M` : v>=1e3 ? `฿${Math.round(v/1e3)}K` : `฿${v}`;
          const STATUS_LIST: QuotationStatus[] = ["draft","sent_to_client","viewed","won","lost","expired"];
          const valOf = (list: QuotationMock[]) => list.reduce((a,q)=>a+q.totalValue,0);
          const totalVal = valOf(scoped); // สรุปตามช่วงเวลาที่กรอง (ตรงกับตาราง)
          const waiting  = scoped.filter(q=>q.status==="sent_to_client"||q.status==="viewed");
          const wonList  = scoped.filter(q=>q.status==="won");
          const lostList = scoped.filter(q=>q.status==="lost");
          const closed   = wonList.length + lostList.length;
          const rate     = closed ? Math.round(wonList.length/closed*100) : 0;
          const clear    = () => setFilterStatus("ALL");
          const kpis = [
            { label:"ใบเสนอราคาทั้งหมด", value:`${scoped.length}`,      sub:"รายการ",            Icon:FileText, color:"#2563EB", bg:"#E8F0FE", on: filterStatus==="ALL", onClick: clear },
            { label:"มูลค่ารวม",         value:fmtC(totalVal),          sub:"ทุกสถานะ",           Icon:Coins,    color:"#16A34A", bg:"#E6F7EE", on: false,                onClick: clear },
            { label:"รอลูกค้าตอบ",       value:`${waiting.length}`,     sub:fmtC(valOf(waiting)), Icon:Send,     color:"#7C3AED", bg:"#F0EBFB", on: filterStatus==="sent_to_client", onClick:()=>setFilterStatus(filterStatus==="sent_to_client"?"ALL":"sent_to_client") },
            { label:"ตอบรับแล้ว",        value:`${wonList.length}`,     sub:fmtC(valOf(wonList)), Icon:Check,    color:"#0D9488", bg:"#E6F7F5", on: filterStatus==="won",  onClick:()=>setFilterStatus(filterStatus==="won"?"ALL":"won") },
            { label:"อัตราตอบรับ",       value:`${rate}%`,              sub:"ตอบรับ/ปิดแล้ว",     Icon:Percent,  color:"#EA580C", bg:"#FEF0E6", on: false,                onClick: clear },
          ];
          return (
            <>
              <div className="dash-kpis" style={{ marginBottom:16 }}>
                {kpis.map(k=>(
                  <button key={k.label} onClick={k.onClick} title={k.on?"กดอีกครั้งเพื่อล้างตัวกรอง":`กรอง: ${k.label}`}
                    className="card" style={{ padding:"16px 14px", display:"flex", flexDirection:"column", gap:6, textAlign:"left",
                      cursor:"pointer", fontFamily:"inherit", width:"100%",
                      border: k.on ? "1.5px solid #003366" : "1px solid #E5E7EB",
                      boxShadow: k.on ? "0 0 0 3px rgba(0,51,102,.08)" : undefined }}>
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

              {/* ชิปกรองสถานะ — สไตล์เดียวกับชิปกรองด่วนหน้าลูกค้าเป้าหมาย */}
              <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:14 }}>
                {([["ALL","ทั้งหมด",scoped.length]] as [string,string,number][])
                  .concat(STATUS_LIST.map(s=>[s, quotationStatusLabel[s], scoped.filter(q=>q.status===s).length] as [string,string,number]))
                  .map(([k,label,cnt])=>{
                    const on = filterStatus===k;
                    return (
                      <button key={k} onClick={()=>setFilterStatus(on&&k!=="ALL"?"ALL":k as QuotationStatus|"ALL")}
                        style={{ display:"flex", alignItems:"center", gap:6, height:32, padding:"0 14px", borderRadius:99, cursor:"pointer", fontFamily:"inherit", fontSize:"0.75rem", fontWeight:700,
                          border:`1px solid ${on?"#003366":"#e5e7eb"}`, background:on?"#003366":"#fff", color:on?"#fff":"#6b7280" }}>
                        {label}
                        <span style={{ fontSize:"0.65rem", fontWeight:800, borderRadius:99, padding:"0 6px",
                          background:on?"rgba(255,255,255,.24)":"#f0f4f8", color:on?"#fff":"#003366" }}>{cnt}</span>
                      </button>
                    );
                  })}
              </div>
            </>
          );
        })()}

        {/* Toolbar */}
        <div className="card" style={{borderRadius:"var(--radius-xl) var(--radius-xl) 0 0",padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,background:"#fafafa",border:`1px solid ${BORDER}`,borderRadius:10,padding:"0 12px",height:36,boxSizing:"border-box",width:280,maxWidth:"100%",flexShrink:0}}>
            <Search size={13} color={MUTED}/>
            <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="ค้นหาเลขที่ / ลูกค้า / โครงการ..."
              style={{border:"none",outline:"none",fontSize:"0.8rem",color:STEEL,background:"transparent",flex:1}}/>
            {query&&<button onClick={()=>setQuery("")} style={{background:"none",border:"none",cursor:"pointer",padding:0,color:MUTED,display:"flex"}}><X size={12}/></button>}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {/* สลับมุมมอง — สไตล์ segmented มีกรอบ (เหมือนหน้าลูกค้าเป้าหมาย/ลูกค้า) */}
            <div style={{display:"flex",border:`1px solid ${BORDER}`,borderRadius:9,overflow:"hidden",height:36,boxSizing:"border-box"}}>
              {([["list",LayoutList,"รายการ"],["card",LayoutGrid,"การ์ด"]] as const).map(([v,Ico,tip])=>(
                <button key={v} onClick={()=>setView(v)}
                  style={{display:"flex",alignItems:"center",gap:5,padding:"0 12px",height:"100%",border:"none",cursor:"pointer",
                    background:view===v?PRIMARY:"#fff",color:view===v?"#fff":"#6b7280",fontFamily:"inherit",fontSize:"0.72rem",fontWeight:600}}>
                  <Ico size={14}/> {tip}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── LIST VIEW ── */}
        {view==="list"&&(
          <div className="card" style={{borderRadius:"0 0 var(--radius-xl) var(--radius-xl)",borderTop:"none"}}>
            <div className={`table-wrap${density==="compact"?" dense":""}`} style={{borderTop:"none"}}>
              <table>
                <colgroup>
                  <col style={{width:"14%"}} />{/* เลขที่ */}
                  <col style={{width:"20%"}} />{/* ลูกค้า */}
                  {!hiddenCols.includes("owner")&&<col style={{width:"13%"}} />}{/* ผู้รับผิดชอบ */}
                  {!hiddenCols.includes("value")&&<col style={{width:"12%"}} />}{/* มูลค่า */}
                  <col style={{width:"11%"}} />{/* สถานะ */}
                  {!hiddenCols.includes("expiry")&&<col style={{width:"12%"}} />}{/* วันหมดอายุ */}
                  <col style={{width:"18%"}} />{/* ปุ่มการกระทำ */}
                </colgroup>
                <thead>
                  <tr>
                    {([{label:"เลขที่",key:"id",col:null},{label:"ลูกค้า",key:"customer",col:null},{label:"ผู้รับผิดชอบ",key:null,col:"owner"},{label:"มูลค่า",key:"totalValue",col:"value"},{label:"สถานะ",key:"status",col:null},{label:"วันหมดอายุ",key:null,col:"expiry"},{label:"",key:null,col:null}] as {label:string;key:SortKey|null;col:string|null}[])
                      .filter(col=>!col.col||!hiddenCols.includes(col.col))
                      .map((col,i)=>(
                      <th key={i} onClick={col.key?()=>handleSort(col.key as SortKey):undefined}
                        style={{cursor:col.key?"pointer":"default",userSelect:"none"}}>
                        <span style={{display:"inline-flex",alignItems:"center"}}>{col.label}{col.key&&<SortIcon k={col.key}/>}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length===0&&<tr><td colSpan={7-["owner","value","expiry"].filter(c=>hiddenCols.includes(c)).length} style={{padding:0}}>
                    <EmptyState icon={<FileText size={28}/>} title="ไม่พบใบเสนอราคา" description="สร้างใบเสนอราคาใหม่จากลูกค้าและดีลของคุณ"
                      action={<button className="btn btn-primary btn-md" onClick={openAdd}><Plus size={14}/> สร้างใบเสนอราคา</button>} />
                  </td></tr>}
                  {paged.map(q=>{
                    const sc=quotationStatusColor[q.status]; const isSel=selected?.id===q.id;
                    return (
                      <tr key={q.id} onClick={()=>selectRow(q)} className="clickable"
                        style={{background:isSel?"#f0f6ff":undefined}}>
                        <td>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <div style={{width:28,height:28,borderRadius:8,background:"#dce5f0",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><FileText size={12} color={PRIMARY}/></div>
                            <span style={{fontSize:"0.8rem",fontWeight:700,color:STEEL,fontFamily:"monospace"}}>{q.id}</span>
                          </div>
                        </td>
                        <td>
                          {q.customerId ? (
                            <button onClick={e=>{e.stopPropagation();router.push(`/customers?open=${q.customerId}`);}}
                              style={{background:"none",border:"none",cursor:"pointer",color:PRIMARY,fontSize:"0.8rem",fontWeight:700,padding:0,textAlign:"left"}}>
                              {q.customer}
                            </button>
                          ) : (
                            <span style={{fontSize:"0.8rem",fontWeight:700,color:STEEL}}>{q.customer}</span>
                          )}
                        </td>
                        {!hiddenCols.includes("owner")&&(
                        <td><AssigneeAvatars value={customers.find(c=>c.id===q.customerId)?.owner ?? ""} size={24} /></td>
                        )}
                        {!hiddenCols.includes("value")&&(
                        <td className="num" style={{fontSize:"0.86rem",fontWeight:800,color:STEEL,whiteSpace:"nowrap"}}>{q.total}</td>
                        )}
                        <td>
                          <span className="badge" style={{background:sc.bg,color:sc.text}}>{quotationStatusLabel[q.status]}</span>
                        </td>
                        {!hiddenCols.includes("expiry")&&(
                        <td style={{fontSize:"0.72rem",color:MUTED,whiteSpace:"nowrap"}}>{q.expiry?fmtDate(q.expiry):"—"}</td>
                        )}
                        <td onClick={e=>e.stopPropagation()}>
                          <div style={{display:"flex",gap:4,flexWrap:"nowrap",justifyContent:"flex-end"}}>
                            {q.status==="draft"&&(
                              <button onClick={()=>changeStatus(q.id,"sent_to_client")} className="btn btn-sm"
                                style={{background:"#d97706",color:"#fff",border:"none",padding:"4px 9px",fontSize:"0.65rem"}}>ส่งลูกค้า</button>
                            )}
                            <button onClick={()=>printQuotation(q)} title="พิมพ์ใบเสนอราคา" className="btn btn-secondary btn-sm"
                              style={{color:PRIMARY,padding:"4px 8px",fontSize:"0.65rem"}}><Printer size={12}/></button>
                            <button onClick={()=>openEdit(q)} className="btn btn-secondary btn-sm"
                              style={{color:PRIMARY,padding:"4px 9px",fontSize:"0.65rem"}}>แก้ไข</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <PaginationBar from={rangeFrom} to={rangeTo} total={filtered.length}
              page={page} totalPages={totalPages}
              onPrev={()=>setPage(p=>Math.max(1,p-1))} onNext={()=>setPage(p=>Math.min(totalPages,p+1))}/>
          </div>
        )}

        {/* ── CARD VIEW ── */}
        {view==="card"&&(
          <div className="card" style={{borderRadius:"0 0 var(--radius-xl) var(--radius-xl)",borderTop:"none"}}>
            <div style={{padding:16}}>
            {filtered.length===0&&<EmptyState icon={<FileText size={28}/>} title="ไม่พบใบเสนอราคา" description="สร้างใบเสนอราคาใหม่จากลูกค้าและดีลของคุณ"
              action={<button className="btn btn-primary btn-md" onClick={openAdd}><Plus size={14}/> สร้างใบเสนอราคา</button>} />}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:14}}>
              {paged.map(q=>{
                const sc=quotationStatusColor[q.status]; const isSel=selected?.id===q.id;
                return (
                  <div key={q.id} onClick={()=>selectRow(q)}
                    style={{background:"#fff",borderRadius:14,border:isSel?`1.5px solid ${PRIMARY}`:`1px solid ${BORDER}`,boxShadow:isSel?"0 4px 18px rgba(0,0,0,.15)":"0 2px 10px rgba(0,0,0,.06)",cursor:"pointer",overflow:"hidden",transition:"all .15s"}}
                    onMouseEnter={e=>{if(!isSel)(e.currentTarget as HTMLElement).style.boxShadow="0 6px 22px rgba(0,0,0,.13)";}}
                    onMouseLeave={e=>{if(!isSel)(e.currentTarget as HTMLElement).style.boxShadow="0 2px 10px rgba(0,0,0,.06)";}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 14px",borderBottom:"1px solid #f0f4f8"}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{width:28,height:28,borderRadius:8,background:"#dce5f0",display:"flex",alignItems:"center",justifyContent:"center"}}><FileText size={12} color={PRIMARY}/></div>
                        <span style={{fontSize:"0.8rem",fontWeight:700,color:STEEL,fontFamily:"monospace"}}>{q.id}</span>
                      </div>
                      <span className="badge" style={{background:sc.bg,color:sc.text}}>{quotationStatusLabel[q.status]}</span>
                    </div>
                    <div style={{padding:"12px 14px"}}>
                      <button onClick={e=>{e.stopPropagation(); if(q.customerId) router.push(`/customers?open=${q.customerId}`);}}
                        style={{background:"none",border:"none",cursor:q.customerId?"pointer":"default",color:q.customerId?PRIMARY:STEEL,fontSize:"0.92rem",fontWeight:800,padding:0,textAlign:"left",display:"block",marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"100%"}}>
                        {q.customer}
                      </button>
                      <div style={{fontSize:"0.72rem",color:MUTED,marginBottom:8,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{q.project} · {q.province}</div>
                      <div style={{display:"flex",gap:0,borderRadius:9,overflow:"hidden",border:"1px solid #f0f4f8",marginBottom:10}}>
                        {[{label:"พื้นที่",value:`${q.area?.toLocaleString()} ม²`},{label:"ประเภท",value:q.buildingType}].map((item,i)=>(
                          <div key={i} style={{flex:1,padding:"6px 8px",background:i%2===0?"#fafafa":"#f3f6fb",borderRight:i<1?"1px solid #f0f4f8":"none",textAlign:"center"}}>
                            <div style={{fontSize:"0.65rem",color:"#9ca3af",fontWeight:600,marginBottom:2}}>{item.label}</div>
                            <div style={{fontSize:"0.65rem",color:STEEL,fontWeight:700}}>{item.value}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{fontSize:"1.15rem",fontWeight:800,color:PRIMARY}}>{q.total}</div>
                    </div>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 14px",borderTop:"1px solid #f0f4f8",background:"#fafbfc"}}>
                      <span style={{fontSize:"0.65rem",color:MUTED}}>{fmtDate(q.date)}</span>
                      <div style={{display:"flex",gap:4}} onClick={e=>e.stopPropagation()}>
                        {q.status==="draft"&&(
                          <button onClick={()=>changeStatus(q.id,"sent_to_client")} className="btn btn-sm"
                            style={{background:"#d97706",color:"#fff",border:"none",padding:"4px 9px",fontSize:"0.65rem"}}>ส่งลูกค้า</button>
                        )}
                        <button onClick={()=>printQuotation(q)} title="พิมพ์ใบเสนอราคา" className="btn btn-secondary btn-sm"
                          style={{color:PRIMARY,padding:"4px 8px",fontSize:"0.65rem"}}><Printer size={11}/></button>
                        <button onClick={()=>openEdit(q)} className="btn btn-secondary btn-sm"
                          style={{color:PRIMARY,padding:"4px 9px",fontSize:"0.65rem"}}>แก้ไข</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            </div>
            <PaginationBar from={rangeFrom} to={rangeTo} total={filtered.length}
              page={page} totalPages={totalPages}
              onPrev={()=>setPage(p=>Math.max(1,p-1))} onNext={()=>setPage(p=>Math.min(totalPages,p+1))}/>
          </div>
        )}
      </div>

      {/* ══ DETAIL PANEL ════════════════════════════════════ */}
      {selected&&(() => {
        const cardStyle: React.CSSProperties = { background:"#fff", border:"1px solid #eef1f5", borderRadius:14, padding:16 };
        const secLabel: React.CSSProperties = { display:"flex", alignItems:"center", gap:6, fontSize:"0.62rem", fontWeight:800, color:"#8a929c", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:12 };
        const qa: React.CSSProperties = { background:"rgba(255,255,255,.15)", border:"none", borderRadius:8, height:30, padding:"0 11px", cursor:"pointer", color:"#fff", display:"flex", alignItems:"center", gap:6, fontSize:"0.72rem", fontWeight:600, fontFamily:"inherit", whiteSpace:"nowrap" };
        const fmtBaht = (n:number) => "฿"+Math.round(n).toLocaleString("th-TH");
        const lineItems: QuoteLineItem[] = selected.lineItems ?? (selected.materialCost>0
          ? [{ name:selected.buildingType||"รายการ", qty:selected.area||1, unit:selected.area?"ตร.ม.":"รายการ", unitPrice:selected.area?Math.round(selected.materialCost/selected.area):selected.materialCost }]
          : []);
        const subtotal = lineItems.reduce((s,li)=>s+li.qty*li.unitPrice, 0);
        const discountPct = selected.discountPct ?? 0;
        const discountAmt = Math.round(subtotal*discountPct/100);
        const net = subtotal - discountAmt;              // = totalValue (มูลค่างาน ก่อน VAT)
        const vatPct = loadHQPolicy().vat;
        const vatAmt = Math.round(net*vatPct/100);
        const grand = net + vatAmt;                      // ยอดรวมสุทธิ (รวม VAT) — ตรงกับเอกสารพิมพ์
        const sc = quotationStatusColor[selected.status];

        return (
        <>
          <div onClick={()=>setSelected(null)} className="drawer-overlay" style={{position:"fixed",inset:0,background:"rgba(45,45,45,.45)",zIndex:200}}/>

          {/* Quotation Detail — แผงกลางจอ · คอลัมน์เดียว (มาตรฐานเดียวกับ ลีด/ลูกค้า) */}
          <div className="modal-pop" style={{position:"fixed",top:"50%",left:"50%",transform:"translate(-50%,-50%)",
            width:820, maxWidth:"calc(100vw - 24px)", height:"min(920px, calc(100vh - 24px))",
            zIndex:210, background:"#fff", boxShadow:"0 30px 90px rgba(0,0,0,.32)", borderRadius:18,
            display:"flex", flexDirection:"column", overflow:"hidden"}}>

            {/* Sticky navy header + quick actions */}
            <div style={{background:PRIMARY,padding:"14px 20px",flexShrink:0}}>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:14,flexWrap:"wrap"}}>
                <div style={{display:"flex",alignItems:"center",gap:12,minWidth:0}}>
                  <div style={{width:46,height:46,borderRadius:13,background:"rgba(255,255,255,.18)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",border:"2px solid rgba(255,255,255,.25)",flexShrink:0}}>
                    <FileText size={20}/>
                  </div>
                  <div style={{minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{fontSize:"0.65rem",fontWeight:700,color:"rgba(255,255,255,.6)",fontFamily:"monospace",letterSpacing:"0.05em"}}>{selected.id}</span>
                    </div>
                    <div style={{fontSize:"1.08rem",fontWeight:800,color:"#fff",lineHeight:1.2,marginTop:2}}>{selected.customer}</div>
                    <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",fontSize:"0.72rem",color:"rgba(255,255,255,.72)",marginTop:4}}>
                      {selected.project && <span>{selected.project}</span>}
                      <span style={{display:"flex",alignItems:"center",gap:3}}><MapPin size={11}/> {selected.province}</span>
                      <span style={{opacity:.8}}>วันที่ {fmtDate(selected.date)}</span>
                      {selected.expiry && <span style={{opacity:.8}}>หมดอายุ {fmtDate(selected.expiry)}</span>}
                    </div>
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:7,flexShrink:0,flexWrap:"wrap"}}>
                  <button title="พิมพ์ / ดาวน์โหลด PDF" onClick={()=>printQuotation(selected)} style={qa}><Printer size={13}/> พิมพ์ PDF</button>
                  <button title="แก้ไข" onClick={()=>openEdit(selected)} style={qa}><Edit2 size={13}/> แก้ไข</button>
                  {(selected.status==="sent_to_client"||selected.status==="viewed") && <button title="ส่งอีกครั้ง" onClick={()=>sendAgain(selected)} style={qa}><Send size={13}/> ส่งอีกครั้ง</button>}
                  {selected.customerId ? <button title="ดูลูกค้า" onClick={()=>router.push(`/customers?open=${selected.customerId}`)} style={qa}><ExternalLink size={13}/> ลูกค้า</button> : null}
                  <button title="ลบใบเสนอราคา" onClick={()=>setDelConfirm(true)} style={{...qa,width:30,padding:0,justifyContent:"center",color:"#fecaca"}}><Trash2 size={14}/></button>
                  <button onClick={()=>setSelected(null)} title="ปิด" style={{...qa,width:30,padding:0,justifyContent:"center"}}><X size={15}/></button>
                </div>
              </div>
              {/* Badges: status · total · items · area */}
              <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginTop:12}}>
                <span style={{padding:"2px 10px",borderRadius:99,fontSize:"0.65rem",fontWeight:700,background:sc.bg,color:sc.text}}>{quotationStatusLabel[selected.status]}</span>
                <span style={{display:"flex",alignItems:"center",gap:4,padding:"2px 10px",borderRadius:99,fontSize:"0.65rem",fontWeight:700,background:"rgba(255,255,255,.18)",color:"#fff"}}><Package size={11}/> {selected.buildingType}</span>
                <span style={{display:"flex",alignItems:"center",gap:4,padding:"2px 10px",borderRadius:99,fontSize:"0.65rem",fontWeight:700,background:"rgba(255,255,255,.18)",color:"#fff"}}>{selected.items} รายการ · {selected.area?.toLocaleString()} ตร.ม.</span>
                <span style={{display:"flex",alignItems:"center",gap:4,padding:"2px 10px",borderRadius:99,fontSize:"0.65rem",fontWeight:800,background:"#fff",color:PRIMARY}}><Coins size={11}/> {selected.total}</span>
              </div>
            </div>

            {/* Body — คอลัมน์เดียว เลื่อนทั้งแผง (drawer) */}
            <div style={{flex:1,overflowY:"auto",background:"#f5f7fa"}}>
              {/* เอกสารใบเสนอราคา (BOQ + รายละเอียด) */}
              <div style={{padding:16,display:"flex",flexDirection:"column",gap:14}}>
                {/* BOQ line items */}
                <div style={cardStyle}>
                  <div style={secLabel}><Layers size={13} color={PRIMARY}/> รายการสินค้า (BOQ)</div>
                  {lineItems.length===0?(
                    <div style={{fontSize:"0.8rem",color:MUTED,textAlign:"center",padding:"18px 0"}}>ไม่มีรายการสินค้า</div>
                  ):(
                    <div style={{overflowX:"auto"}}>
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:"0.78rem"}}>
                        <thead>
                          <tr style={{background:"#f7f9fc"}}>
                            {["รายการ","จำนวน","หน่วย","ราคา/หน่วย","รวม"].map((h,i)=>(
                              <th key={h} style={{textAlign:i>0?"right":"left",padding:"8px 10px",color:"#8a929c",fontWeight:700,whiteSpace:"nowrap",fontSize:"0.68rem"}}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {lineItems.map((li,i)=>(
                            <tr key={i} style={{borderTop:"1px solid #f0f4f8"}}>
                              <td style={{padding:"8px 10px",fontWeight:700,color:STEEL}}>{li.name}</td>
                              <td style={{padding:"8px 10px",textAlign:"right",color:STEEL}}>{li.qty.toLocaleString()}</td>
                              <td style={{padding:"8px 10px",textAlign:"right",color:MUTED}}>{li.unit}</td>
                              <td style={{padding:"8px 10px",textAlign:"right",color:STEEL}}>{fmtBaht(li.unitPrice)}</td>
                              <td style={{padding:"8px 10px",textAlign:"right",fontWeight:700,color:STEEL}}>{fmtBaht(li.qty*li.unitPrice)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {/* Totals — ตรงกับเอกสารพิมพ์: มูลค่างาน (ก่อน VAT) = ยอดที่บันทึก, บวก VAT → ยอดรวมสุทธิ */}
                  <div style={{marginTop:12,marginLeft:"auto",width:"min(340px,100%)",display:"flex",flexDirection:"column",gap:6}}>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:"0.78rem"}}><span style={{color:"#8a929c"}}>ยอดรวมย่อย</span><span style={{fontWeight:700,color:STEEL}}>{fmtBaht(subtotal)}</span></div>
                    {discountPct>0 && <div style={{display:"flex",justifyContent:"space-between",fontSize:"0.78rem"}}><span style={{color:"#8a929c"}}>ส่วนลด {discountPct}%</span><span style={{fontWeight:700,color:"#dc2626"}}>−{fmtBaht(discountAmt)}</span></div>}
                    <div style={{display:"flex",justifyContent:"space-between",padding:"9px 12px",background:"#dce5f0",borderRadius:10,marginTop:2}}>
                      <span style={{fontSize:"0.8rem",fontWeight:700,color:MUTED}}>มูลค่างาน (ก่อน VAT)</span>
                      <span style={{fontSize:"1.05rem",fontWeight:800,color:PRIMARY}}>{fmtBaht(net)}</span>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:"0.76rem",marginTop:2}}><span style={{color:"#8a929c"}}>VAT {vatPct}%</span><span style={{fontWeight:700,color:STEEL}}>{fmtBaht(vatAmt)}</span></div>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:"0.8rem",fontWeight:800,color:STEEL,borderTop:"1px solid #e6eaf0",paddingTop:7}}><span>ยอดรวมสุทธิ (รวม VAT)</span><span>{fmtBaht(grand)}</span></div>
                  </div>
                  {selected.note && (
                    <div style={{marginTop:12,padding:"10px 12px",background:"#fafbfc",border:"1px solid #f0f4f8",borderRadius:10,fontSize:"0.75rem",color:"#4b5563",lineHeight:1.6}}>
                      <span style={{fontWeight:700,color:"#8a929c"}}>หมายเหตุ: </span>{selected.note}
                    </div>
                  )}
                </div>

                {/* รายละเอียดเอกสาร */}
                <div style={cardStyle}>
                  <div style={secLabel}><FileText size={13} color={PRIMARY}/> รายละเอียดเอกสาร</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 24px"}}>
                    {([
                      ["จังหวัด", selected.province],
                      ["ประเภทอาคาร", selected.buildingType],
                      ["พื้นที่", `${selected.area?.toLocaleString()} ตร.ม.`],
                      ["จำนวนรายการ", `${selected.items} รายการ`],
                      ["วันที่ออก", fmtDate(selected.date)],
                      ["วันหมดอายุ", selected.expiry?fmtDate(selected.expiry):"—"],
                      ["เงื่อนไขชำระเงิน", selected.paymentTerms||"—"],
                      ["ระยะเวลาส่งมอบ", selected.deliveryTime||"—"],
                    ] as [string,string][]).map(([k,v])=>(
                      <div key={k} style={{display:"flex",justifyContent:"space-between",gap:10,padding:"7px 0",borderBottom:"1px solid #f0f4f8",fontSize:"0.76rem"}}>
                        <span style={{color:"#8a929c"}}>{k}</span><span style={{fontWeight:700,color:STEEL,textAlign:"right"}}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* สรุป/สถานะ/ลูกค้า/ลูกค้าเป้าหมาย — ต่อในคอลัมน์เดียวกัน */}
              <div style={{width:"100%",padding:"0 16px 16px",display:"flex",flexDirection:"column",gap:14}}>
                {/* Summary + total */}
                <div style={cardStyle}>
                  <div style={secLabel}><Target size={13} color={PRIMARY}/> สรุปใบเสนอราคา</div>
                  <div style={{padding:"12px 14px",background:"#dce5f0",borderRadius:11,display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                    <span style={{fontSize:"0.72rem",fontWeight:700,color:MUTED}}>มูลค่างาน (ก่อน VAT)</span>
                    <span style={{fontSize:"1.2rem",fontWeight:800,color:PRIMARY}}>{fmtBaht(net)}</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:"0.72rem",color:"#8a929c",marginBottom:12,padding:"0 2px"}}>
                    <span>รวม VAT {vatPct}%</span><span style={{fontWeight:700,color:STEEL}}>{fmtBaht(grand)}</span>
                  </div>
                  {([
                    ["สถานะ", quotationStatusLabel[selected.status]],
                    ["วันที่ออก", fmtDate(selected.date)],
                    ["วันหมดอายุ", selected.expiry?fmtDate(selected.expiry):"—"],
                  ] as [string,string][]).map(([k,v])=>(
                    <div key={k} style={{display:"flex",justifyContent:"space-between",gap:10,padding:"7px 0",borderBottom:"1px solid #f0f4f8",fontSize:"0.76rem"}}>
                      <span style={{color:"#8a929c"}}>{k}</span><span style={{fontWeight:700,color:STEEL,textAlign:"right"}}>{v}</span>
                    </div>
                  ))}
                  {selected.status==="won"&&(
                    <div style={{fontSize:"0.68rem",color:"#059669",marginTop:10,display:"flex",gap:6,alignItems:"flex-start"}}><Check size={13} style={{flexShrink:0,marginTop:1}}/> ลูกค้าตอบรับแล้ว — ไปปิดการขายที่เส้นทางการขาย/ลูกค้าเป้าหมาย</div>
                  )}
                </div>

                {/* Status workflow */}
                {STATUS_ACTIONS[selected.status].length>0&&(
                  <div style={cardStyle}>
                    <div style={secLabel}><ArrowRight size={13} color={PRIMARY}/> เปลี่ยนสถานะ</div>
                    <div style={{display:"flex",flexDirection:"column",gap:6}}>
                      {STATUS_ACTIONS[selected.status].map(action=>(
                        <button key={action.next} onClick={()=>changeStatus(selected.id,action.next)} className="btn"
                          style={{justifyContent:"space-between",padding:"9px 12px",background:action.bg,border:"none",width:"100%"}}>
                          <span style={{fontSize:"0.72rem",fontWeight:700,color:action.color}}>{action.label}</span>
                          <ArrowRight size={13} color={action.color}/>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* ลูกค้า / ดีล — รวมผู้ติดต่อ + ดีลที่เกี่ยวข้องไว้ใบเดียว (ไม่แยกลูกค้า/ลูกค้าเป้าหมายให้ซ้ำ) */}
                <div style={cardStyle}>
                  <div style={secLabel}><User size={13} color={PRIMARY}/> ลูกค้า / ดีล</div>
                  {(relCustomer||relLead)?(()=>{
                    // ข้อมูลผู้ติดต่อ: ใช้ของลูกค้าก่อน ถ้าไม่มีค่อยดึงจากลูกค้าเป้าหมาย (ดีล)
                    const company  = relCustomer?.company || relLead?.company || selected.customer;
                    const contact  = relCustomer?.name || relLead?.contact || "—";
                    const initials = relCustomer?.initials || company.replace(/บจ\.|หจก\.|บมจ\./g,"").trim().slice(0,2) || "ลค";
                    const color    = relCustomer?.color || PRIMARY;
                    const rows: [string,string][] = [
                      ["โทรศัพท์", relCustomer?.phone || relLead?.phone || "—"],
                      ["อีเมล",    relCustomer?.email || relLead?.email || "—"],
                      ["จังหวัด",  relCustomer?.province || relLead?.province || selected.province],
                      // จากดีล (ลูกค้าเป้าหมาย) เพิ่มเฉพาะที่ไม่ซ้ำกับ "รายละเอียดเอกสาร"
                      ...(relLead?[["ผู้รับผิดชอบ",relLead.assigned] as [string,string],["สถานะดีล",leadStatusLabel[relLead.status]] as [string,string]]:[]),
                    ];
                    return (
                      <>
                        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                          <div style={{width:40,height:40,borderRadius:12,background:color,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:"0.9rem",flexShrink:0}}>{initials}</div>
                          <div style={{minWidth:0}}>
                            <div style={{fontSize:"0.84rem",fontWeight:800,color:STEEL,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{company}</div>
                            <div style={{fontSize:"0.72rem",color:MUTED,marginTop:1}}>{contact}</div>
                          </div>
                        </div>
                        {rows.map(([k,v])=>(
                          <div key={k} style={{display:"flex",justifyContent:"space-between",gap:10,padding:"6px 0",borderBottom:"1px solid #f0f4f8",fontSize:"0.74rem"}}>
                            <span style={{color:"#8a929c"}}>{k}</span><span style={{fontWeight:700,color:STEEL,maxWidth:180,textAlign:"right",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v}</span>
                          </div>
                        ))}
                        <div style={{display:"flex",gap:8,marginTop:12}}>
                          {relCustomer&&(
                            <button onClick={()=>router.push(`/customers?open=${relCustomer.id}`)} className="btn btn-secondary btn-sm" style={{justifyContent:"center",flex:1,color:PRIMARY}}>
                              <ExternalLink size={13}/> ดูลูกค้า
                            </button>
                          )}
                          {relLead&&(
                            <button onClick={()=>router.push(`/leads?open=${relLead.numId}`)} className="btn btn-secondary btn-sm" style={{justifyContent:"center",flex:1,color:PRIMARY}}>
                              <ExternalLink size={13}/> ดูดีล
                            </button>
                          )}
                        </div>
                      </>
                    );
                  })():(
                    <div style={{textAlign:"center",padding:"18px 0",color:MUTED,fontSize:"0.8rem"}}>ไม่พบข้อมูลลูกค้า/ดีล</div>
                  )}
                </div>
              </div>
            </div>

            {/* Floating action bar */}
            <div style={{flexShrink:0,borderTop:"1px solid #e6eaf0",background:"#fafbfc",padding:"11px 20px",display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:"0.68rem",color:"#8a929c",display:"flex",alignItems:"center",gap:5}}><Coins size={13} color={PRIMARY}/> มูลค่างาน (ก่อน VAT) {fmtBaht(net)} · รวม VAT {fmtBaht(grand)}</span>
              <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:8}}>
                <button onClick={()=>openEdit(selected)} className="btn btn-secondary btn-md" style={{color:PRIMARY}}><Edit2 size={14}/> แก้ไข</button>
                <button onClick={()=>printQuotation(selected)} className="btn btn-primary btn-md"><Printer size={14}/> พิมพ์ / ดาวน์โหลด PDF</button>
              </div>
            </div>
          </div>
        </>
        );
      })()}

      {/* Delete confirm dialog */}
      {delConfirm&&selected&&(
        <div onClick={()=>setDelConfirm(false)} style={{position:"fixed",inset:0,background:"rgba(45,45,45,.5)",zIndex:220,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:360,background:"#fff",borderRadius:16,overflow:"hidden",boxShadow:"0 24px 64px rgba(0,0,0,.25)"}}>
            <div style={{padding:"22px 22px 16px"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                <span style={{width:38,height:38,borderRadius:"50%",background:"#fee2e2",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Trash2 size={17} color="#dc2626"/></span>
                <div style={{fontSize:"1rem",fontWeight:800,color:STEEL}}>ลบใบเสนอราคา</div>
              </div>
              <p style={{fontSize:"0.8rem",color:MUTED,lineHeight:1.6,margin:0}}>ต้องการลบ <strong style={{color:STEEL}}>{selected.id}</strong>? การลบไม่สามารถย้อนกลับได้</p>
            </div>
            <div style={{padding:"14px 22px",borderTop:`1px solid ${BORDER}`,background:"#fafafa",display:"flex",justifyContent:"flex-end",gap:8}}>
              <button className="btn btn-secondary btn-md" onClick={()=>setDelConfirm(false)}>ยกเลิก</button>
              <button className="btn btn-md" style={{background:"#dc2626",color:"#fff",border:"none"}} onClick={deleteQ}><Trash2 size={13}/> ลบ</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal — สร้างใหม่ใช้ตัวช่วย 4 ขั้นตอน (Customer→Deal→แม่แบบ→BOQ→ใบเสนอราคา) · แก้ไขใช้ฟอร์มเดิม */}
      {showModal && !editingQ && (
        <QuotationCreateModal onClose={()=>setShowModal(false)} onToast={showToast} />
      )}
      {showModal && editingQ && (
        <QuotationModal
          title="แก้ไขใบเสนอราคา"
          initial={toForm(editingQ)}
          customers={customers}
          onSave={saveQ} onClose={()=>setShowModal(false)}/>
      )}

      {/* Toast — การแจ้งเตือนสั้นๆ */}
      {toast&&(
        <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",zIndex:300,
          background:PRIMARY,color:"#fff",padding:"11px 20px",borderRadius:12,
          boxShadow:"0 12px 40px rgba(0,0,0,.28)",display:"flex",alignItems:"center",gap:9,
          fontSize:"0.8rem",fontWeight:700,maxWidth:"calc(100vw - 32px)"}}>
          <span style={{width:18,height:18,borderRadius:99,background:"rgba(255,255,255,.2)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>✓</span>
          {toast}
        </div>
      )}
    </div>
  );
}
