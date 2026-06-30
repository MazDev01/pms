"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  payments, invoices, projects, customers, contracts, tasks, quotations,
  projectStatusColor, projectStatusLabel,
  invoiceStatusLabel,
  taskStatusLabel, taskPriorityColor, taskPriorityLabel,
} from "@/lib/mock";
import { useFilters } from "@/context/FilterContext";
import { FilterBar } from "@/components/filters/FilterBar";

// ── Tokens ────────────────────────────────────────────────────
const CARD: React.CSSProperties = { background:"#fff", borderRadius:16, border:"1px solid #e5e7eb", boxShadow:"0 2px 14px rgba(0,0,0,.07)" };
const PRIMARY = "#003366";
const STEEL   = "#2D2D2D";
const SILVER  = "#C0C0C0";
const BORDER  = "#e5e7eb";
const SUB     = "#6b7280";

// ── Static chart data (pre-recorded monthly revenue) ─────────
type DataRow = { month:string; plan:number; actual:number; thMonth:string; date:string; };

const ALL_MONTHLY_DATA: DataRow[] = [
  { month:"ม.ค.", plan:120000, actual:95000,  thMonth:"มกราคม 2026",    date:"2026-01" },
  { month:"ก.พ.", plan:150000, actual:167800, thMonth:"กุมภาพันธ์ 2026", date:"2026-02" },
  { month:"มี.ค.",plan:180000, actual:162000, thMonth:"มีนาคม 2026",     date:"2026-03" },
  { month:"เม.ย.",plan:160000, actual:148400, thMonth:"เมษายน 2026",     date:"2026-04" },
  { month:"พ.ค.", plan:320000, actual:347300, thMonth:"พฤษภาคม 2026",    date:"2026-05" },
  { month:"มิ.ย.",plan:100000, actual:88500,  thMonth:"มิถุนายน 2026",   date:"2026-06" },
];
const JUNE_WEEKLY: DataRow[] = [
  { month:"สัปดาห์ 1", plan:25000, actual:22000, thMonth:"1–7 มิ.ย. 2026",   date:"2026-06" },
  { month:"สัปดาห์ 2", plan:28000, actual:31500, thMonth:"8–14 มิ.ย. 2026",  date:"2026-06" },
  { month:"สัปดาห์ 3", plan:26000, actual:21000, thMonth:"15–21 มิ.ย. 2026", date:"2026-06" },
  { month:"สัปดาห์ 4", plan:21000, actual:14000, thMonth:"22–30 มิ.ย. 2026", date:"2026-06" },
];

// ── Helpers ───────────────────────────────────────────────────
function fmtB(n:number):string{ if(n>=1e6) return `฿${(n/1e6).toFixed(2)}M`; if(n>=1000) return `฿${(n/1000).toFixed(0)}K`; return `฿${n.toLocaleString()}`; }
function fmtDiff(n:number):string{ const s=n>=0?"+":""; return `${s}${fmtB(n)}`; }
function getStatus(actual:number, plan:number){ const r=actual/plan; return r>=1?"above":r>=0.92?"near":"below"; }
const STATUS_BADGE: Record<string,{bg:string;text:string;label:string}> = {
  above:{ bg:"#e5faf0", text:"#059669", label:"เกินแผน" },
  near: { bg:"#fff3e0", text:"#f59e0b", label:"ใกล้เคียง" },
  below:{ bg:"#fee2e2", text:"#dc2626", label:"ต่ำกว่าแผน" },
};
// Get first and last day of range for preset labels
function monthYM(d:Date):string{ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; }
function toISO(d:Date):string{ return d.toISOString().split("T")[0]; }

// ── Report generators ─────────────────────────────────────────
type ReportType = "revenue"|"projects"|"customers"|"invoices";
function generateCSV(type:ReportType, displayData:DataRow[]){
  let header:string[], lines:string[];
  if(type==="revenue"){
    header=["เดือน","แผน","จริง","ผลต่าง","สถานะ"];
    lines=displayData.map(d=>[d.thMonth,fmtB(d.plan),fmtB(d.actual),fmtDiff(d.actual-d.plan),STATUS_BADGE[getStatus(d.actual,d.plan)].label].join(","));
  } else if(type==="projects"){
    header=["ID","ชื่อโอกาสการขาย","ลูกค้า","สถานะ","ความคืบหน้าการขาย","มูลค่า"];
    lines=projects.map(p=>[p.id,p.title,p.client,projectStatusLabel[p.status],p.progress+"%",p.value].join(","));
  } else if(type==="customers"){
    header=["ลูกค้า","จังหวัด","หมวด","มูลค่าสัญญา","โอกาสการขาย"];
    lines=customers.map(c=>{
      const val=contracts.filter(ct=>ct.client===c.company).reduce((s,ct)=>s+ct.value,0);
      return [c.company,c.province,c.category,fmtB(val),c.projectCount].join(",");
    });
  } else {
    header=["ID","ลูกค้า","โอกาสการขาย","งวด","ยอดรวม","สถานะ","ครบกำหนด"];
    lines=invoices.map(i=>[i.id,i.client,i.project,i.milestone,fmtB(i.total),invoiceStatusLabel[i.status],i.dueDate].join(","));
  }
  const blob=new Blob(["﻿"+[header.join(","),...lines].join("\n")],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=`report-${type}.csv`; a.click(); URL.revokeObjectURL(url);
}

// ── Charts ────────────────────────────────────────────────────
function niceGridVals(maxV:number):number[]{
  if(maxV<=0) return [50000,100000,150000];
  const rawStep=maxV/3.5;
  const mag=Math.pow(10,Math.floor(Math.log10(rawStep)));
  const step=Math.ceil(rawStep/mag)*mag;
  return [step,step*2,step*3].filter(v=>v<maxV*1.15);
}

function AreaChart({data}:{data:DataRow[]}){
  const [hover,setHover]=useState<{type:"actual"|"plan";idx:number}|null>(null);
  if(data.length===0) return <div style={{textAlign:"center",padding:"40px 0",color:SUB,fontSize:"0.82rem"}}>ไม่มีข้อมูลในช่วงที่เลือก</div>;
  const W=760; const H=200; const PL=60; const PR=24; const PT=20; const PB=30;
  const gW=W-PL-PR; const gH=H-PT-PB;
  const maxV=Math.max(...data.map(d=>Math.max(d.plan,d.actual)))*1.18||1;
  const n=data.length; const xOf=(i:number)=>n>1?PL+(i/(n-1))*gW:PL+gW/2;
  const yOf=(v:number)=>PT+gH-(v/maxV)*gH;
  const actualPts=data.map((d,i)=>`${xOf(i)},${yOf(d.actual)}`).join(" ");
  const planPts=data.map((d,i)=>`${xOf(i)},${yOf(d.plan)}`).join(" ");
  const areaPath=`M${xOf(0)},${yOf(data[0].actual)} `+data.map((d,i)=>`L${xOf(i)},${yOf(d.actual)}`).join(" ")+` L${xOf(n-1)},${PT+gH} L${xOf(0)},${PT+gH} Z`;
  const gridVals=niceGridVals(maxV);
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{display:"block",overflow:"visible",minWidth:320}}>
      <defs>
        <linearGradient id="rpt-ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={PRIMARY} stopOpacity="0.13"/><stop offset="100%" stopColor={PRIMARY} stopOpacity="0"/></linearGradient>
        <clipPath id="rpt-reveal">
          <rect x={PL} y="0" height={H} width="0">
            <animate attributeName="width" from="0" to={W-PL-PR} dur="1.1s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.4 0 0.2 1"/>
          </rect>
        </clipPath>
      </defs>
      {gridVals.map(v=><g key={v}><line x1={PL} x2={W-PR} y1={yOf(v)} y2={yOf(v)} stroke="#e8ecf0" strokeWidth="1.2"/><text x={PL-8} y={yOf(v)+4} textAnchor="end" fontSize={9} fill="#9ca3af" fontFamily="'Noto Sans Thai',sans-serif">{fmtB(v)}</text></g>)}
      <g clipPath="url(#rpt-reveal)">
        <path d={areaPath} fill="url(#rpt-ag)" className="chart-area-fill"/>
        {n>1&&<polyline points={planPts} fill="none" stroke={SILVER} strokeWidth="1.8" strokeDasharray="6,4"/>}
        {n>1&&<polyline points={actualPts} fill="none" stroke={PRIMARY} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>}
      </g>
      {data.map((d,i)=>(
        <g key={i}>
          <text x={xOf(i)} y={H-6} textAnchor="middle" fontSize={9.5} fill={i===n-1?PRIMARY:SUB} fontWeight={i===n-1?"700":"400"} fontFamily="'Noto Sans Thai',sans-serif">{d.month}</text>
          <circle className="chart-area-fill" cx={xOf(i)} cy={yOf(d.actual)} r={hover?.idx===i&&hover.type==="actual"?6:4} fill={hover?.idx===i&&hover.type==="actual"?PRIMARY:"#fff"} stroke={PRIMARY} strokeWidth="2" style={{cursor:"pointer"}} onMouseEnter={()=>setHover({type:"actual",idx:i})} onMouseLeave={()=>setHover(null)}/>
          {hover?.idx===i&&hover.type==="actual"&&(<g><rect x={xOf(i)-52} y={yOf(d.actual)-36} width={104} height={28} rx={7} fill="#003366"/><polygon points={`${xOf(i)-5},${yOf(d.actual)-9} ${xOf(i)+5},${yOf(d.actual)-9} ${xOf(i)},${yOf(d.actual)-4}`} fill="#003366"/><text x={xOf(i)} y={yOf(d.actual)-18} textAnchor="middle" fontSize={10.5} fill="#fff" fontWeight="700" fontFamily="'Noto Sans Thai',sans-serif">{fmtB(d.actual)}</text></g>)}
          {n>1&&<circle className="chart-area-fill" cx={xOf(i)} cy={yOf(d.plan)} r={hover?.idx===i&&hover.type==="plan"?5:3.5} fill={hover?.idx===i&&hover.type==="plan"?SILVER:"#fff"} stroke={SILVER} strokeWidth="1.8" style={{cursor:"pointer"}} onMouseEnter={()=>setHover({type:"plan",idx:i})} onMouseLeave={()=>setHover(null)}/>}
          {hover?.idx===i&&hover.type==="plan"&&(<g><rect x={xOf(i)-42} y={yOf(d.plan)-32} width={84} height={24} rx={6} fill="#4b5563"/><text x={xOf(i)} y={yOf(d.plan)-16} textAnchor="middle" fontSize={10} fill="#fff" fontWeight="700" fontFamily="'Noto Sans Thai',sans-serif">แผน {fmtB(d.plan)}</text></g>)}
        </g>
      ))}
    </svg>
  );
}

function BarChart({data}:{data:DataRow[]}){
  const [hoverIdx,setHoverIdx]=useState<number|null>(null);
  if(data.length===0) return <div style={{textAlign:"center",padding:"32px 0",color:SUB,fontSize:"0.82rem"}}>ไม่มีข้อมูล</div>;
  const W=600; const H=170; const PL=52; const PR=16; const PT=14; const PB=32;
  const gW=W-PL-PR; const gH=H-PT-PB;
  const maxV=Math.max(...data.map(d=>Math.max(d.plan,d.actual)))*1.18||1;
  const colW=gW/data.length; const barW=Math.min(colW*0.34,28); const gap=colW*0.06;
  const yOf=(v:number)=>PT+gH-(v/maxV)*gH;
  const gridVals=niceGridVals(maxV);
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{display:"block",overflow:"visible",minWidth:300}}>
      {gridVals.map(v=><g key={v}><line x1={PL} x2={W-PR} y1={yOf(v)} y2={yOf(v)} stroke="#e8ecf0" strokeWidth="1.2"/><text x={PL-8} y={yOf(v)+4} textAnchor="end" fontSize={8} fill="#9ca3af" fontFamily="'Noto Sans Thai',sans-serif">{fmtB(v)}</text></g>)}
      <line x1={PL} x2={W-PR} y1={PT+gH} y2={PT+gH} stroke={BORDER} strokeWidth="1.2"/>
      {data.map((d,i)=>{
        const cx=PL+i*colW+colW/2; const x1=cx-barW-gap/2; const x2=cx+gap/2; const yBot=PT+gH;
        const hA=Math.max(yBot-yOf(d.actual),0); const hP=Math.max(yBot-yOf(d.plan),0); const isHov=hoverIdx===i; const exceeded=d.actual>d.plan;
        return <g key={i} onMouseEnter={()=>setHoverIdx(i)} onMouseLeave={()=>setHoverIdx(null)}>
          <rect className="sales-bar" x={x1} y={yOf(d.actual)} width={barW} height={hA} rx={4} fill={PRIMARY} opacity={isHov?1:0.85}/>
          <rect className="sales-bar" x={x2} y={yOf(d.plan)} width={barW} height={hP} rx={4} fill="#ECC94B" opacity={isHov?0.9:0.6}/>
          <text x={cx} y={H-10} textAnchor="middle" fontSize={8.5} fill={SUB} fontFamily="'Noto Sans Thai',sans-serif">{d.month}</text>
          {isHov&&(<g><rect x={cx-66} y={PT-2} width={132} height={26} rx={7} fill="#003366"/><polygon points={`${cx-5},${PT+24} ${cx+5},${PT+24} ${cx},${PT+29}`} fill="#003366"/><text x={cx} y={PT+14} textAnchor="middle" fontSize={8.5} fill="#fff" fontWeight="700" fontFamily="'Noto Sans Thai',sans-serif">{exceeded?`เกิน ${((d.actual/d.plan-1)*100).toFixed(0)}%`:`ต่ำกว่า ${((1-d.actual/d.plan)*100).toFixed(0)}%`}{" · "}{fmtB(Math.abs(d.actual-d.plan))}</text></g>)}
        </g>;
      })}
    </svg>
  );
}

function DonutChart({segments,onSegmentClick}:{segments:{label:string;count:number;color:string;textColor:string}[];onSegmentClick?:(label:string)=>void;}){
  const [hovIdx,setHovIdx]=useState<number|null>(null);
  const total=segments.reduce((s,d)=>s+d.count,0)||1;
  const R=52; const CX=70; const CY=70; const SW=20;
  const rad=(deg:number)=>(deg*Math.PI)/180;
  let cum=-90;
  const arcs=segments.map(seg=>{ const pct=seg.count/total; const deg=pct*360; const x1=CX+R*Math.cos(rad(cum)); const y1=CY+R*Math.sin(rad(cum)); cum+=deg; const x2=CX+R*Math.cos(rad(cum)); const y2=CY+R*Math.sin(rad(cum)); return {...seg,pct,deg,x1,y1,x2,y2,large:deg>180?1:0}; });
  return (
    <div style={{display:"flex",alignItems:"center",gap:16}}>
      <svg width={140} height={140} viewBox="0 0 140 140" style={{flexShrink:0}}>
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="#f0f4f8" strokeWidth={SW}/>
        {arcs.map((a,i)=>a.pct>0.001?(<path key={i} className="donut-arc" pathLength={1} d={`M ${a.x1} ${a.y1} A ${R} ${R} 0 ${a.large} 1 ${a.x2} ${a.y2}`} fill="none" stroke={a.color} strokeWidth={hovIdx===i?SW+4:SW} strokeLinecap="butt" style={{cursor:onSegmentClick?"pointer":"default",transition:"stroke-width .15s",animationDelay:`${0.15+i*0.15}s`}} onMouseEnter={()=>setHovIdx(i)} onMouseLeave={()=>setHovIdx(null)} onClick={()=>onSegmentClick?.(a.label)}/>):null)}
        <text x={CX} y={CY-5} textAnchor="middle" fontSize={10} fill={SUB} fontFamily="'Noto Sans Thai',sans-serif">โอกาสการขาย</text>
        <text x={CX} y={CY+13} textAnchor="middle" fontSize={20} fill={STEEL} fontWeight="800" fontFamily="'Noto Sans Thai',sans-serif">{total}</text>
      </svg>
      <div style={{display:"flex",flexDirection:"column",gap:6,flex:1}}>
        {segments.map((seg,i)=>(
          <div key={i} onClick={()=>onSegmentClick?.(seg.label)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",paddingBottom:i<segments.length-1?6:0,borderBottom:i<segments.length-1?`1px solid ${BORDER}`:"none",cursor:onSegmentClick?"pointer":"default",borderRadius:4,padding:"2px 4px",background:hovIdx===i?"#f0f5ff":"transparent",transition:"background .12s"}} onMouseEnter={()=>setHovIdx(i)} onMouseLeave={()=>setHovIdx(null)}>
            <div style={{display:"flex",alignItems:"center",gap:7,fontSize:"0.74rem",color:STEEL}}>
              <span style={{width:8,height:8,borderRadius:"50%",background:seg.color,flexShrink:0}}/>{seg.label}
            </div>
            <span style={{fontWeight:700,fontSize:"0.78rem",color:STEEL}}>{seg.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ClientBars({items,onItemClick}:{items:{name:string;value:number}[];onItemClick?:(name:string)=>void;}){
  const maxVal=Math.max(...items.map(c=>c.value),1);
  return (
    <div style={{display:"flex",flexDirection:"column",gap:10,marginTop:10}}>
      {items.map((c,i)=>(
        <div key={i} onClick={()=>onItemClick?.(c.name)} style={{display:"flex",alignItems:"center",gap:10,fontSize:"0.76rem",cursor:onItemClick?"pointer":"default",borderRadius:6,padding:"2px 0"}} onMouseEnter={e=>{if(onItemClick)(e.currentTarget as HTMLElement).style.background="#f0f5ff";}} onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="transparent";}}>
          <div style={{minWidth:88,color:SUB,fontSize:"0.72rem",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{c.name}</div>
          <div style={{flex:1,height:8,background:"#e8ecf2",borderRadius:99,overflow:"hidden"}}><div className="top5-bar" style={{height:"100%",borderRadius:99,background:PRIMARY,width:`${(c.value/maxVal)*100}%`,opacity:0.75}}/></div>
          <div style={{minWidth:56,textAlign:"right",fontWeight:700,fontSize:"0.74rem",color:PRIMARY}}>{fmtB(c.value)}</div>
        </div>
      ))}
    </div>
  );
}

function MonthlyTable({data}:{data:DataRow[]}){
  if(data.length===0) return <div style={{padding:"24px",textAlign:"center",color:SUB,fontSize:"0.82rem"}}>ไม่มีข้อมูลในช่วงที่เลือก</div>;
  return (
    <div className="table-wrap">
    <table>
      <thead><tr>
        <th>ช่วงเวลา</th><th className="num">รายได้แผน</th><th className="num">รายได้จริง</th><th className="num">ผลต่าง</th><th>สถานะ</th>
      </tr></thead>
      <tbody>
        {data.map((row,i)=>{
          const diff=row.actual-row.plan; const status=getStatus(row.actual,row.plan); const badge=STATUS_BADGE[status];
          return <tr key={i}>
            <td style={{fontWeight:500}}>{row.thMonth}</td>
            <td className="num" style={{color:SUB}}>{fmtB(row.plan)}</td>
            <td className="num" style={{fontWeight:700}}>{fmtB(row.actual)}</td>
            <td className="num" style={{fontWeight:700,color:diff>=0?"#059669":"#dc2626"}}>{fmtDiff(diff)}</td>
            <td><span className="badge" style={{background:badge.bg,color:badge.text}}>{badge.label}</span></td>
          </tr>;
        })}
        <tr style={{background:"#f8f9fb"}}>
          <td style={{fontWeight:800}}>รวม</td>
          <td className="num" style={{fontWeight:700,color:SUB}}>{fmtB(data.reduce((s,d)=>s+d.plan,0))}</td>
          <td className="num" style={{fontWeight:800,color:PRIMARY}}>{fmtB(data.reduce((s,d)=>s+d.actual,0))}</td>
          <td className="num" style={{fontWeight:700,color:data.reduce((s,d)=>s+d.actual-d.plan,0)>=0?"#059669":"#dc2626"}}>{fmtDiff(data.reduce((s,d)=>s+d.actual-d.plan,0))}</td>
          <td/>
        </tr>
      </tbody>
    </table>
    </div>
  );
}

function StatCard({iconBg,icon,value,valueColor,label,trend,trendUp,onClick}:{iconBg:string;icon:React.ReactNode;value:string;valueColor:string;label:string;trend:string;trendUp:boolean;onClick?:()=>void;}){
  return (
    <div onClick={onClick} className={`stat-card${onClick?" clickable":""}`} style={{display:"flex",alignItems:"center",gap:14}}>
      <div className="stat-icon" style={{background:iconBg,width:44,height:44,marginBottom:0}}>{icon}</div>
      <div>
        <div className="stat-value" style={{fontSize:"1.55rem",color:valueColor,marginBottom:0}}>{value}</div>
        <div className="stat-label" style={{marginTop:1,marginBottom:0}}>{label}</div>
        <div className={`stat-delta ${trendUp?"delta-up":"delta-down"}`} style={{marginTop:2}}>{trendUp?"↑":"↓"} {trend}</div>
      </div>
    </div>
  );
}

function MiniBar({value,color}:{value:number;color:string}){
  return <div style={{height:5,background:"#f0f4f8",borderRadius:99,overflow:"hidden",flex:1}}><div className="top5-bar" style={{height:"100%",width:`${value}%`,background:color,borderRadius:99}}/></div>;
}

// ── Report Modal ──────────────────────────────────────────────
const REPORT_TYPES:[ReportType,string,string][] = [
  ["revenue",  "รายงานรายได้",     "แผน vs จริง ตามช่วงเวลา"],
  ["projects", "รายงานการขาย",    "สถานะและความคืบหน้าการขาย"],
  ["customers","รายงานลูกค้า",     "ยอดขายและจำนวนโอกาสการขาย"],
  ["invoices", "รายงานใบแจ้งหนี้", "สถานะและยอดค้างชำระ"],
];
function ReportModal({displayData,dateFrom,dateTo,onClose}:{displayData:DataRow[];dateFrom:string;dateTo:string;onClose:()=>void;}){
  const [type,setType]=useState<ReportType>("revenue");
  const [fmt,setFmt]=useState<"csv"|"pdf">("csv");
  function generate(){ if(fmt==="csv") generateCSV(type,displayData); else window.print(); onClose(); }
  return (
    <>
      <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(45,45,45,.4)",zIndex:200}}/>
      <div style={{position:"fixed",inset:0,zIndex:210,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
        <div onClick={e=>e.stopPropagation()} style={{...CARD,width:"100%",maxWidth:460,overflow:"hidden",boxShadow:"0 24px 80px rgba(0,0,0,.2)"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 22px",borderBottom:`1px solid ${BORDER}`,background:PRIMARY}}>
            <div>
              <div style={{fontSize:"0.92rem",fontWeight:800,color:"#fff"}}>สร้างรายงาน</div>
              <div style={{fontSize:"0.66rem",color:"rgba(255,255,255,.7)",marginTop:2}}>{dateFrom} – {dateTo}</div>
            </div>
            <button onClick={onClose} style={{width:28,height:28,borderRadius:8,border:"1px solid rgba(255,255,255,.2)",background:"rgba(255,255,255,.1)",color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>×</button>
          </div>
          <div style={{padding:"20px 22px",display:"flex",flexDirection:"column",gap:16}}>
            <div>
              <div style={{fontSize:"0.68rem",fontWeight:700,color:SUB,textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:8}}>ประเภทรายงาน</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {REPORT_TYPES.map(([key,label,desc])=>(
                  <button key={key} onClick={()=>setType(key)} style={{padding:"10px 12px",borderRadius:10,border:`1.5px solid ${type===key?PRIMARY:BORDER}`,background:type===key?"#dce5f0":"#fff",cursor:"pointer",textAlign:"left"}}>
                    <div style={{fontSize:"0.78rem",fontWeight:700,color:type===key?PRIMARY:STEEL}}>{label}</div>
                    <div style={{fontSize:"0.65rem",color:SUB,marginTop:2}}>{desc}</div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div style={{fontSize:"0.68rem",fontWeight:700,color:SUB,textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:8}}>รูปแบบไฟล์</div>
              <div style={{display:"flex",gap:8}}>
                {([["csv","CSV (Excel)"],["pdf","PDF"]] as [string,string][]).map(([k,l])=>(
                  <button key={k} onClick={()=>setFmt(k as "csv"|"pdf")} style={{flex:1,padding:"9px",borderRadius:10,border:`1.5px solid ${fmt===k?PRIMARY:BORDER}`,background:fmt===k?"#dce5f0":"#fff",cursor:"pointer",fontSize:"0.8rem",fontWeight:700,color:fmt===k?PRIMARY:STEEL}}>{l}</button>
                ))}
              </div>
            </div>
          </div>
          <div style={{padding:"14px 22px",borderTop:`1px solid ${BORDER}`,display:"flex",gap:8,justifyContent:"flex-end",background:"#fafafa"}}>
            <button onClick={onClose} style={{padding:"8px 18px",borderRadius:9,border:`1px solid ${BORDER}`,background:"#fff",color:STEEL,fontSize:"0.78rem",fontWeight:600,cursor:"pointer"}}>ยกเลิก</button>
            <button onClick={generate} style={{padding:"8px 22px",borderRadius:9,border:"none",background:PRIMARY,color:"#fff",fontSize:"0.78rem",fontWeight:700,cursor:"pointer",boxShadow:"0 4px 12px rgba(0,0,0,.3)"}}>
              {fmt==="csv"?"ดาวน์โหลด CSV":"พิมพ์ PDF"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Presets ───────────────────────────────────────────────────
type Preset = "year"|"6m"|"quarter"|"month"|"custom";
function calcPreset(p:Preset):{from:string;to:string}{
  const now=new Date(2026,5,23); // June 23 2026 (fixed for demo)
  const y=now.getFullYear(); const m=now.getMonth(); // 5=June
  if(p==="year")    return {from:`${y}-01-01`, to:`${y}-12-31`};
  if(p==="6m"){
    const s=new Date(y,m-5,1); return {from:toISO(s), to:toISO(now)};
  }
  if(p==="quarter"){
    const q=Math.floor(m/3); return {from:`${y}-${String(q*3+1).padStart(2,"0")}-01`, to:`${y}-${String(Math.min(q*3+3,12)).padStart(2,"0")}-30`};
  }
  if(p==="month")   return {from:`${y}-${String(m+1).padStart(2,"0")}-01`, to:toISO(now)};
  return {from:`${y}-01-01`, to:toISO(now)};
}
const PRESET_LABELS:Record<Preset,string>={year:"ปีนี้","6m":"6 เดือน",quarter:"ไตรมาส",month:"เดือนนี้",custom:"กำหนดเอง"};

// ── Main Page ─────────────────────────────────────────────────
export default function ReportsPage(){
  const router=useRouter();
  const { timeRange }=useFilters();
  const initPreset=calcPreset("year");
  const [preset,setPreset]     = useState<Preset>("year");
  const [dateFrom,setDateFrom] = useState(initPreset.from);
  const [dateTo,setDateTo]     = useState(initPreset.to);
  const [showModal,setShowModal] = useState(false);
  const [showDatePicker,setShowDatePicker] = useState(false);

  function applyPreset(p:Preset){
    setPreset(p);
    if(p!=="custom"){
      const {from,to}=calcPreset(p);
      setDateFrom(from); setDateTo(to);
    }
  }
  function handleFromChange(v:string){ setDateFrom(v); setPreset("custom"); }
  function handleToChange(v:string){   setDateTo(v);   setPreset("custom"); }

  // ── Derived data based on date range ──────────────────────
  const fromYM = dateFrom.substring(0,7); // "2026-01"
  const toYM   = dateTo.substring(0,7);   // "2026-06"
  const isSingleMonth = fromYM===toYM;

  const displayData: DataRow[] = useMemo(()=>{
    if(isSingleMonth && fromYM==="2026-06") return JUNE_WEEKLY;
    return ALL_MONTHLY_DATA.filter(d=>d.date>=fromYM&&d.date<=toYM);
  },[fromYM,toYM,isSingleMonth]);

  const periodLabel = useMemo(()=>{
    if(isSingleMonth){
      const row=ALL_MONTHLY_DATA.find(d=>d.date===fromYM);
      return row?row.thMonth:`${fromYM}`;
    }
    return `${dateFrom} – ${dateTo}`;
  },[dateFrom,dateTo,isSingleMonth,fromYM]);

  // Payments within date range
  const filteredPayments = useMemo(()=>
    payments.filter(p=>p.status==="confirmed"&&p.paidDate>=dateFrom&&p.paidDate<=dateTo),
    [dateFrom,dateTo]
  );
  // Revenue from displayData actual values (chart data)
  const totalRevenue  = useMemo(()=>displayData.reduce((s,d)=>s+d.actual,0),[displayData]);
  const totalPlan     = useMemo(()=>displayData.reduce((s,d)=>s+d.plan,0),[displayData]);
  const totalActual   = totalRevenue;

  // สเกล KPI การ์ดด้านบนตาม Global Time Range (auto-refresh แยกจากตัวเลือกวันที่ในกราฟ)
  const tf            = timeRange.factor;
  const scActual      = totalActual*tf;
  const scPlan        = totalPlan*tf;
  const scProfit      = scActual - scPlan*0.72;

  // Invoices within date range (filter by dueDate)
  const filteredInvoices = useMemo(()=>
    invoices.filter(i=>i.dueDate>=dateFrom&&i.dueDate<=dateTo),
    [dateFrom,dateTo]
  );
  const overdueInvoices = filteredInvoices.filter(i=>i.status==="overdue");
  const pendingInvoices = filteredInvoices.filter(i=>i.status==="sent");
  const paidInvoices    = filteredInvoices.filter(i=>i.status==="paid");

  const clientRevenue = useMemo(()=>{
    const map:Record<string,number>={};
    filteredPayments.forEach(p=>{ map[p.client]=(map[p.client]||0)+p.amount; });
    contracts.forEach(c=>{ if(!map[c.client]&&c.status==="completed") map[c.client]=(map[c.client]||0)+c.deposit; });
    return Object.entries(map).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value).slice(0,5);
  },[filteredPayments]);

  const projectStatusGroups = useMemo(()=>{
    const groups:Record<string,number>={};
    projects.forEach(p=>{groups[p.status]=(groups[p.status]||0)+1;});
    return [
      {label:"กำลังดำเนินการ",count:groups.in_progress||0,color:projectStatusColor.in_progress.text,textColor:projectStatusColor.in_progress.text},
      {label:"ยังไม่เริ่ม",   count:groups.not_started||0,color:projectStatusColor.not_started.text,textColor:projectStatusColor.not_started.text},
      {label:"หยุดชั่วคราว",  count:groups.on_hold||0,    color:projectStatusColor.on_hold.text,    textColor:projectStatusColor.on_hold.text},
      {label:"เสร็จแล้ว",     count:groups.completed||0,  color:projectStatusColor.completed.text,  textColor:projectStatusColor.completed.text},
    ];
  },[]);

  const doneTasks      = tasks.filter(t=>t.status==="done").length;
  const activeProjects = projects.filter(p=>p.status==="in_progress").length;
  const recentPayments = useMemo(()=>[...filteredPayments].sort((a,b)=>b.paidDate.localeCompare(a.paidDate)).slice(0,4),[filteredPayments]);
  const topProjects    = useMemo(()=>{
    function parseVal(v:string){ const n=parseFloat(v.replace(/[฿,]/g,"")); return v.includes("M")?n*1e6:v.includes("K")?n*1e3:n||0; }
    return [...projects].sort((a,b)=>parseVal(b.value)-parseVal(a.value)).slice(0,4);
  },[]);

  // ── KPI metrics ───────────────────────────────────────────
  const completedProjects = projects.filter(p=>p.status==="completed");
  const onTimeProjects    = completedProjects.filter(p=>p.progress>=100);
  const onTimeRate        = completedProjects.length>0?Math.round(onTimeProjects.length/completedProjects.length*100):100;
  const totalInv          = invoices.length; const paidInvAll=invoices.filter(i=>i.status==="paid").length;
  const collectionRate    = totalInv>0?Math.round(paidInvAll/totalInv*100):0;
  const sentQuotes        = quotations.filter(q=>q.status!=="draft").length;
  const approvedQuotes    = quotations.filter(q=>q.status==="won").length;
  const winRate           = sentQuotes>0?Math.round(approvedQuotes/sentQuotes*100):0;
  const taskCompletion    = tasks.length>0?Math.round(doneTasks/tasks.length*100):0;

  // ── Task analytics ────────────────────────────────────────
  const taskByStatus = useMemo(()=>{
    const m:Record<string,number>={};
    tasks.forEach(t=>{m[t.status]=(m[t.status]||0)+1;});
    return m;
  },[]);
  const taskByPriority = useMemo(()=>{
    const m:Record<string,number>={};
    tasks.forEach(t=>{m[t.priority]=(m[t.priority]||0)+1;});
    return m;
  },[]);
  const upcomingTasks = useMemo(()=>
    tasks.filter(t=>t.status!=="done"&&t.status!=="cancelled"&&t.due)
      .sort((a,b)=>(a.due||"").localeCompare(b.due||"")).slice(0,5),
  []);

  // ── Contract pipeline ─────────────────────────────────────
  const pipelineStats = useMemo(()=>{
    const qTotal=quotations.reduce((s,q)=>s+q.totalValue,0);
    const cTotal=contracts.reduce((s,c)=>s+c.value,0);
    const iTotal=invoices.reduce((s,i)=>s+i.total,0);
    const pTotal=payments.filter(p=>p.status==="confirmed").reduce((s,p)=>s+p.amount,0);
    return [
      {label:"ใบเสนอราคา",cnt:quotations.length,val:qTotal,color:"#003366",pct:100},
      {label:"สัญญา",        cnt:contracts.length,  val:cTotal,color:PRIMARY,   pct:Math.round(cTotal/Math.max(qTotal,1)*100)},
      {label:"ใบแจ้งหนี้",   cnt:invoices.length,   val:iTotal,color:"#f59e0b", pct:Math.round(iTotal/Math.max(qTotal,1)*100)},
      {label:"ชำระแล้ว",     cnt:paidInvAll,         val:pTotal,color:"#059669", pct:Math.round(pTotal/Math.max(qTotal,1)*100)},
    ];
  },[]);

  // ── Payment methods ───────────────────────────────────────
  const paymentMethods = useMemo(()=>{
    const m:Record<string,{cnt:number;val:number}>={};
    payments.filter(p=>p.status==="confirmed").forEach(p=>{
      const k=p.method; if(!m[k]) m[k]={cnt:0,val:0};
      m[k].cnt++; m[k].val+=p.amount;
    });
    const labels:Record<string,string>={bank_transfer:"โอนธนาคาร",cash:"เงินสด",cheque:"เช็ค",credit_card:"บัตรเครดิต"};
    const colors:Record<string,string>={bank_transfer:PRIMARY,cash:"#059669",cheque:"#f59e0b",credit_card:"#8fa3b8"};
    return Object.entries(m).map(([k,v])=>({label:labels[k]||k,cnt:v.cnt,val:v.val,color:colors[k]||"#999"}));
  },[]);

  // ── Project health ────────────────────────────────────────
  const projectHealth = useMemo(()=>{
    const now=new Date(2026,5,23);
    return projects.map(p=>{
      const due=new Date(p.due.split("/").reverse().join("-"));
      const daysLeft=Math.round((due.getTime()-now.getTime())/(1000*60*60*24));
      const health=p.status==="completed"?"done":daysLeft<0?"overdue":daysLeft<14?"critical":p.progress<40&&daysLeft<30?"warning":"good";
      return {...p,daysLeft,health};
    }).sort((a,b)=>a.daysLeft-b.daysLeft);
  },[]);

  const INP:React.CSSProperties={border:`1px solid ${BORDER}`,borderRadius:8,padding:"5px 9px",fontSize:"0.78rem",color:STEEL,outline:"none",background:"#fff",cursor:"pointer"};

  return (
    <div className="erp dash-anim" style={{paddingBottom:32}}>

      {/* ── Header ── */}
      <div className="page-head">
        <div>
          <h2>รายงาน</h2>
          <p>ภาพรวมทางการเงินและประสิทธิภาพการขาย · {timeRange.subtitle}</p>
        </div>
        <div style={{display:"flex",gap:7,flexWrap:"wrap",alignItems:"center"}}>
          <FilterBar dims={[]} />
          <button onClick={()=>{generateCSV("revenue",displayData);}} className="btn btn-secondary btn-sm">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            ส่งออก CSV
          </button>
          <button onClick={()=>window.print()} className="btn btn-secondary btn-sm">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            พิมพ์ PDF
          </button>
          <button onClick={()=>setShowModal(true)} className="btn btn-primary btn-sm">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            สร้างรายงาน
          </button>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:14}}>
        <StatCard iconBg="#e5faf0" icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>}
          value={fmtB(scActual)} valueColor="#059669" label="รายได้จริงในช่วงนี้" trend={`เกินแผน ${fmtB(Math.max(scActual-scPlan,0))}`} trendUp={scActual>=scPlan} onClick={()=>router.push("/payments")}/>
        <StatCard iconBg="#fee2e2" icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>}
          value={fmtB(scPlan*0.72)} valueColor="#dc2626" label="ค่าใช้จ่าย (ประมาณ)" trend="72% ของแผน" trendUp={false} onClick={()=>router.push("/quotations")}/>
        <StatCard iconBg="#dce5f0" icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#003366" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>}
          value={fmtB(Math.max(scProfit,0))} valueColor="#003366" label="กำไร (ประมาณ)" trend={`${doneTasks} งานเสร็จสิ้น`} trendUp onClick={()=>void 0}/>
        <StatCard iconBg="#fff3e0" icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>}
          value={String(filteredInvoices.length||invoices.length)} valueColor="#f59e0b" label="ใบแจ้งหนี้ในช่วงนี้" trend={`${overdueInvoices.length} รายการเกินกำหนด`} trendUp={overdueInvoices.length===0} onClick={()=>router.push("/invoices")}/>
      </div>

      {/* ── KPI Row ── */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:14}}>
        {[
          {label:"เสร็จตามแผน",    val:onTimeRate,    suffix:"%", color:"#059669", bg:"#e5faf0", note:`${onTimeProjects.length}/${completedProjects.length} โอกาสการขาย`},
          {label:"อัตราเก็บเงิน",  val:collectionRate,suffix:"%", color:PRIMARY,   bg:"#dce5f0", note:`${paidInvAll}/${totalInv} ใบแจ้งหนี้`},
          {label:"ชนะใบเสนอราคา", val:winRate,        suffix:"%", color:"#003366", bg:"#dce5f0", note:`${approvedQuotes}/${sentQuotes} ฉบับ`},
          {label:"เสร็จงาน",       val:taskCompletion, suffix:"%", color:"#f59e0b", bg:"#fff3e0", note:`${doneTasks}/${tasks.length} งาน`},
        ].map((k,i)=>{
          const arc=Math.min(k.val,100);
          const r=18; const circ=2*Math.PI*r; const dash=circ*arc/100; const gap=circ-dash;
          return (
            <div key={i} className="kpi" style={{flexDirection:"row",alignItems:"center",gap:14}}>
              <svg width={48} height={48} viewBox="0 0 48 48" style={{flexShrink:0}}>
                <circle cx={24} cy={24} r={r} fill="none" stroke="#f0f4f8" strokeWidth={5}/>
                <circle className="donut-seg" cx={24} cy={24} r={r} fill="none" stroke={k.color} strokeWidth={5}
                  strokeDasharray={`${dash} ${gap}`} strokeLinecap="round" transform="rotate(-90 24 24)"
                  style={{ ["--seg-len" as string]: dash, animationDelay: `${0.2 + i * 0.1}s` }}/>
                <text x={24} y={27} textAnchor="middle" fontSize={10} fontWeight="800" fill={k.color} fontFamily="sans-serif">{k.val}%</text>
              </svg>
              <div>
                <div style={{fontSize:"0.82rem",fontWeight:700,color:STEEL}}>{k.label}</div>
                <div style={{fontSize:"0.67rem",color:SUB,marginTop:2}}>{k.note}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Area Chart (with integrated date filter) ── */}
      <div className="card" style={{padding:"16px 20px 18px",marginBottom:14}}>
        {/* Row 1: title + preset tabs */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,gap:10,flexWrap:"wrap"}}>
          <div className="card-title">
            ภาพรวมรายได้ <span style={{color:SUB,fontWeight:400,fontSize:"0.8rem"}}>{isSingleMonth?"รายสัปดาห์":"รายเดือน"}</span>
          </div>
          <div className="tab-bar" style={{border:"none"}}>
            {(["year","6m","quarter","month","custom"] as Preset[]).map(p=>(
              <button key={p} onClick={()=>applyPreset(p)} className={`tab-item${preset===p?" active":""}`}>
                {PRESET_LABELS[p]}
              </button>
            ))}
          </div>
        </div>
        {/* Row 2: period info + date inputs + legend */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,paddingBottom:12,borderBottom:`1px solid #f0f4f8`,flexWrap:"wrap",gap:8}}>
          <div style={{display:"flex",alignItems:"center",gap:7}}>
            <span style={{fontSize:"0.7rem",color:SUB}}>{displayData.length>0?periodLabel:"ไม่มีข้อมูลในช่วงนี้"}</span>
            {displayData.length>0&&<span style={{fontSize:"0.67rem",fontWeight:700,color:PRIMARY,background:"#dce5f0",borderRadius:99,padding:"2px 8px"}}>{displayData.length} {isSingleMonth?"สัปดาห์":"เดือน"}</span>}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <span style={{fontSize:"0.7rem",color:SUB,fontWeight:600}}>จาก</span>
            <input type="date" value={dateFrom} onChange={e=>handleFromChange(e.target.value)} style={INP}/>
            <span style={{fontSize:"0.7rem",color:SUB,fontWeight:600}}>ถึง</span>
            <input type="date" value={dateTo} onChange={e=>handleToChange(e.target.value)} style={INP}/>
            <div style={{width:1,height:18,background:BORDER,flexShrink:0,margin:"0 4px"}}/>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:18,height:2.5,borderRadius:2,background:PRIMARY,display:"inline-block"}}/><span style={{fontSize:"0.67rem",color:SUB}}>จริง</span></div>
              <div style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:18,display:"inline-block",borderTop:`2px dashed ${SILVER}`,verticalAlign:"middle"}}/><span style={{fontSize:"0.67rem",color:SUB}}>แผน</span></div>
            </div>
          </div>
        </div>
        <div style={{overflowX:"auto"}}><AreaChart data={displayData}/></div>
      </div>

      {/* ── 2-col layout ── */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 270px",gap:14}}>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>

          {/* Bar Chart */}
          <div className="card" style={{padding:"18px 20px"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
              <div className="card-title">เปรียบเทียบแผน vs จริง</div>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{display:"flex",alignItems:"center",gap:5}}><span style={{width:10,height:10,borderRadius:3,background:PRIMARY,display:"inline-block"}}/><span style={{fontSize:"0.68rem",color:SUB}}>จริง</span></div>
                <div style={{display:"flex",alignItems:"center",gap:5}}><span style={{width:10,height:10,borderRadius:3,background:"#ECC94B",display:"inline-block"}}/><span style={{fontSize:"0.68rem",color:SUB}}>แผน</span></div>
              </div>
            </div>
            <div style={{overflowX:"auto"}}><BarChart data={displayData}/></div>
          </div>

          {/* Monthly Table */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                รายได้ {isSingleMonth?"รายสัปดาห์":"รายเดือน"} · {periodLabel}
              </div>
              <button onClick={()=>generateCSV("revenue",displayData)} className="btn btn-secondary btn-sm">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                CSV
              </button>
            </div>
            <MonthlyTable data={displayData}/>
          </div>

          {/* Invoice Breakdown */}
          <div className="card" style={{padding:"16px 18px"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
              <div>
                <div style={{fontSize:"0.84rem",fontWeight:700,color:STEEL}}>สถานะใบแจ้งหนี้</div>
                <div style={{fontSize:"0.68rem",color:SUB,marginTop:2}}>ครบกำหนดในช่วง {periodLabel}</div>
              </div>
              <button onClick={()=>router.push("/invoices")} style={{display:"flex",alignItems:"center",gap:4,fontSize:"0.72rem",color:PRIMARY,fontWeight:600,background:"none",border:"none",cursor:"pointer"}}>ดูทั้งหมด →</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
              {[{l:"ชำระแล้ว",cnt:paidInvoices.length,val:paidInvoices.reduce((s,i)=>s+i.total,0),color:"#059669",bg:"#e5faf0"},
                {l:"รอชำระ",cnt:pendingInvoices.length,val:pendingInvoices.reduce((s,i)=>s+i.total,0),color:PRIMARY,bg:"#dce5f0"},
                {l:"เกินกำหนด",cnt:overdueInvoices.length,val:overdueInvoices.reduce((s,i)=>s+i.total,0),color:"#dc2626",bg:"#fee2e2"},
              ].map((item,i)=>(
                <div key={i} onClick={()=>router.push("/invoices")} style={{padding:"12px 14px",borderRadius:12,background:item.bg,cursor:"pointer",transition:"opacity .12s"}} onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.opacity="0.8";}} onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.opacity="1";}}>
                  <div style={{fontSize:"1.4rem",fontWeight:800,color:item.color,lineHeight:1}}>{item.cnt}</div>
                  <div style={{fontSize:"0.65rem",color:item.color,fontWeight:700,marginTop:2}}>{item.l}</div>
                  <div style={{fontSize:"0.7rem",fontWeight:700,color:item.color,marginTop:4,opacity:0.85}}>{fmtB(item.val)}</div>
                </div>
              ))}
            </div>
          </div>
          {/* Task Analytics */}
          <div className="card" style={{padding:"16px 18px"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
              <div style={{fontSize:"0.84rem",fontWeight:700,color:STEEL}}>วิเคราะห์งาน</div>
              <button onClick={()=>router.push("/tasks")} style={{fontSize:"0.7rem",color:PRIMARY,fontWeight:600,background:"none",border:"none",cursor:"pointer"}}>ดูทั้งหมด →</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
              {/* Status bars */}
              <div>
                <div style={{fontSize:"0.68rem",fontWeight:700,color:SUB,textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:8}}>สถานะงาน</div>
                <div style={{display:"flex",flexDirection:"column",gap:7}}>
                  {[["todo","#94a3b8"],["in_progress","#003366"],["review","#f59e0b"],["done","#059669"],["cancelled","#dc2626"]].map(([st,col])=>{
                    const cnt=taskByStatus[st]||0; const pct=tasks.length>0?Math.round(cnt/tasks.length*100):0;
                    return (
                      <div key={st}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                          <span style={{fontSize:"0.68rem",color:STEEL,fontWeight:600}}>{taskStatusLabel[st as keyof typeof taskStatusLabel]||st}</span>
                          <span style={{fontSize:"0.68rem",color:SUB}}>{cnt} ({pct}%)</span>
                        </div>
                        <div style={{height:5,background:"#f0f4f8",borderRadius:99,overflow:"hidden"}}>
                          <div className="top5-bar" style={{height:"100%",width:`${pct}%`,background:col,borderRadius:99}}/>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* Priority + upcoming */}
              <div>
                <div style={{fontSize:"0.68rem",fontWeight:700,color:SUB,textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:8}}>ลำดับความสำคัญ</div>
                <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:12}}>
                  {["high","medium","low"].map(pri=>{
                    const cnt=taskByPriority[pri]||0; const pc=taskPriorityColor[pri as keyof typeof taskPriorityColor];
                    return (
                      <div key={pri} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"5px 8px",borderRadius:7,background:"#f8f9fb"}}>
                        <span style={{fontSize:"0.7rem",fontWeight:600,color:pc||STEEL}}>{taskPriorityLabel[pri as keyof typeof taskPriorityLabel]||pri}</span>
                        <span style={{fontSize:"0.72rem",fontWeight:800,color:pc||STEEL,background:`${pc}22`||"#f0f4f8",borderRadius:99,padding:"1px 8px"}}>{cnt}</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{fontSize:"0.68rem",fontWeight:700,color:SUB,textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:6}}>งานเร่งด่วน</div>
                <div style={{display:"flex",flexDirection:"column",gap:4}}>
                  {upcomingTasks.slice(0,3).map(t=>(
                    <div key={t.id} onClick={()=>router.push("/tasks")} style={{padding:"5px 8px",borderRadius:7,background:"#fee2e2",cursor:"pointer"}}>
                      <div style={{fontSize:"0.7rem",fontWeight:600,color:STEEL,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.title}</div>
                      <div style={{fontSize:"0.62rem",color:SUB,marginTop:1}}>กำหนด: {t.due}</div>
                    </div>
                  ))}
                  {upcomingTasks.length===0&&<div style={{fontSize:"0.7rem",color:SUB,textAlign:"center"}}>ไม่มีงานค้าง</div>}
                </div>
              </div>
            </div>
          </div>

          {/* Contract Pipeline */}
          <div className="card" style={{padding:"16px 18px"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
              <div style={{fontSize:"0.84rem",fontWeight:700,color:STEEL}}>โอกาสการขายตามสัญญา</div>
              <span style={{fontSize:"0.68rem",color:SUB}}>ใบเสนอราคา → ชำระแล้ว</span>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:0,position:"relative"}}>
              {pipelineStats.map((s,i)=>(
                <div key={i} style={{textAlign:"center",position:"relative"}}>
                  {i<pipelineStats.length-1&&<div style={{position:"absolute",right:-1,top:"50%",transform:"translateY(-50%)",fontSize:"0.9rem",color:BORDER,zIndex:1}}>›</div>}
                  <div style={{margin:"0 8px",padding:"12px 6px",borderRadius:10,background:s.color+"18",border:`1px solid ${s.color}33`}}>
                    <div style={{fontSize:"1.3rem",fontWeight:800,color:s.color}}>{s.cnt}</div>
                    <div style={{fontSize:"0.62rem",fontWeight:700,color:s.color,marginTop:2}}>{s.label}</div>
                    <div style={{fontSize:"0.68rem",fontWeight:700,color:STEEL,marginTop:4}}>{fmtB(s.val)}</div>
                    <div style={{marginTop:6,height:4,background:"#f0f4f8",borderRadius:99,overflow:"hidden"}}>
                      <div className="top5-bar" style={{height:"100%",width:`${s.pct}%`,background:s.color,borderRadius:99}}/>
                    </div>
                    <div style={{fontSize:"0.58rem",color:SUB,marginTop:2}}>{s.pct}%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div className="card" style={{padding:"16px"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
              <div style={{fontSize:"0.84rem",fontWeight:700,color:STEEL}}>สถานะโอกาสการขาย</div>
              <button onClick={()=>void 0} style={{fontSize:"0.7rem",color:PRIMARY,fontWeight:600,background:"none",border:"none",cursor:"pointer"}}>ดูทั้งหมด →</button>
            </div>
            <DonutChart segments={projectStatusGroups} onSegmentClick={()=>void 0}/>
          </div>

          <div className="card" style={{padding:"16px"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:2}}>
              <div>
                <div style={{fontSize:"0.84rem",fontWeight:700,color:STEEL}}>รายได้ตามลูกค้า</div>
                <div style={{fontSize:"0.66rem",color:SUB,marginTop:1}}>ในช่วงที่เลือก</div>
              </div>
              <button onClick={()=>router.push("/customers")} style={{fontSize:"0.7rem",color:PRIMARY,fontWeight:600,background:"none",border:"none",cursor:"pointer"}}>ดูทั้งหมด →</button>
            </div>
            <ClientBars items={clientRevenue.length>0?clientRevenue:[{name:"ไม่มีข้อมูล",value:0}]} onItemClick={()=>router.push("/customers")}/>
          </div>

          <div className="card" style={{padding:"16px"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
              <div style={{fontSize:"0.84rem",fontWeight:700,color:STEEL}}>โอกาสการขายมูลค่าสูงสุด</div>
              <button onClick={()=>void 0} style={{fontSize:"0.7rem",color:PRIMARY,fontWeight:600,background:"none",border:"none",cursor:"pointer"}}>ดูทั้งหมด →</button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {topProjects.map((p,i)=>{
                const pc=projectStatusColor[p.status];
                return (
                  <div key={p.id} onClick={()=>void 0} style={{cursor:"pointer",padding:"6px 0",borderBottom:i<topProjects.length-1?`1px solid #f0f4f8`:"none"}} onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="#f8f9fb";}} onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="transparent";}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <div style={{fontSize:"0.74rem",fontWeight:700,color:STEEL,maxWidth:130,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.title}</div>
                      <span style={{fontSize:"0.65rem",fontWeight:700,color:STEEL}}>{p.value}</span>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <MiniBar value={p.progress} color={p.status==="completed"?"#059669":p.status==="on_hold"?"#f59e0b":PRIMARY}/>
                      <span style={{padding:"1px 6px",borderRadius:99,fontSize:"0.58rem",fontWeight:700,background:pc.bg,color:pc.text,flexShrink:0}}>{projectStatusLabel[p.status]}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card" style={{padding:"16px"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
              <div>
                <div style={{fontSize:"0.84rem",fontWeight:700,color:STEEL}}>การชำระล่าสุด</div>
                <div style={{fontSize:"0.66rem",color:SUB,marginTop:1}}>ในช่วงที่เลือก</div>
              </div>
              <button onClick={()=>router.push("/payments")} style={{fontSize:"0.7rem",color:PRIMARY,fontWeight:600,background:"none",border:"none",cursor:"pointer"}}>ดูทั้งหมด →</button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {recentPayments.map((p,i)=>(
                <div key={p.id} onClick={()=>router.push("/payments")} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 0",borderBottom:i<recentPayments.length-1?`1px solid #f0f4f8`:"none",cursor:"pointer"}} onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="#f8f9fb";}} onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="transparent";}}>
                  <div>
                    <div style={{fontSize:"0.72rem",fontWeight:700,color:STEEL}}>{p.client}</div>
                    <div style={{fontSize:"0.62rem",color:SUB,marginTop:1}}>{p.paidDate}</div>
                  </div>
                  <div style={{fontSize:"0.76rem",fontWeight:800,color:"#059669"}}>{fmtB(p.amount)}</div>
                </div>
              ))}
              {recentPayments.length===0&&<div style={{fontSize:"0.76rem",color:SUB,textAlign:"center",padding:8}}>ไม่มีการชำระในช่วงนี้</div>}
            </div>
          </div>

          {/* Payment Methods */}
          {paymentMethods.length>0&&(
            <div className="card" style={{padding:"16px"}}>
              <div style={{fontSize:"0.84rem",fontWeight:700,color:STEEL,marginBottom:12}}>วิธีการชำระเงิน</div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {paymentMethods.map((m,i)=>{
                  const maxVal=Math.max(...paymentMethods.map(x=>x.val),1);
                  return (
                    <div key={i}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                        <span style={{fontSize:"0.7rem",fontWeight:600,color:STEEL}}>{m.label}</span>
                        <div style={{display:"flex",gap:6,alignItems:"center"}}>
                          <span style={{fontSize:"0.65rem",color:SUB}}>{m.cnt} ครั้ง</span>
                          <span style={{fontSize:"0.7rem",fontWeight:700,color:m.color}}>{fmtB(m.val)}</span>
                        </div>
                      </div>
                      <div style={{height:5,background:"#f0f4f8",borderRadius:99,overflow:"hidden"}}>
                        <div className="top5-bar" style={{height:"100%",width:`${(m.val/maxVal)*100}%`,background:m.color,borderRadius:99}}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Project Health Table (full-width) ── */}
      <div className="card" style={{marginTop:14}}>
        <div className="card-header">
          <div>
            <div className="card-title">สุขภาพโอกาสการขาย</div>
            <div className="card-desc">ภาพรวมทุกโอกาสการขาย · เรียงตามกำหนดส่ง</div>
          </div>
          <button onClick={()=>void 0} className="btn btn-ghost btn-sm">ดูโอกาสการขาย →</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr>
              {["โอกาสการขาย","ลูกค้า","สถานะ","ความคืบหน้าการขาย","กำหนดส่ง","วันที่เหลือ","สุขภาพ"].map(h=>(
                <th key={h}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {projectHealth.map((p)=>{
                const pc=projectStatusColor[p.status];
                const HEALTH:{[k:string]:{label:string;bg:string;color:string}}={
                  done:    {label:"เสร็จสิ้น",  bg:"#e5faf0",color:"#059669"},
                  good:    {label:"ปกติ",        bg:"#dce5f0",color:PRIMARY},
                  warning: {label:"ระวัง",       bg:"#fff3e0",color:"#f59e0b"},
                  critical:{label:"วิกฤต",       bg:"#fee2e2",color:"#dc2626"},
                  overdue: {label:"เกินกำหนด",   bg:"#fee2e2",color:"#dc2626"},
                };
                const h=HEALTH[p.health]||HEALTH.good;
                return (
                  <tr key={p.id} className="clickable" onClick={()=>void 0}>
                    <td style={{fontWeight:700,maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.title}</td>
                    <td style={{color:SUB,whiteSpace:"nowrap"}}>{p.client}</td>
                    <td><span className="badge" style={{background:pc.bg,color:pc.text}}>{projectStatusLabel[p.status]}</span></td>
                    <td style={{minWidth:120}}>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <div style={{flex:1,height:5,background:"#f0f4f8",borderRadius:99,overflow:"hidden"}}>
                          <div className="top5-bar" style={{height:"100%",width:`${p.progress}%`,background:p.status==="completed"?"#059669":PRIMARY,borderRadius:99}}/>
                        </div>
                        <span style={{fontSize:"0.7rem",fontWeight:700,color:SUB,minWidth:28}}>{p.progress}%</span>
                      </div>
                    </td>
                    <td style={{color:SUB,whiteSpace:"nowrap",fontSize:"0.74rem"}}>{p.due}</td>
                    <td style={{fontWeight:700,fontSize:"0.74rem",color:p.daysLeft<0?"#dc2626":p.daysLeft<14?"#f59e0b":"#059669",whiteSpace:"nowrap"}}>
                      {p.status==="completed"?"–":p.daysLeft<0?`เกิน ${Math.abs(p.daysLeft)} วัน`:`${p.daysLeft} วัน`}
                    </td>
                    <td><span className="badge" style={{background:h.bg,color:h.color}}>{h.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showModal&&<ReportModal displayData={displayData} dateFrom={dateFrom} dateTo={dateTo} onClose={()=>setShowModal(false)}/>}
    </div>
  );
}
