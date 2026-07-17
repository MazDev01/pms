"use client";

import {
  createContext, useContext, useState, useCallback, useRef, useEffect,
  type ReactNode,
} from "react";
import {
  pipelineDeals, pipelineStages,
  quotations as seedQuotations, initialCustomers, DEFAULT_ISSUER,
  appointments as seedAppointments, buildLeadTasks, stageFromTasks, syncTasksToStage,
  syncAddQuotationFile, syncRemoveQuotationFile,
  type PipelineDealMock, type LeadRow, type DealActivity,
  type CustomerRow, type QuotationMock, type QuotationStatus,
  type AppointmentMock,
} from "@/lib/mock";
import { loadIssuer } from "@/lib/quotationPrint";
import { usePersistentState } from "@/lib/usePersistentState";
import { parseBaht } from "@/lib/format";

// ใบเสนอราคาเดิม (seed) = ออกภายใต้โปรไฟล์บริษัทตั้งต้น → ตรึงชื่อไว้ ไม่เปลี่ยนตามโปรไฟล์ที่แก้ทีหลัง
const seedQuotationsStamped: QuotationMock[] = seedQuotations.map(q =>
  q.issuer ? q : { ...q, issuer: { ...DEFAULT_ISSUER } }
);

// ── คีย์เก็บข้อมูลงานขายลง localStorage — กด F5 แล้วข้อมูลต้องไม่หาย ──────────────
// สำคัญ: ถ้าแก้ "ข้อมูลตั้งต้น" ใน mock.ts (เพิ่มฟิลด์/แก้ค่า) ต้องขึ้นเลขเวอร์ชันคีย์ด้วย
// ไม่งั้นเบราว์เซอร์ที่เคยเปิดจะอ่านของเก่าที่บันทึกไว้ทับตลอด แล้วมองไม่เห็นข้อมูลใหม่
const K = {
  deals:        "sales_deals_v1",
  leads:        "sales_leads_v2",        // v2 = เติมพื้นที่ (area) ครบทุกใบ · v1 = ลีดชุดที่มี createdAt ครบทุกใบ
  customers:    "sales_customers_v1",
  quotations:   "sales_quotations_v1",
  appointments: "sales_appointments_v1", // v1 = นัดหมายชุดที่มี leadId
  leadDealMap:  "sales_lead_deal_map_v1",
  nextDealId:   "sales_next_deal_id_v1",
  checklists:   "sales_lead_checklists_v1",
};

// ─── Types ─────────────────────────────────────────────────────────
export type DealSource = "pipeline" | "lead";
export type ChecklistItem = { id: string; text: string; done: boolean };

export type SalesContextType = {
  // Deals
  deals: PipelineDealMock[];
  addDeal: (deal: PipelineDealMock) => void;
  updateDealTask: (dealId: number, taskId: number, done: boolean) => void;
  moveDealStage: (dealId: number, stageId: number) => void;
  closeDeal: (dealId: number, outcome: "won" | "lost", lostReason?: string) => void;
  updateDealNotes: (dealId: number, notes: string) => void;
  addDealFile: (dealId: number, file: { name: string; size: string }) => void;
  logDealActivity: (dealId: number, entry: Omit<DealActivity, "id">) => void;

  // Lead → Deal connection
  leadDealMap: Record<string, number>; // leadId → dealId
  openDealFromLead: (lead: LeadRow) => PipelineDealMock;
  getDealForLead: (leadId: string) => PipelineDealMock | undefined;

  // Lead checklists (persisted in context so leads ↔ pipeline sync)
  leadChecklists: Record<string, ChecklistItem[]>;
  updateLeadChecklist: (leadId: string, items: ChecklistItem[]) => void;

  // Leads (lifted state so both pages share it)
  leads: LeadRow[];
  updateLeadStatus: (leadId: string, status: LeadRow["status"]) => void;
  addLead: (lead: LeadRow) => void;
  updateLead: (lead: LeadRow) => void;
  deleteLead: (leadId: string) => void;

  // Customers (lifted — one shared list app-wide)
  customers: CustomerRow[];
  addCustomer: (customer: CustomerRow) => void;
  updateCustomer: (customer: CustomerRow) => void;
  deleteCustomer: (id: number) => void;

  // Quotations (lifted — one shared list app-wide)
  quotations: QuotationMock[];
  addQuotation: (quotation: QuotationMock) => void;
  updateQuotation: (quotation: QuotationMock) => void;
  deleteQuotation: (id: string) => void;
  setQuotationStatus: (id: string, status: QuotationStatus) => void;

  // Appointments (lifted — ปฏิทิน/แดชบอร์ด/แจ้งเตือน ใช้ชุดเดียวกันสด)
  appointments: AppointmentMock[];
  addAppointment: (appt: AppointmentMock) => void;
  updateAppointment: (appt: AppointmentMock) => void;
  deleteAppointment: (id: number) => void;

  // Lead → Customer conversion (creates a REAL customer)
  convertLeadToCustomer: (lead: LeadRow, removeLead?: boolean) => CustomerRow;
};

const SalesContext = createContext<SalesContextType | null>(null);

export function SalesProvider({
  children,
  initialLeads,
}: {
  children: ReactNode;
  initialLeads: LeadRow[];
}) {
  const [deals, setDeals]           = usePersistentState<PipelineDealMock[]>(K.deals, pipelineDeals);
  const [leads, setLeads]           = usePersistentState<LeadRow[]>(K.leads, initialLeads);
  // ref สำหรับอ่านค่า leads ล่าสุดใน callback โดยไม่ต้องพึ่ง closure (ใช้ใน updateLeadStatus)
  const leadsRef = useRef(leads);
  useEffect(() => { leadsRef.current = leads; }, [leads]);
  const [leadDealMap, setLeadDealMap] = usePersistentState<Record<string, number>>(K.leadDealMap, {});
  const [nextDealId, setNextDealId] = usePersistentState<number>(K.nextDealId, pipelineDeals.length + 1);
  const [leadChecklists, setLeadChecklists] = usePersistentState<Record<string, ChecklistItem[]>>(K.checklists, {});
  const [customers, setCustomers]   = usePersistentState<CustomerRow[]>(K.customers, initialCustomers);
  const [quotations, setQuotations] = usePersistentState<QuotationMock[]>(K.quotations, seedQuotationsStamped);
  const [appointments, setAppointments] = usePersistentState<AppointmentMock[]>(K.appointments, seedAppointments);
  // ── Activity helper ─────────────────────────────────────────────
  const logDealActivity = useCallback((dealId: number, entry: Omit<DealActivity, "id">) => {
    setDeals(prev => prev.map(d =>
      d.id !== dealId ? d : {
        ...d,
        activities: [{ id: Date.now(), ...entry }, ...(d.activities ?? [])],
      }
    ));
  }, []);

  // ── Deal mutations ───────────────────────────────────────────────
  const addDeal = useCallback((deal: PipelineDealMock) => {
    setDeals(prev => [deal, ...prev]);
  }, []);

  const updateDealTask = useCallback((dealId: number, taskId: number, done: boolean) => {
    setDeals(prev => prev.map(d => {
      if (d.id !== dealId) return d;
      const task = d.tasks.find(t => t.id === taskId);
      const tasks = d.tasks.map(t => t.id !== taskId ? t : { ...t, done });
      const now = new Date().toISOString();
      const acts: DealActivity[] = [];
      if (task) {
        acts.push({
          id: Date.now(),
          type: done ? "task_done" : "task_undone",
          text: `${done ? "เสร็จงาน" : "ยังไม่เสร็จ"}: ${task.text}`,
          timestamp: now,
        });
      }
      // ── เลื่อนขั้นตอนอัตโนมัติตามความคืบหน้า (เฉพาะดีลที่ยัง active · ไม่ auto-ปิดการขาย) ──
      let stageId = d.stageId;
      const ACTIVE_STAGES = [2, 4, 5, 9, 6]; // ติดต่อ → รวบรวม → เสนอราคา → ติดตาม → เจรจา
      if (d.outcome === "active" && tasks.length) {
        const doneCount = tasks.filter(t => t.done).length;
        const idx = Math.min(ACTIVE_STAGES.length - 1, Math.floor((doneCount / tasks.length) * ACTIVE_STAGES.length));
        const nextStage = ACTIVE_STAGES[idx];
        if (nextStage !== d.stageId) {
          stageId = nextStage;
          const stageName = pipelineStages.find(s => s.id === nextStage)?.name ?? nextStage;
          acts.unshift({ id: Date.now() + 1, type: "stage_change", text: `เลื่อนขั้นตอนอัตโนมัติ → ${stageName}`, timestamp: now });
        }
      }
      return { ...d, tasks, stageId, activities: [...acts, ...(d.activities ?? [])] };
    }));
  }, []);

  const moveDealStage = useCallback((dealId: number, stageId: number) => {
    const stageName = pipelineStages.find(s => s.id === stageId)?.name ?? stageId;
    const now = new Date().toISOString();
    setDeals(prev => prev.map(d =>
      d.id !== dealId ? d : {
        ...d,
        stageId,
        activities: [
          { id: Date.now(), type: "stage_change", text: `ย้ายขั้นตอน → ${stageName}`, timestamp: now },
          ...(d.activities ?? []),
        ],
      }
    ));
  }, []);

  // ── Lead → Customer conversion (creates a REAL customer) ─────────
  // removeLead = true → "เปลี่ยนลีดเป็นลูกค้า" (ลบออกจากรายการลูกค้าเป้าหมาย) · false → แค่ผูกลูกค้าให้ลีด (คงลีดไว้ เช่นตอนสร้างใบเสนอราคา)
  const convertLeadToCustomer = useCallback((lead: LeadRow, removeLead = false): CustomerRow => {
    // ถ้าลีดมี customerId ที่มีอยู่แล้ว → คืนลูกค้าเดิม (ไม่สร้างซ้ำ)
    if (lead.customerId != null) {
      const existing = customers.find(c => c.id === lead.customerId);
      if (existing) {
        if (removeLead) setLeads(prev => prev.filter(l => l.id !== lead.id));
        return existing;
      }
    }
    const newId = customers.reduce((m, c) => Math.max(m, c.id), 0) + 1;
    // ลูกค้า = ลีดที่ปิดการขายสำเร็จ → พาข้อมูลตัวตนจากลีดมาให้ครบ (รูป/มูลค่าดีลที่ปิดได้)
    const newCustomer: CustomerRow = {
      id: newId,
      name: lead.contact || lead.company,
      company: lead.company,
      email: lead.email ?? "",
      phone: lead.phone ?? "",
      province: lead.province,
      category: lead.category || lead.product || "อื่นๆ",
      status: "active",
      projects: 0,
      joinDate: "2026-06-30",
      owner: lead.assigned,
      initials: deriveInitials(lead.company || lead.name),
      color: CUSTOMER_PALETTE[newId % CUSTOMER_PALETTE.length],
      totalValue: parseBaht(lead.value),
      logo: lead.logo,   // พารูป/โลโก้ที่อัปโหลดไว้ตอนเป็นลีดมาด้วย
    };
    setCustomers(prev => [...prev, newCustomer]);
    if (removeLead) {
      // ปิดการขาย/แปลงเป็นลูกค้า → ลีดกลายเป็นลูกค้าเต็มตัว จึงเอาออกจากรายการลูกค้าเป้าหมาย
      setLeads(prev => prev.filter(l => l.id !== lead.id));
    } else {
      // แค่ผูกลูกค้าให้ลีด (ยังเป็นลูกค้าเป้าหมายอยู่)
      setLeads(prev => prev.map(l => l.id !== lead.id ? l : { ...l, customerId: newId }));
    }
    // ผูกใบเสนอราคาที่ออกก่อน WON (customerId=0 ในนามบริษัทลีด) เข้ากับลูกค้าใหม่ย้อนหลัง
    setQuotations(prev => prev.map(q =>
      (!q.customerId || q.customerId === 0) && q.customer === lead.company
        ? { ...q, customerId: newId }
        : q
    ));
    return newCustomer;
  }, [customers]);

  const closeDeal = useCallback((dealId: number, outcome: "won" | "lost", lostReason?: string) => {
    const wonStage  = pipelineStages.find(s => s.id === 7)!;
    const lostStage = pipelineStages.find(s => s.id === 8)!;
    const now = new Date().toISOString();
    setDeals(prev => prev.map(d =>
      d.id !== dealId ? d : {
        ...d,
        outcome,
        lostReason: outcome === "lost" ? lostReason : undefined,
        stageId: outcome === "won" ? wonStage.id : lostStage.id,
        tasks: outcome === "won" ? d.tasks.map(t => ({ ...t, done: true })) : d.tasks,
        activities: [
          {
            id: Date.now(),
            type: outcome,
            text: outcome === "won"
              ? "ปิดการขายสำเร็จ ✅"
              : `ปิดการขายไม่สำเร็จ — ${lostReason ?? "ไม่ระบุ"}`,
            timestamp: now,
          },
          ...(d.activities ?? []),
        ],
      }
    ));

    // ผูกลีดของดีล (ถ้ามี)
    const entry = Object.entries(leadDealMap).find(([, did]) => did === dealId);
    if (entry) {
      const [leadId] = entry;
      const lead = leads.find(l => l.id === leadId);
      if (outcome === "won") {
        // ปิดการขายสำเร็จ → เปลี่ยนลีดเป็นลูกค้าเต็มตัว (ออกจากรายการลูกค้าเป้าหมาย),
        // ผูกดีลกับลูกค้าใหม่ และตั้งใบเสนอราคาที่เกี่ยวข้องเป็น "ตอบรับ" (won)
        if (lead) {
          const customer = convertLeadToCustomer(lead, true);
          setDeals(prev => prev.map(d => d.id === dealId ? { ...d, customerId: customer.id } : d));
          setQuotations(prev => prev.map(q =>
            q.customerId === customer.id && q.status !== "won" ? { ...q, status: "won" } : q
          ));
        }
      } else if (lead) {
        // ปิดการขายไม่สำเร็จ → ตั้งลีดเป็นไม่ได้งาน (ยังอยู่ในรายการลูกค้าเป้าหมาย)
        setLeads(prev => prev.map(l => l.id !== leadId ? l : { ...l, status: "CANCELLED" }));
      }
    }
  }, [leadDealMap, leads, convertLeadToCustomer]);

  const updateDealNotes = useCallback((dealId: number, notes: string) => {
    const now = new Date().toISOString();
    setDeals(prev => prev.map(d =>
      d.id !== dealId ? d : {
        ...d,
        notes,
        activities: [
          { id: Date.now(), type: "note_added", text: "อัปเดตบันทึก", timestamp: now },
          ...(d.activities ?? []).filter(a => a.type !== "note_added" ||
            a.timestamp !== (d.activities ?? [])[0]?.timestamp),
        ],
      }
    ));
  }, []);

  const addDealFile = useCallback((dealId: number, file: { name: string; size: string }) => {
    const now = new Date().toISOString();
    setDeals(prev => prev.map(d =>
      d.id !== dealId ? d : {
        ...d,
        files: [...d.files, file],
        activities: [
          { id: Date.now(), type: "file_added", text: `อัปโหลดไฟล์: ${file.name}`, timestamp: now },
          ...(d.activities ?? []),
        ],
      }
    ));
  }, []);

  // ── Lead → Deal connection ───────────────────────────────────────
  const openDealFromLead = useCallback((lead: LeadRow): PipelineDealMock => {
    const existingId = leadDealMap[lead.id];
    if (existingId) {
      return deals.find(d => d.id === existingId)!;
    }

    const id = nextDealId;
    setNextDealId(n => n + 1);
    const now = new Date().toISOString();

    const newDeal: PipelineDealMock = {
      id,
      customerId: lead.customerId ?? 0,
      customer:   lead.company,
      project:    `${lead.product} — ${lead.company}`,
      value:      parseLeadValue(lead.value),
      stageId:    2,
      assigned:   lead.assigned,
      dealer:     "ตัวแทนของฉัน",
      dealerColor: "#003366",
      tasks: (leadChecklists[lead.id]?.length
        ? leadChecklists[lead.id].map((item, i) => ({ id: id * 100 + i, text: item.text, done: item.done }))
        : DEFAULT_TASKS.map((text, i) => ({ id: id * 100 + i, text, done: false }))
      ),
      files:      [],
      outcome:    "active",
      createdAt:  "2026-06-30", // ตรึงตามวัน "ปัจจุบัน" ของ mock เพื่อให้ดีลใหม่อยู่ในช่วงตัวกรองเริ่มต้น
      notes:      "",
      activities: [
        { id: Date.now(), type: "deal_created", text: `สร้างโอกาสการขายจากลูกค้าเป้าหมาย: ${lead.company}`, timestamp: now },
      ],
    };

    setDeals(prev => [newDeal, ...prev]);
    setLeadDealMap(prev => ({ ...prev, [lead.id]: id }));
    setLeads(prev => prev.map(l =>
      l.id !== lead.id ? l : { ...l, status: "QUOTED" }
    ));

    return newDeal;
  }, [leadDealMap, deals, nextDealId, leadChecklists]);

  const getDealForLead = useCallback((leadId: string) => {
    const dealId = leadDealMap[leadId];
    return dealId != null ? deals.find(d => d.id === dealId) : undefined;
  }, [leadDealMap, deals]);

  // ── Lead checklist ──────────────────────────────────────────────
  const updateLeadChecklist = useCallback((leadId: string, items: ChecklistItem[]) => {
    setLeadChecklists(prev => ({ ...prev, [leadId]: items }));
  }, []);

  // ── Lead mutations ───────────────────────────────────────────────
  const updateLeadStatus = useCallback((leadId: string, status: LeadRow["status"]) => {
    // สร้างลูกค้าเฉพาะตอนปิดการขายสำเร็จ (WON) — ตัดสินใจนอก updater กัน StrictMode เรียกซ้ำใน dev
    const lead = leadsRef.current.find(l => l.id === leadId);
    // ย้ายสถานะ → ติ๊กงานใน Checklist ให้ถึงสเตจนั้นอัตโนมัติ (ผู้ทำ = ผู้รับผิดชอบของลีด)
    setLeads(prev => prev.map(l => l.id !== leadId ? l : { ...l, status, tasks: syncTasksToStage(l.tasks, status, l.assigned || "—") }));
    if (status === "PAID" && lead && lead.customerId == null) {
      setTimeout(() => convertLeadToCustomer({ ...lead, status }, false), 0);
    }
  }, [convertLeadToCustomer]);

  const addLead = useCallback((lead: LeadRow) => {
    setLeads(prev => [lead, ...prev]);
  }, []);

  const updateLead = useCallback((lead: LeadRow) => {
    setLeads(prev => prev.map(l => l.id !== lead.id ? l : lead));
    // ปิดการขายสำเร็จ → สร้างลูกค้า (เฉพาะยังไม่เป็นลูกค้า)
    if (lead.status === "PAID" && lead.customerId == null) {
      setTimeout(() => convertLeadToCustomer(lead, false), 0);
    }
  }, [convertLeadToCustomer]);

  const deleteLead = useCallback((leadId: string) => {
    setLeads(prev => prev.filter(l => l.id !== leadId));
  }, []);

  // ── Customer mutations ───────────────────────────────────────────
  const addCustomer = useCallback((customer: CustomerRow) => {
    setCustomers(prev => [...prev, customer]);
  }, []);

  const updateCustomer = useCallback((customer: CustomerRow) => {
    setCustomers(prev => prev.map(c => c.id !== customer.id ? c : customer));
  }, []);

  const deleteCustomer = useCallback((id: number) => {
    setCustomers(prev => prev.filter(c => c.id !== id));
  }, []);

  // ── Quotation → เช็กงานของลีดอัตโนมัติ ─────────────────────────────
  // สร้างใบเสนอราคา = ติ๊ก "จัดทำใบเสนอราคา" · ส่งใบเสนอราคา = ติ๊ก "ส่งใบเสนอราคา"
  // แล้วเลื่อนสถานะลีดตาม stageFromTasks (เลื่อนขึ้นเท่านั้น ไม่ดึงถอยหลัง)
  const completeLeadQuoteTasks = useCallback((quotation: QuotationMock, keys: string[]) => {
    const RANK: Partial<Record<LeadRow["status"], number>> = { WAITING: 0, BULLET: 1, QUOTED: 2, FOLLOWUP: 3, NEGO: 4 };
    setLeads(prev => prev.map(l => {
      const match = (quotation.customerId != null && quotation.customerId !== 0 && l.customerId === quotation.customerId)
        || l.company === quotation.customer;
      if (!match || l.status === "PAID" || l.status === "CANCELLED") return l;
      let changed = false;
      const base = l.tasks && l.tasks.length ? l.tasks : buildLeadTasks();
      const tasks = base.map(t => {
        if (keys.includes(t.key) && !t.done) {
          changed = true;
          // ผู้ทำงาน = ผู้รับผิดชอบของลีด (ไม่ใช่ "ระบบ"/ดีลเลอร์)
          return { ...t, done: true, doneAt: "30 มิ.ย. 2569", doneBy: l.assigned || "อัปเดตอัตโนมัติ" };
        }
        return t;
      });
      if (!changed) return l;
      const next = stageFromTasks(tasks);
      const status = (RANK[next] ?? 0) > (RANK[l.status] ?? 0) ? next : l.status;
      return { ...l, tasks, status };
    }));
  }, []);

  // ── Quotation mutations ──────────────────────────────────────────
  const addQuotation = useCallback((quotation: QuotationMock) => {
    // สแนปช็อตโปรไฟล์บริษัท ณ ตอนสร้าง — ใบใหม่ใช้ชื่อปัจจุบัน, ใบเก่าคงชื่อเดิมเมื่อเปลี่ยนโปรไฟล์ทีหลัง
    const stamped = quotation.issuer ? quotation : { ...quotation, issuer: loadIssuer() };
    setQuotations(prev => [stamped, ...prev]);
    // สร้างใบ → จัดทำใบเสนอราคา (ถ้าสร้างเป็นสถานะส่งแล้วขึ้นไป ให้ติ๊กส่งด้วย)
    completeLeadQuoteTasks(quotation, quotation.status === "draft" ? ["makeQuote"] : ["makeQuote", "sendQuote"]);
    syncAddQuotationFile(stamped); // auto-link → ไฟล์ (หมวดใบเสนอราคา) ผูกกับลีด/ลูกค้า
  }, [completeLeadQuoteTasks]);

  const updateQuotation = useCallback((quotation: QuotationMock) => {
    setQuotations(prev => prev.map(q => q.id !== quotation.id ? q : quotation));
    if (quotation.status !== "draft") completeLeadQuoteTasks(quotation, ["makeQuote", "sendQuote"]);
  }, [completeLeadQuoteTasks]);

  const deleteQuotation = useCallback((id: string) => {
    setQuotations(prev => prev.filter(q => q.id !== id));
    syncRemoveQuotationFile(id); // ลบใบ → ลบไฟล์อัตโนมัติที่ระบบสร้าง (ไม่แตะไฟล์ที่ผู้ใช้แนบเอง)
  }, []);

  const setQuotationStatus = useCallback((id: string, status: QuotationStatus) => {
    setQuotations(prev => {
      const target = prev.find(q => q.id === id);
      // เปลี่ยนเป็นสถานะหลังการส่ง → ติ๊ก จัดทำ/ส่งใบเสนอราคา ให้ลีดอัตโนมัติ
      // (setTimeout กัน StrictMode เรียกซ้ำระหว่าง updater)
      if (target && status !== "draft") {
        const snap = { ...target, status };
        setTimeout(() => completeLeadQuoteTasks(snap, ["makeQuote", "sendQuote"]), 0);
      }
      return prev.map(q => q.id !== id ? q : { ...q, status });
    });
  }, [completeLeadQuoteTasks]);

  // ── Appointment mutations ────────────────────────────────────────
  const addAppointment = useCallback((appt: AppointmentMock) => {
    setAppointments(prev => [...prev, appt]);
  }, []);
  const updateAppointment = useCallback((appt: AppointmentMock) => {
    setAppointments(prev => prev.map(a => a.id !== appt.id ? a : appt));
  }, []);
  const deleteAppointment = useCallback((id: number) => {
    setAppointments(prev => prev.filter(a => a.id !== id));
  }, []);

  return (
    <SalesContext.Provider value={{
      deals, addDeal, updateDealTask, moveDealStage, closeDeal,
      updateDealNotes, addDealFile, logDealActivity,
      leadDealMap, openDealFromLead, getDealForLead,
      leadChecklists, updateLeadChecklist,
      leads, updateLeadStatus, addLead, updateLead, deleteLead,
      customers, addCustomer, updateCustomer, deleteCustomer,
      quotations, addQuotation, updateQuotation, deleteQuotation, setQuotationStatus,
      appointments, addAppointment, updateAppointment, deleteAppointment,
      convertLeadToCustomer,
    }}>
      {children}
    </SalesContext.Provider>
  );
}

export function useSales() {
  const ctx = useContext(SalesContext);
  if (!ctx) throw new Error("useSales must be used inside SalesProvider");
  return ctx;
}

// ── Helpers ─────────────────────────────────────────────────────────
const CUSTOMER_PALETTE = ["#003366","#059669","#f59e0b","#dc2626","#002244","#8fa3b8","#2D2D2D","#C0C0C0"];
function deriveInitials(name: string): string {
  return name.replace(/บจ\.|หจก\./g, "").trim().slice(0, 2) || "—";
}

function parseLeadValue(v: string): number {
  return parseBaht(v);
}

const DEFAULT_TASKS = [
  "ติดต่อลูกค้าและแนะนำตัว",
  "ส่งแม่แบบและข้อมูลผลิตภัณฑ์",
  "นัดประชุมนำเสนอ",
  "สำรวจความต้องการลูกค้า",
  "จัดทำใบเสนอราคา",
  "ส่งใบเสนอราคาให้ลูกค้า",
  "ติดตามผลใบเสนอราคา",
];
