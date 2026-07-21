"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Building2, Check, Save, MapPin, Image as ImageIcon } from "lucide-react";
import { useReportSection } from "@pms/shared/lib/settingsBus";

// โลโก้ Benjamin เป็นแบรนด์มาตรฐานเดียว (ไฟล์ static) — ไม่มีคีย์เก็บโลโก้ที่อัปโหลดอีกแล้ว
// ตัดทิ้งตามสเปก Enterprise: การ์ด "สินทรัพย์แบรนด์" (โลโก้ดาวน์โหลด / สี CI / ฟอนต์)
//   — เป็นการตั้งค่าธีม/สี/ฟอนต์ ซึ่งสเปกสั่งเอาออกทั้งหมด
const PROFILE_KEY = "hq_company_profile";

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

// hq: true = แถวสำนักงานใหญ่ → ที่อยู่มาจากช่อง "ที่อยู่" ด้านบนเสมอ ไม่เก็บซ้ำที่นี่
// (เดิมฝังที่อยู่ กทม. ไว้ตรงนี้อีกชุด → แก้ที่อยู่บริษัทแล้วแถวนี้ยังโชว์ของเก่า)
type Branch = { name: string; region: string; address?: string; hq?: boolean; status: "เปิดทำการ" | "เร็วๆ นี้" };
const BRANCHES: Branch[] = [
  { name: "สำนักงานใหญ่ (กรุงเทพฯ)", region: "ภาคกลาง",      hq: true, status: "เปิดทำการ" },
  { name: "สาขาเชียงใหม่",           region: "ภาคเหนือ",      address: "ถ.ซุปเปอร์ไฮเวย์ อ.เมือง เชียงใหม่", status: "เปิดทำการ" },
  { name: "สาขาขอนแก่น",             region: "ภาคตะวันออกเฉียงเหนือ", address: "ถ.มิตรภาพ อ.เมือง ขอนแก่น", status: "เปิดทำการ" },
  { name: "สาขาชลบุรี",              region: "ภาคตะวันออก",   address: "ถ.สุขุมวิท อ.ศรีราชา ชลบุรี",  status: "เปิดทำการ" },
  { name: "สาขาสุราษฎร์ธานี",        region: "ภาคใต้",        address: "ถ.ตลาดใหม่ อ.เมือง สุราษฎร์ธานี", status: "เปิดทำการ" },
  { name: "สาขานครราชสีมา",          region: "ภาคตะวันออกเฉียงเหนือ", address: "ถ.มิตรภาพ อ.เมือง นครราชสีมา", status: "เร็วๆ นี้" },
];

export function CompanyPanel({ embedded }: { embedded?: boolean } = {}) {
  const [form,  setForm]  = useState<CompanyProfile>(PROFILE_DEFAULT);
  const [saved, setSaved] = useState(false);
  const [baseline, setBaseline] = useState(""); // สแนปช็อตค่าที่บันทึกล่าสุด → ใช้เทียบ dirty (โหมดฝัง)

  useEffect(() => {
    let f = PROFILE_DEFAULT;
    const s = localStorage.getItem(PROFILE_KEY);
    if (s) try { f = { ...PROFILE_DEFAULT, ...JSON.parse(s) }; } catch {}
    setForm(f);
    setBaseline(JSON.stringify({ form: f }));
  }, []);

  function set<K extends keyof CompanyProfile>(k: K, v: CompanyProfile[K]) {
    setForm(p => ({ ...p, [k]: v }));
    setSaved(false);
  }
  const save = useCallback(() => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(form));
    window.dispatchEvent(new Event("bpms-company-updated")); // ให้ Sidebar HQ อัปเดตชื่อทันที
    setBaseline(JSON.stringify({ form }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }, [form]);
  // โหมดฝังในหน้าตั้งค่า → รายงาน {dirty,save,reset} ให้ปุ่มบันทึกกลาง (ไม่มีปุ่มของตัวเอง = ไม่ซ้ำ)
  const dirty = baseline !== "" && JSON.stringify({ form }) !== baseline;
  const reset = useCallback(() => {
    if (!baseline) return;
    try { const b = JSON.parse(baseline); setForm(b.form); } catch {}
  }, [baseline]);
  // standalone (/hq/company) ไม่มี Provider → report เป็น no-op โดยปริยาย ปลอดภัย
  useReportSection(useMemo(() => ({ dirty, save, reset }), [dirty, save, reset]));

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

          {/* โลโก้ Benjamin — มาตรฐานเดียว ดูอย่างเดียว
              ห้ามอัปโหลด / ห้ามหลายรูปแบบ (vertical/icon/landscape) / ห้ามเปลี่ยนแบรนด์
              หมายเหตุ: ปุ่มอัปโหลดเดิมไม่มีผลอยู่แล้ว — แถบเมนูใช้ /benjamin-logo-white.png ตายตัวเสมอ */}
          <div style={{ marginBottom: 24 }}>
            <label className="form-label">โลโก้ Benjamin</label>
            <div style={{ fontSize: "0.65rem", color: "var(--muted-foreground)", marginBottom: 8 }}>แบรนด์มาตรฐานเดียวของทั้งระบบ</div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div style={{
                width: 80, height: 80, borderRadius: 12, flexShrink: 0, background: "#003366",
                border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/benjamin-logo-white.png" alt="Benjamin" style={{ width: 44, height: 44, objectFit: "contain", filter: "brightness(0) invert(1)" }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#f5f7fa", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 14px", fontSize: "0.76rem", color: "#6b7280" }}>
                <ImageIcon size={14} color="#003366" style={{ flexShrink: 0 }} />
                ใช้โลโก้ Benjamin มาตรฐานเดียวทั้งระบบ — เปลี่ยน/อัปโหลดโลโก้อื่นไม่ได้
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
                  {/* สำนักงานใหญ่ = ที่อยู่เดียวกับช่องด้านบน (แหล่งเดียว) — ยังไม่กรอก = "—" ไม่เดา */}
                  <td style={{ color: "var(--muted-foreground)" }}>{(b.hq ? form.address.trim() : b.address) || "—"}</td>
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
