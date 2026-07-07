"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, Check } from "lucide-react";
import { loadResponsiblePersons, type ResponsiblePerson } from "@/lib/mock";

const NAVY = "#003366";

// วงกลมรูป/อักษรย่อของผู้รับผิดชอบ — ใช้ซ้ำได้ทั้ง trigger และรายการ
export function PersonAvatar({ name, avatar, size = 26 }: { name: string; avatar?: string; size?: number }) {
  if (avatar) {
    return <img src={avatar} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  }
  return (
    <span style={{
      width: size, height: size, borderRadius: "50%", background: NAVY, flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontSize: size * 0.42, fontWeight: 800,
    }}>{(name || "?").charAt(0)}</span>
  );
}

// แสดงผู้รับผิดชอบแบบอ่านอย่างเดียว — อวตารซ้อน (สูงสุด max) + ชื่อ · รองรับหลายคน (คั่นด้วย ",")
export function AssigneeAvatars({ value, size = 22, showName = true, max = 3 }: {
  value: string; size?: number; showName?: boolean; max?: number;
}) {
  const [persons, setPersons] = useState<ResponsiblePerson[]>([]);
  useEffect(() => { setPersons(loadResponsiblePersons()); }, []);
  const names = value ? value.split(",").map(s => s.trim()).filter(Boolean) : [];
  if (names.length === 0) return <span style={{ color: "#9ca3af", fontSize: "0.72rem" }}>—</span>;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
      <span style={{ display: "flex", flexShrink: 0 }}>
        {names.slice(0, max).map((n, i) => (
          <span key={n} title={n} style={{ marginLeft: i === 0 ? 0 : -8, borderRadius: "50%", border: "2px solid #fff", display: "flex" }}>
            <PersonAvatar name={n} avatar={persons.find(p => p.name === n)?.avatar} size={size} />
          </span>
        ))}
        {names.length > max && (
          <span style={{ marginLeft: -8, width: size, height: size, borderRadius: "50%", border: "2px solid #fff", background: "#e5e7eb", color: "#475569", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.4, fontWeight: 800 }}>+{names.length - max}</span>
        )}
      </span>
      {showName && (
        <span style={{ fontSize: "0.72rem", color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {names.length === 1 ? names[0] : `${names[0]} +${names.length - 1}`}
        </span>
      )}
    </span>
  );
}

// ตัวเลือกผู้รับผิดชอบแบบมีรูป + ชื่อ (แทน <select> ที่โชว์รูปไม่ได้)
// multiple = true → เลือกได้หลายคน · value เก็บเป็นชื่อคั่นด้วย ", " (string เดิม ไม่เปลี่ยน type)
export function PersonPicker({ value, onChange, style, placeholder = "เลือกผู้รับผิดชอบ", multiple = false }: {
  value: string;
  onChange: (name: string) => void;
  style?: React.CSSProperties;
  placeholder?: string;
  multiple?: boolean;
}) {
  const [persons, setPersons] = useState<ResponsiblePerson[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setPersons(loadResponsiblePersons().filter(p => p.active)); }, []);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const names = value ? value.split(",").map(s => s.trim()).filter(Boolean) : [];
  const isSel = (name: string) => names.includes(name);
  function pick(name: string) {
    if (multiple) {
      const next = isSel(name) ? names.filter(n => n !== name) : [...names, name];
      onChange(next.join(", "));
      // ไม่ปิด dropdown — เลือกต่อได้หลายคน
    } else {
      onChange(name);
      setOpen(false);
    }
  }
  const first = persons.find(p => p.name === names[0]);

  return (
    <div ref={ref} style={{ position: "relative", ...style }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 8, boxSizing: "border-box",
          padding: "6px 11px", borderRadius: 8, border: "1px solid #e5e7eb", minHeight: 38,
          background: "#fff", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
        }}>
        {names.length > 0
          ? <>
              {/* รูปซ้อนกัน (สูงสุด 3) */}
              <span style={{ display: "flex", flexShrink: 0 }}>
                {names.slice(0, 3).map((n, i) => (
                  <span key={n} style={{ marginLeft: i === 0 ? 0 : -8, borderRadius: "50%", border: "2px solid #fff", display: "flex" }}>
                    <PersonAvatar name={n} avatar={persons.find(p => p.name === n)?.avatar ?? (i === 0 ? first?.avatar : undefined)} size={20} />
                  </span>
                ))}
              </span>
              <span style={{ flex: 1, minWidth: 0, fontSize: "0.8rem", fontWeight: 600, color: "#2D2D2D", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {names.length === 1 ? names[0] : `${names[0]} +${names.length - 1}`}
              </span>
            </>
          : <span style={{ flex: 1, fontSize: "0.8rem", color: "#9ca3af" }}>{placeholder}</span>}
        <ChevronDown size={14} color="#9ca3af" style={{ flexShrink: 0 }} />
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 50,
          background: "#fff", border: "1px solid #e5e7eb", borderRadius: 11,
          boxShadow: "0 12px 32px rgba(0,0,0,.14)", overflow: "hidden", maxHeight: 280, overflowY: "auto",
        }}>
          {multiple && (
            <div style={{ padding: "8px 14px", fontSize: "0.65rem", fontWeight: 700, color: "#6b7280", borderBottom: "1px solid #f0f4f8", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>เลือกได้หลายคน · เลือกแล้ว {names.length}</span>
              <button type="button" onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: NAVY, fontWeight: 700, cursor: "pointer", fontSize: "0.72rem", fontFamily: "inherit" }}>เสร็จ</button>
            </div>
          )}
          {persons.length === 0 && (
            <div style={{ padding: "12px 14px", fontSize: "0.8rem", color: "#9ca3af" }}>ยังไม่มีผู้รับผิดชอบ</div>
          )}
          {persons.map(p => {
            const active = isSel(p.name);
            return (
              <button key={p.id} type="button"
                onClick={() => pick(p.name)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 12px", border: "none", cursor: "pointer", textAlign: "left",
                  background: active ? "#f0f6ff" : "#fff", fontFamily: "inherit",
                }}>
                {multiple && (
                  <span style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, border: `2px solid ${active ? NAVY : "#cbd5e1"}`, background: active ? NAVY : "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {active && <Check size={11} color="#fff" strokeWidth={3} />}
                  </span>
                )}
                <PersonAvatar name={p.name} avatar={p.avatar} size={30} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: active ? NAVY : "#2D2D2D", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                  <span style={{ display: "block", fontSize: "0.65rem", color: "#6b7280" }}>{p.title}</span>
                </span>
                {!multiple && active && <Check size={15} color={NAVY} style={{ flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
