"use client";

import { useMasterCatalog } from "@pms/shared/lib/useMasterCatalog";

/** Dropdown เลือกแม่แบบ — จัดกลุ่ม (แม่แบบหลัก → แม่แบบย่อย) จากแคตตาล็อกกลาง
 *  เลือกได้ทั้งแม่แบบหลัก (ทั่วไป) และแม่แบบย่อยเฉพาะ · value = ชื่อที่เลือก (string เดิม) */
export function TemplateSelect({ value, onChange, style, className }: {
  value: string;
  onChange: (v: string) => void;
  style?: React.CSSProperties;
  className?: string;
}) {
  const catalog = useMasterCatalog();
  const known = catalog.some(p => p.name === value || (p.subtypes ?? []).includes(value));
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={style} className={className}>
      {/* ค่าที่ไม่ตรงแคตตาล็อก (ข้อมูลเก่า) — คงไว้กันหาย */}
      {!known && value && <option value={value}>{value}</option>}
      {catalog.map(p => (
        (p.subtypes && p.subtypes.length > 0)
          ? (
            <optgroup key={p.id} label={p.name}>
              <option value={p.name}>{p.name} · ทั่วไป</option>
              {p.subtypes.map(s => <option key={s} value={s}>{s}</option>)}
            </optgroup>
          )
          : <option key={p.id} value={p.name}>{p.name}</option>
      ))}
    </select>
  );
}
