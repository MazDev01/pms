"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  tasks as INIT_TASKS,
  projects,
  taskStatusLabel, taskStatusBadge,
  taskPriorityColor, taskPriorityLabel,
  projectStatusLabel, projectStatusColor,
  type TaskStatus, type TaskPriority, type TaskMock,
} from "@/lib/mock";
import { Plus, Search, Download, List, LayoutGrid, Pencil, Trash2, X, ArrowRight, ExternalLink, ChevronUp, ChevronDown } from "lucide-react";

// ── Tokens ────────────────────────────────────────────────────
const PRIMARY = "#003366";
const STEEL   = "#2D2D2D";
const BORDER  = "#e5e7eb";
const MUTED   = "#6b7280";
const AVATAR_COLORS = ["#059669","#f59e0b","#dc2626","#002244",PRIMARY,"#8fa3b8","#2D2D2D"];
const TEAM = ["สมชาย","วิภา","วิชัย","กาญจนา"];

// ── Priority config ───────────────────────────────────────────
const PRI_BG: Record<TaskPriority,string>    = { urgent:"#fee2e2", high:"#fff3e0", normal:"#dce5f0", low:"#f0f0f5" };
const PRI_RANK: Record<TaskPriority,number>  = { urgent:0, high:1, normal:2, low:3 };
const PRIORITY_ORDER: TaskPriority[]         = ["urgent","high","normal","low"];

// ── Status config ─────────────────────────────────────────────
const STATUS_CLR: Record<TaskStatus,string> = { todo:"#6b7280", in_progress:"#003366", review:"#f59e0b", done:"#059669", cancelled:"#dc2626" };
const STATUS_TITLE: Record<TaskStatus,string> = { todo:"รอดำเนินการ", in_progress:"กำลังดำเนินการ", review:"กำลังรีวิว", done:"เสร็จสิ้น", cancelled:"ยกเลิก" };

// ── Status workflow ───────────────────────────────────────────
const STATUS_ACTIONS: Record<TaskStatus,{label:string;next:TaskStatus;bg:string;color:string}[]> = {
  todo:        [{label:"เริ่มงาน",          next:"in_progress", bg:"#dce5f0", color:"#003366"}],
  in_progress: [
    {label:"ส่งรีวิว",         next:"review",      bg:"#fef3cd", color:"#f59e0b"},
    {label:"เสร็จสิ้น",        next:"done",        bg:"#e5faf0", color:"#059669"},
    {label:"ยกเลิก",           next:"cancelled",   bg:"#fee2e2", color:"#dc2626"},
  ],
  review: [
    {label:"อนุมัติ เสร็จสิ้น", next:"done",        bg:"#e5faf0", color:"#059669"},
    {label:"แก้ไขเพิ่มเติม",    next:"in_progress", bg:"#dce5f0", color:"#003366"},
    {label:"ยกเลิก",           next:"cancelled",   bg:"#fee2e2", color:"#dc2626"},
  ],
  done:      [{label:"เปิดงานใหม่",  next:"todo", bg:"#f0f0f5", color:MUTED}],
  cancelled: [{label:"เปิดงานใหม่",  next:"todo", bg:"#f0f0f5", color:MUTED}],
};

// ── Kanban columns ────────────────────────────────────────────
const KANBAN_COLS: {key:TaskStatus;label:string;color:string;bg:string}[] = [
  {key:"todo",        label:"รอดำเนินการ",    color:"#6b7280", bg:"#f0f0f5"},
  {key:"in_progress", label:"กำลังดำเนินการ", color:"#003366", bg:"#dce5f0"},
  {key:"review",      label:"กำลังรีวิว",     color:"#f59e0b", bg:"#fef3cd"},
  {key:"done",        label:"เสร็จสิ้น",      color:"#059669", bg:"#e5faf0"},
  {key:"cancelled",   label:"ยกเลิก",         color:"#dc2626", bg:"#fee2e2"},
];

type SortKey = "due"|"priority"|"project"|"status";
type TaskForm = { title:string; project:string; projectId:number|null; priority:TaskPriority; status:TaskStatus; due:string; assigned:string[]; };
const PAGE_SIZE = 10;

// ── Helpers ───────────────────────────────────────────────────
const TODAY = new Date("2026-06-23");
function isOverdue(due:string|null, status:TaskStatus){ if(!due||status==="done"||status==="cancelled") return false; return new Date(due)<TODAY; }
function isDueSoon(due:string|null, status:TaskStatus){ if(!due||status==="done"||status==="cancelled") return false; const diff=(new Date(due).getTime()-TODAY.getTime())/(864e5); return diff>=0&&diff<=3; }
function formatDue(due:string|null){ if(!due) return "—"; const d=new Date(due); return d.toLocaleDateString("th-TH",{day:"numeric",month:"short",year:"2-digit"}); }
function projectBadgeStyle(p:string):React.CSSProperties{
  const h=p.charCodeAt(0)%5;
  const styles=[{background:"#dce5f0",color:"#003366"},{background:"#fef3cd",color:"#f59e0b"},{background:"#dce5f0",color:PRIMARY},{background:"#e5faf0",color:"#059669"},{background:"#fee2e2",color:"#dc2626"}];
  return styles[h];
}
function exportCSV(rows:TaskMock[]){
  const h=["ID","ชื่องาน","โอกาสการขาย","ผู้รับผิดชอบ","ลำดับความสำคัญ","วันครบกำหนด","สถานะ"];
  const lines=rows.map(t=>[t.id,t.title,t.project||"",t.assigned.join(";"),taskPriorityLabel[t.priority],t.due||"",taskStatusLabel[t.status]].join(","));
  const blob=new Blob(["﻿"+[h.join(","),...lines].join("\n")],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download="tasks.csv"; a.click(); URL.revokeObjectURL(url);
}
function nextId(tasks:TaskMock[]){ return Math.max(...tasks.map(t=>t.id),0)+1; }

// ── Sub-components ────────────────────────────────────────────
function Avatar({name,idx}:{name:string;idx:number}){
  return <span title={name} style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:26,height:26,borderRadius:"50%",background:AVATAR_COLORS[idx%AVATAR_COLORS.length],color:"#fff",fontSize:"0.6rem",fontWeight:700,border:"2px solid #fff",marginLeft:idx>0?-8:0,flexShrink:0}}>{name.substring(0,1)}</span>;
}
function PriorityBadge({priority}:{priority:TaskPriority}){
  const color=taskPriorityColor[priority]; const bg=PRI_BG[priority];
  return <span className="badge" style={{color,background:bg}}><span style={{width:5,height:5,borderRadius:"50%",background:color,flexShrink:0}}/>{taskPriorityLabel[priority]}</span>;
}
function StatusBadge({status}:{status:TaskStatus}){
  const b=taskStatusBadge[status];
  return <span className="badge" style={{background:b.bg,color:b.text}}>{taskStatusLabel[status]}</span>;
}

// ── Kanban Card ───────────────────────────────────────────────
function KanbanCard({task,onSelect,selected,onDragStart,onDragEnd,isDragging}:{
  task:TaskMock;onSelect:()=>void;selected:boolean;
  onDragStart:()=>void;onDragEnd:()=>void;isDragging:boolean;
}){
  const overdue=isOverdue(task.due,task.status); const isDone=task.status==="done";
  return (
    <div onClick={onSelect}
      draggable
      onDragStart={e=>{e.stopPropagation();onDragStart();}}
      onDragEnd={onDragEnd}
      style={{background:"#fff",border:`1px solid ${selected?PRIMARY:BORDER}`,borderRadius:10,padding:"10px 12px",marginBottom:8,cursor:"grab",boxShadow:selected?"0 0 0 2px rgba(0,51,102,.18)":"0 1px 4px rgba(0,0,0,.05)",transition:"box-shadow .15s, opacity .15s",opacity:isDragging?0.4:isDone?0.55:1}}
      onMouseEnter={e=>{if(!selected)(e.currentTarget as HTMLElement).style.boxShadow="0 3px 12px rgba(0,0,0,.12)";}}
      onMouseLeave={e=>{if(!selected)(e.currentTarget as HTMLElement).style.boxShadow="0 1px 4px rgba(0,0,0,.05)";}}>
      <div style={{fontSize:"0.8rem",fontWeight:600,color:task.status==="cancelled"?"#9ca3af":STEEL,marginBottom:6,textDecoration:isDone?"line-through":"none",lineHeight:1.4}}>{task.title}</div>
      {task.project&&(
        <div style={{fontSize:"0.67rem",fontWeight:600,marginBottom:8,display:"inline-block",padding:"1px 7px",borderRadius:6,...projectBadgeStyle(task.project)}}>
          {task.project.length>22?task.project.substring(0,20)+"…":task.project}
        </div>
      )}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:4}}>
        <PriorityBadge priority={task.priority}/>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          {task.due&&<span style={{fontSize:"0.65rem",fontWeight:600,color:overdue?"#dc2626":isDueSoon(task.due,task.status)?"#f59e0b":MUTED}}>{formatDue(task.due)}</span>}
          {task.assigned.length>0&&<div style={{display:"flex"}}>{task.assigned.slice(0,3).map((a,i)=><Avatar key={a} name={a} idx={i}/>)}</div>}
        </div>
      </div>
    </div>
  );
}

// ── Task Modal ────────────────────────────────────────────────
function TaskModal({initial,title,onSave,onClose,defaultStatus}:{initial:TaskForm;title:string;onSave:(f:TaskForm)=>void;onClose:()=>void;defaultStatus?:TaskStatus}){
  const [form,setForm]=useState<TaskForm>({...initial,status:defaultStatus||initial.status});
  function set<K extends keyof TaskForm>(k:K,v:TaskForm[K]){setForm(p=>({...p,[k]:v}));}
  function pickProject(title:string){ const p=projects.find(x=>x.title===title); set("project",title); set("projectId",p?.id??null); }
  function toggleMember(m:string){setForm(p=>({...p,assigned:p.assigned.includes(m)?p.assigned.filter(x=>x!==m):[...p.assigned,m]}));}
  function submit(){if(!form.title.trim()) return; onSave(form); onClose();}
  return (
    <>
      <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(45,45,45,.4)",zIndex:200}}/>
      <div style={{position:"fixed",inset:0,zIndex:210,display:"flex",alignItems:"center",justifyContent:"center",padding:20,pointerEvents:"none"}}>
        <div className="card" onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:480,pointerEvents:"auto",overflow:"hidden",boxShadow:"0 24px 80px rgba(0,0,0,.2)"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 22px",borderBottom:`1px solid ${BORDER}`,background:PRIMARY}}>
            <div style={{fontSize:"0.92rem",fontWeight:800,color:"#fff"}}>{title}</div>
            <button onClick={onClose} style={{width:28,height:28,borderRadius:8,border:"1px solid rgba(255,255,255,.2)",background:"rgba(255,255,255,.1)",color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><X size={13}/></button>
          </div>
          <div style={{padding:"20px 22px",overflowY:"auto",maxHeight:"62vh",display:"flex",flexDirection:"column",gap:12}}>
            <div><label className="form-label">ชื่องาน *</label><input className="form-input" value={form.title} onChange={e=>set("title",e.target.value)} placeholder="ชื่องาน..."/></div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div>
                <label className="form-label">สถานะ</label>
                <select className="form-select" value={form.status} onChange={e=>set("status",e.target.value as TaskStatus)}>
                  {(["todo","in_progress","review","done","cancelled"] as TaskStatus[]).map(s=><option key={s} value={s}>{STATUS_TITLE[s]}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">ความสำคัญ</label>
                <select className="form-select" value={form.priority} onChange={e=>set("priority",e.target.value as TaskPriority)}>
                  {PRIORITY_ORDER.map(p=><option key={p} value={p}>{taskPriorityLabel[p]}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">วันครบกำหนด</label>
                <input className="form-input" type="date" value={form.due} onChange={e=>set("due",e.target.value)}/>
              </div>
              <div>
                <label className="form-label">โอกาสการขาย</label>
                <select className="form-select" value={form.project} onChange={e=>pickProject(e.target.value)}>
                  <option value="">— ไม่มี —</option>
                  {projects.map(p=><option key={p.id} value={p.title}>{p.title}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="form-label">ผู้รับผิดชอบ</label>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:4}}>
                {TEAM.map(m=>{const sel=form.assigned.includes(m); return <button key={m} type="button" onClick={()=>toggleMember(m)} style={{padding:"5px 12px",borderRadius:99,border:`1px solid ${sel?PRIMARY:BORDER}`,background:sel?"#dce5f0":"#fff",color:sel?PRIMARY:MUTED,fontSize:"0.75rem",fontWeight:600,cursor:"pointer"}}>{m}{sel?" ✓":""}</button>;})}
              </div>
            </div>
          </div>
          <div style={{padding:"13px 22px",borderTop:`1px solid ${BORDER}`,display:"flex",gap:8,justifyContent:"flex-end",background:"#fafafa"}}>
            <button className="btn btn-secondary btn-sm" onClick={onClose}>ยกเลิก</button>
            <button className="btn btn-primary btn-sm" onClick={submit}>บันทึก</button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Detail Panel ──────────────────────────────────────────────
function DetailPanel({task,allTasks,onClose,onEdit,onChangeStatus,onDelete}:{
  task:TaskMock; allTasks:TaskMock[]; onClose:()=>void; onEdit:()=>void; onChangeStatus:(s:TaskStatus)=>void; onDelete:()=>void;
}){
  const router=useRouter();
  const [tab,setTab]=useState<"info"|"project">("info");
  const [delConfirm,setDelConfirm]=useState(false);
  const relProject=task.projectId!==null?projects.find(p=>p.id===task.projectId):null;
  const sibling=relProject?allTasks.filter(t=>t.projectId===relProject.id&&t.id!==task.id):[];
  const overdue=isOverdue(task.due,task.status);
  const isDone=task.status==="done";
  const sb=taskStatusBadge[task.status];

  return (
    <div className="card" style={{width:330,minWidth:300,flexShrink:0,overflowY:"auto",maxHeight:"calc(100vh - 140px)",alignSelf:"flex-start",position:"sticky",top:0}}>
      {/* Header */}
      <div style={{background:PRIMARY,padding:"16px 14px 12px"}}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:10}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:"0.86rem",fontWeight:800,color:"#fff",lineHeight:1.35,textDecoration:isDone?"line-through":"none",overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{task.title}</div>
          </div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,.15)",border:"none",borderRadius:8,width:28,height:28,cursor:"pointer",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginLeft:8}}><X size={14}/></button>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          <span className="badge" style={{background:sb.bg,color:sb.text}}>{taskStatusLabel[task.status]}</span>
          <PriorityBadge priority={task.priority}/>
        </div>
      </div>
      {/* Tabs */}
      <div className="tab-bar">
        {([["info","ข้อมูล"],["project","โอกาสการขาย"]] as [string,string][]).map(([k,l])=>(
          <button key={k} className={`tab-item${tab===k?" active":""}`} style={{flex:1}} onClick={()=>setTab(k as typeof tab)}>
            {l}
          </button>
        ))}
      </div>

      {/* Tab: ข้อมูล */}
      {tab==="info"&&(
        <div style={{padding:"14px 14px"}}>
          {/* Meta */}
          <div style={{display:"flex",flexDirection:"column",gap:0,marginBottom:14}}>
            {[
              {l:"สถานะ",   v:<StatusBadge status={task.status}/>},
              {l:"ความสำคัญ",v:<PriorityBadge priority={task.priority}/>},
              {l:"กำหนดส่ง", v:<span style={{fontSize:"0.78rem",fontWeight:700,color:overdue?"#dc2626":STEEL}}>{overdue&&"⚠ "}{formatDue(task.due)}</span>},
            ].map((r,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:`1px solid #f0f4f8`}}>
                <span style={{fontSize:"0.7rem",color:MUTED,fontWeight:600}}>{r.l}</span>
                {r.v}
              </div>
            ))}
          </div>
          {/* Assigned */}
          {task.assigned.length>0&&(
            <>
              <div style={{fontSize:"0.63rem",fontWeight:700,color:MUTED,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>ผู้รับผิดชอบ</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:14}}>
                {task.assigned.map((a,i)=>(
                  <div key={a} style={{display:"flex",alignItems:"center",gap:6}}>
                    <div style={{width:24,height:24,borderRadius:"50%",background:AVATAR_COLORS[i%AVATAR_COLORS.length],display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:"0.6rem",fontWeight:700}}>{a.substring(0,1)}</div>
                    <span style={{fontSize:"0.74rem",color:STEEL,fontWeight:600}}>{a}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          {/* Status workflow */}
          {STATUS_ACTIONS[task.status].length>0&&(
            <>
              <div style={{fontSize:"0.63rem",fontWeight:700,color:MUTED,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>เปลี่ยนสถานะ</div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {STATUS_ACTIONS[task.status].map(a=>(
                  <button key={a.next} onClick={()=>onChangeStatus(a.next)}
                    style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 12px",borderRadius:10,background:a.bg,border:"none",cursor:"pointer",width:"100%"}}>
                    <span style={{fontSize:"0.76rem",fontWeight:700,color:a.color}}>{a.label}</span>
                    <ArrowRight size={13} color={a.color}/>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Tab: โอกาสการขาย */}
      {tab==="project"&&(
        <div style={{padding:"14px 14px"}}>
          {relProject?(
            <>
              <button onClick={()=>void 0}
                style={{display:"flex",alignItems:"flex-start",gap:12,width:"100%",padding:"12px",borderRadius:12,background:"#f8f9fb",border:`1px solid ${BORDER}`,cursor:"pointer",textAlign:"left",marginBottom:14}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:"0.8rem",fontWeight:800,color:PRIMARY,marginBottom:4}}>{relProject.title}</div>
                  <div style={{fontSize:"0.7rem",color:MUTED,marginBottom:6}}>{relProject.client}</div>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <span className="badge" style={{background:projectStatusColor[relProject.status].bg,color:projectStatusColor[relProject.status].text}}>{projectStatusLabel[relProject.status]}</span>
                    <span style={{fontSize:"0.7rem",color:MUTED}}>{relProject.progress}%</span>
                  </div>
                </div>
                <ExternalLink size={12} color={MUTED} style={{flexShrink:0,marginTop:3}}/>
              </button>
              {sibling.length>0&&(
                <>
                  <div style={{fontSize:"0.63rem",fontWeight:700,color:MUTED,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>งานอื่นในโอกาสการขาย ({sibling.length})</div>
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    {sibling.slice(0,5).map(t=>{
                      const b=taskStatusBadge[t.status];
                      return (
                        <div key={t.id} style={{padding:"8px 10px",borderRadius:9,background:"#f8f9fb",border:`1px solid ${BORDER}`}}>
                          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:6}}>
                            <div style={{fontSize:"0.74rem",fontWeight:600,color:STEEL,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.title}</div>
                            <span className="badge" style={{background:b.bg,color:b.text,flexShrink:0}}>{taskStatusLabel[t.status]}</span>
                          </div>
                        </div>
                      );
                    })}
                    {sibling.length>5&&<div style={{fontSize:"0.68rem",color:MUTED,textAlign:"center",padding:4}}>และอีก {sibling.length-5} งาน</div>}
                  </div>
                </>
              )}
            </>
          ):(
            <div style={{textAlign:"center",padding:"28px 0",color:MUTED,fontSize:"0.78rem"}}>งานนี้ไม่ได้อยู่ในโอกาสการขายใด</div>
          )}
        </div>
      )}

      {/* Footer */}
      <div style={{padding:"12px 14px",borderTop:`1px solid ${BORDER}`,display:"flex",flexDirection:"column",gap:6}}>
        <button className="btn btn-primary btn-sm" onClick={onEdit} style={{justifyContent:"center"}}>
          <Pencil size={13}/> แก้ไขงาน
        </button>
        {!delConfirm?(
          <button className="btn btn-danger btn-sm" onClick={()=>setDelConfirm(true)} style={{justifyContent:"center"}}>
            <Trash2 size={12}/> ลบงาน
          </button>
        ):(
          <div style={{borderRadius:10,border:"1px solid #fca5a5",overflow:"hidden"}}>
            <div style={{padding:"7px 12px",background:"#fee2e2",fontSize:"0.7rem",color:"#dc2626",fontWeight:600}}>ยืนยันลบงานนี้?</div>
            <div style={{display:"flex"}}>
              <button onClick={onDelete} style={{flex:1,padding:"7px",background:"#dc2626",border:"none",color:"#fff",fontSize:"0.7rem",fontWeight:700,cursor:"pointer"}}>ลบ</button>
              <button onClick={()=>setDelConfirm(false)} style={{flex:1,padding:"7px",background:"#fff",border:"none",borderLeft:"1px solid #fca5a5",color:STEEL,fontSize:"0.7rem",cursor:"pointer"}}>ยกเลิก</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── ActionBtn / PgBtn ──────────────────────────────────────────
function ActionBtn({children,title,onClick}:{children:React.ReactNode;title?:string;onClick?:()=>void}){
  return <button title={title} onClick={onClick} style={{width:29,height:29,borderRadius:8,border:`1px solid ${BORDER}`,background:"#fff",color:"#8fa3b8",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"all .12s"}} onMouseEnter={e=>{const el=e.currentTarget as HTMLElement;el.style.background="#dce5f0";el.style.borderColor=PRIMARY;el.style.color=PRIMARY;}} onMouseLeave={e=>{const el=e.currentTarget as HTMLElement;el.style.background="#fff";el.style.borderColor=BORDER;el.style.color="#8fa3b8";}}>{children}</button>;
}
function PgBtn({children,onClick,active,disabled}:{children:React.ReactNode;onClick:()=>void;active?:boolean;disabled?:boolean}){
  return <button onClick={onClick} disabled={disabled} style={{minWidth:30,height:30,borderRadius:7,border:active?`1px solid ${PRIMARY}`:`1px solid ${BORDER}`,background:active?PRIMARY:"#fff",color:active?"#fff":disabled?"#e5e7eb":MUTED,fontSize:"0.78rem",fontWeight:active?700:500,cursor:disabled?"not-allowed":"pointer",padding:"0 8px"}}>{children}</button>;
}

// ── Main Page ─────────────────────────────────────────────────
export default function TasksPage(){
  const [taskList,setTaskList]   = useState<TaskMock[]>(INIT_TASKS);
  const [query,setQuery]         = useState("");
  const [filterStatus,setFilterStatus] = useState<TaskStatus|"ALL"|"not_started">("ALL");
  const [filterProject,setFilterProject] = useState("ALL");
  const [filterAssignee,setFilterAssignee] = useState("ALL");
  const [sortKey,setSortKey]     = useState<SortKey>("due");
  const [sortAsc,setSortAsc]     = useState(true);
  const [view,setView]           = useState<"list"|"kanban">("list");
  const [page,setPage]           = useState(1);
  const [selectedId,setSelectedId] = useState<number|null>(null);
  const [showModal,setShowModal] = useState(false);
  const [editingTask,setEditingTask] = useState<TaskMock|null>(null);
  const [modalStatus,setModalStatus] = useState<TaskStatus|undefined>();
  const [dragId,setDragId]   = useState<number|null>(null);
  const [dragOver,setDragOver] = useState<TaskStatus|null>(null);

  function moveTask(id:number,status:TaskStatus){
    setTaskList(prev=>prev.map(t=>t.id===id?{...t,status}:t));
    setDragId(null);
  }

  const countByStatus=(s:TaskStatus)=>taskList.filter(t=>t.status===s).length;
  const countNotStarted=taskList.filter(t=>t.status==="todo"&&t.assigned.length===0).length;

  const projectNames=useMemo(()=>Array.from(new Set(taskList.filter(t=>t.project).map(t=>t.project as string))).sort(),[taskList]);
  const allAssignees=useMemo(()=>Array.from(new Set(taskList.flatMap(t=>t.assigned))).sort(),[taskList]);

  const filtered=useMemo(()=>{
    let list=taskList.filter(t=>{
      const q=query.toLowerCase();
      const matchQ=!q||t.title.toLowerCase().includes(q)||(t.project||"").toLowerCase().includes(q)||t.assigned.some(a=>a.toLowerCase().includes(q));
      let matchS=true;
      if(filterStatus==="not_started") matchS=t.status==="todo"&&t.assigned.length===0;
      else if(filterStatus!=="ALL") matchS=t.status===(filterStatus as TaskStatus);
      const matchP=filterProject==="ALL"||t.project===filterProject;
      const matchA=filterAssignee==="ALL"||t.assigned.includes(filterAssignee);
      return matchQ&&matchS&&matchP&&matchA;
    });
    list=[...list].sort((a,b)=>{
      let cmp=0;
      if(sortKey==="priority") cmp=PRI_RANK[a.priority]-PRI_RANK[b.priority];
      else if(sortKey==="project") cmp=(a.project||"zzz").localeCompare(b.project||"zzz","th");
      else if(sortKey==="status") cmp=a.status.localeCompare(b.status);
      else{ if(!a.due&&!b.due) cmp=0; else if(!a.due) cmp=1; else if(!b.due) cmp=-1; else cmp=new Date(a.due).getTime()-new Date(b.due).getTime(); }
      return sortAsc?cmp:-cmp;
    });
    return list;
  },[taskList,query,filterStatus,filterProject,filterAssignee,sortKey,sortAsc]);

  const totalPages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
  const safePage=Math.min(page,totalPages);
  const paginated=filtered.slice((safePage-1)*PAGE_SIZE,safePage*PAGE_SIZE);
  const selectedTask=selectedId!==null?taskList.find(t=>t.id===selectedId)??null:null;

  function toggleSort(k:SortKey){if(sortKey===k)setSortAsc(a=>!a);else{setSortKey(k);setSortAsc(true);}setPage(1);}
  function applyFilter(s:typeof filterStatus){setFilterStatus(s);setPage(1);}

  function openAdd(status?:TaskStatus){setEditingTask(null);setModalStatus(status);setShowModal(true);}
  function openEdit(t:TaskMock){setEditingTask(t);setModalStatus(undefined);setShowModal(true);}

  function saveTask(form:TaskForm){
    if(editingTask){
      setTaskList(d=>d.map(t=>t.id===editingTask.id?{...t,...form,statusTitle:STATUS_TITLE[form.status],statusColor:STATUS_CLR[form.status]}:t));
      setSelectedId(editingTask.id);
    } else {
      const newT:TaskMock={id:nextId(taskList),title:form.title,project:form.project||null,projectId:form.projectId,priority:form.priority,status:form.status,statusTitle:STATUS_TITLE[form.status],statusColor:STATUS_CLR[form.status],due:form.due||null,assigned:form.assigned};
      setTaskList(d=>[newT,...d]);
    }
  }
  function changeStatus(id:number,s:TaskStatus){
    setTaskList(d=>d.map(t=>t.id===id?{...t,status:s,statusTitle:STATUS_TITLE[s],statusColor:STATUS_CLR[s]}:t));
  }
  function deleteTask(){
    if(!selectedId) return;
    setTaskList(d=>d.filter(t=>t.id!==selectedId));
    setSelectedId(null);
  }
  function toggleDone(id:number){
    setTaskList(prev=>prev.map(t=>{
      if(t.id!==id) return t;
      const next:TaskStatus=t.status==="done"?"in_progress":"done";
      return {...t,status:next,statusTitle:STATUS_TITLE[next],statusColor:STATUS_CLR[next]};
    }));
  }

  function toForm(t:TaskMock):TaskForm{return {title:t.title,project:t.project||"",projectId:t.projectId,priority:t.priority,status:t.status,due:t.due||"",assigned:[...t.assigned]};}
  function blankForm():TaskForm{return {title:"",project:"",projectId:null,priority:"normal",status:"todo",due:"",assigned:[]};}

  // Stat cards config
  const STATS=[
    {key:"not_started",label:"ยังไม่เริ่ม",    count:countNotStarted,    color:"#64748b",bg:"#f1f5f9"},
    {key:"in_progress",label:"กำลังดำเนินการ", count:countByStatus("in_progress"),color:"#003366",bg:"#dce5f0"},
    {key:"todo",       label:"รอดำเนินการ",    count:countByStatus("todo"),      color:"#f59e0b",bg:"#fff3e0"},
    {key:"done",       label:"เสร็จสิ้น",      count:countByStatus("done"),      color:"#059669",bg:"#e5faf0"},
    {key:"cancelled",  label:"ยกเลิก",         count:countByStatus("cancelled"), color:"#dc2626",bg:"#fee2e2"},
  ];

  function SortTH({col,children}:{col:SortKey;children:React.ReactNode}){
    const active=sortKey===col;
    return <th style={{cursor:"pointer",userSelect:"none"}} onClick={()=>toggleSort(col)}>
      <span style={{display:"inline-flex",alignItems:"center",gap:3}}>
        {children}
        {active?(sortAsc?<ChevronUp size={10}/>:<ChevronDown size={10}/>):<ChevronDown size={10} opacity={0.3}/>}
      </span>
    </th>;
  }

  return (
    <div className="erp" style={{paddingBottom:40}}>
      {/* Header */}
      <div className="page-head">
        <div>
          <h2>งาน</h2>
          <p>ศูนย์ติดตามงาน · จัดการงานและติดตามความคืบหน้าของทีม · {taskList.length} งาน</p>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <button className="btn btn-secondary btn-sm" onClick={()=>exportCSV(filtered)}>
            <Download size={13}/> ส่งออก
          </button>
          <button className="btn btn-primary btn-sm" onClick={()=>openAdd()}>
            <Plus size={14}/> เพิ่มงาน
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="kpi-bar" style={{gridTemplateColumns:"repeat(5,1fr)"}}>
        {STATS.map(s=>{
          const active=filterStatus===s.key;
          return (
            <div key={s.key} className="stat-card clickable" onClick={()=>applyFilter(active?"ALL":s.key as typeof filterStatus)}
              style={{padding:"14px 16px",borderColor:active?s.color:BORDER,outline:active?`2px solid ${s.color}33`:"none",outlineOffset:2}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                <div style={{fontSize:"0.7rem",fontWeight:700,color:MUTED}}>{s.label}</div>
                <div style={{width:34,height:34,borderRadius:9,background:s.bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <span style={{fontSize:"1rem",color:s.color}}>●</span>
                </div>
              </div>
              <div style={{fontSize:"1.9rem",fontWeight:800,color:s.color,lineHeight:1}}>{s.count}</div>
            </div>
          );
        })}
      </div>

      {/* Toolbar */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:14,flexWrap:"wrap",background:"#fff",border:`1px solid ${BORDER}`,borderRadius:12,padding:"10px 14px"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          <div className="search-bar" style={{minWidth:200}}>
            <Search size={13} color="#9ca3af"/>
            <input value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}} placeholder="ค้นหางาน..."/>
            {query&&<button onClick={()=>{setQuery("");setPage(1);}} style={{background:"none",border:"none",cursor:"pointer",padding:0,color:MUTED,display:"flex"}}><X size={12}/></button>}
          </div>
          {/* Project dropdown */}
          <select value={filterProject} onChange={e=>{setFilterProject(e.target.value);setPage(1);}}
            style={{border:`1px solid ${BORDER}`,borderRadius:9,padding:"7px 10px",fontSize:"0.78rem",color:filterProject==="ALL"?MUTED:PRIMARY,background:"#fff",cursor:"pointer",outline:"none",fontWeight:filterProject==="ALL"?500:700}}>
            <option value="ALL">ทุกโอกาสการขาย</option>
            {projectNames.map(p=><option key={p} value={p}>{p.length>16?p.substring(0,14)+"…":p}</option>)}
          </select>
          {/* Assignee dropdown */}
          <select value={filterAssignee} onChange={e=>{setFilterAssignee(e.target.value);setPage(1);}}
            style={{border:`1px solid ${BORDER}`,borderRadius:9,padding:"7px 10px",fontSize:"0.78rem",color:filterAssignee==="ALL"?MUTED:PRIMARY,background:"#fff",cursor:"pointer",outline:"none",fontWeight:filterAssignee==="ALL"?500:700}}>
            <option value="ALL">ทุกผู้รับผิดชอบ</option>
            {allAssignees.map(a=><option key={a} value={a}>{a}</option>)}
          </select>
          {(filterStatus!=="ALL"||filterProject!=="ALL"||filterAssignee!=="ALL"||query)&&(
            <button onClick={()=>{setFilterStatus("ALL");setFilterProject("ALL");setFilterAssignee("ALL");setQuery("");setPage(1);}}
              style={{display:"flex",alignItems:"center",gap:4,padding:"5px 10px",borderRadius:99,background:"#fee2e2",color:"#dc2626",border:"none",fontSize:"0.72rem",fontWeight:700,cursor:"pointer"}}>
              <X size={10}/> ล้างตัวกรอง
            </button>
          )}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:"0.72rem",color:MUTED}}>{filtered.length} รายการ</span>
          <div style={{display:"flex",background:"#fafafa",border:`1px solid ${BORDER}`,borderRadius:9,padding:3,gap:2}}>
            {([["list","ตาราง"],["kanban","คัมบัง"]] as const).map(([v,l])=>(
              <button key={v} onClick={()=>{setView(v);if(v==="kanban")setSelectedId(null);}}
                style={{display:"flex",alignItems:"center",gap:5,padding:"5px 11px",borderRadius:7,border:"none",background:view===v?"#fff":"transparent",color:view===v?PRIMARY:MUTED,fontSize:"0.75rem",fontWeight:view===v?700:500,cursor:"pointer",boxShadow:view===v?"0 1px 4px rgba(0,0,0,.1)":"none"}}>
                {v==="list"?<List size={13}/>:<LayoutGrid size={13}/>}
                {l}
              </button>
            ))}
          </div>
          <button className="btn btn-primary" onClick={()=>openAdd()} style={{width:32,height:32,padding:0,justifyContent:"center"}}>
            <Plus size={16}/>
          </button>
        </div>
      </div>

      {/* Content area */}
      <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
        <div style={{flex:1,minWidth:0}}>

          {/* TABLE VIEW */}
          {view==="list"&&(
            <div className="card">
              <div className="table-wrap" style={{borderTop:"none"}}>
                <table>
                  <thead>
                    <tr>
                      <th style={{width:40}}></th>
                      <th>ชื่องาน</th>
                      <SortTH col="project">โอกาสการขาย</SortTH>
                      <th>ผู้รับผิดชอบ</th>
                      <SortTH col="priority">ลำดับ</SortTH>
                      <SortTH col="due">กำหนดส่ง</SortTH>
                      <SortTH col="status">สถานะ</SortTH>
                      <th style={{width:70}}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.length===0&&(
                      <tr><td colSpan={8} style={{textAlign:"center",padding:"44px 14px",color:"#9ca3af",fontSize:"0.82rem"}}>ไม่พบรายการงาน</td></tr>
                    )}
                    {paginated.map(t=>{
                      const isDone=t.status==="done"; const overdue=isOverdue(t.due,t.status); const soon=isDueSoon(t.due,t.status);
                      const isSel=selectedId===t.id;
                      return (
                        <tr key={t.id} className="clickable" onClick={()=>setSelectedId(isSel?null:t.id)}
                          style={{opacity:isDone?0.6:1,background:isSel?"#f0f5ff":undefined}}>
                          <td onClick={e=>e.stopPropagation()}>
                            <input type="checkbox" checked={isDone} onChange={()=>toggleDone(t.id)} style={{width:15,height:15,cursor:"pointer",accentColor:PRIMARY}}/>
                          </td>
                          <td style={{minWidth:200}}>
                            <div style={{fontSize:"0.84rem",fontWeight:600,color:t.status==="cancelled"?"#9ca3af":STEEL,textDecoration:isDone?"line-through":"none"}}>{t.title}</div>
                            {t.project&&<div style={{fontSize:"0.7rem",color:"#8fa3b8",marginTop:2}}>{t.project}</div>}
                          </td>
                          <td>
                            {t.project?(
                              <span style={{display:"inline-block",padding:"2px 9px",borderRadius:6,fontSize:"0.67rem",fontWeight:700,maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",...projectBadgeStyle(t.project)}}>
                                {t.project.length>12?t.project.substring(0,10)+"…":t.project}
                              </span>
                            ):<span style={{color:"#C0C0C0",fontSize:"0.8rem"}}>—</span>}
                          </td>
                          <td>
                            {t.assigned.length===0?<span style={{fontSize:"0.73rem",color:"#C0C0C0"}}>—</span>:(
                              <div style={{display:"flex",paddingLeft:4}}>
                                {t.assigned.slice(0,4).map((a,i)=><Avatar key={a} name={a} idx={i}/>)}
                                {t.assigned.length>4&&<span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:26,height:26,borderRadius:"50%",background:"#f0f0f5",color:MUTED,fontSize:"0.55rem",fontWeight:700,border:"2px solid #fff",marginLeft:-8}}>+{t.assigned.length-4}</span>}
                              </div>
                            )}
                          </td>
                          <td style={{whiteSpace:"nowrap"}}><PriorityBadge priority={t.priority}/></td>
                          <td style={{whiteSpace:"nowrap"}}>
                            <span style={{fontSize:"0.78rem",fontWeight:overdue?700:500,color:overdue?"#dc2626":soon?"#f59e0b":MUTED}}>
                              {overdue&&<span style={{marginRight:3}}>⚠</span>}{formatDue(t.due)}
                            </span>
                          </td>
                          <td style={{whiteSpace:"nowrap"}}><StatusBadge status={t.status}/></td>
                          <td onClick={e=>e.stopPropagation()}>
                            <div style={{display:"flex",gap:4}}>
                              <ActionBtn title="แก้ไข" onClick={()=>openEdit(t)}><Pencil size={12}/></ActionBtn>
                              <ActionBtn title="ลบ" onClick={()=>{setSelectedId(t.id); setTimeout(()=>setSelectedId(t.id),0);}}><Trash2 size={12}/></ActionBtn>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Pagination */}
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"11px 16px",borderTop:`1px solid ${BORDER}`}}>
                <span style={{fontSize:"0.73rem",color:MUTED}}>
                  {filtered.length===0?"ไม่มีข้อมูล":`แสดง ${(safePage-1)*PAGE_SIZE+1}–${Math.min(safePage*PAGE_SIZE,filtered.length)} จาก ${filtered.length} รายการ`}
                </span>
                <div style={{display:"flex",gap:4}}>
                  <PgBtn onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={safePage<=1}>‹</PgBtn>
                  {Array.from({length:totalPages},(_,i)=>i+1).map(p=><PgBtn key={p} onClick={()=>setPage(p)} active={p===safePage}>{p}</PgBtn>)}
                  <PgBtn onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={safePage>=totalPages}>›</PgBtn>
                </div>
              </div>
            </div>
          )}

          {/* KANBAN VIEW */}
          {view==="kanban"&&(
            <div style={{display:"flex",gap:12,overflowX:"auto",paddingBottom:8,alignItems:"flex-start"}}>
              {KANBAN_COLS.map(col=>{
                const colTasks=filtered.filter(t=>t.status===col.key);
                return (
                  <div key={col.key}
                    style={{minWidth:242,maxWidth:260,flex:"0 0 250px",background:"#fafafa",borderRadius:12,border:`1px solid ${dragOver===col.key?col.color:BORDER}`,overflow:"hidden",transition:"border-color .15s"}}>
                    <div style={{padding:"10px 12px",borderBottom:`1px solid ${BORDER}`,background:"#fff",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                      <div style={{display:"flex",alignItems:"center",gap:7}}>
                        <span style={{width:8,height:8,borderRadius:"50%",background:col.color,flexShrink:0}}/>
                        <span style={{fontSize:"0.78rem",fontWeight:700,color:STEEL}}>{col.label}</span>
                        <span style={{background:col.bg,color:col.color,borderRadius:99,padding:"1px 7px",fontSize:"0.67rem",fontWeight:700}}>{colTasks.length}</span>
                      </div>
                      <button title="เพิ่มงาน" onClick={()=>openAdd(col.key)}
                        style={{width:22,height:22,borderRadius:6,border:`1px solid ${BORDER}`,background:"#fff",color:MUTED,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                        <Plus size={12}/>
                      </button>
                    </div>
                    <div
                      onDragOver={e=>{e.preventDefault();setDragOver(col.key);}}
                      onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setDragOver(null);}}
                      onDrop={e=>{e.preventDefault();if(dragId!==null)moveTask(dragId,col.key);setDragOver(null);}}
                      style={{padding:"10px 10px 4px",minHeight:80,background:dragOver===col.key?col.bg:"transparent",transition:"background .15s",borderRadius:"0 0 11px 11px"}}>
                      {colTasks.length===0&&<div style={{textAlign:"center",padding:"20px 0",color:"#C0C0C0",fontSize:"0.73rem"}}>ไม่มีงาน</div>}
                      {colTasks.map(t=><KanbanCard key={t.id} task={t} selected={selectedId===t.id}
                        onSelect={()=>setSelectedId(selectedId===t.id?null:t.id)}
                        onDragStart={()=>setDragId(t.id)}
                        onDragEnd={()=>setDragId(null)}
                        isDragging={dragId===t.id}
                      />)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selectedTask&&(
          <DetailPanel
            task={selectedTask}
            allTasks={taskList}
            onClose={()=>setSelectedId(null)}
            onEdit={()=>openEdit(selectedTask)}
            onChangeStatus={(s)=>changeStatus(selectedTask.id,s)}
            onDelete={deleteTask}/>
        )}
      </div>

      {showModal&&(
        <TaskModal
          title={editingTask?"แก้ไขงาน":"เพิ่มงานใหม่"}
          initial={editingTask?toForm(editingTask):{...blankForm(),status:modalStatus||"todo"}}
          defaultStatus={modalStatus}
          onSave={saveTask}
          onClose={()=>{setShowModal(false);setEditingTask(null);setModalStatus(undefined);}}/>
      )}
    </div>
  );
}
