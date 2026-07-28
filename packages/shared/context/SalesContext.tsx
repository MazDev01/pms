"use client";

import {
  createContext, useContext, useState, useCallback, useRef, useEffect,
  type ReactNode,
} from "react";
import { logRepoRead } from "@pms/shared/lib/repoLog";
import { useRole } from "@pms/shared/context/RoleContext";
import {
  quotations as seedQuotations, initialCustomers, DEFAULT_ISSUER, DEFAULT_QUOTE_NUMBERING,
  type IssuerProfile,
  appointments as seedAppointments, buildLeadTasks, stageFromTasks, syncTasksToStage,
  quotationToFile, AUTO_FILE_BY, fmtISOToThai,
  type LeadRow,
  type CustomerRow, type QuotationMock, type QuotationStatus,
  type AppointmentMock, type DealerFile,
} from "@pms/shared/lib/mock";

import { usePersistentState } from "@pms/shared/lib/usePersistentState";
import { parseBaht } from "@pms/shared/lib/format";
import { matchCustomers } from "@pms/shared/lib/customerMatch";
import { APP_NOW_ISO } from "@pms/shared/context/FilterContext";
import { dealerSettings as dealerSettingsRepo, leads as leadsRepo, customers as customersRepo, quotations as quotationsRepo, appointments as appointmentsRepo, files as filesRepo, storage as fileStorage, realtime } from "@pms/shared/lib/data";
import { DATA_SOURCE } from "@pms/shared/lib/data/config";

// โหมด backend — supabase: ลีดมาจาก DB (RLS แยกสาขา) · local: LocalAdapter (localStorage)
const USE_SUPABASE = DATA_SOURCE === "supabase";

// ปิดใบหมดอายุ = คำสั่ง "เขียน" — ทำครั้งเดียวพอต่อสาขาต่อ session (M5)
// เดิมยิงทุกครั้งที่ mount/สลับสาขา → เขียนซ้ำโดยไม่จำเป็น (ยิ่งหลายแท็บยิ่งบ่อย)
const expiredThisSession = new Set<string>();

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
  /** เลข num_id ถัดไปของสาขาแบบ atomic (M7) — id ที่แสดง (#L-…) derive จากค่านี้
   *  เดิมหน้าจอใช้ Math.max+1 ฝั่ง client → สร้างลีดพร้อมกันในสาขาเดียว num_id/id ชนกันได้ */
  newLeadNumId: () => Promise<number>;
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
  /** สร้างใบใหม่ = ออกเลข + insert แบบ atomic (H8) · รับ draft ที่ยังไม่มี id · คืนใบที่บันทึกจริง */
  createQuotation: (draft: Omit<QuotationMock, "id">) => Promise<QuotationMock>;
  updateQuotation: (quotation: QuotationMock) => void;
  deleteQuotation: (id: string) => void;
  setQuotationStatus: (id: string, status: QuotationStatus) => void;
  /** เลขนัดหมายถัดไปของสาขา — ออกจาก DB แบบ atomic เหมือนเลขลูกค้า/เลขที่ใบ
   *  (เดิมหน้าปฏิทินใช้ Date.now() · หน้าลีดใช้ max+1 — คนละแบบและไม่กันชนจริง) */
  newAppointmentId: () => Promise<number>;



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

  // สัญญาณ "ข้อมูลขายเปลี่ยน" (M9 Phase 4) — ตัวเลขเดียวที่ bump เมื่อโหลด/เขียน/realtime
  //   hook ที่รวมยอดที่ DB (RPC) ผูก refetch กับตัวนี้แทนการจับ array ตรง ๆ
  //   → ก้าวต่อไปตัดการโหลด array เต็มของ HQ ได้ โดย reactivity ไม่พัง (เปลี่ยนต้นทาง bump เป็น realtime)
  salesVersion: number;
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
  const { dealerCode, isHQ, hydrated, isLoggedIn } = useRole();
  const myDealerCode = dealerCode || "CNX";
  // ── M9 Phase 4 (unload) — HQ ในโหมด supabase ไม่โหลด array งานขายทั้งเครืออีกต่อไป ──
  // ทุก surface ของ HQ อ่านผ่าน RPC/รายการแบ่งหน้าที่ DB แล้ว (dashboard/quotations/leads/pipeline/
  //   customers/dealers-detail/กระดิ่งแจ้งเตือน/ค้นหา) → ไม่ต้องถือ leads/quotations/customers/appointments
  //   ของทั้ง 10 สาขาไว้ในหน่วยความจำ · reactivity มาจาก realtime → bump salesVersion (hook RPC refetch)
  // ตัวแทน (ไม่ใช่ HQ) และโหมด local ยังโหลดตามเดิม (ต้องใช้ array ทำ CRUD หน้าตัวแทน)
  const gateHQ = USE_SUPABASE && isHQ;

  // ── Leads (Phase 1) — โหลดผ่าน repository (async) + เขียนทะลุถึง repo ──
  // supabase: RLS ที่ DB คืนเฉพาะลีดสาขาตัวเอง (HQ = ทั้งเครือ) · local: LocalAdapter กรอง + เก็บ localStorage
  // seed แรก: local ใช้ initialLeads ทันที (ไม่มี network) · supabase เริ่มว่างแล้วเติมเมื่อโหลดเสร็จ (กัน flash ข้ามสาขา)
  const [leads, setLeads] = useState<LeadRow[]>(USE_SUPABASE ? [] : initialLeads);
  // ref อ่านค่า leads ล่าสุดใน callback โดยไม่พึ่ง closure (ใช้ใน updateLeadStatus / completeLeadQuoteTasks)
  const leadsRef = useRef(leads);
  useEffect(() => { leadsRef.current = leads; }, [leads]);

  // โหลดลีดเมื่อ auth พร้อม + รีโหลดเมื่อสลับสาขา (login คนละบัญชี) — scope ส่งให้ repo (RLS ฝั่ง supabase)
  useEffect(() => {
    if (!hydrated || gateHQ) return; // HQ/supabase: ไม่โหลดลีดทั้งเครือ (อ่านผ่าน RPC แทน)
    let alive = true;
    leadsRepo.list({ dealerCode, isHQ })
      .then((rows) => { if (alive) setLeads(rows); })
      .catch((e) => { if (alive) logRepoRead("leads.list", e); });
    return () => { alive = false; };
  }, [hydrated, dealerCode, isHQ, gateHQ]);

  // ── การบันทึกล้มเหลว ต้อง "ดัง" เสมอ (C1) ────────────────────────────────
  // เดิม: .catch(console.error) → RLS ปฏิเสธ/เน็ตหลุด แล้วผู้ใช้ยังเห็นข้อมูลบนจอเหมือนบันทึกสำเร็จ
  // ตอนนี้: แจ้งผู้ใช้ + ดึงของจริงจาก repo มาทับ เพื่อไม่ให้จอค้างอยู่กับค่าที่ไม่ได้ถูกบันทึก
  const [syncError, setSyncError] = useState<string | null>(null);

  // M9 Phase 4: สัญญาณข้อมูลขายเปลี่ยน — ตอนนี้ derive จากอาร์เรย์ (bump เมื่อโหลด/เขียน/realtime เปลี่ยน array)
  //   พฤติกรรมเท่าเดิมกับที่ hook เคยจับ [leads,quotations] · เฟสถัดไปเปลี่ยนต้นทาง bump เป็น realtime ตรง
  //   (effect ที่ bump อยู่หลังประกาศ array ทั้ง 4 — กัน TDZ)
  const [salesVersion, setSalesVersion] = useState(0);
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
  // Lead→Won: แอปเป็นแหล่งเดียวที่สร้างลูกค้า (convertLeadToCustomer) — ข้อมูลครบ · id จริงจากตัวนับ DB
  //           trigger on_quote_won ที่ DB ถูกลบใน 0033 (เดิมสร้างลูกค้า id=0 ไร้ชื่อ + นับยอดซ้ำ · C6)
  const [customers, setCustomers]   = useState<CustomerRow[]>(USE_SUPABASE ? [] : initialCustomers);
  useEffect(() => {
    if (!hydrated || gateHQ) return; // HQ/supabase: ลูกค้าทั้งเครืออ่านผ่าน repo ที่หน้า /hq/customers เอง
    let alive = true;
    customersRepo.list({ dealerCode, isHQ })
      .then((rows) => { if (alive) setCustomers(rows); })
      .catch((e) => { if (alive) logRepoRead("customers.list", e); });
    return () => { alive = false; };
  }, [hydrated, dealerCode, isHQ, gateHQ]);
  const persistCustomer = useRef({
    create: (c: CustomerRow) => { void customersRepo.create(c).catch(onFail("customers", "สร้างลูกค้า")); },
    update: (c: CustomerRow) => { void customersRepo.update(c).catch(onFail("customers", "แก้ไขลูกค้า")); },
    remove: (id: number) => { void customersRepo.remove(id).catch(onFail("customers", "ลบลูกค้า")); },
  }).current;
  // ── Quotations (Phase 3) — โหลดผ่าน repository (async) + เขียนทะลุถึง repo ──
  // supabase: RLS แยกสาขา · setStatus→won ให้แอปสร้างลูกค้าเอง (ดู setQuotationStatus · trigger ถูกลบ 0033)
  const [quotations, setQuotations] = useState<QuotationMock[]>(USE_SUPABASE ? [] : seedQuotationsStamped);
  const quotationsRef = useRef(quotations);
  useEffect(() => { quotationsRef.current = quotations; }, [quotations]);
  useEffect(() => {
    if (!hydrated || gateHQ) return; // HQ/supabase: ใบทั้งเครืออ่านผ่าน RPC (summary/listPage) แทน array
    let alive = true;
    // ปิดใบที่เลยวันหมดอายุก่อนโหลด (H5) — ใช้ "วันนี้ของระบบ" (APP_NOW) ให้ตรงกับที่หน้าจอแสดง
    // ตัวแทนเท่านั้นที่ปิดได้ (RLS) · HQ ข้ามไป เพราะเขียนงานขายไม่ได้อยู่แล้ว
    //
    // ⚠️ ต้องเช็ก isLoggedIn ด้วย ไม่ใช่แค่ hydrated
    //    hydrated = "ฟื้น session เสร็จแล้ว" ซึ่งเป็น true แม้ผลลัพธ์คือ "ไม่มี session"
    //    AuthGuard ก็ยังเรนเดอร์ลูกไว้ (แค่ซ่อนด้วย CSS) → หน้า login จึงยิง RPC ตัวนี้
    //    ในสถานะยังไม่ล็อกอินทุกครั้ง = สั่ง "เขียน" โดยไม่มีตัวตน
    //    เดิมผ่านเงียบ ๆ เพราะ RLS ทำให้แก้ 0 แถว · พอปิดสิทธิ์ anon (0031) จึงโผล่เป็น 401
    const scope = { dealerCode, isHQ };
    // ปิดใบหมดอายุครั้งเดียวพอต่อสาขาต่อ session (M5) — HQ/ยังไม่ล็อกอิน ไม่ต้องทำ
    const skipExpire = isHQ || !isLoggedIn || expiredThisSession.has(myDealerCode);
    if (!skipExpire) expiredThisSession.add(myDealerCode);
    const prepare = skipExpire
      ? Promise.resolve(0)
      : quotationsRepo.expireOverdue(APP_NOW_ISO, scope).catch(() => { expiredThisSession.delete(myDealerCode); return 0; });
    prepare
      .then(() => quotationsRepo.list(scope))
      .then((rows) => { if (alive) setQuotations(rows); })
      .catch((e) => { if (alive) logRepoRead("quotations.list", e); });
    return () => { alive = false; };
  }, [hydrated, dealerCode, isHQ, isLoggedIn, gateHQ]);
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
    if (!hydrated || gateHQ) return; // HQ/supabase: นัดหมายดึงเฉพาะที่ต้องใช้ (per-lead/per-dealer) ที่หน้า
    let alive = true;
    appointmentsRepo.list({ dealerCode, isHQ })
      .then((rows) => { if (alive) setAppointments(rows); })
      .catch((e) => { if (alive) logRepoRead("appointments.list", e); });
    return () => { alive = false; };
  }, [hydrated, dealerCode, isHQ, gateHQ]);
  // bump สัญญาณเมื่อข้อมูลขายชุดใดเปลี่ยน (โหลด/เขียน/realtime) — hook RPC ผูก refetch กับ salesVersion
  useEffect(() => { setSalesVersion(v => v + 1); }, [leads, quotations, customers, appointments]);
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
      // HQ/supabase (gate): ไม่ถือ array แล้ว → มีอะไรเปลี่ยนทั้งเครือ ก็แค่ bump ให้ hook RPC refetch
      if (gateHQ) { setSalesVersion(v => v + 1); return; }
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
  }, [hydrated, dealerCode, isHQ, gateHQ]);
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
        // R6: ยอดลูกค้า = ผลรวมใบเสนอราคาที่ปิดได้ (won) ของลูกค้ารายนี้ — รองรับ "ปิดหลายดีล"
        //   เดิม total_value ตั้งครั้งเดียวตอนสร้าง = เท่าดีลแรก · ที่นี่รวมสดจาก next (relink แล้ว)
        //   guard wonTotal>0: ปิดจากลีดที่ไม่มีใบ (won=0) ไม่ล้างค่าที่ตั้งตอนสร้าง (parseBaht(lead.value))
        //   (persist ใน updater = ตามแบบ persistQuote ข้างบน · StrictMode เรียกซ้ำ = เขียนค่าเดิม idempotent)
        const wonTotal = next
          .filter(q => q.customerId === customerId && q.status === "won")
          .reduce((s, q) => s + (q.totalValue ?? 0), 0);
        if (wonTotal > 0) {
          setCustomers(cp => {
            const nc = cp.map(c => c.id === customerId ? { ...c, totalValue: wonTotal } : c);
            const cust = nc.find(c => c.id === customerId);
            if (cust) persistCustomer.update(cust);
            return nc;
          });
        }
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
      joinDate: APP_NOW_ISO, // วันสมัคร = วันนี้ของระบบ (supabase=จริง / local=ตรึง)
      owner: lead.assigned,
      initials: deriveInitials(lead.company || lead.name),
      color: CUSTOMER_PALETTE[newId % CUSTOMER_PALETTE.length],
      totalValue: parseBaht(lead.value),
      logo: lead.logo,   // พารูป/โลโก้ที่อัปโหลดไว้ตอนเป็นลีดมาด้วย
      dealerCode: lead.dealerCode ?? "CNX", // ลูกค้าเป็นของสาขาเดียวกับลีดที่ปิดการขาย (multi-tenant)
    };
    setCustomers(prev => [...prev, newCustomer]);
    // ⚠️ ต้อง "รอ" ลูกค้าลง DB จริงก่อน relink ใบเสนอราคา (M6):
    //   FK (dealer_code, customer_id) → customers บังคับว่าใบที่ผูก customerId ต้องมีลูกค้าอยู่ก่อน
    //   เดิมยิงสร้างลูกค้า + อัปเดตใบพร้อมกันแบบ optimistic → ใบอาจถึง DB ก่อนลูกค้า = FK violate
    try {
      await customersRepo.create(newCustomer); // Lead→Won สร้างลูกค้าข้อมูลครบ (RLS with-check ใช้ dealerCode นี้)
    } catch (e) {
      onFail("customers", "สร้างลูกค้า")(e); // แจ้ง + ดึงชุดจริงมาทับ · ไม่ relink ใบ (กัน FK violate)
      throw e; // ให้ผู้เรียกรู้ว่าล้มเหลว — เส้นทางปิดการขาย (won) จะได้ไม่ mark won ทั้งที่ไม่มีลูกค้า
    }
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
      setTimeout(() => { void convertLeadToCustomer({ ...lead, status }, false).catch(() => { /* onFail แจ้งแล้ว */ }); }, 0);
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
      setTimeout(() => { void convertLeadToCustomer(lead, false).catch(() => { /* onFail แจ้งแล้ว */ }); }, 0);
    }
  }, [convertLeadToCustomer, persistLead]);

  // เก็บกวาดไฟล์ที่ผูกกับเรคคอร์ดที่ถูกลบ (metadata + ไบต์ใน Storage) — กันไฟล์กำพร้า (A2.1)
  //   files.record_id เป็น polymorphic (ลีด/ลูกค้า) ผูก FK/cascade ที่ DB ไม่ได้ จึงเก็บที่ชั้นแอป
  //   best-effort: ล้มเหลว = แค่เหลือไฟล์กำพร้าเหมือนเดิม (ไม่บล็อกการลบเรคคอร์ด)
  const cleanupFilesFor = useCallback(async (match: (f: DealerFile) => boolean) => {
    const s = fileScopeRef.current;
    try {
      const all = await filesRepo.list({ dealerCode: s.dealerCode, isHQ: s.isHQ });
      await Promise.all(all.filter(match).map(async (f) => {
        try {
          if (f.storagePath) await fileStorage.remove(f.storagePath); // ลบไบต์ก่อน (เหมือนหน้าไฟล์)
          await filesRepo.remove(f.id);
        } catch (e) { console.warn("[cleanupFiles] ลบไฟล์กำพร้าไม่สำเร็จ", e); }
      }));
    } catch (e) { console.warn("[cleanupFiles] อ่านรายการไฟล์ไม่สำเร็จ", e); }
  }, []);

  const deleteLead = useCallback((leadId: string) => {
    const lead = leadsRef.current.find(l => l.id === leadId);
    setLeads(prev => prev.filter(l => l.id !== leadId));
    persistLead.remove(leadId);
    // ลบไฟล์ที่แนบกับลีดนี้ (source=lead · record_id = numId ของลีด)
    if (lead?.numId != null) void cleanupFilesFor(f => f.source === "lead" && f.recordId === lead.numId);
  }, [persistLead, cleanupFilesFor]);

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
    // ลบไฟล์ที่แนบกับลูกค้ารายนี้ (source=customer · record_id/customer_id = id ของลูกค้า)
    void cleanupFilesFor(f => f.source === "customer" && (f.recordId === id || f.customerId === id));
  }, [persistCustomer, cleanupFilesFor]);

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
          // ผู้ทำงาน = ผู้รับผิดชอบของลีด (ไม่ใช่ "ระบบ"/ดีลเลอร์) · วันปิดงาน = วันนี้ของระบบ (supabase=จริง)
          return { ...t, done: true, doneAt: fmtISOToThai(APP_NOW_ISO), doneBy: l.assigned || "อัปเดตอัตโนมัติ" };
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
  // สร้างใบใหม่ = ออกเลข + insert แบบ atomic (H8) — รับ draft ที่ "ยังไม่มี id" · DB เป็นคนออกเลข
  // เดิมแยกเป็น newQuoteId() แล้ว addQuotation(withId) → insert ล้มหลังออกเลข = เลขหาย
  // ตอนนี้เดินผ่าน createNumbered ทางเดียว: await ให้บันทึกจริงก่อน แล้วค่อยอัปเดตจอ (ไม่ optimistic แต่ถูกต้อง)
  const createQuotation = useCallback(async (draft: Omit<QuotationMock, "id">): Promise<QuotationMock> => {
    // สแนปช็อตโปรไฟล์บริษัท ณ ตอนสร้าง + ติด dealerCode สาขาที่ล็อกอิน (multi-tenant)
    const base = { ...draft, issuer: draft.issuer ?? issuerRef.current, dealerCode: draft.dealerCode ?? myDealerCode };
    const created = await quotationsRepo.createNumbered(myDealerCode, quotePrefixRef.current, base);
    setQuotations(prev => [created, ...prev]);
    // สร้างใบ → จัดทำใบเสนอราคา (ถ้าสร้างเป็นสถานะส่งแล้วขึ้นไป ให้ติ๊กส่งด้วย)
    completeLeadQuoteTasks(created, created.status === "draft" ? ["makeQuote"] : ["makeQuote", "sendQuote"]);
    syncQuoteFile.add(created); // auto-link → ไฟล์ (หมวดใบเสนอราคา) ผูกกับลีด/ลูกค้า
    return created;
  }, [completeLeadQuoteTasks, myDealerCode, syncQuoteFile]);

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
    const target = quotationsRef.current.find(q => q.id === id);
    const prevStatus = target?.status;
    setQuotations(prev => prev.map(q => q.id !== id ? q : { ...q, status })); // optimistic UI
    if (!target || status === "draft") { persistQuote.setStatus(id, status); return; }
    // เปลี่ยนเป็นสถานะหลังการส่ง → ติ๊ก จัดทำ/ส่งใบเสนอราคา ให้ลีดอัตโนมัติ
    // (setTimeout กัน StrictMode เรียกซ้ำระหว่าง updater)
    const snap = { ...target, status };
    setTimeout(() => completeLeadQuoteTasks(snap, ["makeQuote", "sendQuote"]), 0);

    // "ลูกค้าตอบรับ" (won) บนใบเสนอราคา → สร้าง/ผูกลูกค้าให้ลีดต้นทาง ผ่านเส้นทางเดียว
    // กับการปิดจากลิ้นชักลีด (convertLeadToCustomer) — ได้ id จริง ข้อมูลครบ กันซ้ำ (trigger ถูกลบ 0033)
    //
    // ⚠️ atomicity เส้นทางเงินหลัก: ต้อง "สร้าง/ผูกลูกค้าสำเร็จก่อน" แล้วค่อย mark won ที่ DB
    //   ถ้าสร้างลูกค้าไม่ลง DB → ไม่ mark won + ย้อนสถานะใบใน UI (กัน "won ค้างโดยไม่มีลูกค้า")
    //   เดิมยิง setStatus(won) ทันทีแบบ fire-and-forget แล้วค่อยสร้างลูกค้าใน setTimeout แยก —
    //   พลาดกลางทาง = ใบเป็น won แต่ไม่มีลูกค้า (หรือกลับกัน) เงียบ ๆ
    const linkable = status === "won" && !(target.customerId && target.customerId > 0);
    const lead = linkable
      ? leadsRef.current.find(l => (target.dealId != null && l.numId === target.dealId) || l.company === target.customer)
      : undefined;
    if (lead && lead.customerId == null) {
      void (async () => {
        try {
          await convertLeadToCustomer(lead, false); // สร้าง/ผูกลูกค้า (dedup · idempotent)
          persistQuote.setStatus(id, status);        // สำเร็จแล้วค่อย mark won ที่ DB
        } catch {
          // ลูกค้าไม่ลง DB → ย้อนสถานะใบ ไม่ mark won (convertLeadToCustomer แจ้ง error เองแล้ว)
          setQuotations(prev => prev.map(q => q.id !== id ? q : { ...q, status: prevStatus ?? "sent_to_client" }));
        }
      })();
      return;
    }
    // กรณีอื่น (sent/lost/expired · won ที่ผูกลูกค้าแล้ว/ไม่มีลีดต้นทาง) — mark สถานะตามปกติ
    persistQuote.setStatus(id, status);
    // R6: won บนใบที่ "ผูกลูกค้าเดิมอยู่แล้ว" (ดีลที่ 2+) → รวมยอดลูกค้าใหม่ (finish() ไม่ครอบเคสนี้)
    //   ใบอื่นที่ won ของลูกค้า (จาก ref) + ใบนี้ที่กำลัง won — นับใบนี้ครั้งเดียว (q.id !== id แล้วบวก target)
    if (status === "won" && target.customerId && target.customerId > 0) {
      const cid = target.customerId;
      const wonTotal = quotationsRef.current
        .filter(q => q.customerId === cid && q.status === "won" && q.id !== id)
        .reduce((s, q) => s + (q.totalValue ?? 0), 0) + (target.totalValue ?? 0);
      setCustomers(prev => {
        const nc = prev.map(c => c.id === cid ? { ...c, totalValue: wonTotal } : c);
        const cust = nc.find(c => c.id === cid);
        if (cust) persistCustomer.update(cust);
        return nc;
      });
    }
  }, [completeLeadQuoteTasks, convertLeadToCustomer, persistQuote, persistCustomer]);

  // เลขที่ใบเสนอราคาถัดไป — ผ่าน repo (supabase: RPC next_quote_no atomic · local: max+1)
  // คำนำหน้าเลขที่เป็นของตัวแทน (ตั้งค่า › ใบเสนอราคา) — ตัวนับเดินหน้าที่ DB
  // อ่าน localStorage ตรงนี้ได้ เพราะเป็นค่าของ "สาขาตัวเอง" ใน origin เดียวกัน ไม่ใช่ค่าที่ HQ เป็นเจ้าของ
  // หัวกระดาษของสาขา — โหลดผ่าน repo ไว้ล่วงหน้า เพื่อสแนปช็อตลงใบตอนสร้าง (addQuotation เป็น sync)
  // เดิมเรียก loadIssuer() ซึ่งอ่าน localStorage → โหมด supabase ได้ค่าเริ่มต้นของโปรเจกต์เสมอ
  // = ใบเสนอราคาที่ส่งลูกค้าขึ้นชื่อบริษัทผิด (ชื่อสาขาเดโม แทนชื่อสาขาจริง)
  const issuerRef = useRef<IssuerProfile>(DEFAULT_ISSUER);
  // คำนำหน้าเลขที่ก็เป็นของสาขาเช่นกัน — ต้องอ่านจากที่เดียวกับหัวกระดาษ
  // เดิมใช้ loadQuoteNumbering() ที่อ่าน localStorage → ตัวแทนตั้งคำนำหน้าไว้ใน DB แล้ว
  // แต่เวลาออกใบยังได้ค่าจากเครื่อง (คนละค่ากับที่หน้าตั้งค่าแสดง)
  const quotePrefixRef = useRef<string>(DEFAULT_QUOTE_NUMBERING.prefix);
  useEffect(() => {
    if (!hydrated) return;
    dealerSettingsRepo.get(myDealerCode)
      .then(cfg => {
        issuerRef.current = cfg.issuer;
        if (cfg.document?.quotePrefix) quotePrefixRef.current = cfg.document.quotePrefix;
      })
      .catch(e => logRepoRead("dealerSettings.get", e));
  }, [hydrated, myDealerCode]);

  // เลขนัดถัดไป — ให้ DB เป็นคนออกให้ (atomic ต่อสาขา) แบบเดียวกับลูกค้าและใบเสนอราคา
  const newAppointmentId = useCallback(
    () => appointmentsRepo.nextId(myDealerCode),
    [myDealerCode],
  );

  // เลข num_id ถัดไปของลีด — atomic ต่อสาขา (M7) แบบเดียวกับลูกค้า/นัด/ใบเสนอราคา
  const newLeadNumId = useCallback(() => leadsRepo.nextNumId(myDealerCode), [myDealerCode]);

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
      leads, updateLeadStatus, newLeadNumId, addLead, updateLead, deleteLead,
      customers, addCustomer, updateCustomer, deleteCustomer,
      quotations, createQuotation, updateQuotation, deleteQuotation, setQuotationStatus,
      newAppointmentId,
      appointments, addAppointment, updateAppointment, deleteAppointment,
      convertLeadToCustomer,
      syncError, clearSyncError: () => setSyncError(null),
      salesVersion,
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

