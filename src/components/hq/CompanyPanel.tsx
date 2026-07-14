"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Building2, Upload, Check, Save, Palette, Download,
  MapPin, Type, Image as ImageIcon,
} from "lucide-react";
import { fileToResizedDataURL } from "@/lib/imageResize";
import { useReportSection } from "@/lib/settingsBus";

const PROFILE_KEY  = "hq_company_profile";
const LOGO_KEY     = "hq_company_logo";      // สัญลักษณ์ (ไอคอน) → แถบเมนู
const WORDMARK_KEY = "hq_company_wordmark";  // พร้อมชื่อ (แนวนอน) → เอกสาร/สื่อ

type CompanyProfile = {
  name: string; address: string; taxId: string;
  phone: string; email: string; website: string;
};

const PROFILE_DEFAULT: CompanyProfile = {
  name: "บริษัท เบนจามิน พรี-เอนจิเนียร์ บิลดิ้ง จำกัด",
  address: "123 ถ.รัชดาภิเษก แขวงห้วยขวาง เขตห้วยขวาง กรุงเทพมหานคร 10310",
  taxId: "0105XXXXXXXXX",
  phone: "02-000-0000",
  email: "info@benjamin.co.th",
  website: "www.benjamin.co.th",
};

const CI_COLORS = [
  { name: "Dark Blue",  code: "#003366", note: "สีหลักของแบรนด์" },
  { name: "Steel Gray", code: "#2D2D2D", note: "สีรอง / ตัวอักษรเข้ม" },
  { name: "Silver",     code: "#C0C0C0", note: "สีเสริม / เส้นแบ่ง" },
  { name: "White",      code: "#FFFFFF", note: "พื้นหลัง / พื้นที่ว่าง" },
];

type Branch = { name: string; region: string; address: string; status: "เปิดทำการ" | "เร็วๆ นี้" };
const BRANCHES: Branch[] = [
  { name: "สำนักงานใหญ่ (กรุงเทพฯ)", region: "ภาคกลาง",      address: "ถ.รัชดาภิเษก เขตห้วยขวาง กทม.", status: "เปิดทำการ" },
  { name: "สาขาเชียงใหม่",           region: "ภาคเหนือ",      address: "ถ.ซุปเปอร์ไฮเวย์ อ.เมือง เชียงใหม่", status: "เปิดทำการ" },
  { name: "สาขาขอนแก่น",             region: "ภาคตะวันออกเฉียงเหนือ", address: "ถ.มิตรภาพ อ.เมือง ขอนแก่น", status: "เปิดทำการ" },
  { name: "สาขาชลบุรี",              region: "ภาคตะวันออก",   address: "ถ.สุขุมวิท อ.ศรีราชา ชลบุรี",  status: "เปิดทำการ" },
  { name: "สาขาสุราษฎร์ธานี",        region: "ภาคใต้",        address: "ถ.ตลาดใหม่ อ.เมือง สุราษฎร์ธานี", status: "เปิดทำการ" },
  { name: "สาขานครราชสีมา",          region: "ภาคตะวันออกเฉียงเหนือ", address: "ถ.มิตรภาพ อ.เมือง นครราชสีมา", status: "เร็วๆ นี้" },
];

export function CompanyPanel({ embedded }: { embedded?: boolean } = {}) {
  const [form,  setForm]  = useState<CompanyProfile>(PROFILE_DEFAULT);
  const [logo,  setLogo]  = useState("");
  const [wordmark, setWordmark] = useState("");
  const [saved, setSaved] = useState(false);
  const [baseline, setBaseline] = useState(""); // สแนปช็อตค่าที่บันทึกล่าสุด → ใช้เทียบ dirty (โหมดฝัง)
  const fileRef = useRef<HTMLInputElement>(null);
  const wordmarkRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let f = PROFILE_DEFAULT, l = "", w = "";
    const s = localStorage.getItem(PROFILE_KEY);
    if (s) try { f = { ...PROFILE_DEFAULT, ...JSON.parse(s) }; } catch {}
    const ls = localStorage.getItem(LOGO_KEY); if (ls) l = ls;
    const ws = localStorage.getItem(WORDMARK_KEY); if (ws) w = ws;
    setForm(f); setLogo(l); setWordmark(w);
    setBaseline(JSON.stringify({ form: f, logo: l, wordmark: w }));
  }, []);

  function set<K extends keyof CompanyProfile>(k: K, v: CompanyProfile[K]) {
    setForm(p => ({ ...p, [k]: v }));
    setSaved(false);
  }
  const save = useCallback(() => {
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(form));
      if (logo) localStorage.setItem(LOGO_KEY, logo);
      else localStorage.removeItem(LOGO_KEY);
      if (wordmark) localStorage.setItem(WORDMARK_KEY, wordmark);
      else localStorage.removeItem(WORDMARK_KEY);
    } catch {
      alert("บันทึกไม่สำเร็จ — รูปโลโก้มีขนาดใหญ่เกินไป กรุณาใช้รูปที่เล็กลง");
      return;
    }
    window.dispatchEvent(new Event("bpms-company-updated")); // ให้ Sidebar HQ อัปเดตโลโก้ทันที
    setBaseline(JSON.stringify({ form, logo, wordmark }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }, [form, logo, wordmark]);
  async function uploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogo(await fileToResizedDataURL(file, 256)); setSaved(false); // ย่อก่อนเก็บ กัน quota เต็ม
  }
  async function uploadWordmark(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setWordmark(await fileToResizedDataURL(file, 480)); setSaved(false);
  }
  // โหมดฝังในหน้าตั้งค่า → รายงาน {dirty,save,reset} ให้ปุ่มบันทึกกลาง (ไม่มีปุ่มของตัวเอง = ไม่ซ้ำ)
  const dirty = baseline !== "" && JSON.stringify({ form, logo, wordmark }) !== baseline;
  const reset = useCallback(() => {
    if (!baseline) return;
    try { const b = JSON.parse(baseline); setForm(b.form); setLogo(b.logo); setWordmark(b.wordmark); } catch {}
  }, [baseline]);
  // standalone (/hq/company) ไม่มี Provider → report เป็น no-op โดยปริยาย ปลอดภัย
  useReportSection(useMemo(() => ({ dirty, save, reset }), [dirty, save, reset]));
  const initials = form.name.replace(/^บริษัท\s*/, "").trim().slice(0, 2).toUpperCase() || "BJ";

  return (
    <div className="erp">
      {!embedded && (
        <div className="page-head">
          <div>
            <p>ข้อมูลบริษัทเบนจามินและสินทรัพย์แบรนด์</p>
          </div>
        </div>
      )}

      {/* ── ข้อมูลบริษัท ─────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div>
            <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Building2 size={16} style={{ color: "var(--primary)" }} /> ข้อมูลบริษัท
            </div>
            <div className="card-desc">ข้อมูลองค์กรของเบนจามิน HQ สำหรับใช้อ้างอิงในเอกสารและระบบ</div>
          </div>
        </div>
        <div className="card-body">

          {/* Logo 2 แบบ — สัญลักษณ์ + พร้อมชื่อ */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(280px,100%), 1fr))", gap: 18, marginBottom: 24 }}>
            {/* สัญลักษณ์ */}
            <div>
              <label className="form-label">โลโก้สัญลักษณ์ (ไอคอน)</label>
              <div style={{ fontSize: "0.65rem", color: "var(--muted-foreground)", marginBottom: 8 }}>ใช้ในแถบเมนูและพื้นที่สี่เหลี่ยม</div>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{
                  width: 80, height: 80, borderRadius: 12, flexShrink: 0,
                  background: logo ? "#fff" : "#003366", padding: logo ? 6 : 0,
                  border: "2px dashed var(--border)",
                  display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
                }}>
                  {logo
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={logo} alt="logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                    : <span style={{ color: "#fff", fontWeight: 900, fontSize: "1.15rem" }}>{initials}</span>}
                </div>
                <div>
                  <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>
                    <Upload size={13} /> อัปโหลด
                  </button>
                  {logo && (
                    <button className="btn btn-ghost btn-sm" style={{ marginLeft: 6 }}
                      onClick={() => { setLogo(""); localStorage.removeItem(LOGO_KEY); window.dispatchEvent(new Event("bpms-company-updated")); }}>
                      ลบ
                    </button>
                  )}
                  <div style={{ fontSize: "0.65rem", color: "var(--muted-foreground)", marginTop: 5 }}>PNG, JPG · แนะนำ 400×400 px</div>
                  <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={uploadLogo} />
                </div>
              </div>
            </div>

            {/* พร้อมชื่อ */}
            <div>
              <label className="form-label">โลโก้พร้อมชื่อบริษัท (แนวนอน)</label>
              <div style={{ fontSize: "0.65rem", color: "var(--muted-foreground)", marginBottom: 8 }}>ใช้บนเอกสารและสื่อการขาย</div>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{
                  width: 168, height: 80, borderRadius: 12, flexShrink: 0, padding: 8,
                  background: "#fff", border: "2px dashed var(--border)",
                  display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
                }}>
                  {wordmark
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={wordmark} alt="wordmark" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                    : <span style={{ color: "#c7ccd3", fontWeight: 700, fontSize: "0.72rem", textAlign: "center" }}>ยังไม่มีโลโก้พร้อมชื่อ</span>}
                </div>
                <div>
                  <button className="btn btn-secondary btn-sm" onClick={() => wordmarkRef.current?.click()}>
                    <Upload size={13} /> อัปโหลด
                  </button>
                  {wordmark && (
                    <button className="btn btn-ghost btn-sm" style={{ marginLeft: 6 }}
                      onClick={() => { setWordmark(""); localStorage.removeItem(WORDMARK_KEY); setSaved(false); }}>
                      ลบ
                    </button>
                  )}
                  <div style={{ fontSize: "0.65rem", color: "var(--muted-foreground)", marginTop: 5 }}>PNG พื้นโปร่งใส · แนะนำ 480×160 px</div>
                  <input ref={wordmarkRef} type="file" accept="image/*" style={{ display: "none" }} onChange={uploadWordmark} />
                </div>
              </div>
            </div>
          </div>

          {/* Fields */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div style={{ gridColumn: "1/-1" }}>
              <label className="form-label">ชื่อบริษัท</label>
              <input className="form-input" value={form.name} onChange={e => set("name", e.target.value)} />
            </div>
            <div>
              <label className="form-label">เลขประจำตัวผู้เสียภาษี</label>
              <input className="form-input" value={form.taxId} onChange={e => set("taxId", e.target.value)} placeholder="0105XXXXXXXXX" />
            </div>
            <div>
              <label className="form-label">โทรศัพท์</label>
              <input className="form-input" value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="02-000-0000" />
            </div>
            <div>
              <label className="form-label">อีเมล</label>
              <input className="form-input" value={form.email} onChange={e => set("email", e.target.value)} placeholder="info@example.co.th" />
            </div>
            <div>
              <label className="form-label">เว็บไซต์</label>
              <input className="form-input" value={form.website} onChange={e => set("website", e.target.value)} placeholder="www.example.co.th" />
            </div>
          </div>
          <div style={{ marginBottom: 28 }}>
            <label className="form-label">ที่อยู่</label>
            <textarea className="form-textarea" value={form.address} rows={3}
              onChange={e => set("address", e.target.value)}
              placeholder="ที่อยู่เต็ม รวมจังหวัดและรหัสไปรษณีย์"
              style={{ resize: "vertical" }} />
          </div>

          {/* โหมดฝัง → ใช้ปุ่มบันทึกกลางบนหัวหน้าตั้งค่า (ไม่มีปุ่มของตัวเอง = ไม่ซ้ำ) */}
          {!embedded && (
            <div style={{ display: "flex", justifyContent: "flex-end", borderTop: "1px solid var(--border)", paddingTop: 16 }}>
              <button className="btn btn-primary btn-md" onClick={save}>
                {saved ? <><Check size={14} /> บันทึกแล้ว</> : <><Save size={14} /> บันทึก</>}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── สินทรัพย์แบรนด์ (Brand Assets) ───────────────────────── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div>
            <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Palette size={16} style={{ color: "var(--primary)" }} /> สินทรัพย์แบรนด์ (Brand Assets)
            </div>
            <div className="card-desc">โลโก้ สีองค์กร (CI) และฟอนต์มาตรฐานของแบรนด์เบนจามิน</div>
          </div>
        </div>
        <div className="card-body">

          {/* Logo / CI */}
          <div style={{ marginBottom: 28 }}>
            <label className="form-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <ImageIcon size={13} /> โลโก้ / CI
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{
                width: 96, height: 96, borderRadius: 12, flexShrink: 0,
                background: logo ? "#fff" : "#003366",
                border: "1px solid var(--border)",
                display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
              }}>
                {logo
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={logo} alt="brand logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  : <span style={{ color: "#fff", fontWeight: 900, fontSize: "1.3rem", letterSpacing: "0.04em" }}>{initials}</span>}
              </div>
              <div>
                <button className="btn btn-secondary btn-sm" disabled={!logo}
                  style={!logo ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
                  onClick={() => { if (!logo) return; const a = document.createElement("a"); a.href = logo; a.download = "brand-logo"; document.body.appendChild(a); a.click(); document.body.removeChild(a); }}>
                  <Download size={13} /> ดาวน์โหลดโลโก้
                </button>
                <div style={{ fontSize: "0.65rem", color: "var(--muted-foreground)", marginTop: 6, lineHeight: 1.5 }}>
                  ไฟล์โลโก้มาตรฐานสำหรับใช้บนเอกสารและสื่อการขาย<br />รองรับ PNG (พื้นโปร่งใส) และ SVG
                </div>
              </div>
            </div>
          </div>

          {/* CI Colors */}
          <div style={{ marginBottom: 28 }}>
            <label className="form-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Palette size={13} /> สีแบรนด์ (Corporate Identity)
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
              {CI_COLORS.map(c => (
                <div key={c.code} style={{
                  border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden",
                  display: "flex", flexDirection: "column",
                }}>
                  <div style={{
                    height: 64, background: c.code,
                    borderBottom: c.code.toUpperCase() === "#FFFFFF" ? "1px solid var(--border)" : "none",
                  }} />
                  <div style={{ padding: "10px 12px" }}>
                    <div style={{ fontWeight: 700, fontSize: "0.8rem", color: "var(--foreground)" }}>{c.name}</div>
                    <div style={{
                      fontSize: "0.72rem", color: "var(--muted-foreground)",
                      fontFamily: "monospace", marginTop: 2, letterSpacing: "0.02em",
                    }}>{c.code}</div>
                    <div style={{ fontSize: "0.65rem", color: "var(--muted-foreground)", marginTop: 4 }}>{c.note}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Font */}
          <div>
            <label className="form-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Type size={13} /> ฟอนต์มาตรฐาน
            </label>
            <div style={{
              border: "1px solid var(--border)", borderRadius: 12, padding: "16px 18px",
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap",
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--foreground)" }}>Noto Sans Thai</div>
                <div style={{ fontSize: "0.72rem", color: "var(--muted-foreground)", marginTop: 2 }}>ฟอนต์หลักสำหรับเอกสารและสื่อทั้งหมด</div>
              </div>
              <div style={{ fontSize: "1.5rem", color: "var(--primary)", fontWeight: 800 }}>
                กขค Aa 123
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── สาขา (Branches) ──────────────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <MapPin size={16} style={{ color: "var(--primary)" }} /> สาขา (Branches)
            </div>
            <div className="card-desc">เครือข่ายสาขาของเบนจามินทั่วประเทศ</div>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <colgroup>
              <col style={{ width: "26%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "48%" }} />
              <col style={{ width: "10%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>ชื่อสาขา</th>
                <th>ภาค</th>
                <th>ที่อยู่</th>
                <th style={{ textAlign: "right" }}>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {BRANCHES.map((b, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600 }}>{b.name}</td>
                  <td style={{ color: "var(--muted-foreground)" }}>{b.region}</td>
                  <td style={{ color: "var(--muted-foreground)" }}>{b.address}</td>
                  <td style={{ textAlign: "right" }}>
                    <span className="badge" style={
                      b.status === "เปิดทำการ"
                        ? { background: "#ecfdf5", color: "#059669" }
                        : { background: "#f1f5f9", color: "#64748b" }
                    }>
                      {b.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
