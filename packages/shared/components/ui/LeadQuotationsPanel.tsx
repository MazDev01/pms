"use client";

import { useState, useRef, useEffect } from "react";
import { FilePlus, Eye, Pencil, Printer, Copy, Trash2, X, ArrowLeft, Send, FileText, Calendar, Coins, AlertTriangle } from "lucide-react";
import { useSales } from "@pms/shared/context/SalesContext";
import {
  quotationStatusLabel, quotationStatusColor, fmtISOToThai,
  type LeadRow, type CustomerRow, type QuotationMock, type QuoteLineItem,
} from "@pms/shared/lib/mock";
import { LineItemsEditor } from "@pms/shared/components/ui/LineItemsEditor";
import { boqLineItems, boqSubtotal, seedLineItems } from "@pms/shared/lib/boq";
import { printQuotation } from "@pms/shared/lib/quotationPrint";
import { parseBaht, fmtBaht, fmtFull } from "@pms/shared/lib/format";
import { useMasterCatalogState } from "@pms/shared/lib/useMasterCatalog";
import { useHQPolicy, useQuoteValidityDays } from "@pms/shared/lib/useHQConfig";
import { useDealerSettings, useDealerVat } from "@pms/shared/lib/useDealerSettings";
import { APP_NOW_ISO } from "@pms/shared/context/FilterContext";

// "วันนี้ของระบบ" (ISO) — โหมด supabase = วันจริง · โหมด local = 30 มิ.ย. 2569 (ดู APP_NOW ใน FilterContext)
// ใบเสนอราคาที่สร้าง/ส่งใหม่ลงวันที่นี้ → ตรงกับตัวกรอง/รายงานที่อิง APP_NOW เสมอ
const MOCK_TODAY = APP_NOW_ISO;

/** วันหมดอายุของใบ = วันที่ออกใบ + อายุใบที่สำนักงานใหญ่ตั้งไว้ (บอสสั่ง 20 ส.ค. 69)
 *  คิดจุดเดียวที่นี่ — ตัวแทนไม่ต้องพิมพ์เอง จะได้ไม่มีทางพิมพ์ผิดหรือขัดกับนโยบาย */
function วันหมดอายุจาก(วันออกใบ: string, อายุวัน: number): string {
  const d = new Date(วันออกใบ);
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + (อายุวัน > 0 ? อายุวัน : 0));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type FormState = { project: string; buildingType: string; items: string; price: string; expiry: string; note: string; lineItems: QuoteLineItem[] };

// ต้องส่งมาอย่างใดอย่างหนึ่งเท่านั้น (lead หรือ customer) — เดิม prop เป็น optional ทั้งคู่แยกกัน
//   TS ไม่บังคับ จึงต้องใช้ customer! เดาเอาว่ามาแน่ ๆ ตอนไม่มี lead (พังถ้ามีคนเรียกผิดในอนาคต)
//   ตอนนี้เป็น discriminated union — เรียกไม่ครบ/เรียกทั้งคู่ = TS error ตั้งแต่คอมไพล์ ไม่ต้องพึ่ง !
// openCreateSignal = ตัวนับจากหน้าแม่ — ค่าเปลี่ยนเมื่อไร แปลว่า "เปิดฟอร์มออกใบให้เลย"
// ใช้ตอนตัวแทนลากลูกค้าเป้าหมายไปขั้นเสนอราคา / กดติ๊กงาน "จัดทำใบเสนอราคา" (ต้องมีใบจริงถึงจะขยับขั้นได้)
type LeadQuotationsPanelProps =
  | { lead: LeadRow; customer?: undefined; onToast?: (m: string) => void; openCreateSignal?: number }
  | { lead?: undefined; customer: CustomerRow; onToast?: (m: string) => void; openCreateSignal?: undefined };

export function LeadQuotationsPanel({ lead, customer, onToast, openCreateSignal }: LeadQuotationsPanelProps) {
  const { quotations, createQuotation, updateQuotation, deleteQuotation } = useSales();
  // ready = โหลดแคตตาล็อกจบแล้ว — ต้องรอก่อนถึงจะบอกว่า "ยังไม่มีแม่แบบ" (ว่างเพราะยังโหลดไม่เสร็จไม่นับ)
  const { catalog, ready: catalogReady } = useMasterCatalogState();
 // ราคากลาง HQ — ใช้ตั้งราคา/หน่วยของ BOQ ตั้งต้น
  const [mode, setMode] = useState<"list" | "create" | "edit" | "view">("list");
  const [editing, setEditing] = useState<QuotationMock | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const savingRef = useRef(false); // กันกดออกใบซ้ำระหว่างรอเลขที่ใบจาก DB (H8 · guard synchronous)
  const [saving, setSaving] = useState(false); // ไว้ disable ปุ่ม (visual)
  const policy = useHQPolicy(); // นโยบาย HQ — อายุใบ ฯลฯ (VAT ย้ายไปเป็นของสาขาแล้ว · 7 ส.ค. 69)
  // อายุใบเสนอราคาที่สำนักงานใหญ่ประกาศไว้ — ใช้คิดวันหมดอายุแทนการให้ตัวแทนพิมพ์เอง
  const validityDays = useQuoteValidityDays();
  // ใบใหม่: นับจากวันที่ออกใบ · ใบเดิมที่เคยระบุวันไว้แล้ว: คงวันเดิม ไม่เขียนทับของเก่า
  const วันหมดอายุ = (mode === "edit" && editing?.expiry) ? editing.expiry : วันหมดอายุจาก(MOCK_TODAY, validityDays);
  const dealerCfg = useDealerSettings(); // หัวกระดาษ/ตราประทับ/VAT ของสาขา (ผ่าน repo)
  // ส่วนบวกเพิ่มจากราคากลางที่สาขาตั้งไว้เองที่หน้าแม่แบบ — ใช้ตั้งต้นราคาต่อหน่วยใน BOQ
  const pricing = dealerCfg.settings.pricing;
  const dealerVat = useDealerVat();      // % VAT ที่สาขาตั้งเอง — ใช้ตอนออกใบใหม่และเป็นค่าสำรองของใบเก่า
  const printCfg = { issuer: dealerCfg.settings.issuer, doc: dealerCfg.settings.document };

  // subject รวม — รองรับทั้ง "ลูกค้าเป้าหมาย" (lead) และ "ลูกค้า" (customer)
  const subj = lead ? {
    kind: "lead" as const, company: lead.company, contact: lead.contact, phone: lead.phone, email: lead.email,
    province: lead.province, assigned: lead.assigned, product: lead.product,
    customerId: lead.customerId, dealId: lead.numId as number | undefined,
    value: lead.value,                       // มูลค่าประเมินจากลูกค้าเป้าหมาย — ใช้ตั้งต้น BOQ
    area: lead.area,                         // พื้นที่ที่กรอกไว้ตอนเพิ่มลูกค้าเป้าหมาย — ใช้เป็นจำนวนตั้งต้นของ BOQ
    project: lead.project,                   // ชื่อโครงการที่ตัวแทนตั้งไว้ตอนสร้างดีล (ถ้ามี)
  } : {
    kind: "customer" as const, company: customer.company, contact: customer.name, phone: customer.phone, email: customer.email,
    province: customer.province, assigned: customer.owner, product: customer.category || "",
    customerId: customer.id, dealId: undefined as number | undefined,
    value: customer.totalValue ? String(customer.totalValue) : "",
    area: undefined as number | undefined,   // ลูกค้า (ปิดการขายแล้ว) ไม่มีพื้นที่ตั้งต้น — ใบเสนอราคาของลูกค้าดูอย่างเดียวอยู่แล้ว
    project: undefined as string | undefined,
  };
  // ตัวแทนตั้งชื่อโครงการไว้แล้วตอนสร้างดีล → ใช้ชื่อนั้น ไม่ใช่ประกอบชื่อใหม่ทับ
  // ไม่ได้ตั้งไว้ค่อยประกอบจากแม่แบบ + ชื่อบริษัท (ยังแก้ในช่องได้ตามเดิม)
  const defProject = () => subj.project?.trim() || (subj.product ? `${subj.product} — ${subj.company}` : subj.company);
  const readOnly = subj.kind === "customer"; // แท็บใบเสนอราคาของ "ลูกค้า" = ดูอย่างเดียว (ไม่แก้/สร้าง/ลบ)

  // ตั้งต้น BOQ จากข้อมูลลูกค้าเป้าหมายเลย ไม่ต้องให้ไปเลือกแคตตาล็อกเอง (บอสสั่ง)
  // โครงสร้าง BOQ ที่ถูก: ราคา/หน่วย = ราคากลางของ HQ (คงที่) · จำนวน = พื้นที่ (ตัวแปร)
  // จึงถอดพื้นที่ออกมาจากมูลค่าประเมิน: จำนวน = มูลค่าประเมิน ÷ ราคากลาง — ไม่ใช่ยัดมูลค่าทั้งก้อนลงราคา/หน่วย
  // ลูกค้าเป้าหมายอาจระบุ "แม่แบบย่อย" (เช่น โรงงานอาหาร อยู่ใต้ โรงงาน) → หาในแคตตาล็อกทั้ง 2 ชั้น
  // ทั้งสองทางเป็นแค่ "ค่าตั้งต้น" — ตัวแทนแก้ทับใน BOQ ได้ และพื้นที่บนใบยึดตาม BOQ ตอนบันทึกเสมอ
  const emptyForm = (): FormState => {
    const seed = seedLineItems({ product: subj.product, value: subj.value, area: subj.area }, catalog, pricing);
    const total = boqSubtotal(seed);
    return {
      project: defProject(), buildingType: subj.product,
      items: String(seed.length), price: total > 0 ? String(total) : "",
      expiry: "", note: "", lineItems: seed,
    };
  };
  const [form, setForm] = useState<FormState>(emptyForm);

  // แคตตาล็อกมาช้ากว่าฟอร์ม → ตั้งต้น BOQ ใหม่ให้เมื่อของมาถึง
  // useMasterCatalog เริ่มด้วยรายการว่างเสมอแล้วค่อยโหลด ถ้าผู้ใช้กด "สร้างใบเสนอราคา" ก่อนโหลดเสร็จ
  // ราคากลางจะเป็น 0 → BOQ ว่าง และหน้านี้ซ่อนปุ่มเลือกแคตตาล็อกไว้ = เพิ่มแถวเองไม่ได้ ออกใบไม่ได้เลย
  // เติมเฉพาะตอน "สร้างใหม่ + ยังไม่มีแถวเลย" จึงไม่ทับของที่ตัวแทนแก้ไว้
  useEffect(() => {
    if (mode !== "create" || form.lineItems.length > 0 || catalog.length === 0) return;
    const seed = seedLineItems({ product: subj.product, value: subj.value, area: subj.area }, catalog, pricing);
    if (!seed.length) return;
    const total = boqSubtotal(seed);
    setForm(p => ({ ...p, lineItems: seed, items: String(seed.length), price: String(total) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, mode, form.lineItems.length, subj.product, subj.value, subj.area]);
  const set = <K extends keyof FormState>(k: K, v: string) => setForm(p => ({ ...p, [k]: v }));

  // ใบเสนอราคาที่เกี่ยวข้อง — ลูกค้า: ผูกด้วย customerId · ลูกค้าเป้าหมาย: ผูกด้วย dealId (legacy ใช้ customerId/ชื่อบริษัท)
  const related = quotations
    .filter(q => subj.kind === "customer"
      ? q.customerId === subj.customerId
      : (q.dealId === subj.dealId || (q.dealId == null && ((subj.customerId && q.customerId === subj.customerId) || q.customer === subj.company))))
    .sort((a, b) => b.date.localeCompare(a.date));

  // มูลค่างาน (ก่อน VAT) = ผลรวมรายการสินค้า — ระบบไม่มีส่วนลดแล้ว
  function netTotal(f: FormState) { return parseBaht(f.price); }

  // ── ปุ่ม "เลือกจากแคตตาล็อก" เปิดตลอด (บอสสั่ง 20 ส.ค. 69) ────────────────────
  //
  // เดิมซ่อนไว้ เพราะ BOQ ตั้งต้นมาจากแม่แบบของลูกค้าเป้าหมายให้แล้ว (บอสสั่งไว้เมื่อก่อน)
  //   ผลข้างเคียงที่เพิ่งเห็นชัด: พอเพิ่มรายการที่สองในใบเดิมไม่ได้ ตัวแทนก็ไปกดออกใบใหม่แทน
  //   ลูกค้ารายเดียวเลยมีใบเสนอราคา 2 ฉบับ ทั้งที่เป็นงานเดียวกัน แค่มีของหลายรายการ
  // เปิดปุ่มไว้เสมอ = เพิ่มรายการในใบเดิมได้ ไม่ต้องออกใบใหม่ (แก้ที่ต้นเหตุของ "2 ใบ")
  //   ปุ่มลบรายการก็กลับมาด้วย (LineItemsEditor ผูกสองอย่างนี้ไว้ด้วยกัน) — แก้รายการในใบเดิมได้ครบ
  // ── หนึ่งดีล = ใบเสนอราคาใบเดียว (บอสสั่ง 20 ส.ค. 69) ─────────────────────────
  //
  // เดิมกด "สร้างใบเสนอราคา" ทีไรก็ได้ใบใหม่ทุกครั้ง ลูกค้ารายเดียวเลยมีใบ 2-3 ฉบับ
  //   ทั้งที่เป็นงานเดียวกัน แค่เพิ่มรายการสินค้าเข้าไป
  // ตอนนี้ถ้ามีใบที่ยังแก้ได้อยู่แล้ว = พาไปเพิ่มรายการในใบนั้น ไม่ออกใบใหม่
  //
  // ⚠️ ใบที่ปิดไปแล้ว (ตอบรับ/ปฏิเสธ/หมดอายุ) ห้ามแก้ — เป็นบันทึกของการขายที่จบแล้ว
  //    ยอดขายและยอดสะสมของลูกค้าอ้างอิงใบพวกนี้อยู่ · ถ้าลูกค้าซื้อรอบใหม่ก็ต้องเป็นใบใหม่จริง ๆ
  const ใบที่ยังแก้ได้ = related.find(q => q.status === "draft" || q.status === "sent_to_client");
  function openCreate() {
    if (ใบที่ยังแก้ได้) {
      openEdit(ใบที่ยังแก้ได้);
      onToast?.(`เพิ่มรายการในใบ ${ใบที่ยังแก้ได้.id} ที่มีอยู่แล้ว — ไม่ออกใบใหม่`);
      return;
    }
    const f = emptyForm();
    setEditing(null); setForm(f); setMode("create");
  }

  // หน้าแม่สั่งให้เปิดฟอร์มออกใบ (ลากลูกค้าเป้าหมายไปขั้นเสนอราคา / กดติ๊กงาน "จัดทำใบเสนอราคา")
  // 0 = ไม่ได้สั่ง · >0 = สั่ง — ต้องเทียบกับ 0 เสมอ ไม่ใช่ค่าตอน mount:
  //   ลูกค้าเป้าหมายที่ยังไม่เคยเปิดแผงจะ mount แผงนี้ "พร้อมกับ" คำสั่ง ถ้าจำค่าตอน mount ไว้จะไม่มีอะไรเกิดขึ้นเลย
  //   (หน้าแม่รีเซ็ตกลับเป็น 0 ทุกครั้งที่เปิด/ปิดแผงตามปกติ จึงไม่เด้งฟอร์มใส่หน้าโดยไม่ได้สั่ง)
  const lastSignal = useRef(0);
  useEffect(() => {
    if (!openCreateSignal || openCreateSignal === lastSignal.current) return;
    lastSignal.current = openCreateSignal;
    if (readOnly) return;
    openCreate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openCreateSignal]);
  function openEdit(q: QuotationMock) {
    setEditing(q);
    const lineItems: QuoteLineItem[] = boqLineItems(q);
    setForm({ project: q.project, buildingType: q.buildingType, items: String(lineItems.length),
      price: String(q.materialCost || q.totalValue), expiry: q.expiry ?? "", note: q.note ?? "", lineItems });
    setMode("edit");
  }

  async function save() {
    if (savingRef.current) return; // กันกดซ้ำระหว่างรอเลขที่ใบจาก DB (H8)
    savingRef.current = true; setSaving(true);
    try {
    const net = netTotal(form);
    if (mode === "edit" && editing) {
      updateQuotation({ ...editing, project: form.project, buildingType: form.buildingType, items: form.lineItems.length,
        lineItems: form.lineItems, materialCost: parseBaht(form.price), totalValue: net, total: "฿" + net.toLocaleString("th-TH"),
        expiry: วันหมดอายุ, note: form.note || undefined });
      onToast?.("บันทึกใบเสนอราคาแล้ว");
    } else {
      // สร้างใหม่ — ออกเลข + insert แบบ atomic (H8) · ออกใบในนาม subject (ลูกค้าเป้าหมาย/ลูกค้า)
      await createQuotation({
        customer: subj.company, project: form.project || defProject(),
        total: "฿" + net.toLocaleString("th-TH"), totalValue: net, materialCost: parseBaht(form.price),
        // พื้นที่ = จำนวนของรายการ BOQ ที่คิดเป็น ตร.ม. (เดิม hardcode 0 → พื้นที่หายไปจากใบ)
        province: subj.province, buildingType: form.buildingType,
        area: form.lineItems.filter(it => it.unit === "ตร.ม.").reduce((s, it) => s + it.qty, 0),
        status: "draft", date: MOCK_TODAY, items: form.lineItems.length, lineItems: form.lineItems,
        customerId: subj.customerId ?? 0, projectId: 0, dealId: subj.dealId, revision: "V1", expiry: วันหมดอายุ,
        note: form.note || undefined,
        vatPercent: dealerVat, // สแนปช็อต VAT ตอนสร้างใบ — พิมพ์ซ้ำทีหลังใช้ค่านี้เสมอ (ไม่ใช้ค่าที่สาขาแก้ทีหลัง)
      });
      onToast?.("สร้างใบเสนอราคาเรียบร้อย");
    }
    setMode("list");
    } finally { savingRef.current = false; setSaving(false); }
  }

  async function duplicate(q: QuotationMock) {
    if (savingRef.current) return; // กันกดซ้ำระหว่างรอเลขที่ใบจาก DB (H8)
    savingRef.current = true; setSaving(true);
    try {
      // ทำสำเนา = ออกใบใหม่แบบ atomic (ไม่พก id เดิม — DB ออกเลขใหม่ให้)
      const { id: _drop, ...rest } = q;
      await createQuotation({ ...rest, status: "draft", revision: "V1", date: MOCK_TODAY });
      onToast?.("ทำสำเนาใบเสนอราคาแล้ว");
    } finally { savingRef.current = false; setSaving(false); }
  }

  // ส่งใบเสนอราคาให้ลูกค้า → สถานะเป็น "ส่งแล้ว" (เลื่อน stage + ติ๊กงานให้ลูกค้าเป้าหมายอัตโนมัติผ่าน context)
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
    // กันออกใบเปล่า (H-audit): ไม่มีรายการ BOQ เลย = ไม่ให้กดสร้าง/บันทึก — เดิมกดผ่านได้
    // ได้ใบ ฿0 ไม่มีรายการ ซึ่งแก้ทีหลังไม่ได้เลยเพราะโหมดแก้ไขใช้ editor ตัวเดียวกันนี้
    // (เสียเลขที่เอกสารจริงถาวร ไม่มีทางเพิ่มรายการย้อนหลังผ่านหน้าจอ)
    //
    // "มีแถว" อย่างเดียวไม่พอ — แถวที่จำนวนหรือราคาเป็น 0 ก็ยังได้ใบ ฿0 อยู่ดี (พบ 6 ส.ค. 69)
    // ใบ ฿0 ส่งให้ลูกค้าไม่ได้จริง แต่ไปนับรวมใน "จำนวนใบเสนอราคา" ของสาขา และถ้าเผลอปิดการขาย
    // จะได้ลูกค้าที่มียอดสะสม 0 ปนอยู่ในฐาน — ต้องมียอดจริงก่อนถึงจะออกใบได้
    const hasItems = form.lineItems.length > 0;
    const hasAmount = net > 0;
    const canSave = hasItems && hasAmount;
    // ── ต้นเหตุที่พบจากการใช้งานจริง (19 ส.ค. 69): สำนักงานใหญ่ยังไม่ได้ตั้งแม่แบบ/ราคา ──
    //   รายการสินค้าเพิ่มได้ทางเดียวคือเลือกจากแคตตาล็อก ตัวแทนจึงตันโดยไม่รู้ว่าติดตรงไหน
    //   ข้อความเดิมบอกแค่ "ยอดรวมเป็น ฿0" ซึ่งฟังเหมือนตัวแทนกรอกผิดเอง
    const แม่แบบว่าง = catalogReady && catalog.length === 0;
    const ราคาแม่แบบยังไม่ตั้ง = !แม่แบบว่าง && hasItems && !hasAmount
      && form.lineItems.every(it => it.unitPrice <= 0);
    // ฟอร์มออกใบ: ใช้ VAT ที่สาขาตั้งไว้ (ตั้งค่า › ใบเสนอราคา) — ต้องเป็นค่าเดียวกับที่จะตรึงลงใบตอนบันทึก
    const vatPct = dealerVat;
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

        {/* ── เตือนเมื่อสาขายังไม่ได้กรอกข้อมูลบริษัทของตัวเอง (11 ส.ค. 69) ──────────────
            หัวกระดาษของใบเสนอราคามาจากข้อมูลบริษัทของสาขาเท่านั้น — ไม่มีค่าเริ่มต้นให้ยืมใช้แล้ว
            (เดิมเคยยืมข้อมูลของสาขาอื่นมาแสดง ซึ่งเป็นบั๊กที่แก้ไปแล้ว)
            ถ้ายังไม่กรอก เอกสารที่ส่งถึงลูกค้าจะไม่มีชื่อบริษัท ที่อยู่ เลขผู้เสียภาษี และช่องลงนามผู้เสนอราคาว่างเปล่า
            เตือนตรงนี้เพราะเป็นจังหวะที่ยังแก้ทัน — ไม่ได้ห้ามออกใบ (บางสาขาอาจตั้งใจร่างไว้ก่อน) */}
        {dealerCfg.loaded && !dealerCfg.settings.issuer?.company?.trim() && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 9, background: "#fff8e6", border: "1px solid #f5d78e",
            borderRadius: 10, padding: "10px 12px", marginBottom: 12, fontSize: "0.74rem", color: "#7a5b12", lineHeight: 1.55 }}>
            <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <b>ยังไม่ได้กรอกข้อมูลบริษัทของสาขา</b> — ใบที่ออกจะไม่มีชื่อบริษัท ที่อยู่ และเลขประจำตัวผู้เสียภาษีบนหัวกระดาษ
              {" "}<a href="/settings" style={{ color: "#003366", fontWeight: 700, textDecoration: "underline" }}>ไปกรอกที่ตั้งค่า › บัญชีดีลเลอร์</a>
            </div>
          </div>
        )}

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
        {/* เปิดปุ่มเลือกแคตตาล็อกเสมอ — ให้เพิ่มรายการในใบเดิมได้ แทนที่จะไปออกใบใหม่ */}
        <LineItemsEditor items={form.lineItems}
          onChange={li => setForm(p => ({
            ...p, lineItems: li, items: String(li.length),
            price: String(li.reduce((s, it) => s + it.qty * it.unitPrice, 0)),
            // แม่แบบ = ชื่อหลักของรายการแรก (ตัด " · ประเภทย่อย" ออก) — เก็บไว้ใช้ในเอกสาร/พิมพ์ โดยไม่ต้องเลือกซ้ำ
            buildingType: li.length ? li[0].name.split(" · ")[0] : p.buildingType,
          })) } />

        {/* ── วันหมดอายุ: ระบบกำหนดให้เอง ไม่ต้องกรอก (บอสสั่ง 20 ส.ค. 69) ──────────
            อายุใบเป็นนโยบายของสำนักงานใหญ่อยู่แล้ว (ตั้งที่ ตั้งค่า › ใบเสนอราคา)
            ให้ตัวแทนพิมพ์เองซ้ำ = พิมพ์ผิดได้ และไม่ตรงกับนโยบายที่ประกาศไว้
            นับจากวันที่ออกใบเสมอ · ใบเก่าที่เคยระบุวันไว้เองยังคงวันเดิม ไม่ถูกเขียนทับ */}
        <div style={{ marginTop: 14 }}>
          <label style={lbl}><Calendar size={11} style={{ verticalAlign: "-1px" }} /> วันหมดอายุ</label>
          <div style={{ ...inp, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: "#f7f9fc", color: "#374151" }}>
            <span style={{ fontWeight: 700 }}>{fmtISOToThai(วันหมดอายุ)}</span>
            <span style={{ fontSize: "0.68rem", color: "#8a929c" }}>
              {mode === "edit" && editing?.expiry ? "ตามที่ระบุไว้ในใบนี้" : `อายุใบ ${validityDays} วันนับจากวันที่ออกใบ`}
            </span>
          </div>
        </div>

        {/* หมายเหตุ */}
        <div style={{ marginTop: 12 }}><label style={lbl}>หมายเหตุ</label>
          <textarea value={form.note} onChange={e => set("note", e.target.value)} rows={2} placeholder="รายละเอียดเพิ่มเติม…" style={{ ...inp, resize: "vertical", lineHeight: 1.6 }} /></div>

        {/* ยอดเงิน — ก่อน VAT (บันทึก) · VAT · รวม VAT (ตรงกับ wizard/เอกสารพิมพ์) */}
        <div style={{ marginTop: 14, background: "#003366", borderRadius: 12, padding: 14, color: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontSize: "0.72rem", color: "rgba(255,255,255,.8)" }}><span>มูลค่า BOQ</span><span>{fmtFull(net)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderTop: "1px solid rgba(255,255,255,.2)", marginTop: 7, paddingTop: 9 }}>
            <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "rgba(255,255,255,.85)", display: "flex", alignItems: "center", gap: 4 }}><Coins size={12} /> มูลค่างาน (ก่อน VAT)</span>
            <span style={{ fontSize: "1.1rem", fontWeight: 800 }}>{fmtFull(net)}</span>
          </div>
          <div style={{ fontSize: "0.58rem", color: "rgba(255,255,255,.6)", marginTop: 2 }}>= ยอดที่บันทึกในใบเสนอราคา</div>
          <div style={{ borderTop: "1px solid rgba(255,255,255,.15)", marginTop: 9, paddingTop: 7 }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontSize: "0.7rem", color: "rgba(255,255,255,.7)" }}><span>VAT {vatPct}%</span><span>{fmtFull(vatAmt)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontSize: "0.7rem", color: "rgba(255,255,255,.9)", fontWeight: 800 }}><span>ยอดรวมสุทธิ (รวม VAT)</span><span>{fmtFull(grand)}</span></div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, marginTop: 16 }}>
          {!canSave && (
            <div style={{ marginRight: "auto", color: "#dc2626", fontSize: "0.72rem", fontWeight: 600 }}>
              {แม่แบบว่าง
                ? "สำนักงานใหญ่ยังไม่ได้ตั้งแม่แบบ — ออกใบเสนอราคาไม่ได้จนกว่าจะมีแม่แบบพร้อมราคา กรุณาแจ้งสำนักงานใหญ่"
                : ราคาแม่แบบยังไม่ตั้ง
                  ? "สำนักงานใหญ่ยังไม่ได้ตั้งราคาของแม่แบบนี้ — พิมพ์ราคาต่อหน่วยเองได้ หรือแจ้งสำนักงานใหญ่ให้ตั้งราคากลางก่อน"
                  : !hasItems
                    ? "ต้องมีรายการสินค้าอย่างน้อย 1 รายการก่อนบันทึก"
                    : "ยอดรวมเป็น ฿0 — ระบุจำนวนและราคาต่อหน่วยก่อนออกใบ"}
            </div>
          )}
          <button onClick={() => setMode("list")} className="btn btn-secondary btn-sm" style={{ color: "#374151" }}>ยกเลิก</button>
          <button onClick={save} disabled={saving || !canSave} className="btn btn-primary btn-sm" style={(saving || !canSave) ? { opacity: .6, cursor: "not-allowed" } : undefined}><FilePlus size={13} /> {mode === "edit" ? "บันทึก" : "สร้างใบเสนอราคา"}</button>
        </div>
      </div>
    );
  }

  // ── มุมมองอ่านอย่างเดียว (View) — เลย์เอาต์เดียวกับฟอร์ม แต่อ่านอย่างเดียว (มีตาราง BOQ) ──
  if (mode === "view" && editing) {
    const q = editing; const c = quotationStatusColor[q.status];
    const lis = boqLineItems(q);
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
                  <td style={{ ...td, textAlign: "right", fontWeight: 700, color: "#003366" }}>{fmtFull(it.qty * it.unitPrice)}</td>
                </tr>
              ))}
              <tr>
                <td style={{ ...td, background: "#f7f9fc", fontWeight: 700 }} colSpan={4}>{lis.length} รายการ · รวมก่อน VAT</td>
                <td style={{ ...td, background: "#f7f9fc", textAlign: "right", fontWeight: 800, color: "#003366" }}>{fmtFull(subtotal)}</td>
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
          <button onClick={() => printQuotation(q, { company: subj.company, name: subj.contact, phone: subj.phone, province: subj.province }, q.vatPercent ?? dealerVat, printCfg)} className="btn btn-secondary btn-sm" style={{ color: "#374151" }}><Printer size={13} /> พิมพ์ PDF</button>
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
        {/* มีใบที่ยังแก้ได้ = ปุ่มนี้พาไปเพิ่มรายการในใบเดิม ไม่ออกใบใหม่ — ป้ายต้องบอกตรง ๆ
            ไม่งั้นกดคำว่า "สร้าง" แล้วได้หน้าแก้ไขใบเก่า ผู้ใช้จะงงว่ากดผิดหรือระบบพัง */}
        {!readOnly && (
          <button onClick={openCreate} className="btn btn-primary btn-sm">
            <FilePlus size={13} /> {ใบที่ยังแก้ได้ ? "เพิ่มรายการในใบเสนอราคา" : "สร้างใบเสนอราคา"}
          </button>
        )}
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
                      { ic: <Printer size={13} />, t: "พิมพ์", fn: () => printQuotation(q, { company: subj.company, name: subj.contact, phone: subj.phone, province: subj.province }, q.vatPercent ?? dealerVat, printCfg) },
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
