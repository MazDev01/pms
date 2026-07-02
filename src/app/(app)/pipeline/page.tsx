"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { pipelineStages, LOST_REASONS, quotationStatusLabel, quotationStatusColor, type PipelineDealMock, type DealActivity } from "@/lib/mock";
import { useSales } from "@/context/SalesContext";
import { useFilters, FilterProvider } from "@/context/FilterContext";
import { FilterBar } from "@/components/filters/FilterBar";
import {
  Search, LayoutList, Columns3, ChevronRight,
  CheckCircle2, Circle, Paperclip, X, Plus,
  TrendingUp, DollarSign, Target, Trophy,
  ArrowRight, FileText, Clock, StickyNote,
  Upload, Edit2, Trash2, ScrollText, FilePlus2,
} from "lucide-react";

// ── CI Tokens ─────────────────────────────────────────────────────
const PRIMARY = "#003366";
const STEEL   = "#2D2D2D";
const BORDER  = "#e5e7eb";

// ── Helpers ────────────────────────────────────────────────────────
function calcProgress(deal: PipelineDealMock): number {
  if (!deal.tasks.length) return deal.outcome === "won" ? 100 : 0;
  const done = deal.tasks.filter(t => t.done).length;
  return Math.round((done / deal.tasks.length) * 100);
}
function fmtMoney(n: number) {
  if (n >= 1e6) return `฿${(n / 1e6).toFixed(2).replace(/\.?0+$/, "")}M`;
  if (n >= 1e3) return `฿${(n / 1e3).toFixed(0)}K`;
  return `฿${n.toLocaleString()}`;
}
function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("th-TH", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

// ── Days-in-stage helper (deterministic, ตรึงวัน "ปัจจุบัน" ของ mock) ──
const MOCK_TODAY = "2026-06-30";
// parse "YYYY-MM-DD" → epoch-day (จำนวนวัน) แบบ UTC เพื่อไม่ต้องพึ่ง timezone/Date.now
function parseYmdToDays(ymd: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd?.trim() ?? "");
  if (!m) return null;
  const [, y, mo, d] = m;
  return Math.floor(Date.UTC(+y, +mo - 1, +d) / 86400000);
}
// จำนวนวันที่ดีล "ค้าง" นับจาก createdAt ถึงวันปัจจุบันของ mock (ไม่ติดลบ)
function daysInStage(createdAt: string): number | null {
  const from = parseYmdToDays(createdAt);
  const to   = parseYmdToDays(MOCK_TODAY);
  if (from === null || to === null) return null;
  return Math.max(0, to - from);
}
// สีของ chip: ≥30 วัน = แดง (stale), ≥14 = เหลือง (เริ่มค้าง), น้อยกว่านั้น = muted
function daysChipStyle(days: number): { bg: string; text: string; border: string } {
  if (days >= 30) return { bg: "#fee2e2", text: "#dc2626", border: "#fca5a5" };
  if (days >= 14) return { bg: "#fef3cd", text: "#d97706", border: "#fcd34d" };
  return { bg: "#f0f0f5", text: "#6b7280", border: BORDER };
}
function stageColor(stageId: number): { bg: string; text: string } {
  const map: Record<number, { bg: string; text: string }> = {
    1: { bg: "#f0f0f5",  text: "#6b7280" },
    2: { bg: "#dce5f0",  text: PRIMARY   },
    4: { bg: "#e8eaed",  text: STEEL    },
    5: { bg: "#fef3cd",  text: "#d97706" },
    6: { bg: "#f0fdf4",  text: "#15803d" },
    7: { bg: "#dcfce7",  text: "#059669" },
    8: { bg: "#fee2e2",  text: "#dc2626" },
  };
  return map[stageId] ?? { bg: "#f0f0f5", text: "#6b7280" };
}

function activityIcon(type: DealActivity["type"]) {
  const map: Record<DealActivity["type"], { icon: string; color: string }> = {
    deal_created: { icon: "🎯", color: PRIMARY },
    stage_change: { icon: "🔄", color: PRIMARY },
    task_done:    { icon: "✅", color: "#059669" },
    task_undone:  { icon: "↩️", color: "#6b7280" },
    note_added:   { icon: "📝", color: "#d97706" },
    file_added:   { icon: "📎", color: STEEL },
    won:          { icon: "🏆", color: "#059669" },
    lost:         { icon: "❌", color: "#dc2626" },
  };
  return map[type] ?? { icon: "•", color: "#6b7280" };
}

const ACTIVE_STAGES = pipelineStages.filter(s => s.id !== 7 && s.id !== 8);

// ── Progress Bar ───────────────────────────────────────────────────
function ProgressBar({ pct, size = "normal" }: { pct: number; size?: "normal" | "small" }) {
  const h     = size === "small" ? 6 : 8;
  const color = pct >= 80 ? "#059669" : pct >= 50 ? PRIMARY : "#f59e0b";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: h, borderRadius: 999, background: "var(--muted)", overflow: "hidden" }}>
        <div className="top5-bar" style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 999 }} />
      </div>
      <span style={{ fontSize: size === "small" ? "0.6rem" : "0.68rem", fontWeight: 700, color, minWidth: 28, textAlign: "right" }}>
        {pct}%
      </span>
    </div>
  );
}

// ── Days-in-Stage Chip ─────────────────────────────────────────────
// แสดง "ค้าง N วัน" — ไฮไลต์สีเมื่อดีลค้างนาน (stale) เพื่อกระตุ้นให้ตามงาน
function DaysChip({ createdAt, size = "normal" }: { createdAt: string; size?: "normal" | "small" }) {
  const days = daysInStage(createdAt);
  if (days === null) return null;
  const c = daysChipStyle(days);
  return (
    <span
      title={`ค้างในขั้นตอนนี้ ${days} วัน (นับจาก ${createdAt})`}
      style={{
        display: "inline-flex", alignItems: "center", gap: 3,
        fontSize: size === "small" ? "0.58rem" : "0.62rem", fontWeight: 700,
        color: c.text, background: c.bg, border: `1px solid ${c.border}`,
        borderRadius: 99, padding: size === "small" ? "1px 7px" : "2px 9px",
        whiteSpace: "nowrap", lineHeight: 1.4,
      }}
    >
      <Clock size={size === "small" ? 9 : 10} />
      ค้าง {days} วัน
    </span>
  );
}

// ── Stage Selector ─────────────────────────────────────────────────
function StageSelector({ stageId, onMove, onClose }: {
  stageId: number;
  onMove: (id: number) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 300 }} />
      <div style={{
        position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 301,
        background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12,
        boxShadow: "0 8px 24px rgba(0,51,102,.15)", minWidth: 200, overflow: "hidden",
      }}>
        {pipelineStages.filter(s => s.id !== 8).map(s => {
          const sc = stageColor(s.id);
          return (
            <button key={s.id} onClick={() => { onMove(s.id); onClose(); }}
              style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%",
                padding: "10px 14px", border: "none", background: s.id === stageId ? "#f8faff" : "#fff",
                cursor: "pointer", textAlign: "left",
              }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: sc.text, flexShrink: 0 }} />
              <span style={{ fontSize: "0.78rem", color: s.id === stageId ? PRIMARY : STEEL, fontWeight: s.id === stageId ? 700 : 400 }}>
                {s.name}
              </span>
              {s.id === stageId && <span style={{ marginLeft: "auto", fontSize: "0.65rem", color: PRIMARY }}>✓</span>}
            </button>
          );
        })}
      </div>
    </>
  );
}

// ── Add / Edit Deal Modal ──────────────────────────────────────────
// ฟอร์มเดียวใช้ทั้งเพิ่มและแก้ไข (initial = โหมดแก้ไข) — คืนค่าเฉพาะฟิลด์หลักผ่าน onSubmit
export type DealFormData = {
  customer: string; project: string; value: number;
  assigned: string; expectedClose?: string; dealer: string;
};

function DealFormModal({ onClose, onSubmit, initial }: {
  onClose: () => void;
  onSubmit: (data: DealFormData) => void;
  initial?: PipelineDealMock;
}) {
  const isEdit = !!initial;
  const [form, setForm] = useState({
    customer:      initial?.customer ?? "",
    project:       initial?.project ?? "",
    value:         initial ? String(initial.value) : "",
    assigned:      initial?.assigned ?? "",
    expectedClose: initial?.expectedClose ?? "",
    dealer:        initial?.dealer ?? "สาขาของฉัน",
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const val = parseFloat(form.value.replace(/[฿,]/g, "")) || 0;
    onSubmit({
      customer: form.customer,
      project: form.project,
      value: val,
      assigned: form.assigned,
      expectedClose: form.expectedClose || undefined,
      dealer: form.dealer,
    });
    onClose();
  }

  const field = (label: string, key: keyof typeof form, placeholder: string, type = "text") => (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: STEEL, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </label>
      <input
        type={type}
        value={form[key]}
        onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
        placeholder={placeholder}
        required={key !== "dealer" && key !== "expectedClose"}
        style={{
          width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${BORDER}`,
          fontSize: "0.82rem", outline: "none", boxSizing: "border-box", color: STEEL,
        }}
      />
    </div>
  );

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 900, backdropFilter: "blur(2px)" }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        width: 480, background: "#fff", borderRadius: 20, zIndex: 901,
        boxShadow: "0 20px 60px rgba(0,51,102,.2)", overflow: "hidden",
      }}>
        <div style={{ padding: "24px 28px 0", borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: STEEL }}>{isEdit ? "แก้ไขโอกาสการขาย" : "เพิ่มโอกาสการขายใหม่"}</h2>
              <p style={{ margin: "4px 0 0", fontSize: "0.72rem", color: "#6b7280" }}>{isEdit ? "แก้ไขข้อมูลหลักของโอกาสการขาย" : "สร้างโอกาสการขายใหม่ในขั้นตอนแรก"}</p>
            </div>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${BORDER}`, background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <X size={16} color="#6b7280" />
            </button>
          </div>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: "24px 28px" }}>
          {field("ชื่อลูกค้า / บริษัท", "customer", "เช่น บจ. ไทยสตีล")}
          {field("ชื่อโอกาสการขาย", "project", "เช่น โกดังสำเร็จรูป 1,200 ตร.ม.")}
          {field("มูลค่าคาดการณ์", "value", "เช่น 1500000", "number")}
          {field("วันคาดว่าจะปิดการขาย", "expectedClose", "", "date")}
          {field("ผู้รับผิดชอบ", "assigned", "เช่น สมชาย")}
          <button type="submit" className="btn btn-primary"
            style={{ width: "100%", justifyContent: "center", padding: "13px", marginTop: 4, fontSize: "0.88rem" }}>
            {isEdit ? "บันทึกการแก้ไข" : "สร้างโอกาสการขาย"}
          </button>
        </form>
      </div>
    </>
  );
}

// ── Deal Drawer ────────────────────────────────────────────────────
type DrawerTab = "overview" | "tasks" | "quotation" | "files";

function DealDrawer({ deal, onClose, onEdit, onDelete }: {
  deal: PipelineDealMock;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { updateDealTask, moveDealStage, closeDeal, leadDealMap, leads, updateDealNotes, addDealFile, quotations } = useSales();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab]                 = useState<DrawerTab>("overview");
  const [showStageMenu, setShowStageMenu] = useState(false);
  const [showCloseMenu, setShowCloseMenu] = useState(false);
  const [lostReason, setLostReason]   = useState("");
  const [notes, setNotes]             = useState(deal.notes ?? "");
  const [notesDirty, setNotesDirty]   = useState(false);
  const [delConfirm, setDelConfirm]   = useState(false);

  const progress = calcProgress(deal);
  const stage    = pipelineStages.find(s => s.id === deal.stageId);
  const sc       = stageColor(deal.stageId);

  const linkedLeadId = Object.entries(leadDealMap).find(([, did]) => did === deal.id)?.[0];
  const linkedLead   = linkedLeadId ? leads.find(l => l.id === linkedLeadId) : undefined;

  function handleClose(outcome: "won" | "lost") {
    closeDeal(deal.id, outcome, outcome === "lost" ? lostReason : undefined);
    setShowCloseMenu(false);
    onClose();
  }

  function handleNotesBlur() {
    if (notesDirty) {
      updateDealNotes(deal.id, notes);
      setNotesDirty(false);
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const size = file.size >= 1e6
      ? `${(file.size / 1e6).toFixed(1)}MB`
      : `${Math.round(file.size / 1024)}KB`;
    addDealFile(deal.id, { name: file.name, size });
    e.target.value = "";
  }

  // ปิดด้วยปุ่ม Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const TABS: { key: DrawerTab; label: string; icon: React.ReactNode }[] = [
    { key: "overview",  label: "ภาพรวม",     icon: <FileText size={13} /> },
    { key: "tasks",     label: "งาน",         icon: <CheckCircle2 size={13} /> },
    { key: "quotation", label: "ใบเสนอราคา", icon: <ScrollText size={13} /> },
    { key: "files",     label: "ไฟล์",        icon: <Paperclip size={13} /> },
  ];

  // ใบเสนอราคาที่ผูกกับลูกค้าของดีลนี้ (จาก context) — จับคู่ด้วย customerId หรือชื่อลูกค้า
  const dealQuotations = quotations.filter(q =>
    (deal.customerId && q.customerId === deal.customerId) || q.customer === deal.customer
  );

  // อักษรย่อสำหรับ avatar (จากชื่อโอกาสการขาย/ลูกค้า)
  const avatarText = (deal.project || deal.customer || "").trim().slice(0, 2);

  const isActive = deal.outcome === "active";

  // ── ปุ่มปิดการขาย (won/lost) — ใช้ในแถบเครื่องมือด้านขวา ──
  const closePanel = isActive && (
    showCloseMenu ? (
      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "10px", borderRadius: 10, border: `1px solid ${BORDER}`, background: "#f8faff" }}>
        <button onClick={() => handleClose("won")}
          style={{ padding: "10px", borderRadius: 9, border: "none", background: "#059669", color: "#fff", fontWeight: 700, fontSize: "0.76rem", cursor: "pointer" }}>
          ✅ ปิดการขายสำเร็จ
        </button>
        <div>
          <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "#9ca3af", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 6 }}>
            เหตุผลที่ไม่สำเร็จ
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
            {LOST_REASONS.map(r => {
              const active = lostReason === r;
              return (
                <button key={r} type="button" onClick={() => setLostReason(r)}
                  style={{
                    padding: "5px 10px", borderRadius: 99, fontSize: "0.68rem", fontWeight: active ? 700 : 500,
                    border: `1px solid ${active ? "#dc2626" : BORDER}`,
                    background: active ? "#fee2e2" : "#fff",
                    color: active ? "#dc2626" : "#374151",
                    cursor: "pointer", transition: "all .12s",
                  }}>
                  {r}
                </button>
              );
            })}
          </div>
          <button onClick={() => lostReason && handleClose("lost")}
            disabled={!lostReason}
            style={{
              width: "100%", padding: "10px", borderRadius: 9, border: "none",
              background: lostReason ? "#fee2e2" : "#f0f0f5",
              color: lostReason ? "#dc2626" : "#9ca3af",
              fontWeight: 700, fontSize: "0.76rem",
              cursor: lostReason ? "pointer" : "not-allowed",
            }}>
            ❌ ปิดการขายไม่สำเร็จ
          </button>
        </div>
        <button onClick={() => setShowCloseMenu(false)}
          style={{ padding: "7px", borderRadius: 8, border: `1px solid ${BORDER}`, background: "#fff", color: "#6b7280", fontSize: "0.7rem", cursor: "pointer" }}>
          ยกเลิก
        </button>
      </div>
    ) : (
      <button onClick={() => setShowCloseMenu(true)} className="btn btn-secondary btn-sm"
        style={{ justifyContent: "center" }}>
        ปิดการขายนี้ →
      </button>
    )
  );

  return (
    <>
      <div onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(45,45,45,.45)", zIndex: 1000 }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        width: "min(760px, calc(100vw - 32px))", height: "min(660px, calc(100vh - 48px))",
        background: "#fff", borderRadius: 18,
        zIndex: 1001, display: "flex", flexDirection: "column", overflow: "hidden",
        boxShadow: "0 24px 64px rgba(0,51,102,.22)",
      }}>

        {/* ── NAVY Header ── */}
        <div style={{ background: PRIMARY, padding: "16px 18px 12px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 13, background: "rgba(255,255,255,.18)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontWeight: 800, fontSize: "1rem",
                border: "2px solid rgba(255,255,255,.25)", flexShrink: 0,
              }}>
                {avatarText}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "0.92rem", fontWeight: 800, color: "#fff", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {deal.project}
                </div>
                <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,.65)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {deal.customer}
                </div>
              </div>
            </div>
            <button onClick={onClose}
              style={{
                background: "rgba(255,255,255,.15)", border: "none", borderRadius: 8,
                width: 28, height: 28, cursor: "pointer", color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
              <X size={14} />
            </button>
          </div>

          {/* Badge row: stage + ค้าง N วัน + มูลค่า */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ padding: "2px 10px", borderRadius: 99, fontSize: "0.64rem", fontWeight: 700, background: sc.bg, color: sc.text }}>
              {stage?.name ?? "—"}
            </span>
            {isActive && (() => {
              const d = daysInStage(deal.createdAt);
              if (d === null) return null;
              const c = daysChipStyle(d);
              return (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 10px", borderRadius: 99, fontSize: "0.64rem", fontWeight: 700, background: c.bg, color: c.text }}>
                  <Clock size={10} /> ค้าง {d} วัน
                </span>
              );
            })()}
            <span style={{ marginLeft: "auto", padding: "2px 10px", borderRadius: 99, fontSize: "0.68rem", fontWeight: 800, background: "rgba(255,255,255,.18)", color: "#fff" }}>
              {fmtMoney(deal.value)}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="tab-bar" style={{ flexShrink: 0 }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`tab-item${tab === t.key ? " active" : ""}`}
              style={{ display: "flex", alignItems: "center", gap: 5 }}>
              {t.icon} {t.label}
              {t.key === "files" && deal.files.length > 0 &&
                <span style={{ fontSize: "0.6rem", fontWeight: 700, color: PRIMARY, background: "#dce5f0", borderRadius: 99, padding: "1px 6px" }}>
                  {deal.files.length}
                </span>
              }
            </button>
          ))}
        </div>

        {/* ── Two-column body ── */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

          {/* LEFT: active tab content */}
          <div style={{ flex: 1, overflowY: "auto", borderRight: "1px solid #f0f4f8", padding: "18px 20px" }}>

          {/* Won/Lost banner */}
          {!isActive && (
            <div style={{
              padding: "12px 16px", borderRadius: 10, marginBottom: 20,
              background: deal.outcome === "won" ? "#f0fdf4" : "#fee2e2",
              border: `1px solid ${deal.outcome === "won" ? "#bbf7d0" : "#fca5a5"}`,
              fontSize: "0.82rem", fontWeight: 700,
              color: deal.outcome === "won" ? "#059669" : "#dc2626",
            }}>
              {deal.outcome === "won" ? "✅ ปิดการขายสำเร็จ" : `❌ ไม่สำเร็จ — ${deal.lostReason ?? "ไม่ระบุ"}`}
            </div>
          )}

          {/* ── TAB: Overview ── */}
          {tab === "overview" && (
            <>
              {/* Progress */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.62rem", color: "#6b7280", marginBottom: 5 }}>
                  <span>ความคืบหน้าการขาย</span>
                  <span style={{ fontWeight: 700, color: progress >= 80 ? "#059669" : progress >= 50 ? PRIMARY : "#f59e0b" }}>
                    {deal.tasks.filter(t => t.done).length}/{deal.tasks.length} งาน · {progress}%
                  </span>
                </div>
                <div style={{ height: 8, borderRadius: 999, background: "var(--muted)", overflow: "hidden" }}>
                  <div className="top5-bar" style={{ height: "100%", width: `${progress}%`, borderRadius: 999, background: progress >= 80 ? "#059669" : progress >= 50 ? PRIMARY : "#f59e0b" }} />
                </div>
              </div>

              {/* Info grid */}
              <div style={{ padding: "14px 16px", borderRadius: 12, background: "#f8faff", border: `1px solid ${BORDER}`, marginBottom: 20 }}>
                {[
                  { label: "มูลค่าคาดการณ์", value: fmtMoney(deal.value) },
                  { label: "วันคาดว่าจะปิดการขาย", value: deal.expectedClose || "—" },
                  { label: "ผู้รับผิดชอบ", value: deal.assigned },
                  { label: "สาขา",          value: deal.dealer },
                  { label: "วันที่รับ",      value: deal.createdAt },
                  { label: "ค้างในขั้นตอน",  value: daysInStage(deal.createdAt) !== null ? `${daysInStage(deal.createdAt)} วัน` : "—" },
                  { label: "ไฟล์แนบ",       value: `${deal.files.length} ไฟล์` },
                ].map(r => (
                  <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${BORDER}`, fontSize: "0.76rem" }}>
                    <span style={{ color: "#6b7280" }}>{r.label}</span>
                    <span style={{ color: STEEL, fontWeight: 600 }}>{r.value}</span>
                  </div>
                ))}
                {deal.outcome === "lost" && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0 2px", fontSize: "0.76rem" }}>
                    <span style={{ color: "#6b7280" }}>เหตุผลที่ไม่สำเร็จ</span>
                    <span style={{
                      fontSize: "0.7rem", fontWeight: 700, color: "#dc2626",
                      background: "#fee2e2", border: "1px solid #fca5a5",
                      borderRadius: 99, padding: "3px 10px",
                    }}>
                      {deal.lostReason ?? "ไม่ระบุ"}
                    </span>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
                  <StickyNote size={14} color={PRIMARY} />
                  <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#374151", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                    บันทึก
                  </span>
                  {notesDirty && (
                    <span style={{ fontSize: "0.62rem", color: "#f59e0b", marginLeft: "auto" }}>• ยังไม่ได้บันทึก</span>
                  )}
                </div>
                <textarea
                  value={notes}
                  onChange={e => { setNotes(e.target.value); setNotesDirty(true); }}
                  onBlur={handleNotesBlur}
                  disabled={deal.outcome !== "active"}
                  placeholder="เพิ่มบันทึก ข้อมูลสำคัญ หรือ action items..."
                  rows={4}
                  style={{
                    width: "100%", padding: "12px 14px", borderRadius: 10,
                    border: `1px solid ${BORDER}`, fontSize: "0.8rem", resize: "vertical",
                    outline: "none", color: STEEL, lineHeight: 1.6, boxSizing: "border-box",
                    background: deal.outcome !== "active" ? "#f8faff" : "#fff",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              {/* Activity Timeline */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 14 }}>
                  <Clock size={14} color={PRIMARY} />
                  <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#374151", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                    ประวัติกิจกรรม
                  </span>
                </div>
                {(!deal.activities || deal.activities.length === 0) ? (
                  <div style={{ fontSize: "0.78rem", color: "#9ca3af", padding: "16px 0" }}>ยังไม่มีกิจกรรม</div>
                ) : (
                  <div style={{ position: "relative", paddingLeft: 20 }}>
                    {/* vertical line */}
                    <div style={{ position: "absolute", left: 7, top: 6, bottom: 6, width: 1, background: BORDER }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                      {deal.activities.map((act, i) => {
                        const { icon, color } = activityIcon(act.type);
                        return (
                          <div key={act.id} style={{ display: "flex", gap: 12, paddingBottom: 14, position: "relative" }}>
                            <div style={{
                              position: "absolute", left: -20, top: 1,
                              width: 16, height: 16, borderRadius: "50%",
                              background: "#fff", border: `1px solid ${BORDER}`,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: "0.6rem", flexShrink: 0,
                            }}>
                              {icon}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: "0.76rem", color: STEEL, fontWeight: 500 }}>{act.text}</div>
                              <div style={{ fontSize: "0.62rem", color: "#9ca3af", marginTop: 2 }}>{fmtTime(act.timestamp)}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

            </>
          )}

          {/* ── TAB: Tasks ── */}
          {tab === "tasks" && (
            <div>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#374151", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 12 }}>
                รายการงาน ({deal.tasks.filter(t => t.done).length}/{deal.tasks.length})
              </div>
              {deal.tasks.length === 0
                ? <div style={{ fontSize: "0.78rem", color: "#9ca3af", padding: "24px 0", textAlign: "center" }}>ยังไม่มีรายการงาน</div>
                : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {deal.tasks.map(task => (
                      <div key={task.id}
                        onClick={() => deal.outcome === "active" && updateDealTask(deal.id, task.id, !task.done)}
                        style={{
                          display: "flex", alignItems: "center", gap: 10, padding: "12px 14px",
                          borderRadius: 10, border: `1px solid ${task.done ? "#bbf7d0" : "#e5e7eb"}`,
                          background: task.done ? "#f0fdf4" : "#fff",
                          cursor: deal.outcome === "active" ? "pointer" : "default",
                          transition: "all .15s",
                        }}>
                        {task.done
                          ? <CheckCircle2 size={18} color="#059669" style={{ flexShrink: 0 }} />
                          : <Circle size={18} color="#d1d5db" style={{ flexShrink: 0 }} />}
                        <span style={{
                          fontSize: "0.8rem", color: task.done ? "#15803d" : "#374151",
                          fontWeight: task.done ? 500 : 400,
                          textDecoration: task.done ? "line-through" : "none",
                          flex: 1,
                        }}>
                          {task.text}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              }
            </div>
          )}

          {/* ── TAB: Quotation ── */}
          {tab === "quotation" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#374151", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                  ใบเสนอราคา ({dealQuotations.length})
                </div>
                <button onClick={() => router.push("/quotations")} className="btn btn-tint btn-sm">
                  <FilePlus2 size={13} /> สร้างใบเสนอราคา
                </button>
              </div>

              {dealQuotations.length === 0
                ? (
                  <div style={{ padding: "40px 20px", textAlign: "center", borderRadius: 12, border: `2px dashed ${BORDER}` }}>
                    <ScrollText size={28} color="#d1d5db" style={{ marginBottom: 10 }} />
                    <div style={{ fontSize: "0.78rem", color: "#9ca3af", marginBottom: 8 }}>ยังไม่มีใบเสนอราคาของลูกค้ารายนี้</div>
                    <button onClick={() => router.push("/quotations")}
                      style={{ fontSize: "0.72rem", color: PRIMARY, fontWeight: 600, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                      สร้างใบเสนอราคาแรก
                    </button>
                  </div>
                )
                : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {dealQuotations.map(q => {
                      const qc = quotationStatusColor[q.status];
                      return (
                        <div key={q.id} onClick={() => router.push("/quotations")}
                          className="clickable"
                          style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 10, border: `1px solid ${BORDER}`, background: "#fff", cursor: "pointer" }}>
                          <ScrollText size={16} color={PRIMARY} style={{ flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#2D2D2D" }}>{q.id}</div>
                            <div style={{ fontSize: "0.68rem", color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.project}</div>
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <div style={{ fontSize: "0.82rem", fontWeight: 800, color: PRIMARY }}>{fmtMoney(q.totalValue)}</div>
                            <span className="badge" style={{ background: qc.bg, color: qc.text, marginTop: 2 }}>{quotationStatusLabel[q.status]}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              }
            </div>
          )}

          {/* ── TAB: Files ── */}
          {tab === "files" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#374151", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                  ไฟล์แนบ ({deal.files.length})
                </div>
                {deal.outcome === "active" && (
                  <>
                    <input ref={fileInputRef} type="file" style={{ display: "none" }} onChange={handleFileUpload} />
                    <button onClick={() => fileInputRef.current?.click()} className="btn btn-tint btn-sm">
                      <Upload size={13} /> อัปโหลดไฟล์
                    </button>
                  </>
                )}
              </div>

              {deal.files.length === 0
                ? (
                  <div style={{ padding: "40px 20px", textAlign: "center", borderRadius: 12, border: `2px dashed ${BORDER}` }}>
                    <Paperclip size={28} color="#d1d5db" style={{ marginBottom: 10 }} />
                    <div style={{ fontSize: "0.78rem", color: "#9ca3af", marginBottom: 8 }}>ยังไม่มีไฟล์แนบ</div>
                    {deal.outcome === "active" && (
                      <button onClick={() => fileInputRef.current?.click()}
                        style={{ fontSize: "0.72rem", color: PRIMARY, fontWeight: 600, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                        อัปโหลดไฟล์แรก
                      </button>
                    )}
                  </div>
                )
                : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {deal.files.map((f, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 10, border: `1px solid ${BORDER}`, background: "#f8faff" }}>
                        <Paperclip size={15} color={PRIMARY} />
                        <span style={{ fontSize: "0.8rem", color: "#374151", flex: 1 }}>{f.name}</span>
                        <span style={{ fontSize: "0.65rem", color: "#9ca3af" }}>{f.size}</span>
                      </div>
                    ))}
                  </div>
                )
              }
            </div>
          )}
          </div>
          {/* end LEFT column */}

          {/* RIGHT: action rail */}
          <div style={{ width: 210, flexShrink: 0, padding: 16, display: "flex", flexDirection: "column", gap: 8, overflowY: "auto" }}>

            {/* ลิงก์ต้นทาง: ถ้าลีดยังอยู่ → ไปผู้สนใจ · ถ้าปิดการขายแล้ว (ลีดกลายเป็นลูกค้า) → ไปลูกค้า */}
            {linkedLead ? (
              <button onClick={() => router.push(`/leads/${linkedLead.numId}`)}
                className="btn btn-tint btn-sm"
                style={{ justifyContent: "center", color: "#d97706" }}>
                <ArrowRight size={13} /> มาจากผู้สนใจ {linkedLeadId}
              </button>
            ) : deal.outcome === "won" && deal.customerId ? (
              <button onClick={() => router.push(`/customers/${deal.customerId}`)}
                className="btn btn-tint btn-sm"
                style={{ justifyContent: "center", color: "#059669" }}>
                <ArrowRight size={13} /> ดูลูกค้า
              </button>
            ) : null}

            {/* เปลี่ยนขั้นตอน */}
            {isActive && (
              <div style={{ position: "relative" }}>
                <button onClick={() => setShowStageMenu(p => !p)} className="btn btn-secondary btn-sm"
                  style={{ width: "100%", justifyContent: "center", color: PRIMARY }}>
                  <ArrowRight size={13} /> เปลี่ยนขั้นตอน
                </button>
                {showStageMenu && (
                  <StageSelector
                    stageId={deal.stageId}
                    onMove={id => moveDealStage(deal.id, id)}
                    onClose={() => setShowStageMenu(false)}
                  />
                )}
              </div>
            )}

            {/* ปิดการขาย (won/lost) */}
            {closePanel}

            {/* แก้ไข */}
            <button onClick={onEdit} className="btn btn-primary btn-sm" style={{ justifyContent: "center" }}>
              <Edit2 size={13} /> แก้ไข
            </button>

            <div style={{ flex: 1 }} />

            {/* ลบ (destructive, ล่างสุด) */}
            {!delConfirm ? (
              <button onClick={() => setDelConfirm(true)} className="btn btn-danger btn-sm" style={{ justifyContent: "center" }}>
                <Trash2 size={13} /> ลบโอกาสการขาย
              </button>
            ) : (
              <div style={{ borderRadius: 10, border: "1px solid #fca5a5", overflow: "hidden" }}>
                <div style={{ padding: "8px 12px", background: "#fee2e2", fontSize: "0.7rem", color: "#dc2626", fontWeight: 700 }}>
                  ลบ "{deal.project}"?
                </div>
                <div style={{ display: "flex" }}>
                  <button onClick={onDelete}
                    style={{ flex: 1, padding: "8px", background: "#dc2626", border: "none", color: "#fff", fontSize: "0.72rem", fontWeight: 700, cursor: "pointer" }}>
                    ยืนยันลบ
                  </button>
                  <button onClick={() => setDelConfirm(false)}
                    style={{ flex: 1, padding: "8px", background: "#fff", border: "none", borderLeft: "1px solid #fca5a5", color: STEEL, fontSize: "0.72rem", cursor: "pointer" }}>
                    ยกเลิก
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Lost Reason Modal ──────────────────────────────────────────────
// พรอมป์เลือกเหตุผลก่อนปิดการขายแบบ "ไม่สำเร็จ" (ใช้ตอนลากการ์ดลงคอลัมน์ "ไม่ได้งาน")
function LostReasonModal({ deal, onCancel, onConfirm }: {
  deal: PipelineDealMock;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState<string>("");
  return (
    <>
      <div onClick={onCancel}
        style={{ position: "fixed", inset: 0, background: "rgba(45,45,45,.45)", zIndex: 1100 }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        width: "min(420px, calc(100vw - 32px))", background: "#fff", borderRadius: 16,
        zIndex: 1101, overflow: "hidden", boxShadow: "0 24px 64px rgba(0,51,102,.22)",
      }}>
        <div style={{ padding: "22px 24px 16px", borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: "1.02rem", fontWeight: 800, color: "#dc2626" }}>ปิดการขายไม่สำเร็จ</h2>
              <p style={{ margin: "4px 0 0", fontSize: "0.72rem", color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {deal.customer} · {deal.project}
              </p>
            </div>
            <button onClick={onCancel}
              style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${BORDER}`, background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <X size={15} color="#6b7280" />
            </button>
          </div>
        </div>

        <div style={{ padding: "18px 24px 8px" }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#374151", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 10 }}>
            เลือกเหตุผลที่ไม่สำเร็จ
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {LOST_REASONS.map(r => {
              const active = reason === r;
              return (
                <button key={r} onClick={() => setReason(r)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, width: "100%",
                    padding: "11px 14px", borderRadius: 10, cursor: "pointer", textAlign: "left",
                    border: `1px solid ${active ? "#dc2626" : BORDER}`,
                    background: active ? "#fee2e2" : "#fff",
                    transition: "all .12s",
                  }}>
                  <span style={{
                    width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
                    border: `2px solid ${active ? "#dc2626" : "#d1d5db"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {active && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#dc2626" }} />}
                  </span>
                  <span style={{ fontSize: "0.82rem", fontWeight: active ? 700 : 500, color: active ? "#dc2626" : STEEL }}>
                    {r}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, padding: "14px 24px 20px" }}>
          <button onClick={onCancel}
            style={{ flex: 1, padding: "11px", borderRadius: 10, border: `1px solid ${BORDER}`, background: "#fff", color: "#6b7280", fontWeight: 600, fontSize: "0.8rem", cursor: "pointer" }}>
            ยกเลิก
          </button>
          <button onClick={() => reason && onConfirm(reason)} disabled={!reason}
            style={{
              flex: 1, padding: "11px", borderRadius: 10, border: "none",
              background: reason ? "#dc2626" : "#f0f0f5",
              color: reason ? "#fff" : "#9ca3af",
              fontWeight: 700, fontSize: "0.8rem",
              cursor: reason ? "pointer" : "not-allowed",
            }}>
            ยืนยันปิดการขาย
          </button>
        </div>
      </div>
    </>
  );
}

// ── Kanban Card ────────────────────────────────────────────────────
function KanbanCard({
  deal, onClick, onDragStart, isDragging,
}: {
  deal: PipelineDealMock;
  onClick: () => void;
  onDragStart: () => void;
  isDragging: boolean;
}) {
  const progress  = calcProgress(deal);
  const doneTasks = deal.tasks.filter(t => t.done).length;
  const sc        = stageColor(deal.stageId);
  const barColor  = progress >= 80 ? "#059669" : progress >= 50 ? PRIMARY : "#f59e0b";
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      style={{
        position: "relative", background: "#fff", borderRadius: 10,
        border: `1px solid ${isDragging ? PRIMARY : BORDER}`,
        padding: "12px 14px 12px 16px", cursor: "grab", marginBottom: 8, overflow: "hidden",
        boxShadow: isDragging ? "0 8px 24px rgba(0,51,102,.2)" : "0 1px 3px rgba(0,51,102,.06)",
        opacity: isDragging ? 0.5 : 1,
        transition: "box-shadow .15s, opacity .15s, transform .15s",
        userSelect: "none",
      }}
      onMouseEnter={e => { if (!isDragging) { const t = e.currentTarget as HTMLElement; t.style.boxShadow = "0 6px 18px rgba(0,51,102,.13)"; t.style.transform = "translateY(-1px)"; } }}
      onMouseLeave={e => { if (!isDragging) { const t = e.currentTarget as HTMLElement; t.style.boxShadow = "0 1px 3px rgba(0,51,102,.06)"; t.style.transform = "none"; } }}
    >
      {/* stage accent stripe */}
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: sc.text }} />

      {/* title + value */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ fontSize: "0.75rem", fontWeight: 700, color: STEEL, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
          {deal.customer}
        </div>
        <div style={{ fontSize: "0.82rem", fontWeight: 800, color: PRIMARY, flexShrink: 0 }}>
          {fmtMoney(deal.value)}
        </div>
      </div>
      <div style={{ fontSize: "0.66rem", color: "#6b7280", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {deal.project}
      </div>

      {/* days-in-stage chip (ดีลที่กำลังดำเนินการ) */}
      {deal.outcome === "active" && (
        <div style={{ marginTop: 7 }}>
          <DaysChip createdAt={deal.createdAt} size="small" />
        </div>
      )}

      {/* lost reason badge (แสดงเฉพาะดีลที่ไม่ได้งาน) */}
      {deal.outcome === "lost" && (
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 4, marginTop: 7,
          fontSize: "0.6rem", fontWeight: 700, color: "#dc2626",
          background: "#fee2e2", border: "1px solid #fca5a5",
          borderRadius: 99, padding: "2px 8px", maxWidth: "100%",
        }}>
          <X size={9} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {deal.lostReason ?? "ไม่ระบุ"}
          </span>
        </div>
      )}

      {/* progress (ERP top5-row style) */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.62rem", margin: "11px 0 5px" }}>
        <span style={{ color: "#9ca3af", fontWeight: 600 }}>{doneTasks}/{deal.tasks.length} งาน</span>
        <span style={{ fontWeight: 800, color: barColor }}>{progress}%</span>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: "var(--muted)", overflow: "hidden" }}>
        <div className="top5-bar" style={{ height: "100%", width: `${progress}%`, borderRadius: 999, background: barColor }} />
      </div>

      {/* footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 11 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{
            width: 22, height: 22, borderRadius: "50%", background: PRIMARY + "16",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "0.6rem", fontWeight: 800, color: PRIMARY,
          }}>
            {deal.assigned[0]}
          </div>
          <span style={{ fontSize: "0.62rem", color: "#6b7280" }}>{deal.assigned}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "0.58rem", fontWeight: 700, color: sc.text, background: sc.bg, borderRadius: 999, padding: "2px 8px" }}>
            {pipelineStages.find(s => s.id === deal.stageId)?.name ?? "—"}
          </span>
          {deal.files.length > 0 && <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: "0.6rem", color: "#9ca3af" }}><Paperclip size={10} />{deal.files.length}</span>}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────
// statusOptions ใช้ label ไทยจากผลลัพธ์โอกาสการขาย (outcome)
const DEAL_OUTCOME_OPTIONS = [
  { value: "active", label: "กำลังดำเนินการ" },
  { value: "won",    label: "ปิดการขายสำเร็จ" },
  { value: "lost",   label: "ไม่สำเร็จ" },
];

// ห่อด้วย FilterProvider ของหน้านี้เอง → ช่วงเวลาแยกอิสระจากหน้าอื่น
export default function PipelinePage() {
  return (
    <FilterProvider>
      <PipelinePageInner />
    </FilterProvider>
  );
}

function PipelinePageInner() {
  const router = useRouter();
  const { deals: ctxDeals, addDeal, moveDealStage, closeDeal } = useSales();
  const { timeRange, passes } = useFilters();

  const [view,         setView]         = useState<"list" | "kanban">("kanban");
  const [search,       setSearch]       = useState("");
  const [stageFilter,  setStageFilter]  = useState<number | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<PipelineDealMock | null>(null);
  const [showClosed,   setShowClosed]   = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editDeal,     setEditDeal]     = useState<PipelineDealMock | null>(null);
  const [draggingId,   setDraggingId]   = useState<number | null>(null);
  const [dragOverCol,  setDragOverCol]  = useState<number | null>(null);
  const [pendingLostId, setPendingLostId] = useState<number | null>(null);

  // ── Local CRUD overlay (mock, no backend) — เก็บใน state ของหน้านี้ ──
  // deletedIds: ดีลที่ถูกลบ (ซ่อนออกจากทุกมุมมองทันที)
  // edits: การแก้ไขฟิลด์หลักต่อดีล (ทับบนข้อมูลจาก context) — คงค่าที่ context จัดการเอง (stage/tasks/notes)
  const [deletedIds, setDeletedIds] = useState<Set<number>>(() => new Set());
  const [edits,      setEdits]      = useState<Record<number, Partial<PipelineDealMock>>>({});

  const deals = useMemo(
    () => ctxDeals
      .filter(d => !deletedIds.has(d.id))
      .map(d => (edits[d.id] ? { ...d, ...edits[d.id] } : d)),
    [ctxDeals, deletedIds, edits],
  );

  // ── CRUD handlers (local state) ──────────────────────────────────
  function handleAddDeal(data: DealFormData) {
    const now = new Date().toISOString();
    const newDeal: PipelineDealMock = {
      id: Math.max(0, ...ctxDeals.map(d => d.id)) + 1,
      customerId: 0,
      customer: data.customer,
      project: data.project,
      value: data.value,
      expectedClose: data.expectedClose,
      stageId: 1,
      assigned: data.assigned,
      dealer: data.dealer,
      dealerColor: PRIMARY,
      tasks: [
        { id: Date.now() + 1, text: "ติดต่อลูกค้าและแนะนำตัว", done: false },
        { id: Date.now() + 2, text: "ส่งแคตตาล็อกและข้อมูลผลิตภัณฑ์", done: false },
        { id: Date.now() + 3, text: "นัดประชุมนำเสนอ", done: false },
        { id: Date.now() + 4, text: "จัดทำใบเสนอราคา", done: false },
      ],
      files: [],
      outcome: "active",
      createdAt: "2026-06-30", // ตรึงตามวัน "ปัจจุบัน" ของ mock (ให้ดีลใหม่อยู่ในช่วงตัวกรอง)
      notes: "",
      activities: [
        { id: Date.now(), type: "deal_created", text: "สร้างโอกาสการขายใหม่", timestamp: now },
      ],
    };
    addDeal(newDeal);
    setSelectedDeal(newDeal);
  }

  function handleEditDeal(data: DealFormData) {
    if (!editDeal) return;
    setEdits(p => ({
      ...p,
      [editDeal.id]: {
        customer: data.customer,
        project: data.project,
        value: data.value,
        assigned: data.assigned,
        expectedClose: data.expectedClose,
        dealer: data.dealer,
      },
    }));
    setEditDeal(null);
  }

  function handleDeleteDeal(id: number) {
    setDeletedIds(p => new Set(p).add(id));
    setSelectedDeal(null);
  }

  // กรองด้วย FilterBar กลาง: ช่วงเวลา (createdAt) + สถานะผลลัพธ์ (outcome)
  const globalDeals = deals.filter(d => passes({ date: d.createdAt, status: d.outcome }));
  const activeDeals = globalDeals.filter(d => showClosed || d.outcome === "active");

  const filtered = useMemo(() => {
    return activeDeals.filter(d => {
      const q = search.toLowerCase();
      const matchSearch = !q || d.customer.toLowerCase().includes(q)
        || d.project.toLowerCase().includes(q) || d.assigned.toLowerCase().includes(q);
      const matchStage = stageFilter === null || d.stageId === stageFilter;
      return matchSearch && matchStage;
    });
  }, [activeDeals, search, stageFilter]);

  // ดีลที่ปิดแล้ว (won/lost) สำหรับคอลัมน์ท้ายบอร์ด — โชว์เสมอ (จบ Sales Journey)
  const closedDeals = globalDeals.filter(d => {
    if (d.outcome === "active") return false;
    const q = search.toLowerCase();
    return !q || d.customer.toLowerCase().includes(q)
      || d.project.toLowerCase().includes(q) || d.assigned.toLowerCase().includes(q);
  });

  const liveSelectedDeal = selectedDeal
    ? deals.find(d => d.id === selectedDeal.id) ?? selectedDeal
    : null;

  // KPI คำนวณจากชุดที่ผ่าน FilterBar (ช่วงเวลา + สถานะ) เพื่อให้ตัวเลขสอดคล้องกับตัวกรอง
  const totalValue  = globalDeals.filter(d => d.outcome === "active").reduce((s, d) => s + d.value, 0);
  const wonDeals    = globalDeals.filter(d => d.outcome === "won");
  const wonValue    = wonDeals.reduce((s, d) => s + d.value, 0);
  const activeOnly  = globalDeals.filter(d => d.outcome === "active");
  const avgProgress = activeOnly.length
    ? Math.round(activeOnly.reduce((s, d) => s + calcProgress(d), 0) / activeOnly.length)
    : 0;

  // ── Pipeline Summary (สรุปมูลค่า/จำนวนดีล จากชุดที่ผ่าน FilterBar) ──
  const pipelineValue    = globalDeals.reduce((s, d) => s + d.value, 0); // มูลค่าไปป์ไลน์รวม (ทุกดีล)
  const expectedRevenue  = totalValue;                                    // มูลค่าคาดการณ์ = ดีลที่กำลังดำเนินการ
  const totalDealCount   = globalDeals.length;
  const wonDealCount     = wonDeals.length;

  // ── Drag handlers ────────────────────────────────────────────────
  function handleDrop(stageId: number) {
    if (draggingId !== null) {
      const deal = deals.find(d => d.id === draggingId);
      if (deal && deal.outcome === "active") {
        if (stageId === 7) closeDeal(draggingId, "won");
        // ปิดแบบ "ไม่สำเร็จ" ต้องเลือกเหตุผลก่อน → เปิด modal (ยังไม่ปิดจนกว่าจะยืนยัน)
        else if (stageId === 8) setPendingLostId(draggingId);
        else if (deal.stageId !== stageId) moveDealStage(draggingId, stageId);
      }
    }
    setDraggingId(null);
    setDragOverCol(null);
  }

  return (
    <div className="erp" style={{ paddingBottom: 40 }}>

      {/* ── Header ── */}
      <div className="page-head">
        <div>
          <h2>เส้นทางการขาย</h2>
          <p>ติดตามโอกาสการขาย · {activeOnly.length} โอกาสการขายที่กำลังดำเนินการ · {timeRange.subtitle}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <FilterBar dims={[]} />
          <button onClick={() => router.push("/leads")} className="btn btn-secondary btn-md">
            ผู้สนใจ <ArrowRight size={13} />
          </button>
          <button onClick={() => setShowAddModal(true)} className="btn btn-primary btn-md">
            <Plus size={14} /> เพิ่มโอกาสการขาย
          </button>
        </div>
      </div>

      {/* ── Global Filter Bar (ช่วงเวลา + สถานะผลลัพธ์โอกาสการขาย) ── */}
      <div style={{ marginBottom: 16 }}>
      </div>

      {/* ── KPI Row (คลิกเพื่อกรอง/โฟกัสมุมมอง) ── */}
      <div className="kpi-bar">
        {[
          { icon: <TrendingUp size={18} color={PRIMARY} />, label: "ดีลทั้งหมด", value: String(totalDealCount), sub: `${activeOnly.length} กำลังดำเนินการ`, cls: "kpi-navy",
            onClick: () => { setStageFilter(null); setSearch(""); setShowClosed(true); } },
          { icon: <DollarSign size={18} color="#059669" />, label: "มูลค่าไปป์ไลน์รวม", value: fmtMoney(pipelineValue), sub: "มูลค่าคาดการณ์รวมทุกดีล", cls: "kpi-green",
            onClick: () => { setStageFilter(null); setShowClosed(true); } },
          { icon: <Trophy size={18} color="#d97706" />, label: "ปิดการขายได้", value: String(wonDeals.length), sub: fmtMoney(wonValue), cls: "kpi-amber",
            onClick: () => { setStageFilter(null); setShowClosed(true); setView("kanban"); } },
          { icon: <Target size={18} color={PRIMARY} />, label: "คืบหน้าเฉลี่ย", value: `${avgProgress}%`, sub: "ของดีลที่ดำเนินการ", cls: "kpi-navy",
            onClick: () => { setStageFilter(null); setShowClosed(false); } },
        ].map(k => (
          <div key={k.label} className="kpi clickable" role="button" tabIndex={0}
            onClick={k.onClick}
            onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); k.onClick(); } }}
            style={{ flexDirection: "row", alignItems: "center", gap: 14, cursor: "pointer" }}>
            <div className={`kpi-icon ${k.cls}`} style={{ width: 44, height: 44 }}>{k.icon}</div>
            <div>
              <div className="kpi-val">{k.value}</div>
              <div className="kpi-label">{k.label}</div>
              <div style={{ fontSize: "0.62rem", color: "#9ca3af" }}>{k.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filter Bar ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 300 }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="ค้นหาลูกค้า โอกาสการขาย..."
            style={{ width: "100%", padding: "9px 12px 9px 34px", borderRadius: 10, border: `1px solid ${BORDER}`, fontSize: "0.78rem", outline: "none", boxSizing: "border-box" }} />
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button onClick={() => setStageFilter(null)}
            style={{ padding: "7px 14px", borderRadius: 99, fontSize: "0.72rem", fontWeight: 600, border: `1px solid ${stageFilter === null ? PRIMARY : BORDER}`, background: stageFilter === null ? PRIMARY : "#fff", color: stageFilter === null ? "#fff" : "#374151", cursor: "pointer" }}>
            ทั้งหมด
          </button>
          {ACTIVE_STAGES.map(s => (
            <button key={s.id} onClick={() => setStageFilter(stageFilter === s.id ? null : s.id)}
              style={{ padding: "7px 14px", borderRadius: 99, fontSize: "0.72rem", fontWeight: 600, border: `1px solid ${stageFilter === s.id ? s.color : BORDER}`, background: stageFilter === s.id ? s.color + "18" : "#fff", color: stageFilter === s.id ? s.color : "#374151", cursor: "pointer" }}>
              {s.name}
            </button>
          ))}
        </div>

        <button onClick={() => setShowClosed(p => !p)}
          style={{ padding: "7px 14px", borderRadius: 99, fontSize: "0.72rem", fontWeight: 600, border: `1px solid ${showClosed ? "#059669" : BORDER}`, background: showClosed ? "#f0fdf4" : "#fff", color: showClosed ? "#059669" : "#374151", cursor: "pointer", marginLeft: "auto" }}>
          {showClosed ? "ซ่อนที่ปิดแล้ว" : "แสดงที่ปิดแล้ว"}
        </button>

        <div style={{ display: "flex", borderRadius: 10, border: `1px solid ${BORDER}`, overflow: "hidden", flexShrink: 0, background: "#fff" }}>
          {([["list", "รายการ"], ["kanban", "คัมบัง"]] as const).map(([v, l]) => (
            <button key={v} onClick={() => setView(v)}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 14px", fontSize: "0.72rem", fontWeight: 600, border: "none", cursor: "pointer", background: view === v ? PRIMARY : "#fff", color: view === v ? "#fff" : "#374151" }}>
              {v === "list" ? <LayoutList size={14} /> : <Columns3 size={14} />}
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* ── LIST VIEW ── */}
      {view === "list" && (
        <div className="card">
          <div className="table-wrap" style={{ borderTop: "none" }}>
            <table>
              <colgroup>
                <col style={{ width: "26%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "20%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "8%" }} />
              </colgroup>
              <thead>
                <tr>
                  {["ลูกค้า / โอกาสการขาย", "ขั้นตอน", "ความคืบหน้าการขาย", "มูลค่า", "ผู้รับผิดชอบ", "งาน", ""].map(h => (
                    <th key={h} className={h === "มูลค่า" ? "num" : undefined}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: "40px", textAlign: "center", color: "#9ca3af", fontSize: "0.8rem" }}>ไม่พบโอกาสการขาย</td></tr>
                )}
                {filtered.map(deal => {
                  const progress  = calcProgress(deal);
                  const sc        = stageColor(deal.stageId);
                  const stage     = pipelineStages.find(s => s.id === deal.stageId);
                  const doneTasks = deal.tasks.filter(t => t.done).length;
                  return (
                    <tr key={deal.id} className="clickable" onClick={() => setSelectedDeal(deal)}>
                      <td>
                        <div style={{ fontSize: "0.82rem", fontWeight: 700, color: STEEL }}>{deal.customer}</div>
                        <div style={{ fontSize: "0.7rem", color: "#6b7280", marginTop: 2 }}>{deal.project}</div>
                      </td>
                      <td>
                        <span className="badge" style={{ background: sc.bg, color: sc.text }}>
                          {stage?.name ?? "—"}
                        </span>
                      </td>
                      <td style={{ minWidth: 140 }}><ProgressBar pct={progress} size="small" /></td>
                      <td className="num" style={{ fontSize: "0.88rem", fontWeight: 800, color: PRIMARY, whiteSpace: "nowrap" }}>{fmtMoney(deal.value)}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 24, height: 24, borderRadius: "50%", background: PRIMARY, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.55rem", fontWeight: 800, color: "#fff", flexShrink: 0 }}>
                            {deal.assigned[0]}
                          </div>
                          <span style={{ fontSize: "0.75rem", color: "#374151" }}>{deal.assigned}</span>
                        </div>
                      </td>
                      <td>
                        {deal.tasks.length > 0
                          ? <span style={{ fontSize: "0.72rem", color: doneTasks === deal.tasks.length ? "#059669" : "#6b7280", fontWeight: 600 }}>{doneTasks}/{deal.tasks.length}</span>
                          : <span style={{ fontSize: "0.72rem", color: "#d1d5db" }}>—</span>
                        }
                      </td>
                      <td><ChevronRight size={16} color="#9ca3af" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── KANBAN VIEW ── */}
      {view === "kanban" && (
        <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8, alignItems: "flex-start" }}>
          {pipelineStages.map(stage => {
            const stageDeals =
              stage.id === 7 ? closedDeals.filter(d => d.outcome === "won")
              : stage.id === 8 ? closedDeals.filter(d => d.outcome === "lost")
              : filtered.filter(d => d.stageId === stage.id && d.outcome === "active");
            const stageValue = stageDeals.reduce((s, d) => s + d.value, 0);
            const isOver     = dragOverCol === stage.id;
            return (
              <div key={stage.id}
                style={{ minWidth: 280, maxWidth: 280, flexShrink: 0 }}
                onDragOver={e => { e.preventDefault(); setDragOverCol(stage.id); }}
                onDragLeave={() => setDragOverCol(null)}
                onDrop={() => handleDrop(stage.id)}
              >
                {/* Column header */}
                <div style={{
                  padding: "12px 14px", borderRadius: 12,
                  border: `1px solid ${isOver ? stage.color : BORDER}`,
                  background: isOver ? stage.color + "08" : "#fff",
                  marginBottom: 10, transition: "all .15s",
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: stage.color }} />
                      <span style={{ fontSize: "0.8rem", fontWeight: 700, color: STEEL }}>{stage.name}</span>
                    </div>
                    <span style={{ width: 22, height: 22, borderRadius: "50%", background: stage.color + "18", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.62rem", fontWeight: 800, color: stage.color }}>
                      {stageDeals.length}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.65rem", color: "#9ca3af", fontWeight: 600 }}>{fmtMoney(stageValue)}</div>
                </div>

                {/* Cards */}
                <div style={{
                  minHeight: 80, borderRadius: 12,
                  border: isOver ? `2px dashed ${stage.color}` : "2px solid transparent",
                  transition: "border .15s", padding: isOver ? 4 : 0,
                }}>
                  {stageDeals.map(deal => (
                    <KanbanCard
                      key={deal.id}
                      deal={deal}
                      onClick={() => setSelectedDeal(deal)}
                      onDragStart={() => setDraggingId(deal.id)}
                      isDragging={draggingId === deal.id}
                    />
                  ))}
                  {stageDeals.length === 0 && (
                    <div style={{ padding: "24px 16px", textAlign: "center", color: isOver ? stage.color : "#d1d5db", fontSize: "0.72rem", borderRadius: 10, border: `2px dashed ${isOver ? stage.color : BORDER}`, transition: "all .15s" }}>
                      {isOver ? "วางที่นี่" : "ไม่มีโอกาสการขาย"}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Drawer ── */}
      {liveSelectedDeal && (
        <DealDrawer
          deal={liveSelectedDeal}
          onClose={() => setSelectedDeal(null)}
          onEdit={() => { setEditDeal(liveSelectedDeal); setSelectedDeal(null); }}
          onDelete={() => handleDeleteDeal(liveSelectedDeal.id)}
        />
      )}

      {/* ── Add Deal Modal ── */}
      {showAddModal && (
        <DealFormModal
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddDeal}
        />
      )}

      {/* ── Edit Deal Modal ── */}
      {editDeal && (
        <DealFormModal
          initial={editDeal}
          onClose={() => setEditDeal(null)}
          onSubmit={handleEditDeal}
        />
      )}

      {/* ── Lost Reason Modal (จากการลากลงคอลัมน์ "ไม่ได้งาน") ── */}
      {pendingLostId !== null && (() => {
        const pendingDeal = deals.find(d => d.id === pendingLostId);
        if (!pendingDeal) return null;
        return (
          <LostReasonModal
            deal={pendingDeal}
            onCancel={() => setPendingLostId(null)}
            onConfirm={reason => {
              closeDeal(pendingLostId, "lost", reason);
              setPendingLostId(null);
            }}
          />
        );
      })()}
    </div>
  );
}
