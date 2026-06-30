"use client";

import React, { useState, useMemo } from "react";
import {
  Package, FileText, Download, Search, Lock, Building2, Tag,
} from "lucide-react";

// ── Design tokens ─────────────────────────────────────────────
const PRIMARY = "#003366";
const STEEL   = "#2D2D2D";
const BORDER  = "#e5e7eb";
const MUTED   = "#6b7280";

// ── Types ─────────────────────────────────────────────────────
type Category = "EasyBuild" | "RanBuild" | "Prefab";
type Product = {
  code: string;
  name: string;
  category: Category;
  spec: string;
  price: number;
  unit: string;
};

// ── หมวดสินค้า (สีประจำหมวด) ───────────────────────────────────
const CATEGORY_META: Record<Category, { label: string; desc: string; bg: string; color: string }> = {
  EasyBuild: { label: "EasyBuild", desc: "อาคารสำเร็จรูปมาตรฐาน", bg: "#dce5f0", color: PRIMARY },
  RanBuild:  { label: "RanBuild",  desc: "โครงสร้างเหล็กโรงงาน/คลัง", bg: "#e7eef5", color: "#2D2D2D" },
  Prefab:    { label: "Prefab",    desc: "อาคารพรีแฟบ", bg: "#eef0f3", color: "#4b5563" },
};

const TABS: { value: "all" | Category; label: string }[] = [
  { value: "all",       label: "ทั้งหมด" },
  { value: "EasyBuild", label: "EasyBuild" },
  { value: "RanBuild",  label: "RanBuild" },
  { value: "Prefab",    label: "Prefab" },
];

// ── ข้อมูลสินค้า (mock — กำหนดโดย HQ) ──────────────────────────
const PRODUCTS: Product[] = [
  // EasyBuild — อาคารสำเร็จรูปมาตรฐาน
  { code: "EB-S100",  name: "EasyBuild สำนักงานสำเร็จรูป S",  category: "EasyBuild", spec: "พื้นที่ 36 ตร.ม. · ผนังแซนวิช 50 มม. · ติดตั้งใน 7 วัน",   price: 285000,  unit: "หลัง" },
  { code: "EB-M150",  name: "EasyBuild สำนักงานสำเร็จรูป M",  category: "EasyBuild", spec: "พื้นที่ 72 ตร.ม. · 2 ห้อง + ห้องน้ำ · ฉนวนกันความร้อน",  price: 540000,  unit: "หลัง" },
  { code: "EB-L240",  name: "EasyBuild อาคารพักอาศัย L",      category: "EasyBuild", spec: "พื้นที่ 120 ตร.ม. · 2 ชั้น · โครงเหล็กชุบกัลวาไนซ์",   price: 1180000, unit: "หลัง" },
  { code: "EB-GR40",  name: "EasyBuild ป้อมยาม",             category: "EasyBuild", spec: "พื้นที่ 4 ตร.ม. · กระจกรอบด้าน · พร้อมใช้งานทันที",     price: 86000,   unit: "หลัง" },

  // RanBuild — โครงสร้างเหล็กโรงงาน/คลัง
  { code: "RB-W500",  name: "RanBuild คลังสินค้า W500",       category: "RanBuild", spec: "ช่วงเสา 20 ม. · สูง 8 ม. · หลังคาเมทัลชีท 0.47 มม.",   price: 4800,    unit: "ตร.ม." },
  { code: "RB-F800",  name: "RanBuild โรงงาน F800",           category: "RanBuild", spec: "ช่วงเสา 25 ม. · รับน้ำหนักเครน 5 ตัน · เหล็ก SS400",  price: 6200,    unit: "ตร.ม." },
  { code: "RB-H120",  name: "RanBuild โรงเก็บเครื่องจักร H",   category: "RanBuild", spec: "ช่วงเสา 30 ม. · ไม่มีเสากลาง · ระบายอากาศสันหลังคา", price: 5500,    unit: "ตร.ม." },
  { code: "RB-C300",  name: "RanBuild โรงจอดรถ Carport",      category: "RanBuild", spec: "โครงเหล็กกล่อง · หลังคาโปร่งแสง · กันสนิม 2 ชั้น",    price: 3200,    unit: "ตร.ม." },

  // Prefab — อาคารพรีแฟบ
  { code: "PF-D60",   name: "Prefab ห้องพักคนงาน D",          category: "Prefab", spec: "พื้นที่ 18 ตร.ม. · ถอดประกอบได้ · ขนย้ายสะดวก",       price: 64000,   unit: "หลัง" },
  { code: "PF-T90",   name: "Prefab ห้องน้ำสำเร็จรูป T",      category: "Prefab", spec: "3 ห้อง · สุขภัณฑ์ครบชุด · ระบบประปาในตัว",            price: 128000,  unit: "ชุด" },
  { code: "PF-K45",   name: "Prefab โรงอาหารชั่วคราว",        category: "Prefab", spec: "พื้นที่ 45 ตร.ม. · โครงเบา · เหมาะแคมป์งาน",          price: 195000,  unit: "หลัง" },
  { code: "PF-M30",   name: "Prefab อาคารโมดูลาร์ M",         category: "Prefab", spec: "ต่อขยายได้ · ผนังถอดเปลี่ยน · มาตรฐานส่งออก",        price: 240000,  unit: "ยูนิต" },
];

function fmtMoney(v: number) { return "฿" + v.toLocaleString("th-TH"); }

export default function DealerProductsPage() {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<"all" | Category>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PRODUCTS.filter(p => {
      const matchCat = cat === "all" || p.category === cat;
      const matchQ = !q ||
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.spec.toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  }, [query, cat]);

  return (
    <div className="erp">
      {/* ── หัวข้อหน้า ── */}
      <div className="page-head">
        <div>
          <h2>สินค้า</h2>
          <p>แคตตาล็อกสินค้ามาตรฐานเบนจามินสำหรับนำเสนอลูกค้า · กำหนดราคาโดย HQ</p>
        </div>
        <div style={{ position: "relative", width: 280, maxWidth: "100%" }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: MUTED }} />
          <input
            className="form-input"
            style={{ paddingLeft: 36 }}
            placeholder="ค้นหาชื่อ / รหัส / สเปก…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
      </div>

      {/* ── Banner: read-only ── */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: 10,
          background: "#f5f7fa", border: `1px solid ${BORDER}`,
          borderRadius: 12, padding: "10px 14px", marginBottom: 18,
          color: MUTED, fontSize: "0.8rem",
        }}
      >
        <Lock size={15} style={{ color: PRIMARY, flexShrink: 0 }} />
        <span>สินค้าและราคากลางกำหนดโดยสำนักงานใหญ่ — ไม่สามารถแก้ไขได้</span>
      </div>

      {/* ── หมวดสินค้า (tabs) ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        {TABS.map(t => {
          const active = cat === t.value;
          return (
            <button
              key={t.value}
              onClick={() => setCat(t.value)}
              className={`btn btn-sm ${active ? "btn-primary" : "btn-secondary"}`}
              style={active ? undefined : { color: STEEL }}
            >
              {t.value === "all" ? <Package size={13} /> : <Tag size={13} />}
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── Grid การ์ดสินค้า ── */}
      {filtered.length === 0 ? (
        <div className="card" style={{ padding: "48px 24px", textAlign: "center", color: MUTED }}>
          <Package size={32} style={{ color: "#C0C0C0", marginBottom: 10 }} />
          <div style={{ fontSize: "0.9rem" }}>ไม่พบสินค้าที่ตรงกับเงื่อนไข</div>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 18,
          }}
        >
          {filtered.map(p => {
            const meta = CATEGORY_META[p.category];
            return (
              <div key={p.code} className="card" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
                {/* รูป placeholder */}
                <div
                  style={{
                    height: 150, background: "#f3f5f8",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    borderBottom: `1px solid ${BORDER}`,
                  }}
                >
                  <Building2 size={44} style={{ color: "#C0C0C0" }} />
                </div>

                {/* เนื้อหา */}
                <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span className="badge" style={{ background: meta.bg, color: meta.color }}>
                      {meta.label}
                    </span>
                    <span style={{ fontSize: "0.7rem", color: MUTED, fontWeight: 700, letterSpacing: "0.02em" }}>
                      {p.code}
                    </span>
                  </div>

                  <div style={{ fontSize: "0.95rem", fontWeight: 700, color: STEEL, lineHeight: 1.35 }}>
                    {p.name}
                  </div>

                  <div style={{ fontSize: "0.78rem", color: MUTED, lineHeight: 1.5, flex: 1 }}>
                    {p.spec}
                  </div>

                  <div style={{ marginTop: 2, display: "flex", alignItems: "baseline", gap: 6 }}>
                    <span style={{ fontSize: "1.15rem", fontWeight: 800, color: PRIMARY }}>
                      {fmtMoney(p.price)}
                    </span>
                    <span style={{ fontSize: "0.74rem", color: MUTED }}>/ {p.unit}</span>
                  </div>

                  {/* ปุ่ม read-only */}
                  <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                    <button className="btn btn-secondary btn-sm" style={{ flex: 1, color: STEEL }}>
                      <FileText size={13} /> ดูสเปก
                    </button>
                    <button className="btn btn-secondary btn-sm" style={{ flex: 1, color: STEEL }}>
                      <Download size={13} /> ดาวน์โหลด PDF
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
