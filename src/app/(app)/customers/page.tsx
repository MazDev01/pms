"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  notes, buildLeadTasks, leadStatusLabel, leadStatusColor,
  quotationStatusLabel, quotationStatusColor, noteCategoryColor, fmtISOToThai, mainTemplateOf,
  loadDealerFiles, addDealerFile, DEALER_FILES_EVENT, extOfName, guessFileCategory, apptTypeLabel,
  type QuotationMock, type PipelineDealMock, type LeadRow,
  type CustomerRow, type CustomerStatus, type CustomerType, type DealerFile,
  type AppointmentMock, type NoteMock,
} from "@/lib/mock";
import { TemplateSelect } from "@/components/ui/TemplateSelect";
import { useSales } from "@/context/SalesContext";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { useTableLayout, type Col } from "@/components/ui/TableTools";
import { ActivityTimeline, type ActivityTimelineItem } from "@/components/ui/ActivityTimeline";
import { PersonPicker, AssigneeAvatars } from "@/components/ui/PersonPicker";
import { useMasterCatalog } from "@/lib/useMasterCatalog";
import { LeadQuotationsPanel } from "@/components/ui/LeadQuotationsPanel";
import { EmptyState } from "@/components/ui/EmptyState";
import { MultiLineChart, Donut } from "@/components/ui/Charts";
import { TemplateHero } from "@/components/ui/TemplateHero";
import { FilterBar } from "@/components/filters/FilterBar";
import { TopbarActions } from "@/components/layout/TopbarActions";
import { useFilters } from "@/context/FilterContext";
import { fileToResizedDataURL } from "@/lib/imageResize";
import {
  Plus, Search, X, ChevronUp, ChevronDown, Upload, Download,
  Phone, Building2, ExternalLink,
  Filter, Trash2,
  Calendar, FileText, StickyNote, Check, User, Paperclip, Eye,
  MapPin, Mail, Coins, Target, Layers, TrendingUp, Percent, PhoneCall, CalendarClock,
  Users, UserPlus, ShieldCheck, Package, ChevronRight, Truck, History as HistoryIcon, Pencil,
} from "lucide-react";
import { FilePreviewModal } from "@/components/ui/FilePreviewModal";
import { CURRENT_DEALER } from "@/lib/useNetworkData";

// ── Design tokens ────────────────────────────────────────────
const PRIMARY = "#003366";
const STEEL   = "#2D2D2D";
const BORDER  = "#e5e7eb";
const MUTED   = "#6b7280";

// ── Types ────────────────────────────────────────────────────
// CustomerRow / CustomerStatus / CustomerType imported from mock (shared app-wide)
type SortKey = "company"|"name"|"phone"|"province"|"owner"|"lastActivity"|"quotationCount"|"joinDate";
type SortDir = "asc"|"desc";

const CUSTOMER_TYPES: CustomerType[] = ["บุคคล","บริษัท"];
// สถานะลูกค้า (ใช้กับ FilterBar กลาง) — label ไทย
const CUSTOMER_STATUS_OPTIONS = [
  { value: "active",   label: "ใช้งาน" },
  { value: "inactive", label: "ไม่ใช้งาน" },
];
const PROVINCES  =["กรุงเทพฯ","เชียงใหม่","ระยอง","เชียงราย","นนทบุรี","สมุทรสาคร","สมุทรปราการ","นครสวรรค์","ราชบุรี","ขอนแก่น","ตาก","อุตรดิตถ์","อื่นๆ"];

function initials(name:string){ return name.replace(/บจ\.|หจก\./g,"").trim().slice(0,2); }
// ── นำเข้าลูกค้าเดิม (CSV) ──────────────────────────────────
type ImportRow = { company:string; name:string; phone:string; email:string; province:string; type:CustomerType; category:string };
const CSV_HEADERS = ["บริษัท","ผู้ติดต่อ","โทรศัพท์","อีเมล","จังหวัด","ประเภท","แม่แบบ"];
function parseCsv(text:string):ImportRow[]{
  const lines=text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  const rows=lines.map(l=>l.split(",").map(s=>s.trim().replace(/^"|"$/g,"")));
  const start=rows[0]&&rows[0][0]==="บริษัท"?1:0; // ข้าม header ถ้ามี
  return rows.slice(start).map(c=>({
    company:c[0]||"", name:c[1]||"", phone:c[2]||"", email:c[3]||"",
    province:c[4]||"กรุงเทพฯ", type:(c[5]==="บุคคล"?"บุคคล":"บริษัท") as CustomerType, category:c[6]||"",
  })).filter(r=>r.company);
}
function downloadCsvTemplate(){
  const csv=CSV_HEADERS.join(",")+"\nบจ. ตัวอย่างสตีล,คุณสมชาย ใจดี,081-234-5678,contact@example.com,เชียงใหม่,บริษัท,โกดังสำเร็จรูป";
  const blob=new Blob(["﻿"+csv],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob); const a=document.createElement("a");
  a.href=url; a.download="customer-import-template.csv"; a.click(); URL.revokeObjectURL(url);
}
function fmtMoney(v:number){ return "฿"+v.toLocaleString("th-TH"); }
const THAI_MO=["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
function thaiToday(){ const d=new Date(); return `${d.getDate()} ${THAI_MO[d.getMonth()]} ${d.getFullYear()+543}`; }
// จัดรูปแบบมูลค่า (Expected Revenue) จากสตริงดิบ → "฿1.2M" / "฿480K" · ว่าง = ""
function fmtDealValue(v:string):string{
  const s=v.replace(/[฿,\s]/gi,"");
  const n=/m$/i.test(s)?parseFloat(s)*1e6:/k$/i.test(s)?parseFloat(s)*1e3:/b$/i.test(s)?parseFloat(s)*1e9:parseFloat(s);
  if(!n||isNaN(n)) return "";
  if(n>=1e9) return "฿"+(n/1e9).toFixed(1)+"B";
  if(n>=1e6) return "฿"+(n/1e6).toFixed(1)+"M";
  if(n>=1e3) return "฿"+Math.round(n/1e3)+"K";
  return "฿"+n.toLocaleString();
}
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
  { key: "totalSales",     label: "ยอดขายรวม" },
  { key: "currentDeal",    label: "สินค้าที่ซื้อไป" },
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
// สรุปดีลของลูกค้าจาก leads (Deal = LeadRow ผูก customerId) — total/active/won
function dealStatsFor(customerId:number, company:string, leads:LeadRow[]){
  const my=leads.filter(l=>l.customerId===customerId||l.company===company);
  return { total:my.length, active:my.filter(l=>l.status!=="PAID"&&l.status!=="CANCELLED").length, won:my.filter(l=>l.status==="PAID").length };
}
function activeDealsCountFor(customerId:number, deals:PipelineDealMock[]){
  return deals.filter(d=>d.customerId===customerId && d.outcome==="active").length;
}
// จำนวนใบเสนอราคาที่ปิดการขายแล้ว (won)
function wonQuotationCountFor(customerId:number, qs:QuotationMock[]){
  return qs.filter(q=>q.customerId===customerId && q.status==="won").length;
}
// สินค้า/งานที่ลูกค้า "ซื้อไปแล้ว" — ชนิดอาคารจากใบเสนอราคาที่ปิดการขาย (won) · ใช้ดูประวัติชัดเจน
function purchasedItemsFor(customerId:number, qs:QuotationMock[]): string[] {
  const items = qs.filter(q=>q.customerId===customerId && q.status==="won").map(q=>q.buildingType).filter(Boolean);
  return Array.from(new Set(items));
}
// วันส่งมอบงานล่าสุด (โดยประมาณ = วันปิดการขาย + ระยะเวลาส่งมอบ) — ใช้ดูประวัติการรับประกัน (Warranty)
function deliveryDateFor(customerId:number, qs:QuotationMock[]): string {
  const won = qs.filter(q=>q.customerId===customerId && q.status==="won").sort((a,b)=>a.date<b.date?1:-1)[0];
  if(!won) return "—";
  const days = parseInt(String(won.deliveryTime||"").replace(/[^0-9]/g,"")) || 0;
  if(days>0){ const d=new Date(won.date); d.setDate(d.getDate()+days); return d.toISOString().slice(0,10); }
  return won.date;
}
// วันที่ซื้อ (Purchase Date) = วันปิดการขายล่าสุดของลูกค้า
function purchaseDateFor(customerId:number, qs:QuotationMock[]): string {
  const won = qs.filter(q=>q.customerId===customerId && q.status==="won").map(q=>q.date).sort();
  return won.length ? won[won.length-1] : "—";
}
// การรับประกัน (Warranty) — มาตรฐาน PEB: โครงสร้าง 10 ปี นับจากวันส่งมอบ
function warrantyFor(customerId:number, qs:QuotationMock[]): string {
  const del = deliveryDateFor(customerId, qs);
  if(del==="—") return "—";
  const d = new Date(del); d.setFullYear(d.getFullYear()+10);
  return `โครงสร้าง 10 ปี · ถึง ${fmtDate(d.toISOString().slice(0,10))}`;
}
// สถานะการรับประกัน (Warranty Status) — เทียบวันหมดประกันกับวันนี้ (2026-06-30)
function warrantyStatusFor(customerId:number, qs:QuotationMock[]): { label:string; color:string; bg:string } {
  const del = deliveryDateFor(customerId, qs);
  if(del==="—") return { label:"—", color:"#9ca3af", bg:"#f0f0f5" };
  const end = new Date(del); end.setFullYear(end.getFullYear()+10);
  const today = new Date(2026, 5, 30);
  if(end < today) return { label:"หมดประกันแล้ว", color:"#DC3545", bg:"#fee2e2" };
  const monthsLeft = (end.getFullYear()-today.getFullYear())*12 + (end.getMonth()-today.getMonth());
  if(monthsLeft <= 12) return { label:"ใกล้หมดประกัน", color:"#FFC107", bg:"#fff8e1" };
  return { label:"ยังอยู่ในประกัน", color:"#28A745", bg:"#e5faf0" };
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
    items.push({ id:`d-${d.id}`, type:"status", text:`โอกาสการขาย: ${d.project} · ${fmtMoney(d.value)}`, time:fmtDate(d.createdAt) });
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
    rows.push({ label:`สร้างโอกาสการขาย ${d.project}`, date:d.createdAt });
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

// ── Customer form shape — ใช้กับฟอร์ม "แก้ไขในตัว" เท่านั้น ──
// ลูกค้าสร้างใหม่โดยตรงไม่ได้ (ฝั่งตัวแทน) — เกิดจาก Lead→Won อัตโนมัติเท่านั้น · หน้านี้ไว้ดู/แก้ไขที่มีอยู่
type CustomerForm = Omit<CustomerRow,"id"|"initials"|"color"|"totalValue">;

// ─── ภาพรวม (แก้ไขในตัว) — ฟอร์มแก้ไขข้อมูลลูกค้าในแท็บ "ข้อมูล" ของโมดัลรายละเอียด ───
// สไตล์เดียวกับหน้าลูกค้าเป้าหมาย (OverviewEditor) — แก้ในหน้านี้เลย ไม่มีฟอร์มแยก
function CustomerOverviewEditor({ customer, onSave }:{
  customer: CustomerRow; onSave: (f: CustomerForm)=>void;
}){
  const seed = (): CustomerForm => ({
    name: customer.name, company: customer.company, type: customer.type, email: customer.email,
    phone: customer.phone, province: customer.province, category: customer.category,
    status: customer.status, projects: customer.projects, joinDate: customer.joinDate, owner: customer.owner,
    logo: customer.logo ?? "",
  });
  const [f, setF] = useState<CustomerForm>(seed);
  const logoRef = useRef<HTMLInputElement>(null);
  useEffect(()=>{ setF(seed()); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [customer.id]);
  const set = <K extends keyof CustomerForm>(k:K,v:CustomerForm[K])=>setF(p=>({...p,[k]:v}));
  async function uploadLogo(e: React.ChangeEvent<HTMLInputElement>){
    const file = e.target.files?.[0];
    if(!file) return;
    set("logo", await fileToResizedDataURL(file, 256)); // ย่อก่อนเก็บ กัน quota เต็ม
  }
  const dirty = (Object.keys(f) as (keyof CustomerForm)[]).some(k => (f[k] ?? "") !== ((customer as unknown as CustomerForm)[k] ?? ""));

  const lbl: React.CSSProperties = { display:"block", fontSize:"0.65rem", fontWeight:700, color:"#6b7280", marginBottom:4 };
  const inp: React.CSSProperties = { width:"100%", padding:"8px 10px", borderRadius:8, border:"1px solid #e5e7eb", fontSize:"0.8rem", fontFamily:"inherit", color:"#2D2D2D", background:"#fff", boxSizing:"border-box" };

  return (
    <div style={{ padding:"14px 16px" }}>
      <div style={{ fontSize:"0.65rem", fontWeight:700, letterSpacing:".06em", textTransform:"uppercase", color:PRIMARY, marginBottom:12 }}>
        ข้อมูลลูกค้า · แก้ไขได้ในหน้านี้
      </div>
      {/* เปลี่ยนรูป/โลโก้ลูกค้า (เหมือนหน้าลูกค้าเป้าหมาย) */}
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
        <div style={{ gridColumn:"1/-1" }}><label style={lbl}>บริษัท *</label>
          <input value={f.company} onChange={e=>set("company",e.target.value)} style={inp} /></div>
        <div><label style={lbl}>ผู้ติดต่อ *</label><input value={f.name} onChange={e=>set("name",e.target.value)} style={inp} /></div>
        <div><label style={lbl}>โทรศัพท์</label><input value={f.phone} onChange={e=>set("phone",e.target.value)} placeholder="0XX-XXX-XXXX" style={inp} /></div>
        <div style={{ gridColumn:"1/-1" }}><label style={lbl}>อีเมล</label>
          <input value={f.email} onChange={e=>set("email",e.target.value)} type="email" placeholder="email@company.com" style={inp} /></div>
        <div><label style={lbl}>จังหวัด</label>
          <select value={f.province} onChange={e=>set("province",e.target.value)} style={inp}>{PROVINCES.map(p=><option key={p}>{p}</option>)}</select></div>
        <div><label style={lbl}>แม่แบบ</label>
          <TemplateSelect value={f.category} onChange={v=>set("category",v)} style={inp} /></div>
        <div><label style={lbl}>ผู้รับผิดชอบ</label>
          <PersonPicker value={f.owner} onChange={v=>set("owner",v)} multiple /></div>
        <div><label style={lbl}>สถานะ</label>
          <select value={f.status} onChange={e=>set("status",e.target.value as CustomerStatus)} style={inp}>
            <option value="active">ใช้งาน</option><option value="inactive">ไม่ใช้งาน</option>
          </select></div>
        <div><label style={lbl}>วันที่เพิ่ม</label>
          <input type="date" value={f.joinDate} onChange={e=>set("joinDate",e.target.value)} style={inp} /></div>
      </div>
      <div style={{ display:"flex", justifyContent:"flex-end", gap:8, marginTop:16 }}>
        {dirty && <button onClick={()=>setF(seed())} className="btn btn-secondary btn-sm" style={{ color:"#374151" }}>ยกเลิก</button>}
        <button onClick={()=>onSave(f)} disabled={!dirty} className="btn btn-primary btn-sm"
          style={{ opacity: dirty ? 1 : 0.5, cursor: dirty ? "pointer" : "default" }}>
          <Check size={13} /> บันทึกการแก้ไข
        </button>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────
// หน้าลูกค้าไม่ใช้ตัวกรองช่วงเวลากลาง (ไม่จำเป็น) — แสดงลูกค้าทั้งหมด ใช้ค้นหา/ตัวกรองในเครื่องแทน
export default function CustomersPage(){
  const router = useRouter();
  const {
    customers: data, quotations, deals, leads,
    appointments,
    addLead, addCustomer: ctxAddCustomer,
    updateCustomer: ctxUpdateCustomer, deleteCustomer: ctxDeleteCustomer,
  } = useSales();
  const catalog = useMasterCatalog(); // แม่แบบจากแคตตาล็อกกลาง — ใช้เป็นตัวเลือกตัวกรอง "แม่แบบ"
  const { passes, timeRange } = useFilters(); // ตัวกรองช่วงเวลา (กรองตามกิจกรรมล่าสุดของลูกค้า)
  // ตัวกรองช่วงเวลากลาง (วันเดือนปี) — กรองจากวันที่เข้าเป็นลูกค้า
  const [query, setQuery]             = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL"|CustomerStatus>("ALL");
  const [catFilter, setCatFilter]     = useState("ALL");
  const [lifecycleFilter, setLifecycleFilter] = useState<"ALL"|LifecycleType>("ALL");
  const [sortKey, setSortKey]         = useState<SortKey>("company");
  const [sortDir, setSortDir]         = useState<SortDir>("asc");
  const [selected, setSelected]       = useState<CustomerRow|null>(null);
  const [custTab, setCustTab]         = useState<"overview"|"deals"|"quotation"|"timeline">("overview"); // แท็บ detail
  const [custEdit, setCustEdit]       = useState(false); // ภาพรวม: อ่าน (false) / แก้ไข (true)
  useEffect(() => { setCustTab("overview"); setCustEdit(false); }, [selected?.id]);
  const [page, setPage]               = useState(1);

  // เปิดโมดัลจากพารามิเตอร์ ?open=N — ใช้ทั้งตอนโหลดหน้า (ลิงก์เดิม/deep link) และตอนค้นหาจาก Topbar หน้าเดิม
  const dataRef = useRef(data);
  dataRef.current = data;
  useEffect(() => {
    const openByParam = (qs: string) => {
      const p = new URLSearchParams(qs).get("open");
      if (!p) return;
      const target = dataRef.current.find(c => String(c.id) === p);
      if (target) setSelected(target);
      window.history.replaceState(null, "", "/customers");
    };
    // 1) ตอนโหลดหน้า (mount) — จาก URL จริง
    openByParam(window.location.search);
    // 2) ตอนค้นหาจาก Topbar ขณะอยู่หน้าเดิม — Topbar ยิง event พร้อม href ปลายทาง
    const onOpen = (e: Event) => {
      const href = (e as CustomEvent<string>).detail ?? "";
      const [path, query = ""] = href.split("?");
      if (path === "/customers" && query) openByParam(`?${query}`);
    };
    window.addEventListener("bpms:open-record", onOpen);
    return () => window.removeEventListener("bpms:open-record", onOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // รายชื่อผู้รับผิดชอบดึงจาก PersonPicker เอง (registry กลาง) — ไม่ต้องเก็บ list ที่นี่
  // โมดัลรายละเอียด: ปิดด้วย Esc + ล็อกสกรอลล์พื้นหลัง (parity กับ RightDrawer)
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSelected(null); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [selected]);

  const [view] = useState<"card"|"table">("table"); // ตารางอย่างเดียว (เอามุมมองการ์ดออก)
  const [showFilter, setShowFilter]   = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [detailTab, setDetailTab]     = useState<"info"|"deals"|"quotes"|"appts"|"notes"|"files">("info");
  // สร้างดีลใหม่ (ลูกค้าเดิมซื้อโครงการใหม่) — Deal = ลีดที่ผูก customerId
  const [showNewDeal, setShowNewDeal] = useState(false);
  const [dealCustomer, setDealCustomer] = useState<CustomerRow|null>(null);
  const [dealForm, setDealForm] = useState({project:"",product:"",value:"",assigned:"",closeDate:"",note:""});
  // นำเข้าลูกค้าเดิม (ตัวแทน) — ลูกค้าก่อนมีระบบ / ไม่ได้ผ่าน Lead→Won · CSV + คีย์มือ
  const [showImport, setShowImport]   = useState(false);
  const [importRows, setImportRows]   = useState<ImportRow[]>([]);
  const [importErr, setImportErr]     = useState("");
  const [showManual, setShowManual]   = useState(false);
  const [legacyForm, setLegacyForm]   = useState({company:"",name:"",phone:"",email:"",province:"กรุงเทพฯ",type:"บริษัท" as CustomerType,category:"",owner:"สมชาย เชียงใหม่"});
  const csvInputRef = useRef<HTMLInputElement>(null);
  // ไฟล์แนบต่อลูกค้า — คลังไฟล์รวม (แหล่งเดียว) ปรากฏในหน้าไฟล์กลางด้วย
  const [dealerFiles, setDealerFiles] = useState<DealerFile[]>([]);
  const [previewFile, setPreviewFile] = useState<DealerFile | null>(null);
  const [viewAppt, setViewAppt] = useState<AppointmentMock | null>(null);
  const [viewNote, setViewNote] = useState<NoteMock | null>(null);
  useEffect(() => {
    setDealerFiles(loadDealerFiles());
    const sync = () => setDealerFiles(loadDealerFiles());
    window.addEventListener(DEALER_FILES_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(DEALER_FILES_EVENT, sync); window.removeEventListener("storage", sync); };
  }, []);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rightQuoteRef = useRef<HTMLDivElement|null>(null);
  const rightApptRef  = useRef<HTMLDivElement|null>(null);
  const scrollTo = (r: React.RefObject<HTMLDivElement|null>) => r.current?.scrollIntoView({ behavior:"smooth", block:"nearest" });
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f || !selected) return;
    const size = f.size > 1024*1024 ? `${(f.size/1024/1024).toFixed(1)} MB` : `${(f.size/1024).toFixed(0)} KB`;
    addDealerFile({
      name: f.name, size, ext: extOfName(f.name), category: guessFileCategory(f.name),
      project: selected.company || selected.name, uploadedBy: selected.owner || "คุณ",
      uploadedAt: new Date().toISOString().slice(0,10), source: "customer", recordId: selected.id, customerId: selected.id,
    });
    setDealerFiles(loadDealerFiles());
    if (fileInputRef.current) fileInputRef.current.value = "";
  }
  // ไฟล์ของลูกค้าที่เลือก — ผูกด้วย customerId หรือแนบตรงกับลูกค้า
  const selectedFiles: DealerFile[] = selected
    ? dealerFiles.filter(f => f.customerId === selected.id || (f.source === "customer" && f.recordId === selected.id))
    : [];


  // Table layout (density + hidden columns) จาก TableTools
  const { density, setDensity, hiddenCols, toggleCol } = useTableLayout("customers");

  function handleSort(k: SortKey){ if(sortKey===k) setSortDir(d=>d==="asc"?"desc":"asc"); else{setSortKey(k);setSortDir("asc");} }

  const filtered = useMemo(()=>{
    let rows=data.filter(c=>{
      const q=query.toLowerCase();
      const matchQ=!q||c.company.toLowerCase().includes(q)||c.name.toLowerCase().includes(q)||c.province.toLowerCase().includes(q)||c.phone.includes(q);
      const matchS=statusFilter==="ALL"||c.status===statusFilter;
      const matchC=catFilter==="ALL"||mainTemplateOf(c.category)===catFilter;
      const matchL=lifecycleFilter==="ALL"||lifecycleTypeFor(c.id,c.joinDate,quotations)===lifecycleFilter;
      // กรองตามช่วงเวลา — ใช้ "กิจกรรมล่าสุด" ของลูกค้า (โชว์ลูกค้าที่มีความเคลื่อนไหวในช่วงที่เลือก)
      const matchT=passes({date:lastActivityFor(c.id,c.joinDate,quotations)});
      return matchQ&&matchS&&matchC&&matchL&&matchT;
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
  },[data,quotations,query,statusFilter,catFilter,lifecycleFilter,sortKey,sortDir,timeRange,passes]);

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
  const totalValue    = scoped.reduce((s,c)=>s+c.totalValue,0);

  // ── S1: KPI + กราฟ (ภาษาเดียวกับแดชบอร์ด) — mock วันนี้ = 2026-06-30 ──
  const newThisMonth = useMemo(() => scoped.filter(c => {
    const d = new Date(c.joinDate);
    return d.getFullYear() === 2026 && d.getMonth() === 5;
  }).length, [scoped]);
  const warrantyActive = useMemo(() => scoped.filter(c => warrantyStatusFor(c.id, quotations).label === "ยังอยู่ในประกัน").length, [scoped, quotations]);
  const deliveredCount = useMemo(() => scoped.filter(c => deliveryDateFor(c.id, quotations) !== "—").length, [scoped, quotations]);

  // กราฟ 1 — การเติบโตของลูกค้า (สะสมตามเดือนที่เข้าร่วม, 12 เดือน)
  const growthSeries = useMemo(() => {
    const per = Array(12).fill(0);
    scoped.forEach(c => { const d = new Date(c.joinDate); if (d.getFullYear() === 2026) per[d.getMonth()]++; });
    const cum: number[] = []; let run = 0;
    for (let i = 0; i < 12; i++) { run += per[i]; cum.push(run); }
    return { per, cum };
  }, [scoped]);
  // กราฟ 2 — สินค้าที่ซื้อ (โดนัทตามแม่แบบหลัก)
  const productSegments = useMemo(() => {
    const m = new Map<string, number>();
    scoped.forEach(c => { const k = mainTemplateOf(c.category) || c.category || "อื่นๆ"; m.set(k, (m.get(k) ?? 0) + 1); });
    const total = scoped.length || 1;
    const COLORS = ["#2563EB","#16A34A","#F59E0B","#7C3AED","#EA580C","#0D9488","#94A3B8"];
    return [...m.entries()].sort((a,b)=>b[1]-a[1]).map(([label,value],i)=>({ label, value, color: COLORS[i%COLORS.length], pct: Math.round((value/total)*100) }));
  }, [scoped]);
  // กราฟ 3 — สถานะการรับประกัน (โดนัท)
  const warrantySegments = useMemo(() => {
    const order = [
      { key:"ยังอยู่ในประกัน", color:"#28A745" },
      { key:"ใกล้หมดประกัน",   color:"#FFC107" },
      { key:"หมดประกันแล้ว",   color:"#DC3545" },
      { key:"—",              color:"#94A3B8" },
    ];
    const m = new Map<string, number>();
    scoped.forEach(c => { const l = warrantyStatusFor(c.id, quotations).label; m.set(l, (m.get(l) ?? 0) + 1); });
    const total = scoped.length || 1;
    return order.filter(o => m.get(o.key)).map(o => ({ label: o.key === "—" ? "ยังไม่ส่งมอบ" : o.key, value: m.get(o.key)!, color: o.color, pct: Math.round((m.get(o.key)!/total)*100) }));
  }, [scoped, quotations]);

  // Related data for selected customer
  const relatedQuotations   = selected ? quotations.filter(q=>q.customerId===selected.id) : [];
  // ไม่รวมลีดที่ปิดการขายสำเร็จ (PAID) — กลายเป็นลูกค้ารายนี้ไปแล้ว ลิงก์จะวนกลับหน้าเดิม
  const relatedLeads        = selected ? leads.filter(l=>(l.company===selected.company||l.customerId===selected.id) && l.status!=="PAID") : [];
  // ดีลทั้งหมดของลูกค้า (ทุกสถานะ = ประวัติดีล) — Deal = ลีดที่ผูก customerId/ชื่อบริษัท
  const customerDeals       = selected ? leads.filter(l=>l.customerId===selected.id||l.company===selected.company) : [];
  const relatedAppointments = selected ? appointments.filter(a=>a.company===selected.company) : [];
  const relatedNotes        = selected ? notes.filter(n=>n.customerId===selected.id) : [];

  // บันทึกการแก้ไขในตัว (จากแท็บ "ข้อมูล" ของโมดัลรายละเอียด)
  function saveInline(form: CustomerForm){
    if(!selected) return;
    const updated: CustomerRow = {...selected,...form,initials:initials(form.company)};
    ctxUpdateCustomer(updated);
    setSelected(updated);
  }
  function deleteCustomer(){
    if(!selected) return;
    ctxDeleteCustomer(selected.id);
    setSelected(null); setShowDeleteConfirm(false);
  }
  // ── นำเข้าลูกค้าเดิม (ตัวแทน) — เพิ่มเข้า SalesContext เดียว · flag imported=true ──
  function makeImported(r: ImportRow, id: number): CustomerRow {
    return { id, name:r.name||r.company, company:r.company, type:r.type, email:r.email, phone:r.phone,
      province:r.province||"กรุงเทพฯ", category:r.category, status:"active", projects:0,
      joinDate:new Date().toISOString().slice(0,10), owner:legacyForm.owner||"สมชาย เชียงใหม่",
      initials:initials(r.company), color:PALETTE[id%PALETTE.length], totalValue:0, imported:true };
  }
  function onCsvFile(e: React.ChangeEvent<HTMLInputElement>){
    const f=e.target.files?.[0]; if(e.target)e.target.value=""; if(!f) return;
    const reader=new FileReader();
    reader.onload=()=>{ try{ const rows=parseCsv(String(reader.result)); setImportRows(rows); setImportErr(rows.length?"":"ไม่พบข้อมูลในไฟล์"); }catch{ setImportErr("อ่านไฟล์ไม่สำเร็จ — ตรวจรูปแบบ CSV"); } };
    reader.readAsText(f,"utf-8");
  }
  function commitImport(){
    const base=Math.max(0,...data.map(c=>c.id));
    importRows.forEach((r,i)=>ctxAddCustomer(makeImported(r, base+i+1)));
    setShowImport(false); setImportRows([]); setImportErr("");
  }
  function createLegacy(){
    if(!legacyForm.company.trim()) return;
    const base=Math.max(0,...data.map(c=>c.id));
    ctxAddCustomer(makeImported({company:legacyForm.company.trim(),name:legacyForm.name.trim(),phone:legacyForm.phone,email:legacyForm.email,province:legacyForm.province,type:legacyForm.type,category:legacyForm.category}, base+1));
    setShowManual(false);
    setLegacyForm({company:"",name:"",phone:"",email:"",province:"กรุงเทพฯ",type:"บริษัท",category:"",owner:"สมชาย เชียงใหม่"});
  }
  // เปิด dialog สร้างดีลใหม่ — prefill แม่แบบ/ผู้รับผิดชอบจากลูกค้า (เรียกจากการ์ด/หัวโมดัล/แท็บดีล)
  function openNewDeal(c: CustomerRow){
    setDealCustomer(c);
    setDealForm({project:"",product:c.category||catalog[0]?.name||"",value:"",assigned:c.owner,closeDate:"",note:""});
    setShowNewDeal(true);
  }
  // สร้างดีล = ลีดใหม่ผูก customerId · status WAITING · tasks = default checklist · activities/report ว่าง → เปิด Deal Detail ทันที
  function createDeal(){
    const c=dealCustomer; if(!c||!dealForm.product) return;
    const nid=Math.max(0,...leads.map(l=>l.numId))+1;
    const product=dealForm.product;
    const newDeal: LeadRow={
      id:`#L-${40321+nid}`, numId:nid,
      name:c.company, company:c.company, type:c.type,                 // ── ข้อมูลลูกค้าเดิม ──
      contact:c.name, phone:c.phone, email:c.email, province:c.province,
      assigned:dealForm.assigned||c.owner, logo:c.logo, customerId:c.id,
      product, category:mainTemplateOf(product),                     // ── รายละเอียดดีล ──
      value:fmtDealValue(dealForm.value),
      project:dealForm.project||undefined,
      expectedClose:dealForm.closeDate||undefined,
      note:dealForm.note||undefined,
      status:"WAITING",                                              // ดีลใหม่เริ่มที่ต้น pipeline
      source:"ลูกค้าเดิม (ดีลใหม่)",
      createdAt:thaiToday(),
      tasks:buildLeadTasks(),                                        // Default Checklist (ยังไม่ติ๊ก)
      activities:[],                                                 // เริ่มว่าง
    };
    addLead(newDeal);
    setShowNewDeal(false);
    router.push(`/leads?open=${newDeal.numId}`);                     // เปิด Deal Detail ทันที (ไม่ต้องกลับหน้า Lead)
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

  const detailFileCount = selectedFiles.length;
  const detailTabs: {key:"info"|"deals"|"quotes"|"appts"|"notes"|"files"; label:string; icon:React.ReactNode}[] = [
    {key:"info",    label:"ภาพรวม",     icon:<Building2 size={11}/>},
    {key:"deals",   label:`ดีล (${customerDeals.length})`, icon:<FileText size={11}/>},
    {key:"quotes",  label:`ใบเสนอราคา (${relatedQuotations.length})`, icon:<FileText size={11}/>},
    {key:"appts",   label:`นัดหมาย (${relatedAppointments.length})`,icon:<Calendar size={11}/>},
    {key:"notes",   label:`โน้ต (${relatedNotes.length})`, icon:<StickyNote size={11}/>},
    {key:"files",   label:`ไฟล์ (${detailFileCount})`, icon:<Paperclip size={11}/>},
  ];

  // แถบแบ่งหน้า — "แสดง X–Y จาก Z" ซ้าย · Prev / หน้า p / total / Next ขวา
  const Pagination = () => {
    const btnStyle = (disabled:boolean): React.CSSProperties => ({
      display:"inline-flex",alignItems:"center",justifyContent:"center",
      padding:"5px 12px",borderRadius:8,border:`1px solid ${BORDER}`,
      background:disabled?"#f1f5f9":"#fff",color:disabled?"#9ca3af":PRIMARY,
      fontSize:"0.72rem",fontWeight:700,cursor:disabled?"not-allowed":"pointer",
      opacity:disabled?0.7:1,transition:"all .15s",
    });
    return (
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
        <span style={{fontSize:"0.72rem",color:MUTED}}>แสดง {rangeFrom}–{rangeTo} จาก {filtered.length} รายการ</span>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <button type="button" onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page<=1} style={btnStyle(page<=1)}>ก่อนหน้า</button>
          <span style={{fontSize:"0.72rem",fontWeight:700,color:STEEL,padding:"0 4px"}}>หน้า {page} / {totalPages}</span>
          <button type="button" onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page>=totalPages} style={btnStyle(page>=totalPages)}>ถัดไป</button>
        </div>
      </div>
    );
  };

  return (
    <div className="erp" style={{display:"flex",gap:16,alignItems:"flex-start"}}>

      {/* ══ MAIN ══════════════════════════════════════════════ */}
      <div style={{flex:1,minWidth:0}}>

        {/* หัวหน้า/ปุ่ม → ไปอยู่บนแถบบน (ชื่อหน้ามาจาก Topbar) */}
        <TopbarActions>
          <FilterBar dims={[]} />
          <ExportMenu filename="customers" title="รายชื่อลูกค้า"
            headers={["บริษัท","ผู้ติดต่อ","โทรศัพท์","จังหวัด","ผู้รับผิดชอบ","กิจกรรมล่าสุด","จำนวนใบเสนอราคา","ยอดขายรวม","สินค้าที่ซื้อไป","วันส่งมอบ"]}
            rows={filtered.map(c=>{
              const bought=purchasedItemsFor(c.id,quotations);
              return [c.company,c.name,c.phone,c.province,c.owner,lastActivityFor(c.id,c.joinDate,quotations),quotationCountFor(c.id,quotations),fmtMoney(totalSalesFor(c.id,quotations)),bought.length?bought.join(", "):"—",fmtDate(deliveryDateFor(c.id,quotations))];
            })} />
          {/* นำเข้าลูกค้าเดิม (คีย์มือ/CSV) — ลูกค้าใหม่ยังเกิดจาก Lead→Won เท่านั้น */}
          <button className="btn btn-primary btn-sm" onClick={()=>{setImportRows([]);setImportErr("");setShowImport(true);}}>
            <Upload size={14}/> นำเข้าลูกค้าเดิม
          </button>
        </TopbarActions>
        <p className="page-sub">ฐานข้อมูลลูกค้าที่ปิดการขายแล้ว · {timeRange.subtitle}</p>

        {/* ── KPI 4 ใบ (ภาษาเดียวกับแดชบอร์ด) ── */}
        {(() => {
          const fmtC = (v:number) => v>=1e6 ? `฿${(v/1e6).toFixed(1)}M` : v>=1e3 ? `฿${Math.round(v/1e3)}K` : `฿${v}`;
          const kpis = [
            { label:"ลูกค้าทั้งหมด",     value:`${totalAll}`,        sub:"ราย",     Icon:Users,       color:"#2563EB", bg:"#E8F0FE" },
            { label:"โครงการที่ส่งมอบ",   value:`${deliveredCount}`,  sub:"โครงการ", Icon:Truck,       color:"#16A34A", bg:"#E6F7EE" },
            { label:"อยู่ในประกัน",       value:`${warrantyActive}`,  sub:"ราย",     Icon:ShieldCheck, color:"#0D9488", bg:"#E6F7F5" },
            { label:"ยอดขายรวม",         value:fmtC(totalValue),     sub:"ทุกดีล",  Icon:Coins,       color:"#EA580C", bg:"#FEF0E6" },
          ];
          return (
            <div className="dash-kpis" style={{ marginBottom:16 }}>
              {kpis.map(k => (
                <div key={k.label} className="card" style={{ padding:"16px 14px", display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:10 }}>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:"0.72rem", color:"#6B7280" }}>{k.label}</div>
                    <div style={{ fontSize:"1.42rem", fontWeight:800, color:"#1F2937", marginTop:6, fontVariantNumeric:"tabular-nums", whiteSpace:"nowrap" }}>{k.value}</div>
                    <div style={{ fontSize:"0.72rem", color:"#6B7280", marginTop:2 }}>{k.sub}</div>
                  </div>
                  <span style={{ width:42, height:42, borderRadius:12, background:k.bg, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    <k.Icon size={20} color={k.color} strokeWidth={2.1} />
                  </span>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Toolbar */}
        <div className="card" style={{padding:"12px 16px",marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
            {/* Search — ชิดซ้าย */}
            <div className="search-bar">
              <Search size={13} color="#9ca3af"/>
              <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="ค้นหาลูกค้า..."/>
              {query&&<button onClick={()=>setQuery("")} style={{background:"none",border:"none",cursor:"pointer",padding:0,color:MUTED,display:"flex"}}><X size={12}/></button>}
            </div>

            <div style={{flex:1}}/>
            {/* ปุ่มควบคุม — ชิดขวา: ตัวกรอง + สลับมุมมอง (สไตล์เดียวกับหน้าลูกค้าเป้าหมาย) */}
            <button onClick={()=>setShowFilter(f=>!f)}
              style={{display:"flex",alignItems:"center",gap:6,background:showFilter?"#003366":"#fff",
                border:`1px solid ${showFilter?"#003366":"#e5e7eb"}`,borderRadius:10,padding:"0 13px",height:36,boxSizing:"border-box",
                fontSize:"0.8rem",fontWeight:600,color:showFilter?"#fff":"#6b7280",cursor:"pointer"}}>
              <Filter size={13}/> ตัวกรอง
            </button>
          </div>

        </div>

        {/* ── FILTER DRAWER (เลื่อนจากขวา) ── */}
        {showFilter && (() => {
          const anyFilter = statusFilter!=="ALL" || catFilter!=="ALL" || lifecycleFilter!=="ALL";
          const sec = { fontSize:"0.65rem", fontWeight:800, color:STEEL, marginBottom:8, display:"block" } as const;
          const pills = { display:"flex", flexWrap:"wrap" as const, gap:6 };
          return (
            <>
              <div onClick={()=>setShowFilter(false)} className="drawer-overlay"
                style={{ position:"fixed", inset:0, background:"rgba(45,45,45,.4)", zIndex:150 }} />
              <div className="side-drawer" style={{ position:"fixed", top:0, right:0, height:"100vh", width:360, maxWidth:"100vw",
                zIndex:151, background:"#fff", boxShadow:"-16px 0 60px rgba(0,0,0,.2)", borderRadius:"18px 0 0 18px", display:"flex", flexDirection:"column" }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 20px", borderBottom:`1px solid ${BORDER}`, flexShrink:0 }}>
                  <span style={{ fontSize:"1rem", fontWeight:800, color:PRIMARY, display:"flex", gap:8, alignItems:"center" }}><Filter size={16} /> ตัวกรอง</span>
                  <button onClick={()=>setShowFilter(false)} style={{ width:30, height:30, borderRadius:8, border:`1px solid ${BORDER}`, background:"#f8f9fb", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:MUTED }}><X size={14} /></button>
                </div>
                <div style={{ flex:1, overflowY:"auto", padding:"20px", display:"flex", flexDirection:"column", gap:22 }}>
                  <div><label style={sec}>แม่แบบ</label><div style={pills}>
                    {["ALL",...catalog.map(p=>p.name)].map(cat=>(
                      <button key={cat} onClick={()=>setCatFilter(cat)}
                        style={{padding:"6px 12px",borderRadius:99,border:`1px solid ${catFilter===cat?"#C0C0C0":BORDER}`,background:catFilter===cat?"#f0f4f8":"#fff",color:catFilter===cat?STEEL:MUTED,fontSize:"0.72rem",fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                        {cat==="ALL"?"ทั้งหมด":cat}
                      </button>
                    ))}
                  </div></div>
                </div>
                <div style={{ padding:"14px 20px", borderTop:`1px solid ${BORDER}`, display:"flex", gap:8, flexShrink:0 }}>
                  <button className="btn btn-secondary btn-md" style={{ flex:1, justifyContent:"center", color: anyFilter ? "#dc2626" : "#9ca3af" }} disabled={!anyFilter}
                    onClick={()=>{ setStatusFilter("ALL"); setCatFilter("ALL"); setLifecycleFilter("ALL"); }}>ล้างทั้งหมด</button>
                  <button className="btn btn-primary btn-md" style={{ flex:1, justifyContent:"center" }} onClick={()=>setShowFilter(false)}>ดูผลลัพธ์</button>
                </div>
              </div>
            </>
          );
        })()}

        {/* ── การ์ดโครงการลูกค้า (interface หลัก) — 3/2/1 คอลัมน์ · แต่ละใบ = 1 ลูกค้าที่ปิดการขายแล้ว ── */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
          <span style={{ fontSize:"0.85rem", fontWeight:800, color:STEEL }}>ลูกค้า ({filtered.length})</span>
          <span style={{ fontSize:"0.72rem", color:MUTED }}>แสดง {rangeFrom}-{rangeTo}</span>
        </div>
        {filtered.length===0?(
          <div className="card" style={{ marginBottom:16 }}>
            <EmptyState icon={<User size={28}/>} title="ไม่พบลูกค้าที่ตรงกับเงื่อนไข"
              description="ลองปรับคำค้นหรือล้างตัวกรองเพื่อดูลูกค้าทั้งหมด"
              action={<button className="btn btn-secondary btn-md" style={{color:PRIMARY}} onClick={()=>{ setStatusFilter("ALL"); setCatFilter("ALL"); setLifecycleFilter("ALL"); setQuery(""); }}>ล้างตัวกรอง</button>} />
          </div>
        ):(
          <div className="cust-grid" style={{ marginBottom:16 }}>
            {paged.map(c=>{
              const bought = purchasedItemsFor(c.id,quotations);
              const buildingName = bought[0] || c.category || "อาคารสำเร็จรูป";
              const ws = warrantyStatusFor(c.id,quotations);
              const delivery = deliveryDateFor(c.id,quotations);
              const bt = mainTemplateOf(c.category) || c.category;
              const tags = Array.from(new Set([bt, "โครงสร้างเหล็ก"].filter(Boolean)));
              const openDetail = () => { setSelected(c); setDetailTab("info"); setShowDeleteConfirm(false); };
              return (
                <div key={c.id} className="card cust-card"
                  style={{ overflow:"hidden", display:"flex", flexDirection:"column", padding:0,
                    border: selected?.id===c.id ? `1.5px solid ${PRIMARY}` : `1px solid ${BORDER}` }}>
                  {/* Hero — ภาพแม่แบบตามอาคารที่ซื้อเสมอ (ไม่ใช้รูปลูกค้า) */}
                  <button onClick={openDetail} style={{ position:"relative", height:150, border:"none", padding:0, cursor:"pointer", background:"#eaf1fb", overflow:"hidden", display:"block" }}>
                    <TemplateHero name={buildingName} />
                  </button>

                  {/* Body */}
                  <div style={{ padding:"14px 16px", display:"flex", flexDirection:"column", gap:8, flex:1 }}>
                    <div style={{ fontSize:"0.95rem", fontWeight:800, color:STEEL, lineHeight:1.3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={buildingName}>{buildingName}</div>
                    <div>
                      <div style={{ fontSize:"0.8rem", fontWeight:700, color:"#374151", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.company}</div>
                      <div style={{ fontSize:"0.72rem", color:MUTED }}>{c.name}</div>
                    </div>

                    {/* ข้อมูลการขาย (พระเอก): มูลค่า + ผู้รับผิดชอบ */}
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"7px 10px", borderTop:"1px solid #f0f4f8", padding:"9px 0 8px" }}>
                      <div><div style={{ fontSize:"0.6rem", color:"#9ca3af", fontWeight:700 }}>มูลค่าโครงการ</div><div style={{ fontSize:"0.86rem", fontWeight:800, color:PRIMARY, fontVariantNumeric:"tabular-nums" }}>{fmtMoney(c.totalValue)}</div></div>
                      <div><div style={{ fontSize:"0.6rem", color:"#9ca3af", fontWeight:700 }}>ผู้รับผิดชอบ</div><div style={{ fontSize:"0.76rem", fontWeight:700, color:"#374151", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.owner}</div></div>
                    </div>
                    {/* หลังการขาย — แถบเล็ก มุมล่าง (ไม่ใช่พระเอกของ Sales CRM) */}
                    {delivery !== "—" && (
                      <div style={{ fontSize:"0.65rem", color:"#94a3b8", borderTop:"1px dashed #eef1f5", paddingTop:7 }}>
                        หลังการขาย · ส่งมอบ {fmtDate(delivery)} · ประกันถึง {warrantyFor(c.id,quotations)}
                      </div>
                    )}

                    {/* Tags */}
                    <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                      {tags.map(t=>(
                        <span key={t} style={{ fontSize:"0.62rem", fontWeight:600, color:PRIMARY, background:"#eef3f8", border:"1px solid #dce5f0", borderRadius:6, padding:"2px 8px" }}>{t}</span>
                      ))}
                    </div>

                    {/* ปุ่ม: รายละเอียด (ใหญ่) + ประกัน/ไฟล์/ประวัติ (เล็ก) */}
                    <div style={{ display:"flex", gap:6, marginTop:"auto" }}>
                      <button onClick={openDetail} className="btn btn-secondary btn-sm" style={{ flex:1, justifyContent:"center", color:PRIMARY }}>
                        รายละเอียด
                      </button>
                      <button onClick={openDetail} title="การรับประกัน" className="btn btn-secondary btn-sm" style={{ width:34, padding:0, color:MUTED }}><ShieldCheck size={14}/></button>
                      <button onClick={openDetail} title="ไฟล์" className="btn btn-secondary btn-sm" style={{ width:34, padding:0, color:MUTED }}><Paperclip size={14}/></button>
                      <button onClick={openDetail} title="ประวัติ" className="btn btn-secondary btn-sm" style={{ width:34, padding:0, color:MUTED }}><HistoryIcon size={14}/></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div style={{ marginBottom:18 }}><Pagination /></div>

      </div>

      {/* ══ DETAIL PANEL ══════════════════════════════════════ */}
      {selected&&(() => {
        const cardStyle: React.CSSProperties = { background:"#fff", border:"1px solid #eef1f5", borderRadius:14, padding:16 };
        const secLabel: React.CSSProperties = { display:"flex", alignItems:"center", gap:6, fontSize:"0.62rem", fontWeight:800, color:"#8a929c", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:12 };
        const qa: React.CSSProperties = { background:"rgba(255,255,255,.15)", border:"none", borderRadius:8, height:30, padding:"0 11px", cursor:"pointer", color:"#fff", display:"flex", alignItems:"center", gap:6, fontSize:"0.72rem", fontWeight:600, fontFamily:"inherit", whiteSpace:"nowrap" };
        const lcType = lifecycleTypeFor(selected.id, selected.joinDate, quotations);
        const lcMeta = LIFECYCLE_META[lcType];
        // ลูกค้ามาจากลีดที่ปิดการขาย → ถ้ายังไม่มีใบเสนอราคาปิดผูกไว้ ใช้มูลค่าที่ยกมาจากลีด (totalValue) เป็นค่าตั้งต้น
        const totalSales = totalSalesFor(selected.id, quotations) || selected.totalValue;
        const quoteCount = quotationCountFor(selected.id, quotations);
        const activeCount = activeDealsCountFor(selected.id, deals);
        // สินค้าที่ซื้อ — จากใบเสนอราคาที่ปิด · ไม่มี → ใช้แม่แบบที่ลูกค้าซื้อ (มาจากลีด)
        const purchasedItems = (() => { const p = purchasedItemsFor(selected.id, quotations); return p.length ? p : (selected.category ? [selected.category] : []); })();
        const dealCount = customerDeals.length || selected.projects || 0;
        const timelineItems = activityItemsFor(selected.id, selected.joinDate, quotations, deals);

        return (
        <>
          <div onClick={()=>setSelected(null)} className="drawer-overlay" style={{position:"fixed",inset:0,background:"rgba(45,45,45,.45)",zIndex:200}}/>

          {/* Customer Detail — แผงกลางจอ · คอลัมน์เดียว (มาตรฐานเดียวกับลูกค้าเป้าหมาย) */}
          <div className="modal-pop" style={{position:"fixed",top:"50%",left:"50%",transform:"translate(-50%,-50%)",
            width:820, maxWidth:"calc(100vw - 24px)", height:"min(920px, calc(100vh - 24px))",
            zIndex:210, background:"#fff", boxShadow:"0 30px 90px rgba(0,0,0,.32)", borderRadius:18,
            display:"flex", flexDirection:"column", overflow:"hidden"}}>

            {/* Sticky navy header + quick actions */}
            <div style={{background:PRIMARY,padding:"14px 20px",flexShrink:0}}>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:14,flexWrap:"wrap"}}>
                <div style={{display:"flex",alignItems:"center",gap:12,minWidth:0}}>
                  <div style={{width:46,height:46,borderRadius:13,overflow:"hidden",background:"rgba(255,255,255,.18)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:"1rem",border:"2px solid rgba(255,255,255,.25)",flexShrink:0}}>
                    {selected.logo ? <img src={selected.logo} alt="โลโก้" style={{width:"100%",height:"100%",objectFit:"cover"}}/> : selected.initials}
                  </div>
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:"1.12rem",fontWeight:800,color:"#fff",lineHeight:1.2}}>{selected.company}</div>
                    <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",fontSize:"0.72rem",color:"rgba(255,255,255,.72)",marginTop:4}}>
                      {selected.name && <span>{selected.name}</span>}
                      <span style={{display:"flex",alignItems:"center",gap:3}}><MapPin size={11}/> {selected.province}</span>
                      {selected.phone && <span style={{display:"flex",alignItems:"center",gap:3}}><Phone size={11}/> {selected.phone}</span>}
                      {selected.email && <span style={{display:"flex",alignItems:"center",gap:3}}><Mail size={11}/> {selected.email}</span>}
                      <span style={{opacity:.8}}>#{selected.id}</span>
                      <span style={{opacity:.8}}>เข้าร่วม {fmtDate(selected.joinDate)}</span>
                    </div>
                  </div>
                </div>
                {/* หัว = การกระทำด่วนเท่านั้น (โทร · ลบ · ปิด) · สร้างดีล/ใบเสนอราคา/นัดหมาย อยู่แถบล่าง */}
                <div style={{display:"flex",alignItems:"center",gap:7,flexShrink:0}}>
                  <a href={selected.phone ? `tel:${selected.phone}` : undefined} title="โทรหา" style={{...qa,textDecoration:"none",pointerEvents:selected.phone?"auto":"none",opacity:selected.phone?1:.5}}><PhoneCall size={13}/> โทร</a>
                  <button title="ลบลูกค้า" onClick={()=>setShowDeleteConfirm(true)} style={{...qa,width:30,padding:0,justifyContent:"center",color:"#fecaca"}}><Trash2 size={14}/></button>
                  <button onClick={()=>setSelected(null)} title="ปิด" style={{...qa,width:30,padding:0,justifyContent:"center"}}><X size={15}/></button>
                </div>
              </div>
              {/* Badges: ประเภท · แม่แบบ · ยอดขายรวม (ตัดสถานะ ใช้งาน/ไม่ใช้งาน + ลูกค้าใหม่/เดิม ออก) */}
              <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginTop:12}}>
                <span style={{padding:"2px 10px",borderRadius:99,fontSize:"0.65rem",fontWeight:700,background:"rgba(255,255,255,.18)",color:"#fff"}}>{selected.type}</span>
                {selected.category && <span style={{display:"flex",alignItems:"center",gap:4,padding:"2px 10px",borderRadius:99,fontSize:"0.65rem",fontWeight:700,background:"rgba(255,255,255,.18)",color:"#fff"}}><Building2 size={11}/> {selected.category}</span>}
                <span style={{display:"flex",alignItems:"center",gap:4,padding:"2px 10px",borderRadius:99,fontSize:"0.65rem",fontWeight:800,background:"#fff",color:PRIMARY}}><Coins size={11}/> {fmtMoney(totalSales)}</span>
              </div>
            </div>

            {/* Tab bar — ภาพรวม / ดีล / ใบเสนอราคา / ไทม์ไลน์ (มาตรฐานเดียวกับหน้าลูกค้าเป้าหมาย) */}
            <div style={{ display:"flex", borderBottom:"1px solid #e5e7eb", background:"#fff", flexShrink:0, padding:"0 8px" }}>
              {([["overview","ภาพรวม"],["deals","ดีล/โครงการ"],["quotation","ใบเสนอราคา"],["timeline","ไทม์ไลน์"]] as ["overview"|"deals"|"quotation"|"timeline",string][]).map(([k,label])=>(
                <button key={k} onClick={()=>setCustTab(k)}
                  style={{ padding:"11px 14px", border:"none", borderBottom:`2px solid ${custTab===k?PRIMARY:"transparent"}`, background:"transparent", cursor:"pointer", fontFamily:"inherit", fontSize:"0.8rem", fontWeight:custTab===k?800:600, color:custTab===k?PRIMARY:"#6b7280", marginBottom:-1 }}>{label}</button>
              ))}
            </div>

            {/* Body — เนื้อหาตามแท็บ */}
            <div style={{ flex:1, overflowY:"auto", background:"#f5f7fa" }}>

              {/* ── ภาพรวม ── */}
              <div style={{ padding:16, display:custTab==="overview"?"flex":"none", flexDirection:"column", gap:14 }}>
                <div style={cardStyle}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:custEdit?12:2}}>
                    <div style={{...secLabel,marginBottom:0}}><User size={13} color={PRIMARY}/> ข้อมูลลูกค้า</div>
                    <button onClick={()=>setCustEdit(v=>!v)} style={{display:"inline-flex",alignItems:"center",gap:3,fontSize:"0.68rem",fontWeight:700,color:PRIMARY,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit"}}>{custEdit?<>เสร็จ</>:<><Pencil size={12}/> แก้ไขข้อมูล</>}</button>
                  </div>
                  {custEdit ? (
                    <CustomerOverviewEditor customer={selected} onSave={saveInline} />
                  ) : (
                    <>
                      <div style={{fontSize:"0.62rem",color:"#8a929c",fontWeight:700}}>ยอดขายรวม</div>
                      <div style={{fontSize:"1.5rem",fontWeight:800,color:PRIMARY,fontVariantNumeric:"tabular-nums",lineHeight:1.2}}>{fmtMoney(totalSales)}</div>
                      <div style={{display:"flex",gap:6,marginTop:8,marginBottom:12,flexWrap:"wrap"}}>
                        {selected.category && <span style={{padding:"3px 10px",borderRadius:99,fontSize:"0.65rem",fontWeight:700,background:"#eef3f8",color:PRIMARY}}>{selected.category}</span>}
                        {(() => { const ws = warrantyStatusFor(selected.id, quotations); return ws.label!=="—" ? <span style={{padding:"3px 10px",borderRadius:99,fontSize:"0.65rem",fontWeight:700,background:ws.bg,color:ws.color}}>{ws.label}</span> : null; })()}
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,borderTop:"1px solid #eef1f5",paddingTop:12}}>
                        {([
                          { icon:User,     label:"ผู้ติดต่อ",   value:selected.name||"—" },
                          { icon:Phone,    label:"โทรศัพท์",   value:selected.phone||"—" },
                          { icon:Mail,     label:"อีเมล",      value:selected.email||"—" },
                          { icon:MapPin,   label:"จังหวัด",    value:selected.province||"—" },
                          { icon:Package,  label:"แม่แบบ",     value:selected.category||"—" },
                          { icon:User,     label:"ผู้รับผิดชอบ", value:selected.owner||"—" },
                          { icon:Calendar, label:"วันที่ซื้อ",  value:fmtDate(purchaseDateFor(selected.id,quotations)) },
                          { icon:Calendar, label:"เข้าร่วมเมื่อ", value:fmtDate(selected.joinDate) },
                        ] as { icon: typeof User; label:string; value:string }[]).map(r => (
                          <div key={r.label} style={{display:"flex",alignItems:"center",gap:8,padding:"9px 12px",border:"1px solid #eef1f5",borderRadius:9,background:"#fafbfc",minWidth:0}}>
                            <r.icon size={13} color="#94a3b8" style={{flexShrink:0}}/>
                            <span style={{fontSize:"0.7rem",color:"#8a929c",flexShrink:0}}>{r.label}</span>
                            <span style={{fontSize:"0.8rem",fontWeight:700,color:"#2D2D2D",flex:1,minWidth:0,textAlign:"right",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={r.value}>{r.value}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* สรุปข้อมูลลูกค้า */}
                <div style={cardStyle}>
                  <div style={secLabel}><Target size={13} color={PRIMARY}/> สรุปข้อมูลลูกค้า</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
                    {[
                      {k:"ยอดขายรวม", v:fmtMoney(totalSales), accent:PRIMARY},
                      {k:"ใบเสนอราคา", v:`${quoteCount}`, accent:STEEL},
                      {k:"สินค้าที่ซื้อไป", v:`${purchasedItems.length}`, accent:"#059669"},
                    ].map(m=>(
                      <div key={m.k} style={{background:"#f7f9fc",border:"1px solid #eef1f5",borderRadius:11,padding:"10px 8px",textAlign:"center"}}>
                        <div style={{fontSize:"0.95rem",fontWeight:800,color:m.accent,lineHeight:1.2}}>{m.v}</div>
                        <div style={{fontSize:"0.6rem",color:"#8a929c",marginTop:4,fontWeight:600}}>{m.k}</div>
                      </div>
                    ))}
                  </div>
                  {([
                    ["ตัวแทน (Dealer)", CURRENT_DEALER.name],
                    ["ผู้ดูแล (เซลส์)", selected.owner],
                    ["สินค้าที่ซื้อไป", purchasedItems.join(", ") || "—"],
                    ["จำนวนดีล/โครงการ", `${dealCount}`],
                    ["วันที่ซื้อ (ปิดการขาย)", fmtDate(purchaseDateFor(selected.id,quotations))],
                    ["วันส่งมอบงาน", fmtDate(deliveryDateFor(selected.id,quotations))],
                    ["การรับประกัน", warrantyFor(selected.id,quotations)],
                    ["เข้าร่วมเมื่อ", fmtDate(selected.joinDate)],
                  ] as [string,string][]).map(([k,v])=>(
                    <div key={k} style={{display:"flex",justifyContent:"space-between",gap:10,padding:"7px 0",borderBottom:"1px solid #f0f4f8",fontSize:"0.76rem"}}>
                      <span style={{color:"#8a929c"}}>{k}</span><span style={{fontWeight:700,color:"#2D2D2D",textAlign:"right"}}>{v}</span>
                    </div>
                  ))}
                  {(() => { const ws = warrantyStatusFor(selected.id, quotations); return (
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,padding:"8px 0 2px",fontSize:"0.76rem"}}>
                      <span style={{color:"#8a929c"}}>สถานะการรับประกัน</span>
                      <span style={{padding:"2px 10px",borderRadius:99,fontSize:"0.68rem",fontWeight:700,background:ws.bg,color:ws.color}}>{ws.label}</span>
                    </div>
                  ); })()}
                </div>
              </div>

              {/* ── ดีล/โครงการ ── */}
              <div style={{ padding:16, display:custTab==="deals"?"flex":"none", flexDirection:"column", gap:14 }}>
                <div style={cardStyle}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                    <div style={{...secLabel,marginBottom:0}}><Layers size={13} color={PRIMARY}/> ดีล / โครงการ ({customerDeals.length})</div>
                    <button onClick={()=>openNewDeal(selected)} className="btn btn-primary btn-sm"><Plus size={13}/> สร้างดีลใหม่</button>
                  </div>
                  {customerDeals.length===0?(
                    <div style={{fontSize:"0.8rem",color:MUTED,textAlign:"center",padding:"24px 0"}}>ยังไม่มีดีล — กด &ldquo;สร้างดีลใหม่&rdquo; เพื่อเริ่มโครงการแรก</div>
                  ):(
                    <div style={{display:"flex",flexDirection:"column",gap:8}}>
                      {customerDeals.map(d=>{
                        const sc=leadStatusColor[d.status];
                        const dealQuoteCount=quotations.filter(q=>q.dealId===d.numId).length;
                        const quoteLabel=dealQuoteCount>0?`${dealQuoteCount} ใบ`:(["QUOTED","FOLLOWUP","NEGO","PAID"].includes(d.status)?"มี":"—");
                        return (
                          <button key={d.id} onClick={()=>router.push(`/leads?open=${d.numId}`)}
                            style={{display:"flex",flexDirection:"column",gap:6,padding:"10px 12px",borderRadius:10,background:"#f8f9fb",border:`1px solid #eef0f4`,cursor:"pointer",textAlign:"left",width:"100%"}}
                            onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="#eef3f8";}}
                            onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="#f8f9fb";}}>
                            <div style={{display:"flex",alignItems:"center",gap:8}}>
                              <span style={{fontSize:"0.8rem",fontWeight:800,color:STEEL,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.project||`${d.product} — ${d.company}`}</span>
                              <span className="badge" style={{flexShrink:0,background:sc.bg,color:sc.text}}>{leadStatusLabel[d.status]}</span>
                            </div>
                            <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",fontSize:"0.65rem",color:MUTED}}>
                              <span>{d.product}</span>
                              {d.value&&<span style={{color:PRIMARY,fontWeight:700}}>{d.value}</span>}
                              <span>ใบเสนอราคา: {quoteLabel}</span>
                              <span>ผู้รับผิดชอบ: {d.assigned}</span>
                              {d.createdAt&&<span>สร้าง: {d.createdAt}</span>}
                              <span style={{marginLeft:"auto",color:PRIMARY,fontWeight:700}}>เปิด →</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                {relatedLeads.length>0&&(
                  <div style={cardStyle}>
                    <div style={secLabel}><Building2 size={13} color={PRIMARY}/> ลูกค้าเป้าหมายที่เกี่ยวข้อง ({relatedLeads.length})</div>
                    <div style={{display:"flex",flexDirection:"column",gap:5}}>
                      {relatedLeads.map(l=>(
                        <button key={l.id} onClick={()=>router.push(`/leads?open=${l.numId}`)}
                          style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"7px 10px",borderRadius:9,border:`1px solid ${BORDER}`,background:"#fff",cursor:"pointer",textAlign:"left"}}
                          onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="#dce5f0";}}
                          onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="#fff";}}>
                          <span style={{padding:"2px 7px",borderRadius:6,fontSize:"0.6rem",fontWeight:700,background:"#dce5f0",color:PRIMARY,flexShrink:0}}>ลูกค้าเป้าหมาย</span>
                          <span style={{fontSize:"0.72rem",fontWeight:700,color:STEEL,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.company}</span>
                          <span style={{fontSize:"0.65rem",color:PRIMARY}}>→</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ── ใบเสนอราคา ── */}
              <div style={{ padding:16, display:custTab==="quotation"?"flex":"none", flexDirection:"column", gap:14 }}>
                <div ref={rightQuoteRef} style={cardStyle}>
                  <div style={secLabel}><FileText size={13} color={PRIMARY}/> ใบเสนอราคา</div>
                  <LeadQuotationsPanel customer={selected} />
                </div>
              </div>

              {/* ── ไทม์ไลน์ + โน้ต + นัดหมาย + ไฟล์ ── */}
              <div style={{ padding:16, display:custTab==="timeline"?"flex":"none", flexDirection:"column", gap:14 }}>
                <div style={cardStyle}>
                  <div style={secLabel}><TrendingUp size={13} color={PRIMARY}/> ไทม์ไลน์กิจกรรม</div>
                  {timelineItems.length===0
                    ? <div style={{fontSize:"0.8rem",color:MUTED,textAlign:"center",padding:"18px 0"}}>ยังไม่มีกิจกรรม</div>
                    : <ActivityTimeline items={timelineItems} />}
                </div>
                <div style={cardStyle}>
                  <div style={secLabel}><StickyNote size={13} color={PRIMARY}/> โน้ต / รายงานติดตาม</div>
                  {relatedNotes.length===0?(
                    <div style={{fontSize:"0.8rem",color:MUTED,textAlign:"center",padding:"18px 0"}}>ยังไม่มีโน้ต</div>
                  ):(
                    <div style={{display:"flex",flexDirection:"column",gap:8}}>
                      {relatedNotes.map(n=>{
                        const c=noteCategoryColor[n.category];
                        return (
                          <button key={n.id} type="button" onClick={()=>setViewNote(n)} title="กดเพื่อดูโน้ตเต็ม"
                            style={{padding:"10px 12px",borderRadius:10,background:"#f8f9fb",border:`1px solid #eef0f4`,cursor:"pointer",textAlign:"left",width:"100%"}}
                            onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="#eef2f7";}}
                            onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="#f8f9fb";}}>
                            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                              <span style={{width:6,height:6,borderRadius:"50%",background:c.dot,flexShrink:0}}/>
                              <span style={{fontSize:"0.8rem",fontWeight:700,color:STEEL,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.title}</span>
                              <span style={{fontSize:"0.65rem",color:MUTED}}>{n.updatedAt}</span>
                              <Eye size={13} color={PRIMARY} style={{flexShrink:0}}/>
                            </div>
                            <div style={{fontSize:"0.72rem",color:"#4b5563",whiteSpace:"pre-wrap",lineHeight:1.5,maxHeight:70,overflow:"hidden"}}>{n.content}</div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div ref={rightApptRef} style={cardStyle}>
                  <div style={secLabel}><CalendarClock size={13} color={PRIMARY}/> นัดหมาย</div>
                  {relatedAppointments.length===0?(
                    <div style={{fontSize:"0.8rem",color:MUTED,textAlign:"center",padding:"14px 0"}}>ยังไม่มีนัดหมาย</div>
                  ):(
                    <div style={{display:"flex",flexDirection:"column",gap:8}}>
                      {relatedAppointments.map(a=>(
                        <button key={a.id} onClick={()=>setViewAppt(a)} title="กดเพื่อดูรายละเอียดนัดหมาย"
                          style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,background:"#f8f9fb",border:`1px solid #eef0f4`,cursor:"pointer",textAlign:"left",width:"100%"}}
                          onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="#e5faf0";}}
                          onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="#f8f9fb";}}>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:"0.72rem",fontWeight:700,color:STEEL}}>{a.project}</div>
                            <div style={{fontSize:"0.65rem",color:MUTED,marginTop:2}}>{apptTypeLabel[a.type]} · {fmtISOToThai(a.date)} · {a.time} น.</div>
                          </div>
                          <span className="badge" style={{flexShrink:0,background:"#dce5f0",color:PRIMARY}}>{a.status==="upcoming"?"กำลังจะมาถึง":a.status==="done"?"เสร็จแล้ว":"ยกเลิก"}</span>
                          <Eye size={14} color={PRIMARY} style={{flexShrink:0}}/>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div style={cardStyle}>
                  <div style={secLabel}><Paperclip size={13} color={PRIMARY}/> ไฟล์</div>
                  {selectedFiles.length===0?(
                    <div style={{color:"#9aa2ad",fontSize:"0.8rem",padding:"14px 0",textAlign:"center"}}>ยังไม่มีไฟล์แนบ</div>
                  ):(
                    <div style={{display:"flex",flexDirection:"column",gap:4}}>
                      {selectedFiles.map(file=>(
                        <button key={file.id} type="button" onClick={()=>setPreviewFile(file)} title="กดเพื่อดูไฟล์"
                          style={{display:"flex",alignItems:"center",gap:8,textAlign:"left",width:"100%",cursor:"pointer",padding:"8px 10px",borderRadius:8,background:"#fafafa",border:"1px solid #f0f4f8"}}>
                          <Paperclip size={13} color="#C0C0C0"/>
                          <span style={{flex:1,fontSize:"0.8rem",color:"#2D2D2D",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{file.name}</span>
                          <Eye size={13} color="#003366"/>
                        </button>
                      ))}
                    </div>
                  )}
                  <button onClick={()=>fileInputRef.current?.click()}
                    style={{fontSize:"0.72rem",color:"#003366",background:"none",border:"none",cursor:"pointer",padding:0,marginTop:10}}>
                    + เพิ่มไฟล์แนบ
                  </button>
                </div>
              </div>
            </div>

          </div>
        </>
        );
      })()}

      {/* input ไฟล์ (ซ่อน) — ใช้ร่วมกับแท็บไฟล์ของโมดัลลูกค้า */}
      <input ref={fileInputRef} type="file" style={{display:"none"}} onChange={handleFileSelect} />
      <input ref={csvInputRef} type="file" accept=".csv,text/csv" style={{display:"none"}} onChange={onCsvFile} />

      {/* คีย์ลูกค้าเดิมทีละราย (legacy manual) */}
      {showManual && (
        <div onClick={()=>setShowManual(false)} style={{position:"fixed",inset:0,background:"rgba(45,45,45,.5)",zIndex:230,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:480,background:"#fff",borderRadius:16,overflow:"hidden",boxShadow:"0 24px 64px rgba(0,0,0,.25)"}}>
            <div style={{background:PRIMARY,color:"#fff",padding:"15px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:"0.92rem",fontWeight:800}}>เพิ่มลูกค้าเดิม</div>
                <div style={{fontSize:"0.72rem",color:"rgba(255,255,255,.7)",marginTop:2}}>ลูกค้าก่อนมีระบบ / ไม่ได้ผ่านลูกค้าเป้าหมาย</div>
              </div>
              <button onClick={()=>setShowManual(false)} style={{background:"rgba(255,255,255,.15)",border:"none",borderRadius:8,width:28,height:28,color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><X size={14}/></button>
            </div>
            <div style={{padding:20,display:"flex",flexDirection:"column",gap:12,overflow:"visible"}}>
              <div><label className="form-label">บริษัท / ชื่อลูกค้า *</label>
                <input className="form-input" value={legacyForm.company} autoFocus onChange={e=>setLegacyForm(f=>({...f,company:e.target.value}))} placeholder="ชื่อบริษัท / ชื่อลูกค้า" /></div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div><label className="form-label">ผู้ติดต่อ</label>
                  <input className="form-input" value={legacyForm.name} onChange={e=>setLegacyForm(f=>({...f,name:e.target.value}))} placeholder="ชื่อผู้ติดต่อ" /></div>
                <div><label className="form-label">โทรศัพท์</label>
                  <input className="form-input" value={legacyForm.phone} onChange={e=>setLegacyForm(f=>({...f,phone:e.target.value}))} placeholder="0XX-XXX-XXXX" /></div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div><label className="form-label">อีเมล</label>
                  <input className="form-input" value={legacyForm.email} onChange={e=>setLegacyForm(f=>({...f,email:e.target.value}))} placeholder="email@company.com" /></div>
                <div><label className="form-label">จังหวัด</label>
                  <input className="form-input" value={legacyForm.province} onChange={e=>setLegacyForm(f=>({...f,province:e.target.value}))} /></div>
              </div>
              <div>
                <label className="form-label">แม่แบบ</label>
                <TemplateSelect value={legacyForm.category} onChange={v=>setLegacyForm(f=>({...f,category:v}))} className="form-select" />
              </div>
              <div style={{fontSize:"0.65rem",color:"#9ca3af"}}>ลูกค้านำเข้าจะติดป้าย &ldquo;นำเข้า&rdquo; · ลูกค้าใหม่ปกติเกิดจากปิดการขาย (Lead→Won)</div>
            </div>
            <div style={{padding:"14px 20px",borderTop:`1px solid ${BORDER}`,background:"#fafafa",display:"flex",justifyContent:"flex-end",gap:8}}>
              <button className="btn btn-secondary btn-md" onClick={()=>setShowManual(false)}>ยกเลิก</button>
              <button className="btn btn-primary btn-md" onClick={createLegacy} disabled={!legacyForm.company.trim()}><Plus size={14}/> เพิ่มลูกค้า</button>
            </div>
          </div>
        </div>
      )}

      {/* นำเข้าลูกค้าเดิมจาก CSV */}
      {showImport && (
        <div onClick={()=>setShowImport(false)} style={{position:"fixed",inset:0,background:"rgba(45,45,45,.5)",zIndex:230,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:560,background:"#fff",borderRadius:16,overflow:"hidden",boxShadow:"0 24px 64px rgba(0,0,0,.25)"}}>
            <div style={{background:PRIMARY,color:"#fff",padding:"15px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:"0.92rem",fontWeight:800}}>นำเข้าลูกค้าเดิมจาก CSV</div>
                <div style={{fontSize:"0.72rem",color:"rgba(255,255,255,.7)",marginTop:2}}>คอลัมน์: {CSV_HEADERS.join(" · ")}</div>
              </div>
              <button onClick={()=>setShowImport(false)} style={{background:"rgba(255,255,255,.15)",border:"none",borderRadius:8,width:28,height:28,color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><X size={14}/></button>
            </div>
            <div style={{padding:20,display:"flex",flexDirection:"column",gap:12}}>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <button className="btn btn-secondary btn-sm" onClick={downloadCsvTemplate}><Download size={13}/> ดาวน์โหลดเทมเพลต</button>
                <button className="btn btn-secondary btn-sm" onClick={()=>csvInputRef.current?.click()}><Upload size={13}/> เลือกไฟล์ CSV</button>
                <button className="btn btn-secondary btn-sm" onClick={()=>{setShowImport(false);setShowManual(true);}} style={{marginLeft:"auto"}}><Plus size={13}/> เพิ่มทีละราย</button>
              </div>
              {importErr && <div style={{fontSize:"0.72rem",color:"#dc2626"}}>{importErr}</div>}
              {importRows.length>0 ? (
                <>
                  <div style={{fontSize:"0.72rem",color:MUTED,fontWeight:600}}>พบ {importRows.length} รายการ — ตรวจก่อนยืนยัน</div>
                  <div style={{maxHeight:280,overflowY:"auto",border:`1px solid ${BORDER}`,borderRadius:10}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:"0.72rem"}}>
                      <thead><tr style={{background:"#f8f9fb"}}>{["บริษัท","ผู้ติดต่อ","จังหวัด","ประเภท","แม่แบบ"].map(h=><th key={h} style={{textAlign:"left",padding:"7px 10px",color:MUTED,fontWeight:700,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                      <tbody>
                        {importRows.map((r,i)=>(
                          <tr key={i} style={{borderTop:`1px solid ${BORDER}`}}>
                            <td style={{padding:"7px 10px",fontWeight:700,color:STEEL}}>{r.company}</td>
                            <td style={{padding:"7px 10px",color:MUTED}}>{r.name||"—"}</td>
                            <td style={{padding:"7px 10px",color:MUTED}}>{r.province}</td>
                            <td style={{padding:"7px 10px",color:MUTED}}>{r.type}</td>
                            <td style={{padding:"7px 10px",color:MUTED}}>{r.category||"—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div style={{fontSize:"0.72rem",color:"#9ca3af",padding:"18px 0",textAlign:"center"}}>ยังไม่ได้เลือกไฟล์ — ดาวน์โหลดเทมเพลต กรอกข้อมูล แล้วเลือกไฟล์ CSV</div>
              )}
            </div>
            <div style={{padding:"14px 20px",borderTop:`1px solid ${BORDER}`,background:"#fafafa",display:"flex",justifyContent:"flex-end",gap:8}}>
              <button className="btn btn-secondary btn-md" onClick={()=>setShowImport(false)}>ยกเลิก</button>
              <button className="btn btn-primary btn-md" onClick={commitImport} disabled={!importRows.length}><Check size={14}/> นำเข้า {importRows.length>0?`${importRows.length} ราย`:""}</button>
            </div>
          </div>
        </div>
      )}

      {/* สร้างดีลใหม่ dialog — ลูกค้าเดิมซื้อโครงการใหม่ (ข้อมูลลูกค้าคงเดิม) */}
      {showNewDeal && dealCustomer && (
        <div onClick={()=>setShowNewDeal(false)} style={{position:"fixed",inset:0,background:"rgba(45,45,45,.5)",zIndex:230,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:460,background:"#fff",borderRadius:16,overflow:"hidden",boxShadow:"0 24px 64px rgba(0,0,0,.25)"}}>
            <div style={{background:PRIMARY,color:"#fff",padding:"15px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:"0.92rem",fontWeight:800}}>สร้างดีลใหม่</div>
                <div style={{fontSize:"0.72rem",color:"rgba(255,255,255,.7)",marginTop:2}}>โครงการใหม่ของลูกค้าเดิม · ข้อมูลลูกค้าคงเดิม</div>
              </div>
              <button onClick={()=>setShowNewDeal(false)} style={{background:"rgba(255,255,255,.15)",border:"none",borderRadius:8,width:28,height:28,color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><X size={14}/></button>
            </div>
            <div style={{padding:20,display:"flex",flexDirection:"column",gap:13,overflow:"visible"}}>
              <div>
                <label className="form-label">ลูกค้า</label>
                <div style={{padding:"9px 12px",borderRadius:9,background:"#f0f4f8",border:`1px solid ${BORDER}`,fontSize:"0.8rem",fontWeight:700,color:STEEL}}>{dealCustomer.company}</div>
              </div>
              <div><label className="form-label">ชื่อโครงการ</label>
                <input className="form-input" value={dealForm.project} onChange={e=>setDealForm(f=>({...f,project:e.target.value}))} placeholder={`เช่น ${dealForm.product} เฟส 2`} /></div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div><label className="form-label">แม่แบบ</label>
                  <TemplateSelect value={dealForm.product} onChange={v=>setDealForm(f=>({...f,product:v}))} className="form-select" /></div>
                <div><label className="form-label">มูลค่าคาดการณ์</label>
                  <input className="form-input" value={dealForm.value} onChange={e=>setDealForm(f=>({...f,value:e.target.value}))} placeholder="เช่น ฿1.2M" /></div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div><label className="form-label">ผู้รับผิดชอบ</label>
                  <PersonPicker value={dealForm.assigned} onChange={v=>setDealForm(f=>({...f,assigned:v}))} multiple /></div>
                <div><label className="form-label">วันปิดคาดการณ์</label>
                  <input className="form-input" type="date" value={dealForm.closeDate} onChange={e=>setDealForm(f=>({...f,closeDate:e.target.value}))} /></div>
              </div>
              <div><label className="form-label">หมายเหตุ</label>
                <textarea className="form-input" rows={2} style={{resize:"vertical"}} value={dealForm.note} onChange={e=>setDealForm(f=>({...f,note:e.target.value}))} placeholder="รายละเอียดเพิ่มเติม..." /></div>
              <div style={{fontSize:"0.65rem",color:"#9ca3af"}}>ดีลใหม่เริ่มที่สเตจ &ldquo;ติดต่อแล้ว&rdquo; ในบอร์ด pipeline · นับรวมใน Dashboard/รายงานทันที · เปิดรายละเอียดดีลให้เลย</div>
            </div>
            <div style={{padding:"14px 20px",borderTop:`1px solid ${BORDER}`,background:"#fafafa",display:"flex",justifyContent:"flex-end",gap:8}}>
              <button className="btn btn-secondary btn-md" onClick={()=>setShowNewDeal(false)}>ยกเลิก</button>
              <button className="btn btn-primary btn-md" onClick={createDeal} disabled={!dealForm.product}><Plus size={14}/> สร้างดีล</button>
            </div>
          </div>
        </div>
      )}


      {/* Delete confirm dialog */}
      {showDeleteConfirm && selected && (
        <div onClick={()=>setShowDeleteConfirm(false)} style={{position:"fixed",inset:0,background:"rgba(45,45,45,.5)",zIndex:220,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:360,background:"#fff",borderRadius:16,overflow:"hidden",boxShadow:"0 24px 64px rgba(0,0,0,.25)"}}>
            <div style={{padding:"22px 22px 16px"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                <span style={{width:38,height:38,borderRadius:"50%",background:"#fee2e2",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Trash2 size={17} color="#dc2626"/></span>
                <div style={{fontSize:"1rem",fontWeight:800,color:STEEL}}>ลบลูกค้า</div>
              </div>
              <p style={{fontSize:"0.8rem",color:MUTED,lineHeight:1.6,margin:0}}>ต้องการลบ <strong style={{color:STEEL}}>{selected.company}</strong>? การลบไม่สามารถย้อนกลับได้</p>
            </div>
            <div style={{padding:"14px 22px",borderTop:`1px solid ${BORDER}`,background:"#fafafa",display:"flex",justifyContent:"flex-end",gap:8}}>
              <button className="btn btn-secondary btn-md" onClick={()=>setShowDeleteConfirm(false)}>ยกเลิก</button>
              <button className="btn btn-md" style={{background:"#dc2626",color:"#fff",border:"none"}} onClick={deleteCustomer}><Trash2 size={13}/> ลบ</button>
            </div>
          </div>
        </div>
      )}
      {/* ลูกค้าเกิดจาก Lead→Won อัตโนมัติเท่านั้น — ฝั่งตัวแทนสร้างลูกค้าเองไม่ได้ (ไม่มีฟอร์มเพิ่ม) */}
      {previewFile && <FilePreviewModal file={previewFile} onClose={()=>setPreviewFile(null)} />}

      {/* รายละเอียดนัดหมาย (ดูในตัว) */}
      {viewAppt && (
        <>
          <div onClick={()=>setViewAppt(null)} style={{position:"fixed",inset:0,background:"rgba(45,45,45,.45)",zIndex:300}}/>
          <div style={{position:"fixed",top:"50%",left:"50%",transform:"translate(-50%,-50%)",zIndex:310,width:420,maxWidth:"calc(100vw - 32px)",background:"#fff",borderRadius:16,overflow:"hidden",boxShadow:"0 24px 80px rgba(0,51,102,.28)"}}>
            <div style={{background:PRIMARY,padding:"14px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
              <div style={{display:"flex",alignItems:"center",gap:9,minWidth:0}}>
                <Calendar size={16} color="#fff"/>
                <div style={{fontSize:"0.9rem",fontWeight:800,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{viewAppt.project}</div>
              </div>
              <button onClick={()=>setViewAppt(null)} style={{background:"rgba(255,255,255,.15)",border:"none",borderRadius:7,width:28,height:28,cursor:"pointer",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><X size={13}/></button>
            </div>
            <div style={{padding:"16px 18px",display:"flex",flexDirection:"column",gap:2}}>
              {[
                ["ประเภท", apptTypeLabel[viewAppt.type]],
                ["วันที่", `${fmtISOToThai(viewAppt.date)} · ${viewAppt.time} น.`],
                ["สถานะ", viewAppt.status==="upcoming"?"กำลังจะมาถึง":viewAppt.status==="done"?"เสร็จแล้ว":"ยกเลิก"],
                ["ผู้รับผิดชอบ", viewAppt.assigned||"—"],
                ["ผู้ติดต่อ", viewAppt.contact||"—"],
                ["โทรศัพท์", viewAppt.phone||"—"],
                ["จังหวัด", viewAppt.province||"—"],
                ["หมายเหตุ", viewAppt.note||"—"],
              ].map(([k,v])=>(
                <div key={k} style={{display:"flex",justifyContent:"space-between",gap:12,padding:"8px 0",borderBottom:`1px solid #f0f4f8`}}>
                  <span style={{fontSize:"0.72rem",color:MUTED,flexShrink:0}}>{k}</span>
                  <span style={{fontSize:"0.76rem",fontWeight:600,color:STEEL,textAlign:"right"}}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{padding:"12px 18px",borderTop:`1px solid ${BORDER}`,background:"#fafafa",display:"flex",justifyContent:"flex-end",gap:8}}>
              <button onClick={()=>router.push("/calendar")} className="btn btn-secondary btn-sm" style={{color:"#374151"}}><Calendar size={13}/> เปิดในปฏิทิน</button>
              <button onClick={()=>setViewAppt(null)} className="btn btn-primary btn-sm">ปิด</button>
            </div>
          </div>
        </>
      )}

      {/* รายละเอียดโน้ต (ดูในตัว) */}
      {viewNote && (
        <>
          <div onClick={()=>setViewNote(null)} style={{position:"fixed",inset:0,background:"rgba(45,45,45,.45)",zIndex:300}}/>
          <div style={{position:"fixed",top:"50%",left:"50%",transform:"translate(-50%,-50%)",zIndex:310,width:460,maxWidth:"calc(100vw - 32px)",maxHeight:"85vh",background:"#fff",borderRadius:16,overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 24px 80px rgba(0,51,102,.28)"}}>
            <div style={{background:PRIMARY,padding:"14px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
              <div style={{display:"flex",alignItems:"center",gap:9,minWidth:0}}>
                <StickyNote size={16} color="#fff"/>
                <div style={{fontSize:"0.9rem",fontWeight:800,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{viewNote.title}</div>
              </div>
              <button onClick={()=>setViewNote(null)} style={{background:"rgba(255,255,255,.15)",border:"none",borderRadius:7,width:28,height:28,cursor:"pointer",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><X size={13}/></button>
            </div>
            <div style={{padding:"14px 18px",display:"flex",alignItems:"center",gap:8,borderBottom:`1px solid #f0f4f8`,flexWrap:"wrap"}}>
              <span className="badge" style={{background:noteCategoryColor[viewNote.category].bg,color:noteCategoryColor[viewNote.category].text}}>{viewNote.category}</span>
              <span style={{fontSize:"0.68rem",color:MUTED}}>โดย {viewNote.author}</span>
              <span style={{fontSize:"0.68rem",color:MUTED,marginLeft:"auto"}}>แก้ไขล่าสุด {viewNote.updatedAt}</span>
            </div>
            <div style={{padding:"16px 18px",overflowY:"auto",fontSize:"0.8rem",color:"#374151",whiteSpace:"pre-wrap",lineHeight:1.7}}>{viewNote.content}</div>
            <div style={{padding:"12px 18px",borderTop:`1px solid ${BORDER}`,background:"#fafafa",display:"flex",justifyContent:"flex-end"}}>
              <button onClick={()=>setViewNote(null)} className="btn btn-primary btn-sm">ปิด</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
