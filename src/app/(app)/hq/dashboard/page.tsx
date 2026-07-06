"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DollarSign, TrendingUp, Award, Target, MapPin, Trophy,
} from "lucide-react";
import {
  hqSalesByMonth, dealerLeaderboard, hqDealSummary, hqPipelineStages, hqPipelineByProduct, dealerDetails,
  type DealerRow,
} from "@/lib/mock";
import { Donut } from "@/components/ui/Charts";
import { usePersistentState } from "@/lib/usePersistentState";
import { useFilters } from "@/context/FilterContext";
import { FilterBar, SelectFilter } from "@/components/filters/FilterBar";
import { SalesTrendChart } from "@/components/ui/SalesTrendChart";
import { fmtBaht } from "@/lib/format";

const PRIMARY = "#003366";
// navy ramp สำหรับกราฟรายภาค
const RAMP = ["#003366", "#1a4f80", "#33699a", "#4d84b3", "#6699cc", "#8fb3d9"];

export default function HQDashboard() {
  const router = useRouter();
  const { timeRange } = useFilters();
  // ข้อมูลตัวแทน = ชุดเดียวกับหน้า "ตัวแทน" (persist ผ่าน hq_dealers) — ตัวเลขจริง ไม่สเกลปลอมตามช่วงเวลา
  const [allDealers] = usePersistentState<DealerRow[]>("hq_dealers_v2", dealerLeaderboard);
  // ตัวเลือกตัวแทนเฉพาะหน้านี้ (แต่ละหน้า HQ เลือกแยกกัน ไม่จำข้ามหน้า)
  const [dealerSel, setDealerSel] = useState<string>("all");
  const dealers = useMemo(
    () => dealerSel === "all" ? allDealers : allDealers.filter(d => d.code === dealerSel),
    [allDealers, dealerSel],
  );
  const selDealer = dealerSel === "all" ? null : dealers[0] ?? null;

  const { won, lost, negotiating, annualTarget, ytdActual } = hqDealSummary;
  const conv = won.count + lost.count ? Math.round((won.count / (won.count + lost.count)) * 100) : 0;
  const pipeVal = useMemo(() => hqPipelineStages.reduce((s, x) => s + x.valueNum, 0), []);
  const pct = Math.round((ytdActual / annualTarget) * 100);
  const totalRevenue = useMemo(() => dealers.reduce((s, d) => s + d.revenueActual, 0), [dealers]);

  // executive scorecard (4) — ทั้งเครือ = ตัวเลขสะสมจริง / ตัวแทนเดียว = ตัวเลขจริงของตัวแทนนั้น
  const stats = selDealer
    ? [
        { Icon: DollarSign, label: `รายได้ ${selDealer.name.replace("Benjamin ", "")}`, value: fmtBaht(selDealer.revenueActual), delta: "", tone: "success" as const, sub: `ภาค${selDealer.region}` },
        { Icon: Target, label: "% ของเป้าตัวแทน", value: `${Math.round((selDealer.revenueActual / selDealer.revenueTarget) * 100)}%`, delta: "", tone: "muted" as const, sub: `เป้า ${fmtBaht(selDealer.revenueTarget)}` },
        { Icon: TrendingUp, label: "ดีลกำลังทำ", value: `${selDealer.activeProjects}`, delta: "", tone: "success" as const, sub: `ติดตามตรงเวลา ${selDealer.onTimePct}%` },
        { Icon: Award, label: "อัตราปิดการขาย", value: `${selDealer.winRate}%`, delta: "", tone: "muted" as const, sub: selDealer.status === "active" ? "ตัวแทนใช้งานอยู่" : "ตัวแทนระงับ" },
      ]
    : [
        { Icon: DollarSign, label: "รายได้รวมทั้งเครือ", value: fmtBaht(totalRevenue), delta: "", tone: "success" as const, sub: `${dealers.length} ตัวแทน` },
        { Icon: TrendingUp, label: "โอกาสการขายรวม", value: fmtBaht(pipeVal), delta: "", tone: "success" as const, sub: `${negotiating.count} กำลังเจรจา` },
        { Icon: Award, label: "ปิดการขาย (YTD)", value: `${won.count}`, delta: "", tone: "success" as const, sub: `เสียดีล ${lost.count}` },
        { Icon: Target, label: "อัตราปิดการขายรวม", value: `${conv}%`, delta: `เป้ารายปี ${pct}%`, tone: "muted" as const, sub: `${fmtBaht(ytdActual)} / ${fmtBaht(annualTarget)}` },
      ];

  // ข้อมูลรายเดือน (ล้านบาท) ป้อนกราฟแนวโน้ม — ทั้งเครือ หรือยอดจริงรายตัวแทนจาก dealerDetails
  const selDetail = selDealer ? dealerDetails[selDealer.code] : null;
  const trendMonthly = selDetail
    ? selDetail.monthlySales.map(d => ({ month: d.month, value: Math.round(d.value * 10) / 10 }))
    : hqSalesByMonth.map(d => ({ month: d.month, value: Math.round(d.value * 10) / 10 }));
  const trendTitle = selDealer ? `ยอดขาย ${selDealer.name.replace("Benjamin ", "")} รายเดือน` : "ยอดขายรวมทั้งเครือ รายเดือน";
  const trendDesc = selDealer ? `เฉพาะตัวแทน ${selDealer.code} (ล้านบาท)` : "มูลค่าทุกตัวแทนรวมกัน (ล้านบาท)";

  // Regional performance
  const regions = useMemo(() => {
    const m = new Map<string, { revenue: number; count: number }>();
    dealers.forEach(d => {
      const r = m.get(d.region) ?? { revenue: 0, count: 0 };
      r.revenue += d.revenueActual; r.count += 1;
      m.set(d.region, r);
    });
    const arr = [...m.entries()].map(([region, v]) => ({ region, ...v })).sort((a, b) => b.revenue - a.revenue);
    const max = Math.max(...arr.map(a => a.revenue), 1);
    return arr.map(a => ({ ...a, pct: Math.round((a.revenue / max) * 100) }));
  }, [dealers]);

  // Full dealer leaderboard (ranked)
  const ranked = useMemo(() =>
    [...dealers].sort((a, b) => b.revenueActual - a.revenueActual), [dealers]);
  const best = ranked[0];

  const winTone = (w: number) => w >= 45 ? { background: "#e5faf0", color: "#059669" }
    : w >= 35 ? { background: "#dce5f0", color: PRIMARY }
    : { background: "#fef3cd", color: "#b7892a" };

  return (
    <div className="erp">
      <div className="page-head">
        <div>
          <h2>แดชบอร์ดสำนักงานใหญ่</h2>
          <p>{selDealer ? `มุมมองตัวแทน: ${selDealer.name.replace("Benjamin ", "")} (${selDealer.code})` : "ศูนย์ควบคุมเครือข่าย · ตัวเลขสะสมจริงของทุกตัวแทน"} · {timeRange.subtitle}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {/* เลือกดูภาพรวมทั้งเครือ หรือเจาะรายตัวแทน — ตัวเลือกเฉพาะหน้านี้ (UI เดียวกับตัวกรองเวลา) */}
          <SelectFilter caption="ทุกตัวแทน (ทั้งเครือ)" value={dealerSel}
            options={allDealers.map(d => ({ value: d.code, label: `${d.code} – ${d.name}` }))}
            onChange={setDealerSel} />
          <FilterBar dims={[]} />
        </div>
      </div>

      {/* Executive scorecard */}
      <div className="stat-grid">
        {stats.map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon"><s.Icon size={18} /></div>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
              {s.delta && <span className="badge" style={s.tone === "success" ? { background: "#e5faf0", color: "#059669" } : { background: "#f0f4f8", color: "#6b7280" }}>{s.delta}</span>}
              <span style={{ fontSize: "0.64rem", color: "var(--muted-foreground)" }}>{s.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Row 1 — กราฟแนวโน้ม (2.3fr) + ตัวแทนยอดเยี่ยมเป็น rail ขวา (เลย์เอาต์เดียวกับแดชบอร์ดตัวแทน) */}
      <div style={{ display: "grid", gridTemplateColumns: "2.3fr 1fr", gap: "1.25rem", alignItems: "stretch", marginBottom: "1.75rem" }}>
        <div className="card" style={{ marginBottom: 0, display: "flex", flexDirection: "column" }}>
          {/* การ์ดนี้ไม่มี card-header — เติม padding บนเอง (ค่า default ของ card-body คือ 0 ด้านบน) */}
          <div className="card-body" style={{ paddingTop: "1.1rem", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            {/* height 430 = SVG สูงขึ้นให้กราฟเต็มการ์ดที่ยืดตาม rail ขวา ไม่เหลือช่องว่างข้างล่าง */}
            <SalesTrendChart title={trendTitle} desc={trendDesc} monthly={trendMonthly} height={430} />
          </div>
        </div>

        {/* Best dealer spotlight — rail */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header"><div className="card-title">{selDealer ? "ข้อมูลตัวแทน" : "ตัวแทนยอดเยี่ยม"}</div><Trophy size={16} color="#ECC94B" /></div>
          {best && (
            <div className="card-body" style={{ paddingTop: 4, display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="clickable" role="button" tabIndex={0}
                onClick={() => router.push(`/hq/dealers/${best.code}`)}
                onKeyDown={e => { if (e.key === "Enter") router.push(`/hq/dealers/${best.code}`); }}
                title="ดูรายละเอียดตัวแทน"
                style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: PRIMARY, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "1rem", flexShrink: 0 }}>{best.code}</div>
                <div>
                  <div style={{ fontSize: "1rem", fontWeight: 800 }}>{best.name.replace("Benjamin ", "")}</div>
                  <div style={{ fontSize: "0.74rem", color: "var(--muted-foreground)" }}>ภาค{best.region} · Win rate {best.winRate}% · คลิกดูรายละเอียด →</div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { k: "รายได้", v: fmtBaht(best.revenueActual) },
                  { k: "เป้า", v: `${Math.round((best.revenueActual / best.revenueTarget) * 100)}%` },
                  { k: "ดีลกำลังทำ", v: `${best.activeProjects}` },
                  { k: "ตรงเวลา", v: `${best.onTimePct}%` },
                ].map(m => (
                  <div key={m.k} style={{ background: "var(--muted)", borderRadius: 10, padding: "10px 12px" }}>
                    <div style={{ fontSize: "0.66rem", color: "var(--muted-foreground)" }}>{m.k}</div>
                    <div style={{ fontSize: "0.95rem", fontWeight: 800, color: PRIMARY }}>{m.v}</div>
                  </div>
                ))}
              </div>
              {/* อันดับย่อ — เติมพื้นที่ rail ให้สมดุลกับกราฟ (เฉพาะมุมมองทั้งเครือ) */}
              {ranked.length > 1 && (
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 9 }}>
                {ranked.slice(1, 5).map((d, i) => (
                  <div key={d.code} className="clickable" role="button" tabIndex={0}
                    onClick={() => router.push(`/hq/dealers/${d.code}`)}
                    onKeyDown={e => { if (e.key === "Enter") router.push(`/hq/dealers/${d.code}`); }}
                    title="ดูรายละเอียดตัวแทน"
                    style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.76rem", cursor: "pointer" }}>
                    <span style={{ display: "inline-flex", width: 20, height: 20, borderRadius: 6, alignItems: "center", justifyContent: "center", fontSize: "0.66rem", fontWeight: 800, background: "#f0f4f8", color: "#6b7280", flexShrink: 0 }}>{i + 2}</span>
                    <span style={{ flex: 1, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name.replace("Benjamin ", "")}</span>
                    <span style={{ fontWeight: 800, color: PRIMARY, fontVariantNumeric: "tabular-nums" }}>{fmtBaht(d.revenueActual)}</span>
                  </div>
                ))}
              </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Row 2 — ผลงานรายภาค + อัตราปิดการขายรายตัวแทน (การ์ดแท่งกราฟคู่กัน) */}
      <div className="row-2">
        <div className="card">
          <div className="card-header"><div><div className="card-title">ผลงานรายภาค</div><div className="card-desc">รายได้รวมแยกตามภูมิภาค</div></div><MapPin size={16} color="#9ca3af" /></div>
          <div className="card-body" style={{ paddingTop: 4, display: "flex", flexDirection: "column", gap: 13 }}>
            {regions.map((r, i) => (
              <div key={r.region}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", marginBottom: 4 }}>
                  <span style={{ fontWeight: 700 }}>{r.region} <span style={{ color: "var(--muted-foreground)", fontWeight: 400, fontSize: "0.7rem" }}>· {r.count} ตัวแทน</span></span>
                  <span style={{ fontWeight: 800, color: PRIMARY }}>{fmtBaht(r.revenue)}</span>
                </div>
                <div style={{ height: 8, background: "var(--muted)", borderRadius: 999, overflow: "hidden" }}>
                  <div className="top5-bar" style={{ height: "100%", width: `${r.pct}%`, background: RAMP[i % RAMP.length], borderRadius: 999 }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><div><div className="card-title">อัตราปิดการขายรายตัวแทน</div><div className="card-desc">Win rate ของแต่ละตัวแทน</div></div></div>
          <div className="card-body" style={{ paddingTop: 4, display: "flex", flexDirection: "column", gap: 12 }}>
            {ranked.map(d => (
              <div key={d.code}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.76rem", marginBottom: 4 }}>
                  <span style={{ fontWeight: 700 }}>{d.name.replace("Benjamin ", "")}</span>
                  <span style={{ fontWeight: 800, color: d.winRate >= 45 ? "#059669" : d.winRate >= 35 ? PRIMARY : "#b7892a", fontVariantNumeric: "tabular-nums" }}>{d.winRate}%</span>
                </div>
                <div style={{ height: 7, background: "var(--muted)", borderRadius: 999, overflow: "hidden" }}>
                  <div className="bar-grow" style={{ height: "100%", width: `${d.winRate}%`, borderRadius: 999, background: d.winRate >= 45 ? "#059669" : d.winRate >= 35 ? PRIMARY : "#ECC94B" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3 — สัดส่วนมูลค่าตามแม่แบบ (เฉพาะมุมมองทั้งเครือ — ข้อมูลไม่แยกรายตัวแทน) */}
      {!selDealer && (
      <div className="card" style={{ marginBottom: "1.75rem" }}>
        <div className="card-header"><div><div className="card-title">สัดส่วนมูลค่าตามแม่แบบ</div><div className="card-desc">มูลค่าโอกาสการขายทั้งเครือ แยกตามแม่แบบ</div></div></div>
        <div className="card-body" style={{ display: "flex", alignItems: "center", gap: 32, flexWrap: "wrap", paddingTop: 4 }}>
          <Donut
            segments={hqPipelineByProduct.map(p => ({ label: p.product, value: p.valueNum, color: p.color }))}
            centerLabel="มูลค่ารวม"
            centerValue={fmtBaht(hqPipelineByProduct.reduce((s, p) => s + p.valueNum, 0))}
            size={180}
          />
          <div style={{ flex: 1, minWidth: 260, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px 24px" }}>
            {hqPipelineByProduct.map(p => (
              <div key={p.product} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: p.color, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: "0.76rem", color: "#2D2D2D" }}>{p.product}</span>
                <span style={{ fontSize: "0.76rem", fontWeight: 800, color: PRIMARY, fontVariantNumeric: "tabular-nums" }}>{fmtBaht(p.valueNum)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      )}

      {/* Full dealer leaderboard table */}
      <div className="card" style={{ marginBottom: 0 }}>
        <div className="card-header">
          <div><div className="card-title">{selDealer ? "สรุปตัวแทนที่เลือก" : "อันดับตัวแทน (ทั้งเครือ)"}</div><div className="card-desc">จัดอันดับตามรายได้จริง</div></div>
          <Link href="/hq/dealers" className="btn btn-secondary btn-sm">จัดการตัวแทน →</Link>
        </div>
        <div className="table-wrap">
          <table>
            <colgroup>
              <col style={{ width: "8%" }} />
              <col style={{ width: "24%" }} />
              <col style={{ width: "13%" }} />
              <col style={{ width: "13%" }} />
              <col style={{ width: "20%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "10%" }} />
            </colgroup>
            <thead>
              <tr>
                <th style={{ width: 50 }}>#</th>
                <th>ตัวแทน</th>
                <th>ภาค</th>
                <th className="num">รายได้</th>
                <th className="num">% เป้า</th>
                <th className="num">Win Rate</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((d, i) => {
                const tpct = Math.round((d.revenueActual / d.revenueTarget) * 100);
                return (
                  <tr key={d.code} className="clickable" onClick={() => router.push(`/hq/dealers/${d.code}`)}>
                    <td><span style={{ display: "inline-flex", width: 24, height: 24, borderRadius: 7, alignItems: "center", justifyContent: "center", fontSize: "0.72rem", fontWeight: 800, background: i === 0 ? PRIMARY : "#f0f4f8", color: i === 0 ? "#fff" : "#6b7280" }}>{i + 1}</span></td>
                    <td style={{ fontWeight: 700 }}>{d.name.replace("Benjamin ", "")}</td>
                    <td style={{ color: "var(--muted-foreground)" }}>{d.region}</td>
                    <td className="num" style={{ fontWeight: 800 }}>{fmtBaht(d.revenueActual)}</td>
                    <td className="num">
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                        <div style={{ width: 60, height: 6, background: "var(--muted)", borderRadius: 999, overflow: "hidden" }}>
                          <div className="bar-grow" style={{ height: "100%", width: `${Math.min(tpct, 100)}%`, background: tpct >= 80 ? "#059669" : tpct >= 50 ? PRIMARY : "#d97706", borderRadius: 999 }} />
                        </div>
                        <span style={{ fontWeight: 700, minWidth: 32 }}>{tpct}%</span>
                      </div>
                    </td>
                    <td className="num"><span className="badge" style={winTone(d.winRate)}>{d.winRate}%</span></td>
                    <td><span className="badge" style={d.status === "active" ? { background: "#e5faf0", color: "#059669" } : { background: "#f5f5f5", color: "#9ca3af" }}>{d.status === "active" ? "ใช้งาน" : "ระงับ"}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
