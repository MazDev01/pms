"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  tasks, projects,
  taskStatusBadge, taskStatusLabel,
  projectStatusColor, projectStatusLabel,
} from "@/lib/mock";
import { Plus, Download, Pencil, Trash2, X, Search, ArrowRight, ExternalLink, ChevronDown, ClipboardList } from "lucide-react";

// ── Tokens ────────────────────────────────────────────────────
const PRIMARY = "#003366";
const STEEL   = "#2D2D2D";
const BORDER  = "#e5e7eb";
const MUTED   = "#6b7280";
const AVATAR_COLORS = ["#003366","#059669","#f59e0b","#0369a1","#002244","#8fa3b8","#2D2D2D","#C0C0C0"];

// ── Types ─────────────────────────────────────────────────────
type MemberStatus = "online"|"busy"|"offline";
type PermLevel    = "full"|"view"|"none";

type TeamMember = {
  id: number; name: string; position: string; dept: string;
  initial: string; color: string; status: MemberStatus;
  projects: number; done: number; pending: number;
  nickname?: string; // matches mock task/project assigned[] short names
};
type RoleRow = {
  id: number; role: string; members: number;
  projects: PermLevel; tasks: PermLevel; clients: PermLevel;
  reports: PermLevel; settings: PermLevel;
};
type MemberForm = { name:string; position:string; dept:string; status:MemberStatus; };
type RoleForm   = { role:string; members:number; projects:PermLevel; tasks:PermLevel; clients:PermLevel; reports:PermLevel; settings:PermLevel; };

// ── Initial Data ──────────────────────────────────────────────
const DEPTS = ["บริหารการขาย","พัฒนาธุรกิจ","ดูแลลูกค้า","ขายภาคสนาม","ออกแบบงานขาย","วิเคราะห์การขาย","วิเคราะห์ธุรกิจ","ขาย"];
const POSITIONS = ["ผู้จัดการฝ่ายขาย","ที่ปรึกษาการขายอาวุโส","ผู้ประสานงานขาย","ผู้แทนขายภาคสนาม","นักออกแบบงานขาย","ตัวแทนขาย","นักวิเคราะห์การขาย","นักวิเคราะห์ธุรกิจ","ผู้จัดการฝ่ายขาย"];

const MEMBERS_INIT: TeamMember[] = [
  { id:1, name:"อารยา สุขวิเศษ",    position:"ผู้จัดการฝ่ายขาย",   dept:"บริหารการขาย",    initial:"อ", color:AVATAR_COLORS[0], status:"online",  projects:4, done:8,  pending:2 },
  { id:2, name:"กิตติ พรมมา",        position:"ที่ปรึกษาการขายอาวุโส",  dept:"พัฒนาธุรกิจ",   initial:"ก", color:AVATAR_COLORS[1], status:"online",  projects:3, done:12, pending:3 },
  { id:3, name:"ประภัสสร ดาวรุ่ง",   position:"ผู้ประสานงานขาย",       dept:"ดูแลลูกค้า",         initial:"ป", color:AVATAR_COLORS[2], status:"busy",    projects:2, done:6,  pending:4 },
  { id:4, name:"ธนพล วิชาศิลป์",    position:"ผู้แทนขายภาคสนาม",   dept:"ขายภาคสนาม",  initial:"ธ", color:AVATAR_COLORS[3], status:"online",  projects:4, done:9,  pending:1 },
  { id:5, name:"นิภาพร จันทร์สว่าง", position:"นักออกแบบงานขาย",    dept:"ออกแบบงานขาย",            initial:"น", color:AVATAR_COLORS[4], status:"online",  projects:3, done:7,  pending:2 },
  { id:6, name:"สมชาย พันธ์ดี",      position:"ตัวแทนขาย", dept:"พัฒนาธุรกิจ",   initial:"ส", color:AVATAR_COLORS[5], status:"busy",    projects:2, done:5,  pending:3, nickname:"สมชาย" },
  { id:7, name:"มานี รักดี",          position:"นักวิเคราะห์การขาย",      dept:"วิเคราะห์การขาย",   initial:"ม", color:AVATAR_COLORS[6], status:"offline", projects:1, done:3,  pending:1 },
  { id:8, name:"วรรณา ศรีสุข",       position:"นักวิเคราะห์ธุรกิจ",  dept:"วิเคราะห์ธุรกิจ",   initial:"ว", color:AVATAR_COLORS[7], status:"offline", projects:2, done:4,  pending:2 },
];
const ROLES_INIT: RoleRow[] = [
  { id:1, role:"ผู้ดูแล",           members:1, projects:"full", tasks:"full", clients:"full", reports:"full", settings:"full" },
  { id:2, role:"ผู้จัดการฝ่ายขาย", members:2, projects:"full", tasks:"full", clients:"view", reports:"full", settings:"none" },
  { id:3, role:"ตัวแทนขาย",       members:3, projects:"view", tasks:"full", clients:"none", reports:"view", settings:"none" },
  { id:4, role:"ผู้ดูข้อมูล",          members:2, projects:"view", tasks:"view", clients:"view", reports:"view", settings:"none" },
];

// ── Helpers ───────────────────────────────────────────────────
const STATUS_COLOR: Record<MemberStatus,string> = { online:"#059669", busy:"#f59e0b", offline:"#94a3b8" };
const STATUS_LABEL: Record<MemberStatus,string> = { online:"ออนไลน์", busy:"ไม่ว่าง", offline:"ออฟไลน์" };
const PERM_STYLES: Record<PermLevel,{bg:string;color:string;label:string}> = {
  full:{ bg:"#dce5f0", color:PRIMARY, label:"เต็ม" },
  view:{ bg:"#f0f4f8", color:"#6b7280", label:"ดู" },
  none:{ bg:"#f5f5f5", color:"#9ca3af", label:"ไม่ได้" },
};

function nextMemberId(members:TeamMember[]){ return Math.max(...members.map(m=>m.id),0)+1; }
function nextRoleId(roles:RoleRow[]){ return Math.max(...roles.map(r=>r.id),0)+1; }
function exportCSV(members:TeamMember[]){
  const h=["ชื่อ","ตำแหน่ง","แผนก","สถานะ","โอกาสการขาย","งานเสร็จ","ค้างอยู่"];
  const lines=members.map(m=>[m.name,m.position,m.dept,STATUS_LABEL[m.status],m.projects,m.done,m.pending].join(","));
  const blob=new Blob(["﻿"+[h.join(","),...lines].join("\n")],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download="team.csv"; a.click(); URL.revokeObjectURL(url);
}
// Match member to mock tasks/projects by nickname or first name prefix
function memberTasks(m:TeamMember){ const key=m.nickname||null; if(!key) return []; return tasks.filter(t=>t.assigned.includes(key)); }
function memberProjects(m:TeamMember){ const key=m.nickname||null; if(!key) return []; return projects.filter(p=>p.assigned.includes(key)); }

// ── Sub-components ────────────────────────────────────────────
function StatusDot({status}:{status:MemberStatus}){
  return <span style={{display:"flex",alignItems:"center",gap:5,fontSize:".68rem",fontWeight:700,color:STATUS_COLOR[status]}}><span style={{width:7,height:7,borderRadius:"50%",background:STATUS_COLOR[status],display:"inline-block",flexShrink:0}}/>{STATUS_LABEL[status]}</span>;
}
function PermBadge({level}:{level:PermLevel}){
  const s=PERM_STYLES[level];
  return <span className="badge" style={{background:s.bg,color:s.color}}>{s.label}</span>;
}
function Avatar({m,size=44}:{m:TeamMember;size?:number}){
  return <div style={{width:size,height:size,borderRadius:size/3,flexShrink:0,background:m.color,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:size*0.4}}>
    {m.initial}
  </div>;
}

// ── Member Card ───────────────────────────────────────────────
function MemberCard({m,selected,onClick}:{m:TeamMember;selected:boolean;onClick:()=>void}){
  return (
    <div onClick={onClick} className="card stat-card clickable" style={{padding:"16px 14px 13px",position:"relative",borderColor:selected?PRIMARY:undefined,boxShadow:selected?"0 0 0 2px rgba(0,51,102,.25)":undefined,minHeight:170,display:"flex",flexDirection:"column"}}>
      <div style={{position:"absolute",top:10,right:10}}><StatusDot status={m.status}/></div>
      <div style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:12,paddingRight:68,flex:1}}>
        <Avatar m={m} size={42}/>
        <div style={{minWidth:0,flex:1}}>
          <div style={{fontSize:".84rem",fontWeight:700,color:STEEL,lineHeight:1.35,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{m.name}</div>
          <div style={{fontSize:".7rem",color:MUTED,marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{m.position}</div>
          <div style={{fontSize:".66rem",color:PRIMARY,fontWeight:600,marginTop:3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{m.dept}</div>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:4,paddingTop:10,borderTop:`1px solid ${BORDER}`}}>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:".95rem",fontWeight:800,color:"#003366"}}>{m.projects}</div>
          <div style={{fontSize:".6rem",color:MUTED,marginTop:1}}>โอกาสการขาย</div>
        </div>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:".95rem",fontWeight:800,color:"#059669"}}>{m.done}</div>
          <div style={{fontSize:".6rem",color:MUTED,marginTop:1}}>งานเสร็จ</div>
        </div>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:".95rem",fontWeight:800,color:m.pending<=2?"#059669":m.pending<=3?"#f59e0b":"#dc2626"}}>{m.pending}</div>
          <div style={{fontSize:".6rem",color:MUTED,marginTop:1}}>ค้างอยู่</div>
        </div>
      </div>
    </div>
  );
}

// ── Member Modal ──────────────────────────────────────────────
function MemberModal({initial,title,onSave,onClose}:{initial:MemberForm;title:string;onSave:(f:MemberForm)=>void;onClose:()=>void}){
  const [form,setForm]=useState<MemberForm>(initial);
  function submit(){if(!form.name.trim()) return; onSave(form); onClose();}
  return (
    <div className="erp">
      <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(45,45,45,.4)",zIndex:200}}/>
      <div style={{position:"fixed",inset:0,zIndex:210,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
        <div onClick={e=>e.stopPropagation()} className="card" style={{width:"100%",maxWidth:440,overflow:"hidden",boxShadow:"0 24px 80px rgba(0,0,0,.2)"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 22px",borderBottom:`1px solid ${BORDER}`,background:PRIMARY}}>
            <div style={{fontSize:"0.92rem",fontWeight:800,color:"#fff"}}>{title}</div>
            <button onClick={onClose} style={{width:28,height:28,borderRadius:8,border:"1px solid rgba(255,255,255,.2)",background:"rgba(255,255,255,.1)",color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><X size={13}/></button>
          </div>
          <div style={{padding:"20px 22px",display:"flex",flexDirection:"column",gap:12}}>
            <div><label className="form-label">ชื่อ-นามสกุล *</label><input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="ชื่อสมาชิก" className="form-input"/></div>
            <div><label className="form-label">ตำแหน่ง</label>
              <select value={form.position} onChange={e=>setForm(p=>({...p,position:e.target.value}))} className="form-select">
                {POSITIONS.map(pos=><option key={pos} value={pos}>{pos}</option>)}
              </select>
            </div>
            <div><label className="form-label">แผนก</label>
              <select value={form.dept} onChange={e=>setForm(p=>({...p,dept:e.target.value}))} className="form-select">
                {DEPTS.map(d=><option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div><label className="form-label">สถานะ</label>
              <select value={form.status} onChange={e=>setForm(p=>({...p,status:e.target.value as MemberStatus}))} className="form-select">
                <option value="online">ออนไลน์</option>
                <option value="busy">ไม่ว่าง</option>
                <option value="offline">ออฟไลน์</option>
              </select>
            </div>
          </div>
          <div style={{padding:"13px 22px",borderTop:`1px solid ${BORDER}`,display:"flex",gap:8,justifyContent:"flex-end",background:"#fafafa"}}>
            <button onClick={onClose} className="btn btn-secondary btn-sm">ยกเลิก</button>
            <button onClick={submit} className="btn btn-primary btn-sm">บันทึก</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Role Modal ────────────────────────────────────────────────
function RoleModal({initial,title,onSave,onClose}:{initial:RoleForm;title:string;onSave:(f:RoleForm)=>void;onClose:()=>void}){
  const [form,setForm]=useState<RoleForm>(initial);
  const PERMS:[keyof RoleForm,string][]=[["projects","โอกาสการขาย"],["tasks","งานขาย"],["clients","ลูกค้า"],["reports","รายงาน"],["settings","ตั้งค่า"]];
  function submit(){if(!form.role.trim()) return; onSave(form); onClose();}
  return (
    <div className="erp">
      <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(45,45,45,.4)",zIndex:200}}/>
      <div style={{position:"fixed",inset:0,zIndex:210,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
        <div onClick={e=>e.stopPropagation()} className="card" style={{width:"100%",maxWidth:440,overflow:"hidden",boxShadow:"0 24px 80px rgba(0,0,0,.2)"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 22px",borderBottom:`1px solid ${BORDER}`,background:PRIMARY}}>
            <div style={{fontSize:"0.92rem",fontWeight:800,color:"#fff"}}>{title}</div>
            <button onClick={onClose} style={{width:28,height:28,borderRadius:8,border:"1px solid rgba(255,255,255,.2)",background:"rgba(255,255,255,.1)",color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><X size={13}/></button>
          </div>
          <div style={{padding:"20px 22px",display:"flex",flexDirection:"column",gap:12}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div><label className="form-label">ชื่อบทบาท *</label><input value={form.role} onChange={e=>setForm(p=>({...p,role:e.target.value}))} placeholder="ชื่อบทบาท" className="form-input"/></div>
              <div><label className="form-label">จำนวนสมาชิก</label><input type="number" min={0} value={form.members} onChange={e=>setForm(p=>({...p,members:Number(e.target.value)}))} className="form-input"/></div>
            </div>
            <div className="form-label" style={{marginTop:4,marginBottom:0}}>สิทธิ์การเข้าถึง</div>
            {PERMS.map(([key,label])=>(
              <div key={key} style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <span style={{fontSize:"0.82rem",color:STEEL,fontWeight:600}}>{label}</span>
                <div style={{display:"flex",gap:6}}>
                  {(["full","view","none"] as PermLevel[]).map(lv=>{
                    const sel=form[key]===lv;
                    const s=PERM_STYLES[lv];
                    return <button key={lv} type="button" onClick={()=>setForm(p=>({...p,[key]:lv}))}
                      style={{padding:"4px 10px",borderRadius:7,border:`1px solid ${sel?s.color:BORDER}`,background:sel?s.bg:"#fff",color:sel?s.color:MUTED,fontSize:"0.7rem",fontWeight:sel?700:500,cursor:"pointer"}}>
                      {s.label}
                    </button>;
                  })}
                </div>
              </div>
            ))}
          </div>
          <div style={{padding:"13px 22px",borderTop:`1px solid ${BORDER}`,display:"flex",gap:8,justifyContent:"flex-end",background:"#fafafa"}}>
            <button onClick={onClose} className="btn btn-secondary btn-sm">ยกเลิก</button>
            <button onClick={submit} className="btn btn-primary btn-sm">บันทึก</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Detail Panel ──────────────────────────────────────────────
function DetailPanel({m,onClose,onEdit,onChangeStatus,onDelete}:{
  m:TeamMember; onClose:()=>void; onEdit:()=>void; onChangeStatus:(s:MemberStatus)=>void; onDelete:()=>void;
}){
  const router=useRouter();
  const [tab,setTab]=useState<"info"|"work">("info");
  const [delConfirm,setDelConfirm]=useState(false);
  const mTasks=memberTasks(m);
  const mProjects=memberProjects(m);
  const doneTaskCount=mTasks.filter(t=>t.status==="done").length;
  const totalTasks=m.done+m.pending;
  const pct=totalTasks>0?Math.round((m.done/totalTasks)*100):0;
  return (
    <>
      <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(45,45,45,.45)",zIndex:200}}/>
      <div style={{position:"fixed",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:760,maxWidth:"calc(100vw - 32px)",height:"min(660px, calc(100vh - 48px))",zIndex:210,background:"#fff",borderRadius:18,boxShadow:"0 24px 80px rgba(0,0,0,.22)",display:"flex",flexDirection:"column",overflow:"hidden"}}>
      {/* Header */}
      <div style={{background:PRIMARY,padding:"16px 18px 12px",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:10}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:46,height:46,borderRadius:13,flexShrink:0,background:m.color,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:"1.15rem"}}>{m.initial}</div>
            <div>
              <div style={{fontSize:"1rem",fontWeight:800,color:"#fff",lineHeight:1.3}}>{m.name}</div>
              <div style={{fontSize:"0.74rem",color:"rgba(255,255,255,.75)",marginTop:2}}>{m.position}</div>
            </div>
          </div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,.15)",border:"none",borderRadius:8,width:30,height:30,cursor:"pointer",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><X size={15}/></button>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:"0.7rem",fontWeight:600,color:"rgba(255,255,255,.85)",background:"rgba(255,255,255,.12)",padding:"3px 10px",borderRadius:99}}>{m.dept}</span>
          <span style={{color:"rgba(255,255,255,.4)"}}>·</span>
          <StatusDot status={m.status}/>
        </div>
      </div>
      {/* Tabs */}
      <div className="tab-bar" style={{flexShrink:0}}>
        {([["info","ข้อมูล"],["work","งาน/โอกาสการขาย"]] as [string,string][]).map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k as typeof tab)}
            className={`tab-item${tab===k?" active":""}`} style={{flex:1}}>
            {l}
          </button>
        ))}
      </div>

      {/* Two-column body */}
      <div style={{display:"flex",flex:1,overflow:"hidden"}}>
        <div style={{flex:1,overflowY:"auto",borderRight:"1px solid #f0f4f8"}}>
      {/* Tab: ข้อมูล */}
      {tab==="info"&&(
        <div style={{padding:"16px 18px"}}>
          {/* Stats */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
            {[{l:"โอกาสการขาย",v:m.projects,c:"#003366"},{l:"งานเสร็จ",v:m.done,c:"#059669"},{l:"ค้างอยู่",v:m.pending,c:m.pending<=2?"#059669":m.pending<=3?"#f59e0b":"#dc2626"}].map((s,i)=>(
              <div key={i} style={{textAlign:"center",padding:"10px 6px",borderRadius:10,background:"#f8f9fb",border:`1px solid ${BORDER}`}}>
                <div style={{fontSize:"1.3rem",fontWeight:800,color:s.c,lineHeight:1}}>{s.v}</div>
                <div style={{fontSize:"0.62rem",color:MUTED,marginTop:2}}>{s.l}</div>
              </div>
            ))}
          </div>
          {/* Completion rate */}
          <div style={{marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
              <span style={{fontSize:"0.7rem",color:MUTED,fontWeight:600}}>อัตราสำเร็จ</span>
              <span style={{fontSize:"0.7rem",fontWeight:800,color:"#059669"}}>{pct}%</span>
            </div>
            <div style={{height:6,background:"#f0f4f8",borderRadius:99,overflow:"hidden"}}>
              <div className="top5-bar" style={{height:"100%",width:`${pct}%`,background:"#059669",borderRadius:99}}/>
            </div>
          </div>
          {/* Status change */}
          <div style={{fontSize:"0.63rem",fontWeight:700,color:MUTED,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>เปลี่ยนสถานะ</div>
          <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:14}}>
            {(["online","busy","offline"] as MemberStatus[]).filter(s=>s!==m.status).map(s=>(
              <button key={s} onClick={()=>onChangeStatus(s)}
                style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",borderRadius:10,background:s==="online"?"#e5faf0":s==="busy"?"#fff3e0":"#f5f5f5",border:"none",cursor:"pointer"}}>
                <span style={{fontSize:"0.76rem",fontWeight:700,color:STATUS_COLOR[s]}}>→ {STATUS_LABEL[s]}</span>
                <ArrowRight size={13} color={STATUS_COLOR[s]}/>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tab: งาน/โอกาสการขาย */}
      {tab==="work"&&(
        <div style={{padding:"12px 14px"}}>
          {/* Real projects from mock */}
          {mProjects.length>0&&(
            <>
              <div style={{fontSize:"0.63rem",fontWeight:700,color:MUTED,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>โอกาสการขายในระบบ ({mProjects.length})</div>
              <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:12}}>
                {mProjects.map(p=>{
                  const pc=projectStatusColor[p.status];
                  return (
                    <div key={p.id} onClick={()=>router.push("/pipeline")} style={{padding:"9px 11px",borderRadius:10,background:"#f8f9fb",border:`1px solid ${BORDER}`,cursor:"pointer"}}
                      onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor=PRIMARY;}}
                      onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor=BORDER;}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                        <div style={{fontSize:"0.74rem",fontWeight:700,color:STEEL,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginRight:6}}>{p.title}</div>
                        <span className="badge" style={{background:pc.bg,color:pc.text}}>{projectStatusLabel[p.status]}</span>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <div style={{flex:1,height:4,background:"#e8ecf2",borderRadius:99,overflow:"hidden"}}>
                          <div className="top5-bar" style={{height:"100%",width:`${p.progress}%`,background:pc.text,borderRadius:99}}/>
                        </div>
                        <span style={{fontSize:"0.62rem",color:MUTED}}>{p.progress}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          {/* Real tasks from mock */}
          {mTasks.length>0&&(
            <>
              <div style={{fontSize:"0.63rem",fontWeight:700,color:MUTED,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>งานในระบบ ({mTasks.length} รายการ · เสร็จ {doneTaskCount})</div>
              <div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:12}}>
                {mTasks.slice(0,5).map(t=>{
                  const b=taskStatusBadge[t.status];
                  return (
                    <div key={t.id} onClick={()=>router.push("/tasks")} style={{padding:"8px 10px",borderRadius:9,background:"#f8f9fb",border:`1px solid ${BORDER}`,cursor:"pointer"}}
                      onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor=PRIMARY;}}
                      onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor=BORDER;}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:6}}>
                        <div style={{fontSize:"0.73rem",fontWeight:600,color:STEEL,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.title}</div>
                        <span className="badge" style={{background:b.bg,color:b.text}}>{taskStatusLabel[t.status]}</span>
                      </div>
                    </div>
                  );
                })}
                {mTasks.length>5&&<div style={{fontSize:"0.68rem",color:MUTED,textAlign:"center",padding:4}}>และอีก {mTasks.length-5} งาน</div>}
              </div>
            </>
          )}
          {mTasks.length===0&&mProjects.length===0&&(
            <div style={{textAlign:"center",padding:"16px 0 8px",color:MUTED,fontSize:"0.76rem",lineHeight:1.6}}>
              <div style={{marginBottom:8,display:"flex",justifyContent:"center"}}><ClipboardList size={28} color="#9ca3af" strokeWidth={1.5} /></div>
              ไม่มีข้อมูลงานในระบบสำหรับสมาชิกนี้<br/>
              <span style={{fontSize:"0.68rem"}}>ข้อมูลจากโอกาสการขายและงานใช้ชื่อย่อ</span>
            </div>
          )}
        </div>
      )}
        </div>

        {/* Action rail */}
        <div style={{width:210,flexShrink:0,padding:"16px",display:"flex",flexDirection:"column",gap:8,overflowY:"auto"}}>
          <div style={{fontSize:"0.63rem",fontWeight:700,color:MUTED,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:2}}>การจัดการ</div>
          <button onClick={onEdit} className="btn btn-primary btn-sm" style={{justifyContent:"center"}}>
            <Pencil size={13}/> แก้ไขข้อมูล
          </button>
          <button onClick={()=>router.push("/tasks")} className="btn btn-tint btn-sm" style={{justifyContent:"center"}}>
            <ExternalLink size={13}/> ดูงานทั้งหมด
          </button>
          <button onClick={()=>router.push("/pipeline")} className="btn btn-secondary btn-sm" style={{justifyContent:"center"}}>
            <ExternalLink size={13}/> ดูโอกาสการขาย
          </button>
          <div style={{flex:1}}/>
          {!delConfirm?(
            <button onClick={()=>setDelConfirm(true)} className="btn btn-danger btn-sm" style={{justifyContent:"center"}}>
              <Trash2 size={12}/> ลบสมาชิก
            </button>
          ):(
            <div style={{borderRadius:10,border:"1px solid #fca5a5",overflow:"hidden"}}>
              <div style={{padding:"7px 12px",background:"#fee2e2",fontSize:"0.7rem",color:"#dc2626",fontWeight:600}}>ยืนยันลบ {m.name}?</div>
              <div style={{display:"flex"}}>
                <button onClick={onDelete} style={{flex:1,padding:"7px",background:"#dc2626",border:"none",color:"#fff",fontSize:"0.7rem",fontWeight:700,cursor:"pointer"}}>ลบ</button>
                <button onClick={()=>setDelConfirm(false)} style={{flex:1,padding:"7px",background:"#fff",border:"none",borderLeft:"1px solid #fca5a5",color:STEEL,fontSize:"0.7rem",cursor:"pointer"}}>ยกเลิก</button>
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function TeamPage(){
  const [members,setMembers]     = useState<TeamMember[]>(MEMBERS_INIT);
  const [roles,setRoles]         = useState<RoleRow[]>(ROLES_INIT);
  const [view,setView]           = useState<"card"|"table">("card");
  const [query,setQuery]         = useState("");
  const [filterDept,setFilterDept] = useState("ALL");
  const [filterStatus,setFilterStatus] = useState<MemberStatus|"ALL">("ALL");
  const [selectedId,setSelectedId] = useState<number|null>(null);
  const [showMemberModal,setShowMemberModal] = useState(false);
  const [showRoleModal,setShowRoleModal]     = useState(false);
  const [editingMember,setEditingMember]     = useState<TeamMember|null>(null);
  const [editingRole,setEditingRole]         = useState<RoleRow|null>(null);

  const depts = useMemo(()=>Array.from(new Set(members.map(m=>m.dept))).sort(),[members]);
  const filtered = useMemo(()=>{
    const q=query.toLowerCase();
    return members.filter(m=>{
      const matchQ=!q||m.name.toLowerCase().includes(q)||m.position.toLowerCase().includes(q)||m.dept.includes(q);
      const matchD=filterDept==="ALL"||m.dept===filterDept;
      const matchS=filterStatus==="ALL"||m.status===filterStatus;
      return matchQ&&matchD&&matchS;
    });
  },[members,query,filterDept,filterStatus]);

  const selectedMember=selectedId!==null?members.find(m=>m.id===selectedId)??null:null;
  const totalOnline=members.filter(m=>m.status==="online").length;
  const totalPending=members.reduce((s,m)=>s+m.pending,0);

  function openAddMember(){ setEditingMember(null); setShowMemberModal(true); }
  function openEditMember(m:TeamMember){ setEditingMember(m); setShowMemberModal(true); }
  function openAddRole(){ setEditingRole(null); setShowRoleModal(true); }
  function openEditRole(r:RoleRow){ setEditingRole(r); setShowRoleModal(true); }

  function saveMember(form:MemberForm){
    if(editingMember){
      setMembers(d=>d.map(m=>m.id===editingMember.id?{...m,...form}:m));
    } else {
      const idx=members.length;
      const newM:TeamMember={id:nextMemberId(members),initial:form.name.charAt(0),color:AVATAR_COLORS[idx%AVATAR_COLORS.length],projects:0,done:0,pending:0,...form};
      setMembers(d=>[...d,newM]);
    }
  }
  function saveRole(form:RoleForm){
    if(editingRole){
      setRoles(d=>d.map(r=>r.id===editingRole.id?{...r,...form}:r));
    } else {
      setRoles(d=>[...d,{id:nextRoleId(roles),...form}]);
    }
  }
  function changeStatus(id:number,s:MemberStatus){
    setMembers(d=>d.map(m=>m.id===id?{...m,status:s}:m));
  }
  function deleteMember(){
    if(!selectedId) return;
    setMembers(d=>d.filter(m=>m.id!==selectedId));
    setSelectedId(null);
  }
  function deleteRole(id:number){ setRoles(d=>d.filter(r=>r.id!==id)); }

  function toMemberForm(m:TeamMember):MemberForm{ return {name:m.name,position:m.position,dept:m.dept,status:m.status}; }
  function blankMemberForm():MemberForm{ return {name:"",position:POSITIONS[0],dept:DEPTS[0],status:"online"}; }
  function toRoleForm(r:RoleRow):RoleForm{ return {role:r.role,members:r.members,projects:r.projects,tasks:r.tasks,clients:r.clients,reports:r.reports,settings:r.settings}; }
  function blankRoleForm():RoleForm{ return {role:"",members:0,projects:"view",tasks:"view",clients:"none",reports:"view",settings:"none"}; }

  const STAT_CARDS=[
    {l:"สมาชิกทั้งหมด",v:members.length,c:"#003366",kpi:"kpi-navy",filter:()=>setFilterStatus("ALL")},
    {l:"ออนไลน์ตอนนี้", v:totalOnline,    c:"#059669",kpi:"kpi-green",filter:()=>setFilterStatus("online")},
    {l:"ไม่ว่าง",        v:members.filter(m=>m.status==="busy").length,c:"#f59e0b",kpi:"kpi-amber",filter:()=>setFilterStatus("busy")},
    {l:"งานที่ดำเนินการ",v:totalPending,   c:"#dc2626",kpi:"kpi-steel",filter:()=>setFilterStatus("ALL")},
  ];

  return (
    <div className="erp">
      {/* Header */}
      <div className="page-head">
        <div>
          <h2>ทีมงาน</h2>
          <p>จัดการสมาชิกทีมและสิทธิ์การเข้าถึง · {members.length} คน</p>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>exportCSV(filtered)} className="btn btn-secondary btn-sm">
            <Download size={13}/> ส่งออก
          </button>
          <button onClick={openAddMember} className="btn btn-primary btn-sm">
            <Plus size={13}/> เพิ่มสมาชิก
          </button>
        </div>
      </div>

      {/* Stats cards (KPI bar) */}
      <div className="kpi-bar">
        {STAT_CARDS.map((s,i)=>(
          <div key={i} onClick={s.filter} className="kpi" style={{flexDirection:"row",alignItems:"center",gap:14,cursor:"pointer"}}>
            <div className={`kpi-icon ${s.kpi}`}>
              <span style={{fontSize:"1.1rem"}}>●</span>
            </div>
            <div>
              <div className="kpi-val" style={{color:s.c}}>{s.v}</div>
              <div className="kpi-label">{s.l}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{minWidth:0}}>
          {/* Toolbar */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,gap:10,flexWrap:"wrap"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,background:"#fff",border:`1px solid ${BORDER}`,borderRadius:9,padding:"6px 12px",minWidth:200}}>
                <Search size={14} color="#9ca3af"/>
                <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="ค้นหาสมาชิก..."
                  style={{border:"none",outline:"none",fontSize:".8rem",color:STEEL,background:"transparent",flex:1}}/>
                {query&&<button onClick={()=>setQuery("")} style={{background:"none",border:"none",cursor:"pointer",padding:0,color:MUTED,display:"flex"}}><X size={12}/></button>}
              </div>
              <div style={{position:"relative"}}>
                <select value={filterDept} onChange={e=>setFilterDept(e.target.value)} className="form-select" style={{width:"auto",padding:"6px 26px 6px 10px",fontSize:"0.78rem"}}>
                  <option value="ALL">ทั้งหมด</option>
                  {depts.map(d=><option key={d} value={d}>{d}</option>)}
                </select>
                <ChevronDown size={11} color={MUTED} style={{position:"absolute",right:7,top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}}/>
              </div>
              <div style={{position:"relative"}}>
                <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value as MemberStatus|"ALL")} className="form-select" style={{width:"auto",padding:"6px 26px 6px 10px",fontSize:"0.78rem"}}>
                  <option value="ALL">ทั้งหมด</option>
                  <option value="online">ออนไลน์</option>
                  <option value="busy">ไม่ว่าง</option>
                  <option value="offline">ออฟไลน์</option>
                </select>
                <ChevronDown size={11} color={MUTED} style={{position:"absolute",right:7,top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}}/>
              </div>
              {(filterDept!=="ALL"||filterStatus!=="ALL"||query)&&(
                <button onClick={()=>{setFilterDept("ALL");setFilterStatus("ALL");setQuery("");}}
                  style={{display:"flex",alignItems:"center",gap:4,padding:"5px 10px",borderRadius:99,background:"#fee2e2",color:"#dc2626",border:"none",fontSize:"0.72rem",fontWeight:700,cursor:"pointer"}}>
                  <X size={10}/> ล้าง
                </button>
              )}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:"0.72rem",color:MUTED}}>{filtered.length} คน</span>
              {[["card","การ์ด"],["table","ตาราง"]].map(([v,l])=>(
                <button key={v} onClick={()=>{setView(v as "card"|"table");if(v==="table")setSelectedId(null);}}
                  className={`btn btn-sm ${view===v?"btn-tint":"btn-secondary"}`}>
                  {l}
                </button>
              ))}
              <button onClick={openAddMember} className="btn btn-primary btn-sm" style={{width:34,height:34,padding:0,justifyContent:"center"}}>
                <Plus size={16}/>
              </button>
            </div>
          </div>

          {/* Card Grid */}
          {view==="card"&&(
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:14}}>
              {filtered.length===0&&<div style={{gridColumn:"1/-1",textAlign:"center",padding:"40px 0",color:MUTED,fontSize:"0.84rem"}}>ไม่พบสมาชิก</div>}
              {filtered.map(m=><MemberCard key={m.id} m={m} selected={selectedId===m.id} onClick={()=>setSelectedId(selectedId===m.id?null:m.id)}/>)}
            </div>
          )}

          {/* Table */}
          {view==="table"&&(
            <div className="card" style={{overflow:"hidden",marginBottom:14}}>
              <div className="table-wrap" style={{borderTop:"none"}}>
                <table>
                  <colgroup>
                    <col style={{width:"22%"}} />
                    <col style={{width:"16%"}} />
                    <col style={{width:"14%"}} />
                    <col style={{width:"11%"}} />
                    <col style={{width:"11%"}} />
                    <col style={{width:"9%"}} />
                    <col style={{width:"9%"}} />
                    <col style={{width:"8%"}} />
                  </colgroup>
                  <thead><tr>
                    {["สมาชิก","ตำแหน่ง","แผนก","สถานะ","โอกาสการขาย","งานเสร็จ","ค้างอยู่",""].map((h,i)=>(
                      <th key={i}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {filtered.length===0&&<tr><td colSpan={8} style={{textAlign:"center",padding:"32px",color:MUTED}}>ไม่พบสมาชิก</td></tr>}
                    {filtered.map(m=>(
                      <tr key={m.id}>
                        <td onClick={()=>setSelectedId(selectedId===m.id?null:m.id)} style={{cursor:"pointer"}}>
                          <div style={{display:"flex",alignItems:"center",gap:10}}>
                            <div style={{width:32,height:32,borderRadius:9,flexShrink:0,background:m.color,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:".8rem"}}>{m.initial}</div>
                            <span style={{fontWeight:600,color:STEEL}}>{m.name}</span>
                          </div>
                        </td>
                        <td style={{color:MUTED}}>{m.position}</td>
                        <td style={{color:PRIMARY,fontSize:".72rem",fontWeight:600}}>{m.dept}</td>
                        <td><StatusDot status={m.status}/></td>
                        <td style={{fontWeight:700,color:"#003366"}}>{m.projects}</td>
                        <td style={{fontWeight:700,color:"#059669"}}>{m.done}</td>
                        <td style={{fontWeight:700,color:m.pending<=2?"#059669":m.pending<=3?"#f59e0b":"#dc2626"}}>{m.pending}</td>
                        <td>
                          <button onClick={()=>openEditMember(m)} className="btn btn-secondary btn-sm" style={{width:29,height:29,padding:0,justifyContent:"center"}}>
                            <Pencil size={12}/>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Roles & Permissions */}
          <div className="card" style={{overflow:"hidden"}}>
            <div className="card-header">
              <div className="card-title">บทบาทและสิทธิ์</div>
              <button onClick={openAddRole} className="btn btn-primary btn-sm">
                <Plus size={12}/> เพิ่มบทบาท
              </button>
            </div>
            <div className="table-wrap">
              <table>
                <colgroup>
                  <col style={{width:"22%"}} />
                  <col style={{width:"10%"}} />
                  <col style={{width:"11%"}} />
                  <col style={{width:"11%"}} />
                  <col style={{width:"10%"}} />
                  <col style={{width:"10%"}} />
                  <col style={{width:"10%"}} />
                  <col style={{width:"9%"}} />
                </colgroup>
                <thead><tr>
                  {["บทบาท","สมาชิก","โอกาสการขาย","งานขาย","ลูกค้า","รายงาน","ตั้งค่า",""].map((h,i)=>(
                    <th key={i}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {roles.map(r=>(
                    <tr key={r.id}>
                      <td style={{fontWeight:700,color:STEEL}}>{r.role}</td>
                      <td style={{color:MUTED}}>{r.members}</td>
                      <td><PermBadge level={r.projects}/></td>
                      <td><PermBadge level={r.tasks}/></td>
                      <td><PermBadge level={r.clients}/></td>
                      <td><PermBadge level={r.reports}/></td>
                      <td><PermBadge level={r.settings}/></td>
                      <td>
                        <div style={{display:"flex",gap:4}}>
                          <button onClick={()=>openEditRole(r)} className="btn btn-secondary btn-sm" style={{width:29,height:29,padding:0,justifyContent:"center"}}>
                            <Pencil size={12}/>
                          </button>
                          {r.id>1&&(
                            <button onClick={()=>deleteRole(r.id)} className="btn btn-danger btn-sm" style={{width:29,height:29,padding:0,justifyContent:"center"}}>
                              <Trash2 size={12}/>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        {/* Detail Modal */}
        {selectedMember&&(
          <DetailPanel
            m={selectedMember}
            onClose={()=>setSelectedId(null)}
            onEdit={()=>openEditMember(selectedMember)}
            onChangeStatus={(s)=>changeStatus(selectedMember.id,s)}
            onDelete={deleteMember}/>
        )}
      </div>

      {showMemberModal&&(
        <MemberModal
          title={editingMember?"แก้ไขสมาชิก":"เพิ่มสมาชิกใหม่"}
          initial={editingMember?toMemberForm(editingMember):blankMemberForm()}
          onSave={saveMember}
          onClose={()=>{setShowMemberModal(false);setEditingMember(null);}}/>
      )}
      {showRoleModal&&(
        <RoleModal
          title={editingRole?"แก้ไขบทบาท":"เพิ่มบทบาทใหม่"}
          initial={editingRole?toRoleForm(editingRole):blankRoleForm()}
          onSave={saveRole}
          onClose={()=>{setShowRoleModal(false);setEditingRole(null);}}/>
      )}
    </div>
  );
}
