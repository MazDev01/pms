"use client";

import { useState } from "react";

type Product = {
  code: string;
  name: string;
  nameEn: string;
  category: "structure" | "roofing" | "wall" | "accessory" | "package";
  unit: string;
  price: string;
  priceNum: number;
  minOrder: string;
  lead: string;
  status: "active" | "draft" | "discontinued";
  tags: string[];
};

const PRODUCTS: Product[] = [
  // โครงสร้างหลัก
  { code:"PEB-S01", name:"อาคารเหล็กสำเร็จรูป 10×10 ม.", nameEn:"PEB Standard 10×10m", category:"structure", unit:"ชุด", price:"฿485,000", priceNum:485000, minOrder:"1 ชุด", lead:"45–60 วัน", status:"active", tags:["โกดัง","สำนักงาน"] },
  { code:"PEB-S02", name:"อาคารเหล็กสำเร็จรูป 15×20 ม.", nameEn:"PEB Standard 15×20m", category:"structure", unit:"ชุด", price:"฿920,000", priceNum:920000, minOrder:"1 ชุด", lead:"60–75 วัน", status:"active", tags:["โกดัง","โรงงาน"] },
  { code:"PEB-S03", name:"อาคารเหล็กสำเร็จรูป 20×30 ม.", nameEn:"PEB Standard 20×30m", category:"structure", unit:"ชุด", price:"฿1,650,000", priceNum:1650000, minOrder:"1 ชุด", lead:"60–75 วัน", status:"active", tags:["โรงงาน","คลังสินค้า"] },
  { code:"PEB-S04", name:"อาคารเหล็กสำเร็จรูป 24×40 ม.", nameEn:"PEB Standard 24×40m", category:"structure", unit:"ชุด", price:"฿2,800,000", priceNum:2800000, minOrder:"1 ชุด", lead:"75–90 วัน", status:"active", tags:["โรงงาน","คลังสินค้า"] },
  { code:"PEB-C01", name:"อาคารเหล็กออกแบบพิเศษ (Custom)", nameEn:"PEB Custom Design", category:"structure", unit:"ตร.ม.", price:"฿4,200–5,800", priceNum:4200, minOrder:"150 ตร.ม.", lead:"90+ วัน", status:"active", tags:["Custom","ออกแบบพิเศษ"] },
  // ระบบหลังคา
  { code:"RF-H01", name:"แผ่นหลังคา Hi-Rib 0.47mm", nameEn:"Hi-Rib Roofing Sheet", category:"roofing", unit:"ตร.ม.", price:"฿380", priceNum:380, minOrder:"50 ตร.ม.", lead:"7–14 วัน", status:"active", tags:["หลังคา","มาตรฐาน"] },
  { code:"RF-L01", name:"แผ่นหลังคา Longrib 0.47mm", nameEn:"Longrib Roofing Sheet", category:"roofing", unit:"ตร.ม.", price:"฿420", priceNum:420, minOrder:"50 ตร.ม.", lead:"7–14 วัน", status:"active", tags:["หลังคา","พรีเมียม"] },
  { code:"RF-I01", name:"แผ่นหลังคาพร้อมฉนวน Sandwich 50mm", nameEn:"Sandwich Panel Roof 50mm", category:"roofing", unit:"ตร.ม.", price:"฿680", priceNum:680, minOrder:"50 ตร.ม.", lead:"14–21 วัน", status:"active", tags:["ฉนวน","เก็บความเย็น"] },
  { code:"RF-G01", name:"รางน้ำฝน Seamless Gutter", nameEn:"Seamless Gutter", category:"roofing", unit:"เมตร", price:"฿650", priceNum:650, minOrder:"20 เมตร", lead:"7 วัน", status:"active", tags:["อุปกรณ์"] },
  // ระบบผนัง
  { code:"WL-M01", name:"แผ่นผนัง Metal Sheet 0.35mm", nameEn:"Metal Wall Sheet 0.35mm", category:"wall", unit:"ตร.ม.", price:"฿280", priceNum:280, minOrder:"50 ตร.ม.", lead:"7–14 วัน", status:"active", tags:["ผนัง","มาตรฐาน"] },
  { code:"WL-S01", name:"แผ่นผนัง Sandwich Panel 50mm", nameEn:"Sandwich Wall Panel 50mm", category:"wall", unit:"ตร.ม.", price:"฿720", priceNum:720, minOrder:"50 ตร.ม.", lead:"14–21 วัน", status:"active", tags:["ผนัง","ฉนวน"] },
  { code:"WL-S02", name:"แผ่นผนัง Sandwich Panel 75mm", nameEn:"Sandwich Wall Panel 75mm", category:"wall", unit:"ตร.ม.", price:"฿820", priceNum:820, minOrder:"50 ตร.ม.", lead:"14–21 วัน", status:"active", tags:["ผนัง","เก็บความเย็น"] },
  // อุปกรณ์เสริม
  { code:"AC-D01", name:"ประตูม้วนเหล็ก 3×3 ม.", nameEn:"Rolling Steel Door 3×3m", category:"accessory", unit:"บาน", price:"฿28,000", priceNum:28000, minOrder:"1 บาน", lead:"14 วัน", status:"active", tags:["ประตู"] },
  { code:"AC-D02", name:"ประตูบานสวิง คู่ 2×2.4 ม.", nameEn:"Swing Door 2×2.4m", category:"accessory", unit:"บาน", price:"฿12,500", priceNum:12500, minOrder:"1 บาน", lead:"14 วัน", status:"active", tags:["ประตู"] },
  { code:"AC-W01", name:"หน้าต่างอลูมิเนียม 1.5×1.2 ม.", nameEn:"Aluminium Window 1.5×1.2m", category:"accessory", unit:"บาน", price:"฿4,800", priceNum:4800, minOrder:"4 บาน", lead:"14 วัน", status:"active", tags:["หน้าต่าง"] },
  { code:"AC-V01", name:"ผ้าใบฉนวนกันความร้อน (Bubble Foil)", nameEn:"Bubble Foil Insulation", category:"accessory", unit:"ตร.ม.", price:"฿120", priceNum:120, minOrder:"100 ตร.ม.", lead:"7 วัน", status:"active", tags:["ฉนวน"] },
  // แพ็กเกจ
  { code:"PKG-W01", name:"แพ็กเกจโกดัง 10×20 ม. ครบชุด", nameEn:"Warehouse Package 10×20m", category:"package", unit:"แพ็กเกจ", price:"฿1,250,000", priceNum:1250000, minOrder:"1 แพ็กเกจ", lead:"60–75 วัน", status:"active", tags:["โกดัง","ครบชุด"] },
  { code:"PKG-F01", name:"แพ็กเกจโรงงาน 20×40 ม. ครบชุด", nameEn:"Factory Package 20×40m", category:"package", unit:"แพ็กเกจ", price:"฿3,800,000", priceNum:3800000, minOrder:"1 แพ็กเกจ", lead:"90–120 วัน", status:"active", tags:["โรงงาน","ครบชุด"] },
  { code:"PKG-O01", name:"แพ็กเกจสำนักงาน Prefab 6×9 ม.", nameEn:"Prefab Office 6×9m", category:"package", unit:"แพ็กเกจ", price:"฿620,000", priceNum:620000, minOrder:"1 แพ็กเกจ", lead:"30–45 วัน", status:"active", tags:["สำนักงาน","Prefab"] },
];

type TabKey = "all" | "structure" | "roofing" | "wall" | "accessory" | "package";

const TABS: { key: TabKey; label: string }[] = [
  { key: "all",       label: "ทั้งหมด" },
  { key: "structure", label: "โครงสร้างหลัก" },
  { key: "roofing",   label: "ระบบหลังคา" },
  { key: "wall",      label: "ระบบผนัง" },
  { key: "accessory", label: "อุปกรณ์เสริม" },
  { key: "package",   label: "แพ็กเกจ" },
];

const CAT_COLORS: Record<string, string> = {
  structure: "#003366",
  roofing:   "#0284c7",
  wall:      "#7c3aed",
  accessory: "#d97706",
  package:   "#059669",
};

const CAT_LABELS: Record<string, string> = {
  structure: "โครงสร้างหลัก",
  roofing:   "ระบบหลังคา",
  wall:      "ระบบผนัง",
  accessory: "อุปกรณ์เสริม",
  package:   "แพ็กเกจ",
};

export default function HQMasterPage() {
  const [activeTab,    setActiveTab]    = useState<TabKey>("all");
  const [searchQ,      setSearchQ]      = useState("");
  const [editProduct,  setEditProduct]  = useState<Product | null>(null);
  const [products,     setProducts]     = useState<Product[]>(PRODUCTS);
  const [editPrice,    setEditPrice]    = useState("");
  const [editLead,     setEditLead]     = useState("");
  const [editMinOrder, setEditMinOrder] = useState("");

  const filtered = products.filter(p => {
    const matchTab = activeTab === "all" || p.category === activeTab;
    const q = searchQ.toLowerCase();
    const matchSearch = !q ||
      p.name.toLowerCase().includes(q) ||
      p.nameEn.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      p.tags.some(t => t.toLowerCase().includes(q));
    return matchTab && matchSearch;
  });

  function openEdit(p: Product) {
    setEditProduct(p);
    setEditPrice(p.price);
    setEditLead(p.lead);
    setEditMinOrder(p.minOrder);
  }

  function saveEdit() {
    if (!editProduct) return;
    setProducts(prev =>
      prev.map(p =>
        p.code === editProduct.code
          ? { ...p, price: editPrice, lead: editLead, minOrder: editMinOrder }
          : p
      )
    );
    setEditProduct(null);
  }

  const activeCount = products.filter(p => p.status === "active").length;

  return (
    <div className="erp">
      {/* Header */}
      <div className="page-head">
        <div>
          <h2>แคตตาล็อกสินค้า</h2>
          <p>รายการสินค้าที่ดีลเลอร์สามารถนำเสนอต่อลูกค้าได้</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="search"
            className="form-input"
            placeholder="ค้นหารหัส / ชื่อสินค้า / แท็ก..."
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            style={{ width: 240 }}
          />
          <button className="btn btn-primary btn-sm">+ เพิ่มสินค้า</button>
        </div>
      </div>

      {/* Summary strip */}
      <div className="stat-grid" style={{ marginBottom: "1.25rem" }}>
        <div className="stat-card">
          <div className="stat-label">สินค้าทั้งหมด</div>
          <div className="stat-value">{products.length} รายการ</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">ใช้งานอยู่</div>
          <div className="stat-value">{activeCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">หมวดหมู่</div>
          <div className="stat-value">5</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">อัปเดตล่าสุด</div>
          <div className="stat-value">1 มิ.ย. 2569</div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="tab-bar" style={{ marginBottom: "1rem" }}>
        {TABS.map(t => (
          <button
            key={t.key}
            className={`tab-item${activeTab === t.key ? " active" : ""}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Product table */}
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>รหัส</th>
                <th>ชื่อสินค้า</th>
                <th>หมวดหมู่</th>
                <th>หน่วย</th>
                <th className="num">ราคามาตรฐาน</th>
                <th>ระยะเวลา</th>
                <th>สถานะ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", color: "var(--muted-foreground)", padding: "2rem" }}>
                    ไม่พบสินค้าที่ตรงกับเงื่อนไข
                  </td>
                </tr>
              )}
              {filtered.map(p => (
                <tr key={p.code}>
                  <td style={{ fontFamily: "monospace", fontSize: "0.72rem", color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>
                    {p.code}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, lineHeight: 1.3 }}>{p.name}</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--muted-foreground)", marginBottom: 4 }}>{p.nameEn}</div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {p.tags.map(tag => (
                        <span key={tag} style={{
                          fontSize: "0.65rem",
                          padding: "1px 7px",
                          borderRadius: 999,
                          background: "#f1f5f9",
                          color: "#475569",
                          fontWeight: 500,
                        }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <span style={{
                      display: "inline-block",
                      padding: "2px 10px",
                      borderRadius: 999,
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      background: CAT_COLORS[p.category] + "18",
                      color: CAT_COLORS[p.category],
                      whiteSpace: "nowrap",
                    }}>
                      {CAT_LABELS[p.category]}
                    </span>
                  </td>
                  <td style={{ color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>{p.unit}</td>
                  <td className="num" style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{p.price}</td>
                  <td style={{ fontSize: "0.8rem", color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>{p.lead}</td>
                  <td>
                    {p.status === "active" ? (
                      <span className="badge" style={{ background: "#e5faf0", color: "#059669" }}>เปิดใช้งาน</span>
                    ) : p.status === "draft" ? (
                      <span className="badge" style={{ background: "#f3f4f6", color: "#6b7280" }}>ร่าง</span>
                    ) : (
                      <span className="badge" style={{ background: "#fef2f2", color: "#dc2626" }}>ยกเลิก</span>
                    )}
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}>แก้ไข</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit modal */}
      {editProduct && (
        <>
          <div
            onClick={() => setEditProduct(null)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", zIndex: 200 }}
          />
          <div
            className="card"
            style={{
              position: "fixed", top: "50%", left: "50%",
              transform: "translate(-50%,-50%)",
              zIndex: 201, padding: "28px 32px", width: 440,
              boxShadow: "0 16px 48px rgba(0,0,0,.2)",
            }}
          >
            <div style={{ marginBottom: 20 }}>
              <div className="card-title" style={{ marginBottom: 2 }}>แก้ไขสินค้า</div>
              <div className="card-desc">{editProduct.code} — {editProduct.name}</div>
            </div>

            {/* Read-only fields */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 16 }}>
              <div>
                <label className="form-label">รหัสสินค้า</label>
                <input className="form-input" value={editProduct.code} readOnly
                  style={{ background: "var(--muted)", color: "var(--muted-foreground)", cursor: "not-allowed" }} />
              </div>
              <div>
                <label className="form-label">ชื่อสินค้า</label>
                <input className="form-input" value={editProduct.name} readOnly
                  style={{ background: "var(--muted)", color: "var(--muted-foreground)", cursor: "not-allowed" }} />
              </div>
              <div>
                <label className="form-label">หมวดหมู่</label>
                <input className="form-input" value={CAT_LABELS[editProduct.category]} readOnly
                  style={{ background: "var(--muted)", color: "var(--muted-foreground)", cursor: "not-allowed" }} />
              </div>

              {/* Editable fields */}
              <div>
                <label className="form-label">ราคามาตรฐาน</label>
                <input
                  className="form-input"
                  value={editPrice}
                  onChange={e => setEditPrice(e.target.value)}
                  placeholder="฿000,000"
                />
              </div>
              <div>
                <label className="form-label">ระยะเวลา</label>
                <input
                  className="form-input"
                  value={editLead}
                  onChange={e => setEditLead(e.target.value)}
                  placeholder="เช่น 30–45 วัน"
                />
              </div>
              <div>
                <label className="form-label">สั่งขั้นต่ำ</label>
                <input
                  className="form-input"
                  value={editMinOrder}
                  onChange={e => setEditMinOrder(e.target.value)}
                  placeholder="เช่น 1 ชุด"
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-secondary btn-md" onClick={() => setEditProduct(null)}>ยกเลิก</button>
              <button className="btn btn-primary btn-md" onClick={saveEdit}>บันทึก</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
