import type { CSSProperties } from "react";

// ─── Brand colors ─────────────────────────────────────────────────────────────
export const PRIMARY  = "#003366";   // CI Dark Blue
export const PRIMARY_D = "#002244";  // hover / active
export const PRIMARY_LT = "#dce5f0"; // tint background
export const PRIMARY_LLT = "#f0f4f8"; // lightest tint

export const STEEL  = "#2D2D2D";   // CI Steel Gray — headings / body text
export const SILVER = "#C0C0C0";   // CI Silver — decorative / dividers

// ─── Neutral palette ──────────────────────────────────────────────────────────
export const BG     = "#fafafa";   // page background
export const SURFACE = "#ffffff";  // card / panel surface
export const BORDER = "#e5e7eb";   // default border
export const MUTED  = "#6b7280";   // secondary text / labels
export const SUB    = "#374151";   // slightly darker secondary text
export const LINE   = "#f0f4f8";   // table row dividers (lighter than BORDER)

// ─── Semantic colors ──────────────────────────────────────────────────────────
export const SUCCESS     = "#059669";
export const SUCCESS_BG  = "#e5faf0";
export const WARNING     = "#f59e0b";
export const WARNING_BG  = "#fef3cd";
export const DANGER      = "#dc2626";
export const DANGER_BG   = "#fee2e2";

// ─── Shadows ──────────────────────────────────────────────────────────────────
export const SHADOW_CARD = "0 2px 14px rgba(0,0,0,.07)";
export const SHADOW_MD   = "0 6px 24px rgba(0,0,0,.12)";
export const SHADOW_LG   = "0 24px 80px rgba(0,0,0,.2)";

// ─── Typography scale ──────────────────────────────────────────────────────────
export const TEXT = {
  pageTitle:   { fontSize: "1.55rem", fontWeight: 800, color: STEEL,  lineHeight: 1.2, margin: "0 0 3px" } as CSSProperties,
  pageSubtitle:{ fontSize: "0.76rem", color: MUTED } as CSSProperties,
  statValue:   { fontSize: "1.5rem",  fontWeight: 800, lineHeight: 1 } as CSSProperties,
  statLabel:   { fontSize: "0.7rem",  fontWeight: 600, color: MUTED,  marginBottom: 6 } as CSSProperties,
  cardTitle:   { fontSize: "0.88rem", fontWeight: 800, color: STEEL } as CSSProperties,
  label:       { fontSize: "0.68rem", fontWeight: 700, color: MUTED,  textTransform: "uppercase" as const, letterSpacing: "0.04em" } as CSSProperties,
  body:        { fontSize: "0.82rem", color: STEEL } as CSSProperties,
  caption:     { fontSize: "0.72rem", color: MUTED } as CSSProperties,
  small:       { fontSize: "0.65rem", color: MUTED } as CSSProperties,
  mono:        { fontSize: "0.78rem", fontFamily: "monospace", color: PRIMARY } as CSSProperties,
};

// ─── Component style objects ───────────────────────────────────────────────────
export const CARD: CSSProperties = {
  background: SURFACE,
  borderRadius: 16,
  border: `1px solid ${BORDER}`,
  boxShadow: SHADOW_CARD,
};

export const INPUT: CSSProperties = {
  width: "100%",
  border: `1px solid ${BORDER}`,
  borderRadius: 9,
  padding: "8px 12px",
  fontSize: "0.82rem",
  color: STEEL,
  background: SURFACE,
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
};

export const FORM_LABEL: CSSProperties = {
  display: "block",
  fontSize: "0.68rem",
  fontWeight: 700,
  color: MUTED,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  marginBottom: 4,
};

// Button presets
export const BTN = {
  primary: {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "8px 18px", borderRadius: 10, border: "none",
    background: PRIMARY, color: "#fff",
    fontSize: "0.78rem", fontWeight: 700, cursor: "pointer",
    boxShadow: "0 4px 12px rgba(0,51,102,.25)",
  } as CSSProperties,
  secondary: {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "7px 14px", borderRadius: 10,
    border: `1px solid ${BORDER}`, background: SURFACE, color: STEEL,
    fontSize: "0.77rem", fontWeight: 600, cursor: "pointer",
  } as CSSProperties,
  tint: {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "7px 14px", borderRadius: 10, border: "none",
    background: PRIMARY_LT, color: PRIMARY,
    fontSize: "0.76rem", fontWeight: 700, cursor: "pointer",
  } as CSSProperties,
  danger: {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "7px 14px", borderRadius: 10,
    border: `1px solid ${DANGER_BG}`, background: SURFACE, color: DANGER,
    fontSize: "0.75rem", fontWeight: 700, cursor: "pointer",
  } as CSSProperties,
  icon: {
    width: 32, height: 32, borderRadius: 9,
    border: `1px solid ${BORDER}`, background: SURFACE, color: MUTED,
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
  } as CSSProperties,
};

// Badge presets
export const BADGE = {
  base: {
    display: "inline-flex", alignItems: "center", gap: 4,
    padding: "3px 10px", borderRadius: 99,
    fontSize: "0.68rem", fontWeight: 700, whiteSpace: "nowrap",
  } as CSSProperties,
};

// ─── Decorative avatar/category palette (on-brand, no purple/teal) ─────────────
export const BRAND_PALETTE = [
  PRIMARY, SUCCESS, WARNING, "#f04d6a", PRIMARY_D, "#8fa3b8", STEEL, SILVER,
] as const;
