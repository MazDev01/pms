"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { printQuotation } from "@pms/shared/lib/quotationPrint";
import {
  buildLeadTasks, leadStatusLabel, leadStatusColor,
  quotationStatusLabel, quotationStatusColor, noteCategoryColor, fmtISOToThai, mainTemplateOf, loadHQPolicy, customerCode,
  loadDealerFiles, addDealerFile, DEALER_FILES_EVENT, extOfName, guessFileCategory, apptTypeLabel,
  type QuotationMock, type QuoteLineItem, type LeadRow,
  type CustomerRow, type DealerFile,
  type AppointmentMock,
} from "@pms/shared/lib/mock";
import { useCustomerNotes } from "@pms/shared/lib/useCustomerNotes";

// หมวดโน้ตจาก DB เป็นข้อความอิสระ — หมวดที่ไม่รู้จักต้องไม่ทำหน้าพัง ให้ใช้สีของ "ทั่วไป"
const noteColorOf = (cat: string) =>
  (noteCategoryColor as Record<string, { bg: string; text: string; dot: string }>)[cat] ?? noteCategoryColor["ทั่วไป"];
import { useUserProfile } from "@pms/shared/lib/useUserProfile";
import type { CustomerNote } from "@pms/shared/lib/data/types";
import { DATA_SOURCE } from "@pms/shared/lib/data/config";
import { TemplateSelect } from "@pms/shared/components/ui/TemplateSelect";
import { boqLineItems, boqSubtotal } from "@pms/shared/lib/boq";
import { useSales } from "@pms/shared/context/SalesContext";
import { ExportMenu } from "@pms/shared/components/ui/ExportMenu";
import { ReportEditor } from "@pms/shared/components/ui/ReportEditor";
import { useTableLayout, type Col } from "@pms/shared/components/ui/TableTools";
import { ActivityTimeline, type ActivityTimelineItem } from "@pms/shared/components/ui/ActivityTimeline";
import { PersonPicker, AssigneeAvatars } from "@pms/shared/components/ui/PersonPicker";
import { useMasterCatalog } from "@pms/shared/lib/useMasterCatalog";
import { useCurrentDealer } from "@pms/shared/lib/useCurrentDealer";
import { useHQPolicy } from "@pms/shared/lib/useHQConfig";
import { files as filesRepo, storage as fileStorage } from "@pms/shared/lib/data";
import { LeadQuotationsPanel } from "@pms/shared/components/ui/LeadQuotationsPanel";
import { EmptyState } from "@pms/shared/components/ui/EmptyState";
import { MultiLineChart, Donut } from "@pms/shared/components/ui/Charts";
import { TemplateHero } from "@pms/shared/components/ui/TemplateHero";
import { FilterBar } from "@pms/shared/components/filters/FilterBar";
import { FilterRow, FilterSelect } from "@pms/shared/components/filters/FilterRow";
import { TopbarActions } from "@pms/shared/components/layout/TopbarActions";
import { useFilters, APP_NOW, APP_NOW_ISO } from "@pms/shared/context/FilterContext";
import { fileToResizedDataURL } from "@pms/shared/lib/imageResize";
import {
  Plus, X, ChevronUp, ChevronDown, Upload, Download,
  Phone, Building2, ExternalLink,
  Trash2,
  Calendar, FileText, StickyNote, Check, User, Paperclip, Eye, Hash, Printer,
  MapPin, Mail, Coins, Layers, TrendingUp, Percent, PhoneCall, CalendarClock,
  Users, UserPlus, Package, ChevronRight, History as HistoryIcon,
} from "lucide-react";
import { FilePreviewModal } from "@pms/shared/components/ui/FilePreviewModal";

// ── Design tokens ────────────────────────────────────────────
const PRIMARY = "#003366";
const STEEL   = "#2D2D2D";
const BORDER  = "#e5e7eb";
const MUTED   = "#6b7280";

// ── Types ────────────────────────────────────────────────────
// CustomerRow imported from mock (shared app-wide)
type SortKey = "company"|"name"|"phone"|"province"|"owner"|"lastActivity"|"quotationCount"|"joinDate";
type SortDir = "asc"|"desc";

const PROVINCES  =["กรุงเทพฯ","เชียงใหม่","ระยอง","เชียงราย","นนทบุรี","สมุทรสาคร","สมุทรปราการ","นครสวรรค์","ราชบุรี","ขอนแก่น","ตาก","อุตรดิตถ์","อื่นๆ"];

function initials(name:string){ return name.replace(/บจ\.|หจก\./g,"").trim().slice(0,2); }
// ── นำเข้าลูกค้าเดิม (CSV) ──────────────────────────────────
type ImportRow = { company:string; name:string; phone:string; email:string; province:string; category:string };
const CSV_HEADERS = ["บริษัท","ผู้ติดต่อ","โทรศัพท์","อีเมล","จังหวัด","แม่แบบ"];
function parseCsv(text:string):ImportRow[]{
  const lines=text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  const rows=lines.map(l=>l.split(",").map(s=>s.trim().replace(/^"|"$/g,"")));
  const start=rows[0]&&rows[0][0]==="บริษัท"?1:0; // ข้าม header ถ้ามี
  return rows.slice(start).map(c=>({
    company:c[0]||"", name:c[1]||"", phone:c[2]||"", email:c[3]||"",
    province:c[4]||"กรุงเทพฯ", category:c[5]||"",
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
// "วันนี้" ต้องเป็นวันของระบบ (APP_NOW = 30 มิ.ย. 2569) ไม่ใช่นาฬิกาเครื่อง
// ใช้ new Date() = ดีลใหม่ได้วันที่ล่วงหน้าจากยุคของข้อมูล แล้วหลุดนอกช่วงตัวกรองทุกพรีเซ็ต (ทุกพรีเซ็ตจบที่ APP_NOW)
function thaiToday(){ const d=APP_NOW; return `${d.getDate()} ${THAI_MO[d.getMonth()]} ${d.getFullYear()+543}`; }
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
// ── Per-customer metrics (deterministic, derived) ────────────
// ยอดขายรวม — ผลรวม totalValue ของใบเสนอราคาที่ปิดการขาย (won)
function totalSalesFor(customerId:number, qs:QuotationMock[]){
  return qs.filter(q=>q.customerId===customerId && q.status==="won").reduce((s,q)=>s+q.totalValue,0);
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
// พิมพ์ข้อมูลลูกค้า — เปิดหน้าต่างพิมพ์ (ข้อมูลลูกค้า + ประวัติการปิดการขาย) · รูปแบบเดียวกับ ExportMenu → PDF
function printCustomer(c:CustomerRow, rows:{q:QuotationMock;template:string}[], code:string){
  const win = window.open("", "_blank", "width=900,height=700");
  if(!win) return;
  const esc = (s:unknown)=>String(s??"—");
  const info: [string,string][] = [
    ["รหัสลูกค้า", code], ["ชื่อ-สกุล", esc(c.name)],
    ["เบอร์โทรศัพท์", esc(c.phone)], ["อีเมล", esc(c.email)], ["ที่อยู่", esc(c.address)],
    ["จังหวัด", esc(c.province)], ["แม่แบบ", esc(c.category)],
    ["เป็นลูกค้าเมื่อ", fmtDate(c.joinDate)], ["ผู้รับผิดชอบ", esc(c.owner)],
    ["สถานะ", c.status==="active"?"ใช้งาน":"ไม่ใช้งาน"],
  ];
  const total = rows.reduce((s,r)=>s+r.q.totalValue,0);
  win.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>ข้อมูลลูกค้า — ${esc(c.company)}</title>
    <style>
      *{font-family:"Noto Sans Thai","Sarabun",system-ui,sans-serif;box-sizing:border-box}
      body{margin:28px;color:#2D2D2D}
      h1{font-size:18px;color:#003366;margin:0 0 2px}
      .sub{font-size:11px;color:#6b7280;margin-bottom:18px}
      h2{font-size:13px;color:#003366;margin:20px 0 8px}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 24px;font-size:11px}
      .row{display:flex;gap:8px;padding:4px 0;border-bottom:1px solid #f1f5f9}
      .k{color:#6b7280;flex:0 0 96px} .v{font-weight:700}
      table{width:100%;border-collapse:collapse;font-size:11px;margin-top:4px}
      th{background:#003366;color:#fff;text-align:left;padding:7px 10px}
      td{padding:6px 10px;border-bottom:1px solid #e5e7eb}
      tr:nth-child(even) td{background:#f8f9fb}
      .num{text-align:right}
      tfoot td{font-weight:800;background:#eef3f8;color:#003366}
    </style></head><body>
    <h1>${esc(c.company)}</h1>
    <div class="sub">ข้อมูลลูกค้า · Benjamin PMS</div>
    <h2>ข้อมูลลูกค้า</h2>
    <div class="grid">${info.map(([k,v])=>`<div class="row"><span class="k">${k}</span><span class="v">${v}</span></div>`).join("")}</div>
    <h2>ประวัติการปิดการขาย (${rows.length})</h2>
    ${rows.length===0 ? `<div style="font-size:11px;color:#6b7280">— ยังไม่มีโครงการที่ปิดการขาย</div>` : `
    <table><thead><tr><th>#</th><th>เลขที่ใบเสนอราคา</th><th>ชื่องาน</th><th>แม่แบบ</th><th>วันที่ซื้อ</th><th class="num">ราคา</th></tr></thead>
    <tbody>${rows.map(({q,template},i)=>`<tr><td>${i+1}</td><td>${esc(q.id)}</td><td>${esc(q.project)}</td><td>${esc(template)}</td><td>${fmtDate(q.date)}</td><td class="num">${fmtMoney(q.totalValue)}</td></tr>`).join("")}</tbody>
    <tfoot><tr><td colspan="5" class="num">รวมมูลค่าทั้งหมด</td><td class="num">${fmtMoney(total)}</td></tr></tfoot></table>`}
    <script>window.onload=function(){window.print()}<\/script>
    </body></html>`);
  win.document.close();
}

// โครงการที่ซื้อไปแล้ว จัดกลุ่มตาม "แม่แบบหลัก" — ใบเสนอราคาที่ปิดการขาย (won) เท่านั้น
// ไม่มีใบ won = ยังไม่มีโครงการที่ซื้อ (ไม่เดาจากดีลที่ยังไม่ปิด)
type PurchasedGroup = { template:string; projects:QuotationMock[]; total:number };
function purchasedGroupsFor(customerId:number, qs:QuotationMock[]): PurchasedGroup[] {
  const won = qs.filter(q=>q.customerId===customerId && q.status==="won");
  const m = new Map<string, QuotationMock[]>();
  won.forEach(q=>{
    const key = mainTemplateOf(q.buildingType) || q.buildingType || "ไม่ระบุแม่แบบ";
    const arr = m.get(key); if(arr) arr.push(q); else m.set(key,[q]);
  });
  return [...m.entries()]
    .map(([template,projects])=>({
      template,
      projects: [...projects].sort((a,b)=>a.date<b.date?1:-1),
      total: projects.reduce((s,q)=>s+q.totalValue,0),
    }))
    .sort((a,b)=>b.total-a.total);
}
// วันส่งมอบงานล่าสุด
// เดิมบวก "ระยะเวลาส่งมอบ" ของใบเสนอราคา แต่ฟิลด์นั้นถูกลบแล้ว (ไม่เคยมีค่าสักใบ → ผลลัพธ์เท่ากับวันปิดการขายอยู่ดี)
function deliveryDateFor(customerId:number, qs:QuotationMock[]): string {
  const won = qs.filter(q=>q.customerId===customerId && q.status==="won").sort((a,b)=>a.date<b.date?1:-1)[0];
  return won ? won.date : "—";
}

// ── Deterministic drawer feeds (จากลูกค้า + quotations + leads) ──
// ไทม์ไลน์กิจกรรม — สร้างจากใบเสนอราคาและลีดที่ผูกกับลูกค้ารายนี้ (deterministic)
function activityItemsFor(customerId:number, joinDate:string, qs:QuotationMock[], ls:LeadRow[]): ActivityTimelineItem[] {
  const items: ActivityTimelineItem[] = [];
  // จากใบเสนอราคา
  qs.filter(q=>q.customerId===customerId).forEach(q=>{
    items.push({ id:`q-${q.id}`, type:"quote", text:`ใบเสนอราคา ${q.id} — ${q.project} (${quotationStatusLabel[q.status]})`, time:fmtDate(q.date) });
    if(q.status==="won") items.push({ id:`w-${q.id}`, type:"status", text:`ปิดการขายสำเร็จ — ${q.project}`, time:fmtDate(q.date) });
  });
  // จากดีล = ลูกค้าเป้าหมายที่ผูกกับลูกค้ารายนี้ (แหล่งเดียว ไม่มีกระดาน pipeline แยกอีกแล้ว)
  ls.filter(l=>l.customerId===customerId).forEach(l=>{
    items.push({ id:`d-${l.id}`, type:"status", text:`โอกาสการขาย: ${l.project || l.company} · ${l.value}`, time:l.createdAt ?? "—" });
  });
  // จุดเริ่มต้น: วันที่เพิ่มลูกค้า
  items.push({ id:"joined", type:"note", text:"เพิ่มลูกค้าเข้าระบบ", time:fmtDate(joinDate) });
  return items;
}

// ── ลูกค้าใหม่ / ลูกค้าเดิม ───────────────
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
// สไตล์ + Row ต้องอยู่นอกคอมโพเนนต์ — ประกาศข้างในจะได้ "ฟังก์ชันตัวใหม่" ทุกเรนเดอร์
// React ถือเป็นคนละคอมโพเนนต์ → unmount/mount ช่องกรอกใหม่ทุกครั้งที่พิมพ์ → โฟกัสหลุดหลังพิมพ์ 1 ตัวอักษร
// ช่องกรอกไม่มีกรอบของตัวเอง (บอสสั่ง 17 ก.ค. 69 — มาตรฐานเดียวกับการ์ดภาพรวมหน้าลีด)
const CU_INP: React.CSSProperties = { width:"100%", height:28, padding:"0 8px", borderRadius:6, border:"none", outline:"none", fontSize:"0.78rem", fontWeight:700, fontFamily:"inherit", color:"#2D2D2D", background:"transparent", boxSizing:"border-box" };
// แต่ละแถวมีกรอบ + พื้นจาง — โทนเดียวกับช่องข้อมูลหน้าลูกค้าเป้าหมาย (OV_CELL: #fafbfc / ขอบ #eef1f5)
// บอสสั่ง 17 ก.ค. 69: "เพิ่มกรอบข้างหลังที่มีสีให้ดูง่าย" · โครง "ป้าย : ค่า" เดิมคงไว้ทุกช่อง
const CU_ROW: React.CSSProperties = { display:"flex", gap:8, alignItems:"center", padding:"6px 10px", minWidth:0, background:"#fafbfc", border:"1px solid #eef1f5", borderRadius:9, marginBottom:6 };
const CU_KEY: React.CSSProperties = { fontSize:"0.74rem", color:"#8a929c", flex:"0 0 96px" };
const CU_COLON: React.CSSProperties = { fontSize:"0.74rem", color:"#c7ccd3", flexShrink:0 };
function CuRow({ label, children }:{ label:string; children:React.ReactNode }) {
  return (
    <div style={CU_ROW}><span style={CU_KEY}>{label}</span><span style={CU_COLON}>:</span>
      <span style={{ flex:1, minWidth:0 }}>{children}</span></div>
  );
}
// สไตล์เดียวกับหน้าลูกค้าเป้าหมาย (OverviewEditor) — แก้ในหน้านี้เลย ไม่มีฟอร์มแยก
function CustomerOverviewEditor({ customer, code, onSave }:{
  customer: CustomerRow; code: string; onSave: (f: CustomerForm)=>void;
}){
  const seed = (): CustomerForm => ({
    name: customer.name, company: customer.company, email: customer.email,
    phone: customer.phone, address: customer.address ?? "", province: customer.province, category: customer.category,
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

  // แก้ไข "ในฟอร์มเดิม" — ตาราง ป้าย : ค่า 2 คอลัมน์ ตำแหน่งเดียวกับตอนอ่าน (ค่ากลายเป็นช่องกรอก)
  // ห้ามสลับไปฟอร์มคนละหน้าตา (บอสสั่ง) · Row/สไตล์อยู่นอกคอมโพเนนต์ (ดูคอมเมนต์ข้างบน)
  const inp = CU_INP, keyS = CU_KEY, colonS = CU_COLON, Row = CuRow;

  return (
    <>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 28px", borderTop:"1px solid #eef1f5", paddingTop:12 }}>
        <div style={{ display:"flex", flexDirection:"column" }}>
          <Row label="รหัสลูกค้า"><span style={{ fontSize:"0.8rem", fontWeight:700, color:"#9ca3af" }}>{code}</span></Row>
          <Row label="บริษัท"><input value={f.company} onChange={e=>set("company",e.target.value)} style={inp} /></Row>
          <Row label="ชื่อ-สกุล"><input value={f.name} onChange={e=>set("name",e.target.value)} style={inp} /></Row>
          <Row label="เบอร์โทรศัพท์"><input value={f.phone} onChange={e=>set("phone",e.target.value)} placeholder="0XX-XXX-XXXX" style={inp} /></Row>
          <Row label="อีเมล"><input value={f.email} onChange={e=>set("email",e.target.value)} type="email" placeholder="email@company.com" style={inp} /></Row>
        </div>
        <div style={{ display:"flex", flexDirection:"column" }}>
          <Row label="ที่อยู่">
            <textarea value={f.address ?? ""} onChange={e=>set("address",e.target.value)} rows={2}
              placeholder="เลขที่ ถนน แขวง/ตำบล เขต/อำเภอ รหัสไปรษณีย์"
              style={{ ...inp, height:"auto", padding:"5px 8px", resize:"vertical", lineHeight:1.4, fontWeight:400 }} />
          </Row>
          <Row label="จังหวัด">
            <select value={f.province} onChange={e=>set("province",e.target.value)} style={{ ...inp, cursor:"pointer" }}>{PROVINCES.map(p=><option key={p}>{p}</option>)}</select>
          </Row>
          <Row label="แม่แบบ"><TemplateSelect value={f.category} onChange={v=>set("category",v)} style={inp} /></Row>
          {/* joinDate = วันที่เข้าระบบเป็นลูกค้า — ป้าย "วันที่สมัคร" เดิมชวนเข้าใจผิด (บอสสั่งเปลี่ยน 17 ก.ค. 69) */}
          <Row label="เป็นลูกค้าเมื่อ"><input type="date" value={f.joinDate} onChange={e=>set("joinDate",e.target.value)} style={inp} /></Row>
          <Row label="ผู้รับผิดชอบ"><PersonPicker value={f.owner} onChange={v=>set("owner",v)} multiple /></Row>
          {/* แถว "สถานะ" ถูกถอดออกจากการ์ด (บอสสั่ง 17 ก.ค. 69) — สถานะกลับเป็นข้อมูลแสดงผลอย่างเดียว
              (เหมือนก่อนมีตัวแก้ในที่เดิม: ไม่เคยมี UI แก้สถานะมาก่อน ดรอปดาวน์นี้เพิ่งถูกเพิ่มแล้วถูกสั่งถอด) */}
        </div>
      </div>
      {/* รูป/โลโก้ + ปุ่ม อยู่บรรทัดเดียวกัน — กันการ์ดขยายตอนสลับมาโหมดแก้ไข */}
      <div style={{ display:"flex", alignItems:"center", gap:10, marginTop:8, paddingTop:8, borderTop:"1px solid #f4f6f9", flexWrap:"wrap" }}>
        <span style={{ ...keyS, flex:"0 0 96px" }}>รูป / โลโก้</span><span style={colonS}>:</span>
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
        <button onClick={()=>onSave(f)} disabled={!dirty} className="btn btn-primary btn-sm"
          style={{ opacity: dirty ? 1 : 0.5, cursor: dirty ? "pointer" : "default" }}>
          <Check size={13} /> บันทึกการแก้ไข
        </button>
      </div>
    </>
  );
}

// ── Main Page ────────────────────────────────────────────────
// หน้าลูกค้าไม่ใช้ตัวกรองช่วงเวลากลาง (ไม่จำเป็น) — แสดงลูกค้าทั้งหมด ใช้ค้นหา/ตัวกรองในเครื่องแทน
export default function CustomersPage(){
  const router = useRouter();
  const {
    customers: allCustomers, quotations: allQuotations, leads: allLeadsRaw,
    appointments,
    addLead, updateLead, addCustomer: ctxAddCustomer,
    updateCustomer: ctxUpdateCustomer, deleteCustomer: ctxDeleteCustomer,
  } = useSales();
  const currentDealer = useCurrentDealer(); // สาขาที่ล็อกอิน (multi-tenant) — ใช้ออกรหัสลูกค้า
  const userProfile = useUserProfile();
  const hqPolicy = useHQPolicy();
  const customerNotes = useCustomerNotes(userProfile.profile.name); // โน้ตลูกค้าผ่าน repo (ผู้เขียน = ผู้ใช้ที่ล็อกอิน) // VAT จาก HQ ผ่าน repo (ตัวแทนตั้งเองไม่ได้ · อัปเดตตามเมื่อ HQ แก้)
  // scope ทุกอย่างเป็นของสาขาที่ล็อกอิน (multi-tenant) — RYG ไม่เห็นลูกค้า/ใบ/ลีดของ CNX
  // undefined = ของ CNX (สมุดงานเดิม) · ที่เหลือกรองด้วย dealerCode ตรง ๆ
  const data = useMemo(() => allCustomers.filter(c => (c.dealerCode ?? "CNX") === currentDealer.code), [allCustomers, currentDealer.code]);
  const quotations = useMemo(() => allQuotations.filter(q => (q.dealerCode ?? "CNX") === currentDealer.code), [allQuotations, currentDealer.code]);
  const leads = useMemo(() => allLeadsRaw.filter(l => (l.dealerCode ?? "CNX") === currentDealer.code), [allLeadsRaw, currentDealer.code]);
  const catalog = useMasterCatalog(); // แม่แบบจากแคตตาล็อกกลาง — ใช้เป็นตัวเลือกตัวกรอง "แม่แบบ"
  const { passes, timeRange } = useFilters(); // ตัวกรองช่วงเวลา (กรองตามกิจกรรมล่าสุดของลูกค้า)
  // ตัวกรองช่วงเวลากลาง (วันเดือนปี) — กรองจากวันที่เข้าเป็นลูกค้า
  const [query, setQuery]             = useState("");
  const [catFilter, setCatFilter]     = useState("ALL");
  // มาจากแดชบอร์ด (การ์ด "ยอดขายตามแม่แบบ") → /customers?template=<แม่แบบหลัก> · ตั้งตัวกรองให้ตรงกับแถวที่กดมา
  // อ่านจาก window.location แทน useSearchParams เพื่อไม่ต้องครอบ <Suspense> ทั้งหน้า
  // ตั้งค่าเฉพาะแม่แบบที่มีอยู่จริงในแคตตาล็อก — ค่าที่ไม่รู้จักจะทำให้ตัวกรองโชว์ค่าว่างและลิสต์ว่างโดยไม่มีเหตุผล
  const urlFilterDone = useRef(false);
  useEffect(() => {
    if (urlFilterDone.current || !catalog.length) return;
    urlFilterDone.current = true;
    const t = new URLSearchParams(window.location.search).get("template");
    if (t && catalog.some(p => p.name === t)) setCatFilter(t);
  }, [catalog]);
  // ตัวกรองจังหวัด/ผู้รับผิดชอบ — ตัวเลือกสร้างจากข้อมูลลูกค้าจริงที่มีอยู่ ไม่ใช่รายการตายตัว
  const [provFilter, setProvFilter] = useState("ALL");
  const [ownerFilter, setOwnerFilter] = useState("ALL");
  const [sortKey, setSortKey]         = useState<SortKey>("company");
  const [sortDir, setSortDir]         = useState<SortDir>("asc");
  const [selected, setSelected]       = useState<CustomerRow|null>(null);
  const [custTab, setCustTab]         = useState<"overview"|"deals"|"quotation"|"timeline">("overview"); // แท็บ detail
  // (โหมดอ่าน/แก้ไขถูกถอดแล้ว — การ์ดข้อมูลลูกค้าแก้ในที่เดิมได้ตลอด · CustomerOverviewEditor reseed เองเมื่อสลับลูกค้า)
  useEffect(() => { setCustTab("overview"); }, [selected?.id]);
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [detailTab, setDetailTab]     = useState<"info"|"deals"|"quotes"|"appts"|"notes"|"files">("info");
  // โครงการที่กดดู (จากตาราง "ประวัติการปิดการขาย") → เปิดแผงรายละเอียดโครงการซ้อนขึ้นมา
  const [viewProject, setViewProject] = useState<{ q: QuotationMock; template: string } | null>(null);
  // แม่แบบที่มีหลายงาน → กดการ์ดแล้วเปิดตัวเลือกก่อนว่าจะดูงานไหน (แม่แบบเดียวอาจมีถึง v30)
  const [pickGroup, setPickGroup] = useState<PurchasedGroup | null>(null);
  // สร้างดีลใหม่ (ลูกค้าเดิมซื้อโครงการใหม่) — Deal = ลีดที่ผูก customerId
  const [showNewDeal, setShowNewDeal] = useState(false);
  const [dealCustomer, setDealCustomer] = useState<CustomerRow|null>(null);
  const [dealForm, setDealForm] = useState({project:"",product:"",value:"",assigned:"",note:""});
  // นำเข้าลูกค้าเดิม (ตัวแทน) — ลูกค้าก่อนมีระบบ / ไม่ได้ผ่าน Lead→Won · CSV + คีย์มือ
  const [showImport, setShowImport]   = useState(false);
  const [importRows, setImportRows]   = useState<ImportRow[]>([]);
  const [importErr, setImportErr]     = useState("");
  const [showManual, setShowManual]   = useState(false);
  const [legacyForm, setLegacyForm]   = useState({company:"",name:"",phone:"",email:"",province:"กรุงเทพฯ",category:"",owner:"สมชาย เชียงใหม่"});
  const csvInputRef = useRef<HTMLInputElement>(null);
  // ไฟล์แนบต่อลูกค้า — คลังไฟล์รวม (แหล่งเดียว) ปรากฏในหน้าไฟล์กลางด้วย
  const [dealerFiles, setDealerFiles] = useState<DealerFile[]>([]);
  const [previewFile, setPreviewFile] = useState<DealerFile | null>(null);
  const [viewAppt, setViewAppt] = useState<AppointmentMock | null>(null);
  const [viewNote, setViewNote] = useState<CustomerNote | null>(null);
  useEffect(() => {
    // ไฟล์ของสาขานี้ผ่าน repository (local: localStorage · supabase: DB)
    const sync = () => { filesRepo.list({ dealerCode: currentDealer.code, isHQ: false }).then(setDealerFiles).catch(() => {}); };
    sync();
    window.addEventListener(DEALER_FILES_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(DEALER_FILES_EVENT, sync); window.removeEventListener("storage", sync); };
  }, [currentDealer.code]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rightQuoteRef = useRef<HTMLDivElement|null>(null);
  const rightApptRef  = useRef<HTMLDivElement|null>(null);
  const scrollTo = (r: React.RefObject<HTMLDivElement|null>) => r.current?.scrollIntoView({ behavior:"smooth", block:"nearest" });
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f || !selected) return;
    const size = f.size > 1024*1024 ? `${(f.size/1024/1024).toFixed(1)} MB` : `${(f.size/1024).toFixed(0)} KB`;
    // อัปโหลด bytes เข้า Storage ก่อน (local คืน null = เก็บแค่ metadata) แล้วบันทึก metadata
    void fileStorage.upload(currentDealer.code, f).catch(() => null)
      .then(storagePath => filesRepo.add({
        name: f.name, size, ext: extOfName(f.name), category: guessFileCategory(f.name),
        project: selected.company || selected.name, uploadedBy: selected.owner || "คุณ",
        uploadedAt: APP_NOW_ISO, source: "customer", recordId: selected.id, customerId: selected.id, dealerCode: currentDealer.code,
        ...(storagePath ? { storagePath } : {}),
      }))
      .then(() => filesRepo.list({ dealerCode: currentDealer.code, isHQ: false }).then(setDealerFiles)).catch(() => {});
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
      // ตัวกรอง "สถานะ" + "ลูกค้าใหม่/เดิม" ถูกลบตามที่บอสสั่ง — ไม่มี UI ให้ตั้งค่าแล้ว
      const matchC=catFilter==="ALL"||mainTemplateOf(c.category)===catFilter;
      const matchP=provFilter==="ALL"||c.province===provFilter;
      const matchO=ownerFilter==="ALL"||(c.owner||"")===ownerFilter;
      // กรองตามช่วงเวลา — ใช้ "กิจกรรมล่าสุด" ของลูกค้า (โชว์ลูกค้าที่มีความเคลื่อนไหวในช่วงที่เลือก)
      const matchT=passes({date:lastActivityFor(c.id,c.joinDate,quotations)});
      return matchQ&&matchC&&matchP&&matchO&&matchT;
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
  },[data,quotations,query,catFilter,provFilter,ownerFilter,sortKey,sortDir,timeRange,passes]);

  // ตัวเลือกตัวกรอง — ดึงจากข้อมูลลูกค้าจริงที่มีอยู่ (ไม่ hardcode รายการจังหวัด/พนักงาน)
  const provOptions  = useMemo(()=>[...new Set(data.map(c=>c.province).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"th")),[data]);
  const ownerOptions = useMemo(()=>[...new Set(data.map(c=>c.owner).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"th")),[data]);

  // ── Pagination (client-side) ──────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // รีเซ็ต/clamp หน้าเมื่อค้นหา/เรียง/ตัวกรองเปลี่ยน หรือจำนวนหน้าลดลง
  useEffect(() => { setPage(1); }, [query,catFilter,provFilter,ownerFilter,sortKey,sortDir]);
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

  // Related data for selected customer
  const relatedQuotations   = selected ? quotations.filter(q=>q.customerId===selected.id) : [];
  // ไม่รวมลีดที่ปิดการขายสำเร็จ (PAID) — กลายเป็นลูกค้ารายนี้ไปแล้ว ลิงก์จะวนกลับหน้าเดิม
  // "งานขายทั้งหมด" = ประวัติการปิดการขาย (ใบเสนอราคาที่ปิดการขาย) + โครงการที่กำลังทำ (ลีดที่ยังไม่ปิด)
  // เดิมทั้งสองการ์ดอ่านจากลีดชุดเดียวกัน → โชว์ตัวที่กำลังทำซ้ำบน-ล่าง ส่วนที่ซื้อแล้วไม่โผล่เลย (บอสทัก)
  const wonProjects   = selected ? quotations.filter(q=>q.customerId===selected.id && q.status==="won") : [];
  const activeDeals   = selected ? leads.filter(l=>(l.customerId===selected.id||l.company===selected.company) && l.status!=="PAID") : [];
  const projectCount  = wonProjects.length + activeDeals.length;
  // ลีดทุกสถานะของลูกค้ารายนี้ — ใช้ผูกใบเสนอราคากลับไปหาลีด (คนละชุดกับการ์ด "งานขายทั้งหมด")
  const customerDeals = selected ? leads.filter(l=>l.customerId===selected.id||l.company===selected.company) : [];
  const relatedAppointments = selected ? appointments.filter(a=>a.company===selected.company) : [];
  // โน้ตของลูกค้ารายนี้ — จากตาราง customer_notes (ของสาขาตัวเอง)
  // เดิมไม่มีที่เก็บจริง จึงต้องปิดแท็บไว้ในโหมด supabase · ตอนนี้จดได้จริงและอยู่ข้ามเครื่อง
  const relatedNotes        = selected ? customerNotes.notes.filter(n=>n.customerId===selected.id) : [];

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
    return { id, name:r.name||r.company, company:r.company, email:r.email, phone:r.phone,
      province:r.province||"กรุงเทพฯ", category:r.category, status:"active", projects:0,
      joinDate:APP_NOW_ISO, owner:legacyForm.owner||"สมชาย เชียงใหม่",
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
    ctxAddCustomer(makeImported({company:legacyForm.company.trim(),name:legacyForm.name.trim(),phone:legacyForm.phone,email:legacyForm.email,province:legacyForm.province,category:legacyForm.category}, base+1));
    setShowManual(false);
    setLegacyForm({company:"",name:"",phone:"",email:"",province:"กรุงเทพฯ",category:"",owner:"สมชาย เชียงใหม่"});
  }
  // เปิด dialog สร้างดีลใหม่ — prefill แม่แบบ/ผู้รับผิดชอบจากลูกค้า (เรียกจากการ์ด/หัวโมดัล/แท็บดีล)
  function openNewDeal(c: CustomerRow){
    setDealCustomer(c);
    setDealForm({project:"",product:c.category||catalog[0]?.name||"",value:"",assigned:c.owner,note:""});
    setShowNewDeal(true);
  }
  // สร้างดีล = ลีดใหม่ผูก customerId · status WAITING · tasks = default checklist · activities/report ว่าง → เปิด Deal Detail ทันที
  function createDeal(){
    const c=dealCustomer; if(!c||!dealForm.product) return;
    const nid=Math.max(0,...leads.map(l=>l.numId))+1;
    const product=dealForm.product;
    const newDeal: LeadRow={
      id:`#L-${40321+nid}`, numId:nid,
      name:c.company, company:c.company,                              // ── ข้อมูลลูกค้าเดิม ──
      contact:c.name, phone:c.phone, email:c.email, province:c.province,
      assigned:dealForm.assigned||c.owner, logo:c.logo, customerId:c.id,
      product, category:mainTemplateOf(product),                     // ── รายละเอียดดีล ──
      value:fmtDealValue(dealForm.value),
      project:dealForm.project||undefined,
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
  // toggleStatus ถูกลบ — โค้ดตาย (นิยามไว้แต่ไม่มีใครเรียก) · สถานะลูกค้าเป็นข้อมูลแสดงผลอย่างเดียว

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
            { label:"ยอดขายรวม",         value:fmtC(totalValue),     sub:"ทุกโครงการ", Icon:Coins,    color:"#EA580C", bg:"#FEF0E6" },
          ];
          return (
            <div className="dash-kpis kpi-2" style={{ marginBottom:16 }}>
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


        {/* ── แถบตัวกรองแถวเดียว (มาตรฐานเดียวกับหน้า /hq/pipeline) ──
            เดิมเป็นปุ่ม "ตัวกรอง" + แผงชิปเลื่อนจากขวา — ตอนนี้เห็นตัวกรองทุกตัวพร้อมกัน
            ตัวเลือกจังหวัด/ผู้รับผิดชอบสร้างจากข้อมูลลูกค้าจริง · แม่แบบมาจากแคตตาล็อกกลาง
            "ลูกค้าทั้งหมด N รายการ" เอาออกตามที่บอสสั่ง — จำนวนดูได้ที่การ์ด KPI และแถบแบ่งหน้า */}
        <FilterRow
          query={query} onQuery={setQuery} placeholder="ค้นหาลูกค้า, เบอร์โทร, อีเมล..."
          showClear={catFilter!=="ALL" || provFilter!=="ALL" || ownerFilter!=="ALL" || !!query}
          onClear={()=>{ setQuery(""); setCatFilter("ALL"); setProvFilter("ALL"); setOwnerFilter("ALL"); }}
        >
          <FilterSelect caption="ทุกแม่แบบ" value={catFilter} onChange={setCatFilter}
            options={catalog.map(p=>({v:p.name,l:p.name}))} minWidth={140} />
          <FilterSelect caption="ทุกจังหวัด" value={provFilter} onChange={setProvFilter}
            options={provOptions.map(p=>({v:p,l:p}))} />
          <FilterSelect caption="ทุกผู้รับผิดชอบ" value={ownerFilter} onChange={setOwnerFilter}
            options={ownerOptions.map(o=>({v:o,l:o}))} minWidth={140} />
        </FilterRow>

        {/* ── ตารางลูกค้า — คลิกแถวเพื่อเปิดแผงรายละเอียด · เรียงได้ที่หัวคอลัมน์
             ความกว้างคุมที่ colgroup เท่านั้น (table-layout:fixed — ใส่ที่ th ไม่มีผล) ── */}
        {filtered.length===0?(
          <div className="card" style={{ marginBottom:16 }}>
            <EmptyState icon={<User size={28}/>} title="ไม่พบลูกค้าที่ตรงกับเงื่อนไข"
              description="ลองปรับคำค้นหรือล้างตัวกรองเพื่อดูลูกค้าทั้งหมด"
              action={<button className="btn btn-secondary btn-md" style={{color:PRIMARY}} onClick={()=>{ setCatFilter("ALL"); setProvFilter("ALL"); setOwnerFilter("ALL"); setQuery(""); }}>ล้างตัวกรอง</button>} />
          </div>
        ):(
          <div className="card" style={{ marginBottom:16 }}>
            <div className="table-wrap" style={{ borderTop:"none" }}>
              <table>
                <colgroup>
                  {/* ความกว้างวัดจริงในเบราว์เซอร์ (หัวตาราง + ข้อมูล) · minWidth รวม ~1006px ต้องไม่เกินกรอบ 1012px
                      "ยอดขายรวม" หัวต้องการ 111px และ "โครงการ" 87px — เคยตั้งแคบไปจนหัวโดนตัด */}
                  <col style={{ width:"18%",   minWidth:170 }} />{/* บริษัท */}
                  <col style={{ width:"12%",   minWidth:118 }} />{/* ผู้ติดต่อ */}
                  <col style={{ width:"11%",   minWidth:118 }} />{/* โทรศัพท์ */}
                  <col style={{ width:"10%",   minWidth:104 }} />{/* จังหวัด */}
                  <col style={{ width:"12%",   minWidth:116 }} />{/* แม่แบบ */}
                  <col style={{ width:"11.5%", minWidth:114 }} />{/* ยอดขายรวม — หัว 111 */}
                  <col style={{ width:"9%",    minWidth:90 }} />{/* โครงการ — หัว 87 */}
                  <col style={{ width:"11%",   minWidth:112 }} />{/* ติดต่อล่าสุด */}
                  <col style={{ width:"5.5%",  minWidth:64 }} />{/* ปุ่มดูรายละเอียด */}
                </colgroup>
                <thead>
                  <tr>
                    {/* หัวคอลัมน์ครอบด้วย flex + nowrap ทุกช่อง — ไม่งั้นลูกศรเรียงตกไปบรรทัดล่างเวลาคอลัมน์แคบ
                        (มาตรฐานเดียวกับตารางลีด/ใบเสนอราคา) · คอลัมน์ตัวเลขจัดชิดขวาให้ตรงกับค่าในเซลล์ */}
                    {([
                      ["company","บริษัท",false],["name","ผู้ติดต่อ",false],["phone","โทรศัพท์",false],["province","จังหวัด",false],
                      [null,"แม่แบบ",false],[null,"ยอดขายรวม",true],[null,"โครงการ",true],["lastActivity","ติดต่อล่าสุด",false],
                    ] as [SortKey|null,string,boolean][]).map(([k,label,isNum])=>(
                      <th key={label} className={isNum?"num":(k?"clickable":undefined)}
                        onClick={k?()=>handleSort(k):undefined}
                        style={k?{cursor:"pointer"}:undefined}>
                        <span style={{display:"flex",alignItems:"center",gap:4,whiteSpace:"nowrap",justifyContent:isNum?"flex-end":"flex-start"}}>
                          {label}{k&&<SortIcon k={k}/>}
                        </span>
                      </th>
                    ))}
                    <th></th>{/* คอลัมน์ปุ่มดู — ไม่ต้องมีหัวคอลัมน์ (มาตรฐานเดียวกับตารางลีด/ใบเสนอราคา) */}
                  </tr>
                </thead>
                <tbody>
                  {paged.map(c=>{
                    const sales = totalSalesFor(c.id, quotations) || c.totalValue;
                    const cat = mainTemplateOf(c.category) || c.category || "—";
                    // จำนวนโครงการ = ใบเสนอราคาที่ปิดการขายจริง (ยังไม่ซื้อ = "—" ไม่เดา)
                    const projects = purchasedGroupsFor(c.id, quotations).reduce((n,g)=>n+g.projects.length,0);
                    return (
                      <tr key={c.id} className="clickable"
                        onClick={()=>{ setSelected(c); setCustTab("overview"); setShowDeleteConfirm(false); }}
                        style={{ cursor:"pointer", background: selected?.id===c.id ? "#f4f8fd" : undefined }}>
                        <td style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={c.company}>
                          <span style={{ display:"inline-flex", alignItems:"center", gap:9, minWidth:0, maxWidth:"100%" }}>
                            <span style={{ width:28, height:28, borderRadius:8, flexShrink:0, background:c.color||PRIMARY, color:"#fff",
                              display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:"0.62rem", fontWeight:800, overflow:"hidden" }}>
                              {c.logo ? <img src={c.logo} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/> : c.initials}
                            </span>
                            <span style={{ fontWeight:700, color:STEEL, overflow:"hidden", textOverflow:"ellipsis" }}>{c.company}</span>
                          </span>
                        </td>
                        <td title={c.name} style={{ color:"#374151", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.name || "—"}</td>
                        <td style={{ color:"#374151", whiteSpace:"nowrap" }}>{c.phone || "—"}</td>
                        <td style={{ color:"#374151", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.province || "—"}</td>
                        <td title={cat} style={{ overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>
                          <span className="badge" style={{ background:"#eef3f8", color:PRIMARY }}>{cat}</span>
                        </td>
                        <td className="num" style={{ fontWeight:800, color:PRIMARY, fontVariantNumeric:"tabular-nums", whiteSpace:"nowrap" }}>{fmtMoney(sales)}</td>
                        <td className="num" style={{ fontWeight:700, color: projects?STEEL:"#9ca3af", fontVariantNumeric:"tabular-nums" }}>{projects || "—"}</td>
                        <td style={{ color:MUTED, fontSize:"0.78rem", whiteSpace:"nowrap" }}>{fmtDate(lastActivityFor(c.id,c.joinDate,quotations))}</td>
                        <td onClick={e=>e.stopPropagation()}>
                          <div style={{ display:"flex", justifyContent:"flex-end" }}>
                            <button title="ดูรายละเอียด"
                              onClick={()=>{ setSelected(c); setCustTab("overview"); setShowDeleteConfirm(false); }}
                              style={{ width:28, height:28, borderRadius:7, border:"1px solid #dbe3ec", background:"#fff", color:PRIMARY, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                              <Eye size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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
        // สินค้าที่ซื้อ — จากใบเสนอราคาที่ปิด · ไม่มี → ใช้แม่แบบที่ลูกค้าซื้อ (มาจากลีด)
        // โครงการที่ซื้อไปแล้ว (ใบเสนอราคาที่ปิดการขาย) — จัดกลุ่มตามแม่แบบ
        const purchasedGroups = purchasedGroupsFor(selected.id, quotations);
        // การ์ด = 1 ใบต่อ 1 งานที่ปิดการขาย · เรียงวันปิดล่าสุดขึ้นก่อน (ข้ามแม่แบบ)
        // เดิมเรียงตามกลุ่มแม่แบบ → งานใหม่ของแม่แบบที่ยอดน้อยจะไปจมท้ายรายการ
        const purchasedRows = purchasedGroups
          .flatMap(g => g.projects.map(q => ({ q, template: g.template })))
          .sort((a,b) => a.q.date < b.q.date ? 1 : -1);
        const purchasedTotal = purchasedRows.reduce((s,r)=>s+r.q.totalValue,0);
        // รหัสลูกค้า = รูปแบบแสดงผลของ id จริง (ไม่ใช่ฟิลด์ใหม่)
        const custCode = customerCode(currentDealer.code, selected.id); // แหล่งเดียวกับฝั่ง HQ

        // ตารางประวัติการปิดการขาย — # / เลขที่ใบ / ชื่องาน+รูปแม่แบบ / วันที่ซื้อ / ราคา / ดู · ปิดท้ายด้วยแถวรวม
        // ไม่มีคอลัมน์ "สถานะ" (บอสสั่งตัด — สถานะแบบ โอน/ผ่อน/จอง เป็นของธุรกิจอสังหา ระบบนี้ไม่มี)
        const purchasedTable = (
          <>
            <div style={{...secLabel, marginBottom:12}}><Layers size={13} color={PRIMARY}/> ประวัติการปิดการขาย ({purchasedRows.length})</div>
            {purchasedRows.length===0 ? (
              <div style={{fontSize:"0.8rem",color:MUTED,textAlign:"center",padding:"20px 0"}}>
                ยังไม่มีโครงการที่ปิดการขาย — จะขึ้นที่นี่เมื่อใบเสนอราคาถูกตอบรับ
              </div>
            ) : (
              <>
                {/* การ์ด = 1 ใบต่อ "แม่แบบ" ไม่ใช่ต่องาน — แม่แบบเดียวอาจมีหลายงาน (v1…v30)
                    ถ้าแตกเป็นการ์ดต่องาน พอมี 30 งานจะกลายเป็น 30 การ์ด หายากกว่าเดิม (บอสทัก)
                    มีงานเดียว → กดแล้วเข้าเลย · หลายงาน → กดแล้วเปิดตัวเลือกให้เลือกก่อน */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:12}}>
                  {purchasedGroups.map(g=>{
                    const many = g.projects.length > 1;
                    const latest = g.projects[0]; // เรียงวันที่ล่าสุดก่อนแล้วใน purchasedGroupsFor
                    return (
                      <button key={g.template}
                        onClick={()=> many ? setPickGroup(g) : setViewProject({q:latest,template:g.template})}
                        title={many ? `${g.template} — ${g.projects.length} งาน (กดเพื่อเลือก)` : latest.project}
                        style={{border:"1px solid #eef1f5",borderRadius:12,overflow:"hidden",background:"#fff",padding:0,
                          cursor:"pointer",textAlign:"left",fontFamily:"inherit",display:"flex",flexDirection:"column"}}
                        onMouseEnter={e=>{ (e.currentTarget as HTMLElement).style.borderColor="rgba(0,51,102,.25)"; }}
                        onMouseLeave={e=>{ (e.currentTarget as HTMLElement).style.borderColor="#eef1f5"; }}>
                        <span style={{position:"relative",display:"block",height:104,background:"#eaf1fb"}}>
                          <TemplateHero name={g.template} />
                          {many && (
                            <span style={{position:"absolute",top:8,right:8,background:PRIMARY,color:"#fff",borderRadius:99,
                              padding:"3px 9px",fontSize:"0.62rem",fontWeight:800}}>{g.projects.length} งาน</span>
                          )}
                        </span>
                        <span style={{padding:"10px 12px",display:"block",minWidth:0}}>
                          <span style={{display:"block",fontSize:"0.78rem",fontWeight:700,color:STEEL,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={g.template}>{g.template}</span>
                          <span style={{display:"block",fontSize:"0.66rem",color:MUTED,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginTop:2}}>
                            {many ? `ล่าสุด ${fmtDate(latest.date)}` : latest.project}
                          </span>
                          <span style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:6,marginTop:6}}>
                            <span style={{fontSize:"0.62rem",color:"#8a929c",whiteSpace:"nowrap"}}>{many ? "รวมทุกงาน" : fmtDate(latest.date)}</span>
                            <span style={{fontSize:"0.72rem",fontWeight:800,color:PRIMARY,fontVariantNumeric:"tabular-nums",whiteSpace:"nowrap"}}>{fmtMoney(g.total)}</span>
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",borderTop:"1px solid #eef1f5",marginTop:12,paddingTop:10}}>
                  <span style={{fontSize:"0.75rem",color:"#8a929c",fontWeight:700}}>รวมมูลค่าทั้งหมด</span>
                  <span style={{fontSize:"0.95rem",fontWeight:800,color:PRIMARY,fontVariantNumeric:"tabular-nums"}}>{fmtMoney(purchasedTotal)}</span>
                </div>
              </>
            )}
          </>
        );
        const timelineItems = activityItemsFor(selected.id, selected.joinDate, quotations, allLeadsRaw);

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
                {/* หัว = ลบ · ปิด (ปุ่ม "โทร" เอาออกตามที่บอสสั่ง — เบอร์อยู่ใต้ชื่อแล้ว) */}
                <div style={{display:"flex",alignItems:"center",gap:7,flexShrink:0}}>
                  <button title="ลบลูกค้า" onClick={()=>setShowDeleteConfirm(true)} style={{...qa,width:30,padding:0,justifyContent:"center",color:"#fecaca"}}><Trash2 size={14}/></button>
                  <button onClick={()=>setSelected(null)} title="ปิด" style={{...qa,width:30,padding:0,justifyContent:"center"}}><X size={15}/></button>
                </div>
              </div>
              {/* Badges: แม่แบบ · ยอดขายรวม */}
              <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginTop:12}}>
                {selected.category && <span style={{display:"flex",alignItems:"center",gap:4,padding:"2px 10px",borderRadius:99,fontSize:"0.65rem",fontWeight:700,background:"rgba(255,255,255,.18)",color:"#fff"}}><Building2 size={11}/> {selected.category}</span>}
                <span style={{display:"flex",alignItems:"center",gap:4,padding:"2px 10px",borderRadius:99,fontSize:"0.65rem",fontWeight:800,background:"#fff",color:PRIMARY}}><Coins size={11}/> {fmtMoney(totalSales)}</span>
              </div>
            </div>

            {/* Tab bar — ภาพรวม / ดีล / ใบเสนอราคา / ไทม์ไลน์ (มาตรฐานเดียวกับหน้าลูกค้าเป้าหมาย) */}
            <div style={{ display:"flex", borderBottom:"1px solid #e5e7eb", background:"#fff", flexShrink:0, padding:"0 8px" }}>
              {/* 2 แท็บ: ข้อมูลลูกค้า (มีตารางประวัติการปิดการขาย) · เพิ่มงานขายใหม่ (ดีลของลูกค้ารายนี้ + ปุ่มสร้าง) */}
              {([["overview","ข้อมูลลูกค้า"],["deals","เพิ่มงานขายใหม่"]] as ["overview"|"deals",string][]).map(([k,label])=>(
                <button key={k} onClick={()=>setCustTab(k)}
                  style={{ padding:"11px 14px", border:"none", borderBottom:`2px solid ${custTab===k?PRIMARY:"transparent"}`, background:"transparent", cursor:"pointer", fontFamily:"inherit", fontSize:"0.8rem", fontWeight:custTab===k?800:600, color:custTab===k?PRIMARY:"#6b7280", marginBottom:-1 }}>{label}</button>
              ))}
            </div>

            {/* Body — เนื้อหาตามแท็บ */}
            <div style={{ flex:1, overflowY:"auto", background:"#f5f7fa" }}>

              {/* ── ข้อมูลลูกค้า (แท็บแรก) = ข้อมูลลูกค้า + ตารางประวัติการปิดการขาย ── */}
              <div style={{ padding:16, display:custTab==="overview"?"flex":"none", flexDirection:"column", gap:14 }}>
                <div style={cardStyle}>
                  {/* แก้ไขได้ในที่เดิมตลอดเวลา — ปุ่มสลับโหมด "แก้ไขข้อมูล" ถูกถอดออก (บอสสั่ง 17 ก.ค. 69 · มาตรฐานเดียวกับหน้าลีด)
                      หัวการ์ด (ยอดขายรวม + ป้ายแม่แบบ) เป็นค่าที่ระบบคำนวณ คงไว้เหนือฟอร์ม · สถานะย้ายไปเป็นดรอปดาวน์ในฟอร์ม */}
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:2}}>
                    <div style={{...secLabel,marginBottom:0}}><User size={13} color={PRIMARY}/> ข้อมูลลูกค้า</div>
                  </div>
                  <div style={{fontSize:"0.62rem",color:"#8a929c",fontWeight:700}}>ยอดขายรวม</div>
                  <div style={{fontSize:"1.5rem",fontWeight:800,color:PRIMARY,fontVariantNumeric:"tabular-nums",lineHeight:1.2}}>{fmtMoney(totalSales)}</div>
                  <div style={{display:"flex",gap:6,marginTop:8,marginBottom:12,flexWrap:"wrap"}}>
                    {selected.category && <span style={{padding:"3px 10px",borderRadius:99,fontSize:"0.65rem",fontWeight:700,background:"#eef3f8",color:PRIMARY}}>{selected.category}</span>}
                  </div>
                  <CustomerOverviewEditor customer={selected} code={custCode} onSave={saveInline} />
                </div>

                {/* ประวัติการปิดการขาย — ตารางพร้อมรูปแม่แบบ + แถวรวมมูลค่า
                    ยังไม่มีโครงการ = ไม่ต้องโชว์การ์ดเปล่า (ดูได้ที่แท็บ "ประวัติการปิดการขาย") */}
                {purchasedRows.length>0 && <div style={cardStyle}>{purchasedTable}</div>}
              </div>

              {/* ── ดีล/โครงการ ── */}
              <div style={{ padding:16, display:custTab==="deals"?"flex":"none", flexDirection:"column", gap:14 }}>
                {/* ตารางประวัติการปิดการขายอยู่ในแท็บ "ข้อมูลลูกค้า" ที่เดียว (บอสสั่งไม่ให้ซ้ำที่นี่)
                    แท็บนี้ = ดีลทั้งหมดของลูกค้า รวมที่ยังไม่ปิดการขาย */}
                <div style={cardStyle}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                    <div style={{...secLabel,marginBottom:0}}><Layers size={13} color={PRIMARY}/> งานขายทั้งหมด ({projectCount})</div>
                    <button onClick={()=>openNewDeal(selected)} className="btn btn-primary btn-sm"><Plus size={13}/> เพิ่มงานขายใหม่</button>
                  </div>
                  {projectCount===0?(
                    <div style={{fontSize:"0.8rem",color:MUTED,textAlign:"center",padding:"24px 0"}}>ยังไม่มีโครงการ — กด &ldquo;เพิ่มงานขายใหม่&rdquo; เพื่อเริ่มโครงการแรก</div>
                  ):(
                    <div style={{display:"flex",flexDirection:"column",gap:8}}>
                      {/* ── ประวัติการปิดการขาย (ใบเสนอราคาที่ปิดการขาย) ── */}
                      {wonProjects.map(q=>(
                        <div key={q.id}
                          style={{display:"flex",flexDirection:"column",gap:6,padding:"10px 12px",borderRadius:10,background:"#f8f9fb",border:"1px solid #eef0f4",width:"100%"}}>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <span style={{fontSize:"0.8rem",fontWeight:800,color:STEEL,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{q.project}</span>
                            <span className="badge" style={{flexShrink:0,background:"#e5faf0",color:"#059669"}}>ซื้อแล้ว</span>
                          </div>
                          <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",fontSize:"0.65rem",color:MUTED}}>
                            <span>{q.buildingType}</span>
                            <span style={{color:PRIMARY,fontWeight:700}}>{q.total}</span>
                            <span>ใบเสนอราคา: {q.id}</span>
                            <span>ปิดการขาย: {fmtDate(q.date)}</span>
                          </div>
                        </div>
                      ))}
                      {/* ── โครงการที่กำลังทำ (ลีดที่ยังไม่ปิดการขาย) ── */}
                      {activeDeals.map(d=>{
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
                {/* การ์ด "โครงการที่กำลังเริ่ม" เอาออกตามที่บอสสั่ง — มันโชว์ลีดชุดเดียวกับการ์ด
                    "งานขายทั้งหมด" ข้างบน กลายเป็นตัวเดิมซ้ำบน-ล่าง · ตอนนี้การ์ดเดียวรวมครบแล้ว
                    (ซื้อแล้ว = ใบที่ปิดการขาย · กำลังทำ = ลีดที่ยังไม่ปิด) */}
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
                        const c=noteColorOf(n.category);
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

            {/* แถบปุ่มล่าง — พิมพ์ข้อมูล · ปิด (ปุ่มแก้ไข/สร้างดีล เอาออกตามที่บอสสั่ง
                — แก้ไขยังทำได้จากปุ่มดินสอในการ์ดข้อมูลลูกค้า · สร้างดีลใหม่อยู่ในแท็บโครงการ) */}
            <div style={{ display:"flex", justifyContent:"flex-end", gap:8, padding:"12px 20px", borderTop:"1px solid #e5e7eb", background:"#fff", flexShrink:0 }}>
              <button onClick={()=>printCustomer(selected, purchasedRows, custCode)} className="btn btn-secondary btn-md" style={{ color:PRIMARY }}>
                <Printer size={14}/> พิมพ์ข้อมูล
              </button>
              <button onClick={()=>setSelected(null)} className="btn btn-primary btn-md">ปิด</button>
            </div>

          </div>
        </>
        );
      })()}

      {/* ══ เลือกงาน — เปิดเมื่อกดการ์ดแม่แบบที่มีหลายงาน ══════════════════════ */}
      {pickGroup && (
        <>
          <div onClick={()=>setPickGroup(null)} style={{position:"fixed",inset:0,background:"rgba(45,45,45,.5)",zIndex:240}}/>
          <div style={{position:"fixed",inset:0,zIndex:241,display:"flex",alignItems:"center",justifyContent:"center",padding:20,pointerEvents:"none"}}>
            {/* จัดกลางด้วย flex → ต้องใช้ modal-pop-flex (modal-pop มี translate ข้างใน จะเลื่อนออกนอกกลาง) */}
            <div className="modal-pop-flex" style={{background:"#fff",borderRadius:16,width:"100%",maxWidth:560,pointerEvents:"auto",
              overflow:"hidden",boxShadow:"0 24px 80px rgba(0,0,0,.22)",display:"flex",flexDirection:"column",maxHeight:"80vh"}}>
              <div style={{background:PRIMARY,padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
                <span style={{minWidth:0}}>
                  <span style={{display:"block",fontSize:"0.92rem",fontWeight:800,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{pickGroup.template}</span>
                  <span style={{display:"block",fontSize:"0.68rem",color:"rgba(255,255,255,.75)",marginTop:2}}>
                    {pickGroup.projects.length} งาน · รวม {fmtMoney(pickGroup.total)} — เลือกงานที่ต้องการดู
                  </span>
                </span>
                <button onClick={()=>setPickGroup(null)} title="ปิด"
                  style={{width:30,height:30,borderRadius:8,border:"1px solid rgba(255,255,255,.2)",background:"rgba(255,255,255,.12)",
                    color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><X size={14}/></button>
              </div>
              <div style={{padding:16,overflowY:"auto",display:"flex",flexDirection:"column",gap:8}}>
                {pickGroup.projects.map(q=>(
                  <button key={q.id}
                    onClick={()=>{ setViewProject({q,template:pickGroup.template}); setPickGroup(null); }}
                    style={{display:"flex",alignItems:"center",gap:12,padding:"11px 13px",borderRadius:11,border:`1px solid ${BORDER}`,
                      background:"#fff",cursor:"pointer",textAlign:"left",fontFamily:"inherit",width:"100%"}}
                    onMouseEnter={e=>{ (e.currentTarget as HTMLElement).style.background="#f4f8fd"; }}
                    onMouseLeave={e=>{ (e.currentTarget as HTMLElement).style.background="#fff"; }}>
                    <span style={{flex:1,minWidth:0}}>
                      <span style={{display:"block",fontSize:"0.82rem",fontWeight:700,color:STEEL,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{q.project}</span>
                      <span style={{display:"block",fontSize:"0.66rem",color:MUTED,marginTop:3}}>
                        {q.id} · ปิดการขาย {fmtDate(q.date)}{q.area?` · ${q.area.toLocaleString()} ตร.ม.`:""}
                      </span>
                    </span>
                    <span style={{fontSize:"0.86rem",fontWeight:800,color:PRIMARY,fontVariantNumeric:"tabular-nums",whiteSpace:"nowrap",flexShrink:0}}>{fmtMoney(q.totalValue)}</span>
                    <ChevronRight size={15} color={PRIMARY} style={{flexShrink:0}}/>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ══ PROJECT DETAIL — คลิกโครงการในตาราง "ประวัติการปิดการขาย" ══════════
          ซ้าย = ภาพแม่แบบใหญ่ · ขวา = ข้อมูลทุกอย่างของโครงการนั้น
          ทุกอย่างมาจากใบเสนอราคาที่ปิดการขาย + ดีลที่ผูกอยู่ (ไม่มีข้อมูล = "—") */}
      {viewProject && selected && (() => {
        const { q, template } = viewProject;
        const cardS: React.CSSProperties = { background:"#fff", border:"1px solid #eef1f5", borderRadius:14, padding:16 };
        const secL: React.CSSProperties = { display:"flex", alignItems:"center", gap:6, fontSize:"0.62rem", fontWeight:800, color:"#8a929c", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:12 };
        const sc = quotationStatusColor[q.status];
        // BOQ — ใบที่ไม่มี lineItems เก็บไว้ ใช้ materialCost ปั้นเป็นรายการเดียว (ตรรกะเดียวกับหน้าใบเสนอราคา)
        const lis: QuoteLineItem[] = boqLineItems(q);
        const boqTotal = boqSubtotal(lis);
        const vatPct = hqPolicy.vat;   // VAT = นโยบาย HQ (ตัวแทนตั้งเองไม่ได้ · อ่านผ่าน repo)
        // ดีลที่ผูกกับใบนี้ → ไทม์ไลน์กิจกรรมจริงของดีล
        const deal = customerDeals.find(l => (q.dealId!=null && l.numId===q.dealId)) ?? customerDeals.find(l=>l.company===q.customer);
        const acts = deal?.activities ?? [];
        const projNotes = relatedNotes;
        const projAppts = relatedAppointments;

        return (
          <>
            <div onClick={()=>setViewProject(null)} style={{position:"fixed",inset:0,background:"rgba(45,45,45,.5)",zIndex:240}}/>
            <div className="modal-pop" style={{position:"fixed",top:"50%",left:"50%",transform:"translate(-50%,-50%)",
              width:1040, maxWidth:"calc(100vw - 24px)", height:"min(900px, calc(100vh - 24px))",
              zIndex:250, background:"#fff", boxShadow:"0 30px 90px rgba(0,0,0,.34)", borderRadius:18,
              display:"flex", flexDirection:"column", overflow:"hidden"}}>

              {/* หัว */}
              <div style={{background:PRIMARY,padding:"13px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexShrink:0}}>
                <div style={{minWidth:0}}>
                  <div style={{fontSize:"1rem",fontWeight:800,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{q.project}</div>
                  <div style={{fontSize:"0.72rem",color:"rgba(255,255,255,.72)",marginTop:2}}>{selected.company} · {q.id}</div>
                </div>
                <button onClick={()=>setViewProject(null)} title="ปิด"
                  style={{width:30,height:30,borderRadius:8,background:"rgba(255,255,255,.15)",border:"none",color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <X size={15}/>
                </button>
              </div>

              {/* ซ้าย: ภาพแม่แบบใหญ่ · ขวา: ข้อมูลทั้งหมด */}
              <div className="proj-shell" style={{flex:1,minHeight:0,display:"grid",gridTemplateColumns:"320px minmax(0,1fr)",background:"#f5f7fa"}}>
                <div style={{padding:16,borderRight:"1px solid #e9edf2",display:"flex",flexDirection:"column",gap:12,overflowY:"auto"}}>
                  <div style={{...cardS,padding:0,overflow:"hidden"}}>
                    <div style={{position:"relative",height:190,background:"#eaf1fb"}}>
                      <TemplateHero name={template} />
                    </div>
                    <div style={{padding:"12px 14px"}}>
                      <div style={{fontSize:"0.9rem",fontWeight:800,color:STEEL}}>{template}</div>
                      <div style={{fontSize:"0.72rem",color:MUTED,marginTop:2}}>{selected.company}</div>
                    </div>
                  </div>
                  <div style={cardS}>
                    {([
                      ["สถานะ", ""], ["วันที่ซื้อ", fmtDate(q.date)],
                      ["พื้นที่", q.area>0 ? `${q.area.toLocaleString()} ตร.ม.` : "—"],
                    ] as [string,string][]).map(([k,v])=>(
                      <div key={k} style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center",padding:"7px 0",borderBottom:"1px solid #f4f6f9",fontSize:"0.75rem"}}>
                        <span style={{color:"#8a929c",flexShrink:0}}>{k}</span>
                        {k==="สถานะ"
                          ? <span className="badge" style={{background:sc.bg,color:sc.text}}>{quotationStatusLabel[q.status]}</span>
                          : <span style={{fontWeight:700,color:STEEL,textAlign:"right",minWidth:0,wordBreak:"break-word"}}>{v}</span>}
                      </div>
                    ))}
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",paddingTop:10}}>
                      <span style={{fontSize:"0.72rem",color:"#8a929c"}}>มูลค่างาน</span>
                      <span style={{fontSize:"1.1rem",fontWeight:800,color:PRIMARY,fontVariantNumeric:"tabular-nums"}}>{fmtMoney(q.totalValue)}</span>
                    </div>
                  </div>
                </div>

                <div style={{padding:16,display:"flex",flexDirection:"column",gap:14,overflowY:"auto"}}>

                  {/* รายละเอียดเอกสาร — ชุดเดียวกับหน้าใบเสนอราคา (ไม่มีข้อมูล = "—" ไม่เดา) */}
                  <div style={cardS}>
                    <div style={secL}><FileText size={13} color={PRIMARY}/> รายละเอียดเอกสาร</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 24px"}}>
                      {([
                        ["จังหวัด", q.province || "—"],
                        ["ประเภทอาคาร", q.buildingType || "—"],
                        ["พื้นที่", q.area ? `${q.area.toLocaleString()} ตร.ม.` : "—"],
                        ["จำนวนรายการ", `${lis.length} รายการ`],
                        ["วันที่ออก", fmtDate(q.date)],
                        ["วันหมดอายุ", q.expiry ? fmtDate(q.expiry) : "—"],
                      ] as [string,string][]).map(([k,v])=>(
                        <div key={k} style={{display:"flex",justifyContent:"space-between",gap:10,padding:"7px 0",borderBottom:"1px solid #f0f4f8",fontSize:"0.76rem"}}>
                          <span style={{color:"#8a929c"}}>{k}</span>
                          <span style={{fontWeight:700,color:STEEL,textAlign:"right"}}>{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ไฟล์ของลูกค้ารายนี้ + แนบเพิ่ม — ใช้คลังไฟล์ตัวเดียวกับหน้าไฟล์ (addDealerFile) */}
                  <div style={cardS}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                      <div style={{...secL,marginBottom:0}}><Paperclip size={13} color={PRIMARY}/> ไฟล์ ({selectedFiles.length})</div>
                      <button onClick={()=>fileInputRef.current?.click()} className="btn btn-secondary btn-sm" style={{color:PRIMARY}}>
                        <Plus size={12}/> แนบไฟล์
                      </button>
                    </div>
                    {selectedFiles.length===0 ? (
                      <div style={{fontSize:"0.78rem",color:MUTED}}>— ยังไม่มีไฟล์แนบ</div>
                    ) : (
                      <div style={{display:"flex",flexDirection:"column",gap:5}}>
                        {selectedFiles.map(f=>(
                          <button key={f.id} onClick={()=>setPreviewFile(f)} title="กดเพื่อดูไฟล์"
                            style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"7px 10px",borderRadius:9,
                              border:`1px solid ${BORDER}`,background:"#fff",cursor:"pointer",textAlign:"left",fontFamily:"inherit"}}>
                            <Paperclip size={12} color={MUTED} style={{flexShrink:0}}/>
                            <span style={{flex:1,minWidth:0,fontSize:"0.74rem",fontWeight:700,color:STEEL,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.name}</span>
                            <span style={{fontSize:"0.65rem",color:MUTED,flexShrink:0}}>{f.size}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* ไทม์ไลน์ของดีลที่ผูกกับใบนี้ */}
                  <div style={cardS}>
                    <div style={secL}><CalendarClock size={13} color={PRIMARY}/> ไทม์ไลน์ที่เกี่ยวข้อง</div>
                    {acts.length===0 ? (
                      <div style={{fontSize:"0.78rem",color:MUTED}}>— ไม่มีบันทึกกิจกรรมของดีลนี้</div>
                    ) : (
                      <div style={{display:"flex",flexDirection:"column",gap:10}}>
                        {acts.map(a=>(
                          <div key={a.id} style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                            <span style={{width:8,height:8,borderRadius:"50%",background:PRIMARY,flexShrink:0,marginTop:5}}/>
                            <div style={{minWidth:0}}>
                              <div style={{fontSize:"0.78rem",color:STEEL}}>{a.text}</div>
                              <div style={{fontSize:"0.65rem",color:MUTED}}>{a.date}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* รายงานติดตามของดีลนี้ — แก้ได้ (เก็บที่ LeadRow.report ของดีลที่ผูกกับใบนี้) */}
                  <div style={cardS}>
                    {deal
                      ? <ReportEditor lead={deal} onSave={updateLead} />
                      : <><div style={secL}><StickyNote size={13} color={PRIMARY}/> รายงานติดตาม</div>
                          <div style={{fontSize:"0.78rem",color:MUTED}}>— ใบนี้ไม่ได้ผูกกับดีลในระบบ จึงยังไม่มีที่เก็บรายงาน</div></>}
                  </div>

                  {/* โน้ต / รายงานติดตาม ของลูกค้ารายนี้ */}
                  <div style={cardS}>
                    <div style={secL}><StickyNote size={13} color={PRIMARY}/> โน้ต / รายงานติดตาม</div>
                    {projNotes.length===0 ? (
                      <div style={{fontSize:"0.78rem",color:MUTED}}>— ยังไม่มีโน้ต</div>
                    ) : projNotes.map(n=>(
                      <div key={n.id} style={{borderLeft:`3px solid ${n.color||PRIMARY}`,paddingLeft:10,marginBottom:10}}>
                        <div style={{display:"flex",justifyContent:"space-between",gap:8}}>
                          <span style={{fontSize:"0.78rem",fontWeight:700,color:STEEL}}>{n.title}</span>
                          <span style={{fontSize:"0.65rem",color:MUTED,flexShrink:0}}>{n.updatedAt||n.createdAt}</span>
                        </div>
                        <div style={{fontSize:"0.72rem",color:"#374151",whiteSpace:"pre-line",lineHeight:1.6,marginTop:3}}>{n.content}</div>
                      </div>
                    ))}
                  </div>

                  {/* นัดหมายของลูกค้ารายนี้ */}
                  <div style={cardS}>
                    <div style={secL}><Calendar size={13} color={PRIMARY}/> นัดหมาย</div>
                    {projAppts.length===0 ? (
                      <div style={{fontSize:"0.78rem",color:MUTED}}>— ยังไม่มีนัดหมาย</div>
                    ) : projAppts.map(a=>(
                      <div key={a.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid #f4f6f9"}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:"0.78rem",fontWeight:700,color:STEEL,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.project}</div>
                          <div style={{fontSize:"0.65rem",color:MUTED}}>{apptTypeLabel[a.type]} · {fmtDate(a.date)} · {a.time} น.</div>
                        </div>
                        <span className="badge" style={{background:a.status==="upcoming"?"#fff8e1":a.status==="done"?"#e5faf0":"#f0f0f5",color:a.status==="upcoming"?"#b7892a":a.status==="done"?"#059669":"#9ca3af",flexShrink:0}}>
                          {a.status==="upcoming"?"กำลังจะถึง":a.status==="done"?"เสร็จแล้ว":"ยกเลิก"}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* ใบเสนอราคา + BOQ */}
                  <div style={cardS}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                      <div style={{...secL,marginBottom:0}}><FileText size={13} color={PRIMARY}/> ใบเสนอราคา</div>
                      <button onClick={()=>printQuotation(q,{ company:selected.company, name:selected.name, phone:selected.phone, province:selected.province }, hqPolicy.vat)}
                        className="btn btn-secondary btn-sm" style={{color:PRIMARY}}><Printer size={12}/> พิมพ์ PDF</button>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4px 20px",marginBottom:12}}>
                      {([
                        ["เลขที่", q.id], ["ลูกค้า", selected.name||"—"],
                        ["บริษัท", selected.company], ["โทร", selected.phone||"—"],
                        ["อีเมล", selected.email||"—"], ["จังหวัด", q.province||selected.province],
                        ["แม่แบบ", q.buildingType||"—"], ["ผู้รับผิดชอบ", selected.owner||"—"],
                      ] as [string,string][]).map(([k,v])=>(
                        <div key={k} style={{display:"flex",gap:8,padding:"5px 0",fontSize:"0.75rem",minWidth:0}}>
                          <span style={{color:"#8a929c",flex:"0 0 78px"}}>{k}</span>
                          <span style={{fontWeight:700,color:STEEL,flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={v}>{v}</span>
                        </div>
                      ))}
                    </div>
                    {/* รายการสินค้า (BOQ) */}
                    <div className="table-wrap" style={{border:"1px solid #eef1f5",borderRadius:10,overflow:"hidden"}}>
                      <table>
                        <colgroup>
                          <col style={{width:"40%",minWidth:150}} /><col style={{width:"14%",minWidth:70}} />
                          <col style={{width:"14%",minWidth:70}} /><col style={{width:"16%",minWidth:90}} />
                          <col style={{width:"16%",minWidth:90}} />
                        </colgroup>
                        <thead><tr><th>รายการ</th><th className="num">จำนวน</th><th>หน่วย</th><th className="num">ราคา/หน่วย</th><th className="num">รวม</th></tr></thead>
                        <tbody>
                          {lis.length===0 ? (
                            <tr><td colSpan={5} style={{textAlign:"center",padding:"18px",color:MUTED,fontSize:"0.78rem"}}>— ใบนี้ไม่มีรายการสินค้าบันทึกไว้</td></tr>
                          ) : lis.map((li,i)=>(
                            <tr key={i}>
                              <td style={{fontWeight:700,color:STEEL,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={li.name}>{li.name}</td>
                              <td className="num">{li.qty.toLocaleString()}</td>
                              <td style={{color:MUTED}}>{li.unit}</td>
                              <td className="num">{li.unitPrice.toLocaleString()}</td>
                              <td className="num" style={{fontWeight:700}}>{fmtMoney(li.qty*li.unitPrice)}</td>
                            </tr>
                          ))}
                          {/* ยอดท้าย BOQ ให้ครบเหมือนหน้าใบเสนอราคา — VAT อ่านจากนโยบาย HQ (แหล่งเดียว ไม่ hardcode) */}
                          {lis.length>0 && (
                            <>
                              <tr>
                                <td colSpan={4} style={{textAlign:"right",color:MUTED,background:"#f8fafc"}}>{lis.length} รายการ · ยอดรวมย่อย</td>
                                <td className="num" style={{fontWeight:700,color:STEEL,background:"#f8fafc"}}>{fmtMoney(boqTotal)}</td>
                              </tr>
                              <tr>
                                <td colSpan={4} style={{textAlign:"right",color:MUTED,background:"#f8fafc"}}>VAT {vatPct}%</td>
                                <td className="num" style={{color:STEEL,background:"#f8fafc"}}>{fmtMoney(Math.round(boqTotal*vatPct/100))}</td>
                              </tr>
                              <tr>
                                <td colSpan={4} style={{textAlign:"right",fontWeight:800,color:STEEL,background:"#f8fafc"}}>ยอดรวมสุทธิ (รวม VAT)</td>
                                <td className="num" style={{fontWeight:800,color:PRIMARY,background:"#f8fafc"}}>{fmtMoney(boqTotal + Math.round(boqTotal*vatPct/100))}</td>
                              </tr>
                            </>
                          )}
                        </tbody>
                      </table>
                    </div>
                    {q.note && (
                      <div style={{marginTop:12,fontSize:"0.75rem",color:"#374151",lineHeight:1.6}}>
                        <span style={{color:"#8a929c"}}>หมายเหตุ: </span>{q.note}
                      </div>
                    )}
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
                      <thead><tr style={{background:"#f8f9fb"}}>{["บริษัท","ผู้ติดต่อ","จังหวัด","แม่แบบ"].map(h=><th key={h} style={{textAlign:"left",padding:"7px 10px",color:MUTED,fontWeight:700,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                      <tbody>
                        {importRows.map((r,i)=>(
                          <tr key={i} style={{borderTop:`1px solid ${BORDER}`}}>
                            <td style={{padding:"7px 10px",fontWeight:700,color:STEEL}}>{r.company}</td>
                            <td style={{padding:"7px 10px",color:MUTED}}>{r.name||"—"}</td>
                            <td style={{padding:"7px 10px",color:MUTED}}>{r.province}</td>
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
                <div style={{fontSize:"0.92rem",fontWeight:800}}>เพิ่มงานขายใหม่</div>
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
              <div><label className="form-label">ผู้รับผิดชอบ</label>
                <PersonPicker value={dealForm.assigned} onChange={v=>setDealForm(f=>({...f,assigned:v}))} multiple /></div>
              <div><label className="form-label">หมายเหตุ</label>
                <textarea className="form-input" rows={2} style={{resize:"vertical"}} value={dealForm.note} onChange={e=>setDealForm(f=>({...f,note:e.target.value}))} placeholder="รายละเอียดเพิ่มเติม..." /></div>
              <div style={{fontSize:"0.65rem",color:"#9ca3af"}}>โครงการใหม่เริ่มที่สเตจ &ldquo;ติดต่อแล้ว&rdquo; ในบอร์ด pipeline · นับรวมใน Dashboard/รายงานทันที · เปิดรายละเอียดให้เลย</div>
            </div>
            <div style={{padding:"14px 20px",borderTop:`1px solid ${BORDER}`,background:"#fafafa",display:"flex",justifyContent:"flex-end",gap:8}}>
              <button className="btn btn-secondary btn-md" onClick={()=>setShowNewDeal(false)}>ยกเลิก</button>
              <button className="btn btn-primary btn-md" onClick={createDeal} disabled={!dealForm.product}><Plus size={14}/> สร้างโครงการ</button>
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
              <span className="badge" style={{background:noteColorOf(viewNote.category).bg,color:noteColorOf(viewNote.category).text}}>{viewNote.category}</span>
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
