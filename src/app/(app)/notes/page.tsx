"use client";

import { useState, useMemo } from "react";
import {
  notes as INIT_NOTES, noteCategoryColor,
  type NoteMock, type NoteCategory,
} from "@/lib/mock";
import {
  Plus, Search, X, Pin, PinOff, Pencil, Trash2, StickyNote,
} from "lucide-react";

// ── Tokens (HQ) ───────────────────────────────────────────────
const PRIMARY = "#003366";
const STEEL   = "#2D2D2D";
const BORDER  = "#e5e7eb";
const MUTED   = "#6b7280";

const CATEGORIES: NoteCategory[] = ["ลูกค้า", "โอกาสการขาย", "ประชุม", "ทั่วไป"];
const TODAY = "2026-06-29 09:00";

type NForm = { title: string; content: string; category: NoteCategory; customerName: string };

function blankForm(): NForm { return { title: "", content: "", category: "ทั่วไป", customerName: "" }; }

export default function NotesPage() {
  const [notes, setNotes] = useState<NoteMock[]>(INIT_NOTES);
  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState<NoteCategory | "ทั้งหมด">("ทั้งหมด");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<NForm>(blankForm());

  const filtered = useMemo(() => notes.filter(n => {
    if (catFilter !== "ทั้งหมด" && n.category !== catFilter) return false;
    if (q && !`${n.title} ${n.content} ${n.customerName ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [notes, q, catFilter]);

  const pinned = filtered.filter(n => n.pinned);
  const rest = filtered.filter(n => !n.pinned);

  function openAdd() { setEditId(null); setForm(blankForm()); setShowForm(true); }
  function openEdit(n: NoteMock) { setEditId(n.id); setForm({ title: n.title, content: n.content, category: n.category, customerName: n.customerName ?? "" }); setShowForm(true); }

  function save() {
    if (!form.title.trim()) return;
    if (editId != null) {
      setNotes(prev => prev.map(n => n.id === editId ? { ...n, title: form.title.trim(), content: form.content, category: form.category, customerName: form.customerName || undefined, updatedAt: TODAY, color: noteCategoryColor[form.category].dot } : n));
    } else {
      const id = Math.max(0, ...notes.map(n => n.id)) + 1;
      setNotes(prev => [{ id, title: form.title.trim(), content: form.content, category: form.category, pinned: false, customerName: form.customerName || undefined, author: "สมชาย", createdAt: TODAY, updatedAt: TODAY, color: noteCategoryColor[form.category].dot }, ...prev]);
    }
    setShowForm(false);
  }
  function togglePin(id: number) { setNotes(prev => prev.map(n => n.id === id ? { ...n, pinned: !n.pinned } : n)); }
  function remove(id: number) { if (confirm("ลบโน้ตนี้?")) setNotes(prev => prev.filter(n => n.id !== id)); }

  function NoteCard({ n }: { n: NoteMock }) {
    const c = noteCategoryColor[n.category];
    return (
      <div className="card" style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8, position: "relative" }}>
        <div style={{ position: "absolute", left: 0, top: 14, bottom: 14, width: 3, borderRadius: 99, background: n.color }} />
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, paddingLeft: 6 }}>
          <div style={{ fontSize: "0.88rem", fontWeight: 800, color: STEEL, lineHeight: 1.3 }}>{n.title}</div>
          <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
            <button onClick={() => togglePin(n.id)} title={n.pinned ? "เลิกปักหมุด" : "ปักหมุด"} style={iconBtn(n.pinned ? PRIMARY : MUTED)}>
              {n.pinned ? <Pin size={13} fill={PRIMARY} /> : <PinOff size={13} />}
            </button>
            <button onClick={() => openEdit(n)} title="แก้ไข" style={iconBtn(MUTED)}><Pencil size={13} /></button>
            <button onClick={() => remove(n.id)} title="ลบ" style={iconBtn("#dc2626")}><Trash2 size={13} /></button>
          </div>
        </div>
        <span className="badge" style={{ alignSelf: "flex-start", marginLeft: 6, background: c.bg, color: c.text }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.dot }} /> {n.category}
        </span>
        <div style={{ fontSize: "0.78rem", color: "#4b5563", whiteSpace: "pre-wrap", lineHeight: 1.55, paddingLeft: 6, maxHeight: 160, overflow: "hidden" }}>{n.content}</div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.66rem", color: MUTED, paddingLeft: 6, marginTop: 2, borderTop: `1px solid ${BORDER}`, paddingTop: 8 }}>
          <span>{n.customerName ?? n.author}</span>
          <span>{n.updatedAt}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="erp">
      <div className="page-head">
        <div>
          <h2>โน้ต</h2>
          <p>บันทึกย่อ ความคืบหน้าโอกาสการขาย และสรุปการคุยกับลูกค้าของคุณ</p>
        </div>
        <button onClick={openAdd} className="btn btn-primary btn-md">
          <Plus size={14} /> เพิ่มโน้ต
        </button>
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <div className="search-bar" style={{ minWidth: 220 }}>
          <Search size={13} color={MUTED} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="ค้นหาโน้ต..." />
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["ทั้งหมด", ...CATEGORIES].map(c => {
            const active = catFilter === c;
            return (
              <button key={c} onClick={() => setCatFilter(c as NoteCategory | "ทั้งหมด")}
                className={`btn btn-sm ${active ? "btn-tint" : "btn-secondary"}`} style={{ borderRadius: 99 }}>
                {c}
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ padding: "48px", textAlign: "center", color: MUTED }}>
          <StickyNote size={32} color="#C0C0C0" style={{ marginBottom: 10 }} />
          <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>ยังไม่มีโน้ต</div>
        </div>
      ) : (
        <>
          {pinned.length > 0 && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.66rem", fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                <Pin size={12} /> ปักหมุด
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12, marginBottom: 18 }}>
                {pinned.map(n => <NoteCard key={n.id} n={n} />)}
              </div>
            </>
          )}
          {rest.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
              {rest.map(n => <NoteCard key={n.id} n={n} />)}
            </div>
          )}
        </>
      )}

      {/* Add / Edit modal */}
      {showForm && (
        <div onClick={() => setShowForm(false)} style={{ position: "fixed", inset: 0, background: "rgba(45,45,45,.42)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={e => e.stopPropagation()} className="card" style={{ width: 520, maxWidth: "100%", overflow: "hidden", boxShadow: "0 24px 80px rgba(0,0,0,.2)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", background: PRIMARY }}>
              <div style={{ fontSize: "0.92rem", fontWeight: 800, color: "#fff" }}>{editId != null ? "แก้ไขโน้ต" : "เพิ่มโน้ตใหม่"}</div>
              <button onClick={() => setShowForm(false)} style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid rgba(255,255,255,.2)", background: "rgba(255,255,255,.1)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={13} /></button>
            </div>
            <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label className="form-label">หัวข้อ *</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="เช่น สรุปการโทรหา..." className="form-input" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="form-label">หมวดหมู่</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as NoteCategory }))} className="form-select" style={{ cursor: "pointer" }}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">ลูกค้า (ถ้ามี)</label>
                  <input value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))} placeholder="ชื่อบริษัท..." className="form-input" />
                </div>
              </div>
              <div>
                <label className="form-label">เนื้อหา</label>
                <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} rows={7} placeholder="พิมพ์รายละเอียด..." className="form-textarea" style={{ resize: "vertical", lineHeight: 1.5 }} />
              </div>
            </div>
            <div style={{ padding: "13px 22px", borderTop: `1px solid ${BORDER}`, display: "flex", gap: 8, justifyContent: "flex-end", background: "#fafafa" }}>
              <button onClick={() => setShowForm(false)} className="btn btn-secondary btn-md">ยกเลิก</button>
              <button onClick={save} className="btn btn-primary btn-md">บันทึก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function iconBtn(color: string): React.CSSProperties {
  return { width: 26, height: 26, borderRadius: 7, border: "none", background: "transparent", color, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };
}
