"use client";

import { useState, useRef, useEffect } from "react";
import {
  Building2, Plus, Pencil, Trash2, X, Check, Save,
  Upload, UserCheck, FileText, Info, ShieldCheck, Lock,
} from "lucide-react";
import { responsiblePersons as RP_INITIAL, RP_STORAGE_KEY, LOST_REASONS, type ResponsiblePerson } from "@/lib/mock";

type SettingTab = "company" | "documents" | "persons" | "rules";

const TABS: { key: SettingTab; label: string; icon: React.ReactNode }[] = [
  { key: "company",   label: "โปรไฟล์บริษัท",     icon: <Building2 size={15} /> },
  { key: "documents", label: "ตั้งค่าใบเสนอราคา", icon: <FileText  size={15} /> },
  { key: "persons",   label: "ผู้รับผิดชอบ",       icon: <UserCheck size={15} /> },
  { key: "rules",     label: "กฎการขาย",           icon: <ShieldCheck size={15} /> },
];

// ─────────────────────────────────────────────────────────────────────────────
// COMPANY PROFILE TAB
// ─────────────────────────────────────────────────────────────────────────────
const COMPANY_KEY = "dealer_issuer_profile";
const LOGO_KEY    = "dealer_company_logo";
type CompanyProfile = { company: string; address: string; phone: string; email: string; website: string; taxId: string };
const COMPANY_EMPTY: CompanyProfile = { company: "", address: "", phone: "", email: "", website: "", taxId: "" };

function CompanyTab() {
  const [form, setForm] = useState<CompanyProfile>(COMPANY_EMPTY);
  const [logo, setLogo] = useState<string>("");
  const [saved, setSaved]   = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const s = localStorage.getItem(COMPANY_KEY);
    if (s) try { setForm({ ...COMPANY_EMPTY, ...JSON.parse(s) }); } catch {}
    const l = localStorage.getItem(LOGO_KEY);
    if (l) setLogo(l);
  }, []);

  function set<K extends keyof CompanyProfile>(k: K, v: CompanyProfile[K]) {
    setForm(p => ({ ...p, [k]: v }));
    setSaved(false);
  }
  function save() {
    localStorage.setItem(COMPANY_KEY, JSON.stringify(form));
    if (logo) localStorage.setItem(LOGO_KEY, logo);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }
  function uploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { setLogo(ev.target?.result as string); setSaved(false); };
    reader.readAsDataURL(file);
  }
  const initials = (form.company || "บริษัท").trim().slice(0, 2).toUpperCase();

  return (
    <>
      <div className="card-header">
        <div>
          <div className="card-title">โปรไฟล์บริษัท</div>
          <div className="card-desc">ข้อมูลสำหรับออกใบเสนอราคาและเอกสารในนามสาขา</div>
        </div>
      </div>
      <div className="card-body">
        {/* Business rule callout */}
        <div style={{
          display: "flex", gap: 12, padding: "13px 16px", marginBottom: 22,
          background: "#f0f4fa", border: "1px solid #dce5f0", borderLeft: "3px solid #003366", borderRadius: 10,
        }}>
          <Info size={18} style={{ color: "#003366", flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: "0.76rem", color: "#374151", lineHeight: 1.6 }}>
            เอกสารและใบเสนอราคาจะใช้<strong style={{ color: "#003366" }}>ข้อมูลบริษัทของสาขา</strong>นี้เท่านั้น —
            ข้อมูลบริษัทเบนจามิน (HQ) จะ<strong style={{ color: "#003366" }}>ไม่ปรากฏ</strong>บนใบเสนอราคาของสาขา
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label className="form-label">โลโก้บริษัท</label>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 80, height: 80, borderRadius: 12,
              background: logo ? "transparent" : "#003366", border: "2px dashed #e5e7eb",
              display: "flex", alignItems: "center", justifyContent: "center",
              overflow: "hidden", flexShrink: 0 }}>
              {logo
                ? <img src={logo} alt="logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                : <span style={{ color: "#fff", fontWeight: 900, fontSize: "1.1rem" }}>{initials}</span>}
            </div>
            <div>
              <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>
                <Upload size={13} /> อัปโหลดโลโก้
              </button>
              {logo && (
                <button className="btn btn-ghost btn-sm" style={{ marginLeft: 6 }}
                  onClick={() => { setLogo(""); localStorage.removeItem(LOGO_KEY); }}>
                  ลบ
                </button>
              )}
              <div style={{ fontSize: "0.68rem", color: "#9ca3af", marginTop: 5 }}>PNG, JPG · แนะนำ 200×200 px</div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={uploadLogo} />
            </div>
          </div>
        </div>

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
            <label className="form-label">อีเมล</label>
            <input className="form-input" type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="info@example.co.th" />
          </div>
          <div>
            <label className="form-label">โทรศัพท์</label>
            <input className="form-input" value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="02-000-0000" />
          </div>
          <div>
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

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button className="btn btn-primary btn-md" onClick={save}>
            {saved ? <><Check size={14} /> บันทึกแล้ว</> : <><Save size={14} /> บันทึก</>}
          </button>
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
  runningNumber: number;
  vatPercent: number;
  termsAndConditions: string;
  header: string;
  footer: string;
  stamp: string;
  signature: string;
};
const DOC_DEFAULT: DocumentSettings = {
  quotePrefix:         "Q-2026-",
  runningNumber:       1001,
  vatPercent:          7,
  termsAndConditions:
    "ราคานี้มีผลภายใน 30 วัน นับจากวันที่ออกใบเสนอราคา\n" +
    "บริษัทขอสงวนสิทธิ์เปลี่ยนแปลงราคาโดยไม่แจ้งล่วงหน้า\n" +
    "การยืนยันการสั่งซื้อจะมีผลเมื่อได้รับเงินมัดจำเท่านั้น",
  header:    "",
  footer:    "ขอบคุณที่ไว้วางใจ Benjamin Pre-Engineered Building",
  stamp:     "",
  signature: "",
};

function ImageUploadBox({
  label, hint, value, onChange,
}: { label: string; hint: string; value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => onChange(ev.target?.result as string);
    reader.readAsDataURL(file);
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
          <span style={{ fontSize: "0.67rem", color: "#9ca3af" }}>PNG, JPG · โปร่งใสได้</span>
        </div>
      </div>
      <input ref={ref} type="file" accept="image/*" style={{ display: "none" }} onChange={upload} />
    </div>
  );
}

function DocumentsTab() {
  const [doc, setDoc] = useState<DocumentSettings>(DOC_DEFAULT);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const s = localStorage.getItem(DOCUMENT_KEY);
    if (s) try { setDoc({ ...DOC_DEFAULT, ...JSON.parse(s) }); } catch {}
  }, []);

  function set<K extends keyof DocumentSettings>(k: K, v: DocumentSettings[K]) {
    setDoc(p => ({ ...p, [k]: v }));
    setSaved(false);
  }
  function save() {
    localStorage.setItem(DOCUMENT_KEY, JSON.stringify(doc));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const previewNo = `${doc.quotePrefix}${String(doc.runningNumber).padStart(4, "0")}`;

  return (
    <>
      <div className="card-header">
        <div>
          <div className="card-title">ตั้งค่าใบเสนอราคา</div>
          <div className="card-desc">คำนำหน้า เลขรันนิ่ง หัว/ท้าย เงื่อนไข ตราประทับ และลายเซ็น</div>
        </div>
      </div>
      <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 22 }}>

        {/* Quote number format */}
        <div>
          <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "#003366", letterSpacing: "0.05em", marginBottom: 12,
            textTransform: "uppercase" }}>
            เลขที่ใบเสนอราคา
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(150px, 180px) minmax(110px, 150px) minmax(90px, 120px) minmax(0, 1fr)", gap: 12, alignItems: "end" }}>
            <div>
              <label className="form-label">คำนำหน้าเลขที่ใบเสนอราคา</label>
              <input className="form-input" value={doc.quotePrefix} maxLength={16}
                onChange={e => set("quotePrefix", e.target.value)}
                placeholder="Q-2026-" style={{ fontFamily: "monospace" }} />
            </div>
            <div>
              <label className="form-label">เลขลำดับปัจจุบัน</label>
              <input className="form-input" type="number" value={doc.runningNumber} min={1}
                onChange={e => set("runningNumber", Number(e.target.value))}
                style={{ fontFamily: "monospace" }} />
            </div>
            <div>
              <label className="form-label">ภาษีมูลค่าเพิ่ม %</label>
              <input className="form-input" type="number" min={0} max={100} value={doc.vatPercent}
                onChange={e => set("vatPercent", Math.max(0, Math.min(100, Number(e.target.value))))}
                style={{ fontFamily: "monospace" }} />
            </div>
            <div style={{ padding: "10px 14px", background: "#f0f4fa", borderRadius: 10, border: "1px solid #dce5f0" }}>
              <div style={{ fontSize: "0.65rem", color: "#9ca3af", marginBottom: 3 }}>ตัวอย่างเลขที่ถัดไป</div>
              <div style={{ fontFamily: "monospace", fontWeight: 800, color: "#003366", fontSize: "1rem" }}>{previewNo}</div>
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

        <div style={{ display: "flex", justifyContent: "flex-end", borderTop: "1px solid #f1f5f9", paddingTop: 16 }}>
          <button className="btn btn-primary btn-md" onClick={save}>
            {saved ? <><Check size={14} /> บันทึกแล้ว</> : <><Save size={14} /> บันทึก</>}
          </button>
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
  const [adding,    setAdding]    = useState(false);
  const [newName,   setNewName]   = useState("");
  const [newTitle,  setNewTitle]  = useState("");
  const [newPhone,  setNewPhone]  = useState("");
  const [newEmail,  setNewEmail]  = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  useEffect(() => {
    const s = localStorage.getItem(RP_STORAGE_KEY);
    if (s) try { setPersons(reindexPersons(JSON.parse(s))); } catch {}
  }, []);

  function save(updated: ResponsiblePerson[]) {
    setPersons(updated);
    localStorage.setItem(RP_STORAGE_KEY, JSON.stringify(updated));
  }
  function startEdit(p: ResponsiblePerson) {
    setEditId(p.id); setEditName(p.name); setEditTitle(p.title);
    setEditPhone(p.phone); setEditEmail(p.email);
  }
  function saveEdit() {
    save(persons.map(p => p.id === editId
      ? { ...p, name: editName, title: editTitle, phone: editPhone, email: editEmail }
      : p));
    setEditId(null);
  }
  function toggleActive(id: number) { save(persons.map(p => p.id === id ? { ...p, active: !p.active } : p)); }
  function deletePerson(id: number) { save(persons.filter(p => p.id !== id)); setDeleteConfirmId(null); }
  function addPerson() {
    if (!newName.trim()) return;
    const p: ResponsiblePerson = {
      id: Math.max(0, ...persons.map(x => x.id)) + 1, name: newName.trim(), title: newTitle.trim() || "เจ้าหน้าที่ขาย",
      phone: newPhone.trim(), email: newEmail.trim(), active: true,
    };
    save([...persons, p]);
    setNewName(""); setNewTitle(""); setNewPhone(""); setNewEmail(""); setAdding(false);
  }

  return (
    <>
      <div className="card-header">
        <div>
          <div className="card-title">ผู้รับผิดชอบ</div>
          <div className="card-desc">รายชื่อพนักงานขายที่ใช้กำกับผู้สนใจ ลูกค้า และรายงาน · ไม่ใช่ผู้ใช้ระบบ</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}><Plus size={14} /> เพิ่ม</button>
      </div>
      <div className="card-body" style={{ paddingTop: 0 }}>
        {adding && (
          <div style={{ background: "#fafafa", borderRadius: 12, border: "1px solid #e5e7eb",
            padding: "14px 16px", marginBottom: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ flex: 2, minWidth: 160 }}>
              <input className="form-input" value={newName} autoFocus onChange={e => setNewName(e.target.value)}
                placeholder="ชื่อ-นามสกุล *" onKeyDown={e => e.key === "Enter" && addPerson()} />
            </div>
            <div style={{ flex: 1, minWidth: 120 }}>
              <input className="form-input" value={newTitle} onChange={e => setNewTitle(e.target.value)}
                placeholder="ตำแหน่ง" onKeyDown={e => e.key === "Enter" && addPerson()} />
            </div>
            <div style={{ flex: 1, minWidth: 130 }}>
              <input className="form-input" value={newPhone} onChange={e => setNewPhone(e.target.value)}
                placeholder="โทรศัพท์" onKeyDown={e => e.key === "Enter" && addPerson()} />
            </div>
            <div style={{ flex: 1.5, minWidth: 160 }}>
              <input className="form-input" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                placeholder="อีเมล" onKeyDown={e => e.key === "Enter" && addPerson()} />
            </div>
            <button className="btn btn-primary btn-sm" onClick={addPerson}><Check size={13} /> บันทึก</button>
            <button className="btn btn-ghost btn-sm"
              onClick={() => { setAdding(false); setNewName(""); setNewTitle(""); setNewPhone(""); setNewEmail(""); }}>
              <X size={13} /> ยกเลิก
            </button>
          </div>
        )}

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
                    {editId === p.id
                      ? <input className="form-input" value={editName} autoFocus
                          onChange={e => setEditName(e.target.value)}
                          onKeyDown={e => e.key === "Enter" && saveEdit()} />
                      : (
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#003366",
                            flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <span style={{ color: "#fff", fontSize: "0.72rem", fontWeight: 800 }}>{p.name.charAt(0)}</span>
                          </div>
                          <span style={{ fontWeight: 600, color: p.active ? "#2D2D2D" : "#9ca3af" }}>{p.name}</span>
                        </div>
                      )}
                  </td>
                  <td>
                    {editId === p.id
                      ? <input className="form-input" value={editTitle} onChange={e => setEditTitle(e.target.value)}
                          onKeyDown={e => e.key === "Enter" && saveEdit()} />
                      : <span style={{ fontSize: "0.78rem", color: "#6b7280" }}>{p.title}</span>}
                  </td>
                  <td>
                    {editId === p.id
                      ? <input className="form-input" value={editPhone} onChange={e => setEditPhone(e.target.value)}
                          placeholder="โทรศัพท์" onKeyDown={e => e.key === "Enter" && saveEdit()} />
                      : <span style={{ fontSize: "0.78rem", color: "#6b7280" }}>{p.phone || "—"}</span>}
                  </td>
                  <td>
                    {editId === p.id
                      ? <input className="form-input" type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)}
                          placeholder="อีเมล" onKeyDown={e => e.key === "Enter" && saveEdit()} />
                      : <span style={{ fontSize: "0.78rem", color: "#6b7280" }}>{p.email || "—"}</span>}
                  </td>
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
                    {editId === p.id ? (
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <button className="btn btn-primary btn-sm" onClick={saveEdit}><Check size={13} /> บันทึก</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditId(null)}><X size={13} /></button>
                      </div>
                    ) : deleteConfirmId === p.id ? (
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
                  <td colSpan={6} style={{ padding: "28px", textAlign: "center", color: "#9ca3af", fontSize: "0.82rem" }}>
                    ยังไม่มีผู้รับผิดชอบ — กด &quot;+ เพิ่ม&quot; เพื่อเริ่มต้น
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: "0.7rem", color: "#9ca3af", marginTop: 10 }}>
          ผู้รับผิดชอบ <strong>ไม่ใช่ผู้ใช้ระบบ · Login ไม่ได้</strong> — ใช้สำหรับเลือกตอนสร้างลีดเท่านั้น
        </p>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BUSINESS RULES TAB — กติกาการขาย (บางข้อ HQ ล็อก, บางข้อ Dealer ปรับได้)
// ─────────────────────────────────────────────────────────────────────────────
const RULES_KEY = "dealer_business_rules";
const LOST_REASONS_KEY = "dealer_lost_reasons";
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

// ขั้นตอนการขายมาตรฐาน (Core Stage — HQ ล็อก ทุกสาขาเหมือนกัน)
const CORE_STAGES = ["ผู้สนใจใหม่", "ติดต่อแล้ว", "รวบรวมความต้องการ", "เสนอราคา", "เจรจา", "ปิดการขาย (Won/Lost)"];

// กติกาที่ HQ กำหนดตายตัว (อ่านอย่างเดียว)
const LOCKED_RULES = [
  "เส้นทางการขายจบที่ Won / Lost เท่านั้น — ไม่มีขั้นตอนก่อสร้าง/ผลิต/ติดตั้ง",
  "ใบเสนอราคาออกในนามบริษัทของ Dealer (ห้ามใช้ชื่อ Benjamin)",
  "ราคากลาง/แคตตาล็อกสินค้ากำหนดโดย HQ — Dealer ดูได้ แก้ไม่ได้",
  "ข้อมูลทั้งหมดเป็นทรัพย์สินของ Benjamin และ Sync ไป HQ อัตโนมัติ",
  "Responsible Person เป็นรายชื่อเซลส์ ไม่ใช่ผู้ใช้ระบบ (Login ไม่ได้)",
];

function RulesTab() {
  const [rules, setRules] = useState<BizRules>(RULES_DEFAULT);
  const [persons, setPersons] = useState<ResponsiblePerson[]>(RP_INITIAL);
  const [lostReasons, setLostReasons] = useState<string[]>([...LOST_REASONS]);
  const [newReason, setNewReason] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const s = localStorage.getItem(RULES_KEY);
    if (s) try { setRules({ ...RULES_DEFAULT, ...JSON.parse(s) }); } catch {}
    const p = localStorage.getItem(RP_STORAGE_KEY);
    if (p) try { setPersons(reindexPersons(JSON.parse(p))); } catch {}
    const lr = localStorage.getItem(LOST_REASONS_KEY);
    if (lr) try {
      const parsed = JSON.parse(lr);
      if (Array.isArray(parsed)) setLostReasons(parsed.filter((x): x is string => typeof x === "string"));
    } catch {}
  }, []);

  function set<K extends keyof BizRules>(k: K, v: BizRules[K]) { setRules(p => ({ ...p, [k]: v })); setSaved(false); }
  function saveReasons(next: string[]) { setLostReasons(next); localStorage.setItem(LOST_REASONS_KEY, JSON.stringify(next)); setSaved(false); }
  function addReason() {
    const v = newReason.trim();
    if (!v || lostReasons.includes(v)) { setNewReason(""); return; }
    saveReasons([...lostReasons, v]);
    setNewReason("");
  }
  function removeReason(r: string) { saveReasons(lostReasons.filter(x => x !== r)); }
  function save() {
    localStorage.setItem(RULES_KEY, JSON.stringify(rules));
    localStorage.setItem(LOST_REASONS_KEY, JSON.stringify(lostReasons));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const editable: { k: "quoteValidityDays" | "leadSlaHours" | "maxSelfDiscountPct" | "followUpDays"; label: string; hint: string; unit: string; max?: number }[] = [
    { k: "quoteValidityDays",  label: "อายุใบเสนอราคาเริ่มต้น (วัน)", hint: "จำนวนวันที่ราคามีผลนับจากวันออกเอกสาร", unit: "วัน" },
    { k: "followUpDays",       label: "จำนวนวันติดตามเริ่มต้น",       hint: "ระยะเวลาก่อนติดตามลูกค้าครั้งถัดไป",     unit: "วัน" },
    { k: "leadSlaHours",       label: "SLA ติดตามลีดใหม่",         hint: "ต้องติดต่อลีดใหม่ภายในกี่ชั่วโมง",       unit: "ชั่วโมง" },
    { k: "maxSelfDiscountPct", label: "ส่วนลดที่อนุมัติเองได้",     hint: "ส่วนลดสูงสุดที่เซลส์ให้ได้โดยไม่ต้องขออนุมัติ", unit: "%", max: 100 },
  ];

  return (
    <>
      <div className="card-header">
        <div>
          <div className="card-title">กฎการขาย (Business Rules)</div>
          <div className="card-desc">กติกามาตรฐานของ HQ และค่าที่สาขาปรับได้เอง</div>
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
          <p style={{ fontSize: "0.7rem", color: "#9ca3af", marginTop: 8 }}>ทุกสาขาใช้ขั้นตอนเดียวกัน · เพิ่มงานย่อย (Sales Steps) ในแต่ละขั้นได้ แต่แก้ Core Stage ไม่ได้</p>

          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 14px", marginTop: 12,
            background: "#f8fafc", border: "1px solid #eef1f5", borderLeft: "3px solid #003366", borderRadius: 10 }}>
            <Info size={15} style={{ color: "#003366", flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: "0.78rem", color: "#374151", lineHeight: 1.5 }}>
              <strong style={{ color: "#003366" }}>ไปป์ไลน์เริ่มต้น</strong> — ทุกดีลใช้เส้นทางการขายมาตรฐาน
              (Lead → Won / Lost) เพียงเส้นทางเดียว · ไม่มีไปป์ไลน์อื่นให้เลือก
            </div>
          </div>
        </div>

        {/* Editable dealer rules */}
        <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 18 }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "#003366", letterSpacing: "0.05em", marginBottom: 12, textTransform: "uppercase" }}>
            ค่าที่สาขาปรับได้
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 }}>
            {editable.map(f => (
              <div key={f.k}>
                <label className="form-label">{f.label}</label>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <input className="form-input" type="number" min={0} max={f.max} value={rules[f.k]}
                    onChange={e => set(f.k, Math.max(0, Number(e.target.value)) as BizRules[typeof f.k])}
                    style={{ fontFamily: "monospace", minWidth: 0 }} />
                  <span style={{ fontSize: "0.76rem", color: "#6b7280", flexShrink: 0 }}>{f.unit}</span>
                </div>
                <div style={{ fontSize: "0.66rem", color: "#9ca3af", marginTop: 4 }}>{f.hint}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 16, maxWidth: 360 }}>
            <label className="form-label">ผู้รับผิดชอบเริ่มต้น</label>
            <select className="form-input"
              value={rules.defaultResponsibleId ?? ""}
              onChange={e => set("defaultResponsibleId", e.target.value ? Number(e.target.value) : null)}>
              <option value="">— ไม่กำหนด —</option>
              {persons.filter(p => p.active).map(p => (
                <option key={p.id} value={p.id}>{p.name}{p.title ? ` · ${p.title}` : ""}</option>
              ))}
            </select>
            <div style={{ fontSize: "0.66rem", color: "#9ca3af", marginTop: 4 }}>ผู้รับผิดชอบที่กำหนดให้ลีดใหม่โดยอัตโนมัติเมื่อไม่ได้ระบุ</div>
          </div>
        </div>

        {/* Default lost reasons */}
        <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 18 }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "#003366", letterSpacing: "0.05em", marginBottom: 12, textTransform: "uppercase" }}>
            เหตุผลที่เสียโอกาสเริ่มต้น (Default Lost Reasons)
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 14px", marginBottom: 14,
            background: "#f8fafc", border: "1px solid #eef1f5", borderLeft: "3px solid #003366", borderRadius: 10 }}>
            <Info size={15} style={{ color: "#003366", flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: "0.78rem", color: "#374151", lineHeight: 1.5 }}>
              รายการเหตุผลเหล่านี้จะแสดงเป็นตัวเลือกเมื่อ<strong style={{ color: "#003366" }}>ปิดการขายไม่สำเร็จ (Lost)</strong> ·
              ใช้ตอนปิดดีลเป็น Lost เพื่อบันทึกสาเหตุที่เสียโอกาส
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 14 }}>
            {lostReasons.map(r => (
              <span key={r} className="badge"
                style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#dce5f0", color: "#003366" }}>
                {r}
                <button type="button" onClick={() => removeReason(r)}
                  aria-label={`ลบ ${r}`}
                  style={{ display: "inline-flex", alignItems: "center", justifyContent: "center",
                    border: "none", background: "transparent", cursor: "pointer", padding: 0, color: "#003366", lineHeight: 0 }}>
                  <X size={13} />
                </button>
              </span>
            ))}
            {lostReasons.length === 0 && (
              <span style={{ fontSize: "0.74rem", color: "#9ca3af" }}>ยังไม่มีเหตุผล — เพิ่มด้านล่าง</span>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", maxWidth: 420 }}>
            <input className="form-input" value={newReason}
              onChange={e => setNewReason(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addReason(); } }}
              placeholder="เพิ่มเหตุผลที่เสียโอกาส…" />
            <button type="button" className="btn btn-secondary btn-md" onClick={addReason} style={{ flexShrink: 0 }}>
              <Plus size={14} /> เพิ่ม
            </button>
          </div>
          <div style={{ fontSize: "0.66rem", color: "#9ca3af", marginTop: 6 }}>เพิ่มเหตุผลเฉพาะของสาขาได้ · กด × เพื่อลบออกจากรายการ</div>
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
                <span style={{ fontSize: "0.78rem", color: "#374151", lineHeight: 1.5 }}>{r}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", borderTop: "1px solid #f1f5f9", paddingTop: 16 }}>
          <button className="btn btn-primary btn-md" onClick={save}>
            {saved ? <><Check size={14} /> บันทึกแล้ว</> : <><Save size={14} /> บันทึก</>}
          </button>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingTab>("company");

  return (
    <div className="erp">
      <div className="page-head">
        <div>
          <h2>ตั้งค่า</h2>
          <p>โปรไฟล์บริษัท · ใบเสนอราคา · ผู้รับผิดชอบ · กฎการขาย ของสาขา</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="tab-bar">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`tab-item${activeTab === t.key ? " active" : ""}`}
              style={{ display: "flex", alignItems: "center", gap: 7 }}>
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
        {activeTab === "rules"     && <RulesTab />}
      </div>
    </div>
  );
}
