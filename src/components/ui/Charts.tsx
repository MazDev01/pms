"use client";

import { useState, useEffect } from "react";
import { NAVY, SILVER, STEEL } from "@/lib/theme";

// เพดานแกน Y แบบ "nice number" — ปรับตามขนาดข้อมูลจริง เพื่อให้เส้นเต็มกราฟทั้งค่าน้อย (รายวัน) และค่ามาก (รายเดือน)
function niceCeil(v: number): number {
  if (!isFinite(v) || v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find(s => n <= s) ?? 10;
  return step * pow;
}

// Catmull-Rom → cubic-bezier smoothing
function smoothPath(pts: Array<{ x: number; y: number }>): string {
  if (pts.length < 2) return "";
  let d = `M${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  return d;
}

export type AreaPoint = { month: string; value: number; prevValue?: number };

/** Area / line chart — navy fill + silver dashed comparison + optional target line. */
export function AreaChart({ data, target, unit = "M" }: { data: AreaPoint[]; target?: number; unit?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  // trigger the draw animation on the client after mount (reliable across browsers)
  const [drawn, setDrawn] = useState(false);
  useEffect(() => { const t = setTimeout(() => setDrawn(true), 60); return () => clearTimeout(t); }, []);
  const hasPrev = data.some(d => d.prevValue !== undefined);

  const vals = data.map(d => d.value);
  const prevVals = hasPrev ? data.map(d => d.prevValue ?? 0) : [];
  const rawMax = Math.max(...vals, ...prevVals, target ?? 0);
  const ceiling = niceCeil(rawMax * 1.08);

  const W = 1180, H = 320, pL = 56, pR = 28, pT = 24, pB = 40;
  const cW = W - pL - pR, cH = H - pT - pB, n = data.length;
  const cx = (i: number) => (n <= 1 ? pL + cW / 2 : pL + (i / (n - 1)) * cW);
  const cy = (v: number) => pT + (1 - v / ceiling) * cH;

  const pts = data.map((d, i) => ({ x: cx(i), y: cy(d.value), ...d }));
  const prev = hasPrev ? data.map((d, i) => ({ x: cx(i), y: cy(d.prevValue ?? 0) })) : [];
  const bottomY = pT + cH;
  const linePath = smoothPath(pts);
  const areaPath = pts.length ? `${linePath} L${pts[n - 1].x.toFixed(2)},${bottomY} L${pts[0].x.toFixed(2)},${bottomY} Z` : "";
  const targetY = target !== undefined ? cy(target) : null;
  const last = pts[n - 1];
  const hp = hover !== null ? pts[hover] : null;
  const fmt = (v: number) => `฿${Math.round(v * 10) / 10}${unit}`;
  const yTicks = Array.from({ length: 5 }, (_, i) => (ceiling / 4) * i);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ display: "block", width: "100%", height: "auto", overflow: "visible" }} role="img" aria-label="chart">
      <defs>
        <linearGradient id="pms1-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={NAVY} stopOpacity="0.26" />
          <stop offset="95%" stopColor={NAVY} stopOpacity="0" />
        </linearGradient>
      </defs>

      {yTicks.map((v, i) => (
        <g key={i}>
          <line x1={pL} y1={cy(v)} x2={W - pR} y2={cy(v)} stroke="#eef1f5" strokeWidth="1" strokeDasharray={i === 0 ? "0" : "3 3"} />
          <text x={pL - 12} y={cy(v) + 4} textAnchor="end" fontSize="11" fill="#aab2bd">{fmt(v)}</text>
        </g>
      ))}

      {targetY !== null && (
        <g>
          <line x1={pL} y1={targetY} x2={W - pR} y2={targetY} stroke="var(--gold,#ECC94B)" strokeWidth="1.6" strokeDasharray="5,4" opacity="0.9" />
          <text x={W - pR - 4} y={targetY - 7} textAnchor="end" fontSize="11" fill="#b7892a" fontWeight="600">เป้าหมาย: {fmt(target as number)}</text>
        </g>
      )}

      {/* area + comparison line — fade in */}
      <g style={{ opacity: drawn ? 1 : 0, transition: "opacity 0.9s ease 0.2s" }}>
        {areaPath && <path d={areaPath} fill="url(#pms1-area)" />}
        {hasPrev && prev.length > 0 && <path d={smoothPath(prev)} fill="none" stroke={SILVER} strokeWidth="2" strokeDasharray="5,4" strokeLinecap="round" />}
      </g>

      {/* main line — draws itself left→right via stroke-dashoffset transition */}
      {linePath && (
        <path d={linePath} fill="none" stroke={NAVY} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"
          pathLength={1} strokeDasharray={1} strokeDashoffset={drawn ? 0 : 1}
          style={{ transition: "stroke-dashoffset 1.15s cubic-bezier(0.4, 0, 0.2, 1)" }} />
      )}

      {!hp && last && (
        <circle cx={last.x} cy={last.y} r="5" fill={NAVY} stroke="#fff" strokeWidth="2"
          style={{ opacity: drawn ? 1 : 0, transition: "opacity 0.3s ease 1s" }} />
      )}

      {pts.map(p => (
        <text key={p.month} x={p.x} y={H - pB + 24} textAnchor="middle" fontSize="11.5" fill="#aab2bd">{p.month}</text>
      ))}

      {hp && (
        <g style={{ pointerEvents: "none" }}>
          <line x1={hp.x} y1={pT} x2={hp.x} y2={bottomY} stroke="#c4cbd4" strokeWidth="1" strokeDasharray="3,3" />
          <circle cx={hp.x} cy={hp.y} r="4.5" fill={NAVY} stroke="#fff" strokeWidth="2" />
          <rect x={Math.min(Math.max(hp.x - 46, pL), W - pR - 92)} y={Math.max(hp.y - 40, pT)} width="92" height="28" rx="8" fill={STEEL} />
          <text x={Math.min(Math.max(hp.x - 46, pL), W - pR - 92) + 46} y={Math.max(hp.y - 40, pT) + 18} textAnchor="middle" fontSize="12.5" fill="#fff" fontWeight="800">{fmt(hp.value)}</text>
        </g>
      )}

      {pts.map((p, i) => {
        const half = n > 1 ? cW / (n - 1) / 2 : cW / 2;
        return <rect key={`hz-${p.month}`} x={p.x - half} y={pT} width={half * 2} height={cH} fill="transparent" style={{ cursor: "crosshair" }}
          onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />;
      })}
    </svg>
  );
}

export type BarPoint = { label: string; actual: number; plan: number };

/** Grouped bar chart — actual (navy) vs plan (silver), exceeded month highlighted. */
export function PlanVsActualBars({ data, unit = "M" }: { data: BarPoint[]; unit?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...data.flatMap(d => [d.actual, d.plan]), 1) * 1.15;
  const W = 700, H = 210, pL = 34, pR = 12, pT = 16, pB = 34;
  const cW = W - pL - pR, cH = H - pT - pB, n = data.length;
  const slot = cW / n;
  const bw = Math.min(20, slot / 3);
  const yAt = (v: number) => pT + (1 - v / max) * cH;
  const baseY = pT + cH;
  const fmt = (v: number) => `฿${Math.round(v * 10) / 10}${unit}`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => max * t);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ display: "block", width: "100%", height: "auto", overflow: "visible" }} role="img" aria-label="plan vs actual">
      {ticks.map((v, i) => (
        <g key={i}>
          <line x1={pL} y1={yAt(v)} x2={W - pR} y2={yAt(v)} stroke="#eef1f5" strokeWidth="1" strokeDasharray={i === 0 ? "0" : "3 3"} />
          <text x={pL - 6} y={yAt(v) + 3} textAnchor="end" fontSize="9.5" fill="#aab2bd">{Math.round(v * 10) / 10}</text>
        </g>
      ))}
      {data.map((d, i) => {
        const cx = pL + slot * i + slot / 2;
        const exceeded = d.actual > d.plan;
        const aH = d.actual > 0 ? baseY - yAt(d.actual) : 0;
        const pH = baseY - yAt(d.plan);
        return (
          <g key={d.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <rect x={cx - slot / 2} y={pT} width={slot} height={cH} fill="transparent" />
            {/* actual (navy) */}
            <rect x={cx - bw - 2} y={yAt(d.actual)} width={bw} height={aH} rx={4}
              fill={exceeded ? "#003366" : "#003366"} opacity={d.actual > 0 ? 1 : 0}
              stroke={exceeded ? "#ECC94B" : "none"} strokeWidth={exceeded ? 1.5 : 0} />
            {/* plan (silver) */}
            <rect x={cx + 2} y={yAt(d.plan)} width={bw} height={pH} rx={4} fill="#C0C0C0" />
            <text x={cx} y={H - 12} textAnchor="middle" fontSize="9.5" fill="#aab2bd">{d.label}</text>
            {hover === i && (
              <g style={{ pointerEvents: "none" }}>
                <rect x={Math.min(Math.max(cx - 52, pL), W - pR - 104)} y={pT} width="104" height="40" rx="8" fill="#2D2D2D" />
                <text x={Math.min(Math.max(cx - 52, pL), W - pR - 104) + 52} y={pT + 17} textAnchor="middle" fontSize="10.5" fill="#fff" fontWeight="700">จริง {fmt(d.actual)}</text>
                <text x={Math.min(Math.max(cx - 52, pL), W - pR - 104) + 52} y={pT + 31} textAnchor="middle" fontSize="10" fill="#C0C0C0">แผน {fmt(d.plan)}</text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export type DonutSeg = { label: string; value: number; color: string };

/** Donut with centered total + arc segments. */
export function Donut({ segments, centerLabel, centerValue, size = 190 }: {
  segments: DonutSeg[]; centerLabel: string; centerValue: string; size?: number;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = size / 2 - 16, c = 2 * Math.PI * r, sw = 20;
  let offset = 0;
  return (
    <div className="donut-area" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eef1f5" strokeWidth={sw} />
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {segments.map((s, i) => {
            const len = (s.value / total) * c;
            const el = <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={sw}
              strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} strokeLinecap="butt" />;
            offset += len;
            return el;
          })}
        </g>
      </svg>
      <div className="donut-center">
        <div className="dc-lbl">{centerLabel}</div>
        <div className="dc-val">{centerValue}</div>
      </div>
    </div>
  );
}
