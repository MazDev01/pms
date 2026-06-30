"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { customers } from "@/lib/mock";
import {
  FolderOpen, Search, X, Upload, Trash2, Download, File,
  FileText, FileSpreadsheet, Image, Plus,
} from "lucide-react";

const PRIMARY = "#003366";
const STEEL   = "#2D2D2D";
const BORDER  = "#e5e7eb";
const MUTED   = "#6b7280";

type FileCategory = "ใบเสนอราคา" | "สัญญา" | "แบบแปลน" | "นำเสนอ" | "รายงาน" | "ทั่วไป";
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
  { id: 1,  name: "ใบเสนอราคา_โกดังสินค้า_ไทยสตีล_v2.pdf", size: "1.4 MB", ext: "pdf",  category: "ใบเสนอราคา", project: "โกดังสินค้า บจ. ไทยสตีล", uploadedBy: "วิภา",     uploadedAt: "2026-06-20", customerId: 1 },
  { id: 2,  name: "สัญญาขาย_ไทยสตีล.pdf",                   size: "2.1 MB", ext: "pdf",  category: "สัญญา",      project: "โกดังสินค้า บจ. ไทยสตีล", uploadedBy: "สมชาย",   uploadedAt: "2026-06-18", customerId: 1 },
  { id: 3,  name: "แบบแปลน_Layout_โรงงาน.dwg",             size: "8.3 MB", ext: "dwg",  category: "แบบแปลน",    project: "โรงงาน PEB เชียงใหม่",     uploadedBy: "วิชัย",   uploadedAt: "2026-06-15", customerId: 2 },
  { id: 4,  name: "presentation_VCS_Asia.pptx",             size: "5.7 MB", ext: "pptx", category: "นำเสนอ",     project: "VCS Asia Expansion",       uploadedBy: "กาญจนา", uploadedAt: "2026-06-12", customerId: 5 },
  { id: 5,  name: "BOQ_คลังสินค้า_บจ.ซีซีเอส.xlsx",       size: "340 KB", ext: "xlsx", category: "ใบเสนอราคา", project: "คลังสินค้า CCS",           uploadedBy: "สมชาย",   uploadedAt: "2026-06-10", customerId: 2 },
  { id: 6,  name: "สัญญา_ลงนามแล้ว_ATC.pdf",              size: "1.8 MB", ext: "pdf",  category: "สัญญา",      project: "ATC Logistics",            uploadedBy: "ประสิทธิ์", uploadedAt: "2026-06-08" },
  { id: 7,  name: "รูปถ่ายพื้นที่_โอกาสการขายนนทบุรี.jpg",     size: "3.2 MB", ext: "jpg",  category: "ทั่วไป",     project: "โกดัง Nonthaburi Corp",    uploadedBy: "วิภา",     uploadedAt: "2026-06-05", customerId: 1 },
  { id: 8,  name: "รายงานสำรวจพื้นที่_ไทยเกษตร.pdf",       size: "920 KB", ext: "pdf",  category: "รายงาน",     project: "อาคารไทยเกษตรพัฒนา",      uploadedBy: "สุดาวรรณ", uploadedAt: "2026-06-03" },
  { id: 9,  name: "specs_โครงสร้างเหล็ก_PEB.xlsx",         size: "512 KB", ext: "xlsx", category: "แบบแปลน",    project: "โรงงาน PEB เชียงใหม่",     uploadedBy: "วิชัย",   uploadedAt: "2026-05-30", customerId: 2 },
  { id: 10, name: "quotation_Q2026-0095.pdf",               size: "1.1 MB", ext: "pdf",  category: "ใบเสนอราคา", project: "VCS Asia Expansion",       uploadedBy: "กาญจนา", uploadedAt: "2026-05-28", customerId: 5 },
  { id: 11, name: "contract_draft_ERP.docx",                size: "520 KB", ext: "docx", category: "สัญญา",      project: "ERP ซีซีเอส",              uploadedBy: "สมชาย",   uploadedAt: "2026-05-25", customerId: 2 },
  { id: 12, name: "presentation_Benjamin_2026.pptx",        size: "12.4 MB",ext: "pptx", category: "นำเสนอ",     project: "—",                        uploadedBy: "วิภา",     uploadedAt: "2026-05-20" },
  { id: 13, name: "แบบแปลน_อาคารเกษตร_v3.dwg",            size: "6.8 MB", ext: "dwg",  category: "แบบแปลน",    project: "อาคารไทยเกษตรพัฒนา",      uploadedBy: "วิชัย",   uploadedAt: "2026-05-18" },
  { id: 14, name: "รายงานความคืบหน้า_Q2.pdf",              size: "2.8 MB", ext: "pdf",  category: "รายงาน",     project: "—",                        uploadedBy: "ประสิทธิ์", uploadedAt: "2026-05-15" },
  { id: 15, name: "signed_contract_ATC.pdf",                size: "1.9 MB", ext: "pdf",  category: "สัญญา",      project: "ATC Logistics",            uploadedBy: "สุดาวรรณ", uploadedAt: "2026-05-10" },
];

const CAT_COLORS: Record<FileCategory, { bg: string; text: string }> = {
  ใบเสนอราคา: { bg: "#dce5f0", text: "#003366" },
  สัญญา:      { bg: "#fff3cd", text: "#d97706" },
  แบบแปลน:    { bg: "#e5faf0", text: "#059669" },
  นำเสนอ:     { bg: "#fff3cd", text: "#d97706" },
  รายงาน:     { bg: "#f0f0f5", text: "#6b7280" },
  ทั่วไป:     { bg: "#f0f0f5", text: "#6b7280" },
};

const ALL_CATS: FileCategory[] = ["ใบเสนอราคา","สัญญา","แบบแปลน","นำเสนอ","รายงาน","ทั่วไป"];

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

function UploadModal({ onUpload, onClose }: { onUpload: (f: FileMock) => void; onClose: () => void }) {
  const [name, setName]     = useState("");
  const [size, setSize]     = useState("");
  const [cat, setCat]       = useState<FileCategory>("ทั่วไป");
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
                <label className="form-label">หมวดหมู่</label>
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

export default function FilesPage() {
  const router = useRouter();
  const [files,   setFiles]   = useState<FileMock[]>(MOCK_FILES);
  const [query,   setQuery]   = useState("");
  const [catFilter, setCat]   = useState<FileCategory | "ALL">("ALL");
  const [extFilter, setExt]   = useState<FileExt | "ALL">("ALL");
  const [view,    setView]    = useState<"grid" | "list">("list");
  const [upload,  setUpload]  = useState(false);
  const [delId,   setDelId]   = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return files.filter(f => {
      const matchQ = !q || f.name.toLowerCase().includes(q) || f.project.toLowerCase().includes(q) || f.uploadedBy.toLowerCase().includes(q);
      const matchC = catFilter === "ALL" || f.category === catFilter;
      const matchE = extFilter === "ALL" || f.ext === extFilter;
      return matchQ && matchC && matchE;
    });
  }, [files, query, catFilter, extFilter]);

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

  function deleteFile(id: number) { setFiles(f => f.filter(x => x.id !== id)); setDelId(null); }

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

      {/* Stats */}
      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
        {(["pdf","xlsx","docx","dwg","pptx"] as FileExt[]).map(ext => (
          <div key={ext} className="stat-card" style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px" }}>
            <div className="stat-icon" style={{ background: extBg(ext), margin: 0, width: 42, height: 42 }}>{extIcon(ext)}</div>
            <div>
              <div style={{ fontSize: "1.3rem", fontWeight: 900, color: STEEL, lineHeight: 1 }}>{extCounts[ext] ?? 0}</div>
              <div style={{ fontSize: "0.62rem", color: MUTED, marginTop: 3 }}>{extLabel(ext)}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="card" style={{ borderRadius: "var(--radius-xl) var(--radius-xl) 0 0", borderBottom: "none", padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div className="search-bar" style={{ flex: 1, minWidth: 180 }}>
          <Search size={13} color={MUTED} />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="ค้นหาไฟล์ / โอกาสการขาย..." />
          {query && <button onClick={() => setQuery("")} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, display: "flex", padding: 0 }}><X size={11} /></button>}
        </div>
        <select value={catFilter} onChange={e => setCat(e.target.value as FileCategory | "ALL")}
          className="form-select" style={{ width: "auto" }}>
          <option value="ALL">ทุกหมวด</option>
          {ALL_CATS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={extFilter} onChange={e => setExt(e.target.value as FileExt | "ALL")}
          className="form-select" style={{ width: "auto" }}>
          <option value="ALL">ทุกประเภท</option>
          {(["pdf","xlsx","docx","dwg","pptx","jpg"] as FileExt[]).map(e => <option key={e} value={e}>{extLabel(e)}</option>)}
        </select>
        <div style={{ display: "flex", border: `1px solid ${BORDER}`, borderRadius: 9, overflow: "hidden", marginLeft: "auto" }}>
          {(["list","grid"] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              style={{ padding: "7px 13px", border: "none", background: view === v ? PRIMARY : "#fff", color: view === v ? "#fff" : MUTED, fontSize: "0.72rem", fontWeight: 600, cursor: "pointer" }}>
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
              <thead>
                <tr>
                  {["ไฟล์","หมวดหมู่","โอกาสการขาย","ขนาด","อัปโหลดโดย","วันที่",""].map((h, i) => (
                    <th key={i}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: "center", padding: "60px 0", color: MUTED, fontSize: "0.82rem" }}>
                    <FolderOpen size={32} color="#C0C0C0" style={{ display: "block", margin: "0 auto 12px" }} />
                    ไม่พบไฟล์
                  </td></tr>
                )}
                {filtered.map(f => (
                  <tr key={f.id}>
                    <td style={{ maxWidth: 260 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ background: extBg(f.ext), borderRadius: 8, padding: 7, display: "flex", flexShrink: 0 }}>{extIcon(f.ext)}</div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: "0.78rem", fontWeight: 700, color: STEEL, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</div>
                          <div style={{ fontSize: "0.62rem", color: MUTED, marginTop: 2 }}>{extLabel(f.ext)}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="badge" style={{ background: CAT_COLORS[f.category].bg, color: CAT_COLORS[f.category].text }}>{f.category}</span>
                    </td>
                    <td>
                      {f.project !== "—" ? (
                        <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
                          <span style={{ fontSize:"0.74rem", color:STEEL }}>{f.project}</span>
                          {f.customerId && (
                            <button onClick={() => router.push(`/customers/${f.customerId}`)}
                              style={{ fontSize:"0.6rem", color:PRIMARY, fontWeight:700, background:"none", border:"none", padding:0, cursor:"pointer", textDecoration:"underline", textAlign:"left" }}>
                              {customers.find(c=>c.id===f.customerId)?.company ?? `ลูกค้า #${f.customerId}`} →
                            </button>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize:"0.74rem", color:MUTED }}>—</span>
                      )}
                    </td>
                    <td style={{ fontSize: "0.74rem", color: MUTED, whiteSpace: "nowrap" }}>{f.size}</td>
                    <td style={{ fontSize: "0.74rem", color: STEEL }}>{f.uploadedBy}</td>
                    <td style={{ fontSize: "0.72rem", color: MUTED, whiteSpace: "nowrap" }}>{f.uploadedAt}</td>
                    <td>
                      <div style={{ display: "flex", gap: 5 }}>
                        <button title="ดาวน์โหลด"
                          style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${BORDER}`, background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: PRIMARY }}>
                          <Download size={12} />
                        </button>
                        <button onClick={() => setDelId(f.id)} title="ลบ"
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
          <div style={{ padding: "11px 16px", borderTop: `1px solid ${BORDER}` }}>
            <span style={{ fontSize: "0.7rem", color: MUTED }}>แสดง {filtered.length} จาก {files.length} ไฟล์</span>
          </div>
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
              {filtered.map(f => (
                <div key={f.id} style={{ border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14, background: "#fafbfc", display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ background: extBg(f.ext), borderRadius: 9, padding: 9, display: "flex" }}>{extIcon(f.ext)}</div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button title="ดาวน์โหลด" style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${BORDER}`, background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: PRIMARY }}>
                        <Download size={11} />
                      </button>
                      <button onClick={() => setDelId(f.id)} title="ลบ" style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid #fee2e2", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#dc2626" }}>
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
        </div>
      )}

      {/* Upload modal */}
      {upload && <UploadModal onUpload={f => setFiles(fs => [f, ...fs])} onClose={() => setUpload(false)} />}

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
