"use client";

import { useState } from "react";
import {
  salesTemplates, TEMPLATE_TASK_CATEGORY_LABEL, TEMPLATE_TASK_CATEGORY_COLOR,
  type SalesTemplateMock, type TemplateTask, type TemplateTaskCategory,
} from "@/lib/mock";
import {
  Plus, X, Star, CheckCircle2, Circle, Trash2,
  ChevronRight, Copy, Pencil, FileText, Upload,
  Building2, Check, Lightbulb, XCircle,
} from "lucide-react";

const PRIMARY = "#003366";
const STEEL   = "#2D2D2D";
const BORDER  = "#e5e7eb";

const CATEGORIES: TemplateTaskCategory[] = ["lead", "requirement", "quotation", "followup"];

const FILE_TYPE_OPTIONS = [
  "เอกสารยืนยันความต้องการ",
  "ภาพถ่ายพื้นที่",
  "BOQ เบื้องต้น",
  "ใบเสนอราคาฉบับร่าง",
  "เอกสารอนุมัติ HQ",
  "สัญญาซื้อขาย",
];

let nextTaskId = 100;

function newTask(text: string, category: TemplateTaskCategory): TemplateTask {
  return { id: nextTaskId++, text, category };
}

function ProgressPreview({ tasks, donePct }: { tasks: TemplateTask[]; donePct: number }) {
  const color = donePct >= 80 ? "#059669" : donePct >= 50 ? PRIMARY : "#d97706";
  return (
    <div style={{ padding: "14px 16px", borderRadius: 12, background: "var(--muted)", border: `1px solid ${BORDER}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", color: "#6b7280", marginBottom: 6 }}>
        <span>ตัวอย่างความคืบหน้า</span>
        <span style={{ fontWeight: 800, color }}>{donePct}%</span>
      </div>
      <div style={{ height: 8, borderRadius: 99, background: "#e5e7eb", overflow: "hidden", marginBottom: 8 }}>
        <div className="top5-bar" style={{ height: "100%", width: `${donePct}%`, background: color, borderRadius: 99 }} />
      </div>
      <div style={{ fontSize: "0.62rem", color: "#9ca3af" }}>
        {tasks.length} งาน · ทุกงานมีน้ำหนักเท่ากัน
      </div>
    </div>
  );
}

function TaskRow({ task, onDelete, onEdit, onCategoryChange }: {
  task: TemplateTask;
  onDelete: () => void;
  onEdit: (text: string) => void;
  onCategoryChange: (c: TemplateTaskCategory) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal]         = useState(task.text);
  const [showCat, setShowCat] = useState(false);
  const cat = TEMPLATE_TASK_CATEGORY_COLOR[task.category];

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
      borderRadius: 10, border: `1px solid ${BORDER}`, background: "#fff", marginBottom: 5 }}>
      <Circle size={16} color="#d1d5db" style={{ flexShrink: 0 }} />

      {editing ? (
        <input value={val} autoFocus
          onChange={e => setVal(e.target.value)}
          onBlur={() => { onEdit(val); setEditing(false); }}
          onKeyDown={e => {
            if (e.key === "Enter") { onEdit(val); setEditing(false); }
            if (e.key === "Escape") { setVal(task.text); setEditing(false); }
          }}
          style={{ flex: 1, border: "none", outline: "none", fontSize: "0.8rem", color: STEEL, background: "transparent" }} />
      ) : (
        <span onClick={() => setEditing(true)} style={{ flex: 1, fontSize: "0.8rem", color: STEEL, cursor: "text" }}>
          {task.text}
        </span>
      )}

      <div style={{ position: "relative" }}>
        <button onClick={() => setShowCat(p => !p)}
          className="badge" style={{ background: cat.bg, color: cat.text, border: "none", cursor: "pointer" }}>
          {TEMPLATE_TASK_CATEGORY_LABEL[task.category]}
          <ChevronRight size={10} style={{ transform: "rotate(90deg)" }} />
        </button>
        {showCat && (
          <>
            <div onClick={() => setShowCat(false)} style={{ position: "fixed", inset: 0, zIndex: 10 }} />
            <div className="card" style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 11,
              boxShadow: "var(--shadow-md)", overflow: "hidden", minWidth: 130 }}>
              {CATEGORIES.map(c => {
                const cc = TEMPLATE_TASK_CATEGORY_COLOR[c];
                return (
                  <button key={c} onClick={() => { onCategoryChange(c); setShowCat(false); }}
                    style={{ display: "flex", alignItems: "center", gap: 8, width: "100%",
                      padding: "8px 10px", border: "none", background: c === task.category ? cc.bg : "#fff",
                      cursor: "pointer", textAlign: "left" }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: cc.text, flexShrink: 0 }} />
                    <span style={{ fontSize: "0.72rem", color: c === task.category ? cc.text : STEEL,
                      fontWeight: c === task.category ? 700 : 400 }}>
                      {TEMPLATE_TASK_CATEGORY_LABEL[c]}
                    </span>
                    {c === task.category && <Check size={11} color={cc.text} style={{ marginLeft: "auto" }} />}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      <button onClick={onDelete}
        style={{ background: "none", border: "none", cursor: "pointer", color: "#d1d5db", display: "flex", padding: 2, flexShrink: 0 }}
        onMouseEnter={e => (e.currentTarget.style.color = "#dc2626")}
        onMouseLeave={e => (e.currentTarget.style.color = "#d1d5db")}>
        <X size={14} />
      </button>
    </div>
  );
}

function AddTemplateModal({ onClose, onAdd }: {
  onClose: () => void;
  onAdd: (t: SalesTemplateMock) => void;
}) {
  const [name, setName]   = useState("");
  const [desc, setDesc]   = useState("");

  function submit() {
    if (!name.trim()) return;
    onAdd({
      id: Date.now(),
      name: name.trim(),
      description: desc.trim(),
      dealerCompany: "",
      isDefault: false,
      createdAt: new Date().toISOString().slice(0, 10),
      tasks: [
        newTask("บันทึกข้อมูลลูกค้าเบื้องต้น", "lead"),
        newTask("รวบรวมความต้องการของโอกาสการขาย",     "requirement"),
        newTask("จัดทำใบเสนอราคา",               "quotation"),
        newTask("ติดตามผลใบเสนอราคา",            "followup"),
      ],
      fileTypes: ["เอกสารยืนยันความต้องการ"],
    });
    onClose();
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(45,45,45,.45)", zIndex: 60 }} />
      <div style={{ position: "fixed", inset: 0, zIndex: 70, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, pointerEvents: "none" }}>
        <div onClick={e => e.stopPropagation()} className="card"
          style={{ width: "100%", maxWidth: 480, boxShadow: "var(--shadow-lg)", pointerEvents: "auto", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "18px 24px", background: PRIMARY }}>
            <div style={{ fontSize: "1rem", fontWeight: 800, color: "#fff" }}>สร้างแม่แบบใหม่</div>
            <button onClick={onClose}
              style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid rgba(255,255,255,.2)",
                background: "rgba(255,255,255,.1)", color: "#fff", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center" }}>
              <X size={14} />
            </button>
          </div>
          <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label className="form-label">ชื่อแม่แบบ *</label>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="เช่น แม่แบบโกดัง Premium" className="form-input" autoFocus />
            </div>
            <div>
              <label className="form-label">คำอธิบาย</label>
              <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2}
                placeholder="บอกว่าแม่แบบนี้เหมาะกับโอกาสการขายแบบไหน..."
                className="form-textarea" style={{ resize: "vertical", lineHeight: 1.6 }} />
            </div>
          </div>
          <div style={{ padding: "14px 24px", borderTop: `1px solid ${BORDER}`, display: "flex", gap: 8, justifyContent: "flex-end", background: "var(--muted)" }}>
            <button onClick={onClose} className="btn btn-secondary btn-md">ยกเลิก</button>
            <button onClick={submit} disabled={!name.trim()} className="btn btn-primary btn-md"
              style={!name.trim() ? { background: "#e5e7eb", color: "#9ca3af", boxShadow: "none", cursor: "not-allowed" } : undefined}>
              สร้างแม่แบบ
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export function TemplatesEditor() {
  const [templates, setTemplates]           = useState<SalesTemplateMock[]>(salesTemplates);
  const [selectedId, setSelectedId]         = useState<number>(salesTemplates[0].id);
  const [showAddModal, setShowAddModal]     = useState(false);
  const [newTaskText, setNewTaskText]       = useState("");
  const [newTaskCat, setNewTaskCat]         = useState<TemplateTaskCategory>("lead");
  const [showTaskInput, setShowTaskInput]   = useState(false);
  const [editingName, setEditingName]       = useState(false);
  const [editingDesc, setEditingDesc]       = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const tpl = templates.find(t => t.id === selectedId)!;

  function updateTemplate(patch: Partial<SalesTemplateMock>) {
    setTemplates(prev => prev.map(t => t.id === selectedId ? { ...t, ...patch } : t));
  }
  function setDefault(id: number) {
    setTemplates(prev => prev.map(t => ({ ...t, isDefault: t.id === id })));
  }
  function duplicateTemplate() {
    const copy: SalesTemplateMock = {
      ...tpl, id: Date.now(), name: `${tpl.name} (สำเนา)`,
      isDefault: false, createdAt: new Date().toISOString().slice(0, 10),
      tasks: tpl.tasks.map(t => ({ ...t, id: nextTaskId++ })),
    };
    setTemplates(prev => [...prev, copy]);
    setSelectedId(copy.id);
  }
  function deleteTemplate() {
    const remaining = templates.filter(t => t.id !== selectedId);
    setTemplates(remaining);
    setSelectedId(remaining[0]?.id ?? 0);
    setShowDeleteConfirm(false);
  }
  function addTask() {
    if (!newTaskText.trim()) return;
    updateTemplate({ tasks: [...tpl.tasks, newTask(newTaskText.trim(), newTaskCat)] });
    setNewTaskText(""); setShowTaskInput(false);
  }
  function deleteTask(taskId: number) { updateTemplate({ tasks: tpl.tasks.filter(t => t.id !== taskId) }); }
  function editTask(taskId: number, text: string) { updateTemplate({ tasks: tpl.tasks.map(t => t.id === taskId ? { ...t, text } : t) }); }
  function changeTaskCategory(taskId: number, category: TemplateTaskCategory) { updateTemplate({ tasks: tpl.tasks.map(t => t.id === taskId ? { ...t, category } : t) }); }
  function toggleFileType(ft: string) {
    const cur = tpl.fileTypes;
    updateTemplate({ fileTypes: cur.includes(ft) ? cur.filter(f => f !== ft) : [...cur, ft] });
  }

  const previewPct = tpl.tasks.length ? Math.round((Math.ceil(tpl.tasks.length / 2) / tpl.tasks.length) * 100) : 0;
  const tasksByCategory = CATEGORIES.map(cat => ({ cat, tasks: tpl.tasks.filter(t => t.category === cat) })).filter(g => g.tasks.length > 0);

  return (
    <div style={{ display: "flex", gap: 20, alignItems: "flex-start", width: "100%" }}>

      {/* ── LEFT: Template list ── */}
      <div style={{ width: 240, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontSize: "0.82rem", fontWeight: 800, color: STEEL }}>แม่แบบทั้งหมด</span>
          <button onClick={() => setShowAddModal(true)} className="btn btn-primary btn-sm">
            <Plus size={12} /> ใหม่
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {templates.map(t => {
            const isActive = t.id === selectedId;
            return (
              <div key={t.id} onClick={() => { setSelectedId(t.id); setShowDeleteConfirm(false); }}
                style={{ padding: "12px 14px", borderRadius: 12,
                  border: `1px solid ${isActive ? PRIMARY : BORDER}`,
                  background: isActive ? "#eef3f8" : "#fff",
                  cursor: "pointer", transition: "all .13s" }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "var(--muted)"; }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "#fff"; }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: "0.78rem", fontWeight: isActive ? 700 : 500, color: isActive ? PRIMARY : STEEL }}>
                    {t.name}
                  </span>
                  {t.isDefault && <Star size={12} color="#d97706" fill="#d97706" />}
                </div>
                <div style={{ fontSize: "0.62rem", color: "#6b7280" }}>{t.tasks.length} งาน · {t.createdAt}</div>
                <div style={{ marginTop: 6, height: 3, borderRadius: 99, background: "var(--muted)", overflow: "hidden" }}>
                  <div className="top5-bar" style={{ height: "100%", width: `${Math.min(100, Math.round(t.tasks.length / 9 * 100))}%`, background: PRIMARY, borderRadius: 99 }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── RIGHT: Template editor ── */}
      {tpl && (
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Header card */}
          <div className="card">
            <div className="card-body" style={{ padding: "20px 24px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                <div style={{ flex: 1 }}>
                  {editingName ? (
                    <input value={tpl.name} autoFocus
                      onChange={e => updateTemplate({ name: e.target.value })}
                      onBlur={() => setEditingName(false)}
                      onKeyDown={e => { if (e.key === "Enter" || e.key === "Escape") setEditingName(false); }}
                      style={{ fontSize: "1.2rem", fontWeight: 800, color: STEEL, border: "none",
                        borderBottom: `2px solid ${PRIMARY}`, outline: "none", background: "transparent",
                        width: "100%", paddingBottom: 2, marginBottom: 8 }} />
                  ) : (
                    <h2 onClick={() => setEditingName(true)}
                      style={{ fontSize: "1.2rem", fontWeight: 800, color: STEEL, margin: "0 0 6px",
                        cursor: "text", display: "flex", alignItems: "center", gap: 8 }}>
                      {tpl.name}
                      {tpl.isDefault && (
                        <span className="badge" style={{ background: "#fff3cd", color: "#d97706", fontSize: "0.6rem" }}>ค่าเริ่มต้น</span>
                      )}
                      <Pencil size={13} color="#9ca3af" />
                    </h2>
                  )}
                  {editingDesc ? (
                    <textarea value={tpl.description} autoFocus rows={2}
                      onChange={e => updateTemplate({ description: e.target.value })}
                      onBlur={() => setEditingDesc(false)}
                      className="form-textarea" style={{ resize: "none", lineHeight: 1.6 }} />
                  ) : (
                    <p onClick={() => setEditingDesc(true)}
                      style={{ fontSize: "0.8rem", color: tpl.description ? "#374151" : "#9ca3af",
                        margin: 0, cursor: "text", lineHeight: 1.6 }}>
                      {tpl.description || "คลิกเพื่อเพิ่มคำอธิบาย..."}
                    </p>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  {!tpl.isDefault && (
                    <button onClick={() => setDefault(tpl.id)} className="btn btn-sm"
                      style={{ border: "1px solid #d97706", background: "#fff3cd", color: "#d97706" }}>
                      <Star size={12} /> ตั้งเป็นค่าเริ่มต้น
                    </button>
                  )}
                  <button onClick={duplicateTemplate} className="btn btn-secondary btn-sm">
                    <Copy size={12} /> คัดลอก
                  </button>
                  {!showDeleteConfirm ? (
                    <button onClick={() => setShowDeleteConfirm(true)} disabled={templates.length <= 1}
                      className="btn btn-secondary btn-sm"
                      style={{ color: templates.length <= 1 ? "#e5e7eb" : "#dc2626", cursor: templates.length <= 1 ? "not-allowed" : "pointer" }}>
                      <Trash2 size={12} /> ลบ
                    </button>
                  ) : (
                    <div style={{ display: "flex", gap: 4, alignItems: "center", padding: "4px 8px",
                      borderRadius: 9, background: "#fee2e2", border: "1px solid #fca5a5" }}>
                      <span style={{ fontSize: "0.68rem", color: "#dc2626", fontWeight: 600 }}>ยืนยัน?</span>
                      <button onClick={deleteTemplate}
                        style={{ padding: "3px 8px", borderRadius: 6, border: "none", background: "#dc2626", color: "#fff", fontSize: "0.65rem", fontWeight: 700, cursor: "pointer" }}>ลบ</button>
                      <button onClick={() => setShowDeleteConfirm(false)}
                        style={{ padding: "3px 8px", borderRadius: 6, border: "none", background: "#fff", color: "#374151", fontSize: "0.65rem", cursor: "pointer" }}>ยกเลิก</button>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 10,
                background: "var(--muted)", border: `1px solid ${BORDER}`,
                display: "flex", alignItems: "center", gap: 10 }}>
                <Building2 size={15} color={PRIMARY} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: "0.7rem", color: "#6b7280", minWidth: 100 }}>ชื่อบริษัทดีลเลอร์</span>
                <input value={tpl.dealerCompany}
                  onChange={e => updateTemplate({ dealerCompany: e.target.value })}
                  placeholder="ชื่อบริษัทของคุณ"
                  style={{ flex: 1, border: "none", outline: "none", fontSize: "0.82rem",
                    fontWeight: 700, color: PRIMARY, background: "transparent" }} />
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16, alignItems: "flex-start" }}>

            {/* ── Tasks section ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="card">
                <div className="card-body" style={{ padding: "20px 24px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                    <div>
                      <div className="card-title">รายการงานขาย</div>
                      <div className="card-desc">ความคืบหน้า = งานเสร็จ / งานทั้งหมด × 100</div>
                    </div>
                    <span style={{ fontSize: "1rem", fontWeight: 900, color: PRIMARY }}>{tpl.tasks.length} งาน</span>
                  </div>

                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                    {CATEGORIES.map(c => {
                      const cc = TEMPLATE_TASK_CATEGORY_COLOR[c];
                      const count = tpl.tasks.filter(t => t.category === c).length;
                      return (
                        <span key={c} className="badge" style={{ background: cc.bg, color: cc.text }}>
                          {TEMPLATE_TASK_CATEGORY_LABEL[c]}
                          {count > 0 && (
                            <span style={{ background: cc.text, color: cc.bg, borderRadius: "50%",
                              width: 14, height: 14, display: "inline-flex", alignItems: "center",
                              justifyContent: "center", fontSize: "0.52rem", fontWeight: 800 }}>{count}</span>
                          )}
                        </span>
                      );
                    })}
                  </div>

                  {tpl.tasks.length === 0 ? (
                    <div style={{ padding: "28px 0", textAlign: "center", color: "#9ca3af", fontSize: "0.78rem",
                      border: `2px dashed ${BORDER}`, borderRadius: 10, marginBottom: 10 }}>
                      ยังไม่มีรายการงาน — กด + เพิ่มงาน
                    </div>
                  ) : (
                    <div style={{ marginBottom: 10 }}>
                      {tpl.tasks.map(task => (
                        <TaskRow key={task.id} task={task}
                          onDelete={() => deleteTask(task.id)}
                          onEdit={text => editTask(task.id, text)}
                          onCategoryChange={c => changeTaskCategory(task.id, c)} />
                      ))}
                    </div>
                  )}

                  {showTaskInput ? (
                    <div style={{ display: "flex", gap: 6, alignItems: "flex-end", marginTop: 8 }}>
                      <div style={{ flex: 1 }}>
                        <input value={newTaskText} autoFocus onChange={e => setNewTaskText(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") addTask(); if (e.key === "Escape") { setShowTaskInput(false); setNewTaskText(""); } }}
                          placeholder="พิมพ์ชื่องาน..." className="form-input" />
                      </div>
                      <select value={newTaskCat} onChange={e => setNewTaskCat(e.target.value as TemplateTaskCategory)}
                        className="form-select" style={{ width: "auto", fontSize: "0.72rem" }}>
                        {CATEGORIES.map(c => <option key={c} value={c}>{TEMPLATE_TASK_CATEGORY_LABEL[c]}</option>)}
                      </select>
                      <button onClick={addTask} className="btn btn-primary btn-sm">เพิ่ม</button>
                      <button onClick={() => { setShowTaskInput(false); setNewTaskText(""); }} className="btn btn-secondary btn-sm">ยกเลิก</button>
                    </div>
                  ) : (
                    <button onClick={() => setShowTaskInput(true)} className="btn btn-ghost btn-sm" style={{ color: PRIMARY, padding: "4px 0" }}>
                      <Plus size={14} /> เพิ่มรายการงาน
                    </button>
                  )}
                </div>
              </div>

              <div className="card">
                <div className="card-body" style={{ padding: "20px 24px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                    <Upload size={16} color={PRIMARY} />
                    <div>
                      <div className="card-title">ประเภทไฟล์ที่ต้องเก็บ</div>
                      <div className="card-desc">เอกสารหลักฐานที่ต้องอัปโหลดในแต่ละโอกาสการขาย</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {FILE_TYPE_OPTIONS.map(ft => {
                      const selected = tpl.fileTypes.includes(ft);
                      return (
                        <button key={ft} onClick={() => toggleFileType(ft)}
                          style={{ display: "flex", alignItems: "center", gap: 5,
                            padding: "6px 12px", borderRadius: 99, fontSize: "0.72rem", fontWeight: 600,
                            border: `1px solid ${selected ? PRIMARY : BORDER}`,
                            background: selected ? "#dce5f0" : "#fff",
                            color: selected ? PRIMARY : "#374151", cursor: "pointer" }}>
                          {selected && <Check size={11} />}
                          {ft}
                        </button>
                      );
                    })}
                  </div>
                  {tpl.fileTypes.length > 0 && (
                    <div style={{ marginTop: 10, fontSize: "0.65rem", color: "#6b7280" }}>เลือกแล้ว {tpl.fileTypes.length} ประเภท</div>
                  )}
                </div>
              </div>

              <div className="card">
                <div className="card-body" style={{ padding: "20px 24px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                    <CheckCircle2 size={16} color="#059669" />
                    <div>
                      <div className="card-title">ผลลัพธ์โอกาสการขาย</div>
                      <div className="card-desc">ปลายทางของทุกโอกาสการขาย — บันทึกเข้า HQ อัตโนมัติ</div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div style={{ padding: "14px 16px", borderRadius: 12, background: "#f0fdf4", border: "1px solid #bbf7d0", display: "flex", flexDirection: "column", gap: 4 }}>
                      <CheckCircle2 size={20} color="#15803d" />
                      <div style={{ fontSize: "0.82rem", fontWeight: 800, color: "#15803d" }}>ลูกค้าเอา</div>
                      <div style={{ fontSize: "0.65rem", color: "#16a34a", lineHeight: 1.5 }}>ปิดการขายสำเร็จ · สถานะเปลี่ยนเป็นปิดสำเร็จ · ส่ง HQ</div>
                    </div>
                    <div style={{ padding: "14px 16px", borderRadius: 12, background: "#fee2e2", border: "1px solid #fca5a5", display: "flex", flexDirection: "column", gap: 4 }}>
                      <XCircle size={20} color="#dc2626" />
                      <div style={{ fontSize: "0.82rem", fontWeight: 800, color: "#dc2626" }}>ลูกค้าไม่เอา</div>
                      <div style={{ fontSize: "0.65rem", color: "#dc2626", lineHeight: 1.5 }}>บันทึกเหตุผล · สถานะเปลี่ยนเป็นไม่สำเร็จ · ส่ง HQ</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Right preview panel ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="card">
                <div className="card-body" style={{ padding: "18px 20px" }}>
                  <div style={{ fontSize: "0.72rem", fontWeight: 800, color: STEEL, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    ตัวอย่างการ์ดโอกาสการขาย
                  </div>
                  <div style={{ padding: "14px 16px", borderRadius: 12, background: "var(--muted)", border: `1px solid ${BORDER}`, marginBottom: 10 }}>
                    <div style={{ fontSize: "0.72rem", fontWeight: 700, color: PRIMARY, marginBottom: 2 }}>บจ. ลูกค้าตัวอย่าง</div>
                    <div style={{ fontSize: "0.65rem", color: "#6b7280", marginBottom: 10 }}>โอกาสการขายตัวอย่าง</div>
                    <ProgressPreview tasks={tpl.tasks} donePct={previewPct} />
                  </div>
                  <div style={{ fontSize: "0.62rem", color: "#9ca3af", textAlign: "center" }}>
                    จำลอง {Math.ceil(tpl.tasks.length / 2)}/{tpl.tasks.length} งานเสร็จ
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-body" style={{ padding: "18px 20px" }}>
                  <div style={{ fontSize: "0.72rem", fontWeight: 800, color: STEEL, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    สรุปรายการงาน
                  </div>
                  {tasksByCategory.length === 0 ? (
                    <div style={{ fontSize: "0.75rem", color: "#9ca3af", textAlign: "center", padding: "16px 0" }}>ยังไม่มีรายการงาน</div>
                  ) : (
                    tasksByCategory.map(({ cat, tasks }) => {
                      const cc = TEMPLATE_TASK_CATEGORY_COLOR[cat];
                      return (
                        <div key={cat} style={{ marginBottom: 12 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: cc.text, flexShrink: 0 }} />
                            <span style={{ fontSize: "0.65rem", fontWeight: 700, color: cc.text, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                              {TEMPLATE_TASK_CATEGORY_LABEL[cat]} ({tasks.length})
                            </span>
                          </div>
                          {tasks.map(t => (
                            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 6px", marginBottom: 2 }}>
                              <Circle size={10} color="#d1d5db" style={{ flexShrink: 0 }} />
                              <span style={{ fontSize: "0.7rem", color: "#374151" }}>{t.text}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div style={{ padding: "12px 14px", borderRadius: 12, background: "#dce5f0", border: `1px solid ${PRIMARY}33`, fontSize: "0.68rem", color: PRIMARY, lineHeight: 1.7 }}>
                <div style={{ fontWeight: 800, marginBottom: 4, display: "flex", alignItems: "center", gap: 5 }}>
                  <Lightbulb size={13} /> วิธีใช้
                </div>
                ไปที่ <strong>ผู้สนใจ</strong> → กด "เปิดโอกาสการขาย" → ระบบสร้างโอกาสการขายพร้อมงานจากแม่แบบค่าเริ่มต้นอัตโนมัติ
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <AddTemplateModal
          onClose={() => setShowAddModal(false)}
          onAdd={t => { setTemplates(p => [...p, t]); setSelectedId(t.id); }}
        />
      )}
    </div>
  );
}
