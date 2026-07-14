"use client";

import { TopbarActions } from "@/components/layout/TopbarActions";
import { useState, useRef, useEffect, createContext, useContext, useCallback, useMemo } from "react";
import {
  Building2, Plus, Pencil, Trash2, X, Check, Save, RotateCcw,
  Upload, UserCheck, FileText, ShieldCheck, Lock, ImagePlus, Bell,
  Camera, Mail, KeyRound,
} from "lucide-react";
import { responsiblePersons as RP_INITIAL, RP_STORAGE_KEY, NOTIF_META, NOTIF_PREFS_KEY, NOTIF_PREFS_EVENT, DEFAULT_NOTIF_PREFS, loadNotifPrefs, loadHQPolicy, DEFAULT_HQ_POLICY, profileKey, loadUserProfile, defaultProfileEmail, PROFILE_UPDATED_EVENT, type UserProfile, type HQPolicy, type NotifPrefs, type ResponsiblePerson } from "@/lib/mock";
import { useRole } from "@/context/RoleContext";
import { fileToResizedDataURL } from "@/lib/imageResize";

// ป้ายตำแหน่งตาม role (ใช้ในบัญชีดีลเลอร์)
const ROLE_LABEL: Record<string, string> = {
  HQ_MANAGEMENT: "ผู้บริหารสำนักงานใหญ่", DEALER_ADMIN: "ผู้จัดการตัวแทน", DEALER_SALES: "เซลส์", DEALER_SITE: "เซลส์ภาคสนาม",
};

type SettingTab = "company" | "documents" | "persons" | "notifications" | "rules";

// ── shared save bus — แท็บที่มีฟอร์มรายงาน {dirty,save,reset} ให้ปุ่มบันทึกกลางบนหัว
// (แนวเดียวกับหน้าตั้งค่า HQ · แท็บที่บันทึกทันที เช่น ผู้รับผิดชอบ/แจ้งเตือน ไม่ต้องรายงาน)
type SectionApi = { dirty: boolean; save: () => void; reset: () => void };
const SettingsBus = createContext<{ report: (a: SectionApi | null) => void; toast: (m: string) => void }>({ report: () => {}, toast: () => {} });
function useReport(api: SectionApi) {
  const { report } = useContext(SettingsBus);
  useEffect(() => { report(api); return () => report(null); }, [api, report]);
}

const TABS: { key: SettingTab; label: string; icon: React.ReactNode }[] = [
  { key: "company",   label: "บัญชีดีลเลอร์",     icon: <Building2 size={15} /> },
  { key: "documents", label: "ตั้งค่าใบเสนอราคา", icon: <FileText  size={15} /> },
  { key: "persons",   label: "ผู้รับผิดชอบ",       icon: <UserCheck size={15} /> },
  { key: "notifications", label: "การแจ้งเตือน",   icon: <Bell size={15} /> },
  { key: "rules",     label: "กฎธุรกิจ",           icon: <ShieldCheck size={15} /> },
];

// ─────────────────────────────────────────────────────────────────────────────
// COMPANY PROFILE TAB
// ─────────────────────────────────────────────────────────────────────────────
const COMPANY_KEY   = "dealer_issuer_profile_v2"; // v2 = รีเซ็ตข้อมูลเดโมเดิม
const LOGO_KEY      = "dealer_company_logo_v2";      // โลโก้สัญลักษณ์ (ไอคอน) → แถบเมนู
const WORDMARK_KEY  = "dealer_company_wordmark_v2";  // โลโก้พร้อมชื่อ (แนวนอน) → เอกสาร/ใบเสนอราคา
type CompanyProfile = { company: string; address: string; phone: string; email: string; website: string; taxId: string };
// ข้อมูลบริษัทดีลเลอร์เริ่มต้น (ตัวอย่างสมจริง — ไม่ใช่ Benjamin)
const COMPANY_DEFAULT: CompanyProfile = {
  company: "บริษัท เชียงใหม่สตีลบิลด์ จำกัด",
  address: "88/9 ถ.มหิดล ต.หายยา อ.เมือง จ.เชียงใหม่ 50100",
  phone:   "053-112-233",
  email:   "sales@cmsteelbuild.co.th",
  website: "www.cmsteelbuild.co.th",
  taxId:   "0505561001234",
};

// บัญชีดีลเลอร์ = โปรไฟล์ผู้ใช้ (รูป/ชื่อ) + ข้อมูลบริษัท + ข้อมูลบัญชี (อีเมลล็อกอิน/รหัสผ่าน) รวมเป็นบัญชีเดียว
function CompanyTab() {
  const { session } = useRole();
  const [form, setForm] = useState<CompanyProfile>(COMPANY_DEFAULT);
  const [logo, setLogo] = useState<string>("");
  const [wordmark, setWordmark] = useState<string>("");
  const [prof, setProf] = useState<UserProfile>({ name: session.name, email: defaultProfileEmail(session.dealerCode), phone: "" });
  const [pwNote, setPwNote] = useState(false);
  const [baseline, setBaseline] = useState("");
  const avatarRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let f = COMPANY_DEFAULT, l = "", w = "";
    const s = localStorage.getItem(COMPANY_KEY);
    if (s) try { f = { ...COMPANY_DEFAULT, ...JSON.parse(s) }; } catch {}
    const ls = localStorage.getItem(LOGO_KEY); if (ls) l = ls;
    const ws = localStorage.getItem(WORDMARK_KEY); if (ws) w = ws;
    const p = loadUserProfile(session.dealerCode, session.name);
    setForm(f); setLogo(l); setWordmark(w); setProf(p);
    setBaseline(JSON.stringify({ form: f, logo: l, wordmark: w, prof: p }));
  }, [session.dealerCode, session.name]);

  function set<K extends keyof CompanyProfile>(k: K, v: CompanyProfile[K]) {
    setForm(p => ({ ...p, [k]: v }));
  }
  const save = useCallback(() => {
    try {
      localStorage.setItem(COMPANY_KEY, JSON.stringify(form));
      if (logo) localStorage.setItem(LOGO_KEY, logo); else localStorage.removeItem(LOGO_KEY);
      if (wordmark) localStorage.setItem(WORDMARK_KEY, wordmark); else localStorage.removeItem(WORDMARK_KEY);
      const cleanProf: UserProfile = { name: prof.name.trim() || session.name, email: prof.email.trim() || defaultProfileEmail(session.dealerCode), phone: prof.phone.trim(), avatar: prof.avatar };
      localStorage.setItem(profileKey(session.dealerCode), JSON.stringify(cleanProf));
    } catch {
      alert("บันทึกไม่สำเร็จ — รูปมีขนาดใหญ่เกินไป กรุณาใช้รูปที่เล็กลง");
      return;
    }
    window.dispatchEvent(new Event("bpms-company-updated"));
    window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT));
    setBaseline(JSON.stringify({ form, logo, wordmark, prof }));
  }, [form, logo, wordmark, prof, session.dealerCode, session.name]);
  async function uploadAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await fileToResizedDataURL(file, 256);
    setProf(p => ({ ...p, avatar: url }));
  }
  const dirty = baseline !== "" && JSON.stringify({ form, logo, wordmark, prof }) !== baseline;
  const reset = useCallback(() => {
    if (!baseline) return;
    try { const b = JSON.parse(baseline); setForm(b.form); setLogo(b.logo); setWordmark(b.wordmark); setProf(b.prof); } catch {}
  }, [baseline]);
  useReport(useMemo(() => ({ dirty, save, reset }), [dirty, save, reset]));

  const roleLabel = ROLE_LABEL[session.role] ?? "ผู้ใช้งาน";
  // ชื่อบัญชี = ชื่อดีลเลอร์ (อันเดียวกันทั้งแอป: topbar/dropdown/ก้น sidebar · ไม่ใช่ชื่อบุคคล)
  const accountName = session.dealerName || form.company;
  const initial = accountName.charAt(0).toUpperCase();
  const sec: React.CSSProperties = { display: "flex", alignItems: "center", gap: 7, fontSize: "0.72rem", fontWeight: 800, color: "#003366", letterSpacing: "0.05em", marginBottom: 14, textTransform: "uppercase" };
  const roBox: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, border: "1px solid #e5e7eb", background: "#f7f8fa", borderRadius: 8, padding: "9px 12px", fontSize: "0.86rem", color: "#2D2D2D" };

  return (
    <>
      <div className="card-header">
        <div>
          <div className="card-title">บัญชีดีลเลอร์</div>
          <div className="card-desc">ข้อมูลผู้ใช้และบริษัทของตัวแทน — บัญชีเดียว · ใช้ออกใบเสนอราคาและเอกสาร</div>
        </div>
      </div>
      <div className="card-body">
        {/* ── ตัวตนบัญชี: รูป + ชื่อ + ตำแหน่ง (ชิดซ้าย) ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 22, paddingBottom: 20, borderBottom: "1px solid #f1f5f9" }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            {prof.avatar
              ? <img src={prof.avatar} alt="" style={{ width: 84, height: 84, borderRadius: "50%", objectFit: "cover", boxShadow: "0 3px 10px rgba(0,51,102,.22)" }} />
              : <div style={{ width: 84, height: 84, borderRadius: "50%", background: "linear-gradient(135deg,#003366,#0a4d8c)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.9rem", fontWeight: 900, boxShadow: "0 3px 10px rgba(0,51,102,.22)" }}>{initial}</div>}
            <button onClick={() => avatarRef.current?.click()} title="เปลี่ยนรูปถ่าย"
              style={{ position: "absolute", bottom: -1, right: -1, width: 28, height: 28, borderRadius: "50%", background: "#fff", border: "1px solid #e5e7eb", boxShadow: "0 2px 6px rgba(0,0,0,.15)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#003366" }}>
              <Camera size={14} />
            </button>
            <input ref={avatarRef} type="file" accept="image/*" onChange={uploadAvatar} style={{ display: "none" }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: "1.15rem", fontWeight: 800, color: "#2D2D2D" }}>{accountName}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "0.65rem", fontWeight: 700, color: "#003366", background: "#eef3f8", border: "1px solid #dce5f0", borderRadius: 999, padding: "3px 10px" }}>
                <ShieldCheck size={11} /> {roleLabel}
              </span>
            </div>
            <div style={{ fontSize: "0.72rem", color: "#8a929c", marginTop: 3 }}>ผู้ดูแลบัญชี: {prof.name || session.name}{session.dealerCode ? ` · รหัสตัวแทน ${session.dealerCode}` : ""}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 10 }}>
              <button onClick={() => avatarRef.current?.click()} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "#003366", fontSize: "0.74rem", fontWeight: 700, padding: 0, fontFamily: "inherit" }}>
                <RotateCcw size={13} /> เปลี่ยนรูปถ่าย
              </button>
              {prof.avatar && (
                <button onClick={() => setProf(p => ({ ...p, avatar: "" }))} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontSize: "0.74rem", fontWeight: 700, padding: 0, fontFamily: "inherit" }}>
                  <Trash2 size={13} /> ลบรูป
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── ข้อมูลบริษัท ── */}
        <div style={sec}><Building2 size={14} /> ข้อมูลบริษัท (ออกในนามตัวแทน)</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14, marginBottom: 14 }}>
          <div>
            <label className="form-label">ชื่อบริษัท</label>
            <input className="form-input" value={form.company} onChange={e => set("company", e.target.value)} placeholder="บริษัท ตัวอย่าง จำกัด" />
          </div>
          <div>
            <label className="form-label">เลขประจำตัวผู้เสียภาษี</label>
            <input className="form-input" value={form.taxId} onChange={e => set("taxId", e.target.value)} placeholder="0105555000000" />
          </div>
          <div>
            <label className="form-label">อีเมลบริษัท</label>
            <input className="form-input" type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="info@example.co.th" />
          </div>
          <div>
            <label className="form-label">โทรศัพท์บริษัท</label>
            <input className="form-input" value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="02-000-0000" />
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <label className="form-label">เว็บไซต์</label>
            <input className="form-input" value={form.website} onChange={e => set("website", e.target.value)} placeholder="www.example.co.th" />
          </div>
        </div>
        <div style={{ marginBottom: 20 }}>
          <label className="form-label">ที่อยู่</label>
          <textarea className="form-textarea" value={form.address} rows={3}
            onChange={e => set("address", e.target.value)}
            placeholder="ที่อยู่เต็ม รวมจังหวัดและรหัสไปรษณีย์" style={{ resize: "vertical" }} />
        </div>

        {/* ── ข้อมูลบัญชี: อีเมลล็อกอิน (ล็อก) + จัดการรหัสผ่าน ── */}
        <div style={{ ...sec, borderTop: "1px solid #f1f5f9", paddingTop: 18, marginBottom: 14 }}><KeyRound size={14} /> ข้อมูลบัญชี</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14 }}>
          <div>
            <label className="form-label" style={{ display: "flex", alignItems: "center", gap: 5 }}>อีเมลเข้าสู่ระบบ <Lock size={11} style={{ color: "#9ca3af" }} /></label>
            <div style={roBox}><Mail size={14} color="#6b7280" /> <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{prof.email}</span> <Lock size={12} color="#9ca3af" style={{ marginLeft: "auto", flexShrink: 0 }} /></div>
          </div>
          <div>
            <label className="form-label">รหัสผ่าน</label>
            <button type="button" onClick={() => setPwNote(v => !v)} className="btn btn-secondary btn-md" style={{ width: "100%", justifyContent: "center", color: "#003366" }}>
              <KeyRound size={14} /> จัดการรหัสผ่าน
            </button>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.65rem", color: pwNote ? "#b45309" : "#9ca3af", marginTop: 8 }}>
          <Lock size={11} /> {pwNote ? "รหัสผ่านและอีเมลเข้าสู่ระบบจัดการโดยสำนักงานใหญ่ — หากต้องรีเซ็ต กรุณาติดต่อผู้ดูแลระบบ" : "อีเมลเข้าสู่ระบบ · รหัสผ่าน กำหนดโดยสำนักงานใหญ่"}
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENT SETTINGS TAB
// ─────────────────────────────────────────────────────────────────────────────
const DOCUMENT_KEY = "dealer_document_settings";
type DocumentSettings = {
  quotePrefix: string;
  autoYear: boolean;   // ออกปีในเลขที่อัตโนมัติ (Q-{ปีปัจจุบัน}-) แทนการพิมพ์เอง
  runningNumber: number;
  vatPercent: number;
  validityDays: number;    // อายุใบเสนอราคา (วัน) → วันหมดอายุเริ่มต้น
  defaultDiscount: number; // ส่วนลดเริ่มต้น % ตอนสร้างใบเสนอราคา
  termsAndConditions: string;
  header: string;
  footer: string;
  stamp: string;
  signature: string;
};
const DOC_DEFAULT: DocumentSettings = {
  quotePrefix:         "Q-2026-",
  autoYear:            true,
  runningNumber:       1101,
  vatPercent:          7,
  validityDays:        30,
  defaultDiscount:     0,
  termsAndConditions:
    "ราคานี้มีผลภายใน 30 วัน นับจากวันที่ออกใบเสนอราคา\n" +
    "บริษัทขอสงวนสิทธิ์เปลี่ยนแปลงราคาโดยไม่แจ้งล่วงหน้า\n" +
    "การยืนยันการสั่งซื้อจะมีผลเมื่อได้รับเงินมัดจำเท่านั้น",
  header:    "",
  footer:    "ขอบคุณที่ไว้วางใจบริษัทของเรา",
  stamp:     "",
  signature: "",
};

function ImageUploadBox({
  label, hint, value, onChange,
}: { label: string; hint: string; value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    onChange(await fileToResizedDataURL(file, 320)); // ย่อก่อนเก็บ กัน quota เต็ม
  }
  return (
    <div>
      <label className="form-label">{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 80, height: 80, border: "2px dashed #e5e7eb", borderRadius: 10,
          background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden", flexShrink: 0 }}>
          {value
            ? <img src={value} alt={label} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            : <span style={{ fontSize: "0.65rem", color: "#9ca3af", textAlign: "center", lineHeight: 1.4, padding: "0 6px" }}>{hint}</span>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => ref.current?.click()}>
            <Upload size={13} /> อัปโหลด
          </button>
          {value && (
            <button className="btn btn-ghost btn-sm" onClick={() => onChange("")}>ลบ</button>
          )}
          <span style={{ fontSize: "0.65rem", color: "#9ca3af" }}>PNG, JPG · โปร่งใสได้</span>
        </div>
      </div>
      <input ref={ref} type="file" accept="image/*" style={{ display: "none" }} onChange={upload} />
    </div>
  );
}

function DocumentsTab() {
  const [doc, setDoc] = useState<DocumentSettings>(DOC_DEFAULT);
  const [baseline, setBaseline] = useState(""); // สแนปช็อตค่าที่บันทึกล่าสุด → ใช้เทียบ dirty
  const [hq, setHq] = useState<HQPolicy>(DEFAULT_HQ_POLICY); // ใช้เฉพาะ VAT ที่ HQ ล็อก · เลขที่/อายุใบ ตัวแทนคุมเอง

  useEffect(() => {
    setHq(loadHQPolicy());
    let d = DOC_DEFAULT;
    const s = localStorage.getItem(DOCUMENT_KEY);
    if (s) try { d = { ...DOC_DEFAULT, ...JSON.parse(s) }; } catch {}
    setDoc(d);
    setBaseline(JSON.stringify(d));
  }, []);

  function set<K extends keyof DocumentSettings>(k: K, v: DocumentSettings[K]) {
    setDoc(p => ({ ...p, [k]: v }));
  }

  const save = useCallback(() => {
    localStorage.setItem(DOCUMENT_KEY, JSON.stringify(doc));
    setBaseline(JSON.stringify(doc));
  }, [doc]);
  const dirty = baseline !== "" && JSON.stringify(doc) !== baseline;
  const reset = useCallback(() => {
    if (!baseline) return;
    try { setDoc(JSON.parse(baseline)); } catch {}
  }, [baseline]);
  useReport(useMemo(() => ({ dirty, save, reset }), [dirty, save, reset]));

  // เลขที่ตัวอย่าง = รูปแบบที่ตัวแทนตั้งเอง (prefix + เลขถัดไป)
  const previewNo = `${doc.quotePrefix}${String(doc.runningNumber).padStart(4, "0")}`;

  return (
    <>
      <div className="card-header">
        <div>
          <div className="card-title">ตั้งค่าใบเสนอราคา</div>
          <div className="card-desc">เลขที่ · อายุใบ · ส่วนลด · หัว/ท้าย เงื่อนไข ตราประทับ และลายเซ็น · ภาษีกำหนดโดยสำนักงานใหญ่</div>
        </div>
      </div>
      <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 22 }}>

        {/* Quote number format — ตัวแทนตั้งเลขที่/อายุใบ/ส่วนลดเองได้ · ล็อกเฉพาะ VAT (อัตราภาษีมาตรฐาน) */}
        <div>
          <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "#003366", letterSpacing: "0.05em", marginBottom: 10, textTransform: "uppercase" }}>
            เลขที่ใบเสนอราคา
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(150px, 180px) minmax(120px, 160px) minmax(90px, 120px) minmax(0, 1fr)", gap: 12, alignItems: "end" }}>
            <div>
              <label className="form-label">คำนำหน้าเลขที่</label>
              <input className="form-input" value={doc.quotePrefix} onChange={e => set("quotePrefix", e.target.value)}
                placeholder="Q-2026-" style={{ fontFamily: "monospace" }} />
            </div>
            <div>
              <label className="form-label">เลขลำดับถัดไป</label>
              <input className="form-input" type="number" min={1} value={doc.runningNumber}
                onChange={e => set("runningNumber", Math.max(1, Number(e.target.value) || 1))}
                style={{ fontFamily: "monospace" }} />
            </div>
            <div>
              <label className="form-label" style={{ display: "flex", alignItems: "center", gap: 5 }}>
                ภาษีมูลค่าเพิ่ม % <Lock size={11} style={{ color: "#9ca3af" }} />
              </label>
              <div className="form-input" style={{ fontFamily: "monospace", background: "#f8fafc", color: "#6b7280",
                display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "not-allowed" }}
                title="อัตราภาษีมาตรฐาน กำหนดโดยสำนักงานใหญ่">
                <span>{hq.vat}%</span>
                <span style={{ fontSize: "0.6rem", fontFamily: "inherit", color: "#9ca3af", fontWeight: 600 }}>HQ</span>
              </div>
            </div>
            <div style={{ padding: "10px 14px", background: "#f0f4fa", borderRadius: 10, border: "1px solid #dce5f0" }}>
              <div style={{ fontSize: "0.65rem", color: "#9ca3af", marginBottom: 3 }}>ตัวอย่างเลขที่ถัดไป</div>
              <div style={{ fontFamily: "monospace", fontWeight: 800, color: "#003366", fontSize: "1rem" }}>{previewNo}</div>
            </div>
          </div>
          {/* ค่าเริ่มต้น: อายุใบเสนอราคา + ส่วนลดเริ่มต้น (ตัวแทนตั้งได้เอง) */}
          <div style={{ display: "grid", gridTemplateColumns: "minmax(150px, 200px) minmax(150px, 200px)", gap: 12, marginTop: 14 }}>
            <div>
              <label className="form-label">อายุใบเสนอราคา (วัน)</label>
              <input className="form-input" type="number" min={1} value={doc.validityDays}
                onChange={e => set("validityDays", Math.max(1, Number(e.target.value) || 1))}
                style={{ fontFamily: "monospace" }} />
            </div>
            <div>
              <label className="form-label">ส่วนลดเริ่มต้น (%) <span style={{ color: "#9ca3af", fontWeight: 400 }}>· เพดาน HQ {hq.maxDiscount}%</span></label>
              <input className="form-input" type="number" min={0} max={hq.maxDiscount} value={doc.defaultDiscount}
                onChange={e => set("defaultDiscount", Math.max(0, Math.min(hq.maxDiscount, Number(e.target.value) || 0)))}
                style={{ fontFamily: "monospace" }} />
            </div>
          </div>
        </div>

        <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 18 }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "#003366", letterSpacing: "0.05em", marginBottom: 12,
            textTransform: "uppercase" }}>
            หัว / ท้าย เอกสาร
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label className="form-label">หัวเอกสาร</label>
              <textarea className="form-textarea" value={doc.header} rows={2}
                onChange={e => set("header", e.target.value)}
                placeholder="ข้อความหัวเอกสาร (ถ้ามี)" style={{ resize: "vertical" }} />
            </div>
            <div>
              <label className="form-label">ท้ายเอกสาร</label>
              <textarea className="form-textarea" value={doc.footer} rows={2}
                onChange={e => set("footer", e.target.value)}
                placeholder="ข้อความท้ายเอกสาร" style={{ resize: "vertical" }} />
            </div>
          </div>
        </div>

        <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 18 }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "#003366", letterSpacing: "0.05em", marginBottom: 12,
            textTransform: "uppercase" }}>
            เงื่อนไขและข้อกำหนด
          </div>
          <textarea className="form-textarea" value={doc.termsAndConditions} rows={5}
            onChange={e => set("termsAndConditions", e.target.value)}
            placeholder="เงื่อนไขการชำระเงิน อายุใบเสนอราคา ข้อกำหนดอื่นๆ"
            style={{ resize: "vertical" }} />
        </div>

        <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 18 }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "#003366", letterSpacing: "0.05em", marginBottom: 12,
            textTransform: "uppercase" }}>
            ตราประทับ & ลายเซ็นดิจิทัล
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 20 }}>
            <ImageUploadBox
              label="ตราประทับบริษัท"
              hint="อัปโหลดตราประทับ"
              value={doc.stamp}
              onChange={v => set("stamp", v)}
            />
            <ImageUploadBox
              label="ลายเซ็นดิจิทัล"
              hint="อัปโหลดลายเซ็น"
              value={doc.signature}
              onChange={v => set("signature", v)}
            />
          </div>
        </div>

      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RESPONSIBLE PERSONS TAB
// ─────────────────────────────────────────────────────────────────────────────
// รับ persons จาก localStorage แล้ว "จัด id ใหม่ให้ไม่ซ้ำ" (index+1) — กัน key ซ้ำจากข้อมูลเก่าที่เคยบันทึกผิด
// RP id ใช้เป็น React key/แก้-ลบภายในหน้านี้เท่านั้น (ลีด/ลูกค้าอ้างด้วย "ชื่อ" ไม่ใช่ id) จึง reindex ได้ปลอดภัย
function reindexPersons(arr: unknown): ResponsiblePerson[] {
  if (!Array.isArray(arr)) return RP_INITIAL;
  return arr.map((p: ResponsiblePerson, i) => ({ ...p, id: i + 1 }));
}

function PersonsTab() {
  const [persons, setPersons] = useState<ResponsiblePerson[]>(RP_INITIAL);
  const [editId,    setEditId]    = useState<number | null>(null);
  const [editName,  setEditName]  = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editAvatar, setEditAvatar] = useState<string | undefined>(undefined);
  const [adding,    setAdding]    = useState(false);
  const [newName,   setNewName]   = useState("");
  const [newTitle,  setNewTitle]  = useState("");
  const [newPhone,  setNewPhone]  = useState("");
  const [newEmail,  setNewEmail]  = useState("");
  const [newAvatar, setNewAvatar] = useState<string | undefined>(undefined);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // อ่านไฟล์รูป → ย่อขนาด (มาตรฐานกลาง imageResize) กัน localStorage เต็ม
  async function readAvatar(file: File | undefined, cb: (url: string) => void) {
    if (!file) return;
    cb(await fileToResizedDataURL(file, 128));
  }

  useEffect(() => {
    const s = localStorage.getItem(RP_STORAGE_KEY);
    if (s) try { setPersons(reindexPersons(JSON.parse(s))); } catch {}
  }, []);

  function save(updated: ResponsiblePerson[]) {
    setPersons(updated);
    localStorage.setItem(RP_STORAGE_KEY, JSON.stringify(updated));
  }
  function startEdit(p: ResponsiblePerson) {
    setEditId(p.id); setEditName(p.name ?? ""); setEditTitle(p.title ?? "");
    setEditPhone(p.phone ?? ""); setEditEmail(p.email ?? ""); setEditAvatar(p.avatar);
  }
  function saveEdit() {
    save(persons.map(p => p.id === editId
      ? { ...p, name: editName, title: editTitle, phone: editPhone, email: editEmail, avatar: editAvatar }
      : p));
    setEditId(null);
  }
  function toggleActive(id: number) { save(persons.map(p => p.id === id ? { ...p, active: !p.active } : p)); }
  function deletePerson(id: number) { save(persons.filter(p => p.id !== id)); setDeleteConfirmId(null); }
  function addPerson() {
    if (!newName.trim()) return;
    const p: ResponsiblePerson = {
      id: Math.max(0, ...persons.map(x => x.id)) + 1, name: newName.trim(), title: newTitle.trim() || "เจ้าหน้าที่ขาย",
      phone: newPhone.trim(), email: newEmail.trim(), active: true, avatar: newAvatar,
    };
    save([...persons, p]);
    setNewName(""); setNewTitle(""); setNewPhone(""); setNewEmail(""); setNewAvatar(undefined); setAdding(false);
  }

  return (
    <>
      <div className="card-header">
        <div>
          <div className="card-title">ผู้รับผิดชอบ</div>
          <div className="card-desc">รายชื่อพนักงานขายที่ใช้กำกับลูกค้าเป้าหมาย ลูกค้า และรายงาน · ไม่ใช่ผู้ใช้ระบบ</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}><Plus size={14} /> เพิ่ม</button>
      </div>
      <div className="card-body" style={{ paddingTop: 0 }}>
        {/* ── ป๊อปอัพเพิ่ม/แก้ไขผู้รับผิดชอบ (ใช้ modal เดียวกัน) ── */}
        {(adding || editId !== null) && (() => {
          const isEdit = editId !== null;
          // coerce เป็นสตริงเสมอ — กัน input controlled/uncontrolled สลับกัน
          const name = (isEdit ? editName : newName) ?? "";
          const title = (isEdit ? editTitle : newTitle) ?? "";
          const phone = (isEdit ? editPhone : newPhone) ?? "";
          const email = (isEdit ? editEmail : newEmail) ?? "";
          const avatar = isEdit ? editAvatar : newAvatar;
          const setName = isEdit ? setEditName : setNewName;
          const setTitle = isEdit ? setEditTitle : setNewTitle;
          const setPhone = isEdit ? setEditPhone : setNewPhone;
          const setEmail = isEdit ? setEditEmail : setNewEmail;
          const setAvatar = isEdit ? setEditAvatar : setNewAvatar;
          const submit = isEdit ? saveEdit : addPerson;
          const close = () => { if (isEdit) setEditId(null); else { setAdding(false); setNewName(""); setNewTitle(""); setNewPhone(""); setNewEmail(""); setNewAvatar(undefined); } };
          const onEnter = (e: React.KeyboardEvent) => { if (e.key === "Enter" && name.trim()) submit(); };
          return (
            <div onClick={close} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(45,45,45,.45)",
              display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
              <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 460, background: "#fff", borderRadius: 18,
                overflow: "hidden", boxShadow: "0 24px 80px rgba(0,0,0,.28)" }}>
                {/* header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", background: "#003366" }}>
                  <div style={{ fontSize: "1rem", fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", gap: 8 }}>
                    {isEdit ? <><Pencil size={16} strokeWidth={2.5} /> แก้ไขผู้รับผิดชอบ</> : <><Plus size={17} strokeWidth={2.5} /> เพิ่มผู้รับผิดชอบ</>}
                  </div>
                  <button onClick={close} style={{ width: 32, height: 32, borderRadius: 9, border: "1px solid rgba(255,255,255,.2)",
                    background: "rgba(255,255,255,.1)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={15} /></button>
                </div>
                {/* body */}
                <div style={{ padding: "24px 22px" }}>
                  {/* avatar upload — กลาง */}
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
                    <label title="เพิ่ม/เปลี่ยนรูปโปรไฟล์" style={{ cursor: "pointer", position: "relative", display: "inline-block" }}>
                      <input type="file" accept="image/*" style={{ display: "none" }}
                        onChange={e => { readAvatar(e.target.files?.[0], url => setAvatar(url)); e.target.value = ""; }} />
                      {avatar
                        ? <img src={avatar} alt="" style={{ width: 84, height: 84, borderRadius: "50%", objectFit: "cover", border: "3px solid #003366" }} />
                        : <span style={{ width: 84, height: 84, borderRadius: "50%", border: "2px dashed #c7ccd3", background: "#f8f9fb",
                            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, color: "#9ca3af" }}>
                            <ImagePlus size={22} /><span style={{ fontSize: "0.65rem" }}>เพิ่มรูป</span>
                          </span>}
                      <span style={{ position: "absolute", right: 0, bottom: 2, width: 26, height: 26, borderRadius: "50%", background: "#003366",
                        border: "2px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}><ImagePlus size={13} /></span>
                    </label>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div style={{ gridColumn: "1/-1" }}>
                      <label className="form-label">ชื่อ-นามสกุล *</label>
                      <input className="form-input" value={name} autoFocus onChange={e => setName(e.target.value)}
                        placeholder="เช่น สมชาย เชียงใหม่" onKeyDown={onEnter} />
                    </div>
                    <div>
                      <label className="form-label">ตำแหน่ง</label>
                      <input className="form-input" value={title} onChange={e => setTitle(e.target.value)}
                        placeholder="เจ้าหน้าที่ขาย" onKeyDown={onEnter} />
                    </div>
                    <div>
                      <label className="form-label">โทรศัพท์</label>
                      <input className="form-input" value={phone} onChange={e => setPhone(e.target.value)}
                        placeholder="08x-xxx-xxxx" onKeyDown={onEnter} />
                    </div>
                    <div style={{ gridColumn: "1/-1" }}>
                      <label className="form-label">อีเมล</label>
                      <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)}
                        placeholder="name@dealer.co.th" onKeyDown={onEnter} />
                    </div>
                  </div>
                </div>
                {/* footer */}
                <div style={{ padding: "14px 22px", borderTop: "1px solid #e5e7eb", background: "#fafafa",
                  display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button className="btn btn-secondary btn-md" onClick={close}>ยกเลิก</button>
                  <button className="btn btn-primary btn-md" disabled={!name.trim()}
                    style={!name.trim() ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
                    onClick={submit}><Check size={14} strokeWidth={2.5} /> บันทึก</button>
                </div>
              </div>
            </div>
          );
        })()}

        <div className="table-wrap" style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
          <table>
            <colgroup>
              <col style={{ width: "24%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "20%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "16%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>ชื่อ-นามสกุล</th>
                <th>ตำแหน่ง</th>
                <th>โทรศัพท์</th>
                <th>อีเมล</th>
                <th style={{ width: 110 }}>สถานะ</th>
                <th className="num" style={{ width: 160 }}>การจัดการ</th>
              </tr>
            </thead>
            <tbody>
              {persons.map(p => (
                <tr key={p.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {p.avatar
                        ? <img src={p.avatar} alt="" style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", flexShrink: 0, opacity: p.active ? 1 : 0.5 }} />
                        : <div style={{ width: 34, height: 34, borderRadius: "50%", background: p.active ? "#003366" : "#9ca3af",
                            flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <span style={{ color: "#fff", fontSize: "0.72rem", fontWeight: 800 }}>{p.name.charAt(0)}</span>
                          </div>}
                      <span style={{ fontWeight: 600, color: p.active ? "#2D2D2D" : "#9ca3af" }}>{p.name}</span>
                    </div>
                  </td>
                  <td><span style={{ fontSize: "0.8rem", color: "#6b7280" }}>{p.title}</span></td>
                  <td><span style={{ fontSize: "0.8rem", color: "#6b7280" }}>{p.phone || "—"}</span></td>
                  <td><span style={{ fontSize: "0.8rem", color: "#6b7280" }}>{p.email || "—"}</span></td>
                  <td>
                    <button onClick={() => toggleActive(p.id)} className="badge"
                      style={{ border: "none", cursor: "pointer", fontFamily: "inherit",
                        background: p.active ? "#e5faf0" : "#f0f0f5",
                        color: p.active ? "#059669" : "#9ca3af" }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", display: "inline-block",
                        background: p.active ? "#059669" : "#C0C0C0" }} />
                      {p.active ? "ใช้งาน" : "ไม่ใช้งาน"}
                    </button>
                  </td>
                  <td className="num">
                    {deleteConfirmId === p.id ? (
                      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end", alignItems: "center" }}>
                        <span style={{ fontSize: "0.65rem", color: "#dc2626", fontWeight: 600 }}>ยืนยันลบ?</span>
                        <button className="btn btn-danger btn-sm" onClick={() => deletePerson(p.id)}>ลบ</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setDeleteConfirmId(null)}><X size={13} /></button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => startEdit(p)}><Pencil size={13} /> แก้ไข</button>
                        <button className="btn btn-danger btn-sm" onClick={() => setDeleteConfirmId(p.id)}><Trash2 size={13} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {persons.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: "28px", textAlign: "center", color: "#9ca3af", fontSize: "0.8rem" }}>
                    ยังไม่มีผู้รับผิดชอบ — กด &quot;+ เพิ่ม&quot; เพื่อเริ่มต้น
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: "0.72rem", color: "#9ca3af", marginTop: 10 }}>
          ผู้รับผิดชอบ <strong>ไม่ใช่ผู้ใช้ระบบ · Login ไม่ได้</strong> — ใช้สำหรับเลือกตอนสร้างลูกค้าเป้าหมายเท่านั้น
        </p>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BUSINESS RULES TAB — กติกาการขาย (บางข้อ HQ ล็อก, บางข้อ Dealer ปรับได้)
// ─────────────────────────────────────────────────────────────────────────────
const RULES_KEY = "dealer_business_rules";
type BizRules = {
  quoteValidityDays: number;
  leadSlaHours: number;
  maxSelfDiscountPct: number;
  followUpDays: number;
  defaultResponsibleId: number | null;
};
const RULES_DEFAULT: BizRules = {
  quoteValidityDays: 30,
  leadSlaHours: 48,
  maxSelfDiscountPct: 10,
  followUpDays: 7,
  defaultResponsibleId: null,
};

// ขั้นตอนการขายมาตรฐาน (Core Stage — HQ ล็อก ทุกตัวแทนเหมือนกัน)
const CORE_STAGES = ["ติดต่อแล้ว", "รวบรวมความต้องการ", "เสนอราคา", "ติดตามผล", "เจรจา", "ปิดการขาย (Won/Lost)"];

// กติกาที่ HQ กำหนดตายตัว (อ่านอย่างเดียว)
const LOCKED_RULES = [
  "เส้นทางการขายจบที่ Won / Lost เท่านั้น — ไม่มีขั้นตอนก่อสร้าง/ผลิต/ติดตั้ง",
  "ใบเสนอราคาออกในนามบริษัทของตัวแทนเอง (ห้ามใช้ชื่อสำนักงานใหญ่)",
  "ราคากลาง/แคตตาล็อกแม่แบบกำหนดโดย HQ — Dealer ดูได้ แก้ไม่ได้",
  "ข้อมูลทั้งหมด Sync ไปสำนักงานใหญ่ (HQ) อัตโนมัติ",
  "Responsible Person เป็นรายชื่อเซลส์ ไม่ใช่ผู้ใช้ระบบ (Login ไม่ได้)",
];

function RulesTab() {
  const [rules, setRules] = useState<BizRules>(RULES_DEFAULT);
  const [persons, setPersons] = useState<ResponsiblePerson[]>(RP_INITIAL);
  const [baseline, setBaseline] = useState(""); // สแนปช็อตค่าที่บันทึกล่าสุด → ใช้เทียบ dirty
  const [hq, setHq] = useState<HQPolicy>(DEFAULT_HQ_POLICY); // นโยบายที่ HQ ล็อก

  useEffect(() => {
    setHq(loadHQPolicy());
    let r = RULES_DEFAULT;
    const s = localStorage.getItem(RULES_KEY);
    if (s) try { r = { ...RULES_DEFAULT, ...JSON.parse(s) }; } catch {}
    setRules(r);
    setBaseline(JSON.stringify(r));
    const p = localStorage.getItem(RP_STORAGE_KEY);
    if (p) try { setPersons(reindexPersons(JSON.parse(p))); } catch {}
  }, []);

  function set<K extends keyof BizRules>(k: K, v: BizRules[K]) { setRules(p => ({ ...p, [k]: v })); }
  const save = useCallback(() => {
    setRules(r => { localStorage.setItem(RULES_KEY, JSON.stringify(r)); setBaseline(JSON.stringify(r)); return r; });
  }, []);
  const dirty = baseline !== "" && JSON.stringify(rules) !== baseline;
  const reset = useCallback(() => {
    if (!baseline) return;
    try { setRules(JSON.parse(baseline)); } catch {}
  }, [baseline]);
  useReport(useMemo(() => ({ dirty, save, reset }), [dirty, save, reset]));

  // ค่าที่ตัวแทนปรับได้เอง (Constitution V2 — ตัด SLA ออกทั้งหมด)
  const editable: { k: "followUpDays"; label: string; hint: string; unit: string; max?: number }[] = [
    { k: "followUpDays", label: "จำนวนวันติดตามเริ่มต้น", hint: "ระยะเวลาก่อนติดตามลูกค้าครั้งถัดไป", unit: "วัน" },
  ];
  // นโยบายที่ HQ กำหนด — ตัวแทนดูได้ แก้ไม่ได้ (ตั้งที่ HQ → ตั้งค่า → กฎธุรกิจ)
  const hqLocked: { label: string; value: string; hint: string }[] = [
    { label: "เพดานส่วนลดสูงสุด", value: `${hq.maxDiscount}%`,          hint: "ตัวแทนออกใบเสนอราคาเกินเพดานนี้ไม่ได้" },
    { label: "ภาษีมูลค่าเพิ่ม",     value: `${hq.vat}%`,                  hint: "อัตรามาตรฐานบนใบเสนอราคาทุกตัวแทน" },
    { label: "อายุใบเสนอราคา",     value: `${hq.quoteValidityDays} วัน`, hint: "จำนวนวันที่ราคามีผลนับจากวันออกเอกสาร" },
  ];

  return (
    <>
      <div className="card-header">
        <div>
          <div className="card-title">กฎธุรกิจ (Business Rules)</div>
          <div className="card-desc">นโยบายที่สำนักงานใหญ่กำหนด (อ่านอย่างเดียว) และค่าที่ตัวแทนปรับได้เอง</div>
        </div>
      </div>
      <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 22 }}>

        {/* Core sales journey (locked) */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: "0.72rem", fontWeight: 800, color: "#003366", letterSpacing: "0.05em", marginBottom: 12, textTransform: "uppercase" }}>
            <Lock size={13} /> ขั้นตอนการขายมาตรฐาน · HQ ล็อก
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            {CORE_STAGES.map((s, i) => (
              <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <span className="badge" style={{ background: "#dce5f0", color: "#003366" }}>{i + 1}. {s}</span>
                {i < CORE_STAGES.length - 1 && <span style={{ color: "#cbd5e1" }}>→</span>}
              </span>
            ))}
          </div>
        </div>

        {/* Editable dealer rules */}
        <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 18 }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "#003366", letterSpacing: "0.05em", marginBottom: 12, textTransform: "uppercase" }}>
            ค่าที่ตัวแทนปรับได้
          </div>
          {/* ชิดซ้าย · จำกัดความกว้าง — ไม่ให้ช่องกรอกยืดเต็มจอ */}
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 220px) minmax(0, 340px)", gap: 16, alignItems: "start" }}>
            {editable.map(f => (
              <div key={f.k}>
                <label className="form-label">{f.label}</label>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <input className="form-input" type="number" min={0} max={f.max} value={rules[f.k]}
                    onChange={e => set(f.k, Math.max(0, Number(e.target.value)) as BizRules[typeof f.k])}
                    style={{ fontFamily: "monospace", minWidth: 0, textAlign: "right", fontWeight: 700 }} />
                  <span style={{ fontSize: "0.72rem", color: "#6b7280", flexShrink: 0 }}>{f.unit}</span>
                </div>
                <div style={{ fontSize: "0.65rem", color: "#9ca3af", marginTop: 4 }}>{f.hint}</div>
              </div>
            ))}
            <div>
              <label className="form-label">ผู้รับผิดชอบเริ่มต้น</label>
              <select className="form-input"
                value={rules.defaultResponsibleId ?? ""}
                onChange={e => set("defaultResponsibleId", e.target.value ? Number(e.target.value) : null)}>
                <option value="">— ไม่กำหนด —</option>
                {persons.filter(p => p.active).map(p => (
                  <option key={p.id} value={p.id}>{p.name}{p.title ? ` · ${p.title}` : ""}</option>
                ))}
              </select>
              <div style={{ fontSize: "0.65rem", color: "#9ca3af", marginTop: 4 }}>ผู้รับผิดชอบที่กำหนดให้ลูกค้าเป้าหมายโดยอัตโนมัติเมื่อไม่ได้ระบุ</div>
            </div>
          </div>
        </div>

        {/* HQ-locked numeric policy — แสดงค่าจริงจากสำนักงานใหญ่ (ไม่ให้แก้ · กันซ้ำซ้อนกับหน้า HQ) */}
        <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: "0.72rem", fontWeight: 800, color: "#003366", letterSpacing: "0.05em", marginBottom: 12, textTransform: "uppercase" }}>
            <Lock size={13} /> นโยบายราคาที่สำนักงานใหญ่กำหนด
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
            {hqLocked.map(f => (
              <div key={f.label} style={{ padding: "12px 14px", background: "#f8fafc", border: "1px solid #eef1f5", borderRadius: 10 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                  <span style={{ fontSize: "0.72rem", color: "#6b7280", fontWeight: 600 }}>{f.label}</span>
                  <span style={{ fontSize: "0.58rem", color: "#9ca3af", fontWeight: 700, border: "1px solid #dce5f0", borderRadius: 5, padding: "1px 5px" }}>HQ</span>
                </div>
                <div style={{ fontFamily: "monospace", fontWeight: 800, color: "#003366", fontSize: "1.05rem", marginTop: 4 }}>{f.value}</div>
                <div style={{ fontSize: "0.62rem", color: "#9ca3af", marginTop: 3, lineHeight: 1.4 }}>{f.hint}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: "0.68rem", color: "#9ca3af", marginTop: 8 }}>
            ค่าเหล่านี้ตั้งที่สำนักงานใหญ่และมีผลกับทุกตัวแทน · ตัวแทนดูได้ แก้ไม่ได้
          </p>
        </div>

        {/* Locked HQ rules */}
        <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: "0.72rem", fontWeight: 800, color: "#003366", letterSpacing: "0.05em", marginBottom: 12, textTransform: "uppercase" }}>
            <Lock size={13} /> กติกาที่ HQ กำหนด · อ่านอย่างเดียว
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {LOCKED_RULES.map((r, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 14px", background: "#f8fafc", border: "1px solid #eef1f5", borderRadius: 10 }}>
                <ShieldCheck size={15} style={{ color: "#003366", flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: "0.8rem", color: "#374151", lineHeight: 1.5 }}>{r}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATIONS TAB — เปิด/ปิดการแจ้งเตือนแต่ละชนิด (มีผลกับกระดิ่งบน Topbar ทันที)
// ─────────────────────────────────────────────────────────────────────────────
function NotificationsTab() {
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_NOTIF_PREFS);
  const [saved, setSaved] = useState(false);
  useEffect(() => { setPrefs(loadNotifPrefs()); }, []);
  function toggle(k: keyof NotifPrefs) {
    setPrefs(p => {
      const next = { ...p, [k]: !p[k] };
      localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(NOTIF_PREFS_EVENT)); // ให้ Topbar อัปเดตทันที
      setSaved(true); setTimeout(() => setSaved(false), 1800);
      return next;
    });
  }
  return (
    <>
      <div className="card-header">
        <div>
          <div className="card-title">การแจ้งเตือน</div>
          <div className="card-desc">เลือกชนิดการแจ้งเตือนที่ต้องการรับบนกระดิ่ง — ปิดชนิดที่ไม่ต้องการได้</div>
        </div>
        {saved && <span style={{ fontSize: "0.72rem", color: "#059669", fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}><Check size={13} /> บันทึกแล้ว</span>}
      </div>
      <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {NOTIF_META.map(n => (
          <label key={n.key} style={{ display: "flex", alignItems: "center", gap: 14, border: "1px solid #e5e7eb", borderRadius: 12, padding: "12px 16px", cursor: "pointer" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "0.86rem", fontWeight: 700, color: "#2D2D2D" }}>{n.label}</div>
              <div style={{ fontSize: "0.72rem", color: "#6b7280", marginTop: 2 }}>{n.desc}</div>
            </div>
            {/* toggle switch */}
            <button type="button" onClick={() => toggle(n.key)} aria-pressed={prefs[n.key]}
              style={{ width: 42, height: 24, borderRadius: 999, border: "none", cursor: "pointer", flexShrink: 0,
                background: prefs[n.key] ? "#003366" : "#cbd5e1", position: "relative", transition: "background .15s" }}>
              <span style={{ position: "absolute", top: 3, left: prefs[n.key] ? 21 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left .15s", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
            </button>
          </label>
        ))}
        <div style={{ fontSize: "0.65rem", color: "#9ca3af", marginTop: 2 }}>เปลี่ยนแล้วมีผลกับกระดิ่งแจ้งเตือนทันที (บันทึกอัตโนมัติ)</div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingTab>("company");
  const [api, setApi] = useState<SectionApi | null>(null);
  const [toast, setToastMsg] = useState<string | null>(null);
  const report = useCallback((a: SectionApi | null) => setApi(a), []);
  const showToast = useCallback((m: string) => { setToastMsg(m); setTimeout(() => setToastMsg(null), 2400); }, []);
  const dirty = !!api?.dirty;

  // เตือนก่อนออกจากแท็บถ้ายังไม่บันทึก (แนวเดียวกับหน้าตั้งค่า HQ)
  function switchTab(next: SettingTab) {
    if (next === activeTab) return;
    if (dirty && !confirm("ส่วนนี้ยังไม่บันทึก · ทิ้งที่แก้ไว้ไหม?")) return;
    setActiveTab(next);
  }
  function saveAll() { if (dirty && api) { api.save(); showToast("บันทึกการตั้งค่าแล้ว"); } }
  function resetAll() { if (dirty && api) api.reset(); }

  return (
    <SettingsBus.Provider value={{ report, toast: showToast }}>
      <div className="erp">
        {/* หัวหน้า/ปุ่มบันทึก → ไปอยู่บนแถบบน (ชื่อหน้ามาจาก Topbar) */}
        <TopbarActions>
          {dirty && <span style={{ fontSize: "0.72rem", color: "#d97706", fontWeight: 600 }}>ยังไม่บันทึก</span>}
          <button className="btn btn-secondary btn-sm" onClick={resetAll} disabled={!dirty} style={!dirty ? { opacity: .5, cursor: "not-allowed" } : undefined}><RotateCcw size={14} /> รีเซ็ต</button>
          <button className="btn btn-primary btn-sm" onClick={saveAll} disabled={!dirty} style={!dirty ? { opacity: .5, cursor: "not-allowed" } : undefined}><Save size={14} /> บันทึก</button>
        </TopbarActions>
        <p className="page-sub">บัญชีดีลเลอร์ · ใบเสนอราคา · ผู้รับผิดชอบ · กฎธุรกิจ ของตัวแทน</p>

        {/* Tab bar */}
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="tab-bar" style={{ overflowX: "auto" }}>
            {TABS.map(t => (
              <button key={t.key} onClick={() => switchTab(t.key)}
                className={`tab-item${activeTab === t.key ? " active" : ""}`}
                style={{ display: "flex", alignItems: "center", gap: 7, whiteSpace: "nowrap" }}>
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="card">
          {activeTab === "company"   && <CompanyTab />}
          {activeTab === "documents" && <DocumentsTab />}
          {activeTab === "persons"   && <PersonsTab />}
          {activeTab === "notifications" && <NotificationsTab />}
          {activeTab === "rules"     && <RulesTab />}
        </div>

        {/* Toast */}
        {toast && (
          <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999, background: "#111827", color: "#fff", padding: "12px 18px", borderRadius: 12, fontSize: "0.82rem", fontWeight: 600, boxShadow: "0 12px 32px rgba(0,0,0,.28)", display: "flex", alignItems: "center", gap: 9 }}>
            <Check size={15} color="#7ee2b8" /> {toast}
          </div>
        )}
      </div>
    </SettingsBus.Provider>
  );
}
