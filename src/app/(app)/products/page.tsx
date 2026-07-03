"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Package, FileText, Download, Search, Lock, Building2, X, History, CalendarClock, FilePlus2,
} from "lucide-react";
import { solutionProducts, type SolutionProduct } from "@/lib/mock";

// ── Design tokens ─────────────────────────────────────────────
const PRIMARY = "#003366";
const STEEL   = "#2D2D2D";
const BORDER  = "#e5e7eb";
const MUTED   = "#6b7280";

type Product = SolutionProduct;
const PRODUCTS = solutionProducts;

function fmtMoney(v: number) { return "฿" + v.toLocaleString("th-TH"); }

export default function DealerProductsPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [viewP, setViewP] = useState<Product | null>(null);
  const [historyP, setHistoryP] = useState<Product | null>(null);

  // ดาวน์โหลดเอกสารแม่แบบ (เปิดหน้าพิมพ์ · ไทยล้วน)
  function downloadSpec(p: Product) {
    const win = window.open("", "_blank", "width=820,height=640");
    if (!win) return;
    win.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${p.name}</title>
      <style>*{font-family:"Noto Sans Thai","Sarabun",system-ui,sans-serif;box-sizing:border-box}
        body{margin:36px;color:#2D2D2D}h1{color:#003366;font-size:20px;margin:0 0 2px}
        .sub{color:#6b7280;font-size:12px;margin-bottom:20px}
        .row{display:flex;border-bottom:1px solid #eef1f5;padding:9px 0;font-size:13px}
        .k{width:150px;color:#6b7280;font-weight:600}.v{font-weight:700}
        .price{color:#003366;font-size:18px;font-weight:800}</style></head>
      <body><h1>${p.name}</h1><div class="sub">แม่แบบอาคารสำเร็จรูป</div>
      <div class="row"><div class="k">รายละเอียด</div><div class="v">${p.spec}</div></div>
      <div class="row"><div class="k">ราคากลาง</div><div class="v price">${fmtMoney(p.price)} / ${p.unit}</div></div>
      <p style="margin-top:24px;font-size:11px;color:#9ca3af">ราคากลางกำหนดโดยสำนักงานใหญ่ · ใช้อ้างอิงในการนำเสนอ</p>
      <script>window.onload=function(){window.print()}</script></body></html>`);
    win.document.close();
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PRODUCTS.filter(p => !q || p.name.toLowerCase().includes(q) || p.spec.toLowerCase().includes(q));
  }, [query]);

  return (
    <div className="erp">
      {/* ── หัวข้อหน้า ── */}
      <div className="page-head" style={{ flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <h2>แม่แบบ</h2>
          <p>แม่แบบอาคารสำเร็จรูป · ราคากลางกำหนดโดยสำนักงานใหญ่</p>
        </div>
        <div style={{ position: "relative", width: 280, maxWidth: "100%" }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: MUTED }} />
          <input
            className="form-input"
            style={{ paddingLeft: 36 }}
            placeholder="ค้นหาแม่แบบ / รายละเอียด…"
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
        <span>แม่แบบ รายละเอียด และราคากลางกำหนดโดยสำนักงานใหญ่ — ตัวแทนจำหน่ายดูเพื่อนำเสนอ/อ้างอิงได้ แต่แก้ไขไม่ได้</span>
      </div>

      {/* ── แคตตาล็อกแม่แบบ (grid) ── */}
      {filtered.length === 0 ? (
        <div className="card" style={{ padding: "48px 24px", textAlign: "center", color: MUTED }}>
          <Package size={32} style={{ color: "#C0C0C0", marginBottom: 10 }} />
          <div style={{ fontSize: "0.9rem" }}>ไม่พบแม่แบบที่ตรงกับเงื่อนไข</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(300px, 100%), 1fr))", gap: 18 }}>
          {filtered.map(p => (
            <div
              key={p.id}
              className="card"
              role="button"
              tabIndex={0}
              onClick={() => setViewP(p)}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setViewP(p); } }}
              style={{ display: "flex", flexDirection: "column", overflow: "hidden", cursor: "pointer" }}
            >
              {/* รูป placeholder (CI-styled) */}
              <div
                style={{
                  height: 150,
                  background: "linear-gradient(135deg, #dce5f0 0%, #f3f5f8 100%)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  borderBottom: `1px solid ${BORDER}`,
                }}
              >
                <Building2 size={40} style={{ color: PRIMARY, opacity: 0.55 }} />
              </div>

              {/* เนื้อหา */}
              <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                <div style={{ fontSize: "1rem", fontWeight: 800, color: STEEL, lineHeight: 1.35 }}>
                  {p.name}
                </div>

                {/* รายละเอียด */}
                <div style={{ fontSize: "0.78rem", color: MUTED, lineHeight: 1.5, flex: 1 }}>
                  {p.spec}
                </div>

                {/* ราคากลาง (HQ-managed / read-only) */}
                <div style={{ marginTop: 2 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <span style={{ fontSize: "0.66rem", color: MUTED, fontWeight: 700 }}>ราคากลาง</span>
                    <span style={{ fontSize: "1.15rem", fontWeight: 800, color: PRIMARY }}>{fmtMoney(p.price)}</span>
                    <span style={{ fontSize: "0.74rem", color: MUTED }}>/ {p.unit}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3 }}>
                    <Lock size={10} style={{ color: MUTED, flexShrink: 0 }} />
                    <span style={{ fontSize: "0.64rem", color: MUTED }}>กำหนดโดยสำนักงานใหญ่ · อ่านอย่างเดียว</span>
                  </div>
                </div>

                {/* วันที่มีผล (read-only) */}
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <CalendarClock size={12} style={{ color: MUTED }} />
                  <span style={{ fontSize: "0.7rem", color: MUTED }}>มีผล {p.effectiveDate}</span>
                </div>

                {/* ปุ่ม */}
                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  <button onClick={e => { e.stopPropagation(); setViewP(p); }} className="btn btn-secondary btn-sm" style={{ flex: 1, color: STEEL }}>
                    <FileText size={13} /> ดูรายละเอียด
                  </button>
                  <button onClick={e => { e.stopPropagation(); downloadSpec(p); }} className="btn btn-secondary btn-sm" style={{ flex: 1, color: STEEL }}>
                    <Download size={13} /> ดาวน์โหลด
                  </button>
                </div>
                <button onClick={e => { e.stopPropagation(); setHistoryP(p); }} className="btn btn-secondary btn-sm" style={{ color: STEEL, justifyContent: "center" }}>
                  <History size={13} /> ดูประวัติราคา
                </button>
                <button onClick={e => { e.stopPropagation(); router.push("/quotations"); }} className="btn btn-primary btn-sm" style={{ justifyContent: "center" }}>
                  <FilePlus2 size={13} /> สร้างใบเสนอราคา
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── รายละเอียดแม่แบบ modal ── */}
      {viewP && (
        <div onClick={() => setViewP(null)} style={{ position: "fixed", inset: 0, background: "rgba(45,45,45,.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,.22)" }}>
            <div style={{ background: PRIMARY, color: "#fff", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: "1rem", fontWeight: 800 }}>{viewP.name}</div>
                <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,.7)", marginTop: 2 }}>แม่แบบอาคาร · กำหนดโดยสำนักงานใหญ่</div>
              </div>
              <button onClick={() => setViewP(null)} style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,.15)", color: "#fff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={15} /></button>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div style={{ fontSize: "0.63rem", color: MUTED, marginBottom: 4 }}>รายละเอียด</div>
                <div style={{ fontSize: "0.84rem", fontWeight: 600, lineHeight: 1.6, color: STEEL }}>{viewP.spec}</div>
              </div>
              <div>
                <div style={{ fontSize: "0.63rem", color: MUTED, marginBottom: 4 }}>ราคากลาง (สำนักงานใหญ่กำหนด)</div>
                <span style={{ fontSize: "1.2rem", fontWeight: 800, color: PRIMARY }}>{fmtMoney(viewP.price)}</span>
                <span style={{ fontSize: "0.74rem", color: MUTED }}> / {viewP.unit}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6 }}>
                  <CalendarClock size={12} style={{ color: MUTED }} />
                  <span style={{ fontSize: "0.72rem", color: MUTED }}>มีผล {viewP.effectiveDate}</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { const p = viewP; setViewP(null); setHistoryP(p); }} className="btn btn-secondary btn-md" style={{ flex: 1, justifyContent: "center", color: STEEL }}>
                  <History size={14} /> ดูประวัติราคา
                </button>
                <button onClick={() => downloadSpec(viewP)} className="btn btn-secondary btn-md" style={{ flex: 1, justifyContent: "center", color: STEEL }}>
                  <Download size={14} /> ดาวน์โหลด
                </button>
              </div>
              <button onClick={() => router.push("/quotations")} className="btn btn-primary btn-md" style={{ justifyContent: "center" }}>
                <FilePlus2 size={14} /> สร้างใบเสนอราคาจากแม่แบบนี้
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ประวัติราคา modal (read-only) ── */}
      {historyP && (
        <div onClick={() => setHistoryP(null)} style={{ position: "fixed", inset: 0, background: "rgba(45,45,45,.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, maxHeight: "84vh", overflowY: "auto", background: "#fff", borderRadius: 16, boxShadow: "0 24px 64px rgba(0,0,0,.22)" }}>
            <div style={{ background: PRIMARY, color: "#fff", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: "1rem", fontWeight: 800 }}>ประวัติราคา</div>
                <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,.7)", marginTop: 2 }}>{historyP.name}</div>
              </div>
              <button onClick={() => setHistoryP(null)} style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,.15)", color: "#fff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={15} /></button>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#f5f7fa", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "8px 12px", color: MUTED, fontSize: "0.74rem" }}>
                <Lock size={13} style={{ color: PRIMARY, flexShrink: 0 }} />
                <span>ราคากลางและประวัติราคากำหนดโดยสำนักงานใหญ่ — ตัวแทนจำหน่ายดูได้อย่างเดียว</span>
              </div>

              {/* ราคาปัจจุบัน */}
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, padding: "12px 14px", borderRadius: 10, background: "#dce5f0" }}>
                <div>
                  <div style={{ fontSize: "0.63rem", color: MUTED, fontWeight: 700 }}>ราคากลางปัจจุบัน</div>
                  <span style={{ fontSize: "1.2rem", fontWeight: 800, color: PRIMARY }}>{fmtMoney(historyP.price)}</span>
                  <span style={{ fontSize: "0.72rem", color: MUTED }}> / {historyP.unit}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, color: MUTED, fontSize: "0.74rem" }}>
                  <CalendarClock size={12} /> มีผล {historyP.effectiveDate}
                </div>
              </div>

              {/* ราคาก่อนหน้า */}
              <div>
                <div style={{ fontSize: "0.63rem", color: MUTED, marginBottom: 8, fontWeight: 700 }}>ราคาก่อนหน้า</div>
                {historyP.priceHistory.length === 0 ? (
                  <div style={{ fontSize: "0.82rem", color: MUTED }}>ยังไม่มีประวัติราคา</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {historyP.priceHistory.map((h, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 12px", border: `1px solid ${BORDER}`, borderRadius: 10 }}>
                        <div>
                          <div style={{ fontSize: "0.9rem", fontWeight: 700, color: STEEL }}>{fmtMoney(h.price)}</div>
                          {h.note && <div style={{ fontSize: "0.7rem", color: MUTED, marginTop: 2 }}>{h.note}</div>}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, color: MUTED, fontSize: "0.73rem", whiteSpace: "nowrap" }}>
                          <CalendarClock size={12} /> {h.effectiveDate}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
