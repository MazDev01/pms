"use client";

import { useState } from "react";
import { hqAnnouncements, HQAnnouncement, AnnouncementCategory } from "@/lib/mock";
import { Plus, Pin, Bell, Tag, Megaphone, X, ChevronDown } from "lucide-react";

const PRIMARY = "#003366";

// Category badge tints (CI palette + semantic — no ERP red)
function categoryBadgeStyle(cat: AnnouncementCategory): React.CSSProperties {
  switch (cat) {
    case "ราคา":
      return { background: "#fee2e2", color: "#dc2626" };
    case "โปรโมชั่น":
      return { background: "#fff3cd", color: "#d97706" };
    case "นโยบาย":
      return { background: "#dce5f0", color: PRIMARY };
    case "ทั่วไป":
    default:
      return { background: "#f4f6f9", color: "#6b7280" };
  }
}

type FilterCategory = "ทั้งหมด" | AnnouncementCategory;

const FILTER_TABS: FilterCategory[] = ["ทั้งหมด", "ราคา", "โปรโมชั่น", "นโยบาย", "ทั่วไป"];

export default function HQAnnouncementsPage() {
  const [selectedCategory, setSelectedCategory] = useState<FilterCategory>("ทั้งหมด");
  const [showModal, setShowModal] = useState(false);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formCategory, setFormCategory] = useState<AnnouncementCategory>("ทั่วไป");
  const [formBody, setFormBody] = useState("");
  const [formTarget, setFormTarget] = useState("all");
  const [formPinned, setFormPinned] = useState(false);

  const totalCount = hqAnnouncements.length;
  const pinnedCount = hqAnnouncements.filter((a) => a.pinned).length;
  const specificBranchCount = hqAnnouncements.filter(
    (a) => a.targetBranches !== "all"
  ).length;

  const filtered = hqAnnouncements
    .filter((a) =>
      selectedCategory === "ทั้งหมด" ? true : a.category === selectedCategory
    )
    .sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    });

  function handleSave() {
    if (!formTitle.trim()) return;
    setShowModal(false);
    setFormTitle("");
    setFormCategory("ทั่วไป");
    setFormBody("");
    setFormTarget("all");
    setFormPinned(false);
  }

  function handleCloseModal() {
    setShowModal(false);
    setFormTitle("");
    setFormCategory("ทั่วไป");
    setFormBody("");
    setFormTarget("all");
    setFormPinned(false);
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function branchLabel(targetBranches: "all" | string[]) {
    if (targetBranches === "all") return "ทุกสาขา";
    return (targetBranches as string[]).join(", ");
  }

  return (
    <div className="erp">
      {/* Header */}
      <div className="page-head">
        <div>
          <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Megaphone size={22} strokeWidth={2} color={PRIMARY} />
            ประกาศ/แจ้งเวียน
          </h2>
          <p>แจ้งเวียนประกาศจากสำนักงานใหญ่ถึงดีลเลอร์ทุกสาขา</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary btn-md">
          <Plus size={14} strokeWidth={2} />
          สร้างประกาศ
        </button>
      </div>

      {/* Stats row */}
      <div className="kpi-bar" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {/* Total */}
        <div className="kpi" style={{ flexDirection: "row", alignItems: "center" }}>
          <div className="kpi-icon kpi-navy">
            <Bell size={18} strokeWidth={2} />
          </div>
          <div>
            <div className="kpi-val">{totalCount}</div>
            <div className="kpi-label">ประกาศทั้งหมด</div>
          </div>
        </div>

        {/* Pinned */}
        <div className="kpi" style={{ flexDirection: "row", alignItems: "center" }}>
          <div className="kpi-icon kpi-amber">
            <Pin size={18} strokeWidth={2} />
          </div>
          <div>
            <div className="kpi-val">{pinnedCount}</div>
            <div className="kpi-label">ปักหมุด</div>
          </div>
        </div>

        {/* Specific branches */}
        <div className="kpi" style={{ flexDirection: "row", alignItems: "center" }}>
          <div className="kpi-icon kpi-steel">
            <Tag size={18} strokeWidth={2} />
          </div>
          <div>
            <div className="kpi-val">{specificBranchCount}</div>
            <div className="kpi-label">เฉพาะบางสาขา</div>
          </div>
        </div>
      </div>

      {/* Category filter tabs */}
      <div className="tab-bar" style={{ marginBottom: "1.25rem" }}>
        {FILTER_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setSelectedCategory(tab)}
            className={`tab-item${selectedCategory === tab ? " active" : ""}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Announcement list */}
      <div>
        {filtered.length === 0 && (
          <div className="card">
            <div
              className="card-body"
              style={{
                padding: "40px 24px",
                textAlign: "center",
                color: "#6b7280",
                fontSize: "0.85rem",
              }}
            >
              ไม่พบประกาศในหมวดหมู่นี้
            </div>
          </div>
        )}
        {filtered.map((ann) => (
          <AnnouncementCard key={ann.id} ann={ann} formatDate={formatDate} branchLabel={branchLabel} />
        ))}
      </div>

      {/* Create Announcement Modal */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseModal();
          }}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: 520,
              boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
              position: "relative",
            }}
          >
            {/* Modal header */}
            <div className="card-header">
              <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Megaphone size={16} strokeWidth={2} color={PRIMARY} />
                สร้างประกาศใหม่
              </div>
              <button
                onClick={handleCloseModal}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#6b7280",
                  padding: 4,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            <div className="card-body">
              {/* Form fields */}
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Title */}
                <div>
                  <label className="form-label">
                    หัวข้อ <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="ระบุหัวข้อประกาศ..."
                    className="form-input"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="form-label">หมวดหมู่</label>
                  <div style={{ position: "relative" }}>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value as AnnouncementCategory)}
                      className="form-select"
                      style={{ appearance: "none", paddingRight: 36, cursor: "pointer" }}
                    >
                      <option value="ราคา">ราคา</option>
                      <option value="โปรโมชั่น">โปรโมชั่น</option>
                      <option value="นโยบาย">นโยบาย</option>
                      <option value="ทั่วไป">ทั่วไป</option>
                    </select>
                    <ChevronDown
                      size={14}
                      strokeWidth={2}
                      color="#6b7280"
                      style={{
                        position: "absolute",
                        right: 10,
                        top: "50%",
                        transform: "translateY(-50%)",
                        pointerEvents: "none",
                      }}
                    />
                  </div>
                </div>

                {/* Body */}
                <div>
                  <label className="form-label">เนื้อหา</label>
                  <textarea
                    rows={4}
                    value={formBody}
                    onChange={(e) => setFormBody(e.target.value)}
                    placeholder="รายละเอียดของประกาศ..."
                    className="form-textarea"
                    style={{ resize: "vertical", lineHeight: 1.6 }}
                  />
                </div>

                {/* Target */}
                <div>
                  <label className="form-label">ส่งถึง</label>
                  <div style={{ position: "relative" }}>
                    <select
                      value={formTarget}
                      onChange={(e) => setFormTarget(e.target.value)}
                      className="form-select"
                      style={{ appearance: "none", paddingRight: 36, cursor: "pointer" }}
                    >
                      <option value="all">ทุกสาขา</option>
                      <option value="specific">เฉพาะสาขา...</option>
                    </select>
                    <ChevronDown
                      size={14}
                      strokeWidth={2}
                      color="#6b7280"
                      style={{
                        position: "absolute",
                        right: 10,
                        top: "50%",
                        transform: "translateY(-50%)",
                        pointerEvents: "none",
                      }}
                    />
                  </div>
                </div>

                {/* Pinned checkbox */}
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    cursor: "pointer",
                    fontSize: "0.82rem",
                    color: "#2D2D2D",
                    fontWeight: 600,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={formPinned}
                    onChange={(e) => setFormPinned(e.target.checked)}
                    style={{ width: 16, height: 16, cursor: "pointer", accentColor: PRIMARY }}
                  />
                  <Pin size={13} strokeWidth={2} color="#d97706" />
                  ปักหมุดประกาศนี้
                </label>
              </div>

              {/* Modal actions */}
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  justifyContent: "flex-end",
                  marginTop: 22,
                  paddingTop: 16,
                  borderTop: "1px solid #e5e7eb",
                }}
              >
                <button onClick={handleCloseModal} className="btn btn-secondary btn-md">
                  ยกเลิก
                </button>
                <button
                  onClick={handleSave}
                  disabled={!formTitle.trim()}
                  className="btn btn-primary btn-md"
                  style={
                    !formTitle.trim()
                      ? { opacity: 0.5, cursor: "not-allowed", boxShadow: "none" }
                      : undefined
                  }
                >
                  บันทึก
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Announcement card component
function AnnouncementCard({
  ann,
  formatDate,
  branchLabel,
}: {
  ann: HQAnnouncement;
  formatDate: (d: string) => string;
  branchLabel: (t: "all" | string[]) => string;
}) {
  const catStyle = categoryBadgeStyle(ann.category);
  const branchText = branchLabel(ann.targetBranches);

  return (
    <div
      className="card"
      style={{
        marginBottom: 12,
        ...(ann.pinned
          ? { borderColor: "#fde68a", boxShadow: "0 2px 14px rgba(217,119,6,.10)" }
          : null),
      }}
    >
      <div className="card-body" style={{ padding: "16px 18px" }}>
        {/* Top row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 4,
          }}
        >
          {/* Category badge */}
          <span className="badge" style={catStyle}>
            {ann.category}
          </span>

          {/* Pinned badge */}
          {ann.pinned && (
            <span className="badge" style={{ background: "#fff3c7", color: "#d97706" }}>
              <Pin size={10} strokeWidth={2.5} />
              ปักหมุด
            </span>
          )}

          {/* Date right-aligned */}
          <span
            style={{
              marginLeft: "auto",
              fontSize: "0.72rem",
              color: "#6b7280",
              fontWeight: 500,
            }}
          >
            {formatDate(ann.publishedAt)}
          </span>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: "1rem",
            fontWeight: 800,
            color: "#2D2D2D",
            margin: "6px 0 4px",
            lineHeight: 1.4,
          }}
        >
          {ann.title}
        </div>

        {/* Body — 2-line clamp */}
        <div
          style={{
            fontSize: "0.8rem",
            color: "#475569",
            lineHeight: 1.6,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            textOverflow: "ellipsis",
            marginBottom: 10,
          }}
        >
          {ann.body}
        </div>

        {/* Bottom row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          {/* Author */}
          <span
            style={{
              fontSize: "0.72rem",
              color: "#6b7280",
              fontWeight: 500,
            }}
          >
            โดย {ann.author}
          </span>

          {/* Target branches chip */}
          <span className="badge" style={{ background: "#dce5f0", color: PRIMARY }}>
            <Bell size={10} strokeWidth={2.5} />
            {branchText}
          </span>
        </div>
      </div>
    </div>
  );
}
