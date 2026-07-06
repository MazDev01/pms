"use client";

import { useState } from "react";
import { FilePlus, Eye, Pencil, Printer, Copy, Trash2, X, ArrowLeft, Send } from "lucide-react";
import { useSales } from "@/context/SalesContext";
import {
  quotationStatusLabel, quotationStatusColor,
  type LeadRow, type QuotationMock,
} from "@/lib/mock";
import { useMasterCatalog } from "@/lib/useMasterCatalog";
import { printQuotation } from "@/lib/quotationPrint";
import { parseBaht, fmtBaht } from "@/lib/format";

const MOCK_TODAY = "2026-06-30";

type FormState = { project: string; buildingType: string; items: string; price: string; discountPct: string; expiry: string; note: string };

export function LeadQuotationsPanel({ lead, onToast }: { lead: LeadRow; onToast?: (m: string) => void }) {
  const { quotations, addQuotation, updateQuotation, deleteQuotation } = useSales();
  const catalog = useMasterCatalog(); // แม่แบบจากแคตตาล็อกกลาง (HQ กำหนด)
  const [mode, setMode] = useState<"list" | "create" | "edit" | "view">("list");
  const [editing, setEditing] = useState<QuotationMock | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const emptyForm = (): FormState => ({
    project: `${lead.product} — ${lead.company}`, buildingType: lead.product,
    items: "1", price: lead.value ?? "", discountPct: "", expiry: "", note: "",
  });
  const [form, setForm] = useState<FormState>(emptyForm);
  const set = <K extends keyof FormState>(k: K, v: string) => setForm(p => ({ ...p, [k]: v }));

  // ใบเสนอราคาของลูกค้ารายนี้ (ตาม customerId หรือชื่อบริษัท) — อัปเดตทันทีจาก context
  const related = quotations
    .filter(q => (lead.customerId && q.customerId === lead.customerId) || q.customer === lead.company)
    .sort((a, b) => b.date.localeCompare(a.date));

  function nextQId() {
    const nums = quotations.map(q => { const m = q.id.match(/(\d+)\s*$/); return m ? parseInt(m[1]) : 0; });
    return `Q-2026-${String(Math.max(0, ...nums) + 1).padStart(4, "0")}`;
  }
  function netTotal(f: FormState) {
    const price = parseBaht(f.price);
    return Math.round(price * (1 - (parseFloat(f.discountPct) || 0) / 100));
  }

  function openCreate() { setEditing(null); setForm(emptyForm()); setMode("create"); }
  function openEdit(q: QuotationMock) {
    setEditing(q);
    setForm({ project: q.project, buildingType: q.buildingType, items: String(q.items || 1),
      price: String(q.materialCost || q.totalValue), discountPct: String(q.discountPct ?? ""), expiry: q.expiry ?? "", note: q.note ?? "" });
    setMode("edit");
  }

  function save() {
    const net = netTotal(form);
    if (mode === "edit" && editing) {
      updateQuotation({ ...editing, project: form.project, buildingType: form.buildingType, items: parseInt(form.items) || 1,
        materialCost: parseBaht(form.price), totalValue: net, total: "฿" + net.toLocaleString("th-TH"),
        expiry: form.expiry || "", discountPct: parseFloat(form.discountPct) || 0, note: form.note || undefined });
      onToast?.("บันทึกใบเสนอราคาแล้ว");
    } else {
      // สร้างใหม่ — ออกใบในนามผู้สนใจ (ยังไม่สร้างลูกค้า · ลูกค้าจะถูกสร้างเมื่อปิดการขายสำเร็จเท่านั้น)
      addQuotation({
        id: nextQId(), customer: lead.company, project: form.project || `${lead.product} — ${lead.company}`,
        total: "฿" + net.toLocaleString("th-TH"), totalValue: net, materialCost: parseBaht(form.price),
        province: lead.province, buildingType: form.buildingType, area: 0,
        status: "draft", date: MOCK_TODAY, items: parseInt(form.items) || 1,
        customerId: lead.customerId ?? 0, projectId: 0, revision: "V1", expiry: form.expiry || "",
        discountPct: parseFloat(form.discountPct) || 0, note: form.note || undefined,
      });
      onToast?.("สร้างใบเสนอราคาเรียบร้อย");
    }
    setMode("list");
  }

  function duplicate(q: QuotationMock) {
    addQuotation({ ...q, id: nextQId(), status: "draft", revision: "V1", date: MOCK_TODAY });
    onToast?.("ทำสำเนาใบเสนอราคาแล้ว");
  }

  // ส่งใบเสนอราคาให้ลูกค้า → สถานะเป็น "ส่งแล้ว" (เลื่อน stage + ติ๊กงานให้ลีดอัตโนมัติผ่าน context)
  function sendQuote(q: QuotationMock) {
    const resend = q.status !== "draft";
    updateQuotation({ ...q, status: "sent_to_client", date: MOCK_TODAY });
    onToast?.(resend ? `ส่งใบเสนอราคา ${q.id} ให้ลูกค้าอีกครั้งแล้ว` : `ส่งใบเสนอราคา ${q.id} ให้ลูกค้าแล้ว`);
  }

  const lbl: React.CSSProperties = { display: "block", fontSize: "0.68rem", fontWeight: 700, color: "#6b7280", marginBottom: 4 };
  const inp: React.CSSProperties = { width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: "0.82rem", fontFamily: "inherit", color: "#2D2D2D", background: "#fff" };
  const ro: React.CSSProperties = { ...inp, background: "#f8f9fb", color: "#6b7280" };

  // ── ฟอร์มสร้าง/แก้ไข (inline) ──
  if (mode === "create" || mode === "edit") {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <button onClick={() => setMode("list")} className="btn btn-secondary btn-sm" style={{ color: "#374151", padding: "5px 10px" }}><ArrowLeft size={13} /> กลับ</button>
          <div style={{ fontSize: "0.9rem", fontWeight: 800, color: "#003366" }}>{mode === "edit" ? `แก้ไข ${editing?.id}` : "สร้างใบเสนอราคา"}</div>
        </div>

        {/* ข้อมูลจาก Lead — เติมอัตโนมัติ (อ่านอย่างเดียว) */}
        <div style={{ background: "#f0f4fa", border: "1px solid #dce5f0", borderRadius: 10, padding: "10px 12px", marginBottom: 14, fontSize: "0.72rem", color: "#475569", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px 14px" }}>
          <div><b>ลูกค้า:</b> {lead.contact}</div><div><b>บริษัท:</b> {lead.company}</div>
          <div><b>โทร:</b> {lead.phone || "—"}</div><div><b>อีเมล:</b> {lead.email || "—"}</div>
          <div><b>จังหวัด:</b> {lead.province}</div><div><b>ผู้รับผิดชอบ:</b> {lead.assigned}</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ gridColumn: "1/-1" }}><label style={lbl}>รายการ / โครงการ</label>
            <input value={form.project} onChange={e => set("project", e.target.value)} style={inp} /></div>
          <div><label style={lbl}>แม่แบบที่เสนอ</label>
            <select value={form.buildingType} onChange={e => set("buildingType", e.target.value)} style={inp}>
              {!catalog.some(p => p.name === form.buildingType) && form.buildingType && <option value={form.buildingType}>{form.buildingType}</option>}
              {catalog.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
            </select></div>
          <div><label style={lbl}>จำนวนรายการ</label>
            <input type="number" min={1} value={form.items} onChange={e => set("items", e.target.value)} style={inp} /></div>
          <div><label style={lbl}>ราคา (ก่อนส่วนลด)</label>
            <input value={form.price} onChange={e => set("price", e.target.value)} placeholder="เช่น 1200000 หรือ ฿1.2M" style={inp} /></div>
          <div><label style={lbl}>ส่วนลด (%)</label>
            <input type="number" min={0} max={100} value={form.discountPct} onChange={e => set("discountPct", e.target.value)} placeholder="0" style={inp} /></div>
          <div><label style={lbl}>วันหมดอายุ</label>
            <input type="date" value={form.expiry} onChange={e => set("expiry", e.target.value)} style={inp} /></div>
          <div><label style={lbl}>ยอดสุทธิ (คำนวณ)</label>
            <input value={fmtBaht(netTotal(form))} readOnly style={{ ...ro, fontWeight: 800, color: "#003366" }} /></div>
          <div style={{ gridColumn: "1/-1" }}><label style={lbl}>หมายเหตุ</label>
            <textarea value={form.note} onChange={e => set("note", e.target.value)} rows={2} placeholder="รายละเอียดเพิ่มเติม…" style={{ ...inp, resize: "vertical", lineHeight: 1.6 }} /></div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button onClick={() => setMode("list")} className="btn btn-secondary btn-sm" style={{ color: "#374151" }}>ยกเลิก</button>
          <button onClick={save} className="btn btn-primary btn-sm"><FilePlus size={13} /> {mode === "edit" ? "บันทึก" : "สร้างใบเสนอราคา"}</button>
        </div>
      </div>
    );
  }

  // ── มุมมองอ่านอย่างเดียว (View) ──
  if (mode === "view" && editing) {
    const q = editing; const c = quotationStatusColor[q.status];
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <button onClick={() => setMode("list")} className="btn btn-secondary btn-sm" style={{ color: "#374151", padding: "5px 10px" }}><ArrowLeft size={13} /> กลับ</button>
          <div style={{ fontSize: "0.9rem", fontWeight: 800, color: "#003366" }}>{q.id} · {q.revision ?? "V1"}</div>
          <span className="badge" style={{ background: c.bg, color: c.text, marginLeft: "auto" }}>{quotationStatusLabel[q.status]}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: "0.82rem" }}>
          {[["ลูกค้า", q.customer], ["โครงการ", q.project], ["แม่แบบ", q.buildingType], ["จังหวัด", q.province], ["จำนวน", `${q.items} รายการ`],
            ["ส่วนลด", q.discountPct ? `${q.discountPct}%` : "—"], ["ยอดสุทธิ", fmtBaht(q.totalValue)], ["วันหมดอายุ", q.expiry || "—"], ["หมายเหตุ", q.note || "—"]].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", borderBottom: "1px solid #f0f4f8" }}>
              <span style={{ color: "#6b7280", flexShrink: 0 }}>{k}</span><span style={{ fontWeight: 600, color: "#2D2D2D", textAlign: "right" }}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button onClick={() => printQuotation(q, { company: lead.company, name: lead.contact, phone: lead.phone, province: lead.province })} className="btn btn-secondary btn-sm" style={{ color: "#374151" }}><Printer size={13} /> พิมพ์ PDF</button>
          <button onClick={() => openEdit(q)} className="btn btn-secondary btn-sm" style={{ color: "#374151" }}><Pencil size={13} /> แก้ไข</button>
          {(q.status === "draft" || q.status === "sent_to_client" || q.status === "viewed") && (
            <button onClick={() => { sendQuote(q); setMode("list"); }} className="btn btn-primary btn-sm">
              <Send size={13} /> {q.status === "draft" ? "ส่งใบเสนอราคา" : "ส่งอีกครั้ง"}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── รายการ (list) + ปุ่มสร้าง inline ──
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12 }}>
        <div style={{ fontSize: "0.72rem", color: "#6b7280", fontWeight: 700 }}>ใบเสนอราคา · {related.length} ฉบับ</div>
        <button onClick={openCreate} className="btn btn-primary btn-sm"><FilePlus size={13} /> สร้างใบเสนอราคา</button>
      </div>

      {related.length === 0 ? (
        <div style={{ textAlign: "center", padding: "28px 0", color: "#9aa2ad", fontSize: "0.82rem" }}>ยังไม่มีใบเสนอราคา — กด “สร้างใบเสนอราคา” เพื่อเริ่ม</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {related.map(q => {
            const c = quotationStatusColor[q.status];
            return (
              <div key={q.id} style={{ padding: "10px 12px", borderRadius: 10, background: "#f8f9fb", border: "1px solid #f0f4f8" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ fontSize: "0.8rem", fontWeight: 800, color: "#2D2D2D" }}>{q.id}</span>
                      <span style={{ fontSize: "0.64rem", color: "#6b7280" }}>{q.revision ?? "V1"}</span>
                      <span className="badge" style={{ background: c.bg, color: c.text, fontSize: "0.6rem" }}>{quotationStatusLabel[q.status]}</span>
                    </div>
                    <div style={{ fontSize: "0.68rem", color: "#6b7280", marginTop: 2 }}>{q.date} · {fmtBaht(q.totalValue)}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {/* ส่งใบเสนอราคา — เด่นเป็นปุ่ม navy · แสดงเฉพาะใบที่ยังส่งได้ (draft/ส่งแล้ว/เปิดอ่าน) */}
                    {(q.status === "draft" || q.status === "sent_to_client" || q.status === "viewed") && (
                      <button onClick={() => sendQuote(q)} title={q.status === "draft" ? "ส่งใบเสนอราคา" : "ส่งอีกครั้ง"}
                        className="btn btn-primary btn-sm" style={{ height: 28, padding: "0 11px" }}>
                        <Send size={12} /> {q.status === "draft" ? "ส่ง" : "ส่งอีกครั้ง"}
                      </button>
                    )}
                    {[
                      { ic: <Eye size={13} />, t: "ดู", fn: () => { setEditing(q); setMode("view"); } },
                      { ic: <Pencil size={13} />, t: "แก้ไข", fn: () => openEdit(q) },
                      { ic: <Printer size={13} />, t: "พิมพ์", fn: () => printQuotation(q, { company: lead.company, name: lead.contact, phone: lead.phone, province: lead.province }) },
                      { ic: <Copy size={13} />, t: "ทำสำเนา", fn: () => duplicate(q) },
                      { ic: <Trash2 size={13} />, t: "ลบ", fn: () => setConfirmDel(q.id), danger: true },
                    ].map((b, i) => (
                      <button key={i} onClick={b.fn} title={b.t} aria-label={b.t}
                        style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid #e5e7eb", background: "#fff",
                          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: b.danger ? "#dc2626" : "#475569" }}>{b.ic}</button>
                    ))}
                  </div>
                </div>
                {confirmDel === q.id && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, marginTop: 8, paddingTop: 8, borderTop: "1px solid #eef0f4" }}>
                    <span style={{ fontSize: "0.72rem", color: "#dc2626", marginRight: "auto" }}>ลบใบเสนอราคานี้?</span>
                    <button onClick={() => setConfirmDel(null)} className="btn btn-secondary btn-sm" style={{ padding: "3px 10px" }}>ยกเลิก</button>
                    <button onClick={() => { deleteQuotation(q.id); setConfirmDel(null); onToast?.("ลบใบเสนอราคาแล้ว"); }} className="btn btn-sm" style={{ background: "#dc2626", color: "#fff", padding: "3px 10px" }}><X size={12} /> ลบ</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
