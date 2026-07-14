"use client";

import { useMemo, useState } from "react";
import {
  X, Search, Plus, User, Building2, Phone, MapPin, Layers, FileText,
  Calendar, Percent, Coins, ChevronRight, Check, Printer, Save, FilePlus, ClipboardList, UserPlus,
} from "lucide-react";
import { useSales } from "@/context/SalesContext";
import { useMasterCatalog } from "@/lib/useMasterCatalog";
import { LineItemsEditor } from "@/components/ui/LineItemsEditor";
import { printQuotation } from "@/lib/quotationPrint";
import { fmtBaht, fmtFull } from "@/lib/format";
import {
  loadHQPolicy, loadQuoteNumbering, loadQuoteValidityDays, buildLeadTasks, mainTemplateOf,
  quotationStatusLabel,
  type QuotationStatus, type QuoteLineItem, type CustomerRow, type LeadRow, type QuotationMock, type CustomerType,
} from "@/lib/mock";

const PRIMARY = "#003366", STEEL = "#2D2D2D", MUTED = "#8a929c", BORDER = "#e6eaf0";
const TODAY = "2026-06-30";
const THAI_MO = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
const thaiToday = () => { const d = new Date(TODAY); return `${d.getDate()} ${THAI_MO[d.getMonth()]} ${d.getFullYear() + 543}`; };
const defaultExpiry = () => { const d = new Date(TODAY); d.setDate(d.getDate() + loadQuoteValidityDays()); return d.toISOString().slice(0, 10); };
function nextQId(all: QuotationMock[]) {
  const { prefix, next: startNo } = loadQuoteNumbering();
  const nums = all.map(q => { const m = q.id.match(/(\d+)\s*$/); return m ? parseInt(m[1]) : 0; });
  return `${prefix}${String(Math.max(startNo - 1, ...nums, 0) + 1).padStart(4, "0")}`;
}

const lbl: React.CSSProperties = { display: "flex", alignItems: "center", gap: 5, fontSize: "0.68rem", fontWeight: 700, color: MUTED, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.03em" };
const inp: React.CSSProperties = { width: "100%", padding: "9px 12px", borderRadius: 9, border: `1px solid ${BORDER}`, fontSize: "0.82rem", fontFamily: "inherit", color: STEEL, background: "#fff", outline: "none", boxSizing: "border-box" };
const req = <span style={{ color: "#dc2626" }}> *</span>;
const cardBox: React.CSSProperties = { border: `1px solid ${BORDER}`, borderRadius: 14, padding: 20, background: "#fff" };

export function QuotationCreateModal({ onClose, onToast, presetCustomerId }: {
  onClose: () => void; onToast?: (m: string) => void; presetCustomerId?: number;
}) {
  const { quotations, customers, leads, addLead, addCustomer, addQuotation } = useSales();
  const catalog = useMasterCatalog();
  const policy = loadHQPolicy();

  // ── SECTION 1: Customer + Deal ──
  const [customerId, setCustomerId] = useState<number>(presetCustomerId ?? 0);
  const [custQuery, setCustQuery] = useState("");
  const [custOpen, setCustOpen] = useState(false);
  const [showAddCust, setShowAddCust] = useState(false);
  const [newCust, setNewCust] = useState({ company: "", name: "", phone: "", email: "", province: "กรุงเทพฯ", type: "บริษัท" as CustomerType, category: "" });

  const [dealMode, setDealMode] = useState<"existing" | "new">("existing");
  const [dealId, setDealId] = useState<number>(0); // lead.numId
  const [newDeal, setNewDeal] = useState({ project: "", product: "", province: "", assigned: "" });

  const customer = customers.find(c => c.id === customerId) || null;
  const customerDeals = customer ? leads.filter(l => l.customerId === customer.id || l.company === customer.company) : [];
  const filteredCustomers = customers.filter(c =>
    !custQuery.trim() || (c.company + c.name + c.phone).toLowerCase().includes(custQuery.trim().toLowerCase())
  ).slice(0, 8);

  // ── SECTION 2: BOQ ──
  const [lineItems, setLineItems] = useState<QuoteLineItem[]>([]);
  const [discountPct, setDiscountPct] = useState("");
  // แม่แบบ (buildingType) = ชื่อหลักของรายการ BOQ แรก (ตัด " · ประเภทย่อย") — เลือกจากแคตตาล็อกใน BOQ ที่เดียว ไม่มีช่องซ้ำ
  const buildingType = lineItems.length ? lineItems[0].name.split(" · ")[0] : (customer?.category || "");

  const subtotal = lineItems.reduce((s, it) => s + it.qty * it.unitPrice, 0);
  const disc = Math.min(parseFloat(discountPct) || 0, 100);
  const discountAmt = Math.round(subtotal * disc / 100);
  const afterDisc = subtotal - discountAmt;
  const vatPct = policy.vat;
  const vatAmt = Math.round(afterDisc * vatPct / 100);
  const grandTotal = afterDisc + vatAmt;
  // Constitution V2 · Discount Policy: ตัวแทนออกใบเสนอราคาเกินเพดานส่วนลดของ HQ ไม่ได้
  const overCap = disc > policy.maxDiscount;

  // ── SECTION 4: Quotation info ──
  const [status, setStatus] = useState<QuotationStatus>("draft");
  const [issueDate, setIssueDate] = useState(TODAY);
  const [expiry, setExpiry] = useState(defaultExpiry());
  const [paymentTerms, setPaymentTerms] = useState("มัดจำ 30% · งวดที่เหลือก่อนส่งมอบงาน");
  const [deliveryTime, setDeliveryTime] = useState("");
  const [note, setNote] = useState("");
  const previewId = useMemo(() => nextQId(quotations), [quotations]);

  // ── validation ──
  const dealValid = dealMode === "existing" ? dealId > 0 : (!!newDeal.product);
  const canSave = customerId > 0 && dealValid && lineItems.length > 0 && !overCap;
  // เหตุผลที่ยังบันทึกไม่ได้ — แสดงข้างปุ่ม (ปุ่ม disabled จึงยิง toast ไม่ได้)
  const saveBlockReason = customerId <= 0 ? "เลือกลูกค้าก่อน"
    : !dealValid ? "เลือกหรือสร้างดีล"
    : lineItems.length === 0 ? "ต้องมีรายการ BOQ อย่างน้อย 1 รายการ"
    : overCap ? `ส่วนลดเกินเพดาน HQ (${policy.maxDiscount}%)`
    : "";

  function addNewCustomer() {
    if (!newCust.company.trim()) { onToast?.("กรอกชื่อบริษัท/ลูกค้าก่อน"); return; }
    const id = customers.reduce((m, c) => Math.max(m, c.id), 0) + 1;
    const initials = newCust.company.replace(/บจ\.|หจก\.|บมจ\./g, "").trim().slice(0, 2) || "ลค";
    const c: CustomerRow = {
      id, name: newCust.name || newCust.company, company: newCust.company, type: newCust.type,
      email: newCust.email, phone: newCust.phone, province: newCust.province, category: newCust.category || "อาคารสำเร็จรูปทุกประเภท",
      status: "active", projects: 0, joinDate: new Date(TODAY).toISOString().slice(0, 10), owner: "สมชาย เชียงใหม่",
      initials, color: PRIMARY, totalValue: 0, imported: true,
    };
    addCustomer(c);
    setCustomerId(id); setShowAddCust(false); setCustOpen(false); setCustQuery("");
    setNewCust({ company: "", name: "", phone: "", email: "", province: "กรุงเทพฯ", type: "บริษัท", category: "" });
    onToast?.("เพิ่มลูกค้าใหม่แล้ว");
  }

  // สร้าง Deal ใหม่ = LeadRow ผูก customerId (numId ใหม่) → คืน numId ไว้ผูกใบเสนอราคา
  function ensureDeal(): number | null {
    if (dealMode === "existing") return dealId > 0 ? dealId : null;
    if (!customer) return null;
    const nid = Math.max(0, ...leads.map(l => l.numId)) + 1;
    const product = newDeal.product || buildingType || catalog[0]?.name || "";
    const d: LeadRow = {
      id: `#L-${40321 + nid}`, numId: nid, name: customer.company, company: customer.company, type: customer.type,
      contact: customer.name, phone: customer.phone, email: customer.email, province: newDeal.province || customer.province,
      assigned: newDeal.assigned || customer.owner, logo: customer.logo, customerId: customer.id,
      product, category: mainTemplateOf(product), value: "฿0", project: newDeal.project || undefined,
      status: "WAITING", source: "ลูกค้าเดิม (ดีลใหม่)", createdAt: thaiToday(), tasks: buildLeadTasks(), activities: [],
    };
    addLead(d);
    return nid;
  }

  function build(finalStatus: QuotationStatus): QuotationMock | null {
    if (!customer) { onToast?.("เลือกลูกค้าก่อน"); return null; }
    const linkedDeal = ensureDeal();
    if (linkedDeal == null) { onToast?.("เลือกหรือสร้างดีลก่อน"); return null; }
    if (lineItems.length === 0) { onToast?.("เพิ่มรายการ BOQ อย่างน้อย 1 รายการ"); return null; }
    if (overCap) { onToast?.(`ส่วนลดเกินเพดาน HQ (${policy.maxDiscount}%) — ออกใบเสนอราคาไม่ได้`); return null; }
    const projectName = newDeal.project || (dealMode === "existing" ? customerDeals.find(d => d.numId === dealId)?.project : "") ||
      (buildingType ? `${buildingType} — ${customer.company}` : customer.company);
    return {
      id: nextQId(quotations), customer: customer.company, project: projectName,
      total: fmtFull(afterDisc), totalValue: afterDisc, materialCost: subtotal,
      province: newDeal.province || customer.province, buildingType: buildingType || customer.category, area: 0,
      status: finalStatus, date: issueDate, items: lineItems.length, lineItems,
      customerId: customer.id, projectId: 0, dealId: linkedDeal, revision: "V1", expiry,
      discountPct: disc, note: note || undefined, paymentTerms: paymentTerms || undefined, deliveryTime: deliveryTime || undefined,
    };
  }

  function saveDraft() { const q = build("draft"); if (!q) return; addQuotation(q); onToast?.(`บันทึกร่าง ${q.id} แล้ว`); onClose(); }
  function saveAndPdf() {
    const q = build(status); if (!q) return;
    addQuotation(q);
    printQuotation(q, { company: customer!.company, name: customer!.name, phone: customer!.phone, province: customer!.province });
    onToast?.(`สร้างใบเสนอราคา ${q.id} แล้ว`); onClose();
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(45,45,45,.5)", zIndex: 200 }} />
      <div className="modal-pop" style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        width: 1040, maxWidth: "calc(100vw - 24px)", height: "min(780px, calc(100vh - 40px))", zIndex: 210,
        background: "#fff", borderRadius: 20, boxShadow: "0 30px 90px rgba(0,0,0,.32)", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Header + stepper */}
        <div style={{ background: PRIMARY, padding: "16px 22px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: "rgba(255,255,255,.16)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <FilePlus size={19} color="#fff" />
              </div>
              <div>
                <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#fff", lineHeight: 1.2 }}>สร้างใบเสนอราคาใหม่</div>
                <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,.72)", marginTop: 2 }}>เลขที่ (อัตโนมัติ): {previewId}</div>
              </div>
            </div>
            <button onClick={onClose} style={{ background: "rgba(255,255,255,.15)", border: "none", borderRadius: 8, width: 30, height: 30, cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={15} /></button>
          </div>
        </div>

        {/* Body: left content + right summary */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <div style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 24 }}>

            {/* ── ข้อมูลโครงการ ── */}
            {(
              <div style={cardBox}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
                  <Building2 size={17} color={PRIMARY} /><span style={{ fontSize: "0.92rem", fontWeight: 800, color: STEEL }}>ข้อมูลโครงการ</span>
                </div>

                {/* Customer combobox */}
                <div style={{ marginBottom: 18, position: "relative" }}>
                  <label style={lbl}><User size={12} /> ลูกค้า{req}</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <div style={{ position: "relative", flex: 1 }}>
                      <Search size={14} color={MUTED} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} />
                      <input value={custOpen ? custQuery : (customer ? `${customer.company} · ${customer.name}` : custQuery)}
                        onChange={e => { setCustQuery(e.target.value); setCustOpen(true); }} onFocus={() => setCustOpen(true)}
                        placeholder="ค้นหาลูกค้า (ชื่อบริษัท / ผู้ติดต่อ / เบอร์)…" style={{ ...inp, paddingLeft: 32 }} />
                    </div>
                    <button onClick={() => setShowAddCust(v => !v)} className="btn btn-secondary btn-md" style={{ color: PRIMARY, whiteSpace: "nowrap" }}><UserPlus size={14} /> เพิ่มลูกค้าใหม่</button>
                  </div>
                  {custOpen && (
                    <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10, boxShadow: "0 12px 40px rgba(0,0,0,.14)", zIndex: 30, maxHeight: 240, overflowY: "auto" }}>
                      {filteredCustomers.length === 0 ? (
                        <div style={{ padding: "14px 12px", fontSize: "0.78rem", color: MUTED, textAlign: "center" }}>ไม่พบลูกค้า — กด “เพิ่มลูกค้าใหม่”</div>
                      ) : filteredCustomers.map(c => (
                        <button key={c.id} onClick={() => { setCustomerId(c.id); setCustOpen(false); setCustQuery(""); setDealMode("existing"); setDealId(0); }}
                          style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 12px", background: c.id === customerId ? "#f0f4fa" : "#fff", border: "none", borderBottom: `1px solid #f4f6fa`, cursor: "pointer", textAlign: "left" }}>
                          <span style={{ width: 30, height: 30, borderRadius: "50%", background: c.color || PRIMARY, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.68rem", fontWeight: 800, flexShrink: 0 }}>{c.initials}</span>
                          <span style={{ minWidth: 0, flex: 1 }}>
                            <span style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: STEEL, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.company}</span>
                            <span style={{ display: "block", fontSize: "0.68rem", color: MUTED }}>{c.name} · {c.province}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Add-customer inline */}
                {showAddCust && (
                  <div style={{ border: `1px dashed ${PRIMARY}`, borderRadius: 12, padding: 16, marginBottom: 18, background: "#f7f9fc" }}>
                    <div style={{ fontSize: "0.78rem", fontWeight: 800, color: PRIMARY, marginBottom: 12 }}>เพิ่มลูกค้าใหม่</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div style={{ gridColumn: "1/-1" }}><label style={lbl}>ชื่อบริษัท/ลูกค้า{req}</label><input value={newCust.company} onChange={e => setNewCust({ ...newCust, company: e.target.value })} placeholder="เช่น บจ. ไทยสตีล" style={inp} /></div>
                      <div><label style={lbl}>ผู้ติดต่อ</label><input value={newCust.name} onChange={e => setNewCust({ ...newCust, name: e.target.value })} placeholder="คุณ…" style={inp} /></div>
                      <div><label style={lbl}>โทรศัพท์</label><input value={newCust.phone} onChange={e => setNewCust({ ...newCust, phone: e.target.value })} placeholder="08x-xxx-xxxx" style={inp} /></div>
                      <div><label style={lbl}>อีเมล</label><input value={newCust.email} onChange={e => setNewCust({ ...newCust, email: e.target.value })} placeholder="email@company.com" style={inp} /></div>
                      <div><label style={lbl}>จังหวัด</label><input value={newCust.province} onChange={e => setNewCust({ ...newCust, province: e.target.value })} style={inp} /></div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
                      <button onClick={() => setShowAddCust(false)} className="btn btn-secondary btn-sm" style={{ color: "#374151" }}>ยกเลิก</button>
                      <button onClick={addNewCustomer} className="btn btn-primary btn-sm"><Check size={13} /> เพิ่มลูกค้า</button>
                    </div>
                  </div>
                )}

                {/* Deal */}
                <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 16 }}>
                  <label style={lbl}><Layers size={12} /> ดีล / โครงการ{req}</label>
                  {!customer ? (
                    <div style={{ fontSize: "0.78rem", color: MUTED, padding: "10px 0" }}>เลือกลูกค้าก่อน จึงจะเลือก/สร้างดีลได้</div>
                  ) : (
                    <>
                      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                        <button onClick={() => setDealMode("existing")} className={`btn btn-sm ${dealMode === "existing" ? "btn-primary" : "btn-secondary"}`} style={dealMode === "existing" ? {} : { color: "#374151" }}>ดีลเดิม ({customerDeals.length})</button>
                        <button onClick={() => setDealMode("new")} className={`btn btn-sm ${dealMode === "new" ? "btn-primary" : "btn-secondary"}`} style={dealMode === "new" ? {} : { color: PRIMARY }}><Plus size={13} /> สร้างดีลใหม่</button>
                      </div>
                      {dealMode === "existing" ? (
                        customerDeals.length === 0 ? (
                          <div style={{ fontSize: "0.78rem", color: MUTED }}>ลูกค้ารายนี้ยังไม่มีดีล — กด “สร้างดีลใหม่”</div>
                        ) : (
                          <select value={dealId} onChange={e => setDealId(Number(e.target.value))} style={inp}>
                            <option value={0}>— เลือกดีล —</option>
                            {customerDeals.map(d => <option key={d.numId} value={d.numId}>{d.project || `${d.product} — ${d.company}`} ({d.value})</option>)}
                          </select>
                        )
                      ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                          <div style={{ gridColumn: "1/-1" }}><label style={lbl}>ชื่อโครงการ</label><input value={newDeal.project} onChange={e => setNewDeal({ ...newDeal, project: e.target.value })} placeholder="เช่น โรงงานสำเร็จรูป เฟส 2" style={inp} /></div>
                          <div><label style={lbl}>ประเภทโครงการ{req}</label>
                            <select value={newDeal.product} onChange={e => setNewDeal({ ...newDeal, product: e.target.value })} style={inp}>
                              <option value="">— เลือกประเภท —</option>
                              {catalog.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                            </select></div>
                          <div><label style={lbl}>จังหวัด</label><input value={newDeal.province} onChange={e => setNewDeal({ ...newDeal, province: e.target.value })} placeholder={customer.province} style={inp} /></div>
                          <div style={{ gridColumn: "1/-1" }}><label style={lbl}>ผู้รับผิดชอบ (Salesperson)</label><input value={newDeal.assigned} onChange={e => setNewDeal({ ...newDeal, assigned: e.target.value })} placeholder={customer.owner} style={inp} /></div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* ── รายการ BOQ — เลือกแม่แบบจาก "เลือกจากแคตตาล็อก" ได้เลย (ไม่มีช่องเลือกแม่แบบซ้ำ · แม่แบบ derive จากรายการแรก) ── */}
            {(
              <div style={cardBox}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <ClipboardList size={17} color={PRIMARY} /><span style={{ fontSize: "0.92rem", fontWeight: 800, color: STEEL }}>รายการ BOQ</span>
                  {buildingType && <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 10px", borderRadius: 999, background: "#eef4fb", color: PRIMARY, fontSize: "0.66rem", fontWeight: 700 }}><FileText size={11} /> {buildingType}</span>}
                </div>
                <LineItemsEditor items={lineItems} onChange={setLineItems} defaultQty={1} />
                <div style={{ marginTop: 18, borderTop: `1px solid ${BORDER}`, paddingTop: 14 }}>
                  <label style={lbl}><Percent size={12} /> ส่วนลด (%) · เพดาน HQ {policy.maxDiscount}%</label>
                  <input type="number" min={0} max={policy.maxDiscount} value={discountPct} onChange={e => setDiscountPct(e.target.value)} placeholder="0"
                    style={{ ...inp, maxWidth: 200, ...(overCap ? { borderColor: "#dc2626", background: "#fff5f5" } : {}) }} />
                  {overCap && <div style={{ fontSize: "0.68rem", color: "#dc2626", marginTop: 5, fontWeight: 600 }}>เกินเพดานส่วนลด {policy.maxDiscount}% ที่สำนักงานใหญ่กำหนด — ออกใบเสนอราคาไม่ได้</div>}
                  <div style={{ fontSize: "0.7rem", color: MUTED, marginTop: 10, display: "flex", alignItems: "center", gap: 5 }}><ChevronRight size={12} /> ดูยอดรวม/VAT/ยอดสุทธิ ได้ที่แถบสรุปด้านขวา (อัปเดตอัตโนมัติ)</div>
                </div>
              </div>
            )}

            {/* ── ข้อมูลใบเสนอราคา ── */}
            {(
              <div style={cardBox}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
                  <FileText size={17} color={PRIMARY} /><span style={{ fontSize: "0.92rem", fontWeight: 800, color: STEEL }}>ข้อมูลใบเสนอราคา</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div><label style={lbl}><FileText size={12} /> เลขที่ใบเสนอราคา</label>
                    <div style={{ ...inp, background: "#f0f4fa", fontWeight: 800, color: PRIMARY, fontFamily: "monospace" }}>{previewId}</div></div>
                  <div><label style={lbl}>สถานะ</label>
                    <select value={status} onChange={e => setStatus(e.target.value as QuotationStatus)} style={inp}>
                      {(["draft", "sent_to_client", "viewed", "won", "lost", "expired"] as QuotationStatus[]).map(s => <option key={s} value={s}>{quotationStatusLabel[s]}</option>)}
                    </select></div>
                  <div><label style={lbl}><Calendar size={12} /> วันที่ออก</label><input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} style={inp} /></div>
                  <div><label style={lbl}><Calendar size={12} /> วันหมดอายุ</label><input type="date" value={expiry} onChange={e => setExpiry(e.target.value)} style={inp} /></div>
                  <div><label style={lbl}>เงื่อนไขการชำระเงิน</label><input value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} placeholder="เช่น มัดจำ 30% ที่เหลือก่อนส่งมอบ" style={inp} /></div>
                  <div><label style={lbl}>ระยะเวลาส่งมอบ</label><input value={deliveryTime} onChange={e => setDeliveryTime(e.target.value)} placeholder="เช่น 90 วัน" style={inp} /></div>
                  <div style={{ gridColumn: "1/-1" }}><label style={lbl}>หมายเหตุ</label><textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="รายละเอียดเพิ่มเติม…" style={{ ...inp, resize: "vertical", lineHeight: 1.6 }} /></div>
                </div>
              </div>
            )}
          </div>

          {/* ── Summary rail ── */}
          <aside style={{ width: 300, flexShrink: 0, borderLeft: `1px solid ${BORDER}`, background: "#f8f9fb", overflowY: "auto", padding: "20px 18px", display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ fontSize: "0.62rem", fontWeight: 800, color: MUTED, textTransform: "uppercase", letterSpacing: "0.07em" }}>สรุปใบเสนอราคา</div>
            {/* customer */}
            <div>
              <div style={{ fontSize: "0.6rem", fontWeight: 800, color: MUTED, marginBottom: 7, letterSpacing: "0.05em" }}>ลูกค้า</div>
              {customer ? (
                <div style={{ ...cardBox, padding: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
                    <span style={{ width: 34, height: 34, borderRadius: "50%", background: customer.color || PRIMARY, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.72rem", fontWeight: 800, flexShrink: 0 }}>{customer.initials}</span>
                    <div style={{ minWidth: 0 }}><div style={{ fontSize: "0.82rem", fontWeight: 800, color: STEEL, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{customer.company}</div><div style={{ fontSize: "0.68rem", color: MUTED }}>{customer.name}</div></div>
                  </div>
                  {[[<Phone size={12} key="p" />, customer.phone || "—"], [<MapPin size={12} key="m" />, customer.province], [<Layers size={12} key="d" />, `${customerDeals.length} ดีล`], [<Coins size={12} key="h" />, `ซื้อสะสม ${fmtBaht(customer.totalValue)}`]].map(([ic, v], i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: "0.72rem", color: "#475569", padding: "3px 0" }}><span style={{ color: "#9aa4b0" }}>{ic}</span>{v}</div>
                  ))}
                </div>
              ) : <div style={{ fontSize: "0.74rem", color: MUTED, padding: "8px 0" }}>ยังไม่เลือกลูกค้า</div>}
            </div>
            {/* (เอาการ์ด "แม่แบบ" ออก — ซ้ำกับขั้นที่ 2 · แม่แบบ/พื้นที่/ราคาประมาณการ ดูได้ที่ขั้นเลือกแม่แบบ) */}
            {/* totals — มูลค่างาน (ก่อน VAT) = ยอดที่บันทึกจริง · VAT/ยอดรวมสุทธิ เป็นข้อมูลประกอบ (ตรงกับเอกสารพิมพ์) */}
            <div>
              <div style={{ fontSize: "0.6rem", fontWeight: 800, color: MUTED, marginBottom: 7, letterSpacing: "0.05em" }}>มูลค่า (Real-time)</div>
              <div style={{ background: PRIMARY, borderRadius: 14, padding: 16, color: "#fff" }}>
                {[["มูลค่า BOQ", fmtBaht(subtotal)], [`ส่วนลด ${disc}%`, `- ${fmtBaht(discountAmt)}`]].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: "0.74rem", color: "rgba(255,255,255,.8)" }}><span>{k}</span><span style={{ fontWeight: 600, color: "#fff" }}>{v}</span></div>
                ))}
                {/* ยอดที่บันทึกในใบเสนอราคา (ก่อน VAT) — เน้น */}
                <div style={{ borderTop: "1px solid rgba(255,255,255,.2)", marginTop: 8, paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: "0.72rem", color: "rgba(255,255,255,.85)", fontWeight: 700 }}>มูลค่างาน (ก่อน VAT)</span>
                  <span style={{ fontSize: "1.15rem", fontWeight: 800 }}>{fmtBaht(afterDisc)}</span>
                </div>
                <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,.6)", marginTop: 2 }}>= ยอดที่บันทึกในใบเสนอราคา</div>
                {/* VAT + ยอดรวมสุทธิ — ประกอบ (แสดงบนเอกสารพิมพ์) */}
                <div style={{ borderTop: "1px solid rgba(255,255,255,.15)", marginTop: 10, paddingTop: 8 }}>
                  {[[`VAT ${vatPct}%`, fmtBaht(vatAmt)], ["ยอดรวมสุทธิ (รวม VAT)", fmtBaht(grandTotal)]].map(([k, v], i) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: "0.72rem", color: "rgba(255,255,255,.7)" }}><span>{k}</span><span style={{ fontWeight: i === 1 ? 800 : 600, color: "#fff" }}>{v}</span></div>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>

        {/* Footer */}
        <div style={{ flexShrink: 0, borderTop: `1px solid ${BORDER}`, background: "#fafbfc", padding: "13px 22px", display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onClose} className="btn btn-secondary btn-md" style={{ color: "#374151" }}>ยกเลิก</button>
          {!canSave && saveBlockReason && (
            <span style={{ fontSize: "0.72rem", color: "#b45309", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8, padding: "5px 10px", fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f59e0b", flexShrink: 0 }} /> ยังบันทึกไม่ได้: {saveBlockReason}
            </span>
          )}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={saveDraft} disabled={!canSave} className="btn btn-secondary btn-md" style={{ color: PRIMARY, opacity: canSave ? 1 : .5 }}><Save size={15} /> บันทึกร่าง</button>
            <button onClick={saveAndPdf} disabled={!canSave} className="btn btn-primary btn-md" style={{ opacity: canSave ? 1 : .5 }}><Printer size={15} /> บันทึกและสร้าง PDF</button>
          </div>
        </div>
      </div>
    </>
  );
}
