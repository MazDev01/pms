"use client";

// ─── HQ · แคตตาล็อกแม่แบบ / ราคากลาง (แหล่งเดียวทั้งเครือ) ─────────────────
// HQ แก้ไขที่นี่ → persist ลง MASTER_CATALOG_KEY → Dealer (/products + dropdown ฟอร์ม)
// อ่านจากคีย์เดียวกันทันที · ขอบเขต Sales เท่านั้น (ไม่มี lead time/การส่งมอบ)
import { useState } from "react";
import { usePersistentState } from "@/lib/usePersistentState";
import { solutionProducts, MASTER_CATALOG_KEY, type SolutionProduct } from "@/lib/mock";
import { Search, Plus, Pencil, History, TrendingUp, X, Check, Trash2, Building2, CalendarClock } from "lucide-react";

const PRIMARY = "#003366";
const STEEL   = "#2D2D2D";
const MUTED   = "#6b7280";
const BORDER  = "#e5e7eb";

const fmtBaht = (v: number) => "฿" + v.toLocaleString("th-TH");
const TH_MONTHS = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
function todayTH() { const d = new Date(); return `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`; }

type EditForm = { name: string; spec: string; unit: string; subtypes: string[] };

export default function HQMasterPage() {
  const [catalog, setCatalog] = usePersistentState<SolutionProduct[]>(MASTER_CATALOG_KEY, solutionProducts);
  const [q, setQ] = useState("");

  // modals
  const [editing, setEditing]   = useState<SolutionProduct | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ name: "", spec: "", unit: "ตร.ม.", subtypes: [] });
  const [newSub, setNewSub]     = useState("");
  const [adding, setAdding]     = useState(false);
  const [addForm, setAddForm]   = useState({ name: "", spec: "", price: "", unit: "ตร.ม." });
  const [reprice, setReprice]   = useState<SolutionProduct | null>(null);
  const [rpPrice, setRpPrice]   = useState("");
  const [rpNote, setRpNote]     = useState("");
  const [history, setHistory]   = useState<SolutionProduct | null>(null);
  const [delTarget, setDelTarget] = useState<SolutionProduct | null>(null);

  const filtered = catalog.filter(p =>
    !q || p.name.toLowerCase().includes(q.toLowerCase()) || p.spec.toLowerCase().includes(q.toLowerCase()));
  const avgPrice = catalog.length ? Math.round(catalog.reduce((s, p) => s + p.price, 0) / catalog.length) : 0;

  function openEdit(p: SolutionProduct) {
    setEditing(p); setEditForm({ name: p.name, spec: p.spec, unit: p.unit, subtypes: [...(p.subtypes ?? [])] }); setNewSub("");
  }
  function addSubtype() {
    const v = newSub.trim();
    if (!v || editForm.subtypes.includes(v)) { setNewSub(""); return; }
    setEditForm(f => ({ ...f, subtypes: [...f.subtypes, v] })); setNewSub("");
  }
  function saveEdit() {
    if (!editing || !editForm.name.trim()) return;
    setCatalog(prev => prev.map(p => p.id !== editing.id ? p : { ...p, name: editForm.name.trim(), spec: editForm.spec.trim(), unit: editForm.unit.trim() || "ตร.ม.", subtypes: editForm.subtypes }));
    setEditing(null);
  }
  function addProduct() {
    const price = parseFloat(addForm.price);
    if (!addForm.name.trim() || !price) return;
    const nid = Math.max(0, ...catalog.map(p => parseInt(p.id.replace(/\D/g, "")) || 0)) + 1;
    setCatalog(prev => [...prev, {
      id: `tpl-${nid}`, name: addForm.name.trim(), spec: addForm.spec.trim(),
      price, unit: addForm.unit.trim() || "ตร.ม.", effectiveDate: todayTH(), priceHistory: [],
    }]);
    setAddForm({ name: "", spec: "", price: "", unit: "ตร.ม." }); setAdding(false);
  }
  function saveReprice() {
    const price = parseFloat(rpPrice);
    if (!reprice || !price || price === reprice.price) { setReprice(null); return; }
    setCatalog(prev => prev.map(p => p.id !== reprice.id ? p : {
      ...p, price, effectiveDate: todayTH(),
      // ราคาปัจจุบันถูกดันลงประวัติ (ใหม่สุดอยู่บน)
      priceHistory: [{ price: p.price, effectiveDate: p.effectiveDate, note: rpNote.trim() || undefined }, ...p.priceHistory],
    }));
    setReprice(null); setRpPrice(""); setRpNote("");
  }
  function deleteProduct() {
    if (!delTarget) return;
    setCatalog(prev => prev.filter(p => p.id !== delTarget.id));
    setDelTarget(null);
  }

  const inp: React.CSSProperties = { width: "100%", border: `1px solid ${BORDER}`, borderRadius: 9, padding: "9px 12px", fontSize: "0.82rem", color: STEEL, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
  const lbl: React.CSSProperties = { display: "block", fontSize: "0.68rem", fontWeight: 700, color: MUTED, marginBottom: 5 };
  const pill: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, fontSize: "0.78rem", fontWeight: 700, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 99, padding: "7px 16px" };

  return (
    <div className="erp">
      {/* Header */}
      <div className="page-head">
        <div>
          <h2>แคตตาล็อกแม่แบบ</h2>
          <p>แหล่งเดียวทั้งเครือ — ตัวแทนเห็นแม่แบบและราคากลางชุดเดียวกันนี้ (อ่านอย่างเดียว)</p>
        </div>
        <button className="btn btn-primary btn-md" onClick={() => setAdding(true)}><Plus size={15} /> เพิ่มแม่แบบ</button>
      </div>

      {/* Summary pills */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <div style={pill}>แม่แบบทั้งหมด: <span style={{ color: PRIMARY }}>{catalog.length}</span></div>
        <div style={pill}>ราคากลางเฉลี่ย: <span style={{ color: PRIMARY }}>{fmtBaht(avgPrice)}/ตร.ม.</span></div>
      </div>

      {/* Toolbar */}
      <div className="card" style={{ padding: "12px 16px", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fafafa", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "8px 12px", flex: 1, maxWidth: 340 }}>
          <Search size={13} color={MUTED} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="ค้นหาแม่แบบ..."
            style={{ border: "none", outline: "none", fontSize: "0.8rem", color: STEEL, background: "transparent", flex: 1 }} />
          {q && <button onClick={() => setQ("")} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, padding: 0, display: "flex" }}><X size={13} /></button>}
        </div>
      </div>

      {/* Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(310px,1fr))", gap: 16 }}>
        {filtered.map(p => (
          <div key={p.id} className="card tpl-card" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* ── Hero: ไทล์ + ป้ายจำนวนแม่แบบย่อย ── */}
            <div style={{ position: "relative", height: 104, background: "#f0f4f9", display: "flex", alignItems: "center", justifyContent: "center", borderBottom: `1px solid ${BORDER}`, overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(#00336610 1px, transparent 1px), linear-gradient(90deg, #00336610 1px, transparent 1px)", backgroundSize: "22px 22px", opacity: 0.5 }} />
              <div className="tpl-hero" style={{ width: 54, height: 54, borderRadius: 14, background: "#fff", border: `1px solid ${BORDER}`, boxShadow: "0 6px 16px rgba(0,51,102,.12)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1 }}>
                <Building2 size={26} style={{ color: PRIMARY }} />
              </div>
              {p.subtypes && p.subtypes.length > 0 && (
                <span style={{ position: "absolute", top: 11, right: 11, fontSize: "0.62rem", fontWeight: 700, color: PRIMARY, background: "rgba(255,255,255,.85)", border: `1px solid #dce5f0`, borderRadius: 999, padding: "3px 10px" }}>{p.subtypes.length} แม่แบบย่อย</span>
              )}
            </div>

            {/* ── เนื้อหา ── */}
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 9, flex: 1 }}>
              <div style={{ fontSize: "0.98rem", fontWeight: 800, color: STEEL, lineHeight: 1.3 }}>{p.name}</div>
              <div className="tpl-clamp2" style={{ fontSize: "0.75rem", color: MUTED, lineHeight: 1.5, minHeight: "2.25em" }}>{p.spec}</div>

              {p.subtypes && p.subtypes.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {p.subtypes.map(s => (
                    <span key={s} style={{ fontSize: "0.67rem", fontWeight: 600, color: PRIMARY, background: "#eef3f8", border: `1px solid #dce5f0`, borderRadius: 7, padding: "3px 9px" }}>{s}</span>
                  ))}
                </div>
              )}

              {/* เส้นคั่น + ราคา */}
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8, marginTop: "auto", paddingTop: 12, borderTop: `1px solid ${BORDER}` }}>
                <div>
                  <div style={{ fontSize: "0.62rem", color: MUTED, fontWeight: 700, marginBottom: 1 }}>ราคากลาง</div>
                  <span style={{ fontSize: "1.28rem", fontWeight: 800, color: PRIMARY, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>{fmtBaht(p.price)}</span>
                  <span style={{ fontSize: "0.72rem", color: MUTED }}> /{p.unit}</span>
                </div>
                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.65rem", color: "#9ca3af", whiteSpace: "nowrap" }}><CalendarClock size={11} /> {p.effectiveDate}</span>
              </div>

              {/* ปุ่มจัดการ */}
              <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                <button className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => openEdit(p)}><Pencil size={12} /> แก้ไข</button>
                <button className="btn btn-tint btn-sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => { setReprice(p); setRpPrice(String(p.price)); }}><TrendingUp size={12} /> ปรับราคา</button>
                <button className="btn btn-secondary btn-sm" title="ประวัติราคา" style={{ width: 38, padding: 0, justifyContent: "center" }} onClick={() => setHistory(p)}><History size={13} /></button>
                <button className="btn btn-danger btn-sm" title="ลบแม่แบบ" style={{ width: 38, padding: 0, justifyContent: "center" }} onClick={() => setDelTarget(p)}><Trash2 size={13} /></button>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="card" style={{ gridColumn: "1/-1", padding: 40, textAlign: "center", color: "#9ca3af", fontSize: "0.82rem" }}>ไม่พบแม่แบบ</div>
        )}
      </div>

      {/* ── Add modal ── */}
      {adding && (
        <div onClick={() => setAdding(false)} style={{ position: "fixed", inset: 0, background: "rgba(45,45,45,.5)", zIndex: 220, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={e => e.stopPropagation()} className="modal-pop" style={{ position: "static", transform: "none", width: "100%", maxWidth: 460, background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,.25)" }}>
            <div style={{ background: PRIMARY, color: "#fff", padding: "15px 20px", fontSize: "0.95rem", fontWeight: 800, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              เพิ่มแม่แบบใหม่
              <button onClick={() => setAdding(false)} style={{ background: "rgba(255,255,255,.15)", border: "none", borderRadius: 8, width: 28, height: 28, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={14} /></button>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 13 }}>
              <div><label style={lbl}>ชื่อแม่แบบ *</label><input style={inp} value={addForm.name} autoFocus onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} placeholder="เช่น โกดังสำเร็จรูป" /></div>
              <div><label style={lbl}>รายละเอียด/สเปก</label><textarea style={{ ...inp, resize: "vertical" }} rows={3} value={addForm.spec} onChange={e => setAddForm(f => ({ ...f, spec: e.target.value }))} /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div><label style={lbl}>ราคากลาง (บาท) *</label><input style={inp} type="number" value={addForm.price} onChange={e => setAddForm(f => ({ ...f, price: e.target.value }))} placeholder="5100" /></div>
                <div><label style={lbl}>หน่วย</label><input style={inp} value={addForm.unit} onChange={e => setAddForm(f => ({ ...f, unit: e.target.value }))} /></div>
              </div>
            </div>
            <div style={{ padding: "14px 20px", borderTop: `1px solid ${BORDER}`, background: "#fafafa", display: "flex", justifyContent: "flex-end", gap: 8 }}>
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
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 460, background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,.25)" }}>
            <div style={{ background: PRIMARY, color: "#fff", padding: "15px 20px", fontSize: "0.95rem", fontWeight: 800, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              แก้ไขแม่แบบ
              <button onClick={() => setEditing(null)} style={{ background: "rgba(255,255,255,.15)", border: "none", borderRadius: 8, width: 28, height: 28, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={14} /></button>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 13 }}>
              <div><label style={lbl}>ชื่อแม่แบบ *</label><input style={inp} value={editForm.name} autoFocus onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><label style={lbl}>รายละเอียด/สเปก</label><textarea style={{ ...inp, resize: "vertical" }} rows={3} value={editForm.spec} onChange={e => setEditForm(f => ({ ...f, spec: e.target.value }))} /></div>
              <div><label style={lbl}>หน่วย</label><input style={inp} value={editForm.unit} onChange={e => setEditForm(f => ({ ...f, unit: e.target.value }))} /></div>
              {/* แม่แบบย่อย — เพิ่ม/ลบได้ (เลือกได้ในฟอร์มลูกค้าเป้าหมาย/ใบเสนอราคา) */}
              <div>
                <label style={lbl}>แม่แบบย่อย ({editForm.subtypes.length})</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                  {editForm.subtypes.length === 0 && <span style={{ fontSize: "0.72rem", color: MUTED }}>ยังไม่มีแม่แบบย่อย</span>}
                  {editForm.subtypes.map(s => (
                    <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "0.72rem", fontWeight: 600, color: PRIMARY, background: "#eef3f8", border: `1px solid #dce5f0`, borderRadius: 7, padding: "3px 6px 3px 9px" }}>
                      {s}
                      <button onClick={() => setEditForm(f => ({ ...f, subtypes: f.subtypes.filter(x => x !== s) }))}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", display: "flex", padding: 0 }}><X size={12} /></button>
                    </span>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <input style={{ ...inp, flex: 1 }} value={newSub} placeholder="เพิ่มแม่แบบย่อย เช่น โรงงานอาหาร"
                    onChange={e => setNewSub(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addSubtype(); } }} />
                  <button className="btn btn-secondary btn-md" onClick={addSubtype} style={{ flexShrink: 0 }}><Plus size={14} /> เพิ่ม</button>
                </div>
              </div>
              <div style={{ fontSize: "0.7rem", color: MUTED }}>ราคากลางแก้ผ่านปุ่ม "ปรับราคา" เพื่อบันทึกประวัติราคาเสมอ</div>
            </div>
            <div style={{ padding: "14px 20px", borderTop: `1px solid ${BORDER}`, background: "#fafafa", display: "flex", justifyContent: "flex-end", gap: 8 }}>
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
            <div style={{ background: PRIMARY, color: "#fff", padding: "15px 20px", fontSize: "0.95rem", fontWeight: 800 }}>ปรับราคากลาง — {reprice.name}</div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 13 }}>
              <div style={{ fontSize: "0.78rem", color: MUTED }}>ราคาปัจจุบัน <b style={{ color: STEEL }}>{fmtBaht(reprice.price)}/{reprice.unit}</b> (มีผล {reprice.effectiveDate})</div>
              <div><label style={lbl}>ราคากลางใหม่ (บาท) *</label><input style={inp} type="number" value={rpPrice} autoFocus onChange={e => setRpPrice(e.target.value)} /></div>
              <div><label style={lbl}>หมายเหตุ</label><input style={inp} value={rpNote} onChange={e => setRpNote(e.target.value)} placeholder="เช่น ปรับตามราคาเหล็ก" /></div>
              <div style={{ fontSize: "0.68rem", color: "#9ca3af" }}>ราคาเดิมจะถูกบันทึกลงประวัติราคาโดยอัตโนมัติ · มีผลทันทีทุกตัวแทน</div>
            </div>
            <div style={{ padding: "14px 20px", borderTop: `1px solid ${BORDER}`, background: "#fafafa", display: "flex", justifyContent: "flex-end", gap: 8 }}>
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
            <div style={{ background: PRIMARY, color: "#fff", padding: "15px 20px", fontSize: "0.95rem", fontWeight: 800, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              ประวัติราคา — {history.name}
              <button onClick={() => setHistory(null)} style={{ background: "rgba(255,255,255,.15)", border: "none", borderRadius: 8, width: 28, height: 28, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={14} /></button>
            </div>
            <div style={{ padding: 20, maxHeight: 360, overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", borderRadius: 10, background: "#dce5f0", marginBottom: 8 }}>
                <span style={{ fontSize: "0.78rem", fontWeight: 700, color: PRIMARY }}>ปัจจุบัน · {history.effectiveDate}</span>
                <span style={{ fontSize: "0.85rem", fontWeight: 800, color: PRIMARY }}>{fmtBaht(history.price)}/{history.unit}</span>
              </div>
              {history.priceHistory.map((h, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", borderBottom: "1px solid #f0f4f8" }}>
                  <div>
                    <div style={{ fontSize: "0.76rem", color: STEEL, fontWeight: 600 }}>{h.effectiveDate}</div>
                    {h.note && <div style={{ fontSize: "0.64rem", color: MUTED }}>{h.note}</div>}
                  </div>
                  <span style={{ fontSize: "0.8rem", fontWeight: 700, color: MUTED, fontVariantNumeric: "tabular-nums" }}>{fmtBaht(h.price)}</span>
                </div>
              ))}
              {history.priceHistory.length === 0 && <div style={{ fontSize: "0.76rem", color: "#9ca3af", textAlign: "center", padding: "16px 0" }}>ยังไม่มีประวัติการปรับราคา</div>}
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
              <p style={{ fontSize: "0.82rem", color: MUTED, lineHeight: 1.6, margin: 0 }}>ต้องการลบ <strong style={{ color: STEEL }}>{delTarget.name}</strong>? ตัวแทนจะไม่เห็นแม่แบบนี้อีก</p>
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
