"use client";

import { useState } from "react";
import { salesByMonth } from "@/lib/mock";

type DataPoint = { month: string; value: number; prevValue?: number };

type Props = {
  data?: DataPoint[];
  title?: string;
  subtitle?: string;
  target?: number;
};

// --- TOKENS ------------------------------------------------------
const PRIMARY = "#003366"; // navy
const AMBER = "#ECC94B"; // amber secondary
const DARK = "#2D2D2D";

// Catmull-Rom → cubic-bezier smoothing (ERP dashboard technique)
function smoothPath(pts: Array<{ x: number; y: number }>): string {
  if (pts.length < 2) return "";
  let d = `M${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  return d;
}

export function LineChartCard({
  data = salesByMonth,
  title = "ยอดขายรายเดือน",
  subtitle = "มูลค่าใบเสนอราคาที่ชนะ (ล้านบาท)",
  target,
}: Props) {
  const [hovered, setHovered] = useState<number | null>(null);

  const hasPrev = data.some((d) => d.prevValue !== undefined);
  const currentVals = data.map((d) => d.value);
  const prevVals = hasPrev ? data.map((d) => d.prevValue ?? 0) : [];
  const rawMax = Math.max(...currentVals, ...prevVals, target ?? 0);
  const rawMin = Math.min(...currentVals, ...prevVals);

  const span = rawMax - rawMin || rawMax || 1;
  const niceStep = (s: number) => {
    const rough = s / 4;
    const mag = Math.pow(10, Math.floor(Math.log10(rough)));
    const norm = rough / mag;
    const stepNorm = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
    return stepNorm * mag;
  };
  const step = niceStep(span) || 1;
  const flooredMin = Math.floor(rawMin / step) * step;
  const safeBaseline = Math.max(0, flooredMin >= rawMin ? flooredMin - step : flooredMin);
  const ceiling = Math.ceil((rawMax * 1.06) / step) * step;
  const range = ceiling - safeBaseline || 1;
  const tickCount = 4;
  const yTicks = Array.from({ length: tickCount + 1 }, (_, i) => safeBaseline + (range / tickCount) * i);

  function fmtM(v: number) {
    const r = Math.round(v * 10) / 10;
    return `฿${r % 1 === 0 ? r : r.toFixed(1)}M`;
  }

  const W = 1180;
  const H = 360;
  const pL = 64;
  const pR = 32;
  const pT = 30;
  const pB = 50;
  const cW = W - pL - pR;
  const cH = H - pT - pB;

  const n = data.length;
  const cx = (i: number) => (n <= 1 ? pL + cW / 2 : pL + (i / (n - 1)) * cW);
  const cy = (v: number) => pT + (1 - (v - safeBaseline) / range) * cH;

  const pts = data.map((d, i) => ({ x: cx(i), y: cy(d.value), ...d }));
  const prev = hasPrev ? data.map((d, i) => ({ x: cx(i), y: cy(d.prevValue ?? 0) })) : [];

  const bottomY = pT + cH;
  const linePath = smoothPath(pts);
  const prevLinePath = prev.length ? smoothPath(prev) : "";
  const areaPath = pts.length
    ? `${linePath} L${pts[pts.length - 1].x.toFixed(2)},${bottomY} L${pts[0].x.toFixed(2)},${bottomY} Z`
    : "";

  const targetY = target !== undefined ? cy(target) : null;
  const lastPt = pts[pts.length - 1];
  const hp = hovered !== null ? pts[hovered] : null;

  const legend: Array<{ label: string; color: string; dashed: boolean }> = [
    { label: "เดือนนี้", color: PRIMARY, dashed: false },
  ];
  if (hasPrev) legend.push({ label: "ปีก่อน", color: AMBER, dashed: true });
  if (target !== undefined) legend.push({ label: "เป้าหมาย", color: AMBER, dashed: true });

  return (
    <div className="card">
      {/* Header */}
      <div className="card-header">
        <div>
          <div className="card-title">{title}</div>
          <div className="card-desc">{subtitle}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <select
            style={{
              fontSize: "0.74rem", border: "1px solid var(--border)", borderRadius: 99,
              padding: "5px 14px", color: DARK, background: "#fff", outline: "none", cursor: "pointer",
            }}
          >
            <option>รายเดือน</option>
            <option>รายไตรมาส</option>
          </select>
          <button type="button" aria-label="ตัวเลือกเพิ่มเติม"
            style={{ display:"flex", alignItems:"center", justifyContent:"center", width:30, height:30, borderRadius:8, border:"none", background:"transparent", color:"#9ca3af", cursor:"pointer", padding:0 }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
              <circle cx="9" cy="3.5" r="1.5" />
              <circle cx="9" cy="9" r="1.5" />
              <circle cx="9" cy="14.5" r="1.5" />
            </svg>
          </button>
        </div>
      </div>

      {/* SVG */}
      <div className="card-body" style={{ width: "100%", overflow: "visible" }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ display: "block", width: "100%", height: "auto", overflow: "visible" }}
          role="img"
          aria-label={title}
        >
          <defs>
            {/* Area gradient under navy line — navy → transparent */}
            <linearGradient id="lc-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={PRIMARY} stopOpacity="0.28" />
              <stop offset="95%" stopColor={PRIMARY} stopOpacity="0" />
            </linearGradient>
            {/* Line reveal — animated clipPath rect (ERP technique) */}
            <clipPath id="lc-reveal">
              <rect x={pL} y="0" height={H} width="0">
                <animate
                  attributeName="width" from="0" to={W - pR - pL + 6}
                  dur="1.2s" fill="freeze" calcMode="spline"
                  keyTimes="0;1" keySplines="0.4 0 0.2 1"
                />
              </rect>
            </clipPath>
            <filter id="lc-shadow" x="-20%" y="-40%" width="140%" height="180%">
              <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#0a1628" floodOpacity="0.10" />
            </filter>
            <filter id="lc-shadow-sm" x="-20%" y="-40%" width="140%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="2.5" floodColor="#0a1628" floodOpacity="0.09" />
            </filter>
          </defs>

          {/* Faint horizontal grid rules */}
          {yTicks.map((v, i) => {
            const yp = cy(v);
            return (
              <g key={i}>
                <line x1={pL} y1={yp} x2={W - pR} y2={yp} stroke="#eef0f3" strokeWidth="0.8" strokeDasharray={i === 0 ? "0" : "3 3"} />
                <text x={pL - 14} y={yp + 4} textAnchor="end" fontSize="11.5" fill="#b0b4be" fontWeight="400">
                  {fmtM(v)}
                </text>
              </g>
            );
          })}

          {/* Baseline axis */}
          <line x1={pL} y1={bottomY} x2={W - pR} y2={bottomY} stroke="#e2e5ea" strokeWidth="1" />

          {/* Target line — amber dashed, label pinned to right edge */}
          {targetY !== null && (
            <g>
              <line
                x1={pL} y1={targetY} x2={W - pR} y2={targetY}
                stroke={AMBER} strokeWidth="1.6" strokeDasharray="5,4" opacity="0.9"
              />
              <text
                x={W - pR - 6} y={targetY - 8}
                textAnchor="end" fontSize="11.5" fill="#b7892a" fontWeight="600"
              >
                เป้าหมาย: {fmtM(target as number)}
              </text>
            </g>
          )}

          {/* Reveal-clipped: area + lines animate in left→right */}
          <g clipPath="url(#lc-reveal)">
            {/* Area fill — fades in after reveal */}
            {areaPath && <path d={areaPath} fill="url(#lc-area)" className="chart-area-fill" />}

            {/* Previous year — amber dashed comparison line */}
            {hasPrev && prevLinePath && (
              <path
                d={prevLinePath} fill="none"
                stroke={AMBER} strokeWidth="2"
                strokeDasharray="5,4" strokeLinejoin="round" strokeLinecap="round"
              />
            )}

            {/* This year — solid navy */}
            {linePath && (
              <path
                d={linePath} fill="none"
                stroke={PRIMARY} strokeWidth="2.5"
                strokeLinejoin="round" strokeLinecap="round"
              />
            )}
          </g>

          {/* End-dot pop */}
          {!hp && lastPt && (
            <circle
              cx={lastPt.x} cy={lastPt.y} r="5"
              fill={PRIMARY} stroke="#fff" strokeWidth="2"
              className="chart-dot-end"
            />
          )}

          {/* X-axis month labels */}
          {pts.map((p) => (
            <text key={p.month} x={p.x} y={H - pB + 26} textAnchor="middle" fontSize="12" fill="#b0b4be">
              {p.month}
            </text>
          ))}

          {/* Latest-value callout — shadow only, navy accent */}
          {!hp && lastPt && (() => {
            const v = lastPt.value;
            const isAbove = target !== undefined && v >= target;
            const label = fmtM(v);
            const boxW = 72;
            const boxH = 28;
            const boxLeft = Math.min(Math.max(lastPt.x - boxW / 2, pL), W - pR - boxW);
            const boxTop = lastPt.y - boxH - 16;
            return (
              <g style={{ pointerEvents: "none" }}>
                <rect
                  x={boxLeft} y={boxTop} width={boxW} height={boxH} rx="9"
                  fill="white" stroke="none" filter="url(#lc-shadow)"
                />
                <rect
                  x={boxLeft} y={boxTop} width="3.5" height={boxH} rx="2"
                  fill={PRIMARY}
                />
                <text
                  x={boxLeft + boxW / 2 + 1} y={boxTop + boxH / 2 + 5}
                  textAnchor="middle" fontSize="13.5"
                  fill={isAbove ? PRIMARY : DARK} fontWeight="800"
                >
                  {label}
                </text>
              </g>
            );
          })()}

          {/* Hover crosshair */}
          {hp && (
            <g style={{ pointerEvents: "none" }}>
              <line x1={hp.x} y1={pT} x2={hp.x} y2={bottomY} stroke="#c4cbd4" strokeWidth="1" strokeDasharray="3,3" />
              <circle cx={hp.x} cy={hp.y} r="4.5" fill={PRIMARY} stroke="#fff" strokeWidth="2" />
            </g>
          )}

          {/* Hover tooltip — shadow only */}
          {hp && (() => {
            const prevV = hovered !== null ? data[hovered].prevValue : undefined;
            const tW = 120;
            const tH = prevV !== undefined ? 52 : 34;
            const tx = Math.min(Math.max(hp.x - tW / 2, pL + 2), W - pR - tW - 2);
            const ty = Math.max(hp.y - tH - 16, pT + 2);
            const chg = prevV !== undefined && prevV !== 0
              ? Math.round(((hp.value - prevV) / prevV) * 100) : null;
            return (
              <g style={{ pointerEvents: "none" }}>
                <rect x={tx} y={ty} width={tW} height={tH} rx="9"
                  fill="white" stroke="none" filter="url(#lc-shadow-sm)" />
                <text x={tx + tW / 2} y={ty + 22} textAnchor="middle"
                  fontSize="13.5" fill={DARK} fontWeight="800">
                  {fmtM(hp.value)}
                </text>
                {chg !== null && (
                  <text x={tx + tW / 2} y={ty + 40} textAnchor="middle"
                    fontSize="11" fill={chg >= 0 ? "#059669" : "#dc2626"}>
                    {chg >= 0 ? "▲" : "▼"} {Math.abs(chg)}% เทียบปีก่อน
                  </text>
                )}
              </g>
            );
          })()}

          {/* Hover zones */}
          {pts.map((p, i) => {
            const half = n > 1 ? cW / (n - 1) / 2 : cW / 2;
            return (
              <rect
                key={`hz-${p.month}`}
                x={p.x - half} y={pT} width={half * 2} height={cH}
                fill="transparent" style={{ cursor: "crosshair" }}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              />
            );
          })}
        </svg>

        {/* Legend — minimal */}
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 24, marginTop: 16 }}>
          {legend.map((l) => (
            <span key={l.label} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: "0.72rem", color: "var(--muted-foreground)" }}>
              <span style={{
                display: "inline-block", width: 20, height: 0,
                borderTop: `${l.dashed ? "1.8px dashed" : "2.5px solid"} ${l.color}`,
              }} />
              {l.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
