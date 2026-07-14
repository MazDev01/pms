"use client";

import { useEffect, useRef, useState } from "react";

// นับตัวเลข KPI ขึ้นจาก 0 → ค่าจริง (เอฟเฟกต์แบบ enterprise CRM) · รองรับสตริงที่มีคำนำหน้า/หน่วย
// เช่น "฿154.2M" · "50" · "35%" · "1,101" — แยก prefix/ตัวเลข/suffix แล้ว animate เฉพาะตัวเลข
// SSR-safe: เรนเดอร์ค่าจริงตอน mount แล้วค่อย animate ฝั่ง client (ไม่ hydration mismatch)
export function CountUp({ value, duration = 750 }: { value: string; duration?: number }) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(0); // ค่าเริ่มของรอบถัดไป = ค่าล่าสุดที่ถึง (ครั้งแรก = 0)

  useEffect(() => {
    const m = /^(\D*)([\d,]+(?:\.\d+)?)(.*)$/.exec(value);
    if (!m || typeof requestAnimationFrame === "undefined") { setDisplay(value); return; }
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setDisplay(value); return; }

    const [, prefix, numStr, suffix] = m;
    const target = parseFloat(numStr.replace(/,/g, ""));
    if (!isFinite(target)) { setDisplay(value); return; }
    const decimals = numStr.includes(".") ? numStr.split(".")[1].length : 0;
    const grouped = numStr.includes(",");
    const start = fromRef.current;
    const fmt = (n: number) => {
      const rounded = Number(n.toFixed(decimals));
      const body = grouped
        ? rounded.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
        : rounded.toFixed(decimals);
      return prefix + body + suffix;
    };

    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setDisplay(fmt(start + (target - start) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else { fromRef.current = target; setDisplay(fmt(target)); }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <>{display}</>;
}
