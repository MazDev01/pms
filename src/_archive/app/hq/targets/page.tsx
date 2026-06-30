"use client";

import { useState } from "react";
import { hqSalesTargets, SalesTarget } from "@/lib/mock";
import { Target, TrendingUp, TrendingDown, CheckCircle2, AlertCircle } from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────
const PRIMARY = "#003366";
const MUTED = "#6b7280";
const AMBER = "#f59e0b";
const RED = "#dc2626";
const GREEN = "#059669";

// ─── Helper functions ─────────────────────────────────────────────────────────
function fmtM(n: number): string {
  if (n >= 1_000_000) return "฿" + (n / 1_000_000).toFixed(1) + "M";
  return "฿" + (n / 1_000).toFixed(0) + "K";
}

function pctColor(pct: number, threshold = 100): string {
  if (pct >= threshold) return GREEN;
  if (pct >= 80) return AMBER;
  return RED;
}

type QuarterView = "Q1" | "Q2" | "overview";

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon,
  iconBg,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  iconBg: string;
  accent: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ background: iconBg, color: accent }}>{icon}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-delta" style={{ color: accent }}>{sub}</div>}
    </div>
  );
}

function QuarterBadge({ actual, target }: { actual: number; target: number }) {
  const pct = Math.round((actual / target) * 100);
  const color = pct >= 100 ? GREEN : pct >= 80 ? AMBER : RED;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>{fmtM(actual)}</span>
      <span style={{ fontSize: "0.68rem", color, fontWeight: 700 }}>{pct}% {pct >= 100 ? "✓" : ""}</span>
    </div>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.min(pct, 100);
  const fill = pct >= 100 ? GREEN : PRIMARY;
  const labelColor = pct >= 100 ? GREEN : pct >= 50 ? PRIMARY : pct >= 35 ? AMBER : RED;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, background: "#f4f6f9", borderRadius: 999, height: 8, overflow: "hidden" }}>
        <div
          className="top5-bar"
          style={{ width: `${clamped}%`, height: "100%", background: fill, borderRadius: 999 }}
        />
      </div>
      <span style={{ fontSize: "0.7rem", fontWeight: 700, color: labelColor, minWidth: 36, textAlign: "right" }}>
        {pct}%
      </span>
    </div>
  );
}

function StatusBadge({ pct }: { pct: number }) {
  if (pct >= 100) {
    return (
      <span className="badge" style={{ background: "#dcfce7", color: GREEN }}>
        <CheckCircle2 size={11} strokeWidth={2.5} /> บรรลุเป้า
      </span>
    );
  }
  if (pct >= 80) {
    return (
      <span className="badge" style={{ background: "#fef3c7", color: AMBER }}>
        <TrendingUp size={11} strokeWidth={2.5} /> ใกล้เป้า
      </span>
    );
  }
  return (
    <span className="badge" style={{ background: "#fee2e2", color: RED }}>
      <AlertCircle size={11} strokeWidth={2.5} /> ต่ำกว่าเป้า
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HQTargetsPage() {
  const [selectedQ, setSelectedQ] = useState<QuarterView>("overview");

  // Sort by annualTarget descending
  const sorted: SalesTarget[] = [...hqSalesTargets].sort((a, b) => b.annualTarget - a.annualTarget);

  // Summary calculations
  const totalAnnual = sorted.reduce((s, t) => s + t.annualTarget, 0);
  const totalH1Actual = sorted.reduce((s, t) => s + t.q1Actual + t.q2Actual, 0);
  const totalH1Target = sorted.reduce((s, t) => s + t.q1Target + t.q2Target, 0);
  const h1Pct = Math.round((totalH1Actual / totalH1Target) * 100);
  const onTrackCount = sorted.filter((t) => t.q1Actual + t.q2Actual >= (t.q1Target + t.q2Target) * 0.9).length;

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "7px 20px",
    borderRadius: 10,
    border: "none",
    cursor: "pointer",
    fontSize: "0.8rem",
    fontWeight: 700,
    background: active ? PRIMARY : "#f4f6f9",
    color: active ? "#fff" : MUTED,
    transition: "all 0.15s",
  });

  return (
    <div className="erp">
      {/* ── Page Header ── */}
      <div className="page-head">
        <div>
          <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Target size={22} color={PRIMARY} strokeWidth={2} />
            เป้าหมายการขาย 2026
          </h2>
          <p>ติดตามยอดขายรายสาขาเทียบกับเป้าหมายประจำปี</p>
        </div>

        {/* Quarter Tabs */}
        <div style={{ display: "flex", gap: 8, background: "#f4f6f9", borderRadius: 12, padding: 4 }}>
          {(["overview", "Q1", "Q2"] as QuarterView[]).map((q) => (
            <button key={q} style={tabStyle(selectedQ === q)} onClick={() => setSelectedQ(q)}>
              {q === "overview" ? "ภาพรวม" : q}
            </button>
          ))}
        </div>
      </div>

      {/* ── Summary Stats ── */}
      <div className="stat-grid">
        <StatCard
          label="เป้ารวมปี"
          value={fmtM(totalAnnual)}
          sub="6 สาขา ทั่วประเทศ"
          icon={<Target size={18} strokeWidth={2} />}
          iconBg="#dce5f0"
          accent={PRIMARY}
        />
        <StatCard
          label="ยอดจริง H1"
          value={fmtM(totalH1Actual)}
          sub={`จากเป้า H1 ${fmtM(totalH1Target)}`}
          icon={<TrendingUp size={18} strokeWidth={2} />}
          iconBg={totalH1Actual >= totalH1Target ? "#e5faf0" : "#fff3cd"}
          accent={totalH1Actual >= totalH1Target ? GREEN : AMBER}
        />
        <StatCard
          label="% บรรลุเป้า H1"
          value={`${h1Pct}%`}
          sub={h1Pct >= 100 ? "บรรลุเป้า H1 แล้ว" : `ขาดอีก ${fmtM(totalH1Target - totalH1Actual)}`}
          icon={
            h1Pct >= 100 ? (
              <CheckCircle2 size={18} strokeWidth={2} />
            ) : (
              <TrendingDown size={18} strokeWidth={2} />
            )
          }
          iconBg={h1Pct >= 100 ? "#e5faf0" : h1Pct >= 80 ? "#fff3cd" : "#fee2e2"}
          accent={pctColor(h1Pct)}
        />
        <StatCard
          label="สาขาตามเป้า"
          value={`${onTrackCount}/6`}
          sub="ยอดจริง H1 ≥ 90% ของเป้า H1"
          icon={<AlertCircle size={18} strokeWidth={2} />}
          iconBg={onTrackCount >= 5 ? "#e5faf0" : onTrackCount >= 3 ? "#fff3cd" : "#fee2e2"}
          accent={onTrackCount >= 5 ? GREEN : onTrackCount >= 3 ? AMBER : RED}
        />
      </div>

      {/* ── Main Table ── */}
      {selectedQ === "overview" && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">ผลงานรายสาขา — ภาพรวม H1 2026</div>
              <div className="card-desc">เรียงตามเป้าปีสูงสุด</div>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>สาขา</th>
                  <th>ภาค</th>
                  <th className="num">เป้า Q1</th>
                  <th className="num">ผล Q1</th>
                  <th className="num">เป้า Q2</th>
                  <th className="num">ผล Q2</th>
                  <th className="num">รวม H1</th>
                  <th className="num">เป้ารวมปี</th>
                  <th style={{ textAlign: "center" }}>ความคืบหน้าการขาย</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => {
                  const h1Actual = row.q1Actual + row.q2Actual;
                  const pct = Math.round((h1Actual / row.annualTarget) * 100);

                  const q1Color =
                    row.q1Actual >= row.q1Target ? GREEN
                    : row.q1Actual < row.q1Target * 0.8 ? RED
                    : AMBER;

                  const q2Color =
                    row.q2Actual >= row.q2Target ? GREEN
                    : row.q2Actual < row.q2Target * 0.8 ? RED
                    : AMBER;

                  return (
                    <tr key={row.dealerCode}>
                      {/* สาขา */}
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <span style={{ fontWeight: 700, color: PRIMARY }}>{row.dealerCode}</span>
                          <span style={{ fontSize: "0.72rem", color: MUTED }}>{row.dealerName}</span>
                        </div>
                      </td>
                      {/* ภาค */}
                      <td>
                        <span className="badge" style={{ background: "#f4f6f9", color: MUTED }}>
                          {row.region}
                        </span>
                      </td>
                      {/* เป้า Q1 */}
                      <td className="num" style={{ color: MUTED }}>{fmtM(row.q1Target)}</td>
                      {/* ผล Q1 */}
                      <td className="num">
                        <QuarterBadge actual={row.q1Actual} target={row.q1Target} />
                      </td>
                      {/* เป้า Q2 */}
                      <td className="num" style={{ color: MUTED }}>{fmtM(row.q2Target)}</td>
                      {/* ผล Q2 */}
                      <td className="num">
                        <QuarterBadge actual={row.q2Actual} target={row.q2Target} />
                      </td>
                      {/* รวม H1 */}
                      <td className="num">
                        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                          <span style={{ fontWeight: 700 }}>{fmtM(h1Actual)}</span>
                          <span style={{ fontSize: "0.68rem", color: q1Color }}>
                            {q1Color === GREEN && q2Color === GREEN ? "✓ ทั้ง 2 ไตรมาส" : ""}
                          </span>
                        </div>
                      </td>
                      {/* เป้ารวมปี */}
                      <td className="num" style={{ fontWeight: 600 }}>{fmtM(row.annualTarget)}</td>
                      {/* ความคืบหน้า */}
                      <td style={{ minWidth: 160 }}>
                        <ProgressBar pct={pct} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Q1 Single-Quarter View ── */}
      {selectedQ === "Q1" && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <TrendingUp size={16} color={PRIMARY} strokeWidth={2} />
                ผลงาน Q1 (ม.ค. – มี.ค. 2026)
              </div>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>สาขา</th>
                  <th className="num">เป้า Q1</th>
                  <th className="num">ผล Q1</th>
                  <th>% ของเป้า</th>
                  <th>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => {
                  const pct = Math.round((row.q1Actual / row.q1Target) * 100);
                  const color = pct >= 100 ? GREEN : pct >= 80 ? AMBER : RED;
                  return (
                    <tr key={row.dealerCode}>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                          <span style={{ fontWeight: 700, color: PRIMARY }}>{row.dealerCode}</span>
                          <span style={{ fontSize: "0.72rem", color: MUTED }}>{row.dealerName}</span>
                        </div>
                      </td>
                      <td className="num" style={{ color: MUTED }}>{fmtM(row.q1Target)}</td>
                      <td className="num" style={{ fontWeight: 700, color }}>{fmtM(row.q1Actual)}</td>
                      <td>
                        <ProgressBar pct={pct} />
                      </td>
                      <td><StatusBadge pct={pct} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Q2 Single-Quarter View ── */}
      {selectedQ === "Q2" && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <TrendingUp size={16} color={PRIMARY} strokeWidth={2} />
                ผลงาน Q2 (เม.ย. – มิ.ย. 2026)
              </div>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>สาขา</th>
                  <th className="num">เป้า Q2</th>
                  <th className="num">ผล Q2</th>
                  <th>% ของเป้า</th>
                  <th>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => {
                  const pct = Math.round((row.q2Actual / row.q2Target) * 100);
                  const color = pct >= 100 ? GREEN : pct >= 80 ? AMBER : RED;
                  return (
                    <tr key={row.dealerCode}>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                          <span style={{ fontWeight: 700, color: PRIMARY }}>{row.dealerCode}</span>
                          <span style={{ fontSize: "0.72rem", color: MUTED }}>{row.dealerName}</span>
                        </div>
                      </td>
                      <td className="num" style={{ color: MUTED }}>{fmtM(row.q2Target)}</td>
                      <td className="num" style={{ fontWeight: 700, color }}>{fmtM(row.q2Actual)}</td>
                      <td>
                        <ProgressBar pct={pct} />
                      </td>
                      <td><StatusBadge pct={pct} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Footer note ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 0" }}>
        <AlertCircle size={13} color={MUTED} strokeWidth={2} />
        <span style={{ fontSize: "0.72rem", color: MUTED }}>
          Q3–Q4 ยังไม่มีข้อมูลจริง · แสดงเฉพาะเป้าหมาย · อัปเดตล่าสุด: 26 มิ.ย. 2026
        </span>
      </div>
    </div>
  );
}
