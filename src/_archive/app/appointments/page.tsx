"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Search, Calendar, Clock, MapPin, Phone, LayoutList, CalendarDays,
  ChevronLeft, ChevronRight, ChevronDown, X, Check, Trash2, Edit2, ExternalLink, User,
} from "lucide-react";
import {
  appointments as INIT_APPTS, apptTypeLabel, apptTypeColor, apptStatusLabel, apptStatusColor,
  leads, projects, customers,
  type ApptType, type ApptStatus, type AppointmentMock,
} from "@/lib/mock";

// ── Design tokens ─────────────────────────────────────────────
const PRIMARY = "#003366";
const STEEL   = "#2D2D2D";
const BORDER  = "#e5e7eb";
const MUTED   = "#6b7280";

const TODAY = "2026-06-23";
const TH_MONTHS = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
const TH_DAYS_SHORT = ["อา","จ","อ","พ","พฤ","ศ","ส"];
const TYPES: ApptType[] = ["survey","design_meet","presentation","contract_sign","handover","follow_up"];
const TEAM = ["สมชาย","วิภา","กาญจนา","สุรชัย","ประภัส","นิรัญ"];

const TYPE_PILL: Record<ApptType,{bg:string;color:string}> = {
  survey:       {bg:"#dce5f0",color:"#003366"},
  design_meet:  {bg:"#dce5f0",color:"#003366"},
  presentation: {bg:"#fff3e0",color:"#d97706"},
  contract_sign:{bg:"#dce5f0",color:"#003366"},
  handover:     {bg:"#e5faf0",color:"#059669"},
  follow_up:    {bg:"#f0f0f5",color:"#6b7280"},
};

// ── Helpers ───────────────────────────────────────────────────
function padDate(n:number){ return n.toString().padStart(2,"0"); }
function fmtDate(d:string){
  const dt = new Date(d+"T00:00:00");
  return dt.toLocaleDateString("th-TH",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
}
function fmtDateShort(d:string){
  const dt = new Date(d+"T00:00:00");
  return dt.toLocaleDateString("th-TH",{day:"numeric",month:"short"});
}
function groupByDate(items: AppointmentMock[]): Record<string,AppointmentMock[]> {
  const map: Record<string,AppointmentMock[]> = {};
  items.forEach(a => { if(!map[a.date]) map[a.date]=[]; map[a.date].push(a); });
  return map;
}
function daysUntil(dateStr:string){
  return Math.round((new Date(dateStr+"T00:00:00").getTime()-new Date(TODAY+"T00:00:00").getTime())/86400000);
}

// ── Find related records ──────────────────────────────────────
function findLead(a: AppointmentMock){ return leads.find(l=>l.company===a.company||l.name===a.company); }
function findCustomer(a: AppointmentMock){ return customers.find(c=>c.company===a.company); }
function findProject(a: AppointmentMock){ return projects.find(p=>p.title===a.project||p.client===a.company); }

// ── Add / Edit Modal ──────────────────────────────────────────
type ApptForm = Omit<AppointmentMock,"id">;

const BLANK: ApptForm = {
  company:"", contact:"", phone:"", project:"",
  buildingType:"EASYBUILD", area:0, province:"กรุงเทพฯ",
  date:"", time:"09:00", type:"survey", assigned:"สมชาย",
  status:"upcoming", note:"",
};

function ApptModal({ initial, title, onSave, onClose }:{
  initial: ApptForm; title: string;
  onSave:(f:ApptForm)=>void; onClose:()=>void;
}){
  const [form, setForm] = useState<ApptForm>(initial);
  function set<K extends keyof ApptForm>(k:K, v: ApptForm[K]){ setForm(p=>({...p,[k]:v})); }
  function submit(){ if(!form.company||!form.date){ return; } onSave(form); onClose(); }

  return (
    <>
      <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(45,45,45,.45)",zIndex:200}}/>
      <div style={{position:"fixed",inset:0,zIndex:210,display:"flex",alignItems:"center",justifyContent:"center",padding:24,pointerEvents:"none"}}>
        <div onClick={e=>e.stopPropagation()}
          style={{width:"100%",maxWidth:620,background:"#fff",borderRadius:20,border:`1px solid ${BORDER}`,
            boxShadow:"0 24px 80px rgba(0,0,0,.2)",pointerEvents:"auto",overflow:"hidden"}}>
          {/* Header */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"18px 24px",borderBottom:`1px solid ${BORDER}`,background:PRIMARY}}>
            <div>
              <div style={{fontSize:"1rem",fontWeight:800,color:"#fff"}}>{title}</div>
              <div style={{fontSize:"0.7rem",color:"rgba(255,255,255,.65)"}}>กรอกข้อมูลนัดหมาย</div>
            </div>
            <button onClick={onClose} style={{width:32,height:32,borderRadius:9,border:"1px solid rgba(255,255,255,.2)",background:"rgba(255,255,255,.1)",color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <X size={15}/>
            </button>
          </div>
          {/* Body */}
          <div style={{padding:"22px 24px",overflowY:"auto",maxHeight:"65vh"}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
              <div style={{gridColumn:"1/-1"}}>
                <label className="form-label">บริษัท / ลูกค้า *</label>
                <input className="form-input" value={form.company} onChange={e=>set("company",e.target.value)} placeholder="ชื่อบริษัท" autoFocus/>
              </div>
              <div>
                <label className="form-label">ผู้ติดต่อ</label>
                <input className="form-input" value={form.contact} onChange={e=>set("contact",e.target.value)} placeholder="ชื่อผู้ติดต่อ"/>
              </div>
              <div>
                <label className="form-label">โทรศัพท์</label>
                <input className="form-input" value={form.phone} onChange={e=>set("phone",e.target.value)} placeholder="0XX-XXX-XXXX"/>
              </div>
              <div style={{gridColumn:"1/-1"}}>
                <label className="form-label">โอกาสการขาย</label>
                <input className="form-input" value={form.project} onChange={e=>set("project",e.target.value)} placeholder="ชื่อโอกาสการขาย"/>
              </div>
              <div>
                <label className="form-label">ประเภทอาคาร</label>
                <select className="form-select" value={form.buildingType} onChange={e=>set("buildingType",e.target.value)}>
                  {["EASYBUILD","RANBUILD","PREFAB","Custom"].map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">พื้นที่ (ตร.ม.)</label>
                <input className="form-input" type="number" value={form.area||""} onChange={e=>set("area",parseInt(e.target.value)||0)} placeholder="1200"/>
              </div>
              <div>
                <label className="form-label">จังหวัด</label>
                <input className="form-input" value={form.province} onChange={e=>set("province",e.target.value)} placeholder="กรุงเทพฯ"/>
              </div>
              <div>
                <label className="form-label">ผู้รับผิดชอบ</label>
                <select className="form-select" value={form.assigned} onChange={e=>set("assigned",e.target.value)}>
                  {TEAM.map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">วันที่ *</label>
                <input className="form-input" type="date" value={form.date} onChange={e=>set("date",e.target.value)}/>
              </div>
              <div>
                <label className="form-label">เวลา</label>
                <input className="form-input" type="time" value={form.time} onChange={e=>set("time",e.target.value)}/>
              </div>
              <div>
                <label className="form-label">ประเภทนัดหมาย</label>
                <select className="form-select" value={form.type} onChange={e=>set("type",e.target.value as ApptType)}>
                  {TYPES.map(t=><option key={t} value={t}>{apptTypeLabel[t]}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">สถานะ</label>
                <select className="form-select" value={form.status} onChange={e=>set("status",e.target.value as ApptStatus)}>
                  {(["upcoming","done","cancelled"] as ApptStatus[]).map(s=><option key={s} value={s}>{apptStatusLabel[s]}</option>)}
                </select>
              </div>
              <div style={{gridColumn:"1/-1"}}>
                <label className="form-label">หมายเหตุ</label>
                <textarea className="form-textarea" value={form.note} onChange={e=>set("note",e.target.value)} rows={3}
                  placeholder="รายละเอียดเพิ่มเติม..." style={{resize:"vertical",lineHeight:1.6}}/>
              </div>
            </div>
          </div>
          {/* Footer */}
          <div style={{padding:"14px 24px",borderTop:`1px solid ${BORDER}`,display:"flex",gap:8,justifyContent:"flex-end",background:"#fafafa"}}>
            <button onClick={onClose} className="btn btn-secondary btn-md">ยกเลิก</button>
            <button onClick={submit} className="btn btn-primary btn-md">บันทึก</button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Detail Modal ──────────────────────────────────────────────
function DetailModal({ appt, onClose, onStatusChange, onDelete, onEdit }:{
  appt: AppointmentMock;
  onClose:()=>void;
  onStatusChange:(id:number,s:ApptStatus)=>void;
  onDelete:(id:number)=>void;
  onEdit:(a:AppointmentMock)=>void;
}){
  const router = useRouter();
  const [showStatusDrop, setShowStatusDrop] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const tc = apptTypeColor[appt.type];
  const sc = apptStatusColor[appt.status];
  const relatedLead     = findLead(appt);
  const relatedCustomer = findCustomer(appt);
  const relatedProject  = findProject(appt);

  function goAndClose(href:string){ onClose(); router.push(href); }

  return (
    <>
      <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(45,45,45,.4)",zIndex:200}}/>
      <div style={{position:"fixed",inset:0,zIndex:210,display:"flex",alignItems:"center",justifyContent:"center",padding:24,pointerEvents:"none"}}>
        <div onClick={e=>e.stopPropagation()}
          style={{width:"100%",maxWidth:560,background:"#fff",borderRadius:20,border:`1px solid ${BORDER}`,
            boxShadow:"0 24px 80px rgba(0,0,0,.2)",pointerEvents:"auto",overflow:"hidden"}}>

          {/* Color bar + header */}
          <div style={{height:4,background:tc.text}}/>
          <div style={{padding:"18px 22px 14px",borderBottom:`1px solid ${BORDER}`,display:"flex",alignItems:"flex-start",gap:12}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5,flexWrap:"wrap"}}>
                <span className="badge" style={{background:tc.bg,color:tc.text}}>{apptTypeLabel[appt.type]}</span>
                <div style={{position:"relative"}}>
                  <button onClick={()=>setShowStatusDrop(p=>!p)} className="badge"
                    style={{background:sc.bg,color:sc.text,border:"none",cursor:"pointer"}}>
                    {apptStatusLabel[appt.status]} <ChevronDown size={11}/>
                  </button>
                  {showStatusDrop&&(
                    <>
                      <div onClick={()=>setShowStatusDrop(false)} style={{position:"fixed",inset:0,zIndex:300}}/>
                      <div style={{position:"absolute",top:"calc(100%+4px)",left:0,zIndex:310,background:"#fff",border:`1px solid ${BORDER}`,borderRadius:12,boxShadow:"0 8px 28px rgba(0,0,0,.15)",overflow:"hidden",minWidth:160,padding:4}}>
                        {(["upcoming","done","cancelled"] as ApptStatus[]).map(s=>{
                          const c2=apptStatusColor[s]; const active=appt.status===s;
                          return(
                            <button key={s} onClick={()=>{onStatusChange(appt.id,s);setShowStatusDrop(false);}}
                              style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"8px 10px",borderRadius:8,border:"none",background:active?c2.bg:"transparent",cursor:"pointer",textAlign:"left"}}>
                              <span style={{width:8,height:8,borderRadius:"50%",background:c2.text,flexShrink:0}}/>
                              <span style={{fontSize:"0.78rem",fontWeight:active?700:500,color:active?c2.text:STEEL,flex:1}}>{apptStatusLabel[s]}</span>
                              {active&&<Check size={12} color={c2.text}/>}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div style={{fontSize:"1.15rem",fontWeight:800,color:STEEL,marginBottom:3}}>{appt.company}</div>
              <div style={{fontSize:"0.8rem",color:MUTED}}>{appt.contact} · {appt.phone}</div>
            </div>
            <div style={{display:"flex",gap:6,flexShrink:0}}>
              <button onClick={()=>onEdit(appt)} className="btn btn-secondary btn-sm" style={{padding:0,width:32,height:32,justifyContent:"center"}}>
                <Edit2 size={13}/>
              </button>
              <button onClick={onClose} className="btn btn-secondary btn-sm" style={{padding:0,width:32,height:32,justifyContent:"center"}}>
                <X size={15}/>
              </button>
            </div>
          </div>

          {/* Body */}
          <div style={{padding:"18px 22px",display:"flex",flexDirection:"column",gap:14,maxHeight:"55vh",overflowY:"auto"}}>
            {/* Date / time / location */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
              {[
                {icon:<Calendar size={13}/>, label:"วันที่", value:fmtDateShort(appt.date)+" ("+fmtDate(appt.date).split(" ")[0]+")"},
                {icon:<Clock size={13}/>, label:"เวลา", value:appt.time+" น."},
                {icon:<MapPin size={13}/>, label:"จังหวัด", value:appt.province},
              ].map(r=>(
                <div key={r.label} style={{padding:"10px 12px",borderRadius:10,background:"#f8f9fb",border:`1px solid #f0f4f8`}}>
                  <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:4,color:MUTED}}>{r.icon}<span style={{fontSize:"0.62rem",fontWeight:700,color:MUTED}}>{r.label}</span></div>
                  <div style={{fontSize:"0.8rem",fontWeight:700,color:STEEL}}>{r.value}</div>
                </div>
              ))}
            </div>

            {/* Project info */}
            <div style={{padding:"12px 14px",borderRadius:12,background:"#f8f9fb",border:`1px solid #f0f4f8`}}>
              <div style={{fontSize:"0.65rem",fontWeight:700,color:MUTED,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:6}}>โอกาสการขาย</div>
              <div style={{fontSize:"0.9rem",fontWeight:700,color:STEEL,marginBottom:4}}>{appt.project}</div>
              <div style={{display:"flex",gap:10}}>
                <span style={{fontSize:"0.72rem",color:MUTED}}>{appt.buildingType}</span>
                <span style={{fontSize:"0.72rem",color:MUTED}}>·</span>
                <span style={{fontSize:"0.72rem",color:MUTED}}>{appt.area.toLocaleString("th-TH")} ตร.ม.</span>
              </div>
            </div>

            {/* Assigned + note */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div style={{padding:"10px 12px",borderRadius:10,background:"#f8f9fb",border:`1px solid #f0f4f8`}}>
                <div style={{fontSize:"0.62rem",fontWeight:700,color:MUTED,marginBottom:5}}>ผู้รับผิดชอบ</div>
                <div style={{display:"flex",alignItems:"center",gap:7}}>
                  <div style={{width:28,height:28,borderRadius:"50%",background:PRIMARY,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    <span style={{color:"#fff",fontSize:"0.68rem",fontWeight:800}}>{appt.assigned.charAt(0)}</span>
                  </div>
                  <span style={{fontSize:"0.82rem",fontWeight:700,color:STEEL}}>{appt.assigned}</span>
                </div>
              </div>
              {appt.note&&(
                <div style={{padding:"10px 12px",borderRadius:10,background:"#f8f9fb",border:`1px solid #f0f4f8`}}>
                  <div style={{fontSize:"0.62rem",fontWeight:700,color:MUTED,marginBottom:5}}>หมายเหตุ</div>
                  <div style={{fontSize:"0.78rem",color:STEEL,lineHeight:1.5}}>{appt.note}</div>
                </div>
              )}
            </div>

            {/* Related links */}
            {(relatedLead||relatedCustomer||relatedProject)&&(
              <div>
                <div style={{fontSize:"0.65rem",fontWeight:700,color:MUTED,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:8}}>เชื่อมต่อ</div>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {relatedLead&&(
                    <button onClick={()=>goAndClose(`/leads/${relatedLead.numId}`)}
                      style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:10,background:"#dce5f0",border:"none",cursor:"pointer",textAlign:"left"}}
                      onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="#ccd8ec";}}
                      onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="#dce5f0";}}>
                      <span style={{fontSize:"0.7rem",fontWeight:700,background:PRIMARY,color:"#fff",borderRadius:6,padding:"2px 7px",flexShrink:0}}>ลีด</span>
                      <span style={{fontSize:"0.82rem",fontWeight:700,color:PRIMARY,flex:1}}>{relatedLead.company}</span>
                      <ExternalLink size={12} color={PRIMARY}/>
                    </button>
                  )}
                  {relatedCustomer&&(
                    <button onClick={()=>goAndClose(`/customers/${relatedCustomer.id}`)}
                      style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:10,background:"#e5faf0",border:"none",cursor:"pointer",textAlign:"left"}}
                      onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="#d0f5e6";}}
                      onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="#e5faf0";}}>
                      <span style={{fontSize:"0.7rem",fontWeight:700,background:"#059669",color:"#fff",borderRadius:6,padding:"2px 7px",flexShrink:0}}>ลูกค้า</span>
                      <span style={{fontSize:"0.82rem",fontWeight:700,color:"#059669",flex:1}}>{relatedCustomer.company}</span>
                      <ExternalLink size={12} color="#059669"/>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Delete */}
            <div style={{paddingTop:4}}>
              {!showDeleteConfirm?(
                <button onClick={()=>setShowDeleteConfirm(true)} className="btn btn-danger btn-sm" style={{width:"100%",justifyContent:"center"}}>
                  <Trash2 size={14}/> ลบนัดหมายนี้
                </button>
              ):(
                <div style={{borderRadius:10,border:"1px solid #fca5a5",overflow:"hidden"}}>
                  <div style={{padding:"8px 14px",background:"#fee2e2",fontSize:"0.72rem",color:"#dc2626",fontWeight:600}}>ยืนยันลบนัดหมาย "{appt.company}"?</div>
                  <div style={{display:"flex"}}>
                    <button onClick={()=>{onDelete(appt.id);onClose();}} style={{flex:1,padding:"8px",background:"#dc2626",border:"none",color:"#fff",fontSize:"0.72rem",fontWeight:700,cursor:"pointer"}}>ลบเลย</button>
                    <button onClick={()=>setShowDeleteConfirm(false)} style={{flex:1,padding:"8px",background:"#fff",border:"none",borderLeft:"1px solid #fca5a5",color:STEEL,fontSize:"0.72rem",cursor:"pointer"}}>ยกเลิก</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Appointment Card ──────────────────────────────────────────
function ApptCard({ a, onClick }:{ a:AppointmentMock; onClick:()=>void }){
  const tc = apptTypeColor[a.type];
  const sc = apptStatusColor[a.status];
  return (
    <div onClick={onClick} className="card"
      style={{padding:"14px 16px",display:"flex",alignItems:"center",gap:14,cursor:"pointer"}}
      onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor="#C0C0C0";}}
      onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor=BORDER;}}>
      <div style={{width:4,height:52,borderRadius:99,background:tc.text,flexShrink:0}}/>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
          <span style={{fontSize:"0.88rem",fontWeight:700,color:STEEL}}>{a.company}</span>
          <span style={{fontSize:"0.72rem",color:MUTED}}>· {a.contact}</span>
        </div>
        <div style={{fontSize:"0.78rem",color:MUTED,marginBottom:5,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
          {a.project} ({a.buildingType} {a.area.toLocaleString("th-TH")} ตร.ม.)
        </div>
        <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
          <span style={{display:"flex",alignItems:"center",gap:4,fontSize:"0.72rem",color:MUTED}}><Clock size={10}/> {a.time} น.</span>
          <span style={{display:"flex",alignItems:"center",gap:4,fontSize:"0.72rem",color:MUTED}}><MapPin size={10}/> {a.province}</span>
          <span style={{display:"flex",alignItems:"center",gap:4,fontSize:"0.72rem",color:MUTED}}><Phone size={10}/> {a.phone}</span>
        </div>
      </div>
      <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:5,flexShrink:0}}>
        <span className="badge" style={{background:tc.bg,color:tc.text}}>{apptTypeLabel[a.type]}</span>
        <span className="badge" style={{background:sc.bg,color:sc.text}}>{apptStatusLabel[a.status]}</span>
        <span style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:"0.68rem",color:MUTED}}><User size={11} strokeWidth={2} /> {a.assigned}</span>
      </div>
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────
function CalendarSidebar({ calYear, calMonth, apptData, onCard }:{
  calYear:number; calMonth:number; apptData:AppointmentMock[]; onCard:(a:AppointmentMock)=>void;
}){
  const allGrouped = groupByDate(apptData);
  const todayAppts = (allGrouped[TODAY]??[]).sort((a,b)=>a.time.localeCompare(b.time));
  const upcoming = apptData.filter(a=>a.status==="upcoming"&&a.date>TODAY).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,4);
  const monthStr = `${calYear}-${padDate(calMonth+1)}`;
  const monthAppts = apptData.filter(a=>a.date.startsWith(monthStr));
  const dotColors: Record<ApptType,string> = {
    survey:"#003366",design_meet:"#003366",presentation:"#d97706",contract_sign:"#003366",handover:"#059669",follow_up:"#6b7280",
  };
  return (
    <div style={{display:"flex",flexDirection:"column",gap:14,width:270,flexShrink:0}}>
      {/* Today */}
      <div className="card" style={{padding:16}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <span style={{fontSize:"0.84rem",fontWeight:700,color:STEEL}}>วันนี้ — {fmtDateShort(TODAY)}</span>
          <span className="badge" style={{background:"#dce5f0",color:PRIMARY}}>{todayAppts.length} กิจกรรม</span>
        </div>
        {todayAppts.length===0?(
          <div style={{fontSize:"0.78rem",color:MUTED,textAlign:"center",padding:"12px 0"}}>ไม่มีนัดหมายวันนี้</div>
        ):(
          <div>{todayAppts.map((a,idx)=>{
            const isLast=idx===todayAppts.length-1;
            return(
              <div key={a.id} onClick={()=>onCard(a)} style={{display:"flex",gap:10,paddingBottom:isLast?0:12,marginBottom:0,borderBottom:isLast?"none":`1px solid ${BORDER}`,paddingTop:idx===0?0:10,cursor:"pointer"}}>
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,minWidth:38}}>
                  <span style={{fontSize:"0.65rem",color:MUTED,fontWeight:600}}>{a.time}</span>
                  <div style={{width:10,height:10,borderRadius:"50%",background:dotColors[a.type],flexShrink:0}}/>
                  {!isLast&&<div style={{flex:1,width:1,background:BORDER,minHeight:16}}/>}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:"0.8rem",fontWeight:700,color:STEEL,marginBottom:2}}>{a.company}</div>
                  <div style={{fontSize:"0.68rem",color:MUTED,marginBottom:4}}>{a.project}</div>
                  <span className="badge" style={{background:TYPE_PILL[a.type].bg,color:TYPE_PILL[a.type].color}}>{apptTypeLabel[a.type]}</span>
                </div>
              </div>
            );
          })}</div>
        )}
      </div>
      {/* Upcoming */}
      <div className="card" style={{padding:16}}>
        <div style={{fontSize:"0.84rem",fontWeight:700,color:STEEL,marginBottom:14}}>กำหนดนัดใกล้ถึง</div>
        {upcoming.length===0?(
          <div style={{fontSize:"0.78rem",color:MUTED,textAlign:"center",padding:"8px 0"}}>ไม่มีนัดหมายที่ใกล้ถึง</div>
        ):(
          <div>{upcoming.map((a,idx)=>{
            const days=daysUntil(a.date);
            const isOverdue=days<0; const isWarn=days>=0&&days<=7;
            const metaColor=isOverdue?"#dc2626":isWarn?"#d97706":MUTED;
            const isLast=idx===upcoming.length-1;
            return(
              <div key={a.id} onClick={()=>onCard(a)} style={{display:"flex",gap:10,paddingTop:idx===0?0:10,paddingBottom:isLast?0:10,borderBottom:isLast?"none":`1px solid ${BORDER}`,cursor:"pointer"}}
                onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="#f8f9fb";}}
                onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="";}}>
                <div style={{width:10,height:10,borderRadius:"50%",background:isOverdue?"#dc2626":isWarn?"#d97706":dotColors[a.type],flexShrink:0,marginTop:3}}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:"0.8rem",fontWeight:700,color:STEEL,marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.company}</div>
                  <div style={{fontSize:"0.68rem",color:metaColor,fontWeight:600}}>{fmtDateShort(a.date)} · {isOverdue?`เกิน ${Math.abs(days)} วัน`:`${days} วันที่เหลือ`}</div>
                </div>
              </div>
            );
          })}</div>
        )}
      </div>
      {/* Month stats */}
      <div style={{background:PRIMARY,borderRadius:"var(--radius-xl)",padding:16}}>
        <div style={{fontSize:"0.84rem",fontWeight:700,color:"#fff",marginBottom:10}}>{TH_MONTHS[calMonth]} {calYear+543}</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div style={{background:"rgba(255,255,255,.15)",borderRadius:10,padding:10,textAlign:"center"}}>
            <div style={{fontSize:"1.4rem",fontWeight:800,color:"#fff"}}>{monthAppts.length}</div>
            <div style={{fontSize:"0.68rem",color:"rgba(255,255,255,.7)"}}>นัดหมาย</div>
          </div>
          <div style={{background:"rgba(255,255,255,.15)",borderRadius:10,padding:10,textAlign:"center"}}>
            <div style={{fontSize:"1.4rem",fontWeight:800,color:"#fff"}}>{monthAppts.filter(a=>a.status==="upcoming").length}</div>
            <div style={{fontSize:"0.68rem",color:"rgba(255,255,255,.7)"}}>กำลังจะมาถึง</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Calendar Grid ─────────────────────────────────────────────
function CalendarGrid({ calYear, calMonth, apptData, onCard, onPrev, onNext }:{
  calYear:number; calMonth:number; apptData:AppointmentMock[];
  onCard:(a:AppointmentMock)=>void; onPrev:()=>void; onNext:()=>void;
}){
  const [selectedDate, setSelectedDate] = useState<string|null>(null);
  const allGrouped = groupByDate(apptData);

  const firstDay = new Date(calYear,calMonth,1).getDay();
  const daysInMonth = new Date(calYear,calMonth+1,0).getDate();
  const prevMonthDays = new Date(calYear,calMonth,0).getDate();
  const cells: {day:number;isOther:boolean;dateKey:string}[] = [];

  for(let i=firstDay-1;i>=0;i--){
    const d=prevMonthDays-i, pm=calMonth===0?12:calMonth, py=calMonth===0?calYear-1:calYear;
    cells.push({day:d,isOther:true,dateKey:`${py}-${padDate(pm)}-${padDate(d)}`});
  }
  for(let d=1;d<=daysInMonth;d++) cells.push({day:d,isOther:false,dateKey:`${calYear}-${padDate(calMonth+1)}-${padDate(d)}`});
  let nm=calMonth+2,ny=calYear; if(nm>12){nm=1;ny++;}
  let nd=1; while(cells.length%7!==0) cells.push({day:nd++,isOther:true,dateKey:`${ny}-${padDate(nm)}-${padDate(nd-1)}`});

  const selectedItems = selectedDate ? (allGrouped[selectedDate]??[]) : [];

  return (
    <div style={{flex:1,minWidth:0}}>
      <div className="card" style={{overflow:"hidden",marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 20px",borderBottom:`1px solid ${BORDER}`}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <button onClick={onPrev} style={{width:32,height:32,borderRadius:8,background:"#f0f4f8",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:PRIMARY}}><ChevronLeft size={15}/></button>
            <span style={{fontSize:"0.95rem",fontWeight:800,color:STEEL}}>{TH_MONTHS[calMonth]} {calYear+543}</span>
            <button onClick={onNext} style={{width:32,height:32,borderRadius:8,background:"#f0f4f8",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:PRIMARY}}><ChevronRight size={15}/></button>
          </div>
        </div>
        <div style={{padding:"16px 20px"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:8}}>
            {TH_DAYS_SHORT.map(d=><div key={d} style={{textAlign:"center",fontSize:"0.68rem",fontWeight:700,color:MUTED,padding:"6px 0"}}>{d}</div>)}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
            {cells.map((cell,idx)=>{
              const isToday=cell.dateKey===TODAY, isSel=selectedDate===cell.dateKey;
              const appts=cell.isOther?[]:(allGrouped[cell.dateKey]??[]);
              const visible=appts.slice(0,2); const extra=appts.length-2;
              return(
                <div key={idx} onClick={()=>{if(cell.isOther)return;setSelectedDate(isSel?null:cell.dateKey);}}
                  style={{minHeight:88,padding:"6px 7px",borderRadius:10,cursor:cell.isOther?"default":"pointer",
                    opacity:cell.isOther?0.35:1,background:isSel?"#f0f4f8":"transparent",
                    border:isSel?`1px solid ${PRIMARY}`:"1px solid transparent",transition:"background .12s"}}
                  onMouseEnter={e=>{if(!cell.isOther&&!isSel){(e.currentTarget as HTMLElement).style.background="#f0f4f8";(e.currentTarget as HTMLElement).style.borderColor=BORDER;}}}
                  onMouseLeave={e=>{if(!cell.isOther&&!isSel){(e.currentTarget as HTMLElement).style.background="transparent";(e.currentTarget as HTMLElement).style.borderColor="transparent";}}}>
                  <div style={{marginBottom:4}}>
                    {isToday?(
                      <div style={{width:24,height:24,borderRadius:"50%",background:PRIMARY,display:"flex",alignItems:"center",justifyContent:"center"}}>
                        <span style={{fontSize:"0.82rem",fontWeight:800,color:"#fff"}}>{cell.day}</span>
                      </div>
                    ):(
                      <div style={{width:24,height:24,display:"flex",alignItems:"center",justifyContent:"center"}}>
                        <span style={{fontSize:"0.82rem",fontWeight:appts.length>0?600:400,color:STEEL}}>{cell.day}</span>
                      </div>
                    )}
                  </div>
                  {visible.map(a=>{
                    const pill=TYPE_PILL[a.type];
                    return(
                      <div key={a.id} onClick={e=>{e.stopPropagation();onCard(a);}}
                        style={{fontSize:"0.62rem",borderRadius:4,padding:"1px 5px",marginBottom:2,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",background:pill.bg,color:pill.color,cursor:"pointer"}}>
                        {a.company}
                      </div>
                    );
                  })}
                  {extra>0&&<div style={{fontSize:"0.58rem",color:MUTED,fontWeight:600,paddingLeft:2}}>+{extra} อื่นๆ</div>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected day list */}
      {selectedDate&&!cells.find(c=>c.dateKey===selectedDate)?.isOther&&(
        <div>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
            <div style={{display:"flex",alignItems:"center",gap:6,background:STEEL,color:"#fff",borderRadius:99,padding:"4px 14px",fontSize:"0.74rem",fontWeight:700,flexShrink:0}}>
              <Calendar size={11}/> {fmtDate(selectedDate)}
            </div>
            <div style={{flex:1,height:1,background:BORDER}}/>
            <span style={{fontSize:"0.7rem",color:MUTED,flexShrink:0}}>{selectedItems.length} นัดหมาย</span>
          </div>
          {selectedItems.length===0?(
            <div className="card" style={{padding:"28px",textAlign:"center",color:MUTED,fontSize:"0.84rem"}}>ไม่มีนัดหมายในวันนี้</div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {selectedItems.map(a=><ApptCard key={a.id} a={a} onClick={()=>onCard(a)}/>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function AppointmentsPage(){
  const [apptData, setApptData] = useState<AppointmentMock[]>(INIT_APPTS);
  const [query, setQuery] = useState("");
  const [filterType, setFilterType] = useState<ApptType|"ALL">("ALL");
  const [filterStatus, setFilterStatus] = useState<ApptStatus|"ALL">("upcoming");
  const [view, setView] = useState<"list"|"calendar">("calendar");
  const [calYear, setCalYear] = useState(2026);
  const [calMonth, setCalMonth] = useState(5);

  const [showAdd, setShowAdd]       = useState(false);
  const [selectedAppt, setSelectedAppt] = useState<AppointmentMock|null>(null);
  const [editingAppt, setEditingAppt]   = useState<AppointmentMock|null>(null);

  function prevMonth(){ if(calMonth===0){setCalYear(y=>y-1);setCalMonth(11);}else setCalMonth(m=>m-1); }
  function nextMonth(){ if(calMonth===11){setCalYear(y=>y+1);setCalMonth(0);}else setCalMonth(m=>m+1); }
  function goToday(){ setCalYear(2026); setCalMonth(5); }

  function addAppt(form: ApptForm){
    const id = Math.max(...apptData.map(a=>a.id),0)+1;
    setApptData(p=>[{...form,id},...p]);
  }
  function editAppt(form: ApptForm){
    if(!editingAppt) return;
    setApptData(p=>p.map(a=>a.id===editingAppt.id?{...form,id:editingAppt.id}:a));
    setSelectedAppt({...form,id:editingAppt.id});
  }
  function changeStatus(id:number,s:ApptStatus){
    setApptData(p=>p.map(a=>a.id===id?{...a,status:s}:a));
    setSelectedAppt(p=>p&&p.id===id?{...p,status:s}:p);
  }
  function deleteAppt(id:number){
    setApptData(p=>p.filter(a=>a.id!==id));
  }
  function openDetail(a:AppointmentMock){ setSelectedAppt(apptData.find(x=>x.id===a.id)||a); }
  function openEdit(a:AppointmentMock){ setEditingAppt(a); setSelectedAppt(null); }

  const filtered = useMemo(()=>apptData.filter(a=>{
    const q=query.toLowerCase();
    const matchQ=!query||a.company.toLowerCase().includes(q)||a.contact.toLowerCase().includes(q)||a.project.toLowerCase().includes(q);
    const matchT=filterType==="ALL"||a.type===filterType;
    const matchS=filterStatus==="ALL"||a.status===filterStatus;
    return matchQ&&matchT&&matchS;
  }),[apptData,query,filterType,filterStatus]);

  const todayCount     = apptData.filter(a=>a.date===TODAY).length;
  const upcomingCount  = apptData.filter(a=>a.status==="upcoming").length;
  const doneCount      = apptData.filter(a=>a.status==="done").length;
  const cancelledCount = apptData.filter(a=>a.status==="cancelled").length;

  const grouped = useMemo(()=>groupByDate(filtered),[filtered]);

  return (
    <div className="erp">
      {/* Header */}
      <div className="page-head">
        <div>
          <h2>นัดหมาย</h2>
          <p>ภาพรวมกำหนดการและนัดหมายทั้งหมด · {apptData.length} รายการ</p>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          {view==="calendar"&&(
            <>
              <button onClick={prevMonth} className="btn btn-secondary btn-sm">
                <ChevronLeft size={13}/> ก่อนหน้า
              </button>
              <button className="btn btn-secondary btn-sm" style={{borderColor:PRIMARY,color:PRIMARY,cursor:"default",fontWeight:800}}>
                {TH_MONTHS[calMonth]} {calYear+543}
              </button>
              <button onClick={nextMonth} className="btn btn-secondary btn-sm">
                ถัดไป <ChevronRight size={13}/>
              </button>
              <button onClick={goToday} className="btn btn-secondary btn-sm">
                <Calendar size={13}/> วันนี้
              </button>
            </>
          )}
          <button onClick={()=>setShowAdd(true)} className="btn btn-primary btn-md">
            <Plus size={14}/> เพิ่มนัดหมาย
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="stat-grid">
        {([
          {label:"นัดหมายทั้งหมด",value:apptData.length,color:PRIMARY,key:"ALL"},
          {label:"วันนี้",value:todayCount,color:"#dc2626",key:"today"},
          {label:"กำลังจะมาถึง",value:upcomingCount,color:PRIMARY,key:"upcoming"},
          {label:"เสร็จแล้ว",value:doneCount,color:"#059669",key:"done"},
        ] as const).map((s,i)=>(
          <div key={i} className="stat-card clickable" onClick={()=>{
            if(s.key==="ALL") setFilterStatus("ALL");
            else if(s.key==="today"){ setFilterStatus("ALL"); }
            else setFilterStatus(s.key as ApptStatus);
          }}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{color:s.color}}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          {/* Status pills */}
          <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
            {([["ALL","ทั้งหมด",apptData.length],["upcoming","กำลังจะมาถึง",upcomingCount],["done","เสร็จแล้ว",doneCount],["cancelled","ยกเลิก",cancelledCount]] as const).map(([key,label,cnt])=>{
              const active=filterStatus===key;
              const col=key==="upcoming"?{bg:"#dce5f0",text:PRIMARY}:key==="done"?{bg:"#e5faf0",text:"#059669"}:key==="cancelled"?{bg:"#fee2e2",text:"#dc2626"}:{bg:"#dce5f0",text:PRIMARY};
              return(
                <button key={key} onClick={()=>setFilterStatus(key as ApptStatus|"ALL")}
                  style={{padding:"5px 14px",borderRadius:99,cursor:"pointer",border:`1px solid ${active?col.text+"55":BORDER}`,background:active?col.bg:"#fff",color:active?col.text:MUTED,fontSize:"0.73rem",fontWeight:600}}>
                  {label} ({cnt})
                </button>
              );
            })}
          </div>
          {/* Search */}
          <div style={{display:"flex",alignItems:"center",gap:8,background:"#fff",border:`1px solid ${BORDER}`,borderRadius:10,padding:"7px 12px",minWidth:200}}>
            <Search size={13} color={MUTED}/>
            <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="ค้นหาบริษัท / โอกาสการขาย..."
              style={{border:"none",outline:"none",fontSize:"0.78rem",color:STEEL,background:"transparent",flex:1}}/>
            {query&&<button onClick={()=>setQuery("")} style={{background:"none",border:"none",cursor:"pointer",color:MUTED,padding:0,display:"flex"}}><X size={13}/></button>}
          </div>
          {/* Type pills */}
          <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
            {(["ALL",...TYPES] as const).map(t=>(
              <button key={t} onClick={()=>setFilterType(t as ApptType|"ALL")}
                style={{padding:"5px 10px",borderRadius:99,cursor:"pointer",border:`1px solid ${filterType===t?PRIMARY:BORDER}`,background:filterType===t?"#dce5f0":"#fff",color:filterType===t?PRIMARY:MUTED,fontSize:"0.69rem",fontWeight:600}}>
                {t==="ALL"?"ทุกประเภท":apptTypeLabel[t as ApptType]}
              </button>
            ))}
          </div>
        </div>
        {/* View toggle */}
        <div style={{display:"flex",background:"#f3f4f6",borderRadius:99,padding:3,gap:2,flexShrink:0}}>
          {([["list","รายการ",<LayoutList size={13}/>],["calendar","ปฏิทิน",<CalendarDays size={13}/>]] as const).map(([v,label,icon])=>(
            <button key={v} onClick={()=>setView(v as "list"|"calendar")}
              style={{display:"flex",alignItems:"center",gap:5,padding:"5px 13px",borderRadius:99,border:"none",cursor:"pointer",fontSize:"0.73rem",fontWeight:700,background:view===v?PRIMARY:"transparent",color:view===v?"#fff":MUTED,transition:"background .15s,color .15s"}}>
              {icon} {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {view==="calendar"?(
        <div style={{display:"grid",gridTemplateColumns:"1fr 270px",gap:14}}>
          <CalendarGrid calYear={calYear} calMonth={calMonth} apptData={filtered} onCard={openDetail} onPrev={prevMonth} onNext={nextMonth}/>
          <CalendarSidebar calYear={calYear} calMonth={calMonth} apptData={apptData} onCard={openDetail}/>
        </div>
      ):(
        Object.keys(grouped).length===0?(
          <div className="card" style={{padding:"40px",textAlign:"center",color:MUTED,fontSize:"0.84rem"}}>ไม่พบนัดหมาย</div>
        ):(
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            {Object.entries(grouped).sort(([a],[b])=>a.localeCompare(b)).map(([date,items])=>(
              <div key={date}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,background:STEEL,color:"#fff",borderRadius:99,padding:"4px 14px",fontSize:"0.74rem",fontWeight:700,flexShrink:0}}>
                    <Calendar size={11}/> {fmtDate(date)}
                  </div>
                  <div style={{flex:1,height:1,background:BORDER}}/>
                  <span style={{fontSize:"0.7rem",color:MUTED,flexShrink:0}}>{items.length} นัดหมาย</span>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {items.map(a=><ApptCard key={a.id} a={a} onClick={()=>openDetail(a)}/>)}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Add Modal */}
      {showAdd&&<ApptModal initial={BLANK} title="เพิ่มนัดหมายใหม่" onSave={addAppt} onClose={()=>setShowAdd(false)}/>}

      {/* Edit Modal */}
      {editingAppt&&(
        <ApptModal
          initial={{company:editingAppt.company,contact:editingAppt.contact,phone:editingAppt.phone,project:editingAppt.project,buildingType:editingAppt.buildingType,area:editingAppt.area,province:editingAppt.province,date:editingAppt.date,time:editingAppt.time,type:editingAppt.type,assigned:editingAppt.assigned,status:editingAppt.status,note:editingAppt.note}}
          title="แก้ไขนัดหมาย" onSave={editAppt} onClose={()=>setEditingAppt(null)}/>
      )}

      {/* Detail Modal */}
      {selectedAppt&&(
        <DetailModal appt={selectedAppt}
          onClose={()=>setSelectedAppt(null)}
          onStatusChange={changeStatus}
          onDelete={deleteAppt}
          onEdit={a=>{openEdit(a);}}/>
      )}
    </div>
  );
}
