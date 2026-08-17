"use client";

import { useMasterCatalog } from "@pms/shared/lib/useMasterCatalog";

/** Dropdown เลือกแม่แบบ — จัดกลุ่ม (แม่แบบหลัก → แม่แบบย่อย) จากแคตตาล็อกกลาง
 *  เลือกได้ทั้งแม่แบบหลัก (ทั่วไป) และแม่แบบย่อยเฉพาะ · value = ชื่อที่เลือก (string เดิม) */
export function TemplateSelect({ value, onChange, style, className, ariaLabel }: {
  value: string;
  onChange: (v: string) => void;
  style?: React.CSSProperties;
  className?: string;
  ariaLabel?: string;
}) {
  const catalog = useMasterCatalog();
  const known = catalog.some(p => p.name === value || (p.subtypes ?? []).includes(value));
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={style} className={className} aria-label={ariaLabel}>
      {/* ⚠️ ต้องมีตัวเลือก "ยังไม่ระบุ" เสมอ ห้ามเอาออก (บั๊กจริง พบ 10 ส.ค. 69)
          ถ้าค่าจริงเป็นว่างแต่ไม่มีตัวเลือกว่างให้ตรง เบราว์เซอร์จะโชว์ตัวเลือกแรกแทน
          → หน้าจอบอกว่า "เลือกโกดังสำเร็จรูปแล้ว" ทั้งที่ในระบบยังว่าง
          ผลที่ผู้ใช้เจอ: บันทึกลูกค้าเป้าหมายแล้วออกใบเสนอราคาไม่ได้เลย เพราะตารางรายการต้องใช้แม่แบบ
          แต่หน้าจอยังยืนยันว่ามีแม่แบบอยู่ ไม่มีทางเดาถูกว่าอะไรผิด */}
      <option value="">— ยังไม่ระบุแม่แบบ —</option>
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
