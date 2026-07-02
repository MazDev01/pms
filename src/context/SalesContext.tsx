"use client";

import {
  createContext, useContext, useState, useCallback,
  type ReactNode,
} from "react";
import {
  pipelineDeals, pipelineStages,
  quotations as seedQuotations, initialCustomers,
  appointments as seedAppointments,
  type PipelineDealMock, type LeadRow, type DealActivity,
  type CustomerRow, type QuotationMock, type QuotationStatus,
  type AppointmentMock,
} from "@/lib/mock";

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
  const [deals, setDeals]           = useState<PipelineDealMock[]>(pipelineDeals);
  const [leads, setLeads]           = useState<LeadRow[]>(initialLeads);
  const [leadDealMap, setLeadDealMap] = useState<Record<string, number>>({});
  const [nextDealId, setNextDealId] = useState(pipelineDeals.length + 1);
  const [leadChecklists, setLeadChecklists] = useState<Record<string, ChecklistItem[]>>({});
  const [customers, setCustomers]   = useState<CustomerRow[]>(initialCustomers);
  const [quotations, setQuotations] = useState<QuotationMock[]>(seedQuotations);
  const [appointments, setAppointments] = useState<AppointmentMock[]>(seedAppointments);
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
      const updated = {
        ...d,
        tasks: d.tasks.map(t => t.id !== taskId ? t : { ...t, done }),
      };
      if (task) {
        const now = new Date().toISOString();
        updated.activities = [
          {
            id: Date.now(),
            type: done ? "task_done" : "task_undone",
            text: `${done ? "เสร็จงาน" : "ยังไม่เสร็จ"}: ${task.text}`,
            timestamp: now,
          },
          ...(d.activities ?? []),
        ];
      }
      return updated;
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
  // removeLead = true → "เปลี่ยนลีดเป็นลูกค้า" (ลบออกจากรายการผู้สนใจ) · false → แค่ผูกลูกค้าให้ลีด (คงลีดไว้ เช่นตอนสร้างใบเสนอราคา)
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
    const newCustomer: CustomerRow = {
      id: newId,
      name: lead.contact || lead.company,
      company: lead.company,
      type: "บริษัท",
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
      totalValue: 0,
    };
    setCustomers(prev => [...prev, newCustomer]);
    if (removeLead) {
      // ปิดการขาย/แปลงเป็นลูกค้า → ลีดกลายเป็นลูกค้าเต็มตัว จึงเอาออกจากรายการผู้สนใจ
      setLeads(prev => prev.filter(l => l.id !== lead.id));
    } else {
      // แค่ผูกลูกค้าให้ลีด (ยังเป็นผู้สนใจอยู่)
      setLeads(prev => prev.map(l => l.id !== lead.id ? l : { ...l, customerId: newId }));
    }
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
        // ปิดการขายสำเร็จ → เปลี่ยนลีดเป็นลูกค้าเต็มตัว (ออกจากรายการผู้สนใจ),
        // ผูกดีลกับลูกค้าใหม่ และตั้งใบเสนอราคาที่เกี่ยวข้องเป็น "ตอบรับ" (won)
        if (lead) {
          const customer = convertLeadToCustomer(lead, true);
          setDeals(prev => prev.map(d => d.id === dealId ? { ...d, customerId: customer.id } : d));
          setQuotations(prev => prev.map(q =>
            q.customerId === customer.id && q.status !== "won" ? { ...q, status: "won" } : q
          ));
        }
      } else if (lead) {
        // ปิดการขายไม่สำเร็จ → ตั้งลีดเป็นไม่ได้งาน (ยังอยู่ในรายการผู้สนใจ)
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
      stageId:    1,
      assigned:   lead.assigned,
      dealer:     "สาขาของฉัน",
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
        { id: Date.now(), type: "deal_created", text: `สร้างโอกาสการขายจากลีด: ${lead.company}`, timestamp: now },
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
    setLeads(prev => prev.map(l => l.id !== leadId ? l : { ...l, status }));
  }, []);

  const addLead = useCallback((lead: LeadRow) => {
    setLeads(prev => [lead, ...prev]);
  }, []);

  const updateLead = useCallback((lead: LeadRow) => {
    setLeads(prev => prev.map(l => l.id !== lead.id ? l : lead));
  }, []);

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

  // ── Quotation mutations ──────────────────────────────────────────
  const addQuotation = useCallback((quotation: QuotationMock) => {
    setQuotations(prev => [quotation, ...prev]);
  }, []);

  const updateQuotation = useCallback((quotation: QuotationMock) => {
    setQuotations(prev => prev.map(q => q.id !== quotation.id ? q : quotation));
  }, []);

  const deleteQuotation = useCallback((id: string) => {
    setQuotations(prev => prev.filter(q => q.id !== id));
  }, []);

  const setQuotationStatus = useCallback((id: string, status: QuotationStatus) => {
    setQuotations(prev => prev.map(q => q.id !== id ? q : { ...q, status }));
  }, []);

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
  const n = parseFloat(v.replace(/[฿,]/g, ""));
  if (v.includes("M")) return n * 1e6;
  if (v.includes("K")) return n * 1e3;
  return n || 0;
}

const DEFAULT_TASKS = [
  "ติดต่อลูกค้าและแนะนำตัว",
  "ส่งแคตตาล็อกและข้อมูลผลิตภัณฑ์",
  "นัดประชุมนำเสนอ",
  "สำรวจความต้องการลูกค้า",
  "จัดทำใบเสนอราคา",
  "ส่งใบเสนอราคาให้ลูกค้า",
  "ติดตามผลใบเสนอราคา",
];
