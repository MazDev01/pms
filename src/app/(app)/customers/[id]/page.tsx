"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Phone, Mail, MapPin, Users2, FileText, StickyNote,
  ArrowLeft, Edit2, Building2, X, type LucideIcon,
} from "lucide-react";
import {
  customers, quotations,
  quotationStatusLabel, quotationStatusColor,
} from "@/lib/mock";

const PRIMARY = "#003366"; const STEEL = "#2D2D2D"; const BORDER = "#e5e7eb"; const MUTED = "#6b7280";

const CONTACT_ICON: Record<string, LucideIcon> = { call: Phone, email: Mail, meeting: Users2, visit: MapPin, note: StickyNote, doc: FileText };

type ContactEntry = { id:number; date:string; icon:string; text:string; type:string };
const INIT_CONTACTS: ContactEntry[] = [
  { id:1, date:"20 มิ.ย. 2569", icon:"call",    text:"โทรติดตามสถานะโอกาสการขาย — ได้รับการยืนยัน", type:"call" },
  { id:2, date:"12 มิ.ย. 2569", icon:"email",   text:"ส่งอีเมลเอกสารสัญญาฉบับปรับปรุง", type:"email" },
  { id:3, date:"5 มิ.ย. 2569",  icon:"meeting", text:"ประชุมลูกค้า — ตกลงเงื่อนไขข้อเสนอ", type:"meeting" },
  { id:4, date:"28 พ.ค. 2569",  icon:"doc",     text:"ส่งใบเสนอราคาเพิ่มเติม", type:"doc" },
];

type TabKey = "quotations" | "contacts";

type EditCustomer = { name:string; phone:string; email:string; province:string; company:string };

export default function CustomerDetailPage() {
  const params = useParams();
  const customerId = Number(params.id);
  const [tab, setTab]             = useState<TabKey>("quotations");
  const [contacts, setContacts]   = useState<ContactEntry[]>(INIT_CONTACTS);
  const [contactText, setContactText] = useState("");
  const [contactType, setContactType] = useState("call");
  const [showEdit, setShowEdit]   = useState(false);

  const base = customers.find(c => c.id === customerId);
  const [editForm, setEditForm]   = useState<EditCustomer|null>(null);
  const [saved,    setSaved]      = useState<Partial<EditCustomer>>({});

  if (!base) {
    return (
      <div className="erp" style={{ padding:40, textAlign:"center" }}>
        <p style={{ color:MUTED }}>ไม่พบข้อมูลลูกค้า</p>
        <Link href="/customers" className="btn btn-secondary btn-sm" style={{ marginTop:12 }}>
          <ArrowLeft size={13}/> กลับ
        </Link>
      </div>
    );
  }

  const customer = { ...base, ...saved };
  const relatedQuotations = quotations.filter(q => q.customerId === customer.id);
  const totalValue = relatedQuotations.reduce((s,q) => s + parseInt((q.total||"0").replace(/[^0-9]/g,"")||"0"), 0);

  const tabs: { key:TabKey; label:string; icon:React.ReactNode }[] = [
    { key:"quotations", label:`ใบเสนอราคา (${relatedQuotations.length})`, icon:<FileText size={12}/> },
    { key:"contacts",   label:`การติดต่อ (${contacts.length})`,         icon:<StickyNote size={12}/> },
  ];

  function addContact() {
    if (!contactText.trim()) return;
    setContacts(prev => [{
      id:Date.now(), date:"23 มิ.ย. 2569",
      icon: contactType,
      text: contactText.trim(), type: contactType,
    }, ...prev]);
    setContactText("");
  }

  function openEdit() {
    setEditForm({ name:customer.name, phone:customer.phone, email:customer.email, province:customer.province, company:customer.company });
    setShowEdit(true);
  }

  function saveEdit() {
    if (editForm) { setSaved({ name:editForm.name, phone:editForm.phone, email:editForm.email, province:editForm.province, company:editForm.company }); }
    setShowEdit(false);
  }

  return (
    <div className="erp" style={{ maxWidth:1100 }}>
      {/* Back */}
      <div style={{ marginBottom:14 }}>
        <Link href="/customers" className="btn btn-ghost btn-sm" style={{ paddingLeft:0 }}>
          <ArrowLeft size={14}/> กลับ
        </Link>
      </div>

      {/* Header */}
      <div className="page-head">
        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          <div style={{ width:56, height:56, borderRadius:16, background:customer.color, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:800, fontSize:"1.2rem", flexShrink:0 }}>
            {customer.initials}
          </div>
          <div>
            <h2 style={{ marginBottom:4 }}>{customer.name}</h2>
            <p style={{ margin:0 }}>{customer.company}</p>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:8 }}>
              {customer.tags.map((tag:string) => (
                <span key={tag} className="badge" style={{ background:tag==="VIP"?"#fff3cd":tag==="Enterprise"?"#dce5f0":"#f0f0f5", color:tag==="VIP"?"#d97706":tag==="Enterprise"?PRIMARY:MUTED }}>
                  {tag}
                </span>
              ))}
              <span className="badge" style={{ background:"#dce5f0", color:PRIMARY }}>{customer.category}</span>
            </div>
          </div>
        </div>
        <button className="btn btn-secondary btn-md" onClick={openEdit}>
          <Edit2 size={13}/> แก้ไขข้อมูล
        </button>
      </div>

      {/* Stat tiles */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon"><Phone size={20}/></div>
          <div className="stat-label">โทรศัพท์</div>
          <div className="stat-value" style={{ fontSize:"1rem" }}>{customer.phone}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><Mail size={20}/></div>
          <div className="stat-label">อีเมล</div>
          <div className="stat-value" style={{ fontSize:"0.92rem", wordBreak:"break-all" }}>{customer.email}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><MapPin size={20}/></div>
          <div className="stat-label">จังหวัด</div>
          <div className="stat-value" style={{ fontSize:"1rem" }}>{customer.province}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><FileText size={20}/></div>
          <div className="stat-label">มูลค่ารวม</div>
          <div className="stat-value">฿{totalValue.toLocaleString()}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="card">
        <div className="tab-bar">
          {tabs.map(t => (
            <button key={t.key} className={`tab-item${tab===t.key?" active":""}`} onClick={() => setTab(t.key)}
              style={{ display:"flex", alignItems:"center", gap:5 }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Tab: Quotations */}
        {tab === "quotations" && (
          relatedQuotations.length === 0 ? (
            <div className="card-body" style={{ padding:32, textAlign:"center", color:MUTED, fontSize:"0.82rem" }}>ยังไม่มีใบเสนอราคา</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {["เลขที่ใบเสนอราคา","โอกาสการขาย","มูลค่า","สถานะ","วันที่"].map(h => (
                      <th key={h} className={h==="มูลค่า"?"num":undefined}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {relatedQuotations.map(q => {
                    const qc = quotationStatusColor[q.status];
                    return (
                      <tr key={q.id}>
                        <td style={{ fontWeight:700 }}>{q.id}</td>
                        <td style={{ color:MUTED }}>{q.project}</td>
                        <td className="num" style={{ fontWeight:800 }}>{q.total}</td>
                        <td>
                          <span className="badge" style={{ background:qc.bg, color:qc.text }}>{quotationStatusLabel[q.status]}</span>
                        </td>
                        <td style={{ color:MUTED }}>{q.date}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* Tab: Contact history */}
        {tab === "contacts" && (
          <div className="card-body" style={{ paddingTop:16 }}>
            {/* Add contact form */}
            <div style={{ marginBottom:18, padding:"14px 16px", background:"#f8f9fb", borderRadius:12, border:"1px solid #f0f0f5" }}>
              <div style={{ fontSize:"0.74rem", fontWeight:700, color:STEEL, marginBottom:10 }}>บันทึกการติดต่อใหม่</div>
              <div style={{ display:"flex", gap:6, marginBottom:8 }}>
                {(Object.entries(CONTACT_ICON) as [string, LucideIcon][]).map(([k, Icon]) => (
                  <button key={k} onClick={() => setContactType(k)}
                    style={{ width:32, height:32, borderRadius:8, border:contactType===k?`2px solid ${PRIMARY}`:"1px solid #e2e8f0", background:contactType===k?"#dce5f0":"#fff", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <Icon size={15} color={contactType===k ? PRIMARY : "#9ca3af"} strokeWidth={2} />
                  </button>
                ))}
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <input className="form-input" value={contactText} onChange={e => setContactText(e.target.value)}
                  onKeyDown={e => e.key==="Enter" && addContact()}
                  placeholder="รายละเอียดการติดต่อ..."/>
                <button className="btn btn-primary btn-md" onClick={addContact}>บันทึก</button>
              </div>
            </div>

            <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
              {contacts.map((a, i) => {
                const Icon = CONTACT_ICON[a.icon] ?? FileText;
                return (
                  <div key={a.id} className="activity" style={{ borderTop:i===0?"none":undefined }}>
                    <div className="activity-icon" style={{ background:"#dce5f0", color:PRIMARY }}>
                      <Icon size={15} strokeWidth={2} />
                    </div>
                    <div className="activity-text">
                      <div className="activity-title">{a.text}</div>
                      <div className="activity-meta">{a.date}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Edit modal */}
      {showEdit && editForm && (
        <>
          <div onClick={() => setShowEdit(false)} style={{ position:"fixed", inset:0, background:"rgba(45,45,45,.45)", zIndex:200 }}/>
          <div style={{ position:"fixed", top:"50%", left:"50%", transform:"translate(-50%,-50%)", zIndex:201,
            width:440, maxWidth:"calc(100vw - 32px)", background:"#fff", borderRadius:20, border:`1px solid ${BORDER}`, boxShadow:"0 24px 80px rgba(0,0,0,.2)", overflow:"hidden" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"18px 24px", background:PRIMARY }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <Building2 size={18} color="#fff"/>
                <div style={{ fontSize:"1rem", fontWeight:800, color:"#fff" }}>แก้ไขข้อมูลลูกค้า</div>
              </div>
              <button onClick={() => setShowEdit(false)} style={{ width:32, height:32, borderRadius:9, border:"1px solid rgba(255,255,255,.2)", background:"rgba(255,255,255,.1)", color:"#fff", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}><X size={15}/></button>
            </div>
            <div style={{ padding:"22px 24px", display:"flex", flexDirection:"column", gap:12 }}>
              {([
                { key:"name" as const,     label:"ชื่อ",       ph:"ชื่อลูกค้า" },
                { key:"company" as const,  label:"บริษัท",     ph:"ชื่อบริษัท" },
                { key:"phone" as const,    label:"โทรศัพท์",   ph:"08x-xxx-xxxx" },
                { key:"email" as const,    label:"อีเมล",      ph:"email@example.com" },
                { key:"province" as const, label:"จังหวัด",    ph:"จังหวัด" },
              ]).map(f => (
                <div key={f.key}>
                  <label className="form-label">{f.label}</label>
                  <input className="form-input" value={editForm[f.key]} onChange={e => setEditForm(p => p?{...p,[f.key]:e.target.value}:null)}
                    placeholder={f.ph}/>
                </div>
              ))}
            </div>
            <div style={{ padding:"14px 24px", borderTop:`1px solid ${BORDER}`, display:"flex", gap:8, justifyContent:"flex-end", background:"#fafafa" }}>
              <button className="btn btn-secondary btn-md" onClick={() => setShowEdit(false)}>ยกเลิก</button>
              <button className="btn btn-primary btn-md" onClick={saveEdit}>บันทึก</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
