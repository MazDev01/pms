// แผงซ้าย (แบรนด์) — รูปโกดังเต็มแผงเป็นพื้นหลัง + wash gradient ให้ข้อความบนอ่านออก
// Tailwind ล้วน + inline SVG (ไม่พึ่ง icon library) · เป็น server component (ไม่มี state)
// รูป: ใช้ภาพจริงที่ /public/images/login-warehouse.png (สลับไฟล์/พาธได้ตามต้องการ)
// variant: "dealer" (ค่าเริ่มต้น — พอร์ทัลตัวแทน) · "hq" (พอร์ทัลสำนักงานใหญ่ · เนื้อหาบริหารทั้งเครือ)
import Image from "next/image";
const HERO_IMG = "/images/login-warehouse.png";

// ไอคอน 4 ตัว (ใช้ร่วมทั้งสอง variant) — dashboard / people / document / line-chart
const FEATURE_SVGS = [
  (
    <>
      <path d="M12 3v9l6.5 3.8" />
      <circle cx="12" cy="12" r="9" />
    </>
  ),
  (
    <>
      <path d="M17 20v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1" />
      <circle cx="9.5" cy="7" r="3.5" />
      <path d="M22 20v-1a4 4 0 0 0-3-3.87M16.5 3.6a3.5 3.5 0 0 1 0 6.8" />
    </>
  ),
  (
    <>
      <path d="M14 2v6h6" />
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M8 13h8M8 17h8M8 9h2" />
    </>
  ),
  (
    <>
      <path d="M3 3v18h18" />
      <path d="M7 15l4-5 3 3 5-7" />
    </>
  ),
];

const CONTENT = {
  dealer: {
    badge: "Sales & Dealer Management Platform",
    h1a: "ระบบบริหารงานขายและ",
    h1b: "ตัวแทนจำหน่ายครบวงจร",
    intro:
      "แพลตฟอร์มที่ช่วยให้คุณบริหารลูกค้า ติดตามงานขาย และวิเคราะห์ผลประกอบการได้อย่างมีประสิทธิภาพ",
    features: [
      { title: "Real-time Dashboard", desc: "ติดตามยอดขายและ KPI แบบเรียลไทม์" },
      { title: "Sales CRM", desc: "บริหารลูกค้าและโอกาสทางการขาย" },
      { title: "Quotation Management", desc: "สร้างและจัดการใบเสนอราคา" },
      { title: "Analytics & Reports", desc: "วิเคราะห์ข้อมูลเชิงลึก ช่วยตัดสินใจได้แม่นยำ" },
    ],
  },
  hq: {
    badge: "สำนักงานใหญ่ · HQ Management",
    h1a: "ศูนย์บริหารเครือข่าย",
    h1b: "ตัวแทนทั่วประเทศ",
    intro:
      "ศูนย์กลางบริหารเครือข่ายตัวแทน ควบคุมราคากลาง นโยบาย และติดตามผลประกอบการทั้งเครือได้จากที่เดียว",
    features: [
      { title: "ภาพรวมทั้งเครือ", desc: "ยอดขายและ KPI ของทุกตัวแทนแบบเรียลไทม์" },
      { title: "บริหารตัวแทน", desc: "จัดการเป้าหมาย สิทธิ์ และผลงานตัวแทนทั่วประเทศ" },
      { title: "ราคากลาง & นโยบาย", desc: "ควบคุมแคตตาล็อกและกฎธุรกิจส่วนกลาง" },
      { title: "วิเคราะห์เชิงลึก", desc: "รายงานผลประกอบการทั้งเครือ ช่วยตัดสินใจแม่นยำ" },
    ],
  },
};

export default function HeroSection({ variant = "dealer" }: { variant?: "dealer" | "hq" }) {
  const c = CONTENT[variant];
  const features = c.features.map((f, i) => ({ ...f, svg: FEATURE_SVGS[i] }));

  return (
    <div className="relative flex min-h-[600px] flex-col overflow-hidden">
      {/* fallback gradient (โผล่ระหว่างรูปกำลังโหลด) */}
      <div className="absolute inset-0 bg-gradient-to-br from-white via-[#eef4fc] to-[#dbe8f8]" />

      {/* รูปโกดังเต็มแผง — next/image แทน <img> ตรง ๆ: เดิมโหลดไฟล์ PNG ต้นฉบับเต็ม 1.96MB ทุกครั้ง
          (1672×941px แสดงจริงแค่ ~460×600px, cache-control max-age=0) next/image ย่อ+แปลงเป็น
          WebP/AVIF ตามขนาดจอจริงให้อัตโนมัติ (พบจากผลตรวจสอบระบบรอบ 2, 31 ก.ค. 69) */}
      <Image
        src={HERO_IMG}
        alt="Benjamin PEB Steel Building"
        fill
        priority
        sizes="(min-width: 1024px) 50vw, 100vw"
        className="object-cover"
        style={{ objectPosition: "34% 62%" }}
      />

      {/* wash gradient — ม่านขาวบางให้เห็นรูปโกดังชัด · ตัวอักษรพึ่ง halo (text-shadow) ในการอ่าน ไม่ใช่ม่าน */}
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(238,244,252,0.58)_0%,rgba(238,244,252,0.44)_50%,rgba(238,244,252,0.34)_100%)]" />
      {/* ม่านเสริมเฉพาะครึ่งล่าง — โปร่งครึ่งบน (คงรูป/ท้องฟ้า) เข้มขึ้นครึ่งล่างตรงประตูโกดังที่พื้นเข้ม ให้คำอธิบายล่างอ่านคม */}
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_0%,transparent_48%,rgba(238,244,252,0.34)_74%,rgba(238,244,252,0.55)_100%)]" />

      {/* เนื้อหา — flex-1 + justify-between: กลุ่มแบรนด์ชิดบน · ฟีเจอร์ดันลงล่าง (เต็มแผง ไม่เหลือรูปว่าง)
          ระยะห่างย่อ ~90% แต่ขนาดฟอนต์คงเดิม · text-shadow ขาวถ่ายทอด (inherit) ให้อ่านคมบนพื้นรูป */}
      <div className="relative z-10 flex flex-1 flex-col justify-between gap-8 px-11 py-9 [text-shadow:0_1px_3px_rgba(255,255,255,0.9),0_0_10px_rgba(255,255,255,0.6)]">
        {/* กลุ่มแบรนด์ (บน) */}
        <div className="flex flex-col gap-7">
          {/* Logo — โลโก้จริงของ Benjamin (B mark + wordmark + tagline) · ต้นฉบับ 801×276 คมชัด */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/benjamin-logo.png" alt="Benjamin — Pre-Engineered Building" width={801} height={276} className="h-16 w-auto self-start select-none" />

          {/* Badge */}
          <div>
            <span className="inline-flex rounded-full bg-[#dbe8f8] px-4 py-2 text-[0.66rem] font-bold uppercase tracking-[0.14em] text-[#1d4ed8]">
              {c.badge}
            </span>
          </div>

          {/* Heading */}
          <div>
            <h1 className="text-[2.1rem] font-extrabold leading-[1.2] tracking-tight text-[#0e2a5c]">
              {c.h1a}
              <br />
              {c.h1b}
            </h1>
            <p className="mt-4 max-w-[28rem] text-[15px] font-medium leading-relaxed text-slate-700">
              {c.intro}
            </p>
          </div>
        </div>

        {/* Features (ล่าง) — ดันชิดล่างด้วย justify-between */}
        <ul className="flex flex-col gap-5">
          {features.map((f) => (
            <li key={f.title} className="flex items-start gap-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#dbe8f8]">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {f.svg}
                </svg>
              </span>
              <span className="min-w-0 pt-0.5">
                <span className="block text-sm font-bold text-[#0e2a5c]">{f.title}</span>
                <span className="block text-[0.82rem] font-semibold leading-snug text-[#0e2a5c]">{f.desc}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
