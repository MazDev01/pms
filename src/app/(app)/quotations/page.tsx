"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  quotationStatusLabel, quotationStatusColor,
  type QuotationStatus, type QuotationMock, type CustomerRow,
} from "@/lib/mock";
import { useSales } from "@/context/SalesContext";
import { useFilters, FilterProvider } from "@/context/FilterContext";
import { FilterBar } from "@/components/filters/FilterBar";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { useTableLayout, type Col } from "@/components/ui/TableTools";
import {
  Plus, Search, X, FileText, LayoutList, LayoutGrid,
  Edit2, Trash2, ChevronUp, ChevronDown, Printer,
  ExternalLink, ArrowRight, ChevronLeft, ChevronRight,
  Send, Copy, GitBranch, Eye,
} from "lucide-react";

// ── Tokens ────────────────────────────────────────────────────
const PRIMARY = "#003366";
const STEEL   = "#2D2D2D";
const BORDER  = "#e5e7eb";
const MUTED   = "#6b7280";
const CARD: React.CSSProperties = { background:"#fff", borderRadius:16, border:`1px solid ${BORDER}`, boxShadow:"0 2px 14px rgba(0,0,0,.07)" };

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
  revision:string; expiry:string;
};

const BUILDING_TYPES = ["โกดังสินค้า","โรงงาน","งานตามแบบ","อาคารพาณิชย์","สนามกีฬาในร่ม","อื่นๆ"];

// ── Dealer identity — ใบเสนอราคาออกในนามบริษัทของดีลเลอร์เอง (ไม่ใช่เบญจมินทร์) ──
type Issuer = { company: string; address: string; phone: string; taxId: string };
const DEFAULT_ISSUER: Issuer = { company: "", address: "", phone: "", taxId: "" };
const ISSUER_KEY = "dealer_issuer_profile";
// ตรา/ลายเซ็น มาจากหน้า ตั้งค่า → ตั้งค่าใบเสนอราคา (คนละคีย์กับโปรไฟล์บริษัท)
type DocProfile = { stamp: string; signature: string };
const DEFAULT_DOC: DocProfile = { stamp: "", signature: "" };
const DOC_KEY = "dealer_document_settings";

// ── Helpers ───────────────────────────────────────────────────
function fmtMoney(v:number){ return "฿"+v.toLocaleString("th-TH"); }
function fmtDate(d:string){ if(!d||d==="—") return "—"; const [y,m,day]=d.split("-"); const mo=["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."]; return `${parseInt(day)} ${mo[parseInt(m)-1]} ${parseInt(y)+543}`; }
function nextQId(data:QuotationMock[]){
  const nums = data.map(q=>parseInt(q.id.split("-")[2]??"")||0);
  return `Q-2026-${String(Math.max(...nums,100)+1).padStart(4,"0")}`;
}
// เลื่อนเวอร์ชันถัดไป V1→V2→V3 (สูงสุด V3)
function nextRevision(rev?:string){
  const n = parseInt((rev??"V1").replace(/[^0-9]/g,""))||1;
  return `V${Math.min(n+1,3)}`;
}
// จำนวนการเปิดอ่านแบบ deterministic (ไม่สุ่ม) — คำนวณจาก id
// ร่าง (draft) = 0 · ส่ง/เปิดอ่านแล้ว = 1–5 ตามเลขที่เอกสาร · อื่นๆ = 0
function computeOpenCount(q:QuotationMock):number{
  if(q.status==="draft") return 0;
  if(q.status!=="sent_to_client" && q.status!=="viewed") return 0;
  const num = parseInt(q.id.split("-")[2]??"")||0;
  return (num % 5) + 1; // 1–5, deterministic
}
function exportCSV(rows:QuotationMock[]){
  const header=["เลขที่","ลูกค้า","โอกาสการขาย","จังหวัด","ประเภท","พื้นที่","มูลค่ารวม","สถานะ","วันที่"];
  const lines=rows.map(q=>[q.id,q.customer,q.project,q.province,q.buildingType,q.area,q.totalValue,quotationStatusLabel[q.status],q.date].join(","));
  const blob=new Blob(["﻿"+[header.join(","),...lines].join("\n")],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download="quotations.csv"; a.click(); URL.revokeObjectURL(url);
}

// ── พิมพ์ใบเสนอราคา (ออกในนามบริษัทของดีลเลอร์เอง) ────────────────────────────
function esc(s:unknown){ return String(s??"").replace(/[&<>"]/g,c=>(({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"} as Record<string,string>)[c])); }
type PrintCustomer = { company?:string; name?:string; phone?:string; province?:string; email?:string };
function buildQuotationHTML(q:QuotationMock, issuer:Issuer, cust?:PrintCustomer, doc:DocProfile=DEFAULT_DOC){
  const n=(v:number)=>Number(v||0).toLocaleString("th-TH");
  const subtotal=q.totalValue;
  const vat=Math.round(subtotal*0.07);
  const grand=subtotal+vat;
  const issuerMeta=[issuer.address, issuer.phone?("โทร. "+issuer.phone):"", issuer.taxId?("เลขผู้เสียภาษี "+issuer.taxId):""].filter(Boolean).join("\n");
  return `<!DOCTYPE html><html lang="th"><head><meta charset="utf-8"/>
<title>ใบเสนอราคา ${esc(q.id)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Sarabun','Tahoma',sans-serif;color:#2D2D2D;font-size:13px;line-height:1.5;background:#f3f4f6}
.sheet{width:210mm;min-height:297mm;margin:12px auto;padding:16mm 14mm;background:#fff;box-shadow:0 4px 24px rgba(0,0,0,.12)}
.top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #003366;padding-bottom:14px}
.issuer-name{font-size:20px;font-weight:800;color:#003366}
.issuer-meta{font-size:11px;color:#555;margin-top:4px;white-space:pre-line}
.doc-title{text-align:right}
.doc-title h1{font-size:22px;color:#003366;letter-spacing:1px}
.doc-title .sub{font-size:11px;color:#888;letter-spacing:2px}
.doc-meta{margin-top:8px;font-size:12px;line-height:1.7}
.doc-meta b{color:#003366}
.parties{display:flex;gap:16px;margin-top:18px}
.party{flex:1;border:1px solid #e5e7eb;border-radius:8px;padding:12px 14px}
.party .lbl{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#888;font-weight:700;margin-bottom:5px}
.party .co{font-size:14px;font-weight:800;color:#003366}
.party .row{font-size:11px;color:#555;margin-top:2px}
table.items{width:100%;border-collapse:collapse;margin-top:18px}
table.items th{background:#003366;color:#fff;font-size:11px;font-weight:700;padding:9px 10px;text-align:left}
table.items th.r,table.items td.r{text-align:right}
table.items td{padding:10px;border-bottom:1px solid #eee;font-size:12px;vertical-align:top}
.sum{margin-top:12px;margin-left:auto;width:290px}
.sum .line{display:flex;justify-content:space-between;padding:5px 2px;font-size:12px}
.sum .grand{border-top:2px solid #003366;margin-top:4px;padding-top:8px;font-size:15px;font-weight:800;color:#003366}
.terms{margin-top:22px;font-size:11px;color:#555}
.terms .h{font-weight:700;color:#003366;margin-bottom:4px}
.signs{display:flex;gap:40px;margin-top:46px}
.sign{flex:1;text-align:center}
.sign{position:relative}
.sign .line{border-top:1px dotted #999;margin-top:44px;padding-top:6px;font-size:11px;color:#555;line-height:1.5}
.sign .sig{display:block;max-height:48px;max-width:150px;object-fit:contain;margin:0 auto 2px}
.sign .stamp{position:absolute;right:8px;bottom:18px;max-height:72px;max-width:72px;object-fit:contain;opacity:.9}
.bar{margin-top:6px;font-size:10px;color:#9ca3af;text-align:center}
@media print{@page{size:A4;margin:0}body{background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}.sheet{margin:0;box-shadow:none}}
</style></head><body>
<div class="sheet">
  <div class="top">
    <div>
      <div class="issuer-name">${esc(issuer.company)}</div>
      <div class="issuer-meta">${esc(issuerMeta)}</div>
    </div>
    <div class="doc-title">
      <h1>ใบเสนอราคา</h1>
      <div class="sub">QUOTATION</div>
      <div class="doc-meta">เลขที่ <b>${esc(q.id)}</b><br/>วันที่ ${esc(fmtDate(q.date))}<br/>ยืนราคา 30 วัน</div>
    </div>
  </div>
  <div class="parties">
    <div class="party">
      <div class="lbl">เสนอแก่ / ลูกค้า</div>
      <div class="co">${esc(cust?.company||q.customer)}</div>
      ${cust?.name?`<div class="row">ผู้ติดต่อ: ${esc(cust.name)}</div>`:""}
      ${cust?.phone?`<div class="row">โทร. ${esc(cust.phone)}</div>`:""}
      <div class="row">จังหวัด: ${esc(q.province||cust?.province||"-")}</div>
    </div>
    <div class="party">
      <div class="lbl">รายละเอียดงาน</div>
      <div class="co" style="font-size:13px">${esc(q.project)}</div>
      <div class="row">ประเภทอาคาร: ${esc(q.buildingType)}</div>
      <div class="row">พื้นที่: ${n(q.area)} ตร.ม.</div>
      <div class="row">จำนวนรายการ: ${esc(q.items)} รายการ</div>
    </div>
  </div>
  <table class="items">
    <thead><tr><th style="width:44px">ลำดับ</th><th>รายการ</th><th class="r" style="width:90px">พื้นที่</th><th class="r" style="width:140px">จำนวนเงิน (บาท)</th></tr></thead>
    <tbody>
      <tr>
        <td>1</td>
        <td><b>${esc(q.project)}</b><br/><span style="color:#888;font-size:11px">${esc(q.buildingType)} · อาคารสำเร็จรูป</span></td>
        <td class="r">${n(q.area)} ม²</td>
        <td class="r">${n(subtotal)}</td>
      </tr>
    </tbody>
  </table>
  <div class="sum">
    <div class="line"><span>มูลค่างาน</span><span>${n(subtotal)}</span></div>
    <div class="line"><span>ภาษีมูลค่าเพิ่ม 7%</span><span>${n(vat)}</span></div>
    <div class="line grand"><span>รวมสุทธิ</span><span>฿${n(grand)}</span></div>
  </div>
  <div class="terms">
    <div class="h">เงื่อนไข</div>
    • ราคานี้ยืนยัน 30 วันนับจากวันที่ในเอกสาร<br/>
    • ราคารวมภาษีมูลค่าเพิ่ม 7% แล้ว<br/>
    • เงื่อนไขการชำระเงินเป็นไปตามข้อตกลงระหว่างคู่สัญญา
  </div>
  <div class="signs">
    <div class="sign">
      ${doc.signature?`<img class="sig" src="${esc(doc.signature)}" alt="ลายเซ็น"/>`:""}
      ${doc.stamp?`<img class="stamp" src="${esc(doc.stamp)}" alt="ตราประทับ"/>`:""}
      <div class="line">ผู้เสนอราคา<br/>( ${esc(issuer.company)} )</div>
    </div>
    <div class="sign"><div class="line">ผู้อนุมัติสั่งซื้อ<br/>( ${esc(cust?.company||q.customer)} )</div></div>
  </div>
  <div class="bar">เอกสารนี้ออกในนามบริษัทของผู้เสนอราคา</div>
</div>
<script>window.onload=function(){setTimeout(function(){window.print();},350);}</script>
</body></html>`;
}

// ── Add / Edit Modal ──────────────────────────────────────────
const TODAY = "2026-06-23";
function buildBlank(customers:CustomerRow[]): QForm {
  const c=customers[0];
  return { customerId:c?.id??0, customer:c?.company??"", project:"", projectId:0, province:c?.province??"", buildingType:"โกดังสินค้า", area:0, materialCost:0, status:"draft", date:TODAY, items:0, revision:"V1", expiry:"" };
}

function QuotationModal({ initial, title, onSave, onClose, customers }:{
  initial:QForm; title:string; onSave:(f:QForm)=>void; onClose:()=>void; customers:CustomerRow[];
}){
  const [form,setForm]=useState<QForm>(initial);
  const INP:React.CSSProperties={width:"100%",border:`1px solid ${BORDER}`,borderRadius:9,padding:"8px 12px",fontSize:"0.82rem",outline:"none",color:STEEL,boxSizing:"border-box"};
  const LBL:React.CSSProperties={fontSize:"0.68rem",fontWeight:700,color:MUTED,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:"0.04em"};
  function set<K extends keyof QForm>(k:K,v:QForm[K]){setForm(p=>({...p,[k]:v}));}
  const total=form.materialCost;
  function pickCustomer(id:number){
    const c=customers.find(c=>c.id===id);
    if(!c) return;
    setForm(p=>({...p,customerId:c.id,customer:c.company,province:p.province||c.province}));
  }
  function submit(){if(!form.customer||!form.project)return; onSave(form); onClose();}
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
              <label style={LBL}>ชื่อโอกาสการขาย *</label>
              <input value={form.project} onChange={e=>set("project",e.target.value)} placeholder="เช่น โกดังสินค้า ABC" style={INP}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div>
                <label style={LBL}>จังหวัด</label>
                <input value={form.province} onChange={e=>set("province",e.target.value)} placeholder="จังหวัด" style={INP}/>
              </div>
              <div>
                <label style={LBL}>ประเภทอาคาร</label>
                <select value={form.buildingType} onChange={e=>set("buildingType",e.target.value)} style={INP}>
                  {BUILDING_TYPES.map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={LBL}>พื้นที่ (ตร.ม.)</label>
                <input type="number" value={form.area||""} onChange={e=>set("area",Number(e.target.value))} placeholder="0" style={INP}/>
              </div>
              <div>
                <label style={LBL}>จำนวนรายการ</label>
                <input type="number" value={form.items||""} onChange={e=>set("items",Number(e.target.value))} placeholder="0" style={INP}/>
              </div>
              <div>
                <label style={LBL}>มูลค่า (บาท)</label>
                <input type="number" value={form.materialCost||""} onChange={e=>set("materialCost",Number(e.target.value))} placeholder="0" style={INP}/>
              </div>
            </div>
            {/* Total preview */}
            {total>0&&<div style={{padding:"10px 14px",background:"#dce5f0",borderRadius:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:"0.72rem",fontWeight:700,color:MUTED}}>มูลค่ารวม (คำนวณ)</span>
              <span style={{fontSize:"1.05rem",fontWeight:800,color:PRIMARY}}>{fmtMoney(total)}</span>
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
              <div>
                <label style={LBL}>เวอร์ชัน</label>
                <select value={form.revision} onChange={e=>set("revision",e.target.value)} style={INP}>
                  {["V1","V2","V3"].map(v=><option key={v} value={v}>{v}</option>)}
                </select>
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
  // openCount แบบ local ต่อใบเสนอราคา (ไม่แก้ mock) — เก็บค่าที่คำนวณไว้ / override สำหรับใบที่สร้างใหม่
  const [openCounts, setOpenCounts] = useState<Record<string,number>>({});
  // Table toolbar layout — ความหนาแน่นแถว + ซ่อน/แสดงคอลัมน์ (persist ใน localStorage)
  const { density, setDensity, hiddenCols, toggleCol } = useTableLayout("quotations");

  // แสดง toast ชั่วคราวแล้วซ่อนอัตโนมัติ
  function showToast(msg:string){ setToast(msg); }
  useEffect(()=>{ if(!toast) return; const t=setTimeout(()=>setToast(null),2600); return ()=>clearTimeout(t); },[toast]);

  // จำนวนการเปิดอ่านของใบเสนอราคา — ใช้ override ถ้ามี ไม่งั้นคำนวณ deterministic จาก id/สถานะ
  function openCountOf(q:QuotationMock):number{
    return openCounts[q.id] ?? computeOpenCount(q);
  }

  // ผู้ออกใบเสนอราคา = โปรไฟล์บริษัทของสาขา (แก้ที่หน้า "โปรไฟล์บริษัท") — อ่านจาก localStorage คีย์เดียวกัน
  useEffect(() => {
    const s = localStorage.getItem(ISSUER_KEY);
    if (s) { try { setIssuer({ ...DEFAULT_ISSUER, ...JSON.parse(s) }); } catch {} }
    const d = localStorage.getItem(DOC_KEY);
    if (d) { try { const p = JSON.parse(d); setDocProfile({ stamp: p.stamp ?? "", signature: p.signature ?? "" }); } catch {} }
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
  const totalWon     = scoped.filter(q=>q.status==="won").reduce((s,q)=>s+q.totalValue,0);
  const totalPending = scoped.filter(q=>q.status==="sent_to_client").reduce((s,q)=>s+q.totalValue,0);
  const totalDraft   = scoped.filter(q=>q.status==="draft").reduce((s,q)=>s+q.totalValue,0);

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
  // ทำสำเนา — คัดลอกทุกฟิลด์ ได้ id ใหม่ · สถานะ "ร่าง" · เวอร์ชัน V1
  function duplicateQ(q:QuotationMock){
    const newId=nextQId(data);
    const copy:QuotationMock={...q,id:newId,status:"draft",revision:"V1",date:TODAY};
    addQuotation(copy);
    setOpenCounts(p=>({...p,[newId]:0}));
    setSelected(copy);
    setDetailTab("info"); setDelConfirm(false);
    showToast(`ทำสำเนาเป็น ${newId} (ร่าง) แล้ว`);
  }
  // สร้างเวอร์ชันใหม่ — คัดลอกใบปัจจุบัน เลื่อนเวอร์ชัน (สูงสุด V3) · สถานะ "ร่าง" · id ใหม่
  function createRevision(q:QuotationMock){
    const newId=nextQId(data);
    const rev=nextRevision(q.revision);
    const copy:QuotationMock={...q,id:newId,status:"draft",revision:rev,date:TODAY};
    addQuotation(copy);
    setOpenCounts(p=>({...p,[newId]:0}));
    setSelected(copy);
    setDetailTab("info"); setDelConfirm(false);
    showToast(`สร้างเวอร์ชัน ${rev} เป็น ${newId} แล้ว`);
  }
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
    w.document.write(buildQuotationHTML(q,issuer,cust,docProfile));
    w.document.close();
  }

  const detailTabs:[string,string][]=[["info","ข้อมูล"],["customer","ลูกค้า"],["lead","ผู้สนใจ"]];

  // form initial for edit
  function toForm(q:QuotationMock):QForm{
    return {customerId:q.customerId,customer:q.customer,project:q.project,projectId:q.projectId??0,province:q.province,buildingType:q.buildingType,area:q.area,materialCost:q.materialCost,status:q.status,date:q.date,items:q.items,revision:q.revision??"V1",expiry:q.expiry??""};
  }

  return (
    <div className="erp" style={{display:"flex",gap:16,alignItems:"flex-start"}}>

      {/* ══ MAIN ════════════════════════════════════════════ */}
      <div style={{flex:1,minWidth:0}}>

        {/* Header */}
        <div className="page-head" style={{flexWrap:"wrap"}}>
          <div>
            <h2>ใบเสนอราคา</h2>
            <p>จัดการใบเสนอราคาและติดตามสถานะ · {timeRange.subtitle}</p>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",justifyContent:"flex-end"}}>
            <FilterBar dims={[]} />
            <ExportMenu filename="quotations" title="ใบเสนอราคา" small
              headers={["เลขที่","ลูกค้า","โอกาสการขาย","จังหวัด","ประเภท","พื้นที่","มูลค่ารวม","สถานะ","วันที่"]}
              rows={filtered.map(q=>[q.id,q.customer,q.project,q.province,q.buildingType,q.area,q.totalValue,quotationStatusLabel[q.status],q.date])} />
            <button onClick={openAdd} className="btn btn-primary btn-sm">
              <Plus size={13}/> เพิ่มใบเสนอราคา
            </button>
          </div>
        </div>

        {/* Stat cards */}
        <div className="stat-grid">
          {[
            {label:"ทั้งหมด",    value:scoped.length,                color:"#003366",  key:"ALL"},
            {label:"ปิดการขาย",  value:`฿${(totalWon/1e6).toFixed(1)}M`,    color:"#059669",  key:"won"},
            {label:"ส่งให้ลูกค้า",value:`฿${(totalPending/1e6).toFixed(1)}M`, color:"#f59e0b",  key:"sent_to_client"},
            {label:"ร่าง",value:`฿${(totalDraft/1e6).toFixed(1)}M`,color:"#6b7280", key:"draft"},
          ].map((s,i)=>(
            <div key={i} onClick={()=>setFilterStatus(s.key as "ALL"|QuotationStatus)} className="stat-card clickable">
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={{fontSize:typeof s.value==="number"?"1.6rem":"1.2rem",color:s.color}}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Status filter pills */}
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
          <button onClick={()=>setFilterStatus("ALL")} className="badge"
            style={{cursor:"pointer",border:`1px solid ${filterStatus==="ALL"?PRIMARY:BORDER}`,background:filterStatus==="ALL"?"#dce5f0":"#fff",color:filterStatus==="ALL"?PRIMARY:MUTED}}>
            ทั้งหมด ({data.length})
          </button>
          {STATUS_ORDER.map(s=>{
            const c=quotationStatusColor[s]; const cnt=data.filter(q=>q.status===s).length; const active=filterStatus===s;
            return cnt>0?(
              <button key={s} onClick={()=>setFilterStatus(s)} className="badge"
                style={{cursor:"pointer",border:`1px solid ${active?c.text+"60":BORDER}`,background:active?c.bg:"#fff",color:active?c.text:MUTED}}>
                {quotationStatusLabel[s]} ({cnt})
              </button>
            ):null;
          })}
        </div>

        {/* Toolbar */}
        <div className="card" style={{borderRadius:"var(--radius-xl) var(--radius-xl) 0 0",padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,background:"#fafafa",border:`1px solid ${BORDER}`,borderRadius:10,padding:"7px 12px",minWidth:280}}>
            <Search size={13} color={MUTED}/>
            <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="ค้นหาเลขที่ / ลูกค้า / โอกาสการขาย..."
              style={{border:"none",outline:"none",fontSize:"0.78rem",color:STEEL,background:"transparent",flex:1}}/>
            {query&&<button onClick={()=>setQuery("")} style={{background:"none",border:"none",cursor:"pointer",padding:0,color:MUTED,display:"flex"}}><X size={12}/></button>}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{display:"flex",alignItems:"center",background:"#f0f4f8",borderRadius:99,padding:3,border:`1px solid ${BORDER}`}}>
              {(["list","card"] as const).map(v=>(
                <button key={v} onClick={()=>setView(v)}
                  style={{display:"flex",alignItems:"center",gap:5,padding:"5px 12px",borderRadius:99,border:"none",background:view===v?PRIMARY:"transparent",color:view===v?"#fff":MUTED,fontSize:"0.71rem",fontWeight:700,cursor:"pointer",transition:"all .15s"}}>
                  {v==="list"?<LayoutList size={12}/>:<LayoutGrid size={12}/>}
                  {v==="list"?"รายการ":"การ์ด"}
                </button>
              ))}
            </div>
            <span style={{fontSize:"0.72rem",color:MUTED}}>แสดง {filtered.length}/{data.length}</span>
          </div>
        </div>

        {/* ── LIST VIEW ── */}
        {view==="list"&&(
          <div className="card" style={{borderRadius:"0 0 var(--radius-xl) var(--radius-xl)",borderTop:"none"}}>
            <div className={`table-wrap${density==="compact"?" dense":""}`} style={{borderTop:"none"}}>
              <table>
                <colgroup>
                  <col style={{width:"14%"}} />
                  <col style={{width:"30%"}} />
                  {!hiddenCols.includes("value")&&<col style={{width:"14%"}} />}
                  <col style={{width:"13%"}} />
                  {!hiddenCols.includes("expiry")&&<col style={{width:"13%"}} />}
                  <col style={{width:"16%"}} />
                </colgroup>
                <thead>
                  <tr>
                    {([{label:"เลขที่",key:"id",col:null},{label:"ลูกค้า",key:"customer",col:null},{label:"มูลค่า",key:"totalValue",col:"value"},{label:"สถานะ",key:"status",col:null},{label:"วันหมดอายุ",key:null,col:"expiry"},{label:"",key:null,col:null}] as {label:string;key:SortKey|null;col:string|null}[])
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
                  {filtered.length===0&&<tr><td colSpan={6-["value","expiry"].filter(c=>hiddenCols.includes(c)).length} style={{textAlign:"center",padding:"40px 0",color:MUTED,fontSize:"0.82rem"}}>ไม่พบใบเสนอราคา</td></tr>}
                  {paged.map(q=>{
                    const sc=quotationStatusColor[q.status]; const isSel=selected?.id===q.id;
                    return (
                      <tr key={q.id} onClick={()=>selectRow(q)} className="clickable"
                        style={{background:isSel?"#f0f6ff":undefined}}>
                        <td>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <div style={{width:28,height:28,borderRadius:8,background:"#dce5f0",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><FileText size={12} color={PRIMARY}/></div>
                            <span style={{fontSize:"0.78rem",fontWeight:700,color:STEEL,fontFamily:"monospace"}}>{q.id}</span>
                            <span style={{background:"#eef2f7",color:"#003366",fontSize:"0.6rem",fontWeight:700,padding:"1px 6px",borderRadius:99,flexShrink:0}}>{q.revision??"V1"}</span>
                          </div>
                        </td>
                        <td>
                          <button onClick={e=>{e.stopPropagation();router.push(`/customers/${q.customerId}`);}}
                            style={{background:"none",border:"none",cursor:"pointer",color:PRIMARY,fontSize:"0.82rem",fontWeight:700,padding:0,textAlign:"left"}}>
                            {q.customer}
                          </button>
                        </td>
                        {!hiddenCols.includes("value")&&(
                        <td className="num" style={{fontSize:"0.88rem",fontWeight:800,color:STEEL,whiteSpace:"nowrap"}}>{q.total}</td>
                        )}
                        <td>
                          <span className="badge" style={{background:sc.bg,color:sc.text}}>{quotationStatusLabel[q.status]}</span>
                        </td>
                        {!hiddenCols.includes("expiry")&&(
                        <td style={{fontSize:"0.75rem",color:MUTED,whiteSpace:"nowrap"}}>{q.expiry?fmtDate(q.expiry):"—"}</td>
                        )}
                        <td onClick={e=>e.stopPropagation()}>
                          <div style={{display:"flex",gap:4,flexWrap:"nowrap"}}>
                            {q.status==="draft"&&(
                              <button onClick={()=>changeStatus(q.id,"sent_to_client")} className="btn btn-sm"
                                style={{background:"#d97706",color:"#fff",border:"none",padding:"4px 9px",fontSize:"0.67rem"}}>ส่งลูกค้า</button>
                            )}
                            <button onClick={()=>printQuotation(q)} title="พิมพ์ใบเสนอราคา" className="btn btn-secondary btn-sm"
                              style={{color:PRIMARY,padding:"4px 8px",fontSize:"0.67rem"}}><Printer size={12}/></button>
                            <button onClick={()=>openEdit(q)} className="btn btn-secondary btn-sm"
                              style={{color:PRIMARY,padding:"4px 9px",fontSize:"0.67rem"}}>แก้ไข</button>
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
            {filtered.length===0&&<div style={{textAlign:"center",padding:"40px 0",color:MUTED,fontSize:"0.82rem"}}>ไม่พบใบเสนอราคา</div>}
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
                        <span style={{fontSize:"0.77rem",fontWeight:700,color:STEEL,fontFamily:"monospace"}}>{q.id}</span>
                      </div>
                      <span className="badge" style={{background:sc.bg,color:sc.text}}>{quotationStatusLabel[q.status]}</span>
                    </div>
                    <div style={{padding:"12px 14px"}}>
                      <button onClick={e=>{e.stopPropagation();router.push(`/customers/${q.customerId}`);}}
                        style={{background:"none",border:"none",cursor:"pointer",color:PRIMARY,fontSize:"0.92rem",fontWeight:800,padding:0,textAlign:"left",display:"block",marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"100%"}}>
                        {q.customer}
                      </button>
                      <div style={{fontSize:"0.72rem",color:MUTED,marginBottom:8,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{q.project} · {q.province}</div>
                      <div style={{display:"flex",gap:0,borderRadius:9,overflow:"hidden",border:"1px solid #f0f4f8",marginBottom:10}}>
                        {[{label:"พื้นที่",value:`${q.area?.toLocaleString()} ม²`},{label:"ประเภท",value:q.buildingType}].map((item,i)=>(
                          <div key={i} style={{flex:1,padding:"6px 8px",background:i%2===0?"#fafafa":"#f3f6fb",borderRight:i<1?"1px solid #f0f4f8":"none",textAlign:"center"}}>
                            <div style={{fontSize:"0.58rem",color:"#9ca3af",fontWeight:600,marginBottom:2}}>{item.label}</div>
                            <div style={{fontSize:"0.68rem",color:STEEL,fontWeight:700}}>{item.value}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{fontSize:"1.15rem",fontWeight:800,color:PRIMARY}}>{q.total}</div>
                    </div>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 14px",borderTop:"1px solid #f0f4f8",background:"#fafbfc"}}>
                      <span style={{fontSize:"0.68rem",color:MUTED}}>{fmtDate(q.date)}</span>
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
      {selected&&(
        <>
          <div onClick={()=>setSelected(null)} style={{position:"fixed",inset:0,background:"rgba(45,45,45,.45)",zIndex:200}}/>
          <div style={{position:"fixed",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:760,maxWidth:"calc(100vw - 32px)",height:"min(660px, calc(100vh - 48px))",zIndex:210,background:"#fff",borderRadius:18,boxShadow:"0 24px 80px rgba(0,0,0,.22)",display:"flex",flexDirection:"column",overflow:"hidden"}}>

            {/* Panel header */}
            <div style={{background:PRIMARY,padding:"16px 18px 12px",flexShrink:0}}>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:10}}>
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <div style={{fontSize:"0.64rem",fontWeight:700,color:"rgba(255,255,255,.55)",fontFamily:"monospace",letterSpacing:"0.05em"}}>{selected.id}</div>
                    <span style={{background:"#eef2f7",color:"#003366",fontSize:"0.6rem",fontWeight:700,padding:"1px 6px",borderRadius:99}}>{selected.revision??"V1"}</span>
                  </div>
                  <div style={{fontSize:"0.88rem",fontWeight:800,color:"#fff",lineHeight:1.25,marginTop:2,maxWidth:240,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{selected.customer}</div>
                  <div style={{fontSize:"0.68rem",color:"rgba(255,255,255,.65)",marginTop:2,maxWidth:240,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{selected.project}</div>
                </div>
                <button onClick={()=>setSelected(null)} style={{background:"rgba(255,255,255,.15)",border:"none",borderRadius:8,width:28,height:28,cursor:"pointer",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginLeft:8}}>
                  <X size={14}/>
                </button>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                <span className="badge" style={{background:quotationStatusColor[selected.status].bg,color:quotationStatusColor[selected.status].text}}>
                  {quotationStatusLabel[selected.status]}
                </span>
                <span style={{fontSize:"0.88rem",fontWeight:800,color:"rgba(255,255,255,.9)"}}>{selected.total}</span>
              </div>
              {selected.status==="won"&&(
                <div style={{fontSize:"0.68rem",color:"rgba(255,255,255,.7)",marginTop:6}}>
                  ลูกค้าตอบรับแล้ว — ไปปิดการขาย ที่เส้นทางการขาย/ลีด
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="tab-bar" style={{flexShrink:0}}>
              {detailTabs.map(([key,label])=>(
                <button key={key} onClick={()=>setDetailTab(key as typeof detailTab)}
                  className={`tab-item${detailTab===key?" active":""}`}>
                  {label}
                </button>
              ))}
            </div>

            {/* Body — 760px 2 คอลัมน์ */}
            <div style={{display:"flex",flex:1,overflow:"hidden"}}>
            <div style={{flex:1,overflowY:"auto",borderRight:`1px solid #f0f4f8`}}>

            {/* Tab: ข้อมูล */}
            {detailTab==="info"&&(
              <div style={{padding:"14px 16px"}}>
                {/* Price */}
                <div style={{marginBottom:14}}>
                  <div style={{fontSize:"0.63rem",fontWeight:700,color:MUTED,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>มูลค่า</div>
                  <div style={{padding:"12px 14px",background:"#dce5f0",borderRadius:11,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontSize:"0.7rem",fontWeight:700,color:MUTED}}>มูลค่ารวม</span>
                    <span style={{fontSize:"1.2rem",fontWeight:800,color:PRIMARY}}>{selected.total}</span>
                  </div>
                </div>
                {/* Details */}
                <div style={{fontSize:"0.63rem",fontWeight:700,color:MUTED,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>รายละเอียด</div>
                {[
                  {label:"จังหวัด",val:selected.province},{label:"ประเภทอาคาร",val:selected.buildingType},
                  {label:"พื้นที่",val:`${selected.area?.toLocaleString()} ตร.ม.`},{label:"จำนวนรายการ",val:`${selected.items} รายการ`},
                  {label:"วันที่",val:fmtDate(selected.date)},
                  {label:"วันหมดอายุ",val:selected.expiry?fmtDate(selected.expiry):"—"},
                ].map((r,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:i<5?"1px solid #f0f4f8":"none"}}>
                    <span style={{fontSize:"0.72rem",color:MUTED,fontWeight:600}}>{r.label}</span>
                    <span style={{fontSize:"0.76rem",color:STEEL,fontWeight:700}}>{r.val}</span>
                  </div>
                ))}
                {/* Open count (จำนวนการเปิดอ่าน) */}
                <div style={{marginTop:12,padding:"10px 12px",background:"#f0f6ff",border:`1px solid ${BORDER}`,borderRadius:11,display:"flex",alignItems:"center",gap:9}}>
                  <div style={{width:30,height:30,borderRadius:9,background:"#dce5f0",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    <Eye size={15} color={PRIMARY}/>
                  </div>
                  <div>
                    <div style={{fontSize:"0.6rem",fontWeight:700,color:MUTED,textTransform:"uppercase",letterSpacing:"0.05em"}}>จำนวนการเปิดอ่าน</div>
                    <div style={{fontSize:"0.82rem",fontWeight:800,color:STEEL,marginTop:1}}>ลูกค้าเปิดอ่าน: {openCountOf(selected)} ครั้ง</div>
                  </div>
                </div>
                {/* Status workflow */}
                {STATUS_ACTIONS[selected.status].length>0&&(
                  <div style={{marginTop:14}}>
                    <div style={{fontSize:"0.63rem",fontWeight:700,color:MUTED,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>เปลี่ยนสถานะ</div>
                    <div style={{display:"flex",flexDirection:"column",gap:6}}>
                      {STATUS_ACTIONS[selected.status].map(action=>(
                        <button key={action.next} onClick={()=>changeStatus(selected.id,action.next)} className="btn"
                          style={{justifyContent:"space-between",padding:"9px 12px",background:action.bg,border:"none",width:"100%"}}>
                          <span style={{fontSize:"0.76rem",fontWeight:700,color:action.color}}>{action.label}</span>
                          <ArrowRight size={13} color={action.color}/>
                        </button>
                      ))}
                    </div>
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
                    {[{label:"โทรศัพท์",val:relCustomer.phone},{label:"อีเมล",val:relCustomer.email},{label:"จังหวัด",val:relCustomer.province},{label:"หมวด",val:relCustomer.category},{label:"โอกาสการขาย",val:`${relCustomer.projects} โอกาสการขาย`}].map((r,i)=>(
                      <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:i<4?"1px solid #f0f4f8":"none"}}>
                        <span style={{fontSize:"0.7rem",color:MUTED,fontWeight:600}}>{r.label}</span>
                        <span style={{fontSize:"0.75rem",color:STEEL,fontWeight:700,maxWidth:160,textAlign:"right",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.val}</span>
                      </div>
                    ))}
                    <button onClick={()=>router.push(`/customers/${relCustomer.id}`)} className="btn btn-primary"
                      style={{justifyContent:"center",width:"100%",padding:"9px 0",marginTop:14}}>
                      <ExternalLink size={13}/> ดูข้อมูลลูกค้าเต็ม
                    </button>
                  </>
                ):(
                  <div style={{textAlign:"center",padding:"28px 0",color:MUTED,fontSize:"0.78rem"}}>ไม่พบข้อมูลลูกค้า</div>
                )}
              </div>
            )}

            {/* Tab: ลีด */}
            {detailTab==="lead"&&(
              <div style={{padding:"14px 16px"}}>
                {relLead?(
                  <>
                    <div style={{fontSize:"0.88rem",fontWeight:800,color:STEEL,marginBottom:2}}>{relLead.company}</div>
                    <div style={{fontSize:"0.7rem",color:MUTED,marginBottom:14}}>{relLead.contact} · {relLead.province}</div>
                    {[{label:"โทรศัพท์",val:relLead.phone},{label:"สินค้า",val:relLead.product},{label:"มูลค่า",val:relLead.value},{label:"สถานะ",val:relLead.status},{label:"ผู้รับผิดชอบ",val:relLead.assigned}].map((r,i)=>(
                      <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:i<4?"1px solid #f0f4f8":"none"}}>
                        <span style={{fontSize:"0.7rem",color:MUTED,fontWeight:600}}>{r.label}</span>
                        <span style={{fontSize:"0.75rem",color:STEEL,fontWeight:700}}>{r.val}</span>
                      </div>
                    ))}
                    <button onClick={()=>router.push(`/leads/${relLead.numId}`)} className="btn btn-primary"
                      style={{justifyContent:"center",width:"100%",padding:"9px 0",marginTop:14}}>
                      <ExternalLink size={13}/> ดูผู้สนใจเต็ม
                    </button>
                  </>
                ):(
                  <div style={{textAlign:"center",padding:"28px 0",color:MUTED,fontSize:"0.78rem"}}>ไม่พบผู้สนใจที่เกี่ยวข้อง</div>
                )}
              </div>
            )}

            </div>
            {/* Actions (right rail) */}
            <div style={{width:260,flexShrink:0,overflowY:"auto",padding:"16px",display:"flex",flexDirection:"column",gap:8}}>
              <button onClick={()=>printQuotation(selected)} className="btn"
                style={{justifyContent:"center",padding:"10px 0",background:PRIMARY,color:"#fff",border:"none",fontWeight:700}}>
                <Printer size={14}/> พิมพ์ / ดาวน์โหลด PDF
              </button>
              <div style={{display:"flex",gap:6}}>
                <button onClick={()=>openEdit(selected)} className="btn btn-secondary"
                  style={{flex:1,justifyContent:"center",padding:"9px 0",color:PRIMARY}}>
                  <Edit2 size={13}/> แก้ไข
                </button>
              </div>

              {/* Quotation actions — ส่งอีกครั้ง / ทำสำเนา / สร้างเวอร์ชันใหม่ */}
              <div style={{height:1,background:"#f0f4f8",margin:"2px 0"}}/>
              {(selected.status==="sent_to_client"||selected.status==="viewed")&&(
                <button onClick={()=>sendAgain(selected)} className="btn btn-secondary"
                  style={{justifyContent:"center",padding:"9px 0",color:PRIMARY}}>
                  <Send size={13}/> ส่งอีกครั้ง
                </button>
              )}
              <div style={{display:"flex",gap:6}}>
                <button onClick={()=>duplicateQ(selected)} className="btn btn-secondary"
                  style={{flex:1,justifyContent:"center",padding:"9px 0",color:STEEL}}>
                  <Copy size={13}/> ทำสำเนา
                </button>
                <button onClick={()=>createRevision(selected)} title="สร้างเวอร์ชันใหม่ (V1→V2→V3)" className="btn btn-secondary"
                  style={{flex:1,justifyContent:"center",padding:"9px 0",color:STEEL}}
                  disabled={(parseInt((selected.revision??"V1").replace(/[^0-9]/g,""))||1)>=3}>
                  <GitBranch size={13}/> เวอร์ชันใหม่
                </button>
              </div>
              <div style={{height:1,background:"#f0f4f8",margin:"2px 0"}}/>

              <button onClick={()=>router.push(`/customers/${selected.customerId}`)} className="btn"
                style={{justifyContent:"center",padding:"8px 0",background:"#f0f4f8",color:STEEL,border:`1px solid ${BORDER}`}}>
                <ExternalLink size={13}/> ดูลูกค้า
              </button>
              {!delConfirm?(
                <button onClick={()=>setDelConfirm(true)} className="btn btn-danger"
                  style={{justifyContent:"center",padding:"7px 0"}}>
                  <Trash2 size={12}/> ลบใบเสนอราคา
                </button>
              ):(
                <div style={{borderRadius:10,border:"1px solid #fca5a5",overflow:"hidden"}}>
                  <div style={{padding:"7px 12px",background:"#fee2e2",fontSize:"0.7rem",color:"#dc2626",fontWeight:600}}>ยืนยันลบ "{selected.id}"?</div>
                  <div style={{display:"flex"}}>
                    <button onClick={deleteQ} style={{flex:1,padding:"7px",background:"#dc2626",border:"none",color:"#fff",fontSize:"0.7rem",fontWeight:700,cursor:"pointer"}}>ลบ</button>
                    <button onClick={()=>setDelConfirm(false)} style={{flex:1,padding:"7px",background:"#fff",border:"none",borderLeft:"1px solid #fca5a5",color:STEEL,fontSize:"0.7rem",cursor:"pointer"}}>ยกเลิก</button>
                  </div>
                </div>
              )}
            </div>
          </div>
          </div>
        </>
      )}

      {/* Modal */}
      {showModal&&(
        <QuotationModal
          title={editingQ?"แก้ไขใบเสนอราคา":"เพิ่มใบเสนอราคาใหม่"}
          initial={editingQ?toForm(editingQ):buildBlank(customers)}
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
