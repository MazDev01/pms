"use client";

import {
  createContext, useContext, useState, useCallback, useRef, useEffect,
  type ReactNode,
} from "react";
import { useRole } from "@pms/shared/context/RoleContext";
import {
  quotations as seedQuotations, initialCustomers, DEFAULT_ISSUER, loadQuoteNumbering,
  type IssuerProfile,
  appointments as seedAppointments, buildLeadTasks, stageFromTasks, syncTasksToStage,
  quotationToFile, AUTO_FILE_BY,
  type LeadRow,
  type CustomerRow, type QuotationMock, type QuotationStatus,
  type AppointmentMock,
} from "@pms/shared/lib/mock";

import { usePersistentState } from "@pms/shared/lib/usePersistentState";
import { parseBaht } from "@pms/shared/lib/format";
import { matchCustomers } from "@pms/shared/lib/customerMatch";
import { APP_NOW_ISO } from "@pms/shared/context/FilterContext";
import { dealerSettings as dealerSettingsRepo, leads as leadsRepo, customers as customersRepo, quotations as quotationsRepo, appointments as appointmentsRepo, files as filesRepo, realtime } from "@pms/shared/lib/data";
import { DATA_SOURCE } from "@pms/shared/lib/data/config";

// โหมด backend — supabase: ลีดมาจาก DB (RLS แยกสาขา) · local: LocalAdapter (localStorage)
const USE_SUPABASE = DATA_SOURCE === "supabase";

// ใบเสนอราคาเดิม (seed) = ออกภายใต้โปรไฟล์บริษัทตั้งต้น → ตรึงชื่อไว้ ไม่เปลี่ยนตามโปรไฟล์ที่แก้ทีหลัง
const seedQuotationsStamped: QuotationMock[] = seedQuotations.map(q =>
  q.issuer ? q : { ...q, issuer: { ...DEFAULT_ISSUER } }
);

// ── คีย์เก็บข้อมูลงานขายลง localStorage — กด F5 แล้วข้อมูลต้องไม่หาย ──────────────
// สำคัญ: ถ้าแก้ "ข้อมูลตั้งต้น" ใน mock.ts (เพิ่มฟิลด์/แก้ค่า) ต้องขึ้นเลขเวอร์ชันคีย์ด้วย
// ไม่งั้นเบราว์เซอร์ที่เคยเปิดจะอ่านของเก่าที่บันทึกไว้ทับตลอด แล้วมองไม่เห็นข้อมูลใหม่
// ─── Types ─────────────────────────────────────────────────────────
// โดเมนที่เขียนผ่าน repo — ใช้บอกว่าต้องดึงชุดไหนกลับมาทับเมื่อบันทึกล้มเหลว
export type SyncEntity = "leads" | "quotations" | "customers" | "appointments";

// ── กระดาน Pipeline/Deals ถูกยุบเข้ากับ "ลูกค้าเป้าหมาย" แล้ว ──────────────────
// เหตุผล: เดิมมีสองที่ที่บอกว่าดีลไปถึงไหน (deal.stageId/tasks กับ lead.status/tasks)
//         = ความจริงซ้ำซ้อน · และ deals เก็บแค่ใน localStorage เครื่องเดียว HQ ไม่เคยเห็น
// ตอนนี้ LeadRow เป็นแหล่งเดียว (status + tasks + activities + customerId)
export type SalesContextType = {
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
  newQuoteId: () => Promise<string>; // เลขที่ใบถัดไป — supabase: RPC atomic ต่อสาขา · local: max+1



  // Appointments (lifted — ปฏิทิน/แดชบอร์ด/แจ้งเตือน ใช้ชุดเดียวกันสด)
  appointments: AppointmentMock[];
  addAppointment: (appt: AppointmentMock) => void;
  updateAppointment: (appt: AppointmentMock) => void;
  deleteAppointment: (id: number) => void;

  // Lead → Customer conversion (creates a REAL customer)
  convertLeadToCustomer: (lead: LeadRow, removeLead?: boolean) => Promise<CustomerRow>;

  // สถานะการบันทึกล้มเหลว (C1) — หน้าจอกลาง (AppShell) เอาไปแสดงเตือนผู้ใช้
  syncError: string | null;
  clearSyncError: () => void;
};

const SalesContext = createContext<SalesContextType | null>(null);

export function SalesProvider({
  children,
  initialLeads,
}: {
  children: ReactNode;
  initialLeads: LeadRow[];
}) {
  // สาขาที่ล็อกอิน (multi-tenant) + auth พร้อมหรือยัง (hydrated) — โหลดลีดตามขอบเขตสาขา
  const { dealerCode, isHQ, hydrated } = useRole();
  const myDealerCode = dealerCode || "CNX";

  // ── Leads (Phase 1) — โหลดผ่าน repository (async) + เขียนทะลุถึง repo ──
  // supabase: RLS ที่ DB คืนเฉพาะลีดสาขาตัวเอง (HQ = ทั้งเครือ) · local: LocalAdapter กรอง + เก็บ localStorage
  // seed แรก: local ใช้ initialLeads ทันที (ไม่มี network) · supabase เริ่มว่างแล้วเติมเมื่อโหลดเสร็จ (กัน flash ข้ามสาขา)
  const [leads, setLeads] = useState<LeadRow[]>(USE_SUPABASE ? [] : initialLeads);
  // ref อ่านค่า leads ล่าสุดใน callback โดยไม่พึ่ง closure (ใช้ใน updateLeadStatus / completeLeadQuoteTasks)
  const leadsRef = useRef(leads);
  useEffect(() => { leadsRef.current = leads; }, [leads]);

  // โหลดลีดเมื่อ auth พร้อม + รีโหลดเมื่อสลับสาขา (login คนละบัญชี) — scope ส่งให้ repo (RLS ฝั่ง supabase)
  useEffect(() => {
    if (!hydrated) return;
    let alive = true;
    leadsRepo.list({ dealerCode, isHQ })
      .then((rows) => { if (alive) setLeads(rows); })
      .catch((e) => { if (alive) console.error("[leads.list]", e); });
    return () => { alive = false; };
  }, [hydrated, dealerCode, isHQ]);

  // ── การบันทึกล้มเหลว ต้อง "ดัง" เสมอ (C1) ────────────────────────────────
  // เดิม: .catch(console.error) → RLS ปฏิเสธ/เน็ตหลุด แล้วผู้ใช้ยังเห็นข้อมูลบนจอเหมือนบันทึกสำเร็จ
  // ตอนนี้: แจ้งผู้ใช้ + ดึงของจริงจาก repo มาทับ เพื่อไม่ให้จอค้างอยู่กับค่าที่ไม่ได้ถูกบันทึก
  const [syncError, setSyncError] = useState<string | null>(null);
  // late-bind: ตัวรายงานถูกประกอบหลัง state ทุกตัวถูกประกาศ (ดู useEffect ด้านล่าง)
  const failRef = useRef<(entity: SyncEntity, op: string, e: unknown) => void>(() => {});
  const onFail = (entity: SyncEntity, op: string) => (e: unknown) => failRef.current(entity, op, e);

  // เขียนทะลุถึง repo — optimistic: อัปเดต UI ก่อน แล้ว persist เบื้องหลัง
  const persistLead = useRef({
    create: (l: LeadRow) => { void leadsRepo.create(l).catch(onFail("leads", "สร้างลูกค้าเป้าหมาย")); },
    update: (l: LeadRow) => { void leadsRepo.update(l).catch(onFail("leads", "แก้ไขลูกค้าเป้าหมาย")); },
    remove: (id: string) => { void leadsRepo.remove(id).catch(onFail("leads", "ลบลูกค้าเป้าหมาย")); },
  }).current;
  // ── Customers (Phase 2) — โหลดผ่าน repository (async) + เขียนทะลุถึง repo ──
  // supabase: RLS แยกสาขา (HQ = ทั้งเครือ) · local: LocalAdapter กรอง + เก็บ localStorage
  // Lead→Won: โหมด supabase มี trigger on_quote_won ที่ DB เป็นตัวสำรอง (upsert by id) — แอปยังสร้างลูกค้า
  //           แบบข้อมูลครบผ่าน repo เหมือนเดิม (ไม่กุข้อมูล) · id ชนกันข้ามสาขา = ข้อควรระวัง (ดูสรุป)
  const [customers, setCustomers]   = useState<CustomerRow[]>(USE_SUPABASE ? [] : initialCustomers);
  useEffect(() => {
    if (!hydrated) return;
    let alive = true;
    customersRepo.list({ dealerCode, isHQ })
      .then((rows) => { if (alive) setCustomers(rows); })
      .catch((e) => { if (alive) console.error("[customers.list]", e); });
    return () => { alive = false; };
  }, [hydrated, dealerCode, isHQ]);
  const persistCustomer = useRef({
    create: (c: CustomerRow) => { void customersRepo.create(c).catch(onFail("customers", "สร้างลูกค้า")); },
    update: (c: CustomerRow) => { void customersRepo.update(c).catch(onFail("customers", "แก้ไขลูกค้า")); },
    remove: (id: number) => { void customersRepo.remove(id).catch(onFail("customers", "ลบลูกค้า")); },
  }).current;
  // ── Quotations (Phase 3) — โหลดผ่าน repository (async) + เขียนทะลุถึง repo ──
  // supabase: RLS แยกสาขา · setStatus→won จะทริก on_quote_won ที่ DB (สร้างลูกค้าอัตโนมัติ)
  const [quotations, setQuotations] = useState<QuotationMock[]>(USE_SUPABASE ? [] : seedQuotationsStamped);
  const quotationsRef = useRef(quotations);
  useEffect(() => { quotationsRef.current = quotations; }, [quotations]);
  useEffect(() => {
    if (!hydrated) return;
    let alive = true;
    // ปิดใบที่เลยวันหมดอายุก่อนโหลด (H5) — ใช้ "วันนี้ของระบบ" (APP_NOW) ให้ตรงกับที่หน้าจอแสดง
    // ตัวแทนเท่านั้นที่ปิดได้ (RLS) · HQ ข้ามไป เพราะเขียนงานขายไม่ได้อยู่แล้ว
    const scope = { dealerCode, isHQ };
    const prepare = isHQ
      ? Promise.resolve(0)
      : quotationsRepo.expireOverdue(APP_NOW_ISO, scope).catch(() => 0);
    prepare
      .then(() => quotationsRepo.list(scope))
      .then((rows) => { if (alive) setQuotations(rows); })
      .catch((e) => { if (alive) console.error("[quotations.list]", e); });
    return () => { alive = false; };
  }, [hydrated, dealerCode, isHQ]);
  const persistQuote = useRef({
    create: (q: QuotationMock) => { void quotationsRepo.create(q).catch(onFail("quotations", "สร้างใบเสนอราคา")); },
    update: (q: QuotationMock) => { void quotationsRepo.update(q).catch(onFail("quotations", "แก้ไขใบเสนอราคา")); },
    remove: (id: string) => { void quotationsRepo.remove(id).catch(onFail("quotations", "ลบใบเสนอราคา")); },
    setStatus: (id: string, status: QuotationStatus) => { void quotationsRepo.setStatus(id, status).catch(onFail("quotations", "เปลี่ยนสถานะใบเสนอราคา")); },
  }).current;
  // auto-link ไฟล์ใบเสนอราคา (metadata) ผ่าน repository — แทน syncAddQuotationFile/Remove เดิม (Phase 6)
  const fileScopeRef = useRef({ dealerCode, isHQ, myDealerCode });
  fileScopeRef.current = { dealerCode, isHQ, myDealerCode };
  const syncQuoteFile = useRef({
    add: (q: QuotationMock) => {
      const s = fileScopeRef.current;
      filesRepo.list({ dealerCode: s.dealerCode, isHQ: s.isHQ }).then(files => {
        if (files.some(f => f.category === "ใบเสนอราคา" && f.name.includes(q.id))) return; // กันซ้ำ
        void filesRepo.add({ ...quotationToFile(q), dealerCode: q.dealerCode ?? s.myDealerCode });
      }).catch(() => {});
    },
    remove: (id: string) => {
      const s = fileScopeRef.current;
      filesRepo.list({ dealerCode: s.dealerCode, isHQ: s.isHQ }).then(files => {
        const f = files.find(x => x.category === "ใบเสนอราคา" && x.name.includes(id) && x.uploadedBy === AUTO_FILE_BY);
        if (f) void filesRepo.remove(f.id); // ลบเฉพาะไฟล์ที่ระบบสร้างเอง
      }).catch(() => {});
    },
  }).current;
  // ── Appointments (Phase 4) — โหลดผ่าน repository (async) + เขียนทะลุถึง repo ──
  // supabase: RLS แยกสาขา · local: LocalAdapter กรอง + เก็บ localStorage
  const [appointments, setAppointments] = useState<AppointmentMock[]>(USE_SUPABASE ? [] : seedAppointments);
  useEffect(() => {
    if (!hydrated) return;
    let alive = true;
    appointmentsRepo.list({ dealerCode, isHQ })
      .then((rows) => { if (alive) setAppointments(rows); })
      .catch((e) => { if (alive) console.error("[appointments.list]", e); });
    return () => { alive = false; };
  }, [hydrated, dealerCode, isHQ]);
  const persistAppt = useRef({
    create: (a: AppointmentMock) => { void appointmentsRepo.create(a).catch(onFail("appointments", "สร้างนัดหมาย")); },
    update: (a: AppointmentMock) => { void appointmentsRepo.update(a).catch(onFail("appointments", "แก้ไขนัดหมาย")); },
    remove: (id: number) => { void appointmentsRepo.remove(id).catch(onFail("appointments", "ลบนัดหมาย")); },
  }).current;

  // ประกอบตัวรายงานความล้มเหลว (C1) — ทำหลัง state ครบทุกตัวแล้วจึงรู้จัก setter ทั้งหมด
  // หน้าที่: แจ้งผู้ใช้ + ดึงชุดข้อมูลจริงจาก repo มาทับ (ยกเลิก optimistic ที่ไม่ได้ถูกบันทึก)
  useEffect(() => {
    failRef.current = (entity, op, e) => {
      const detail = e instanceof Error ? e.message : String(e);
      console.error(`[${entity}] ${op}`, e);
      setSyncError(`บันทึกไม่สำเร็จ: ${op} — ${detail}`);
      const scope = { dealerCode, isHQ };
      if (entity === "leads") leadsRepo.list(scope).then(setLeads).catch(() => {});
      else if (entity === "quotations") quotationsRepo.list(scope).then(setQuotations).catch(() => {});
      else if (entity === "customers") customersRepo.list(scope).then(setCustomers).catch(() => {});
      else appointmentsRepo.list(scope).then(setAppointments).catch(() => {});
    };
  }, [dealerCode, isHQ]);

  // ── Realtime — มีคนแก้ข้อมูลจากเครื่องอื่น → อัปเดตเฉพาะแถวนั้น ──
  // supabase: postgres_changes (RLS กรอง event ตามสาขาให้แล้ว) · local: no-op (ยังใช้ event bus เดิม)
  useEffect(() => {
    if (!hydrated) return;
    // patch เฉพาะแถวที่เปลี่ยน (H2) — เดิมโหลดทั้งตารางใหม่ทุก event ซึ่งไม่ไหวเมื่อข้อมูลเยอะ
    // แถวที่ได้มาถูก RLS กรองแล้ว (เห็นเฉพาะที่มีสิทธิ์) จึงนำมาใส่ได้เลย
    const upsert = <T extends { id: string | number }>(list: T[], row: T): T[] => {
      const i = list.findIndex(x => x.id === row.id);
      return i >= 0 ? list.map((x, j) => (j === i ? row : x)) : [row, ...list];
    };
    return realtime.subscribeSales((ch) => {
      if (ch.type === "DELETE") {
        if (ch.table === "leads") setLeads(prev => prev.filter(l => l.id !== ch.id));
        else if (ch.table === "quotations") setQuotations(prev => prev.filter(q => q.id !== ch.id));
        else if (ch.table === "customers") setCustomers(prev => prev.filter(c => c.id !== ch.id));
        else setAppointments(prev => prev.filter(a => a.id !== ch.id));
        return;
      }
      if (ch.table === "leads") setLeads(prev => upsert(prev, ch.row));
      else if (ch.table === "quotations") setQuotations(prev => upsert(prev, ch.row));
      else if (ch.table === "customers") setCustomers(prev => upsert(prev, ch.row));
      else setAppointments(prev => upsert(prev, ch.row));
    });
  }, [hydrated, dealerCode, isHQ]);
  // ── Lead → Customer conversion (creates a REAL customer) ─────────
  // removeLead = true → "เปลี่ยนลีดเป็นลูกค้า" (ลบออกจากรายการลูกค้าเป้าหมาย) · false → แค่ผูกลูกค้าให้ลีด (คงลีดไว้ เช่นตอนสร้างใบเสนอราคา)
  // async เพราะเลข id ลูกค้าออกจาก DB แบบ atomic ต่อสาขา (C5) — กันชนเมื่อสร้างพร้อมกัน
  const convertLeadToCustomer = useCallback(async (lead: LeadRow, removeLead = false): Promise<CustomerRow> => {
    // ถ้าลีดมี customerId ที่มีอยู่แล้ว → คืนลูกค้าเดิม (ไม่สร้างซ้ำ)
    if (lead.customerId != null) {
      const existing = customers.find(c => c.id === lead.customerId);
      if (existing) {
        if (removeLead) { setLeads(prev => prev.filter(l => l.id !== lead.id)); persistLead.remove(lead.id); }
        return existing;
      }
    }
    const ownerDealer = lead.dealerCode ?? myDealerCode;
    // ลีดยังไม่ผูกลูกค้า แต่บริษัทนี้อาจเป็นลูกค้าอยู่แล้ว (เปิดลีดใหม่เอง แทนที่จะกด "สร้างดีลใหม่")
    // ชื่อตรงเป๊ะภายในสาขาเดียวกัน = บริษัทเดียวกัน → ผูกเข้ากับลูกค้าเดิม ไม่แตกเป็นลูกค้าซ้ำอีกราย
    // (ไม่แตะข้อมูลลูกค้าเดิม — ยอด/ประวัติของเขาเป็นของจริงที่สะสมไว้แล้ว)
    // ปิดท้ายเหมือนกันทั้งกรณีลูกค้าใหม่และลูกค้าเดิม: จัดการตัวลีด + ผูกใบเสนอราคาที่ออกไว้ก่อนหน้า
    const finish = (customerId: number) => {
      if (removeLead) {
        // ปิดการขาย/แปลงเป็นลูกค้า → ลีดกลายเป็นลูกค้าเต็มตัว จึงเอาออกจากรายการลูกค้าเป้าหมาย
        setLeads(prev => prev.filter(l => l.id !== lead.id));
        persistLead.remove(lead.id);
      } else {
        // แค่ผูกลูกค้าให้ลีด (ยังเป็นลูกค้าเป้าหมายอยู่)
        setLeads(prev => prev.map(l => l.id !== lead.id ? l : { ...l, customerId }));
        persistLead.update({ ...lead, customerId });
      }
      // ผูกใบเสนอราคาที่ออกก่อน WON (customerId=0 ในนามบริษัทลีด) เข้ากับลูกค้ารายนี้ย้อนหลัง + persist
      setQuotations(prev => {
        const relinked: QuotationMock[] = [];
        const next = prev.map(q => {
          if ((!q.customerId || q.customerId === 0) && q.customer === lead.company) {
            const nq = { ...q, customerId };
            relinked.push(nq);
            return nq;
          }
          return q;
        });
        relinked.forEach(q => persistQuote.update(q));
        return next;
      });
    };

    const dup = matchCustomers(customers, lead.company, ownerDealer).exact;
    if (dup) { finish(dup.id); return dup; }

    const newId = await customersRepo.nextId(ownerDealer);
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
      dealerCode: lead.dealerCode ?? "CNX", // ลูกค้าเป็นของสาขาเดียวกับลีดที่ปิดการขาย (multi-tenant)
    };
    setCustomers(prev => [...prev, newCustomer]);
    persistCustomer.create(newCustomer); // Lead→Won สร้างลูกค้าข้อมูลครบ (supabase: RLS with-check ใช้ dealerCode นี้)
    finish(newId);
    return newCustomer;
  }, [customers, myDealerCode, persistCustomer, persistLead, persistQuote]);

  // ── Lead mutations ───────────────────────────────────────────────
  const updateLeadStatus = useCallback((leadId: string, status: LeadRow["status"]) => {
    // สร้างลูกค้าเฉพาะตอนปิดการขายสำเร็จ (WON) — ตัดสินใจนอก updater กัน StrictMode เรียกซ้ำใน dev
    const lead = leadsRef.current.find(l => l.id === leadId);
    if (!lead) return;
    // ย้ายสถานะ → ติ๊กงานใน Checklist ให้ถึงสเตจนั้นอัตโนมัติ (ผู้ทำ = ผู้รับผิดชอบของลีด)
    const updated: LeadRow = { ...lead, status, tasks: syncTasksToStage(lead.tasks, status, lead.assigned || "—") };
    setLeads(prev => prev.map(l => l.id !== leadId ? l : updated));
    persistLead.update(updated); // สถานะ + tasks เปลี่ยน → update ทั้งแถว (แทน setStatus)
    if (status === "PAID" && lead.customerId == null) {
      setTimeout(() => { void convertLeadToCustomer({ ...lead, status }, false); }, 0);
    }
  }, [convertLeadToCustomer, persistLead]);

  const addLead = useCallback((lead: LeadRow) => {
    // ติด dealerCode ของสาขาที่ล็อกอิน (multi-tenant) — ลีดใหม่เป็นของสาขานั้น (RLS with-check ฝั่ง supabase)
    const tagged: LeadRow = { ...lead, dealerCode: lead.dealerCode ?? myDealerCode };
    setLeads(prev => [tagged, ...prev]);
    persistLead.create(tagged);
  }, [myDealerCode, persistLead]);

  const updateLead = useCallback((lead: LeadRow) => {
    setLeads(prev => prev.map(l => l.id !== lead.id ? l : lead));
    persistLead.update(lead);
    // ปิดการขายสำเร็จ → สร้างลูกค้า (เฉพาะยังไม่เป็นลูกค้า)
    if (lead.status === "PAID" && lead.customerId == null) {
      setTimeout(() => { void convertLeadToCustomer(lead, false); }, 0);
    }
  }, [convertLeadToCustomer, persistLead]);

  const deleteLead = useCallback((leadId: string) => {
    setLeads(prev => prev.filter(l => l.id !== leadId));
    persistLead.remove(leadId);
  }, [persistLead]);

  // ── Customer mutations (Phase 2) — เขียนทะลุถึง repo ──────────────
  const addCustomer = useCallback((customer: CustomerRow) => {
    // ติด dealerCode ของสาขาที่ล็อกอิน (multi-tenant) — ลูกค้าใหม่เป็นของสาขานั้น (RLS with-check ฝั่ง supabase)
    const tagged: CustomerRow = { ...customer, dealerCode: customer.dealerCode ?? myDealerCode };
    setCustomers(prev => [...prev, tagged]);
    persistCustomer.create(tagged);
  }, [myDealerCode, persistCustomer]);

  const updateCustomer = useCallback((customer: CustomerRow) => {
    setCustomers(prev => prev.map(c => c.id !== customer.id ? c : customer));
    persistCustomer.update(customer);
  }, [persistCustomer]);

  // ลบลูกค้า — ต้องไม่ทิ้ง "ข้อมูลกำพร้า" ไว้ (H1)
  // DB ยังผูก FK ระหว่างใบเสนอราคา/ลีด กับลูกค้าไม่ได้ (customerId ใช้ 0 แทน "ยังไม่มีลูกค้า")
  // จึงต้องกันที่ชั้นแอป: มีใบเสนอราคา/ลีดผูกอยู่ = ลบไม่ได้ ต้องจัดการของที่ผูกก่อน
  const deleteCustomer = useCallback((id: number) => {
    const linkedQuotes = quotationsRef.current.filter(q => q.customerId === id).length;
    const linkedLeads = leadsRef.current.filter(l => l.customerId === id).length;
    if (linkedQuotes || linkedLeads) {
      const parts = [
        linkedQuotes ? `ใบเสนอราคา ${linkedQuotes} ใบ` : "",
        linkedLeads ? `ลูกค้าเป้าหมาย ${linkedLeads} รายการ` : "",
      ].filter(Boolean).join(" และ ");
      setSyncError(`ลบลูกค้าไม่ได้ — ยังมี${parts}ผูกอยู่ · กรุณาย้าย/ลบรายการเหล่านั้นก่อน`);
      return;
    }
    setCustomers(prev => prev.filter(c => c.id !== id));
    persistCustomer.remove(id);
  }, [persistCustomer]);

  // ── Quotation → เช็กงานของลีดอัตโนมัติ ─────────────────────────────
  // สร้างใบเสนอราคา = ติ๊ก "จัดทำใบเสนอราคา" · ส่งใบเสนอราคา = ติ๊ก "ส่งใบเสนอราคา"
  // แล้วเลื่อนสถานะลีดตาม stageFromTasks (เลื่อนขึ้นเท่านั้น ไม่ดึงถอยหลัง)
  const completeLeadQuoteTasks = useCallback((quotation: QuotationMock, keys: string[]) => {
    const RANK: Partial<Record<LeadRow["status"], number>> = { WAITING: 0, BULLET: 1, QUOTED: 2, FOLLOWUP: 3, NEGO: 4 };
    // คิดจาก leadsRef (ค่าล่าสุด) แทน updater เพื่อเก็บ "ลีดที่เปลี่ยน" ไป persist ทีละแถวได้
    const changedLeads: LeadRow[] = [];
    const nextList = leadsRef.current.map(l => {
      // กันเขียนข้ามสาขา: repo คืนเฉพาะลีดสาขาที่ล็อกอินอยู่แล้ว แต่กันไว้อีกชั้น (ลีดไม่ระบุ dealerCode = CNX)
      // ไม่งั้น match ด้วย company ชื่อซ้ำ/พิมพ์เอง จะเลื่อนสถานะ+ประทับผู้ทำทับลีดของสาขาอื่น
      // (คู่แฝดฝั่งเขียนของบั๊กรั่วข้ามสาขา — ดู branch-isolation.spec.ts) · แตะเฉพาะลีดของสาขาที่ล็อกอิน
      if ((l.dealerCode ?? "CNX") !== myDealerCode) return l;
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
      const nl: LeadRow = { ...l, tasks, status };
      changedLeads.push(nl);
      return nl;
    });
    if (changedLeads.length) {
      setLeads(nextList);
      changedLeads.forEach(l => persistLead.update(l));
    }
  }, [myDealerCode, persistLead]);

  // ── Quotation mutations ──────────────────────────────────────────
  const addQuotation = useCallback((quotation: QuotationMock) => {
    // สแนปช็อตโปรไฟล์บริษัท ณ ตอนสร้าง — ใบใหม่ใช้ชื่อปัจจุบัน, ใบเก่าคงชื่อเดิมเมื่อเปลี่ยนโปรไฟล์ทีหลัง
    // + ติด dealerCode ของสาขาที่ล็อกอิน (multi-tenant) — ใบใหม่เป็นของสาขานั้น
    const base = quotation.issuer ? quotation : { ...quotation, issuer: issuerRef.current };
    const stamped = { ...base, dealerCode: base.dealerCode ?? myDealerCode };
    setQuotations(prev => [stamped, ...prev]);
    persistQuote.create(stamped);
    // สร้างใบ → จัดทำใบเสนอราคา (ถ้าสร้างเป็นสถานะส่งแล้วขึ้นไป ให้ติ๊กส่งด้วย)
    completeLeadQuoteTasks(quotation, quotation.status === "draft" ? ["makeQuote"] : ["makeQuote", "sendQuote"]);
    syncQuoteFile.add(stamped); // auto-link → ไฟล์ (หมวดใบเสนอราคา) ผูกกับลีด/ลูกค้า
  }, [completeLeadQuoteTasks, myDealerCode, persistQuote, syncQuoteFile]);

  const updateQuotation = useCallback((quotation: QuotationMock) => {
    setQuotations(prev => prev.map(q => q.id !== quotation.id ? q : quotation));
    persistQuote.update(quotation);
    if (quotation.status !== "draft") completeLeadQuoteTasks(quotation, ["makeQuote", "sendQuote"]);
  }, [completeLeadQuoteTasks, persistQuote]);

  const deleteQuotation = useCallback((id: string) => {
    setQuotations(prev => prev.filter(q => q.id !== id));
    persistQuote.remove(id);
    syncQuoteFile.remove(id); // ลบใบ → ลบไฟล์อัตโนมัติที่ระบบสร้าง (ไม่แตะไฟล์ที่ผู้ใช้แนบเอง)
  }, [persistQuote, syncQuoteFile]);

  const setQuotationStatus = useCallback((id: string, status: QuotationStatus) => {
    persistQuote.setStatus(id, status); // supabase: won → ทริก on_quote_won สร้างลูกค้าที่ DB
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
  }, [completeLeadQuoteTasks, persistQuote]);

  // เลขที่ใบเสนอราคาถัดไป — ผ่าน repo (supabase: RPC next_quote_no atomic · local: max+1)
  // คำนำหน้าเลขที่เป็นของตัวแทน (ตั้งค่า › ใบเสนอราคา) — ตัวนับเดินหน้าที่ DB
  // อ่าน localStorage ตรงนี้ได้ เพราะเป็นค่าของ "สาขาตัวเอง" ใน origin เดียวกัน ไม่ใช่ค่าที่ HQ เป็นเจ้าของ
  // หัวกระดาษของสาขา — โหลดผ่าน repo ไว้ล่วงหน้า เพื่อสแนปช็อตลงใบตอนสร้าง (addQuotation เป็น sync)
  // เดิมเรียก loadIssuer() ซึ่งอ่าน localStorage → โหมด supabase ได้ค่าเริ่มต้นของโปรเจกต์เสมอ
  // = ใบเสนอราคาที่ส่งลูกค้าขึ้นชื่อบริษัทผิด (ชื่อสาขาเดโม แทนชื่อสาขาจริง)
  const issuerRef = useRef<IssuerProfile>(DEFAULT_ISSUER);
  useEffect(() => {
    if (!hydrated) return;
    dealerSettingsRepo.get(myDealerCode)
      .then(cfg => { issuerRef.current = cfg.issuer; })
      .catch(e => console.error("[dealerSettings.get]", e));
  }, [hydrated, myDealerCode]);

  const newQuoteId = useCallback(
    () => quotationsRepo.nextQuoteNo(myDealerCode, loadQuoteNumbering().prefix),
    [myDealerCode],
  );

  // ── Appointment mutations (Phase 4) — เขียนทะลุถึง repo ──────────
  const addAppointment = useCallback((appt: AppointmentMock) => {
    // ติด dealerCode ของสาขาที่ล็อกอิน (multi-tenant) — นัดใหม่เป็นของสาขานั้น (RLS with-check ฝั่ง supabase)
    const tagged: AppointmentMock = { ...appt, dealerCode: appt.dealerCode ?? myDealerCode };
    setAppointments(prev => [...prev, tagged]);
    persistAppt.create(tagged);
  }, [myDealerCode, persistAppt]);
  const updateAppointment = useCallback((appt: AppointmentMock) => {
    setAppointments(prev => prev.map(a => a.id !== appt.id ? a : appt));
    persistAppt.update(appt);
  }, [persistAppt]);
  const deleteAppointment = useCallback((id: number) => {
    setAppointments(prev => prev.filter(a => a.id !== id));
    persistAppt.remove(id);
  }, [persistAppt]);

  return (
    <SalesContext.Provider value={{
      leads, updateLeadStatus, addLead, updateLead, deleteLead,
      customers, addCustomer, updateCustomer, deleteCustomer,
      quotations, addQuotation, updateQuotation, deleteQuotation, setQuotationStatus, newQuoteId,
      appointments, addAppointment, updateAppointment, deleteAppointment,
      convertLeadToCustomer,
      syncError, clearSyncError: () => setSyncError(null),
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
