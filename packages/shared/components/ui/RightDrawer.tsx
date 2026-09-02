"use client";

import { useEffect, useState, type JSX, type ReactNode } from "react";
import { X } from "lucide-react";
import { PRIMARY, STEEL, SILVER } from "@pms/shared/lib/theme";
import { ย่อชื่อ } from "@pms/shared/components/ui/DetailPanel";

export type DrawerTab = { key: string; label: string; content: ReactNode };

export type RightDrawerProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /** optional action buttons rendered on the right of the header */
  headerRight?: ReactNode;
  /** รูปประจำตัว (โลโก้/รูปโปรไฟล์) — ไม่ส่งมา = ใช้ตัวย่อของชื่อเหมือนเดิม
   *  บอสแจ้ง 2 ก.ย. 69: อัปโหลดรูปแล้วในเนื้อแผงเห็นรูป แต่หัวแผงยังขึ้นตัวย่อ "ad" อยู่ */
  avatar?: string;
  tabs: DrawerTab[];
  initialTab?: string;
  /** panel width in px (default ~460) */
  width?: number;
};

/**
 * Reusable right-anchored sliding drawer — CI-styled, pure-CSS transition.
 * Renders null while closed. Header + tab bar are sticky; body scrolls.
 */
export function RightDrawer({
  open,
  onClose,
  title,
  subtitle,
  headerRight,
  avatar,
  tabs,
  initialTab,
  width = 460,
}: RightDrawerProps): JSX.Element | null {
  const firstKey = tabs[0]?.key ?? "";
  const [active, setActive] = useState<string>(initialTab ?? firstKey);
  // slide-in flag — start off-screen, then flip on next frame for the transition
  const [shown, setShown] = useState(false);

  // reseed active tab whenever the drawer (re)opens
  useEffect(() => {
    if (open) setActive(initialTab ?? tabs[0]?.key ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialTab]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Lock body scroll while open (SSR-guarded)
  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // trigger slide-in transition after mount
  useEffect(() => {
    if (!open) {
      setShown(false);
      return;
    }
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  if (!open) return null;

  const activeTab = tabs.find((t) => t.key === active) ?? tabs[0];
  const isEmptyContent =
    activeTab?.content == null ||
    activeTab.content === "" ||
    (Array.isArray(activeTab.content) && activeTab.content.length === 0);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000 }} role="dialog" aria-modal="true" aria-label={title}>
      {/* backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(45,45,45,.45)",
          opacity: shown ? 1 : 0,
          transition: "opacity .28s ease",
        }}
      />

      {/* panel — centered modal */}
      <aside
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          width,
          maxWidth: "92vw",
          height: "min(660px, calc(100vh - 48px))",
          background: "#fff",
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "0 24px 70px rgba(0,0,0,.28)",
          display: "flex",
          flexDirection: "column",
          transform: shown ? "translate(-50%,-50%) scale(1)" : "translate(-50%,-50%) scale(.96)",
          opacity: shown ? 1 : 0,
          transition: "transform .28s cubic-bezier(.4,0,.2,1), opacity .28s ease",
          fontFamily: "inherit",
        }}
      >
        {/* header (sticky, CI navy) */}
        <header
          style={{
            position: "sticky",
            top: 0,
            zIndex: 2,
            background: "linear-gradient(135deg,#003366 0%,#00284F 60%,#001B36 100%)",
            color: "#fff",
            padding: "16px 18px",
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          {/* มีรูปก็โชว์รูป · ไม่มีค่อยใช้ตัวย่อชื่อ — มาตรฐานเดียวกับแผงลูกค้าเป้าหมายทั้งเครือ */}
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" style={{
              width: 40, height: 40, borderRadius: 12, objectFit: "cover", flexShrink: 0,
              border: "1px solid rgba(255,255,255,.28)", background: "rgba(255,255,255,.14)",
            }} />
          ) : (
            <span style={{
              width: 40, height: 40, borderRadius: 12, background: "rgba(255,255,255,.14)",
              border: "1px solid rgba(255,255,255,.2)", color: "#fff", fontWeight: 800, fontSize: "0.9rem",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>{ย่อชื่อ(title)}</span>
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: "1rem",
                fontWeight: 800,
                lineHeight: 1.25,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {title}
            </div>
            {subtitle && (
              <div
                style={{
                  fontSize: "0.8rem",
                  fontWeight: 500,
                  color: "rgba(255,255,255,.72)",
                  marginTop: 2,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {subtitle}
              </div>
            )}
          </div>

          {headerRight && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>{headerRight}</div>
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            style={{
              flexShrink: 0,
              width: 32,
              height: 32,
              borderRadius: 8,
              border: "none",
              background: "rgba(255,255,255,.14)",
              color: "#fff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background .15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.26)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.14)";
            }}
          >
            <X size={17} />
          </button>
        </header>

        {/* tab bar (sticky under header) */}
        {tabs.length > 0 && (
          <nav
            style={{
              position: "sticky",
              top: 0,
              zIndex: 1,
              display: "flex",
              gap: 2,
              padding: "0 14px",
              background: "#fff",
              borderBottom: `1px solid ${SILVER}55`,
              // แท็บมีไม่กี่อัน ไม่เคยล้น — auto ทำให้บางเบราว์เซอร์กันที่ไว้ให้แถบเลื่อนจนเห็นเป็นช่องว่าง
              overflowX: "hidden",
            }}
          >
            {tabs.map((t) => {
              const on = t.key === active;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActive(t.key)}
                  style={{
                    position: "relative",
                    border: "none",
                    // ⚠️ ขีดใต้แท็บต้อง "ทับเส้นคั่น" ไม่ใช่ลอยอยู่ใต้เส้น (บอสแจ้ง 2 ก.ย. 69 ว่ามีช่องว่างขาวคั่น)
                    //    เดิมใช้ <span> วางแบบ absolute ที่ bottom:-1 ซึ่งไปตกใต้เส้นคั่นของแถบแท็บ
                    //    เห็นเป็นแถบน้ำเงินลอยห่างจากตัวหนังสือ · ใช้ borderBottom ของปุ่มเองแล้วดึงขึ้นมา 1px แทน
                    borderBottom: `3px solid ${on ? PRIMARY : "transparent"}`,
                    marginBottom: -1,
                    background: "transparent",
                    cursor: "pointer",
                    padding: "13px 14px 10px",
                    fontFamily: "inherit",
                    fontSize: "0.8rem",
                    fontWeight: on ? 800 : 600,
                    color: on ? PRIMARY : "#6b7280",
                    whiteSpace: "nowrap",
                    transition: "color .15s, border-color .15s",
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </nav>
        )}

        {/* body (scrolls) */}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "18px", color: STEEL }}>
          {isEmptyContent ? (
            <div style={{ color: "#9aa2ad", fontSize: "0.86rem", padding: "24px 0", textAlign: "center" }}>
              ไม่มีข้อมูล
            </div>
          ) : (
            activeTab?.content
          )}
        </div>
      </aside>
    </div>
  );
}

/** Labeled block used to group rows/content inside a drawer tab. */
export function DrawerSection({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  // หัวข้ออยู่นอกการ์ด · เนื้อหาอยู่ในการ์ดขอบมน — มาตรฐานเดียวกับแผงรายละเอียดฝั่ง HQ
  // (เดิมเป็นหัวข้อขีดเส้นใต้แล้วเนื้อหาลอยบนพื้นหลัง อ่านแล้วแยกกลุ่มไม่ออกเวลามีหลายหัวข้อ)
  return (
    <section style={{ marginBottom: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          fontSize: "0.62rem",
          fontWeight: 800,
          letterSpacing: ".06em",
          textTransform: "uppercase",
          color: "#64748B",
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      <div style={{
        background: "#fff",
        border: "1px solid #E7EDF4",
        borderRadius: 14,
        padding: "4px 14px",
        boxShadow: "0 1px 2px rgba(15,23,42,.04)",
      }}>
        {children}
      </div>
    </section>
  );
}

/** Label / value row for consistent key-value display inside a drawer. */
export function DrawerRow({ label, value }: { label: string; value: ReactNode }): JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 14,
        padding: "9px 0",
        borderBottom: "1px solid #F1F5F9",
      }}
    >
      <span style={{ fontSize: "0.76rem", color: "#64748B", flexShrink: 0 }}>{label}</span>
      {/* ไม่มีข้อมูล = "—" สีจาง (ห้ามเดาค่าแทน) · มีข้อมูล = ตัวหนาสีเข้ม อ่านคู่ป้ายกำกับได้ทันที */}
      <span style={{
        fontSize: "0.8rem", fontWeight: 700,
        color: value == null || value === "" ? "#94A3B8" : STEEL,
        textAlign: "right", minWidth: 0,
      }}>
        {value == null || value === "" ? "—" : value}
      </span>
    </div>
  );
}
