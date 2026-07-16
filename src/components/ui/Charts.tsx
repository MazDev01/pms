"use client";

import { useState, useEffect, useRef } from "react";
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

// เส้นโค้งแบบ monotone (Fritsch–Carlson) — โค้งเนียนแต่ "ห้ามแกว่งเกินจุดข้อมูล"
// ต่างจาก smoothPath (Catmull-Rom) ที่ overshoot ได้: ยอดพุ่งแล้วดิ่ง เส้นจะจุ่มต่ำกว่าจุดจริง
// เช่น ยอดขาย ฿11.8M เดือนหนึ่งแล้ว ฿0 เดือนถัดไป Catmull-Rom จะลากเส้นลงต่ำกว่าศูนย์ = ติดลบ
// ซึ่งเป็นไปไม่ได้ในข้อมูลจริง · monotone รับประกันว่าเส้นอยู่ระหว่างค่าสองจุดเสมอ
function monotonePath(pts: Array<{ x: number; y: number }>): string {
  const n = pts.length;
  if (n < 2) return "";
  const dx: number[] = [], dy: number[] = [], m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1].x - pts[i].x);
    dy.push(pts[i + 1].y - pts[i].y);
    m.push(dx[i] === 0 ? 0 : dy[i] / dx[i]);
  }
  // ความชันที่แต่ละจุด — จุดกลับทิศให้ชันเป็น 0 (เป็นยอด/ก้น) แล้วจำกัดไม่ให้เกิน 3 เท่าของชันข้างเคียง
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) {
    if (m[i - 1] * m[i] <= 0) { t.push(0); continue; }
    const avg = (m[i - 1] + m[i]) / 2;
    const lim = 3 * Math.min(Math.abs(m[i - 1]), Math.abs(m[i]));
    t.push(Math.sign(avg) * Math.min(Math.abs(avg), lim));
  }
  t.push(m[n - 2]);
  let d = `M${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${(pts[i].x + h).toFixed(2)},${(pts[i].y + t[i] * h).toFixed(2)}` +
         ` ${(pts[i + 1].x - h).toFixed(2)},${(pts[i + 1].y - t[i + 1] * h).toFixed(2)}` +
         ` ${pts[i + 1].x.toFixed(2)},${pts[i + 1].y.toFixed(2)}`;
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

/** Grouped bar chart — actual (navy) vs plan (silver), exceeded month highlighted.
 *  ค่าเริ่มต้น = ยอดขายจริง/แผน (฿) · ส่งชื่อชุด+ตัวจัดรูปแบบเข้ามาได้ เพื่อใช้กับกราฟ "จำนวน" ด้วย */
export function PlanVsActualBars({
  data, unit = "M", height, aLabel = "จริง", bLabel = "แผน", fmt: fmtProp,
  aFill, bFill, highlightExceeded = true,
}: {
  data: BarPoint[]; unit?: string; height?: number;
  /** ชื่อชุดข้อมูลในกล่องข้อความตอนชี้ (actual / plan) */
  aLabel?: string; bLabel?: string;
  fmt?: (v: number) => string;
  /** สีทับแท่ง — ไม่ส่ง = ใช้ไล่เฉดมาตรฐาน (กรมท่า / เงิน) */
  aFill?: string; bFill?: string;
  /** เดือนที่ทำได้เกินแผนเป็นแท่งเขียวขอบทอง — ปิดได้เมื่อสองชุดไม่ใช่ "จริงเทียบแผน" */
  highlightExceeded?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [drawn, setDrawn] = useState(false);
  useEffect(() => { const t = setTimeout(() => setDrawn(true), 60); return () => clearTimeout(t); }, []);
  const max = Math.max(...data.flatMap(d => [d.actual, d.plan]), 1) * 1.15;
  const W = 700, H = height ?? 210, pL = 34, pR = 12, pT = 16, pB = 34;
  const cW = W - pL - pR, cH = H - pT - pB, n = data.length;
  const slot = cW / n;
  const bw = Math.min(20, slot / 3);
  const yAt = (v: number) => pT + (1 - v / max) * cH;
  const baseY = pT + cH;
  const fmt = fmtProp ?? ((v: number) => `฿${Math.round(v * 10) / 10}${unit}`);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => max * t);
  const grow = { transition: "y .7s cubic-bezier(.4,0,.2,1), height .7s cubic-bezier(.4,0,.2,1), opacity .15s" } as const;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ display: "block", width: "100%", height: "auto", overflow: "visible" }} role="img" aria-label="plan vs actual">
      <defs>
        <linearGradient id="pva-navy" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2c62ad" /><stop offset="1" stopColor={NAVY} /></linearGradient>
        <linearGradient id="pva-green" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#34d399" /><stop offset="1" stopColor="#059669" /></linearGradient>
        <linearGradient id="pva-silver" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e6eaef" /><stop offset="1" stopColor={SILVER} /></linearGradient>
      </defs>
      {ticks.map((v, i) => (
        <g key={i}>
          <line x1={pL} y1={yAt(v)} x2={W - pR} y2={yAt(v)} stroke="#eef1f5" strokeWidth="1" strokeDasharray={i === 0 ? "0" : "3 3"} />
          <text x={pL - 6} y={yAt(v) + 3} textAnchor="end" fontSize="9.5" fill="#aab2bd">{Math.round(v * 10) / 10}</text>
        </g>
      ))}
      {data.map((d, i) => {
        const cx = pL + slot * i + slot / 2;
        const exceeded = highlightExceeded && d.actual > d.plan;
        const aH = d.actual > 0 ? baseY - yAt(d.actual) : 0;
        const pH = baseY - yAt(d.plan);
        const isHover = hover === i;
        return (
          <g key={d.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            {/* ไฮไลต์คอลัมน์ตอนชี้ */}
            {isHover && <rect x={cx - slot / 2 + 3} y={pT} width={slot - 6} height={cH} rx={6} fill="#f2f6fc" />}
            <rect x={cx - slot / 2} y={pT} width={slot} height={cH} fill="transparent" />
            {/* actual (navy · โตจากล่าง) */}
            <rect x={cx - bw - 2} y={drawn ? yAt(d.actual) : baseY} width={bw} height={drawn ? aH : 0} rx={4}
              fill={exceeded ? "url(#pva-green)" : (aFill ?? "url(#pva-navy)")} opacity={d.actual > 0 ? (hover === null || isHover ? 1 : 0.5) : 0}
              stroke={exceeded ? "#ECC94B" : "none"} strokeWidth={exceeded ? 1.5 : 0} style={grow} />
            {/* plan (silver) */}
            <rect x={cx + 2} y={drawn ? yAt(d.plan) : baseY} width={bw} height={drawn ? pH : 0} rx={4}
              fill={bFill ?? "url(#pva-silver)"} opacity={d.plan > 0 ? (hover === null || isHover ? 1 : 0.5) : 0} style={grow} />
            <text x={cx} y={H - 12} textAnchor="middle" fontSize="9.5" fill="#aab2bd">{d.label}</text>
            {isHover && (
              <g style={{ pointerEvents: "none" }}>
                <rect x={Math.min(Math.max(cx - 52, pL), W - pR - 104)} y={pT} width="104" height="40" rx="8" fill="#2D2D2D" />
                <text x={Math.min(Math.max(cx - 52, pL), W - pR - 104) + 52} y={pT + 17} textAnchor="middle" fontSize="10.5" fill="#fff" fontWeight="700">{aLabel} {fmt(d.actual)}</text>
                <text x={Math.min(Math.max(cx - 52, pL), W - pR - 104) + 52} y={pT + 31} textAnchor="middle" fontSize="10" fill="#C0C0C0">{bLabel} {fmt(d.plan)}</text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** แท่งรายเดือน + เส้นประเป้าหมายพาดผ่าน — เดือนไหนถึง/ไม่ถึงเป้าเห็นทันที
 *  ใช้แทนแท่งคู่เมื่อ "เป้า" เท่ากันทุกเดือน (แท่งเป้าที่ซ้ำ 12 อันอ่านยากกว่าเส้นเดียว) */
export function MonthlyBarsWithTarget({
  data, target, fmt, height = 260, targetLabel = "เป้าหมาย",
}: {
  data: { label: string; value: number }[];
  target: number;
  fmt: (v: number) => string;
  height?: number;
  targetLabel?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [drawn, setDrawn] = useState(false);
  useEffect(() => { const t = setTimeout(() => setDrawn(true), 60); return () => clearTimeout(t); }, []);
  const max = niceCeil(Math.max(...data.map(d => d.value), target, 1) * 1.12);
  const W = 700, H = height, pL = 40, pR = 58, pT = 14, pB = 32;
  const cW = W - pL - pR, cH = H - pT - pB, n = data.length;
  const slot = cW / n;
  const bw = Math.min(26, slot * 0.54);
  const yAt = (v: number) => pT + (1 - v / max) * cH;
  const baseY = pT + cH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => max * t);
  const grow = { transition: "y .7s cubic-bezier(.4,0,.2,1), height .7s cubic-bezier(.4,0,.2,1), opacity .15s" } as const;
  const tY = yAt(target);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ display: "block", width: "100%", height: "auto", overflow: "visible" }} role="img" aria-label="ยอดขายรายเดือนเทียบเป้าหมาย">
      <defs>
        <linearGradient id="mbt-navy" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2c62ad" /><stop offset="1" stopColor={NAVY} /></linearGradient>
        <linearGradient id="mbt-green" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#34d399" /><stop offset="1" stopColor="#059669" /></linearGradient>
      </defs>
      {ticks.map((v, i) => (
        <g key={i}>
          <line x1={pL} y1={yAt(v)} x2={W - pR} y2={yAt(v)} stroke="#eef1f5" strokeWidth="1" strokeDasharray={i === 0 ? "0" : "3 3"} />
          <text x={pL - 6} y={yAt(v) + 3} textAnchor="end" fontSize="9.5" fill="#aab2bd">{fmt(v)}</text>
        </g>
      ))}
      {data.map((d, i) => {
        const cx = pL + slot * i + slot / 2;
        const hit = d.value >= target && d.value > 0;
        const h = d.value > 0 ? baseY - yAt(d.value) : 0;
        const isHover = hover === i;
        return (
          <g key={d.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            {isHover && <rect x={cx - slot / 2 + 2} y={pT} width={slot - 4} height={cH} rx={6} fill="#f2f6fc" />}
            <rect x={cx - slot / 2} y={pT} width={slot} height={cH} fill="transparent" />
            <rect x={cx - bw / 2} y={drawn ? yAt(d.value) : baseY} width={bw} height={drawn ? h : 0} rx={4}
              fill={hit ? "url(#mbt-green)" : "url(#mbt-navy)"}
              opacity={d.value > 0 ? (hover === null || isHover ? 1 : 0.5) : 0} style={grow} />
            <text x={cx} y={H - 11} textAnchor="middle" fontSize="9.5" fill="#aab2bd">{d.label}</text>
          </g>
        );
      })}
      {/* เส้นประเป้าหมาย — วาดทับแท่ง ให้เห็นว่าเดือนไหนข้ามเส้น */}
      <line x1={pL} y1={tY} x2={W - pR} y2={tY} stroke="#EA580C" strokeWidth="1.6" strokeDasharray="6 4"
        opacity={drawn ? 1 : 0} style={{ transition: "opacity .5s ease .5s" }} />
      <text x={W - pR + 6} y={tY - 3} fontSize="9.5" fill="#EA580C" fontWeight="700" opacity={drawn ? 1 : 0} style={{ transition: "opacity .5s ease .5s" }}>{targetLabel}</text>
      <text x={W - pR + 6} y={tY + 9} fontSize="9.5" fill="#EA580C" opacity={drawn ? 1 : 0} style={{ transition: "opacity .5s ease .5s" }}>{fmt(target)}</text>
      {hover !== null && (() => {
        const d = data[hover];
        const cx = pL + slot * hover + slot / 2;
        const x = Math.min(Math.max(cx - 54, pL), W - pR - 108);
        const pct = target > 0 ? Math.round((d.value / target) * 100) : 0;
        return (
          <g style={{ pointerEvents: "none" }}>
            <rect x={x} y={pT} width="108" height="40" rx="8" fill="#2D2D2D" />
            <text x={x + 54} y={pT + 17} textAnchor="middle" fontSize="10.5" fill="#fff" fontWeight="700">{fmt(d.value)}</text>
            <text x={x + 54} y={pT + 31} textAnchor="middle" fontSize="10" fill={d.value >= target ? "#34d399" : "#C0C0C0"}>{pct}% ของเป้า</text>
          </g>
        );
      })()}
    </svg>
  );
}

/** วงแหวนความคืบหน้า (บนการ์ด KPI เป้าหมาย) — แหล่งเดียวของทั้งระบบ
 *
 *  กับดัก: ใส่ transition ไว้เฉย ๆ "ไม่มีวันทำงาน" เพราะค่าถูกตั้งตั้งแต่เรนเดอร์แรก
 *  CSS transition วิ่งเมื่อค่าเปลี่ยน "หลัง mount" เท่านั้น → ต้องเริ่มที่ 0 แล้วตั้งค่าจริงในเฟรมถัดไป
 *  เริ่มที่ 0 เท่ากันทั้งเซิร์ฟเวอร์และเบราว์เซอร์ → ไม่เกิด hydration mismatch
 *  (เคยเขียนซ้ำ 2 ที่ · ตัวแก้ถูกใส่ให้ฝั่งตัวแทนอย่างเดียว ฝั่ง HQ เลยนิ่งอยู่นาน — จึงรวมเหลือตัวเดียว)
 */
export function ProgressRing({ pct, size = 50, color = NAVY }: { pct: number; size?: number; color?: string }) {
  const r = (size - 11) / 2, c = 2 * Math.PI * r;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    // สองเฟรม: เฟรมแรกให้เบราว์เซอร์ commit ค่า 0 ลง DOM จริง เฟรมสองค่อยเปลี่ยน — transition ถึงจะจับความต่างได้
    let id2 = 0;
    const id1 = requestAnimationFrame(() => { id2 = requestAnimationFrame(() => setShown(pct)); });
    return () => { cancelAnimationFrame(id1); cancelAnimationFrame(id2); };
  }, [pct]);
  // เส้นโค้งวาดได้สูงสุด 1 รอบ (เกิน 100% วาดเพิ่มไม่ได้) — แต่ "ตัวเลขเก็บค่าจริง" ไม่ถูกตัด
  const arc = Math.max(0, Math.min(100, shown));
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }} role="img" aria-label={`${pct}%`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EEF2F7" strokeWidth={9} />
      <circle className="ring-arc" cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={9} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - arc / 100)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central" fontSize={size * 0.24} fontWeight={800} fill={color}>{pct}%</text>
    </svg>
  );
}

export type CategoryBar = { label: string; value: number; sub?: string };

/** แท่งแนวตั้งเทียบหมวดหมู่ (จัดอันดับ) — หนึ่งหมวด = หนึ่งแท่ง
 *
 *  ใช้ "สีเดียวทั้งกราฟ" เพราะเป็นชุดข้อมูลเดียว (ยอดขาย) ไม่ใช่หลายชุด
 *  ถ้าไล่สีทีละแท่งตามลำดับในอาร์เรย์ที่เรียงตามยอด = สีผูกกับ "อันดับ" ไม่ใช่ "ตัวตน"
 *  พอยอดขยับจนสลับอันดับ สีจะสลับตามทั้งที่เป็นคน/สินค้าคนเดิม — อ่านผิดง่าย
 *
 *  viewBox = ความกว้างจริงของการ์ด (ResizeObserver) → ตัวอักษรคมเท่ากันทุกขนาด
 *  ไม่มีแกน Y เพราะมีไม่กี่แท่ง — ติดตัวเลขไว้บนหัวแท่งตรง ๆ อ่านง่ายกว่าไล่สายตาไปหาแกน
 */
export function CategoryBars({
  data, fmt, height = 240, color = NAVY, onSelect, ariaLabel,
}: {
  data: CategoryBar[];
  fmt: (v: number) => string;
  height?: number;
  color?: string;
  onSelect?: (i: number) => void;
  ariaLabel: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [drawn, setDrawn] = useState(false);
  useEffect(() => { const t = setTimeout(() => setDrawn(true), 60); return () => clearTimeout(t); }, []);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [vw, setVw] = useState(380); // ค่าตั้งต้นเท่ากันทั้งเซิร์ฟเวอร์/เบราว์เซอร์ → ไม่เกิด hydration mismatch
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setVw(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = data.length;
  const W = Math.max(240, vw), H = height;
  const hasSub = data.some(d => d.sub);
  const pL = 6, pR = 6, pT = 26, pB = hasSub ? 42 : 30;
  const cW = W - pL - pR, cH = H - pT - pB;
  const max = niceCeil(Math.max(...data.map(d => d.value), 1) * 1.08);
  const slot = cW / n;
  const bw = Math.min(54, slot * 0.46);
  const baseY = pT + cH;
  const yAt = (v: number) => pT + (1 - v / max) * cH;
  // ตัดชื่อที่ยาวเกินช่อง (ไทย ~5.2px/ตัว ที่ 9.5px) — ชื่อเต็มยังอ่านได้จาก <title> ตอนชี้
  const maxChars = Math.max(4, Math.floor((slot - 6) / 5.2));
  const clip = (s: string) => (s.length > maxChars ? `${s.slice(0, maxChars - 1)}…` : s);
  const grow = { transition: "y .7s cubic-bezier(.4,0,.2,1), height .7s cubic-bezier(.4,0,.2,1), opacity .15s" } as const;

  return (
    <div ref={wrapRef}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ display: "block", width: "100%", height: "auto", overflow: "visible" }}
        role="img" aria-label={ariaLabel}>
        <line x1={pL} y1={baseY} x2={W - pR} y2={baseY} stroke="#eef1f5" strokeWidth="1" />
        {data.map((d, i) => {
          const cx = pL + slot * i + slot / 2;
          const h = d.value > 0 ? baseY - yAt(d.value) : 0;
          const on = hover === i;
          const full = `${d.label}${d.sub ? ` · ${d.sub}` : ""} — ${fmt(d.value)}`;
          return (
            <g key={d.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
              onClick={() => onSelect?.(i)} style={{ cursor: onSelect ? "pointer" : "default" }}>
              <title>{full}</title>
              {on && <rect x={cx - slot / 2 + 2} y={pT - 22} width={slot - 4} height={cH + 22} rx={8} fill="#f2f6fc" />}
              {/* พื้นที่รับเมาส์เต็มช่อง — เล็งง่ายกว่าตัวแท่ง */}
              <rect x={cx - slot / 2} y={pT - 22} width={slot} height={cH + 22} fill="transparent" />
              <text x={cx} y={pT - 9} textAnchor="middle" fontSize="10" fontWeight="800" fill={color}
                opacity={drawn ? 1 : 0} style={{ transition: "opacity .4s ease .5s" }}>{fmt(d.value)}</text>
              <rect x={cx - bw / 2} y={drawn ? yAt(d.value) : baseY} width={bw} height={drawn ? h : 0} rx={4}
                fill={color} opacity={d.value > 0 ? (hover === null || on ? 1 : 0.5) : 0} style={grow} />
              <text x={cx} y={baseY + 15} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#6B7280">{clip(d.label)}</text>
              {d.sub && <text x={cx} y={baseY + 28} textAnchor="middle" fontSize="8.5" fill="#aab2bd">{clip(d.sub)}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export type SalesLinePoint = { label: string; value: number };

/** ยอดขายรายเดือน — กราฟเส้น + พื้นไล่เฉด + เส้นประเป้าหมายรายเดือน
 *  จุดสีเขียว = เดือนที่ถึงเป้า · จุดกรมท่า = ไม่ถึงเป้า (คงความหมายเดิมของแท่งเขียว/น้ำเงิน)
 *  ขนาด viewBox เท่ากับ PlanVsActualBars (W=700) เพื่อให้การ์ดคู่กันมีขนาดตัวอักษรเท่ากัน
 */
export function SalesLineChart({
  data, target, fmt, height = 260, targetLabel = "เป้า/เดือน",
}: {
  data: SalesLinePoint[];
  target: number;
  fmt: (v: number) => string;
  height?: number;
  targetLabel?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [drawn, setDrawn] = useState(false);
  useEffect(() => { const t = setTimeout(() => setDrawn(true), 60); return () => clearTimeout(t); }, []);

  const n = data.length;
  const max = niceCeil(Math.max(...data.map(d => d.value), target, 1) * 1.12);
  const W = 700, H = height, pL = 44, pR = 58, pT = 16, pB = 32;
  const cW = W - pL - pR, cH = H - pT - pB;
  const cx = (i: number) => (n <= 1 ? pL + cW / 2 : pL + (i / (n - 1)) * cW);
  const cy = (v: number) => pT + (1 - v / max) * cH;
  const baseY = pT + cH;
  const pts = data.map((d, i) => ({ x: cx(i), y: cy(d.value), ...d }));
  // monotone ไม่ใช่ Catmull-Rom — เดือนที่ยอดพุ่งแล้วดิ่งกลับ 0 เส้นจะไม่จุ่มต่ำกว่าศูนย์ (ยอดขายติดลบไม่ได้)
  const line = monotonePath(pts);
  const area = pts.length ? `${line} L${pts[n - 1].x.toFixed(2)},${baseY} L${pts[0].x.toFixed(2)},${baseY} Z` : "";
  const tY = cy(target);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => max * t);
  const fadeIn = (d: number) => ({ transition: `opacity .5s ease ${d}s` });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ display: "block", width: "100%", height: "auto", overflow: "visible" }}
      role="img" aria-label="ยอดขายรายเดือน เทียบ เป้าหมายรายเดือน">
      <defs>
        <linearGradient id="sl-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={NAVY} stopOpacity="0.22" />
          <stop offset="95%" stopColor={NAVY} stopOpacity="0" />
        </linearGradient>
      </defs>

      {ticks.map((v, i) => (
        <g key={i}>
          <line x1={pL} y1={cy(v)} x2={W - pR} y2={cy(v)} stroke="#eef1f5" strokeWidth="1" strokeDasharray={i === 0 ? "0" : "3 3"} />
          <text x={pL - 6} y={cy(v) + 3} textAnchor="end" fontSize="9.5" fill="#aab2bd">{fmt(v)}</text>
        </g>
      ))}

      {/* พื้นใต้เส้น — จางเข้ามาหลังเส้นวาดเสร็จ */}
      {area && <path d={area} fill="url(#sl-area)" opacity={drawn ? 1 : 0} style={fadeIn(0.5)} />}

      {/* เส้นยอดขาย — วาดจากซ้ายไปขวา */}
      {line && (
        <path d={line} fill="none" stroke={NAVY} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"
          pathLength={1} strokeDasharray={1} strokeDashoffset={drawn ? 0 : 1}
          style={{ transition: "stroke-dashoffset 1.15s cubic-bezier(.4,0,.2,1)" }} />
      )}

      {/* เส้นประเป้าหมาย — วาดทับเส้น ให้เห็นว่าเดือนไหนอยู่เหนือเส้น */}
      <line x1={pL} y1={tY} x2={W - pR} y2={tY} stroke="#EA580C" strokeWidth="1.6" strokeDasharray="6 4"
        opacity={drawn ? 1 : 0} style={fadeIn(0.5)} />
      <text x={W - pR + 6} y={tY - 3} fontSize="9.5" fill="#EA580C" fontWeight="700" opacity={drawn ? 1 : 0} style={fadeIn(0.5)}>{targetLabel}</text>
      <text x={W - pR + 6} y={tY + 9} fontSize="9.5" fill="#EA580C" opacity={drawn ? 1 : 0} style={fadeIn(0.5)}>{fmt(target)}</text>

      {/* จุดรายเดือน — เขียว = ถึงเป้า · ขนาด >=8px ตามสเปกมาร์ก */}
      {pts.map((p, i) => {
        const hit = p.value >= target && p.value > 0;
        return (
          <circle key={p.label} cx={p.x} cy={p.y} r={hover === i ? 5.5 : 4}
            fill={hit ? "#059669" : NAVY} stroke="#fff" strokeWidth="2"
            opacity={drawn ? 1 : 0} style={fadeIn(0.9 + i * 0.02)} />
        );
      })}

      {pts.map(p => <text key={`x${p.label}`} x={p.x} y={H - 10} textAnchor="middle" fontSize="9.5" fill="#aab2bd">{p.label}</text>)}

      {/* ชั้นรับเมาส์ + เส้นตั้ง + ป้ายค่า (เดือนที่ชี้เท่านั้น) */}
      {hover !== null && (() => {
        const p = pts[hover];
        const tw = 104, th = 40;
        const x = Math.min(Math.max(p.x - tw / 2, pL), W - pR - tw);
        const y = Math.max(p.y - th - 10, pT);
        const pct = target > 0 ? Math.round((p.value / target) * 100) : 0;
        return (
          <g style={{ pointerEvents: "none" }}>
            <line x1={p.x} y1={pT} x2={p.x} y2={baseY} stroke="#c4cbd4" strokeWidth="1" strokeDasharray="3 3" />
            <rect x={x} y={y} width={tw} height={th} rx="8" fill="#2D2D2D" />
            <text x={x + tw / 2} y={y + 17} textAnchor="middle" fontSize="10.5" fill="#fff" fontWeight="700">{fmt(p.value)}</text>
            <text x={x + tw / 2} y={y + 31} textAnchor="middle" fontSize="10" fill={p.value >= target ? "#34d399" : "#C0C0C0"}>{pct}% ของเป้า</text>
          </g>
        );
      })()}
      {pts.map((p, i) => {
        const half = n > 1 ? cW / (n - 1) / 2 : cW / 2;
        return <rect key={`hit${p.label}`} x={p.x - half} y={pT} width={half * 2} height={cH} fill="transparent"
          style={{ cursor: "crosshair" }} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />;
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

/** Line – Trend (สไตล์ shadcn statistics) — เส้นตรงต่อจุด + เส้นประแนวตั้ง + จุดปลายแบบวงแหวน
 *  minimal · เหมาะกับการ์ดสถิติที่เน้นตัวเลข · data = {month,value} */
export function LineTrendChart({
  data, unit = "M", height = 300, color = NAVY,
}: {
  data: { month: string; value: number }[];
  unit?: string; height?: number; color?: string;
}) {
  const [drawn, setDrawn] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => { const t = setTimeout(() => setDrawn(true), 60); return () => clearTimeout(t); }, []);

  const n = data.length;
  const vals = data.map(d => d.value);
  const max = Math.max(...vals, 0);
  const lo = 0, hi = niceCeil(max * 1.15) || 1;           // แกน Y เริ่มที่ 0 + เผื่อหัว (สไตล์ Chateau MRR) เส้นไม่ชิดขอบบน
  const W = 1180, H = height, pL = 56, pR = 40, pT = 26, pB = 40;
  const cW = W - pL - pR, cH = H - pT - pB;
  const cx = (i: number) => (n <= 1 ? pL + cW / 2 : pL + (i / (n - 1)) * cW);
  const cy = (v: number) => pT + (1 - (v - lo) / (hi - lo)) * cH;
  const bottomY = pT + cH;
  const pts = data.map((d, i) => ({ x: cx(i), y: cy(d.value), ...d }));
  const line = smoothPath(pts); // เส้นโค้งเนียน (Catmull-Rom) แทนเส้นหักตรง
  const area = pts.length ? `${line} L${pts[n - 1].x.toFixed(2)},${bottomY} L${pts[0].x.toFixed(2)},${bottomY} Z` : "";
  const yTicks = Array.from({ length: 5 }, (_, i) => (hi / 4) * i);
  const last = pts[n - 1];
  const hp = hover !== null ? pts[hover] : null;
  const gid = "line-clip-" + n;
  const grad = "line-grad-" + n;
  const fmt = (v: number) => `฿${Math.round(v * 10) / 10}${unit}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ display: "block", width: "100%", height: "auto", overflow: "visible" }} role="img" aria-label="line chart">
      <defs>
        <linearGradient id={grad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.20" />
          <stop offset="60%" stopColor={color} stopOpacity="0.06" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
        <filter id="line-tt-shadow" x="-20%" y="-20%" width="140%" height="160%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#0f2a52" floodOpacity="0.14" />
        </filter>
      </defs>
      {/* y labels (จาง) */}
      {yTicks.map((v, i) => (
        <text key={i} x={pL - 10} y={cy(v) + 4} textAnchor="end" fontSize="14" fill="#c4cbd4">{fmt(v)}</text>
      ))}
      {/* เส้นประแนวตั้งทุกจุด */}
      {pts.map((p, i) => (
        <line key={i} x1={p.x} y1={pT} x2={p.x} y2={bottomY} stroke="#e8ecf2" strokeWidth={1} strokeDasharray="4,5" />
      ))}
      {data.map((d, i) => (
        <text key={i} x={cx(i)} y={bottomY + 26} textAnchor="middle" fontSize="15" fill="#6b7280">{d.month}</text>
      ))}
      {/* พื้นที่เติมสี + เส้น (เผยจากซ้าย) */}
      <clipPath id={gid}><rect x={pL - 6} y={0} width={drawn ? cW + 12 : 0} height={H} style={{ transition: "width 1s cubic-bezier(.4,0,.2,1)" }} /></clipPath>
      <g clipPath={`url(#${gid})`}>
        <path d={area} fill={`url(#${grad})`} />
        {/* เรืองแสงนุ่มใต้เส้น */}
        <path d={line} fill="none" stroke={color} strokeWidth={8} opacity={0.12} strokeLinecap="round" strokeLinejoin="round" />
        <path d={line} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      </g>
      {/* hover — เส้นไกด์ประแนวตั้ง + จุดทึบ + การ์ดทูลทิปลอย (สไตล์ Chateau) */}
      {hp && (() => {
        const tw = 152, th = 50;
        const tx = Math.min(Math.max(hp.x + 14, pL), W - pR - tw);
        const ty = Math.min(Math.max(hp.y - th - 10, pT + 2), bottomY - th);
        return (
          <g style={{ pointerEvents: "none" }}>
            <line x1={hp.x} y1={pT} x2={hp.x} y2={bottomY} stroke={color} strokeWidth={1.3} strokeDasharray="5,4" opacity={0.45} />
            <circle cx={hp.x} cy={hp.y} r={6} fill={color} stroke="#fff" strokeWidth={2.5} />
            <g transform={`translate(${tx},${ty})`} filter="url(#line-tt-shadow)">
              <rect x={0} y={0} width={tw} height={th} rx={10} fill="#fff" stroke="#eef1f5" strokeWidth={1} />
              <text x={13} y={20} fontSize="13.5" fill="#9ca3af">{hp.month}</text>
              <text x={13} y={39} fontSize="15" fontWeight="800" fill={color}>ยอดขาย : {fmt(hp.value)}</text>
            </g>
          </g>
        );
      })()}
      {/* จุดปลายแบบวงแหวน (target dot) */}
      {last && !hp && drawn && (
        <g>
          <circle cx={last.x} cy={last.y} r={9} fill={color} opacity={0.18} />
          <circle cx={last.x} cy={last.y} r={5} fill="#fff" stroke={color} strokeWidth={3} />
          <circle cx={last.x} cy={last.y} r={2} fill={color} />
        </g>
      )}
      {/* hit areas */}
      {data.map((_, i) => (
        <rect key={i} x={i === 0 ? pL - 6 : (cx(i - 1) + cx(i)) / 2} y={pT}
          width={i === 0 ? (cx(0) + cx(1)) / 2 - (pL - 6) : (i === n - 1 ? W - pR - (cx(i - 1) + cx(i)) / 2 : (cx(i) + cx(i + 1)) / 2 - (cx(i - 1) + cx(i)) / 2)}
          height={cH} fill="transparent"
          onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(h => h === i ? null : h)} />
      ))}
    </svg>
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
  months, series, fmt = v => `${Math.round(v)}`, height = 340, vw = 1180,
}: {
  months: string[];
  series: { name: string; color: string; data: number[] }[];
  fmt?: (v: number) => string;
  height?: number;
  /** ความกว้าง viewBox — ลดลงเมื่ออยู่ในการ์ดแคบ (3 คอลัมน์) เพื่อให้สัดส่วน/ตัวอักษรไม่ถูกบีบ */
  vw?: number;
}) {
  const [drawn, setDrawn] = useState(false);
  const [hi, setHi] = useState<number | null>(null); // legend hover → ไฮไลต์เส้น
  useEffect(() => { const t = setTimeout(() => setDrawn(true), 60); return () => clearTimeout(t); }, []);

  const n = months.length;
  const allVals = series.flatMap(s => s.data);
  const ceiling = niceCeil(Math.max(...allVals, 1) * 1.08);
  const narrow = vw < 800;
  const W = vw, H = height, pL = narrow ? 46 : 60, pR = narrow ? 14 : 28, pT = 18, pB = narrow ? 34 : 42;
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
              <text x={pL - 8} y={y + 4} textAnchor="end" fontSize={narrow ? 13 : 15} fill="#9ca3af">{fmt(v)}</text>
            </g>
          );
        })}
        {months.map((m, i) => (
          (!narrow || i % 2 === 0) && (
            <text key={m} x={cx(i)} y={pT + cH + (narrow ? 22 : 26)} textAnchor="middle" fontSize={narrow ? 13 : 15} fill="#6b7280">{m}</text>
          )
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

/** Grouped Bar Chart — แต่ละเดือนมีแท่งวางเรียงข้างกัน แท่งละหนึ่งชุดข้อมูล
 *  ใช้เมื่อชุดข้อมูล "ไม่ควรบวกกัน" (เช่น ลีด / ใบเสนอราคา / ปิดการขาย — เป็นขั้นของดีลเดียวกัน
 *  เอามาซ้อนแล้วยอดรวมจะไม่มีความหมาย) · ถ้าชุดข้อมูลบวกกันแล้วได้ยอดรวมจริง ให้ใช้ StackedBarChart
 *  series[i].data ต้องเรียงตรงกับ months · vw = ความกว้าง viewBox (ลดลงเมื่ออยู่ในการ์ดแคบ) */
export function GroupedBarChart({
  months, series, fmt = v => `${Math.round(v)}`, height = 340, vw = 1180,
}: {
  months: string[];
  series: { name: string; color: string; data: number[] }[];
  fmt?: (v: number) => string;
  height?: number;
  vw?: number;
}) {
  const [drawn, setDrawn] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => { const t = setTimeout(() => setDrawn(true), 60); return () => clearTimeout(t); }, []);

  const n = months.length;
  // เพดานแกนคิดจากค่าสูงสุดของแท่งเดี่ยว (ไม่ใช่ผลรวม) เพราะแท่งวางข้างกัน ไม่ได้ซ้อน
  const ceiling = niceCeil(Math.max(...series.flatMap(s => s.data), 1) * 1.08);
  const narrow = vw < 800;
  const W = vw, H = height, pL = narrow ? 46 : 60, pR = narrow ? 14 : 24, pT = 22, pB = narrow ? 34 : 42;
  const cW = W - pL - pR, cH = H - pT - pB;
  const band = cW / n;
  const groupW = Math.min(band * 0.68, 24 * series.length);
  const bw = groupW / series.length;
  const yTicks = Array.from({ length: 5 }, (_, i) => (ceiling / 4) * i);
  const bottomY = pT + cH;
  const fs = narrow ? 13 : 15;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ display: "block", width: "100%", height: "auto", overflow: "visible" }} role="img" aria-label="grouped bar chart">
        {yTicks.map((v, i) => {
          const y = pT + (1 - v / ceiling) * cH;
          return (
            <g key={i}>
              <line x1={pL} y1={y} x2={W - pR} y2={y} stroke="#eef1f5" strokeWidth={1} />
              <text x={pL - 10} y={y + 4} textAnchor="end" fontSize={fs} fill="#9ca3af">{fmt(v)}</text>
            </g>
          );
        })}
        {months.map((m, i) => {
          const gx = pL + band * i + band / 2 - groupW / 2;
          const isHover = hover === i;
          return (
            <g key={m} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              {/* hit area — ชี้ที่ไหนก็ได้ในเดือนนั้น แล้วโชว์ตัวเลขทุกแท่ง */}
              <rect x={pL + band * i} y={pT} width={band} height={cH} fill="transparent" />
              {series.map((ser, si) => {
                const val = ser.data[i] ?? 0;
                const h = (val / ceiling) * cH;
                const x = gx + bw * si;
                return (
                  <g key={ser.name}>
                    {/* แท่งค่า 0 ยังวาดเป็นขีดบาง ๆ ให้เห็นว่าเดือนนั้นมีชุดข้อมูลนี้แต่เป็นศูนย์ */}
                    <rect x={x + bw * 0.12} y={drawn ? bottomY - Math.max(h, val > 0 ? 2 : 1.5) : bottomY}
                      width={bw * 0.76} height={drawn ? Math.max(h, val > 0 ? 2 : 1.5) : 0}
                      rx={3} fill={ser.color} opacity={val > 0 ? (hover === null || isHover ? 1 : 0.45) : 0.22}
                      style={{ transition: "y .7s cubic-bezier(.4,0,.2,1), height .7s cubic-bezier(.4,0,.2,1), opacity .15s" }} />
                    {isHover && (
                      <text x={x + bw / 2} y={bottomY - h - 7} textAnchor="middle" fontSize={fs - 1} fontWeight="800" fill={ser.color}>{fmt(val)}</text>
                    )}
                  </g>
                );
              })}
              <text x={pL + band * i + band / 2} y={bottomY + (narrow ? 22 : 26)} textAnchor="middle" fontSize={fs} fill="#6b7280">{m}</text>
            </g>
          );
        })}
      </svg>
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
