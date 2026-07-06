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
export function AreaChart({ data, target, unit = "M", height }: { data: AreaPoint[]; target?: number; unit?: string; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  // trigger the draw animation on the client after mount (reliable across browsers)
  const [drawn, setDrawn] = useState(false);
  useEffect(() => { const t = setTimeout(() => setDrawn(true), 60); return () => clearTimeout(t); }, []);
  const hasPrev = data.some(d => d.prevValue !== undefined);

  const vals = data.map(d => d.value);
  const prevVals = hasPrev ? data.map(d => d.prevValue ?? 0) : [];
  const rawMax = Math.max(...vals, ...prevVals, target ?? 0);
  const ceiling = niceCeil(rawMax * 1.08);
  // พื้นแกน Y: ถ้าข้อมูลลอยสูง (ค่าต่ำสุด > 40% ของเพดาน) ยกพื้นขึ้นให้เส้นใช้พื้นที่เต็มกราฟ ไม่กระจุกแถบบน
  const rawMin = Math.min(...vals, ...(hasPrev ? prevVals : [Infinity]), target ?? Infinity);
  const floor = isFinite(rawMin) && rawMin > ceiling * 0.4 ? Math.max(0, Math.floor(rawMin * 0.85 * 2) / 2) : 0;

  const W = 1180, H = height ?? 320, pL = 56, pR = 28, pT = 24, pB = 40;
  const cW = W - pL - pR, cH = H - pT - pB, n = data.length;
  const cx = (i: number) => (n <= 1 ? pL + cW / 2 : pL + (i / (n - 1)) * cW);
  const cy = (v: number) => pT + (1 - (v - floor) / (ceiling - floor)) * cH;

  const pts = data.map((d, i) => ({ x: cx(i), y: cy(d.value), ...d }));
  const prev = hasPrev ? data.map((d, i) => ({ x: cx(i), y: cy(d.prevValue ?? 0) })) : [];
  const bottomY = pT + cH;
  const linePath = smoothPath(pts);
  const areaPath = pts.length ? `${linePath} L${pts[n - 1].x.toFixed(2)},${bottomY} L${pts[0].x.toFixed(2)},${bottomY} Z` : "";
  const targetY = target !== undefined ? cy(target) : null;
  const last = pts[n - 1];
  const hp = hover !== null ? pts[hover] : null;
  const fmt = (v: number) => `฿${Math.round(v * 10) / 10}${unit}`;
  const yTicks = Array.from({ length: 5 }, (_, i) => floor + ((ceiling - floor) / 4) * i);

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
              fill={exceeded ? "#059669" : NAVY} opacity={d.actual > 0 ? 1 : 0}
              stroke={exceeded ? "#ECC94B" : "none"} strokeWidth={exceeded ? 1.5 : 0} />
            {/* plan (silver) */}
            <rect x={cx + 2} y={yAt(d.plan)} width={bw} height={pH} rx={4} fill={SILVER} />
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

/** Donut with centered total + arc segments — กวาด (sweep) จาก 0 → เต็มตอน mount */
export function Donut({ segments, centerLabel, centerValue, size = 190 }: {
  segments: DonutSeg[]; centerLabel: string; centerValue: string; size?: number;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = size / 2 - 16, c = 2 * Math.PI * r, sw = 20;
  // sweep: เริ่มทุก segment ยาว 0 แล้วขยายเข้าตำแหน่งจริงพร้อมกัน (transition dasharray/dashoffset)
  const [drawn, setDrawn] = useState(false);
  useEffect(() => { const t = setTimeout(() => setDrawn(true), 60); return () => clearTimeout(t); }, []);
  let offset = 0;
  return (
    <div className="donut-area" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eef1f5" strokeWidth={sw} />
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {segments.map((s, i) => {
            const len = (s.value / total) * c;
            const el = <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={sw}
              strokeDasharray={drawn ? `${len} ${c - len}` : `0 ${c}`}
              strokeDashoffset={drawn ? -offset : 0}
              strokeLinecap="butt"
              style={{ transition: "stroke-dasharray 0.9s cubic-bezier(0.4,0,0.2,1), stroke-dashoffset 0.9s cubic-bezier(0.4,0,0.2,1)" }} />;
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

/** Area – Gradient (สไตล์ shadcn) — เส้นเดี่ยวเรียบ + gradient นุ่ม + tooltip ตอน hover
 *  สะอาดกว่า AreaChart เดิม (ไม่มีเส้นประเปรียบเทียบที่ทำให้ดูรก) · data = {month,value} */
export function AreaGradientChart({
  data, unit = "M", height = 320,
}: {
  data: { month: string; value: number }[];
  unit?: string; height?: number;
}) {
  const [drawn, setDrawn] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => { const t = setTimeout(() => setDrawn(true), 60); return () => clearTimeout(t); }, []);

  const n = data.length;
  const vals = data.map(d => d.value);
  const ceiling = niceCeil(Math.max(...vals, 1) * 1.12);
  const W = 1180, H = height, pL = 56, pR = 26, pT = 22, pB = 40;
  const cW = W - pL - pR, cH = H - pT - pB;
  const cx = (i: number) => (n <= 1 ? pL + cW / 2 : pL + (i / (n - 1)) * cW);
  const cy = (v: number) => pT + (1 - v / ceiling) * cH;
  const bottomY = pT + cH;
  const pts = data.map((d, i) => ({ x: cx(i), y: cy(d.value), ...d }));
  const line = smoothPath(pts);
  const area = pts.length ? `${line} L${pts[n - 1].x.toFixed(2)},${bottomY} L${pts[0].x.toFixed(2)},${bottomY} Z` : "";
  const yTicks = Array.from({ length: 5 }, (_, i) => (ceiling / 4) * i);
  const last = pts[n - 1];
  const hp = hover !== null ? pts[hover] : null;
  const fmt = (v: number) => `฿${Math.round(v * 10) / 10}${unit}`;
  const gid = "area-grad-" + n;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ display: "block", width: "100%", height: "auto", overflow: "visible" }} role="img" aria-label="area chart">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={NAVY} stopOpacity="0.22" />
          <stop offset="55%" stopColor={NAVY} stopOpacity="0.07" />
          <stop offset="100%" stopColor={NAVY} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* gridlines + y labels */}
      {yTicks.map((v, i) => {
        const y = cy(v);
        return (
          <g key={i}>
            <line x1={pL} y1={y} x2={W - pR} y2={y} stroke="#eef1f5" strokeWidth={1} />
            <text x={pL - 10} y={y + 4} textAnchor="end" fontSize="15" fill="#9ca3af">{fmt(v)}</text>
          </g>
        );
      })}
      {data.map((d, i) => (
        <text key={i} x={cx(i)} y={bottomY + 26} textAnchor="middle" fontSize="15" fill="#6b7280">{d.month}</text>
      ))}
      {/* area + line (วาดแบบเผยจากซ้าย) */}
      <clipPath id={gid + "-clip"}><rect x={pL} y={0} width={drawn ? cW : 0} height={H} style={{ transition: "width 1s cubic-bezier(.4,0,.2,1)" }} /></clipPath>
      <g clipPath={`url(#${gid}-clip)`}>
        <path d={area} fill={`url(#${gid})`} />
        <path d={line} fill="none" stroke={NAVY} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
      </g>
      {/* hover guide + tooltip */}
      {hp && (
        <g>
          <line x1={hp.x} y1={pT} x2={hp.x} y2={bottomY} stroke="#c4cbd4" strokeWidth={1} strokeDasharray="3,3" />
          <circle cx={hp.x} cy={hp.y} r={5} fill="#fff" stroke={NAVY} strokeWidth={2.5} />
          <g transform={`translate(${Math.min(Math.max(hp.x, pL + 46), W - pR - 46)}, ${Math.max(hp.y - 44, pT + 4)})`}>
            <rect x={-46} y={-2} width={92} height={38} rx={8} fill="#fff" stroke="#e5e7eb" />
            <text x={0} y={13} textAnchor="middle" fontSize="13" fill="#9ca3af">{hp.month}</text>
            <text x={0} y={29} textAnchor="middle" fontSize="15" fontWeight="800" fill={NAVY}>{fmt(hp.value)}</text>
          </g>
        </g>
      )}
      {/* end dot */}
      {last && !hp && <circle cx={last.x} cy={last.y} r={5} fill={NAVY} stroke="#fff" strokeWidth={2} />}
      {/* hit areas */}
      {data.map((_, i) => (
        <rect key={i} x={i === 0 ? pL : (cx(i - 1) + cx(i)) / 2} y={pT}
          width={i === 0 ? (cx(0) + cx(1)) / 2 - pL : (i === n - 1 ? W - pR - (cx(i - 1) + cx(i)) / 2 : (cx(i) + cx(i + 1)) / 2 - (cx(i - 1) + cx(i)) / 2)}
          height={cH} fill="transparent"
          onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(h => h === i ? null : h)} />
      ))}
    </svg>
  );
}

/** Multi-line Chart (สไตล์ shadcn) — เส้นแยกตามเอนทิตี (ตัวแทน) เทียบ trend รายเดือนในกราฟเดียว
 *  series[i].data เรียงตรงกับ months · ชี้ที่ legend เพื่อไฮไลต์เส้น */
export function MultiLineChart({
  months, series, fmt = v => `${Math.round(v)}`, height = 340,
}: {
  months: string[];
  series: { name: string; color: string; data: number[] }[];
  fmt?: (v: number) => string;
  height?: number;
}) {
  const [drawn, setDrawn] = useState(false);
  const [hi, setHi] = useState<number | null>(null); // legend hover → ไฮไลต์เส้น
  useEffect(() => { const t = setTimeout(() => setDrawn(true), 60); return () => clearTimeout(t); }, []);

  const n = months.length;
  const allVals = series.flatMap(s => s.data);
  const ceiling = niceCeil(Math.max(...allVals, 1) * 1.08);
  const W = 1180, H = height, pL = 60, pR = 28, pT = 22, pB = 42;
  const cW = W - pL - pR, cH = H - pT - pB;
  const cx = (i: number) => (n <= 1 ? pL + cW / 2 : pL + (i / (n - 1)) * cW);
  const cy = (v: number) => pT + (1 - v / ceiling) * cH;
  const yTicks = Array.from({ length: 5 }, (_, i) => (ceiling / 4) * i);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ display: "block", width: "100%", height: "auto", overflow: "visible" }} role="img" aria-label="multi-line chart">
        {yTicks.map((v, i) => {
          const y = cy(v);
          return (
            <g key={i}>
              <line x1={pL} y1={y} x2={W - pR} y2={y} stroke="#eef1f5" strokeWidth={1} />
              <text x={pL - 10} y={y + 4} textAnchor="end" fontSize="15" fill="#9ca3af">{fmt(v)}</text>
            </g>
          );
        })}
        {months.map((m, i) => (
          <text key={m} x={cx(i)} y={pT + cH + 26} textAnchor="middle" fontSize="15" fill="#6b7280">{m}</text>
        ))}
        {/* lines (วาดเส้นเรียง: เส้นที่ไฮไลต์อยู่บนสุด) */}
        {series.map((ser, si) => {
          const pts = ser.data.map((v, i) => ({ x: cx(i), y: cy(v) }));
          const d = smoothPath(pts);
          const active = hi === null || hi === si;
          return (
            <g key={ser.name} style={{ opacity: active ? 1 : 0.12, transition: "opacity .15s" }}>
              <path d={d} fill="none" stroke={ser.color} strokeWidth={hi === si ? 3.5 : 2.4}
                strokeLinecap="round" strokeLinejoin="round"
                pathLength={1} strokeDasharray={1} strokeDashoffset={drawn ? 0 : 1}
                style={{ transition: "stroke-dashoffset .9s ease" }} />
              {(hi === si || hi === null) && pts.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={hi === si ? 4 : 3} fill="#fff" stroke={ser.color} strokeWidth={2}
                  opacity={drawn ? 1 : 0} style={{ transition: "opacity .3s ease .5s" }} />
              ))}
            </g>
          );
        })}
      </svg>
      {/* legend — ชี้เพื่อไฮไลต์เส้น */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", marginTop: 14, paddingTop: 12, borderTop: "1px solid #f0f4f8" }}>
        {series.map((ser, si) => (
          <button key={ser.name} type="button"
            onMouseEnter={() => setHi(si)} onMouseLeave={() => setHi(null)}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.72rem", color: STEEL,
              background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0,
              opacity: hi === null || hi === si ? 1 : 0.4, transition: "opacity .15s" }}>
            <span style={{ width: 14, height: 3, borderRadius: 2, background: ser.color, flexShrink: 0 }} />
            {ser.name}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Stacked Bar Chart (สไตล์ shadcn) — แต่ละเดือนเป็นแท่งซ้อน: ยอดรวม (ทั้งเครือ) + แยกสีตามเอนทิตี (ตัวแทน)
 *  series[i].data ต้องเรียงตรงกับ months · ค่าเป็นตัวเลขดิบ · fmt = ฟอร์แมตแกน/tooltip */
export function StackedBarChart({
  months, series, fmt = v => `${Math.round(v)}`, height = 340,
}: {
  months: string[];
  series: { name: string; color: string; data: number[] }[];
  fmt?: (v: number) => string;
  height?: number;
}) {
  const [drawn, setDrawn] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => { const t = setTimeout(() => setDrawn(true), 60); return () => clearTimeout(t); }, []);

  const n = months.length;
  const totals = months.map((_, i) => series.reduce((s, ser) => s + (ser.data[i] ?? 0), 0));
  const ceiling = niceCeil(Math.max(...totals, 1) * 1.08);
  const W = 1180, H = height, pL = 60, pR = 24, pT = 22, pB = 42;
  const cW = W - pL - pR, cH = H - pT - pB;
  const band = cW / n, bw = Math.min(54, band * 0.56);
  const yTicks = Array.from({ length: 5 }, (_, i) => (ceiling / 4) * i);
  const bottomY = pT + cH;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ display: "block", width: "100%", height: "auto", overflow: "visible" }} role="img" aria-label="stacked bar chart">
        {/* gridlines + y labels */}
        {yTicks.map((v, i) => {
          const y = pT + (1 - v / ceiling) * cH;
          return (
            <g key={i}>
              <line x1={pL} y1={y} x2={W - pR} y2={y} stroke="#eef1f5" strokeWidth={1} />
              <text x={pL - 10} y={y + 4} textAnchor="end" fontSize="15" fill="#9ca3af">{fmt(v)}</text>
            </g>
          );
        })}
        {/* bars */}
        {months.map((m, i) => {
          const cx = pL + band * i + band / 2;
          let acc = 0;
          const total = totals[i];
          const isHover = hover === i;
          return (
            <g key={m}
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              {/* hit area */}
              <rect x={pL + band * i} y={pT} width={band} height={cH} fill="transparent" />
              {series.map((ser, si) => {
                const val = ser.data[i] ?? 0;
                if (val <= 0) return null;
                const segH = (val / ceiling) * cH;
                const yTop = drawn ? bottomY - ((acc + val) / ceiling) * cH : bottomY;
                acc += val;
                const isTop = si === series.length - 1 || series.slice(si + 1).every(s => (s.data[i] ?? 0) <= 0);
                return (
                  <rect key={ser.name} x={cx - bw / 2} y={yTop} width={bw} height={drawn ? segH : 0}
                    rx={isTop ? 4 : 0} fill={ser.color} opacity={hover === null || isHover ? 1 : 0.45}
                    style={{ transition: "y .7s cubic-bezier(.4,0,.2,1), height .7s cubic-bezier(.4,0,.2,1), opacity .15s" }} />
                );
              })}
              {/* total on hover */}
              {isHover && total > 0 && (
                <text x={cx} y={pT + (1 - total / ceiling) * cH - 8} textAnchor="middle" fontSize="15" fontWeight="800" fill={NAVY}>{fmt(total)}</text>
              )}
              <text x={cx} y={bottomY + 26} textAnchor="middle" fontSize="15" fill="#6b7280">{m}</text>
            </g>
          );
        })}
      </svg>
      {/* legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", marginTop: 14, paddingTop: 12, borderTop: "1px solid #f0f4f8" }}>
        {series.map(ser => (
          <span key={ser.name} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.72rem", color: STEEL }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: ser.color, flexShrink: 0 }} />
            {ser.name}
          </span>
        ))}
      </div>
    </div>
  );
}
