"use client";

import { useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSales } from "@/context/SalesContext";
import {
  Phone, Mail, MapPin, Users2, FileText, FilePlus, CalendarPlus,
  StickyNote, CheckCircle2, Paperclip, Upload, X, ChevronDown,
  ArrowLeft, ArrowRight, XCircle, Pencil, Trash2, type LucideIcon,
} from "lucide-react";
import {
  leadStatusLabel, quotationStatusLabel, quotationStatusColor, solutionProducts, LOST_REASONS,
  type LeadStatus, type LeadRow,
} from "@/lib/mock";
import { ActivityTimeline, type ActivityTimelineItem } from "@/components/ui/ActivityTimeline";

const PRIMARY = "#003366";
const STEEL   = "#2D2D2D";
const BORDER  = "#e5e7eb";
const SUCCESS = "#059669";
const MUTED   = "#6b7280";

// ─── Pipeline step definitions ──────────────────────────────────────────────
// Sales Journey มาตรฐาน 6 ขั้น (ตรงกับ Pipeline + กฎการขาย): Lead → Contact → Requirement → Quotation → Negotiation → Won
const PIPELINE_STEPS: { key: string; label: string; short: string; fileHint: string }[] = [
  { key: "NEW",      label: "รับผู้สนใจใหม่",     short: "ผู้สนใจใหม่",     fileHint: "ข้อมูลเบื้องต้น, แบบฟอร์ม" },
  { key: "WAITING",  label: "ติดต่อลูกค้า",        short: "ติดต่อ",         fileHint: "บันทึกการคุย, ช่องทางติดต่อ" },
  { key: "BULLET",   label: "รวบรวมความต้องการ",   short: "รวบรวมความต้องการ", fileHint: "สเปกที่ต้องการ, พื้นที่, งบประมาณ" },
  { key: "QUOTED",   label: "เสนอราคา",           short: "เสนอราคา",       fileHint: "ใบเสนอราคา PDF, เงื่อนไข" },
  { key: "FOLLOWUP", label: "ติดตามผล",           short: "ติดตามผล",       fileHint: "บันทึกการติดตาม, นัดหมาย" },
  { key: "NEGO",     label: "เจรจาต่อรอง",         short: "เจรจา",          fileHint: "ปรับราคา/เงื่อนไข, บันทึกการเจรจา" },
  { key: "PAID",     label: "ปิดการขาย",          short: "ปิดการขาย",      fileHint: "เอกสารยืนยันการสั่งซื้อ" },
];

// Sales Journey 7 ขั้น (+Lost แยกเป็นสถานะเสียโอกาส) — index ตามลำดับ PIPELINE_STEPS
const STEP_INDEX: Record<string, number> = {
  NEW: 0, WAITING: 1, BULLET: 2, QUOTED: 3, FOLLOWUP: 4, NEGO: 5, PAID: 6, CANCELLED: -1,
};

// งานมาตรฐานต่อขั้น — ความคืบหน้าคำนวณอัตโนมัติจากการติ๊ก (ไม่มี slider ปรับมือ)
const STEP_TASKS: Record<string, string[]> = {
  NEW:      ["บันทึกข้อมูลลูกค้าเข้าระบบ", "ระบุแหล่งที่มาของผู้สนใจ", "มอบหมายผู้รับผิดชอบ"],
  WAITING:  ["ติดต่อลูกค้าครั้งแรก", "แนะนำบริษัทและสินค้า", "ยืนยันช่องทางติดต่อ"],
  BULLET:   ["สำรวจความต้องการลูกค้า", "ระบุสเปก/ขนาด/งบประมาณ", "ประเมินโอกาสปิดการขาย"],
  QUOTED:   ["จัดทำใบเสนอราคา", "ส่งใบเสนอราคาให้ลูกค้า", "ยืนยันเงื่อนไข/ราคา"],
  FOLLOWUP: ["ติดตามผลใบเสนอราคา", "สอบถามข้อสงสัยลูกค้า", "นัดหมายติดตามผล"],
  NEGO:     ["เจรจาราคา/เงื่อนไข", "สรุปข้อตกลง"],
  PAID:     ["ยืนยันการสั่งซื้อ", "ปิดการขายสำเร็จ"],
};

const ACT_ICON: Record<string, LucideIcon> = {
  call: Phone, email: Mail, meeting: Users2,
  note: StickyNote, visit: MapPin, doc: FileText,
};

// แปลง type ของกิจกรรมเดิม → type ของ ActivityTimeline (call/quote/meeting/open/status/note)
const ACT_TO_TIMELINE: Record<string, string> = {
  call: "call", doc: "quote", meeting: "meeting", visit: "meeting",
  email: "open", note: "note", status: "status",
};

type ActivityEntry = { id: number; date: string; icon: string; text: string; type: string };
type MockFile = { id: string; name: string; date: string; size: string; step: string };

const INIT_ACTS: ActivityEntry[] = [
  { id: 1, date: "22 มิ.ย. 2569", icon: "call",  text: "โทรติดตามลูกค้า — ยืนยันนัดนำเสนอ", type: "call" },
  { id: 2, date: "18 มิ.ย. 2569", icon: "doc",   text: "ส่งใบเสนอราคาเบื้องต้น", type: "doc" },
  { id: 3, date: "10 มิ.ย. 2569", icon: "visit", text: "เข้าพบลูกค้าเพื่อนำเสนอสินค้า", type: "visit" },
  { id: 4, date: "2 มิ.ย. 2569",  icon: "note",  text: "บันทึกผู้สนใจใหม่เข้าระบบ", type: "note" },
];

const INIT_FILES: MockFile[] = [
  { id: "f1", name: "สรุปความต้องการลูกค้า.pdf", date: "10 มิ.ย.", size: "2.4 MB", step: "WAITING" },
  { id: "f2", name: "ประมาณการราคา-v2.xlsx",     date: "22 มิ.ย.", size: "340 KB", step: "BULLET"  },
  { id: "f3", name: "ใบเสนอราคา-ร่าง-v1.pdf",    date: "18 มิ.ย.", size: "1.8 MB", step: "BULLET"  },
];

// ─── Edit form options ──────────────────────────────────────────────────────
const EDIT_STATUSES: LeadStatus[] = ["NEW","WAITING","BULLET","QUOTED","FOLLOWUP","NEGO","PAID","CANCELLED"];
const EDIT_PROVINCES = ["กรุงเทพฯ","เชียงใหม่","ระยอง","เชียงราย","นนทบุรี","สมุทรสาคร","นครสวรรค์","ราชบุรี","ขอนแก่น","อื่นๆ"];
// แม่แบบ = แหล่งเดียวกับหน้าอื่นทั้งระบบ (solutionProducts)
const EDIT_PRODUCTS  = solutionProducts.map(p => p.name);
const EDIT_SOURCES   = ["Facebook","เว็บไซต์","LINE","Walk-in","แนะนำต่อ","งานแสดงสินค้า","อื่นๆ"];

// ─── EDIT LEAD MODAL ──────────────────────────────────────────────────────────
// แก้ไขข้อมูลผู้สนใจรายนี้ → อัปเดต local state ที่แชร์ผ่าน SalesContext
function LeadEditModal({ initial, onClose, onSave }: {
  initial: LeadRow; onClose: () => void; onSave: (l: LeadRow) => void;
}) {
  const [form, setForm] = useState({
    company: initial.company, contact: initial.contact,
    phone: initial.phone ?? "", email: initial.email ?? "",
    province: initial.province, product: initial.product,
    value: initial.value, status: initial.status,
    assigned: initial.assigned, source: initial.source ?? "", note: initial.note ?? "",
  });
  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) { setForm(p => ({ ...p, [k]: v })); }
  function submit() {
    if (!form.company.trim() || !form.contact.trim()) return;
    onSave({
      ...initial,
      name: form.company, company: form.company, contact: form.contact,
      phone: form.phone, email: form.email, province: form.province,
      product: form.product, category: form.product, value: form.value,
      status: form.status, assigned: form.assigned, source: form.source, note: form.note,
    });
    onClose();
  }
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(45,45,45,.45)", zIndex: 100 }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 101,
        background: "#fff", borderRadius: 20, border: `1px solid ${BORDER}`, boxShadow: "0 24px 80px rgba(0,0,0,.2)",
        width: "100%", maxWidth: 560, overflow: "hidden",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", background: PRIMARY }}>
          <div>
            <div style={{ fontSize: "1rem", fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", gap: 8 }}>
              <Pencil size={17} strokeWidth={2} /> แก้ไขผู้สนใจ
            </div>
            <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,.65)", marginTop: 3 }}>{initial.id}</div>
          </div>
          <button onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: 9, border: "1px solid rgba(255,255,255,.2)", background: "rgba(255,255,255,.1)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={15} /></button>
        </div>
        <div style={{ padding: "22px 24px", overflowY: "auto", maxHeight: "68vh", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={{ gridColumn: "1/-1" }}>
            <label className="form-label">บริษัท *</label>
            <input className="form-input" value={form.company} onChange={e => set("company", e.target.value)} autoFocus />
          </div>
          <div>
            <label className="form-label">ผู้ติดต่อ *</label>
            <input className="form-input" value={form.contact} onChange={e => set("contact", e.target.value)} />
          </div>
          <div>
            <label className="form-label">ผู้รับผิดชอบ</label>
            <input className="form-input" value={form.assigned} onChange={e => set("assigned", e.target.value)} />
          </div>
          <div>
            <label className="form-label">โทรศัพท์</label>
            <input className="form-input" value={form.phone} onChange={e => set("phone", e.target.value)} />
          </div>
          <div>
            <label className="form-label">อีเมล</label>
            <input className="form-input" type="email" value={form.email} onChange={e => set("email", e.target.value)} />
          </div>
          <div>
            <label className="form-label">จังหวัด</label>
            <select className="form-select" value={form.province} onChange={e => set("province", e.target.value)}>
              {EDIT_PROVINCES.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">ประเภทงาน</label>
            <select className="form-select" value={form.product} onChange={e => set("product", e.target.value)}>
              {EDIT_PRODUCTS.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">มูลค่าประเมิน</label>
            <input className="form-input" value={form.value} onChange={e => set("value", e.target.value)} placeholder="เช่น ฿1.2M" />
          </div>
          <div>
            <label className="form-label">แหล่งที่มา</label>
            <select className="form-select" value={form.source} onChange={e => set("source", e.target.value)}>
              <option value="">—</option>
              {EDIT_SOURCES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">สถานะ</label>
            <select className="form-select" value={form.status} onChange={e => set("status", e.target.value as LeadStatus)}>
              {EDIT_STATUSES.map(s => <option key={s} value={s}>{leadStatusLabel[s]}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <label className="form-label">หมายเหตุ</label>
            <textarea className="form-textarea" value={form.note} onChange={e => set("note", e.target.value)} rows={3} style={{ resize: "vertical" }} />
          </div>
        </div>
        <div style={{ padding: "16px 24px", borderTop: `1px solid ${BORDER}`, display: "flex", gap: 8, justifyContent: "flex-end", background: "#fafafa" }}>
          <button className="btn btn-secondary btn-md" onClick={onClose}>ยกเลิก</button>
          <button className="btn btn-primary btn-md" onClick={submit}>
            <CheckCircle2 size={14} strokeWidth={2.5} /> บันทึกการแก้ไข
          </button>
        </div>
      </div>
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 0", borderBottom: "1px solid #f0f4f8" }}>
      <span style={{ fontSize: "0.73rem", color: MUTED, fontWeight: 600, minWidth: 110 }}>{label}</span>
      <span style={{ fontSize: "0.82rem", color: STEEL, fontWeight: 500 }}>{value}</span>
    </div>
  );
}

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const {
    leads: allLeads, customers, quotations,
    updateLeadStatus, updateLead, deleteLead, openDealFromLead,
    addQuotation, convertLeadToCustomer,
  } = useSales();
  const numId  = Number(params.id);
  const lead   = allLeads.find(l => l.numId === numId);

  const [showEditModal,    setShowEditModal]    = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [status,         setStatus]         = useState<LeadStatus>(lead?.status ?? "NEW");
  const [showStatusDrop, setShowStatusDrop] = useState(false);
  const [activities,     setActivities]     = useState<ActivityEntry[]>(INIT_ACTS);
  const [actText,        setActText]        = useState("");
  const [actType,        setActType]        = useState("note");
  const [phone,          setPhone]          = useState(lead?.phone ?? "089-123-4567");
  const [email,          setEmail]          = useState(lead?.email ?? "customer@mail.com");
  const [editPhone,      setEditPhone]      = useState(false);
  const [editEmail,      setEditEmail]      = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [qName,          setQName]          = useState("");
  const [qValue,         setQValue]         = useState("");
  const [qProduct,       setQProduct]       = useState("");
  const [qProvince,      setQProvince]      = useState("");
  const [qNotes,         setQNotes]         = useState("");
  const [qSaved,         setQSaved]         = useState(false);
  // เหตุผลที่ปิดการขายไม่ได้ (แสดง/บันทึกเมื่อเลือกสถานะ "ไม่ได้งาน")
  const [lostPrompt,     setLostPrompt]     = useState(false);
  const [lostReasonSel,  setLostReasonSel]  = useState<string>(lead?.lostReason ?? "");

  // Job Card state
  const [activeStep,      setActiveStep]     = useState<string>(
    lead?.status === "CANCELLED" || lead?.status === "PAID" ? "QUOTED" : (lead?.status ?? "NEW")
  );
  // ติ๊กงานต่อขั้น — seed: ขั้นก่อนหน้าสถานะปัจจุบัน = ติ๊กครบ, ขั้นปัจจุบัน/ถัดไป = ยังไม่ติ๊ก
  const [taskChecks, setTaskChecks] = useState<Record<string, boolean[]>>(() => {
    const cur = STEP_INDEX[lead?.status ?? "NEW"] ?? 0;
    const out: Record<string, boolean[]> = {};
    PIPELINE_STEPS.forEach((s, idx) => { out[s.key] = (STEP_TASKS[s.key] ?? []).map(() => idx < cur); });
    return out;
  });
  const [files,           setFiles]          = useState<MockFile[]>(INIT_FILES);
  const [uploadSuccess,   setUploadSuccess]  = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!lead) {
    return (
      <div className="erp" style={{ padding: 40, textAlign: "center" }}>
        <p style={{ color: MUTED }}>ไม่พบข้อมูลผู้สนใจ</p>
        <Link href="/leads" className="btn btn-secondary btn-sm" style={{ marginTop: 12 }}>
          <ArrowLeft size={13}/> กลับ
        </Link>
      </div>
    );
  }

  const customer          = lead.customerId ? customers.find(c => c.id === lead.customerId) : null;
  const relatedQuotations = lead.customerId ? quotations.filter(q => q.customerId === lead.customerId) : [];
  const currentStepIdx    = STEP_INDEX[status];
  const activeStepDef     = PIPELINE_STEPS.find(s => s.key === activeStep) ?? PIPELINE_STEPS[0];
  const stepFiles         = files.filter(f => f.step === activeStep);

  // ความคืบหน้าขั้นนี้ = (ติ๊กเสร็จ ÷ งานทั้งหมด) × 100 — คำนวณอัตโนมัติ
  const activeTasks       = STEP_TASKS[activeStep] ?? [];
  const activeChecks      = taskChecks[activeStep] ?? [];
  const stepDone          = activeChecks.filter(Boolean).length;
  const stepPct           = activeTasks.length ? Math.round((stepDone / activeTasks.length) * 100) : 0;
  function toggleStepTask(i: number) {
    setTaskChecks(p => ({ ...p, [activeStep]: (p[activeStep] ?? []).map((v, idx) => idx === i ? !v : v) }));
  }

  function addActivity() {
    if (!actText.trim()) return;
    setActivities(prev => [{
      id: Date.now(), date: "26 มิ.ย. 2569",
      icon: actType, text: actText.trim(), type: actType,
    }, ...prev]);
    setActText("");
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFiles(prev => [...prev, {
      id: `f-${Date.now()}`, name: f.name,
      date: "26 มิ.ย.",
      size: f.size > 1_000_000 ? `${(f.size / 1_000_000).toFixed(1)} MB` : `${Math.round(f.size / 1000)} KB`,
      step: activeStep,
    }]);
    setUploadSuccess(true);
    setTimeout(() => setUploadSuccess(false), 3000);
    e.target.value = "";
  }

  return (
    <div className="erp" style={{ maxWidth: 1100 }}>

      {/* Back + Actions */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <Link href="/leads" className="btn btn-ghost btn-sm" style={{ paddingLeft: 0 }}>
          <ArrowLeft size={14}/> กลับ
        </Link>
        <div style={{ display: "flex", gap: 8 }}>
          <a href="/calendar" className="btn btn-secondary btn-md">
            <CalendarPlus size={14} strokeWidth={2} /> เพิ่มนัดหมาย
          </a>
          <button className="btn btn-secondary btn-md" onClick={() => setShowEditModal(true)}>
            <Pencil size={14} strokeWidth={2} /> แก้ไข
          </button>
          <button className="btn btn-secondary btn-md" style={{ borderColor: "#fca5a5", color: "#dc2626" }}
            onClick={() => setShowDeleteConfirm(true)}>
            <Trash2 size={14} strokeWidth={2} /> ลบ
          </button>
          {lead.status !== "PAID" && lead.status !== "CANCELLED" && (
            <button className="btn btn-secondary btn-md" style={{ borderColor: "#003366", color: "#003366" }}
              onClick={() => { openDealFromLead(lead); router.push("/pipeline"); }}>
              <ArrowRight size={14} strokeWidth={2} /> เปิดโอกาสการขาย
            </button>
          )}
          <button className="btn btn-primary btn-md"
            onClick={() => { setQName(lead.name); setQValue(lead.value); setQProduct(lead.product); setQProvince(lead.province); setQNotes(""); setQSaved(false); setShowQuoteModal(true); }}>
            <FilePlus size={14} strokeWidth={2} /> สร้างใบเสนอราคา
          </button>
        </div>
      </div>

      {/* ─── Header Card ──────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ padding: "20px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <span className="badge" style={{ color: MUTED, background: "#f0f0f5" }}>{lead.id}</span>
              <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: STEEL, margin: 0 }}>{lead.name}</h2>

              {/* Status badge + dropdown */}
              <div style={{ position: "relative" }}>
                <button onClick={() => setShowStatusDrop(p => !p)} className="badge" style={{
                  cursor: "pointer", border: "none", padding: "4px 10px",
                  background: status === "PAID" ? "#d1fae5" : status === "CANCELLED" ? "#fee2e2" : "#dce5f0",
                  color:      status === "PAID" ? SUCCESS   : status === "CANCELLED" ? "#dc2626" : PRIMARY,
                }}>
                  {leadStatusLabel[status]}{status === "CANCELLED" && lead.lostReason ? ` · ${lead.lostReason}` : ""} <ChevronDown size={12} />
                </button>
                {showStatusDrop && (
                  <>
                    <div onClick={() => setShowStatusDrop(false)} style={{ position: "fixed", inset: 0, zIndex: 9 }} />
                    <div style={{
                      position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 10,
                      background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12,
                      boxShadow: "0 8px 24px rgba(0,0,0,.12)", minWidth: 190, overflow: "hidden",
                    }}>
                      {(["NEW","WAITING","BULLET","QUOTED","FOLLOWUP","NEGO","PAID","CANCELLED"] as LeadStatus[]).map(s => (
                        <button key={s} onClick={() => {
                          setShowStatusDrop(false);
                          // เลือก "ไม่ได้งาน" → เปิดหน้าต่างเลือกเหตุผลก่อนบันทึก
                          if (s === "CANCELLED") { setLostReasonSel(lead?.lostReason ?? ""); setLostPrompt(true); return; }
                          setStatus(s);
                          if (lead) { updateLeadStatus(lead.id, s); updateLead({ ...lead, status: s, lostReason: undefined }); }
                          if (s !== "PAID") setActiveStep(s);
                        }} style={{
                          display: "flex", alignItems: "center", gap: 8, width: "100%",
                          padding: "9px 14px", border: "none",
                          background: s === status ? "#f8f9fb" : "transparent",
                          cursor: "pointer", textAlign: "left",
                        }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: s === "PAID" ? SUCCESS : s === "CANCELLED" ? "#dc2626" : PRIMARY }} />
                          <span style={{ fontSize: "0.78rem", color: s === status ? PRIMARY : STEEL, fontWeight: s === status ? 700 : 400 }}>
                            {leadStatusLabel[s]}
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "0.65rem", color: MUTED, fontWeight: 600 }}>มูลค่าประมาณการ</div>
              <div style={{ fontSize: "1.35rem", fontWeight: 800, color: PRIMARY }}>{lead.value}</div>
            </div>
          </div>

          {/* Sub info row */}
          <div style={{ display: "flex", gap: 24, marginTop: 14, paddingTop: 14, borderTop: "1px solid #f0f4f8", flexWrap: "wrap" }}>
            {[
              { label: "ประเภทงาน", val: lead.product },
              { label: "จังหวัด",   val: lead.province },
              { label: "แหล่งที่มา", val: lead.source ?? "—" },
              { label: "ผู้รับผิดชอบ", val: lead.assigned },
            ].map(r => (
              <span key={r.label} style={{ fontSize: "0.75rem", color: MUTED }}>
                <span style={{ fontWeight: 700, color: STEEL }}>{r.label}:</span> {r.val}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ─── JOB CARD TIMELINE ───────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 16, overflow: "hidden" }}>

        {/* Timeline strip */}
        <div style={{ padding: "20px 28px 0", background: "#fafbfc", borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: "0.62rem", fontWeight: 800, color: MUTED, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 18 }}>
            การ์ดงาน · ขั้นตอนการขาย
          </div>

          <div style={{ display: "flex", alignItems: "flex-start", paddingBottom: 20 }}>
            {PIPELINE_STEPS.map((step, idx) => {
              const done    = status !== "CANCELLED" ? currentStepIdx > idx : false;
              const isCurr  = step.key === status && status !== "CANCELLED" && status !== "PAID";
              const isPaid  = status === "PAID";
              const filled  = done || (isPaid) || (isCurr);
              const isActive = step.key === activeStep;

              return (
                <div key={step.key} style={{ display: "flex", alignItems: "flex-start", flex: idx < 5 ? 1 : 0 }}>
                  {/* Step node */}
                  <div
                    onClick={() => setActiveStep(step.key)}
                    style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: "pointer", minWidth: 72 }}
                  >
                    {/* Circle */}
                    <div style={{
                      width: 38, height: 38, borderRadius: "50%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 800, fontSize: "0.82rem",
                      background: filled ? PRIMARY : "#f3f4f6",
                      color: filled ? "#fff" : "#9ca3af",
                      outline: isActive ? `3px solid rgba(0,51,102,0.25)` : "none",
                      outlineOffset: 2,
                      boxShadow: isCurr ? "0 0 0 6px rgba(0,51,102,.08)" : "none",
                      transition: "all .2s",
                      flexShrink: 0,
                    }}>
                      {done || isPaid
                        ? <CheckCircle2 size={19} strokeWidth={2.5} />
                        : idx + 1}
                    </div>

                    {/* Label */}
                    <span style={{
                      fontSize: "0.68rem",
                      fontWeight: isActive ? 800 : done || isCurr ? 700 : 500,
                      color: isActive || done || isCurr ? PRIMARY : MUTED,
                      textAlign: "center", whiteSpace: "nowrap",
                    }}>
                      {step.short}
                    </span>

                    {/* Sub-status */}
                    {isCurr && (
                      <span style={{ fontSize: "0.6rem", color: "#d97706", fontWeight: 700, marginTop: -2 }}>
                        กำลังดำเนินการ
                      </span>
                    )}
                    {done && (
                      <span style={{ fontSize: "0.6rem", color: SUCCESS, fontWeight: 600, marginTop: -2 }}>
                        เสร็จแล้ว
                      </span>
                    )}
                    {isPaid && (
                      <span style={{ fontSize: "0.6rem", color: SUCCESS, fontWeight: 600, marginTop: -2, display: "inline-flex", alignItems: "center", gap: 3 }}>
                        {idx < 5 ? "เสร็จแล้ว" : <>ปิดการขาย <CheckCircle2 size={11} strokeWidth={2.5} /></>}
                      </span>
                    )}
                  </div>

                  {/* Connector */}
                  {idx < 5 && (
                    <div style={{
                      flex: 1, height: 3, borderRadius: 99, marginTop: 17,
                      background: done || isPaid ? PRIMARY : "#e5e7eb",
                      transition: "background .3s",
                    }} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Cancelled badge */}
          {status === "CANCELLED" && (
            <div style={{ paddingBottom: 14 }}>
              <span className="badge" style={{ background: "#fee2e2", color: "#dc2626", padding: "4px 12px" }}>
                <XCircle size={12} strokeWidth={2.5} /> เสียโอกาสการขายแล้ว — ผู้สนใจรายนี้ถูกปิดโดยไม่ได้ขาย
              </span>
            </div>
          )}
        </div>

        {/* Active Step Detail */}
        <div style={{ padding: "20px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div style={{
              width: 30, height: 30, borderRadius: "50%", background: PRIMARY, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "0.75rem", fontWeight: 800, color: "#fff",
            }}>
              {PIPELINE_STEPS.findIndex(s => s.key === activeStep) + 1}
            </div>
            <div>
              <div style={{ fontSize: "0.92rem", fontWeight: 800, color: STEEL }}>{activeStepDef.label}</div>
              <div style={{ fontSize: "0.68rem", color: MUTED }}>เอกสารที่ควรมี: {activeStepDef.fileHint}</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>

            {/* Progress panel — task-based (ติ๊กงาน → % อัตโนมัติ) */}
            <div style={{ background: "#f8f9fb", borderRadius: 14, padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, color: MUTED }}>
                  ความคืบหน้าขั้นตอนนี้ <span style={{ fontWeight: 500, color: "#9ca3af" }}>({stepDone}/{activeTasks.length} งาน)</span>
                </div>
                <span style={{ fontSize: "1.2rem", fontWeight: 900, color: stepPct === 100 ? SUCCESS : PRIMARY }}>{stepPct}%</span>
              </div>
              <div style={{ height: 8, background: "var(--muted)", borderRadius: 99, overflow: "hidden", marginBottom: 12 }}>
                <div className="top5-bar" style={{ height: "100%", borderRadius: 99, width: `${stepPct}%`, background: stepPct === 100 ? SUCCESS : PRIMARY }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {activeTasks.map((t, i) => {
                  const done = activeChecks[i];
                  return (
                    <button key={i} onClick={() => toggleStepTask(i)}
                      style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 10px", borderRadius: 9,
                        border: "1px solid #eef1f5", background: done ? "#f0f7f0" : "#fff", cursor: "pointer", textAlign: "left", width: "100%" }}>
                      <span style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                        border: `2px solid ${done ? SUCCESS : "#d1d5db"}`, background: done ? SUCCESS : "#fff",
                        display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {done && <CheckCircle2 size={12} color="#fff" strokeWidth={3} />}
                      </span>
                      <span style={{ fontSize: "0.78rem", color: done ? MUTED : STEEL, textDecoration: done ? "line-through" : "none" }}>{t}</span>
                    </button>
                  );
                })}
              </div>
              {stepPct === 100 ? (
                <div style={{ fontSize: "0.7rem", color: SUCCESS, fontWeight: 700, marginTop: 10, display: "flex", alignItems: "center", gap: 4 }}>
                  <CheckCircle2 size={13} strokeWidth={2.5} /> ขั้นตอนนี้เสร็จสมบูรณ์
                </div>
              ) : (
                <div style={{ fontSize: "0.68rem", color: MUTED, marginTop: 10 }}>
                  ติ๊กงานให้เสร็จ — ระบบคำนวณ % อัตโนมัติ
                </div>
              )}
            </div>

            {/* Files panel */}
            <div style={{ background: "#f8f9fb", borderRadius: 14, padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, color: MUTED }}>
                  ไฟล์แนบ ({stepFiles.length})
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => fileInputRef.current?.click()}>
                  <Upload size={11} strokeWidth={2.5} /> แนบไฟล์
                </button>
                <input ref={fileInputRef} type="file" style={{ display: "none" }} onChange={handleFileUpload} />
              </div>

              {uploadSuccess && (
                <div style={{ fontSize: "0.7rem", color: SUCCESS, fontWeight: 700, background: "#d1fae5", borderRadius: 8, padding: "5px 10px", marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
                  <CheckCircle2 size={12} strokeWidth={2.5} /> อัปโหลดไฟล์เรียบร้อยแล้ว
                </div>
              )}

              {stepFiles.length === 0 ? (
                <div style={{
                  textAlign: "center", padding: "16px 8px",
                  border: "1.5px dashed #d1d5db", borderRadius: 10, color: MUTED,
                }}>
                  <Paperclip size={18} color="#d1d5db" style={{ display: "block", margin: "0 auto 6px" }} />
                  <span style={{ fontSize: "0.7rem" }}>ยังไม่มีไฟล์แนบในขั้นตอนนี้</span>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 120, overflowY: "auto" }}>
                  {stepFiles.map(f => (
                    <div key={f.id} style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "6px 10px", background: "#fff",
                      borderRadius: 9, border: `1px solid ${BORDER}`,
                    }}>
                      <FileText size={13} color={PRIMARY} strokeWidth={2} style={{ flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "0.72rem", fontWeight: 600, color: STEEL, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {f.name}
                        </div>
                        <div style={{ fontSize: "0.6rem", color: MUTED }}>{f.date} · {f.size}</div>
                      </div>
                      <button
                        onClick={() => setFiles(prev => prev.filter(x => x.id !== f.id))}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#d1d5db", padding: 2, lineHeight: 0 }}>
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Info + Activity ─────────────────────────────────────── */}
      <div className="row-2-eq">

        {/* Left: Info */}
        <div className="card">
          <div className="card-header">
            <div className="card-title" style={{ fontSize: "0.92rem" }}>ข้อมูลผู้สนใจ</div>
          </div>
          <div className="card-body">
          <InfoRow label="จังหวัด"    value={lead.province} />
          <InfoRow label="ประเภทงาน" value={
            <span className="badge" style={{ background: "#dce5f0", color: PRIMARY }}>
              {lead.product}
            </span>
          } />
          <InfoRow label="มูลค่า"    value={<span style={{ color: PRIMARY, fontWeight: 700 }}>{lead.value}</span>} />
          <InfoRow label="หมายเหตุ"  value={lead.note ?? "—"} />

          {/* Editable phone */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid #f0f4f8" }}>
            <span style={{ fontSize: "0.73rem", color: MUTED, fontWeight: 600, minWidth: 110 }}>โทรศัพท์</span>
            {editPhone ? (
              <div style={{ display: "flex", gap: 6, flex: 1 }}>
                <input className="form-input" value={phone} onChange={e => setPhone(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && setEditPhone(false)}
                  style={{ padding: "3px 8px" }} />
                <button className="btn btn-primary btn-sm" onClick={() => setEditPhone(false)}>
                  บันทึก
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                <span style={{ fontSize: "0.82rem", color: STEEL, fontWeight: 500 }}>{phone}</span>
                <button onClick={() => setEditPhone(true)} style={{ fontSize: "0.67rem", color: "#9ca3af", background: "none", border: "none", cursor: "pointer" }}>แก้ไข</button>
                <a href={`tel:${phone}`} className="badge" style={{ color: PRIMARY, background: "#dce5f0", textDecoration: "none" }}>
                  <Phone size={11} strokeWidth={2.5} /> โทร
                </a>
              </div>
            )}
          </div>

          {/* Editable email */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid #f0f4f8" }}>
            <span style={{ fontSize: "0.73rem", color: MUTED, fontWeight: 600, minWidth: 110 }}>อีเมล</span>
            {editEmail ? (
              <div style={{ display: "flex", gap: 6, flex: 1 }}>
                <input className="form-input" value={email} onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && setEditEmail(false)}
                  style={{ padding: "3px 8px" }} />
                <button className="btn btn-primary btn-sm" onClick={() => setEditEmail(false)}>
                  บันทึก
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                <span style={{ fontSize: "0.82rem", color: STEEL, fontWeight: 500 }}>{email}</span>
                <button onClick={() => setEditEmail(true)} style={{ fontSize: "0.67rem", color: "#9ca3af", background: "none", border: "none", cursor: "pointer" }}>แก้ไข</button>
              </div>
            )}
          </div>

          {customer && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #e5e7eb" }}>
              <Link href={`/customers/${customer.id}`} className="btn btn-primary btn-md">
                ดูโปรไฟล์ลูกค้า <ArrowRight size={14} />
              </Link>
            </div>
          )}
          </div>
        </div>

        {/* Right: Activity log */}
        <div className="card">
          <div className="card-header">
            <div className="card-title" style={{ fontSize: "0.92rem" }}>ประวัติกิจกรรม</div>
          </div>
          <div className="card-body">

          <div style={{ marginBottom: 14, padding: "12px 14px", background: "#f8f9fb", borderRadius: 12, border: "1px solid #f0f0f5" }}>
            <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
              {(Object.entries(ACT_ICON) as [string, LucideIcon][]).map(([k, Icon]) => (
                <button key={k} onClick={() => setActType(k)} style={{
                  width: 30, height: 30, borderRadius: 8,
                  border: actType === k ? `2px solid ${PRIMARY}` : "1px solid #e2e8f0",
                  background: actType === k ? "#dce5f0" : "#fff",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Icon size={14} color={actType === k ? PRIMARY : "#9ca3af"} strokeWidth={2} />
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="form-input" value={actText} onChange={e => setActText(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addActivity()}
                placeholder="บันทึกกิจกรรม..." />
              <button className="btn btn-primary btn-md" onClick={addActivity}>
                บันทึก
              </button>
            </div>
          </div>

          <div style={{ maxHeight: 320, overflowY: "auto" }}>
            <ActivityTimeline
              items={activities.map<ActivityTimelineItem>(a => ({
                id: a.id,
                type: ACT_TO_TIMELINE[a.type] ?? "note",
                text: a.text,
                time: a.date,
              }))}
            />
          </div>
          </div>
        </div>
      </div>

      {/* ─── Related Quotations ───────────────────────────────────── */}
      {relatedQuotations.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <div className="card-title" style={{ fontSize: "0.92rem" }}>ใบเสนอราคาที่เกี่ยวข้อง</div>
          </div>
          <div className="table-wrap">
            <table>
              <colgroup>
                <col style={{ width: "14%" }} />
                <col style={{ width: "42%" }} />
                <col style={{ width: "16%" }} />
                <col style={{ width: "16%" }} />
                <col style={{ width: "12%" }} />
              </colgroup>
              <thead>
                <tr>
                  {["เลขที่","โอกาสการขาย","มูลค่า","สถานะ","วันที่"].map(h => (
                    <th key={h} className={h==="มูลค่า"?"num":undefined}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {relatedQuotations.map(q => {
                  const qc = quotationStatusColor[q.status];
                  return (
                    <tr key={q.id} className="clickable" onClick={() => router.push("/quotations")}>
                      <td style={{ fontWeight: 700 }}>{q.id}</td>
                      <td style={{ color: MUTED }}>{q.project}</td>
                      <td className="num" style={{ fontWeight: 700 }}>{q.total}</td>
                      <td>
                        <span className="badge" style={{ background: qc.bg, color: qc.text }}>
                          {quotationStatusLabel[q.status]}
                        </span>
                      </td>
                      <td style={{ color: MUTED }}>{q.date}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}


      {/* ─── Edit Lead Modal ──────────────────────────────────────── */}
      {showEditModal && (
        <LeadEditModal
          initial={lead}
          onClose={() => setShowEditModal(false)}
          onSave={(l) => {
            updateLead(l);
            // sync local display state ให้สะท้อนทันที
            setStatus(l.status);
            setPhone(l.phone ?? "");
            setEmail(l.email ?? "");
          }}
        />
      )}

      {/* ─── Delete Confirm ───────────────────────────────────────── */}
      {showDeleteConfirm && (
        <>
          <div onClick={() => setShowDeleteConfirm(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(45,45,45,.45)", zIndex: 100 }} />
          <div style={{
            position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 101,
            background: "#fff", borderRadius: 16, border: `1px solid ${BORDER}`, boxShadow: "0 24px 80px rgba(0,0,0,.2)",
            width: "100%", maxWidth: 380, padding: 24,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ width: 38, height: 38, borderRadius: "50%", background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Trash2 size={17} color="#dc2626" />
              </span>
              <div style={{ fontSize: "1rem", fontWeight: 800, color: STEEL }}>ลบผู้สนใจ</div>
            </div>
            <p style={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.6, margin: "0 0 20px" }}>
              ต้องการลบ <strong style={{ color: STEEL }}>{lead.company}</strong> ({lead.id}) หรือไม่? การลบไม่สามารถย้อนกลับได้
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-secondary btn-md" onClick={() => setShowDeleteConfirm(false)}>ยกเลิก</button>
              <button className="btn btn-md" style={{ background: "#dc2626", color: "#fff", border: "none" }}
                onClick={() => { deleteLead(lead.id); router.push("/leads"); }}>
                <Trash2 size={13} /> ลบ
              </button>
            </div>
          </div>
        </>
      )}

      {/* ─── Lost Reason Modal (เหตุผลที่ปิดการขายไม่ได้) ───────────── */}
      {lostPrompt && (
        <div onClick={() => setLostPrompt(false)} style={{ position: "fixed", inset: 0, background: "rgba(45,45,45,.45)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 400, background: "#fff", borderRadius: 14, overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,.22)" }}>
            <div style={{ background: "#dc2626", color: "#fff", padding: "16px 20px", fontSize: "1rem", fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
              <XCircle size={18} /> ปิดการขายไม่สำเร็จ
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: "0.8rem", color: MUTED }}>ระบุเหตุผลที่ปิดการขายไม่ได้ เพื่อใช้วิเคราะห์ในรายงาน</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {LOST_REASONS.map(r => (
                  <button key={r} onClick={() => setLostReasonSel(r)}
                    style={{ padding: "9px 10px", borderRadius: 8, cursor: "pointer", fontSize: "0.8rem", fontFamily: "inherit", textAlign: "left",
                      border: `1px solid ${lostReasonSel === r ? "#dc2626" : "#e5e7eb"}`,
                      background: lostReasonSel === r ? "#fee2e2" : "#fff",
                      color: lostReasonSel === r ? "#dc2626" : STEEL, fontWeight: lostReasonSel === r ? 700 : 400 }}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ padding: "14px 20px", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn btn-secondary btn-md" onClick={() => setLostPrompt(false)}>ยกเลิก</button>
              <button className="btn btn-md" disabled={!lostReasonSel}
                style={{ background: lostReasonSel ? "#dc2626" : "#f3f4f6", color: lostReasonSel ? "#fff" : "#9ca3af", cursor: lostReasonSel ? "pointer" : "not-allowed" }}
                onClick={() => {
                  if (!lostReasonSel || !lead) return;
                  setStatus("CANCELLED");
                  updateLeadStatus(lead.id, "CANCELLED");
                  updateLead({ ...lead, status: "CANCELLED", lostReason: lostReasonSel });
                  setActivities(prev => [{ id: Date.now(), date: "26 มิ.ย. 2569", icon: "note", text: `ปิดการขายไม่สำเร็จ — เหตุผล: ${lostReasonSel}`, type: "note" }, ...prev]);
                  setLostPrompt(false);
                }}>
                ยืนยันปิดการขาย
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Create Quotation Modal ───────────────────────────────── */}
      {showQuoteModal && (
        <>
          <div onClick={() => setShowQuoteModal(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(45,45,45,.45)", zIndex: 100 }} />
          <div style={{
            position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 101,
            background: "#fff", borderRadius: 20, border: `1px solid ${BORDER}`, boxShadow: "0 24px 80px rgba(0,0,0,.2)",
            width: "100%", maxWidth: 520, overflow: "hidden",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", background: PRIMARY }}>
              <div>
                <div style={{ fontSize: "1rem", fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", gap: 8 }}>
                  <FilePlus size={18} strokeWidth={2} /> สร้างใบเสนอราคา
                </div>
                <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,.65)", marginTop: 3 }}>จากผู้สนใจ {lead.id} · {lead.company}</div>
              </div>
              <button onClick={() => setShowQuoteModal(false)}
                style={{ width: 32, height: 32, borderRadius: 9, border: "1px solid rgba(255,255,255,.2)", background: "rgba(255,255,255,.1)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={15} /></button>
            </div>

            {qSaved ? (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <div style={{ marginBottom: 12, display: "flex", justifyContent: "center" }}><CheckCircle2 size={48} color={SUCCESS} strokeWidth={1.5} /></div>
                <div style={{ fontSize: "1rem", fontWeight: 700, color: SUCCESS, marginBottom: 6 }}>สร้างใบเสนอราคาสำเร็จ</div>
                <div style={{ fontSize: "0.78rem", color: MUTED, marginBottom: 20 }}>ระบบบันทึก {qName} เข้าหน้าใบเสนอราคาเรียบร้อยแล้ว</div>
                <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                  <button className="btn btn-secondary btn-md" onClick={() => setShowQuoteModal(false)}>ปิด</button>
                  <button className="btn btn-primary btn-md" onClick={() => router.push("/quotations")}>
                    <ArrowRight size={14} /> ไปที่ใบเสนอราคา
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label className="form-label">ชื่อโอกาสการขาย *</label>
                  <input className="form-input" value={qName} onChange={e => setQName(e.target.value)} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label className="form-label">แม่แบบที่สนใจ</label>
                    <select className="form-select" value={qProduct} onChange={e => setQProduct(e.target.value)}>
                      <option value="">เลือกแม่แบบ</option>
                      {!solutionProducts.some(p => p.name === qProduct) && qProduct && <option value={qProduct}>{qProduct}</option>}
                      {solutionProducts.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">จังหวัด</label>
                    <input className="form-input" value={qProvince} onChange={e => setQProvince(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="form-label">มูลค่าโอกาสการขาย (ประมาณการ)</label>
                  <input className="form-input" value={qValue} onChange={e => setQValue(e.target.value)} placeholder="฿0" />
                </div>
                <div>
                  <label className="form-label">หมายเหตุ</label>
                  <textarea className="form-textarea" value={qNotes} onChange={e => setQNotes(e.target.value)} rows={3}
                    placeholder="รายละเอียดเพิ่มเติม เช่น ขนาดอาคาร, วัสดุ, เงื่อนไขพิเศษ..."
                    style={{ resize: "vertical" }} />
                </div>
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                  <button className="btn btn-secondary btn-md" onClick={() => setShowQuoteModal(false)}>
                    ยกเลิก
                  </button>
                  <button className="btn btn-primary btn-md" onClick={() => {
                    if (!qName.trim()) return;
                    // แปลงผู้สนใจเป็นลูกค้า (หรือหาลูกค้าเดิม) แล้วสร้างใบเสนอราคาจริงเข้า SalesContext
                    const parseBaht = (s: string) => {
                      const n = parseFloat(s.replace(/[฿,\s]/g, "")) || 0;
                      if (/B/i.test(s)) return n * 1e9;
                      if (/M/i.test(s)) return n * 1e6;
                      if (/K/i.test(s)) return n * 1e3;
                      return n;
                    };
                    const cust = convertLeadToCustomer(lead);
                    const est = parseBaht(qValue);
                    const nums = quotations.map(q => parseInt(q.id.split("-")[2] ?? "") || 0);
                    const newId = `Q-2026-${String(Math.max(...nums, 100) + 1).padStart(4, "0")}`;
                    addQuotation({
                      id: newId, customer: cust.company,
                      project: qName.trim(),
                      total: "฿" + est.toLocaleString("th-TH"), totalValue: est, materialCost: est,
                      province: qProvince || lead.province,
                      buildingType: qProduct || lead.product,
                      area: 0, status: "draft", date: "2026-06-30", items: 0,
                      customerId: cust.id, projectId: 0, revision: "V1", expiry: "",
                    });
                    setActivities(prev => [{
                      id: Date.now(), date: "26 มิ.ย. 2569",
                      icon: "doc", text: `สร้างใบเสนอราคา ${newId} "${qName}" มูลค่า ${qValue}`, type: "doc",
                    }, ...prev]);
                    setQSaved(true);
                  }}>
                    <CheckCircle2 size={14} strokeWidth={2.5} /> สร้างใบเสนอราคา
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
