"use client";

import { useState } from "react";

type PriceHistoryEntry = {
  price: number;
  effectiveDate: string;
  note?: string;
};

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
  effectiveDate: string;
  priceHistory: PriceHistoryEntry[];
};

const PRODUCTS: Product[] = [
  // โครงสร้างหลัก
  { code:"PEB-S01", name:"อาคารเหล็กสำเร็จรูป 10×10 ม.", nameEn:"PEB Standard 10×10m", category:"structure", unit:"ชุด", price:"฿485,000", priceNum:485000, minOrder:"1 ชุด", lead:"45–60 วัน", status:"active", tags:["โกดัง","สำนักงาน"], effectiveDate:"1 มิ.ย. 2569", priceHistory:[ { price:465000, effectiveDate:"1 ม.ค. 2569", note:"ราคาต้นปี" }, { price:448000, effectiveDate:"1 ก.ค. 2568", note:"ราคาเดิม" } ] },
  { code:"PEB-S02", name:"อาคารเหล็กสำเร็จรูป 15×20 ม.", nameEn:"PEB Standard 15×20m", category:"structure", unit:"ชุด", price:"฿920,000", priceNum:920000, minOrder:"1 ชุด", lead:"60–75 วัน", status:"active", tags:["โกดัง","โรงงาน"], effectiveDate:"1 มิ.ย. 2569", priceHistory:[ { price:890000, effectiveDate:"1 ม.ค. 2569", note:"ปรับตามราคาเหล็ก" }, { price:865000, effectiveDate:"1 ก.ค. 2568" } ] },
  { code:"PEB-S03", name:"อาคารเหล็กสำเร็จรูป 20×30 ม.", nameEn:"PEB Standard 20×30m", category:"structure", unit:"ชุด", price:"฿1,650,000", priceNum:1650000, minOrder:"1 ชุด", lead:"60–75 วัน", status:"active", tags:["โรงงาน","คลังสินค้า"], effectiveDate:"1 มิ.ย. 2569", priceHistory:[ { price:1590000, effectiveDate:"1 ม.ค. 2569" } ] },
  { code:"PEB-S04", name:"อาคารเหล็กสำเร็จรูป 24×40 ม.", nameEn:"PEB Standard 24×40m", category:"structure", unit:"ชุด", price:"฿2,800,000", priceNum:2800000, minOrder:"1 ชุด", lead:"75–90 วัน", status:"active", tags:["โรงงาน","คลังสินค้า"], effectiveDate:"1 มิ.ย. 2569", priceHistory:[ { price:2720000, effectiveDate:"1 ม.ค. 2569", note:"ปรับตามราคาเหล็ก" }, { price:2650000, effectiveDate:"1 ก.ค. 2568", note:"ราคาเปิดตัว" } ] },
  { code:"PEB-C01", name:"อาคารเหล็กออกแบบพิเศษ (Custom)", nameEn:"PEB Custom Design", category:"structure", unit:"ตร.ม.", price:"฿4,200–5,800", priceNum:4200, minOrder:"150 ตร.ม.", lead:"90+ วัน", status:"active", tags:["Custom","ออกแบบพิเศษ"], effectiveDate:"1 มิ.ย. 2569", priceHistory:[ { price:4000, effectiveDate:"1 ม.ค. 2569", note:"ราคาเริ่มต้นเดิม" } ] },
  // ระบบหลังคา
  { code:"RF-H01", name:"แผ่นหลังคา Hi-Rib 0.47mm", nameEn:"Hi-Rib Roofing Sheet", category:"roofing", unit:"ตร.ม.", price:"฿380", priceNum:380, minOrder:"50 ตร.ม.", lead:"7–14 วัน", status:"active", tags:["หลังคา","มาตรฐาน"], effectiveDate:"1 มิ.ย. 2569", priceHistory:[ { price:365, effectiveDate:"1 ม.ค. 2569" }, { price:350, effectiveDate:"1 ก.ค. 2568", note:"ราคาเดิม" } ] },
  { code:"RF-L01", name:"แผ่นหลังคา Longrib 0.47mm", nameEn:"Longrib Roofing Sheet", category:"roofing", unit:"ตร.ม.", price:"฿420", priceNum:420, minOrder:"50 ตร.ม.", lead:"7–14 วัน", status:"active", tags:["หลังคา","พรีเมียม"], effectiveDate:"1 มิ.ย. 2569", priceHistory:[ { price:405, effectiveDate:"1 ม.ค. 2569" } ] },
  { code:"RF-I01", name:"แผ่นหลังคาพร้อมฉนวน Sandwich 50mm", nameEn:"Sandwich Panel Roof 50mm", category:"roofing", unit:"ตร.ม.", price:"฿680", priceNum:680, minOrder:"50 ตร.ม.", lead:"14–21 วัน", status:"active", tags:["ฉนวน","เก็บความเย็น"], effectiveDate:"1 มิ.ย. 2569", priceHistory:[ { price:655, effectiveDate:"1 ม.ค. 2569", note:"ปรับตามต้นทุนฉนวน" }, { price:630, effectiveDate:"1 ก.ค. 2568" } ] },
  { code:"RF-G01", name:"รางน้ำฝน Seamless Gutter", nameEn:"Seamless Gutter", category:"roofing", unit:"เมตร", price:"฿650", priceNum:650, minOrder:"20 เมตร", lead:"7 วัน", status:"active", tags:["อุปกรณ์"], effectiveDate:"1 มิ.ย. 2569", priceHistory:[ { price:620, effectiveDate:"1 ม.ค. 2569" } ] },
  // ระบบผนัง
  { code:"WL-M01", name:"แผ่นผนัง Metal Sheet 0.35mm", nameEn:"Metal Wall Sheet 0.35mm", category:"wall", unit:"ตร.ม.", price:"฿280", priceNum:280, minOrder:"50 ตร.ม.", lead:"7–14 วัน", status:"active", tags:["ผนัง","มาตรฐาน"], effectiveDate:"1 มิ.ย. 2569", priceHistory:[ { price:270, effectiveDate:"1 ม.ค. 2569" }, { price:260, effectiveDate:"1 ก.ค. 2568", note:"ราคาเดิม" } ] },
  { code:"WL-S01", name:"แผ่นผนัง Sandwich Panel 50mm", nameEn:"Sandwich Wall Panel 50mm", category:"wall", unit:"ตร.ม.", price:"฿720", priceNum:720, minOrder:"50 ตร.ม.", lead:"14–21 วัน", status:"active", tags:["ผนัง","ฉนวน"], effectiveDate:"1 มิ.ย. 2569", priceHistory:[ { price:695, effectiveDate:"1 ม.ค. 2569" } ] },
  { code:"WL-S02", name:"แผ่นผนัง Sandwich Panel 75mm", nameEn:"Sandwich Wall Panel 75mm", category:"wall", unit:"ตร.ม.", price:"฿820", priceNum:820, minOrder:"50 ตร.ม.", lead:"14–21 วัน", status:"active", tags:["ผนัง","เก็บความเย็น"], effectiveDate:"1 มิ.ย. 2569", priceHistory:[ { price:790, effectiveDate:"1 ม.ค. 2569", note:"ปรับตามต้นทุน" }, { price:765, effectiveDate:"1 ก.ค. 2568" } ] },
  // อุปกรณ์เสริม
  { code:"AC-D01", name:"ประตูม้วนเหล็ก 3×3 ม.", nameEn:"Rolling Steel Door 3×3m", category:"accessory", unit:"บาน", price:"฿28,000", priceNum:28000, minOrder:"1 บาน", lead:"14 วัน", status:"active", tags:["ประตู"], effectiveDate:"1 มิ.ย. 2569", priceHistory:[ { price:26500, effectiveDate:"1 ม.ค. 2569" } ] },
  { code:"AC-D02", name:"ประตูบานสวิง คู่ 2×2.4 ม.", nameEn:"Swing Door 2×2.4m", category:"accessory", unit:"บาน", price:"฿12,500", priceNum:12500, minOrder:"1 บาน", lead:"14 วัน", status:"active", tags:["ประตู"], effectiveDate:"1 มิ.ย. 2569", priceHistory:[ { price:12000, effectiveDate:"1 ม.ค. 2569" }, { price:11500, effectiveDate:"1 ก.ค. 2568", note:"ราคาเดิม" } ] },
  { code:"AC-W01", name:"หน้าต่างอลูมิเนียม 1.5×1.2 ม.", nameEn:"Aluminium Window 1.5×1.2m", category:"accessory", unit:"บาน", price:"฿4,800", priceNum:4800, minOrder:"4 บาน", lead:"14 วัน", status:"active", tags:["หน้าต่าง"], effectiveDate:"1 มิ.ย. 2569", priceHistory:[ { price:4600, effectiveDate:"1 ม.ค. 2569" } ] },
  { code:"AC-V01", name:"ผ้าใบฉนวนกันความร้อน (Bubble Foil)", nameEn:"Bubble Foil Insulation", category:"accessory", unit:"ตร.ม.", price:"฿120", priceNum:120, minOrder:"100 ตร.ม.", lead:"7 วัน", status:"active", tags:["ฉนวน"], effectiveDate:"1 มิ.ย. 2569", priceHistory:[ { price:115, effectiveDate:"1 ม.ค. 2569" } ] },
  // แพ็กเกจ
  { code:"PKG-W01", name:"แพ็กเกจโกดัง 10×20 ม. ครบชุด", nameEn:"Warehouse Package 10×20m", category:"package", unit:"แพ็กเกจ", price:"฿1,250,000", priceNum:1250000, minOrder:"1 แพ็กเกจ", lead:"60–75 วัน", status:"active", tags:["โกดัง","ครบชุด"], effectiveDate:"1 มิ.ย. 2569", priceHistory:[ { price:1200000, effectiveDate:"1 ม.ค. 2569", note:"ปรับตามราคาเหล็ก" }, { price:1160000, effectiveDate:"1 ก.ค. 2568" } ] },
  { code:"PKG-F01", name:"แพ็กเกจโรงงาน 20×40 ม. ครบชุด", nameEn:"Factory Package 20×40m", category:"package", unit:"แพ็กเกจ", price:"฿3,800,000", priceNum:3800000, minOrder:"1 แพ็กเกจ", lead:"90–120 วัน", status:"active", tags:["โรงงาน","ครบชุด"], effectiveDate:"1 มิ.ย. 2569", priceHistory:[ { price:3680000, effectiveDate:"1 ม.ค. 2569" } ] },
  { code:"PKG-O01", name:"แพ็กเกจสำนักงาน Prefab 6×9 ม.", nameEn:"Prefab Office 6×9m", category:"package", unit:"แพ็กเกจ", price:"฿620,000", priceNum:620000, minOrder:"1 แพ็กเกจ", lead:"30–45 วัน", status:"active", tags:["สำนักงาน","Prefab"], effectiveDate:"1 มิ.ย. 2569", priceHistory:[ { price:598000, effectiveDate:"1 ม.ค. 2569", note:"ราคาเปิดตัว" } ] },
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

function fmtBaht(v: number) { return "฿" + v.toLocaleString("th-TH"); }

export default function HQMasterPage() {
  const [activeTab,    setActiveTab]    = useState<TabKey>("all");
  const [searchQ,      setSearchQ]      = useState("");
  const [editProduct,  setEditProduct]  = useState<Product | null>(null);
  const [products,     setProducts]     = useState<Product[]>(PRODUCTS);
  const [addOpen,      setAddOpen]      = useState(false);
  const [naForm,       setNaForm]       = useState<{ code: string; name: string; category: Product["category"]; unit: string; price: string }>({ code: "", name: "", category: "structure", unit: "ชุด", price: "" });
  const [editPrice,    setEditPrice]    = useState("");
  const [editLead,     setEditLead]     = useState("");
  const [editMinOrder, setEditMinOrder] = useState("");

  // ประวัติราคา (ดู)
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);

  // ปรับราคา (update price)
  const [repriceProduct,  setRepriceProduct]  = useState<Product | null>(null);
  const [repricePrice,    setRepricePrice]    = useState("");
  const [repriceDate,     setRepriceDate]     = useState("");
  const [repriceNote,     setRepriceNote]     = useState("");

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

  function addProduct() {
    if (!naForm.code.trim() || !naForm.name.trim()) return;
    const priceNum = parseFloat(naForm.price.replace(/[^\d.]/g, "")) || 0;
    const p: Product = {
      code: naForm.code.trim(), name: naForm.name.trim(), nameEn: "",
      category: naForm.category, unit: naForm.unit || "ชุด",
      price: naForm.price.trim() || "-", priceNum,
      minOrder: "-", lead: "-", status: "active", tags: [],
      effectiveDate: "1 มิ.ย. 2569", priceHistory: [],
    };
    setProducts(prev => [p, ...prev]);
    setAddOpen(false);
    setNaForm({ code: "", name: "", category: "structure", unit: "ชุด", price: "" });
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

  function openReprice(p: Product) {
    setRepriceProduct(p);
    setRepricePrice("");
    setRepriceDate("");
    setRepriceNote("");
  }

  function saveReprice() {
    if (!repriceProduct) return;
    const newNum = Number(repricePrice.replace(/[^0-9.]/g, ""));
    if (!newNum || !repriceDate.trim()) return;
    const note = repriceNote.trim();
    setProducts(prev =>
      prev.map(p => {
        if (p.code !== repriceProduct.code) return p;
        // ดันราคาปัจจุบัน (+ note ถ้ามี) ลงประวัติ แล้วตั้งราคาใหม่เป็นราคาปัจจุบัน
        const oldEntry: PriceHistoryEntry = {
          price: p.priceNum,
          effectiveDate: p.effectiveDate,
          ...(note ? { note } : {}),
        };
        return {
          ...p,
          price: fmtBaht(newNum),
          priceNum: newNum,
          effectiveDate: repriceDate.trim(),
          priceHistory: [oldEntry, ...p.priceHistory],
        };
      })
    );
    setRepriceProduct(null);
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
          <button className="btn btn-primary btn-sm" onClick={() => setAddOpen(true)}>+ เพิ่มสินค้า</button>
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
          <div className="stat-value">{new Set(products.map(p => p.category)).size}</div>
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
            <colgroup>
              <col style={{ width: "9%" }} />
              <col style={{ width: "26%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "18%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>รหัส</th>
                <th>ชื่อสินค้า</th>
                <th>หมวดหมู่</th>
                <th>หน่วย</th>
                <th className="num">ราคามาตรฐาน</th>
                <th>วันที่มีผล</th>
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
                  <td style={{ fontSize: "0.8rem", color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>
                    {p.effectiveDate}
                  </td>
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
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => setHistoryProduct(p)}>ประวัติราคา</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => openReprice(p)}>ปรับราคา</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}>แก้ไข</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add product modal */}
      {addOpen && (
        <div onClick={() => setAddOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(45,45,45,.45)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 460, background: "#fff", borderRadius: 14, overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,.22)" }}>
            <div style={{ background: "#003366", color: "#fff", padding: "16px 20px", fontSize: "1rem", fontWeight: 800 }}>เพิ่มสินค้าใหม่</div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label className="form-label">รหัสสินค้า *</label><input className="form-input" value={naForm.code} onChange={e => setNaForm(f => ({ ...f, code: e.target.value }))} placeholder="เช่น PEB-S05" /></div>
                <div><label className="form-label">หมวดหมู่</label>
                  <select className="form-select" value={naForm.category} onChange={e => setNaForm(f => ({ ...f, category: e.target.value as Product["category"] }))}>
                    {(["structure","roofing","wall","accessory","package"] as const).map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
                  </select>
                </div>
              </div>
              <div><label className="form-label">ชื่อสินค้า *</label><input className="form-input" value={naForm.name} onChange={e => setNaForm(f => ({ ...f, name: e.target.value }))} placeholder="เช่น อาคารเหล็กสำเร็จรูป 30×40 ม." /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label className="form-label">หน่วย</label><input className="form-input" value={naForm.unit} onChange={e => setNaForm(f => ({ ...f, unit: e.target.value }))} placeholder="ชุด / ตร.ม. / บาน" /></div>
                <div><label className="form-label">ราคา</label><input className="form-input" value={naForm.price} onChange={e => setNaForm(f => ({ ...f, price: e.target.value }))} placeholder="เช่น ฿485,000" /></div>
              </div>
            </div>
            <div style={{ padding: "14px 20px", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn btn-secondary btn-md" onClick={() => setAddOpen(false)}>ยกเลิก</button>
              <button className="btn btn-primary btn-md" onClick={addProduct}
                disabled={!naForm.code.trim() || !naForm.name.trim()}
                style={(!naForm.code.trim() || !naForm.name.trim()) ? { opacity: 0.5, cursor: "not-allowed" } : undefined}>
                เพิ่มสินค้า
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* ประวัติราคา modal (ดู) */}
      {historyProduct && (
        <>
          <div
            onClick={() => setHistoryProduct(null)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", zIndex: 200 }}
          />
          <div
            className="card"
            style={{
              position: "fixed", top: "50%", left: "50%",
              transform: "translate(-50%,-50%)",
              zIndex: 201, padding: "28px 32px", width: 480,
              maxHeight: "80vh", overflowY: "auto",
              boxShadow: "0 16px 48px rgba(0,0,0,.2)",
            }}
          >
            <div style={{ marginBottom: 20 }}>
              <div className="card-title" style={{ marginBottom: 2 }}>ประวัติราคา</div>
              <div className="card-desc">{historyProduct.code} — {historyProduct.name}</div>
            </div>

            {/* ราคาปัจจุบัน */}
            <div style={{
              display: "flex", alignItems: "baseline", justifyContent: "space-between",
              gap: 8, padding: "12px 14px", borderRadius: 10,
              background: "#003366" + "0d", border: "1px solid #00336626", marginBottom: 16,
            }}>
              <div>
                <div style={{ fontSize: "0.7rem", color: "var(--muted-foreground)", fontWeight: 600 }}>ราคาปัจจุบัน</div>
                <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "#003366" }}>{historyProduct.price}</div>
              </div>
              <div style={{ fontSize: "0.78rem", color: "var(--muted-foreground)", textAlign: "right" }}>
                มีผล {historyProduct.effectiveDate}
              </div>
            </div>

            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--muted-foreground)", marginBottom: 8 }}>
              ราคาก่อนหน้า
            </div>
            {historyProduct.priceHistory.length === 0 ? (
              <div style={{ fontSize: "0.82rem", color: "var(--muted-foreground)", padding: "12px 0" }}>
                ยังไม่มีประวัติราคา
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <colgroup>
                    <col style={{ width: "32%" }} />
                    <col style={{ width: "30%" }} />
                    <col style={{ width: "38%" }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="num">ราคา</th>
                      <th>วันที่มีผล</th>
                      <th>หมายเหตุ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyProduct.priceHistory.map((h, i) => (
                      <tr key={i}>
                        <td className="num" style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{fmtBaht(h.price)}</td>
                        <td style={{ whiteSpace: "nowrap", color: "var(--muted-foreground)" }}>{h.effectiveDate}</td>
                        <td style={{ fontSize: "0.78rem", color: "var(--muted-foreground)" }}>{h.note ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
              <button className="btn btn-secondary btn-md" onClick={() => setHistoryProduct(null)}>ปิด</button>
              <button
                className="btn btn-primary btn-md"
                onClick={() => { const p = historyProduct; setHistoryProduct(null); openReprice(p); }}
              >
                ปรับราคา
              </button>
            </div>
          </div>
        </>
      )}

      {/* ปรับราคา modal (update price) */}
      {repriceProduct && (
        <>
          <div
            onClick={() => setRepriceProduct(null)}
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
              <div className="card-title" style={{ marginBottom: 2 }}>ปรับราคา</div>
              <div className="card-desc">{repriceProduct.code} — {repriceProduct.name}</div>
            </div>

            <div style={{
              padding: "10px 14px", borderRadius: 10, background: "var(--muted)",
              marginBottom: 16, fontSize: "0.8rem", color: "var(--muted-foreground)",
            }}>
              ราคาปัจจุบัน <strong style={{ color: "var(--foreground)" }}>{repriceProduct.price}</strong>
              {" · "}มีผล {repriceProduct.effectiveDate}
              <div style={{ marginTop: 4 }}>
                เมื่อบันทึก ราคาปัจจุบันจะถูกย้ายเข้า “ประวัติราคา” อัตโนมัติ
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 16 }}>
              <div>
                <label className="form-label">ราคาใหม่ (บาท)</label>
                <input
                  className="form-input"
                  value={repricePrice}
                  onChange={e => setRepricePrice(e.target.value)}
                  placeholder="เช่น 500000"
                  inputMode="numeric"
                />
              </div>
              <div>
                <label className="form-label">วันที่มีผล</label>
                <input
                  className="form-input"
                  value={repriceDate}
                  onChange={e => setRepriceDate(e.target.value)}
                  placeholder="เช่น 1 ก.ค. 2569"
                />
              </div>
              <div>
                <label className="form-label">หมายเหตุ (ไม่บังคับ)</label>
                <input
                  className="form-input"
                  value={repriceNote}
                  onChange={e => setRepriceNote(e.target.value)}
                  placeholder="เช่น ปรับตามราคาเหล็ก"
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-secondary btn-md" onClick={() => setRepriceProduct(null)}>ยกเลิก</button>
              <button
                className="btn btn-primary btn-md"
                onClick={saveReprice}
                disabled={!Number(repricePrice.replace(/[^0-9.]/g, "")) || !repriceDate.trim()}
              >
                บันทึกราคาใหม่
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
