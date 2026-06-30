"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  invoices as INIT_INV, contracts, customers, projects, payments as INIT_PAY,
  invoiceStatusLabel, invoiceStatusColor,
  contractStatusLabel, contractStatusColor,
  paymentMethodLabel, paymentMethodColor, paymentStatusLabel, paymentStatusColor,
  type InvoiceStatus, type InvoiceMock, type PaymentMock,
} from "@/lib/mock";
import {
  Plus, Search, X, Receipt, LayoutList, CreditCard,
  Download, Edit2, Trash2, ChevronUp, ChevronDown,
  AlertTriangle, ExternalLink, ArrowRight, FileSignature,
  Building2, CheckCircle2,
} from "lucide-react";

// ── Tokens ─────────────────────────────────────────────────────
const PRIMARY = "#003366";
const STEEL   = "#2D2D2D";
const BORDER  = "#e5e7eb";
const MUTED   = "#6b7280";

// ── Status workflow ────────────────────────────────────────────
const STATUS_ACTIONS: Record<InvoiceStatus,{label:string;next:InvoiceStatus;bg:string;color:string}[]> = {
  draft:     [{label:"ส่งใบแจ้งหนี้",next:"sent",bg:"#dce5f0",color:PRIMARY},{label:"ยกเลิก",next:"cancelled",bg:"#fee2e2",color:"#dc2626"}],
  sent:      [{label:"บันทึกชำระแล้ว",next:"paid",bg:"#e5faf0",color:"#059669"},{label:"ทำเครื่องหมายเกินกำหนด",next:"overdue",bg:"#fef3cd",color:"#d97706"},{label:"ยกเลิก",next:"cancelled",bg:"#fee2e2",color:"#dc2626"}],
  overdue:   [{label:"บันทึกชำระแล้ว",next:"paid",bg:"#e5faf0",color:"#059669"},{label:"ยกเลิก",next:"cancelled",bg:"#fee2e2",color:"#dc2626"}],
  paid:      [],
  cancelled: [{label:"เปิดร่างใหม่",next:"draft",bg:"#f0f0f5",color:MUTED}],
};

const ALL_STATUSES: InvoiceStatus[] = ["draft","sent","paid","overdue","cancelled"];
type SortKey = "id"|"client"|"total"|"issueDate"|"dueDate"|"status";
type SortDir = "asc"|"desc";
type IForm = {
  client:string; project:string; contractRef:string;
  issueDate:string; dueDate:string; subtotal:number;
  milestone:string; note:string; status:InvoiceStatus;
};

// ── Helpers ───────────────────────────────────────────────────
const VAT = 0.07;
function fmt(n:number){ return "฿"+n.toLocaleString("th-TH"); }
function calcVat(subtotal:number){ const vat=Math.round(subtotal*VAT); return {vatAmount:vat, total:subtotal+vat}; }
function nextInvId(data:InvoiceMock[]){
  const nums=data.map(i=>parseInt(i.id.split("-")[2]??"")||0);
  return `INV-2026-${String(Math.max(...nums,40)+1).padStart(4,"0")}`;
}
function fmtDate(d:string){ if(!d||d==="—") return "—"; const [y,m,day]=d.split("-"); const mo=["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."]; return `${parseInt(day)} ${mo[parseInt(m)-1]} ${parseInt(y)+543}`; }
function exportCSV(rows:InvoiceMock[]){
  const h=["เลขที่","ลูกค้า","โอกาสการขาย","งวด","สัญญา","วันออก","วันครบ","ก่อน VAT","VAT","รวม","สถานะ","หมายเหตุ"];
  const lines=rows.map(i=>[i.id,i.client,i.project,i.milestone,i.contractRef,i.issueDate,i.dueDate,i.subtotal,i.vatAmount,i.total,invoiceStatusLabel[i.status],i.note].join(","));
  const blob=new Blob(["﻿"+[h.join(","),...lines].join("\n")],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download="invoices.csv"; a.click(); URL.revokeObjectURL(url);
}

const TODAY = "2026-06-23";
function buildBlank():IForm{
  const cu=customers[0];
  return { client:cu.company, project:"", contractRef:"", issueDate:TODAY, dueDate:"", subtotal:0, milestone:"", note:"", status:"draft" };
}

// ── Modal ─────────────────────────────────────────────────────
function InvoiceModal({ initial, title, onSave, onClose }:{
  initial:IForm; title:string; onSave:(f:IForm)=>void; onClose:()=>void;
}){
  const [form,setForm]=useState<IForm>(initial);
  function set<K extends keyof IForm>(k:K,v:IForm[K]){setForm(p=>({...p,[k]:v}));}
  function pickCustomer(id:number){
    const cu=customers.find(c=>c.id===id); if(!cu) return;
    setForm(p=>({...p,client:cu.company}));
  }
  function pickContract(ref:string){
    const ct=contracts.find(c=>c.id===ref); if(!ct) return;
    setForm(p=>({...p,contractRef:ref,client:ct.client,project:ct.project}));
  }
  const {vatAmount,total}=calcVat(form.subtotal);
  function submit(){if(!form.client||form.subtotal<=0) return; onSave(form); onClose();}
  return (
    <>
      <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(45,45,45,.4)",zIndex:200}}/>
      <div onClick={e=>e.stopPropagation()} style={{position:"fixed",inset:0,zIndex:210,display:"flex",alignItems:"center",justifyContent:"center",padding:20,pointerEvents:"none"}}>
        <div style={{width:"100%",maxWidth:560,background:"#fff",borderRadius:20,border:`1px solid ${BORDER}`,pointerEvents:"auto",overflow:"hidden",boxShadow:"0 24px 80px rgba(0,0,0,.2)"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 22px",borderBottom:`1px solid ${BORDER}`,background:PRIMARY}}>
            <div style={{fontSize:"0.92rem",fontWeight:800,color:"#fff"}}>{title}</div>
            <button onClick={onClose} style={{width:28,height:28,borderRadius:8,border:"1px solid rgba(255,255,255,.2)",background:"rgba(255,255,255,.1)",color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><X size={13}/></button>
          </div>
          <div style={{padding:"20px 22px",overflowY:"auto",maxHeight:"68vh",display:"flex",flexDirection:"column",gap:13}}>
            {/* Client */}
            <div>
              <label className="form-label">ลูกค้า *</label>
              <select className="form-select" onChange={e=>pickCustomer(Number(e.target.value))} defaultValue="">
                <option value="" disabled>— เลือกลูกค้า —</option>
                {customers.map(c=><option key={c.id} value={c.id}>{c.company}</option>)}
              </select>
              <input className="form-input" value={form.client} onChange={e=>set("client",e.target.value)} placeholder="ชื่อลูกค้า *" style={{marginTop:6}}/>
            </div>
            {/* Contract */}
            <div>
              <label className="form-label">สัญญาอ้างอิง</label>
              <select className="form-select" onChange={e=>pickContract(e.target.value)} defaultValue="">
                <option value="">— เลือกสัญญา (ไม่บังคับ) —</option>
                {contracts.map(c=><option key={c.id} value={c.id}>{c.id} — {c.client}</option>)}
              </select>
              <input className="form-input" value={form.contractRef} onChange={e=>set("contractRef",e.target.value)} placeholder="เลขที่สัญญา เช่น C-2026-001" style={{marginTop:6}}/>
            </div>
            <div>
              <label className="form-label">โอกาสการขาย</label>
              <input className="form-input" value={form.project} onChange={e=>set("project",e.target.value)} placeholder="ชื่อโอกาสการขาย"/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div>
                <label className="form-label">งวดที่ / หัวข้อ</label>
                <input className="form-input" value={form.milestone} onChange={e=>set("milestone",e.target.value)} placeholder="เช่น งวดที่ 1 (30%)"/>
              </div>
              <div>
                <label className="form-label">สถานะ</label>
                <select className="form-select" value={form.status} onChange={e=>set("status",e.target.value as InvoiceStatus)}>
                  {ALL_STATUSES.map(s=><option key={s} value={s}>{invoiceStatusLabel[s]}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">วันที่ออก</label>
                <input className="form-input" type="date" value={form.issueDate} onChange={e=>set("issueDate",e.target.value)}/>
              </div>
              <div>
                <label className="form-label">วันครบกำหนด</label>
                <input className="form-input" type="date" value={form.dueDate} onChange={e=>set("dueDate",e.target.value)}/>
              </div>
            </div>
            {/* Amount */}
            <div>
              <label className="form-label">ยอดก่อน VAT (บาท) *</label>
              <input className="form-input" type="number" value={form.subtotal||""} onChange={e=>set("subtotal",Number(e.target.value))} placeholder="0"/>
            </div>
            {form.subtotal>0&&(
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                {[{l:"ก่อน VAT",v:fmt(form.subtotal),c:STEEL},{l:"VAT 7%",v:fmt(vatAmount),c:MUTED},{l:"รวมทั้งสิ้น",v:fmt(total),c:PRIMARY}].map((r,i)=>(
                  <div key={i} style={{textAlign:"center",padding:"8px",background:"#fafafa",borderRadius:9}}>
                    <div style={{fontSize:"0.6rem",color:MUTED,fontWeight:700,marginBottom:3}}>{r.l}</div>
                    <div style={{fontSize:"0.8rem",fontWeight:800,color:r.c}}>{r.v}</div>
                  </div>
                ))}
              </div>
            )}
            <div>
              <label className="form-label">หมายเหตุ</label>
              <textarea className="form-textarea" value={form.note} onChange={e=>set("note",e.target.value)} placeholder="หมายเหตุเพิ่มเติม" rows={2}
                style={{resize:"none",lineHeight:1.5}}/>
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

// ── Main ──────────────────────────────────────────────────────
export default function InvoicesPage(){
  const router = useRouter();
  const [data, setData]             = useState<InvoiceMock[]>(INIT_INV);
  const [payData, setPayData]       = useState<PaymentMock[]>(INIT_PAY);
  const [query, setQuery]           = useState("");
  const [filterStatus, setFilterStatus] = useState<InvoiceStatus|"ALL">("ALL");
  const [view, setView]             = useState<"list"|"card">("list");
  const [sortKey, setSortKey]       = useState<SortKey>("issueDate");
  const [sortDir, setSortDir]       = useState<SortDir>("desc");
  const [selected, setSelected]     = useState<InvoiceMock|null>(null);
  const [showModal, setShowModal]   = useState(false);
  const [editingInv, setEditingInv] = useState<InvoiceMock|null>(null);
  const [delConfirm, setDelConfirm] = useState(false);
  const [detailTab, setDetailTab]   = useState<"info"|"payments"|"contract"|"customer"|"project">("info");

  function handleSort(k:SortKey){ if(sortKey===k) setSortDir(d=>d==="asc"?"desc":"asc"); else{setSortKey(k);setSortDir("asc");} }
  const SortIcon=({k}:{k:SortKey})=>sortKey===k?(sortDir==="asc"?<ChevronUp size={10} style={{marginLeft:2}}/>:<ChevronDown size={10} style={{marginLeft:2}}/>):<ChevronDown size={10} style={{marginLeft:2,opacity:.3}}/>;

  const filtered = useMemo(()=>{
    let rows=data.filter(i=>{
      const matchQ=!query||i.id.toLowerCase().includes(query.toLowerCase())||i.client.toLowerCase().includes(query.toLowerCase())||i.project.toLowerCase().includes(query.toLowerCase())||i.contractRef.includes(query)||i.milestone.includes(query);
      const matchS=filterStatus==="ALL"||i.status===filterStatus;
      return matchQ&&matchS;
    });
    rows=[...rows].sort((a,b)=>{
      const va=a[sortKey] as string|number;
      const vb=b[sortKey] as string|number;
      const cmp=typeof va==="number"?(va as number)-(vb as number):(va as string).localeCompare(vb as string,"th");
      return sortDir==="asc"?cmp:-cmp;
    });
    return rows;
  },[data,query,filterStatus,sortKey,sortDir]);

  // Stat counts
  const paidRows     = data.filter(i=>i.status==="paid");
  const sentRows     = data.filter(i=>i.status==="sent");
  const overdueRows  = data.filter(i=>i.status==="overdue");
  const paidTotal    = paidRows.reduce((s,i)=>s+i.total,0);
  const pendingTotal = sentRows.reduce((s,i)=>s+i.total,0);
  const overdueTotal = overdueRows.reduce((s,i)=>s+i.total,0);

  // Related data for selected
  const relContract  = selected ? contracts.find(c=>c.id===selected.contractRef) : null;
  const relCustomer  = selected ? customers.find(c=>c.company===selected.client) : null;
  const relProject   = selected ? projects.find(p=>p.title===selected.project) : null;
  const relPayments  = selected ? payData.filter(p=>p.invoiceRef===selected.id) : [];
  const totalPaid    = relPayments.filter(p=>p.status==="confirmed").reduce((s,p)=>s+p.amount,0);

  function openAdd(){ setEditingInv(null); setShowModal(true); }
  function openEdit(inv:InvoiceMock){ setEditingInv(inv); setShowModal(true); }

  function saveInvoice(form:IForm){
    const {vatAmount,total}=calcVat(form.subtotal);
    if(editingInv){
      const updated={...editingInv,...form,vatAmount,total};
      setData(p=>p.map(i=>i.id===editingInv.id?updated:i));
      setSelected(p=>p?.id===editingInv.id?updated:p);
    } else {
      const newInv:InvoiceMock={...form,id:nextInvId(data),vatRate:7,vatAmount,total};
      setData(p=>[newInv,...p]);
    }
  }
  function changeStatus(id:string,s:InvoiceStatus){
    setData(p=>p.map(i=>i.id===id?{...i,status:s}:i));
    setSelected(p=>p?.id===id?{...p,status:s}:p);
  }
  function deleteInvoice(){
    if(!selected) return;
    setData(p=>p.filter(i=>i.id!==selected.id));
    setSelected(null); setDelConfirm(false);
  }
  function selectRow(inv:InvoiceMock){ setSelected(p=>p?.id===inv.id?null:inv); setDetailTab("info"); setDelConfirm(false); }

  function toForm(inv:InvoiceMock):IForm{
    return {client:inv.client,project:inv.project,contractRef:inv.contractRef,issueDate:inv.issueDate,dueDate:inv.dueDate,subtotal:inv.subtotal,milestone:inv.milestone,note:inv.note,status:inv.status};
  }

  const dtabs:[string,string,number?][]=[
    ["info","ข้อมูล"],
    ["payments","การชำระเงิน",relPayments.length],
    ["contract","สัญญา"],
    ["customer","ลูกค้า"],
    ["project","โอกาสการขาย"],
  ];

  return (
    <div className="erp" style={{display:"flex",gap:16,alignItems:"flex-start"}}>

      {/* ══ MAIN ════════════════════════════════════════════ */}
      <div style={{flex:1,minWidth:0}}>

        {/* Header */}
        <div className="page-head">
          <div>
            <h2>ใบแจ้งหนี้</h2>
            <p>ติดตามการออกใบแจ้งหนี้และการชำระเงิน</p>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <button onClick={()=>exportCSV(filtered)} className="btn btn-secondary btn-sm">
              <Download size={13}/> ส่งออก
            </button>
            <button onClick={openAdd} className="btn btn-primary btn-sm">
              <Plus size={13}/> ออกใบแจ้งหนี้
            </button>
          </div>
        </div>

        {/* Stat cards */}
        <div className="stat-grid" style={{gridTemplateColumns:"repeat(4,1fr)",marginBottom:14}}>
          {[
            {label:"ชำระแล้ว",     value:fmt(paidTotal),    color:"#059669", key:"paid"},
            {label:"รอชำระ",       value:fmt(pendingTotal), color:PRIMARY,   key:"sent"},
            {label:"เกินกำหนด",   value:fmt(overdueTotal), color:"#dc2626", key:"overdue"},
            {label:"ทั้งหมด",     value:`${data.length} รายการ`, color:STEEL, key:"ALL"},
          ].map((s,i)=>(
            <div key={i} className="stat-card clickable" onClick={()=>setFilterStatus(s.key as InvoiceStatus|"ALL")}>
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={{fontSize:i<3?"1.1rem":"1.3rem",color:s.color}}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Overdue alert */}
        {overdueRows.length>0&&(
          <div style={{background:"#fee2e2",border:"1px solid rgba(220,38,38,.25)",borderRadius:12,padding:"10px 14px",marginBottom:12,display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}
            onClick={()=>setFilterStatus("overdue")}>
            <AlertTriangle size={14} color="#dc2626"/>
            <span style={{fontSize:"0.78rem",color:"#dc2626",fontWeight:600}}>
              มีใบแจ้งหนี้เกินกำหนดชำระ {overdueRows.length} รายการ — มูลค่ารวม {fmt(overdueTotal)}
            </span>
          </div>
        )}

        {/* Status filter */}
        <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
          {([["ALL","ทั้งหมด",data.length],...ALL_STATUSES.map(s=>[s,invoiceStatusLabel[s],data.filter(i=>i.status===s).length])] as [string,string,number][]).map(([key,label,cnt])=>{
            const active=filterStatus===key;
            const col=key==="ALL"?{bg:"#dce5f0",text:PRIMARY}:invoiceStatusColor[key as InvoiceStatus]??{bg:"#dce5f0",text:PRIMARY};
            return (
              <button key={key} onClick={()=>setFilterStatus(key as InvoiceStatus|"ALL")}
                style={{padding:"5px 14px",borderRadius:99,border:`1px solid ${active?col.text+"60":BORDER}`,background:active?col.bg:"#fff",color:active?col.text:MUTED,fontSize:"0.72rem",fontWeight:600,cursor:"pointer"}}>
                {label} ({cnt})
              </button>
            );
          })}
        </div>

        {/* Toolbar */}
        <div className="card" style={{borderRadius:"var(--radius-xl) var(--radius-xl) 0 0",padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"none",gap:10,flexWrap:"wrap"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,background:"#fafafa",border:`1px solid ${BORDER}`,borderRadius:10,padding:"7px 12px",minWidth:280}}>
            <Search size={13} color={MUTED}/>
            <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="ค้นหาใบแจ้งหนี้ / ลูกค้า / โอกาสการขาย / สัญญา..."
              style={{border:"none",outline:"none",fontSize:"0.78rem",color:STEEL,background:"transparent",flex:1}}/>
            {query&&<button onClick={()=>setQuery("")} style={{background:"none",border:"none",cursor:"pointer",padding:0,color:MUTED,display:"flex"}}><X size={12}/></button>}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{display:"flex",alignItems:"center",background:"#f0f4f8",borderRadius:99,padding:3,border:`1px solid ${BORDER}`}}>
              {(["list","card"] as const).map(v=>(
                <button key={v} onClick={()=>setView(v)}
                  style={{display:"flex",alignItems:"center",gap:5,padding:"5px 12px",borderRadius:99,border:"none",background:view===v?PRIMARY:"transparent",color:view===v?"#fff":MUTED,fontSize:"0.71rem",fontWeight:700,cursor:"pointer",transition:"all .15s"}}>
                  {v==="list"?<LayoutList size={12}/>:<CreditCard size={12}/>}{v==="list"?"รายการ":"การ์ด"}
                </button>
              ))}
            </div>
            <span style={{fontSize:"0.72rem",color:MUTED}}>แสดง {filtered.length}/{data.length}</span>
          </div>
        </div>

        {/* ── LIST VIEW ── */}
        {view==="list"&&(
          <div className="card" style={{borderRadius:"0 0 var(--radius-xl) var(--radius-xl)",borderTop:"none"}}>
            <div className="table-wrap" style={{borderTop:"none"}}>
              <table>
                <thead>
                  <tr>
                    {([{l:"เลขที่",k:"id"},{l:"ลูกค้า",k:"client"},{l:"โอกาสการขาย / งวด",k:null},{l:"ก่อน VAT",k:null},{l:"VAT 7%",k:null},{l:"รวม",k:"total"},{l:"วันออก",k:"issueDate"},{l:"ครบกำหนด",k:"dueDate"},{l:"สถานะ",k:"status"},{l:"",k:null}] as {l:string;k:SortKey|null}[]).map((col,i)=>(
                      <th key={i} onClick={col.k?()=>handleSort(col.k as SortKey):undefined}
                        style={{cursor:col.k?"pointer":"default",userSelect:"none"}}>
                        <span style={{display:"inline-flex",alignItems:"center"}}>{col.l}{col.k&&<SortIcon k={col.k}/>}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length===0&&<tr><td colSpan={10} style={{textAlign:"center",padding:"40px 0",color:MUTED,fontSize:"0.82rem"}}>ไม่พบใบแจ้งหนี้</td></tr>}
                  {filtered.map(inv=>{
                    const sc=invoiceStatusColor[inv.status]; const isOv=inv.status==="overdue"; const isSel=selected?.id===inv.id;
                    return (
                      <tr key={inv.id} onClick={()=>selectRow(inv)} className="clickable"
                        style={{background:isSel?"#f0f6ff":undefined}}>
                        <td>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <div style={{width:28,height:28,borderRadius:8,background:isOv?"#fee2e2":"#dce5f0",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                              <Receipt size={12} color={isOv?"#dc2626":PRIMARY}/>
                            </div>
                            <div>
                              <div style={{fontSize:"0.78rem",fontWeight:700,color:STEEL,fontFamily:"monospace"}}>{inv.id}</div>
                              {inv.contractRef&&<button onClick={e=>{e.stopPropagation();router.push("/quotations");}} style={{background:"none",border:"none",cursor:"pointer",color:PRIMARY,fontSize:"0.62rem",fontWeight:700,padding:0}}>{inv.contractRef}</button>}
                            </div>
                          </div>
                        </td>
                        <td>
                          <button onClick={e=>{e.stopPropagation();const cu=customers.find(c=>c.company===inv.client);if(cu)router.push(`/customers/${cu.id}`);}}
                            style={{background:"none",border:"none",cursor:"pointer",color:PRIMARY,fontSize:"0.82rem",fontWeight:700,padding:0,textAlign:"left"}}>
                            {inv.client}
                          </button>
                        </td>
                        <td style={{minWidth:160}}>
                          <div style={{fontSize:"0.75rem",color:STEEL,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:160}}>{inv.project}</div>
                          <div style={{fontSize:"0.65rem",color:PRIMARY,fontWeight:600,marginTop:1}}>{inv.milestone}</div>
                        </td>
                        <td className="num" style={{fontSize:"0.78rem",color:MUTED,whiteSpace:"nowrap"}}>{fmt(inv.subtotal)}</td>
                        <td className="num" style={{fontSize:"0.78rem",color:MUTED,whiteSpace:"nowrap"}}>{fmt(inv.vatAmount)}</td>
                        <td className="num" style={{fontSize:"0.9rem",fontWeight:800,color:isOv?"#dc2626":STEEL,whiteSpace:"nowrap"}}>{fmt(inv.total)}</td>
                        <td style={{fontSize:"0.74rem",color:MUTED,whiteSpace:"nowrap"}}>{fmtDate(inv.issueDate)}</td>
                        <td style={{fontSize:"0.74rem",color:isOv?"#dc2626":MUTED,fontWeight:isOv?700:400,whiteSpace:"nowrap"}}>{fmtDate(inv.dueDate)}</td>
                        <td>
                          <span className="badge" style={{background:sc.bg,color:sc.text}}>
                            {invoiceStatusLabel[inv.status]}
                          </span>
                        </td>
                        <td onClick={e=>e.stopPropagation()}>
                          <div style={{display:"flex",gap:4}}>
                            {STATUS_ACTIONS[inv.status].length>0&&(
                              <button onClick={()=>changeStatus(inv.id,STATUS_ACTIONS[inv.status][0].next)}
                                style={{padding:"4px 8px",borderRadius:7,border:"none",background:STATUS_ACTIONS[inv.status][0].bg,color:STATUS_ACTIONS[inv.status][0].color,fontSize:"0.62rem",fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>
                                {STATUS_ACTIONS[inv.status][0].label.split(" ")[0]}
                              </button>
                            )}
                            <button onClick={()=>openEdit(inv)}
                              style={{padding:"4px 9px",borderRadius:7,border:`1px solid ${BORDER}`,background:"#fff",color:PRIMARY,fontSize:"0.67rem",fontWeight:600,cursor:"pointer"}}>แก้ไข</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{padding:"10px 16px",borderTop:`1px solid ${BORDER}`}}>
              <span style={{fontSize:"0.72rem",color:MUTED}}>แสดง {filtered.length} จาก {data.length} รายการ</span>
            </div>
          </div>
        )}

        {/* ── CARD VIEW ── */}
        {view==="card"&&(
          <div className="card" style={{borderRadius:"0 0 var(--radius-xl) var(--radius-xl)",borderTop:"none",padding:16}}>
            {filtered.length===0&&<div style={{textAlign:"center",padding:"40px 0",color:MUTED}}>ไม่พบใบแจ้งหนี้</div>}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:14}}>
              {filtered.map(inv=>{
                const sc=invoiceStatusColor[inv.status]; const isOv=inv.status==="overdue"; const isSel=selected?.id===inv.id;
                return (
                  <div key={inv.id} onClick={()=>selectRow(inv)}
                    style={{borderRadius:14,border:isSel?`1.5px solid ${PRIMARY}`:`1px solid ${BORDER}`,boxShadow:isSel?"0 4px 18px rgba(0,0,0,.15)":"0 2px 10px rgba(0,0,0,.06)",overflow:"hidden",cursor:"pointer",transition:"all .15s",background:"#fff"}}
                    onMouseEnter={e=>{if(!isSel)(e.currentTarget as HTMLElement).style.boxShadow="0 6px 22px rgba(0,0,0,.13)";}}
                    onMouseLeave={e=>{if(!isSel)(e.currentTarget as HTMLElement).style.boxShadow="0 2px 10px rgba(0,0,0,.06)";}}>
                    {/* Card header */}
                    <div style={{background:isOv?"#dc2626":PRIMARY,padding:"12px 14px",display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
                      <div>
                        <div style={{fontSize:"0.82rem",fontWeight:800,color:"#fff",fontFamily:"monospace"}}>{inv.id}</div>
                        <div style={{fontSize:"0.62rem",color:"rgba(255,255,255,.65)",marginTop:2}}>{inv.contractRef} · {fmtDate(inv.issueDate)}</div>
                      </div>
                      <span className="badge" style={{background:sc.bg,color:sc.text}}>{invoiceStatusLabel[inv.status]}</span>
                    </div>
                    {/* Body */}
                    <div style={{padding:"12px 14px"}}>
                      <button onClick={e=>{e.stopPropagation();const cu=customers.find(c=>c.company===inv.client);if(cu)router.push(`/customers/${cu.id}`);}}
                        style={{background:"none",border:"none",cursor:"pointer",color:PRIMARY,fontSize:"0.88rem",fontWeight:800,padding:0,textAlign:"left",display:"block",marginBottom:3}}>
                        {inv.client}
                      </button>
                      <div style={{fontSize:"0.7rem",color:MUTED,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{inv.project}</div>
                      <div style={{fontSize:"0.67rem",color:PRIMARY,fontWeight:600,marginTop:2}}>{inv.milestone}</div>
                    </div>
                    {/* Amount grid */}
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:0,margin:"0 14px",borderRadius:10,overflow:"hidden",border:`1px solid ${BORDER}`}}>
                      {[{l:"ก่อน VAT",v:fmt(inv.subtotal),c:MUTED},{l:"VAT 7%",v:fmt(inv.vatAmount),c:MUTED},{l:"รวม",v:fmt(inv.total),c:isOv?"#dc2626":PRIMARY}].map((r,i)=>(
                        <div key={i} style={{padding:"8px 6px",textAlign:"center",borderRight:i<2?`1px solid ${BORDER}`:"none",background:"#f8f9fb"}}>
                          <div style={{fontSize:"0.58rem",color:MUTED,fontWeight:600,marginBottom:2}}>{r.l}</div>
                          <div style={{fontSize:"0.72rem",fontWeight:800,color:r.c}}>{r.v}</div>
                        </div>
                      ))}
                    </div>
                    {/* Footer */}
                    <div style={{padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",borderTop:`1px solid ${BORDER}`,marginTop:10}}>
                      <div>
                        <div style={{fontSize:"0.6rem",color:MUTED,fontWeight:600}}>ครบกำหนด</div>
                        <div style={{fontSize:"0.75rem",fontWeight:700,color:isOv?"#dc2626":STEEL,marginTop:1}}>{fmtDate(inv.dueDate)}</div>
                      </div>
                      <div style={{display:"flex",gap:4}} onClick={e=>e.stopPropagation()}>
                        {STATUS_ACTIONS[inv.status].length>0&&(
                          <button onClick={()=>changeStatus(inv.id,STATUS_ACTIONS[inv.status][0].next)}
                            style={{padding:"4px 8px",borderRadius:7,border:"none",background:STATUS_ACTIONS[inv.status][0].bg,color:STATUS_ACTIONS[inv.status][0].color,fontSize:"0.62rem",fontWeight:700,cursor:"pointer"}}>
                            {STATUS_ACTIONS[inv.status][0].label.split(" ")[0]}
                          </button>
                        )}
                        <button onClick={()=>openEdit(inv)} style={{padding:"4px 9px",borderRadius:7,border:`1px solid ${BORDER}`,background:"#fff",color:PRIMARY,fontSize:"0.65rem",fontWeight:600,cursor:"pointer"}}>แก้ไข</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{padding:"10px 16px",borderTop:`1px solid ${BORDER}`,marginTop:16}}>
              <span style={{fontSize:"0.72rem",color:MUTED}}>แสดง {filtered.length} จาก {data.length} รายการ</span>
            </div>
          </div>
        )}
      </div>

      {/* ══ DETAIL PANEL ════════════════════════════════════ */}
      {selected&&(
        <div style={{width:340,flexShrink:0,position:"sticky",top:80,maxHeight:"calc(100vh - 100px)",overflowY:"auto"}}>
          <div className="card" style={{overflow:"hidden"}}>

            {/* Panel header */}
            <div style={{background:selected.status==="overdue"?"#dc2626":PRIMARY,padding:"16px 16px 12px"}}>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:10}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:"0.64rem",fontWeight:700,color:"rgba(255,255,255,.55)",fontFamily:"monospace",letterSpacing:"0.05em"}}>{selected.id}</div>
                  <div style={{fontSize:"0.9rem",fontWeight:800,color:"#fff",lineHeight:1.25,marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{selected.client}</div>
                  <div style={{fontSize:"0.68rem",color:"rgba(255,255,255,.65)",marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{selected.milestone}</div>
                </div>
                <button onClick={()=>setSelected(null)} style={{background:"rgba(255,255,255,.15)",border:"none",borderRadius:8,width:28,height:28,cursor:"pointer",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginLeft:8}}>
                  <X size={14}/>
                </button>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span className="badge" style={{background:invoiceStatusColor[selected.status].bg,color:invoiceStatusColor[selected.status].text}}>
                  {invoiceStatusLabel[selected.status]}
                </span>
                <span style={{fontSize:"0.95rem",fontWeight:800,color:"rgba(255,255,255,.9)"}}>{fmt(selected.total)}</span>
              </div>
            </div>

            {/* Tabs */}
            <div className="tab-bar">
              {dtabs.map(([key,label,cnt])=>(
                <button key={key} onClick={()=>setDetailTab(key as typeof detailTab)}
                  className={`tab-item${detailTab===key?" active":""}`}>
                  {label}{cnt!==undefined&&cnt>0?<span style={{padding:"1px 5px",borderRadius:99,background:"#dce5f0",color:PRIMARY,fontSize:"0.58rem",fontWeight:800,marginLeft:3}}>{cnt}</span>:null}
                </button>
              ))}
            </div>

            {/* Tab: ข้อมูล */}
            {detailTab==="info"&&(
              <div style={{padding:"14px 16px"}}>
                {/* Amount breakdown */}
                <div style={{borderRadius:12,overflow:"hidden",border:`1px solid ${BORDER}`,marginBottom:14}}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr"}}>
                    {[{l:"ก่อน VAT",v:fmt(selected.subtotal),c:STEEL},{l:"VAT 7%",v:fmt(selected.vatAmount),c:MUTED},{l:"ยอดรวม",v:fmt(selected.total),c:PRIMARY}].map((r,i)=>(
                      <div key={i} style={{padding:"10px 8px",textAlign:"center",background:"#f8f9fb",borderRight:i<2?`1px solid ${BORDER}`:"none"}}>
                        <div style={{fontSize:"0.58rem",color:MUTED,fontWeight:700,marginBottom:3}}>{r.l}</div>
                        <div style={{fontSize:i===2?"0.92rem":"0.78rem",fontWeight:800,color:r.c}}>{r.v}</div>
                      </div>
                    ))}
                  </div>
                  {relPayments.filter(p=>p.status==="confirmed").length>0&&(
                    <div style={{padding:"8px 12px",background:"#e5faf0",borderTop:`1px solid ${BORDER}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                      <div style={{display:"flex",alignItems:"center",gap:5}}>
                        <CheckCircle2 size={12} color="#059669"/>
                        <span style={{fontSize:"0.68rem",color:"#059669",fontWeight:700}}>ชำระแล้ว {fmt(totalPaid)}</span>
                      </div>
                      {selected.total-totalPaid>0&&<span style={{fontSize:"0.68rem",color:"#dc2626",fontWeight:700}}>ค้าง {fmt(selected.total-totalPaid)}</span>}
                    </div>
                  )}
                </div>

                {/* Details */}
                <div style={{fontSize:"0.63rem",fontWeight:700,color:MUTED,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>รายละเอียด</div>
                {[
                  {label:"โอกาสการขาย",        val:selected.project},
                  {label:"สัญญา",      val:selected.contractRef||"—"},
                  {label:"วันที่ออก",  val:fmtDate(selected.issueDate)},
                  {label:"ครบกำหนด",  val:fmtDate(selected.dueDate)||"—"},
                  {label:"หมายเหตุ",   val:selected.note||"—"},
                ].map((r,i,arr)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:i<arr.length-1?"1px solid #f0f4f8":"none",flexWrap:"wrap",gap:4}}>
                    <span style={{fontSize:"0.72rem",color:MUTED,fontWeight:600}}>{r.label}</span>
                    <span style={{fontSize:"0.75rem",color:STEEL,fontWeight:700,maxWidth:180,textAlign:"right"}}>{r.val}</span>
                  </div>
                ))}

                {/* Status workflow */}
                {STATUS_ACTIONS[selected.status].length>0&&(
                  <div style={{marginTop:14}}>
                    <div style={{fontSize:"0.63rem",fontWeight:700,color:MUTED,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>เปลี่ยนสถานะ</div>
                    <div style={{display:"flex",flexDirection:"column",gap:6}}>
                      {STATUS_ACTIONS[selected.status].map(action=>(
                        <button key={action.next} onClick={()=>changeStatus(selected.id,action.next)}
                          style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 12px",borderRadius:10,background:action.bg,border:"none",cursor:"pointer",width:"100%"}}>
                          <span style={{fontSize:"0.76rem",fontWeight:700,color:action.color}}>{action.label}</span>
                          <ArrowRight size={13} color={action.color}/>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab: การชำระเงิน */}
            {detailTab==="payments"&&(
              <div style={{padding:"12px 14px"}}>
                {relPayments.length===0?(
                  <div style={{textAlign:"center",padding:"28px 0",color:MUTED,fontSize:"0.78rem"}}>ยังไม่มีการชำระเงิน</div>
                ):(
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {relPayments.map(pay=>{
                      const mc=paymentMethodColor[pay.method]; const sc=paymentStatusColor[pay.status];
                      return (
                        <div key={pay.id} style={{padding:"11px 12px",borderRadius:11,background:"#f8f9fb",border:`1px solid ${BORDER}`}}>
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                            <div style={{fontSize:"0.7rem",fontWeight:700,color:PRIMARY,fontFamily:"monospace"}}>{pay.id}</div>
                            <span className="badge" style={{background:sc.bg,color:sc.text}}>{paymentStatusLabel[pay.status]}</span>
                          </div>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                            <span style={{fontSize:"1rem",fontWeight:800,color:STEEL}}>{fmt(pay.amount)}</span>
                            <span style={{padding:"2px 7px",borderRadius:6,fontSize:"0.62rem",fontWeight:700,background:mc.bg,color:mc.text,whiteSpace:"nowrap"}}>{paymentMethodLabel[pay.method]}</span>
                          </div>
                          <div style={{fontSize:"0.65rem",color:MUTED}}>วันที่: {pay.paidDate} · เซลล์: {pay.salesPerson}</div>
                          {pay.note&&<div style={{fontSize:"0.65rem",color:MUTED,marginTop:2}}>{pay.note}</div>}
                        </div>
                      );
                    })}
                  </div>
                )}
                <div style={{marginTop:12,padding:"8px 12px",borderRadius:10,background:"#dce5f0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:"0.72rem",color:MUTED,fontWeight:600}}>รวมชำระแล้ว</span>
                  <span style={{fontSize:"0.9rem",fontWeight:800,color:PRIMARY}}>{fmt(totalPaid)}</span>
                </div>
              </div>
            )}

            {/* Tab: สัญญา */}
            {detailTab==="contract"&&(
              <div style={{padding:"14px 16px"}}>
                {relContract?(
                  <>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
                      <div style={{width:36,height:36,borderRadius:10,background:"#dce5f0",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><FileSignature size={15} color={PRIMARY}/></div>
                      <div>
                        <div style={{fontSize:"0.78rem",fontWeight:800,color:PRIMARY,fontFamily:"monospace"}}>{relContract.id}</div>
                        <div style={{marginTop:3}}>
                          <span className="badge" style={{background:contractStatusColor[relContract.status].bg,color:contractStatusColor[relContract.status].text}}>
                            {contractStatusLabel[relContract.status]}
                          </span>
                        </div>
                      </div>
                    </div>
                    {[{label:"ลูกค้า",val:relContract.client},{label:"โอกาสการขาย",val:relContract.project},{label:"มูลค่าสัญญา",val:fmt(relContract.value)},{label:"มัดจำ",val:fmt(relContract.deposit)},{label:"คงค้าง",val:fmt(relContract.remaining)},{label:"เซลล์",val:relContract.agentName}].map((r,i)=>(
                      <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:i<5?"1px solid #f0f4f8":"none"}}>
                        <span style={{fontSize:"0.7rem",color:MUTED,fontWeight:600}}>{r.label}</span>
                        <span style={{fontSize:"0.75rem",color:STEEL,fontWeight:700,maxWidth:160,textAlign:"right",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.val}</span>
                      </div>
                    ))}
                    <button onClick={()=>router.push("/quotations")} className="btn btn-primary btn-md"
                      style={{width:"100%",justifyContent:"center",marginTop:14}}>
                      <ExternalLink size={13}/> ดูสัญญา
                    </button>
                  </>
                ):(
                  <div style={{textAlign:"center",padding:"28px 0",color:MUTED,fontSize:"0.78rem"}}>
                    {selected.contractRef?`ไม่พบสัญญา ${selected.contractRef}`:"ไม่มีสัญญาอ้างอิง"}
                  </div>
                )}
              </div>
            )}

            {/* Tab: ลูกค้า */}
            {detailTab==="customer"&&(
              <div style={{padding:"14px 16px"}}>
                {relCustomer?(
                  <>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
                      <div style={{width:44,height:44,borderRadius:13,background:relCustomer.color,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:"1rem",flexShrink:0}}>
                        {relCustomer.initials}
                      </div>
                      <div>
                        <div style={{fontSize:"0.88rem",fontWeight:800,color:STEEL}}>{relCustomer.company}</div>
                        <div style={{fontSize:"0.7rem",color:MUTED,marginTop:2}}>{relCustomer.name}</div>
                      </div>
                    </div>
                    {[{label:"โทรศัพท์",val:relCustomer.phone},{label:"อีเมล",val:relCustomer.email},{label:"จังหวัด",val:relCustomer.province},{label:"หมวด",val:relCustomer.category}].map((r,i)=>(
                      <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:i<3?"1px solid #f0f4f8":"none"}}>
                        <span style={{fontSize:"0.7rem",color:MUTED,fontWeight:600}}>{r.label}</span>
                        <span style={{fontSize:"0.75rem",color:STEEL,fontWeight:700,maxWidth:160,textAlign:"right",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.val}</span>
                      </div>
                    ))}
                    <button onClick={()=>router.push(`/customers/${relCustomer.id}`)} className="btn btn-primary btn-md"
                      style={{width:"100%",justifyContent:"center",marginTop:14}}>
                      <ExternalLink size={13}/> ดูข้อมูลลูกค้า
                    </button>
                  </>
                ):(
                  <div style={{textAlign:"center",padding:"28px 0",color:MUTED,fontSize:"0.78rem"}}>ไม่พบข้อมูลลูกค้า</div>
                )}
              </div>
            )}

            {/* Tab: โอกาสการขาย */}
            {detailTab==="project"&&(
              <div style={{padding:"14px 16px"}}>
                {relProject?(
                  <>
                    <div style={{fontSize:"0.9rem",fontWeight:800,color:STEEL,marginBottom:4}}>{relProject.title}</div>
                    <div style={{fontSize:"0.72rem",color:MUTED,marginBottom:14}}>{relProject.client}</div>
                    <div style={{marginBottom:14}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                        <span style={{fontSize:"0.7rem",color:MUTED,fontWeight:600}}>ความคืบหน้าการขาย</span>
                        <span style={{fontSize:"0.7rem",fontWeight:700,color:PRIMARY}}>{relProject.progress}%</span>
                      </div>
                      <div style={{height:6,borderRadius:99,background:"var(--muted)",overflow:"hidden"}}>
                        <div className="top5-bar" style={{height:"100%",width:`${relProject.progress}%`,background:PRIMARY,borderRadius:99}}/>
                      </div>
                    </div>
                    {[{label:"มูลค่า",val:relProject.value},{label:"เริ่ม",val:relProject.start},{label:"ครบ",val:relProject.due},{label:"ทีมงาน",val:relProject.assigned.join(", ")||"—"}].map((r,i)=>(
                      <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:i<3?"1px solid #f0f4f8":"none"}}>
                        <span style={{fontSize:"0.7rem",color:MUTED,fontWeight:600}}>{r.label}</span>
                        <span style={{fontSize:"0.75rem",color:STEEL,fontWeight:700,maxWidth:160,textAlign:"right",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.val}</span>
                      </div>
                    ))}
                  </>
                ):(
                  <div style={{textAlign:"center",padding:"28px 0",color:MUTED,fontSize:"0.78rem"}}>ไม่พบข้อมูลโอกาสการขาย</div>
                )}
              </div>
            )}

            {/* Actions footer */}
            <div style={{padding:"12px 14px",borderTop:`1px solid ${BORDER}`,display:"flex",flexDirection:"column",gap:6}}>
              <div style={{display:"flex",gap:6}}>
                <button onClick={()=>openEdit(selected)} className="btn btn-primary btn-sm" style={{flex:1,justifyContent:"center"}}>
                  <Edit2 size={13}/> แก้ไข
                </button>
                <button onClick={()=>router.push("/quotations")} disabled={!relContract} className="btn btn-tint btn-sm"
                  style={{flex:1,justifyContent:"center",cursor:relContract?"pointer":"not-allowed",opacity:relContract?1:0.5}}>
                  <Building2 size={13}/> สัญญา
                </button>
              </div>
              {!delConfirm?(
                <button onClick={()=>setDelConfirm(true)} className="btn btn-danger btn-sm" style={{justifyContent:"center"}}>
                  <Trash2 size={12}/> ลบใบแจ้งหนี้
                </button>
              ):(
                <div style={{borderRadius:10,border:"1px solid #fca5a5",overflow:"hidden"}}>
                  <div style={{padding:"7px 12px",background:"#fee2e2",fontSize:"0.7rem",color:"#dc2626",fontWeight:600}}>ยืนยันลบ "{selected.id}"?</div>
                  <div style={{display:"flex"}}>
                    <button onClick={deleteInvoice} style={{flex:1,padding:"7px",background:"#dc2626",border:"none",color:"#fff",fontSize:"0.7rem",fontWeight:700,cursor:"pointer"}}>ลบ</button>
                    <button onClick={()=>setDelConfirm(false)} style={{flex:1,padding:"7px",background:"#fff",border:"none",borderLeft:"1px solid #fca5a5",color:STEEL,fontSize:"0.7rem",cursor:"pointer"}}>ยกเลิก</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal&&(
        <InvoiceModal
          title={editingInv?"แก้ไขใบแจ้งหนี้":"ออกใบแจ้งหนี้ใหม่"}
          initial={editingInv?toForm(editingInv):buildBlank()}
          onSave={saveInvoice} onClose={()=>setShowModal(false)}/>
      )}
    </div>
  );
}
