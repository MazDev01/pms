"use client";

import { useState, useEffect, useRef } from "react";
import { Building2, Save, Check, Upload, MapPin, Phone, Mail, Globe, Hash } from "lucide-react";

// ── Tokens (CI) ───────────────────────────────────────────────
const PRIMARY = "#003366";

// ใช้คีย์เดียวกับใบเสนอราคา (ออกในนามบริษัทดีลเลอร์) เพื่อให้ข้อมูลตรงกัน
const STORE_KEY = "dealer_issuer_profile";
const LOGO_KEY  = "dealer_company_logo";

type Profile = { company: string; address: string; phone: string; email: string; website: string; taxId: string };
const EMPTY: Profile = { company: "", address: "", phone: "", email: "", website: "", taxId: "" };

export default function CompanyProfilePage() {
  const [form, setForm] = useState<Profile>(EMPTY);
  const [logo, setLogo] = useState<string>("");
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const s = localStorage.getItem(STORE_KEY);
    if (s) { try { setForm({ ...EMPTY, ...JSON.parse(s) }); } catch {} }
    const l = localStorage.getItem(LOGO_KEY);
    if (l) setLogo(l);
  }, []);

  function set<K extends keyof Profile>(k: K, v: Profile[K]) { setForm(p => ({ ...p, [k]: v })); setSaved(false); }

  function save() {
    localStorage.setItem(STORE_KEY, JSON.stringify(form));
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

  const initials = (form.company || "บริษัทของคุณ").trim().slice(0, 2).toUpperCase();

  return (
    <div className="erp" style={{ maxWidth: 880, margin: "0 auto" }}>
      {/* Header */}
      <div className="page-head">
        <div>
          <h2>โปรไฟล์บริษัท</h2>
          <p>ข้อมูลบริษัทของคุณ — ใช้ออกใบเสนอราคาและเอกสารในนามตนเอง (ไม่ใช่เบญจมินทร์)</p>
        </div>
      </div>

      {/* Identity banner */}
      <div className="card" style={{ marginBottom: 16, background: PRIMARY, border: "none" }}>
        <div className="card-body" style={{ padding: "22px 24px", display: "flex", alignItems: "center", gap: 18 }}>
          <div onClick={() => fileRef.current?.click()} title="อัปโหลดโลโก้"
            style={{ width: 72, height: 72, borderRadius: 16, flexShrink: 0, background: "rgba(255,255,255,.12)", border: "2px solid rgba(255,255,255,.25)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden" }}>
            {logo
              ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={logo} alt="logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              : <span style={{ fontSize: "1.5rem", fontWeight: 900, color: "#fff" }}>{initials}</span>}
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={uploadLogo} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#fff", lineHeight: 1.2 }}>{form.company || "ยังไม่ได้ตั้งชื่อบริษัท"}</div>
            <div style={{ fontSize: "0.74rem", color: "rgba(255,255,255,.7)", marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
              <MapPin size={12} /> {form.address ? form.address.split("\n")[0] : "เพิ่มที่อยู่บริษัท"}
            </div>
          </div>
          <button onClick={() => fileRef.current?.click()} className="btn btn-sm" style={{ background: "rgba(255,255,255,.14)", color: "#fff", border: "1px solid rgba(255,255,255,.25)", flexShrink: 0 }}>
            <Upload size={13} /> เปลี่ยนโลโก้
          </button>
        </div>
      </div>

      {/* Form */}
      <div className="card">
        <div className="card-header">
          <div className="card-title" style={{ color: PRIMARY, display: "flex", alignItems: "center", gap: 7 }}>
            <Building2 size={16} /> ข้อมูลบริษัท
          </div>
        </div>
        <div className="card-body">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="form-label">ชื่อบริษัท *</label>
              <input value={form.company} onChange={e => set("company", e.target.value)} placeholder="เช่น บริษัท สตีลโปร เอ็นจิเนียริ่ง จำกัด" className="form-input" />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="form-label"><MapPin size={11} style={{ display: "inline", marginRight: 4, verticalAlign: "-1px" }} />ที่อยู่</label>
              <textarea value={form.address} onChange={e => set("address", e.target.value)} rows={2} placeholder="ที่อยู่สำหรับออกเอกสาร..." className="form-textarea" style={{ resize: "vertical" }} />
            </div>
            <div>
              <label className="form-label"><Phone size={11} style={{ display: "inline", marginRight: 4, verticalAlign: "-1px" }} />โทรศัพท์</label>
              <input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="0x-xxx-xxxx" className="form-input" />
            </div>
            <div>
              <label className="form-label"><Mail size={11} style={{ display: "inline", marginRight: 4, verticalAlign: "-1px" }} />อีเมล</label>
              <input value={form.email} onChange={e => set("email", e.target.value)} placeholder="contact@company.co.th" className="form-input" />
            </div>
            <div>
              <label className="form-label"><Globe size={11} style={{ display: "inline", marginRight: 4, verticalAlign: "-1px" }} />เว็บไซต์</label>
              <input value={form.website} onChange={e => set("website", e.target.value)} placeholder="www.company.co.th" className="form-input" />
            </div>
            <div>
              <label className="form-label"><Hash size={11} style={{ display: "inline", marginRight: 4, verticalAlign: "-1px" }} />เลขผู้เสียภาษี</label>
              <input value={form.taxId} onChange={e => set("taxId", e.target.value)} placeholder="0-0000-00000-00-0" className="form-input" />
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 22, paddingTop: 18, borderTop: "1px solid var(--border)" }}>
            <button onClick={save} disabled={!form.company.trim()}
              className="btn btn-primary btn-lg"
              style={{ opacity: form.company.trim() ? 1 : 0.55, cursor: form.company.trim() ? "pointer" : "not-allowed" }}>
              {saved ? <><Check size={15} /> บันทึกแล้ว</> : <><Save size={15} /> บันทึกข้อมูล</>}
            </button>
            {saved && <span style={{ fontSize: "0.76rem", color: "#059669", fontWeight: 600 }}>อัปเดตข้อมูลบริษัทเรียบร้อย — ใบเสนอราคาจะออกในนามนี้</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
