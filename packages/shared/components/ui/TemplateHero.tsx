// ── ภาพประกอบแม่แบบ (SVG) — เลือกฉากตามชื่อ/ประเภทอาคาร · ใช้เมื่อไม่มีรูปจริง ──
// ใช้ร่วม: หน้าแม่แบบ (products) + หน้าลูกค้า (customers) ดึงตามอาคารที่ซื้อ
export function heroKind(name: string): "warehouse" | "factory" | "office" {
  if (/โกดัง|คลัง|เก็บ|warehouse/i.test(name)) return "warehouse";
  if (/โรงงาน|ผลิต|อุตสาห|factory/i.test(name)) return "factory";
  return "office";
}

export function TemplateHero({ name, big = false }: { name: string; big?: boolean }) {
  const kind = heroKind(name);
  const win = "#bcd3ee";
  return (
    <svg viewBox="0 0 320 132" preserveAspectRatio="xMidYMid slice" role="img" aria-label={name}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
      <rect width="320" height="132" fill="#eaf1fb" />
      <circle cx={big ? 260 : 262} cy="30" r="16" fill="#fdf3d6" />
      <rect y="112" width="320" height="20" fill="#dfe7f0" />
      {kind === "warehouse" && (
        <g>
          <polygon points="34,56 160,36 286,56" fill="#274b6d" />
          <rect x="40" y="56" width="240" height="56" fill="#31567a" />
          <rect x="128" y="72" width="64" height="40" fill={win} />
          {[76, 84, 92, 100].map(y => <line key={y} x1="128" y1={y} x2="192" y2={y} stroke="#8fb0d4" strokeWidth="1.5" />)}
          <rect x="58" y="72" width="26" height="26" fill="#22405e" />
          <rect x="236" y="72" width="26" height="26" fill="#22405e" />
        </g>
      )}
      {kind === "factory" && (
        <g>
          <rect x="246" y="30" width="16" height="82" fill="#274b6d" />
          <circle cx="254" cy="26" r="7" fill="#e4ecf5" /><circle cx="266" cy="18" r="9" fill="#eef3f9" />
          <rect x="30" y="60" width="196" height="52" fill="#31567a" />
          {[30, 74, 118, 162].map(x => <polygon key={x} points={`${x},60 ${x + 22},48 ${x + 44},60`} fill="#274b6d" />)}
          {[46, 90, 134, 178].map(x => <rect key={x} x={x} y="74" width="26" height="30" fill={win} />)}
        </g>
      )}
      {kind === "office" && (
        <g>
          <rect x="52" y="26" width="112" height="86" fill="#31567a" />
          <rect x="176" y="58" width="92" height="54" fill="#274b6d" />
          {[0, 1, 2, 3].map(r => [0, 1, 2, 3].map(c =>
            <rect key={`${r}-${c}`} x={64 + c * 24} y={38 + r * 18} width="14" height="11" fill={win} />))}
          {[0, 1, 2].map(r => [0, 1, 2].map(c =>
            <rect key={`b${r}-${c}`} x={186 + c * 26} y={68 + r * 14} width="15" height="9" fill={win} />))}
        </g>
      )}
    </svg>
  );
}
