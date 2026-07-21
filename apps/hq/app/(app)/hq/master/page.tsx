"use client";

// ─── HQ · แคตตาล็อกแม่แบบ / ราคากลาง (แหล่งเดียวทั้งเครือ) ─────────────────
// HQ แก้ไขที่นี่ → persist ลง MASTER_CATALOG_KEY → Dealer (/products + dropdown ฟอร์ม)
// อ่านจากคีย์เดียวกันทันที · ขอบเขต Sales เท่านั้น (ไม่มี lead time/การส่งมอบ)
import { useState } from "react";
import { usePersistentState } from "@pms/shared/lib/usePersistentState";
import { AdminGate } from "@pms/shared/components/layout/AdminGate";
import { solutionProducts, MASTER_CATALOG_KEY, type SolutionProduct } from "@pms/shared/lib/mock";
import { useAuditLogger } from "@pms/shared/lib/useAudit";
import { fileToResizedDataURL } from "@pms/shared/lib/imageResize";
import { CountUp } from "@pms/shared/components/ui/CountUp";
import { APP_NOW } from "@pms/shared/context/FilterContext";
import { Search, Plus, Pencil, History, TrendingUp, X, Check, Trash2, Building2, CalendarClock, ImagePlus, Layers, Tag } from "lucide-react";

const PRIMARY = "#003366";
const STEEL   = "#2D2D2D";
const MUTED   = "#6b7280";
const BORDER  = "#e5e7eb";

const fmtBaht = (v: number) => "฿" + v.toLocaleString("th-TH");
const TH_MONTHS = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
// วันของระบบ (APP_NOW) ไม่ใช่นาฬิกาเครื่อง — effectiveDate ของราคากลางต้องอยู่ในยุคเดียวกับข้อมูล
function todayTH() { const d = APP_NOW; return `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`; }

type EditForm = { name: string; spec: string; unit: string; subtypes: string[]; image: string; subtypeImages: Record<string, string> };

const subInp: React.CSSProperties = { border: `1px solid ${BORDER}`, borderRadius: 9, padding: "9px 12px", fontSize: "0.8rem", color: STEEL, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };

// ── ตัวจัดการแม่แบบย่อย — เพิ่ม / แก้ชื่อ / ลบ + อัปโหลดรูปรายแม่แบบย่อย ── (ใช้ร่วมฟอร์มเพิ่ม/แก้ไข)
function SubtypeEditor({ value, images, onChange, onImagesChange }: {
  value: string[];
  images: Record<string, string>;
  onChange: (next: string[]) => void;
  onImagesChange: (next: Record<string, string>) => void;
}) {
  const [draft, setDraft] = useState("");
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  function add() {
    const v = draft.trim();
    if (!v || value.includes(v)) { setDraft(""); return; }
    onChange([...value, v]); setDraft("");
  }
  function removeAt(i: number) {
    const name = value[i];
    onChange(value.filter((_, x) => x !== i));
    if (images[name]) { const n = { ...images }; delete n[name]; onImagesChange(n); }
  }
  function commitEdit() {
    if (editIdx === null) return;
    const old = value[editIdx];
    const v = editText.trim();
    if (!v) { removeAt(editIdx); }
    else if (!value.some((x, i) => x === v && i !== editIdx)) {
      onChange(value.map((x, i) => i === editIdx ? v : x));
      if (images[old] && old !== v) { const n = { ...images }; n[v] = n[old]; delete n[old]; onImagesChange(n); } // ย้ายรูปตามชื่อใหม่
    }
    setEditIdx(null); setEditText("");
  }
  async function pickImg(name: string, file: File) {
    try { onImagesChange({ ...images, [name]: await fileToResizedDataURL(file, 512, 0.85) }); }
    catch { alert("อัปโหลดรูปไม่สำเร็จ ลองใหม่อีกครั้ง"); }
  }
  function clearImg(name: string) { const n = { ...images }; delete n[name]; onImagesChange(n); }

  const iconBtn: React.CSSProperties = { background: "none", border: "none", cursor: "pointer", display: "flex", padding: 4, flexShrink: 0 };

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
        {value.length === 0 && <span style={{ fontSize: "0.72rem", color: MUTED }}>ยังไม่มีแม่แบบย่อย (ไม่ใส่ก็ได้)</span>}
        {value.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, border: `1px solid ${BORDER}`, borderRadius: 9, padding: "6px 8px", background: "#fafafa" }}>
            {/* รูปรายแม่แบบย่อย — คลิกเพื่ออัปโหลด */}
            <label title="อัปโหลด/เปลี่ยนรูปแม่แบบย่อย"
              style={{ width: 40, height: 40, borderRadius: 8, overflow: "hidden", flexShrink: 0, cursor: "pointer", border: `1px solid ${BORDER}`, background: "#f0f4f9", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {images[s]
                /* eslint-disable-next-line @next/next/no-img-element */
                ? <img src={images[s]} alt={s} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <ImagePlus size={15} color="#9ca3af" />}
              <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) pickImg(s, f); }} />
            </label>
            {/* ชื่อ (คลิกเพื่อแก้) */}
            {editIdx === i ? (
              <input autoFocus value={editText} onChange={e => setEditText(e.target.value)} onBlur={commitEdit}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); commitEdit(); } else if (e.key === "Escape") { setEditIdx(null); setEditText(""); } }}
                style={{ ...subInp, flex: 1, padding: "5px 8px", fontSize: "0.78rem" }} />
            ) : (
              <button type="button" onClick={() => { setEditIdx(i); setEditText(s); }} title="คลิกเพื่อแก้ชื่อ"
                style={{ flex: 1, textAlign: "left", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "0.78rem", fontWeight: 600, color: STEEL, padding: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s}</button>
            )}
            {images[s] && <button type="button" onClick={() => clearImg(s)} title="ลบรูป" style={iconBtn}><Trash2 size={13} color="#dc2626" /></button>}
            <button type="button" onClick={() => removeAt(i)} title="ลบแม่แบบย่อย" style={iconBtn}><X size={14} color="#9ca3af" /></button>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <input style={{ ...subInp, flex: 1 }} value={draft} placeholder="เพิ่มแม่แบบย่อย เช่น โรงงานอาหาร"
          onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <button type="button" className="btn btn-secondary btn-md" onClick={add} style={{ flexShrink: 0 }}><Plus size={14} /> เพิ่ม</button>
      </div>
      {value.length > 0 && <div style={{ fontSize: "0.65rem", color: "#9ca3af", marginTop: 6 }}>คลิกที่ชื่อเพื่อแก้ · คลิกรูปเพื่ออัปโหลดรายแม่แบบย่อย · ✕ เพื่อลบ</div>}
    </div>
  );
}

// ── อัปโหลด/แก้รูปแม่แบบ (ย่อขนาดก่อนเก็บ กัน quota) ──
function ImageUpload({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [busy, setBusy] = useState(false);
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try { onChange(await fileToResizedDataURL(file, 512, 0.85)); }
    catch { alert("อัปโหลดรูปไม่สำเร็จ ลองใหม่อีกครั้ง"); }
    finally { setBusy(false); }
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 76, height: 76, borderRadius: 12, border: `1px dashed ${value ? "transparent" : "#cbd5e1"}`, background: value ? "#f0f4f9" : "#fafafa", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
        {value
          /* eslint-disable-next-line @next/next/no-img-element */
          ? <img src={value} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <Building2 size={26} style={{ color: "#9ca3af" }} />}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label className="btn btn-secondary btn-sm" style={{ cursor: "pointer" }}>
          <ImagePlus size={13} /> {busy ? "กำลังอัปโหลด..." : value ? "เปลี่ยนรูป" : "อัปโหลดรูป"}
          <input type="file" accept="image/*" onChange={onFile} style={{ display: "none" }} />
        </label>
        {value && <button type="button" className="btn btn-secondary btn-sm" onClick={() => onChange("")} style={{ color: "#dc2626" }}><Trash2 size={12} /> ลบรูป</button>}
        <span style={{ fontSize: "0.65rem", color: "#9ca3af" }}>PNG, JPG · ไม่ใส่ก็ได้</span>
      </div>
    </div>
  );
}

// แก้ราคากลาง/แคตตาล็อกส่วนกลาง = ต้องมีสิทธิ์ catalog:edit — HQ_STAFF เข้าไม่ได้
export default function HQMasterPage() {
  return <AdminGate perm="catalog:edit"><HQMasterPageInner /></AdminGate>;
}
function HQMasterPageInner() {
  const [catalog, setCatalog] = usePersistentState<SolutionProduct[]>(MASTER_CATALOG_KEY, solutionProducts);
  const logAudit = useAuditLogger(); // บันทึกการแก้แม่แบบ/ราคากลาง
  const [q, setQ] = useState("");

  // modals
  const [editing, setEditing]   = useState<SolutionProduct | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ name: "", spec: "", unit: "ตร.ม.", subtypes: [], image: "", subtypeImages: {} });
  const [adding, setAdding]     = useState(false);
  const [addForm, setAddForm]   = useState({ name: "", spec: "", price: "", unit: "ตร.ม.", subtypes: [] as string[], image: "", subtypeImages: {} as Record<string, string> });
  const [reprice, setReprice]   = useState<SolutionProduct | null>(null);
  const [rpPrice, setRpPrice]   = useState("");
  const [rpNote, setRpNote]     = useState("");
  const [history, setHistory]   = useState<SolutionProduct | null>(null);
  const [delTarget, setDelTarget] = useState<SolutionProduct | null>(null);
  // ดูรายละเอียดแม่แบบ (แบบเดียวกับหน้าตัวแทน) + เจาะแม่แบบย่อยพร้อมรูป
  const [viewing, setViewing]   = useState<SolutionProduct | null>(null);
  const [subView, setSubView]   = useState<{ parent: SolutionProduct; sub: string } | null>(null);

  const filtered = catalog.filter(p =>
    !q || p.name.toLowerCase().includes(q.toLowerCase()) || p.spec.toLowerCase().includes(q.toLowerCase()));
  const avgPrice = catalog.length ? Math.round(catalog.reduce((s, p) => s + p.price, 0) / catalog.length) : 0;
  const totalSub = catalog.reduce((s, p) => s + (p.subtypes?.length ?? 0), 0);

  // เก็บเฉพาะรูปของแม่แบบย่อยที่ยังมีอยู่ (กันรูปค้างของชื่อที่ถูกลบ) + undefined ถ้าว่าง
  const pruneImages = (subs: string[], imgs: Record<string, string>): Record<string, string> | undefined => {
    const keep: Record<string, string> = {};
    subs.forEach(s => { if (imgs[s]) keep[s] = imgs[s]; });
    return Object.keys(keep).length ? keep : undefined;
  };
  function openEdit(p: SolutionProduct) {
    setEditing(p); setEditForm({ name: p.name, spec: p.spec, unit: p.unit, subtypes: [...(p.subtypes ?? [])], image: p.image ?? "", subtypeImages: { ...(p.subtypeImages ?? {}) } });
  }
  function saveEdit() {
    if (!editing || !editForm.name.trim()) return;
    setCatalog(prev => prev.map(p => p.id !== editing.id ? p : { ...p, name: editForm.name.trim(), spec: editForm.spec.trim(), unit: editForm.unit.trim() || "ตร.ม.", subtypes: editForm.subtypes, image: editForm.image || undefined, subtypeImages: pruneImages(editForm.subtypes, editForm.subtypeImages) }));
    logAudit("แก้ไขแม่แบบ", editForm.name.trim());
    setEditing(null);
  }
  function openAdd() { setAddForm({ name: "", spec: "", price: "", unit: "ตร.ม.", subtypes: [], image: "", subtypeImages: {} }); setAdding(true); }
  function addProduct() {
    const price = parseFloat(addForm.price);
    if (!addForm.name.trim() || !price) return;
    const nid = Math.max(0, ...catalog.map(p => parseInt(p.id.replace(/\D/g, "")) || 0)) + 1;
    setCatalog(prev => [...prev, {
      id: `tpl-${nid}`, name: addForm.name.trim(), spec: addForm.spec.trim(),
      price, unit: addForm.unit.trim() || "ตร.ม.", effectiveDate: todayTH(), priceHistory: [],
      subtypes: addForm.subtypes, image: addForm.image || undefined, subtypeImages: pruneImages(addForm.subtypes, addForm.subtypeImages),
    }]);
    logAudit("เพิ่มแม่แบบ", `${addForm.name.trim()} · ฿${price.toLocaleString("th-TH")}`);
    setAddForm({ name: "", spec: "", price: "", unit: "ตร.ม.", subtypes: [], image: "", subtypeImages: {} }); setAdding(false);
  }
  function saveReprice() {
    const price = parseFloat(rpPrice);
    if (!reprice || !price || price === reprice.price) { setReprice(null); return; }
    setCatalog(prev => prev.map(p => p.id !== reprice.id ? p : {
      ...p, price, effectiveDate: todayTH(),
      // ราคาปัจจุบันถูกดันลงประวัติ (ใหม่สุดอยู่บน)
      priceHistory: [{ price: p.price, effectiveDate: p.effectiveDate, note: rpNote.trim() || undefined }, ...p.priceHistory],
    }));
    logAudit("ปรับราคากลาง", `${reprice.name} · ฿${reprice.price.toLocaleString("th-TH")} → ฿${price.toLocaleString("th-TH")}`);
    setReprice(null); setRpPrice(""); setRpNote("");
  }
  function deleteProduct() {
    if (!delTarget) return;
    setCatalog(prev => prev.filter(p => p.id !== delTarget.id));
    logAudit("ลบแม่แบบ", delTarget.name);
    setDelTarget(null);
  }

  const inp: React.CSSProperties = { width: "100%", border: `1px solid ${BORDER}`, borderRadius: 9, padding: "9px 12px", fontSize: "0.8rem", color: STEEL, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
  const lbl: React.CSSProperties = { display: "block", fontSize: "0.65rem", fontWeight: 700, color: MUTED, marginBottom: 5 };
  const pill: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem", fontWeight: 700, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 99, padding: "7px 16px" };

  return (
    <div className="erp">
      {/* Header */}
      <div className="page-head">
        <div>
          <p>แหล่งเดียวทั้งเครือ — ตัวแทนเห็นแม่แบบและราคากลางชุดเดียวกันนี้ (อ่านอย่างเดียว)</p>
        </div>
        <button className="btn btn-primary btn-md" onClick={openAdd}><Plus size={15} /> เพิ่มแม่แบบ</button>
      </div>

      {/* Summary — KPI พรีเมียม (ชุดเดียวกับหน้า HQ อื่น) */}
      <div className="hqx-kpis" style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 16 }}>
        <div className="hqx-kpi">
          <span className="acc" style={{ background: "#003366" }} />
          <span className="ic" style={{ background: "#dce5f0", color: "#003366" }}><Building2 size={20} /></span>
          <div><div className="v"><CountUp value={`${catalog.length}`} /></div><div className="l">แม่แบบทั้งหมด</div></div>
        </div>
        <div className="hqx-kpi">
          <span className="acc" style={{ background: "#003366" }} />
          <span className="ic" style={{ background: "#dce5f0", color: "#003366" }}><Tag size={20} /></span>
          <div><div className="v"><CountUp value={fmtBaht(avgPrice)} /></div><div className="l">ราคากลางเฉลี่ย /ตร.ม.</div></div>
        </div>
        <div className="hqx-kpi">
          <span className="acc" style={{ background: "#0a4a86" }} />
          <span className="ic" style={{ background: "#e0ecf7", color: "#0a4a86" }}><Layers size={20} /></span>
          <div><div className="v"><CountUp value={`${totalSub}`} /></div><div className="l">แม่แบบย่อยทั้งหมด</div></div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="card hq-sticky-filter" style={{ padding: "12px 16px", marginBottom: 14, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div className="search-bar">
          <Search size={13} color={MUTED} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="ค้นหาแม่แบบ..." />
          {q && <button onClick={() => setQ("")} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, padding: 0, display: "flex" }}><X size={13} /></button>}
        </div>
      </div>

      {/* Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(310px,1fr))", gap: 16 }}>
        {filtered.map(p => (
          <div key={p.id} className="card tpl-card" role="button" tabIndex={0}
            onClick={() => setViewing(p)}
            onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setViewing(p); } }}
            style={{ display: "flex", flexDirection: "column", overflow: "hidden", cursor: "pointer" }}>
            {/* ── Hero: ไทล์ + ป้ายจำนวนแม่แบบย่อย ── */}
            <div style={{ position: "relative", height: 104, background: "#f0f4f9", display: "flex", alignItems: "center", justifyContent: "center", borderBottom: `1px solid ${BORDER}`, overflow: "hidden" }}>
              {p.image ? (
                /* รูปแม่แบบที่อัปโหลด — เต็มพื้นที่ Hero */
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={p.image} alt={p.name} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <>
                  <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(#00336610 1px, transparent 1px), linear-gradient(90deg, #00336610 1px, transparent 1px)", backgroundSize: "22px 22px", opacity: 0.5 }} />
                  <div className="tpl-hero" style={{ width: 54, height: 54, borderRadius: 14, background: "#fff", border: `1px solid ${BORDER}`, boxShadow: "0 6px 16px rgba(0,51,102,.12)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1 }}>
                    <Building2 size={26} style={{ color: PRIMARY }} />
                  </div>
                </>
              )}
              {p.subtypes && p.subtypes.length > 0 && (
                <span style={{ position: "absolute", top: 11, right: 11, fontSize: "0.65rem", fontWeight: 700, color: PRIMARY, background: "rgba(255,255,255,.85)", border: `1px solid #dce5f0`, borderRadius: 999, padding: "3px 10px" }}>{p.subtypes.length} แม่แบบย่อย</span>
              )}
            </div>

            {/* ── เนื้อหา ── */}
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 9, flex: 1 }}>
              <div style={{ fontSize: "1rem", fontWeight: 800, color: STEEL, lineHeight: 1.3 }}>{p.name}</div>
              <div className="tpl-clamp2" style={{ fontSize: "0.72rem", color: MUTED, lineHeight: 1.5, minHeight: "2.25em" }}>{p.spec}</div>

              {p.subtypes && p.subtypes.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {p.subtypes.map(s => (
                    <span key={s} style={{ fontSize: "0.65rem", fontWeight: 600, color: PRIMARY, background: "#eef3f8", border: `1px solid #dce5f0`, borderRadius: 7, padding: "3px 9px" }}>{s}</span>
                  ))}
                </div>
              )}

              {/* เส้นคั่น + ราคา */}
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8, marginTop: "auto", paddingTop: 12, borderTop: `1px solid ${BORDER}` }}>
                <div>
                  <div style={{ fontSize: "0.65rem", color: MUTED, fontWeight: 700, marginBottom: 1 }}>ราคากลาง</div>
                  <span style={{ fontSize: "1.3rem", fontWeight: 800, color: PRIMARY, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>{fmtBaht(p.price)}</span>
                  <span style={{ fontSize: "0.72rem", color: MUTED }}> /{p.unit}</span>
                </div>
                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.65rem", color: "#9ca3af", whiteSpace: "nowrap" }}><CalendarClock size={11} /> {p.effectiveDate}</span>
              </div>

              {/* ปุ่มจัดการ (คลิกที่การ์ดเพื่อดูรายละเอียด · ปุ่มเหล่านี้ไม่เปิดหน้ารายละเอียด) */}
              <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                <button className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: "center" }} onClick={e => { e.stopPropagation(); openEdit(p); }}><Pencil size={12} /> แก้ไข</button>
                <button className="btn btn-tint btn-sm" style={{ flex: 1, justifyContent: "center" }} onClick={e => { e.stopPropagation(); setReprice(p); setRpPrice(String(p.price)); }}><TrendingUp size={12} /> ปรับราคา</button>
                <button className="btn btn-secondary btn-sm" title="ประวัติราคา" style={{ width: 38, padding: 0, justifyContent: "center" }} onClick={e => { e.stopPropagation(); setHistory(p); }}><History size={13} /></button>
                <button className="btn btn-danger btn-sm" title="ลบแม่แบบ" style={{ width: 38, padding: 0, justifyContent: "center" }} onClick={e => { e.stopPropagation(); setDelTarget(p); }}><Trash2 size={13} /></button>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="card" style={{ gridColumn: "1/-1", padding: 40, textAlign: "center", color: "#9ca3af", fontSize: "0.8rem" }}>ไม่พบแม่แบบ</div>
        )}
      </div>

      {/* ── View detail modal — ดูแบบเดียวกับที่ตัวแทนเห็น + จัดการได้ในตัว (HQ ควบคุม) ── */}
      {viewing && (
        <div onClick={() => setViewing(null)} style={{ position: "fixed", inset: 0, background: "rgba(45,45,45,.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 580, maxHeight: "90vh", overflowY: "auto", background: "#fff", borderRadius: 16, boxShadow: "0 24px 64px rgba(0,0,0,.22)" }}>
            {/* Header */}
            <div style={{ background: PRIMARY, color: "#fff", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: "1rem", fontWeight: 800 }}>{viewing.name}</div>
                <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,.7)", marginTop: 2 }}>แคตตาล็อกกลาง · มุมมองเดียวกับที่ตัวแทนเห็น</div>
              </div>
              <button onClick={() => setViewing(null)} style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,.15)", color: "#fff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={15} /></button>
            </div>
            {/* Hero รูป */}
            <div style={{ height: 168, background: "#f0f4f9", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", borderBottom: `1px solid ${BORDER}` }}>
              {viewing.image
                /* eslint-disable-next-line @next/next/no-img-element */
                ? <img src={viewing.image} alt={viewing.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <Building2 size={44} style={{ color: PRIMARY }} />}
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div style={{ fontSize: "0.65rem", color: MUTED, marginBottom: 4 }}>รายละเอียด</div>
                <div style={{ fontSize: "0.86rem", fontWeight: 600, lineHeight: 1.6, color: STEEL }}>{viewing.spec || "—"}</div>
              </div>
              {/* แม่แบบย่อยเป็นไทล์รูป คลิกดูได้ */}
              {viewing.subtypes && viewing.subtypes.length > 0 && (
                <div>
                  <div style={{ fontSize: "0.65rem", color: MUTED, marginBottom: 8 }}>แม่แบบย่อย ({viewing.subtypes.length}) · คลิกเพื่อดู</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                    {viewing.subtypes.map(s => (
                      <button key={s} onClick={() => setSubView({ parent: viewing, sub: s })} title={`ดูรายละเอียด ${s}`}
                        style={{ border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden", background: "#fafafa", cursor: "pointer", padding: 0, textAlign: "center", fontFamily: "inherit" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 14px rgba(0,51,102,.14)"; (e.currentTarget as HTMLElement).style.borderColor = "#cdd8e6"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; (e.currentTarget as HTMLElement).style.borderColor = BORDER; }}>
                        <div style={{ height: 66, background: "#f0f4f9", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                          {(viewing.subtypeImages?.[s] ?? viewing.image)
                            /* eslint-disable-next-line @next/next/no-img-element */
                            ? <img src={viewing.subtypeImages?.[s] ?? viewing.image} alt={s} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            : <Building2 size={22} style={{ color: PRIMARY }} />}
                        </div>
                        <div style={{ padding: "6px 8px", fontSize: "0.7rem", fontWeight: 600, color: STEEL, textAlign: "center", lineHeight: 1.3 }}>{s}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {/* ราคากลาง */}
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, padding: "12px 14px", borderRadius: 10, background: "#dce5f0" }}>
                <div>
                  <div style={{ fontSize: "0.65rem", color: MUTED, fontWeight: 700 }}>ราคากลาง</div>
                  <span style={{ fontSize: "1.2rem", fontWeight: 800, color: PRIMARY }}>{fmtBaht(viewing.price)}</span>
                  <span style={{ fontSize: "0.72rem", color: MUTED }}> /{viewing.unit}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, color: MUTED, fontSize: "0.72rem" }}>
                  <CalendarClock size={12} /> มีผล {viewing.effectiveDate}
                </div>
              </div>
              {/* การจัดการ (HQ ควบคุมได้จากหน้าดูเลย) */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <button className="btn btn-secondary btn-md" style={{ justifyContent: "center" }} onClick={() => { const p = viewing; setViewing(null); openEdit(p); }}><Pencil size={13} /> แก้ไข</button>
                <button className="btn btn-tint btn-md" style={{ justifyContent: "center" }} onClick={() => { const p = viewing; setViewing(null); setReprice(p); setRpPrice(String(p.price)); }}><TrendingUp size={13} /> ปรับราคา</button>
                <button className="btn btn-secondary btn-md" style={{ justifyContent: "center", color: STEEL }} onClick={() => { const p = viewing; setViewing(null); setHistory(p); }}><History size={13} /> ประวัติราคา</button>
                <button className="btn btn-danger btn-md" style={{ justifyContent: "center" }} onClick={() => { const p = viewing; setViewing(null); setDelTarget(p); }}><Trash2 size={13} /> ลบแม่แบบ</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── รายละเอียดแม่แบบย่อย modal ── */}
      {subView && (
        <div onClick={() => setSubView(null)} style={{ position: "fixed", inset: 0, background: "rgba(45,45,45,.5)", zIndex: 210, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,.25)" }}>
            <div style={{ background: PRIMARY, color: "#fff", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: "1rem", fontWeight: 800 }}>{subView.sub}</div>
                <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,.7)", marginTop: 2 }}>แม่แบบย่อยของ {subView.parent.name}</div>
              </div>
              <button onClick={() => setSubView(null)} style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,.15)", color: "#fff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={15} /></button>
            </div>
            <div style={{ height: 150, background: "#f0f4f9", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", borderBottom: `1px solid ${BORDER}` }}>
              {(subView.parent.subtypeImages?.[subView.sub] ?? subView.parent.image)
                /* eslint-disable-next-line @next/next/no-img-element */
                ? <img src={subView.parent.subtypeImages?.[subView.sub] ?? subView.parent.image} alt={subView.sub} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <Building2 size={40} style={{ color: PRIMARY }} />}
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div style={{ fontSize: "0.65rem", color: MUTED, marginBottom: 4 }}>รายละเอียด</div>
                <div style={{ fontSize: "0.86rem", fontWeight: 600, lineHeight: 1.6, color: STEEL }}>{subView.parent.spec || "—"}</div>
              </div>
              <div>
                <div style={{ fontSize: "0.65rem", color: MUTED, marginBottom: 4 }}>ราคากลาง (ตามแม่แบบหลัก)</div>
                <span style={{ fontSize: "1.15rem", fontWeight: 800, color: PRIMARY }}>{fmtBaht(subView.parent.price)}</span>
                <span style={{ fontSize: "0.72rem", color: MUTED }}> /{subView.parent.unit}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Add modal ── */}
      {adding && (
        <div onClick={() => setAdding(false)} style={{ position: "fixed", inset: 0, background: "rgba(45,45,45,.5)", zIndex: 220, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={e => e.stopPropagation()} className="modal-pop-flex" style={{ position: "static", width: "100%", maxWidth: 460, maxHeight: "90vh", display: "flex", flexDirection: "column", background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,.25)" }}>
            <div style={{ background: PRIMARY, color: "#fff", padding: "15px 20px", fontSize: "0.92rem", fontWeight: 800, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              เพิ่มแม่แบบใหม่
              <button onClick={() => setAdding(false)} style={{ background: "rgba(255,255,255,.15)", border: "none", borderRadius: 8, width: 28, height: 28, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={14} /></button>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 13, overflowY: "auto", flex: 1 }}>
              <div><label style={lbl}>ชื่อแม่แบบ *</label><input style={inp} value={addForm.name} autoFocus onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} placeholder="เช่น โกดังสำเร็จรูป" /></div>
              <div><label style={lbl}>รูปแม่แบบ</label><ImageUpload value={addForm.image} onChange={v => setAddForm(f => ({ ...f, image: v }))} /></div>
              <div><label style={lbl}>รายละเอียด/สเปก</label><textarea style={{ ...inp, resize: "vertical" }} rows={3} value={addForm.spec} onChange={e => setAddForm(f => ({ ...f, spec: e.target.value }))} /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div><label style={lbl}>ราคากลาง (บาท) *</label><input style={inp} type="number" value={addForm.price} onChange={e => setAddForm(f => ({ ...f, price: e.target.value }))} placeholder="5100" /></div>
                <div><label style={lbl}>หน่วย</label><input style={inp} value={addForm.unit} onChange={e => setAddForm(f => ({ ...f, unit: e.target.value }))} /></div>
              </div>
              {/* แม่แบบย่อย — ใส่/แก้/ลบ ได้ตั้งแต่ตอนสร้าง */}
              <div>
                <label style={lbl}>แม่แบบย่อย ({addForm.subtypes.length})</label>
                <SubtypeEditor value={addForm.subtypes} images={addForm.subtypeImages}
                  onChange={next => setAddForm(f => ({ ...f, subtypes: next }))}
                  onImagesChange={next => setAddForm(f => ({ ...f, subtypeImages: next }))} />
              </div>
            </div>
            <div style={{ padding: "14px 20px", borderTop: `1px solid ${BORDER}`, background: "#fafafa", display: "flex", justifyContent: "flex-end", gap: 8, flexShrink: 0 }}>
              <button className="btn btn-secondary btn-md" onClick={() => setAdding(false)}>ยกเลิก</button>
              <button className="btn btn-primary btn-md" onClick={addProduct} disabled={!addForm.name.trim() || !parseFloat(addForm.price)}
                style={!addForm.name.trim() || !parseFloat(addForm.price) ? { opacity: .5, cursor: "not-allowed" } : undefined}><Check size={14} /> บันทึก</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit modal ── */}
      {editing && (
        <div onClick={() => setEditing(null)} style={{ position: "fixed", inset: 0, background: "rgba(45,45,45,.5)", zIndex: 220, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 460, maxHeight: "90vh", display: "flex", flexDirection: "column", background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,.25)" }}>
            <div style={{ background: PRIMARY, color: "#fff", padding: "15px 20px", fontSize: "0.92rem", fontWeight: 800, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              แก้ไขแม่แบบ
              <button onClick={() => setEditing(null)} style={{ background: "rgba(255,255,255,.15)", border: "none", borderRadius: 8, width: 28, height: 28, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={14} /></button>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 13, overflowY: "auto", flex: 1 }}>
              <div><label style={lbl}>ชื่อแม่แบบ *</label><input style={inp} value={editForm.name} autoFocus onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><label style={lbl}>รูปแม่แบบ</label><ImageUpload value={editForm.image} onChange={v => setEditForm(f => ({ ...f, image: v }))} /></div>
              <div><label style={lbl}>รายละเอียด/สเปก</label><textarea style={{ ...inp, resize: "vertical" }} rows={3} value={editForm.spec} onChange={e => setEditForm(f => ({ ...f, spec: e.target.value }))} /></div>
              <div><label style={lbl}>หน่วย</label><input style={inp} value={editForm.unit} onChange={e => setEditForm(f => ({ ...f, unit: e.target.value }))} /></div>
              {/* แม่แบบย่อย — เพิ่ม/แก้ไขชื่อ/ลบได้ (เลือกได้ในฟอร์มลูกค้าเป้าหมาย/ใบเสนอราคา) */}
              <div>
                <label style={lbl}>แม่แบบย่อย ({editForm.subtypes.length})</label>
                <SubtypeEditor value={editForm.subtypes} images={editForm.subtypeImages}
                  onChange={next => setEditForm(f => ({ ...f, subtypes: next }))}
                  onImagesChange={next => setEditForm(f => ({ ...f, subtypeImages: next }))} />
              </div>
              <div style={{ fontSize: "0.72rem", color: MUTED }}>ราคากลางแก้ผ่านปุ่ม "ปรับราคา" เพื่อบันทึกประวัติราคาเสมอ</div>
            </div>
            <div style={{ padding: "14px 20px", borderTop: `1px solid ${BORDER}`, background: "#fafafa", display: "flex", justifyContent: "flex-end", gap: 8, flexShrink: 0 }}>
              <button className="btn btn-secondary btn-md" onClick={() => setEditing(null)}>ยกเลิก</button>
              <button className="btn btn-primary btn-md" onClick={saveEdit}><Check size={14} /> บันทึก</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reprice modal ── */}
      {reprice && (
        <div onClick={() => setReprice(null)} style={{ position: "fixed", inset: 0, background: "rgba(45,45,45,.5)", zIndex: 220, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,.25)" }}>
            <div style={{ background: PRIMARY, color: "#fff", padding: "15px 20px", fontSize: "0.92rem", fontWeight: 800 }}>ปรับราคากลาง — {reprice.name}</div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 13 }}>
              <div style={{ fontSize: "0.8rem", color: MUTED }}>ราคาปัจจุบัน <b style={{ color: STEEL }}>{fmtBaht(reprice.price)}/{reprice.unit}</b> (มีผล {reprice.effectiveDate})</div>
              <div><label style={lbl}>ราคากลางใหม่ (บาท) *</label><input style={inp} type="number" value={rpPrice} autoFocus onChange={e => setRpPrice(e.target.value)} /></div>
              <div><label style={lbl}>หมายเหตุ</label><input style={inp} value={rpNote} onChange={e => setRpNote(e.target.value)} placeholder="เช่น ปรับตามราคาเหล็ก" /></div>
              <div style={{ fontSize: "0.65rem", color: "#9ca3af" }}>ราคาเดิมจะถูกบันทึกลงประวัติราคาโดยอัตโนมัติ · มีผลทันทีทุกตัวแทน</div>
            </div>
            <div style={{ padding: "14px 20px", borderTop: `1px solid ${BORDER}`, background: "#fafafa", display: "flex", justifyContent: "flex-end", gap: 8, flexShrink: 0 }}>
              <button className="btn btn-secondary btn-md" onClick={() => setReprice(null)}>ยกเลิก</button>
              <button className="btn btn-primary btn-md" onClick={saveReprice}><TrendingUp size={14} /> ปรับราคา</button>
            </div>
          </div>
        </div>
      )}

      {/* ── History modal ── */}
      {history && (
        <div onClick={() => setHistory(null)} style={{ position: "fixed", inset: 0, background: "rgba(45,45,45,.5)", zIndex: 220, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,.25)" }}>
            <div style={{ background: PRIMARY, color: "#fff", padding: "15px 20px", fontSize: "0.92rem", fontWeight: 800, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              ประวัติราคา — {history.name}
              <button onClick={() => setHistory(null)} style={{ background: "rgba(255,255,255,.15)", border: "none", borderRadius: 8, width: 28, height: 28, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={14} /></button>
            </div>
            <div style={{ padding: 20, maxHeight: 360, overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", borderRadius: 10, background: "#dce5f0", marginBottom: 8 }}>
                <span style={{ fontSize: "0.8rem", fontWeight: 700, color: PRIMARY }}>ปัจจุบัน · {history.effectiveDate}</span>
                <span style={{ fontSize: "0.86rem", fontWeight: 800, color: PRIMARY }}>{fmtBaht(history.price)}/{history.unit}</span>
              </div>
              {history.priceHistory.map((h, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", borderBottom: "1px solid #f0f4f8" }}>
                  <div>
                    <div style={{ fontSize: "0.72rem", color: STEEL, fontWeight: 600 }}>{h.effectiveDate}</div>
                    {h.note && <div style={{ fontSize: "0.65rem", color: MUTED }}>{h.note}</div>}
                  </div>
                  <span style={{ fontSize: "0.8rem", fontWeight: 700, color: MUTED, fontVariantNumeric: "tabular-nums" }}>{fmtBaht(h.price)}</span>
                </div>
              ))}
              {history.priceHistory.length === 0 && <div style={{ fontSize: "0.72rem", color: "#9ca3af", textAlign: "center", padding: "16px 0" }}>ยังไม่มีประวัติการปรับราคา</div>}
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm ── */}
      {delTarget && (
        <div onClick={() => setDelTarget(null)} style={{ position: "fixed", inset: 0, background: "rgba(45,45,45,.5)", zIndex: 220, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 360, background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,.25)" }}>
            <div style={{ padding: "22px 22px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ width: 38, height: 38, borderRadius: "50%", background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Trash2 size={17} color="#dc2626" /></span>
                <div style={{ fontSize: "1rem", fontWeight: 800, color: STEEL }}>ลบแม่แบบ</div>
              </div>
              <p style={{ fontSize: "0.8rem", color: MUTED, lineHeight: 1.6, margin: 0 }}>ต้องการลบ <strong style={{ color: STEEL }}>{delTarget.name}</strong>? ตัวแทนจะไม่เห็นแม่แบบนี้อีก</p>
            </div>
            <div style={{ padding: "14px 22px", borderTop: `1px solid ${BORDER}`, background: "#fafafa", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn btn-secondary btn-md" onClick={() => setDelTarget(null)}>ยกเลิก</button>
              <button className="btn btn-md" style={{ background: "#dc2626", color: "#fff", border: "none" }} onClick={deleteProduct}><Trash2 size={13} /> ลบ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
