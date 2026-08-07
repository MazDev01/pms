"use client";

import { TopbarActions } from "@pms/shared/components/layout/TopbarActions";
import { ModalCard } from "@pms/shared/components/ui/ModalCard";
import { useState, useMemo } from "react";
import {
  Package, FileText, Download, Search, Lock, X, History, CalendarClock,
} from "lucide-react";
import { useEffect } from "react";
import { type SolutionProduct } from "@pms/shared/lib/mock";
import { useMasterCatalog } from "@pms/shared/lib/useMasterCatalog";
import { TemplateHero } from "@pms/shared/components/ui/TemplateHero";
import { fmtFull as fmtMoney } from "@pms/shared/lib/format";

// ── Design tokens ─────────────────────────────────────────────
const PRIMARY = "#003366";
const STEEL   = "#2D2D2D";
const BORDER  = "#e5e7eb";
const MUTED   = "#6b7280";

type Product = SolutionProduct;

export default function DealerProductsPage() {
  const [query, setQuery] = useState("");
  const [viewP, setViewP] = useState<Product | null>(null);
  const [historyP, setHistoryP] = useState<Product | null>(null);
  const [subView, setSubView] = useState<{ parent: Product; sub: string } | null>(null); // ดูรายละเอียดแม่แบบย่อย
  // แคตตาล็อกเดียวทั้งเครือ — อ่านผ่าน repository (local: localStorage · supabase: DB)
  const PRODUCTS = useMasterCatalog();

  // XSS: หน้านี้ประกอบ HTML ด้วย document.write() ตรงๆ — ต้อง escape เอนทิตี HTML ก่อนแทรกเสมอ
  // (เดิมแทรก p.name/p.spec ดิบๆ — ชื่อ/รายละเอียดแม่แบบที่มี <script> จะรันจริงตอนเปิดหน้าพิมพ์)
  const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, c => (({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" } as Record<string, string>)[c]));

  // ดาวน์โหลดเอกสารแม่แบบ (เปิดหน้าพิมพ์ · ไทยล้วน)
  function downloadSpec(p: Product) {
    const win = window.open("", "_blank", "width=820,height=640");
    if (!win) return;
    win.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${esc(p.name)}</title>
      <style>*{font-family:"Noto Sans Thai","Sarabun",system-ui,sans-serif;box-sizing:border-box}
        body{margin:36px;color:#2D2D2D}h1{color:#003366;font-size:20px;margin:0 0 2px}
        .sub{color:#6b7280;font-size:12px;margin-bottom:20px}
        .row{display:flex;border-bottom:1px solid #eef1f5;padding:9px 0;font-size:13px}
        .k{width:150px;color:#6b7280;font-weight:600}.v{font-weight:700}
        .price{color:#003366;font-size:18px;font-weight:800}</style></head>
      <body><h1>${esc(p.name)}</h1><div class="sub">แม่แบบอาคารสำเร็จรูป</div>
      <div class="row"><div class="k">รายละเอียด</div><div class="v">${esc(p.spec)}</div></div>
      <div class="row"><div class="k">ราคากลาง</div><div class="v price">${fmtMoney(p.price)} / ${esc(p.unit)}</div></div>
      <p style="margin-top:24px;font-size:11px;color:#9ca3af">ราคากลางกำหนดโดยสำนักงานใหญ่ · ใช้อ้างอิงในการนำเสนอ</p>
      <script>window.onload=function(){window.print()}<\/script></body></html>`);
    win.document.close();
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PRODUCTS.filter(p => !q || p.name.toLowerCase().includes(q) || p.spec.toLowerCase().includes(q));
  }, [query, PRODUCTS]);

  return (
    <div className="erp">
      {/* ── หัวข้อหน้า ── */}
      {/* หัวหน้า/ช่องค้นหา → ไปอยู่บนแถบบน (ชื่อหน้ามาจาก Topbar) */}
      <TopbarActions>
        <div style={{ position: "relative", width: 240, maxWidth: "100%" }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: MUTED }} />
          <input
            className="form-input"
            style={{ paddingLeft: 36 }}
            placeholder="ค้นหาแม่แบบ / รายละเอียด…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
      </TopbarActions>
      <p className="page-sub">แม่แบบอาคารสำเร็จรูป · ราคากลางกำหนดโดยสำนักงานใหญ่</p>

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
          <div style={{ fontSize: "0.92rem" }}>ไม่พบแม่แบบที่ตรงกับเงื่อนไข</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 18 }}>
          {filtered.map(p => (
            <div
              key={p.id}
              className="card tpl-card"
              role="button"
              tabIndex={0}
              onClick={() => setViewP(p)}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setViewP(p); } }}
              style={{ display: "flex", flexDirection: "column", overflow: "hidden", cursor: "pointer" }}
            >
              {/* ── Hero: ไทล์โลโก้ + ป้ายจำนวนแม่แบบย่อย ── */}
              <div
                style={{
                  position: "relative", height: 132,
                  background: "#f0f4f9",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  borderBottom: `1px solid ${BORDER}`, overflow: "hidden",
                }}
              >
                {p.image ? (
                  /* รูปแม่แบบที่ HQ อัปโหลด — เต็มพื้นที่ Hero */
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={p.image} alt={p.name} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  /* ไม่มีรูปจริง → ภาพประกอบ SVG ตามประเภทอาคาร */
                  <TemplateHero name={p.name} />
                )}
                {p.subtypes && p.subtypes.length > 0 && (
                  <span style={{ position: "absolute", top: 12, right: 12, fontSize: "0.65rem", fontWeight: 700, color: PRIMARY, background: "rgba(255,255,255,.85)", border: `1px solid #dce5f0`, borderRadius: 999, padding: "3px 10px", backdropFilter: "blur(2px)" }}>
                    {p.subtypes.length} แม่แบบย่อย
                  </span>
                )}
              </div>

              {/* เนื้อหา */}
              <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 9, flex: 1 }}>
                <div style={{ fontSize: "1rem", fontWeight: 800, color: STEEL, lineHeight: 1.3 }}>
                  {p.name}
                </div>

                {/* รายละเอียด (2 บรรทัด) */}
                <div className="tpl-clamp2" style={{ fontSize: "0.8rem", color: MUTED, lineHeight: 1.5, minHeight: "2.34em" }}>
                  {p.spec}
                </div>

                {/* แม่แบบย่อย */}
                {p.subtypes && p.subtypes.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {p.subtypes.map(s => (
                      <span key={s} style={{ fontSize: "0.65rem", fontWeight: 600, color: PRIMARY, background: "#eef3f8", border: `1px solid #dce5f0`, borderRadius: 7, padding: "3px 9px" }}>{s}</span>
                    ))}
                  </div>
                )}

                {/* เส้นคั่น */}
                <div style={{ borderTop: `1px solid ${BORDER}`, marginTop: "auto", paddingTop: 12 }}>
                  {/* ราคากลาง (HQ-managed / read-only) */}
                  <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }}>
                    <div>
                      <div style={{ fontSize: "0.65rem", color: MUTED, fontWeight: 700, marginBottom: 1 }}>ราคากลาง</div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                        <span style={{ fontSize: "1.3rem", fontWeight: 800, color: PRIMARY, letterSpacing: "-0.01em" }}>{fmtMoney(p.price)}</span>
                        <span style={{ fontSize: "0.72rem", color: MUTED }}>/ {p.unit}</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, color: MUTED, fontSize: "0.65rem", whiteSpace: "nowrap" }}>
                      <CalendarClock size={11} /> {p.effectiveDate}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 5 }}>
                    <Lock size={10} style={{ color: MUTED, flexShrink: 0 }} />
                    <span style={{ fontSize: "0.65rem", color: MUTED }}>กำหนดโดยสำนักงานใหญ่ · อ่านอย่างเดียว</span>
                  </div>
                </div>

                {/* ปุ่ม */}
                <div style={{ display: "flex", gap: 7, marginTop: 4 }}>
                  <button onClick={e => { e.stopPropagation(); setViewP(p); }} className="btn btn-secondary btn-sm" style={{ flex: 1, color: STEEL }}>
                    <FileText size={13} /> รายละเอียด
                  </button>
                  <button onClick={e => { e.stopPropagation(); setHistoryP(p); }} className="btn btn-secondary btn-sm" title="ประวัติราคา" style={{ width: 40, padding: 0, color: STEEL }}>
                    <History size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── รายละเอียดแม่แบบ modal ── */}
      {viewP && (
        <div onClick={() => setViewP(null)} style={{ position: "fixed", inset: 0, background: "rgba(45,45,45,.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <ModalCard onClose={() => setViewP(null)} label="รายละเอียดแม่แบบ" style={{ width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", background: "#fff", borderRadius: 16, boxShadow: "0 24px 64px rgba(0,0,0,.22)" }}>
            <div style={{ background: PRIMARY, color: "#fff", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: "1rem", fontWeight: 800 }}>{viewP.name}</div>
                <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,.7)", marginTop: 2 }}>แม่แบบอาคาร · กำหนดโดยสำนักงานใหญ่</div>
              </div>
              <button onClick={() => setViewP(null)} style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,.15)", color: "#fff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={15} /></button>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div style={{ fontSize: "0.65rem", color: MUTED, marginBottom: 4 }}>รายละเอียด</div>
                <div style={{ fontSize: "0.86rem", fontWeight: 600, lineHeight: 1.6, color: STEEL }}>{viewP.spec}</div>
              </div>
              {/* แม่แบบย่อย พร้อมรูป */}
              {viewP.subtypes && viewP.subtypes.length > 0 && (
                <div>
                  <div style={{ fontSize: "0.65rem", color: MUTED, marginBottom: 8 }}>แม่แบบย่อย ({viewP.subtypes.length})</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                    {viewP.subtypes.map(s => (
                      <button key={s} onClick={() => setSubView({ parent: viewP, sub: s })} title={`ดูรายละเอียด ${s}`}
                        style={{ border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden", background: "#fafafa", cursor: "pointer", padding: 0, textAlign: "center", fontFamily: "inherit" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 14px rgba(0,51,102,.14)"; (e.currentTarget as HTMLElement).style.borderColor = "#cdd8e6"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; (e.currentTarget as HTMLElement).style.borderColor = BORDER; }}>
                        <div style={{ position: "relative", height: 66, background: "#f0f4f9", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                          {(viewP.subtypeImages?.[s] ?? viewP.image)
                            /* eslint-disable-next-line @next/next/no-img-element */
                            ? <img src={viewP.subtypeImages?.[s] ?? viewP.image} alt={s} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            : <TemplateHero name={`${viewP.name} ${s}`} />}
                        </div>
                        <div style={{ padding: "6px 8px", fontSize: "0.7rem", fontWeight: 600, color: STEEL, textAlign: "center", lineHeight: 1.3 }}>{s}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <div style={{ fontSize: "0.65rem", color: MUTED, marginBottom: 4 }}>ราคากลาง (สำนักงานใหญ่กำหนด)</div>
                <span style={{ fontSize: "1.15rem", fontWeight: 800, color: PRIMARY }}>{fmtMoney(viewP.price)}</span>
                <span style={{ fontSize: "0.72rem", color: MUTED }}> / {viewP.unit}</span>
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
            </div>
          </ModalCard>
        </div>
      )}

      {/* ── รายละเอียดแม่แบบย่อย modal ── */}
      {subView && (
        <div onClick={() => setSubView(null)} style={{ position: "fixed", inset: 0, background: "rgba(45,45,45,.5)", zIndex: 210, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <ModalCard onClose={() => setSubView(null)} label="รายละเอียดประเภทย่อย" style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,.25)" }}>
            <div style={{ background: PRIMARY, color: "#fff", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: "1rem", fontWeight: 800 }}>{subView.sub}</div>
                <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,.7)", marginTop: 2 }}>แม่แบบย่อยของ {subView.parent.name}</div>
              </div>
              <button onClick={() => setSubView(null)} style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,.15)", color: "#fff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={15} /></button>
            </div>
            <div style={{ position: "relative", height: 150, background: "#f0f4f9", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", borderBottom: `1px solid ${BORDER}` }}>
              {(subView.parent.subtypeImages?.[subView.sub] ?? subView.parent.image)
                /* eslint-disable-next-line @next/next/no-img-element */
                ? <img src={subView.parent.subtypeImages?.[subView.sub] ?? subView.parent.image} alt={subView.sub} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <TemplateHero name={`${subView.parent.name} ${subView.sub}`} big />}
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div style={{ fontSize: "0.65rem", color: MUTED, marginBottom: 4 }}>รายละเอียด</div>
                <div style={{ fontSize: "0.86rem", fontWeight: 600, lineHeight: 1.6, color: STEEL }}>{subView.parent.spec}</div>
              </div>
              <div>
                <div style={{ fontSize: "0.65rem", color: MUTED, marginBottom: 4 }}>ราคากลาง (ตามแม่แบบหลัก · สำนักงานใหญ่กำหนด)</div>
                <span style={{ fontSize: "1.15rem", fontWeight: 800, color: PRIMARY }}>{fmtMoney(subView.parent.price)}</span>
                <span style={{ fontSize: "0.72rem", color: MUTED }}> / {subView.parent.unit}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6 }}>
                  <CalendarClock size={12} style={{ color: MUTED }} />
                  <span style={{ fontSize: "0.72rem", color: MUTED }}>มีผล {subView.parent.effectiveDate}</span>
                </div>
              </div>
            </div>
          </ModalCard>
        </div>
      )}

      {/* ── ประวัติราคา modal (read-only) ── */}
      {historyP && (
        <div onClick={() => setHistoryP(null)} style={{ position: "fixed", inset: 0, background: "rgba(45,45,45,.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <ModalCard onClose={() => setHistoryP(null)} label="ประวัติราคา" style={{ width: "100%", maxWidth: 480, maxHeight: "84vh", overflowY: "auto", background: "#fff", borderRadius: 16, boxShadow: "0 24px 64px rgba(0,0,0,.22)" }}>
            <div style={{ background: PRIMARY, color: "#fff", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: "1rem", fontWeight: 800 }}>ประวัติราคา</div>
                <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,.7)", marginTop: 2 }}>{historyP.name}</div>
              </div>
              <button onClick={() => setHistoryP(null)} style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,.15)", color: "#fff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={15} /></button>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#f5f7fa", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "8px 12px", color: MUTED, fontSize: "0.72rem" }}>
                <Lock size={13} style={{ color: PRIMARY, flexShrink: 0 }} />
                <span>ราคากลางและประวัติราคากำหนดโดยสำนักงานใหญ่ — ตัวแทนจำหน่ายดูได้อย่างเดียว</span>
              </div>

              {/* ราคาปัจจุบัน */}
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, padding: "12px 14px", borderRadius: 10, background: "#dce5f0" }}>
                <div>
                  <div style={{ fontSize: "0.65rem", color: MUTED, fontWeight: 700 }}>ราคากลางปัจจุบัน</div>
                  <span style={{ fontSize: "1.15rem", fontWeight: 800, color: PRIMARY }}>{fmtMoney(historyP.price)}</span>
                  <span style={{ fontSize: "0.72rem", color: MUTED }}> / {historyP.unit}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, color: MUTED, fontSize: "0.72rem" }}>
                  <CalendarClock size={12} /> มีผล {historyP.effectiveDate}
                </div>
              </div>

              {/* ราคาก่อนหน้า */}
              <div>
                <div style={{ fontSize: "0.65rem", color: MUTED, marginBottom: 8, fontWeight: 700 }}>ราคาก่อนหน้า</div>
                {historyP.priceHistory.length === 0 ? (
                  <div style={{ fontSize: "0.8rem", color: MUTED }}>ยังไม่มีประวัติราคา</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {historyP.priceHistory.map((h, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 12px", border: `1px solid ${BORDER}`, borderRadius: 10 }}>
                        <div>
                          <div style={{ fontSize: "0.92rem", fontWeight: 700, color: STEEL }}>{fmtMoney(h.price)}</div>
                          {h.note && <div style={{ fontSize: "0.72rem", color: MUTED, marginTop: 2 }}>{h.note}</div>}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, color: MUTED, fontSize: "0.72rem", whiteSpace: "nowrap" }}>
                          <CalendarClock size={12} /> {h.effectiveDate}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </ModalCard>
        </div>
      )}
    </div>
  );
}
