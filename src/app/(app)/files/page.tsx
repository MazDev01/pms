"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { initialCustomers as customers } from "@/lib/mock";
import {
  FolderOpen, Search, X, Upload, Trash2, File,
  FileText, FileSpreadsheet, Image, Plus,
  FileSignature, PenTool, Presentation, Files, Eye, Pencil,
} from "lucide-react";

const PRIMARY = "#003366";
const STEEL   = "#2D2D2D";
const BORDER  = "#e5e7eb";
const MUTED   = "#6b7280";

type FileCategory = "ใบเสนอราคา" | "แบบแปลน" | "รูปภาพ" | "นำเสนอ" | "สัญญา" | "อื่นๆ";
type FileExt = "pdf" | "docx" | "xlsx" | "dwg" | "pptx" | "jpg" | "png" | "other";

type FileMock = {
  id: number;
  name: string;
  size: string;
  ext: FileExt;
  category: FileCategory;
  project: string;
  uploadedBy: string;
  uploadedAt: string;
  customerId?: number;
};

const MOCK_FILES: FileMock[] = [
  { id: 1,  name: "ใบเสนอราคา_โกดังสำเร็จรูป_ไทยสตีล_v2.pdf", size: "1.4 MB", ext: "pdf",  category: "ใบเสนอราคา", project: "โกดังสำเร็จรูป บจ. ไทยสตีล", uploadedBy: "วิภา",     uploadedAt: "2026-06-20", customerId: 1 },
  { id: 2,  name: "สัญญาขาย_ไทยสตีล.pdf",                   size: "2.1 MB", ext: "pdf",  category: "สัญญา",      project: "โกดังสำเร็จรูป บจ. ไทยสตีล", uploadedBy: "สมชาย",   uploadedAt: "2026-06-18", customerId: 1 },
  { id: 3,  name: "ผังพื้นที่ลูกค้า_โรงงาน.pdf",             size: "8.3 MB", ext: "pdf",  category: "แบบแปลน",    project: "โรงงาน PEB เชียงใหม่",     uploadedBy: "วิชัย",   uploadedAt: "2026-06-15", customerId: 2 },
  { id: 4,  name: "presentation_VCS_Asia.pptx",             size: "5.7 MB", ext: "pptx", category: "นำเสนอ",     project: "VCS Asia Expansion",       uploadedBy: "กาญจนา", uploadedAt: "2026-06-12", customerId: 5 },
  { id: 5,  name: "สรุปราคา_คลังสินค้า_บจ.ซีซีเอส.xlsx",       size: "340 KB", ext: "xlsx", category: "ใบเสนอราคา", project: "คลังสินค้า CCS",           uploadedBy: "สมชาย",   uploadedAt: "2026-06-10", customerId: 2 },
  { id: 6,  name: "สัญญา_ลงนามแล้ว_ATC.pdf",              size: "1.8 MB", ext: "pdf",  category: "สัญญา",      project: "ATC Logistics",            uploadedBy: "ประสิทธิ์", uploadedAt: "2026-06-08" },
  { id: 7,  name: "รูปถ่ายพื้นที่_โอกาสการขายนนทบุรี.jpg",     size: "3.2 MB", ext: "jpg",  category: "รูปภาพ",     project: "โกดัง Nonthaburi Corp",    uploadedBy: "วิภา",     uploadedAt: "2026-06-05", customerId: 1 },
  { id: 8,  name: "สรุปความต้องการ_ไทยเกษตร.pdf",       size: "920 KB", ext: "pdf",  category: "อื่นๆ",      project: "อาคารไทยเกษตรพัฒนา",      uploadedBy: "สุดาวรรณ", uploadedAt: "2026-06-03" },
  { id: 9,  name: "รายละเอียดสินค้า_โกดังสำเร็จรูป.xlsx",         size: "512 KB", ext: "xlsx", category: "แบบแปลน",    project: "โรงงานสำเร็จรูป เชียงใหม่",     uploadedBy: "วิชัย",   uploadedAt: "2026-05-30", customerId: 2 },
  { id: 10, name: "quotation_Q2026-0095.pdf",               size: "1.1 MB", ext: "pdf",  category: "ใบเสนอราคา", project: "VCS Asia Expansion",       uploadedBy: "กาญจนา", uploadedAt: "2026-05-28", customerId: 5 },
  { id: 11, name: "ร่างสัญญาซื้อขาย_อาคารสำเร็จรูป.docx",                size: "520 KB", ext: "docx", category: "สัญญา",      project: "โรงงานสำเร็จรูป ซีซีเอส",              uploadedBy: "สมชาย",   uploadedAt: "2026-05-25", customerId: 2 },
  { id: 12, name: "presentation_บริษัท_2026.pptx",        size: "12.4 MB",ext: "pptx", category: "นำเสนอ",     project: "—",                        uploadedBy: "วิภา",     uploadedAt: "2026-05-20" },
  { id: 13, name: "เอกสารประกอบการเสนอราคา_อาคารเกษตร_v3.pdf",            size: "6.8 MB", ext: "pdf",  category: "แบบแปลน",    project: "อาคารไทยเกษตรพัฒนา",      uploadedBy: "วิชัย",   uploadedAt: "2026-05-18" },
  { id: 14, name: "รายงานความคืบหน้า_Q2.pdf",              size: "2.8 MB", ext: "pdf",  category: "อื่นๆ",      project: "—",                        uploadedBy: "ประสิทธิ์", uploadedAt: "2026-05-15" },
  { id: 15, name: "signed_contract_ATC.pdf",                size: "1.9 MB", ext: "pdf",  category: "สัญญา",      project: "ATC Logistics",            uploadedBy: "สุดาวรรณ", uploadedAt: "2026-05-10" },
];

const CAT_COLORS: Record<FileCategory, { bg: string; text: string }> = {
  ใบเสนอราคา: { bg: "#dce5f0", text: "#003366" },
  แบบแปลน:    { bg: "#e5faf0", text: "#059669" },
  รูปภาพ:     { bg: "#e8ecf2", text: "#475569" },
  นำเสนอ:     { bg: "#fff3cd", text: "#d97706" },
  สัญญา:      { bg: "#fde8e8", text: "#dc2626" },
  อื่นๆ:      { bg: "#f0f0f5", text: "#6b7280" },
};

const ALL_CATS: FileCategory[] = ["ใบเสนอราคา","แบบแปลน","รูปภาพ","นำเสนอ","สัญญา","อื่นๆ"];

// คอลัมน์ที่ซ่อน/แสดงได้ของตาราง (มุมมองรายการ) — คอลัมน์ "ไฟล์" กับปุ่มการทำงานคงไว้เสมอ
const COLS = [
  { key: "category", label: "โฟลเดอร์" },
  { key: "project",  label: "โอกาสการขาย" },
  { key: "size",     label: "ขนาด" },
  { key: "uploadedBy", label: "อัปโหลดโดย" },
  { key: "uploadedAt", label: "วันที่" },
];

// ไอคอนของแต่ละโฟลเดอร์
function catIcon(cat: FileCategory, size = 15) {
  const color = CAT_COLORS[cat].text;
  if (cat === "ใบเสนอราคา") return <FileText size={size} color={color} />;
  if (cat === "แบบแปลน")    return <PenTool size={size} color={color} />;
  if (cat === "รูปภาพ")     return <Image size={size} color={color} />;
  if (cat === "นำเสนอ")     return <Presentation size={size} color={color} />;
  if (cat === "สัญญา")      return <FileSignature size={size} color={color} />;
  return <Files size={size} color={color} />;
}

function extIcon(ext: FileExt) {
  const sz = 18;
  if (ext === "pdf")  return <FileText  size={sz} color="#dc2626" />;
  if (ext === "xlsx") return <FileSpreadsheet size={sz} color="#059669" />;
  if (ext === "docx") return <FileText  size={sz} color="#003366" />;
  if (ext === "pptx") return <FileText  size={sz} color="#d97706" />;
  if (ext === "dwg")  return <File      size={sz} color="#2D2D2D" />;
  if (ext === "jpg" || ext === "png") return <Image size={sz} color="#003366" />;
  return <File size={sz} color={MUTED} />;
}
function extLabel(ext: FileExt) {
  const m: Record<FileExt, string> = { pdf:"PDF", docx:"Word", xlsx:"Excel", pptx:"PowerPoint", dwg:"CAD", jpg:"รูปภาพ", png:"รูปภาพ", other:"อื่นๆ" };
  return m[ext] ?? "ไฟล์";
}
function extBg(ext: FileExt) {
  if (ext === "pdf")  return "#fee2e2";
  if (ext === "xlsx") return "#e5faf0";
  if (ext === "docx") return "#dce5f0";
  if (ext === "pptx") return "#fff3cd";
  if (ext === "dwg")  return "#eceef0";
  if (ext === "jpg" || ext === "png") return "#dce5f0";
  return "#f4f6f9";
}

function guessExt(name: string): FileExt {
  const parts = name.split(".");
  const e = (parts[parts.length - 1] || "").toLowerCase();
  if (e === "pdf") return "pdf";
  if (e === "docx" || e === "doc") return "docx";
  if (e === "xlsx" || e === "xls") return "xlsx";
  if (e === "pptx" || e === "ppt") return "pptx";
  if (e === "dwg" || e === "dxf") return "dwg";
  if (e === "jpg" || e === "jpeg") return "jpg";
  if (e === "png") return "png";
  return "other";
}

// ดาวน์โหลดเอกสาร (ระบบ frontend/mock) — สร้างไฟล์สรุปข้อมูลให้ดาวน์โหลดจริง

function UploadModal({ onUpload, onClose }: { onUpload: (f: FileMock) => void; onClose: () => void }) {
  const [name, setName]     = useState("");
  const [size, setSize]     = useState("");
  const [cat, setCat]       = useState<FileCategory>("อื่นๆ");
  const [project, setProj]  = useState("");

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (!f) return;
    setName(f.name);
    setSize(f.size > 1024 * 1024 ? `${(f.size / 1024 / 1024).toFixed(1)} MB` : `${(f.size / 1024).toFixed(0)} KB`);
  }
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setName(f.name);
    setSize(f.size > 1024 * 1024 ? `${(f.size / 1024 / 1024).toFixed(1)} MB` : `${(f.size / 1024).toFixed(0)} KB`);
  }

  function save() {
    const fileName = name.trim() || "ไฟล์ใหม่.pdf";
    onUpload({
      id: Date.now(), name: fileName,
      size: size || "—",
      ext: guessExt(fileName),
      category: cat,
      project: project.trim() || "—",
      uploadedBy: "คุณ",
      uploadedAt: new Date().toISOString().slice(0, 10),
    });
    onClose();
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(45,45,45,.45)", zIndex: 200 }} />
      <div style={{ position: "fixed", inset: 0, zIndex: 210, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, pointerEvents: "none" }}>
        <div onClick={e => e.stopPropagation()} className="card" style={{ width: "100%", maxWidth: 460, pointerEvents: "auto", overflow: "hidden", boxShadow: "0 24px 80px rgba(0,51,102,.22)" }}>
          <div style={{ background: PRIMARY, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontWeight: 800, color: "#fff", fontSize: "0.9rem" }}>อัปโหลดไฟล์</span>
            <button onClick={onClose} style={{ background: "rgba(255,255,255,.15)", border: "none", borderRadius: 7, width: 28, height: 28, cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={13} /></button>
          </div>
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Drop zone */}
            <div onDragOver={e => e.preventDefault()} onDrop={handleDrop}
              style={{ border: `2px dashed ${name ? PRIMARY : BORDER}`, borderRadius: 12, padding: "24px 20px", textAlign: "center", background: name ? "#f0f4fa" : "var(--muted)", cursor: "pointer" }}>
              <label style={{ cursor: "pointer" }}>
                <input type="file" style={{ display: "none" }} onChange={handleFile} />
                {name ? (
                  <div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 700, color: STEEL }}>{name}</div>
                    <div style={{ fontSize: "0.72rem", color: MUTED, marginTop: 4 }}>{size}</div>
                  </div>
                ) : (
                  <div>
                    <Upload size={28} color={MUTED} style={{ margin: "0 auto 10px" }} />
                    <div style={{ fontSize: "0.78rem", color: MUTED }}>ลากไฟล์มาวาง หรือ <span style={{ color: PRIMARY, fontWeight: 700 }}>คลิกเลือกไฟล์</span></div>
                    <div style={{ fontSize: "0.66rem", color: "#9ca3af", marginTop: 4 }}>PDF, Word, Excel, CAD, รูปภาพ</div>
                  </div>
                )}
              </label>
            </div>
            {/* Manual name override */}
            <div>
              <label className="form-label">ชื่อไฟล์</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="ชื่อไฟล์.pdf" className="form-input" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label className="form-label">โฟลเดอร์</label>
                <select value={cat} onChange={e => setCat(e.target.value as FileCategory)} className="form-select">
                  {ALL_CATS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">โอกาสการขาย</label>
                <input value={project} onChange={e => setProj(e.target.value)} placeholder="ชื่อโอกาสการขาย" className="form-input" />
              </div>
            </div>
          </div>
          <div style={{ padding: "13px 20px", borderTop: `1px solid ${BORDER}`, display: "flex", gap: 8, justifyContent: "flex-end", background: "#fafafa" }}>
            <button onClick={onClose} className="btn btn-secondary btn-md">ยกเลิก</button>
            <button onClick={save} className="btn btn-primary btn-md">
              <Upload size={13} /> อัปโหลด
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// แก้ไข/เปลี่ยนชื่อไฟล์ (local/mock) — ปรับชื่อ โฟลเดอร์ และโอกาสการขาย
function EditFileModal({ file, onSave, onClose }: { file: FileMock; onSave: (f: FileMock) => void; onClose: () => void }) {
  const [name, setName]    = useState(file.name);
  const [cat, setCat]      = useState<FileCategory>(file.category);
  const [project, setProj] = useState(file.project === "—" ? "" : file.project);

  function save() {
    const fileName = name.trim() || file.name;
    onSave({
      ...file,
      name: fileName,
      ext: guessExt(fileName),
      category: cat,
      project: project.trim() || "—",
    });
    onClose();
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(45,45,45,.45)", zIndex: 200 }} />
      <div style={{ position: "fixed", inset: 0, zIndex: 210, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, pointerEvents: "none" }}>
        <div onClick={e => e.stopPropagation()} className="card" style={{ width: "100%", maxWidth: 460, pointerEvents: "auto", overflow: "hidden", boxShadow: "0 24px 80px rgba(0,51,102,.22)" }}>
          <div style={{ background: PRIMARY, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontWeight: 800, color: "#fff", fontSize: "0.9rem" }}>แก้ไขไฟล์</span>
            <button onClick={onClose} style={{ background: "rgba(255,255,255,.15)", border: "none", borderRadius: 7, width: 28, height: 28, cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={13} /></button>
          </div>
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label className="form-label">ชื่อไฟล์</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="ชื่อไฟล์.pdf" className="form-input" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label className="form-label">โฟลเดอร์</label>
                <select value={cat} onChange={e => setCat(e.target.value as FileCategory)} className="form-select">
                  {ALL_CATS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">โอกาสการขาย</label>
                <input value={project} onChange={e => setProj(e.target.value)} placeholder="ชื่อโอกาสการขาย" className="form-input" />
              </div>
            </div>
          </div>
          <div style={{ padding: "13px 20px", borderTop: `1px solid ${BORDER}`, display: "flex", gap: 8, justifyContent: "flex-end", background: "#fafafa" }}>
            <button onClick={onClose} className="btn btn-secondary btn-md">ยกเลิก</button>
            <button onClick={save} className="btn btn-primary btn-md">
              <Pencil size={13} /> บันทึก
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function PaginationBar({
  from, to, total, page, totalPages, onPrev, onNext,
}: {
  from: number; to: number; total: number;
  page: number; totalPages: number;
  onPrev: () => void; onNext: () => void;
}) {
  const atFirst = page <= 1;
  const atLast  = page >= totalPages;
  const btnStyle = (disabled: boolean): React.CSSProperties => ({
    padding: "6px 12px",
    borderRadius: 8,
    border: `1px solid ${disabled ? BORDER : PRIMARY}`,
    background: "#fff",
    color: disabled ? "#C0C0C0" : PRIMARY,
    fontSize: "0.72rem",
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    transition: "all .15s",
  });
  return (
    <div style={{ padding: "11px 16px", borderTop: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
      <span style={{ fontSize: "0.7rem", color: MUTED }}>แสดง {from}–{to} จาก {total} ไฟล์</span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={onPrev} disabled={atFirst} style={btnStyle(atFirst)}>ก่อนหน้า</button>
        <span style={{ fontSize: "0.72rem", fontWeight: 700, color: STEEL }}>หน้า {page} / {totalPages}</span>
        <button onClick={onNext} disabled={atLast} style={btnStyle(atLast)}>ถัดไป</button>
      </div>
    </div>
  );
}

// ตัวอย่างเอกสาร (mock preview) — ไม่โหลดไฟล์จริง เรนเดอร์จาก metadata เท่านั้น
function PreviewBody({ f }: { f: FileMock }) {
  // PDF — จำลองหน้ากระดาษ A4 พร้อมลายน้ำ
  if (f.ext === "pdf") {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 24, background: "#eceef0" }}>
        <div style={{
          position: "relative", width: "100%", maxWidth: 440, aspectRatio: "1 / 1.414",
          background: "#fff", borderRadius: 4, boxShadow: "0 6px 24px rgba(0,0,0,.14)",
          padding: "40px 36px", overflow: "hidden",
        }}>
          {/* ลายน้ำ */}
          <div style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "5rem", fontWeight: 900, color: "rgba(220,38,38,.06)", transform: "rotate(-24deg)",
            letterSpacing: 6, pointerEvents: "none", userSelect: "none",
          }}>PDF</div>
          <div style={{ position: "relative" }}>
            <div style={{ fontSize: "0.62rem", fontWeight: 800, color: PRIMARY, letterSpacing: 1, textTransform: "uppercase" }}>เอกสารบริษัท</div>
            <div style={{ fontSize: "1rem", fontWeight: 800, color: STEEL, marginTop: 10, lineHeight: 1.4, wordBreak: "break-word" }}>{f.name}</div>
            <div style={{ height: 3, width: 54, background: PRIMARY, borderRadius: 3, margin: "12px 0 20px" }} />
            {[92, 100, 78, 96, 64].map((w, i) => (
              <div key={i} style={{ height: 8, width: `${w}%`, background: "#e5e7eb", borderRadius: 4, marginBottom: 11 }} />
            ))}
            <div style={{ height: 8, width: "42%", background: "#eef0f3", borderRadius: 4, margin: "22px 0 11px" }} />
            {[88, 97, 71].map((w, i) => (
              <div key={i} style={{ height: 8, width: `${w}%`, background: "#e5e7eb", borderRadius: 4, marginBottom: 11 }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // รูปภาพ — กรอบภาพ + gradient + ไอคอน Image
  if (f.ext === "jpg" || f.ext === "png") {
    return (
      <div style={{ padding: 24, background: "#eceef0", display: "flex", justifyContent: "center" }}>
        <div style={{
          width: "100%", maxWidth: 520, aspectRatio: "4 / 3", borderRadius: 12, overflow: "hidden",
          border: "6px solid #fff", boxShadow: "0 8px 30px rgba(0,0,0,.16)",
          background: "linear-gradient(135deg, #dce5f0 0%, #003366 100%)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12,
        }}>
          <Image size={56} color="rgba(255,255,255,.9)" />
          <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#fff", textAlign: "center", padding: "0 20px", wordBreak: "break-word" }}>{f.name}</div>
          <div style={{ fontSize: "0.66rem", color: "rgba(255,255,255,.72)" }}>{f.size} · {extLabel(f.ext)}</div>
        </div>
      </div>
    );
  }

  // PowerPoint — สไลด์ 16:9 พร้อมหัวข้อ + bullet
  if (f.ext === "pptx") {
    return (
      <div style={{ padding: 24, background: "#eceef0", display: "flex", justifyContent: "center" }}>
        <div style={{
          width: "100%", maxWidth: 560, aspectRatio: "16 / 9", background: "#fff", borderRadius: 8,
          boxShadow: "0 8px 30px rgba(0,0,0,.16)", overflow: "hidden", display: "flex", flexDirection: "column",
        }}>
          <div style={{ background: PRIMARY, padding: "18px 24px" }}>
            <div style={{ fontSize: "0.62rem", fontWeight: 800, color: "rgba(255,255,255,.6)", letterSpacing: 1 }}>สไลด์นำเสนอ</div>
            <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#fff", marginTop: 4, lineHeight: 1.3, wordBreak: "break-word" }}>{f.name}</div>
          </div>
          <div style={{ flex: 1, padding: "20px 28px", display: "flex", flexDirection: "column", gap: 14, justifyContent: "center" }}>
            {[86, 72, 90].map((w, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: 999, background: PRIMARY, flexShrink: 0 }} />
                <div style={{ height: 9, width: `${w}%`, background: "#e5e7eb", borderRadius: 4 }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // อื่นๆ (xlsx / docx / dwg / other) — การ์ดข้อมูลไฟล์แบบทั่วไป
  return (
    <div style={{ padding: 28, background: "#eceef0", display: "flex", justifyContent: "center" }}>
      <div style={{
        width: "100%", maxWidth: 460, background: "#fff", borderRadius: 12,
        boxShadow: "0 8px 30px rgba(0,0,0,.12)", padding: "28px 26px",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
      }}>
        <div style={{ background: extBg(f.ext), borderRadius: 16, padding: 20, display: "flex" }}>
          {React.cloneElement(extIcon(f.ext) as React.ReactElement<{ size?: number }>, { size: 48 })}
        </div>
        <div style={{ fontSize: "0.92rem", fontWeight: 800, color: STEEL, textAlign: "center", wordBreak: "break-word" }}>{f.name}</div>
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 1, borderTop: `1px solid ${BORDER}` }}>
          {[
            ["ประเภท", extLabel(f.ext)],
            ["ขนาด", f.size],
            ["โฟลเดอร์", f.category],
            ["โอกาสการขาย", f.project],
            ["อัปโหลดโดย", f.uploadedBy],
            ["วันที่", f.uploadedAt],
          ].map(([k, v], i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "9px 0", borderBottom: `1px solid ${BORDER}` }}>
              <span style={{ fontSize: "0.72rem", color: MUTED, flexShrink: 0 }}>{k}</span>
              <span style={{ fontSize: "0.74rem", fontWeight: 700, color: STEEL, textAlign: "right", wordBreak: "break-word" }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PreviewModal({ file, onClose }: { file: FileMock; onClose: () => void }) {
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(45,45,45,.5)", zIndex: 200 }} />
      <div style={{ position: "fixed", inset: 0, zIndex: 210, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, pointerEvents: "none" }}>
        <div onClick={e => e.stopPropagation()} className="card"
          style={{ width: "100%", maxWidth: 640, maxHeight: "90vh", pointerEvents: "auto", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 24px 80px rgba(0,51,102,.28)" }}>
          {/* Header */}
          <div style={{ background: PRIMARY, padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <div style={{ background: "rgba(255,255,255,.15)", borderRadius: 8, padding: 7, display: "flex", flexShrink: 0 }}>
                <Eye size={15} color="#fff" />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={file.name}>{file.name}</div>
                <div style={{ fontSize: "0.66rem", color: "rgba(255,255,255,.72)", marginTop: 2 }}>{extLabel(file.ext)} · {file.size}</div>
              </div>
            </div>
            <button onClick={onClose} style={{ background: "rgba(255,255,255,.15)", border: "none", borderRadius: 7, width: 28, height: 28, cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><X size={13} /></button>
          </div>
          {/* Body — scrollable mock preview */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            <PreviewBody f={file} />
          </div>
          {/* Footer */}
          <div style={{ padding: "13px 20px", borderTop: `1px solid ${BORDER}`, display: "flex", gap: 8, justifyContent: "flex-end", background: "#fafafa" }}>
            <button onClick={onClose} className="btn btn-primary btn-md">ปิด</button>
          </div>
        </div>
      </div>
    </>
  );
}

export default function FilesPage() {
  const router = useRouter();
  const [files,   setFiles]   = useState<FileMock[]>(MOCK_FILES);
  const [query,   setQuery]   = useState("");
  const [catFilter, setCat]   = useState<FileCategory | "ALL">("ALL");
  const [extFilter, setExt]   = useState<FileExt | "ALL">("ALL");
  const [view,    setView]    = useState<"grid" | "list">("list");
  const [upload,  setUpload]  = useState(false);
  const [delId,   setDelId]   = useState<number | null>(null);
  const [editId,  setEditId]  = useState<number | null>(null);
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [page,    setPage]    = useState(1);
  const PAGE_SIZE = 12;

  // แสดงทุกคอลัมน์เสมอ (ไม่มีเครื่องมือซ่อน/แสดงคอลัมน์ในมุมมองรายการแล้ว)
  const showCol = (_key: string) => true;

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return files.filter(f => {
      const matchQ = !q || f.name.toLowerCase().includes(q) || f.project.toLowerCase().includes(q) || f.uploadedBy.toLowerCase().includes(q);
      const matchC = catFilter === "ALL" || f.category === catFilter;
      const matchE = extFilter === "ALL" || f.ext === extFilter;
      return matchQ && matchC && matchE;
    });
  }, [files, query, catFilter, extFilter]);

  // เปลี่ยนตัวกรอง/ค้นหา/มุมมอง → กลับไปหน้าแรก
  useEffect(() => { setPage(1); }, [query, catFilter, extFilter, view]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // กันหน้าเกินเมื่อจำนวนรายการลดลง (เช่น ลบไฟล์)
  const curPage = Math.min(page, totalPages);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const pageStart = (curPage - 1) * PAGE_SIZE;
  const paged = filtered.slice(pageStart, pageStart + PAGE_SIZE);
  const rangeFrom = filtered.length === 0 ? 0 : pageStart + 1;
  const rangeTo   = Math.min(pageStart + PAGE_SIZE, filtered.length);

  const totalSize = useMemo(() => {
    const mb = files.reduce((s, f) => {
      const n = parseFloat(f.size);
      return s + (f.size.includes("MB") ? n : n / 1024);
    }, 0);
    return `${mb.toFixed(1)} MB`;
  }, [files]);

  const extCounts = useMemo(() => {
    const c: Partial<Record<FileExt, number>> = {};
    files.forEach(f => { c[f.ext] = (c[f.ext] ?? 0) + 1; });
    return c;
  }, [files]);

  const catCounts = useMemo(() => {
    const c: Record<FileCategory, number> = {
      ใบเสนอราคา: 0, แบบแปลน: 0, รูปภาพ: 0, นำเสนอ: 0, สัญญา: 0, "อื่นๆ": 0,
    };
    files.forEach(f => { c[f.category] += 1; });
    return c;
  }, [files]);

  function deleteFile(id: number) { setFiles(f => f.filter(x => x.id !== id)); setDelId(null); }
  function updateFile(updated: FileMock) { setFiles(f => f.map(x => x.id === updated.id ? updated : x)); }

  return (
    <div className="erp">
      {/* Header */}
      <div className="page-head">
        <div>
          <h2>ไฟล์</h2>
          <p>{files.length} ไฟล์ · {totalSize}</p>
        </div>
        <button onClick={() => setUpload(true)} className="btn btn-primary btn-md">
          <Plus size={14} /> อัปโหลดไฟล์
        </button>
      </div>

      {/* สรุปแบบ pills — แทน stat card 5 ใบ */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.78rem", fontWeight: 700, color: STEEL, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 99, padding: "7px 16px" }}>
          ไฟล์ทั้งหมด <span style={{ color: PRIMARY }}>{files.length}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.78rem", fontWeight: 700, color: STEEL, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 99, padding: "7px 16px" }}>
          ขนาดรวม <span style={{ color: PRIMARY }}>{totalSize}</span>
        </div>
        {(["pdf","xlsx","docx","dwg","pptx"] as FileExt[]).map(ext => (
          (extCounts[ext] ?? 0) > 0 ? (
            <button key={ext} onClick={() => setExt(extFilter === ext ? "ALL" : ext)}
              style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.78rem", fontWeight: 700, cursor: "pointer",
                color: extFilter === ext ? "#fff" : MUTED, background: extFilter === ext ? PRIMARY : "#fff",
                border: `1px solid ${extFilter === ext ? PRIMARY : BORDER}`, borderRadius: 99, padding: "7px 16px" }}>
              {extLabel(ext)} <span style={{ color: extFilter === ext ? "#fff" : STEEL }}>{extCounts[ext]}</span>
            </button>
          ) : null
        ))}
      </div>

      {/* Folder filter bar */}
      <div className="card" style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: "0.72rem", fontWeight: 700, color: MUTED }}>
          <FolderOpen size={14} color={PRIMARY} /> โฟลเดอร์
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {/* ทั้งหมด */}
          <button onClick={() => setCat("ALL")}
            style={{
              display: "flex", alignItems: "center", gap: 7, padding: "7px 12px",
              borderRadius: 9, cursor: "pointer", fontSize: "0.74rem", fontWeight: 700,
              border: `1px solid ${catFilter === "ALL" ? PRIMARY : BORDER}`,
              background: catFilter === "ALL" ? PRIMARY : "#fff",
              color: catFilter === "ALL" ? "#fff" : STEEL,
              transition: "all .15s",
            }}>
            <FolderOpen size={15} color={catFilter === "ALL" ? "#fff" : PRIMARY} />
            ทั้งหมด
            <span style={{
              fontSize: "0.66rem", fontWeight: 800, borderRadius: 999, padding: "1px 7px", lineHeight: 1.5,
              background: catFilter === "ALL" ? "rgba(255,255,255,.22)" : "#f0f0f5",
              color: catFilter === "ALL" ? "#fff" : MUTED,
            }}>{files.length}</span>
          </button>
          {ALL_CATS.map(c => {
            const active = catFilter === c;
            const col = CAT_COLORS[c];
            return (
              <button key={c} onClick={() => setCat(active ? "ALL" : c)}
                style={{
                  display: "flex", alignItems: "center", gap: 7, padding: "7px 12px",
                  borderRadius: 9, cursor: "pointer", fontSize: "0.74rem", fontWeight: 700,
                  border: `1px solid ${active ? col.text : BORDER}`,
                  background: active ? col.bg : "#fff",
                  color: active ? col.text : STEEL,
                  transition: "all .15s",
                }}>
                {catIcon(c)}
                {c}
                <span style={{
                  fontSize: "0.66rem", fontWeight: 800, borderRadius: 999, padding: "1px 7px", lineHeight: 1.5,
                  background: active ? "rgba(255,255,255,.55)" : "#f0f0f5",
                  color: active ? col.text : MUTED,
                }}>{catCounts[c]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Toolbar */}
      <div className="card" style={{ borderRadius: "var(--radius-xl) var(--radius-xl) 0 0", borderBottom: "none", padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div className="search-bar" style={{ flex: 1, minWidth: 180 }}>
          <Search size={13} color={MUTED} />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="ค้นหาไฟล์ / โอกาสการขาย..." />
          {query && <button onClick={() => setQuery("")} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, display: "flex", padding: 0 }}><X size={11} /></button>}
        </div>
        <select value={extFilter} onChange={e => setExt(e.target.value as FileExt | "ALL")}
          className="form-select" style={{ width: "auto" }}>
          <option value="ALL">ทุกประเภท</option>
          {(["pdf","xlsx","docx","dwg","pptx","jpg"] as FileExt[]).map(e => <option key={e} value={e}>{extLabel(e)}</option>)}
        </select>
        <div style={{ display: "flex", border: `1px solid ${BORDER}`, borderRadius: 9, overflow: "hidden", marginLeft: "auto", height: 36, boxSizing: "border-box" }}>
          {(["list","grid"] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              style={{ padding: "0 13px", height: "100%", border: "none", background: view === v ? PRIMARY : "#fff", color: view === v ? "#fff" : MUTED, fontSize: "0.72rem", fontWeight: 600, cursor: "pointer" }}>
              {v === "list" ? "รายการ" : "กริด"}
            </button>
          ))}
        </div>
        <span style={{ fontSize: "0.7rem", color: MUTED }}>{filtered.length} ไฟล์</span>
      </div>

      {/* Content */}
      {view === "list" ? (
        <div className="card" style={{ borderTop: "none", borderRadius: "0 0 var(--radius-xl) var(--radius-xl)", overflow: "hidden" }}>
          <div className="table-wrap" style={{ borderTop: "none" }}>
            <table>
              <colgroup>
                <col style={{ width: "25%" }} />
                {showCol("category")   && <col style={{ width: "11%" }} />}
                {showCol("project")    && <col style={{ width: "21%" }} />}
                {showCol("size")       && <col style={{ width: "9%" }} />}
                {showCol("uploadedBy") && <col style={{ width: "11%" }} />}
                {showCol("uploadedAt") && <col style={{ width: "11%" }} />}
                <col style={{ width: "12%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>ไฟล์</th>
                  {showCol("category")   && <th>โฟลเดอร์</th>}
                  {showCol("project")    && <th>โอกาสการขาย</th>}
                  {showCol("size")       && <th>ขนาด</th>}
                  {showCol("uploadedBy") && <th>อัปโหลดโดย</th>}
                  {showCol("uploadedAt") && <th>วันที่</th>}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={2 + COLS.filter(c => showCol(c.key)).length} style={{ textAlign: "center", padding: "60px 0", color: MUTED, fontSize: "0.82rem" }}>
                    <FolderOpen size={32} color="#C0C0C0" style={{ display: "block", margin: "0 auto 12px" }} />
                    ไม่พบไฟล์
                  </td></tr>
                )}
                {paged.map(f => (
                  <tr key={f.id} onClick={() => setPreviewId(f.id)} style={{ cursor: "pointer" }}>
                    <td style={{ maxWidth: 260 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ background: extBg(f.ext), borderRadius: 8, padding: 7, display: "flex", flexShrink: 0 }}>{extIcon(f.ext)}</div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: "0.78rem", fontWeight: 700, color: STEEL, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</div>
                          <div style={{ fontSize: "0.62rem", color: MUTED, marginTop: 2 }}>{extLabel(f.ext)}</div>
                        </div>
                      </div>
                    </td>
                    {showCol("category") && (
                      <td>
                        <span className="badge" style={{ background: CAT_COLORS[f.category].bg, color: CAT_COLORS[f.category].text }}>{f.category}</span>
                      </td>
                    )}
                    {showCol("project") && (
                      <td>
                        {f.project !== "—" ? (
                          <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
                            <span style={{ fontSize:"0.74rem", color:STEEL }}>{f.project}</span>
                            {f.customerId && (
                              <button onClick={e => { e.stopPropagation(); router.push(`/customers?open=${f.customerId}`); }}
                                style={{ fontSize:"0.6rem", color:PRIMARY, fontWeight:700, background:"none", border:"none", padding:0, cursor:"pointer", textDecoration:"underline", textAlign:"left" }}>
                                {customers.find(c=>c.id===f.customerId)?.company ?? `ลูกค้า #${f.customerId}`} →
                              </button>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize:"0.74rem", color:MUTED }}>—</span>
                        )}
                      </td>
                    )}
                    {showCol("size")       && <td style={{ fontSize: "0.74rem", color: MUTED, whiteSpace: "nowrap" }}>{f.size}</td>}
                    {showCol("uploadedBy") && <td style={{ fontSize: "0.74rem", color: STEEL }}>{f.uploadedBy}</td>}
                    {showCol("uploadedAt") && <td style={{ fontSize: "0.72rem", color: MUTED, whiteSpace: "nowrap" }}>{f.uploadedAt}</td>}
                    <td className="ovf-visible">
                      <div style={{ display: "flex", gap: 5, justifyContent: "flex-end" }}>
                        <button title="ดูตัวอย่าง" onClick={e => { e.stopPropagation(); setPreviewId(f.id); }}
                          style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${BORDER}`, background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: PRIMARY }}>
                          <Eye size={12} />
                        </button>
                        <button title="แก้ไข" onClick={e => { e.stopPropagation(); setEditId(f.id); }}
                          style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${BORDER}`, background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: PRIMARY }}>
                          <Pencil size={12} />
                        </button>
                        <button onClick={e => { e.stopPropagation(); setDelId(f.id); }} title="ลบ"
                          style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid #fee2e2", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#dc2626" }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationBar
            from={rangeFrom} to={rangeTo} total={filtered.length}
            page={curPage} totalPages={totalPages}
            onPrev={() => setPage(p => Math.max(1, p - 1))}
            onNext={() => setPage(p => Math.min(totalPages, p + 1))}
          />
        </div>
      ) : (
        /* Grid view */
        <div className="card" style={{ borderTop: "none", borderRadius: "0 0 var(--radius-xl) var(--radius-xl)", padding: 16 }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: MUTED, fontSize: "0.82rem" }}>
              <FolderOpen size={32} color="#C0C0C0" style={{ display: "block", margin: "0 auto 12px" }} />
              ไม่พบไฟล์
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
              {paged.map(f => (
                <div key={f.id} onClick={() => setPreviewId(f.id)} style={{ border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14, background: "#fafbfc", display: "flex", flexDirection: "column", gap: 10, cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ background: extBg(f.ext), borderRadius: 9, padding: 9, display: "flex" }}>{extIcon(f.ext)}</div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button title="ดูตัวอย่าง" onClick={e => { e.stopPropagation(); setPreviewId(f.id); }} style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${BORDER}`, background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: PRIMARY }}>
                        <Eye size={11} />
                      </button>
                      <button title="แก้ไข" onClick={e => { e.stopPropagation(); setEditId(f.id); }} style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${BORDER}`, background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: PRIMARY }}>
                        <Pencil size={11} />
                      </button>
                      <button onClick={e => { e.stopPropagation(); setDelId(f.id); }} title="ลบ" style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid #fee2e2", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#dc2626" }}>
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.74rem", fontWeight: 700, color: STEEL, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={f.name}>{f.name}</div>
                    <div style={{ fontSize: "0.62rem", color: MUTED, marginTop: 3 }}>{f.size} · {f.uploadedAt}</div>
                  </div>
                  <span className="badge" style={{ background: CAT_COLORS[f.category].bg, color: CAT_COLORS[f.category].text, alignSelf: "flex-start" }}>{f.category}</span>
                </div>
              ))}
            </div>
          )}
          {filtered.length > 0 && (
            <div style={{ marginTop: 12, marginLeft: -16, marginRight: -16, marginBottom: -16 }}>
              <PaginationBar
                from={rangeFrom} to={rangeTo} total={filtered.length}
                page={curPage} totalPages={totalPages}
                onPrev={() => setPage(p => Math.max(1, p - 1))}
                onNext={() => setPage(p => Math.min(totalPages, p + 1))}
              />
            </div>
          )}
        </div>
      )}

      {/* Upload modal */}
      {upload && <UploadModal onUpload={f => setFiles(fs => [f, ...fs])} onClose={() => setUpload(false)} />}

      {/* Edit modal */}
      {editId !== null && (() => {
        const ef = files.find(f => f.id === editId);
        return ef ? <EditFileModal file={ef} onSave={updateFile} onClose={() => setEditId(null)} /> : null;
      })()}

      {/* Preview modal */}
      {previewId !== null && (() => {
        const pf = files.find(f => f.id === previewId);
        return pf ? <PreviewModal file={pf} onClose={() => setPreviewId(null)} /> : null;
      })()}

      {/* Delete confirm */}
      {delId !== null && (
        <>
          <div onClick={() => setDelId(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", zIndex: 200 }} />
          <div style={{ position: "fixed", inset: 0, zIndex: 210, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            <div onClick={e => e.stopPropagation()} className="card" style={{ width: 300, pointerEvents: "auto", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,.15)" }}>
              <div style={{ padding: "16px 20px 14px", borderBottom: `1px solid ${BORDER}` }}>
                <div style={{ fontSize: "0.88rem", fontWeight: 700, color: STEEL }}>ยืนยันการลบไฟล์</div>
                <div style={{ fontSize: "0.74rem", color: MUTED, marginTop: 4 }}>
                  {files.find(f => f.id === delId)?.name}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, padding: "14px 20px" }}>
                <button onClick={() => setDelId(null)} className="btn btn-secondary btn-md" style={{ flex: 1, justifyContent: "center" }}>ยกเลิก</button>
                <button onClick={() => deleteFile(delId)} className="btn btn-md" style={{ flex: 1, justifyContent: "center", background: "#dc2626", color: "#fff", border: "none" }}>ลบไฟล์</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
