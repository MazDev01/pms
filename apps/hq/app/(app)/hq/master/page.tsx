"use client";

// ─── HQ · แคตตาล็อกแม่แบบ / ราคากลาง (แหล่งเดียวทั้งเครือ) ─────────────────
// HQ แก้ไขที่นี่ → persist ลง MASTER_CATALOG_KEY → Dealer (/products + dropdown ฟอร์ม)
// อ่านจากคีย์เดียวกันทันที · ขอบเขต Sales เท่านั้น (ไม่มี lead time/การส่งมอบ)
import { useState, useRef } from "react";
import { ModalCard } from "@pms/shared/components/ui/ModalCard";
import { useRepoState } from "@pms/shared/lib/useRepoState";
import { friendlyError } from "@pms/shared/lib/friendlyError";
import { catalog as catalogRepo } from "@pms/shared/lib/data";
import { AdminGate } from "@pms/shared/components/layout/AdminGate";
// เริ่มด้วยรายการว่าง — เดิมตั้งต้นด้วยชุดตัวอย่าง ทำให้เห็นแม่แบบปลอมกะพริบก่อนของจริงมา
import { type SolutionProduct } from "@pms/shared/lib/mock";
import { useAuditLogger } from "@pms/shared/lib/useAudit";
import { fmtFull as fmtBaht } from "@pms/shared/lib/format";
import { catalogRate } from "@pms/shared/lib/boq";
import { fileToResizedDataURL } from "@pms/shared/lib/imageResize";
import { CountUp } from "@pms/shared/components/ui/CountUp";
import { APP_NOW } from "@pms/shared/context/FilterContext";
import { Search, Plus, Pencil, History, TrendingUp, X, Check, Trash2, Building2, CalendarClock, ImagePlus, Layers, Tag } from "lucide-react";

const PRIMARY = "#003366";
const STEEL   = "#2D2D2D";
const MUTED   = "#6b7280";
const BORDER  = "#e5e7eb";

const TH_MONTHS = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
// วันของระบบ (APP_NOW) ไม่ใช่นาฬิกาเครื่อง — effectiveDate ของราคากลางต้องอยู่ในยุคเดียวกับข้อมูล
function todayTH() { const d = APP_NOW; return `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`; }

type EditForm = { name: string; spec: string; unit: string; subtypes: string[]; image: string; subtypeImages: Record<string, string>; subtypePrices: Record<string, number> };

const subInp: React.CSSProperties = { border: `1px solid ${BORDER}`, borderRadius: 10, padding: "11px 14px", fontSize: "0.92rem", color: STEEL, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };

// ── ตัวจัดการแม่แบบย่อย — เพิ่ม / แก้ชื่อ / ลบ + อัปโหลดรูปรายแม่แบบย่อย ── (ใช้ร่วมฟอร์มเพิ่ม/แก้ไข)
function SubtypeEditor({ value, images, prices, mainPrice, onChange, onImagesChange, onPricesChange }: {
  value: string[];
  images: Record<string, string>;
  /** ราคากลางรายแม่แบบย่อย — ไม่ใส่ = ใช้ราคาแม่แบบหลัก */
  prices: Record<string, number>;
  /** ราคาแม่แบบหลัก — ใช้เป็น placeholder ให้เห็นว่า "ไม่ใส่แล้วจะได้เท่าไหร่" */
  mainPrice: number;
  onChange: (next: string[]) => void;
  onImagesChange: (next: Record<string, string>) => void;
  onPricesChange: (next: Record<string, number>) => void;
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
    if (prices[name] != null) { const n = { ...prices }; delete n[name]; onPricesChange(n); }
  }
  function commitEdit() {
    if (editIdx === null) return;
    const old = value[editIdx];
    const v = editText.trim();
    if (!v) { removeAt(editIdx); }
    else if (!value.some((x, i) => x === v && i !== editIdx)) {
      onChange(value.map((x, i) => i === editIdx ? v : x));
      if (images[old] && old !== v) { const n = { ...images }; n[v] = n[old]; delete n[old]; onImagesChange(n); } // ย้ายรูปตามชื่อใหม่
      // ราคาต้องย้ายตามชื่อใหม่ด้วย — ไม่ย้าย = ราคาที่ตั้งไว้หายเงียบตอนแก้ชื่อ
      if (prices[old] != null && old !== v) { const n = { ...prices }; n[v] = n[old]; delete n[old]; onPricesChange(n); }
    }
    setEditIdx(null); setEditText("");
  }
  function setPrice(name: string, raw: string) {
    const n = { ...prices };
    const v = parseFloat(raw);
    if (raw.trim() === "" || !(v > 0)) delete n[name];   // ว่าง/ไม่ถูกต้อง = กลับไปใช้ราคาแม่แบบหลัก
    else n[name] = v;
    onPricesChange(n);
  }
  async function pickImg(name: string, file: File) {
    // ข้อความจาก imageResize บอกเหตุผลชัด (ชนิดไฟล์/ขนาด/ไฟล์เสีย) — ส่งต่อให้ผู้ใช้ตรง ๆ ดีกว่าข้อความกลาง ๆ
    try { onImagesChange({ ...images, [name]: await fileToResizedDataURL(file, 512, 0.85) }); }
    catch (err) { alert(err instanceof Error ? err.message : "อัปโหลดรูปไม่สำเร็จ ลองใหม่อีกครั้ง"); }
  }
  function clearImg(name: string) { const n = { ...images }; delete n[name]; onImagesChange(n); }

  const iconBtn: React.CSSProperties = { background: "none", border: "none", cursor: "pointer", display: "flex", padding: 4, flexShrink: 0 };

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
        {value.length === 0 && <span style={{ fontSize: "0.82rem", color: MUTED }}>ยังไม่มีแม่แบบย่อย (ไม่ใส่ก็ได้)</span>}
        {value.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, border: `1px solid ${BORDER}`, borderRadius: 9, padding: "6px 8px", background: "#fafafa" }}>
            {/* รูปรายแม่แบบย่อย — คลิกเพื่ออัปโหลด */}
            <label title="อัปโหลด/เปลี่ยนรูปแม่แบบย่อย"
              style={{ width: 40, height: 40, borderRadius: 8, overflow: "hidden", flexShrink: 0, cursor: "pointer", border: `1px solid ${BORDER}`, background: "#f0f4f9", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {images[s]
                /* eslint-disable-next-line @next/next/no-img-element */
                ? <img src={images[s]} alt={s} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <ImagePlus size={15} color="#9ca3af" />}
              <input type="file" accept="image/*" aria-label="อัปโหลดรูปแม่แบบ" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) pickImg(s, f); }} />
            </label>
            {/* ชื่อ (คลิกเพื่อแก้) */}
            {editIdx === i ? (
              <input autoFocus aria-label="แก้ไขข้อความ" value={editText} onChange={e => setEditText(e.target.value)} onBlur={commitEdit}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); commitEdit(); } else if (e.key === "Escape") { setEditIdx(null); setEditText(""); } }}
                style={{ ...subInp, flex: 1, padding: "7px 10px", fontSize: "0.88rem" }} />
            ) : (
              <button type="button" onClick={() => { setEditIdx(i); setEditText(s); }} title="คลิกเพื่อแก้ชื่อ"
                style={{ flex: 1, textAlign: "left", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "0.88rem", fontWeight: 600, color: STEEL, padding: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s}</button>
            )}
            {/* ราคากลางของแม่แบบย่อยนี้ — ว่างไว้ = ใช้ราคาแม่แบบหลัก (placeholder บอกว่าจะได้เท่าไหร่) */}
            <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
              <span style={{ fontSize: "0.82rem", color: MUTED }}>฿</span>
              <input type="number" min="0" step="0.01" aria-label={`ราคากลางของ ${s}`}
                value={prices[s] != null ? String(prices[s]) : ""}
                onChange={e => setPrice(s, e.target.value)}
                placeholder={mainPrice > 0 ? String(mainPrice) : "ราคาหลัก"}
                title={prices[s] != null ? "ราคาเฉพาะของแม่แบบย่อยนี้" : "ยังไม่ตั้ง — ใช้ราคาของแม่แบบหลัก"}
                style={{ ...subInp, width: 108, padding: "7px 9px", fontSize: "0.86rem", textAlign: "right",
                  fontWeight: prices[s] != null ? 700 : 400, color: prices[s] != null ? PRIMARY : STEEL }} />
            </div>
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
      {value.length > 0 && <div style={{ fontSize: "0.76rem", color: "#9ca3af", marginTop: 8, lineHeight: 1.6 }}>คลิกที่ชื่อเพื่อแก้ · คลิกรูปเพื่ออัปโหลดรายแม่แบบย่อย · ✕ เพื่อลบ<br />ช่องราคา: ว่างไว้ = ใช้ราคาแม่แบบหลัก · ใส่ตัวเลข = ใช้ราคานั้นเฉพาะแม่แบบย่อยนี้</div>}
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
    catch (err) { alert(err instanceof Error ? err.message : "อัปโหลดรูปไม่สำเร็จ ลองใหม่อีกครั้ง"); }
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
        <span style={{ fontSize: "0.76rem", color: "#9ca3af" }}>PNG, JPG · ไม่ใส่ก็ได้</span>
      </div>
    </div>
  );
}

// แก้ราคากลาง/แคตตาล็อกส่วนกลาง = ต้องมีสิทธิ์ catalog:edit — HQ_STAFF เข้าไม่ได้
export default function HQMasterPage() {
  return <AdminGate perm="catalog:edit"><HQMasterPageInner /></AdminGate>;
}
function HQMasterPageInner() {
  // อ่าน/เขียนผ่าน repository (local: localStorage · supabase: DB · RLS: เขียนได้เฉพาะ HQ)
  const [catalog, setCatalog] = useRepoState<SolutionProduct[]>(() => catalogRepo.list(), (v) => catalogRepo.save(v), []);
  // ⚠️ หน้านี้ "ไม่จด" บันทึกการใช้งานเอง — ตัวดักที่ฐานข้อมูลเป็นผู้จดเพียงผู้เดียว (migration 0135)
  //   เดิมจดทั้งสองที่ → 1 การกระทำได้ 2 แถว และใช้ชื่อผู้ใช้คนละแบบ (ชื่อที่แสดง vs อีเมล)
  //   ทำให้ตัวกรองผู้ใช้แยกคนคนเดียวเป็น 2 คน และการ์ด "ผู้ใช้ที่มีกิจกรรม" นับเกินจริง
  //   ที่สำคัญกว่า: ฝั่งแอปจดแม้กดบันทึกโดยไม่ได้แก้อะไรเลย ส่วนตัวดักยิงเฉพาะที่เปลี่ยนจริง // บันทึกการแก้แม่แบบ/ราคากลาง
  const addingRef = useRef(false); // กันกดปุ่ม "เพิ่ม" ซ้ำเร็ว ๆ — ดู addProduct()
  const [q, setQ] = useState("");

  // modals
  const [editing, setEditing]   = useState<SolutionProduct | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ name: "", spec: "", unit: "ตร.ม.", subtypes: [], image: "", subtypeImages: {}, subtypePrices: {} });
  const [adding, setAdding]     = useState(false);
  const [addForm, setAddForm]   = useState({ name: "", spec: "", price: "", unit: "ตร.ม.", subtypes: [] as string[], image: "", subtypeImages: {} as Record<string, string>, subtypePrices: {} as Record<string, number> });
  const [reprice, setReprice]   = useState<SolutionProduct | null>(null);
  const [rpPrice, setRpPrice]   = useState("");
  const [rpNote, setRpNote]     = useState("");
  const [rpError, setRpError]   = useState("");   // ข้อความบอกว่าทำไมปรับราคาไม่ได้ — ต้องมี ไม่งั้นกล่องปิดเงียบ
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
  // ราคาของแม่แบบย่อยที่ถูกลบไปแล้ว ต้องไม่ค้างอยู่ในข้อมูล (แนวเดียวกับ pruneImages)
  const prunePrices = (subs: string[], prices: Record<string, number>): Record<string, number> | undefined => {
    const keep: Record<string, number> = {};
    subs.forEach(s => { if (prices[s] > 0) keep[s] = prices[s]; });
    return Object.keys(keep).length ? keep : undefined;
  };
  function openEdit(p: SolutionProduct) {
    setEditing(p); setEditForm({ name: p.name, spec: p.spec, unit: p.unit, subtypes: [...(p.subtypes ?? [])], image: p.image ?? "", subtypeImages: { ...(p.subtypeImages ?? {}) }, subtypePrices: { ...(p.subtypePrices ?? {}) } });
  }
  function saveEdit() {
    if (!editing || !editForm.name.trim()) return;
    setCatalog(prev => prev.map(p => p.id !== editing.id ? p : { ...p, name: editForm.name.trim(), spec: editForm.spec.trim(), unit: editForm.unit.trim() || "ตร.ม.", subtypes: editForm.subtypes, image: editForm.image || undefined, subtypeImages: pruneImages(editForm.subtypes, editForm.subtypeImages), subtypePrices: prunePrices(editForm.subtypes, editForm.subtypePrices) }));
    setEditing(null);
  }
  function openAdd() { setAddForm({ name: "", spec: "", price: "", unit: "ตร.ม.", subtypes: [], image: "", subtypeImages: {}, subtypePrices: {} }); setAdding(true); }
  function addProduct() {
    // กันกดซ้ำ (H8 · guard synchronous) — nid คำนวณจาก catalog ปิดคลุม (closure) ไม่ใช่ prev ข้างใน
    // updater กดรัว ๆ เร็วกว่า React re-render ทันจะได้ nid ซ้ำ (สร้างสองแม่แบบ id ชนกัน) — พบจาก
    // Edge Case sweep เดียวกับที่เจอในฟอร์มเพิ่มลูกค้าเป้าหมาย/ลูกค้าฝั่งตัวแทน (3 ส.ค. 69)
    if (addingRef.current) return;
    const price = parseFloat(addForm.price);
    if (!addForm.name.trim() || !(price > 0)) return;
    addingRef.current = true;
    const nid = Math.max(0, ...catalog.map(p => parseInt(p.id.replace(/\D/g, "")) || 0)) + 1;
    setCatalog(prev => [...prev, {
      id: `tpl-${nid}`, name: addForm.name.trim(), spec: addForm.spec.trim(),
      price, unit: addForm.unit.trim() || "ตร.ม.", effectiveDate: todayTH(), priceHistory: [],
      subtypes: addForm.subtypes, image: addForm.image || undefined, subtypeImages: pruneImages(addForm.subtypes, addForm.subtypeImages), subtypePrices: prunePrices(addForm.subtypes, addForm.subtypePrices),
    }]);
    setAddForm({ name: "", spec: "", price: "", unit: "ตร.ม.", subtypes: [], image: "", subtypeImages: {}, subtypePrices: {} }); setAdding(false);
    addingRef.current = false;
  }
  function saveReprice() {
    if (!reprice) return;
    const price = parseFloat(rpPrice);
    // ⚠️ ห้ามปิดกล่องเงียบ ๆ เมื่อค่าใช้ไม่ได้ (บั๊กจริง พบ 10 ส.ค. 69)
    //   เดิมกรอก 0 หรือติดลบ แล้วกล่องปิดลงเหมือนบันทึกสำเร็จ ทั้งที่ราคาไม่ได้เปลี่ยนเลย
    //   ผู้ดูแลเชื่อว่าปรับราคากลางทั้งเครือแล้ว แต่ตัวแทนทุกสาขายังเห็นราคาเดิม
    //   และไม่มีร่องรอยอะไรเลย — ไม่มีข้อความ ไม่มีบันทึกการใช้งาน ไม่มีข้อผิดพลาด
    if (!(price > 0)) { setRpError("ราคากลางต้องมากกว่า 0 บาท"); return; }
    if (price === reprice.price) { setRpError("ราคาใหม่เท่ากับราคาเดิม — ไม่มีอะไรต้องเปลี่ยน"); return; }
    setRpError("");
    setCatalog(prev => prev.map(p => p.id !== reprice.id ? p : {
      ...p, price, effectiveDate: todayTH(),
      // ราคาปัจจุบันถูกดันลงประวัติ (ใหม่สุดอยู่บน)
      priceHistory: [{ price: p.price, effectiveDate: p.effectiveDate, note: rpNote.trim() || undefined }, ...p.priceHistory],
    }));
    setReprice(null); setRpPrice(""); setRpNote(""); setRpError("");
  }
  function deleteProduct() {
    if (!delTarget) return;
    // สั่งลบตรง ๆ (เหตุผลเดียวกับหน้าตัวแทน — ห้ามอนุมานการลบจากอาร์เรย์ที่หายไป)
    const target = delTarget;
    void catalogRepo.remove(target.id)
      .then(() => setCatalog(prev => prev.filter(p => p.id !== target.id)))
      .catch(e => alert("ลบแม่แบบไม่สำเร็จ: " + friendlyError(e)));
    setDelTarget(null);
  }

  // ขนาดตัวอักษร/ช่องกรอกของฟอร์มแม่แบบ — ขยายขึ้นทั้งชุดตามที่ผู้ใช้แจ้งว่าเล็กเกินไป (14 ส.ค. 69)
  const inp: React.CSSProperties = { width: "100%", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "11px 14px", fontSize: "0.92rem", color: STEEL, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
  const lbl: React.CSSProperties = { display: "block", fontSize: "0.78rem", fontWeight: 700, color: MUTED, marginBottom: 7 };
  const pill: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem", fontWeight: 700, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 99, padding: "7px 16px" };

  return (
    <div className="erp">
      {/* Header */}
      <div className="page-head">
        {/* คำโปรยใต้ชื่อหน้าถูกเอาออกทุกหน้า (บอสสั่ง 14 ส.ค. 69) */}
        <div />
        <button className="btn btn-primary btn-md" onClick={openAdd}><Plus size={15} /> เพิ่มแม่แบบ</button>
      </div>

      {/* Summary — KPI มาตรฐานของ HQ (.hq-kpi4) : ป้าย → ตัวเลข → หน่วย/บริบท · ไอคอนกล่องสีจางมุมขวา
          เดิมหน้านี้ใช้ .hqx-kpi ชุดเก่า (แถบสีซ้าย + ไอคอนซ้าย + ตัวเลขขึ้นก่อนป้าย)
          หน้าเดียวในระบบที่หน้าตาไม่เหมือนชาวบ้าน (บอสแจ้ง 19 ส.ค. 69) · 3 ใบในตะแกรง 4 ช่อง → การ์ดกว้างเท่าหน้าอื่น */}
      <div className="hq-kpi4" style={{ marginBottom: "1.25rem" }}>
        {([
          { label: "แม่แบบทั้งหมด", value: `${catalog.length}`, sub: "รายการ", Icon: Building2, color: "#003366", bg: "#E8F0FE" },
          { label: "ราคากลางเฉลี่ย", value: fmtBaht(avgPrice), sub: "ต่อ ตร.ม.", Icon: Tag, color: "#0891B2", bg: "#E6F4F9" },
          { label: "แม่แบบย่อยทั้งหมด", value: `${totalSub}`, sub: "รายการ", Icon: Layers, color: "#059669", bg: "#E6F6EF" },
        ] as const).map(t => (
          <div key={t.label} className="card" style={{ marginBottom: 0, padding: "14px 14px 12px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: "0.68rem", color: "var(--muted-foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.label}</div>
              <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#1F2937", lineHeight: 1.2, marginTop: 5, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.015em", whiteSpace: "nowrap" }}>
                <CountUp value={t.value} />
              </div>
              <div style={{ fontSize: "0.65rem", color: "var(--muted-foreground)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.sub}</div>
            </div>
            <span style={{ width: 34, height: 34, borderRadius: 10, background: t.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <t.Icon size={17} color={t.color} strokeWidth={2.1} />
            </span>
          </div>
        ))}
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
                <button className="btn btn-secondary btn-sm" title="ประวัติราคา" style={{ width: 38, padding: 0, justifyContent: "center" }} aria-label={`ประวัติราคา ${p.name}`} onClick={e => { e.stopPropagation(); setHistory(p); }}><History size={13} /></button>
                <button className="btn btn-danger btn-sm" title="ลบแม่แบบ" style={{ width: 38, padding: 0, justifyContent: "center" }} aria-label={`ลบแม่แบบ ${p.name}`} onClick={e => { e.stopPropagation(); setDelTarget(p); }}><Trash2 size={13} /></button>
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
          <ModalCard onClose={() => setViewing(null)} label="รายละเอียดแม่แบบ" style={{ width: "100%", maxWidth: 580, maxHeight: "90vh", overflowY: "auto", background: "#fff", borderRadius: 16, boxShadow: "0 24px 64px rgba(0,0,0,.22)" }}>
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
                        <div style={{ padding: "6px 8px 7px", textAlign: "center", lineHeight: 1.3 }}>
                          <div style={{ fontSize: "0.7rem", fontWeight: 600, color: STEEL }}>{s}</div>
                          {/* ราคาที่ใช้จริงของแม่แบบย่อยนี้ — ตั้งเองไว้จะเข้ม ถ้ายังไม่ตั้งจะจางและบอกว่าใช้ราคาหลัก */}
                          <div style={{ fontSize: "0.64rem", marginTop: 2, fontWeight: viewing.subtypePrices?.[s] ? 800 : 500,
                            color: viewing.subtypePrices?.[s] ? PRIMARY : "#9ca3af" }}
                            title={viewing.subtypePrices?.[s] ? "ราคาเฉพาะของแม่แบบย่อยนี้" : "ใช้ราคาของแม่แบบหลัก"}>
                            {fmtBaht(catalogRate(viewing, s))}
                          </div>
                        </div>
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
          </ModalCard>
        </div>
      )}

      {/* ── รายละเอียดแม่แบบย่อย modal ── */}
      {subView && (
        <div onClick={() => setSubView(null)} style={{ position: "fixed", inset: 0, background: "rgba(45,45,45,.5)", zIndex: 210, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <ModalCard onClose={() => setSubView(null)} label="รายละเอียดประเภทย่อย" style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,.25)" }}>
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
                <span style={{ fontSize: "1.15rem", fontWeight: 800, color: PRIMARY }}>{fmtBaht(catalogRate(subView.parent, subView.sub))}</span>
                <span style={{ fontSize: "0.72rem", color: MUTED }}> /{subView.parent.unit}</span>
              </div>
            </div>
          </ModalCard>
        </div>
      )}

      {/* ── Add modal ── */}
      {adding && (
        <div onClick={() => setAdding(false)} style={{ position: "fixed", inset: 0, background: "rgba(45,45,45,.5)", zIndex: 220, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <ModalCard onClose={() => setAdding(false)} label="เพิ่มแม่แบบใหม่" className="modal-pop-flex" style={{ position: "static", width: "100%", maxWidth: 620, maxHeight: "92vh", display: "flex", flexDirection: "column", background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,.25)" }}>
            <div style={{ background: PRIMARY, color: "#fff", padding: "17px 24px", fontSize: "1.08rem", fontWeight: 800, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              เพิ่มแม่แบบใหม่
              <button onClick={() => setAdding(false)} style={{ background: "rgba(255,255,255,.15)", border: "none", borderRadius: 8, width: 28, height: 28, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={14} /></button>
            </div>
            <div className="form-grid" style={{ padding: 24, overflowY: "auto", flex: 1 }}>
              <div className="form-section">ข้อมูลแม่แบบ</div>
              <div className="col-full"><label style={lbl}>ชื่อแม่แบบ *</label><input style={inp} value={addForm.name} autoFocus onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} placeholder="เช่น โกดังสำเร็จรูป" /></div>
              <div className="col-full"><label style={lbl}>รูปแม่แบบ</label><ImageUpload value={addForm.image} onChange={v => setAddForm(f => ({ ...f, image: v }))} /></div>
              <div className="col-full"><label style={lbl}>รายละเอียด/สเปก</label><textarea style={{ ...inp, resize: "vertical" }} rows={3} value={addForm.spec} onChange={e => setAddForm(f => ({ ...f, spec: e.target.value }))} /></div>

              <div className="form-section">ราคากลาง</div>
              <div><label style={lbl}>ราคากลาง (บาท) *</label><input style={inp} type="number" min="0" step="0.01" value={addForm.price} onChange={e => setAddForm(f => ({ ...f, price: e.target.value }))} placeholder="5100" /></div>
              <div><label style={lbl}>หน่วย</label><input style={inp} value={addForm.unit} onChange={e => setAddForm(f => ({ ...f, unit: e.target.value }))} /></div>

              {/* แม่แบบย่อย — ใส่/แก้/ลบ ได้ตั้งแต่ตอนสร้าง */}
              <div className="form-section">แม่แบบย่อย</div>
              <div className="col-full">
                <label style={lbl}>แม่แบบย่อย ({addForm.subtypes.length})</label>
                <SubtypeEditor value={addForm.subtypes} images={addForm.subtypeImages}
                  prices={addForm.subtypePrices} mainPrice={parseFloat(addForm.price) || 0}
                  onChange={next => setAddForm(f => ({ ...f, subtypes: next }))}
                  onImagesChange={next => setAddForm(f => ({ ...f, subtypeImages: next }))}
                  onPricesChange={next => setAddForm(f => ({ ...f, subtypePrices: next }))} />
              </div>
            </div>
            <div style={{ padding: "14px 20px", borderTop: `1px solid ${BORDER}`, background: "#fafafa", display: "flex", justifyContent: "flex-end", gap: 8, flexShrink: 0 }}>
              <button className="btn btn-secondary btn-md" onClick={() => setAdding(false)}>ยกเลิก</button>
              <button className="btn btn-primary btn-md" onClick={addProduct} disabled={!addForm.name.trim() || !parseFloat(addForm.price)}
                style={!addForm.name.trim() || !parseFloat(addForm.price) ? { opacity: .5, cursor: "not-allowed" } : undefined}><Check size={14} /> บันทึก</button>
            </div>
          </ModalCard>
        </div>
      )}

      {/* ── Edit modal ── */}
      {editing && (
        <div onClick={() => setEditing(null)} style={{ position: "fixed", inset: 0, background: "rgba(45,45,45,.5)", zIndex: 220, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <ModalCard onClose={() => setEditing(null)} label="แก้ไขแม่แบบ" style={{ width: "100%", maxWidth: 460, maxHeight: "90vh", display: "flex", flexDirection: "column", background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,.25)" }}>
            <div style={{ background: PRIMARY, color: "#fff", padding: "15px 20px", fontSize: "0.92rem", fontWeight: 800, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              แก้ไขแม่แบบ
              <button onClick={() => setEditing(null)} style={{ background: "rgba(255,255,255,.15)", border: "none", borderRadius: 8, width: 28, height: 28, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={14} /></button>
            </div>
            <div className="form-grid" style={{ padding: 20, overflowY: "auto", flex: 1 }}>
              <div className="form-section">ข้อมูลแม่แบบ</div>
              <div className="col-full"><label style={lbl}>ชื่อแม่แบบ *</label><input style={inp} value={editForm.name} autoFocus onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div className="col-full"><label style={lbl}>รูปแม่แบบ</label><ImageUpload value={editForm.image} onChange={v => setEditForm(f => ({ ...f, image: v }))} /></div>
              <div className="col-full"><label style={lbl}>รายละเอียด/สเปก</label><textarea style={{ ...inp, resize: "vertical" }} rows={3} value={editForm.spec} onChange={e => setEditForm(f => ({ ...f, spec: e.target.value }))} /></div>
              <div className="col-full"><label style={lbl}>หน่วย</label><input style={inp} value={editForm.unit} onChange={e => setEditForm(f => ({ ...f, unit: e.target.value }))} /></div>
              {/* แม่แบบย่อย — เพิ่ม/แก้ไขชื่อ/ลบได้ (เลือกได้ในฟอร์มลูกค้าเป้าหมาย/ใบเสนอราคา) */}
              <div className="form-section">แม่แบบย่อย</div>
              <div className="col-full">
                <label style={lbl}>แม่แบบย่อย ({editForm.subtypes.length})</label>
                <SubtypeEditor value={editForm.subtypes} images={editForm.subtypeImages}
                  prices={editForm.subtypePrices} mainPrice={editing?.price ?? 0}
                  onChange={next => setEditForm(f => ({ ...f, subtypes: next }))}
                  onImagesChange={next => setEditForm(f => ({ ...f, subtypeImages: next }))}
                  onPricesChange={next => setEditForm(f => ({ ...f, subtypePrices: next }))} />
              </div>
              <div style={{ fontSize: "0.72rem", color: MUTED }}>ราคากลางแก้ผ่านปุ่ม &quot;ปรับราคา&quot; เพื่อบันทึกประวัติราคาเสมอ</div>
            </div>
            <div style={{ padding: "14px 20px", borderTop: `1px solid ${BORDER}`, background: "#fafafa", display: "flex", justifyContent: "flex-end", gap: 8, flexShrink: 0 }}>
              <button className="btn btn-secondary btn-md" onClick={() => setEditing(null)}>ยกเลิก</button>
              <button className="btn btn-primary btn-md" onClick={saveEdit}><Check size={14} /> บันทึก</button>
            </div>
          </ModalCard>
        </div>
      )}

      {/* ── Reprice modal ── */}
      {reprice && (
        <div onClick={() => setReprice(null)} style={{ position: "fixed", inset: 0, background: "rgba(45,45,45,.5)", zIndex: 220, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <ModalCard onClose={() => setReprice(null)} label="ปรับราคากลาง" style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,.25)" }}>
            <div style={{ background: PRIMARY, color: "#fff", padding: "15px 20px", fontSize: "0.92rem", fontWeight: 800 }}>ปรับราคากลาง — {reprice.name}</div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 13 }}>
              <div style={{ fontSize: "0.8rem", color: MUTED }}>ราคาปัจจุบัน <b style={{ color: STEEL }}>{fmtBaht(reprice.price)}/{reprice.unit}</b> (มีผล {reprice.effectiveDate})</div>
              {/* ป้ายชื่อกับช่องกรอกไม่ได้ผูกกันในโค้ด (ไม่มี htmlFor และป้ายไม่ได้ครอบช่อง)
                  → โปรแกรมอ่านหน้าจอไม่รู้ว่าช่องนี้คือช่องอะไร · ใส่ aria-label กำกับไว้ */}
              <div><label style={lbl}>ราคากลางใหม่ (บาท) *</label><input aria-label="ราคากลางใหม่ (บาท)" style={inp} type="number" min="0" step="0.01" value={rpPrice} autoFocus onChange={e => setRpPrice(e.target.value)} /></div>
              <div><label style={lbl}>หมายเหตุ</label><input style={inp} value={rpNote} onChange={e => setRpNote(e.target.value)} placeholder="เช่น ปรับตามราคาเหล็ก" /></div>
              {rpError && <div role="alert" style={{ fontSize: "0.74rem", color: "#b91c1c", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 10px" }}>{rpError}</div>}
              <div style={{ fontSize: "0.65rem", color: "#9ca3af" }}>ราคาเดิมจะถูกบันทึกลงประวัติราคาโดยอัตโนมัติ · มีผลทันทีทุกตัวแทน</div>
            </div>
            <div style={{ padding: "14px 20px", borderTop: `1px solid ${BORDER}`, background: "#fafafa", display: "flex", justifyContent: "flex-end", gap: 8, flexShrink: 0 }}>
              <button className="btn btn-secondary btn-md" onClick={() => { setReprice(null); setRpError(""); }}>ยกเลิก</button>
              <button className="btn btn-primary btn-md" onClick={saveReprice}><TrendingUp size={14} /> ปรับราคา</button>
            </div>
          </ModalCard>
        </div>
      )}

      {/* ── History modal ── */}
      {history && (
        <div onClick={() => setHistory(null)} style={{ position: "fixed", inset: 0, background: "rgba(45,45,45,.5)", zIndex: 220, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <ModalCard onClose={() => setHistory(null)} label="ประวัติการเปลี่ยนราคา" style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,.25)" }}>
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
          </ModalCard>
        </div>
      )}

      {/* ── Delete confirm ── */}
      {delTarget && (
        <div onClick={() => setDelTarget(null)} style={{ position: "fixed", inset: 0, background: "rgba(45,45,45,.5)", zIndex: 220, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <ModalCard onClose={() => setDelTarget(null)} label="ยืนยันการลบแม่แบบ" style={{ width: "100%", maxWidth: 360, background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,.25)" }}>
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
          </ModalCard>
        </div>
      )}
    </div>
  );
}
