"use client";

// ─── HQ · ตั้งค่า — ศูนย์กลางการตั้งค่าระบบทั้งเครือ ────────────────────────────
// 7 แท็บ: บริษัท · ผู้ใช้งาน (ฝังหน้าจริง) · เส้นทางการขาย · ตัวแทนจำหน่าย · เป้าหมาย · แจ้งเตือน · ระบบ
// ใช้การ์ด/ปุ่ม/ฟอร์มมาตรฐานของระบบ · แก้ไขในหน้า · บันทึก/รีเซ็ตรายส่วนผ่าน BusCtx · เตือน unsaved · toast
// เก็บค่าจริงด้วย usePersistentState (พร้อมเปลี่ยนเป็น Supabase ภายหลัง)
import {
  useState, useEffect, useRef, useCallback, useMemo, useContext,
  type ReactNode,
} from "react";
import { usePersistentState } from "@/lib/usePersistentState";
import {
  HQ_POLICY_KEY, DEFAULT_HQ_POLICY,
  HQ_TARGETS_KEY, DEFAULT_HQ_TARGETS,
  HQ_LEAD_RULES_KEY, DEFAULT_HQ_LEAD_RULES,
  HQ_NOTIF_KEY, HQ_NOTIF_EVENTS, DEFAULT_HQ_NOTIFS, HQ_NOTIF_UPDATED_EVENT,
  type HQPolicy, type HQTargets, type HQLeadRules, type HQNotifChannels,
} from "@/lib/mock";
// แท็บ "บริษัท" / "ผู้ใช้งาน" ฝังหน้าจัดการจริงเต็ม
import { CompanyPanel } from "@/components/hq/CompanyPanel";
import { UsersPanel } from "@/components/hq/UsersPanel";
import { useAuditLogger } from "@/lib/useAudit";
import { SettingsBusCtx as BusCtx, type SectionApi } from "@/lib/settingsBus";
import {
  Building2, Users, Store, GitMerge, Target, Bell, SlidersHorizontal,
  Save, RotateCcw, Plus, Trash2, ChevronUp, ChevronDown, Check,
  Download, Upload, RefreshCw, Mail, Smartphone, MessageSquare, Lock, AlertCircle,
  ShieldCheck, Percent,
} from "lucide-react";

// ── tokens ──────────────────────────────────────────────────────────────────
const NAVY = "#003366";

// ── shared bus (report dirty/save/reset ของแท็บที่ active + toast) — ดู @/lib/settingsBus
function useReport(api: SectionApi) {
  const { report } = useContext(BusCtx);
  useEffect(() => { report(api); return () => report(null); }, [api, report]);
}
function useToast() { return useContext(BusCtx).toast; }

// draft = state ที่แก้ไขได้ + เทียบกับค่าที่บันทึกไว้ (dirty) → ใช้กับ Save/Reset กลาง
function usePersistentDraft<T>(key: string, initial: T) {
  const [saved, setSaved] = usePersistentState<T>(key, initial);
  const [draft, setDraft] = useState<T>(saved);
  const editedRef = useRef(false);
  const draftRef = useRef(draft); draftRef.current = draft;
  const savedRef = useRef(saved); savedRef.current = saved;
  // ระหว่าง hydration (โหลดค่าเก่า) sync draft ← saved จนกว่าผู้ใช้จะแก้เอง
  useEffect(() => { if (!editedRef.current) setDraft(saved); }, [saved]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const set = useCallback((updater: (prev: T) => T) => { editedRef.current = true; setDraft(updater); }, []);
  const save = useCallback(() => setSaved(draftRef.current), [setSaved]);
  const reset = useCallback(() => { editedRef.current = false; setDraft(savedRef.current); }, []);
  return { draft, set, dirty, save, reset };
}

// ── reusable UI ───────────────────────────────────────────────────────────────
function SectionCard({ icon, title, desc, children, action }: { icon?: ReactNode; title: string; desc?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {icon && <span style={{ color: "var(--primary)", display: "flex" }}>{icon}</span>}{title}
          </div>
          {desc && <div className="card-desc">{desc}</div>}
        </div>
        {action}
      </div>
      <div className="card-body">{children}</div>
    </div>
  );
}
function Row({ label, desc, children, error }: { label: string; desc?: string; children: ReactNode; error?: string }) {
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", padding: "13px 0", borderTop: "1px solid var(--border,#f1f5f9)" }}>
      <div style={{ flex: "1 1 220px", minWidth: 0 }}>
        <div style={{ fontSize: "0.84rem", fontWeight: 700, color: "var(--foreground,#2D2D2D)" }}>{label}</div>
        {desc && <div style={{ fontSize: "0.72rem", color: "var(--muted-foreground,#6b7280)", marginTop: 2 }}>{desc}</div>}
      </div>
      <div style={{ flex: "0 0 340px", maxWidth: "100%" }}>
        {children}
        {error && <div style={{ fontSize: "0.68rem", color: "#dc2626", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}><AlertCircle size={11} /> {error}</div>}
      </div>
    </div>
  );
}
function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button role="switch" aria-checked={on} onClick={onChange}
      style={{ width: 42, height: 24, borderRadius: 99, border: "none", cursor: "pointer", flexShrink: 0, background: on ? NAVY : "#d1d5db", position: "relative", transition: "background .15s" }}>
      <span style={{ position: "absolute", top: 3, left: on ? 21 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.25)", transition: "left .15s" }} />
    </button>
  );
}
function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div style={{ display: "inline-flex", background: "#f1f5f9", borderRadius: 10, padding: 3, gap: 2 }}>
      {options.map(o => (
        <button key={o.v} onClick={() => onChange(o.v)}
          style={{ border: "none", cursor: "pointer", borderRadius: 8, padding: "6px 14px", fontSize: "0.76rem", fontWeight: 700, fontFamily: "inherit",
            background: value === o.v ? "#fff" : "transparent", color: value === o.v ? NAVY : "#6b7280",
            boxShadow: value === o.v ? "0 1px 3px rgba(16,40,80,.14)" : "none" }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
// ═══════════════════════ TAB · กฎธุรกิจ (Business Rules) ═════════════════════
// ศูนย์กลางนโยบายธุรกิจของสำนักงานใหญ่ — บังคับใช้อัตโนมัติกับทุกตัวแทน (Constitution V2)
// ขอบเขต: Lead → Pipeline → Quotation → Won/Lost → Customer เท่านั้น (ไม่มี ERP/บัญชี/ก่อสร้าง)

// การ์ดนโยบายแบบอ่านอย่างเดียว — ระบุกติกาที่ระบบบังคับใช้อยู่แล้ว (ไม่ใช่ช่องตั้งค่า)
function PolicyList({ items, tone = "navy" }: { items: string[]; tone?: "navy" | "green" }) {
  const c = tone === "green" ? "#059669" : NAVY;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
      {items.map((t, i) => (
        <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 14px", background: "#f8fafc", border: "1px solid #eef1f5", borderRadius: 10 }}>
          <Check size={15} color={c} style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: "0.8rem", color: "#374151", lineHeight: 1.5 }}>{t}</span>
        </div>
      ))}
    </div>
  );
}

function BusinessRulesTab() {
  const pol  = usePersistentDraft<HQPolicy>(HQ_POLICY_KEY, DEFAULT_HQ_POLICY);
  const lead = usePersistentDraft<HQLeadRules>(HQ_LEAD_RULES_KEY, DEFAULT_HQ_LEAD_RULES);
  const tgt  = usePersistentDraft<HQTargets>(HQ_TARGETS_KEY, DEFAULT_HQ_TARGETS);
  const sys  = usePersistentDraft<SystemCfg>("hq_system", DEFAULT_SYSTEM);
  useReport(useMemo(() => ({
    dirty: pol.dirty || lead.dirty || tgt.dirty || sys.dirty,
    save:  () => { pol.save(); lead.save(); tgt.save(); sys.save(); },
    reset: () => { pol.reset(); lead.reset(); tgt.reset(); sys.reset(); },
  }), [pol.dirty, lead.dirty, tgt.dirty, sys.dirty, pol.save, lead.save, tgt.save, sys.save, pol.reset, lead.reset, tgt.reset, sys.reset]));

  const numInput = (value: number, onChange: (n: number) => void, unit: string, step?: number) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <input type="number" step={step} className="form-input" style={{ textAlign: "right", fontWeight: 700 }} value={value} onChange={e => onChange(Number(e.target.value))} />
      <span style={{ fontSize: "0.72rem", color: "#6b7280", whiteSpace: "nowrap" }}>{unit}</span>
    </div>
  );

  return (
    <>
      {/* 1 · นโยบายการขาย */}
      <SectionCard icon={<Target size={19} />} title="นโยบายการขาย (Sales Policy)" desc="กติกาการขายที่ใช้กับทุกตัวแทนในเครือ">
        <Row label="แจ้งเตือนติดตามลูกค้าเป้าหมาย" desc="ลีดไม่มีความเคลื่อนไหวเกินกี่วัน → แจ้งเตือนตัวแทน + ขึ้นป้าย “ต้องติดตามด่วน”">
          {numInput(lead.draft.followUpAlertDays, n => lead.set(p => ({ ...p, followUpAlertDays: n })), "วัน")}
        </Row>
        <Row label="เตือนอัตโนมัติ" desc="ระบบส่งการแจ้งเตือนติดตามให้ตัวแทนเองเมื่อครบกำหนด">
          <Toggle on={lead.draft.autoReminder} onChange={() => lead.set(p => ({ ...p, autoReminder: !p.autoReminder }))} />
        </Row>
        <Row label="อายุลูกค้าเป้าหมาย" desc="ลีดที่เงียบเกินกำหนดถือว่าหมดอายุ — ให้เก็บเข้าคลังหรือลบ">
          {numInput(lead.draft.leadExpirationDays, n => lead.set(p => ({ ...p, leadExpirationDays: n })), "วัน")}
        </Row>
        <Row label="เป้าอัตราปิดการขาย" desc="สัดส่วนลูกค้าเป้าหมายที่ต้องปิดการขายได้">
          {numInput(tgt.draft.conversionTarget, n => tgt.set(p => ({ ...p, conversionTarget: n })), "%")}
        </Row>
        <Row label="เป้ายอดขายรายปี (ทั้งเครือ)" desc="ใช้เทียบความคืบหน้า Target / Actual / % บนแดชบอร์ด">
          {numInput(tgt.draft.annualTarget, n => tgt.set(p => ({ ...p, annualTarget: n })), "บาท", 1_000_000)}
        </Row>
      </SectionCard>

      {/* 2 · นโยบายส่วนลด */}
      <SectionCard icon={<Percent size={19} />} title="นโยบายส่วนลด (Discount Policy)" desc="คุมส่วนลดสูงสุดที่ตัวแทนให้ลูกค้าได้">
        <Row label="เพดานส่วนลดสูงสุด" desc="ตัวแทนออกใบเสนอราคาที่ลดเกินค่านี้ไม่ได้ (ระบบบล็อกอัตโนมัติ)">
          {numInput(pol.draft.maxDiscount, n => pol.set(p => ({ ...p, maxDiscount: n })), "%")}
        </Row>
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "10px 14px", marginTop: 12, fontSize: "0.78rem", color: "#b45309" }}>
          <Lock size={14} style={{ flexShrink: 0 }} /> กฎธุรกิจ: ตัวแทนสร้างใบเสนอราคาที่ส่วนลดเกิน {pol.draft.maxDiscount}% ไม่ได้
        </div>
      </SectionCard>

      {/* 3 · นโยบายราคา (อ่านอย่างเดียว) */}
      <SectionCard icon={<Lock size={19} />} title="นโยบายราคา (Pricing Policy)" desc="โมเดลราคา — สำนักงานใหญ่ขายให้ตัวแทน ตัวแทนบวกกำไรเอง">
        <PolicyList items={[
          "ตัวแทนซื้อสินค้าจากสำนักงานใหญ่ด้วย “ราคากลาง” (Master Price)",
          "ตัวแทนแก้ราคากลางไม่ได้ — ดูได้อย่างเดียว",
          "ตัวแทนกำหนดราคาขายต่อให้ลูกค้าเองได้ (บวกกำไรเอง) ภายใต้เพดานส่วนลดข้างต้น",
        ]} />
      </SectionCard>

      {/* 4 · กฎลูกค้าเป้าหมาย (อ่านอย่างเดียว) */}
      <SectionCard icon={<GitMerge size={19} />} title="กฎลูกค้าเป้าหมาย (Lead Management Rules)" desc="กติกาที่ระบบบังคับใช้อัตโนมัติ">
        <PolicyList items={[
          `แจ้งเตือนเมื่อลูกค้าเป้าหมายไม่มีความเคลื่อนไหวเกิน ${lead.draft.followUpAlertDays} วัน`,
          lead.draft.autoReminder ? "เตือนอัตโนมัติ: เปิดใช้งาน" : "เตือนอัตโนมัติ: ปิดใช้งาน",
          "ปิดการขายสำเร็จ (Won) → สร้างลูกค้าอัตโนมัติ",
          "ลูกค้า 1 ราย สร้างดีลได้ไม่จำกัด",
          "ห้ามสร้างลูกค้าซ้ำ — ลูกค้าเดิมให้ใช้ “สร้างดีลใหม่”",
        ]} />
      </SectionCard>

      {/* 5 · กฎใบเสนอราคา */}
      <SectionCard icon={<SlidersHorizontal size={19} />} title="กฎใบเสนอราคา (Quotation Rules)" desc="มาตรฐานเอกสารที่ใช้ทั้งเครือ">
        <Row label="อายุใบเสนอราคาเริ่มต้น" desc="กี่วันก่อนใบเสนอราคาหมดอายุ">
          {numInput(pol.draft.quoteValidityDays, n => pol.set(p => ({ ...p, quoteValidityDays: n })), "วัน")}
        </Row>
        <Row label="ภาษีมูลค่าเพิ่ม (VAT)" desc="อัตรามาตรฐานบนใบเสนอราคาทุกตัวแทน">
          {numInput(pol.draft.vat, n => pol.set(p => ({ ...p, vat: n })), "%")}
        </Row>
        <Row label="คำนำหน้าเลขที่ + เลขถัดไป" desc="รูปแบบเลขที่ใบเสนอราคา (ใช้ทั้งเครือ)">
          <div style={{ display: "flex", gap: 8 }}>
            <input className="form-input" style={{ flex: 1 }} value={sys.draft.runningPrefix} onChange={e => sys.set(p => ({ ...p, runningPrefix: e.target.value }))} />
            <input type="number" className="form-input" style={{ width: 100, textAlign: "right", fontWeight: 700 }} value={sys.draft.runningNext} onChange={e => sys.set(p => ({ ...p, runningNext: Number(e.target.value) }))} />
          </div>
        </Row>
        <PolicyList items={["แบบฟอร์ม PDF มาตรฐานเดียวทั้งเครือ — ใบเสนอราคาของตัวแทนใช้ “ข้อมูลบริษัทของตัวแทน” (ชื่อ / ที่อยู่ / เลขผู้เสียภาษี) เสมอ"]} />
      </SectionCard>

      {/* 6 · นโยบายตัวแทน (อ่านอย่างเดียว) */}
      <SectionCard icon={<Store size={19} />} title="นโยบายตัวแทน (Dealer Policy)" desc="สิทธิ์และข้อจำกัดของตัวแทนในเครือ">
        <PolicyList items={[
          "ทั้งระบบใช้แบรนด์ Benjamin — ตัวแทนเปลี่ยนโลโก้/แบรนด์/ธีมเองไม่ได้",
          "ตัวแทนแก้แม่แบบและราคากลางของสำนักงานใหญ่ไม่ได้",
          "บัญชีตัวแทนสร้างโดยสำนักงานใหญ่เท่านั้น",
          "ตัวแทนเปลี่ยนอีเมลเข้าสู่ระบบและรหัสผ่านเองไม่ได้",
        ]} />
      </SectionCard>

      {/* 7 · ผู้รับผิดชอบ (อ่านอย่างเดียว) */}
      <SectionCard icon={<Users size={19} />} title="นโยบายผู้รับผิดชอบ (Responsible Person)" desc="ข้อมูลประกอบ — ไม่ใช่ผู้ใช้ระบบ">
        <PolicyList items={[
          "ผู้รับผิดชอบ (พนักงานขาย) ไม่ใช่ผู้ใช้ระบบ — เข้าสู่ระบบไม่ได้",
          "ใช้กำกับลูกค้าเป้าหมาย / ดีล และแสดงในรายงานกับแดชบอร์ดเท่านั้น",
        ]} />
      </SectionCard>

      {/* 8 · นโยบายข้อมูล (อ่านอย่างเดียว) */}
      <SectionCard icon={<Lock size={19} />} title="นโยบายข้อมูล (Data Policy)" desc="สำนักงานใหญ่เป็นแหล่งข้อมูลเดียวของทั้งเครือ">
        <PolicyList items={[
          "ฐานข้อมูลรวมศูนย์ — สำนักงานใหญ่เห็นข้อมูลของทุกตัวแทน",
          "ตัวแทนเห็นเฉพาะข้อมูลของตัวเองเท่านั้น",
          "เส้นทาง: ลูกค้าเป้าหมาย → ปิดการขาย → ลูกค้า",
          "ลูกค้า 1 ราย มีได้หลายดีล · แต่ละดีลมีได้หลายใบเสนอราคา",
        ]} />
      </SectionCard>

      {/* 9 · นโยบายรายงาน (อ่านอย่างเดียว) */}
      <SectionCard icon={<Download size={19} />} title="นโยบายรายงาน (Report Policy)" desc="มาตรฐานรายงานและการส่งออก">
        <PolicyList items={[
          "แดชบอร์ดแสดง: ภาพรวมผลงาน · ผลงานตัวแทน · เป้าเทียบผลจริง · ใบเสนอราคาเทียบยอดขาย · อัตราปิดการขาย",
          "รายงานทุกชุดส่งออกได้ทั้ง CSV และ PDF",
        ]} tone="green" />
      </SectionCard>
    </>
  );
}

// ═══════════════════════ TAB · ตัวแทนจำหน่าย ═════════════════════════════════
// (แท็บ "บริษัท" และ "ผู้ใช้งาน" ฝังหน้าจริง <HQCompanyPage/> / <HQUsersPage/> — ดู TABS ด้านล่าง)
type DealerDefaults = { defaultQuota: number; defaultColor: string; allowResetPwd: boolean; allowSelfCreateCustomer: boolean };
const DEFAULT_DEALER_DEFAULTS: DealerDefaults = { defaultQuota: 30_000_000, defaultColor: "#003366", allowResetPwd: true, allowSelfCreateCustomer: false };
const DEALER_COLORS = ["#003366", "#0891b2", "#059669", "#d97706", "#7c3aed", "#dc2626"];
function DealersTab() {
  const dd = usePersistentDraft<DealerDefaults>("hq_dealer_settings", DEFAULT_DEALER_DEFAULTS);
  const draft = dd.draft, set = dd.set;
  // นโยบายราคา/ส่วนลด/VAT/อายุใบ ย้ายไปแท็บ "กฎธุรกิจ" (Business Rules) — ไม่ซ้ำซ้อน
  useReport(useMemo(() => ({ dirty: dd.dirty, save: dd.save, reset: dd.reset }), [dd.dirty, dd.save, dd.reset]));
  // รายชื่อ/สถานะ/โควตาตัวแทน จัดการที่หน้า /hq/dealers ที่เดียว (ไม่ฝังซ้ำในหน้าตั้งค่า)
  return (
    <>
      <SectionCard icon={<Store size={19} />} title="ค่ามาตรฐานตัวแทนจำหน่าย" desc="ค่าตั้งต้นเวลาสร้างตัวแทนใหม่ + สิทธิ์รวม">
        <Row label="เป้ายอดขายเริ่มต้น (ต่อปี)" desc="เป้าตั้งต้นของตัวแทนใหม่">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="number" step={1_000_000} className="form-input" value={draft.defaultQuota} onChange={e => set(p => ({ ...p, defaultQuota: Number(e.target.value) }))} style={{ textAlign: "right", fontWeight: 700 }} />
            <span style={{ fontSize: "0.72rem", color: "#6b7280", whiteSpace: "nowrap" }}>บาท</span>
          </div>
        </Row>
        <Row label="สีประจำตัวแทนเริ่มต้น">
          <div style={{ display: "flex", gap: 7 }}>
            {DEALER_COLORS.map(c => (
              <button key={c} onClick={() => set(p => ({ ...p, defaultColor: c }))} style={{ width: 26, height: 26, borderRadius: 8, background: c, border: "none", cursor: "pointer", outline: draft.defaultColor === c ? `2.5px solid ${c}` : "none", outlineOffset: 2 }} />
            ))}
          </div>
        </Row>
        <Row label="ให้ตัวแทนรีเซ็ตรหัสผ่านเองได้" desc="ปิดไว้ให้สำนักงานใหญ่คุมการเข้าระบบ"><Toggle on={draft.allowResetPwd} onChange={() => set(p => ({ ...p, allowResetPwd: !p.allowResetPwd }))} /></Row>
        <Row label="ให้ตัวแทนสร้างลูกค้าเองได้" desc="ปิดไว้ — ลูกค้าเกิดจากการปิดการขายเท่านั้น"><Toggle on={draft.allowSelfCreateCustomer} onChange={() => set(p => ({ ...p, allowSelfCreateCustomer: !p.allowSelfCreateCustomer }))} /></Row>
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#f5f7fa", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 14px", marginTop: 12, fontSize: "0.76rem", color: "#6b7280" }}>
          <Lock size={14} color={NAVY} style={{ flexShrink: 0 }} /> เพดานส่วนลด · ภาษี · อายุใบเสนอราคา ตั้งที่แท็บ “กฎธุรกิจ” (Business Rules)
        </div>
      </SectionCard>
    </>
  );
}

// ═══════════════════════ TAB 4 · เส้นทางการขาย ════════════════════════════════
type Stage = { id: number; label: string; color: string; isDefault: boolean; terminal?: "won" | "lost" };
type Journey = { stages: Stage[]; won: string[]; lost: string[]; checklist: string[] };
const STAGE_COLORS = ["#6b7280", "#d97706", "#003366", "#4338ca", "#059669", "#0ea5e9", "#0891b2", "#dc2626"];
const DEFAULT_JOURNEY: Journey = {
  stages: [
    { id: 1, label: "ติดต่อแล้ว", color: "#475569", isDefault: true },
    { id: 2, label: "รวบรวมความต้องการ", color: "#003366", isDefault: false },
    { id: 3, label: "เสนอราคา", color: "#4338ca", isDefault: false },
    { id: 4, label: "ติดตามผล", color: "#d97706", isDefault: false },
    { id: 5, label: "เจรจา", color: "#b45309", isDefault: false },
    { id: 6, label: "ปิดการขาย", color: "#059669", isDefault: false, terminal: "won" },
    { id: 7, label: "ปิดการขายไม่สำเร็จ", color: "#dc2626", isDefault: false, terminal: "lost" },
  ],
  won: ["ราคาดีที่สุดในตลาด", "คุณภาพสินค้าสูง", "บริการดี / ไว้วางใจ"],
  lost: ["ราคาสูงเกินงบประมาณ", "คู่แข่งให้ข้อเสนอดีกว่า", "งบประมาณไม่พร้อม", "ลูกค้าไม่ตอบสนอง"],
  checklist: ["โทรแนะนำบริษัท", "นัดสำรวจ/เก็บความต้องการ", "จัดทำใบเสนอราคา", "ติดตามหลังส่งใบเสนอราคา"],
};
function JourneyTab() {
  const { draft, set, dirty, save, reset } = usePersistentDraft<Journey>("hq_sales_journey", DEFAULT_JOURNEY);
  useReport(useMemo(() => ({ dirty, save, reset }), [dirty, save, reset]));
  const [newWon, setNewWon] = useState(""); const [newLost, setNewLost] = useState(""); const [newChk, setNewChk] = useState("");
  const active = draft.stages.filter(s => !s.terminal); const terminal = draft.stages.filter(s => s.terminal);
  const move = (id: number, dir: -1 | 1) => set(p => { const arr = p.stages.filter(s => !s.terminal); const i = arr.findIndex(s => s.id === id); const j = i + dir; if (j < 0 || j >= arr.length) return p; [arr[i], arr[j]] = [arr[j], arr[i]]; return { ...p, stages: [...arr, ...p.stages.filter(s => s.terminal)] }; });
  const addStage = () => set(p => { const id = Math.max(0, ...p.stages.map(s => s.id)) + 1; return { ...p, stages: [...p.stages.filter(s => !s.terminal), { id, label: "ขั้นใหม่", color: "#6b7280", isDefault: false }, ...p.stages.filter(s => s.terminal)] }; });
  return (
    <>
      <SectionCard icon={<GitMerge size={19} />} title="ขั้นตอนการขาย" desc="จัดลำดับ/สี/ขั้นเริ่มต้น — ใช้เหมือนกันทุกตัวแทน"
        action={<button className="btn btn-secondary btn-sm" onClick={addStage}><Plus size={14} /> เพิ่มขั้น</button>}>
        <div style={{ border: "1px solid var(--border,#e5e7eb)", borderRadius: 12, overflow: "hidden", marginTop: 6 }}>
          {active.map((s, idx) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: idx < active.length - 1 ? "1px solid #f1f5f9" : "none", flexWrap: "wrap" }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <button className="btn btn-ghost btn-sm" style={{ width: 22, height: 20, padding: 0, opacity: idx === 0 ? .25 : 1 }} onClick={() => move(s.id, -1)}><ChevronUp size={12} /></button>
                <button className="btn btn-ghost btn-sm" style={{ width: 22, height: 20, padding: 0, opacity: idx === active.length - 1 ? .25 : 1 }} onClick={() => move(s.id, 1)}><ChevronDown size={12} /></button>
              </div>
              <span style={{ width: 24, height: 24, borderRadius: "50%", background: s.color + "20", color: s.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.65rem", fontWeight: 800, flexShrink: 0 }}>{idx + 1}</span>
              <div style={{ display: "flex", gap: 3 }}>
                {STAGE_COLORS.map(c => <button key={c} onClick={() => set(p => ({ ...p, stages: p.stages.map(x => x.id === s.id ? { ...x, color: c } : x) }))} style={{ width: 12, height: 12, borderRadius: "50%", background: c, border: "none", cursor: "pointer", outline: s.color === c ? `2px solid ${c}` : "none", outlineOffset: 1 }} />)}
              </div>
              <input value={s.label} onChange={e => set(p => ({ ...p, stages: p.stages.map(x => x.id === s.id ? { ...x, label: e.target.value } : x) }))} style={{ flex: "1 1 120px", border: "1px solid transparent", background: "transparent", borderRadius: 7, padding: "5px 7px", fontSize: "0.84rem", fontWeight: 600, fontFamily: "inherit" }} />
              <button onClick={() => set(p => ({ ...p, stages: p.stages.map(x => ({ ...x, isDefault: x.id === s.id && !x.terminal })) }))} className="badge"
                style={{ cursor: "pointer", border: `1px solid ${s.isDefault ? NAVY : "#e2e8f0"}`, background: s.isDefault ? "#f0f4fa" : "transparent", color: s.isDefault ? NAVY : "#9ca3af", fontFamily: "inherit", fontWeight: 700 }}>
                {s.isDefault ? "✓ ค่าเริ่มต้น" : "ตั้งค่าเริ่มต้น"}
              </button>
              {active.length > 1 && <button className="btn btn-danger btn-sm" style={{ width: 28, padding: 0, justifyContent: "center" }} onClick={() => set(p => ({ ...p, stages: p.stages.filter(x => x.id !== s.id) }))}><Trash2 size={12} /></button>}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          {terminal.map(s => (
            <div key={s.id} style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 10, background: s.terminal === "won" ? "#f0fdf4" : "#fff5f5", border: `1px solid ${s.terminal === "won" ? "#bbf7d0" : "#fecaca"}` }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.color }} />
              <span style={{ flex: 1, fontSize: "0.8rem", fontWeight: 700, color: s.terminal === "won" ? "#059669" : "#dc2626" }}>{s.label}</span>
              <span className="badge" style={{ background: s.terminal === "won" ? "#dcfce7" : "#fee2e2", color: s.terminal === "won" ? "#059669" : "#dc2626", border: "none" }}>{s.terminal === "won" ? "ปิดการขายสำเร็จ" : "ปิดการขายไม่สำเร็จ"}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard icon={<Check size={19} />} title="เหตุผลปิดการขาย & สิ่งที่ต้องทำเริ่มต้น" desc="มาตรฐานเดียวกันทุกตัวแทน">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 20, marginTop: 6 }}>
          {([["won", "ปิดการขายสำเร็จ", "#059669", newWon, setNewWon] as const, ["lost", "ปิดการขายไม่สำเร็จ", "#dc2626", newLost, setNewLost] as const]).map(([key, label, accent, val, setVal]) => (
            <div key={key}>
              <div style={{ fontSize: "0.72rem", fontWeight: 800, color: accent, marginBottom: 8 }}>เหตุผล{label}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {draft[key].map((r, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: accent + "0d", border: `1px solid ${accent}33`, borderRadius: 8, padding: "7px 10px" }}>
                    <span style={{ flex: 1, fontSize: "0.78rem" }}>{r}</span>
                    <button onClick={() => set(p => ({ ...p, [key]: p[key].filter((_, x) => x !== i) }))} style={{ background: "none", border: "none", cursor: "pointer", color: accent, display: "flex", padding: 2 }}><Trash2 size={12} /></button>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <input className="form-input" value={val} placeholder="เพิ่มเหตุผล…" onChange={e => setVal(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && val.trim()) { set(p => ({ ...p, [key]: [...p[key], val.trim()] })); setVal(""); } }} />
                <button className="btn btn-primary btn-sm" style={{ flexShrink: 0 }} onClick={() => { if (val.trim()) { set(p => ({ ...p, [key]: [...p[key], val.trim()] })); setVal(""); } }}><Plus size={14} /></button>
              </div>
            </div>
          ))}
          <div>
            <div style={{ fontSize: "0.72rem", fontWeight: 800, color: NAVY, marginBottom: 8 }}>สิ่งที่ต้องทำเริ่มต้น</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {draft.checklist.map((c, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: "#f7f9fc", border: "1px solid #e5e7eb", borderRadius: 8, padding: "7px 10px" }}>
                  <Check size={13} color={NAVY} /><span style={{ flex: 1, fontSize: "0.78rem" }}>{c}</span>
                  <button onClick={() => set(p => ({ ...p, checklist: p.checklist.filter((_, x) => x !== i) }))} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", display: "flex", padding: 2 }}><Trash2 size={12} /></button>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <input className="form-input" value={newChk} placeholder="เพิ่มรายการ…" onChange={e => setNewChk(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && newChk.trim()) { set(p => ({ ...p, checklist: [...p.checklist, newChk.trim()] })); setNewChk(""); } }} />
              <button className="btn btn-primary btn-sm" style={{ flexShrink: 0 }} onClick={() => { if (newChk.trim()) { set(p => ({ ...p, checklist: [...p.checklist, newChk.trim()] })); setNewChk(""); } }}><Plus size={14} /></button>
            </div>
          </div>
        </div>
      </SectionCard>
    </>
  );
}

// ═══════════════════════ TAB · เป้าหมายยอดขาย ════════════════════════════════
// ชนิด/ค่าเริ่มต้น = แหล่งเดียวใน mock (HQTargets) — แดชบอร์ด/หน้าตัวแทนดึงผ่าน loadHQTargets()
function TargetsTab() {
  const { draft, set, dirty, save, reset } = usePersistentDraft<HQTargets>(HQ_TARGETS_KEY, DEFAULT_HQ_TARGETS);
  useReport(useMemo(() => ({ dirty, save, reset }), [dirty, save, reset]));
  const num = (k: keyof HQTargets, v: number) => set(p => ({ ...p, [k]: v }));
  const periodLabel = draft.period === "month" ? "รายเดือน" : draft.period === "quarter" ? "รายไตรมาส" : "รายปี";
  return (
    <SectionCard icon={<Target size={19} />} title="เป้าหมายยอดขาย" desc="ตั้งเป้าทั้งเครือ — ใช้เทียบความคืบหน้าบนแดชบอร์ด"
      action={<Segmented value={draft.period} onChange={v => set(p => ({ ...p, period: v }))} options={[{ v: "month", label: "รายเดือน" }, { v: "quarter", label: "ไตรมาส" }, { v: "year", label: "รายปี" }]} />}>
      <Row label={`ยอดขายรวมทั้งประเทศ (${periodLabel})`} desc="ยอดปิดการขายรวมทุกตัวแทน">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><input type="number" step={1_000_000} className="form-input" style={{ textAlign: "right", fontWeight: 700 }} value={draft.annualTarget} onChange={e => num("annualTarget", Number(e.target.value))} /><span style={{ fontSize: "0.72rem", color: "#6b7280" }}>บาท</span></div>
      </Row>
      <Row label="เป้าปิดการขายจากลูกค้าเป้าหมาย" desc="สัดส่วนลูกค้าเป้าหมายที่ปิดการขายสำเร็จ">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><input type="number" className="form-input" style={{ textAlign: "right", fontWeight: 700 }} value={draft.conversionTarget} onChange={e => num("conversionTarget", Number(e.target.value))} /><span style={{ fontSize: "0.72rem", color: "#6b7280" }}>%</span></div>
      </Row>
      <Row label="เป้าออกใบเสนอราคาจากลูกค้าเป้าหมาย" desc="สัดส่วนลูกค้าเป้าหมายที่ออกใบเสนอราคา">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><input type="number" className="form-input" style={{ textAlign: "right", fontWeight: 700 }} value={draft.quotationTarget} onChange={e => num("quotationTarget", Number(e.target.value))} /><span style={{ fontSize: "0.72rem", color: "#6b7280" }}>%</span></div>
      </Row>
      <Row label="เป้ามูลค่าเฉลี่ยต่อการปิดการขาย" desc="ปิดได้เฉลี่ยครั้งละเท่าไร">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><input type="number" step={100_000} className="form-input" style={{ textAlign: "right", fontWeight: 700 }} value={draft.avgDealSize} onChange={e => num("avgDealSize", Number(e.target.value))} /><span style={{ fontSize: "0.72rem", color: "#6b7280" }}>บาท</span></div>
      </Row>
      <Row label="เป้าอัตราปิดการขายเฉลี่ย" desc="อย่างน้อยตัวแทนควรทำได้เท่านี้">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><input type="number" className="form-input" style={{ textAlign: "right", fontWeight: 700 }} value={draft.winRateTarget} onChange={e => num("winRateTarget", Number(e.target.value))} /><span style={{ fontSize: "0.72rem", color: "#6b7280" }}>%</span></div>
      </Row>
      <Row label="ติดตามตรงเวลา" desc="งานติดตามที่ทำทันเวลา">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><input type="number" className="form-input" style={{ textAlign: "right", fontWeight: 700 }} value={draft.onTimeTarget} onChange={e => num("onTimeTarget", Number(e.target.value))} /><span style={{ fontSize: "0.72rem", color: "#6b7280" }}>%</span></div>
      </Row>
    </SectionCard>
  );
}

// ═══════════════════════ TAB 7 · การแจ้งเตือน ═════════════════════════════════
// event = เรื่องที่ "HQ ควรรู้" (จาก Audit Log) ไม่ใช่งานขายของตัวแทน · toggle "ในระบบ" กรองกระดิ่ง HQ จริง
type Notifs = Record<string, HQNotifChannels>;
function NotificationsTab() {
  const { draft, set, dirty, save, reset } = usePersistentDraft<Notifs>(HQ_NOTIF_KEY, DEFAULT_HQ_NOTIFS);
  // บันทึกแล้วยิง event → กระดิ่ง HQ อัปเดตทันที (Topbar ฟัง HQ_NOTIF_UPDATED_EVENT)
  const saveAndBroadcast = useCallback(() => { save(); window.dispatchEvent(new Event(HQ_NOTIF_UPDATED_EVENT)); }, [save]);
  useReport(useMemo(() => ({ dirty, save: saveAndBroadcast, reset }), [dirty, saveAndBroadcast, reset]));
  const ch: { k: keyof HQNotifChannels; label: string; icon: ReactNode }[] = [
    { k: "email", label: "อีเมล", icon: <Mail size={13} /> },
    { k: "inapp", label: "ในระบบ", icon: <Smartphone size={13} /> },
    { k: "line", label: "ไลน์", icon: <MessageSquare size={13} /> },
  ];
  return (
    <SectionCard icon={<Bell size={19} />} title="การแจ้งเตือน" desc="เลือกเรื่องที่ HQ อยากรู้ (จากบันทึกการใช้งาน) · ปิด “ในระบบ” เพื่อซ่อนจากกระดิ่ง">
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 40, padding: "0 4px 8px", fontSize: "0.68rem", fontWeight: 700, color: "#9ca3af" }}>
        {ch.map(c => <span key={c.k} style={{ width: 66, textAlign: "center" }}>{c.label}</span>)}
      </div>
      <div style={{ border: "1px solid var(--border,#e5e7eb)", borderRadius: 12, overflow: "hidden" }}>
        {HQ_NOTIF_EVENTS.map((ev, i) => (
          <div key={ev.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderTop: i ? "1px solid #f1f5f9" : "none" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "0.84rem", fontWeight: 700 }}>{ev.label}</div>
              <div style={{ fontSize: "0.72rem", color: "#6b7280", marginTop: 1 }}>{ev.desc}</div>
            </div>
            {ch.map(c => (
              <div key={c.k} style={{ width: 66, display: "flex", justifyContent: "center" }}>
                <Toggle on={draft[ev.key]?.[c.k] ?? false} onChange={() => set(p => ({ ...p, [ev.key]: { ...p[ev.key], [c.k]: !p[ev.key]?.[c.k] } }))} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

// ═══════════════════════ TAB 8 · ระบบ ═════════════════════════════════════════
// ภาษา/เขตเวลา/รูปแบบวันที่ = pref ส่วนตัว/แสดงผล (ไม่ใช่ของ HQ) + dead → เอาออก · เหลือของที่ HQ คุมจริง
type SystemCfg = { sessionTimeout: number; runningPrefix: string; runningNext: number };
const DEFAULT_SYSTEM: SystemCfg = { sessionTimeout: 30, runningPrefix: "Q-2026-", runningNext: 1101 };
// คีย์จริงที่ใช้ทั้งระบบ (รวมของหน้าบริษัท/ผู้ใช้ที่ฝัง + ตัวแทน) → backup/restore ครบจริง
const SETTINGS_KEYS = [
  "hq_company_profile", "hq_company_logo", "hq_company_wordmark", "hq_users_v4",
  "hq_dealer_settings", "hq_dealers_v2", "hq_dealers_v3", "hq_sales_journey", "hq_targets",
  "hq_notifications_v2", "hq_system", "hq_sales_policy",
];
function SystemTab() {
  const { draft, set, dirty, save, reset } = usePersistentDraft<SystemCfg>("hq_system", DEFAULT_SYSTEM);
  useReport(useMemo(() => ({ dirty, save, reset }), [dirty, save, reset]));
  const toast = useToast();
  function exportAll() {
    const out: Record<string, unknown> = {};
    SETTINGS_KEYS.forEach(k => { try { const s = localStorage.getItem(k); if (s) out[k] = JSON.parse(s); } catch {} });
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "benjamin-settings-backup.json"; a.click(); URL.revokeObjectURL(a.href);
    toast("ส่งออกการตั้งค่าแล้ว");
  }
  function importAll(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = ""; if (!file) return;
    const r = new FileReader();
    r.onload = () => { try { const obj = JSON.parse(String(r.result)); Object.entries(obj).forEach(([k, v]) => { if (SETTINGS_KEYS.includes(k)) localStorage.setItem(k, JSON.stringify(v)); }); toast("นำเข้าสำเร็จ — กำลังโหลดใหม่"); setTimeout(() => location.reload(), 900); } catch { toast("ไฟล์ไม่ถูกต้อง"); } };
    r.readAsText(file);
  }
  function restoreDefaults() {
    if (!confirm("คืนค่าเริ่มต้นทั้งหมด? การตั้งค่าปัจจุบันจะถูกลบ")) return;
    SETTINGS_KEYS.forEach(k => localStorage.removeItem(k)); location.reload();
  }
  return (
    <>
      {/* เลขที่ใบเสนอราคา ย้ายไปแท็บ "กฎธุรกิจ" (Quotation Rules) — ไม่ซ้ำซ้อน */}
      <SectionCard icon={<SlidersHorizontal size={19} />} title="ระบบ" desc="ตั้งค่าพื้นฐานของระบบ">
        <Row label="ออกจากระบบเองเมื่อไม่ใช้งาน" desc="ออกจากระบบให้เองเมื่อไม่ได้ใช้งานนานเกินกำหนด">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><input type="number" className="form-input" style={{ textAlign: "right", fontWeight: 700 }} value={draft.sessionTimeout} onChange={e => set(p => ({ ...p, sessionTimeout: Number(e.target.value) }))} /><span style={{ fontSize: "0.72rem", color: "#6b7280" }}>นาที</span></div>
        </Row>
      </SectionCard>

      <SectionCard icon={<RefreshCw size={19} />} title="สำรองและกู้คืนข้อมูล" desc="ส่งออก/นำเข้าการตั้งค่าทั้งหมด">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 6 }}>
          <button className="btn btn-secondary btn-md" onClick={exportAll}><Download size={14} /> ส่งออก (สำรองข้อมูล)</button>
          <label className="btn btn-secondary btn-md" style={{ cursor: "pointer" }}><Upload size={14} /> นำเข้า (กู้คืน)<input type="file" accept="application/json" style={{ display: "none" }} onChange={importAll} /></label>
          <button className="btn btn-md" style={{ background: "#fff", color: "#dc2626", border: "1px solid #fecaca" }} onClick={restoreDefaults}><RotateCcw size={14} /> คืนค่าเริ่มต้นทั้งหมด</button>
        </div>
      </SectionCard>
    </>
  );
}

// ═══════════════════════ ROOT ═════════════════════════════════════════════════
type TabKey = "rules" | "company" | "users" | "journey" | "dealers" | "targets" | "notifications" | "system";
const TABS: { key: TabKey; label: string; icon: ReactNode; render: () => ReactNode }[] = [
  { key: "rules", label: "กฎธุรกิจ", icon: <ShieldCheck size={15} />, render: () => <BusinessRulesTab /> },
  { key: "company", label: "บริษัท", icon: <Building2 size={15} />, render: () => <CompanyPanel embedded /> },
  { key: "users", label: "ผู้ใช้งานและสิทธิ์", icon: <Users size={15} />, render: () => <UsersPanel embedded /> },
  { key: "journey", label: "เส้นทางการขาย", icon: <GitMerge size={15} />, render: () => <JourneyTab /> },
  { key: "dealers", label: "ตัวแทนจำหน่าย", icon: <Store size={15} />, render: () => <DealersTab /> },
  { key: "targets", label: "เป้าหมายยอดขาย", icon: <Target size={15} />, render: () => <TargetsTab /> },
  { key: "notifications", label: "การแจ้งเตือน", icon: <Bell size={15} />, render: () => <NotificationsTab /> },
  { key: "system", label: "ระบบ", icon: <SlidersHorizontal size={15} />, render: () => <SystemTab /> },
];

export default function HQSettingsPage() {
  const [tab, setTab] = useState<TabKey>("company");
  const [api, setApi] = useState<SectionApi | null>(null);
  const [toast, setToastMsg] = useState<string | null>(null);
  const report = useCallback((a: SectionApi | null) => setApi(a), []);
  const showToast = useCallback((m: string) => { setToastMsg(m); setTimeout(() => setToastMsg(null), 2400); }, []);
  const logAudit = useAuditLogger();
  const dirty = !!api?.dirty;

  function switchTab(next: TabKey) {
    if (next === tab) return;
    if (dirty && !confirm("ส่วนนี้ยังไม่บันทึก · ทิ้งที่แก้ไว้ไหม?")) return;
    setTab(next);
  }
  const active = TABS.find(t => t.key === tab)!;
  function saveAll() { if (dirty && api) { api.save(); logAudit("บันทึกการตั้งค่า", active.label); showToast("บันทึกการตั้งค่าแล้ว"); } }
  function resetAll() { if (dirty && api) api.reset(); }

  return (
    <BusCtx.Provider value={{ report, toast: showToast }}>
      <div className="erp">
        {/* Header */}
        <div className="page-head" style={{ alignItems: "flex-start" }}>
          <div>
            <p>ตั้งค่าระบบของสำนักงานใหญ่ · สิ่งที่แก้จะมีผลกับตัวแทนตามสิทธิ์</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {dirty && <span style={{ fontSize: "0.72rem", color: "#d97706", fontWeight: 600 }}>ยังไม่บันทึก</span>}
            <button className="btn btn-secondary btn-md" onClick={resetAll} disabled={!dirty} style={!dirty ? { opacity: .5, cursor: "not-allowed" } : undefined}><RotateCcw size={14} /> รีเซ็ต</button>
            <button className="btn btn-primary btn-md" onClick={saveAll} disabled={!dirty} style={!dirty ? { opacity: .5, cursor: "not-allowed" } : undefined}><Save size={14} /> บันทึก</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="tab-bar" style={{ overflowX: "auto" }}>
            {TABS.map(t => (
              <button key={t.key} onClick={() => switchTab(t.key)} className={`tab-item${tab === t.key ? " active" : ""}`}
                style={{ display: "flex", alignItems: "center", gap: 7, fontSize: "0.84rem", padding: "12px 16px", whiteSpace: "nowrap" }}>
                {t.icon}{t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Active section — ห่อด้วย section-stack ให้การ์ดทุกใบห่างเท่ากัน (18px = ระยะเดียวกับใต้แถบแท็บ) */}
        <div className="section-stack">
          {active.render()}
        </div>

        {/* Toast */}
        {toast && (
          <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999, background: "#111827", color: "#fff", padding: "12px 18px", borderRadius: 12, fontSize: "0.82rem", fontWeight: 600, boxShadow: "0 12px 32px rgba(0,0,0,.28)", display: "flex", alignItems: "center", gap: 9 }}>
            <Check size={15} color="#7ee2b8" /> {toast}
          </div>
        )}
      </div>
    </BusCtx.Provider>
  );
}
