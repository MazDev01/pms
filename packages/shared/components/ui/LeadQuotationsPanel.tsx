"use client";

import { useState } from "react";
import { FilePlus, Eye, Pencil, Printer, Copy, Trash2, X, ArrowLeft, Send, FileText, Calendar, Coins } from "lucide-react";
import { useSales } from "@pms/shared/context/SalesContext";
import {
  quotationStatusLabel, quotationStatusColor, loadHQPolicy,
  type LeadRow, type CustomerRow, type QuotationMock, type QuoteLineItem,
} from "@pms/shared/lib/mock";
import { LineItemsEditor } from "@pms/shared/components/ui/LineItemsEditor";
import { printQuotation } from "@pms/shared/lib/quotationPrint";
import { parseBaht, fmtBaht } from "@pms/shared/lib/format";
import { useMasterCatalog } from "@pms/shared/lib/useMasterCatalog";

const MOCK_TODAY = "2026-06-30";

type FormState = { project: string; buildingType: string; items: string; price: string; expiry: string; note: string; lineItems: QuoteLineItem[] };

export function LeadQuotationsPanel({ lead, customer, onToast }: { lead?: LeadRow; customer?: CustomerRow; onToast?: (m: string) => void }) {
  const { quotations, addQuotation, updateQuotation, deleteQuotation, newQuoteId } = useSales();
  const catalog = useMasterCatalog(); // ราคากลาง HQ — ใช้ตั้งราคา/หน่วยของ BOQ ตั้งต้น
  const [mode, setMode] = useState<"list" | "create" | "edit" | "view">("list");
  const [editing, setEditing] = useState<QuotationMock | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const policy = loadHQPolicy(); // นโยบาย HQ — VAT / อายุใบ · บังคับใช้ทั้งเครือ

  // subject รวม — รองรับทั้ง "ลูกค้าเป้าหมาย" (lead) และ "ลูกค้า" (customer)
  const subj = lead ? {
    kind: "lead" as const, company: lead.company, contact: lead.contact, phone: lead.phone, email: lead.email,
    province: lead.province, assigned: lead.assigned, product: lead.product,
    customerId: lead.customerId, dealId: lead.numId as number | undefined,
    value: lead.value,                       // มูลค่าประเมินจากลีด — ใช้ตั้งต้น BOQ
    area: lead.area,                         // พื้นที่ที่กรอกไว้ตอนเพิ่มลีด — ใช้เป็นจำนวนตั้งต้นของ BOQ
    project: lead.project,                   // ชื่อโครงการที่ตัวแทนตั้งไว้ตอนสร้างดีล (ถ้ามี)
  } : {
    kind: "customer" as const, company: customer!.company, contact: customer!.name, phone: customer!.phone, email: customer!.email,
    province: customer!.province, assigned: customer!.owner, product: customer!.category || "",
    customerId: customer!.id, dealId: undefined as number | undefined,
    value: customer!.totalValue ? String(customer!.totalValue) : "",
    area: undefined as number | undefined,   // ลูกค้า (ปิดการขายแล้ว) ไม่มีพื้นที่ตั้งต้น — ใบเสนอราคาของลูกค้าดูอย่างเดียวอยู่แล้ว
    project: undefined as string | undefined,
  };
  // ตัวแทนตั้งชื่อโครงการไว้แล้วตอนสร้างดีล → ใช้ชื่อนั้น ไม่ใช่ประกอบชื่อใหม่ทับ
  // ไม่ได้ตั้งไว้ค่อยประกอบจากแม่แบบ + ชื่อบริษัท (ยังแก้ในช่องได้ตามเดิม)
  const defProject = () => subj.project?.trim() || (subj.product ? `${subj.product} — ${subj.company}` : subj.company);
  const readOnly = subj.kind === "customer"; // แท็บใบเสนอราคาของ "ลูกค้า" = ดูอย่างเดียว (ไม่แก้/สร้าง/ลบ)
  const viewLineItems = (q: QuotationMock): QuoteLineItem[] => q.lineItems ?? (q.materialCost > 0
    ? [{ name: q.buildingType || "รายการ", qty: q.area || 1, unit: q.area ? "ตร.ม." : "รายการ", unitPrice: q.area ? Math.round(q.materialCost / q.area) : q.materialCost }] : []);

  // ตั้งต้น BOQ จากข้อมูลลูกค้าเป้าหมายเลย ไม่ต้องให้ไปเลือกแคตตาล็อกเอง (บอสสั่ง)
  // โครงสร้าง BOQ ที่ถูก: ราคา/หน่วย = ราคากลางของ HQ (คงที่) · จำนวน = พื้นที่ (ตัวแปร)
  // จึงถอดพื้นที่ออกมาจากมูลค่าประเมิน: จำนวน = มูลค่าประเมิน ÷ ราคากลาง — ไม่ใช่ยัดมูลค่าทั้งก้อนลงราคา/หน่วย
  // ลีดอาจระบุ "แม่แบบย่อย" (เช่น โรงงานอาหาร อยู่ใต้ โรงงาน) → หาในแคตตาล็อกทั้ง 2 ชั้น
  const emptyForm = (): FormState => {
    const est = parseBaht(subj.value || "");
    const prod = catalog.find(p => p.name === subj.product)
              ?? catalog.find(p => p.subtypes?.includes(subj.product));
    const rate = prod?.price ?? 0;
    // จำนวนตั้งต้นของ BOQ เรียงตามความน่าเชื่อถือของข้อมูล:
    //  1) พื้นที่ที่กรอกไว้ในลีด + แม่แบบคิดเป็น ตร.ม. → ใช้ตัวเลขจริงจากลีด (ตรงที่สุด · บอสสั่ง 17 ก.ค. 69)
    //  2) ไม่มีพื้นที่ → ถอดกลับจาก มูลค่าประเมิน ÷ ราคากลาง (ประมาณเอา เหมือนเดิม)
    // ทั้งสองทางเป็นแค่ "ค่าตั้งต้น" — ตัวแทนแก้ทับใน BOQ ได้ และพื้นที่บนใบยึดตาม BOQ ตอนบันทึกเสมอ
    const areaQty = prod?.unit === "ตร.ม." && (subj.area ?? 0) > 0 ? subj.area! : 0;
    const qty = areaQty > 0 ? areaQty : (rate > 0 && est > 0 ? Math.round(est / rate) : 0);
    const seed: QuoteLineItem[] = subj.product && rate > 0 && qty > 0
      ? [{ name: subj.product, qty: Math.max(1, qty), unit: prod!.unit, unitPrice: rate }]
      : [];
    const total = seed.reduce((s, it) => s + it.qty * it.unitPrice, 0);
    return {
      project: defProject(), buildingType: subj.product,
      items: String(seed.length), price: total > 0 ? String(total) : "",
      expiry: "", note: "", lineItems: seed,
    };
  };
  const [form, setForm] = useState<FormState>(emptyForm);
  const set = <K extends keyof FormState>(k: K, v: string) => setForm(p => ({ ...p, [k]: v }));

  // ใบเสนอราคาที่เกี่ยวข้อง — ลูกค้า: ผูกด้วย customerId · ลีด: ผูกด้วย dealId (legacy ใช้ customerId/ชื่อบริษัท)
  const related = quotations
    .filter(q => subj.kind === "customer"
      ? q.customerId === subj.customerId
      : (q.dealId === subj.dealId || (q.dealId == null && ((subj.customerId && q.customerId === subj.customerId) || q.customer === subj.company))))
    .sort((a, b) => b.date.localeCompare(a.date));

  // เลขที่ใบถัดไป — ผ่าน context (supabase: RPC next_quote_no atomic กันเลขชนข้ามสาขา · local: max+1)
  const nextQId = () => newQuoteId();
  // มูลค่างาน (ก่อน VAT) = ผลรวมรายการสินค้า — ระบบไม่มีส่วนลดแล้ว
  function netTotal(f: FormState) { return parseBaht(f.price); }

  function openCreate() { setEditing(null); setForm(emptyForm()); setMode("create"); }
  function openEdit(q: QuotationMock) {
    setEditing(q);
    const lineItems: QuoteLineItem[] = q.lineItems ?? (q.materialCost > 0
      ? [{ name: q.buildingType || "รายการ", qty: q.area || 1, unit: q.area ? "ตร.ม." : "รายการ", unitPrice: q.area ? Math.round(q.materialCost / q.area) : q.materialCost }] : []);
    setForm({ project: q.project, buildingType: q.buildingType, items: String(lineItems.length),
      price: String(q.materialCost || q.totalValue), expiry: q.expiry ?? "", note: q.note ?? "", lineItems });
    setMode("edit");
  }

  async function save() {
    const net = netTotal(form);
    if (mode === "edit" && editing) {
      updateQuotation({ ...editing, project: form.project, buildingType: form.buildingType, items: form.lineItems.length,
        lineItems: form.lineItems, materialCost: parseBaht(form.price), totalValue: net, total: "฿" + net.toLocaleString("th-TH"),
        expiry: form.expiry || "", note: form.note || undefined });
      onToast?.("บันทึกใบเสนอราคาแล้ว");
    } else {
      // สร้างใหม่ — ออกใบในนาม subject (ลีด/ลูกค้า) · ผูก customerId/dealId ตามบริบท
      const id = await nextQId();
      addQuotation({
        id, customer: subj.company, project: form.project || defProject(),
        total: "฿" + net.toLocaleString("th-TH"), totalValue: net, materialCost: parseBaht(form.price),
        // พื้นที่ = จำนวนของรายการ BOQ ที่คิดเป็น ตร.ม. (เดิม hardcode 0 → พื้นที่หายไปจากใบ)
        province: subj.province, buildingType: form.buildingType,
        area: form.lineItems.filter(it => it.unit === "ตร.ม.").reduce((s, it) => s + it.qty, 0),
        status: "draft", date: MOCK_TODAY, items: form.lineItems.length, lineItems: form.lineItems,
        customerId: subj.customerId ?? 0, projectId: 0, dealId: subj.dealId, revision: "V1", expiry: form.expiry || "",
        note: form.note || undefined,
      });
      onToast?.("สร้างใบเสนอราคาเรียบร้อย");
    }
    setMode("list");
  }

  async function duplicate(q: QuotationMock) {
    addQuotation({ ...q, id: await nextQId(), status: "draft", revision: "V1", date: MOCK_TODAY });
    onToast?.("ทำสำเนาใบเสนอราคาแล้ว");
  }

  // ส่งใบเสนอราคาให้ลูกค้า → สถานะเป็น "ส่งแล้ว" (เลื่อน stage + ติ๊กงานให้ลีดอัตโนมัติผ่าน context)
  function sendQuote(q: QuotationMock) {
    const resend = q.status !== "draft";
    updateQuotation({ ...q, status: "sent_to_client", date: MOCK_TODAY });
    onToast?.(resend ? `ส่งใบเสนอราคา ${q.id} ให้ลูกค้าอีกครั้งแล้ว` : `ส่งใบเสนอราคา ${q.id} ให้ลูกค้าแล้ว`);
  }

  const lbl: React.CSSProperties = { display: "block", fontSize: "0.65rem", fontWeight: 700, color: "#6b7280", marginBottom: 4 };
  const inp: React.CSSProperties = { width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid #e6eaf0", fontSize: "0.82rem", fontFamily: "inherit", color: "#2D2D2D", background: "#fff", boxSizing: "border-box" };

  // ── ฟอร์มสร้าง/แก้ไข (inline · รีสไตล์ให้เข้ากับ wizard ใหม่) ──
  if (mode === "create" || mode === "edit") {
    const secLabel: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, fontSize: "0.62rem", fontWeight: 800, color: "#8a929c", textTransform: "uppercase", letterSpacing: "0.05em", margin: "16px 0 10px" };
    const net = parseBaht(form.price);                 // มูลค่างาน (ก่อน VAT) = ยอดที่บันทึก
    const vatPct = policy.vat;
    const vatAmt = Math.round(net * vatPct / 100);
    const grand = net + vatAmt;                        // ยอดรวมสุทธิ (รวม VAT)
    return (
      <div>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <button onClick={() => setMode("list")} className="btn btn-secondary btn-sm" style={{ color: "#374151", padding: "5px 10px" }}><ArrowLeft size={13} /> กลับ</button>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ width: 26, height: 26, borderRadius: 8, background: "#eef4fb", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><FileText size={14} color="#003366" /></span>
            <div style={{ fontSize: "0.92rem", fontWeight: 800, color: "#003366" }}>{mode === "edit" ? `แก้ไข ${editing?.id}` : "สร้างใบเสนอราคาใหม่"}</div>
          </div>
        </div>

        {/* ข้อมูลจาก subject — เติมอัตโนมัติ (อ่านอย่างเดียว) */}
        <div style={{ background: "#f7f9fc", border: "1px solid #eef1f5", borderRadius: 12, padding: "11px 13px", fontSize: "0.72rem", color: "#475569", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 14px" }}>
          <div><b style={{ color: "#8a929c", fontWeight: 700 }}>ลูกค้า:</b> {subj.contact}</div><div><b style={{ color: "#8a929c", fontWeight: 700 }}>บริษัท:</b> {subj.company}</div>
          <div><b style={{ color: "#8a929c", fontWeight: 700 }}>โทร:</b> {subj.phone || "—"}</div><div><b style={{ color: "#8a929c", fontWeight: 700 }}>อีเมล:</b> {subj.email || "—"}</div>
          <div><b style={{ color: "#8a929c", fontWeight: 700 }}>จังหวัด:</b> {subj.province}</div><div><b style={{ color: "#8a929c", fontWeight: 700 }}>ผู้รับผิดชอบ:</b> {subj.assigned}</div>
        </div>

        {/* รายการใบเสนอราคา — ชื่อเอกสาร + BOQ ก้อนเดียว · แม่แบบเลือกได้จาก "เลือกจากแคตตาล็อก" ใน BOQ (ไม่มีช่องแม่แบบซ้ำอีก) */}
        <div style={secLabel}><FileText size={12} color="#003366" /> รายการใบเสนอราคา</div>
        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>ชื่อโครงการ / เอกสาร</label>
          <input value={form.project} onChange={e => set("project", e.target.value)} style={inp} placeholder="เช่น โกดังเก็บสินค้าเกษตร — บจ. ..." />
        </div>
        {/* ไม่มีปุ่มเลือกแคตตาล็อก — BOQ ตั้งต้นจากแม่แบบของลูกค้าเป้าหมายให้แล้ว (บอสสั่ง) */}
        <LineItemsEditor showCatalog={false} items={form.lineItems}
          onChange={li => setForm(p => ({
            ...p, lineItems: li, items: String(li.length),
            price: String(li.reduce((s, it) => s + it.qty * it.unitPrice, 0)),
            // แม่แบบ = ชื่อหลักของรายการแรก (ตัด " · ประเภทย่อย" ออก) — เก็บไว้ใช้ในเอกสาร/พิมพ์ โดยไม่ต้องเลือกซ้ำ
            buildingType: li.length ? li[0].name.split(" · ")[0] : p.buildingType,
          })) } />

        {/* วันหมดอายุ */}
        <div style={{ marginTop: 14 }}>
          <label style={lbl}><Calendar size={11} style={{ verticalAlign: "-1px" }} /> วันหมดอายุ</label>
          <input type="date" value={form.expiry} onChange={e => set("expiry", e.target.value)} style={inp} />
        </div>

        {/* หมายเหตุ */}
        <div style={{ marginTop: 12 }}><label style={lbl}>หมายเหตุ</label>
          <textarea value={form.note} onChange={e => set("note", e.target.value)} rows={2} placeholder="รายละเอียดเพิ่มเติม…" style={{ ...inp, resize: "vertical", lineHeight: 1.6 }} /></div>

        {/* ยอดเงิน — ก่อน VAT (บันทึก) · VAT · รวม VAT (ตรงกับ wizard/เอกสารพิมพ์) */}
        <div style={{ marginTop: 14, background: "#003366", borderRadius: 12, padding: 14, color: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontSize: "0.72rem", color: "rgba(255,255,255,.8)" }}><span>มูลค่า BOQ</span><span>{fmtBaht(net)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderTop: "1px solid rgba(255,255,255,.2)", marginTop: 7, paddingTop: 9 }}>
            <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "rgba(255,255,255,.85)", display: "flex", alignItems: "center", gap: 4 }}><Coins size={12} /> มูลค่างาน (ก่อน VAT)</span>
            <span style={{ fontSize: "1.1rem", fontWeight: 800 }}>{fmtBaht(net)}</span>
          </div>
          <div style={{ fontSize: "0.58rem", color: "rgba(255,255,255,.6)", marginTop: 2 }}>= ยอดที่บันทึกในใบเสนอราคา</div>
          <div style={{ borderTop: "1px solid rgba(255,255,255,.15)", marginTop: 9, paddingTop: 7 }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontSize: "0.7rem", color: "rgba(255,255,255,.7)" }}><span>VAT {vatPct}%</span><span>{fmtBaht(vatAmt)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontSize: "0.7rem", color: "rgba(255,255,255,.9)", fontWeight: 800 }}><span>ยอดรวมสุทธิ (รวม VAT)</span><span>{fmtBaht(grand)}</span></div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button onClick={() => setMode("list")} className="btn btn-secondary btn-sm" style={{ color: "#374151" }}>ยกเลิก</button>
          <button onClick={save} className="btn btn-primary btn-sm"><FilePlus size={13} /> {mode === "edit" ? "บันทึก" : "สร้างใบเสนอราคา"}</button>
        </div>
      </div>
    );
  }

  // ── มุมมองอ่านอย่างเดียว (View) — เลย์เอาต์เดียวกับฟอร์ม แต่อ่านอย่างเดียว (มีตาราง BOQ) ──
  if (mode === "view" && editing) {
    const q = editing; const c = quotationStatusColor[q.status];
    const lis = viewLineItems(q);
    const subtotal = lis.reduce((s, it) => s + it.qty * it.unitPrice, 0) || q.materialCost || q.totalValue;
    const th: React.CSSProperties = { textAlign: "left", fontSize: "0.65rem", fontWeight: 700, color: "#6b7280", padding: "8px 10px", background: "#f7f9fc", whiteSpace: "nowrap" };
    const td: React.CSSProperties = { fontSize: "0.78rem", color: "#2D2D2D", padding: "9px 10px", borderTop: "1px solid #eef0f4" };
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <button onClick={() => setMode("list")} className="btn btn-secondary btn-sm" style={{ color: "#374151", padding: "5px 10px" }}><ArrowLeft size={13} /> กลับ</button>
          <div style={{ fontSize: "0.92rem", fontWeight: 800, color: "#003366" }}>{q.id}</div>
          <span className="badge" style={{ background: c.bg, color: c.text, marginLeft: "auto" }}>{quotationStatusLabel[q.status]}</span>
        </div>

        {/* ข้อมูลลูกค้า/ผู้ติดต่อ */}
        <div style={{ background: "#f0f4fa", border: "1px solid #dce5f0", borderRadius: 10, padding: "10px 12px", marginBottom: 14, fontSize: "0.72rem", color: "#475569", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px 14px" }}>
          <div><b>ลูกค้า:</b> {subj.contact}</div><div><b>บริษัท:</b> {q.customer || subj.company}</div>
          <div><b>โทร:</b> {subj.phone || "—"}</div><div><b>อีเมล:</b> {subj.email || "—"}</div>
          <div><b>จังหวัด:</b> {q.province || subj.province}</div><div><b>ผู้รับผิดชอบ:</b> {subj.assigned}</div>
        </div>

        {/* ชื่อโครงการ/เอกสาร (อ่านอย่างเดียว) — แม่แบบแสดงเป็นแท็กเล็กใต้ชื่อ (มาจากรายการ BOQ) */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "#6b7280", marginBottom: 4 }}>ชื่อโครงการ / เอกสาร</div>
          <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#2D2D2D" }}>{q.project}</div>
          {q.buildingType && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 6, padding: "2px 9px", borderRadius: 999, background: "#eef4fb", color: "#003366", fontSize: "0.66rem", fontWeight: 700 }}>
              <FileText size={10} /> {q.buildingType}
            </span>
          )}
        </div>

        {/* ตารางรายการสินค้า (BOQ) — อ่านอย่างเดียว */}
        <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "#6b7280", marginBottom: 6 }}>รายการสินค้า (BOQ)</div>
        <div style={{ border: "1px solid #eef0f4", borderRadius: 10, overflow: "hidden", marginBottom: 4 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={th}>รายการ</th><th style={{ ...th, textAlign: "right" }}>จำนวน</th>
              <th style={th}>หน่วย</th><th style={{ ...th, textAlign: "right" }}>ราคา/หน่วย</th>
              <th style={{ ...th, textAlign: "right" }}>รวม</th>
            </tr></thead>
            <tbody>
              {lis.length === 0 ? (
                <tr><td style={{ ...td, textAlign: "center", color: "#9aa2ad" }} colSpan={5}>ไม่มีรายการ</td></tr>
              ) : lis.map((it, i) => (
                <tr key={i}>
                  <td style={{ ...td, fontWeight: 600 }}>{it.name}</td>
                  <td style={{ ...td, textAlign: "right" }}>{it.qty.toLocaleString("th-TH")}</td>
                  <td style={td}>{it.unit}</td>
                  <td style={{ ...td, textAlign: "right" }}>{it.unitPrice.toLocaleString("th-TH")}</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 700, color: "#003366" }}>{fmtBaht(it.qty * it.unitPrice)}</td>
                </tr>
              ))}
              <tr>
                <td style={{ ...td, background: "#f7f9fc", fontWeight: 700 }} colSpan={4}>{lis.length} รายการ · รวมก่อน VAT</td>
                <td style={{ ...td, background: "#f7f9fc", textAlign: "right", fontWeight: 800, color: "#003366" }}>{fmtBaht(subtotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* วันหมดอายุ / ยอดสุทธิ / หมายเหตุ */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
          <div><div style={{ fontSize: "0.65rem", fontWeight: 700, color: "#6b7280", marginBottom: 4 }}>วันหมดอายุ</div>
            <div style={{ fontSize: "0.85rem", color: "#2D2D2D" }}>{q.expiry || "—"}</div></div>
          <div style={{ gridColumn: "1/-1" }}><div style={{ fontSize: "0.65rem", fontWeight: 700, color: "#6b7280", marginBottom: 4 }}>ยอดสุทธิ</div>
            <div style={{ fontSize: "1rem", fontWeight: 800, color: "#003366" }}>{fmtBaht(q.totalValue)}</div></div>
          {q.note && (<div style={{ gridColumn: "1/-1" }}><div style={{ fontSize: "0.65rem", fontWeight: 700, color: "#6b7280", marginBottom: 4 }}>หมายเหตุ</div>
            <div style={{ fontSize: "0.82rem", color: "#2D2D2D", lineHeight: 1.6 }}>{q.note}</div></div>)}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
          <button onClick={() => printQuotation(q, { company: subj.company, name: subj.contact, phone: subj.phone, province: subj.province })} className="btn btn-secondary btn-sm" style={{ color: "#374151" }}><Printer size={13} /> พิมพ์ PDF</button>
          {!readOnly && <button onClick={() => openEdit(q)} className="btn btn-secondary btn-sm" style={{ color: "#374151" }}><Pencil size={13} /> แก้ไข</button>}
          {!readOnly && (q.status === "draft" || q.status === "sent_to_client") && (
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
        <div style={{ fontSize: "0.72rem", color: "#6b7280", fontWeight: 700 }}>ใบเสนอราคา · {related.length} ฉบับ{readOnly && " · ดูอย่างเดียว"}</div>
        {!readOnly && <button onClick={openCreate} className="btn btn-primary btn-sm"><FilePlus size={13} /> สร้างใบเสนอราคา</button>}
      </div>

      {related.length === 0 ? (
        <div style={{ textAlign: "center", padding: "28px 0", color: "#9aa2ad", fontSize: "0.8rem" }}>ยังไม่มีใบเสนอราคา{!readOnly && " — กด “สร้างใบเสนอราคา” เพื่อเริ่ม"}</div>
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
                      <span className="badge" style={{ background: c.bg, color: c.text, fontSize: "0.65rem" }}>{quotationStatusLabel[q.status]}</span>
                    </div>
                    <div style={{ fontSize: "0.65rem", color: "#6b7280", marginTop: 2 }}>{q.date} · {fmtBaht(q.totalValue)}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {/* ส่งใบเสนอราคา — เด่นเป็นปุ่ม navy · แสดงเฉพาะใบที่ยังส่งได้ (ร่าง/ส่งแล้ว) · ซ่อนเมื่อดูอย่างเดียว */}
                    {!readOnly && (q.status === "draft" || q.status === "sent_to_client") && (
                      <button onClick={() => sendQuote(q)} title={q.status === "draft" ? "ส่งใบเสนอราคา" : "ส่งอีกครั้ง"}
                        className="btn btn-primary btn-sm" style={{ height: 28, padding: "0 11px" }}>
                        <Send size={12} /> {q.status === "draft" ? "ส่ง" : "ส่งอีกครั้ง"}
                      </button>
                    )}
                    {([
                      { ic: <Eye size={13} />, t: "ดู", fn: () => { setEditing(q); setMode("view"); } },
                      ...(readOnly ? [] : [{ ic: <Pencil size={13} />, t: "แก้ไข", fn: () => openEdit(q) }]),
                      { ic: <Printer size={13} />, t: "พิมพ์", fn: () => printQuotation(q, { company: subj.company, name: subj.contact, phone: subj.phone, province: subj.province }) },
                      ...(readOnly ? [] : [
                        { ic: <Copy size={13} />, t: "ทำสำเนา", fn: () => duplicate(q) },
                        { ic: <Trash2 size={13} />, t: "ลบ", fn: () => setConfirmDel(q.id), danger: true },
                      ]),
                    ] as { ic: React.ReactNode; t: string; fn: () => void; danger?: boolean }[]).map((b, i) => (
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
