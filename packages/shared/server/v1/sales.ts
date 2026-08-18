// ── /api/v1/{leads,quotations,customers,appointments} — โดเมนงานขาย ─────────────
//
// ระยะ 1 กลุ่มที่ 12–15 · กลุ่มหนักที่สุด (มี pagination + RPC + mapper เฉพาะ)
//
// พฤติกรรมคัดมาจาก SupabaseAdapter ทีละบรรทัด — ใช้ตัวแปลงแถวชุดเดียวกัน (rowMappers.ts)
// ไม่ได้เขียนใหม่ ไม่งั้นสองฝั่งจะแปลงข้อมูลไม่ตรงกันแบบที่ไม่มีใครเห็นจนกว่าจะพัง
//
// ⚠️ กติกาที่ห้ามหลุด (แต่ละข้อเคยเป็นบั๊กจริงมาแล้ว):
//   • ORDER ต้องพ่วง dealer_code เสมอ — เลขงานขายเดินแยกรายสาขา เสมอกันได้ข้ามสาขา
//   • listForCustomer / listForLead ต้องระบุสาขาเสมอ — id ซ้ำข้ามสาขาได้ HQ เห็นทั้งเครือ
//   • create/update ของใบ ต้องผ่าน quoteToRow (ตัด product_line ที่เป็นคอลัมน์ generated)
//   • งานที่ต้อง atomic ใช้ RPC เดิมทุกตัว ห้ามแตกเป็นหลายคำสั่ง
//
// ⚠️ ค่ากลาง (APP_NOW / DEFAULT_LEAD_RULES / DEFAULT_HQ_POLICY) เป็นของฝั่งแอป —
//    ผู้เรียกเติมมาให้แล้ว เซิร์ฟเวอร์ส่งต่อตรง ๆ (เหตุผลเดียวกับ settings/dealerSettings)
import type { NextRequest } from "next/server";
import { handler, ok, dbFail, fail } from "./_ctx";
import { pageAll, rangedFetch, TIEBREAK_COL } from "./_page";
import { toCamel, toSnake } from "@pms/shared/lib/data/supabase/mappers";
import {
  normalizeCustomer, leadToRow, rowToLead, quoteToRow, rowToQuote, apptToRow, rowToAppt,
} from "@pms/shared/lib/data/supabase/rowMappers";
import type { LeadRow, QuotationMock, CustomerRow, AppointmentMock } from "@pms/shared/lib/data/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;
export { runtime } from "./_ctx";

const op = (req: NextRequest) => new URL(req.url).searchParams.get("op") ?? "";
const qp = (req: NextRequest, k: string) => new URL(req.url).searchParams.get(k) ?? "";
const scopeOf = (req: NextRequest) => {
  const u = new URL(req.url);
  return { dealer: u.searchParams.get("dealer") ?? "", isHQ: u.searchParams.get("hq") === "1" };
};
const body = <T,>(req: NextRequest) => req.json().catch(() => null) as Promise<T | null>;

/** ไล่ดึงทั้งตารางของ scope นั้น (เรียงเสถียร) — คืนธง partial ให้ฝั่งแอปเตือนเมื่อชนเพดาน */
function listAll(sb: SupabaseClient, table: string, dealer: string, isHQ: boolean) {
  return pageAll((from, to) => {
    const base = sb.from(table).select("*")
      .order("id", { ascending: true }).order(TIEBREAK_COL, { ascending: true }).range(from, to);
    return !isHQ && dealer ? base.eq("dealer_code", dealer) : base;
  });
}

// ── ลูกค้าเป้าหมาย ──────────────────────────────────────────────────────────────
export const leadsGET = handler("leads.list", async (req, sb) => {
  const { dealer, isHQ } = scopeOf(req);
  const { rows, partial } = await listAll(sb, "leads", dealer, isHQ);
  return ok({ rows: rows.map(rowToLead), partial });
});

export const leadsPOST = handler("leads.write", async (req, sb) => {
  const o = op(req);
  if (o === "next") {
    const b = await body<{ dealerCode?: string }>(req);
    if (!b?.dealerCode) return fail(400, "ไม่ได้ระบุสาขา");
    const { data, error } = await sb.rpc("next_entity_id", { p_dealer: b.dealerCode, p_entity: "leads" });
    if (error) return dbFail("leads.nextNumId", error);
    return ok(Number(data));
  }
  if (o === "page") {
    // ทั้งชุดคิดที่ DB ผ่าน RPC leads_page — ตัวกรอง overdue ต้องใช้เกณฑ์รายสาขา คิดฝั่งแอปไม่ได้
    const f = (await body<Record<string, unknown>>(req)) ?? {};
    const { data, error } = await sb.rpc("leads_page", {
      p_limit: f.limit, p_offset: f.offset,
      p_status: f.status ?? null, p_dealer_codes: f.dealerCodes ?? null,
      p_province: f.province ?? null, p_product: f.product ?? null, p_source: f.source ?? null,
      p_search: f.search ?? null, p_date_start: f.dateStart ?? null, p_date_end: f.dateEnd ?? null,
      p_overdue: f.overdue ?? false, p_as_of: f.asOf ?? null,
      p_default_days: f.defaultDays ?? null, p_follow_up_days: f.perDealer ?? null,
    });
    if (error) return dbFail("leads.listPage", error);
    const d = (data ?? {}) as { total?: number; rows?: Row[] };
    return ok({ rows: (d.rows ?? []).map(rowToLead), total: Number(d.total ?? 0) });
  }
  const row = await body<LeadRow>(req);
  if (!row) return fail(400, "ข้อมูลลูกค้าเป้าหมายไม่ถูกต้อง");
  const { data, error } = await sb.from("leads").insert(leadToRow(row)).select().single();
  if (error) return dbFail("leads.create", error);
  return ok(rowToLead(data as Row));
});

export const leadsPUT = handler("leads.update", async (req, sb) => {
  if (op(req) === "status") {
    const b = await body<{ id?: string; status?: string }>(req);
    if (!b?.id || !b.status) return fail(400, "ไม่ได้ระบุลูกค้าเป้าหมายหรือสถานะ");
    const { error } = await sb.from("leads").update({ status: b.status }).eq("id", b.id);
    if (error) return dbFail("leads.setStatus", error);
    return ok({ ok: true });
  }
  const row = await body<LeadRow>(req);
  if (!row?.id) return fail(400, "ไม่ได้ระบุลูกค้าเป้าหมายที่จะแก้");
  const { data, error } = await sb.from("leads").update(leadToRow(row)).eq("id", row.id).select().single();
  if (error) return dbFail("leads.update", error);
  return ok(rowToLead(data as Row));
});

export const leadsDELETE = handler("leads.remove", async (req, sb) => {
  const id = qp(req, "id");
  if (!id) return fail(400, "ไม่ได้ระบุลูกค้าเป้าหมายที่จะลบ");
  const { error } = await sb.from("leads").delete().eq("id", id);
  if (error) return dbFail("leads.remove", error);
  return ok({ ok: true });
});

// ── ใบเสนอราคา ──────────────────────────────────────────────────────────────────
export const quotesGET = handler("quotations.list", async (req, sb) => {
  const o = op(req);
  if (o === "salesperson") {
    // ต้องส่งสาขาไปด้วย — เลขที่ใบซ้ำข้ามสาขาได้ (คีย์จริงคือ dealer_code + id)
    const { data, error } = await sb.rpc("quotation_salesperson", { p_quote_id: qp(req, "id"), p_dealer_code: qp(req, "dealer") });
    if (error) return dbFail("quotations.salesperson", error);
    return ok((data as string | null) ?? null);
  }
  if (o === "for-customer") {
    const dealer = qp(req, "dealer");
    const cid = Number(qp(req, "customerId"));
    if (!dealer || !Number.isFinite(cid)) return fail(400, "ต้องระบุสาขาและเลขลูกค้า");
    const { data, error } = await sb.from("quotations").select("*")
      .eq("dealer_code", dealer).eq("customer_id", cid).eq("status", "won").order("date", { ascending: true });
    if (error) return dbFail("quotations.listForCustomer", error);
    return ok((data as Row[]).map(rowToQuote));
  }
  const { dealer, isHQ } = scopeOf(req);
  const { rows, partial } = await listAll(sb, "quotations", dealer, isHQ);
  return ok({ rows: rows.map(rowToQuote), partial });
});

export const quotesPOST = handler("quotations.write", async (req, sb) => {
  const o = op(req);
  if (o === "page") {
    const f = (await body<Record<string, unknown>>(req)) ?? {};
    const { dealer, isHQ } = scopeOf(req);
    const s = String(f.search ?? "").trim().replace(/[,()%*\\]/g, " ").trim();   // กันตัวอักษรที่ทำ or() พัง
    const build = (from: number, to: number) => {
      let q = sb.from("quotations").select("*", { count: "exact" });
      if (!isHQ && dealer) q = q.eq("dealer_code", dealer);
      if (f.status) q = q.eq("status", f.status as string);
      const codes = f.dealerCodes as string[] | undefined;
      const lines = f.productLines as string[] | undefined;
      if (codes?.length) q = q.in("dealer_code", codes);
      if (lines?.length) q = q.in("product_line", lines);
      if (f.dateStart) q = q.gte("date", f.dateStart as string);
      if (f.dateEnd) q = q.lte("date", f.dateEnd as string);
      if (s) {
        const parts = [`id.ilike.%${s}%`, `customer.ilike.%${s}%`];
        const sd = f.searchDealers as string[] | undefined;
        if (sd?.length) parts.push(`dealer_code.in.(${sd.join(",")})`);
        q = q.or(parts.join(","));
      }
      const sort = f.sort as { col?: string; dir?: string } | undefined;
      return q.order(sort?.col ?? "date", { ascending: (sort?.dir ?? "desc") === "asc" })
        .order("id", { ascending: true }).order(TIEBREAK_COL, { ascending: true }).range(from, to);
    };
    const { rows, total } = await rangedFetch<Row>(build, Number(f.limit), Number(f.offset));
    return ok({ rows: rows.map(rowToQuote), total });
  }
  if (o === "numbered") {
    // ออกเลข + insert รวดเดียว (RPC 0034) — insert ล้ม = ตัวนับ rollback ไม่เดิน
    const b = await body<{ dealer?: string; prefix?: string; row?: QuotationMock }>(req);
    if (!b?.dealer || !b.row) return fail(400, "ต้องระบุสาขาและข้อมูลใบ");
    const payload = quoteToRow(b.row);
    delete payload.id; delete payload.created_at; delete payload.dealer_code;   // DB เป็นคนออกให้
    const { data, error } = await sb.rpc("create_quotation", { p_dealer: b.dealer, p_prefix: b.prefix ?? "Q-2026-", p_payload: payload });
    if (error) return dbFail("quotations.createNumbered", error);
    return ok(rowToQuote(data as Row));
  }
  if (o === "expire") {
    const b = await body<{ asOf?: string; validityDays?: number }>(req);
    const { data, error } = await sb.rpc("expire_quotations", { p_as_of: b?.asOf, p_validity_days: b?.validityDays });
    if (error) return dbFail("quotations.expireOverdue", error);
    return ok(Number(data ?? 0));
  }
  if (o === "relink") {
    const b = await body<{ dealer?: string; customerId?: number; company?: string; cascadeWon?: boolean }>(req);
    if (!b?.dealer || b.customerId == null) return fail(400, "ต้องระบุสาขาและเลขลูกค้า");
    const { data, error } = await sb.rpc("relink_customer_quotes", {
      p_dealer: b.dealer, p_customer_id: b.customerId, p_company: b.company ?? "", p_cascade_won: !!b.cascadeWon,
    });
    if (error) return dbFail("quotations.relinkCustomerQuotes", error);
    return ok((data as Row[]).map(rowToQuote));
  }
  const row = await body<QuotationMock>(req);
  if (!row) return fail(400, "ข้อมูลใบเสนอราคาไม่ถูกต้อง");
  const { data, error } = await sb.from("quotations").insert(quoteToRow(row)).select().single();
  if (error) return dbFail("quotations.create", error);
  return ok(rowToQuote(data as Row));
});

export const quotesPUT = handler("quotations.update", async (req, sb) => {
  const o = op(req);
  if (o === "status" || o === "status-reconciled") {
    const b = await body<{ id?: string; status?: string }>(req);
    if (!b?.id || !b.status) return fail(400, "ไม่ได้ระบุใบหรือสถานะ");
    if (o === "status") {
      const { error } = await sb.from("quotations").update({ status: b.status }).eq("id", b.id);
      if (error) return dbFail("quotations.setStatus", error);
      return ok({ ok: true });
    }
    // เปลี่ยนสถานะ + รวมยอดลูกค้าใหม่ ในทรานแซกชันเดียว (0102) — แยกสองคำสั่งเคยได้ยอด 0
    const { data, error } = await sb.rpc("set_quotation_status_reconciled", { p_quote_id: b.id, p_status: b.status });
    if (error) return dbFail("quotations.setStatusReconciled", error);
    const r = data as { quotation: Row; customer: Row | null };
    return ok({
      quotation: rowToQuote(r.quotation),
      customer: r.customer ? normalizeCustomer(toCamel<CustomerRow>(r.customer)) : null,
    });
  }
  const row = await body<QuotationMock>(req);
  if (!row?.id) return fail(400, "ไม่ได้ระบุใบที่จะแก้");
  const { data, error } = await sb.from("quotations").update(quoteToRow(row)).eq("id", row.id).select().single();
  if (error) return dbFail("quotations.update", error);
  return ok(rowToQuote(data as Row));
});

export const quotesDELETE = handler("quotations.remove", async (req, sb) => {
  const id = qp(req, "id");
  if (!id) return fail(400, "ไม่ได้ระบุใบที่จะลบ");
  const { error } = await sb.from("quotations").delete().eq("id", id);
  if (error) return dbFail("quotations.remove", error);
  return ok({ ok: true });
});

// ── ลูกค้า ──────────────────────────────────────────────────────────────────────
export const customersGET = handler("customers.list", async (req, sb) => {
  const { dealer, isHQ } = scopeOf(req);
  const { rows, partial } = await listAll(sb, "customers", dealer, isHQ);
  return ok({ rows: rows.map(r => normalizeCustomer(toCamel<CustomerRow>(r))), partial });
});

export const customersPOST = handler("customers.write", async (req, sb) => {
  const o = op(req);
  if (o === "next") {
    const b = await body<{ dealerCode?: string }>(req);
    if (!b?.dealerCode) return fail(400, "ไม่ได้ระบุสาขา");
    const { data, error } = await sb.rpc("next_entity_id", { p_dealer: b.dealerCode, p_entity: "customers" });
    if (error) return dbFail("customers.nextId", error);
    return ok(Number(data));
  }
  if (o === "page") {
    const f = (await body<Record<string, unknown>>(req)) ?? {};
    const { dealer, isHQ } = scopeOf(req);
    const s = String(f.search ?? "").trim().replace(/[,()%*\\]/g, " ").trim();
    const build = (from: number, to: number) => {
      let q = sb.from("customers").select("*", { count: "exact" });
      if (!isHQ && dealer) q = q.eq("dealer_code", dealer);
      const codes = f.dealerCodes as string[] | undefined;
      if (codes?.length) q = q.in("dealer_code", codes);
      if (s) q = q.or(`name.ilike.%${s}%,company.ilike.%${s}%,province.ilike.%${s}%,phone.ilike.%${s}%`);
      return q.order("id", { ascending: true }).order(TIEBREAK_COL, { ascending: true }).range(from, to);
    };
    const { rows, total } = await rangedFetch<Row>(build, Number(f.limit), Number(f.offset));
    return ok({ rows: rows.map(r => normalizeCustomer(toCamel<CustomerRow>(r))), total });
  }
  if (o === "upsert-company" || o === "close-won") {
    const b = await body<Record<string, unknown>>(req);
    if (!b) return fail(400, "ข้อมูลไม่ถูกต้อง");
    const payload = toSnake((b.payload ?? {}) as Row);
    delete payload.id; delete payload.created_at; delete payload.dealer_code;   // DB เป็นคนออกให้
    if (o === "upsert-company") {
      // หาลูกค้าชื่อตรงเป๊ะ หรือสร้างใหม่ ในทรานแซกชันเดียว (0074) — กันแข่งกันสร้างซ้ำ
      const { data, error } = await sb.rpc("upsert_customer_for_company", { p_dealer: b.dealer, p_payload: payload });
      if (error) return dbFail("customers.upsertForCompany", error);
      return ok(normalizeCustomer(toCamel<CustomerRow>(data as Row)));
    }
    // ปิดการขายทั้งก้อน: หา/สร้างลูกค้า + ผูกใบกำพร้า + บังคับใบเป้าหมาย + รวมยอด ในคำสั่งเดียว (0094/0095)
    const { data, error } = await sb.rpc("close_won_quotation", {
      p_dealer: b.dealer, p_known_customer_id: b.knownCustomerId ?? null, p_lead_company: b.leadCompany,
      p_target_quote_id: b.targetQuoteId ?? null, p_cascade_won: !!b.cascadeWon, p_customer_payload: payload,
    });
    if (error) return dbFail("customers.closeWon", error);
    const r = data as { customer: Row; quotations: Row[] };
    return ok({ customer: normalizeCustomer(toCamel<CustomerRow>(r.customer)), quotations: r.quotations.map(rowToQuote) });
  }
  if (o === "delete-cascade") {
    // กติกา "ยังมีดีลที่ขายอยู่ = ลบไม่ได้" อยู่ในตัว RPC — เซิร์ฟเวอร์ไม่ตัดสินซ้ำ (สองที่ = ไม่ตรงกันวันหนึ่ง)
    const b = await body<{ customerId?: number }>(req);
    if (b?.customerId == null) return fail(400, "ไม่ได้ระบุลูกค้าที่จะลบ");
    const { data, error } = await sb.rpc("delete_customer_cascade", { p_customer_id: b.customerId });
    if (error) return dbFail("customers.deleteCascade", error);
    return ok(data);
  }
  if (o === "reconcile") {
    const b = await body<{ customerId?: number }>(req);
    if (b?.customerId == null) return fail(400, "ไม่ได้ระบุลูกค้า");
    const { data, error } = await sb.rpc("reconcile_customer_won_total", { p_customer_id: b.customerId });
    if (error) return dbFail("customers.reconcileWonTotal", error);
    return ok(normalizeCustomer(toCamel<CustomerRow>(data as Row)));
  }
  const row = await body<CustomerRow>(req);
  if (!row) return fail(400, "ข้อมูลลูกค้าไม่ถูกต้อง");
  const { data, error } = await sb.from("customers").insert(toSnake(row as unknown as Row)).select().single();
  if (error) return dbFail("customers.create", error);
  return ok(normalizeCustomer(toCamel<CustomerRow>(data as Row)));
});

export const customersPUT = handler("customers.update", async (req, sb) => {
  const row = await body<CustomerRow>(req);
  if (row?.id == null) return fail(400, "ไม่ได้ระบุลูกค้าที่จะแก้");
  const { data, error } = await sb.from("customers").update(toSnake(row as unknown as Row)).eq("id", row.id).select().single();
  if (error) return dbFail("customers.update", error);
  return ok(normalizeCustomer(toCamel<CustomerRow>(data as Row)));
});

export const customersDELETE = handler("customers.remove", async (req, sb) => {
  const id = Number(qp(req, "id"));
  if (!Number.isFinite(id)) return fail(400, "ไม่ได้ระบุลูกค้าที่จะลบ");
  const { error } = await sb.from("customers").delete().eq("id", id);
  if (error) return dbFail("customers.remove", error);
  return ok({ ok: true });
});

// ── นัดหมาย ─────────────────────────────────────────────────────────────────────
export const apptGET = handler("appointments.list", async (req, sb) => {
  const o = op(req);
  const dealer = qp(req, "dealer");
  if (o === "for-lead" || o === "for-dealer") {
    // ระบุสาขาเสมอ — lead_id (numId) และเลขนัดหมายซ้ำข้ามสาขาได้
    if (!dealer) return fail(400, "ไม่ได้ระบุสาขา");
    let q = sb.from("appointments").select("*").eq("dealer_code", dealer);
    if (o === "for-lead") {
      const lead = Number(qp(req, "lead"));
      if (!Number.isFinite(lead)) return fail(400, "ไม่ได้ระบุลูกค้าเป้าหมาย");
      q = q.eq("lead_id", lead);
    }
    const { data, error } = await q.order("id", { ascending: true });
    if (error) return dbFail(`appointments.${o}`, error);
    return ok((data as Row[]).map(rowToAppt));
  }
  const { isHQ } = scopeOf(req);
  const { rows, partial } = await listAll(sb, "appointments", dealer, isHQ);
  return ok({ rows: rows.map(rowToAppt), partial });
});

export const apptPOST = handler("appointments.write", async (req, sb) => {
  if (op(req) === "next") {
    const b = await body<{ dealerCode?: string }>(req);
    if (!b?.dealerCode) return fail(400, "ไม่ได้ระบุสาขา");
    const { data, error } = await sb.rpc("next_entity_id", { p_dealer: b.dealerCode, p_entity: "appointments" });
    if (error) return dbFail("appointments.nextId", error);
    return ok(Number(data));
  }
  const row = await body<AppointmentMock>(req);
  if (!row) return fail(400, "ข้อมูลนัดหมายไม่ถูกต้อง");
  const { data, error } = await sb.from("appointments").insert(apptToRow(row)).select().single();
  if (error) return dbFail("appointments.create", error);
  return ok(rowToAppt(data as Row));
});

export const apptPUT = handler("appointments.update", async (req, sb) => {
  const row = await body<AppointmentMock>(req);
  if (row?.id == null) return fail(400, "ไม่ได้ระบุนัดหมายที่จะแก้");
  const { data, error } = await sb.from("appointments").update(apptToRow(row)).eq("id", row.id).select().single();
  if (error) return dbFail("appointments.update", error);
  return ok(rowToAppt(data as Row));
});

export const apptDELETE = handler("appointments.remove", async (req, sb) => {
  const id = Number(qp(req, "id"));
  if (!Number.isFinite(id)) return fail(400, "ไม่ได้ระบุนัดหมายที่จะลบ");
  const { error } = await sb.from("appointments").delete().eq("id", id);
  if (error) return dbFail("appointments.remove", error);
  return ok({ ok: true });
});
