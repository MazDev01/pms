"use client";

// ─── ตารางรายการสินค้าใบเสนอราคา (BOQ) ──────────────────────────────────────────
// เลือกจากแคตตาล็อกแม่แบบ (main + subtypes) → ดึง "ราคากลาง HQ" (SolutionProduct.price) มาเติมให้อัตโนมัติ
// แก้จำนวน/ราคาต่อหน่วยได้ · รวมต่อแถว + ยอดรวม คิดเอง · จำนวนรายการ = จำนวนแถว
import { useState } from "react";
import { Plus, Trash2, ChevronDown } from "lucide-react";
import { useMasterCatalog } from "@/lib/useMasterCatalog";
import type { QuoteLineItem } from "@/lib/mock";

const PRIMARY = "#003366";
const BORDER = "#e5e7eb";
const fmt = (n: number) => n.toLocaleString("th-TH");

// showCatalog=false → ซ่อนทั้งปุ่ม "เลือกจากแคตตาล็อก" และปุ่มลบรายการ (บอสสั่ง)
// ใช้ตอน BOQ ตั้งต้นมาจากแม่แบบของลูกค้าแล้ว — เพิ่มไม่ได้ก็ไม่ควรลบได้ ไม่งั้นลบแล้วเอากลับไม่ได้
// ยังแก้ชื่อ/จำนวน/ราคาต่อหน่วยได้ตามปกติ
export function LineItemsEditor({ items, onChange, defaultQty, showCatalog = true }: { items: QuoteLineItem[]; onChange: (items: QuoteLineItem[]) => void; defaultQty?: number; showCatalog?: boolean }) {
  const catalog = useMasterCatalog();
  const [pickOpen, setPickOpen] = useState(false);
  const subtotal = items.reduce((s, it) => s + it.qty * it.unitPrice, 0);

  const set = (i: number, patch: Partial<QuoteLineItem>) => onChange(items.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  const del = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const addFromCatalog = (name: string, unit: string, price: number) => { onChange([...items, { name, qty: defaultQty && defaultQty > 0 ? defaultQty : 1, unit, unitPrice: price }]); setPickOpen(false); };

  const inp: React.CSSProperties = { width: "100%", padding: "6px 8px", borderRadius: 7, border: `1px solid ${BORDER}`, fontSize: "0.78rem", outline: "none", color: "#2D2D2D", background: "#fff", boxSizing: "border-box" };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <label style={{ fontSize: "0.7rem", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.04em" }}>รายการสินค้า (BOQ)</label>
        <div style={{ display: "flex", gap: 6, position: "relative" }}>
          {showCatalog && <button type="button" onClick={() => setPickOpen(o => !o)} className="btn btn-secondary btn-sm"><Plus size={13} /> เลือกจากแคตตาล็อก <ChevronDown size={12} /></button>}
          {showCatalog && pickOpen && (
            <>
              <div onClick={() => setPickOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 220 }} />
              <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 221, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, boxShadow: "0 16px 40px rgba(0,0,0,.16)", padding: 6, width: 300, maxHeight: 320, overflowY: "auto" }}>
                {catalog.length === 0 && <div style={{ padding: 12, fontSize: "0.78rem", color: "#9ca3af", textAlign: "center" }}>ไม่มีแม่แบบ</div>}
                {catalog.map(p => (
                  <div key={p.id}>
                    <button type="button" onClick={() => addFromCatalog(p.name, p.unit, p.price)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, width: "100%", padding: "8px 10px", border: "none", background: "none", cursor: "pointer", borderRadius: 8, fontSize: "0.8rem", fontWeight: 700, color: "#2D2D2D", textAlign: "left", fontFamily: "inherit" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#f0f4fa")} onMouseLeave={e => (e.currentTarget.style.background = "none")}>
                      <span>{p.name}</span><span style={{ fontSize: "0.68rem", color: PRIMARY, fontWeight: 800, flexShrink: 0 }}>฿{fmt(p.price)}/{p.unit}</span>
                    </button>
                    {p.subtypes?.map(st => (
                      <button key={st} type="button" onClick={() => addFromCatalog(`${p.name} · ${st}`, p.unit, p.price)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, width: "100%", padding: "6px 10px 6px 22px", border: "none", background: "none", cursor: "pointer", borderRadius: 8, fontSize: "0.74rem", color: "#6b7280", textAlign: "left", fontFamily: "inherit" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "#f0f4fa")} onMouseLeave={e => (e.currentTarget.style.background = "none")}>
                        <span>{st}</span><span style={{ fontSize: "0.64rem", color: "#9ca3af", flexShrink: 0 }}>฿{fmt(p.price)}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
          <thead>
            <tr style={{ background: "#f7f9fc", color: "#6b7280", fontSize: "0.66rem", fontWeight: 700 }}>
              <th style={{ textAlign: "left", padding: "7px 8px" }}>รายการ</th>
              <th style={{ textAlign: "right", padding: "7px 6px", width: 70 }}>จำนวน</th>
              <th style={{ textAlign: "left", padding: "7px 6px", width: 62 }}>หน่วย</th>
              <th style={{ textAlign: "right", padding: "7px 6px", width: 96 }}>ราคา/หน่วย</th>
              <th style={{ textAlign: "right", padding: "7px 8px", width: 100 }}>รวม</th>
              <th style={{ width: 30 }}></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan={6} style={{ padding: 18, textAlign: "center", color: "#9ca3af", fontSize: "0.76rem" }}>{showCatalog ? "ยังไม่มีรายการ — กด “เลือกจากแคตตาล็อก” เพื่อเพิ่ม" : "ยังไม่มีรายการ — ระบุแม่แบบและมูลค่าประเมินที่ลูกค้าเป้าหมายก่อน"}</td></tr>}
            {items.map((it, i) => (
              <tr key={i} style={{ borderTop: `1px solid #f1f5f9` }}>
                <td style={{ padding: "5px 8px" }}><input style={inp} value={it.name} onChange={e => set(i, { name: e.target.value })} placeholder="ชื่อรายการ" /></td>
                <td style={{ padding: "5px 6px" }}><input type="number" min={0} style={{ ...inp, textAlign: "right" }} value={it.qty || ""} onChange={e => set(i, { qty: Number(e.target.value) })} /></td>
                <td style={{ padding: "5px 6px" }}><input style={inp} value={it.unit} onChange={e => set(i, { unit: e.target.value })} /></td>
                <td style={{ padding: "5px 6px" }}><input type="number" min={0} style={{ ...inp, textAlign: "right" }} value={it.unitPrice || ""} onChange={e => set(i, { unitPrice: Number(e.target.value) })} /></td>
                <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: 800, color: PRIMARY, whiteSpace: "nowrap" }}>฿{fmt(it.qty * it.unitPrice)}</td>
                <td style={{ padding: "5px 4px", textAlign: "center" }}>{showCatalog && <button type="button" onClick={() => del(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", display: "flex", padding: 3 }}><Trash2 size={13} /></button>}</td>
              </tr>
            ))}
          </tbody>
          {items.length > 0 && (
            <tfoot>
              <tr style={{ borderTop: `1px solid ${BORDER}`, background: "#f8fafc" }}>
                <td colSpan={4} style={{ padding: "8px 10px", textAlign: "right", fontSize: "0.72rem", fontWeight: 700, color: "#6b7280" }}>{items.length} รายการ · รวมก่อน VAT</td>
                <td style={{ padding: "8px 8px", textAlign: "right", fontWeight: 800, color: PRIMARY, fontSize: "0.86rem", whiteSpace: "nowrap" }}>฿{fmt(subtotal)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <div style={{ fontSize: "0.64rem", color: "#9ca3af", marginTop: 5 }}>ราคา/หน่วยดึงจากราคากลางของสำนักงานใหญ่ (แคตตาล็อกแม่แบบ) · ปรับได้ตามการเจรจา</div>
    </div>
  );
}
